import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type {
  Credit,
  CreditStatus,
  CreditReason,
  CreditTransaction,
  Prisma,
} from "@prisma/client";
import type { PaginatedResult } from "@zentla/database";

export interface CreditWithRelations extends Credit {
  customer: {
    id: string;
    email: string;
    name: string | null;
  };
  transactions?: CreditTransaction[];
}

export interface CreateCreditParams {
  customerId: string;
  amount: number;
  currency: string;
  reason?: CreditReason;
  description?: string;
  expiresAt?: Date;
}

export interface CreditQueryParams {
  limit: number;
  cursor?: string;
  customerId?: string;
  status?: CreditStatus;
}

export interface CustomerCreditBalance {
  customerId: string;
  totalBalance: number;
  currency: string;
  activeCredits: number;
}

export interface CreditApplication {
  invoiceId: string;
  totalApplied: number;
  creditsUsed: Array<{
    creditId: string;
    amountApplied: number;
  }>;
}

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a credit by ID with customer relations.
   */
  async findById(
    workspaceId: string,
    id: string,
  ): Promise<CreditWithRelations | null> {
    return this.prisma.credit.findFirst({
      where: { id, workspaceId },
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
  }

  /**
   * Find many credits with pagination and filtering.
   */
  async findMany(
    workspaceId: string,
    params: CreditQueryParams,
  ): Promise<PaginatedResult<Credit>> {
    const { limit, cursor, customerId, status } = params;

    const where: Prisma.CreditWhereInput = {
      workspaceId,
      ...(customerId && { customerId }),
      ...(status && { status }),
    };

    const credits = await this.prisma.credit.findMany({
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

    const hasMore = credits.length > limit;
    const data = hasMore ? credits.slice(0, -1) : credits;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return {
      data,
      hasMore,
      nextCursor: nextCursor ?? null,
    };
  }

  /**
   * Issue a new credit to a customer.
   */
  async issueCredit(
    workspaceId: string,
    params: CreateCreditParams,
  ): Promise<Credit> {
    const { customerId, amount, currency, reason, description, expiresAt } =
      params;

    // Validate customer exists in workspace
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, workspaceId },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    // Create credit and initial transaction in a transaction
    const credit = await this.prisma.$transaction(async (tx) => {
      const newCredit = await tx.credit.create({
        data: {
          workspaceId,
          customerId,
          amount,
          balance: amount,
          currency: currency.toLowerCase(),
          status: "active",
          reason: reason as CreditReason,
          description,
          expiresAt,
        },
      });

      // Create issued transaction
      await tx.creditTransaction.create({
        data: {
          workspaceId,
          creditId: newCredit.id,
          customerId,
          type: "issued",
          amount,
          balanceBefore: 0,
          balanceAfter: amount,
          description: description || `Credit issued: ${reason || "manual"}`,
        },
      });

      return newCredit;
    });

    this.logger.log(
      `Issued credit ${credit.id} for ${amount} ${currency} to customer ${customerId}`,
    );

    return credit;
  }

  /**
   * Void a credit (cancel it and set balance to 0).
   */
  async voidCredit(
    workspaceId: string,
    id: string,
    reason?: string,
  ): Promise<Credit> {
    const credit = await this.prisma.credit.findFirst({
      where: { id, workspaceId },
    });

    if (!credit) {
      throw new NotFoundException("Credit not found");
    }

    if (credit.status !== "active") {
      throw new BadRequestException(
        `Cannot void credit with status: ${credit.status}`,
      );
    }

    const updatedCredit = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.credit.update({
        where: { id },
        data: {
          status: "voided",
          balance: 0,
        },
      });

      // Record void transaction
      await tx.creditTransaction.create({
        data: {
          workspaceId,
          creditId: id,
          customerId: credit.customerId,
          type: "voided",
          amount: credit.balance,
          balanceBefore: credit.balance,
          balanceAfter: 0,
          description: reason || "Credit voided",
        },
      });

      return updated;
    });

    this.logger.log(`Voided credit ${id}`);

    return updatedCredit;
  }

  /**
   * Get total credit balance for a customer.
   */
  async getCustomerBalance(
    workspaceId: string,
    customerId: string,
  ): Promise<CustomerCreditBalance[]> {
    // Group by currency since customers might have credits in different currencies
    const credits = await this.prisma.credit.groupBy({
      by: ["currency"],
      where: {
        workspaceId,
        customerId,
        status: "active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      _sum: {
        balance: true,
      },
      _count: {
        id: true,
      },
    });

    return credits.map((c) => ({
      customerId,
      totalBalance: c._sum.balance ?? 0,
      currency: c.currency,
      activeCredits: c._count.id,
    }));
  }

  /**
   * Apply credits to an invoice.
   * Uses FIFO (oldest credits first) and supports partial application.
   */
  async applyToInvoice(
    workspaceId: string,
    invoiceId: string,
    maxAmount?: number,
  ): Promise<CreditApplication | null> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, workspaceId },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    if (invoice.status !== "open") {
      throw new BadRequestException(
        `Cannot apply credits to invoice with status: ${invoice.status}`,
      );
    }

    const amountToApply = Math.min(
      maxAmount ?? invoice.amountRemaining,
      invoice.amountRemaining,
    );

    if (amountToApply <= 0) {
      return null;
    }

    // Get available credits for customer in matching currency (FIFO order)
    const availableCredits = await this.prisma.credit.findMany({
      where: {
        workspaceId,
        customerId: invoice.customerId,
        currency: invoice.currency,
        status: "active",
        balance: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "asc" }, // FIFO
    });

    if (availableCredits.length === 0) {
      return null;
    }

    // Calculate how much to apply from each credit
    let remainingToApply = amountToApply;
    const creditsToUse: Array<{ credit: Credit; amountToUse: number }> = [];

    for (const credit of availableCredits) {
      if (remainingToApply <= 0) break;

      const amountFromThisCredit = Math.min(credit.balance, remainingToApply);
      creditsToUse.push({ credit, amountToUse: amountFromThisCredit });
      remainingToApply -= amountFromThisCredit;
    }

    const totalApplied = amountToApply - remainingToApply;

    if (totalApplied <= 0) {
      return null;
    }

    // Apply credits in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const creditsUsed: Array<{ creditId: string; amountApplied: number }> =
        [];

      for (const { credit, amountToUse } of creditsToUse) {
        const newBalance = credit.balance - amountToUse;
        const newStatus: CreditStatus =
          newBalance === 0 ? "depleted" : "active";

        // Update credit balance
        await tx.credit.update({
          where: { id: credit.id },
          data: {
            balance: newBalance,
            status: newStatus,
          },
        });

        // Record transaction
        await tx.creditTransaction.create({
          data: {
            workspaceId,
            creditId: credit.id,
            customerId: invoice.customerId,
            invoiceId,
            type: "applied",
            amount: amountToUse,
            balanceBefore: credit.balance,
            balanceAfter: newBalance,
            description: `Applied to invoice ${invoice.providerInvoiceId || invoiceId}`,
          },
        });

        creditsUsed.push({ creditId: credit.id, amountApplied: amountToUse });
      }

      // Update invoice
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          creditsApplied: { increment: totalApplied },
          amountRemaining: { decrement: totalApplied },
        },
      });

      return { creditsUsed };
    });

    this.logger.log(
      `Applied ${totalApplied} credits to invoice ${invoiceId} from ${result.creditsUsed.length} credit(s)`,
    );

    return {
      invoiceId,
      totalApplied,
      creditsUsed: result.creditsUsed,
    };
  }

  /**
   * Auto-apply available credits to an invoice.
   * Called when an invoice becomes open/finalized.
   */
  async autoApplyToInvoice(
    workspaceId: string,
    invoiceId: string,
  ): Promise<CreditApplication | null> {
    return this.applyToInvoice(workspaceId, invoiceId);
  }

  /**
   * Get transactions for a specific credit.
   */
  async getTransactions(
    workspaceId: string,
    creditId: string,
  ): Promise<CreditTransaction[]> {
    const credit = await this.prisma.credit.findFirst({
      where: { id: creditId, workspaceId },
    });

    if (!credit) {
      throw new NotFoundException("Credit not found");
    }

    return this.prisma.creditTransaction.findMany({
      where: { creditId },
      orderBy: { createdAt: "desc" },
      include: {
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

  /**
   * Expire credits that have passed their expiration date.
   * Should be called by a scheduled job.
   */
  async expireCredits(): Promise<number> {
    const now = new Date();

    // Find credits to expire
    const creditsToExpire = await this.prisma.credit.findMany({
      where: {
        status: "active",
        expiresAt: { lte: now },
        balance: { gt: 0 },
      },
    });

    if (creditsToExpire.length === 0) {
      return 0;
    }

    // Expire each credit
    await this.prisma.$transaction(async (tx) => {
      for (const credit of creditsToExpire) {
        await tx.credit.update({
          where: { id: credit.id },
          data: {
            status: "expired",
            balance: 0,
          },
        });

        await tx.creditTransaction.create({
          data: {
            workspaceId: credit.workspaceId,
            creditId: credit.id,
            customerId: credit.customerId,
            type: "expired",
            amount: credit.balance,
            balanceBefore: credit.balance,
            balanceAfter: 0,
            description: "Credit expired",
          },
        });
      }
    });

    this.logger.log(`Expired ${creditsToExpire.length} credits`);

    return creditsToExpire.length;
  }
}
