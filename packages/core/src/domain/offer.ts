export interface Offer {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  status: OfferStatus;
  currentVersionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type OfferStatus = 'active' | 'archived';

export interface OfferVersion {
  id: string;
  offerId: string;
  version: number;
  status: OfferVersionStatus;
  config: OfferConfig;
  publishedAt?: Date;
  effectiveFrom?: Date;
  createdAt: Date;
}

export type OfferVersionStatus = 'draft' | 'published' | 'archived';

export interface OfferConfig {
  pricing: PricingConfig;
  trial?: TrialConfig;
  entitlements: EntitlementConfig[];
  metadata?: Record<string, unknown>;
  rawJson?: Record<string, unknown>;
}

export interface PricingConfig {
  model: PricingModel;
  currency: string;
  amount: number;
  interval?: BillingInterval;
  intervalCount?: number;
  usageType?: 'licensed' | 'metered';
  tiers?: PricingTier[];
}

export type PricingModel = 'flat' | 'per_unit' | 'tiered' | 'volume';

export type BillingInterval = 'day' | 'week' | 'month' | 'year';

export interface PricingTier {
  upTo: number | null;
  unitAmount: number;
  flatAmount?: number;
}

export interface TrialConfig {
  days: number;
  requirePaymentMethod: boolean;
}

export interface EntitlementConfig {
  featureKey: string;
  value: string | number | boolean;
  valueType: 'boolean' | 'number' | 'string' | 'unlimited';
}
