# Security

Zentla is designed with security-first principles aligned with OWASP guidelines.

## Authentication

### API Keys

All API requests require authentication via API key:

```
Authorization: Bearer zentla_live_xxxxx
```

Key properties:

- **Prefixed**: `zentla_live_` or `zentla_test_`
- **Hashed**: Keys are stored as SHA-256 hashes
- **Scoped**: Each key belongs to one workspace
- **Role-based**: owner, admin, member, readonly
- **Expirable**: Optional expiration date

### Key Security

- Keys are shown only once at creation
- Timing-safe comparison prevents timing attacks
- Rate limiting per key prevents abuse

## Authorization (RBAC)

| Role     | Offers | Subscriptions | Customers | Settings | API Keys |
| -------- | ------ | ------------- | --------- | -------- | -------- |
| owner    | Full   | Full          | Full      | Full     | Full     |
| admin    | Full   | Full          | Full      | Read     | None     |
| member   | Read   | Read          | Full      | None     | None     |
| readonly | Read   | Read          | Read      | None     | None     |

## Tenant Isolation

### Row-Level Security

Every database query is automatically scoped by `workspace_id`:

```typescript
// All queries include workspace filter
prisma.offer.findMany({
  where: { workspaceId: ctx.workspaceId, ...filters },
});
```

### API Key Context

The workspace is determined by the API key, not URL parameters:

```typescript
// API key contains workspace context
const ctx = await validateApiKey(bearerToken);
// ctx.workspaceId is used for all operations
```

## Input Validation

### Schema Validation

All inputs are validated with Zod schemas:

```typescript
const createOfferSchema = z.object({
  name: z.string().min(1).max(200),
  config: z.object({
    pricing: pricingSchema,
    entitlements: z.array(entitlementSchema),
  }),
});
```

### SQL Injection Prevention

Prisma ORM uses parameterized queries by default:

```typescript
// Safe - parameterized
prisma.customer.findFirst({
  where: { email: userInput },
});

// Never concatenate user input into queries
```

## Webhook Security

### Inbound (Stripe)

```typescript
// Verify Stripe signature with raw body
const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
```

Requirements:

- Raw body preserved (no JSON parsing)
- Signature header validation
- Timestamp tolerance check

### Outbound (Your App)

Zentla signs all outbound webhooks:

```
Zentla-Signature: t=1234567890,v1=abc123...
```

Verify in your handler:

```typescript
const signature = req.headers["relay-signature"];
const payload = req.body;

// Verify
const [timestamp, hash] = parseSignature(signature);
const expected = hmac("sha256", secret, `${timestamp}.${payload}`);
if (!timingSafeEqual(hash, expected)) {
  throw new Error("Invalid signature");
}
```

## Rate Limiting

Three tiers of rate limiting:

| Tier   | Window | Limit        |
| ------ | ------ | ------------ |
| Short  | 1s     | 10 requests  |
| Medium | 10s    | 50 requests  |
| Long   | 60s    | 100 requests |

Limits apply per:

- IP address
- API key
- Workspace

## Secrets Management

- All secrets via environment variables
- No secrets in code or config files
- Separate secrets per environment

```env
# .env (not committed)
STRIPE_SECRET_KEY=sk_live_...
API_KEY_SECRET=...
WEBHOOK_SIGNING_SECRET=...
```

## PCI Compliance

Zentla maintains PCI compliance by:

1. **No card data storage** - All card data handled by Stripe
2. **Tokenization only** - References to Stripe objects, never card numbers
3. **Secure redirects** - Checkout via Stripe Hosted Pages
4. **TLS everywhere** - HTTPS enforced in production

## Audit Logging

All mutations are logged:

```json
{
  "workspaceId": "...",
  "actorType": "api_key",
  "actorId": "key_123",
  "action": "create",
  "resourceType": "offer",
  "resourceId": "offer_456",
  "changes": { "before": null, "after": {...} },
  "ipAddress": "1.2.3.4",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Security Headers

Helmet middleware sets secure headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

## Idempotency

Prevent duplicate operations with idempotency keys:

```
X-Idempotency-Key: unique-request-id-123
```

Duplicate requests within 24 hours return the cached response.
