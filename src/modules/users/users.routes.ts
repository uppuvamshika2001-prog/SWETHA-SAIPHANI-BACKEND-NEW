import { Router } from 'express';
import { getMe, updateMe, getUsers, getUserById, updateUserById, deleteUserById, getPublicDoctors } from './users.controller.js';
import { authGuard } from '../../middleware/authGuard.js';
import { adminOnly, staffOnly } from '../../middleware/roleGuard.js';

const router = Router();

// Public routes
router.get('/public/doctors', getPublicDoctors);

// All routes require authentication
router.use(authGuard);

// Current user routes
router.get('/me', getMe);
router.patch('/me', updateMe);

// Admin only routes
router.get('/', getUsers); // Allow all authenticated roles to view users (for now, or filter in controller)
router.get('/:id', adminOnly, getUserById);
router.patch('/:id', staffOnly, updateUserById);
router.delete('/:id', adminOnly, deleteUserById);

export default router;
