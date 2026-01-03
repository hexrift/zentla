<p align="center">
  <img src="packages/web/public/favicon.svg" alt="Zentla" width="80" height="80" />
</p>

<h1 align="center">Zentla</h1>

<p align="center">
  <strong>Open source subscription management for modern apps</strong>
</p>

<p align="center">
  <a href="https://github.com/PrimeCodeLabs/zentla/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
  </a>
  <a href="https://github.com/PrimeCodeLabs/zentla/actions/workflows/ci.yml">
    <img src="https://github.com/PrimeCodeLabs/zentla/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://zentla.dev">
    <img src="https://img.shields.io/badge/docs-zentla.dev-green" alt="Documentation" />
  </a>
</p>

<p align="center">
  <a href="https://zentla.dev/docs">Documentation</a> |
  <a href="https://zentla.dev/docs/quickstart">Quickstart</a> |
  <a href="https://zentla.dev/docs/example">Example</a> |
  <a href="#self-hosting">Self-Hosting</a>
</p>

---

## What is Zentla?

Zentla is a **provider-agnostic subscription management API** that sits between your application and billing providers like Stripe. It handles the complexity of subscription commerce so you can focus on building your product.

```typescript
// Create an offer with pricing and entitlements
const offer = await zentla.offers.create({
  name: "Pro Plan",
  config: {
    pricing: {
      model: "flat",
      amount: 2900,
      currency: "USD",
      interval: "month",
    },
    trial: { days: 14 },
    entitlements: [
      { featureKey: "seats", value: 10, valueType: "number" },
      { featureKey: "api_access", value: true, valueType: "boolean" },
    ],
  },
});

// Create a checkout session
const checkout = await zentla.checkout.createSession({
  offerId: offer.id,
  customerId: customer.id,
  successUrl: "https://yourapp.com/success",
});

// Check entitlements at runtime
const access = await zentla.customers.checkEntitlement(
  customerId,
  "api_access",
);
// { hasAccess: true, value: true }
```

## Features

- **Offers & Versioning** - Create pricing plans with immutable versions. Publish, rollback, or A/B test with confidence.
- **Checkout** - Hosted or headless checkout flows with trial support and promotion codes.
- **Entitlements** - Define features and quotas per plan. Query access at runtime with a simple API.
- **Customer Sync** - Automatic sync with your billing provider. Link customers by external ID.
- **Webhooks** - Receive real-time events for subscriptions, payments, and entitlement changes.
- **Multi-Workspace** - Manage multiple projects with isolated data and API keys.
- **Audit Logs** - Track all changes with automatic PII anonymization.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Application                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        Zentla API                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐   │
│  │ Offers  │ │Customers│ │Checkout │ │  Entitlements   │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │    Billing Provider    │
              │  (Stripe, Zuora, etc.) │
              └────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Stripe account (for payment processing)

### Installation

```bash
# Clone the repository
git clone https://github.com/PrimeCodeLabs/zentla.git
cd zentla

# Install dependencies
yarn install

# Start infrastructure (PostgreSQL + Redis)
docker-compose up -d

# Set up environment
cp .env.example .env
# Edit .env with your Stripe keys

# Run migrations and seed
yarn db:generate
yarn db:migrate
yarn db:seed

# Start development server
yarn dev
```

The API will be running at `http://localhost:3002`. Open the [API docs](http://localhost:3002/docs) to explore.

### First API Call

```bash
# Create a feature
curl -X POST http://localhost:3002/api/v1/features \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "key": "seats",
    "name": "Team Seats",
    "type": "numeric"
  }'
```

See the [Quickstart Guide](https://zentla.dev/docs/quickstart) for a complete walkthrough.

## Project Structure

```
zentla/
├── packages/
│   ├── api/            # NestJS API server
│   ├── admin-ui/       # React admin dashboard
│   ├── web/            # Marketing site & docs
│   ├── sdk/            # TypeScript SDK
│   ├── core/           # Shared domain logic
│   ├── database/       # Prisma schema & migrations
│   └── adapters/
│       ├── stripe/     # Stripe integration
│       └── zuora/      # Zuora integration
├── infrastructure/     # Terraform for AWS deployment
└── docs/               # Additional documentation
```

## Self-Hosting

Zentla can be self-hosted on any infrastructure that supports Node.js, PostgreSQL, and Redis.

### Docker

```bash
# Build the image
docker build -t zentla .

# Run with environment variables
docker run -p 3002:3002 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e STRIPE_SECRET_KEY=sk_... \
  zentla
```

### Cloud Deployment

See our deployment guides:

- [Free Tier (Cloudflare + Koyeb + Neon)](docs/deployment-free-tier.md)
- [AWS (Terraform)](infrastructure/README.md)

## Documentation

- [Quickstart](https://zentla.dev/docs/quickstart) - Get up and running in 5 minutes
- [Headless Checkout](https://zentla.dev/docs/headless-checkout) - Build custom checkout UI
- [Webhooks](https://zentla.dev/docs/webhooks) - Handle subscription events
- [End-to-End Example](https://zentla.dev/docs/example) - Complete implementation walkthrough
- [API Reference](http://localhost:3002/docs) - OpenAPI documentation

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Run tests
yarn test

# Run linting
yarn lint

# Type check
yarn typecheck
```

## Security

If you discover a security vulnerability, please email security@zentla.dev instead of opening a public issue. See [SECURITY.md](SECURITY.md) for our security policy.

## License

Zentla is [MIT licensed](LICENSE).

## Community

- [GitHub Issues](https://github.com/PrimeCodeLabs/zentla/issues) - Bug reports and feature requests
- [GitHub Discussions](https://github.com/PrimeCodeLabs/zentla/discussions) - Questions and ideas

---

<p align="center">
  <sub>Built with care by <a href="https://github.com/PrimeCodeLabs">PrimeCodeLabs</a></sub>
</p>
