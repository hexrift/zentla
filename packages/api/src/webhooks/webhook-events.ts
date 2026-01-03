/**
 * Webhook Event Type Definitions
 *
 * This file documents all webhook events that Zentla sends to your endpoints.
 * Use these types for strong typing in your webhook handlers.
 */

// ============================================================================
// Event Types
// ============================================================================

/**
 * All webhook event types sent by Zentla.
 */
export enum WebhookEventType {
  // Subscription Events
  SUBSCRIPTION_CREATED = "subscription.created",
  SUBSCRIPTION_UPDATED = "subscription.updated",
  SUBSCRIPTION_CANCELED = "subscription.canceled",
  SUBSCRIPTION_PAUSED = "subscription.paused",
  SUBSCRIPTION_RESUMED = "subscription.resumed",
  SUBSCRIPTION_RENEWED = "subscription.renewed",

  // Customer Events
  CUSTOMER_CREATED = "customer.created",
  CUSTOMER_UPDATED = "customer.updated",
  CUSTOMER_DELETED = "customer.deleted",

  // Invoice Events
  INVOICE_PAID = "invoice.paid",
  INVOICE_PAYMENT_FAILED = "invoice.payment_failed",
  INVOICE_UPCOMING = "invoice.upcoming",

  // Entitlement Events
  ENTITLEMENT_GRANTED = "entitlement.granted",
  ENTITLEMENT_REVOKED = "entitlement.revoked",
  ENTITLEMENT_UPDATED = "entitlement.updated",

  // Checkout Events
  CHECKOUT_COMPLETED = "checkout.completed",
  CHECKOUT_EXPIRED = "checkout.expired",
}

// ============================================================================
// Base Event Structure
// ============================================================================

/**
 * Base structure for all webhook events.
 */
export interface WebhookEventBase {
  /** Unique event ID */
  id: string;
  /** Event type from WebhookEventType enum */
  type: WebhookEventType | string;
  /** ISO 8601 timestamp when the event occurred */
  timestamp: string;
  /** Workspace ID this event belongs to */
  workspaceId: string;
  /** API version used for this event */
  apiVersion: string;
  /** Event-specific data */
  data: unknown;
}

// ============================================================================
// Subscription Event Payloads
// ============================================================================

export interface SubscriptionEventData {
  subscription: {
    id: string;
    customerId: string;
    offerId: string;
    offerVersionId: string;
    status:
      | "trialing"
      | "active"
      | "payment_failed"
      | "canceled"
      | "suspended"
      | "pending"
      | "expired"
      | "paused";
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialStart?: string | null;
    trialEnd?: string | null;
    cancelAt?: string | null;
    canceledAt?: string | null;
    endedAt?: string | null;
    createdAt: string;
  };
  previousStatus?: string;
}

export interface SubscriptionCreatedEvent extends WebhookEventBase {
  type: WebhookEventType.SUBSCRIPTION_CREATED;
  data: SubscriptionEventData;
}

export interface SubscriptionUpdatedEvent extends WebhookEventBase {
  type: WebhookEventType.SUBSCRIPTION_UPDATED;
  data: SubscriptionEventData;
}

export interface SubscriptionCanceledEvent extends WebhookEventBase {
  type: WebhookEventType.SUBSCRIPTION_CANCELED;
  data: SubscriptionEventData;
}

// ============================================================================
// Customer Event Payloads
// ============================================================================

