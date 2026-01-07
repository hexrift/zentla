import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ZuoraWebhookService } from "./zuora-webhook.service";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";
import { ProviderRefService } from "../billing/provider-ref.service";
import { OutboxService } from "./outbox.service";

describe("ZuoraWebhookService", () => {
  let service: ZuoraWebhookService;
  let prisma: {
    workspace: { findUnique: ReturnType<typeof vi.fn> };
    processedProviderEvent: {
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    providerRef: { findFirst: ReturnType<typeof vi.fn> };
    subscription: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    offerVersion: { findUnique: ReturnType<typeof vi.fn> };
    entitlement: {
      create: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };
  let billingService: {
    getProviderForWorkspace: ReturnType<typeof vi.fn>;
  };
  let providerRefService: {
    findByExternalId: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let outboxService: {
    createEvent: ReturnType<typeof vi.fn>;
  };

  const mockZuoraAdapter = {
    verifyWebhook: vi.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    prisma = {
      workspace: { findUnique: vi.fn() },
      processedProviderEvent: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      providerRef: { findFirst: vi.fn() },
      subscription: {
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      offerVersion: { findUnique: vi.fn() },
      entitlement: {
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    billingService = {
      getProviderForWorkspace: vi.fn().mockReturnValue(mockZuoraAdapter),
    };

    providerRefService = {
      findByExternalId: vi.fn(),
      create: vi.fn(),
    };

    outboxService = {
      createEvent: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZuoraWebhookService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingService, useValue: billingService },
        { provide: ProviderRefService, useValue: providerRefService },
        { provide: OutboxService, useValue: outboxService },
      ],
    }).compile();

    service = module.get<ZuoraWebhookService>(ZuoraWebhookService);
  });

  describe("processWebhook", () => {
    it("should skip duplicate events (idempotency)", async () => {
      const event = {
        type: "SubscriptionCreated",
        id: "evt_zuora_123",
        accountId: "acc_123",
        subscriptionId: "sub_123",
      };

      // Mock finding an existing processed event
      prisma.processedProviderEvent.findFirst.mockResolvedValue({
        id: "processed_1",
        provider: "zuora",
        providerEventId: "evt_zuora_123",
        eventType: "SubscriptionCreated",
      });

      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(event)),
        "test_signature",
      );

      expect(result.received).toBe(true);
      expect(result.eventId).toBe("evt_zuora_123");
      // Should not create subscription for duplicate event
      expect(prisma.subscription.create).not.toHaveBeenCalled();
    });

    it("should throw on invalid JSON payload", async () => {
      await expect(
        service.processWebhook(Buffer.from("invalid json"), "test_signature"),
      ).rejects.toThrow("Invalid webhook payload");
    });

    it("should throw on invalid signature when workspace has webhook secret", async () => {
      const event = {
        type: "SubscriptionCreated",
        id: "evt_123",
        accountId: "acc_123",
        subscriptionId: "sub_123",
      };

      // Mock finding customer ref -> workspace
      prisma.providerRef.findFirst.mockResolvedValue({
        workspaceId: "ws_123",
        entityId: "cust_zentla_123",
        entityType: "customer",
        externalId: "acc_123",
      });

      // Mock workspace with webhook secret
      prisma.workspace.findUnique.mockResolvedValue({
        id: "ws_123",
        settings: {
          zuoraClientId: "client_123",
          zuoraClientSecret: "secret",
          zuoraBaseUrl: "https://sandbox.zuora.com",
          zuoraWebhookSecret: "webhook_secret",
        },
      });

      // Mock adapter returning invalid signature
      mockZuoraAdapter.verifyWebhook.mockReturnValue(false);

      await expect(
        service.processWebhook(
          Buffer.from(JSON.stringify(event)),
          "invalid_sig",
        ),
      ).rejects.toThrow("Invalid webhook signature");
    });
  });

  describe("handleSubscriptionCreated", () => {
    const createSubscriptionEvent = (overrides = {}) => ({
      type: "SubscriptionCreated",
      id: "evt_sub_created_123",
      accountId: "acc_123",
      subscriptionId: "sub_zuora_123",
      data: {
        ratePlanId: "rp_123",
        termStartDate: "2024-01-01",
        termEndDate: "2024-02-01",
        status: "Active",
      },
      ...overrides,
    });

    it("should create subscription from webhook event", async () => {
      const event = createSubscriptionEvent();

      // Mock workspace lookup via customer ref
      prisma.providerRef.findFirst.mockImplementation((args) => {
        if (args.where.entityType === "customer") {
          return Promise.resolve({
            workspaceId: "ws_123",
            entityId: "cust_zentla_123",
            entityType: "customer",
            externalId: "acc_123",
          });
        }
        return Promise.resolve(null);
      });

      prisma.workspace.findUnique.mockResolvedValue({
        id: "ws_123",
        settings: {},
      });

      // Mock no existing subscription ref
      providerRefService.findByExternalId.mockImplementation(
        (_wsId, _provider, entityType, _extId) => {
          if (entityType === "subscription") return Promise.resolve(null);
          if (entityType === "customer") {
            return Promise.resolve({
              workspaceId: "ws_123",
              entityId: "cust_zentla_123",
            });
          }
          if (entityType === "price") {
            return Promise.resolve({
              workspaceId: "ws_123",
              entityId: "offer_version_123",
            });
          }
          return Promise.resolve(null);
        },
      );

      // Mock offer version lookup
      prisma.offerVersion.findUnique.mockResolvedValue({
        id: "offer_version_123",
        offer: { id: "offer_123" },
        config: {
          entitlements: [
            { featureKey: "api_calls", value: 1000, valueType: "number" },
          ],
        },
      });

      // Mock subscription creation
      prisma.subscription.create.mockResolvedValue({
        id: "sub_zentla_123",
        workspaceId: "ws_123",
        customerId: "cust_zentla_123",
        offerId: "offer_123",
        offerVersionId: "offer_version_123",
        status: "active",
        currentPeriodStart: new Date("2024-01-01"),
        currentPeriodEnd: new Date("2024-02-01"),
      });

      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(event)),
        "test_signature",
      );

      expect(result.received).toBe(true);
      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws_123",
          customerId: "cust_zentla_123",
          offerId: "offer_123",
          status: "active",
        }),
      });
      expect(providerRefService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "subscription",
          provider: "zuora",
          externalId: "sub_zuora_123",
        }),
      );
      expect(prisma.entitlement.create).toHaveBeenCalled();
      expect(outboxService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "subscription.created",
        }),
      );
    });

    it("should skip if subscription already exists", async () => {
      const event = createSubscriptionEvent();

      prisma.providerRef.findFirst.mockResolvedValue({
        workspaceId: "ws_123",
        entityId: "cust_zentla_123",
        entityType: "customer",
        externalId: "acc_123",
      });

      prisma.workspace.findUnique.mockResolvedValue({
        id: "ws_123",
        settings: {},
      });

      // Mock existing subscription ref
      providerRefService.findByExternalId.mockImplementation(
        (_wsId, _provider, entityType, _extId) => {
          if (entityType === "subscription") {
            return Promise.resolve({
              workspaceId: "ws_123",
              entityId: "existing_sub_123",
              entityType: "subscription",
              externalId: "sub_zuora_123",
            });
          }
          return Promise.resolve(null);
        },
      );

      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(event)),
        "test_signature",
      );

      expect(result.received).toBe(true);
      expect(prisma.subscription.create).not.toHaveBeenCalled();
    });

    it("should handle missing accountId gracefully", async () => {
      const event = {
        type: "SubscriptionCreated",
        id: "evt_123",
        subscriptionId: "sub_123",
        // accountId is missing
      };

      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(event)),
        "test_signature",
      );

      expect(result.received).toBe(true);
      expect(prisma.subscription.create).not.toHaveBeenCalled();
    });

    it("should handle missing subscriptionId gracefully", async () => {
      const event = {
        type: "SubscriptionCreated",
        id: "evt_123",
        accountId: "acc_123",
        // subscriptionId is missing
      };

      prisma.providerRef.findFirst.mockResolvedValue(null);

      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(event)),
        "test_signature",
      );

      expect(result.received).toBe(true);
      expect(prisma.subscription.create).not.toHaveBeenCalled();
    });
  });

  describe("handleSubscriptionUpdated", () => {
    it("should update subscription status", async () => {
      const event = {
        type: "SubscriptionUpdated",
        id: "evt_sub_updated_123",
        subscriptionId: "sub_zuora_123",
        data: {
          status: "Cancelled",
          termEndDate: "2024-03-01",
          cancelledDate: "2024-02-15",
        },
      };

      // Mock finding subscription ref
      prisma.providerRef.findFirst.mockResolvedValue({
        workspaceId: "ws_123",
        entityId: "sub_zentla_123",
        entityType: "subscription",
        externalId: "sub_zuora_123",
      });

      prisma.subscription.update.mockResolvedValue({
        id: "sub_zentla_123",
        status: "canceled",
        currentPeriodEnd: new Date("2024-03-01"),
        canceledAt: new Date("2024-02-15"),
      });

      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(event)),
        "test_signature",
      );

      expect(result.received).toBe(true);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub_zentla_123" },
        data: expect.objectContaining({
          status: "canceled",
        }),
      });
      expect(outboxService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "subscription.updated",
        }),
      );
    });

    it("should handle unknown subscription gracefully", async () => {
      const event = {
        type: "SubscriptionUpdated",
        id: "evt_123",
        subscriptionId: "unknown_sub_123",
        data: { status: "Active" },
      };

      prisma.providerRef.findFirst.mockResolvedValue(null);

      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(event)),
        "test_signature",
      );

      expect(result.received).toBe(true);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it("should map Zuora statuses correctly", async () => {
      const statusMappings = [
        { zuora: "Active", zentla: "active" },
        { zuora: "Cancelled", zentla: "canceled" },
        { zuora: "Expired", zentla: "canceled" },
        { zuora: "Suspended", zentla: "paused" },
      ];

      for (const mapping of statusMappings) {
        vi.clearAllMocks();

        const event = {
          type: "SubscriptionUpdated",
          id: `evt_status_${mapping.zuora}`,
          subscriptionId: "sub_zuora_123",
          data: { status: mapping.zuora },
        };

        prisma.providerRef.findFirst.mockResolvedValue({
          workspaceId: "ws_123",
          entityId: "sub_zentla_123",
          entityType: "subscription",
          externalId: "sub_zuora_123",
        });

        prisma.subscription.update.mockResolvedValue({
          id: "sub_zentla_123",
          status: mapping.zentla,
        });

        await service.processWebhook(
          Buffer.from(JSON.stringify(event)),
          "test_signature",
        );

        expect(prisma.subscription.update).toHaveBeenCalledWith({
          where: { id: "sub_zentla_123" },
          data: expect.objectContaining({
            status: mapping.zentla,
          }),
        });
      }
    });
  });

  describe("handleSubscriptionCancelled", () => {
    it("should cancel subscription and revoke entitlements", async () => {
      const event = {
        type: "SubscriptionCancelled",
        id: "evt_sub_cancelled_123",
        subscriptionId: "sub_zuora_123",
      };

      prisma.providerRef.findFirst.mockResolvedValue({
        workspaceId: "ws_123",
        entityId: "sub_zentla_123",
        entityType: "subscription",
        externalId: "sub_zuora_123",
      });

      prisma.subscription.update.mockResolvedValue({
        id: "sub_zentla_123",
        status: "canceled",
        canceledAt: expect.any(Date),
      });

      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(event)),
        "test_signature",
      );

      expect(result.received).toBe(true);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub_zentla_123" },
        data: {
          status: "canceled",
          canceledAt: expect.any(Date),
        },
      });
      expect(prisma.entitlement.deleteMany).toHaveBeenCalledWith({
        where: { subscriptionId: "sub_zentla_123" },
      });
      expect(outboxService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "subscription.canceled",
        }),
      );
    });
  });

  describe("handlePaymentSuccess", () => {
    it("should emit invoice.paid event", async () => {
      const event = {
        type: "PaymentSuccess",
        id: "evt_payment_123",
        accountId: "acc_123",
        invoiceId: "inv_zuora_123",
      };

      prisma.providerRef.findFirst.mockResolvedValue({
        workspaceId: "ws_123",
        entityId: "cust_zentla_123",
        entityType: "customer",
        externalId: "acc_123",
      });

      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(event)),
        "test_signature",
      );

      expect(result.received).toBe(true);
      expect(outboxService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "invoice.paid",
          workspaceId: "ws_123",
          payload: expect.objectContaining({
            invoiceId: "inv_zuora_123",
            customerId: "cust_zentla_123",
          }),
        }),
      );
    });

    it("should handle missing accountId gracefully", async () => {
      const event = {
        type: "PaymentSuccess",
        id: "evt_payment_123",
        invoiceId: "inv_123",
        // accountId is missing
      };

      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(event)),
        "test_signature",
      );

      expect(result.received).toBe(true);
      expect(outboxService.createEvent).not.toHaveBeenCalled();
    });
  });

  describe("handlePaymentFailed", () => {
    it("should update subscriptions to payment_failed status", async () => {
      const event = {
        type: "PaymentFailed",
        id: "evt_payment_failed_123",
        accountId: "acc_123",
        invoiceId: "inv_zuora_123",
      };

      prisma.providerRef.findFirst.mockResolvedValue({
        workspaceId: "ws_123",
        entityId: "cust_zentla_123",
        entityType: "customer",
        externalId: "acc_123",
      });

      prisma.subscription.findMany.mockResolvedValue([
        { id: "sub_1", status: "active" },
        { id: "sub_2", status: "active" },
      ]);

      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(event)),
        "test_signature",
      );

      expect(result.received).toBe(true);
      expect(prisma.subscription.findMany).toHaveBeenCalledWith({
        where: {
          customerId: "cust_zentla_123",
          status: "active",
        },
      });
      // Should update each active subscription
      expect(prisma.subscription.update).toHaveBeenCalledTimes(2);
      expect(outboxService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "invoice.payment_failed",
        }),
      );
    });
  });

  describe("unhandled event types", () => {
    it("should process unhandled event types without error", async () => {
      const event = {
        type: "UnknownEventType",
        id: "evt_unknown_123",
        data: { foo: "bar" },
      };

      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(event)),
        "test_signature",
      );

      expect(result.received).toBe(true);
      // Should still record the event as processed
      expect(prisma.processedProviderEvent.create).toHaveBeenCalledWith({
        data: {
          provider: "zuora",
          providerEventId: "evt_unknown_123",
          eventType: "UnknownEventType",
        },
      });
    });
  });

  describe("event ID generation", () => {
    it("should generate event ID if not provided in payload", async () => {
      const event = {
        type: "SubscriptionUpdated",
        // id is missing
        subscriptionId: "sub_123",
        data: { status: "Active" },
      };

      prisma.providerRef.findFirst.mockResolvedValue(null);

      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(event)),
        "test_signature",
      );

      expect(result.received).toBe(true);
      expect(result.eventId).toMatch(/^zuora_\d+_[a-z0-9]+$/);
    });
  });
});
