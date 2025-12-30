import type { BillingProviderType } from './workspace';

export interface ProviderRef {
  id: string;
  workspaceId: string;
  entityType: EntityType;
  entityId: string;
  provider: BillingProviderType;
  externalId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type EntityType =
  | 'customer'
  | 'offer'
  | 'offer_version'
  | 'subscription'
  | 'checkout'
  | 'product'
  | 'price'
  | 'coupon'
  | 'promotion_code';

export interface CreateProviderRefInput {
  workspaceId: string;
  entityType: EntityType;
  entityId: string;
  provider: BillingProviderType;
  externalId: string;
  metadata?: Record<string, unknown>;
}

export interface LookupProviderRefInput {
  workspaceId: string;
  entityType: EntityType;
  entityId: string;
  provider: BillingProviderType;
}

export interface LookupByExternalIdInput {
  workspaceId: string;
  provider: BillingProviderType;
  entityType: EntityType;
  externalId: string;
}
