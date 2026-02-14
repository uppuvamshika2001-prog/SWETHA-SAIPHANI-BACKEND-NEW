import { prisma } from '../../config/database.js';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler.js';
import {
    CreateMedicineInput,
    UpdateMedicineInput,
    MedicineQueryInput,
    CreateBillInput,
    UpdateBillInput,
    MedicineResponse,
    BillResponse
} from './pharmacy.types.js';
import { PaginatedResponse } from '../users/users.types.js';
import { Decimal } from '@prisma/client/runtime/library';

export class PharmacyService {
    // Medicine CRUD
    async createMedicine(input: CreateMedicineInput): Promise<MedicineResponse> {
        const medicine = await prisma.medicine.create({
            data: {
                ...input,
                pricePerUnit: input.pricePerUnit,
            },
        });
        return this.formatMedicine(medicine);
    }

    async getMedicine(id: string): Promise<MedicineResponse> {
        const medicine = await prisma.medicine.findUnique({ where: { id } });
        if (!medicine) {
            throw new NotFoundError('Medicine');
        }
        return this.formatMedicine(medicine);
    }

    async getMedicines(query: MedicineQueryInput): Promise<PaginatedResponse<MedicineResponse>> {
        const { page, limit, search, category, lowStock } = query;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = { isActive: true };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { genericName: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (category) where.category = category;
        if (lowStock) {
            where.stockQuantity = { lte: prisma.medicine.fields.reorderLevel };
        }

        const [medicines, total] = await Promise.all([
            prisma.medicine.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: 'asc' },
            }),
            prisma.medicine.count({ where }),
        ]);

        return {
            items: medicines.map((m) => this.formatMedicine(m)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async updateMedicine(id: string, input: UpdateMedicineInput): Promise<MedicineResponse> {
        const existing = await prisma.medicine.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundError('Medicine');
        }

        const medicine = await prisma.medicine.update({
            where: { id },
            data: input,
        });
        return this.formatMedicine(medicine);
    }

    async deleteMedicine(id: string): Promise<void> {
        console.log('[PharmacyService] Attempting to delete medicine with id:', id);
        // Using findFirst instead of findUnique for resilience
        const medicine = await prisma.medicine.findFirst({ where: { id } });
        if (!medicine) {
            console.error('[PharmacyService] Delete medicine failed - Medicine not found for id:', id);
            throw new NotFoundError('Medicine');
        }
        await prisma.medicine.delete({ where: { id } });
        console.log('[PharmacyService] Medicine deleted successfully:', id);
    }

    // Billing
    async createBill(input: CreateBillInput): Promise<BillResponse> {
        // Validate patient
        const patient = await prisma.patient.findUnique({ where: { uhid: input.patientId } });
        if (!patient) {
            throw new NotFoundError('Patient');
        }

        // Validate stock for medicine items
        for (const item of input.items) {
            if (item.medicineId) {
                const medicine = await prisma.medicine.findUnique({ where: { id: item.medicineId } });
                if (!medicine) {
                    throw new NotFoundError(`Medicine not found: ${item.medicineId}`);
                }
                if (medicine.stockQuantity < item.quantity) {
                    throw new ValidationError(`Insufficient stock for ${medicine.name}`);
                }
            }
        }

        // Calculate totals
        const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        const discountedSubtotal = subtotal - input.discount;
        const gstAmount = (discountedSubtotal * input.gstPercent) / 100;
        const grandTotal = discountedSubtotal + gstAmount;

        // Generate bill number
        const billNumber = `BILL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        // Create bill with transaction
        const bill = await prisma.$transaction(async (tx) => {
            // Create bill
            const newBill = await tx.bill.create({
                data: {
                    patientId: input.patientId,
                    billNumber,
                    subtotal,
                    discount: input.discount,
                    gstPercent: input.gstPercent,
                    gstAmount,
                    grandTotal,
                    notes: input.notes,
                    items: {
                        create: input.items.map((item) => ({
                            medicineId: item.medicineId,
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            total: item.quantity * item.unitPrice,
                        })),
                    },
                },
                include: { items: true },
            });

            // Decrement stock for medicine items
            for (const item of input.items) {
                if (item.medicineId) {
                    await tx.medicine.update({
                        where: { id: item.medicineId },
                        data: { stockQuantity: { decrement: item.quantity } },
                    });
                }
            }

            return newBill;
        });

        return this.formatBill(bill);
    }

    async getBills(query: MedicineQueryInput): Promise<PaginatedResponse<BillResponse>> {
        const { page, limit, search } = query;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {};
        if (search) {
            where.OR = [
                { billNumber: { contains: search, mode: 'insensitive' } },
                { patient: { firstName: { contains: search, mode: 'insensitive' } } },
                { patient: { lastName: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [bills, total] = await Promise.all([
            prisma.bill.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { items: true },
            }),
            prisma.bill.count({ where }),
        ]);

        return {
            items: bills.map((b) => this.formatBill(b)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getBill(id: string): Promise<BillResponse> {
        const bill = await prisma.bill.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!bill) {
            throw new NotFoundError('Bill');
        }
        return this.formatBill(bill);
    }

    async updateBill(id: string, input: UpdateBillInput): Promise<BillResponse> {
        const existing = await prisma.bill.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundError('Bill');
        }

        const bill = await prisma.bill.update({
            where: { id },
            data: input,
            include: { items: true },
        });
        return this.formatBill(bill);
    }

    async deleteBill(id: string): Promise<void> {
        console.log('[PharmacyService] Attempting to delete bill with id:', id);
        // Using findFirst instead of findUnique for resilience
        const bill = await prisma.bill.findFirst({ where: { id } });
        if (!bill) {
            console.error('[PharmacyService] Delete bill failed - Bill not found for id:', id);
            throw new NotFoundError('Bill');
        }

        // Deleting the bill will cascade to BillItem
        // Note: Pharmacy bills also decrement stock on creation, but we usually don't restore stock on delete unless specified.
        await prisma.bill.delete({ where: { id } });
        console.log('[PharmacyService] Bill deleted successfully:', id);
    }

    async getLowStockMedicines() {
        return prisma.$queryRaw`
      SELECT * FROM medicines 
      WHERE stock_quantity <= reorder_level 
      AND is_active = true
      ORDER BY stock_quantity ASC
    `;
    }

    private formatMedicine(medicine: {
        id: string;
        name: string;
        genericName: string | null;
        manufacturer: string | null;
        category: string | null;
        unit: string;
        pricePerUnit: Decimal;
        stockQuantity: number;
        reorderLevel: number;
        expiryDate: Date | null;
        isActive: boolean;
    }): any { // Relaxing return type to match frontend expectations
        let status = 'in_stock';
        if (medicine.expiryDate && new Date(medicine.expiryDate) < new Date()) {
            status = 'expired';
        } else if (medicine.stockQuantity <= 0) {
            status = 'out_of_stock';
        } else if (medicine.stockQuantity <= medicine.reorderLevel) {
            status = 'low_stock';
        }

        return {
            id: medicine.id,
            name: medicine.name,
            generic_name: medicine.genericName,
            manufacturer: medicine.manufacturer,
            category: medicine.category,
            unit: medicine.unit,
            unit_price: Number(medicine.pricePerUnit),
            stock_quantity: medicine.stockQuantity,
            min_stock_level: medicine.reorderLevel,
            expiry_date: medicine.expiryDate,
            status,
            active: medicine.isActive,
        };
    }

    private formatBill(bill: {
        id: string;
        patientId: string;
        billNumber: string;
        subtotal: Decimal;
        discount: Decimal;
        gstPercent: Decimal;
        gstAmount: Decimal;
        grandTotal: Decimal;
        status: string;
        paidAmount: Decimal;
        items: Array<{
            id: string;
            description: string;
            quantity: number;
            unitPrice: Decimal;
            total: Decimal;
        }>;
        createdAt: Date;
    }): BillResponse {
        return {
            id: bill.id,
            patientId: bill.patientId,
            billNumber: bill.billNumber,
            subtotal: Number(bill.subtotal),
            discount: Number(bill.discount),
            gstPercent: Number(bill.gstPercent),
            gstAmount: Number(bill.gstAmount),
            grandTotal: Number(bill.grandTotal),
            status: bill.status as BillResponse['status'],
            paidAmount: Number(bill.paidAmount),
            items: bill.items.map((item) => ({
                id: item.id,
                description: item.description,
                quantity: item.quantity,
                unitPrice: Number(item.unitPrice),
                total: Number(item.total),
            })),
            createdAt: bill.createdAt,
        };
    }
}

export const pharmacyService = new PharmacyService();
