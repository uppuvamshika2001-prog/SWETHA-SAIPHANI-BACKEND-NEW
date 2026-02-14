import { Router } from 'express';
import { downloadDocument } from './download.controller.js';
import { authGuard } from '../../middleware/authGuard.js';

const router = Router();

// Protect all download routes
router.use(authGuard);

/**
 * @swagger
 * /api/downloads/{type}/{id}:
 *   get:
 *     tags: [Downloads]
 *     summary: Download a secure document (Prescription, Lab Report)
 *     description: Enforces versioning (Original vs Duplicate)
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [prescriptions, reports]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file stream
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/:type/:id', downloadDocument);

export const downloadRoutes = router;
