import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import {
  UsagePricingService,
  UsagePriceCalculation,
} from "./usage-pricing.service";
import { UsageService } from "../usage/usage.service";
import type { PricingModel, PricingTier, BillingInterval } from "@zentla/core";

/**
 * Configuration for a usage-based pricing component.
 */
export interface UsageComponent {
  metricKey: string;
  displayName: string;
  model: PricingModel;
  amount: number;
  tiers?: PricingTier[];
  includedQuantity?: number;
  currency: string;
}

/**
 * Configuration for hybrid pricing (base + usage).
 */
export interface HybridPricingConfig {
  basePrice: number;
  currency: string;
  interval: BillingInterval;
  intervalCount: number;
  usageComponents: UsageComponent[];
}

/**
 * Calculated usage for a single component.
 */
export interface UsageComponentCalculation {
  metricKey: string;
  displayName: string;
  quantity: number;
  includedQuantity: number;
  billableQuantity: number;
  unitPrice: number;
  totalPrice: number;
  tierBreakdown?: Array<{
    tierIndex: number;
    from: number;
    to: number | null;
    quantity: number;
    unitPrice: number;
    tierTotal: number;
  }>;
}

/**
 * Full hybrid pricing calculation result.
 */
export interface HybridPricingResult {
  subscriptionId: string;
  customerId: string;
  periodStart: Date;
  periodEnd: Date;
  basePrice: number;
  usageComponents: UsageComponentCalculation[];
  totalUsagePrice: number;
  totalPrice: number;
  currency: string;
  interval: BillingInterval;
  intervalCount: number;
}

/**
 * Line item for invoice generation.
 */
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  type: "base" | "usage" | "included" | "overage";
  metricKey?: string;
}

