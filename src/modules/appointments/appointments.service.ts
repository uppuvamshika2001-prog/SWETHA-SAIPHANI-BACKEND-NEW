import { prisma } from '../../config/database.js';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler.js';
import { CreateAppointmentInput, UpdateAppointmentInput, AppointmentQueryInput, AppointmentResponse, CreatePublicAppointmentInput } from './appointments.types.js';
import { PaginatedResponse } from '../users/users.types.js';

export class AppointmentsService {
    async create(input: CreateAppointmentInput): Promise<AppointmentResponse> {
        // Validate patient exists
        const patient = await prisma.patient.findUnique({ where: { uhid: input.patientId } });
        if (!patient) {
            throw new NotFoundError('Patient not found');
        }

        // Validate doctor exists and is a doctor
        const doctor = await prisma.staff.findUnique({
            where: { userId: input.doctorId },
            include: { user: true },
        });
        if (!doctor || doctor.user.role !== 'DOCTOR') {
            throw new NotFoundError('Doctor not found');
        }

        const staffId = doctor.id;

        // Check for overlapping appointments
        const endTime = new Date(input.scheduledAt.getTime() + input.duration * 60000);
        const overlapping = await prisma.appointment.findFirst({
            where: {
                doctorId: staffId,
                status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
                OR: [
                    {
                        AND: [
                            { scheduledAt: { lte: input.scheduledAt } },
                            // Since we don't have an 'endTime' column, we'll assume a fixed duration or calculate it.
                            // But Prisma doesn't support easy time addition in 'where'.
                            // However, we can check if any existing appointment's start + its duration (default 30) overflows new start.
                            // For simplicity, we'll check if any appointment starts within 30 mins before this one.
                            { scheduledAt: { gt: new Date(input.scheduledAt.getTime() - 30 * 60000) } }
                        ]
                    },
                    {
                        scheduledAt: {
                            gte: input.scheduledAt,
                            lt: endTime
                        }
                    }
                ],
            },
        });

        if (overlapping) {
            throw new ValidationError('Doctor has an overlapping appointment at this time');
        }

        const appointment = await prisma.appointment.create({
            data: {
                ...input,
                doctorId: staffId,
            },
            include: {
                patient: { select: { firstName: true, lastName: true, phone: true } },
                doctor: { select: { firstName: true, lastName: true, specialization: true, department: true } },
            },
        });

        return this.formatAppointment(appointment);
    }

