import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import { validationSchema } from './config/validation.schema';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PickupsModule } from './modules/pickups/pickups.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { BinsModule } from './modules/bins/bins.module';
import { CollectorsModule } from './modules/collectors/collectors.module';
import { EcoPointsModule } from './modules/eco-points/eco-points.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { UssdModule } from './integrations/ussd/ussd.module';
import { WhatsAppModule } from './integrations/whatsapp/whatsapp.module';

@Module({
  imports: [
    // ─── Configuration ─────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, databaseConfig, redisConfig],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      envFilePath: ['.env'],
    }),

    // ─── Database ──────────────────────────────────
    DatabaseModule,

    // ─── Feature Modules ───────────────────────────
    AuthModule,
    UsersModule,
    PickupsModule,
    PaymentsModule,
    BinsModule,
    CollectorsModule,
    EcoPointsModule,
    NotificationsModule,
    AdminModule,

    // ─── Integration Modules ────────────────────────
    UssdModule,
    WhatsAppModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
