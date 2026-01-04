<p align="center">
  <img src="packages/web/public/favicon.svg" alt="Zentla" width="80" height="80" />
</p>

<h1 align="center">Zentla</h1>

<p align="center">
  <strong>Billing you control</strong><br/>
  <sub>Open source entitlements, metering, and billing—without the lock-in</sub>
</p>

<p align="center">
  <a href="https://github.com/hexrift/zentla/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
  </a>
  <a href="https://github.com/hexrift/zentla/actions/workflows/ci.yml">
    <img src="https://github.com/hexrift/zentla/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
</p>

<p align="center">
  <a href="https://zentla.dev">Website</a> &bull;
  <a href="https://zentla.dev/docs">Docs</a> &bull;
  <a href="https://api.zentla.dev/docs">API Reference</a> &bull;
  <a href="https://admin.zentla.dev">Live Demo</a>
</p>

---

## The Problem

Building billing infrastructure is a black hole for engineering time:

- **Entitlements sprawl** — Feature flags, plan limits, and access controls scattered across services
- **Usage tracking pain** — Metering, aggregation, and overage logic built from scratch
- **Provider lock-in** — Tightly coupled to Stripe, dreading the day you need to support Zuora
- **No visibility** — MRR, churn, and cohort metrics buried in spreadsheets

Zentla solves this with a unified API layer that handles entitlements, usage metering, multi-provider billing, and revenue analytics—so you can focus on your product.

## What is Zentla?

Zentla is **billing infrastructure you control**—open source, self-hostable, and provider-agnostic. Four pillars, one API:

| Pillar                | What it does                                                  |
| --------------------- | ------------------------------------------------------------- |
| **Entitlements**      | Feature access, quotas, and limits derived from subscriptions |
| **Usage Metering**    | Track, aggregate, and bill for usage-based pricing            |
| **Multi-Provider**    | Stripe today, Zuora tomorrow—switch without code changes      |
| **Revenue Analytics** | MRR, churn, cohorts, and growth metrics in real-time          |

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

// Track usage events for usage-based billing
await zentla.usage.ingest({
  customerId: customer.id,
  metricKey: "api_calls",
  quantity: 1,
});

// Check entitlements at runtime
const access = await zentla.customers.checkEntitlement(
  customerId,
  "api_access",
);
// { hasAccess: true, value: true }
```

## Why Zentla?

|                     | Zentla | Stigg | Orb | Stripe Billing |
| ------------------- | :----: | :---: | :-: | :------------: |
| Open Source         |   ✅   |  ❌   | ❌  |       ❌       |
| Self-Hostable       |   ✅   |  ❌   | ❌  |       ❌       |
| Entitlements        |   ✅   |  ✅   | ❌  |       ❌       |
| Usage Metering      |   ✅   |  ❌   | ✅  |       ✅       |
| Multi-Provider      |   ✅   |  ❌   | ❌  |       ❌       |
| Revenue Analytics   |   ✅   |  ❌   | ❌  |       ❌       |
| Pricing Experiments |   ✅   |  ✅   | ❌  |       ❌       |

## Features

### Entitlements & Feature Gating

- Define features and quotas per plan
- Query access at runtime with sub-10ms latency
- Boolean flags, numeric limits, and custom values
- Automatic sync when subscriptions change

### Usage Metering & Billing

- Ingest millions of events with idempotency
- Flexible aggregation: sum, max, count, or last value
- Real-time usage summaries per customer
- Overage calculations and usage-based pricing

### Multi-Provider Billing

- Connect Stripe, Zuora, or both simultaneously
- Provider-agnostic checkout (hosted or headless)
- Switch providers without code changes
- Unified webhook handling and event normalization

### Revenue Analytics

- Real-time MRR, ARR, and growth metrics
- Churn rate and cohort analysis
- Revenue breakdown by plan, period, and segment
- Built-in analytics dashboard

### Pricing Experiments

- Immutable offer versions for safe A/B testing
- Publish, rollback, or schedule pricing changes
- No deploys required for pricing updates
- Track conversion by offer version

### Enterprise-Ready

- Comprehensive audit logging
- API versioning with ETag concurrency control
- Idempotent operations for safe retries
- Role-based access control

## Quick Start

```bash
# Clone
git clone https://github.com/hexrift/zentla.git
cd zentla

# Install
yarn install

# Start infrastructure
docker-compose up -d

# Configure
cp .env.example .env
# Edit .env with your settings

# Setup database
yarn db:generate && yarn db:migrate && yarn db:seed

# Run
yarn dev
```

API runs at `http://localhost:3002`. Open `http://localhost:3002/docs` to explore.

## Try the Live Demo

- **API**: [api.zentla.dev/docs](https://api.zentla.dev/docs) - Interactive API documentation
- **Dashboard**: [admin.zentla.dev](https://admin.zentla.dev) - Admin interface with analytics

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Application                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Zentla API                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────┐ │
│  │ Entitlements│  │   Usage     │  │  Checkout   │  │Analytics│ │
│  │   Engine    │  │  Metering   │  │   Engine    │  │ Engine  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
         ┌──────────┐    ┌──────────┐    ┌──────────┐
         │  Stripe  │    │  Zuora   │    │  More... │
         └──────────┘    └──────────┘    └──────────┘
```

## Self-Hosting

Zentla runs anywhere with Node.js, PostgreSQL, and Redis.

```bash
docker build -t zentla .

docker run -p 3002:3002 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  zentla
```

See [Self-Hosting Guide](docs/self-hosting.md) for Kubernetes, Railway, and Render deployments.

## Project Structure

```
zentla/
├── packages/
│   ├── api/          # NestJS API server
│   ├── admin-ui/     # React admin dashboard
│   ├── web/          # Marketing site & docs
│   ├── sdk/          # TypeScript SDK
│   ├── database/     # Prisma schema & migrations
│   └── adapters/     # Stripe, Zuora integrations
└── docs/             # Documentation
```

## Documentation

- [Getting Started](docs/getting-started.md)
- [Core Concepts](docs/concepts.md)
- [API Reference](docs/api-reference.md)
- [Usage Metering](docs/api-reference.md#usage-metering)
- [Webhooks](docs/webhooks.md)
- [Self-Hosting](docs/self-hosting.md)
- [Security](docs/security.md)

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
yarn test      # Run tests
yarn lint      # Lint code
yarn typecheck # Type check
```

## Security

Found a vulnerability? Email security@zentla.dev. See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)

---

<p align="center">
  <sub>Built by <a href="https://github.com/hexrift">Hexrift</a></sub>
</p>
