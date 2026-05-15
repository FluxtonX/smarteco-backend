import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IotBinSyncDto {
  @ApiProperty({ example: 'BIN-ABC-1234' })
  @IsString()
  @IsNotEmpty()
  qrCode: string;

  @ApiPropertyOptional({ example: 'ESP32-BIN-0001' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ example: '1.0.3' })
  @IsOptional()
  @IsString()
  firmware?: string;

  @ApiProperty({
    description:
      'Shared device API key. Configure IOT_DEVICE_API_KEY in production.',
    example: 'device-secret',
  })
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @ApiProperty({ example: 87, minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  fillLevel: number;

  @ApiPropertyOptional({ example: 78, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryLevel?: number;

  @ApiPropertyOptional({ example: -1.9441 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 30.0619 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: -67 })
  @IsOptional()
  @IsNumber()
  signalRssi?: number;
}
