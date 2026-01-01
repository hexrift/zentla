import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of, throwError, lastValueFrom } from "rxjs";
import { LoggingInterceptor } from "./logging.interceptor";
import { LoggerService } from "../logger/logger.service";

describe("LoggingInterceptor", () => {
  let interceptor: LoggingInterceptor;
  let mockLogger: {
    http: ReturnType<typeof vi.fn>;
  };
  let mockRequest: {
    method: string;
    url: string;
    ip: string;
    headers: Record<string, string>;
    get: ReturnType<typeof vi.fn>;
    workspaceId?: string;
    apiKeyId?: string;
  };
  let mockResponse: {
    statusCode: number;
    get: ReturnType<typeof vi.fn>;
  };
  let mockContext: ExecutionContext;

  beforeEach(() => {
    mockLogger = {
      http: vi.fn(),
    };

    mockRequest = {
      method: "GET",
      url: "/api/v1/test",
      ip: "127.0.0.1",
      headers: {},
      get: vi.fn().mockReturnValue("test-agent"),
    };

    mockResponse = {
      statusCode: 200,
      get: vi.fn().mockReturnValue("100"),
    };

    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    interceptor = new LoggingInterceptor(
      mockLogger as unknown as LoggerService,
    );
  });

  it("should log successful request", async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of({ data: "test" }),
    };

    await lastValueFrom(interceptor.intercept(mockContext, mockCallHandler));

    expect(mockLogger.http).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/api/v1/test",
        statusCode: 200,
        ip: "127.0.0.1",
      }),
    );
  });

  it("should log request with workspace and apiKey context", async () => {
    mockRequest.workspaceId = "ws_123";
    mockRequest.apiKeyId = "key_123";

    const mockCallHandler: CallHandler = {
      handle: () => of({ data: "test" }),
    };

    await lastValueFrom(interceptor.intercept(mockContext, mockCallHandler));

    expect(mockLogger.http).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws_123",
        apiKeyId: "key_123",
      }),
    );
  });

  it("should log request with x-request-id header", async () => {
    mockRequest.headers = { "x-request-id": "req_abc123" };

    const mockCallHandler: CallHandler = {
      handle: () => of({ data: "test" }),
    };

    await lastValueFrom(interceptor.intercept(mockContext, mockCallHandler));

    expect(mockLogger.http).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req_abc123",
      }),
    );
  });

  it("should log error with message", async () => {
    const mockCallHandler: CallHandler = {
      handle: () => throwError(() => new Error("Test error")),
    };

    try {
      await lastValueFrom(interceptor.intercept(mockContext, mockCallHandler));
    } catch {
      // Expected
    }

    expect(mockLogger.http).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Test error",
      }),
    );
  });

  it("should handle non-Error objects in error path", async () => {
    const mockCallHandler: CallHandler = {
      handle: () => throwError(() => "String error"),
    };

    try {
      await lastValueFrom(interceptor.intercept(mockContext, mockCallHandler));
    } catch {
      // Expected
    }

    expect(mockLogger.http).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Unknown error",
      }),
    );
  });

  it("should handle missing user-agent", async () => {
    mockRequest.get.mockReturnValue(undefined);

    const mockCallHandler: CallHandler = {
      handle: () => of({ data: "test" }),
    };

    await lastValueFrom(interceptor.intercept(mockContext, mockCallHandler));

    expect(mockLogger.http).toHaveBeenCalledWith(
      expect.objectContaining({
        userAgent: "unknown",
      }),
    );
  });

  it("should handle missing content-length", async () => {
    mockResponse.get.mockReturnValue(undefined);

    const mockCallHandler: CallHandler = {
      handle: () => of({ data: "test" }),
    };

    await lastValueFrom(interceptor.intercept(mockContext, mockCallHandler));

    expect(mockLogger.http).toHaveBeenCalledWith(
      expect.objectContaining({
        contentLength: "0",
      }),
    );
  });

  it("should log duration", async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of({ data: "test" }),
    };

    await lastValueFrom(interceptor.intercept(mockContext, mockCallHandler));

    expect(mockLogger.http).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: expect.any(Number),
      }),
    );
  });
});
