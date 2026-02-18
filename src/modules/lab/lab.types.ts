import { z } from 'zod';
import { LabTestStatus } from '@prisma/client';

export const createLabOrderSchema = z.object({
    patientId: z.string().min(1),
    testName: z.string().min(1, 'Test name is required'),
    testCode: z.string().optional(),
    priority: z.enum(['normal', 'urgent', 'stat']).default('normal'),
    notes: z.string().optional(),
});

export const createLabResultSchema = z.object({
    orderId: z.string().min(1),
    result: z.object({
        parameters: z.array(z.object({
            name: z.string().min(1),
            value: z.string().min(1),
            unit: z.string().optional(),
            normalRange: z.string().optional(),
        })),
    }),
    interpretation: z.string().optional(),
    attachments: z.array(z.string()).optional(),
});

export const labOrderQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    patientId: z.string().optional(),
    status: z.nativeEnum(LabTestStatus).optional(),
    priority: z.enum(['normal', 'urgent', 'stat']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
});

// Lab Test Management Schemas
export const createLabTestSchema = z.object({
    code: z.string().min(1, 'Test code is required'),
    name: z.string().min(1, 'Test name is required'),
    department: z.string().min(1, 'Department is required'),
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
    testName: string;
    testCode: string | null;
    priority: string;
    status: LabTestStatus;
    notes: string | null;
    patient: { firstName: string; lastName: string };
    orderedBy: { firstName: string; lastName: string };
    result?: LabResultResponse | null;
    createdAt: Date;
}

export interface LabResultResponse {
    id: string;
    orderId: string;
    technicianId: string;
    result: {
        parameters: Array<{
            name: string;
            value: string;
            unit?: string;
            normalRange?: string;
        }>;
    };
    interpretation: string | null;
    attachments: string[] | null;
    completedAt: Date;
}
