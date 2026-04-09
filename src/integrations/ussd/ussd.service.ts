import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { PickupStatus } from '@prisma/client';

// USSD session state
interface UssdSession {
  step: string;
  data: Record<string, any>;
}

@Injectable()
export class UssdService {
  private readonly logger = new Logger(UssdService.name);
  private sessions = new Map<string, UssdSession>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.log('USSD service initialized');
  }

  // ─── PROCESS USSD REQUEST ───────────────────────
  // Africa's Talking USSD callback handler
  // Returns: string starting with "CON " (continue) or "END " (terminate)

  async processRequest(
    sessionId: string,
    phone: string,
    text: string,
  ): Promise<string> {
    // Parse input — Africa's Talking sends cumulative text separated by *
    const inputs = text ? text.split('*') : [];
    const currentInput = inputs[inputs.length - 1] || '';
    const level = inputs.length;

    this.logger.log(
      `USSD [${sessionId}] Phone: ${phone}, Level: ${level}, Input: "${text}"`,
    );

    try {
      // First level — show main menu
      if (text === '') {
        return this.mainMenu();
      }

      const firstChoice = inputs[0];

      switch (firstChoice) {
        case '1':
          return this.handleSchedulePickup(phone, inputs, level);
        case '2':
          return this.handleCheckStatus(phone, inputs, level);
        case '3':
          return this.handleEcoPoints(phone);
        case '4':
          return this.handleBinStatus(phone);
        case '5':
          return this.handleContactSupport();
        default:
          return 'END Invalid option. Please try again.';
      }
    } catch (error: any) {
      this.logger.error(`USSD Error [${sessionId}]: ${error.message}`);
      return 'END An error occurred. Please try again later.';
    }
  }

  // ─── MENU SCREENS ───────────────────────────────

  private mainMenu(): string {
    return [
      'CON Welcome to SmartEco 🌿',
      '1. Schedule a Pickup',
      '2. Check Pickup Status',
      '3. View EcoPoints',
      '4. Check Bin Status',
      '5. Contact Support',
    ].join('\n');
  }

  // ─── 1. SCHEDULE PICKUP ─────────────────────────

  private async handleSchedulePickup(
    phone: string,
    inputs: string[],
    level: number,
  ): Promise<string> {
    // Level 1: first choice was "1", ask waste type
    if (level === 1) {
      return [
        'CON Select waste type:',
        '1. Organic',
        '2. Recyclable',
        '3. E-Waste',
        '4. General',
        '5. Hazardous',
      ].join('\n');
    }

    // Level 2: waste type selected, ask time slot
    if (level === 2) {
      return [
        'CON Select time slot:',
        '1. Morning (8-10 AM)',
        '2. Late Morning (10-12 PM)',
        '3. Afternoon (2-4 PM)',
        '4. Late Afternoon (4-6 PM)',
      ].join('\n');
    }

    // Level 3: time slot selected — confirm and create
    if (level === 3) {
      const wasteTypes = [
        'ORGANIC',
        'RECYCLABLE',
        'EWASTE',
        'GENERAL',
        'HAZARDOUS',
      ];
      const timeSlots = [
        'MORNING_8_10',
        'MORNING_10_12',
        'AFTERNOON_2_4',
        'AFTERNOON_4_6',
      ];
      const wasteLabels = [
        'Organic',
        'Recyclable',
        'E-Waste',
        'General',
        'Hazardous',
      ];
      const timeLabels = ['8-10 AM', '10-12 PM', '2-4 PM', '4-6 PM'];

      const wasteIdx = parseInt(inputs[1]) - 1;
      const timeIdx = parseInt(inputs[2]) - 1;

      if (
        wasteIdx < 0 ||
        wasteIdx >= wasteTypes.length ||
        timeIdx < 0 ||
        timeIdx >= timeSlots.length
      ) {
        return 'END Invalid selection. Please try again.';
      }

      // Find user
      const user = await this.prisma.user.findUnique({ where: { phone } });
      if (!user) {
        return 'END You are not registered. Please download the SmartEco app to register first.';
      }

      // Generate reference
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 5; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      const reference = `ECO-${code}`;

      // Schedule for tomorrow
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1);
      scheduledDate.setHours(0, 0, 0, 0);

      // Get last known address
      const lastPickup = await this.prisma.pickup.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: { address: true, latitude: true, longitude: true },
      });

      await this.prisma.pickup.create({
        data: {
          reference,
          userId: user.id,
          wasteType: wasteTypes[wasteIdx] as any,
          scheduledDate,
          timeSlot: timeSlots[timeIdx] as any,
          status: PickupStatus.PENDING,
          address: lastPickup?.address || 'Via USSD',
          latitude: lastPickup?.latitude || 0,
          longitude: lastPickup?.longitude || 0,
          notes: 'Scheduled via USSD',
        },
      });

      return `END Pickup scheduled!\nRef: ${reference}\nType: ${wasteLabels[wasteIdx]}\nTime: Tomorrow ${timeLabels[timeIdx]}\n\nOpen SmartEco app for details.`;
    }

    return 'END Invalid input. Please try again.';
  }

  // ─── 2. CHECK PICKUP STATUS ─────────────────────

  private async handleCheckStatus(
    phone: string,
    inputs: string[],
    level: number,
  ): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return 'END You are not registered. Download the SmartEco app to register.';
    }

    // Show active pickup
    const activePickup = await this.prisma.pickup.findFirst({
      where: {
        userId: user.id,
        status: {
          in: [
            PickupStatus.PENDING,
            PickupStatus.CONFIRMED,
            PickupStatus.COLLECTOR_ASSIGNED,
            PickupStatus.EN_ROUTE,
            PickupStatus.ARRIVED,
            PickupStatus.IN_PROGRESS,
          ],
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
      return 'END No active pickups found.\n\nDial again to schedule one.';
    }

    const statusLabels: Record<string, string> = {
      PENDING: '⏳ Pending',
      CONFIRMED: '✅ Confirmed',
      COLLECTOR_ASSIGNED: '👤 Collector Assigned',
      EN_ROUTE: '🚛 Collector En Route',
      ARRIVED: '📍 Collector Arrived',
      IN_PROGRESS: '♻️ In Progress',
    };

    let msg = `END Pickup ${activePickup.reference}\nType: ${activePickup.wasteType}\nStatus: ${statusLabels[activePickup.status] || activePickup.status}`;

    if (activePickup.collector?.user?.firstName) {
      msg += `\nCollector: ${activePickup.collector.user.firstName}`;
    }

    return msg;
  }

  // ─── 3. VIEW ECOPOINTS ──────────────────────────

  private async handleEcoPoints(phone: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return 'END You are not registered. Download the SmartEco app to register.';
    }

    const totalPoints = await this.prisma.ecoPointTransaction.aggregate({
      where: { userId: user.id },
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
      where: { userId: user.id, status: 'COMPLETED' },
    });

    return `END Your EcoPoints: ${points}\nTier: ${tier}\nCompleted Pickups: ${completedPickups}\n\nKeep collecting to level up! 🌿`;
  }

  // ─── 4. BIN STATUS ──────────────────────────────

  private async handleBinStatus(phone: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return 'END You are not registered. Download the SmartEco app to register.';
    }

    const bins = await this.prisma.bin.findMany({
      where: { userId: user.id },
      select: { wasteType: true, fillLevel: true, status: true },
      orderBy: { wasteType: 'asc' },
    });

    if (bins.length === 0) {
      return 'END No bins found.\n\nContact support for setup.';
    }

    const fillBar = (level: number): string => {
      if (level >= 80) return '🔴';
      if (level >= 50) return '🟡';
      return '🟢';
    };

    let msg = 'END Your Bins:\n';
    bins.forEach((bin) => {
      msg += `${fillBar(bin.fillLevel)} ${bin.wasteType}: ${bin.fillLevel}%\n`;
    });

    return msg;
  }

  // ─── 5. CONTACT SUPPORT ─────────────────────────

  private handleContactSupport(): string {
    return [
      'END SmartEco Support:',
      '📞 Call: +250788000000',
      '📧 Email: support@smarteco.rw',
      '💬 WhatsApp: +250788000000',
      '',
      'Hours: Mon-Sat 7AM-7PM',
    ].join('\n');
  }
}
