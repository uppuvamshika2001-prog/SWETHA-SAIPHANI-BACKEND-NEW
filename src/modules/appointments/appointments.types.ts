import { z } from 'zod';
import { AppointmentStatus } from '@prisma/client';

export const createAppointmentSchema = z.object({
    patientId: z.string().min(1),
    doctorId: z.string().min(1),
    scheduledAt: z.string().transform((s) => new Date(s)),
    duration: z.number().int().positive().default(30),
    reason: z.string().optional(),
    notes: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
    scheduledAt: z.string().transform((s) => new Date(s)).optional(),
    duration: z.number().int().positive().optional(),
    status: z.nativeEnum(AppointmentStatus).optional(),
    reason: z.string().optional(),
    notes: z.string().optional(),
});

export const appointmentQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    patientId: z.string().optional(),
    doctorId: z.string().optional(),
    status: z.nativeEnum(AppointmentStatus).optional(),
    dateFrom: z.string().transform((s) => new Date(s)).optional(),
    dateTo: z.string().transform((s) => new Date(s)).optional(),
});

export const createPublicAppointmentSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(10),
    doctorId: z.string().min(1),
    scheduledAt: z.string().transform((s) => new Date(s)),
    paymentType: z.string().optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type CreatePublicAppointmentInput = z.infer<typeof createPublicAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type AppointmentQueryInput = z.infer<typeof appointmentQuerySchema>;

export interface AppointmentResponse {
    id: string;
    patientId: string;
    doctorId: string;
    scheduledAt: Date;
    duration: number;
    status: AppointmentStatus;
    reason: string | null;
    notes: string | null;
    patient: { firstName: string; lastName: string; phone: string };
    doctor: { firstName: string; lastName: string; specialization: string | null; department?: string | null };
    createdAt: Date;
    updatedAt: Date;
}
