import { Router } from 'express';
import { createMedicine, getMedicines, getMedicine, updateMedicine, deleteMedicine, createBill, getBills, getBill, updateBill, deleteBill, getLowStockMedicines, getDistributorReport, getPurchases, getMarginReport, recordPayment, getPurchasePayments, createPurchase, processReturn, getReturns, processStockReturn, getStockReturns, getCategories, createCategory, deleteCategory } from './pharmacy.controller.js';
import { getPendingPrescriptions, getDispensedHistory, getPharmacyStats } from '../doctors/doctors.controller.js';
import { authGuard } from '../../middleware/authGuard.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authGuard);
router.use(roleGuard(UserRole.ADMIN, UserRole.PHARMACIST));

// Pending Orders (Queue) - Added here to match /api/pharmacy/pending
router.get('/pending', getPendingPrescriptions);
router.get('/dispensed-history', getDispensedHistory);
router.get('/stats', getPharmacyStats);

// Medicines
router.post('/medicines', createMedicine);
router.get('/medicines', getMedicines);
router.get('/medicines/low-stock', getLowStockMedicines);
router.get('/medicines/:id', getMedicine);
router.patch('/medicines/:id', updateMedicine);
router.delete('/medicines/:id', deleteMedicine);

// Categories
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.delete('/categories/:id', deleteCategory);

// Bills
router.post('/bills', createBill);
router.get('/bills', getBills);
router.get('/bills/:id', getBill);
router.patch('/bills/:id', updateBill);
router.delete('/bills/:id', deleteBill);

// Returns
router.post('/returns', processReturn);
router.get('/returns', getReturns);
router.post('/stock-returns', processStockReturn);
router.get('/stock-returns', getStockReturns);

// Reports
router.get('/margin-reports', getMarginReport);
router.get('/distributor-report', getDistributorReport);

// Purchases & Payments
router.get('/purchases', getPurchases);
router.post('/purchases', createPurchase);
router.post('/purchases/:id/payments', recordPayment);
router.get('/purchases/:id/payments', getPurchasePayments);

export default router;
