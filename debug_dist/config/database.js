import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
export const prisma = global.prisma || new PrismaClient({
    log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
    ],
});
if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
}
// Log queries in development
prisma.$on('query', (e) => {
    if (process.env.NODE_ENV === 'development') {
        logger.debug({ query: e.query, duration: `${e.duration}ms` }, 'Database query');
    }
});
export async function connectDatabase() {
    try {
        await prisma.$connect();
        logger.info('Database connected successfully');
        // Ensure partial unique index on lab_tests.code for active records only
        // This allows inactive/soft-deleted tests to have duplicate codes
        try {
            await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "lab_tests_code_key"`);
            await prisma.$executeRawUnsafe(`
                CREATE UNIQUE INDEX IF NOT EXISTS "lab_tests_code_active_unique"
                ON "lab_tests"(code)
                WHERE "is_active" = true
            `);
            logger.info('Partial unique index on lab_tests.code ensured');
        }
        catch (indexError) {
            logger.warn({ error: indexError }, 'Could not create partial unique index on lab_tests (non-fatal)');
        }
    }
    catch (error) {
        logger.error({ error }, 'Failed to connect to database');
        throw error;
    }
}
export async function disconnectDatabase() {
    await prisma.$disconnect();
    logger.info('Database disconnected');
}
//# sourceMappingURL=database.js.map