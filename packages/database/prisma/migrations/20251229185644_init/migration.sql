-- CreateEnum
CREATE TYPE "provider" AS ENUM ('stripe', 'zuora');

-- CreateEnum
CREATE TYPE "offer_status" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "offer_version_status" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused');

-- CreateEnum
CREATE TYPE "entitlement_value_type" AS ENUM ('boolean', 'number', 'string', 'unlimited');

-- CreateEnum
CREATE TYPE "checkout_status" AS ENUM ('pending', 'open', 'complete', 'expired');

-- CreateEnum
CREATE TYPE "webhook_endpoint_status" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "webhook_event_status" AS ENUM ('pending', 'delivered', 'failed', 'dead_letter');

-- CreateEnum
CREATE TYPE "api_key_role" AS ENUM ('owner', 'admin', 'member', 'readonly');

-- CreateEnum
CREATE TYPE "api_key_environment" AS ENUM ('live', 'test');

-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('api_key', 'user', 'system', 'webhook');

-- CreateEnum
CREATE TYPE "entity_type" AS ENUM ('customer', 'offer', 'offer_version', 'subscription', 'checkout', 'product', 'price');

-- CreateEnum
CREATE TYPE "outbox_event_status" AS ENUM ('pending', 'processed', 'failed');

-- CreateTable
CREATE TABLE "workspace" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "default_provider" "provider" NOT NULL DEFAULT 'stripe',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "external_id" VARCHAR(255),
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(200),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "status" "offer_status" NOT NULL DEFAULT 'active',
    "current_version_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_version" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "offer_version_status" NOT NULL DEFAULT 'draft',
    "config" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "offer_version_id" UUID NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'incomplete',
    "current_period_start" TIMESTAMPTZ NOT NULL,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "cancel_at" TIMESTAMPTZ,
    "canceled_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "trial_start" TIMESTAMPTZ,
    "trial_end" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "feature_key" VARCHAR(100) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "value_type" "entitlement_value_type" NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "customer_id" UUID,
    "offer_id" UUID NOT NULL,
    "offer_version_id" UUID NOT NULL,
    "status" "checkout_status" NOT NULL DEFAULT 'pending',
    "session_url" VARCHAR(2048),
    "success_url" VARCHAR(2048) NOT NULL,
    "cancel_url" VARCHAR(2048) NOT NULL,
    "customer_email" VARCHAR(255),
    "expires_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "checkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoint" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "secret" VARCHAR(255) NOT NULL,
    "events" TEXT[],
    "status" "webhook_endpoint_status" NOT NULL DEFAULT 'active',
    "description" VARCHAR(500),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "webhook_endpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_event" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "endpoint_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "webhook_event_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMPTZ,
    "next_retry_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "response" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "key_prefix" VARCHAR(20) NOT NULL,
    "key_hash" VARCHAR(255) NOT NULL,
    "role" "api_key_role" NOT NULL DEFAULT 'member',
    "environment" "api_key_environment" NOT NULL DEFAULT 'test',
    "last_used_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "actor_type" "actor_type" NOT NULL,
    "actor_id" VARCHAR(255) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" VARCHAR(255) NOT NULL,
    "changes" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_ref" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "entity_type" "entity_type" NOT NULL,
    "entity_id" UUID NOT NULL,
    "provider" "provider" NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_event" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "aggregate_type" VARCHAR(50) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "outbox_event_status" NOT NULL DEFAULT 'pending',
    "processed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dead_letter_event" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "original_event_id" UUID NOT NULL,
    "endpoint_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "failure_reason" VARCHAR(1000) NOT NULL,
    "attempts" INTEGER NOT NULL,
    "last_attempt_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dead_letter_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_key" (
    "id" UUID NOT NULL,
    "key" VARCHAR(512) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "request_path" VARCHAR(2048) NOT NULL,
    "request_method" VARCHAR(10) NOT NULL,
    "response" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "idempotency_key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_slug_key" ON "workspace"("slug");

-- CreateIndex
CREATE INDEX "customer_workspace_id_idx" ON "customer"("workspace_id");

-- CreateIndex
CREATE INDEX "customer_email_idx" ON "customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customer_workspace_id_email_key" ON "customer"("workspace_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "customer_workspace_id_external_id_key" ON "customer"("workspace_id", "external_id");

-- CreateIndex
CREATE INDEX "offer_workspace_id_idx" ON "offer"("workspace_id");

-- CreateIndex
CREATE INDEX "offer_workspace_id_status_idx" ON "offer"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "offer_version_offer_id_idx" ON "offer_version"("offer_id");

-- CreateIndex
CREATE INDEX "offer_version_offer_id_status_idx" ON "offer_version"("offer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "offer_version_offer_id_version_key" ON "offer_version"("offer_id", "version");

-- CreateIndex
CREATE INDEX "subscription_workspace_id_idx" ON "subscription"("workspace_id");

-- CreateIndex
CREATE INDEX "subscription_customer_id_idx" ON "subscription"("customer_id");

-- CreateIndex
CREATE INDEX "subscription_workspace_id_status_idx" ON "subscription"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "subscription_workspace_id_customer_id_idx" ON "subscription"("workspace_id", "customer_id");

-- CreateIndex
CREATE INDEX "entitlement_workspace_id_idx" ON "entitlement"("workspace_id");

-- CreateIndex
CREATE INDEX "entitlement_customer_id_idx" ON "entitlement"("customer_id");

-- CreateIndex
CREATE INDEX "entitlement_workspace_id_customer_id_feature_key_idx" ON "entitlement"("workspace_id", "customer_id", "feature_key");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_subscription_id_feature_key_key" ON "entitlement"("subscription_id", "feature_key");

-- CreateIndex
CREATE INDEX "checkout_workspace_id_idx" ON "checkout"("workspace_id");

-- CreateIndex
CREATE INDEX "checkout_workspace_id_status_idx" ON "checkout"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "webhook_endpoint_workspace_id_idx" ON "webhook_endpoint"("workspace_id");

-- CreateIndex
CREATE INDEX "webhook_endpoint_workspace_id_status_idx" ON "webhook_endpoint"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "webhook_event_workspace_id_idx" ON "webhook_event"("workspace_id");

-- CreateIndex
CREATE INDEX "webhook_event_endpoint_id_idx" ON "webhook_event"("endpoint_id");

-- CreateIndex
CREATE INDEX "webhook_event_status_next_retry_at_idx" ON "webhook_event"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "api_key_workspace_id_idx" ON "api_key"("workspace_id");

-- CreateIndex
CREATE INDEX "api_key_key_hash_idx" ON "api_key"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_key_prefix_key" ON "api_key"("key_prefix");

-- CreateIndex
CREATE INDEX "audit_log_workspace_id_idx" ON "audit_log"("workspace_id");

-- CreateIndex
CREATE INDEX "audit_log_workspace_id_resource_type_resource_id_idx" ON "audit_log"("workspace_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_log_workspace_id_created_at_idx" ON "audit_log"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "provider_ref_workspace_id_idx" ON "provider_ref"("workspace_id");

-- CreateIndex
CREATE INDEX "provider_ref_entity_type_entity_id_idx" ON "provider_ref"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_ref_workspace_id_provider_entity_type_external_id_key" ON "provider_ref"("workspace_id", "provider", "entity_type", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_ref_workspace_id_entity_type_entity_id_provider_key" ON "provider_ref"("workspace_id", "entity_type", "entity_id", "provider");

-- CreateIndex
CREATE INDEX "outbox_event_status_created_at_idx" ON "outbox_event"("status", "created_at");

-- CreateIndex
CREATE INDEX "outbox_event_workspace_id_idx" ON "outbox_event"("workspace_id");

-- CreateIndex
CREATE INDEX "dead_letter_event_workspace_id_idx" ON "dead_letter_event"("workspace_id");

-- CreateIndex
CREATE INDEX "dead_letter_event_endpoint_id_idx" ON "dead_letter_event"("endpoint_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_key_key_key" ON "idempotency_key"("key");

-- CreateIndex
CREATE INDEX "idempotency_key_key_idx" ON "idempotency_key"("key");

-- CreateIndex
CREATE INDEX "idempotency_key_expires_at_idx" ON "idempotency_key"("expires_at");

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "offer_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_version" ADD CONSTRAINT "offer_version_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_offer_version_id_fkey" FOREIGN KEY ("offer_version_id") REFERENCES "offer_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_offer_version_id_fkey" FOREIGN KEY ("offer_version_id") REFERENCES "offer_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "webhook_endpoint_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_event" ADD CONSTRAINT "webhook_event_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_event" ADD CONSTRAINT "webhook_event_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_ref" ADD CONSTRAINT "provider_ref_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dead_letter_event" ADD CONSTRAINT "dead_letter_event_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dead_letter_event" ADD CONSTRAINT "dead_letter_event_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
