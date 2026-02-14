import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database.js';

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns server health status, uptime, and database connectivity
 *     responses:
 *       200:
 *         description: Server is healthy
 *       503:
 *         description: Server is unhealthy
 */
router.get('/', async (req: Request, res: Response) => {
    const correlationId = req.headers['x-correlation-id'] || `srv-${Date.now()}`;
    const startTime = Date.now();

    let dbHealthy = false;
    try {
        // Test database connectivity
        await prisma.$queryRaw`SELECT 1`;
        dbHealthy = true;
    } catch (error) {
        console.error(`[Health Check] Database error (correlationId: ${correlationId}):`, error);
    }

    const responseTime = Date.now() - startTime;
    const status = dbHealthy ? 'ok' : 'degraded';

    res.status(dbHealthy ? 200 : 503).json({
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        correlationId,
        responseTime: `${responseTime}ms`,
        services: {
            database: dbHealthy ? 'connected' : 'disconnected',
            api: 'running'
        }
    });
});

/**
 * @swagger
 * /api/health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Returns whether the server is ready to accept traffic
 */
router.get('/ready', async (req: Request, res: Response) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ ready: true });
    } catch {
        res.status(503).json({ ready: false });
    }
});

/**
 * @swagger  
 * /api/health/live:
 *   get:
 *     summary: Liveness probe
 *     description: Returns whether the server process is alive
 */
router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({ alive: true });
});

export default router;
