import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterMeDto {
  @ApiProperty({ example: 'Kigali Waste Services', description: 'Business or individual collector name' })
  @IsString()
  @IsNotEmpty()
  collectorName: string;

  @ApiProperty({ example: 'RAD 123A', description: 'Vehicle plate number' })
  @IsString()
  @IsNotEmpty()
  vehiclePlate: string;

  @ApiProperty({ example: 'Kigali-Central', description: 'Operating zone' })
  @IsString()
  @IsNotEmpty()
  zone: string;

  @ApiProperty({ example: -1.9441, description: 'Current latitude' })
  @IsOptional()
  latitude?: number;

  @ApiProperty({ example: 30.0619, description: 'Current longitude' })
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Optional photo URL for the collector' })
  @IsUrl()
  @IsOptional()
  photoUrl?: string;
}
