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
  status: "draft" | "published" | "archived";
  config: OfferConfig;
  publishedAt?: string;
  createdAt: string;
}

export interface OfferConfig {
  pricing: {
    model: "flat" | "per_unit" | "tiered" | "volume";
    amount: number;
    currency: string;
    interval: "day" | "week" | "month" | "year";
  };
  trial?: {
    days: number;
    requirePaymentMethod?: boolean;
  };
  entitlements?: Array<{
    featureKey: string;
    value: unknown;
    valueType: "boolean" | "number" | "string";
  }>;
}

export interface Offer {
  id: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "archived";
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
  status: "active" | "disabled";
  description?: string;
  secret?: string;
  createdAt: string;
}

export interface PromotionVersion {
  id: string;
  version: number;
  status: "draft" | "published" | "archived";
  config: {
    discountType: "percent" | "fixed_amount" | "free_trial_days";
    discountValue: number;
    currency?: string;
    maxRedemptions?: number;
    maxRedemptionsPerCustomer?: number;
    minimumAmount?: number;
    validFrom?: string;
    validUntil?: string;
    duration?: "once" | "repeating" | "forever";
    durationInMonths?: number;
    applicableOfferIds?: string[];
  };
  publishedAt?: string;
  createdAt: string;
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "archived";
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
  status: "pending" | "processed" | "failed";
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

// Experiment types
export interface ExperimentVariant {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  weight: number;
  config: Record<string, unknown> | null;
  isControl: boolean;
}

export interface Experiment {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  type: "feature" | "pricing" | "ui" | "funnel";
  status: "draft" | "running" | "paused" | "concluded" | "archived";
  trafficAllocation: number;
  targetingRules: Record<string, unknown> | null;
  startAt?: string | null;
  endAt?: string | null;
  winningVariantId?: string | null;
  variants: ExperimentVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentStats {
  experimentId: string;
  totalAssignments: number;
  totalExposures: number;
  totalConversions: number;
  conversionRate: number;
  variantStats: Array<{
    variantId: string;
    variantKey: string;
    isControl: boolean;
    assignments: number;
    exposures: number;
    conversions: number;
    conversionRate: number;
    totalConversionValue: number;
  }>;
}

// Invoice types
export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  currency: string;
  periodStart?: string;
  periodEnd?: string;
}

export interface Invoice {
  id: string;
  workspaceId: string;
  customerId: string;
  subscriptionId?: string;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  periodStart?: string;
  periodEnd?: string;
  dueDate?: string;
  paidAt?: string;
  voidedAt?: string;
  provider: string;
  providerInvoiceId: string;
  providerInvoiceUrl?: string;
  attemptCount: number;
  nextPaymentAttempt?: string;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; email: string; name?: string };
  lineItems?: InvoiceLineItem[];
}

export interface Refund {
  id: string;
  workspaceId: string;
  customerId: string;
  invoiceId?: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "canceled";
  reason?:
    | "duplicate"
    | "fraudulent"
    | "requested_by_customer"
    | "expired_uncaptured_charge";
  failureReason?: string;
  provider: "stripe" | "zuora";
  providerRefundId: string;
  providerChargeId?: string;
  providerPaymentIntentId?: string;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; email: string; name?: string };
  invoice?: {
    id: string;
    providerInvoiceId: string;
    total: number;
    currency: string;
  };
}

