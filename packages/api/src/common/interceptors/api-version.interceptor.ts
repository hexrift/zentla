import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { Response } from "express";
import { API_VERSION, ZENTLA_VERSION } from "../version";

const API_DEPRECATED = false;

@Injectable()
export class ApiVersionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        response.setHeader("X-API-Version", API_VERSION);
        response.setHeader("X-Zentla-Version", ZENTLA_VERSION);
        response.setHeader("X-Zentla-API-Deprecated", String(API_DEPRECATED));
      }),
    );
  }
}
