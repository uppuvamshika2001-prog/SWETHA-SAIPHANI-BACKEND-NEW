import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../middleware/errorHandler.js';
import { CreateBillInput, BillQueryInput, UpdateBillStatusInput } from './billing.types.js';
import { Prisma } from '@prisma/client';

export class BillingService {
    async create(input: CreateBillInput) {
        const { items, labOrderIds, ...billData } = input;

        // Calculate totals
        let subtotal = 0;
        const billItems = items.map(item => {
            const total = item.unitPrice * item.quantity;
            subtotal += total;
            return {
                ...item,
                total
            };
        });

        const discountedSubtotal = subtotal - billData.discount;
        const gstAmount = (discountedSubtotal * billData.gstPercent) / 100;
        const grandTotal = discountedSubtotal + gstAmount;

        // Generate Bill Number (Simple format: INV-YYYYMMDD-XXXX)
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const count = await prisma.bill.count();
        const billNumber = `INV-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

        const bill = await prisma.bill.create({
            data: {
                ...billData,
                billNumber,
                subtotal,
                gstAmount,
                grandTotal,
                items: {
                    create: billItems
                }
            },
            include: {
                items: true,
                patient: true
            }
        });

        // Link Lab Orders if provided
        if (labOrderIds && labOrderIds.length > 0) {
            await prisma.labTestOrder.updateMany({
                where: { id: { in: labOrderIds } },
                data: {
                    billId: bill.id,
                    status: 'PAYMENT_PENDING' // Update status to pending payment
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
        const { page = 1, limit = 10, patientId, status, startDate, endDate, search } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.BillWhereInput = {};

        if (patientId) where.patientId = patientId;
        if (status) where.status = status;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        if (search) {
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

        const itemsWithMedicalRecords = await Promise.all(items.map(async (item) => {
            const medicalRecord = await prisma.medicalRecord.findFirst({
                where: { patientId: item.patientId },
                orderBy: { createdAt: 'desc' }
            });
            return this.formatBill({ ...item, medicalRecord });
        }));

        return {
            items: itemsWithMedicalRecords,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
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
            if ((input.status === 'PAID' || input.status === 'PARTIALLY_PAID') && input.paidAmount && input.paidAmount > 0) {
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
