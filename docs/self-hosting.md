# Self-Hosting Guide

Deploy Zentla on your own infrastructure.

## Requirements

- **Node.js** 18+
- **PostgreSQL** 14+
- **Redis** 6+
- **Stripe account** (for payment processing)

## Quick Start with Docker

```bash
# Build
docker build -t zentla .

# Run
docker run -p 3002:3002 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/zentla \
  -e REDIS_URL=redis://host:6379 \
  -e API_KEY_SECRET=$(openssl rand -base64 32) \
  -e WEBHOOK_SIGNING_SECRET=$(openssl rand -base64 32) \
  zentla
```

## Environment Variables

### Required

| Variable                 | Description                             |
| ------------------------ | --------------------------------------- |
| `DATABASE_URL`           | PostgreSQL connection string            |
| `REDIS_URL`              | Redis connection string                 |
| `API_KEY_SECRET`         | Secret for signing API keys (32+ chars) |
| `WEBHOOK_SIGNING_SECRET` | Secret for signing webhooks (32+ chars) |

### Optional

| Variable      | Description     | Default |
| ------------- | --------------- | ------- |
| `PORT`        | API port        | `3000`  |
| `CORS_ORIGIN` | Allowed origins | `*`     |
| `LOG_LEVEL`   | Logging level   | `debug` |

Stripe credentials can be configured per-workspace via the admin UI, or set globally:

| Variable                | Description                   |
| ----------------------- | ----------------------------- |
| `STRIPE_SECRET_KEY`     | Stripe secret key             |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

## Deployment Options

### Docker Compose

```yaml
version: "3.8"
services:
  api:
    build: .
    ports:
      - "3002:3002"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/zentla
      - REDIS_URL=redis://redis:6379
      - API_KEY_SECRET=your-32-char-secret-here
      - WEBHOOK_SIGNING_SECRET=your-32-char-secret-here
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: zentla
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Cloud Platforms

Zentla works with any platform that supports Docker or Node.js:

- **Koyeb** - Simple container hosting
- **Railway** - One-click deploy
- **Render** - Easy scaling
- **AWS ECS/Fargate** - Enterprise scale
- **Google Cloud Run** - Serverless containers
- **DigitalOcean App Platform** - Managed containers

### Database Options

- **Neon** - Serverless PostgreSQL
- **Supabase** - Postgres with extras
- **PlanetScale** - MySQL alternative
- **AWS RDS** - Managed PostgreSQL
- **Self-hosted** - Your own PostgreSQL

### Redis Options

- **Upstash** - Serverless Redis
- **Redis Cloud** - Managed Redis
- **AWS ElastiCache** - Enterprise Redis
- **Self-hosted** - Your own Redis

## Database Setup

```bash
# Generate Prisma client
yarn db:generate

# Run migrations
yarn db:migrate:deploy

# Seed initial data (optional)
yarn db:seed
```

## Stripe Webhook Setup

1. In Stripe Dashboard, create a webhook endpoint pointing to:

   ```
   https://your-api-domain/api/v1/webhooks/stripe
   ```

2. Subscribe to these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

3. Copy the webhook signing secret to your environment.

## Health Check

```bash
curl https://your-api-domain/api/v1/health
```

## Need Help?

If you need help deploying Zentla, [open an issue](https://github.com/hexrift/zentla/issues) or reach out at hello@zentla.dev.
