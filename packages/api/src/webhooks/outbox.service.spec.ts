import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { OutboxService } from "./outbox.service";
import { PrismaService } from "../database/prisma.service";

describe("OutboxService", () => {
  let service: OutboxService;
  let prisma: {
    outboxEvent: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    deadLetterEvent: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const mockEvent = {
    id: "evt_123",
    workspaceId: "ws_123",
    eventType: "subscription.created",
    aggregateType: "subscription",
    aggregateId: "sub_123",
    payload: { subscriptionId: "sub_123" },
    status: "pending" as const,
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      outboxEvent: {
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      deadLetterEvent: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OutboxService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<OutboxService>(OutboxService);
  });

  describe("createEvent", () => {
    it("should create outbox event with pending status", async () => {
      prisma.outboxEvent.create.mockResolvedValue(mockEvent);

      const result = await service.createEvent({
        workspaceId: "ws_123",
        eventType: "subscription.created",
        aggregateType: "subscription",
        aggregateId: "sub_123",
        payload: { subscriptionId: "sub_123" },
      });

      expect(result).toEqual(mockEvent);
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
        data: {
          workspaceId: "ws_123",
          eventType: "subscription.created",
          aggregateType: "subscription",
          aggregateId: "sub_123",
          payload: { subscriptionId: "sub_123" },
          status: "pending",
        },
      });
    });
  });

  describe("getPendingEvents", () => {
    it("should return pending events ordered by createdAt", async () => {
      const events = [mockEvent, { ...mockEvent, id: "evt_456" }];
      prisma.outboxEvent.findMany.mockResolvedValue(events);

      const result = await service.getPendingEvents();

      expect(result).toEqual(events);
      expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        take: 100,
      });
    });

    it("should respect custom limit", async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([]);

      await service.getPendingEvents(50);

      expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        take: 50,
      });
    });
  });

  describe("markAsProcessed", () => {
    it("should update event status to processed", async () => {
      prisma.outboxEvent.update.mockResolvedValue({
        ...mockEvent,
        status: "processed",
        processedAt: new Date(),
      });

      await service.markAsProcessed("evt_123");

      expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: "evt_123" },
        data: {
          status: "processed",
          processedAt: expect.any(Date),
        },
      });
    });
  });

  describe("markAsFailed", () => {
    it("should update event status to failed", async () => {
      prisma.outboxEvent.update.mockResolvedValue({
        ...mockEvent,
        status: "failed",
      });

      await service.markAsFailed("evt_123");

      expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: "evt_123" },
        data: { status: "failed" },
      });
    });
  });

  describe("createDeadLetterEvent", () => {
    it("should create dead letter event", async () => {
      prisma.deadLetterEvent.create.mockResolvedValue({});

      await service.createDeadLetterEvent(
        "ws_123",
        "evt_123",
        "ep_123",
        "subscription.created",
        { subscriptionId: "sub_123" },
        "Connection timeout",
        5,
      );

      expect(prisma.deadLetterEvent.create).toHaveBeenCalledWith({
        data: {
          workspaceId: "ws_123",
          originalEventId: "evt_123",
          endpointId: "ep_123",
          eventType: "subscription.created",
          payload: { subscriptionId: "sub_123" },
          failureReason: "Connection timeout",
          attempts: 5,
          lastAttemptAt: expect.any(Date),
        },
      });
    });
  });

  describe("getDeadLetterEvents", () => {
    it("should return dead letter events ordered by createdAt desc", async () => {
      const events = [
        { id: "dle_123", failureReason: "Timeout" },
        { id: "dle_456", failureReason: "Connection refused" },
      ];
      prisma.deadLetterEvent.findMany.mockResolvedValue(events);

      const result = await service.getDeadLetterEvents("ws_123");

      expect(result).toEqual(events);
      expect(prisma.deadLetterEvent.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "ws_123" },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    });

    it("should respect custom limit", async () => {
      prisma.deadLetterEvent.findMany.mockResolvedValue([]);

      await service.getDeadLetterEvents("ws_123", 25);

      expect(prisma.deadLetterEvent.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "ws_123" },
        orderBy: { createdAt: "desc" },
        take: 25,
      });
    });
  });
});
