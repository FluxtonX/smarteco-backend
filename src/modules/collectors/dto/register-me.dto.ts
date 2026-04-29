import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterMeDto {
  @ApiProperty({ example: 'RAD 123A', description: 'Vehicle plate number' })
  @IsString()
  @IsNotEmpty()
  vehiclePlate: string;

  @ApiProperty({ example: 'Kigali-Central', description: 'Operating zone' })
  @IsString()
  @IsNotEmpty()
  zone: string;

  @ApiPropertyOptional({ description: 'Optional photo URL for the collector' })
  @IsUrl()
  @IsOptional()
  photoUrl?: string;
}
