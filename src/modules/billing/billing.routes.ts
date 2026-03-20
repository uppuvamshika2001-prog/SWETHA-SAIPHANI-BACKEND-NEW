import { Router } from 'express';
import { createBill, getBills, getBillById, updateBillStatus, getBillingStats, deleteBill, getUnbilledLabOrders, getPatientBillingSummary } from './billing.controller.js';
import { authGuard } from '../../middleware/authGuard.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { UserRole } from '@prisma/client';

const router = Router();

// Authentication required for all billing routes
router.use(authGuard);

// Role guard for ADMIN, RECEPTIONIST, and PHARMACIST
const billingRoleGuard = roleGuard(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.PHARMACIST);

// All billing operations restricted to ADMIN and RECEPTIONIST only
router.post('/', billingRoleGuard, createBill);
router.get('/', billingRoleGuard, getBills);
router.get('/stats', billingRoleGuard, getBillingStats);

// Patient summary routes (must come BEFORE generic /:id)
router.get('/patient-summary', billingRoleGuard, getPatientBillingSummary); // Handle ?patientId= query param
router.get('/patient-summary/:patientId', billingRoleGuard, getPatientBillingSummary); // Handle path param
router.get('/unbilled-lab-orders/:patientId', billingRoleGuard, getUnbilledLabOrders);

// Generic ID route (must come LAST among GET routes)
router.get('/:id', billingRoleGuard, getBillById);

router.patch('/:id/status', billingRoleGuard, updateBillStatus);
router.delete('/:id', roleGuard(UserRole.ADMIN), deleteBill);

export default router;
