import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { EventsService } from "./events.service";
import { PrismaService } from "../database/prisma.service";

describe("EventsService", () => {
  let service: EventsService;
  let prisma: {
    outboxEvent: {
      findMany: ReturnType<typeof vi.fn>;
    };
    deadLetterEvent: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const mockEvent = {
    id: "evt_123",
    workspaceId: "ws_123",
    eventType: "subscription.created",
    aggregateType: "subscription",
    aggregateId: "sub_123",
    status: "processed" as const,
    payload: { subscriptionId: "sub_123", customerId: "cust_123" },
    processedAt: new Date(),
    createdAt: new Date(),
  };

  const mockDeadLetterEvent = {
    id: "dle_123",
    workspaceId: "ws_123",
    originalEventId: "evt_456",
    endpointId: "ep_123",
    eventType: "subscription.created",
    payload: { subscriptionId: "sub_123" },
    failureReason: "Connection timeout",
    attempts: 5,
    lastAttemptAt: new Date(),
    createdAt: new Date(),
    endpoint: { url: "https://webhook.example.com/events" },
  };

  beforeEach(async () => {
    prisma = {
      outboxEvent: {
        findMany: vi.fn(),
      },
      deadLetterEvent: {
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  describe("listEvents", () => {
    it("should return paginated events", async () => {
      const events = [mockEvent, { ...mockEvent, id: "evt_456" }];
      prisma.outboxEvent.findMany.mockResolvedValue(events);

      const result = await service.listEvents("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("should indicate hasMore when more results exist", async () => {
      const events = Array(11)
        .fill(null)
        .map((_, i) => ({ ...mockEvent, id: `evt_${i}` }));
      prisma.outboxEvent.findMany.mockResolvedValue(events);

      const result = await service.listEvents("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("evt_9");
    });

    it("should filter by status", async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([]);

      await service.listEvents("ws_123", { limit: 10, status: "pending" });

      expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "pending" }),
        }),
      );
    });

    it("should filter by eventType", async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([]);

      await service.listEvents("ws_123", {
        limit: 10,
        eventType: "subscription.created",
      });

      expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: "subscription.created",
          }),
        }),
      );
    });

    it("should filter by aggregateType", async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([]);

      await service.listEvents("ws_123", {
        limit: 10,
        aggregateType: "subscription",
      });

      expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ aggregateType: "subscription" }),
        }),
      );
    });

    it("should filter by aggregateId", async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([]);

      await service.listEvents("ws_123", {
        limit: 10,
        aggregateId: "sub_123",
      });

      expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ aggregateId: "sub_123" }),
        }),
      );
    });

    it("should use cursor for pagination", async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([]);

      await service.listEvents("ws_123", { limit: 10, cursor: "evt_100" });

      expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { lt: "evt_100" },
          }),
        }),
      );
    });

    it("should format event data correctly", async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([mockEvent]);

      const result = await service.listEvents("ws_123", { limit: 10 });

      expect(result.data[0]).toEqual({
        id: mockEvent.id,
        eventType: mockEvent.eventType,
        aggregateType: mockEvent.aggregateType,
        aggregateId: mockEvent.aggregateId,
        status: mockEvent.status,
        payload: mockEvent.payload,
        processedAt: mockEvent.processedAt.toISOString(),
        createdAt: mockEvent.createdAt.toISOString(),
      });
    });

    it("should handle null processedAt", async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([
        { ...mockEvent, processedAt: null },
      ]);

      const result = await service.listEvents("ws_123", { limit: 10 });

      expect(result.data[0].processedAt).toBeNull();
    });
  });

  describe("listDeadLetterEvents", () => {
    it("should return paginated dead letter events", async () => {
      const events = [
        mockDeadLetterEvent,
        { ...mockDeadLetterEvent, id: "dle_456" },
      ];
      prisma.deadLetterEvent.findMany.mockResolvedValue(events);

      const result = await service.listDeadLetterEvents("ws_123", {
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("should indicate hasMore when more results exist", async () => {
      const events = Array(11)
        .fill(null)
        .map((_, i) => ({ ...mockDeadLetterEvent, id: `dle_${i}` }));
      prisma.deadLetterEvent.findMany.mockResolvedValue(events);

      const result = await service.listDeadLetterEvents("ws_123", {
        limit: 10,
      });

      expect(result.data).toHaveLength(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("dle_9");
    });

    it("should use cursor for pagination", async () => {
      prisma.deadLetterEvent.findMany.mockResolvedValue([]);

      await service.listDeadLetterEvents("ws_123", {
        limit: 10,
        cursor: "dle_100",
      });

      expect(prisma.deadLetterEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { lt: "dle_100" },
          }),
        }),
      );
    });

    it("should include endpoint url in response", async () => {
      prisma.deadLetterEvent.findMany.mockResolvedValue([mockDeadLetterEvent]);

      const result = await service.listDeadLetterEvents("ws_123", {
        limit: 10,
      });

      expect(result.data[0].endpointUrl).toBe(
        "https://webhook.example.com/events",
      );
      expect(prisma.deadLetterEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            endpoint: { select: { url: true } },
          },
        }),
      );
    });

    it("should format dead letter event data correctly", async () => {
      prisma.deadLetterEvent.findMany.mockResolvedValue([mockDeadLetterEvent]);

      const result = await service.listDeadLetterEvents("ws_123", {
        limit: 10,
      });

      expect(result.data[0]).toEqual({
        id: mockDeadLetterEvent.id,
        originalEventId: mockDeadLetterEvent.originalEventId,
        endpointId: mockDeadLetterEvent.endpointId,
        endpointUrl: mockDeadLetterEvent.endpoint.url,
        eventType: mockDeadLetterEvent.eventType,
        payload: mockDeadLetterEvent.payload,
        failureReason: mockDeadLetterEvent.failureReason,
        attempts: mockDeadLetterEvent.attempts,
        lastAttemptAt: mockDeadLetterEvent.lastAttemptAt.toISOString(),
        createdAt: mockDeadLetterEvent.createdAt.toISOString(),
      });
    });

    it("should handle null lastAttemptAt", async () => {
      prisma.deadLetterEvent.findMany.mockResolvedValue([
        { ...mockDeadLetterEvent, lastAttemptAt: null },
      ]);

      const result = await service.listDeadLetterEvents("ws_123", {
        limit: 10,
      });

      expect(result.data[0].lastAttemptAt).toBeNull();
    });

    it("should handle missing endpoint", async () => {
      prisma.deadLetterEvent.findMany.mockResolvedValue([
        { ...mockDeadLetterEvent, endpoint: null },
      ]);

      const result = await service.listDeadLetterEvents("ws_123", {
        limit: 10,
      });

      expect(result.data[0].endpointUrl).toBeUndefined();
    });
  });
});
