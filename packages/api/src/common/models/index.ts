/**
 * Response Model Classes
 *
 * These classes define the public-facing domain models that appear in the
 * "Models" section of API documentation. They represent the core product
 * concepts that API consumers work with.
 *
 * Note: These are documentation-only classes. Actual response shaping
 * happens in services/controllers using the schema objects.
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema, ApiExtraModels } from '@nestjs/swagger';

// ============================================================================
// ENTITLEMENT
// ============================================================================

@ApiSchema({ name: 'Entitlement' })
export class EntitlementModel {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ format: 'uuid' })
  subscriptionId!: string;

  @ApiProperty({ description: 'Feature identifier (e.g., "api_calls", "seats")' })
  featureKey!: string;

  @ApiProperty({ description: 'Entitlement value' })
  value!: string | number | boolean;

  @ApiProperty({ enum: ['boolean', 'number', 'string', 'unlimited'] })
  valueType!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  expiresAt?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

// ============================================================================
// CUSTOMER
// ============================================================================

@ApiSchema({ name: 'Customer' })
export class CustomerModel {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiPropertyOptional({ nullable: true })
  name?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Your system identifier for this customer',
  })
  externalId?: string;

  @ApiPropertyOptional({ description: 'Custom key-value data' })
  metadata?: Record<string, unknown>;

  @ApiProperty({ description: 'Resource version for concurrency control' })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

// ============================================================================
// OFFER VERSION
// ============================================================================

@ApiSchema({ name: 'OfferVersion' })
export class OfferVersionModel {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Version number (1, 2, 3...)' })
  version!: number;

  @ApiProperty({ enum: ['draft', 'published', 'archived'] })
  status!: string;

  @ApiProperty({ description: 'Pricing, trial, and entitlement configuration' })
  config!: {
    pricing: {
      model: string;
      amount: number;
      currency: string;
      interval: string;
      intervalCount?: number;
    };
    trial?: {
      days: number;
      requirePaymentMethod: boolean;
    };
    entitlements: Array<{
      featureKey: string;
      value: string | number | boolean;
      valueType: string;
    }>;
  };

  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description: 'When this version becomes active (null = immediate)',
  })
  effectiveFrom?: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  publishedAt?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

// ============================================================================
// OFFER
// ============================================================================

@ApiSchema({ name: 'Offer' })
@ApiExtraModels(OfferVersionModel)
export class OfferModel {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Offer display name' })
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string;

  @ApiProperty({ enum: ['active', 'archived'] })
  status!: string;

  @ApiProperty({ description: 'Resource version for concurrency control' })
  version!: number;

  @ApiPropertyOptional({
    type: () => OfferVersionModel,
    nullable: true,
    description: 'Currently published version (null if none published)',
  })
  currentVersion?: OfferVersionModel;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

// ============================================================================
// SUBSCRIPTION
// ============================================================================

@ApiSchema({ name: 'Subscription' })
export class SubscriptionModel {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ format: 'uuid' })
  offerId!: string;

  @ApiProperty({ format: 'uuid' })
  offerVersionId!: string;

  @ApiProperty({
    enum: ['trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'paused'],
  })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  currentPeriodStart!: string;

  @ApiProperty({ format: 'date-time' })
  currentPeriodEnd!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  cancelAt?: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  canceledAt?: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  trialStart?: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  trialEnd?: string;

  @ApiProperty({ description: 'Resource version for concurrency control' })
  version!: number;

  @ApiPropertyOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

// ============================================================================
// PROMOTION
// ============================================================================

@ApiSchema({ name: 'Promotion' })
export class PromotionModel {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Promo code customers enter' })
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string;

  @ApiProperty({ enum: ['active', 'archived'] })
  status!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Currently published version',
  })
  currentVersion?: {
    id: string;
    version: number;
    status: string;
    config: {
      discountType: string;
      discountValue: number;
      duration?: string;
      durationInMonths?: number;
      maxRedemptions?: number;
      validFrom?: string;
      validUntil?: string;
    };
  };

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

// ============================================================================
// CHECKOUT SESSION
// ============================================================================

@ApiSchema({ name: 'CheckoutSession' })
export class CheckoutSessionModel {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  offerId!: string;

  @ApiProperty({ format: 'uuid' })
  offerVersionId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  customerId?: string;

  @ApiProperty({ enum: ['pending', 'open', 'complete', 'expired'] })
  status!: string;

  @ApiProperty({
    format: 'uri',
    description: 'URL to redirect customer to complete checkout',
  })
  url!: string;

  @ApiProperty({ format: 'uri' })
  successUrl!: string;

  @ApiProperty({ format: 'uri' })
  cancelUrl!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  completedAt?: string;

  @ApiPropertyOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

// ============================================================================
// CHECKOUT INTENT (headless)
// ============================================================================

@ApiSchema({ name: 'CheckoutIntent' })
export class CheckoutIntentModel {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    enum: ['pending', 'processing', 'requires_action', 'succeeded', 'failed', 'expired'],
    description: 'Current status of the checkout intent',
  })
  status!: string;

  @ApiProperty({
    description: 'Stripe client secret for client-side payment confirmation',
  })
  clientSecret!: string;

  @ApiProperty({ format: 'uuid' })
  offerId!: string;

  @ApiProperty({ format: 'uuid' })
  offerVersionId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  customerId?: string;

  @ApiProperty({ description: 'Three-letter ISO currency code', example: 'USD' })
  currency!: string;

  @ApiProperty({ description: 'Subtotal in cents' })
  subtotal!: number;

  @ApiProperty({ description: 'Discount in cents' })
  discount!: number;

  @ApiProperty({ description: 'Tax in cents' })
  tax!: number;

  @ApiProperty({ description: 'Total to charge in cents' })
  total!: number;

  @ApiPropertyOptional({ nullable: true })
  trialDays?: number;

  @ApiPropertyOptional({ nullable: true })
  promotionCode?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Subscription ID after successful payment',
  })
  subscriptionId?: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  completedAt?: string;

  @ApiPropertyOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

// ============================================================================
// WEBHOOK EVENT
// ============================================================================

@ApiSchema({ name: 'WebhookEvent' })
export class WebhookEventModel {
  @ApiProperty({
    description: 'Event type identifier',
    example: 'subscription.created',
  })
  type!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Unique event ID for idempotency',
  })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({
    description: 'Event-specific data payload',
    example: {
      subscription: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'active',
      },
    },
  })
  data!: Record<string, unknown>;
}

// ============================================================================
// WEBHOOK ENDPOINT
// ============================================================================

@ApiSchema({ name: 'WebhookEndpoint' })
export class WebhookEndpointModel {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uri' })
  url!: string;

  @ApiProperty({
    type: [String],
    description: 'Event types this endpoint receives',
    example: ['subscription.created', 'subscription.canceled'],
  })
  events!: string[];

  @ApiProperty({ enum: ['active', 'disabled'] })
  status!: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string;

  @ApiProperty({ description: 'Resource version for concurrency control' })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

// ============================================================================
// API KEY (response, without secret)
// ============================================================================

@ApiSchema({ name: 'ApiKey' })
export class ApiKeyModel {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Visible prefix for identification (e.g., rl_live_abc...)' })
  keyPrefix!: string;

  @ApiProperty({ enum: ['owner', 'admin', 'member', 'readonly'] })
  role!: string;

  @ApiProperty({ enum: ['live', 'test'] })
  environment!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastUsedAt?: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  expiresAt?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

// ============================================================================
// EXPORTS FOR REGISTRATION
// ============================================================================

/**
 * All model classes to register with @ApiExtraModels in the app module.
 * This ensures they appear in the OpenAPI "components.schemas" section.
 */
export const ALL_MODELS = [
  CustomerModel,
  EntitlementModel,
  OfferModel,
  OfferVersionModel,
  SubscriptionModel,
  PromotionModel,
  CheckoutSessionModel,
  CheckoutIntentModel,
  WebhookEventModel,
  WebhookEndpointModel,
  ApiKeyModel,
];
