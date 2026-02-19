import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFcmTokenDto {
    @ApiProperty({
        description: 'Firebase Cloud Messaging token',
        example: 'fMp6KqR...',
    })
    @IsString()
    @IsNotEmpty()
    fcmToken: string;
}
