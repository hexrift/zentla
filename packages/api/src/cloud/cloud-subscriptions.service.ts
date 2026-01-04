import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CloudPlansService, PlanLimits } from "./cloud-plans.service";
import type {
  CloudSubscriptionStatus,
  CloudBillingInterval,
} from "@prisma/client";

/**
 * Options for creating a subscription.
 */
export interface CreateSubscriptionOptions {
  workspaceId: string;
  planKey: string;
  billingInterval?: CloudBillingInterval;
  startTrial?: boolean;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
}

/**
 * Options for changing a subscription plan.
 */
export interface ChangePlanOptions {
  newPlanKey: string;
  immediately?: boolean;
}

/**
 * Subscription with plan details.
 */
export interface SubscriptionWithPlan {
  id: string;
  workspaceId: string;
  status: CloudSubscriptionStatus;
  billingInterval: CloudBillingInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart: Date | null;
  trialEnd: Date | null;
  cancelAt: Date | null;
  plan: {
    id: string;
    key: string;
    name: string;
    tier: string;
    monthlyPrice: number;
    yearlyPrice: number;
  };
}

@Injectable()
export class CloudSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: CloudPlansService,
  ) {}

  /**
   * Create a new subscription for a workspace.
   */
  async createSubscription(
    options: CreateSubscriptionOptions,
  ): Promise<SubscriptionWithPlan> {
    // Check if workspace already has a subscription
    const existing = await this.prisma.cloudSubscription.findUnique({
      where: { workspaceId: options.workspaceId },
    });

    if (existing) {
      throw new BadRequestException("Workspace already has a subscription");
    }

    // Get the plan
    const plan = await this.plansService.getPlanByKey(options.planKey);
    if (!plan) {
      throw new NotFoundException(`Plan ${options.planKey} not found`);
    }

    const now = new Date();
    const billingInterval = options.billingInterval ?? "monthly";

    // Calculate period end based on billing interval
    const periodEnd = this.calculatePeriodEnd(now, billingInterval);

    // Determine trial dates
    let trialStart: Date | null = null;
    let trialEnd: Date | null = null;
    let status: CloudSubscriptionStatus = "active";

    if (options.startTrial && plan.trialDays > 0) {
      trialStart = now;
      trialEnd = new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);
      status = "trialing";
    }

    const subscription = await this.prisma.cloudSubscription.create({
      data: {
        workspaceId: options.workspaceId,
        planId: plan.id,
        status,
        billingInterval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart,
        trialEnd,
        providerSubscriptionId: options.providerSubscriptionId,
        providerCustomerId: options.providerCustomerId,
      },
      include: {
        plan: true,
      },
    });

    return this.formatSubscription(subscription);
  }

  /**
   * Get subscription for a workspace.
   */
  async getSubscription(
    workspaceId: string,
  ): Promise<SubscriptionWithPlan | null> {
    const subscription = await this.prisma.cloudSubscription.findUnique({
      where: { workspaceId },
      include: { plan: true },
    });

    if (!subscription) {
      return null;
    }

    return this.formatSubscription(subscription);
  }

  /**
   * Get subscription by ID.
   */
  async getSubscriptionById(
    subscriptionId: string,
  ): Promise<SubscriptionWithPlan | null> {
    const subscription = await this.prisma.cloudSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      return null;
    }

    return this.formatSubscription(subscription);
  }

  /**
   * Change subscription plan.
   */
  async changePlan(
    workspaceId: string,
    options: ChangePlanOptions,
  ): Promise<SubscriptionWithPlan> {
    const subscription = await this.prisma.cloudSubscription.findUnique({
      where: { workspaceId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }

    const newPlan = await this.plansService.getPlanByKey(options.newPlanKey);
    if (!newPlan) {
      throw new NotFoundException(`Plan ${options.newPlanKey} not found`);
    }

    if (subscription.planId === newPlan.id) {
      throw new BadRequestException("Already on this plan");
    }

    // Check if this is an upgrade or downgrade
    const comparison = await this.plansService.comparePlans(
      subscription.planId,
      newPlan.id,
    );

    const now = new Date();

    // If upgrading immediately or downgrade at period end
    if (options.immediately || comparison.isUpgrade) {
      const updated = await this.prisma.cloudSubscription.update({
        where: { id: subscription.id },
        data: {
          planId: newPlan.id,
          // Reset period on immediate change
          currentPeriodStart: options.immediately ? now : undefined,
          currentPeriodEnd: options.immediately
            ? this.calculatePeriodEnd(now, subscription.billingInterval)
            : undefined,
        },
        include: { plan: true },
      });

      return this.formatSubscription(updated);
    }

    // For downgrades, schedule at period end (store in metadata)
    const updated = await this.prisma.cloudSubscription.update({
      where: { id: subscription.id },
      data: {
        metadata: {
          ...(subscription.metadata as object),
          scheduledPlanChange: {
            newPlanId: newPlan.id,
            effectiveAt: subscription.currentPeriodEnd.toISOString(),
          },
        },
      },
      include: { plan: true },
    });

    return this.formatSubscription(updated);
  }

  /**
   * Cancel subscription.
   */
  async cancelSubscription(
    workspaceId: string,
    options?: { immediately?: boolean },
  ): Promise<SubscriptionWithPlan> {
    const subscription = await this.prisma.cloudSubscription.findUnique({
      where: { workspaceId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }

    if (subscription.status === "canceled") {
      throw new BadRequestException("Subscription is already canceled");
    }

    const now = new Date();

    if (options?.immediately) {
      const updated = await this.prisma.cloudSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "canceled",
          canceledAt: now,
          cancelAt: now,
        },
        include: { plan: true },
      });

      return this.formatSubscription(updated);
    }

    // Schedule cancellation at period end
    const updated = await this.prisma.cloudSubscription.update({
      where: { id: subscription.id },
      data: {
        cancelAt: subscription.currentPeriodEnd,
        canceledAt: now,
      },
      include: { plan: true },
    });

    return this.formatSubscription(updated);
  }

  /**
   * Reactivate a canceled subscription.
   */
  async reactivateSubscription(
    workspaceId: string,
  ): Promise<SubscriptionWithPlan> {
    const subscription = await this.prisma.cloudSubscription.findUnique({
      where: { workspaceId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }

    if (subscription.status === "canceled") {
      throw new BadRequestException(
        "Cannot reactivate a fully canceled subscription",
      );
    }

    if (!subscription.cancelAt) {
      throw new BadRequestException("Subscription is not scheduled to cancel");
    }

    const updated = await this.prisma.cloudSubscription.update({
      where: { id: subscription.id },
      data: {
        cancelAt: null,
        canceledAt: null,
      },
      include: { plan: true },
    });

    return this.formatSubscription(updated);
  }

  /**
   * Update subscription status.
   */
  async updateStatus(
    subscriptionId: string,
    status: CloudSubscriptionStatus,
  ): Promise<void> {
    await this.prisma.cloudSubscription.update({
      where: { id: subscriptionId },
      data: { status },
    });
  }

  /**
   * Renew subscription period.
   */
  async renewPeriod(subscriptionId: string): Promise<SubscriptionWithPlan> {
    const subscription = await this.prisma.cloudSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }

    const now = new Date();
    const newPeriodEnd = this.calculatePeriodEnd(
      now,
      subscription.billingInterval,
    );

    // Check for scheduled plan changes
    const metadata = subscription.metadata as {
      scheduledPlanChange?: { newPlanId: string };
    };

    const updated = await this.prisma.cloudSubscription.update({
      where: { id: subscriptionId },
      data: {
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        status: "active",
        // Apply scheduled plan change if exists
        planId: metadata?.scheduledPlanChange?.newPlanId ?? subscription.planId,
        metadata: metadata?.scheduledPlanChange
          ? { scheduledPlanChange: null }
          : undefined,
      },
      include: { plan: true },
    });

    return this.formatSubscription(updated);
  }

  /**
   * Get current plan limits for a workspace.
   */
  async getWorkspaceLimits(workspaceId: string): Promise<PlanLimits> {
    const subscription = await this.prisma.cloudSubscription.findUnique({
      where: { workspaceId },
      include: { plan: true },
    });

    if (!subscription) {
      // Return free tier limits by default
      const freePlan = await this.plansService.getPlanByKey("free");
      if (freePlan) {
        return this.plansService.getPlanLimits(freePlan.id);
      }

      // Fallback limits
      return {
        maxWorkspaces: 1,
        maxCustomers: 100,
        maxApiCalls: 1000,
        maxWebhooks: 2,
        maxTeamMembers: 1,
        maxOffersPerMonth: 5,
        maxEventsPerMonth: 1000,
      };
    }

    return this.plansService.getPlanLimits(subscription.planId);
  }

  /**
   * Check if a workspace has access to a feature.
   */
  async hasFeature(workspaceId: string, feature: string): Promise<boolean> {
    const subscription = await this.prisma.cloudSubscription.findUnique({
      where: { workspaceId },
      include: { plan: true },
    });

    if (!subscription) {
      return false;
    }

    const features = subscription.plan.features as Record<string, boolean>;
    return features[feature] === true;
  }

  /**
   * Check if subscription is active.
   */
  async isActive(workspaceId: string): Promise<boolean> {
    const subscription = await this.prisma.cloudSubscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription) {
      return false;
    }

    return subscription.status === "active" || subscription.status === "trialing";
  }

  /**
   * Get subscriptions expiring soon.
   */
  async getExpiringSoon(withinDays: number = 7) {
    const now = new Date();
    const threshold = new Date(
      now.getTime() + withinDays * 24 * 60 * 60 * 1000,
    );

    return this.prisma.cloudSubscription.findMany({
      where: {
        status: "trialing",
        trialEnd: {
          gte: now,
          lte: threshold,
        },
      },
      include: {
        plan: true,
        workspace: true,
      },
    });
  }

  /**
   * Process expired trials.
   */
  async processExpiredTrials(): Promise<number> {
    const now = new Date();

    const expiredTrials = await this.prisma.cloudSubscription.findMany({
      where: {
        status: "trialing",
        trialEnd: { lte: now },
      },
    });

    for (const subscription of expiredTrials) {
      await this.prisma.cloudSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "active", // Convert to active (will require payment)
          trialEnd: null,
        },
      });
    }

    return expiredTrials.length;
  }

  /**
   * Process pending cancellations.
   */
  async processPendingCancellations(): Promise<number> {
    const now = new Date();

    const pendingCancellations = await this.prisma.cloudSubscription.findMany({
      where: {
        cancelAt: { lte: now },
        status: { not: "canceled" },
      },
    });

    for (const subscription of pendingCancellations) {
      await this.prisma.cloudSubscription.update({
        where: { id: subscription.id },
        data: { status: "canceled" },
      });
    }

    return pendingCancellations.length;
  }

  // Private helpers

  private calculatePeriodEnd(
    start: Date,
    interval: CloudBillingInterval,
  ): Date {
    const end = new Date(start);

    if (interval === "monthly") {
      end.setMonth(end.getMonth() + 1);
    } else {
      end.setFullYear(end.getFullYear() + 1);
    }

    return end;
  }

  private formatSubscription(subscription: {
    id: string;
    workspaceId: string;
    status: CloudSubscriptionStatus;
    billingInterval: CloudBillingInterval;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialStart: Date | null;
    trialEnd: Date | null;
    cancelAt: Date | null;
    plan: {
      id: string;
      key: string;
      name: string;
      tier: string;
      monthlyPrice: number;
      yearlyPrice: number;
    };
  }): SubscriptionWithPlan {
    return {
      id: subscription.id,
      workspaceId: subscription.workspaceId,
      status: subscription.status,
      billingInterval: subscription.billingInterval,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      cancelAt: subscription.cancelAt,
      plan: {
        id: subscription.plan.id,
        key: subscription.plan.key,
        name: subscription.plan.name,
        tier: subscription.plan.tier,
        monthlyPrice: subscription.plan.monthlyPrice,
        yearlyPrice: subscription.plan.yearlyPrice,
      },
    };
  }
}
