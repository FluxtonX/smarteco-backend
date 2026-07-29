import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateAdminUserDto {
  @ApiProperty({ description: 'First name', example: 'Fabrice' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Nkurunziza' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    description: 'Email address',
    example: 'ops.manager@smarteco.rw',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Phone number', example: '+250788111222' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: 'Password', example: 'SmartEco2026!' })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: UserRole.ADMIN,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({
    description: 'Sub role (e.g. Finance Admin, Operations Manager)',
    example: 'Finance Admin',
  })
  @IsString()
  @IsOptional()
  subRole?: string;

  @ApiProperty({ description: 'Active status', example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
