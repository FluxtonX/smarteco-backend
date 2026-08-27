import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsDateString,
  IsOptional,
  ValidateNested,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RawKioskEventDto {
  @ApiProperty({ description: 'Unique event UUID' })
  @IsString()
  @IsNotEmpty()
  event_id: string;

  @ApiPropertyOptional({ description: 'Schema version' })
  @IsOptional()
  @IsNumber()
  schema_version?: number;

  @ApiProperty({ description: 'Originating Kiosk ID' })
  @IsString()
  @IsNotEmpty()
  kiosk_id: string;

  @ApiPropertyOptional({ description: 'Session ID' })
  @IsOptional()
  @IsString()
  session_id?: string;

  @ApiPropertyOptional({ description: 'App version' })
  @IsOptional()
  @IsString()
  app_version?: string;

  @ApiProperty({ description: 'Timestamp when event occurred' })
  @IsDateString()
  occurred_at: string;

  @ApiPropertyOptional({ description: 'Sequence number' })
  @IsOptional()
  @IsNumber()
  seq?: number;

  @ApiProperty({ description: 'Event type (e.g. PHONE_SAVED, SORT)' })
  @IsString()
  @IsNotEmpty()
  event_type: string;

  @ApiPropertyOptional({ description: 'Category (e.g. LANDFILL, PLASTIC)' })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional({ description: 'Bin ID' })
  @IsOptional()
  @IsString()
  bin_id?: string | null;

  @ApiPropertyOptional({ description: 'Item description (e.g. smartphone, orange towel)' })
  @IsOptional()
  @IsString()
  item?: string | null;

  @ApiPropertyOptional({ description: 'Confidence score (0-100 or 0-1)' })
  @IsOptional()
  @IsNumber()
  confidence?: number;

  @ApiPropertyOptional({ description: 'Language code (e.g. en)' })
  @IsOptional()
  @IsString()
  language?: string | null;

  @ApiPropertyOptional({ description: 'Material type (e.g. OTHER)' })
  @IsOptional()
  @IsString()
  material?: string | null;

  @ApiPropertyOptional({ description: 'Mass in grams' })
  @IsOptional()
  @IsNumber()
  mass_g?: number | null;

  @ApiPropertyOptional({ description: 'Mass basis (e.g. estimated)' })
  @IsOptional()
  @IsString()
  mass_basis?: string | null;

  @ApiPropertyOptional({ description: 'CO2 factor' })
  @IsOptional()
  @IsNumber()
  co2_factor?: number | null;

  @ApiPropertyOptional({ description: 'CO2 kg' })
  @IsOptional()
  @IsNumber()
  co2_kg?: number | null;

  @ApiPropertyOptional({ description: 'Diverted boolean flag' })
  @IsOptional()
  @IsBoolean()
  diverted?: boolean;

  @ApiPropertyOptional({ description: 'Fill level after event' })
  @IsOptional()
  @IsNumber()
  fill_level_after?: number | null;

  @ApiPropertyOptional({ description: 'Synced at timestamp' })
  @IsOptional()
  @IsString()
  synced_at?: string | null;

  @ApiPropertyOptional({ description: 'Sync state' })
  @IsOptional()
  @IsNumber()
  sync_state?: number;
}

export class KioskExportPayloadDto {
  @ApiPropertyOptional({ description: 'Schema version' })
  @IsOptional()
  @IsNumber()
  schema_version?: number;

  @ApiProperty({ description: 'Originating Kiosk ID' })
  @IsString()
  @IsNotEmpty()
  kiosk_id: string;

  @ApiPropertyOptional({ description: 'App version' })
  @IsOptional()
  @IsString()
  app_version?: string;

  @ApiPropertyOptional({ description: 'Scope of export' })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional({ description: 'Export timestamp' })
  @IsOptional()
  @IsDateString()
  exported_at?: string;

  @ApiPropertyOptional({ description: 'Total count of events' })
  @IsOptional()
  @IsNumber()
  event_count?: number;

  @ApiProperty({ type: [RawKioskEventDto], description: 'Array of telemetry events' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RawKioskEventDto)
  events: RawKioskEventDto[];
}
