export function asyncHandler(fn) {
    return (req, res, next) => {
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
export async function tryCatch(promise) {
    try {
        const result = await promise;
        return [null, result];
    }
    catch (error) {
        return [error, null];
    }
}
//# sourceMappingURL=asyncHandler.js.map