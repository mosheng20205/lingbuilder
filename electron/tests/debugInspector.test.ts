import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('debug inspector exposes real threads, stack frames, scopes, variable expansion and watch evaluation', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/DebugInspector.tsx'), 'utf8');
  assert.match(source, /aria-label="线程列表"/u); assert.match(source, /aria-label="调用堆栈"/u);
  assert.match(source, /aria-label="局部变量和监视"/u); assert.match(source, /\/api\/debug\/inspection/u);
  assert.match(source, /\/api\/debug\/variables/u); assert.match(source, /\/api\/debug\/evaluate/u);
  assert.match(source, /输入监视表达式/u); assert.match(source, /VariableRow/u);
  assert.match(source, /runAdvanced\('attach'\)/u); assert.match(source, /runAdvanced\('dump'\)/u); assert.match(source, /runAdvanced\('remote'\)/u);
  assert.match(source, /inspectAdvanced\('registers'\)/u); assert.match(source, /inspectAdvanced\('memory'\)/u); assert.match(source, /inspectAdvanced\('disassembly'\)/u);
});

test('bottom panel no longer contains simulated WPF locals or fake debugger ports', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/BottomPanel.tsx'), 'utf8');
  assert.doesNotMatch(source, /wpfLocals|WPF 宿主底层托管类型|端口: 3000/u);
  assert.match(source, /<DebugInspector/u);
});
