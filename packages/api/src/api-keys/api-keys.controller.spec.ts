import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeyService } from "../auth/services/api-key.service";

describe("ApiKeysController", () => {
  let controller: ApiKeysController;
  let apiKeyService: {
    listApiKeys: ReturnType<typeof vi.fn>;
    generateApiKey: ReturnType<typeof vi.fn>;
    revokeApiKey: ReturnType<typeof vi.fn>;
  };

  const mockApiKey = {
    id: "key_123",
    workspaceId: "ws_123",
    name: "Production API Key",
    keyPrefix: "relay_live_abc",
    keyHash: "hashedvalue",
    role: "admin" as const,
    environment: "live" as const,
    lastUsedAt: new Date(),
    expiresAt: null,
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    apiKeyService = {
      listApiKeys: vi.fn(),
      generateApiKey: vi.fn(),
      revokeApiKey: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeysController],
      providers: [{ provide: ApiKeyService, useValue: apiKeyService }],
    }).compile();

    controller = module.get<ApiKeysController>(ApiKeysController);
  });

  describe("findAll", () => {
    it("should return list of API keys without sensitive data", async () => {
      apiKeyService.listApiKeys.mockResolvedValue([mockApiKey]);

      const result = await controller.findAll("ws_123");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: mockApiKey.id,
        name: mockApiKey.name,
        keyPrefix: mockApiKey.keyPrefix,
        role: mockApiKey.role,
        environment: mockApiKey.environment,
        lastUsedAt: mockApiKey.lastUsedAt,
        expiresAt: mockApiKey.expiresAt,
        createdAt: mockApiKey.createdAt,
      });
      // Ensure keyHash is not exposed
      expect((result[0] as any).keyHash).toBeUndefined();
    });

    it("should return empty array when no keys", async () => {
      apiKeyService.listApiKeys.mockResolvedValue([]);

      const result = await controller.findAll("ws_123");

      expect(result).toEqual([]);
    });
  });

  describe("create", () => {
    it("should create API key and return secret", async () => {
      apiKeyService.generateApiKey.mockResolvedValue({
        id: "key_new",
        secret: "relay_live_fullsecret123",
        prefix: "relay_live_full",
      });

      const result = await controller.create("ws_123", {
        name: "New Key",
        role: "admin",
        environment: "live",
      });

      expect(result.id).toBe("key_new");
      expect(result.secret).toBe("relay_live_fullsecret123");
      expect(result.prefix).toBe("relay_live_full");
      expect(result.message).toContain("Store this secret securely");
      expect(apiKeyService.generateApiKey).toHaveBeenCalledWith(
        "ws_123",
        "New Key",
        "admin",
        "live",
        undefined,
      );
    });

    it("should pass expiration date when provided", async () => {
      apiKeyService.generateApiKey.mockResolvedValue({
        id: "key_new",
        secret: "relay_test_secret",
        prefix: "relay_test_",
      });

      await controller.create("ws_123", {
        name: "Expiring Key",
        role: "readonly",
        environment: "test",
        expiresAt: "2025-12-31T23:59:59Z",
      });

      expect(apiKeyService.generateApiKey).toHaveBeenCalledWith(
        "ws_123",
        "Expiring Key",
        "readonly",
        "test",
        new Date("2025-12-31T23:59:59Z"),
      );
    });
  });

  describe("revoke", () => {
    it("should revoke API key", async () => {
      apiKeyService.revokeApiKey.mockResolvedValue(undefined);

      await controller.revoke("ws_123", "key_123");

      expect(apiKeyService.revokeApiKey).toHaveBeenCalledWith(
        "ws_123",
        "key_123",
      );
    });
  });
});
