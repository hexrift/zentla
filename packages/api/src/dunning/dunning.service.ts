import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";
import { OutboxService } from "../webhooks/outbox.service";
import {
  DunningConfigService,
  type DunningConfigWithDefaults,
} from "./dunning-config.service";
import { EmailService } from "../email/email.service";
import type { DunningAttempt, Invoice, DunningEmailType } from "@prisma/client";

export interface DunningAttemptResult {
  attemptId: string;
  success: boolean;
  failureReason?: string;
  declineCode?: string;
  nextAttemptAt?: Date;
  finalActionTaken?: "suspend" | "cancel";
}

export interface PaymentRetryResult {
  success: boolean;
  failureReason?: string;
  declineCode?: string;
}

export interface AmountByCurrency {
  currency: string;
  amount: number;
}

export interface DunningStats {
  invoicesInDunning: number;
  totalAmountAtRisk: number;
  /** @deprecated Use amountsByCurrency instead for multi-currency support */
  currency: string;
  amountsByCurrency: AmountByCurrency[];
  recoveryRate: number;
  attemptsByStatus: {
    pending: number;
    succeeded: number;
    failed: number;
  };
}

export interface InvoiceWithDunning extends Invoice {
  customer: {
    id: string;
    email: string;
    name: string | null;
  };
  subscription?: {
    id: string;
    status: string;
  } | null;
  _count?: {
    dunningAttempts: number;
  };
}

