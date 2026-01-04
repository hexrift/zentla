import { Injectable, ForbiddenException } from "@nestjs/common";
import { EntitlementsService, EntitlementCheck } from "./entitlements.service";
import { UsageService } from "../usage/usage.service";
import { PrismaService } from "../database/prisma.service";

export interface EnforcementResult {
  allowed: boolean;
  featureKey: string;
  entitlement: EntitlementCheck;
  currentUsage?: number;
  limit?: number;
  remaining?: number;
  message?: string;
}

export interface EnforcementOptions {
  /**
   * If true, throw ForbiddenException when limit exceeded.
   * If false, return result without throwing.
   * Default: true
   */
  throwOnExceeded?: boolean;

  /**
   * Amount to increment usage by (for pre-check before action).
   * Default: 1
   */
  incrementBy?: number;

  /**
   * Custom error message when limit exceeded.
   */
  errorMessage?: string;
}

/**
 * Enforcement modes for entitlements
 */
export type EnforcementMode = "hard" | "soft" | "warn";

@Injectable()
export class EnforcementService {
  constructor(
    private readonly entitlementsService: EntitlementsService,
    private readonly usageService: UsageService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Check if a customer can perform an action based on their entitlement limits.
   * Compares current usage against the entitlement value for numeric entitlements.
   *
   * @param workspaceId - The workspace ID
   * @param customerId - The customer ID
   * @param featureKey - The feature/entitlement key to check
   * @param options - Enforcement options
   * @returns EnforcementResult with allowed status and usage details
   * @throws ForbiddenException if throwOnExceeded is true and limit exceeded
   */
  async enforce(
    workspaceId: string,
    customerId: string,
    featureKey: string,
    options: EnforcementOptions = {},
  ): Promise<EnforcementResult> {
    const { throwOnExceeded = true, incrementBy = 1, errorMessage } = options;

    // Get entitlement for this feature
    const entitlement = await this.entitlementsService.checkEntitlement(
      workspaceId,
      customerId,
      featureKey,
    );

    // No access at all - block immediately
    if (!entitlement.hasAccess) {
      const result: EnforcementResult = {
        allowed: false,
        featureKey,
        entitlement,
        message:
          errorMessage || `Access denied: no entitlement for ${featureKey}`,
      };

      if (throwOnExceeded) {
        throw new ForbiddenException(result.message);
      }
      return result;
    }

    // Boolean entitlements - just check hasAccess
    if (entitlement.valueType === "boolean") {
      return {
        allowed: entitlement.value === true,
        featureKey,
        entitlement,
      };
    }

    // Unlimited entitlements - always allowed
    if (
      entitlement.valueType === "unlimited" ||
      entitlement.value === Infinity
    ) {
      return {
        allowed: true,
        featureKey,
        entitlement,
        limit: Infinity,
        remaining: Infinity,
      };
    }

    // Numeric entitlements - check against usage
    if (entitlement.valueType === "number") {
      const limit = entitlement.value as number;
      const currentUsage = await this.getCurrentUsageForCustomer(
        workspaceId,
        customerId,
        featureKey,
      );

      const projectedUsage = currentUsage + incrementBy;
      const allowed = projectedUsage <= limit;
      const remaining = Math.max(0, limit - currentUsage);

      const result: EnforcementResult = {
        allowed,
        featureKey,
        entitlement,
        currentUsage,
        limit,
        remaining,
        message: allowed
          ? undefined
          : errorMessage ||
            `Limit exceeded for ${featureKey}: ${currentUsage}/${limit} used`,
      };

      if (!allowed && throwOnExceeded) {
        throw new ForbiddenException(result.message);
      }

      return result;
    }

    // String entitlements - just check hasAccess (e.g., tier levels)
    return {
      allowed: true,
      featureKey,
      entitlement,
    };
  }

  /**
   * Check multiple entitlements at once and return enforcement results.
   * Does not throw - returns results for all features.
   */
  async enforceMultiple(
    workspaceId: string,
    customerId: string,
    featureKeys: string[],
    options: Omit<EnforcementOptions, "throwOnExceeded"> = {},
  ): Promise<EnforcementResult[]> {
    const results = await Promise.all(
      featureKeys.map((featureKey) =>
        this.enforce(workspaceId, customerId, featureKey, {
          ...options,
          throwOnExceeded: false,
        }),
      ),
    );
    return results;
  }

  /**
   * Check if any of the enforcement results indicate a limit exceeded.
   */
  anyExceeded(results: EnforcementResult[]): boolean {
    return results.some((r) => !r.allowed);
  }

  /**
   * Get all exceeded features from enforcement results.
   */
  getExceeded(results: EnforcementResult[]): EnforcementResult[] {
    return results.filter((r) => !r.allowed);
  }

  /**
   * Record usage after an action is performed.
   * Use this after enforce() returns allowed=true.
   */
  async recordUsage(
    workspaceId: string,
    customerId: string,
    featureKey: string,
    quantity: number = 1,
    subscriptionId?: string,
  ): Promise<void> {
    await this.usageService.ingestEvent(workspaceId, {
      customerId,
      subscriptionId,
      metricKey: featureKey,
      quantity,
      idempotencyKey: `${customerId}:${featureKey}:${Date.now()}`,
    });
  }

  /**
   * Enforce and record usage in one call.
   * First checks if allowed, then records usage if allowed.
   */
  async enforceAndRecord(
    workspaceId: string,
    customerId: string,
    featureKey: string,
    quantity: number = 1,
    subscriptionId?: string,
    options: EnforcementOptions = {},
  ): Promise<EnforcementResult> {
    const result = await this.enforce(workspaceId, customerId, featureKey, {
      ...options,
      incrementBy: quantity,
    });

    if (result.allowed) {
      await this.recordUsage(
        workspaceId,
        customerId,
        featureKey,
        quantity,
        subscriptionId,
      );
    }

    return result;
  }

  /**
   * Get current usage for a customer for a specific feature.
   * Looks up active subscription and gets usage for current billing period.
   */
  private async getCurrentUsageForCustomer(
    workspaceId: string,
    customerId: string,
    metricKey: string,
  ): Promise<number> {
    // Find active subscription for this customer
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        workspaceId,
        customerId,
        status: { in: ["active", "trialing"] },
      },
      select: {
        id: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription) {
      // No active subscription - default to current month
      const now = new Date();
      const periodStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      const periodEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
      );

      const summary = await this.usageService.getUsageSummary(
        workspaceId,
        customerId,
        metricKey,
        periodStart,
        periodEnd,
      );
      return summary.totalQuantity;
    }

