import { prisma } from '../../config/database.js';
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
                priority: input.priority,
                notes: input.notes,
                status: 'PAYMENT_PENDING',
            },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                orderedBy: { select: { firstName: true, lastName: true } },
                result: true,
            },
        });

        return this.formatOrder(order);
    }

    async getOrders(query: LabOrderQueryInput): Promise<PaginatedResponse<LabOrderResponse>> {
        const { page, limit, patientId, status, priority, startDate, endDate } = query;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {};
        if (patientId) where.patientId = patientId;
        if (status) where.status = status;
        if (priority) where.priority = priority;

        // Date Range Filtering
        if (startDate || endDate) {
            const createdAtFilter: any = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                createdAtFilter.gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                createdAtFilter.lte = end;
            }
            where.createdAt = createdAtFilter;
        }

        const [orders, total] = await Promise.all([
            prisma.labTestOrder.findMany({
                where,
                skip,
                take: limit,
                orderBy: [
                    { createdAt: 'desc' },
                ],
                include: {
                    patient: { select: { firstName: true, lastName: true } },
                    orderedBy: { select: { firstName: true, lastName: true } },
                    bill: true,
                    result: true,
                },
            }),
            prisma.labTestOrder.count({ where }),
        ]);

        return {
            items: orders.map((o) => this.formatOrder(o)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
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
        // Get staff ID from user ID
        const staff = await prisma.staff.findUnique({ where: { userId } });
        if (!staff) {
            // If no staff profile, return empty list instead of error
            // This prevents frontend from breaking or looping if user is Admin without staff profile
            return {
                items: [],
                total: 0,
                page: query.page || 1,
                limit: query.limit || 10,
                totalPages: 0,
            };
        }

        const { page, limit, status, priority, startDate, endDate } = query;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = { orderedById: staff.id };
        if (status) where.status = status;
        if (priority) where.priority = priority;

        // Date Range Filtering
        if (startDate || endDate) {
            const createdAtFilter: any = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                createdAtFilter.gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                createdAtFilter.lte = end;
            }
            where.createdAt = createdAtFilter;
        }

        const [orders, total] = await Promise.all([
            prisma.labTestOrder.findMany({
                where,
                skip,
                take: limit,
                orderBy: [
                    { createdAt: 'desc' },
                ],
                include: {
                    patient: { select: { firstName: true, lastName: true } },
                    orderedBy: { select: { firstName: true, lastName: true } },
                    bill: true,
                    result: true,
                },
            }),
            prisma.labTestOrder.count({ where }),
        ]);

        return {
            items: orders.map((o) => this.formatOrder(o)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
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

        // Create result and update order status
        const [result] = await prisma.$transaction([
            prisma.labTestResult.create({
                data: {
                    orderId: input.orderId,
                    technicianId: technician.id,
                    result: input.result,
                    interpretation: input.interpretation,
                    attachments: input.attachments || [],
                },
            }),
            prisma.labTestOrder.update({
                where: { id: input.orderId },
                data: { status: 'COMPLETED' },
            }),
        ]);

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
}

export const labService = new LabService();
