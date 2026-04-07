import {
    Controller,
    Get,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { EcoPointsService } from './eco-points.service';
import { EcoPointsQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../../common/decorators';

@ApiTags('EcoPoints')
@Controller('eco-points')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class EcoPointsController {
    constructor(private readonly ecoPointsService: EcoPointsService) {}

    @Get('balance')
    @ApiOperation({
        summary: 'Get EcoPoints balance and tier info',
        description:
            'Returns current points balance, tier, multiplier, progress towards next tier, and pickup statistics.',
    })
    @ApiResponse({
        status: 200,
        description: 'Balance retrieved successfully',
        schema: {
            example: {
                success: true,
                data: {
                    totalPoints: 2450,
                    tier: 'ECO_WARRIOR',
                    multiplier: 1.25,
                    nextTier: 'ECO_CHAMPION',
                    pointsToNextTier: 2550,
                    progressPercent: 36.25,
                    totalPickups: 15,
                    totalWeightKg: 120.5,
                },
            },
        },
    })
    async getBalance(@CurrentUser('id') userId: string) {
        return this.ecoPointsService.getBalance(userId);
    }

    @Get('history')
    @ApiOperation({
        summary: 'Get EcoPoints transaction history',
        description:
            'Returns paginated history of all points earned, with optional filter by action type.',
    })
    @ApiResponse({
        status: 200,
        description: 'History retrieved successfully',
        schema: {
            example: {
                success: true,
                data: [
                    {
                        id: 'uuid',
                        points: 37,
                        action: 'ORGANIC_PICKUP',
                        description: 'Organic waste pickup - 2.0kg (1.25x bonus)',
                        createdAt: '2026-04-13T10:30:00Z',
                    },
                ],
                meta: { page: 1, limit: 20, total: 35, totalPages: 2 },
            },
        },
    })
    async getHistory(
        @CurrentUser('id') userId: string,
        @Query() query: EcoPointsQueryDto,
    ) {
        return this.ecoPointsService.getHistory(userId, query);
    }

    @Get('leaderboard')
    @ApiOperation({
        summary: 'Get EcoPoints leaderboard',
        description: 'Returns the top 20 users ranked by total EcoPoints.',
    })
    @ApiResponse({
        status: 200,
        description: 'Leaderboard retrieved',
        schema: {
            example: {
                success: true,
                data: [
                    {
                        rank: 1,
                        userId: 'uuid',
                        name: 'Jean Baptiste',
                        points: 12500,
                        tier: 'ECO_CHAMPION',
                        avatarUrl: null,
                    },
                ],
            },
        },
    })
    async getLeaderboard() {
        return this.ecoPointsService.getLeaderboard();
    }
}
