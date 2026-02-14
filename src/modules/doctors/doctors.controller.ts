import { Request, Response, NextFunction } from 'express';
import { doctorsService } from '@/modules/doctors/doctors.service.js';
import { createMedicalRecordSchema, createPrescriptionSchema } from '@/modules/doctors/doctors.types.js';
import { sendSuccess, sendCreated } from '@/utils/response.js';

/**
 * @swagger
 * /api/medical-records:
 *   post:
 *     tags: [Medical Records]
 *     summary: Create a medical record
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId, diagnosis]
 *             properties:
 *               patientId:
 *                 type: string
 *               diagnosis:
 *                 type: string
 *               treatment:
 *                 type: string
 *               notes:
 *                 type: string
 *               vitalSigns:
 *                 type: object
 *                 properties:
 *                   bloodPressure:
 *                     type: string
 *                   temperature:
 *                     type: number
 *                   pulse:
 *                     type: number
 *                   weight:
 *                     type: number
 *                   height:
 *                     type: number
 *     responses:
 *       201:
 *         description: Medical record created
 */
export async function createMedicalRecord(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        console.log('Received Create Record Body:', JSON.stringify(req.body, null, 2));
        const input = createMedicalRecordSchema.parse(req.body);
        console.log('Parsed Input with Prescriptions:', JSON.stringify(input.prescriptions, null, 2));
        const record = await doctorsService.createMedicalRecord(req.user!.userId, input);
        sendCreated(res, record, 'Medical record created successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/medical-records/patient/{patientId}:
 *   get:
 *     tags: [Medical Records]
 *     summary: Get patient's medical records
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of medical records
 */
export async function getMedicalRecords(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const records = await doctorsService.getMedicalRecords(req.params.patientId as string);
        sendSuccess(res, records);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/medical-records:
 *   get:
 *     tags: [Medical Records]
 *     summary: Get all medical records (Admin view)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by patient name or diagnosis
 *     responses:
 *       200:
 *         description: List of all medical records
 */
export async function getAllMedicalRecords(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const search = req.query.search ? String(req.query.search) : undefined;
        const records = await doctorsService.getAllMedicalRecords(search);
        sendSuccess(res, records);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/medical-records/{id}:
 *   get:
 *     tags: [Medical Records]
 *     summary: Get medical record by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Medical record details
 */
export async function getMedicalRecordById(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const record = await doctorsService.getMedicalRecordById(req.params.id as string);
        sendSuccess(res, record);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/prescriptions:
 *   post:
 *     tags: [Prescriptions]
 *     summary: Create a prescription
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId, medicines]
 *             properties:
 *               patientId:
 *                 type: string
 *               notes:
 *                 type: string
 *               medicines:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     medicineId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     dosage:
 *                       type: string
 *                     frequency:
 *                       type: string
 *                     duration:
 *                       type: string
 *                     instructions:
 *                       type: string
 *     responses:
 *       201:
 *         description: Prescription created
 */
export async function createPrescription(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const input = createPrescriptionSchema.parse(req.body);
        const prescription = await doctorsService.createPrescription(req.user!.userId, input);
        sendCreated(res, prescription, 'Prescription created successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/prescriptions/{id}:
 *   get:
 *     tags: [Prescriptions]
 *     summary: Get prescription by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Prescription details
 */
export async function getPrescription(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const prescription = await doctorsService.getPrescription(req.params.id as string);
        sendSuccess(res, prescription);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/medical-records/{id}/dispense:
 *   put:
 *     tags: [Medical Records]
 *     summary: Mark prescriptions as dispensed
 */
export async function dispensePrescription(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { id } = req.params;
        const record = await doctorsService.updatePrescriptionStatus(id as string, 'DISPENSED');
        sendSuccess(res, record, 'Prescriptions marked as dispensed');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/pharmacy/pending:
 *   get:
 *     tags: [Pharmacy]
 *     summary: Get pending prescriptions
 */
export async function getPendingPrescriptions(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const records = await doctorsService.getPendingPrescriptions();
        sendSuccess(res, records);
    } catch (error) {
        next(error);
    }
}
