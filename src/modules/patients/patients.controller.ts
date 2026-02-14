import { Request, Response, NextFunction } from 'express';
import { patientsService } from './patients.service.js';
import { createPatientSchema, updatePatientSchema, patientQuerySchema } from './patients.types.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { UserRole } from '@prisma/client';

/**
 * @swagger
 * /api/patients:
 *   post:
 *     tags: [Patients]
 *     summary: Register a new patient
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, dateOfBirth, gender, phone]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE, OTHER]
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               emergencyContact:
 *                 type: string
 *               bloodGroup:
 *                 type: string
 *               allergies:
 *                 type: string
 *     responses:
 *       201:
 *         description: Patient registered successfully
 */
export async function createPatient(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const input = createPatientSchema.parse(req.body);
        const patient = await patientsService.create(input);
        sendCreated(res, patient, 'Patient registered successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/patients:
 *   get:
 *     tags: [Patients]
 *     summary: List all patients (Staff only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of patients
 */
export async function getPatients(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const query = patientQuerySchema.parse(req.query);
        const result = await patientsService.findAll(query);
        sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/patients/me:
 *   get:
 *     tags: [Patients]
 *     summary: Get current patient's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Patient profile
 */
export async function getMyProfile(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const patient = await patientsService.findByUserId(req.user!.userId);
        sendSuccess(res, patient);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/patients/{id}:
 *   get:
 *     tags: [Patients]
 *     summary: Get patient by ID
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
 *         description: Patient details
 */
export async function getPatientById(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const patient = await patientsService.findById(id);
        sendSuccess(res, patient);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/patients/{id}:
 *   patch:
 *     tags: [Patients]
 *     summary: Update patient profile
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
 *         description: Patient updated successfully
 */
export async function updatePatient(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const input = updatePatientSchema.parse(req.body);
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const patient = await patientsService.update(
            id,
            input,
            req.user!.userId,
            req.user!.role as UserRole
        );
        sendSuccess(res, patient, 'Patient updated successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/patients/{id}/prescriptions:
 *   get:
 *     tags: [Patients]
 *     summary: Get patient's prescriptions
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
 *         description: List of prescriptions
 */
export async function getPatientPrescriptions(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const prescriptions = await patientsService.getPrescriptions(id);
        sendSuccess(res, prescriptions);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/patients/{id}/bills:
 *   get:
 *     tags: [Patients]
 *     summary: Get patient's bills
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
 *         description: List of bills
 */
export async function getPatientBills(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const bills = await patientsService.getBills(id);
        sendSuccess(res, bills);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/patients/{id}/lab-results:
 *   get:
 *     tags: [Patients]
 *     summary: Get patient's lab results
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
 *         description: List of lab results
 */
export async function getPatientLabResults(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const labResults = await patientsService.getLabResults(id);
        sendSuccess(res, labResults);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/patients/{id}:
 *   delete:
 *     tags: [Patients]
 *     summary: Delete patient profile (Staff only)
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
 *         description: Patient deleted successfully
 */
export async function deletePatient(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        await patientsService.delete(id);
        sendSuccess(res, null, 'Patient deleted successfully');
    } catch (error) {
        next(error);
    }
}
