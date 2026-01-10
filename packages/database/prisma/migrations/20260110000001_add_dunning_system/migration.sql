-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('pending', 'succeeded', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "refund_reason" AS ENUM ('duplicate', 'fraudulent', 'requested_by_customer');

-- CreateEnum
CREATE TYPE "dunning_final_action" AS ENUM ('suspend', 'cancel');

-- CreateEnum
CREATE TYPE "dunning_attempt_status" AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "dunning_email_type" AS ENUM ('payment_failed', 'payment_reminder', 'final_warning', 'subscription_suspended', 'subscription_canceled', 'payment_recovered');

-- CreateEnum
CREATE TYPE "email_notification_status" AS ENUM ('pending', 'sent', 'delivered', 'bounced', 'failed');

-- CreateTable
CREATE TABLE "invoice" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "subscription_id" UUID,
    "amount_due" INTEGER NOT NULL,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "amount_remaining" INTEGER NOT NULL DEFAULT 0,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'draft',
    "period_start" TIMESTAMPTZ,
    "period_end" TIMESTAMPTZ,
    "due_date" TIMESTAMPTZ,
    "paid_at" TIMESTAMPTZ,
    "voided_at" TIMESTAMPTZ,
    "provider" "provider" NOT NULL,
    "provider_invoice_id" VARCHAR(255) NOT NULL,
    "provider_invoice_url" VARCHAR(2048),
    "provider_pdf_url" VARCHAR(2048),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_payment_attempt" TIMESTAMPTZ,
    "dunning_started_at" TIMESTAMPTZ,
    "dunning_ended_at" TIMESTAMPTZ,
    "dunning_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_dunning_attempt_at" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_item" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_amount" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "period_start" TIMESTAMPTZ,
    "period_end" TIMESTAMPTZ,
    "provider_line_item_id" VARCHAR(255),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "invoice_id" UUID,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "refund_status" NOT NULL DEFAULT 'pending',
    "reason" "refund_reason",
    "failure_reason" VARCHAR(500),
    "provider" "provider" NOT NULL,
    "provider_refund_id" VARCHAR(255) NOT NULL,
    "provider_charge_id" VARCHAR(255),
    "provider_payment_intent_id" VARCHAR(255),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dunning_config" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "retry_schedule" INTEGER[] DEFAULT ARRAY[1, 3, 5, 7]::INTEGER[],
    "max_attempts" INTEGER NOT NULL DEFAULT 4,
    "final_action" "dunning_final_action" NOT NULL DEFAULT 'suspend',
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "emails_enabled" BOOLEAN NOT NULL DEFAULT false,
    "from_email" VARCHAR(255),
    "from_name" VARCHAR(200),
    "reply_to_email" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dunning_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dunning_attempt" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "subscription_id" UUID,
    "customer_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "dunning_attempt_status" NOT NULL DEFAULT 'pending',
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "executed_at" TIMESTAMPTZ,
    "success" BOOLEAN,
    "failure_reason" VARCHAR(1000),
    "provider_error" VARCHAR(2000),
    "decline_code" VARCHAR(100),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dunning_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dunning_email_template" (
    "id" UUID NOT NULL,
    "dunning_config_id" UUID NOT NULL,
    "type" "dunning_email_type" NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dunning_email_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_notification" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "invoice_id" UUID,
    "subscription_id" UUID,
    "type" "dunning_email_type" NOT NULL,
    "to_email" VARCHAR(255) NOT NULL,
    "status" "email_notification_status" NOT NULL DEFAULT 'pending',
    "provider_message_id" VARCHAR(255),
    "sent_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "opened_at" TIMESTAMPTZ,
    "bounced_at" TIMESTAMPTZ,
    "failure_reason" VARCHAR(1000),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_workspace_id_idx" ON "invoice"("workspace_id");

-- CreateIndex
CREATE INDEX "invoice_customer_id_idx" ON "invoice"("customer_id");

-- CreateIndex
CREATE INDEX "invoice_subscription_id_idx" ON "invoice"("subscription_id");

-- CreateIndex
CREATE INDEX "invoice_workspace_id_status_idx" ON "invoice"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_workspace_id_provider_provider_invoice_id_key" ON "invoice"("workspace_id", "provider", "provider_invoice_id");

-- CreateIndex
CREATE INDEX "invoice_line_item_invoice_id_idx" ON "invoice_line_item"("invoice_id");

-- CreateIndex
CREATE INDEX "refund_workspace_id_idx" ON "refund"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "refund_workspace_id_provider_provider_refund_id_key" ON "refund"("workspace_id", "provider", "provider_refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "dunning_config_workspace_id_key" ON "dunning_config"("workspace_id");

-- CreateIndex
CREATE INDEX "dunning_attempt_workspace_id_idx" ON "dunning_attempt"("workspace_id");

-- CreateIndex
CREATE INDEX "dunning_attempt_invoice_id_idx" ON "dunning_attempt"("invoice_id");

-- CreateIndex
CREATE INDEX "dunning_attempt_workspace_id_status_scheduled_at_idx" ON "dunning_attempt"("workspace_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "dunning_attempt_subscription_id_idx" ON "dunning_attempt"("subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "dunning_email_template_dunning_config_id_type_key" ON "dunning_email_template"("dunning_config_id", "type");

-- CreateIndex
CREATE INDEX "email_notification_workspace_id_idx" ON "email_notification"("workspace_id");

-- CreateIndex
CREATE INDEX "email_notification_workspace_id_status_idx" ON "email_notification"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "email_notification_customer_id_idx" ON "email_notification"("customer_id");

-- CreateIndex
CREATE INDEX "email_notification_invoice_id_idx" ON "email_notification"("invoice_id");

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_item" ADD CONSTRAINT "invoice_line_item_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dunning_config" ADD CONSTRAINT "dunning_config_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dunning_attempt" ADD CONSTRAINT "dunning_attempt_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dunning_email_template" ADD CONSTRAINT "dunning_email_template_dunning_config_id_fkey" FOREIGN KEY ("dunning_config_id") REFERENCES "dunning_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_notification" ADD CONSTRAINT "email_notification_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
