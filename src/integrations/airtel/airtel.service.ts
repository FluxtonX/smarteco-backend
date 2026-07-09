import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface AirtelPaymentResult {
  referenceId: string;
  transactionId?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}

export interface AirtelPaymentStatusResult {
  referenceId: string;
  transactionId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'TS' | 'TF' | 'TA' | 'TIP';
  message: string;
}

interface AirtelApiResponse {
  data?: {
    transaction?: {
      id?: string;
      status?: string;
      airtel_money_id?: string;
    };
  };
  status?: {
    code?: string;
    message?: string;
    success?: boolean;
  };
}

interface AirtelTokenResponse {
  access_token: string;
  expires_in: number;
}

@Injectable()
export class AirtelService {
  private readonly logger = new Logger(AirtelService.name);
  private client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly isSandbox: boolean;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('AIRTEL_BASE_URL') ||
      'https://openapiuat.airtel.africa';
    this.clientId = this.configService.get<string>('AIRTEL_CLIENT_ID') || '';
    this.clientSecret =
      this.configService.get<string>('AIRTEL_CLIENT_SECRET') || '';
    this.isSandbox = this.baseUrl.includes('uat');

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(
      `Airtel Money service initialized (sandbox: ${this.isSandbox})`,
    );
  }

  // ─── REQUEST TO PAY (Collection) ────────────────

  async requestToPay(
    amount: number,
    currency: string,
    payerPhone: string,
    externalId: string,
  ): Promise<AirtelPaymentResult> {
    const referenceId = uuidv4();

    // If no keys configured, return sandbox mock
    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'Airtel API keys not configured — returning sandbox mock response',
      );
      return {
        referenceId,
        status: 'PENDING',
      };
    }

    try {
      const token = await this.getAccessToken();

      const response = await this.client.post<AirtelApiResponse>(
        '/merchant/v2/payments/',
        {
          reference: externalId,
          subscriber: {
            country: 'RW',
            currency,
            msisdn: this.formatPhone(payerPhone),
          },
          transaction: {
            amount: amount.toString(),
            country: 'RW',
            currency,
            id: referenceId,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Country': 'RW',
            'X-Currency': currency,
          },
        },
      );

      const txData = response.data?.data?.transaction;

      this.logger.log(
        `Airtel Request to Pay initiated: ${referenceId} for ${amount} ${currency} — response: ${JSON.stringify(response.data?.status)}`,
      );

      return {
        referenceId,
        transactionId: txData?.id,
        status: txData?.status === 'TS' ? 'SUCCESS' : 'PENDING',
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `Airtel Request to Pay failed: ${error.message}`,
          error.response?.data,
        );
      } else {
        this.logger.error(
          `Airtel Request to Pay failed: ${(error as Error).message}`,
        );
      }
      throw error;
    }
  }

  // ─── CHECK PAYMENT STATUS ───────────────────────

  async checkPaymentStatus(
    transactionId: string,
  ): Promise<AirtelPaymentStatusResult> {
    // If no keys configured, return sandbox mock
    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'Airtel API keys not configured — returning sandbox mock status',
      );
      return {
        referenceId: transactionId,
        transactionId,
        status: 'SUCCESS',
        message: 'Sandbox mock — payment successful',
      };
    }

    try {
      const token = await this.getAccessToken();

      const response = await this.client.get<AirtelApiResponse>(
        `/standard/v1/payments/${transactionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Country': 'RW',
            'X-Currency': 'RWF',
          },
        },
      );

      const txData = response.data?.data?.transaction;

      let status: AirtelPaymentStatusResult['status'] = 'PENDING';
      if (txData?.status === 'TS') status = 'SUCCESS';
      else if (txData?.status === 'TF') status = 'FAILED';
      else
        status =
          (txData?.status as AirtelPaymentStatusResult['status']) || 'PENDING';

      this.logger.log(`Airtel payment ${transactionId} status: ${status}`);

      return {
        referenceId: txData?.airtel_money_id || transactionId,
        transactionId,
        status,
        message: response.data?.status?.message || '',
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `Airtel check status failed: ${error.message}`,
          error.response?.data,
        );
      } else {
        this.logger.error(
          `Airtel check status failed: ${(error as Error).message}`,
        );
      }
      throw error;
    }
  }

  // ─── DISBURSEMENT (Pay Collectors) ──────────────

  async disbursement(
    amount: number,
    currency: string,
    payeePhone: string,
    externalId: string,
  ): Promise<{ referenceId: string; status: string }> {
    const referenceId = uuidv4();

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'Airtel API keys not configured — returning sandbox mock disbursement',
      );
      return { referenceId, status: 'PENDING' };
    }

    try {
      const token = await this.getAccessToken();

      await this.client.post(
        '/standard/v2/disbursements/',
        {
          payee: {
            msisdn: this.formatPhone(payeePhone),
            wallet_type: 'NORMAL',
          },
          reference: externalId,
          pin: this.configService.get<string>('AIRTEL_PIN') || '',
          transaction: {
            amount: amount.toString(),
            id: referenceId,
            type: 'B2C',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Country': 'RW',
            'X-Currency': currency,
          },
        },
      );

      this.logger.log(
        `Airtel Disbursement initiated: ${referenceId} for ${amount} ${currency}`,
      );
      return { referenceId, status: 'PENDING' };
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `Airtel Disbursement failed: ${error.message}`,
          error.response?.data,
        );
      } else {
        this.logger.error(
          `Airtel Disbursement failed: ${(error as Error).message}`,
        );
      }
      throw error;
    }
  }

  // ─── GET ACCESS TOKEN ───────────────────────────

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      const response = await this.client.post<AirtelTokenResponse>(
        '/auth/oauth2/token',
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        },
      );

      this.accessToken = response.data.access_token;
      const expiresIn = (response.data.expires_in || 3600) - 60;
      this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);

      this.logger.log('Airtel access token refreshed');
      return this.accessToken;
    } catch (error) {
      this.logger.error(
        `Airtel token request failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // ─── HELPERS ────────────────────────────────────

  private formatPhone(phone: string): string {
    // Remove country code +250, Airtel expects local number (78xxxxxxx)
    const cleaned = phone.replace(/^\+?250/, '');
    // Ensure 9 digits
    if (cleaned.length === 9) return cleaned;
    return cleaned.replace(/\D/g, '');
  }
}
