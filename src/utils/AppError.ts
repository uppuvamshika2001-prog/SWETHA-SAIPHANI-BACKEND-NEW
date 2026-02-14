/**
 * Custom Application Error Class
 * 
 * Base error class for all operational errors in the application.
 * Operational errors are expected errors that we can handle gracefully.
 * 
 * Features:
 * - Status code for HTTP responses
 * - Error code for frontend identification
 * - isOperational flag to distinguish from programming errors
 * - Timestamp for logging and debugging
 * - Request ID support for tracing
 */

export interface ErrorDetails {
    field?: string;
    value?: unknown;
    constraint?: string;
}

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;
    public readonly timestamp: string;
    public readonly details?: ErrorDetails[];

    constructor(
        message: string,
        statusCode = 400,
        code = 'APP_ERROR',
        isOperational = true,
        details?: ErrorDetails[]
    ) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        this.details = details;

        // Maintains proper stack trace for where our error was thrown
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Serialize error for API response (safe for client)
     */
    toJSON() {
        return {
            success: false,
            error: {
                code: this.code,
                message: this.message,
                ...(this.details && { details: this.details }),
            },
            timestamp: this.timestamp,
        };
    }
}

/**
 * Validation Error - 400 Bad Request
 * Use when request data fails validation
 */
export class ValidationError extends AppError {
    constructor(message: string, details?: ErrorDetails[]) {
        super(message, 400, 'VALIDATION_ERROR', true, details);
    }
}

/**
 * Authentication Error - 401 Unauthorized
 * Use when user is not authenticated or credentials are invalid
 */
export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', code = 'AUTH_UNAUTHORIZED') {
        super(message, 401, code);
    }
}

/**
 * Invalid Credentials Error - 401 Unauthorized
 * Specific error for login failures
 */
export class InvalidCredentialsError extends AppError {
    constructor(message = 'Invalid email or password') {
        super(message, 401, 'AUTH_INVALID_CREDENTIALS');
    }
}

/**
 * Token Error - 401 Unauthorized
 * Use for JWT-related errors
 */
export class TokenError extends AppError {
    constructor(message = 'Invalid or expired token', code = 'AUTH_TOKEN_ERROR') {
        super(message, 401, code);
    }
}

/**
 * Forbidden Error - 403 Forbidden
 * Use when user is authenticated but not authorized
 */
export class ForbiddenError extends AppError {
    constructor(message = 'Access forbidden', code = 'AUTH_FORBIDDEN') {
        super(message, 403, code);
    }
}

/**
 * Not Found Error - 404 Not Found
 * Use when a requested resource doesn't exist
 */
export class NotFoundError extends AppError {
    constructor(resource = 'Resource', code = 'NOT_FOUND') {
        super(`${resource} not found`, 404, code);
    }
}

/**
 * Conflict Error - 409 Conflict
 * Use when there's a conflict with existing data (e.g., duplicate email)
 */
export class ConflictError extends AppError {
    constructor(message: string, code = 'CONFLICT') {
        super(message, 409, code);
    }
}

/**
 * Unprocessable Entity Error - 422
 * Use when request is syntactically correct but semantically wrong
 */
export class UnprocessableEntityError extends AppError {
    constructor(message: string, details?: ErrorDetails[]) {
        super(message, 422, 'UNPROCESSABLE_ENTITY', true, details);
    }
}

/**
 * Rate Limit Error - 429 Too Many Requests
 * Use when rate limit is exceeded
 */
export class RateLimitError extends AppError {
    constructor(message = 'Too many requests, please try again later') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}

/**
 * Internal Server Error - 500
 * Use for unexpected server errors (non-operational)
 */
export class InternalError extends AppError {
    constructor(message = 'Internal server error') {
        super(message, 500, 'INTERNAL_ERROR', false);
    }
}

/**
 * Database Error - 500
 * Use for database-related failures
 */
export class DatabaseError extends AppError {
    constructor(message = 'Database operation failed') {
        super(message, 500, 'DATABASE_ERROR', false);
    }
}

/**
 * Service Unavailable Error - 503
 * Use when a service is temporarily unavailable
 */
export class ServiceUnavailableError extends AppError {
    constructor(message = 'Service temporarily unavailable') {
        super(message, 503, 'SERVICE_UNAVAILABLE', false);
    }
}

/**
 * Check if an error is an operational error (expected error we can handle)
 */
export function isOperationalError(error: Error): boolean {
    if (error instanceof AppError) {
        return error.isOperational;
    }
    return false;
}
