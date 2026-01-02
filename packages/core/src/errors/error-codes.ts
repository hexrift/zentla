/**
 * Standardized error codes for the Zentla API.
 * These codes enable programmatic error handling by API consumers.
 */
export enum ErrorCode {
  // ============================================================================
  // Validation Errors (400)
  // ============================================================================
  /** Request body or query parameters failed validation */
  VALIDATION_FAILED = "VALIDATION_FAILED",
  /** Provided UUID is malformed */
  INVALID_UUID = "INVALID_UUID",
  /** Pagination cursor is invalid or expired */
  INVALID_CURSOR = "INVALID_CURSOR",

  // ============================================================================
  // Resource Errors (404, 409)
  // ============================================================================
  /** Requested resource does not exist */
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  /** Resource already exists or conflicts with existing state */
  RESOURCE_CONFLICT = "RESOURCE_CONFLICT",
  /** Resource has expired (e.g., checkout session) */
  RESOURCE_EXPIRED = "RESOURCE_EXPIRED",

  // ============================================================================
  // Business Logic Errors (400, 422)
  // ============================================================================
  /** Subscription is not in a valid state for this operation */
  SUBSCRIPTION_INVALID_STATE = "SUBSCRIPTION_INVALID_STATE",
  /** Offer has no published version available */
  OFFER_NOT_PUBLISHED = "OFFER_NOT_PUBLISHED",
  /** Draft version already exists for this offer */
  OFFER_DRAFT_EXISTS = "OFFER_DRAFT_EXISTS",
  /** Promotion code is invalid, expired, or has reached max redemptions */
  PROMOTION_INVALID = "PROMOTION_INVALID",
  /** Promotion is not yet valid (before validFrom date) */
  PROMOTION_NOT_YET_VALID = "PROMOTION_NOT_YET_VALID",
  /** Promotion has expired (after validUntil date) */
  PROMOTION_EXPIRED = "PROMOTION_EXPIRED",
  /** Billing provider is not configured for this workspace */
  PROVIDER_NOT_CONFIGURED = "PROVIDER_NOT_CONFIGURED",

  // ============================================================================
  // Authentication & Authorization Errors (401, 403)
  // ============================================================================
  /** Authentication required but not provided */
  UNAUTHORIZED = "UNAUTHORIZED",
  /** Authenticated but lacks permission for this operation */
  FORBIDDEN = "FORBIDDEN",
  /** API key is invalid or malformed */
  API_KEY_INVALID = "API_KEY_INVALID",
  /** API key has expired */
  API_KEY_EXPIRED = "API_KEY_EXPIRED",
  /** API key has been revoked */
  API_KEY_REVOKED = "API_KEY_REVOKED",
  /** API key does not have required role for this operation */
  API_KEY_INSUFFICIENT_ROLE = "API_KEY_INSUFFICIENT_ROLE",

  // ============================================================================
  // Rate Limiting & Concurrency Errors (409, 412, 429)
  // ============================================================================
  /** Rate limit exceeded, retry after delay */
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  /** Resource version mismatch (ETag/If-Match failure) */
  PRECONDITION_FAILED = "PRECONDITION_FAILED",
  /** Another request with the same idempotency key is in progress */
  REQUEST_IN_PROGRESS = "REQUEST_IN_PROGRESS",
  /** Idempotency key is invalid or too long */
  IDEMPOTENCY_KEY_INVALID = "IDEMPOTENCY_KEY_INVALID",

  // ============================================================================
  // Provider Errors (400, 502)
  // ============================================================================
  /** Error communicating with billing provider */
  PROVIDER_ERROR = "PROVIDER_ERROR",
  /** Webhook signature verification failed */
  WEBHOOK_INVALID_SIGNATURE = "WEBHOOK_INVALID_SIGNATURE",
  /** Webhook event type is not supported */
  WEBHOOK_UNSUPPORTED_EVENT = "WEBHOOK_UNSUPPORTED_EVENT",

  // ============================================================================
  // System Errors (500)
  // ============================================================================
  /** Unexpected internal error */
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Maps error codes to their default HTTP status codes.
 */
export const ErrorCodeHttpStatus: Record<ErrorCode, number> = {
  // Validation - 400
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.INVALID_UUID]: 400,
  [ErrorCode.INVALID_CURSOR]: 400,

  // Resources - 404, 409
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_CONFLICT]: 409,
  [ErrorCode.RESOURCE_EXPIRED]: 410,

  // Business logic - 400, 422
  [ErrorCode.SUBSCRIPTION_INVALID_STATE]: 422,
  [ErrorCode.OFFER_NOT_PUBLISHED]: 422,
  [ErrorCode.OFFER_DRAFT_EXISTS]: 409,
  [ErrorCode.PROMOTION_INVALID]: 400,
  [ErrorCode.PROMOTION_NOT_YET_VALID]: 422,
  [ErrorCode.PROMOTION_EXPIRED]: 422,
  [ErrorCode.PROVIDER_NOT_CONFIGURED]: 422,

  // Auth - 401, 403
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.API_KEY_INVALID]: 401,
  [ErrorCode.API_KEY_EXPIRED]: 401,
  [ErrorCode.API_KEY_REVOKED]: 401,
  [ErrorCode.API_KEY_INSUFFICIENT_ROLE]: 403,

  // Rate limiting & concurrency - 409, 412, 429
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.PRECONDITION_FAILED]: 412,
  [ErrorCode.REQUEST_IN_PROGRESS]: 409,
  [ErrorCode.IDEMPOTENCY_KEY_INVALID]: 400,

  // Provider - 400, 502
  [ErrorCode.PROVIDER_ERROR]: 502,
  [ErrorCode.WEBHOOK_INVALID_SIGNATURE]: 400,
  [ErrorCode.WEBHOOK_UNSUPPORTED_EVENT]: 400,

  // System - 500
  [ErrorCode.INTERNAL_ERROR]: 500,
};
