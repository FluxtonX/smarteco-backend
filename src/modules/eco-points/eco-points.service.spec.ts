import { BadRequestException } from '@nestjs/common';
import { EcoPointsService } from './eco-points.service';

describe('EcoPointsService', () => {
  const prisma = {
    ecoPointTransaction: {
      aggregate: jest.fn(),
      create: jest.fn(),
    },
    redemption: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
    pickup: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  let service: EcoPointsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EcoPointsService(prisma as any);
  });

  it('exposes the server-side reward catalog', () => {
    const result = service.getRewardCatalog();

    expect(result.success).toBe(true);
    expect(result.data.map((reward) => reward.id)).toContain(
      'AIRTIME_1000_RWF',
    );
  });

  it('rejects unknown reward IDs', async () => {
    await expect(
      service.redeemPoints('user-1', {
        rewardId: 'UNKNOWN',
        points: 500,
        description: 'Unknown',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects client-side point tampering', async () => {
    await expect(
      service.redeemPoints('user-1', {
        rewardId: 'AIRTIME_1000_RWF',
        points: 1,
        description: 'Tampered',
      }),
    ).rejects.toThrow('requires 500 EcoPoints');
  });

  it('creates a negative transaction for a valid redemption', async () => {
    prisma.ecoPointTransaction.aggregate.mockResolvedValue({
      _sum: { points: 700 },
    });
    prisma.ecoPointTransaction.create.mockResolvedValue({
      id: 'tx-1',
      userId: 'user-1',
      points: -500,
      action: 'REDEEM_AIRTIME_1000_RWF',
    });
    prisma.redemption.create.mockResolvedValue({
      id: 'redemption-1',
      rewardId: 'AIRTIME_1000_RWF',
      status: 'COMPLETED',
    });
    prisma.$transaction.mockImplementation(async (operations) =>
      Promise.all(operations),
    );

    const result = await service.redeemPoints('user-1', {
      rewardId: 'AIRTIME_1000_RWF',
      points: 500,
      description: 'Airtime',
    });

    expect(result.success).toBe(true);
    expect(prisma.ecoPointTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        points: -500,
        action: 'REDEEM_AIRTIME_1000_RWF',
      }),
    });
    expect(result.data.reward.id).toBe('AIRTIME_1000_RWF');
  });
});
