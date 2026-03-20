import { prisma } from '../../config/database.js';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler.js';
import { CreateMedicalRecordInput, CreatePrescriptionInput, MedicalRecordResponse, PrescriptionResponse } from './doctors.types.js';

export class DoctorsService {
    async createMedicalRecord(doctorUserId: string, input: CreateMedicalRecordInput): Promise<MedicalRecordResponse> {
        // Get staff ID from user ID and validate role
        const doctor = await prisma.staff.findUnique({ 
            where: { userId: doctorUserId },
            include: { user: true }
        });
        
        if (!doctor) {
            throw new NotFoundError('Doctor profile not found');
        }

        if (doctor.user.role !== 'DOCTOR') {
            throw new ValidationError('Only doctors can create medical records');
        }

        // Validate patient
        const patient = await prisma.patient.findUnique({ where: { uhid: input.patientId } });
        if (!patient) {
            throw new NotFoundError('Patient not found');
        }

        let record;
        try {
            record = await prisma.medicalRecord.create({
                data: {
                    patientId: input.patientId,
                    doctorId: doctor.id,
                    appointmentId: input.appointmentId,
                    chiefComplaint: input.chiefComplaint,
                    diagnosis: input.diagnosis,
                    icdCode: input.icdCode,
                    treatment: input.treatment || input.treatmentNotes,
                    treatmentNotes: input.treatmentNotes,
                    notes: input.notes,
                    followUpDate: input.followUpDate,
                    prescriptionStatus: 'PENDING',
                    vitalSigns: input.vitalSigns || input.vitals || {},
                    prescriptions: input.prescriptions || [],
                    labOrders: input.labOrders || []
                },
                include: {
                    patient: { select: { firstName: true, lastName: true } },
                    doctor: { select: { firstName: true, lastName: true } },
                },
            });
        } catch (error: any) {
            console.error("Prisma MedicalRecord.create Error:", error);
            throw error;
        }

        // Automatically create Lab Test Orders (with deduplication)
        if (input.labOrders && input.labOrders.length > 0) {
            await Promise.all(input.labOrders.map(async (testName) => {
                // Check if an order for this test already exists for this patient and is NOT completed/cancelled
                const existingOrder = await prisma.labTestOrder.findFirst({
                    where: {
                        patientId: input.patientId,
                        testName: testName,
                        status: {
                            in: ['ORDERED', 'READY_FOR_SAMPLE_COLLECTION', 'SAMPLE_COLLECTED', 'IN_PROGRESS']
                        }
                    }
                });

                if (!existingOrder) {
                    try {
                        return prisma.labTestOrder.create({
                            data: {
                                patientId: input.patientId,
                                orderedById: doctor.id,
                                testName: testName,
                                status: 'PAYMENT_PENDING', // Updated to match new workflow
                                priority: 'normal'
                            }
                        });
                    } catch (error: any) {
                        console.error(`Prisma LabTestOrder.create Error for ${testName}:`, error);
                        // Don't throw here to allow other orders and medical record to succeed, or handle as needed
                    }
                }
            }));
        }

        return this.formatMedicalRecord(record as any);
    }

    async createPrescription(doctorUserId: string, input: CreatePrescriptionInput): Promise<PrescriptionResponse> {
        const doctor = await prisma.staff.findUnique({ 
            where: { userId: doctorUserId },
            include: { user: true }
        });
        
        if (!doctor) {
            throw new NotFoundError('Doctor profile not found');
        }

        if (doctor.user.role !== 'DOCTOR') {
            throw new ValidationError('Only doctors can create prescriptions');
        }

        const patient = await prisma.patient.findUnique({ where: { uhid: input.patientId } });
        if (!patient) {
            throw new NotFoundError('Patient not found');
        }

        const prescription = await prisma.prescription.create({
            data: {
                patientId: input.patientId,
                doctorId: doctor.id,
                notes: input.notes,
                medicines: input.medicines,
            },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                doctor: { select: { firstName: true, lastName: true } },
            },
        });

