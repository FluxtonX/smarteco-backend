import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
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
import { UpdatePickupStatusDto, UpdateLocationDto } from './dto';
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

  @Get('me/pickups')
  @Roles(UserRole.COLLECTOR)
  @ApiOperation({
    summary: "Get today's assigned pickups",
    description:
      'Returns all pickups assigned to the authenticated collector for today. Requires COLLECTOR role.',
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
}
