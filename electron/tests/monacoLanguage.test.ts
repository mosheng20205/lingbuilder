import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { mapWorkbenchLanguageToMonaco } from '../src/services/textModel/monacoLanguage';

test('workbench language aliases map to the locally bundled Monaco languages', () => {
  assert.equal(mapWorkbenchLanguageToMonaco('cpp'), 'cpp');
  assert.equal(mapWorkbenchLanguageToMonaco('header'), 'cpp');
  assert.equal(mapWorkbenchLanguageToMonaco('h'), 'cpp');
  assert.equal(mapWorkbenchLanguageToMonaco('resource'), 'ini');
  assert.equal(mapWorkbenchLanguageToMonaco('rc'), 'ini');
  assert.equal(mapWorkbenchLanguageToMonaco('ini'), 'ini');
  assert.equal(mapWorkbenchLanguageToMonaco('lingcpp'), 'lingcpp');
  assert.equal(mapWorkbenchLanguageToMonaco('lcpp'), 'lingcpp');
  assert.equal(mapWorkbenchLanguageToMonaco('epl'), 'epl');
  assert.equal(mapWorkbenchLanguageToMonaco('unknown'), 'plaintext');
});

test('standalone Monaco optional workspace symbol API is capability-guarded', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/MonacoCodeEditor.tsx'), 'utf8');
  const devScript = await fs.readFile(path.resolve(import.meta.dirname, '../scripts/dev.cjs'), 'utf8');
  assert.match(source, /typeof registerWorkspaceSymbolProvider === 'function'/u);
  assert.doesNotMatch(source, /monaco\.languages\.registerWorkspaceSymbolProvider\s*\(/u);
  assert.match(devScript, /assertPortAvailable/u);
  assert.match(devScript, /请先关闭旧的 npm run dev 窗口/u);
  assert.match(devScript, /exclusive: true/u);
});
