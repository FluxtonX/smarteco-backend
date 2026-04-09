import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { AdminUserQueryDto, UpdateUserDto, CreateCollectorDto, CreateUserDto } from './dto';
import { PaginationDto } from '../../common/dto';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

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
  @ApiResponse({ status: 200, description: 'Dashboard stats retrieved' })
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
  @ApiResponse({ status: 200, description: 'Users list retrieved' })
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
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(userId, dto);
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Register a new user directly from the admin panel. Admin only.',
  })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 409, description: 'Phone or email already in use' })
  async createUser(@Body() dto: CreateUserDto) {
    return this.adminService.createUser(dto);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Permanently delete a user from the system. Admin only.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id', ParseUUIDPipe) userId: string) {
    return this.adminService.deleteUser(userId);
  }

  @Get('users/:id')
  @ApiOperation({
    summary: 'Get user details',
    description: 'Get detailed information and stats for a specific user. Admin only.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User details retrieved' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserDetail(@Param('id', ParseUUIDPipe) userId: string) {
    return this.adminService.getUserDetail(userId);
  }

  @Get('pickups')
  @ApiOperation({
    summary: 'List all pickups',
    description:
      'Get paginated list of all pickups with user and collector info. Admin only.',
  })
  @ApiResponse({ status: 200, description: 'Pickups list retrieved' })
  async getPickups(@Query() query: PaginationDto) {
    return this.adminService.getPickups(query);
  }

  @Get('collectors')
  @ApiOperation({
    summary: 'List all collectors',
    description:
      'Get list of all registered collectors with performance stats. Admin only.',
  })
  @ApiResponse({ status: 200, description: 'Collectors list retrieved' })
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
  @ApiResponse({ status: 201, description: 'Collector registered' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User is already a collector' })
  async createCollector(@Body() dto: CreateCollectorDto) {
    return this.adminService.createCollector(dto);
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
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, description: 'Pickup analytics retrieved' })
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
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, description: 'Revenue analytics retrieved' })
  async getRevenueAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.getRevenueAnalytics(from, to);
  }

  @Get('bins')
  @ApiOperation({
    summary: 'List all smart bins',
    description: 'Get paginated list of all smart bins in the system. Admin only.',
  })
  @ApiResponse({ status: 200, description: 'Bins list retrieved' })
  async getBins(@Query() query: PaginationDto) {
    return this.adminService.getBins(query);
  }

  @Get('analytics/bins')
  @ApiOperation({
    summary: 'Smart bin analytics',
    description: 'Get aggregate stats for all smart bins. Admin only.',
  })
  @ApiResponse({ status: 200, description: 'Bin analytics retrieved' })
  async getBinAnalytics() {
    return this.adminService.getBinAnalytics();
  }
}
