import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CacheEntry {
  payload: string;
  expiry: number | null;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private store = new Map<string, CacheEntry>();

  constructor(private readonly configService: ConfigService) {
    this.logger.log(
      'RedisService initialized in MVP IN-MEMORY mode (No external Redis server needed).',
    );
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const entry = this.store.get(key);
      if (!entry) return null;

      // Check expiry
      if (entry.expiry && Date.now() > entry.expiry) {
        this.store.delete(key);
        return null;
      }

      return JSON.parse(entry.payload) as T;
    } catch (e) {
      this.logger.warn(
        `In-memory get failed for ${key}: ${(e as Error).message}`,
      );
      return null;
    }
  }

  async set(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<boolean> {
    try {
      const payload = JSON.stringify(value);
      const expiry =
        ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;

      this.store.set(key, { payload, expiry });
      return true;
    } catch (e) {
      this.logger.warn(
        `In-memory set failed for ${key}: ${(e as Error).message}`,
      );
      return false;
    }
  }

  async del(key: string): Promise<void> {
    try {
      this.store.delete(key);
    } catch (e) {
      this.logger.warn(
        `In-memory del failed for ${key}: ${(e as Error).message}`,
      );
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    try {
      for (const key of this.store.keys()) {
        if (key.startsWith(prefix)) {
          this.store.delete(key);
        }
      }
    } catch (e) {
      this.logger.warn(
        `In-memory delByPrefix failed for ${prefix}: ${(e as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    this.store.clear();
  }
}
