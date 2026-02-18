import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PickupsModule } from './modules/pickups/pickups.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { BinsModule } from './modules/bins/bins.module';
import { CollectorsModule } from './modules/collectors/collectors.module';
import { EcoPointsModule } from './modules/eco-points/eco-points.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [AuthModule, UsersModule, PickupsModule, PaymentsModule, BinsModule, CollectorsModule, EcoPointsModule, NotificationsModule, AdminModule],
})
export class AppModule {}
