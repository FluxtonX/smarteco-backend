import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ZonePointDto {
  @ApiProperty({ example: -1.9441 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: 30.0619 })
  @IsNumber()
  longitude: number;
}

export class CollectorDocumentUploadDto {
  @ApiProperty({ enum: ['LICENSE', 'ID'] })
  @IsIn(['LICENSE', 'ID'])
  documentType: 'LICENSE' | 'ID';

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  contentType: string;

  @ApiProperty({ example: 'license.pdf' })
  @IsString()
  @IsNotEmpty()
  fileName: string;
}

export class RegisterMeDto {
  @ApiProperty({
    example: 'Kigali Waste Services',
    description: 'Business or individual collector name',
  })
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

  @ApiPropertyOptional({ description: 'S3 public URL for driver license' })
  @IsUrl()
  @IsOptional()
  licenseDocumentUrl?: string;

  @ApiPropertyOptional({ description: 'S3 object key for driver license' })
  @IsString()
  @IsOptional()
  licenseDocumentKey?: string;

  @ApiPropertyOptional({ description: 'S3 public URL for national ID' })
  @IsUrl()
  @IsOptional()
  idDocumentUrl?: string;

  @ApiPropertyOptional({ description: 'S3 object key for national ID' })
  @IsString()
  @IsOptional()
  idDocumentKey?: string;

  @ApiPropertyOptional({
    description: 'Collector operating zone polygon coordinates',
    type: [ZonePointDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ZonePointDto)
  @IsOptional()
  zonePolygon?: ZonePointDto[];
}
