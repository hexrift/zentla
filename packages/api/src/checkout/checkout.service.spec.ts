import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { CheckoutService } from "./checkout.service";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";
import { ProviderRefService } from "../billing/provider-ref.service";
import { OffersService } from "../offers/offers.service";

describe("CheckoutService", () => {
  let service: CheckoutService;
  let prisma: {
    checkout: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
    checkoutIntent: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
    offer: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    customer: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    promotion: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let offersService: {
    getVersion: ReturnType<typeof vi.fn>;
    getEffectiveVersion: ReturnType<typeof vi.fn>;
  };

  const mockCheckout = {
    id: "checkout_123",
    workspaceId: "ws_123",
    offerId: "offer_123",
    offerVersionId: "ver_123",
    customerId: null,
    customerEmail: "test@example.com",
    successUrl: "https://example.com/success",
    cancelUrl: "https://example.com/cancel",
    status: "pending",
    sessionUrl: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    completedAt: null,
    metadata: {},
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      checkout: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        groupBy: vi.fn(),
      },
      checkoutIntent: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        groupBy: vi.fn(),
      },
      offer: {
        findFirst: vi.fn(),
      },
      customer: {
        findFirst: vi.fn(),
      },
      promotion: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
    };

    offersService = {
      getVersion: vi.fn(),
      getEffectiveVersion: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: BillingService,
          useValue: {
            isConfigured: vi.fn().mockReturnValue(true),
            getProvider: vi.fn(),
          },
        },
        {
          provide: ProviderRefService,
          useValue: {
            getProviderPriceId: vi.fn(),
            getProviderCustomerId: vi.fn(),
            findByEntity: vi.fn(),
            create: vi.fn(),
          },
        },
        { provide: OffersService, useValue: offersService },
      ],
    }).compile();

    service = module.get<CheckoutService>(CheckoutService);
  });

  describe("findById", () => {
    it("should return checkout when found", async () => {
      prisma.checkout.findFirst.mockResolvedValue(mockCheckout);

      const result = await service.findById("ws_123", "checkout_123");

      expect(result).toEqual(mockCheckout);
      expect(prisma.checkout.findFirst).toHaveBeenCalledWith({
        where: { id: "checkout_123", workspaceId: "ws_123" },
      });
    });

    it("should return null when checkout not found", async () => {
      prisma.checkout.findFirst.mockResolvedValue(null);

      const result = await service.findById("ws_123", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("listSessions", () => {
    it("should return paginated sessions", async () => {
      const sessions = [mockCheckout, { ...mockCheckout, id: "checkout_456" }];
      prisma.checkout.findMany.mockResolvedValue(sessions);

      const result = await service.listSessions("ws_123", { limit: 50 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("should filter by status", async () => {
      prisma.checkout.findMany.mockResolvedValue([]);

      await service.listSessions("ws_123", { status: "complete" });

      expect(prisma.checkout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "complete" }),
        }),
      );
    });

    it("should indicate hasMore when more results exist", async () => {
      const sessions = Array(51)
        .fill(null)
        .map((_, i) => ({ ...mockCheckout, id: `checkout_${i}` }));
      prisma.checkout.findMany.mockResolvedValue(sessions);

      const result = await service.listSessions("ws_123", { limit: 50 });

      expect(result.hasMore).toBe(true);
      expect(result.data).toHaveLength(50);
    });
  });

  describe("complete", () => {
    it("should throw NotFoundException when checkout not found", async () => {
      prisma.checkout.findFirst.mockResolvedValue(null);

      await expect(service.complete("ws_123", "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should mark checkout as complete", async () => {
      prisma.checkout.findFirst.mockResolvedValue(mockCheckout);
      prisma.checkout.update.mockResolvedValue({
        ...mockCheckout,
        status: "complete",
        completedAt: expect.any(Date),
      });

      const result = await service.complete("ws_123", "checkout_123");

      expect(result.status).toBe("complete");
      expect(prisma.checkout.update).toHaveBeenCalledWith({
        where: { id: "checkout_123" },
        data: {
          status: "complete",
          completedAt: expect.any(Date),
        },
      });
    });
  });

  describe("expire", () => {
    it("should throw NotFoundException when checkout not found", async () => {
      prisma.checkout.findFirst.mockResolvedValue(null);

      await expect(service.expire("ws_123", "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should mark checkout as expired", async () => {
      prisma.checkout.findFirst.mockResolvedValue(mockCheckout);
      prisma.checkout.update.mockResolvedValue({
        ...mockCheckout,
        status: "expired",
      });

      const result = await service.expire("ws_123", "checkout_123");

      expect(result.status).toBe("expired");
    });
  });

  describe("expireOldCheckouts", () => {
    it("should expire old pending/open checkouts", async () => {
      prisma.checkout.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.expireOldCheckouts();

      expect(result).toBe(5);
      expect(prisma.checkout.updateMany).toHaveBeenCalledWith({
        where: {
          status: { in: ["pending", "open"] },
          expiresAt: { lt: expect.any(Date) },
        },
        data: { status: "expired" },
      });
    });
  });

  describe("getCheckoutStats", () => {
    it("should return aggregated stats for sessions and intents", async () => {
      prisma.checkout.groupBy.mockResolvedValue([
        { status: "pending", _count: { id: 10 } },
        { status: "complete", _count: { id: 5 } },
        { status: "expired", _count: { id: 3 } },
      ]);
      prisma.checkoutIntent.groupBy.mockResolvedValue([
        { status: "pending", _count: { id: 20 } },
        { status: "succeeded", _count: { id: 8 } },
        { status: "failed", _count: { id: 2 } },
      ]);

      const result = await service.getCheckoutStats("ws_123");

      expect(result.sessions.total).toBe(18);
      expect(result.sessions.completed).toBe(5);
      expect(result.sessions.conversionRate).toBeCloseTo(27.78, 1);
      expect(result.intents.total).toBe(30);
      expect(result.intents.succeeded).toBe(8);
      expect(result.intents.conversionRate).toBeCloseTo(26.67, 1);
    });

    it("should handle empty stats", async () => {
      prisma.checkout.groupBy.mockResolvedValue([]);
      prisma.checkoutIntent.groupBy.mockResolvedValue([]);

      const result = await service.getCheckoutStats("ws_123");

      expect(result.sessions.total).toBe(0);
      expect(result.sessions.conversionRate).toBe(0);
      expect(result.intents.total).toBe(0);
      expect(result.intents.conversionRate).toBe(0);
    });
  });

  describe("createQuote", () => {
    const mockOffer = {
      id: "offer_123",
      workspaceId: "ws_123",
      name: "Pro Offer",
      status: "active",
    };

    const mockOfferVersion = {
      id: "ver_123",
      offerId: "offer_123",
      version: 1,
      status: "published",
      config: {
        pricing: {
          amount: 2999,
          currency: "usd",
          interval: "month",
          intervalCount: 1,
        },
        trial: {
          days: 14,
          requirePaymentMethod: true,
        },
      },
    };

    it("should throw NotFoundException when offer not found", async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(
        service.createQuote("ws_123", { offerId: "nonexistent" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when no published version", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      offersService.getEffectiveVersion.mockResolvedValue(null);

      await expect(
        service.createQuote("ws_123", { offerId: "offer_123" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should return quote with pricing details", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      offersService.getEffectiveVersion.mockResolvedValue(mockOfferVersion);

      const result = await service.createQuote("ws_123", {
        offerId: "offer_123",
      });

      expect(result.offerId).toBe("offer_123");
      expect(result.offerVersionId).toBe("ver_123");
      expect(result.subtotal).toBe(2999);
      expect(result.total).toBe(2999);
      expect(result.currency).toBe("usd");
      expect(result.interval).toBe("month");
      expect(result.trial?.days).toBe(14);
      expect(result.validationErrors).toHaveLength(0);
    });

    it("should apply promotion discount", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      offersService.getEffectiveVersion.mockResolvedValue(mockOfferVersion);
      prisma.promotion.findFirst.mockResolvedValue({
        id: "promo_123",
        code: "SAVE20",
        status: "active",
        currentVersion: {
          id: "pver_123",
          config: {
            discountType: "percent",
            discountValue: 20,
            duration: "once",
          },
        },
      });

      const result = await service.createQuote("ws_123", {
        offerId: "offer_123",
        promotionCode: "SAVE20",
      });

      expect(result.discount).toBe(599); // 20% of 2999
      expect(result.total).toBe(2400);
      expect(result.promotion?.code).toBe("SAVE20");
    });

    it("should return validation error for invalid promotion", async () => {
      prisma.offer.findFirst.mockResolvedValue(mockOffer);
      offersService.getEffectiveVersion.mockResolvedValue(mockOfferVersion);
      prisma.promotion.findFirst.mockResolvedValue(null);

      const result = await service.createQuote("ws_123", {
        offerId: "offer_123",
        promotionCode: "INVALID",
      });

      expect(result.validationErrors).toContain(
        'Promotion code "INVALID" not found',
      );
      expect(result.discount).toBe(0);
    });
  });

  describe("listIntents", () => {
    it("should return paginated intents with relations", async () => {
      const mockIntent = {
        id: "intent_123",
        workspaceId: "ws_123",
        status: "pending",
        offer: { id: "offer_123", name: "Pro" },
        customer: null,
        subscription: null,
        promotion: null,
      };
      prisma.checkoutIntent.findMany.mockResolvedValue([mockIntent]);

      const result = await service.listIntents("ws_123", { limit: 50 });

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });
  });
});
