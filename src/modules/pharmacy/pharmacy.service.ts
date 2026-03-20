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
    purchaseQuerySchema,
    CreatePurchaseInput
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

            // 2. Handle Pharmacy Purchase (Aggregated by Invoice)
            let purchaseId = null;
            if (input.invoiceNumber) {
                const totalItemAmount = input.stockQuantity * input.purchasePrice;
                
                // Find existing purchase for this distributor + invoice
                let purchase = await (tx as any).pharmacyPurchase.findUnique({
                    where: {
                        distributorName_invoiceNumber: {
                            distributorName: input.distributorName,
                            invoiceNumber: input.invoiceNumber
                        }
                    }
                });

                if (purchase) {
                    // Update existing purchase total
                    purchase = await (tx as any).pharmacyPurchase.update({
                        where: { id: purchase.id },
                        data: {
                            totalAmount: { increment: new Decimal(totalItemAmount) },
                            balanceAmount: { increment: new Decimal(totalItemAmount) }
                        }
                    });
                } else {
                    // Create new purchase
                    purchase = await (tx as any).pharmacyPurchase.create({
                        data: {
                            distributorName: input.distributorName,
                            invoiceNumber: input.invoiceNumber,
                            totalAmount: new Decimal(totalItemAmount),
                            amountPaid: new Decimal(0),
                            balanceAmount: new Decimal(totalItemAmount),
                            paymentStatus: 'PENDING'
                        }
                    });
                }
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

    async getMedicines(query: MedicineQueryInput): Promise<PaginatedResponse<any>> {
        const { page = 1, limit = 10, search, category, lowStock, format } = query;
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

        let formattedItems = medicines.map((m: any) => this.formatMedicine(m));

        if (format === 'returns') {
            const flatItems: any[] = [];
            medicines.forEach((m: any) => {
                if (m.batches && m.batches.length > 0) {
                    m.batches.forEach((b: any) => {
                        if (b.isActive && b.stockQuantity > 0) {
                            flatItems.push({
                                id: m.id,
                                name: m.name,
                                batch: b.batchNumber, // Prompt requested `batch`
                                batchNumber: b.batchNumber, // Keep consistent with UI expected `batchNumber` if any
                                stock: b.stockQuantity,
                                distributor: b.distributorName,
                                expiry: b.expiryDate,
                                purchasePrice: b.purchasePrice
                            });
                        }
                    });
                }
            });
            formattedItems = flatItems;
        }

        return {
            items: formattedItems,
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
        const { page = 1, limit = 10, search, format } = query;
        const skip = (page - 1) * limit;

        const where: Record<string, any> = {};
        if (search) {
            where.OR = [
                { billNumber: { contains: search, mode: 'insensitive' } },
                { patient: { firstName: { contains: search, mode: 'insensitive' } } },
                { patient: { lastName: { contains: search, mode: 'insensitive' } } },
            ];
        }

        if (format === 'returns') {
            where.status = 'PAID';
        }

        const includeItems = format === 'returns' 
            ? { where: { medicineId: { not: null } } }
            : true;

        const [bills, total] = await Promise.all([
            prisma.bill.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { items: includeItems },
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

    async getMarginReport(query: { startDate?: string; endDate?: string }): Promise<any> {
        let start: Date;
        let end: Date;

        if (query.startDate) {
            start = new Date(query.startDate);
            start.setHours(0, 0, 0, 0);
        } else {
            start = new Date();
            start.setHours(0, 0, 0, 0);
        }

        if (query.endDate) {
            end = new Date(query.endDate);
            end.setHours(23, 59, 59, 999);
        } else {
            end = new Date(start);
            end.setHours(23, 59, 59, 999);
        }
        
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        // Helper to fetch valid SALES (bill items) for a range
        const getProfitData = async (fromDate: Date, toDate: Date) => {
            return await (prisma as any).billItem.findMany({
                where: {
                    bill: {
                        status: 'PAID',
                        createdAt: {
                            gte: fromDate,
                            lte: toDate
                        }
                    },
                    medicineId: { not: null }
                },
                include: {
                    medicine: {
                        include: {
                            batches: {
                                orderBy: { createdAt: 'desc' },
                                take: 1
                            }
                        }
                    }
                }
            });
        };

        const [rangeItems, todayItems, monthItems] = await Promise.all([
            getProfitData(start, end),
            getProfitData(todayStart, todayEnd),
            getProfitData(firstDayOfMonth, lastDayOfMonth)
        ]);

        const calculateProfit = (items: any[]) => {
            let total = 0;
            items.forEach(item => {
                const sellingPrice = Number(item.unitPrice) || 0;
                let purchasePrice = Number(item.purchasePrice) || 0;

                // Fallbacks requested strictly by user prompt
                if (purchasePrice === 0 && item.medicine) {
                    if (item.medicine.batches && item.medicine.batches.length > 0) {
                        purchasePrice = Number(item.medicine.batches[0].purchasePrice) || 0;
                    } 
                    if (purchasePrice === 0) {
                        purchasePrice = Number(item.medicine.pricePerUnit) || 0;
                    }
                }

                const quantity = Number(item.quantity) || 0;
                total += (sellingPrice - purchasePrice) * quantity;
            });
            return total;
        };

        const todayProfit = calculateProfit(todayItems);
        const monthlyProfit = calculateProfit(monthItems);

        let totalProfit = 0;
        const medMap = new Map<string, { name: string, quantity: number, profit: number }>();

        rangeItems.forEach((item: any) => {
            const sellingPrice = Number(item.unitPrice) || 0;
            let purchasePrice = Number(item.purchasePrice) || 0;

            if (purchasePrice === 0 && item.medicine) {
                if (item.medicine.batches && item.medicine.batches.length > 0) {
                    purchasePrice = Number(item.medicine.batches[0].purchasePrice) || 0;
                } 
                if (purchasePrice === 0) {
                    purchasePrice = Number(item.medicine.pricePerUnit) || 0;
                }
            }

            const quantity = Number(item.quantity) || 0;
            const profit = (sellingPrice - purchasePrice) * quantity;
            totalProfit += profit;

            const name = item.medicine?.name || item.description || 'Unknown';
            if (!medMap.has(name)) {
                medMap.set(name, { name, quantity: 0, profit: 0 });
            }
            const med = medMap.get(name)!;
            med.quantity += quantity;
            med.profit += profit;
        });

        const medicineWiseProfit = Array.from(medMap.values());
        
        // Sort primarily by highest profit using standard array sort
        medicineWiseProfit.sort((a, b) => b.profit - a.profit);

        const topMedicines = medicineWiseProfit.slice(0, 10).map(m => ({
            name: m.name,
            profit: m.profit
        }));

        // Debug logging precisely as requested
        console.log(`[MARGIN REPORT DEBUG] startDate: ${start.toISOString()}, endDate: ${end.toISOString()}`);
        console.log(`[MARGIN REPORT DEBUG] Fetched Records from BillItems: ${rangeItems.length}`);
        console.log(`[MARGIN REPORT DEBUG] Calculated Total Profit for range: ${totalProfit}`);

        return {
            totalProfit,
            todayProfit,
            monthlyProfit,
            topMedicines,
            medicineWiseProfit
        };
    }
    
    async recordPayment(input: any): Promise<any> {
        const { purchaseId, amount, paymentMethod, paymentDate, notes } = input;
        
        return await prisma.$transaction(async (tx) => {
            const purchase = await (tx as any).pharmacyPurchase.findUnique({
                where: { id: purchaseId }
            });

            if (!purchase) throw new NotFoundError('Purchase not found');

            // SYNC CHECK: Calculate current balance from actual payments
            const paymentHistory = await (tx as any).pharmacyPayment.aggregate({
                where: { purchaseId },
                _sum: { amount: true }
            });
            const totalPaidSoFar = Number(paymentHistory._sum.amount) || 0;
            const currentBalance = Number(purchase.totalAmount) - totalPaidSoFar;

            if (amount > currentBalance) {
                throw new ValidationError(`Paid amount (₹${amount}) cannot exceed current balance (₹${currentBalance.toFixed(2)})`);
            }

            // Record the payment
            const payment = await (tx as any).pharmacyPayment.create({
                data: {
                    purchaseId,
                    amount: new Decimal(amount),
                    paymentMethod,
                    paymentDate: paymentDate || new Date(),
                    notes
                }
            });

            // Update purchase record with synced values
            const newTotalPaid = totalPaidSoFar + amount;
            const newBalance = Number(purchase.totalAmount) - newTotalPaid;
            let status = 'PENDING';
            if (newBalance <= 0) status = 'PAID';
            else if (newTotalPaid > 0) status = 'PARTIALLY_PAID';

            await (tx as any).pharmacyPurchase.update({
                where: { id: purchaseId },
                data: {
                    amountPaid: new Decimal(newTotalPaid),
                    balanceAmount: new Decimal(newBalance),
                    paymentStatus: status
                }
            });

            return payment;
        });
    }

    /**
     * Helper to ensure a purchase record's totals match its payment history
     */
    async syncPurchaseTotals(purchaseId: string): Promise<void> {
        await prisma.$transaction(async (tx) => {
            const purchase = await (tx as any).pharmacyPurchase.findUnique({
                where: { id: purchaseId }
            });
            if (!purchase) return;

            const paymentHistory = await (tx as any).pharmacyPayment.aggregate({
                where: { purchaseId },
                _sum: { amount: true }
            });

            const totalAmount = Number(purchase.totalAmount);
            const amountPaid = Number(paymentHistory._sum.amount) || 0;
            const balanceAmount = totalAmount - amountPaid;
            
            let status = 'PENDING';
            if (balanceAmount <= 0) status = 'PAID';
            else if (amountPaid > 0) status = 'PARTIALLY_PAID';

            await (tx as any).pharmacyPurchase.update({
                where: { id: purchaseId },
                data: {
                    amountPaid: new Decimal(amountPaid),
                    balanceAmount: new Decimal(balanceAmount),
                    paymentStatus: status
                }
            });
        });
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
            medicineId?: string | null;
            batchNumber?: string | null;
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
                medicineId: item.medicineId || null,
                batchNumber: (item as any).batchNumber || null,
                total: Number(item.total),
            })),
            createdAt: bill.createdAt,
        };
    }

    async getPurchases(input: any): Promise<PaginatedResponse<PharmacyPurchaseResponse>> {
        try {
            const { page = 1, limit = 10, distributor, status } = input || {};
            const skip = (Number(page) - 1) * Number(limit);

            const where: any = {};
            if (distributor) where.distributorName = { contains: distributor, mode: 'insensitive' };
            if (status) where.paymentStatus = status;

            const [purchases, total] = await Promise.all([
                (prisma as any).pharmacyPurchase.findMany({
                    where,
                    skip,
                    take: Number(limit),
                    orderBy: { purchaseDate: 'desc' },
                    include: { 
                        batches: { include: { medicine: true } },
                        payments: true
                    }
                }),
                (prisma as any).pharmacyPurchase.count({ where })
            ]);

            return {
                items: (purchases || []).map((p: any) => {
                    const payments = p.payments || [];
                    const totalPaidFromPayments = payments.reduce((sum: number, pay: any) => sum + Number(pay.amount || 0), 0);
                    const amountPaid = totalPaidFromPayments;
                    const balanceAmount = Number(p.totalAmount || 0) - amountPaid;
                    
                    return this.formatPurchase({
                        ...p,
                        amountPaid,
                        balanceAmount,
                        paymentStatus: balanceAmount <= 0 ? 'PAID' : (amountPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING')
                    });
                }),
                total: total || 0,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil((total || 0) / Number(limit)),
            };
        } catch (error) {
            console.error('[PharmacyService] getPurchases failed:', error);
            return {
                items: [],
                total: 0,
                page: Number(input?.page || 1),
                limit: Number(input?.limit || 10),
                totalPages: 0,
            };
        }
    }

    async getDistributorReport(): Promise<any> {
        try {
            const pendingPurchases = await (prisma as any).pharmacyPurchase.findMany({
                where: { paymentStatus: { in: ['PENDING', 'PARTIALLY_PAID'] } },
                orderBy: { purchaseDate: 'asc' }
            });

            // Source of truth totals from aggregate across all records
            const [purchaseStats, paymentStats] = await Promise.all([
                (prisma as any).pharmacyPurchase.aggregate({
                    _sum: { totalAmount: true }
                }),
                (prisma as any).pharmacyPayment.aggregate({
                    _sum: { amount: true }
                })
            ]);

            const totalAmount = Number(purchaseStats?._sum?.totalAmount) || 0;
            const totalPaid = Number(paymentStats?._sum?.amount) || 0;
            const totalBalance = totalAmount - totalPaid;

            // Group pending by distributor
            const pendingByDistributor: Record<string, { count: number; totalBalance: number }> = {};
            (pendingPurchases || []).forEach((p: any) => {
                const name = p.distributorName || 'Unknown';
                if (!pendingByDistributor[name]) {
                    pendingByDistributor[name] = { count: 0, totalBalance: 0 };
                }
                pendingByDistributor[name].count += 1;
                pendingByDistributor[name].totalBalance += Number(p.balanceAmount) || 0;
            });

            return {
                pendingPurchases: (pendingPurchases || []).map((p: any) => {
                    const amountPaid = Number(p.amountPaid) || 0;
                    const totalAmt = Number(p.totalAmount) || 0;
                    const balanceAmount = totalAmt - amountPaid;
                    return this.formatPurchase({
                        ...p,
                        balanceAmount
                    });
                }),
                stats: {
                    totalAmount,
                    totalPaid,
                    totalBalance,
                    pendingCount: (pendingPurchases || []).length
                },
                pendingByDistributor
            };
        } catch (error) {
            console.error('[PharmacyService] getDistributorReport failed:', error);
            return {
                pendingPurchases: [],
                stats: {
                    totalAmount: 0,
                    totalPaid: 0,
                    totalBalance: 0,
                    pendingCount: 0
                },
                pendingByDistributor: {}
            };
        }
    }

    async createPurchase(input: CreatePurchaseInput): Promise<any> {
        return await prisma.$transaction(async (tx) => {
            // 1. Calculate total purchase amount
            let totalAmount = 0;
            for (const item of input.items) {
                totalAmount += item.stockQuantity * item.purchasePrice;
            }

            // 2. Create the Purchase tracking record
            const purchase = await (tx as any).pharmacyPurchase.create({
                data: {
                    distributorName: input.distributorName,
                    invoiceNumber: input.invoiceNumber,
                    purchaseDate: input.purchaseDate || new Date(),
                    totalAmount: new Decimal(totalAmount),
                    amountPaid: new Decimal(0),
                    balanceAmount: new Decimal(totalAmount),
                    paymentStatus: 'PENDING'
                }
            });

            // 3. Create Medicine Batches exactly as items
            for (const item of input.items) {
                // Ensure medicine exists
                const existingMedicine = await (tx as any).medicine.findUnique({
                    where: { id: item.medicineId }
                });
                if (!existingMedicine) {
                    throw new NotFoundError(`Medicine with ID ${item.medicineId} not found`);
                }

                await (tx as any).medicineBatch.create({
                    data: {
                        medicineId: item.medicineId,
                        purchaseId: purchase.id,
                        batchNumber: item.batchNumber,
                        distributorName: input.distributorName,
                        manufacturingDate: item.manufacturingDate,
                        expiryDate: item.expiryDate,
                        purchasePrice: new Decimal(item.purchasePrice),
                        salePrice: new Decimal(item.salePrice),
                        mrp: item.mrp ? new Decimal(item.mrp) : null,
                        gst: new Decimal(item.gst || 0),
                        stockQuantity: item.stockQuantity,
                        isActive: true
                    }
                });

                // 4. Update parent medicine total stock
                const updatedStock = existingMedicine.stockQuantity + item.stockQuantity;
                await (tx as any).medicine.update({
                    where: { id: existingMedicine.id },
                    data: { stockQuantity: updatedStock }
                });
            }

            return purchase;
        });
    }

    async getPurchasePayments(purchaseId: string): Promise<any[]> {
        try {
            const payments = await (prisma as any).pharmacyPayment.findMany({
                where: { purchaseId },
                orderBy: { paymentDate: 'desc' }
            });
            return (payments || []).map((p: any) => ({
                ...p,
                amount: Number(p.amount || 0)
            }));
        } catch (error) {
            console.error('[PharmacyService] getPurchasePayments failed:', error);
            return [];
        }
    }


    async getCategories() {
        return (prisma as any).pharmacyCategory.findMany({
            orderBy: { name: 'asc' }
        });
    }

    async createCategory(input: any) {
        const { name } = input;
        
        // Check for duplicate (case-insensitive)
        const existing = await (prisma as any).pharmacyCategory.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } }
        });

        if (existing) {
            throw new Error('Category already exists');
        }

        return (prisma as any).pharmacyCategory.create({
            data: { name }
        });
    }

    async deleteCategory(id: string) {
        return (prisma as any).pharmacyCategory.delete({
            where: { id }
        });
    }

    private formatPurchase(purchase: any): PharmacyPurchaseResponse {
        return {
            id: purchase.id,
            distributorName: purchase.distributorName || '',
            invoiceNumber: purchase.invoiceNumber || '',
            purchaseDate: purchase.purchaseDate,
            totalAmount: Number(purchase.totalAmount) || 0,
            amountPaid: Number(purchase.amountPaid) || 0,
            balanceAmount: Number(purchase.balanceAmount) || 0,
            paymentStatus: purchase.paymentStatus || 'PENDING',
            paymentDate: purchase.paymentDate || null,
            paymentMethod: purchase.paymentMethod || null,
            createdAt: purchase.createdAt,
            updatedAt: purchase.updatedAt,
            batches: (purchase.batches || []).map((b: any) => ({
                id: b.id,
                batchNumber: b.batchNumber,
                medicineName: b.medicine?.name || 'Unknown',
                stockQuantity: b.stockQuantity || 0
            }))
        };
    }
}

export const pharmacyService = new PharmacyService();
