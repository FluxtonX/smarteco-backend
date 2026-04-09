import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CancelPickupDto {
  @ApiPropertyOptional({
    description: 'Reason for cancellation',
    example: 'No longer needed',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
