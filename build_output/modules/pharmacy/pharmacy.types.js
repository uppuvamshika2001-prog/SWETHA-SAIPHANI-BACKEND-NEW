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
    hsnCode: z.string().optional(),
    overalldiscount: z.number().nonnegative().optional(),
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
export const updatePurchaseSchema = z.object({
    distributor_name: z.string().min(1).optional(),
    invoice_number: z.string().min(1).optional(),
    purchase_date: z.string().transform((s) => new Date(s)).optional(),
});
export const purchaseQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    distributor: z.string().optional(),
    status: z.string().optional(),
});
export const createCategorySchema = z.object({
    name: z.string().min(1, 'Category name is required'),
});
//# sourceMappingURL=pharmacy.types.js.map