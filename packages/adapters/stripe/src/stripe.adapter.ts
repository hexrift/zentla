import Stripe from "stripe";
import type {
  BillingProvider,
  SyncOfferResult,
  SyncPromotionResult,
  ChangeSubscriptionResult,
  PromoCodeValidation,
  Offer,
  OfferVersion,
  Promotion,
  PromotionVersion,
  PromotionConfig,
  ProviderRef,
  CheckoutSession,
  CreateCheckoutParams,
  PortalSession,
  CreatePortalSessionParams,
  SubscriptionData,
  CancelSubscriptionInput,
  ChangeSubscriptionInput,
  DomainEvent,
  OfferConfig,
  PricingConfig,
  CreateCustomerParams,
  UpdateCustomerParams,
  CustomerResult,
  CreateRefundParams,
  RefundResult,
} from "@zentla/core";
import type { StripeConfig } from "./stripe.config";
import { validateStripeConfig } from "./stripe.config";

export class StripeAdapter implements BillingProvider {
  readonly name = "stripe" as const;
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(config: StripeConfig) {
    const validatedConfig = validateStripeConfig(config);
    this.stripe = new Stripe(validatedConfig.secretKey, {
      apiVersion: "2023-10-16",
      typescript: true,
    });
    this.webhookSecret = validatedConfig.webhookSecret;
  }

  /**
   * Get Stripe account info for connection verification.
   */
  async getAccountInfo(): Promise<{
    id: string;
    name: string | null;
    email: string | null;
  }> {
    const account = await this.stripe.accounts.retrieve();
    return {
      id: account.id,
      name: account.business_profile?.name ?? null,
      email: account.email ?? null,
    };
  }

  async syncOffer(
    offer: Offer,
    version: OfferVersion,
    existingRef?: ProviderRef,
  ): Promise<SyncOfferResult> {
    const config = version.config as unknown as OfferConfig;
    const pricing = config.pricing;

    let product: Stripe.Product;
    let price: Stripe.Price;

    if (existingRef) {
      // Update existing product
      // Note: Stripe doesn't accept empty string for description, only omit or non-empty
      product = await this.stripe.products.update(existingRef.externalId, {
        name: offer.name,
        ...(offer.description && { description: offer.description }),
        metadata: {
          zentla_offer_id: offer.id,
          zentla_version_id: version.id,
          zentla_workspace_id: offer.workspaceId,
        },
      });

      // Create new price (prices are immutable in Stripe)
      price = await this.createPrice(product.id, pricing, offer.id, version.id);
    } else {
      // Create new product
      // Note: Stripe doesn't accept empty string for description, only omit or non-empty
      product = await this.stripe.products.create({
        name: offer.name,
        ...(offer.description && { description: offer.description }),
        metadata: {
          zentla_offer_id: offer.id,
          zentla_version_id: version.id,
          zentla_workspace_id: offer.workspaceId,
        },
      });

      // Create price
      price = await this.createPrice(product.id, pricing, offer.id, version.id);
    }

    return {
      productRef: {
        id: crypto.randomUUID(),
        workspaceId: offer.workspaceId,
        entityType: "product",
        entityId: offer.id,
        provider: "stripe",
        externalId: product.id,
        createdAt: new Date(),
      },
      priceRef: {
        id: crypto.randomUUID(),
        workspaceId: offer.workspaceId,
        entityType: "price",
        entityId: version.id,
        provider: "stripe",
        externalId: price.id,
        createdAt: new Date(),
      },
    };
  }

  /**
   * Archive a product in Stripe by setting active=false.
   * This prevents new subscriptions but doesn't affect existing ones.
   */
  async archiveProduct(productId: string): Promise<void> {
    await this.stripe.products.update(productId, {
      active: false,
    });
  }

  /**
   * Reactivate an archived product in Stripe.
   */
  async reactivateProduct(productId: string): Promise<void> {
    await this.stripe.products.update(productId, {
      active: true,
    });
  }

