import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { SubscriptionsService } from "./subscriptions.service";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";
import { ProviderRefService } from "../billing/provider-ref.service";
import { OffersService } from "../offers/offers.service";
import { EntitlementsService } from "../entitlements/entitlements.service";

describe("SubscriptionsService", () => {
  let service: SubscriptionsService;
  let prisma: {
    subscription: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let entitlementsService: {
    revokeAllForSubscription: ReturnType<typeof vi.fn>;
  };

  const mockSubscription = {
    id: "sub_123",
    workspaceId: "ws_123",
    customerId: "cust_123",
    offerId: "offer_123",
    offerVersionId: "ver_123",
    status: "active" as const,
    currentPeriodStart: new Date("2025-01-01"),
    currentPeriodEnd: new Date("2025-02-01"),
    cancelAt: null,
    canceledAt: null,
    endedAt: null,
    trialStart: null,
    trialEnd: null,
    metadata: {},
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      subscription: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };

    entitlementsService = {
      revokeAllForSubscription: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: BillingService,
          useValue: {
            isConfigured: vi.fn(),
            getProvider: vi.fn(),
          },
        },
        {
          provide: ProviderRefService,
          useValue: {
            findByEntity: vi.fn(),
            getProviderPriceId: vi.fn(),
          },
        },
        {
          provide: OffersService,
          useValue: {
            findById: vi.fn(),
            getVersion: vi.fn(),
            getPublishedVersion: vi.fn(),
          },
        },
        { provide: EntitlementsService, useValue: entitlementsService },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  describe("findById", () => {
    it("should return subscription with relations when found", async () => {
      const subscriptionWithRelations = {
        ...mockSubscription,
        customer: {
          id: "cust_123",
          email: "test@example.com",
          name: "Test User",
        },
        offer: { id: "offer_123", name: "Pro Plan" },
        offerVersion: { id: "ver_123", version: 1, config: {} },
      };

      prisma.subscription.findFirst.mockResolvedValue(
        subscriptionWithRelations,
      );

      const result = await service.findById("ws_123", "sub_123");

      expect(result).toEqual(subscriptionWithRelations);
      expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { id: "sub_123", workspaceId: "ws_123" },
        include: {
          customer: { select: { id: true, email: true, name: true } },
          offer: { select: { id: true, name: true } },
          offerVersion: { select: { id: true, version: true, config: true } },
        },
      });
    });

    it("should return null when subscription not found", async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);

      const result = await service.findById("ws_123", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByCustomerId", () => {
    it("should return subscriptions for customer", async () => {
      const subscriptions = [mockSubscription];
      prisma.subscription.findMany.mockResolvedValue(subscriptions);

      const result = await service.findByCustomerId("ws_123", "cust_123");

      expect(result).toEqual(subscriptions);
      expect(prisma.subscription.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "ws_123", customerId: "cust_123" },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("findMany", () => {
    it("should return paginated results", async () => {
      const subscriptions = [
        { ...mockSubscription, id: "sub_1" },
        { ...mockSubscription, id: "sub_2" },
      ];
      prisma.subscription.findMany.mockResolvedValue(subscriptions);

      const result = await service.findMany("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("should indicate hasMore when more results exist", async () => {
      const subscriptions = Array(11)
        .fill(null)
        .map((_, i) => ({ ...mockSubscription, id: `sub_${i}` }));
      prisma.subscription.findMany.mockResolvedValue(subscriptions);

      const result = await service.findMany("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("sub_9");
    });

    it("should filter by status", async () => {
      prisma.subscription.findMany.mockResolvedValue([]);

      await service.findMany("ws_123", { limit: 10, status: "active" });

      expect(prisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "active" }),
        }),
      );
    });

    it("should filter by multiple statuses", async () => {
      prisma.subscription.findMany.mockResolvedValue([]);

      await service.findMany("ws_123", {
        limit: 10,
        statuses: ["active", "trialing"],
      });

      expect(prisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ["active", "trialing"] },
          }),
        }),
      );
    });
  });

  describe("cancel", () => {
    it("should throw NotFoundException when subscription not found", async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.cancel("ws_123", "nonexistent", {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should schedule cancellation at period end", async () => {
      prisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      prisma.subscription.update.mockResolvedValue({
        ...mockSubscription,
        cancelAt: mockSubscription.currentPeriodEnd,
      });

      const result = await service.cancel("ws_123", "sub_123", {
        cancelAtPeriodEnd: true,
        reason: "No longer needed",
      });

      expect(result.cancelAt).toEqual(mockSubscription.currentPeriodEnd);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub_123" },
        data: {
          cancelAt: mockSubscription.currentPeriodEnd,
          metadata: { cancelReason: "No longer needed" },
          version: { increment: 1 },
        },
      });
      expect(
        entitlementsService.revokeAllForSubscription,
      ).not.toHaveBeenCalled();
    });

    it("should cancel immediately and revoke entitlements", async () => {
      prisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      prisma.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: "canceled",
        canceledAt: expect.any(Date),
        endedAt: expect.any(Date),
      });
      entitlementsService.revokeAllForSubscription.mockResolvedValue(undefined);

      await service.cancel("ws_123", "sub_123", { reason: "Refund requested" });

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub_123" },
        data: expect.objectContaining({
          status: "canceled",
          canceledAt: expect.any(Date),
          endedAt: expect.any(Date),
          metadata: { cancelReason: "Refund requested" },
        }),
      });
      expect(entitlementsService.revokeAllForSubscription).toHaveBeenCalledWith(
        "ws_123",
        "sub_123",
      );
    });
  });

  describe("updateStatus", () => {
    it("should throw NotFoundException when subscription not found", async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus("ws_123", "nonexistent", "canceled"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should update subscription status", async () => {
      prisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      prisma.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: "payment_failed",
      });

      const result = await service.updateStatus(
        "ws_123",
        "sub_123",
        "payment_failed",
      );

      expect(result.status).toBe("payment_failed");
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub_123" },
        data: { status: "payment_failed", version: { increment: 1 } },
      });
    });
  });

  describe("getActiveSubscriptionsForCustomer", () => {
    it("should return active and trialing subscriptions", async () => {
      const subscriptions = [
        { ...mockSubscription, status: "active" },
        { ...mockSubscription, id: "sub_456", status: "trialing" },
      ];
      prisma.subscription.findMany.mockResolvedValue(subscriptions);

      const result = await service.getActiveSubscriptionsForCustomer(
        "ws_123",
        "cust_123",
      );

      expect(result).toHaveLength(2);
      expect(prisma.subscription.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          customerId: "cust_123",
          status: { in: ["active", "trialing"] },
        },
        include: { offer: true, offerVersion: true },
      });
    });
  });

  describe("change", () => {
    let billingService: {
      isConfigured: ReturnType<typeof vi.fn>;
      getProvider: ReturnType<typeof vi.fn>;
    };
    let providerRefService: {
      findByEntity: ReturnType<typeof vi.fn>;
      getProviderPriceId: ReturnType<typeof vi.fn>;
    };
    let offersService: {
      findById: ReturnType<typeof vi.fn>;
      getVersion: ReturnType<typeof vi.fn>;
      getPublishedVersion: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
      billingService = {
        isConfigured: vi.fn().mockReturnValue(true),
        getProvider: vi.fn().mockReturnValue({
          changeSubscription: vi.fn().mockResolvedValue({
            effectiveDate: new Date(),
          }),
        }),
      };

      providerRefService = {
        findByEntity: vi.fn().mockResolvedValue({
          id: "ref_123",
          externalId: "sub_stripe_123",
          metadata: {},
        }),
        getProviderPriceId: vi.fn().mockResolvedValue("price_stripe_456"),
      };

      offersService = {
        findById: vi
          .fn()
          .mockResolvedValue({ id: "new_offer", name: "Enterprise" }),
        getVersion: vi.fn(),
        getPublishedVersion: vi.fn().mockResolvedValue({
          id: "new_ver_123",
          status: "published",
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SubscriptionsService,
          { provide: PrismaService, useValue: prisma },
          { provide: BillingService, useValue: billingService },
          { provide: ProviderRefService, useValue: providerRefService },
          { provide: OffersService, useValue: offersService },
          { provide: EntitlementsService, useValue: entitlementsService },
        ],
      }).compile();

      service = module.get<SubscriptionsService>(SubscriptionsService);
    });

    it("should throw NotFoundException when subscription not found", async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.change("ws_123", "nonexistent", { newOfferId: "offer_new" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when subscription is canceled", async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        ...mockSubscription,
        status: "canceled",
      });

      await expect(
        service.change("ws_123", "sub_123", { newOfferId: "offer_new" }),
      ).rejects.toThrow("Only active or trialing subscriptions can be changed");
    });

    it("should throw NotFoundException when new offer not found", async () => {
      prisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      offersService.findById.mockResolvedValue(null);

      await expect(
        service.change("ws_123", "sub_123", { newOfferId: "nonexistent" }),
      ).rejects.toThrow("not found");
    });

    it("should throw BadRequestException when no published version", async () => {
      prisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      offersService.getPublishedVersion.mockResolvedValue(null);

      await expect(
        service.change("ws_123", "sub_123", { newOfferId: "new_offer" }),
      ).rejects.toThrow("has no published version");
    });

    it("should throw BadRequestException when version is not published", async () => {
      prisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      offersService.getVersion.mockResolvedValue({
        id: "draft_ver",
        status: "draft",
      });

      await expect(
        service.change("ws_123", "sub_123", {
          newOfferId: "new_offer",
          newOfferVersionId: "draft_ver",
        }),
      ).rejects.toThrow("only published versions can be used");
    });

    it("should throw BadRequestException when billing provider not configured", async () => {
      prisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      billingService.isConfigured.mockReturnValue(false);

      await expect(
        service.change("ws_123", "sub_123", { newOfferId: "new_offer" }),
      ).rejects.toThrow("not configured");
    });

    it("should throw BadRequestException when subscription not linked to provider", async () => {
      prisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      providerRefService.findByEntity.mockResolvedValue(null);

      await expect(
        service.change("ws_123", "sub_123", { newOfferId: "new_offer" }),
      ).rejects.toThrow("not linked to");
    });

    it("should throw BadRequestException when offer not synced to provider", async () => {
      prisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      providerRefService.getProviderPriceId.mockResolvedValue(null);

      await expect(
        service.change("ws_123", "sub_123", { newOfferId: "new_offer" }),
      ).rejects.toThrow("not synced");
    });

    it("should change subscription successfully", async () => {
      prisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      prisma.subscription.update.mockResolvedValue({
        ...mockSubscription,
        offerId: "new_offer",
        offerVersionId: "new_ver_123",
      });

      const result = await service.change("ws_123", "sub_123", {
        newOfferId: "new_offer",
      });

      expect(result.offerId).toBe("new_offer");
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub_123" },
        data: expect.objectContaining({
          offerId: "new_offer",
          offerVersionId: "new_ver_123",
        }),
      });
    });

    it("should change subscription with specific version", async () => {
      prisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      offersService.getVersion.mockResolvedValue({
        id: "specific_ver",
        status: "published",
        config: { pricing: { amount: 5000, currency: "usd" } },
      });
      prisma.subscription.update.mockResolvedValue({
        ...mockSubscription,
        offerId: "new_offer",
        offerVersionId: "specific_ver",
      });

      const result = await service.change("ws_123", "sub_123", {
        newOfferId: "new_offer",
        newOfferVersionId: "specific_ver",
      });

      expect(result.offerVersionId).toBe("specific_ver");
    });
  });
});
