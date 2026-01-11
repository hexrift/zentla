-- CreateEnum
CREATE TYPE "credit_status" AS ENUM ('active', 'depleted', 'expired', 'voided');

-- CreateEnum
CREATE TYPE "credit_reason" AS ENUM ('promotional', 'refund_alternative', 'goodwill', 'billing_error', 'service_credit', 'other');

-- CreateEnum
CREATE TYPE "credit_transaction_type" AS ENUM ('issued', 'applied', 'expired', 'voided', 'adjusted');

-- AlterTable
ALTER TABLE "invoice" ADD COLUMN "credits_applied" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "credit" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "credit_status" NOT NULL DEFAULT 'active',
    "reason" "credit_reason",
    "description" VARCHAR(500),
    "expires_at" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transaction" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "credit_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "invoice_id" UUID,
    "type" "credit_transaction_type" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_before" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" VARCHAR(500),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_workspace_id_idx" ON "credit"("workspace_id");

-- CreateIndex
CREATE INDEX "credit_workspace_id_customer_id_idx" ON "credit"("workspace_id", "customer_id");

-- CreateIndex
CREATE INDEX "credit_workspace_id_status_idx" ON "credit"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "credit_expires_at_idx" ON "credit"("expires_at");

-- CreateIndex
CREATE INDEX "credit_transaction_workspace_id_idx" ON "credit_transaction"("workspace_id");

-- CreateIndex
CREATE INDEX "credit_transaction_credit_id_idx" ON "credit_transaction"("credit_id");

-- CreateIndex
CREATE INDEX "credit_transaction_workspace_id_customer_id_idx" ON "credit_transaction"("workspace_id", "customer_id");

-- CreateIndex
CREATE INDEX "credit_transaction_invoice_id_idx" ON "credit_transaction"("invoice_id");

-- AddForeignKey
ALTER TABLE "credit" ADD CONSTRAINT "credit_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit" ADD CONSTRAINT "credit_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "credit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
