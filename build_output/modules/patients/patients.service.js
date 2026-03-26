import { prisma } from '../../config/database.js';
import { hashPassword } from '../../utils/crypto.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../middleware/errorHandler.js';
import { UserRole } from '@prisma/client';
import { emailService } from '../../services/email.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
export class PatientsService {
    async create(input) {
        // If no email provided, create walk-in patient (no user account needed)
        if (!input.email) {
            return this.createWalkInPatient(input);
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
        const resetToken = jwt.sign({ email: input.email, type: 'reset' }, config.jwt.accessSecret, { expiresIn: '24h' });
        // Transaction: Create User + Patient
        const patient = await prisma.$transaction(async (tx) => {
            // 1. Create User
            const user = await tx.user.create({
                data: {
                    email: input.email,
                    passwordHash,
                    role: UserRole.PATIENT,
                    status: 'ACTIVE',
                },
            });
            // 2. Check for existing orphan patient with this email OR phone
            const orphanCriteria = [];
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
                    where: { uhid: existingPatient.uhid },
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
                    registrationDate: input.registrationDate || new Date(),
                },
            });
            // 4. Notify all Doctors about new patient
            const doctors = await tx.user.findMany({
                where: { role: UserRole.DOCTOR, status: 'ACTIVE' }
            });
            if (doctors.length > 0) {
                await tx.notification.createMany({
                    data: doctors.map(doc => ({
                        recipientId: doc.id,
                        title: 'New Patient Registration',
                        message: `New patient ${newPatient.firstName} ${newPatient.lastName} (${newPatient.uhid}) has been registered.`,
                        actionUrl: `/doctor/patients?q=${newPatient.uhid}`,
                        type: 'info'
                    }))
                });
            }
            return newPatient;
        });
        // Generate password reset link
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
        const passwordResetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
        // 3. Send Welcome Email (Non-blocking)
        emailService.sendWelcomeEmail(patient.email, `${patient.firstName} ${patient.lastName} `, patient.uhid || 'Pending', resetToken).catch(err => console.error('Failed to send welcome email:', err));
        // Return patient data with login credentials for receptionist to share
        const response = this.formatPatient(patient);
        return {
            ...response,
            temporaryPassword: tempPassword,
            passwordResetLink: passwordResetLink
        };
    }
    async findById(uhid) {
        const patient = await prisma.patient.findUnique({
            where: { uhid }
        });
        if (!patient) {
            throw new NotFoundError('Patient not found');
        }
        return this.formatPatient(patient);
    }
    async findByUserId(userId) {
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
                console.log(`[Proactive Linking] Linking orphan ${orphan.uhid} to user ${user.email} `);
                patient = await prisma.patient.update({
                    where: { uhid: orphan.uhid },
                    data: { userId: user.id }
                });
            }
        }
        if (!patient) {
            throw new NotFoundError('Patient profile not found. Please contact reception to register.');
        }
        console.log(`[findByUserId] User ${userId} (${user.email}) => Patient ${patient.uhid} `);
        return this.formatPatient(patient);
    }
    async findAll(query) {
        const { page, limit, search, date, startDate, endDate } = query;
        const skip = (page - 1) * limit;
        const where = {};
        const AND = [];
        if (search) {
            const searchTerms = search.trim().split(/\s+/);
            if (searchTerms.length > 1) {
                AND.push({
                    OR: searchTerms.map(term => ({
                        OR: [
                            { firstName: { contains: term, mode: 'insensitive' } },
                            { lastName: { contains: term, mode: 'insensitive' } },
                            { phone: { contains: term } },
                            { uhid: { contains: term, mode: 'insensitive' } },
                            { email: { contains: term, mode: 'insensitive' } }
                        ]
                    }))
                });
            }
            else {
                AND.push({
                    OR: [
                        { firstName: { contains: search, mode: 'insensitive' } },
                        { lastName: { contains: search, mode: 'insensitive' } },
                        { phone: { contains: search } },
                        { uhid: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } }
                    ]
                });
            }
        }
        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            AND.push({
                registrationDate: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            });
        }
        if (startDate || endDate) {
            const registrationDateFilter = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                registrationDateFilter.gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                registrationDateFilter.lte = end;
            }
            AND.push({ registrationDate: registrationDateFilter });
        }
        if (AND.length > 0) {
            where.AND = AND;
        }
        const [patients, total] = await Promise.all([
            prisma.patient.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.patient.count({ where })
        ]);
        return {
            items: patients.map(p => this.formatPatient(p)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }
    async update(uhid, input, requesterId, requesterRole) {
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
        return this.formatPatient(updated);
    }
    async delete(uhid) {
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
    async getLinkedPatients(startingPatient) {
        // Pass 1: Find all profiles sharing starting patient's phone OR email
        const whereClause = [{ phone: startingPatient.phone }];
        if (startingPatient.email) {
            whereClause.push({ email: startingPatient.email });
        }
        const pass1 = await prisma.patient.findMany({
            where: { OR: whereClause },
            select: { uhid: true, phone: true, email: true, createdAt: true, userId: true, firstName: true, lastName: true, dateOfBirth: true, gender: true, address: true, emergencyContact: true, bloodGroup: true, allergies: true, updatedAt: true }
        });
        // Pass 2: Collect all phones and emails from Pass 1 results and find everyone sharing ANY of them
        const phones = new Set();
        const emails = new Set();
        pass1.forEach(p => {
            if (p.phone)
                phones.add(p.phone);
            if (p.email)
                emails.add(p.email);
        });
        const finalCriteria = [];
        phones.forEach(p => finalCriteria.push({ phone: p }));
        emails.forEach(e => finalCriteria.push({ email: e }));
        if (finalCriteria.length === 0)
            return [startingPatient];
        const finalResults = await prisma.patient.findMany({
            where: { OR: finalCriteria },
            orderBy: { createdAt: 'asc' }
        });
        return finalResults;
    }
    async getLinkedPatientIds(startingPatient) {
        const linked = await this.getLinkedPatients(startingPatient);
        const allIds = Array.from(new Set(linked.map(p => p.uhid)));
        console.log(`[Smart Linking] Patient ${startingPatient.uhid} linked to profiles: ${allIds.join(', ')} `);
        return allIds;
    }
    /**
     * Resolves a patient by UHID and returns all linked UHIDs
     */
    async resolvePatientIds(uhid) {
        const patient = await prisma.patient.findUnique({
            where: { uhid }
        });
        if (!patient)
            return [uhid];
        return this.getLinkedPatientIds(patient);
    }
    async getPrescriptions(patientId) {
        // Strictly fetch by specific patient ID only
        const patientIds = [patientId];
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
            const px = mr.prescriptions || [];
            const vitalsPx = mr.vitalSigns?.prescriptions || [];
            return px.length > 0 || vitalsPx.length > 0;
        })
            .map(mr => {
            const rawPx = mr.prescriptions || mr.vitalSigns?.prescriptions || [];
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
    async getBills(patientId) {
        // Strictly fetch by specific patient ID only
        const patientIds = [patientId];
        const bills = await prisma.bill.findMany({
            where: { patientId: { in: patientIds } },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
        });
        // Attach Medical Record Info manually (similar to BillingService)
        const billsWithMR = await Promise.all(bills.map(async (bill) => {
            const medicalRecord = bill.patientId ? await prisma.medicalRecord.findFirst({
                where: { patientId: bill.patientId },
                orderBy: { createdAt: 'desc' }
            }) : null;
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
    async getLabResults(patientId) {
        // Strictly fetch by specific patient ID only
        const patientIds = [patientId];
        return prisma.labTestOrder.findMany({
            where: { patientId: { in: patientIds } },
            include: { result: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    formatPatient(patient) {
        return {
            id: patient.uhid,
            uhid: patient.uhid,
            userId: patient.userId,
            title: patient.title,
            firstName: patient.firstName,
            lastName: patient.lastName,
            dateOfBirth: patient.dateOfBirth,
            gender: patient.gender,
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
            registrationDate: patient.registrationDate,
            createdAt: patient.createdAt,
            updatedAt: patient.updatedAt,
        };
    }
    /**
     * Create a walk-in patient record without a User account.
     * Walk-in patients only need a Patient record for billing/lab orders.
     * They do not get login credentials or welcome emails.
     */
    async createWalkInPatient(input) {
        // Check for existing patient with same phone to avoid duplicates
        const existingByPhone = await prisma.patient.findFirst({
            where: { phone: input.phone }
        });
        if (existingByPhone) {
            // Return existing patient instead of creating duplicate
            return this.formatPatient(existingByPhone);
        }
        const uhidToUse = input.uhid || `P-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const patient = await prisma.patient.create({
            data: {
                uhid: uhidToUse,
                userId: null,
                title: input.title,
                firstName: input.firstName,
                lastName: input.lastName,
                dateOfBirth: input.dateOfBirth,
                gender: input.gender,
                phone: input.phone,
                altPhone: input.altPhone,
                address: input.address,
                referredBy: input.referredBy,
                referredPerson: input.referredPerson,
                consultingDoctor: input.consultingDoctor,
                department: input.department,
                registrationDate: input.registrationDate || new Date(),
            },
        });
        return this.formatPatient(patient);
    }
}
export const patientsService = new PatientsService();
//# sourceMappingURL=patients.service.js.map