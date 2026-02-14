import { Request, Response, NextFunction } from 'express';
import { pharmacyService } from '@/modules/pharmacy/pharmacy.service.js';
import { createMedicineSchema, updateMedicineSchema, medicineQuerySchema, createBillSchema, updateBillSchema } from '@/modules/pharmacy/pharmacy.types.js';
import { sendSuccess, sendCreated } from '@/utils/response.js';

/**
 * @swagger
 * /api/pharmacy/medicines:
 *   post:
 *     tags: [Pharmacy]
 *     summary: Add new medicine to inventory
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, pricePerUnit]
 *             properties:
 *               name:
 *                 type: string
 *               genericName:
 *                 type: string
 *               manufacturer:
 *                 type: string
 *               category:
 *                 type: string
 *               unit:
 *                 type: string
 *               pricePerUnit:
 *                 type: number
 *               stockQuantity:
 *                 type: integer
 *               reorderLevel:
 *                 type: integer
 *               expiryDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Medicine added successfully
 */
export async function createMedicine(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const input = createMedicineSchema.parse(req.body);
        const medicine = await pharmacyService.createMedicine(input);
        sendCreated(res, medicine, 'Medicine added successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/pharmacy/medicines:
 *   get:
 *     tags: [Pharmacy]
 *     summary: List medicines
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
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of medicines
 */
export async function getMedicines(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const query = medicineQuerySchema.parse(req.query);
        const result = await pharmacyService.getMedicines(query);
        sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/pharmacy/medicines/{id}:
 *   get:
 *     tags: [Pharmacy]
 *     summary: Get medicine by ID
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
 *         description: Medicine details
 */
export async function getMedicine(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const medicine = await pharmacyService.getMedicine(req.params.id as string);
        sendSuccess(res, medicine);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/pharmacy/medicines/{id}:
 *   patch:
 *     tags: [Pharmacy]
 *     summary: Update medicine
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
 *         description: Medicine updated
 */
export async function updateMedicine(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const input = updateMedicineSchema.parse(req.body);
        const medicine = await pharmacyService.updateMedicine(req.params.id as string, input);
        sendSuccess(res, medicine, 'Medicine updated successfully');
    } catch (error) {
        next(error);
    }
}

export async function deleteMedicine(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        await pharmacyService.deleteMedicine(req.params.id as string);
        sendSuccess(res, null, 'Medicine deleted successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/pharmacy/bills:
 *   post:
 *     tags: [Pharmacy]
 *     summary: Create a bill (auto-decrements inventory)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId, items]
 *             properties:
 *               patientId:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     medicineId:
 *                       type: string
 *                     description:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                     unitPrice:
 *                       type: number
 *               discount:
 *                 type: number
 *               gstPercent:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Bill created
 */
export async function createBill(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const input = createBillSchema.parse(req.body);
        const bill = await pharmacyService.createBill(input);
        sendCreated(res, bill, 'Bill created successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/pharmacy/bills:
 *   get:
 *     tags: [Pharmacy]
 *     summary: List bills
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
 *         description: List of bills
 */
export async function getBills(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const query = medicineQuerySchema.parse(req.query);
        const result = await pharmacyService.getBills(query);
        sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/pharmacy/bills/{id}:
 *   get:
 *     tags: [Pharmacy]
 *     summary: Get bill by ID
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
 *         description: Bill details
 */
export async function getBill(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const bill = await pharmacyService.getBill(req.params.id as string);
        sendSuccess(res, bill);
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/pharmacy/bills/{id}:
 *   patch:
 *     tags: [Pharmacy]
 *     summary: Update bill status/payment
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
 *         description: Bill updated
 */
export async function updateBill(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const input = updateBillSchema.parse(req.body);
        const bill = await pharmacyService.updateBill(req.params.id as string, input);
        sendSuccess(res, bill, 'Bill updated successfully');
    } catch (error) {
        next(error);
    }
}

export async function deleteBill(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        await pharmacyService.deleteBill(req.params.id as string);
        sendSuccess(res, null, 'Bill deleted successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * @swagger
 * /api/pharmacy/medicines/low-stock:
 *   get:
 *     tags: [Pharmacy]
 *     summary: Get low stock medicines
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of low stock medicines
 */
export async function getLowStockMedicines(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const medicines = await pharmacyService.getLowStockMedicines();
        sendSuccess(res, medicines);
    } catch (error) {
        next(error);
    }
}
