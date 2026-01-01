import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiKeyGuard } from "./api-key.guard";
import { ApiKeyService } from "../services/api-key.service";

describe("ApiKeyGuard", () => {
  let guard: ApiKeyGuard;
  let apiKeyService: {
    validateApiKey: ReturnType<typeof vi.fn>;
    toApiKeyContext: ReturnType<typeof vi.fn>;
  };
  let reflector: {
    getAllAndOverride: ReturnType<typeof vi.fn>;
  };

  const mockApiKeyContext = {
    keyId: "key_123",
    workspaceId: "ws_123",
    role: "admin",
    environment: "live",
  };

  const mockValidatedKey = {
    id: "key_123",
    workspaceId: "ws_123",
    role: "admin",
    environment: "live",
  };

  const createMockContext = (
    overrides: {
      headers?: Record<string, string>;
      sessionContext?: object | null;
    } = {},
  ): ExecutionContext => {
    const request = {
      headers: overrides.headers || {},
      sessionContext: overrides.sessionContext,
      apiKeyContext: undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    apiKeyService = {
      validateApiKey: vi.fn(),
      toApiKeyContext: vi.fn().mockReturnValue(mockApiKeyContext),
    };

    reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: ApiKeyService, useValue: apiKeyService },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
  });

  describe("canActivate", () => {
    it("should allow public routes", async () => {
      reflector.getAllAndOverride.mockReturnValueOnce(true); // IS_PUBLIC_KEY

      const context = createMockContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should allow session-authenticated requests", async () => {
      const context = createMockContext({
        sessionContext: { userId: "user_123" },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(apiKeyService.validateApiKey).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException when missing auth header", async () => {
      const context = createMockContext();

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Missing Authorization header",
      );
    });

    it("should allow missing auth header when OptionalAuth", async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(true); // IS_OPTIONAL_AUTH_KEY

      const context = createMockContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should throw UnauthorizedException for invalid header format", async () => {
      const context = createMockContext({
        headers: { authorization: "InvalidFormat" },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Invalid Authorization header format",
      );
    });

    it("should throw UnauthorizedException for Basic auth", async () => {
      const context = createMockContext({
        headers: { authorization: "Basic dXNlcm5hbWU6cGFzc3dvcmQ=" },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException for missing token", async () => {
      const context = createMockContext({
        headers: { authorization: "Bearer " },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException for invalid API key", async () => {
      apiKeyService.validateApiKey.mockResolvedValue(null);

      const context = createMockContext({
        headers: { authorization: "Bearer relay_live_invalidkey123" },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Invalid or expired API key",
      );
    });

    it("should validate and attach API key context on success", async () => {
      apiKeyService.validateApiKey.mockResolvedValue(mockValidatedKey);

      const request = {
        headers: { authorization: "Bearer relay_live_validkey123" },
        sessionContext: undefined,
        apiKeyContext: undefined,
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(apiKeyService.validateApiKey).toHaveBeenCalledWith(
        "relay_live_validkey123",
      );
      expect(apiKeyService.toApiKeyContext).toHaveBeenCalledWith(
        mockValidatedKey,
      );
      expect(request.apiKeyContext).toEqual(mockApiKeyContext);
    });
  });
});
