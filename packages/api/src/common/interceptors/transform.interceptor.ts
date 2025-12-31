import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { Request } from "express";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: ResponseMeta;
}

export interface ResponseMeta {
  requestId?: string;
  timestamp: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  hasMore: boolean;
  nextCursor?: string;
  total?: number;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = request.headers["x-request-id"] as string | undefined;

    return next.handle().pipe(
      map((data: T) => {
        // Check if the data already has pagination info
        const hasPagination =
          data !== null &&
          typeof data === "object" &&
          "data" in data &&
          "hasMore" in data;

        if (hasPagination) {
          const paginatedData = data as unknown as {
            data: unknown;
            hasMore: boolean;
            nextCursor?: string;
            total?: number;
          };

          return {
            success: true,
            data: paginatedData.data as T,
            meta: {
              requestId,
              timestamp: new Date().toISOString(),
              pagination: {
                hasMore: paginatedData.hasMore,
                nextCursor: paginatedData.nextCursor,
                total: paginatedData.total,
              },
            },
          };
        }

        return {
          success: true,
          data,
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        };
      }),
    );
  }
}
