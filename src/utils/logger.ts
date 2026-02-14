import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
    level: config.isProduction ? 'info' : 'debug',
    transport: config.isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
    redact: {
        paths: ['password', 'passwordHash', 'token', 'refreshToken', 'accessToken'],
        censor: '[REDACTED]',
    },
    formatters: {
        level: (label) => ({ level: label }),
    },
});

export function createChildLogger(context: string) {
    return logger.child({ context });
}
