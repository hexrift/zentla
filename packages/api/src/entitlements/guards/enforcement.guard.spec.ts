import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { EnforcementGuard } from "./enforcement.guard";
import { EnforcementService } from "../enforcement.service";
import {
  ENFORCE_KEY,
  ENFORCE_OPTIONS_KEY,
  SKIP_ENFORCEMENT_KEY,
} from "../decorators/enforce.decorator";

describe("EnforcementGuard", () => {
  let guard: EnforcementGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let enforcementService: {
    enforce: ReturnType<typeof vi.fn>;
    enforceMultiple: ReturnType<typeof vi.fn>;
    anyExceeded: ReturnType<typeof vi.fn>;
    getExceeded: ReturnType<typeof vi.fn>;
  };

  const mockRequest = {
    apiKeyContext: { workspaceId: "ws_123" },
    params: { customerId: "cust_123" },
    body: {},
    query: {},
  };

  const createMockContext = (request = mockRequest): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as ExecutionContext;

  const mockAllowedResult = {
    allowed: true,
    featureKey: "api_calls",
    entitlement: { hasAccess: true, featureKey: "api_calls", value: 1000 },
  };

  const mockDeniedResult = {
    allowed: false,
    featureKey: "api_calls",
    entitlement: { hasAccess: true, featureKey: "api_calls", value: 1000 },
    message: "Limit exceeded for api_calls",
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    enforcementService = {
      enforce: vi.fn(),
      enforceMultiple: vi.fn(),
      anyExceeded: vi.fn(),
      getExceeded: vi.fn(),
    };

    guard = new EnforcementGuard(
      reflector as unknown as Reflector,
      enforcementService as unknown as EnforcementService,
    );
  });

  describe("canActivate", () => {
    it("should allow when enforcement is skipped", async () => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === SKIP_ENFORCEMENT_KEY) return true;
        return undefined;
      });

      const result = await guard.canActivate(createMockContext());

      expect(result).toBe(true);
      expect(enforcementService.enforce).not.toHaveBeenCalled();
    });

    it("should allow when no features specified", async () => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === ENFORCE_KEY) return [];
        return undefined;
      });

      const result = await guard.canActivate(createMockContext());

      expect(result).toBe(true);
    });

    it("should throw when workspace ID not found", async () => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === ENFORCE_KEY) return ["api_calls"];
        return undefined;
      });

      const request = { params: {}, body: {}, query: {} };

      await expect(guard.canActivate(createMockContext(request))).rejects.toThrow(
        "Workspace context required",
      );
    });

    it("should throw when customer ID not found", async () => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === ENFORCE_KEY) return ["api_calls"];
        return undefined;
      });

      const request = {
        apiKeyContext: { workspaceId: "ws_123" },
        params: {},
        body: {},
        query: {},
      };

      await expect(guard.canActivate(createMockContext(request))).rejects.toThrow(
        "Customer ID required",
      );
    });

    describe("single feature enforcement", () => {
      beforeEach(() => {
        reflector.getAllAndOverride.mockImplementation((key: string) => {
          if (key === ENFORCE_KEY) return ["api_calls"];
          if (key === ENFORCE_OPTIONS_KEY) return {};
          return undefined;
        });
      });

      it("should allow when enforcement passes", async () => {
        enforcementService.enforce.mockResolvedValue(mockAllowedResult);

        const result = await guard.canActivate(createMockContext());

        expect(result).toBe(true);
        expect(enforcementService.enforce).toHaveBeenCalledWith(
          "ws_123",
          "cust_123",
          "api_calls",
          expect.objectContaining({ throwOnExceeded: true }),
        );
      });

      it("should attach enforcement result to request", async () => {
        enforcementService.enforce.mockResolvedValue(mockAllowedResult);
        const request = { ...mockRequest };

        await guard.canActivate(createMockContext(request));

        expect(request.enforcementResult).toEqual(mockAllowedResult);
      });

      it("should pass incrementBy option", async () => {
        reflector.getAllAndOverride.mockImplementation((key: string) => {
          if (key === ENFORCE_KEY) return ["api_calls"];
          if (key === ENFORCE_OPTIONS_KEY) return { incrementBy: 10 };
          return undefined;
        });
        enforcementService.enforce.mockResolvedValue(mockAllowedResult);

        await guard.canActivate(createMockContext());

        expect(enforcementService.enforce).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.objectContaining({ incrementBy: 10 }),
        );
      });

      it("should allow with soft enforcement (block: false)", async () => {
        reflector.getAllAndOverride.mockImplementation((key: string) => {
          if (key === ENFORCE_KEY) return ["api_calls"];
          if (key === ENFORCE_OPTIONS_KEY) return { block: false };
          return undefined;
        });
        enforcementService.enforce.mockResolvedValue(mockDeniedResult);

        const result = await guard.canActivate(createMockContext());

        expect(result).toBe(true);
        expect(enforcementService.enforce).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.objectContaining({ throwOnExceeded: false }),
        );
      });
    });

    describe("multiple feature enforcement", () => {
      beforeEach(() => {
        reflector.getAllAndOverride.mockImplementation((key: string) => {
          if (key === ENFORCE_KEY) return ["api_calls", "premium_feature"];
          if (key === ENFORCE_OPTIONS_KEY) return {};
          return undefined;
        });
      });

      it("should check all features", async () => {
        enforcementService.enforceMultiple.mockResolvedValue([
          mockAllowedResult,
          mockAllowedResult,
        ]);
        enforcementService.anyExceeded.mockReturnValue(false);

        await guard.canActivate(createMockContext());

        expect(enforcementService.enforceMultiple).toHaveBeenCalledWith(
          "ws_123",
          "cust_123",
          ["api_calls", "premium_feature"],
          expect.any(Object),
        );
      });

      it("should throw when any feature is exceeded", async () => {
        enforcementService.enforceMultiple.mockResolvedValue([
          mockAllowedResult,
          mockDeniedResult,
        ]);
        enforcementService.anyExceeded.mockReturnValue(true);
        enforcementService.getExceeded.mockReturnValue([mockDeniedResult]);

        await expect(guard.canActivate(createMockContext())).rejects.toThrow(
          ForbiddenException,
        );
      });

      it("should use custom error message", async () => {
        reflector.getAllAndOverride.mockImplementation((key: string) => {
          if (key === ENFORCE_KEY) return ["api_calls", "premium_feature"];
          if (key === ENFORCE_OPTIONS_KEY)
            return { errorMessage: "Upgrade required" };
          return undefined;
        });
        enforcementService.enforceMultiple.mockResolvedValue([mockDeniedResult]);
        enforcementService.anyExceeded.mockReturnValue(true);
        enforcementService.getExceeded.mockReturnValue([mockDeniedResult]);

        await expect(guard.canActivate(createMockContext())).rejects.toThrow(
          "Upgrade required",
        );
      });
    });

    describe("customer ID extraction", () => {
      beforeEach(() => {
        reflector.getAllAndOverride.mockImplementation((key: string) => {
          if (key === ENFORCE_KEY) return ["api_calls"];
          if (key === ENFORCE_OPTIONS_KEY) return {};
          return undefined;
        });
        enforcementService.enforce.mockResolvedValue(mockAllowedResult);
      });

      it("should get customer ID from body", async () => {
        const request = {
          apiKeyContext: { workspaceId: "ws_123" },
          params: {},
          body: { customerId: "cust_from_body" },
          query: {},
        };

        await guard.canActivate(createMockContext(request));

        expect(enforcementService.enforce).toHaveBeenCalledWith(
          expect.any(String),
          "cust_from_body",
          expect.any(String),
          expect.any(Object),
        );
      });

      it("should get customer ID from query", async () => {
        const request = {
          apiKeyContext: { workspaceId: "ws_123" },
          params: {},
          body: {},
          query: { customerId: "cust_from_query" },
        };

        await guard.canActivate(createMockContext(request));

        expect(enforcementService.enforce).toHaveBeenCalledWith(
          expect.any(String),
          "cust_from_query",
          expect.any(String),
          expect.any(Object),
        );
      });

      it("should get customer ID from custom path", async () => {
        reflector.getAllAndOverride.mockImplementation((key: string) => {
          if (key === ENFORCE_KEY) return ["api_calls"];
          if (key === ENFORCE_OPTIONS_KEY)
            return { customerIdPath: "body.data.customer" };
          return undefined;
        });

        const request = {
          apiKeyContext: { workspaceId: "ws_123" },
          params: {},
          body: { data: { customer: "nested_cust" } },
          query: {},
        };

        await guard.canActivate(createMockContext(request));

        expect(enforcementService.enforce).toHaveBeenCalledWith(
          expect.any(String),
          "nested_cust",
          expect.any(String),
          expect.any(Object),
        );
      });
    });

    describe("workspace ID extraction", () => {
      beforeEach(() => {
        reflector.getAllAndOverride.mockImplementation((key: string) => {
          if (key === ENFORCE_KEY) return ["api_calls"];
          if (key === ENFORCE_OPTIONS_KEY) return {};
          return undefined;
        });
        enforcementService.enforce.mockResolvedValue(mockAllowedResult);
      });

      it("should get workspace ID from URL params", async () => {
        const request = {
          params: { workspaceId: "ws_from_params", customerId: "cust_123" },
          body: {},
          query: {},
        };

        await guard.canActivate(createMockContext(request));

        expect(enforcementService.enforce).toHaveBeenCalledWith(
          "ws_from_params",
          expect.any(String),
          expect.any(String),
          expect.any(Object),
        );
      });

      it("should get workspace ID from session context", async () => {
        const request = {
          sessionContext: {
            workspaces: [{ workspaceId: "ws_from_session" }],
          },
          params: { customerId: "cust_123" },
          body: {},
          query: {},
        };

        await guard.canActivate(createMockContext(request));

        expect(enforcementService.enforce).toHaveBeenCalledWith(
          "ws_from_session",
          expect.any(String),
          expect.any(String),
          expect.any(Object),
        );
      });
    });

    describe("increment from body", () => {
      it("should extract increment from body field", async () => {
        reflector.getAllAndOverride.mockImplementation((key: string) => {
          if (key === ENFORCE_KEY) return ["api_calls"];
          if (key === ENFORCE_OPTIONS_KEY)
            return { incrementFromBody: "quantity" };
          return undefined;
        });
        enforcementService.enforce.mockResolvedValue(mockAllowedResult);

        const request = {
          ...mockRequest,
          body: { quantity: 25 },
        };

        await guard.canActivate(createMockContext(request));

        expect(enforcementService.enforce).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.objectContaining({ incrementBy: 25 }),
        );
      });

      it("should use array length for increment", async () => {
        reflector.getAllAndOverride.mockImplementation((key: string) => {
          if (key === ENFORCE_KEY) return ["api_calls"];
          if (key === ENFORCE_OPTIONS_KEY) return { incrementFromBody: "items" };
          return undefined;
        });
        enforcementService.enforce.mockResolvedValue(mockAllowedResult);

        const request = {
          ...mockRequest,
          body: { items: [1, 2, 3, 4, 5] },
        };

        await guard.canActivate(createMockContext(request));

        expect(enforcementService.enforce).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.objectContaining({ incrementBy: 5 }),
        );
      });
    });
  });
});
