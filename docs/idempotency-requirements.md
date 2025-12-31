# Idempotency Requirements

This document outlines where idempotency is required in Relay, how retries should behave, and testing requirements.

## What is Idempotency?

An operation is idempotent if performing it multiple times has the same effect as performing it once. This is critical for:

- Webhook processing (Stripe retries failed deliveries)
- API requests with network failures (client retries)
- Distributed systems with message queues

---

## Idempotency Key Locations

### 1. API Endpoints (Client-Provided Keys)

| Endpoint                         | Requires Key? | Key Source                 | Behavior                             |
| -------------------------------- | ------------- | -------------------------- | ------------------------------------ |
| `POST /offers`                   | Recommended   | `X-Idempotency-Key` header | Return cached response if key exists |
| `POST /offers/:id/publish`       | Required      | `X-Idempotency-Key` header | Prevent double-publish               |
| `POST /checkout/sessions`        | Required      | `X-Idempotency-Key` header | Prevent duplicate checkouts          |
| `POST /subscriptions/:id/cancel` | Required      | `X-Idempotency-Key` header | Prevent double-cancel                |
| `POST /customers`                | Recommended   | `X-Idempotency-Key` header | Prevent duplicate customers          |
| `POST /webhook-endpoints`        | Optional      | `X-Idempotency-Key` header | Low risk of duplicates               |
| `GET /*`                         | Not needed    | N/A                        | Reads are naturally idempotent       |
| `PATCH /*`                       | Not needed    | N/A                        | Updates are idempotent by design     |
| `DELETE /*`                      | Not needed    | N/A                        | Deletes are idempotent               |

### 2. Webhook Processing (System-Generated Keys)

| Webhook Event                   | Idempotency Key          | Deduplication Method            |
| ------------------------------- | ------------------------ | ------------------------------- |
| `checkout.session.completed`    | `stripe_event_id`        | Check `webhook_event` table     |
| `customer.subscription.created` | `stripe_subscription_id` | Check `provider_ref` exists     |
| `customer.subscription.updated` | `stripe_event_id`        | Store event ID after processing |
| `customer.subscription.deleted` | `stripe_event_id`        | Terminal state, safe to replay  |
| `invoice.paid`                  | `stripe_invoice_id`      | Check if period already updated |

### 3. Internal Operations

| Operation               | Key                               | Location                          |
| ----------------------- | --------------------------------- | --------------------------------- |
| Outbox event processing | `outbox_event.id`                 | Mark as `processed`               |
| Webhook delivery        | `webhook_event.id` + `attempt`    | Track in `webhook_event.attempts` |
| Entitlement granting    | `subscription_id` + `feature_key` | Unique constraint                 |

---

## Current Implementation Status

### Implemented

| Component              | File                        | Status                 |
| ---------------------- | --------------------------- | ---------------------- |
| Idempotency Middleware | `idempotency.middleware.ts` | Exists but needs fixes |
| IdempotencyKey Model   | `schema.prisma`             | Table exists           |
| Webhook Event Table    | `schema.prisma`             | Table exists           |

### Missing

| Component                         | Required For          | Priority |
| --------------------------------- | --------------------- | -------- |
| Webhook event ID deduplication    | Stripe webhooks       | High     |
| Provider ref checks before create | Subscription creation | High     |
| Checkout completion check         | Checkout webhook      | High     |
| Outbox processing lock            | Event fan-out         | Medium   |

---

## Retry Behavior

### Client Retries (API)

```
Request 1 (fails network) ──► Request 2 (same idempotency key)
                                      │
                                      ▼
                              ┌───────────────┐
                              │ Key exists in │
                              │ idempotency   │──► Return cached response
                              │ table?        │
                              └───────┬───────┘
                                      │ No
                                      ▼
                              ┌───────────────┐
                              │ Process       │
                              │ request       │
                              └───────────────┘
```

**Rules:**

1. Same key within TTL (24 hours) → return cached response
2. Same key after TTL → process as new request
3. Different key → process as new request
4. No key → process without idempotency (warn in logs)

### Stripe Webhook Retries

```
Webhook 1 (returns 500) ──► Stripe waits ──► Webhook 2 (same event)
                                                    │
                                                    ▼
                                            ┌───────────────┐
                                            │ Event ID in   │
                                            │ webhook_event │──► Return 200, skip
                                            │ table?        │
                                            └───────┬───────┘
                                                    │ No
                                                    ▼
                                            ┌───────────────┐
                                            │ Process event │
                                            │ Store event ID│
                                            └───────────────┘
```

**Rules:**

