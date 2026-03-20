-- Migration: Add billing_status to lab_test_orders
-- Purpose: Track whether a paid lab order has been invoiced in the Billing module

-- 1. Add the billing_status column
ALTER TABLE lab_test_orders
ADD COLUMN IF NOT EXISTS billing_status VARCHAR(20) DEFAULT 'PENDING';

-- 2. Backfill: Mark orders that already have a bill_id as BILLED
UPDATE lab_test_orders SET billing_status = 'BILLED' WHERE bill_id IS NOT NULL;

-- 3. Mark orders without a bill as PENDING
UPDATE lab_test_orders SET billing_status = 'PENDING' WHERE bill_id IS NULL;
