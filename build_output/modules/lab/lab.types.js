import { z } from 'zod';
import { LabTestStatus } from '@prisma/client';
export { LabTestStatus };
export const createLabOrderSchema = z.object({
    patientId: z.string().optional(), // Optional for walk-in patients
    testId: z.string().optional(), // Strictly preferred
    testName: z.string().min(1, 'Test name is required'), // Still required for record, but should be synced from testId
    testCode: z.string().optional(),
    doctorId: z.string().optional(),
    priority: z.enum(['normal', 'urgent', 'stat']).default('normal'),
    notes: z.string().optional(),
    isWalkInLab: z.boolean().optional(),
    patientType: z.string().optional(), // Legacy support for frontend
    visitType: z.enum(['OP', 'WALK_IN']).optional().default('OP'),
    walkInName: z.string().optional(),
    walkInPhone: z.string().optional(),
    createdFromModule: z.string().optional(), // Frontend context (e.g. 'lab_billing')
});
export const createLabResultSchema = z.object({
    orderId: z.string().min(1),
    result: z.object({
        parameters: z.array(z.object({
            parameterId: z.string().optional(),
            name: z.string().min(1),
            value: z.string().min(1),
            unit: z.string().optional(),
            normalRange: z.string().optional(),
            referenceRange: z.string().optional(),
            flag: z.string().optional(),
        })),
    }),
    interpretation: z.string().optional(),
    attachments: z.array(z.string()).optional(),
    isReportVisibleToPatient: z.boolean().optional().default(true),
});
export const labOrderQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    patientId: z.string().optional(),
    status: z.nativeEnum(LabTestStatus).optional(),
    priority: z.enum(['normal', 'urgent', 'stat']).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
});
// Lab Test Management Schemas
export const createLabTestSchema = z.object({
    code: z.string().min(1, 'Test code is required'),
    name: z.string().min(1, 'Test name is required'),
    department: z.string().min(1, 'Department is required'),
    type: z.enum(['PANEL', 'SINGLE', 'REPORT']).optional().default('PANEL'),
    price: z.number().positive('Price must be positive'),
    turnaround: z.string().optional(),
    isActive: z.boolean().default(true),
});
export const updateLabTestSchema = createLabTestSchema.partial();
//# sourceMappingURL=lab.types.js.map