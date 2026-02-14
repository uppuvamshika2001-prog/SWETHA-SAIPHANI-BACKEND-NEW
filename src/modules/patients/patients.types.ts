import { z } from 'zod';
import { Gender } from '@prisma/client';

export const createPatientSchema = z.object({
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    uhid: z.string().optional(),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    dateOfBirth: z.string().transform((s) => new Date(s)),
    gender: z.nativeEnum(Gender),
    phone: z.string().min(10, 'Phone number is required'),
    address: z.string().optional(),
    emergencyContact: z.string().optional(),
    bloodGroup: z.string().optional(),
    allergies: z.string().optional(),
    // ID Proof Fields (validated but not persisted in current schema)
    idType: z.enum(['aadhaar', 'pan', 'passport']).optional(),
    idNumber: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.idType === 'pan' && data.idNumber) {
        // Strict PAN Validation: 5 Letters + 4 Digits + 1 Letter
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        if (!panRegex.test(data.idNumber)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F).",
                path: ["idNumber"]
            });
        }
    }
    if (data.idType === 'aadhaar' && data.idNumber) {
        if (!/^\d{12}$/.test(data.idNumber)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Invalid Aadhaar format. Must be exactly 12 digits.",
                path: ["idNumber"]
            });
        }
    }
    if (data.idType === 'passport' && data.idNumber) {
        if (!/^[a-zA-Z0-9]+$/.test(data.idNumber)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Special characters are not allowed in Passport number.",
                path: ["idNumber"]
            });
        } else if (data.idNumber.length > 8) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Passport number must be maximum 8 characters.",
                path: ["idNumber"]
            });
        }
    }
});

export const updatePatientSchema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().min(10).optional(),
    address: z.string().optional(),
    emergencyContact: z.string().optional(),
    bloodGroup: z.string().optional(),
    allergies: z.string().optional(),
});

export const patientQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().optional(),
    date: z.string().optional(), // YYYY-MM-DD
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientQueryInput = z.infer<typeof patientQuerySchema>;

export interface PatientResponse {
    id: string;
    uhid: string;
    userId: string | null;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    gender: Gender;
    phone: string;
    email: string | null;
    address: string | null;
    emergencyContact: string | null;
    bloodGroup: string | null;
    allergies: string | null;
    createdAt: Date;
    updatedAt: Date;
    // Login credentials (only returned on patient creation)
    passwordResetLink?: string;
    temporaryPassword?: string;
}
