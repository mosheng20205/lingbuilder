import type { LingCppPresentationTokenKind } from './beginnerSyntaxPresentation';

export interface LingCppSemanticTokenColors {
  dark: string;
  light: string;
}

export interface LingCppSemanticTokenRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export const LINGCPP_CONTROL_REFERENCE_SEMANTIC_TOKEN = 'controlReference';

export const LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS: LingCppSemanticTokenColors = {
  dark: '#f472b6',
  light: '#b42367'
};

/**
 * Comment color for `//` and leading `'` comment lines.
 *
 * The beginner structured editor, the professional Monaco editor and the diff
 * views must agree on this token, otherwise the same commented line would
 * change color when the user switches editor mode.
 */
export const LINGCPP_COMMENT_TOKEN_COLORS: LingCppSemanticTokenColors = {
  dark: '#3f8f3f',
  light: '#166534'
};

/**
 * `#常量名` 引用令牌颜色（项目常量与模块常量共用）。
 *
 * 深色值取自易语言常量紫（#BE56BE）；新手结构化编辑器、Monaco 与 Diff 视图
 * 必须消费同一令牌色，切换编辑器模式时同一常量行不得变色。
 */
export const LINGCPP_CONSTANT_TOKEN_COLORS: LingCppSemanticTokenColors = {
  dark: '#BE56BE',
  light: '#8E458E'
};

// ---------------------------------------------------------------------------
// 编辑器令牌配色（预设主题 + 用户自定义）
//
// 新手结构编辑器、专业 Monaco 编辑器与 Diff 视图统一从这里取色：
// 预设主题定义每种令牌角色的亮色/暗色值，用户可在「设置 → 编辑器颜色」中
// 选择主题或对单个角色覆盖颜色（overrides 以 `${role}.${mode}` 为键）。
// ---------------------------------------------------------------------------

export type LingCppTokenColorMode = 'light' | 'dark';

export type LingCppTokenColorRole =
  | 'keyword'
  | 'command'
  | 'moduleCommand'
  | 'string'
  | 'type'
  | 'literal'
  | 'local'
  | 'member'
  | 'procedure'
  | 'operator'
  | 'comment'
  | 'constant'
  | 'controlReference'
  | 'identifier'
  | 'nativeMarker'
  | 'nativeKeyword'
  | 'nativeType'
  | 'nativeNamespace'
  | 'nativeFunction'
  | 'nativeVariable';

export interface LingCppTokenColorPair {
  light: string;
  dark: string;
}

export interface LingCppTokenColorPreset {
  id: string;
  label: string;
  description: string;
  colors: Record<LingCppTokenColorRole, LingCppTokenColorPair>;
}

export interface LingCppTokenColorSettings {
  themeId: string;
  /** 键为 `${role}.${mode}`，值为 `#rrggbb`；未知键在解析时被忽略。 */
  overrides: Record<string, string>;
}

export const LINGCPP_TOKEN_COLOR_OVERRIDE_VALUE_PATTERN = /^#[0-9a-fA-F]{6}$/u;

const LINGCPP_TOKEN_COLOR_HEX_PATTERN = /^#[0-9a-fA-F]{6}$/u;

function pair(light: string, dark: string): LingCppTokenColorPair {
  return { light, dark };
}

/** 默认「翠绿」主题：逐条对齐历史硬编码色，未自定义时渲染结果与旧版完全一致。 */
const DEFAULT_TOKEN_COLOR_PRESET_COLORS: Record<LingCppTokenColorRole, LingCppTokenColorPair> = {
  keyword: pair('#1d4ed8', '#4ea5ff'),
  command: pair('#b45309', '#dcdcaa'),
  moduleCommand: pair('#006a7a', '#22d3ee'),
  string: pair('#b45309', '#d7c5a1'),
  type: pair('#0f766e', '#2bd4c6'),
  literal: pair('#047857', '#b5cea8'),
  local: pair('#047857', '#9df59c'),
  member: pair('#92400e', '#fde68a'),
  procedure: pair('#155e75', '#a5f3fc'),
  operator: pair('#64748b', '#94a3b8'),
  comment: { light: LINGCPP_COMMENT_TOKEN_COLORS.light, dark: LINGCPP_COMMENT_TOKEN_COLORS.dark },
  constant: { light: LINGCPP_CONSTANT_TOKEN_COLORS.light, dark: LINGCPP_CONSTANT_TOKEN_COLORS.dark },
  controlReference: { light: LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.light, dark: LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.dark },
  identifier: pair('#0f172a', '#f1f5f9'),
  nativeMarker: pair('#7a1fa2', '#c586c0'),
  nativeKeyword: pair('#1d4ed8', '#569cd6'),
  nativeType: pair('#0f766e', '#4ec9b0'),
  nativeNamespace: pair('#1d4ed8', '#4fc1ff'),
  nativeFunction: pair('#795e26', '#dcdcaa'),
  nativeVariable: pair('#001080', '#9cdcfe')
};

