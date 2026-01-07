import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { BillingService, ProviderType } from "../billing/billing.service";
import type {
  Invoice,
  InvoiceStatus,
  InvoiceLineItem,
  Prisma,
  Provider,
} from "@prisma/client";
import type { PaginatedResult } from "@zentla/database";

export interface InvoiceWithRelations extends Invoice {
  customer: {
    id: string;
    email: string;
    name: string | null;
  };
  lineItems: InvoiceLineItem[];
}

export interface InvoiceQueryParams {
  limit: number;
  cursor?: string;
  customerId?: string;
  subscriptionId?: string;
  status?: InvoiceStatus;
}

export interface UpsertInvoiceData {
  customerId: string;
  subscriptionId?: string;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  periodStart?: Date;
  periodEnd?: Date;
  dueDate?: Date;
  paidAt?: Date;
  provider: Provider;
  providerInvoiceId: string;
  providerInvoiceUrl?: string;
  providerPdfUrl?: string;
  attemptCount?: number;
  nextPaymentAttempt?: Date;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitAmount: number;
    amount: number;
    currency: string;
    periodStart?: Date;
    periodEnd?: Date;
    providerLineItemId?: string;
  }>;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  async findById(
    workspaceId: string,
    id: string,
  ): Promise<InvoiceWithRelations | null> {
    return this.prisma.invoice.findFirst({
      where: { id, workspaceId },
      include: {
        customer: {
          select: { id: true, email: true, name: true },
        },
        lineItems: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  async findMany(
    workspaceId: string,
    params: InvoiceQueryParams,
  ): Promise<PaginatedResult<Invoice>> {
    const { limit, cursor, customerId, subscriptionId, status } = params;

    const where: Prisma.InvoiceWhereInput = {
      workspaceId,
      ...(customerId && { customerId }),
      ...(subscriptionId && { subscriptionId }),
      ...(status && { status }),
    };

    const invoices = await this.prisma.invoice.findMany({
      where,
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    const hasMore = invoices.length > limit;
    const data = hasMore ? invoices.slice(0, -1) : invoices;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return {
      data,
      hasMore,
      nextCursor: nextCursor ?? null,
    };
  }

  async getPdfUrl(
    workspaceId: string,
    id: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, workspaceId },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    // Get workspace settings for provider
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const workspaceSettings = workspace?.settings as Record<string, unknown>;

    // Get billing provider
    const billingProvider = this.billingService.getProviderForWorkspace(
      workspaceId,
      invoice.provider as ProviderType,
      workspaceSettings,
    );

    // Get PDF URL from provider
    if (!billingProvider.getInvoicePdfUrl) {
      throw new NotFoundException("PDF not available for this provider");
    }

    const pdfUrl = await billingProvider.getInvoicePdfUrl(
      invoice.providerInvoiceId,
    );

    if (!pdfUrl) {
      throw new NotFoundException("PDF not available for this invoice");
    }

    // URLs typically expire in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    return { url: pdfUrl, expiresAt };
  }

  async voidInvoice(workspaceId: string, id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, workspaceId },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    if (invoice.status !== "open" && invoice.status !== "draft") {
      throw new BadRequestException(
        `Cannot void invoice with status: ${invoice.status}`,
      );
    }

    // Get workspace settings
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const workspaceSettings = workspace?.settings as Record<string, unknown>;

    // Void in provider first
    const billingProvider = this.billingService.getProviderForWorkspace(
      workspaceId,
      invoice.provider as ProviderType,
      workspaceSettings,
    );

    if (!billingProvider.voidInvoice) {
      throw new BadRequestException("Void not supported for this provider");
    }

    await billingProvider.voidInvoice(invoice.providerInvoiceId);

    // Update local record
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: "void",
        voidedAt: new Date(),
      },
    });

    this.logger.log(`Voided invoice ${id}`);

    return updated;
  }

  async payInvoice(workspaceId: string, id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, workspaceId },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    if (invoice.status !== "open") {
      throw new BadRequestException(
        `Cannot pay invoice with status: ${invoice.status}`,
      );
    }

    // Get workspace settings
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const workspaceSettings = workspace?.settings as Record<string, unknown>;

    // Trigger payment in provider
    const billingProvider = this.billingService.getProviderForWorkspace(
      workspaceId,
      invoice.provider as ProviderType,
      workspaceSettings,
    );

    if (!billingProvider.payInvoice) {
      throw new BadRequestException("Pay not supported for this provider");
    }

    await billingProvider.payInvoice(invoice.providerInvoiceId);

    this.logger.log(`Triggered payment for invoice ${id}`);

    // Note: The actual status update will come via webhook
    // Return current invoice state
    return invoice;
  }

  /**
   * Upsert an invoice from provider webhook data.
   * Creates or updates the invoice and its line items.
   */
  async upsertFromProvider(
    workspaceId: string,
    data: UpsertInvoiceData,
  ): Promise<Invoice> {
    const { lineItems, ...invoiceData } = data;

    // Check if invoice already exists
    const existing = await this.prisma.invoice.findFirst({
      where: {
        workspaceId,
        provider: invoiceData.provider,
        providerInvoiceId: invoiceData.providerInvoiceId,
      },
    });

    if (existing) {
      // Update existing invoice
      const updated = await this.prisma.invoice.update({
        where: { id: existing.id },
        data: {
          amountDue: invoiceData.amountDue,
          amountPaid: invoiceData.amountPaid,
          amountRemaining: invoiceData.amountRemaining,
          subtotal: invoiceData.subtotal,
          tax: invoiceData.tax,
          total: invoiceData.total,
          status: invoiceData.status,
          paidAt: invoiceData.paidAt,
          attemptCount: invoiceData.attemptCount,
          nextPaymentAttempt: invoiceData.nextPaymentAttempt,
          providerInvoiceUrl: invoiceData.providerInvoiceUrl,
          providerPdfUrl: invoiceData.providerPdfUrl,
        },
      });

      // Update line items if provided
      if (lineItems && lineItems.length > 0) {
        // Delete existing line items and recreate
        await this.prisma.invoiceLineItem.deleteMany({
          where: { invoiceId: existing.id },
        });

        await this.prisma.invoiceLineItem.createMany({
          data: lineItems.map((item) => ({
            invoiceId: existing.id,
            ...item,
          })),
        });
      }

      this.logger.log(
        `Updated invoice ${existing.id} from provider ${invoiceData.provider}`,
      );

      return updated;
    }

    // Create new invoice with line items
    const created = await this.prisma.invoice.create({
      data: {
        workspaceId,
        ...invoiceData,
        lineItems: lineItems
          ? {
              create: lineItems,
            }
          : undefined,
      },
    });

    this.logger.log(
      `Created invoice ${created.id} from provider ${invoiceData.provider}`,
    );

    return created;
  }

  /**
   * Update invoice status (used by webhook handlers)
   */
  async updateStatus(
    workspaceId: string,
    providerInvoiceId: string,
    provider: Provider,
    status: InvoiceStatus,
    additionalData?: {
      amountPaid?: number;
      amountRemaining?: number;
      paidAt?: Date | null;
      voidedAt?: Date | null;
      attemptCount?: number;
      nextPaymentAttempt?: Date | null;
    },
  ): Promise<Invoice | null> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        workspaceId,
        provider,
        providerInvoiceId,
      },
    });

    if (!invoice) {
      this.logger.warn(
        `Invoice not found for provider ${provider} invoice ${providerInvoiceId}`,
      );
      return null;
    }

    return this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status,
        ...additionalData,
      },
    });
  }
}
