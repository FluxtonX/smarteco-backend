import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignCollectorDto {
  @ApiProperty({ description: 'The UUID of the collector profile' })
  @IsUUID()
  @IsNotEmpty()
  collectorId: string;
}
