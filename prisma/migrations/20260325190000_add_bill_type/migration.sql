-- AlterTable: Add bill_type column to bills
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "bill_type" TEXT NOT NULL DEFAULT 'PHARMACY';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bills_bill_type_idx" ON "bills"("bill_type");
