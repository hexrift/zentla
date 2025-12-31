import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { Request, Response } from "express";
import { PreconditionFailedException } from "../exceptions";

/**
 * Interface for resources that support ETag-based concurrency control.
 */
export interface VersionedResource {
  id: string;
  version: number;
}

/**
 * Generates an ETag value from a resource ID and version.
 * Format: "resource-id-version" (weak ETag)
 */
export function generateETag(id: string, version: number): string {
  return `W/"${id}-${version}"`;
}

/**
 * Parses an ETag value to extract the version number.
 * Returns null if the ETag format is invalid.
 */
export function parseETagVersion(etag: string | undefined): number | null {
  if (!etag) return null;

  // Handle weak ETag format: W/"id-version"
  const match = etag.match(/^(?:W\/)?"[^"]*-(\d+)"$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * ETag Interceptor for optimistic concurrency control.
 *
 * On GET responses:
 * - Sets ETag header based on resource id and version
 *
 * On PUT/PATCH requests:
 * - Validates If-Match header against current resource version
 * - Returns 412 Precondition Failed if version mismatch
 *
 * Usage:
 * - Apply to individual controllers/routes that need concurrency protection
 * - Resources must have `id` and `version` properties
 *
 * @example
 * ```typescript
 * @UseInterceptors(ETagInterceptor)
 * @Get(':id')
 * async findOne(@Param('id') id: string) {
 *   return this.service.findOne(id);
 * }
 * ```
 */
@Injectable()
export class ETagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        // Handle response data
        if (data && typeof data === "object") {
          const resource = data as Partial<VersionedResource>;

          // For single resources with id and version
          if (resource.id && typeof resource.version === "number") {
            const etag = generateETag(resource.id, resource.version);
            response.setHeader("ETag", etag);
          }

          // For responses wrapped in { data: resource } format
          if ("data" in resource) {
            const innerData = (resource as { data: unknown }).data;
            if (innerData && typeof innerData === "object") {
              const innerResource = innerData as Partial<VersionedResource>;
              if (
                innerResource.id &&
                typeof innerResource.version === "number"
              ) {
                const etag = generateETag(
                  innerResource.id,
                  innerResource.version,
                );
                response.setHeader("ETag", etag);
              }
            }
          }
        }

        return data;
      }),
    );
  }
}

/**
 * Guard decorator to validate If-Match header for PUT/PATCH operations.
 * Use this in combination with ETagInterceptor.
 *
 * @param currentVersion - Function that returns the current version of the resource
 *
 * @example
 * ```typescript
 * @Patch(':id')
 * async update(
 *   @Param('id') id: string,
 *   @Headers('if-match') ifMatch: string,
 *   @Body() dto: UpdateDto
 * ) {
 *   const current = await this.service.findOne(id);
 *   validateIfMatch(ifMatch, current.version, 'Customer');
 *   return this.service.update(id, dto);
 * }
 * ```
 */
export function validateIfMatch(
  ifMatch: string | undefined,
  currentVersion: number,
  resourceType: string,
): void {
  if (!ifMatch) {
    // If-Match is optional; if not provided, proceed without check
    return;
  }

  const requestedVersion = parseETagVersion(ifMatch);

  if (requestedVersion === null) {
    throw new PreconditionFailedException(resourceType, currentVersion);
  }

  if (requestedVersion !== currentVersion) {
    throw new PreconditionFailedException(resourceType, currentVersion);
  }
}

/**
 * Decorator to require If-Match header for mutation operations.
 * Returns 428 Precondition Required if header is missing.
 */
@Injectable()
export class RequireIfMatchInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    // Only check for mutation methods
    if (["PUT", "PATCH", "DELETE"].includes(method)) {
      const ifMatch = request.headers["if-match"];
      if (!ifMatch) {
        const response = context.switchToHttp().getResponse<Response>();
        response.status(HttpStatus.PRECONDITION_REQUIRED).json({
          success: false,
          error: {
            code: "PRECONDITION_REQUIRED",
            message: "If-Match header is required for this operation",
          },
          meta: {
            timestamp: new Date().toISOString(),
            path: request.url,
          },
        });
        // Return empty observable to prevent further processing
        return new Observable((subscriber) => {
          subscriber.complete();
        });
      }
    }

    return next.handle();
  }
}
