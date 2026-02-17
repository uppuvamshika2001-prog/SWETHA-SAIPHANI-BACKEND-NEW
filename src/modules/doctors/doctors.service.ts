import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../middleware/errorHandler.js';
import { CreateMedicalRecordInput, CreatePrescriptionInput, MedicalRecordResponse, PrescriptionResponse } from './doctors.types.js';

export class DoctorsService {
    async createMedicalRecord(doctorUserId: string, input: CreateMedicalRecordInput): Promise<MedicalRecordResponse> {
        // Get staff ID from user ID
        const doctor = await prisma.staff.findUnique({ where: { userId: doctorUserId } });
        if (!doctor) {
            throw new NotFoundError('Doctor profile not found');
        }

        // Validate patient
        const patient = await prisma.patient.findUnique({ where: { uhid: input.patientId } });
        if (!patient) {
            throw new NotFoundError('Patient not found');
        }

        const record = await prisma.medicalRecord.create({
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
                vitalSigns: input.vitalSigns || {},
                prescriptions: input.prescriptions || [],
                labOrders: input.labOrders || []
            },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                doctor: { select: { firstName: true, lastName: true } },
            },
        });

        // Automatically create Lab Test Orders
        if (input.labOrders && input.labOrders.length > 0) {
            await Promise.all(input.labOrders.map(testName =>
                prisma.labTestOrder.create({
                    data: {
                        patientId: input.patientId,
                        orderedById: doctor.id,
                        testName: testName,
                        status: 'READY_FOR_SAMPLE_COLLECTION',
                        priority: 'normal'
                    }
                })
            ));
        }

        return this.formatMedicalRecord(record as any);
    }

    async createPrescription(doctorUserId: string, input: CreatePrescriptionInput): Promise<PrescriptionResponse> {
        const doctor = await prisma.staff.findUnique({ where: { userId: doctorUserId } });
        if (!doctor) {
            throw new NotFoundError('Doctor profile not found');
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
            },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                doctor: { select: { firstName: true, lastName: true } },
            },
        });

        return this.formatMedicalRecord(updatedRecord as any);
    }

    async getAllMedicalRecords(search?: string) {
        const where: Record<string, unknown> = {};
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
                        { id: term }, // UUID likely single term but lenient matching
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
    }): MedicalRecordResponse {
        const vitals = record.vitalSigns as Record<string, any> || {};
        // Read prescriptions from JSON column (backward compatible)
        const prescriptions = (record.prescriptions as any[]) || [];

        // Remove any leftover prescriptions from vitals (legacy cleanup)
        const { prescriptions: _, prescriptionStatus: __, dispensedAt: ___, ...cleanVitals } = vitals;

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
