import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";

describe("SubscriptionsController", () => {
  let controller: SubscriptionsController;
  let subscriptionsService: {
    findMany: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    change: ReturnType<typeof vi.fn>;
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
    cancelAtPeriodEnd: false,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    subscriptionsService = {
      findMany: vi.fn(),
      findById: vi.fn(),
      cancel: vi.fn(),
      change: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: subscriptionsService },
      ],
    }).compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
  });

  describe("findAll", () => {
    it("should return paginated subscriptions", async () => {
      subscriptionsService.findMany.mockResolvedValue({
        data: [mockSubscription],
        hasMore: false,
        nextCursor: null,
      });

      const result = await controller.findAll("ws_123", {} as any);

      expect(result.data).toHaveLength(1);
      expect(subscriptionsService.findMany).toHaveBeenCalledWith("ws_123", {
        limit: 20,
        cursor: undefined,
        customerId: undefined,
        offerId: undefined,
        status: undefined,
      });
    });

    it("should pass filters to service", async () => {
      subscriptionsService.findMany.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: null,
      });

      await controller.findAll("ws_123", {
        limit: 50,
        cursor: "cursor123",
        customerId: "cust_123",
        offerId: "offer_123",
        status: "active",
      } as any);

      expect(subscriptionsService.findMany).toHaveBeenCalledWith("ws_123", {
        limit: 50,
        cursor: "cursor123",
        customerId: "cust_123",
        offerId: "offer_123",
        status: "active",
      });
    });
  });

  describe("findOne", () => {
    it("should return subscription when found", async () => {
      subscriptionsService.findById.mockResolvedValue(mockSubscription);

      const result = await controller.findOne("ws_123", "sub_123");

      expect(result).toEqual(mockSubscription);
    });

    it("should throw NotFoundException when not found", async () => {
      subscriptionsService.findById.mockResolvedValue(null);

      await expect(controller.findOne("ws_123", "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("cancel", () => {
    it("should cancel subscription immediately", async () => {
      subscriptionsService.cancel.mockResolvedValue({
        ...mockSubscription,
        status: "canceled",
      });

      const result = await controller.cancel("ws_123", "sub_123", {});

      expect(result.status).toBe("canceled");
      expect(subscriptionsService.cancel).toHaveBeenCalledWith(
        "ws_123",
        "sub_123",
        {},
      );
    });

    it("should cancel at period end", async () => {
      subscriptionsService.cancel.mockResolvedValue({
        ...mockSubscription,
        cancelAt: mockSubscription.currentPeriodEnd,
      });

      const result = await controller.cancel("ws_123", "sub_123", {
        cancelAtPeriodEnd: true,
        reason: "Customer requested",
      });

      expect(result.cancelAt).toEqual(mockSubscription.currentPeriodEnd);
      expect(subscriptionsService.cancel).toHaveBeenCalledWith(
        "ws_123",
        "sub_123",
        { cancelAtPeriodEnd: true, reason: "Customer requested" },
      );
    });
  });

  describe("change", () => {
    it("should change subscription plan", async () => {
      subscriptionsService.change.mockResolvedValue({
        ...mockSubscription,
        offerId: "new_offer_123",
      });

      const result = await controller.change("ws_123", "sub_123", {
        newOfferId: "new_offer_123",
      });

      expect(result.offerId).toBe("new_offer_123");
      expect(subscriptionsService.change).toHaveBeenCalledWith(
        "ws_123",
        "sub_123",
        { newOfferId: "new_offer_123" },
      );
    });

    it("should pass proration behavior", async () => {
      subscriptionsService.change.mockResolvedValue({
        ...mockSubscription,
        offerId: "new_offer_123",
      });

      await controller.change("ws_123", "sub_123", {
        newOfferId: "new_offer_123",
        newOfferVersionId: "ver_456",
        prorationBehavior: "always_invoice",
      });

      expect(subscriptionsService.change).toHaveBeenCalledWith(
        "ws_123",
        "sub_123",
        {
          newOfferId: "new_offer_123",
          newOfferVersionId: "ver_456",
          prorationBehavior: "always_invoice",
        },
      );
    });
  });
});
