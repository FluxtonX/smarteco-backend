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
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminUserQueryDto, UpdateUserDto, CreateCollectorDto, AssignCollectorDto, ApproveCollectorDto } from './dto';
import { PaginationDto } from '../../common/dto';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get dashboard overview',
    description:
      'Returns aggregated statistics for users, pickups, revenue, EcoPoints, and collectors. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard stats retrieved',
    schema: {
      example: {
        success: true,
        data: {
          users: { total: 1240, active: 1185, newThisMonth: 78 },
          pickups: {
            total: 5430,
            completed: 4890,
            pending: 120,
            cancelled: 420,
          },
          revenue: { totalRwf: 2850000, thisMonthRwf: 387500 },
          ecoPoints: { totalIssued: 285000, totalRedeemed: 42000 },
          collectors: { total: 18, active: 15 },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users')
  @ApiOperation({
    summary: 'List all users',
    description:
      'Get paginated list of all users with search and filters. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Users list retrieved',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'uuid',
            phone: '+250788123456',
            firstName: 'Jean',
            lastName: 'Baptiste',
            email: 'jean@example.com',
            role: 'USER',
            userType: 'RESIDENTIAL',
            isActive: true,
            ecoPoints: 350,
            createdAt: '2024-01-15T10:00:00Z',
          },
        ],
        meta: { page: 1, limit: 10, total: 1240, totalPages: 124 },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async getUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Patch('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user',
    description: 'Update user role or active status. Admin only.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'User updated',
    schema: {
      example: {
        success: true,
        message: 'User updated successfully',
        data: { id: 'uuid', role: 'COLLECTOR', isActive: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async updateUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(userId, dto);
  }

  @Get('pickups')
  @ApiOperation({
    summary: 'List all pickups',
    description:
      'Get paginated list of all pickups with user and collector info. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pickups list retrieved',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'uuid',
            reference: 'ECO-A3F8K',
            wasteType: 'ORGANIC',
            status: 'COMPLETED',
            scheduledDate: '2026-04-15T00:00:00.000Z',
            timeSlot: 'MORNING_8_10',
            user: { name: 'Jean Baptiste', phone: '+250788123456' },
            collector: { name: 'Patrick Mugisha', vehiclePlate: 'RAD 123A' },
          },
        ],
        meta: { page: 1, limit: 10, total: 5430, totalPages: 543 },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async getPickups(@Query() query: PaginationDto) {
    return this.adminService.getPickups(query);
  }

  @Post('pickups/:id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign collector to pickup',
    description: 'Admin assigns a specific collector to a pickup. Admin only.',
  })
  @ApiParam({ name: 'id', description: 'Pickup UUID' })
  @ApiResponse({
    status: 200,
    description: 'Collector assigned successfully',
  })
  @ApiResponse({ status: 404, description: 'Pickup or Collector not found' })
  async assignCollector(
    @Param('id', ParseUUIDPipe) pickupId: string,
    @Body() dto: AssignCollectorDto,
  ) {
    return this.adminService.assignCollector(pickupId, dto);
  }

  @Get('collectors')
  @ApiOperation({
    summary: 'List all collectors',
    description:
      'Get list of all registered collectors with performance stats. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Collectors list retrieved',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'uuid',
            name: 'Patrick Mugisha',
            phone: '+250788111222',
            vehiclePlate: 'RAD 123A',
            zone: 'Kigali-Central',
            rating: 4.8,
            totalPickups: 245,
            isActive: true,
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async getCollectors() {
    return this.adminService.getCollectors();
  }

  @Post('collectors')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new collector',
    description:
      'Register an existing user as a collector. The user must already be registered. Their role will be changed to COLLECTOR. Admin only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Collector registered',
    schema: {
      example: {
        success: true,
        message: 'Collector registered successfully',
        data: {
          id: 'uuid',
          name: 'Patrick Mugisha',
          phone: '+250788111222',
          vehiclePlate: 'RAD 123A',
          zone: 'Kigali-Central',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User is already a collector' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async createCollector(@Body() dto: CreateCollectorDto) {
    return this.adminService.createCollector(dto);
  }

  @Get('collectors/pending')
  @ApiOperation({
    summary: 'List pending collector applications',
    description:
      'Returns all collector profiles that are awaiting admin approval. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending collectors list retrieved',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'uuid',
            name: 'Marie Claire',
            phone: '+250788555666',
            vehiclePlate: 'RCA 789D',
            zone: 'Kigali-South',
            createdAt: '2026-04-29T10:00:00Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async getPendingCollectors() {
    return this.adminService.getPendingCollectors();
  }

  @Patch('collectors/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve or reject a collector application',
    description:
      'Approve (sets role to COLLECTOR, isApproved=true) or reject (deletes collector profile) a pending collector application. Admin only.',
  })
  @ApiParam({ name: 'id', description: 'Collector Profile UUID' })
  @ApiResponse({
    status: 200,
    description: 'Collector approved/rejected',
    schema: {
      example: {
        success: true,
        message: 'Collector Marie approved successfully',
        data: { id: 'uuid', isApproved: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Collector not found' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async approveCollector(
    @Param('id', ParseUUIDPipe) collectorId: string,
    @CurrentUser('id') adminUserId: string,
    @Body() dto: ApproveCollectorDto,
  ) {
    return this.adminService.approveCollector(collectorId, adminUserId, dto);
  }

  @Get('analytics/pickups')
  @ApiOperation({
    summary: 'Pickup analytics',
    description:
      'Get pickup analytics grouped by waste type and time slot. Optional date range filter. Admin only.',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date (YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'End date (YYYY-MM-DD)',
    example: '2026-12-31',
  })
  @ApiResponse({
    status: 200,
    description: 'Pickup analytics retrieved',
    schema: {
      example: {
        success: true,
        data: {
          byWasteType: [
            { wasteType: 'ORGANIC', count: 1820, percentageOfTotal: 33.5 },
            { wasteType: 'RECYCLABLE', count: 1540, percentageOfTotal: 28.4 },
            { wasteType: 'HAZARDOUS', count: 320, percentageOfTotal: 5.9 },
          ],
          byTimeSlot: [
            { timeSlot: 'MORNING_8_10', count: 2100 },
            { timeSlot: 'AFTERNOON_12_14', count: 1650 },
          ],
          totalInRange: 5430,
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async getPickupAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.getPickupAnalytics(from, to);
  }

  @Get('analytics/revenue')
  @ApiOperation({
    summary: 'Revenue analytics',
    description:
      'Get revenue analytics grouped by payment method. Optional date range filter. Admin only.',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date (YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'End date (YYYY-MM-DD)',
    example: '2026-12-31',
  })
  @ApiResponse({
    status: 200,
    description: 'Revenue analytics retrieved',
    schema: {
      example: {
        success: true,
        data: {
          totalRwf: 2850000,
          byMethod: [
            { method: 'MOMO', totalRwf: 1920000, count: 3200 },
            { method: 'AIRTEL', totalRwf: 930000, count: 1450 },
          ],
          byMonth: [
            { month: '2026-01', totalRwf: 210000 },
            { month: '2026-02', totalRwf: 245000 },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async getRevenueAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.getRevenueAnalytics(from, to);
  }
}
