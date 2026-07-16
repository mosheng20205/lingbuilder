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

test('designer state is isolated by project identity across unmounts and project switches', async () => {
  const designerSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  const diffSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/DiffViewer.tsx'), 'utf8');
  const sidebarSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/Sidebar.tsx'), 'utf8');
  assert.doesNotMatch(designerSource, /cachedInitialDesignerState/u);
  assert.match(designerSource, /nextState\.project\.id !== projectId/u);
  assert.match(designerSource, /project\.id !== projectId/u);
  assert.match(diffSource, /designer:\$\{textModelProjectId\}/u);
  assert.match(sidebarSource, /detail\.project\.id !== activeSolutionProjectId/u);
  assert.match(sidebarSource, /handleOpenDesignerWindow\(projectId, windowModel\)/u);
});
test('RC editor exposes load, editable entries, save and conflict errors',async()=>{ const source=await fs.readFile(path.resolve(import.meta.dirname,'../src/components/RcResourcePanel.tsx'),'utf8'); assert.match(source,/C\+\+ RC 资源编辑器/u); assert.match(source,/\/api\/resources\/rc/u); assert.match(source,/打开其他 \.rc/u); assert.match(source,/保存/u); assert.match(source,/role="alert"/u); });

test('designer exposes an ImageList resource editor and resource-backed control selector', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /项目 \/ 图像列表资源/u);
  assert.match(source, /每行一个工作区内图片路径/u);
  assert.match(source, /definition\.key === 'imageListId'/u);
  assert.match(source, /不使用图像列表/u);
});

test('designer uses structured collection editors instead of JSON array textareas', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /StructuredCollectionEditor/u);
  assert.match(source, /TreeNodeCollectionEditor/u);
  assert.match(source, /单元格（Tab 分隔）/u);
  assert.doesNotMatch(source, /请输入合法的 JSON 数组/u);
});

test('designer exposes dedicated ToolTip and PropertySheet resource editors', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /BehaviorResourceEditor/u);
  assert.match(source, /工具提示目标控件/u);
  assert.match(source, /添加属性页/u);
  assert.match(source, /属性页_显示/u);
  assert.match(source, /属性页控件模板窗口/u);
});
