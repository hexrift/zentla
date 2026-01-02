import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ApiKeyService } from "./api-key.service";
import { PrismaService } from "../../database/prisma.service";

describe("ApiKeyService", () => {
  let service: ApiKeyService;
  let prisma: {
    apiKey: {
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };
  let configService: {
    get: ReturnType<typeof vi.fn>;
  };

  const mockApiKey = {
    id: "key_123",
    workspaceId: "ws_123",
    name: "Production API Key",
    keyPrefix: "zentla_live_12345678",
    keyHash: "abc123def456", // This would be an actual hash
    role: "admin" as const,
    environment: "live" as const,
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      apiKey: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    configService = {
      get: vi.fn().mockReturnValue("test-secret-key"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
  });

  describe("constructor", () => {
    it("should throw error if API_KEY_SECRET is not configured", async () => {
      configService.get.mockReturnValue(undefined);

      await expect(
        Test.createTestingModule({
          providers: [
            ApiKeyService,
            { provide: PrismaService, useValue: prisma },
            { provide: ConfigService, useValue: configService },
          ],
        }).compile(),
      ).rejects.toThrow("API_KEY_SECRET is required");
    });
  });

  describe("generateApiKey", () => {
    it("should generate live API key with correct prefix", async () => {
      prisma.apiKey.create.mockResolvedValue({
        ...mockApiKey,
        id: "key_new",
      });

      const result = await service.generateApiKey(
        "ws_123",
        "Production Key",
        "admin",
        "live",
      );

      expect(result.id).toBe("key_new");
      expect(result.secret).toMatch(/^zentla_live_/);
      expect(result.prefix).toMatch(/^zentla_live_/);
      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws_123",
          name: "Production Key",
          role: "admin",
          environment: "live",
        }),
      });
    });

    it("should generate test API key with correct prefix", async () => {
      prisma.apiKey.create.mockResolvedValue({
        ...mockApiKey,
        environment: "test",
      });

      const result = await service.generateApiKey(
        "ws_123",
        "Test Key",
        "readonly",
        "test",
      );

      expect(result.secret).toMatch(/^zentla_test_/);
      expect(result.prefix).toMatch(/^zentla_test_/);
    });

    it("should store expiration date if provided", async () => {
      const expiresAt = new Date("2025-12-31");
      prisma.apiKey.create.mockResolvedValue({
        ...mockApiKey,
        expiresAt,
      });

      await service.generateApiKey(
        "ws_123",
        "Expiring Key",
        "admin",
        "live",
        expiresAt,
      );

      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt,
        }),
      });
    });
  });

  describe("validateApiKey", () => {
    it("should return null for invalid prefix", async () => {
      const result = await service.validateApiKey("invalid_key_123");

      expect(result).toBeNull();
      expect(prisma.apiKey.findFirst).not.toHaveBeenCalled();
    });

    it("should return null when key not found in database", async () => {
      prisma.apiKey.findFirst.mockResolvedValue(null);

      const result = await service.validateApiKey(
        "zentla_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      );

      expect(result).toBeNull();
    });

    it("should return null for expired key", async () => {
      // Generate a key first to get a valid hash
      prisma.apiKey.create.mockImplementation(async ({ data }) => ({
        ...mockApiKey,
        id: "key_new",
        keyHash: data.keyHash,
        keyPrefix: data.keyPrefix,
        expiresAt: new Date("2020-01-01"), // Expired
      }));

      const generated = await service.generateApiKey(
        "ws_123",
        "Test",
        "admin",
        "live",
      );

      // Mock the findFirst to return the expired key with correct hash
      prisma.apiKey.findFirst.mockResolvedValue({
        ...mockApiKey,
        keyHash: (prisma.apiKey.create.mock.calls[0][0] as any).data.keyHash,
        keyPrefix: generated.prefix,
        expiresAt: new Date("2020-01-01"), // Expired
      });

      const result = await service.validateApiKey(generated.secret);

      expect(result).toBeNull();
    });

    it("should validate live key prefix", async () => {
      prisma.apiKey.findFirst.mockResolvedValue(null);

      await service.validateApiKey("zentla_live_12345678abcdef");

      expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({
        where: {
          keyPrefix: "zentla_live_12345678",
          revokedAt: null,
        },
      });
    });

    it("should validate test key prefix", async () => {
      prisma.apiKey.findFirst.mockResolvedValue(null);

      await service.validateApiKey("zentla_test_12345678abcdef");

      expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({
        where: {
          keyPrefix: "zentla_test_12345678",
          revokedAt: null,
        },
      });
    });
  });

  describe("revokeApiKey", () => {
    it("should revoke API key by setting revokedAt", async () => {
      prisma.apiKey.updateMany.mockResolvedValue({ count: 1 });

      await service.revokeApiKey("ws_123", "key_123");

      expect(prisma.apiKey.updateMany).toHaveBeenCalledWith({
        where: {
          id: "key_123",
          workspaceId: "ws_123",
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe("listApiKeys", () => {
    it("should list non-revoked API keys for workspace", async () => {
      const apiKeys = [mockApiKey, { ...mockApiKey, id: "key_456" }];
      prisma.apiKey.findMany.mockResolvedValue(apiKeys);

      const result = await service.listApiKeys("ws_123");

      expect(result).toEqual(apiKeys);
      expect(prisma.apiKey.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          revokedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    });
  });

  describe("toApiKeyContext", () => {
    it("should convert validated key to context", () => {
      const validated = {
        id: "key_123",
        workspaceId: "ws_123",
        role: "admin" as const,
        environment: "live" as const,
      };

      const result = service.toApiKeyContext(validated);

      expect(result).toEqual({
        keyId: "key_123",
        workspaceId: "ws_123",
        role: "admin",
        environment: "live",
      });
    });
  });
});
