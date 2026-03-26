import { createApp } from './app.js';
import { config, validateEnv } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';
import { isOperationalError } from './utils/AppError.js';
/**
 * Process Error Handlers
 * These handlers ensure the server logs and survives unexpected errors
 * rather than crashing silently.
 */
// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err.message);
    logger.fatal({
        error: err.message,
        name: err.name,
        stack: err.stack,
        type: 'uncaughtException',
    }, '💥 UNCAUGHT EXCEPTION - Server will continue running');
    // If it's an operational error, we can continue
    // If not, it might be a programming error - log but continue
    if (!isOperationalError(err)) {
        logger.error({ error: err.message }, 'Non-operational error caught - consider investigating');
    }
    // Note: In some cases, you may want to exit and restart via process manager
    // process.exit(1);
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    const errorStack = reason instanceof Error ? reason.stack : undefined;
    logger.fatal({
        reason: errorMessage,
        stack: errorStack,
        type: 'unhandledRejection',
    }, '💥 UNHANDLED PROMISE REJECTION - Server will continue running');
    // Log the promise for debugging
    logger.error({ promise: String(promise) }, 'Promise that rejected');
});
// Handle SIGTERM and SIGINT for graceful shutdown
function setupGracefulShutdown(server) {
    const shutdown = async (signal) => {
        logger.info({ signal }, '🔄 Received shutdown signal - starting graceful shutdown');
        server.close(async () => {
            logger.info('✅ HTTP server closed');
            try {
                await disconnectDatabase();
                logger.info('✅ Database connection closed');
            }
            catch (err) {
                logger.error({ err }, '❌ Error disconnecting database');
            }
            process.exit(0);
        });
        // Force shutdown after 30 seconds
        setTimeout(() => {
            logger.error('⏰ Forced shutdown after timeout (30s)');
            process.exit(1);
        }, 30000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
/**
 * Main Application Entry Point
 */
async function main() {
    try {
        logger.info('🚀 Starting server...');
        // Validate environment variables
        logger.info('📋 Validating environment...');
        validateEnv();
        logger.info('✅ Environment validated');
        // Connect to database
        logger.info('🔌 Connecting to database...');
        await connectDatabase();
        // Initialize background jobs
        logger.info('⏰ Initializing background jobs...');
        await import('./jobs/expiryAlert.job.js');
        // Create and start app
        const app = createApp();
        const HOST = '0.0.0.0';
        const PORT = Number(process.env.PORT) || config.port;
        const server = app.listen(PORT, HOST, () => {
            logger.info({ port: PORT, host: HOST, env: config.nodeEnv }, `✅ Server running on ${HOST}:${PORT}`);
            logger.info(`📚 Swagger docs available at /docs`);
            logger.info(`❤️ Health check at /health`);
            if (config.isProduction) {
                logger.info('🔒 Running in PRODUCTION mode');
            }
            else {
                logger.info('🔧 Running in DEVELOPMENT mode');
            }
        });
        // Setup graceful shutdown handlers
        setupGracefulShutdown(server);
        // Handle server errors
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                logger.fatal({ port: config.port }, `❌ Port ${config.port} is already in use`);
                process.exit(1);
            }
            else if (err.code === 'EACCES') {
                logger.fatal({ port: config.port }, `❌ Port ${config.port} requires elevated privileges`);
                process.exit(1);
            }
            else {
                logger.fatal({ err }, '❌ Server error occurred');
                process.exit(1);
            }
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.fatal({ error: errorMessage, stack: errorStack }, '❌ Failed to start server');
        process.exit(1);
    }
}
// Run the application
main();
//# sourceMappingURL=server.js.map