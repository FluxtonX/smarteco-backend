import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { BinStatus, WasteType } from '@prisma/client';
import { BinsService } from './bins.service';

describe('BinsService IoT sync', () => {
  const prisma = {
    bin: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pickup: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    iotDevice: {
      upsert: jest.fn(),
    },
    iotTelemetry: {
      create: jest.fn(),
    },
  };
  const notifications = {
    createNotification: jest.fn(),
  };
  const config = {
    get: jest.fn(),
  };

  let service: BinsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BinsService(
      prisma as any,
      notifications as any,
      config as unknown as ConfigService,
    );
    config.get.mockReturnValue('device-secret');
  });

  it('rejects sync requests with the wrong device key', async () => {
    await expect(
      service.syncFromDevice({
        qrCode: 'BIN-ABC-1234',
        apiKey: 'wrong',
        fillLevel: 70,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('updates bin telemetry and auto-schedules once at the full threshold', async () => {
    prisma.bin.findUnique.mockResolvedValue({
      id: 'bin-1',
      userId: 'user-1',
      qrCode: 'BIN-ABC-1234',
      wasteType: WasteType.ORGANIC,
      fillLevel: 40,
      status: BinStatus.ACTIVE,
      latitude: -1.9,
      longitude: 30.1,
    });
    prisma.bin.update.mockResolvedValue({});
    prisma.iotDevice.upsert.mockResolvedValue({ id: 'device-1' });
    prisma.iotTelemetry.create.mockResolvedValue({});
    prisma.pickup.findFirst.mockResolvedValueOnce(null);
    prisma.pickup.findUnique.mockResolvedValueOnce(null);
    prisma.pickup.create.mockResolvedValue({
      id: 'pickup-1',
      reference: 'ECO-ABCDE',
    });

    const result = await service.syncFromDevice({
      qrCode: 'BIN-ABC-1234',
      apiKey: 'device-secret',
      deviceId: 'ESP32-BIN-1',
      fillLevel: 96,
      batteryLevel: 88,
      latitude: -1.95,
      longitude: 30.06,
    });

    expect(prisma.bin.update).toHaveBeenCalledWith({
      where: { id: 'bin-1' },
      data: expect.objectContaining({
        fillLevel: 96,
        status: BinStatus.FULL,
        latitude: -1.95,
        longitude: 30.06,
      }),
    });
    expect(prisma.pickup.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        binId: 'bin-1',
        status: 'PENDING',
      }),
    });
    expect(result.data.autoScheduled).toBe(true);
  });
});
