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
        status: "past_due",
      });

      const result = await service.updateStatus(
        "ws_123",
        "sub_123",
        "past_due",
      );

      expect(result.status).toBe("past_due");
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub_123" },
        data: { status: "past_due", version: { increment: 1 } },
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
});
