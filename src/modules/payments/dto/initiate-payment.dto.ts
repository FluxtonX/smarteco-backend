import { IsString, IsNumber, IsEnum, IsNotEmpty, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum PaymentMethodEnum {
    MOMO = 'MOMO',
    AIRTEL = 'AIRTEL',
}

export class InitiatePaymentDto {
    @ApiProperty({
        description: 'Pickup ID to pay for',
        example: 'uuid',
    })
    @IsUUID()
    pickupId: string;

    @ApiProperty({
        description: 'Payment method',
        enum: PaymentMethodEnum,
        example: 'MOMO',
    })
    @IsEnum(PaymentMethodEnum, {
        message: 'Payment method must be MOMO or AIRTEL',
    })
    method: PaymentMethodEnum;

    @ApiProperty({
        description: 'Amount in RWF',
        example: 500,
    })
    @IsNumber()
    @Min(1)
    amount: number;

    @ApiProperty({
        description: 'Phone number for mobile money (if different from account)',
        example: '+250788123456',
    })
    @IsString()
    @IsNotEmpty()
    phone: string;
}
