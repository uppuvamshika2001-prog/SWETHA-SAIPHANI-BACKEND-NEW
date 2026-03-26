import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
function parseExpiry(expiry) {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
        throw new Error(`Invalid expiry format: ${expiry}`);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers = {
        s: 1,
        m: 60,
        h: 3600,
        d: 86400,
    };
    return value * (multipliers[unit] || 60);
}
export function generateAccessToken(payload) {
    const options = {
        expiresIn: parseExpiry(config.jwt.accessExpiry),
    };
    return jwt.sign(payload, config.jwt.accessSecret, options);
}
export function generateRefreshToken(payload) {
    const options = {
        expiresIn: parseExpiry(config.jwt.refreshExpiry),
    };
    return jwt.sign(payload, config.jwt.refreshSecret, options);
}
export function verifyAccessToken(token) {
    return jwt.verify(token, config.jwt.accessSecret);
}
export function verifyRefreshToken(token) {
    return jwt.verify(token, config.jwt.refreshSecret);
}
export function getRefreshTokenExpiry() {
    const seconds = parseExpiry(config.jwt.refreshExpiry);
    return new Date(Date.now() + seconds * 1000);
}
//# sourceMappingURL=jwt.js.map