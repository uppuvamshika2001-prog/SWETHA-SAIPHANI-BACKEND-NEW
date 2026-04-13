import { z } from 'zod';
import { BillStatus } from '@prisma/client';

export const createMedicineSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    generic_name: z.string().optional(),
    manufacturer: z.string().optional(),
    category_id: z.coerce.number().int().optional(),
    unit: z.string().default('tablet'),
    reorder_level: z.number().int().nonnegative().default(10),
    // Batch information for initial stock entry
    batch_number: z.string().min(1, 'Batch number is required'),
    distributor_name: z.string().min(1, 'Distributor name is required'),
    manufacturing_date: z.string().transform((s) => new Date(s)).optional(),
    expiry_date: z.string().transform((s) => new Date(s)),
    purchase_price: z.number().nonnegative(),
    selling_price: z.number().nonnegative(),
    mrp: z.number().nonnegative().optional(),
    gst_percent: z.number().nonnegative().default(0),
    stock_quantity: z.number().int().nonnegative(),
    pack_quantity: z.number().int().positive().default(1),
    free_quantity: z.number().int().nonnegative().default(0),
    ptr: z.number().nonnegative().default(0),
    pts: z.number().nonnegative().default(0),
    taxable_amount: z.number().nonnegative().default(0),
    gst_amount: z.number().nonnegative().default(0),
    total_amount: z.number().nonnegative().default(0),
    // Purchase payment tracking
    invoice_number: z.string().optional(),
});

export const recordPaymentSchema = z.object({
    purchase_id: z.string(),
    amount: z.number().positive(),
    payment_date: z.string().transform((s) => new Date(s)).optional(),
    payment_method: z.string(),
    notes: z.string().optional(),
});

export const createPurchaseSchema = z.object({
    distributor_name: z.string().min(1, 'Distributor name is required'),
    invoice_number: z.string().min(1, 'Invoice number is required'),
    purchase_date: z.string().transform((s) => new Date(s)).optional(),
    items: z.array(z.object({
        medicine_id: z.string().min(1, 'Medicine is required'),
        batch_number: z.string().min(1, 'Batch number is required'),
        manufacturing_date: z.string().transform((s) => new Date(s)).optional(),
        expiry_date: z.string().transform((s) => new Date(s)),
        purchase_price: z.number().nonnegative(),
        selling_price: z.number().nonnegative(),
        mrp: z.number().nonnegative().optional(),
        gst_percent: z.number().nonnegative().default(0),
        free_quantity: z.number().int().nonnegative().default(0),
        ptr: z.number().nonnegative().default(0),
        pts: z.number().nonnegative().default(0),
        taxable_amount: z.number().nonnegative().default(0),
        gst_amount: z.number().nonnegative().default(0),
        total_amount: z.number().nonnegative().default(0),
        stock_quantity: z.number().int().positive(),
        pack_quantity: z.number().int().positive().default(1),
    })).min(1, 'At least one item is required')
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

export const updateMedicineSchema = z.object({
    name: z.string().min(1).optional(),
    generic_name: z.string().optional(),
    manufacturer: z.string().optional(),
    category_id: z.coerce.number().int().optional(),
    unit: z.string().optional(),
    reorder_level: z.number().int().nonnegative().optional(),
    is_active: z.boolean().optional(),
});

export const updateBatchSchema = z.object({
    batch_number: z.string().min(1).optional(),
    distributor_name: z.string().min(1).optional(),
    manufacturing_date: z.string().transform((s) => new Date(s)).optional(),
    expiry_date: z.string().transform((s) => new Date(s)).optional(),
    purchase_price: z.number().nonnegative().optional(),
    selling_price: z.number().nonnegative().optional(),
    mrp: z.number().nonnegative().optional(),
    gst_percent: z.number().nonnegative().optional(),
    stock_quantity: z.number().int().nonnegative().optional(),
    pack_quantity: z.number().int().positive().optional(),
    free_quantity: z.number().int().nonnegative().optional(),
    ptr: z.number().nonnegative().optional(),
    pts: z.number().nonnegative().optional(),
    taxable_amount: z.number().nonnegative().optional(),
    gst_amount: z.number().nonnegative().optional(),
    total_amount: z.number().nonnegative().optional(),
    is_active: z.boolean().optional(),
});

export const medicineQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100, "Maximum limit allowed is 100 records per request").default(10),
    search: z.string().optional(),
    category: z.string().optional(),
    low_stock: z.coerce.boolean().optional(),
    format: z.string().optional(),
    all_batches: z.coerce.boolean().optional(),
    bill_type: z.enum(['PHARMACY', 'CONSULTATION', 'LAB']).optional(),
});

export const createBillItemSchema = z.object({
    medicine_id: z.string().optional(),
    description: z.string().min(1),
    quantity: z.number().int().positive(),
    unit_price: z.number().nonnegative(),
    batch_number: z.string().optional(),
    expiry_date: z.coerce.date().optional(),
    hsn_code: z.string().optional(),
    discount: z.number().nonnegative().default(0),
    gst_percent: z.number().nonnegative().default(0),
});

export const createBillSchema = z.object({
    patient_id: z.string().optional(),
    customer_name: z.string().optional(),
    phone: z.string().optional(),
    is_walk_in: z.boolean().default(false),
    items: z.array(createBillItemSchema).min(1, 'At least one item is required'),
    discount: z.number().nonnegative().default(0),
    gst_percent: z.number().nonnegative().default(18),
    notes: z.string().optional(),
});

