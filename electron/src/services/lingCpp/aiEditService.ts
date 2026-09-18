import {
  AppliedWorkspaceFile,
  LingCppEditContext,
  LingCppEditDraft,
  LingCppEditDraftFile,
  LingCppWorkspaceFile,
  WorkspaceEditChange,
  WorkspaceEditProposal,
  WorkspaceEditRange
} from './types';
import type { LingWindowProject } from '../windowDesigner/types';
import type { LingCppModuleContext } from '../modules/types';
import { WIN32_CONTROL_DEFINITIONS } from '../windowDesigner/win32ControlRegistry';

const PROPOSAL_TTL_MS = 30 * 60_000;
const MAX_PROPOSALS = 100;
const proposalStore = new Map<string, { proposal: WorkspaceEditProposal; expiresAt: number }>();

export function proposeLingCppEdit(context: LingCppEditContext, draft: LingCppEditDraft = {}): WorkspaceEditProposal {
  const now = new Date().toISOString();
  const workspaceFiles = resolveWorkspaceFiles(context);
  const draftFiles = resolveDraftFiles(context, draft);
  let changes = draftFiles
    .map(fileDraft => createChangeForDraftFile(fileDraft, workspaceFiles, context))
    .filter((change): change is WorkspaceEditChange => Boolean(change));

  if (changes.length === 0) {
    const sourceCode = normalizeLineEndings(context.sourceCode);
    const fallbackRange = context.selection || createFullDocumentRange(sourceCode);
    const updatedSource = buildLocalUpdatedSource({ ...context, sourceCode });
    changes = [
      createWorkspaceEditChangeFromRewrite(context.filePath, sourceCode, updatedSource, fallbackRange)
    ];
  }

  const allowedDesignerControlTypes = getAllowedDesignerControlTypes(context);
  if (draft.designerProject) {
    // 模型常把「编辑框」写成 Edit/Input 等同义词；先做一次保守归一化，
    // 归一化不掉的未知类型仍由 validateDesignerProjectEdit 中文阻断。
    normalizeDesignerControlTypes(draft.designerProject, allowedDesignerControlTypes);
  }
  let designerProject = draft.designerProject
    ? validateDesignerProjectEdit(context.designerProject, draft.designerProject, {
      allowDeletion: /删除|移除|去掉|清除/u.test(context.instruction),
      allowedControlTypes: allowedDesignerControlTypes
    })
    : undefined;
  if (context.projectId && context.designerProject && context.designerProject.id !== context.projectId) {
    throw new Error(`当前项目 ${context.projectId} 的设计器模型 ID 为 ${context.designerProject.id}，项目与模型不匹配；请重新载入该项目后再请求 AI 修改。`);
  }
  if (context.projectId && designerProject && designerProject.id !== context.projectId) {
    throw new Error(`AI 返回了项目 ${designerProject.id} 的设计器模型，但当前项目是 ${context.projectId}；已阻止跨项目应用。`);
  }
  const strictDesignerEdit = context.designerEditPolicy !== 'caller-draft';
  if (strictDesignerEdit && context.designerProject && isDesignerEditInstruction(context.instruction) && !designerProject) {
    if (isDesignerBeautificationInstruction(context.instruction)) {
      // 宽泛的视觉请求必须始终产出可预览的布局提案，即使模型没有返回
      // designerProject（例如未配置 API Key 或系统 AI 草稿不完整）。
      designerProject = validateDesignerProjectEdit(
        context.designerProject,
        createDesignerBeautificationFallback(context.designerProject),
        { allowedControlTypes: getAllowedDesignerControlTypes(context) }
      );
    } else {
      throw new Error('本次需求涉及窗口或控件布局，但 AI 未返回完整设计器模型；为避免源码与界面不一致，提案未创建。');
    }
  }
  if (strictDesignerEdit && context.designerProject && designerProject && isDesignerEditInstruction(context.instruction)
    && areDesignerProjectsEquivalent(designerProject, context.designerProject)) {
    if (isDesignerBeautificationInstruction(context.instruction)) {
      designerProject = validateDesignerProjectEdit(
        context.designerProject,
        createDesignerBeautificationFallback(context.designerProject),
        { allowedControlTypes: getAllowedDesignerControlTypes(context) }
      );
    } else {
      throw new Error('AI 返回的设计器模型与当前模型完全相同，未产生可应用的布局变化；请明确要调整的颜色、间距、尺寸或控件位置后重试。');
    }
  }

  const proposal: WorkspaceEditProposal = {
    id: `lingcpp-edit-${globalThis.crypto.randomUUID()}`,
    title: 'AI 中文 C++ 编辑预览',
    summary: draft.summary?.trim() || context.instruction.trim() || '根据当前上下文生成中文 C++ 编辑建议',
    createdAt: now,
    explanation: draft.explanation?.trim() || '该提案只生成可预览的 WorkspaceEdit；调用方确认后才会应用到文件。',
    changes,
    ...(designerProject ? {
      designerProject,
      designerProjectOriginal: cloneDesignerProject(context.designerProjectDiskBaseline ?? context.designerProject),
      designerAllowedControlTypes: [...allowedDesignerControlTypes]
    } : {})
  };

  purgeExpiredProposals();
  while (proposalStore.size >= MAX_PROPOSALS) proposalStore.delete(proposalStore.keys().next().value as string);
  proposalStore.set(proposal.id, { proposal, expiresAt: Date.now() + PROPOSAL_TTL_MS });
  return proposal;
}

