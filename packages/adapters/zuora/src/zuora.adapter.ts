import {
  type BillingProvider,
  type SyncOfferResult,
  type ChangeSubscriptionResult,
  type PromoCodeValidation,
  type Offer,
  type OfferVersion,
  type ProviderRef,
  type CheckoutSession,
  type CreateCheckoutParams,
  type PortalSession,
  type CreatePortalSessionParams,
  type SubscriptionData,
  type CancelSubscriptionInput,
  type ChangeSubscriptionInput,
  type DomainEvent,
  type CreateCustomerParams,
  type UpdateCustomerParams,
  type CustomerResult,
  type OfferConfig,
  type PricingConfig,
  BillingProviderError,
} from "@zentla/core";
import { type ZuoraConfig, validateZuoraConfig } from "./zuora.config";
import * as crypto from "crypto";

// Zuora API response types
interface ZuoraOAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  jti: string;
}

interface ZuoraAccountResponse {
  success: boolean;
  id?: string;
  accountNumber?: string;
  reasons?: Array<{ code: string; message: string }>;
}

interface ZuoraProductResponse {
  success: boolean;
  id?: string;
  reasons?: Array<{ code: string; message: string }>;
}

interface ZuoraRatePlanResponse {
  success: boolean;
  id?: string;
  reasons?: Array<{ code: string; message: string }>;
}

interface ZuoraRatePlanChargeResponse {
  success: boolean;
  id?: string;
  reasons?: Array<{ code: string; message: string }>;
}

interface ZuoraSubscriptionResponse {
  success: boolean;
  subscriptionId?: string;
  subscriptionNumber?: string;
  status?: string;
  contractEffectiveDate?: string;
  termStartDate?: string;
  termEndDate?: string;
  reasons?: Array<{ code: string; message: string }>;
}

interface ZuoraSubscription {
  id: string;
  subscriptionNumber: string;
  status: string;
  contractEffectiveDate: string;
  termStartDate: string;
  termEndDate: string;
  cancelledDate?: string;
  ratePlans: Array<{
    id: string;
    productRatePlanId: string;
    ratePlanCharges: Array<{
      id: string;
      productRatePlanChargeId: string;
      quantity?: number;
    }>;
  }>;
}

interface ZuoraHostedPageResponse {
  success: boolean;
  pageId?: string;
  url?: string;
  token?: string;
  reasons?: Array<{ code: string; message: string }>;
}

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

/**
 * Zuora Billing Provider Adapter
 *
 * Implements the BillingProvider interface for Zuora.
 *
 * Key Zuora concepts:
 * - Products contain Rate Plans
 * - Rate Plans contain Rate Plan Charges (the pricing)
 * - Accounts are customers
 * - Subscriptions reference Rate Plans
 */
export class ZuoraAdapter implements BillingProvider {
  readonly name = "zuora" as const;

  private readonly config: ZuoraConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(config: ZuoraConfig) {
    this.config = validateZuoraConfig(config);
  }

