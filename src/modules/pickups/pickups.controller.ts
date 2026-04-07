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
import { PickupsService } from './pickups.service';
import { CreatePickupDto, CancelPickupDto, PickupQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Pickups')
@Controller('pickups')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PickupsController {
    constructor(private readonly pickupsService: PickupsService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Schedule a new waste pickup',
        description:
            'Create a new waste pickup request. The scheduled date must be at least 24 hours in the future. A unique reference (ECO-XXXXX) is auto-generated.',
    })
    @ApiResponse({
        status: 201,
        description: 'Pickup scheduled successfully',
        schema: {
            example: {
                success: true,
                message: 'Pickup scheduled successfully',
                data: {
                    id: 'uuid',
                    reference: 'ECO-A3F8K',
                    wasteType: 'ORGANIC',
                    scheduledDate: '2026-04-15T00:00:00.000Z',
                    timeSlot: 'MORNING_8_10',
                    status: 'PENDING',
                    address: 'KG 123 Street, Kigali',
                    collector: null,
                    estimatedPoints: 15,
                    createdAt: '2026-04-13T10:00:00.000Z',
                },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Validation error (bad date, invalid waste type, etc.)' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async createPickup(
        @CurrentUser('id') userId: string,
        @Body() dto: CreatePickupDto,
    ) {
        return this.pickupsService.createPickup(userId, dto);
    }

    @Get()
    @ApiOperation({
        summary: 'Get pickup history',
        description:
            'Get paginated pickup history with optional filters for status, waste type, and date range.',
    })
    @ApiResponse({
        status: 200,
        description: 'Pickup list retrieved successfully',
        schema: {
            example: {
                success: true,
                data: [
                    {
                        id: 'uuid',
                        reference: 'ECO-A3F8K',
                        wasteType: 'ORGANIC',
                        status: 'COMPLETED',
                    },
                ],
                meta: {
                    page: 1,
                    limit: 10,
                    total: 24,
                    totalPages: 3,
                },
            },
        },
    })
    async getPickups(
        @CurrentUser('id') userId: string,
        @Query() query: PickupQueryDto,
    ) {
        return this.pickupsService.getPickups(userId, query);
    }

    @Get('active')
    @ApiOperation({
        summary: 'Get active pickup',
        description:
            "Get the user's currently active pickup (if any). Includes collector info and ETA when available.",
    })
    @ApiResponse({
        status: 200,
        description: 'Active pickup retrieved (or null if none)',
        schema: {
            example: {
                success: true,
                data: {
                    id: 'uuid',
                    reference: 'ECO-A3F8K',
                    status: 'EN_ROUTE',
                    collector: {
                        id: 'uuid',
                        name: 'Patrick Mugisha',
                        phone: '+250788111222',
                        vehiclePlate: 'RAD 123A',
                        rating: 4.8,
                    },
                    eta: {
                        minutes: 12,
                        distanceKm: 3.4,
                    },
                },
            },
        },
    })
    async getActivePickup(@CurrentUser('id') userId: string) {
        return this.pickupsService.getActivePickup(userId);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Get single pickup details',
        description: 'Get detailed information about a specific pickup by ID.',
    })
    @ApiParam({ name: 'id', description: 'Pickup UUID' })
    @ApiResponse({ status: 200, description: 'Pickup details retrieved' })
    @ApiResponse({ status: 404, description: 'Pickup not found' })
    async getPickup(
        @CurrentUser('id') userId: string,
        @Param('id', ParseUUIDPipe) pickupId: string,
    ) {
        return this.pickupsService.getPickup(userId, pickupId);
    }

    @Patch(':id/cancel')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Cancel a pickup',
        description:
            'Cancel a pickup request. Only pickups with status PENDING or CONFIRMED can be cancelled.',
    })
    @ApiParam({ name: 'id', description: 'Pickup UUID' })
    @ApiResponse({
        status: 200,
        description: 'Pickup cancelled successfully',
        schema: {
            example: {
                success: true,
                message: 'Pickup cancelled successfully',
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Pickup cannot be cancelled in its current status' })
    @ApiResponse({ status: 404, description: 'Pickup not found' })
    async cancelPickup(
        @CurrentUser('id') userId: string,
        @Param('id', ParseUUIDPipe) pickupId: string,
        @Body() dto: CancelPickupDto,
    ) {
        return this.pickupsService.cancelPickup(userId, pickupId, dto);
    }
}
