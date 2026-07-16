import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('test explorer UI exposes discovery, filters, run, debug and structured results', async () => { const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/TestExplorer.tsx'), 'utf8'); assert.match(source, /测试资源管理器/u); assert.match(source, /\/api\/tests\/discover/u); assert.match(source, /\/api\/tests\/run/u); assert.match(source, /\/api\/tests\/debug/u); assert.match(source, /筛选测试/u); assert.match(source, /C\+\+ \/ CTest/u); assert.match(source, /测试结果/u); assert.match(source, /role="alert"/u); });
test('bottom panel has a reachable tests tab', async () => { const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/BottomPanel.tsx'), 'utf8'); assert.match(source, /onActiveTabChange\('tests'\)/u); assert.match(source, /<TestExplorer/u); });

test('bottom panel keeps only operational workbench tabs and hides code mapping for LingCpp', async () => {
  const [bottomPanel, app, diffViewer] = await Promise.all([
    fs.readFile(path.resolve(import.meta.dirname, '../src/components/BottomPanel.tsx'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../src/components/DiffViewer.tsx'), 'utf8')
  ]);

  assert.doesNotMatch(bottomPanel, /onActiveTabChange\('designer_(?:xml|cpp|manifest|logs)'\)/u);
  assert.match(bottomPanel, /showCodeMapping && activeTab === 'extracted'/u);
  assert.match(app, /showCodeMapping=\{activeFile\.language !== 'lingcpp'\}/u);
  assert.match(diffViewer, /designerTabLabel/u);
  assert.match(diffViewer, /打开窗口设计器：\$\{designerTabLabel\}/u);
});
