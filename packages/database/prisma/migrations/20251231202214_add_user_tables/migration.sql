-- CreateEnum
CREATE TYPE "workspace_mode" AS ENUM ('test', 'live');

-- CreateEnum
CREATE TYPE "workspace_role" AS ENUM ('owner', 'admin');

-- AlterEnum (using DO block to handle "already exists" gracefully)
DO $$ BEGIN
    ALTER TYPE "offer_status" ADD VALUE 'draft';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "promotion_status" ADD VALUE 'draft';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "offer" ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}';

-- Note: Cannot set default to 'draft' in same transaction as enum addition
-- Prisma will handle the default at application level

-- AlterTable
ALTER TABLE "webhook_endpoint" ADD COLUMN     "failure_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_delivery_at" TIMESTAMPTZ,
ADD COLUMN     "last_delivery_status" INTEGER,
ADD COLUMN     "last_error" VARCHAR(1000),
ADD COLUMN     "last_error_at" TIMESTAMPTZ,
ADD COLUMN     "success_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "workspace" ADD COLUMN     "live_access_denied_at" TIMESTAMPTZ,
ADD COLUMN     "live_access_granted_at" TIMESTAMPTZ,
ADD COLUMN     "live_access_requested_at" TIMESTAMPTZ,
ADD COLUMN     "mode" "workspace_mode" NOT NULL DEFAULT 'test';

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(200),
    "avatar_url" VARCHAR(2048),
    "password_hash" VARCHAR(255),
    "github_id" VARCHAR(255),
    "google_id" VARCHAR(255),
    "email_verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_membership" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "workspace_role" NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workspace_membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_github_id_key" ON "user"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_google_id_key" ON "user"("google_id");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_session_token_key" ON "user_session"("token");

-- CreateIndex
CREATE INDEX "user_session_token_idx" ON "user_session"("token");

-- CreateIndex
CREATE INDEX "user_session_user_id_idx" ON "user_session"("user_id");

-- CreateIndex
CREATE INDEX "user_session_expires_at_idx" ON "user_session"("expires_at");

-- CreateIndex
CREATE INDEX "workspace_membership_user_id_idx" ON "workspace_membership"("user_id");

-- CreateIndex
CREATE INDEX "workspace_membership_workspace_id_idx" ON "workspace_membership"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_membership_workspace_id_user_id_key" ON "workspace_membership"("workspace_id", "user_id");

-- AddForeignKey
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_membership" ADD CONSTRAINT "workspace_membership_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_membership" ADD CONSTRAINT "workspace_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_intent" ADD CONSTRAINT "checkout_intent_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_intent" ADD CONSTRAINT "checkout_intent_promotion_version_id_fkey" FOREIGN KEY ("promotion_version_id") REFERENCES "promotion_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;
