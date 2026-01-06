import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { BillingService, ProviderType } from "../billing/billing.service";
import { ProviderRefService } from "../billing/provider-ref.service";
import { OutboxService } from "./outbox.service";
import { EntitlementsService } from "../entitlements/entitlements.service";
import type { StripeAdapter } from "@zentla/stripe-adapter";
import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";

const PROVIDER: ProviderType = "stripe";

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly providerRefService: ProviderRefService,
    private readonly outboxService: OutboxService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async processWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: boolean; eventId?: string }> {
    // Try to extract workspace ID from raw body to use workspace-specific secret
    let workspaceId: string | undefined;
    let workspaceSettings:
      | {
          stripeSecretKey?: string;
          stripeWebhookSecret?: string;
        }
      | undefined;

    try {
      const bodyStr = rawBody.toString();
      const parsed = JSON.parse(bodyStr);
      // Try to get workspace ID from various event types' metadata
      const metadata =
        parsed?.data?.object?.metadata ??
        parsed?.data?.object?.subscription_details?.metadata;
      workspaceId = metadata?.zentla_workspace_id;

      if (workspaceId) {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { settings: true },
        });
        workspaceSettings = workspace?.settings as typeof workspaceSettings;
      }
    } catch {
      // Ignore parsing errors, will fall back to global secret
    }

    // Try workspace-specific adapter first, then fall back to global
    let stripeAdapter: StripeAdapter | null = null;
    let event: Stripe.Event | null = null;

    // Try workspace-specific secret first
    if (workspaceId && workspaceSettings?.stripeWebhookSecret) {
      try {
        stripeAdapter = this.billingService.getProviderForWorkspace(
          workspaceId,
          PROVIDER,
          workspaceSettings,
        ) as StripeAdapter;

        if (stripeAdapter.verifyWebhook(rawBody, signature)) {
          event = stripeAdapter.parseWebhookEvent(rawBody, signature);
          this.logger.log(
            `Webhook verified using workspace ${workspaceId} secret`,
          );
        }
      } catch {
        // Fall through to global secret
      }
    }

    // Fall back to global secret
    if (!event) {
      stripeAdapter = this.billingService.getProvider(
        PROVIDER,
      ) as StripeAdapter;
      if (!stripeAdapter) {
        throw new Error("No Stripe adapter configured");
      }

      if (!stripeAdapter.verifyWebhook(rawBody, signature)) {
        throw new Error("Invalid webhook signature");
      }

      event = stripeAdapter.parseWebhookEvent(rawBody, signature);
      this.logger.log("Webhook verified using global secret");
    }

    // Check if we've already processed this event (idempotency)
    // Use the new provider-agnostic table
    const existingEvent = await this.prisma.processedProviderEvent.findFirst({
      where: {
        provider: "stripe",
        providerEventId: event.id,
      },
    });

    if (existingEvent) {
      this.logger.log(`Skipping duplicate Stripe event: ${event.id}`);
      return { received: true, eventId: event.id };
    }

    // Process the event based on type
    await this.handleEvent(event);

    // Mark event as processed (for deduplication)
    await this.prisma.processedProviderEvent.create({
      data: {
        provider: "stripe",
        providerEventId: event.id,
        eventType: event.type,
      },
    });

    return { received: true, eventId: event.id };
  }

  private async handleEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing Stripe event: ${event.type} (${event.id})`);

    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted(event);
        break;
      case "customer.subscription.created":
        await this.handleSubscriptionCreated(event);
        break;
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(event);
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(event);
        break;
      case "invoice.paid":
        await this.handleInvoicePaid(event);
        break;
      case "invoice.payment_failed":
        await this.handleInvoicePaymentFailed(event);
        break;
      case "payment_intent.succeeded":
        await this.handlePaymentIntentSucceeded(event);
        break;
      case "setup_intent.succeeded":
        await this.handleSetupIntentSucceeded(event);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata ?? {};
    const workspaceId = metadata.zentla_workspace_id;
    const checkoutId = metadata.zentla_checkout_id;

    if (!workspaceId) {
      this.logger.warn("No workspace ID in checkout session metadata");
      return;
    }

    // Update our checkout record
    if (checkoutId) {
      await this.prisma.checkout.update({
        where: { id: checkoutId },
        data: {
          status: "complete",
          completedAt: new Date(),
        },
      });
    }

    // Get or create customer
    const stripeCustomerId = session.customer as string;
    const customerEmail =
      session.customer_email ?? session.customer_details?.email;

    let customerId: string;

    // Check if we have this Stripe customer mapped
    const customerRef = await this.providerRefService.findByExternalId(
      workspaceId,
      "stripe",
      "customer",
      stripeCustomerId,
    );

    if (customerRef) {
      customerId = customerRef.entityId;
    } else {
      // Create a new customer
      const customer = await this.prisma.customer.create({
        data: {
          workspaceId,
          email: customerEmail ?? "unknown@example.com",
          metadata: {
            stripeCustomerId,
            source: "checkout",
          },
        },
      });
      customerId = customer.id;

      // Store provider ref
      await this.providerRefService.create({
        workspaceId,
        entityType: "customer",
        entityId: customer.id,
        provider: "stripe",
        externalId: stripeCustomerId,
      });
    }

    // Link customer to checkout if we have a checkout record
    if (checkoutId) {
      await this.prisma.checkout.update({
        where: { id: checkoutId },
        data: { customerId },
      });
    }

    this.logger.log(
      `Checkout completed: ${checkoutId}, customer: ${customerId}`,
    );
  }

  private async handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
    const stripeSubscription = event.data.object as Stripe.Subscription;
    const metadata = stripeSubscription.metadata ?? {};
    const workspaceId = metadata.zentla_workspace_id;

    if (!workspaceId) {
      // Try to infer workspace from customer
      const stripeCustomerId = stripeSubscription.customer as string;
      const customerRef = await this.prisma.providerRef.findFirst({
        where: {
          provider: "stripe",
          entityType: "customer",
          externalId: stripeCustomerId,
        },
      });

      if (!customerRef) {
        throw new Error(
          `No workspace found for subscription ${stripeSubscription.id} - customer ${stripeCustomerId} not linked to Zentla. Ensure webhook is configured before first checkout.`,
        );
      }

      await this.createSubscriptionFromStripe(
        customerRef.workspaceId,
        stripeSubscription,
      );
    } else {
      await this.createSubscriptionFromStripe(workspaceId, stripeSubscription);
    }
  }

  private async createSubscriptionFromStripe(
    workspaceId: string,
    stripeSubscription: Stripe.Subscription,
  ): Promise<void> {
    // Check if subscription already exists
    const existingRef = await this.providerRefService.findByExternalId(
      workspaceId,
      "stripe",
      "subscription",
      stripeSubscription.id,
    );

    if (existingRef) {
      this.logger.log(`Subscription ${stripeSubscription.id} already exists`);
      return;
    }

    // Get customer
    const stripeCustomerId = stripeSubscription.customer as string;
    const customerRef = await this.providerRefService.findByExternalId(
      workspaceId,
      "stripe",
      "customer",
      stripeCustomerId,
    );

    if (!customerRef) {
      throw new Error(
        `Customer not found for Stripe customer ${stripeCustomerId}. Ensure checkout webhook was processed first.`,
      );
    }

    // Get offer from price
    const priceId = stripeSubscription.items.data[0]?.price.id;
    if (!priceId) {
      throw new Error(
        `No price found in subscription ${stripeSubscription.id}`,
      );
    }

    const priceRef = await this.providerRefService.findByExternalId(
      workspaceId,
      "stripe",
      "price",
      priceId,
    );

    if (!priceRef) {
      throw new Error(
        `Price ref not found for Stripe price ${priceId}. This price may not have been synced from Zentla.`,
      );
    }

    // Get the offer version and offer
    const offerVersion = await this.prisma.offerVersion.findUnique({
      where: { id: priceRef.entityId },
      include: { offer: true },
    });

    if (!offerVersion) {
      throw new Error(
        `Offer version not found: ${priceRef.entityId}. The offer may have been deleted.`,
      );
    }

    // Create subscription
    // Handle trial subscriptions where period dates might be 0
    const periodStart = stripeSubscription.current_period_start
      ? new Date(stripeSubscription.current_period_start * 1000)
      : new Date();
    const periodEnd = stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000)
      : stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    const subscription = await this.prisma.subscription.create({
      data: {
        workspaceId,
        customerId: customerRef.entityId,
        offerId: offerVersion.offerId,
        offerVersionId: offerVersion.id,
        status: this.mapStripeStatus(stripeSubscription.status),
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialStart: stripeSubscription.trial_start
          ? new Date(stripeSubscription.trial_start * 1000)
          : null,
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        cancelAt: stripeSubscription.cancel_at
          ? new Date(stripeSubscription.cancel_at * 1000)
          : null,
        metadata: {},
      },
    });

    // Store provider ref
    await this.providerRefService.create({
      workspaceId,
      entityType: "subscription",
      entityId: subscription.id,
      provider: "stripe",
      externalId: stripeSubscription.id,
    });

    // Grant entitlements
    await this.grantEntitlements(
      workspaceId,
      subscription.id,
      customerRef.entityId,
      offerVersion,
    );

    // Create outbox event for webhook delivery
    await this.outboxService.createEvent({
      workspaceId,
      eventType: "subscription.created",
      aggregateType: "subscription",
      aggregateId: subscription.id,
      payload: {
        subscription: {
          id: subscription.id,
          customerId: customerRef.entityId,
          offerId: offerVersion.offerId,
          offerVersionId: offerVersion.id,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          trialStart: subscription.trialStart,
          trialEnd: subscription.trialEnd,
          metadata: subscription.metadata,
        },
      },
    });

    this.logger.log(
      `Created subscription ${subscription.id} from Stripe ${stripeSubscription.id}`,
    );
  }

  private async grantEntitlements(
    workspaceId: string,
    subscriptionId: string,
    customerId: string,
    offerVersion: { id: string; config: Prisma.JsonValue },
  ): Promise<void> {
    const config = offerVersion.config as {
      entitlements?: Array<{
        featureKey: string;
        value: string | number | boolean;
        valueType: string;
      }>;
    };

    const entitlements = config?.entitlements ?? [];

    for (const e of entitlements) {
      await this.prisma.entitlement.upsert({
        where: {
          subscriptionId_featureKey: {
            subscriptionId,
            featureKey: e.featureKey,
          },
        },
        update: {
          value: String(e.value),
          valueType: e.valueType as
            | "boolean"
            | "number"
            | "string"
            | "unlimited",
        },
        create: {
          workspaceId,
          customerId,
          subscriptionId,
          featureKey: e.featureKey,
          value: String(e.value),
          valueType: e.valueType as
            | "boolean"
            | "number"
            | "string"
            | "unlimited",
        },
      });
    }

    this.logger.log(
      `Granted ${entitlements.length} entitlements for subscription ${subscriptionId}`,
    );
  }

  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const stripeSubscription = event.data.object as Stripe.Subscription;

    // Find our subscription
    const subscriptionRef = await this.prisma.providerRef.findFirst({
      where: {
        provider: "stripe",
        entityType: "subscription",
        externalId: stripeSubscription.id,
      },
    });

    if (!subscriptionRef) {
      // Might be a new subscription, try to create it
      await this.handleSubscriptionCreated(event);
      return;
    }

    // Update subscription - handle null period dates safely
    const periodStart = stripeSubscription.current_period_start
      ? new Date(stripeSubscription.current_period_start * 1000)
      : undefined;
    const periodEnd = stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000)
      : undefined;

    const updatedSubscription = await this.prisma.subscription.update({
      where: { id: subscriptionRef.entityId },
      data: {
        status: this.mapStripeStatus(stripeSubscription.status),
        ...(periodStart && { currentPeriodStart: periodStart }),
        ...(periodEnd && { currentPeriodEnd: periodEnd }),
        cancelAt: stripeSubscription.cancel_at
          ? new Date(stripeSubscription.cancel_at * 1000)
          : null,
        canceledAt: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : null,
      },
    });

    // Create outbox event for webhook delivery
    await this.outboxService.createEvent({
      workspaceId: subscriptionRef.workspaceId,
      eventType: "subscription.updated",
      aggregateType: "subscription",
      aggregateId: subscriptionRef.entityId,
      payload: {
        subscription: {
          id: updatedSubscription.id,
          customerId: updatedSubscription.customerId,
          status: updatedSubscription.status,
          currentPeriodStart: updatedSubscription.currentPeriodStart,
          currentPeriodEnd: updatedSubscription.currentPeriodEnd,
          cancelAt: updatedSubscription.cancelAt,
          metadata: updatedSubscription.metadata,
        },
      },
    });

    this.logger.log(`Updated subscription ${subscriptionRef.entityId}`);
  }

  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const stripeSubscription = event.data.object as Stripe.Subscription;

    // Find our subscription
    const subscriptionRef = await this.prisma.providerRef.findFirst({
      where: {
        provider: "stripe",
        entityType: "subscription",
        externalId: stripeSubscription.id,
      },
    });

    if (!subscriptionRef) {
      this.logger.warn(
        `Subscription ref not found for ${stripeSubscription.id}`,
      );
      return;
    }

    // Update subscription status
    const canceledSubscription = await this.prisma.subscription.update({
      where: { id: subscriptionRef.entityId },
      data: {
        status: "canceled",
        canceledAt: new Date(),
        endedAt: new Date(),
      },
    });

    // Revoke all entitlements for this subscription
    await this.entitlementsService.revokeAllForSubscription(
      subscriptionRef.workspaceId,
      subscriptionRef.entityId,
    );
    this.logger.log(
      `Revoked entitlements for subscription ${subscriptionRef.entityId}`,
    );

    // Create outbox event for webhook delivery
    await this.outboxService.createEvent({
      workspaceId: subscriptionRef.workspaceId,
      eventType: "subscription.canceled",
      aggregateType: "subscription",
      aggregateId: subscriptionRef.entityId,
      payload: {
        subscription: {
          id: canceledSubscription.id,
          customerId: canceledSubscription.customerId,
          status: canceledSubscription.status,
          canceledAt: canceledSubscription.canceledAt,
          endedAt: canceledSubscription.endedAt,
          metadata: canceledSubscription.metadata,
        },
      },
    });

    this.logger.log(
      `Marked subscription ${subscriptionRef.entityId} as canceled`,
    );
  }

  private async handleInvoicePaid(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoice.subscription as string;

    if (!subscriptionId) {
      return;
    }

    // Find our subscription
    const subscriptionRef = await this.prisma.providerRef.findFirst({
      where: {
        provider: "stripe",
        entityType: "subscription",
        externalId: subscriptionId,
      },
    });

    if (!subscriptionRef) {
      return;
    }

    // Update subscription period
    if (invoice.lines.data[0]) {
      const line = invoice.lines.data[0];
      const newPeriodEnd = new Date(line.period.end * 1000);

      await this.prisma.subscription.update({
        where: { id: subscriptionRef.entityId },
        data: {
          status: "active",
          currentPeriodStart: new Date(line.period.start * 1000),
          currentPeriodEnd: newPeriodEnd,
        },
      });

      // Refresh entitlement expiration dates for the new billing period
      await this.entitlementsService.refreshExpirationForSubscription(
        subscriptionRef.workspaceId,
        subscriptionRef.entityId,
        newPeriodEnd,
      );
      this.logger.log(
        `Refreshed entitlement expiration for subscription ${subscriptionRef.entityId}`,
      );

      // Create outbox event for webhook delivery
      await this.outboxService.createEvent({
        workspaceId: subscriptionRef.workspaceId,
        eventType: "invoice.paid",
        aggregateType: "invoice",
        aggregateId: invoice.id ?? subscriptionRef.entityId,
        payload: {
          invoice: {
            id: invoice.id,
            subscriptionId: subscriptionRef.entityId,
            amountPaid: invoice.amount_paid,
            amountDue: invoice.amount_due,
            currency: invoice.currency,
            periodStart: new Date(line.period.start * 1000),
            periodEnd: new Date(line.period.end * 1000),
          },
        },
      });
    }

    this.logger.log(
      `Invoice paid for subscription ${subscriptionRef.entityId}`,
    );
  }

  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoice.subscription as string;

    if (!subscriptionId) {
      return;
    }

    // Find our subscription
    const subscriptionRef = await this.prisma.providerRef.findFirst({
      where: {
        provider: "stripe",
        entityType: "subscription",
        externalId: subscriptionId,
      },
    });

    if (!subscriptionRef) {
      return;
    }

    // Update subscription status
    await this.prisma.subscription.update({
      where: { id: subscriptionRef.entityId },
      data: {
        status: "payment_failed",
      },
    });

    // Create outbox event for webhook delivery
    await this.outboxService.createEvent({
      workspaceId: subscriptionRef.workspaceId,
      eventType: "invoice.payment_failed",
      aggregateType: "invoice",
      aggregateId: invoice.id ?? subscriptionRef.entityId,
      payload: {
        invoice: {
          id: invoice.id,
          subscriptionId: subscriptionRef.entityId,
          amountDue: invoice.amount_due,
          currency: invoice.currency,
          attemptCount: invoice.attempt_count,
          nextPaymentAttempt: invoice.next_payment_attempt
            ? new Date(invoice.next_payment_attempt * 1000)
            : null,
        },
      },
    });

    this.logger.log(
      `Payment failed for subscription ${subscriptionRef.entityId}`,
    );
  }

  /**
   * Handle payment_intent.succeeded for headless checkout flow.
   * This is triggered when a customer completes payment via Stripe.js.
   */
  private async handlePaymentIntentSucceeded(
    event: Stripe.Event,
  ): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const metadata = paymentIntent.metadata ?? {};
    const checkoutIntentId = metadata.checkoutIntentId;
    const workspaceId = metadata.workspaceId;

    if (!checkoutIntentId || !workspaceId) {
      this.logger.log("PaymentIntent not from headless checkout, skipping");
      return;
    }

    // Find the checkout intent
    const checkoutIntent = await this.prisma.checkoutIntent.findUnique({
      where: { id: checkoutIntentId },
      include: {
        offerVersion: true,
        customer: true,
      },
    });

    if (!checkoutIntent) {
      this.logger.warn(`CheckoutIntent ${checkoutIntentId} not found`);
      return;
    }

    if (checkoutIntent.status === "succeeded") {
      this.logger.log(`CheckoutIntent ${checkoutIntentId} already succeeded`);
      return;
    }

    // Get or create customer
    let customerId = checkoutIntent.customerId;
    const stripeCustomerId = paymentIntent.customer as string | null;

    if (!customerId && checkoutIntent.customerEmail) {
      // Find or create customer from email
      let customer = await this.prisma.customer.findFirst({
        where: { workspaceId, email: checkoutIntent.customerEmail },
      });

      if (!customer) {
        customer = await this.prisma.customer.create({
          data: {
            workspaceId,
            email: checkoutIntent.customerEmail,
            metadata: {
              source: "headless_checkout",
              checkoutIntentId,
            },
          },
        });
      }
      customerId = customer.id;

      // Store Stripe customer ref if available and not already stored
      if (stripeCustomerId) {
        const existingRef = await this.providerRefService.findByEntity(
          workspaceId,
          "customer",
          customer.id,
          "stripe",
        );
        if (!existingRef) {
          await this.providerRefService.create({
            workspaceId,
            entityType: "customer",
            entityId: customer.id,
            provider: "stripe",
            externalId: stripeCustomerId,
          });
        }
      }
    }

    if (!customerId) {
      this.logger.error(`No customer for checkout intent ${checkoutIntentId}`);
      return;
    }

    // Create the subscription
    const subscription = await this.createSubscriptionFromIntent(
      workspaceId,
      customerId,
      checkoutIntent,
    );

    // Update checkout intent
    await this.prisma.checkoutIntent.update({
      where: { id: checkoutIntentId },
      data: {
        status: "succeeded",
        customerId,
        subscriptionId: subscription.id,
        completedAt: new Date(),
      },
    });

    // Emit checkout.intent.completed event
    await this.outboxService.createEvent({
      workspaceId,
      eventType: "checkout.intent.completed",
      aggregateType: "checkout_intent",
      aggregateId: checkoutIntentId,
      payload: {
        checkoutIntent: {
          id: checkoutIntentId,
          customerId,
          subscriptionId: subscription.id,
          offerId: checkoutIntent.offerId,
          total: checkoutIntent.totalAmount,
          metadata: checkoutIntent.metadata,
        },
      },
    });

    this.logger.log(
      `Payment succeeded for checkout intent ${checkoutIntentId}, subscription ${subscription.id}`,
    );
  }

  /**
   * Handle setup_intent.succeeded for headless checkout with trials.
   * This is triggered when a customer sets up payment method for future use.
   */
  private async handleSetupIntentSucceeded(event: Stripe.Event): Promise<void> {
    const setupIntent = event.data.object as Stripe.SetupIntent;
    const metadata = setupIntent.metadata ?? {};
    const checkoutIntentId = metadata.checkoutIntentId;
    const workspaceId = metadata.workspaceId;

    if (!checkoutIntentId || !workspaceId) {
      this.logger.log("SetupIntent not from headless checkout, skipping");
      return;
    }

    // Find the checkout intent
    const checkoutIntent = await this.prisma.checkoutIntent.findUnique({
      where: { id: checkoutIntentId },
      include: {
        offerVersion: true,
        customer: true,
      },
    });

    if (!checkoutIntent) {
      this.logger.warn(`CheckoutIntent ${checkoutIntentId} not found`);
      return;
    }

    if (checkoutIntent.status === "succeeded") {
      this.logger.log(`CheckoutIntent ${checkoutIntentId} already succeeded`);
      return;
    }

    // Get or create customer
    let customerId = checkoutIntent.customerId;
    const stripeCustomerId = setupIntent.customer as string | null;

    if (!customerId && checkoutIntent.customerEmail) {
      // Find or create customer from email
      let customer = await this.prisma.customer.findFirst({
        where: { workspaceId, email: checkoutIntent.customerEmail },
      });

      if (!customer) {
        customer = await this.prisma.customer.create({
          data: {
            workspaceId,
            email: checkoutIntent.customerEmail,
            metadata: {
              source: "headless_checkout",
              checkoutIntentId,
            },
          },
        });
      }
      customerId = customer.id;

      // Store Stripe customer ref if available and not already stored
      if (stripeCustomerId) {
        const existingRef = await this.providerRefService.findByEntity(
          workspaceId,
          "customer",
          customer.id,
          "stripe",
        );
        if (!existingRef) {
          await this.providerRefService.create({
            workspaceId,
            entityType: "customer",
            entityId: customer.id,
            provider: "stripe",
            externalId: stripeCustomerId,
          });
        }
      }
    }

    if (!customerId) {
      this.logger.error(`No customer for checkout intent ${checkoutIntentId}`);
      return;
    }

    // Create the subscription (will be in trialing status)
    const subscription = await this.createSubscriptionFromIntent(
      workspaceId,
      customerId,
      checkoutIntent,
    );

    // Update checkout intent
    await this.prisma.checkoutIntent.update({
      where: { id: checkoutIntentId },
      data: {
        status: "succeeded",
        customerId,
        subscriptionId: subscription.id,
        completedAt: new Date(),
      },
    });

    await this.outboxService.createEvent({
      workspaceId,
      eventType: "checkout.intent.completed",
      aggregateType: "checkout_intent",
      aggregateId: checkoutIntentId,
      payload: {
        checkoutIntent: {
          id: checkoutIntentId,
          customerId,
          subscriptionId: subscription.id,
          offerId: checkoutIntent.offerId,
          trialDays: checkoutIntent.trialDays,
          metadata: checkoutIntent.metadata,
        },
      },
    });

    this.logger.log(
      `Setup succeeded for checkout intent ${checkoutIntentId}, subscription ${subscription.id}`,
    );
  }

  /**
   * Create a subscription from a checkout intent.
   */
  private async createSubscriptionFromIntent(
    workspaceId: string,
    customerId: string,
    checkoutIntent: {
      id: string;
      offerId: string;
      offerVersionId: string;
      trialDays: number | null;
      promotionId: string | null;
      promotionVersionId: string | null;
      metadata: unknown;
      offerVersion: { id: string; config: Prisma.JsonValue };
    },
  ): Promise<{ id: string }> {
    const now = new Date();
    const trialDays = checkoutIntent.trialDays;

    // Calculate period dates
    const currentPeriodStart = now;
    let currentPeriodEnd: Date;
    let trialStart: Date | null = null;
    let trialEnd: Date | null = null;

    if (trialDays && trialDays > 0) {
      trialStart = now;
      trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
      currentPeriodEnd = trialEnd;
    } else {
      // Get billing interval from offer config
      const config = checkoutIntent.offerVersion.config as {
        pricing?: { interval?: string; intervalCount?: number };
      };
      const interval = config?.pricing?.interval ?? "month";
      const intervalCount = config?.pricing?.intervalCount ?? 1;

      // Calculate period end based on interval
      currentPeriodEnd = new Date(now);
      switch (interval) {
        case "day":
          currentPeriodEnd.setDate(currentPeriodEnd.getDate() + intervalCount);
          break;
        case "week":
          currentPeriodEnd.setDate(
            currentPeriodEnd.getDate() + 7 * intervalCount,
          );
          break;
        case "month":
          currentPeriodEnd.setMonth(
            currentPeriodEnd.getMonth() + intervalCount,
          );
          break;
        case "year":
          currentPeriodEnd.setFullYear(
            currentPeriodEnd.getFullYear() + intervalCount,
          );
          break;
      }
    }

    const status = trialDays && trialDays > 0 ? "trialing" : "active";

    // Create subscription
    const subscription = await this.prisma.subscription.create({
      data: {
        workspaceId,
        customerId,
        offerId: checkoutIntent.offerId,
        offerVersionId: checkoutIntent.offerVersionId,
        status,
        currentPeriodStart,
        currentPeriodEnd,
        trialStart,
        trialEnd,
        metadata: (checkoutIntent.metadata as object) ?? {},
      },
    });

    // Grant entitlements
    await this.grantEntitlements(
      workspaceId,
      subscription.id,
      customerId,
      checkoutIntent.offerVersion,
    );

    // Record promotion usage if applicable
    if (checkoutIntent.promotionId && checkoutIntent.promotionVersionId) {
      await this.prisma.appliedPromotion.create({
        data: {
          workspaceId,
          promotionId: checkoutIntent.promotionId,
          promotionVersionId: checkoutIntent.promotionVersionId,
          subscriptionId: subscription.id,
          customerId,
          discountAmount: 0, // Captured in checkout intent
        },
      });
    }

    // Emit subscription.created event
    await this.outboxService.createEvent({
      workspaceId,
      eventType: "subscription.created",
      aggregateType: "subscription",
      aggregateId: subscription.id,
      payload: {
        subscription: {
          id: subscription.id,
          customerId,
          offerId: checkoutIntent.offerId,
          offerVersionId: checkoutIntent.offerVersionId,
          status,
          currentPeriodStart,
          currentPeriodEnd,
          trialStart,
          trialEnd,
          metadata: checkoutIntent.metadata,
        },
      },
    });

    return subscription;
  }

  private mapStripeStatus(
    status: Stripe.Subscription.Status,
  ):
    | "active"
    | "trialing"
    | "payment_failed"
    | "canceled"
    | "suspended"
    | "pending"
    | "expired"
    | "paused" {
    const statusMap: Record<
      Stripe.Subscription.Status,
      | "active"
      | "trialing"
      | "payment_failed"
      | "canceled"
      | "suspended"
      | "pending"
      | "expired"
      | "paused"
    > = {
      active: "active",
      trialing: "trialing",
      past_due: "payment_failed",
      canceled: "canceled",
      unpaid: "suspended",
      incomplete: "pending",
      incomplete_expired: "expired",
      paused: "paused",
    };
    return statusMap[status];
  }
}
