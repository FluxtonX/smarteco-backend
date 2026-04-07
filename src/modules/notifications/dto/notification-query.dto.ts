import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto';

export class NotificationQueryDto extends PaginationDto {
    @ApiPropertyOptional({
        description: 'Filter by read status',
        example: false,
    })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    isRead?: boolean;
}
