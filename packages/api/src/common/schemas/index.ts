/**
 * Shared OpenAPI Schema Definitions
 *
 * Product-friendly schema names for SDK generation and documentation.
 * These schemas are referenced across all API controllers.
 */

// ============================================================================
// SHARED RESPONSE COMPONENTS
// ============================================================================

/**
 * Standard error response envelope.
 * All error responses follow this format.
 */
export const ErrorResponseSchema = {
  type: 'object',
  required: ['success', 'error', 'meta'],
  properties: {
    success: { type: 'boolean', enum: [false] },
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: {
          type: 'string',
          description: 'Machine-readable error code for programmatic handling',
          example: 'RESOURCE_NOT_FOUND',
        },
        message: {
          type: 'string',
          description: 'Human-readable error description',
          example: 'Customer not found',
        },
        details: {
          type: 'object',
          description: 'Additional context (validation errors, field info)',
          nullable: true,
        },
      },
    },
    meta: {
      type: 'object',
      properties: {
        requestId: { type: 'string', nullable: true },
        timestamp: { type: 'string', format: 'date-time' },
        path: { type: 'string' },
      },
    },
  },
} as const;

/**
 * Pagination metadata included in list responses.
 */
export const PaginationSchema = {
  type: 'object',
  properties: {
    hasMore: {
      type: 'boolean',
      description: 'True if more pages exist',
    },
    nextCursor: {
      type: 'string',
      nullable: true,
      description: 'Pass to cursor param for next page',
    },
  },
} as const;

// ============================================================================
// OFFER SCHEMAS
// ============================================================================

export const PricingConfigSchema = {
  type: 'object',
  required: ['model', 'amount', 'currency', 'interval'],
  properties: {
    model: {
      type: 'string',
      enum: ['flat', 'per_unit', 'tiered', 'usage'] as string[],
      description: 'Pricing model type',
    },
    amount: {
      type: 'integer',
      description: 'Price in cents (smallest currency unit)',
      example: 2999,
    },
    currency: {
      type: 'string',
      description: 'Three-letter ISO currency code',
      example: 'usd',
    },
    interval: {
      type: 'string',
      enum: ['month', 'year', 'week', 'day'] as string[],
      description: 'Billing interval',
    },
    intervalCount: {
      type: 'integer',
      default: 1,
      description: 'Number of intervals between billings',
    },
    tiers: {
      type: 'array',
      nullable: true,
      description: 'Required for tiered pricing model',
      items: {
        type: 'object',
        properties: {
          upTo: { type: 'integer', nullable: true },
          unitAmount: { type: 'integer' },
          flatAmount: { type: 'integer' },
        },
      },
    },
  },
};

export const TrialConfigSchema = {
  type: 'object',
  properties: {
    enabled: { type: 'boolean', default: false },
    days: {
      type: 'integer',
      minimum: 1,
      maximum: 365,
      description: 'Trial period in days',
    },
    requirePaymentMethod: {
      type: 'boolean',
      default: true,
      description: 'Whether to collect payment method upfront',
    },
  },
};

export const EntitlementConfigSchema = {
  type: 'object',
  required: ['featureKey', 'valueType', 'value'] as string[],
  properties: {
    featureKey: {
      type: 'string',
      description: 'Unique feature identifier (e.g., "api_calls", "storage_gb")',
      example: 'api_calls',
    },
    valueType: {
      type: 'string',
      enum: ['boolean', 'number', 'string', 'unlimited'] as string[],
    },
    value: {
      description: 'Feature value (type depends on valueType)',
      oneOf: [
        { type: 'boolean' },
        { type: 'number' },
        { type: 'string' },
      ],
    },
  },
};

export const OfferConfigSchema = {
  type: 'object',
  required: ['pricing'] as string[],
  properties: {
    pricing: PricingConfigSchema,
    trial: TrialConfigSchema,
    entitlements: {
      type: 'array',
      items: EntitlementConfigSchema,
    },
  },
};

export const OfferVersionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    version: { type: 'integer', description: 'Version number (1, 2, 3...)' },
    status: { type: 'string', enum: ['draft', 'published', 'archived'] as string[] },
    config: OfferConfigSchema,
    effectiveFrom: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'When this version becomes active (null = immediate)',
    },
    publishedAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

