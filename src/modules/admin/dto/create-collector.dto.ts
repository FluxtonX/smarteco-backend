import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCollectorDto {
    @ApiProperty({ description: 'Phone number of the user to make a collector', example: '+250788111222' })
    @IsString()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({ description: 'Vehicle plate number', example: 'RAD 123A' })
    @IsString()
    @IsNotEmpty()
    vehiclePlate: string;

    @ApiProperty({ description: 'Assigned zone', example: 'Kigali-Central' })
    @IsString()
    @IsNotEmpty()
    zone: string;

    @ApiPropertyOptional({ description: 'Photo URL', example: 'https://...' })
    @IsOptional()
    @IsString()
    photoUrl?: string;
}
