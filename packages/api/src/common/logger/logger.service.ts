import { Injectable, Scope, LoggerService as NestLoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';

@Injectable({ scope: Scope.DEFAULT })
export class LoggerService implements NestLoggerService {
  private readonly logger: Logger;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    this.logger = pino({
      level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      ...(isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            },
          }),
    });
  }

  log(message: string, context?: string): void {
    this.logger.info({ context }, message);
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error({ context, trace }, message);
  }

  warn(message: string, context?: string): void {
    this.logger.warn({ context }, message);
  }

  debug(message: string, context?: string): void {
    this.logger.debug({ context }, message);
  }

  verbose(message: string, context?: string): void {
    this.logger.trace({ context }, message);
  }

  // Structured logging methods for production
  info(obj: Record<string, unknown>, message?: string): void {
    this.logger.info(obj, message);
  }

  http(obj: HttpLogData): void {
    this.logger.info({ type: 'http', ...obj });
  }

  audit(obj: AuditLogData): void {
    this.logger.info({ type: 'audit', ...obj });
  }

  child(bindings: pino.Bindings): pino.Logger {
    return this.logger.child(bindings);
  }

  getPinoLogger(): Logger {
    return this.logger;
  }
}

export interface HttpLogData {
  requestId?: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  ip?: string;
  userAgent?: string;
  workspaceId?: string;
  apiKeyId?: string;
  contentLength?: string;
  error?: string;
}

export interface AuditLogData {
  workspaceId: string;
  actorType: 'api_key' | 'system';
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: {
    before?: unknown;
    after?: unknown;
  };
  ipAddress?: string;
}
