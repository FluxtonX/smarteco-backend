import { IsEnum, IsOptional, IsNumber, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PickupStatus } from '@prisma/client';

export class UpdatePickupStatusDto {
    @ApiProperty({
        description: 'New status for the pickup',
        enum: ['EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'],
        example: 'EN_ROUTE',
    })
    @IsString()
    status: string;

    @ApiPropertyOptional({
        description: 'Weight in kg (required when status is COMPLETED)',
        example: 2.5,
    })
    @IsOptional()
    @IsNumber()
    weightKg?: number;

    @ApiPropertyOptional({
        description: 'Bin QR code to associate (optional, used on completion)',
        example: 'BIN-JBA-K8M2',
    })
    @IsOptional()
    @IsString()
    binQrCode?: string;
}
