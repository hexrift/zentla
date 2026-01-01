import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { WorkspaceGuard } from "./workspace.guard";

describe("WorkspaceGuard", () => {
  let guard: WorkspaceGuard;
  let reflector: {
    getAllAndOverride: ReturnType<typeof vi.fn>;
  };

  const createMockContext = (
    apiKeyContext?: { workspaceId: string },
    sessionContext?: { userId: string },
    workspaceIdParam?: string,
  ): ExecutionContext => {
    const request = {
      apiKeyContext,
      sessionContext,
      params: { workspaceId: workspaceIdParam },
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
    reflector = {
      getAllAndOverride: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceGuard,
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get<WorkspaceGuard>(WorkspaceGuard);
  });

  describe("canActivate", () => {
    it("should allow public routes", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(true) // IS_PUBLIC_KEY
        .mockReturnValueOnce(false); // SKIP_WORKSPACE_KEY

      const context = createMockContext();
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should allow routes with skip workspace decoration", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(true); // SKIP_WORKSPACE_KEY

      const context = createMockContext();
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should allow session authenticated users", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(false); // SKIP_WORKSPACE_KEY

      const context = createMockContext(undefined, { userId: "user_123" });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should throw ForbiddenException when no API key context", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(false); // SKIP_WORKSPACE_KEY

      const context = createMockContext();

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("should allow when no workspace param", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(false); // SKIP_WORKSPACE_KEY

      const context = createMockContext({ workspaceId: "ws_123" });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should allow when workspace param matches API key workspace", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(false); // SKIP_WORKSPACE_KEY

      const context = createMockContext(
        { workspaceId: "ws_123" },
        undefined,
        "ws_123",
      );
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should throw ForbiddenException when workspace param does not match", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(false); // SKIP_WORKSPACE_KEY

      const context = createMockContext(
        { workspaceId: "ws_123" },
        undefined,
        "ws_different",
      );

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("should include workspace access error message", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(false); // SKIP_WORKSPACE_KEY

      const context = createMockContext(
        { workspaceId: "ws_123" },
        undefined,
        "ws_different",
      );

      try {
        guard.canActivate(context);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as ForbiddenException).message).toContain(
          "does not have access",
        );
      }
    });
  });
});
