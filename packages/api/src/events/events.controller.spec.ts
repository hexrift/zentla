import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";

describe("EventsController", () => {
  let controller: EventsController;
  let eventsService: {
    listEvents: ReturnType<typeof vi.fn>;
    listDeadLetterEvents: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    eventsService = {
      listEvents: vi.fn(),
      listDeadLetterEvents: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [{ provide: EventsService, useValue: eventsService }],
    }).compile();

    controller = module.get<EventsController>(EventsController);
  });

  describe("listEvents", () => {
    it("should return events with pagination", async () => {
      eventsService.listEvents.mockResolvedValue({
        data: [{ id: "evt_123", eventType: "subscription.created" }],
        hasMore: false,
        nextCursor: undefined,
      });

      const result = await controller.listEvents("ws_123", {});

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it("should pass filters to service", async () => {
      eventsService.listEvents.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: undefined,
      });

      await controller.listEvents("ws_123", {
        limit: 25,
        cursor: "cursor123",
        status: "pending" as const,
        eventType: "subscription.created",
        aggregateType: "subscription",
        aggregateId: "sub_123",
      });

      expect(eventsService.listEvents).toHaveBeenCalledWith("ws_123", {
        limit: 25,
        cursor: "cursor123",
        status: "pending",
        eventType: "subscription.created",
        aggregateType: "subscription",
        aggregateId: "sub_123",
      });
    });

    it("should default to limit 50 when not provided", async () => {
      eventsService.listEvents.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: undefined,
      });

      await controller.listEvents("ws_123", {});

      expect(eventsService.listEvents).toHaveBeenCalledWith("ws_123", {
        limit: 50,
        cursor: undefined,
        status: undefined,
        eventType: undefined,
        aggregateType: undefined,
        aggregateId: undefined,
      });
    });
  });

  describe("listDeadLetterEvents", () => {
    it("should return dead letter events with pagination", async () => {
      eventsService.listDeadLetterEvents.mockResolvedValue({
        data: [{ id: "dle_123", failureReason: "Timeout" }],
        hasMore: true,
        nextCursor: "dle_123",
      });

      const result = await controller.listDeadLetterEvents("ws_123", {});

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("dle_123");
    });

    it("should pass limit and cursor to service", async () => {
      eventsService.listDeadLetterEvents.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: undefined,
      });

      await controller.listDeadLetterEvents("ws_123", {
        limit: 30,
        cursor: "cursor456",
      });

      expect(eventsService.listDeadLetterEvents).toHaveBeenCalledWith(
        "ws_123",
        { limit: 30, cursor: "cursor456" },
      );
    });
  });
});