const EYUYAN_TOKEN_COLOR_PRESET_COLORS: Record<LingCppTokenColorRole, LingCppTokenColorPair> = {
  keyword: pair('#0000ff', '#7b9eff'),
  command: pair('#1f1f1f', '#e0e0e0'),
  moduleCommand: pair('#1f1f1f', '#e0e0e0'),
  string: pair('#a31515', '#ce9178'),
  type: pair('#1f1f1f', '#e0e0e0'),
  literal: pair('#1f1f1f', '#e0e0e0'),
  local: pair('#1f1f1f', '#e0e0e0'),
  member: pair('#1f1f1f', '#e0e0e0'),
  procedure: pair('#1f1f1f', '#e0e0e0'),
  operator: pair('#3f3f3f', '#c8c8c8'),
  comment: pair('#008000', '#6a9955'),
  constant: pair('#be56be', '#d07fd0'),
  controlReference: { light: LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.light, dark: LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.dark },
  identifier: pair('#1f1f1f', '#e0e0e0'),
  nativeMarker: DEFAULT_TOKEN_COLOR_PRESET_COLORS.nativeMarker,
  nativeKeyword: DEFAULT_TOKEN_COLOR_PRESET_COLORS.nativeKeyword,
  nativeType: DEFAULT_TOKEN_COLOR_PRESET_COLORS.nativeType,
  nativeNamespace: DEFAULT_TOKEN_COLOR_PRESET_COLORS.nativeNamespace,
  nativeFunction: DEFAULT_TOKEN_COLOR_PRESET_COLORS.nativeFunction,
  nativeVariable: DEFAULT_TOKEN_COLOR_PRESET_COLORS.nativeVariable
};

const VS_CODE_TOKEN_COLOR_PRESET_COLORS: Record<LingCppTokenColorRole, LingCppTokenColorPair> = {
  keyword: pair('#0000ff', '#569cd6'),
  command: pair('#795e26', '#dcdcaa'),
  moduleCommand: pair('#af00db', '#c586c0'),
  string: pair('#a31515', '#ce9178'),
  type: pair('#267f99', '#4ec9b0'),
  literal: pair('#098658', '#b5cea8'),
  local: pair('#001080', '#9cdcfe'),
  member: pair('#001080', '#9cdcfe'),
  procedure: pair('#795e26', '#dcdcaa'),
  operator: pair('#000000', '#d4d4d4'),
  comment: pair('#008000', '#6a9955'),
  constant: pair('#8e458e', '#c586c0'),
  controlReference: { light: LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.light, dark: LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.dark },
  identifier: pair('#000000', '#d4d4d4'),
  nativeMarker: pair('#7a1fa2', '#c586c0'),
  nativeKeyword: pair('#0000ff', '#569cd6'),
  nativeType: pair('#267f99', '#4ec9b0'),
  nativeNamespace: pair('#0000ff', '#4fc1ff'),
  nativeFunction: pair('#795e26', '#dcdcaa'),
  nativeVariable: pair('#001080', '#9cdcfe')
};

