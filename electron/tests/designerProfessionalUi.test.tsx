import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs/promises'; import path from 'node:path';
test('designer UI exposes multi-select, align/distribute, undo/redo and keyboard nudge',async()=>{ const source=await fs.readFile(path.resolve(import.meta.dirname,'../src/components/WpfDesigner.tsx'),'utf8'); assert.match(source,/selectedControlIds/u); assert.match(source,/event\.shiftKey \|\| event\.ctrlKey/u); assert.match(source,/align-left/u); assert.match(source,/distribute-horizontal/u); assert.match(source,/撤销设计操作/u); assert.match(source,/ArrowLeft/u); assert.match(source,/nudgeSelection/u); });

test('designer window surface and hierarchy root select window properties', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /selectOnlyControl\(null\);\s*setActiveInspectorTab\('properties'\)/u);
  assert.match(source, /selectedControlId === null \? \(\s*<WindowProperties/u);
  assert.match(source, /点击窗口或控件节点即可选中/u);
});

test('designer exposes the selected window created event instead of the control empty state', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /selectedControlId === null \? \(\s*<WindowEvents/u);
  assert.match(source, /window\.events\?\.Loaded\?\.trim\(\) \|\| `_\$\{window\.className\}_创建完毕`/u);
});
test('RC editor exposes load, editable entries, save and conflict errors',async()=>{ const source=await fs.readFile(path.resolve(import.meta.dirname,'../src/components/RcResourcePanel.tsx'),'utf8'); assert.match(source,/C\+\+ RC 资源编辑器/u); assert.match(source,/\/api\/resources\/rc/u); assert.match(source,/打开其他 \.rc/u); assert.match(source,/保存/u); assert.match(source,/role="alert"/u); });
