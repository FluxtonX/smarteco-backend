import { Module } from '@nestjs/common';
import { PickupsController } from './pickups.controller';
import { PickupsService } from './pickups.service';
import { MomoModule } from '../../integrations/momo/momo.module';
import { AirtelModule } from '../../integrations/airtel/airtel.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [MomoModule, AirtelModule, NotificationsModule],
  controllers: [PickupsController],
  providers: [PickupsService],
  exports: [PickupsService],
})
export class PickupsModule {}
