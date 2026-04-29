import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePickupDto, CancelPickupDto, PickupQueryDto } from './dto';

import {
  PICKUP_REFERENCE_PREFIX,
  PICKUP_REFERENCE_LENGTH,
  PICKUP_MIN_ADVANCE_HOURS,
  ECOPOINTS,
  PICKUP_PRICES,
  DEFAULT_CURRENCY,
} from '../../common/constants';
import {
  PickupStatus,
  WasteType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { MomoService } from '../../integrations/momo/momo.service';
import { AirtelService } from '../../integrations/airtel/airtel.service';
import { NotificationsService } from '../notifications/notifications.service';

type CollectorWithUser = Prisma.CollectorProfileGetPayload<{
  include: {
    user: {
      select: {
        firstName: true;
        lastName: true;
        phone: true;
      };
    };
  };
}>;

type PickupWithDetails = Prisma.PickupGetPayload<object> & {
  collector?: CollectorWithUser | null;
  payment?: Record<string, unknown> | null;
  bin?: Record<string, unknown> | null;
};

@Injectable()
export class PickupsService {
  private readonly logger = new Logger(PickupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly momoService: MomoService,
    private readonly airtelService: AirtelService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── CREATE PICKUP ──────────────────────────────

  async createPickup(userId: string, dto: CreatePickupDto) {
    // Validate scheduledDate is at least 24 hours in the future
    const scheduledDate = new Date(dto.scheduledDate);
    const minDate = new Date();
    minDate.setHours(minDate.getHours() + PICKUP_MIN_ADVANCE_HOURS);

    if (scheduledDate < minDate) {
      throw new BadRequestException(
        `Scheduled date must be at least ${PICKUP_MIN_ADVANCE_HOURS} hours in the future.`,
      );
    }

    // Validate bin belongs to user (if provided)
    if (dto.binId) {
      const bin = await this.prisma.bin.findUnique({
        where: { id: dto.binId },
      });
      if (!bin) {
        throw new NotFoundException('Bin not found.');
      }
      if (bin.userId !== userId) {
        throw new ForbiddenException('This bin does not belong to you.');
      }
    }

    // Generate unique reference
    const reference = await this.generateUniqueReference();

    // Estimate points for the pickup
    const estimatedPoints = this.estimatePoints(dto.wasteType);

    // Ensure at least some collectors exist (for simulation)
    let collectors = await this.prisma.collectorProfile.findMany({
      where: { isAvailable: true, isApproved: true },
    });

    if (collectors.length === 0) {
      this.logger.log(
        'No collectors found, seeding default collectors for simulation...',
      );
      const defaultCollectors = [
        {
          phone: '+250788111222',
          firstName: 'Patrick',
          lastName: 'Mugisha',
          plate: 'RAD 123A',
          rating: 4.8,
          lat: -1.9441,
          lon: 30.0619,
        },
        {
          phone: '+250788333444',
          firstName: 'Jean',
          lastName: 'Damascene',
          plate: 'RBA 456C',
          rating: 4.6,
          lat: -1.9501,
          lon: 30.07,
        },
      ];

      for (const c of defaultCollectors) {
        const user = await this.prisma.user.upsert({
          where: { phone: c.phone },
          update: { role: 'COLLECTOR' as UserRole },
          create: {
            phone: c.phone,
            firstName: c.firstName,
            lastName: c.lastName,
            role: 'COLLECTOR' as UserRole,
            referralCode: `COLL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          },
        });

        await this.prisma.collectorProfile.upsert({
          where: { userId: user.id },
          update: { isAvailable: true, isApproved: true, latitude: c.lat, longitude: c.lon },
          create: {
            userId: user.id,
            vehiclePlate: c.plate,
            zone: 'Kigali',
            rating: c.rating,
            latitude: c.lat,
            longitude: c.lon,
            isAvailable: true,
            isApproved: true,
            approvedAt: new Date(),
          },
        });
      }

      // Fetch again after seeding
      collectors = await this.prisma.collectorProfile.findMany({
        where: { isAvailable: true, isApproved: true },
      });
    }

    // Auto-assign: pick the least busy available collector (nearest if possible)
    const assignedCollector = this.findBestCollector(
      collectors,
      dto.latitude,
      dto.longitude,
    );

    // Calculate payment amount
    const amount = PICKUP_PRICES[dto.wasteType] || 100;

    // Determine currency: Sandbox MoMo usually requires EUR, production uses RWF
    const isSandbox =
      process.env.MOMO_BASE_URL?.includes('sandbox') ||
      !process.env.MOMO_API_KEY;
    const currency = isSandbox ? 'EUR' : DEFAULT_CURRENCY;

    // Fetch user for phone number
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    // Determine payment method (default to MTN_MOMO)
    const method = dto.paymentMethod || PaymentMethod.MTN_MOMO;

    // Initiate Payment
    let paymentRef: string | null = null;
    try {
      this.logger.log(
        `Initiating ${method} payment for pickup ${reference}: ${amount} ${currency}`,
      );

      if (method === PaymentMethod.MTN_MOMO) {
        const momoResult = await this.momoService.requestToPay(
          amount,
          currency,
          user.phone,
          reference,
          `Waste Pickup: ${reference}`,
          `Payment for ${dto.wasteType} pickup`,
        );
        paymentRef = momoResult.referenceId;
      } else {
        const airtelResult = await this.airtelService.requestToPay(
          amount,
          currency,
          user.phone,
          reference,
        );
        paymentRef = airtelResult.referenceId;
      }
    } catch (error) {
      this.logger.error(
        `Failed to initiate ${method} payment for ${reference}: ${(error as Error).message}`,
      );
      throw new BadRequestException(
        `${method} payment initiation failed. Please check your phone or try again.`,
      );
    }

    // Create the pickup and linked payment record
    const pickup = await this.prisma.pickup.create({
      data: {
        reference,
        userId,
        wasteType: dto.wasteType,
        scheduledDate,
        timeSlot: dto.timeSlot,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        notes: dto.notes,
        binId: dto.binId,
        status: assignedCollector
          ? PickupStatus.COLLECTOR_ASSIGNED
          : PickupStatus.PENDING,
        collectorId: assignedCollector?.id || null,
        payment: {
          create: {
            userId,
            amount,
            currency,
            method,
            status: PaymentStatus.PENDING,
            transactionRef: reference,
            externalRef: paymentRef,
          },
        },
      },
      include: {
        collector: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        payment: true,
      },
    });

    this.logger.log(
      `Pickup created: ${reference} with payment ${paymentRef} for user ${userId}`,
    );

    if (assignedCollector) {
      await this.notificationsService.createNotification(
        assignedCollector.userId,
        'New Pickup Assigned',
        `A new ${dto.wasteType} waste pickup has been assigned to you at ${dto.address}.`,
        'IN_APP',
        { pickupId: pickup.id }
      );
    }

    return {
      success: true,
      message: 'Pickup scheduled successfully',
      data: {
        id: pickup.id,
        reference: pickup.reference,
        wasteType: pickup.wasteType,
        scheduledDate: pickup.scheduledDate,
        timeSlot: pickup.timeSlot,
        status: pickup.status,
        address: pickup.address,
        latitude: pickup.latitude,
        longitude: pickup.longitude,
        notes: pickup.notes,
        collector: pickup.collector
          ? this.formatCollector(pickup.collector)
          : null,
        payment: pickup.payment
          ? {
              id: pickup.payment.id,
              amount: pickup.payment.amount,
              currency: pickup.payment.currency,
              status: pickup.payment.status,
              transactionRef: pickup.payment.transactionRef,
            }
          : null,
        estimatedPoints,
        createdAt: pickup.createdAt,
      },
    };
  }

  // ─── GET PICKUPS (LIST) ─────────────────────────

  async getPickups(userId: string, query: PickupQueryDto) {
    const where: Prisma.PickupWhereInput = { userId };

    // Apply filters
    if (query.status) {
      where.status = query.status;
    }
    if (query.wasteType) {
      where.wasteType = query.wasteType;
    }
    if (query.from || query.to) {
      where.scheduledDate = {};
      if (query.from) {
        where.scheduledDate.gte = new Date(query.from);
      }
      if (query.to) {
        where.scheduledDate.lte = new Date(query.to);
      }
    }

    // Determine sort field (only allow safe fields)
    const allowedSortFields = [
      'createdAt',
      'scheduledDate',
      'status',
      'wasteType',
    ];
    const sortBy = allowedSortFields.includes(query.sortBy)
      ? query.sortBy
      : 'createdAt';

    const [pickups, total] = await Promise.all([
      this.prisma.pickup.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: {
          [sortBy]: query.sortOrder,
        } as Prisma.PickupOrderByWithRelationInput,
        include: {
          collector: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
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
      }),
      this.prisma.pickup.count({ where }),
    ]);

    return {
      success: true,
      data: pickups.map((p) => this.formatPickup(p)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  // ─── GET SINGLE PICKUP ──────────────────────────

  async getPickup(userId: string, pickupId: string) {
    const pickup = await this.prisma.pickup.findUnique({
      where: { id: pickupId },
      include: {
        collector: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            status: true,
            transactionRef: true,
            paidAt: true,
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
      },
    });

    if (!pickup) {
      throw new NotFoundException('Pickup not found.');
    }

    if (pickup.userId !== userId) {
      throw new ForbiddenException('You do not have access to this pickup.');
    }

    return {
      success: true,
      data: this.formatPickup(pickup),
    };
  }

  // ─── GET ACTIVE PICKUP ──────────────────────────

  async getActivePickup(userId: string) {
    const activeStatuses = [
      PickupStatus.PENDING,
      PickupStatus.CONFIRMED,
      PickupStatus.COLLECTOR_ASSIGNED,
      PickupStatus.EN_ROUTE,
      PickupStatus.ARRIVED,
      PickupStatus.IN_PROGRESS,
    ];

    let pickup = await this.prisma.pickup.findFirst({
      where: {
        userId,
        status: { in: activeStatuses },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        collector: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!pickup) {
      return {
        success: true,
        data: null,
        message: 'No active pickup found.',
      };
    }

    // AUTO-ASSIGN LOGIC: If pending and no collector, assign one now
    if (pickup.status === PickupStatus.PENDING && !pickup.collectorId) {
      this.logger.log(`Auto-assigning collector for pickup ${pickup.id}`);
      const collectors = await this.prisma.collectorProfile.findMany({
        where: { isAvailable: true, isApproved: true },
      });

      if (collectors.length > 0) {
        const randomCollector =
          collectors[Math.floor(Math.random() * collectors.length)];
        pickup = await this.prisma.pickup.update({
          where: { id: pickup.id },
          data: {
            status: PickupStatus.COLLECTOR_ASSIGNED,
            collectorId: randomCollector.id,
          },
          include: {
            collector: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    phone: true,
                  },
                },
              },
            },
          },
        });

        // Notify collector
        await this.notificationsService.createNotification(
          randomCollector.userId,
          'New Pickup Assigned',
          `A pending pickup has been automatically assigned to you.`,
          'IN_APP',
          { pickupId: pickup.id }
        );
      }
    }

    // Calculate ETA if collector is assigned and has location
    let eta: { minutes: number; distanceKm: number } | null = null;
    if (
      pickup.collector &&
      pickup.collector.latitude &&
      pickup.collector.longitude
    ) {
      const distanceKm = this.haversineDistance(
        pickup.collector.latitude,
        pickup.collector.longitude,
        pickup.latitude,
        pickup.longitude,
      );
      const avgSpeedKmh = 30; // average city speed
      const minutes = Math.round((distanceKm / avgSpeedKmh) * 60);

      eta = {
        minutes,
        distanceKm: Math.round(distanceKm * 10) / 10,
      };
    }

    const data = this.formatPickup(pickup);

    return {
      success: true,
      data: {
        ...data,
        eta,
      },
    };
  }

  // ─── GET COLLECTOR LOCATION (for user tracking) ──

  async getCollectorLocation(userId: string, pickupId: string) {
    const pickup = await this.prisma.pickup.findUnique({
      where: { id: pickupId },
      include: {
        collector: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!pickup) {
      throw new NotFoundException('Pickup not found.');
    }

    if (pickup.userId !== userId) {
      throw new ForbiddenException('You do not have access to this pickup.');
    }

    if (!pickup.collector) {
      return {
        success: true,
        data: null,
        message: 'No collector assigned yet.',
      };
    }

    // Calculate ETA
    let eta: { minutes: number; distanceKm: number } | null = null;
    if (pickup.collector.latitude && pickup.collector.longitude) {
      const distanceKm = this.haversineDistance(
        pickup.collector.latitude,
        pickup.collector.longitude,
        pickup.latitude,
        pickup.longitude,
      );
      const avgSpeedKmh = 30;
      const minutes = Math.round((distanceKm / avgSpeedKmh) * 60);
      eta = {
        minutes,
        distanceKm: Math.round(distanceKm * 10) / 10,
      };
    }

    return {
      success: true,
      data: {
        collector: {
          id: pickup.collector.id,
          name: `${pickup.collector.user.firstName || ''} ${pickup.collector.user.lastName || ''}`.trim(),
          phone: pickup.collector.user.phone,
          vehiclePlate: pickup.collector.vehiclePlate,
          rating: pickup.collector.rating,
          latitude: pickup.collector.latitude,
          longitude: pickup.collector.longitude,
        },
        pickupStatus: pickup.status,
        eta,
      },
    };
  }

  // ─── CANCEL PICKUP ──────────────────────────────

  async cancelPickup(userId: string, pickupId: string, dto: CancelPickupDto) {
    const pickup = await this.prisma.pickup.findUnique({
      where: { id: pickupId },
    });

    if (!pickup) {
      throw new NotFoundException('Pickup not found.');
    }

    if (pickup.userId !== userId) {
      throw new ForbiddenException('You do not have access to this pickup.');
    }

    // Only PENDING or CONFIRMED pickups can be cancelled
    const cancellableStatuses: PickupStatus[] = [
      PickupStatus.PENDING,
      PickupStatus.CONFIRMED,
    ];

    if (!cancellableStatuses.includes(pickup.status)) {
      throw new BadRequestException(
        `Cannot cancel a pickup with status "${pickup.status}". Only PENDING or CONFIRMED pickups can be cancelled.`,
      );
    }

    await this.prisma.pickup.update({
      where: { id: pickupId },
      data: {
        status: PickupStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: dto.reason || 'Cancelled by user',
      },
    });

    this.logger.log(
      `Pickup ${pickup.reference} cancelled by user ${userId}. Reason: ${dto.reason || 'No reason provided'}`,
    );

    return {
      success: true,
      message: 'Pickup cancelled successfully',
    };
  }

  // ─── PRIVATE HELPERS ────────────────────────────

  private async generateUniqueReference(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let reference: string;
    let exists = true;

    // Keep generating until we get a unique one
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

  private estimatePoints(wasteType: WasteType): number {
    // Returns estimated points per pickup (assuming ~1kg)
    const pointsMap: Record<string, number> = {
      ORGANIC: ECOPOINTS.ORGANIC_PER_KG,
      RECYCLABLE: ECOPOINTS.RECYCLABLE_PER_KG,
      EWASTE: ECOPOINTS.EWASTE_PER_ITEM,
      GENERAL: ECOPOINTS.GENERAL_PER_KG,
      GLASS: ECOPOINTS.GLASS_PER_KG,
      HAZARDOUS: ECOPOINTS.HAZARDOUS_PER_ITEM,
    };
    return pointsMap[wasteType] || 10;
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Find the best collector to assign:
   * 1. Prioritize nearest collector to the pickup location
   * 2. Among equally close collectors, pick the one with fewest total pickups
   */
  private findBestCollector(
    collectors: {
      id: string;
      userId: string;
      latitude: number | null;
      longitude: number | null;
      totalPickups: number;
    }[],
    pickupLat: number,
    pickupLon: number,
  ) {
    if (collectors.length === 0) return null;

    // Score each collector: lower is better (distance + pickup load)
    let bestCollector = collectors[0];
    let bestDistance = Infinity;

    for (const c of collectors) {
      if (c.latitude && c.longitude) {
        const dist = this.haversineDistance(
          c.latitude,
          c.longitude,
          pickupLat,
          pickupLon,
        );
        // If closer, or same distance but fewer pickups → prefer this one
        if (
          dist < bestDistance ||
          (dist === bestDistance && c.totalPickups < bestCollector.totalPickups)
        ) {
          bestDistance = dist;
          bestCollector = c;
        }
      } else if (bestDistance === Infinity) {
        // No location data — fallback to least busy
        if (c.totalPickups < bestCollector.totalPickups) {
          bestCollector = c;
        }
      }
    }

    return bestCollector;
  }

  private formatCollector(collector: CollectorWithUser) {
    return {
      id: collector.id,
      name: collector.user
        ? `${collector.user.firstName || ''} ${collector.user.lastName || ''}`.trim()
        : null,
      phone: collector.user?.phone || null,
      photoUrl: collector.photoUrl,
      vehiclePlate: collector.vehiclePlate,
      rating: collector.rating,
      latitude: collector.latitude,
      longitude: collector.longitude,
    };
  }

  private formatPickup(pickup: PickupWithDetails) {
    return {
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
      collector: pickup.collector
        ? this.formatCollector(pickup.collector)
        : null,
      payment: (pickup.payment as Record<string, unknown>) || null,
      bin: (pickup.bin as Record<string, unknown>) || null,
      completedAt: pickup.completedAt,
      cancelledAt: pickup.cancelledAt,
      cancelReason: pickup.cancelReason,
      createdAt: pickup.createdAt,
    };
  }
}
