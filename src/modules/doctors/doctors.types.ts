import { z } from 'zod';

export const createMedicalRecordSchema = z.object({
    patientId: z.string().min(1, 'Patient ID is required'),
    appointmentId: z.string().optional(),
    chiefComplaint: z.string().optional(),
    diagnosis: z.string().min(1, 'Diagnosis is required'),
    icdCode: z.string().optional(),
    treatment: z.string().optional(),
    treatmentNotes: z.string().optional(),
    notes: z.string().optional(),
    followUpDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
    vitalSigns: z.object({
        bloodPressureSystolic: z.number().optional(),
        bloodPressureDiastolic: z.number().optional(),
        heartRate: z.number().optional(),
        temperature: z.number().optional(),
        respiratoryRate: z.number().optional(),
        oxygenSaturation: z.number().optional(),
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
    labOrders: z.array(z.string()).optional(),
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
    appointmentId: string | null;
    chiefComplaint: string | null;
    diagnosis: string;
    icdCode: string | null;
    treatment: string | null;
    treatmentNotes: string | null;
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
    followUpDate: Date | null;
    labOrders?: string[];
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
