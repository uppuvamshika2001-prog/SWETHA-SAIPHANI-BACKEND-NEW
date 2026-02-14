import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../middleware/errorHandler.js';
import { UpdateUserInput, UserQueryInput, UserResponse, PaginatedResponse } from './users.types.js';

export class UsersService {
    async findById(id: string): Promise<UserResponse> {
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                staff: { select: { firstName: true, lastName: true, phone: true, specialization: true, department: true } },
                patient: { select: { firstName: true, lastName: true, phone: true } },
            },
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        return this.formatUser(user);
    }

    async findAll(query: UserQueryInput): Promise<PaginatedResponse<UserResponse>> {
        const { page, limit, role, status, search } = query;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {};
        if (role) where.role = role;
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { staff: { firstName: { contains: search, mode: 'insensitive' } } },
                { staff: { lastName: { contains: search, mode: 'insensitive' } } },
                { patient: { firstName: { contains: search, mode: 'insensitive' } } },
                { patient: { lastName: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    staff: { select: { firstName: true, lastName: true, phone: true, specialization: true, department: true } },
                    patient: { select: { firstName: true, lastName: true, phone: true } },
                },
            }),
            prisma.user.count({ where }),
        ]);

        return {
            items: users.map((u) => this.formatUser(u)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async update(id: string, input: UpdateUserInput): Promise<UserResponse> {
        // Separate user-level fields from staff-level fields
        const { firstName, lastName, department, phone, ...userFields } = input;

        // Update user table (email, role, status)
        const user = await prisma.user.update({
            where: { id },
            data: userFields,
            include: {
                staff: true,
                patient: true,
            },
        });

        // If the user has a staff record and we have staff-level fields to update
        if (user.staff && (firstName || lastName || department || phone)) {
            await prisma.staff.update({
                where: { userId: id },
                data: {
                    ...(firstName && { firstName }),
                    ...(lastName && { lastName }),
                    ...(department && { specialization: department, department }), // Map department to specialization AND department
                    ...(phone && { phone }),
                },
            });
        }

        // Re-fetch user with updated staff data
        return this.findById(id);
    }

    async findActiveDoctors() {
        return prisma.user.findMany({
            where: {
                role: 'DOCTOR',
                status: 'ACTIVE',
            },
            select: {
                id: true,
                email: true,
                staff: {
                    select: {
                        firstName: true,
                        lastName: true,
                        specialization: true,
                        department: true,
                        phone: true,
                    }
                }
            },
        });
    }

    async delete(id: string): Promise<void> {
        // First check if user exists
        const user = await prisma.user.findUnique({
            where: { id },
            include: { staff: true, patient: true }
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Delete related records first (cascade)
        if (user.staff) {
            await prisma.staff.delete({ where: { userId: id } });
        }
        if (user.patient) {
            await prisma.patient.delete({ where: { userId: id } });
        }

        // Delete refresh tokens
        await prisma.refreshToken.deleteMany({ where: { userId: id } });

        // Finally delete the user
        await prisma.user.delete({ where: { id } });
    }

    private formatUser(user: {
        id: string;
        email: string;
        role: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        staff?: { firstName: string; lastName: string; phone: string | null; specialization: string | null; department?: string | null } | null;
        patient?: { firstName: string; lastName: string; phone: string | null } | null;
    }): UserResponse {
        const profile = user.staff || user.patient;
        return {
            id: user.id,
            email: user.email,
            role: user.role as UserResponse['role'],
            status: user.status as UserResponse['status'],
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            profile: profile ? {
                firstName: profile.firstName,
                lastName: profile.lastName,
                phone: profile.phone,
                specialization: ('specialization' in profile) ? (profile as any).specialization : null,
                department: ('department' in profile) ? (profile as any).department : null,
            } : undefined,
        };
    }
}

export const usersService = new UsersService();