const OCEAN_TOKEN_COLOR_PRESET_COLORS: Record<LingCppTokenColorRole, LingCppTokenColorPair> = {
  keyword: pair('#0369a1', '#7dd3fc'),
  command: pair('#c2410c', '#fdba74'),
  moduleCommand: pair('#0e7490', '#67e8f9'),
  string: pair('#be185d', '#f9a8d4'),
  type: pair('#0f766e', '#5eead4'),
  literal: pair('#4d7c0f', '#bef264'),
  local: pair('#1d4ed8', '#93c5fd'),
  member: pair('#4338ca', '#a5b4fc'),
  procedure: pair('#9a3412', '#fcd34d'),
  operator: pair('#475569', '#94a3b8'),
  comment: pair('#15803d', '#4e9b66'),
  constant: pair('#a21caf', '#e879f9'),
  controlReference: { light: LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.light, dark: LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.dark },
  identifier: pair('#0f172a', '#e2e8f0'),
  nativeMarker: pair('#7a1fa2', '#d8b4fe'),
  nativeKeyword: pair('#0369a1', '#7dd3fc'),
  nativeType: pair('#0f766e', '#5eead4'),
  nativeNamespace: pair('#1d4ed8', '#93c5fd'),
  nativeFunction: pair('#b45309', '#fcd34d'),
  nativeVariable: pair('#1e40af', '#bfdbfe')
};

export const DEFAULT_LINGCPP_TOKEN_COLOR_PRESET_ID = 'default';

export const LINGCPP_TOKEN_COLOR_PRESETS: readonly LingCppTokenColorPreset[] = [
  {
    id: 'default',
    label: '翠绿（默认）',
    description: '当前默认配色：局部变量与数字翠绿、关键字蓝、命令金黄。',
    colors: DEFAULT_TOKEN_COLOR_PRESET_COLORS
  },
  {
    id: 'eyuyan',
    label: '易语言经典',
    description: '接近易语言 IDE：语句关键字蓝色，正文黑字，注释绿、常量紫。',
    colors: EYUYAN_TOKEN_COLOR_PRESET_COLORS
  },
  {
    id: 'vscode',
    label: 'VS Code 风',
    description: '对齐 VS Code Light+/Dark+ 的函数、类型与变量配色。',
    colors: VS_CODE_TOKEN_COLOR_PRESET_COLORS
  },
  {
    id: 'ocean',
    label: '海洋蓝调',
    description: '冷色系高区分度：关键字天蓝、文本玫红、局部变量亮蓝。',
    colors: OCEAN_TOKEN_COLOR_PRESET_COLORS
  }
];

export function getLingCppTokenColorPreset(id: unknown): LingCppTokenColorPreset {
  return LINGCPP_TOKEN_COLOR_PRESETS.find(preset => preset.id === id)
    || LINGCPP_TOKEN_COLOR_PRESETS[0];
}

export function isLingCppTokenColorRole(value: unknown): value is LingCppTokenColorRole {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DEFAULT_TOKEN_COLOR_PRESET_COLORS, value);
}

export function isLingCppTokenColorMode(value: unknown): value is LingCppTokenColorMode {
  return value === 'light' || value === 'dark';
}

export function getLingCppTokenColorOverrideKey(role: LingCppTokenColorRole, mode: LingCppTokenColorMode): string {
  return `${role}.${mode}`;
}

const DEFAULT_LINGCPP_TOKEN_COLOR_SETTINGS: LingCppTokenColorSettings = {
  themeId: DEFAULT_LINGCPP_TOKEN_COLOR_PRESET_ID,
  overrides: {}
};

/** 宽松归一化：非法主题回退默认主题，非法覆盖键值逐条丢弃，绝不抛错。 */
export function normalizeLingCppTokenColorSettings(value: unknown): LingCppTokenColorSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { themeId: DEFAULT_LINGCPP_TOKEN_COLOR_PRESET_ID, overrides: {} };
  }
  const raw = value as { themeId?: unknown; overrides?: unknown };
  const themeId = typeof raw.themeId === 'string' && raw.themeId.trim()
    ? raw.themeId
    : DEFAULT_LINGCPP_TOKEN_COLOR_PRESET_ID;
  const overrides: Record<string, string> = {};
  if (raw.overrides && typeof raw.overrides === 'object' && !Array.isArray(raw.overrides)) {
    for (const [key, item] of Object.entries(raw.overrides as Record<string, unknown>)) {
      const [role, mode] = key.split('.');
      if (!isLingCppTokenColorRole(role) || !isLingCppTokenColorMode(mode)) continue;
      if (typeof item !== 'string' || !LINGCPP_TOKEN_COLOR_HEX_PATTERN.test(item)) continue;
      overrides[getLingCppTokenColorOverrideKey(role, mode)] = item.toLowerCase();
    }
  }
  return { themeId, overrides };
}

