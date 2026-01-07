import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type {
  SnapshotPeriod,
  RevenueEventType,
  SubscriptionStatus,
} from "@prisma/client";

/**
 * MRR breakdown by component.
 */
export interface MrrBreakdown {
  total: number;
  new: number;
  expansion: number;
  contraction: number;
  churned: number;
  reactivation: number;
  netNew: number;
}

/**
 * Customer metrics summary.
 */
export interface CustomerMetrics {
  total: number;
  active: number;
  new: number;
  churned: number;
  reactivated: number;
}

/**
 * Revenue metrics for a period.
 */
export interface RevenueMetrics {
  mrr: number;
  arr: number;
  mrrBreakdown: MrrBreakdown;
  customers: CustomerMetrics;
  churnRate: number;
  netRevenueRetention: number;
  grossRevenueRetention: number;
  arpu: number;
  ltv: number;
  currency: string;
}

/**
 * Revenue trend data point.
 */
export interface RevenueTrendPoint {
  date: Date;
  mrr: number;
  arr: number;
  customers: number;
  churnRate: number;
}

/**
 * Cohort analysis row.
 */
export interface CohortRow {
  cohortMonth: Date;
  customersAtStart: number;
  months: Array<{
    monthNumber: number;
    customersRemaining: number;
    mrrRemaining: number;
    customerRetention: number;
    revenueRetention: number;
  }>;
}

/**
 * Options for recording revenue events.
 */
export interface RecordRevenueEventOptions {
  customerId: string;
  subscriptionId?: string;
  type: RevenueEventType;
  amount: number;
  mrrDelta?: number;
  previousMrr?: number;
  newMrr?: number;
  previousOfferId?: string;
  newOfferId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

@Injectable()
export class RevenueAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // REVENUE EVENTS
  // =========================================================================

  /**
   * Record a revenue event.
   */
  async recordRevenueEvent(
    workspaceId: string,
    options: RecordRevenueEventOptions,
  ): Promise<void> {
    await this.prisma.revenueEvent.create({
      data: {
        workspaceId,
        customerId: options.customerId,
        subscriptionId: options.subscriptionId,
        type: options.type,
        amount: options.amount,
        mrrDelta: options.mrrDelta ?? 0,
        previousMrr: options.previousMrr,
        newMrr: options.newMrr,
        previousOfferId: options.previousOfferId,
        newOfferId: options.newOfferId,
        reason: options.reason,
        metadata: (options.metadata ?? {}) as object,
        occurredAt: options.occurredAt ?? new Date(),
      },
    });
  }

