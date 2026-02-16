import { prisma } from '../../config/database.js';
import { hashPassword } from '../../utils/crypto.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../middleware/errorHandler.js';
import { CreatePatientInput, UpdatePatientInput, PatientQueryInput, PatientResponse } from './patients.types.js';
import { PaginatedResponse } from '../users/users.types.js';
import { UserRole } from '@prisma/client';
import { emailService } from '../../services/email.service.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';

export class PatientsService {
    async create(input: CreatePatientInput): Promise<PatientResponse> {
        // Validate Email Requirement
        if (!input.email) {
            throw new ConflictError('Email is required for patient registration');
        }

        // Check for existing User or Patient with this email
        const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
        if (existingUser) {
            throw new ConflictError('User with this email already exists');
        }

        // Generate temporary password using phone number (easy to remember)
        // Patient should change this on first login
        const tempPassword = input.phone;
        const passwordHash = await hashPassword(tempPassword);

        // Generate Password Reset Token
        const resetToken = jwt.sign(
            { email: input.email, type: 'reset' },
            config.jwt.accessSecret,
            { expiresIn: '24h' }
        );

        // Transaction: Create User + Patient
        const patient = await prisma.$transaction(async (tx) => {
            // 1. Create User
            const user = await tx.user.create({
                data: {
                    email: input.email!,
                    passwordHash,
                    role: UserRole.PATIENT,
                    status: 'ACTIVE',
                },
            });

            // 2. Check for existing orphan patient with this email OR phone
            const orphanCriteria: any[] = [];
            if (input.email) {
                orphanCriteria.push({ email: input.email });
            }
            if (input.phone) {
                orphanCriteria.push({ phone: input.phone });
            }
            const existingPatient = orphanCriteria.length > 0 ? await tx.patient.findFirst({
                where: {
                    OR: orphanCriteria,
                    userId: null
                }
            }) : null;

            if (existingPatient) {
                // Link new user to existing medical record
                return tx.patient.update({
                    where: { uhid: existingPatient.uhid as string },
                    data: { userId: user.id }
                });
            }

            // 3. Create Patient linked to User if no existing record
            const uhidToUse = input.uhid || `P-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const newPatient = await tx.patient.create({
                data: {
                    uhid: uhidToUse,
                    userId: user.id,
                    title: input.title,
                    firstName: input.firstName,
                    lastName: input.lastName,
                    dateOfBirth: input.dateOfBirth,
                    gender: input.gender,
                    phone: input.phone,
                    altPhone: input.altPhone,
                    email: input.email,
                    address: input.address,
                    state: input.state,
                    district: input.district,
                    mandal: input.mandal,
                    village: input.village,
                    pincode: input.pincode,
                    emergencyContact: input.emergencyContact,
                    emergencyName: input.emergencyName,
                    emergencyRelation: input.emergencyRelation,
                    bloodGroup: input.bloodGroup,
                    allergies: input.allergies,
                    idType: input.idType,
                    idNumber: input.idNumber,
                    referredBy: input.referredBy,
                    referredPerson: input.referredPerson,
                    consultingDoctor: input.consultingDoctor,
                    department: input.department,
                    paymentMode: input.paymentMode,
                    registrationFee: input.registrationFee,
                },
            });

            return newPatient;
        });

        // Generate password reset link
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
        const passwordResetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

        // 3. Send Welcome Email (Non-blocking)
        emailService.sendWelcomeEmail(
            patient.email!,
            `${patient.firstName} ${patient.lastName}`,
            patient.uhid || 'Pending',
            resetToken
        ).catch(err => console.error('Failed to send welcome email:', err));

        // Return patient data with login credentials for receptionist to share
        const response = this.formatPatient(patient as any);
        return {
            ...response,
            temporaryPassword: tempPassword,
            passwordResetLink: passwordResetLink
        };
    }

    async findById(uhid: string): Promise<PatientResponse> {
        const patient = await prisma.patient.findUnique({
            where: { uhid }
        });

        if (!patient) {
            throw new NotFoundError('Patient not found');
        }
        return this.formatPatient(patient as any);
    }

    async findByUserId(userId: string): Promise<PatientResponse> {
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        // First, check if user already has a linked patient
        let patient = await prisma.patient.findUnique({ where: { userId } });

        // Proactive Smart Linking for orphan records ONLY:
        // If no patient is linked, try to find orphan records matching user's email
        if (!patient && user.email) {
            const orphan = await prisma.patient.findFirst({
                where: {
                    email: user.email,
                    userId: null
                }
            });

            if (orphan) {
                console.log(`[Proactive Linking] Linking orphan ${orphan.uhid} to user ${user.email}`);
                patient = await prisma.patient.update({
                    where: { uhid: orphan.uhid as string },
                    data: { userId: user.id }
                });
            }
        }

        if (!patient) {
            throw new NotFoundError('Patient profile not found. Please contact reception to register.');
        }

        console.log(`[findByUserId] User ${userId} (${user.email}) => Patient ${patient.uhid}`);

        return this.formatPatient(patient as any);
    }

    async findAll(query: PatientQueryInput): Promise<PaginatedResponse<PatientResponse>> {
        const { page, limit, search, date } = query;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {};

        // Date Filtering
        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            where.registrationDate = {
                gte: startOfDay,
                lte: endOfDay
            };
        }


        if (search) {
            const searchTerms = search.trim().split(/\s+/);

            if (searchTerms.length > 1) {
                // Multi-word search: Each term must match at least one field
                // This allows searching "John Doe" (John matches First, Doe matches Last)
                where.AND = searchTerms.map(term => ({
                    OR: [
                        { firstName: { contains: term, mode: 'insensitive' } },
                        { lastName: { contains: term, mode: 'insensitive' } },
                        { phone: { contains: term } },
                        { email: { contains: term, mode: 'insensitive' } },
                        { uhid: { contains: term, mode: 'insensitive' } },
                    ]
                }));
            } else {
                // Single term search
                where.OR = [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { uhid: { contains: search, mode: 'insensitive' } },
                ];
            }
        }

        const [patients, total] = await Promise.all([
            prisma.patient.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.patient.count({ where }),
        ]);

        return {
            items: patients.map((p) => this.formatPatient(p as any)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async update(uhid: string, input: UpdatePatientInput, requesterId: string, requesterRole: UserRole): Promise<PatientResponse> {
        const patient = await prisma.patient.findUnique({ where: { uhid } });
        if (!patient) {
            throw new NotFoundError('Patient not found');
        }

        // Patients can only update their own profile
        if (requesterRole === UserRole.PATIENT && patient.userId !== requesterId) {
            throw new ForbiddenError('Cannot update another patient\'s profile');
        }

        const updated = await prisma.patient.update({
            where: { uhid },
            data: input,
        });

        return this.formatPatient(updated as any);
    }

    async delete(uhid: string): Promise<void> {
        const patient = await prisma.patient.findUnique({ where: { uhid } });
        if (!patient) {
            throw new NotFoundError('Patient not found');
        }

        // Use transaction to ensure both are deleted
        await prisma.$transaction(async (tx) => {
            // If the patient is linked to a user, delete the user (this should cascade to patient via onDelete: Cascade in schema, 
            // but let's be explicit if needed, though schema says user has patient and patient has user link. 
            // In schema: user.patient has no onDelete specified, but RefreshToken and Staff have onDelete: Cascade.
            // Patient has user link: user User? @relation(fields: [userId], references: [id])
            // Actually, deleting the patient record first is safer if we want to preserve the User (which we usually don't for patients).
            // Let's delete the patient. Relations like Bill, Prescription, etc. have onDelete: Cascade for Patient.

            await tx.patient.delete({ where: { uhid } });

            if (patient.userId) {
                // If they have a user account, remove it too as it's specific to this patient
                await tx.user.delete({ where: { id: patient.userId } });
            }
        });
    }

    private async getLinkedPatients(startingPatient: { uhid: string, phone: string, email: string | null }): Promise<any[]> {
        // Pass 1: Find all profiles sharing starting patient's phone OR email
        const whereClause: any[] = [{ phone: startingPatient.phone }];
        if (startingPatient.email) {
            whereClause.push({ email: startingPatient.email });
        }

        const pass1 = await prisma.patient.findMany({
            where: { OR: whereClause },
            select: { uhid: true, phone: true, email: true, createdAt: true, userId: true, firstName: true, lastName: true, dateOfBirth: true, gender: true, address: true, emergencyContact: true, bloodGroup: true, allergies: true, updatedAt: true }
        });

        // Pass 2: Collect all phones and emails from Pass 1 results and find everyone sharing ANY of them
        const phones = new Set<string>();
        const emails = new Set<string>();

        pass1.forEach(p => {
            if (p.phone) phones.add(p.phone);
            if (p.email) emails.add(p.email);
        });

        const finalCriteria: any[] = [];
        phones.forEach(p => finalCriteria.push({ phone: p }));
        emails.forEach(e => finalCriteria.push({ email: e }));

        if (finalCriteria.length === 0) return [startingPatient];

        const finalResults = await prisma.patient.findMany({
            where: { OR: finalCriteria },
            orderBy: { createdAt: 'asc' }
        });

        return finalResults;
    }

    private async getLinkedPatientIds(startingPatient: { uhid: string, phone: string, email: string | null }): Promise<string[]> {
        const linked = await this.getLinkedPatients(startingPatient);
        const allIds = Array.from(new Set(linked.map(p => p.uhid as string)));
        console.log(`[Smart Linking] Patient ${startingPatient.uhid} linked to profiles: ${allIds.join(', ')}`);
        return allIds;
    }

    /**
     * Resolves a patient by UHID and returns all linked UHIDs
     */
    private async resolvePatientIds(uhid: string): Promise<string[]> {
        const patient = await prisma.patient.findUnique({
            where: { uhid }
        });

        if (!patient) return [uhid];
        return this.getLinkedPatientIds(patient as any);
    }

    async getPrescriptions(patientId: string) {
        const patientIds = await this.resolvePatientIds(patientId);

        const [standalonePrescriptions, medicalRecords] = await Promise.all([
            prisma.prescription.findMany({
                where: { patientId: { in: patientIds } },
                include: {
                    doctor: { select: { firstName: true, lastName: true, specialization: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.medicalRecord.findMany({
                where: { patientId: { in: patientIds } },
                include: {
                    doctor: { select: { firstName: true, lastName: true, specialization: true } },
                },
                orderBy: { createdAt: 'desc' },
            })
        ]);

        // Transform MedicalRecords into compatible Prescription items
        const mrPrescriptions = medicalRecords
            .filter(mr => {
                const px = (mr.prescriptions as any[]) || [];
                const vitalsPx = ((mr.vitalSigns as any)?.prescriptions as any[]) || [];
                return px.length > 0 || vitalsPx.length > 0;
            })
            .map(mr => {
                const rawPx = (mr.prescriptions as any[]) || ((mr.vitalSigns as any)?.prescriptions as any[]) || [];
                // Ensure medicines have consistent field names (name vs medicineName)
                const medicines = rawPx.map(med => ({
                    ...med,
                    name: med.name || med.medicineName || 'Prescribed Medicine'
                }));

                return {
                    id: mr.id,
                    patientId: mr.patientId,
                    doctorId: mr.doctorId,
                    notes: mr.notes || mr.diagnosis,
                    medicines,
                    doctor: mr.doctor,
                    createdAt: mr.createdAt,
                    updatedAt: mr.updatedAt,
                    isMedicalRecord: true
                };
            });

        // Combine and sort by date
        const all = [...standalonePrescriptions, ...mrPrescriptions];
        return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    async getBills(patientId: string) {
        const patientIds = await this.resolvePatientIds(patientId);

        const bills = await prisma.bill.findMany({
            where: { patientId: { in: patientIds as string[] } },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
        });

        // Attach Medical Record Info manually (similar to BillingService)
        const billsWithMR = await Promise.all(bills.map(async (bill) => {
            const medicalRecord = await prisma.medicalRecord.findFirst({
                where: { patientId: bill.patientId },
                orderBy: { createdAt: 'desc' }
            });

            return {
                ...bill,
                medicalRecord: medicalRecord ? {
                    diagnosis: medicalRecord.diagnosis,
                    treatment: medicalRecord.treatment,
                    notes: medicalRecord.notes
                } : undefined
            };
        }));

        return billsWithMR;
    }

    async getLabResults(patientId: string) {
        const patientIds = await this.resolvePatientIds(patientId);

        return prisma.labTestOrder.findMany({
            where: { patientId: { in: patientIds } },
            include: { result: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    private formatPatient(patient: {
        uhid: string;
        userId: string | null;
        title: string | null;
        firstName: string;
        lastName: string;
        dateOfBirth: Date;
        gender: string;
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
        registrationFee: any;
        createdAt: Date;
        updatedAt: Date;
    }): PatientResponse {
        return {
            id: patient.uhid,
            uhid: patient.uhid,
            userId: patient.userId,
            title: patient.title,
            firstName: patient.firstName,
            lastName: patient.lastName,
            dateOfBirth: patient.dateOfBirth,
            gender: patient.gender as PatientResponse['gender'],
            phone: patient.phone,
            altPhone: patient.altPhone,
            email: patient.email,
            address: patient.address,
            state: patient.state,
            district: patient.district,
            mandal: patient.mandal,
            village: patient.village,
            pincode: patient.pincode,
            emergencyContact: patient.emergencyContact,
            emergencyName: patient.emergencyName,
            emergencyRelation: patient.emergencyRelation,
            bloodGroup: patient.bloodGroup,
            allergies: patient.allergies,
            idType: patient.idType,
            idNumber: patient.idNumber,
            referredBy: patient.referredBy,
            referredPerson: patient.referredPerson,
            consultingDoctor: patient.consultingDoctor,
            department: patient.department,
            paymentMode: patient.paymentMode,
            registrationFee: patient.registrationFee ? Number(patient.registrationFee) : null,
            createdAt: patient.createdAt,
            updatedAt: patient.updatedAt,
        };
    }
}

export const patientsService = new PatientsService();
