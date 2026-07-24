import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs/promises'; import path from 'node:path';
test('designer UI exposes multi-select, align/distribute, undo/redo and keyboard nudge',async()=>{ const source=await fs.readFile(path.resolve(import.meta.dirname,'../src/components/WpfDesigner.tsx'),'utf8'); assert.match(source,/selectedControlIds/u); assert.match(source,/event\.shiftKey \|\| event\.ctrlKey/u); assert.match(source,/align-left/u); assert.match(source,/distribute-horizontal/u); assert.match(source,/撤销设计操作/u); assert.match(source,/ArrowLeft/u); assert.match(source,/nudgeSelection/u); });

test('text box preview applies horizontal text alignment in real time', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /justifyContent: control\.properties\?\.textAlign === 'center'/u);
  assert.match(source, /textAlign: control\.properties\?\.textAlign === 'center'/u);
});

test('designer window surface and hierarchy root select window properties', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /selectOnlyControl\(null\);\s*setActiveInspectorTab\('properties'\)/u);
  assert.match(source, /selectedControlId === null \? \(\s*<WindowProperties/u);
  assert.match(source, /点击窗口或控件节点即可选中/u);
});

test('designer layout hierarchy supports drag reparenting onto containers and the window root', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /draggable/u);
  assert.match(source, /application\/x-lingbuilder-control-id/u);
  assert.match(source, /canDropOnParent/u);
  assert.match(source, /onReparentControl\(controlId, parentId(?:, containerSlot)?\)/u);
  assert.match(source, /拖动控件到窗口或容器节点可更换父级/u);
  assert.match(source, /WINDOW_ROOT_DROP_TARGET/u);
});

test('designer exposes the complete categorized window event registry instead of a Grid fallback', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /selectedControlId === null \? \(\s*<WindowEvents/u);
  assert.match(source, /WINDOW_EVENT_DEFINITIONS/u);
  assert.match(source, /WINDOW_EVENT_CATEGORIES/u);
  assert.match(source, /搜索窗口事件/u);
  assert.match(source, /仅显示已绑定事件/u);
  assert.match(source, /openEventCode\(definition\.name\)/u);
  assert.doesNotMatch(source, /const windowEventTarget: LingControl/u);
});

test('designer event cards open existing handlers or create missing bindings with one click', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  const appSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8');
  assert.match(source, /function ControlEvents\(\{[\s\S]*?windowModel/u);
  assert.match(source, /onClick=\{\(\) => openEventCode\(eventInfo\.name\)\}/u);
  assert.match(source, /\[eventName\]: handlerName/u);
  assert.match(source, /\{isBound \? '打开代码' : '生成并打开'\}/u);
  assert.match(source, /onClick=\{\(\) => openEventCode\(definition\.name\)\}/u);
  assert.doesNotMatch(source, /placeholder=\{`如: \$\{suggestedHandler\}`\}/u);
  assert.doesNotMatch(appSource, /editorExperienceMode === 'beginner' && nextContent !== currentContent/u);
  assert.match(appSource, /【事件代码】已自动生成 \$\{handlerName\}/u);
  assert.match(appSource, /lines\.push\('    结束'\)/u);
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

test('designer reports model-only edits as dirty without treating selection as a model edit', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /onProjectChange\?: \(state: PersistedWindowDesignerState\) => void/u);
  assert.match(source, /onDirtyChange\?: \(detail: WindowDesignerDirtyStateDetail\) => void/u);
  assert.match(source, /if \(previousProject === project\) return/u);
  assert.match(source, /notifyWindowDesignerDirtyStateChanged\(detail\)/u);
  assert.match(source, /suppressNextDirtySignalRef/u);
  assert.match(source, /if \(publishingDesignerStateRef\.current\) return/u);
});

test('designer uses menu-aware content coordinates and keeps source identity read-only', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /getDesignerWindowContentOffset\(activeWindow\)/u);
  assert.match(source, /top: `\$\{control\.y \+ contentOffset\}px`/u);
  assert.match(source, /hasDesignerWindowMenu\(activeWindow\)/u);
  assert.match(source, /<ReadOnlyTextField label="类名"/u);
  assert.match(source, /<ReadOnlyTextField label="文件名"/u);
  assert.match(source, /阻止单独重命名已绑定的 \.lcpp/u);
  assert.doesNotMatch(source, /TextField label="类名".*onChange=\{value => onChange\(\{ className: value \}\)\}/u);
});

