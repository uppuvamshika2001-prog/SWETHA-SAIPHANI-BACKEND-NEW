import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../middleware/errorHandler.js';
import { Prisma } from '@prisma/client';
import { logger } from '../../utils/logger.js';
export class BillingService {
    async create(input) {
        const { items, labOrderIds, isWalkInLab, creatorId, patientId, customerName, phone, discount, gstPercent, notes, status, billType: explicitBillType } = input;
        // Derive billType: explicit > lab orders > item types > default CONSULTATION
        let billType = this.mapBillType(explicitBillType);
        if (!explicitBillType) {
            const hasLabOrders = (labOrderIds && labOrderIds.length > 0);
            const hasLabItems = items.some((item) => item.type === 'lab');
            if (hasLabOrders || hasLabItems || isWalkInLab) {
                billType = 'LAB';
            }
        }
        // ... existing logic to calculate totals ...
        // Calculate totals and fetch purchase prices for profit tracking
        let subtotal = 0;
        const medicineItems = items.filter(item => item.medicineId && item.batchNumber);
        // Fetch batches in bulk to get purchase prices
        const batches = medicineItems.length > 0 ? await prisma.medicineBatch.findMany({
            where: {
                OR: medicineItems.map(item => ({
                    medicineId: item.medicineId,
                    batchNumber: item.batchNumber
                }))
            }
        }) : [];
        // Fetch medicines for fallback purchase price if batch not found
        const medicineIds = items.filter(item => item.medicineId).map(item => item.medicineId);
        const medicines = medicineIds.length > 0 ? await prisma.medicine.findMany({
            where: { id: { in: medicineIds } }
        }) : [];
        const billItems = items.map((item) => {
            const unitPrice = Number(item.unitPrice) || 0;
            const quantity = Number(item.quantity) || 0;
            const total = unitPrice * quantity;
            subtotal += total;
            // Determine purchase price
            let purchasePrice = 0;
            if (item.medicineId && item.batchNumber) {
                const batch = batches.find(b => b.medicineId === item.medicineId && b.batchNumber === item.batchNumber);
                if (batch) {
                    purchasePrice = Number(batch.purchasePrice) || 0;
                }
                else {
                    // Fallback to medicine's last purchase price
                    const med = medicines.find(m => m.id === item.medicineId);
                    purchasePrice = Number(med?.pricePerUnit) || 0;
                }
            }
            else if (item.medicineId) {
                const med = medicines.find(m => m.id === item.medicineId);
                purchasePrice = Number(med?.pricePerUnit) || 0;
            }
            const itemDiscountPercent = item.discount ? Number(item.discount) : 0;
            const itemGstPercent = item.gst ? Number(item.gst) : 0;
            const baseAmount = unitPrice * quantity;
            const itemDiscountAmount = (baseAmount * itemDiscountPercent) / 100;
            const afterDiscount = baseAmount - itemDiscountAmount;
            const itemGstAmount = (afterDiscount * itemGstPercent) / 100;
            const itemTotalAmount = afterDiscount + itemGstAmount;
            const profit = (unitPrice - purchasePrice) * quantity;
            return {
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                medicineId: item.medicineId || undefined,
                batchNumber: item.batchNumber || undefined,
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
                hsnCode: item.hsnCode || undefined,
                discount: itemDiscountPercent,
                gst: itemGstPercent,
                discountAmount: itemDiscountAmount,
                gstAmount: itemGstAmount,
                totalAmount: itemTotalAmount,
                total: baseAmount, // Keeping legacy 'total' as base subtotal for safety
                purchasePrice,
                profit
            };
        });
        // Recalculate bill-level totals based on item sums for 100% accuracy
        const totalDiscountAmt = billItems.reduce((sum, item) => sum + item.discountAmount, 0);
        const totalGstAmt = billItems.reduce((sum, item) => sum + item.gstAmount, 0);
        const totalGrandTotal = billItems.reduce((sum, item) => sum + Number(item.totalAmount), 0);
        const totalSubtotal = billItems.reduce((sum, item) => sum + Number(item.total), 0);
        const gstRate = Number(gstPercent || 0);
        // Generate Bill Number (Simple format: INV-YYYYMMDD-XXXX)
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const count = await prisma.bill.count();
        const billNumber = `INV-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;
        console.log("[BillingService] DEBUG: Creating bill with type:", billType, "for patient:", patientId);
        // Only pass valid Bill model fields — NOT items/labOrderIds/isWalkInLab/creatorId
        const bill = await prisma.bill.create({
            data: {
                patientId: patientId || undefined,
                customerName: customerName || undefined,
                phone: phone || undefined,
                isWalkIn: !!(customerName || phone || isWalkInLab),
                billNumber,
                billType,
                subtotal: totalSubtotal,
                discount: totalDiscountAmt,
                gstPercent: gstRate,
                gstAmount: totalGstAmt,
                grandTotal: totalGrandTotal,
                status: status || 'PENDING',
                notes: notes || undefined,
                visitType: input.visitType || 'OP',
                items: {
                    create: billItems
                }
            },
            include: {
                items: { include: { medicine: true } },
                patient: true
            }
        });
        // Collect all lab order IDs (both explicit top-level ones AND embedded in item tracking)
        const embeddedLabOrderIds = items
            .filter((item) => item.type === 'lab' && item.lab_order_id)
            .map((item) => item.lab_order_id);
        const allLabOrderIds = [...(labOrderIds || []), ...embeddedLabOrderIds];
        // Link Lab Orders if provided — mark them as BILLED to prevent duplicate billing
        if (allLabOrderIds.length > 0) {
            await prisma.labTestOrder.updateMany({
                where: { id: { in: allLabOrderIds } },
                data: {
                    billId: bill.id,
                    billingStatus: 'BILLED',
                }
            });
        }
        const medicalRecord = bill.patientId ? await prisma.medicalRecord.findFirst({
            where: { patientId: bill.patientId },
            orderBy: { createdAt: 'desc' }
        }) : null;
        return this.formatBill({ ...bill, medicalRecord });
    }
    async findAll(query, user) {
        const page = Number(query.page || 1);
        const limit = Number(query.limit || 10);
        const { patientId, status, startDate, endDate, search, billType } = query;
        const skip = (page - 1) * limit;
        const where = {};
        // --- Bill Type Filtering Logic ---
        // 1. If explicit billType is provided in query, use it
        if (billType) {
            const rawTypes = Array.isArray(billType) ? billType : (typeof billType === 'string' && billType.includes(',') ? billType.split(',') : [billType]);
            const finalBillTypes = rawTypes.map(t => this.mapBillType(t));
            where.billType = { in: finalBillTypes };
        }
        // 2. Otherwise, use role-based defaults
        else if (user?.role === 'PHARMACIST') {
            where.billType = 'PHARMACY';
        }
        else if (user?.role === 'RECEPTIONIST' || user?.role === 'ADMIN') {
            // Receptionists and Admins should see all types in the main billing dashboard
            where.billType = { in: ['CONSULTATION', 'PHARMACY', 'LAB'] };
        }
        else {
            where.billType = 'CONSULTATION';
        }
        if (patientId && patientId.trim() !== '') {
            where.patientId = patientId;
        }
        // Do not restrict by status unless explicitly required (not empty string)
        if (status && status.trim() !== '') {
            where.status = status.toUpperCase();
        }
        // Date Filter Final Fix: Use robust range boundary (start of day to start of next day)
        if (startDate || endDate) {
            const dateFilter = {};
            if (startDate) {
                const s = new Date(startDate);
                s.setHours(0, 0, 0, 0);
                dateFilter.gte = s;
            }
            if (endDate) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                dateFilter.lte = e;
            }
            else if (startDate) {
                // If only startDate is provided, include the full day
                const e = new Date(startDate);
                e.setHours(23, 59, 59, 999);
                dateFilter.lte = e;
            }
            where.createdAt = dateFilter;
        }
        if (search && search.trim() !== '') {
            where.OR = [
                { billNumber: { contains: search, mode: 'insensitive' } },
                {
                    patient: {
                        OR: [
                            { firstName: { contains: search, mode: 'insensitive' } },
                            { lastName: { contains: search, mode: 'insensitive' } },
                            { phone: { contains: search, mode: 'insensitive' } }
                        ]
                    }
                }
            ];
        }
        try {
            const [total, items] = await Promise.all([
                prisma.bill.count({ where }),
                prisma.bill.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        patient: true,
                        items: { include: { medicine: true } },
                        transactions: true
                    }
                })
            ]);
            if (total === 0) {
                logger.info({ context: 'BillingService.findAll', where, query: { patientId, status, startDate, endDate, search, billType } }, 'No bills found for the given criteria');
            }
            else {
                console.log(`[BillingService] findAll Result Count: ${items.length} records out of ${total} total matching.`);
            }
            const itemsWithMedicalRecords = await Promise.all(items.map(async (item) => {
                const medicalRecord = await prisma.medicalRecord.findFirst({
                    where: { patientId: item.patientId },
                    orderBy: { createdAt: 'desc' }
                });
                return this.formatBill({ ...item, medicalRecord });
            }));
            return {
                items: itemsWithMedicalRecords || [],
                total: total || 0,
                page,
                totalPages: Math.ceil((total || 0) / limit)
            };
        }
        catch (error) {
            console.error('[BillingService] findAll Error:', error);
            // Safe query return on failure
            return {
                items: [],
                total: 0,
                page,
                totalPages: 0
            };
        }
    }
    async findById(id) {
        const bill = await prisma.bill.findUnique({
            where: { id },
            include: {
                patient: true,
                items: { include: { medicine: true } },
                transactions: true
            }
        });
        if (!bill)
            throw new NotFoundError('Bill not found');
        const medicalRecord = bill.patientId ? await prisma.medicalRecord.findFirst({
            where: { patientId: bill.patientId },
            orderBy: { createdAt: 'desc' }
        }) : null;
        return this.formatBill({ ...bill, medicalRecord });
    }
    async updateStatus(id, input) {
        const bill = await prisma.bill.findUnique({ where: { id } });
        if (!bill)
            throw new NotFoundError('Bill not found');
        const updatedBill = await prisma.$transaction(async (tx) => {
            // Update Bill
            const updated = await tx.bill.update({
                where: { id },
                data: {
                    status: input.status,
                    paidAmount: input.paidAmount !== undefined ? input.paidAmount : undefined
                },
                include: {
                    patient: true,
                    items: true
                }
            });
            // Create Payment Transaction if Paid
            if ((input.status === 'PAID' || input.status === 'PARTIALLY_PAID') && input.paidAmount && Number(input.paidAmount) > 0) {
                await tx.paymentTransaction.create({
                    data: {
                        billId: id,
                        amount: new Prisma.Decimal(input.paidAmount),
                        paymentMode: input.paymentMode || 'CASH',
                        referenceNo: input.referenceNo,
                        createdBy: input.createdBy
                    }
                });
            }
            // Sync Lab Orders
            if (input.status === 'PAID') {
                // Find all lab orders linked to this bill
                // Update their status to READY_FOR_SAMPLE_COLLECTION
                await tx.labTestOrder.updateMany({
                    where: { billId: id },
                    data: { status: 'READY_FOR_SAMPLE_COLLECTION' }
                });
            }
            return updated;
        });
        const medicalRecord = await prisma.medicalRecord.findFirst({
            where: { patientId: updatedBill.patientId },
            orderBy: { createdAt: 'desc' }
        });
        return this.formatBill({ ...updatedBill, medicalRecord });
    }
    async getStats() {
        // ... (keep existing implementation, no changes needed for medical records here usually)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [totalRevenue, pendingBills, todayBills] = await Promise.all([
            prisma.bill.aggregate({
                _sum: { grandTotal: true },
                where: { status: 'PAID' }
            }),
            prisma.bill.count({
                where: { status: 'PENDING' }
            }),
            prisma.bill.count({
                where: { createdAt: { gte: today } }
            })
        ]);
        return {
            totalRevenue: Number(totalRevenue._sum.grandTotal || 0),
            pendingBills,
            todayBills
        };
    }
    async delete(id) {
        console.log('[BillingService] Attempting to delete bill with id:', id);
        // Using findFirst instead of findUnique for resilience against possible index issues
        const bill = await prisma.bill.findFirst({ where: { id } });
        if (!bill) {
            console.error('[BillingService] Delete failed - Bill not found in DB for id:', id);
            throw new NotFoundError('Bill');
        }
        console.log('[BillingService] Bill found, starting deletion transaction for id:', id);
        await prisma.$transaction(async (tx) => {
            // Reset Lab Orders if they were linked to this bill
            await tx.labTestOrder.updateMany({
                where: { billId: id },
                data: {
                    billId: null,
                    status: 'ORDERED'
                }
            });
            // Delete the bill (Cascade handles items and transactions)
            await tx.bill.delete({
                where: { id }
            });
        });
        console.log('[BillingService] Bill deleted successfully:', id);
    }
    /**
     * Get paid-but-unbilled lab orders for a specific patient.
     * Used by the billing UI to show lab items available for invoicing.
     */
    async getUnbilledLabOrders(patientId) {
        console.log(`[BillingService] Fetching unbilled lab orders for patient UHID: "${patientId}"`);
        // Use case-insensitive matching for robustness
        const orders = await prisma.labTestOrder.findMany({
            where: {
                patientId: { equals: patientId, mode: 'insensitive' },
                status: {
                    notIn: ['CANCELLED'] // Include PAYMENT_PENDING as it's often what needs billing!
                },
            },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                test: { select: { price: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        console.log(`[BillingService] Found ${orders.length} lab orders for patient "${patientId}"`);
        if (orders.length === 0) {
            // Log a sample order from the DB to see what the patientId format looks like
            const sample = await prisma.labTestOrder.findFirst({ take: 1 });
            console.log(`[BillingService] DB Sample Order PatientId: "${sample?.patientId}"`);
        }
        return orders.map((o) => ({
            id: o.id,
            testName: o.testName,
            testCode: o.testCode,
            patientId: o.patientId,
            patientName: `${o.patient.firstName} ${o.patient.lastName}`,
            status: o.status,
            billingStatus: o.billingStatus,
            createdAt: o.createdAt,
            price: o.test?.price ? Number(o.test.price) : 200
        }));
    }
    /**
     * Get aggregated robust summary for billing UI
     */
    async getPatientBillingSummary(patientId) {
        console.log(`[BillingService] getPatientBillingSummary called for patient UHID: ${patientId}`);
        const patient = await prisma.patient.findUnique({
            where: { uhid: patientId },
            select: { uhid: true, firstName: true, lastName: true }
        });
        if (!patient) {
            console.error(`[BillingService] Patient not found for UHID: ${patientId}`);
            throw new NotFoundError('Patient');
        }
        // Always provide consultation as a default billable option
        const consultation = {
            fee: 300,
            status: 'pending'
        };
        // Safely attempt to fetch lab orders without breaking the whole process
        let labOrders = [];
        try {
            labOrders = await this.getUnbilledLabOrders(patientId);
        }
        catch (error) {
            console.error(`[BillingService] Failed to fetch lab orders for patient ${patientId}`, error);
            // Fallback to empty array so consultation can still be billed
        }
        const result = {
            patient: {
                id: patient.uhid,
                name: `${patient.firstName} ${patient.lastName}`,
                uhid: patient.uhid
            },
            consultation,
            lab_orders: labOrders
        };
        console.log(`[BillingService] Returning billing summary for ${patientId}. Lab orders count: ${labOrders.length}`);
        return result;
    }
    formatBill(bill) {
        return {
            ...bill,
            bill_number: bill.billNumber,
            bill_type: bill.billType,
            subtotal: Number(bill.subtotal),
            discount: Number(bill.discount),
            gst_percent: Number(bill.gstPercent),
            gst_amount: Number(bill.gstAmount),
            grand_total: Number(bill.grandTotal),
            paid_amount: Number(bill.paidAmount),
            is_walk_in: bill.isWalkIn,
            customer_name: bill.customerName,
            created_at: bill.createdAt,
            // Explicit Patient Mapping for UI
            patient: bill.patient ? {
                id: bill.patient.id,
                uhid: bill.patient.uhid,
                firstName: bill.patient.firstName,
                lastName: bill.patient.lastName,
                first_name: bill.patient.firstName,
                last_name: bill.patient.lastName,
                full_name: `${bill.patient.firstName || ''} ${bill.patient.lastName || ''}`.trim(),
                phone: bill.patient.phone
            } : null,
            patientName: bill.patient ? `${bill.patient.firstName || ''} ${bill.patient.lastName || ''}`.trim() : (bill.customerName || "N/A"),
            // Keep camelCase for legacy compatibility
            billNumber: bill.billNumber,
            grandTotal: Number(bill.grandTotal),
            createdAt: bill.createdAt,
            isWalkIn: bill.isWalkIn,
            customerName: bill.customerName,
            // Include Medical Record Info
            medicalRecord: bill.medicalRecord ? {
                diagnosis: bill.medicalRecord.diagnosis,
                treatment: bill.medicalRecord.treatment,
                notes: bill.medicalRecord.notes
            } : undefined,
            transactions: bill.transactions,
            paymentMode: bill.transactions && bill.transactions.length > 0 ? bill.transactions[0].paymentMode : undefined,
            createdBy: bill.transactions && bill.transactions.length > 0 ? bill.transactions[0].createdBy : undefined,
            items: bill.items?.map((item) => ({
                ...item,
                description: item.description || item.medicine?.name || 'Medicine',
                unitPrice: Number(item.unitPrice),
                unit_price: Number(item.unitPrice),
                batch_number: item.batchNumber,
                expiry_date: item.expiryDate,
                hsnCode: item.hsnCode,
                discount_amount: Number(item.discountAmount || 0),
                gst_percent: Number(item.gst || item.gstPercent || 0),
                gst_amount: Number(item.gstAmount || 0),
                total_amount: Number(item.totalAmount || item.total || 0),
                total: Number(item.total)
            }))
        };
    }
    mapBillType(type) {
        if (!type || (Array.isArray(type) && type.length === 0))
            return 'CONSULTATION';
        const raw = Array.isArray(type) ? type[0] : type;
        const t = String(raw).toUpperCase().trim();
        if (t === 'CONSULT' || t === 'CONSULTATION')
            return 'CONSULTATION';
        if (t === 'PHARMACY' || t === 'MEDICINE')
            return 'PHARMACY';
        if (t === 'LAB' || t === 'LABORATORY')
            return 'LAB';
        return t;
    }
}
export const billingService = new BillingService();
//# sourceMappingURL=billing.service.js.map