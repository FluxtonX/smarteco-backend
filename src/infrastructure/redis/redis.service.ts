import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const port = parseInt(
      this.configService.get<string>('REDIS_PORT') || '6379',
      10,
    );

    this.client = new Redis({
      host,
      port,
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis error: ${err.message}`);
    });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      if (!this.client.status || this.client.status === 'end') {
        await this.client.connect();
      }
      const val = await this.client.get(key);
      return val ? (JSON.parse(val) as T) : null;
    } catch (e) {
      this.logger.warn(`Redis get failed for ${key}: ${(e as Error).message}`);
      return null;
    }
  }

  async set(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<boolean> {
    try {
      if (!this.client.status || this.client.status === 'end') {
        await this.client.connect();
      }
      const payload = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, payload, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, payload);
      }
      return true;
    } catch (e) {
      this.logger.warn(`Redis set failed for ${key}: ${(e as Error).message}`);
      return false;
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (!this.client.status || this.client.status === 'end') {
        await this.client.connect();
      }
      await this.client.del(key);
    } catch (e) {
      this.logger.warn(`Redis del failed for ${key}: ${(e as Error).message}`);
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    try {
      if (!this.client.status || this.client.status === 'end') {
        await this.client.connect();
      }
      const keys = await this.client.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (e) {
      this.logger.warn(
        `Redis delByPrefix failed for ${prefix}: ${(e as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {
      // ignore shutdown errors
    }
  }
}