test('beginner editor navigation, variable form and guidance tools remain safe and reachable', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/DiffViewer.tsx'), 'utf8');

  assert.match(source, /moveBeginnerEditorCaretToLine/u);
  assert.match(source, /input\.setSelectionRange\(caret, caret\)/u);
  assert.doesNotMatch(source, /input\.setSelectionRange\(start, end\)/u);
  assert.doesNotMatch(source, /onBlur=\{event => commitNewMemberDraft/u);
  assert.match(source, /onClick=\{commitNewMemberDraft\}/u);
  assert.match(source, /aria-label="取消新增变量"/u);
  assert.match(source, /onClick=\{\(\) => deleteStructuredRow\(row\)\}/u);
  assert.match(source, /\{renderBeginnerSummaryStrip\(\)\}/u);
  assert.match(source, /\{renderBeginnerPanel\(\)\}/u);
  assert.match(source, /事件动作、代码解释与 5 步学习路径/u);
});

test('workbench keeps split-editor ownership and designer persistence in the shared save lifecycle', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8');

  assert.match(source, /secondaryEditorRef/u);
  assert.match(source, /activeEditorGroupRef/u);
  assert.match(source, /updateEditorFileContent/u);
  assert.match(source, /WINDOW_DESIGNER_DIRTY_STATE_CHANGED/u);
  assert.match(source, /designerDirtyRef\.current/u);
  assert.match(source, /designerProject: designerDirtyRef\.current/u);
  assert.match(source, /getWorkbenchConfigurationMutationTarget/u);
  assert.match(source, /const workbenchProblems = useMemo/u);
  assert.equal((source.match(/problems=\{workbenchProblems\}/gu) || []).length, 2);
  assert.match(source, /saveWorkspaceCoreRef\.current\('自动保存', false\)/u);
  assert.doesNotMatch(source, /projectFilesReady, saveWorkspaceCore\]/u);
  assert.match(source, /const pendingFileChangePaths = new Set<string>\(\)/u);
  assert.match(source, /while \(!disposed && pendingFileChangePaths\.size > 0\)/u);
  assert.match(source, /inFlightSaveSnapshotsRef\.current\.delete\(saveEchoSnapshotId\)/u);
  assert.match(source, /updateTrackedFileVersion\(changedPath, nextVersion\)/u);
  assert.match(source, /不能只重命名源码文件/u);
});

test('native import and source reveal wait for mode changes and publish compiler diagnostics', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/DiffViewer.tsx'), 'utf8');

  assert.match(source, /latestSourceCodeRef\.current = result\.lcppSource/u);
  assert.match(source, /await onExperienceModeChange\?\.\('professional'\)/u);
  assert.match(source, /pendingNativeSourceReveal/u);
  assert.match(source, /if \(switched === false\) setPendingNativeSourceReveal\(null\)/u);
  assert.match(source, /editorExperienceMode !== 'beginner'/u);
  assert.match(source, /if \(!row\) return/u);
  assert.match(source, /lingbuilder-compiler-diagnostics/u);
  assert.match(source, /aria-pressed=\{editorExperienceMode === 'beginner'\}/u);
  assert.match(source, /aria-pressed=\{editorExperienceMode === 'professional'\}/u);
  assert.match(source, /aria-pressed=\{editorExperienceMode === 'native'\}/u);
});

