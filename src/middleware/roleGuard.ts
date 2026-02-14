import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { sendForbidden, sendUnauthorized } from '../utils/response.js';

export function roleGuard(...allowedRoles: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            sendUnauthorized(res, 'Authentication required');
            return;
        }

        const userRole = (req.user.role as string).toUpperCase();
        const allowed = allowedRoles.map(r => (r as string).toUpperCase());

        if (!allowed.includes(userRole)) {
            console.log(`Role Guard Failed: User Role: ${req.user.role} (normalized: ${userRole}), Allowed: ${allowed.join(', ')}`);
            sendForbidden(res, `Insufficient permissions. Your role is: ${req.user.role}. Allowed: ${allowed.join(', ')}`);
            return;
        }

        next();
    };
}

// Convenience role guards for common use cases
export const adminOnly = roleGuard(UserRole.ADMIN);
export const doctorOnly = roleGuard(UserRole.DOCTOR);
export const pharmacistOnly = roleGuard(UserRole.PHARMACIST);
export const labTechOnly = roleGuard(UserRole.LAB_TECHNICIAN);

export const staffOnly = roleGuard(
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
    UserRole.PHARMACIST,
    UserRole.LAB_TECHNICIAN
);

export const clinicalStaff = roleGuard(
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST
);

export const medicalStaff = roleGuard(
    UserRole.ADMIN,
    UserRole.DOCTOR
);

export const medicalReadAccess = roleGuard(
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.PHARMACIST
);

// Billing access - only ADMIN and RECEPTIONIST can generate bills
export const billingAccess = roleGuard(
    UserRole.ADMIN,
    UserRole.RECEPTIONIST
);
