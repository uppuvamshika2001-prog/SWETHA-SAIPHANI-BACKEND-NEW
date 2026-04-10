-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECHNICIAN', 'PATIENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'PENDING');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'PENDING');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LabTestStatus" AS ENUM ('ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PAYMENT_PENDING', 'READY_FOR_SAMPLE_COLLECTION');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PRESCRIPTION', 'LAB_REPORT', 'MEDICAL_RECORD');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('PENDING', 'DISPENSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LabTestType" AS ENUM ('PANEL', 'SINGLE', 'REPORT');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('OP', 'WALK_IN');

-- CreateEnum
CREATE TYPE "InventoryLogType" AS ENUM ('DISPENSE', 'PATIENT_RETURN', 'DISTRIBUTOR_RETURN', 'STOCK_ADD', 'ADJUSTMENT');

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
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PATIENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "specialization" TEXT,
    "department" TEXT,
    "license_no" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "uhid" TEXT NOT NULL,
    "user_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "emergency_contact" TEXT,
    "blood_group" TEXT,
    "allergies" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "alt_phone" TEXT,
    "consulting_doctor" TEXT,
    "department" TEXT,
    "district" TEXT,
    "emergency_name" TEXT,
    "emergency_relation" TEXT,
    "id_number" TEXT,
    "id_type" TEXT,
    "mandal" TEXT,
    "payment_mode" TEXT,
    "pincode" TEXT,
    "referred_by" TEXT,
    "referred_person" TEXT,
    "registration_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registration_fee" DECIMAL(10,2),
    "state" TEXT,
    "title" TEXT,
    "village" TEXT,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("uhid")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "treatment" TEXT,
    "notes" TEXT,
    "vital_signs" JSONB,
    "prescriptions" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "appointment_id" TEXT,
    "chief_complaint" TEXT,
    "follow_up_date" TIMESTAMP(3),
    "icd_code" TEXT,
    "lab_orders" JSONB,
    "prescription_status" "PrescriptionStatus" DEFAULT 'PENDING',
    "treatment_notes" TEXT,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "notes" TEXT,
    "medicines" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "medicines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "generic_name" TEXT,
    "manufacturer" TEXT,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'tablet',
    "price_per_unit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "category_id" INTEGER,
    "hsn_code" TEXT,

    CONSTRAINT "medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
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
    "selling_price" DECIMAL(10,2) NOT NULL,
    "mrp" DECIMAL(10,2),
    "gst_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "purchase_id" TEXT,
    "expiry_alert_1m_sent" BOOLEAN NOT NULL DEFAULT false,
    "expiry_alert_3m_sent" BOOLEAN NOT NULL DEFAULT false,
    "ptr" DECIMAL DEFAULT 0,
    "free_quantity" INTEGER DEFAULT 0,
    "taxable_amount" DECIMAL DEFAULT 0,
    "gst_amount" DECIMAL DEFAULT 0,
    "total_amount" DECIMAL DEFAULT 0,

    CONSTRAINT "medicine_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT,
    "bill_number" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "gst_percent" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "gst_amount" DECIMAL(10,2) NOT NULL,
    "grand_total" DECIMAL(10,2) NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "customer_name" TEXT,
    "is_walk_in" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "bill_type" TEXT DEFAULT 'PHARMACY',
    "visit_type" VARCHAR(20) DEFAULT 'OP',
    "walk_in_name" VARCHAR(255),

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_items" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "medicine_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gst" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "purchase_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "batch_number" TEXT,
    "expiry_date" TIMESTAMP(3),
    "hsn_code" TEXT,
    "discount_amount" DOUBLE PRECISION DEFAULT 0,
    "gst_amount" DOUBLE PRECISION DEFAULT 0,
    "total_amount" DOUBLE PRECISION DEFAULT 0,

    CONSTRAINT "bill_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_orders" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT,
    "ordered_by_id" TEXT NOT NULL,
    "test_name" TEXT NOT NULL,
    "test_code" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" "LabTestStatus" NOT NULL DEFAULT 'ORDERED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "bill_id" TEXT,
    "is_report_visible" BOOLEAN NOT NULL DEFAULT true,
    "test_id" TEXT,
    "doctor_id" TEXT,
    "is_walk_in_lab" BOOLEAN NOT NULL DEFAULT false,
    "ordered_by_role" TEXT,
    "billing_status" TEXT NOT NULL DEFAULT 'PENDING',
    "order_number" TEXT,
    "visit_type" VARCHAR(20) DEFAULT 'OP',
    "walk_in_name" VARCHAR(255),
    "walk_in_phone" TEXT,

    CONSTRAINT "lab_test_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_results" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "interpretation" TEXT,
    "attachments" JSONB,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_test_results_pkey" PRIMARY KEY ("id")
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
    "reference_id" TEXT,

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
    "type" "LabTestType" NOT NULL DEFAULT 'PANEL',

    CONSTRAINT "lab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_categories" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_test_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_parameters" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "parameter_name" TEXT NOT NULL,
    "unit" TEXT,
    "normal_min" DOUBLE PRECISION,
    "normal_max" DOUBLE PRECISION,
    "normal_range" TEXT,
    "reference_range_male" TEXT,
    "reference_range_female" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "category_id" TEXT,
    "input_type" TEXT NOT NULL DEFAULT 'number',
    "options" JSONB,
    "reference_range" JSONB,

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
    "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balance_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "file_url" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "visit_type" VARCHAR(20) DEFAULT 'OP',
    "walk_in_name" VARCHAR(255),

    CONSTRAINT "pharmacy_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_payments" (
    "id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_payments_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "inventory_logs" (
    "id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "batch_number" TEXT,
    "type" "InventoryLogType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previous_stock" INTEGER NOT NULL,
    "new_stock" INTEGER NOT NULL,
    "reference_id" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_orders_backup" (
    "id" TEXT,
    "patient_id" TEXT,
    "ordered_by_id" TEXT,
    "test_name" TEXT,
    "test_code" TEXT,
    "priority" TEXT,
    "status" "LabTestStatus",
    "notes" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "bill_id" TEXT,
    "is_report_visible" BOOLEAN,
    "test_id" TEXT,
    "doctor_id" TEXT,
    "is_walk_in_lab" BOOLEAN,
    "ordered_by_role" TEXT,
    "billing_status" TEXT,
    "order_number" TEXT
);

