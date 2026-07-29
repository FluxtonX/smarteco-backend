import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SimulationService } from './simulation.service';
import { StartSimulationDto } from './dto/start-simulation.dto';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SuperAdminGuard } from './super-admin.guard';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Simulation')
@Controller('simulation')
@UseGuards(JwtAuthGuard, RolesGuard, SuperAdminGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start a business simulation scenario',
    description:
      'Trigger a simulation run in the background. Super Admin only.',
  })
  @ApiResponse({ status: 200, description: 'Simulation started successfully' })
  @ApiResponse({ status: 403, description: 'Super Admin access required' })
  async startSimulation(
    @CurrentUser('id') userId: string,
    @Body() dto: StartSimulationDto,
  ) {
    return this.simulationService.startSimulation(userId, dto.scenario);
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'List all simulation sessions',
    description:
      'Get list of previous and running simulations. Super Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Simulation sessions list retrieved',
  })
  async getSessions() {
    return this.simulationService.getSessions();
  }

  @Get('sessions/:id')
  @ApiOperation({
    summary: 'Get details of a specific simulation session',
    description:
      'Check progress, logs, and final results of a simulation. Super Admin only.',
  })
  @ApiParam({ name: 'id', description: 'Simulation Session UUID' })
  @ApiResponse({
    status: 200,
    description: 'Simulation session details retrieved',
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSession(@Param('id', ParseUUIDPipe) id: string) {
    return this.simulationService.getSession(id);
  }

  @Post('sessions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a running simulation session',
    description: 'Abort a running simulation scenario. Super Admin only.',
  })
  @ApiParam({ name: 'id', description: 'Simulation Session UUID' })
  @ApiResponse({
    status: 200,
    description: 'Simulation cancelled successfully',
  })
  async cancelSimulation(@Param('id', ParseUUIDPipe) id: string) {
    return this.simulationService.cancelSimulation(id);
  }

  @Post('sessions/:id/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear all simulation-created records',
    description:
      'Delete all records associated with this simulation context. Super Admin only.',
  })
  @ApiParam({ name: 'id', description: 'Simulation Session UUID' })
  @ApiResponse({
    status: 200,
    description: 'Simulation data cleared successfully',
  })
  async clearSimulationData(@Param('id', ParseUUIDPipe) id: string) {
    return this.simulationService.clearSimulationData(id);
  }
}
