# Golden Path Analysis

End-to-end walkthrough of the Zentla subscription flow with gap analysis.

## The Golden Path

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RELAY GOLDEN PATH                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. CREATE OFFER    2. PUBLISH       3. CHECKOUT      4. PAYMENT            │
│  ┌──────────┐      ┌──────────┐     ┌──────────┐     ┌──────────┐          │
│  │ Draft    │ ───▶ │ Published│ ───▶│ Session  │ ───▶│ Stripe   │          │
│  │ Offer    │      │ Offer    │     │ Created  │     │ Checkout │          │
│  └──────────┘      └──────────┘     └──────────┘     └──────────┘          │
│                                                            │                │
│  5. SUBSCRIPTION   6. ENTITLEMENTS  7. CUSTOMER ACCESS     │                │
│  ┌──────────┐      ┌──────────┐     ┌──────────┐          │                │
│  │ Active   │ ◀─── │ Granted  │ ◀───│ Feature  │ ◀────────┘                │
│  │ Sub      │      │ Access   │     │ Checks   │                           │
│  └──────────┘      └──────────┘     └──────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Step-by-Step Walkthrough

### Step 1: Create Offer

**Action**: Admin creates a new offer in the dashboard

**API Call**:

```http
POST /api/v1/offers
{
  "name": "Pro Plan",
  "description": "Everything you need",
  "config": {
    "pricing": { "model": "flat", "amount": 2900, "currency": "USD", "interval": "month" },
    "trial": { "days": 14, "requirePaymentMethod": true },
    "entitlements": [
      { "featureKey": "seats", "value": 10, "valueType": "number" }
    ]
  }
}
```

**State**: Offer created with version 1 in `draft` status

| Status     | Gap? | Issue                                |
| ---------- | ---- | ------------------------------------ |
| API        | OK   | Works                                |
| UI         | OK   | `/offers/new` page exists            |
| Validation | GAP  | No validation for pricing amount > 0 |

---

### Step 2: Publish Offer

**Action**: Admin publishes the draft version

**API Call**:

```http
POST /api/v1/offers/:id/publish
{ "versionId": "optional-specific-version" }
```

**State**: OfferVersion status `draft` → `published`

| Status      | Gap?    | Issue                                    |
| ----------- | ------- | ---------------------------------------- |
| API         | OK      | Works                                    |
| UI          | PARTIAL | Button exists but no confirmation dialog |
| Stripe Sync | GAP     | Does NOT sync to Stripe Products/Prices  |

**Critical Gap**: Publishing an offer should:

1. Create/update Stripe Product
2. Create Stripe Price for the version
3. Store `provider_ref` mappings

---

### Step 3: Create Checkout Session

**Action**: Developer's app calls Zentla to start checkout

**API Call**:

```http
POST /api/v1/checkout/sessions
{
  "offerId": "uuid",
  "customerEmail": "user@example.com",
  "successUrl": "https://app.com/success",
  "cancelUrl": "https://app.com/cancel"
}
```

**Expected Response**:

```json
{
  "id": "checkout-uuid",
  "sessionUrl": "https://checkout.stripe.com/...",
  "expiresAt": "2024-01-01T00:00:00Z"
}
```

| Status   | Gap? | Issue                                     |
| -------- | ---- | ----------------------------------------- |
| API      | GAP  | Controller exists but doesn't call Stripe |
| Stripe   | GAP  | No Stripe Checkout Session creation       |
| Customer | GAP  | Customer not created/linked if new        |

**Current Code Issue** (`checkout.controller.ts`):

```typescript
// Currently returns stub data, needs:
// 1. Get or create Customer
// 2. Get Stripe Price ID from provider_ref
// 3. Create Stripe Checkout Session
// 4. Store Checkout record with session URL
// 5. Return redirect URL
```

---

### Step 4: Customer Completes Payment

**Action**: Customer completes Stripe Checkout

**Stripe Webhook**: `checkout.session.completed`

| Status                 | Gap? | Issue                                     |
| ---------------------- | ---- | ----------------------------------------- |
| Webhook Endpoint       | OK   | Route exists at `/api/v1/webhooks/stripe` |
| Signature Verification | GAP  | Not implemented                           |
| Event Processing       | GAP  | Handler is a stub                         |
| Subscription Creation  | GAP  | Not implemented                           |

**Current Code** (`webhooks.controller.ts`):

```typescript
// Currently just returns { received: true }
// Needs full implementation
```

---

### Step 5: Subscription Created

**Action**: Zentla creates subscription from webhook

**Expected**:

1. Parse `checkout.session.completed` event
2. Extract `subscription` ID from event
3. Fetch full subscription from Stripe
4. Create Zentla Subscription record
5. Create `provider_ref` mapping
6. Emit `subscription.created` domain event

