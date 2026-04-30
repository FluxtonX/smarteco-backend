import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleAvailabilityDto {
  @ApiProperty({
    description: 'Set collector availability status',
    example: true,
  })
  @IsBoolean()
  isAvailable: boolean;
}