        return this.formatPrescription(prescription);
    }

    async getPrescription(id: string): Promise<PrescriptionResponse> {
        const prescription = await prisma.prescription.findUnique({
            where: { id },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                doctor: { select: { firstName: true, lastName: true } },
            },
        });

        if (!prescription) {
            throw new NotFoundError('Prescription not found');
        }

        return this.formatPrescription(prescription);
    }

    async getMedicalRecords(patientId: string) {
        console.log(`[getMedicalRecords] Fetching for Patient UHID: ${patientId}`);

        // Removed "Smart Linking" - fetching strictly by Patient UHID
        const records = await prisma.medicalRecord.findMany({
            where: { patientId: patientId },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                doctor: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return records.map((record: any) => this.formatMedicalRecord(record as any));
    }

    async getMedicalRecordById(id: string): Promise<MedicalRecordResponse> {
        const record = await prisma.medicalRecord.findUnique({
            where: { id },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                doctor: { select: { firstName: true, lastName: true, specialization: true } },
            },
        });

        if (!record) {
            throw new NotFoundError('Medical record not found');
        }

        return this.formatMedicalRecord(record);
    }

    async updatePrescriptionStatus(recordId: string, status: 'DISPENSED' | 'PENDING' | 'CANCELLED') {
        const record = await prisma.medicalRecord.findUnique({
            where: { id: recordId },
        });

        if (!record) {
            throw new NotFoundError('Medical record not found');
        }

        // If dispensing, deduct stock for each medicine in prescriptions
        if (status === 'DISPENSED') {
            const prescriptions = (record.prescriptions as any[]) || [];

            for (const prescription of prescriptions) {
                if (prescription.medicineName) {
                    // Try to find medicine by name (case-insensitive partial match)
                    const medicine = await prisma.medicine.findFirst({
                        where: {
                            name: { contains: prescription.medicineName, mode: 'insensitive' }
                        }
                    });

                    if (medicine && medicine.stockQuantity > 0) {
                        const deductQty = 1;
                        await prisma.medicine.update({
                            where: { id: medicine.id },
                            data: { stockQuantity: { decrement: deductQty } }
                        });
                        console.log(`[Dispense] Deducted ${deductQty} unit(s) of ${medicine.name}. New stock: ${medicine.stockQuantity - deductQty}`);
                    }
                }
            }
        }

        const updatedRecord = await prisma.medicalRecord.update({
            where: { id: recordId },
            data: {
                prescriptionStatus: status as any,
                // Add dispensed timestamp to vitals if dispensing
                vitalSigns: status === 'DISPENSED' ? {
                    ...(record.vitalSigns as any || {}),
                    dispensedAt: new Date().toISOString()
                } : record.vitalSigns
            },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                doctor: { select: { firstName: true, lastName: true } },
            },
        });

        return this.formatMedicalRecord(updatedRecord as any);
    }

    async getAllMedicalRecords(search?: string, startDate?: string, endDate?: string) {
        const where: any = {};

        // Date Range Filtering
        if (startDate || endDate) {
            const createdAtFilter: any = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                createdAtFilter.gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                createdAtFilter.lte = end;
            }
            where.createdAt = createdAtFilter;
        }

        if (search) {
            const searchTerms = search.trim().split(/\s+/);
            if (searchTerms.length > 1) {
                // Multi-word search
                where.AND = searchTerms.map(term => ({
                    OR: [
                        { patient: { firstName: { contains: term, mode: 'insensitive' } } },
                        { patient: { lastName: { contains: term, mode: 'insensitive' } } },
                        { patient: { uhid: { contains: term, mode: 'insensitive' } } },
                        { doctor: { firstName: { contains: term, mode: 'insensitive' } } },
                        { doctor: { lastName: { contains: term, mode: 'insensitive' } } },
                        { diagnosis: { contains: term, mode: 'insensitive' } },
                        { id: term },
                    ]
                }));
            } else {
                where.OR = [
                    { patient: { firstName: { contains: search, mode: 'insensitive' } } },
                    { patient: { lastName: { contains: search, mode: 'insensitive' } } },
                    { patient: { uhid: { contains: search, mode: 'insensitive' } } },
                    { doctor: { firstName: { contains: search, mode: 'insensitive' } } },
                    { doctor: { lastName: { contains: search, mode: 'insensitive' } } },
                    { diagnosis: { contains: search, mode: 'insensitive' } },
                    { id: search },
                ];
            }
        }

        const records = await prisma.medicalRecord.findMany({
            where: where as any,
            include: {
                patient: true,
                doctor: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return records.map((record: any) => this.formatMedicalRecord(record));
    }

    async getPendingPrescriptions() {
        // Now we can filter by the proper prescriptionStatus column
        const records = await prisma.medicalRecord.findMany({
            where: {
                prescriptionStatus: 'PENDING',
            },
            include: {
                patient: true,
                doctor: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        // Still filter for records that actually have prescriptions
        const formatted = records.map((record: any) => this.formatMedicalRecord(record as any));

        return formatted.filter((r: MedicalRecordResponse) =>
            r.prescriptions &&
            r.prescriptions.length > 0
        );
    }

    private formatMedicalRecord(record: {
        id: string;
        patientId: string;
        doctorId: string;
        appointmentId?: string | null;
        chiefComplaint?: string | null;
        diagnosis: string;
        icdCode?: string | null;
        treatment: string | null;
        treatmentNotes?: string | null;
        notes: string | null;
        vitalSigns: unknown;
        prescriptions: unknown;
        labOrders?: unknown;
        prescriptionStatus?: string | null;
        followUpDate?: Date | null;
        patient: { firstName: string; lastName: string };
        doctor: { firstName: string; lastName: string };
        createdAt: Date;
        updatedAt: Date;
    }): MedicalRecordResponse {
        const vitals = record.vitalSigns as Record<string, any> || {};
        // Read prescriptions from JSON column (backward compatible)
        const prescriptions = (record.prescriptions as any[]) || [];

        // Remove any leftover prescriptions from vitals (legacy cleanup)
        const { prescriptions: _, prescriptionStatus: __, dispensedAt, ...cleanVitals } = vitals;

        return {
            id: record.id,
            patientId: record.patientId,
            doctorId: record.doctorId,
            appointmentId: record.appointmentId || null,
            chiefComplaint: record.chiefComplaint || record.notes || null,
            diagnosis: record.diagnosis,
            icdCode: record.icdCode || null,
            treatment: record.treatment,
            treatmentNotes: record.treatmentNotes || null,
            notes: record.notes,
            vitalSigns: Object.keys(cleanVitals).length > 0 ? cleanVitals : null,
            prescriptions: prescriptions as MedicalRecordResponse['prescriptions'],
            labOrders: (record.labOrders as string[]) || [],
            prescriptionStatus: (record.prescriptionStatus as any) || 'PENDING',
            followUpDate: record.followUpDate || null,
            patient: record.patient,
            doctor: record.doctor,
            createdAt: record.createdAt,
            updatedAt: (record as any).updatedAt || record.createdAt,
            dispensedAt: dispensedAt as string,
            totalAmount: 0, // Legacy support
            total: 0 // New standard for consistency
        };
    }

    async getDispensedHistory() {
        const records = await prisma.medicalRecord.findMany({
            where: {
                prescriptionStatus: 'DISPENSED'
            },
            include: {
                patient: true,
                doctor: true
            },
            orderBy: {
                updatedAt: 'desc'
            },
            take: 10
        });
        return records.map(r => this.formatMedicalRecord(r as any));
    }

    async getPharmacyStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch all DISPENSED records from today (using updatedAt as a proxy for efficiency, 
        // then filtering by dispensedAt in JS if needed, but updatedAt is usually same as dispensedAt)
        const todaysRecords = await prisma.medicalRecord.count({
            where: {
                prescriptionStatus: 'DISPENSED',
                updatedAt: {
                    gte: today
                }
            }
        });

        const pendingCount = await prisma.medicalRecord.count({
            where: {
                prescriptionStatus: 'PENDING'
            }
        });

        return {
            dispensedToday: todaysRecords,
            pendingOrders: pendingCount
        };
    }

    private formatPrescription(prescription: {
        id: string;
        patientId: string;
        doctorId: string;
        notes: string | null;
        medicines: unknown;
        patient: { firstName: string; lastName: string };
        doctor: { firstName: string; lastName: string };
        createdAt: Date;
    }): PrescriptionResponse {
        return {
            id: prescription.id,
            patientId: prescription.patientId,
            doctorId: prescription.doctorId,
            notes: prescription.notes,
            medicines: prescription.medicines as PrescriptionResponse['medicines'],
            patient: prescription.patient,
            doctor: prescription.doctor,
            createdAt: prescription.createdAt,
        };
    }
}

export const doctorsService = new DoctorsService();
