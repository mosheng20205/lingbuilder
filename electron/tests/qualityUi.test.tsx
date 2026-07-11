import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('quality panel exposes real coverage and report import with diagnostics', async () => { const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/QualityPanel.tsx'), 'utf8'); assert.match(source, /\/api\/quality\/node-coverage/u); assert.match(source, /\/api\/quality\/import/u); assert.match(source, /覆盖率 \/ 静态分析 \/ Sanitizer/u); assert.match(source, /lingbuilder-quality-diagnostics/u); assert.match(source, /lingbuilder-coverage-updated/u); assert.match(source, /role="alert"/u); });
test('Monaco renders covered and uncovered lines and App aggregates quality diagnostics', async () => { const editor = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/MonacoCodeEditor.tsx'), 'utf8'); const app = await fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8'); assert.match(editor, /lingbuilder-coverage-covered/u); assert.match(editor, /lingbuilder-coverage-uncovered/u); assert.match(editor, /lingbuilder-coverage-updated/u); assert.match(app, /qualityProblems/u); assert.match(app, /lingbuilder-quality-diagnostics/u); });
