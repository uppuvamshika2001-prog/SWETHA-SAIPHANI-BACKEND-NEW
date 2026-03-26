import { labService } from '@/modules/lab/lab.service.js';
import { createLabOrderSchema, createLabResultSchema, labOrderQuerySchema, createLabTestSchema, updateLabTestSchema } from '@/modules/lab/lab.types.js';
import { sendSuccess, sendCreated } from '@/utils/response.js';
import { logger } from '@/utils/logger.js';
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
export async function createLabOrder(req, res, next) {
    try {
        const input = createLabOrderSchema.parse(req.body);
        const order = await labService.createOrder(req.user.userId, req.user.role, input);
        sendCreated(res, order, 'Lab order created successfully');
    }
    catch (error) {
        logger.error({ context: 'LabController.createLabOrder', error, body: req.body }, 'Failed to create lab order');
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
export async function getLabOrders(req, res, next) {
    try {
        const query = labOrderQuerySchema.parse(req.query);
        const result = await labService.getOrders(query);
        sendSuccess(res, result);
    }
    catch (error) {
        const requestId = req.headers['x-request-id'] || 'unknown';
        logger.error({
            context: 'LabController.getLabOrders',
            requestId,
            query: req.query,
            error: error.message,
            code: error.code,
            stack: error.stack
        }, `Request ${requestId} failed`);
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
export async function getMyLabOrders(req, res, next) {
    try {
        const query = labOrderQuerySchema.parse(req.query);
        const result = await labService.getMyOrders(req.user.userId, query);
        sendSuccess(res, result);
    }
    catch (error) {
        const requestId = req.headers['x-request-id'] || 'unknown';
        logger.error({
            context: 'LabController.getMyLabOrders',
            requestId,
            query: req.query,
            error: error.message,
            code: error.code,
            stack: error.stack
        }, `Request ${requestId} failed`);
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
export async function getLabOrder(req, res, next) {
    try {
        const order = await labService.getOrder(req.params.id);
        sendSuccess(res, order);
    }
    catch (error) {
        logger.error({ context: 'LabController.getLabOrder', error, orderId: req.params.id }, 'Failed to get lab order');
        next(error);
    }
}
export async function getOrderParameters(req, res, next) {
    try {
        const parameters = await labService.getOrderParameters(req.params.orderId);
        res.status(200).json(parameters); // Return direct JSON to match frontend expectations
    }
    catch (error) {
        logger.error({ context: 'LabController.getOrderParameters', error, orderId: req.params.orderId }, `Error fetching parameters for order ${req.params.orderId}`);
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
 *                 enum: [ORDERED, PAYMENT_PENDING, READY_FOR_SAMPLE_COLLECTION, SAMPLE_COLLECTED, IN_PROGRESS, COMPLETED, CANCELLED]
 *     responses:
 *       200:
 *         description: Order status updated
 */
export async function updateLabOrderStatus(req, res, next) {
    try {
        const { status } = z.object({ status: z.string() }).parse(req.body);
        const order = await labService.updateOrderStatus(req.params.id, status);
        sendSuccess(res, order, 'Order status updated');
    }
    catch (error) {
        logger.error({ context: 'LabController.updateLabOrderStatus', error, orderId: req.params.id, body: req.body }, 'Failed to update lab order status');
        next(error);
    }
}
/**
 * @swagger
 * /api/lab/orders/{id}/confirm-payment:
 *   patch:
 *     tags: [Lab]
 *     summary: Confirm payment for a lab order
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
 *         description: Payment confirmed and order ready for collection
 */
export async function confirmLabOrderPayment(req, res, next) {
    try {
        const order = await labService.confirmPayment(req.params.id);
        sendSuccess(res, order, 'Payment confirmed successfully');
    }
    catch (error) {
        logger.error({ context: 'LabController.confirmLabOrderPayment', error, orderId: req.params.id }, 'Failed to confirm lab order payment');
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
export async function submitLabResult(req, res, next) {
    try {
        const input = createLabResultSchema.parse(req.body);
        const result = await labService.submitResult(req.user.userId, input);
        sendCreated(res, result, 'Lab result submitted successfully');
    }
    catch (error) {
        logger.error({ context: 'LabController.submitLabResult', error, body: req.body }, 'Failed to submit lab result');
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
export async function getLabResult(req, res, next) {
    try {
        const result = await labService.getResult(req.params.id);
        sendSuccess(res, result);
    }
    catch (error) {
        logger.error({ context: 'LabController.getLabResult', error, resultId: req.params.id }, 'Failed to get lab result');
        next(error);
    }
}
/**
 * @swagger
 * /api/lab/results/{id}:
 *   delete:
 *     tags: [Lab]
 *     summary: Delete a lab result
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
 *         description: Lab result deleted successfully
 */
export async function deleteLabResult(req, res, next) {
    try {
        await labService.deleteResult(req.params.id);
        sendSuccess(res, null, 'Lab result deleted successfully');
    }
    catch (error) {
        logger.error({ context: 'LabController.deleteLabResult', error, resultId: req.params.id }, 'Failed to delete lab result');
        next(error);
    }
}
// Lab Test Catalog Handlers
export async function createLabTest(req, res, next) {
    try {
        const input = createLabTestSchema.parse(req.body);
        const test = await labService.createTest(input);
        sendCreated(res, test, 'Lab test created successfully');
    }
    catch (error) {
        logger.error({ context: 'LabController.createLabTest', error, body: req.body }, 'Failed to create lab test');
        next(error);
    }
}
export async function getLabTests(req, res, next) {
    try {
        const search = req.query.search;
        const tests = await labService.getAllTests(search);
        sendSuccess(res, tests);
    }
    catch (error) {
        logger.error({ context: 'LabController.getLabTests', error, query: req.query }, 'Failed to fetch lab tests');
        next(error);
    }
}
export async function updateLabTest(req, res, next) {
    try {
        const input = updateLabTestSchema.parse(req.body);
        const test = await labService.updateTest(req.params.id, input);
        sendSuccess(res, test, 'Lab test updated successfully');
    }
    catch (error) {
        logger.error({ context: 'LabController.updateLabTest', error, testId: req.params.id, body: req.body }, 'Failed to update lab test');
        next(error);
    }
}
export async function deleteLabTest(req, res, next) {
    try {
        await labService.deleteTest(req.params.id);
        sendSuccess(res, null, 'Lab test deleted successfully');
    }
    catch (error) {
        logger.error({ context: 'LabController.deleteLabTest', error, testId: req.params.id }, 'Failed to delete lab test');
        next(error);
    }
}
/**
 * @swagger
 * /api/lab/orders/{id}:
 *   delete:
 *     summary: Delete a lab order by ID
 *     tags: [Lab]
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
 *         description: Lab order deleted successfully
 */
export async function deleteLabOrder(req, res, next) {
    try {
        await labService.deleteTestOrder(req.params.id);
        sendSuccess(res, null, 'Lab order deleted successfully');
    }
    catch (error) {
        logger.error({ context: 'LabController.deleteLabOrder', error, orderId: req.params.id }, 'Failed to delete lab order');
        next(error);
    }
}
export async function downloadLabReport(req, res, next) {
    try {
        const id = req.params.id;
        const pdfBuffer = await labService.generateReportPDF(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Lab_Report_${id}.pdf`);
        res.send(pdfBuffer);
    }
    catch (error) {
        logger.error({ context: 'LabController.downloadLabReport', error, reportId: req.params.id }, 'Failed to download lab report');
        next(error);
    }
}
//# sourceMappingURL=lab.controller.js.map