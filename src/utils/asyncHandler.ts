import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch any unhandled promise rejections
 * and forward them to Express error handling middleware.
 * 
 * This ensures that async routes never crash the server due to uncaught exceptions.
 * 
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *     const users = await userService.findAll();
 *     res.json(users);
 * }));
 */
type AsyncRequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
) => Promise<void | Response>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Safe wrapper for any async function that might throw
 * Returns a tuple of [error, result] similar to Go-style error handling
 * 
 * @example
 * const [error, user] = await tryCatch(userService.findById(id));
 * if (error) {
 *     return next(new NotFoundError('User not found'));
 * }
 */
export async function tryCatch<T>(
    promise: Promise<T>
): Promise<[Error, null] | [null, T]> {
    try {
        const result = await promise;
        return [null, result];
    } catch (error) {
        return [error as Error, null];
    }
}
