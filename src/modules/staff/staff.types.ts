import { z } from 'zod';
import { UserRole, UserStatus } from '@prisma/client';

export const createStaffSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(), // Made optional - will be auto-generated
    role: z.enum([
        UserRole.ADMIN,
        UserRole.DOCTOR,
        UserRole.RECEPTIONIST,
        UserRole.PHARMACIST,
        UserRole.LAB_TECHNICIAN,
    ]),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    phone: z.string().optional(),
    specialization: z.string().optional(),
    department: z.string().optional(),
    licenseNo: z.string().optional(),
});

export const updateStaffSchema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().optional(),
    specialization: z.string().optional(),
    department: z.string().optional(),
    licenseNo: z.string().optional(),
    status: z.nativeEnum(UserStatus).optional(),
});

export const staffQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    role: z.enum([
        UserRole.ADMIN,
        UserRole.DOCTOR,
        UserRole.RECEPTIONIST,
        UserRole.PHARMACIST,
        UserRole.LAB_TECHNICIAN,
    ]).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    search: z.string().optional(),
    department: z.string().optional(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type StaffQueryInput = z.infer<typeof staffQuerySchema>;

export interface StaffResponse {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    specialization: string | null;
    department: string | null;
    licenseNo: string | null;
    status: UserStatus;
    email: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}

// Extended response with credentials for admin to share with new staff
export interface StaffCreateResponse extends StaffResponse {
    temporaryPassword: string;
    passwordResetLink: string;
}

