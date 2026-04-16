import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsOptional } from 'class-validator';

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
}
