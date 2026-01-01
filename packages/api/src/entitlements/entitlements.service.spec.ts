import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { EntitlementsService } from "./entitlements.service";
import { PrismaService } from "../database/prisma.service";

describe("EntitlementsService", () => {
  let service: EntitlementsService;
  let prisma: {
    entitlement: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    customer: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    subscription: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const mockEntitlement = {
    id: "ent_123",
    workspaceId: "ws_123",
    customerId: "cust_123",
    subscriptionId: "sub_123",
    featureKey: "api_access",
    value: "true",
    valueType: "boolean" as const,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      entitlement: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
      customer: {
        findFirst: vi.fn(),
      },
      subscription: {
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EntitlementsService>(EntitlementsService);
  });

  describe("checkEntitlement", () => {
    it("should return hasAccess true when entitlement exists", async () => {
      prisma.entitlement.findFirst.mockResolvedValue(mockEntitlement);

      const result = await service.checkEntitlement(
        "ws_123",
        "cust_123",
        "api_access",
      );

      expect(result.hasAccess).toBe(true);
      expect(result.featureKey).toBe("api_access");
      expect(result.value).toBe(true);
    });

    it("should return hasAccess false when no entitlement", async () => {
      prisma.entitlement.findFirst.mockResolvedValue(null);

      const result = await service.checkEntitlement(
        "ws_123",
        "cust_123",
        "api_access",
      );

      expect(result.hasAccess).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it("should parse number values correctly", async () => {
      prisma.entitlement.findFirst.mockResolvedValue({
        ...mockEntitlement,
        value: "100",
        valueType: "number",
      });

      const result = await service.checkEntitlement(
        "ws_123",
        "cust_123",
        "seats",
      );

      expect(result.value).toBe(100);
    });

    it("should parse unlimited values correctly", async () => {
      prisma.entitlement.findFirst.mockResolvedValue({
        ...mockEntitlement,
        value: "unlimited",
        valueType: "unlimited",
      });

      const result = await service.checkEntitlement(
        "ws_123",
        "cust_123",
        "storage",
      );

      expect(result.value).toBe(Infinity);
    });
  });

  describe("checkMultipleEntitlements", () => {
    it("should check multiple feature keys", async () => {
      prisma.entitlement.findMany.mockResolvedValue([
        mockEntitlement,
        {
          ...mockEntitlement,
          featureKey: "seats",
          value: "10",
          valueType: "number",
        },
      ]);

      const result = await service.checkMultipleEntitlements(
        "ws_123",
        "cust_123",
        ["api_access", "seats", "missing"],
      );

      expect(result).toHaveLength(3);
      expect(result[0].hasAccess).toBe(true);
      expect(result[1].hasAccess).toBe(true);
      expect(result[2].hasAccess).toBe(false);
    });
  });

  describe("getCustomerEntitlements", () => {
    it("should throw NotFoundException when customer not found", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.getCustomerEntitlements("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return all entitlements for customer", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "cust_123" });
      prisma.subscription.findMany.mockResolvedValue([{ id: "sub_123" }]);
      prisma.entitlement.findMany.mockResolvedValue([mockEntitlement]);

      const result = await service.getCustomerEntitlements(
        "ws_123",
        "cust_123",
      );

      expect(result.customerId).toBe("cust_123");
      expect(result.entitlements).toHaveLength(1);
      expect(result.activeSubscriptionIds).toContain("sub_123");
    });
  });

  describe("grantEntitlement", () => {
    it("should upsert entitlement", async () => {
      prisma.entitlement.upsert.mockResolvedValue(mockEntitlement);

      const result = await service.grantEntitlement(
        "ws_123",
        "cust_123",
        "sub_123",
        "api_access",
        "true",
        "boolean",
      );

      expect(result).toEqual(mockEntitlement);
      expect(prisma.entitlement.upsert).toHaveBeenCalledWith({
        where: {
          subscriptionId_featureKey: {
            subscriptionId: "sub_123",
            featureKey: "api_access",
          },
        },
        create: expect.objectContaining({
          featureKey: "api_access",
          value: "true",
        }),
        update: expect.objectContaining({
          value: "true",
        }),
      });
    });
  });

  describe("revokeEntitlement", () => {
    it("should delete entitlement", async () => {
      prisma.entitlement.deleteMany.mockResolvedValue({ count: 1 });

      await service.revokeEntitlement("ws_123", "sub_123", "api_access");

      expect(prisma.entitlement.deleteMany).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          subscriptionId: "sub_123",
          featureKey: "api_access",
        },
      });
    });
  });

  describe("revokeAllForSubscription", () => {
    it("should delete all entitlements for subscription", async () => {
      prisma.entitlement.deleteMany.mockResolvedValue({ count: 5 });

      await service.revokeAllForSubscription("ws_123", "sub_123");

      expect(prisma.entitlement.deleteMany).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          subscriptionId: "sub_123",
        },
      });
    });
  });

  describe("refreshExpirationForSubscription", () => {
    it("should update expiration for all entitlements", async () => {
      const newExpiry = new Date();
      prisma.entitlement.updateMany.mockResolvedValue({ count: 3 });

      await service.refreshExpirationForSubscription(
        "ws_123",
        "sub_123",
        newExpiry,
      );

      expect(prisma.entitlement.updateMany).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          subscriptionId: "sub_123",
        },
        data: {
          expiresAt: newExpiry,
        },
      });
    });
  });

  describe("checkEntitlement with expired entitlement", () => {
    it("should return hasAccess false for expired entitlement", async () => {
      // Query filters out expired entitlements, so findFirst returns null
      prisma.entitlement.findFirst.mockResolvedValue(null);

      const result = await service.checkEntitlement(
        "ws_123",
        "cust_123",
        "api_access",
      );

      expect(result.hasAccess).toBe(false);
    });
  });

  describe("grantEntitlement with expiration", () => {
    it("should grant entitlement with expiration date", async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      prisma.entitlement.upsert.mockResolvedValue({
        ...mockEntitlement,
        expiresAt,
      });

      await service.grantEntitlement(
        "ws_123",
        "cust_123",
        "sub_123",
        "trial_feature",
        "true",
        "boolean",
        expiresAt,
      );

      expect(prisma.entitlement.upsert).toHaveBeenCalledWith({
        where: {
          subscriptionId_featureKey: {
            subscriptionId: "sub_123",
            featureKey: "trial_feature",
          },
        },
        create: expect.objectContaining({
          expiresAt,
        }),
        update: expect.objectContaining({
          expiresAt,
        }),
      });
    });
  });

  describe("checkEntitlement with string value type", () => {
    it("should return string value as-is", async () => {
      prisma.entitlement.findFirst.mockResolvedValue({
        ...mockEntitlement,
        value: "premium",
        valueType: "string",
      });

      const result = await service.checkEntitlement(
        "ws_123",
        "cust_123",
        "tier",
      );

      expect(result.value).toBe("premium");
    });
  });

  describe("getCustomerEntitlements with no subscriptions", () => {
    it("should return empty entitlements when no active subscriptions", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "cust_123" });
      prisma.subscription.findMany.mockResolvedValue([]);
      prisma.entitlement.findMany.mockResolvedValue([]);

      const result = await service.getCustomerEntitlements(
        "ws_123",
        "cust_123",
      );

      expect(result.entitlements).toHaveLength(0);
      expect(result.activeSubscriptionIds).toHaveLength(0);
    });
  });
});
