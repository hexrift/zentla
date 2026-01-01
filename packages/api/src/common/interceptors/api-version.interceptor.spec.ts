import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of, lastValueFrom } from "rxjs";
import { ApiVersionInterceptor } from "./api-version.interceptor";
import { API_VERSION, RELAY_VERSION } from "../version";

describe("ApiVersionInterceptor", () => {
  let interceptor: ApiVersionInterceptor;
  let mockResponse: {
    setHeader: ReturnType<typeof vi.fn>;
  };
  let mockContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new ApiVersionInterceptor();

    mockResponse = {
      setHeader: vi.fn(),
    };

    mockContext = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: () => of({ data: "test" }),
    };
  });

  it("should set X-API-Version header", async () => {
    await lastValueFrom(interceptor.intercept(mockContext, mockCallHandler));

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      "X-API-Version",
      API_VERSION,
    );
  });

  it("should set X-Relay-Version header with full semver", async () => {
    await lastValueFrom(interceptor.intercept(mockContext, mockCallHandler));

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      "X-Relay-Version",
      RELAY_VERSION,
    );
  });

  it("should set X-Relay-API-Deprecated header to false", async () => {
    await lastValueFrom(interceptor.intercept(mockContext, mockCallHandler));

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      "X-Relay-API-Deprecated",
      "false",
    );
  });

  it("should pass through the response data unchanged", async () => {
    const result = await lastValueFrom(
      interceptor.intercept(mockContext, mockCallHandler),
    );

    expect(result).toEqual({ data: "test" });
  });
});
