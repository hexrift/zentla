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

  const mockApiKey = {
    keyId: "key_123",
    workspaceId: "ws_123",
    role: "admin" as const,
    environment: "live" as const,
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
    it("should return events with pagination meta", async () => {
      eventsService.listEvents.mockResolvedValue({
        data: [{ id: "evt_123", eventType: "subscription.created" }],
        hasMore: false,
        nextCursor: undefined,
      });

      const result = await controller.listEvents(mockApiKey);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.pagination.hasMore).toBe(false);
    });

    it("should pass filters to service", async () => {
      eventsService.listEvents.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: undefined,
      });

      await controller.listEvents(
        mockApiKey,
        "25",
        "cursor123",
        "pending",
        "subscription.created",
        "subscription",
        "sub_123",
      );

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

      await controller.listEvents(mockApiKey);

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
    it("should return dead letter events with pagination meta", async () => {
      eventsService.listDeadLetterEvents.mockResolvedValue({
        data: [{ id: "dle_123", failureReason: "Timeout" }],
        hasMore: true,
        nextCursor: "dle_123",
      });

      const result = await controller.listDeadLetterEvents(mockApiKey);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.pagination.hasMore).toBe(true);
      expect(result.meta.pagination.nextCursor).toBe("dle_123");
    });

    it("should pass limit and cursor to service", async () => {
      eventsService.listDeadLetterEvents.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: undefined,
      });

      await controller.listDeadLetterEvents(mockApiKey, "30", "cursor456");

      expect(eventsService.listDeadLetterEvents).toHaveBeenCalledWith(
        "ws_123",
        { limit: 30, cursor: "cursor456" },
      );
    });
  });
});
