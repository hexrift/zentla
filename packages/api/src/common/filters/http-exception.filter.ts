import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ErrorCode } from "@zentla/core";

/**
 * Standardized API error response format.
 * All errors are wrapped in this structure for consistent client handling.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    /** Machine-readable error code for programmatic handling */
    code: ErrorCode | string;
    /** Human-readable error message */
    message: string;
    /** Additional error details (validation errors, field info, etc.) */
    details?: Record<string, unknown> | ValidationErrorDetail[];
  };
  meta: {
    /** Unique request identifier for debugging and support */
    requestId?: string;
    /** ISO timestamp of the error */
    timestamp: string;
    /** Request path that generated the error */
    path: string;
  };
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Maps HTTP status codes to default error codes.
 */
function getDefaultErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCode.VALIDATION_FAILED;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.RESOURCE_NOT_FOUND;
    case 409:
      return ErrorCode.RESOURCE_CONFLICT;
    case 412:
      return ErrorCode.PRECONDITION_FAILED;
    case 429:
      return ErrorCode.RATE_LIMIT_EXCEEDED;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let code: ErrorCode | string;
    let message: string;
    let details: Record<string, unknown> | ValidationErrorDetail[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
        code = getDefaultErrorCode(status);
      } else if (
        typeof exceptionResponse === "object" &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as Record<string, unknown>;

        // Check if this is a RelayException with a code
        if (responseObj.code && typeof responseObj.code === "string") {
          code = responseObj.code as ErrorCode;
        } else {
          code = getDefaultErrorCode(status);
        }

        // Handle validation errors (array of messages)
        if (Array.isArray(responseObj.message)) {
          message = "Validation failed";
          details = (responseObj.message as string[]).map((msg) => ({
            field: this.extractFieldFromMessage(msg),
            message: msg,
          }));
        } else {
          message = (responseObj.message as string) ?? exception.message;
        }

        // Preserve any existing details
        if (responseObj.details) {
          details = responseObj.details as Record<string, unknown>;
        }
      } else {
        message = exception.message;
        code = getDefaultErrorCode(status);
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Internal server error";
      code = ErrorCode.INTERNAL_ERROR;

      // Log the actual error for debugging
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Internal server error";
      code = ErrorCode.INTERNAL_ERROR;

      this.logger.error("Unknown exception type", String(exception));
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      meta: {
        requestId: request.headers["x-request-id"] as string | undefined,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(status).json(errorResponse);
  }

  /**
   * Attempts to extract field name from validation message.
   * e.g., "email must be an email" -> "email"
   */
  private extractFieldFromMessage(message: string): string {
    const match = message.match(/^(\w+)\s/);
    return match?.[1] ?? "unknown";
  }
}
