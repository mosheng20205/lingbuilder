import crypto from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AiChatRequest, AiEditRequest, AiMessage, AiStreamEvent, LogicalAiModel } from '@lingbuilder/contracts';
import { BillingService } from '../billing/billing.service.js';
import { PrismaService } from '../prisma.service.js';
import { PromotionService } from '../promotion/promotion.service.js';
import { ProviderService, type ProviderStreamResult } from './provider.service.js';
import { RulebookService } from './rulebook.service.js';
import { RedisService } from '../redis.service.js';
import { estimateCancellationUsage, estimateMessageTokens } from './usage-estimator.js';

@Injectable()
export class AiService {
  private readonly active = new Map<string, AbortController>();
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(BillingService) private readonly billing: BillingService, @Inject(PromotionService) private readonly promotions: PromotionService, @Inject(ProviderService) private readonly providers: ProviderService, @Inject(RulebookService) private readonly rulebook: RulebookService, @Inject(RedisService) private readonly redis: RedisService) {}
  async models(): Promise<LogicalAiModel[]> { const rows = await this.prisma.logicalModel.findMany({ where: { enabled: true }, orderBy: { displayName: 'asc' } }); return rows.map(row => ({ alias: row.alias, displayName: row.displayName, description: row.description, contextWindow: row.contextWindow, maxOutputTokens: row.maxOutputTokens, inputPointsPerMillion: row.inputPointsPerMillion.toString(), cachedInputPointsPerMillion: row.cachedInputPointsPerMillion.toString(), outputPointsPerMillion: row.outputPointsPerMillion.toString(), enabled: row.enabled })); }
  async prepare(userId: string, idempotencyKey: string, operation: 'chat' | 'edit', request: AiChatRequest | AiEditRequest) {
    if (!idempotencyKey || idempotencyKey.length > 128) throw Object.assign(new Error('AI 请求必须提供有效 Idempotency-Key。'), { status: 400, code: 'VALIDATION_FAILED' });
    await this.redis.rateLimit(`ai:user:${userId}`, 60, 60);
    validateRequest(request, operation);
    const model = await this.prisma.logicalModel.findUnique({ where: { alias: request.modelAlias }, include: { routes: { where: { enabled: true, provider: { enabled: true } }, include: { provider: true }, orderBy: [{ priority: 'asc' }, { weight: 'desc' }] } } });
    if (!model?.enabled || !model.routes[0]) throw Object.assign(new Error('所选系统模型当前不可用。'), { status: 503, code: 'MODEL_UNAVAILABLE' });
    const existing = await this.prisma.aiRequest.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } }); if (existing) throw Object.assign(new Error('该幂等请求已存在。'), { status: 409, code: 'IDEMPOTENCY_CONFLICT' });
    const rulebook = await this.rulebook.get();
    const messages = [{ role: 'system' as const, content: `以下是 LingBuilder 固定 AI 规则手册，必须优先遵守（版本 ${rulebook.version}）：\n${rulebook.content}` }, ...(operation === 'edit' ? buildEditMessages(request as AiEditRequest) : request.messages)];
    const maxOutput = Math.max(1, Math.min(request.maxOutputTokens || model.maxOutputTokens, model.maxOutputTokens)); const inputEstimate = estimateMessageTokens(messages); const estimatedListPoints = this.billing.calculatePoints(inputEstimate, 0, maxOutput, { input: model.inputPointsPerMillion, cached: model.cachedInputPointsPerMillion, output: model.outputPointsPerMillion });
    const free = await this.promotions.activeFreeWindow(userId, model.alias, estimatedListPoints); const requestId = crypto.randomUUID(); const reservePoints = free ? 0n : estimatedListPoints;
    await this.prisma.aiRequest.create({ data: { id: requestId, userId, idempotencyKey, operation, modelAlias: model.alias, routeVersion: model.routes[0].version, reservedPoints: reservePoints, freePromotionId: free?.policy.id } });
    try { await this.billing.reserve(userId, requestId, reservePoints); } catch (error) { await this.prisma.aiRequest.update({ where: { id: requestId }, data: { status: 'FAILED', errorCode: (error as any)?.code || 'INSUFFICIENT_CREDITS', finishedAt: new Date() } }); throw error; }
    const controller = new AbortController(); this.active.set(requestId, controller);
    return { requestId, model, route: model.routes[0], maxOutput, reservePoints, free, controller, messages };
  }
  async *stream(userId: string, idempotencyKey: string, operation: 'chat' | 'edit', request: AiChatRequest | AiEditRequest): AsyncGenerator<AiStreamEvent> {
    const prepared = await this.prepare(userId, idempotencyKey, operation, request);
    yield* this.streamPrepared(userId, operation, request, prepared);
  }
  async *streamPrepared(userId: string, operation: 'chat' | 'edit', request: AiChatRequest | AiEditRequest, prepared: Awaited<ReturnType<AiService['prepare']>>): AsyncGenerator<AiStreamEvent> {
    const { requestId, model, reservePoints, free, controller, messages } = prepared;
    yield { type: 'accepted', requestId, reservedPoints: reservePoints.toString(), freePromotionId: free?.policy.id };
    let final: ProviderStreamResult | undefined;
    let streamedText = '';
    let billingFinalized = false;
    let usedRoute = prepared.route;
    try {
      await this.prisma.aiRequest.update({ where: { id: requestId }, data: { status: 'STREAMING' } });
      let emitted = false; let lastError: unknown;
      routeLoop: for (const candidate of model.routes) {
        if (candidate.provider.circuitOpenUntil && candidate.provider.circuitOpenUntil > new Date()) continue;
        for (let attempt = 0; attempt <= Math.max(0, candidate.retryCount); attempt += 1) {
          try {
            final = undefined;
            for await (const chunk of this.providers.stream(candidate.provider, candidate, messages, prepared.maxOutput, controller.signal)) {
              if (chunk.reasoningDelta && operation === 'chat') { emitted = true; streamedText += chunk.reasoningDelta; yield { type: 'delta', requestId, text: chunk.reasoningDelta }; }
              if (chunk.delta) { emitted = true; streamedText += chunk.delta; yield { type: 'delta', requestId, text: chunk.delta }; }
              if (chunk.final) final = chunk.final;
            }
            if (!final) throw new Error('供应商未返回最终用量。');
            usedRoute = candidate;
            await this.prisma.providerChannel.update({ where: { id: candidate.providerId }, data: { failureCount: 0, circuitOpenUntil: null } });
            await this.prisma.aiRequest.update({ where: { id: requestId }, data: { routeVersion: candidate.version } });
            break routeLoop;
          } catch (error) {
            lastError = error;
            if (controller.signal.aborted || emitted) throw error;
            const nextFailures = candidate.provider.failureCount + attempt + 1;
            await this.prisma.providerChannel.update({ where: { id: candidate.providerId }, data: { failureCount: { increment: 1 }, ...(nextFailures >= 5 ? { circuitOpenUntil: new Date(Date.now() + 60_000) } : {}) } });
          }
        }
      }
      if (!final) throw lastError || new Error('没有可用的模型供应通道。');
      if (!final) throw new Error('供应商未返回最终用量。');
      if (operation === 'chat' && !final.text && final.reasoningText) final.text = final.reasoningText;
      const editFiles = operation === 'edit' ? parseEditDraft(final.text, (request as AiEditRequest).files.map(file => file.filePath)) : undefined;
      const listPrice = this.billing.calculatePoints(final.usage.inputTokens, final.usage.cachedInputTokens, final.usage.outputTokens, { input: model.inputPointsPerMillion, cached: model.cachedInputPointsPerMillion, output: model.outputPointsPerMillion }); const charge = free ? 0n : listPrice;
      const providerCostMicros = this.billing.calculatePoints(final.usage.inputTokens + final.usage.cachedInputTokens, 0, final.usage.outputTokens, { input: usedRoute.costInputMicrosPerMillion, cached: 0n, output: usedRoute.costOutputMicrosPerMillion });
      if (free) await this.promotions.consumeFreeWindow(free.policy.id, userId, free.usageDate, listPrice);
      await this.billing.settle(userId, requestId, reservePoints, charge);
      billingFinalized = true;
      const receipt = { requestId, modelAlias: model.alias, inputTokens: final.usage.inputTokens, cachedInputTokens: final.usage.cachedInputTokens, outputTokens: final.usage.outputTokens, listPricePoints: listPrice.toString(), chargedPoints: charge.toString(), estimated: final.usage.estimated, ...(free ? { freePromotionId: free.policy.id } : {}) };
      await this.prisma.aiRequest.update({ where: { id: requestId }, data: { status: 'COMPLETED', listPricePoints: listPrice, chargedPoints: charge, inputTokens: receipt.inputTokens, cachedInputTokens: receipt.cachedInputTokens, outputTokens: receipt.outputTokens, usageEstimated: receipt.estimated, providerCostMicros, finishedAt: new Date() } });
      if (editFiles) yield { type: 'edit_draft', requestId, files: editFiles };
      yield { type: 'usage', requestId, receipt }; yield { type: 'completed', requestId };
    } catch (error: any) {
      const cancelled = controller.signal.aborted;
      if (!billingFinalized && cancelled && streamedText.length > 0) {
        const { inputTokens, outputTokens } = estimateCancellationUsage(messages, streamedText);
        const listPrice = this.billing.calculatePoints(inputTokens, 0, outputTokens, { input: model.inputPointsPerMillion, cached: model.cachedInputPointsPerMillion, output: model.outputPointsPerMillion });
        const chargedPoints = free ? 0n : listPrice;
        const providerCostMicros = this.billing.calculatePoints(inputTokens, 0, outputTokens, { input: usedRoute.costInputMicrosPerMillion, cached: 0n, output: usedRoute.costOutputMicrosPerMillion });
        if (free) await this.promotions.consumeFreeWindow(free.policy.id, userId, free.usageDate, listPrice);
        await this.billing.settle(userId, requestId, reservePoints, chargedPoints);
        billingFinalized = true;
        await this.prisma.aiRequest.update({ where: { id: requestId }, data: { status: 'CANCELLED', errorCode: 'REQUEST_CANCELLED', listPricePoints: listPrice, chargedPoints, inputTokens, outputTokens, usageEstimated: true, providerCostMicros, finishedAt: new Date() } });
      } else {
        if (!billingFinalized) await this.billing.release(userId, requestId, reservePoints, cancelled ? 'AI 请求已取消' : '供应商调用失败');
        await this.prisma.aiRequest.update({ where: { id: requestId }, data: { status: cancelled ? 'CANCELLED' : 'FAILED', errorCode: cancelled ? 'REQUEST_CANCELLED' : 'PROVIDER_FAILED', finishedAt: new Date() } });
      }
      yield { type: 'error', requestId, code: cancelled ? 'REQUEST_CANCELLED' : 'PROVIDER_FAILED', message: cancelled ? 'AI 请求已取消。' : '模型服务暂时不可用。', retryable: !cancelled };
    } finally { this.active.delete(requestId); }
  }
  cancel(userId: string, requestId: string) { const controller = this.active.get(requestId); if (controller) controller.abort(); return this.prisma.aiRequest.findFirst({ where: { id: requestId, userId } }).then(record => ({ ok: Boolean(record && controller) })); }
}

