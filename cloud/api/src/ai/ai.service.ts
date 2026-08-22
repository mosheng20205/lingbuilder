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
import { resolveRates } from '../billing/pricing.js';

@Injectable()
export class AiService {
  private readonly active = new Map<string, AbortController>();
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(BillingService) private readonly billing: BillingService, @Inject(PromotionService) private readonly promotions: PromotionService, @Inject(ProviderService) private readonly providers: ProviderService, @Inject(RulebookService) private readonly rulebook: RulebookService, @Inject(RedisService) private readonly redis: RedisService) {}
  async models(): Promise<LogicalAiModel[]> { const rows = await this.prisma.logicalModel.findMany({ where: { enabled: true, routes: { some: { enabled: true, provider: { enabled: true } } } }, orderBy: { displayName: 'asc' } }); return rows.map(row => ({ alias: row.alias, displayName: row.displayName, description: row.description, contextWindow: row.contextWindow, maxOutputTokens: row.maxOutputTokens, inputPointsPerMillion: row.inputPointsPerMillion.toString(), cachedInputPointsPerMillion: row.cachedInputPointsPerMillion.toString(), outputPointsPerMillion: row.outputPointsPerMillion.toString(), enabled: row.enabled, ...(row.peakInputPointsPerMillion !== null && row.peakCachedInputPointsPerMillion !== null && row.peakOutputPointsPerMillion !== null ? { peakInputPointsPerMillion: row.peakInputPointsPerMillion.toString(), peakCachedInputPointsPerMillion: row.peakCachedInputPointsPerMillion.toString(), peakOutputPointsPerMillion: row.peakOutputPointsPerMillion.toString() } : {}) })); }
  async prepare(userId: string, idempotencyKey: string, operation: 'chat' | 'edit', request: AiChatRequest | AiEditRequest) {
    if (!idempotencyKey || idempotencyKey.length > 128) throw Object.assign(new Error('AI 请求必须提供有效 Idempotency-Key。'), { status: 400, code: 'VALIDATION_FAILED' });
    await this.redis.rateLimit(`ai:user:${userId}`, 60, 60);
    validateRequest(request, operation);
    const model = await this.prisma.logicalModel.findUnique({ where: { alias: request.modelAlias }, include: { routes: { where: { enabled: true, provider: { enabled: true } }, include: { provider: true }, orderBy: [{ priority: 'asc' }, { weight: 'desc' }] } } });
    if (!model?.enabled || !model.routes[0]) throw Object.assign(new Error('所选系统模型当前不可用。'), { status: 503, code: 'MODEL_UNAVAILABLE' });
    const existing = await this.prisma.aiRequest.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } }); if (existing) throw Object.assign(new Error('该幂等请求已存在。'), { status: 409, code: 'IDEMPOTENCY_CONFLICT' });
    const rulebook = await this.rulebook.get();
    const messages = [{ role: 'system' as const, content: `以下是 LingBuilder 固定 AI 规则手册，必须优先遵守（版本 ${rulebook.version}）：\n${rulebook.content}` }, ...(operation === 'edit' ? buildEditMessages(request as AiEditRequest) : request.messages)];
    const outputBudget = resolveOutputBudget(operation, model.maxOutputTokens, request.maxOutputTokens); const inputEstimate = estimateMessageTokens(messages); const rates = resolveRates(model, new Date()); const estimatedListPoints = this.billing.calculatePoints(inputEstimate, 0, outputBudget, rates);
    const free = await this.promotions.activeFreeWindow(userId, model.alias, estimatedListPoints); const requestId = crypto.randomUUID(); const reservePoints = free ? 0n : estimatedListPoints;
    await this.prisma.aiRequest.create({ data: { id: requestId, userId, idempotencyKey, operation, modelAlias: model.alias, routeVersion: model.routes[0].version, reservedPoints: reservePoints, freePromotionId: free?.policy.id } });
    try { await this.billing.reserve(userId, requestId, reservePoints); } catch (error) { await this.prisma.aiRequest.update({ where: { id: requestId }, data: { status: 'FAILED', errorCode: (error as any)?.code || 'INSUFFICIENT_CREDITS', finishedAt: new Date() } }); throw error; }
    const controller = new AbortController(); this.active.set(requestId, controller);
    return { requestId, model, route: model.routes[0], maxOutput: outputBudget, reservePoints, free, controller, messages, rates };
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
      const editRequest = request as AiEditRequest;
      let editDraft: ReturnType<typeof parseEditDraft> | undefined;
      if (operation === 'edit') {
        try {
          editDraft = parseEditDraft(
            final.text,
            editRequest.files.map(file => file.filePath),
            Boolean(editRequest.designerProject && isDesignerEditInstruction(editRequest.instruction)),
            editRequest.instruction,
            editRequest.designerProject
          );
        } catch (parseError) {
          if (parseError instanceof SyntaxError) throw Object.assign(new Error('AI 返回的修改方案超出长度上限被截断（JSON 不完整）。请缩小修改范围或拆分成更小的步骤后重试。'), { status: 400, code: 'EDIT_DRAFT_TRUNCATED' });
          throw parseError;
        }
      }
      const listPrice = this.billing.calculatePoints(final.usage.inputTokens, final.usage.cachedInputTokens, final.usage.outputTokens, prepared.rates); const charge = free ? 0n : listPrice;
      const providerCostMicros = this.billing.calculatePoints(final.usage.inputTokens + final.usage.cachedInputTokens, 0, final.usage.outputTokens, { input: usedRoute.costInputMicrosPerMillion, cached: 0n, output: usedRoute.costOutputMicrosPerMillion });
      if (free) await this.promotions.consumeFreeWindow(free.policy.id, userId, free.usageDate, listPrice);
      await this.billing.settle(userId, requestId, reservePoints, charge);
      billingFinalized = true;
      const receipt = { requestId, modelAlias: model.alias, inputTokens: final.usage.inputTokens, cachedInputTokens: final.usage.cachedInputTokens, outputTokens: final.usage.outputTokens, listPricePoints: listPrice.toString(), chargedPoints: charge.toString(), estimated: final.usage.estimated, ...(free ? { freePromotionId: free.policy.id } : {}) };
      await this.prisma.aiRequest.update({ where: { id: requestId }, data: { status: 'COMPLETED', listPricePoints: listPrice, chargedPoints: charge, inputTokens: receipt.inputTokens, cachedInputTokens: receipt.cachedInputTokens, outputTokens: receipt.outputTokens, usageEstimated: receipt.estimated, providerCostMicros, finishedAt: new Date() } });
      if (editDraft) yield { type: 'edit_draft', requestId, files: editDraft.files, instruction: (request as AiEditRequest).instruction, ...(editDraft.designerProject ? { designerProject: editDraft.designerProject } : {}) };
      yield { type: 'usage', requestId, receipt }; yield { type: 'completed', requestId };
    } catch (error: any) {
      const cancelled = controller.signal.aborted;
      const friendly = error?.code === 'EDIT_DRAFT_TRUNCATED' || error?.code === 'MODEL_UNAVAILABLE' || error?.code === 'INSUFFICIENT_CREDITS';
      if (!billingFinalized && cancelled && streamedText.length > 0) {
        const { inputTokens, outputTokens } = estimateCancellationUsage(messages, streamedText);
        const listPrice = this.billing.calculatePoints(inputTokens, 0, outputTokens, prepared.rates);
        const chargedPoints = free ? 0n : listPrice;
        const providerCostMicros = this.billing.calculatePoints(inputTokens, 0, outputTokens, { input: usedRoute.costInputMicrosPerMillion, cached: 0n, output: usedRoute.costOutputMicrosPerMillion });
        if (free) await this.promotions.consumeFreeWindow(free.policy.id, userId, free.usageDate, listPrice);
        await this.billing.settle(userId, requestId, reservePoints, chargedPoints);
        billingFinalized = true;
        await this.prisma.aiRequest.update({ where: { id: requestId }, data: { status: 'CANCELLED', errorCode: 'REQUEST_CANCELLED', listPricePoints: listPrice, chargedPoints, inputTokens, outputTokens, usageEstimated: true, providerCostMicros, finishedAt: new Date() } });
      } else {
        if (!billingFinalized) await this.billing.release(userId, requestId, reservePoints, cancelled ? 'AI 请求已取消' : friendly ? String(error.message) : '供应商调用失败');
        await this.prisma.aiRequest.update({ where: { id: requestId }, data: { status: cancelled ? 'CANCELLED' : 'FAILED', errorCode: cancelled ? 'REQUEST_CANCELLED' : error?.code === 'EDIT_DRAFT_TRUNCATED' ? 'EDIT_DRAFT_TRUNCATED' : 'PROVIDER_FAILED', finishedAt: new Date() } });
      }
      yield { type: 'error', requestId, code: cancelled ? 'REQUEST_CANCELLED' : error?.code === 'EDIT_DRAFT_TRUNCATED' ? 'EDIT_DRAFT_TRUNCATED' : 'PROVIDER_FAILED', message: cancelled ? 'AI 请求已取消。' : friendly ? String(error.message) : '模型服务暂时不可用。', retryable: !cancelled };
    } finally { this.active.delete(requestId); }
  }
  cancel(userId: string, requestId: string) { const controller = this.active.get(requestId); if (controller) controller.abort(); return this.prisma.aiRequest.findFirst({ where: { id: requestId, userId } }).then(record => ({ ok: Boolean(record && controller) })); }
}

