import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    private pool: pg.Pool;

    constructor() {
        const connectionString = process.env.DATABASE_URL;

        const pool = new pg.Pool({ connectionString });
        const adapter = new PrismaPg(pool);

        super({ adapter });

        this.pool = pool;
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
