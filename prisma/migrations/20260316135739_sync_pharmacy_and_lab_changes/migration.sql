/*
  Warnings:

  - You are about to drop the column `expiry_date` on the `medicines` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PRESCRIPTION', 'LAB_REPORT', 'MEDICAL_RECORD');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('PENDING', 'DISPENSED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'PENDING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LabTestStatus" ADD VALUE 'PAYMENT_PENDING';
ALTER TYPE "LabTestStatus" ADD VALUE 'READY_FOR_SAMPLE_COLLECTION';

-- AlterTable
ALTER TABLE "bill_items" ADD COLUMN     "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "gst" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "profit" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "purchase_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
ALTER COLUMN "unit_price" SET DEFAULT 0,
ALTER COLUMN "total" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "lab_test_orders" ADD COLUMN     "bill_id" TEXT,
ADD COLUMN     "is_report_visible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "test_id" TEXT;

-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "appointment_id" TEXT,
ADD COLUMN     "chief_complaint" TEXT,
ADD COLUMN     "follow_up_date" TIMESTAMP(3),
ADD COLUMN     "icd_code" TEXT,
ADD COLUMN     "lab_orders" JSONB,
ADD COLUMN     "prescription_status" "PrescriptionStatus" DEFAULT 'PENDING',
ADD COLUMN     "treatment_notes" TEXT;

-- AlterTable
ALTER TABLE "medicines" DROP COLUMN "expiry_date",
ALTER COLUMN "price_per_unit" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "alt_phone" TEXT,
ADD COLUMN     "consulting_doctor" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "emergency_name" TEXT,
ADD COLUMN     "emergency_relation" TEXT,
ADD COLUMN     "id_number" TEXT,
ADD COLUMN     "id_type" TEXT,
ADD COLUMN     "mandal" TEXT,
ADD COLUMN     "payment_mode" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "referred_by" TEXT,
ADD COLUMN     "referred_person" TEXT,
ADD COLUMN     "registration_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "registration_fee" DECIMAL(10,2),
ADD COLUMN     "state" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "village" TEXT;

-- CreateTable
CREATE TABLE "download_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,

    CONSTRAINT "download_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "medicine_name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_batches" (
    "id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "distributor_name" TEXT NOT NULL,
    "manufacturing_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "purchase_price" DECIMAL(10,2) NOT NULL,
    "sale_price" DECIMAL(10,2) NOT NULL,
    "mrp" DECIMAL(10,2),
    "gst" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "purchase_id" TEXT,

    CONSTRAINT "medicine_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_mode" TEXT NOT NULL,
    "reference_no" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "action_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_tests" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "turnaround" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_parameters" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "parameter_name" TEXT NOT NULL,
    "group_name" TEXT,
    "unit" TEXT,
    "normal_min" DOUBLE PRECISION,
    "normal_max" DOUBLE PRECISION,
    "normal_range" TEXT,
    "reference_range_male" TEXT,
    "reference_range_female" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_test_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "parameter_id" TEXT NOT NULL,
    "result_value" TEXT NOT NULL,
    "flag" TEXT DEFAULT 'NORMAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_settings" (
    "id" TEXT NOT NULL,
    "hospital_name" TEXT NOT NULL,
    "address" TEXT,
    "contact_number" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logo_url" TEXT,
    "bank_name" TEXT,
    "account_name" TEXT,
    "account_number" TEXT,
    "ifsc_code" TEXT,
    "branch_name" TEXT,
    "upi_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_purchases" (
    "id" TEXT NOT NULL,
    "distributor_name" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL,
    "balance_amount" DECIMAL(10,2) NOT NULL,
    "payment_status" TEXT NOT NULL,
    "payment_date" TIMESTAMP(3),
    "payment_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_returns" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "return_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refund_amount" DECIMAL(10,2) NOT NULL,
    "refund_method" TEXT NOT NULL,
    "pharmacist_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_return_items" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "batch_number" TEXT,
    "return_qty" INTEGER NOT NULL,
    "sale_price" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "pharmacy_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_stock_returns" (
    "id" TEXT NOT NULL,
    "distributor_name" TEXT NOT NULL,
    "return_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "return_type" TEXT NOT NULL,
    "pharmacist_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_stock_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_stock_return_items" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "batch_number" TEXT,
    "return_qty" INTEGER NOT NULL,
    "return_reason" TEXT NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pharmacy_stock_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescription_items_prescription_id_idx" ON "prescription_items"("prescription_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_idx" ON "notifications"("recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "lab_tests_code_key" ON "lab_tests"("code");

-- CreateIndex
CREATE INDEX "medical_records_patient_id_idx" ON "medical_records"("patient_id");

-- CreateIndex
CREATE INDEX "medical_records_doctor_id_idx" ON "medical_records"("doctor_id");

-- CreateIndex
CREATE INDEX "medicines_name_idx" ON "medicines"("name");

-- CreateIndex
CREATE INDEX "medicines_generic_name_idx" ON "medicines"("generic_name");

-- CreateIndex
CREATE INDEX "patients_registration_date_idx" ON "patients"("registration_date");

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE INDEX "patients_first_name_idx" ON "patients"("first_name");

-- CreateIndex
CREATE INDEX "patients_last_name_idx" ON "patients"("last_name");

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_batches" ADD CONSTRAINT "medicine_batches_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_batches" ADD CONSTRAINT "medicine_batches_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "pharmacy_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_orders" ADD CONSTRAINT "lab_test_orders_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "lab_tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_orders" ADD CONSTRAINT "lab_test_orders_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_parameters" ADD CONSTRAINT "lab_test_parameters_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "lab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "lab_test_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "lab_test_parameters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_returns" ADD CONSTRAINT "pharmacy_returns_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_returns" ADD CONSTRAINT "pharmacy_returns_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("uhid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_return_items" ADD CONSTRAINT "pharmacy_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "pharmacy_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_return_items" ADD CONSTRAINT "pharmacy_return_items_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_stock_return_items" ADD CONSTRAINT "pharmacy_stock_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "pharmacy_stock_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_stock_return_items" ADD CONSTRAINT "pharmacy_stock_return_items_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
