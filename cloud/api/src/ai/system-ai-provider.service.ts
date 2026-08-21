import crypto from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AiProviderKind, SystemAiProviderConfigInput } from '@lingbuilder/contracts';
import type { Prisma, ProviderKind } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { SecretVaultService } from '../security/secret-vault.service.js';
import { validateProviderUrl } from '../security/network-policy.js';

export const DEEPSEEK_V4_MODELS = [
  { alias: 'deepseek-v4-flash', modelName: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash' },
  { alias: 'deepseek-v4-pro', modelName: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro' },
] as const;

interface NormalizedModel {
  alias: string;
  modelName: string;
  displayName: string;
}

export interface NormalizedSystemAiProviderConfig {
  name: string;
  preset: 'deepseek-v4' | 'custom';
  protocol: Exclude<AiProviderKind, 'gemini'>;
  kind: ProviderKind;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  timeoutMs: number;
  maxConcurrency: number;
  models: NormalizedModel[];
}

export function normalizeSystemAiProviderInput(input: SystemAiProviderConfigInput): Omit<NormalizedSystemAiProviderConfig, 'baseUrl'> & { baseUrl: string } {
  const name = String(input.name || '').trim();
  if (!name || name.length > 80) throw validationError('供应商名称不能为空且不能超过 80 个字符。');
  const preset = input.preset === 'deepseek-v4' ? 'deepseek-v4' : 'custom';
  const protocol = input.protocol === 'anthropic' ? 'anthropic' : input.protocol === 'openai-compatible' ? 'openai-compatible' : undefined;
  if (!protocol) throw validationError('系统 AI 供应商只支持 OpenAI 或 Anthropic 协议。');
  if (preset === 'deepseek-v4' && protocol !== 'openai-compatible') throw validationError('DeepSeek V4 预设使用 OpenAI 兼容协议。');
  const apiKey = String(input.apiKey || '').trim();
  const baseUrl = String(input.baseUrl || '').trim();
  if (!baseUrl) throw validationError('Base URL 不能为空。');
  const models: NormalizedModel[] = preset === 'deepseek-v4'
    ? DEEPSEEK_V4_MODELS.map(item => ({ ...item }))
    : [normalizeCustomModel(input.modelName, input.displayName)];
  return {
    name,
    preset,
    protocol,
    kind: protocol === 'anthropic' ? 'ANTHROPIC' : 'OPENAI_COMPATIBLE',
    baseUrl,
    apiKey,
    enabled: input.enabled !== false,
    timeoutMs: clampNumber(input.timeoutMs, 300_000, 1_000, 600_000),
    maxConcurrency: clampNumber(input.maxConcurrency, 20, 1, 1_000),
    models,
  };
}

@Injectable()
export class SystemAiProviderService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SecretVaultService) private readonly vault: SecretVaultService,
  ) {}

  async list() {
    const providers = await this.prisma.providerChannel.findMany({
      include: { routes: { include: { model: true }, orderBy: [{ alias: 'asc' }, { version: 'desc' }] } },
      orderBy: { name: 'asc' },
    });
    return providers.map(({ encryptedSecret: _secret, ...provider }) => ({ ...provider, secretConfigured: true }));
  }

  async configure(providerId: string | undefined, input: SystemAiProviderConfigInput, actorUserId: string) {
    const normalized = normalizeSystemAiProviderInput(input);
    const url = await validateProviderUrl(normalized.baseUrl);
    const existing = providerId ? await this.prisma.providerChannel.findUnique({ where: { id: providerId } }) : null;
    if (providerId && !existing) throw Object.assign(new Error('未找到要更新的系统 AI 供应商。'), { status: 404, code: 'VALIDATION_FAILED' });
    if (!existing && !normalized.apiKey) throw validationError('新增系统 AI 供应商时必须填写 API Key。');
    const encryptedSecret = normalized.apiKey ? this.vault.encrypt(normalized.apiKey) : existing!.encryptedSecret;

    const result = await this.prisma.$transaction(async tx => {
      const provider = existing
        ? await tx.providerChannel.update({ where: { id: existing.id }, data: providerData(normalized, url, encryptedSecret) })
        : await tx.providerChannel.create({ data: providerData(normalized, url, encryptedSecret) });

      if (existing) await tx.modelRoute.updateMany({ where: { providerId: provider.id, enabled: true }, data: { enabled: false } });
      for (const model of normalized.models) await upsertModelRoute(tx, provider.id, model);
      await tx.adminAuditLog.create({ data: {
        actorUserId,
        action: existing ? 'system_ai_provider.update' : 'system_ai_provider.create',
        targetType: 'provider',
        targetId: provider.id,
        requestId: crypto.randomUUID(),
        details: { name: provider.name, protocol: normalized.protocol, preset: normalized.preset, baseUrl: provider.baseUrl, models: normalized.models.map(item => item.modelName) },
      } });
      return tx.providerChannel.findUniqueOrThrow({ where: { id: provider.id }, include: { routes: { where: { enabled: true }, include: { model: true }, orderBy: { alias: 'asc' } } } });
    });
    const { encryptedSecret: _secret, ...provider } = result;
    return { ...provider, secretConfigured: true };
  }
}

function normalizeCustomModel(modelNameValue: unknown, displayNameValue: unknown): NormalizedModel {
  const modelName = String(modelNameValue || '').trim();
  if (!modelName || modelName.length > 160) throw validationError('自定义供应商必须填写有效的 Model Name。');
  const alias = modelName.toLowerCase().replace(/[^a-z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 64);
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/u.test(alias)) throw validationError('Model Name 无法生成有效的系统模型别名，请使用字母、数字、点、下划线或连字符。');
  const displayName = String(displayNameValue || modelName).trim().slice(0, 100) || modelName;
  return { alias, modelName, displayName };
}

function providerData(normalized: NormalizedSystemAiProviderConfig, url: URL, encryptedSecret: string) {
  return { name: normalized.name, kind: normalized.kind, baseUrl: url.toString(), encryptedSecret, enabled: normalized.enabled, timeoutMs: normalized.timeoutMs, maxConcurrency: normalized.maxConcurrency };
}

async function upsertModelRoute(tx: Prisma.TransactionClient, providerId: string, model: NormalizedModel) {
  await tx.logicalModel.upsert({
    where: { alias: model.alias },
    create: { alias: model.alias, displayName: model.displayName, description: 'LingBuilder 系统 AI 模型', contextWindow: 128_000, maxOutputTokens: 8_192, inputPointsPerMillion: 0n, cachedInputPointsPerMillion: 0n, outputPointsPerMillion: 0n },
    update: { displayName: model.displayName, enabled: true, etagVersion: { increment: 1 } },
  });
  const latest = await tx.modelRoute.aggregate({ where: { alias: model.alias }, _max: { version: true } });
  await tx.modelRoute.create({ data: { alias: model.alias, providerId, upstreamModel: model.modelName, version: (latest._max.version || 0) + 1, priority: 100, weight: 100, retryCount: 1 } });
}

function clampNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(Math.round(parsed), maximum)) : fallback;
}

function validationError(message: string) {
  return Object.assign(new Error(message), { status: 400, code: 'VALIDATION_FAILED' });
}
