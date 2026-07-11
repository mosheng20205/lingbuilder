import type { AiMessage } from '@lingbuilder/contracts';

const WIDE_TOKEN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

export function estimateTextTokens(text: string): number {
  let wide = 0; let compact = 0;
  for (const character of text) {
    if (WIDE_TOKEN.test(character) || character.codePointAt(0)! > 0xffff) wide += 1;
    else compact += 1;
  }
  return wide + Math.ceil(compact / 4);
}

export function estimateMessageTokens(messages: AiMessage[]): number {
  return messages.reduce((sum, item) => sum + estimateTextTokens(item.content), 0);
}

export function estimateCancellationUsage(messages: AiMessage[], streamedText: string) {
  return { inputTokens: estimateMessageTokens(messages), outputTokens: Math.max(1, estimateTextTokens(streamedText)) };
}
