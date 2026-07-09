import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveCollectorDto {
  @ApiProperty({
    description: 'Whether to approve (true) or reject (false) the collector',
    example: true,
  })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({
    description: 'Rejection reason (required when approved is false)',
    example: 'Incomplete documentation',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
