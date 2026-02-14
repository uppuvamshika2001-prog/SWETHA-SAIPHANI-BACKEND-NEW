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
                diagnosis: input.diagnosis,
                treatment: input.treatment || input.treatmentNotes,
                notes: input.notes || input.chiefComplaint,
                // Workaround: Store prescriptions in vitalSigns JSON to avoid schema mismatch if db push failed
                vitalSigns: {
                    ...(input.vitalSigns || {}),
                    prescriptions: input.prescriptions || []
                },
                // Also store in the actual prescriptions field if it exists in schema
                prescriptions: input.prescriptions || []
            },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                doctor: { select: { firstName: true, lastName: true } },
            },
        });

        return this.formatMedicalRecord(record);
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
        const patient = await prisma.patient.findUnique({
            where: { uhid: patientId }
        });

        if (!patient) {
            throw new NotFoundError('Patient not found');
        }

        // 2-Pass Smart Linking
        const whereClause: any[] = [{ phone: patient.phone }];
        if (patient.email) {
            whereClause.push({ email: patient.email });
        }

        const pass1 = await prisma.patient.findMany({
            where: { OR: whereClause },
            select: { uhid: true, phone: true, email: true }
        });

        const phones = new Set<string>();
        const emails = new Set<string>();
        pass1.forEach(p => {
            if (p.phone) phones.add(p.phone);
            if (p.email) emails.add(p.email);
        });

        const finalCriteria: any[] = [];
        phones.forEach(p => finalCriteria.push({ phone: p }));
        emails.forEach(e => finalCriteria.push({ email: e }));

        const finalResults = await prisma.patient.findMany({
            where: { OR: finalCriteria },
            select: { uhid: true }
        });

        const patientIds = Array.from(new Set(finalResults.map(p => p.uhid as string)));
        console.log(`[getMedicalRecords] Smart Linked Patient UHIDs: ${patientIds.join(', ')}`);

        const records = await prisma.medicalRecord.findMany({
            where: { patientId: { in: patientIds } },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                doctor: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return records.map(record => this.formatMedicalRecord(record as any));
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

        const currentVitals = record.vitalSigns as Record<string, any> || {};

        // If dispensing, deduct stock for each medicine in prescriptions
        if (status === 'DISPENSED') {
            const prescriptions = currentVitals.prescriptions || (record as any).prescriptions || [];

            for (const prescription of prescriptions) {
                if (prescription.medicineName) {
                    // Try to find medicine by name (case-insensitive partial match)
                    const medicine = await prisma.medicine.findFirst({
                        where: {
                            name: { contains: prescription.medicineName, mode: 'insensitive' }
                        }
                    });

                    if (medicine && medicine.stockQuantity > 0) {
                        // Deduct 1 unit per prescription item 
                        // (In a real system, you'd parse dosage/quantity from prescription)
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

        const updatedVitals = {
            ...currentVitals,
            prescriptionStatus: status,
            dispensedAt: status === 'DISPENSED' ? new Date().toISOString() : undefined
        };

        const updatedRecord = await prisma.medicalRecord.update({
            where: { id: recordId },
            data: {
                vitalSigns: updatedVitals,
            },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                doctor: { select: { firstName: true, lastName: true } },
            },
        });

        return this.formatMedicalRecord(updatedRecord);
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

        return records.map(record => this.formatMedicalRecord(record));
    }

    async getPendingPrescriptions() {
        // Fetch recent records and filter for PENDING status
        // Since status is in JSON, we filter in code to ensure compatibility
        const records = await prisma.medicalRecord.findMany({
            where: {
                // Ensure record has prescriptions (workaround check if possible, or just fetch all)
                // We'll rely on in-memory filter for the JSON fields
            },
            include: {
                patient: true,
                doctor: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 20 // Limit to recent 20 to avoid showing old test data
        });

        const formatted = records.map(record => this.formatMedicalRecord(record));

        return formatted.filter(r =>
            r.prescriptions &&
            r.prescriptions.length > 0 &&
            (r.prescriptionStatus === 'PENDING' || !r.prescriptionStatus) // Default to Pending if field missing but has prescriptions
        );
    }

    private formatMedicalRecord(record: {
        id: string;
        patientId: string;
        doctorId: string;
        diagnosis: string;
        treatment: string | null;
        notes: string | null;
        vitalSigns: unknown;
        patient: { firstName: string; lastName: string };
        doctor: { firstName: string; lastName: string };
        createdAt: Date;
    }): MedicalRecordResponse {
        const vitals = record.vitalSigns as Record<string, any> || {};
        const prescriptions = vitals.prescriptions || (record as any).prescriptions || []; // Check both locations

        // Remove prescriptions from vitals to keep it clean
        const { prescriptions: _, ...cleanVitals } = vitals;

        return {
            id: record.id,
            patientId: record.patientId,
            doctorId: record.doctorId,
            diagnosis: record.diagnosis,
            treatment: record.treatment,
            notes: record.notes,
            vitalSigns: Object.keys(cleanVitals).length > 0 ? cleanVitals : null,
            prescriptions: prescriptions as MedicalRecordResponse['prescriptions'],
            prescriptionStatus: (vitals.prescriptionStatus as any) || 'PENDING',
            dispensedAt: vitals.dispensedAt as string | undefined,
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