/**
 * 校验 AI 返回的完整设计器模型。设计器模型不是普通工作区文本，必须在
 * WorkspaceEdit 入库前检查引用、数值和控件语义，避免一次确认覆盖掉整个窗口。
 */
export function validateDesignerProjectEdit(
  original: LingWindowProject | undefined,
  candidate: LingWindowProject,
  options: { allowDeletion?: boolean; allowedControlTypes?: ReadonlySet<string> } = {}
): LingWindowProject {
  if (!candidate || typeof candidate !== 'object') throw new Error('AI 返回的设计器模型不是对象。');
  if (!candidate.id || typeof candidate.id !== 'string') throw new Error('设计器模型缺少有效项目 ID。');
  if (original && candidate.id !== original.id) throw new Error('AI 不得修改当前设计器项目 ID。');
  if (!Array.isArray(candidate.windows) || candidate.windows.length === 0) throw new Error('设计器模型必须至少包含一个窗口。');

  const windowIds = new Set<string>();
  const originalWindows = new Map((original?.windows || []).map(window => [window.id, window]));
  const allowedControlTypes = options.allowedControlTypes || getDefaultAllowedDesignerControlTypes();
  for (const window of candidate.windows) {
    if (!window || typeof window !== 'object' || typeof window.id !== 'string' || !window.id.trim()) throw new Error('设计器模型包含无效窗口 ID。');
    if (windowIds.has(window.id)) throw new Error(`设计器模型包含重复窗口 ID：${window.id}`);
    windowIds.add(window.id);
    validateFiniteNonNegative(window.width, `窗口 ${window.id} 的宽度`);
    validateFiniteNonNegative(window.height, `窗口 ${window.id} 的高度`);
    if (!Array.isArray(window.controls)) throw new Error(`窗口 ${window.id} 的控件列表无效。`);
    const controlIds = new Set<string>();
    const controlNames = new Set<string>();
    const controlIdSet = new Set(window.controls.map(control => control?.id));
    const originalControls = originalWindows.get(window.id)?.controls || [];
    const originalControlsById = new Map(originalControls.map(control => [control.id, control]));
    for (const control of window.controls) {
      if (!control || typeof control !== 'object' || typeof control.id !== 'string' || !control.id.trim()) throw new Error(`窗口 ${window.id} 包含无效控件 ID。`);
      if (controlIds.has(control.id)) throw new Error(`窗口 ${window.id} 包含重复控件 ID：${control.id}`);
      if (typeof control.name !== 'string' || !control.name.trim()) throw new Error(`控件 ${control.id} 缺少有效名称。`);
      if (controlNames.has(control.name)) throw new Error(`窗口 ${window.id} 包含重复控件名称：${control.name}`);
      controlIds.add(control.id);
      controlNames.add(control.name);
      const originalControl = originalControlsById.get(control.id);
      // 旧项目和第三方模块可能使用不再出现在当前工具箱注册表中的类型。
      // 允许它们在 AI 只调整布局时原样保留，但不允许借此注入新的未知类型。
      if (!allowedControlTypes.has(control.type) && originalControl?.type !== control.type) {
        throw new Error(`控件 ${control.name} 使用了不受支持的类型：${String(control.type)}`);
      }
      for (const [key, value] of Object.entries({ x: control.x, y: control.y, width: control.width, height: control.height, fontSize: control.fontSize })) {
        validateFiniteNonNegative(value, `控件 ${control.name} 的${key}`);
      }
      if (control.parentId && !controlIdSet.has(control.parentId)) throw new Error(`控件 ${control.name} 的 parentId 引用了不存在的控件。`);
      if (control.type === 'ProgressBar') validateProgressBar(control);
    }
    if (!options.allowDeletion && originalWindows.has(window.id)) {
      const nextControlIds = new Set(window.controls.map(control => control.id));
      const removed = originalControls.find(control => !nextControlIds.has(control.id));
      if (removed) throw new Error(`AI 提案删除了现有控件 ${removed.name}。如确需删除，请在 instruction 中明确写出「删除/移除/去掉/清除」等删除字样后重新生成提案。`);
    }
  }
  if (!options.allowDeletion && original) {
    const removedWindow = original.windows.find(window => !windowIds.has(window.id));
    if (removedWindow) throw new Error(`AI 提案删除了现有窗口 ${removedWindow.title || removedWindow.id}；请明确提出删除需求后重试。`);
  }
  if (Array.isArray(candidate.resources)) {
    const resourceIds = new Set<string>();
    for (const resource of candidate.resources) {
      if (!resource || typeof resource.id !== 'string' || !resource.id.trim()) throw new Error('设计器模型包含无效资源 ID。');
      if (resourceIds.has(resource.id)) throw new Error(`设计器模型包含重复资源 ID：${resource.id}`);
      resourceIds.add(resource.id);
    }
  }
  return cloneDesignerProject(candidate);
}

