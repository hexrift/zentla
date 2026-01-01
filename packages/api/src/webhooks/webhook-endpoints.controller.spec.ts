import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { WebhookEndpointsController } from "./webhook-endpoints.controller";
import { WebhooksService } from "./webhooks.service";

describe("WebhookEndpointsController", () => {
  let controller: WebhookEndpointsController;
  let webhooksService: {
    findEndpoints: ReturnType<typeof vi.fn>;
    findEndpointById: ReturnType<typeof vi.fn>;
    createEndpoint: ReturnType<typeof vi.fn>;
    updateEndpoint: ReturnType<typeof vi.fn>;
    deleteEndpoint: ReturnType<typeof vi.fn>;
    rotateSecret: ReturnType<typeof vi.fn>;
  };

  const mockEndpoint = {
    id: "ep_123",
    workspaceId: "ws_123",
    url: "https://webhook.example.com/events",
    secret: "whsec_abc123",
    events: ["subscription.created", "subscription.canceled"],
    status: "active" as const,
    description: "Production webhook",
    metadata: {},
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    webhooksService = {
      findEndpoints: vi.fn(),
      findEndpointById: vi.fn(),
      createEndpoint: vi.fn(),
      updateEndpoint: vi.fn(),
      deleteEndpoint: vi.fn(),
      rotateSecret: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookEndpointsController],
      providers: [{ provide: WebhooksService, useValue: webhooksService }],
    }).compile();

    controller = module.get<WebhookEndpointsController>(
      WebhookEndpointsController,
    );
  });

  describe("findAll", () => {
    it("should return paginated endpoints", async () => {
      webhooksService.findEndpoints.mockResolvedValue({
        data: [mockEndpoint],
        hasMore: false,
        nextCursor: null,
      });

      const result = await controller.findAll("ws_123", {});

      expect(result.data).toHaveLength(1);
      expect(webhooksService.findEndpoints).toHaveBeenCalledWith("ws_123", {
        limit: 20,
        cursor: undefined,
      });
    });

    it("should pass limit and cursor to service", async () => {
      webhooksService.findEndpoints.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: null,
      });

      await controller.findAll("ws_123", { limit: 50, cursor: "cursor123" });

      expect(webhooksService.findEndpoints).toHaveBeenCalledWith("ws_123", {
        limit: 50,
        cursor: "cursor123",
      });
    });
  });

  describe("findOne", () => {
    it("should return endpoint when found", async () => {
      webhooksService.findEndpointById.mockResolvedValue(mockEndpoint);

      const result = await controller.findOne("ws_123", "ep_123");

      expect(result).toEqual(mockEndpoint);
    });

    it("should throw NotFoundException when not found", async () => {
      webhooksService.findEndpointById.mockResolvedValue(null);

      await expect(controller.findOne("ws_123", "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("create", () => {
    it("should create endpoint", async () => {
      webhooksService.createEndpoint.mockResolvedValue(mockEndpoint);

      const result = await controller.create("ws_123", {
        url: "https://webhook.example.com/events",
        events: ["subscription.created"],
        description: "Production webhook",
      });

      expect(result).toEqual(mockEndpoint);
      expect(webhooksService.createEndpoint).toHaveBeenCalledWith("ws_123", {
        url: "https://webhook.example.com/events",
        events: ["subscription.created"],
        description: "Production webhook",
      });
    });
  });

  describe("update", () => {
    it("should update endpoint", async () => {
      webhooksService.updateEndpoint.mockResolvedValue({
        ...mockEndpoint,
        status: "disabled",
      });

      const result = await controller.update("ws_123", "ep_123", {
        status: "disabled",
      });

      expect(result.status).toBe("disabled");
      expect(webhooksService.updateEndpoint).toHaveBeenCalledWith(
        "ws_123",
        "ep_123",
        { status: "disabled" },
      );
    });
  });

  describe("delete", () => {
    it("should delete endpoint", async () => {
      webhooksService.deleteEndpoint.mockResolvedValue(undefined);

      await controller.delete("ws_123", "ep_123");

      expect(webhooksService.deleteEndpoint).toHaveBeenCalledWith(
        "ws_123",
        "ep_123",
      );
    });
  });

  describe("rotateSecret", () => {
    it("should rotate secret and return new secret", async () => {
      webhooksService.rotateSecret.mockResolvedValue("whsec_new123");

      const result = await controller.rotateSecret("ws_123", "ep_123");

      expect(result.secret).toBe("whsec_new123");
      expect(webhooksService.rotateSecret).toHaveBeenCalledWith(
        "ws_123",
        "ep_123",
      );
    });
  });
});
