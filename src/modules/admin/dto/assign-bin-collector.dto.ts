import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignBinCollectorDto {
  @ApiProperty({ description: 'The UUID of the Smart Bin' })
  @IsNotEmpty()
  binId: string;

  @ApiProperty({ description: 'The UUID of the collector profile' })
  @IsUUID()
  @IsNotEmpty()
  collectorId: string;
}
