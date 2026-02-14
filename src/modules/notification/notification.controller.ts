import { Request, Response } from "express";
import { NotificationService } from "./notification.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const notificationService = new NotificationService();

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const notifications = await notificationService.getNotifications(userId);
    res.json(notifications);
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const count = await notificationService.getUnreadCount(userId);
    res.json({ count });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const success = await notificationService.markAsRead(id, userId);

    if (!success) {
        res.status(404).json({ message: "Notification not found or already read" });
        return;
    }

    res.json({ success: true });
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    await notificationService.markAllAsRead(userId);
    res.json({ success: true });
});
