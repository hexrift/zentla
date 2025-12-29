import type { DomainEvent } from './domain-event';
import type { Subscription, SubscriptionStatus } from '../domain/subscription';

export interface SubscriptionCreatedData {
  subscription: Subscription;
  customerId: string;
  offerId: string;
}

export interface SubscriptionUpdatedData {
  subscriptionId: string;
  previousStatus: SubscriptionStatus;
  newStatus: SubscriptionStatus;
  changes: Record<string, { from: unknown; to: unknown }>;
}

export interface SubscriptionCanceledData {
  subscriptionId: string;
  customerId: string;
  canceledAt: Date;
  cancelAtPeriodEnd: boolean;
  reason?: string;
}

export interface SubscriptionRenewedData {
  subscriptionId: string;
  customerId: string;
  previousPeriodEnd: Date;
  newPeriodEnd: Date;
}

export interface SubscriptionTrialEndedData {
  subscriptionId: string;
  customerId: string;
  trialEnd: Date;
  convertedToActive: boolean;
}

export type SubscriptionCreatedEvent = DomainEvent<SubscriptionCreatedData>;
export type SubscriptionUpdatedEvent = DomainEvent<SubscriptionUpdatedData>;
export type SubscriptionCanceledEvent = DomainEvent<SubscriptionCanceledData>;
export type SubscriptionRenewedEvent = DomainEvent<SubscriptionRenewedData>;
export type SubscriptionTrialEndedEvent = DomainEvent<SubscriptionTrialEndedData>;
