import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { OffersService } from "./offers.service";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";
import { ProviderRefService } from "../billing/provider-ref.service";

describe("OffersService", () => {
  let service: OffersService;
  let prisma: {
    offer: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    offerVersion: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
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
  };
  let providerRefService: {
    findByEntity: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };

  const mockOffer = {
    id: "offer_123",
    workspaceId: "ws_123",
    name: "Pro Offer",
    description: "Professional tier",
    status: "draft",
    currentVersionId: null,
    metadata: {},
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOfferVersion = {
    id: "ver_123",
    offerId: "offer_123",
    version: 1,
    status: "draft",
    config: {
      pricing: {
        model: "flat",
        amount: 2999,
        currency: "usd",
        interval: "month",
      },
      entitlements: [
        { featureKey: "api_access", value: true, valueType: "boolean" },
      ],
    },
    publishedAt: null,
    effectiveFrom: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      offer: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      offerVersion: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
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
        syncOffer: vi.fn().mockResolvedValue({
          productRef: { externalId: "prod_123" },
          priceRef: { externalId: "price_123" },
        }),
        archiveProduct: vi.fn().mockResolvedValue(undefined),
      }),
    };

    providerRefService = {
      findByEntity: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingService, useValue: billingService },
        { provide: ProviderRefService, useValue: providerRefService },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
  });

  describe("findById", () => {
    it("should return offer with versions when found", async () => {
      const offerWithVersions = {
        ...mockOffer,
        versions: [mockOfferVersion],
        currentVersion: null,
      };
      prisma.offer.findFirst.mockResolvedValue(offerWithVersions);

      const result = await service.findById("ws_123", "offer_123");

      expect(result).toEqual(offerWithVersions);
      expect(prisma.offer.findFirst).toHaveBeenCalledWith({
        where: { id: "offer_123", workspaceId: "ws_123" },
        include: {
          versions: { orderBy: { version: "desc" } },
          currentVersion: true,
        },
      });
    });

    it("should return null when offer not found", async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      const result = await service.findById("ws_123", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findMany", () => {
    it("should return paginated offers", async () => {
      const offers = [mockOffer, { ...mockOffer, id: "offer_456" }];
      prisma.offer.findMany.mockResolvedValue(offers);

      const result = await service.findMany("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("should filter by status", async () => {
      prisma.offer.findMany.mockResolvedValue([]);

      await service.findMany("ws_123", { limit: 10, status: "active" });

      expect(prisma.offer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "active" }),
        }),
      );
    });

    it("should filter by search term", async () => {
      prisma.offer.findMany.mockResolvedValue([]);

      await service.findMany("ws_123", { limit: 10, search: "pro" });

      expect(prisma.offer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: "pro", mode: "insensitive" } },
              { description: { contains: "pro", mode: "insensitive" } },
            ],
          }),
        }),
      );
    });

    it("should indicate hasMore when more results exist", async () => {
      const offers = Array(11)
        .fill(null)
        .map((_, i) => ({ ...mockOffer, id: `offer_${i}` }));
      prisma.offer.findMany.mockResolvedValue(offers);

      const result = await service.findMany("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("offer_9");
    });
  });

  describe("create", () => {
    it("should create offer with draft status", async () => {
      prisma.offer.create.mockResolvedValue(mockOffer);

      const result = await service.create("ws_123", {
        name: "Pro Offer",
        description: "Professional tier",
      });

      expect(result.name).toBe("Pro Offer");
      expect(result.status).toBe("draft");
    });

    it("should create initial version if config provided", async () => {
      prisma.offer.create.mockResolvedValue(mockOffer);
      prisma.offerVersion.create.mockResolvedValue(mockOfferVersion);

      const result = await service.create("ws_123", {
        name: "Pro Offer",
        config: {
          pricing: {
            model: "flat",
            amount: 2999,
            currency: "usd",
            interval: "month",
          },
          entitlements: [],
        },
      });

      expect(result.versions).toHaveLength(1);
    });
  });

  describe("update", () => {
    it("should throw NotFoundException when offer not found", async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(
        service.update("ws_123", "nonexistent", { name: "New Name" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should update offer name and description", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offer.update.mockResolvedValue({
        ...mockOffer,
        name: "Updated Name",
      });

      const result = await service.update("ws_123", "offer_123", {
        name: "Updated Name",
      });

      expect(result.name).toBe("Updated Name");
    });

    it("should merge metadata", async () => {
      const offerWithMetadata = {
        ...mockOffer,
        metadata: { existing: "value" },
      };
      prisma.offer.findFirst.mockResolvedValue(offerWithMetadata);
      prisma.offer.update.mockResolvedValue({
        ...offerWithMetadata,
        metadata: { existing: "value", new: "data" },
      });

      await service.update("ws_123", "offer_123", {
        metadata: { new: "data" },
      });

      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: "offer_123" },
        data: expect.objectContaining({
          metadata: { existing: "value", new: "data" },
        }),
      });
    });
  });

  describe("archive", () => {
    it("should throw NotFoundException when offer not found", async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(service.archive("ws_123", "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should archive offer", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offer.update.mockResolvedValue({
        ...mockOffer,
        status: "archived",
      });

      const result = await service.archive("ws_123", "offer_123");

      expect(result.status).toBe("archived");
    });
  });

  describe("createVersion", () => {
    it("should throw NotFoundException when offer not found", async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(
        service.createVersion("ws_123", "nonexistent", {
          pricing: { model: "flat", amount: 100, currency: "usd" },
          entitlements: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if draft already exists", async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        versions: [mockOfferVersion],
      });
      prisma.offerVersion.findFirst.mockResolvedValue(mockOfferVersion);

      await expect(
        service.createVersion("ws_123", "offer_123", {
          pricing: { model: "flat", amount: 100, currency: "usd" },
          entitlements: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should create new version", async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        versions: [{ ...mockOfferVersion, status: "published" }],
      });
      prisma.offerVersion.findFirst.mockResolvedValue(null);
      prisma.offerVersion.create.mockResolvedValue({
        ...mockOfferVersion,
        version: 2,
      });

      const result = await service.createVersion("ws_123", "offer_123", {
        pricing: { model: "flat", amount: 100, currency: "usd" },
        entitlements: [],
      });

      expect(result.version).toBe(2);
    });
  });

  describe("updateDraftVersion", () => {
    it("should throw NotFoundException when offer not found", async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDraftVersion("ws_123", "nonexistent", {
          pricing: { model: "flat", amount: 100, currency: "usd" },
          entitlements: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when no draft exists", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDraftVersion("ws_123", "offer_123", {
          pricing: { model: "flat", amount: 100, currency: "usd" },
          entitlements: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should update draft version", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findFirst.mockResolvedValue(mockOfferVersion);
      prisma.offerVersion.update.mockResolvedValue({
        ...mockOfferVersion,
        config: { pricing: { amount: 5000 } },
      });

      const result = await service.updateDraftVersion("ws_123", "offer_123", {
        pricing: { model: "flat", amount: 5000, currency: "usd" },
        entitlements: [],
      });

      expect(result.config).toEqual({ pricing: { amount: 5000 } });
    });
  });

  describe("createOrUpdateDraftVersion", () => {
    it("should create new draft if none exists", async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        versions: [],
      });
      prisma.offerVersion.findFirst.mockResolvedValue(null);
      prisma.offerVersion.create.mockResolvedValue(mockOfferVersion);

      const result = await service.createOrUpdateDraftVersion(
        "ws_123",
        "offer_123",
        {
          pricing: { model: "flat", amount: 100, currency: "usd" },
          entitlements: [],
        },
      );

      expect(prisma.offerVersion.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should update existing draft if one exists", async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        versions: [mockOfferVersion],
      });
      prisma.offerVersion.findFirst.mockResolvedValue(mockOfferVersion);
      prisma.offerVersion.update.mockResolvedValue(mockOfferVersion);

      await service.createOrUpdateDraftVersion("ws_123", "offer_123", {
        pricing: { model: "flat", amount: 100, currency: "usd" },
        entitlements: [],
      });

      expect(prisma.offerVersion.update).toHaveBeenCalled();
    });
  });

  describe("getVersions", () => {
    it("should throw NotFoundException when offer not found", async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(
        service.getVersions("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return versions ordered by version desc", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findMany.mockResolvedValue([
        { ...mockOfferVersion, version: 2 },
        { ...mockOfferVersion, version: 1 },
      ]);

      const result = await service.getVersions("ws_123", "offer_123");

      expect(result).toHaveLength(2);
      expect(prisma.offerVersion.findMany).toHaveBeenCalledWith({
        where: { offerId: "offer_123" },
        orderBy: { version: "desc" },
      });
    });
  });

  describe("getVersion", () => {
    it("should return version when found", async () => {
      prisma.offerVersion.findFirst.mockResolvedValue(mockOfferVersion);

      const result = await service.getVersion("ws_123", "ver_123");

      expect(result).toEqual(mockOfferVersion);
    });

    it("should return null when not found", async () => {
      prisma.offerVersion.findFirst.mockResolvedValue(null);

      const result = await service.getVersion("ws_123", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getDraftVersion", () => {
    it("should return draft version when found", async () => {
      prisma.offerVersion.findFirst.mockResolvedValue(mockOfferVersion);

      const result = await service.getDraftVersion("ws_123", "offer_123");

      expect(result).toEqual(mockOfferVersion);
      expect(prisma.offerVersion.findFirst).toHaveBeenCalledWith({
        where: {
          offerId: "offer_123",
          status: "draft",
          offer: { workspaceId: "ws_123" },
        },
      });
    });
  });

  describe("getPublishedVersion", () => {
    it("should return current version when offer has one", async () => {
      const publishedVersion = { ...mockOfferVersion, status: "published" };
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        currentVersion: publishedVersion,
      });

      const result = await service.getPublishedVersion("ws_123", "offer_123");

      expect(result).toEqual(publishedVersion);
    });

    it("should return null when offer has no current version", async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        currentVersion: null,
      });

      const result = await service.getPublishedVersion("ws_123", "offer_123");

      expect(result).toBeNull();
    });
  });

  describe("getEffectiveVersion", () => {
    it("should return effective version", async () => {
      const publishedVersion = {
        ...mockOfferVersion,
        status: "published",
        effectiveFrom: null,
      };
      prisma.offerVersion.findMany.mockResolvedValue([publishedVersion]);

      const result = await service.getEffectiveVersion("ws_123", "offer_123");

      expect(result).toEqual(publishedVersion);
    });

    it("should return null when no effective version", async () => {
      prisma.offerVersion.findMany.mockResolvedValue([]);

      const result = await service.getEffectiveVersion("ws_123", "offer_123");

      expect(result).toBeNull();
    });
  });

  describe("getScheduledVersions", () => {
    it("should throw NotFoundException when offer not found", async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(
        service.getScheduledVersions("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return scheduled versions", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      const futureDate = new Date(Date.now() + 86400000);
      prisma.offerVersion.findMany.mockResolvedValue([
        { ...mockOfferVersion, status: "published", effectiveFrom: futureDate },
      ]);

      const result = await service.getScheduledVersions("ws_123", "offer_123");

      expect(result).toHaveLength(1);
    });
  });

  describe("publishVersion", () => {
    const publishedVersion = {
      ...mockOfferVersion,
      status: "published",
      publishedAt: new Date(),
    };

    it("should throw NotFoundException when offer not found", async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(
        service.publishVersion("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when no draft version exists", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findFirst.mockResolvedValue(null);

      await expect(
        service.publishVersion("ws_123", "offer_123"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when version is not draft", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findFirst.mockResolvedValue({
        ...mockOfferVersion,
        status: "published",
      });

      await expect(
        service.publishVersion("ws_123", "offer_123", "ver_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when pricing config is missing", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findFirst.mockResolvedValue({
        ...mockOfferVersion,
        config: {},
      });

      await expect(
        service.publishVersion("ws_123", "offer_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when pricing currency is missing", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findFirst.mockResolvedValue({
        ...mockOfferVersion,
        config: { pricing: { amount: 100 } },
      });

      await expect(
        service.publishVersion("ws_123", "offer_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when pricing amount is missing", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findFirst.mockResolvedValue({
        ...mockOfferVersion,
        config: { pricing: { currency: "usd" } },
      });

      await expect(
        service.publishVersion("ws_123", "offer_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when billing provider not configured", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findFirst.mockResolvedValue(mockOfferVersion);
      billingService.isConfiguredForWorkspace.mockReturnValue(false);

      await expect(
        service.publishVersion("ws_123", "offer_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should publish version immediately when no effectiveFrom", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findFirst.mockResolvedValue(mockOfferVersion);
      prisma.offerVersion.update.mockResolvedValue(publishedVersion);
      prisma.offer.update.mockResolvedValue({
        ...mockOffer,
        status: "active",
        currentVersionId: publishedVersion.id,
      });

      const result = await service.publishVersion("ws_123", "offer_123");

      expect(result.status).toBe("published");
      expect(prisma.offer.update).toHaveBeenCalled();
    });

    it("should schedule version for future publish", async () => {
      const futureDate = new Date(Date.now() + 86400000);
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findFirst.mockResolvedValue(mockOfferVersion);
      prisma.offerVersion.update.mockResolvedValue({
        ...publishedVersion,
        effectiveFrom: futureDate,
      });

      const result = await service.publishVersion(
        "ws_123",
        "offer_123",
        undefined,
        futureDate,
      );

      expect(result.status).toBe("published");
      // For scheduled publish, offer.update should NOT be called
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it("should archive previous version on immediate publish", async () => {
      const offerWithCurrentVersion = {
        ...mockOffer,
        currentVersionId: "ver_old",
        status: "active",
      };
      prisma.offer.findFirst.mockResolvedValue(offerWithCurrentVersion);
      prisma.offerVersion.findFirst.mockResolvedValue(mockOfferVersion);
      prisma.offerVersion.update.mockResolvedValue(publishedVersion);
      prisma.offer.update.mockResolvedValue({
        ...offerWithCurrentVersion,
        currentVersionId: publishedVersion.id,
      });

      await service.publishVersion("ws_123", "offer_123");

      // Should archive old version
      expect(prisma.offerVersion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ver_old" },
          data: { status: "archived" },
        }),
      );
    });

    it("should rollback on provider sync failure", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findFirst.mockResolvedValue(mockOfferVersion);
      prisma.offerVersion.update.mockResolvedValue(publishedVersion);
      prisma.offer.update.mockResolvedValue(mockOffer);

      // Make provider sync fail
      billingService.getProvider.mockReturnValue({
        syncOffer: vi.fn().mockRejectedValue(new Error("Provider error")),
      });

      await expect(
        service.publishVersion("ws_123", "offer_123"),
      ).rejects.toThrow(BadRequestException);

      // Verify rollback happened (version should be reverted to draft)
      expect(prisma.offerVersion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "draft" }),
        }),
      );
    });

    it("should publish specific version by id", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findFirst.mockResolvedValue(mockOfferVersion);
      prisma.offerVersion.update.mockResolvedValue(publishedVersion);
      prisma.offer.update.mockResolvedValue(mockOffer);

      await service.publishVersion("ws_123", "offer_123", "ver_123");

      expect(prisma.offerVersion.findFirst).toHaveBeenCalledWith({
        where: { id: "ver_123", offerId: "offer_123" },
      });
    });
  });

  describe("syncOfferToProvider", () => {
    it("should throw NotFoundException when offer not found", async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(
        service.syncOfferToProvider("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when no published version", async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        currentVersion: null,
      });

      await expect(
        service.syncOfferToProvider("ws_123", "offer_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when pricing config missing", async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        currentVersion: { ...mockOfferVersion, config: {} },
      });

      await expect(
        service.syncOfferToProvider("ws_123", "offer_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when pricing currency missing", async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        currentVersion: {
          ...mockOfferVersion,
          config: { pricing: { amount: 100 } },
        },
      });

      await expect(
        service.syncOfferToProvider("ws_123", "offer_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should sync offer to provider successfully", async () => {
      const offerWithVersion = {
        ...mockOffer,
        currentVersion: mockOfferVersion,
      };
      prisma.offer.findFirst.mockResolvedValue(offerWithVersion);

      const result = await service.syncOfferToProvider("ws_123", "offer_123");

      expect(result.success).toBe(true);
      expect(result.message).toContain("successfully");
    });

    it("should handle provider sync error", async () => {
      const offerWithVersion = {
        ...mockOffer,
        currentVersion: mockOfferVersion,
      };
      prisma.offer.findFirst.mockResolvedValue(offerWithVersion);
      billingService.getProvider.mockReturnValue({
        syncOffer: vi.fn().mockRejectedValue(new Error("Sync failed")),
      });

      await expect(
        service.syncOfferToProvider("ws_123", "offer_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when provider not configured", async () => {
      const offerWithVersion = {
        ...mockOffer,
        currentVersion: mockOfferVersion,
      };
      prisma.offer.findFirst.mockResolvedValue(offerWithVersion);
      billingService.isConfiguredForWorkspace.mockReturnValue(false);

      await expect(
        service.syncOfferToProvider("ws_123", "offer_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should create product ref when syncing for first time", async () => {
      const offerWithVersion = {
        ...mockOffer,
        currentVersion: mockOfferVersion,
      };
      prisma.offer.findFirst.mockResolvedValue(offerWithVersion);
      providerRefService.findByEntity.mockResolvedValue(null);

      await service.syncOfferToProvider("ws_123", "offer_123");

      expect(providerRefService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "product",
          entityId: "offer_123",
        }),
      );
    });

    it("should not create duplicate product ref when one exists", async () => {
      const offerWithVersion = {
        ...mockOffer,
        currentVersion: mockOfferVersion,
      };
      prisma.offer.findFirst.mockResolvedValue(offerWithVersion);
      providerRefService.findByEntity.mockResolvedValue({
        externalId: "existing_prod",
      });

      await service.syncOfferToProvider("ws_123", "offer_123");

      // Should only create price ref, not product ref
      expect(providerRefService.create).toHaveBeenCalledTimes(1);
      expect(providerRefService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "price",
        }),
      );
    });
  });

  describe("archive with provider", () => {
    it("should archive in provider when configured", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offer.update.mockResolvedValue({
        ...mockOffer,
        status: "archived",
      });
      providerRefService.findByEntity.mockResolvedValue({
        externalId: "prod_123",
      });

      await service.archive("ws_123", "offer_123");

      const provider = (
        billingService.getProvider as () => Record<
          string,
          ReturnType<typeof vi.fn>
        >
      )();
      expect(provider.archiveProduct).toHaveBeenCalledWith("prod_123");
    });

    it("should continue archiving even if provider fails", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offer.update.mockResolvedValue({
        ...mockOffer,
        status: "archived",
      });
      providerRefService.findByEntity.mockResolvedValue({
        externalId: "prod_123",
      });
      billingService.getProvider.mockReturnValue({
        archiveProduct: vi.fn().mockRejectedValue(new Error("Provider error")),
      });

      const result = await service.archive("ws_123", "offer_123");

      expect(result.status).toBe("archived");
    });

    it("should skip provider archive when provider not configured", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offer.update.mockResolvedValue({
        ...mockOffer,
        status: "archived",
      });
      billingService.isConfigured.mockReturnValue(false);

      await service.archive("ws_123", "offer_123");

      expect(providerRefService.findByEntity).not.toHaveBeenCalled();
    });

    it("should skip archive when no product ref exists", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offer.update.mockResolvedValue({
        ...mockOffer,
        status: "archived",
      });
      providerRefService.findByEntity.mockResolvedValue(null);

      const result = await service.archive("ws_123", "offer_123");

      expect(result.status).toBe("archived");
    });
  });

  describe("rollbackToVersion", () => {
    it("should throw NotFoundException when offer not found", async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(
        service.rollbackToVersion("ws_123", "nonexistent", "ver_123"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when target version not found", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findFirst.mockResolvedValue(null);

      await expect(
        service.rollbackToVersion("ws_123", "offer_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should create new draft version from target", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      prisma.offerVersion.findFirst
        .mockResolvedValueOnce({ ...mockOfferVersion, version: 2 }) // target version
        .mockResolvedValueOnce({ ...mockOfferVersion, version: 3 }); // latest version
      prisma.offerVersion.create.mockResolvedValue({
        ...mockOfferVersion,
        version: 4,
        status: "draft",
      });

      const result = await service.rollbackToVersion(
        "ws_123",
        "offer_123",
        "ver_123",
      );

      expect(result.version).toBe(4);
      expect(result.status).toBe("draft");
    });
  });
});
