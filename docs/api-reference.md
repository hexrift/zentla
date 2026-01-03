# API Reference

Base URL: `https://api.zentla.dev/api/v1` (or your self-hosted instance)

## Authentication

All requests require an API key in the Authorization header:

```
Authorization: Bearer zentla_live_xxxxx
```

## Common Response Format

### Success

```json
{
  "data": { ... }
}
```

### Paginated

```json
{
  "data": [...],
  "hasMore": true,
  "nextCursor": "abc123"
}
```

### Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [...]
  }
}
```

## Concurrency Control (ETags)

Zentla supports optimistic concurrency control using ETags. This prevents lost updates when multiple clients modify the same resource.

### How It Works

1. **GET requests** return an `ETag` header with the resource version:
   ```
   ETag: W/"resource-id-1"
   ```

2. **PATCH/PUT requests** can include an `If-Match` header:
   ```
   If-Match: W/"resource-id-1"
   ```

3. If the resource was modified, you'll get a `412 Precondition Failed` response.

### Example Workflow

```bash
# 1. Fetch the resource and note the ETag
curl -X GET /api/v1/customers/cust_123 \
  -H "Authorization: Bearer YOUR_API_KEY"
# Response header: ETag: W/"cust_123-1"

# 2. Update with If-Match to prevent conflicts
curl -X PATCH /api/v1/customers/cust_123 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "If-Match: W/\"cust_123-1\"" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'
```

### Supported Endpoints

ETag concurrency control is available on:
- `PATCH /customers/:id`
- `PATCH /offers/:id`
- `PATCH /promotions/:id`
- `PATCH /webhook-endpoints/:id`

---

## Offers

### List Offers

```
GET /offers
```

**Query Parameters:**

| Parameter | Type   | Description                                 |
| --------- | ------ | ------------------------------------------- |
| limit     | number | Max items to return (default: 20, max: 100) |
| cursor    | string | Pagination cursor                           |
| status    | string | Filter by status: `active`, `archived`      |

**Response:**

```json
{
  "data": [
    {
      "id": "offer_abc123",
      "workspaceId": "ws_xyz",
      "name": "Pro Plan",
      "description": "Everything you need",
      "status": "active",
      "currentVersionId": "ov_123",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "hasMore": false
}
```

### Get Offer

```
GET /offers/:id
```

**Response:**

```json
{
  "data": {
    "id": "offer_abc123",
    "name": "Pro Plan",
    "description": "Everything you need",
    "status": "active",
    "currentVersionId": "ov_123",
    "versions": [
      {
        "id": "ov_123",
        "offerId": "offer_abc123",
        "version": 1,
        "status": "published",
        "config": {
          "pricing": {
            "model": "flat",
            "currency": "USD",
            "amount": 2900,
            "interval": "month"
          },
          "trial": {
            "days": 14,
            "requirePaymentMethod": true
          },
          "entitlements": [
            { "featureKey": "seats", "value": 10, "valueType": "number" },
            {
              "featureKey": "api_access",
              "value": true,
              "valueType": "boolean"
            }
          ]
        },
        "publishedAt": "2024-01-15T10:30:00Z",
        "createdAt": "2024-01-15T10:00:00Z"
      }
    ],
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Create Offer

```
POST /offers
```

**Request Body:**

```json
{
  "name": "Pro Plan",
  "description": "Everything you need",
  "config": {
    "pricing": {
      "model": "flat",
      "currency": "USD",
      "amount": 2900,
      "interval": "month"
    },
    "trial": {
      "days": 14,
      "requirePaymentMethod": true
    },
    "entitlements": [
      { "featureKey": "seats", "value": 10, "valueType": "number" },
      { "featureKey": "api_access", "value": true, "valueType": "boolean" }
    ]
  }
}
```

### Publish Offer

```
POST /offers/:id/publish
```

Publishes the draft version of an offer.

**Request Body (optional):**

```json
{
  "versionId": "ov_123"
}
```

### Create New Version

```
POST /offers/:id/versions
```

Creates a new draft version from the current published version.

**Request Body:**

```json
{
  "config": {
    "pricing": {
      "model": "flat",
      "currency": "USD",
      "amount": 3900,
      "interval": "month"
    }
  }
}
```

### Archive Offer

```
POST /offers/:id/archive
```

Archives an offer. Existing subscriptions continue but new checkouts are disabled.

---

## Customers

### List Customers

```
GET /customers
```

**Query Parameters:**

| Parameter | Type   | Description         |
| --------- | ------ | ------------------- |
| limit     | number | Max items to return |
| cursor    | string | Pagination cursor   |
| email     | string | Filter by email     |

### Get Customer

```
GET /customers/:id
```

### Create Customer

```
POST /customers
```

**Request Body:**

```json
{
  "email": "customer@example.com",
  "name": "John Doe",
  "externalId": "your-internal-id",
  "metadata": {
    "company": "Acme Inc"
  }
}
```

### Update Customer

```
PATCH /customers/:id
```

### Get Customer Entitlements

```
GET /customers/:id/entitlements
```

Returns all active entitlements for the customer.

**Response:**

```json
{
  "data": {
    "customerId": "cust_123",
    "entitlements": [
      {
        "featureKey": "seats",
        "hasAccess": true,
        "value": 10,
        "valueType": "number"
      },
      {
        "featureKey": "api_access",
        "hasAccess": true,
        "value": true,
        "valueType": "boolean"
      }
    ],
    "activeSubscriptionIds": ["sub_456"]
  }
}
```

### Check Single Entitlement

```
GET /customers/:id/entitlements/check/:featureKey
```

**Response:**

```json
{
  "data": {
    "featureKey": "seats",
    "hasAccess": true,
    "value": 10,
    "valueType": "number"
  }
}
```

---

## Subscriptions

### List Subscriptions

```
GET /subscriptions
```

**Query Parameters:**

| Parameter  | Type   | Description         |
| ---------- | ------ | ------------------- |
| limit      | number | Max items to return |
| cursor     | string | Pagination cursor   |
| customerId | string | Filter by customer  |
| status     | string | Filter by status    |

### Get Subscription

```
GET /subscriptions/:id
```

**Response:**

```json
{
  "data": {
    "id": "sub_456",
    "workspaceId": "ws_xyz",
    "customerId": "cust_123",
    "offerId": "offer_abc",
    "offerVersionId": "ov_123",
    "status": "active",
    "currentPeriodStart": "2024-01-15T00:00:00Z",
    "currentPeriodEnd": "2024-02-15T00:00:00Z",
    "trialStart": null,
    "trialEnd": null,
    "cancelAt": null,
    "canceledAt": null,
    "endedAt": null,
    "metadata": {},
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Cancel Subscription

```
POST /subscriptions/:id/cancel
```

**Request Body:**

```json
{
  "cancelAtPeriodEnd": true,
  "reason": "Customer requested"
}
```

**Behavior:**

- `cancelAtPeriodEnd: true` - Subscription remains active until period end; entitlements preserved until then
- `cancelAtPeriodEnd: false` - Immediate cancellation; entitlements revoked immediately

### Change Subscription (Upgrade/Downgrade)

```
POST /subscriptions/:id/change
```

Changes the subscription to a different offer (plan upgrade or downgrade).

**Request Body:**

```json
{
  "newOfferId": "offer_xyz",
  "newOfferVersionId": "ov_456",
  "prorationBehavior": "create_prorations"
}
```

| Field             | Type          | Required | Description                                      |
| ----------------- | ------------- | -------- | ------------------------------------------------ |
| newOfferId        | string (UUID) | Yes      | The offer to change to                           |
| newOfferVersionId | string (UUID) | No       | Specific version (defaults to published)         |
| prorationBehavior | string        | No       | `create_prorations`, `none`, or `always_invoice` |

**Response:**

```json
{
  "data": {
    "id": "sub_456",
    "offerId": "offer_xyz",
    "offerVersionId": "ov_456",
    "status": "active",
    "metadata": {
      "previousOfferId": "offer_abc",
      "previousOfferVersionId": "ov_123",
      "changedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

**Proration Behaviors:**

- `create_prorations` (default) - Creates prorated charges/credits
- `none` - No proration; new price applies at next billing cycle
- `always_invoice` - Create prorations and immediately invoice

---

## Checkout

### Create Checkout Session

```
POST /checkout/sessions
```

**Request Body:**

```json
{
  "offerId": "offer_abc",
  "offerVersionId": "ov_123",
  "customerId": "cust_123",
  "customerEmail": "customer@example.com",
  "successUrl": "https://yourapp.com/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://yourapp.com/cancel",
  "allowPromotionCodes": true,
  "trialDays": 14,
  "metadata": {
    "internalRef": "campaign-123"
  }
}
```

**Response:**

```json
{
  "data": {
    "id": "checkout_789",
    "workspaceId": "ws_xyz",
    "offerId": "offer_abc",
    "offerVersionId": "ov_123",
    "status": "open",
    "sessionUrl": "https://checkout.stripe.com/...",
    "successUrl": "https://yourapp.com/success",
    "cancelUrl": "https://yourapp.com/cancel",
    "expiresAt": "2024-01-15T11:30:00Z",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Get Checkout Session

```
GET /checkout/sessions/:id
```

---

## Headless Checkout (Checkout Intents)

For custom checkout experiences, use Checkout Intents to create payment flows with your own UI.

### Get Quote

Get a price quote for an offer before creating a checkout intent.

```
POST /checkout/quotes
```

**Request Body:**

```json
{
  "offerId": "offer_abc",
  "promotionCode": "SAVE20"
}
```

**Response:**

```json
{
  "data": {
    "offerId": "offer_abc",
    "offerVersionId": "ov_123",
    "currency": "USD",
    "subtotal": 2900,
    "discount": 580,
    "tax": 0,
    "total": 2320,
    "interval": "month",
    "intervalCount": 1,
    "trial": {
      "days": 14,
      "requirePaymentMethod": true
    },
    "promotion": {
      "code": "SAVE20",
      "discountType": "percent",
      "discountValue": 20
    },
    "validationErrors": []
  }
}
```

### Create Checkout Intent

Creates a checkout intent and returns a client secret for Stripe.js payment confirmation.

```
POST /checkout/intents
```

**Headers:**

| Header          | Required | Description                             |
| --------------- | -------- | --------------------------------------- |
| Idempotency-Key | Yes      | Unique key to prevent duplicate charges |

**Request Body:**

```json
{
  "offerId": "offer_abc",
  "offerVersionId": "ov_123",
  "customerId": "cust_123",
  "customerEmail": "customer@example.com",
  "promotionCode": "SAVE20",
  "metadata": {
    "source": "mobile_app"
  }
}
```

| Field          | Type          | Required | Description                                        |
| -------------- | ------------- | -------- | -------------------------------------------------- |
| offerId        | string (UUID) | Yes      | The offer to purchase                              |
| offerVersionId | string (UUID) | No       | Specific version (defaults to published)           |
| customerId     | string (UUID) | No       | Existing customer ID                               |
| customerEmail  | string        | No       | Email for new customer (required if no customerId) |
| promotionCode  | string        | No       | Promo code to apply                                |
| metadata       | object        | No       | Custom key-value data                              |

**Response:**

```json
{
  "data": {
    "id": "ci_789",
    "status": "pending",
    "clientSecret": "pi_xxx_secret_yyy",
    "offerId": "offer_abc",
    "offerVersionId": "ov_123",
    "customerId": null,
    "currency": "USD",
    "subtotal": 2900,
    "discount": 580,
    "tax": 0,
    "total": 2320,
    "trialDays": 14,
    "promotionCode": "SAVE20",
    "subscriptionId": null,
    "expiresAt": "2024-01-16T10:30:00Z",
    "completedAt": null,
    "metadata": {},
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Client-Side Integration:**

Use the `clientSecret` with Stripe.js to confirm the payment:

```javascript
// For immediate payment (no trial)
const { error } = await stripe.confirmPayment({
  clientSecret: checkoutIntent.clientSecret,
  confirmParams: {
    return_url: "https://yourapp.com/checkout/complete",
  },
});

// For trial with payment method setup
const { error } = await stripe.confirmSetup({
  clientSecret: checkoutIntent.clientSecret,
  confirmParams: {
    return_url: "https://yourapp.com/checkout/complete",
  },
});
```

### Get Checkout Intent

Poll the checkout intent status to check completion.

```
GET /checkout/intents/:id
```

**Response:**

```json
{
  "data": {
    "id": "ci_789",
    "status": "succeeded",
    "clientSecret": "pi_xxx_secret_yyy",
    "offerId": "offer_abc",
    "offerVersionId": "ov_123",
    "customerId": "cust_123",
    "currency": "USD",
    "subtotal": 2900,
    "discount": 580,
    "tax": 0,
    "total": 2320,
    "trialDays": 14,
    "promotionCode": "SAVE20",
    "subscriptionId": "sub_456",
    "expiresAt": "2024-01-16T10:30:00Z",
    "completedAt": "2024-01-15T10:35:00Z",
    "metadata": {},
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Checkout Intent Statuses:**

| Status            | Description                              |
| ----------------- | ---------------------------------------- |
| `pending`         | Awaiting payment confirmation            |
| `processing`      | Payment being processed                  |
| `requires_action` | Additional authentication required (3DS) |
| `succeeded`       | Payment complete, subscription created   |
| `failed`          | Payment failed                           |
| `expired`         | Intent expired (24 hours)                |

---

## Usage (Metering)

Track and aggregate usage for usage-based billing.

### Ingest Usage Event

```
POST /usage/events
```

Record a single usage event.

**Request Body:**

```json
{
  "customerId": "cust_123",
  "subscriptionId": "sub_456",
  "metricKey": "api_calls",
  "quantity": 1,
  "timestamp": "2024-01-15T10:30:00Z",
  "idempotencyKey": "evt_abc123",
  "properties": {
    "endpoint": "/api/v1/users",
    "method": "GET"
  }
}
```

**Response:**

```json
{
  "id": "usage_evt_789",
  "deduplicated": false
}
```

### Ingest Batch Events

```
POST /usage/events/batch
```

Record up to 1000 usage events at once.

**Request Body:**

```json
{
  "events": [
    { "customerId": "cust_123", "metricKey": "api_calls", "quantity": 5 },
    { "customerId": "cust_123", "metricKey": "storage_gb", "quantity": 0.5 }
  ]
}
```

**Response:**

```json
{
  "ingested": 2,
  "deduplicated": 0
}
```

### Get Usage Summary

```
GET /usage/summary/:customerId/:metricKey?periodStart=...&periodEnd=...
```

Get aggregated usage for a customer and metric.

**Response:**

```json
{
  "metricKey": "api_calls",
  "totalQuantity": 15420,
  "eventCount": 8234,
  "periodStart": "2024-01-01T00:00:00Z",
  "periodEnd": "2024-01-31T23:59:59Z"
}
```

### List Usage Metrics

```
GET /usage/metrics
```

Get all defined usage metrics for the workspace.

### Create Usage Metric

```
POST /usage/metrics
```

**Request Body:**

```json
{
  "key": "api_calls",
  "name": "API Calls",
  "description": "Number of API requests made",
  "unit": "requests",
  "aggregation": "sum"
}
```

**Aggregation Types:**

| Type    | Description                        |
| ------- | ---------------------------------- |
| `sum`   | Add all values (default)           |
| `max`   | Take the maximum value             |
| `count` | Count number of events             |
| `last`  | Use the most recent value          |

---

## Events

### List Events

```
GET /events
```

**Query Parameters:**

| Parameter     | Type   | Description                                        |
| ------------- | ------ | -------------------------------------------------- |
| limit         | number | Max items to return (default: 50)                  |
| cursor        | string | Pagination cursor                                  |
| status        | string | Filter by status: `pending`, `processed`, `failed` |
| eventType     | string | Filter by event type                               |
| aggregateType | string | Filter by aggregate type                           |
| aggregateId   | string | Filter by aggregate ID                             |

**Response:**

```json
{
  "data": [
    {
      "id": "evt_123",
      "eventType": "subscription.created",
      "aggregateType": "subscription",
      "aggregateId": "sub_456",
      "status": "processed",
      "payload": {
        "subscription": { ... }
      },
      "processedAt": "2024-01-15T10:30:05Z",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "hasMore": false
}
```

### List Dead Letter Events

```
GET /events/dead-letter
```

Returns events that failed to deliver after all retry attempts.

**Response:**

```json
{
  "data": [
    {
      "id": "dle_123",
      "originalEventId": "evt_456",
      "endpointId": "we_789",
      "endpointUrl": "https://example.com/webhooks",
      "eventType": "subscription.created",
      "payload": { ... },
      "failureReason": "Connection timeout",
      "attempts": 7,
      "lastAttemptAt": "2024-01-15T18:30:00Z",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "hasMore": false
}
```

---

## Audit Logs

### List Audit Logs

```
GET /audit-logs
```

**Query Parameters:**

| Parameter    | Type   | Description                                             |
| ------------ | ------ | ------------------------------------------------------- |
| limit        | number | Max items to return (default: 50)                       |
| cursor       | string | Pagination cursor                                       |
| actorType    | string | Filter by actor: `api_key`, `user`, `system`, `webhook` |
| actorId      | string | Filter by actor ID                                      |
| action       | string | Filter by action (e.g., `create`, `update`, `delete`)   |
| resourceType | string | Filter by resource type                                 |
| resourceId   | string | Filter by resource ID                                   |
| startDate    | string | ISO 8601 start date                                     |
| endDate      | string | ISO 8601 end date                                       |

**Response:**

```json
{
  "data": [
    {
      "id": "log_123",
      "actorType": "api_key",
      "actorId": "key_456",
      "action": "create",
      "resourceType": "subscription",
      "resourceId": "sub_789",
      "changes": {
        "status": { "from": null, "to": "active" }
      },
      "metadata": {},
      "ipAddress": "192.168.1.1",
      "userAgent": "curl/7.64.1",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "hasMore": false
}
```

---

## Webhook Endpoints

### List Webhook Endpoints

```
GET /webhook-endpoints
```

### Create Webhook Endpoint

```
POST /webhook-endpoints
```

**Request Body:**

```json
{
  "url": "https://yourapp.com/webhooks/zentla",
  "events": [
    "subscription.created",
    "subscription.updated",
    "subscription.canceled",
    "checkout.completed"
  ],
  "description": "Main webhook handler"
}
```

**Response includes signing secret (shown only once):**

```json
{
  "data": {
    "id": "we_123",
    "url": "https://yourapp.com/webhooks/zentla",
    "events": ["subscription.created", "subscription.updated"],
    "status": "active",
    "secret": "whsec_abc123..."
  }
}
```

### Update Webhook Endpoint

```
PATCH /webhook-endpoints/:id
```

### Delete Webhook Endpoint

```
DELETE /webhook-endpoints/:id
```

### Rotate Signing Secret

```
POST /webhook-endpoints/:id/rotate-secret
```

Returns the new secret.

---

## API Keys

### List API Keys

```
GET /api-keys
```

### Create API Key

```
POST /api-keys
```

**Request Body:**

```json
{
  "name": "Production Key",
  "role": "admin",
  "expiresAt": "2025-01-15T00:00:00Z"
}
```

**Response (key shown only once):**

```json
{
  "data": {
    "id": "key_123",
    "name": "Production Key",
    "key": "zentla_live_abc123...",
    "role": "admin",
    "expiresAt": "2025-01-15T00:00:00Z",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Revoke API Key

```
DELETE /api-keys/:id
```

---

## Workspaces

### Get Current Workspace

```
GET /workspaces/current
```

---

## Health

### Health Check

```
GET /health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

---

## Error Codes

| Code               | Description                         |
| ------------------ | ----------------------------------- |
| `VALIDATION_ERROR` | Input validation failed             |
| `NOT_FOUND`        | Resource not found                  |
| `UNAUTHORIZED`     | Invalid or missing API key          |
| `FORBIDDEN`        | Insufficient permissions            |
| `RATE_LIMITED`     | Too many requests                   |
| `CONFLICT`         | Resource conflict (e.g., duplicate) |
| `INTERNAL_ERROR`   | Server error                        |

---

## Rate Limits

| Tier   | Window     | Limit        |
| ------ | ---------- | ------------ |
| Short  | 1 second   | 10 requests  |
| Medium | 10 seconds | 50 requests  |
| Long   | 60 seconds | 100 requests |

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1705315800
```

---

## Idempotency

For POST requests, use idempotency keys to prevent duplicates:

```
X-Idempotency-Key: unique-request-id-123
```

Duplicate requests within 24 hours return the cached response.
