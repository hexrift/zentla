import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { StripeSyncService } from "./stripe-sync.service";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";
import { ProviderRefService } from "../billing/provider-ref.service";

describe("StripeSyncService", () => {
  let service: StripeSyncService;
  let prisma: {
    customer: {
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    subscription: {
      create: ReturnType<typeof vi.fn>;
    };
    offerVersion: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    entitlement: {
      create: ReturnType<typeof vi.fn>;
    };
  };
  let billingService: {
    isConfigured: ReturnType<typeof vi.fn>;
    getProvider: ReturnType<typeof vi.fn>;
  };
  let providerRefService: {
    findByExternalId: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };

  const mockStripeAdapter = {
    listCustomers: vi.fn(),
    listSubscriptions: vi.fn(),
  };

  const mockStripeCustomer = {
    id: "cus_123",
    email: "test@example.com",
    name: "Test Customer",
  };

  const mockStripeSubscription = {
    id: "sub_123",
    customer: "cus_123",
    status: "active",
    current_period_start: 1704067200, // 2024-01-01
    current_period_end: 1706745600, // 2024-02-01
    cancel_at: null,
    canceled_at: null,
    trial_start: null,
    trial_end: null,
    items: {
      data: [{ price: { id: "price_123" } }],
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    prisma = {
      customer: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      subscription: {
        create: vi.fn(),
      },
      offerVersion: {
        findUnique: vi.fn(),
      },
      entitlement: {
        create: vi.fn(),
      },
    };

    billingService = {
      isConfigured: vi.fn().mockReturnValue(true),
      getProvider: vi.fn().mockReturnValue(mockStripeAdapter),
    };

    providerRefService = {
      findByExternalId: vi.fn(),
      create: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingService, useValue: billingService },
        { provide: ProviderRefService, useValue: providerRefService },
      ],
    }).compile();

    service = module.get<StripeSyncService>(StripeSyncService);
  });

  describe("syncFromStripe", () => {
    it("should throw BadRequestException when Stripe not configured", async () => {
      billingService.isConfigured.mockReturnValue(false);

      await expect(service.syncFromStripe("ws_123")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should return empty result when no customers or subscriptions", async () => {
      mockStripeAdapter.listCustomers.mockResolvedValue({
        customers: [],
        hasMore: false,
      });
      mockStripeAdapter.listSubscriptions.mockResolvedValue({
        subscriptions: [],
        hasMore: false,
      });

      const result = await service.syncFromStripe("ws_123");

      expect(result.customersImported).toBe(0);
      expect(result.subscriptionsImported).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should sync customers from Stripe", async () => {
      mockStripeAdapter.listCustomers.mockResolvedValue({
        customers: [mockStripeCustomer],
        hasMore: false,
      });
      mockStripeAdapter.listSubscriptions.mockResolvedValue({
        subscriptions: [],
        hasMore: false,
      });
      providerRefService.findByExternalId.mockResolvedValue(null);
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({
        id: "cust_zentla_123",
        email: "test@example.com",
      });

      const result = await service.syncFromStripe("ws_123");

      expect(result.customersImported).toBe(1);
      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws_123",
          email: "test@example.com",
        }),
      });
      expect(providerRefService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "customer",
          provider: "stripe",
          externalId: "cus_123",
        }),
      );
    });

    it("should skip already synced customers", async () => {
      mockStripeAdapter.listCustomers.mockResolvedValue({
        customers: [mockStripeCustomer],
        hasMore: false,
      });
      mockStripeAdapter.listSubscriptions.mockResolvedValue({
        subscriptions: [],
        hasMore: false,
      });
      providerRefService.findByExternalId.mockResolvedValue({
        id: "ref_123",
        entityId: "cust_zentla_123",
      });

      const result = await service.syncFromStripe("ws_123");

      expect(result.customersSkipped).toBe(1);
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it("should skip customers without email", async () => {
      mockStripeAdapter.listCustomers.mockResolvedValue({
        customers: [{ ...mockStripeCustomer, email: null }],
        hasMore: false,
      });
      mockStripeAdapter.listSubscriptions.mockResolvedValue({
        subscriptions: [],
        hasMore: false,
      });
      providerRefService.findByExternalId.mockResolvedValue(null);

      const result = await service.syncFromStripe("ws_123");

      expect(result.customersSkipped).toBe(1);
      expect(result.errors).toContainEqual(expect.stringContaining("No email"));
    });

    it("should use existing customer if email matches", async () => {
      mockStripeAdapter.listCustomers.mockResolvedValue({
        customers: [mockStripeCustomer],
        hasMore: false,
      });
      mockStripeAdapter.listSubscriptions.mockResolvedValue({
        subscriptions: [],
        hasMore: false,
      });
      providerRefService.findByExternalId.mockResolvedValue(null);
      prisma.customer.findFirst.mockResolvedValue({
        id: "cust_zentla_existing",
        email: "test@example.com",
      });

      const result = await service.syncFromStripe("ws_123");

      expect(result.customersImported).toBe(1);
      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(providerRefService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: "cust_zentla_existing",
        }),
      );
    });

    it("should paginate through customers", async () => {
      mockStripeAdapter.listCustomers
        .mockResolvedValueOnce({
          customers: [mockStripeCustomer],
          hasMore: true,
        })
        .mockResolvedValueOnce({
          customers: [{ ...mockStripeCustomer, id: "cus_456" }],
          hasMore: false,
        });
      mockStripeAdapter.listSubscriptions.mockResolvedValue({
        subscriptions: [],
        hasMore: false,
      });
      providerRefService.findByExternalId.mockResolvedValue(null);
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({ id: "cust_zentla" });

      await service.syncFromStripe("ws_123");

      expect(mockStripeAdapter.listCustomers).toHaveBeenCalledTimes(2);
    });

    it("should sync subscriptions from Stripe", async () => {
      mockStripeAdapter.listCustomers.mockResolvedValue({
        customers: [],
        hasMore: false,
      });
      mockStripeAdapter.listSubscriptions.mockResolvedValue({
        subscriptions: [mockStripeSubscription],
        hasMore: false,
      });

      // Subscription not yet synced
      providerRefService.findByExternalId
        .mockResolvedValueOnce(null) // subscription check
        .mockResolvedValueOnce({ entityId: "cust_zentla_123" }) // customer ref
        .mockResolvedValueOnce({ entityId: "ver_123" }); // price ref

      prisma.offerVersion.findUnique.mockResolvedValue({
        id: "ver_123",
        offer: { id: "offer_123" },
        config: {},
      });
      prisma.subscription.create.mockResolvedValue({
        id: "sub_zentla_123",
      });

      const result = await service.syncFromStripe("ws_123");

      expect(result.subscriptionsImported).toBe(1);
      expect(prisma.subscription.create).toHaveBeenCalled();
    });

    it("should skip already synced subscriptions", async () => {
      mockStripeAdapter.listCustomers.mockResolvedValue({
        customers: [],
        hasMore: false,
      });
      mockStripeAdapter.listSubscriptions.mockResolvedValue({
        subscriptions: [mockStripeSubscription],
        hasMore: false,
      });
      providerRefService.findByExternalId.mockResolvedValue({
        id: "ref_123",
      });

      const result = await service.syncFromStripe("ws_123");

      expect(result.subscriptionsSkipped).toBe(1);
    });

    it("should skip subscriptions without customer ref", async () => {
      mockStripeAdapter.listCustomers.mockResolvedValue({
        customers: [],
        hasMore: false,
      });
      mockStripeAdapter.listSubscriptions.mockResolvedValue({
        subscriptions: [mockStripeSubscription],
        hasMore: false,
      });
      providerRefService.findByExternalId
        .mockResolvedValueOnce(null) // subscription check
        .mockResolvedValueOnce(null); // customer ref

      const result = await service.syncFromStripe("ws_123");

      expect(result.subscriptionsSkipped).toBe(1);
      expect(result.errors).toContainEqual(
        expect.stringContaining("not synced"),
      );
    });

    it("should skip subscriptions without price ref", async () => {
      mockStripeAdapter.listCustomers.mockResolvedValue({
        customers: [],
        hasMore: false,
      });
      mockStripeAdapter.listSubscriptions.mockResolvedValue({
        subscriptions: [mockStripeSubscription],
        hasMore: false,
      });
      providerRefService.findByExternalId
        .mockResolvedValueOnce(null) // subscription check
        .mockResolvedValueOnce({ entityId: "cust_zentla_123" }) // customer ref
        .mockResolvedValueOnce(null); // price ref

      const result = await service.syncFromStripe("ws_123");

      expect(result.subscriptionsSkipped).toBe(1);
      expect(result.errors).toContainEqual(
        expect.stringContaining("not linked to Zentla offer"),
      );
    });

    it("should create entitlements from offer config", async () => {
      mockStripeAdapter.listCustomers.mockResolvedValue({
        customers: [],
        hasMore: false,
      });
      mockStripeAdapter.listSubscriptions.mockResolvedValue({
        subscriptions: [mockStripeSubscription],
        hasMore: false,
      });
      providerRefService.findByExternalId
        .mockResolvedValueOnce(null) // subscription check
        .mockResolvedValueOnce({ entityId: "cust_zentla_123" }) // customer ref
        .mockResolvedValueOnce({ entityId: "ver_123" }); // price ref

      prisma.offerVersion.findUnique.mockResolvedValue({
        id: "ver_123",
        offer: { id: "offer_123" },
        config: {
          entitlements: [
            { featureKey: "api_access", value: true, valueType: "boolean" },
          ],
        },
      });
      prisma.subscription.create.mockResolvedValue({
        id: "sub_zentla_123",
      });

      await service.syncFromStripe("ws_123");

      expect(prisma.entitlement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          featureKey: "api_access",
          value: "true",
          valueType: "boolean",
        }),
      });
    });

    it("should handle subscription with trial dates", async () => {
      const subscriptionWithTrial = {
        ...mockStripeSubscription,
        status: "trialing",
        trial_start: 1704067200,
        trial_end: 1705276800,
      };

      mockStripeAdapter.listCustomers.mockResolvedValue({
        customers: [],
        hasMore: false,
      });
      mockStripeAdapter.listSubscriptions.mockResolvedValue({
        subscriptions: [subscriptionWithTrial],
        hasMore: false,
      });
      providerRefService.findByExternalId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ entityId: "cust_zentla_123" })
        .mockResolvedValueOnce({ entityId: "ver_123" });

      prisma.offerVersion.findUnique.mockResolvedValue({
        id: "ver_123",
        offer: { id: "offer_123" },
        config: {},
      });
      prisma.subscription.create.mockResolvedValue({
        id: "sub_zentla_123",
      });

      await service.syncFromStripe("ws_123");

      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "trialing",
          trialStart: expect.any(Date),
          trialEnd: expect.any(Date),
        }),
      });
    });

    it("should handle customer sync errors", async () => {
      mockStripeAdapter.listCustomers.mockResolvedValue({
        customers: [mockStripeCustomer],
        hasMore: false,
      });
      mockStripeAdapter.listSubscriptions.mockResolvedValue({
        subscriptions: [],
        hasMore: false,
      });
      providerRefService.findByExternalId.mockResolvedValue(null);
      prisma.customer.findFirst.mockRejectedValue(new Error("DB error"));

      const result = await service.syncFromStripe("ws_123");

      expect(result.errors).toContainEqual(expect.stringContaining("DB error"));
    });
  });
});
