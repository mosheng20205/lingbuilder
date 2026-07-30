import assert from 'node:assert/strict';
import test from 'node:test';
import { BillingService } from '../src/billing/billing.service.js';
import { AiController } from '../src/ai/ai.controller.js';
import { AiService } from '../src/ai/ai.service.js';
import { estimateCancellationUsage } from '../src/ai/usage-estimator.js';
import { extractOpenAiDeltas } from '../src/ai/provider.service.js';
import { DEEPSEEK_V4_MODELS, normalizeSystemAiProviderInput } from '../src/ai/system-ai-provider.service.js';
import { isPrivateAddress, validateProviderUrl } from '../src/security/network-policy.js';
import { SecretVaultService } from '../src/security/secret-vault.service.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
process.env.REDIS_URL = 'redis://127.0.0.1:6389';

test('billing rounds fractional model points upward using bigint', () => {
  const billing = new BillingService({} as never);
  assert.equal(billing.calculatePoints(1, 0, 0, { input: 1n, cached: 0n, output: 0n }), 1n);
  assert.equal(billing.calculatePoints(1_000_000, 0, 500_000, { input: 2n, cached: 0n, output: 4n }), 4n);
});

test('provider policy rejects private and non-HTTPS endpoints', async () => {
  assert.equal(isPrivateAddress('127.0.0.1'), true);
  assert.equal(isPrivateAddress('192.168.1.2'), true);
  await assert.rejects(() => validateProviderUrl('http://8.8.8.8/v1'), /HTTPS/u);
  await assert.rejects(() => validateProviderUrl('https://127.0.0.1/v1'), /私有/u);
  assert.equal((await validateProviderUrl('https://8.8.8.8/v1')).protocol, 'https:');
});

test('secret vault encrypts with random authenticated ciphertext', () => {
  const vault = new SecretVaultService(); const first = vault.encrypt('provider-secret'); const second = vault.encrypt('provider-secret');
  assert.notEqual(first, second); assert.equal(vault.decrypt(first), 'provider-secret');
});

test('OpenAI-compatible reasoning deltas are kept separate from answer content', () => {
  assert.deepEqual(extractOpenAiDeltas({ choices: [{ delta: { reasoning_content: '推理', content: '答案' } }] }), { reasoning: '推理', content: '答案' });
  assert.deepEqual(extractOpenAiDeltas({ choices: [{ delta: {} }] }), { reasoning: '', content: '' });
});

test('system AI provider presets create both requested DeepSeek V4 model routes', () => {
  const value = normalizeSystemAiProviderInput({ name: 'DeepSeek', preset: 'deepseek-v4', protocol: 'openai-compatible', baseUrl: 'https://api.deepseek.com', apiKey: 'secret' });
  assert.deepEqual(value.models.map(model => model.modelName), DEEPSEEK_V4_MODELS.map(model => model.modelName));
  assert.equal(value.kind, 'OPENAI_COMPATIBLE');
  assert.throws(() => normalizeSystemAiProviderInput({ name: 'DeepSeek', preset: 'deepseek-v4', protocol: 'anthropic', baseUrl: 'https://api.deepseek.com', apiKey: 'secret' }), /OpenAI/u);
});

test('custom system AI providers accept OpenAI and Anthropic protocols with model names', () => {
  const openAi = normalizeSystemAiProviderInput({ name: '自定义 OpenAI', preset: 'custom', protocol: 'openai-compatible', baseUrl: 'https://ai.example.com/v1', apiKey: 'secret', modelName: 'vendor/model-v1' });
  const anthropic = normalizeSystemAiProviderInput({ name: '自定义 Anthropic', preset: 'custom', protocol: 'anthropic', baseUrl: 'https://ai.example.com', apiKey: 'secret', modelName: 'claude-custom' });
  assert.equal(openAi.models[0]?.modelName, 'vendor/model-v1');
  assert.equal(openAi.models[0]?.alias, 'vendor-model-v1');
  assert.equal(anthropic.kind, 'ANTHROPIC');
  assert.throws(() => normalizeSystemAiProviderInput({ name: '缺少模型', preset: 'custom', protocol: 'openai-compatible', baseUrl: 'https://ai.example.com', apiKey: 'secret' }), /Model Name/u);
});

test('system AI model catalog only exposes models with an enabled provider route', async () => {
  let query: any;
  const prisma = { logicalModel: { findMany: async (value: any) => { query = value; return []; } } };
  const service = new AiService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  await service.models();
  assert.equal(query.where.routes.some.enabled, true);
  assert.equal(query.where.routes.some.provider.enabled, true);
});

test('cancel estimation includes the injected rulebook and streamed output', () => {
  const usage = estimateCancellationUsage([
    { role: 'system', content: '规则'.repeat(4_000) },
    { role: 'user', content: '问题'.repeat(20) }
  ], '回复'.repeat(8));
  assert.equal(usage.inputTokens, 8_040);
  assert.equal(usage.outputTokens, 16);
});

test('AI controller rejects duplicate idempotency before committing SSE headers', async () => {
  let responseTouched = false;
  const conflict = Object.assign(new Error('该幂等请求已存在。'), { status: 409, code: 'IDEMPOTENCY_CONFLICT' });
  const controller = new AiController({ prepare: async () => { throw conflict; } } as never);
  const response = new Proxy({}, { get() { responseTouched = true; return () => response; } });
  await assert.rejects(() => controller.chat({ id: 'u1', email: 'u@example.com', mfa: false }, 'duplicate', { modelAlias: 'standard', rulebookVersion: 'test', messages: [{ role: 'user', content: 'hi' }] }, response as never), error => error === conflict);
  assert.equal(responseTouched, false);
});
