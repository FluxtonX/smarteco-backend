import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto';
import { UserType, UserRole } from '@prisma/client';

export class AdminUserQueryDto extends PaginationDto {
    @ApiPropertyOptional({ description: 'Search by name or phone', example: 'Jean' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Filter by user type', enum: UserType })
    @IsOptional()
    @IsEnum(UserType)
    userType?: UserType;

    @ApiPropertyOptional({ description: 'Filter by role', enum: UserRole })
    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @ApiPropertyOptional({ description: 'Filter by active status' })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    isActive?: boolean;
}
