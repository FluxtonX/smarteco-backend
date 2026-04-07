import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScanBinDto {
    @ApiProperty({
        description: 'QR code of the bin to scan',
        example: 'BIN-JBA-K8M2',
    })
    @IsString()
    @IsNotEmpty()
    qrCode: string;
}
