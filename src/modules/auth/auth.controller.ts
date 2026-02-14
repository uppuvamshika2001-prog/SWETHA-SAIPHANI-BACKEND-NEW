import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import {
    loginSchema,
    registerSchema,
    refreshTokenSchema,
    changePasswordSchema,
} from './auth.types.js';
import { sendSuccess, sendNoContent } from '../../utils/response.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ValidationError } from '../../utils/AppError.js';
import { ZodError } from 'zod';

/**
 * Validate request body with Zod schema and return parsed data
 * Throws ValidationError with proper error details on failure
 */
function validateRequest<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
    try {
        return schema.parse(data);
    } catch (error) {
        if (error instanceof ZodError) {
            throw error; // Let the error handler format Zod errors
        }
        throw new ValidationError('Invalid request data');
    }
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, DOCTOR, RECEPTIONIST, PHARMACIST, LAB_TECHNICIAN, PATIENT]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
export const register = asyncHandler(async (
    req: Request,
    res: Response,
    _next: NextFunction
): Promise<void> => {
    const input = validateRequest(registerSchema, req.body);
    const result = await authService.register(input);
    sendSuccess(res, result, 'User registered successfully', 201);
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                     tokens:
 *                       type: object
 *       400:
 *         description: Validation error - missing or invalid fields
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
export const login = asyncHandler(async (
    req: Request,
    res: Response,
    _next: NextFunction
): Promise<void> => {
    // Validate input before passing to service
    const input = validateRequest(loginSchema, req.body);
    const result = await authService.login(input);
    sendSuccess(res, result, 'Login successful');
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
export const refreshToken = asyncHandler(async (
    req: Request,
    res: Response,
    _next: NextFunction
): Promise<void> => {
    const { refreshToken } = validateRequest(refreshTokenSchema, req.body);
    const tokens = await authService.refreshToken(refreshToken);
    sendSuccess(res, tokens, 'Token refreshed successfully');
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and invalidate refresh token
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       204:
 *         description: Logged out successfully
 */
export const logout = asyncHandler(async (
    req: Request,
    res: Response,
    _next: NextFunction
): Promise<void> => {
    const { refreshToken } = validateRequest(refreshTokenSchema, req.body);
    await authService.logout(refreshToken);
    sendNoContent(res);
});

/**
 * @swagger
 * /api/auth/logout-all:
 *   post:
 *     tags: [Auth]
 *     summary: Logout from all devices
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Logged out from all devices
 */
export const logoutAll = asyncHandler(async (
    req: Request,
    res: Response,
    _next: NextFunction
): Promise<void> => {
    await authService.logoutAll(req.user!.userId);
    sendNoContent(res);
});

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change user password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       204:
 *         description: Password changed successfully
 *       401:
 *         description: Current password is incorrect
 */
export const changePassword = asyncHandler(async (
    req: Request,
    res: Response,
    _next: NextFunction
): Promise<void> => {
    const input = validateRequest(changePasswordSchema, req.body);
    await authService.changePassword(req.user!.userId, input);
    sendNoContent(res);
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user info
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 */
export const me = asyncHandler(async (
    req: Request,
    res: Response,
    _next: NextFunction
): Promise<void> => {
    sendSuccess(res, {
        userId: req.user!.userId,
        email: req.user!.email,
        role: req.user!.role,
    });
});
