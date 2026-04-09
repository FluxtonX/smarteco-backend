import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminUserQueryDto, UpdateUserDto, CreateCollectorDto, CreateUserDto } from './dto';
import { PaginationDto } from '../../common/dto';
import { UserRole } from '@prisma/client';
import { TIER_THRESHOLDS } from '../../common/constants/app.constants';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── DASHBOARD ──────────────────────────────────

  async getDashboard() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Users stats
    const [totalUsers, newThisWeek, residentialUsers, businessUsers, activeUsers, suspendedUsers] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
        this.prisma.user.count({ where: { userType: 'RESIDENTIAL' } }),
        this.prisma.user.count({ where: { userType: 'BUSINESS' } }),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.user.count({ where: { isActive: false } }),
      ]);

    // Tier Distribution
    const allUsers = await this.prisma.user.findMany({
      select: {
        id: true,
        ecoPointTx: {
          select: { points: true }
        }
      }
    });

    const tierDistribution = {
      ECO_STARTER: 0,
      ECO_WARRIOR: 0,
      ECO_CHAMPION: 0
    };

    allUsers.forEach(u => {
      const points = u.ecoPointTx.reduce((sum, tx) => sum + tx.points, 0);
      if (points >= TIER_THRESHOLDS.ECO_CHAMPION.min) tierDistribution.ECO_CHAMPION++;
      else if (points >= TIER_THRESHOLDS.ECO_WARRIOR.min) tierDistribution.ECO_WARRIOR++;
      else tierDistribution.ECO_STARTER++;
    });

    // Pickups stats
    const [totalCompleted, todayScheduled, todayCompleted] = await Promise.all([
      this.prisma.pickup.count({ where: { status: 'COMPLETED' } }),
      this.prisma.pickup.count({
        where: {
          scheduledDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.pickup.count({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);

    // Pickups by waste type
    const pickupsByType = await this.prisma.pickup.groupBy({
      by: ['wasteType'],
      _count: { _all: true },
    });

    const byWasteType: Record<string, number> = {};
    pickupsByType.forEach((p) => {
      byWasteType[p.wasteType] = p._count._all;
    });

    // Revenue stats
    const [totalRevenue, thisMonthRevenue, todayRevenue] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          paidAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          paidAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    // Revenue by method
    const revenueByMethod = await this.prisma.payment.groupBy({
      by: ['method'],
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    });

    const byMethod: Record<string, number> = {};
    revenueByMethod.forEach((r) => {
      byMethod[r.method] = r._sum.amount || 0;
    });

    // EcoPoints stats
    const totalDistributed = await this.prisma.ecoPointTransaction.aggregate({
      _sum: { points: true },
    });

    // Collectors stats
    const [totalCollectors, avgRating] = await Promise.all([
      this.prisma.collectorProfile.count(),
      this.prisma.collectorProfile.aggregate({
        _avg: { rating: true },
      }),
    ]);

    // 7-day Pickup Trend (New Logic)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const pickupTrend = await Promise.all(last7Days.map(async (day) => {
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);

      const count = await this.prisma.pickup.count({
        where: {
          scheduledDate: { gte: day, lt: nextDay }
        }
      });

      return {
        name: day.toLocaleDateString('en-US', { weekday: 'short' }),
        pickups: count,
        waste: Math.floor(count * 2.5) // Estimated kg based on count
      };
    }));

    // Recent Activity (New Logic)
    const [recentUsers, recentPickups, recentPayments] = await Promise.all([
      this.prisma.user.findMany({ take: 5, orderBy: { createdAt: 'desc' } }),
      this.prisma.pickup.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { user: true } }),
      this.prisma.payment.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { user: true } }),
    ]);

    const recentActivity = [
      ...recentUsers.map(u => ({ id: u.id, type: 'USER_REGISTRATION', user: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.phone, time: u.createdAt })),
      ...recentPickups.map(p => ({ id: p.id, type: 'PICKUP_COMPLETED', user: `${p.user.firstName || ''} ${p.user.lastName || ''}`.trim() || p.user.phone, time: p.createdAt, detail: p.wasteType })),
      ...recentPayments.map(p => ({ id: p.id, type: 'PAYMENT_RECEIVED', user: `${p.user?.firstName || ''} ${p.user?.lastName || ''}`.trim() || p.user?.phone || 'Unknown', time: p.createdAt, detail: `${p.amount} RWF` })),
    ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5);

    // Top Active Collectors (New Logic)
    const activeCollectors = await this.prisma.collectorProfile.findMany({
      where: { isAvailable: true },
      take: 4,
      include: { user: true, pickups: { where: { status: 'COMPLETED', createdAt: { gte: todayStart } } } },
    });

    const mappedActiveCollectors = activeCollectors.map(c => ({
      id: c.userId.substring(0, 8).toUpperCase(),
      name: `${c.user.firstName || ''} ${c.user.lastName || ''}`.trim() || c.user.phone,
      status: 'Available', // By definition of the query
      pickupsToday: c.pickups.length,
      avatar: (c.user.firstName?.[0] || '') + (c.user.lastName?.[0] || ''),
    }));

    return {
      success: true,
      data: {
        users: {
          total: totalUsers,
          newThisWeek,
          residential: residentialUsers,
          business: businessUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          tierDistribution
        },
        pickups: {
          totalCompleted,
          todayScheduled,
          todayCompleted,
          byWasteType,
        },
        revenue: {
          totalRWF: totalRevenue._sum.amount || 0,
          thisMonthRWF: thisMonthRevenue._sum.amount || 0,
          todayRWF: todayRevenue._sum.amount || 0,
          byMethod,
        },
        ecoPoints: {
          totalDistributed: totalDistributed._sum.points || 0,
        },
        collectors: {
          total: totalCollectors,
          avgRating: Math.round((avgRating._avg.rating || 0) * 10) / 10,
        },
        recentActivity,
        pickupTrend,
        activeCollectors: mappedActiveCollectors,
      },
    };
  }

  // ─── LIST USERS ─────────────────────────────────

  async getUsers(query: AdminUserQueryDto) {
    const where: any = {};

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.userType) where.userType = query.userType;
    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              pickups: true,
            },
          },
          ecoPointTx: {
            select: {
              points: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const usersWithStats = users.map((u) => {
      const totalPoints = u.ecoPointTx.reduce((sum, tx) => sum + tx.points, 0);
      let tier: 'ECO_STARTER' | 'ECO_WARRIOR' | 'ECO_CHAMPION' = 'ECO_STARTER';

      if (totalPoints >= TIER_THRESHOLDS.ECO_CHAMPION.min) {
        tier = 'ECO_CHAMPION';
      } else if (totalPoints >= TIER_THRESHOLDS.ECO_WARRIOR.min) {
        tier = 'ECO_WARRIOR';
      }

      return {
        id: u.id,
        phone: u.phone,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        userType: u.userType,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        totalPickups: u._count.pickups,
        ecoPoints: totalPoints,
        ecoTier: tier,
      };
    });

    return {
      success: true,
      data: usersWithStats,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  // ─── USER DETAILS ───────────────────────────────

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            pickups: true,
            referrals: true,
            ecoPointTx: true,
          },
        },
        ecoPointTx: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Calculate total points
    const totalPointsAgg = await this.prisma.ecoPointTransaction.aggregate({
      where: { userId },
      _sum: { points: true },
    });
    const totalPoints = totalPointsAgg._sum.points || 0;

    // Calculate tier
    let tier: 'ECO_STARTER' | 'ECO_WARRIOR' | 'ECO_CHAMPION' = 'ECO_STARTER';
    if (totalPoints >= TIER_THRESHOLDS.ECO_CHAMPION.min) {
      tier = 'ECO_CHAMPION';
    } else if (totalPoints >= TIER_THRESHOLDS.ECO_WARRIOR.min) {
      tier = 'ECO_WARRIOR';
    }

    return {
      success: true,
      data: {
        ...user,
        ecoPoints: totalPoints,
        ecoTier: tier,
      },
    };
  }

  // ─── UPDATE USER ────────────────────────────────

  async updateUser(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });

    return {
      success: true,
      message: 'User updated successfully',
      data: user,
    };
  }

  // ─── CREATE USER (ADMIN) ────────────────────────

  async createUser(dto: CreateUserDto) {
    // Generate a referral code if not provided
    const referralCode = dto.referralCode || `ECO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const user = await this.prisma.user.create({
      data: {
        ...dto,
        referralCode,
        isActive: true, // Admin created users are active by default
      },
    });

    return {
      success: true,
      message: 'User created successfully',
      data: user,
    };
  }

  // ─── DELETE USER ────────────────────────────────

  async deleteUser(userId: string) {
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }

  // ─── OTHER DASHBOARD QUERIES (STUBS) ───────────

  async getPickups(query: PaginationDto) {
    const [pickups, total] = await Promise.all([
      this.prisma.pickup.findMany({
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          collector: { include: { user: true } },
          bin: true,
        },
      }),
      this.prisma.pickup.count(),
    ]);

    return {
      success: true,
      data: pickups,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
      },
    };
  }

  async getBins(query: PaginationDto) {
    const [bins, total] = await Promise.all([
      this.prisma.bin.findMany({
        skip: query.skip,
        take: query.limit,
        orderBy: { fillLevel: 'desc' },
        include: {
          user: true,
          pickups: {
            where: { status: { not: 'COMPLETED' } },
            take: 1,
            include: { collector: { include: { user: true } } },
          },
        },
      }),
      this.prisma.bin.count(),
    ]);

    return {
      success: true,
      data: bins,
      meta: {
        total,
      },
    };
  }

  async getCollectors() {
    const collectors = await this.prisma.collectorProfile.findMany({
      include: {
        user: true,
      },
    });

    return {
      success: true,
      data: collectors,
    };
  }

  async createCollector(dto: CreateCollectorDto) {
    // Find user by phone number
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      throw new Error(`User with phone ${dto.phone} not found`);
    }
    return this.prisma.collectorProfile.create({
      data: {
        userId: user.id,
        vehiclePlate: dto.vehiclePlate,
        zone: dto.zone,
        photoUrl: dto.photoUrl,
      },
    });
  }

  async getPickupAnalytics(from?: string, to?: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [total, today, completed, inProgress, scheduled, wasteDistribution] = await Promise.all([
      this.prisma.pickup.count(),
      this.prisma.pickup.count({
        where: {
          scheduledDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
      this.prisma.pickup.count({ where: { status: 'COMPLETED' } }),
      this.prisma.pickup.count({ where: { status: { in: ['IN_PROGRESS', 'ARRIVED', 'EN_ROUTE'] } } }),
      this.prisma.pickup.count({ where: { status: { in: ['PENDING', 'CONFIRMED', 'COLLECTOR_ASSIGNED'] } } }),
      this.prisma.pickup.groupBy({
        by: ['wasteType'],
        _count: { _all: true },
      }),
    ]);

    return {
      success: true,
      data: {
        total,
        today,
        completed,
        inProgress,
        scheduled,
        wasteDistribution: wasteDistribution.map((w) => ({
          type: w.wasteType,
          count: w._count._all,
        })),
      },
    };
  }

  async getBinAnalytics() {
    const [total, alerts, maintenance, active] = await Promise.all([
      this.prisma.bin.count(),
      this.prisma.bin.count({
        where: {
          OR: [{ status: 'FULL' }, { status: 'MAINTENANCE' }, { fillLevel: { gte: 80 } }],
        },
      }),
      this.prisma.bin.count({ where: { status: 'MAINTENANCE' } }),
      this.prisma.bin.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      success: true,
      data: {
        total,
        alerts,
        maintenance,
        active,
      },
    };
  }

  async getRevenueAnalytics(from?: string, to?: string) {
    // Dummy stats for now
    return {
      success: true,
      data: {
        labels: ['MTN MoMo', 'Airtel Money', 'Card'],
        values: [450000, 250000, 100000],
      },
    };
  }
}
