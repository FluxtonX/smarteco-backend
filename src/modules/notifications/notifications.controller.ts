import {
    Controller,
    Get,
    Patch,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
    ) {}

    @Get()
    @ApiOperation({
        summary: 'Get notifications',
        description:
            "Get the user's paginated notifications. Optionally filter by read status. Includes unread count.",
    })
    @ApiResponse({
        status: 200,
        description: 'Notifications retrieved',
        schema: {
            example: {
                success: true,
                data: [
                    {
                        id: 'uuid',
                        type: 'PUSH',
                        title: 'Collector on the way!',
                        body: 'Patrick is 12 minutes away from your location.',
                        data: { pickupId: 'uuid', screen: 'TRACKING' },
                        isRead: false,
                        sentAt: '2026-04-13T09:30:00Z',
                    },
                ],
                meta: { page: 1, limit: 20, total: 45, totalPages: 3 },
                unreadCount: 8,
            },
        },
    })
    async getNotifications(
        @CurrentUser('id') userId: string,
        @Query() query: NotificationQueryDto,
    ) {
        return this.notificationsService.getNotifications(userId, query);
    }

    @Patch(':id/read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Mark notification as read',
        description: 'Mark a single notification as read.',
    })
    @ApiParam({ name: 'id', description: 'Notification UUID' })
    @ApiResponse({
        status: 200,
        description: 'Notification marked as read',
        schema: {
            example: {
                success: true,
                message: 'Notification marked as read',
            },
        },
    })
    @ApiResponse({ status: 404, description: 'Notification not found' })
    async markAsRead(
        @CurrentUser('id') userId: string,
        @Param('id', ParseUUIDPipe) notificationId: string,
    ) {
        return this.notificationsService.markAsRead(userId, notificationId);
    }

    @Patch('read-all')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Mark all notifications as read',
        description: 'Mark all unread notifications as read for the current user.',
    })
    @ApiResponse({
        status: 200,
        description: 'All notifications marked as read',
        schema: {
            example: {
                success: true,
                message: '8 notifications marked as read',
            },
        },
    })
    async markAllAsRead(@CurrentUser('id') userId: string) {
        return this.notificationsService.markAllAsRead(userId);
    }
}
