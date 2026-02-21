import dotenv from 'dotenv';

dotenv.config();

export const config = {
    // Server
    port: parseInt(process.env.PORT || '8080', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',

    // Database
    databaseUrl: process.env.DATABASE_URL || '',

    // JWT
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || 'default-access-secret-change-me',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-me',
        accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
        refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    },

    // CORS
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000')
        .split(',')
        .map(origin => origin.trim().replace(/\/$/, '')),

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10),
        authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '100', 10),
    },
} as const;

// Validate required environment variables
export function validateEnv(): void {
    const required = ['DATABASE_URL'];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        console.error('❌ CRITICAL ERROR: Missing required environment variables:', missing.join(', '));
        console.error('Please add these to your Railway Variables tab.');
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    if (config.isProduction) {
        const productionRequired = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
        const missingProd = productionRequired.filter((key) => !process.env[key]);

        if (missingProd.length > 0) {
            console.error('❌ CRITICAL ERROR: Missing required production environment variables:', missingProd.join(', '));
            console.error('Please add JWT_ACCESS_SECRET and JWT_REFRESH_SECRET to your Railway Variables tab.');
            throw new Error(`Missing required production environment variables: ${missingProd.join(', ')}`);
        }
    }
}
