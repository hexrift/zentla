import { randomUUID } from 'crypto';

export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  workspaceId: string;
  aggregateType: string;
  aggregateId: string;
  data: T;
  metadata: EventMetadata;
  occurredAt: Date;
}

export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  version: number;
  source: string;
  provider?: string;
}

export type EventType =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'subscription.renewed'
  | 'subscription.trial_ended'
  | 'subscription.past_due'
  | 'checkout.completed'
  | 'checkout.expired'
  | 'customer.created'
  | 'customer.updated'
  | 'offer.published'
  | 'offer.archived'
  | 'entitlement.granted'
  | 'entitlement.revoked'
  | 'invoice.paid'
  | 'invoice.payment_failed';

export function createDomainEvent<T>(
  type: EventType,
  workspaceId: string,
  aggregateType: string,
  aggregateId: string,
  data: T,
  metadata?: Partial<EventMetadata>
): DomainEvent<T> {
  return {
    id: randomUUID(),
    type,
    workspaceId,
    aggregateType,
    aggregateId,
    data,
    metadata: {
      version: 1,
      source: 'relay',
      ...metadata,
    },
    occurredAt: new Date(),
  };
}
