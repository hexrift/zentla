import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";
import { PrismaService } from "../database/prisma.service";

describe("WebhooksService", () => {
  let service: WebhooksService;
  let prisma: {
    webhookEndpoint: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
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
    prisma = {
      webhookEndpoint: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  describe("findEndpointById", () => {
    it("should return endpoint when found", async () => {
      prisma.webhookEndpoint.findFirst.mockResolvedValue(mockEndpoint);

      const result = await service.findEndpointById("ws_123", "ep_123");

      expect(result).toEqual(mockEndpoint);
      expect(prisma.webhookEndpoint.findFirst).toHaveBeenCalledWith({
        where: { id: "ep_123", workspaceId: "ws_123" },
      });
    });

    it("should return null when not found", async () => {
      prisma.webhookEndpoint.findFirst.mockResolvedValue(null);

      const result = await service.findEndpointById("ws_123", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findEndpoints", () => {
    it("should return paginated endpoints", async () => {
      const endpoints = [mockEndpoint, { ...mockEndpoint, id: "ep_456" }];
      prisma.webhookEndpoint.findMany.mockResolvedValue(endpoints);

      const result = await service.findEndpoints("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("should indicate hasMore when more results exist", async () => {
      const endpoints = Array(11)
        .fill(null)
        .map((_, i) => ({ ...mockEndpoint, id: `ep_${i}` }));
      prisma.webhookEndpoint.findMany.mockResolvedValue(endpoints);

      const result = await service.findEndpoints("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("ep_9");
    });

    it("should use cursor for pagination", async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([]);

      await service.findEndpoints("ws_123", { limit: 10, cursor: "ep_100" });

      expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "ws_123" },
        take: 11,
        cursor: { id: "ep_100" },
        skip: 1,
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("createEndpoint", () => {
    it("should create endpoint with generated secret", async () => {
      prisma.webhookEndpoint.create.mockResolvedValue(mockEndpoint);

      const result = await service.createEndpoint("ws_123", {
        url: "https://webhook.example.com/events",
        events: ["subscription.created"],
        description: "Production webhook",
      });

      expect(result).toEqual(mockEndpoint);
      expect(prisma.webhookEndpoint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws_123",
          url: "https://webhook.example.com/events",
          events: ["subscription.created"],
          status: "active",
          description: "Production webhook",
          secret: expect.stringMatching(/^whsec_/),
        }),
      });
    });

    it("should create endpoint with metadata", async () => {
      prisma.webhookEndpoint.create.mockResolvedValue({
        ...mockEndpoint,
        metadata: { environment: "production" },
      });

      await service.createEndpoint("ws_123", {
        url: "https://webhook.example.com",
        events: ["*"],
        metadata: { environment: "production" },
      });

      expect(prisma.webhookEndpoint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { environment: "production" },
        }),
      });
    });
  });

  describe("updateEndpoint", () => {
    it("should throw NotFoundException when endpoint not found", async () => {
      prisma.webhookEndpoint.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEndpoint("ws_123", "nonexistent", { url: "https://new.url" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should update endpoint url", async () => {
      prisma.webhookEndpoint.findFirst.mockResolvedValue(mockEndpoint);
      prisma.webhookEndpoint.update.mockResolvedValue({
        ...mockEndpoint,
        url: "https://new.url",
      });

      const result = await service.updateEndpoint("ws_123", "ep_123", {
        url: "https://new.url",
      });

      expect(result.url).toBe("https://new.url");
      expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith({
        where: { id: "ep_123" },
        data: expect.objectContaining({
          url: "https://new.url",
          version: { increment: 1 },
        }),
      });
    });

    it("should update endpoint status", async () => {
      prisma.webhookEndpoint.findFirst.mockResolvedValue(mockEndpoint);
      prisma.webhookEndpoint.update.mockResolvedValue({
        ...mockEndpoint,
        status: "disabled",
      });

      const result = await service.updateEndpoint("ws_123", "ep_123", {
        status: "disabled",
      });

      expect(result.status).toBe("disabled");
    });

    it("should update endpoint events", async () => {
      prisma.webhookEndpoint.findFirst.mockResolvedValue(mockEndpoint);
      prisma.webhookEndpoint.update.mockResolvedValue({
        ...mockEndpoint,
        events: ["*"],
      });

      await service.updateEndpoint("ws_123", "ep_123", {
        events: ["*"],
      });

      expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith({
        where: { id: "ep_123" },
        data: expect.objectContaining({
          events: ["*"],
        }),
      });
    });
  });

  describe("deleteEndpoint", () => {
    it("should throw NotFoundException when endpoint not found", async () => {
      prisma.webhookEndpoint.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteEndpoint("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should delete endpoint", async () => {
      prisma.webhookEndpoint.findFirst.mockResolvedValue(mockEndpoint);
      prisma.webhookEndpoint.delete.mockResolvedValue(mockEndpoint);

      await service.deleteEndpoint("ws_123", "ep_123");

      expect(prisma.webhookEndpoint.delete).toHaveBeenCalledWith({
        where: { id: "ep_123" },
      });
    });
  });

  describe("rotateSecret", () => {
    it("should throw NotFoundException when endpoint not found", async () => {
      prisma.webhookEndpoint.findFirst.mockResolvedValue(null);

      await expect(
        service.rotateSecret("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should generate new secret and update endpoint", async () => {
      prisma.webhookEndpoint.findFirst.mockResolvedValue(mockEndpoint);
      prisma.webhookEndpoint.update.mockResolvedValue({
        ...mockEndpoint,
        secret: "whsec_new123",
      });

      const result = await service.rotateSecret("ws_123", "ep_123");

      expect(result).toMatch(/^whsec_/);
      expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith({
        where: { id: "ep_123" },
        data: {
          secret: expect.stringMatching(/^whsec_/),
          version: { increment: 1 },
        },
      });
    });
  });

  describe("signPayload", () => {
    it("should generate valid signature", () => {
      const payload = {
        id: "evt_123",
        type: "subscription.created",
        timestamp: "2025-01-01T00:00:00Z",
        data: { subscriptionId: "sub_123" },
      };

      const signature = service.signPayload(payload, "whsec_testsecret");

      expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]+$/);
    });
  });

  describe("verifySignature", () => {
    it("should return false for invalid signature format", () => {
      const result = service.verifySignature(
        '{"id":"evt_123"}',
        "invalid",
        "whsec_secret",
      );

      expect(result).toBe(false);
    });

    it("should return false for missing timestamp", () => {
      const result = service.verifySignature(
        '{"id":"evt_123"}',
        "v1=abc123",
        "whsec_secret",
      );

      expect(result).toBe(false);
    });

    it("should return false for missing signature", () => {
      const result = service.verifySignature(
        '{"id":"evt_123"}',
        "t=1234567890",
        "whsec_secret",
      );

      expect(result).toBe(false);
    });

    it("should return false for expired timestamp", () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const result = service.verifySignature(
        '{"id":"evt_123"}',
        `t=${oldTimestamp},v1=abc123`,
        "whsec_secret",
        300, // 5 minute tolerance
      );

      expect(result).toBe(false);
    });

    it("should return false for invalid signature", () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const result = service.verifySignature(
        '{"id":"evt_123"}',
        `t=${timestamp},v1=invalidsignature`,
        "whsec_secret",
      );

      expect(result).toBe(false);
    });

    it("should return true for valid signature", () => {
      const payload = '{"id":"evt_123"}';
      const secret = "whsec_testsecret";

      // Create a valid signature
      const timestamp = Math.floor(Date.now() / 1000);
      const { createHmac } = require("crypto");
      const signedPayload = `${timestamp}.${payload}`;
      const signature = createHmac("sha256", secret)
        .update(signedPayload)
        .digest("hex");

      const result = service.verifySignature(
        payload,
        `t=${timestamp},v1=${signature}`,
        secret,
      );

      expect(result).toBe(true);
    });
  });
});
