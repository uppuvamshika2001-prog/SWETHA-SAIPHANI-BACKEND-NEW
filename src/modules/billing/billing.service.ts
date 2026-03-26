import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../middleware/errorHandler.js';
import { CreateBillInput, BillQueryInput, UpdateBillStatusInput } from './billing.types.js';
import { Prisma } from '@prisma/client';
import { logger } from '../../utils/logger.js';

export class BillingService {
    async create(input: CreateBillInput) {
        const { items, labOrderIds, isWalkInLab, creatorId, patientId, customerName, phone, discount, gstPercent, notes, status, billType: explicitBillType } = input as any;

        // Derive billType: explicit > lab orders > item types > default CONSULTATION
        let billType = this.mapBillType(explicitBillType);
        if (!explicitBillType) {
            const hasLabOrders = (labOrderIds && labOrderIds.length > 0);
            const hasLabItems = (items as any[]).some((item: any) => item.type === 'lab');
            if (hasLabOrders || hasLabItems || isWalkInLab) {
                billType = 'LAB';
            }
        }

        // ... existing logic to calculate totals ...

        // Calculate totals and fetch purchase prices for profit tracking
        let subtotal = 0;
        const medicineItems = (items as any[]).filter(item => item.medicineId && item.batchNumber);
        
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
        const medicineIds = (items as any[]).filter(item => item.medicineId).map(item => item.medicineId);
        const medicines = medicineIds.length > 0 ? await prisma.medicine.findMany({
            where: { id: { in: medicineIds } }
        }) : [];

        const billItems = (items as any[]).map((item: any) => {
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
                } else {
                    // Fallback to medicine's last purchase price
                    const med = medicines.find(m => m.id === item.medicineId);
                    purchasePrice = Number(med?.pricePerUnit) || 0;
                }
            } else if (item.medicineId) {
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

        // Only pass valid Bill model fields — NOT items/labOrderIds/isWalkInLab/creatorId
        const bill = await (prisma.bill as any).create({
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
                items: true,
                patient: true
            }
        });

        // Collect all lab order IDs (both explicit top-level ones AND embedded in item tracking)
        const embeddedLabOrderIds = (items as any[])
            .filter((item: any) => item.type === 'lab' && item.lab_order_id)
            .map((item: any) => item.lab_order_id);

        const allLabOrderIds = [...(labOrderIds || []), ...embeddedLabOrderIds];

        // Link Lab Orders if provided — mark them as BILLED to prevent duplicate billing
        if (allLabOrderIds.length > 0) {
            await (prisma.labTestOrder as any).updateMany({
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

    async findAll(query: BillQueryInput, user?: any) {
        const page = Number(query.page || 1);
        const limit = Number(query.limit || 10);
        const { patientId, status, startDate, endDate, search, billType } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        
        // --- Bill Type Filtering Logic ---
        // 1. If explicit billType is provided in query, use it
        if (billType) {
            const rawTypes = Array.isArray(billType) ? billType : (typeof billType === 'string' && billType.includes(',') ? billType.split(',') : [billType as string]);
            const finalBillTypes = rawTypes.map(t => this.mapBillType(t));
            where.billType = { in: finalBillTypes };
        } 
        // 2. Otherwise, use role-based defaults
        else if (user?.role === 'PHARMACIST') {
            where.billType = 'PHARMACY';
        } 
        else {
            // Default for RECEPTIONIST, ADMIN or any other staff
            where.billType = { in: ['LAB', 'CONSULTATION'] };
        }

        console.log(`[BillingService] Role: ${user?.role}, Initial where.billType:`, where.billType);

        if (patientId && patientId.trim() !== '') {
            where.patientId = patientId;
        }

        // Do not restrict by status unless explicitly required (not empty string)
        if (status && status.trim() !== '') {
            where.status = (status as string).toUpperCase();
        }

        // Date Filter Final Fix: Use local time boundaries to include the full day
        if (startDate || endDate) {
            const dateFilter: any = {};
            
            if (startDate) {
                // Using template literal without 'Z' uses server local time (IST)
                dateFilter.gte = new Date(`${(startDate as string).split('T')[0]}T00:00:00`);
            }
            
            if (endDate) {
                dateFilter.lte = new Date(`${(endDate as string).split('T')[0]}T23:59:59.999`);
            }
            
            where.createdAt = dateFilter;
            console.log(`[BillingService] Date Filter applied (Local):`, JSON.stringify(dateFilter, null, 2));
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

        // Debug Logging
        console.log(`[BillingService] findAll Incoming Filters:`, query);
        console.log("FINAL QUERY WHERE.billType:", where.billType);
        console.log("FINAL QUERY WHERE:", JSON.stringify(where, null, 2));

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
            } else {
                console.log(`[BillingService] findAll Result Count: ${items.length} records out of ${total} total matching.`);
            }

            const itemsWithMedicalRecords = await Promise.all(items.map(async (item: any) => {
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
        } catch (error) {
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

    async findById(id: string) {
        const bill = await prisma.bill.findUnique({
            where: { id },
            include: {
                patient: true,
                items: { include: { medicine: true } },
                transactions: true
            }
        });

        if (!bill) throw new NotFoundError('Bill not found');

        const medicalRecord = bill.patientId ? await prisma.medicalRecord.findFirst({
            where: { patientId: bill.patientId },
            orderBy: { createdAt: 'desc' }
        }) : null;

        return this.formatBill({ ...bill, medicalRecord });
    }

    async updateStatus(id: string, input: UpdateBillStatusInput & { paymentMode?: string; referenceNo?: string; createdBy?: string }) {
        const bill = await prisma.bill.findUnique({ where: { id } });
        if (!bill) throw new NotFoundError('Bill not found');

        const updatedBill = await prisma.$transaction(async (tx: any) => {
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
                        amount: new (Prisma as any).Decimal(input.paidAmount),
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

        return this.formatBill({ ...updatedBill, medicalRecord } as any);
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

    async delete(id: string) {
        console.log('[BillingService] Attempting to delete bill with id:', id);
        // Using findFirst instead of findUnique for resilience against possible index issues
        const bill = await prisma.bill.findFirst({ where: { id } });

        if (!bill) {
            console.error('[BillingService] Delete failed - Bill not found in DB for id:', id);
            throw new NotFoundError('Bill');
        }

        console.log('[BillingService] Bill found, starting deletion transaction for id:', id);
        await prisma.$transaction(async (tx: any) => {
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
    async getUnbilledLabOrders(patientId: string) {
        console.log(`[BillingService] Fetching unbilled lab orders for patient UHID: "${patientId}"`);
        
        // Use case-insensitive matching for robustness
        const orders = await (prisma.labTestOrder as any).findMany({
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
            const sample = await (prisma.labTestOrder as any).findFirst({ take: 1 });
            console.log(`[BillingService] DB Sample Order PatientId: "${sample?.patientId}"`);
        }

        return orders.map((o: any) => ({
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
    async getPatientBillingSummary(patientId: string) {
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
        } catch (error) {
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

    private formatBill(bill: any) {
        return {
            ...bill,
            subtotal: Number(bill.subtotal),
            discount: Number(bill.discount),
            gstPercent: Number(bill.gstPercent),
            gstAmount: Number(bill.gstAmount),
            grandTotal: Number(bill.grandTotal),
            paidAmount: Number(bill.paidAmount),
            // Include Medical Record Info
            medicalRecord: bill.medicalRecord ? {
                diagnosis: bill.medicalRecord.diagnosis,
                treatment: bill.medicalRecord.treatment,
                notes: bill.medicalRecord.notes
            } : undefined,
            transactions: bill.transactions,
            paymentMode: bill.transactions && bill.transactions.length > 0 ? bill.transactions[0].paymentMode : undefined,
            createdBy: bill.transactions && bill.transactions.length > 0 ? bill.transactions[0].createdBy : undefined,
            items: bill.items?.map((item: any) => ({
                ...item,
                description: item.description || item.medicine?.name || 'Medicine',
                unitPrice: Number(item.unitPrice),
                total: Number(item.total)
            }))
        };
    }

    private mapBillType(type: string | string[]): string {
        if (!type) return 'CONSULTATION';
        const t = String(type).toUpperCase().trim();
        if (t === 'CONSULT' || t === 'CONSULTATION') return 'CONSULTATION';
        if (t === 'PHARMACY') return 'PHARMACY';
        if (t === 'LAB') return 'LAB';
        return t;
    }
}

export const billingService = new BillingService();
