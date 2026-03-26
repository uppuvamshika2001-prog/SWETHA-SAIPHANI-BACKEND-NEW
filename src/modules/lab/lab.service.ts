import { prisma } from '../../config/database.js';
import { LabTestStatus } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { pdfGenerator } from '../../services/pdfGenerator.js';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler.js';
import { CreateLabOrderInput, CreateLabResultInput, LabOrderQueryInput, LabOrderResponse, LabResultResponse, CreateLabTestInput, UpdateLabTestInput } from './lab.types.js';
import { PaginatedResponse } from '../users/users.types.js';
import { patientsService } from '../patients/patients.service.js';

export class LabService {
    async createOrder(orderedByUserId: string, userRole: any, input: CreateLabOrderInput): Promise<LabOrderResponse> {
        // Find orderedBy staff profile (the person logged in, e.g., Doctor, Receptionist, Lab Tech)
        const orderer = await prisma.staff.findUnique({
            where: { userId: orderedByUserId },
            include: { user: true }
        });

        if (!orderer) {
            throw new NotFoundError('Staff profile not found for current user');
        }

        let doctorIdForOrder: string | null = null;
        let orderedByRoleValue = userRole;

        if (userRole === 'DOCTOR') {
            doctorIdForOrder = orderer.id;
        } else if (input.doctorId) {
            // Receptionist or Admin delegating to a specific doctor
            // Try finding by Staff.id first, then by Staff.userId (frontend sends userId)
            let doctor = await prisma.staff.findUnique({
                where: { id: input.doctorId },
                include: { user: true }
            });

            if (!doctor) {
                // Fallback: frontend staffService maps .id to userId
                doctor = await prisma.staff.findUnique({
                    where: { userId: input.doctorId },
                    include: { user: true }
                });
            }

            if (!doctor || doctor.user.role !== 'DOCTOR') {
                throw new ValidationError('Invalid doctor selected for lab order');
            }
            doctorIdForOrder = doctor.id;
        }
        // If it's a Receptionist and NO doctor is provided, doctorIdForOrder remains null safely.

        // Derive walk-in status from all possible frontend signals
        const isWalkIn = input.isWalkInLab
            || input.visitType === 'WALK_IN'
            || (input as any).patientType === 'WALKIN_LAB'
            || (input as any).patientType === 'WALK_IN';

        // Validate patient — only required for non-walk-in orders
        if (!isWalkIn) {
            if (!input.patientId) {
                throw new ValidationError('Patient ID is required for non-walk-in lab orders');
            }
            const patient = await prisma.patient.findUnique({ where: { uhid: input.patientId } });
            if (!patient) {
                throw new NotFoundError('Patient not found');
            }
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

        // Handle OP Visit recording
        let visitRecordId = null;
        if (input.visitType === 'OP' && input.patientId && !isWalkIn) {
            try {
                visitRecordId = await patientsService.createOP(input.patientId, input.doctorId);
                console.log(`[LabService] Created auto-OP record ${visitRecordId} for patient ${input.patientId}`);
            } catch (error) {
                logger.error({ error, patientId: input.patientId }, 'Failed to create auto-OP record for lab order. Continuing order creation.');
            }
        }

        // Generate Human-Readable Order Number (LAB-YYYYMMDD-XXX)
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
        
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));
        
        const countToday = await prisma.labTestOrder.count({
            where: {
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });
        
        const sequence = countToday + 1;
        const newOrderNumber = `LAB-${dateStr}-${sequence.toString().padStart(3, '0')}`;

        const order = await (prisma.labTestOrder as any).create({
            data: {
                orderNumber: newOrderNumber,
                patientId: isWalkIn ? (input.patientId || null) : input.patientId,
                walkInName: isWalkIn ? ((input as any).walkInName || null) : null,
                walkInPhone: isWalkIn ? ((input as any).walkInPhone || null) : null,
                orderedById: orderer.id,
                orderedByRole: orderedByRoleValue,
                doctorId: doctorIdForOrder || null,
                testName: resolvedTestName,
                testCode: resolvedTestCode,
                testId: resolvedTestId,
                priority: input.priority,
                notes: input.notes,
                isWalkInLab: isWalkIn,
                visitType: (input.visitType as any) || 'OP',
                status: LabTestStatus.PAYMENT_PENDING,
            },
            include: {
                patient: { select: { firstName: true, lastName: true, uhid: true, gender: true, dateOfBirth: true, phone: true } },
                orderedBy: { select: { firstName: true, lastName: true, user: { select: { role: true } } } },
                doctor: { select: { firstName: true, lastName: true } },
                result: true,
            },
        });

        console.log("Created Lab Order:", order);
        return this.formatOrder(order as any);
    }

