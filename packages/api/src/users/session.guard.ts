import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { UserSessionService } from "./user-session.service";
import { PrismaService } from "../database/prisma.service";
import {
  IS_PUBLIC_KEY,
  type SessionContext,
  type ApiKeyContext,
} from "../common/decorators";

const SESSION_PREFIX = "relay_session_";

interface SessionValidationResult {
  userId: string;
  sessionId: string;
  expiresAt: Date;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessionService: UserSessionService,
    private readonly prisma: PrismaService,
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

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      // No auth header - let API key guard handle it
      return true;
    }

    const [type, token] = authHeader.split(" ");

    if (type !== "Bearer" || !token) {
      return true;
    }

    // Check if this is a session token
    if (!token.startsWith(SESSION_PREFIX)) {
      // Not a session token, let API key guard handle it
      return true;
    }

    const validationResult = (await this.sessionService.validateSession(
      token,
    )) as SessionValidationResult | null;

    if (!validationResult) {
      throw new UnauthorizedException("Invalid or expired session");
    }

    // Attach session context to request (typed via global Express.Request augmentation)
    const sessionContext: SessionContext = {
      userId: validationResult.userId,
      sessionId: validationResult.sessionId,
      expiresAt: validationResult.expiresAt,
    };
    request.sessionContext = sessionContext;

    // Get user's first workspace and set apiKeyContext for compatibility
    // This allows session-authenticated users to use regular API endpoints
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: { userId: validationResult.userId },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });

    if (membership) {
      const apiKeyContext: ApiKeyContext = {
        keyId: `session:${validationResult.sessionId}`,
        workspaceId: membership.workspaceId,
        role: membership.role as ApiKeyContext["role"],
        environment: membership.workspace.mode as ApiKeyContext["environment"],
      };
      request.apiKeyContext = apiKeyContext;
    }

    return true;
  }
}
