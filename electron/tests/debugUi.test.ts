import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('workbench exposes native debug start, continue, step and stop controls with Chinese status', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8');
  assert.match(source, /开始原生调试/u); assert.match(source, /handleDebugControl\('continue'\)/u);
  assert.match(source, /handleDebugControl\('next'\)/u); assert.match(source, /handleDebugControl\('step-in'\)/u);
  assert.match(source, /handleDebugControl\('step-out'\)/u); assert.match(source, /\/api\/debug\/stop/u);
  assert.match(source, /输入条件断点表达式/u); assert.match(source, /new EventSource\('\/api\/debug\/events'\)/u);
});

test('Monaco uses the glyph margin for ordinary and Shift conditional breakpoint gestures', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/MonacoCodeEditor.tsx'), 'utf8');
  assert.match(source, /GUTTER_GLYPH_MARGIN/u); assert.match(source, /conditionRequested/u);
  assert.match(source, /lingbuilder-debug-breakpoint-toggle/u); assert.match(source, /lingbuilder-debug-breakpoint::before/u);
  assert.match(source, /glyphMargin:\s*true/u);
});
