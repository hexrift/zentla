import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { RefundsService } from "./refunds.service";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";

describe("RefundsService", () => {
  let service: RefundsService;
  let prisma: {
    refund: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
    invoice: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    workspace: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let billingService: {
    getProviderForWorkspace: ReturnType<typeof vi.fn>;
  };

  const mockRefund = {
    id: "ref_123",
    workspaceId: "ws_123",
    customerId: "cust_123",
    invoiceId: "inv_123",
    amount: 4900,
    currency: "usd",
    status: "succeeded",
    reason: "requested_by_customer",
    failureReason: null,
    provider: "stripe",
    providerRefundId: "re_stripe_123",
    providerChargeId: "ch_stripe_123",
    providerPaymentIntentId: "pi_stripe_123",
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: {
      id: "cust_123",
      email: "test@example.com",
      name: "Test Customer",
    },
    invoice: {
      id: "inv_123",
      providerInvoiceId: "in_stripe_123",
      total: 4900,
      currency: "usd",
    },
  };

  beforeEach(async () => {
    prisma = {
      refund: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
      },
      invoice: {
        findFirst: vi.fn(),
      },
      workspace: {
        findUnique: vi.fn(),
      },
    };

    billingService = {
      getProviderForWorkspace: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingService, useValue: billingService },
      ],
    }).compile();

    service = module.get<RefundsService>(RefundsService);
  });

  describe("findById", () => {
    it("should return refund with relations", async () => {
      prisma.refund.findFirst.mockResolvedValue(mockRefund);

      const result = await service.findById("ws_123", "ref_123");

      expect(result).toEqual(mockRefund);
      expect(prisma.refund.findFirst).toHaveBeenCalledWith({
        where: { id: "ref_123", workspaceId: "ws_123" },
        include: {
          customer: {
            select: { id: true, email: true, name: true },
          },
          invoice: {
            select: {
              id: true,
              providerInvoiceId: true,
              total: true,
              currency: true,
            },
          },
        },
      });
    });

    it("should return null when refund not found", async () => {
      prisma.refund.findFirst.mockResolvedValue(null);

      const result = await service.findById("ws_123", "ref_999");

      expect(result).toBeNull();
    });
  });

  describe("findMany", () => {
    it("should return paginated refunds", async () => {
      prisma.refund.findMany.mockResolvedValue([mockRefund]);

      const result = await service.findMany("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it("should indicate hasMore when more results available", async () => {
      prisma.refund.findMany.mockResolvedValue([
        mockRefund,
        { ...mockRefund, id: "ref_124" },
        { ...mockRefund, id: "ref_125" },
      ]);

      const result = await service.findMany("ws_123", { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it("should filter by customerId", async () => {
      prisma.refund.findMany.mockResolvedValue([mockRefund]);

      await service.findMany("ws_123", {
        limit: 10,
        customerId: "cust_123",
      });

      expect(prisma.refund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: "cust_123",
          }),
        }),
      );
    });

    it("should filter by status", async () => {
      prisma.refund.findMany.mockResolvedValue([mockRefund]);

      await service.findMany("ws_123", {
        limit: 10,
        status: "succeeded",
      });

      expect(prisma.refund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "succeeded",
          }),
        }),
      );
    });

    it("should filter by invoiceId", async () => {
      prisma.refund.findMany.mockResolvedValue([mockRefund]);

      await service.findMany("ws_123", {
        limit: 10,
        invoiceId: "inv_123",
      });

      expect(prisma.refund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            invoiceId: "inv_123",
          }),
        }),
      );
    });
  });

  describe("upsertFromProvider", () => {
    it("should create new refund when not found", async () => {
      prisma.refund.findFirst.mockResolvedValue(null);
      prisma.refund.create.mockResolvedValue(mockRefund);

      const result = await service.upsertFromProvider("ws_123", {
        customerId: "cust_123",
        amount: 4900,
        currency: "usd",
        status: "succeeded",
        reason: "requested_by_customer",
        provider: "stripe",
        providerRefundId: "re_stripe_123",
      });

      expect(result).toEqual(mockRefund);
      expect(prisma.refund.create).toHaveBeenCalled();
    });

    it("should update existing refund when found", async () => {
      prisma.refund.findFirst.mockResolvedValue(mockRefund);
      prisma.refund.update.mockResolvedValue({
        ...mockRefund,
        status: "failed",
        failureReason: "insufficient_funds",
      });

      const result = await service.upsertFromProvider("ws_123", {
        customerId: "cust_123",
        amount: 4900,
        currency: "usd",
        status: "failed",
        failureReason: "insufficient_funds",
        provider: "stripe",
        providerRefundId: "re_stripe_123",
      });

      expect(result.status).toBe("failed");
      expect(prisma.refund.update).toHaveBeenCalled();
      expect(prisma.refund.create).not.toHaveBeenCalled();
    });
  });

  describe("updateStatus", () => {
    it("should update refund status", async () => {
      prisma.refund.findFirst.mockResolvedValue(mockRefund);
      prisma.refund.update.mockResolvedValue({
        ...mockRefund,
        status: "failed",
        failureReason: "insufficient_funds",
      });

      const result = await service.updateStatus(
        "ws_123",
        "re_stripe_123",
        "stripe",
        "failed",
        "insufficient_funds",
      );

      expect(result?.status).toBe("failed");
      expect(prisma.refund.update).toHaveBeenCalled();
    });

    it("should return null when refund not found", async () => {
      prisma.refund.findFirst.mockResolvedValue(null);

      const result = await service.updateStatus(
        "ws_123",
        "re_unknown",
        "stripe",
        "failed",
      );

      expect(result).toBeNull();
    });
  });
});