function validateRequest(request: AiChatRequest | AiEditRequest, operation: string) { if (!request?.modelAlias || !Array.isArray(request.messages) || !request.messages.length || request.messages.length > 50) throw Object.assign(new Error('AI 请求结构无效。'), { status: 400, code: 'VALIDATION_FAILED' }); const total = request.messages.reduce((sum, item) => sum + String(item.content || '').length, 0); if (total > 100_000) throw Object.assign(new Error('对话上下文超过 100,000 字符。'), { status: 413, code: 'VALIDATION_FAILED' }); if (operation === 'edit') { const edit = request as AiEditRequest; if (!edit.instruction || !Array.isArray(edit.files) || edit.files.length > 5 || edit.files.reduce((sum, file) => sum + file.content.length, 0) > 24_000) throw Object.assign(new Error('编辑上下文最多允许 5 个文件、24,000 字符。'), { status: 400, code: 'VALIDATION_FAILED' }); } }
function buildEditMessages(request: AiEditRequest): AiMessage[] { return [...request.messages, { role: 'user', content: `修改要求：${request.instruction}\n\n仅返回 JSON：{"files":[{"filePath":"允许的路径","updatedSource":"完整文件"}]}\n\n${request.files.map(file => `--- FILE ${file.filePath}\n${file.content}`).join('\n\n')}` }]; }
function parseEditDraft(text: string, allowedPaths: string[]) { const cleaned = text.trim().replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, ''); const parsed = JSON.parse(cleaned); const allowed = new Set(allowedPaths.map(path => path.replace(/\\/gu, '/'))); const files = Array.isArray(parsed.files) ? parsed.files.filter((file: any) => allowed.has(String(file.filePath).replace(/\\/gu, '/')) && typeof file.updatedSource === 'string').map((file: any) => ({ filePath: String(file.filePath), updatedSource: file.updatedSource })) : []; if (!files.length) throw new Error('AI 未返回有效的完整文件修改结果。'); return files; }