function stableSettingsKey(settings: LingCppTokenColorSettings): string {
  const sortedOverrides = Object.keys(settings.overrides).sort()
    .map(key => `${key}=${settings.overrides[key]}`)
    .join(';');
  return `${settings.themeId}|${sortedOverrides}`;
}

let activeLingCppTokenColorSettings = normalizeLingCppTokenColorSettings(DEFAULT_LINGCPP_TOKEN_COLOR_SETTINGS);
const tokenColorSettingsListeners = new Set<() => void>();

export function getActiveLingCppTokenColorSettings(): LingCppTokenColorSettings {
  return activeLingCppTokenColorSettings;
}

/** 应用最新的令牌配色设置；仅在有效内容变化时通知订阅者（Monaco 重定义主题等）。 */
export function setActiveLingCppTokenColorSettings(value: unknown): boolean {
  const next = normalizeLingCppTokenColorSettings(value);
  if (stableSettingsKey(next) === stableSettingsKey(activeLingCppTokenColorSettings)) return false;
  activeLingCppTokenColorSettings = next;
  for (const listener of [...tokenColorSettingsListeners]) {
    try {
      listener();
    } catch {
      // 单个订阅者（如 Monaco 主题重定义）失败不得影响其他消费者。
    }
  }
  return true;
}

export function subscribeLingCppTokenColorSettings(listener: () => void): () => void {
  tokenColorSettingsListeners.add(listener);
  return () => {
    tokenColorSettingsListeners.delete(listener);
  };
}

export function resolveLingCppTokenColor(
  role: LingCppTokenColorRole,
  settings: LingCppTokenColorSettings,
  isDarkMode: boolean
): string {
  const override = settings.overrides[getLingCppTokenColorOverrideKey(role, isDarkMode ? 'dark' : 'light')];
  if (override && LINGCPP_TOKEN_COLOR_OVERRIDE_VALUE_PATTERN.test(override)) return override;
  const pairValue = getLingCppTokenColorPreset(settings.themeId).colors[role];
  return isDarkMode ? pairValue.dark : pairValue.light;
}

export function resolveLingCppTokenColors(
  settings: LingCppTokenColorSettings,
  isDarkMode: boolean
): Record<LingCppTokenColorRole, string> {
  const resolved = {} as Record<LingCppTokenColorRole, string>;
  for (const role of Object.keys(getLingCppTokenColorPreset(settings.themeId).colors) as LingCppTokenColorRole[]) {
    resolved[role] = resolveLingCppTokenColor(role, settings, isDarkMode);
  }
  return resolved;
}

const KIND_TO_COLOR_ROLE: Record<LingCppPresentationTokenKind, LingCppTokenColorRole> = {
  string: 'string',
  command: 'command',
  keyword: 'keyword',
  type: 'type',
  literal: 'literal',
  'module-command': 'moduleCommand',
  'control-reference': 'controlReference',
  constant: 'constant',
  local: 'local',
  member: 'member',
  procedure: 'procedure',
  operator: 'operator',
  'native-marker': 'nativeMarker',
  'native-keyword': 'nativeKeyword',
  'native-type': 'nativeType',
  'native-namespace': 'nativeNamespace',
  'native-function': 'nativeFunction',
  'native-variable': 'nativeVariable',
  identifier: 'identifier'
};

export function getLingCppTokenColorRoleForKind(kind: LingCppPresentationTokenKind): LingCppTokenColorRole {
  return KIND_TO_COLOR_ROLE[kind];
}

export function getLingCppPresentationTokenColor(
  kind: LingCppPresentationTokenKind,
  settings: LingCppTokenColorSettings,
  isDarkMode: boolean
): string {
  return resolveLingCppTokenColor(getLingCppTokenColorRoleForKind(kind), settings, isDarkMode);
}

export function getLingCppControlReferenceTokenColor(isDarkMode: boolean): string {
  return resolveLingCppTokenColor('controlReference', activeLingCppTokenColorSettings, isDarkMode);
}

