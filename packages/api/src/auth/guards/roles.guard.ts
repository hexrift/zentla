import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import {
  ROLES_KEY,
  type ApiKeyRole,
  IS_PUBLIC_KEY,
} from "../../common/decorators";

const ROLE_HIERARCHY: Record<ApiKeyRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  readonly: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
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

    const requiredRoles = this.reflector.getAllAndOverride<ApiKeyRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles specified, allow access (auth already verified by ApiKeyGuard)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyContext = request.apiKeyContext;

    if (!apiKeyContext) {
      throw new ForbiddenException("API key context not found");
    }

    const userRole = apiKeyContext.role;
    const userRoleLevel = ROLE_HIERARCHY[userRole];

    // Check if user's role is in the allowed roles or has higher privilege
    const hasRole = requiredRoles.some((role) => {
      const requiredLevel = ROLE_HIERARCHY[role];
      return userRoleLevel >= requiredLevel;
    });

    if (!hasRole) {
      throw new ForbiddenException(
        `Insufficient permissions. Required role: ${requiredRoles.join(" or ")}`,
      );
    }

    return true;
  }
}