test('bottom panel keeps tabs horizontally reachable on narrow workbench widths', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/BottomPanel.tsx'), 'utf8');

  assert.match(source, /flex min-w-0 flex-1 gap-1 h-full items-end overflow-x-auto/u);
  assert.match(source, /className=\{`flex shrink-0 items-center/u);
});
test('RC editor exposes load, editable entries, save and conflict errors',async()=>{ const source=await fs.readFile(path.resolve(import.meta.dirname,'../src/components/RcResourcePanel.tsx'),'utf8'); assert.match(source,/C\+\+ RC 资源编辑器/u); assert.match(source,/\/api\/resources\/rc/u); assert.match(source,/打开其他 \.rc/u); assert.match(source,/保存/u); assert.match(source,/role="alert"/u); });

test('designer exposes an ImageList resource editor and resource-backed control selector', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /项目 \/ 图像列表资源/u);
  assert.match(source, /每行一个工作区内图片路径/u);
  assert.match(source, /definition\.key === 'imageListId'/u);
  assert.match(source, /不使用图像列表/u);
});

test('image source property exposes a desktop picker and project-relative preview', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /aria-label="选择本地图片"/u);
  assert.match(source, /selectAndImportDesignerImage\(projectId\)/u);
  assert.match(source, /getDesignerImagePreviewSource\(projectId, control\.properties\.imageSource\)/u);
  assert.match(source, /已复制到 \$\{result\.relativePath\}/u);
});

test('designer uses structured collection editors instead of JSON array textareas', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /StructuredCollectionEditor/u);
  assert.match(source, /<TreeViewCollectionDialog/u);
  assert.match(source, /<ListViewCollectionDialog/u);
  assert.match(source, /编辑列/u);
  assert.match(source, /编辑数据/u);
  assert.match(source, /编辑节点/u);
  assert.doesNotMatch(source, /单元格（Tab 分隔）/u);
  assert.doesNotMatch(source, /请输入合法的 JSON 数组/u);
});

test('TreeView collection dialog manages roots, children, hierarchy and node order', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/TreeViewCollectionDialog.tsx'), 'utf8');
  assert.match(source, /添加根节点/u);
  assert.match(source, /添加子节点/u);
  assert.match(source, /复制节点/u);
  assert.match(source, /删除节点/u);
  assert.match(source, /父节点/u);
  assert.match(source, /moveTreeViewNode/u);
  assert.match(source, /role="dialog"/u);
  assert.match(source, /event\.key !== 'Escape'/u);
});

test('designer renders ListView columns and rows through a dedicated live preview', async () => {
  const designerSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  const previewSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/ListViewDesignerPreview.tsx'), 'utf8');
  assert.match(designerSource, /<ListViewDesignerPreview control=\{control\}/u);
  assert.match(previewSource, /data-list-view-preview="details"/u);
  assert.match(previewSource, /model\.columns/u);
  assert.match(previewSource, /model\.rows/u);
  assert.match(previewSource, /model\.gridLines/u);
  assert.match(previewSource, /model\.borderWidth/u);
  assert.match(previewSource, /model\.headerHeight/u);
  assert.match(previewSource, /model\.itemHeight/u);
});

test('designer renders TreeView nodes with a native-color live preview', async () => {
  const designerSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(designerSource, /<TreeViewDesignerPreview control=\{control\}/u);
  assert.match(designerSource, /control\.properties\?\.nodes/u);
  assert.match(designerSource, /control\.background === 'transparent' \? '#1E1E24'/u);
  assert.match(designerSource, /control\.properties\?\.checkBoxes/u);
  assert.match(designerSource, /control\.properties\?\.borderWidth/u);
  assert.match(designerSource, /control\.properties\?\.borderColor/u);
  assert.match(designerSource, /control\.properties\?\.nodeSpacing/u);
  assert.match(designerSource, /control\.properties\?\.nodePadding/u);
});

test('designer renders TabControl with a Win32-style tab strip and page surface', async () => {
  const designerSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  const previewSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/TabControlDesignerPreview.tsx'), 'utf8');
  assert.match(designerSource, /<TabControlDesignerPreview control=\{control\}/u);
  assert.match(previewSource, /data-tab-control-preview="win32"/u);
  assert.match(previewSource, /role="tablist"/u);
  assert.match(previewSource, /role="tabpanel"/u);
  assert.match(previewSource, /onSelectPage\?\.\(tab\.id\)/u);
  assert.match(designerSource, /页面 HWND/u);
  assert.match(designerSource, /onSelectTabPage\(node\.control\.id, page\.id\)/u);
  assert.match(designerSource, /containerSlot: selectedPage\?\.id/u);
  assert.match(designerSource, /isControlOnSelectedTab/u);
});

test('ListView collection dialog supports spreadsheet cells, batch paste and responsive row cards', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/ListViewCollectionDialog.tsx'), 'utf8');
  assert.match(source, /data-list-view-cell/u);
  assert.match(source, /event\.clipboardData\.getData\('text\/plain'\)/u);
  assert.match(source, /批量粘贴/u);
  assert.match(source, /替换全部行/u);
  assert.match(source, /追加到末尾/u);
  assert.match(source, /md:hidden/u);
  assert.match(source, /行 ID 由系统自动维护/u);
  assert.match(source, /第 \$\{index \+ 1\} 列对齐方式/u);
  assert.match(source, /function ColumnWidthInput/u);
  assert.match(source, /nextDraft\.trim\(\) === ''/u);
  assert.match(source, /onBlur=\{\(\) => commitDraft\(draft, true\)\}/u);
  assert.doesNotMatch(source, /value=\{column\.alignment\}\s+disabled/u);
  assert.doesNotMatch(source, /width: Math\.max\(24, Number\(event\.target\.value\) \|\| 24\)/u);
});

test('designer exposes dedicated ToolTip and PropertySheet resource editors', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /BehaviorResourceEditor/u);
  assert.match(source, /工具提示目标控件/u);
  assert.match(source, /添加属性页/u);
  assert.match(source, /属性页_显示/u);
  assert.match(source, /属性页控件模板窗口/u);
});

test('designer exposes persisted native window appearance instead of fixed chrome', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /标题栏颜色/u);
  assert.match(source, /标题文字颜色/u);
  assert.match(source, /窗口圆角/u);
  assert.match(source, /LingBuilder 内置图标/u);
  assert.match(source, /activeWindow\.titleBarBackground/u);
  assert.match(source, /activeWindow\.cornerStyle/u);
  assert.doesNotMatch(source, /className="relative rounded-lg shadow-2xl/u);
});
