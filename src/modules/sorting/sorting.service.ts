import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TrackingGateway } from '../../websocket/tracking.gateway';
import {
  SingleClassifyEventDto,
  KioskHeartbeatDto,
  SortingEventQueryDto,
} from './dto';
import { AI_SORTING_POINTS, TIER_THRESHOLDS } from '../../common/constants';
import { EcoTier, SortingCategory, Prisma } from '@prisma/client';

@Injectable()
export class SortingService {
  private readonly logger = new Logger(SortingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingGateway: TrackingGateway,
  ) {}

  // ─── CLASSIFY TELEMETRY INGESTION ────────────────

  async processClassificationBatch(
    kioskId: string,
    events: SingleClassifyEventDto[],
  ) {
    this.logger.log(
      `Processing batch of ${events.length} sorting events from kiosk: ${kioskId}`,
    );

    let processedCount = 0;
    let totalPointsAwarded = 0;
    const results: any[] = [];

    // Process events sequentially to maintain running balance integrity
    for (const event of events) {
      // 1. Check idempotency key to prevent double-award
      const existingEvent = await this.prisma.sortingEvent.findUnique({
        where: { idempotencyKey: event.idempotencyKey },
      });

      if (existingEvent) {
        this.logger.warn(
          `Duplicate sorting event detected. Idempotency key already processed: ${event.idempotencyKey}`,
        );
        results.push({
          idempotencyKey: event.idempotencyKey,
          status: 'skipped_duplicate',
          pointsAwarded: 0,
        });
        continue;
      }

      // 2. Determine points to award
      const pointsToAward = AI_SORTING_POINTS[event.category] || 5;

      // 3. Process event inside database transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create the sorting event record
        const sortingEvent = await tx.sortingEvent.create({
          data: {
            kioskId,
            category: event.category,
            confidence: event.confidence,
            capturedAt: new Date(event.capturedAt),
            idempotencyKey: event.idempotencyKey,
            userId: event.userId || null,
            binId: event.binId || null,
          },
        });

        let pointsLedgerRecord: any = null;
        let finalBalance = 0;
        let finalTier: EcoTier = EcoTier.ECO_STARTER;

        // If a user is linked, calculate running balance and award points
        if (event.userId) {
          // Get current total points
          const pointsAggregate = await tx.ecoPointTransaction.aggregate({
            where: { userId: event.userId },
            _sum: { points: true },
          });

          const currentPoints = pointsAggregate._sum.points || 0;
          finalBalance = currentPoints + pointsToAward;

          // Determine tier based on new running balance
          if (finalBalance >= 2000) {
            finalTier = EcoTier.ECO_CHAMPION;
          } else if (finalBalance >= 500) {
            finalTier = EcoTier.ECO_WARRIOR;
          }

          // Create ledger entry
          pointsLedgerRecord = await tx.ecoPointsLedger.create({
            data: {
              userId: event.userId,
              sortingEventId: sortingEvent.id,
              pointsAwarded: pointsToAward,
              runningBalance: finalBalance,
              tier: finalTier,
            },
          });

          // Create dynamic transaction record for global system compatibility
          await tx.ecoPointTransaction.create({
            data: {
              userId: event.userId,
              points: pointsToAward,
              action: 'AI_SORTING',
              description: `AI Sorting Kiosk: Classified ${event.category.toLowerCase()}`,
            },
          });
        }

        return { sortingEvent, pointsLedgerRecord, finalBalance, finalTier };
      });

      processedCount++;
      totalPointsAwarded += pointsToAward;

      results.push({
        idempotencyKey: event.idempotencyKey,
        status: 'processed',
        pointsAwarded: event.userId ? pointsToAward : 0,
      });

