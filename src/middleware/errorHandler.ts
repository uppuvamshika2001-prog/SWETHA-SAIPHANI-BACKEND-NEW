import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import {
    AppError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    TokenError,
    InvalidCredentialsError,
    isOperationalError,
} from '../utils/AppError.js';

// Re-export for backward compatibility
export {
    AppError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
};

/**
 * Standard API Error Response Format (backward compatible with frontend)
 */
interface ErrorResponse {
    status: 'error';
    message: string;
    code: number;
    errorCode?: string;
    details?: unknown[];
    requestId?: string;
    // Only in development
    stack?: string;
}

/**
 * Extract request ID from headers or generate one
 */
function getRequestId(req: Request): string {
    return (req.headers['x-request-id'] as string) ||
        (req.headers['x-correlation-id'] as string) ||
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Handle Zod Validation Errors
 */
function handleZodError(err: ZodError): { message: string; code: string; details: unknown[] } {
    const details = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code,
    }));

    const message = err.errors.length === 1
        ? err.errors[0].message
        : `Validation failed: ${err.errors.length} errors found`;

    return {
        message,
        code: 'VALIDATION_ERROR',
        details,
    };
}

/**
 * Handle Prisma Database Errors
 */
function handlePrismaError(err: Prisma.PrismaClientKnownRequestError): {
    message: string;
    code: string;
    statusCode: number
} {
    switch (err.code) {
        case 'P2002': {
            // Unique constraint violation
            const target = (err.meta?.target as string[])?.join(', ') || 'field';
            return {
                message: `A record with this ${target} already exists`,
                code: 'DUPLICATE_ENTRY',
                statusCode: 409,
            };
        }
        case 'P2025':
            // Record not found
            return {
                message: 'Record not found',
                code: 'NOT_FOUND',
                statusCode: 404,
            };
        case 'P2003':
            // Foreign key constraint violation
            return {
                message: 'Related record not found',
                code: 'FOREIGN_KEY_VIOLATION',
                statusCode: 400,
            };
        case 'P2014':
            // Required relation violation
            return {
                message: 'Required relation violation',
                code: 'RELATION_VIOLATION',
                statusCode: 400,
            };
        default:
            // Log unknown Prisma errors for investigation
            logger.error({ code: err.code, meta: err.meta }, 'Unknown Prisma error');
            return {
                message: 'Database operation failed',
                code: 'DATABASE_ERROR',
                statusCode: 500,
            };
    }
}

/**
 * Handle JWT Errors
 */
function handleJWTError(err: Error): { message: string; code: string } {
    switch (err.name) {
        case 'JsonWebTokenError':
            return { message: 'Invalid token', code: 'AUTH_INVALID_TOKEN' };
        case 'TokenExpiredError':
            return { message: 'Token has expired', code: 'AUTH_TOKEN_EXPIRED' };
        case 'NotBeforeError':
            return { message: 'Token not yet valid', code: 'AUTH_TOKEN_NOT_ACTIVE' };
        default:
            return { message: 'Token verification failed', code: 'AUTH_TOKEN_ERROR' };
    }
}

/**
 * Send error response to client (backward compatible format)
 */
function sendErrorResponse(
    res: Response,
    statusCode: number,
    errorCode: string,
    message: string,
    requestId: string,
    details?: unknown[],
    stack?: string
): void {
    const response: ErrorResponse = {
        status: 'error',
        message,
        code: statusCode,
        errorCode,
        requestId,
    };

    if (details && details.length > 0) {
        response.details = details;
    }

    // Only include stack trace in development
    if (!config.isProduction && stack) {
        response.stack = stack;
    }

    res.status(statusCode).json(response);
}

/**
 * Global Error Handler Middleware
 * 
 * This middleware catches all errors thrown in the application and:
 * 1. Logs the full error details server-side
 * 2. Returns a safe, structured error response to the client
 * 3. Never exposes sensitive information or stack traces in production
 * 4. Categorizes errors appropriately (validation, auth, not found, server error)
 */
export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    const requestId = getRequestId(req);

    // Log error with full details (server-side only)
    logger.error({
        requestId,
        error: err.message,
        name: err.name,
        code: (err as AppError).code,
        statusCode: (err as AppError).statusCode,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: req.user?.userId,
        isOperational: isOperationalError(err),
    }, 'Error occurred');

    // Handle AppError and its subclasses
    if (err instanceof AppError) {
        sendErrorResponse(
            res,
            err.statusCode,
            err.code,
            err.message,
            requestId,
            err.details,
            err.stack
        );
        return;
    }

    // Handle Zod validation errors
    if (err instanceof ZodError) {
        const { message, code, details } = handleZodError(err);
        sendErrorResponse(res, 400, code, message, requestId, details, err.stack);
        return;
    }

    // Handle Prisma errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        const { message, code, statusCode } = handlePrismaError(err);
        sendErrorResponse(res, statusCode, code, message, requestId, undefined, err.stack);
        return;
    }

    // Handle Prisma validation errors
    if (err instanceof Prisma.PrismaClientValidationError) {
        sendErrorResponse(
            res,
            400,
            'DATABASE_VALIDATION_ERROR',
            'Invalid data provided',
            requestId,
            undefined,
            err.stack
        );
        return;
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError' ||
        err.name === 'TokenExpiredError' ||
        err.name === 'NotBeforeError') {
        const { message, code } = handleJWTError(err);
        sendErrorResponse(res, 401, code, message, requestId, undefined, err.stack);
        return;
    }

    // Handle SyntaxError (e.g., invalid JSON in request body)
    if (err instanceof SyntaxError && 'body' in err) {
        sendErrorResponse(
            res,
            400,
            'INVALID_JSON',
            'Invalid JSON in request body',
            requestId,
            undefined,
            err.stack
        );
        return;
    }

    // Handle TypeError (usually accessing property on undefined)
    if (err instanceof TypeError) {
        logger.error({ err }, 'TypeError - possible null/undefined access');
        sendErrorResponse(
            res,
            500,
            'INTERNAL_ERROR',
            config.isProduction ? 'Internal server error' : err.message,
            requestId,
            undefined,
            err.stack
        );
        return;
    }

    // Unknown errors - log and return safe generic message
    logger.error({
        requestId,
        error: err.message,
        name: err.name,
        stack: err.stack,
    }, 'Unhandled error type');

    sendErrorResponse(
        res,
        500,
        'INTERNAL_ERROR',
        config.isProduction ? 'Internal server error' : err.message,
        requestId,
        undefined,
        config.isProduction ? undefined : err.stack
    );
}

/**
 * Not Found Handler (404)
 * Use as the last route to catch unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
    const requestId = getRequestId(req);

    sendErrorResponse(
        res,
        404,
        'ROUTE_NOT_FOUND',
        `Route ${req.method} ${req.originalUrl} not found`,
        requestId
    );
}
