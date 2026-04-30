import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  UpdatePickupStatusDto,
  UpdateLocationDto,
  RegisterMeDto,
  ToggleAvailabilityDto,
  CollectorHistoryQueryDto,
} from './dto';
import { EcoPointsService } from '../eco-points/eco-points.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PickupStatus, BinStatus, Prisma, NotificationType, UserRole } from '@prisma/client';
import { TwilioService } from '../../integrations/twilio/twilio.service';
import { RouteOptimizerService } from './route-optimizer.service';

@Injectable()
export class CollectorsService {
  private readonly logger = new Logger(CollectorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ecoPointsService: EcoPointsService,
    private readonly notificationsService: NotificationsService,
    private readonly twilioService: TwilioService,
    private readonly routeOptimizer: RouteOptimizerService,
  ) {}

  private assertApproved(profile: { isApproved: boolean }) {
    if (!profile.isApproved) {
      throw new ForbiddenException(
        'Your collector account is pending admin approval.',
      );
    }
  }

  // ─── GET MY PROFILE ────────────────────────────

  async getProfile(userId: string) {
    const collectorProfile = await this.prisma.collectorProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!collectorProfile) {
      throw new ForbiddenException('You are not registered as a collector.');
    }
    this.assertApproved(collectorProfile);

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayPickups, todayCompleted, totalWeight] = await Promise.all([
      this.prisma.pickup.count({
        where: {
          collectorId: collectorProfile.id,
          scheduledDate: { gte: today, lt: tomorrow },
          status: { notIn: [PickupStatus.CANCELLED] },
        },
      }),
      this.prisma.pickup.count({
        where: {
          collectorId: collectorProfile.id,
          status: PickupStatus.COMPLETED,
          completedAt: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.pickup.aggregate({
        where: {
          collectorId: collectorProfile.id,
          status: PickupStatus.COMPLETED,
        },
        _sum: { weightKg: true },
      }),
    ]);

    return {
      success: true,
      data: {
        id: collectorProfile.id,
        userId: collectorProfile.userId,
        name: `${collectorProfile.user.firstName || ''} ${collectorProfile.user.lastName || ''}`.trim(),
        phone: collectorProfile.user.phone,
        email: collectorProfile.user.email,
        avatarUrl: collectorProfile.user.avatarUrl,
        vehiclePlate: collectorProfile.vehiclePlate,
        zone: collectorProfile.zone,
        photoUrl: collectorProfile.photoUrl,
        rating: collectorProfile.rating,
        totalPickups: collectorProfile.totalPickups,
        isAvailable: collectorProfile.isAvailable,
        isApproved: collectorProfile.isApproved,
        approvedAt: collectorProfile.approvedAt,
        todayPickups,
        todayCompleted,
        totalWeightKg: totalWeight._sum.weightKg || 0,
        createdAt: collectorProfile.createdAt,
      },
    };
  }

  // ─── GET STATS ──────────────────────────────────

  async getStats(userId: string) {
    const collectorProfile = await this.prisma.collectorProfile.findUnique({
      where: { userId },
    });

    if (!collectorProfile) {
      throw new ForbiddenException('You are not registered as a collector.');
    }
    this.assertApproved(collectorProfile);

    const now = new Date();

    // Today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // This week (Monday to Sunday)
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);

    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const baseWhere = { collectorId: collectorProfile.id, status: PickupStatus.COMPLETED };

    const [
      todayStats,
      weekStats,
      monthStats,
      allTimeStats,
      byWasteType,
      pendingToday,
    ] = await Promise.all([
      // Today
      this.prisma.pickup.aggregate({
        where: { ...baseWhere, completedAt: { gte: todayStart, lte: todayEnd } },
        _count: true,
        _sum: { weightKg: true },
      }),
      // This week
      this.prisma.pickup.aggregate({
        where: { ...baseWhere, completedAt: { gte: weekStart } },
        _count: true,
        _sum: { weightKg: true },
      }),
      // This month
      this.prisma.pickup.aggregate({
        where: { ...baseWhere, completedAt: { gte: monthStart } },
        _count: true,
        _sum: { weightKg: true },
      }),
      // All time
      this.prisma.pickup.aggregate({
        where: baseWhere,
        _count: true,
        _sum: { weightKg: true },
      }),
      // By waste type
      this.prisma.pickup.groupBy({
        by: ['wasteType'],
        where: baseWhere,
        _count: true,
        _sum: { weightKg: true },
      }),
      // Pending pickups today
      this.prisma.pickup.count({
        where: {
          collectorId: collectorProfile.id,
          scheduledDate: { gte: todayStart, lte: todayEnd },
          status: { notIn: [PickupStatus.COMPLETED, PickupStatus.CANCELLED] },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        today: {
          completed: todayStats._count,
          weightKg: todayStats._sum.weightKg || 0,
          pending: pendingToday,
        },
        thisWeek: {
          completed: weekStats._count,
          weightKg: weekStats._sum.weightKg || 0,
        },
        thisMonth: {
          completed: monthStats._count,
          weightKg: monthStats._sum.weightKg || 0,
        },
        allTime: {
          completed: allTimeStats._count,
          weightKg: allTimeStats._sum.weightKg || 0,
        },
        byWasteType: byWasteType.map((b) => ({
          wasteType: b.wasteType,
          count: b._count,
          weightKg: b._sum.weightKg || 0,
        })),
        rating: collectorProfile.rating,
      },
    };
  }

  // ─── GET TODAY'S PICKUPS ────────────────────────

  async getTodayPickups(userId: string) {
    // Get collector profile
    const collectorProfile = await this.prisma.collectorProfile.findUnique({
      where: { userId },
    });

    if (!collectorProfile) {
      throw new ForbiddenException('You are not registered as a collector.');
    }
    this.assertApproved(collectorProfile);

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
      orderBy: [{ createdAt: 'asc' }],
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

    const orderedPoints = await this.routeOptimizer.optimize(
      collectorProfile.latitude != null && collectorProfile.longitude != null
        ? {
            latitude: collectorProfile.latitude,
            longitude: collectorProfile.longitude,
          }
        : null,
      pickups.map((p) => ({
        id: p.id,
        latitude: p.latitude,
        longitude: p.longitude,
      })),
    );
    const idToPickup = new Map(pickups.map((p) => [p.id, p]));
    const orderedPickups = orderedPoints
      .map((p) => idToPickup.get(p.id))
      .filter((p): p is (typeof pickups)[number] => !!p);

    return {
      success: true,
      data: orderedPickups.map((p, idx) => ({
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
        routeOrder: idx + 1,
      })),
    };
  }

  // ─── GET PICKUP DETAIL ──────────────────────────

  async getPickupDetail(userId: string, pickupId: string) {
    const collectorProfile = await this.prisma.collectorProfile.findUnique({
      where: { userId },
    });

    if (!collectorProfile) {
      throw new ForbiddenException('You are not registered as a collector.');
    }
    this.assertApproved(collectorProfile);

    const pickup = await this.prisma.pickup.findUnique({
      where: { id: pickupId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            avatarUrl: true,
          },
        },
        bin: {
          select: {
            id: true,
            qrCode: true,
            wasteType: true,
            fillLevel: true,
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
          },
        },
      },
    });

    if (!pickup) {
      throw new NotFoundException('Pickup not found.');
    }

    if (pickup.collectorId !== collectorProfile.id) {
      throw new ForbiddenException('This pickup is not assigned to you.');
    }

    return {
      success: true,
      data: {
        id: pickup.id,
        reference: pickup.reference,
        wasteType: pickup.wasteType,
        weightKg: pickup.weightKg,
        scheduledDate: pickup.scheduledDate,
        timeSlot: pickup.timeSlot,
        status: pickup.status,
        address: pickup.address,
        latitude: pickup.latitude,
        longitude: pickup.longitude,
        notes: pickup.notes,
        completedAt: pickup.completedAt,
        cancelledAt: pickup.cancelledAt,
        cancelReason: pickup.cancelReason,
        createdAt: pickup.createdAt,
        user: {
          name: `${pickup.user.firstName || ''} ${pickup.user.lastName || ''}`.trim() || 'Unknown',
          phone: pickup.user.phone,
          avatarUrl: pickup.user.avatarUrl,
        },
        bin: pickup.bin,
        payment: pickup.payment,
      },
    };
  }

  // ─── GET PICKUP HISTORY ─────────────────────────

  async getPickupHistory(userId: string, query: CollectorHistoryQueryDto) {
    const collectorProfile = await this.prisma.collectorProfile.findUnique({
      where: { userId },
    });

    if (!collectorProfile) {
      throw new ForbiddenException('You are not registered as a collector.');
    }
    this.assertApproved(collectorProfile);

    const where: Prisma.PickupWhereInput = {
      collectorId: collectorProfile.id,
      status: { in: [PickupStatus.COMPLETED, PickupStatus.CANCELLED] },
    };

    if (query.status) {
      where.status = query.status as PickupStatus;
    }
    if (query.wasteType) {
      where.wasteType = query.wasteType as Prisma.EnumWasteTypeFilter;
    }
    if (query.from || query.to) {
      where.scheduledDate = {};
      if (query.from) where.scheduledDate.gte = new Date(query.from);
      if (query.to) where.scheduledDate.lte = new Date(query.to);
    }

    const [pickups, total] = await Promise.all([
      this.prisma.pickup.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { completedAt: 'desc' },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.pickup.count({ where }),
    ]);

    return {
      success: true,
      data: pickups.map((p) => ({
        id: p.id,
        reference: p.reference,
        wasteType: p.wasteType,
        weightKg: p.weightKg,
        scheduledDate: p.scheduledDate,
        timeSlot: p.timeSlot,
        status: p.status,
        address: p.address,
        completedAt: p.completedAt,
        user: {
          name: `${p.user.firstName || ''} ${p.user.lastName || ''}`.trim() || 'Unknown',
          phone: p.user.phone,
        },
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
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
    this.assertApproved(collectorProfile);

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
    const updateData: Prisma.PickupUpdateInput = {
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
          /*
          const completedPickups = await this.prisma.pickup.count({
            where: {
              userId: pickup.userId,
              status: 'COMPLETED',
            },
          });
          */

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

    // Notify User
    let title = 'Pickup Update';
    let body = `Your pickup status is now ${dto.status}`;

    if (dto.status === 'EN_ROUTE') {
      title = 'Collector En Route';
      body = 'Your collector is on their way to pick up your waste.';
    } else if (dto.status === 'ARRIVED') {
      title = 'Collector Arrived';
      body = 'Your collector has arrived at your location.';
    } else if (dto.status === 'COMPLETED') {
      title = 'Pickup Completed';
      body = `Your pickup of ${dto.weightKg}kg has been completed. Check your EcoPoints!`;
    }

    // Notify User via all channels (Push, SMS, WhatsApp)
    await this.notificationsService.dispatchLifecycleNotification(
      pickup.userId,
      title,
      body,
      { pickupId, status: dto.status, reference: pickup.reference },
      ['IN_APP', 'PUSH', 'SMS', 'WHATSAPP'],
    );


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
    this.assertApproved(collectorProfile);

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

  // ─── TOGGLE AVAILABILITY ────────────────────────

  async toggleAvailability(userId: string, dto: ToggleAvailabilityDto) {
    const collectorProfile = await this.prisma.collectorProfile.findUnique({
      where: { userId },
    });

    if (!collectorProfile) {
      throw new ForbiddenException('You are not registered as a collector.');
    }
    this.assertApproved(collectorProfile);

    await this.prisma.collectorProfile.update({
      where: { id: collectorProfile.id },
      data: { isAvailable: dto.isAvailable },
    });

    return {
      success: true,
      message: `You are now ${dto.isAvailable ? 'online' : 'offline'}`,
      data: { isAvailable: dto.isAvailable },
    };
  }

  // ─── REGISTER ME ─────────────────────────────────

  async registerMe(userId: string, dto: RegisterMeDto) {
    const existing = await this.prisma.collectorProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ForbiddenException('You are already registered as a collector.');
    }

    // Mark user as COLLECTOR immediately, but keep access blocked until approved.
    const [collectorProfile] = await this.prisma.$transaction([
      this.prisma.collectorProfile.create({
        data: {
          userId,
          collectorName: dto.collectorName,
          vehiclePlate: dto.vehiclePlate,
          zone: dto.zone,
          latitude: dto.latitude,
          longitude: dto.longitude,
          photoUrl: dto.photoUrl,
          isApproved: false,
          rating: 0.0,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { role: UserRole.COLLECTOR },
        select: { id: true },
      }),
    ]);

    this.logger.log(
      `Collector registration submitted by user ${userId}. Pending admin approval.`,
    );

    return {
      success: true,
      message: 'Registration submitted. Awaiting admin approval.',
      data: collectorProfile,
    };
  }

}
