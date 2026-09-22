import crypto from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AiChatRequest, AiEditRequest, AiMessage, AiNewFileAllowance, AiStreamEvent, LogicalAiModel } from '@lingbuilder/contracts';
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
    const outputBudget = resolveOutputBudget(operation, model.maxOutputTokens, request.maxOutputTokens); const inputEstimate = estimateMessageTokens(messages); const rates = resolveRates(model, new Date());
    // 预冻结使用有界的输出估算：模型级 maxOutputTokens 已开到供应商上限（393216），
    // 全额预冻结会把低余额用户全部挡在 402。实际用量仍按真实 usage 结算，settle 支持补收超出冻结的部分。
    const reserveOutput = Math.min(outputBudget, RESERVE_OUTPUT_TOKEN_ESTIMATE);
    const estimatedListPoints = this.billing.calculatePoints(inputEstimate, 0, reserveOutput, rates);
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
    // 仅统计正文 delta 字符数：思考内容不算正文，用于判定「模型只思考、未输出回复」的空回复场景。
    let streamedContentChars = 0;
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
            for await (const chunk of this.providers.stream(candidate.provider, candidate, messages, prepared.maxOutput, controller.signal, { thinkingDisabled: request.thinking === 'disabled' })) {
              // 推理型模型的思考过程使用独立事件下发，客户端可折叠展示或忽略；不再混入正文 delta。
              if (chunk.reasoningDelta && operation === 'chat') { emitted = true; streamedText += chunk.reasoningDelta; yield { type: 'reasoning', requestId, text: chunk.reasoningDelta }; }
              if (chunk.delta) { emitted = true; streamedText += chunk.delta; streamedContentChars += chunk.delta.length; yield { type: 'delta', requestId, text: chunk.delta }; }
              if (chunk.final) final = chunk.final;
            }
            if (!final) throw new Error('供应商未返回最终用量。');
            usedRoute = candidate;
            await this.prisma.providerChannel.update({ where: { id: candidate.providerId }, data: { failureCount: 0, circuitOpenUntil: null } });
            await this.prisma.aiRequest.update({ where: { id: requestId }, data: { routeVersion: candidate.version } });
            break routeLoop;
          } catch (error) {
            lastError = error;
            // 供应商失败必须留痕：stdout 会进容器日志，便于把 PROVIDER_FAILED 关联到真实原因。
            console.error(`[ai] provider attempt failed: route=${candidate.alias}@v${candidate.version} provider=${candidate.providerId} attempt=${attempt} emitted=${emitted} error=${error instanceof Error ? error.message : String(error)}`);
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
            editRequest.instruction,
            editRequest.designerProject,
            editRequest.newFiles
          );
        } catch (parseError: any) {
          // 解析失败必须留痕：把模型原始输出开头写进容器日志，否则无法定位
          // 「模型到底返回了什么、为什么没通过白名单」。
          if (parseError?.code === 'EDIT_DRAFT_TRUNCATED' || parseError?.code === 'EDIT_DRAFT_INVALID' || parseError instanceof SyntaxError) {
            console.error(`[ai] edit draft parse failed: request=${requestId} code=${parseError?.code || 'EDIT_DRAFT_PARSE_FAILED'} rawHead=${JSON.stringify(final.text.slice(0, 1200))}`);
          }
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
      // 思考模型可能把输出预算全部耗在推理上（finish_reason=length 且正文为空）。此时按实际用量结算后，
      // 必须给客户端可见的中文结果，不能再静默发送 completed 让用户看到空气泡。
      const truncatedChatReply = operation === 'chat' && final.finishReason === 'length' && streamedContentChars > 0;
      const emptyChatReply = operation === 'chat' && streamedContentChars === 0 && !final.text.trim() && !final.reasoningText?.trim();
      if (editDraft) yield { type: 'edit_draft', requestId, files: editDraft.files, instruction: (request as AiEditRequest).instruction, ...(editDraft.designerProject ? { designerProject: editDraft.designerProject } : {}) };
      if (truncatedChatReply) yield { type: 'delta', requestId, text: '\n\n（回复达到输出长度上限，内容可能不完整。）' };
      yield { type: 'usage', requestId, receipt };
      if (emptyChatReply) {
        yield { type: 'error', requestId, code: 'PROVIDER_FAILED', message: final.finishReason === 'length' ? '模型的思考过程耗尽了输出长度上限，未能生成可见回复；本次用量已按实际结算，请缩小问题范围或分步提问后重试。' : '模型未返回可见回复，本次用量已按实际结算，请重试。', retryable: true };
        return;
      }
      yield { type: 'completed', requestId };
    } catch (error: any) {
      const cancelled = controller.signal.aborted;
      // 顶层失败必须留痕：把真实错误与堆栈写进容器日志，否则 PROVIDER_FAILED 无法定位。
      console.error(`[ai] stream failed: op=${operation} request=${requestId} code=${error?.code || 'N/A'} msg=${error instanceof Error ? error.message : String(error)} stack=${error instanceof Error ? error.stack : ''}`);
      const friendly = error?.code === 'EDIT_DRAFT_TRUNCATED' || error?.code === 'EDIT_DRAFT_INVALID' || error?.code === 'MODEL_UNAVAILABLE' || error?.code === 'INSUFFICIENT_CREDITS';
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
        await this.prisma.aiRequest.update({ where: { id: requestId }, data: { status: cancelled ? 'CANCELLED' : 'FAILED', errorCode: cancelled ? 'REQUEST_CANCELLED' : error?.code === 'EDIT_DRAFT_TRUNCATED' ? 'EDIT_DRAFT_TRUNCATED' : error?.code === 'EDIT_DRAFT_INVALID' ? 'EDIT_DRAFT_INVALID' : 'PROVIDER_FAILED', finishedAt: new Date() } });
      }
      yield { type: 'error', requestId, code: cancelled ? 'REQUEST_CANCELLED' : error?.code === 'EDIT_DRAFT_TRUNCATED' ? 'EDIT_DRAFT_TRUNCATED' : error?.code === 'EDIT_DRAFT_INVALID' ? 'EDIT_DRAFT_INVALID' : 'PROVIDER_FAILED', message: cancelled ? 'AI 请求已取消。' : friendly ? String(error.message) : '模型服务暂时不可用。', retryable: !cancelled };
    } finally { this.active.delete(requestId); }
  }
  cancel(userId: string, requestId: string) { const controller = this.active.get(requestId); if (controller) controller.abort(); return this.prisma.aiRequest.findFirst({ where: { id: requestId, userId } }).then(record => ({ ok: Boolean(record && controller) })); }
}

