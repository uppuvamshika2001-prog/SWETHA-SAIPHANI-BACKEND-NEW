import { Request, Response, NextFunction } from 'express';
import { pharmacyService } from '@/modules/pharmacy/pharmacy.service.js';
import { createMedicineSchema, updateMedicineSchema, medicineQuerySchema, createBillSchema, updateBillSchema, recordPaymentSchema, createPurchaseSchema, updatePurchaseSchema, createCategorySchema } from '@/modules/pharmacy/pharmacy.types.js';
import { sendSuccess, sendCreated } from '@/utils/response.js';
import { logger } from '@/utils/logger.js';

export async function createPurchase(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // When using multipart/form-data, items arrive as a JSON string
        let body = req.body;
        if (typeof body.items === 'string') {
            body = { ...body, items: JSON.parse(body.items) };
        }
        const validated = createPurchaseSchema.parse(body);
        const fileUrl = req.file ? req.file.path.replace(/\\/g, '/') : undefined;
        const result = await pharmacyService.createPurchase({ ...validated, fileUrl } as any);
        sendCreated(res, result);
    } catch (error) {
        logger.error({ context: 'PharmacyController.createPurchase', error, body: req.body }, 'Failed to create purchase');
        next(error);
    }
}

export async function updatePurchase(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        let body = req.body;
        if (typeof body.purchaseDate === 'string' && body.purchaseDate) {
            body.purchaseDate = body.purchaseDate;
        }
        const validated = updatePurchaseSchema.parse(body);
        const fileUrl = req.file ? req.file.path.replace(/\\/g, '/') : undefined;
        const result = await pharmacyService.updatePurchase(req.params.id as string, validated, fileUrl);
        sendSuccess(res, result, 'Purchase updated successfully');
    } catch (error) {
        logger.error({ context: 'PharmacyController.updatePurchase', error, id: req.params.id }, 'Failed to update purchase');
        next(error);
    }
}

export async function deletePurchase(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        await pharmacyService.deletePurchase(req.params.id as string);
        sendSuccess(res, null, 'Purchase deleted successfully');
    } catch (error) {
        logger.error({ context: 'PharmacyController.deletePurchase', error, id: req.params.id }, 'Failed to delete purchase');
        next(error);
    }
}

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
        logger.error({ context: 'PharmacyController.createMedicine', error, body: req.body }, 'Failed to create medicine');
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
        if (query.format === 'returns') {
            res.status(200).json(result);
            return;
        }
        res.json({
            items: result.items || (Array.isArray(result) ? result : []),
            total: result.total || (Array.isArray(result) ? result.length : 0)
        });
    } catch (error) {
        logger.error({ context: 'PharmacyController.getMedicines', error, query: req.query }, 'Failed to fetch medicines');
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
        logger.error({ context: 'PharmacyController.getMedicine', error, id: req.params.id }, 'Failed to fetch medicine');
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
        logger.error({ context: 'PharmacyController.updateMedicine', error, id: req.params.id, body: req.body }, 'Failed to update medicine');
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
        logger.error({ context: 'PharmacyController.deleteMedicine', error, id: req.params.id }, 'Failed to delete medicine');
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
        logger.error({ context: 'PharmacyController.createBill', error, body: req.body }, 'Failed to create bill');
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
        // use medicineQuerySchema which now includes optional format
        const query = medicineQuerySchema.parse(req.query);
        const result = await pharmacyService.getBills(query);
        sendSuccess(res, result);
    } catch (error) {
        logger.error({ context: 'PharmacyController.getBills', error, query: req.query }, 'Failed to fetch bills');
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
        logger.error({ context: 'PharmacyController.getBill', error, id: req.params.id }, 'Failed to fetch bill');
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
        logger.error({ context: 'PharmacyController.updateBill', error, id: req.params.id, body: req.body }, 'Failed to update bill');
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
        logger.error({ context: 'PharmacyController.deleteBill', error, id: req.params.id }, 'Failed to delete bill');
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
        res.json({
            items: medicines || [],
            total: medicines?.length || 0
        });
    } catch (error) {
        logger.error({ context: 'PharmacyController.getLowStockMedicines', error }, 'Failed to fetch low stock medicines');
        next(error);
    }
}

export async function getPurchases(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const result = await pharmacyService.getPurchases(req.query);
        res.json({
            items: result.items || (Array.isArray(result) ? result : []),
            total: result.total || (Array.isArray(result) ? result.length : 0)
        });
    } catch (error) {
        logger.error({ context: 'PharmacyController.getPurchases', error, query: req.query }, 'Failed to fetch purchases');
        // Safe fallback response
        sendSuccess(res, { items: [], total: 0, page: 1, limit: 10, totalPages: 0 });
    }
}