const CONTROL_TYPES = new Set<string>(WIN32_CONTROL_DEFINITIONS.map(definition => definition.type));
const LEGACY_COMPATIBLE_CONTROL_TYPES = new Set(['Upload', 'DragUpload']);

function getDefaultAllowedDesignerControlTypes(): Set<string> {
  return new Set([...CONTROL_TYPES, ...LEGACY_COMPATIBLE_CONTROL_TYPES]);
}

export function getAllowedDesignerControlTypes(context?: { moduleContext?: LingCppModuleContext | null }): Set<string> {
  const types = getDefaultAllowedDesignerControlTypes();
  for (const module of context?.moduleContext?.enabledModules || []) {
    for (const control of module.manifest.contributes?.designerControls || []) {
      types.add(control.type);
      if (control.previewType) types.add(control.previewType);
      if (control.namespacedType) types.add(control.namespacedType);
    }
  }
  return types;
}

/**
 * 供 AI 提示词使用的合法控件类型清单：规范标识 + 中文标签，并追加启用模块
 * 贡献的控件类型。模型据此才能把「编辑框」正确写成 TextBox 而不是 Edit。
 */
export function describeAllowedDesignerControlTypes(context?: { moduleContext?: LingCppModuleContext | null }): string {
  const parts = WIN32_CONTROL_DEFINITIONS.map(definition => `${definition.type}（${definition.label}）`);
  const seen = new Set(WIN32_CONTROL_DEFINITIONS.map(definition => definition.type));
  for (const module of context?.moduleContext?.enabledModules || []) {
    const moduleName = module.manifest.name || module.manifest.id;
    for (const control of module.manifest.contributes?.designerControls || []) {
      for (const type of [control.type, control.previewType, control.namespacedType]) {
        if (type && !seen.has(type)) {
          seen.add(type);
          parts.push(`${type}（${moduleName} ${control.label || ''}）`);
        }
      }
    }
  }
  return parts.join('、');
}

/**
 * 常见模型幻觉控件类型别名 → 注册表规范类型。映射键为 trim + 小写后的
 * type 字面值；只做保守的精确映射，且目标类型必须仍在当前允许集合内才
 * 生效。映射不到的值原样保留，由 validateDesignerProjectEdit 给出中文
 * 阻断诊断，不会静默猜测。
 */
