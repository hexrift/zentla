import { describe, it, expect } from "vitest";
import { HttpStatus } from "@nestjs/common";
import {
  RelayException,
  ResourceNotFoundException,
  ResourceConflictException,
  ResourceExpiredException,
  SubscriptionInvalidStateException,
  OfferNotPublishedException,
  DraftExistsException,
  PromotionInvalidException,
  PromotionNotYetValidException,
  PromotionExpiredException,
  ProviderNotConfiguredException,
  ProviderErrorException,
  WebhookInvalidSignatureException,
  PreconditionFailedException,
  RequestInProgressException,
  ApiKeyInvalidException,
  InsufficientPermissionsException,
} from "./index";
import { ErrorCode } from "@relay/core";

describe("RelayException", () => {
  it("should create exception with code and message", () => {
    const exception = new RelayException(
      ErrorCode.RESOURCE_NOT_FOUND,
      "Not found",
    );

    expect(exception.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    expect(exception.getResponse()).toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
      message: "Not found",
    });
  });

  it("should use provided status", () => {
    const exception = new RelayException(
      ErrorCode.RESOURCE_NOT_FOUND,
      "Custom",
      HttpStatus.BAD_REQUEST,
    );

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it("should include details in response", () => {
    const exception = new RelayException(
      ErrorCode.RESOURCE_NOT_FOUND,
      "Not found",
      HttpStatus.NOT_FOUND,
      { resourceId: "123" },
    );

    expect(exception.getResponse()).toMatchObject({
      details: { resourceId: "123" },
    });
  });
});

describe("ResourceNotFoundException", () => {
  it("should create with string identifier", () => {
    const exception = new ResourceNotFoundException("Customer", "cust_123");

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.getResponse()).toMatchObject({
      message: "Customer not found",
      details: { resourceType: "Customer", identifier: "cust_123" },
    });
  });

  it("should create with object identifier", () => {
    const exception = new ResourceNotFoundException("Customer", {
      email: "test@example.com",
    });

    expect(exception.getResponse()).toMatchObject({
      details: {
        resourceType: "Customer",
        identifier: '{"email":"test@example.com"}',
      },
    });
  });
});

describe("ResourceConflictException", () => {
  it("should create conflict exception", () => {
    const exception = new ResourceConflictException("Email already exists");

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.code).toBe(ErrorCode.RESOURCE_CONFLICT);
  });
});

describe("ResourceExpiredException", () => {
  it("should create expired exception", () => {
    const exception = new ResourceExpiredException("Token", "tok_123");

    expect(exception.getStatus()).toBe(HttpStatus.GONE);
    expect(exception.getResponse()).toMatchObject({
      message: "Token has expired",
    });
  });
});

describe("SubscriptionInvalidStateException", () => {
  it("should create subscription state exception", () => {
    const exception = new SubscriptionInvalidStateException(
      "sub_123",
      "canceled",
      ["active", "trialing"],
    );

    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(exception.getResponse()).toMatchObject({
      message: "Subscription is canceled, but must be one of: active, trialing",
      details: {
        subscriptionId: "sub_123",
        currentState: "canceled",
        requiredStates: ["active", "trialing"],
      },
    });
  });
});

describe("OfferNotPublishedException", () => {
  it("should create offer not published exception", () => {
    const exception = new OfferNotPublishedException("offer_123");

    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(exception.code).toBe(ErrorCode.OFFER_NOT_PUBLISHED);
  });
});

describe("DraftExistsException", () => {
  it("should create draft exists exception", () => {
    const exception = new DraftExistsException("Offer", "offer_123");

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getResponse()).toMatchObject({
      message: "A draft version already exists for this Offer",
    });
  });
});

describe("PromotionInvalidException", () => {
  it("should create promotion invalid exception", () => {
    const exception = new PromotionInvalidException("SAVE20", "Already used");

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toMatchObject({
      message: 'Promotion code "SAVE20" is invalid: Already used',
    });
  });
});

describe("PromotionNotYetValidException", () => {
  it("should create not yet valid exception", () => {
    const validFrom = new Date("2025-06-01");
    const exception = new PromotionNotYetValidException("SUMMER25", validFrom);

    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(exception.getResponse()).toMatchObject({
      details: { code: "SUMMER25", validFrom: validFrom.toISOString() },
    });
  });
});

describe("PromotionExpiredException", () => {
  it("should create expired exception", () => {
    const validUntil = new Date("2024-12-31");
    const exception = new PromotionExpiredException("HOLIDAY24", validUntil);

    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(exception.getResponse()).toMatchObject({
      message: 'Promotion code "HOLIDAY24" has expired',
    });
  });
});

describe("ProviderNotConfiguredException", () => {
  it("should create provider not configured exception", () => {
    const exception = new ProviderNotConfiguredException("stripe");

    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(exception.code).toBe(ErrorCode.PROVIDER_NOT_CONFIGURED);
  });
});

describe("ProviderErrorException", () => {
  it("should create provider error exception", () => {
    const exception = new ProviderErrorException(
      "stripe",
      "createCustomer",
      "Connection timeout",
    );

    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(exception.getResponse()).toMatchObject({
      details: {
        provider: "stripe",
        operation: "createCustomer",
        originalError: "Connection timeout",
      },
    });
  });
});

describe("WebhookInvalidSignatureException", () => {
  it("should create invalid signature exception", () => {
    const exception = new WebhookInvalidSignatureException("stripe");

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toMatchObject({
      message: "Invalid webhook signature from stripe",
    });
  });
});

describe("PreconditionFailedException", () => {
  it("should create precondition failed exception", () => {
    const exception = new PreconditionFailedException("Customer", 5);

    expect(exception.getStatus()).toBe(HttpStatus.PRECONDITION_FAILED);
    expect(exception.getResponse()).toMatchObject({
      details: { resourceType: "Customer", currentVersion: 5 },
    });
  });
});

describe("RequestInProgressException", () => {
  it("should create request in progress exception", () => {
    const exception = new RequestInProgressException("idem_key_123");

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.code).toBe(ErrorCode.REQUEST_IN_PROGRESS);
  });
});

describe("ApiKeyInvalidException", () => {
  it("should create API key invalid exception", () => {
    const exception = new ApiKeyInvalidException();

    expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(exception.code).toBe(ErrorCode.API_KEY_INVALID);
  });
});

describe("InsufficientPermissionsException", () => {
  it("should create insufficient permissions exception", () => {
    const exception = new InsufficientPermissionsException("admin", "readonly");

    expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(exception.getResponse()).toMatchObject({
      message:
        "This operation requires admin role, but current key has readonly role",
    });
  });
});
