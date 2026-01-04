# Getting Started with Zentla

Zentla is the unified monetization layer for SaaS. Get billing + entitlements in one API, with the freedom to switch providers without code changes.

**What makes Zentla different:**

- **Billing + Entitlements together** - No more stitching Stripe + feature flags
- **Provider-agnostic** - Switch between Stripe, Zuora, or others without code changes
- **Self-hosted option** - Own your billing data with full data sovereignty
- **Pricing experiments** - A/B test with immutable offer versioning

Get from zero to your first checkout in under 10 minutes.

## Prerequisites

- Node.js 18+
- Docker Desktop
- Stripe account (test mode)
- Stripe CLI installed (`brew install stripe/stripe-cli/stripe`)

## Quick Start

### 1. Clone and Install (2 min)

```bash
git clone https://github.com/hexrift/zentla.git
cd zentla
yarn install
```

### 2. Start Infrastructure (1 min)

```bash
# Start Postgres and Redis
docker-compose up -d

# Verify containers are running
docker-compose ps
```

### 3. Configure Environment (1 min)

```bash
# Copy example environment
cp .env.example .env
```

Edit `.env` with your Stripe keys:

```env
# Get from https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Generate a random secret (or use the default for local dev)
API_KEY_SECRET=your-32-character-secret-key-here
```

### 4. Initialize Database (1 min)

```bash
# Generate Prisma client
yarn db:generate

# Run migrations
yarn db:migrate

# Seed demo data
yarn db:seed
```

Save the API key from the output:

```
Created test API key: Development Test Key
  Full key (save this): zentla_test_xxxxxxxx...
```

### 5. Start Development Servers (1 min)

```bash
# Start everything (API, UI, Stripe webhook listener)
yarn dev:all
```

You'll see:

- API: http://localhost:3002
- Admin UI: http://localhost:3001
- API Docs: http://localhost:3002/docs

### 6. Configure Browser (30 sec)

Open http://localhost:3001 and set your API key:

1. Open browser DevTools (F12)
2. Go to Console
3. Run:

```javascript
localStorage.setItem("zentla_api_key", "zentla_test_YOUR_KEY_HERE");
```

4. Refresh the page

### 7. Create Your First Offer (2 min)

**Option A: Via Admin UI**

1. Go to http://localhost:3001/offers
2. Click "New Offer"
3. Fill in:
   - Name: `Starter Plan`
   - Amount: `1900` (= $19.00)
   - Interval: `month`
4. Click "Create Offer"

**Option B: Via API**

```bash
curl -X POST http://localhost:3002/api/v1/offers \
  -H "Authorization: Bearer zentla_test_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Starter Plan",
    "description": "Perfect for small teams",
    "config": {
      "pricing": {
        "model": "flat",
        "amount": 1900,
        "currency": "USD",
        "interval": "month"
      },
      "entitlements": [
        { "featureKey": "users", "value": 5, "valueType": "number" },
        { "featureKey": "api_access", "value": true, "valueType": "boolean" }
      ]
    }
  }'
```

### 8. Publish the Offer (30 sec)

```bash
# Get your offer ID from the previous response
curl -X POST http://localhost:3002/api/v1/offers/YOUR_OFFER_ID/publish \
  -H "Authorization: Bearer zentla_test_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 9. Create a Test Checkout (1 min)

```bash
curl -X POST http://localhost:3002/api/v1/checkout/sessions \
  -H "Authorization: Bearer zentla_test_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "offerId": "YOUR_OFFER_ID",
    "customerEmail": "test@example.com",
    "successUrl": "http://localhost:3001/success",
    "cancelUrl": "http://localhost:3001/cancel"
  }'
```

Response:

```json
{
  "id": "checkout-session-id",
  "sessionUrl": "https://checkout.stripe.com/c/pay/..."
}
```

### 10. Complete Test Payment

1. Open the `sessionUrl` in your browser
2. Use Stripe test card: `4242 4242 4242 4242`
3. Any future expiry, any CVC, any ZIP
4. Click Pay

The Stripe CLI will forward the webhook to Zentla, creating the subscription.

### 11. Verify Subscription Created

```bash
curl http://localhost:3002/api/v1/subscriptions \
  -H "Authorization: Bearer zentla_test_YOUR_KEY"
```

You should see your new subscription!

---

## Next Steps

### Check Entitlements

```bash
curl http://localhost:3002/api/v1/customers/CUSTOMER_ID/entitlements \
  -H "Authorization: Bearer zentla_test_YOUR_KEY"
```

### Explore the API

- Open http://localhost:3002/docs for Swagger UI
- Try different endpoints
- Check the Admin UI at http://localhost:3001

### Configure Webhooks

Send events to your own endpoint:

```bash
curl -X POST http://localhost:3002/api/v1/webhook-endpoints \
  -H "Authorization: Bearer zentla_test_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/zentla",
    "events": ["subscription.created", "subscription.canceled"]
  }'
```

---

## Troubleshooting

### "Invalid or expired API key"

Re-run `yarn db:seed` and use the new key.

### "Port already in use"

```bash
# Kill processes on ports 3001/3002
lsof -ti:3001,3002 | xargs kill -9
```

### Stripe webhook not received

Make sure `stripe listen` is running:

```bash
stripe listen --forward-to localhost:3002/api/v1/webhooks/stripe
```

### Database connection error

Check Docker containers:

```bash
docker-compose ps
docker-compose logs postgres
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Application                        │
└─────────────────────────────┬───────────────────────────────┘
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Zentla API                            │
│  ┌─────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Offers  │  │ Subscriptions│  │     Entitlements       │  │
│  └─────────┘  └──────────────┘  └────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
                 ┌────────────────────────┐
                 │    Billing Provider    │
                 │  (Stripe, Zuora, etc.) │
                 └────────────────────────┘
```

**Why this matters:** Write your integration once. Switch providers without changing your application code.

---

## Key Concepts

| Concept          | Description                                       |
| ---------------- | ------------------------------------------------- |
| **Workspace**    | Tenant isolation. All data scoped to a workspace. |
| **Offer**        | A product with pricing, trials, and entitlements. |
| **OfferVersion** | Immutable snapshot. Draft → Published → Archived. |
| **Subscription** | Customer's active plan.                           |
| **Entitlement**  | Feature access granted by subscription.           |
| **Checkout**     | Stripe Checkout session for payment.              |

---

## Test Cards

| Card Number         | Scenario           |
| ------------------- | ------------------ |
| 4242 4242 4242 4242 | Success            |
| 4000 0000 0000 3220 | 3D Secure required |
| 4000 0000 0000 9995 | Payment fails      |
| 4000 0000 0000 0341 | Attaching fails    |

Full list: https://stripe.com/docs/testing
