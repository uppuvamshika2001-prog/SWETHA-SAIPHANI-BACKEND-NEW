import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response.js';
import { config } from '../../config/index.js';

/**
 * @swagger
 * /api/upload:
 *   post:
 *     tags: [Upload]
 *     summary: Upload a file
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File uploaded successfully
 */
export async function uploadFile(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }

        const baseUrl = config.nodeEnv === 'production'
            ? 'https://api.swethasaiphani.com'
            : `http://localhost:${config.port}`;

        // Return full URL
        const fileUrl = `${baseUrl}/uploads/lab-results/${req.file.filename}`;

        sendSuccess(res, {
            url: fileUrl,
            filename: req.file.filename,
            mimetype: req.file.mimetype
        }, 'File uploaded successfully');
    } catch (error) {
        next(error);
    }
}
