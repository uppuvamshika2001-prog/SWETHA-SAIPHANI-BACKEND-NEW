import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { sendError } from '../utils/response.js';

// General rate limiter for all routes
export const generalRateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        sendError(res, 'Too many requests, please try again later', 429);
    },
});

// Strict rate limiter for auth endpoints
export const authRateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.authMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        sendError(res, 'Too many authentication attempts, please try again later', 429);
    },
});
