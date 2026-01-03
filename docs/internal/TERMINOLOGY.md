# Zentla Terminology Mapping

## Overview

This document defines Zentla's domain terminology and identifies areas where provider-specific (Stripe/Zuora) terminology has leaked into the core domain.

## Terminology Categories

### 1. Zentla-Native Terms (Keep As-Is)

These are Zentla's unique concepts that differentiate it from providers:

| Term              | Definition                                                      | Files                                     |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------- |
| **Offer**         | A purchasable product configuration (replaces Stripe's "Price") | `packages/core/src/domain/offer.ts`       |
| **OfferVersion**  | Versioned instance of an offer for price/feature changes        | `packages/core/src/domain/offer.ts`       |
| **Entitlement**   | Feature access granted by a subscription                        | `packages/core/src/domain/entitlement.ts` |
| **Workspace**     | Multi-tenant container (replaces Stripe's "Account")            | `packages/core/src/domain/workspace.ts`   |
| **Promotion**     | Discount configuration (replaces Stripe's "Coupon")             | `packages/core/src/domain/promotion.ts`   |
| **PromotionCode** | Redeemable code for a promotion                                 | `packages/core/src/domain/promotion.ts`   |

### 2. Industry-Standard Terms (Keep As-Is)

These terms are widely understood and don't need replacement:

| Term                      | Usage               | Notes                              |
| ------------------------- | ------------------- | ---------------------------------- |
| `active`                  | Subscription status | Universal term                     |
| `canceled`                | Subscription status | Universal term                     |
| `paused`                  | Subscription status | Universal term                     |
| `trialing`                | Subscription status | Common term for trial periods      |
| `currentPeriodStart`      | Billing cycle start | Descriptive, not provider-specific |
| `currentPeriodEnd`        | Billing cycle end   | Descriptive, not provider-specific |
| `trialStart` / `trialEnd` | Trial period dates  | Descriptive                        |

### 3. Provider-Leaked Terms (Needs Review)

Terms that originate from Stripe/Zuora and appear in core domain:

#### Subscription Status Values

| Current (Stripe)     | Recommended (Zentla) | Rationale                            |
| -------------------- | -------------------- | ------------------------------------ |
| `past_due`           | `payment_failed`     | More descriptive of actual state     |
| `incomplete`         | `pending`            | Generic term for awaiting completion |
| `incomplete_expired` | `expired`            | Simpler, clearer                     |
| `unpaid`             | `suspended`          | Describes the consequence            |

**Files to Update:**

- `packages/database/prisma/schema.prisma:368` - Enum definition
- `packages/core/src/domain/subscription.ts:20-28` - Type definition
- `packages/api/src/common/models/index.ts:191-196` - Zod schema
- `packages/api/src/common/schemas/index.ts:253-258` - OpenAPI schema
- All adapter status mappings

#### Subscription Item Fields

| Current   | Recommended      | Rationale                      |
| --------- | ---------------- | ------------------------------ |
| `priceId` | `offerVersionId` | Zentla uses Offers, not Prices |

**Files to Update:**

- `packages/core/src/domain/subscription.ts:44` - Interface
- `packages/api/src/webhooks/stripe-webhook.service.ts` - Map from Stripe price to offer version

#### Payment Concepts

| Current         | Context          | Recommendation                    |
| --------------- | ---------------- | --------------------------------- |
| `PaymentIntent` | Checkout service | Keep in Stripe-specific code only |
| `SetupIntent`   | Checkout service | Keep in Stripe-specific code only |

**Assessment:** These terms appear in:

- `packages/api/src/checkout/checkout.service.ts` - Acceptable (calling Stripe API)
- `packages/api/src/webhooks/stripe-webhook.service.ts` - Acceptable (handling Stripe webhooks)
- `packages/api/src/checkout/checkout.controller.ts` - API docs reference - Should use generic term

### 4. Event Naming

#### Current (Stripe-style)

```
invoice.paid
invoice.payment_failed
subscription.created
subscription.updated
```

#### Recommendation

Keep event names as-is. They are:

1. Descriptive and self-documenting
2. Match industry conventions
3. Already Zentla-namespaced in code (`source: "zentla"`)

**Files using events:**

- `packages/web/src/pages/docs/WebhooksPage.tsx` - Documentation
- `packages/api/src/webhooks/webhook-events.ts` - Event definitions

---

## Refactoring Plan

### Phase 1: Status Terminology (Low Risk)

**Goal:** Replace Stripe-specific status values with Zentla terms.

```
past_due → payment_failed
incomplete → pending
incomplete_expired → expired
unpaid → suspended
```

**Migration Strategy:**

1. Update Prisma schema with new enum values
2. Create migration with status mapping
3. Update core domain types
4. Update API schemas
5. Update adapter mappings (Stripe/Zuora translate to new values)
6. Update admin-ui status displays
7. Update documentation

**Files (14 total):**

- `packages/database/prisma/schema.prisma`
- `packages/core/src/domain/subscription.ts`
- `packages/api/src/common/models/index.ts`
- `packages/api/src/common/schemas/index.ts`
- `packages/api/src/subscriptions/subscriptions.controller.ts`
- `packages/api/src/subscriptions/subscriptions.service.ts`
- `packages/api/src/entitlements/entitlements.service.ts`
- `packages/api/src/webhooks/webhook-events.ts`
- `packages/api/src/webhooks/stripe-webhook.service.ts`
- `packages/api/src/workspaces/stripe-sync.service.ts`
- `packages/adapters/stripe/src/stripe.adapter.ts`
- `packages/adapters/zuora/src/zuora.adapter.ts`
- `packages/admin-ui/src/pages/SubscriptionDetailPage.tsx`
- `packages/admin-ui/src/pages/SubscriptionsPage.tsx`

### Phase 2: SubscriptionItem.priceId (Medium Risk)

**Goal:** Replace `priceId` with `offerVersionId` in core domain.

**Complexity:** Medium - requires understanding how subscription items map to offers.

**Files:**

- `packages/core/src/domain/subscription.ts`
- `packages/api/src/webhooks/stripe-webhook.service.ts`
- `packages/adapters/stripe/src/stripe.adapter.ts`

### Phase 3: Documentation Cleanup (Low Risk)

**Goal:** Remove Stripe/Zuora-specific terms from public documentation.

**Files:**

- `packages/api/src/checkout/checkout.controller.ts` - Remove PaymentIntent/SetupIntent from API docs
- `packages/web/src/pages/docs/*.tsx` - Review for leaked terms
- `docs/*.md` - Review for consistency

---

## Adapter Layer (Expected Behavior)

The adapter layer (`packages/adapters/`) is explicitly designed to contain provider-specific terminology. This is correct and should NOT be changed:

```typescript
// stripe.adapter.ts - This is CORRECT
const statusMap = {
  incomplete: "pending", // Stripe → Zentla
  incomplete_expired: "expired",
  past_due: "payment_failed",
  trialing: "trialing",
  active: "active",
  canceled: "canceled",
  unpaid: "suspended",
  paused: "paused",
};
```

The adapters translate between provider concepts and Zentla concepts.

---

## Consistency Checklist

### API Responses

- [ ] Status values use Zentla terminology
- [ ] No `priceId` in public responses (use `offerVersionId`)
- [ ] Event payloads use Zentla field names

### Admin UI

- [ ] Status badges show Zentla status names
- [ ] No Stripe/Zuora branding in generic views

### Documentation

- [ ] API reference uses Zentla terms
- [ ] Webhook examples use Zentla event names
- [ ] Getting started guide avoids provider specifics

### SDK

- [ ] Types use Zentla terminology
- [ ] Examples don't assume Stripe

---

## Decision: Status Values

**Option A: Keep Stripe Terms**

- Pros: Less migration work, developers familiar with Stripe
- Cons: Leaks Stripe implementation, confusing for Zuora users

**Option B: Zentla-Native Terms (Recommended)**

- Pros: Provider-agnostic, clearer meaning, professional
- Cons: Migration required, documentation updates

**Recommendation:** Option B - Zentla should have its own terminology as a billing abstraction layer. Status values should be descriptive of the business state, not the payment provider's internal state.

---

## Implementation Priority

1. **High:** Status terminology (affects API contracts, user-facing)
2. **Medium:** priceId → offerVersionId (affects internal consistency)
3. **Low:** Documentation cleanup (cosmetic, no breaking changes)

## Breaking Changes Warning

Changing status values is a **breaking change** for:

- SDK consumers filtering by status
- Webhook integrations checking status
- Admin UI status filters

**Mitigation:**

- Version the API (v2)
- Provide migration guide
- Support both values during transition period
