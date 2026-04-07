import { IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFillLevelDto {
    @ApiProperty({
        description: 'Fill level percentage (0-100)',
        example: 85,
        minimum: 0,
        maximum: 100,
    })
    @IsInt()
    @Min(0)
    @Max(100)
    fillLevel: number;
}
