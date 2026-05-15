import {
  IsOptional,
  IsString,
  IsEmail,
  IsEnum,
  IsNumber,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserType } from '@prisma/client';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'First name',
    example: 'Jean',
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name',
    example: 'Baptiste',
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'jean@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({
    description: 'User type',
    enum: UserType,
    example: 'RESIDENTIAL',
  })
  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @ApiPropertyOptional({
    description: 'Avatar URL',
    example: 'https://storage.example.com/avatars/user-123.jpg',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Default/home pickup address' })
  @IsOptional()
  @IsString()
  defaultAddress?: string;

  @ApiPropertyOptional({ description: 'Home latitude', example: -1.9441 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  homeLatitude?: number;

  @ApiPropertyOptional({ description: 'Home longitude', example: 30.0619 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  homeLongitude?: number;
}
