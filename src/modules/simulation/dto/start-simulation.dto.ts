import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SimulationScenario {
  FULL_E2E = 'full_e2e',
  USER_FLOW = 'user_flow',
  ADMIN_FLOW = 'admin_flow',
  API_FLOW = 'api_flow',
  DB_SYNC = 'db_sync',
  ERROR_HANDLING = 'error_handling',
}

export class StartSimulationDto {
  @ApiProperty({
    description: 'The simulation scenario to run',
    enum: SimulationScenario,
    example: SimulationScenario.FULL_E2E,
  })
  @IsEnum(SimulationScenario)
  @IsNotEmpty()
  scenario: SimulationScenario;
}