    async getOrders(query: LabOrderQueryInput): Promise<PaginatedResponse<LabOrderResponse>> {
        try {
            const { page = 1, limit = 10, patientId, status: statusQuery, priority, startDate, endDate } = query;
            const skip = (Number(page) - 1) * Number(limit);

            const where: any = {};
            if (patientId) where.patientId = patientId;
            
            if (statusQuery) {
                const upperStatus = statusQuery.toString().toUpperCase();
                // Map PENDING to PAYMENT_PENDING for backward compatibility
                if (upperStatus === 'PENDING' || upperStatus === 'PAYMENT_PENDING') {
                    where.status = LabTestStatus.PAYMENT_PENDING;
                } else {
                    // Safety check against valid enum values
                    where.status = Object.values(LabTestStatus).includes(upperStatus as any) 
                        ? (upperStatus as LabTestStatus) 
                        : { in: Object.values(LabTestStatus) };
                }
            } else {
                // RESILIENCE: By default, only fetch records that match current valid enum values
                // This prevents crashing if the database contains legacy strings like 'PENDING'
                where.status = { in: Object.values(LabTestStatus) };
            }

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
                        patient: { select: { uhid: true, firstName: true, lastName: true, phone: true, gender: true, dateOfBirth: true } },
                        orderedBy: { select: { firstName: true, lastName: true, user: { select: { role: true } } } },
                        doctor: { select: { firstName: true, lastName: true } },
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
                patient: { select: { uhid: true, firstName: true, lastName: true, phone: true, gender: true, dateOfBirth: true } },
                orderedBy: { select: { firstName: true, lastName: true, user: { select: { role: true } } } },
                doctor: { select: { firstName: true, lastName: true } },
                bill: true,
                result: true,
            },
        });

        if (!order) {
            throw new NotFoundError('Lab order not found');
        }

        return this.formatOrder(order as any);
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

            const { page = 1, limit = 10, status: statusQuery, priority, startDate, endDate } = query;
            const skip = (Number(page) - 1) * Number(limit);

            const where: any = { orderedById: staff.id };
            if (statusQuery) {
                const upperStatus = statusQuery.toString().toUpperCase();
                // Map PENDING to PAYMENT_PENDING for backward compatibility
                if (upperStatus === 'PENDING' || upperStatus === 'PAYMENT_PENDING') {
                    where.status = LabTestStatus.PAYMENT_PENDING;
                } else {
                    // Safety check against valid enum values
                    where.status = Object.values(LabTestStatus).includes(upperStatus as any) 
                        ? (upperStatus as LabTestStatus) 
                        : { in: Object.values(LabTestStatus) };
                }
            } else {
                // RESILIENCE: Only fetch records that match current valid enum values
                where.status = { in: Object.values(LabTestStatus) };
            }

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
                        orderedBy: { select: { firstName: true, lastName: true, user: { select: { role: true } } } },
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

            // Fallback: if order exists but test is null OR test has no categories/parameters,
            // try to resolve by testName/testCode to find the correct test with parameters
            const needsFallback = order && (
                !order.test ||
                !order.test.categories ||
                order.test.categories.length === 0 ||
                order.test.categories.every((c: any) => !c.parameters || c.parameters.length === 0)
            );

            if (needsFallback) {
                const resolvedTest = await (prisma.labTest as any).findFirst({
                    where: {
                        isActive: true,
                        categories: { some: { parameters: { some: {} } } },
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
                            testName: resolvedTest.name,
                            testCode: resolvedTest.code
                        }
                    });
                    (order as any).test = resolvedTest;
                    console.log(`[LabService] Auto-relinked order ${orderId} to test ${resolvedTest.code} (${resolvedTest.id})`);
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

            const patientName = order.patient 
                ? `${order.patient.firstName} ${order.patient.lastName}`
                : ((order as any).walkInName || 'Walk-in Patient');
            const patientGender = order.patient ? (order as any).patient.gender : null;
            const patientAgeStr = order.patient ? this.calculateAge(order.patient.dateOfBirth) : '0';
            const patientAgeNum = parseInt(patientAgeStr);

            // Helper to get correct reference range from JSON structure
            const getRange = (p: any) => {
                let finalRange = '';
                const range = p.referenceRange;
                
                if (!range || typeof range !== 'object') {
                    // Fallback to legacy fields
                    if (patientGender === 'MALE' && p.referenceRangeMale) finalRange = p.referenceRangeMale;
                    else if (patientGender === 'FEMALE' && p.referenceRangeFemale) finalRange = p.referenceRangeFemale;
                    else finalRange = p.normalRange || (p.normalMin !== null && p.normalMax !== null ? `${p.normalMin} - ${p.normalMax}` : '');
                } else {
                    // New JSON logic
                    if (patientGender === 'MALE' && range.male) finalRange = range.male;
                    else if (patientGender === 'FEMALE' && range.female) finalRange = range.female;
                    // Age based ranges (e.g. for Alkaline Phosphatase)
                    else if (range.ageBased && Array.isArray(range.ageBased)) {
                        // Keep current simplified logic bypassed
                    }
                    if (!finalRange && range.adults && patientAgeNum >= 18) finalRange = range.adults;
                    if (!finalRange && range.newborn && patientAgeNum < 1) finalRange = range.newborn;
                    if (!finalRange) finalRange = range.default || range.general || Object.values(range)[0] || '';
                }

                if (typeof finalRange !== 'string') finalRange = String(finalRange);
                return finalRange ? `${finalRange} ${p.unit || ''}`.trim() : '';
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
            const fallbackParams = (parameters || []).map((p: any) => ({
                id: p.id,
                name: p.parameterName,
                unit: p.unit || '',
                inputType: p.inputType || 'number',
                referenceRange: getRange(p),
                normalMin: p.normalMin,
                normalMax: p.normalMax
            }));

            // Return empty categories array when no params exist
            // The frontend will allow manual parameter entry
            return {
                orderId: order.id,
                patientName,
                patientGender,
                testName: order.testName,
                testType: testData?.type || 'PANEL',
                categories: fallbackParams.length > 0
                    ? [{ name: 'General', parameters: fallbackParams }]
                    : []
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

            // 2. Create individual LabResult entries for structured (catalog) parameters
            if (input.result.parameters && input.result.parameters.length > 0) {
                const catalogResults = input.result.parameters
                    .filter((p: any) => p.parameterId && !p.isManual)
                    .map((p: any) => ({
                        orderId: input.orderId,
                        parameterId: p.parameterId!,
                        resultValue: p.value,
                        flag: p.flag || 'NORMAL'
                    }));

                if (catalogResults.length > 0) {
                    await (tx as any).labResult.createMany({
                        data: catalogResults
                    });
                }

                // Manual parameters are already saved in the JSON result blob (step 1).
                // Log for visibility.
                const manualCount = input.result.parameters.filter((p: any) => p.isManual || !p.parameterId).length;
                if (manualCount > 0) {
                    console.log(`[LabService] Saved ${manualCount} manual parameter(s) for order ${input.orderId}`);
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
        });

        if (!order) {
            throw new NotFoundError('Lab order not found');
        }

        const validPaymentStatuses = [LabTestStatus.PAYMENT_PENDING.toString(), 'PENDING'];
        if (!validPaymentStatuses.includes(order.status as string)) {
            throw new ValidationError(`Cannot confirm payment for order in ${order.status} status`);
        }

        // ONLY update payment status and billingStatus — NO invoice/bill creation
        const updatedOrder = await (prisma.labTestOrder as any).update({
            where: { id },
            data: {
                status: LabTestStatus.READY_FOR_SAMPLE_COLLECTION,
                billingStatus: 'PENDING', // Will be set to BILLED when invoice is manually generated
            },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                orderedBy: { select: { firstName: true, lastName: true, user: { select: { role: true } } } },
                bill: true,
                result: true,
            },
        });

        return this.formatOrder(updatedOrder as any);
    }

    async updateOrderStatus(id: string, status: string): Promise<LabOrderResponse> {
        const upperStatus = status.toUpperCase();
        const mappedStatus = (upperStatus === 'PENDING' || upperStatus === 'PAYMENT_PENDING') 
            ? LabTestStatus.PAYMENT_PENDING 
            : upperStatus as any;

        const order = await prisma.labTestOrder.update({
            where: { id },
            data: { status: mappedStatus },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                orderedBy: { select: { firstName: true, lastName: true, user: { select: { role: true } } } },
                bill: true,
                result: true,
            },
        });
        return this.formatOrder(order as any);
    }

    private formatOrder(order: {
        id: string;
        orderNumber?: string | null;
        patientId: string;
        orderedById: string;
        orderedByRole?: string | null;
        doctorId?: string | null;
        testName: string;
        testCode: string | null;
        priority: string;
        status: string;
        notes: string | null;
        patient: { firstName: string; lastName: string };
        orderedBy: { firstName: string; lastName: string; user?: { role: string } };
        doctor?: { firstName: string; lastName: string } | null;
        test?: any | null;
        result?: {
            id: string;
            orderId: string;
            technicianId: string;
            result: unknown;
            interpretation: string | null;
            attachments: unknown;
            completedAt: Date;
        } | null;
        isWalkInLab: boolean;
        walkInName?: string | null;
        walkInPhone?: string | null;
        createdAt: Date;
    }): LabOrderResponse {
        return {
            id: order.id,
            orderNumber: order.orderNumber || null,
            patientId: order.patientId,
            orderedById: order.orderedById,
            orderedByRole: order.orderedByRole ?? null,
            doctorId: order.doctorId ?? null,
            testName: order.testName,
            testCode: order.testCode,
            priority: order.priority,
            status: order.status as LabOrderResponse['status'],
            notes: order.notes,
            patient: order.patient || { firstName: (order as any).walkInName || 'Walk-in', lastName: '' },
            orderedBy: order.orderedBy,
            doctor: order.doctor || null,
            test: order.test || null,
            result: order.result ? this.formatResult(order.result) : null,
            isWalkInLab: order.isWalkInLab || false,
            walkInName: (order as any).walkInName || null,
            walkInPhone: (order as any).walkInPhone || null,
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
            where: {
                code: { equals: normalizedCode, mode: 'insensitive' },
                isActive: true
            }
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
                        id: { not: id },
                        isActive: true
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
        const order = (await (prisma.labTestOrder as any).findUnique({
            where: { id: orderId },
            include: {
                patient: true,
                orderedBy: { include: { user: true } },
                doctor: true,
                result: true,
                labResults: {
                    include: {
                        parameter: true
                    }
                }
            }
        })) as any;

        if (!order || !order.result) {
            throw new NotFoundError('Lab order or results not found');
        }

        let doctorName = '';
        if (order.isWalkInLab) {
            doctorName = 'Reception (Walk-in Lab)';
        } else if (order.orderedByRole === 'DOCTOR' || order.orderedBy?.user?.role === 'DOCTOR') {
            doctorName = `Dr. ${order.orderedBy.firstName} ${order.orderedBy.lastName}`;
        } else if (order.orderedByRole === 'RECEPTIONIST' || order.orderedBy?.user?.role === 'RECEPTIONIST') {
            if (order.doctor) {
                doctorName = `Dr. ${order.doctor.firstName} ${order.doctor.lastName} (Ordered by Reception)`;
            } else {
                doctorName = `${order.orderedBy.firstName} ${order.orderedBy.lastName} (Receptionist)`;
            }
        } else {
            doctorName = `${order.orderedBy.firstName} ${order.orderedBy.lastName}`;
        }

        // Merge JSON result blob with catalog parameters to ensure reference ranges are present
        const resultBlob = order.result.result as any;
        const processedParameters = (resultBlob.parameters || []).map((p: any) => {
            // Find corresponding catalog parameter in results join
            const catalogMatch = order.labResults?.find((lr: any) => lr.parameterId === p.parameterId);
            
            // Reconstruct the reference range from catalog if missing or '-' in blob
            let referenceRange = p.referenceRange || p.normalRange || '-';
            
            if ((!referenceRange || referenceRange === '-') && catalogMatch?.parameter) {
                const param = catalogMatch.parameter;
                // Reuse logic from getOrderParameters if possible, but keep it simple here
                // Most catalog items have normalRange or referenceRange (JSON)
                referenceRange = param.normalRange || '';
                
                if (!referenceRange && param.referenceRange) {
                    const range = param.referenceRange as any;
                    const patientGender = order.patient.gender;
                    if (patientGender === 'MALE' && range.male) referenceRange = range.male;
                    else if (patientGender === 'FEMALE' && range.female) referenceRange = range.female;
                    else referenceRange = range.default || range.general || '';
                }

                if (referenceRange && param.unit) {
                    referenceRange = `${referenceRange} ${param.unit}`.trim();
                }
                
                if (!referenceRange) referenceRange = '-';
            }

            return {
                ...p,
                referenceRange: referenceRange
            };
        });

        const reportData = {
            orderId: order.id,
            patientName: `${order.patient.firstName} ${order.patient.lastName}`,
            patientId: order.patient.uhid,
            gender: order.patient.gender,
            age: this.calculateAge(order.patient.dateOfBirth),
            phone: order.patient.phone || 'N/A',
            doctorName,
            date: order.createdAt,
            results: {
                ...resultBlob,
                parameters: processedParameters
            },
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