  async createCustomer(params: CreateCustomerParams): Promise<CustomerResult> {
    const customer = await this.stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: {
        zentla_workspace_id: params.workspaceId,
        zentla_customer_id: params.customerId,
        ...params.metadata,
      },
    });

    return { externalId: customer.id };
  }

  async updateCustomer(
    externalId: string,
    params: UpdateCustomerParams,
  ): Promise<CustomerResult> {
    await this.stripe.customers.update(externalId, {
      ...(params.email && { email: params.email }),
      ...(params.name !== undefined && { name: params.name ?? "" }),
      ...(params.metadata && { metadata: params.metadata }),
    });

    return { externalId };
  }

  async deleteCustomer(externalId: string): Promise<void> {
    await this.stripe.customers.del(externalId);
  }

  private async createPrice(
    productId: string,
    pricing: PricingConfig,
    offerId: string,
    versionId: string,
  ): Promise<Stripe.Price> {
    const priceData: Stripe.PriceCreateParams = {
      product: productId,
      currency: pricing.currency.toLowerCase(),
      metadata: {
        zentla_offer_id: offerId,
        zentla_version_id: versionId,
      },
    };

    if (pricing.interval) {
      // Recurring price
      priceData.recurring = {
        interval: pricing.interval,
        interval_count: pricing.intervalCount ?? 1,
        usage_type: pricing.usageType === "metered" ? "metered" : "licensed",
      };
    }

    if (pricing.model === "flat" || pricing.model === "per_unit") {
      priceData.unit_amount = pricing.amount;
    } else if (
      (pricing.model === "tiered" || pricing.model === "volume") &&
      pricing.tiers
    ) {
      priceData.billing_scheme = "tiered";
      priceData.tiers_mode =
        pricing.model === "volume" ? "volume" : "graduated";
      priceData.tiers = pricing.tiers.map(
        (tier: {
          upTo: number | null;
          unitAmount: number;
          flatAmount?: number;
        }) => ({
          up_to: tier.upTo === null ? "inf" : tier.upTo,
          unit_amount: tier.unitAmount,
          flat_amount: tier.flatAmount,
        }),
      );
    }

    return this.stripe.prices.create(priceData);
  }

  async createCheckoutSession(
    params: CreateCheckoutParams,
  ): Promise<CheckoutSession> {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      line_items: [
        {
          price: params.offerVersionId, // This should be the Stripe price ID
          quantity: 1,
        },
      ],
      metadata: {
        zentla_workspace_id: params.workspaceId,
        zentla_offer_id: params.offerId,
        zentla_checkout_id: (params.metadata?.checkoutId as string) ?? "",
        ...(params.metadata as Record<string, string>),
      },
    };

    if (params.customerId) {
      sessionParams.customer = params.customerId; // Stripe customer ID
    } else if (params.customerEmail) {
      sessionParams.customer_email = params.customerEmail;
    }

    if (params.promotionCodeId) {
      // Apply a specific promotion code
      sessionParams.discounts = [{ promotion_code: params.promotionCodeId }];
    } else if (params.allowPromotionCodes) {
      // Allow user to enter a code at checkout
      sessionParams.allow_promotion_codes = true;
    }

    // Always set subscription_data with metadata so the subscription has workspace ID
    sessionParams.subscription_data = {
      metadata: {
        zentla_workspace_id: params.workspaceId,
        zentla_offer_id: params.offerId,
        zentla_checkout_id: (params.metadata?.checkoutId as string) ?? "",
      },
      ...(params.trialDays && { trial_period_days: params.trialDays }),
    };

    const session = await this.stripe.checkout.sessions.create(sessionParams);

    return {
      id: session.id,
      url: session.url ?? "",
      expiresAt: new Date(session.expires_at * 1000),
    };
  }

  /**
   * Create a PaymentIntent for immediate payment collection.
   * Used in headless checkout flow when payment is required upfront.
   */
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    customerId?: string;
    metadata?: Record<string, string | undefined>;
  }): Promise<{ id: string; clientSecret: string }> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      customer: params.customerId,
      automatic_payment_methods: { enabled: true },
      metadata: Object.fromEntries(
        Object.entries(params.metadata ?? {}).filter(
          ([, v]) => v !== undefined,
        ),
      ) as Record<string, string>,
    });

    return {
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret ?? "",
    };
  }

  /**
   * Create a SetupIntent for collecting payment method for future use.
   * Used in headless checkout flow for trials without upfront payment.
   */
  async createSetupIntent(params: {
    customerId?: string;
    metadata?: Record<string, string | undefined>;
  }): Promise<{ id: string; clientSecret: string }> {
    const setupIntent = await this.stripe.setupIntents.create({
      customer: params.customerId,
      automatic_payment_methods: { enabled: true },
      metadata: Object.fromEntries(
        Object.entries(params.metadata ?? {}).filter(
          ([, v]) => v !== undefined,
        ),
      ) as Record<string, string>,
    });

    return {
      id: setupIntent.id,
      clientSecret: setupIntent.client_secret ?? "",
    };
  }

  async getSubscription(ref: ProviderRef): Promise<SubscriptionData> {
    const subscription = await this.stripe.subscriptions.retrieve(
      ref.externalId,
    );

    return this.mapSubscription(subscription);
  }

  async cancelSubscription(
    ref: ProviderRef,
    params: CancelSubscriptionInput,
  ): Promise<void> {
    if (params.cancelAtPeriodEnd) {
      await this.stripe.subscriptions.update(ref.externalId, {
        cancel_at_period_end: true,
        metadata: params.reason ? { cancel_reason: params.reason } : undefined,
      });
    } else {
      await this.stripe.subscriptions.cancel(ref.externalId);
    }
  }

  async changeSubscription(
    ref: ProviderRef,
    params: ChangeSubscriptionInput,
  ): Promise<ChangeSubscriptionResult> {
    const subscription = await this.stripe.subscriptions.retrieve(
      ref.externalId,
    );
    const currentItem = subscription.items.data[0];

    if (!currentItem) {
      throw new Error("Subscription has no items");
    }

    const prorationBehavior = this.mapProrationBehavior(
      params.prorationBehavior,
    );

    const updated = await this.stripe.subscriptions.update(ref.externalId, {
      items: [
        {
          id: currentItem.id,
          price: params.newOfferVersionId, // This should be the new Stripe price ID
        },
      ],
      proration_behavior: prorationBehavior,
    });

    return {
      subscriptionId: updated.id,
      effectiveDate: new Date(updated.current_period_start * 1000),
    };
  }

  async createPortalSession(
    params: CreatePortalSessionParams,
  ): Promise<PortalSession> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: params.customerId, // Stripe customer ID
      return_url: params.returnUrl,
    });

    return {
      id: session.id,
      url: session.url,
    };
  }

  verifyWebhook(payload: Buffer, signature: string): boolean {
    try {
      this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret,
      );
      return true;
    } catch {
      return false;
    }
  }

  parseWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    );
  }

  normalizeEvent(rawEvent: unknown): DomainEvent | null {
    const event = rawEvent as Stripe.Event;

    switch (event.type) {
      case "checkout.session.completed":
        return this.normalizeCheckoutCompleted(event);
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        return this.normalizeSubscriptionEvent(event);
      case "invoice.paid":
      case "invoice.payment_failed":
        return this.normalizeInvoiceEvent(event);
      default:
        return null;
    }
  }

  async validatePromoCode(
    code: string,
    _offerId: string,
  ): Promise<PromoCodeValidation> {
    try {
      const promotionCodes = await this.stripe.promotionCodes.list({
        code,
        active: true,
        limit: 1,
      });

      const promoCode = promotionCodes.data[0];
      if (!promoCode) {
        return { valid: false, code };
      }

      const coupon = promoCode.coupon;

      return {
        valid: true,
        code,
        discountType: coupon.percent_off ? "percent" : "amount",
        discountValue: coupon.percent_off ?? coupon.amount_off ?? 0,
        expiresAt: promoCode.expires_at
          ? new Date(promoCode.expires_at * 1000)
          : undefined,
        maxRedemptions: promoCode.max_redemptions ?? undefined,
        currentRedemptions: promoCode.times_redeemed,
      };
    } catch {
      return { valid: false, code };
    }
  }

  async syncPromotion(
    promotion: Promotion,
    version: PromotionVersion,
    existingCouponRef?: ProviderRef,
  ): Promise<SyncPromotionResult> {
    const config = version.config as unknown as PromotionConfig;

    let coupon: Stripe.Coupon;
    let promotionCode: Stripe.PromotionCode;

    // Build coupon params
    const couponParams: Stripe.CouponCreateParams = {
      name: promotion.name,
      metadata: {
        zentla_promotion_id: promotion.id,
        zentla_promotion_version_id: version.id,
        zentla_workspace_id: promotion.workspaceId,
      },
    };

    // Set discount type
    if (config.discountType === "percent") {
      couponParams.percent_off = config.discountValue;
    } else if (config.discountType === "fixed_amount") {
      couponParams.amount_off = config.discountValue;
      couponParams.currency = config.currency?.toLowerCase() ?? "usd";
    }
    // Note: free_trial_days is handled at checkout, not as a coupon

    // Set duration
    if (config.duration === "once") {
      couponParams.duration = "once";
    } else if (config.duration === "repeating" && config.durationInMonths) {
      couponParams.duration = "repeating";
      couponParams.duration_in_months = config.durationInMonths;
    } else {
      couponParams.duration = "forever";
    }

    // Set redemption limits (on coupon level)
    if (config.maxRedemptions) {
      couponParams.max_redemptions = config.maxRedemptions;
    }

    // Set expiration
    if (config.validUntil) {
      couponParams.redeem_by = Math.floor(
        new Date(config.validUntil).getTime() / 1000,
      );
    }

    if (existingCouponRef) {
      // Update existing coupon metadata only (most coupon fields are immutable in Stripe)
      coupon = await this.stripe.coupons.update(existingCouponRef.externalId, {
        name: promotion.name,
        metadata: couponParams.metadata,
      });
    } else {
      // Create new coupon
      coupon = await this.stripe.coupons.create(couponParams);
    }

    // Create promotion code (always create new one for the promotion code)
    const promotionCodeParams: Stripe.PromotionCodeCreateParams = {
      coupon: coupon.id,
      code: promotion.code,
      active: true,
      metadata: {
        zentla_promotion_id: promotion.id,
        zentla_promotion_version_id: version.id,
        zentla_workspace_id: promotion.workspaceId,
      },
    };

    // Set per-customer limits
    if (config.maxRedemptionsPerCustomer) {
      promotionCodeParams.restrictions = {
        ...promotionCodeParams.restrictions,
        first_time_transaction: config.maxRedemptionsPerCustomer === 1,
      };
    }

    // Set minimum amount
    if (config.minimumAmount) {
      promotionCodeParams.restrictions = {
        ...promotionCodeParams.restrictions,
        minimum_amount: config.minimumAmount,
        minimum_amount_currency: config.currency?.toLowerCase() ?? "usd",
      };
    }

    // Set max redemptions on promotion code
    if (config.maxRedemptions) {
      promotionCodeParams.max_redemptions = config.maxRedemptions;
    }

    // Set validity dates
    if (config.validUntil) {
      promotionCodeParams.expires_at = Math.floor(
        new Date(config.validUntil).getTime() / 1000,
      );
    }

    try {
      promotionCode =
        await this.stripe.promotionCodes.create(promotionCodeParams);
    } catch (error) {
      // If promotion code already exists, try to find and update it
      const existingCodes = await this.stripe.promotionCodes.list({
        code: promotion.code,
        limit: 1,
      });

      if (existingCodes.data[0]) {
        // Update the existing promotion code (limited fields can be updated)
        promotionCode = await this.stripe.promotionCodes.update(
          existingCodes.data[0].id,
          {
            active: true,
            metadata: promotionCodeParams.metadata,
          },
        );
      } else {
        throw error;
      }
    }

    return {
      couponRef: {
        id: crypto.randomUUID(),
        workspaceId: promotion.workspaceId,
        entityType: "coupon",
        entityId: promotion.id,
        provider: "stripe",
        externalId: coupon.id,
        createdAt: new Date(),
      },
      promotionCodeRef: {
        id: crypto.randomUUID(),
        workspaceId: promotion.workspaceId,
        entityType: "promotion_code",
        entityId: version.id,
        provider: "stripe",
        externalId: promotionCode.id,
        createdAt: new Date(),
      },
    };
  }

  private mapSubscription(subscription: Stripe.Subscription): SubscriptionData {
    return {
      id: subscription.id,
      status: this.mapSubscriptionStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAt: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000)
        : undefined,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : undefined,
      items: subscription.items.data.map((item) => ({
        id: item.id,
        priceId: item.price.id,
        quantity: item.quantity ?? 1,
      })),
    };
  }

  private mapSubscriptionStatus(
    status: Stripe.Subscription.Status,
  ): SubscriptionData["status"] {
    const statusMap: Record<
      Stripe.Subscription.Status,
      SubscriptionData["status"]
    > = {
      active: "active",
      canceled: "canceled",
      incomplete: "pending",
      incomplete_expired: "expired",
      past_due: "payment_failed",
      paused: "paused",
      trialing: "trialing",
      unpaid: "suspended",
    };
    return statusMap[status];
  }

  private mapProrationBehavior(
    behavior?: "create_prorations" | "none" | "always_invoice",
  ): Stripe.SubscriptionUpdateParams.ProrationBehavior {
    switch (behavior) {
      case "none":
        return "none";
      case "always_invoice":
        return "always_invoice";
      default:
        return "create_prorations";
    }
  }

  private normalizeCheckoutCompleted(event: Stripe.Event): DomainEvent | null {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata ?? {};

    return {
      id: crypto.randomUUID(),
      type: "checkout.completed",
      workspaceId: metadata.zentla_workspace_id ?? "",
      aggregateType: "checkout",
      aggregateId: metadata.zentla_checkout_id ?? session.id,
      data: {
        sessionId: session.id,
        customerId: session.customer as string,
        subscriptionId: session.subscription as string,
        amountTotal: session.amount_total,
        currency: session.currency,
      },
      metadata: {
        version: 1,
        source: "stripe",
        provider: "stripe",
      },
      occurredAt: new Date(event.created * 1000),
    };
  }

  private normalizeSubscriptionEvent(event: Stripe.Event): DomainEvent | null {
    const subscription = event.data.object as Stripe.Subscription;
    const metadata = subscription.metadata ?? {};

    const eventTypeMap: Record<string, string> = {
      "customer.subscription.created": "subscription.created",
      "customer.subscription.updated": "subscription.updated",
      "customer.subscription.deleted": "subscription.canceled",
    };

    return {
      id: crypto.randomUUID(),
      type: eventTypeMap[event.type] ?? event.type,
      workspaceId: metadata.zentla_workspace_id ?? "",
      aggregateType: "subscription",
      aggregateId: subscription.id,
      data: {
        subscriptionId: subscription.id,
        customerId: subscription.customer as string,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAt: subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000)
          : null,
      },
      metadata: {
        version: 1,
        source: "stripe",
        provider: "stripe",
      },
      occurredAt: new Date(event.created * 1000),
    };
  }

  private normalizeInvoiceEvent(event: Stripe.Event): DomainEvent | null {
    const invoice = event.data.object as Stripe.Invoice;
    const metadata = invoice.metadata ?? {};

    const eventTypeMap: Record<string, string> = {
      "invoice.paid": "invoice.paid",
      "invoice.payment_failed": "invoice.payment_failed",
    };

    return {
      id: crypto.randomUUID(),
      type: eventTypeMap[event.type] ?? event.type,
      workspaceId: metadata.zentla_workspace_id ?? "",
      aggregateType: "invoice",
      aggregateId: invoice.id ?? "",
      data: {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription as string,
        customerId: invoice.customer as string,
        amountPaid: invoice.amount_paid,
        amountDue: invoice.amount_due,
        currency: invoice.currency,
        status: invoice.status,
      },
      metadata: {
        version: 1,
        source: "stripe",
        provider: "stripe",
      },
      occurredAt: new Date(event.created * 1000),
    };
  }

  /**
   * Check if a webhook endpoint is configured for the given URL pattern.
   * Used to validate that webhooks are set up before allowing checkouts.
   */
  async hasWebhookConfigured(urlPattern: string): Promise<boolean> {
    const webhooks = await this.stripe.webhookEndpoints.list({ limit: 100 });
    return webhooks.data.some(
      (w) => w.url.includes(urlPattern) && w.status === "enabled",
    );
  }

  /**
   * List all customers from Stripe for sync purposes.
   */
  async listCustomers(
    limit = 100,
    startingAfter?: string,
  ): Promise<{ customers: Stripe.Customer[]; hasMore: boolean }> {
    const result = await this.stripe.customers.list({
      limit,
      ...(startingAfter && { starting_after: startingAfter }),
    });
    return {
      customers: result.data,
      hasMore: result.has_more,
    };
  }

  /**
   * List all subscriptions from Stripe for sync purposes.
   */
  async listSubscriptions(
    limit = 100,
    startingAfter?: string,
  ): Promise<{ subscriptions: Stripe.Subscription[]; hasMore: boolean }> {
    const result = await this.stripe.subscriptions.list({
      limit,
      status: "all",
      ...(startingAfter && { starting_after: startingAfter }),
    });
    return {
      subscriptions: result.data,
      hasMore: result.has_more,
    };
  }

  /**
   * Get a raw Stripe subscription by ID.
   */
  async getStripeSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Get a raw Stripe customer by ID.
   */
  async getStripeCustomer(customerId: string): Promise<Stripe.Customer> {
    const customer = await this.stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      throw new Error(`Customer ${customerId} has been deleted`);
    }
    return customer as Stripe.Customer;
  }

  /**
   * Get PDF download URL for an invoice.
   */
  async getInvoicePdfUrl(invoiceId: string): Promise<string | null> {
    const invoice = await this.stripe.invoices.retrieve(invoiceId);
    return invoice.invoice_pdf ?? null;
  }

  /**
   * Void an open or draft invoice.
   */
  async voidInvoice(invoiceId: string): Promise<void> {
    await this.stripe.invoices.voidInvoice(invoiceId);
  }

  /**
   * Trigger a payment attempt for an open invoice.
   */
  async payInvoice(invoiceId: string): Promise<void> {
    await this.stripe.invoices.pay(invoiceId);
  }

  /**
   * Create a refund for a charge or payment intent.
   */
  async createRefund(params: CreateRefundParams): Promise<RefundResult> {
    const refundParams: Stripe.RefundCreateParams = {};

    // If invoiceId provided, we need to find the charge from the invoice
    if (params.invoiceId) {
      const invoice = await this.stripe.invoices.retrieve(params.invoiceId);
      if (invoice.charge && typeof invoice.charge === "string") {
        refundParams.charge = invoice.charge;
      } else if (
        invoice.payment_intent &&
        typeof invoice.payment_intent === "string"
      ) {
        refundParams.payment_intent = invoice.payment_intent;
      } else {
        throw new Error("Invoice has no associated charge or payment intent");
      }
    } else if (params.chargeId) {
      refundParams.charge = params.chargeId;
    } else if (params.paymentIntentId) {
      refundParams.payment_intent = params.paymentIntentId;
    } else {
      throw new Error(
        "Must provide invoiceId, chargeId, or paymentIntentId for refund",
      );
    }

    // Optional amount (defaults to full amount)
    if (params.amount) {
      refundParams.amount = params.amount;
    }

    // Optional reason
    if (params.reason) {
      refundParams.reason = params.reason;
    }

    const refund = await this.stripe.refunds.create(refundParams);

    return {
      id: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      status: this.mapRefundStatus(refund.status),
      chargeId:
        typeof refund.charge === "string" ? refund.charge : refund.charge?.id,
      paymentIntentId:
        typeof refund.payment_intent === "string"
          ? refund.payment_intent
          : refund.payment_intent?.id,
      customerId: undefined, // Will be resolved from charge/payment_intent if needed
    };
  }

  private mapRefundStatus(
    status: string | null,
  ): "pending" | "succeeded" | "failed" | "canceled" {
    switch (status) {
      case "succeeded":
        return "succeeded";
      case "pending":
        return "pending";
      case "failed":
        return "failed";
      case "canceled":
        return "canceled";
      default:
        return "pending";
    }
  }
}
