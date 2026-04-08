import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLocationDto {
  @ApiProperty({
    description: 'Current latitude',
    example: -1.9456,
  })
  @IsNumber()
  latitude: number;

  @ApiProperty({
    description: 'Current longitude',
    example: 29.8801,
  })
  @IsNumber()
  longitude: number;
}
