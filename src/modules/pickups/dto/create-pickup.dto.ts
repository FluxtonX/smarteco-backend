import {
    IsEnum,
    IsString,
    IsNumber,
    IsOptional,
    IsDateString,
    IsUUID,
    IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WasteType, TimeSlot } from '@prisma/client';

export class CreatePickupDto {
    @ApiProperty({
        description: 'Type of waste for pickup',
        enum: WasteType,
        example: 'ORGANIC',
    })
    @IsEnum(WasteType, {
        message: `wasteType must be one of: ${Object.values(WasteType).join(', ')}`,
    })
    wasteType: WasteType;

    @ApiProperty({
        description: 'Scheduled date for pickup (must be at least 24 hours in the future)',
        example: '2026-04-15',
    })
    @IsDateString({}, { message: 'scheduledDate must be a valid date string (YYYY-MM-DD)' })
    scheduledDate: string;

    @ApiProperty({
        description: 'Preferred time slot',
        enum: TimeSlot,
        example: 'MORNING_8_10',
    })
    @IsEnum(TimeSlot, {
        message: `timeSlot must be one of: ${Object.values(TimeSlot).join(', ')}`,
    })
    timeSlot: TimeSlot;

    @ApiProperty({
        description: 'Pickup address',
        example: 'KG 123 Street, Kigali',
    })
    @IsString()
    @IsNotEmpty()
    address: string;

    @ApiProperty({
        description: 'Latitude of the pickup location',
        example: -1.9403,
    })
    @IsNumber()
    latitude: number;

    @ApiProperty({
        description: 'Longitude of the pickup location',
        example: 29.8739,
    })
    @IsNumber()
    longitude: number;

    @ApiPropertyOptional({
        description: 'Additional notes for the collector',
        example: 'Large bag of compost waste',
    })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({
        description: 'Optional bin ID to associate with this pickup',
        example: 'uuid',
    })
    @IsOptional()
    @IsUUID()
    binId?: string;
}
