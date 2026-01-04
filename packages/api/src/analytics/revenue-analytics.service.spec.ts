import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { RevenueAnalyticsService } from "./revenue-analytics.service";
import { PrismaService } from "../database/prisma.service";

describe("RevenueAnalyticsService", () => {
  let service: RevenueAnalyticsService;
  let prisma: {
    revenueEvent: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    revenueSnapshot: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
    subscription: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    customer: {
      count: ReturnType<typeof vi.fn>;
    };
    customerCohort: {
      findMany: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
  };

  const mockSubscription = {
    id: "sub_123",
    workspaceId: "ws_123",
    customerId: "cust_123",
    status: "active",
    offerVersion: {
      config: {
        pricing: {
          amount: 9900, // $99
          interval: "month",
          intervalCount: 1,
        },
      },
    },
    customer: {
      id: "cust_123",
      email: "customer@example.com",
    },
  };

  const mockRevenueEvent = {
    id: "evt_123",
    workspaceId: "ws_123",
    customerId: "cust_123",
    type: "new_subscription",
    amount: 9900,
    mrrDelta: 9900,
    occurredAt: new Date(),
  };

  const mockSnapshot = {
    id: "snap_123",
    workspaceId: "ws_123",
    date: new Date(),
    period: "daily",
    mrr: 99000,
    arr: 1188000,
    newMrr: 9900,
    expansionMrr: 0,
    contractionMrr: 0,
    churnedMrr: 0,
    reactivationMrr: 0,
    netNewMrr: 9900,
    totalCustomers: 10,
    activeSubscriptions: 10,
    newCustomers: 1,
    churnedCustomers: 0,
    reactivatedCustomers: 0,
    churnRate: 0,
    netRevenueRetention: 10000,
    grossRevenueRetention: 10000,
    arpu: 9900,
    ltv: 237600,
    currency: "usd",
  };

  beforeEach(async () => {
    prisma = {
      revenueEvent: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      revenueSnapshot: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      subscription: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      customer: {
        count: vi.fn(),
      },
      customerCohort: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RevenueAnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RevenueAnalyticsService>(RevenueAnalyticsService);
  });

  describe("recordRevenueEvent", () => {
    it("should record a revenue event", async () => {
      prisma.revenueEvent.create.mockResolvedValue(mockRevenueEvent);

      await service.recordRevenueEvent("ws_123", {
        customerId: "cust_123",
        type: "new_subscription",
        amount: 9900,
        mrrDelta: 9900,
      });

      expect(prisma.revenueEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws_123",
          customerId: "cust_123",
          type: "new_subscription",
          amount: 9900,
          mrrDelta: 9900,
        }),
      });
    });

    it("should record event with optional fields", async () => {
      prisma.revenueEvent.create.mockResolvedValue(mockRevenueEvent);

      await service.recordRevenueEvent("ws_123", {
        customerId: "cust_123",
        subscriptionId: "sub_123",
        type: "upgrade",
        amount: 5000,
        mrrDelta: 5000,
        previousMrr: 9900,
        newMrr: 14900,
        reason: "Upgraded to Pro plan",
      });

      expect(prisma.revenueEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subscriptionId: "sub_123",
          previousMrr: 9900,
          newMrr: 14900,
          reason: "Upgraded to Pro plan",
        }),
      });
    });
  });

  describe("getRevenueEvents", () => {
    it("should get revenue events with filters", async () => {
      prisma.revenueEvent.findMany.mockResolvedValue([mockRevenueEvent]);

      const result = await service.getRevenueEvents("ws_123", {
        customerId: "cust_123",
        type: "new_subscription",
      });

      expect(result).toHaveLength(1);
      expect(prisma.revenueEvent.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          workspaceId: "ws_123",
          customerId: "cust_123",
          type: "new_subscription",
        }),
        orderBy: { occurredAt: "desc" },
        take: 100,
      });
    });

    it("should filter by date range", async () => {
      prisma.revenueEvent.findMany.mockResolvedValue([]);
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      await service.getRevenueEvents("ws_123", { startDate, endDate });

      expect(prisma.revenueEvent.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          occurredAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
        orderBy: { occurredAt: "desc" },
        take: 100,
      });
    });
  });

  describe("calculateCurrentMrr", () => {
    it("should calculate MRR from active subscriptions", async () => {
      prisma.subscription.findMany.mockResolvedValue([
        mockSubscription,
        { ...mockSubscription, id: "sub_456" },
      ]);

      const mrr = await service.calculateCurrentMrr("ws_123");

      expect(mrr).toBe(19800); // 2 * $99 = $198
    });

    it("should normalize yearly subscriptions to monthly", async () => {
      prisma.subscription.findMany.mockResolvedValue([
        {
          ...mockSubscription,
          offerVersion: {
            config: {
              pricing: {
                amount: 99900, // $999/year
                interval: "year",
                intervalCount: 1,
              },
            },
          },
        },
      ]);

      const mrr = await service.calculateCurrentMrr("ws_123");

      expect(mrr).toBe(8325); // $999 / 12 = $83.25
    });

    it("should handle quarterly subscriptions", async () => {
      prisma.subscription.findMany.mockResolvedValue([
        {
          ...mockSubscription,
          offerVersion: {
            config: {
              pricing: {
                amount: 29700, // $297/quarter
                interval: "quarter",
                intervalCount: 1,
              },
            },
          },
        },
      ]);

      const mrr = await service.calculateCurrentMrr("ws_123");

      expect(mrr).toBe(9900); // $297 / 3 = $99
    });
  });

  describe("getCurrentMetrics", () => {
    beforeEach(() => {
      prisma.subscription.findMany.mockResolvedValue([mockSubscription]);
      prisma.customer.count.mockResolvedValue(10);
      prisma.subscription.count.mockResolvedValue(10);
      prisma.revenueEvent.findMany.mockResolvedValue([mockRevenueEvent]);
      prisma.revenueSnapshot.findFirst.mockResolvedValue(null);
    });

    it("should return current revenue metrics", async () => {
      const metrics = await service.getCurrentMetrics("ws_123");

      expect(metrics.mrr).toBe(9900);
      expect(metrics.arr).toBe(118800);
      expect(metrics.customers.total).toBe(10);
      expect(metrics.customers.active).toBe(10);
      expect(metrics.currency).toBe("usd");
    });

    it("should calculate MRR breakdown from events", async () => {
      prisma.revenueEvent.findMany.mockResolvedValue([
        { type: "new_subscription", mrrDelta: 9900 },
        { type: "upgrade", mrrDelta: 5000 },
        { type: "downgrade", mrrDelta: -2000 },
      ]);

      const metrics = await service.getCurrentMetrics("ws_123");

      expect(metrics.mrrBreakdown.new).toBe(9900);
      expect(metrics.mrrBreakdown.expansion).toBe(5000);
      expect(metrics.mrrBreakdown.contraction).toBe(2000);
    });

    it("should count customer events", async () => {
      prisma.revenueEvent.findMany.mockResolvedValue([
        { type: "new_subscription", mrrDelta: 9900 },
        { type: "new_subscription", mrrDelta: 4900 },
        { type: "cancellation", mrrDelta: -9900 },
      ]);

      const metrics = await service.getCurrentMetrics("ws_123");

      expect(metrics.customers.new).toBe(2);
      expect(metrics.customers.churned).toBe(1);
    });

    it("should calculate retention metrics", async () => {
      prisma.revenueSnapshot.findFirst.mockResolvedValue({
        mrr: 100000, // Previous month MRR
      });
      prisma.revenueEvent.findMany.mockResolvedValue([
        { type: "cancellation", mrrDelta: -10000 }, // 10% churn
        { type: "upgrade", mrrDelta: 5000 }, // 5% expansion
      ]);

      const metrics = await service.getCurrentMetrics("ws_123");

      // Gross retention: (100000 - 10000) / 100000 = 90%
      expect(metrics.grossRevenueRetention).toBe(9000); // 90.00% in basis points
      // Net retention: (100000 - 10000 + 5000) / 100000 = 95%
      expect(metrics.netRevenueRetention).toBe(9500); // 95.00% in basis points
    });
  });

  describe("createSnapshot", () => {
    it("should create a revenue snapshot", async () => {
      prisma.subscription.findMany.mockResolvedValue([mockSubscription]);
      prisma.customer.count.mockResolvedValue(10);
      prisma.subscription.count.mockResolvedValue(10);
      prisma.revenueEvent.findMany.mockResolvedValue([]);
      prisma.revenueSnapshot.findFirst.mockResolvedValue(null);
      prisma.revenueSnapshot.upsert.mockResolvedValue(mockSnapshot);

      const date = new Date("2024-01-15");
      await service.createSnapshot("ws_123", date, "daily");

      expect(prisma.revenueSnapshot.upsert).toHaveBeenCalledWith({
        where: {
          workspaceId_date_period: {
            workspaceId: "ws_123",
            date,
            period: "daily",
          },
        },
        create: expect.objectContaining({
          workspaceId: "ws_123",
          date,
          period: "daily",
          mrr: expect.any(Number),
        }),
        update: expect.objectContaining({
          mrr: expect.any(Number),
        }),
      });
    });
  });

  describe("getRevenueTrend", () => {
    it("should return revenue trend data", async () => {
      prisma.revenueSnapshot.findMany.mockResolvedValue([
        { ...mockSnapshot, date: new Date("2024-01-01"), mrr: 90000 },
        { ...mockSnapshot, date: new Date("2024-01-02"), mrr: 95000 },
        { ...mockSnapshot, date: new Date("2024-01-03"), mrr: 99000 },
      ]);

      const trend = await service.getRevenueTrend(
        "ws_123",
        new Date("2024-01-01"),
        new Date("2024-01-03"),
      );

      expect(trend).toHaveLength(3);
      expect(trend[0].mrr).toBe(90000);
      expect(trend[2].mrr).toBe(99000);
    });
  });

  describe("getCohortAnalysis", () => {
    it("should return cohort analysis data", async () => {
      const cohortMonth = new Date("2024-01-01");
      prisma.customerCohort.findMany.mockResolvedValue([
        {
          cohortMonth,
          monthNumber: 0,
          customersAtStart: 100,
          customersRemaining: 100,
          mrrAtStart: 990000,
          mrrRemaining: 990000,
          customerRetention: 10000,
          revenueRetention: 10000,
        },
        {
          cohortMonth,
          monthNumber: 1,
          customersAtStart: 100,
          customersRemaining: 90,
          mrrAtStart: 990000,
          mrrRemaining: 900000,
          customerRetention: 9000,
          revenueRetention: 9091,
        },
      ]);

      const cohorts = await service.getCohortAnalysis("ws_123", cohortMonth);

      expect(cohorts).toHaveLength(1);
      expect(cohorts[0].customersAtStart).toBe(100);
      expect(cohorts[0].months).toHaveLength(2);
      expect(cohorts[0].months[1].customerRetention).toBe(90); // 9000 / 100
    });
  });

  describe("getPeriodComparison", () => {
    it("should compare current and previous periods", async () => {
      prisma.subscription.findMany.mockResolvedValue([mockSubscription]);
      prisma.customer.count.mockResolvedValue(10);
      prisma.subscription.count.mockResolvedValue(10);
      prisma.revenueEvent.findMany.mockResolvedValue([]);
      prisma.revenueSnapshot.findFirst.mockResolvedValue({
        ...mockSnapshot,
        mrr: 90000,
        activeSubscriptions: 9,
      });

      const comparison = await service.getPeriodComparison(
        "ws_123",
        new Date("2024-02-01"),
        new Date("2024-02-29"),
        new Date("2024-01-01"),
        new Date("2024-01-31"),
      );

      expect(comparison.current.mrr).toBe(9900);
      expect(comparison.previous.mrr).toBe(90000);
      expect(comparison.changes.mrr).toBeLessThan(0); // Decreased
    });
  });

  describe("getTopCustomers", () => {
    it("should return top customers by MRR", async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { ...mockSubscription, customerId: "cust_1" },
        { ...mockSubscription, customerId: "cust_2" },
        {
          ...mockSubscription,
          customerId: "cust_1",
          offerVersion: {
            config: { pricing: { amount: 19900, interval: "month" } },
          },
        },
      ]);

      const topCustomers = await service.getTopCustomers("ws_123", 5);

      expect(topCustomers).toHaveLength(2);
      // cust_1 should be first with 9900 + 19900 = 29800
      expect(topCustomers[0].customerId).toBe("cust_1");
      expect(topCustomers[0].mrr).toBe(29800);
      expect(topCustomers[0].subscriptionCount).toBe(2);
    });
  });

  describe("MRR normalization", () => {
    it("should handle subscriptions without pricing config", async () => {
      prisma.subscription.findMany.mockResolvedValue([
        {
          ...mockSubscription,
          offerVersion: { config: {} },
        },
      ]);

      const mrr = await service.calculateCurrentMrr("ws_123");

      expect(mrr).toBe(0);
    });

    it("should handle multi-month subscriptions", async () => {
      prisma.subscription.findMany.mockResolvedValue([
        {
          ...mockSubscription,
          offerVersion: {
            config: {
              pricing: {
                amount: 19800, // $198 for 2 months
                interval: "month",
                intervalCount: 2,
              },
            },
          },
        },
      ]);

      const mrr = await service.calculateCurrentMrr("ws_123");

      expect(mrr).toBe(9900); // $198 / 2 = $99/month
    });
  });
});
