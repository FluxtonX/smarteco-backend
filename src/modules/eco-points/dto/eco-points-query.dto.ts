import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

export class EcoPointsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Filter by action type (e.g., REGISTRATION, ORGANIC_PICKUP, REFERRAL)',
    example: 'ORGANIC_PICKUP',
  })
  @IsOptional()
  @IsString()
  action?: string;
}
