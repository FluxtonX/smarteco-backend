import { IsString, IsOptional, IsIn, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportBinDto {
    @ApiProperty({
        description: 'Type of issue',
        enum: ['FULL', 'DAMAGED', 'MAINTENANCE'],
        example: 'FULL',
    })
    @IsString()
    @IsIn(['FULL', 'DAMAGED', 'MAINTENANCE'])
    issue: string;

    @ApiPropertyOptional({
        description: 'Additional notes about the bin issue',
        example: 'Overflowing, needs immediate pickup',
    })
    @IsOptional()
    @IsString()
    notes?: string;
}
