import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { BinStatus, WasteType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBinAdminDto {
  @ApiPropertyOptional({
    description:
      'The physical Device EUI / sensor ID to map to this bin. Pass an empty string to unlink.',
    example: '24e124c0002a3f01',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description:
      'Empty height calibration in millimeters (distance from sensor to empty bottom).',
    example: 1200,
    minimum: 100,
    maximum: 5000,
  })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(5000)
  emptyHeightMm?: number;

  @ApiPropertyOptional({
    description:
      'Full height calibration threshold in millimeters (height at which bin is considered 100% full).',
    example: 200,
    minimum: 0,
    maximum: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  fullHeightMm?: number;

  @ApiPropertyOptional({
    description: 'The status of the bin (ACTIVE, FULL, MAINTENANCE, INACTIVE).',
    enum: BinStatus,
    example: BinStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(BinStatus)
  status?: BinStatus;

  @ApiPropertyOptional({
    description: 'Latitude coordinate of the bin.',
    example: -1.9441,
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude coordinate of the bin.',
    example: 30.0619,
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Waste type classification of the bin.',
    enum: WasteType,
    example: WasteType.GLASS,
  })
  @IsOptional()
  @IsEnum(WasteType)
  wasteType?: WasteType;
}
