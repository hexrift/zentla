import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { HybridPricingService, UsageComponent } from "./hybrid-pricing.service";
import { UsagePricingService } from "./usage-pricing.service";
import { UsageService } from "../usage/usage.service";
import { PrismaService } from "../database/prisma.service";

describe("HybridPricingService", () => {
  let service: HybridPricingService;
  let prisma: {
    subscription: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    workspace: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let usagePricingService: {
    calculatePrice: ReturnType<typeof vi.fn>;
  };
  let usageService: {
    getUsageSummary: ReturnType<typeof vi.fn>;
  };

  const mockSubscription = {
    id: "sub_123",
    workspaceId: "ws_123",
    customerId: "cust_123",
    currentPeriodStart: new Date("2024-01-01"),
    currentPeriodEnd: new Date("2024-02-01"),
    offerVersion: {
      config: {
        pricing: {
          model: "flat",
          amount: 4900,
          currency: "usd",
          interval: "month",
          intervalCount: 1,
          usageType: "licensed",
        },
        usageComponents: [
          {
            metricKey: "api_calls",
            displayName: "API Calls",
            model: "tiered",
            amount: 0,
            currency: "usd",
            includedQuantity: 1000,
            tiers: [
              { upTo: 10000, unitAmount: 1, flatAmount: 0 },
              { upTo: null, unitAmount: 0.5, flatAmount: 0 },
            ],
          },
        ],
      },
    },
    offer: { id: "offer_123", name: "Pro Plan" },
  };

  beforeEach(async () => {
    prisma = {
      subscription: {
        findUnique: vi.fn(),
      },
      workspace: {
        findUnique: vi.fn(),
      },
    };

    usagePricingService = {
      calculatePrice: vi.fn(),
    };

    usageService = {
      getUsageSummary: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HybridPricingService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsagePricingService, useValue: usagePricingService },
        { provide: UsageService, useValue: usageService },
      ],
    }).compile();

    service = module.get<HybridPricingService>(HybridPricingService);
  });

  describe("calculateHybridPricing", () => {
    it("should calculate base + usage pricing", async () => {
      prisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      usageService.getUsageSummary.mockResolvedValue({
        totalQuantity: 5000,
        eventCount: 50,
      });
      usagePricingService.calculatePrice.mockReturnValue({
        metricKey: "api_calls",
        quantity: 4000,
        unitPrice: 1,
        totalPrice: 4000,
        currency: "usd",
        pricingModel: "tiered",
      });

      const result = await service.calculateHybridPricing("ws_123", "sub_123");

      expect(result).not.toBeNull();
      expect(result!.basePrice).toBe(4900);
      expect(result!.usageComponents).toHaveLength(1);
      expect(result!.usageComponents[0].quantity).toBe(5000);
      expect(result!.usageComponents[0].includedQuantity).toBe(1000);
      expect(result!.usageComponents[0].billableQuantity).toBe(4000);
      expect(result!.totalPrice).toBe(8900); // 4900 base + 4000 usage
    });

    it("should return null for non-existent subscription", async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.calculateHybridPricing("ws_123", "sub_999");

      expect(result).toBeNull();
    });

    it("should handle pure metered pricing", async () => {
      const meteredSubscription = {
        ...mockSubscription,
        offerVersion: {
          config: {
            pricing: {
              model: "per_unit",
              amount: 10,
              currency: "usd",
              usageType: "metered",
            },
            entitlements: [{ featureKey: "api_calls", value: 1000 }],
          },
        },
      };

      prisma.subscription.findUnique.mockResolvedValue(meteredSubscription);
      usageService.getUsageSummary.mockResolvedValue({
        totalQuantity: 100,
        eventCount: 10,
      });
      usagePricingService.calculatePrice.mockReturnValue({
        metricKey: "api_calls",
        quantity: 100,
        unitPrice: 10,
        totalPrice: 1000,
        currency: "usd",
        pricingModel: "per_unit",
      });

      const result = await service.calculateHybridPricing("ws_123", "sub_123");

      expect(result!.basePrice).toBe(0);
      expect(result!.totalUsagePrice).toBe(1000);
    });

    it("should handle no usage in billing period", async () => {
      prisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      usageService.getUsageSummary.mockResolvedValue({
        totalQuantity: 0,
        eventCount: 0,
      });

      const result = await service.calculateHybridPricing("ws_123", "sub_123");

      expect(result!.basePrice).toBe(4900);
      expect(result!.usageComponents[0].quantity).toBe(0);
      expect(result!.usageComponents[0].billableQuantity).toBe(0);
      expect(result!.totalPrice).toBe(4900);
    });

    it("should handle usage within included quantity", async () => {
      prisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      usageService.getUsageSummary.mockResolvedValue({
        totalQuantity: 500, // Less than 1000 included
        eventCount: 5,
      });

      const result = await service.calculateHybridPricing("ws_123", "sub_123");

      expect(result!.usageComponents[0].quantity).toBe(500);
      expect(result!.usageComponents[0].billableQuantity).toBe(0);
      expect(result!.usageComponents[0].totalPrice).toBe(0);
      expect(result!.totalPrice).toBe(4900);
    });

    it("should use workspace default currency when pricing currency is missing", async () => {
      const subscriptionWithoutCurrency = {
        ...mockSubscription,
        offerVersion: {
          config: {
            pricing: {
              model: "flat",
              amount: 4900,
              interval: "month",
              intervalCount: 1,
              usageType: "licensed",
              // currency is intentionally missing
            },
            usageComponents: [],
          },
        },
      };

      prisma.subscription.findUnique.mockResolvedValue(
        subscriptionWithoutCurrency,
      );
      prisma.workspace.findUnique.mockResolvedValue({
        id: "ws_123",
        settings: { defaultCurrency: "gbp" },
      });

      const result = await service.calculateHybridPricing("ws_123", "sub_123");

      expect(result).not.toBeNull();
      expect(result!.currency).toBe("gbp");
      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: "ws_123" },
        select: { settings: true },
      });
    });

    it("should fall back to usd when workspace has no default currency", async () => {
      const subscriptionWithoutCurrency = {
        ...mockSubscription,
        offerVersion: {
          config: {
            pricing: {
              model: "flat",
              amount: 4900,
              interval: "month",
              intervalCount: 1,
              usageType: "licensed",
              // currency is intentionally missing
            },
            usageComponents: [],
          },
        },
      };

      prisma.subscription.findUnique.mockResolvedValue(
        subscriptionWithoutCurrency,
      );
      prisma.workspace.findUnique.mockResolvedValue({
        id: "ws_123",
        settings: null,
      });

      const result = await service.calculateHybridPricing("ws_123", "sub_123");

      expect(result).not.toBeNull();
      expect(result!.currency).toBe("usd");
    });

    it("should return null when offerVersion is missing", async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        offerVersion: null,
      });

      const result = await service.calculateHybridPricing("ws_123", "sub_123");

      expect(result).toBeNull();
    });

    it("should return null when pricing config is missing", async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        offerVersion: {
          config: {},
        },
      });

      const result = await service.calculateHybridPricing("ws_123", "sub_123");

      expect(result).toBeNull();
    });
  });

  describe("generateInvoiceLineItems", () => {
    it("should generate line items for base + usage", () => {
      const pricing = {
        subscriptionId: "sub_123",
        customerId: "cust_123",
        periodStart: new Date("2024-01-01"),
        periodEnd: new Date("2024-02-01"),
        basePrice: 4900,
        usageComponents: [
          {
            metricKey: "api_calls",
            displayName: "API Calls",
            quantity: 5000,
            includedQuantity: 1000,
            billableQuantity: 4000,
            unitPrice: 1,
            totalPrice: 4000,
          },
        ],
        totalUsagePrice: 4000,
        totalPrice: 8900,
        currency: "usd",
        interval: "month" as const,
        intervalCount: 1,
      };

      const lineItems = service.generateInvoiceLineItems(pricing);

      expect(lineItems).toHaveLength(3);
      expect(lineItems[0].type).toBe("base");
      expect(lineItems[0].amount).toBe(4900);
      expect(lineItems[1].type).toBe("included");
      expect(lineItems[1].quantity).toBe(1000);
      expect(lineItems[1].amount).toBe(0);
      expect(lineItems[2].type).toBe("overage");
      expect(lineItems[2].quantity).toBe(4000);
      expect(lineItems[2].amount).toBe(4000);
    });

    it("should skip included line item when no usage", () => {
      const pricing = {
        subscriptionId: "sub_123",
        customerId: "cust_123",
        periodStart: new Date("2024-01-01"),
        periodEnd: new Date("2024-02-01"),
        basePrice: 4900,
        usageComponents: [
          {
            metricKey: "api_calls",
            displayName: "API Calls",
            quantity: 0,
            includedQuantity: 1000,
            billableQuantity: 0,
            unitPrice: 1,
            totalPrice: 0,
          },
        ],
        totalUsagePrice: 0,
        totalPrice: 4900,
        currency: "usd",
        interval: "month" as const,
        intervalCount: 1,
      };

      const lineItems = service.generateInvoiceLineItems(pricing);

      expect(lineItems).toHaveLength(1);
      expect(lineItems[0].type).toBe("base");
    });

    it("should handle pure usage without included quantity", () => {
      const pricing = {
        subscriptionId: "sub_123",
        customerId: "cust_123",
        periodStart: new Date("2024-01-01"),
        periodEnd: new Date("2024-02-01"),
        basePrice: 0,
        usageComponents: [
          {
            metricKey: "api_calls",
            displayName: "API Calls",
            quantity: 1000,
            includedQuantity: 0,
            billableQuantity: 1000,
            unitPrice: 1,
            totalPrice: 1000,
          },
        ],
        totalUsagePrice: 1000,
        totalPrice: 1000,
        currency: "usd",
        interval: "month" as const,
        intervalCount: 1,
      };

      const lineItems = service.generateInvoiceLineItems(pricing);

      expect(lineItems).toHaveLength(1);
      expect(lineItems[0].type).toBe("overage");
    });
  });

  describe("getUsageSummaryForDisplay", () => {
    it("should return usage summary with days remaining", async () => {
      prisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      usageService.getUsageSummary.mockResolvedValue({
        totalQuantity: 2000,
        eventCount: 20,
      });
      usagePricingService.calculatePrice.mockReturnValue({
        metricKey: "api_calls",
        quantity: 1000,
        unitPrice: 1,
        totalPrice: 1000,
        currency: "usd",
        pricingModel: "tiered",
      });

      const result = await service.getUsageSummaryForDisplay(
        "ws_123",
        "sub_123",
      );

      expect(result).not.toBeNull();
      expect(result!.basePrice).toBe(4900);
      expect(result!.currentUsage).toHaveLength(1);
      expect(result!.currentUsage[0].quantity).toBe(2000);
      expect(result!.currentUsage[0].billableQuantity).toBe(1000);
    });
  });

  describe("estimateUsageCost", () => {
    beforeEach(() => {
      usagePricingService.calculatePrice.mockImplementation(
        (quantity: number) => ({
          metricKey: "api_calls",
          quantity,
          unitPrice: 1,
          totalPrice: quantity * 1,
          currency: "usd",
          pricingModel: "per_unit",
        }),
      );
    });

    it("should estimate additional usage cost", () => {
      const component: UsageComponent = {
        metricKey: "api_calls",
        displayName: "API Calls",
        model: "per_unit",
        amount: 1,
        currency: "usd",
        includedQuantity: 1000,
      };

      const result = service.estimateUsageCost(component, 2000, 500);

      // Current: 2000 total, 1000 billable
      // After: 2500 total, 1500 billable
      // Additional cost: 1500 - 1000 = 500
      expect(result.currentCost).toBe(1000);
      expect(result.additionalCost).toBe(500);
      expect(result.totalCost).toBe(1500);
      expect(result.effectiveUnitPrice).toBe(1);
    });

    it("should handle usage going from included to billable", () => {
      const component: UsageComponent = {
        metricKey: "api_calls",
        displayName: "API Calls",
        model: "per_unit",
        amount: 1,
        currency: "usd",
        includedQuantity: 1000,
      };

      const result = service.estimateUsageCost(component, 800, 400);

      // Current: 800 total, 0 billable (under included)
      // After: 1200 total, 200 billable
      expect(result.currentCost).toBe(0);
      expect(result.additionalCost).toBe(200);
      expect(result.totalCost).toBe(200);
      expect(result.effectiveUnitPrice).toBe(0.5); // 200 / 400
    });

    it("should return zero cost for zero additional quantity", () => {
      const component: UsageComponent = {
        metricKey: "api_calls",
        displayName: "API Calls",
        model: "per_unit",
        amount: 1,
        currency: "usd",
        includedQuantity: 1000,
      };

      const result = service.estimateUsageCost(component, 2000, 0);

      expect(result.additionalCost).toBe(0);
      expect(result.effectiveUnitPrice).toBe(0);
    });
  });
});