@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly outboxService: OutboxService,
    private readonly dunningConfigService: DunningConfigService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Start the dunning process for an invoice that failed payment.
   * Called when invoice.payment_failed webhook is received.
   */
  async startDunning(workspaceId: string, invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, workspaceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    // Skip if already in dunning
    if (invoice.dunningStartedAt) {
      this.logger.debug(`Invoice ${invoiceId} already in dunning, skipping`);
      return;
    }

    // Skip if not open status
    if (invoice.status !== "open") {
      this.logger.debug(
        `Invoice ${invoiceId} status is ${invoice.status}, not starting dunning`,
      );
      return;
    }

    const config = await this.dunningConfigService.getConfig(workspaceId);
    const now = new Date();

    // Calculate first retry date
    const firstRetryDate = this.dunningConfigService.calculateNextRetryDate(
      config,
      0,
      now,
    );

    if (!firstRetryDate) {
      this.logger.warn(
        `No retry schedule configured for workspace ${workspaceId}`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // Mark invoice as in dunning
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          dunningStartedAt: now,
          dunningAttemptCount: 0,
          nextDunningAttemptAt: firstRetryDate,
        },
      });

      // Create first dunning attempt
      await tx.dunningAttempt.create({
        data: {
          workspaceId,
          invoiceId,
          subscriptionId: invoice.subscriptionId,
          customerId: invoice.customerId,
          attemptNumber: 1,
          status: "pending",
          scheduledAt: firstRetryDate,
        },
      });
    });

    // Emit dunning started event
    await this.outboxService.createEvent({
      workspaceId,
      eventType: "dunning.started",
      aggregateType: "invoice",
      aggregateId: invoiceId,
      payload: {
        invoiceId,
        subscriptionId: invoice.subscriptionId,
        customerId: invoice.customerId,
        amountDue: invoice.amountDue,
        currency: invoice.currency,
        firstRetryAt: firstRetryDate.toISOString(),
        maxAttempts: config.maxAttempts,
      },
    });

    // Send payment_failed email notification
    await this.sendDunningEmail(
      workspaceId,
      config,
      invoice.customerId,
      invoiceId,
      "payment_failed",
      {
        attemptNumber: 1,
        maxAttempts: config.maxAttempts,
        nextRetryDate: firstRetryDate.toISOString(),
      },
    );

    this.logger.log(
      `Started dunning for invoice ${invoiceId}, first retry at ${firstRetryDate}`,
    );
  }

  /**
   * Process a scheduled dunning attempt.
   * Attempts payment via the billing provider and handles success/failure.
   */
  async processDunningAttempt(
    attemptId: string,
  ): Promise<DunningAttemptResult> {
    // Use optimistic locking to prevent race conditions
    const attempt = await this.prisma.dunningAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) {
      throw new NotFoundException(`Dunning attempt ${attemptId} not found`);
    }

    if (attempt.status !== "pending") {
      this.logger.debug(
        `Attempt ${attemptId} status is ${attempt.status}, skipping`,
      );
      return {
        attemptId,
        success: attempt.status === "succeeded",
      };
    }

    // Atomically update to processing
    const updated = await this.prisma.dunningAttempt.updateMany({
      where: {
        id: attemptId,
        status: "pending",
      },
      data: {
        status: "processing",
        executedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      // Race condition - another process claimed it
      const current = await this.prisma.dunningAttempt.findUnique({
        where: { id: attemptId },
      });
      return {
        attemptId,
        success: current?.status === "succeeded",
      };
    }

    // Get invoice details
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: attempt.invoiceId },
    });

    if (!invoice) {
      await this.markAttemptFailed(attemptId, "Invoice not found");
      return { attemptId, success: false, failureReason: "Invoice not found" };
    }

    // Check if invoice is already paid (external payment)
    if (invoice.status === "paid") {
      await this.handlePaymentSuccess(attempt.workspaceId, attempt.invoiceId);
      return { attemptId, success: true };
    }

    // Execute payment retry
    const result = await this.executePaymentRetry(attempt.workspaceId, invoice);

    if (result.success) {
      await this.handlePaymentSuccess(attempt.workspaceId, attempt.invoiceId);
      return { attemptId, success: true };
    }

    // Payment failed - handle failure
    return this.handleAttemptFailure(
      attempt,
      result.failureReason ?? "Payment failed",
      result.declineCode,
    );
  }

  /**
   * Execute payment retry via billing provider.
   */
  async executePaymentRetry(
    workspaceId: string,
    invoice: Invoice,
  ): Promise<PaymentRetryResult> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { settings: true },
      });

      const settings = workspace?.settings as Record<string, unknown> | null;
      const provider = this.billingService.getProviderForWorkspace(
        workspaceId,
        invoice.provider,
        settings ?? undefined,
      );

      if (!provider.payInvoice) {
        return {
          success: false,
          failureReason: "Provider does not support invoice payment",
        };
      }

      await provider.payInvoice(invoice.providerInvoiceId);

      this.logger.log(`Payment retry successful for invoice ${invoice.id}`);
      return { success: true };
    } catch (error) {
      const err = error as Error & { code?: string; decline_code?: string };
      this.logger.warn(
        `Payment retry failed for invoice ${invoice.id}: ${err.message}`,
      );
      return {
        success: false,
        failureReason: err.message,
        declineCode: err.decline_code ?? err.code,
      };
    }
  }

  /**
   * Handle successful payment during dunning.
   * Marks dunning as complete and reactivates subscription if needed.
   */
  async handlePaymentSuccess(
    workspaceId: string,
    invoiceId: string,
  ): Promise<void> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, workspaceId },
    });

    if (!invoice) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // Mark invoice dunning as ended
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          dunningEndedAt: new Date(),
        },
      });

      // Cancel any pending dunning attempts
      await tx.dunningAttempt.updateMany({
        where: {
          invoiceId,
          status: "pending",
        },
        data: {
          status: "skipped",
        },
      });

      // Mark current processing attempt as succeeded
      await tx.dunningAttempt.updateMany({
        where: {
          invoiceId,
          status: "processing",
        },
        data: {
          status: "succeeded",
          success: true,
        },
      });

      // Reactivate subscription if it was suspended due to payment failure
      if (invoice.subscriptionId) {
        const subscription = await tx.subscription.findUnique({
          where: { id: invoice.subscriptionId },
        });

        if (
          subscription &&
          (subscription.status === "payment_failed" ||
            subscription.status === "suspended")
        ) {
          await tx.subscription.update({
            where: { id: invoice.subscriptionId },
            data: { status: "active" },
          });
        }
      }
    });

    // Emit recovery event
    await this.outboxService.createEvent({
      workspaceId,
      eventType: "dunning.attempt_succeeded",
      aggregateType: "invoice",
      aggregateId: invoiceId,
      payload: {
        invoiceId,
        subscriptionId: invoice.subscriptionId,
        customerId: invoice.customerId,
        amountPaid: invoice.amountDue,
        currency: invoice.currency,
        recoveredAt: new Date().toISOString(),
      },
    });

    // Send payment_recovered email
    const config = await this.dunningConfigService.getConfig(workspaceId);
    await this.sendDunningEmail(
      workspaceId,
      config,
      invoice.customerId,
      invoiceId,
      "payment_recovered",
    );

    this.logger.log(`Payment recovered for invoice ${invoiceId}`);
  }

  /**
   * Handle failed dunning attempt.
   */
  private async handleAttemptFailure(
    attempt: DunningAttempt,
    failureReason: string,
    declineCode?: string,
  ): Promise<DunningAttemptResult> {
    const config = await this.dunningConfigService.getConfig(
      attempt.workspaceId,
    );

    // Mark attempt as failed
    await this.markAttemptFailed(attempt.id, failureReason, declineCode);

    // Check if this was the last attempt
    const isLastAttempt = this.dunningConfigService.isMaxAttemptsReached(
      config,
      attempt.attemptNumber,
    );

    if (isLastAttempt) {
      // Execute final action
      return this.handleFinalAttemptFailure(
        attempt,
        config,
        failureReason,
        declineCode,
      );
    }

    // Schedule next attempt
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: attempt.invoiceId },
    });

    if (!invoice?.dunningStartedAt) {
      return { attemptId: attempt.id, success: false, failureReason };
    }

    const nextRetryDate = this.dunningConfigService.calculateNextRetryDate(
      config,
      attempt.attemptNumber,
      invoice.dunningStartedAt,
    );

    if (nextRetryDate) {
      await this.prisma.$transaction(async (tx) => {
        // Update invoice with next attempt info
        await tx.invoice.update({
          where: { id: attempt.invoiceId },
          data: {
            dunningAttemptCount: attempt.attemptNumber,
            nextDunningAttemptAt: nextRetryDate,
          },
        });

        // Create next attempt
        await tx.dunningAttempt.create({
          data: {
            workspaceId: attempt.workspaceId,
            invoiceId: attempt.invoiceId,
            subscriptionId: attempt.subscriptionId,
            customerId: attempt.customerId,
            attemptNumber: attempt.attemptNumber + 1,
            status: "pending",
            scheduledAt: nextRetryDate,
          },
        });
      });

      // Emit attempt failed event
      await this.outboxService.createEvent({
        workspaceId: attempt.workspaceId,
        eventType: "dunning.attempt_failed",
        aggregateType: "invoice",
        aggregateId: attempt.invoiceId,
        payload: {
          invoiceId: attempt.invoiceId,
          subscriptionId: attempt.subscriptionId,
          customerId: attempt.customerId,
          attemptNumber: attempt.attemptNumber,
          maxAttempts: config.maxAttempts,
          failureReason,
          declineCode,
          nextAttemptAt: nextRetryDate.toISOString(),
        },
      });

      // Determine email type: final_warning if this is the second-to-last attempt
      const isSecondToLastAttempt =
        attempt.attemptNumber + 1 === config.maxAttempts;
      const emailType: DunningEmailType = isSecondToLastAttempt
        ? "final_warning"
        : "payment_reminder";

      // Send reminder or warning email
      await this.sendDunningEmail(
        attempt.workspaceId,
        config,
        attempt.customerId,
        attempt.invoiceId,
        emailType,
        {
          attemptNumber: attempt.attemptNumber,
          maxAttempts: config.maxAttempts,
          nextRetryDate: nextRetryDate.toISOString(),
        },
      );

      return {
        attemptId: attempt.id,
        success: false,
        failureReason,
        declineCode,
        nextAttemptAt: nextRetryDate,
      };
    }

    return {
      attemptId: attempt.id,
      success: false,
      failureReason,
      declineCode,
    };
  }

  /**
   * Handle final attempt failure - execute final action (suspend/cancel).
   */
  private async handleFinalAttemptFailure(
    attempt: DunningAttempt,
    config: Awaited<ReturnType<typeof this.dunningConfigService.getConfig>>,
    failureReason: string,
    declineCode?: string,
  ): Promise<DunningAttemptResult> {
    const now = new Date();

    // Emit final attempt failed event
    await this.outboxService.createEvent({
      workspaceId: attempt.workspaceId,
      eventType: "dunning.final_attempt_failed",
      aggregateType: "invoice",
      aggregateId: attempt.invoiceId,
      payload: {
        invoiceId: attempt.invoiceId,
        subscriptionId: attempt.subscriptionId,
        customerId: attempt.customerId,
        totalAttempts: attempt.attemptNumber,
        pendingAction: config.finalAction,
        failureReason,
        declineCode,
      },
    });

    // Execute final action
    if (attempt.subscriptionId) {
      await this.executeFinalAction(
        attempt.workspaceId,
        attempt.invoiceId,
        attempt.subscriptionId,
        config.finalAction,
      );
    }

    // Mark dunning as ended
    await this.prisma.invoice.update({
      where: { id: attempt.invoiceId },
      data: {
        dunningEndedAt: now,
        dunningAttemptCount: attempt.attemptNumber,
        nextDunningAttemptAt: null,
      },
    });

    return {
      attemptId: attempt.id,
      success: false,
      failureReason,
      declineCode,
      finalActionTaken: config.finalAction,
    };
  }

  /**
   * Execute final action (suspend or cancel) after all retries exhausted.
   */
  async executeFinalAction(
    workspaceId: string,
    invoiceId: string,
    subscriptionId: string,
    action: "suspend" | "cancel",
  ): Promise<void> {
    const newStatus = action === "suspend" ? "suspended" : "canceled";

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: newStatus },
    });

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { customerId: true, amountDue: true, currency: true },
    });

    // Emit subscription suspended/canceled event
    await this.outboxService.createEvent({
      workspaceId,
      eventType:
        action === "suspend"
          ? "subscription.suspended"
          : "subscription.canceled",
      aggregateType: "subscription",
      aggregateId: subscriptionId,
      payload: {
        subscriptionId,
        customerId: invoice?.customerId,
        reason: "payment_failed",
        invoiceId,
        amountRequired: invoice?.amountDue,
        currency: invoice?.currency,
      },
    });

    // Send subscription suspended/canceled email
    if (invoice?.customerId) {
      const config = await this.dunningConfigService.getConfig(workspaceId);
      const emailType: DunningEmailType =
        action === "suspend"
          ? "subscription_suspended"
          : "subscription_canceled";

      await this.sendDunningEmail(
        workspaceId,
        config,
        invoice.customerId,
        invoiceId,
        emailType,
      );
    }

    this.logger.log(
      `Subscription ${subscriptionId} ${action}ed due to payment failure`,
    );
  }

  /**
   * Stop dunning for an invoice (manual intervention).
   */
  async stopDunning(
    workspaceId: string,
    invoiceId: string,
    reason: string,
  ): Promise<void> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, workspaceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    if (!invoice.dunningStartedAt || invoice.dunningEndedAt) {
      return; // Not in dunning
    }

    await this.prisma.$transaction(async (tx) => {
      // Mark dunning as ended
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          dunningEndedAt: new Date(),
          nextDunningAttemptAt: null,
        },
      });

      // Cancel pending attempts
      await tx.dunningAttempt.updateMany({
        where: {
          invoiceId,
          status: "pending",
        },
        data: {
          status: "skipped",
          failureReason: `Stopped: ${reason}`,
        },
      });
    });

    // Emit dunning ended event
    await this.outboxService.createEvent({
      workspaceId,
      eventType: "dunning.ended",
      aggregateType: "invoice",
      aggregateId: invoiceId,
      payload: {
        invoiceId,
        reason: `manual_stop: ${reason}`,
        stoppedAt: new Date().toISOString(),
      },
    });

    this.logger.log(`Dunning stopped for invoice ${invoiceId}: ${reason}`);
  }

  /**
   * Trigger manual payment retry.
   */
  async triggerManualRetry(
    workspaceId: string,
    invoiceId: string,
  ): Promise<DunningAttemptResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, workspaceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    if (invoice.status !== "open") {
      return {
        attemptId: "manual",
        success: false,
        failureReason: `Invoice status is ${invoice.status}, cannot retry`,
      };
    }

    // Execute payment retry
    const result = await this.executePaymentRetry(workspaceId, invoice);

    if (result.success) {
      await this.handlePaymentSuccess(workspaceId, invoiceId);
    }

    return {
      attemptId: "manual",
      success: result.success,
      failureReason: result.failureReason,
      declineCode: result.declineCode,
    };
  }

  /**
   * Get invoices currently in dunning for a workspace.
   */
  async getInvoicesInDunning(
    workspaceId: string,
    params: { limit: number; cursor?: string },
  ): Promise<{
    data: InvoiceWithDunning[];
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    const { limit, cursor } = params;
    const take = limit + 1;

    const invoices = await this.prisma.invoice.findMany({
      where: {
        workspaceId,
        dunningStartedAt: { not: null },
        dunningEndedAt: null,
      },
      include: {
        customer: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { dunningStartedAt: "desc" },
      take,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = invoices.length > limit;
    const data = hasMore ? invoices.slice(0, limit) : invoices;
    const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

    return { data, hasMore, nextCursor };
  }

  /**
   * Get dunning statistics for dashboard.
   */
  async getDunningStats(workspaceId: string): Promise<DunningStats> {
    const [invoicesInDunning, amountsByCurrency, attemptStats] =
      await Promise.all([
        this.prisma.invoice.count({
          where: {
            workspaceId,
            dunningStartedAt: { not: null },
            dunningEndedAt: null,
          },
        }),
        this.prisma.invoice.groupBy({
          by: ["currency"],
          where: {
            workspaceId,
            dunningStartedAt: { not: null },
            dunningEndedAt: null,
          },
          _sum: { amountDue: true },
        }),
        this.prisma.dunningAttempt.groupBy({
          by: ["status"],
          where: { workspaceId },
          _count: true,
        }),
      ]);

    const attemptsByStatus = {
      pending: 0,
      succeeded: 0,
      failed: 0,
    };

    for (const stat of attemptStats) {
      if (stat.status === "pending" || stat.status === "processing") {
        attemptsByStatus.pending += stat._count;
      } else if (stat.status === "succeeded") {
        attemptsByStatus.succeeded = stat._count;
      } else if (stat.status === "failed") {
        attemptsByStatus.failed = stat._count;
      }
    }

    const totalAttempts = attemptsByStatus.succeeded + attemptsByStatus.failed;
    const recoveryRate =
      totalAttempts > 0
        ? (attemptsByStatus.succeeded / totalAttempts) * 100
        : 0;

    // Build amounts by currency array
    const currencyAmounts: AmountByCurrency[] = amountsByCurrency.map(
      (item) => ({
        currency: item.currency.toLowerCase(),
        amount: item._sum.amountDue ?? 0,
      }),
    );

    // Calculate total and primary currency for backward compatibility
    const totalAmountAtRisk = currencyAmounts.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const primaryCurrency =
      currencyAmounts.length > 0
        ? currencyAmounts.reduce((a, b) => (a.amount > b.amount ? a : b))
            .currency
        : "usd";

    return {
      invoicesInDunning,
      totalAmountAtRisk,
      currency: primaryCurrency,
      amountsByCurrency: currencyAmounts,
      recoveryRate: Math.round(recoveryRate * 100) / 100,
      attemptsByStatus,
    };
  }

  /**
   * Mark a dunning attempt as failed.
   */
  private async markAttemptFailed(
    attemptId: string,
    failureReason: string,
    declineCode?: string,
  ): Promise<void> {
    await this.prisma.dunningAttempt.update({
      where: { id: attemptId },
      data: {
        status: "failed",
        success: false,
        failureReason,
        declineCode,
      },
    });
  }

  /**
   * Send a dunning email notification if emails are enabled.
   */
  private async sendDunningEmail(
    workspaceId: string,
    config: DunningConfigWithDefaults,
    customerId: string,
    invoiceId: string,
    type: DunningEmailType,
    extraVariables?: {
      attemptNumber?: number;
      maxAttempts?: number;
      nextRetryDate?: string;
    },
  ): Promise<void> {
    // Skip if emails are not enabled
    if (!config.emailsEnabled) {
      this.logger.debug(
        `Emails not enabled for workspace ${workspaceId}, skipping ${type} email`,
      );
      return;
    }

    // Skip if email service is not configured
    if (!this.emailService.isConfigured()) {
      this.logger.debug(`Email service not configured, skipping ${type} email`);
      return;
    }

    try {
      // Get invoice details for email variables
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: {
            select: { name: true, email: true },
          },
        },
      });

      if (!invoice) {
        this.logger.warn(`Invoice ${invoiceId} not found for email`);
        return;
      }

      // Get dunning config for template lookup
      const rawConfig =
        await this.dunningConfigService.getRawConfig(workspaceId);

      await this.emailService.sendDunningEmail({
        workspaceId,
        customerId,
        invoiceId,
        dunningConfigId: rawConfig?.id,
        type,
        variables: {
          customerName: invoice.customer.name ?? undefined,
          customerEmail: invoice.customer.email,
          invoiceAmount: this.formatAmount(invoice.amountDue, invoice.currency),
          invoiceCurrency: invoice.currency.toUpperCase(),
          invoiceNumber: invoice.providerInvoiceId,
          attemptNumber: extraVariables?.attemptNumber,
          maxAttempts: extraVariables?.maxAttempts ?? config.maxAttempts,
          nextRetryDate: extraVariables?.nextRetryDate,
          updatePaymentUrl: invoice.providerInvoiceUrl ?? undefined,
          companyName: config.fromName ?? "Billing Team",
          supportEmail: config.replyToEmail ?? config.fromEmail ?? undefined,
        },
        fromEmail: config.fromEmail ?? undefined,
        fromName: config.fromName ?? undefined,
        replyToEmail: config.replyToEmail ?? undefined,
      });

      this.logger.log(`Sent ${type} email for invoice ${invoiceId}`);
    } catch (error) {
      // Log but don't throw - email failure shouldn't block dunning flow
      this.logger.error(
        `Failed to send ${type} email for invoice ${invoiceId}: ${error}`,
      );
    }
  }

  /**
   * Format amount in cents to display string.
   */
  private formatAmount(amountCents: number, currency: string): string {
    const amount = amountCents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  }
}
