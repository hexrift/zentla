import type { DomainEvent } from './domain-event';
import type { Checkout } from '../domain/checkout';

export interface CheckoutCompletedData {
  checkout: Checkout;
  customerId: string;
  subscriptionId: string;
}

export interface CheckoutExpiredData {
  checkoutId: string;
  offerId: string;
  expiredAt: Date;
}

export type CheckoutCompletedEvent = DomainEvent<CheckoutCompletedData>;
export type CheckoutExpiredEvent = DomainEvent<CheckoutExpiredData>;
