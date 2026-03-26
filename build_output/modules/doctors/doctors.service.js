import { prisma } from '../../config/database.js';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler.js';
export class DoctorsService {
    async createMedicalRecord(doctorUserId, input) {
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
        }
        catch (error) {
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
                    }
                    catch (error) {
                        console.error(`Prisma LabTestOrder.create Error for ${testName}:`, error);
                        // Don't throw here to allow other orders and medical record to succeed, or handle as needed
                    }
                }
            }));
        }
        return this.formatMedicalRecord(record);
    }
    async createPrescription(doctorUserId, input) {
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
    async getPrescription(id) {
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
    async getMedicalRecords(patientId) {
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
        return records.map((record) => this.formatMedicalRecord(record));
    }
    async getMedicalRecordById(id) {
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
    async updatePrescriptionStatus(recordId, status) {
        const record = await prisma.medicalRecord.findUnique({
            where: { id: recordId },
        });
        if (!record) {
            throw new NotFoundError('Medical record not found');
        }
        // If dispensing, deduct stock using batch-level FEFO and audit logs
        if (status === 'DISPENSED') {
            await prisma.$transaction(async (tx) => {
                const prescriptions = record.prescriptions || [];
                for (const prescription of prescriptions) {
                    if (prescription.medicineName) {
                        const medicine = await tx.medicine.findFirst({
                            where: {
                                name: { contains: prescription.medicineName, mode: 'insensitive' }
                            }
                        });
                        if (!medicine) {
                            console.warn(`[Dispense] Medicine not found: ${prescription.medicineName}`);
                            continue;
                        }
                        // Parse quantity from prescription (default to 1)
                        const qty = parseInt(prescription.quantity) || 1;
                        if (medicine.stockQuantity < qty) {
                            throw new ValidationError(`Insufficient stock for ${medicine.name}. Available: ${medicine.stockQuantity}, Requested: ${qty}`);
                        }
                        // Batch-level FEFO deduction
                        let remainingQty = qty;
                        const batches = await tx.medicineBatch.findMany({
                            where: {
                                medicineId: medicine.id,
                                stockQuantity: { gt: 0 },
                                expiryDate: { gt: new Date() },
                                isActive: true,
                            },
                            orderBy: { expiryDate: 'asc' },
                        });
                        let currentStock = medicine.stockQuantity;
                        let batchLogsCreated = false;
                        for (const batch of batches) {
                            if (remainingQty <= 0)
                                break;
                            const deductQty = Math.min(batch.stockQuantity, remainingQty);
                            await tx.medicineBatch.update({
                                where: { id: batch.id },
                                data: { stockQuantity: { decrement: deductQty } },
                            });
                            // Log batch-specific deduction
                            await tx.inventoryLog.create({
                                data: {
                                    medicineId: medicine.id,
                                    batchNumber: batch.batchNumber, // NOW BATCH TRACKING IS TRUE
                                    type: 'DISPENSE',
                                    quantity: -deductQty,
                                    previousStock: currentStock,
                                    newStock: currentStock - deductQty,
                                    referenceId: recordId,
                                    remarks: `Dispensed batch ${batch.batchNumber} via prescription for record ${recordId}`
                                }
                            });
                            currentStock -= deductQty;
                            remainingQty -= deductQty;
                            batchLogsCreated = true;
                        }
                        if (remainingQty > 0) {
                            console.warn(`[Dispense] Not enough batch stock for ${medicine.name}, but master stock was sufficient. Proceeding.`);
                            // Create generic log for remainder to balance books if batches ran out prematurely
                            await tx.inventoryLog.create({
                                data: {
                                    medicineId: medicine.id,
                                    type: 'DISPENSE',
                                    quantity: -remainingQty,
                                    previousStock: currentStock,
                                    newStock: currentStock - remainingQty,
                                    referenceId: recordId,
                                    remarks: `Dispensed generic stock via prescription for record ${recordId}`
                                }
                            });
                        }
                        else if (!batchLogsCreated) {
                            // Fallback if no batches found at all
                            await tx.inventoryLog.create({
                                data: {
                                    medicineId: medicine.id,
                                    type: 'DISPENSE',
                                    quantity: -qty,
                                    previousStock: medicine.stockQuantity,
                                    newStock: medicine.stockQuantity - qty,
                                    referenceId: recordId,
                                    remarks: `Dispensed generic stock via prescription for record ${recordId}`
                                }
                            });
                        }
                        // Update master stock
                        const prevStock = medicine.stockQuantity;
                        const newStock = prevStock - qty;
                        await tx.medicine.update({
                            where: { id: medicine.id },
                            data: { stockQuantity: newStock }
                        });
                        console.log(`[Dispense] Deducted ${qty} unit(s) of ${medicine.name}. Stock: ${prevStock} -> ${newStock}`);
                    }
                }
            });
        }
        const updatedRecord = await prisma.medicalRecord.update({
            where: { id: recordId },
            data: {
                prescriptionStatus: status,
                vitalSigns: status === 'DISPENSED' ? {
                    ...(record.vitalSigns || {}),
                    dispensedAt: new Date().toISOString()
                } : record.vitalSigns
            },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                doctor: { select: { firstName: true, lastName: true } },
            },
        });
        return this.formatMedicalRecord(updatedRecord);
    }
    async getAllMedicalRecords(search, startDate, endDate) {
        const where = {};
        // Date Range Filtering
        if (startDate || endDate) {
            const createdAtFilter = {};
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
            }
            else {
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
            where: where,
            include: {
                patient: true,
                doctor: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return records.map((record) => this.formatMedicalRecord(record));
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
        const formatted = records.map((record) => this.formatMedicalRecord(record));
        return formatted.filter((r) => r.prescriptions &&
            r.prescriptions.length > 0);
    }
    formatMedicalRecord(record) {
        const vitals = record.vitalSigns || {};
        // Read prescriptions from JSON column (backward compatible)
        const prescriptions = record.prescriptions || [];
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
            prescriptions: prescriptions,
            labOrders: record.labOrders || [],
            prescriptionStatus: record.prescriptionStatus || 'PENDING',
            followUpDate: record.followUpDate || null,
            patient: record.patient,
            doctor: record.doctor,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt || record.createdAt,
            dispensedAt: dispensedAt,
            totalAmount: 0, // Legacy support
            total: 0 // New standard for consistency
        };
    }
    async getDispensedHistory(startDate, endDate) {
        const where = { prescriptionStatus: 'DISPENSED' };
        if (startDate || endDate) {
            where.updatedAt = {};
            if (startDate) {
                where.updatedAt.gte = new Date(`${startDate}T00:00:00.000Z`);
            }
            if (endDate) {
                where.updatedAt.lte = new Date(`${endDate}T23:59:59.999Z`);
            }
        }
        const records = await prisma.medicalRecord.findMany({
            where,
            include: {
                patient: true,
                doctor: true
            },
            orderBy: {
                updatedAt: 'desc'
            },
            take: startDate || endDate ? undefined : 50 // Limit when no dates applied
        });
        // For each record, dynamically fetch its batch-level deductions to construct the 'items' explicitly requested
        const recordIds = records.map(r => r.id);
        const inventoryLogs = await prisma.inventoryLog.findMany({
            where: {
                referenceId: { in: recordIds },
                type: 'DISPENSE'
            },
            include: {
                medicine: {
                    include: {
                        batches: {
                            where: { isActive: true }
                        }
                    }
                }
            }
        });
        const formattedRecords = records.map(record => {
            const formatted = this.formatMedicalRecord(record);
            const logsForRecord = inventoryLogs.filter(log => log.referenceId === record.id);
            let totalAmount = 0;
            const items = logsForRecord.map(log => {
                // Determine retail price matching the dispensed batch
                const batch = log.medicine.batches.find(b => b.batchNumber === log.batchNumber);
                const unitPrice = batch ? Number(batch.salePrice) : Number(log.medicine.pricePerUnit);
                const quantity = Math.abs(log.quantity);
                const itemTotal = unitPrice * quantity;
                totalAmount += itemTotal;
                return {
                    id: log.id,
                    medicineId: log.medicineId,
                    medicineName: log.medicine.name,
                    quantity: quantity,
                    batchNumber: log.batchNumber || 'N/A',
                    unitPrice: unitPrice,
                    total: itemTotal,
                    medicine: {
                        ...log.medicine,
                        pricePerUnit: Number(log.medicine.pricePerUnit)
                    }
                };
            });
            return {
                ...formatted,
                items: items.length > 0 ? items : undefined,
                totalAmount: totalAmount, // For legacy frontend fallback
                total: totalAmount
            };
        });
        return formattedRecords;
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
    formatPrescription(prescription) {
        return {
            id: prescription.id,
            patientId: prescription.patientId,
            doctorId: prescription.doctorId,
            notes: prescription.notes,
            medicines: prescription.medicines,
            patient: prescription.patient,
            doctor: prescription.doctor,
            createdAt: prescription.createdAt,
        };
    }
    async getDashboardStats(doctorId, selectedDate, startDate, endDate) {
        const where = {};
        let start;
        let end;
        if (startDate && endDate) {
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        }
        else if (selectedDate) {
            start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);
        }
        else {
            // Default to today
            start = new Date();
            start.setHours(0, 0, 0, 0);
            end = new Date();
            end.setHours(23, 59, 59, 999);
        }
        // 1. Appointments for this doctor within the date range
        const appointments = await prisma.appointment.findMany({
            where: {
                doctorId,
                scheduledAt: { gte: start, lte: end }
            },
            include: {
                patient: {
                    select: { firstName: true, lastName: true, uhid: true, dateOfBirth: true, bloodGroup: true, phone: true }
                }
            },
            orderBy: { scheduledAt: 'asc' }
        });
        const pendingConsultations = appointments.filter(a => a.status === 'SCHEDULED' || a.status === 'CONFIRMED').length;
        // 2. Lab Orders linked to this doctor within the date range (Either ordered by or linked to appointments in this range)
        const labOrders = await prisma.labTestOrder.findMany({
            where: {
                doctorId,
                createdAt: { gte: start, lte: end }
            },
            include: {
                patient: { select: { firstName: true, lastName: true, uhid: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        // 3. Unique patients seen or scheduled in this date range
        const uniquePatientIds = new Set(appointments.map(a => a.patientId));
        const patientsData = await prisma.patient.findMany({
            where: {
                uhid: { in: Array.from(uniquePatientIds) }
            }
        });
        return {
            appointments: appointments.map(a => ({
                id: a.id,
                patientId: a.patientId,
                patient_name: `${a.patient.firstName} ${a.patient.lastName}`,
                date: a.scheduledAt.toISOString(),
                time: a.scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                status: a.status.toLowerCase(),
                type: a.reason || 'Consultation'
            })),
            pendingConsultations,
            totalAppointments: appointments.length,
            labOrders: labOrders.map(l => ({
                id: l.id,
                testName: l.testName,
                status: l.status,
                patientName: `${l.patient.firstName} ${l.patient.lastName}`
            })),
            patients: patientsData.map(p => ({
                uhid: p.uhid,
                full_name: `${p.firstName} ${p.lastName}`,
                age: p.dateOfBirth ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear() : 'N/A',
                blood_group: p.bloodGroup || 'N/A',
                status: 'active'
            }))
        };
    }
}
export const doctorsService = new DoctorsService();
//# sourceMappingURL=doctors.service.js.map