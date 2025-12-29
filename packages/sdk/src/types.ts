export interface Offer {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  currentVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferVersion {
  id: string;
  offerId: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  config: OfferConfig;
  publishedAt?: string;
  createdAt: string;
}

export interface OfferConfig {
  pricing: PricingConfig;
  trial?: TrialConfig;
  entitlements: EntitlementConfig[];
  metadata?: Record<string, unknown>;
  rawJson?: Record<string, unknown>;
}

export interface PricingConfig {
  model: 'flat' | 'per_unit' | 'tiered' | 'volume';
  currency: string;
  amount: number;
  interval?: 'day' | 'week' | 'month' | 'year';
  intervalCount?: number;
  usageType?: 'licensed' | 'metered';
  tiers?: PricingTier[];
}

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

export interface Customer {
  id: string;
  workspaceId: string;
  email: string;
  name?: string;
  externalId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  workspaceId: string;
  customerId: string;
  offerId: string;
  offerVersionId: string;
  status:
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'incomplete'
    | 'incomplete_expired'
    | 'paused';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAt?: string;
  canceledAt?: string;
  endedAt?: string;
  trialStart?: string;
  trialEnd?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Checkout {
  id: string;
  workspaceId: string;
  customerId?: string;
  offerId: string;
  offerVersionId: string;
  status: 'pending' | 'open' | 'complete' | 'expired';
  sessionUrl?: string;
  successUrl: string;
  cancelUrl: string;
  expiresAt: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEndpoint {
  id: string;
  workspaceId: string;
  url: string;
  events: string[];
  status: 'active' | 'disabled';
  description?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EntitlementCheck {
  featureKey: string;
  hasAccess: boolean;
  value?: string | number | boolean;
  valueType?: 'boolean' | 'number' | 'string' | 'unlimited';
}

export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
}

// Input types
export interface CreateOfferInput {
  name: string;
  description?: string;
  config: OfferConfig;
}

export interface CreateCustomerInput {
  email: string;
  name?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCheckoutInput {
  offerId: string;
  offerVersionId?: string;
  customerId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  allowPromotionCodes?: boolean;
  trialDays?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateWebhookEndpointInput {
  url: string;
  events: string[];
  description?: string;
  metadata?: Record<string, unknown>;
}
