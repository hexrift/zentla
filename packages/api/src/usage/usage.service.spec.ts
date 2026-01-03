import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { UsageService } from "./usage.service";
import { PrismaService } from "../database/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

describe("UsageService", () => {
  let service: UsageService;
  let prisma: {
    usageEvent: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
    };
    usageAggregate: {
      findUnique: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
    usageMetric: {
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    subscription: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  const mockEvent = {
    id: "evt_123",
    workspaceId: "ws_123",
    customerId: "cust_123",
    subscriptionId: "sub_123",
    metricKey: "api_calls",
    quantity: new Decimal(10),
    timestamp: new Date(),
    idempotencyKey: "idem_123",
    properties: { endpoint: "/api/v1/users" },
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      usageEvent: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        aggregate: vi.fn(),
      },
      usageAggregate: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      usageMetric: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      subscription: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsageService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsageService>(UsageService);
  });

  describe("ingestEvent", () => {
    it("should create a new usage event", async () => {
      prisma.usageEvent.findUnique.mockResolvedValue(null);
      prisma.usageEvent.create.mockResolvedValue(mockEvent);
      prisma.usageAggregate.upsert.mockResolvedValue({});
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.ingestEvent("ws_123", {
        customerId: "cust_123",
        subscriptionId: "sub_123",
        metricKey: "api_calls",
        quantity: 10,
        idempotencyKey: "idem_123",
      });

      expect(result.id).toBe("evt_123");
      expect(result.deduplicated).toBe(false);
    });

    it("should return deduplicated true for duplicate idempotency key", async () => {
      prisma.usageEvent.findUnique.mockResolvedValue({ id: "existing_evt" });

      const result = await service.ingestEvent("ws_123", {
        customerId: "cust_123",
        metricKey: "api_calls",
        quantity: 10,
        idempotencyKey: "idem_123",
      });

      expect(result.id).toBe("existing_evt");
      expect(result.deduplicated).toBe(true);
      expect(prisma.usageEvent.create).not.toHaveBeenCalled();
    });

    it("should create event without idempotency key", async () => {
      prisma.usageEvent.create.mockResolvedValue(mockEvent);
      prisma.usageAggregate.upsert.mockResolvedValue({});

      const result = await service.ingestEvent("ws_123", {
        customerId: "cust_123",
        metricKey: "api_calls",
        quantity: 10,
      });

      expect(result.deduplicated).toBe(false);
      expect(prisma.usageEvent.findUnique).not.toHaveBeenCalled();
    });

    it("should use provided timestamp", async () => {
      const customTimestamp = new Date("2024-01-15T10:00:00Z");
      prisma.usageEvent.create.mockResolvedValue(mockEvent);
      prisma.usageAggregate.upsert.mockResolvedValue({});

      await service.ingestEvent("ws_123", {
        customerId: "cust_123",
        metricKey: "api_calls",
        quantity: 10,
        timestamp: customTimestamp,
      });

      expect(prisma.usageEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          timestamp: customTimestamp,
        }),
      });
    });
  });

  describe("ingestBatch", () => {
    it("should ingest multiple events", async () => {
      prisma.usageEvent.create.mockResolvedValue(mockEvent);
      prisma.usageAggregate.upsert.mockResolvedValue({});

      const result = await service.ingestBatch("ws_123", [
        { customerId: "cust_123", metricKey: "api_calls", quantity: 10 },
        { customerId: "cust_123", metricKey: "api_calls", quantity: 5 },
      ]);

      expect(result.ingested).toBe(2);
      expect(result.deduplicated).toBe(0);
    });

    it("should throw BadRequestException for batch over 1000", async () => {
      const events = Array(1001)
        .fill(null)
        .map(() => ({
          customerId: "cust_123",
          metricKey: "api_calls",
          quantity: 1,
        }));

      await expect(service.ingestBatch("ws_123", events)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should count deduplicated events separately", async () => {
      prisma.usageEvent.findUnique
        .mockResolvedValueOnce({ id: "existing" })
        .mockResolvedValueOnce(null);
      prisma.usageEvent.create.mockResolvedValue(mockEvent);
      prisma.usageAggregate.upsert.mockResolvedValue({});

      const result = await service.ingestBatch("ws_123", [
        {
          customerId: "cust_123",
          metricKey: "api_calls",
          quantity: 10,
          idempotencyKey: "dup",
        },
        {
          customerId: "cust_123",
          metricKey: "api_calls",
          quantity: 5,
          idempotencyKey: "new",
        },
      ]);

      expect(result.ingested).toBe(1);
      expect(result.deduplicated).toBe(1);
    });
  });

  describe("getUsageSummary", () => {
    const periodStart = new Date("2024-01-01");
    const periodEnd = new Date("2024-02-01");

    it("should return cached aggregate when available", async () => {
      const aggregate = {
        totalQuantity: new Decimal(100),
        eventCount: 10,
      };
      prisma.usageAggregate.findUnique.mockResolvedValue(aggregate);

      const result = await service.getUsageSummary(
        "ws_123",
        "cust_123",
        "api_calls",
        periodStart,
        periodEnd,
      );

      expect(result.totalQuantity).toBe(100);
      expect(result.eventCount).toBe(10);
    });

    it("should compute from events when no aggregate exists", async () => {
      prisma.usageAggregate.findUnique.mockResolvedValue(null);
      prisma.usageEvent.aggregate.mockResolvedValue({
        _sum: { quantity: new Decimal(50) },
        _count: 5,
      });

      const result = await service.getUsageSummary(
        "ws_123",
        "cust_123",
        "api_calls",
        periodStart,
        periodEnd,
      );

      expect(result.totalQuantity).toBe(50);
      expect(result.eventCount).toBe(5);
    });

    it("should return zero when no events exist", async () => {
      prisma.usageAggregate.findUnique.mockResolvedValue(null);
      prisma.usageEvent.aggregate.mockResolvedValue({
        _sum: { quantity: null },
        _count: 0,
      });

      const result = await service.getUsageSummary(
        "ws_123",
        "cust_123",
        "api_calls",
        periodStart,
        periodEnd,
      );

      expect(result.totalQuantity).toBe(0);
      expect(result.eventCount).toBe(0);
    });
  });

  describe("getCurrentPeriodUsage", () => {
    it("should return null when subscription not found", async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);

      const result = await service.getCurrentPeriodUsage(
        "ws_123",
        "sub_123",
        "api_calls",
      );

      expect(result).toBeNull();
    });

    it("should return usage for current billing period", async () => {
      const periodStart = new Date("2024-01-01");
      const periodEnd = new Date("2024-02-01");
      prisma.subscription.findFirst.mockResolvedValue({
        customerId: "cust_123",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });
      prisma.usageAggregate.findUnique.mockResolvedValue({
        totalQuantity: new Decimal(75),
        eventCount: 8,
      });

      const result = await service.getCurrentPeriodUsage(
        "ws_123",
        "sub_123",
        "api_calls",
      );

      expect(result?.totalQuantity).toBe(75);
    });
  });

  describe("listEvents", () => {
    it("should return paginated events", async () => {
      const events = [mockEvent, { ...mockEvent, id: "evt_456" }];
      prisma.usageEvent.findMany.mockResolvedValue(events);

      const result = await service.listEvents("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("should indicate hasMore when more results exist", async () => {
      const events = Array(11)
        .fill(null)
        .map((_, i) => ({ ...mockEvent, id: `evt_${i}` }));
      prisma.usageEvent.findMany.mockResolvedValue(events);

      const result = await service.listEvents("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("evt_9");
    });

    it("should filter by customerId", async () => {
      prisma.usageEvent.findMany.mockResolvedValue([]);

      await service.listEvents("ws_123", {
        customerId: "cust_123",
      });

      expect(prisma.usageEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: "cust_123" }),
        }),
      );
    });

    it("should filter by date range", async () => {
      prisma.usageEvent.findMany.mockResolvedValue([]);
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-02-01");

      await service.listEvents("ws_123", { startDate, endDate });

      expect(prisma.usageEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: { gte: startDate, lt: endDate },
          }),
        }),
      );
    });
  });

  describe("createMetric", () => {
    it("should create a new metric", async () => {
      const metric = {
        id: "metric_123",
        workspaceId: "ws_123",
        key: "api_calls",
        name: "API Calls",
        description: "Number of API calls",
        unit: "requests",
        aggregation: "sum",
      };
      prisma.usageMetric.create.mockResolvedValue(metric);

      const result = await service.createMetric("ws_123", {
        key: "api_calls",
        name: "API Calls",
        description: "Number of API calls",
        unit: "requests",
        aggregation: "sum",
      });

      expect(result.key).toBe("api_calls");
      expect(result.name).toBe("API Calls");
    });

    it("should default aggregation to sum", async () => {
      prisma.usageMetric.create.mockResolvedValue({});

      await service.createMetric("ws_123", {
        key: "storage",
        name: "Storage",
      });

      expect(prisma.usageMetric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          aggregation: "sum",
        }),
      });
    });
  });

  describe("listMetrics", () => {
    it("should return all metrics for workspace", async () => {
      const metrics = [
        { id: "m1", key: "api_calls", name: "API Calls" },
        { id: "m2", key: "storage", name: "Storage" },
      ];
      prisma.usageMetric.findMany.mockResolvedValue(metrics);

      const result = await service.listMetrics("ws_123");

      expect(result).toHaveLength(2);
      expect(prisma.usageMetric.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "ws_123" },
        orderBy: { createdAt: "desc" },
      });
    });
  });
});
