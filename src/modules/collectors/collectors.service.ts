import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdatePickupStatusDto, UpdateLocationDto } from './dto';
import { EcoPointsService } from '../eco-points/eco-points.service';
import { PickupStatus, BinStatus } from '@prisma/client';

@Injectable()
export class CollectorsService {
  private readonly logger = new Logger(CollectorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ecoPointsService: EcoPointsService,
  ) {}

  // ─── GET TODAY'S PICKUPS ────────────────────────

  async getTodayPickups(userId: string) {
    // Get collector profile
    const collectorProfile = await this.prisma.collectorProfile.findUnique({
      where: { userId },
    });

    if (!collectorProfile) {
      throw new ForbiddenException('You are not registered as a collector.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const pickups = await this.prisma.pickup.findMany({
      where: {
        collectorId: collectorProfile.id,
        scheduledDate: {
          gte: today,
          lt: tomorrow,
        },
        status: {
          notIn: [PickupStatus.CANCELLED, PickupStatus.COMPLETED],
        },
      },
      orderBy: [{ timeSlot: 'asc' }, { createdAt: 'asc' }],
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        bin: {
          select: {
            qrCode: true,
            wasteType: true,
            fillLevel: true,
          },
        },
      },
    });

    return {
      success: true,
      data: pickups.map((p) => ({
        id: p.id,
        reference: p.reference,
        wasteType: p.wasteType,
        timeSlot: p.timeSlot,
        status: p.status,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        notes: p.notes,
        user: {
          name:
            `${p.user.firstName || ''} ${p.user.lastName || ''}`.trim() ||
            'Unknown',
          phone: p.user.phone,
        },
        bin: p.bin,
      })),
    };
  }

  // ─── UPDATE PICKUP STATUS ───────────────────────

  async updatePickupStatus(
    userId: string,
    pickupId: string,
    dto: UpdatePickupStatusDto,
  ) {
    // Get collector profile
    const collectorProfile = await this.prisma.collectorProfile.findUnique({
      where: { userId },
    });

    if (!collectorProfile) {
      throw new ForbiddenException('You are not registered as a collector.');
    }

    // Get pickup
    const pickup = await this.prisma.pickup.findUnique({
      where: { id: pickupId },
    });

    if (!pickup) {
      throw new NotFoundException('Pickup not found.');
    }

    if (pickup.collectorId !== collectorProfile.id) {
      throw new ForbiddenException('This pickup is not assigned to you.');
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      COLLECTOR_ASSIGNED: ['EN_ROUTE'],
      EN_ROUTE: ['ARRIVED'],
      ARRIVED: ['IN_PROGRESS'],
      IN_PROGRESS: ['COMPLETED'],
    };

    const allowed = validTransitions[pickup.status] || [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from "${pickup.status}" to "${dto.status}". Allowed transitions: ${allowed.join(', ') || 'none'}`,
      );
    }

    // If completing, require weightKg
    if (dto.status === 'COMPLETED' && (!dto.weightKg || dto.weightKg <= 0)) {
      throw new BadRequestException(
        'Weight (weightKg) is required when completing a pickup.',
      );
    }

    // Build update data
    const updateData: any = {
      status: dto.status as PickupStatus,
    };

    if (dto.status === 'COMPLETED') {
      updateData.weightKg = dto.weightKg;
      updateData.completedAt = new Date();

      // Award EcoPoints
      const totalPoints = await this.prisma.ecoPointTransaction.aggregate({
        where: { userId: pickup.userId },
        _sum: { points: true },
      });
      const userTotalPoints = totalPoints._sum.points || 0;

      const points = this.ecoPointsService.calculatePickupPoints(
        pickup.wasteType,
        dto.weightKg!,
        userTotalPoints,
      );

      const tier =
        userTotalPoints >= 5000
          ? 'ECO_CHAMPION'
          : userTotalPoints >= 1000
            ? 'ECO_WARRIOR'
            : 'ECO_STARTER';
      const multiplier =
        tier === 'ECO_CHAMPION' ? 1.5 : tier === 'ECO_WARRIOR' ? 1.25 : 1.0;

      await this.ecoPointsService.awardPoints(
        pickup.userId,
        points,
        `${pickup.wasteType}_PICKUP`,
        `${pickup.wasteType} waste pickup - ${dto.weightKg}kg (${multiplier}x bonus)`,
        pickup.id,
      );

      // Reset bin fill level if associated
      if (pickup.binId) {
        await this.prisma.bin.update({
          where: { id: pickup.binId },
          data: {
            fillLevel: 0,
            status: BinStatus.ACTIVE,
            lastEmptied: new Date(),
          },
        });
      }

      // Increment collector's total pickups
      await this.prisma.collectorProfile.update({
        where: { id: collectorProfile.id },
        data: { totalPickups: { increment: 1 } },
      });

      // Check for referral bonus (first completed pickup by a referred user)
      if (pickup.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: pickup.userId },
          select: { referredBy: true },
        });

        if (user?.referredBy) {
          // Check if this is the user's first completed pickup
          const completedPickups = await this.prisma.pickup.count({
            where: {
              userId: pickup.userId,
              status: 'COMPLETED',
            },
          });

          // completedPickups will be 0 because we haven't saved yet
          // But the current pickup counts, so check if there were any before
          const previousCompleted = await this.prisma.pickup.count({
            where: {
              userId: pickup.userId,
              status: 'COMPLETED',
              id: { not: pickup.id },
            },
          });

          if (previousCompleted === 0) {
            // Award referral bonus to the referrer
            await this.ecoPointsService.awardPoints(
              user.referredBy,
              200,
              'REFERRAL',
              `Referral bonus - referred user completed first pickup`,
            );

            this.logger.log(
              `Awarded referral bonus to ${user.referredBy} for user ${pickup.userId}'s first pickup`,
            );
          }
        }
      }

      this.logger.log(
        `Pickup ${pickup.reference} completed. Weight: ${dto.weightKg}kg, Points: ${points}`,
      );
    }

    await this.prisma.pickup.update({
      where: { id: pickupId },
      data: updateData,
    });

    return {
      success: true,
      message: `Pickup status updated to ${dto.status}`,
      data: { status: dto.status },
    };
  }

  // ─── UPDATE LOCATION ────────────────────────────

  async updateLocation(userId: string, dto: UpdateLocationDto) {
    const collectorProfile = await this.prisma.collectorProfile.findUnique({
      where: { userId },
    });

    if (!collectorProfile) {
      throw new ForbiddenException('You are not registered as a collector.');
    }

    await this.prisma.collectorProfile.update({
      where: { id: collectorProfile.id },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });

    return {
      success: true,
      message: 'Location updated successfully',
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    };
  }
}
