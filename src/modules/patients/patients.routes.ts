import { Router } from 'express';
import {
    createPatient,
    getPatients,
    getMyProfile,
    getPatientById,
    updatePatient,
    deletePatient,
    getPatientPrescriptions,
    getPatientBills,
    getPatientLabResults,
} from './patients.controller.js';
import { authGuard } from '../../middleware/authGuard.js';
import { roleGuard, staffOnly } from '../../middleware/roleGuard.js';
import { patientAccessGuard } from '../../middleware/patientAuth.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authGuard);

// Patient's own profile
router.get('/me', roleGuard(UserRole.PATIENT), getMyProfile);

// Staff can list patients
router.get('/', staffOnly, getPatients);

// Get Patient by ID (Staff or Patient themselves)
router.get('/:id', patientAccessGuard(), getPatientById);

// Staff can create patients (walk-in registration)
router.post('/', staffOnly, createPatient);

// Patient can update own, staff can update any
// Note: updatePatient controller has internal logic to check permissions too, 
// but we can add middleware for extra safety, though updatePatient logic takes precedence for mixed logic.
// Let's stick to existing simple route or enhance it.
// The existing controller logic: "Patients can only update their own profile".
router.patch('/:id', updatePatient);

// Patient portal - view own data
router.get('/:id/prescriptions', patientAccessGuard(), getPatientPrescriptions);
router.get('/:id/bills', patientAccessGuard(), getPatientBills);
router.get('/:id/lab-results', patientAccessGuard(), getPatientLabResults);

router.delete('/:id', staffOnly, deletePatient);

export default router;