@Injectable()
export class HybridPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usagePricingService: UsagePricingService,
    private readonly usageService: UsageService,
  ) {}

  /**
   * Calculate hybrid pricing for a subscription.
   * Combines base subscription price with usage-based charges.
   */
  async calculateHybridPricing(
    workspaceId: string,
    subscriptionId: string,
  ): Promise<HybridPricingResult | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        offerVersion: true,
        offer: true,
      },
    });

    if (!subscription || subscription.workspaceId !== workspaceId) {
      return null;
    }

    const offerVersion = subscription.offerVersion;
    if (!offerVersion) {
      return null;
    }

    const config = offerVersion.config as {
      pricing?: {
        model: PricingModel;
        amount: number;
        currency: string;
        interval?: BillingInterval;
        intervalCount?: number;
        usageType?: "licensed" | "metered";
        tiers?: PricingTier[];
      };
      usageComponents?: UsageComponent[];
      entitlements?: Array<{
        featureKey: string;
        value: unknown;
        valueType: string;
      }>;
    };

    if (!config.pricing) {
      return null;
    }

    const pricing = config.pricing;
    const usageComponents = config.usageComponents || [];
    const currency = pricing.currency || "usd";
    const interval = pricing.interval || "month";
    const intervalCount = pricing.intervalCount || 1;

    // Base price (for licensed/flat pricing)
    let basePrice = 0;
    if (pricing.usageType !== "metered") {
      basePrice = pricing.amount;
    }

    // Calculate usage for each component
    const usageCalculations: UsageComponentCalculation[] = [];

    for (const component of usageComponents) {
      const usageSummary = await this.usageService.getUsageSummary(
        workspaceId,
        subscription.customerId,
        component.metricKey,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
      );

      const rawQuantity = usageSummary.totalQuantity;
      const includedQuantity = component.includedQuantity || 0;
      const billableQuantity = Math.max(0, rawQuantity - includedQuantity);

      // Calculate price for billable quantity
      let calculation: UsagePriceCalculation;
      if (billableQuantity > 0) {
        calculation = this.usagePricingService.calculatePrice(
          billableQuantity,
          {
            model: component.model,
            currency: component.currency,
            amount: component.amount,
            tiers: component.tiers,
          },
          component.metricKey,
        );
      } else {
        calculation = {
          metricKey: component.metricKey,
          quantity: 0,
          unitPrice: component.amount,
          totalPrice: 0,
          currency: component.currency,
          pricingModel: component.model,
        };
      }

      usageCalculations.push({
        metricKey: component.metricKey,
        displayName: component.displayName,
        quantity: rawQuantity,
        includedQuantity,
        billableQuantity,
        unitPrice: calculation.unitPrice,
        totalPrice: calculation.totalPrice,
        tierBreakdown: calculation.tierBreakdown,
      });
    }

    // If the main pricing is metered, also calculate that
    if (pricing.usageType === "metered") {
      const entitlements = config.entitlements || [];
      for (const entitlement of entitlements) {
        // Skip if already covered by usageComponents
        if (
          usageComponents.some((c) => c.metricKey === entitlement.featureKey)
        ) {
          continue;
        }

        const usageSummary = await this.usageService.getUsageSummary(
          workspaceId,
          subscription.customerId,
          entitlement.featureKey,
          subscription.currentPeriodStart,
          subscription.currentPeriodEnd,
        );

        if (usageSummary.totalQuantity > 0) {
          const calculation = this.usagePricingService.calculatePrice(
            usageSummary.totalQuantity,
            {
              model: pricing.model,
              currency: pricing.currency,
              amount: pricing.amount,
              tiers: pricing.tiers,
            },
            entitlement.featureKey,
          );

          usageCalculations.push({
            metricKey: entitlement.featureKey,
            displayName: entitlement.featureKey,
            quantity: usageSummary.totalQuantity,
            includedQuantity: 0,
            billableQuantity: usageSummary.totalQuantity,
            unitPrice: calculation.unitPrice,
            totalPrice: calculation.totalPrice,
            tierBreakdown: calculation.tierBreakdown,
          });
        }
      }
    }

    const totalUsagePrice = usageCalculations.reduce(
      (sum, calc) => sum + calc.totalPrice,
      0,
    );

    return {
      subscriptionId,
      customerId: subscription.customerId,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      basePrice,
      usageComponents: usageCalculations,
      totalUsagePrice,
      totalPrice: basePrice + totalUsagePrice,
      currency,
      interval,
      intervalCount,
    };
  }

  /**
   * Generate invoice line items from hybrid pricing.
   */
  generateInvoiceLineItems(pricing: HybridPricingResult): InvoiceLineItem[] {
    const lineItems: InvoiceLineItem[] = [];

    // Base subscription charge
    if (pricing.basePrice > 0) {
      lineItems.push({
        description: `Base subscription (${pricing.interval}ly)`,
        quantity: 1,
        unitAmount: pricing.basePrice,
        amount: pricing.basePrice,
        type: "base",
      });
    }

    // Usage charges
    for (const component of pricing.usageComponents) {
      // Show included quantity (at $0)
      if (component.includedQuantity > 0 && component.quantity > 0) {
        const includedUsed = Math.min(
          component.quantity,
          component.includedQuantity,
        );
        lineItems.push({
          description: `${component.displayName} - included`,
          quantity: includedUsed,
          unitAmount: 0,
          amount: 0,
          type: "included",
          metricKey: component.metricKey,
        });
      }

      // Show overage charges
      if (component.billableQuantity > 0) {
        lineItems.push({
          description: `${component.displayName} - overage`,
          quantity: component.billableQuantity,
          unitAmount: component.unitPrice,
          amount: component.totalPrice,
          type: "overage",
          metricKey: component.metricKey,
        });
      } else if (component.quantity > 0 && component.includedQuantity === 0) {
        // Pure usage (no included quantity)
        lineItems.push({
          description: `${component.displayName}`,
          quantity: component.quantity,
          unitAmount: component.unitPrice,
          amount: component.totalPrice,
          type: "usage",
          metricKey: component.metricKey,
        });
      }
    }

    return lineItems;
  }

  /**
   * Get a summary of usage for display (before billing period ends).
   */
  async getUsageSummaryForDisplay(
    workspaceId: string,
    subscriptionId: string,
  ): Promise<{
    periodStart: Date;
    periodEnd: Date;
    daysRemaining: number;
    basePrice: number;
    currentUsage: Array<{
      metricKey: string;
      displayName: string;
      quantity: number;
      includedQuantity: number;
      billableQuantity: number;
      estimatedCharge: number;
    }>;
    estimatedTotal: number;
    currency: string;
  } | null> {
    const pricing = await this.calculateHybridPricing(
      workspaceId,
      subscriptionId,
    );

    if (!pricing) {
      return null;
    }

    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (pricing.periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    return {
      periodStart: pricing.periodStart,
      periodEnd: pricing.periodEnd,
      daysRemaining,
      basePrice: pricing.basePrice,
      currentUsage: pricing.usageComponents.map((c) => ({
        metricKey: c.metricKey,
        displayName: c.displayName,
        quantity: c.quantity,
        includedQuantity: c.includedQuantity,
        billableQuantity: c.billableQuantity,
        estimatedCharge: c.totalPrice,
      })),
      estimatedTotal: pricing.totalPrice,
      currency: pricing.currency,
    };
  }

  /**
   * Estimate usage cost for a given quantity.
   * Useful for showing users what additional usage would cost.
   */
  estimateUsageCost(
    component: UsageComponent,
    currentQuantity: number,
    additionalQuantity: number,
  ): {
    currentCost: number;
    additionalCost: number;
    totalCost: number;
    effectiveUnitPrice: number;
  } {
    const includedQuantity = component.includedQuantity || 0;

    // Current billable quantity
    const currentBillable = Math.max(0, currentQuantity - includedQuantity);

    // New billable quantity after adding more
    const newTotal = currentQuantity + additionalQuantity;
    const newBillable = Math.max(0, newTotal - includedQuantity);

    // Calculate costs
    const currentCalc = this.usagePricingService.calculatePrice(
      currentBillable,
      {
        model: component.model,
        currency: component.currency,
        amount: component.amount,
        tiers: component.tiers,
      },
      component.metricKey,
    );

    const newCalc = this.usagePricingService.calculatePrice(
      newBillable,
      {
        model: component.model,
        currency: component.currency,
        amount: component.amount,
        tiers: component.tiers,
      },
      component.metricKey,
    );

    const additionalCost = newCalc.totalPrice - currentCalc.totalPrice;
    const effectiveUnitPrice =
      additionalQuantity > 0 ? additionalCost / additionalQuantity : 0;

    return {
      currentCost: currentCalc.totalPrice,
      additionalCost,
      totalCost: newCalc.totalPrice,
      effectiveUnitPrice,
    };
  }
}
