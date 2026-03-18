import { z } from 'zod';
import { BillStatus } from '@prisma/client';

export const createMedicineSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    genericName: z.string().optional(),
    manufacturer: z.string().optional(),
    category: z.string().optional(),
    unit: z.string().default('tablet'),
    reorderLevel: z.number().int().nonnegative().default(10),
    // Batch information for initial stock entry
    batchNumber: z.string().min(1, 'Batch number is required'),
    distributorName: z.string().min(1, 'Distributor name is required'),
    manufacturingDate: z.string().transform((s) => new Date(s)).optional(),
    expiryDate: z.string().transform((s) => new Date(s)),
    purchasePrice: z.number().nonnegative(),
    salePrice: z.number().nonnegative(),
    mrp: z.number().nonnegative().optional(),
    gst: z.number().nonnegative().default(0),
    stockQuantity: z.number().int().positive(),
    // Purchase payment tracking (Now handled separately, but kept as optional for backward compatibility during migration)
    invoiceNumber: z.string().optional(),
});

export const recordPaymentSchema = z.object({
    purchaseId: z.string(),
    amount: z.number().positive(),
    paymentDate: z.string().transform((s) => new Date(s)).optional(),
    paymentMethod: z.string(),
    notes: z.string().optional(),
});

export const updateMedicineSchema = z.object({
    name: z.string().min(1).optional(),
    genericName: z.string().optional(),
    manufacturer: z.string().optional(),
    category: z.string().optional(),
    unit: z.string().optional(),
    reorderLevel: z.number().int().nonnegative().optional(),
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
        discount: z.number().nonnegative().default(0),
        gst: z.number().nonnegative().default(0),
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
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export interface MedicineResponse {
    id: string;
    name: string;
    genericName: string | null;
    manufacturer: string | null;
    category: string | null;
    unit: string;
    stockQuantity: number;
    reorderLevel: number;
    isActive: boolean;
    batches: Array<{
        id: string;
        batchNumber: string;
        distributorName: string;
        manufacturingDate: Date | null;
        expiryDate: Date;
        purchasePrice: number;
        salePrice: number;
        mrp: number | null;
        gst: number;
        stockQuantity: number;
        isActive: boolean;
    }>;
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
        purchasePrice: number;
        profit: number;
        total: number;
    }>;
    createdAt: Date;
}

export interface MarginReportResponse {
    todayMargin: number;
    monthlyMargin: number;
    todayMedicinesCount: number;
    medicineWiseProfit: Array<{
        medicineId: string;
        medicineName: string;
        quantitySold: number;
        totalProfit: number;
    }>;
    topMedicines: Array<{
        medicineId: string;
        medicineName: string;
        totalProfit: number;
    }>;
}
export const createReturnSchema = z.object({
    billId: z.string().min(1),
    patientId: z.string().min(1),
    refundMethod: z.string().min(1),
    items: z.array(z.object({
        medicineId: z.string().min(1),
        batchNumber: z.string().optional(),
        returnQty: z.number().int().positive(),
        salePrice: z.number().positive(),
        reason: z.string().min(1),
    })).min(1),
    pharmacistId: z.string().optional(),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;

export interface PharmacyReturnResponse {
    id: string;
    billId: string;
    patientId: string;
    returnDate: Date;
    refundAmount: number;
    refundMethod: string;
    pharmacistId: string | null;
    status: string;
    items: Array<{
        id: string;
        medicineId: string;
        medicineName?: string;
        batchNumber: string | null;
        returnQty: number;
        salePrice: number;
        reason: string;
    }>;
}
export const createStockReturnSchema = z.object({
    distributor: z.string().min(1),
    returnType: z.string().min(1),
    items: z.array(z.object({
        medicineId: z.string().min(1),
        batchNumber: z.string().optional(),
        returnQty: z.number().int().positive(),
        returnReason: z.string().min(1),
        unitPrice: z.number().nonnegative(),
    })).min(1),
    pharmacistId: z.string().optional(),
});

export type CreateStockReturnInput = z.infer<typeof createStockReturnSchema>;

export interface PharmacyStockReturnResponse {
    id: string;
    distributor: string;
    returnDate: Date;
    totalAmount: number;
    returnType: string;
    pharmacistId: string | null;
    status: string;
    items: Array<{
        id: string;
        medicineId: string;
        medicineName?: string;
        batchNumber: string | null;
        returnQty: number;
        returnReason: string;
        unitPrice: number;
    }>;
}

export interface PharmacyPurchaseResponse {
    id: string;
    distributorName: string;
    invoiceNumber: string;
    purchaseDate: Date;
    totalAmount: number;
    amountPaid: number;
    balanceAmount: number;
    paymentStatus: string;
    paymentDate: Date | null;
    paymentMethod: string | null;
    createdAt: Date;
    updatedAt: Date;
    batches?: Array<{
        id: string;
        batchNumber: string;
        medicineName: string;
        stockQuantity: number;
    }>;
}

export const purchaseQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    distributor: z.string().optional(),
    status: z.string().optional(),
});
