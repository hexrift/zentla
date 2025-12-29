# Core Concepts

## Provider-Agnostic Architecture

Relay acts as an orchestration layer between your application and billing providers like Stripe or Zuora. Your application code only interacts with Relay's canonical domain model - never directly with provider-specific APIs.

### ProviderRef Mapping

Every entity in Relay can be mapped to external provider IDs via the `ProviderRef` table:

```
Relay Offer (id: abc-123) <-> Stripe Product (id: prod_xyz)
Relay Subscription <-> Stripe Subscription
```

This allows:
- Switching providers without code changes
- Using multiple providers simultaneously
- Keeping your domain model clean

## Offers and Versioning

### Immutable Versions

Offers use immutable versioning similar to how Stripe handles prices:

1. **Create Offer** - Creates with an initial draft version
2. **Edit Draft** - Modify the draft version freely
3. **Publish** - Locks the version, makes it active
4. **New Version** - Create a new draft from any version
5. **Rollback** - Create a draft from a previous version

```
v1 (published) -> v2 (published) -> v3 (draft)
                                     ^
                                     |
                        v4 (rollback from v1)
```

### Version Lifecycle

- `draft` - Editable, not visible to checkout
- `published` - Active, used for new subscriptions
- `archived` - Historical, existing subscriptions continue

## Subscriptions

### Status Flow

```
incomplete -> trialing -> active -> canceled
                |           |
                v           v
              past_due -> unpaid
```

### Entitlements

Entitlements are derived from the active subscription's offer configuration:

```typescript
// Offer config
{
  entitlements: [
    { featureKey: 'seats', value: 10, valueType: 'number' },
    { featureKey: 'api_access', value: true, valueType: 'boolean' },
    { featureKey: 'storage_gb', value: 100, valueType: 'number' },
  ]
}

// Check at runtime
const check = await relay.customers.checkEntitlement(customerId, 'seats');
// { featureKey: 'seats', hasAccess: true, value: 10, valueType: 'number' }
```

## Multi-Tenancy

### Workspace Isolation

Every resource belongs to a workspace. API keys are scoped to workspaces:

```
Workspace A
├── Offers
├── Customers
├── Subscriptions
└── API Keys (relay_live_aaa..., relay_test_aaa...)

Workspace B
├── Offers
├── Customers
├── Subscriptions
└── API Keys (relay_live_bbb..., relay_test_bbb...)
```

### Environment Separation

- `relay_live_*` - Production environment
- `relay_test_*` - Test environment

Test keys interact with test data and Stripe test mode.

## Webhooks

### Inbound (Provider -> Relay)

```
Stripe Webhook -> /webhooks/stripe -> Verify Signature -> Normalize -> Outbox
```

### Outbound (Relay -> Your App)

```
Outbox Event -> Fan-out to Endpoints -> Sign Payload -> Deliver with Retry
```

### Event Types

- `subscription.created`
- `subscription.updated`
- `subscription.canceled`
- `subscription.renewed`
- `checkout.completed`
- `checkout.expired`
- `customer.created`
- `invoice.paid`
- `invoice.payment_failed`

## Checkout Flow

```
1. Create Offer (draft)
2. Configure pricing, trials, entitlements
3. Publish Offer
4. Create Checkout Session (offerId, successUrl, cancelUrl)
5. Redirect customer to provider checkout (Stripe Checkout)
6. Customer completes payment
7. Webhook received (checkout.session.completed)
8. Relay creates Customer, Subscription, Entitlements
9. Redirect to successUrl
```
