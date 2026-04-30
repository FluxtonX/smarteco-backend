import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReportBinDto, UpdateFillLevelDto, ScanBinDto } from './dto';
import {
  BIN_ALERT_THRESHOLD,
  BIN_AUTO_SCHEDULE_THRESHOLD,
  PICKUP_REFERENCE_PREFIX,
  PICKUP_REFERENCE_LENGTH,
} from '../../common/constants';
import { PickupStatus, BinStatus, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BinsService {
  private readonly logger = new Logger(BinsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── GET ALL BINS ───────────────────────────────

  async getUserBins(userId: string) {
    const bins = await this.prisma.bin.findMany({
      where: { userId },
      orderBy: { wasteType: 'asc' },
      select: {
        id: true,
        qrCode: true,
        wasteType: true,
        fillLevel: true,
        status: true,
        lastEmptied: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: bins,
    };
  }

  // ─── GET SINGLE BIN ─────────────────────────────

  async getBin(userId: string, binId: string) {
    const bin = await this.prisma.bin.findUnique({
      where: { id: binId },
      include: {
        pickups: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            reference: true,
            status: true,
            scheduledDate: true,
            completedAt: true,
          },
        },
      },
    });

    if (!bin) {
      throw new NotFoundException('Bin not found.');
    }

    if (bin.userId !== userId) {
      throw new ForbiddenException('This bin does not belong to you.');
    }

    return {
      success: true,
      data: {
        id: bin.id,
        qrCode: bin.qrCode,
        wasteType: bin.wasteType,
        fillLevel: bin.fillLevel,
        status: bin.status,
        latitude: bin.latitude,
        longitude: bin.longitude,
        lastEmptied: bin.lastEmptied,
        createdAt: bin.createdAt,
        recentPickups: bin.pickups,
      },
    };
  }

  // ─── REPORT BIN ─────────────────────────────────

  async reportBin(userId: string, binId: string, dto: ReportBinDto) {
    const bin = await this.prisma.bin.findUnique({
      where: { id: binId },
    });

    if (!bin) {
      throw new NotFoundException('Bin not found.');
    }

    if (bin.userId !== userId) {
      throw new ForbiddenException('This bin does not belong to you.');
    }

    // Update bin status
    await this.prisma.bin.update({
      where: { id: binId },
      data: {
        status: dto.issue === 'FULL' ? BinStatus.FULL : BinStatus.MAINTENANCE,
        fillLevel: dto.issue === 'FULL' ? 100 : bin.fillLevel,
      },
    });

    // Auto-schedule pickup if bin is reported as full
    let pickupData: { pickupId: string; reference: string } | null = null;
    if (dto.issue === 'FULL') {
      const reference = await this.generateUniqueReference();

      // Get user's default address info from most recent pickup or use bin location
      const recentPickup = await this.prisma.pickup.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { address: true, latitude: true, longitude: true },
      });

      const pickup = await this.prisma.pickup.create({
        data: {
          reference,
          userId,
          wasteType: bin.wasteType,
          scheduledDate: this.getNextAvailableDate(),
          timeSlot: 'MORNING_8_10',
          status: PickupStatus.PENDING,
          address: recentPickup?.address || 'Address not set',
          latitude: recentPickup?.latitude || bin.latitude || 0,
          longitude: recentPickup?.longitude || bin.longitude || 0,
          notes: `Auto-scheduled: Bin ${bin.qrCode} reported as full. ${dto.notes || ''}`,
          binId: bin.id,
        },
      });

      pickupData = {
        pickupId: pickup.id,
        reference: pickup.reference,
      };

      this.logger.log(
        `Auto-scheduled pickup ${reference} for full bin ${bin.qrCode}`,
      );

      await this.notificationsService.createNotification(
        userId,
        'Bin Full - Pickup Scheduled',
        `Your ${bin.wasteType} bin (${bin.qrCode}) is full. Pickup ${reference} has been scheduled automatically.`,
        NotificationType.PUSH,
        { binId: bin.id, qrCode: bin.qrCode, pickupReference: reference },
      );
    }

    return {
      success: true,
      message: pickupData
        ? 'Bin reported. A pickup will be scheduled shortly.'
        : 'Bin reported. Maintenance has been requested.',
      data: pickupData,
    };
  }

  // ─── UPDATE FILL LEVEL (IoT) ────────────────────

  async updateFillLevel(
    userId: string,
    binId: string,
    dto: UpdateFillLevelDto,
  ) {
    const bin = await this.prisma.bin.findUnique({
      where: { id: binId },
    });

    if (!bin) {
      throw new NotFoundException('Bin not found.');
    }

    if (bin.userId !== userId) {
      throw new ForbiddenException('This bin does not belong to you.');
    }

    // Determine new status
    let newStatus = bin.status;
    if (dto.fillLevel >= BIN_AUTO_SCHEDULE_THRESHOLD) {
      newStatus = BinStatus.FULL;
    } else if (dto.fillLevel < BIN_ALERT_THRESHOLD) {
      newStatus = BinStatus.ACTIVE;
    }

    // Update bin
    await this.prisma.bin.update({
      where: { id: binId },
      data: {
        fillLevel: dto.fillLevel,
        status: newStatus,
      },
    });

    let alertTriggered = false;
    let autoScheduled = false;

    // Trigger alert at threshold
    const crossedAlertThreshold =
      bin.fillLevel < BIN_ALERT_THRESHOLD &&
      dto.fillLevel >= BIN_ALERT_THRESHOLD &&
      dto.fillLevel < BIN_AUTO_SCHEDULE_THRESHOLD;
    if (crossedAlertThreshold) {
      alertTriggered = true;
      this.logger.log(`Alert: Bin ${bin.qrCode} is ${dto.fillLevel}% full`);

      await this.notificationsService.createNotification(
        bin.userId,
        'Bin Nearly Full',
        `Your ${bin.wasteType} bin (${bin.qrCode}) is now ${dto.fillLevel}% full.`,
        NotificationType.PUSH,
        { binId: bin.id, qrCode: bin.qrCode, fillLevel: dto.fillLevel },
      );
    }

    // Auto-schedule pickup at high threshold
    const crossedAutoThreshold =
      bin.fillLevel < BIN_AUTO_SCHEDULE_THRESHOLD &&
      dto.fillLevel >= BIN_AUTO_SCHEDULE_THRESHOLD;
    if (crossedAutoThreshold) {
      alertTriggered = true;
      autoScheduled = true;

      // Check if there's already a pending pickup for this bin
      const existingPickup = await this.prisma.pickup.findFirst({
        where: {
          binId: bin.id,
          status: {
            in: [
              PickupStatus.PENDING,
              PickupStatus.CONFIRMED,
              PickupStatus.COLLECTOR_ASSIGNED,
            ],
          },
        },
      });

      if (!existingPickup) {
        const reference = await this.generateUniqueReference();
        const recentPickup = await this.prisma.pickup.findFirst({
          where: { userId: bin.userId },
          orderBy: { createdAt: 'desc' },
          select: { address: true, latitude: true, longitude: true },
        });

        await this.prisma.pickup.create({
          data: {
            reference,
            userId: bin.userId,
            wasteType: bin.wasteType,
            scheduledDate: this.getNextAvailableDate(),
            timeSlot: 'MORNING_8_10',
            status: PickupStatus.PENDING,
            address: recentPickup?.address || 'Address not set',
            latitude: recentPickup?.latitude || bin.latitude || 0,
            longitude: recentPickup?.longitude || bin.longitude || 0,
            notes: `Auto-scheduled: Bin ${bin.qrCode} fill level at ${dto.fillLevel}%`,
            binId: bin.id,
          },
        });

        this.logger.log(
          `Auto-scheduled pickup for bin ${bin.qrCode} at ${dto.fillLevel}% fill`,
        );

        await this.notificationsService.createNotification(
          bin.userId,
          'Auto Pickup Scheduled',
          `Your ${bin.wasteType} bin (${bin.qrCode}) reached ${dto.fillLevel}%. Pickup ${reference} was scheduled automatically.`,
          NotificationType.PUSH,
          { binId: bin.id, qrCode: bin.qrCode, fillLevel: dto.fillLevel, pickupReference: reference },
        );
      }
    }

    return {
      success: true,
      data: {
        fillLevel: dto.fillLevel,
        alertTriggered,
        autoScheduled,
      },
    };
  }

  // ─── SCAN BIN (QR CODE) ─────────────────────────

  async scanBin(dto: ScanBinDto) {
    const bin = await this.prisma.bin.findUnique({
      where: { qrCode: dto.qrCode },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    if (!bin) {
      throw new NotFoundException('Bin not found. Invalid QR code.');
    }

    return {
      success: true,
      data: {
        id: bin.id,
        qrCode: bin.qrCode,
        wasteType: bin.wasteType,
        fillLevel: bin.fillLevel,
        status: bin.status,
        owner: {
          id: bin.user.id,
          name:
            `${bin.user.firstName || ''} ${bin.user.lastName || ''}`.trim() ||
            'Unknown',
          phone: bin.user.phone,
        },
      },
    };
  }

  // ─── PRIVATE HELPERS ────────────────────────────

  private async generateUniqueReference(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let reference: string;
    let exists = true;

    while (exists) {
      let code = '';
      for (let i = 0; i < PICKUP_REFERENCE_LENGTH; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      reference = `${PICKUP_REFERENCE_PREFIX}${code}`;
      const existing = await this.prisma.pickup.findUnique({
        where: { reference },
      });
      exists = !!existing;
    }

    return reference!;
  }

  private getNextAvailableDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 1); // Tomorrow
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
