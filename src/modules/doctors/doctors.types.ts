import { z } from 'zod';

export const createMedicalRecordSchema = z.object({
    patientId: z.string().min(1, 'Patient ID is required'),
    diagnosis: z.string().min(1, 'Diagnosis is required'),
    treatment: z.string().optional(),
    treatmentNotes: z.string().optional(),
    notes: z.string().optional(),
    chiefComplaint: z.string().optional(),
    vitalSigns: z.object({
        bloodPressure: z.string().optional(),
        temperature: z.number().optional(),
        pulse: z.number().optional(),
        weight: z.number().optional(),
        height: z.number().optional(),
    }).optional(),
    prescriptions: z.array(z.object({
        medicineName: z.string(),
        dosage: z.string(),
        frequency: z.string(),
        duration: z.string(),
        instructions: z.string().optional(),
    })).optional(),
});

export const createPrescriptionSchema = z.object({
    patientId: z.string().min(1, 'Patient ID is required'),
    notes: z.string().optional(),
    medicines: z.array(z.object({
        medicineId: z.string().uuid().optional(),
        name: z.string().min(1),
        dosage: z.string().min(1),
        frequency: z.string().min(1),
        duration: z.string().min(1),
        instructions: z.string().optional(),
    })).min(1, 'At least one medicine is required'),
});

export type CreateMedicalRecordInput = z.infer<typeof createMedicalRecordSchema>;
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;

export interface MedicalRecordResponse {
    id: string;
    patientId: string;
    doctorId: string;
    diagnosis: string;
    treatment: string | null;
    notes: string | null;
    vitalSigns: Record<string, unknown> | null;
    prescriptions?: Array<{
        medicineName: string;
        dosage: string;
        frequency: string;
        duration: string;
        instructions?: string;
    }> | null;
    prescriptionStatus?: 'DISPENSED' | 'PENDING' | 'CANCELLED';
    dispensedAt?: string;
    patient: { firstName: string; lastName: string };
    doctor: { firstName: string; lastName: string };
    createdAt: Date;
}

export interface PrescriptionResponse {
    id: string;
    patientId: string;
    doctorId: string;
    notes: string | null;
    medicines: Array<{
        medicineId?: string;
        name: string;
        dosage: string;
        frequency: string;
        duration: string;
        instructions?: string;
    }>;
    patient: { firstName: string; lastName: string };
    doctor: { firstName: string; lastName: string };
    createdAt: Date;
}
