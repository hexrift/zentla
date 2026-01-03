import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { HttpException, HttpStatus } from "@nestjs/common";
import { IdempotencyMiddleware } from "./idempotency.middleware";
import { PrismaService } from "../../database/prisma.service";
import { LoggerService } from "../logger/logger.service";
import { Prisma } from "@prisma/client";
import type { Request, Response, NextFunction } from "express";

describe("IdempotencyMiddleware", () => {
  let middleware: IdempotencyMiddleware;

  // Create stable mock objects that persist across tests
  const mockPrisma = {
    idempotencyKey: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  const mockLogger = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };

  const mockRequest = (overrides: Partial<Request> = {}): Request =>
    ({
      method: "POST",
      path: "/api/v1/checkout/sessions",
      headers: {},
      workspaceId: "workspace-123",
      ...overrides,
    }) as unknown as Request;

  const mockResponse = (): Response => {
    const res: Partial<Response> = {
      statusCode: 200,
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnValue("application/json"),
      status: vi.fn().mockReturnThis(),
    };
    return res as Response;
  };

  const mockNext: NextFunction = vi.fn();

  beforeEach(async () => {
    // Reset all mocks but keep the same objects
    vi.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyMiddleware,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    middleware = module.get<IdempotencyMiddleware>(IdempotencyMiddleware);
  });

  describe("request filtering", () => {
    it("should skip GET requests", async () => {
      const req = mockRequest({ method: "GET" });
      const res = mockResponse();

      await middleware.use(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockPrisma.idempotencyKey.create).not.toHaveBeenCalled();
    });

    it("should skip requests without idempotency key header", async () => {
      const req = mockRequest();
      const res = mockResponse();

      await middleware.use(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockPrisma.idempotencyKey.create).not.toHaveBeenCalled();
    });

    it("should skip requests without workspace context", async () => {
      const req = mockRequest({
        headers: { "idempotency-key": "test-key" },
      });
      delete (req as Request & { workspaceId?: string }).workspaceId;
      const res = mockResponse();

      await middleware.use(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockPrisma.idempotencyKey.create).not.toHaveBeenCalled();
    });
  });

  describe("key validation", () => {
    it("should reject idempotency key longer than 255 characters", async () => {
      const req = mockRequest({
        headers: { "idempotency-key": "a".repeat(256) },
      });
      const res = mockResponse();

      await expect(middleware.use(req, res, mockNext)).rejects.toThrow(
        HttpException,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("first request handling", () => {
    it("should create idempotency record and proceed for first request", async () => {
      const req = mockRequest({
        headers: { "idempotency-key": "unique-key-123" },
      });
      const res = mockResponse();

      mockPrisma.idempotencyKey.create.mockResolvedValue({
        id: "record-1",
        key: "workspace-123:POST:/api/v1/checkout/sessions:unique-key-123",
        workspaceId: "workspace-123",
        requestPath: "/api/v1/checkout/sessions",
        requestMethod: "POST",
        response: null,
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      await middleware.use(req, res, mockNext);

      expect(mockPrisma.idempotencyKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          key: "workspace-123:POST:/api/v1/checkout/sessions:unique-key-123",
          workspaceId: "workspace-123",
          requestPath: "/api/v1/checkout/sessions",
          requestMethod: "POST",
        }),
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("race condition handling (create-first pattern)", () => {
    it("should return cached response when duplicate key with completed response", async () => {
      const req = mockRequest({
        headers: { "idempotency-key": "duplicate-key" },
      });
      const res = mockResponse();

      // Simulate P2002 unique constraint violation
      const uniqueError = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "5.0.0" },
      );
      mockPrisma.idempotencyKey.create.mockRejectedValue(uniqueError);

      // Return existing record with cached response
      mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
        id: "record-1",
        key: "workspace-123:POST:/api/v1/checkout/sessions:duplicate-key",
        workspaceId: "workspace-123",
        requestPath: "/api/v1/checkout/sessions",
        requestMethod: "POST",
        response: {
          statusCode: 201,
          headers: { "content-type": "application/json" },
          body: { id: "session-123", url: "https://checkout.stripe.com/..." },
        },
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      await middleware.use(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith("X-Idempotent-Replayed", "true");
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        id: "session-123",
        url: "https://checkout.stripe.com/...",
      });
    });

    it("should return 409 when duplicate key with request still in progress", async () => {
      const req = mockRequest({
        headers: { "idempotency-key": "in-progress-key" },
      });
      const res = mockResponse();

      // Simulate P2002 unique constraint violation
      const uniqueError = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "5.0.0" },
      );
      mockPrisma.idempotencyKey.create.mockRejectedValue(uniqueError);

      // Return existing record without response (still processing)
      mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
        id: "record-1",
        key: "workspace-123:POST:/api/v1/checkout/sessions:in-progress-key",
        workspaceId: "workspace-123",
        requestPath: "/api/v1/checkout/sessions",
        requestMethod: "POST",
        response: null, // No response yet = still processing
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      try {
        await middleware.use(req, res, mockNext);
        expect.fail("Expected HttpException to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
        const response = (error as HttpException).getResponse() as {
          error: { code: string };
        };
        expect(response.error.code).toBe("REQUEST_IN_PROGRESS");
      }

      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 409 when record deleted between create and lookup", async () => {
      const req = mockRequest({
        headers: { "idempotency-key": "deleted-key" },
      });
      const res = mockResponse();

      // Simulate P2002 unique constraint violation
      const uniqueError = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "5.0.0" },
      );
      mockPrisma.idempotencyKey.create.mockRejectedValue(uniqueError);

      // Record was deleted between create attempt and lookup
      mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);

      try {
        await middleware.use(req, res, mockNext);
        expect.fail("Expected HttpException to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
        const response = (error as HttpException).getResponse() as {
          error: { code: string };
        };
        expect(response.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
      }
    });
  });

  describe("error handling", () => {
    it("should continue without idempotency on non-P2002 database errors", async () => {
      const req = mockRequest({
        headers: { "idempotency-key": "error-key" },
      });
      const res = mockResponse();

      // Simulate a different database error
      mockPrisma.idempotencyKey.create.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await middleware.use(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("response capture", () => {
    it("should capture and cache response for successful requests", async () => {
      const req = mockRequest({
        headers: { "idempotency-key": "capture-key" },
      });
      const res = mockResponse();

      mockPrisma.idempotencyKey.create.mockResolvedValue({
        id: "record-1",
        key: "workspace-123:POST:/api/v1/checkout/sessions:capture-key",
        workspaceId: "workspace-123",
        requestPath: "/api/v1/checkout/sessions",
        requestMethod: "POST",
        response: null,
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      mockPrisma.idempotencyKey.update.mockResolvedValue({});

      await middleware.use(req, res, mockNext);

      // Simulate controller calling res.json()
      res.statusCode = 201;
      res.json({ id: "session-456" });

      // Allow async update to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockPrisma.idempotencyKey.update).toHaveBeenCalledWith({
        where: {
          key: "workspace-123:POST:/api/v1/checkout/sessions:capture-key",
        },
        data: {
          response: expect.objectContaining({
            statusCode: 201,
            body: { id: "session-456" },
          }),
        },
      });
    });
  });
});
