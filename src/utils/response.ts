import { Response } from 'express';

/**
 * Standard API Response Interface (backward compatible)
 */
export interface ApiResponse<T = unknown> {
    status: 'success' | 'error';
    data?: T;
    message?: string;
    code?: number;
}

/**
 * Send a successful response with data
 * @param res Express response object
 * @param data The data to send
 * @param message Optional success message
 * @param statusCode HTTP status code (default: 200)
 */
export function sendSuccess<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode = 200
): Response {
    const response: ApiResponse<T> = {
        status: 'success',
        data,
    };

    if (message) {
        response.message = message;
    }

    return res.status(statusCode).json(response);
}

/**
 * Send an error response
 * @param res Express response object
 * @param message Error message
 * @param statusCode HTTP status code (default: 400)
 */
export function sendError(
    res: Response,
    message: string,
    statusCode = 400
): Response {
    const response: ApiResponse = {
        status: 'error',
        message,
        code: statusCode,
    };

    return res.status(statusCode).json(response);
}

/**
 * Send a 201 Created response
 */
export function sendCreated<T>(res: Response, data: T, message?: string): Response {
    return sendSuccess(res, data, message, 201);
}

/**
 * Send a 204 No Content response
 */
export function sendNoContent(res: Response): Response {
    return res.status(204).send();
}

/**
 * Send a 404 Not Found response
 */
export function sendNotFound(res: Response, message = 'Resource not found'): Response {
    return sendError(res, message, 404);
}

/**
 * Send a 401 Unauthorized response
 */
export function sendUnauthorized(res: Response, message = 'Unauthorized'): Response {
    return sendError(res, message, 401);
}

/**
 * Send a 403 Forbidden response
 */
export function sendForbidden(res: Response, message = 'Forbidden'): Response {
    return sendError(res, message, 403);
}

/**
 * Send a 400 Bad Request response
 */
export function sendBadRequest(res: Response, message: string): Response {
    return sendError(res, message, 400);
}

/**
 * Send a 500 Internal Server Error response
 * Note: Never expose internal error details in production
 */
export function sendInternalError(res: Response, message = 'Internal server error'): Response {
    return sendError(res, message, 500);
}
