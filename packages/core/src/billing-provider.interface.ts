import type { Offer, OfferVersion } from "./domain/offer";
import type { Promotion, PromotionVersion } from "./domain/promotion";
import type { ProviderRef } from "./domain/provider-ref";
import type {
  CheckoutSession,
  CreateCheckoutParams,
  PortalSession,
  CreatePortalSessionParams,
} from "./domain/checkout";
import type { SubscriptionData } from "./domain/subscription";
import type {
  CancelSubscriptionInput,
  ChangeSubscriptionInput,
} from "./schemas";
import type { DomainEvent } from "./events/domain-event";
import type { BillingProviderType } from "./domain/workspace";

export interface CreateCustomerParams {
  workspaceId: string;
  customerId: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface UpdateCustomerParams {
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface CustomerResult {
  externalId: string;
}

export interface BillingProvider {
  readonly name: BillingProviderType;

  // Products & Pricing
  syncOffer(
    offer: Offer,
    version: OfferVersion,
    existingRef?: ProviderRef,
  ): Promise<SyncOfferResult>;

  // Archive/deactivate a product (optional)
  archiveProduct?(productId: string): Promise<void>;

  // Customers
  createCustomer(params: CreateCustomerParams): Promise<CustomerResult>;
  updateCustomer(
    externalId: string,
    params: UpdateCustomerParams,
  ): Promise<CustomerResult>;
  deleteCustomer(externalId: string): Promise<void>;

  // Checkout
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession>;

  // Subscriptions
  getSubscription(ref: ProviderRef): Promise<SubscriptionData>;
  cancelSubscription(
    ref: ProviderRef,
    params: CancelSubscriptionInput,
  ): Promise<void>;
  changeSubscription(
    ref: ProviderRef,
    params: ChangeSubscriptionInput,
  ): Promise<ChangeSubscriptionResult>;

  // Customer Portal
  createPortalSession(
    params: CreatePortalSessionParams,
  ): Promise<PortalSession>;

  // Webhooks
  verifyWebhook(payload: Buffer, signature: string): boolean;
  normalizeEvent(rawEvent: unknown): DomainEvent | null;

  // Promotions
  syncPromotion?(
    promotion: Promotion,
    version: PromotionVersion,
    existingCouponRef?: ProviderRef,
  ): Promise<SyncPromotionResult>;

  // Promo Codes (legacy - prefer syncPromotion)
  validatePromoCode?(
    code: string,
    offerId: string,
  ): Promise<PromoCodeValidation>;

  // Invoices
  getInvoicePdfUrl?(invoiceId: string): Promise<string | null>;
  voidInvoice?(invoiceId: string): Promise<void>;
  payInvoice?(invoiceId: string): Promise<void>;
}

export interface SyncOfferResult {
  productRef: ProviderRef;
  priceRef: ProviderRef;
}

export interface SyncPromotionResult {
  couponRef: ProviderRef;
  promotionCodeRef: ProviderRef;
}

export interface ChangeSubscriptionResult {
  subscriptionId: string;
  prorationAmount?: number;
  effectiveDate: Date;
}

export interface PromoCodeValidation {
  valid: boolean;
  code: string;
  discountType?: "percent" | "amount";
  discountValue?: number;
  applicableOffers?: string[];
  expiresAt?: Date;
  maxRedemptions?: number;
  currentRedemptions?: number;
}

export class BillingProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: BillingProviderType,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BillingProviderError";
  }
}

export class ProviderNotImplementedError extends BillingProviderError {
  constructor(provider: BillingProviderType, method: string) {
    super(
      `Method '${method}' is not implemented for provider '${provider}'`,
      provider,
      "NOT_IMPLEMENTED",
    );
    this.name = "ProviderNotImplementedError";
  }
}
