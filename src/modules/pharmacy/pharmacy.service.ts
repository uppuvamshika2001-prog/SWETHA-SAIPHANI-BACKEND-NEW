import { prisma } from '../../config/database.js';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler.js';
import {
    CreateMedicineInput,
    UpdateMedicineInput,
    MedicineQueryInput,
    CreateBillInput,
    UpdateBillInput,
    MedicineResponse,
    BillResponse,
    CreateReturnInput,
    PharmacyReturnResponse,
    CreateStockReturnInput,
    PharmacyStockReturnResponse,
    MarginReportResponse,
    PharmacyPurchaseResponse,
    purchaseQuerySchema
} from './pharmacy.types.js';
import { PaginatedResponse } from '../users/users.types.js';
import { Decimal } from '@prisma/client/runtime/library';

export class PharmacyService {
    // Medicine CRUD
    async createMedicine(input: CreateMedicineInput): Promise<MedicineResponse> {
        return await prisma.$transaction(async (tx) => {
            // 1. Check if medicine master record exists
            let medicine = await tx.medicine.findFirst({
                where: { 
                    name: { equals: input.name, mode: 'insensitive' },
                    genericName: input.genericName ? { equals: input.genericName, mode: 'insensitive' } : null
                }
            });

            if (!medicine) {
                medicine = await tx.medicine.create({
                    data: {
                        name: input.name,
                        genericName: input.genericName,
                        category: input.category,
                        manufacturer: input.manufacturer,
                        unit: input.unit,
                        pricePerUnit: new Decimal(input.salePrice || 0),
                        reorderLevel: input.reorderLevel,
                    }
                });
            }

            // 2. Handle Pharmacy Purchase if invoice provided
            let purchaseId = null;
            if (input.invoiceNumber) {
                const totalAmount = input.stockQuantity * input.purchasePrice;
                const amountPaid = input.amountPaid || 0;
                const balanceAmount = totalAmount - amountPaid;
                
                let paymentStatus = 'PENDING';
                if (amountPaid >= totalAmount) paymentStatus = 'PAID';
                else if (amountPaid > 0) paymentStatus = 'PARTIALLY_PAID';

                const purchase = await (tx as any).pharmacyPurchase.create({
                    data: {
                        distributorName: input.distributorName,
                        invoiceNumber: input.invoiceNumber,
                        totalAmount: new Decimal(totalAmount),
                        amountPaid: new Decimal(amountPaid),
                        balanceAmount: new Decimal(balanceAmount),
                        paymentStatus,
                        paymentDate: input.paymentDate,
                        paymentMethod: input.paymentMethod,
                    }
                });
                purchaseId = purchase.id;
            }

            // 3. Create the new batch
            await (tx as any).medicineBatch.create({
                data: {
                    medicineId: medicine.id,
                    batchNumber: input.batchNumber,
                    distributorName: input.distributorName,
                    manufacturingDate: input.manufacturingDate,
                    expiryDate: input.expiryDate,
                    purchasePrice: input.purchasePrice,
                    salePrice: input.salePrice,
                    mrp: input.mrp,
                    gst: input.gst,
                    stockQuantity: input.stockQuantity,
                    purchaseId: purchaseId,
                }
            });

            // 3. Update aggregated medicine stock
            const totalStock = await (tx as any).medicineBatch.aggregate({
                where: { medicineId: medicine.id, isActive: true },
                _sum: { stockQuantity: true }
            });

            const updatedMedicine = await tx.medicine.update({
                where: { id: medicine.id },
                data: { stockQuantity: totalStock._sum.stockQuantity || 0 },
                include: { batches: { where: { isActive: true }, orderBy: { expiryDate: 'asc' } } } as any
            });

            return this.formatMedicine(updatedMedicine);
        });
    }

    async getMedicine(id: string): Promise<MedicineResponse> {
        const medicine = await prisma.medicine.findUnique({ 
            where: { id },
            include: { batches: { where: { isActive: true }, orderBy: { expiryDate: 'asc' } } } as any
        });
        if (!medicine) {
            throw new NotFoundError('Medicine');
        }
        return this.formatMedicine(medicine);
    }

