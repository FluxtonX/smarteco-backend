import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto';
import { PaginationDto } from '../../common/dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Initiate a payment',
        description:
            'Start a mobile money payment for a pickup via MTN MoMo or Airtel Money. A prompt will be sent to the payer\'s phone.',
    })
    @ApiResponse({
        status: 201,
        description: 'Payment request initiated',
        schema: {
            example: {
                success: true,
                message: 'Payment request sent to your MTN MoMo phone...',
                data: {
                    paymentId: 'uuid',
                    transactionRef: 'PAY-A3F8K2B1',
                    providerRef: 'uuid',
                    amount: 500,
                    currency: 'RWF',
                    method: 'MOMO',
                    status: 'PENDING',
                },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Validation or payment error' })
    @ApiResponse({ status: 404, description: 'Pickup not found' })
    async initiatePayment(
        @CurrentUser('id') userId: string,
        @Body() dto: InitiatePaymentDto,
    ) {
        return this.paymentsService.initiatePayment(userId, dto);
    }

    @Get(':id/status')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({
        summary: 'Check payment status',
        description:
            'Check the current status of a payment. If still pending, the system will poll the payment provider for an update.',
    })
    @ApiParam({ name: 'id', description: 'Payment UUID' })
    @ApiResponse({ status: 200, description: 'Payment status retrieved' })
    @ApiResponse({ status: 404, description: 'Payment not found' })
    async checkPaymentStatus(
        @CurrentUser('id') userId: string,
        @Param('id', ParseUUIDPipe) paymentId: string,
    ) {
        return this.paymentsService.checkPaymentStatus(userId, paymentId);
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({
        summary: 'Get payment history',
        description: 'Get paginated list of all payments made by the user.',
    })
    @ApiResponse({ status: 200, description: 'Payment history retrieved' })
    async getPaymentHistory(
        @CurrentUser('id') userId: string,
        @Query() query: PaginationDto,
    ) {
        return this.paymentsService.getPaymentHistory(userId, query);
    }

    // ─── WEBHOOKS (No Auth — callbacks from payment providers) ──

    @Post('webhook/momo')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'MTN MoMo webhook callback',
        description: 'Receives payment status updates from MTN MoMo. No authentication required.',
    })
    async momoWebhook(@Body() body: any) {
        return this.paymentsService.handleWebhook('momo', body);
    }

    @Post('webhook/airtel')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Airtel Money webhook callback',
        description: 'Receives payment status updates from Airtel Money. No authentication required.',
    })
    async airtelWebhook(@Body() body: any) {
        return this.paymentsService.handleWebhook('airtel', body);
    }
}
