import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { PromotionsController } from "./promotions.controller";
import { PromotionsService } from "./promotions.service";

describe("PromotionsController", () => {
  let controller: PromotionsController;
  let promotionsService: {
    findMany: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    archive: ReturnType<typeof vi.fn>;
    getVersions: ReturnType<typeof vi.fn>;
    createVersion: ReturnType<typeof vi.fn>;
    publishVersion: ReturnType<typeof vi.fn>;
    validate: ReturnType<typeof vi.fn>;
    getAppliedPromotions: ReturnType<typeof vi.fn>;
  };

  const mockPromotion = {
    id: "promo_123",
    workspaceId: "ws_123",
    code: "SUMMER25",
    name: "Summer Sale",
    description: "25% off summer promotion",
    status: "active" as const,
    publishedVersionId: "ver_123",
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
      discountValue: 25,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    promotionsService = {
      findMany: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      getVersions: vi.fn(),
      createVersion: vi.fn(),
      publishVersion: vi.fn(),
      validate: vi.fn(),
      getAppliedPromotions: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromotionsController],
      providers: [{ provide: PromotionsService, useValue: promotionsService }],
    }).compile();

    controller = module.get<PromotionsController>(PromotionsController);
  });

  describe("findAll", () => {
    it("should return paginated promotions", async () => {
      promotionsService.findMany.mockResolvedValue({
        data: [mockPromotion],
        hasMore: false,
        nextCursor: null,
      });

      const result = await controller.findAll("ws_123", {} as any);

      expect(result.data).toHaveLength(1);
      expect(promotionsService.findMany).toHaveBeenCalledWith("ws_123", {
        limit: 20,
        cursor: undefined,
        status: undefined,
        search: undefined,
      });
    });

    it("should pass filters to service", async () => {
      promotionsService.findMany.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: null,
      });

      await controller.findAll("ws_123", {
        limit: 50,
        cursor: "cursor123",
        status: "active",
        search: "summer",
      } as any);

      expect(promotionsService.findMany).toHaveBeenCalledWith("ws_123", {
        limit: 50,
        cursor: "cursor123",
        status: "active",
        search: "summer",
      });
    });
  });

  describe("findOne", () => {
    it("should return promotion when found", async () => {
      promotionsService.findById.mockResolvedValue(mockPromotion);

      const result = await controller.findOne("ws_123", "promo_123");

      expect(result).toEqual(mockPromotion);
    });

    it("should throw NotFoundException when not found", async () => {
      promotionsService.findById.mockResolvedValue(null);

      await expect(controller.findOne("ws_123", "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("create", () => {
    it("should create promotion", async () => {
      promotionsService.create.mockResolvedValue(mockPromotion);

      const result = await controller.create("ws_123", {
        code: "SUMMER25",
        name: "Summer Sale",
        config: {
          discountType: "percent",
          discountValue: 25,
        },
      } as any);

      expect(result).toEqual(mockPromotion);
    });
  });

  describe("update", () => {
    it("should update promotion metadata", async () => {
      promotionsService.update.mockResolvedValue({
        ...mockPromotion,
        name: "Updated Summer Sale",
      });

      const result = await controller.update("ws_123", "promo_123", {
        name: "Updated Summer Sale",
      } as any);

      expect(result.name).toBe("Updated Summer Sale");
    });
  });

  describe("archive", () => {
    it("should archive promotion", async () => {
      promotionsService.archive.mockResolvedValue({
        ...mockPromotion,
        status: "archived",
      });

      const result = await controller.archive("ws_123", "promo_123");

      expect(result.status).toBe("archived");
    });
  });

  describe("getVersions", () => {
    it("should return versions", async () => {
      promotionsService.getVersions.mockResolvedValue([mockVersion]);

      const result = await controller.getVersions("ws_123", "promo_123");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockVersion);
    });
  });

  describe("createVersion", () => {
    it("should create draft version", async () => {
      const draftVersion = { ...mockVersion, status: "draft", version: 2 };
      promotionsService.createVersion.mockResolvedValue(draftVersion);

      const result = await controller.createVersion("ws_123", "promo_123", {
        config: {
          discountType: "percent",
          discountValue: 30,
        },
      } as any);

      expect(result.status).toBe("draft");
      expect(result.version).toBe(2);
    });
  });

  describe("publish", () => {
    it("should publish version", async () => {
      const publishedVersion = { ...mockVersion, status: "published" };
      promotionsService.publishVersion.mockResolvedValue(publishedVersion);

      const result = await controller.publish("ws_123", "promo_123", {
        versionId: "ver_123",
      });

      expect(result.status).toBe("published");
      expect(promotionsService.publishVersion).toHaveBeenCalledWith(
        "ws_123",
        "promo_123",
        "ver_123",
      );
    });
  });

  describe("validate", () => {
    it("should validate valid promotion code", async () => {
      promotionsService.validate.mockResolvedValue({
        isValid: true,
        promotion: mockPromotion,
      });

      const result = await controller.validate("ws_123", {
        code: "SUMMER25",
        offerId: "offer_123",
        orderAmount: 9900,
      });

      expect(result.isValid).toBe(true);
      expect(result.promotion).toEqual(mockPromotion);
    });

    it("should return invalid result", async () => {
      promotionsService.validate.mockResolvedValue({
        isValid: false,
        errorCode: "expired",
        errorMessage: "Promotion has expired",
      });

      const result = await controller.validate("ws_123", {
        code: "EXPIRED",
        offerId: "offer_123",
      });

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe("Promotion has expired");
    });

    it("should pass customer ID for per-customer limits", async () => {
      promotionsService.validate.mockResolvedValue({ isValid: true });

      await controller.validate("ws_123", {
        code: "SUMMER25",
        offerId: "123e4567-e89b-12d3-a456-426614174000",
        customerId: "123e4567-e89b-12d3-a456-426614174001",
        orderAmount: 9900,
      });

      expect(promotionsService.validate).toHaveBeenCalledWith(
        "ws_123",
        "SUMMER25",
        "123e4567-e89b-12d3-a456-426614174000",
        "123e4567-e89b-12d3-a456-426614174001",
        9900,
      );
    });
  });

  describe("getUsage", () => {
    it("should return usage statistics", async () => {
      promotionsService.findById.mockResolvedValue(mockPromotion);
      promotionsService.getAppliedPromotions.mockResolvedValue({
        count: 47,
        totalDiscount: 235000,
      });

      const result = await controller.getUsage("ws_123", "promo_123");

      expect(result).toEqual({
        promotionId: "promo_123",
        redemptionCount: 47,
        totalDiscountAmount: 235000,
      });
    });

    it("should throw NotFoundException when promotion not found", async () => {
      promotionsService.findById.mockResolvedValue(null);

      await expect(
        controller.getUsage("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
