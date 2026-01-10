import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { UsagePricingService } from "./usage-pricing.service";
import { PrismaService } from "../database/prisma.service";
import { UsageService } from "../usage/usage.service";

describe("UsagePricingService", () => {
  let service: UsagePricingService;
  let prisma: {
    subscription: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    workspace: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let usageService: {
    getUsageSummary: ReturnType<typeof vi.fn>;
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

    usageService = {
      getUsageSummary: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsagePricingService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsageService, useValue: usageService },
      ],
    }).compile();

    service = module.get<UsagePricingService>(UsagePricingService);
  });

  describe("calculatePrice", () => {
    describe("flat pricing", () => {
      it("should return fixed price regardless of quantity", () => {
        const result = service.calculatePrice(
          100,
          { model: "flat", currency: "usd", amount: 9900 },
          "api_calls",
        );

        expect(result.totalPrice).toBe(9900);
        expect(result.pricingModel).toBe("flat");
        expect(result.quantity).toBe(100);
      });
    });

    describe("per_unit pricing", () => {
      it("should calculate price per unit", () => {
        const result = service.calculatePrice(
          100,
          { model: "per_unit", currency: "usd", amount: 10 },
          "api_calls",
        );

        expect(result.totalPrice).toBe(1000); // 100 * 10
        expect(result.unitPrice).toBe(10);
        expect(result.pricingModel).toBe("per_unit");
      });

      it("should handle zero quantity", () => {
        const result = service.calculatePrice(
          0,
          { model: "per_unit", currency: "usd", amount: 10 },
          "api_calls",
        );

        expect(result.totalPrice).toBe(0);
      });
    });

    describe("tiered pricing", () => {
      const tieredConfig = {
        model: "tiered" as const,
        currency: "usd",
        amount: 0,
        tiers: [
          { upTo: 100, unitAmount: 10, flatAmount: 0 },
          { upTo: 500, unitAmount: 8, flatAmount: 0 },
          { upTo: null, unitAmount: 5, flatAmount: 0 },
        ],
      };

      it("should calculate price for first tier only", () => {
        const result = service.calculatePrice(50, tieredConfig, "api_calls");

        expect(result.totalPrice).toBe(500); // 50 * 10
        expect(result.tierBreakdown).toHaveLength(1);
        expect(result.tierBreakdown![0].quantity).toBe(50);
        expect(result.tierBreakdown![0].unitPrice).toBe(10);
      });

      it("should calculate price spanning two tiers", () => {
        const result = service.calculatePrice(150, tieredConfig, "api_calls");

        // First 100 at $0.10 = $10.00 (1000 cents)
        // Next 50 at $0.08 = $4.00 (400 cents)
        expect(result.totalPrice).toBe(1400);
        expect(result.tierBreakdown).toHaveLength(2);
        expect(result.tierBreakdown![0].quantity).toBe(100);
        expect(result.tierBreakdown![1].quantity).toBe(50);
      });

      it("should calculate price spanning all tiers", () => {
        const result = service.calculatePrice(600, tieredConfig, "api_calls");

        // First 100 at $0.10 = $10.00 (1000 cents)
        // Next 400 at $0.08 = $32.00 (3200 cents)
        // Next 100 at $0.05 = $5.00 (500 cents)
        expect(result.totalPrice).toBe(4700);
        expect(result.tierBreakdown).toHaveLength(3);
      });

      it("should handle flat amounts in tiers", () => {
        const configWithFlat = {
          ...tieredConfig,
          tiers: [
            { upTo: 100, unitAmount: 10, flatAmount: 500 },
            { upTo: null, unitAmount: 5, flatAmount: 0 },
          ],
        };

        const result = service.calculatePrice(150, configWithFlat, "api_calls");

        // First tier: 500 flat + 100*10 = 1500
        // Second tier: 0 flat + 50*5 = 250
        expect(result.totalPrice).toBe(1750);
      });

      it("should fall back to per_unit when no tiers defined", () => {
        const result = service.calculatePrice(
          100,
          { model: "tiered", currency: "usd", amount: 10, tiers: [] },
          "api_calls",
        );

        expect(result.totalPrice).toBe(1000);
        // Falls back to per_unit pricing model when no tiers
        expect(result.pricingModel).toBe("per_unit");
      });
    });

    describe("volume pricing", () => {
      const volumeConfig = {
        model: "volume" as const,
        currency: "usd",
        amount: 0,
        tiers: [
          { upTo: 100, unitAmount: 10, flatAmount: 0 },
          { upTo: 500, unitAmount: 8, flatAmount: 0 },
          { upTo: null, unitAmount: 5, flatAmount: 0 },
        ],
      };

      it("should price all units at first tier rate", () => {
        const result = service.calculatePrice(50, volumeConfig, "api_calls");

        expect(result.totalPrice).toBe(500); // 50 * 10
        expect(result.unitPrice).toBe(10);
      });

      it("should price all units at second tier rate", () => {
        const result = service.calculatePrice(150, volumeConfig, "api_calls");

        expect(result.totalPrice).toBe(1200); // 150 * 8
        expect(result.unitPrice).toBe(8);
      });

      it("should price all units at last tier rate", () => {
        const result = service.calculatePrice(600, volumeConfig, "api_calls");

        expect(result.totalPrice).toBe(3000); // 600 * 5
        expect(result.unitPrice).toBe(5);
      });

      it("should include flat amount in volume tier", () => {
        const configWithFlat = {
          ...volumeConfig,
          tiers: [
            { upTo: 100, unitAmount: 10, flatAmount: 500 },
            { upTo: null, unitAmount: 5, flatAmount: 1000 },
          ],
        };

        const result = service.calculatePrice(150, configWithFlat, "api_calls");

        // Falls into second tier: 1000 flat + 150*5 = 1750
        expect(result.totalPrice).toBe(1750);
      });
    });
  });

  describe("calculateSubscriptionUsage", () => {
    const mockSubscription = {
      id: "sub_123",
      workspaceId: "ws_123",
      customerId: "cust_123",
      currentPeriodStart: new Date("2024-01-01"),
      currentPeriodEnd: new Date("2024-02-01"),
      offerVersion: {
        config: {
          pricing: {
            model: "per_unit",
            currency: "usd",
            amount: 10,
            usageType: "metered",
          },
          entitlements: [
            { featureKey: "api_calls", value: 1000, valueType: "number" },
          ],
        },
      },
      offer: { id: "offer_123", name: "API Plan" },
      customer: { id: "cust_123" },
    };

    it("should calculate metered usage pricing", async () => {
      prisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      usageService.getUsageSummary.mockResolvedValue({
        totalQuantity: 500,
        eventCount: 50,
      });

      const result = await service.calculateSubscriptionUsage(
        "ws_123",
        "sub_123",
      );

      expect(result).not.toBeNull();
      expect(result!.usageCharges).toHaveLength(1);
      expect(result!.usageCharges[0].totalPrice).toBe(5000); // 500 * 10
      expect(result!.totalUsagePrice).toBe(5000);
      expect(result!.basePrice).toBe(0);
    });

    it("should calculate flat pricing with no usage charges", async () => {
      const flatSubscription = {
        ...mockSubscription,
        offerVersion: {
          config: {
            pricing: {
              model: "flat",
              currency: "usd",
              amount: 9900,
              usageType: "licensed",
            },
            entitlements: [],
          },
        },
      };

      prisma.subscription.findUnique.mockResolvedValue(flatSubscription);

      const result = await service.calculateSubscriptionUsage(
        "ws_123",
        "sub_123",
      );

      expect(result).not.toBeNull();
      expect(result!.basePrice).toBe(9900);
      expect(result!.usageCharges).toHaveLength(0);
      expect(result!.totalPrice).toBe(9900);
    });

    it("should return null for non-existent subscription", async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.calculateSubscriptionUsage(
        "ws_123",
        "sub_999",
      );

      expect(result).toBeNull();
    });

    it("should return null for wrong workspace", async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        workspaceId: "ws_other",
      });

      const result = await service.calculateSubscriptionUsage(
        "ws_123",
        "sub_123",
      );

      expect(result).toBeNull();
    });

    it("should use workspace default currency when pricing currency is missing", async () => {
      const subscriptionWithoutCurrency = {
        ...mockSubscription,
        offerVersion: {
          config: {
            pricing: {
              model: "flat",
              amount: 4900,
              usageType: "licensed",
              // currency is intentionally missing
            },
            entitlements: [],
          },
        },
      };

      prisma.subscription.findUnique.mockResolvedValue(
        subscriptionWithoutCurrency,
      );
      prisma.workspace.findUnique.mockResolvedValue({
        id: "ws_123",
        settings: { defaultCurrency: "eur" },
      });

      const result = await service.calculateSubscriptionUsage(
        "ws_123",
        "sub_123",
      );

      expect(result).not.toBeNull();
      expect(result!.currency).toBe("eur");
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
              usageType: "licensed",
              // currency is intentionally missing
            },
            entitlements: [],
          },
        },
      };

      prisma.subscription.findUnique.mockResolvedValue(
        subscriptionWithoutCurrency,
      );
      prisma.workspace.findUnique.mockResolvedValue({
        id: "ws_123",
        settings: {},
      });

      const result = await service.calculateSubscriptionUsage(
        "ws_123",
        "sub_123",
      );

      expect(result).not.toBeNull();
      expect(result!.currency).toBe("usd");
    });

    it("should return null when offerVersion is missing", async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        offerVersion: null,
      });

      const result = await service.calculateSubscriptionUsage(
        "ws_123",
        "sub_123",
      );

      expect(result).toBeNull();
    });

    it("should return null when pricing config is missing", async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        offerVersion: {
          config: {},
        },
      });

      const result = await service.calculateSubscriptionUsage(
        "ws_123",
        "sub_123",
      );

      expect(result).toBeNull();
    });
  });

  describe("calculateCustomerMetricUsage", () => {
    it("should calculate usage for specific metric and period", async () => {
      usageService.getUsageSummary.mockResolvedValue({
        totalQuantity: 250,
        eventCount: 25,
      });

      const result = await service.calculateCustomerMetricUsage(
        "ws_123",
        "cust_123",
        "api_calls",
        new Date("2024-01-01"),
        new Date("2024-02-01"),
        { model: "per_unit", currency: "usd", amount: 5 },
      );

      expect(result.quantity).toBe(250);
      expect(result.totalPrice).toBe(1250); // 250 * 5
      expect(result.metricKey).toBe("api_calls");
    });
  });

  describe("getInvoicePreview", () => {
    it("should generate invoice line items", async () => {
      const mockSubscription = {
        id: "sub_123",
        workspaceId: "ws_123",
        customerId: "cust_123",
        currentPeriodStart: new Date("2024-01-01"),
        currentPeriodEnd: new Date("2024-02-01"),
        offerVersion: {
          config: {
            pricing: {
              model: "per_unit",
              currency: "usd",
              amount: 10,
              usageType: "metered",
            },
            entitlements: [
              { featureKey: "api_calls", value: 1000, valueType: "number" },
            ],
          },
        },
        offer: { id: "offer_123", name: "API Plan" },
        customer: { id: "cust_123" },
      };

      prisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      usageService.getUsageSummary.mockResolvedValue({
        totalQuantity: 100,
        eventCount: 10,
      });

      const result = await service.getInvoicePreview("ws_123", "sub_123");

      expect(result).not.toBeNull();
      expect(result!.lineItems).toHaveLength(1);
      expect(result!.lineItems[0].type).toBe("usage");
      expect(result!.lineItems[0].amount).toBe(1000);
    });

    it("should include base charge in line items", async () => {
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
              currency: "usd",
              amount: 4900,
              usageType: "licensed",
            },
            entitlements: [],
          },
        },
        offer: { id: "offer_123", name: "Pro Plan" },
        customer: { id: "cust_123" },
      };

      prisma.subscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await service.getInvoicePreview("ws_123", "sub_123");

      expect(result).not.toBeNull();
      expect(result!.lineItems).toHaveLength(1);
      expect(result!.lineItems[0].type).toBe("base");
      expect(result!.lineItems[0].amount).toBe(4900);
    });
  });

  describe("getUsageReportData", () => {
    it("should return usage data for provider sync", async () => {
      const mockSubscription = {
        id: "sub_123",
        workspaceId: "ws_123",
        customerId: "cust_123",
        currentPeriodStart: new Date("2024-01-01"),
        currentPeriodEnd: new Date("2024-02-01"),
      };

      prisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      usageService.getUsageSummary.mockResolvedValue({
        totalQuantity: 500,
        eventCount: 50,
      });

      const result = await service.getUsageReportData(
        "ws_123",
        "sub_123",
        "api_calls",
      );

      expect(result).not.toBeNull();
      expect(result!.quantity).toBe(500);
      expect(result!.periodStart).toEqual(mockSubscription.currentPeriodStart);
      expect(result!.periodEnd).toEqual(mockSubscription.currentPeriodEnd);
    });

    it("should return null for non-existent subscription", async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.getUsageReportData(
        "ws_123",
        "sub_999",
        "api_calls",
      );

      expect(result).toBeNull();
    });
  });
});
