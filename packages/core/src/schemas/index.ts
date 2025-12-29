import { z } from 'zod';

// Common schemas
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const urlSchema = z.string().url();
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format');

// Workspace schemas
export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: slugSchema,
  defaultProvider: z.enum(['stripe', 'zuora']).optional(),
  defaultCurrency: z.string().length(3).optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  defaultProvider: z.enum(['stripe', 'zuora']).optional(),
  settings: z.object({
    defaultCurrency: z.string().length(3).optional(),
    webhookRetryPolicy: z.object({
      maxRetries: z.number().int().min(0).max(10).optional(),
      initialDelayMs: z.number().int().min(100).max(60000).optional(),
      maxDelayMs: z.number().int().min(1000).max(3600000).optional(),
      backoffMultiplier: z.number().min(1).max(5).optional(),
    }).optional(),
  }).optional(),
});

// Customer schemas
export const createCustomerSchema = z.object({
  email: emailSchema,
  name: z.string().max(200).optional(),
  externalId: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateCustomerSchema = z.object({
  email: emailSchema.optional(),
  name: z.string().max(200).optional(),
  externalId: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Pricing schemas
export const pricingTierSchema = z.object({
  upTo: z.number().int().positive().nullable(),
  unitAmount: z.number().int().nonnegative(),
  flatAmount: z.number().int().nonnegative().optional(),
});

export const pricingConfigSchema = z.object({
  model: z.enum(['flat', 'per_unit', 'tiered', 'volume']),
  currency: z.string().length(3),
  amount: z.number().int().nonnegative(),
  interval: z.enum(['day', 'week', 'month', 'year']).optional(),
  intervalCount: z.number().int().min(1).max(12).optional(),
  usageType: z.enum(['licensed', 'metered']).optional(),
  tiers: z.array(pricingTierSchema).optional(),
});

export const trialConfigSchema = z.object({
  days: z.number().int().min(1).max(365),
  requirePaymentMethod: z.boolean(),
});

export const entitlementConfigSchema = z.object({
  featureKey: z.string().min(1).max(100),
  value: z.union([z.string(), z.number(), z.boolean()]),
  valueType: z.enum(['boolean', 'number', 'string', 'unlimited']),
});

export const offerConfigSchema = z.object({
  pricing: pricingConfigSchema,
  trial: trialConfigSchema.optional(),
  entitlements: z.array(entitlementConfigSchema),
  metadata: z.record(z.unknown()).optional(),
  rawJson: z.record(z.unknown()).optional(),
});

// Offer schemas
export const createOfferSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  config: offerConfigSchema,
});

export const createOfferVersionSchema = z.object({
  config: offerConfigSchema,
});

export const publishOfferSchema = z.object({
  versionId: uuidSchema.optional(),
});

export const rollbackOfferSchema = z.object({
  targetVersionId: uuidSchema,
});

// Checkout schemas
export const createCheckoutSessionSchema = z.object({
  offerId: uuidSchema,
  offerVersionId: uuidSchema.optional(),
  customerId: uuidSchema.optional(),
  customerEmail: emailSchema.optional(),
  successUrl: urlSchema,
  cancelUrl: urlSchema,
  allowPromotionCodes: z.boolean().optional(),
  trialDays: z.number().int().min(1).max(365).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Subscription schemas
export const cancelSubscriptionSchema = z.object({
  cancelAtPeriodEnd: z.boolean().optional(),
  reason: z.string().max(500).optional(),
});

export const changeSubscriptionSchema = z.object({
  newOfferId: uuidSchema,
  newOfferVersionId: uuidSchema.optional(),
  prorationBehavior: z.enum(['create_prorations', 'none', 'always_invoice']).optional(),
});

// Webhook endpoint schemas
export const createWebhookEndpointSchema = z.object({
  url: urlSchema,
  events: z.array(z.string()).min(1),
  description: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateWebhookEndpointSchema = z.object({
  url: urlSchema.optional(),
  events: z.array(z.string()).min(1).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// API Key schemas
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  role: z.enum(['owner', 'admin', 'member', 'readonly']),
  environment: z.enum(['live', 'test']),
  expiresAt: z.coerce.date().optional(),
});

// Pagination schema
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type CreateOfferVersionInput = z.infer<typeof createOfferVersionSchema>;
export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type ChangeSubscriptionInput = z.infer<typeof changeSubscriptionSchema>;
export type CreateWebhookEndpointInput = z.infer<typeof createWebhookEndpointSchema>;
export type UpdateWebhookEndpointInput = z.infer<typeof updateWebhookEndpointSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