| Status               | Gap?    | Issue                       |
| -------------------- | ------- | --------------------------- |
| Subscription Model   | OK      | Prisma model exists         |
| Subscription Service | PARTIAL | CRUD exists, no Stripe sync |
| Provider Ref         | GAP     | Not created during webhook  |
| Domain Events        | GAP     | Not emitted                 |

---

### Step 6: Entitlements Granted

**Action**: System grants entitlements based on offer config

**Expected**:

1. Read entitlements from OfferVersion config
2. Create Entitlement records for customer
3. Set expiration based on subscription period

| Status              | Gap? | Issue                                |
| ------------------- | ---- | ------------------------------------ |
| Entitlement Model   | OK   | Prisma model exists                  |
| Entitlement Service | OK   | Basic CRUD works                     |
| Auto-Grant          | GAP  | Not triggered on subscription create |

**Missing Logic**:

```typescript
async function grantEntitlements(subscription: Subscription) {
  const offerVersion = await getOfferVersion(subscription.offerVersionId);
  const entitlements = offerVersion.config.entitlements;

  for (const e of entitlements) {
    await createEntitlement({
      customerId: subscription.customerId,
      subscriptionId: subscription.id,
      featureKey: e.featureKey,
      value: e.value,
      valueType: e.valueType,
      expiresAt: subscription.currentPeriodEnd,
    });
  }
}
```

---

### Step 7: Feature Access Check

**Action**: Developer's app checks if customer has access

**API Call**:

```http
GET /api/v1/customers/:id/entitlements/check/seats
```

**Response**:

```json
{
  "featureKey": "seats",
  "hasAccess": true,
  "value": 10,
  "valueType": "number"
}
```

| Status  | Gap?    | Issue                            |
| ------- | ------- | -------------------------------- |
| API     | OK      | Endpoint works                   |
| Logic   | PARTIAL | Checks existence, not expiration |
| Caching | GAP     | No caching layer                 |

---

## Gap Summary

### Critical (Blocking)

| #   | Gap                                    | Impact                    | Fix Effort |
| --- | -------------------------------------- | ------------------------- | ---------- |
| 1   | Checkout doesn't create Stripe session | Cannot complete purchase  | Medium     |
| 2   | Webhook handler is stub                | No subscription created   | Medium     |
| 3   | Offer publish doesn't sync to Stripe   | No Stripe Price to charge | Medium     |
| 4   | Entitlements not auto-granted          | No feature access         | Low        |

### Important (Degraded Experience)

| #   | Gap                                | Impact                     | Fix Effort |
| --- | ---------------------------------- | -------------------------- | ---------- |
| 5   | No webhook signature verification  | Security risk              | Low        |
| 6   | No domain events emitted           | No outbound webhooks       | Medium     |
| 7   | Customer not created from checkout | Manual customer management | Low        |
| 8   | No entitlement expiration check    | Stale access               | Low        |

### Nice to Have

| #   | Gap                           | Impact              | Fix Effort |
| --- | ----------------------------- | ------------------- | ---------- |
| 9   | No publish confirmation in UI | UX                  | Low        |
| 10  | No entitlement caching        | Performance         | Medium     |
| 11  | No subscription change flow   | Limited flexibility | High       |

---

## UX Gaps

### Admin Dashboard

1. **Empty States**: No helpful messaging when no offers/subscriptions exist
2. **Loading States**: Basic "Loading..." text, no skeletons
3. **Error Handling**: Errors shown but no retry options
4. **Confirmation Dialogs**: Missing for destructive actions (archive, cancel)
5. **Test vs Live Mode**: No visual indicator of environment
6. **Offer Preview**: Cannot preview checkout before publishing

### Developer Experience

1. **API Errors**: Generic error messages, need specific codes
2. **Webhook Debugging**: No webhook event log in dashboard
3. **SDK Types**: SDK uses `unknown` types, need proper typing
4. **API Key Scoping**: Cannot create read-only keys easily

---

## Assumptions Made

1. **Single Currency**: Offer has one currency (no multi-currency support)
2. **One Active Subscription**: Customer can only have one subscription per offer
3. **Immediate Access**: Entitlements granted immediately on payment
4. **No Prorations**: Subscription changes not yet supported
5. **Stripe Only**: Zuora is stubbed out
6. **No User Auth**: API key only, no user sessions in dashboard

---

## Recommended Fix Order

1. **Implement Stripe Checkout flow** - Unblocks everything
2. **Implement webhook processing** - Completes the loop
3. **Add entitlement auto-grant** - Delivers value
4. **Add offer → Stripe sync** - Production ready
5. **Add signature verification** - Security
6. **Improve UI feedback** - Polish
