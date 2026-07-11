import assert from 'node:assert/strict';
import test from 'node:test';
import type { AiStreamEvent, PromotionPolicy } from '../src/index.ts';

test('shared SSE events retain discriminated event shapes', () => {
  const event: AiStreamEvent = { type: 'delta', requestId: 'request-1', text: '你好' };
  assert.equal(event.type, 'delta');
});

test('free-window policy carries timezone and caps', () => {
  const policy: PromotionPolicy = { id: 'p1', name: '免费日', kind: 'free_window', startsAt: '2026-07-12T00:00:00+08:00', endsAt: '2026-07-13T00:00:00+08:00', timezone: 'Asia/Shanghai', perUserListPriceCap: '10000', perUserRequestCap: 100, modelAliases: [], enabled: true };
  assert.equal(policy.timezone, 'Asia/Shanghai');
});
