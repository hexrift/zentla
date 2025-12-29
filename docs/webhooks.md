# Webhooks

Relay uses webhooks to notify your application of events in real-time.

## Event Flow

```
Provider (Stripe) -> Relay Inbound Webhook -> Normalize Event -> Outbox -> Your Webhook Endpoint
```

## Setting Up Webhooks

### 1. Create a Webhook Endpoint

```typescript
const endpoint = await relay.webhooks.create({
  url: 'https://yourapp.com/webhooks/relay',
  events: [
    'subscription.created',
    'subscription.updated',
    'subscription.canceled',
    'checkout.completed',
  ],
  description: 'Main webhook handler',
});

// Save the secret securely - it's only shown once
const webhookSecret = endpoint.secret;
```

### 2. Implement Your Handler

```typescript
import crypto from 'crypto';
import express from 'express';

const app = express();

// Use raw body for signature verification
app.post(
  '/webhooks/relay',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signature = req.headers['relay-signature'] as string;
    const payload = req.body;

    // Verify signature
    if (!verifySignature(payload, signature, process.env.RELAY_WEBHOOK_SECRET)) {
      return res.status(400).send('Invalid signature');
    }

    const event = JSON.parse(payload.toString());

    // Handle event
    switch (event.type) {
      case 'subscription.created':
        handleSubscriptionCreated(event.data);
        break;
      case 'subscription.canceled':
        handleSubscriptionCanceled(event.data);
        break;
      case 'checkout.completed':
        handleCheckoutCompleted(event.data);
        break;
    }

    res.json({ received: true });
  }
);

function verifySignature(
  payload: Buffer,
  signature: string,
  secret: string
): boolean {
  const [timestampPart, hashPart] = signature.split(',');
  const timestamp = timestampPart.replace('t=', '');
  const receivedHash = hashPart.replace('v1=', '');

  // Check timestamp to prevent replay attacks (5 minute tolerance)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }

  // Compute expected hash
  const signedPayload = `${timestamp}.${payload.toString()}`;
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(receivedHash),
    Buffer.from(expectedHash)
  );
}
```

## Event Types

### Subscription Events

#### `subscription.created`

Fired when a new subscription is created.

```json
{
  "id": "evt_123",
  "type": "subscription.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "id": "sub_456",
    "customerId": "cust_789",
    "offerId": "offer_abc",
    "offerVersionId": "ov_123",
    "status": "active",
    "currentPeriodStart": "2024-01-15T00:00:00Z",
    "currentPeriodEnd": "2024-02-15T00:00:00Z"
  }
}
```

#### `subscription.updated`

Fired when a subscription is modified (plan change, status change).

```json
{
  "id": "evt_124",
  "type": "subscription.updated",
  "timestamp": "2024-01-15T10:35:00Z",
  "data": {
    "id": "sub_456",
    "status": "active",
    "previousStatus": "trialing"
  }
}
```

#### `subscription.canceled`

Fired when a subscription is canceled.

```json
{
  "id": "evt_125",
  "type": "subscription.canceled",
  "timestamp": "2024-01-15T10:40:00Z",
  "data": {
    "id": "sub_456",
    "customerId": "cust_789",
    "canceledAt": "2024-01-15T10:40:00Z",
    "cancelAtPeriodEnd": true,
    "reason": "Customer requested"
  }
}
```

#### `subscription.renewed`

Fired when a subscription renews for a new period.

```json
{
  "id": "evt_126",
  "type": "subscription.renewed",
  "timestamp": "2024-02-15T00:00:00Z",
  "data": {
    "id": "sub_456",
    "currentPeriodStart": "2024-02-15T00:00:00Z",
    "currentPeriodEnd": "2024-03-15T00:00:00Z"
  }
}
```

### Checkout Events

#### `checkout.completed`

Fired when a checkout session is completed successfully.

```json
{
  "id": "evt_127",
  "type": "checkout.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "checkoutId": "checkout_789",
    "customerId": "cust_789",
    "subscriptionId": "sub_456",
    "offerId": "offer_abc"
  }
}
```

#### `checkout.expired`

Fired when a checkout session expires without completion.

