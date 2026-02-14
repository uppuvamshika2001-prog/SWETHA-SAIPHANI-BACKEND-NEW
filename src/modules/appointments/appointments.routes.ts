import { Router } from 'express';
import { createAppointment, getAppointments, getAppointmentById, updateAppointment, deleteAppointment, createPublicAppointment, getPublicAppointmentById } from './appointments.controller.js';
import { authGuard } from '../../middleware/authGuard.js';
import { clinicalStaff, roleGuard } from '../../middleware/roleGuard.js';
import { UserRole } from '@prisma/client';

const router = Router();

// Public route for booking
router.post('/public', createPublicAppointment);
router.get('/public/:id', getPublicAppointmentById);

router.use(authGuard);

// Allow patients to view appointments
router.get('/', roleGuard(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PATIENT), getAppointments);
router.get('/:id', roleGuard(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PATIENT), getAppointmentById);

// Allow patients to create appointments (book for themselves)
router.post('/', roleGuard(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PATIENT), createAppointment);

// Only clinical staff can update/delete appointments
router.patch('/:id', clinicalStaff, updateAppointment);
router.delete('/:id', clinicalStaff, deleteAppointment);

export default router;

