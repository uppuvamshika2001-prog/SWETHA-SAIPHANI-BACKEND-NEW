import { z } from 'zod';
import { BillStatus } from '@prisma/client';

export const createMedicineSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    genericName: z.string().optional(),
    manufacturer: z.string().optional(),
    category: z.string().optional(),
    unit: z.string().default('tablet'),
    pricePerUnit: z.number().positive(),
    stockQuantity: z.number().int().nonnegative().default(0),
    reorderLevel: z.number().int().nonnegative().default(10),
    expiryDate: z.string().transform((s) => new Date(s)).optional(),
});

export const updateMedicineSchema = z.object({
    name: z.string().min(1).optional(),
    genericName: z.string().optional(),
    manufacturer: z.string().optional(),
    category: z.string().optional(),
    unit: z.string().optional(),
    pricePerUnit: z.number().positive().optional(),
    stockQuantity: z.number().int().nonnegative().optional(),
    reorderLevel: z.number().int().nonnegative().optional(),
    expiryDate: z.string().transform((s) => new Date(s)).optional(),
    isActive: z.boolean().optional(),
});

export const medicineQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().optional(),
    category: z.string().optional(),
    lowStock: z.coerce.boolean().optional(),
});

export const createBillSchema = z.object({
    patientId: z.string().min(1),
    items: z.array(z.object({
        medicineId: z.string().optional(),
        description: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
    })).min(1, 'At least one item is required'),
    discount: z.number().nonnegative().default(0),
    gstPercent: z.number().nonnegative().default(18),
    notes: z.string().optional(),
});

export const updateBillSchema = z.object({
    status: z.nativeEnum(BillStatus).optional(),
    paidAmount: z.number().nonnegative().optional(),
    notes: z.string().optional(),
});

export type CreateMedicineInput = z.infer<typeof createMedicineSchema>;
export type UpdateMedicineInput = z.infer<typeof updateMedicineSchema>;
export type MedicineQueryInput = z.infer<typeof medicineQuerySchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;

export interface MedicineResponse {
    id: string;
    name: string;
    genericName: string | null;
    manufacturer: string | null;
    category: string | null;
    unit: string;
    pricePerUnit: number;
    stockQuantity: number;
    reorderLevel: number;
    expiryDate: Date | null;
    isActive: boolean;
}

export interface BillResponse {
    id: string;
    patientId: string;
    billNumber: string;
    subtotal: number;
    discount: number;
    gstPercent: number;
    gstAmount: number;
    grandTotal: number;
    status: BillStatus;
    paidAmount: number;
    items: Array<{
        id: string;
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
    }>;
    createdAt: Date;
}
