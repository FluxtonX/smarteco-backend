import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SortingService } from './sorting.service';
import {
  ClassifyDto,
  KioskHeartbeatDto,
  SortingEventQueryDto,
  KioskExportPayloadDto,
} from './dto';
import { KioskAuthGuard } from './guards/kiosk-auth.guard';
import { JwtAuthGuard } from '../auth/guards';
import { Public } from '../auth/decorators/public.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Sorting & Kiosks')
@Controller()
export class SortingController {
  constructor(private readonly sortingService: SortingService) {}

  // ─── CUSTOM SCHEMA V2 KIOSK EXPORT INGEST (TEST ENDPOINT) ───

  @Post('sorting/kiosk-export')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ingest Schema v2 AI Kiosk JSON Export Payload (Test Endpoint)',
    description:
      'Stores custom AI kiosk sorting export logs in the database for admin viewing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Kiosk export payload ingested successfully',
  })
  async ingestKioskExport(@Body() dto: KioskExportPayloadDto) {
    return this.sortingService.ingestKioskExportPayload(dto);
  }

  @Get('sorting/kiosk-telemetry')
  @Public()
  @ApiOperation({
    summary: 'Query raw kiosk telemetry logs directly from DB',
    description:
      'Retrieves schema v2 telemetry events directly stored in database.',
  })
  async getKioskTelemetry(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('kioskId') kioskId?: string,
    @Query('eventType') eventType?: string,
    @Query('search') search?: string,
  ) {
    return this.sortingService.getKioskTelemetryEvents({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      kioskId,
      eventType,
      search,
    });
  }

  // ─── CLASSIFY TELEMETRY ──────────────────────────

  @Post('sorting/classify')
  @Public()
  @UseGuards(KioskAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ingest AI Sorting Kiosk classification event(s)',
    description:
      'Receives category, confidence score, optional user session, and unique idempotency key from a kiosk sync worker.',
  })
  @ApiResponse({
    status: 200,
    description: 'Telemetry batch processed successfully',
  })
  @ApiBearerAuth('Kiosk-auth')
  async classify(@Body() dto: ClassifyDto, @Req() req: any) {
    const kiosk = req.kiosk;
    return this.sortingService.processClassificationBatch(
      kiosk.kioskId,
      dto.events,
    );
  }

  // ─── KIOSK HEARTBEAT ─────────────────────────────

  @Post('kiosks/:id/heartbeat')
  @Public()
  @UseGuards(KioskAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kiosk device connectivity check-in',
    description:
      'Performs a lightweight health/telemetry check-in for Kiosk monitoring.',
  })
  @ApiParam({ name: 'id', description: 'Originating Kiosk ID' })
  @ApiResponse({
    status: 200,
    description: 'Heartbeat recorded successfully',
  })
  @ApiBearerAuth('Kiosk-auth')
  async heartbeat(
    @Param('id') kioskId: string,
    @Body() dto: KioskHeartbeatDto,
  ) {
    return this.sortingService.recordHeartbeat(kioskId, dto);
  }

  // ─── GET SORTING HISTORY ─────────────────────────

  @Get('sorting/events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Query sorting history (Admin only)',
    description: 'Returns historical sorting logs with filters and pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Historical records retrieved successfully',
  })
  @ApiBearerAuth('JWT-auth')
  async getEvents(@Query() query: SortingEventQueryDto) {
    return this.sortingService.getEvents(query);
  }

  // ─── GET USER ECOPOINTS LEDGER ───────────────────

  @Get('ecopoints/ledger/:userId')
  @ApiOperation({
    summary: "Retrieve user's EcoPoints ledger and tier status",
    description:
      'Returns a complete transaction log, current EcoPoints balance, and current tier status for the specified user.',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({
    status: 200,
    description: 'User ledger retrieved successfully',
  })
  async getLedger(@Param('userId') userId: string) {
    return this.sortingService.getLedger(userId);
  }
}
