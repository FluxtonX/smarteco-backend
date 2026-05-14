import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EcoPointsQueryDto, RedeemDto } from './dto';
import {
  TIER_THRESHOLDS,
  ECOPOINTS,
  ECOPOINT_REWARD_CATALOG,
} from '../../common/constants';
import { RedemptionStatus, WasteType, Prisma } from '@prisma/client';

@Injectable()
export class EcoPointsService {
  private readonly logger = new Logger(EcoPointsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── GET BALANCE ────────────────────────────────

  async getBalance(userId: string) {
    // Get total points
    const totalPoints = await this.getTotalPoints(userId);

    // Calculate tier
    const tier = this.calculateTier(totalPoints);
    const tierInfo = TIER_THRESHOLDS[tier];

    // Next tier info
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

    // Get pickup stats
    const totalPickups = await this.prisma.pickup.count({
      where: { userId, status: 'COMPLETED' },
    });

    const totalWeight = await this.prisma.pickup.aggregate({
      where: { userId, status: 'COMPLETED' },
      _sum: { weightKg: true },
    });

    return {
      success: true,
      data: {
        totalPoints,
        tier,
        multiplier: tierInfo.multiplier,
        nextTier,
        pointsToNextTier: Math.max(0, pointsToNextTier),
        progressPercent: Math.round(Math.min(100, progressPercent) * 100) / 100,
        totalPickups,
        totalWeightKg: totalWeight._sum.weightKg || 0,
      },
    };
  }

  // ─── GET HISTORY ────────────────────────────────

  async getHistory(userId: string, query: EcoPointsQueryDto) {
    const where: Prisma.EcoPointTransactionWhereInput = { userId };

    if (query.action) {
      where.action = query.action;
    }

    const [transactions, total] = await Promise.all([
      this.prisma.ecoPointTransaction.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          points: true,
          action: true,
          description: true,
          pickupId: true,
          createdAt: true,
        },
      }),
      this.prisma.ecoPointTransaction.count({ where }),
    ]);

    return {
      success: true,
      data: transactions,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  // ─── LEADERBOARD ────────────────────────────────

  async getLeaderboard() {
    // Aggregate points per user and get top 20
    const pointsGrouped = await this.prisma.ecoPointTransaction.groupBy({
      by: ['userId'],
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: 20,
    });

    // Get user details for the leaderboard
    const userIds = pointsGrouped.map((p) => p.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const leaderboard = pointsGrouped.map((entry, index) => {
      const user = userMap.get(entry.userId);
      const points = entry._sum.points || 0;
      return {
        rank: index + 1,
        userId: entry.userId,
        name: user
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
            'Anonymous'
          : 'Anonymous',
        points,
        tier: this.calculateTier(points),
        avatarUrl: user?.avatarUrl || null,
      };
    });

    return {
      success: true,
      data: leaderboard,
    };
  }

  // ─── REDEEM POINTS ──────────────────────────────

  getRewardCatalog() {
    return {
      success: true,
      data: ECOPOINT_REWARD_CATALOG,
    };
  }

  async redeemPoints(userId: string, redeemDto: RedeemDto) {
    const reward = ECOPOINT_REWARD_CATALOG.find(
      (item) => item.id === redeemDto.rewardId,
    );

    if (!reward) {
      throw new BadRequestException('Unknown EcoPoints reward');
    }

    if (reward.points !== redeemDto.points) {
      throw new BadRequestException(
        `Reward ${reward.id} requires ${reward.points} EcoPoints`,
      );
    }

    const totalPoints = await this.getTotalPoints(userId);

    if (totalPoints < redeemDto.points) {
      throw new BadRequestException('Insufficient EcoPoints for this reward');
    }

    const [transaction, redemption] = await this.prisma.$transaction([
      this.prisma.ecoPointTransaction.create({
        data: {
          userId,
          points: -reward.points,
          action: `REDEEM_${reward.id}`,
          description: `Redeemed: ${reward.label}`,
        },
      }),
      this.prisma.redemption.create({
        data: {
          userId,
          rewardId: reward.id,
          rewardLabel: reward.label,
          points: reward.points,
          status:
            reward.type === 'AIRTEL_DISBURSEMENT'
              ? RedemptionStatus.PENDING
              : RedemptionStatus.COMPLETED,
          completedAt:
            reward.type === 'AIRTEL_DISBURSEMENT' ? null : new Date(),
          metadata: reward as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    this.logger.log(
      `User ${userId} redeemed ${reward.points} points for ${reward.id}`,
    );

    return {
      success: true,
      message: 'Reward redeemed successfully',
      data: {
        ...transaction,
        reward,
        redemption,
      },
    };
  }

  // ─── AWARD POINTS (internal, used by other modules) ─

  async awardPoints(
    userId: string,
    points: number,
    action: string,
    description: string,
    pickupId?: string,
  ) {
    const transaction = await this.prisma.ecoPointTransaction.create({
      data: {
        userId,
        points,
        action,
        description,
        pickupId,
      },
    });

    this.logger.log(
      `Awarded ${points} EcoPoints to user ${userId} for ${action}`,
    );

    return transaction;
  }

  // Calculate points for a completed pickup
  calculatePickupPoints(
    wasteType: WasteType,
    weightKg: number,
    userTotalPoints: number,
  ): number {
    const tier = this.calculateTier(userTotalPoints);
    const multiplier = TIER_THRESHOLDS[tier].multiplier;

    const basePointsMap: Record<string, number> = {
      ORGANIC: ECOPOINTS.ORGANIC_PER_KG,
      RECYCLABLE: ECOPOINTS.RECYCLABLE_PER_KG,
      EWASTE: ECOPOINTS.EWASTE_PER_ITEM,
      GENERAL: ECOPOINTS.GENERAL_PER_KG,
      GLASS: ECOPOINTS.GLASS_PER_KG,
      HAZARDOUS: ECOPOINTS.HAZARDOUS_PER_ITEM,
    };

    const baseRate = basePointsMap[wasteType] || 10;
    const rawPoints = Math.round(baseRate * weightKg * multiplier);

    return Math.max(1, rawPoints); // At least 1 point
  }

  // ─── PRIVATE HELPERS ────────────────────────────

  private async getTotalPoints(userId: string): Promise<number> {
    const result = await this.prisma.ecoPointTransaction.aggregate({
      where: { userId },
      _sum: { points: true },
    });
    return result._sum.points || 0;
  }

  private calculateTier(points: number): keyof typeof TIER_THRESHOLDS {
    if (points >= 5000) return 'ECO_CHAMPION';
    if (points >= 1000) return 'ECO_WARRIOR';
    return 'ECO_STARTER';
  }
}
