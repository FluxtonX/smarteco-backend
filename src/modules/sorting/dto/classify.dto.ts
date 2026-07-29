import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsUUID,
  ValidateNested,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SortingCategory } from '@prisma/client';

export class SingleClassifyEventDto {
  @ApiProperty({
    description:
      'Unique key to identify this event and prevent duplicate processing.',
    example: 'kiosk-01-uuid-123456789',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @ApiProperty({
    description: 'The classified waste category',
    enum: SortingCategory,
    example: SortingCategory.PLASTIC,
  })
  @IsEnum(SortingCategory)
  category: SortingCategory;

  @ApiProperty({
    description: 'Model confidence score (0 to 1)',
    example: 0.89,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @ApiProperty({
    description: 'Timestamp when the item was captured locally',
    example: '2026-07-14T07:30:00Z',
  })
  @IsDateString()
  capturedAt: string;

  @ApiPropertyOptional({
    description: 'User ID if the user is identified at the kiosk',
    example: 'user-uuid-123',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Bin ID if specific bin sync is requested',
    example: 'bin-uuid-456',
  })
  @IsOptional()
  @IsUUID()
  binId?: string;
}

export class ClassifyDto {
  @ApiProperty({
    description: 'List of sorting events to ingest (supports batching)',
    type: [SingleClassifyEventDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SingleClassifyEventDto)
  events: SingleClassifyEventDto[];
}
