import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { DunningController } from "./dunning.controller";
import { DunningService } from "./dunning.service";
import { DunningConfigService } from "./dunning-config.service";

describe("DunningController", () => {
  let controller: DunningController;
  let dunningService: {
    getInvoicesInDunning: ReturnType<typeof vi.fn>;
    getDunningStats: ReturnType<typeof vi.fn>;
    triggerManualRetry: ReturnType<typeof vi.fn>;
    stopDunning: ReturnType<typeof vi.fn>;
  };
  let dunningConfigService: {
    getConfig: ReturnType<typeof vi.fn>;
    upsertConfig: ReturnType<typeof vi.fn>;
  };

  const mockWorkspaceId = "ws_123";

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

  const mockInvoice = {
    id: "inv_123",
    workspaceId: mockWorkspaceId,
    customerId: "cust_123",
    amountDue: 1000,
    currency: "usd",
    status: "open",
    dunningStartedAt: new Date(),
    dunningAttemptCount: 2,
    nextDunningAttemptAt: new Date(Date.now() + 86400000),
    customer: {
      id: "cust_123",
      email: "test@example.com",
      name: "Test User",
    },
  };

  const mockStats = {
    invoicesInDunning: 5,
    totalAmountAtRisk: 50000,
    currency: "usd",
    recoveryRate: 66.67,
    attemptsByStatus: {
      pending: 3,
      succeeded: 10,
      failed: 5,
    },
  };

  beforeEach(async () => {
    dunningService = {
      getInvoicesInDunning: vi.fn(),
      getDunningStats: vi.fn(),
      triggerManualRetry: vi.fn(),
      stopDunning: vi.fn(),
    };

    dunningConfigService = {
      getConfig: vi.fn(),
      upsertConfig: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DunningController],
      providers: [
        { provide: DunningService, useValue: dunningService },
        { provide: DunningConfigService, useValue: dunningConfigService },
      ],
    }).compile();

    controller = module.get<DunningController>(DunningController);
  });

  describe("getConfig", () => {
    it("should return dunning configuration", async () => {
      dunningConfigService.getConfig.mockResolvedValue(mockConfig);

      const result = await controller.getConfig(mockWorkspaceId);

      expect(result).toEqual(mockConfig);
      expect(dunningConfigService.getConfig).toHaveBeenCalledWith(
        mockWorkspaceId,
      );
    });

    it("should return default config when none exists", async () => {
      dunningConfigService.getConfig.mockResolvedValue({
        ...mockConfig,
        isDefault: true,
      });

      const result = await controller.getConfig(mockWorkspaceId);

      expect(result.isDefault).toBe(true);
    });
  });

  describe("updateConfig", () => {
    it("should update dunning configuration", async () => {
      const updateData = {
        retrySchedule: [1, 2, 3],
        maxAttempts: 3,
        finalAction: "cancel" as const,
      };
      dunningConfigService.upsertConfig.mockResolvedValue({
        ...mockConfig,
        ...updateData,
      });

      const result = await controller.updateConfig(mockWorkspaceId, updateData);

      expect(result.retrySchedule).toEqual([1, 2, 3]);
      expect(result.maxAttempts).toBe(3);
      expect(result.isDefault).toBe(false);
      expect(dunningConfigService.upsertConfig).toHaveBeenCalledWith(
        mockWorkspaceId,
        expect.objectContaining(updateData),
      );
    });

    it("should update email settings", async () => {
      const updateData = {
        emailsEnabled: true,
        fromEmail: "new@example.com",
        fromName: "New Name",
      };
      dunningConfigService.upsertConfig.mockResolvedValue({
        ...mockConfig,
        ...updateData,
      });

      const result = await controller.updateConfig(mockWorkspaceId, updateData);

      expect(result.emailsEnabled).toBe(true);
      expect(result.fromEmail).toBe("new@example.com");
    });
  });

  describe("listInvoicesInDunning", () => {
    it("should return paginated invoices", async () => {
      dunningService.getInvoicesInDunning.mockResolvedValue({
        data: [mockInvoice],
        hasMore: false,
        nextCursor: null,
      });

      const result = await controller.listInvoicesInDunning(
        mockWorkspaceId,
        {},
      );

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(dunningService.getInvoicesInDunning).toHaveBeenCalledWith(
        mockWorkspaceId,
        { limit: 20, cursor: undefined },
      );
    });

    it("should pass pagination parameters", async () => {
      dunningService.getInvoicesInDunning.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: null,
      });

      await controller.listInvoicesInDunning(mockWorkspaceId, {
        limit: 50,
        cursor: "cursor123",
      });

      expect(dunningService.getInvoicesInDunning).toHaveBeenCalledWith(
        mockWorkspaceId,
        { limit: 50, cursor: "cursor123" },
      );
    });
  });

  describe("getStats", () => {
    it("should return dunning statistics", async () => {
      dunningService.getDunningStats.mockResolvedValue(mockStats);

      const result = await controller.getStats(mockWorkspaceId);

      expect(result).toEqual(mockStats);
      expect(result.invoicesInDunning).toBe(5);
      expect(result.recoveryRate).toBe(66.67);
    });
  });

  describe("triggerManualRetry", () => {
    it("should trigger manual payment retry", async () => {
      dunningService.triggerManualRetry.mockResolvedValue({
        attemptId: "manual",
        success: true,
      });

      const result = await controller.triggerManualRetry(
        mockWorkspaceId,
        "inv_123",
      );

      expect(result.success).toBe(true);
      expect(dunningService.triggerManualRetry).toHaveBeenCalledWith(
        mockWorkspaceId,
        "inv_123",
      );
    });

    it("should return failure details", async () => {
      dunningService.triggerManualRetry.mockResolvedValue({
        attemptId: "manual",
        success: false,
        failureReason: "Card declined",
        declineCode: "card_declined",
      });

      const result = await controller.triggerManualRetry(
        mockWorkspaceId,
        "inv_123",
      );

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe("Card declined");
      expect(result.declineCode).toBe("card_declined");
    });
  });

  describe("stopDunning", () => {
    it("should stop dunning for an invoice", async () => {
      dunningService.stopDunning.mockResolvedValue(undefined);

      await controller.stopDunning(mockWorkspaceId, "inv_123", {
        reason: "Customer contacted support",
      });

      expect(dunningService.stopDunning).toHaveBeenCalledWith(
        mockWorkspaceId,
        "inv_123",
        "Customer contacted support",
      );
    });
  });
});
