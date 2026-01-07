import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { AnalyticsController } from "./analytics.controller";
import { RevenueAnalyticsService } from "./revenue-analytics.service";

describe("AnalyticsController", () => {
  let controller: AnalyticsController;
  let revenueAnalyticsService: {
    getCurrentMetrics: ReturnType<typeof vi.fn>;
    getRevenueTrend: ReturnType<typeof vi.fn>;
    getCohortAnalysis: ReturnType<typeof vi.fn>;
    getPeriodComparison: ReturnType<typeof vi.fn>;
    getTopCustomers: ReturnType<typeof vi.fn>;
    getRevenueEvents: ReturnType<typeof vi.fn>;
  };

  const mockMetrics = {
    mrr: 125000,
    arr: 1500000,
    mrrBreakdown: {
      total: 50000,
      new: 30000,
      expansion: 10000,
      contraction: 5000,
      churned: 8000,
      reactivation: 3000,
      netNew: 30000,
    },
    customers: {
      total: 150,
      active: 120,
      new: 15,
      churned: 5,
      reactivated: 2,
    },
    churnRate: 250,
    netRevenueRetention: 11500,
    grossRevenueRetention: 9500,
    arpu: 10416,
    ltv: 416640,
    currency: "usd",
  };

  const mockTrendData = [
    {
      date: new Date("2024-01-01"),
      mrr: 100000,
      arr: 1200000,
      customers: 100,
      churnRate: 0.02,
    },
    {
      date: new Date("2024-02-01"),
      mrr: 110000,
      arr: 1320000,
      customers: 110,
      churnRate: 0.018,
    },
    {
      date: new Date("2024-03-01"),
      mrr: 125000,
      arr: 1500000,
      customers: 120,
      churnRate: 0.025,
    },
  ];

  const mockCohortData = [
    {
      cohortMonth: new Date("2024-01-01"),
      customersAtStart: 50,
      months: [
        {
          monthNumber: 0,
          customersRemaining: 50,
          mrrRemaining: 50000,
          customerRetention: 100,
          revenueRetention: 100,
        },
        {
          monthNumber: 1,
          customersRemaining: 45,
          mrrRemaining: 47000,
          customerRetention: 90,
          revenueRetention: 94,
        },
        {
          monthNumber: 2,
          customersRemaining: 42,
          mrrRemaining: 46000,
          customerRetention: 84,
          revenueRetention: 92,
        },
      ],
    },
  ];

  const mockComparison = {
    current: mockMetrics,
    previous: { ...mockMetrics, mrr: 100000, arr: 1200000 },
    changes: {
      mrr: 25,
      arr: 25,
      customers: 10,
      churnRate: -5,
      arpu: 8,
    },
  };

  const mockTopCustomers = [
    {
      customerId: "cust_1",
      customerEmail: "vip@example.com",
      mrr: 50000,
      subscriptionCount: 2,
    },
    {
      customerId: "cust_2",
      customerEmail: "top@example.com",
      mrr: 25000,
      subscriptionCount: 1,
    },
    {
      customerId: "cust_3",
      customerEmail: "premium@example.com",
      mrr: 15000,
      subscriptionCount: 1,
    },
  ];

  const mockEvents = [
    {
      id: "evt_1",
      workspaceId: "ws_123",
      customerId: "cust_1",
      subscriptionId: "sub_1",
      type: "new_subscription",
      amount: 9900,
      mrrDelta: 9900,
      occurredAt: new Date("2024-01-15"),
    },
    {
      id: "evt_2",
      workspaceId: "ws_123",
      customerId: "cust_2",
      subscriptionId: "sub_2",
      type: "upgrade",
      amount: 4900,
      mrrDelta: 4900,
      occurredAt: new Date("2024-01-20"),
    },
  ];

  beforeEach(async () => {
    revenueAnalyticsService = {
      getCurrentMetrics: vi.fn(),
      getRevenueTrend: vi.fn(),
      getCohortAnalysis: vi.fn(),
      getPeriodComparison: vi.fn(),
      getTopCustomers: vi.fn(),
      getRevenueEvents: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: RevenueAnalyticsService, useValue: revenueAnalyticsService },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  describe("getCurrentMetrics", () => {
    it("should return current revenue metrics", async () => {
      revenueAnalyticsService.getCurrentMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getCurrentMetrics("ws_123");

      expect(revenueAnalyticsService.getCurrentMetrics).toHaveBeenCalledWith(
        "ws_123",
      );
      expect(result).toEqual(mockMetrics);
      expect(result.mrr).toBe(125000);
      expect(result.arr).toBe(1500000);
      expect(result.customers.active).toBe(120);
    });

    it("should return metrics with proper breakdown", async () => {
      revenueAnalyticsService.getCurrentMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getCurrentMetrics("ws_456");

      expect(result.mrrBreakdown.new).toBe(30000);
      expect(result.mrrBreakdown.expansion).toBe(10000);
      expect(result.mrrBreakdown.churned).toBe(8000);
      expect(result.netRevenueRetention).toBe(11500);
      expect(result.grossRevenueRetention).toBe(9500);
    });
  });

  describe("getRevenueTrend", () => {
    it("should return revenue trend for date range", async () => {
      revenueAnalyticsService.getRevenueTrend.mockResolvedValue(mockTrendData);

      const result = await controller.getRevenueTrend("ws_123", {
        startDate: "2024-01-01",
        endDate: "2024-03-31",
      });

      expect(revenueAnalyticsService.getRevenueTrend).toHaveBeenCalledWith(
        "ws_123",
        expect.any(Date),
        expect.any(Date),
        "daily",
      );
      expect(result).toHaveLength(3);
      expect(result[0].mrr).toBe(100000);
      expect(result[2].mrr).toBe(125000);
    });

    it("should support monthly period", async () => {
      revenueAnalyticsService.getRevenueTrend.mockResolvedValue(mockTrendData);

      await controller.getRevenueTrend("ws_123", {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        period: "monthly",
      });

      expect(revenueAnalyticsService.getRevenueTrend).toHaveBeenCalledWith(
        "ws_123",
        expect.any(Date),
        expect.any(Date),
        "monthly",
      );
    });

    it("should default to daily period", async () => {
      revenueAnalyticsService.getRevenueTrend.mockResolvedValue(mockTrendData);

      await controller.getRevenueTrend("ws_123", {
        startDate: "2024-01-01",
        endDate: "2024-03-31",
      });

      expect(revenueAnalyticsService.getRevenueTrend).toHaveBeenCalledWith(
        "ws_123",
        expect.any(Date),
        expect.any(Date),
        "daily",
      );
    });
  });

  describe("getCohortAnalysis", () => {
    it("should return cohort analysis with default parameters", async () => {
      revenueAnalyticsService.getCohortAnalysis.mockResolvedValue(
        mockCohortData,
      );

      const result = await controller.getCohortAnalysis("ws_123", {});

      expect(revenueAnalyticsService.getCohortAnalysis).toHaveBeenCalledWith(
        "ws_123",
        expect.any(Date),
        12,
      );
      expect(result).toHaveLength(1);
      expect(result[0].customersAtStart).toBe(50);
      expect(result[0].months).toHaveLength(3);
    });

    it("should support custom start month and months count", async () => {
      revenueAnalyticsService.getCohortAnalysis.mockResolvedValue(
        mockCohortData,
      );

      await controller.getCohortAnalysis("ws_123", {
        startMonth: "2024-01-01",
        months: 6,
      });

      expect(revenueAnalyticsService.getCohortAnalysis).toHaveBeenCalledWith(
        "ws_123",
        expect.any(Date),
        6,
      );
    });

    it("should calculate default start month as 12 months ago", async () => {
      revenueAnalyticsService.getCohortAnalysis.mockResolvedValue([]);

      await controller.getCohortAnalysis("ws_123", {});

      const callArgs = revenueAnalyticsService.getCohortAnalysis.mock.calls[0];
      const startMonth = callArgs[1] as Date;

      // Start month should be approximately 12 months ago
      const now = new Date();
      const expectedMonth = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      expect(startMonth.getFullYear()).toBe(expectedMonth.getFullYear());
      expect(startMonth.getMonth()).toBe(expectedMonth.getMonth());
    });
  });

  describe("getPeriodComparison", () => {
    it("should return period-over-period comparison", async () => {
      revenueAnalyticsService.getPeriodComparison.mockResolvedValue(
        mockComparison,
      );

      const result = await controller.getPeriodComparison("ws_123", {
        currentStart: "2024-06-01",
        currentEnd: "2024-06-30",
        previousStart: "2024-05-01",
        previousEnd: "2024-05-31",
      });

      expect(revenueAnalyticsService.getPeriodComparison).toHaveBeenCalledWith(
        "ws_123",
        new Date("2024-06-01"),
        new Date("2024-06-30"),
        new Date("2024-05-01"),
        new Date("2024-05-31"),
      );
      expect(result.current.mrr).toBe(125000);
      expect(result.previous.mrr).toBe(100000);
      expect(result.changes.mrr).toBe(25);
    });

    it("should include all change metrics", async () => {
      revenueAnalyticsService.getPeriodComparison.mockResolvedValue(
        mockComparison,
      );

      const result = await controller.getPeriodComparison("ws_123", {
        currentStart: "2024-06-01",
        currentEnd: "2024-06-30",
        previousStart: "2024-05-01",
        previousEnd: "2024-05-31",
      });

      expect(result.changes).toEqual({
        mrr: 25,
        arr: 25,
        customers: 10,
        churnRate: -5,
        arpu: 8,
      });
    });
  });

  describe("getTopCustomers", () => {
    it("should return top customers with default limit", async () => {
      revenueAnalyticsService.getTopCustomers.mockResolvedValue(
        mockTopCustomers,
      );

      const result = await controller.getTopCustomers("ws_123", 10);

      expect(revenueAnalyticsService.getTopCustomers).toHaveBeenCalledWith(
        "ws_123",
        10,
      );
      expect(result).toHaveLength(3);
      expect(result[0].mrr).toBe(50000);
      expect(result[0].customerEmail).toBe("vip@example.com");
    });

    it("should respect custom limit", async () => {
      revenueAnalyticsService.getTopCustomers.mockResolvedValue(
        mockTopCustomers.slice(0, 2),
      );

      const result = await controller.getTopCustomers("ws_123", 2);

      expect(revenueAnalyticsService.getTopCustomers).toHaveBeenCalledWith(
        "ws_123",
        2,
      );
      expect(result).toHaveLength(2);
    });

    it("should cap limit at 100", async () => {
      revenueAnalyticsService.getTopCustomers.mockResolvedValue([]);

      await controller.getTopCustomers("ws_123", 200);

      expect(revenueAnalyticsService.getTopCustomers).toHaveBeenCalledWith(
        "ws_123",
        100,
      );
    });

    it("should return customers sorted by MRR", async () => {
      revenueAnalyticsService.getTopCustomers.mockResolvedValue(
        mockTopCustomers,
      );

      const result = await controller.getTopCustomers("ws_123", 10);

      expect(result[0].mrr).toBeGreaterThan(result[1].mrr);
      expect(result[1].mrr).toBeGreaterThan(result[2].mrr);
    });
  });

  describe("getRevenueEvents", () => {
    it("should return revenue events with no filters", async () => {
      revenueAnalyticsService.getRevenueEvents.mockResolvedValue(mockEvents);

      const result = await controller.getRevenueEvents("ws_123", {});

      expect(revenueAnalyticsService.getRevenueEvents).toHaveBeenCalledWith(
        "ws_123",
        {
          customerId: undefined,
          subscriptionId: undefined,
          type: undefined,
          startDate: undefined,
          endDate: undefined,
          limit: undefined,
        },
      );
      expect(result).toHaveLength(2);
    });

    it("should filter by customer ID", async () => {
      revenueAnalyticsService.getRevenueEvents.mockResolvedValue([
        mockEvents[0],
      ]);

      const result = await controller.getRevenueEvents("ws_123", {
        customerId: "cust_1",
      });

      expect(revenueAnalyticsService.getRevenueEvents).toHaveBeenCalledWith(
        "ws_123",
        {
          customerId: "cust_1",
          subscriptionId: undefined,
          type: undefined,
          startDate: undefined,
          endDate: undefined,
          limit: undefined,
        },
      );
      expect(result).toHaveLength(1);
    });

    it("should filter by event type", async () => {
      revenueAnalyticsService.getRevenueEvents.mockResolvedValue([
        mockEvents[1],
      ]);

      await controller.getRevenueEvents("ws_123", {
        type: "upgrade",
      });

      expect(revenueAnalyticsService.getRevenueEvents).toHaveBeenCalledWith(
        "ws_123",
        {
          customerId: undefined,
          subscriptionId: undefined,
          type: "upgrade",
          startDate: undefined,
          endDate: undefined,
          limit: undefined,
        },
      );
    });

    it("should filter by date range", async () => {
      revenueAnalyticsService.getRevenueEvents.mockResolvedValue(mockEvents);

      await controller.getRevenueEvents("ws_123", {
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

      expect(revenueAnalyticsService.getRevenueEvents).toHaveBeenCalledWith(
        "ws_123",
        {
          customerId: undefined,
          subscriptionId: undefined,
          type: undefined,
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31"),
          limit: undefined,
        },
      );
    });

    it("should apply limit", async () => {
      revenueAnalyticsService.getRevenueEvents.mockResolvedValue([
        mockEvents[0],
      ]);

      await controller.getRevenueEvents("ws_123", {
        limit: 1,
      });

      expect(revenueAnalyticsService.getRevenueEvents).toHaveBeenCalledWith(
        "ws_123",
        {
          customerId: undefined,
          subscriptionId: undefined,
          type: undefined,
          startDate: undefined,
          endDate: undefined,
          limit: 1,
        },
      );
    });

    it("should filter by subscription ID", async () => {
      revenueAnalyticsService.getRevenueEvents.mockResolvedValue([
        mockEvents[0],
      ]);

      await controller.getRevenueEvents("ws_123", {
        subscriptionId: "sub_1",
      });

      expect(revenueAnalyticsService.getRevenueEvents).toHaveBeenCalledWith(
        "ws_123",
        {
          customerId: undefined,
          subscriptionId: "sub_1",
          type: undefined,
          startDate: undefined,
          endDate: undefined,
          limit: undefined,
        },
      );
    });

    it("should combine multiple filters", async () => {
      revenueAnalyticsService.getRevenueEvents.mockResolvedValue([
        mockEvents[0],
      ]);

      await controller.getRevenueEvents("ws_123", {
        customerId: "cust_1",
        type: "new_subscription",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        limit: 50,
      });

      expect(revenueAnalyticsService.getRevenueEvents).toHaveBeenCalledWith(
        "ws_123",
        {
          customerId: "cust_1",
          subscriptionId: undefined,
          type: "new_subscription",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31"),
          limit: 50,
        },
      );
    });
  });
});
