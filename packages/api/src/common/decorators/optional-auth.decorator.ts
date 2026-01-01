import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";

export const IS_OPTIONAL_AUTH_KEY = "isOptionalAuth";

export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);

export const SessionUser = createParamDecorator(
  (
    _data: unknown,
    ctx: ExecutionContext,
  ): { id: string; email: string } | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const sessionContext = request.sessionContext;

    if (!sessionContext) {
      return null;
    }

    return {
      id: sessionContext.userId,
      email: (request as any).sessionUser?.email ?? "",
    };
  },
);