function validateRequest(request: AiChatRequest | AiEditRequest, operation: string) { if (!request?.modelAlias || !Array.isArray(request.messages) || !request.messages.length || request.messages.length > 50) throw Object.assign(new Error('AI 请求结构无效。'), { status: 400, code: 'VALIDATION_FAILED' }); const total = request.messages.reduce((sum, item) => sum + String(item.content || '').length, 0); if (total > 100_000) throw Object.assign(new Error('对话上下文超过 100,000 字符。'), { status: 413, code: 'VALIDATION_FAILED' }); if (operation === 'edit') { const edit = request as AiEditRequest; const designerSize = edit.designerProject ? JSON.stringify(edit.designerProject).length : 0; if (!edit.instruction || !Array.isArray(edit.files) || edit.files.length > 5 || edit.files.reduce((sum, file) => sum + file.content.length, 0) > 24_000 || designerSize > 200_000) throw Object.assign(new Error('编辑上下文超过受控大小限制。'), { status: 400, code: 'VALIDATION_FAILED' }); } }
export const DEFAULT_EDIT_OUTPUT_TOKENS = 8_192;

export function resolveOutputBudget(operation: 'chat' | 'edit', modelMaxOutputTokens: number, requested: number | undefined): number {
  const modelBudget = Math.max(1, Math.floor(modelMaxOutputTokens));
  const defaultBudget = operation === 'edit' ? Math.min(modelBudget, DEFAULT_EDIT_OUTPUT_TOKENS) : modelBudget;
  const requestedBudget = requested === undefined ? defaultBudget : Math.floor(requested);
  return Math.max(1, Math.min(requestedBudget, modelBudget));
}

