import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { RefundsController } from "./refunds.controller";
import { RefundsService } from "./refunds.service";

describe("RefundsController", () => {
  let controller: RefundsController;
  let refundsService: {
    findMany: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    createRefund: ReturnType<typeof vi.fn>;
  };

  const mockRefund = {
    id: "ref_123",
    workspaceId: "ws_123",
    customerId: "cust_123",
    invoiceId: "inv_123",
    amount: 1000,
    currency: "usd",
    status: "succeeded" as const,
    reason: "requested_by_customer" as const,
    failureReason: null,
    provider: "stripe",
    providerRefundId: "re_stripe_123",
    providerChargeId: "ch_stripe_123",
    providerPaymentIntentId: "pi_stripe_123",
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: {
      id: "cust_123",
      email: "test@example.com",
      name: "Test User",
    },
    invoice: {
      id: "inv_123",
      providerInvoiceId: "in_stripe_123",
      total: 2000,
      currency: "usd",
    },
  };

  beforeEach(async () => {
    refundsService = {
      findMany: vi.fn(),
      findById: vi.fn(),
      createRefund: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RefundsController],
      providers: [{ provide: RefundsService, useValue: refundsService }],
    }).compile();

    controller = module.get<RefundsController>(RefundsController);
  });

  describe("listRefunds", () => {
    it("should return paginated refunds", async () => {
      refundsService.findMany.mockResolvedValue({
        data: [mockRefund],
        hasMore: false,
        nextCursor: null,
      });

      const result = await controller.listRefunds("ws_123", {} as any);

      expect(result.data).toHaveLength(1);
      expect(refundsService.findMany).toHaveBeenCalledWith("ws_123", {
        limit: 20,
        cursor: undefined,
        customerId: undefined,
        invoiceId: undefined,
        status: undefined,
      });
    });

    it("should pass filters to service", async () => {
      refundsService.findMany.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: null,
      });

      await controller.listRefunds("ws_123", {
        limit: 50,
        cursor: "cursor123",
        customerId: "cust_123",
        invoiceId: "inv_123",
        status: "succeeded",
      } as any);

      expect(refundsService.findMany).toHaveBeenCalledWith("ws_123", {
        limit: 50,
        cursor: "cursor123",
        customerId: "cust_123",
        invoiceId: "inv_123",
        status: "succeeded",
      });
    });
  });

  describe("getRefund", () => {
    it("should return refund when found", async () => {
      refundsService.findById.mockResolvedValue(mockRefund);

      const result = await controller.getRefund("ws_123", "ref_123");

      expect(result).toEqual(mockRefund);
      expect(result.customer).toBeDefined();
      expect(result.invoice).toBeDefined();
    });

    it("should throw NotFoundException when not found", async () => {
      refundsService.findById.mockResolvedValue(null);

      await expect(
        controller.getRefund("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createRefund", () => {
    it("should create a refund with invoiceId", async () => {
      refundsService.createRefund.mockResolvedValue({
        ...mockRefund,
        status: "pending",
      });

      const result = await controller.createRefund("ws_123", {
        invoiceId: "inv_123",
        amount: 1000,
        reason: "requested_by_customer",
      });

      expect(result.status).toBe("pending");
      expect(refundsService.createRefund).toHaveBeenCalledWith("ws_123", {
        invoiceId: "inv_123",
        chargeId: undefined,
        paymentIntentId: undefined,
        amount: 1000,
        reason: "requested_by_customer",
      });
    });

    it("should create a refund with chargeId", async () => {
      refundsService.createRefund.mockResolvedValue({
        ...mockRefund,
        invoiceId: null,
        status: "pending",
      });

      const result = await controller.createRefund("ws_123", {
        chargeId: "ch_stripe_123",
        reason: "duplicate",
      });

      expect(result.status).toBe("pending");
      expect(refundsService.createRefund).toHaveBeenCalledWith("ws_123", {
        invoiceId: undefined,
        chargeId: "ch_stripe_123",
        paymentIntentId: undefined,
        amount: undefined,
        reason: "duplicate",
      });
    });

    it("should create a partial refund", async () => {
      refundsService.createRefund.mockResolvedValue({
        ...mockRefund,
        amount: 500,
        status: "pending",
      });

      const result = await controller.createRefund("ws_123", {
        invoiceId: "inv_123",
        amount: 500,
      });

      expect(result.amount).toBe(500);
    });
  });
});
