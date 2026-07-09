import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class GoogleLoginDto {
  @ApiProperty({
    example: 'eyJhbGciOi...',
    description: 'The Firebase ID Token obtained from the Flutter app',
  })
  @IsNotEmpty()
  @IsString()
  idToken: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'The email address of the user',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'The display name of the user',
  })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({
    example: 'https://...',
    description: 'The photo URL of the user',
  })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiProperty({
    example: 'DEVICE_TOKEN',
    description: 'Optional FCM token for notifications',
  })
  @IsOptional()
  @IsString()
  fcmToken?: string;

  @ApiProperty({
    required: false,
    enum: UserRole,
    example: UserRole.USER,
    description:
      'When creating a brand new account via Google, indicates USER vs COLLECTOR intent (used to control initial provisioning).',
  })
  @IsOptional()
  @IsEnum(UserRole)
  signupRole?: UserRole;
}
