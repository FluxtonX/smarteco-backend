jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const prisma = {
    payment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    paymentWebhookLog: {
      create: jest.fn(),
    },
  };
  const momoService = {};
  const airtelService = {};

  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentsService(
      prisma as any,
      momoService as any,
      airtelService as any,
    );
  });

  it('matches Airtel callbacks by provider transaction id stored as externalRef', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-1',
      status: PaymentStatus.PENDING,
      transactionRef: 'PAY-LOCAL',
      externalRef: 'AIRTX-123',
      method: PaymentMethod.AIRTEL_MONEY,
    });

    const result = await service.handleWebhook('airtel', {
      transaction: {
        id: 'AIRTX-123',
        status_code: 'TS',
        message: 'success',
      },
    });

    expect(prisma.payment.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ transactionRef: 'AIRTX-123' }, { externalRef: 'AIRTX-123' }],
      },
    });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: expect.objectContaining({
        status: PaymentStatus.COMPLETED,
        failedAt: null,
        failReason: null,
      }),
    });
    expect(result).toEqual({ received: true, status: PaymentStatus.COMPLETED });
  });
});
