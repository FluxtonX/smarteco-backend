import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const isProduction = process.env.NODE_ENV === 'production';

    const pool = new Pool({
      connectionString,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    });
    const adapter = new PrismaPg(pool);

    super({ adapter });

    this.pool = pool;

    // Create extended client using Prisma v7 $extends API
    const extendedClient = this.$extends({
      query: {
        $allModels: {
          async create({ model, args, query }) {
            try {
              const { simulationLocalStorage } = require('../modules/simulation/simulation-context');
              const simulationId = simulationLocalStorage.getStore();
              if (simulationId) {
                const modelsWithSimulationId = [
                  'User',
                  'Pickup',
                  'Bin',
                  'Payment',
                  'CollectorProfile',
                  'EcoPointTransaction',
                  'Notification',
                  'AuditLog',
                  'OtpVerification',
                  'SortingEvent',
                  'EcoPointsLedger',
                  'CommunicationLog',
                ];
                if (modelsWithSimulationId.includes(model)) {
                  args.data = args.data || {};
                  (args.data as any).simulationId = simulationId;
                }
              }
            } catch (err) {
              // Ignore context errors
            }
            return query(args);
          },
          async createMany({ model, args, query }) {
            try {
              const { simulationLocalStorage } = require('../modules/simulation/simulation-context');
              const simulationId = simulationLocalStorage.getStore();
              if (simulationId) {
                const modelsWithSimulationId = [
                  'User',
                  'Pickup',
                  'Bin',
                  'Payment',
                  'CollectorProfile',
                  'EcoPointTransaction',
                  'Notification',
                  'AuditLog',
                  'OtpVerification',
                  'SortingEvent',
                  'EcoPointsLedger',
                  'CommunicationLog',
                ];
                if (modelsWithSimulationId.includes(model)) {
                  if (Array.isArray(args.data)) {
                    args.data.forEach((item: any) => {
                      item.simulationId = simulationId;
                    });
                  } else {
                    args.data = args.data || {};
                    (args.data as any).simulationId = simulationId;
                  }
                }
              }
            } catch (err) {
              // Ignore context errors
            }
            return query(args);
          },
        },
      },
    });

    const proxy = new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in extendedClient) {
          return (extendedClient as any)[prop];
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    return proxy as any;
  }

  async onModuleInit() {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Database disconnected');
  }
}
