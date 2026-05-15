import {
  Controller,
  Get,
  Post,
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
import { BinsService } from './bins.service';
import {
  ReportBinDto,
  UpdateFillLevelDto,
  ScanBinDto,
  IotBinSyncDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Bins')
@Controller('bins')
@ApiBearerAuth('JWT-auth')
export class BinsController {
  constructor(private readonly binsService: BinsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get all bins for current user',
    description:
      'Returns all 5 bins assigned to the authenticated user with their fill levels and statuses.',
  })
  @ApiResponse({
    status: 200,
    description: 'User bins retrieved successfully',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'uuid',
            qrCode: 'BIN-JBA-K8M2',
            wasteType: 'ORGANIC',
            fillLevel: 45,
            status: 'ACTIVE',
            lastEmptied: '2026-04-10T08:00:00Z',
          },
        ],
      },
    },
  })
  async getUserBins(@CurrentUser('id') userId: string) {
    return this.binsService.getUserBins(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get single bin details',
    description:
      'Get detailed information about a specific bin, including recent pickup history.',
  })
  @ApiParam({ name: 'id', description: 'Bin UUID' })
  @ApiResponse({ status: 200, description: 'Bin details retrieved' })
  @ApiResponse({ status: 404, description: 'Bin not found' })
  async getBin(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) binId: string,
  ) {
    return this.binsService.getBin(userId, binId);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Report a bin issue',
    description:
      'Report a bin as full, damaged, or needing maintenance. If reported as FULL, a pickup is automatically scheduled.',
  })
  @ApiParam({ name: 'id', description: 'Bin UUID' })
  @ApiResponse({
    status: 200,
    description: 'Bin reported successfully',
    schema: {
      example: {
        success: true,
        message: 'Bin reported. A pickup will be scheduled shortly.',
        data: {
          pickupId: 'uuid',
          reference: 'ECO-R9T2K',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Bin not found' })
  async reportBin(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) binId: string,
    @Body() dto: ReportBinDto,
  ) {
    return this.binsService.reportBin(userId, binId, dto);
  }

  @Post(':id/fill-level')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update bin fill level (IoT simulation)',
    description:
      'IoT endpoint for bin fill updates (also usable for simulation). Expected payload: fillLevel (0-100). Triggers alerts at >=80% and auto-schedules pickup at >=95%.',
  })
  @ApiParam({ name: 'id', description: 'Bin UUID' })
  @ApiResponse({
    status: 200,
    description: 'Fill level updated',
    schema: {
      example: {
        success: true,
        data: {
          fillLevel: 85,
          alertTriggered: true,
          autoScheduled: false,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Bin not found' })
  async updateFillLevel(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) binId: string,
    @Body() dto: UpdateFillLevelDto,
  ) {
    return this.binsService.updateFillLevel(userId, binId, dto);
  }

  @Patch(':id/fill-level')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update bin fill level (mobile simulation compatibility)',
    description:
      'PATCH alias for mobile clients. Physical IoT devices should use POST /bins/iot/sync.',
  })
  async patchFillLevel(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) binId: string,
    @Body() dto: UpdateFillLevelDto,
  ) {
    return this.binsService.updateFillLevel(userId, binId, dto);
  }

  @Post('iot/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync physical IoT bin telemetry',
    description:
      'Unauthenticated device endpoint protected by IOT_DEVICE_API_KEY. Updates fill level, optional location, and triggers bin alerts or auto-scheduled pickups.',
  })
  async syncIotBin(@Body() dto: IotBinSyncDto) {
    return this.binsService.syncFromDevice(dto);
  }

  @Post('scan')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scan a bin QR code',
    description:
      'Scan a bin QR code to retrieve bin information and owner details. Used by collectors during pickups.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bin info retrieved via QR scan',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          qrCode: 'BIN-JBA-K8M2',
          wasteType: 'ORGANIC',
          fillLevel: 45,
          owner: {
            id: 'uuid',
            name: 'Jean Baptiste',
            phone: '+250788123456',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Bin not found (invalid QR code)' })
  async scanBin(@Body() dto: ScanBinDto) {
    return this.binsService.scanBin(dto);
  }
}
