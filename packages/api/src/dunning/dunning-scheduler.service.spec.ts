import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { DunningSchedulerService } from "./dunning-scheduler.service";
import { DunningService } from "./dunning.service";
import { PrismaService } from "../database/prisma.service";

describe("DunningSchedulerService", () => {
  let scheduler: DunningSchedulerService;
  let prisma: {
    dunningAttempt: {
      findMany: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    invoice: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };
  let dunningService: {
    processDunningAttempt: ReturnType<typeof vi.fn>;
    startDunning: ReturnType<typeof vi.fn>;
  };

  const mockWorkspaceId = "ws_123";
  const mockInvoiceId = "inv_123";

  const mockPendingAttempt = {
    id: "attempt_123",
    workspaceId: mockWorkspaceId,
    invoiceId: mockInvoiceId,
    status: "pending",
    scheduledAt: new Date(Date.now() - 60000), // 1 minute ago
  };

  beforeEach(async () => {
    prisma = {
      dunningAttempt: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      invoice: {
        findMany: vi.fn(),
      },
    };

    dunningService = {
      processDunningAttempt: vi.fn(),
      startDunning: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DunningSchedulerService,
        { provide: PrismaService, useValue: prisma },
        { provide: DunningService, useValue: dunningService },
      ],
    }).compile();

    scheduler = module.get<DunningSchedulerService>(DunningSchedulerService);
  });

  describe("onModuleInit", () => {
    it("should log initialization", () => {
      // Just verify it doesn't throw
      expect(() => scheduler.onModuleInit()).not.toThrow();
    });
  });

  describe("processPendingAttempts", () => {
    it("should process pending attempts", async () => {
      prisma.dunningAttempt.findMany.mockResolvedValue([mockPendingAttempt]);
      dunningService.processDunningAttempt.mockResolvedValue({
        attemptId: "attempt_123",
        success: true,
      });

      await scheduler.processPendingAttempts();

      expect(prisma.dunningAttempt.findMany).toHaveBeenCalledWith({
        where: {
          status: "pending",
          scheduledAt: { lte: expect.any(Date) },
        },
        orderBy: { scheduledAt: "asc" },
        take: 50,
      });
      expect(dunningService.processDunningAttempt).toHaveBeenCalledWith(
        "attempt_123",
      );
    });

    it("should handle empty queue", async () => {
      prisma.dunningAttempt.findMany.mockResolvedValue([]);

      await scheduler.processPendingAttempts();

      expect(dunningService.processDunningAttempt).not.toHaveBeenCalled();
    });

    it("should process multiple attempts in parallel", async () => {
      const attempts = [
        { ...mockPendingAttempt, id: "attempt_1" },
        { ...mockPendingAttempt, id: "attempt_2" },
        { ...mockPendingAttempt, id: "attempt_3" },
      ];
      prisma.dunningAttempt.findMany.mockResolvedValue(attempts);
      dunningService.processDunningAttempt.mockResolvedValue({
        success: true,
      });

      await scheduler.processPendingAttempts();

      expect(dunningService.processDunningAttempt).toHaveBeenCalledTimes(3);
    });

    it("should handle failures gracefully", async () => {
      prisma.dunningAttempt.findMany.mockResolvedValue([mockPendingAttempt]);
      dunningService.processDunningAttempt.mockRejectedValue(
        new Error("Processing failed"),
      );

      // Should not throw
      await expect(scheduler.processPendingAttempts()).resolves.not.toThrow();
    });

    it("should not process if already processing", async () => {
      // Simulate concurrent calls
      prisma.dunningAttempt.findMany.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve([mockPendingAttempt]), 100),
          ),
      );
      dunningService.processDunningAttempt.mockResolvedValue({ success: true });

      // Start first processing
      const firstCall = scheduler.processPendingAttempts();

      // Try to start second processing immediately
      const secondCall = scheduler.processPendingAttempts();

      await Promise.all([firstCall, secondCall]);

      // Should only have processed once
      expect(prisma.dunningAttempt.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("checkForMissedDunningCandidates", () => {
    it("should find and start dunning for missed invoices", async () => {
      const missedInvoice = {
        id: mockInvoiceId,
        workspaceId: mockWorkspaceId,
      };
      prisma.invoice.findMany.mockResolvedValue([missedInvoice]);
      dunningService.startDunning.mockResolvedValue(undefined);

      await scheduler.checkForMissedDunningCandidates();

      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        where: {
          status: "open",
          dueDate: { lt: expect.any(Date) },
          dunningStartedAt: null,
          subscriptionId: { not: null },
        },
        select: { id: true, workspaceId: true },
        take: 20,
      });
      expect(dunningService.startDunning).toHaveBeenCalledWith(
        mockWorkspaceId,
        mockInvoiceId,
      );
    });

    it("should handle empty results", async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      await scheduler.checkForMissedDunningCandidates();

      expect(dunningService.startDunning).not.toHaveBeenCalled();
    });

    it("should continue processing even if one fails", async () => {
      const invoices = [
        { id: "inv_1", workspaceId: mockWorkspaceId },
        { id: "inv_2", workspaceId: mockWorkspaceId },
      ];
      prisma.invoice.findMany.mockResolvedValue(invoices);
      dunningService.startDunning
        .mockRejectedValueOnce(new Error("Failed"))
        .mockResolvedValueOnce(undefined);

      await scheduler.checkForMissedDunningCandidates();

      expect(dunningService.startDunning).toHaveBeenCalledTimes(2);
    });
  });

  describe("cleanupStaleAttempts", () => {
    it("should reset stale processing attempts", async () => {
      prisma.dunningAttempt.updateMany.mockResolvedValue({ count: 2 });

      await scheduler.cleanupStaleAttempts();

      expect(prisma.dunningAttempt.updateMany).toHaveBeenCalledWith({
        where: {
          status: "processing",
          executedAt: { lt: expect.any(Date) },
        },
        data: {
          status: "pending",
          executedAt: null,
        },
      });
    });

    it("should handle no stale attempts", async () => {
      prisma.dunningAttempt.updateMany.mockResolvedValue({ count: 0 });

      await scheduler.cleanupStaleAttempts();

      // Should complete without error
      expect(prisma.dunningAttempt.updateMany).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      prisma.dunningAttempt.updateMany.mockRejectedValue(
        new Error("Database error"),
      );

      // Should not throw
      await expect(scheduler.cleanupStaleAttempts()).resolves.not.toThrow();
    });
  });
});
