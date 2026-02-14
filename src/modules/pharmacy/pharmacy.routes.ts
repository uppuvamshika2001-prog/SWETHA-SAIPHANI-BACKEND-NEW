import { Router } from 'express';
import { createMedicine, getMedicines, getMedicine, updateMedicine, deleteMedicine, createBill, getBills, getBill, updateBill, deleteBill, getLowStockMedicines } from './pharmacy.controller.js';
import { getPendingPrescriptions } from '../doctors/doctors.controller.js';
import { authGuard } from '../../middleware/authGuard.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authGuard);
router.use(roleGuard(UserRole.ADMIN, UserRole.PHARMACIST));

// Pending Orders (Queue) - Added here to match /api/pharmacy/pending
router.get('/pending', getPendingPrescriptions);

// Medicines
router.post('/medicines', createMedicine);
router.get('/medicines', getMedicines);
router.get('/medicines/low-stock', getLowStockMedicines);
router.get('/medicines/:id', getMedicine);
router.patch('/medicines/:id', updateMedicine);
router.delete('/medicines/:id', deleteMedicine);

// Bills
router.post('/bills', createBill);
router.get('/bills', getBills);
router.get('/bills/:id', getBill);
router.patch('/bills/:id', updateBill);
router.delete('/bills/:id', deleteBill);

export default router;
