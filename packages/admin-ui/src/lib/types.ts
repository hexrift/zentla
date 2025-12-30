// Common types used across the admin UI

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  mode: string;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
}

export interface InitialApiKey {
  id: string;
  secret: string;
  prefix: string;
  message: string;
}

export interface AuthResponse {
  user: AuthUser;
  workspaces: AuthWorkspace[];
  session: AuthSession;
  initialApiKey?: InitialApiKey;
}

export interface Customer {
  id: string;
  email: string;
  name?: string;
  externalId?: string;
  createdAt: string;
}

export interface OfferVersion {
  id: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  config: OfferConfig;
  publishedAt?: string;
  createdAt: string;
}

export interface OfferConfig {
  pricing: {
    model: 'flat' | 'per_unit' | 'tiered' | 'volume';
    amount: number;
    currency: string;
    interval: 'day' | 'week' | 'month' | 'year';
  };
  trial?: {
    days: number;
    requirePaymentMethod?: boolean;
  };
  entitlements?: Array<{
    featureKey: string;
    value: unknown;
    valueType: 'boolean' | 'number' | 'string';
  }>;
}

export interface Offer {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  currentVersion?: OfferVersion;
  versions?: OfferVersion[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  status: string;
  customer: { id: string; email: string; name?: string };
  offer: { id: string; name: string };
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  status: 'active' | 'disabled';
  description?: string;
  secret?: string;
  createdAt: string;
}

export interface PromotionVersion {
  id: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  config: {
    discountType: 'percent' | 'fixed_amount' | 'free_trial_days';
    discountValue: number;
    currency?: string;
    maxRedemptions?: number;
    validFrom?: string;
    validUntil?: string;
  };
  publishedAt?: string;
  createdAt: string;
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  currentVersion?: PromotionVersion;
  versions: PromotionVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutSession {
  id: string;
  status: string;
  customerEmail?: string;
  offer: { id: string; name: string };
  customer?: { id: string; email: string; name?: string };
  sessionUrl?: string;
  providerSessionId?: string;
  expiresAt: string;
  completedAt?: string;
  createdAt: string;
}

export interface CheckoutIntent {
  id: string;
  status: string;
  customerEmail?: string;
  offer: { id: string; name: string };
  customer?: { id: string; email: string; name?: string };
  subscription?: { id: string; status: string };
  promotion?: { id: string; name: string; code: string };
  providerPaymentId?: string;
  failureReason?: string;
  currency: string;
  totalAmount: number;
  discountAmount: number;
  trialDays?: number;
  createdAt: string;
}

export interface Event {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  status: 'pending' | 'processed' | 'failed';
  payload: Record<string, unknown>;
  processedAt: string | null;
  createdAt: string;
}

export interface DeadLetterEvent {
  id: string;
  originalEventId: string;
  endpointId: string;
  endpointUrl?: string;
  eventType: string;
  payload: Record<string, unknown>;
  failureReason: string;
  attempts: number;
  lastAttemptAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorType: string;
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  role: string;
  environment: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  defaultProvider?: string;
  settings: Record<string, unknown>;
  createdAt: string;
}

// Paginated response type
export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
}