1. Always return 200 for known events (even if already processed)
2. Return 500 only for transient failures (DB down, etc.)
3. Return 400 for invalid signatures (Stripe won't retry)
4. Store event ID before processing to handle partial failures

### Outbox Event Retries

```
Worker picks event ──► Processing fails ──► Event stays "pending"
                                                    │
                                            Next worker cycle
                                                    │
                                                    ▼
                                            ┌───────────────┐
                                            │ Lock event    │
                                            │ (optimistic)  │
                                            └───────┬───────┘
                                                    │
                                                    ▼
                                            ┌───────────────┐
                                            │ Process &     │
                                            │ mark complete │
                                            └───────────────┘
```

**Rules:**

1. Use optimistic locking (version field) to prevent double-processing
2. Max retry attempts before moving to dead letter
3. Exponential backoff between attempts

---

## Testing Requirements

### Unit Tests

```typescript
describe('Idempotency Middleware', () => {
  it('returns cached response for same idempotency key', async () => {
    // First request
    const res1 = await request(app)
      .post('/api/v1/offers')
      .set('X-Idempotency-Key', 'test-key-123')
      .send({ name: 'Test Offer', ... });

    // Second request with same key
    const res2 = await request(app)
      .post('/api/v1/offers')
      .set('X-Idempotency-Key', 'test-key-123')
      .send({ name: 'Test Offer', ... });

    expect(res1.body.id).toBe(res2.body.id);
    expect(res1.status).toBe(res2.status);
  });

  it('processes new request for different idempotency key', async () => {
    const res1 = await request(app)
      .post('/api/v1/offers')
      .set('X-Idempotency-Key', 'key-1')
      .send({ name: 'Offer 1', ... });

    const res2 = await request(app)
      .post('/api/v1/offers')
      .set('X-Idempotency-Key', 'key-2')
      .send({ name: 'Offer 2', ... });

    expect(res1.body.id).not.toBe(res2.body.id);
  });

  it('expires idempotency keys after TTL', async () => {
    // Mock time, make request, advance time past TTL, make same request
    // Should create new resource
  });
});
```

### Integration Tests

```typescript
describe("Webhook Idempotency", () => {
  it("does not create duplicate subscription for replayed event", async () => {
    const event = createMockStripeEvent("checkout.session.completed");

    // First delivery
    await request(app)
      .post("/api/v1/webhooks/stripe")
      .set("stripe-signature", signEvent(event))
      .send(event);

    // Simulated retry
    await request(app)
      .post("/api/v1/webhooks/stripe")
      .set("stripe-signature", signEvent(event))
      .send(event);

    const subscriptions = await db.subscription.findMany({
      where: {
        /* matching criteria */
      },
    });

    expect(subscriptions).toHaveLength(1);
  });
});
```

### End-to-End Tests

```typescript
describe("Checkout to Subscription (E2E)", () => {
  it("handles network retry without duplicate subscription", async () => {
    // 1. Create checkout session
    // 2. Simulate Stripe sending webhook
    // 3. Simulate network failure (return 500)
    // 4. Simulate Stripe retry
    // 5. Verify single subscription exists
    // 6. Verify single set of entitlements
  });
});
```

### Load Tests

```typescript
describe('Concurrent Requests', () => {
  it('handles concurrent requests with same idempotency key', async () => {
    const key = 'concurrent-test-key';
    const requests = Array(10).fill(null).map(() =>
      request(app)
        .post('/api/v1/checkout/sessions')
        .set('X-Idempotency-Key', key)
        .send({ offerId: '...', ... })
    );

    const responses = await Promise.all(requests);

    // All should return same checkout session
    const ids = responses.map(r => r.body.id);
    expect(new Set(ids).size).toBe(1);
  });
});
```

---

## Duplicate Prevention Checklist

### Orders/Checkouts

- [ ] `X-Idempotency-Key` required on `POST /checkout/sessions`
- [ ] Idempotency key stored before Stripe API call
- [ ] Stripe Checkout Session ID stored in `provider_ref`
- [ ] `checkout.session.completed` event ID checked before processing
- [ ] Subscription not created if one exists for checkout

### Subscriptions

- [ ] `provider_ref` checked before creating subscription
- [ ] Subscription ID from Stripe stored immediately
- [ ] Updates use `updatedAt` or version for optimistic locking
- [ ] Cancel operation idempotent (already canceled = success)

### Entitlements

- [ ] Unique constraint on `(subscription_id, feature_key)`
- [ ] Upsert used instead of insert
- [ ] Expiration checked on read, not just write

### Webhooks

- [ ] Event ID stored in `webhook_event` table
- [ ] Check for existing event before processing
- [ ] Return 200 for already-processed events
- [ ] Signature verified before any processing

---

## Implementation Fixes Needed

### 1. Fix Idempotency Middleware

Current issue: Response stored as JSON but not properly typed.

```typescript
// Before
data: { response: JSON.parse(JSON.stringify(cachedResponse)) }

// After - store status code too
data: {
  statusCode: response.statusCode,
  body: responseBody,
  headers: relevantHeaders
}
```

### 2. Add Webhook Event Deduplication

```typescript
async handleStripeWebhook(event: Stripe.Event) {
  // Check if already processed
  const existing = await this.prisma.webhookEvent.findFirst({
    where: { externalId: event.id }
  });

  if (existing) {
    this.logger.log(`Skipping duplicate event: ${event.id}`);
    return { received: true, duplicate: true };
  }

  // Store event ID first (before processing)
  await this.prisma.webhookEvent.create({
    data: {
      externalId: event.id,
      eventType: event.type,
      status: 'processing',
      payload: event as any
    }
  });

  try {
    await this.processEvent(event);
    await this.prisma.webhookEvent.update({
      where: { externalId: event.id },
      data: { status: 'processed' }
    });
  } catch (error) {
    await this.prisma.webhookEvent.update({
      where: { externalId: event.id },
      data: { status: 'failed' }
    });
    throw error;
  }
}
```

### 3. Add Subscription Existence Check

```typescript
async createSubscriptionFromCheckout(checkoutSession: Stripe.Checkout.Session) {
  const stripeSubId = checkoutSession.subscription as string;

  // Check if subscription already exists
  const existingRef = await this.prisma.providerRef.findFirst({
    where: {
      provider: 'stripe',
      entityType: 'subscription',
      externalId: stripeSubId
    }
  });

  if (existingRef) {
    return this.prisma.subscription.findUnique({
      where: { id: existingRef.entityId }
    });
  }

  // Create new subscription...
}
```