export function getLingCppCommentTokenColor(isDarkMode: boolean): string {
  return resolveLingCppTokenColor('comment', activeLingCppTokenColorSettings, isDarkMode);
}

export function getLingCppConstantTokenColor(isDarkMode: boolean): string {
  return resolveLingCppTokenColor('constant', activeLingCppTokenColorSettings, isDarkMode);
}

export function getLingCppStringTokenColor(isDarkMode: boolean): string {
  return resolveLingCppTokenColor('string', activeLingCppTokenColorSettings, isDarkMode);
}

/** 设置界面令牌行的展示元数据：label 为中文角色名，sample 为预览样例词。 */
export interface LingCppTokenColorRoleMeta {
  role: LingCppTokenColorRole;
  label: string;
  sample: string;
  group: 'tokens' | 'native';
}

export const LINGCPP_TOKEN_COLOR_ROLE_META: readonly LingCppTokenColorRoleMeta[] = [
  { role: 'keyword', label: '关键字', sample: '如果', group: 'tokens' },
  { role: 'command', label: '命令', sample: '信息框', group: 'tokens' },
  { role: 'moduleCommand', label: '模块命令', sample: '数组_加入成员', group: 'tokens' },
  { role: 'string', label: '文本', sample: '“文本”', group: 'tokens' },
  { role: 'type', label: '数据类型', sample: '整数型', group: 'tokens' },
  { role: 'literal', label: '数字与真假', sample: '1024', group: 'tokens' },
  { role: 'local', label: '局部变量与参数', sample: '局部变量', group: 'tokens' },
  { role: 'member', label: '程序集/全局变量', sample: '程序集变量', group: 'tokens' },
  { role: 'procedure', label: '子程序名', sample: '子程序名', group: 'tokens' },
  { role: 'operator', label: '运算符与括号', sample: '( )', group: 'tokens' },
  { role: 'comment', label: '注释', sample: "' 备注", group: 'tokens' },
  { role: 'constant', label: '常量引用', sample: '#常量名', group: 'tokens' },
  { role: 'controlReference', label: '控件引用', sample: '按钮1', group: 'tokens' },
  { role: 'identifier', label: '其他标识符', sample: '标识符', group: 'tokens' },
  { role: 'nativeMarker', label: '内嵌 C++ 行首 @', sample: '@', group: 'native' },
  { role: 'nativeKeyword', label: '内嵌 C++ 关键字', sample: 'const', group: 'native' },
  { role: 'nativeType', label: '内嵌 C++ 类型', sample: 'int', group: 'native' },
  { role: 'nativeNamespace', label: '内嵌 C++ 命名空间', sample: 'std', group: 'native' },
  { role: 'nativeFunction', label: '内嵌 C++ 函数', sample: 'printf', group: 'native' },
  { role: 'nativeVariable', label: '内嵌 C++ 变量', sample: 'buffer', group: 'native' }
];

export function createLingCppControlReferenceEditorCss(): string[] {
  return [
    `.monaco-editor.vs-dark .lingcpp-control-reference-token, .monaco-editor.hc-black .lingcpp-control-reference-token { color: ${getLingCppControlReferenceTokenColor(true)} !important; font-weight: 600; }`,
    `.monaco-editor.vs .lingcpp-control-reference-token, .monaco-editor.hc-light .lingcpp-control-reference-token { color: ${getLingCppControlReferenceTokenColor(false)} !important; font-weight: 600; }`
  ];
}

export function buildLingCppControlReferenceSemanticTokenData(
  ranges: readonly LingCppSemanticTokenRange[]
): Uint32Array {
  const sorted = [...ranges]
    .filter(range => range.startLine === range.endLine && range.endColumn > range.startColumn)
    .sort((left, right) => left.startLine - right.startLine || left.startColumn - right.startColumn);
  const data: number[] = [];
  let previousLine = 0;
  let previousStart = 0;
  sorted.forEach(range => {
    const line = Math.max(0, range.startLine - 1);
    const start = Math.max(0, range.startColumn - 1);
    const deltaLine = line - previousLine;
    const deltaStart = deltaLine === 0 ? start - previousStart : start;
    data.push(deltaLine, deltaStart, range.endColumn - range.startColumn, 0, 0);
    previousLine = line;
    previousStart = start;
  });
  return Uint32Array.from(data);
}
