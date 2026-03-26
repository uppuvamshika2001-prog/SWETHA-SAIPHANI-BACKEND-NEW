import multer from 'multer';
import path from 'path';
import fs from 'fs';
// Ensure uploads directory exists
const uploadDir = 'uploads/distributor-invoices';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'invoice-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const fileFilter = (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
        return cb(null, true);
    }
    else {
        cb(new Error('Only PDF, JPG, and PNG files are allowed for invoices!'));
    }
};
export const invoiceUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter
});
//# sourceMappingURL=invoiceUpload.js.map