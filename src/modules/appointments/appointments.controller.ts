import { Request, Response, NextFunction } from 'express';
import { appointmentsService } from '@/modules/appointments/appointments.service.js';
import { createAppointmentSchema, updateAppointmentSchema, appointmentQuerySchema, createPublicAppointmentSchema } from '@/modules/appointments/appointments.types.js';
import { sendSuccess, sendCreated, sendNoContent } from '@/utils/response.js';

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     tags: [Appointments]
 *     summary: Create a new appointment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId, doctorId, scheduledAt]
 *             properties:
 *               patientId:
 *                 type: string
 *               doctorId:
 *                 type: string
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               duration:
 *                 type: integer
 *               reason:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Appointment created successfully
 */
export async function createAppointment(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const input = createAppointmentSchema.parse(req.body);
        const appointment = await appointmentsService.create(input);
        sendCreated(res, appointment, 'Appointment created successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/appointments/public:
 *   post:
 *     tags: [Appointments]
 *     summary: Create a public appointment (Guest)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, phone, doctorId, scheduledAt, paymentType]
 *     responses:
 *       201:
 *         description: Appointment created successfully
 */
export async function createPublicAppointment(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const input = createPublicAppointmentSchema.parse(req.body);
        const appointment = await appointmentsService.createPublic(input);
        sendCreated(res, appointment, 'Appointment request submitted successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/appointments/public/{id}:
 *   get:
 *     tags: [Appointments]
 *     summary: Get public appointment details for invoice
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Appointment details
 */
export async function getPublicAppointmentById(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const appointment = await appointmentsService.findPublicById(req.params.id as string);
        sendSuccess(res, appointment);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/appointments:
 *   get:
 *     tags: [Appointments]
 *     summary: List appointments
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
 *         name: patientId
 *         schema:
 *           type: string
 *       - in: query
 *         name: doctorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of appointments
 */
export async function getAppointments(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const query = appointmentQuerySchema.parse(req.query);
        const result = await appointmentsService.findAll(query);
        sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/appointments/{id}:
 *   get:
 *     tags: [Appointments]
 *     summary: Get appointment by ID
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
 *         description: Appointment details
 */
export async function getAppointmentById(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const appointment = await appointmentsService.findById(req.params.id as string);
        sendSuccess(res, appointment);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/appointments/{id}:
 *   patch:
 *     tags: [Appointments]
 *     summary: Update appointment
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
 *         description: Appointment updated successfully
 */
export async function updateAppointment(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const input = updateAppointmentSchema.parse(req.body);
        const appointment = await appointmentsService.update(req.params.id as string, input);
        sendSuccess(res, appointment, 'Appointment updated successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/appointments/{id}:
 *   delete:
 *     tags: [Appointments]
 *     summary: Cancel appointment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Appointment cancelled
 */
export async function deleteAppointment(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        await appointmentsService.delete(req.params.id as string);
        sendNoContent(res);
    } catch (error) {
        next(error);
    }
}
