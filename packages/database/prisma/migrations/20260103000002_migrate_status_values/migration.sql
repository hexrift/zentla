-- Migrate existing subscriptions from Stripe terminology to Zentla terminology
-- past_due -> payment_failed
-- incomplete -> pending
-- incomplete_expired -> expired
-- unpaid -> suspended

UPDATE "subscription" SET status = 'payment_failed' WHERE status = 'past_due';
UPDATE "subscription" SET status = 'pending' WHERE status = 'incomplete';
UPDATE "subscription" SET status = 'expired' WHERE status = 'incomplete_expired';
UPDATE "subscription" SET status = 'suspended' WHERE status = 'unpaid';

-- Note: The old enum values (past_due, incomplete, incomplete_expired, unpaid)
-- remain in the enum type but will no longer be used by the application.
-- PostgreSQL does not support removing enum values without recreating the type.
