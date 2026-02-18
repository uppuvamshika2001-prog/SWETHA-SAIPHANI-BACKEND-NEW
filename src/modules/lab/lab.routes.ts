import { Router } from 'express';
import {
    createLabOrder,
    getLabOrders,
    getMyLabOrders,
    getLabOrder,
    updateLabOrderStatus,
    submitLabResult,
    getLabResult,
    createLabTest,
    getLabTests,
    updateLabTest,
    deleteLabTest
} from './lab.controller.js';
import { authGuard } from '../../middleware/authGuard.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authGuard);

// Doctor's own orders
router.get('/orders/my-orders', roleGuard(UserRole.ADMIN, UserRole.DOCTOR), getMyLabOrders);

// Orders - Doctors and Lab Techs can create/view
router.post('/orders', roleGuard(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR), createLabOrder);
router.get('/orders', roleGuard(UserRole.ADMIN, UserRole.DOCTOR, UserRole.LAB_TECHNICIAN, UserRole.RECEPTIONIST), getLabOrders);
router.get('/orders/:id', roleGuard(UserRole.ADMIN, UserRole.DOCTOR, UserRole.LAB_TECHNICIAN, UserRole.RECEPTIONIST), getLabOrder);
router.patch('/orders/:id/status', roleGuard(UserRole.ADMIN, UserRole.LAB_TECHNICIAN, UserRole.RECEPTIONIST), updateLabOrderStatus);

// Results - Lab Techs submit, Doctors can view
router.post('/results', roleGuard(UserRole.ADMIN, UserRole.LAB_TECHNICIAN), submitLabResult);
router.get('/results/:id', roleGuard(UserRole.ADMIN, UserRole.DOCTOR, UserRole.LAB_TECHNICIAN), getLabResult);

// Lab Test Catalog Management
router.post('/tests', roleGuard(UserRole.ADMIN, UserRole.LAB_TECHNICIAN), createLabTest);
router.get('/tests', roleGuard(UserRole.ADMIN, UserRole.DOCTOR, UserRole.LAB_TECHNICIAN, UserRole.RECEPTIONIST), getLabTests);
router.put('/tests/:id', roleGuard(UserRole.ADMIN, UserRole.LAB_TECHNICIAN), updateLabTest);
router.delete('/tests/:id', roleGuard(UserRole.ADMIN, UserRole.LAB_TECHNICIAN), deleteLabTest);

export default router;