export async function getDistributorReport(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const result = await pharmacyService.getDistributorReport();
        sendSuccess(res, result);
    } catch (error) {
        logger.error({ context: 'PharmacyController.getDistributorReport', error }, 'Failed to fetch distributor report');
        // Safe fallback response
        sendSuccess(res, {
            pendingPurchases: [],
            stats: { totalAmount: 0, totalPaid: 0, totalBalance: 0, pendingCount: 0 },
            pendingByDistributor: {}
        });
    }
}

export async function getMarginReport(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const result = await pharmacyService.getMarginReport(req.query);
        res.json({
            items: result.items || result || [],
            total: result.total || result.length || 0
        });
    } catch (error) {
        logger.error({ context: 'PharmacyController.getMarginReport', error, query: req.query }, 'Failed to fetch margin report');
        next(error);
    }
}

export async function getPharmacyReports(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const result = await pharmacyService.getPharmacyReports(req.query);
        res.json({
            items: result.items || result || [],
            total: result.total || result.length || 0
        });
    } catch (error) {
        logger.error({ context: 'PharmacyController.getPharmacyReports', error, query: req.query }, 'Failed to fetch comprehensive pharmacy reports');
        next(error);
    }
}

export async function recordPayment(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const validated = recordPaymentSchema.parse(req.body);
        const result = await pharmacyService.recordPayment(validated);
        sendSuccess(res, result);
    } catch (error) {
        logger.error({ context: 'PharmacyController.recordPayment', error, body: req.body }, 'Failed to record payment');
        next(error);
    }
}

export async function getPurchasePayments(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const result = await pharmacyService.getPurchasePayments(req.params.id as string);
        sendSuccess(res, result);
    } catch (error) {
        logger.error({ context: 'PharmacyController.getPurchasePayments', error, id: req.params.id }, 'Failed to fetch purchase payments');
        sendSuccess(res, []);
    }
}

/**
 * @swagger
 * /api/pharmacy/returns:
 *   post:
 *     tags: [Pharmacy]
 *     summary: Process a patient medicine return
 *     security:
 *       - bearerAuth: []
 */
export async function processReturn(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const pharmacistId = (req as any).user?.userId;
        const result = await pharmacyService.processReturn({ ...req.body, pharmacistId });
        sendCreated(res, result, 'Return processed successfully');
    } catch (error) {
        logger.error({ context: 'PharmacyController.processReturn', error, body: req.body }, 'Failed to process return');
        next(error);
    }
}

/**
 * @swagger
 * /api/pharmacy/returns:
 *   get:
 *     tags: [Pharmacy]
 *     summary: Get medicine return history
 *     security:
 *       - bearerAuth: []
 */
export async function getReturns(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const result = await pharmacyService.getReturns(req.query);
        res.json({
            items: result.items || (Array.isArray(result) ? result : []),
            total: result.total || (Array.isArray(result) ? result.length : 0)
        });
    } catch (error) {
        logger.error({ context: 'PharmacyController.getReturns', error, query: req.query }, 'Failed to fetch returns');
        next(error);
    }
}

/**
 * @swagger
 * /api/pharmacy/stock-returns:
 *   post:
 *     tags: [Pharmacy]
 *     summary: Process a stock return to distributor
 *     security:
 *       - bearerAuth: []
 */
export async function processStockReturn(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const pharmacistId = (req as any).user?.userId;
        const result = await pharmacyService.processStockReturn({ ...req.body, pharmacistId });
        sendCreated(res, result, 'Stock return processed successfully');
    } catch (error) {
        logger.error({ context: 'PharmacyController.processStockReturn', error, body: req.body }, 'Failed to process stock return');
        next(error);
    }
}

/**
 * @swagger
 * /api/pharmacy/stock-returns:
 *   get:
 *     tags: [Pharmacy]
 *     summary: Get stock return history
 *     security:
 *       - bearerAuth: []
 */
export async function getStockReturns(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const result: any = await pharmacyService.getStockReturns(req.query);
        sendSuccess(res, result);
    } catch (error) {
        logger.error({ context: 'PharmacyController.getStockReturns', error, query: req.query }, 'Failed to fetch stock returns');
        next(error);
    }
}

export async function getCategories(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const result = await pharmacyService.getCategories();
        res.json({
            items: result || [],
            total: result?.length || 0
        });
    } catch (error) {
        logger.error({ context: 'PharmacyController.getCategories', error }, 'Failed to fetch pharmacy categories');
        next(error);
    }
}

export async function createCategory(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const result = await pharmacyService.createCategory(req.body);
        sendCreated(res, result, 'Category created successfully');
    } catch (error) {
        logger.error({ context: 'PharmacyController.createCategory', error, body: req.body }, 'Failed to create pharmacy category');
        next(error);
    }
}

export async function deleteCategory(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        await pharmacyService.deleteCategory(req.params.id as string);
        sendSuccess(res, null, 'Category deleted successfully');
    } catch (error) {
        logger.error({ context: 'PharmacyController.deleteCategory', error, params: req.params }, 'Failed to delete pharmacy category');
        next(error);
    }
}
