-- CreateEnum
CREATE TYPE "cloud_plan_tier" AS ENUM ('free', 'pro', 'business', 'enterprise');

-- CreateEnum
CREATE TYPE "cloud_plan_status" AS ENUM ('active', 'deprecated', 'hidden');

-- CreateEnum
CREATE TYPE "cloud_subscription_status" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'paused');

-- CreateEnum
CREATE TYPE "cloud_billing_interval" AS ENUM ('monthly', 'yearly');

-- CreateEnum
CREATE TYPE "cloud_invoice_status" AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');

-- CreateTable
CREATE TABLE "cloud_plan" (
    "id" UUID NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(1000),
    "tier" "cloud_plan_tier" NOT NULL DEFAULT 'free',
    "status" "cloud_plan_status" NOT NULL DEFAULT 'active',
    "monthly_price" INTEGER NOT NULL DEFAULT 0,
    "yearly_price" INTEGER NOT NULL DEFAULT 0,
    "max_workspaces" INTEGER,
    "max_customers" INTEGER,
    "max_api_calls" INTEGER,
    "max_webhooks" INTEGER,
    "max_team_members" INTEGER,
    "max_offers_per_month" INTEGER,
    "max_events_per_month" INTEGER,
    "features" JSONB NOT NULL DEFAULT '{}',
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cloud_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_subscription" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "cloud_subscription_status" NOT NULL DEFAULT 'trialing',
    "billing_interval" "cloud_billing_interval" NOT NULL DEFAULT 'monthly',
    "current_period_start" TIMESTAMPTZ NOT NULL,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "trial_start" TIMESTAMPTZ,
    "trial_end" TIMESTAMPTZ,
    "cancel_at" TIMESTAMPTZ,
    "canceled_at" TIMESTAMPTZ,
    "provider_subscription_id" VARCHAR(255),
    "provider_customer_id" VARCHAR(255),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cloud_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_usage" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "api_calls" INTEGER NOT NULL DEFAULT 0,
    "customers" INTEGER NOT NULL DEFAULT 0,
    "webhooks" INTEGER NOT NULL DEFAULT 0,
    "events" INTEGER NOT NULL DEFAULT 0,
    "team_members" INTEGER NOT NULL DEFAULT 0,
    "offers_created" INTEGER NOT NULL DEFAULT 0,
    "api_calls_overage" INTEGER NOT NULL DEFAULT 0,
    "overage_amount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cloud_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_invoice" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "status" "cloud_invoice_status" NOT NULL DEFAULT 'draft',
    "invoice_number" VARCHAR(50) NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "due_date" TIMESTAMPTZ NOT NULL,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "amount_due" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "line_items" JSONB NOT NULL DEFAULT '[]',
    "provider_invoice_id" VARCHAR(255),
    "provider_payment_id" VARCHAR(255),
    "paid_at" TIMESTAMPTZ,
    "voided_at" TIMESTAMPTZ,
    "finalized_at" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cloud_invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cloud_plan_key_key" ON "cloud_plan"("key");

-- CreateIndex
CREATE INDEX "cloud_plan_key_idx" ON "cloud_plan"("key");

-- CreateIndex
CREATE INDEX "cloud_plan_tier_status_idx" ON "cloud_plan"("tier", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cloud_subscription_workspace_id_key" ON "cloud_subscription"("workspace_id");

-- CreateIndex
CREATE INDEX "cloud_subscription_workspace_id_idx" ON "cloud_subscription"("workspace_id");

-- CreateIndex
CREATE INDEX "cloud_subscription_plan_id_idx" ON "cloud_subscription"("plan_id");

-- CreateIndex
CREATE INDEX "cloud_subscription_status_idx" ON "cloud_subscription"("status");

-- CreateIndex
CREATE INDEX "cloud_usage_workspace_id_idx" ON "cloud_usage"("workspace_id");

-- CreateIndex
CREATE INDEX "cloud_usage_subscription_id_idx" ON "cloud_usage"("subscription_id");

-- CreateIndex
CREATE INDEX "cloud_usage_period_start_period_end_idx" ON "cloud_usage"("period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "cloud_usage_subscription_id_period_start_key" ON "cloud_usage"("subscription_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "cloud_invoice_invoice_number_key" ON "cloud_invoice"("invoice_number");

-- CreateIndex
CREATE INDEX "cloud_invoice_workspace_id_idx" ON "cloud_invoice"("workspace_id");

-- CreateIndex
CREATE INDEX "cloud_invoice_subscription_id_idx" ON "cloud_invoice"("subscription_id");

-- CreateIndex
CREATE INDEX "cloud_invoice_status_idx" ON "cloud_invoice"("status");

-- CreateIndex
CREATE INDEX "cloud_invoice_invoice_number_idx" ON "cloud_invoice"("invoice_number");

-- AddForeignKey
ALTER TABLE "cloud_subscription" ADD CONSTRAINT "cloud_subscription_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_subscription" ADD CONSTRAINT "cloud_subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "cloud_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_usage" ADD CONSTRAINT "cloud_usage_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "cloud_subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_invoice" ADD CONSTRAINT "cloud_invoice_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "cloud_subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
