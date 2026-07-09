import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

export class CollectorHistoryQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by pickup status',
    enum: ['COMPLETED', 'CANCELLED'],
    example: 'COMPLETED',
  })
  @IsOptional()
  @IsString()
  @IsIn(['COMPLETED', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by waste type',
    enum: ['ORGANIC', 'RECYCLABLE', 'EWASTE', 'GENERAL', 'GLASS', 'HAZARDOUS'],
  })
  @IsOptional()
  @IsString()
  wasteType?: string;

  @ApiPropertyOptional({
    description: 'Filter from date (YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Filter to date (YYYY-MM-DD)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsString()
  to?: string;
}
