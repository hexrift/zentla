import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of } from "rxjs";
import { TransformInterceptor } from "./transform.interceptor";

describe("TransformInterceptor", () => {
  let interceptor: TransformInterceptor<unknown>;
  let mockRequest: {
    headers: Record<string, string>;
  };
  let mockContext: ExecutionContext;

  beforeEach(() => {
    interceptor = new TransformInterceptor();

    mockRequest = {
      headers: {},
    };

    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;
  });

  it("should wrap response with success and data", (done) => {
    const mockCallHandler: CallHandler = {
      handle: () => of({ name: "test" }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ name: "test" });
        expect(result.meta?.timestamp).toBeDefined();
      },
      complete: () => done(),
    });
  });

  it("should include requestId in meta when present", (done) => {
    mockRequest.headers = { "x-request-id": "req_123" };

    const mockCallHandler: CallHandler = {
      handle: () => of({ name: "test" }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result.meta?.requestId).toBe("req_123");
      },
      complete: () => done(),
    });
  });

  it("should transform paginated response with pagination meta", (done) => {
    const paginatedData = {
      data: [{ id: 1 }, { id: 2 }],
      hasMore: true,
      nextCursor: "cursor_abc",
      total: 100,
    };

    const mockCallHandler: CallHandler = {
      handle: () => of(paginatedData),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result.success).toBe(true);
        expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
        expect(result.meta?.pagination).toEqual({
          hasMore: true,
          nextCursor: "cursor_abc",
          total: 100,
        });
      },
      complete: () => done(),
    });
  });

  it("should handle paginated response without total", (done) => {
    const paginatedData = {
      data: [{ id: 1 }],
      hasMore: false,
    };

    const mockCallHandler: CallHandler = {
      handle: () => of(paginatedData),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result.meta?.pagination).toEqual({
          hasMore: false,
          nextCursor: undefined,
          total: undefined,
        });
      },
      complete: () => done(),
    });
  });

  it("should handle null data", (done) => {
    const mockCallHandler: CallHandler = {
      handle: () => of(null),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result.success).toBe(true);
        expect(result.data).toBeNull();
        expect(result.meta?.pagination).toBeUndefined();
      },
      complete: () => done(),
    });
  });

  it("should handle primitive data", (done) => {
    const mockCallHandler: CallHandler = {
      handle: () => of("simple string"),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result.success).toBe(true);
        expect(result.data).toBe("simple string");
      },
      complete: () => done(),
    });
  });

  it("should not treat object with only data property as paginated", (done) => {
    const dataOnly = {
      data: [{ id: 1 }],
    };

    const mockCallHandler: CallHandler = {
      handle: () => of(dataOnly),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        // This should NOT be treated as paginated since hasMore is missing
        expect(result.data).toEqual({ data: [{ id: 1 }] });
        expect(result.meta?.pagination).toBeUndefined();
      },
      complete: () => done(),
    });
  });

  it("should include timestamp in ISO format", (done) => {
    const mockCallHandler: CallHandler = {
      handle: () => of({}),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        const timestamp = result.meta?.timestamp;
        expect(timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
        );
      },
      complete: () => done(),
    });
  });
});
