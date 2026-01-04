import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { PromotionsService } from "./promotions.service";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";
import { ProviderRefService } from "../billing/provider-ref.service";

describe("PromotionsService", () => {
  let service: PromotionsService;
  let prisma: {
    promotion: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    promotionVersion: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    appliedPromotion: {
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
    };
    workspace: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    executeInTransaction: ReturnType<typeof vi.fn>;
  };
  let billingService: {
    isConfigured: ReturnType<typeof vi.fn>;
    isConfiguredForWorkspace: ReturnType<typeof vi.fn>;
    getProvider: ReturnType<typeof vi.fn>;
    getProviderForWorkspace: ReturnType<typeof vi.fn>;
  };
  let providerRefService: {
    findByEntity: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };

  const mockPromotion = {
    id: "promo_123",
    workspaceId: "ws_123",
    code: "SAVE20",
    name: "Save 20%",
    description: "Get 20% off your first order",
    status: "active" as const,
    currentVersionId: "ver_123",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVersion = {
    id: "ver_123",
    promotionId: "promo_123",
    version: 1,
    status: "published" as const,
    config: {
      discountType: "percent",
      discountValue: 20,
      currency: "USD",
    },
    publishedAt: new Date(),
    createdAt: new Date(),
  };

  const mockPromotionWithVersions = {
    ...mockPromotion,
    versions: [mockVersion],
    currentVersion: mockVersion,
  };

  beforeEach(async () => {
    prisma = {
      promotion: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      promotionVersion: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      appliedPromotion: {
        count: vi.fn(),
        create: vi.fn(),
        aggregate: vi.fn(),
      },
      workspace: {
        findUnique: vi.fn().mockResolvedValue({
          settings: {
            stripeSecretKey: "sk_test_123",
            stripeWebhookSecret: "whsec_123",
          },
        }),
      },
      executeInTransaction: vi.fn((fn) => fn(prisma)),
    };

    billingService = {
      isConfigured: vi.fn().mockReturnValue(true),
      isConfiguredForWorkspace: vi.fn().mockReturnValue(true),
      getProvider: vi.fn().mockReturnValue({
        syncPromotion: vi.fn().mockResolvedValue({
          couponRef: { externalId: "stripe_coupon_123" },
          promotionCodeRef: { externalId: "stripe_promo_123" },
        }),
      }),
      getProviderForWorkspace: vi.fn().mockReturnValue({
        syncPromotion: vi.fn().mockResolvedValue({
          couponRef: { externalId: "stripe_coupon_123" },
          promotionCodeRef: { externalId: "stripe_promo_123" },
        }),
      }),
    };

    providerRefService = {
      findByEntity: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingService, useValue: billingService },
        { provide: ProviderRefService, useValue: providerRefService },
      ],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
  });

  describe("findById", () => {
    it("should return promotion with versions when found", async () => {
      prisma.promotion.findFirst.mockResolvedValue(mockPromotionWithVersions);

      const result = await service.findById("ws_123", "promo_123");

      expect(result).toEqual(mockPromotionWithVersions);
      expect(prisma.promotion.findFirst).toHaveBeenCalledWith({
        where: { id: "promo_123", workspaceId: "ws_123" },
        include: {
          versions: { orderBy: { version: "desc" } },
          currentVersion: true,
        },
      });
    });

    it("should return null when not found", async () => {
      prisma.promotion.findFirst.mockResolvedValue(null);

      const result = await service.findById("ws_123", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByCode", () => {
    it("should return promotion when found by code", async () => {
      prisma.promotion.findFirst.mockResolvedValue(mockPromotionWithVersions);

      const result = await service.findByCode("ws_123", "SAVE20");

      expect(result).toEqual(mockPromotionWithVersions);
    });

    it("should normalize code to uppercase", async () => {
      prisma.promotion.findFirst.mockResolvedValue(mockPromotionWithVersions);

      await service.findByCode("ws_123", "save20");

      expect(prisma.promotion.findFirst).toHaveBeenCalledWith({
        where: { code: "SAVE20", workspaceId: "ws_123" },
        include: expect.any(Object),
      });
    });
  });

  describe("findMany", () => {
    it("should return paginated promotions", async () => {
      const promotions = [mockPromotion, { ...mockPromotion, id: "promo_456" }];
      prisma.promotion.findMany.mockResolvedValue(promotions);

      const result = await service.findMany("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("should indicate hasMore when more results exist", async () => {
      const promotions = Array(11)
        .fill(null)
        .map((_, i) => ({ ...mockPromotion, id: `promo_${i}` }));
      prisma.promotion.findMany.mockResolvedValue(promotions);

      const result = await service.findMany("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("promo_9");
    });

    it("should filter by status", async () => {
      prisma.promotion.findMany.mockResolvedValue([]);

      await service.findMany("ws_123", { limit: 10, status: "active" });

      expect(prisma.promotion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "active" }),
        }),
      );
    });

    it("should filter by search term", async () => {
      prisma.promotion.findMany.mockResolvedValue([]);

      await service.findMany("ws_123", { limit: 10, search: "save" });

      expect(prisma.promotion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { code: { contains: "save", mode: "insensitive" } },
              { name: { contains: "save", mode: "insensitive" } },
              { description: { contains: "save", mode: "insensitive" } },
            ],
          }),
        }),
      );
    });
  });

  describe("create", () => {
    it("should throw BadRequestException if code already exists", async () => {
      prisma.promotion.findFirst.mockResolvedValue(mockPromotion);

      await expect(
        service.create("ws_123", {
          code: "SAVE20",
          name: "New Promo",
          config: { discountType: "percent", discountValue: 10 },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should create promotion with initial draft version", async () => {
      prisma.promotion.findFirst.mockResolvedValue(null);
      prisma.promotion.create.mockResolvedValue({
        ...mockPromotion,
        status: "draft",
        currentVersionId: null,
      });
      prisma.promotionVersion.create.mockResolvedValue({
        ...mockVersion,
        status: "draft",
        publishedAt: null,
      });

      const result = await service.create("ws_123", {
        code: "save20",
        name: "Save 20%",
        config: { discountType: "percent", discountValue: 20 },
      });

      expect(result).toBeDefined();
      expect(prisma.executeInTransaction).toHaveBeenCalled();
    });

    it("should normalize code to uppercase", async () => {
      prisma.promotion.findFirst.mockResolvedValue(null);
      prisma.promotion.create.mockResolvedValue({
        ...mockPromotion,
        status: "draft",
      });
      prisma.promotionVersion.create.mockResolvedValue(mockVersion);

      await service.create("ws_123", {
        code: "lowercase",
        name: "Test",
        config: { discountType: "fixed_amount", discountValue: 500 },
      });

      expect(prisma.promotion.findFirst).toHaveBeenCalledWith({
        where: { workspaceId: "ws_123", code: "LOWERCASE" },
      });
    });
  });

  describe("update", () => {
    it("should throw NotFoundException when promotion not found", async () => {
      prisma.promotion.findFirst.mockResolvedValue(null);

      await expect(
        service.update("ws_123", "nonexistent", { name: "New Name" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should update promotion name and description", async () => {
      prisma.promotion.findFirst.mockResolvedValue(mockPromotion);
      prisma.promotion.update.mockResolvedValue({
        ...mockPromotion,
        name: "Updated Name",
      });

      const result = await service.update("ws_123", "promo_123", {
        name: "Updated Name",
      });

      expect(result.name).toBe("Updated Name");
      expect(prisma.promotion.update).toHaveBeenCalledWith({
        where: { id: "promo_123" },
        data: { name: "Updated Name" },
      });
    });
  });

  describe("archive", () => {
    it("should throw NotFoundException when promotion not found", async () => {
      prisma.promotion.findFirst.mockResolvedValue(null);

      await expect(service.archive("ws_123", "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should set promotion status to archived", async () => {
      prisma.promotion.findFirst.mockResolvedValue(mockPromotion);
      prisma.promotion.update.mockResolvedValue({
        ...mockPromotion,
        status: "archived",
      });

      const result = await service.archive("ws_123", "promo_123");

      expect(result.status).toBe("archived");
      expect(prisma.promotion.update).toHaveBeenCalledWith({
        where: { id: "promo_123" },
        data: { status: "archived" },
      });
    });
  });

  describe("createVersion", () => {
    it("should throw NotFoundException when promotion not found", async () => {
      prisma.promotion.findFirst.mockResolvedValue(null);

      await expect(
        service.createVersion("ws_123", "nonexistent", {
          discountType: "percent",
          discountValue: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if draft version already exists", async () => {
      prisma.promotion.findFirst.mockResolvedValue({
        ...mockPromotion,
        versions: [mockVersion],
      });
      prisma.promotionVersion.findFirst.mockResolvedValue({
        ...mockVersion,
        status: "draft",
      });

      await expect(
        service.createVersion("ws_123", "promo_123", {
          discountType: "percent",
          discountValue: 25,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should create new version with incremented version number", async () => {
      prisma.promotion.findFirst.mockResolvedValue({
        ...mockPromotion,
        versions: [{ ...mockVersion, version: 2 }],
      });
      prisma.promotionVersion.findFirst.mockResolvedValue(null);
      prisma.promotionVersion.create.mockResolvedValue({
        ...mockVersion,
        version: 3,
        status: "draft",
      });

      const result = await service.createVersion("ws_123", "promo_123", {
        discountType: "percent",
        discountValue: 30,
      });

      expect(result.version).toBe(3);
      expect(result.status).toBe("draft");
    });
  });

  describe("publishVersion", () => {
    it("should throw NotFoundException when promotion not found", async () => {
      prisma.promotion.findFirst.mockResolvedValue(null);

      await expect(
        service.publishVersion("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when no draft version found", async () => {
      prisma.promotion.findFirst.mockResolvedValue(mockPromotion);
      prisma.promotionVersion.findFirst.mockResolvedValue(null);

      await expect(
        service.publishVersion("ws_123", "promo_123"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when version is not draft", async () => {
      prisma.promotion.findFirst.mockResolvedValue(mockPromotion);
      prisma.promotionVersion.findFirst.mockResolvedValue({
        ...mockVersion,
        status: "published",
      });

      await expect(
        service.publishVersion("ws_123", "promo_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when config is missing discount type", async () => {
      prisma.promotion.findFirst.mockResolvedValue(mockPromotion);
      prisma.promotionVersion.findFirst.mockResolvedValue({
        ...mockVersion,
        status: "draft",
        config: {},
      });

      await expect(
        service.publishVersion("ws_123", "promo_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when provider not configured", async () => {
      prisma.promotion.findFirst.mockResolvedValue(mockPromotion);
      prisma.promotionVersion.findFirst.mockResolvedValue({
        ...mockVersion,
        status: "draft",
      });
      billingService.isConfiguredForWorkspace.mockReturnValue(false);

      await expect(
        service.publishVersion("ws_123", "promo_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should publish version and sync to provider", async () => {
      prisma.promotion.findFirst.mockResolvedValue({
        ...mockPromotion,
        currentVersionId: null,
        status: "draft",
      });
      prisma.promotionVersion.findFirst.mockResolvedValue({
        ...mockVersion,
        status: "draft",
      });
      prisma.promotionVersion.update.mockResolvedValue({
        ...mockVersion,
        status: "published",
        publishedAt: new Date(),
      });
      prisma.promotion.update.mockResolvedValue(mockPromotion);

      const result = await service.publishVersion("ws_123", "promo_123");

      expect(result.status).toBe("published");
      expect(providerRefService.create).toHaveBeenCalled();
    });
  });

  describe("getVersions", () => {
    it("should throw NotFoundException when promotion not found", async () => {
      prisma.promotion.findFirst.mockResolvedValue(null);

      await expect(
        service.getVersions("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return all versions for promotion", async () => {
      prisma.promotion.findFirst.mockResolvedValue(mockPromotion);
      prisma.promotionVersion.findMany.mockResolvedValue([
        mockVersion,
        { ...mockVersion, id: "ver_456", version: 2 },
      ]);

      const result = await service.getVersions("ws_123", "promo_123");

      expect(result).toHaveLength(2);
      expect(prisma.promotionVersion.findMany).toHaveBeenCalledWith({
        where: { promotionId: "promo_123" },
        orderBy: { version: "desc" },
      });
    });
  });

  describe("validate", () => {
    it("should return invalid when promotion not found", async () => {
      prisma.promotion.findFirst.mockResolvedValue(null);

      const result = await service.validate("ws_123", "INVALID", "offer_123");

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe("not_found");
    });

    it("should return invalid when promotion is archived", async () => {
      prisma.promotion.findFirst.mockResolvedValue({
        ...mockPromotionWithVersions,
        status: "archived",
      });

      const result = await service.validate("ws_123", "SAVE20", "offer_123");

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe("not_found");
    });

    it("should return invalid when promotion is draft", async () => {
      prisma.promotion.findFirst.mockResolvedValue({
        ...mockPromotionWithVersions,
        status: "draft",
      });

      const result = await service.validate("ws_123", "SAVE20", "offer_123");

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe("not_published");
    });

    it("should return invalid when no current version", async () => {
      prisma.promotion.findFirst.mockResolvedValue({
        ...mockPromotionWithVersions,
        currentVersion: null,
      });

      const result = await service.validate("ws_123", "SAVE20", "offer_123");

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe("not_published");
    });

    it("should return invalid when promotion not yet valid", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      prisma.promotion.findFirst.mockResolvedValue({
        ...mockPromotionWithVersions,
        currentVersion: {
          ...mockVersion,
          config: {
            ...mockVersion.config,
            validFrom: futureDate.toISOString(),
          },
        },
      });

      const result = await service.validate("ws_123", "SAVE20", "offer_123");

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe("not_yet_valid");
    });

    it("should return invalid when promotion expired", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      prisma.promotion.findFirst.mockResolvedValue({
        ...mockPromotionWithVersions,
        currentVersion: {
          ...mockVersion,
          config: { ...mockVersion.config, validUntil: pastDate.toISOString() },
        },
      });

      const result = await service.validate("ws_123", "SAVE20", "offer_123");

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe("expired");
    });

    it("should return invalid when offer not applicable", async () => {
      prisma.promotion.findFirst.mockResolvedValue({
        ...mockPromotionWithVersions,
        currentVersion: {
          ...mockVersion,
          config: {
            ...mockVersion.config,
            applicableOfferIds: ["offer_other"],
          },
        },
      });

      const result = await service.validate("ws_123", "SAVE20", "offer_123");

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe("offer_not_applicable");
    });

    it("should return invalid when minimum amount not met", async () => {
      prisma.promotion.findFirst.mockResolvedValue({
        ...mockPromotionWithVersions,
        currentVersion: {
          ...mockVersion,
          config: { ...mockVersion.config, minimumAmount: 10000 },
        },
      });

      const result = await service.validate(
        "ws_123",
        "SAVE20",
        "offer_123",
        undefined,
        5000,
      );

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe("minimum_not_met");
    });

    it("should return invalid when max redemptions reached", async () => {
      prisma.promotion.findFirst.mockResolvedValue({
        ...mockPromotionWithVersions,
        currentVersion: {
          ...mockVersion,
          config: { ...mockVersion.config, maxRedemptions: 100 },
        },
      });
      prisma.appliedPromotion.count.mockResolvedValue(100);

      const result = await service.validate("ws_123", "SAVE20", "offer_123");

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe("max_redemptions_reached");
    });

    it("should return invalid when customer limit reached", async () => {
      prisma.promotion.findFirst.mockResolvedValue({
        ...mockPromotionWithVersions,
        currentVersion: {
          ...mockVersion,
          config: { ...mockVersion.config, maxRedemptionsPerCustomer: 1 },
        },
      });
      prisma.appliedPromotion.count.mockResolvedValue(1);

      const result = await service.validate(
        "ws_123",
        "SAVE20",
        "offer_123",
        "cust_123",
      );

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe("customer_limit_reached");
    });

    it("should return valid when all checks pass", async () => {
      prisma.promotion.findFirst.mockResolvedValue(mockPromotionWithVersions);

      const result = await service.validate("ws_123", "SAVE20", "offer_123");

      expect(result.isValid).toBe(true);
      expect(result.promotion).toBeDefined();
      expect(result.promotionVersion).toBeDefined();
    });
  });

  describe("recordAppliedPromotion", () => {
    it("should create applied promotion record", async () => {
      prisma.appliedPromotion.create.mockResolvedValue({});

      await service.recordAppliedPromotion({
        workspaceId: "ws_123",
        promotionId: "promo_123",
        promotionVersionId: "ver_123",
        customerId: "cust_123",
        discountAmount: 2000,
        subscriptionId: "sub_123",
      });

      expect(prisma.appliedPromotion.create).toHaveBeenCalledWith({
        data: {
          workspaceId: "ws_123",
          promotionId: "promo_123",
          promotionVersionId: "ver_123",
          customerId: "cust_123",
          discountAmount: 2000,
          checkoutId: undefined,
          subscriptionId: "sub_123",
        },
      });
    });
  });

  describe("getAppliedPromotions", () => {
    it("should return count and total discount", async () => {
      prisma.appliedPromotion.count.mockResolvedValue(5);
      prisma.appliedPromotion.aggregate.mockResolvedValue({
        _sum: { discountAmount: 10000 },
      });

      const result = await service.getAppliedPromotions("ws_123", "promo_123");

      expect(result.count).toBe(5);
      expect(result.totalDiscount).toBe(10000);
    });

    it("should return 0 for total discount when no redemptions", async () => {
      prisma.appliedPromotion.count.mockResolvedValue(0);
      prisma.appliedPromotion.aggregate.mockResolvedValue({
        _sum: { discountAmount: null },
      });

      const result = await service.getAppliedPromotions("ws_123", "promo_123");

      expect(result.count).toBe(0);
      expect(result.totalDiscount).toBe(0);
    });
  });
});
