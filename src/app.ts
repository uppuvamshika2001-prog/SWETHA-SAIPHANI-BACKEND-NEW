import express, { Application, Request, Response } from 'express';
// Force reload
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { config } from './config/index.js';
import { swaggerSpec } from './docs/swagger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';

// Import routes
import { authRoutes } from './modules/auth/index.js';
import { usersRoutes } from './modules/users/index.js';
import { staffRoutes } from './modules/staff/index.js';
import { patientsRoutes } from './modules/patients/index.js';
import { appointmentsRoutes } from './modules/appointments/index.js';
import { doctorsRoutes } from './modules/doctors/index.js';
import { pharmacyRoutes } from './modules/pharmacy/index.js';
import { labRoutes } from './modules/lab/index.js';
import { billingRoutes } from './modules/billing/index.js';
import { uploadRoutes } from './modules/upload/index.js';
import { downloadRoutes } from './modules/downloads/download.routes.js';
import { notificationRoutes } from './modules/notification/notification.routes.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): Application {
    const app = express();

    // Trust Railway's proxy (required for rate limiting)
    app.set('trust proxy', 1);

    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: config.isProduction ? undefined : false,
        crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin for images
    }));

    // CORS
    app.use(cors({
        origin: config.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires', 'X-Correlation-ID'],
    }));

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Serve uploaded files statically
    const uploadsPath = path.resolve(__dirname, '../uploads');
    app.use('/uploads', express.static(uploadsPath));

    // Request logging
    app.use(requestLogger);

    // Rate limiting
    app.use(generalRateLimiter);

    // Root route
    app.get('/', (_req: Request, res: Response) => {
        res.json({
            status: 'success',
            message: 'Welcome to Swetha Saiphani Clinics API',
            version: '1.0.0',
            docs: '/docs',
            health: '/health'
        });
    });

    // Health check with database connectivity
    app.get('/health', async (req: Request, res: Response) => {
        const correlationId = req.headers['x-correlation-id'] || `health-${Date.now()}`;
        const startTime = Date.now();

        let dbHealthy = false;
        try {
            // Import prisma dynamically to test DB
            const { prisma } = await import('./config/database.js');
            await prisma.$queryRaw`SELECT 1`;
            dbHealthy = true;
        } catch (error) {
            console.error(`[Health] DB check failed (${correlationId}):`, error);
        }

        const responseTime = Date.now() - startTime;

        res.status(dbHealthy ? 200 : 503).json({
            status: dbHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            correlationId,
            responseTimeMs: responseTime,
            services: {
                database: dbHealthy ? 'connected' : 'disconnected',
                api: 'running'
            }
        });
    });

    // Swagger docs
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Swetha Saiphani Clinics API',
    }));

    // API routes
    app.use('/api/auth', authRoutes);
    app.use('/api/users', usersRoutes);
    app.use('/api/staff', staffRoutes);
    app.use('/api/patients', patientsRoutes);
    app.use('/api/appointments', appointmentsRoutes);
    app.use('/api/billing', billingRoutes);  // MUST be before /api to prevent doctors middleware intercepting
    app.use('/api/pharmacy', pharmacyRoutes);
    app.use('/api/lab', labRoutes);
    app.use('/api/notifications', notificationRoutes);

    // Register secure download routes
    app.use('/api/downloads', downloadRoutes);

    console.log('Registering /api/upload route');
    app.use('/api/upload', uploadRoutes);
    app.use('/api', doctorsRoutes); // medical-records and prescriptions - generic /api path LAST

    // 404 handler
    app.use(notFoundHandler);

    // Global error handler
    app.use(errorHandler);

    return app;
}
