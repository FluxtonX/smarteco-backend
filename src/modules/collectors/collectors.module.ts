import { Module } from '@nestjs/common';
import { CollectorsController } from './collectors.controller';
import { CollectorsService } from './collectors.service';
import { EcoPointsModule } from '../eco-points/eco-points.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EcoPointsModule, NotificationsModule],
  controllers: [CollectorsController],
  providers: [CollectorsService],
  exports: [CollectorsService],
})
export class CollectorsModule {}
