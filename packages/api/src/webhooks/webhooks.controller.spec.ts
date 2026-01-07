import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller";
import { StripeWebhookService } from "./stripe-webhook.service";
import { ZuoraWebhookService } from "./zuora-webhook.service";

describe("WebhooksController", () => {
  let controller: WebhooksController;
  let stripeWebhookService: {
    processWebhook: ReturnType<typeof vi.fn>;
  };
  let zuoraWebhookService: {
    processWebhook: ReturnType<typeof vi.fn>;
  };

  const createMockRequest = (rawBody?: Buffer) => ({
    rawBody,
    body: {},
  });

  const createMockResponse = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  });

  beforeEach(async () => {
    stripeWebhookService = {
      processWebhook: vi.fn(),
    };

    zuoraWebhookService = {
      processWebhook: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        { provide: StripeWebhookService, useValue: stripeWebhookService },
        { provide: ZuoraWebhookService, useValue: zuoraWebhookService },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  describe("handleStripeWebhook", () => {
    it("should throw BadRequestException when rawBody is missing", async () => {
      const mockRequest = createMockRequest(undefined);
      const mockResponse = createMockResponse();

      await expect(
        controller.handleStripeWebhook(
          mockRequest as never,
          mockResponse as never,
          "sig_123",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when signature is missing", async () => {
      const mockRequest = createMockRequest(Buffer.from("{}"));
      const mockResponse = createMockResponse();

      await expect(
        controller.handleStripeWebhook(
          mockRequest as never,
          mockResponse as never,
          "",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should process webhook successfully", async () => {
      const mockRequest = createMockRequest(Buffer.from("{}"));
      const mockResponse = createMockResponse();
      stripeWebhookService.processWebhook.mockResolvedValue({
        received: true,
        eventType: "checkout.session.completed",
      });

      await controller.handleStripeWebhook(
        mockRequest as never,
        mockResponse as never,
        "sig_123",
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        received: true,
        eventType: "checkout.session.completed",
      });
    });

    it("should return 400 for invalid signature error", async () => {
      const mockRequest = createMockRequest(Buffer.from("{}"));
      const mockResponse = createMockResponse();
      stripeWebhookService.processWebhook.mockRejectedValue(
        new Error("Invalid webhook signature"),
      );

      await controller.handleStripeWebhook(
        mockRequest as never,
        mockResponse as never,
        "invalid_sig",
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Invalid signature",
      });
    });

    it("should return 500 for processing errors", async () => {
      const mockRequest = createMockRequest(Buffer.from("{}"));
      const mockResponse = createMockResponse();
      stripeWebhookService.processWebhook.mockRejectedValue(
        new Error("Database error"),
      );

      await controller.handleStripeWebhook(
        mockRequest as never,
        mockResponse as never,
        "sig_123",
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Processing failed",
      });
    });
  });

  describe("handleStripeWebhookLegacy", () => {
    it("should process legacy webhook route", async () => {
      const mockRequest = createMockRequest(Buffer.from("{}"));
      const mockResponse = createMockResponse();
      stripeWebhookService.processWebhook.mockResolvedValue({
        received: true,
        eventType: "invoice.paid",
      });

      await controller.handleStripeWebhookLegacy(
        mockRequest as never,
        mockResponse as never,
        "sig_123",
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe("handleZuoraWebhook", () => {
    it("should throw BadRequestException when rawBody is missing", async () => {
      const mockRequest = createMockRequest(undefined);
      const mockResponse = createMockResponse();

      await expect(
        controller.handleZuoraWebhook(
          mockRequest as never,
          mockResponse as never,
          "sig_123",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should process webhook successfully", async () => {
      const mockRequest = createMockRequest(Buffer.from("{}"));
      const mockResponse = createMockResponse();
      zuoraWebhookService.processWebhook.mockResolvedValue({
        received: true,
        eventId: "evt_zuora_123",
      });

      await controller.handleZuoraWebhook(
        mockRequest as never,
        mockResponse as never,
        "sig_123",
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        received: true,
        eventId: "evt_zuora_123",
      });
    });

    it("should process webhook without signature (optional)", async () => {
      const mockRequest = createMockRequest(Buffer.from("{}"));
      const mockResponse = createMockResponse();
      zuoraWebhookService.processWebhook.mockResolvedValue({
        received: true,
        eventId: "evt_zuora_456",
      });

      await controller.handleZuoraWebhook(
        mockRequest as never,
        mockResponse as never,
        "",
      );

      expect(zuoraWebhookService.processWebhook).toHaveBeenCalledWith(
        expect.any(Buffer),
        "",
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it("should return 400 for invalid signature error", async () => {
      const mockRequest = createMockRequest(Buffer.from("{}"));
      const mockResponse = createMockResponse();
      zuoraWebhookService.processWebhook.mockRejectedValue(
        new Error("Invalid webhook signature"),
      );

      await controller.handleZuoraWebhook(
        mockRequest as never,
        mockResponse as never,
        "invalid_sig",
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Invalid signature",
      });
    });

    it("should return 400 for invalid payload error", async () => {
      const mockRequest = createMockRequest(Buffer.from("invalid json"));
      const mockResponse = createMockResponse();
      zuoraWebhookService.processWebhook.mockRejectedValue(
        new Error("Invalid webhook payload"),
      );

      await controller.handleZuoraWebhook(
        mockRequest as never,
        mockResponse as never,
        "sig_123",
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Invalid payload",
      });
    });

    it("should return 500 for processing errors", async () => {
      const mockRequest = createMockRequest(Buffer.from("{}"));
      const mockResponse = createMockResponse();
      zuoraWebhookService.processWebhook.mockRejectedValue(
        new Error("Database error"),
      );

      await controller.handleZuoraWebhook(
        mockRequest as never,
        mockResponse as never,
        "sig_123",
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Processing failed",
      });
    });
  });

  describe("handleZuoraWebhookLegacy", () => {
    it("should process legacy webhook route", async () => {
      const mockRequest = createMockRequest(Buffer.from("{}"));
      const mockResponse = createMockResponse();
      zuoraWebhookService.processWebhook.mockResolvedValue({
        received: true,
        eventId: "evt_zuora_789",
      });

      await controller.handleZuoraWebhookLegacy(
        mockRequest as never,
        mockResponse as never,
        "sig_123",
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });
});
