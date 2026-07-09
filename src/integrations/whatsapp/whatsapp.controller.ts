import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'WhatsApp webhook',
    description:
      'Twilio WhatsApp webhook handler. Receives incoming messages and responds with TwiML.',
  })
  async handleWebhook(
    @Body('From') from: string,
    @Body('Body') body: string,
    @Body('MessageSid') messageSid: string,
    @Res() res: Response,
  ) {
    const reply = await this.whatsAppService.processIncoming(
      from || '',
      body || '',
    );

    // Respond with TwiML
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${this.escapeXml(reply)}</Message>
</Response>`;

    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send WhatsApp message',
    description: 'Send a WhatsApp message to a phone number via Twilio.',
  })
  async sendMessage(@Body('to') to: string, @Body('message') message: string) {
    const result = await this.whatsAppService.sendMessage(to, message);
    return {
      success: true,
      data: result,
    };
  }

  @Post('send-interactive-menu')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send interactive WhatsApp menu',
    description:
      'Sends quick-reply style interactive menu via Twilio Content Template (falls back to text menu if template is not configured).',
  })
  async sendInteractiveMenu(
    @Body('to') to: string,
    @Body('name') name?: string,
  ) {
    const result = await this.whatsAppService.sendInteractiveMenu(
      to,
      name || 'there',
    );
    return {
      success: true,
      data: result,
    };
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
