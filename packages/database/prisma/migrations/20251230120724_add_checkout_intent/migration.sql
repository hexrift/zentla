-- CreateEnum
CREATE TYPE "checkout_intent_status" AS ENUM ('pending', 'processing', 'requires_action', 'succeeded', 'failed', 'expired');

-- AlterTable
ALTER TABLE "processed_provider_event" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "checkout_intent" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "customer_id" UUID,
    "offer_id" UUID NOT NULL,
    "offer_version_id" UUID NOT NULL,
    "status" "checkout_intent_status" NOT NULL DEFAULT 'pending',
    "currency" VARCHAR(3) NOT NULL,
    "subtotal_amount" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL,
    "trial_days" INTEGER,
    "promotion_id" UUID,
    "promotion_version_id" UUID,
    "promotion_code" VARCHAR(50),
    "provider_payment_id" VARCHAR(255),
    "client_secret" VARCHAR(500),
    "idempotency_key" VARCHAR(255),
    "subscription_id" UUID,
    "customer_email" VARCHAR(255),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "checkout_intent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checkout_intent_idempotency_key_key" ON "checkout_intent"("idempotency_key");

-- CreateIndex
CREATE INDEX "checkout_intent_workspace_id_idx" ON "checkout_intent"("workspace_id");

-- CreateIndex
CREATE INDEX "checkout_intent_workspace_id_status_idx" ON "checkout_intent"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "checkout_intent_idempotency_key_idx" ON "checkout_intent"("idempotency_key");

-- AddForeignKey
ALTER TABLE "checkout_intent" ADD CONSTRAINT "checkout_intent_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_intent" ADD CONSTRAINT "checkout_intent_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_intent" ADD CONSTRAINT "checkout_intent_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_intent" ADD CONSTRAINT "checkout_intent_offer_version_id_fkey" FOREIGN KEY ("offer_version_id") REFERENCES "offer_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_intent" ADD CONSTRAINT "checkout_intent_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
