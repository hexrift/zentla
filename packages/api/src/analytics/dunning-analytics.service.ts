import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

/**
 * Dunning analytics summary.
 */
export interface DunningAnalytics {
  /** Total invoices currently in dunning */
  invoicesInDunning: number;
  /** Total amount at risk across all currencies (in cents) */
  totalAmountAtRisk: number;
  /** Amount at risk broken down by currency */
  amountAtRiskByCurrency: Array<{ currency: string; amount: number }>;
  /** Total amount recovered this period */
  amountRecovered: number;
  /** Recovery rate as a percentage (0-100) */
  recoveryRate: number;
  /** Average days to recover payment */
  averageDaysToRecovery: number;
  /** Number of attempts by status */
  attemptsByStatus: {
    pending: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  /** Dunning outcomes */
  outcomes: {
    recovered: number;
    suspended: number;
    canceled: number;
    stillInDunning: number;
  };
}

/**
 * Dunning trend data point.
 */
export interface DunningTrendPoint {
  date: Date;
  invoicesInDunning: number;
  amountAtRisk: number;
  amountRecovered: number;
  recoveryRate: number;
  newDunningStarted: number;
}

/**
 * Recovery funnel data.
 */
export interface RecoveryFunnel {
  totalStarted: number;
  recoveredAttempt1: number;
  recoveredAttempt2: number;
  recoveredAttempt3: number;
  recoveredAttempt4Plus: number;
  finalActionTaken: number;
  stillInProgress: number;
}

@Injectable()
export class DunningAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current dunning analytics.
   */
  async getDunningAnalytics(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DunningAnalytics> {
    const now = new Date();
    const periodStart = startDate ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = endDate ?? now;

    // Get invoices currently in dunning
    const invoicesInDunning = await this.prisma.invoice.count({
      where: {
        workspaceId,
        dunningStartedAt: { not: null },
        dunningEndedAt: null,
      },
    });

    // Get amount at risk by currency
    const amountAtRiskResult = await this.prisma.invoice.groupBy({
      by: ["currency"],
      where: {
        workspaceId,
        dunningStartedAt: { not: null },
        dunningEndedAt: null,
      },
      _sum: { amountDue: true },
    });

    const amountAtRiskByCurrency = amountAtRiskResult.map((r) => ({
      currency: r.currency,
      amount: r._sum.amountDue ?? 0,
    }));

    const totalAmountAtRisk = amountAtRiskByCurrency.reduce(
      (sum, r) => sum + r.amount,
      0,
    );

    // Get amount recovered this period
    const recoveredInvoices = await this.prisma.invoice.findMany({
      where: {
        workspaceId,
        dunningStartedAt: { not: null },
        status: "paid",
        paidAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      select: { amountPaid: true },
    });

    const amountRecovered = recoveredInvoices.reduce(
      (sum, inv) => sum + inv.amountPaid,
      0,
    );

    // Calculate recovery rate
    const totalDunningStartedThisPeriod = await this.prisma.invoice.count({
      where: {
        workspaceId,
        dunningStartedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    const recoveredThisPeriod = await this.prisma.invoice.count({
      where: {
        workspaceId,
        dunningStartedAt: { not: null },
        status: "paid",
        paidAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    const recoveryRate =
      totalDunningStartedThisPeriod > 0
        ? Math.round((recoveredThisPeriod / totalDunningStartedThisPeriod) * 100)
        : 0;

    // Calculate average days to recovery
    const recoveredWithDates = await this.prisma.invoice.findMany({
      where: {
        workspaceId,
        dunningStartedAt: { not: null },
        status: "paid",
        paidAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      select: {
        dunningStartedAt: true,
        paidAt: true,
      },
    });

    let totalDaysToRecovery = 0;
    for (const inv of recoveredWithDates) {
      if (inv.dunningStartedAt && inv.paidAt) {
        const days = Math.ceil(
          (inv.paidAt.getTime() - inv.dunningStartedAt.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        totalDaysToRecovery += days;
      }
    }

    const averageDaysToRecovery =
      recoveredWithDates.length > 0
        ? Math.round(totalDaysToRecovery / recoveredWithDates.length)
        : 0;

    // Get attempts by status
    const attemptsByStatusResult = await this.prisma.dunningAttempt.groupBy({
      by: ["status"],
      where: {
        workspaceId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      _count: true,
    });

    const attemptsByStatus = {
      pending: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    };

    for (const r of attemptsByStatusResult) {
      if (r.status === "pending" || r.status === "processing") {
        attemptsByStatus.pending += r._count;
      } else if (r.status === "succeeded") {
        attemptsByStatus.succeeded = r._count;
      } else if (r.status === "failed") {
        attemptsByStatus.failed = r._count;
      } else if (r.status === "skipped") {
        attemptsByStatus.skipped = r._count;
      }
    }

    // Get dunning outcomes
    const [recovered, stillInDunning] = await Promise.all([
      this.prisma.invoice.count({
        where: {
          workspaceId,
          dunningStartedAt: {
            gte: periodStart,
            lte: periodEnd,
          },
          status: "paid",
        },
      }),
      this.prisma.invoice.count({
        where: {
          workspaceId,
          dunningStartedAt: {
            gte: periodStart,
            lte: periodEnd,
          },
          dunningEndedAt: null,
        },
      }),
    ]);

    // Get invoices with final action taken (ended but not paid)
    const endedNotRecovered = await this.prisma.invoice.findMany({
      where: {
        workspaceId,
        dunningStartedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        dunningEndedAt: { not: null },
        status: { not: "paid" },
      },
      select: { subscriptionId: true },
    });

    // Count suspended vs canceled by checking subscription status
    let suspended = 0;
    let canceled = 0;
    if (endedNotRecovered.length > 0) {
      const subscriptionIds = endedNotRecovered
        .map((inv) => inv.subscriptionId)
        .filter((id): id is string => id != null);

      if (subscriptionIds.length > 0) {
        const subscriptions = await this.prisma.subscription.findMany({
          where: {
            id: { in: subscriptionIds },
          },
          select: { status: true },
        });

        for (const sub of subscriptions) {
          if (sub.status === "suspended" || sub.status === "payment_failed") suspended++;
          else if (sub.status === "canceled") canceled++;
        }
      }
    }

    return {
      invoicesInDunning,
      totalAmountAtRisk,
      amountAtRiskByCurrency,
      amountRecovered,
      recoveryRate,
      averageDaysToRecovery,
      attemptsByStatus,
      outcomes: {
        recovered,
        suspended,
        canceled,
        stillInDunning,
      },
    };
  }

  /**
   * Get dunning trend over time.
   */
  async getDunningTrend(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    period: "daily" | "weekly" | "monthly" = "daily",
  ): Promise<DunningTrendPoint[]> {
    const points: DunningTrendPoint[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const periodEnd = this.getNextPeriodDate(current, period);

      // Get metrics for this period
      const [invoicesInDunning, amountAtRiskResult, recoveredAmount, newDunningStarted] =
        await Promise.all([
          this.prisma.invoice.count({
            where: {
              workspaceId,
              dunningStartedAt: { lte: current },
              OR: [
                { dunningEndedAt: null },
                { dunningEndedAt: { gt: current } },
              ],
            },
          }),
          this.prisma.invoice.aggregate({
            where: {
              workspaceId,
              dunningStartedAt: { lte: current },
              OR: [
                { dunningEndedAt: null },
                { dunningEndedAt: { gt: current } },
              ],
            },
            _sum: { amountDue: true },
          }),
          this.prisma.invoice.aggregate({
            where: {
              workspaceId,
              dunningStartedAt: { not: null },
              status: "paid",
              paidAt: {
                gte: current,
                lt: periodEnd,
              },
            },
            _sum: { amountPaid: true },
          }),
          this.prisma.invoice.count({
            where: {
              workspaceId,
              dunningStartedAt: {
                gte: current,
                lt: periodEnd,
              },
            },
          }),
        ]);

      // Calculate recovery rate for this period
      const totalInPeriod = await this.prisma.invoice.count({
        where: {
          workspaceId,
          dunningStartedAt: {
            gte: current,
            lt: periodEnd,
          },
        },
      });

      const recoveredInPeriod = await this.prisma.invoice.count({
        where: {
          workspaceId,
          dunningStartedAt: {
            gte: current,
            lt: periodEnd,
          },
          status: "paid",
        },
      });

      const recoveryRate =
        totalInPeriod > 0
          ? Math.round((recoveredInPeriod / totalInPeriod) * 100)
          : 0;

      points.push({
        date: new Date(current),
        invoicesInDunning,
        amountAtRisk: amountAtRiskResult._sum.amountDue ?? 0,
        amountRecovered: recoveredAmount._sum.amountPaid ?? 0,
        recoveryRate,
        newDunningStarted,
      });

      // Move to next period
      current.setTime(periodEnd.getTime());
    }

    return points;
  }

  /**
   * Get recovery funnel data.
   */
  async getRecoveryFunnel(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<RecoveryFunnel> {
    const now = new Date();
    const periodStart = startDate ?? new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const periodEnd = endDate ?? now;

    // Get all invoices that entered dunning in the period
    const dunningInvoices = await this.prisma.invoice.findMany({
      where: {
        workspaceId,
        dunningStartedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      select: {
        id: true,
        status: true,
        dunningEndedAt: true,
        dunningAttemptCount: true,
      },
    });

    const totalStarted = dunningInvoices.length;

    // Count by recovery attempt
    let recoveredAttempt1 = 0;
    let recoveredAttempt2 = 0;
    let recoveredAttempt3 = 0;
    let recoveredAttempt4Plus = 0;
    let finalActionTaken = 0;
    let stillInProgress = 0;

    for (const inv of dunningInvoices) {
      if (inv.status === "paid") {
        if (inv.dunningAttemptCount <= 1) recoveredAttempt1++;
        else if (inv.dunningAttemptCount === 2) recoveredAttempt2++;
        else if (inv.dunningAttemptCount === 3) recoveredAttempt3++;
        else recoveredAttempt4Plus++;
      } else if (inv.dunningEndedAt) {
        finalActionTaken++;
      } else {
        stillInProgress++;
      }
    }

    return {
      totalStarted,
      recoveredAttempt1,
      recoveredAttempt2,
      recoveredAttempt3,
      recoveredAttempt4Plus,
      finalActionTaken,
      stillInProgress,
    };
  }

  /**
   * Get decline code breakdown.
   */
  async getDeclineCodeBreakdown(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Array<{ code: string; count: number; percentage: number }>> {
    const now = new Date();
    const periodStart = startDate ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = endDate ?? now;

    const attempts = await this.prisma.dunningAttempt.findMany({
      where: {
        workspaceId,
        status: "failed",
        declineCode: { not: null },
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      select: { declineCode: true },
    });

    // Count by decline code
    const codeCount = new Map<string, number>();
    for (const attempt of attempts) {
      const code = attempt.declineCode ?? "unknown";
      codeCount.set(code, (codeCount.get(code) ?? 0) + 1);
    }

    const total = attempts.length;
    return Array.from(codeCount.entries())
      .map(([code, count]) => ({
        code,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private getNextPeriodDate(current: Date, period: string): Date {
    const next = new Date(current);
    switch (period) {
      case "daily":
        next.setDate(next.getDate() + 1);
        break;
      case "weekly":
        next.setDate(next.getDate() + 7);
        break;
      case "monthly":
        next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  }
}
