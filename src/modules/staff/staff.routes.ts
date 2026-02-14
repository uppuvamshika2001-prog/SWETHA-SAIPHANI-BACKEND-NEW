import { Router } from 'express';
import { createStaff, getStaff, getStaffById, updateStaff, deleteStaff } from './staff.controller.js';
import { authGuard } from '../../middleware/authGuard.js';
import { roleGuard, clinicalStaff, adminOnly } from '../../middleware/roleGuard.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authGuard);

// Admin and Receptionist can view staff, Patients need to view doctors
router.get('/', roleGuard(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.PATIENT, UserRole.DOCTOR), getStaff);
router.get('/:id', clinicalStaff, getStaffById);

// Admin and Receptionist can create staff
router.post('/', roleGuard(UserRole.ADMIN, UserRole.RECEPTIONIST), createStaff);
router.patch('/:id', adminOnly, updateStaff);
router.delete('/:id', adminOnly, deleteStaff);

export default router;
