-- SQL Migration for Lab Order Status Standardization
-- This script replaces the legacy 'PENDING' status with the standardized 'PAYMENT_PENDING' status.
-- Use this in your production environment to ensure data consistency with the updated Prisma schema.

-- 1. Update lab_orders table
-- Note: Replace 'lab_orders' with your actual table name if different (Prisma usually maps LabTestOrder to lab_orders or LabTestOrder)
UPDATE "LabTestOrder" SET status = 'PAYMENT_PENDING' WHERE status = 'PENDING';

-- 2. Verify updates
SELECT count(*) FROM "LabTestOrder" WHERE status = 'PENDING';
SELECT count(*) FROM "LabTestOrder" WHERE status = 'PAYMENT_PENDING';
