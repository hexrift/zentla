import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { DunningService } from "./dunning.service";
import { DunningConfigService } from "./dunning-config.service";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";
import { OutboxService } from "../webhooks/outbox.service";
import { EmailService } from "../email/email.service";

describe("DunningService", () => {
  let service: DunningService;
  let prisma: {
    invoice: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    dunningAttempt: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
    subscription: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    workspace: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let billingService: {
    getProviderForWorkspace: ReturnType<typeof vi.fn>;
  };
  let outboxService: {
    createEvent: ReturnType<typeof vi.fn>;
  };
  let dunningConfigService: {
    getConfig: ReturnType<typeof vi.fn>;
    getRawConfig: ReturnType<typeof vi.fn>;
    calculateNextRetryDate: ReturnType<typeof vi.fn>;
    isMaxAttemptsReached: ReturnType<typeof vi.fn>;
  };
  let emailService: {
    sendDunningEmail: ReturnType<typeof vi.fn>;
    isConfigured: ReturnType<typeof vi.fn>;
  };

  const mockWorkspaceId = "ws_123";
  const mockInvoiceId = "inv_123";
  const mockCustomerId = "cust_123";
  const mockSubscriptionId = "sub_123";

  const mockInvoice = {
    id: mockInvoiceId,
    workspaceId: mockWorkspaceId,
    customerId: mockCustomerId,
    subscriptionId: mockSubscriptionId,
    amountDue: 1000,
    currency: "usd",
    status: "open" as const,
    provider: "stripe" as const,
    providerInvoiceId: "in_stripe_123",
    dunningStartedAt: null,
    dunningEndedAt: null,
    dunningAttemptCount: 0,
    nextDunningAttemptAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockConfig = {
    id: "config_123",
    workspaceId: mockWorkspaceId,
    retrySchedule: [1, 3, 5, 7],
    maxAttempts: 4,
    finalAction: "suspend" as const,
    gracePeriodDays: 0,
    emailsEnabled: true,
    fromEmail: "billing@example.com",
    fromName: "Billing Team",
    replyToEmail: "support@example.com",
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDunningAttempt = {
    id: "attempt_123",
    workspaceId: mockWorkspaceId,
    invoiceId: mockInvoiceId,
    subscriptionId: mockSubscriptionId,
    customerId: mockCustomerId,
    attemptNumber: 1,
    status: "pending" as const,
    scheduledAt: new Date(),
    executedAt: null,
    success: null,
    failureReason: null,
    declineCode: null,
    metadata: {},
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      invoice: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn(),
      },
      dunningAttempt: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        groupBy: vi.fn(),
      },
      subscription: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      workspace: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prisma)),
    };

    billingService = {
      getProviderForWorkspace: vi.fn(),
    };

    outboxService = {
      createEvent: vi.fn().mockResolvedValue(undefined),
    };

    dunningConfigService = {
      getConfig: vi.fn().mockResolvedValue(mockConfig),
      getRawConfig: vi.fn().mockResolvedValue(mockConfig),
      calculateNextRetryDate: vi.fn(),
      isMaxAttemptsReached: vi.fn(),
    };

    emailService = {
      sendDunningEmail: vi.fn().mockResolvedValue("email_123"),
      isConfigured: vi.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DunningService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingService, useValue: billingService },
        { provide: OutboxService, useValue: outboxService },
        { provide: DunningConfigService, useValue: dunningConfigService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<DunningService>(DunningService);
  });

  describe("startDunning", () => {
    it("should start dunning for an open invoice", async () => {
      const firstRetryDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        customer: { name: "Test Customer", email: "test@example.com" },
      });
      dunningConfigService.calculateNextRetryDate.mockReturnValue(
        firstRetryDate,
      );

      await service.startDunning(mockWorkspaceId, mockInvoiceId);

      expect(prisma.invoice.update).toHaveBeenCalled();
      expect(prisma.dunningAttempt.create).toHaveBeenCalled();
      expect(outboxService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "dunning.started",
          aggregateId: mockInvoiceId,
        }),
      );
      expect(emailService.sendDunningEmail).toHaveBeenCalled();
    });

    it("should throw NotFoundException when invoice not found", async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.startDunning(mockWorkspaceId, mockInvoiceId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should skip if invoice already in dunning", async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...mockInvoice,
        dunningStartedAt: new Date(),
      });

      await service.startDunning(mockWorkspaceId, mockInvoiceId);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("should skip if invoice is not open", async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...mockInvoice,
        status: "paid",
      });

      await service.startDunning(mockWorkspaceId, mockInvoiceId);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("should not send email if emails disabled", async () => {
      const firstRetryDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      dunningConfigService.calculateNextRetryDate.mockReturnValue(
        firstRetryDate,
      );
      dunningConfigService.getConfig.mockResolvedValue({
        ...mockConfig,
        emailsEnabled: false,
      });

      await service.startDunning(mockWorkspaceId, mockInvoiceId);

      expect(emailService.sendDunningEmail).not.toHaveBeenCalled();
    });
  });

  describe("processDunningAttempt", () => {
    it("should process pending attempt and succeed on payment", async () => {
      prisma.dunningAttempt.findUnique.mockResolvedValue(mockDunningAttempt);
      prisma.dunningAttempt.updateMany.mockResolvedValue({ count: 1 });
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.workspace.findUnique.mockResolvedValue({
        id: mockWorkspaceId,
        settings: {},
      });

      const mockProvider = {
        payInvoice: vi.fn().mockResolvedValue(undefined),
      };
      billingService.getProviderForWorkspace.mockReturnValue(mockProvider);

      const result = await service.processDunningAttempt("attempt_123");

      expect(result.success).toBe(true);
      expect(mockProvider.payInvoice).toHaveBeenCalled();
    });

    it("should throw NotFoundException when attempt not found", async () => {
      prisma.dunningAttempt.findUnique.mockResolvedValue(null);

      await expect(
        service.processDunningAttempt("nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should skip non-pending attempts", async () => {
      prisma.dunningAttempt.findUnique.mockResolvedValue({
        ...mockDunningAttempt,
        status: "succeeded",
      });

      const result = await service.processDunningAttempt("attempt_123");

      expect(result.success).toBe(true);
      expect(billingService.getProviderForWorkspace).not.toHaveBeenCalled();
    });

    it("should handle race condition gracefully", async () => {
      prisma.dunningAttempt.findUnique
        .mockResolvedValueOnce(mockDunningAttempt)
        .mockResolvedValueOnce({ ...mockDunningAttempt, status: "succeeded" });
      prisma.dunningAttempt.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.processDunningAttempt("attempt_123");

      expect(result.success).toBe(true);
    });

    it("should handle payment failure and schedule next attempt", async () => {
      const nextRetryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      prisma.dunningAttempt.findUnique.mockResolvedValue(mockDunningAttempt);
      prisma.dunningAttempt.updateMany.mockResolvedValue({ count: 1 });
      prisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        dunningStartedAt: new Date(),
        customer: { name: "Test", email: "test@example.com" },
      });
      prisma.workspace.findUnique.mockResolvedValue({
        id: mockWorkspaceId,
        settings: {},
      });

      const mockProvider = {
        payInvoice: vi.fn().mockRejectedValue(new Error("Card declined")),
      };
      billingService.getProviderForWorkspace.mockReturnValue(mockProvider);
      dunningConfigService.isMaxAttemptsReached.mockReturnValue(false);
      dunningConfigService.calculateNextRetryDate.mockReturnValue(
        nextRetryDate,
      );

      const result = await service.processDunningAttempt("attempt_123");

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe("Card declined");
      expect(result.nextAttemptAt).toEqual(nextRetryDate);
    });
  });

  describe("handlePaymentSuccess", () => {
    it("should end dunning and reactivate subscription", async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...mockInvoice,
        subscriptionId: mockSubscriptionId,
      });
      prisma.subscription.findUnique.mockResolvedValue({
        id: mockSubscriptionId,
        status: "payment_failed",
      });
      prisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        customer: { name: "Test", email: "test@example.com" },
      });

      await service.handlePaymentSuccess(mockWorkspaceId, mockInvoiceId);

      expect(prisma.invoice.update).toHaveBeenCalled();
      expect(prisma.dunningAttempt.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscriptionId },
        data: { status: "active" },
      });
      expect(outboxService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "dunning.attempt_succeeded",
        }),
      );
    });
  });

  describe("executeFinalAction", () => {
    it("should suspend subscription after all retries exhausted", async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        customer: { name: "Test", email: "test@example.com" },
      });

      await service.executeFinalAction(
        mockWorkspaceId,
        mockInvoiceId,
        mockSubscriptionId,
        "suspend",
      );

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscriptionId },
        data: { status: "suspended" },
      });
      expect(outboxService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "subscription.suspended",
        }),
      );
    });

    it("should cancel subscription when final action is cancel", async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        customer: { name: "Test", email: "test@example.com" },
      });

      await service.executeFinalAction(
        mockWorkspaceId,
        mockInvoiceId,
        mockSubscriptionId,
        "cancel",
      );

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscriptionId },
        data: { status: "canceled" },
      });
      expect(outboxService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "subscription.canceled",
        }),
      );
    });
  });

  describe("stopDunning", () => {
    it("should stop dunning for an invoice", async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...mockInvoice,
        dunningStartedAt: new Date(),
        dunningEndedAt: null,
      });

      await service.stopDunning(
        mockWorkspaceId,
        mockInvoiceId,
        "Customer paid",
      );

      expect(prisma.invoice.update).toHaveBeenCalled();
      expect(prisma.dunningAttempt.updateMany).toHaveBeenCalled();
      expect(outboxService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "dunning.ended",
        }),
      );
    });

    it("should throw NotFoundException when invoice not found", async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.stopDunning(mockWorkspaceId, mockInvoiceId, "reason"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should do nothing if not in dunning", async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...mockInvoice,
        dunningStartedAt: null,
      });

      await service.stopDunning(mockWorkspaceId, mockInvoiceId, "reason");

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("triggerManualRetry", () => {
    it("should trigger manual payment retry", async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.workspace.findUnique.mockResolvedValue({
        id: mockWorkspaceId,
        settings: {},
      });

      const mockProvider = {
        payInvoice: vi.fn().mockResolvedValue(undefined),
      };
      billingService.getProviderForWorkspace.mockReturnValue(mockProvider);

      const result = await service.triggerManualRetry(
        mockWorkspaceId,
        mockInvoiceId,
      );

      expect(result.success).toBe(true);
      expect(result.attemptId).toBe("manual");
    });

    it("should fail if invoice is not open", async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...mockInvoice,
        status: "paid",
      });

      const result = await service.triggerManualRetry(
        mockWorkspaceId,
        mockInvoiceId,
      );

      expect(result.success).toBe(false);
      expect(result.failureReason).toContain("paid");
    });
  });

  describe("getInvoicesInDunning", () => {
    it("should return paginated invoices in dunning", async () => {
      const mockInvoices = [
        {
          ...mockInvoice,
          dunningStartedAt: new Date(),
          customer: {
            id: mockCustomerId,
            email: "test@example.com",
            name: "Test",
          },
        },
      ];
      prisma.invoice.findMany.mockResolvedValue(mockInvoices);

      const result = await service.getInvoicesInDunning(mockWorkspaceId, {
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("getDunningStats", () => {
    it("should return dunning statistics", async () => {
      prisma.invoice.aggregate.mockResolvedValue({
        _count: 5,
        _sum: { amountDue: 10000 },
      });
      prisma.dunningAttempt.groupBy.mockResolvedValue([
        { status: "pending", _count: 3 },
        { status: "succeeded", _count: 10 },
        { status: "failed", _count: 5 },
      ]);

      const result = await service.getDunningStats(mockWorkspaceId);

      expect(result.invoicesInDunning).toBe(5);
      expect(result.totalAmountAtRisk).toBe(10000);
      expect(result.attemptsByStatus.pending).toBe(3);
      expect(result.attemptsByStatus.succeeded).toBe(10);
      expect(result.attemptsByStatus.failed).toBe(5);
      expect(result.recoveryRate).toBeGreaterThan(0);
    });
  });
});
