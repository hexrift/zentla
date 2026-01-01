import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { EntitlementsController } from "./entitlements.controller";
import { EntitlementsService } from "./entitlements.service";

describe("EntitlementsController", () => {
  let controller: EntitlementsController;
  let entitlementsService: {
    getCustomerEntitlements: ReturnType<typeof vi.fn>;
    checkEntitlement: ReturnType<typeof vi.fn>;
    checkMultipleEntitlements: ReturnType<typeof vi.fn>;
  };

  const mockEntitlement = {
    featureKey: "api_access",
    hasAccess: true,
    value: true,
    valueType: "boolean" as const,
  };

  beforeEach(async () => {
    entitlementsService = {
      getCustomerEntitlements: vi.fn(),
      checkEntitlement: vi.fn(),
      checkMultipleEntitlements: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EntitlementsController],
      providers: [
        { provide: EntitlementsService, useValue: entitlementsService },
      ],
    }).compile();

    controller = module.get<EntitlementsController>(EntitlementsController);
  });

  describe("getCustomerEntitlements", () => {
    it("should return all entitlements for customer", async () => {
      entitlementsService.getCustomerEntitlements.mockResolvedValue({
        customerId: "cust_123",
        entitlements: [mockEntitlement],
        activeSubscriptionIds: ["sub_123"],
      });

      const result = await controller.getCustomerEntitlements(
        "ws_123",
        "cust_123",
      );

      expect(result.customerId).toBe("cust_123");
      expect(result.entitlements).toHaveLength(1);
      expect(entitlementsService.getCustomerEntitlements).toHaveBeenCalledWith(
        "ws_123",
        "cust_123",
      );
    });
  });

  describe("checkSingleEntitlement", () => {
    it("should check single entitlement", async () => {
      entitlementsService.checkEntitlement.mockResolvedValue(mockEntitlement);

      const result = await controller.checkSingleEntitlement(
        "ws_123",
        "cust_123",
        "api_access",
      );

      expect(result).toEqual(mockEntitlement);
      expect(entitlementsService.checkEntitlement).toHaveBeenCalledWith(
        "ws_123",
        "cust_123",
        "api_access",
      );
    });

    it("should return hasAccess false when no entitlement", async () => {
      entitlementsService.checkEntitlement.mockResolvedValue({
        featureKey: "premium_features",
        hasAccess: false,
        value: undefined,
      });

      const result = await controller.checkSingleEntitlement(
        "ws_123",
        "cust_123",
        "premium_features",
      );

      expect(result.hasAccess).toBe(false);
    });
  });

  describe("checkMultipleEntitlements", () => {
    it("should check multiple entitlements", async () => {
      entitlementsService.checkMultipleEntitlements.mockResolvedValue([
        { featureKey: "api_access", hasAccess: true, value: true },
        { featureKey: "seats", hasAccess: true, value: 10 },
        { featureKey: "premium", hasAccess: false },
      ]);

      const result = await controller.checkMultipleEntitlements(
        "ws_123",
        "cust_123",
        { featureKeys: ["api_access", "seats", "premium"] },
      );

      expect(result).toHaveLength(3);
      expect(entitlementsService.checkMultipleEntitlements).toHaveBeenCalledWith(
        "ws_123",
        "cust_123",
        ["api_access", "seats", "premium"],
      );
    });
  });
});
