import {
    Injectable,
    NotFoundException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminUserQueryDto, UpdateUserDto, CreateCollectorDto } from './dto';
import { PaginationDto } from '../../common/dto';
import { UserRole } from '@prisma/client';

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
        const [totalUsers, newThisWeek, residentialUsers, businessUsers] =
            await Promise.all([
                this.prisma.user.count(),
                this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
                this.prisma.user.count({ where: { userType: 'RESIDENTIAL' } }),
                this.prisma.user.count({ where: { userType: 'BUSINESS' } }),
            ]);

        // Pickups stats
        const [
            totalCompleted,
            todayScheduled,
            todayCompleted,
        ] = await Promise.all([
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
            where: { status: 'COMPLETED' },
            _count: true,
        });

        const byWasteType: Record<string, number> = {};
        pickupsByType.forEach((p) => {
            byWasteType[p.wasteType] = p._count;
        });

        // Revenue stats
        const [totalRevenue, thisMonthRevenue, todayRevenue] =
            await Promise.all([
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

        return {
            success: true,
            data: {
                users: {
                    total: totalUsers,
                    newThisWeek,
                    residential: residentialUsers,
                    business: businessUsers,
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
                select: {
                    id: true,
                    phone: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    userType: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                    _count: {
                        select: {
                            pickups: true,
                        },
                    },
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            success: true,
            data: users.map((u) => ({
                ...u,
                totalPickups: u._count.pickups,
                _count: undefined,
            })),
            meta: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.ceil(total / query.limit),
            },
        };
    }

    // ─── UPDATE USER ────────────────────────────────

    async updateUser(userId: string, dto: UpdateUserDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found.');
        }

        const updateData: any = {};
        if (dto.role !== undefined) updateData.role = dto.role;
        if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
            },
        });

        this.logger.log(
            `Admin updated user ${userId}: ${JSON.stringify(dto)}`,
        );

        return {
            success: true,
            message: 'User updated successfully',
            data: updated,
        };
    }

    // ─── LIST PICKUPS (Admin) ───────────────────────

    async getPickups(query: PaginationDto) {
        const [pickups, total] = await Promise.all([
            this.prisma.pickup.findMany({
                skip: query.skip,
                take: query.limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            phone: true,
                        },
                    },
                    collector: {
                        include: {
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.pickup.count(),
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
                user: {
                    id: p.user.id,
                    name: `${p.user.firstName || ''} ${p.user.lastName || ''}`.trim(),
                    phone: p.user.phone,
                },
                collector: p.collector
                    ? {
                          id: p.collector.id,
                          name: p.collector.user
                              ? `${p.collector.user.firstName || ''} ${p.collector.user.lastName || ''}`.trim()
                              : null,
                      }
                    : null,
                createdAt: p.createdAt,
            })),
            meta: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.ceil(total / query.limit),
            },
        };
    }

    // ─── LIST COLLECTORS ────────────────────────────

    async getCollectors() {
        const collectors = await this.prisma.collectorProfile.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        isActive: true,
                    },
                },
            },
            orderBy: { totalPickups: 'desc' },
        });

        return {
            success: true,
            data: collectors.map((c) => ({
                id: c.id,
                userId: c.userId,
                name: `${c.user.firstName || ''} ${c.user.lastName || ''}`.trim(),
                phone: c.user.phone,
                vehiclePlate: c.vehiclePlate,
                zone: c.zone,
                rating: c.rating,
                totalPickups: c.totalPickups,
                isAvailable: c.isAvailable,
                isActive: c.user.isActive,
            })),
        };
    }

    // ─── CREATE COLLECTOR ───────────────────────────

    async createCollector(dto: CreateCollectorDto) {
        // Find user by phone
        const user = await this.prisma.user.findUnique({
            where: { phone: dto.phone },
        });

        if (!user) {
            throw new NotFoundException(
                'User not found. The user must be registered first.',
            );
        }

        // Check if already a collector
        const existing = await this.prisma.collectorProfile.findUnique({
            where: { userId: user.id },
        });

        if (existing) {
            throw new ConflictException(
                'This user is already registered as a collector.',
            );
        }

        // Update user role to COLLECTOR
        await this.prisma.user.update({
            where: { id: user.id },
            data: { role: UserRole.COLLECTOR },
        });

        // Create collector profile
        const collectorProfile = await this.prisma.collectorProfile.create({
            data: {
                userId: user.id,
                vehiclePlate: dto.vehiclePlate,
                zone: dto.zone,
                photoUrl: dto.photoUrl,
            },
        });

        this.logger.log(
            `Collector created: ${user.phone} in zone ${dto.zone}`,
        );

        return {
            success: true,
            message: 'Collector registered successfully',
            data: {
                id: collectorProfile.id,
                userId: user.id,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                phone: user.phone,
                vehiclePlate: dto.vehiclePlate,
                zone: dto.zone,
            },
        };
    }

    // ─── PICKUP ANALYTICS ───────────────────────────

    async getPickupAnalytics(from?: string, to?: string) {
        const where: any = { status: 'COMPLETED' };

        if (from || to) {
            where.completedAt = {};
            if (from) where.completedAt.gte = new Date(from);
            if (to) where.completedAt.lte = new Date(to);
        }

        const [byWasteType, byTimeSlot, totalWeight] = await Promise.all([
            this.prisma.pickup.groupBy({
                by: ['wasteType'],
                where,
                _count: true,
                _sum: { weightKg: true },
            }),
            this.prisma.pickup.groupBy({
                by: ['timeSlot'],
                where,
                _count: true,
            }),
            this.prisma.pickup.aggregate({
                where,
                _sum: { weightKg: true },
                _count: true,
            }),
        ]);

        return {
            success: true,
            data: {
                totalPickups: totalWeight._count,
                totalWeightKg: totalWeight._sum.weightKg || 0,
                byWasteType: byWasteType.map((b) => ({
                    wasteType: b.wasteType,
                    count: b._count,
                    totalWeightKg: b._sum.weightKg || 0,
                })),
                byTimeSlot: byTimeSlot.map((b) => ({
                    timeSlot: b.timeSlot,
                    count: b._count,
                })),
            },
        };
    }

    // ─── REVENUE ANALYTICS ──────────────────────────

    async getRevenueAnalytics(from?: string, to?: string) {
        const where: any = { status: 'COMPLETED' };

        if (from || to) {
            where.paidAt = {};
            if (from) where.paidAt.gte = new Date(from);
            if (to) where.paidAt.lte = new Date(to);
        }

        const [byMethod, totalRevenue] = await Promise.all([
            this.prisma.payment.groupBy({
                by: ['method'],
                where,
                _sum: { amount: true },
                _count: true,
            }),
            this.prisma.payment.aggregate({
                where,
                _sum: { amount: true },
                _count: true,
            }),
        ]);

        return {
            success: true,
            data: {
                totalTransactions: totalRevenue._count,
                totalRevenueRWF: totalRevenue._sum.amount || 0,
                byMethod: byMethod.map((b) => ({
                    method: b.method,
                    count: b._count,
                    totalRWF: b._sum.amount || 0,
                })),
            },
        };
    }
}
