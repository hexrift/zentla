import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: {
    getAllAndOverride: ReturnType<typeof vi.fn>;
  };

  const createMockContext = (apiKeyContext?: {
    role: string;
  }): ExecutionContext => {
    const request = {
      apiKeyContext,
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
      providers: [RolesGuard, { provide: Reflector, useValue: reflector }],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  describe("canActivate", () => {
    it("should allow public routes", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(true) // IS_PUBLIC_KEY
        .mockReturnValueOnce(null); // ROLES_KEY

      const context = createMockContext();
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should allow when no roles are required", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(null); // ROLES_KEY

      const context = createMockContext({ role: "readonly" });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should allow when empty roles array", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([]); // ROLES_KEY

      const context = createMockContext({ role: "readonly" });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should throw ForbiddenException when no apiKeyContext", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(["admin"]); // ROLES_KEY

      const context = createMockContext();

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("should allow owner role for any required role", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(["readonly"]); // ROLES_KEY

      const context = createMockContext({ role: "owner" });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should allow admin role for admin and below", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(["member"]); // ROLES_KEY

      const context = createMockContext({ role: "admin" });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should deny readonly role when admin is required", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(["admin"]); // ROLES_KEY

      const context = createMockContext({ role: "readonly" });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("should deny member role when owner is required", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(["owner"]); // ROLES_KEY

      const context = createMockContext({ role: "member" });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("should include required roles in error message", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(["admin", "owner"]); // ROLES_KEY

      const context = createMockContext({ role: "readonly" });

      try {
        guard.canActivate(context);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as ForbiddenException).message).toContain(
          "admin or owner",
        );
      }
    });

    it("should allow when user has one of multiple required roles", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(["admin", "member"]); // ROLES_KEY

      const context = createMockContext({ role: "member" });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
