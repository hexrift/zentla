import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { BillingService, ProviderType } from "../billing/billing.service";
import type {
  Refund,
  RefundStatus,
  RefundReason,
  Prisma,
  Provider,
} from "@prisma/client";
import type { PaginatedResult } from "@zentla/database";

export interface RefundWithRelations extends Refund {
  customer: {
    id: string;
    email: string;
    name: string | null;
  };
  invoice?: {
    id: string;
    providerInvoiceId: string;
    total: number;
    currency: string;
  } | null;
}

export interface RefundQueryParams {
  limit: number;
  cursor?: string;
  customerId?: string;
  invoiceId?: string;
  status?: RefundStatus;
}

export interface CreateRefundParams {
  invoiceId?: string;
  chargeId?: string;
  paymentIntentId?: string;
  amount?: number;
  reason?: RefundReason;
}

export interface UpsertRefundData {
  customerId: string;
  invoiceId?: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  reason?: RefundReason;
  failureReason?: string;
  provider: Provider;
  providerRefundId: string;
  providerChargeId?: string;
  providerPaymentIntentId?: string;
}

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  async findById(
    workspaceId: string,
    id: string,
  ): Promise<RefundWithRelations | null> {
    return this.prisma.refund.findFirst({
      where: { id, workspaceId },
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
  }

  async findMany(
    workspaceId: string,
    params: RefundQueryParams,
  ): Promise<PaginatedResult<Refund>> {
    const { limit, cursor, customerId, invoiceId, status } = params;

    const where: Prisma.RefundWhereInput = {
      workspaceId,
      ...(customerId && { customerId }),
      ...(invoiceId && { invoiceId }),
      ...(status && { status }),
    };

    const refunds = await this.prisma.refund.findMany({
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

    const hasMore = refunds.length > limit;
    const data = hasMore ? refunds.slice(0, -1) : refunds;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return {
      data,
      hasMore,
      nextCursor: nextCursor ?? null,
    };
  }

  /**
   * Create a refund for an invoice or charge.
   * This will call the billing provider to initiate the refund.
   */
  async createRefund(
    workspaceId: string,
    params: CreateRefundParams,
  ): Promise<Refund> {
    const { invoiceId, chargeId, paymentIntentId, amount, reason } = params;

    // Must have at least one identifier
    if (!invoiceId && !chargeId && !paymentIntentId) {
      throw new BadRequestException(
        "Must provide invoiceId, chargeId, or paymentIntentId",
      );
    }

    let invoice: {
      id: string;
      workspaceId: string;
      customerId: string;
      provider: Provider;
      providerInvoiceId: string;
      total: number;
      currency: string;
      status: string;
    } | null = null;

    // If invoiceId provided, look up the invoice
    if (invoiceId) {
      invoice = await this.prisma.invoice.findFirst({
        where: { id: invoiceId, workspaceId },
        select: {
          id: true,
          workspaceId: true,
          customerId: true,
          provider: true,
          providerInvoiceId: true,
          total: true,
          currency: true,
          status: true,
        },
      });

      if (!invoice) {
        throw new NotFoundException("Invoice not found");
      }

      if (invoice.status !== "paid") {
        throw new BadRequestException(
          `Cannot refund invoice with status: ${invoice.status}`,
        );
      }
    }

    // Get workspace settings
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true, defaultProvider: true },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    const workspaceSettings = workspace.settings as Record<string, unknown>;
    const provider = invoice?.provider ?? workspace.defaultProvider;

    // Get billing provider
    const billingProvider = this.billingService.getProviderForWorkspace(
      workspaceId,
      provider as ProviderType,
      workspaceSettings,
    );

    if (!billingProvider.createRefund) {
      throw new BadRequestException("Refunds not supported for this provider");
    }

    // Map reason to provider-supported values
    const providerReason =
      reason === "expired_uncaptured_charge" ? undefined : reason;

    // Create refund in provider
    const providerRefund = await billingProvider.createRefund({
      invoiceId: invoice?.providerInvoiceId,
      chargeId,
      paymentIntentId,
      amount,
      reason: providerReason,
    });

    // Find customer from invoice or by provider lookup
    let customerId = invoice?.customerId;
    if (!customerId && providerRefund.customerId) {
      // Try to find customer by provider customer ID
      const customer = await this.prisma.providerRef.findFirst({
        where: {
          workspaceId,
          provider,
          entityType: "customer",
          externalId: providerRefund.customerId,
        },
        select: { entityId: true },
      });
      customerId = customer?.entityId;
    }

    if (!customerId) {
      throw new BadRequestException(
        "Could not determine customer for this refund",
      );
    }

    // Create local refund record
    const refund = await this.prisma.refund.create({
      data: {
        workspaceId,
        customerId,
        invoiceId: invoice?.id,
        amount: providerRefund.amount,
        currency: providerRefund.currency,
        status: this.mapProviderStatus(providerRefund.status),
        reason: reason ?? null,
        provider,
        providerRefundId: providerRefund.id,
        providerChargeId: providerRefund.chargeId,
        providerPaymentIntentId: providerRefund.paymentIntentId,
      },
    });

    this.logger.log(
      `Created refund ${refund.id} for ${amount ?? "full"} amount`,
    );

    return refund;
  }

  /**
   * Upsert a refund from provider webhook data.
   */
  async upsertFromProvider(
    workspaceId: string,
    data: UpsertRefundData,
  ): Promise<Refund> {
    // Check if refund already exists
    const existing = await this.prisma.refund.findFirst({
      where: {
        workspaceId,
        provider: data.provider,
        providerRefundId: data.providerRefundId,
      },
    });

    if (existing) {
      // Update existing refund
      const updated = await this.prisma.refund.update({
        where: { id: existing.id },
        data: {
          status: data.status,
          failureReason: data.failureReason,
        },
      });

      this.logger.log(
        `Updated refund ${existing.id} from provider ${data.provider}`,
      );

      return updated;
    }

    // Create new refund
    const created = await this.prisma.refund.create({
      data: {
        workspaceId,
        ...data,
      },
    });

    this.logger.log(
      `Created refund ${created.id} from provider ${data.provider}`,
    );

    return created;
  }

  /**
   * Update refund status (used by webhook handlers)
   */
  async updateStatus(
    workspaceId: string,
    providerRefundId: string,
    provider: Provider,
    status: RefundStatus,
    failureReason?: string,
  ): Promise<Refund | null> {
    const refund = await this.prisma.refund.findFirst({
      where: {
        workspaceId,
        provider,
        providerRefundId,
      },
    });

    if (!refund) {
      this.logger.warn(
        `Refund not found for provider ${provider} refund ${providerRefundId}`,
      );
      return null;
    }

    return this.prisma.refund.update({
      where: { id: refund.id },
      data: {
        status,
        failureReason,
      },
    });
  }

  private mapProviderStatus(
    status: "pending" | "succeeded" | "failed" | "canceled",
  ): RefundStatus {
    return status as RefundStatus;
  }
}
