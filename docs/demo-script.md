# Zentla Demo Script

A 2-3 minute demo script for explaining and demonstrating Zentla.

---

## Opening (15 seconds)

> "If you've ever built subscription billing into a SaaS product, you know the pain. You're either locked into one payment provider, wrestling with webhook spaghetti, or rebuilding the same subscription logic for the third time.
>
> Zentla fixes this. It's a subscription commerce layer that sits between your app and payment providers like Stripe — giving you a clean API for offers, subscriptions, and entitlements, without the vendor lock-in."

---

## The Problem (30 seconds)

> "Here's what typically happens when you add subscriptions to your app:"

_[Show slide or whiteboard]_

```
Your App ──► Stripe SDK ──► Stripe
              │
              ├── Handle 47 webhook events
              ├── Build subscription state machine
              ├── Implement proration logic
              ├── Track entitlements manually
              └── Hope you never need to switch providers
```

> "You end up with Stripe-specific code scattered everywhere. Your subscription model is tightly coupled to their data structures. And if you ever need to add another payment provider — say, for enterprise customers who need invoicing — you're basically starting over."

---

## The Solution (30 seconds)

> "Zentla gives you a provider-agnostic abstraction layer:"

_[Show architecture diagram]_

```
Your App ──► Zentla API ──► Stripe / Zuora / etc.
              │
              ├── One API for all providers
              ├── Offers with versioned pricing
              ├── Subscriptions as first-class citizens
              └── Entitlements you can query
```

> "You define Offers — your pricing plans. Zentla syncs them to Stripe. When a customer checks out, Zentla handles the session. When Stripe sends webhooks, Zentla normalizes them into simple domain events and manages your subscription state.
>
> If you ever need to switch providers or add a second one, your application code doesn't change."

---

## Live Demo (90 seconds)

### Create an Offer (20 seconds)

_[Open Admin UI at localhost:3001]_

> "Let's create a pricing plan. I'll call it 'Pro Plan' — $29 per month with a 14-day free trial."

_[Fill in form, click Create]_

> "This creates a draft version. Nothing is live yet. Let me publish it."

_[Click Publish]_

> "Now it's synced to Stripe and ready for customers."

### Show Stripe Dashboard (10 seconds)

_[Switch to Stripe Dashboard → Products]_

> "See? Zentla automatically created the Product and Price in Stripe. I didn't write any Stripe-specific code."

### Trigger a Checkout (20 seconds)

_[Open terminal]_

```bash
curl -X POST http://localhost:3002/api/v1/checkout/sessions \
  -H "Authorization: Bearer zentla_test_..." \
  -d '{"offerId": "...", "customerEmail": "demo@test.com", ...}'
```

> "One API call creates a checkout session. I get back a Stripe Checkout URL."

_[Open the URL in browser]_

> "Standard Stripe Checkout. The customer enters payment info..."

_[Enter test card 4242... and complete]_

### Show the Result (20 seconds)

_[Return to Admin UI → Subscriptions]_

> "And there it is — an active subscription, created automatically from the Stripe webhook. I didn't have to parse the webhook myself. Zentla did that."

_[Click into subscription]_

> "I can see the customer, the offer they're on, and when they'll be billed next."

### Check Entitlements (20 seconds)

_[Terminal]_

```bash
curl http://localhost:3002/api/v1/customers/.../entitlements
```

> "And here's the power move — entitlements. My app can check: 'Does this customer have API access? How many seats do they get?' One query, simple answer.
>
> No parsing Stripe metadata. No maintaining a separate permissions table. It's all derived from the subscription."

---

## Closing (15 seconds)

> "That's Zentla. Define your offers, let customers check out, query entitlements. Under the hood, it's all Stripe — but your code doesn't know that.
>
> When you're ready to add invoice billing through Zuora, or expand to another provider, you flip a config. Your app stays the same."

_[Show slide with links]_

> "Docs are at zentla-web.pages.dev/docs. The API is OpenAPI-documented. You can be up and running in under 10 minutes."

---

## Demo Checklist

Before the demo, ensure:

- [ ] Docker running (`docker-compose up -d`)
- [ ] API running (`yarn dev:all`)
- [ ] Database seeded with API key
- [ ] API key set in browser localStorage
- [ ] Stripe CLI forwarding webhooks
- [ ] Stripe Dashboard open in another tab
- [ ] Terminal ready with curl commands
- [ ] Sample offer ID copied for checkout command

### Test Card for Demo

```
Card: 4242 4242 4242 4242
Exp: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits
```

---

## Common Questions

**Q: How does this compare to Stripe Billing?**

> "Stripe Billing is great, but it's Stripe-only. Zentla gives you abstraction. If you're 100% committed to Stripe forever, you might not need this. But if you want flexibility, or you're already feeling the pain of Stripe-specific code, Zentla helps."

**Q: What about existing subscriptions?**

> "You can import them. Zentla has a migration path where you sync existing Stripe subscriptions into Zentla's model. New subscriptions go through Zentla; old ones get backfilled."

**Q: Is this just a Stripe wrapper?**

> "Today, yes — Stripe is the primary adapter. But the architecture supports multiple providers. Zuora is stubbed out. The abstraction is real; we just haven't built all the adapters yet."

**Q: Where does Zentla run?**

> "It's your infrastructure. Self-hosted, or we're working on a managed cloud version. Your data, your control."
