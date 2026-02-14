import { Router } from 'express';
import {
    register,
    login,
    refreshToken,
    logout,
    logoutAll,
    changePassword,
    me,
} from './auth.controller.js';
import { authGuard } from '../../middleware/authGuard.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

// Public routes with rate limiting
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/refresh', authRateLimiter, refreshToken);

// Protected routes
router.post('/logout', authGuard, logout);
router.post('/logout-all', authGuard, logoutAll);
router.post('/change-password', authGuard, changePassword);
router.get('/me', authGuard, me);

export default router;
