import { describe, it, expect, beforeEach } from "vitest";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of, lastValueFrom } from "rxjs";
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

  it("should wrap response with success and data", async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of({ name: "test" }),
    };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, mockCallHandler),
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "test" });
    expect(result.meta?.timestamp).toBeDefined();
  });

  it("should include requestId in meta when present", async () => {
    mockRequest.headers = { "x-request-id": "req_123" };

    const mockCallHandler: CallHandler = {
      handle: () => of({ name: "test" }),
    };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, mockCallHandler),
    );

    expect(result.meta?.requestId).toBe("req_123");
  });

  it("should transform paginated response with pagination meta", async () => {
    const paginatedData = {
      data: [{ id: 1 }, { id: 2 }],
      hasMore: true,
      nextCursor: "cursor_abc",
      total: 100,
    };

    const mockCallHandler: CallHandler = {
      handle: () => of(paginatedData),
    };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, mockCallHandler),
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.meta?.pagination).toEqual({
      hasMore: true,
      nextCursor: "cursor_abc",
      total: 100,
    });
  });

  it("should handle paginated response without total", async () => {
    const paginatedData = {
      data: [{ id: 1 }],
      hasMore: false,
    };

    const mockCallHandler: CallHandler = {
      handle: () => of(paginatedData),
    };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, mockCallHandler),
    );

    expect(result.meta?.pagination).toEqual({
      hasMore: false,
      nextCursor: undefined,
      total: undefined,
    });
  });

  it("should handle null data", async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of(null),
    };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, mockCallHandler),
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
    expect(result.meta?.pagination).toBeUndefined();
  });

  it("should handle primitive data", async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of("simple string"),
    };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, mockCallHandler),
    );

    expect(result.success).toBe(true);
    expect(result.data).toBe("simple string");
  });

  it("should not treat object with only data property as paginated", async () => {
    const dataOnly = {
      data: [{ id: 1 }],
    };

    const mockCallHandler: CallHandler = {
      handle: () => of(dataOnly),
    };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, mockCallHandler),
    );

    // This should NOT be treated as paginated since hasMore is missing
    expect(result.data).toEqual({ data: [{ id: 1 }] });
    expect(result.meta?.pagination).toBeUndefined();
  });

  it("should include timestamp in ISO format", async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of({}),
    };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, mockCallHandler),
    );

    const timestamp = result.meta?.timestamp;
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });
});
