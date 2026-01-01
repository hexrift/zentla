import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";

describe("OffersController", () => {
  let controller: OffersController;
  let offersService: {
    findMany: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    syncOfferToProvider: ReturnType<typeof vi.fn>;
    archive: ReturnType<typeof vi.fn>;
    getVersions: ReturnType<typeof vi.fn>;
    createVersion: ReturnType<typeof vi.fn>;
    createOrUpdateDraftVersion: ReturnType<typeof vi.fn>;
    publishVersion: ReturnType<typeof vi.fn>;
    getScheduledVersions: ReturnType<typeof vi.fn>;
    rollbackToVersion: ReturnType<typeof vi.fn>;
  };

  const mockOffer = {
    id: "offer_123",
    workspaceId: "ws_123",
    name: "Pro Plan",
    description: "Professional tier",
    status: "active" as const,
    publishedVersionId: "ver_123",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVersion = {
    id: "ver_123",
    offerId: "offer_123",
    version: 1,
    status: "published" as const,
    config: {
      pricingModel: "flat",
      price: 9900,
      currency: "usd",
      interval: "month",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    offersService = {
      findMany: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      syncOfferToProvider: vi.fn(),
      archive: vi.fn(),
      getVersions: vi.fn(),
      createVersion: vi.fn(),
      createOrUpdateDraftVersion: vi.fn(),
      publishVersion: vi.fn(),
      getScheduledVersions: vi.fn(),
      rollbackToVersion: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OffersController],
      providers: [{ provide: OffersService, useValue: offersService }],
    }).compile();

    controller = module.get<OffersController>(OffersController);
  });

  describe("findAll", () => {
    it("should return paginated offers", async () => {
      offersService.findMany.mockResolvedValue({
        data: [mockOffer],
        hasMore: false,
        nextCursor: null,
      });

      const result = await controller.findAll("ws_123", {} as any);

      expect(result.data).toHaveLength(1);
      expect(offersService.findMany).toHaveBeenCalledWith("ws_123", {
        limit: 20,
        cursor: undefined,
        status: undefined,
        search: undefined,
      });
    });

    it("should pass filters to service", async () => {
      offersService.findMany.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: null,
      });

      await controller.findAll("ws_123", {
        limit: 50,
        cursor: "cursor123",
        status: "active",
        search: "pro",
      } as any);

      expect(offersService.findMany).toHaveBeenCalledWith("ws_123", {
        limit: 50,
        cursor: "cursor123",
        status: "active",
        search: "pro",
      });
    });
  });

  describe("findOne", () => {
    it("should return offer when found", async () => {
      offersService.findById.mockResolvedValue(mockOffer);

      const result = await controller.findOne("ws_123", "offer_123");

      expect(result).toEqual(mockOffer);
    });

    it("should throw NotFoundException when not found", async () => {
      offersService.findById.mockResolvedValue(null);

      await expect(controller.findOne("ws_123", "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("create", () => {
    it("should create offer", async () => {
      offersService.create.mockResolvedValue(mockOffer);

      const result = await controller.create("ws_123", {
        name: "Pro Plan",
        description: "Professional tier",
        config: {
          pricingModel: "flat",
          price: 9900,
          currency: "usd",
          interval: "month",
        },
      } as any);

      expect(result).toEqual(mockOffer);
    });
  });

  describe("update", () => {
    it("should update offer metadata", async () => {
      offersService.update.mockResolvedValue({
        ...mockOffer,
        name: "Updated Pro Plan",
      });

      const result = await controller.update("ws_123", "offer_123", {
        name: "Updated Pro Plan",
      } as any);

      expect(result.name).toBe("Updated Pro Plan");
    });
  });

  describe("syncToProvider", () => {
    it("should sync offer to provider", async () => {
      offersService.syncOfferToProvider.mockResolvedValue({ synced: true });

      const result = await controller.syncToProvider("ws_123", "offer_123");

      expect(result).toEqual({ synced: true });
      expect(offersService.syncOfferToProvider).toHaveBeenCalledWith(
        "ws_123",
        "offer_123",
      );
    });
  });

  describe("archive", () => {
    it("should archive offer", async () => {
      offersService.archive.mockResolvedValue({
        ...mockOffer,
        status: "archived",
      });

      const result = await controller.archive("ws_123", "offer_123");

      expect(result.status).toBe("archived");
    });
  });

  describe("getVersions", () => {
    it("should return versions", async () => {
      offersService.getVersions.mockResolvedValue([mockVersion]);

      const result = await controller.getVersions("ws_123", "offer_123");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockVersion);
    });
  });

  describe("createVersion", () => {
    it("should create draft version", async () => {
      const draftVersion = { ...mockVersion, status: "draft", version: 2 };
      offersService.createVersion.mockResolvedValue(draftVersion);

      const result = await controller.createVersion("ws_123", "offer_123", {
        config: {
          pricingModel: "flat",
          price: 19900,
          currency: "usd",
          interval: "month",
        },
      } as any);

      expect(result.status).toBe("draft");
      expect(result.version).toBe(2);
    });
  });

  describe("updateDraftVersion", () => {
    it("should update or create draft version", async () => {
      const draftVersion = { ...mockVersion, status: "draft" };
      offersService.createOrUpdateDraftVersion.mockResolvedValue(draftVersion);

      const result = await controller.updateDraftVersion(
        "ws_123",
        "offer_123",
        {
          config: {
            pricingModel: "flat",
            price: 29900,
            currency: "usd",
            interval: "month",
          },
        } as any,
      );

      expect(result.status).toBe("draft");
    });
  });

  describe("publish", () => {
    it("should publish version", async () => {
      const publishedVersion = { ...mockVersion, status: "published" };
      offersService.publishVersion.mockResolvedValue(publishedVersion);

      const result = await controller.publish("ws_123", "offer_123", {
        versionId: "ver_123",
      });

      expect(result.status).toBe("published");
      expect(offersService.publishVersion).toHaveBeenCalledWith(
        "ws_123",
        "offer_123",
        "ver_123",
        undefined,
      );
    });

    it("should handle scheduled publish", async () => {
      offersService.publishVersion.mockResolvedValue(mockVersion);

      await controller.publish("ws_123", "offer_123", {
        versionId: "ver_456",
        effectiveFrom: "2025-02-01T00:00:00Z",
      });

      expect(offersService.publishVersion).toHaveBeenCalledWith(
        "ws_123",
        "offer_123",
        "ver_456",
        expect.any(Date),
      );
    });
  });

  describe("getScheduledVersions", () => {
    it("should return scheduled versions", async () => {
      const scheduledVersion = {
        ...mockVersion,
        effectiveFrom: new Date("2025-02-01"),
      };
      offersService.getScheduledVersions.mockResolvedValue([scheduledVersion]);

      const result = await controller.getScheduledVersions(
        "ws_123",
        "offer_123",
      );

      expect(result).toHaveLength(1);
      expect(result[0].effectiveFrom).toEqual(new Date("2025-02-01"));
    });
  });

  describe("rollback", () => {
    it("should rollback to previous version", async () => {
      const draftVersion = { ...mockVersion, status: "draft", version: 3 };
      offersService.rollbackToVersion.mockResolvedValue(draftVersion);

      const result = await controller.rollback("ws_123", "offer_123", {
        targetVersionId: "ver_123",
      });

      expect(result.status).toBe("draft");
      expect(offersService.rollbackToVersion).toHaveBeenCalledWith(
        "ws_123",
        "offer_123",
        "ver_123",
      );
    });
  });
});
