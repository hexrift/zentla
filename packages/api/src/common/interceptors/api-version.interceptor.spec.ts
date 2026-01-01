import { describe, it, expect, vi } from "vitest";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of } from "rxjs";
import { ApiVersionInterceptor } from "./api-version.interceptor";

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

  it("should set X-API-Version header", (done) => {
    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: () => {
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          "X-API-Version",
          "1",
        );
      },
      complete: () => done(),
    });
  });

  it("should set X-Relay-API-Deprecated header to false", (done) => {
    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: () => {
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          "X-Relay-API-Deprecated",
          "false",
        );
      },
      complete: () => done(),
    });
  });

  it("should pass through the response data unchanged", (done) => {
    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual({ data: "test" });
      },
      complete: () => done(),
    });
  });
});