-- CreateTable
CREATE TABLE "pharmacy_purchases_backup" (
    "id" TEXT,
    "distributor_name" TEXT,
    "invoice_number" TEXT,
    "purchase_date" TIMESTAMP(3),
    "total_amount" DECIMAL(10,2),
    "amount_paid" DECIMAL(10,2),
    "balance_amount" DECIMAL(10,2),
    "payment_status" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "file_url" TEXT,
    "is_deleted" BOOLEAN
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_id_key" ON "staff"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_user_id_key" ON "patients"("user_id");

-- CreateIndex
CREATE INDEX "patients_registration_date_idx" ON "patients"("registration_date");

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE INDEX "patients_first_name_idx" ON "patients"("first_name");

-- CreateIndex
CREATE INDEX "patients_last_name_idx" ON "patients"("last_name");

-- CreateIndex
CREATE INDEX "medical_records_patient_id_idx" ON "medical_records"("patient_id");

-- CreateIndex
CREATE INDEX "medical_records_doctor_id_idx" ON "medical_records"("doctor_id");

-- CreateIndex
CREATE INDEX "prescription_items_prescription_id_idx" ON "prescription_items"("prescription_id");

-- CreateIndex
CREATE INDEX "medicines_name_idx" ON "medicines"("name");

-- CreateIndex
CREATE INDEX "medicines_generic_name_idx" ON "medicines"("generic_name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bills_bill_number_key" ON "bills"("bill_number");

-- CreateIndex
CREATE INDEX "bills_bill_type_idx" ON "bills"("bill_type");

-- CreateIndex
CREATE UNIQUE INDEX "lab_test_results_order_id_key" ON "lab_test_results"("order_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_idx" ON "notifications"("recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_purchases_distributor_name_invoice_number_key" ON "pharmacy_purchases"("distributor_name", "invoice_number");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("uhid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("uhid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("uhid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_batches" ADD CONSTRAINT "medicine_batches_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_batches" ADD CONSTRAINT "medicine_batches_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "pharmacy_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("uhid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_orders" ADD CONSTRAINT "lab_test_orders_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_orders" ADD CONSTRAINT "lab_test_orders_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_orders" ADD CONSTRAINT "lab_test_orders_ordered_by_id_fkey" FOREIGN KEY ("ordered_by_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_orders" ADD CONSTRAINT "lab_test_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("uhid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_orders" ADD CONSTRAINT "lab_test_orders_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "lab_tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_results" ADD CONSTRAINT "lab_test_results_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "lab_test_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_results" ADD CONSTRAINT "lab_test_results_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_categories" ADD CONSTRAINT "lab_test_categories_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "lab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_parameters" ADD CONSTRAINT "lab_test_parameters_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "lab_test_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_parameters" ADD CONSTRAINT "lab_test_parameters_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "lab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "lab_test_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "lab_test_parameters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_payments" ADD CONSTRAINT "pharmacy_payments_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "pharmacy_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_returns" ADD CONSTRAINT "pharmacy_returns_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_returns" ADD CONSTRAINT "pharmacy_returns_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("uhid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_return_items" ADD CONSTRAINT "pharmacy_return_items_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_return_items" ADD CONSTRAINT "pharmacy_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "pharmacy_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_stock_return_items" ADD CONSTRAINT "pharmacy_stock_return_items_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_stock_return_items" ADD CONSTRAINT "pharmacy_stock_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "pharmacy_stock_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

