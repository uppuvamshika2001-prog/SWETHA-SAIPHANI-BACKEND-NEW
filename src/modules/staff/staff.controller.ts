import { Request, Response, NextFunction } from 'express';
import { staffService } from './staff.service.js';
import { createStaffSchema, updateStaffSchema, staffQuerySchema } from './staff.types.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response.js';

/**
 * @swagger
 * /api/staff:
 *   post:
 *     tags: [Staff]
 *     summary: Create a new staff member
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, role, firstName, lastName]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, DOCTOR, RECEPTIONIST, PHARMACIST, LAB_TECHNICIAN]
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               specialization:
 *                 type: string
 *               department:
 *                 type: string
 *               licenseNo:
 *                 type: string
 *     responses:
 *       201:
 *         description: Staff created successfully
 */
export async function createStaff(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const input = createStaffSchema.parse(req.body);
        const staff = await staffService.create(input);
        sendCreated(res, staff, 'Staff created successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/staff:
 *   get:
 *     tags: [Staff]
 *     summary: List all staff members
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
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of staff
 */
export async function getStaff(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const query = staffQuerySchema.parse(req.query);
        const result = await staffService.findAll(query);
        sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/staff/{id}:
 *   get:
 *     tags: [Staff]
 *     summary: Get staff member by ID
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
 *         description: Staff details
 */
export async function getStaffById(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const staff = await staffService.findById(req.params.id as string);
        sendSuccess(res, staff);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/staff/{id}:
 *   patch:
 *     tags: [Staff]
 *     summary: Update staff member
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               specialization:
 *                 type: string
 *               department:
 *                 type: string
 *               licenseNo:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, DISABLED, PENDING]
 *     responses:
 *       200:
 *         description: Staff updated successfully
 */
export async function updateStaff(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const input = updateStaffSchema.parse(req.body);
        const staff = await staffService.update(req.params.id as string, input);
        sendSuccess(res, staff, 'Staff updated successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/staff/{id}:
 *   delete:
 *     tags: [Staff]
 *     summary: Disable staff member (soft delete)
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
 *         description: Staff disabled successfully
 */
export async function deleteStaff(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        await staffService.disable(req.params.id as string);
        sendNoContent(res);
    } catch (error) {
        next(error);
    }
}
