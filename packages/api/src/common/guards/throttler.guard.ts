import { Injectable, ExecutionContext } from "@nestjs/common";
import {
  ThrottlerGuard,
  ThrottlerOptions,
  ThrottlerGenerateKeyFunction,
  ThrottlerGetTrackerFunction,
} from "@nestjs/throttler";
import type { Response } from "express";

/**
 * Custom throttler guard that adds rate limit headers to responses.
 *
 * Headers added:
 * - X-RateLimit-Limit: Maximum requests allowed in the window
 * - X-RateLimit-Remaining: Requests remaining in the window
 * - X-RateLimit-Reset: Unix timestamp when the window resets
 * - Retry-After: Seconds until the client can retry (only when rate limited)
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected async handleRequest(
    context: ExecutionContext,
    limit: number,
    ttl: number,
    throttler: ThrottlerOptions,
    _getTracker: ThrottlerGetTrackerFunction,
    generateKey: ThrottlerGenerateKeyFunction,
  ): Promise<boolean> {
    const key = generateKey(
      context,
      throttler.name ?? "default",
      throttler.name ?? "default",
    );
    const { totalHits, timeToExpire } = await this.storageService.increment(
      key,
      ttl,
    );

    const response = context.switchToHttp().getResponse<Response>();

    // Calculate reset time (current time + time to expire in seconds)
    const resetTime = Math.floor(Date.now() / 1000 + timeToExpire / 1000);
    const remaining = Math.max(0, limit - totalHits);

    // Add rate limit headers to response
    response.setHeader("X-RateLimit-Limit", limit);
    response.setHeader("X-RateLimit-Remaining", remaining);
    response.setHeader("X-RateLimit-Reset", resetTime);

    // If over limit, also add Retry-After header
    if (totalHits > limit) {
      response.setHeader("Retry-After", Math.ceil(timeToExpire / 1000));
      return false;
    }

    return true;
  }
}