    async createPublic(input: CreatePublicAppointmentInput): Promise<AppointmentResponse> {
        const { firstName, lastName, email, phone, doctorId, scheduledAt, paymentType } = input;

        // 1. Find or Create Patient by Phone
        let patient = await prisma.patient.findFirst({
            where: { phone }
        });

        if (!patient) {
            // Create a new User and Patient for this guest
            const tempPassword = Math.random().toString(36).slice(-8);

            // Should verify email uniqueness first, but for guest flow we assume success or fail
            const user = await prisma.user.create({
                data: {
                    email,
                    passwordHash: tempPassword,
                    role: 'PATIENT',
                    status: 'ACTIVE',
                    patient: {
                        create: {
                            firstName,
                            lastName,
                            phone,
                            dateOfBirth: new Date(),
                            gender: 'OTHER',
                            uhid: `P${Date.now()}`,
                        }
                    }
                },
                include: { patient: true }
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            patient = (user as any).patient!;
        }

        // 2. Validate Doctor
        const doctor = await prisma.staff.findUnique({
            where: { userId: doctorId },
            include: { user: true },
        });

        if (!doctor || doctor.user.role !== 'DOCTOR') {
            throw new NotFoundError('Doctor not found');
        }

        // 3. Create Appointment
        const notes = `Payment Type: ${paymentType}`;

        const appointment = await prisma.appointment.create({
            data: {
                patientId: (patient as any).uhid,
                doctorId: doctor.id,
                scheduledAt: new Date(scheduledAt),
                duration: 30, // Default duration
                // @ts-ignore - PENDING status might be missing in generated client
                status: 'PENDING',
                notes: notes,
                reason: 'Public Booking',
            },
            include: {
                patient: { select: { firstName: true, lastName: true, phone: true } },
                doctor: { select: { firstName: true, lastName: true, specialization: true, department: true } },
            },
        });

        return this.formatAppointment(appointment);
    }

    async findPublicById(id: string): Promise<AppointmentResponse> {
        const appointment = await prisma.appointment.findUnique({
            where: { id },
            include: {
                patient: { select: { firstName: true, lastName: true, phone: true, email: true } }, // Added email
                doctor: { select: { firstName: true, lastName: true, specialization: true, department: true } },
            },
        });

        if (!appointment) {
            throw new NotFoundError('Appointment not found');
        }

        return this.formatAppointment(appointment);
    }

    async findById(id: string): Promise<AppointmentResponse> {
        const appointment = await prisma.appointment.findUnique({
            where: { id },
            include: {
                patient: { select: { firstName: true, lastName: true, phone: true } },
                doctor: { select: { firstName: true, lastName: true, specialization: true, department: true } },
            },
        });

        if (!appointment) {
            throw new NotFoundError('Appointment not found');
        }

        return this.formatAppointment(appointment);
    }

    async findAll(query: AppointmentQueryInput): Promise<PaginatedResponse<AppointmentResponse>> {
        const { page, limit, patientId, doctorId, status, dateFrom, dateTo } = query;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {};
        if (patientId) where.patientId = patientId;
        if (doctorId) where.doctorId = doctorId;
        if (status) where.status = status;
        if (dateFrom || dateTo) {
            where.scheduledAt = {};
            if (dateFrom) (where.scheduledAt as Record<string, unknown>).gte = dateFrom;
            if (dateTo) (where.scheduledAt as Record<string, unknown>).lte = dateTo;
        }

        const [appointments, total] = await Promise.all([
            prisma.appointment.findMany({
                where,
                skip,
                take: limit,
                orderBy: { scheduledAt: 'desc' },
                include: {
                    patient: { select: { firstName: true, lastName: true, phone: true } },
                    doctor: { select: { firstName: true, lastName: true, specialization: true, department: true } },
                },
            }),
            prisma.appointment.count({ where }),
        ]);

        return {
            items: appointments.map((a) => this.formatAppointment(a)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async update(id: string, input: UpdateAppointmentInput): Promise<AppointmentResponse> {
        const existing = await prisma.appointment.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundError('Appointment not found');
        }

        const appointment = await prisma.appointment.update({
            where: { id },
            data: input,
            include: {
                patient: { select: { firstName: true, lastName: true, phone: true } },
                doctor: { select: { firstName: true, lastName: true, specialization: true, department: true } },
            },
        });

        return this.formatAppointment(appointment);
    }

    async cancel(id: string): Promise<void> {
        const existing = await prisma.appointment.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundError('Appointment not found');
        }

        await prisma.appointment.update({
            where: { id },
            data: { status: 'CANCELLED' },
        });
    }

    async delete(id: string): Promise<void> {
        console.log('[AppointmentsService] Attempting to delete appointment with id:', id);
        // Using findFirst instead of findUnique for resilience
        const existing = await prisma.appointment.findFirst({ where: { id } });
        if (!existing) {
            console.error('[AppointmentsService] Delete failed - Appointment not found for id:', id);
            throw new NotFoundError('Appointment');
        }

        await prisma.appointment.delete({
            where: { id },
        });
        console.log('[AppointmentsService] Appointment deleted successfully:', id);
    }

    private formatAppointment(appointment: {
        id: string;
        patientId: string;
        doctorId: string;
        scheduledAt: Date;
        duration: number;
        status: string;
        reason: string | null;
        notes: string | null;
        patient: { firstName: string; lastName: string; phone: string };
        doctor: { firstName: string; lastName: string; specialization: string | null; department?: string | null };
        createdAt: Date;
        updatedAt: Date;
    }): AppointmentResponse {
        return {
            id: appointment.id,
            patientId: appointment.patientId,
            doctorId: appointment.doctorId,
            scheduledAt: appointment.scheduledAt,
            duration: appointment.duration,
            status: appointment.status as AppointmentResponse['status'],
            reason: appointment.reason,
            notes: appointment.notes,
            patient: appointment.patient,
            doctor: {
                firstName: appointment.doctor.firstName,
                lastName: appointment.doctor.lastName,
                specialization: appointment.doctor.specialization,
                department: appointment.doctor.department || appointment.doctor.specialization || 'General',
            },
            createdAt: appointment.createdAt,
            updatedAt: appointment.updatedAt,
        };
    }
}

export const appointmentsService = new AppointmentsService();
