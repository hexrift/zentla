import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ProviderRefService } from "./provider-ref.service";
import { PrismaService } from "../database/prisma.service";

describe("ProviderRefService", () => {
  let service: ProviderRefService;
  let prisma: {
    providerRef: {
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };

  const mockProviderRef = {
    id: "ref_123",
    workspaceId: "ws_123",
    entityType: "customer" as const,
    entityId: "cust_123",
    provider: "stripe" as const,
    externalId: "cus_stripe123",
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      providerRef: {
        findFirst: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderRefService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProviderRefService>(ProviderRefService);
  });

  describe("findByEntity", () => {
    it("should return provider ref when found", async () => {
      prisma.providerRef.findFirst.mockResolvedValue(mockProviderRef);

      const result = await service.findByEntity(
        "ws_123",
        "customer",
        "cust_123",
        "stripe",
      );

      expect(result).toEqual(mockProviderRef);
      expect(prisma.providerRef.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          entityType: "customer",
          entityId: "cust_123",
          provider: "stripe",
        },
      });
    });

    it("should return null when not found", async () => {
      prisma.providerRef.findFirst.mockResolvedValue(null);

      const result = await service.findByEntity(
        "ws_123",
        "customer",
        "nonexistent",
        "stripe",
      );

      expect(result).toBeNull();
    });
  });

  describe("findByExternalId", () => {
    it("should return provider ref when found", async () => {
      prisma.providerRef.findFirst.mockResolvedValue(mockProviderRef);

      const result = await service.findByExternalId(
        "ws_123",
        "stripe",
        "customer",
        "cus_stripe123",
      );

      expect(result).toEqual(mockProviderRef);
      expect(prisma.providerRef.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          provider: "stripe",
          entityType: "customer",
          externalId: "cus_stripe123",
        },
      });
    });
  });

  describe("create", () => {
    it("should create provider ref", async () => {
      prisma.providerRef.create.mockResolvedValue(mockProviderRef);

      const result = await service.create({
        workspaceId: "ws_123",
        entityType: "customer",
        entityId: "cust_123",
        provider: "stripe",
        externalId: "cus_stripe123",
      });

      expect(result).toEqual(mockProviderRef);
      expect(prisma.providerRef.create).toHaveBeenCalledWith({
        data: {
          workspaceId: "ws_123",
          entityType: "customer",
          entityId: "cust_123",
          provider: "stripe",
          externalId: "cus_stripe123",
          metadata: undefined,
        },
      });
    });

    it("should create provider ref with metadata", async () => {
      const refWithMetadata = {
        ...mockProviderRef,
        metadata: { source: "migration" },
      };
      prisma.providerRef.create.mockResolvedValue(refWithMetadata);

      const result = await service.create({
        workspaceId: "ws_123",
        entityType: "customer",
        entityId: "cust_123",
        provider: "stripe",
        externalId: "cus_stripe123",
        metadata: { source: "migration" },
      });

      expect(result.metadata).toEqual({ source: "migration" });
    });
  });

  describe("upsert", () => {
    it("should upsert provider ref", async () => {
      prisma.providerRef.upsert.mockResolvedValue(mockProviderRef);

      const result = await service.upsert({
        workspaceId: "ws_123",
        entityType: "customer",
        entityId: "cust_123",
        provider: "stripe",
        externalId: "cus_stripe123",
      });

      expect(result).toEqual(mockProviderRef);
      expect(prisma.providerRef.upsert).toHaveBeenCalledWith({
        where: {
          workspaceId_entityType_entityId_provider: {
            workspaceId: "ws_123",
            entityType: "customer",
            entityId: "cust_123",
            provider: "stripe",
          },
        },
        update: {
          externalId: "cus_stripe123",
          metadata: undefined,
        },
        create: {
          workspaceId: "ws_123",
          entityType: "customer",
          entityId: "cust_123",
          provider: "stripe",
          externalId: "cus_stripe123",
          metadata: undefined,
        },
      });
    });
  });

  describe("delete", () => {
    it("should delete provider ref", async () => {
      prisma.providerRef.deleteMany.mockResolvedValue({ count: 1 });

      await service.delete("ws_123", "customer", "cust_123", "stripe");

      expect(prisma.providerRef.deleteMany).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          entityType: "customer",
          entityId: "cust_123",
          provider: "stripe",
        },
      });
    });
  });

  describe("getProviderCustomerId", () => {
    it("should return external customer id", async () => {
      prisma.providerRef.findFirst.mockResolvedValue(mockProviderRef);

      const result = await service.getProviderCustomerId("ws_123", "cust_123");

      expect(result).toBe("cus_stripe123");
    });

    it("should return null when not found", async () => {
      prisma.providerRef.findFirst.mockResolvedValue(null);

      const result = await service.getProviderCustomerId("ws_123", "cust_123");

      expect(result).toBeNull();
    });

    it("should use specified provider", async () => {
      prisma.providerRef.findFirst.mockResolvedValue({
        ...mockProviderRef,
        provider: "zuora",
        externalId: "zuora_cust_123",
      });

      const result = await service.getProviderCustomerId(
        "ws_123",
        "cust_123",
        "zuora",
      );

      expect(result).toBe("zuora_cust_123");
      expect(prisma.providerRef.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          entityType: "customer",
          entityId: "cust_123",
          provider: "zuora",
        },
      });
    });
  });

  describe("getProviderPriceId", () => {
    it("should return external price id", async () => {
      prisma.providerRef.findFirst.mockResolvedValue({
        ...mockProviderRef,
        entityType: "price",
        entityId: "ver_123",
        externalId: "price_stripe123",
      });

      const result = await service.getProviderPriceId("ws_123", "ver_123");

      expect(result).toBe("price_stripe123");
      expect(prisma.providerRef.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          entityType: "price",
          entityId: "ver_123",
          provider: "stripe",
        },
      });
    });
  });

  describe("getProviderProductId", () => {
    it("should return external product id", async () => {
      prisma.providerRef.findFirst.mockResolvedValue({
        ...mockProviderRef,
        entityType: "product",
        entityId: "offer_123",
        externalId: "prod_stripe123",
      });

      const result = await service.getProviderProductId("ws_123", "offer_123");

      expect(result).toBe("prod_stripe123");
      expect(prisma.providerRef.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          entityType: "product",
          entityId: "offer_123",
          provider: "stripe",
        },
      });
    });
  });

  describe("getProviderSubscriptionId", () => {
    it("should return external subscription id", async () => {
      prisma.providerRef.findFirst.mockResolvedValue({
        ...mockProviderRef,
        entityType: "subscription",
        entityId: "sub_123",
        externalId: "sub_stripe123",
      });

      const result = await service.getProviderSubscriptionId("ws_123", "sub_123");

      expect(result).toBe("sub_stripe123");
      expect(prisma.providerRef.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          entityType: "subscription",
          entityId: "sub_123",
          provider: "stripe",
        },
      });
    });
  });

  describe("deprecated methods", () => {
    it("getStripeCustomerId should delegate to getProviderCustomerId", async () => {
      prisma.providerRef.findFirst.mockResolvedValue(mockProviderRef);

      const result = await service.getStripeCustomerId("ws_123", "cust_123");

      expect(result).toBe("cus_stripe123");
    });

    it("getStripePriceId should delegate to getProviderPriceId", async () => {
      prisma.providerRef.findFirst.mockResolvedValue({
        ...mockProviderRef,
        entityType: "price",
        externalId: "price_stripe123",
      });

      const result = await service.getStripePriceId("ws_123", "ver_123");

      expect(result).toBe("price_stripe123");
    });

    it("getStripeProductId should delegate to getProviderProductId", async () => {
      prisma.providerRef.findFirst.mockResolvedValue({
        ...mockProviderRef,
        entityType: "product",
        externalId: "prod_stripe123",
      });

      const result = await service.getStripeProductId("ws_123", "offer_123");

      expect(result).toBe("prod_stripe123");
    });
  });
});
