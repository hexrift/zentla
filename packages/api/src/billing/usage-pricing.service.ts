import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { UsageService } from "../usage/usage.service";
import type { PricingModel, PricingTier } from "@zentla/core";

/**
 * Pricing calculation result for a single usage metric.
 */
export interface UsagePriceCalculation {
  metricKey: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  pricingModel: PricingModel;
  tierBreakdown?: TierBreakdown[];
}

/**
 * Breakdown of pricing by tier (for tiered/volume pricing).
 */
export interface TierBreakdown {
  tierIndex: number;
  from: number;
  to: number | null;
  quantity: number;
  unitPrice: number;
  tierTotal: number;
}

/**
 * Combined pricing calculation for a subscription period.
 */
export interface SubscriptionUsagePricing {
  subscriptionId: string;
  customerId: string;
  periodStart: Date;
  periodEnd: Date;
  basePrice: number;
  usageCharges: UsagePriceCalculation[];
  totalUsagePrice: number;
  totalPrice: number;
  currency: string;
}

/**
 * Pricing configuration for usage-based calculation.
 */
export interface UsagePricingConfig {
  model: PricingModel;
  currency: string;
  amount: number;
  tiers?: PricingTier[];
}

@Injectable()
export class UsagePricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usageService: UsageService,
  ) {}

  /**
   * Calculate price for a given usage quantity using the specified pricing model.
   */
  calculatePrice(
    quantity: number,
    config: UsagePricingConfig,
    metricKey: string = "usage",
  ): UsagePriceCalculation {
    switch (config.model) {
      case "flat":
        return this.calculateFlatPrice(quantity, config, metricKey);

      case "per_unit":
        return this.calculatePerUnitPrice(quantity, config, metricKey);

      case "tiered":
        return this.calculateTieredPrice(quantity, config, metricKey);

      case "volume":
        return this.calculateVolumePrice(quantity, config, metricKey);

      default:
        throw new Error(`Unknown pricing model: ${config.model}`);
    }
  }

  /**
   * Flat pricing: Fixed price regardless of usage.
   */
  private calculateFlatPrice(
    quantity: number,
    config: UsagePricingConfig,
    metricKey: string,
  ): UsagePriceCalculation {
    return {
      metricKey,
      quantity,
      unitPrice: 0,
      totalPrice: config.amount,
      currency: config.currency,
      pricingModel: "flat",
    };
  }

  /**
   * Per-unit pricing: Same price per unit for all usage.
   */
  private calculatePerUnitPrice(
    quantity: number,
    config: UsagePricingConfig,
    metricKey: string,
  ): UsagePriceCalculation {
    const totalPrice = Math.round(quantity * config.amount);

    return {
      metricKey,
      quantity,
      unitPrice: config.amount,
      totalPrice,
      currency: config.currency,
      pricingModel: "per_unit",
    };
  }

  /**
   * Tiered pricing: Different price per unit at each tier.
   * Each unit is priced at its tier rate.
   * Example: First 100 at $0.10, next 100 at $0.08, etc.
   */
  private calculateTieredPrice(
    quantity: number,
    config: UsagePricingConfig,
    metricKey: string,
  ): UsagePriceCalculation {
    if (!config.tiers || config.tiers.length === 0) {
      // Fall back to per-unit if no tiers defined
      return this.calculatePerUnitPrice(quantity, config, metricKey);
    }

    const tierBreakdown: TierBreakdown[] = [];
    let remaining = quantity;
    let totalPrice = 0;
    let previousUpTo = 0;

    for (let i = 0; i < config.tiers.length && remaining > 0; i++) {
      const tier = config.tiers[i];
      const tierStart = previousUpTo;
      const tierEnd = tier.upTo ?? Infinity;
      const tierCapacity = tierEnd - tierStart;
      const tierQuantity = Math.min(remaining, tierCapacity);

      // Apply flat amount for entering this tier (if any)
      const flatAmount = tier.flatAmount ?? 0;
      const tierTotal = flatAmount + Math.round(tierQuantity * tier.unitAmount);

      tierBreakdown.push({
        tierIndex: i,
        from: tierStart,
        to: tier.upTo,
        quantity: tierQuantity,
        unitPrice: tier.unitAmount,
        tierTotal,
      });

      totalPrice += tierTotal;
      remaining -= tierQuantity;
      previousUpTo = tier.upTo ?? Infinity;
    }

    // Calculate effective unit price
    const unitPrice = quantity > 0 ? totalPrice / quantity : 0;

    return {
      metricKey,
      quantity,
      unitPrice,
      totalPrice,
      currency: config.currency,
      pricingModel: "tiered",
      tierBreakdown,
    };
  }

  /**
   * Volume pricing: All units priced at the rate of the tier they fall into.
   * Example: If usage is 150, ALL 150 units are priced at the tier 2 rate.
   */
  private calculateVolumePrice(
    quantity: number,
    config: UsagePricingConfig,
    metricKey: string,
  ): UsagePriceCalculation {
    if (!config.tiers || config.tiers.length === 0) {
      return this.calculatePerUnitPrice(quantity, config, metricKey);
    }

    // Find the tier that applies to this quantity
    let applicableTier = config.tiers[config.tiers.length - 1];
    for (const tier of config.tiers) {
      if (tier.upTo === null || quantity <= tier.upTo) {
        applicableTier = tier;
        break;
      }
    }

    const flatAmount = applicableTier.flatAmount ?? 0;
    const totalPrice =
      flatAmount + Math.round(quantity * applicableTier.unitAmount);

    return {
      metricKey,
      quantity,
      unitPrice: applicableTier.unitAmount,
      totalPrice,
      currency: config.currency,
      pricingModel: "volume",
      tierBreakdown: [
        {
          tierIndex: config.tiers.indexOf(applicableTier),
          from: 0,
          to: applicableTier.upTo,
          quantity,
          unitPrice: applicableTier.unitAmount,
          tierTotal: totalPrice,
        },
      ],
    };
  }

  /**
   * Calculate usage-based pricing for a subscription's current billing period.
   */
  async calculateSubscriptionUsage(
    workspaceId: string,
    subscriptionId: string,
  ): Promise<SubscriptionUsagePricing | null> {
    // Get subscription with offer configuration
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        offerVersion: true,
        offer: true,
        customer: true,
      },
    });

    if (!subscription || subscription.workspaceId !== workspaceId) {
      return null;
    }

    const usageCharges: UsagePriceCalculation[] = [];
    let basePrice = 0;

    const offerVersion = subscription.offerVersion;
    if (!offerVersion) {
      return null;
    }

    const config = offerVersion.config as {
      pricing?: UsagePricingConfig & { usageType?: "licensed" | "metered" };
    };

    if (!config.pricing) {
      return null;
    }

    const pricing = config.pricing;

    // Determine currency from pricing config
    const currency = pricing.currency || "usd";

    // Add base price for flat/licensed pricing
    if (pricing.model === "flat" || pricing.usageType !== "metered") {
      basePrice = pricing.amount;
    }

    // For metered pricing, calculate from usage
    if (pricing.usageType === "metered") {
      // Look for metrics associated with this offer's entitlements
      const entitlementConfigs =
        (
          offerVersion.config as {
            entitlements?: Array<{ featureKey: string }>;
          }
        ).entitlements || [];

      for (const entitlement of entitlementConfigs) {
        const usageSummary = await this.usageService.getUsageSummary(
          workspaceId,
          subscription.customerId,
          entitlement.featureKey,
          subscription.currentPeriodStart,
          subscription.currentPeriodEnd,
        );

        if (usageSummary.totalQuantity > 0) {
          const calculation = this.calculatePrice(
            usageSummary.totalQuantity,
            pricing,
            entitlement.featureKey,
          );

          usageCharges.push(calculation);
        }
      }
    }

    const totalUsagePrice = usageCharges.reduce(
      (sum, charge) => sum + charge.totalPrice,
      0,
    );

    return {
      subscriptionId,
      customerId: subscription.customerId,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      basePrice,
      usageCharges,
      totalUsagePrice,
      totalPrice: basePrice + totalUsagePrice,
      currency,
    };
  }

  /**
   * Calculate usage pricing for a specific metric and customer.
   */
  async calculateCustomerMetricUsage(
    workspaceId: string,
    customerId: string,
    metricKey: string,
    periodStart: Date,
    periodEnd: Date,
    pricingConfig: UsagePricingConfig,
  ): Promise<UsagePriceCalculation> {
    const usageSummary = await this.usageService.getUsageSummary(
      workspaceId,
      customerId,
      metricKey,
      periodStart,
      periodEnd,
    );

    return this.calculatePrice(
      usageSummary.totalQuantity,
      pricingConfig,
      metricKey,
    );
  }

  /**
   * Get usage-based invoicing preview for end of billing period.
   */
  async getInvoicePreview(
    workspaceId: string,
    subscriptionId: string,
  ): Promise<{
    subscription: SubscriptionUsagePricing;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitAmount: number;
      amount: number;
      type: "base" | "usage";
    }>;
  } | null> {
    const pricing = await this.calculateSubscriptionUsage(
      workspaceId,
      subscriptionId,
    );

    if (!pricing) return null;

    const lineItems: Array<{
      description: string;
      quantity: number;
      unitAmount: number;
      amount: number;
      type: "base" | "usage";
    }> = [];

    // Add base subscription charge
    if (pricing.basePrice > 0) {
      lineItems.push({
        description: "Base subscription",
        quantity: 1,
        unitAmount: pricing.basePrice,
        amount: pricing.basePrice,
        type: "base",
      });
    }

    // Add usage charges
    for (const charge of pricing.usageCharges) {
      lineItems.push({
        description: `${charge.metricKey} usage`,
        quantity: charge.quantity,
        unitAmount: charge.unitPrice,
        amount: charge.totalPrice,
        type: "usage",
      });
    }

    return { subscription: pricing, lineItems };
  }

  /**
   * Get usage report data for provider sync.
   * Returns usage data that can be reported to billing providers.
   */
  async getUsageReportData(
    workspaceId: string,
    subscriptionId: string,
    metricKey: string,
  ): Promise<{
    quantity: number;
    periodStart: Date;
    periodEnd: Date;
  } | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || subscription.workspaceId !== workspaceId) {
      return null;
    }

    const usageSummary = await this.usageService.getUsageSummary(
      workspaceId,
      subscription.customerId,
      metricKey,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
    );

    return {
      quantity: usageSummary.totalQuantity,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
    };
  }
}
