import { IsString, IsNotEmpty, IsEmail, IsOptional, IsEnum, IsPhoneNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserType, UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ description: 'Phone number in international format', example: '+250788123456' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiPropertyOptional({ description: 'First name of the user', example: 'Jean' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name of the user', example: 'Baptiste' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Full name (will be split into first and last name if provided)', example: 'Jean Baptiste' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'jean@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'User type', enum: UserType, default: UserType.RESIDENTIAL })
  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType = UserType.RESIDENTIAL;

  @ApiPropertyOptional({ description: 'Role', enum: UserRole, default: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole = UserRole.USER;

  @ApiPropertyOptional({ description: 'Referral code', example: 'ECO-12345' })
  @IsOptional()
  @IsString()
  referralCode?: string;
}
