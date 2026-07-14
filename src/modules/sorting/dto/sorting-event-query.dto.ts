import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { SortingCategory } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

export class SortingEventQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by originating Kiosk ID',
    example: 'kiosk-uuid-12345',
  })
  @IsOptional()
  @IsString()
  kioskId?: string;

  @ApiPropertyOptional({
    description: 'Filter by classified waste category',
    enum: SortingCategory,
    example: SortingCategory.PLASTIC,
  })
  @IsOptional()
  @IsEnum(SortingCategory)
  category?: SortingCategory;

  @ApiPropertyOptional({
    description: 'Filter events captured on or after this ISO date',
    example: '2026-07-14T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter events captured on or before this ISO date',
    example: '2026-07-14T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
