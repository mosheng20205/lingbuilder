import { Inject, Injectable } from '@nestjs/common';
import type { AiMessage } from '@lingbuilder/contracts';
import type { ModelRoute, ProviderChannel } from '@prisma/client';
import { SecretVaultService } from '../security/secret-vault.service.js';
import { validateProviderUrl } from '../security/network-policy.js';
import { estimateMessageTokens, estimateTextTokens } from './usage-estimator.js';

export interface ProviderUsage { inputTokens: number; cachedInputTokens: number; outputTokens: number; estimated: boolean }
export interface ProviderStreamResult { text: string; reasoningText?: string; usage: ProviderUsage }
export interface ProviderStreamChunk { delta?: string; reasoningDelta?: string; final?: ProviderStreamResult }

@Injectable()
export class ProviderService {
  constructor(@Inject(SecretVaultService) private readonly vault: SecretVaultService) {}
  async *stream(provider: ProviderChannel, route: ModelRoute, messages: AiMessage[], maxOutputTokens: number, signal: AbortSignal): AsyncGenerator<ProviderStreamChunk> {
    const base = await validateProviderUrl(provider.baseUrl); const secret = this.vault.decrypt(provider.encryptedSecret);
    const timeout = AbortSignal.timeout(Math.max(1_000, Math.min(provider.timeoutMs, 120_000))); const combined = AbortSignal.any([signal, timeout]);
    if (provider.kind === 'ANTHROPIC') return yield* this.streamAnthropic(base, secret, route.upstreamModel, messages, maxOutputTokens, combined);
    if (provider.kind === 'GEMINI') return yield* this.streamGemini(base, secret, route.upstreamModel, messages, maxOutputTokens, combined);
    return yield* this.streamOpenAi(base, secret, route.upstreamModel, messages, maxOutputTokens, combined);
  }

  private async *streamOpenAi(base: URL, secret: string, model: string, messages: AiMessage[], maxOutputTokens: number, signal: AbortSignal): AsyncGenerator<any> {
    const response = await fetch(new URL('chat/completions', ensureSlash(base)), { method: 'POST', signal, headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json', accept: 'text/event-stream' }, body: JSON.stringify({ model, messages, max_tokens: maxOutputTokens, stream: true, stream_options: { include_usage: true } }) });
    if (!response.ok || !response.body) throw new Error(`OpenAI-compatible provider failed (${response.status})`);
    let text = ''; let reasoningText = ''; let usage: ProviderUsage | undefined;
    for await (const data of parseSse(response.body)) {
      if (data === '[DONE]') continue;
      const json = JSON.parse(data); const deltas = extractOpenAiDeltas(json);
      if (deltas.reasoning) { reasoningText += deltas.reasoning; yield { reasoningDelta: deltas.reasoning }; }
      if (deltas.content) { text += deltas.content; yield { delta: deltas.content }; }
      if (json.usage) usage = { inputTokens: Number(json.usage.prompt_tokens || 0), cachedInputTokens: Number(json.usage.prompt_tokens_details?.cached_tokens || 0), outputTokens: Number(json.usage.completion_tokens || 0), estimated: false };
    }
    yield { final: { text, reasoningText, usage: usage || estimateUsage(messages, text || reasoningText) } };
  }
  private async *streamAnthropic(base: URL, secret: string, model: string, messages: AiMessage[], maxOutputTokens: number, signal: AbortSignal): AsyncGenerator<any> {
    const system = messages.filter(item => item.role === 'system').map(item => item.content).join('\n\n'); const conversation = messages.filter(item => item.role !== 'system');
    const response = await fetch(new URL('messages', ensureSlash(base)), { method: 'POST', signal, headers: { 'x-api-key': secret, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', accept: 'text/event-stream' }, body: JSON.stringify({ model, system, messages: conversation, max_tokens: maxOutputTokens, stream: true }) });
    if (!response.ok || !response.body) throw new Error(`Anthropic provider failed (${response.status})`);
    let text = ''; let inputTokens = 0; let outputTokens = 0;
    for await (const data of parseSse(response.body)) { const json = JSON.parse(data); if (json.type === 'message_start') inputTokens = Number(json.message?.usage?.input_tokens || 0); if (json.type === 'content_block_delta') { const delta = json.delta?.text || ''; if (delta) { text += delta; yield { delta }; } } if (json.type === 'message_delta') outputTokens = Number(json.usage?.output_tokens || 0); }
    yield { final: { text, usage: inputTokens || outputTokens ? { inputTokens, cachedInputTokens: 0, outputTokens, estimated: false } : estimateUsage(messages, text) } };
  }
  private async *streamGemini(base: URL, secret: string, model: string, messages: AiMessage[], maxOutputTokens: number, signal: AbortSignal): AsyncGenerator<any> {
    const system = messages.filter(item => item.role === 'system').map(item => item.content).join('\n\n'); const contents = messages.filter(item => item.role !== 'system').map(item => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] }));
    const endpoint = new URL(`v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, ensureSlash(base));
    const response = await fetch(endpoint, { method: 'POST', signal, headers: { 'x-goog-api-key': secret, 'content-type': 'application/json', accept: 'text/event-stream' }, body: JSON.stringify({ systemInstruction: system ? { parts: [{ text: system }] } : undefined, contents, generationConfig: { maxOutputTokens } }) });
    if (!response.ok || !response.body) throw new Error(`Gemini provider failed (${response.status})`);
    let text = ''; let usage: ProviderUsage | undefined;
    for await (const data of parseSse(response.body)) { const json = JSON.parse(data); const delta = json.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') || ''; if (delta) { text += delta; yield { delta }; } if (json.usageMetadata) usage = { inputTokens: Number(json.usageMetadata.promptTokenCount || 0), cachedInputTokens: Number(json.usageMetadata.cachedContentTokenCount || 0), outputTokens: Number(json.usageMetadata.candidatesTokenCount || 0), estimated: false }; }
    yield { final: { text, usage: usage || estimateUsage(messages, text) } };
  }
}

function ensureSlash(url: URL) { const copy = new URL(url); if (!copy.pathname.endsWith('/')) copy.pathname += '/'; return copy; }
export function extractOpenAiDeltas(value: any): { content: string; reasoning: string } {
  const delta = value?.choices?.[0]?.delta;
  return { content: typeof delta?.content === 'string' ? delta.content : '', reasoning: typeof delta?.reasoning_content === 'string' ? delta.reasoning_content : '' };
}
async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> { const reader = stream.getReader(); const decoder = new TextDecoder(); let buffer = ''; try { while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const events = buffer.split(/\r?\n\r?\n/u); buffer = events.pop() || ''; for (const event of events) { const data = event.split(/\r?\n/u).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n'); if (data) yield data; } } } finally { reader.releaseLock(); } }
function estimateUsage(messages: AiMessage[], text: string): ProviderUsage { return { inputTokens: estimateMessageTokens(messages), cachedInputTokens: 0, outputTokens: estimateTextTokens(text), estimated: true }; }
