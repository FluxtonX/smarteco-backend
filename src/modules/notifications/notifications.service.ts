import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationQueryDto } from './dto';
import { NotificationType, Prisma } from '@prisma/client';
import { FirebaseService } from '../../integrations/firebase/firebase.service';
import { TwilioService } from '../../integrations/twilio/twilio.service';
import { WhatsAppService } from '../../integrations/whatsapp/whatsapp.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
    private readonly twilioService: TwilioService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  async dispatchLifecycleNotification(
    userId: string,
    title: string,
    body: string,
    data?: Prisma.InputJsonValue,
    channels: Array<'IN_APP' | 'PUSH' | 'SMS' | 'WHATSAPP'> = [
      'IN_APP',
      'PUSH',
    ],
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    const delivery: Record<string, boolean> = {};

    if (channels.includes('IN_APP') || channels.includes('PUSH')) {
      const notificationType = channels.includes('PUSH')
        ? NotificationType.PUSH
        : NotificationType.IN_APP;
      await this.createNotification(
        userId,
        title,
        body,
        notificationType,
        data,
      );
      delivery.IN_APP = true;
      delivery.PUSH = channels.includes('PUSH');
    }

    if (channels.includes('SMS') && user?.phone) {
      const smsResult = await this.twilioService.sendSms(
        user.phone,
        `${title}: ${body}`,
      );
      delivery.SMS = smsResult.success;
    }

    if (channels.includes('WHATSAPP') && user?.phone) {
      try {
        await this.whatsAppService.sendMessage(user.phone, `${title}\n${body}`);
        delivery.WHATSAPP = true;
      } catch {
        delivery.WHATSAPP = false;
      }
    }

    this.logger.log(
      `Lifecycle delivery for ${userId}: ${JSON.stringify(delivery)}`,
    );
    return delivery;
  }

  // ─── GET NOTIFICATIONS ──────────────────────────

  async getNotifications(userId: string, query: NotificationQueryDto) {
    const where: Prisma.NotificationWhereInput = { userId };

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
    data?: Prisma.InputJsonValue,
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

    // Fetch user to get FCM token
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (user?.fcmToken) {
      const payloadData =
        data && typeof data === 'object' && !Array.isArray(data)
          ? Object.fromEntries(
              Object.entries(data as Record<string, unknown>).map(([k, v]) => [
                k,
                v == null ? '' : String(v),
              ]),
            )
          : undefined;

      await this.firebaseService.sendPushNotification(
        user.fcmToken,
        title,
        body,
        payloadData,
      );
    }

    return notification;
  }
}
