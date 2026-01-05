import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { BillingService, ProviderType } from "../billing/billing.service";
import { ProviderRefService } from "../billing/provider-ref.service";
import type { StripeAdapter } from "@zentla/stripe-adapter";
import type Stripe from "stripe";

const PROVIDER: ProviderType = "stripe";

export interface SyncResult {
  customersImported: number;
  customersSkipped: number;
  subscriptionsImported: number;
  subscriptionsSkipped: number;
  errors: string[];
}

@Injectable()
export class StripeSyncService {
  private readonly logger = new Logger(StripeSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly providerRefService: ProviderRefService,
  ) {}

  /**
   * Sync customers and subscriptions from Stripe to Zentla.
   * This imports existing Stripe data that was created before webhook was configured.
   */
  async syncFromStripe(workspaceId: string): Promise<SyncResult> {
    // Get workspace settings for billing provider
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });
    const workspaceSettings = workspace?.settings as
      | {
          stripeSecretKey?: string;
          stripeWebhookSecret?: string;
          zuoraClientId?: string;
          zuoraClientSecret?: string;
          zuoraBaseUrl?: string;
        }
      | undefined;

    if (
      !this.billingService.isConfiguredForWorkspace(
        workspaceId,
        PROVIDER,
        workspaceSettings,
      )
    ) {
      throw new BadRequestException(`${PROVIDER} not configured`);
    }

    const stripeAdapter = this.billingService.getProviderForWorkspace(
      workspaceId,
      PROVIDER,
      workspaceSettings,
    ) as StripeAdapter;
    const result: SyncResult = {
      customersImported: 0,
      customersSkipped: 0,
      subscriptionsImported: 0,
      subscriptionsSkipped: 0,
      errors: [],
    };

    // First, sync all customers
    this.logger.log("Starting customer sync from Stripe...");
    let hasMoreCustomers = true;
    let customerCursor: string | undefined;

    while (hasMoreCustomers) {
      const { customers, hasMore } = await stripeAdapter.listCustomers(
        100,
        customerCursor,
      );

      for (const stripeCustomer of customers) {
        try {
          await this.syncCustomer(workspaceId, stripeCustomer, result);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          result.errors.push(`Customer ${stripeCustomer.id}: ${message}`);
        }
      }

      hasMoreCustomers = hasMore;
      if (customers.length > 0) {
        customerCursor = customers[customers.length - 1].id;
      }
    }

    // Then, sync all subscriptions
    this.logger.log("Starting subscription sync from Stripe...");
    let hasMoreSubscriptions = true;
    let subscriptionCursor: string | undefined;

    while (hasMoreSubscriptions) {
      const { subscriptions, hasMore } = await stripeAdapter.listSubscriptions(
        100,
        subscriptionCursor,
      );

      for (const stripeSubscription of subscriptions) {
        try {
          await this.syncSubscription(workspaceId, stripeSubscription, result);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          result.errors.push(
            `Subscription ${stripeSubscription.id}: ${message}`,
          );
        }
      }

      hasMoreSubscriptions = hasMore;
      if (subscriptions.length > 0) {
        subscriptionCursor = subscriptions[subscriptions.length - 1].id;
      }
    }

    this.logger.log(
      `Sync complete: ${result.customersImported} customers, ${result.subscriptionsImported} subscriptions imported`,
    );

    return result;
  }

  private async syncCustomer(
    workspaceId: string,
    stripeCustomer: Stripe.Customer,
    result: SyncResult,
  ): Promise<void> {
    // Check if customer already linked
    const existingRef = await this.providerRefService.findByExternalId(
      workspaceId,
      "stripe",
      "customer",
      stripeCustomer.id,
    );

    if (existingRef) {
      result.customersSkipped++;
      return;
    }

    // Check if customer exists by email
    const email = stripeCustomer.email;
    if (!email) {
      result.errors.push(`Customer ${stripeCustomer.id}: No email, skipping`);
      result.customersSkipped++;
      return;
    }

    let customer = await this.prisma.customer.findFirst({
      where: { workspaceId, email },
    });

    if (customer) {
      // Check if this Zentla customer already has a Stripe provider ref
      const existingCustomerRef = await this.providerRefService.findByEntity(
        workspaceId,
        "customer",
        customer.id,
        "stripe",
      );

      if (existingCustomerRef) {
        // Customer already linked to a different Stripe customer, skip
        result.errors.push(
          `Customer ${stripeCustomer.id}: Zentla customer ${customer.email} already linked to Stripe customer ${existingCustomerRef.externalId}`,
        );
        result.customersSkipped++;
        return;
      }
    } else {
      // Create new customer
      customer = await this.prisma.customer.create({
        data: {
          workspaceId,
          email,
          name: stripeCustomer.name ?? undefined,
          metadata: {
            stripeCustomerId: stripeCustomer.id,
            source: "stripe_sync",
          },
        },
      });
    }

    // Create provider ref
    await this.providerRefService.create({
      workspaceId,
      entityType: "customer",
      entityId: customer.id,
      provider: "stripe",
      externalId: stripeCustomer.id,
    });

    result.customersImported++;
  }

  private async syncSubscription(
    workspaceId: string,
    stripeSubscription: Stripe.Subscription,
    result: SyncResult,
  ): Promise<void> {
    // Check if subscription already linked
    const existingRef = await this.providerRefService.findByExternalId(
      workspaceId,
      "stripe",
      "subscription",
      stripeSubscription.id,
    );

    if (existingRef) {
      result.subscriptionsSkipped++;
      return;
    }

    // Get customer ref
    const stripeCustomerId = stripeSubscription.customer as string;
    const customerRef = await this.providerRefService.findByExternalId(
      workspaceId,
      "stripe",
      "customer",
      stripeCustomerId,
    );

    if (!customerRef) {
      result.errors.push(
        `Subscription ${stripeSubscription.id}: Customer ${stripeCustomerId} not synced`,
      );
      result.subscriptionsSkipped++;
      return;
    }

    // Get price ref
    const priceId = stripeSubscription.items.data[0]?.price.id;
    if (!priceId) {
      result.errors.push(
        `Subscription ${stripeSubscription.id}: No price found`,
      );
      result.subscriptionsSkipped++;
      return;
    }

    const priceRef = await this.providerRefService.findByExternalId(
      workspaceId,
      "stripe",
      "price",
      priceId,
    );

    if (!priceRef) {
      result.errors.push(
        `Subscription ${stripeSubscription.id}: Price ${priceId} not linked to Zentla offer`,
      );
      result.subscriptionsSkipped++;
      return;
    }

    // Get offer version
    const offerVersion = await this.prisma.offerVersion.findUnique({
      where: { id: priceRef.entityId },
      include: { offer: true },
    });

    if (!offerVersion) {
      result.errors.push(
        `Subscription ${stripeSubscription.id}: Offer version not found`,
      );
      result.subscriptionsSkipped++;
      return;
    }

    // Map Stripe status to Zentla status
    const statusMap: Record<string, string> = {
      active: "active",
      past_due: "payment_failed",
      canceled: "canceled",
      unpaid: "suspended",
      incomplete: "pending",
      incomplete_expired: "expired",
      trialing: "trialing",
      paused: "paused",
    };

    const status = statusMap[stripeSubscription.status] ?? "pending";

    // Create subscription
    const subscription = await this.prisma.subscription.create({
      data: {
        workspaceId,
        customerId: customerRef.entityId,
        offerId: offerVersion.offer.id,
        offerVersionId: offerVersion.id,
        status: status as any,
        currentPeriodStart: new Date(
          stripeSubscription.current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(
          stripeSubscription.current_period_end * 1000,
        ),
        cancelAt: stripeSubscription.cancel_at
          ? new Date(stripeSubscription.cancel_at * 1000)
          : null,
        canceledAt: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : null,
        trialStart: stripeSubscription.trial_start
          ? new Date(stripeSubscription.trial_start * 1000)
          : null,
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        metadata: {
          stripeSubscriptionId: stripeSubscription.id,
          source: "stripe_sync",
        },
      },
    });

    // Create provider ref
    await this.providerRefService.create({
      workspaceId,
      entityType: "subscription",
      entityId: subscription.id,
      provider: "stripe",
      externalId: stripeSubscription.id,
    });

    // Create entitlements from offer config
    const config = offerVersion.config as any;
    if (config?.entitlements) {
      for (const entitlement of config.entitlements) {
        await this.prisma.entitlement.create({
          data: {
            workspaceId,
            customerId: customerRef.entityId,
            subscriptionId: subscription.id,
            featureKey: entitlement.featureKey,
            value: String(entitlement.value),
            valueType: entitlement.valueType,
          },
        });
      }
    }

    result.subscriptionsImported++;
  }
}
