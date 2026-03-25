import { Controller, Post, Body, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { UssdService } from './ussd.service';

@ApiTags('USSD')
@Controller('ussd')
export class UssdController {
    constructor(private readonly ussdService: UssdService) {}

    @Post('callback')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'USSD callback endpoint',
        description:
            "Africa's Talking USSD callback handler. Receives session data and returns menu/response text.",
    })
    async handleCallback(
        @Body('sessionId') sessionId: string,
        @Body('phoneNumber') phoneNumber: string,
        @Body('text') text: string,
        @Body('serviceCode') serviceCode: string,
        @Res() res: Response,
    ) {
        // Normalize phone number to +250 format
        let phone = phoneNumber || '';
        if (phone.startsWith('0')) {
            phone = '+250' + phone.substring(1);
        } else if (!phone.startsWith('+')) {
            phone = '+' + phone;
        }

        const response = await this.ussdService.processRequest(
            sessionId,
            phone,
            text || '',
        );

        // Africa's Talking expects plain text response
        res.set('Content-Type', 'text/plain');
        res.send(response);
    }
}