function validateRequest(request: AiChatRequest | AiEditRequest, operation: string) { if (!request?.modelAlias || !Array.isArray(request.messages) || !request.messages.length || request.messages.length > 50) throw Object.assign(new Error('AI 请求结构无效。'), { status: 400, code: 'VALIDATION_FAILED' }); const total = request.messages.reduce((sum, item) => sum + String(item.content || '').length, 0); if (total > 100_000) throw Object.assign(new Error('对话上下文超过 100,000 字符。'), { status: 413, code: 'VALIDATION_FAILED' }); if (operation === 'edit') { const edit = request as AiEditRequest; const designerSize = edit.designerProject ? JSON.stringify(edit.designerProject).length : 0; if (!edit.instruction || !Array.isArray(edit.files) || edit.files.length > 5 || edit.files.reduce((sum, file) => sum + file.content.length, 0) > 24_000 || designerSize > 200_000) throw Object.assign(new Error('编辑上下文超过受控大小限制。'), { status: 400, code: 'VALIDATION_FAILED' }); } }
// 编辑草稿必须完整返回 JSON。8K 会让中等规模设计器模型的完整回显截断成 EDIT_DRAFT_TRUNCATED；
// 32K 与历史 24576 上限同量级；模型级 maxOutputTokens 已开到供应商上限（393216），编辑预算不受其钳制。
export const DEFAULT_EDIT_OUTPUT_TOKENS = 32_768;
// 预冻结的输出估算上限：仅影响请求期间的点数冻结额度，不影响实际发送给供应商的 max_tokens。
export const RESERVE_OUTPUT_TOKEN_ESTIMATE = 16_384;

export function resolveOutputBudget(operation: 'chat' | 'edit', modelMaxOutputTokens: number, requested: number | undefined): number {
  const modelBudget = Math.max(1, Math.floor(modelMaxOutputTokens));
  const defaultBudget = operation === 'edit' ? Math.min(modelBudget, DEFAULT_EDIT_OUTPUT_TOKENS) : modelBudget;
  const requestedBudget = requested === undefined ? defaultBudget : Math.floor(requested);
  return Math.max(1, Math.min(requestedBudget, modelBudget));
}

