import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FirebaseModule } from '../../integrations/firebase/firebase.module';
import { WhatsAppModule } from '../../integrations/whatsapp/whatsapp.module';
import { TwilioModule } from '../../integrations/twilio/twilio.module';

@Module({
  imports: [FirebaseModule, WhatsAppModule, TwilioModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
