import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
    @ApiProperty({
        description: 'Phone number in international format (Rwanda: +250XXXXXXXXX)',
        example: '+250788123456',
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\+250\d{9}$/, {
        message: 'Phone number must be a valid Rwandan number in format +250XXXXXXXXX',
    })
    phone: string;
}
