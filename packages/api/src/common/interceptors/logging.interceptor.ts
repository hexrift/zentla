import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { Request, Response } from "express";
import { LoggerService } from "../logger/logger.service";

interface RequestWithContext extends Request {
  workspaceId?: string;
  apiKeyId?: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject(LoggerService) private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const { method, url, ip } = request;
    const userAgent = request.get("user-agent") ?? "unknown";
    const requestId = request.headers["x-request-id"] as string | undefined;
    const workspaceId = request.workspaceId;
    const apiKeyId = request.apiKeyId;

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          const statusCode = response.statusCode;
          const contentLength = response.get("content-length") ?? "0";
          const duration = Date.now() - now;

          this.logger.http({
            requestId,
            method,
            url,
            statusCode,
            contentLength,
            duration,
            ip,
            userAgent,
            workspaceId,
            apiKeyId,
          });
        },
        error: (error: unknown) => {
          const response = context.switchToHttp().getResponse<Response>();
          const statusCode = response.statusCode || 500;
          const duration = Date.now() - now;
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          this.logger.http({
            requestId,
            method,
            url,
            statusCode,
            duration,
            ip,
            userAgent,
            workspaceId,
            apiKeyId,
            error: errorMessage,
          });
        },
      }),
    );
  }
}
