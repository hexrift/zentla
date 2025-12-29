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
  ProviderNotImplementedError,
} from '@relay/core';
import type { ZuoraConfig } from './zuora.config';

/**
 * Zuora Adapter Stub
 *
 * This is a placeholder implementation for the Zuora billing provider.
 * All methods throw ProviderNotImplementedError until the full implementation is complete.
 *
 * Implementation roadmap:
 * 1. Authentication (OAuth 2.0)
 * 2. Product catalog sync (Products, Rate Plans, Charges)
 * 3. Hosted checkout pages
 * 4. Subscription management
 * 5. Webhook processing (callout notifications)
 * 6. Customer portal (Z-Commerce)
 */
export class ZuoraAdapter implements BillingProvider {
  readonly name = 'zuora' as const;

  constructor(_config: ZuoraConfig) {
    // Configuration stored for future implementation
  }

  async syncOffer(
    _offer: Offer,
    _version: OfferVersion,
    _existingRef?: ProviderRef
  ): Promise<SyncOfferResult> {
    throw new ProviderNotImplementedError('zuora', 'syncOffer');
  }

  async createCustomer(_params: CreateCustomerParams): Promise<CustomerResult> {
    throw new ProviderNotImplementedError('zuora', 'createCustomer');
  }

  async updateCustomer(_externalId: string, _params: UpdateCustomerParams): Promise<CustomerResult> {
    throw new ProviderNotImplementedError('zuora', 'updateCustomer');
  }

  async deleteCustomer(_externalId: string): Promise<void> {
    throw new ProviderNotImplementedError('zuora', 'deleteCustomer');
  }

  async createCheckoutSession(_params: CreateCheckoutParams): Promise<CheckoutSession> {
    throw new ProviderNotImplementedError('zuora', 'createCheckoutSession');
  }

  async getSubscription(_ref: ProviderRef): Promise<SubscriptionData> {
    throw new ProviderNotImplementedError('zuora', 'getSubscription');
  }

  async cancelSubscription(
    _ref: ProviderRef,
    _params: CancelSubscriptionInput
  ): Promise<void> {
    throw new ProviderNotImplementedError('zuora', 'cancelSubscription');
  }

  async changeSubscription(
    _ref: ProviderRef,
    _params: ChangeSubscriptionInput
  ): Promise<ChangeSubscriptionResult> {
    throw new ProviderNotImplementedError('zuora', 'changeSubscription');
  }

  async createPortalSession(_params: CreatePortalSessionParams): Promise<PortalSession> {
    throw new ProviderNotImplementedError('zuora', 'createPortalSession');
  }

  verifyWebhook(_payload: Buffer, _signature: string): boolean {
    throw new ProviderNotImplementedError('zuora', 'verifyWebhook');
  }

  normalizeEvent(_rawEvent: unknown): DomainEvent | null {
    throw new ProviderNotImplementedError('zuora', 'normalizeEvent');
  }

  async validatePromoCode(_code: string, _offerId: string): Promise<PromoCodeValidation> {
    throw new ProviderNotImplementedError('zuora', 'validatePromoCode');
  }
}
