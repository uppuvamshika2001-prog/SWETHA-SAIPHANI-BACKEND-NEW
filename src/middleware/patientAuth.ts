
import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/config/database.js';
import { UserRole } from '@prisma/client';
import { sendForbidden, sendUnauthorized } from '@/utils/response.js';

/**
 * Middleware to allow access if:
 * 1. User is Staff (ADMIN, DOCTOR, RECEPTIONIST, PHARMACIST, LAB_TECHNICIAN)
 * 2. User is PATIENT and the requested resource belongs to them
 * 
 * @param allowedRoles Optional list of staff roles allowed to access without ownership check
 */
export function patientAccessGuard(
    patientIdParam: string = 'id',
    allowedRoles: UserRole[] = [
        UserRole.ADMIN,
        UserRole.DOCTOR,
        UserRole.RECEPTIONIST,
        UserRole.PHARMACIST,
        UserRole.LAB_TECHNICIAN
    ]
) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                console.log('PatientAccessGuard: No user found in request');
                sendUnauthorized(res, 'Authentication required');
                return;
            }

            const userRole = (req.user.role as string).toUpperCase();

            // Normalize allowed roles
            const normalizedAllowedRoles = allowedRoles.map(r => (r as string).toUpperCase());

            console.log(`PatientAccessGuard: User Role: ${userRole}, User ID: ${req.user.userId}`);

            // 1. If user is staff, allow access
            if (normalizedAllowedRoles.includes(userRole)) {
                console.log('PatientAccessGuard: Staff Access Granted');
                next();
                return;
            }

            // 2. If user is PATIENT, verify ownership strictly by their UHID
            if (userRole === 'PATIENT') {
                const requestedPatientId = req.params[patientIdParam] as string;
                console.log(`PatientAccessGuard: Checking ownership for param '${patientIdParam}', value: ${requestedPatientId}`);

                if (!requestedPatientId) {
                    console.log('PatientAccessGuard: Missing patient ID param');
                    sendForbidden(res, 'Invalid request context');
                    return;
                }

                // Find the patient record(s) directly linked to this user's account
                const usersPatients = await prisma.patient.findMany({
                    where: { userId: req.user.userId },
                    select: { uhid: true }
                });

                if (usersPatients.length === 0) {
                    console.log('PatientAccessGuard: No patient profile found for user');
                    sendForbidden(res, 'Patient profile not found for this user');
                    return;
                }

                // Direct match only - removes "Smart Linking" for maximum privacy
                const isOwned = usersPatients.some(p => p.uhid === requestedPatientId);

                if (isOwned) {
                    console.log('PatientAccessGuard: Ownership verified. Access Granted.');
                    next();
                    return;
                }

                console.log(`PatientAccessGuard: Access denied for ${requestedPatientId}`);
                sendForbidden(res, 'Access denied: You can only view your own records');
                return;
            }

            console.log(`PatientAccessGuard: Role ${userRole} not allowed`);
            sendForbidden(res, 'Insufficient permissions');
        } catch (error) {
            console.error('PatientAccessGuard Error:', error);
            next(error);
        }
    };
}
