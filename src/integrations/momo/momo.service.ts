import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface MomoRequestToPayResult {
  referenceId: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  externalId: string;
}

export interface MomoPaymentStatusResult {
  referenceId: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  amount: string;
  currency: string;
  payerPartyId: string;
  payerMessage: string;
  payeeNote: string;
  externalId: string;
  reason?: string;
}

interface MomoApiResponse {
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  amount: string;
  currency: string;
  payer?: {
    partyId?: string;
  };
  payerMessage?: string;
  payeeNote?: string;
  externalId?: string;
  reason?: string;
}

interface MomoTokenResponse {
  access_token: string;
  expires_in: number;
}

@Injectable()
export class MomoService {
  private readonly logger = new Logger(MomoService.name);
  private client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiUser: string;
  private readonly subscriptionKey: string;
  private readonly isSandbox: boolean;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('MOMO_BASE_URL') ||
      'https://sandbox.momodeveloper.mtn.com';
    this.apiKey = this.configService.get<string>('MOMO_API_KEY') || '';
    this.apiUser = this.configService.get<string>('MOMO_API_USER') || '';
    this.subscriptionKey =
      this.configService.get<string>('MOMO_SUBSCRIPTION_KEY') || '';
    this.isSandbox = this.baseUrl.includes('sandbox');

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
      },
    });

    this.logger.log(`MoMo service initialized (sandbox: ${this.isSandbox})`);
  }

  // ─── REQUEST TO PAY ─────────────────────────────
  // Initiates a payment request to the user's MTN MoMo wallet

  async requestToPay(
    amount: number,
    currency: string,
    payerPhone: string,
    externalId: string,
    payerMessage: string,
    payeeNote: string,
  ): Promise<MomoRequestToPayResult> {
    const referenceId = uuidv4();

    // If no API keys configured, return sandbox mock
    if (!this.apiKey || !this.subscriptionKey) {
      this.logger.warn(
        'MoMo API keys not configured — returning sandbox mock response',
      );
      return {
        referenceId,
        status: 'PENDING',
        externalId,
      };
    }

    try {
      // Get access token
      const token = await this.getAccessToken();

      // Request to Pay
      await this.client.post(
        '/collection/v1_0/requesttopay',
        {
          amount: amount.toString(),
          currency,
          externalId,
          payer: {
            partyIdType: 'MSISDN',
            partyId: this.formatPhone(payerPhone),
          },
          payerMessage,
          payeeNote,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Reference-Id': referenceId,
            'X-Target-Environment': this.isSandbox ? 'sandbox' : 'mtnrwanda',
          },
        },
      );

      this.logger.log(
        `MoMo Request to Pay initiated: ${referenceId} for ${amount} ${currency}`,
      );

      return {
        referenceId,
        status: 'PENDING',
        externalId,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `MoMo Request to Pay failed: ${error.message}`,
          error.response?.data,
        );
      } else {
        this.logger.error(
          `MoMo Request to Pay failed: ${(error as Error).message}`,
        );
      }
      throw error;
    }
  }

  // ─── CHECK PAYMENT STATUS ───────────────────────

  async checkPaymentStatus(
    referenceId: string,
  ): Promise<MomoPaymentStatusResult> {
    // If no API keys configured, return sandbox mock
    if (!this.apiKey || !this.subscriptionKey) {
      this.logger.warn(
        'MoMo API keys not configured — returning sandbox mock status',
      );
      return {
        referenceId,
        status: 'SUCCESSFUL',
        amount: '0',
        currency: 'RWF',
        payerPartyId: '',
        payerMessage: 'Sandbox mock',
        payeeNote: 'Sandbox mock',
        externalId: '',
      };
    }

    try {
      const token = await this.getAccessToken();

      const response = await this.client.get<MomoApiResponse>(
        `/collection/v1_0/requesttopay/${referenceId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Target-Environment': this.isSandbox ? 'sandbox' : 'mtnrwanda',
          },
        },
      );

      this.logger.log(
        `MoMo payment ${referenceId} status: ${response.data.status}`,
      );

      return {
        referenceId,
        status: response.data.status,
        amount: response.data.amount,
        currency: response.data.currency,
        payerPartyId: response.data.payer?.partyId || '',
        payerMessage: response.data.payerMessage || '',
        payeeNote: response.data.payeeNote || '',
        externalId: response.data.externalId || '',
        reason: response.data.reason,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `MoMo check status failed: ${error.message}`,
          error.response?.data,
        );
      } else {
        this.logger.error(
          `MoMo check status failed: ${(error as Error).message}`,
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
    payerMessage: string,
    payeeNote: string,
  ): Promise<{ referenceId: string; status: string }> {
    const referenceId = uuidv4();

    if (!this.apiKey || !this.subscriptionKey) {
      this.logger.warn(
        'MoMo API keys not configured — returning sandbox mock disbursement',
      );
      return { referenceId, status: 'PENDING' };
    }

    try {
      const token = await this.getAccessToken();

      await this.client.post(
        '/disbursement/v1_0/transfer',
        {
          amount: amount.toString(),
          currency,
          externalId,
          payee: {
            partyIdType: 'MSISDN',
            partyId: this.formatPhone(payeePhone),
          },
          payerMessage,
          payeeNote,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Reference-Id': referenceId,
            'X-Target-Environment': this.isSandbox ? 'sandbox' : 'mtnrwanda',
          },
        },
      );

      this.logger.log(
        `MoMo Disbursement initiated: ${referenceId} for ${amount} ${currency}`,
      );
      return { referenceId, status: 'PENDING' };
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `MoMo Disbursement failed: ${error.message}`,
          error.response?.data,
        );
      } else {
        this.logger.error(
          `MoMo Disbursement failed: ${(error as Error).message}`,
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
      const credentials = Buffer.from(
        `${this.apiUser}:${this.apiKey}`,
      ).toString('base64');

      const response = await this.client.post<MomoTokenResponse>(
        '/collection/token/',
        null,
        {
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        },
      );

      this.accessToken = response.data.access_token;
      // Token expires in X seconds — buffer by 60s
      const expiresIn = (response.data.expires_in || 3600) - 60;
      this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);

      this.logger.log('MoMo access token refreshed');
      return this.accessToken;
    } catch (error) {
      this.logger.error(
        `MoMo token request failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // ─── HELPERS ────────────────────────────────────

  private formatPhone(phone: string): string {
    // Remove + prefix if present, MoMo expects digits only
    return phone.replace(/^\+/, '');
  }
}
