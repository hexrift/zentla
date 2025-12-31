# @relay/sdk

TypeScript SDK for the Relay Subscription Commerce API.

## Installation

```bash
npm install @relay/sdk
# or
yarn add @relay/sdk
```

## Quick Start

```typescript
import { RelayClient } from "@relay/sdk";

const relay = new RelayClient({
  apiKey: "relay_live_xxxxx",
  baseUrl: "https://api.relay.com/api/v1", // optional
});

// Check customer entitlements
const { entitlements } = await relay.customers.getEntitlements("cust_123");
const hasPremium = entitlements.find(
  (e) => e.featureKey === "premium",
)?.hasAccess;

// Create a checkout session
const checkout = await relay.checkout.createSession({
  offerId: "offer_abc",
  customerEmail: "customer@example.com",
  successUrl: "https://yourapp.com/success",
  cancelUrl: "https://yourapp.com/cancel",
});

// Redirect user to checkout
window.location.href = checkout.sessionUrl;
```

## API Reference

### Offers

```typescript
// List offers
const { data: offers } = await relay.offers.list({ status: "active" });

// Get offer with versions
const offer = await relay.offers.get("offer_abc");

// Create offer
const newOffer = await relay.offers.create({
  name: "Pro Plan",
  description: "Everything you need",
  config: {
    pricing: {
      model: "flat",
      currency: "USD",
      amount: 2900,
      interval: "month",
    },
    trial: { days: 14, requirePaymentMethod: true },
    entitlements: [
      { featureKey: "seats", value: 10, valueType: "number" },
      { featureKey: "api_access", value: true, valueType: "boolean" },
    ],
  },
});

// Publish draft
await relay.offers.publish("offer_abc");

// Create new version
await relay.offers.createVersion("offer_abc", {
  pricing: { model: "flat", currency: "USD", amount: 3900, interval: "month" },
  entitlements: [{ featureKey: "seats", value: 25, valueType: "number" }],
});
```

### Customers

```typescript
// List customers
const { data: customers } = await relay.customers.list({
  email: "user@example.com",
});

// Get customer
const customer = await relay.customers.get("cust_123");

// Create customer
const newCustomer = await relay.customers.create({
  email: "user@example.com",
  name: "John Doe",
  externalId: "your-internal-id",
});

// Get all entitlements
const { entitlements, activeSubscriptionIds } =
  await relay.customers.getEntitlements("cust_123");

// Check single entitlement
const seatCheck = await relay.customers.checkEntitlement("cust_123", "seats");
if (seatCheck.hasAccess && seatCheck.value >= 10) {
  // Allow action
}
```

### Subscriptions

```typescript
// List subscriptions
const { data: subs } = await relay.subscriptions.list({
  customerId: "cust_123",
  status: "active",
});

// Get subscription
const sub = await relay.subscriptions.get("sub_456");

// Cancel at period end
await relay.subscriptions.cancel("sub_456", {
  cancelAtPeriodEnd: true,
  reason: "Customer requested",
});

// Cancel immediately (revokes entitlements)
await relay.subscriptions.cancel("sub_456", {
  cancelAtPeriodEnd: false,
});

// Upgrade/downgrade subscription
await relay.subscriptions.change("sub_456", {
  newOfferId: "offer_enterprise",
  prorationBehavior: "create_prorations",
});
```

### Checkout

```typescript
// Create checkout session
const checkout = await relay.checkout.createSession({
  offerId: "offer_abc",
  customerEmail: "customer@example.com",
  successUrl: "https://yourapp.com/success?session_id={CHECKOUT_SESSION_ID}",
  cancelUrl: "https://yourapp.com/cancel",
  allowPromotionCodes: true,
  trialDays: 14,
});

// Get session status
const session = await relay.checkout.getSession("checkout_789");
```

### Webhook Endpoints

```typescript
// Create webhook endpoint
const endpoint = await relay.webhooks.create({
  url: "https://yourapp.com/webhooks/relay",
  events: ["subscription.created", "subscription.canceled", "invoice.paid"],
  description: "Main handler",
});

// Save the secret (only shown once)
console.log("Webhook secret:", endpoint.secret);

// Rotate secret if compromised
const { secret } = await relay.webhooks.rotateSecret("we_123");

// Disable endpoint
await relay.webhooks.update("we_123", { status: "disabled" });

// Delete endpoint
await relay.webhooks.delete("we_123");
```

## Error Handling

```typescript
import { RelayClient, RelayError } from "@relay/sdk";

try {
  await relay.customers.get("invalid-id");
} catch (error) {
  if (error instanceof RelayError) {
    console.error(`Error ${error.status}: ${error.message}`);
    console.error(`Code: ${error.code}`);
  }
}
```

## TypeScript Types

All types are exported for use in your application:

```typescript
import type {
  Offer,
  OfferVersion,
  OfferConfig,
  Customer,
  Subscription,
  Checkout,
  WebhookEndpoint,
  EntitlementCheck,
  PaginatedResponse,
} from "@relay/sdk";
```

## Pagination

All list methods support cursor-based pagination:

```typescript
let cursor: string | undefined;
const allOffers: Offer[] = [];

do {
  const { data, hasMore, nextCursor } = await relay.offers.list({
    limit: 50,
    cursor,
  });
  allOffers.push(...data);
  cursor = hasMore ? nextCursor : undefined;
} while (cursor);
```

## Configuration

| Option  | Type   | Default                        | Description        |
| ------- | ------ | ------------------------------ | ------------------ |
| apiKey  | string | required                       | Your Relay API key |
| baseUrl | string | `https://api.relay.com/api/v1` | API base URL       |

## License

MIT