export interface CustomerEventData {
  customer: {
    id: string;
    email: string;
    name?: string | null;
    externalId?: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
}

export interface CustomerCreatedEvent extends WebhookEventBase {
  type: WebhookEventType.CUSTOMER_CREATED;
  data: CustomerEventData;
}

export interface CustomerUpdatedEvent extends WebhookEventBase {
  type: WebhookEventType.CUSTOMER_UPDATED;
  data: CustomerEventData & {
    previousEmail?: string;
  };
}

// ============================================================================
// Invoice Event Payloads
// ============================================================================

export interface InvoiceEventData {
  invoice: {
    id: string;
    subscriptionId: string;
    customerId: string;
    amountPaid?: number;
    amountDue: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    attemptCount?: number;
    nextPaymentAttempt?: string | null;
  };
}

export interface InvoicePaidEvent extends WebhookEventBase {
  type: WebhookEventType.INVOICE_PAID;
  data: InvoiceEventData;
}

export interface InvoicePaymentFailedEvent extends WebhookEventBase {
  type: WebhookEventType.INVOICE_PAYMENT_FAILED;
  data: InvoiceEventData;
}

// ============================================================================
// Entitlement Event Payloads
// ============================================================================

export interface EntitlementEventData {
  entitlement: {
    id: string;
    customerId: string;
    subscriptionId: string;
    featureKey: string;
    value: string;
    valueType: "boolean" | "number" | "string" | "unlimited";
    expiresAt?: string | null;
  };
}

export interface EntitlementGrantedEvent extends WebhookEventBase {
  type: WebhookEventType.ENTITLEMENT_GRANTED;
  data: EntitlementEventData;
}

export interface EntitlementRevokedEvent extends WebhookEventBase {
  type: WebhookEventType.ENTITLEMENT_REVOKED;
  data: EntitlementEventData;
}

// ============================================================================
// Checkout Event Payloads
// ============================================================================

export interface CheckoutEventData {
  checkout: {
    id: string;
    customerId?: string | null;
    offerId: string;
    offerVersionId: string;
    status: "pending" | "open" | "complete" | "expired";
    completedAt?: string | null;
    metadata: Record<string, unknown>;
  };
  subscriptionId?: string;
}

export interface CheckoutCompletedEvent extends WebhookEventBase {
  type: WebhookEventType.CHECKOUT_COMPLETED;
  data: CheckoutEventData;
}

// ============================================================================
// Union Type for All Events
// ============================================================================

export type WebhookEvent =
  | SubscriptionCreatedEvent
  | SubscriptionUpdatedEvent
  | SubscriptionCanceledEvent
  | CustomerCreatedEvent
  | CustomerUpdatedEvent
  | InvoicePaidEvent
  | InvoicePaymentFailedEvent
  | EntitlementGrantedEvent
  | EntitlementRevokedEvent
  | CheckoutCompletedEvent;

// ============================================================================
// Webhook Delivery Configuration
// ============================================================================

/**
 * Webhook retry schedule (exponential backoff).
 * After 5 failed attempts, events are moved to dead letter queue.
 */
export const WEBHOOK_RETRY_SCHEDULE = {
  attempt1: "5 seconds",
  attempt2: "30 seconds",
  attempt3: "5 minutes",
  attempt4: "30 minutes",
  attempt5: "2 hours",
  maxAttempts: 5,
  deadLetterAfter: "All retries exhausted",
} as const;

/**
 * Webhook signature verification.
 * All webhooks are signed using HMAC-SHA256.
 *
 * Header: X-Zentla-Signature
 * Format: t=<timestamp>,v1=<signature>
 *
 * To verify:
 * 1. Parse the timestamp and signature from the header
 * 2. Construct the signed payload: `${timestamp}.${body}`
 * 3. Compute HMAC-SHA256 using your webhook secret
 * 4. Compare signatures using timing-safe comparison
 * 5. Reject if timestamp is older than 5 minutes
 */
export const WEBHOOK_SIGNATURE_HEADER = "X-Zentla-Signature";
export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300; // 5 minutes

/**
 * Example webhook handler (Node.js/Express):
 *
 * ```typescript
 * import crypto from 'crypto';
 *
 * function verifyWebhook(body: string, signature: string, secret: string): boolean {
 *   const [timestampPart, signaturePart] = signature.split(',');
 *   const timestamp = timestampPart.replace('t=', '');
 *   const expectedSignature = signaturePart.replace('v1=', '');
 *
 *   // Check timestamp freshness
 *   const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
 *   if (age > 300) return false;
 *
 *   // Compute expected signature
 *   const signedPayload = `${timestamp}.${body}`;
 *   const computed = crypto
 *     .createHmac('sha256', secret)
 *     .update(signedPayload)
 *     .digest('hex');
 *
 *   return crypto.timingSafeEqual(
 *     Buffer.from(computed),
 *     Buffer.from(expectedSignature)
 *   );
 * }
 * ```
 */