function isDesignerEditInstruction(instruction: string): boolean {
  return /窗口|窗体|控件|布局|界面|按钮|文本框|标签|进度条|宽度|高度|坐标|显示|隐藏|移动|调整大小|设计器/u.test(instruction);
}

function isDesignerBeautificationInstruction(instruction: string): boolean {
  return /美化|美观|好看|太乱|整洁|更漂亮|更协调|优化(?:界面|布局|样式)|调整(?:界面|布局|样式)/u.test(instruction);
}

function buildEditMessages(request: AiEditRequest): AiMessage[] {
  const requiresDesignerProject = Boolean(request.designerProject && isDesignerEditInstruction(request.instruction));
  const designerInstruction = requiresDesignerProject
    ? '本次需求涉及设计器，designerProject 为必填字段。必须返回当前模型的完整修改后对象，逐项保留所有未修改的窗口、控件、资源、属性和稳定 ID；不能返回 patch、片段或只返回发生变化的控件。'
    : '本次需求不需要修改设计器模型，可以省略 designerProject。';
  return [...request.messages, { role: 'user', content: `修改要求：${request.instruction}\n\n仅返回 JSON，不要使用 Markdown 代码块：{"files":[{"filePath":"允许的路径","updatedSource":"完整文件"}],"designerProject":{"id":"项目 ID","name":"项目名称","windows":[{"id":"窗口 ID","controls":[{"id":"控件 ID","x":0,"y":0,"width":100,"height":24}]}],"resources":[]}\n\n${designerInstruction}\n设计器项目 ID、窗口 ID、控件 ID 和事件绑定名必须保持稳定；源码和设计器必须描述同一个最终界面。\n\n${request.designerProject ? `--- DESIGNER PROJECT\n${JSON.stringify(request.designerProject)}\n` : ''}${request.files.map(file => `--- FILE ${file.filePath}\n${file.content}`).join('\n\n')}` }];
}

