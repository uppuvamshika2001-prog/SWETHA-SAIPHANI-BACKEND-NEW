
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

            // If user is staff, allow access
            if (normalizedAllowedRoles.includes(userRole)) {
                console.log('PatientAccessGuard: Staff Access Granted');
                next();
                return;
            }

            // If user is PATIENT, verify ownership
            if (userRole === 'PATIENT') {
                const requestedPatientId = req.params[patientIdParam] as string;
                console.log(`PatientAccessGuard: Checking ownership for param '${patientIdParam}', value: ${requestedPatientId}`);

                if (!requestedPatientId) {
                    console.log('PatientAccessGuard: Missing patient ID param');
                    sendForbidden(res, 'Invalid request context');
                    return;
                }

                // 1. Find the patient record(s) linked to this user NOT just one
                const usersPatients = await prisma.patient.findMany({
                    where: { userId: req.user.userId },
                    select: { uhid: true, email: true, phone: true }
                });

                if (usersPatients.length === 0) {
                    console.log('PatientAccessGuard: No patient profile found for user');
                    sendForbidden(res, 'Patient profile not found for this user');
                    return;
                }

                // 2. Check direct match first
                if (usersPatients.some(p => p.uhid === requestedPatientId)) {
                    console.log('PatientAccessGuard: Direct match found. Access Granted.');
                    next();
                    return;
                }

                // 3. Smart Linking: Check if requestedPatientId is linked via email or phone
                const linkCriteria: any[] = [];
                usersPatients.forEach(p => {
                    if (p.phone) linkCriteria.push({ phone: p.phone });
                    if (p.email) linkCriteria.push({ email: p.email });
                });

                if (linkCriteria.length > 0) {
                    const isLinked = await prisma.patient.findFirst({
                        where: {
                            uhid: requestedPatientId,
                            OR: linkCriteria
                        }
                    });

                    if (isLinked) {
                        console.log(`PatientAccessGuard: Smart Link match found for ${requestedPatientId}. Access Granted.`);
                        next();
                        return;
                    }
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
