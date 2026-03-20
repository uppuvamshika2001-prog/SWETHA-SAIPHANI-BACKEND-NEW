import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../middleware/errorHandler.js';
import { CreateBillInput, BillQueryInput, UpdateBillStatusInput } from './billing.types.js';
import { Prisma } from '@prisma/client';

export class BillingService {
    async create(input: CreateBillInput) {
        const { items, labOrderIds, isWalkInLab, creatorId, patientId, discount, gstPercent, notes, status } = input as any;

        // Calculate totals
        let subtotal = 0;
        const billItems = (items as any[]).map((item: any) => {
            const total = Number(item.unitPrice) * Number(item.quantity);
            subtotal += total;
            return {
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                medicineId: item.medicineId || undefined,
                total
            };
        });

        const discountAmount = Number(discount || 0);
        const discountedSubtotal = subtotal - discountAmount;
        const gstRate = Number(gstPercent || 0);
        const gstAmount = (discountedSubtotal * gstRate) / 100;
        const grandTotal = discountedSubtotal + gstAmount;

        // Generate Bill Number (Simple format: INV-YYYYMMDD-XXXX)
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const count = await prisma.bill.count();
        const billNumber = `INV-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

        // Only pass valid Bill model fields — NOT items/labOrderIds/isWalkInLab/creatorId
        const bill = await prisma.bill.create({
            data: {
                patientId,
                billNumber,
                subtotal,
                discount: discountAmount,
                gstPercent: gstRate,
                gstAmount,
                grandTotal,
                status: status || 'PENDING',
                notes: notes || undefined,
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

        // Auto-create lab orders for lab items NOT linked to existing orders
        const labItems = billItems.filter((item: any) =>
            item.description.trim().toLowerCase().startsWith('lab:')
        );

        if (labItems.length > 0) {
            let staffIdForOrder: string;

            if (creatorId) {
                const staff = await prisma.staff.findUnique({ where: { userId: creatorId } });
                if (staff) {
                    staffIdForOrder = staff.id;
                } else {
                    const fallbackStaff = await prisma.staff.findFirst();
                    if (!fallbackStaff) throw new Error('No staff found in system to assign as test orderer.');
                    staffIdForOrder = fallbackStaff.id;
                }
            } else {
                const fallbackStaff = await prisma.staff.findFirst();
                if (!fallbackStaff) throw new Error('No staff found in system to assign as test orderer.');
                staffIdForOrder = fallbackStaff.id;
            }

            await prisma.$transaction(async (tx: any) => {
                for (const labItem of labItems) {
                    // Extract test name from "Lab: CBC" format
                    const testName = labItem.description.replace(/^Lab:\s*/i, '').trim();
                    if (!testName) continue;

                    await tx.labTestOrder.create({
                        data: {
                            patientId,
                            orderedById: staffIdForOrder,
                            testName,
                            priority: 'normal',
                            status: 'PAYMENT_PENDING',
                            billId: bill.id,
                            isWalkInLab: isWalkInLab || false,
                        }
                    });
                }
            });
        }

        const medicalRecord = await prisma.medicalRecord.findFirst({
            where: { patientId: bill.patientId },
            orderBy: { createdAt: 'desc' }
        });

        return this.formatBill({ ...bill, medicalRecord });
    }

    async findAll(query: BillQueryInput) {
        const page = Number(query.page || 1);
        const limit = Number(query.limit || 10);
        const { patientId, status, startDate, endDate, search } = query;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (patientId && patientId.trim() !== '') {
            where.patientId = patientId;
        }

        // Do not restrict by status unless explicitly required (not empty string)
        if (status && status.trim() !== '') {
            where.status = (status as string).toUpperCase();
        }

        // Date Filter Fix: Convert to proper UTC range boundaries for the given date string
        if (startDate || endDate) {
            const dateFilter: any = {};
            
            if (startDate) {
                // Example startDate: '2026-03-18' -> Create exactly at 00:00:00 UTC
                const startStr = `${startDate}T00:00:00.000Z`;
                const start = new Date(startStr);
                
                // If the user's timezone is IST (+05:30), the local '00:00:00' is '18:30:00' UTC of the previous day
                // To be robust and match the local day, we shift back 5.5 hours to align UTC with IST midnight.
                // Assuming the clinic operates in IST timezone (+05:30)
                start.setMinutes(start.getMinutes() - 330);
                
                dateFilter.gte = start;
            }
            if (endDate) {
                const endStr = `${endDate}T23:59:59.999Z`;
                const end = new Date(endStr);
                
                // Shift back 5.5 hours to align UTC with IST end of day
                end.setMinutes(end.getMinutes() - 330);
                
                dateFilter.lte = end;
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

        // Debug Logging
        console.log(`[BillingService] findAll Incoming Filters:`, query);
        console.log(`[BillingService] findAll Prisma Where:`, JSON.stringify(where, null, 2));

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
                        items: true
                    }
                })
            ]);

            console.log(`[BillingService] findAll Result Count: ${items.length} records out of ${total} total matching.`);

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
                items: true
            }
        });

        if (!bill) throw new NotFoundError('Bill not found');

        const medicalRecord = await prisma.medicalRecord.findFirst({
            where: { patientId: bill.patientId },
            orderBy: { createdAt: 'desc' }
        });

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
        const orders = await (prisma.labTestOrder as any).findMany({
            where: {
                patientId,
                billingStatus: 'PENDING',
                status: {
                    in: ['ORDERED', 'READY_FOR_SAMPLE_COLLECTION', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED']
                },
            },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                test: { select: { price: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

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
        const patient = await prisma.patient.findUnique({
            where: { uhid: patientId },
            select: { uhid: true, firstName: true, lastName: true }
        });

        if (!patient) {
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

        return {
            patient: {
                id: patient.uhid,
                name: `${patient.firstName} ${patient.lastName}`,
                uhid: patient.uhid
            },
            consultation,
            lab_orders: labOrders
        };
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
            items: bill.items?.map((item: any) => ({
                ...item,
                unitPrice: Number(item.unitPrice),
                total: Number(item.total)
            }))
        };
    }
}

export const billingService = new BillingService();
