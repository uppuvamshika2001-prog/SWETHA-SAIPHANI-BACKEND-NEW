import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { pdfGenerator } from '../../services/pdfGenerator.js';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler.js';
import { CreateLabOrderInput, CreateLabResultInput, LabOrderQueryInput, LabOrderResponse, LabResultResponse, CreateLabTestInput, UpdateLabTestInput } from './lab.types.js';
import { PaginatedResponse } from '../users/users.types.js';

export class LabService {
    async createOrder(orderedByUserId: string, input: CreateLabOrderInput): Promise<LabOrderResponse> {
        // Find orderedBy staff profile (the person logged in, e.g., Doctor, Receptionist, Lab Tech)
        const orderer = await prisma.staff.findUnique({
            where: { userId: orderedByUserId },
            include: { user: true }
        });

        if (!orderer) {
            throw new NotFoundError('Staff profile not found for current user');
        }

        let doctorIdForOrder: string;

        // If a specific doctorId is provided (Receptionist flow), prioritize it
        if (input.doctorId) {
            const doctor = await prisma.staff.findUnique({
                where: { id: input.doctorId },
                include: { user: true }
            });

            if (!doctor || doctor.user.role !== 'DOCTOR') {
                throw new ValidationError('Invalid doctor selected for lab order');
            }
            doctorIdForOrder = doctor.id;
        } else {
            // Default to the current orderer if they are a doctor
            if (orderer.user.role === 'DOCTOR') {
                doctorIdForOrder = orderer.id;
            } else {
                // Requirement: Reception/Admin/others must provide doctor_id
                throw new ValidationError('A valid doctor_id is required for this order');
            }
        }

        // Validate patient
        const patient = await prisma.patient.findUnique({ where: { uhid: input.patientId } });
        if (!patient) {
            throw new NotFoundError('Patient not found');
        }

        // Resolve test record to link master data
        let resolvedTestId = input.testId;
        let resolvedTestName = input.testName;
        let resolvedTestCode = input.testCode;

        if (!resolvedTestId) {
            // Attempt to resolve testId from name or code if not provided
            const resolvedTest = await prisma.labTest.findFirst({
                where: {
                    OR: [
                        { code: { equals: input.testCode || input.testName, mode: 'insensitive' } },
                        { name: { equals: input.testName, mode: 'insensitive' } },
                        { name: { contains: input.testName, mode: 'insensitive' } },
                        { code: { contains: input.testName, mode: 'insensitive' } }
                    ]
                }
            });
            if (resolvedTest) {
                resolvedTestId = resolvedTest.id;
                resolvedTestName = resolvedTest.name;
                resolvedTestCode = resolvedTest.code;
            }
        } else {
            // If testId is provided, sync the name/code from the catalog to ensure consistency
            const catalogTest = await prisma.labTest.findUnique({ where: { id: resolvedTestId } });
            if (catalogTest) {
                resolvedTestName = catalogTest.name;
                resolvedTestCode = catalogTest.code;
            } else {
                // If testId is invalid, try resolving by name/code as a backup
                const fallbackTest = await prisma.labTest.findFirst({
                    where: {
                        OR: [
                            { code: { equals: input.testCode || input.testName, mode: 'insensitive' } },
                            { name: { equals: input.testName, mode: 'insensitive' } }
                        ]
                    }
                });
                if (fallbackTest) {
                    resolvedTestId = fallbackTest.id;
                    resolvedTestName = fallbackTest.name;
                    resolvedTestCode = fallbackTest.code;
                }
            }
        }

        if (!resolvedTestId) {
            throw new ValidationError(`The lab test '${input.testName}' is not in the official catalog. Please select a valid test from the list.`);
        }

        const order = await prisma.labTestOrder.create({
            data: {
                patientId: input.patientId,
                orderedById: doctorIdForOrder,
                testName: resolvedTestName,
                testCode: resolvedTestCode,
                testId: resolvedTestId,
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

        console.log("Created Lab Order:", order);
        return this.formatOrder(order as any);
    }

    async getOrders(query: LabOrderQueryInput): Promise<PaginatedResponse<LabOrderResponse>> {
        try {
            const { page = 1, limit = 10, patientId, status, priority, startDate, endDate } = query;
            const skip = (Number(page) - 1) * Number(limit);

            const where: any = {};
            if (patientId) where.patientId = patientId;
            if (status) where.status = status.toUpperCase();
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

            logger.info({ context: 'LabService.getOrders', where, query }, 'Fetching all lab orders');

            const [orders, total] = await Promise.all([
                prisma.labTestOrder.findMany({
                    where,
                    skip,
                    take: Number(limit),
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
            logger.error({ context: 'LabService.getOrders', error, query }, 'Failed to fetch lab orders');
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
                logger.warn({ userId }, 'Staff profile not found for my orders');
                return {
                    items: [],
                    total: 0,
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 10,
                    totalPages: 0,
                };
            }

            const { page = 1, limit = 10, status, priority, startDate, endDate } = query;
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

            logger.info({ context: 'LabService.getMyOrders', where, query, staffId: staff.id }, 'Fetching doctor specific lab orders');

            const [orders, total] = await Promise.all([
                prisma.labTestOrder.findMany({
                    where,
                    skip,
                    take: Number(limit),
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
            logger.error({ context: 'LabService.getMyOrders', error, userId, query }, 'Failed to fetch my lab orders');
            throw error;
        }
    }

    async getOrderParameters(orderId: string) {
        try {
            // Find the order with patient and test relations
            const order = await (prisma.labTestOrder as any).findUnique({
                where: { id: orderId },
                include: {
                    patient: { select: { firstName: true, lastName: true, gender: true, dateOfBirth: true } },
                    test: {
                        include: {
                            categories: {
                                orderBy: { displayOrder: 'asc' },
                                include: {
                                    parameters: {
                                        orderBy: { displayOrder: 'asc' }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            // Fallback: if order exists but test is null, try to resolve by testName/testCode
            if (order && !order.test) {
                const resolvedTest = await (prisma.labTest as any).findFirst({
                    where: {
                        OR: [
                            { code: { equals: order.testCode || order.testName, mode: 'insensitive' } },
                            { name: { equals: order.testName, mode: 'insensitive' } },
                            { code: { equals: order.testName, mode: 'insensitive' } },
                            { name: { contains: order.testName, mode: 'insensitive' } },
                            { name: { contains: order.testCode || '', mode: 'insensitive' } }
                        ]
                    },
                    include: {
                        categories: {
                            orderBy: { displayOrder: 'asc' },
                            include: {
                                parameters: {
                                    orderBy: { displayOrder: 'asc' }
                                }
                            }
                        }
                    }
                });
                if (resolvedTest) {
                    // Auto-link it for future requests to fix broken legacy data
                    await prisma.labTestOrder.update({
                        where: { id: orderId },
                        data: {
                            testId: resolvedTest.id,
                            testName: resolvedTest.name, // Sync name too
                            testCode: resolvedTest.code  // Sync code too
                        }
                    });
                    (order as any).test = resolvedTest;
                }
            }

            console.log(`[LabService] getOrderParameters for ${orderId}:`, {
                hasOrder: !!order,
                testName: order?.testName,
                hasTestTemplate: !!order?.test,
                categoriesCount: order?.test?.categories?.length || 0
            });

            if (!order) {
                throw new NotFoundError('Lab order not found');
            }

            const patientName = `${order.patient.firstName} ${order.patient.lastName}`;
            const patientGender = (order as any).patient.gender;
            const patientAgeStr = this.calculateAge(order.patient.dateOfBirth);
            const patientAgeNum = parseInt(patientAgeStr);

            // Helper to get correct reference range from JSON structure
            const getRange = (p: any) => {
                const range = p.referenceRange;
                if (!range || typeof range !== 'object') {
                    // Fallback to legacy fields
                    if (patientGender === 'MALE' && p.referenceRangeMale) return p.referenceRangeMale;
                    if (patientGender === 'FEMALE' && p.referenceRangeFemale) return p.referenceRangeFemale;
                    return p.normalRange || (p.normalMin !== null && p.normalMax !== null ? `${p.normalMin} - ${p.normalMax}` : '');
                }

                // New JSON logic
                if (patientGender === 'MALE' && range.male) return range.male;
                if (patientGender === 'FEMALE' && range.female) return range.female;

                // Age based ranges (e.g. for Alkaline Phosphatase)
                if (range.ageBased && Array.isArray(range.ageBased)) {
                    // This is a simplified check, can be expanded if needed
                    // For now, let's just return the first one that matches or all for manual selection
                }

                if (range.adults && patientAgeNum >= 18) return range.adults;
                if (range.newborn && patientAgeNum < 1) return range.newborn;

                return range.default || range.general || Object.values(range)[0] || '';
            };

            const testData = (order as any).test;

            // If we have a direct test relation with categories
            if (testData && testData.categories && testData.categories.length > 0) {
                return {
                    orderId: order.id,
                    patientName,
                    patientGender,
                    testName: order.testName,
                    testType: testData.type || 'PANEL',
                    categories: testData.categories.map((cat: any) => ({
                        id: cat.id,
                        name: cat.name,
                        parameters: cat.parameters.map((p: any) => ({
                            id: p.id,
                            name: p.parameterName,
                            unit: p.unit || '',
                            inputType: p.inputType || 'number',
                            options: p.options || null,
                            referenceRange: getRange(p),
                            normalMin: p.normalMin,
                            normalMax: p.normalMax
                        }))
                    }))
                };
            }

            // Fallback for orders without structured categories (legacy support or singles)
            const parameters = testData ? testData.parameters : [];
            return {
                orderId: order.id,
                patientName,
                patientGender,
                testName: order.testName,
                testType: testData?.type || 'PANEL',
                categories: [
                    {
                        name: 'General',
                        parameters: parameters.map((p: any) => ({
                            id: p.id,
                            name: p.parameterName,
                            unit: p.unit || '',
                            inputType: p.inputType || 'number',
                            referenceRange: getRange(p),
                            normalMin: p.normalMin,
                            normalMax: p.normalMax
                        }))
                    }
                ]
            };
        } catch (error) {
            console.error(`[LabService] Error in getOrderParameters for ${orderId}:`, error);
            return {
                orderId,
                patientName: 'Unknown',
                testName: 'Unknown',
                categories: []
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

    async confirmPayment(id: string): Promise<LabOrderResponse> {
        const order = await prisma.labTestOrder.findUnique({
            where: { id },
            include: { bill: true }
        });

        if (!order) {
            throw new NotFoundError('Lab order not found');
        }

        if (order.status !== 'PAYMENT_PENDING') {
            throw new ValidationError(`Cannot confirm payment for order in ${order.status} status`);
        }

        // Optional: Validate associated bill status if it exists
        if (order.billId && order.bill?.status !== 'PAID') {
            throw new ValidationError('Associated bill has not been paid yet');
        }

        const updatedOrder = await prisma.labTestOrder.update({
            where: { id },
            data: { status: 'READY_FOR_SAMPLE_COLLECTION' },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                orderedBy: { select: { firstName: true, lastName: true } },
                bill: true,
                result: true,
            },
        });

        return this.formatOrder(updatedOrder);
    }

    async updateOrderStatus(id: string, status: string): Promise<LabOrderResponse> {
        const order = await prisma.labTestOrder.update({
            where: { id },
            data: { status: status as any },
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
        const normalizedCode = input.code.trim().toUpperCase();
        const existingTest = await (prisma.labTest as any).findFirst({
            where: { code: { equals: normalizedCode, mode: 'insensitive' } }
        });
        if (existingTest) {
            throw new ValidationError('Test with this code already exists');
        }
        return prisma.labTest.create({
            data: { ...input, code: normalizedCode }
        });
    }

    async getAllTests(search?: string) {
        const where: any = { isActive: true };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { department: { contains: search, mode: 'insensitive' } }
            ];
        }
        return prisma.labTest.findMany({
            where,
            orderBy: { name: 'asc' }
        });
    }

    async updateTest(id: string, input: UpdateLabTestInput) {
        const test = await prisma.labTest.findUnique({ where: { id } });
        if (!test) throw new NotFoundError('Test not found');

        if (input.code) {
            const normalizedCode = input.code.trim().toUpperCase();
            if (normalizedCode !== test.code) {
                const existingTest = await (prisma.labTest as any).findFirst({
                    where: {
                        code: { equals: normalizedCode, mode: 'insensitive' },
                        id: { not: id }
                    }
                });

                if (existingTest) {
                    // SMART MERGE LOGIC:
                    // If the names match OR the current test is just a redundant duplicate of a master record
                    const namesMatch = existingTest.name.toLowerCase().includes(test.name.toLowerCase()) || 
                                     test.name.toLowerCase().includes(existingTest.name.toLowerCase());
                    
                    if (namesMatch) {
                        logger.info({ context: 'LabService.updateTest', fromId: id, toId: existingTest.id, code: normalizedCode }, 'Auto-merging duplicate test records on code update');
                        
                        // 1. Move all orders to the existing (master) test
                        await prisma.labTestOrder.updateMany({
                            where: { testId: id },
                            data: { 
                                testId: existingTest.id,
                                testCode: existingTest.code,
                                testName: existingTest.name
                            }
                        });

                        // 2. Delete the redundant test record (and its local parameters/categories)
                        await (prisma as any).labTestParameter.deleteMany({ where: { testId: id } });
                        await (prisma as any).labTestCategory.deleteMany({ where: { testId: id } });
                        await prisma.labTest.delete({ where: { id: id } });

                        // 3. Update the existing record with any other changes from input (price, dept, etc.)
                        const { code: _, ...otherUpdates } = input;
                        return prisma.labTest.update({
                            where: { id: existingTest.id },
                            data: otherUpdates
                        });
                    }

                    throw new ValidationError('Test with this code already exists');
                }
                (input as any).code = normalizedCode;
            }
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
