import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { EnforcementService, EnforcementResult } from "../enforcement.service";
import {
  ENFORCE_KEY,
  ENFORCE_OPTIONS_KEY,
  SKIP_ENFORCEMENT_KEY,
  EnforceOptions,
} from "../decorators/enforce.decorator";

// Extend Express Request type to include enforcement result
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      enforcementResult?: EnforcementResult | EnforcementResult[];
    }
  }
}

@Injectable()
export class EnforcementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly enforcementService: EnforcementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if enforcement should be skipped
    const skipEnforcement = this.reflector.getAllAndOverride<boolean>(
      SKIP_ENFORCEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipEnforcement) {
      return true;
    }

    // Get features to enforce
    const features = this.reflector.getAllAndOverride<string[]>(ENFORCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!features || features.length === 0) {
      return true;
    }

    // Get enforcement options
    const options =
      this.reflector.getAllAndOverride<EnforceOptions>(ENFORCE_OPTIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || {};

    const request = context.switchToHttp().getRequest<Request>();

    // Extract workspace ID
    const workspaceId = this.getWorkspaceId(request);
    if (!workspaceId) {
      throw new ForbiddenException("Workspace context required for enforcement");
    }

    // Extract customer ID
    const customerId = this.getCustomerId(request, options.customerIdPath);
    if (!customerId) {
      throw new ForbiddenException("Customer ID required for enforcement");
    }

    // Calculate increment amount
    const incrementBy = this.getIncrementAmount(request, options);

    // Enforce entitlements
    if (features.length === 1) {
      const result = await this.enforcementService.enforce(
        workspaceId,
        customerId,
        features[0],
        {
          throwOnExceeded: options.block !== false,
          incrementBy,
          errorMessage: options.errorMessage,
        },
      );

      // Attach result to request for controller access
      request.enforcementResult = result;

      return options.block === false ? true : result.allowed;
    }

    // Multiple features
    const results = await this.enforcementService.enforceMultiple(
      workspaceId,
      customerId,
      features,
      { incrementBy },
    );

    request.enforcementResult = results;

    if (options.block !== false && this.enforcementService.anyExceeded(results)) {
      const exceeded = this.enforcementService.getExceeded(results);
      const message =
        options.errorMessage ||
        `Limit exceeded for: ${exceeded.map((r) => r.featureKey).join(", ")}`;
      throw new ForbiddenException(message);
    }

    return true;
  }

  private getWorkspaceId(request: Request): string | undefined {
    // From API key context
    if (request.apiKeyContext?.workspaceId) {
      return request.apiKeyContext.workspaceId;
    }

    // From URL params
    if (request.params.workspaceId) {
      return request.params.workspaceId as string;
    }

    return undefined;
  }

  private getCustomerId(
    request: Request,
    customerIdPath?: string,
  ): string | undefined {
    // Custom path specified
    if (customerIdPath) {
      const value = this.getNestedValue(request, customerIdPath);
      return typeof value === "string" ? value : undefined;
    }

    // Default locations
    if (request.params.customerId) {
      return request.params.customerId;
    }

    if (request.body?.customerId) {
      return request.body.customerId;
    }

    // From query params
    if (request.query.customerId) {
      return request.query.customerId as string;
    }

    return undefined;
  }

  private getIncrementAmount(request: Request, options: EnforceOptions): number {
    // Fixed increment
    if (options.incrementBy !== undefined) {
      return options.incrementBy;
    }

    // From request body
    if (options.incrementFromBody) {
      const value = this.getNestedValue(request.body, options.incrementFromBody);
      if (typeof value === "number") {
        return value;
      }
      if (Array.isArray(value)) {
        return value.length;
      }
    }

    return 1;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current = obj as Record<string, unknown>;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part] as Record<string, unknown>;
    }

    return current;
  }
}