  /**
   * Get revenue events for a workspace.
   */
  async getRevenueEvents(
    workspaceId: string,
    filters?: {
      customerId?: string;
      subscriptionId?: string;
      type?: RevenueEventType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    },
  ) {
    const where: Record<string, unknown> = { workspaceId };

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }
    if (filters?.subscriptionId) {
      where.subscriptionId = filters.subscriptionId;
    }
    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.startDate || filters?.endDate) {
      where.occurredAt = {};
      if (filters.startDate) {
        (where.occurredAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.occurredAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    return this.prisma.revenueEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: filters?.limit ?? 100,
    });
  }

  // =========================================================================
  // REAL-TIME METRICS
  // =========================================================================

  /**
   * Calculate current MRR from active subscriptions.
   */
  async calculateCurrentMrr(workspaceId: string): Promise<number> {
    const activeStatuses: SubscriptionStatus[] = ["active", "trialing"];

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        workspaceId,
        status: { in: activeStatuses },
      },
      include: {
        offerVersion: true,
      },
    });

    let totalMrr = 0;

    for (const subscription of subscriptions) {
      const config = subscription.offerVersion?.config as {
        pricing?: {
          amount?: number;
          interval?: string;
          intervalCount?: number;
        };
      } | null;

      if (config?.pricing?.amount) {
        const amount = config.pricing.amount;
        const interval = config.pricing.interval || "month";
        const intervalCount = config.pricing.intervalCount || 1;

        // Normalize to monthly
        const monthlyAmount = this.normalizeToMonthly(
          amount,
          interval,
          intervalCount,
        );
        totalMrr += monthlyAmount;
      }
    }

    return totalMrr;
  }

  /**
   * Get current revenue metrics.
   */
  async getCurrentMetrics(workspaceId: string): Promise<RevenueMetrics> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );

    // Get workspace settings for currency
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });
    const settings = workspace?.settings as { defaultCurrency?: string } | null;
    const currency = settings?.defaultCurrency || "usd";

    // Calculate current MRR
    const mrr = await this.calculateCurrentMrr(workspaceId);
    const arr = mrr * 12;

    // Get customer counts
    const activeStatuses: SubscriptionStatus[] = ["active", "trialing"];

    const [totalCustomers, activeSubscriptions] = await Promise.all([
      this.prisma.customer.count({ where: { workspaceId } }),
      this.prisma.subscription.count({
        where: { workspaceId, status: { in: activeStatuses } },
      }),
    ]);

    // Get this month's events for breakdown
    const monthEvents = await this.prisma.revenueEvent.findMany({
      where: {
        workspaceId,
        occurredAt: { gte: startOfMonth },
      },
    });

    const mrrBreakdown = this.calculateMrrBreakdown(monthEvents);

    // Get previous month's MRR for retention calculation
    const previousSnapshot = await this.prisma.revenueSnapshot.findFirst({
      where: {
        workspaceId,
        date: { gte: startOfPreviousMonth, lt: startOfMonth },
        period: "monthly",
      },
      orderBy: { date: "desc" },
    });

    const previousMrr = previousSnapshot?.mrr ?? mrr;

    // Calculate retention and churn
    const churnedMrr = mrrBreakdown.churned;
    const contractionMrr = mrrBreakdown.contraction;
    const expansionMrr = mrrBreakdown.expansion;

    const grossRevenueRetention =
      previousMrr > 0
        ? Math.round(
            ((previousMrr - churnedMrr - contractionMrr) / previousMrr) * 10000,
          )
        : 10000;

    const netRevenueRetention =
      previousMrr > 0
        ? Math.round(
            ((previousMrr - churnedMrr - contractionMrr + expansionMrr) /
              previousMrr) *
              10000,
          )
        : 10000;

    const churnRate =
      previousMrr > 0 ? Math.round((churnedMrr / previousMrr) * 10000) : 0;

    // Calculate ARPU and LTV
    const arpu =
      activeSubscriptions > 0 ? Math.round(mrr / activeSubscriptions) : 0;
    const monthlyChurnRate = churnRate / 10000;
    const ltv =
      monthlyChurnRate > 0 ? Math.round(arpu / monthlyChurnRate) : arpu * 24;

    // Count new and churned customers this month
    const newCustomers = monthEvents.filter(
      (e) => e.type === "new_subscription",
    ).length;
    const churnedCustomers = monthEvents.filter(
      (e) => e.type === "cancellation",
    ).length;
    const reactivatedCustomers = monthEvents.filter(
      (e) => e.type === "reactivation",
    ).length;

    return {
      mrr,
      arr,
      mrrBreakdown,
      customers: {
        total: totalCustomers,
        active: activeSubscriptions,
        new: newCustomers,
        churned: churnedCustomers,
        reactivated: reactivatedCustomers,
      },
      churnRate,
      netRevenueRetention,
      grossRevenueRetention,
      arpu,
      ltv,
      currency,
    };
  }

  // =========================================================================
  // SNAPSHOTS
  // =========================================================================

  /**
   * Create a revenue snapshot for a specific date.
   */
  async createSnapshot(
    workspaceId: string,
    date: Date,
    period: SnapshotPeriod = "daily",
  ): Promise<void> {
    const metrics = await this.getCurrentMetrics(workspaceId);

    await this.prisma.revenueSnapshot.upsert({
      where: {
        workspaceId_date_period: {
          workspaceId,
          date,
          period,
        },
      },
      create: {
        workspaceId,
        date,
        period,
        mrr: metrics.mrr,
        arr: metrics.arr,
        newMrr: metrics.mrrBreakdown.new,
        expansionMrr: metrics.mrrBreakdown.expansion,
        contractionMrr: metrics.mrrBreakdown.contraction,
        churnedMrr: metrics.mrrBreakdown.churned,
        reactivationMrr: metrics.mrrBreakdown.reactivation,
        netNewMrr: metrics.mrrBreakdown.netNew,
        totalCustomers: metrics.customers.total,
        activeSubscriptions: metrics.customers.active,
        newCustomers: metrics.customers.new,
        churnedCustomers: metrics.customers.churned,
        reactivatedCustomers: metrics.customers.reactivated,
        churnRate: metrics.churnRate,
        netRevenueRetention: metrics.netRevenueRetention,
        grossRevenueRetention: metrics.grossRevenueRetention,
        arpu: metrics.arpu,
        ltv: metrics.ltv,
        currency: metrics.currency,
      },
      update: {
        mrr: metrics.mrr,
        arr: metrics.arr,
        newMrr: metrics.mrrBreakdown.new,
        expansionMrr: metrics.mrrBreakdown.expansion,
        contractionMrr: metrics.mrrBreakdown.contraction,
        churnedMrr: metrics.mrrBreakdown.churned,
        reactivationMrr: metrics.mrrBreakdown.reactivation,
        netNewMrr: metrics.mrrBreakdown.netNew,
        totalCustomers: metrics.customers.total,
        activeSubscriptions: metrics.customers.active,
        newCustomers: metrics.customers.new,
        churnedCustomers: metrics.customers.churned,
        reactivatedCustomers: metrics.customers.reactivated,
        churnRate: metrics.churnRate,
        netRevenueRetention: metrics.netRevenueRetention,
        grossRevenueRetention: metrics.grossRevenueRetention,
        arpu: metrics.arpu,
        ltv: metrics.ltv,
      },
    });
  }

  /**
   * Get revenue trend over time.
   */
  async getRevenueTrend(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    period: SnapshotPeriod = "daily",
  ): Promise<RevenueTrendPoint[]> {
    const snapshots = await this.prisma.revenueSnapshot.findMany({
      where: {
        workspaceId,
        period,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: "asc" },
    });

    return snapshots.map((s) => ({
      date: s.date,
      mrr: s.mrr,
      arr: s.arr,
      customers: s.activeSubscriptions,
      churnRate: s.churnRate / 100, // Convert basis points to percentage
    }));
  }

  /**
   * Get the latest snapshot for a workspace.
   */
  async getLatestSnapshot(
    workspaceId: string,
    period: SnapshotPeriod = "daily",
  ) {
    return this.prisma.revenueSnapshot.findFirst({
      where: { workspaceId, period },
      orderBy: { date: "desc" },
    });
  }

  // =========================================================================
  // COHORT ANALYSIS
  // =========================================================================

  /**
   * Update cohort data for a specific month.
   */
  async updateCohort(
    workspaceId: string,
    cohortMonth: Date,
    monthNumber: number,
  ): Promise<void> {
    // Get customers acquired in cohort month
    const cohortStart = new Date(
      cohortMonth.getFullYear(),
      cohortMonth.getMonth(),
      1,
    );
    const cohortEnd = new Date(
      cohortMonth.getFullYear(),
      cohortMonth.getMonth() + 1,
      0,
    );

    // Find customers whose first subscription was in this cohort month
    const cohortCustomers = await this.prisma.revenueEvent.findMany({
      where: {
        workspaceId,
        type: "new_subscription",
        occurredAt: {
          gte: cohortStart,
          lte: cohortEnd,
        },
      },
      distinct: ["customerId"],
    });

    const customersAtStart = cohortCustomers.length;
    if (customersAtStart === 0) return;

    // Get MRR at start
    const startMrrEvents = await this.prisma.revenueEvent.findMany({
      where: {
        workspaceId,
        customerId: { in: cohortCustomers.map((c) => c.customerId) },
        type: "new_subscription",
        occurredAt: {
          gte: cohortStart,
          lte: cohortEnd,
        },
      },
    });
    const mrrAtStart = startMrrEvents.reduce(
      (sum, e) => sum + (e.newMrr ?? e.amount),
      0,
    );

    // Get current status of cohort customers
    const activeStatuses: SubscriptionStatus[] = ["active", "trialing"];

    const remainingSubscriptions = await this.prisma.subscription.findMany({
      where: {
        workspaceId,
        customerId: { in: cohortCustomers.map((c) => c.customerId) },
        status: { in: activeStatuses },
      },
      include: { offerVersion: true },
    });

    const customersRemaining = new Set(
      remainingSubscriptions.map((s) => s.customerId),
    ).size;

    // Calculate remaining MRR
    let mrrRemaining = 0;
    for (const sub of remainingSubscriptions) {
      const config = sub.offerVersion?.config as {
        pricing?: {
          amount?: number;
          interval?: string;
          intervalCount?: number;
        };
      } | null;
      if (config?.pricing?.amount) {
        mrrRemaining += this.normalizeToMonthly(
          config.pricing.amount,
          config.pricing.interval || "month",
          config.pricing.intervalCount || 1,
        );
      }
    }

    // Calculate retention rates
    const customerRetention =
      customersAtStart > 0
        ? Math.round((customersRemaining / customersAtStart) * 10000)
        : 0;
    const revenueRetention =
      mrrAtStart > 0 ? Math.round((mrrRemaining / mrrAtStart) * 10000) : 0;

    await this.prisma.customerCohort.upsert({
      where: {
        workspaceId_cohortMonth_monthNumber: {
          workspaceId,
          cohortMonth: cohortStart,
          monthNumber,
        },
      },
      create: {
        workspaceId,
        cohortMonth: cohortStart,
        monthNumber,
        customersAtStart,
        customersRemaining,
        mrrAtStart,
        mrrRemaining,
        customerRetention,
        revenueRetention,
      },
      update: {
        customersRemaining,
        mrrRemaining,
        customerRetention,
        revenueRetention,
      },
    });
  }

  /**
   * Get cohort analysis data.
   */
  async getCohortAnalysis(
    workspaceId: string,
    startMonth: Date,
    months: number = 12,
  ): Promise<CohortRow[]> {
    const cohorts = await this.prisma.customerCohort.findMany({
      where: {
        workspaceId,
        cohortMonth: { gte: startMonth },
      },
      orderBy: [{ cohortMonth: "asc" }, { monthNumber: "asc" }],
    });

    // Group by cohort month
    const cohortMap = new Map<string, CohortRow>();

    for (const cohort of cohorts) {
      const key = cohort.cohortMonth.toISOString();
      if (!cohortMap.has(key)) {
        cohortMap.set(key, {
          cohortMonth: cohort.cohortMonth,
          customersAtStart: cohort.customersAtStart,
          months: [],
        });
      }

      const row = cohortMap.get(key)!;
      row.months.push({
        monthNumber: cohort.monthNumber,
        customersRemaining: cohort.customersRemaining,
        mrrRemaining: cohort.mrrRemaining,
        customerRetention: cohort.customerRetention / 100,
        revenueRetention: cohort.revenueRetention / 100,
      });
    }

    return Array.from(cohortMap.values()).slice(0, months);
  }

  // =========================================================================
  // SUMMARY & COMPARISON
  // =========================================================================

  /**
   * Get period-over-period comparison.
   */
  async getPeriodComparison(
    workspaceId: string,
    _currentStart: Date,
    _currentEnd: Date,
    previousStart: Date,
    previousEnd: Date,
  ): Promise<{
    current: RevenueMetrics;
    previous: RevenueMetrics;
    changes: {
      mrr: number;
      arr: number;
      customers: number;
      churnRate: number;
      arpu: number;
    };
  }> {
    // Get current metrics
    const current = await this.getCurrentMetrics(workspaceId);

    // Get previous period snapshot
    const previousSnapshot = await this.prisma.revenueSnapshot.findFirst({
      where: {
        workspaceId,
        date: {
          gte: previousStart,
          lte: previousEnd,
        },
      },
      orderBy: { date: "desc" },
    });

    const previous: RevenueMetrics = previousSnapshot
      ? {
          mrr: previousSnapshot.mrr,
          arr: previousSnapshot.arr,
          mrrBreakdown: {
            total: previousSnapshot.mrr,
            new: previousSnapshot.newMrr,
            expansion: previousSnapshot.expansionMrr,
            contraction: previousSnapshot.contractionMrr,
            churned: previousSnapshot.churnedMrr,
            reactivation: previousSnapshot.reactivationMrr,
            netNew: previousSnapshot.netNewMrr,
          },
          customers: {
            total: previousSnapshot.totalCustomers,
            active: previousSnapshot.activeSubscriptions,
            new: previousSnapshot.newCustomers,
            churned: previousSnapshot.churnedCustomers,
            reactivated: previousSnapshot.reactivatedCustomers,
          },
          churnRate: previousSnapshot.churnRate,
          netRevenueRetention: previousSnapshot.netRevenueRetention,
          grossRevenueRetention: previousSnapshot.grossRevenueRetention,
          arpu: previousSnapshot.arpu,
          ltv: previousSnapshot.ltv,
          currency: previousSnapshot.currency,
        }
      : current;

    // Calculate percentage changes
    const calculateChange = (curr: number, prev: number): number => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 10000) / 100;
    };

    return {
      current,
      previous,
      changes: {
        mrr: calculateChange(current.mrr, previous.mrr),
        arr: calculateChange(current.arr, previous.arr),
        customers: calculateChange(
          current.customers.active,
          previous.customers.active,
        ),
        churnRate: calculateChange(current.churnRate, previous.churnRate),
        arpu: calculateChange(current.arpu, previous.arpu),
      },
    };
  }

  /**
   * Get top customers by MRR.
   */
  async getTopCustomers(
    workspaceId: string,
    limit: number = 10,
  ): Promise<
    Array<{
      customerId: string;
      customerEmail: string;
      mrr: number;
      subscriptionCount: number;
    }>
  > {
    const activeStatuses: SubscriptionStatus[] = ["active", "trialing"];

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        workspaceId,
        status: { in: activeStatuses },
      },
      include: {
        customer: true,
        offerVersion: true,
      },
    });

    // Group by customer and calculate MRR
    const customerMrr = new Map<
      string,
      { email: string; mrr: number; count: number }
    >();

    for (const sub of subscriptions) {
      const config = sub.offerVersion?.config as {
        pricing?: {
          amount?: number;
          interval?: string;
          intervalCount?: number;
        };
      } | null;

      const monthlyAmount = config?.pricing?.amount
        ? this.normalizeToMonthly(
            config.pricing.amount,
            config.pricing.interval || "month",
            config.pricing.intervalCount || 1,
          )
        : 0;

      const existing = customerMrr.get(sub.customerId) || {
        email: sub.customer.email,
        mrr: 0,
        count: 0,
      };
      existing.mrr += monthlyAmount;
      existing.count += 1;
      customerMrr.set(sub.customerId, existing);
    }

    // Sort and return top N
    return Array.from(customerMrr.entries())
      .map(([customerId, data]) => ({
        customerId,
        customerEmail: data.email,
        mrr: data.mrr,
        subscriptionCount: data.count,
      }))
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, limit);
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private normalizeToMonthly(
    amount: number,
    interval: string,
    intervalCount: number,
  ): number {
    const totalAmount = amount;
    const totalMonths = this.intervalToMonths(interval) * intervalCount;
    return Math.round(totalAmount / totalMonths);
  }

  private intervalToMonths(interval: string): number {
    switch (interval) {
      case "day":
        return 1 / 30;
      case "week":
        return 1 / 4;
      case "month":
        return 1;
      case "quarter":
        return 3;
      case "year":
        return 12;
      default:
        return 1;
    }
  }

  private calculateMrrBreakdown(
    events: Array<{ type: RevenueEventType; mrrDelta: number }>,
  ): MrrBreakdown {
    const breakdown: MrrBreakdown = {
      total: 0,
      new: 0,
      expansion: 0,
      contraction: 0,
      churned: 0,
      reactivation: 0,
      netNew: 0,
    };

    for (const event of events) {
      switch (event.type) {
        case "new_subscription":
        case "trial_converted":
          breakdown.new += Math.abs(event.mrrDelta);
          break;
        case "upgrade":
          breakdown.expansion += Math.abs(event.mrrDelta);
          break;
        case "downgrade":
          breakdown.contraction += Math.abs(event.mrrDelta);
          break;
        case "cancellation":
          breakdown.churned += Math.abs(event.mrrDelta);
          break;
        case "reactivation":
          breakdown.reactivation += Math.abs(event.mrrDelta);
          break;
      }
    }

    breakdown.netNew =
      breakdown.new +
      breakdown.expansion +
      breakdown.reactivation -
      breakdown.contraction -
      breakdown.churned;

    breakdown.total =
      breakdown.new + breakdown.expansion + breakdown.reactivation;

    return breakdown;
  }
}
