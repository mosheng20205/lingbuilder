import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('system AI account tokens stay in Electron safeStorage and streaming is cancellable', () => {
  const main = fs.readFileSync(new URL('../electron/main.ts', import.meta.url), 'utf8');
  const cloud = fs.readFileSync(new URL('../electron/cloudAccountService.ts', import.meta.url), 'utf8');
  const assistant = fs.readFileSync(new URL('../src/components/AiAssistant.tsx', import.meta.url), 'utf8');
  assert.match(main, /safeStorage\.encryptString/u);
  assert.match(main, /cloud-refresh-token\.bin/u);
  assert.doesNotMatch(assistant, /localStorage.*refresh/iu);
  assert.match(cloud, /AbortController/u);
  assert.match(assistant, /系统 AI/u);
  assert.match(assistant, /零保留/u);
});