export const updateBillSchema = z.object({
    status: z.nativeEnum(BillStatus).optional(),
    paid_amount: z.number().nonnegative().optional(),
    notes: z.string().optional(),
});

export type CreateMedicineInput = z.infer<typeof createMedicineSchema>;
export type UpdateMedicineInput = z.infer<typeof updateMedicineSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type MedicineQueryInput = z.infer<typeof medicineQuerySchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type CreateBillItem = z.infer<typeof createBillItemSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export interface MedicineResponse {
    id: string;
    name: string;
    generic_name: string | null;
    manufacturer: string | null;
    category_id: number | null;
    category?: { id: number; name: string } | null;
    unit: string;
    stock_quantity: number;
    pack_quantity: number;
    reorder_level: number;
    is_active: boolean;
    batches: Array<{
        id: string;
        batch_number: string;
        distributor_name: string;
        manufacturing_date: Date | null;
        expiry_date: Date;
        purchase_price: number;
        selling_price: number;
        mrp: number | null;
        gst_percent: number;
        stock_quantity: number;
        pack_quantity: number;
        free_quantity: number;
        ptr: number;
        taxable_amount: number;
        gst_amount: number;
        total_amount: number;
        is_active: boolean;
    }>;
}

export interface BillResponse {
    id: string;
    patient_id: string | null;
    customer_name: string | null;
    phone: string | null;
    is_walk_in: boolean;
    bill_number: string;
    subtotal: number;
    discount: number;
    gst_percent: number;
    gst_amount: number;
    grand_total: number;
    status: BillStatus;
    paid_amount: number;
    items: Array<{
        id: string;
        description: string;
        quantity: number;
        unit_price: number;
        purchase_price: number;
        profit: number;
        medicine_id: string | null;
        batch_number: string | null;
        expiry_date: Date | null;
        hsn_code: string | null;
        discount: number;
        gst_percent: number;
        total: number;
    }>;
    created_at: Date;
    patient?: {
        uhid: string;
        first_name: string;
        last_name: string;
        phone: string;
    } | null;
}

export interface MarginReportResponse {
    today_margin: number;
    monthly_margin: number;
    today_medicines_count: number;
    medicine_wise_profit: Array<{
        medicine_id: string;
        medicine_name: string;
        quantity_sold: number;
        total_profit: number;
    }>;
    top_medicines: Array<{
        medicine_id: string;
        medicine_name: string;
        total_profit: number;
    }>;
}

export const createReturnSchema = z.object({
    bill_id: z.string().min(1),
    patient_id: z.string().min(1),
    refund_method: z.string().min(1),
    items: z.array(z.object({
        medicine_id: z.string().min(1),
        batch_number: z.string().optional(),
        return_qty: z.number().int().positive(),
        selling_price: z.number().positive(),
        reason: z.string().min(1),
    })).min(1),
    pharmacist_id: z.string().optional(),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;

export interface PharmacyReturnResponse {
    id: string;
    bill_id: string;
    patient_id: string;
    return_date: Date;
    refund_amount: number;
    refund_method: string;
    pharmacist_id: string | null;
    status: string;
    items: Array<{
        id: string;
        medicine_id: string;
        medicine_name?: string;
        batch_number: string | null;
        return_qty: number;
        selling_price: number;
        reason: string;
    }>;
}

export const createStockReturnSchema = z.object({
    distributor: z.string().min(1),
    return_type: z.string().min(1),
    items: z.array(z.object({
        medicine_id: z.string().min(1),
        batch_number: z.string().optional(),
        return_qty: z.number().int().positive(),
        return_reason: z.string().min(1),
        unit_price: z.number().nonnegative(),
    })).min(1),
    pharmacist_id: z.string().optional(),
});

export type CreateStockReturnInput = z.infer<typeof createStockReturnSchema>;

export interface PharmacyStockReturnResponse {
    id: string;
    distributor: string;
    return_date: Date;
    total_amount: number;
    return_type: string;
    pharmacist_id: string | null;
    status: string;
    items: Array<{
        id: string;
        medicine_id: string;
        medicine_name?: string;
        batch_number: string | null;
        return_qty: number;
        return_reason: string;
        unit_price: number;
    }>;
}

export interface PharmacyPurchaseResponse {
    id: string;
    distributor_name: string;
    invoice_number: string;
    purchase_date: Date;
    total_amount: number;
    amount_paid: number;
    balance_amount: number;
    payment_status: string;
    payment_date: Date | null;
    payment_method: string | null;
    file_url: string | null;
    created_at: Date;
    updated_at: Date;
    batches?: Array<{
        id: string;
        batch_number: string;
        medicine_name: string;
        stock_quantity: number;
        pack_quantity: number;
    }>;
}

export const updatePurchaseSchema = z.object({
    distributor_name: z.string().min(1).optional(),
    invoice_number: z.string().min(1).optional(),
    purchase_date: z.string().transform((s) => new Date(s)).optional(),
});

export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;

export const purchaseQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    distributor: z.string().optional(),
    status: z.string().optional(),
});

export const createCategorySchema = z.object({
    name: z.string().min(1, 'Category name is required'),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export interface CategoryResponse {
    id: number;
    name: string;
    created_at: Date;
}
