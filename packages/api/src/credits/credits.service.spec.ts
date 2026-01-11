import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { CreditsService } from "./credits.service";
import { PrismaService } from "../database/prisma.service";

describe("CreditsService", () => {
  let service: CreditsService;
  let prisma: {
    credit: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
    creditTransaction: {
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    customer: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    invoice: {
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  const mockCredit = {
    id: "cred_123",
    workspaceId: "ws_123",
    customerId: "cust_123",
    amount: 5000,
    balance: 5000,
    currency: "usd",
    status: "active",
    reason: "promotional",
    description: "Welcome credit",
    expiresAt: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: {
      id: "cust_123",
      email: "test@example.com",
      name: "Test Customer",
    },
  };

  const mockTransaction = {
    id: "txn_123",
    workspaceId: "ws_123",
    creditId: "cred_123",
    customerId: "cust_123",
    invoiceId: null,
    type: "issued",
    amount: 5000,
    balanceBefore: 0,
    balanceAfter: 5000,
    description: "Credit issued: promotional",
    metadata: {},
    createdAt: new Date(),
  };

  const mockInvoice = {
    id: "inv_123",
    workspaceId: "ws_123",
    customerId: "cust_123",
    providerInvoiceId: "in_stripe_123",
    amountRemaining: 3000,
    currency: "usd",
    status: "open",
    total: 5000,
  };

  beforeEach(async () => {
    prisma = {
      credit: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        groupBy: vi.fn(),
      },
      creditTransaction: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      customer: {
        findFirst: vi.fn(),
      },
      invoice: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CreditsService>(CreditsService);
  });

  describe("findById", () => {
    it("should return credit with relations", async () => {
      prisma.credit.findFirst.mockResolvedValue(mockCredit);

      const result = await service.findById("ws_123", "cred_123");

      expect(result).toEqual(mockCredit);
      expect(prisma.credit.findFirst).toHaveBeenCalledWith({
        where: { id: "cred_123", workspaceId: "ws_123" },
        include: {
          customer: {
            select: { id: true, email: true, name: true },
          },
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });
    });

    it("should return null when credit not found", async () => {
      prisma.credit.findFirst.mockResolvedValue(null);

      const result = await service.findById("ws_123", "cred_999");

      expect(result).toBeNull();
    });
  });

  describe("findMany", () => {
    it("should return paginated credits", async () => {
      prisma.credit.findMany.mockResolvedValue([mockCredit]);

      const result = await service.findMany("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it("should indicate hasMore when more results available", async () => {
      prisma.credit.findMany.mockResolvedValue([
        mockCredit,
        { ...mockCredit, id: "cred_124" },
        { ...mockCredit, id: "cred_125" },
      ]);

      const result = await service.findMany("ws_123", { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it("should filter by customerId", async () => {
      prisma.credit.findMany.mockResolvedValue([mockCredit]);

      await service.findMany("ws_123", {
        limit: 10,
        customerId: "cust_123",
      });

      expect(prisma.credit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: "cust_123",
          }),
        }),
      );
    });

    it("should filter by status", async () => {
      prisma.credit.findMany.mockResolvedValue([mockCredit]);

      await service.findMany("ws_123", {
        limit: 10,
        status: "active",
      });

      expect(prisma.credit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "active",
          }),
        }),
      );
    });
  });

  describe("issueCredit", () => {
    it("should create credit with initial transaction", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "cust_123" });
      prisma.credit.create.mockResolvedValue(mockCredit);
      prisma.creditTransaction.create.mockResolvedValue(mockTransaction);

      const result = await service.issueCredit("ws_123", {
        customerId: "cust_123",
        amount: 5000,
        currency: "usd",
        reason: "promotional",
        description: "Welcome credit",
      });

      expect(result).toEqual(mockCredit);
      expect(prisma.customer.findFirst).toHaveBeenCalled();
      expect(prisma.credit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 5000,
          balance: 5000,
          currency: "usd",
          status: "active",
        }),
      });
    });

    it("should throw NotFoundException when customer not found", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.issueCredit("ws_123", {
          customerId: "cust_999",
          amount: 5000,
          currency: "usd",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("voidCredit", () => {
    it("should void an active credit", async () => {
      prisma.credit.findFirst.mockResolvedValue(mockCredit);
      prisma.credit.update.mockResolvedValue({
        ...mockCredit,
        status: "voided",
        balance: 0,
      });

      const result = await service.voidCredit("ws_123", "cred_123", "Refund requested");

      expect(result.status).toBe("voided");
      expect(result.balance).toBe(0);
    });

    it("should throw NotFoundException when credit not found", async () => {
      prisma.credit.findFirst.mockResolvedValue(null);

      await expect(
        service.voidCredit("ws_123", "cred_999"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when credit is not active", async () => {
      prisma.credit.findFirst.mockResolvedValue({
        ...mockCredit,
        status: "depleted",
      });

      await expect(
        service.voidCredit("ws_123", "cred_123"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getCustomerBalance", () => {
    it("should return customer balance grouped by currency", async () => {
      prisma.credit.groupBy.mockResolvedValue([
        {
          currency: "usd",
          _sum: { balance: 10000 },
          _count: { id: 3 },
        },
        {
          currency: "eur",
          _sum: { balance: 5000 },
          _count: { id: 1 },
        },
      ]);

      const result = await service.getCustomerBalance("ws_123", "cust_123");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        customerId: "cust_123",
        totalBalance: 10000,
        currency: "usd",
        activeCredits: 3,
      });
    });
  });

  describe("applyToInvoice", () => {
    it("should apply credits to invoice using FIFO", async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.credit.findMany.mockResolvedValue([
        { ...mockCredit, id: "cred_1", balance: 1000 },
        { ...mockCredit, id: "cred_2", balance: 2000 },
      ]);
      prisma.credit.update.mockResolvedValue({});
      prisma.invoice.update.mockResolvedValue({});

      const result = await service.applyToInvoice("ws_123", "inv_123");

      expect(result).not.toBeNull();
      expect(result?.totalApplied).toBe(3000);
      expect(result?.creditsUsed).toHaveLength(2);
    });

    it("should return null when no credits available", async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.credit.findMany.mockResolvedValue([]);

      const result = await service.applyToInvoice("ws_123", "inv_123");

      expect(result).toBeNull();
    });

    it("should throw NotFoundException when invoice not found", async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.applyToInvoice("ws_123", "inv_999"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when invoice is not open", async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...mockInvoice,
        status: "paid",
      });

      await expect(
        service.applyToInvoice("ws_123", "inv_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should respect maxAmount parameter", async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.credit.findMany.mockResolvedValue([
        { ...mockCredit, id: "cred_1", balance: 5000 },
      ]);
      prisma.credit.update.mockResolvedValue({});
      prisma.invoice.update.mockResolvedValue({});

      const result = await service.applyToInvoice("ws_123", "inv_123", 1000);

      expect(result).not.toBeNull();
      expect(result?.totalApplied).toBe(1000);
    });
  });

  describe("getTransactions", () => {
    it("should return transactions for credit", async () => {
      prisma.credit.findFirst.mockResolvedValue(mockCredit);
      prisma.creditTransaction.findMany.mockResolvedValue([mockTransaction]);

      const result = await service.getTransactions("ws_123", "cred_123");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockTransaction);
    });

    it("should throw NotFoundException when credit not found", async () => {
      prisma.credit.findFirst.mockResolvedValue(null);

      await expect(
        service.getTransactions("ws_123", "cred_999"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("expireCredits", () => {
    it("should expire credits past expiration date", async () => {
      const expiredCredit = {
        ...mockCredit,
        expiresAt: new Date("2020-01-01"),
      };
      prisma.credit.findMany.mockResolvedValue([expiredCredit]);
      prisma.credit.update.mockResolvedValue({
        ...expiredCredit,
        status: "expired",
        balance: 0,
      });

      const result = await service.expireCredits();

      expect(result).toBe(1);
      expect(prisma.credit.update).toHaveBeenCalled();
    });

    it("should return 0 when no credits to expire", async () => {
      prisma.credit.findMany.mockResolvedValue([]);

      const result = await service.expireCredits();

      expect(result).toBe(0);
    });
  });
});
