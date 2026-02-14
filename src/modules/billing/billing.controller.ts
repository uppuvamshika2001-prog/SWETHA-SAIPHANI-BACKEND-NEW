import { Request, Response, NextFunction } from 'express';
import { billingService } from './billing.service.js';
import { createBillSchema, updateBillStatusSchema, billQuerySchema } from './billing.types.js';
import { sendSuccess } from '../../utils/response.js';

export async function createBill(req: Request, res: Response, next: NextFunction) {
    try {
        const input = createBillSchema.parse(req.body);
        const bill = await billingService.create(input);
        sendSuccess(res, bill, 'Bill created successfully', 201);
    } catch (error) {
        next(error);
    }
}

export async function getBills(req: Request, res: Response, next: NextFunction) {
    try {
        const query = billQuerySchema.parse(req.query);
        const result = await billingService.findAll(query);
        sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
}

export async function getBillById(req: Request, res: Response, next: NextFunction) {
    try {
        const bill = await billingService.findById(req.params.id as string);
        sendSuccess(res, bill);
    } catch (error) {
        next(error);
    }
}

export async function updateBillStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const input = updateBillStatusSchema.parse(req.body);
        const bill = await billingService.updateStatus(req.params.id as string, input);
        sendSuccess(res, bill, 'Bill status updated successfully');
    } catch (error) {
        next(error);
    }
}

export async function getBillingStats(req: Request, res: Response, next: NextFunction) {
    try {
        const stats = await billingService.getStats();
        sendSuccess(res, stats);
    } catch (error) {
        next(error);
    }
}

export async function deleteBill(req: Request, res: Response, next: NextFunction) {
    try {
        await billingService.delete(req.params.id as string);
        sendSuccess(res, null, 'Bill deleted successfully');
    } catch (error) {
        next(error);
    }
}
