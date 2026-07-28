import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs/promises'; import path from 'node:path';
test('designer UI exposes multi-select, align/distribute, undo/redo and keyboard nudge',async()=>{ const source=await fs.readFile(path.resolve(import.meta.dirname,'../src/components/WpfDesigner.tsx'),'utf8'); assert.match(source,/selectedControlIds/u); assert.match(source,/event\.shiftKey \|\| event\.ctrlKey/u); assert.match(source,/align-left/u); assert.match(source,/distribute-horizontal/u); assert.match(source,/撤销设计操作/u); assert.match(source,/ArrowLeft/u); assert.match(source,/nudgeSelection/u); });

test('designer hotkey property captures supported key combinations without triggering workbench shortcuts', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /definition\.type === 'hotkey'/u);
  assert.match(source, /captureDesignerHotKey\(event\)/u);
  assert.match(source, /event\.preventDefault\(\);\s*event\.stopPropagation\(\)/u);
  assert.match(source, /Backspace\/Delete 清空/u);
  assert.match(source, /readOnly/u);
});

test('generic designer preview does not retain its placeholder fill for transparent controls', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /control\.background === 'transparent' \? 'bg-transparent' : 'bg-sky-950\/15'/u);
});

test('text box preview applies horizontal text alignment in real time', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /justifyContent: control\.properties\?\.textAlign === 'center'/u);
  assert.match(source, /textAlign: control\.properties\?\.textAlign === 'center'/u);
});

test('designer window surface and hierarchy root select window properties', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /selectOnlyControl\(null\);\s*setActiveInspectorTab\('properties'\)/u);
  assert.match(source, /selectedControlId === null \? \(\s*<WindowProperties/u);
  assert.match(source, /Ctrl 多选、Shift 连选/u);
});

test('designer layout hierarchy supports drag reparenting onto containers and the window root', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /draggable/u);
  assert.match(source, /application\/x-lingbuilder-control-ids/u);
  assert.match(source, /canDropOnParent/u);
  assert.match(source, /onReparentControls\(controlIds, parentId, containerSlot\)/u);
  assert.match(source, /Ctrl 多选、Shift 连选/u);
  assert.match(source, /aria-multiselectable="true"/u);
  assert.match(source, /WINDOW_ROOT_DROP_TARGET/u);
});

