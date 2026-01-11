import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { StripeWebhookService } from "./stripe-webhook.service";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";
import { ProviderRefService } from "../billing/provider-ref.service";
import { OutboxService } from "./outbox.service";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { InvoicesService } from "../invoices/invoices.service";
import { RefundsService } from "../refunds/refunds.service";
import { CreditsService } from "../credits/credits.service";
import { DunningService } from "../dunning/dunning.service";

describe("StripeWebhookService", () => {
  let service: StripeWebhookService;
  let prisma: {
    workspace: { findUnique: ReturnType<typeof vi.fn> };
    processedProviderEvent: {
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    providerRef: { findFirst: ReturnType<typeof vi.fn> };
    subscription: { update: ReturnType<typeof vi.fn> };
  };
  let billingService: {
    getProvider: ReturnType<typeof vi.fn>;
    getProviderForWorkspace: ReturnType<typeof vi.fn>;
  };
  let providerRefService: {
    findByExternalId: ReturnType<typeof vi.fn>;
  };
  let outboxService: {
    createEvent: ReturnType<typeof vi.fn>;
  };

  const mockStripeAdapter = {
    verifyWebhook: vi.fn().mockReturnValue(true),
    parseWebhookEvent: vi.fn(),
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
      subscription: { update: vi.fn() },
    };

    billingService = {
      getProvider: vi.fn().mockReturnValue(mockStripeAdapter),
      getProviderForWorkspace: vi.fn().mockReturnValue(mockStripeAdapter),
    };

    providerRefService = {
      findByExternalId: vi.fn(),
    };

    outboxService = {
      createEvent: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeWebhookService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingService, useValue: billingService },
        { provide: ProviderRefService, useValue: providerRefService },
        { provide: OutboxService, useValue: outboxService },
        { provide: EntitlementsService, useValue: {} },
        { provide: InvoicesService, useValue: {} },
        { provide: RefundsService, useValue: {} },
        { provide: CreditsService, useValue: { autoApplyToInvoice: vi.fn() } },
        { provide: DunningService, useValue: {} },
      ],
    }).compile();

    service = module.get<StripeWebhookService>(StripeWebhookService);
  });

  describe("handleSubscriptionUpdated", () => {
    it("should handle subscription.updated with null period dates", async () => {
      // Mock the Stripe event with undefined period dates
      const stripeEvent = {
        id: "evt_test_123",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_123",
            status: "active",
            current_period_start: undefined, // null/undefined period
            current_period_end: undefined, // null/undefined period
            cancel_at: null,
            canceled_at: null,
            metadata: { zentla_workspace_id: "ws_123" },
            items: { data: [{ price: { id: "price_123" } }] },
          },
        },
      };

      mockStripeAdapter.parseWebhookEvent.mockReturnValue(stripeEvent);

      // Mock finding the subscription ref
      prisma.providerRef.findFirst.mockResolvedValue({
        workspaceId: "ws_123",
        entityId: "sub_zentla_123",
        entityType: "subscription",
        externalId: "sub_123",
      });

      // Mock the subscription update
      prisma.subscription.update.mockResolvedValue({
        id: "sub_zentla_123",
        customerId: "cust_123",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAt: null,
        metadata: {},
      });

      // Process the webhook - should not throw
      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(stripeEvent)),
        "test_signature",
      );

      expect(result.received).toBe(true);

      // Verify subscription.update was called without invalid dates
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub_zentla_123" },
        data: expect.objectContaining({
          status: "active",
          // Should NOT include currentPeriodStart or currentPeriodEnd
          // since they were undefined in the Stripe event
          cancelAt: null,
          canceledAt: null,
        }),
      });

      // Verify the update data does NOT contain Invalid Date
      const updateCall = prisma.subscription.update.mock.calls[0][0];
      expect(updateCall.data.currentPeriodStart).toBeUndefined();
      expect(updateCall.data.currentPeriodEnd).toBeUndefined();
    });

    it("should handle subscription.updated with valid period dates", async () => {
      const periodStart = 1704067200; // 2024-01-01
      const periodEnd = 1706745600; // 2024-02-01

      const stripeEvent = {
        id: "evt_test_456",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_456",
            customer: "cus_456",
            status: "active",
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancel_at: null,
            canceled_at: null,
            metadata: { zentla_workspace_id: "ws_123" },
            items: { data: [{ price: { id: "price_123" } }] },
          },
        },
      };

      mockStripeAdapter.parseWebhookEvent.mockReturnValue(stripeEvent);

      prisma.providerRef.findFirst.mockResolvedValue({
        workspaceId: "ws_123",
        entityId: "sub_zentla_456",
        entityType: "subscription",
        externalId: "sub_456",
      });

      prisma.subscription.update.mockResolvedValue({
        id: "sub_zentla_456",
        customerId: "cust_456",
        status: "active",
        currentPeriodStart: new Date(periodStart * 1000),
        currentPeriodEnd: new Date(periodEnd * 1000),
        cancelAt: null,
        metadata: {},
      });

      const result = await service.processWebhook(
        Buffer.from(JSON.stringify(stripeEvent)),
        "test_signature",
      );

      expect(result.received).toBe(true);

      // Verify subscription.update was called with valid dates
      const updateCall = prisma.subscription.update.mock.calls[0][0];
      expect(updateCall.data.currentPeriodStart).toEqual(
        new Date(periodStart * 1000),
      );
      expect(updateCall.data.currentPeriodEnd).toEqual(
        new Date(periodEnd * 1000),
      );
    });
  });
});
