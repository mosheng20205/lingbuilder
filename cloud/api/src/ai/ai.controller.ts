import { Body, Controller, Delete, Get, Header, Headers, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { AiChatRequest, AiEditRequest } from '@lingbuilder/contracts';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.js';
import { AiService } from './ai.service.js';
import { BillingService } from '../billing/billing.service.js';
import { PrismaService } from '../prisma.service.js';

@Controller('v1/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}
  @Get('models') async models(@Res({ passthrough: true }) response: Response) { const models = await this.ai.models(); response.setHeader('etag', `W/"${models.map(item => item.alias).join('.')}:${models.length}"`); return { ok: true, models }; }
  @Post('chat/stream') async chat(@CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') key: string, @Body() request: AiChatRequest, @Res() response: Response) { const prepared = await this.ai.prepare(user.id, key, 'chat', request); return streamResponse(response, this.ai.streamPrepared(user.id, 'chat', request, prepared)); }
  @Post('edit/stream') async edit(@CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') key: string, @Body() request: AiEditRequest, @Res() response: Response) { const prepared = await this.ai.prepare(user.id, key, 'edit', request); return streamResponse(response, this.ai.streamPrepared(user.id, 'edit', request, prepared)); }
  @Delete('requests/:requestId') cancel(@CurrentUser() user: AuthenticatedUser, @Param('requestId') requestId: string) { return this.ai.cancel(user.id, requestId); }
}

@Controller('v1/usage')
export class UsageController {
  constructor(private readonly billing: BillingService, private readonly prisma: PrismaService) {}
  @Get('balance') async balance(@CurrentUser() user: AuthenticatedUser) { return { ok: true, balance: await this.billing.balance(user.id) }; }
  @Get('requests') async requests(@CurrentUser() user: AuthenticatedUser) { const requests = await this.prisma.aiRequest.findMany({ where: { userId: user.id }, orderBy: { startedAt: 'desc' }, take: 100 }); return { ok: true, requests: requests.map(item => ({ ...item, reservedPoints: item.reservedPoints.toString(), listPricePoints: item.listPricePoints.toString(), chargedPoints: item.chargedPoints.toString(), providerCostMicros: item.providerCostMicros.toString() })) }; }
}

async function streamResponse(response: Response, stream: AsyncGenerator<any>) { response.status(200); response.setHeader('content-type', 'text/event-stream; charset=utf-8'); response.setHeader('cache-control', 'no-cache, no-transform'); response.setHeader('connection', 'keep-alive'); response.flushHeaders(); for await (const event of stream) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`); response.end(); }