function isDesignerBeautificationInstruction(instruction: string): boolean {
  return /美化|美观|好看|太乱|整洁|更漂亮|更协调|优化(?:界面|布局|样式)|调整(?:界面|布局|样式)/u.test(instruction);
}

function buildEditMessages(request: AiEditRequest): AiMessage[] {
  // 云端不再用指令关键词判定「这次必须改布局」（2026-09-22 收口）：那会把「给按钮1加上
  // 点击计数」这类纯行为需求逼成外观改动，或在模型原样回传布局时整份草稿被拒。关键词只
  // 用于宽泛美化请求（它本就要求产出可见布局变化）；真正的控件门禁在 IDE 本地执行。
  const designerInstruction = !request.designerProject
    ? '本次请求没有窗口设计器模型，省略 designerProject。'
    : isDesignerBeautificationInstruction(request.instruction)
      ? '本次是宽泛的界面美化请求：designerProject 为必填字段，且必须产生至少三项肉眼可见的属性变化（颜色、位置、尺寸、字号、圆角或间距），禁止仅复制、复述或重新排序当前模型；保留所有稳定 ID、名称和事件绑定。'
      : '只有用户确实要求改动界面外观或布局时，才返回修改后的完整 designerProject（逐项保留未修改的窗口、控件、资源与稳定 ID，不能返回 patch 或片段）；只改运行行为（计数、判断、提示、数据处理）时省略该字段，禁止为了凑出变化而改动无关控件的外观。';
  const designerTypeDiscipline = request.designerProject
    ? '\ncontrols[].type 必须逐字使用 LingBuilder 规则手册「设计器控件类型清单」中的英文标识（区分大小写）；例如编辑框必须写 TextBox，不能写 Edit、Input 或输入框。清单中没有所需控件类型时，选择最接近的合法类型实现，禁止自造类型名。'
    : '';
  const newFileGuidance = request.newFiles ? describeNewFileAllowance(normalizeNewFileAllowance(request.newFiles)) : '';
  return [...request.messages, { role: 'user', content: `修改要求：${request.instruction}\n\n仅返回 JSON，不要使用 Markdown 代码块：{"files":[{"filePath":"允许的路径","updatedSource":"完整文件"}],"designerProject":{"id":"项目 ID","name":"项目名称","windows":[{"id":"窗口 ID","controls":[{"id":"控件 ID","type":"TextBox","name":"控件名","content":"文本","x":0,"y":0,"width":100,"height":24}]}],"resources":[]}\n\n${designerInstruction}${designerTypeDiscipline}${newFileGuidance}\n设计器项目 ID、窗口 ID、控件 ID 和事件绑定名必须保持稳定；源码和设计器必须描述同一个最终界面。只改界面、源码不动时 files 可以是空数组。\n\n${request.designerProject ? `--- DESIGNER PROJECT\n${JSON.stringify(request.designerProject)}\n` : ''}${request.files.map(file => `--- FILE ${file.filePath}\n${file.content}`).join('\n\n')}` }];
}

