import { prisma } from '../../config/database.js';
import { hashPassword } from '../../utils/crypto.js';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler.js';
import { CreateStaffInput, UpdateStaffInput, StaffQueryInput, StaffResponse, StaffCreateResponse } from './staff.types.js';
import { PaginatedResponse } from '../users/users.types.js';
import { emailService } from '../../services/email.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import crypto from 'crypto';

export class StaffService {
    async create(input: CreateStaffInput): Promise<StaffCreateResponse> {
        // Check if email exists
        const existing = await prisma.user.findUnique({ where: { email: input.email } });
        if (existing) {
            throw new ConflictError('Email already exists');
        }

        // Generate temporary password using phone number (easy to remember) or random string
        // Staff should change this on first login
        const tempPassword = input.phone || `Staff${crypto.randomBytes(4).toString('hex')}`;
        const passwordHash = await hashPassword(tempPassword);

        // Generate Password Reset Token
        const resetToken = jwt.sign(
            { email: input.email, type: 'reset' },
            config.jwt.accessSecret,
            { expiresIn: '24h' }
        );

        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: input.email,
                    passwordHash,
                    role: input.role,
                    status: 'ACTIVE',
                },
            });

            const staff = await tx.staff.create({
                data: {
                    userId: user.id,
                    firstName: input.firstName,
                    lastName: input.lastName,
                    phone: input.phone,
                    specialization: input.specialization,
                    department: input.department,
                    licenseNo: input.licenseNo,
                },
                include: { user: true },
            });

            return staff;
        });

        // Generate password reset link
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
        const passwordResetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

        // Send Welcome Email (Non-blocking)
        emailService.sendStaffWelcomeEmail(
            input.email,
            `${input.firstName} ${input.lastName}`,
            input.role,
            resetToken
        ).catch(err => console.error('Failed to send staff welcome email:', err));

        // Return staff data with login credentials for admin to share
        const response = this.formatStaff(result);
        return {
            ...response,
            temporaryPassword: tempPassword,
            passwordResetLink: passwordResetLink
        };
    }

    async findById(id: string): Promise<StaffResponse> {
        const staff = await prisma.staff.findUnique({
            where: { id },
            include: { user: true },
        });

        if (!staff) {
            throw new NotFoundError('Staff not found');
        }

        return this.formatStaff(staff);
    }

    async findAll(query: StaffQueryInput): Promise<PaginatedResponse<StaffResponse>> {
        const { page, limit, role, status, search, department } = query;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {};
        if (status) where.status = status;
        if (department) where.department = department;
        if (role) where.user = { role };
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [staff, total] = await Promise.all([
            prisma.staff.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { user: true },
            }),
            prisma.staff.count({ where }),
        ]);

        return {
            items: staff.map((s) => this.formatStaff(s)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async update(id: string, input: UpdateStaffInput): Promise<StaffResponse> {
        const existing = await prisma.staff.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundError('Staff not found');
        }

        const { status, ...staffData } = input;

        const staff = await prisma.$transaction(async (tx) => {
            if (status) {
                await tx.user.update({
                    where: { id: existing.userId },
                    data: { status },
                });
                await tx.staff.update({
                    where: { id },
                    data: { status },
                });
            }

            return tx.staff.update({
                where: { id },
                data: staffData,
                include: { user: true },
            });
        });

        return this.formatStaff(staff);
    }

    async disable(id: string): Promise<void> {
        const existing = await prisma.staff.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundError('Staff not found');
        }

        await prisma.$transaction([
            prisma.user.update({
                where: { id: existing.userId },
                data: { status: 'DISABLED' },
            }),
            prisma.staff.update({
                where: { id },
                data: { status: 'DISABLED' },
            }),
        ]);
    }

    private formatStaff(staff: {
        id: string;
        userId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        specialization: string | null;
        department: string | null;
        licenseNo: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        user: { email: string; role: string };
    }): StaffResponse {
        return {
            id: staff.id,
            userId: staff.userId,
            firstName: staff.firstName,
            lastName: staff.lastName,
            phone: staff.phone,
            specialization: staff.specialization,
            department: staff.department,
            licenseNo: staff.licenseNo,
            status: staff.status as StaffResponse['status'],
            email: staff.user.email,
            role: staff.user.role as StaffResponse['role'],
            createdAt: staff.createdAt,
            updatedAt: staff.updatedAt,
        };
    }
}

export const staffService = new StaffService();