    async getMedicines(query: MedicineQueryInput): Promise<PaginatedResponse<MedicineResponse>> {
        const { page, limit, search, category, lowStock } = query;
        const skip = (page - 1) * limit;

        const where: Record<string, any> = { isActive: true };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { genericName: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (category) where.category = category;
        if (lowStock) {
            // Simplified low stock check - in production might use fields comparison if supported or raw query
            where.stockQuantity = { lte: 10 }; 
        }

        const [medicines, total] = await Promise.all([
            prisma.medicine.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: 'asc' },
                include: { batches: { where: { isActive: true }, orderBy: { expiryDate: 'asc' } } } as any
            }),
            ((prisma as any).medicine).count({ where }),
        ]);

        return {
            items: medicines.map((m: any) => this.formatMedicine(m)),
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
            // Initialize totals
            let subtotal = 0;
            let totalDiscount = input.discount || 0; // Overall bill discount
            let totalGstAmount = 0;
            const billItemsData = [];

            for (const item of input.items) {
                const itemBase = item.quantity * item.unitPrice;
                const itemDiscount = itemBase * ((item.discount || 0) / 100);
                const itemTaxable = itemBase - itemDiscount;
                const itemGst = itemTaxable * ((item.gst || 0) / 100);
                const itemTotal = itemTaxable + itemGst;

                subtotal += itemBase;
                // Accumulate item-level discounts
                totalDiscount += itemDiscount;
                totalGstAmount += itemGst;

                let remainingQty = item.quantity;
                let totalPurchasePrice = 0;

                if (item.medicineId) {
                    const batches = await (tx as any).medicineBatch.findMany({
                        where: {
                            medicineId: item.medicineId,
                            stockQuantity: { gt: 0 },
                            expiryDate: { gt: new Date() },
                            isActive: true,
                        },
                        orderBy: { expiryDate: 'asc' },
                    });

                    for (const batch of batches) {
                        if (remainingQty <= 0) break;

                        const deductQty = Math.min(batch.stockQuantity, remainingQty);
                        await (tx as any).medicineBatch.update({
                            where: { id: batch.id },
                            data: { stockQuantity: { decrement: deductQty } },
                        });

                        totalPurchasePrice += (Number(batch.purchasePrice) * deductQty);
                        remainingQty -= deductQty;
                    }

                    if (remainingQty > 0) {
                        throw new ValidationError(`Insufficient non-expired stock for medicine: ${item.description}`);
                    }

                    await (tx as any).medicine.update({
                        where: { id: item.medicineId },
                        data: { stockQuantity: { decrement: item.quantity } },
                    });
                }

                const avgPurchasePrice = item.medicineId ? totalPurchasePrice / item.quantity : 0;
                const itemProfit = itemTaxable - (item.quantity * avgPurchasePrice);

                billItemsData.push({
                    medicineId: item.medicineId,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount || 0,
                    gst: item.gst || 0,
                    total: itemTotal,
                    purchasePrice: avgPurchasePrice,
                    profit: itemProfit,
                });
            }

            // Apply overall bill discount if any (this logic might need adjustment based on how overall discount interacts with item discounts)
            // For simplicity, assuming input.discount is an additional discount applied to the subtotal after item discounts.
            // If input.discount is meant to be the *total* discount, then totalDiscount should be input.discount.
            // Here, I'm interpreting input.discount as an additional discount on the total taxable amount.
            const finalSubtotalAfterItemDiscounts = subtotal - totalDiscount;
            const finalDiscountedSubtotal = finalSubtotalAfterItemDiscounts; 
            const finalGstAmount = totalGstAmount; 
            const grandTotal = finalDiscountedSubtotal + finalGstAmount;

            const newBill = await (tx as any).bill.create({
                data: {
                    patientId: input.patientId,
                    billNumber: `PH-${Date.now()}`, 
                    subtotal: subtotal, 
                    discount: totalDiscount, 
                    gstPercent: input.gstPercent, 
                    gstAmount: finalGstAmount,
                    grandTotal,
                    status: 'PAID', 
                    notes: input.notes,
                    items: {
                        create: billItemsData,
                    },
                },
                include: {
                    items: true,
                },
            });

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
        return await (prisma as any).medicineBatch.findMany({
            where: {
                isActive: true,
                stockQuantity: { lte: 10 }
            },
            include: { medicine: true }
        });
    }

    async getExpiryAlerts() {
        const now = new Date();
        const ninetyDays = new Date();
        ninetyDays.setDate(ninetyDays.getDate() + 90);

        const thirtyDays = new Date();
        thirtyDays.setDate(thirtyDays.getDate() + 30);

        const [expired, soon30, soon90] = await Promise.all([
            (prisma as any).medicineBatch.findMany({
                where: { expiryDate: { lt: now }, isActive: true, stockQuantity: { gt: 0 } },
                include: { medicine: true }
            }),
            (prisma as any).medicineBatch.findMany({
                where: { 
                    expiryDate: { gte: now, lte: thirtyDays }, 
                    isActive: true, 
                    stockQuantity: { gt: 0 } 
                },
                include: { medicine: true }
            }),
            (prisma as any).medicineBatch.findMany({
                where: { 
                    expiryDate: { gt: thirtyDays, lte: ninetyDays }, 
                    isActive: true, 
                    stockQuantity: { gt: 0 } 
                },
                include: { medicine: true }
            })
        ]);

        return { expired, soon30, soon90 };
    }

    // Returns
    async processReturn(input: CreateReturnInput): Promise<PharmacyReturnResponse> {
        return await prisma.$transaction(async (tx) => {
            // 1. Validate bill and items
            const bill = await tx.bill.findUnique({
                where: { id: input.billId },
                include: { items: true }
            });

            if (!bill) throw new NotFoundError('Bill');

            // 2. Calculate refund amount and validate return quantities
            let refundAmount = 0;
            for (const item of input.items) {
                const billItem = bill.items.find(bi => bi.medicineId === item.medicineId);
                if (!billItem) {
                    throw new ValidationError(`Medicine ${item.medicineId} not found in bill ${bill.billNumber}`);
                }
                if (item.returnQty > billItem.quantity) {
                    throw new ValidationError(`Return quantity for ${billItem.description} exceeds sold quantity`);
                }
                refundAmount += item.returnQty * item.salePrice;
            }

            // 1. Create return record
            const pharmacyReturn = await (tx as any).pharmacyReturn.create({
                data: {
                    billId: input.billId,
                    patientId: input.patientId,
                    refundAmount,
                    refundMethod: input.refundMethod,
                    pharmacistId: input.pharmacistId,
                    items: {
                        create: input.items.map(item => ({
                            medicineId: item.medicineId,
                            batchNumber: item.batchNumber,
                            returnQty: item.returnQty,
                            salePrice: item.salePrice,
                            reason: item.reason
                        }))
                    }
                },
                include: {
                    items: {
                        include: { medicine: true }
                    }
                }
            });

            // 4. Adjust stock (add back to latest batch or specific batch if provided)
            for (const item of input.items) {
                // Increment batch stock
                if (item.batchNumber) {
                    // Find batch to return to
                    const batch = await ((tx as any).medicineBatch).findFirst({
                        where: { 
                            medicineId: item.medicineId, 
                            batchNumber: item.batchNumber,
                            isActive: true,
                        },
                        orderBy: { expiryDate: 'asc' } // If no batch number, take oldest
                    });

                    if (!batch) {
                        throw new ValidationError(`Batch not found for medicine ID ${item.medicineId} and batch number ${item.batchNumber}`);
                    }

                    await ((tx as any).medicineBatch).update({
                        where: { id: batch.id },
                        data: { stockQuantity: { increment: item.returnQty } }
                    });
                } else {
                    // Find best batch using FIFO (First Expiry First Out) to add stock back to
                    const batch = await ((tx as any).medicineBatch).findFirst({
                        where: { medicineId: item.medicineId, isActive: true },
                        orderBy: { expiryDate: 'asc' }
                    });

                    if (batch) {
                        await ((tx as any).medicineBatch).update({
                            where: { id: batch.id },
                            data: { stockQuantity: { increment: item.returnQty } }
                        });
                    } else {
                        // If no active batch exists, this scenario might need specific handling,
                        // e.g., creating a new batch or logging an alert. For now, we'll just update master stock.
                        console.warn(`No active batch found for medicine ID ${item.medicineId} to return to. Only master stock will be updated.`);
                    }
                }
                
                // Ensure master stock is sync'd
                const totalBatchStock = await ((tx as any).medicineBatch).aggregate({
                    where: { medicineId: item.medicineId, isActive: true },
                    _sum: { stockQuantity: true }
                });

                await tx.medicine.update({
                    where: { id: item.medicineId },
                    data: { stockQuantity: totalBatchStock._sum.stockQuantity || 0 }
                });
            }

            return this.formatReturn(pharmacyReturn);
        });
    }

    async getReturns(query: any): Promise<PaginatedResponse<PharmacyReturnResponse>> {
        const { page = 1, limit = 10, search, startDate, endDate } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { bill: { billNumber: { contains: search, mode: 'insensitive' } } },
                { patient: { firstName: { contains: search, mode: 'insensitive' } } },
                { patient: { lastName: { contains: search, mode: 'insensitive' } } },
            ];
        }
        if (startDate) where.returnDate.gte = new Date(startDate);
        if (endDate) where.returnDate.lte = new Date(endDate);
        if (startDate || endDate) {
            where.returnDate = {};
            if (startDate) where.returnDate.gte = new Date(startDate);
            if (endDate) where.returnDate.lte = new Date(endDate);
        }

        const [returns, total] = await Promise.all([
            (prisma as any).pharmacyReturn.findMany({
                where,
                skip,
                take: limit,
                orderBy: { returnDate: 'desc' },
                include: {
                    items: { include: { medicine: true } },
                    patient: true,
                    bill: true
                } as any
            }),
            (prisma as any).pharmacyReturn.count({ where })
        ]);

        return {
            items: returns.map((r: any) => this.formatReturn(r)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }

    private formatReturn(pReturn: any): PharmacyReturnResponse {
        return {
            id: pReturn.id,
            billId: pReturn.billId,
            patientId: pReturn.patientId,
            returnDate: pReturn.returnDate,
            refundAmount: Number(pReturn.refundAmount),
            refundMethod: pReturn.refundMethod,
            pharmacistId: pReturn.pharmacistId,
            status: pReturn.status,
            items: pReturn.items.map((item: any) => ({
                id: item.id,
                medicineId: item.medicineId,
                medicineName: item.medicine?.name,
                batchNumber: item.batchNumber,
                returnQty: item.returnQty,
                salePrice: Number(item.salePrice),
                reason: item.reason
            }))
        };
    }

    // Stock Returns (To Distributors)
    async processStockReturn(input: CreateStockReturnInput): Promise<PharmacyStockReturnResponse> {
        const stockReturn = await prisma.$transaction(async (tx) => {
            // 1. Calculate total amount and validate stock
            let totalAmount = 0;
            for (const item of input.items) {
                if (item.batchNumber) {
                    // Find batch to return to distributor
                    const batch = await ((tx as any).medicineBatch).findFirst({
                        where: { 
                            medicineId: item.medicineId, 
                            batchNumber: item.batchNumber,
                            isActive: true,
                        }
                    });

                    if (!batch) {
                        throw new ValidationError(`Batch not found for medicine ID ${item.medicineId} and batch number ${item.batchNumber}`);
                    }

                    if (batch.stockQuantity < item.returnQty) {
                         throw new ValidationError(`Insufficient stock in batch ${item.batchNumber} for return`);
                    }

                    await ((tx as any).medicineBatch).update({
                        where: { id: batch.id },
                        data: { stockQuantity: { decrement: item.returnQty } }
                    });
                } else {
                    const medicine = await tx.medicine.findUnique({ where: { id: item.medicineId } });
                    if (!medicine) throw new NotFoundError('Medicine');
                    if (medicine.stockQuantity < item.returnQty) {
                        throw new ValidationError(`Insufficient total stock for ${medicine.name}`);
                    }
                }
                totalAmount += item.returnQty * item.unitPrice;
            }

            // Create return master record
            const newStockReturn = await (tx as any).pharmacyStockReturn.create({
                data: {
                    distributor: input.distributor,
                    totalAmount,
                    returnType: input.returnType,
                    pharmacistId: input.pharmacistId,
                    items: {
                        create: input.items.map(item => ({
                            medicineId: item.medicineId,
                            batchNumber: item.batchNumber,
                            returnQty: item.returnQty,
                            returnReason: item.returnReason,
                            unitPrice: item.unitPrice
                        }))
                    }
                },
                include: {
                    items: { include: { medicine: true } }
                }
            });

            // 3. Update master stock quantity
            for (const item of input.items) {
                const totalBatchStock = await ((tx as any).medicineBatch).aggregate({
                    where: { medicineId: item.medicineId, isActive: true },
                    _sum: { stockQuantity: true }
                });

                await tx.medicine.update({
                    where: { id: item.medicineId },
                    data: { stockQuantity: totalBatchStock._sum.stockQuantity || 0 }
                });
            }

            return newStockReturn;
        });

        return this.formatStockReturn(stockReturn);
    }

    async getStockReturns(query: any): Promise<PaginatedResponse<PharmacyStockReturnResponse>> {
        const { page = 1, limit = 10, search, distributor, startDate, endDate } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { items: { some: { medicine: { name: { contains: search, mode: 'insensitive' } } } } },
                { distributor: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (distributor) where.distributor = { contains: distributor, mode: 'insensitive' };
        if (startDate || endDate) {
            where.returnDate = {};
            if (startDate) where.returnDate.gte = new Date(startDate);
            if (endDate) where.returnDate.lte = new Date(endDate);
        }

        const [returns, total] = await Promise.all([
            (prisma as any).pharmacyStockReturn.findMany({
                where,
                skip,
                take: limit,
                orderBy: { returnDate: 'desc' },
                include: { items: { include: { medicine: true } } } as any
            }),
            (prisma as any).pharmacyStockReturn.count({ where })
        ]);

        return {
            items: returns.map((r: any) => this.formatStockReturn(r)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }

    async getMarginReport(query: { startDate?: string; endDate?: string }): Promise<MarginReportResponse> {
        const start = query.startDate ? new Date(query.startDate) : new Date(new Date().setHours(0, 0, 0, 0));
        const end = query.endDate ? new Date(query.endDate) : new Date();
        
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

        const [todayStats, monthStats, medicineProfits] = await Promise.all([
            // Today's summary
            (prisma as any).billItem.aggregate({
                where: {
                    bill: { createdAt: { gte: todayStart } },
                    medicineId: { not: null }
                },
                _sum: { profit: true, quantity: true }
            }),
            // Monthly summary
            (prisma as any).billItem.aggregate({
                where: {
                    bill: { createdAt: { gte: firstDayOfMonth } },
                    medicineId: { not: null }
                },
                _sum: { profit: true }
            }),
            // Medicine-wise profit (filtered)
            (prisma as any).billItem.groupBy({
                by: ['medicineId'],
                where: {
                    bill: { createdAt: { gte: start, lte: end } },
                    medicineId: { not: null }
                },
                _sum: { profit: true, quantity: true },
                orderBy: { _sum: { profit: 'desc' } }
            })
        ]);

        // Get medicine names for the table
        const medicineIds = medicineProfits.map((mp: any) => mp.medicineId as string);
        const medicines = await prisma.medicine.findMany({
            where: { id: { in: medicineIds } },
            select: { id: true, name: true }
        });
        const medicineMap = new Map(medicines.map(m => [m.id, m.name]));

        const medicineWiseProfit = medicineProfits.map((mp: any) => ({
            medicineId: mp.medicineId as string,
            medicineName: medicineMap.get(mp.medicineId as string) || 'Unknown',
            quantitySold: Number(mp._sum?.quantity) || 0,
            totalProfit: Number(mp._sum?.profit) || 0
        }));

        return {
            todayMargin: Number((todayStats as any)._sum?.profit) || 0,
            monthlyMargin: Number((monthStats as any)._sum?.profit) || 0,
            todayMedicinesCount: Number((todayStats as any)._sum?.quantity) || 0,
            medicineWiseProfit,
            topMedicines: medicineWiseProfit.slice(0, 10).map((m: any) => ({
                medicineId: m.medicineId,
                medicineName: m.medicineName,
                totalProfit: m.totalProfit
            }))
        };
    }

    private formatStockReturn(sReturn: any): PharmacyStockReturnResponse {
        return {
            id: sReturn.id,
            distributor: sReturn.distributor,
            returnDate: sReturn.returnDate,
            totalAmount: Number(sReturn.totalAmount),
            returnType: sReturn.returnType,
            pharmacistId: sReturn.pharmacistId,
            status: sReturn.status,
            items: sReturn.items.map((item: any) => ({
                id: item.id,
                medicineId: item.medicineId,
                medicineName: item.medicine?.name,
                batchNumber: item.batchNumber,
                returnQty: item.returnQty,
                returnReason: item.returnReason,
                unitPrice: Number(item.unitPrice)
            }))
        };
    }

    private calculateStatus(stockQuantity: number, reorderLevel: number, batches: any[]): string {
        const now = new Date();
        const activeBatches = batches?.filter(b => b.isActive && b.stockQuantity > 0) || [];
        
        if (activeBatches.some(b => new Date(b.expiryDate) < now)) {
            return 'expired';
        }
        if (stockQuantity <= 0) {
            return 'out_of_stock';
        }
        if (stockQuantity <= reorderLevel) {
            return 'low_stock';
        }
        return 'in_stock';
    }

    private formatMedicine(medicine: any): any {
        const batches = medicine.batches || [];
        const status = this.calculateStatus(medicine.stockQuantity, medicine.reorderLevel, batches);
        
        // Use the first active batch for general display price/expiry if needed, 
        // or just return aggregated info
        const displayBatch = batches[0];

        return {
            id: medicine.id,
            name: medicine.name,
            generic_name: medicine.genericName,
            manufacturer: medicine.manufacturer,
            category: medicine.category,
            unit: medicine.unit,
            stock_quantity: medicine.stockQuantity,
            min_stock_level: medicine.reorderLevel,
            expiry_date: displayBatch?.expiryDate || null,
            batch_number: displayBatch?.batchNumber || '-',
            distributor: displayBatch?.distributorName || '-',
            unit_price: displayBatch ? Number(displayBatch.salePrice) : 0,
            status,
            active: medicine.isActive,
            batches: batches.map((b: any) => ({
                id: b.id,
                batch_number: b.batchNumber,
                distributor: b.distributorName,
                manufacturing_date: b.manufacturingDate,
                expiry_date: b.expiryDate,
                purchase_price: Number(b.purchasePrice),
                sale_price: Number(b.salePrice),
                mrp: Number(b.mrp),
                gst: Number(b.gst),
                stock_quantity: b.stockQuantity,
            }))
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
            purchasePrice?: Decimal;
            profit?: Decimal;
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
                purchasePrice: Number((item as any).purchasePrice),
                profit: Number((item as any).profit),
                total: Number(item.total),
            })),
            createdAt: bill.createdAt,
        };
    }

    async getPurchases(input: any): Promise<PaginatedResponse<PharmacyPurchaseResponse>> {
        const { page = 1, limit = 10, distributor, status } = input;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (distributor) where.distributorName = { contains: distributor, mode: 'insensitive' };
        if (status) where.paymentStatus = status;

        const [purchases, total] = await Promise.all([
            (prisma as any).pharmacyPurchase.findMany({
                where,
                skip,
                take: limit,
                orderBy: { purchaseDate: 'desc' },
                include: { batches: { include: { medicine: true } } }
            }),
            (prisma as any).pharmacyPurchase.count({ where })
        ]);

        return {
            items: purchases.map((p: any) => this.formatPurchase(p)),
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit)),
        };
    }

    async getDistributorReport(): Promise<any> {
        const pendingPurchases = await (prisma as any).pharmacyPurchase.findMany({
            where: { paymentStatus: { in: ['PENDING', 'PARTIALLY_PAID'] } },
            orderBy: { purchaseDate: 'asc' }
        });

        const stats = await (prisma as any).pharmacyPurchase.aggregate({
            _sum: {
                totalAmount: true,
                amountPaid: true,
                balanceAmount: true
            }
        });

        return {
            pendingPurchases: pendingPurchases.map((p: any) => this.formatPurchase(p)),
            summary: {
                totalPurchaseAmount: Number(stats._sum.totalAmount) || 0,
                totalPaidAmount: Number(stats._sum.amountPaid) || 0,
                totalBalanceAmount: Number(stats._sum.balanceAmount) || 0,
                pendingInvoicesCount: pendingPurchases.length
            }
        };
    }

    private formatPurchase(purchase: any): PharmacyPurchaseResponse {
        return {
            id: purchase.id,
            distributorName: purchase.distributorName,
            invoiceNumber: purchase.invoiceNumber,
            purchaseDate: purchase.purchaseDate,
            totalAmount: Number(purchase.totalAmount),
            amountPaid: Number(purchase.amountPaid),
            balanceAmount: Number(purchase.balanceAmount),
            paymentStatus: purchase.paymentStatus,
            paymentDate: purchase.paymentDate,
            paymentMethod: purchase.paymentMethod,
            createdAt: purchase.createdAt,
            updatedAt: purchase.updatedAt,
            batches: purchase.batches?.map((b: any) => ({
                id: b.id,
                batchNumber: b.batchNumber,
                medicineName: b.medicine?.name || 'Unknown',
                stockQuantity: b.stockQuantity
            }))
        };
    }
}

export const pharmacyService = new PharmacyService();
