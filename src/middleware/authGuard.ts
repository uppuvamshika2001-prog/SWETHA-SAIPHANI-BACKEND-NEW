import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, DecodedToken } from '../utils/jwt.js';
import { sendUnauthorized } from '../utils/response.js';
import { prisma } from '../config/database.js';

declare global {
    namespace Express {
        interface Request {
            user?: DecodedToken;
        }
    }
}

export async function authGuard(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            console.warn(`[AuthGuard] No token provided for ${req.method} ${req.originalUrl}`);
            sendUnauthorized(res, 'No token provided');
            return;
        }

        const token = authHeader.slice(7);
        const decoded = verifyAccessToken(token);

        // Verify user still exists and is active
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, status: true },
        });

        if (!user) {
            console.warn(`[AuthGuard] User not found for userId: ${decoded.userId} on ${req.method} ${req.originalUrl}`);
            sendUnauthorized(res, 'User not found');
            return;
        }

        if (user.status !== 'ACTIVE') {
            console.warn(`[AuthGuard] User ${decoded.userId} is disabled on ${req.method} ${req.originalUrl}`);
            sendUnauthorized(res, 'User account is disabled');
            return;
        }

        req.user = decoded;
        next();
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'TokenExpiredError') {
                console.warn(`[AuthGuard] Token expired for ${req.method} ${req.originalUrl}`);
                sendUnauthorized(res, 'Token expired');
                return;
            }
            if (error.name === 'JsonWebTokenError') {
                console.warn(`[AuthGuard] Invalid token for ${req.method} ${req.originalUrl}: ${error.message}`);
                sendUnauthorized(res, 'Invalid token');
                return;
            }
        }
        console.warn(`[AuthGuard] Authentication failed for ${req.method} ${req.originalUrl}`);
        sendUnauthorized(res, 'Authentication failed');
    }
}

export function optionalAuthGuard(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            req.user = verifyAccessToken(token);
        }
    } catch {
        // Ignore errors - auth is optional
    }

    next();
}
