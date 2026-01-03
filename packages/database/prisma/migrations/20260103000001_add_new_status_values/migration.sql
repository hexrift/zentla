-- Add new Zentla-native status values to the enum
-- These must be committed before they can be used in UPDATE statements

ALTER TYPE "subscription_status" ADD VALUE IF NOT EXISTS 'payment_failed';
ALTER TYPE "subscription_status" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "subscription_status" ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE "subscription_status" ADD VALUE IF NOT EXISTS 'suspended';
