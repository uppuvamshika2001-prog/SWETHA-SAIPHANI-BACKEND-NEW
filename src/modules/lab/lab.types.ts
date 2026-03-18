import { z } from 'zod';

// Enum for Lab Test Status (mirroring Prisma schema)
export type LabTestStatus = 'ORDERED' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'PAYMENT_PENDING' | 'READY_FOR_SAMPLE_COLLECTION';

export const LabTestStatus = {
    ORDERED: 'ORDERED',
    SAMPLE_COLLECTED: 'SAMPLE_COLLECTED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    PAYMENT_PENDING: 'PAYMENT_PENDING',
    READY_FOR_SAMPLE_COLLECTION: 'READY_FOR_SAMPLE_COLLECTION'
} as const;

export const createLabOrderSchema = z.object({
    patientId: z.string().min(1),
    testId: z.string().optional(), // Strictly preferred
    testName: z.string().min(1, 'Test name is required'), // Still required for record, but should be synced from testId
    testCode: z.string().optional(),
    doctorId: z.string().optional(),
    priority: z.enum(['normal', 'urgent', 'stat']).default('normal'),
    notes: z.string().optional(),
    isWalkInLab: z.boolean().optional().default(false),
    visitId: z.string().optional(),
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
    status: z.enum(['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PAYMENT_PENDING', 'READY_FOR_SAMPLE_COLLECTION']).optional(),
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

export type CreateLabOrderInput = z.infer<typeof createLabOrderSchema>;
export type CreateLabResultInput = z.infer<typeof createLabResultSchema>;
export type LabOrderQueryInput = z.infer<typeof labOrderQuerySchema>;
export type CreateLabTestInput = z.infer<typeof createLabTestSchema>;
export type UpdateLabTestInput = z.infer<typeof updateLabTestSchema>;

export interface LabOrderResponse {
    id: string;
    patientId: string;
    orderedById: string;
    orderedByRole: string | null;
    doctorId: string | null;
    testName: string;
    testCode: string | null;
    priority: string;
    status: LabTestStatus;
    notes: string | null;
    isWalkInLab: boolean;
    visitId: string | null;
    patient: { firstName: string; lastName: string };
    orderedBy: { firstName: string; lastName: string; user?: { role: string } };
    doctor?: { firstName: string; lastName: string } | null;
    test?: any | null;
    result?: LabResultResponse | null;
    createdAt: Date;
}

export interface LabResultResponse {
    id: string;
    orderId: string;
    technicianId: string;
    result: {
        parameters: Array<{
            parameterId?: string;
            name: string;
            value: string;
            unit?: string;
            normalRange?: string;
            flag?: string;
        }>;
    };
    interpretation: string | null;
    attachments: string[] | null;
    completedAt: Date;
}
