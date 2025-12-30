-- CreateEnum
CREATE TYPE "promotion_status" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "promotion_version_status" AS ENUM ('draft', 'published', 'archived');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "entity_type" ADD VALUE 'coupon';
ALTER TYPE "entity_type" ADD VALUE 'promotion_code';

-- CreateTable
CREATE TABLE "promotion" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(1000),
    "status" "promotion_status" NOT NULL DEFAULT 'active',
    "current_version_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_version" (
    "id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "promotion_version_status" NOT NULL DEFAULT 'draft',
    "config" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applied_promotion" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "promotion_version_id" UUID NOT NULL,
    "checkout_id" UUID,
    "subscription_id" UUID,
    "customer_id" UUID NOT NULL,
    "discount_amount" INTEGER NOT NULL,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applied_promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promotion_current_version_id_key" ON "promotion"("current_version_id");

-- CreateIndex
CREATE INDEX "promotion_workspace_id_idx" ON "promotion"("workspace_id");

-- CreateIndex
CREATE INDEX "promotion_workspace_id_status_idx" ON "promotion"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_workspace_id_code_key" ON "promotion"("workspace_id", "code");

-- CreateIndex
CREATE INDEX "promotion_version_promotion_id_idx" ON "promotion_version"("promotion_id");

-- CreateIndex
CREATE INDEX "promotion_version_promotion_id_status_idx" ON "promotion_version"("promotion_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_version_promotion_id_version_key" ON "promotion_version"("promotion_id", "version");

-- CreateIndex
CREATE INDEX "applied_promotion_workspace_id_idx" ON "applied_promotion"("workspace_id");

-- CreateIndex
CREATE INDEX "applied_promotion_promotion_id_idx" ON "applied_promotion"("promotion_id");

-- CreateIndex
CREATE INDEX "applied_promotion_customer_id_idx" ON "applied_promotion"("customer_id");

-- CreateIndex
CREATE INDEX "applied_promotion_checkout_id_idx" ON "applied_promotion"("checkout_id");

-- CreateIndex
CREATE INDEX "applied_promotion_subscription_id_idx" ON "applied_promotion"("subscription_id");

-- AddForeignKey
ALTER TABLE "promotion" ADD CONSTRAINT "promotion_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion" ADD CONSTRAINT "promotion_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "promotion_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_version" ADD CONSTRAINT "promotion_version_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_promotion" ADD CONSTRAINT "applied_promotion_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_promotion" ADD CONSTRAINT "applied_promotion_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_promotion" ADD CONSTRAINT "applied_promotion_promotion_version_id_fkey" FOREIGN KEY ("promotion_version_id") REFERENCES "promotion_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_promotion" ADD CONSTRAINT "applied_promotion_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "checkout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_promotion" ADD CONSTRAINT "applied_promotion_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_promotion" ADD CONSTRAINT "applied_promotion_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
