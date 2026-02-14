import { Router } from "express";
import { authGuard } from "../../middleware/authGuard.js";
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
} from "./notification.controller.js";

const router = Router();


// All routes require authentication

// All routes require authentication
router.use(authGuard);

console.log('Registering /api/notifications routes');

// Specific routes first
router.patch("/read-all", markAllAsRead);

// Other routes

// Other routes


router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/:id/read", markAsRead);

export const notificationRoutes = router;
