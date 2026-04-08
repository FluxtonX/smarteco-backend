import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateProfileDto, UpdateFcmTokenDto } from './dto';
import { TIER_THRESHOLDS } from '../../common/constants';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── GET PROFILE ─────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        userType: true,
        role: true,
        referralCode: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get EcoPoints stats
    const totalPoints = await this.getTotalPoints(userId);
    const tier = this.calculateTier(totalPoints);
    const tierInfo = TIER_THRESHOLDS[tier];

    // Get pickup count
    const totalPickups = await this.prisma.pickup.count({
      where: { userId, status: 'COMPLETED' },
    });

    return {
      success: true,
      data: {
        ...user,
        ecoPoints: totalPoints,
        ecoTier: tier,
        tierMultiplier: tierInfo.multiplier,
        totalPickups,
        memberSince: user.createdAt,
      },
    };
  }

  // ─── UPDATE PROFILE ──────────────────────────────

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Check email uniqueness if being updated
    if (dto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('Email already in use by another user');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.userType !== undefined && { userType: dto.userType }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        userType: true,
        role: true,
        referralCode: true,
        avatarUrl: true,
      },
    });

    return {
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    };
  }

  // ─── GET REFERRAL INFO ───────────────────────────

  async getReferralInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get referred users
    const referredUsers = await this.prisma.user.findMany({
      where: { referredBy: userId },
      select: {
        firstName: true,
        lastName: true,
        createdAt: true,
        pickups: {
          where: { status: 'COMPLETED' },
          take: 1,
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate points earned from referrals
    const referralPoints = await this.prisma.ecoPointTransaction.aggregate({
      where: {
        userId,
        action: 'REFERRAL',
      },
      _sum: { points: true },
    });

    return {
      success: true,
      data: {
        referralCode: user.referralCode,
        referralLink: `https://smarteco.rw/ref/${user.referralCode}`,
        totalReferred: referredUsers.length,
        pointsEarned: referralPoints._sum.points || 0,
        referredUsers: referredUsers.map((u) => ({
          firstName: u.firstName,
          lastName: u.lastName,
          joinedAt: u.createdAt,
          firstPickupCompleted: u.pickups.length > 0,
        })),
      },
    };
  }

  // ─── UPDATE FCM TOKEN ────────────────────────────

  async updateFcmToken(userId: string, dto: UpdateFcmTokenDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: dto.fcmToken },
    });

    return {
      success: true,
      message: 'FCM token updated successfully',
    };
  }

  // ─── PRIVATE HELPERS ─────────────────────────────

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
