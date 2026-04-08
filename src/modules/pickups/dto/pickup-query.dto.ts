import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PickupStatus, WasteType } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

export class PickupQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by pickup status',
    enum: PickupStatus,
  })
  @IsOptional()
  @IsEnum(PickupStatus)
  status?: PickupStatus;

  @ApiPropertyOptional({
    description: 'Filter by waste type',
    enum: WasteType,
  })
  @IsOptional()
  @IsEnum(WasteType)
  wasteType?: WasteType;

  @ApiPropertyOptional({
    description: 'Filter from date (YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Filter to date (YYYY-MM-DD)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
