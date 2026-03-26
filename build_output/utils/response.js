/**
 * Send a successful response with data
 * @param res Express response object
 * @param data The data to send
 * @param message Optional success message
 * @param statusCode HTTP status code (default: 200)
 */
export function sendSuccess(res, data, message, statusCode = 200) {
    const response = {
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
export function sendError(res, message, statusCode = 400) {
    const response = {
        status: 'error',
        message,
        code: statusCode,
    };
    return res.status(statusCode).json(response);
}
/**
 * Send a 201 Created response
 */
export function sendCreated(res, data, message) {
    return sendSuccess(res, data, message, 201);
}
/**
 * Send a 204 No Content response
 */
export function sendNoContent(res) {
    return res.status(204).send();
}
/**
 * Send a 404 Not Found response
 */
export function sendNotFound(res, message = 'Resource not found') {
    return sendError(res, message, 404);
}
/**
 * Send a 401 Unauthorized response
 */
export function sendUnauthorized(res, message = 'Unauthorized') {
    return sendError(res, message, 401);
}
/**
 * Send a 403 Forbidden response
 */
export function sendForbidden(res, message = 'Forbidden') {
    return sendError(res, message, 403);
}
/**
 * Send a 400 Bad Request response
 */
export function sendBadRequest(res, message) {
    return sendError(res, message, 400);
}
/**
 * Send a 500 Internal Server Error response
 * Note: Never expose internal error details in production
 */
export function sendInternalError(res, message = 'Internal server error') {
    return sendError(res, message, 500);
}
//# sourceMappingURL=response.js.map