      // 4. Real-time broadcast if user was linked
      if (event.userId) {
        this.broadcastLiveSortingUpdate(event.userId, {
          eventId: result.sortingEvent.id,
          category: event.category,
          confidence: event.confidence,
          pointsAwarded: pointsToAward,
          runningBalance: result.finalBalance,
          tier: result.finalTier,
          capturedAt: event.capturedAt,
        });
      }
    }

    return {
      success: true,
      data: {
        processedCount,
        totalPointsAwarded,
        details: results,
      },
    };
  }

  // ─── GET SORTING HISTORY ─────────────────────────

  async getEvents(query: SortingEventQueryDto) {
    const where: Prisma.SortingEventWhereInput = {};

    if (query.kioskId) {
      where.kioskId = query.kioskId;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.startDate || query.endDate) {
      where.capturedAt = {};
      if (query.startDate) {
        where.capturedAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.capturedAt.lte = new Date(query.endDate);
      }
    }

    const [events, total] = await Promise.all([
      this.prisma.sortingEvent.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { capturedAt: 'desc' },
        include: {
          kiosk: {
            select: {
              name: true,
              location: true,
            },
          },
        },
      }),
      this.prisma.sortingEvent.count({ where }),
    ]);

    return {
      success: true,
      data: events,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  // ─── KIOSK HEARTBEAT & MONITORING ────────────────

  async recordHeartbeat(kioskId: string, heartbeat: KioskHeartbeatDto) {
    const kiosk = await this.prisma.kiosk.findUnique({
      where: { kioskId },
    });

    if (!kiosk) {
      throw new NotFoundException(`Kiosk with ID ${kioskId} not found`);
    }

    // Update lastSeenAt
    const updatedKiosk = await this.prisma.kiosk.update({
      where: { kioskId },
      data: {
        lastSeenAt: new Date(),
        status: heartbeat.status || kiosk.status,
      },
    });

    // Log diagnostic metrics for telemetry monitoring
    this.logger.log(
      `Heartbeat logged for Kiosk: ${kioskId} | Status: ${heartbeat.status || 'ACTIVE'} | CPU: ${heartbeat.cpuLoad ?? 'N/A'}% | Disk: ${heartbeat.diskUsagePercentage ?? 'N/A'}% | App Version: ${heartbeat.appVersion ?? 'N/A'}`,
    );

    return {
      success: true,
      timestamp: updatedKiosk.lastSeenAt,
      kioskStatus: updatedKiosk.status,
    };
  }

  // ─── GET USER ECOPOINTS LEDGER ───────────────────

  async getLedger(userId: string) {
    // Confirm user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Retrieve ledger entries
    const ledgerEntries = await this.prisma.ecoPointsLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        sortingEvent: {
          select: {
            category: true,
            confidence: true,
            kioskId: true,
            capturedAt: true,
          },
        },
      },
    });

    // Get dynamic current points and calculations
    const pointsAggregate = await this.prisma.ecoPointTransaction.aggregate({
      where: { userId },
      _sum: { points: true },
    });

    const totalPoints = pointsAggregate._sum.points || 0;
    const tier = this.calculateTier(totalPoints);
    const tierInfo = TIER_THRESHOLDS[tier];

    // Determine requirements for next tier progression
    let nextTier: string | null = null;
    let pointsToNextTier = 0;
    let progressPercent = 100;

    if (tier === 'ECO_STARTER') {
      nextTier = 'ECO_WARRIOR';
      pointsToNextTier = TIER_THRESHOLDS.ECO_WARRIOR.min - totalPoints;
      progressPercent = (totalPoints / TIER_THRESHOLDS.ECO_WARRIOR.min) * 100;
    } else if (tier === 'ECO_WARRIOR') {
      nextTier = 'ECO_CHAMPION';
      pointsToNextTier = TIER_THRESHOLDS.ECO_CHAMPION.min - totalPoints;
      const range =
        TIER_THRESHOLDS.ECO_CHAMPION.min - TIER_THRESHOLDS.ECO_WARRIOR.min;
      const progress = totalPoints - TIER_THRESHOLDS.ECO_WARRIOR.min;
      progressPercent = (progress / range) * 100;
    }

    return {
      success: true,
      data: {
        userId,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
        currentPoints: totalPoints,
        tier,
        multiplier: tierInfo.multiplier,
        nextTier,
        pointsToNextTier: Math.max(0, pointsToNextTier),
        progressPercent: Math.round(Math.min(100, progressPercent) * 100) / 100,
        ledger: ledgerEntries,
      },
    };
  }

  // ─── PRIVATE HELPERS ────────────────────────────

  private calculateTier(points: number): EcoTier {
    if (points >= 2000) return EcoTier.ECO_CHAMPION;
    if (points >= 500) return EcoTier.ECO_WARRIOR;
    return EcoTier.ECO_STARTER;
  }

  private broadcastLiveSortingUpdate(userId: string, data: any) {
    try {
      // Access the userSockets mapping in the gateway
      // Since userSockets is private, we can obtain socket ID via reflective server access or broadcast to user-specific room
      const userSockets = (this.trackingGateway as any).userSockets;
      if (userSockets) {
        const socketId = userSockets.get(userId);
        if (socketId) {
          this.trackingGateway.server.to(socketId).emit('sorting:completed', {
            success: true,
            data,
          });
          this.logger.log(`Broadcasted live sorting event to user socket: ${socketId}`);
        }
      }
    } catch (err) {
      this.logger.error(`WebSocket broadcast failed: ${(err as Error).message}`);
    }
  }
}
