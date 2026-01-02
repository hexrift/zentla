import type Stripe from "stripe";
import type { DomainEvent } from "@zentla/core";
import { StripeAdapter } from "./stripe.adapter";

export interface WebhookHandlerResult {
  success: boolean;
  event: DomainEvent | null;
  rawEvent: Stripe.Event | null;
  error?: string;
}

export class StripeWebhookHandler {
  constructor(private readonly adapter: StripeAdapter) {}

  handle(payload: Buffer, signature: string): WebhookHandlerResult {
    // Verify signature
    if (!this.adapter.verifyWebhook(payload, signature)) {
      return {
        success: false,
        event: null,
        rawEvent: null,
        error: "Invalid webhook signature",
      };
    }

    try {
      const rawEvent = this.adapter.parseWebhookEvent(payload, signature);
      const normalizedEvent = this.adapter.normalizeEvent(rawEvent);

      return {
        success: true,
        event: normalizedEvent,
        rawEvent,
      };
    } catch (error) {
      return {
        success: false,
        event: null,
        rawEvent: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  isRelevantEvent(eventType: string): boolean {
    const relevantEvents = [
      "checkout.session.completed",
      "checkout.session.expired",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "customer.subscription.trial_will_end",
      "invoice.paid",
      "invoice.payment_failed",
      "invoice.payment_action_required",
      "customer.created",
      "customer.updated",
    ];

    return relevantEvents.includes(eventType);
  }
}
