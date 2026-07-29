import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
import { SortingModule } from './modules/sorting/sorting.module';
import { UssdModule } from './integrations/ussd/ussd.module';
import { WhatsAppModule } from './integrations/whatsapp/whatsapp.module';
import { TwilioModule } from './integrations/twilio/twilio.module';
import { FirebaseModule } from './integrations/firebase/firebase.module';
import { WebSocketModule } from './websocket/websocket.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { SimulationModule } from './modules/simulation/simulation.module';
import { SimulationMiddleware } from './modules/simulation/simulation.middleware';
import { AuthzModule } from './authz/authz.module';
import { AbilityFactory, PolicyGuard } from './authz/policy';
import {
  FieldMaskInterceptor,
  AuthzAuditInterceptor,
} from './authz/interceptors';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

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
    RedisModule,

    // ─── Feature & Authorization Modules ───────────
    AuthzModule,
    AuthModule,
    UsersModule,
    PickupsModule,
    PaymentsModule,
    BinsModule,
    CollectorsModule,
    EcoPointsModule,
    NotificationsModule,
    AdminModule,
    SortingModule,
    SimulationModule,

    // ─── Integration Modules ────────────────────────
    TwilioModule,
    UssdModule,
    WhatsAppModule,
    FirebaseModule,

    // ─── WebSocket ──────────────────────────────────
    WebSocketModule,
  ],
  controllers: [HealthController],
  providers: [
    AbilityFactory,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PolicyGuard },
    { provide: APP_INTERCEPTOR, useClass: FieldMaskInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuthzAuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SimulationMiddleware).forRoutes('*');
  }
}
