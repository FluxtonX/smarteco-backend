import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MomoModule } from '../../integrations/momo/momo.module';
import { AirtelModule } from '../../integrations/airtel/airtel.module';

@Module({
  imports: [MomoModule, AirtelModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
