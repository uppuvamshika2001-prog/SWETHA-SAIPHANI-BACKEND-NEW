import { z } from 'zod';
import { BillStatus } from '@prisma/client';

export const billItemSchema = z.object({
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().int().positive('Quantity must be positive'),
    unitPrice: z.number().nonnegative('Unit price must be non-negative'),
    medicineId: z.string().optional(),
    type: z.enum(['consultation', 'lab', 'other', 'CUSTOM']).optional(),
    lab_order_id: z.string().optional(),
    discount: z.number().nonnegative().optional(),
});

export const createBillSchema = z.object({
    patientId: z.string().optional(),
    items: z.array(billItemSchema).min(1, 'At least one item is required'),
    discount: z.number().nonnegative().default(0),
    gstPercent: z.number().nonnegative().default(18),
    notes: z.string().optional(),
    status: z.nativeEnum(BillStatus).default(BillStatus.PENDING),
    labOrderIds: z.array(z.string()).optional(),
    isWalkInLab: z.boolean().optional().default(false),
    billType: z.enum(['PHARMACY', 'CONSULTATION', 'LAB']).optional(),
    visitType: z.enum(['OP', 'WALK_IN']).optional().default('OP'),
});

export const updateBillStatusSchema = z.object({
    status: z.nativeEnum(BillStatus),
    paidAmount: z.number().nonnegative().optional(),
    paymentMode: z.string().optional(),
    referenceNo: z.string().optional(),
});

export const billQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    patientId: z.string().optional(),
    status: z.nativeEnum(BillStatus).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    search: z.string().optional(),
    billType: z.union([z.string(), z.array(z.string())]).optional(),
});

export type CreateBillInput = z.infer<typeof createBillSchema> & {
    creatorId?: string;
};
export type UpdateBillStatusInput = z.infer<typeof updateBillStatusSchema>;
export type BillQueryInput = z.infer<typeof billQuerySchema>;
