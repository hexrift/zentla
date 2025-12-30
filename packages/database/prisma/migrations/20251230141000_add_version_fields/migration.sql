-- Add version fields for optimistic concurrency control (ETag support)

-- Add version to customer
ALTER TABLE "customer" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Add version to offer
ALTER TABLE "offer" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Add version to subscription
ALTER TABLE "subscription" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Add version to webhook_endpoint
ALTER TABLE "webhook_endpoint" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