```json
{
  "id": "evt_128",
  "type": "checkout.expired",
  "timestamp": "2024-01-15T11:30:00Z",
  "data": {
    "checkoutId": "checkout_789",
    "offerId": "offer_abc"
  }
}
```

### Customer Events

#### `customer.created`

Fired when a new customer is created.

```json
{
  "id": "evt_129",
  "type": "customer.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "id": "cust_789",
    "email": "customer@example.com",
    "name": "John Doe"
  }
}
```

### Invoice Events

#### `invoice.paid`

Fired when an invoice is successfully paid.

```json
{
  "id": "evt_130",
  "type": "invoice.paid",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "invoiceId": "inv_123",
    "customerId": "cust_789",
    "subscriptionId": "sub_456",
    "amountPaid": 2900,
    "currency": "USD"
  }
}
```

#### `invoice.payment_failed`

Fired when an invoice payment attempt fails.

```json
{
  "id": "evt_131",
  "type": "invoice.payment_failed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "invoiceId": "inv_123",
    "customerId": "cust_789",
    "subscriptionId": "sub_456",
    "attemptCount": 1,
    "nextAttemptAt": "2024-01-18T10:30:00Z"
  }
}
```

## Signature Format

Webhook signatures use HMAC-SHA256 and include a timestamp:

```
Relay-Signature: t=1705315800,v1=abc123def456...
```

- `t`: Unix timestamp when the webhook was sent
- `v1`: HMAC-SHA256 signature of `{timestamp}.{payload}`

## Retry Policy

Failed webhook deliveries are retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |
| 6 | 8 hours |
| 7 | 24 hours |

After 7 failed attempts, the event is moved to the dead letter queue.

## Dead Letter Queue

Failed events can be reviewed and replayed via the Admin UI or API:

```typescript
// List failed events
GET /webhook-endpoints/:id/dead-letter

// Replay a failed event
POST /webhook-endpoints/:id/dead-letter/:eventId/replay
```

## Best Practices

### 1. Acknowledge Quickly

Return a 2xx response as quickly as possible. Process events asynchronously:

```typescript
app.post('/webhooks/relay', async (req, res) => {
  // Verify signature first
  if (!verifySignature(req.body, req.headers['relay-signature'], secret)) {
    return res.status(400).send('Invalid signature');
  }

  // Acknowledge immediately
  res.json({ received: true });

  // Process asynchronously
  const event = JSON.parse(req.body.toString());
  await queue.add('process-webhook', event);
});
```

### 2. Handle Duplicates

Events may be delivered more than once. Use the event ID for idempotency:

```typescript
async function handleEvent(event) {
  // Check if already processed
  const existing = await db.processedEvents.findUnique({
    where: { eventId: event.id },
  });

  if (existing) {
    return; // Already processed
  }

  // Process event
  await processEvent(event);

  // Mark as processed
  await db.processedEvents.create({
    data: { eventId: event.id, processedAt: new Date() },
  });
}
```

### 3. Verify Signatures

Always verify webhook signatures to ensure authenticity:

```typescript
if (!verifySignature(payload, signature, secret)) {
  return res.status(400).send('Invalid signature');
}
```

### 4. Check Timestamps

Reject webhooks with old timestamps to prevent replay attacks:

```typescript
const timestamp = parseInt(signature.split(',')[0].replace('t=', ''));
const now = Math.floor(Date.now() / 1000);

if (Math.abs(now - timestamp) > 300) {
  return res.status(400).send('Timestamp too old');
}
```

### 5. Use Raw Body

Parse the raw body for signature verification, then parse JSON:

```typescript
// Express
app.post('/webhooks', express.raw({ type: 'application/json' }), handler);

// Fastify
fastify.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (req, body, done) => done(null, body)
);
```

## Managing Endpoints

### Rotate Secrets

If a secret is compromised, rotate it immediately:

```typescript
const { secret } = await relay.webhooks.rotateSecret(endpointId);
// Update your application with the new secret
```

### Disable Endpoint

Temporarily disable an endpoint without deleting it:

```typescript
await relay.webhooks.update(endpointId, { status: 'disabled' });
```

### Filter Events

Only subscribe to events you need:

```typescript
await relay.webhooks.create({
  url: 'https://yourapp.com/webhooks',
  events: ['subscription.created', 'subscription.canceled'],
});
```
