import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
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
import { CollectorsService } from './collectors.service';
import {
  UpdatePickupStatusDto,
  UpdateLocationDto,
  RegisterMeDto,
  ToggleAvailabilityDto,
  CollectorHistoryQueryDto,
  CollectorDocumentUploadDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators';
import { UserRole } from '@prisma/client';

@ApiTags('Collectors')
@Controller('collectors')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class CollectorsController {
  constructor(private readonly collectorsService: CollectorsService) {}

  // ─── REGISTRATION ───────────────────────────────

  @Post('register-me')
  @Roles(UserRole.USER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Self-register as a collector',
    description:
      'Submits a collector registration for the authenticated user. Registration is pending until approved by an admin.',
  })
  @ApiResponse({ status: 201, description: 'Registration submitted' })
  @ApiResponse({ status: 409, description: 'Already a collector' })
  async registerMe(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterMeDto,
  ) {
    return this.collectorsService.registerMe(userId, dto);
  }

  @Post('me/document-upload-url')
  @Roles(UserRole.USER, UserRole.COLLECTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create S3 presigned upload URL for collector documents',
    description:
      'Returns a short-lived S3 PUT URL for license or ID upload. Submit the returned key/url in register-me.',
  })
  async createDocumentUploadUrl(
    @CurrentUser('id') userId: string,
    @Body() dto: CollectorDocumentUploadDto,
  ) {
    return this.collectorsService.createDocumentUploadUrl(userId, dto);
  }

  // ─── PROFILE ────────────────────────────────────

  @Get('me/profile')
  @Roles(UserRole.COLLECTOR)
  @ApiOperation({
    summary: 'Get collector profile',
    description:
      'Returns the authenticated collector profile with today stats, rating, and approval status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          name: 'Patrick Mugisha',
          phone: '+250788111222',
          vehiclePlate: 'RAD 123A',
          zone: 'Kigali-Central',
          rating: 4.8,
          totalPickups: 245,
          isAvailable: true,
          isApproved: true,
          todayPickups: 5,
          todayCompleted: 3,
          totalWeightKg: 1860,
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not a collector' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.collectorsService.getProfile(userId);
  }

  // ─── STATS ──────────────────────────────────────

  @Get('me/stats')
  @Roles(UserRole.COLLECTOR)
  @ApiOperation({
    summary: 'Get performance statistics',
    description:
      'Returns detailed performance stats: today, this week, this month, all time, and by waste type.',
  })
  @ApiResponse({
    status: 200,
    description: 'Stats retrieved',
    schema: {
      example: {
        success: true,
        data: {
          today: { completed: 3, weightKg: 12.5, pending: 2 },
          thisWeek: { completed: 18, weightKg: 86.3 },
          thisMonth: { completed: 72, weightKg: 345.1 },
          allTime: { completed: 245, weightKg: 1860 },
          byWasteType: [{ wasteType: 'ORGANIC', count: 120, weightKg: 890 }],
          rating: 4.8,
        },
      },
    },
  })
  async getStats(@CurrentUser('id') userId: string) {
    return this.collectorsService.getStats(userId);
  }

  // ─── TODAY'S PICKUPS ────────────────────────────

  @Get('me/pickups')
  @Roles(UserRole.COLLECTOR)
  @ApiOperation({
    summary: "Get today's assigned pickups",
    description:
      'Returns all pickups assigned to the authenticated collector for today (excludes completed and cancelled).',
  })
  @ApiResponse({
    status: 200,
    description: "Today's pickups retrieved",
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'uuid',
            reference: 'ECO-A3F8K',
            wasteType: 'ORGANIC',
            timeSlot: 'MORNING_8_10',
            status: 'COLLECTOR_ASSIGNED',
            address: 'KG 123 Street, Kigali',
            user: {
              name: 'Jean Baptiste',
              phone: '+250788123456',
            },
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not a collector' })
  async getTodayPickups(@CurrentUser('id') userId: string) {
    return this.collectorsService.getTodayPickups(userId);
  }

  // ─── PICKUP DETAIL ──────────────────────────────

  @Get('me/pickups/:id')
  @Roles(UserRole.COLLECTOR)
  @ApiOperation({
    summary: 'Get pickup detail',
    description:
      'Returns full details for a specific pickup assigned to this collector, including customer info, payment, and bin data.',
  })
  @ApiParam({ name: 'id', description: 'Pickup UUID' })
  @ApiResponse({ status: 200, description: 'Pickup details retrieved' })
  @ApiResponse({ status: 404, description: 'Pickup not found' })
  @ApiResponse({ status: 403, description: 'Not assigned to you' })
  async getPickupDetail(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) pickupId: string,
  ) {
    return this.collectorsService.getPickupDetail(userId, pickupId);
  }

  // ─── PICKUP HISTORY ─────────────────────────────

  @Get('me/history')
  @Roles(UserRole.COLLECTOR)
  @ApiOperation({
    summary: 'Get pickup history',
    description:
      'Returns paginated list of completed and cancelled pickups with optional filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'History retrieved with pagination',
  })
  async getPickupHistory(
    @CurrentUser('id') userId: string,
    @Query() query: CollectorHistoryQueryDto,
  ) {
    return this.collectorsService.getPickupHistory(userId, query);
  }

  // ─── UPDATE PICKUP STATUS ──────────────────────

  @Patch('pickups/:id/status')
  @Roles(UserRole.COLLECTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update pickup status',
    description:
      'Update a pickup status. Must follow valid transitions: COLLECTOR_ASSIGNED → EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED. Weight is required for COMPLETED status.',
  })
  @ApiParam({ name: 'id', description: 'Pickup UUID' })
  @ApiResponse({
    status: 200,
    description: 'Status updated',
    schema: {
      example: {
        success: true,
        message: 'Pickup status updated to EN_ROUTE',
        data: { status: 'EN_ROUTE' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Pickup not found' })
  async updatePickupStatus(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) pickupId: string,
    @Body() dto: UpdatePickupStatusDto,
  ) {
    return this.collectorsService.updatePickupStatus(userId, pickupId, dto);
  }

  // ─── UPDATE LOCATION ────────────────────────────

  @Patch('me/location')
  @Roles(UserRole.COLLECTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update collector location',
    description:
      "Update the collector's current GPS coordinates. Used for real-time tracking.",
  })
  @ApiResponse({
    status: 200,
    description: 'Location updated',
    schema: {
      example: {
        success: true,
        message: 'Location updated successfully',
        data: { latitude: -1.9456, longitude: 29.8801 },
      },
    },
  })
  async updateLocation(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.collectorsService.updateLocation(userId, dto);
  }

  // ─── TOGGLE AVAILABILITY ────────────────────────

  @Patch('me/availability')
  @Roles(UserRole.COLLECTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Toggle availability',
    description:
      'Set collector as online/offline. Offline collectors will not be assigned new pickups.',
  })
  @ApiResponse({
    status: 200,
    description: 'Availability updated',
    schema: {
      example: {
        success: true,
        message: 'You are now online',
        data: { isAvailable: true },
      },
    },
  })
  async toggleAvailability(
    @CurrentUser('id') userId: string,
    @Body() dto: ToggleAvailabilityDto,
  ) {
    return this.collectorsService.toggleAvailability(userId, dto);
  }
}
