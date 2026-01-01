import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of } from "rxjs";
import {
  ETagInterceptor,
  RequireIfMatchInterceptor,
  generateETag,
  parseETagVersion,
  validateIfMatch,
} from "./etag.interceptor";
import { PreconditionFailedException } from "../exceptions";

describe("ETag utilities", () => {
  describe("generateETag", () => {
    it("should generate weak ETag", () => {
      const etag = generateETag("resource_123", 1);
      expect(etag).toBe('W/"resource_123-1"');
    });

    it("should handle different versions", () => {
      expect(generateETag("id", 1)).toBe('W/"id-1"');
      expect(generateETag("id", 5)).toBe('W/"id-5"');
      expect(generateETag("id", 100)).toBe('W/"id-100"');
    });
  });

  describe("parseETagVersion", () => {
    it("should parse weak ETag format", () => {
      expect(parseETagVersion('W/"resource-1"')).toBe(1);
      expect(parseETagVersion('W/"id-42"')).toBe(42);
    });

    it("should parse strong ETag format", () => {
      expect(parseETagVersion('"resource-5"')).toBe(5);
    });

    it("should return null for undefined", () => {
      expect(parseETagVersion(undefined)).toBeNull();
    });

    it("should return null for invalid format", () => {
      expect(parseETagVersion("invalid")).toBeNull();
      expect(parseETagVersion("")).toBeNull();
      expect(parseETagVersion('W/"no-version-number"')).toBeNull();
    });
  });

  describe("validateIfMatch", () => {
    it("should pass when versions match", () => {
      expect(() => validateIfMatch('W/"id-5"', 5, "Customer")).not.toThrow();
    });

    it("should pass when If-Match is not provided", () => {
      expect(() => validateIfMatch(undefined, 5, "Customer")).not.toThrow();
    });

    it("should throw when versions do not match", () => {
      expect(() => validateIfMatch('W/"id-3"', 5, "Customer")).toThrow(
        PreconditionFailedException,
      );
    });

    it("should throw when ETag format is invalid", () => {
      expect(() => validateIfMatch("invalid", 5, "Customer")).toThrow(
        PreconditionFailedException,
      );
    });
  });
});

describe("ETagInterceptor", () => {
  let interceptor: ETagInterceptor;
  let mockContext: ExecutionContext;
  let mockResponse: { setHeader: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    interceptor = new ETagInterceptor();
    mockResponse = {
      setHeader: vi.fn(),
    };
    mockContext = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  });

  it("should set ETag header for resource with id and version", async () => {
    const mockHandler: CallHandler = {
      handle: () => of({ id: "resource_123", version: 1, name: "Test" }),
    };

    const result = await new Promise((resolve) => {
      interceptor.intercept(mockContext, mockHandler).subscribe({
        next: resolve,
      });
    });

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      "ETag",
      'W/"resource_123-1"',
    );
    expect(result).toEqual({ id: "resource_123", version: 1, name: "Test" });
  });

  it("should not set ETag for resource without version", async () => {
    const mockHandler: CallHandler = {
      handle: () => of({ id: "resource_123", name: "Test" }),
    };

    await new Promise((resolve) => {
      interceptor.intercept(mockContext, mockHandler).subscribe({
        next: resolve,
      });
    });

    expect(mockResponse.setHeader).not.toHaveBeenCalled();
  });

  it("should handle null response", async () => {
    const mockHandler: CallHandler = {
      handle: () => of(null),
    };

    const result = await new Promise((resolve) => {
      interceptor.intercept(mockContext, mockHandler).subscribe({
        next: resolve,
      });
    });

    expect(result).toBeNull();
    expect(mockResponse.setHeader).not.toHaveBeenCalled();
  });

  it("should set ETag for wrapped data format", async () => {
    const mockHandler: CallHandler = {
      handle: () =>
        of({
          data: { id: "resource_123", version: 2 },
          meta: {},
        }),
    };

    await new Promise((resolve) => {
      interceptor.intercept(mockContext, mockHandler).subscribe({
        next: resolve,
      });
    });

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      "ETag",
      'W/"resource_123-2"',
    );
  });
});

describe("RequireIfMatchInterceptor", () => {
  let interceptor: RequireIfMatchInterceptor;
  let mockResponse: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    interceptor = new RequireIfMatchInterceptor();
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it("should allow GET requests without If-Match", async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "GET",
          headers: {},
        }),
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockHandler: CallHandler = {
      handle: () => of({ id: "resource_123" }),
    };

    const result = await new Promise((resolve) => {
      interceptor.intercept(mockContext, mockHandler).subscribe({
        next: resolve,
      });
    });

    expect(result).toEqual({ id: "resource_123" });
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it("should allow PATCH with If-Match header", async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "PATCH",
          headers: { "if-match": 'W/"id-1"' },
        }),
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockHandler: CallHandler = {
      handle: () => of({ id: "resource_123", version: 2 }),
    };

    const result = await new Promise((resolve) => {
      interceptor.intercept(mockContext, mockHandler).subscribe({
        next: resolve,
      });
    });

    expect(result).toEqual({ id: "resource_123", version: 2 });
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it("should reject PATCH without If-Match header", async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "PATCH",
          headers: {},
          url: "/api/v1/customers/123",
        }),
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockHandler: CallHandler = {
      handle: () => of({ id: "resource_123" }),
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(mockContext, mockHandler).subscribe({
        complete: resolve,
      });
    });

    expect(mockResponse.status).toHaveBeenCalledWith(428);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "PRECONDITION_REQUIRED",
        }),
      }),
    );
  });

  it("should reject PUT without If-Match header", async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "PUT",
          headers: {},
          url: "/api/v1/customers/123",
        }),
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockHandler: CallHandler = {
      handle: () => of(null),
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(mockContext, mockHandler).subscribe({
        complete: resolve,
      });
    });

    expect(mockResponse.status).toHaveBeenCalledWith(428);
  });

  it("should reject DELETE without If-Match header", async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "DELETE",
          headers: {},
          url: "/api/v1/customers/123",
        }),
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockHandler: CallHandler = {
      handle: () => of(null),
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(mockContext, mockHandler).subscribe({
        complete: resolve,
      });
    });

    expect(mockResponse.status).toHaveBeenCalledWith(428);
  });
});