/** 校验并规范化 newFiles 白名单；不合法直接 400。与 IDE 侧 aiEditFileScope 同语义（两包不共享代码）。 */
function normalizeNewFileAllowance(value: unknown): AiNewFileAllowance {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw Object.assign(new Error('newFiles 必须是 JSON object。'), { status: 400, code: 'VALIDATION_FAILED' });
  const raw = value as Record<string, unknown>;
  const isSafeRelative = (item: string) => item.length > 0 && item.length <= 200 && !/^[a-zA-Z]:/u.test(item) && !item.startsWith('/') && item.split('/').every(part => part && part !== '.' && part !== '..');
  const allowance: AiNewFileAllowance = {};
  if (raw.paths !== undefined) {
    if (!Array.isArray(raw.paths) || raw.paths.some(item => typeof item !== 'string')) throw Object.assign(new Error('newFiles.paths 必须是字符串数组。'), { status: 400, code: 'VALIDATION_FAILED' });
    const paths = [...new Set(raw.paths.map(item => String(item).replace(/\\/gu, '/').replace(/^\.\//u, '')))].filter(Boolean);
    if (paths.length > 10) throw Object.assign(new Error('newFiles.paths 最多 10 条。'), { status: 400, code: 'VALIDATION_FAILED' });
    const invalid = paths.find(path => !isSafeRelative(path));
    if (invalid) throw Object.assign(new Error(`newFiles.paths 含不合法路径：${invalid}。`), { status: 400, code: 'VALIDATION_FAILED' });
    if (paths.length) allowance.paths = paths;
  }
  if (raw.directories !== undefined) {
    if (!Array.isArray(raw.directories) || raw.directories.some(item => typeof item !== 'string')) throw Object.assign(new Error('newFiles.directories 必须是字符串数组。'), { status: 400, code: 'VALIDATION_FAILED' });
    const directories = [...new Set(raw.directories.map(item => String(item).replace(/\\/gu, '/').replace(/^\.\//u, '').replace(/\/+$/u, '')))].filter(Boolean);
    if (directories.length > 5) throw Object.assign(new Error('newFiles.directories 最多 5 个。'), { status: 400, code: 'VALIDATION_FAILED' });
    const invalid = directories.find(directory => !isSafeRelative(directory));
    if (invalid) throw Object.assign(new Error(`newFiles.directories 含不合法目录：${invalid}。`), { status: 400, code: 'VALIDATION_FAILED' });
    if (directories.length) allowance.directories = directories;
  }
  if (raw.extensions !== undefined) {
    if (!Array.isArray(raw.extensions) || raw.extensions.some(item => typeof item !== 'string')) throw Object.assign(new Error('newFiles.extensions 必须是字符串数组。'), { status: 400, code: 'VALIDATION_FAILED' });
    const extensions = [...new Set(raw.extensions.map(item => String(item).toLowerCase()))].filter(Boolean);
    if (extensions.length > 10) throw Object.assign(new Error('newFiles.extensions 最多 10 个。'), { status: 400, code: 'VALIDATION_FAILED' });
    const invalid = extensions.find(extension => !/^\.[A-Za-z0-9]+$/u.test(extension));
    if (invalid) throw Object.assign(new Error(`newFiles.extensions 含不合法扩展名：${invalid}。`), { status: 400, code: 'VALIDATION_FAILED' });
    if (extensions.length) allowance.extensions = extensions;
  }
  if (raw.maxCount !== undefined) {
    if (typeof raw.maxCount !== 'number' || !Number.isInteger(raw.maxCount) || raw.maxCount < 1 || raw.maxCount > 10) throw Object.assign(new Error('newFiles.maxCount 必须是 1–10 的整数。'), { status: 400, code: 'VALIDATION_FAILED' });
    allowance.maxCount = raw.maxCount;
  }
  if (!allowance.paths?.length && !allowance.directories?.length) throw Object.assign(new Error('newFiles 必须声明 paths 或 directories 至少一项。'), { status: 400, code: 'VALIDATION_FAILED' });
  allowance.maxCount = allowance.maxCount ?? 5;
  return allowance;
}

/** 把新建白名单转成给模型看的中文约束说明。 */
function describeNewFileAllowance(allowance: AiNewFileAllowance): string {
  const maxCount = allowance.maxCount ?? 5;
  const lines: string[] = ['\n本次请求允许创建新文件，但必须满足以下白名单约束：'];
  if (allowance.paths?.length) lines.push(`- 允许新建的显式路径：${allowance.paths.join('、')}。`);
  if (allowance.directories?.length) {
    const extensions = allowance.extensions?.length ? `扩展名仅限 ${allowance.extensions.join('、')}` : '扩展名不限';
    lines.push(`- 允许在以下目录内新建文件：${allowance.directories.join('、')}（${extensions}，最多 ${maxCount} 个）。`);
  }
  lines.push(`- 新建文件合计不超过 ${maxCount} 个；filePath 必须是白名单范围内的工作区相对路径，范围外的新路径会被整体拒绝。`);
  return `\n${lines.join('\n')}`;
}

/** 判断一个已规范化的草稿路径是否命中新建白名单（含数量上限检查由调用方负责）。 */
function isPathAllowedByNewFileAllowance(path: string, allowance: AiNewFileAllowance): boolean {
  const normalized = path.replace(/\\/gu, '/').replace(/^\.\//u, '');
  const lower = normalized.toLocaleLowerCase('en-US');
  if (allowance.paths?.some(declared => declared.toLocaleLowerCase('en-US') === lower)) return true;
  if (allowance.directories?.length) {
    const inDirectory = allowance.directories.some(directory => lower.startsWith(`${directory.toLocaleLowerCase('en-US')}/`));
    if (inDirectory) {
      if (!allowance.extensions?.length) return true;
      const extension = normalized.slice(normalized.lastIndexOf('.')).toLowerCase();
      return allowance.extensions.includes(extension);
    }
  }
  return false;
}

export function parseEditDraft(
  text: string,
  allowedPaths: string[],
  instruction = '',
  currentDesignerProject?: Record<string, unknown>,
  newFiles?: unknown
) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '');
  const parsed = JSON.parse(cleaned);
  // Windows 工作区路径大小写不敏感：模型把 MainWindow.lcpp 回成 mainwindow.lcpp 时
  // 必须认得，否则整份合法草稿会被误报成「不在允许范围内」。
  const normalizePath = (path: string) => path.replace(/\\/gu, '/').replace(/^\.\//u, '');
  const allowed = new Set(allowedPaths.map(path => normalizePath(path).toLocaleLowerCase('en-US')));
  const newFileAllowance = newFiles === undefined || newFiles === null ? undefined : normalizeNewFileAllowance(newFiles);
  const maxNewFiles = newFileAllowance?.maxCount ?? 0;
  const files: Array<{ filePath: string; updatedSource: string }> = [];
  const rejectedPaths: string[] = [];
  let newFileCount = 0;
  for (const file of Array.isArray(parsed.files) ? parsed.files : []) {
    if (!file || typeof file.filePath !== 'string' || typeof file.updatedSource !== 'string') continue;
    const path = normalizePath(String(file.filePath));
    if (allowed.has(path.toLocaleLowerCase('en-US'))) {
      files.push({ filePath: path, updatedSource: file.updatedSource });
      continue;
    }
    if (newFileAllowance && isPathAllowedByNewFileAllowance(path, newFileAllowance)) {
      // 新建额度只数新建文件：此前用 files.length 计数，改一个已有文件就会吃掉额度，
      // 让白名单内的合法新文件被静默丢掉（模型以为已经创建）。
      if (newFileCount >= maxNewFiles) {
        rejectedPaths.push(`${path}（超出新建数量上限 ${maxNewFiles}）`);
        continue;
      }
      newFileCount += 1;
      files.push({ filePath: path, updatedSource: file.updatedSource });
      continue;
    }
    rejectedPaths.push(path);
  }
  let designerProject = parsed.designerProject && typeof parsed.designerProject === 'object' && !Array.isArray(parsed.designerProject) ? parsed.designerProject as Record<string, unknown> : undefined;
  if (designerProject && currentDesignerProject && areDesignerProjectsEquivalent(designerProject, currentDesignerProject)) {
    // 等价模型不算布局改动：美化请求给本地降级方案，其余直接丢弃，按纯源码草稿下发。
    designerProject = isDesignerBeautificationInstruction(instruction) && currentDesignerProject
      ? createDesignerBeautificationFallback(currentDesignerProject)
      : undefined;
  }
  if (!files.length) {
    if (designerProject) {
      // 只改界面、源码不动是合法草稿（例如「把按钮移到右下角」），不得当成空回复拒掉。
      return { files, designerProject };
    }
    if (!rejectedPaths.length && !designerProject) throw Object.assign(new Error('AI 未返回任何文件修改草稿（可能只描述了方案而遗漏文件内容）；请重试。'), { code: 'EDIT_DRAFT_INVALID' });
    throw Object.assign(new Error(`AI 返回的文件（${rejectedPaths.slice(0, 5).join('、')}${rejectedPaths.length > 5 ? ' 等' : ''}）不在本次请求允许的文件范围内，提案未创建。${newFileAllowance ? '请检查路径是否符合新建白名单约束后重试。' : '如需新建文件，请更新客户端使其在请求中声明 newFiles 白名单后重试。'}`), { code: 'EDIT_DRAFT_INVALID' });
  }
  if (!designerProject && currentDesignerProject && isDesignerBeautificationInstruction(instruction)) {
    // 美化请求缺少 designerProject 时同样降级，保持已上线的宽泛视觉请求行为不变。
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
