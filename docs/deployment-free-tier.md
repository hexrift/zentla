# Free Tier Deployment Guide

Deploy Zentla using free-tier services for beta testing and development.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare Pages                          │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │   zentla-admin       │    │    zentla-web        │             │
│  │   (Admin Dashboard) │    │    (Checkout UI)    │             │
│  └─────────────────────┘    └─────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Koyeb                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    zentla-api                              │    │
│  │                  (NestJS API)                             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│      Neon Postgres      │     │     Upstash Redis       │
│    (Serverless DB)      │     │   (Serverless Cache)    │
└─────────────────────────┘     └─────────────────────────┘
```

## Prerequisites

### 1. Create Accounts (All Free Tier)

- **[Cloudflare](https://dash.cloudflare.com/sign-up)** - Pages hosting
- **[Koyeb](https://app.koyeb.com/auth/signup)** - API hosting
- **[Neon](https://console.neon.tech/signup)** - PostgreSQL database
- **[Upstash](https://console.upstash.com/signup)** - Redis cache

### 2. Get API Keys/Tokens

#### Cloudflare

1. Go to [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Create token with "Edit Cloudflare Pages" permission
3. Note your Account ID from dashboard URL

#### Koyeb

1. Go to [API Access](https://app.koyeb.com/settings/api)
2. Generate an API token

#### Neon

1. Create a new project
2. Copy the connection string from dashboard
3. For branching, get API key from Settings → API Keys

#### Upstash

1. Create a Redis database
2. Copy the Redis URL from the database details

## GitHub Secrets Configuration

Add these secrets to your repository (Settings → Secrets → Actions):

### Required Secrets

| Secret                  | Description                       | Example                                                          |
| ----------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`          | Neon PostgreSQL connection string | `postgresql://user:pass@ep-xyz.neon.tech/zentla?sslmode=require` |
| `REDIS_URL`             | Upstash Redis URL                 | `rediss://default:xxx@us1-xxx.upstash.io:6379`                   |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token              | `xxxxxxxx`                                                       |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID             | `abc123def456`                                                   |
| `KOYEB_API_TOKEN`       | Koyeb API token                   | `xxxxxxxx`                                                       |
| `JWT_SECRET`            | JWT signing secret (32+ chars)    | Generate: `openssl rand -hex 32`                                 |
| `STRIPE_SECRET_KEY`     | Stripe secret key                 | `sk_test_xxx`                                                    |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret     | `whsec_xxx`                                                      |

### Optional Secrets (for Neon branching)

| Secret                   | Description       |
| ------------------------ | ----------------- |
| `NEON_PROJECT_ID`        | Neon project ID   |
| `NEON_API_KEY`           | Neon API key      |
| `NEON_DATABASE_USERNAME` | Database username |

### Variables (non-sensitive)

Add these as repository variables (Settings → Secrets → Variables):

| Variable       | Description           | Example                                             |
| -------------- | --------------------- | --------------------------------------------------- |
| `API_URL`      | API URL for frontends | `https://zentla-api-xxx.koyeb.app`                  |
| `CORS_ORIGINS` | Allowed CORS origins  | `https://zentla-admin.pages.dev,https://zentla-web.pages.dev` |

## Initial Setup

### 1. Create Cloudflare Pages Projects

```bash
# Install wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create projects (do this once)
wrangler pages project create zentla-admin
wrangler pages project create zentla-web
```

### 2. Create Koyeb App

```bash
# Install Koyeb CLI
brew install koyeb/tap/koyeb

# Login
koyeb login

# Create app (do this once)
koyeb app create zentla-api
```

### 3. Setup Neon Database

```bash
# Run migrations locally first
DATABASE_URL="your-neon-connection-string" yarn db:migrate:deploy

# Optionally seed initial data
DATABASE_URL="your-neon-connection-string" yarn db:seed
```

## Deployment

### Automatic (via GitHub Actions)

Push to `main` branch triggers:

- **API changes** → Deploys to Koyeb
- **Admin UI changes** → Deploys to Cloudflare Pages
- **Web changes** → Deploys to Cloudflare Pages
- **Migration changes** → Runs against Neon

### Manual Deployment

```bash
# Trigger deployments
gh workflow run deploy-admin-ui.yml
gh workflow run deploy-web.yml
gh workflow run deploy-api.yml
gh workflow run deploy-db.yml
```

## Free Tier Limits

| Service              | Free Tier Limits                                     |
| -------------------- | ---------------------------------------------------- |
| **Cloudflare Pages** | Unlimited sites, 500 builds/month                    |
| **Koyeb**            | 1 free instance (nano), sleeps after 5min inactivity |
| **Neon**             | 0.5 GB storage, 191 compute hours/month              |
| **Upstash Redis**    | 10K commands/day, 256MB storage                      |

## Monitoring

### Health Checks

- API: `https://your-koyeb-app.koyeb.app/api/health`
- Admin: `https://zentla-admin.pages.dev`
- Web: `https://zentla-web.pages.dev`

### Logs

```bash
# Koyeb logs
koyeb service logs zentla-api/api

# Neon query stats
# Check Neon dashboard → Monitoring
```

## Upgrading from Free Tier

When ready to scale:

1. **Koyeb** → Upgrade to paid plan for always-on instances
2. **Neon** → Upgrade for more storage/compute
3. **Upstash** → Upgrade for higher throughput
4. Or migrate to AWS/GCP using the existing Terraform in `infrastructure/`

## Troubleshooting

### Koyeb instance sleeping

Free instances sleep after 5 min inactivity. First request takes ~30s to wake.

**Solution**: Upgrade to paid, or use a health check ping service.

### Neon connection limits

Free tier has limited connections.

**Solution**: Use connection pooling (enabled by default in Neon URLs with `-pooler`).

### Build failures

Check GitHub Actions logs for specific errors.

```bash
gh run list --workflow=deploy-api.yml
gh run view <run-id> --log
```