    // Get usage for subscription's current billing period
    const summary = await this.usageService.getUsageSummary(
      workspaceId,
      customerId,
      metricKey,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
    );

    return summary.totalQuantity;
  }

  /**
   * Get usage summary for a customer including all metered features.
   */
  async getUsageSummary(
    workspaceId: string,
    customerId: string,
  ): Promise<
    Array<{
      featureKey: string;
      currentUsage: number;
      limit: number | null;
      remaining: number | null;
      percentUsed: number | null;
    }>
  > {
    // Get all numeric entitlements for this customer
    const customerEntitlements =
      await this.entitlementsService.getCustomerEntitlements(
        workspaceId,
        customerId,
      );

    const numericEntitlements = customerEntitlements.entitlements.filter(
      (e) => e.valueType === "number" || e.valueType === "unlimited",
    );

    const summaries = await Promise.all(
      numericEntitlements.map(async (entitlement) => {
        const currentUsage = await this.getCurrentUsageForCustomer(
          workspaceId,
          customerId,
          entitlement.featureKey,
        );

        const limit =
          entitlement.valueType === "unlimited"
            ? null
            : (entitlement.value as number);

        const remaining =
          limit !== null ? Math.max(0, limit - currentUsage) : null;

        const percentUsed =
          limit !== null && limit > 0
            ? Math.round((currentUsage / limit) * 100)
            : null;

        return {
          featureKey: entitlement.featureKey,
          currentUsage,
          limit,
          remaining,
          percentUsed,
        };
      }),
    );

    return summaries;
  }
}
