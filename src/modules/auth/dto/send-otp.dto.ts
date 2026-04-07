import { IsString, IsNotEmpty, Matches, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendOtpDto {
    @ApiProperty({
        description: 'Phone number in international format (e.g., +250..., +92..., +1..., +33...)',
        example: '+250788123456',
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\+[1-9]\d{1,14}$/, {
        message: 'Phone number must be in valid international format (e.g., +250XXXXXXXXX)',
    })
    phone: string;

    @ApiPropertyOptional({
        description: 'Check if user should exist or not',
        example: true,
    })
    @IsOptional()
    @IsBoolean()
    isLogin?: boolean;
}
