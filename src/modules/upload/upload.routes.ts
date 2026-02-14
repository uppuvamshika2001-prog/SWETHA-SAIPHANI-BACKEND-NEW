import { Router } from 'express';
import { uploadFile } from './upload.controller.js';
import { upload } from '../../middleware/upload.js';
import { authGuard } from '../../middleware/authGuard.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authGuard);

router.post('/',
    roleGuard(UserRole.ADMIN, UserRole.LAB_TECHNICIAN, UserRole.DOCTOR),
    upload.single('file'),
    uploadFile
);

export default router;
