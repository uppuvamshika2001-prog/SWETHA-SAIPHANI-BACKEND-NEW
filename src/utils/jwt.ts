import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UserRole } from '@prisma/client';

export interface TokenPayload {
    userId: string;
    email: string;
    role: UserRole;
}

export interface DecodedToken extends JwtPayload, TokenPayload { }

function parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
        throw new Error(`Invalid expiry format: ${expiry}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
        s: 1,
        m: 60,
        h: 3600,
        d: 86400,
    };

    return value * (multipliers[unit] || 60);
}

export function generateAccessToken(payload: TokenPayload): string {
    const options: SignOptions = {
        expiresIn: parseExpiry(config.jwt.accessExpiry),
    };

    return jwt.sign(payload, config.jwt.accessSecret, options);
}

export function generateRefreshToken(payload: TokenPayload): string {
    const options: SignOptions = {
        expiresIn: parseExpiry(config.jwt.refreshExpiry),
    };

    return jwt.sign(payload, config.jwt.refreshSecret, options);
}

export function verifyAccessToken(token: string): DecodedToken {
    return jwt.verify(token, config.jwt.accessSecret) as DecodedToken;
}

export function verifyRefreshToken(token: string): DecodedToken {
    return jwt.verify(token, config.jwt.refreshSecret) as DecodedToken;
}

export function getRefreshTokenExpiry(): Date {
    const seconds = parseExpiry(config.jwt.refreshExpiry);
    return new Date(Date.now() + seconds * 1000);
}
