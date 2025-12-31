import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY, SKIP_WORKSPACE_KEY } from "../../common/decorators";

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Check if workspace validation should be skipped
    const skipWorkspace = this.reflector.getAllAndOverride<boolean>(
      SKIP_WORKSPACE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipWorkspace) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Skip workspace validation for session-authenticated users
    // Session users access workspaces through their memberships
    if (request.sessionContext) {
      return true;
    }

    const apiKeyContext = request.apiKeyContext;

    if (!apiKeyContext) {
      throw new ForbiddenException("API key context not found");
    }

    // Check if workspace ID is in the URL and matches the API key's workspace
    const workspaceIdParam = request.params.workspaceId as string | undefined;

    if (workspaceIdParam && workspaceIdParam !== apiKeyContext.workspaceId) {
      throw new ForbiddenException(
        "API key does not have access to this workspace",
      );
    }

    return true;
  }
}