export const OfferSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', description: 'Offer display name' },
    description: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['active', 'archived'] as string[] },
    version: { type: 'integer', description: 'Resource version for concurrency control' },
    currentVersion: {
      ...OfferVersionSchema,
      nullable: true,
      description: 'Currently published version (null if none published)',
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

// ============================================================================
// CUSTOMER SCHEMAS
// ============================================================================

export const CustomerSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string', nullable: true },
    externalId: {
      type: 'string',
      nullable: true,
      description: 'Your system identifier for this customer',
    },
    metadata: { type: 'object', description: 'Custom key-value data' },
    version: { type: 'integer', description: 'Resource version for concurrency control' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

// ============================================================================
// SUBSCRIPTION SCHEMAS
// ============================================================================

export const SubscriptionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    customerId: { type: 'string', format: 'uuid' },
    offerId: { type: 'string', format: 'uuid' },
    offerVersionId: { type: 'string', format: 'uuid' },
    status: {
      type: 'string',
      enum: ['trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'paused'] as string[],
    },
    currentPeriodStart: { type: 'string', format: 'date-time' },
    currentPeriodEnd: { type: 'string', format: 'date-time' },
    cancelAt: { type: 'string', format: 'date-time', nullable: true },
    canceledAt: { type: 'string', format: 'date-time', nullable: true },
    trialStart: { type: 'string', format: 'date-time', nullable: true },
    trialEnd: { type: 'string', format: 'date-time', nullable: true },
    version: { type: 'integer', description: 'Resource version for concurrency control' },
    metadata: { type: 'object' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

// ============================================================================
// PROMOTION SCHEMAS
// ============================================================================

export const PromotionConfigSchema = {
  type: 'object',
  required: ['discountType'] as string[],
  properties: {
    discountType: {
      type: 'string',
      enum: ['percentage', 'fixed_amount'] as string[],
    },
    discountValue: {
      type: 'integer',
      description: 'Percentage (0-100) or amount in cents',
    },
    duration: {
      type: 'string',
      enum: ['once', 'forever', 'repeating'] as string[],
    },
    durationInMonths: {
      type: 'integer',
      nullable: true,
      description: 'Required when duration is "repeating"',
    },
    maxRedemptions: {
      type: 'integer',
      nullable: true,
      description: 'Maximum total uses across all customers',
    },
    maxRedemptionsPerCustomer: {
      type: 'integer',
      nullable: true,
      default: 1,
    },
    validFrom: { type: 'string', format: 'date-time', nullable: true },
    validUntil: { type: 'string', format: 'date-time', nullable: true },
    applicableOfferIds: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
      nullable: true,
      description: 'Limit to specific offers (null = all offers)',
    },
  },
};

export const PromotionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    code: { type: 'string', description: 'Promo code customers enter' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['active', 'archived'] as string[] },
    currentVersion: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        version: { type: 'integer' },
        status: { type: 'string', enum: ['draft', 'published', 'archived'] as string[] },
        config: PromotionConfigSchema,
      },
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

// ============================================================================
// CHECKOUT SCHEMAS
// ============================================================================

export const CheckoutSessionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    offerId: { type: 'string', format: 'uuid' },
    offerVersionId: { type: 'string', format: 'uuid' },
    customerId: { type: 'string', format: 'uuid', nullable: true },
    status: { type: 'string', enum: ['pending', 'open', 'complete', 'expired'] as string[] },
    sessionUrl: {
      type: 'string',
      format: 'uri',
      description: 'URL to redirect customer to complete checkout',
    },
    successUrl: { type: 'string', format: 'uri' },
    cancelUrl: { type: 'string', format: 'uri' },
    expiresAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time', nullable: true },
    metadata: { type: 'object' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

// ============================================================================
// ENTITLEMENT SCHEMAS
// ============================================================================

export const EntitlementSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    customerId: { type: 'string', format: 'uuid' },
    subscriptionId: { type: 'string', format: 'uuid' },
    featureKey: { type: 'string' },
    value: { type: 'string' },
    valueType: { type: 'string', enum: ['boolean', 'number', 'string', 'unlimited'] as string[] },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

export const EntitlementCheckSchema = {
  type: 'object',
  properties: {
    hasAccess: { type: 'boolean', description: 'Whether customer has access to this feature' },
    featureKey: { type: 'string' },
    value: { description: 'Current value for this feature' },
    valueType: { type: 'string', enum: ['boolean', 'number', 'string', 'unlimited'] as string[] },
    source: {
      type: 'string',
      enum: ['subscription', 'override', 'default'] as string[],
      description: 'Where this entitlement came from',
    },
  },
};

// ============================================================================
// WEBHOOK SCHEMAS
// ============================================================================

export const WebhookEndpointSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    url: { type: 'string', format: 'uri' },
    events: {
      type: 'array',
      items: { type: 'string' },
      description: 'Event types this endpoint receives',
    },
    status: { type: 'string', enum: ['active', 'disabled'] as string[] },
    description: { type: 'string', nullable: true },
    version: { type: 'integer' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

// ============================================================================
// PROVIDER SCHEMAS
// ============================================================================

export const ProviderConnectionSchema = {
  type: 'object',
  properties: {
    provider: {
      type: 'string',
      enum: ['stripe', 'zuora'] as string[],
      description: 'Billing provider identifier',
    },
    status: {
      type: 'string',
      enum: ['connected', 'disconnected', 'error', 'not_configured'] as string[],
      description: 'Connection status',
    },
    mode: {
      type: 'string',
      enum: ['live', 'test'] as string[],
      description: 'API mode (live or test/sandbox)',
    },
    lastVerifiedAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Last successful API verification',
    },
    capabilities: {
      type: 'object',
      description: 'Provider capabilities and configuration',
      properties: {
        subscriptions: { type: 'boolean' },
        invoices: { type: 'boolean' },
        customerPortal: { type: 'boolean' },
        webhooksConfigured: { type: 'boolean' },
      },
    },
    errors: {
      type: 'array',
      items: { type: 'string' },
      description: 'Configuration issues or errors',
    },
  },
};

export const ProviderStatusSchema = {
  type: 'object',
  properties: {
    defaultProvider: {
      type: 'string',
      enum: ['stripe', 'zuora'] as string[],
      description: 'Default billing provider for this workspace',
    },
    providers: {
      type: 'array',
      items: ProviderConnectionSchema,
      description: 'Status of all configured providers',
    },
  },
};

// ============================================================================
// API KEY SCHEMAS
// ============================================================================

export const ApiKeySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    keyPrefix: {
      type: 'string',
      description: 'Visible prefix for identification (e.g., relay_live_abc)',
    },
    role: { type: 'string', enum: ['owner', 'admin', 'member', 'readonly'] as string[] },
    environment: { type: 'string', enum: ['live', 'test'] as string[] },
    lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

// ============================================================================
// STANDARD API RESPONSE DECORATORS
// ============================================================================

/**
 * Standard 401/403 error responses for protected endpoints.
 * Apply these to all endpoints that require authentication.
 */
export const AuthErrorResponses = {
  401: {
    description: `**Unauthorized** - Authentication failed.

Possible causes:
- Missing Authorization header
- Invalid API key format (should be \`Bearer relay_xxx_xxx\`)
- API key not found or revoked
- API key expired`,
    content: {
      'application/json': {
        schema: ErrorResponseSchema,
        example: {
          success: false,
          error: {
            code: 'API_KEY_INVALID',
            message: 'Invalid or expired API key',
          },
          meta: {
            timestamp: '2025-01-15T10:30:00Z',
            path: '/api/v1/customers',
          },
        },
      },
    },
  },
  403: {
    description: `**Forbidden** - Insufficient permissions.

The API key is valid but lacks the required role for this operation.

**Role hierarchy:**
- \`readonly\`: Can only read resources
- \`member\`: Can read + create checkouts
- \`admin\`: Full access except API key management
- \`owner\`: Full access including API key management`,
    content: {
      'application/json': {
        schema: ErrorResponseSchema,
        example: {
          success: false,
          error: {
            code: 'API_KEY_INSUFFICIENT_ROLE',
            message: 'This operation requires admin role, but current key has member role',
            details: { requiredRole: 'admin', currentRole: 'member' },
          },
          meta: {
            timestamp: '2025-01-15T10:30:00Z',
            path: '/api/v1/customers',
          },
        },
      },
    },
  },
} as const;

/**
 * Standard 404 error response.
 */
export const NotFoundResponse = {
  description: 'Resource not found in this workspace',
  content: {
    'application/json': {
      schema: ErrorResponseSchema,
      example: {
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Customer not found',
          details: { resourceType: 'Customer', identifier: '123e4567-...' },
        },
        meta: {
          timestamp: '2025-01-15T10:30:00Z',
          path: '/api/v1/customers/123e4567-...',
        },
      },
    },
  },
} as const;

/**
 * Standard 400 validation error response.
 */
export const ValidationErrorResponse = {
  description: 'Validation failed',
  content: {
    'application/json': {
      schema: ErrorResponseSchema,
      example: {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: [
            { field: 'email', message: 'email must be a valid email address' },
          ],
        },
        meta: {
          timestamp: '2025-01-15T10:30:00Z',
          path: '/api/v1/customers',
        },
      },
    },
  },
} as const;
