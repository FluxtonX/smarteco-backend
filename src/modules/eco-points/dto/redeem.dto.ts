import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class RedeemDto {
  @ApiProperty({ example: 'MTN_AIRTIME' })
  @IsString()
  @IsNotEmpty()
  rewardId: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(1)
  points: number;

  @ApiProperty({ example: 'MTN Airtime - 1,000 RWF' })
  @IsString()
  @IsNotEmpty()
  description: string;
}
