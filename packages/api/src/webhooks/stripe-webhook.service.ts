import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BillingService } from '../billing/billing.service';
import { ProviderRefService } from '../billing/provider-ref.service';
import { OutboxService } from './outbox.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import type Stripe from 'stripe';
import type { Prisma } from '@prisma/client';

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
    signature: string
  ): Promise<{ received: boolean; eventId?: string }> {
    const stripeAdapter = this.billingService.getStripeAdapter();

    // Verify and parse the webhook
    if (!stripeAdapter.verifyWebhook(rawBody, signature)) {
      throw new Error('Invalid webhook signature');
    }

    const event = stripeAdapter.parseWebhookEvent(rawBody, signature);

    // Check if we've already processed this event (idempotency)
    // Use the new provider-agnostic table
    const existingEvent = await this.prisma.processedProviderEvent.findFirst({
      where: {
        provider: 'stripe',
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
        provider: 'stripe',
        providerEventId: event.id,
        eventType: event.type,
      },
    });

    return { received: true, eventId: event.id };
  }

  private async handleEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing Stripe event: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event);
        break;
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata ?? {};
    const workspaceId = metadata.relay_workspace_id;
    const checkoutId = metadata.relay_checkout_id;

    if (!workspaceId) {
      this.logger.warn('No workspace ID in checkout session metadata');
      return;
    }

    // Update our checkout record
    if (checkoutId) {
      await this.prisma.checkout.update({
        where: { id: checkoutId },
        data: {
          status: 'complete',
          completedAt: new Date(),
        },
      });
    }

    // Get or create customer
    const stripeCustomerId = session.customer as string;
    const customerEmail = session.customer_email ?? session.customer_details?.email;

    let customerId: string;

    // Check if we have this Stripe customer mapped
    const customerRef = await this.providerRefService.findByExternalId(
      workspaceId,
      'stripe',
      'customer',
      stripeCustomerId
    );

    if (customerRef) {
      customerId = customerRef.entityId;
    } else {
      // Create a new customer
      const customer = await this.prisma.customer.create({
        data: {
          workspaceId,
          email: customerEmail ?? 'unknown@example.com',
          metadata: {
            stripeCustomerId,
            source: 'checkout',
          },
        },
      });
      customerId = customer.id;

      // Store provider ref
      await this.providerRefService.create({
        workspaceId,
        entityType: 'customer',
        entityId: customer.id,
        provider: 'stripe',
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

    this.logger.log(`Checkout completed: ${checkoutId}, customer: ${customerId}`);
  }

  private async handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
    const stripeSubscription = event.data.object as Stripe.Subscription;
    const metadata = stripeSubscription.metadata ?? {};
    const workspaceId = metadata.relay_workspace_id;

    if (!workspaceId) {
      // Try to infer workspace from customer
      const stripeCustomerId = stripeSubscription.customer as string;
      const customerRef = await this.prisma.providerRef.findFirst({
        where: {
          provider: 'stripe',
          entityType: 'customer',
          externalId: stripeCustomerId,
        },
      });

      if (!customerRef) {
        this.logger.warn(`No workspace found for subscription ${stripeSubscription.id}`);
        return;
      }

      await this.createSubscriptionFromStripe(customerRef.workspaceId, stripeSubscription);
    } else {
      await this.createSubscriptionFromStripe(workspaceId, stripeSubscription);
    }
  }

  private async createSubscriptionFromStripe(
    workspaceId: string,
    stripeSubscription: Stripe.Subscription
  ): Promise<void> {
    // Check if subscription already exists
    const existingRef = await this.providerRefService.findByExternalId(
      workspaceId,
      'stripe',
      'subscription',
      stripeSubscription.id
    );

    if (existingRef) {
      this.logger.log(`Subscription ${stripeSubscription.id} already exists`);
      return;
    }

    // Get customer
    const stripeCustomerId = stripeSubscription.customer as string;
    const customerRef = await this.providerRefService.findByExternalId(
      workspaceId,
      'stripe',
      'customer',
      stripeCustomerId
    );

    if (!customerRef) {
      this.logger.warn(`Customer not found for Stripe customer ${stripeCustomerId}`);
      return;
    }

    // Get offer from price
    const priceId = stripeSubscription.items.data[0]?.price.id;
    if (!priceId) {
      this.logger.warn('No price found in subscription');
      return;
    }

    const priceRef = await this.providerRefService.findByExternalId(
      workspaceId,
      'stripe',
      'price',
      priceId
    );

    if (!priceRef) {
      this.logger.warn(`Price ref not found for Stripe price ${priceId}`);
      return;
    }

    // Get the offer version and offer
    const offerVersion = await this.prisma.offerVersion.findUnique({
      where: { id: priceRef.entityId },
      include: { offer: true },
    });

    if (!offerVersion) {
      this.logger.warn(`Offer version not found: ${priceRef.entityId}`);
      return;
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
      entityType: 'subscription',
      entityId: subscription.id,
      provider: 'stripe',
      externalId: stripeSubscription.id,
    });

    // Grant entitlements
    await this.grantEntitlements(workspaceId, subscription.id, customerRef.entityId, offerVersion);

    // Create outbox event for webhook delivery
    await this.outboxService.createEvent({
      workspaceId,
      eventType: 'subscription.created',
      aggregateType: 'subscription',
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
        },
      },
    });

    this.logger.log(`Created subscription ${subscription.id} from Stripe ${stripeSubscription.id}`);
  }

  private async grantEntitlements(
    workspaceId: string,
    subscriptionId: string,
    customerId: string,
    offerVersion: { id: string; config: Prisma.JsonValue }
  ): Promise<void> {
    const config = offerVersion.config as { entitlements?: Array<{
      featureKey: string;
      value: string | number | boolean;
      valueType: string;
    }> };

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
          valueType: e.valueType as 'boolean' | 'number' | 'string' | 'unlimited',
        },
        create: {
          workspaceId,
          customerId,
          subscriptionId,
          featureKey: e.featureKey,
          value: String(e.value),
          valueType: e.valueType as 'boolean' | 'number' | 'string' | 'unlimited',
        },
      });
    }

    this.logger.log(`Granted ${entitlements.length} entitlements for subscription ${subscriptionId}`);
  }

  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const stripeSubscription = event.data.object as Stripe.Subscription;

    // Find our subscription
    const subscriptionRef = await this.prisma.providerRef.findFirst({
      where: {
        provider: 'stripe',
        entityType: 'subscription',
        externalId: stripeSubscription.id,
      },
    });

    if (!subscriptionRef) {
      // Might be a new subscription, try to create it
      await this.handleSubscriptionCreated(event);
      return;
    }

    // Update subscription
    const updatedSubscription = await this.prisma.subscription.update({
      where: { id: subscriptionRef.entityId },
      data: {
        status: this.mapStripeStatus(stripeSubscription.status),
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
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
      eventType: 'subscription.updated',
      aggregateType: 'subscription',
      aggregateId: subscriptionRef.entityId,
      payload: {
        subscription: {
          id: updatedSubscription.id,
          customerId: updatedSubscription.customerId,
          status: updatedSubscription.status,
          currentPeriodStart: updatedSubscription.currentPeriodStart,
          currentPeriodEnd: updatedSubscription.currentPeriodEnd,
          cancelAt: updatedSubscription.cancelAt,
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
        provider: 'stripe',
        entityType: 'subscription',
        externalId: stripeSubscription.id,
      },
    });

    if (!subscriptionRef) {
      this.logger.warn(`Subscription ref not found for ${stripeSubscription.id}`);
      return;
    }

    // Update subscription status
    const canceledSubscription = await this.prisma.subscription.update({
      where: { id: subscriptionRef.entityId },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
        endedAt: new Date(),
      },
    });

    // Revoke all entitlements for this subscription
    await this.entitlementsService.revokeAllForSubscription(
      subscriptionRef.workspaceId,
      subscriptionRef.entityId
    );
    this.logger.log(`Revoked entitlements for subscription ${subscriptionRef.entityId}`);

    // Create outbox event for webhook delivery
    await this.outboxService.createEvent({
      workspaceId: subscriptionRef.workspaceId,
      eventType: 'subscription.canceled',
      aggregateType: 'subscription',
      aggregateId: subscriptionRef.entityId,
      payload: {
        subscription: {
          id: canceledSubscription.id,
          customerId: canceledSubscription.customerId,
          status: canceledSubscription.status,
          canceledAt: canceledSubscription.canceledAt,
          endedAt: canceledSubscription.endedAt,
        },
      },
    });

    this.logger.log(`Marked subscription ${subscriptionRef.entityId} as canceled`);
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
        provider: 'stripe',
        entityType: 'subscription',
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
          status: 'active',
          currentPeriodStart: new Date(line.period.start * 1000),
          currentPeriodEnd: newPeriodEnd,
        },
      });

      // Refresh entitlement expiration dates for the new billing period
      await this.entitlementsService.refreshExpirationForSubscription(
        subscriptionRef.workspaceId,
        subscriptionRef.entityId,
        newPeriodEnd
      );
      this.logger.log(`Refreshed entitlement expiration for subscription ${subscriptionRef.entityId}`);

      // Create outbox event for webhook delivery
      await this.outboxService.createEvent({
        workspaceId: subscriptionRef.workspaceId,
        eventType: 'invoice.paid',
        aggregateType: 'invoice',
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

    this.logger.log(`Invoice paid for subscription ${subscriptionRef.entityId}`);
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
        provider: 'stripe',
        entityType: 'subscription',
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
        status: 'past_due',
      },
    });

    // Create outbox event for webhook delivery
    await this.outboxService.createEvent({
      workspaceId: subscriptionRef.workspaceId,
      eventType: 'invoice.payment_failed',
      aggregateType: 'invoice',
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

    this.logger.log(`Payment failed for subscription ${subscriptionRef.entityId}`);
  }

  private mapStripeStatus(
    status: Stripe.Subscription.Status
  ): 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused' {
    const statusMap: Record<Stripe.Subscription.Status, 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused'> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      canceled: 'canceled',
      unpaid: 'unpaid',
      incomplete: 'incomplete',
      incomplete_expired: 'incomplete_expired',
      paused: 'paused',
    };
    return statusMap[status];
  }
}
