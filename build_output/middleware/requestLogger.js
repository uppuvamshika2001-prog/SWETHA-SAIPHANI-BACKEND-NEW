import { logger } from '../utils/logger.js';
export function requestLogger(req, res, next) {
    const startTime = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.socket.remoteAddress,
            userAgent: req.get('user-agent'),
            userId: req.user?.userId,
        };
        if (res.statusCode >= 400) {
            logger.warn(logData, 'Request completed with error');
        }
        else {
            logger.info(logData, 'Request completed');
        }
    });
    next();
}
//# sourceMappingURL=requestLogger.js.map