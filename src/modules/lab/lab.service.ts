import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { pdfGenerator } from '../../services/pdfGenerator.js';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler.js';
import { CreateLabOrderInput, CreateLabResultInput, LabOrderQueryInput, LabOrderResponse, LabResultResponse, CreateLabTestInput, UpdateLabTestInput } from './lab.types.js';
import { PaginatedResponse } from '../users/users.types.js';

export class LabService {
    async createOrder(orderedByUserId: string, input: CreateLabOrderInput): Promise<LabOrderResponse> {
        // Get staff ID from user ID
        const staff = await prisma.staff.findUnique({ where: { userId: orderedByUserId } });
        if (!staff) {
            throw new NotFoundError('Staff profile not found');
        }

        // Validate patient
        const patient = await prisma.patient.findUnique({ where: { uhid: input.patientId } });
        if (!patient) {
            throw new NotFoundError('Patient not found');
        }

        const order = await prisma.labTestOrder.create({
            data: {
                patientId: input.patientId,
                orderedById: staff.id,
                testName: input.testName,
                testCode: input.testCode,
                testId: (input as any).testId, // Support testId if provided
                priority: input.priority,
                notes: input.notes,
                status: 'PAYMENT_PENDING',
            } as any,
            include: {
                patient: { select: { firstName: true, lastName: true } },
                orderedBy: { select: { firstName: true, lastName: true } },
                result: true,
            },
        });

        return this.formatOrder(order as any);
    }

