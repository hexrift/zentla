-- CreateEnum
CREATE TYPE "feedback_type" AS ENUM ('bug', 'feature', 'other');

-- CreateEnum
CREATE TYPE "feedback_status" AS ENUM ('pending', 'reviewed', 'accepted', 'rejected', 'resolved');

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "user_email" VARCHAR(255),
    "type" "feedback_type" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "feedback_status" NOT NULL DEFAULT 'pending',
    "response" TEXT,
    "responded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_status_idx" ON "feedback"("status");

-- CreateIndex
CREATE INDEX "feedback_created_at_idx" ON "feedback"("created_at");
