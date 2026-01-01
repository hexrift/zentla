import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ApiKeyService } from "../services/api-key.service";
import { IS_PUBLIC_KEY, IS_OPTIONAL_AUTH_KEY } from "../../common/decorators";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Check if auth is optional
    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<Request>();

    // Skip if already authenticated via session
    if (request.sessionContext) {
      return true;
    }

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      // Allow through if auth is optional
      if (isOptionalAuth) {
        return true;
      }
      throw new UnauthorizedException("Missing Authorization header");
    }

    const [type, token] = authHeader.split(" ");

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException(
        "Invalid Authorization header format. Expected: Bearer <api_key>",
      );
    }

    const validated = await this.apiKeyService.validateApiKey(token);

    if (!validated) {
      throw new UnauthorizedException("Invalid or expired API key");
    }

    // Attach API key context to request
    request.apiKeyContext = this.apiKeyService.toApiKeyContext(validated);

    return true;
  }
}