// Dunning types
export interface DunningConfig {
  id: string;
  workspaceId: string;
  retrySchedule: number[];
  maxAttempts: number;
  finalAction: "suspend" | "cancel";
  gracePeriodDays: number;
  emailsEnabled: boolean;
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DunningAttempt {
  id: string;
  workspaceId: string;
  invoiceId: string;
  subscriptionId?: string;
  customerId: string;
  attemptNumber: number;
  status: "pending" | "processing" | "succeeded" | "failed" | "skipped";
  scheduledAt: string;
  executedAt?: string;
  success?: boolean;
  failureReason?: string;
  providerError?: string;
  declineCode?: string;
  createdAt: string;
  customer?: { id: string; email: string; name?: string };
  invoice?: { id: string; amountDue: number; currency: string };
}

export interface InvoiceInDunning {
  id: string;
  amountDue: number;
  currency: string;
  status: string;
  dunningStartedAt: string;
  dunningAttemptCount: number;
  nextDunningAttemptAt?: string;
  customer: { id: string; email: string; name?: string };
  subscription?: { id: string; status: string };
}

export interface DunningStats {
  invoicesInDunning: number;
  totalAmountAtRisk: number;
  currency: string;
  amountsByCurrency: Array<{ currency: string; amount: number }>;
  recoveryRate: number;
  attemptsByStatus: {
    pending: number;
    succeeded: number;
    failed: number;
  };
}

export type DunningEmailType =
  | "payment_failed"
  | "payment_reminder"
  | "final_warning"
  | "subscription_suspended"
  | "subscription_canceled"
  | "payment_recovered";

export interface DunningEmailTemplate {
  type: DunningEmailType;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  enabled: boolean;
  isDefault: boolean;
}

// Dunning Analytics types
export interface DunningAnalytics {
  invoicesInDunning: number;
  totalAmountAtRisk: number;
  amountAtRiskByCurrency: Array<{ currency: string; amount: number }>;
  amountRecovered: number;
  recoveryRate: number;
  averageDaysToRecovery: number;
  attemptsByStatus: {
    pending: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  outcomes: {
    recovered: number;
    suspended: number;
    canceled: number;
    stillInDunning: number;
  };
}

export interface DunningTrendPoint {
  date: string;
  invoicesInDunning: number;
  amountAtRisk: number;
  amountRecovered: number;
  recoveryRate: number;
  newDunningStarted: number;
}

export interface RecoveryFunnel {
  totalStarted: number;
  recoveredAttempt1: number;
  recoveredAttempt2: number;
  recoveredAttempt3: number;
  recoveredAttempt4Plus: number;
  finalActionTaken: number;
  stillInProgress: number;
}

export interface DeclineCode {
  code: string;
  count: number;
  percentage: number;
}

// Webhook monitoring types
export interface WebhookStats {
  totalDelivered: number;
  totalFailed: number;
  totalPending: number;
  totalDeadLetter: number;
  deliveryRate: number;
  averageAttempts: number;
}

export interface EndpointHealth {
  id: string;
  url: string;
  status: string;
  successCount: number;
  failureCount: number;
  deliveryRate: number;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: number | null;
  lastErrorAt: string | null;
  lastError: string | null;
  pendingEvents: number;
  health: "healthy" | "degraded" | "unhealthy";
}

export interface WebhookEventSummary {
  id: string;
  endpointId: string;
  endpointUrl: string;
  eventType: string;
  status: string;
  attempts: number;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  response?: {
    statusCode?: number;
    error?: string;
  };
}

export interface WebhookDeadLetterSummary {
  id: string;
  endpointId: string;
  endpointUrl: string;
  eventType: string;
  failureReason: string;
  attempts: number;
  lastAttemptAt: string;
  createdAt: string;
}

export interface EventTypeBreakdown {
  eventType: string;
  count: number;
  deliveryRate: number;
}

// Customer Portal types
export interface PortalCustomer {
  id: string;
  email: string;
  name: string | null;
}

export interface PortalSubscription {
  id: string;
  status: string;
  offer: {
    id: string;
    name: string;
  };
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAt: string | null;
  createdAt: string;
}

export interface PortalInvoice {
  id: string;
  amountDue: number;
  amountPaid: number;
  total: number;
  currency: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  dueDate: string | null;
  paidAt: string | null;
  providerInvoiceUrl: string | null;
  createdAt: string;
}

export interface PortalEntitlement {
  featureKey: string;
  value: unknown;
  valueType: string;
}

// Paginated response type
export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
}
