import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { WasteType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBinAdminDto {
  @ApiProperty({
    description: 'The User ID to assign the bin(s) to.',
    example: '7f6378df-871f-4569-aef2-c43ea0a1ca77',
  })
  @IsString()
  userId: string;

  @ApiPropertyOptional({
    description:
      'List of waste types to create. Defaults to [GENERAL, RECYCLABLE, ORGANIC].',
    enum: WasteType,
    isArray: true,
    example: [WasteType.GENERAL, WasteType.RECYCLABLE, WasteType.ORGANIC],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(WasteType, { each: true })
  wasteTypes?: WasteType[];

  @ApiPropertyOptional({
    description: 'Physical sensor device ID to pair with the bin immediately.',
    example: '5303dadc-d24c-41f7-b284-1cb21a8c48c3',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description:
      'Optional custom latitude. Defaults to user home/business latitude.',
    example: -1.9542,
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    description:
      'Optional custom longitude. Defaults to user home/business longitude.',
    example: 30.0928,
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}
