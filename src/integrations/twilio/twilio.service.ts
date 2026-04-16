import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Twilio from 'twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly client: Twilio.Twilio;
  private readonly verifyServiceSid: string;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.verifyServiceSid = this.configService.get<string>(
      'TWILIO_VERIFY_SERVICE_SID',
    )!;

    if (!accountSid || !authToken || !this.verifyServiceSid) {
      this.logger.error(
        'Twilio credentials missing! Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID in .env',
      );
    }

    this.client = Twilio.default(accountSid, authToken);
    this.logger.log('Twilio Verify service initialized');
  }

  /**
   * Send an OTP verification code to the given phone number via SMS.
   * Twilio Verify handles code generation, expiry, and rate limiting.
   */
  async sendVerification(
    phone: string,
  ): Promise<{ success: boolean; status: string }> {
    try {
      const verification = await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({
          to: phone,
          channel: 'sms',
        });

      this.logger.log(
        `Verification sent to ${phone} — status: ${verification.status}`,
      );

      return { success: true, status: verification.status };
    } catch (error) {
      this.logger.error(
        `Failed to send verification to ${phone}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Check the OTP code submitted by the user against Twilio Verify.
   * Returns approved/pending/denied status.
   */
  async checkVerification(
    phone: string,
    code: string,
  ): Promise<{ valid: boolean; status: string }> {
    try {
      const verificationCheck = await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks.create({
          to: phone,
          code,
        });

      this.logger.log(
        `Verification check for ${phone} — status: ${verificationCheck.status}`,
      );

      return {
        valid: verificationCheck.status === 'approved',
        status: verificationCheck.status,
      };
    } catch (error) {
      this.logger.error(
        `Failed to check verification for ${phone}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
