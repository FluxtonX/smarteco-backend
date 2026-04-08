import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MomoService } from '../../integrations/momo/momo.service';
import { AirtelService } from '../../integrations/airtel/airtel.service';
import { InitiatePaymentDto, PaymentMethodEnum } from './dto';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { PaginationDto } from '../../common/dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly momoService: MomoService,
    private readonly airtelService: AirtelService,
  ) {}

  // ─── INITIATE PAYMENT ───────────────────────────

  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
    // Validate pickup exists and belongs to user
    const pickup = await this.prisma.pickup.findUnique({
      where: { id: dto.pickupId },
    });

    if (!pickup) {
      throw new NotFoundException('Pickup not found.');
    }

    if (pickup.userId !== userId) {
      throw new ForbiddenException('This pickup does not belong to you.');
    }

    // Check if payment already exists for this pickup
    const existingPayment = await this.prisma.payment.findUnique({
      where: { pickupId: dto.pickupId },
    });

    if (existingPayment && existingPayment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        'Payment for this pickup has already been completed.',
      );
    }

    // Map DTO enum to Prisma enum
    const method =
      dto.method === PaymentMethodEnum.MOMO
        ? PaymentMethod.MTN_MOMO
        : PaymentMethod.AIRTEL_MONEY;

    const transactionRef = `PAY-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        pickupId: dto.pickupId,
        userId,
        amount: dto.amount,
        currency: 'RWF',
        method,
        status: PaymentStatus.PENDING,
        transactionRef,
      },
    });

    // Initiate mobile money request
    let externalRef: string;

    try {
      if (dto.method === PaymentMethodEnum.MOMO) {
        const result = await this.momoService.requestToPay(
          dto.amount,
          'RWF',
          dto.phone,
          transactionRef,
          `SmartEco Pickup ${pickup.reference}`,
          `Payment for waste pickup ${pickup.reference}`,
        );
        externalRef = result.referenceId;
      } else {
        const result = await this.airtelService.requestToPay(
          dto.amount,
          'RWF',
          dto.phone,
          transactionRef,
        );
        externalRef = result.referenceId;
      }

      // Update payment with provider reference
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { externalRef },
      });

      this.logger.log(
        `Payment initiated: ${transactionRef} via ${dto.method} for pickup ${pickup.reference}`,
      );

      return {
        success: true,
        message: `Payment request sent to your ${dto.method === PaymentMethodEnum.MOMO ? 'MTN MoMo' : 'Airtel Money'} phone. Please approve the prompt on your device.`,
        data: {
          paymentId: payment.id,
          transactionRef,
          externalRef,
          amount: dto.amount,
          currency: 'RWF',
          method: dto.method,
          status: 'PENDING',
        },
      };
    } catch (error: any) {
      // Mark payment as failed
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });

      this.logger.error(`Payment initiation failed: ${error.message}`);
      throw new BadRequestException(
        'Payment request failed. Please try again.',
      );
    }
  }

  // ─── CHECK PAYMENT STATUS ───────────────────────

  async checkPaymentStatus(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        pickup: {
          select: { reference: true, wasteType: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }

    if (payment.userId !== userId) {
      throw new ForbiddenException('This payment does not belong to you.');
    }

    // If still pending, check with provider
    if (payment.status === PaymentStatus.PENDING && payment.externalRef) {
      try {
        let providerStatus: string;

        if (payment.method === PaymentMethod.MTN_MOMO) {
          const result = await this.momoService.checkPaymentStatus(
            payment.externalRef,
          );
          providerStatus = result.status;
        } else {
          const result = await this.airtelService.checkPaymentStatus(
            payment.externalRef,
          );
          providerStatus =
            result.status === 'SUCCESS' ? 'SUCCESSFUL' : result.status;
        }

        // Update status based on provider response
        if (providerStatus === 'SUCCESSFUL' || providerStatus === 'SUCCESS') {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.COMPLETED,
              paidAt: new Date(),
            },
          });
          payment.status = PaymentStatus.COMPLETED;
        } else if (providerStatus === 'FAILED') {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.FAILED },
          });
          payment.status = PaymentStatus.FAILED;
        }
      } catch (error: any) {
        this.logger.error(`Status check failed: ${error.message}`);
        // Don't throw — just return current status
      }
    }

    return {
      success: true,
      data: {
        id: payment.id,
        transactionRef: payment.transactionRef,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        paidAt: payment.paidAt,
        pickup: payment.pickup,
      },
    };
  }

  // ─── GET PAYMENT HISTORY ────────────────────────

  async getPaymentHistory(userId: string, query: PaginationDto) {
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { userId },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          pickup: {
            select: {
              reference: true,
              wasteType: true,
              scheduledDate: true,
            },
          },
        },
      }),
      this.prisma.payment.count({ where: { userId } }),
    ]);

    return {
      success: true,
      data: payments.map((p) => ({
        id: p.id,
        transactionRef: p.transactionRef,
        amount: p.amount,
        currency: p.currency,
        method: p.method,
        status: p.status,
        paidAt: p.paidAt,
        pickup: p.pickup,
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

  // ─── WEBHOOK CALLBACK (MoMo/Airtel) ─────────────

  async handleWebhook(provider: string, body: any) {
    this.logger.log(
      `Payment webhook received from ${provider}: ${JSON.stringify(body)}`,
    );

    let transactionRef: string | undefined;
    let status: string;

    if (provider === 'momo') {
      // MTN MoMo callback
      transactionRef = body.externalId;
      status = body.status; // SUCCESSFUL or FAILED
    } else if (provider === 'airtel') {
      // Airtel callback
      transactionRef = body.transaction?.id;
      status = body.transaction?.status_code === 'TS' ? 'SUCCESSFUL' : 'FAILED';
    } else {
      this.logger.warn(`Unknown payment provider: ${provider}`);
      return { received: true };
    }

    if (!transactionRef) {
      this.logger.warn('Webhook received without transaction reference');
      return { received: true };
    }

    // Find and update payment
    const payment = await this.prisma.payment.findFirst({
      where: { transactionRef },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for ref: ${transactionRef}`);
      return { received: true };
    }

    if (payment.status !== PaymentStatus.PENDING) {
      this.logger.log(
        `Payment ${transactionRef} already processed: ${payment.status}`,
      );
      return { received: true };
    }

    const newStatus =
      status === 'SUCCESSFUL' || status === 'SUCCESS'
        ? PaymentStatus.COMPLETED
        : PaymentStatus.FAILED;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        paidAt: newStatus === PaymentStatus.COMPLETED ? new Date() : null,
      },
    });

    this.logger.log(
      `Payment ${transactionRef} updated to ${newStatus} via webhook`,
    );

    return { received: true, status: newStatus };
  }
}
