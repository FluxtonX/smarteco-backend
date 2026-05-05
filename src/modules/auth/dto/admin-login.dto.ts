import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({
    example: 'admin@smarteco.rw',
    description: 'Admin email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'smartadmin321',
    description: 'Admin password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
