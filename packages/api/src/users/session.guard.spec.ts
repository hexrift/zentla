import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SessionGuard } from "./session.guard";
import { UserSessionService } from "./user-session.service";
import { PrismaService } from "../database/prisma.service";

describe("SessionGuard", () => {
  let guard: SessionGuard;
  let sessionService: {
    validateSession: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    workspaceMembership: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };
  let reflector: {
    getAllAndOverride: ReturnType<typeof vi.fn>;
  };

  const createMockContext = (
    overrides: {
      headers?: Record<string, string>;
    } = {},
  ): ExecutionContext => {
    const request = {
      headers: overrides.headers || {},
      sessionContext: undefined,
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
    sessionService = {
      validateSession: vi.fn(),
    };

    prisma = {
      user: {
        findUnique: vi.fn(),
      },
      workspaceMembership: {
        findFirst: vi.fn(),
      },
    };

    reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionGuard,
        { provide: UserSessionService, useValue: sessionService },
        { provide: PrismaService, useValue: prisma },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get<SessionGuard>(SessionGuard);
  });

  describe("canActivate", () => {
    it("should allow public routes", async () => {
      reflector.getAllAndOverride.mockReturnValue(true);

      const context = createMockContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should allow requests without auth header", async () => {
      const context = createMockContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should allow non-Bearer auth headers", async () => {
      const context = createMockContext({
        headers: { authorization: "Basic abc123" },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should allow non-session tokens", async () => {
      const context = createMockContext({
        headers: { authorization: "Bearer zentla_live_abc123" },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(sessionService.validateSession).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException for invalid session", async () => {
      sessionService.validateSession.mockResolvedValue(null);

      const context = createMockContext({
        headers: { authorization: "Bearer zentla_session_abc123" },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should attach session context for valid session", async () => {
      sessionService.validateSession.mockResolvedValue({
        userId: "user_123",
        sessionId: "sess_123",
        expiresAt: new Date(),
      });
      prisma.user.findUnique.mockResolvedValue({
        id: "user_123",
        email: "test@example.com",
        name: "Test User",
      });
      prisma.workspaceMembership.findFirst.mockResolvedValue({
        workspaceId: "ws_123",
        role: "owner",
        workspace: { mode: "test" },
      });

      const request: {
        headers: Record<string, string>;
        sessionContext:
          | { userId: string; sessionId: string; expiresAt: Date }
          | undefined;
        apiKeyContext:
          | { workspaceId: string; role: string; mode: string }
          | undefined;
      } = {
        headers: { authorization: "Bearer zentla_session_abc123" },
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
      expect(request.sessionContext).toBeDefined();
      expect(request.sessionContext!.userId).toBe("user_123");
      expect(request.apiKeyContext).toBeDefined();
      expect(request.apiKeyContext!.workspaceId).toBe("ws_123");
    });
  });
});
