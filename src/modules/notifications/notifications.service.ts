import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationQueryDto } from './dto';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── GET NOTIFICATIONS ──────────────────────────

  async getNotifications(userId: string, query: NotificationQueryDto) {
    const where: any = { userId };

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { sentAt: 'desc' },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          data: true,
          isRead: true,
          sentAt: true,
        },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      success: true,
      data: notifications,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
      unreadCount,
    };
  }

  // ─── MARK AS READ ───────────────────────────────

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    if (notification.userId !== userId) {
      throw new NotFoundException('Notification not found.');
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return {
      success: true,
      message: 'Notification marked as read',
    };
  }

  // ─── MARK ALL AS READ ───────────────────────────

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return {
      success: true,
      message: `${result.count} notifications marked as read`,
    };
  }

  // ─── CREATE NOTIFICATION (internal) ─────────────
  // Used by other modules to create in-app notifications

  async createNotification(
    userId: string,
    title: string,
    body: string,
    type: NotificationType = NotificationType.IN_APP,
    data?: any,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data: data || undefined,
      },
    });

    this.logger.log(`Notification created for user ${userId}: ${title}`);

    // TODO: Send push notification via FCM
    // TODO: Send SMS via Africa's Talking if type === SMS

    return notification;
  }
}
