import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export interface ApiKeyContext {
  keyId: string;
  workspaceId: string;
  role: "owner" | "admin" | "member" | "readonly";
  environment: "live" | "test";
}

export interface SessionContext {
  userId: string;
  sessionId: string;
  expiresAt: Date;
}

export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const apiKeyContext = request.apiKeyContext as ApiKeyContext | undefined;

    if (!apiKeyContext) {
      throw new Error("API key context not found on request");
    }

    return apiKeyContext;
  },
);

export const WorkspaceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const apiKeyContext = request.apiKeyContext as ApiKeyContext | undefined;

    if (!apiKeyContext) {
      throw new Error("API key context not found on request");
    }

    return apiKeyContext.workspaceId;
  },
);

export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const sessionContext = request.sessionContext;

    if (!sessionContext) {
      throw new Error("Session context not found on request");
    }

    return sessionContext;
  },
);

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const sessionContext = request.sessionContext;

    if (!sessionContext) {
      throw new Error("Session context not found on request");
    }

    return sessionContext.userId;
  },
);

// Extend Express Request type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKeyContext?: ApiKeyContext;
      sessionContext?: SessionContext;
      rawBody?: Buffer;
    }
  }
}
