# Stripe Event Lifecycle Mapping

This document maps Stripe webhook events to Relay domain events and state transitions.

## Event Mapping Table

| Stripe Event | Relay Domain Event | State Transition | Idempotency Rule |
|-------------|-------------------|------------------|------------------|
| `checkout.session.completed` | `checkout.completed` | Checkout: `open` → `complete` | Process once per `checkout.session.id`. Create subscription only if none exists for this checkout. |
| `checkout.session.expired` | `checkout.expired` | Checkout: `open` → `expired` | Idempotent by nature (terminal state) |
| `customer.created` | `customer.synced` | Create/update Customer record | Upsert by `provider_ref.external_id` |
| `customer.updated` | `customer.synced` | Update Customer metadata | Safe to replay |
| `customer.deleted` | `customer.deleted` | Soft-delete or mark inactive | Check if already deleted |
| `invoice.paid` | `invoice.paid` | Update subscription period dates | Dedupe by `invoice.id` |
| `invoice.payment_failed` | `invoice.payment_failed` | Subscription: `active` → `past_due` | Log attempt, update status |
| `subscription_schedule.created` | (internal) | Store schedule reference | Upsert by schedule ID |
| `customer.subscription.created` | `subscription.created` | Create Subscription: `incomplete` → `active`/`trialing` | Create only if not exists by `provider_ref` |
| `customer.subscription.updated` | `subscription.updated` | Update status, dates, offer | Always apply latest state |
| `customer.subscription.deleted` | `subscription.canceled` | Subscription: * → `canceled` | Terminal state, safe to replay |
| `customer.subscription.trial_will_end` | `subscription.trial_ending` | (notification only) | No state change, emit event |
| `customer.subscription.paused` | `subscription.paused` | Subscription: `active` → `paused` | Update status |
| `customer.subscription.resumed` | `subscription.resumed` | Subscription: `paused` → `active` | Update status |
| `payment_intent.succeeded` | (internal) | Confirm payment for checkout | Part of checkout flow |
| `payment_intent.payment_failed` | `payment.failed` | Log failure, notify | Retry logic in Stripe |

## State Machine: Subscription

```
                    ┌─────────────┐
                    │  incomplete │
                    └──────┬──────┘
                           │ checkout.session.completed
                           ▼
              ┌────────────────────────┐
              │                        │
         ┌────▼────┐            ┌──────▼─────┐
         │ trialing │───────────▶│   active   │
         └────┬────┘  trial_end  └──────┬─────┘
              │                         │
              │                         │ payment_failed
              │                         ▼
              │                  ┌──────────┐
              │                  │ past_due │
              │                  └────┬─────┘
              │                       │
              │    ┌──────────────────┼──────────────────┐
              │    │                  │                  │
              │    ▼                  ▼                  ▼
              │ ┌──────┐        ┌─────────┐        ┌────────┐
              │ │unpaid│        │ canceled│        │recovered│
              │ └──────┘        └─────────┘        │→ active │
              │                       ▲            └────────┘
              │                       │
              └───────────────────────┘
                    cancel request
```

## State Machine: Checkout

```
┌─────────┐    create    ┌──────┐    session_url    ┌──────┐
│ pending │─────────────▶│ open │──────────────────▶│ open │
└─────────┘              └──┬───┘                   └──┬───┘
                            │                          │
              ┌─────────────┼──────────────────────────┤
              │             │                          │
              ▼             ▼                          ▼
        ┌─────────┐   ┌──────────┐              ┌──────────┐
        │ expired │   │ complete │              │ complete │
        └─────────┘   └──────────┘              └──────────┘
```

## Idempotency Rules

### 1. Checkout Completion
```typescript
// Before creating subscription:
const existing = await findSubscriptionByCheckoutId(checkoutId);
if (existing) {
  return existing; // Already processed
}
```

### 2. Subscription Creation
```typescript
// Use provider_ref to check existence:
const ref = await findProviderRef({
  entityType: 'subscription',
  provider: 'stripe',
  externalId: stripeSubscriptionId
});
if (ref) {
  return findSubscriptionById(ref.entityId); // Already exists
}
```

### 3. Event Deduplication
```typescript
// Store processed event IDs:
const processed = await findWebhookEvent(stripeEventId);
if (processed) {
  return { status: 'already_processed' };
}
await createWebhookEvent({ id: stripeEventId, ... });
```

## Failure Handling

| Failure Scenario | Behavior | Recovery |
|-----------------|----------|----------|
| Webhook signature invalid | Return 400, do not process | Stripe will not retry |
| Database unavailable | Return 500, Stripe retries | Automatic retry (up to 3 days) |
| Partial processing failure | Return 500, Stripe retries | Must be idempotent |
| Duplicate event received | Return 200, skip processing | Log and ignore |
| Unknown event type | Return 200, log warning | No action needed |
| Provider ref not found | Create new mapping | Eventual consistency |

## Retry Behavior

Stripe retries failed webhooks with exponential backoff:
- 1st retry: ~1 minute
- 2nd retry: ~5 minutes
- 3rd retry: ~30 minutes
- Continues for up to 3 days

**Critical**: Webhook handlers MUST be idempotent because retries are guaranteed.

## Event Processing Order

Events may arrive out of order. Handle gracefully:

```typescript
// Example: subscription.updated arrives before subscription.created
async function handleSubscriptionUpdated(event) {
  let subscription = await findByProviderRef(event.data.object.id);

  if (!subscription) {
    // Create it first (out-of-order handling)
    subscription = await createFromStripeData(event.data.object);
  }

  // Now update
  await updateSubscription(subscription.id, event.data.object);
}
```

## Webhook Endpoint Security

1. **Signature Verification**: Always verify `stripe-signature` header
2. **Raw Body**: Must use raw request body (not parsed JSON)
3. **Timing**: Verify within tolerance window (default 300s)
4. **HTTPS Only**: Production webhooks must use HTTPS
5. **IP Allowlist**: Optional, Stripe publishes webhook IPs

## Testing Webhooks

```bash
# Forward Stripe test events to local:
stripe listen --forward-to localhost:3002/api/v1/webhooks/stripe

# Trigger specific events:
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.payment_failed
```
