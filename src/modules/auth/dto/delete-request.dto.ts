import { IsString, IsNotEmpty, Matches, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeleteRequestDto {
  @ApiProperty({
    description: 'First Name of the user requesting deletion',
    example: 'Jean',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    description: 'Last Name of the user requesting deletion',
    example: 'Baptiste',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    description: 'Phone number registered in the system (international format)',
    example: '+250788123456',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in valid international format (e.g., +250XXXXXXXXX)',
  })
  phone: string;

  @ApiPropertyOptional({
    description: 'Email registered in the system (optional)',
    example: 'jean@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Reason for requesting account deletion',
    example: 'I no longer use this service.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
