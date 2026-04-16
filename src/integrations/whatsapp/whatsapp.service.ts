import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import axios, { AxiosError } from 'axios';

interface TwilioMessageResponse {
  sid: string;
  status: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly isConfigured: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.accountSid =
      this.configService.get<string>('TWILIO_ACCOUNT_SID') || '';
    this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN') || '';
    this.fromNumber =
      this.configService.get<string>('TWILIO_WHATSAPP_FROM') ||
      'whatsapp:+14155238886';
    this.isConfigured = !!(this.accountSid && this.authToken);

    this.logger.log(
      `WhatsApp service initialized (configured: ${this.isConfigured})`,
    );
  }

  // ─── SEND WHATSAPP MESSAGE ──────────────────────

  async sendMessage(
    to: string,
    body: string,
  ): Promise<{ sid: string; status: string }> {
    if (!this.isConfigured) {
      this.logger.warn(
        `WhatsApp not configured — mock sending to ${to}: "${body.substring(0, 50)}..."`,
      );
      return { sid: `mock-${Date.now()}`, status: 'queued' };
    }

    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

      // Format WhatsApp number
      const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

      const params = new URLSearchParams();
      params.append('To', toWhatsApp);
      params.append('From', this.fromNumber);
      params.append('Body', body);

      const response = await axios.post<TwilioMessageResponse>(
        twilioUrl,
        params.toString(),
        {
          auth: {
            username: this.accountSid,
            password: this.authToken,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.logger.log(`WhatsApp sent to ${to}: SID=${response.data.sid}`);
      return {
        sid: response.data.sid,
        status: response.data.status,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `WhatsApp send failed: ${error.message}`,
          error.response?.data,
        );
      } else {
        this.logger.error(`WhatsApp send failed: ${(error as Error).message}`);
      }
      throw error;
    }
  }

  // ─── PROCESS INCOMING WHATSAPP MESSAGE ──────────
  // Twilio webhook handler — receives user messages and returns replies

  async processIncoming(from: string, body: string): Promise<string> {
    const phone = from.replace('whatsapp:', '');
    const input = body.trim().toLowerCase();

    this.logger.log(`WhatsApp incoming from ${phone}: "${body}"`);

    try {
      // Find user
      const user = await this.prisma.user.findUnique({ where: { phone } });

      if (!user) {
        return this.buildResponse([
          '👋 Welcome to SmartEco!',
          '',
          "You're not registered yet.",
          'Download the SmartEco app to get started:',
          '📱 https://smarteco.rw/download',
        ]);
      }

      // Handle commands
      if (
        input === 'hi' ||
        input === 'hello' ||
        input === 'menu' ||
        input === 'start'
      ) {
        return this.mainMenu(user.firstName || 'there');
      }

      if (input === '1' || input === 'status' || input === 'pickup') {
        return this.getPickupStatus(user.id);
      }

      if (input === '2' || input === 'points' || input === 'eco') {
        return this.getEcoPoints(user.id);
      }

      if (input === '3' || input === 'bins' || input === 'bin') {
        return this.getBinStatus(user.id);
      }

      if (input === '4' || input === 'help' || input === 'support') {
        return this.getSupport();
      }

      // Default — show menu
      return this.mainMenu(user.firstName || 'there');
    } catch (error) {
      this.logger.error(
        `WhatsApp processing error: ${(error as Error).message}`,
      );
      return this.buildResponse([
        '❌ Something went wrong.',
        'Please try again or contact support at +250788000000',
      ]);
    }
  }

  // ─── NOTIFICATION SENDERS ───────────────────────
  // Pre-built notification templates

  async sendPickupConfirmation(
    phone: string,
    reference: string,
    wasteType: string,
    date: string,
  ) {
    return this.sendMessage(
      phone,
      this.buildResponse([
        '✅ *Pickup Scheduled!*',
        '',
        `📋 Reference: ${reference}`,
        `♻️ Waste Type: ${wasteType}`,
        `📅 Date: ${date}`,
        '',
        'We will notify you when a collector is assigned.',
        '',
        '_Reply "status" to check your pickup status._',
      ]),
    );
  }

  async sendCollectorAssigned(
    phone: string,
    reference: string,
    collectorName: string,
  ) {
    return this.sendMessage(
      phone,
      this.buildResponse([
        '👤 *Collector Assigned!*',
        '',
        `📋 Pickup: ${reference}`,
        `🚛 Collector: ${collectorName}`,
        '',
        'Your collector will arrive at the scheduled time.',
        '',
        '_Reply "status" for live updates._',
      ]),
    );
  }

  async sendCollectorEnRoute(phone: string, reference: string, eta: number) {
    return this.sendMessage(
      phone,
      this.buildResponse([
        '🚛 *Collector On The Way!*',
        '',
        `📋 Pickup: ${reference}`,
        `⏱️ ETA: ~${eta} minutes`,
        '',
        'Please have your waste ready at the collection point.',
      ]),
    );
  }

  async sendPickupCompleted(
    phone: string,
    reference: string,
    points: number,
    weight: number,
  ) {
    return this.sendMessage(
      phone,
      this.buildResponse([
        '🎉 *Pickup Completed!*',
        '',
        `📋 Reference: ${reference}`,
        `⚖️ Weight: ${weight}kg`,
        `⭐ Points Earned: ${points}`,
        '',
        'Thank you for keeping our environment clean! 🌿',
        '',
        '_Reply "points" to see your total._',
      ]),
    );
  }

  // ─── PRIVATE HELPERS ────────────────────────────

  private mainMenu(name: string): string {
    return this.buildResponse([
      `👋 Hi ${name}! Welcome to *SmartEco* 🌿`,
      '',
      'What would you like to do?',
      '',
      '1️⃣ Check Pickup Status',
      '2️⃣ View EcoPoints',
      '3️⃣ Check Bin Status',
      '4️⃣ Get Support',
      '',
      '_Reply with a number or keyword._',
    ]);
  }

  private async getPickupStatus(userId: string): Promise<string> {
    const activePickup = await this.prisma.pickup.findFirst({
      where: {
        userId,
        status: {
          notIn: ['CANCELLED', 'COMPLETED'],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        collector: {
          include: {
            user: { select: { firstName: true } },
          },
        },
      },
    });

    if (!activePickup) {
      return this.buildResponse([
        '📋 *No Active Pickups*',
        '',
        "You don't have any active pickups right now.",
        'Open the SmartEco app to schedule one!',
        '',
        '_Reply "menu" for options._',
      ]);
    }

    const statusEmojis: Record<string, string> = {
      PENDING: '⏳',
      CONFIRMED: '✅',
      COLLECTOR_ASSIGNED: '👤',
      EN_ROUTE: '🚛',
      ARRIVED: '📍',
      IN_PROGRESS: '♻️',
    };

    const lines = [
      '📋 *Active Pickup*',
      '',
      `🔖 Ref: ${activePickup.reference}`,
      `♻️ Type: ${activePickup.wasteType}`,
      `📊 Status: ${statusEmojis[activePickup.status] || '📋'} ${activePickup.status.replace(/_/g, ' ')}`,
      `📅 Date: ${activePickup.scheduledDate.toISOString().split('T')[0]}`,
    ];

    if (activePickup.collector?.user?.firstName) {
      lines.push(`🚛 Collector: ${activePickup.collector.user.firstName}`);
    }

    lines.push('', '_Reply "menu" for more options._');

    return this.buildResponse(lines);
  }

  private async getEcoPoints(userId: string): Promise<string> {
    const totalPoints = await this.prisma.ecoPointTransaction.aggregate({
      where: { userId },
      _sum: { points: true },
    });

    const points = totalPoints._sum.points || 0;
    const tier =
      points >= 5000
        ? 'ECO CHAMPION 🏆'
        : points >= 1000
          ? 'ECO WARRIOR ⭐'
          : 'ECO STARTER 🌱';

    const completedPickups = await this.prisma.pickup.count({
      where: { userId, status: 'COMPLETED' },
    });

    return this.buildResponse([
      '⭐ *Your EcoPoints*',
      '',
      `🎯 Points: *${points}*`,
      `🏅 Tier: ${tier}`,
      `♻️ Completed Pickups: ${completedPickups}`,
      '',
      points < 1000
        ? `📈 ${1000 - points} more points to reach ECO WARRIOR!`
        : points < 5000
          ? `📈 ${5000 - points} more points to reach ECO CHAMPION!`
          : '🎉 You are at the highest tier!',
      '',
      '_Reply "menu" for more options._',
    ]);
  }

  private async getBinStatus(userId: string): Promise<string> {
    const bins = await this.prisma.bin.findMany({
      where: { userId },
      select: { wasteType: true, fillLevel: true },
      orderBy: { wasteType: 'asc' },
    });

    if (bins.length === 0) {
      return this.buildResponse([
        '🗑️ *No bins found*',
        'Contact support for bin setup.',
      ]);
    }

    const lines = ['🗑️ *Your Bins*', ''];

    bins.forEach((bin) => {
      const icon =
        bin.fillLevel >= 80 ? '🔴' : bin.fillLevel >= 50 ? '🟡' : '🟢';
      const bar =
        '▓'.repeat(Math.round(bin.fillLevel / 10)) +
        '░'.repeat(10 - Math.round(bin.fillLevel / 10));
      lines.push(`${icon} *${bin.wasteType}*: ${bar} ${bin.fillLevel}%`);
    });

    lines.push('', '_Reply "menu" for more options._');

    return this.buildResponse(lines);
  }

  private getSupport(): string {
    return this.buildResponse([
      '🆘 *SmartEco Support*',
      '',
      '📞 Call: +250788000000',
      '📧 Email: support@smarteco.rw',
      '🕐 Hours: Mon-Sat, 7AM - 7PM',
      '',
      'Or describe your issue here and our team will respond shortly.',
    ]);
  }

  private buildResponse(lines: string[]): string {
    return lines.join('\n');
  }
}