export function parseEditDraft(
  text: string,
  allowedPaths: string[],
  requiresDesignerProject = false,
  instruction = '',
  currentDesignerProject?: Record<string, unknown>
) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '');
  const parsed = JSON.parse(cleaned);
  const allowed = new Set(allowedPaths.map(path => path.replace(/\\/gu, '/')));
  const files = Array.isArray(parsed.files) ? parsed.files.filter((file: any) => allowed.has(String(file.filePath).replace(/\\/gu, '/')) && typeof file.updatedSource === 'string').map((file: any) => ({ filePath: String(file.filePath), updatedSource: file.updatedSource })) : [];
  if (!files.length) throw new Error('AI 未返回有效的完整文件修改结果。');
  let designerProject = parsed.designerProject && typeof parsed.designerProject === 'object' && !Array.isArray(parsed.designerProject) ? parsed.designerProject as Record<string, unknown> : undefined;
  if (requiresDesignerProject && (!designerProject || areDesignerProjectsEquivalent(designerProject, currentDesignerProject))) {
    if (!isDesignerBeautificationInstruction(instruction) || !currentDesignerProject) {
      throw new Error('本次需求涉及窗口或控件布局，但系统 AI 未返回完整设计器模型；为避免源码与界面不一致，提案未创建。');
    }
    designerProject = createDesignerBeautificationFallback(currentDesignerProject);
  }
  return { files, ...(designerProject ? { designerProject } : {}) };
}

type CloudDesignerControl = Record<string, unknown> & {
  type?: string;
  background?: string;
  foreground?: string;
  fontSize?: number;
  fontBold?: boolean;
  visibility?: string;
  properties?: Record<string, unknown>;
};

type CloudDesignerWindow = Record<string, unknown> & {
  background?: string;
  titleBarBackground?: string;
  titleBarForeground?: string;
  cornerStyle?: string;
  controls?: CloudDesignerControl[];
};

function createDesignerBeautificationFallback(project: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(project)) as Record<string, unknown>;
  const windows = Array.isArray(clone.windows) ? clone.windows as CloudDesignerWindow[] : [];
  return {
    ...clone,
    windows: windows.map(window => {
      const darkWindow = isDarkDesignerColor(window.background || '');
      const buttonPalette = ['#0F766E', '#2563EB', '#7C3AED', '#C2410C', '#BE123C', '#475569'];
      let buttonIndex = 0;
      let highlightedLabel = false;
      const controls = Array.isArray(window.controls) ? window.controls : [];
      return {
        ...window,
        background: changedColor(window.background || '', darkWindow ? '#172033' : '#F8FAFC', darkWindow ? '#1E293B' : '#F1F5F9'),
        titleBarBackground: changedColor(window.titleBarBackground || '', darkWindow ? '#0F2742' : '#1E3A5F', darkWindow ? '#16324F' : '#134E4A'),
        titleBarForeground: changedColor(window.titleBarForeground || '', '#F8FAFC', '#FFFFFF'),
        cornerStyle: 'rounded',
        controls: controls.map(control => {
          if (control.type === 'Button') {
            const color = buttonPalette[buttonIndex % buttonPalette.length];
            buttonIndex += 1;
            return {
              ...control,
              background: changedColor(control.background || '', color, '#155E75'),
              foreground: changedColor(control.foreground || '', '#FFFFFF', '#F8FAFC'),
              fontBold: true,
              properties: {
                ...(control.properties || {}),
                cornerRadius: Math.max(8, Number(control.properties?.cornerRadius) || 0)
              }
            };
          }
          if (control.type === 'Label' && !highlightedLabel && control.visibility === 'Visible') {
            highlightedLabel = true;
            return {
              ...control,
              foreground: changedColor(control.foreground || '', darkWindow ? '#F8FAFC' : '#0F172A', darkWindow ? '#E2E8F0' : '#1E293B'),
              fontSize: Math.max(Number(control.fontSize) || 0, 18),
              fontBold: true
            };
          }
          if (control.type === 'TextBox' || control.type === 'RichEdit') {
            return {
              ...control,
              background: changedColor(control.background || '', darkWindow ? '#0F172A' : '#FFFFFF', darkWindow ? '#111827' : '#F8FAFC'),
              foreground: changedColor(control.foreground || '', darkWindow ? '#E2E8F0' : '#0F172A', darkWindow ? '#F8FAFC' : '#1E293B')
            };
          }
          return control;
        })
      };
    })
  };
}

function changedColor(current: string, preferred: string, alternative: string): string {
  return current.trim().toLowerCase() === preferred.toLowerCase() ? alternative : preferred;
}

function isDarkDesignerColor(value: string): boolean {
  const match = /^#([\da-f]{6})$/iu.exec(value.trim());
  if (!match) return false;
  const color = Number.parseInt(match[1], 16);
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  return (red * 299 + green * 587 + blue * 114) / 1000 < 140;
}

function areDesignerProjectsEquivalent(left: unknown, right: unknown): boolean {
  if (!left || !right) return false;
  return stableSerializeDesignerProject(left) === stableSerializeDesignerProject(right);
}

function stableSerializeDesignerProject(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => stableSerializeDesignerProject(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map(key => (
      `${JSON.stringify(key)}:${stableSerializeDesignerProject((value as Record<string, unknown>)[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}
