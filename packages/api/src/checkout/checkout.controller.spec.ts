import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";

describe("CheckoutController", () => {
  let controller: CheckoutController;
  let checkoutService: {
    listSessions: ReturnType<typeof vi.fn>;
    listIntents: ReturnType<typeof vi.fn>;
    getCheckoutStats: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    createQuote: ReturnType<typeof vi.fn>;
    createIntent: ReturnType<typeof vi.fn>;
    findIntentById: ReturnType<typeof vi.fn>;
  };

  const mockSession = {
    id: "session_123",
    workspaceId: "ws_123",
    offerId: "offer_123",
    customerId: "cust_123",
    status: "pending" as const,
    url: "https://checkout.stripe.com/session_123",
    expiresAt: new Date("2025-02-01"),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockIntent = {
    id: "intent_123",
    workspaceId: "ws_123",
    offerId: "offer_123",
    customerId: "cust_123",
    status: "pending" as const,
    clientSecret: "pi_secret_123",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    checkoutService = {
      listSessions: vi.fn(),
      listIntents: vi.fn(),
      getCheckoutStats: vi.fn(),
      create: vi.fn(),
      findById: vi.fn(),
      createQuote: vi.fn(),
      createIntent: vi.fn(),
      findIntentById: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckoutController],
      providers: [{ provide: CheckoutService, useValue: checkoutService }],
    }).compile();

    controller = module.get<CheckoutController>(CheckoutController);
  });

  describe("listSessions", () => {
    it("should return paginated sessions", async () => {
      checkoutService.listSessions.mockResolvedValue({
        data: [mockSession],
        hasMore: false,
        nextCursor: null,
      });

      const result = await controller.listSessions("ws_123");

      expect(result.data).toHaveLength(1);
      expect(checkoutService.listSessions).toHaveBeenCalledWith("ws_123", {
        status: undefined,
        limit: undefined,
        cursor: undefined,
      });
    });

    it("should pass filters to service", async () => {
      checkoutService.listSessions.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: null,
      });

      await controller.listSessions("ws_123", "completed", "50", "cursor123");

      expect(checkoutService.listSessions).toHaveBeenCalledWith("ws_123", {
        status: "completed",
        limit: 50,
        cursor: "cursor123",
      });
    });
  });

  describe("listIntents", () => {
    it("should return paginated intents", async () => {
      checkoutService.listIntents.mockResolvedValue({
        data: [mockIntent],
        hasMore: false,
        nextCursor: null,
      });

      const result = await controller.listIntents("ws_123");

      expect(result.data).toHaveLength(1);
      expect(checkoutService.listIntents).toHaveBeenCalledWith("ws_123", {
        status: undefined,
        limit: undefined,
        cursor: undefined,
      });
    });

    it("should pass filters to service", async () => {
      checkoutService.listIntents.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: null,
      });

      await controller.listIntents("ws_123", "succeeded", "25", "cursor456");

      expect(checkoutService.listIntents).toHaveBeenCalledWith("ws_123", {
        status: "succeeded",
        limit: 25,
        cursor: "cursor456",
      });
    });
  });

  describe("getStats", () => {
    it("should return checkout statistics", async () => {
      const mockStats = {
        totalSessions: 100,
        completedSessions: 75,
        expiredSessions: 20,
        pendingSessions: 5,
        conversionRate: 0.75,
      };
      checkoutService.getCheckoutStats.mockResolvedValue(mockStats);

      const result = await controller.getStats("ws_123");

      expect(result).toEqual(mockStats);
      expect(checkoutService.getCheckoutStats).toHaveBeenCalledWith("ws_123");
    });
  });

  describe("createSession", () => {
    it("should create checkout session", async () => {
      checkoutService.create.mockResolvedValue(mockSession);

      const result = await controller.createSession("ws_123", {
        offerId: "offer_123",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });

      expect(result.id).toBe("session_123");
      expect(result.url).toBe("https://checkout.stripe.com/session_123");
      expect(checkoutService.create).toHaveBeenCalledWith("ws_123", {
        offerId: "offer_123",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });
    });

    it("should pass optional parameters", async () => {
      checkoutService.create.mockResolvedValue(mockSession);

      await controller.createSession("ws_123", {
        offerId: "offer_123",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        customerId: "cust_123",
        customerEmail: "test@example.com",
        promotionCode: "SUMMER25",
        allowPromotionCodes: true,
        trialDays: 14,
        metadata: { source: "website" },
      });

      expect(checkoutService.create).toHaveBeenCalledWith("ws_123", {
        offerId: "offer_123",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        customerId: "cust_123",
        customerEmail: "test@example.com",
        promotionCode: "SUMMER25",
        allowPromotionCodes: true,
        trialDays: 14,
        metadata: { source: "website" },
      });
    });
  });

  describe("getSession", () => {
    it("should return session when found", async () => {
      checkoutService.findById.mockResolvedValue(mockSession);

      const result = await controller.getSession("ws_123", "session_123");

      expect(result).toEqual(mockSession);
    });

    it("should throw NotFoundException when not found", async () => {
      checkoutService.findById.mockResolvedValue(null);

      await expect(
        controller.getSession("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createQuote", () => {
    it("should create quote", async () => {
      const mockQuote = {
        offerId: "offer_123",
        subtotal: 9900,
        discount: 0,
        tax: 0,
        total: 9900,
        currency: "usd",
        interval: "month",
      };
      checkoutService.createQuote.mockResolvedValue(mockQuote);

      const result = await controller.createQuote("ws_123", {
        offerId: "offer_123",
      });

      expect(result).toEqual(mockQuote);
      expect(checkoutService.createQuote).toHaveBeenCalledWith("ws_123", {
        offerId: "offer_123",
      });
    });

    it("should pass promotion code", async () => {
      const mockQuote = {
        offerId: "offer_123",
        subtotal: 9900,
        discount: 2475,
        tax: 0,
        total: 7425,
        currency: "usd",
        interval: "month",
        promotion: { code: "SUMMER25", discountPercent: 25 },
      };
      checkoutService.createQuote.mockResolvedValue(mockQuote);

      const result = await controller.createQuote("ws_123", {
        offerId: "offer_123",
        promotionCode: "SUMMER25",
      });

      expect(result.discount).toBe(2475);
      expect(checkoutService.createQuote).toHaveBeenCalledWith("ws_123", {
        offerId: "offer_123",
        promotionCode: "SUMMER25",
      });
    });
  });

  describe("createIntent", () => {
    it("should create checkout intent", async () => {
      checkoutService.createIntent.mockResolvedValue(mockIntent);

      const result = await controller.createIntent(
        "ws_123",
        {
          offerId: "offer_123",
          customerEmail: "test@example.com",
        },
        undefined,
      );

      expect(result).toEqual(mockIntent);
      expect(checkoutService.createIntent).toHaveBeenCalledWith(
        "ws_123",
        { offerId: "offer_123", customerEmail: "test@example.com" },
        undefined,
      );
    });

    it("should pass idempotency key", async () => {
      checkoutService.createIntent.mockResolvedValue(mockIntent);

      await controller.createIntent(
        "ws_123",
        { offerId: "offer_123", customerId: "cust_123" },
        "idempotency_123",
      );

      expect(checkoutService.createIntent).toHaveBeenCalledWith(
        "ws_123",
        { offerId: "offer_123", customerId: "cust_123" },
        "idempotency_123",
      );
    });
  });

  describe("getIntent", () => {
    it("should return intent when found", async () => {
      checkoutService.findIntentById.mockResolvedValue(mockIntent);

      const result = await controller.getIntent("ws_123", "intent_123");

      expect(result).toEqual(mockIntent);
    });

    it("should throw NotFoundException when not found", async () => {
      checkoutService.findIntentById.mockResolvedValue(null);

      await expect(
        controller.getIntent("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
