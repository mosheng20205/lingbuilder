import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { getConfig } from './config.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client = new Redis(getConfig().redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
  async ensureConnected() { if (this.client.status === 'wait') await this.client.connect(); }
  async onModuleDestroy() { if (this.client.status !== 'end') await this.client.quit(); }
  async rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
    await this.ensureConnected();
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, windowSeconds);
    if (count > limit) throw Object.assign(new Error('请求过于频繁，请稍后重试。'), { code: 'RATE_LIMITED', status: 429 });
  }
}
