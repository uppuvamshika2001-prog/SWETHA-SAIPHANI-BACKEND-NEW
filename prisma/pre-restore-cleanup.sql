-- ============================================================
-- PRE-RESTORE CLEANUP SCRIPT
-- Run this BEFORE pg_restore to clear conflicting tables/constraints
-- This allows the legacy backup (with medicines.id as TEXT/UUID)
-- to restore cleanly into the current database.
-- ============================================================

BEGIN;

-- 1. Drop all foreign key constraints that reference medicines(id)
ALTER TABLE IF EXISTS public.inventory_logs DROP CONSTRAINT IF EXISTS inventory_logs_medicine_id_fkey;
ALTER TABLE IF EXISTS public.bill_items DROP CONSTRAINT IF EXISTS bill_items_medicine_id_fkey;
ALTER TABLE IF EXISTS public.medicine_batches DROP CONSTRAINT IF EXISTS medicine_batches_medicine_id_fkey;
ALTER TABLE IF EXISTS public.pharmacy_return_items DROP CONSTRAINT IF EXISTS pharmacy_return_items_medicine_id_fkey;
ALTER TABLE IF EXISTS public.pharmacy_stock_return_items DROP CONSTRAINT IF EXISTS pharmacy_stock_return_items_medicine_id_fkey;

-- 2. Drop foreign key constraint referencing categories(id)
ALTER TABLE IF EXISTS public.medicines DROP CONSTRAINT IF EXISTS medicines_category_id_fkey;

-- 3. Drop the conflicting tables entirely (CASCADE handles any remaining deps)
DROP TABLE IF EXISTS public.inventory_logs CASCADE;
DROP TABLE IF EXISTS public.pharmacy_stock_return_items CASCADE;
DROP TABLE IF EXISTS public.pharmacy_return_items CASCADE;
DROP TABLE IF EXISTS public.medicine_batches CASCADE;
DROP TABLE IF EXISTS public.bill_items CASCADE;
DROP TABLE IF EXISTS public.medicines CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;

COMMIT;

-- ============================================================
-- Now run pg_restore:
-- docker exec -i <container_id> pg_restore -h localhost -cO --if-exists -d swethasaiphaniclinic -U postgres --no-password < backup.sql
-- ============================================================
