import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { PrismaService } from "../../database/prisma.service";
import { LoggerService } from "../logger/logger.service";
import { Prisma } from "@prisma/client";

// Standard header name (case-insensitive in HTTP)
// Express lowercases all headers, so we check for 'idempotency-key'
const IDEMPOTENCY_HEADER = "idempotency-key";
const IDEMPOTENCY_TTL_HOURS = 24;

// Prisma unique constraint violation error code
const PRISMA_UNIQUE_CONSTRAINT_ERROR = "P2002";

interface CachedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Only apply to mutating requests
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers[IDEMPOTENCY_HEADER] as
      | string
      | undefined;
    if (!idempotencyKey) {
      return next();
    }

    // Validate key format (UUID or reasonable string)
    if (idempotencyKey.length > 255 || idempotencyKey.length < 1) {
      throw new HttpException(
        {
          error: {
            code: "INVALID_IDEMPOTENCY_KEY",
            message: "Idempotency key must be between 1 and 255 characters",
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Get workspace ID from request (set by auth guard)
    const workspaceId = (req as Request & { workspaceId?: string }).workspaceId;
    if (!workspaceId) {
      // No workspace context, skip idempotency
      return next();
    }

    const compositeKey = `${workspaceId}:${req.method}:${req.path}:${idempotencyKey}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

    try {
      // RACE-CONDITION FIX: Use "create-first" pattern
      // Try to create the record first. The database unique constraint
      // guarantees atomicity - only one request can succeed.
      await this.prisma.idempotencyKey.create({
        data: {
          key: compositeKey,
          workspaceId,
          requestPath: req.path,
          requestMethod: req.method,
          expiresAt,
        },
      });

      // Creation succeeded - this is the first request with this key
      // Set up response capture and proceed
      this.setupResponseCapture(res, compositeKey);
      return next();
    } catch (error) {
      // Check if this is a unique constraint violation
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_ERROR
      ) {
        // Another request already claimed this key - handle it
        return this.handleExistingKey(res, compositeKey, idempotencyKey);
      }

      // For other errors, log and continue without idempotency
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Idempotency middleware error during create: ${errorMessage}`,
        undefined,
        "IdempotencyMiddleware",
      );
      return next();
    }
  }

  /**
   * Handle the case where an idempotency key already exists.
   * Either return the cached response or indicate request is in progress.
   */
  private async handleExistingKey(
    res: Response,
    compositeKey: string,
    idempotencyKey: string,
  ): Promise<void> {
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key: compositeKey },
    });

    if (!existing) {
      // Record was deleted between our create attempt and this lookup
      // This is extremely rare - just throw a retry error
      throw new HttpException(
        {
          error: {
            code: "IDEMPOTENCY_KEY_CONFLICT",
            message: "Idempotency key conflict. Please retry the request.",
          },
        },
        HttpStatus.CONFLICT,
      );
    }

    // Check if the original request is still processing
    if (!existing.response) {
      throw new HttpException(
        {
          error: {
            code: "REQUEST_IN_PROGRESS",
            message:
              "A request with this idempotency key is already in progress",
          },
        },
        HttpStatus.CONFLICT,
      );
    }

    // Return the cached response
    const cached = existing.response as unknown as CachedResponse;
    this.logger.log(
      `Returning cached idempotent response: ${idempotencyKey}`,
      "IdempotencyMiddleware",
    );

    res.set(cached.headers);
    res.set("X-Idempotent-Replayed", "true");
    res.status(cached.statusCode).json(cached.body);
  }

  /**
   * Set up response interception to capture and cache the response.
   */
  private setupResponseCapture(res: Response, compositeKey: string): void {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const prisma = this.prisma;
    const logger = this.logger;

    // Capture response for caching
    const captureResponse = async (body: unknown): Promise<void> => {
      const cachedResponse: CachedResponse = {
        statusCode: res.statusCode,
        headers: {
          "content-type": res.get("content-type") ?? "application/json",
        },
        body,
      };

      try {
        await prisma.idempotencyKey.update({
          where: { key: compositeKey },
          data: { response: JSON.parse(JSON.stringify(cachedResponse)) },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error(
          `Failed to cache idempotent response: ${errorMessage}`,
          undefined,
          "IdempotencyMiddleware",
        );
      }
    };

    // Override response methods
    res.json = function (body: unknown): Response {
      void captureResponse(body);
      return originalJson(body);
    };

    res.send = function (body: unknown): Response {
      if (typeof body === "object") {
        void captureResponse(body);
      }
      return originalSend(body);
    };
  }
}
