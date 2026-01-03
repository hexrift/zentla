-- CreateEnum
CREATE TYPE "usage_aggregation_type" AS ENUM ('sum', 'max', 'count', 'last');

-- CreateTable
CREATE TABLE "usage_event" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "subscription_id" UUID,
    "metric_key" VARCHAR(100) NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "idempotency_key" VARCHAR(255),
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_aggregate" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "subscription_id" UUID,
    "metric_key" VARCHAR(100) NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "total_quantity" DECIMAL(20,6) NOT NULL,
    "event_count" INTEGER NOT NULL DEFAULT 0,
    "last_updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_aggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_metric" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "unit" VARCHAR(50),
    "aggregation" "usage_aggregation_type" NOT NULL DEFAULT 'sum',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "usage_metric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usage_event_idempotency_key_key" ON "usage_event"("idempotency_key");

-- CreateIndex
CREATE INDEX "usage_event_workspace_id_customer_id_metric_key_idx" ON "usage_event"("workspace_id", "customer_id", "metric_key");

-- CreateIndex
CREATE INDEX "usage_event_workspace_id_subscription_id_metric_key_idx" ON "usage_event"("workspace_id", "subscription_id", "metric_key");

-- CreateIndex
CREATE INDEX "usage_event_workspace_id_metric_key_timestamp_idx" ON "usage_event"("workspace_id", "metric_key", "timestamp");

-- CreateIndex
CREATE INDEX "usage_event_idempotency_key_idx" ON "usage_event"("idempotency_key");

-- CreateIndex
CREATE INDEX "usage_aggregate_workspace_id_subscription_id_idx" ON "usage_aggregate"("workspace_id", "subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_aggregate_workspace_id_customer_id_metric_key_period__key" ON "usage_aggregate"("workspace_id", "customer_id", "metric_key", "period_start");

-- CreateIndex
CREATE INDEX "usage_metric_workspace_id_idx" ON "usage_metric"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_metric_workspace_id_key_key" ON "usage_metric"("workspace_id", "key");
