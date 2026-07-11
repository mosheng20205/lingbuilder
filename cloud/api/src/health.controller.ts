import { Controller, Get, Header } from '@nestjs/common';
import { Public } from './common/current-user.js';
import { PrismaService } from './prisma.service.js';
import { RedisService } from './redis.service.js';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}
  @Public() @Get('health') async health() { await this.prisma.$queryRaw`SELECT 1`; await this.redis.ensureConnected(); return { ok: true, service: 'LingBuilder Cloud API', version: 1, zeroRetention: true }; }
  @Public() @Get('metrics') @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8') async metrics() {
    const [users, requests, failures, usage] = await Promise.all([
      this.prisma.user.count(), this.prisma.aiRequest.count(), this.prisma.aiRequest.count({ where: { status: 'FAILED' } }),
      this.prisma.aiRequest.aggregate({ _sum: { inputTokens: true, outputTokens: true, chargedPoints: true, providerCostMicros: true } })
    ]);
    return [`lingbuilder_users_total ${users}`, `lingbuilder_ai_requests_total ${requests}`, `lingbuilder_ai_failures_total ${failures}`, `lingbuilder_ai_input_tokens_total ${usage._sum.inputTokens || 0}`, `lingbuilder_ai_output_tokens_total ${usage._sum.outputTokens || 0}`, `lingbuilder_ai_charged_points_total ${usage._sum.chargedPoints || 0n}`, `lingbuilder_ai_provider_cost_micros_total ${usage._sum.providerCostMicros || 0n}`].join('\n') + '\n';
  }
}
