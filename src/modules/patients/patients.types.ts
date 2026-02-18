import { z } from 'zod';
import { Gender } from '@prisma/client';

export const createPatientSchema = z.object({
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    uhid: z.string().optional(),
    title: z.string().optional(),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    dateOfBirth: z.string().transform((s) => new Date(s)),
    gender: z.nativeEnum(Gender),
    phone: z.string().min(10, 'Phone number is required'),
    altPhone: z.string().optional(),
    address: z.string().optional(),
    state: z.string().optional(),
    district: z.string().optional(),
    mandal: z.string().optional(),
    village: z.string().optional(),
    pincode: z.string().optional(),
    emergencyContact: z.string().optional(),
    emergencyName: z.string().optional(),
    emergencyRelation: z.string().optional(),
    bloodGroup: z.string().optional(),
    allergies: z.string().optional(),
    // ID Proof Fields
    idType: z.enum(['aadhaar', 'pan', 'passport']).optional(),
    idNumber: z.string().optional(),
    // Referral & Doctor
    referredBy: z.string().optional(),
    referredPerson: z.string().optional(),
    consultingDoctor: z.string().optional(),
    department: z.string().optional(),
    // Payment
    paymentMode: z.string().optional(),
    registrationFee: z.union([z.string(), z.number()]).optional().transform(v => v ? Number(v) : undefined),
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
    title: z.string().optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().min(10).optional(),
    altPhone: z.string().optional(),
    address: z.string().optional(),
    state: z.string().optional(),
    district: z.string().optional(),
    mandal: z.string().optional(),
    village: z.string().optional(),
    pincode: z.string().optional(),
    emergencyContact: z.string().optional(),
    emergencyName: z.string().optional(),
    emergencyRelation: z.string().optional(),
    bloodGroup: z.string().optional(),
    allergies: z.string().optional(),
    idType: z.string().optional(),
    idNumber: z.string().optional(),
    referredBy: z.string().optional(),
    referredPerson: z.string().optional(),
    consultingDoctor: z.string().optional(),
    department: z.string().optional(),
    paymentMode: z.string().optional(),
    registrationFee: z.union([z.string(), z.number()]).optional().transform(v => v ? Number(v) : undefined),
});

export const patientQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().optional(),
    date: z.string().optional(), // YYYY-MM-DD
    startDate: z.string().optional(),
    endDate: z.string().optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientQueryInput = z.infer<typeof patientQuerySchema>;

export interface PatientResponse {
    id: string;
    uhid: string;
    userId: string | null;
    title: string | null;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    gender: Gender;
    phone: string;
    altPhone: string | null;
    email: string | null;
    address: string | null;
    state: string | null;
    district: string | null;
    mandal: string | null;
    village: string | null;
    pincode: string | null;
    emergencyContact: string | null;
    emergencyName: string | null;
    emergencyRelation: string | null;
    bloodGroup: string | null;
    allergies: string | null;
    idType: string | null;
    idNumber: string | null;
    referredBy: string | null;
    referredPerson: string | null;
    consultingDoctor: string | null;
    department: string | null;
    paymentMode: string | null;
    registrationFee: number | null;
    createdAt: Date;
    updatedAt: Date;
    // Login credentials (only returned on patient creation)
    passwordResetLink?: string;
    temporaryPassword?: string;
}
