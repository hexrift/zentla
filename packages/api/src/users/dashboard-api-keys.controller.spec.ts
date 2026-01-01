import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { DashboardApiKeysController } from "./dashboard-api-keys.controller";
import { ApiKeyService } from "../auth/services/api-key.service";
import { PrismaService } from "../database/prisma.service";

describe("DashboardApiKeysController", () => {
  let controller: DashboardApiKeysController;
  let apiKeyService: {
    listApiKeys: ReturnType<typeof vi.fn>;
    generateApiKey: ReturnType<typeof vi.fn>;
    revokeApiKey: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    workspaceMembership: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    workspace: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  const mockSession = {
    userId: "user_123",
    sessionId: "sess_123",
    expiresAt: new Date(Date.now() + 3600000),
  };

  const mockApiKey = {
    id: "key_123",
    name: "Test Key",
    keyPrefix: "relay_live_",
    role: "admin",
    environment: "live",
    lastUsedAt: null,
    expiresAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    apiKeyService = {
      listApiKeys: vi.fn(),
      generateApiKey: vi.fn(),
      revokeApiKey: vi.fn(),
    };

    prisma = {
      workspaceMembership: {
        findFirst: vi.fn(),
      },
      workspace: {
        findUnique: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardApiKeysController],
      providers: [
        { provide: ApiKeyService, useValue: apiKeyService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    controller = module.get<DashboardApiKeysController>(
      DashboardApiKeysController,
    );
  });

  describe("listApiKeys", () => {
    it("should throw ForbiddenException when user has no access", async () => {
      prisma.workspaceMembership.findFirst.mockResolvedValue(null);

      await expect(
        controller.listApiKeys(mockSession, "ws_123"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException when user role is too low", async () => {
      prisma.workspaceMembership.findFirst.mockResolvedValue({
        role: "admin", // admin is not owner
      });

      await expect(
        controller.listApiKeys(mockSession, "ws_123"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should return API keys when user is owner", async () => {
      prisma.workspaceMembership.findFirst.mockResolvedValue({
        role: "owner",
      });
      apiKeyService.listApiKeys.mockResolvedValue([mockApiKey]);

      const result = await controller.listApiKeys(mockSession, "ws_123");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("key_123");
      expect(result[0].name).toBe("Test Key");
      expect(apiKeyService.listApiKeys).toHaveBeenCalledWith("ws_123");
    });
  });

  describe("createApiKey", () => {
    it("should throw ForbiddenException when user has no access", async () => {
      prisma.workspaceMembership.findFirst.mockResolvedValue(null);

      await expect(
        controller.createApiKey(mockSession, "ws_123", {
          name: "New Key",
          role: "member",
          environment: "test",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should create test API key when user is owner", async () => {
      prisma.workspaceMembership.findFirst.mockResolvedValue({
        role: "owner",
      });
      apiKeyService.generateApiKey.mockResolvedValue({
        id: "key_new",
        secret: "relay_test_secret123",
        prefix: "relay_test_",
      });

      const result = await controller.createApiKey(mockSession, "ws_123", {
        name: "New Key",
        role: "member",
        environment: "test",
      });

      expect(result.id).toBe("key_new");
      expect(result.secret).toBe("relay_test_secret123");
      expect(result.message).toContain("Store this secret securely");
    });

    it("should throw NotFoundException when workspace not found for live key", async () => {
      prisma.workspaceMembership.findFirst.mockResolvedValue({
        role: "owner",
      });
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(
        controller.createApiKey(mockSession, "ws_123", {
          name: "Live Key",
          role: "member",
          environment: "live",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException for live key in test workspace", async () => {
      prisma.workspaceMembership.findFirst.mockResolvedValue({
        role: "owner",
      });
      prisma.workspace.findUnique.mockResolvedValue({
        mode: "test",
      });

      await expect(
        controller.createApiKey(mockSession, "ws_123", {
          name: "Live Key",
          role: "member",
          environment: "live",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should create live API key when workspace is in live mode", async () => {
      prisma.workspaceMembership.findFirst.mockResolvedValue({
        role: "owner",
      });
      prisma.workspace.findUnique.mockResolvedValue({
        mode: "live",
      });
      apiKeyService.generateApiKey.mockResolvedValue({
        id: "key_live",
        secret: "relay_live_secret123",
        prefix: "relay_live_",
      });

      const result = await controller.createApiKey(mockSession, "ws_123", {
        name: "Live Key",
        role: "admin",
        environment: "live",
      });

      expect(result.id).toBe("key_live");
      expect(result.environment).toBe("live");
    });

    it("should pass expiresAt when provided", async () => {
      prisma.workspaceMembership.findFirst.mockResolvedValue({
        role: "owner",
      });
      apiKeyService.generateApiKey.mockResolvedValue({
        id: "key_expiring",
        secret: "relay_test_secret",
        prefix: "relay_test_",
      });

      const expiresAt = "2025-12-31T23:59:59Z";
      await controller.createApiKey(mockSession, "ws_123", {
        name: "Expiring Key",
        role: "readonly",
        environment: "test",
        expiresAt,
      });

      expect(apiKeyService.generateApiKey).toHaveBeenCalledWith(
        "ws_123",
        "Expiring Key",
        "readonly",
        "test",
        new Date(expiresAt),
      );
    });
  });

  describe("revokeApiKey", () => {
    it("should throw ForbiddenException when user has no access", async () => {
      prisma.workspaceMembership.findFirst.mockResolvedValue(null);

      await expect(
        controller.revokeApiKey(mockSession, "ws_123", "key_123"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should revoke API key when user is owner", async () => {
      prisma.workspaceMembership.findFirst.mockResolvedValue({
        role: "owner",
      });
      apiKeyService.revokeApiKey.mockResolvedValue(undefined);

      await controller.revokeApiKey(mockSession, "ws_123", "key_123");

      expect(apiKeyService.revokeApiKey).toHaveBeenCalledWith(
        "ws_123",
        "key_123",
      );
    });
  });
});
