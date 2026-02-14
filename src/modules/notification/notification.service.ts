import { prisma } from "../../config/database.js";
import { Prisma } from "@prisma/client";

export class NotificationService {
  async getNotifications(userId: string) {
    return prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: {
        recipientId: userId,
        read: false,
      },
    });
  }

  async markAsRead(id: string, userId: string) {
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

  async markAllAsRead(userId: string) {
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
  async createNotification(data: {
    recipientId: string;
    title: string;
    message: string;
    type?: string;
    actionUrl?: string;
  }) {
    return prisma.notification.create({
      data,
    });
  }
}