test('designer tab page hierarchy nodes can independently collapse their controls', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /const pageExpanded = expandedIds\.has\(pageDropTargetId\)/u);
  assert.match(source, /toggleExpanded\(pageDropTargetId\)/u);
  assert.match(source, /aria-label=\{pageChildren\.length > 0 \? `\$\{pageExpanded \? '折叠' : '展开'\}\$\{page\.title\}`/u);
  assert.match(source, /pageExpanded && pageChildren\.map/u);
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
  assert.match(source, /onClick=\{\(\) => openEventCode\(eventInfo\.name, 'handlerPattern' in eventInfo/u);
  assert.match(source, /moduleControl\.events/u);
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
  assert.match(designerSource, /readWindowDesignerState\(projectId\)/u);
  assert.match(designerSource, /authoritativeProject\.id !== projectId/u);
  assert.match(diffSource, /designer:\$\{textModelProjectId\}/u);
  assert.match(diffSource, /authoritativeProject=\{designerProject\}/u);
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
  assert.match(source, /const suppressNextProjectPublishRef = useRef\(false\)/u);
  assert.match(source, /suppressNextProjectPublishRef\.current = true;\s+setProject\(nextState\.project\)/u);
  assert.match(source, /if \(suppressNextProjectPublishRef\.current\) \{\s+suppressNextProjectPublishRef\.current = false;\s+return;/u);
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

test('beginner editor navigation and variable form remain safe without a duplicate guidance sidebar', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/DiffViewer.tsx'), 'utf8');

  assert.match(source, /moveBeginnerEditorCaretToLine/u);
  assert.match(source, /input\.setSelectionRange\(caret, caret\)/u);
  assert.doesNotMatch(source, /input\.setSelectionRange\(start, end\)/u);
  assert.doesNotMatch(source, /onBlur=\{event => commitNewMemberDraft/u);
  assert.match(source, /onClick=\{commitNewMemberDraft\}/u);
  assert.match(source, /aria-label="取消新增变量"/u);
  assert.match(source, /onClick=\{\(\) => deleteStructuredRow\(row\)\}/u);
  assert.doesNotMatch(source, /新手工作台/u);
  assert.doesNotMatch(source, /renderBeginnerSummaryStrip/u);
  assert.doesNotMatch(source, /renderBeginnerPanel/u);
  assert.match(source, /className=\{`absolute z-30/u);
  assert.match(source, /onWheel=\{handleEditorFontWheel\}/u);
  assert.match(source, /wrap="off"/u);
  assert.match(source, /data-beginner-code-highlight/u);
  assert.match(source, /className="whitespace-pre"/u);
  assert.match(source, /lineHeight \* Math\.max\(bodyLines\.length, 1\) \+ 24/u);
  assert.ok(source.includes('[&::-webkit-scrollbar]:h-2'));
  assert.match(source, /codeHighlight\.scrollLeft = event\.currentTarget\.scrollLeft/u);
  assert.match(source, /behavior: 'auto'/u);
  assert.doesNotMatch(source, /behavior: 'smooth'/u);
  assert.match(source, /const handleBeginnerCodeBlur[\s\S]*?closeBeginnerCompletion\(target\);/u);
  assert.match(source, /const BEGINNER_CODE_OVERLAY_TOKEN_STYLE: React\.CSSProperties/u);
  assert.match(source, /fontWeight: 'inherit'/u);
  assert.match(source, /style=\{BEGINNER_CODE_OVERLAY_TOKEN_STYLE\}/u);
  assert.doesNotMatch(source, /'module-command':[^\n]*font-bold/u);
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

test('solution project context menu imports image resources through the command service', async () => {
  const sidebarSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/Sidebar.tsx'), 'utf8');
  const appSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8');

  assert.match(sidebarSource, /'添加资源…'/u);
  assert.match(sidebarSource, /handleAddProjectResource\(project\)/u);
  assert.match(sidebarSource, /图片资源 \(assets\)/u);
  assert.match(sidebarSource, /listDesignerImageResources\(projectId\)/u);
  assert.match(sidebarSource, /复制相对路径/u);
  assert.match(sidebarSource, /setResourcePreview\(\{ projectId: project\.id, resource \}\)/u);
  assert.match(sidebarSource, /ImageResourcePreviewDialog/u);
  assert.match(sidebarSource, /getDesignerImagePreviewSource\(projectId, resource\.relativePath\)/u);
  assert.match(sidebarSource, /正在载入图片/u);
  assert.match(sidebarSource, /图片无法预览/u);
  assert.match(sidebarSource, /正在选择并复制图片资源/u);
  assert.match(sidebarSource, /role="alert"/u);
  assert.match(appSource, /workbench\.action\.project\.addImageResource/u);
  assert.match(appSource, /workbench\.action\.project\.copyImageResourcePath/u);
  assert.match(appSource, /selectAndImportDesignerImage\(projectId\)/u);
  assert.match(appSource, /onAddProjectResource=\{handleAddProjectResource\}/u);
  assert.match(appSource, /onCopyProjectResourcePath=\{handleCopyProjectResourcePath\}/u);
});

test('designer uses structured collection editors instead of JSON array textareas', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /StructuredCollectionEditor/u);
  assert.match(source, /<TreeViewCollectionDialog/u);
  assert.match(source, /<ListViewCollectionDialog/u);
  assert.match(source, /<ToolbarButtonsDialog/u);
  assert.match(source, /<TabControlPagesDialog/u);
  assert.match(source, /编辑列/u);
  assert.match(source, /编辑数据/u);
  assert.match(source, /编辑节点/u);
  assert.match(source, /编辑按钮/u);
  assert.match(source, /编辑标签页/u);
  assert.doesNotMatch(source, /单元格（Tab 分隔）/u);
  assert.doesNotMatch(source, /请输入合法的 JSON 数组/u);
});

test('TabControl pages use a dedicated responsive dialog instead of inline property cards', async () => {
  const designerSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  const dialogSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/TabControlPagesDialog.tsx'), 'utf8');
  assert.match(designerSource, /tabPageCount/u);
  assert.match(designerSource, /setTabPagesEditorOpen\(true\)/u);
  assert.match(designerSource, /\{tabPageCount\} 个标签页/u);
  assert.match(dialogSource, /编辑标签页/u);
  assert.match(dialogSource, /新增第一个标签页/u);
  assert.match(dialogSource, /复制第/u);
  assert.match(dialogSource, /md:hidden/u);
  assert.match(dialogSource, /event\.key !== 'Escape'/u);
});

test('Toolbar button collection uses a dedicated responsive dialog instead of inline property cards', async () => {
  const designerSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  const dialogSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/ToolbarButtonsDialog.tsx'), 'utf8');
  assert.match(designerSource, /toolbarButtonCount/u);
  assert.match(designerSource, /setToolbarButtonsEditorOpen\(true\)/u);
  assert.match(designerSource, /\{toolbarButtonCount\} 个按钮/u);
  assert.match(dialogSource, /编辑工具栏按钮/u);
  assert.match(dialogSource, /新增第一个按钮/u);
  assert.match(dialogSource, /复制第/u);
  assert.match(dialogSource, /md:hidden/u);
  assert.match(dialogSource, /event\.key !== 'Escape'/u);
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
  assert.match(previewSource, /model\.columns\.map\(\(column, index\) =>/u);
  assert.match(previewSource, /<div key=\{index\} role="columnheader"/u);
  assert.doesNotMatch(previewSource, /key=\{`\$\{column\.title\}/u);
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
  assert.match(designerSource, /const useNewEmojiControlPreview = Boolean\(newEmojiPreviewKind\) && !isTabContainerControl\(control\)/u);
  assert.match(designerSource, /\{useNewEmojiControlPreview \? \(/u);
  assert.match(designerSource, /pointer-events-none absolute top-1/u);
  assert.match(designerSource, /style=\{\{ right: 'calc\(60% \+ 4px\)' \}\}/u);
  assert.match(previewSource, /data-tab-control-preview=\{newEmojiTabs \? 'new-emoji' : 'win32'\}/u);
  assert.match(previewSource, /data-tab-header-align=\{newEmojiTabs \? headerAlign : undefined\}/u);
  assert.match(previewSource, /justifyContent: headerTextJustifyContent/u);
  assert.match(previewSource, /Math\.max\(72, Math\.min\(152, control\.width \/ tabs\.length\)\)/u);
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
  assert.match(source, /useState\(\(\) => normalizeListViewColumns\(columnsValue\)\)/u);
  assert.match(source, /useState\(\(\) => normalizeListViewRows\(rowsValue\)\)/u);
  assert.match(source, /const publishChange = \(nextColumns/u);
  assert.match(source, /setColumns\(nextColumns\)/u);
  assert.match(source, /setRows\(nextRows\)/u);
  assert.match(source, /nextDraft\.trim\(\) === ''/u);
  assert.match(source, /onBlur=\{\(\) => commitDraft\(draft, true\)\}/u);
  assert.doesNotMatch(source, /value=\{column\.alignment\}\s+disabled/u);
  assert.doesNotMatch(source, /width: Math\.max\(24, Number\(event\.target\.value\) \|\| 24\)/u);
});

test('Header column collection reuses the responsive column dialog instead of inline property cards', async () => {
  const designerSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  const dialogSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/ListViewCollectionDialog.tsx'), 'utf8');
  assert.match(designerSource, /headerColumnCount/u);
  assert.match(designerSource, /setHeaderColumnsEditorOpen\(true\)/u);
  assert.match(designerSource, /columnOwner="header"/u);
  assert.match(designerSource, /\{headerColumnCount\} 列/u);
  assert.match(dialogSource, /编辑表头列/u);
  assert.match(dialogSource, /关闭表头列编辑器/u);
  assert.match(dialogSource, /更改会立即同步到中间设计画布和原生表头/u);
});

test('designer exposes FileDialog as a selectable control with properties and events', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /BehaviorResourceEditor/u);
  assert.match(source, /工具提示目标控件/u);
  assert.match(source, /添加属性页/u);
  assert.match(source, /属性页_显示/u);
  assert.match(source, /属性页控件模板窗口/u);
  assert.match(source, /文件对话框打开触发控件/u);
  assert.match(source, /文件对话框拖放目标/u);
  assert.match(source, /FileDialogProperties/u);
  assert.match(source, /FileDialogEvents/u);
  assert.match(source, /项目 \/ 附加行为/u);
  assert.doesNotMatch(source, /项目 \/ 非可视组件/u);
  assert.match(source, /文件已选择/u);
  assert.match(source, /文件被拖入/u);
  assert.match(source, /选择被取消/u);
  assert.match(source, /文件对话框占位/u);
  assert.match(source, /设计期非可视组件：单击编辑属性，拖拽移动占位/u);
  assert.match(source, /designerX/u);
  assert.match(source, /designerY/u);
  assert.match(source, /selectedResourceId/u);
  assert.match(source, /selectedControlId !== null && selectedResourceId !== null/u);
  assert.match(source, /dropTargetId: event\.target\.value, allowDrop: true/u);
  assert.match(source, /FILE_DIALOG_FILTER_PRESETS/u);
  assert.match(source, /文件类型/u);
  assert.match(source, /图片文件/u);
  assert.match(source, /自定义文件扩展名/u);
  assert.match(source, /高级：原始筛选规则/u);
  assert.match(source, /用逗号分隔/u);
  assert.match(source, /selectAndImportDesignerAnimation/u);
  assert.match(source, /选择本地 AVI 动画/u);
  assert.match(source, /min-w-0 w-full space-y-1/u);
  assert.match(source, /flex min-w-0 w-full gap-1/u);
});

test('designer exposes ContextMenu and PopupMenu as editable non-visual controls', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /'ContextMenu'/u);
  assert.match(source, /'PopupMenu'/u);
  assert.match(source, /MenuResourceProperties/u);
  assert.match(source, /MenuResourceEvents/u);
  assert.match(source, /上下文菜单右键目标/u);
  assert.match(source, /新增菜单项/u);
  assert.match(source, /新增分隔线/u);
  assert.match(source, /上下文菜单_显示/u);
  assert.match(source, /弹出菜单_在坐标显示/u);
});

test('designer exposes persisted native window appearance instead of fixed chrome', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /标题栏颜色/u);
  assert.match(source, /标题文字颜色/u);
  assert.match(source, /窗口圆角/u);
  assert.match(source, /LingBuilder 内置图标/u);
  assert.match(source, /自定义图标/u);
  assert.match(source, /选择自定义窗口图标/u);
  assert.match(source, /activeWindow\.iconPath/u);
  assert.match(source, /activeWindow\.titleBarBackground/u);
  assert.match(source, /activeWindow\.cornerStyle/u);
  assert.doesNotMatch(source, /className="relative rounded-lg shadow-2xl/u);
});

test('designer toolbox exposes searchable accessible control groups', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /搜索全部控件分组/u);
  assert.match(source, /aria-expanded=\{expanded\}/u);
  assert.match(source, /createControlToolboxGroups/u);
  assert.match(source, /没有找到/u);
  assert.doesNotMatch(source, />高级<\/span>/u);
});

test('designer pointer interactions cannot remain active after the primary mouse button is released', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  assert.match(source, /window\.addEventListener\('mouseup', handlePointerFinished\)/u);
  assert.match(source, /window\.addEventListener\('blur', handlePointerFinished\)/u);
  assert.match(source, /\(event\.buttons & 1\) === 0/u);
  assert.match(source, /initialControlPos\.y \+ \(event\.clientY - initialPos\.y\) \/ canvasScale/u);
  assert.doesNotMatch(source, /setDragOffset/u);
});

test('designer control resize previews at animation-frame cadence and commits the project only on finish', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8');
  const pointerMoveStart = source.indexOf('const handleMouseMove = (event: MouseEvent) => {', source.indexOf('const handlePointerFinished'));
  const pointerMoveEnd = source.indexOf("if (!draggingResourceId) return;", pointerMoveStart);
  const pointerMoveSource = source.slice(pointerMoveStart, pointerMoveEnd);
  assert.ok(pointerMoveStart >= 0 && pointerMoveEnd > pointerMoveStart);
  assert.match(pointerMoveSource, /scheduleControlInteractionPreview/u);
  assert.doesNotMatch(pointerMoveSource, /updateSelectedControl\(/u);
  assert.match(source, /window\.requestAnimationFrame/u);
  assert.match(source, /const finishPointerInteraction = useCallback/u);
  assert.match(source, /controls: reconcileRebarBands\(updateControlWithDescendants\(window\.controls, preview\.controlId, preview\.fields\)\)/u);
  assert.match(source, /style=\{\{ contain: 'layout paint' \}\}/u);
});
