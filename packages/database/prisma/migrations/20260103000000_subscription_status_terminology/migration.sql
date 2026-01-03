-- Rename subscription status values to use Zentla terminology
-- past_due -> payment_failed
-- incomplete -> pending
-- incomplete_expired -> expired
-- unpaid -> suspended

-- Step 1: Add new enum values
ALTER TYPE "subscription_status" ADD VALUE IF NOT EXISTS 'payment_failed';
ALTER TYPE "subscription_status" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "subscription_status" ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE "subscription_status" ADD VALUE IF NOT EXISTS 'suspended';

-- Step 2: Update existing subscriptions to use new values
UPDATE "subscription" SET status = 'payment_failed' WHERE status = 'past_due';
UPDATE "subscription" SET status = 'pending' WHERE status = 'incomplete';
UPDATE "subscription" SET status = 'expired' WHERE status = 'incomplete_expired';
UPDATE "subscription" SET status = 'suspended' WHERE status = 'unpaid';

-- Note: PostgreSQL does not allow removing enum values directly.
-- The old values (past_due, incomplete, incomplete_expired, unpaid) will remain in the enum
-- but will no longer be used. They can be removed in a future migration by recreating the enum type.
