import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler.js';
import {
    CreateMedicineInput,
    UpdateMedicineInput,
    MedicineQueryInput,
    CreateBillInput,
    CreateBillItem,
    UpdateBillInput,
    MedicineResponse,
    BillResponse,
    UpdateBatchInput,
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
                medicine = await (tx as any).medicine.create({
                    data: {
                        name: input.name,
                        genericName: input.genericName,
                        categoryId: input.categoryId,
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
                    medicineId: medicine!.id,
                    batchNumber: input.batchNumber,
                    distributorName: input.distributorName,
                    manufacturingDate: input.manufacturingDate,
                    expiryDate: input.expiryDate,
                    purchasePrice: input.purchasePrice,
                    salePrice: input.salePrice,
                    mrp: input.mrp,
                    gst: input.gst,
                    stockQuantity: input.stockQuantity,
                    freeQuantity: input.freeQuantity || 0,
                    ptr: input.ptr || 0,
                    rate: input.rate || 0,
                    taxableAmount: input.taxableAmount || 0,
                    gstAmount: input.gstAmount || 0,
                    totalAmount: input.totalAmount || 0,
                    purchaseId: purchaseId,
                }
            });

            // 3. Update aggregated medicine stock
            const totalStock = await (tx as any).medicineBatch.aggregate({
                where: { medicineId: medicine!.id as any, isActive: true },
                _sum: { stockQuantity: true }
            });

            const updatedMedicine = await tx.medicine.update({
                where: { id: medicine!.id },
                data: { stockQuantity: totalStock._sum.stockQuantity || 0 },
                include: { 
                    batches: { where: { isActive: true }, orderBy: { expiryDate: 'asc' } },
                    categoryRel: true
                } as any
            });

            return this.formatMedicine(updatedMedicine);
        });
    }

    async getMedicine(id: string | number): Promise<MedicineResponse> {
        const medicine = await (prisma as any).medicine.findUnique({ 
            where: { id: id.toString() },
            include: { 
                batches: { where: { isActive: true }, orderBy: { expiryDate: 'asc' } },
                categoryRel: true
            } as any
        });
        if (!medicine) {
            throw new NotFoundError('Medicine');
        }
        return this.formatMedicine(medicine);
    }

    private async ensureTablesExist() {
        try {
            // 1. Categories Table
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS categories (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            
            // 2. Medicines Table
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS medicines (
                    id TEXT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    genericName VARCHAR(255),
                    manufacturer VARCHAR(255),
                    unit VARCHAR(50),
                    reorderLevel INT DEFAULT 0,
                    category_id INT,
                    price_per_unit DECIMAL(10,2),
                    stock_quantity INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (category_id) REFERENCES categories(id)
                );
            `);
            console.log('[PharmacyService] Database tables verified');
        } catch (error) {
            console.error('[PharmacyService] Table verification failed:', error);
        }
    }

    async getMedicines(query: MedicineQueryInput): Promise<PaginatedResponse<any>> {
        const { page = 1, limit = 10, search, category, lowStock, format, allBatches } = query;
        const skip = (page - 1) * limit;

        try {
            await this.ensureTablesExist();

            if (format === 'returns') {
                const conditions: any[] = [{ stockQuantity: { gt: 0 } }, { isActive: true }];
                if (search) {
                    conditions.push({
                        OR: [
                            { medicine: { name: { contains: search, mode: 'insensitive' } } },
                            { batchNumber: { contains: search, mode: 'insensitive' } },
                            { distributorName: { contains: search, mode: 'insensitive' } }
                        ]
                    });
                }

                // Count total matching batches
                const total = await (prisma as any).medicineBatch.count({
                    where: { AND: conditions }
                });

                // Fetch batches with medicine relations
                const batches = await (prisma as any).medicineBatch.findMany({
                    where: { AND: conditions },
                    include: { medicine: true },
                    take: limit,
                    skip,
                    orderBy: { expiryDate: 'asc' }
                });

                const items = batches.map((b: any) => ({
                    id: b.medicine.id,
                    name: b.medicine.name,
                    genericName: b.medicine.genericName,
                    batch: b.batchNumber,
                    distributor: b.distributorName,
                    stock: b.stockQuantity,
                    expiry: b.expiryDate,
                    purchasePrice: b.purchasePrice
                }));

                return {
                    items,
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                };
            }

            if (allBatches) {
                const conditions: any[] = [{ isActive: true }];
                if (search) {
                    conditions.push({
                        OR: [
                            { medicine: { name: { contains: search, mode: 'insensitive' } } },
                            { batchNumber: { contains: search, mode: 'insensitive' } },
                            { distributorName: { contains: search, mode: 'insensitive' } }
                        ]
                    });
                }
                if (category) {
                    if (!isNaN(Number(category))) {
                        conditions.push({ medicine: { categoryId: Number(category) } });
                    } else {
                        conditions.push({ medicine: { categoryRel: { name: { contains: category, mode: 'insensitive' } } } });
                    }
                }
                if (lowStock) {
                    // This is tricky with allBatches. Usually lowStock is at medicine level.
                    // But here we can show batches where stock is low.
                    conditions.push({ stockQuantity: { lte: 10 } });
                }

                const total = await (prisma as any).medicineBatch.count({
                    where: { AND: conditions }
                });

                const batches = await (prisma as any).medicineBatch.findMany({
                    where: { AND: conditions },
                    include: { medicine: { include: { categoryRel: true } } },
                    take: limit,
                    skip,
                    orderBy: [
                        { medicine: { name: 'asc' } },
                        { expiryDate: 'asc' }
                    ]
                });

                const items = batches.map((b: any) => ({
                    id: b.id, // Batch ID is primary for batch-wise view
                    medicineId: b.medicine.id,
                    name: b.medicine.name,
                    genericName: b.medicine.genericName,
                    manufacturer: b.medicine.manufacturer,
                    category: b.medicine.categoryRel?.name || b.medicine.category || '-',
                    stock_quantity: b.stockQuantity,
                    total_stock: b.medicine.stockQuantity,
                    min_stock_level: b.medicine.reorderLevel,
                    unit_price: Number(b.salePrice),
                    purchase_price: Number(b.purchasePrice),
                    gst: Number(b.gst),
                    mrp: Number(b.mrp),
                    distributor: b.distributorName,
                    batch_number: b.batchNumber,
                    expiry_date: b.expiryDate,
                    free_quantity: b.freeQuantity || 0,
                    ptr: Number(b.ptr || 0),
                    rate: Number(b.rate || 0),
                    taxable_amount: Number(b.taxableAmount || 0),
                    gst_amount: Number(b.gstAmount || 0),
                    total_amount: Number(b.totalAmount || 0),
                    status: b.stockQuantity <= b.medicine.reorderLevel ? (b.stockQuantity <= 0 ? 'out_of_stock' : 'low_stock') : 'in_stock',
                    isBatchDetail: true,
                    unit: b.medicine.unit
                }));

                return {
                    items,
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                };
            }

            const conditions: Prisma.Sql[] = [Prisma.sql`1=1`];

            if (search) {
                conditions.push(Prisma.sql`(m.name ILIKE ${'%' + search + '%'} OR m.id::text ILIKE ${'%' + search + '%'})`);
            }

            if (category) {
                if (!isNaN(Number(category))) {
                    conditions.push(Prisma.sql`m.category_id = ${Number(category)}`);
                } else {
                    conditions.push(Prisma.sql`c.name ILIKE ${category}`);
                }
            }

            const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

            const sql = Prisma.sql`
                WITH RankedBatches AS (
                    SELECT 
                        medicine_id,
                        batch_number,
                        distributor_name,
                        expiry_date,
                        ROW_NUMBER() OVER(PARTITION BY medicine_id ORDER BY expiry_date ASC) as rn
                    FROM medicine_batches
                    WHERE is_active = true AND stock_quantity > 0
                )
                SELECT 
                    m.id, 
                    m.name, 
                    m.generic_name as "genericName",
                    m.manufacturer,
                    m.reorder_level as "min_level",
                    c.name AS category, 
                    m.stock_quantity, 
                    m.price_per_unit as unit_price,
                    rb.batch_number,
                    rb.expiry_date,
                    rb.distributor_name as distributor
                FROM medicines m
                LEFT JOIN categories c ON m.category_id = c.id
                LEFT JOIN RankedBatches rb ON m.id::text = rb.medicine_id::text AND rb.rn = 1
                ${whereClause}
                ORDER BY m.name ASC
                LIMIT ${limit} OFFSET ${skip}
            `;

            let items = await prisma.$queryRaw<any[]>(sql);
            
            const countSql = Prisma.sql`
                SELECT COUNT(*) 
                FROM medicines m
                LEFT JOIN categories c ON m.category_id = c.id
                ${whereClause}
            `;
            const countResult = await prisma.$queryRaw<any[]>(countSql);
            const total = Number(countResult[0]?.count) || 0;

            let formattedItems = items.map(m => ({
                id: m.id,
                name: m.name,
                genericName: m.genericName,
                manufacturer: m.manufacturer,
                category: m.category,
                stock_quantity: Number(m.stock_quantity) || 0,
                min_stock_level: Number(m.min_level) || 0,
                unit_price: Number(m.unit_price) || 0,
                status: (Number(m.stock_quantity) || 0) <= (Number(m.min_level) || 10) ? ((Number(m.stock_quantity) || 0) <= 0 ? 'out_of_stock' : 'low_stock') : 'in_stock',
                batch: m.batch_number ? {
                    batch_number: m.batch_number,
                    expiry_date: m.expiry_date,
                    distributor: m.distributor
                } : null
            }));

            // Restore returns format for batch-level selection
            if (format === 'returns') {
                const batchSql = Prisma.sql`
                    SELECT 
                        m.id, 
                        m.name, 
                        b.batch_number,
                        b.stock_quantity as stock,
                        b.distributor_name as distributor,
                        b.expiry_date as expiry,
                        b.purchase_price as "purchasePrice"
                    FROM medicine_batches b
                    JOIN medicines m ON b.medicine_id::text = m.id::text
                    ${whereClause}
                    AND b.is_active = true AND b.stock_quantity > 0
                    ORDER BY b.expiry_date ASC
                `;
                const batchItems = await prisma.$queryRaw<any[]>(batchSql);
                formattedItems = batchItems.map(b => ({
                    ...b,
                    stock: Number(b.stock) || 0,
                    purchasePrice: Number(b.purchasePrice) || 0,
                    batch: b.batch_number, // StockReturns.tsx expectation
                    batchNumber: b.batch_number
                }));
            }

            return {
                items: formattedItems,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            };
        } catch (error) {
            console.error('[PharmacyService] getMedicines DATABASE_ERROR:', error);
            return {
                items: [],
                total: 0,
                page,
                limit,
                totalPages: 0,
            };
        }
    }

    async updateMedicine(id: string | number, input: UpdateMedicineInput): Promise<MedicineResponse> {
        const existing = await (prisma as any).medicine.findUnique({ where: { id: id.toString() } });
        if (!existing) {
            throw new NotFoundError('Medicine');
        }

        const medicine = await (prisma as any).medicine.update({
            where: { id: id.toString() },
            data: input,
        });
        return this.formatMedicine(medicine);
    }

    async updateBatch(id: string, input: UpdateBatchInput): Promise<any> {
        const existing = await (prisma as any).medicineBatch.findUnique({ 
            where: { id },
            include: { medicine: true } 
        });
        if (!existing) {
            throw new NotFoundError('Batch');
        }

        // Validate expiry date if provided
        if (input.expiryDate) {
            const expDate = new Date(input.expiryDate);
            if (expDate <= new Date()) {
                throw new ValidationError('Expiry date must be in the future');
            }
        }

        // Validate prices/stock
        if (input.stockQuantity !== undefined && input.stockQuantity < 0) {
            throw new ValidationError('Stock quantity cannot be negative');
        }
        if (input.purchasePrice !== undefined && input.purchasePrice < 0) {
            throw new ValidationError('Purchase price cannot be negative');
        }
        if (input.salePrice !== undefined && input.salePrice < 0) {
            throw new ValidationError('Sale price cannot be negative');
        }

        return await prisma.$transaction(async (tx: any) => {
            const updatedBatch = await tx.medicineBatch.update({
                where: { id },
                data: input,
            });

            // Update aggregated medicine stock if quantity changed
            if (input.stockQuantity !== undefined) {
                const totalStock = await tx.medicineBatch.aggregate({
                    where: { medicineId: existing.medicineId, isActive: true },
                    _sum: { stockQuantity: true }
                });

                await tx.medicine.update({
                    where: { id: existing.medicineId },
                    data: { stockQuantity: totalStock._sum.stockQuantity || 0 }
                });
            }

            return updatedBatch;
        });
    }

    async deleteMedicine(id: string | number): Promise<void> {
        console.log('[PharmacyService] Attempting to delete medicine with id:', id);
        // Using findFirst instead of findUnique for resilience
        const medicine = await (prisma as any).medicine.findFirst({ where: { id: id.toString() } });
        if (!medicine) {
            console.error('[PharmacyService] Delete medicine failed - Medicine not found for id:', id);
            throw new NotFoundError('Medicine');
        }
        await (prisma as any).medicine.delete({ where: { id: id.toString() } });
        console.log('[PharmacyService] Medicine deleted successfully:', id);
    }

    // Billing
    async createBill(input: CreateBillInput): Promise<BillResponse> {
        // Validate patient if not walk-in
        if (!input.isWalkIn) {
            if (!input.patientId) {
                throw new ValidationError('Patient ID is required for non-walk-in bills');
            }
            const patient = await prisma.patient.findUnique({ where: { uhid: input.patientId } });
            if (!patient) {
                throw new NotFoundError('Patient');
            }
        }

        // Validate stock for medicine items
        for (const item of input.items as CreateBillItem[]) {
            if (item.medicineId) {
                const medicine = await (prisma as any).medicine.findUnique({ where: { id: item.medicineId } });
                if (!medicine) {
                    throw new NotFoundError(`Medicine not found: ${item.medicineId}`);
                }
                if (medicine.stockQuantity < item.quantity) {
                    throw new ValidationError(`Insufficient stock for ${medicine.name}`);
                }
            }
        }

        // Calculate totals
        const subtotal = (input.items as CreateBillItem[]).reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
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

            for (const item of input.items as CreateBillItem[]) {
                const itemBase = item.quantity * item.unitPrice;
                const itemDiscountAmt = itemBase * ((item.discount || 0) / 100);
                const itemTaxable = itemBase - itemDiscountAmt;
                const itemGstAmt = itemTaxable * ((item.gst || 0) / 100);
                const itemTotalAmt = itemTaxable + itemGstAmt;

                subtotal += itemBase;
                totalDiscount += itemDiscountAmt;
                totalGstAmount += itemGstAmt;

                let remainingQty = item.quantity;
                let totalPurchasePrice = 0;

                if (item.medicineId) {
                    // Resolve medicine name for description snapshot
                    const medRecord = await (tx as any).medicine.findUnique({ where: { id: item.medicineId } });
                    if (!item.description && medRecord) {
                        item.description = medRecord.name;
                    }

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

                    // Integrated Logging
                    await this.updateStockAndLog(tx, {
                        medicineId: item.medicineId,
                        type: 'DISPENSE',
                        quantity: -item.quantity,
                        referenceId: `BILL-${Date.now()}`, 
                        remarks: `Dispensed via pharmacy billing: ${billNumber}`
                    });
                }

                const avgPurchasePrice = item.medicineId ? totalPurchasePrice / item.quantity : 0;
                const itemProfit = (item.unitPrice - avgPurchasePrice) * item.quantity;

                billItemsData.push({
                    medicineId: item.medicineId || null,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    batchNumber: item.batchNumber || null,
                    expiryDate: item.expiryDate || null,
                    hsnCode: item.hsnCode || null,
                    discount: item.discount || 0,
                    gst: item.gst || 0,
                    discountAmount: itemDiscountAmt,
                    gstAmount: itemGstAmt,
                    totalAmount: itemTotalAmt,
                    total: itemBase, // Keeping legacy 'total' as subtotal for safety
                    purchasePrice: avgPurchasePrice,
                    profit: itemProfit,
                });
            }

            const finalDiscountedSubtotal = subtotal - totalDiscount;
            const grandTotal = finalDiscountedSubtotal + totalGstAmount;

            const newBill = await (tx as any).bill.create({
                data: {
                    patientId: input.isWalkIn ? null : input.patientId,
                    customerName: input.isWalkIn ? input.customerName : null,
                    phone: input.isWalkIn ? input.phone : null,
                    isWalkIn: input.isWalkIn || false,
                    visitType: input.isWalkIn ? 'WALK_IN' : 'OP',
                    billNumber: `PH-${Date.now()}`,
                    billType: 'PHARMACY',
                    subtotal: subtotal, 
                    discount: totalDiscount, 
                    gstPercent: input.gstPercent || 0, 
                    gstAmount: totalGstAmount,
                    grandTotal,
                    status: 'PAID', 
                    notes: input.notes,
                    items: {
                        create: billItemsData,
                    },
                },
                include: {
                    items: { include: { medicine: true } },
                    patient: true,
                },
            });

            return newBill;
        });

        return this.formatBill(bill);
    }

    async getBills(query: MedicineQueryInput): Promise<PaginatedResponse<BillResponse>> {
        const { page = 1, limit = 10, search: rawSearch, format, billType } = query;
        const search = rawSearch?.trim();
        const skip = (page - 1) * limit;

        // Strictly enforce PHARMACY bill type for this service unless explicitly overridden
        const finalBillType = this.mapBillType(billType as string || 'PHARMACY');
        const where: any = {
            billType: finalBillType
        };
        if (search) {
            where.OR = [
                { billNumber: { contains: search, mode: 'insensitive' } },
                { customerName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { patient: { firstName: { contains: search, mode: 'insensitive' } } },
                { patient: { lastName: { contains: search, mode: 'insensitive' } } },
                { patient: { phone: { contains: search, mode: 'insensitive' } } },
            ];
            console.log(`[PharmacyService.getBills] Searching with query: "${search}"`);
        }

        if (format === 'returns') {
            where.status = 'PAID';
        }

        const includeItems = format === 'returns' 
            ? { where: { medicineId: { not: null } }, include: { medicine: true } }
            : { include: { medicine: true } };

        const [bills, total] = await Promise.all([
            prisma.bill.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { items: includeItems, patient: true },
            }),
            prisma.bill.count({ where }),
        ]);

        if (search) {
            console.log(`[PharmacyService.getBills] Found ${total} bills for search: "${search}"`);
        }

        return {
            items: bills.map((b) => this.formatBill(b as any)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getBill(id: string): Promise<BillResponse> {
        const bill = await prisma.bill.findUnique({
            where: { id },
            include: { items: { include: { medicine: true } }, patient: true },
        });
        if (!bill) {
            throw new NotFoundError('Bill');
        }
        return this.formatBill(bill as any);
    }

    async updateBill(id: string, input: UpdateBillInput): Promise<BillResponse> {
        const existing = await prisma.bill.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundError('Bill');
        }

        const bill = await prisma.bill.update({
            where: { id },
            data: input,
            include: { items: true, patient: true },
        });
        return this.formatBill(bill as any);
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
                const billItem = bill.items.find(bi => String(bi.medicineId) === String(item.medicineId));
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
                const batch = await ((tx as any).medicineBatch).findFirst({
                    where: { 
                        medicineId: item.medicineId, 
                        batchNumber: item.batchNumber || undefined,
                        isActive: true,
                    },
                    orderBy: { expiryDate: 'asc' } 
                });

                if (batch) {
                    await ((tx as any).medicineBatch).update({
                        where: { id: batch.id },
                        data: { stockQuantity: { increment: item.returnQty } }
                    });
                }

                // Log and Sync
                await this.updateStockAndLog(tx, {
                    medicineId: item.medicineId,
                    batchNumber: item.batchNumber || undefined,
                    type: 'PATIENT_RETURN',
                    quantity: item.returnQty,
                    referenceId: pharmacyReturn.id,
                    remarks: `Patient return for bill ${bill.billNumber}`
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
                    const medicine = await (tx as any).medicine.findUnique({ where: { id: item.medicineId } });
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
                await this.updateStockAndLog(tx, {
                    medicineId: item.medicineId,
                    batchNumber: item.batchNumber || undefined,
                    type: 'DISTRIBUTOR_RETURN',
                    quantity: -item.returnQty,
                    referenceId: newStockReturn.id,
                    remarks: `Returned to distributor: ${input.distributor}`
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
            const dateFilter: any = {};
            
            if (startDate) {
                const sDate = new Date(startDate);
                if (!isNaN(sDate.getTime())) {
                    sDate.setHours(0, 0, 0, 0);
                    dateFilter.gte = sDate;
                }
            }
            
            if (endDate) {
                const eDate = new Date(endDate);
                if (!isNaN(eDate.getTime())) {
                    eDate.setHours(23, 59, 59, 999);
                    dateFilter.lte = eDate;
                }
            }
            
            if (Object.keys(dateFilter).length > 0) {
                where.createdAt = dateFilter;
            }
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

        // 1. Range Items Query — PHARMACY only, exclude null medicineId
        const rangeItemsSql = Prisma.sql`
            SELECT 
                m.name AS medicine_name,
                bi.quantity,
                bi.unit_price,
                bi.purchase_price,
                bi.profit
            FROM bill_items bi
            JOIN bills b ON bi.bill_id::text = b.id::text
            JOIN medicines m ON bi.medicine_id::text = m.id::text
            WHERE b.status = 'PAID'
              AND b.bill_type = 'PHARMACY'
              AND bi.medicine_id IS NOT NULL
              AND b.created_at >= ${start} 
              AND b.created_at <= ${end}
        `;

        const rangeItems = await prisma.$queryRaw<any[]>(rangeItemsSql);

        // 2. Today's Profit — PHARMACY only
        const todaySql = Prisma.sql`
            SELECT 
                SUM(bi.profit) AS "todayMargin"
            FROM bill_items bi
            JOIN bills b ON bi.bill_id::text = b.id::text
            WHERE b.status = 'PAID'
              AND b.bill_type = 'PHARMACY'
              AND bi.medicine_id IS NOT NULL
              AND DATE(b.created_at) = CURRENT_DATE
        `;
        const todayResult = await prisma.$queryRaw<any[]>(todaySql);
        const todayMargin = Number(todayResult[0]?.todayMargin) || 0;

        // 3. Monthly Profit — PHARMACY only
        const monthlySql = Prisma.sql`
            SELECT 
                SUM(bi.profit) AS "monthlyMargin"
            FROM bill_items bi
            JOIN bills b ON bi.bill_id::text = b.id::text
            WHERE b.status = 'PAID'
              AND b.bill_type = 'PHARMACY'
              AND bi.medicine_id IS NOT NULL
              AND EXTRACT(MONTH FROM b.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
              AND EXTRACT(YEAR FROM b.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
        `;
        const monthlyResult = await prisma.$queryRaw<any[]>(monthlySql);
        const monthlyMargin = Number(monthlyResult[0]?.monthlyMargin) || 0;

        // 4. Aggregate Range Data
        let totalMargin = 0;
        const medMap = new Map<string, { name: string, quantity: number, profit: number }>();

        rangeItems.forEach((item: any) => {
            const quantity = Number(item.quantity) || 0;
            const profitValue = Number(item.profit) || 0;
            
            totalMargin += profitValue;

            const name = item.medicine_name;
            if (!medMap.has(name)) {
                medMap.set(name, { name, quantity: 0, profit: 0 });
            }
            const med = medMap.get(name)!;
            med.quantity += quantity;
            med.profit += profitValue;
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
        console.log(`[MARGIN REPORT DEBUG] Calculated Total Margin for range: ${totalMargin}`);

        return {
            totalMargin,
            todayMargin,
            monthlyMargin,
            topMedicines,
            medicineWiseProfit
        };
    }

    async getPharmacyReports(query: { startDate?: string; endDate?: string }): Promise<any> {
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

        try {
            // 1. Margin Data (reuse the logic we just fixed)
            const marginData = await this.getMarginReport({ 
                startDate: start.toISOString(), 
                endDate: end.toISOString() 
            });

            // 2. Sales Summary (Daily aggregation)
            const salesSummarySql = Prisma.sql`
                SELECT 
                    DATE(created_at) as "date",
                    SUM(grand_total) as "total_sales"
                FROM bills
                WHERE created_at >= ${start} AND created_at <= ${end} AND status = 'PAID'
                GROUP BY DATE(created_at)
                ORDER BY DATE(created_at) ASC
            `;
            const salesResult = await prisma.$queryRaw<any[]>(salesSummarySql);
            const salesSummary = salesResult.map(row => ({
                date: row.date,
                total_sales: Number(row.total_sales) || 0
            }));

            // 3. Inventory Report
            const inventorySql = Prisma.sql`
                SELECT 
                    name,
                    stock_quantity,
                    reorder_level as "min_stock_level",
                    (SELECT expiry_date FROM medicine_batches mb WHERE mb.medicine_id::text = m.id::text AND mb.is_active = true ORDER BY expiry_date ASC LIMIT 1) as "expiry_date"
                FROM medicines m
                ORDER BY name ASC
            `;
            const inventoryResult = await prisma.$queryRaw<any[]>(inventorySql);
            const inventory = inventoryResult.map(row => ({
                name: row.name,
                stock_quantity: Number(row.stock_quantity) || 0,
                min_stock_level: Number(row.min_stock_level) || 0,
                expiry_date: row.expiry_date
            }));

            // 4. Distributor Dues
            const duesSql = Prisma.sql`
                SELECT 
                    distributor_name as "distributor_id",
                    SUM(total_amount) - SUM(amount_paid) as "due_amount"
                FROM pharmacy_purchases
                WHERE payment_status IN ('PENDING', 'PARTIALLY_PAID')
                GROUP BY distributor_name
            `;
            const duesResult = await prisma.$queryRaw<any[]>(duesSql);
            const distributorDues = duesResult.map(row => ({
                distributor_id: row.distributor_id,
                due_amount: Number(row.due_amount) || 0
            }));

            // Check if entirely empty
            if (salesSummary.length === 0 && inventory.length === 0 && distributorDues.length === 0 && marginData.totalMargin === 0) {
                return { message: "No data available for selected range" };
            }

            return {
                margin: marginData,
                salesSummary,
                inventory,
                distributorDues
            };

        } catch (error) {
            console.error('[PharmacyService] getPharmacyReports failed:', error);
            return {
                margin: { totalMargin: 0, todayMargin: 0, monthlyMargin: 0, topMedicines: [], medicineWiseProfit: [] },
                salesSummary: [],
                inventory: [],
                distributorDues: []
            };
        }
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
            categoryId: medicine.categoryId,
            category: medicine.categoryRel ? {
                id: medicine.categoryRel.id,
                name: medicine.categoryRel.name
            } : null,
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
                free_quantity: b.freeQuantity || 0,
                ptr: Number(b.ptr || 0),
                rate: Number(b.rate || 0),
                taxable_amount: Number(b.taxableAmount || 0),
                gst_amount: Number(b.gstAmount || 0),
                total_amount: Number(b.totalAmount || 0),
            }))
        };
    }

    private formatBill(bill: {
        id: string;
        patientId: string | null;
        customerName?: string | null;
        phone?: string | null;
        isWalkIn?: boolean;
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
            expiryDate?: Date | null;
            hsnCode?: string | null;
            discount?: Decimal;
            gst?: Decimal;
        }>;
        createdAt: Date;
        patient?: {
            uhid: string;
            firstName: string;
            lastName: string;
            phone: string;
        } | null;
    }): BillResponse {
        return {
            id: bill.id,
            patientId: bill.patientId,
            customerName: bill.customerName || null,
            phone: bill.phone || null,
            isWalkIn: bill.isWalkIn || false,
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
                description: item.description || (item as any).medicine?.name || 'Medicine',
                quantity: item.quantity,
                unitPrice: Number(item.unitPrice),
                purchasePrice: Number((item as any).purchasePrice),
                profit: Number((item as any).profit),
                medicineId: item.medicineId || null,
                batchNumber: (item as any).batchNumber || null,
                expiryDate: (item as any).expiryDate || null,
                hsnCode: (item as any).hsnCode || null,
                discount: Number((item as any).discount || 0),
                gst: Number((item as any).gst || 0),
                total: Number(item.total),
            })),
            createdAt: bill.createdAt,
            patient: bill.patient ? {
                uhid: bill.patient.uhid,
                firstName: bill.patient.firstName,
                lastName: bill.patient.lastName,
                phone: bill.patient.phone,
            } : null,
        };
    }

    async getPurchases(input: any): Promise<PaginatedResponse<PharmacyPurchaseResponse>> {
        try {
            const { page = 1, limit = 10, distributor, status } = input || {};
            const skip = (Number(page) - 1) * Number(limit);

            const where: any = { isDeleted: false };
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
                    paymentStatus: 'PENDING',
                    fileUrl: (input as any).fileUrl || null
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
                        freeQuantity: (item as any).freeQuantity || 0,
                        ptr: new Decimal((item as any).ptr || 0),
                        rate: new Decimal((item as any).rate || 0),
                        taxableAmount: new Decimal((item as any).taxableAmount || 0),
                        gstAmount: new Decimal((item as any).gstAmount || 0),
                        totalAmount: new Decimal((item as any).totalAmount || 0),
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
        try {
            await this.ensureTablesExist();
            const categories = await prisma.$queryRaw<any[]>(Prisma.sql`SELECT id, name FROM categories ORDER BY name ASC`);
            return categories || [];
        } catch (error) {
            console.error('[PharmacyService] getCategories DATABASE_ERROR:', error);
            return [];
        }
    }

    async createCategory(input: any) {
        const { name } = input;
        
        try {
            await this.ensureTablesExist();
            
            // Check for duplicate (case-insensitive)
            const existing = await prisma.$queryRaw<any[]>(Prisma.sql`SELECT id FROM categories WHERE name ILIKE ${name} LIMIT 1`);

            if (existing && existing.length > 0) {
                throw new Error('Category already exists');
            }

            return await prisma.$executeRaw(Prisma.sql`INSERT INTO categories (name) VALUES (${name})`);
        } catch (error) {
            console.error('[PharmacyService] createCategory DATABASE_ERROR:', error);
            throw error;
        }
    }

    async deleteCategory(id: any) {
        return (prisma as any).pharmacyCategory.delete({
            where: { id: Number(id) }
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
            fileUrl: purchase.fileUrl || null,
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

    async updatePurchase(id: string, input: any, fileUrl?: string): Promise<any> {
        const existing = await (prisma as any).pharmacyPurchase.findUnique({ where: { id } });
        if (!existing || existing.isDeleted) {
            throw new NotFoundError('Purchase not found');
        }

        const data: any = {};
        if (input.distributorName) data.distributorName = input.distributorName;
        if (input.invoiceNumber) data.invoiceNumber = input.invoiceNumber;
        if (input.purchaseDate) data.purchaseDate = input.purchaseDate;
        if (fileUrl) data.fileUrl = fileUrl;

        return await (prisma as any).pharmacyPurchase.update({
            where: { id },
            data
        });
    }

    async deletePurchase(id: string): Promise<void> {
        const existing = await (prisma as any).pharmacyPurchase.findUnique({
            where: { id },
            include: { payments: true }
        });
        if (!existing || existing.isDeleted) {
            throw new NotFoundError('Purchase not found');
        }

        if (existing.payments && existing.payments.length > 0) {
            throw new ValidationError('Cannot delete purchase with existing payments. Clear payments first.');
        }

        await (prisma as any).pharmacyPurchase.update({
            where: { id },
            data: { isDeleted: true }
        });
    }

    /**
     * Unified Inventory Stock Update & Logger
     */
    async updateStockAndLog(tx: any, data: {
        medicineId: string;
        batchNumber?: string;
        type: 'DISPENSE' | 'PATIENT_RETURN' | 'DISTRIBUTOR_RETURN' | 'STOCK_ADD' | 'ADJUSTMENT';
        quantity: number;
        referenceId?: string;
        remarks?: string;
    }) {
        const medicine = await (tx as any).medicine.findUnique({ where: { id: data.medicineId } });
        if (!medicine) throw new NotFoundError('Medicine');

        const prevStock = medicine.stockQuantity;
        const newStock = prevStock + data.quantity;

        if (newStock < 0) {
            throw new ValidationError(`Insufficient stock for ${medicine.name}. Available: ${prevStock}, Requested: ${Math.abs(data.quantity)}`);
        }

        // 1. Update Medicine Master Aggregate
        await (tx as any).medicine.update({
            where: { id: data.medicineId },
            data: { stockQuantity: newStock }
        });

        // 2. Create Audit Log
        await (tx as any).inventoryLog.create({
            data: {
                medicineId: data.medicineId,
                batchNumber: data.batchNumber,
                type: data.type,
                quantity: data.quantity,
                previousStock: prevStock,
                newStock: newStock,
                referenceId: data.referenceId,
                remarks: data.remarks
            }
        });

        console.log(`[InventoryLog] ${data.type} for ${medicine.name}: ${data.quantity}. Stock: ${prevStock} -> ${newStock}`);
    }

    private mapBillType(type: string): string {
        if (!type) return 'PHARMACY';
        const t = String(type).toUpperCase().trim();
        if (t === 'CONSULT' || t === 'CONSULTATION') return 'CONSULTATION';
        if (t === 'PHARMACY') return 'PHARMACY';
        if (t === 'LAB') return 'LAB';
        return t;
    }
}

export const pharmacyService = new PharmacyService();
