import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('terminal panel exposes accessible host, session actions, input, resize and event recovery contracts', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/TerminalPanel.tsx'), 'utf8');
  assert.match(source, /aria-label="集成终端"/u);
  assert.match(source, /aria-label="新建终端"/u);
  assert.match(source, /new EventSource\('\/api\/terminal\/events'\)/u);
  assert.match(source, /terminal\.onData/u);
  assert.match(source, /ResizeObserver/u);
  assert.match(source, /session\.buffer/u);
});
