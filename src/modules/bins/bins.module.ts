import { Module } from '@nestjs/common';
import { BinsController } from './bins.controller';
import { BinsService } from './bins.service';
import { IotMqttService } from './iot-mqtt.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BinsController],
  providers: [BinsService, IotMqttService],
  exports: [BinsService],
})
export class BinsModule {}
