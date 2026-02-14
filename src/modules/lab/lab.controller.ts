import { Request, Response, NextFunction } from 'express';
import { labService } from '@/modules/lab/lab.service.js';
import { createLabOrderSchema, createLabResultSchema, labOrderQuerySchema } from '@/modules/lab/lab.types.js';
import { sendSuccess, sendCreated } from '@/utils/response.js';
import { z } from 'zod';

/**
 * @swagger
 * /api/lab/orders:
 *   post:
 *     tags: [Lab]
 *     summary: Create a lab test order
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId, testName]
 *             properties:
 *               patientId:
 *                 type: string
 *               testName:
 *                 type: string
 *               testCode:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [normal, urgent, stat]
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Lab order created
 */
export async function createLabOrder(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const input = createLabOrderSchema.parse(req.body);
        const order = await labService.createOrder(req.user!.userId, input);
        sendCreated(res, order, 'Lab order created successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/lab/orders:
 *   get:
 *     tags: [Lab]
 *     summary: List lab orders
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
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of lab orders
 */
export async function getLabOrders(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const query = labOrderQuerySchema.parse(req.query);
        const result = await labService.getOrders(query);
        sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/lab/orders/my-orders:
 *   get:
 *     tags: [Lab]
 *     summary: Get lab orders created by the current doctor
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
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of doctor's lab orders
 */
export async function getMyLabOrders(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const query = labOrderQuerySchema.parse(req.query);
        const result = await labService.getMyOrders(req.user!.userId, query);
        sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/lab/orders/{id}:
 *   get:
 *     tags: [Lab]
 *     summary: Get lab order by ID
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
 *         description: Lab order details
 */
export async function getLabOrder(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const order = await labService.getOrder(req.params.id as string);
        sendSuccess(res, order);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/lab/orders/{id}/status:
 *   patch:
 *     tags: [Lab]
 *     summary: Update lab order status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ORDERED, SAMPLE_COLLECTED, IN_PROGRESS, COMPLETED, CANCELLED]
 *     responses:
 *       200:
 *         description: Order status updated
 */
export async function updateLabOrderStatus(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { status } = z.object({ status: z.string() }).parse(req.body);
        const order = await labService.updateOrderStatus(req.params.id as string, status);
        sendSuccess(res, order, 'Order status updated');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/lab/results:
 *   post:
 *     tags: [Lab]
 *     summary: Submit lab test result
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, result]
 *             properties:
 *               orderId:
 *                 type: string
 *               result:
 *                 type: object
 *                 properties:
 *                   parameters:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         value:
 *                           type: string
 *                         unit:
 *                           type: string
 *                         normalRange:
 *                           type: string
 *               interpretation:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Lab result submitted
 */
export async function submitLabResult(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const input = createLabResultSchema.parse(req.body);
        const result = await labService.submitResult(req.user!.userId, input);
        sendCreated(res, result, 'Lab result submitted successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/lab/results/{id}:
 *   get:
 *     tags: [Lab]
 *     summary: Get lab result by ID
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
 *         description: Lab result details
 */
export async function getLabResult(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const result = await labService.getResult(req.params.id as string);
        sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
}
