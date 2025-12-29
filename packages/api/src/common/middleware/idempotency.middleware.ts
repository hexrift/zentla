import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { LoggerService } from '../logger/logger.service';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const IDEMPOTENCY_TTL_HOURS = 24;

interface CachedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Only apply to mutating requests
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers[IDEMPOTENCY_HEADER] as string | undefined;
    if (!idempotencyKey) {
      return next();
    }

    // Validate key format (UUID or reasonable string)
    if (idempotencyKey.length > 255 || idempotencyKey.length < 1) {
      throw new HttpException(
        {
          error: {
            code: 'INVALID_IDEMPOTENCY_KEY',
            message: 'Idempotency key must be between 1 and 255 characters',
          },
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // Get workspace ID from request (set by auth guard)
    const workspaceId = (req as Request & { workspaceId?: string }).workspaceId;
    if (!workspaceId) {
      // No workspace context, skip idempotency
      return next();
    }

    const compositeKey = `${workspaceId}:${req.method}:${req.path}:${idempotencyKey}`;

    try {
      // Check for existing idempotency record
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { key: compositeKey },
      });

      if (existing) {
        // Check if request is still processing
        if (!existing.response) {
          throw new HttpException(
            {
              error: {
                code: 'REQUEST_IN_PROGRESS',
                message: 'A request with this idempotency key is already in progress',
              },
            },
            HttpStatus.CONFLICT
          );
        }

        // Return cached response
        const cached = existing.response as unknown as CachedResponse;
        this.logger.log(
          `Returning cached idempotent response: ${idempotencyKey}`,
          'IdempotencyMiddleware'
        );

        res.set(cached.headers);
        res.set('X-Idempotent-Replayed', 'true');
        res.status(cached.statusCode).json(cached.body);
        return;
      }

      // Create placeholder record
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

      await this.prisma.idempotencyKey.create({
        data: {
          key: compositeKey,
          workspaceId,
          requestPath: req.path,
          requestMethod: req.method,
          expiresAt,
        },
      });

      // Store original methods
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      // Capture response for caching
      const captureResponse = async (body: unknown): Promise<void> => {
        const cachedResponse: CachedResponse = {
          statusCode: res.statusCode,
          headers: {
            'content-type': res.get('content-type') ?? 'application/json',
          },
          body,
        };

        try {
          await this.prisma.idempotencyKey.update({
            where: { key: compositeKey },
            data: { response: JSON.parse(JSON.stringify(cachedResponse)) },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `Failed to cache idempotent response: ${errorMessage}`,
            undefined,
            'IdempotencyMiddleware'
          );
        }
      };

      // Override response methods
      res.json = function (body: unknown): Response {
        void captureResponse(body);
        return originalJson(body);
      };

      res.send = function (body: unknown): Response {
        if (typeof body === 'object') {
          void captureResponse(body);
        }
        return originalSend(body);
      };

      return next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Idempotency middleware error: ${errorMessage}`,
        undefined,
        'IdempotencyMiddleware'
      );

      // Continue without idempotency on error
      return next();
    }
  }
}
