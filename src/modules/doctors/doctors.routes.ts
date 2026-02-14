import { Router } from 'express';
import { createMedicalRecord, getMedicalRecords, getAllMedicalRecords, getMedicalRecordById, createPrescription, getPrescription, dispensePrescription, getPendingPrescriptions } from './doctors.controller.js';
import { authGuard } from '../../middleware/authGuard.js';
import { medicalStaff, medicalReadAccess } from '../../middleware/roleGuard.js';

import { UserRole } from '@prisma/client';
import { patientAccessGuard } from '../../middleware/patientAuth.js';

const router = Router();

router.use(authGuard);

// Medical Records
router.get('/medical-records', medicalReadAccess, getAllMedicalRecords);  // List all records (Admin/Pharmacist search)
router.post('/medical-records', medicalStaff, createMedicalRecord);
router.get('/medical-records/patient/:patientId', patientAccessGuard('patientId', [UserRole.ADMIN, UserRole.DOCTOR, UserRole.PHARMACIST]), getMedicalRecords);
router.get('/medical-records/:id', medicalReadAccess, getMedicalRecordById); // Specific ID route last

// Prescriptions
router.post('/prescriptions', medicalStaff, createPrescription);
router.get('/prescriptions/:id', medicalReadAccess, getPrescription);
router.put('/medical-records/:id/dispense', medicalReadAccess, dispensePrescription); // Pharmacists can dispense

export default router;