const DESIGNER_CONTROL_TYPE_ALIASES: Record<string, string> = {
  // 编辑框族：模型最容易照搬 Win32 原生类名 EDIT 或自造 Input 同义词
  edit: 'TextBox',
  editbox: 'TextBox',
  edit_box: 'TextBox',
  input: 'TextBox',
  inputbox: 'TextBox',
  textinput: 'TextBox',
  textfield: 'TextBox',
  textarea: 'TextBox',
  '编辑框': 'TextBox',
  '文本框': 'TextBox',
  '输入框': 'TextBox',
  '输入': 'TextBox',
  // 其余内置控件的常见大小写与同义变体
  button: 'Button',
  btn: 'Button',
  pushbutton: 'Button',
  '按钮': 'Button',
  label: 'Label',
  static: 'Label',
  statictext: 'Label',
  '标签': 'Label',
  '静态文本': 'Label',
  '文本标签': 'Label',
  checkbox: 'CheckBox',
  check: 'CheckBox',
  '复选框': 'CheckBox',
  '勾选框': 'CheckBox',
  radio: 'RadioButton',
  radiobox: 'RadioButton',
  '单选框': 'RadioButton',
  '单选按钮': 'RadioButton',
  combobox: 'ComboBox',
  combo: 'ComboBox',
  dropdown: 'ComboBox',
  dropdownlist: 'ComboBox',
  '组合框': 'ComboBox',
  '下拉框': 'ComboBox',
  '下拉列表': 'ComboBox',
  listbox: 'ListBox',
  '列表框': 'ListBox',
  listview: 'ListView',
  '列表视图': 'ListView',
  treeview: 'TreeView',
  tree: 'TreeView',
  '树形视图': 'TreeView',
  '树型框': 'TreeView',
  tabcontrol: 'TabControl',
  tab: 'TabControl',
  tabs: 'TabControl',
  '选项卡': 'TabControl',
  groupbox: 'GroupBox',
  group: 'GroupBox',
  frame: 'GroupBox',
  '分组框': 'GroupBox',
  progressbar: 'ProgressBar',
  progress: 'ProgressBar',
  '进度条': 'ProgressBar',
  image: 'Image',
  picture: 'Image',
  picturebox: 'Image',
  '图片框': 'Image',
  animatedimage: 'AnimatedImage',
  gif: 'AnimatedImage',
  '动态图像': 'AnimatedImage',
  '动态图像控件': 'AnimatedImage',
  scrollbar: 'ScrollBar',
  '滚动条': 'ScrollBar',
  flatscrollbar: 'FlatScrollBar',
  datetimepicker: 'DateTimePicker',
  datepicker: 'DateTimePicker',
  '日期时间选择器': 'DateTimePicker',
  monthcalendar: 'MonthCalendar',
  calendar: 'MonthCalendar',
  '月历': 'MonthCalendar',
  '日历': 'MonthCalendar',
  colorpicker: 'ColorPicker',
  '颜色选择器': 'ColorPicker',
  trackbar: 'TrackBar',
  slider: 'TrackBar',
  '滑块': 'TrackBar',
  '滑动条': 'TrackBar',
  updown: 'UpDown',
  spinner: 'UpDown',
  '数值调节器': 'UpDown',
  '微调框': 'UpDown',
  hotkey: 'HotKey',
  '热键输入框': 'HotKey',
  '热键': 'HotKey',
  ipaddress: 'IPAddress',
  'ip地址框': 'IPAddress',
  toolbar: 'ToolBar',
  '工具栏': 'ToolBar',
  statusbar: 'StatusBar',
  '状态栏': 'StatusBar',
  tooltip: 'ToolTip',
  '工具提示': 'ToolTip',
  filedialog: 'FileDialog',
  '文件对话框': 'FileDialog',
  contextmenu: 'ContextMenu',
  '上下文菜单': 'ContextMenu',
  '右键菜单': 'ContextMenu',
  popupmenu: 'PopupMenu',
  '弹出菜单': 'PopupMenu',
  imagelist: 'ImageList',
  '图像列表': 'ImageList',
  richedit: 'RichEdit',
  richtext: 'RichEdit',
  richtextbox: 'RichEdit',
  '富文本框': 'RichEdit',
  animation: 'Animation',
  '动画控件': 'Animation',
  videoplayer: 'VideoPlayer',
  '视频播放器': 'VideoPlayer',
  datagrid: 'DataGrid',
  '数据表格': 'DataGrid',
  edgebrowser: 'EdgeBrowser',
  cefbrowser: 'CefBrowser',
  fbrobrowser: 'FBroBrowser'
};

