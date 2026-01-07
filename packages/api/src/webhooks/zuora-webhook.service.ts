import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { BillingService, ProviderType } from "../billing/billing.service";
import { ProviderRefService } from "../billing/provider-ref.service";
import { OutboxService } from "./outbox.service";
import type { ZuoraAdapter } from "@zentla/zuora-adapter";
import type { EntitlementValueType } from "@prisma/client";

const PROVIDER: ProviderType = "zuora";

interface ZuoraCalloutNotification {
  type: string;
  id?: string;
  accountId?: string;
  subscriptionId?: string;
  paymentId?: string;
  invoiceId?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class ZuoraWebhookService {
  private readonly logger = new Logger(ZuoraWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly providerRefService: ProviderRefService,
    private readonly outboxService: OutboxService,
  ) {}

  async processWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: boolean; eventId?: string }> {
    // Try to extract workspace ID from raw body
    let workspaceId: string | undefined;
    let workspaceSettings:
      | {
          zuoraClientId?: string;
          zuoraClientSecret?: string;
          zuoraBaseUrl?: string;
          zuoraWebhookSecret?: string;
        }
      | undefined;

    let event: ZuoraCalloutNotification;

    try {
      const bodyStr = rawBody.toString();
      const parsed = JSON.parse(bodyStr) as ZuoraCalloutNotification;
      event = parsed;

      // Try to get workspace ID from account metadata
      if (parsed.accountId) {
        // We need to look up the workspace from the account
        const customerRef = await this.prisma.providerRef.findFirst({
          where: {
            provider: "zuora",
            entityType: "customer",
            externalId: parsed.accountId,
          },
        });
        if (customerRef) {
          workspaceId = customerRef.workspaceId;
        }
      }

      if (workspaceId) {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { settings: true },
        });
        workspaceSettings = workspace?.settings as typeof workspaceSettings;
      }
    } catch (error) {
      this.logger.error(`Failed to parse Zuora webhook: ${error}`);
      throw new Error("Invalid webhook payload");
    }

    // Get Zuora adapter
    let zuoraAdapter: ZuoraAdapter | null = null;

    if (workspaceId && workspaceSettings?.zuoraWebhookSecret) {
      try {
        zuoraAdapter = this.billingService.getProviderForWorkspace(
          workspaceId,
          PROVIDER,
          workspaceSettings,
        ) as ZuoraAdapter;

        if (!zuoraAdapter.verifyWebhook(rawBody, signature)) {
          throw new Error("Invalid webhook signature");
        }
        this.logger.log(
          `Webhook verified using workspace ${workspaceId} secret`,
        );
      } catch (error) {
        if ((error as Error).message === "Invalid webhook signature") {
          throw error;
        }
        // Fall through to try without workspace-specific config
      }
    }

    // If no workspace adapter, try to verify without workspace-specific secret
    if (!zuoraAdapter) {
      // For Zuora, we might need to accept webhooks without verification
      // if no global config is available (workspace-only setup)
      this.logger.warn(
        "Processing Zuora webhook without signature verification",
      );
    }

    // Generate a unique event ID if not provided
    const eventId =
      event.id || `zuora_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Check if we've already processed this event (idempotency)
    const existingEvent = await this.prisma.processedProviderEvent.findFirst({
      where: {
        provider: "zuora",
        providerEventId: eventId,
      },
    });

    if (existingEvent) {
      this.logger.log(`Skipping duplicate Zuora event: ${eventId}`);
      return { received: true, eventId };
    }

    // Process the event based on type
    await this.handleEvent(event, workspaceId);

    // Mark event as processed (for deduplication)
    await this.prisma.processedProviderEvent.create({
      data: {
        provider: "zuora",
        providerEventId: eventId,
        eventType: event.type,
      },
    });

    return { received: true, eventId };
  }

  private async handleEvent(
    event: ZuoraCalloutNotification,
    workspaceId?: string,
  ): Promise<void> {
    this.logger.log(`Processing Zuora event: ${event.type} (${event.id})`);

    switch (event.type) {
      case "SubscriptionCreated":
        await this.handleSubscriptionCreated(event, workspaceId);
        break;
      case "SubscriptionUpdated":
        await this.handleSubscriptionUpdated(event, workspaceId);
        break;
      case "SubscriptionCancelled":
        await this.handleSubscriptionCancelled(event, workspaceId);
        break;
      case "PaymentSuccess":
        await this.handlePaymentSuccess(event, workspaceId);
        break;
      case "PaymentFailed":
        await this.handlePaymentFailed(event, workspaceId);
        break;
      default:
        this.logger.log(`Unhandled Zuora event type: ${event.type}`);
    }
  }

  private async handleSubscriptionCreated(
    event: ZuoraCalloutNotification,
    workspaceId?: string,
  ): Promise<void> {
    const subscriptionId = event.subscriptionId;
    const accountId = event.accountId;

    if (!subscriptionId || !accountId) {
      this.logger.warn("Missing subscriptionId or accountId in event");
      return;
    }

    // Resolve workspace if not already known
    if (!workspaceId) {
      const customerRef = await this.prisma.providerRef.findFirst({
        where: {
          provider: "zuora",
          entityType: "customer",
          externalId: accountId,
        },
      });
      workspaceId = customerRef?.workspaceId;
    }

    if (!workspaceId) {
      this.logger.warn(
        `Cannot process subscription.created: workspace not found for account ${accountId}`,
      );
      return;
    }

    // Check if subscription already exists
    const existingRef = await this.providerRefService.findByExternalId(
      workspaceId,
      "zuora",
      "subscription",
      subscriptionId,
    );

    if (existingRef) {
      this.logger.log(`Subscription ${subscriptionId} already synced`);
      return;
    }

    // Get customer reference
    const customerRef = await this.providerRefService.findByExternalId(
      workspaceId,
      "zuora",
      "customer",
      accountId,
    );

    if (!customerRef) {
      this.logger.warn(
        `Customer ${accountId} not found for workspace ${workspaceId}`,
      );
      return;
    }

    // Get subscription details from Zuora to find the rate plan
    const data = event.data as
      | {
          ratePlanId?: string;
          termStartDate?: string;
          termEndDate?: string;
          status?: string;
        }
      | undefined;

    const ratePlanId = data?.ratePlanId;
    if (!ratePlanId) {
      this.logger.warn(`No rate plan found in subscription event`);
      return;
    }

    // Find the offer version linked to this rate plan
    const priceRef = await this.providerRefService.findByExternalId(
      workspaceId,
      "zuora",
      "price",
      ratePlanId,
    );

    if (!priceRef) {
      this.logger.warn(
        `Rate plan ${ratePlanId} not linked to any Zentla offer`,
      );
      return;
    }

    // Get offer version details
    const offerVersion = await this.prisma.offerVersion.findUnique({
      where: { id: priceRef.entityId },
      include: { offer: true },
    });

    if (!offerVersion) {
      this.logger.warn(`Offer version ${priceRef.entityId} not found`);
      return;
    }

    // Create the subscription
    const subscription = await this.prisma.subscription.create({
      data: {
        workspaceId,
        customerId: customerRef.entityId,
        offerId: offerVersion.offer.id,
        offerVersionId: offerVersion.id,
        status: "active",
        currentPeriodStart: data?.termStartDate
          ? new Date(data.termStartDate)
          : new Date(),
        currentPeriodEnd: data?.termEndDate
          ? new Date(data.termEndDate)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        metadata: {
          zuoraSubscriptionId: subscriptionId,
          source: "zuora_webhook",
        },
      },
    });

    // Create provider reference
    await this.providerRefService.create({
      workspaceId,
      entityType: "subscription",
      entityId: subscription.id,
      provider: "zuora",
      externalId: subscriptionId,
    });

    // Grant entitlements from offer config
    const config = offerVersion.config as {
      entitlements?: Array<{
        featureKey: string;
        value: unknown;
        valueType: string;
      }>;
    } | null;
    if (config?.entitlements) {
      for (const entitlement of config.entitlements) {
        await this.prisma.entitlement.create({
          data: {
            workspaceId,
            customerId: customerRef.entityId,
            subscriptionId: subscription.id,
            featureKey: entitlement.featureKey,
            value: String(entitlement.value),
            valueType: entitlement.valueType as EntitlementValueType,
          },
        });
      }
    }

    // Emit outbox event
    await this.outboxService.createEvent({
      workspaceId,
      eventType: "subscription.created",
      aggregateType: "subscription",
      aggregateId: subscription.id,
      payload: {
        subscriptionId: subscription.id,
        customerId: customerRef.entityId,
        offerId: offerVersion.offer.id,
        status: "active",
        source: "zuora",
      },
    });

    this.logger.log(`Created subscription ${subscription.id} from Zuora`);
  }

  private async handleSubscriptionUpdated(
    event: ZuoraCalloutNotification,
    workspaceId?: string,
  ): Promise<void> {
    const subscriptionId = event.subscriptionId;

    if (!subscriptionId) {
      this.logger.warn("Missing subscriptionId in event");
      return;
    }

    // Find the subscription reference
    const subscriptionRef = await this.prisma.providerRef.findFirst({
      where: {
        provider: "zuora",
        entityType: "subscription",
        externalId: subscriptionId,
      },
    });

    if (!subscriptionRef) {
      this.logger.warn(`Subscription ${subscriptionId} not found in Zentla`);
      return;
    }

    workspaceId = subscriptionRef.workspaceId;

    const data = event.data as
      | {
          status?: string;
          termEndDate?: string;
          cancelledDate?: string;
        }
      | undefined;

    // Map Zuora status to Zentla status
    const statusMap: Record<string, string> = {
      Active: "active",
      Cancelled: "canceled",
      Expired: "canceled",
      Suspended: "paused",
    };

    const status = data?.status
      ? statusMap[data.status] || "active"
      : undefined;

    // Update subscription
    const subscription = await this.prisma.subscription.update({
      where: { id: subscriptionRef.entityId },
      data: {
        ...(status && { status: status as "active" | "canceled" | "paused" }),
        ...(data?.termEndDate && {
          currentPeriodEnd: new Date(data.termEndDate),
        }),
        ...(data?.cancelledDate && {
          canceledAt: new Date(data.cancelledDate),
        }),
      },
    });

    // Emit outbox event
    await this.outboxService.createEvent({
      workspaceId,
      eventType: "subscription.updated",
      aggregateType: "subscription",
      aggregateId: subscription.id,
      payload: {
        subscriptionId: subscription.id,
        status: subscription.status,
        source: "zuora",
      },
    });

    this.logger.log(`Updated subscription ${subscription.id}`);
  }

  private async handleSubscriptionCancelled(
    event: ZuoraCalloutNotification,
    workspaceId?: string,
  ): Promise<void> {
    const subscriptionId = event.subscriptionId;

    if (!subscriptionId) {
      this.logger.warn("Missing subscriptionId in event");
      return;
    }

    // Find the subscription reference
    const subscriptionRef = await this.prisma.providerRef.findFirst({
      where: {
        provider: "zuora",
        entityType: "subscription",
        externalId: subscriptionId,
      },
    });

    if (!subscriptionRef) {
      this.logger.warn(`Subscription ${subscriptionId} not found in Zentla`);
      return;
    }

    workspaceId = subscriptionRef.workspaceId;

    // Update subscription status
    const subscription = await this.prisma.subscription.update({
      where: { id: subscriptionRef.entityId },
      data: {
        status: "canceled",
        canceledAt: new Date(),
      },
    });

    // Revoke entitlements by deleting them
    await this.prisma.entitlement.deleteMany({
      where: { subscriptionId: subscription.id },
    });

    // Emit outbox event
    await this.outboxService.createEvent({
      workspaceId,
      eventType: "subscription.canceled",
      aggregateType: "subscription",
      aggregateId: subscription.id,
      payload: {
        subscriptionId: subscription.id,
        status: "canceled",
        source: "zuora",
      },
    });

    this.logger.log(`Cancelled subscription ${subscription.id}`);
  }

  private async handlePaymentSuccess(
    event: ZuoraCalloutNotification,
    workspaceId?: string,
  ): Promise<void> {
    const invoiceId = event.invoiceId;
    const accountId = event.accountId;

    if (!accountId) {
      this.logger.warn("Missing accountId in payment event");
      return;
    }

    // Find customer reference to get workspace
    const customerRef = await this.prisma.providerRef.findFirst({
      where: {
        provider: "zuora",
        entityType: "customer",
        externalId: accountId,
      },
    });

    if (!customerRef) {
      this.logger.warn(`Customer ${accountId} not found`);
      return;
    }

    workspaceId = customerRef.workspaceId;

    // Emit outbox event
    await this.outboxService.createEvent({
      workspaceId,
      eventType: "invoice.paid",
      aggregateType: "invoice",
      aggregateId: invoiceId || `zuora_inv_${Date.now()}`,
      payload: {
        invoiceId,
        accountId,
        customerId: customerRef.entityId,
        source: "zuora",
      },
    });

    this.logger.log(`Processed payment success for invoice ${invoiceId}`);
  }

  private async handlePaymentFailed(
    event: ZuoraCalloutNotification,
    workspaceId?: string,
  ): Promise<void> {
    const invoiceId = event.invoiceId;
    const accountId = event.accountId;

    if (!accountId) {
      this.logger.warn("Missing accountId in payment failed event");
      return;
    }

    // Find customer reference to get workspace
    const customerRef = await this.prisma.providerRef.findFirst({
      where: {
        provider: "zuora",
        entityType: "customer",
        externalId: accountId,
      },
    });

    if (!customerRef) {
      this.logger.warn(`Customer ${accountId} not found`);
      return;
    }

    workspaceId = customerRef.workspaceId;

    // Find subscriptions for this customer and update status
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        customerId: customerRef.entityId,
        status: "active",
      },
    });

    for (const subscription of subscriptions) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "payment_failed" },
      });
    }

    // Emit outbox event
    await this.outboxService.createEvent({
      workspaceId,
      eventType: "invoice.payment_failed",
      aggregateType: "invoice",
      aggregateId: invoiceId || `zuora_inv_${Date.now()}`,
      payload: {
        invoiceId,
        accountId,
        customerId: customerRef.entityId,
        source: "zuora",
      },
    });

    this.logger.log(`Processed payment failure for invoice ${invoiceId}`);
  }
}
