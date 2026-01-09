import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

describe("InvoicesController", () => {
  let controller: InvoicesController;
  let invoicesService: {
    findMany: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    getPdfUrl: ReturnType<typeof vi.fn>;
    voidInvoice: ReturnType<typeof vi.fn>;
    payInvoice: ReturnType<typeof vi.fn>;
  };

  const mockInvoice = {
    id: "inv_123",
    workspaceId: "ws_123",
    customerId: "cust_123",
    subscriptionId: "sub_123",
    amountDue: 1000,
    amountPaid: 0,
    amountRemaining: 1000,
    subtotal: 1000,
    tax: 0,
    total: 1000,
    currency: "usd",
    status: "open" as const,
    periodStart: new Date("2025-01-01"),
    periodEnd: new Date("2025-02-01"),
    provider: "stripe",
    providerInvoiceId: "in_stripe_123",
    attemptCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: {
      id: "cust_123",
      email: "test@example.com",
      name: "Test User",
    },
    lineItems: [
      {
        id: "li_123",
        description: "Pro Plan",
        quantity: 1,
        unitAmount: 1000,
        amount: 1000,
        currency: "usd",
      },
    ],
  };

  beforeEach(async () => {
    invoicesService = {
      findMany: vi.fn(),
      findById: vi.fn(),
      getPdfUrl: vi.fn(),
      voidInvoice: vi.fn(),
      payInvoice: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [{ provide: InvoicesService, useValue: invoicesService }],
    }).compile();

    controller = module.get<InvoicesController>(InvoicesController);
  });

  describe("listInvoices", () => {
    it("should return paginated invoices", async () => {
      invoicesService.findMany.mockResolvedValue({
        data: [mockInvoice],
        hasMore: false,
        nextCursor: null,
      });

      const result = await controller.listInvoices("ws_123", {} as any);

      expect(result.data).toHaveLength(1);
      expect(invoicesService.findMany).toHaveBeenCalledWith("ws_123", {
        limit: 20,
        cursor: undefined,
        customerId: undefined,
        subscriptionId: undefined,
        status: undefined,
      });
    });

    it("should pass filters to service", async () => {
      invoicesService.findMany.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: null,
      });

      await controller.listInvoices("ws_123", {
        limit: 50,
        cursor: "cursor123",
        customerId: "cust_123",
        subscriptionId: "sub_123",
        status: "paid",
      } as any);

      expect(invoicesService.findMany).toHaveBeenCalledWith("ws_123", {
        limit: 50,
        cursor: "cursor123",
        customerId: "cust_123",
        subscriptionId: "sub_123",
        status: "paid",
      });
    });
  });

  describe("getInvoice", () => {
    it("should return invoice when found", async () => {
      invoicesService.findById.mockResolvedValue(mockInvoice);

      const result = await controller.getInvoice("ws_123", "inv_123");

      expect(result).toEqual(mockInvoice);
      expect(result.lineItems).toHaveLength(1);
    });

    it("should throw NotFoundException when not found", async () => {
      invoicesService.findById.mockResolvedValue(null);

      await expect(
        controller.getInvoice("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getInvoicePdf", () => {
    it("should return PDF URL", async () => {
      const pdfResponse = {
        url: "https://stripe.com/invoice.pdf",
        expiresAt: new Date(Date.now() + 3600000),
      };
      invoicesService.getPdfUrl.mockResolvedValue(pdfResponse);

      const result = await controller.getInvoicePdf("ws_123", "inv_123");

      expect(result.url).toBe("https://stripe.com/invoice.pdf");
      expect(invoicesService.getPdfUrl).toHaveBeenCalledWith(
        "ws_123",
        "inv_123",
      );
    });
  });

  describe("voidInvoice", () => {
    it("should void an open invoice", async () => {
      invoicesService.voidInvoice.mockResolvedValue({
        ...mockInvoice,
        status: "void",
        voidedAt: new Date(),
      });

      const result = await controller.voidInvoice("ws_123", "inv_123");

      expect(result.status).toBe("void");
      expect(invoicesService.voidInvoice).toHaveBeenCalledWith(
        "ws_123",
        "inv_123",
      );
    });
  });

  describe("payInvoice", () => {
    it("should trigger payment for an open invoice", async () => {
      invoicesService.payInvoice.mockResolvedValue(mockInvoice);

      const result = await controller.payInvoice("ws_123", "inv_123");

      expect(result).toEqual(mockInvoice);
      expect(invoicesService.payInvoice).toHaveBeenCalledWith(
        "ws_123",
        "inv_123",
      );
    });
  });
});