// 规范标识自身的小写变体（textbox → TextBox、radiobutton → RadioButton）自动自映射。
for (const type of CONTROL_TYPES) {
  const lower = type.toLowerCase();
  if (lower !== type && !(lower in DESIGNER_CONTROL_TYPE_ALIASES)) {
    DESIGNER_CONTROL_TYPE_ALIASES[lower] = type;
  }
}

/**
 * 就地把候选设计器模型中的控件类型别名归一化为注册表规范标识。
 * 只有当前值不在允许集合内、且映射目标在允许集合内时才改写；
 * 返回改写的控件数量，便于调用方记录或提示。
 */
export function normalizeDesignerControlTypes(project: LingWindowProject, allowedTypes: ReadonlySet<string>): number {
  let renamed = 0;
  for (const window of project?.windows || []) {
    for (const control of window?.controls || []) {
      if (!control || typeof control.type !== 'string' || allowedTypes.has(control.type)) continue;
      const canonical = DESIGNER_CONTROL_TYPE_ALIASES[control.type.trim().toLowerCase()];
      if (canonical && canonical !== control.type && allowedTypes.has(canonical)) {
        (control as { type: string }).type = canonical;
        renamed += 1;
      }
    }
  }
  return renamed;
}

function validateFiniteNonNegative(value: unknown, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${label}必须是非负有限数字。`);
}

function validateProgressBar(control: { name: string; content: string; properties?: Record<string, unknown> }): void {
  const properties = control.properties || {};
  const minimum = Number(properties.minimum ?? 0);
  const maximum = Number(properties.maximum ?? 100);
  const value = Number(properties.value ?? control.content);
  if (![minimum, maximum, value].every(Number.isFinite) || maximum <= minimum || value < minimum || value > maximum) {
    throw new Error(`进度条 ${control.name} 的最小值、最大值或当前值无效。`);
  }
  const contentValue = Number(control.content);
  if (!Number.isFinite(contentValue) || contentValue !== value) {
    throw new Error(`进度条 ${control.name} 的 content 必须与 properties.value 同步。`);
  }
}

function cloneDesignerProject(project: LingWindowProject): LingWindowProject {
  return JSON.parse(JSON.stringify(project)) as LingWindowProject;
}

function stableSerializeDesignerProject(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => stableSerializeDesignerProject(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map(key => (
      `${JSON.stringify(key)}:${stableSerializeDesignerProject((value as Record<string, unknown>)[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * 设计器模型的字段顺序不影响实际布局。AI 重试和提案校验都使用这一比较，
 * 防止模型只重新排序 JSON 字段就被当成一次布局修改。
 */
export function areDesignerProjectsEquivalent(left: unknown, right: unknown): boolean {
  return stableSerializeDesignerProject(left) === stableSerializeDesignerProject(right);
}

/**
 * 判断 AI 编辑请求是否需要同时返回完整设计器模型。
 * 该规则必须与 server.ts 的结构化输出契约保持一致。
 */
export function isDesignerEditInstruction(instruction: string): boolean {
  return /窗口|窗体|控件|布局|界面|按钮|文本框|标签|进度条|宽度|高度|坐标|显示|隐藏|移动|调整大小|设计器/u.test(instruction);
}

/** 宽泛的视觉诉求允许在模型连续原样返回时采用保守的本地设计器回退。 */
export function isDesignerBeautificationInstruction(instruction: string): boolean {
  return /美化|美观|好看|太乱|整洁|更漂亮|更协调|优化(?:界面|布局|样式)|调整(?:界面|布局|样式)/u.test(instruction);
}

/**
 * AI 未给出任何实际视觉调整时的最后一道本地降级。仅改可视外观，保留
 * 项目/窗口/控件 ID、名称、内容、位置、尺寸、事件和资源，使它仍能进入
 * 原有的预览、确认与保存事务。
 */
export function createDesignerBeautificationFallback(project: LingWindowProject): LingWindowProject {
  const clone = cloneDesignerProject(project);
  return {
    ...clone,
    windows: clone.windows.map(window => {
      const darkWindow = isDarkDesignerColor(window.background);
      const surface = changedColor(window.background, darkWindow ? '#172033' : '#F8FAFC', darkWindow ? '#1E293B' : '#F1F5F9');
      const titleBarBackground = changedColor(window.titleBarBackground || '', darkWindow ? '#0F2742' : '#1E3A5F', darkWindow ? '#16324F' : '#134E4A');
      const titleBarForeground = changedColor(window.titleBarForeground || '', '#F8FAFC', '#FFFFFF');
      const buttonPalette = darkWindow
        ? ['#0F766E', '#2563EB', '#7C3AED', '#C2410C', '#BE123C', '#475569']
        : ['#0F766E', '#2563EB', '#7C3AED', '#C2410C', '#BE123C', '#475569'];
      let buttonIndex = 0;
      let highlightedLabel = false;

      return {
        ...window,
        background: surface,
        titleBarBackground,
        titleBarForeground,
        cornerStyle: 'rounded',
        controls: window.controls.map(control => {
          if (control.type === 'Button') {
            const color = buttonPalette[buttonIndex % buttonPalette.length];
            buttonIndex += 1;
            return {
              ...control,
              background: changedColor(control.background, color, '#155E75'),
              foreground: changedColor(control.foreground, '#FFFFFF', '#F8FAFC'),
              fontBold: true,
              properties: {
                ...(control.properties || {}),
                cornerRadius: Math.max(8, Number(control.properties?.cornerRadius) || 0)
              }
            };
          }

          if (control.type === 'Label' && !highlightedLabel && control.visibility === 'Visible') {
            highlightedLabel = true;
            return {
              ...control,
              foreground: changedColor(control.foreground, darkWindow ? '#F8FAFC' : '#0F172A', darkWindow ? '#E2E8F0' : '#1E293B'),
              fontSize: Math.max(control.fontSize, 18),
              fontBold: true
            };
          }

          if (control.type === 'TextBox' || control.type === 'RichEdit') {
            return {
              ...control,
              background: changedColor(control.background, darkWindow ? '#0F172A' : '#FFFFFF', darkWindow ? '#111827' : '#F8FAFC'),
              foreground: changedColor(control.foreground, darkWindow ? '#E2E8F0' : '#0F172A', darkWindow ? '#F8FAFC' : '#1E293B')
            };
          }

          return control;
        })
      };
    })
  };
}

function changedColor(current: string, preferred: string, alternative: string): string {
  return current.trim().toLowerCase() === preferred.toLowerCase() ? alternative : preferred;
}

function isDarkDesignerColor(value: string): boolean {
  const match = /^#([\da-f]{6})$/iu.exec(value.trim());
  if (!match) return false;
  const color = Number.parseInt(match[1], 16);
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  return (red * 299 + green * 587 + blue * 114) / 1000 < 140;
}

export function getWorkspaceEditProposal(proposalId: string): WorkspaceEditProposal | undefined {
  purgeExpiredProposals();
  return proposalStore.get(proposalId)?.proposal;
}

function purgeExpiredProposals(now = Date.now()): void {
  for (const [id, record] of proposalStore) if (record.expiresAt <= now) proposalStore.delete(id);
}

export function rejectWorkspaceEdit(proposalId: string): boolean {
  return proposalStore.delete(proposalId);
}

export function applyWorkspaceEdit(sourceCode: string, proposal: WorkspaceEditProposal): string {
  const change = proposal.changes[0];
  if (!change) return sourceCode;
  return replaceRange(sourceCode, change.range, change.newText);
}

export function applyWorkspaceEditToFiles(
  workspaceFiles: LingCppWorkspaceFile[],
  proposal: WorkspaceEditProposal
): AppliedWorkspaceFile[] {
  const sourceMap = new Map<string, string>(
    workspaceFiles.map(file => [normalizeFilePath(file.filePath).toLocaleLowerCase(), normalizeLineEndings(file.sourceCode)])
  );

  proposal.changes.forEach(change => {
    const normalizedPath = normalizeFilePath(change.filePath);
    const currentSource = sourceMap.get(normalizedPath.toLocaleLowerCase()) || '';
    const currentText = getTextForRange(currentSource, change.range);
    if (currentText !== change.originalText) {
      throw new Error(`文件 ${change.filePath} 在 AI 提案生成后已发生变化，请重新生成提案。`);
    }
    const nextSource = replaceRange(currentSource, change.range, change.newText);
    sourceMap.set(normalizedPath.toLocaleLowerCase(), nextSource);
  });

  const result: AppliedWorkspaceFile[] = [];
  proposal.changes.forEach(change => {
    const normalizedPath = normalizeFilePath(change.filePath);
    const nextSource = sourceMap.get(normalizedPath.toLocaleLowerCase());
    if (typeof nextSource === 'string' && !result.some(file => normalizeFilePath(file.filePath).toLocaleLowerCase() === normalizedPath.toLocaleLowerCase())) {
      result.push({
        filePath: change.filePath,
        sourceCode: nextSource
      });
    }
  });

  return result;
}

export function createWorkspaceEditChangeFromRewrite(
  filePath: string,
  originalSource: string,
  updatedSource: string,
  fallbackRange: WorkspaceEditRange = createFullDocumentRange(originalSource)
): WorkspaceEditChange {
  if (originalSource === updatedSource) {
    const originalText = getTextForRange(originalSource, fallbackRange);
    return {
      filePath,
      range: fallbackRange,
      originalText,
      newText: originalText
    };
  }

  const maxPrefix = Math.min(originalSource.length, updatedSource.length);
  let prefixLength = 0;
  while (prefixLength < maxPrefix && originalSource[prefixLength] === updatedSource[prefixLength]) {
    prefixLength += 1;
  }

  let originalSuffixStart = originalSource.length;
  let updatedSuffixStart = updatedSource.length;
  while (
    originalSuffixStart > prefixLength &&
    updatedSuffixStart > prefixLength &&
    originalSource[originalSuffixStart - 1] === updatedSource[updatedSuffixStart - 1]
  ) {
    originalSuffixStart -= 1;
    updatedSuffixStart -= 1;
  }

  const range = createRangeFromOffsets(originalSource, prefixLength, originalSuffixStart);
  return {
    filePath,
    range,
    originalText: originalSource.slice(prefixLength, originalSuffixStart),
    newText: updatedSource.slice(prefixLength, updatedSuffixStart)
  };
}

function buildLocalEdit(originalText: string, instruction: string): string {
  const trimmedInstruction = instruction.trim();
  if (!originalText.trim()) {
    return [
      '    调试输出("AI 已生成新的中文 C++ 代码块")',
      trimmedInstruction ? `    // 需求：${trimmedInstruction}` : ''
    ].filter(Boolean).join('\n');
  }

  return [
    originalText.trimEnd(),
    '',
    `// AI 编辑建议：${trimmedInstruction || '请复核此处中文 C++ 逻辑'}`
  ].join('\n');
}

function buildLocalUpdatedSource(context: LingCppEditContext): string {
  const range = context.selection || createFullDocumentRange(context.sourceCode);
  const originalText = getTextForRange(context.sourceCode, range);
  const newText = buildLocalEdit(originalText, context.instruction);
  return replaceRange(context.sourceCode, range, newText);
}

function createChangeForDraftFile(
  fileDraft: LingCppEditDraftFile,
  workspaceFiles: LingCppWorkspaceFile[],
  context: LingCppEditContext
): WorkspaceEditChange | undefined {
  // 匹配按 Windows 路径大小写不敏感比较；匹配不到直接报错，绝不静默丢弃——
  // 静默丢弃会让 AI 以为编辑已生效，反复构建却看不到变化。
  const matchingFile = workspaceFiles.find(file => normalizeFilePath(file.filePath).toLocaleLowerCase() === normalizeFilePath(fileDraft.filePath).toLocaleLowerCase());
  if (!matchingFile) {
    const known = workspaceFiles.map(file => file.filePath).join('、');
    throw new Error(`编辑草稿的文件 ${fileDraft.filePath} 没有对应的当前工作区内容，提案已拒绝。${known ? `可编辑的文件：${known}。` : ''}请在 files 中只提交提供过当前内容的文件，或省略 workspaceFiles 让服务端自动读取磁盘内容。`);
  }

  const originalSource = normalizeLineEndings(matchingFile.sourceCode);
  const updatedSource = normalizeLineEndings(fileDraft.updatedSource);
  const fallbackRange = normalizeFilePath(fileDraft.filePath) === normalizeFilePath(context.filePath) && context.selection
    ? context.selection
    : createFullDocumentRange(originalSource);

  return createWorkspaceEditChangeFromRewrite(fileDraft.filePath, originalSource, updatedSource, fallbackRange);
}

function resolveDraftFiles(context: LingCppEditContext, draft: LingCppEditDraft): LingCppEditDraftFile[] {
  if (Array.isArray(draft.files) && draft.files.length > 0) {
    return dedupeDraftFiles(draft.files);
  }

  if (typeof draft.updatedSource === 'string') {
    return [{
      filePath: context.filePath,
      updatedSource: draft.updatedSource
    }];
  }

  return [{
    filePath: context.filePath,
    updatedSource: buildLocalUpdatedSource({
      ...context,
      sourceCode: normalizeLineEndings(context.sourceCode)
    })
  }];
}

function dedupeDraftFiles(files: LingCppEditDraftFile[]): LingCppEditDraftFile[] {
  const deduped = new Map<string, LingCppEditDraftFile>();
  files.forEach(file => {
    if (!file?.filePath || typeof file.updatedSource !== 'string') return;
    deduped.set(normalizeFilePath(file.filePath), {
      filePath: file.filePath,
      updatedSource: file.updatedSource
    });
  });
  return [...deduped.values()];
}

function resolveWorkspaceFiles(context: LingCppEditContext): LingCppWorkspaceFile[] {
  const files = [...(context.workspaceFiles || [])];
  if (!files.some(file => normalizeFilePath(file.filePath) === normalizeFilePath(context.filePath))) {
    files.unshift({
      filePath: context.filePath,
      sourceCode: context.sourceCode
    });
  }

  const deduped = new Map<string, LingCppWorkspaceFile>();
  files.forEach(file => {
    if (!file?.filePath || typeof file.sourceCode !== 'string') return;
    deduped.set(normalizeFilePath(file.filePath), {
      ...file,
      sourceCode: normalizeLineEndings(file.sourceCode)
    });
  });
  return [...deduped.values()];
}

function getTextForRange(sourceCode: string, range: WorkspaceEditRange): string {
  const lines = sourceCode.split(/\r?\n/);
  const startLine = Math.max(1, range.startLine);
  const endLine = Math.max(startLine, range.endLine);
  if (startLine === endLine) {
    const line = lines[startLine - 1] || '';
    const endColumn = range.endColumn === Number.MAX_SAFE_INTEGER ? line.length : Math.max(0, range.endColumn - 1);
    return line.slice(Math.max(0, range.startColumn - 1), endColumn);
  }
  const selected = lines.slice(startLine - 1, endLine);
  if (selected.length === 0) return '';
  selected[0] = selected[0].slice(Math.max(0, range.startColumn - 1));
  if (range.endColumn !== Number.MAX_SAFE_INTEGER) {
    selected[selected.length - 1] = selected[selected.length - 1].slice(0, Math.max(0, range.endColumn - 1));
  }
  return selected.join('\n');
}

function createFullDocumentRange(sourceCode: string): WorkspaceEditRange {
  const lines = sourceCode.split('\n');
  const endLine = Math.max(1, lines.length);
  const endColumn = (lines[endLine - 1] || '').length + 1;
  return {
    startLine: 1,
    startColumn: 1,
    endLine,
    endColumn
  };
}

function createRangeFromOffsets(sourceCode: string, startOffset: number, endOffset: number): WorkspaceEditRange {
  const start = offsetToPosition(sourceCode, startOffset);
  const end = offsetToPosition(sourceCode, endOffset);
  return {
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column
  };
}

function offsetToPosition(sourceCode: string, offset: number): { line: number; column: number } {
  const clampedOffset = Math.max(0, Math.min(offset, sourceCode.length));
  const prefix = sourceCode.slice(0, clampedOffset);
  const lines = prefix.split('\n');
  return {
    line: Math.max(1, lines.length),
    column: (lines[lines.length - 1] || '').length + 1
  };
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

function normalizeFilePath(value: string): string {
  return value.replace(/\\/g, '/').trim();
}

function replaceRange(
  sourceCode: string,
  range: WorkspaceEditRange,
  nextText: string
): string {
  const lines = sourceCode.split(/\r?\n/);
  const startLine = Math.max(1, range.startLine);
  const endLine = Math.max(startLine, range.endLine);
  const startIndex = startLine - 1;
  const endIndex = Math.min(lines.length - 1, endLine - 1);
  const startColumn = Math.max(0, range.startColumn - 1);
  const endColumn = range.endColumn === Number.MAX_SAFE_INTEGER
    ? lines[endIndex]?.length || 0
    : Math.max(0, range.endColumn - 1);
  const before = (lines[startIndex] || '').slice(0, startColumn);
  const after = (lines[endIndex] || '').slice(endColumn);
  const replacement = `${before}${nextText}${after}`.split('\n');
  lines.splice(startIndex, endIndex - startIndex + 1, ...replacement);
  return lines.join('\n');
}
