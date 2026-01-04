import { Injectable, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CloudSubscriptionsService } from "./cloud-subscriptions.service";
import type { PlanLimits } from "./cloud-plans.service";

/**
 * Usage metrics for a period.
 */
export interface UsageMetrics {
  apiCalls: number;
  customers: number;
  webhooks: number;
  events: number;
  teamMembers: number;
  offersCreated: number;
}

/**
 * Usage with limits comparison.
 */
export interface UsageWithLimits {
  metrics: UsageMetrics;
  limits: PlanLimits;
  percentages: {
    apiCalls: number | null;
    customers: number | null;
    webhooks: number | null;
    events: number | null;
    teamMembers: number | null;
    offersCreated: number | null;
  };
  atLimit: string[];
  overLimit: string[];
}

/**
 * Limit check result.
 */
export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number | null;
  percentage: number | null;
}

@Injectable()
export class CloudUsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: CloudSubscriptionsService,
  ) {}

  /**
   * Get or create usage record for current period.
   */
  async getOrCreateCurrentUsage(workspaceId: string) {
    const subscription = await this.prisma.cloudSubscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription) {
      return null;
    }

    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;

    let usage = await this.prisma.cloudUsage.findUnique({
      where: {
        subscriptionId_periodStart: {
          subscriptionId: subscription.id,
          periodStart,
        },
      },
    });

    if (!usage) {
      // Create new usage record for this period
      usage = await this.prisma.cloudUsage.create({
        data: {
          subscriptionId: subscription.id,
          workspaceId,
          periodStart,
          periodEnd,
        },
      });
    }

    return usage;
  }

  /**
   * Increment a usage metric.
   */
  async incrementUsage(
    workspaceId: string,
    metric: keyof UsageMetrics,
    amount: number = 1,
  ): Promise<void> {
    const usage = await this.getOrCreateCurrentUsage(workspaceId);
    if (!usage) return;

    const data: Record<string, { increment: number }> = {};
    data[metric] = { increment: amount };

    await this.prisma.cloudUsage.update({
      where: { id: usage.id },
      data,
    });
  }

  /**
   * Set a usage metric (for absolute values like customer count).
   */
  async setUsage(
    workspaceId: string,
    metric: keyof UsageMetrics,
    value: number,
  ): Promise<void> {
    const usage = await this.getOrCreateCurrentUsage(workspaceId);
    if (!usage) return;

    const data: Record<string, number> = {};
    data[metric] = value;

    await this.prisma.cloudUsage.update({
      where: { id: usage.id },
      data,
    });
  }

  /**
   * Get current usage metrics.
   */
  async getCurrentUsage(workspaceId: string): Promise<UsageMetrics> {
    const usage = await this.getOrCreateCurrentUsage(workspaceId);

    if (!usage) {
      return {
        apiCalls: 0,
        customers: 0,
        webhooks: 0,
        events: 0,
        teamMembers: 0,
        offersCreated: 0,
      };
    }

    return {
      apiCalls: usage.apiCalls,
      customers: usage.customers,
      webhooks: usage.webhooks,
      events: usage.events,
      teamMembers: usage.teamMembers,
      offersCreated: usage.offersCreated,
    };
  }

  /**
   * Get usage with limits comparison.
   */
  async getUsageWithLimits(workspaceId: string): Promise<UsageWithLimits> {
    const [metrics, limits] = await Promise.all([
      this.getCurrentUsage(workspaceId),
      this.subscriptionsService.getWorkspaceLimits(workspaceId),
    ]);

    const calculatePercentage = (
      current: number,
      limit: number | null,
    ): number | null => {
      if (limit === null) return null;
      if (limit === 0) return current > 0 ? 100 : 0;
      return Math.round((current / limit) * 100);
    };

    const percentages = {
      apiCalls: calculatePercentage(metrics.apiCalls, limits.maxApiCalls),
      customers: calculatePercentage(metrics.customers, limits.maxCustomers),
      webhooks: calculatePercentage(metrics.webhooks, limits.maxWebhooks),
      events: calculatePercentage(metrics.events, limits.maxEventsPerMonth),
      teamMembers: calculatePercentage(
        metrics.teamMembers,
        limits.maxTeamMembers,
      ),
      offersCreated: calculatePercentage(
        metrics.offersCreated,
        limits.maxOffersPerMonth,
      ),
    };

    const atLimit: string[] = [];
    const overLimit: string[] = [];

    const checkLimit = (
      name: string,
      current: number,
      limit: number | null,
    ) => {
      if (limit !== null) {
        if (current > limit) {
          overLimit.push(name);
        } else if (current === limit) {
          atLimit.push(name);
        }
      }
    };

    checkLimit("apiCalls", metrics.apiCalls, limits.maxApiCalls);
    checkLimit("customers", metrics.customers, limits.maxCustomers);
    checkLimit("webhooks", metrics.webhooks, limits.maxWebhooks);
    checkLimit("events", metrics.events, limits.maxEventsPerMonth);
    checkLimit("teamMembers", metrics.teamMembers, limits.maxTeamMembers);
    checkLimit("offersCreated", metrics.offersCreated, limits.maxOffersPerMonth);

    return {
      metrics,
      limits,
      percentages,
      atLimit,
      overLimit,
    };
  }

  /**
   * Check if a specific limit would be exceeded.
   */
  async checkLimit(
    workspaceId: string,
    metric: keyof UsageMetrics,
    increment: number = 1,
  ): Promise<LimitCheckResult> {
    const [usage, limits] = await Promise.all([
      this.getCurrentUsage(workspaceId),
      this.subscriptionsService.getWorkspaceLimits(workspaceId),
    ]);

    const limitMap: Record<keyof UsageMetrics, keyof PlanLimits> = {
      apiCalls: "maxApiCalls",
      customers: "maxCustomers",
      webhooks: "maxWebhooks",
      events: "maxEventsPerMonth",
      teamMembers: "maxTeamMembers",
      offersCreated: "maxOffersPerMonth",
    };

    const limitKey = limitMap[metric];
    const limit = limits[limitKey];
    const current = usage[metric];
    const newValue = current + increment;

    if (limit === null) {
      // Unlimited
      return {
        allowed: true,
        current,
        limit: null,
        percentage: null,
      };
    }

    const percentage = Math.round((current / limit) * 100);

    if (newValue > limit) {
      return {
        allowed: false,
        reason: `${metric} limit exceeded (${current}/${limit})`,
        current,
        limit,
        percentage,
      };
    }

    return {
      allowed: true,
      current,
      limit,
      percentage,
    };
  }

  /**
   * Enforce a limit check and throw if exceeded.
   */
  async enforceLimit(
    workspaceId: string,
    metric: keyof UsageMetrics,
    increment: number = 1,
  ): Promise<void> {
    const result = await this.checkLimit(workspaceId, metric, increment);

    if (!result.allowed) {
      throw new ForbiddenException({
        code: "LIMIT_EXCEEDED",
        message: result.reason,
        metric,
        current: result.current,
        limit: result.limit,
      });
    }
  }

  /**
   * Track API call and check limits.
   */
  async trackApiCall(workspaceId: string): Promise<void> {
    await this.enforceLimit(workspaceId, "apiCalls");
    await this.incrementUsage(workspaceId, "apiCalls");
  }

  /**
   * Sync customer count from database.
   */
  async syncCustomerCount(workspaceId: string): Promise<number> {
    const count = await this.prisma.customer.count({
      where: { workspaceId },
    });

    await this.setUsage(workspaceId, "customers", count);
    return count;
  }

  /**
   * Sync webhook count from database.
   */
  async syncWebhookCount(workspaceId: string): Promise<number> {
    const count = await this.prisma.webhookEndpoint.count({
      where: { workspaceId, status: "active" },
    });

    await this.setUsage(workspaceId, "webhooks", count);
    return count;
  }

  /**
   * Sync team member count from database.
   */
  async syncTeamMemberCount(workspaceId: string): Promise<number> {
    const count = await this.prisma.workspaceMembership.count({
      where: { workspaceId },
    });

    await this.setUsage(workspaceId, "teamMembers", count);
    return count;
  }

  /**
   * Get usage history for a workspace.
   */
  async getUsageHistory(
    workspaceId: string,
    options?: { months?: number },
  ) {
    const months = options?.months ?? 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    return this.prisma.cloudUsage.findMany({
      where: {
        workspaceId,
        periodStart: { gte: startDate },
      },
      orderBy: { periodStart: "desc" },
    });
  }

  /**
   * Calculate overage charges.
   */
  async calculateOverage(
    workspaceId: string,
  ): Promise<{ metric: string; overage: number; charge: number }[]> {
    const usageWithLimits = await this.getUsageWithLimits(workspaceId);
    const overages: { metric: string; overage: number; charge: number }[] = [];

    // Only API calls have overage charges in this model
    const apiOverage =
      usageWithLimits.limits.maxApiCalls !== null
        ? Math.max(
            0,
            usageWithLimits.metrics.apiCalls -
              usageWithLimits.limits.maxApiCalls,
          )
        : 0;

    if (apiOverage > 0) {
      // $0.001 per extra API call (100 cents per 1000 calls)
      const charge = Math.ceil(apiOverage / 1000) * 100;
      overages.push({
        metric: "apiCalls",
        overage: apiOverage,
        charge,
      });
    }

    return overages;
  }

  /**
   * Record overage in usage record.
   */
  async recordOverage(workspaceId: string): Promise<void> {
    const usage = await this.getOrCreateCurrentUsage(workspaceId);
    if (!usage) return;

    const overages = await this.calculateOverage(workspaceId);
    const totalOverageAmount = overages.reduce((sum, o) => sum + o.charge, 0);
    const apiOverage =
      overages.find((o) => o.metric === "apiCalls")?.overage ?? 0;

    await this.prisma.cloudUsage.update({
      where: { id: usage.id },
      data: {
        apiCallsOverage: apiOverage,
        overageAmount: totalOverageAmount,
      },
    });
  }

  /**
   * Reset usage for new period.
   */
  async resetPeriodUsage(subscriptionId: string): Promise<void> {
    const subscription = await this.prisma.cloudSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) return;

    // Create new usage record for the new period
    await this.prisma.cloudUsage.create({
      data: {
        subscriptionId: subscription.id,
        workspaceId: subscription.workspaceId,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
      },
    });
  }
}
