import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { InvoicesService } from "./invoices.service";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";

describe("InvoicesService", () => {
  let service: InvoicesService;
  let prisma: {
    invoice: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    customer: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    invoiceLineItem: {
      deleteMany: ReturnType<typeof vi.fn>;
      createMany: ReturnType<typeof vi.fn>;
    };
  };
  let billingService: {
    getProviderForWorkspace: ReturnType<typeof vi.fn>;
  };

  const mockInvoice = {
    id: "inv_123",
    workspaceId: "ws_123",
    customerId: "cust_123",
    subscriptionId: "sub_123",
    amountDue: 4900,
    amountPaid: 0,
    amountRemaining: 4900,
    subtotal: 4900,
    tax: 0,
    total: 4900,
    currency: "usd",
    status: "open",
    periodStart: new Date("2024-01-01"),
    periodEnd: new Date("2024-02-01"),
    dueDate: new Date("2024-01-15"),
    paidAt: null,
    provider: "stripe",
    providerInvoiceId: "in_stripe_123",
    providerInvoiceUrl: "https://stripe.com/invoice/123",
    providerPdfUrl: "https://stripe.com/invoice/123.pdf",
    attemptCount: 0,
    nextPaymentAttempt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: {
      id: "cust_123",
      email: "test@example.com",
      name: "Test Customer",
    },
    lineItems: [
      {
        id: "li_123",
        invoiceId: "inv_123",
        description: "Pro Plan",
        quantity: 1,
        unitAmount: 4900,
        amount: 4900,
        currency: "usd",
        periodStart: new Date("2024-01-01"),
        periodEnd: new Date("2024-02-01"),
        providerLineItemId: "il_stripe_123",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      invoice: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      customer: {
        findFirst: vi.fn(),
      },
      invoiceLineItem: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
    };

    billingService = {
      getProviderForWorkspace: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingService, useValue: billingService },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  describe("findById", () => {
    it("should return invoice with relations", async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      const result = await service.findById("ws_123", "inv_123");

      expect(result).toEqual(mockInvoice);
      expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
        where: { id: "inv_123", workspaceId: "ws_123" },
        include: {
          customer: {
            select: { id: true, email: true, name: true },
          },
          lineItems: {
            orderBy: { createdAt: "asc" },
          },
        },
      });
    });

    it("should return null when invoice not found", async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      const result = await service.findById("ws_123", "inv_999");

      expect(result).toBeNull();
    });
  });

  describe("findMany", () => {
    it("should return paginated invoices", async () => {
      prisma.invoice.findMany.mockResolvedValue([mockInvoice]);

      const result = await service.findMany("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("should indicate hasMore when more results available", async () => {
      // Return limit + 1 items to indicate more are available
      prisma.invoice.findMany.mockResolvedValue([
        mockInvoice,
        { ...mockInvoice, id: "inv_124" },
        { ...mockInvoice, id: "inv_125" },
      ]);

      const result = await service.findMany("ws_123", { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("inv_124");
    });

    it("should filter by customerId", async () => {
      prisma.invoice.findMany.mockResolvedValue([mockInvoice]);

      await service.findMany("ws_123", {
        limit: 10,
        customerId: "cust_123",
      });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: "cust_123",
          }),
        }),
      );
    });

    it("should filter by status", async () => {
      prisma.invoice.findMany.mockResolvedValue([mockInvoice]);

      await service.findMany("ws_123", {
        limit: 10,
        status: "open",
      });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "open",
          }),
        }),
      );
    });

    it("should filter by subscriptionId", async () => {
      prisma.invoice.findMany.mockResolvedValue([mockInvoice]);

      await service.findMany("ws_123", {
        limit: 10,
        subscriptionId: "sub_123",
      });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subscriptionId: "sub_123",
          }),
        }),
      );
    });

    it("should handle cursor-based pagination", async () => {
      prisma.invoice.findMany.mockResolvedValue([mockInvoice]);

      await service.findMany("ws_123", {
        limit: 10,
        cursor: "inv_122",
      });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "inv_122" },
          skip: 1,
        }),
      );
    });
  });

  describe("upsertFromProvider", () => {
    it("should update existing invoice when found", async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.invoice.update.mockResolvedValue({
        ...mockInvoice,
        amountPaid: 4900,
        status: "paid",
      });

      const result = await service.upsertFromProvider("ws_123", {
        customerId: "cust_123",
        amountDue: 0,
        amountPaid: 4900,
        amountRemaining: 0,
        subtotal: 4900,
        tax: 0,
        total: 4900,
        currency: "usd",
        status: "paid",
        provider: "stripe",
        providerInvoiceId: "in_stripe_123",
      });

      expect(result.status).toBe("paid");
      expect(prisma.invoice.update).toHaveBeenCalled();
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });

    it("should create new invoice when not found", async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.upsertFromProvider("ws_123", {
        customerId: "cust_123",
        amountDue: 4900,
        amountPaid: 0,
        amountRemaining: 4900,
        subtotal: 4900,
        tax: 0,
        total: 4900,
        currency: "usd",
        status: "open",
        provider: "stripe",
        providerInvoiceId: "in_stripe_123",
      });

      expect(result).toEqual(mockInvoice);
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it("should update line items when provided", async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.invoice.update.mockResolvedValue(mockInvoice);
      prisma.invoiceLineItem.deleteMany.mockResolvedValue({ count: 1 });
      prisma.invoiceLineItem.createMany.mockResolvedValue({ count: 1 });

      await service.upsertFromProvider("ws_123", {
        customerId: "cust_123",
        amountDue: 4900,
        amountPaid: 0,
        amountRemaining: 4900,
        subtotal: 4900,
        tax: 0,
        total: 4900,
        currency: "usd",
        status: "open",
        provider: "stripe",
        providerInvoiceId: "in_stripe_123",
        lineItems: [
          {
            description: "Updated Plan",
            quantity: 1,
            unitAmount: 4900,
            amount: 4900,
            currency: "usd",
          },
        ],
      });

      expect(prisma.invoiceLineItem.deleteMany).toHaveBeenCalledWith({
        where: { invoiceId: mockInvoice.id },
      });
      expect(prisma.invoiceLineItem.createMany).toHaveBeenCalled();
    });
  });

  describe("updateStatus", () => {
    it("should update invoice status", async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.invoice.update.mockResolvedValue({
        ...mockInvoice,
        status: "paid",
        paidAt: new Date(),
      });

      const result = await service.updateStatus(
        "ws_123",
        "in_stripe_123",
        "stripe",
        "paid",
        { paidAt: new Date() },
      );

      expect(result?.status).toBe("paid");
      expect(prisma.invoice.update).toHaveBeenCalled();
    });

    it("should return null when invoice not found", async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      const result = await service.updateStatus(
        "ws_123",
        "in_unknown",
        "stripe",
        "paid",
      );

      expect(result).toBeNull();
    });
  });
});
