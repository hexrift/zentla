import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCode, ErrorCodeHttpStatus } from "@zentla/core";

/**
 * Base exception class for Relay API errors.
 * Includes error code for programmatic handling.
 */
export class RelayException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status?: HttpStatus,
    public readonly details?: Record<string, unknown>,
  ) {
    const httpStatus =
      status ?? ErrorCodeHttpStatus[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    super(
      {
        code,
        message,
        details,
      },
      httpStatus,
    );
  }
}

// ============================================================================
// Resource Exceptions
// ============================================================================

/**
 * Thrown when a requested resource is not found.
 */
export class ResourceNotFoundException extends RelayException {
  constructor(
    resourceType: string,
    identifier: string | Record<string, string>,
  ) {
    const id =
      typeof identifier === "string" ? identifier : JSON.stringify(identifier);
    super(
      ErrorCode.RESOURCE_NOT_FOUND,
      `${resourceType} not found`,
      HttpStatus.NOT_FOUND,
      { resourceType, identifier: id },
    );
  }
}

/**
 * Thrown when a resource already exists or conflicts with existing state.
 */
export class ResourceConflictException extends RelayException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.RESOURCE_CONFLICT, message, HttpStatus.CONFLICT, details);
  }
}

/**
 * Thrown when a resource has expired.
 */
export class ResourceExpiredException extends RelayException {
  constructor(resourceType: string, identifier: string) {
    super(
      ErrorCode.RESOURCE_EXPIRED,
      `${resourceType} has expired`,
      HttpStatus.GONE,
      { resourceType, identifier },
    );
  }
}

// ============================================================================
// Business Logic Exceptions
// ============================================================================

/**
 * Thrown when a subscription is not in a valid state for the requested operation.
 */
export class SubscriptionInvalidStateException extends RelayException {
  constructor(
    subscriptionId: string,
    currentState: string,
    requiredStates: string[],
  ) {
    super(
      ErrorCode.SUBSCRIPTION_INVALID_STATE,
      `Subscription is ${currentState}, but must be one of: ${requiredStates.join(", ")}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { subscriptionId, currentState, requiredStates },
    );
  }
}

/**
 * Thrown when an offer has no published version.
 */
export class OfferNotPublishedException extends RelayException {
  constructor(offerId: string) {
    super(
      ErrorCode.OFFER_NOT_PUBLISHED,
      "Offer has no published version available",
      HttpStatus.UNPROCESSABLE_ENTITY,
      { offerId },
    );
  }
}

/**
 * Thrown when trying to create a draft but one already exists.
 */
export class DraftExistsException extends RelayException {
  constructor(resourceType: string, resourceId: string) {
    super(
      ErrorCode.OFFER_DRAFT_EXISTS,
      `A draft version already exists for this ${resourceType}`,
      HttpStatus.CONFLICT,
      { resourceType, resourceId },
    );
  }
}

/**
 * Thrown when a promotion code is invalid.
 */
export class PromotionInvalidException extends RelayException {
  constructor(code: string, reason: string) {
    super(
      ErrorCode.PROMOTION_INVALID,
      `Promotion code "${code}" is invalid: ${reason}`,
      HttpStatus.BAD_REQUEST,
      { code, reason },
    );
  }
}

/**
 * Thrown when a promotion is not yet valid.
 */
export class PromotionNotYetValidException extends RelayException {
  constructor(code: string, validFrom: Date) {
    super(
      ErrorCode.PROMOTION_NOT_YET_VALID,
      `Promotion code "${code}" is not yet valid`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { code, validFrom: validFrom.toISOString() },
    );
  }
}

/**
 * Thrown when a promotion has expired.
 */
export class PromotionExpiredException extends RelayException {
  constructor(code: string, validUntil: Date) {
    super(
      ErrorCode.PROMOTION_EXPIRED,
      `Promotion code "${code}" has expired`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { code, validUntil: validUntil.toISOString() },
    );
  }
}

// ============================================================================
// Provider Exceptions
// ============================================================================

/**
 * Thrown when a billing provider is not configured.
 */
export class ProviderNotConfiguredException extends RelayException {
  constructor(provider: string) {
    super(
      ErrorCode.PROVIDER_NOT_CONFIGURED,
      `Billing provider "${provider}" is not configured for this workspace`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { provider },
    );
  }
}

/**
 * Thrown when a provider API call fails.
 */
export class ProviderErrorException extends RelayException {
  constructor(provider: string, operation: string, originalError?: string) {
    super(
      ErrorCode.PROVIDER_ERROR,
      `Error communicating with ${provider}: ${operation}`,
      HttpStatus.BAD_GATEWAY,
      { provider, operation, originalError },
    );
  }
}

/**
 * Thrown when webhook signature verification fails.
 */
export class WebhookInvalidSignatureException extends RelayException {
  constructor(provider: string) {
    super(
      ErrorCode.WEBHOOK_INVALID_SIGNATURE,
      `Invalid webhook signature from ${provider}`,
      HttpStatus.BAD_REQUEST,
      { provider },
    );
  }
}

// ============================================================================
// Concurrency Exceptions
// ============================================================================

/**
 * Thrown when ETag/If-Match precondition fails.
 */
export class PreconditionFailedException extends RelayException {
  constructor(resourceType: string, currentVersion: number) {
    super(
      ErrorCode.PRECONDITION_FAILED,
      "Resource has been modified. Fetch the latest version and retry.",
      HttpStatus.PRECONDITION_FAILED,
      { resourceType, currentVersion },
    );
  }
}

/**
 * Thrown when another request with the same idempotency key is in progress.
 */
export class RequestInProgressException extends RelayException {
  constructor(idempotencyKey: string) {
    super(
      ErrorCode.REQUEST_IN_PROGRESS,
      "Another request with the same idempotency key is currently being processed",
      HttpStatus.CONFLICT,
      { idempotencyKey },
    );
  }
}

// ============================================================================
// Auth Exceptions
// ============================================================================

/**
 * Thrown when API key is invalid.
 */
export class ApiKeyInvalidException extends RelayException {
  constructor() {
    super(
      ErrorCode.API_KEY_INVALID,
      "Invalid API key",
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * Thrown when API key lacks required permissions.
 */
export class InsufficientPermissionsException extends RelayException {
  constructor(requiredRole: string, currentRole: string) {
    super(
      ErrorCode.API_KEY_INSUFFICIENT_ROLE,
      `This operation requires ${requiredRole} role, but current key has ${currentRole} role`,
      HttpStatus.FORBIDDEN,
      { requiredRole, currentRole },
    );
  }
}
