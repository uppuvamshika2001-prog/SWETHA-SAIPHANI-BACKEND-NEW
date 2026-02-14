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
            sendUnauthorized(res, 'User not found');
            return;
        }

        if (user.status !== 'ACTIVE') {
            sendUnauthorized(res, 'User account is disabled');
            return;
        }

        req.user = decoded;
        next();
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'TokenExpiredError') {
                sendUnauthorized(res, 'Token expired');
                return;
            }
            if (error.name === 'JsonWebTokenError') {
                sendUnauthorized(res, 'Invalid token');
                return;
            }
        }
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
