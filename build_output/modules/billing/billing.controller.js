import { billingService } from './billing.service.js';
import { createBillSchema, updateBillStatusSchema, billQuerySchema } from './billing.types.js';
import { sendSuccess } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';
export async function createBill(req, res, next) {
    try {
        const input = createBillSchema.parse(req.body);
        const bill = await billingService.create({
            ...input,
            creatorId: req.user?.id
        });
        sendSuccess(res, bill, 'Bill created successfully', 201);
    }
    catch (error) {
        logger.error({ context: 'BillingController.createBill', error, body: req.body }, 'Failed to create bill');
        next(error);
    }
}
export async function getBills(req, res, next) {
    try {
        const query = billQuerySchema.parse(req.query);
        const result = await billingService.findAll(query, req.user);
        sendSuccess(res, result);
    }
    catch (error) {
        next(error);
    }
}
export async function getBillById(req, res, next) {
    try {
        const bill = await billingService.findById(req.params.id);
        sendSuccess(res, bill);
    }
    catch (error) {
        next(error);
    }
}
export async function updateBillStatus(req, res, next) {
    try {
        const input = updateBillStatusSchema.parse(req.body);
        const bill = await billingService.updateStatus(req.params.id, input);
        sendSuccess(res, bill, 'Bill status updated successfully');
    }
    catch (error) {
        next(error);
    }
}
export async function getBillingStats(req, res, next) {
    try {
        const stats = await billingService.getStats();
        sendSuccess(res, stats);
    }
    catch (error) {
        next(error);
    }
}
export async function deleteBill(req, res, next) {
    try {
        await billingService.delete(req.params.id);
        sendSuccess(res, null, 'Bill deleted successfully');
    }
    catch (error) {
        next(error);
    }
}
export async function getUnbilledLabOrders(req, res, next) {
    try {
        const patientId = req.params.patientId;
        const orders = await billingService.getUnbilledLabOrders(patientId);
        sendSuccess(res, orders);
    }
    catch (error) {
        logger.error({ context: 'BillingController.getUnbilledLabOrders', error, patientId: req.params.patientId }, 'Failed to fetch unbilled lab orders');
        next(error);
    }
}
export async function getPatientBillingSummary(req, res, next) {
    try {
        const patientId = (req.params.patientId || req.query.patientId);
        if (!patientId) {
            return res.status(400).json({ status: 'error', message: 'patientId is required' });
        }
        const summary = await billingService.getPatientBillingSummary(patientId);
        sendSuccess(res, summary);
    }
    catch (error) {
        logger.error({ context: 'BillingController.getPatientBillingSummary', error, patientId: req.params.patientId || req.query.patientId }, 'Failed to fetch patient billing summary');
        next(error);
    }
}
//# sourceMappingURL=billing.controller.js.map