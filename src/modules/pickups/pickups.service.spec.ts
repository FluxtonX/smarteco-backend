jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import {
  PaymentMethod,
  PaymentStatus,
  PickupStatus,
  TimeSlot,
  WasteType,
} from '@prisma/client';
import { PickupsService } from './pickups.service';

describe('PickupsService', () => {
  const prisma = {
    bin: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    collectorProfile: {
      findMany: jest.fn(),
    },
    pickup: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const momo = {
    requestToPay: jest.fn(),
  };
  const airtel = {
    requestToPay: jest.fn(),
  };
  const notifications = {
    dispatchLifecycleNotification: jest.fn(),
    createNotification: jest.fn(),
  };
  const twilio = {};

  let service: PickupsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PickupsService(
      prisma as any,
      momo as any,
      airtel as any,
      notifications as any,
      twilio as any,
    );
  });

  it('auto-assigns the nearest approved available collector when scheduling', async () => {
    prisma.pickup.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ phone: '+250788123456' });
    prisma.collectorProfile.findMany.mockResolvedValue([
      {
        id: 'collector-far',
        userId: 'collector-user-far',
        latitude: -2.2,
        longitude: 30.4,
        totalPickups: 0,
      },
      {
        id: 'collector-near',
        userId: 'collector-user-near',
        latitude: -1.941,
        longitude: 30.062,
        totalPickups: 4,
      },
    ]);
    momo.requestToPay.mockResolvedValue({ referenceId: 'momo-ref' });
    prisma.pickup.create.mockImplementation(async (args) => ({
      id: 'pickup-1',
      reference: args.data.reference,
      wasteType: args.data.wasteType,
      scheduledDate: args.data.scheduledDate,
      timeSlot: args.data.timeSlot,
      status: args.data.status,
      address: args.data.address,
      latitude: args.data.latitude,
      longitude: args.data.longitude,
      notes: args.data.notes,
      collector: {
        id: 'collector-near',
        userId: 'collector-user-near',
        collectorName: null,
        vehiclePlate: 'RAD 123A',
        zone: 'Kigali',
        photoUrl: null,
        rating: 5,
        totalPickups: 4,
        isAvailable: true,
        isApproved: true,
        approvedAt: null,
        approvedBy: null,
        latitude: -1.941,
        longitude: 30.062,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          firstName: 'Alice',
          lastName: 'Collector',
          phone: '+250788000001',
        },
      },
      payment: {
        id: 'payment-1',
        amount: 100,
        currency: 'EUR',
        status: PaymentStatus.PENDING,
        transactionRef: args.data.reference,
      },
      createdAt: new Date(),
    }));

    const result = await service.createPickup('user-1', {
      wasteType: WasteType.ORGANIC,
      scheduledDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      timeSlot: TimeSlot.MORNING_8_10,
      address: 'KG 123 Street',
      latitude: -1.94,
      longitude: 30.061,
      paymentMethod: PaymentMethod.MTN_MOMO,
    });

    expect(prisma.pickup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          collectorId: 'collector-near',
          status: PickupStatus.COLLECTOR_ASSIGNED,
        }),
      }),
    );
    expect(notifications.createNotification).toHaveBeenCalledWith(
      'collector-user-near',
      'New Pickup Assigned',
      expect.any(String),
      'PUSH',
      expect.objectContaining({ pickupId: 'pickup-1' }),
    );
    expect(result.data.status).toBe(PickupStatus.COLLECTOR_ASSIGNED);
  });
});