  /**
   * Get OAuth access token, refreshing if necessary.
   */
  private async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      this.tokenExpiresAt &&
      this.tokenExpiresAt > new Date()
    ) {
      return this.accessToken;
    }

    const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new BillingProviderError(
        `Failed to authenticate with Zuora: ${error}`,
        "zuora",
        "AUTH_FAILED",
      );
    }

    const data = (await response.json()) as ZuoraOAuthResponse;
    this.accessToken = data.access_token;
    // Set expiration 5 minutes before actual expiry for safety
    this.tokenExpiresAt = new Date(Date.now() + (data.expires_in - 300) * 1000);

    return this.accessToken;
  }

  /**
   * Make authenticated request to Zuora API.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const reasons = (data as { reasons?: Array<{ message: string }> })
        .reasons;
      const message =
        reasons?.map((r) => r.message).join(", ") || "Unknown error";
      throw new BillingProviderError(
        `Zuora API error: ${message}`,
        "zuora",
        "API_ERROR",
        data,
      );
    }

    return data as T;
  }

  /**
   * Sync an offer to Zuora as Product -> Rate Plan -> Rate Plan Charge.
   */
  async syncOffer(
    offer: Offer,
    version: OfferVersion,
    existingRef?: ProviderRef,
  ): Promise<SyncOfferResult> {
    const config = version.config as unknown as OfferConfig;
    const pricing = config.pricing;

    let productId: string;
    let ratePlanId: string;

    if (existingRef) {
      // Update existing product
      productId = existingRef.externalId;
      await this.request("PUT", `/v1/object/product/${productId}`, {
        Name: offer.name,
        Description: offer.description || "",
      });
    } else {
      // Create new product
      const productResponse = await this.request<ZuoraProductResponse>(
        "POST",
        "/v1/object/product",
        {
          Name: offer.name,
          Description: offer.description || "",
          EffectiveStartDate: new Date().toISOString().split("T")[0],
          EffectiveEndDate: "2099-12-31",
        },
      );

      if (!productResponse.success || !productResponse.id) {
        throw new BillingProviderError(
          `Failed to create Zuora product: ${productResponse.reasons?.[0]?.message}`,
          "zuora",
          "PRODUCT_CREATE_FAILED",
        );
      }

      productId = productResponse.id;
    }

    // Create Rate Plan for this version
    const ratePlanResponse = await this.request<ZuoraRatePlanResponse>(
      "POST",
      "/v1/object/product-rate-plan",
      {
        ProductId: productId,
        Name: `${offer.name} - v${version.version}`,
        Description: `Version ${version.version}`,
        EffectiveStartDate: new Date().toISOString().split("T")[0],
        EffectiveEndDate: "2099-12-31",
      },
    );

    if (!ratePlanResponse.success || !ratePlanResponse.id) {
      throw new BillingProviderError(
        `Failed to create Zuora rate plan: ${ratePlanResponse.reasons?.[0]?.message}`,
        "zuora",
        "RATE_PLAN_CREATE_FAILED",
      );
    }

    ratePlanId = ratePlanResponse.id;

    // Create Rate Plan Charge (the actual pricing)
    const chargeData = this.buildChargeData(pricing, offer.name);
    const chargeResponse = await this.request<ZuoraRatePlanChargeResponse>(
      "POST",
      "/v1/object/product-rate-plan-charge",
      {
        ProductRatePlanId: ratePlanId,
        ...chargeData,
      },
    );

    if (!chargeResponse.success || !chargeResponse.id) {
      throw new BillingProviderError(
        `Failed to create Zuora rate plan charge: ${chargeResponse.reasons?.[0]?.message}`,
        "zuora",
        "CHARGE_CREATE_FAILED",
      );
    }

    return {
      productRef: {
        id: crypto.randomUUID(),
        workspaceId: offer.workspaceId,
        entityType: "product",
        entityId: offer.id,
        provider: "zuora",
        externalId: productId,
        createdAt: new Date(),
      },
      priceRef: {
        id: crypto.randomUUID(),
        workspaceId: offer.workspaceId,
        entityType: "price",
        entityId: version.id,
        provider: "zuora",
        externalId: ratePlanId,
        createdAt: new Date(),
      },
    };
  }

  /**
   * Build Zuora charge data from pricing config.
   */
  private buildChargeData(
    pricing: PricingConfig,
    name: string,
  ): Record<string, unknown> {
    const charge: Record<string, unknown> = {
      Name: name,
      ChargeModel: this.mapChargeModel(pricing.model),
      ChargeType: pricing.interval ? "Recurring" : "OneTime",
      UOM: "Each",
    };

    // Set billing period for recurring charges
    if (pricing.interval) {
      charge.BillingPeriod = this.mapBillingPeriod(pricing.interval);
      charge.BillingTiming = "IN_ADVANCE";
    }

    // Set pricing based on model
    if (pricing.model === "flat" || pricing.model === "per_unit") {
      charge.DefaultQuantity = 1;
      charge.ListPriceBase = "Per_Billing_Period";
      // Zuora uses currency-specific pricing
      charge.Prices = [
        {
          Currency: pricing.currency.toUpperCase(),
          Price: pricing.amount / 100, // Zuora uses dollars, not cents
        },
      ];
    } else if (pricing.model === "tiered" && pricing.tiers) {
      charge.ChargeModel = "Tiered";
      charge.Tiers = pricing.tiers.map((tier, index) => ({
        Tier: index + 1,
        StartingUnit: index === 0 ? 0 : (pricing.tiers?.[index - 1]?.upTo ?? 0),
        EndingUnit: tier.upTo ?? null,
        Price: tier.unitAmount / 100,
        PriceFormat: "Per_Unit",
      }));
    }

    return charge;
  }

  /**
   * Map Zentla pricing model to Zuora charge model.
   */
  private mapChargeModel(
    model: string,
  ): "FlatFee" | "PerUnit" | "Tiered" | "Volume" {
    switch (model) {
      case "flat":
        return "FlatFee";
      case "per_unit":
        return "PerUnit";
      case "tiered":
        return "Tiered";
      case "volume":
        return "Volume";
      default:
        return "FlatFee";
    }
  }

  /**
   * Map Zentla interval to Zuora billing period.
   */
  private mapBillingPeriod(
    interval: string,
  ):
    | "Month"
    | "Quarter"
    | "Semi_Annual"
    | "Annual"
    | "Eighteen_Months"
    | "Two_Years"
    | "Three_Years"
    | "Five_Years"
    | "Week" {
    switch (interval) {
      case "week":
        return "Week";
      case "month":
        return "Month";
      case "quarter":
        return "Quarter";
      case "year":
        return "Annual";
      default:
        return "Month";
    }
  }

  /**
   * Create a customer (Account in Zuora).
   */
  async createCustomer(params: CreateCustomerParams): Promise<CustomerResult> {
    const response = await this.request<ZuoraAccountResponse>(
      "POST",
      "/v1/object/account",
      {
        Name: params.name || params.email,
        Currency: "USD",
        BillCycleDay: 1,
        Status: "Active",
        BillToContact: {
          FirstName: params.name?.split(" ")[0] || "Customer",
          LastName: params.name?.split(" ").slice(1).join(" ") || params.email,
          WorkEmail: params.email,
        },
        // Store Zentla metadata
        Notes: JSON.stringify({
          zentla_workspace_id: params.workspaceId,
          zentla_customer_id: params.customerId,
          ...params.metadata,
        }),
      },
    );

    if (!response.success || !response.id) {
      throw new BillingProviderError(
        `Failed to create Zuora account: ${response.reasons?.[0]?.message}`,
        "zuora",
        "ACCOUNT_CREATE_FAILED",
      );
    }

    return { externalId: response.id };
  }

  /**
   * Update a customer (Account in Zuora).
   */
  async updateCustomer(
    externalId: string,
    params: UpdateCustomerParams,
  ): Promise<CustomerResult> {
    const updateData: Record<string, unknown> = {};

    if (params.name) {
      updateData.Name = params.name;
    }

    if (params.email) {
      updateData.BillToContact = {
        WorkEmail: params.email,
      };
    }

    if (params.metadata) {
      // Fetch existing notes and merge
      const account = await this.request<{ Notes?: string }>(
        "GET",
        `/v1/object/account/${externalId}`,
      );
      const existingMetadata = account.Notes ? JSON.parse(account.Notes) : {};
      updateData.Notes = JSON.stringify({
        ...existingMetadata,
        ...params.metadata,
      });
    }

    await this.request("PUT", `/v1/object/account/${externalId}`, updateData);

    return { externalId };
  }

  /**
   * Delete a customer (set to Canceled in Zuora).
   */
  async deleteCustomer(externalId: string): Promise<void> {
    await this.request("PUT", `/v1/object/account/${externalId}`, {
      Status: "Canceled",
    });
  }

  /**
   * Create a checkout session using Zuora Hosted Pages.
   */
  async createCheckoutSession(
    params: CreateCheckoutParams,
  ): Promise<CheckoutSession> {
    // Zuora uses a different approach - we create a hosted page configuration
    // The actual checkout URL is generated by Zuora

    const pageParams: Record<string, unknown> = {
      pageId: "default_subscribe", // This should be configured in Zuora
      paymentGateway: "default",
      locale: "en_US",
      param_supportedTypes: "AmericanExpress,Discover,MasterCard,Visa",
    };

    // Add subscription fields
    if (params.offerId) {
      pageParams.field_productRatePlanId = params.offerVersionId;
    }

    // Add customer info
    if (params.customerId) {
      pageParams.field_accountId = params.customerId;
    }

    // Store metadata in session
    pageParams.field_passthrough = JSON.stringify({
      zentla_workspace_id: params.workspaceId,
      zentla_offer_id: params.offerId,
      zentla_checkout_id: params.metadata?.checkoutId,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      ...params.metadata,
    });

    const response = await this.request<ZuoraHostedPageResponse>(
      "POST",
      "/v1/hostedpages",
      pageParams,
    );

    if (!response.url) {
      throw new BillingProviderError(
        "Failed to generate Zuora hosted page URL",
        "zuora",
        "HOSTED_PAGE_FAILED",
      );
    }

    return {
      id: response.pageId || crypto.randomUUID(),
      url: response.url,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
  }

  /**
   * Get subscription details from Zuora.
   */
  async getSubscription(ref: ProviderRef): Promise<SubscriptionData> {
    const subscription = await this.request<ZuoraSubscription>(
      "GET",
      `/v1/subscriptions/${ref.externalId}`,
    );

    return this.mapSubscription(subscription);
  }

  /**
   * Cancel a subscription in Zuora.
   */
  async cancelSubscription(
    ref: ProviderRef,
    params: CancelSubscriptionInput,
  ): Promise<void> {
    if (params.cancelAtPeriodEnd) {
      // Cancel at term end
      await this.request("PUT", `/v1/subscriptions/${ref.externalId}/cancel`, {
        cancellationPolicy: "EndOfCurrentTerm",
        cancellationEffectiveDate: null,
      });
    } else {
      // Cancel immediately
      await this.request("PUT", `/v1/subscriptions/${ref.externalId}/cancel`, {
        cancellationPolicy: "SpecificDate",
        cancellationEffectiveDate: new Date().toISOString().split("T")[0],
        invoiceCollect: true,
      });
    }
  }

  /**
   * Change subscription to a different rate plan.
   */
  async changeSubscription(
    ref: ProviderRef,
    params: ChangeSubscriptionInput,
  ): Promise<ChangeSubscriptionResult> {
    // Get current subscription to find the rate plan to remove
    const currentSub = await this.request<ZuoraSubscription>(
      "GET",
      `/v1/subscriptions/${ref.externalId}`,
    );

    const currentRatePlan = currentSub.ratePlans[0];
    if (!currentRatePlan) {
      throw new BillingProviderError(
        "Subscription has no rate plans",
        "zuora",
        "NO_RATE_PLAN",
      );
    }

    // Create amendment to swap rate plans
    const response = await this.request<ZuoraSubscriptionResponse>(
      "PUT",
      `/v1/subscriptions/${ref.externalId}`,
      {
        remove: [
          {
            ratePlanId: currentRatePlan.id,
          },
        ],
        add: [
          {
            productRatePlanId: params.newOfferVersionId,
          },
        ],
      },
    );

    if (!response.success) {
      throw new BillingProviderError(
        `Failed to change subscription: ${response.reasons?.[0]?.message}`,
        "zuora",
        "SUBSCRIPTION_CHANGE_FAILED",
      );
    }

    return {
      subscriptionId: ref.externalId,
      effectiveDate: new Date(),
    };
  }

  /**
   * Create a customer portal session.
   * Note: Zuora uses Z-Commerce for self-service portals.
   */
  async createPortalSession(
    params: CreatePortalSessionParams,
  ): Promise<PortalSession> {
    // Generate a signed URL for Z-Commerce portal
    // This requires Z-Commerce to be configured in Zuora
    const token = crypto.randomBytes(32).toString("hex");

    // In production, you'd store this token with session data for validation
    // For now, we generate a portal URL
    const portalUrl = new URL(`${this.config.baseUrl}/apps/customer-portal`);
    portalUrl.searchParams.set("token", token);
    portalUrl.searchParams.set("accountId", params.customerId);
    portalUrl.searchParams.set("returnUrl", params.returnUrl);

    return {
      id: token,
      url: portalUrl.toString(),
    };
  }

  /**
   * Verify webhook signature from Zuora callout notifications.
   */
  verifyWebhook(payload: Buffer, signature: string): boolean {
    if (!this.config.webhookSecret) {
      // If no secret configured, skip verification (not recommended)
      return true;
    }

    try {
      // Zuora uses HMAC-SHA256 for webhook signatures
      const expectedSignature = crypto
        .createHmac("sha256", this.config.webhookSecret)
        .update(payload)
        .digest("hex");

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch {
      return false;
    }
  }

  /**
   * Normalize Zuora callout notification to domain event.
   */
  normalizeEvent(rawEvent: unknown): DomainEvent | null {
    const event = rawEvent as ZuoraCalloutNotification;

    // Extract workspace ID from account metadata if available
    const workspaceId = ""; // Would need to look up from account

    switch (event.type) {
      case "SubscriptionCreated":
        return {
          id: crypto.randomUUID(),
          type: "subscription.created",
          workspaceId,
          aggregateType: "subscription",
          aggregateId: event.subscriptionId || "",
          data: {
            subscriptionId: event.subscriptionId,
            accountId: event.accountId,
            status: "active",
          },
          metadata: {
            version: 1,
            source: "zuora",
            provider: "zuora",
          },
          occurredAt: event.timestamp ? new Date(event.timestamp) : new Date(),
        };

      case "SubscriptionCancelled":
        return {
          id: crypto.randomUUID(),
          type: "subscription.canceled",
          workspaceId,
          aggregateType: "subscription",
          aggregateId: event.subscriptionId || "",
          data: {
            subscriptionId: event.subscriptionId,
            accountId: event.accountId,
            status: "canceled",
          },
          metadata: {
            version: 1,
            source: "zuora",
            provider: "zuora",
          },
          occurredAt: event.timestamp ? new Date(event.timestamp) : new Date(),
        };

      case "PaymentSuccess":
        return {
          id: crypto.randomUUID(),
          type: "invoice.paid",
          workspaceId,
          aggregateType: "invoice",
          aggregateId: event.invoiceId || "",
          data: {
            invoiceId: event.invoiceId,
            paymentId: event.paymentId,
            accountId: event.accountId,
          },
          metadata: {
            version: 1,
            source: "zuora",
            provider: "zuora",
          },
          occurredAt: event.timestamp ? new Date(event.timestamp) : new Date(),
        };

      case "PaymentFailed":
        return {
          id: crypto.randomUUID(),
          type: "invoice.payment_failed",
          workspaceId,
          aggregateType: "invoice",
          aggregateId: event.invoiceId || "",
          data: {
            invoiceId: event.invoiceId,
            paymentId: event.paymentId,
            accountId: event.accountId,
          },
          metadata: {
            version: 1,
            source: "zuora",
            provider: "zuora",
          },
          occurredAt: event.timestamp ? new Date(event.timestamp) : new Date(),
        };

      default:
        return null;
    }
  }

  /**
   * Validate a promo code in Zuora.
   * Note: Zuora handles discounts through rate plan charges and amendments.
   */
  async validatePromoCode(
    code: string,
    _offerId: string,
  ): Promise<PromoCodeValidation> {
    // Zuora doesn't have a direct promo code concept like Stripe
    // Discounts are typically handled through:
    // 1. Discount rate plan charges
    // 2. Custom fields on subscriptions
    // 3. External promo code tracking

    // For now, we'll check if there's a discount rate plan with this code
    try {
      const response = await this.request<{
        ratePlans: Array<{ id: string; name: string }>;
      }>("GET", `/v1/catalog/products?name=${encodeURIComponent(code)}`);

      const discountPlan = response.ratePlans?.find(
        (rp) =>
          rp.name.toLowerCase().includes("discount") ||
          rp.name.toLowerCase().includes(code.toLowerCase()),
      );

      if (discountPlan) {
        return {
          valid: true,
          code,
          discountType: "percent",
          discountValue: 0, // Would need to look up actual discount
        };
      }

      return { valid: false, code };
    } catch {
      return { valid: false, code };
    }
  }

  /**
   * Map Zuora subscription to domain SubscriptionData.
   */
  private mapSubscription(subscription: ZuoraSubscription): SubscriptionData {
    return {
      id: subscription.id,
      status: this.mapSubscriptionStatus(subscription.status),
      currentPeriodStart: new Date(subscription.termStartDate),
      currentPeriodEnd: new Date(subscription.termEndDate),
      cancelAt: subscription.cancelledDate
        ? new Date(subscription.cancelledDate)
        : undefined,
      items: subscription.ratePlans.flatMap((rp) =>
        rp.ratePlanCharges.map((charge) => ({
          id: charge.id,
          priceId: charge.productRatePlanChargeId,
          quantity: charge.quantity ?? 1,
        })),
      ),
    };
  }

  /**
   * Map Zuora status to domain status.
   */
  private mapSubscriptionStatus(status: string): SubscriptionData["status"] {
    const statusMap: Record<string, SubscriptionData["status"]> = {
      Active: "active",
      Cancelled: "canceled",
      Expired: "canceled",
      Suspended: "paused",
      Draft: "pending",
      PendingActivation: "pending",
      PendingAcceptance: "pending",
    };
    return statusMap[status] || "active";
  }

  /**
   * Get Zuora account info for connection verification.
   */
  async getAccountInfo(): Promise<{
    id: string;
    name: string | null;
    tenantId: string | null;
  }> {
    // Get current user/tenant info
    const response = await this.request<{
      tenantId: string;
      tenantName: string;
      userId: string;
    }>("GET", "/v1/connections");

    return {
      id: response.userId,
      name: response.tenantName,
      tenantId: response.tenantId,
    };
  }
}
