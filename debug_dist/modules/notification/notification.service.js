import { prisma } from "../../config/database.js";
export class NotificationService {
    async getNotifications(userId) {
        return prisma.notification.findMany({
            where: { recipientId: userId },
            orderBy: { createdAt: "desc" },
        });
    }
    async getUnreadCount(userId) {
        return prisma.notification.count({
            where: {
                recipientId: userId,
                read: false,
            },
        });
    }
    async markAsRead(id, userId) {
        // Only update if the notification belongs to the user
        const result = await prisma.notification.updateMany({
            where: {
                id,
                recipientId: userId,
            },
            data: {
                read: true,
            },
        });
        return result.count > 0;
    }
    async markAllAsRead(userId) {
        const result = await prisma.notification.updateMany({
            where: {
                recipientId: userId,
                read: false,
            },
            data: {
                read: true,
            },
        });
        return result.count;
    }
    // Helper to create notification (for internal use or future endpoints)
    async createNotification(data) {
        return prisma.notification.create({
            data,
        });
    }
}
//# sourceMappingURL=notification.service.js.map