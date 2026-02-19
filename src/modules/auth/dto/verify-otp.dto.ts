import { IsString, IsNotEmpty, IsOptional, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyOtpDto {
    @ApiProperty({
        description: 'Phone number in international format',
        example: '+250788123456',
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\+250\d{9}$/, {
        message: 'Phone number must be a valid Rwandan number in format +250XXXXXXXXX',
    })
    phone: string;

    @ApiProperty({
        description: '6-digit OTP code',
        example: '123456',
    })
    @IsString()
    @IsNotEmpty()
    @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
    otp: string;

    @ApiPropertyOptional({
        description: 'Referral code of the inviting user (only for first-time registration)',
        example: 'ECOJB2024',
    })
    @IsOptional()
    @IsString()
    referralCode?: string;

    @ApiPropertyOptional({
        description: 'Firebase Cloud Messaging token for push notifications',
        example: 'fMp6Kq...',
    })
    @IsOptional()
    @IsString()
    fcmToken?: string;
}
