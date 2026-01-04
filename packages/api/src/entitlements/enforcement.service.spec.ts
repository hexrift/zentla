import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { EnforcementService } from "./enforcement.service";
import { EntitlementsService, EntitlementCheck } from "./entitlements.service";
import { UsageService } from "../usage/usage.service";
import { PrismaService } from "../database/prisma.service";

describe("EnforcementService", () => {
  let service: EnforcementService;
  let entitlementsService: {
    checkEntitlement: ReturnType<typeof vi.fn>;
    getCustomerEntitlements: ReturnType<typeof vi.fn>;
  };
  let usageService: {
    ingestEvent: ReturnType<typeof vi.fn>;
    getUsageSummary: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    subscription: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  const mockBooleanEntitlement: EntitlementCheck = {
    hasAccess: true,
    featureKey: "premium_feature",
    value: true,
    valueType: "boolean",
  };

  const mockNumericEntitlement: EntitlementCheck = {
    hasAccess: true,
    featureKey: "api_calls",
    value: 1000,
    valueType: "number",
  };

  const mockUnlimitedEntitlement: EntitlementCheck = {
    hasAccess: true,
    featureKey: "storage",
    value: Infinity,
    valueType: "unlimited",
  };

  const mockNoAccessEntitlement: EntitlementCheck = {
    hasAccess: false,
    featureKey: "enterprise_feature",
    value: undefined,
    valueType: "boolean",
  };

  const mockUsageSummary = {
    totalQuantity: 500,
    eventCount: 50,
    periodStart: new Date(),
    periodEnd: new Date(),
  };

  beforeEach(async () => {
    entitlementsService = {
      checkEntitlement: vi.fn(),
      getCustomerEntitlements: vi.fn(),
    };

    usageService = {
      ingestEvent: vi.fn(),
      getUsageSummary: vi.fn(),
    };

    prisma = {
      subscription: {
        findFirst: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnforcementService,
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: UsageService, useValue: usageService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EnforcementService>(EnforcementService);
  });

  describe("enforce", () => {
    describe("no access entitlements", () => {
      it("should throw ForbiddenException when no entitlement exists", async () => {
        entitlementsService.checkEntitlement.mockResolvedValue(
          mockNoAccessEntitlement,
        );

        await expect(
          service.enforce("ws_123", "cust_123", "enterprise_feature"),
        ).rejects.toThrow(ForbiddenException);
      });

      it("should return allowed false when throwOnExceeded is false", async () => {
        entitlementsService.checkEntitlement.mockResolvedValue(
          mockNoAccessEntitlement,
        );

        const result = await service.enforce(
          "ws_123",
          "cust_123",
          "enterprise_feature",
          { throwOnExceeded: false },
        );

        expect(result.allowed).toBe(false);
        expect(result.message).toContain("no entitlement");
      });

      it("should use custom error message", async () => {
        entitlementsService.checkEntitlement.mockResolvedValue(
          mockNoAccessEntitlement,
        );

        await expect(
          service.enforce("ws_123", "cust_123", "enterprise_feature", {
            errorMessage: "Upgrade to Pro to access this feature",
          }),
        ).rejects.toThrow("Upgrade to Pro to access this feature");
      });
    });

    describe("boolean entitlements", () => {
      it("should allow when boolean entitlement is true", async () => {
        entitlementsService.checkEntitlement.mockResolvedValue(
          mockBooleanEntitlement,
        );

        const result = await service.enforce(
          "ws_123",
          "cust_123",
          "premium_feature",
        );

        expect(result.allowed).toBe(true);
        expect(result.featureKey).toBe("premium_feature");
      });

      it("should deny when boolean entitlement is false", async () => {
        entitlementsService.checkEntitlement.mockResolvedValue({
          ...mockBooleanEntitlement,
          value: false,
        });

        const result = await service.enforce(
          "ws_123",
          "cust_123",
          "premium_feature",
          { throwOnExceeded: false },
        );

        expect(result.allowed).toBe(false);
      });
    });

    describe("unlimited entitlements", () => {
      it("should always allow unlimited entitlements", async () => {
        entitlementsService.checkEntitlement.mockResolvedValue(
          mockUnlimitedEntitlement,
        );

        const result = await service.enforce("ws_123", "cust_123", "storage");

        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(Infinity);
        expect(result.remaining).toBe(Infinity);
      });
    });

    describe("numeric entitlements", () => {
      beforeEach(() => {
        prisma.subscription.findFirst.mockResolvedValue({
          id: "sub_123",
          currentPeriodStart: new Date("2024-01-01"),
          currentPeriodEnd: new Date("2024-02-01"),
        });
      });

      it("should allow when usage is under limit", async () => {
        entitlementsService.checkEntitlement.mockResolvedValue(
          mockNumericEntitlement,
        );
        usageService.getUsageSummary.mockResolvedValue({
          ...mockUsageSummary,
          totalQuantity: 500,
        });

        const result = await service.enforce(
          "ws_123",
          "cust_123",
          "api_calls",
        );

        expect(result.allowed).toBe(true);
        expect(result.currentUsage).toBe(500);
        expect(result.limit).toBe(1000);
        expect(result.remaining).toBe(500);
      });

      it("should deny when usage exceeds limit", async () => {
        entitlementsService.checkEntitlement.mockResolvedValue(
          mockNumericEntitlement,
        );
        usageService.getUsageSummary.mockResolvedValue({
          ...mockUsageSummary,
          totalQuantity: 1000,
        });

        await expect(
          service.enforce("ws_123", "cust_123", "api_calls"),
        ).rejects.toThrow(ForbiddenException);
      });

      it("should consider incrementBy for pre-check", async () => {
        entitlementsService.checkEntitlement.mockResolvedValue(
          mockNumericEntitlement,
        );
        usageService.getUsageSummary.mockResolvedValue({
          ...mockUsageSummary,
          totalQuantity: 995,
        });

        // Default incrementBy=1, so 995+1=996 <= 1000, allowed
        const resultAllowed = await service.enforce(
          "ws_123",
          "cust_123",
          "api_calls",
        );
        expect(resultAllowed.allowed).toBe(true);

        // With incrementBy=10, so 995+10=1005 > 1000, denied
        await expect(
          service.enforce("ws_123", "cust_123", "api_calls", { incrementBy: 10 }),
        ).rejects.toThrow(ForbiddenException);
      });

      it("should return remaining as 0 when at limit", async () => {
        entitlementsService.checkEntitlement.mockResolvedValue(
          mockNumericEntitlement,
        );
        usageService.getUsageSummary.mockResolvedValue({
          ...mockUsageSummary,
          totalQuantity: 1000,
        });

        const result = await service.enforce(
          "ws_123",
          "cust_123",
          "api_calls",
          { throwOnExceeded: false },
        );

        expect(result.remaining).toBe(0);
      });

      it("should use current month when no subscription exists", async () => {
        prisma.subscription.findFirst.mockResolvedValue(null);
        entitlementsService.checkEntitlement.mockResolvedValue(
          mockNumericEntitlement,
        );
        usageService.getUsageSummary.mockResolvedValue({
          ...mockUsageSummary,
          totalQuantity: 100,
        });

        const result = await service.enforce(
          "ws_123",
          "cust_123",
          "api_calls",
        );

        expect(result.allowed).toBe(true);
        expect(usageService.getUsageSummary).toHaveBeenCalled();
      });
    });

    describe("string entitlements", () => {
      it("should allow string entitlements when hasAccess is true", async () => {
        entitlementsService.checkEntitlement.mockResolvedValue({
          hasAccess: true,
          featureKey: "tier",
          value: "premium",
          valueType: "string",
        });

        const result = await service.enforce("ws_123", "cust_123", "tier");

        expect(result.allowed).toBe(true);
      });
    });
  });

  describe("enforceMultiple", () => {
    it("should check multiple features and return all results", async () => {
      entitlementsService.checkEntitlement
        .mockResolvedValueOnce(mockBooleanEntitlement)
        .mockResolvedValueOnce(mockNoAccessEntitlement);

      const results = await service.enforceMultiple(
        "ws_123",
        "cust_123",
        ["premium_feature", "enterprise_feature"],
      );

      expect(results).toHaveLength(2);
      expect(results[0].allowed).toBe(true);
      expect(results[1].allowed).toBe(false);
    });

    it("should not throw even when some features are denied", async () => {
      entitlementsService.checkEntitlement.mockResolvedValue(
        mockNoAccessEntitlement,
      );

      // Should not throw because enforceMultiple sets throwOnExceeded: false
      const results = await service.enforceMultiple(
        "ws_123",
        "cust_123",
        ["feature1", "feature2"],
      );

      expect(results.every((r) => !r.allowed)).toBe(true);
    });
  });

  describe("anyExceeded", () => {
    it("should return true when any result is not allowed", () => {
      const results = [
        { allowed: true, featureKey: "f1", entitlement: mockBooleanEntitlement },
        { allowed: false, featureKey: "f2", entitlement: mockNoAccessEntitlement },
      ];

      expect(service.anyExceeded(results)).toBe(true);
    });

    it("should return false when all results are allowed", () => {
      const results = [
        { allowed: true, featureKey: "f1", entitlement: mockBooleanEntitlement },
        { allowed: true, featureKey: "f2", entitlement: mockBooleanEntitlement },
      ];

      expect(service.anyExceeded(results)).toBe(false);
    });
  });

  describe("getExceeded", () => {
    it("should return only exceeded results", () => {
      const results = [
        { allowed: true, featureKey: "f1", entitlement: mockBooleanEntitlement },
        { allowed: false, featureKey: "f2", entitlement: mockNoAccessEntitlement },
        { allowed: false, featureKey: "f3", entitlement: mockNoAccessEntitlement },
      ];

      const exceeded = service.getExceeded(results);

      expect(exceeded).toHaveLength(2);
      expect(exceeded.map((r) => r.featureKey)).toEqual(["f2", "f3"]);
    });
  });

  describe("recordUsage", () => {
    it("should ingest usage event", async () => {
      usageService.ingestEvent.mockResolvedValue({ id: "evt_123" });

      await service.recordUsage("ws_123", "cust_123", "api_calls", 5);

      expect(usageService.ingestEvent).toHaveBeenCalledWith("ws_123", {
        customerId: "cust_123",
        subscriptionId: undefined,
        metricKey: "api_calls",
        quantity: 5,
        idempotencyKey: expect.any(String),
      });
    });

    it("should include subscriptionId when provided", async () => {
      usageService.ingestEvent.mockResolvedValue({ id: "evt_123" });

      await service.recordUsage("ws_123", "cust_123", "api_calls", 1, "sub_123");

      expect(usageService.ingestEvent).toHaveBeenCalledWith(
        "ws_123",
        expect.objectContaining({ subscriptionId: "sub_123" }),
      );
    });
  });

  describe("enforceAndRecord", () => {
    beforeEach(() => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: "sub_123",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      });
    });

    it("should record usage when enforcement passes", async () => {
      entitlementsService.checkEntitlement.mockResolvedValue(
        mockNumericEntitlement,
      );
      usageService.getUsageSummary.mockResolvedValue({
        ...mockUsageSummary,
        totalQuantity: 100,
      });
      usageService.ingestEvent.mockResolvedValue({ id: "evt_123" });

      const result = await service.enforceAndRecord(
        "ws_123",
        "cust_123",
        "api_calls",
        5,
      );

      expect(result.allowed).toBe(true);
      expect(usageService.ingestEvent).toHaveBeenCalledWith(
        "ws_123",
        expect.objectContaining({ quantity: 5 }),
      );
    });

    it("should not record usage when enforcement fails", async () => {
      entitlementsService.checkEntitlement.mockResolvedValue(
        mockNumericEntitlement,
      );
      usageService.getUsageSummary.mockResolvedValue({
        ...mockUsageSummary,
        totalQuantity: 1000,
      });

      const result = await service.enforceAndRecord(
        "ws_123",
        "cust_123",
        "api_calls",
        5,
        undefined,
        { throwOnExceeded: false },
      );

      expect(result.allowed).toBe(false);
      expect(usageService.ingestEvent).not.toHaveBeenCalled();
    });
  });

  describe("getUsageSummary", () => {
    beforeEach(() => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: "sub_123",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      });
    });

    it("should return usage summary for all numeric entitlements", async () => {
      entitlementsService.getCustomerEntitlements.mockResolvedValue({
        customerId: "cust_123",
        entitlements: [
          { featureKey: "api_calls", valueType: "number", value: 1000 },
          { featureKey: "storage", valueType: "unlimited", value: Infinity },
          { featureKey: "premium", valueType: "boolean", value: true },
        ],
        activeSubscriptionIds: ["sub_123"],
      });
      usageService.getUsageSummary.mockResolvedValue({
        totalQuantity: 500,
        eventCount: 50,
      });

      const summary = await service.getUsageSummary("ws_123", "cust_123");

      // Should only include numeric and unlimited, not boolean
      expect(summary).toHaveLength(2);
      expect(summary[0].featureKey).toBe("api_calls");
      expect(summary[0].currentUsage).toBe(500);
      expect(summary[0].limit).toBe(1000);
      expect(summary[0].remaining).toBe(500);
      expect(summary[0].percentUsed).toBe(50);
    });

    it("should return null for limit/remaining/percent on unlimited", async () => {
      entitlementsService.getCustomerEntitlements.mockResolvedValue({
        customerId: "cust_123",
        entitlements: [
          { featureKey: "storage", valueType: "unlimited", value: Infinity },
        ],
        activeSubscriptionIds: ["sub_123"],
      });
      usageService.getUsageSummary.mockResolvedValue({
        totalQuantity: 1000,
        eventCount: 10,
      });

      const summary = await service.getUsageSummary("ws_123", "cust_123");

      expect(summary[0].limit).toBeNull();
      expect(summary[0].remaining).toBeNull();
      expect(summary[0].percentUsed).toBeNull();
    });
  });
});
