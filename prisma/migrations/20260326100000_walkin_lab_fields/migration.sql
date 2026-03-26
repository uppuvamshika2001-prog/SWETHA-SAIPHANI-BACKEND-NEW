-- AlterTable: Make patient_id nullable on lab_test_orders for walk-in support
ALTER TABLE "lab_test_orders" ALTER COLUMN "patient_id" DROP NOT NULL;

-- AddColumn: Walk-in patient identification fields
ALTER TABLE "lab_test_orders" ADD COLUMN IF NOT EXISTS "walk_in_name" TEXT;
ALTER TABLE "lab_test_orders" ADD COLUMN IF NOT EXISTS "walk_in_phone" TEXT;
