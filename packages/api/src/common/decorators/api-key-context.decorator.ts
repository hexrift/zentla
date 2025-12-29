import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface ApiKeyContext {
  keyId: string;
  workspaceId: string;
  role: 'owner' | 'admin' | 'member' | 'readonly';
  environment: 'live' | 'test';
}

export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const apiKeyContext = request.apiKeyContext as ApiKeyContext | undefined;

    if (!apiKeyContext) {
      throw new Error('API key context not found on request');
    }

    return apiKeyContext;
  }
);

export const WorkspaceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const apiKeyContext = request.apiKeyContext as ApiKeyContext | undefined;

    if (!apiKeyContext) {
      throw new Error('API key context not found on request');
    }

    return apiKeyContext.workspaceId;
  }
);

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      apiKeyContext?: ApiKeyContext;
      rawBody?: Buffer;
    }
  }
}
