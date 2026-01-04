import { SetMetadata, applyDecorators, UseGuards } from "@nestjs/common";
import { EnforcementGuard } from "../guards/enforcement.guard";

export const ENFORCE_KEY = "enforce:features";
export const ENFORCE_OPTIONS_KEY = "enforce:options";

export interface EnforceOptions {
  /**
   * If true, block the request when limit exceeded.
   * If false, allow the request but attach enforcement result to request.
   * Default: true
   */
  block?: boolean;

  /**
   * Amount to increment usage by for the check.
   * Default: 1
   */
  incrementBy?: number;

  /**
   * Extract increment amount from request body at this path.
   * Example: "quantity" or "items.length"
   */
  incrementFromBody?: string;

  /**
   * Custom error message when blocked.
   */
  errorMessage?: string;

  /**
   * Get customer ID from request at this path.
   * Default: "params.customerId" or "body.customerId"
   */
  customerIdPath?: string;
}

/**
 * Decorator to enforce entitlement limits on a route.
 * Use on controller methods to automatically check entitlements before execution.
 *
 * @example
 * // Single feature enforcement
 * @Enforce('api_calls')
 * @Post('process')
 * async processData() { ... }
 *
 * @example
 * // Multiple features
 * @Enforce(['api_calls', 'premium_feature'])
 * @Post('analyze')
 * async analyze() { ... }
 *
 * @example
 * // With options
 * @Enforce('api_calls', { incrementBy: 10 })
 * @Post('batch-process')
 * async batchProcess() { ... }
 *
 * @example
 * // Soft enforcement (don't block, just attach result)
 * @Enforce('api_calls', { block: false })
 * @Post('optional-feature')
 * async optionalFeature() { ... }
 */
export function Enforce(
  features: string | string[],
  options: EnforceOptions = {},
): MethodDecorator & ClassDecorator {
  const featureList = Array.isArray(features) ? features : [features];

  return applyDecorators(
    SetMetadata(ENFORCE_KEY, featureList),
    SetMetadata(ENFORCE_OPTIONS_KEY, options),
    UseGuards(EnforcementGuard),
  );
}

/**
 * Decorator to skip enforcement on a route that would otherwise be enforced.
 */
export const SKIP_ENFORCEMENT_KEY = "enforce:skip";
export const SkipEnforcement = () => SetMetadata(SKIP_ENFORCEMENT_KEY, true);
