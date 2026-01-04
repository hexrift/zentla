<p align="center">
  <img src="packages/web/public/favicon.svg" alt="Zentla" width="80" height="80" />
</p>

<h1 align="center">Zentla</h1>

<p align="center">
  <strong>The open source monetization layer for SaaS</strong>
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

## What is Zentla?

Zentla is an **open source monetization layer** that sits between your application and billing providers like Stripe. Entitlements, billing, and pricing experiments—without the vendor lock-in.

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

- **Offers & Versioning** - Pricing plans with immutable versions. Publish, rollback, or A/B test.
- **Checkout** - Hosted or headless checkout with trial and promo code support.
- **Entitlements** - Define features and quotas per plan. Query access at runtime.
- **Customer Sync** - Automatic sync with your billing provider.
- **Webhooks** - Real-time events for subscriptions and payments.
- **Multi-Provider** - Stripe today, Zuora tomorrow. Switch without code changes.

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
- **Dashboard**: [admin.zentla.dev](https://admin.zentla.dev) - Example admin interface

## Self-Hosting

Zentla runs anywhere with Node.js, PostgreSQL, and Redis.

```bash
docker build -t zentla .

docker run -p 3002:3002 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  zentla
```

See [Self-Hosting Guide](docs/self-hosting.md) for detailed deployment options.

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