    async getOrders(query: LabOrderQueryInput): Promise<PaginatedResponse<LabOrderResponse>> {
        try {
            const { page, limit, patientId, status, priority, startDate, endDate } = query as Required<LabOrderQueryInput>;
            const skip = (Number(page) - 1) * Number(limit);

            const where: any = {};
            if (patientId) where.patientId = patientId;
            if (status) where.status = status;
            if (priority) where.priority = priority;

            // Date Range Filtering with robust validation
            if (startDate || endDate) {
                const dateFilter: any = {};
                
                if (startDate) {
                    const start = new Date(startDate);
                    if (!isNaN(start.getTime())) {
                        start.setHours(0, 0, 0, 0);
                        dateFilter.gte = start;
                    }
                }
                
                if (endDate) {
                    const end = new Date(endDate);
                    if (!isNaN(end.getTime())) {
                        end.setHours(23, 59, 59, 999);
                        dateFilter.lte = end;
                    }
                }

                if (Object.keys(dateFilter).length > 0) {
                    where.createdAt = dateFilter;
                }
            }

            logger.info({ where, query }, 'Fetching all lab orders');

            const [orders, total] = await Promise.all([
                prisma.labTestOrder.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        patient: { select: { firstName: true, lastName: true } },
                        orderedBy: { select: { firstName: true, lastName: true } },
                        test: true,
                        bill: true,
                        result: true,
                    },
                }),
                prisma.labTestOrder.count({ where }),
            ]);

            return {
                items: orders.map((o: any) => this.formatOrder(o)),
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            };
        } catch (error) {
            logger.error({ error, query }, 'Failed to fetch lab orders');
            throw error;
        }
    }

    async getOrder(id: string): Promise<LabOrderResponse> {
        const order = await prisma.labTestOrder.findUnique({
            where: { id },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                orderedBy: { select: { firstName: true, lastName: true } },
                bill: true,
                result: true,
            },
        });

        if (!order) {
            throw new NotFoundError('Lab order not found');
        }

        return this.formatOrder(order);
    }

    async getMyOrders(userId: string, query: LabOrderQueryInput): Promise<PaginatedResponse<LabOrderResponse>> {
        try {
            // Get staff ID from user ID
            const staff = await prisma.staff.findUnique({ where: { userId } });
            if (!staff) {
                return {
                    items: [],
                    total: 0,
                    page: (query.page as number) || 1,
                    limit: (query.limit as number) || 10,
                    totalPages: 0,
                };
            }

            const { page, limit, status, priority, startDate, endDate } = query as Required<LabOrderQueryInput>;
            const skip = (Number(page) - 1) * Number(limit);

            const where: any = { orderedById: staff.id };
            if (status) where.status = status;
            if (priority) where.priority = priority;

            // Date Range Filtering with robust validation
            if (startDate || endDate) {
                const dateFilter: any = {};
                
                if (startDate) {
                    const start = new Date(startDate);
                    if (!isNaN(start.getTime())) {
                        start.setHours(0, 0, 0, 0);
                        dateFilter.gte = start;
                    }
                }
                
                if (endDate) {
                    const end = new Date(endDate);
                    if (!isNaN(end.getTime())) {
                        end.setHours(23, 59, 59, 999);
                        dateFilter.lte = end;
                    }
                }

                if (Object.keys(dateFilter).length > 0) {
                    where.createdAt = dateFilter;
                }
            }

            logger.info({ where, query, staffId: staff.id }, 'Fetching my lab orders');

            const [orders, total] = await Promise.all([
                prisma.labTestOrder.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        patient: { select: { firstName: true, lastName: true } },
                        orderedBy: { select: { firstName: true, lastName: true } },
                        test: true,
                        bill: true,
                        result: true,
                    },
                }),
                prisma.labTestOrder.count({ where }),
            ]);

            return {
                items: orders.map((o: any) => this.formatOrder(o)),
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            };
        } catch (error) {
            logger.error({ error, userId, query }, 'Failed to fetch my lab orders');
            throw error;
        }
    }

    async getOrderParameters(orderId: string) {
        try {
            // Find the order with patient and test relations
            const order = await (prisma.labTestOrder as any).findUnique({
                where: { id: orderId },
                include: {
                    patient: { select: { firstName: true, lastName: true, gender: true } },
                    test: {
                        include: {
                            parameters: {
                                orderBy: { displayOrder: 'asc' }
                            }
                        }
                    }
                }
            });

            if (!order) {
                throw new NotFoundError('Lab order not found');
            }

            const patientName = `${order.patient.firstName} ${order.patient.lastName}`;
            const patientGender = (order as any).patient.gender;
            
            // Helper to get correct normal range based on gender
            const getRange = (p: any) => {
                if (patientGender === 'MALE' && p.referenceRangeMale) return p.referenceRangeMale;
                if (patientGender === 'FEMALE' && p.referenceRangeFemale) return p.referenceRangeFemale;
                return p.normalRange || (p.normalMin !== null && p.normalMax !== null ? `${p.normalMin} - ${p.normalMax}` : '');
            };

            // If we have a direct test relation, use it
            if ((order as any).test) {
                return {
                    orderId: (order as any).id,
                    patientName,
                    patientGender,
                    testName: (order as any).testName,
                    parameters: (order as any).test.parameters.map((p: any) => ({
                        id: p.id,
                        parameter: p.parameterName,
                        unit: p.unit || '',
                        normalRange: getRange(p),
                        normalMin: p.normalMin,
                        normalMax: p.normalMax
                    }))
                };
            }

            // Fallback: Search by name/code if relation is missing (for older orders)
            console.log(`[LabService] Falling back to name search for order ${orderId}`);
            const searchConditions: any[] = [{ name: (order as any).testName }];
            if ((order as any).testCode) {
                searchConditions.push({ code: (order as any).testCode });
            }

            const test = await (prisma.labTest as any).findFirst({
                where: { OR: searchConditions },
                include: {
                    parameters: { orderBy: { displayOrder: 'asc' } }
                }
            });

            return {
                orderId: order.id,
                patientName,
                patientGender,
                testName: order.testName,
                parameters: test ? test.parameters.map((p: any) => ({
                    id: p.id,
                    parameter: p.parameterName,
                    unit: p.unit || '',
                    normalRange: getRange(p),
                    normalMin: p.normalMin,
                    normalMax: p.normalMax
                })) : []
            };
        } catch (error) {
            console.error(`[LabService] Error in getOrderParameters for ${orderId}:`, error);
            return {
                orderId,
                patientName: 'Unknown',
                testName: 'Unknown',
                parameters: []
            };
        }
    }

    async submitResult(technicianUserId: string, input: CreateLabResultInput): Promise<LabResultResponse> {
        // Get technician staff ID
        const technician = await prisma.staff.findUnique({ where: { userId: technicianUserId } });
        if (!technician) {
            throw new NotFoundError('Technician profile not found');
        }

        // Validate order exists
        const order = await prisma.labTestOrder.findUnique({
            where: { id: input.orderId },
            include: { result: true },
        });
        if (!order) {
            throw new NotFoundError('Lab order not found');
        }

        if (order.result) {
            throw new ValidationError('Result already submitted for this order');
        }

        // Create result and update order status in a transaction
        const result = await prisma.$transaction(async (tx: any) => {
            // 1. Create the main LabTestResult entry (maintaining JSON for compatibility)
            const labResult = await tx.labTestResult.create({
                data: {
                    orderId: input.orderId,
                    technicianId: technician.id,
                    result: input.result,
                    interpretation: input.interpretation,
                    attachments: input.attachments || [],
                },
            });

            // 2. Create individual LabResult entries for structured data
            if (input.result.parameters && input.result.parameters.length > 0) {
                const resultsData = input.result.parameters
                    .filter((p: any) => p.parameterId) // Only save if we have a parameterId
                    .map((p: any) => ({
                        orderId: input.orderId,
                        parameterId: p.parameterId!,
                        resultValue: p.value,
                        flag: p.flag || 'NORMAL'
                    }));

                if (resultsData.length > 0) {
                    await (tx as any).labResult.createMany({
                        data: resultsData
                    });
                }
            }

            // 3. Update order status and visibility
            await tx.labTestOrder.update({
                where: { id: input.orderId },
                data: { 
                    status: 'COMPLETED',
                    isReportVisibleToPatient: (input as any).isReportVisibleToPatient !== undefined ? (input as any).isReportVisibleToPatient : true
                } as any,
            });

            return labResult;
        });

        return this.formatResult(result);
    }

    async getResult(id: string): Promise<LabResultResponse> {
        const result = await prisma.labTestResult.findUnique({ where: { id } });
        if (!result) {
            throw new NotFoundError('Lab result not found');
        }
        return this.formatResult(result);
    }

    async deleteResult(id: string): Promise<void> {
        const result = await prisma.labTestResult.findUnique({ where: { id } });
        if (!result) {
            throw new NotFoundError('Lab result not found');
        }

        await prisma.$transaction([
            prisma.labTestResult.delete({ where: { id } }),
            prisma.labTestOrder.update({
                where: { id: result.orderId },
                data: { status: 'IN_PROGRESS' }
            })
        ]);
    }

    async updateOrderStatus(id: string, status: string): Promise<LabOrderResponse> {
        const order = await prisma.labTestOrder.update({
            where: { id },
            data: { status: status as 'PAYMENT_PENDING' | 'READY_FOR_SAMPLE_COLLECTION' | 'ORDERED' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                orderedBy: { select: { firstName: true, lastName: true } },
                bill: true,
                result: true,
            },
        });
        return this.formatOrder(order);
    }

    private formatOrder(order: {
        id: string;
        patientId: string;
        orderedById: string;
        testName: string;
        testCode: string | null;
        priority: string;
        status: string;
        notes: string | null;
        patient: { firstName: string; lastName: string };
        orderedBy: { firstName: string; lastName: string };
        test?: any | null;
        result: {
            id: string;
            orderId: string;
            technicianId: string;
            result: unknown;
            interpretation: string | null;
            attachments: unknown;
            completedAt: Date;
        } | null;
        createdAt: Date;
    }): LabOrderResponse {
        return {
            id: order.id,
            patientId: order.patientId,
            orderedById: order.orderedById,
            testName: order.testName,
            testCode: order.testCode,
            priority: order.priority,
            status: order.status as LabOrderResponse['status'],
            notes: order.notes,
            patient: order.patient,
            orderedBy: order.orderedBy,
            test: order.test || null,
            result: order.result ? this.formatResult(order.result) : null,
            createdAt: order.createdAt,
        };
    }

    private formatResult(result: {
        id: string;
        orderId: string;
        technicianId: string;
        result: unknown;
        interpretation: string | null;
        attachments: unknown;
        completedAt: Date;
    }): LabResultResponse {
        return {
            id: result.id,
            orderId: result.orderId,
            technicianId: result.technicianId,
            result: result.result as LabResultResponse['result'],
            interpretation: result.interpretation,
            attachments: result.attachments as string[] | null,
            completedAt: result.completedAt,
        };
    }


    // Lab Test Catalog Management
    async createTest(input: CreateLabTestInput) {
        const existingTest = await prisma.labTest.findUnique({ where: { code: input.code } });
        if (existingTest) {
            throw new ValidationError('Test with this code already exists');
        }
        return prisma.labTest.create({ data: input });
    }

    async getAllTests() {
        return prisma.labTest.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
    }

    async updateTest(id: string, input: UpdateLabTestInput) {
        const test = await prisma.labTest.findUnique({ where: { id } });
        if (!test) throw new NotFoundError('Test not found');

        if (input.code && input.code !== test.code) {
            const existingTest = await prisma.labTest.findUnique({ where: { code: input.code } });
            if (existingTest) throw new ValidationError('Test with this code already exists');
        }

        return prisma.labTest.update({
            where: { id },
            data: input
        });
    }

    async deleteTest(id: string) {
        const test = await prisma.labTest.findUnique({ where: { id } });
        if (!test) throw new NotFoundError('Test not found');

        return prisma.labTest.update({
            where: { id },
            data: { isActive: false }
        });
    }

    async deleteTestOrder(id: string) {
        const order = await prisma.labTestOrder.findUnique({
            where: { id: id },
            include: { result: true }
        });

        if (!order) throw new NotFoundError('Lab order not found');

        if (order.result) {
            throw new ValidationError('Cannot delete a lab order that already has results. Please delete the result first.');
        }

        // Delete the order itself
        await prisma.labTestOrder.delete({
            where: { id }
        });
    }

    async generateReportPDF(orderId: string): Promise<Buffer> {
        const order = await prisma.labTestOrder.findUnique({
            where: { id: orderId },
            include: {
                patient: true,
                orderedBy: true,
                result: true,
            }
        });

        if (!order || !order.result) {
            throw new NotFoundError('Lab order or results not found');
        }

        const resultData = order.result.result as any;
        
        const reportData = {
            orderId: order.id,
            patientName: `${order.patient.firstName} ${order.patient.lastName}`,
            patientId: order.patient.uhid,
            gender: order.patient.gender,
            age: this.calculateAge(order.patient.dateOfBirth),
            doctorName: `Dr. ${order.orderedBy.firstName} ${order.orderedBy.lastName}`,
            date: order.createdAt,
            results: resultData,
            interpretation: order.result.interpretation
        };

        return await pdfGenerator.generateLabReportPDF(reportData, true);
    }

    private calculateAge(dob: Date): string {
        const today = new Date();
        const birthDate = new Date(dob);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return `${age}Y`;
    }
}

export const labService = new LabService();
