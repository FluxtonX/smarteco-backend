import { IsOptional, IsString, IsEmail, IsEnum } from 'class-validator';
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
}
