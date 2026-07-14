import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsDateString, Min, Max } from 'class-validator';

export class KioskHeartbeatDto {
  @ApiPropertyOptional({ example: 'online' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'v1.2.0' })
  @IsOptional()
  @IsString()
  appVersion?: string;

  @ApiPropertyOptional({ example: 'extra_trees_v2.1' })
  @IsOptional()
  @IsString()
  onnxModelVersion?: string;

  @ApiPropertyOptional({ example: 34.5, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  diskUsagePercentage?: number;

  @ApiPropertyOptional({ example: 12.8, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  cpuLoad?: number;

  @ApiPropertyOptional({ example: '2026-07-14T07:58:56Z' })
  @IsOptional()
  @IsDateString()
  localTime?: string;
}
