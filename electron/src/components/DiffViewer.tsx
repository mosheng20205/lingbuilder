import React, { useRef, useEffect, useLayoutEffect, useMemo, useState, useCallback, useImperativeHandle } from 'react';
import { Sparkles, Undo2, Check, Code, LayoutGrid, FileCode, FileText, X, ListTree, PanelRightClose, GraduationCap, Lightbulb, ClipboardList, Wand2, PlayCircle, Pencil, Save, Trash2, Plus, ChevronDown, ChevronRight, RefreshCw, FolderOpen, Copy, FileInput, ExternalLink } from 'lucide-react';

function FileIcon({ fileName, isDarkMode }: { fileName: string; isDarkMode: boolean }) {
  if (fileName.endsWith('.lcpp')) {
    return <FileCode className="w-3.5 h-3.5 text-emerald-500" />;
  }
  if (fileName.endsWith('.e')) {
    return <FileCode className="w-3.5 h-3.5 text-emerald-500" />;
  }
  if (fileName.endsWith('.cpp')) {
    return <FileCode className="w-3.5 h-3.5 text-blue-400" />;
  }
  if (fileName.endsWith('.h')) {
    return <FileCode className="w-3.5 h-3.5 text-orange-400" />;
  }
  if (fileName.endsWith('.xml') || fileName.endsWith('.rc')) {
    return <FileCode className="w-3.5 h-3.5 text-amber-500" />;
  }
  return <FileText className="w-3.5 h-3.5 text-slate-400" />;
}

function getEditorTabClassName(isActive: boolean, isDarkMode: boolean) {
  return `group flex h-8 shrink-0 items-center gap-2 px-3 py-1.5 text-[11px] font-semibold rounded-t cursor-pointer transition-all border-t border-x ${
    isActive
      ? isDarkMode
        ? 'bg-[#1e1e24] border-[#2d2d34] text-white border-b-transparent'
        : 'bg-white border-slate-300 text-slate-900 border-b-transparent'
      : isDarkMode
        ? 'bg-[#141418] border-transparent text-slate-400 hover:text-slate-200'
        : 'bg-slate-200/50 border-transparent text-slate-600 hover:text-slate-800'
  }`;
}
import { AppliedWorkspaceFile, DiffLine, DiffResult, ExtractedString, ProblemItem, WorkspaceEditProposal } from '../types';
import WpfDesigner from './WpfDesigner';
import MonacoCodeEditor, {
  MonacoContentChange,
  MonacoCodeEditorHandle,
  MonacoEditorState
} from './MonacoCodeEditor';
import LingCppStructureEditor from './LingCppStructureEditor';
import DiffViewModeSelector, {
  DIFF_VIEW_MODE_CHANGE_EVENT,
  type DiffViewMode
} from './DiffViewModeSelector';
import { buildLingCppLanguageContext, getLingCppDesignerControlCompletions, getLingCppReadableBlocks, getLingCppStructuredRows, getLingCppStructureView } from '../services/lingCpp/languageService';
import { LingCppAccessModifier, LingCppAstEdit, LingCppMethod, LingCppNativeSourceMapEntry, LingCppParameter, LingCppReadableBlock, LingCppReadingMode, LingCppStructuredReadingRow, LingCppStructureNode } from '../services/lingCpp/types';
import { getBeginnerCompletionContext, getBeginnerCompletionToken, scanBeginnerCodePrefix, shouldShowBeginnerCompletion } from '../services/lingCpp/beginnerCompletionContext';
import { applyLingCppAstEdit } from '../services/lingCpp/astEditService';
import { LingCppNativePreviewFile, LingWindowProject, NativeCppImportResult } from '../services/windowDesigner/types';
import {
  BeginnerTask,
  EditorExperienceMode,
  LingCppActionBlock,
  createWorkspaceEditFromActionBlock,
  getActionBlocksForEvent,
  getBeginnerTasks,
  getCodeExplanation,
  getLearningPathState,
  summarizeEventPreview
} from '../services/lingCpp/beginnerService';
import { applyWorkspaceEdit } from '../services/lingCpp/aiEditService';
import { importNativeCppToLingBuilder } from '../services/windowDesigner/nativeCppImportService';
import { saveWindowDesignerState } from '../services/windowDesigner/windowDesignerService';
import { normalizeIdentifier } from '../services/lingCpp/parser';
import {
  classifyLingCppPresentationCode,
  extractLingCppNativeVariableNames,
  LingCppPresentationTokenKind
} from '../services/lingCpp/beginnerSyntaxPresentation';
import { getLingCppModuleCommandNames } from '../services/lingCpp/monacoTokens';
import { LingCppModuleContext } from '../services/modules/types';
import {
  getBeginnerModuleCodeCompletions,
  getBeginnerModuleCommandHints,
  normalizeSnippetPlaceholders
} from '../services/modules/moduleContextAdapters';
import {
  applyPendingBeginnerCodeDrafts,
  createBeginnerCodeDraftKey,
  FlushPendingEditsResult
} from '../services/lingCpp/beginnerEditTransactionService';
import {
  TextEditorViewState,
  TextModelIdentity,
  getOrCreateWorkbenchTextHistory,
  getBeginnerBodySourceColumns,
  inferBeginnerBodyStartColumn,
  mapBeginnerBodyTextPosition,
  reconcileTextEditHistory,
  workbenchTextModelService
} from '../services/textModel';

export interface DiffViewerHandle {
  flushPendingEdits: () => Promise<FlushPendingEditsResult>;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  focusEditor: () => boolean;
}

interface DiffViewerProps {
  diffResult: DiffResult;
  strings: ExtractedString[];
  onUpdateStringTranslation: (id: string, value: string) => void;
  onResetTranslation: (id: string) => void;
  onUpdateSourceContent?: (value: string) => void;
  isDarkMode: boolean;
  activeFile?: any;
  editorFontSize?: number;
  onFontSizeChange?: (value: number | ((currentValue: number) => number)) => void;
  openTabs: string[];
  activeTabPath: string;
  onSelectTab: (file: any) => void;
  onCloseTab: (tabPath: string, event: React.MouseEvent) => void;
  allFiles: any[];
  designerProject?: LingWindowProject;
  moduleContext?: LingCppModuleContext;
  activeWindowId?: string;
  editorExperienceMode?: EditorExperienceMode;
  onExperienceModeChange?: (mode: EditorExperienceMode) => void | boolean | Promise<void | boolean>;
  problems?: ProblemItem[];
  ignoredBeginnerTaskIds?: string[];
  onIgnoreBeginnerTask?: (taskId: string) => void;
  onApplyWorkspaceEdit?: (proposal: WorkspaceEditProposal, appliedFiles: AppliedWorkspaceFile[]) => void;
  onOpenProblemsPanel?: () => void;
  onDiffViewModeChange?: (mode: DiffViewMode) => void;
  textModelWorkspaceId?: string;
  textModelProjectId?: string;
  onEditorStateChange?: (state: MonacoEditorState) => void;
}

function mapNativeBuildDiagnostics(
  logs: string[],
  sourceMap: LingCppNativeSourceMapEntry[]
): NativeMappedDiagnostic[] {
  const diagnostics: NativeMappedDiagnostic[] = [];
  const linePattern = /main\.cpp(?:\((\d+)\)|:(\d+)(?::\d+)?)/i;

  logs.forEach((log, index) => {
    const match = log.match(linePattern);
    if (!match) return;
    const generatedLine = Number.parseInt(match[1] || match[2] || '0', 10);
    if (!Number.isFinite(generatedLine) || generatedLine <= 0) return;

    const entry = sourceMap
      .filter(item => generatedLine >= item.generatedStartLine && generatedLine <= item.generatedEndLine)
      .sort((left, right) => (left.generatedEndLine - left.generatedStartLine) - (right.generatedEndLine - right.generatedStartLine))[0];

    diagnostics.push({
      id: `native-diagnostic-${index}-${generatedLine}`,
      message: log,
      generatedLine,
      sourceLine: entry?.sourceStartLine,
      sourceKind: entry?.kind,
      sourceSymbol: entry?.symbolName
    });
  });

  return diagnostics;
}

type StructureEditMode = 'package' | 'class' | 'member' | 'method' | 'event' | 'add-member' | 'add-event';

interface StructureEditDraft {
  mode: StructureEditMode;
  rowId?: string;
  line?: number;
  className?: string;
  targetName?: string;
  name: string;
  type: string;
  baseClass: string;
  initialValue: string;
  parameters: string;
  returnType: string;
  note: string;
}

type ParameterDraft = {
  type: string;
  name: string;
  defaultValue: string;
};

interface NativePreviewState {
  files: LingCppNativePreviewFile[];
  diagnostics: string[];
  enabledModules: string[];
  sourceMap: LingCppNativeSourceMapEntry[];
  selectedFilePath: string;
  selectedWindowTitle: string;
  lastExportDir?: string;
  lastBuildLogs: string[];
}

interface NativeMappedDiagnostic {
  id: string;
  message: string;
  generatedLine: number;
  sourceLine?: number;
  sourceKind?: LingCppNativeSourceMapEntry['kind'];
  sourceSymbol?: string;
}

type BeginnerCodeTarget = { className: string; method: LingCppMethod };

type StructureInputTone = 'plain' | 'type' | 'name' | 'value' | 'procedure' | 'variable' | 'parameter';
type StructureTextTone = StructureInputTone | 'muted';

interface BeginnerCodeCompletion {
  label: string;
  detail: string;
  insertText: string;
  aliases: string[];
  kind: '命令' | '流程' | '代码' | '变量' | '子程序' | '类型' | '窗口' | '位置';
  cursorOffset?: number;
  selectLength?: number;
}

interface BeginnerCompletionState {
  targetKey: string;
  token: string;
  items: BeginnerCodeCompletion[];
  selectedIndex: number;
  position: BeginnerCompletionPosition;
}

interface BeginnerCompletionPosition {
  top: number;
  left: number;
  maxListHeight: number;
  placement: 'above' | 'below';
}

interface BeginnerContextMenuState {
  x: number;
  y: number;
  className?: string;
  methodName?: string;
}

interface BeginnerJumpHighlightState {
  targetKey: string;
  line: number;
  label: string;
}

interface BeginnerTypeCompletionItem {
  label: string;
  detail: string;
  aliases: string[];
}

interface BeginnerTypeCompletionState {
  inputKey: string;
  value: string;
  items: BeginnerTypeCompletionItem[];
  selectedIndex: number;
  placement: 'above' | 'below';
  maxListHeight: number;
}

interface BeginnerCommandHintParameter {
  name: string;
  type: string;
  note: string;
}

interface BeginnerCommandHintInfo {
  command: string;
  signature: string;
  returnType: string;
  summary: string;
  parameters: BeginnerCommandHintParameter[];
  example: string;
}

interface BeginnerCommandHintState {
  targetKey: string;
  token: string;
  info: BeginnerCommandHintInfo;
  position: BeginnerCompletionPosition;
}

interface BeginnerCommandTokenAtCursor {
  token: string;
  lineIndex: number;
  columnStart: number;
}

type BeginnerIfBranchKind = 'if' | 'elseif' | 'else';

interface BeginnerIfBranch {
  kind: BeginnerIfBranchKind;
  line: number;
  text: string;
}

interface BeginnerIfBlock {
  startLine: number;
  endLine: number;
  branches: BeginnerIfBranch[];
  parent?: BeginnerIfBlock;
}

const BEGINNER_IF_SNIPPET = '如果 (条件)\n    \n否则\n    \n如果结束';

const BEGINNER_COMMAND_HINTS: Record<string, BeginnerCommandHintInfo> = {
  信息框: {
    command: '信息框',
    signature: '信息框(提示信息, 按钮值, 窗口标题)',
    returnType: '整数型',
    summary: '在窗口中显示一条提示，并根据用户点击的按钮返回一个整数值。',
    parameters: [
      { name: '提示信息', type: '文本型', note: '对话框里显示的正文内容。' },
      { name: '按钮值', type: '整数型', note: '按钮和图标组合；64 常用于信息提示，36 常用于是/否确认。' },
      { name: '窗口标题', type: '文本型', note: '对话框标题栏文字。' }
    ],
    example: '信息框("提示内容", 64, "提示")'
  },
  调试输出: {
    command: '调试输出',
    signature: '调试输出(文本)',
    returnType: '空',
    summary: '把一段文本写到调试输出窗口，用来观察程序运行到了哪里。',
    parameters: [
      { name: '文本', type: '文本型', note: '要输出的调试内容。' }
    ],
    example: '调试输出("按钮被单击")'
  },
  输出调试文本: {
    command: '输出调试文本',
    signature: '输出调试文本(文本)',
    returnType: '空',
    summary: '把调试文本写到输出窗口，作用等同于调试输出。',
    parameters: [
      { name: '文本', type: '文本型', note: '要输出的调试内容。' }
    ],
    example: '输出调试文本("进入流程")'
  },
  打开窗口: {
    command: '打开窗口',
    signature: '打开窗口(窗口标题或类名, [打开位置], [屏幕左距], [屏幕顶距])',
    returnType: '窗口句柄',
    summary: '打开设计器里已经存在的另一个窗口，适合菜单项或按钮跳转到登录、关于、设置等窗口。',
    parameters: [
      { name: '窗口标题或类名', type: '文本型', note: '填写目标窗口的标题或窗口类名，例如 "关于太空冒险客户端" 或 "关于窗体"。' },
      { name: '打开位置', type: '文本型', note: '可选。支持 "居中"、"左上角"、"右上角"、"左下角"、"右下角"、"自定义坐标"。' },
      { name: '屏幕左距/顶距', type: '整数型', note: '可选。写成 打开窗口("关于窗体", 120, 80) 或 打开窗口("关于窗体", "自定义坐标", 120, 80)。' }
    ],
    example: '打开窗口("关于太空冒险客户端", "居中")'
  },
  窗口_打开: {
    command: '窗口_打开',
    signature: '窗口_打开(窗口标题或类名, [打开位置], [屏幕左距], [屏幕顶距])',
    returnType: '窗口句柄',
    summary: '打开设计器里已经存在的另一个窗口，作用等同于“打开窗口”。',
    parameters: [
      { name: '窗口标题或类名', type: '文本型', note: '填写目标窗口的标题或窗口类名。' },
      { name: '打开位置', type: '文本型', note: '可选。支持 "居中"、"左上角"、"右下角" 等。' }
    ],
    example: '窗口_打开("关于太空冒险客户端", "右下角")'
  },
  载入窗口: {
    command: '载入窗口',
    signature: '载入窗口(窗口标题或类名, [打开位置])',
    returnType: '窗口句柄',
    summary: '打开设计器里已经存在的另一个窗口，兼容“载入”这种中文说法。',
    parameters: [
      { name: '窗口标题或类名', type: '文本型', note: '填写目标窗口的标题或窗口类名。' },
      { name: '打开位置', type: '文本型', note: '可选。支持 "居中"、"左上角"、"右下角" 等。' }
    ],
    example: '载入窗口("登录窗口", "居中")'
  },
  载入新窗口: {
    command: '载入新窗口',
    signature: '载入新窗口(窗口标题或类名, [打开位置])',
    returnType: '窗口句柄',
    summary: '打开设计器里已经存在的另一个窗口，兼容“载入新窗口”的表达。',
    parameters: [
      { name: '窗口标题或类名', type: '文本型', note: '填写目标窗口的标题或窗口类名。' },
      { name: '打开位置', type: '文本型', note: '可选。支持 "居中"、"左上角"、"右下角" 等。' }
    ],
    example: '载入新窗口("登录窗口", "左上角")'
  },
  如果: {
    command: '如果',
    signature: '如果 (条件) ... 如果结束',
    returnType: '流程控制',
    summary: '当条件成立时执行其中的代码；条件不成立时跳过，或进入否则分支。',
    parameters: [
      { name: '条件', type: '逻辑型', note: '结果应为真或假，例如 信息框(...) == 6。' }
    ],
    example: '如果 (信息框("确认？", 36, "提示") == 6)'
  },
  否则如果: {
    command: '否则如果',
    signature: '否则如果 (条件)',
    returnType: '流程控制',
    summary: '前面的如果不成立时，继续判断另一个条件。',
    parameters: [
      { name: '条件', type: '逻辑型', note: '用于追加判断的真/假表达式。' }
    ],
    example: '否则如果 (次数 > 3)'
  },
  否则: {
    command: '否则',
    signature: '否则',
    returnType: '流程控制',
    summary: '如果前面的条件都不成立，就执行否则下面的代码。',
    parameters: [],
    example: '否则'
  },
  如果结束: {
    command: '如果结束',
    signature: '如果结束',
    returnType: '流程控制',
    summary: '结束当前如果结构。',
    parameters: [],
    example: '如果结束'
  },
  返回: {
    command: '返回',
    signature: '返回 (返回值)',
    returnType: '流程控制',
    summary: '结束当前子程序；有返回值类型时可带上返回值。',
    parameters: [
      { name: '返回值', type: '可选', note: '返回值类型为 空 时通常不填写。' }
    ],
    example: '返回 (0)'
  },
  结束: {
    command: '结束',
    signature: '结束()',
    returnType: '空',
    summary: '结束当前程序运行。',
    parameters: [],
    example: '结束()'
  }
};

const BEGINNER_TYPE_ALIASES: Record<string, string[]> = {
  空: ['void', 'none', 'null', 'kong', 'wu', '无返回值', '无'],
  文本型: ['string', 'text', 'str', 'wstring', 'wenben', 'wb', '字符', '字符串'],
  整数型: ['int', 'integer', 'number', 'zhengshu', 'zs', '数字'],
  长整数型: ['long', 'long long', 'int64', 'longint', 'changzhengshu', 'czs'],
  逻辑型: ['bool', 'boolean', 'logic', 'luoji', 'lj', '布尔'],
  小数型: ['float', 'decimal', 'number', 'xiaoshu', 'xs'],
  双精度小数型: ['double', 'shuangjingdu', 'sjd'],
  字节型: ['byte', 'uint8', 'zijie', 'zj'],
  对象: ['object', 'obj', 'any', 'duixiang', 'dx'],
  窗体: ['window', 'form', 'wnd', 'chuangti', 'ct'],
  按钮: ['button', 'btn', 'anniu', 'an'],
  标签: ['label', 'biaoqian', 'bq'],
  编辑框: ['edit', 'textbox', 'input', 'bianjikuang', 'bjk'],
  复选框: ['checkbox', 'check', 'fuxuankuang', 'fxk'],
  单选框: ['radio', 'danxuankuang', 'dxk'],
  下拉框: ['combo', 'select', 'dropdown', 'xialakuang', 'xlk'],
  进度条: ['progress', 'progressbar', 'jindutiao', 'jdt']
};

const buildBeginnerTypeCompletionCatalog = (types: string[]): BeginnerTypeCompletionItem[] => {
  const normalizedTypes = Array.from(new Set(['空', ...types].map(type => type.trim()).filter(Boolean)));
  return normalizedTypes.map(label => {
    const aliases = Array.from(new Set([label, ...(BEGINNER_TYPE_ALIASES[label] || [])].filter(Boolean)));
    const aliasPreview = aliases.filter(alias => alias !== label).slice(0, 3).join(' / ');
    return {
      label,
      aliases,
      detail: aliasPreview ? `类型 · ${aliasPreview}` : '类型'
    };
  });
};

const filterBeginnerTypeCompletions = (
  items: BeginnerTypeCompletionItem[],
  token: string,
  includeAll = false
) => {
  const normalizedToken = token.trim().toLowerCase();
  if (!normalizedToken && !includeAll) return [];
  if (!normalizedToken) return items;

  return items
    .map(item => {
      const values = item.aliases.map(alias => alias.toLowerCase());
      const label = item.label.toLowerCase();
      const exactMatch = values.some(value => value === normalizedToken);
      const labelStartsWith = label.startsWith(normalizedToken);
      const aliasStartsWith = values.some(value => value.startsWith(normalizedToken));
      const includesMatch = values.some(value => value.includes(normalizedToken));
      return {
        item,
        rank: exactMatch ? 0 : labelStartsWith ? 1 : aliasStartsWith ? 2 : includesMatch ? 3 : 9
      };
    })
    .filter(result => result.rank < 9)
    .sort((left, right) => left.rank - right.rank || left.item.label.localeCompare(right.item.label, 'zh-Hans-CN'))
    .map(result => result.item);
};

const getBeginnerTypeCompletionLayout = (
  input: HTMLInputElement,
  itemCount: number
): Pick<BeginnerTypeCompletionState, 'placement' | 'maxListHeight'> => {
  const scrollRoot = input.closest('[data-beginner-structure-scroll]');
  const inputRect = input.getBoundingClientRect();
  const boundaryRect = scrollRoot instanceof HTMLElement
    ? scrollRoot.getBoundingClientRect()
    : { top: 0, bottom: window.innerHeight };
  const panelGap = 6;
  const panelHeaderHeight = 25;
  const desiredListHeight = Math.min(224, Math.max(1, Math.min(itemCount, 5)) * 42);
  const desiredPanelHeight = panelHeaderHeight + desiredListHeight;
  const spaceBelow = boundaryRect.bottom - inputRect.bottom - panelGap;
  const spaceAbove = inputRect.top - boundaryRect.top - panelGap;
  const placement = spaceBelow < Math.min(132, desiredPanelHeight) && spaceAbove > spaceBelow
    ? 'above'
    : 'below';
  const availableSpace = placement === 'above' ? spaceAbove : spaceBelow;
  return {
    placement,
    maxListHeight: clampNumber(availableSpace - panelHeaderHeight - panelGap, 60, 224)
  };
};

const BEGINNER_CODE_COMPLETIONS: BeginnerCodeCompletion[] = [
  {
    label: '调试输出',
    detail: '输出一行调试文本',
    insertText: '调试输出("")',
    aliases: ['tssc', 'tiaoshishuchu', 'ts', 'debug', '调试', '输出'],
    kind: '命令',
    cursorOffset: '调试输出("'.length
  },
  {
    label: '如果',
    detail: '条件判断结构',
    insertText: BEGINNER_IF_SNIPPET,
    aliases: ['rg', 'ruguo', 'ru', '如', '如果'],
    kind: '流程',
    cursorOffset: '如果 ('.length,
    selectLength: '条件'.length
  },
  {
    label: '信息框',
    detail: '显示提示窗口',
    insertText: '信息框("提示内容", 64, "提示")',
    aliases: ['xxk', 'xinxikuang', 'message', 'msg', '提示'],
    kind: '命令',
    cursorOffset: '信息框("'.length,
    selectLength: '提示内容'.length
  },
  {
    label: '打开窗口',
    detail: '打开另一个设计器窗口',
    insertText: '打开窗口("窗口标题")',
    aliases: ['dkck', 'ck', 'openwindow', 'showwindow', '窗口_打开', '载入窗口', '载入新窗口', 'zairu', 'zrck', '打开窗口'],
    kind: '命令',
    cursorOffset: '打开窗口("'.length,
    selectLength: '窗口标题'.length
  },
  {
    label: '打开窗口居中',
    detail: '居中打开另一个设计器窗口',
    insertText: '打开窗口("窗口标题", "居中")',
    aliases: ['dkckjz', 'jzdk', 'centerwindow', '居中打开', '打开窗口居中'],
    kind: '命令',
    cursorOffset: '打开窗口("'.length,
    selectLength: '窗口标题'.length
  },
  {
    label: '否则',
    detail: '如果条件不成立时执行',
    insertText: '否则',
    aliases: ['f', 'fz', 'fouze', 'else', '否', '否则'],
    kind: '流程'
  },
  {
    label: '否则如果',
    detail: '继续判断另一个条件',
    insertText: '否则如果 (条件)',
    aliases: ['fzr', 'fzrg', 'fouzeruguo', 'elseif', 'else if', '否则如果'],
    kind: '流程',
    cursorOffset: '否则如果 ('.length,
    selectLength: '条件'.length
  },
  {
    label: '返回',
    detail: '结束当前功能并返回',
    insertText: '返回',
    aliases: ['fh', 'FH', 'fg', 'FG', 'fanhui', 'fan hui', 'return', 'ret', '返回值', '返回'],
    kind: '流程'
  },
  {
    label: '@ 原生C++',
    detail: '插入一行内嵌 C++ 代码',
    insertText: '@ ',
    aliases: ['cpp', 'c++', 'ys', 'yuansheng', '@'],
    kind: '代码',
    cursorOffset: 2
  }
];

const BEGINNER_WINDOW_PLACEMENT_COMPLETIONS: BeginnerCodeCompletion[] = [
  { label: '居中', detail: '在屏幕工作区居中显示', insertText: '居中', aliases: ['jz', 'center', 'middle', '居中显示'], kind: '位置' },
  { label: '左上角', detail: '贴近屏幕工作区左上角显示', insertText: '左上角', aliases: ['zsj', 'lefttop', 'top-left', '左上'], kind: '位置' },
  { label: '右上角', detail: '贴近屏幕工作区右上角显示', insertText: '右上角', aliases: ['ysj', 'righttop', 'top-right', '右上'], kind: '位置' },
  { label: '左下角', detail: '贴近屏幕工作区左下角显示', insertText: '左下角', aliases: ['zxj', 'leftbottom', 'bottom-left', '左下'], kind: '位置' },
  { label: '右下角', detail: '贴近屏幕工作区右下角显示', insertText: '右下角', aliases: ['yxj', 'rightbottom', 'bottom-right', '右下'], kind: '位置' },
  { label: '自定义坐标', detail: '继续填写屏幕左距和顶距，例如 120, 80', insertText: '自定义坐标', aliases: ['zdy', 'custom', 'xy', '坐标'], kind: '位置' }
];

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const scrollElementInsideBeginnerEditor = (
  element: HTMLElement | null | undefined,
  align: 'start' | 'center' = 'center'
) => {
  if (!element) return;

  const scrollRoot = element.closest('[data-beginner-structure-scroll]');
  if (!(scrollRoot instanceof HTMLElement)) return;

  const rootRect = scrollRoot.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const elementTop = scrollRoot.scrollTop + elementRect.top - rootRect.top;
  const targetTop = align === 'start'
    ? elementTop - 8
    : elementTop - Math.max(0, (scrollRoot.clientHeight - elementRect.height) / 2);

  scrollRoot.scrollTo({
    top: Math.max(0, targetTop),
    behavior: 'smooth'
  });

  if (window.scrollX !== 0 || window.scrollY !== 0) {
    window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
  }
};

const getBeginnerCompletionPanelPosition = (
  input: HTMLTextAreaElement,
  token: string,
  itemCount: number
): BeginnerCompletionPosition => {
  const root = input.closest('[data-beginner-editor-root]');
  if (!(root instanceof HTMLElement)) {
    return { top: 34, left: 60, maxListHeight: 190, placement: 'below' };
  }

  const rootRect = root.getBoundingClientRect();
  const inputRect = input.getBoundingClientRect();
  const scrollRoot = input.closest('[data-beginner-structure-scroll]');
  const boundaryRect = scrollRoot instanceof HTMLElement
    ? scrollRoot.getBoundingClientRect()
    : { top: 0, bottom: window.innerHeight };
  const inputStyle = window.getComputedStyle(input);
  const lineHeight = Number.parseFloat(inputStyle.lineHeight) || 20;
  const paddingTop = Number.parseFloat(inputStyle.paddingTop) || 0;
  const paddingLeft = Number.parseFloat(inputStyle.paddingLeft) || 0;
  const fontSize = Number.parseFloat(inputStyle.fontSize) || 12;
  const panelWidth = 280;
  const panelGap = 6;
  const panelHeaderHeight = 26;
  const valueBeforeCursor = input.value.slice(0, input.selectionStart);
  const lineStart = valueBeforeCursor.lastIndexOf('\n') + 1;
  const linePrefix = valueBeforeCursor.slice(lineStart);
  const lineIndex = valueBeforeCursor.split('\n').length - 1;
  const tokenColumn = Math.max(0, linePrefix.length - token.length);
  const estimatedCharWidth = fontSize * 0.62;
  const lineTopInRoot = inputRect.top - rootRect.top + paddingTop + lineIndex * lineHeight - input.scrollTop;
  const lineTopInViewport = inputRect.top + paddingTop + lineIndex * lineHeight - input.scrollTop;
  const lineBottomInRoot = lineTopInRoot + lineHeight;
  const lineBottomInViewport = lineTopInViewport + lineHeight;
  const spaceBelow = boundaryRect.bottom - lineBottomInViewport - panelGap;
  const spaceAbove = lineTopInViewport - boundaryRect.top - panelGap;
  const estimatedRowsHeight = Math.min(190, Math.max(1, Math.min(itemCount, 5)) * 42);
  const estimatedPanelHeight = panelHeaderHeight + estimatedRowsHeight;
  const placement = spaceBelow < Math.min(120, estimatedPanelHeight) && spaceAbove > spaceBelow
    ? 'above'
    : 'below';
  const availableSpace = placement === 'below' ? spaceBelow : spaceAbove;
  const maxListHeight = clampNumber(availableSpace - panelHeaderHeight - panelGap, 64, 190);
  const panelHeight = panelHeaderHeight + maxListHeight;
  const top = placement === 'above'
    ? lineTopInRoot - panelHeight - panelGap
    : lineBottomInRoot + panelGap;
  const tokenLeft = inputRect.left - rootRect.left + paddingLeft + tokenColumn * estimatedCharWidth - input.scrollLeft;
  const minLeft = inputRect.left - rootRect.left + paddingLeft;
  const maxLeft = Math.max(minLeft, root.clientWidth - panelWidth - 8);

  return {
    top: Math.round(top),
    left: Math.round(clampNumber(tokenLeft, minLeft, maxLeft)),
    maxListHeight: Math.round(maxListHeight),
    placement
  };
};

const getBeginnerCommandTokenAtCursor = (
  value: string,
  cursor: number
): BeginnerCommandTokenAtCursor | null => {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const previousNewline = safeCursor > 0 ? value.lastIndexOf('\n', safeCursor - 1) : -1;
  const lineStart = previousNewline + 1;
  const nextNewline = value.indexOf('\n', safeCursor);
  const lineEnd = nextNewline >= 0 ? nextNewline : value.length;
  const line = value.slice(lineStart, lineEnd);
  const column = safeCursor - lineStart;
  const tokenPattern = /[a-zA-Z0-9_@\u4e00-\u9fa5]+/gu;

  for (const match of line.matchAll(tokenPattern)) {
    const columnStart = match.index ?? 0;
    const token = match[0];
    const columnEnd = columnStart + token.length;
    if (column < columnStart || column > columnEnd || !BEGINNER_COMMAND_HINTS[token]) continue;

    const prefixSyntax = scanBeginnerCodePrefix(line.slice(0, columnStart));
    if (prefixSyntax.isInsideString || prefixSyntax.isInsideComment) return null;

    return {
      token,
      lineIndex: value.slice(0, lineStart).split('\n').length - 1,
      columnStart
    };
  }

  return null;
};

const getBeginnerCommandHintPanelPosition = (
  input: HTMLTextAreaElement,
  token: BeginnerCommandTokenAtCursor,
  estimatedPanelHeight: number
): BeginnerCompletionPosition => {
  const root = input.closest('[data-beginner-editor-root]');
  if (!(root instanceof HTMLElement)) {
    return { top: 34, left: 60, maxListHeight: 260, placement: 'below' };
  }

  const rootRect = root.getBoundingClientRect();
  const inputRect = input.getBoundingClientRect();
  const scrollRoot = input.closest('[data-beginner-structure-scroll]');
  const boundaryRect = scrollRoot instanceof HTMLElement
    ? scrollRoot.getBoundingClientRect()
    : { top: 0, bottom: window.innerHeight };
  const inputStyle = window.getComputedStyle(input);
  const lineHeight = Number.parseFloat(inputStyle.lineHeight) || 20;
  const paddingTop = Number.parseFloat(inputStyle.paddingTop) || 0;
  const paddingLeft = Number.parseFloat(inputStyle.paddingLeft) || 0;
  const fontSize = Number.parseFloat(inputStyle.fontSize) || 12;
  const panelWidth = 420;
  const panelGap = 8;
  const panelHeight = clampNumber(estimatedPanelHeight, 132, 300);
  const estimatedCharWidth = fontSize * 0.62;
  const lineTopInRoot = inputRect.top - rootRect.top + paddingTop + token.lineIndex * lineHeight - input.scrollTop;
  const lineTopInViewport = inputRect.top + paddingTop + token.lineIndex * lineHeight - input.scrollTop;
  const lineBottomInRoot = lineTopInRoot + lineHeight;
  const lineBottomInViewport = lineTopInViewport + lineHeight;
  const spaceBelow = boundaryRect.bottom - lineBottomInViewport - panelGap;
  const spaceAbove = lineTopInViewport - boundaryRect.top - panelGap;
  const placement = spaceBelow < Math.min(170, panelHeight) && spaceAbove > spaceBelow
    ? 'above'
    : 'below';
  const availableSpace = placement === 'below' ? spaceBelow : spaceAbove;
  const maxPanelHeight = clampNumber(availableSpace - panelGap, 112, 300);
  const actualPanelHeight = Math.min(panelHeight, maxPanelHeight);
  const preferredLeft = inputRect.left - rootRect.left + paddingLeft + token.columnStart * estimatedCharWidth - input.scrollLeft;
  const minLeft = 8;
  const maxLeft = Math.max(minLeft, root.clientWidth - panelWidth - 8);

  return {
    top: Math.round(placement === 'above'
      ? lineTopInRoot - actualPanelHeight - panelGap
      : lineBottomInRoot + panelGap),
    left: Math.round(clampNumber(preferredLeft, minLeft, maxLeft)),
    maxListHeight: Math.round(maxPanelHeight),
    placement
  };
};

const filterBeginnerCodeCompletions = (
  token: string,
  includeAll = false,
  items: BeginnerCodeCompletion[] = BEGINNER_CODE_COMPLETIONS
) => {
  const normalizedToken = token.trim().toLowerCase();
  if (!normalizedToken && !includeAll) return [];
  if (!normalizedToken) return items;

  return items
    .map(item => {
      const values = [item.label, ...item.aliases].map(value => value.toLowerCase());
      const exactMatch = values.some(value => value === normalizedToken);
      const startsWithMatch = values.some(value => value.startsWith(normalizedToken));
      const includesMatch = values.some(value => value.includes(normalizedToken));
      return { item, rank: exactMatch ? 0 : startsWithMatch ? 1 : includesMatch ? 2 : 9 };
    })
    .filter(result => result.rank < 9)
    .sort((left, right) => left.rank - right.rank || left.item.label.localeCompare(right.item.label, 'zh-Hans-CN'))
    .map(result => result.item);
};

const buildBeginnerWindowTargetCompletions = (designerProject?: LingWindowProject): BeginnerCodeCompletion[] => {
  if (!designerProject) return [];
  const items = designerProject.windows.flatMap(window => {
    const title = (window.title || '').trim();
    const className = (window.className || '').trim();
    const fileName = (window.fileName || '').trim();
    const aliases = [title, className, fileName, '窗口', '窗体', '打开窗口'].filter(Boolean);
    const completions: BeginnerCodeCompletion[] = [];

    if (title) {
      completions.push({
        label: title,
        detail: className ? `窗口标题 · 类名 ${className}` : '窗口标题',
        insertText: title,
        aliases,
        kind: '窗口'
      });
    }

    if (className && className !== title) {
      completions.push({
        label: className,
        detail: title ? `窗口类名 · 标题 ${title}` : '窗口类名',
        insertText: className,
        aliases,
        kind: '窗口'
      });
    }

    return completions;
  });

  return Array.from(new Map(items.map(item => [`${item.label}:${item.insertText}`, item])).values());
};

const getBeginnerLineAtOffset = (value: string, offset: number) =>
  value.slice(0, Math.max(0, offset)).split('\n').length;

const getBeginnerLineOffset = (lines: string[], line: number) => {
  const targetLine = Math.max(1, Math.min(line, Math.max(1, lines.length)));
  let offset = 0;
  for (let index = 0; index < targetLine - 1; index += 1) {
    offset += lines[index].length + 1;
  }
  return offset;
};

const beginnerIfLineKind = (line: string): BeginnerIfBranchKind | 'end' | undefined => {
  const trimmed = line.trim();
  if (/^如果结束(?:\s|$|[）)])?/u.test(trimmed)) return 'end';
  if (/^否则如果(?:\s|$|[（(])/u.test(trimmed)) return 'elseif';
  if (/^否则(?:\s|$|[（(])/u.test(trimmed)) return 'else';
  if (/^如果(?:\s|$|[（(])/u.test(trimmed)) return 'if';
  return undefined;
};

const parseBeginnerIfBlocks = (lines: string[]): BeginnerIfBlock[] => {
  const blocks: BeginnerIfBlock[] = [];
  const stack: BeginnerIfBlock[] = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const kind = beginnerIfLineKind(line);
    if (!kind) return;

    if (kind === 'end') {
      const current = stack.pop();
      if (current) current.endLine = lineNumber;
      return;
    }

    if (kind === 'elseif' || kind === 'else') {
      const current = stack.at(-1);
      if (current) {
        current.branches.push({ kind, line: lineNumber, text: line.trim() });
      }
      return;
    }

    const parent = stack.at(-1);
    const block: BeginnerIfBlock = {
      startLine: lineNumber,
      endLine: lines.length,
      parent,
      branches: [{ kind: 'if', line: lineNumber, text: line.trim() }]
    };
    blocks.push(block);
    stack.push(block);
  });

  return blocks;
};

const findBeginnerIfBlocksAtLine = (blocks: BeginnerIfBlock[], line: number) =>
  blocks
    .filter(block => line >= block.startLine && line <= block.endLine)
    .sort((left, right) => {
      const leftSpan = left.endLine - left.startLine;
      const rightSpan = right.endLine - right.startLine;
      return leftSpan - rightSpan || right.startLine - left.startLine;
    });

const currentBeginnerBranch = (block: BeginnerIfBlock, line: number) =>
  [...block.branches]
    .sort((left, right) => left.line - right.line)
    .filter(branch => branch.line <= line)
    .at(-1) || block.branches[0];

const beginnerStructureAnchors = (block: BeginnerIfBlock) => {
  const anchors = [...block.branches]
    .sort((left, right) => left.line - right.line)
    .map(branch => ({
      line: branch.line,
      label: branch.kind === 'if' ? branch.text || '如果' : branch.kind === 'elseif' ? branch.text || '否则如果' : '否则'
    }));
  if (block.endLine >= block.startLine) anchors.push({ line: block.endLine, label: '如果结束' });
  return anchors.filter((anchor, index, all) => all.findIndex(item => item.line === anchor.line) === index);
};

const CONTROL_MEMBER_TYPE_PATTERN = /按钮|标签|编辑框|复选框|单选框|下拉框|控件|窗体/u;

const isControlMemberRow = (row: LingCppStructuredReadingRow) =>
  row.group === 'member' && CONTROL_MEMBER_TYPE_PATTERN.test(row.type || '');

// Diff Contrast Presets for customized developer visibility
type DiffPreset = 'vs-dark' | 'neon-high-contrast' | 'cyberpunk' | 'solarized-dark' | 'classic-light';

type EplVisualLineKind = 'normal' | 'subprogram' | 'localVariable' | 'programVariable';

interface EplSubprogramVisual {
  name: string;
  returnType: string;
  visibility: string;
  remark: string;
}

interface EplVariableVisual {
  scope: string;
  name: string;
  type: string;
  remark: string;
}

interface EplVisualLine {
  kind: EplVisualLineKind;
  guides: number[];
  subprogram?: EplSubprogramVisual;
  variable?: EplVariableVisual;
}

const EPL_NAME_REPLACEMENTS: Array<[RegExp, string]> = [
  [/窗口程序集_主窗口/g, '窗口程序集_窗口1'],
  [/_主窗口_创建完毕/g, '_窗口1_创建完毕'],
  [/_开始按钮_被单击/g, '_按钮1_被单击'],
  [/_开始游戏按钮_单击/g, '_按钮1_被单击'],
  [/_开始游戏按钮_被单击/g, '_按钮1_被单击'],
  [/_重置配置按钮_被单击/g, '_按钮2_被单击'],
  [/_退出客户端按钮_单击/g, '_按钮2_被单击'],
  [/_退出客户端按钮_被单击/g, '_按钮2_被单击'],
  [/_退出按钮_被单击/g, '_按钮2_被单击'],
  [/_按钮3_被单击/g, '_按钮2_被单击']
];

const optimizeEplName = (value: string) => {
  return EPL_NAME_REPLACEMENTS.reduce((nextValue, [pattern, replacement]) => {
    return nextValue.replace(pattern, replacement);
  }, value);
};

const EPL_FLOW_GUIDE_COLORS = ['#2ea8ff', '#39d98a', '#ffd166', '#ff6b6b', '#b36bff', '#31d7d1'];

const EPL_FLOW_START_PATTERN = /^\.?(如果|如果真|判断|判断循环首|循环判断首|计次循环首|变量循环首|枚举循环首)(?:\s|$|[（(])/;
const EPL_FLOW_END_PATTERN = /^\.?(如果结束|判断结束|判断循环尾|循环判断尾|计次循环尾|变量循环尾|循环尾)(?:\s|$|[（(])/;

const splitEplArguments = (value: string) => {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | '“' | "'" | null = null;

  for (const char of value) {
    if (quote) {
      current += char;
      if ((quote === '"' && char === '"') || (quote === '“' && char === '”') || (quote === "'" && char === "'")) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === '“' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === ',' || char === '，') {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  parts.push(current.trim());
  return parts;
};

const stripEplText = (value?: string) => {
  const text = (value ?? '').trim();
  if (!text) return '';
  return text.replace(/^[“"']|[”"']$/g, '').trim();
};

const normalizeEplVisibility = (value?: string) => {
  const visibility = stripEplText(value);
  if (!visibility) return '私有';
  if (/^(真|是|公开|public|1)$/i.test(visibility)) return '公开';
  if (/^(假|否|私有|private|0)$/i.test(visibility)) return '私有';
  return visibility;
};

const parseEplSubprogram = (body: string): EplSubprogramVisual => {
  const args = splitEplArguments(body.slice('.子程序'.length).trim());
  return {
    name: stripEplText(args[0]) || '未命名子程序',
    returnType: stripEplText(args[1]) || '无',
    visibility: normalizeEplVisibility(args[2]),
    remark: stripEplText(args[3]) || '无'
  };
};

const parseEplVariable = (body: string, command: '.局部变量' | '.程序集变量'): EplVariableVisual => {
  const args = splitEplArguments(body.slice(command.length).trim());
  const quotedRemark = args.slice(2).find(part => /^[“"']/.test(part.trim()));
  return {
    scope: command === '.局部变量' ? '局部变量' : '程序集变量',
    name: stripEplText(args[0]) || '未命名变量',
    type: stripEplText(args[1]) || '变体型',
    remark: stripEplText(quotedRemark ?? args[4]) || '无'
  };
};

const buildEplVisualLines = (lines: string[]): EplVisualLine[] => {
  const flowStack: number[] = [];

  return lines.map(line => {
    const body = line.trim();
    const startsFlow = EPL_FLOW_START_PATTERN.test(body);
    const endsFlow = EPL_FLOW_END_PATTERN.test(body);
    const startGuideColor = flowStack.length % EPL_FLOW_GUIDE_COLORS.length;
    let guides = [...flowStack];

    if (startsFlow) {
      guides = [...guides, startGuideColor];
    }

    let visualLine: EplVisualLine = {
      kind: 'normal',
      guides
    };

    if (body.startsWith('.子程序')) {
      visualLine = {
        ...visualLine,
        kind: 'subprogram',
        subprogram: parseEplSubprogram(body)
      };
    } else if (body.startsWith('.局部变量')) {
      visualLine = {
        ...visualLine,
        kind: 'localVariable',
        variable: parseEplVariable(body, '.局部变量')
      };
    } else if (body.startsWith('.程序集变量')) {
      visualLine = {
        ...visualLine,
        kind: 'programVariable',
        variable: parseEplVariable(body, '.程序集变量')
      };
    }

    if (endsFlow && flowStack.length > 0) {
      flowStack.pop();
    }
    if (startsFlow) {
      flowStack.push(startGuideColor);
    }

    return visualLine;
  });
};

function beginnerSourcePositionAtOffset(
  textarea: HTMLTextAreaElement,
  offset: number
): { line: number; column: number } {
  const sourceLines = (textarea.dataset.sourceLineMap || '')
    .split(',')
    .map(value => Number.parseInt(value, 10))
    .filter(value => Number.isInteger(value) && value > 0);
  const sourceColumns = (textarea.dataset.sourceColumnMap || '')
    .split(',')
    .map(value => Number.parseInt(value, 10))
    .filter(value => Number.isInteger(value) && value > 0);
  const fallbackStartLine = Number.parseInt(textarea.dataset.sourceLineStart || '', 10);
  const fallbackStartColumn = Number.parseInt(textarea.dataset.sourceColumnStart || '', 10);
  return mapBeginnerBodyTextPosition(
    textarea.value,
    offset,
    sourceLines,
    Number.isInteger(fallbackStartLine) && fallbackStartLine > 0 ? fallbackStartLine : 1,
    sourceColumns,
    Number.isInteger(fallbackStartColumn) && fallbackStartColumn > 0 ? fallbackStartColumn : 1
  );
}

function readSerializableObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const DiffViewer = React.forwardRef<DiffViewerHandle, DiffViewerProps>(function DiffViewer({
  diffResult,
  strings,
  onUpdateStringTranslation,
  onResetTranslation,
  onUpdateSourceContent,
  isDarkMode,
  activeFile,
  editorFontSize = 13,
  onFontSizeChange,
  openTabs,
  activeTabPath,
  onSelectTab,
  onCloseTab,
  allFiles,
  designerProject,
  moduleContext,
  activeWindowId,
  editorExperienceMode = 'beginner',
  onExperienceModeChange,
  problems = [],
  ignoredBeginnerTaskIds = [],
  onIgnoreBeginnerTask,
  onApplyWorkspaceEdit,
  onOpenProblemsPanel,
  onDiffViewModeChange,
  textModelWorkspaceId = 'lingbuilder-renderer',
  textModelProjectId = 'default-project',
  onEditorStateChange
}: DiffViewerProps, ref) {
  const [viewType, setViewType] = useState<'code' | 'designer'>('code');

  useEffect(() => {
    const handleForceCodeView = () => {
      setViewType('code');
    };
    window.addEventListener('force-code-view', handleForceCodeView);
    return () => {
      window.removeEventListener('force-code-view', handleForceCodeView);
    };
  }, []);





  const [viewMode, setViewMode] = useState<DiffViewMode>('chinese');
  useEffect(() => {
    const handleModeChange = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: DiffViewMode }>).detail?.mode;
      if (mode === 'chinese' || mode === 'split' || mode === 'unified') {
        setViewType('code');
        setViewMode(mode);
      }
    };
    window.addEventListener(DIFF_VIEW_MODE_CHANGE_EVENT, handleModeChange);
    return () => window.removeEventListener(DIFF_VIEW_MODE_CHANGE_EVENT, handleModeChange);
  }, []);
  const [preset, setPreset] = useState<DiffPreset>(isDarkMode ? 'vs-dark' : 'classic-light');
  const searchQuery: string = '';
  const [editingStringId, setEditingStringId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [showFolds, setShowFolds] = useState(true);
  const [showLingCppStructure, setShowLingCppStructure] = useState(true);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const monacoEditorRef = useRef<MonacoCodeEditorHandle>(null);
  const professionalHistoryApplyRef = useRef(false);
  const latestEditorStateRef = useRef<MonacoEditorState | null>(null);
  const sourceModelIdentity = useMemo<TextModelIdentity>(() => ({
    workspaceId: textModelWorkspaceId,
    projectId: textModelProjectId,
    filePath: activeFile?.path || 'untitled/source.txt'
  }), [activeFile?.path, textModelProjectId, textModelWorkspaceId]);
  const sourceModelRecord = workbenchTextModelService.ensure(sourceModelIdentity);
  const publishEditorState = useCallback((state: MonacoEditorState) => {
    latestEditorStateRef.current = state;
    setCursorPosition({ line: state.line, column: state.column });
    onEditorStateChange?.(state);
  }, [onEditorStateChange]);
  const [selectedBeginnerHandler, setSelectedBeginnerHandler] = useState<string | null>(null);
  const selectedBeginnerHandlerRef = useRef<string | null>(null);
  selectedBeginnerHandlerRef.current = selectedBeginnerHandler;
  const [selectedBeginnerCodeTarget, setSelectedBeginnerCodeTarget] = useState<{ className?: string; methodName: string } | null>(null);
  const [collapsedVolcanoSections, setCollapsedVolcanoSections] = useState<string[]>([]);
  const [readingMode, setReadingMode] = useState<LingCppReadingMode>(editorExperienceMode === 'beginner' ? 'beginner' : 'off');
  const [focusedReadableBlockId, setFocusedReadableBlockId] = useState<string | undefined>();
  const [structureEditDraft, setStructureEditDraft] = useState<StructureEditDraft | null>(null);
  const [structureEditError, setStructureEditError] = useState<string | null>(null);
  const [newMemberDraft, setNewMemberDraft] = useState({ type: '文本型', name: '', initialValue: '', isStatic: false, isArray: false, note: '' });
  const [showBeginnerTools, setShowBeginnerTools] = useState(false);
  const [newEventDraft, setNewEventDraft] = useState({ handlerName: '', parameters: '' });
  const [newFunctionDraft, setNewFunctionDraft] = useState({ returnType: '空', name: '', parameters: '' });
  const [newParameterDrafts, setNewParameterDrafts] = useState<Record<string, ParameterDraft>>({});
  const [functionCallDrafts, setFunctionCallDrafts] = useState<Record<string, Record<string, string>>>({});
  const [sourceScroll, setSourceScroll] = useState({ top: 0, left: 0 });
  const [pendingHandlerFocus, setPendingHandlerFocus] = useState<{ handlerName: string; filePath?: string } | null>(null);
  const [expandedBeginnerEventTargetKey, setExpandedBeginnerEventTargetKey] = useState<string | null>(null);
  const [expandedBeginnerFunctionTargetKey, setExpandedBeginnerFunctionTargetKey] = useState<string | null>(null);
  const [selectedFunctionTemplateKey, setSelectedFunctionTemplateKey] = useState<string | null>(null);
  const [nativePreviewState, setNativePreviewState] = useState<NativePreviewState | null>(null);
  const nativePreviewStateRef = useRef<NativePreviewState | null>(null);
  nativePreviewStateRef.current = nativePreviewState;
  const nativePreviewOwnerRef = useRef<{
    ownerKey: string;
    token: { modelId: string; generation: number };
  } | null>(null);
  const nativePreviewRequestRef = useRef(0);
  const nativePreviewAbortRef = useRef<AbortController | null>(null);
  const sourceModelOwnerKey = `${sourceModelRecord.modelId}:${sourceModelIdentity.filePath}`;
  const activeSourceOwnerKeyRef = useRef(sourceModelOwnerKey);
  activeSourceOwnerKeyRef.current = sourceModelOwnerKey;
  const [isNativePreviewLoading, setIsNativePreviewLoading] = useState(false);
  const [nativePreviewError, setNativePreviewError] = useState<string | null>(null);
  const [nativeImportSource, setNativeImportSource] = useState('');
  const [nativeImportManifest, setNativeImportManifest] = useState('');
  const [nativeImportResult, setNativeImportResult] = useState<NativeCppImportResult | null>(null);
  const [nativeImportError, setNativeImportError] = useState<string | null>(null);
  const [showNativeImportPanel, setShowNativeImportPanel] = useState(false);
  const [structuredRevealLine, setStructuredRevealLine] = useState<number | null>(null);
  const [pendingNativeSourceReveal, setPendingNativeSourceReveal] = useState<{ line: number; filePath?: string } | null>(null);
  const [beginnerCompletionState, setBeginnerCompletionState] = useState<BeginnerCompletionState | null>(null);
  const [beginnerJumpHighlight, setBeginnerJumpHighlight] = useState<BeginnerJumpHighlightState | null>(null);
  const [beginnerCodeDrafts, setBeginnerCodeDrafts] = useState<Record<string, string>>({});
  const beginnerCodeDraftsRef = useRef<Record<string, string>>({});
  const [beginnerContextMenu, setBeginnerContextMenu] = useState<BeginnerContextMenuState | null>(null);
  const [beginnerTypeCompletionState, setBeginnerTypeCompletionState] = useState<BeginnerTypeCompletionState | null>(null);
  const [beginnerCommandHintState, setBeginnerCommandHintState] = useState<BeginnerCommandHintState | null>(null);

  useEffect(() => {
    const handleRevealLingCppLine = (event: Event) => {
      const detail = (event as CustomEvent<{ filePath?: string; line?: number; column?: number }>).detail;
      if (!detail?.line || activeFile?.language !== 'lingcpp') return;
      const normalizePath = (value: string) => value.replace(/\\/gu, '/').replace(/^\.\//u, '').toLocaleLowerCase();
      if (detail.filePath && activeFile?.path && normalizePath(detail.filePath) !== normalizePath(activeFile.path)) return;

      const line = Math.max(1, Math.trunc(detail.line));
      const column = Math.max(1, Math.trunc(detail.column || 1));
      setViewType('code');
      setCursorPosition({ line, column });
      if (editorExperienceMode === 'beginner') setStructuredRevealLine(line);
    };

    window.addEventListener('lingcpp-reveal-line', handleRevealLingCppLine);
    return () => window.removeEventListener('lingcpp-reveal-line', handleRevealLingCppLine);
  }, [activeFile?.language, activeFile?.path, editorExperienceMode]);

  useEffect(() => {
    if (pendingHandlerFocus) {
      setViewType('code');
    }
  }, [pendingHandlerFocus]);

  useEffect(() => {
    setReadingMode(editorExperienceMode === 'beginner' ? 'beginner' : 'off');
    setFocusedReadableBlockId(undefined);
  }, [editorExperienceMode]);

  useEffect(() => {
    setCursorPosition({ line: 1, column: 1 });
    setSelectedBeginnerHandler(null);
    beginnerTextareaViewRef.current = null;
    setSelectedBeginnerCodeTarget(null);
    setExpandedBeginnerEventTargetKey(null);
    setExpandedBeginnerFunctionTargetKey(null);
    setSelectedFunctionTemplateKey(null);
    setFunctionCallDrafts({});
    setBeginnerCompletionState(null);
    setBeginnerJumpHighlight(null);
    beginnerCodeDraftsRef.current = {};
    setBeginnerCodeDrafts({});
    setBeginnerContextMenu(null);
    setBeginnerTypeCompletionState(null);
    setBeginnerCommandHintState(null);
  }, [activeFile?.path]);

  useEffect(() => {
    setNativeImportResult(null);
    setNativeImportError(null);
    setShowNativeImportPanel(false);
  }, [activeFile?.path]);

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const unifiedScrollRef = useRef<HTMLDivElement>(null);
  const sourceEditorRef = useRef<HTMLTextAreaElement>(null);
  const sourceLineNumberRef = useRef<HTMLDivElement>(null);
  const beginnerStructureScrollRef = useRef<HTMLDivElement>(null);
  const beginnerJumpHighlightTimerRef = useRef<number | null>(null);
  const cursorPositionRef = useRef(cursorPosition);
  cursorPositionRef.current = cursorPosition;
  const beginnerTextareaViewRef = useRef<{
    focusKey: string;
    value: string;
    selectionStart: number;
    selectionEnd: number;
    selectionDirection: 'forward' | 'backward' | 'none';
    scrollTop: number;
    scrollLeft: number;
    startPosition: { line: number; column: number };
    endPosition: { line: number; column: number };
  } | null>(null);

  useEffect(() => () => {
    if (beginnerJumpHighlightTimerRef.current !== null) {
      window.clearTimeout(beginnerJumpHighlightTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!beginnerContextMenu) return undefined;
    const closeContextMenu = () => setBeginnerContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu();
    };
    window.addEventListener('click', closeContextMenu);
    window.addEventListener('blur', closeContextMenu);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', closeContextMenu);
      window.removeEventListener('blur', closeContextMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [beginnerContextMenu]);

  const sourceCode = activeFile?.isModified || activeFile?.translatedContent
    ? activeFile?.translatedContent ?? ''
    : activeFile?.originalContent || diffResult.translatedLines.map(line => line.content).join('\n');
  const normalizedSourceCode = activeFile?.language === 'epl' ? optimizeEplName(sourceCode) : sourceCode;
  const normalizedSourceLines = useMemo(() => normalizedSourceCode.split(/\r\n|\r|\n/u), [normalizedSourceCode]);
  const latestSourceCodeRef = useRef(normalizedSourceCode);
  const [textHistoryVersion, setTextHistoryVersion] = useState(0);
  const textEditHistory = useMemo(
    () => getOrCreateWorkbenchTextHistory(sourceModelIdentity, normalizedSourceCode),
    [sourceModelRecord.modelId]
  );
  const publishProfessionalEditorState = useCallback((state: MonacoEditorState) => {
    const supportsFileHistory = activeFile?.language === 'lingcpp' && !state.readOnly;
    publishEditorState({
      ...state,
      canUndo: supportsFileHistory ? textEditHistory.canUndo() : state.canUndo,
      canRedo: supportsFileHistory ? textEditHistory.canRedo() : state.canRedo
    });
    void textHistoryVersion;
  }, [activeFile?.language, publishEditorState, textEditHistory, textHistoryVersion]);
  useEffect(() => {
    const latest = latestEditorStateRef.current;
    if (editorExperienceMode === 'professional' && latest?.surface === 'professional') {
      publishProfessionalEditorState(latest);
    }
  }, [editorExperienceMode, publishProfessionalEditorState, textHistoryVersion]);
  const captureBeginnerTextareaView = useCallback((textarea: HTMLTextAreaElement) => {
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selectionDirection = textarea.selectionDirection || 'none';
    const start = beginnerSourcePositionAtOffset(textarea, selectionStart);
    const end = beginnerSourcePositionAtOffset(textarea, selectionEnd);
    const backwards = selectionDirection === 'backward';
    const cursor = backwards ? start : end;
    beginnerTextareaViewRef.current = {
      focusKey: textarea.dataset.textModelViewKey || '',
      value: textarea.value,
      selectionStart,
      selectionEnd,
      selectionDirection,
      scrollTop: textarea.scrollTop,
      scrollLeft: textarea.scrollLeft,
      startPosition: start,
      endPosition: end
    };
    setCursorPosition(cursor);
    const state: MonacoEditorState = {
      modelId: sourceModelRecord.modelId,
      surface: 'beginner',
      line: cursor.line,
      column: cursor.column,
      selectionLength: Math.max(0, selectionEnd - selectionStart),
      canUndo: textEditHistory.canUndo() || Object.keys(beginnerCodeDraftsRef.current).length > 0,
      canRedo: textEditHistory.canRedo() && Object.keys(beginnerCodeDraftsRef.current).length === 0,
      readOnly: false,
      positionAvailable: true
    };
    latestEditorStateRef.current = state;
    onEditorStateChange?.(state);
  }, [onEditorStateChange, sourceModelRecord.modelId, textEditHistory]);
  useEffect(() => {
    const historyChanged = reconcileTextEditHistory(textEditHistory, {
      contextKey: activeFile?.language || 'unknown',
      value: normalizedSourceCode,
      canonical: activeFile?.language === 'lingcpp',
      deferExternalChange: activeFile?.language === 'lingcpp'
        && editorExperienceMode === 'beginner'
        && Object.keys(beginnerCodeDraftsRef.current).length > 0
    });
    latestSourceCodeRef.current = normalizedSourceCode;
    if (historyChanged) setTextHistoryVersion(version => version + 1);
  }, [
    activeFile?.language,
    editorExperienceMode,
    normalizedSourceCode,
    sourceModelRecord.modelId,
    textEditHistory
  ]);
  const lingCppStructure = useMemo(
    () => activeFile?.language === 'lingcpp'
      ? getLingCppStructureView(normalizedSourceCode, designerProject, activeFile?.path, moduleContext)
      : [],
    [activeFile?.language, activeFile?.path, designerProject, moduleContext, normalizedSourceCode]
  );
  const readableBlocks = useMemo(
    () => activeFile?.language === 'lingcpp'
      ? getLingCppReadableBlocks(normalizedSourceCode, designerProject, activeFile?.path, moduleContext)
      : [],
    [activeFile?.language, activeFile?.path, designerProject, moduleContext, normalizedSourceCode]
  );
  const lingCppLanguageContext = useMemo(
    () => activeFile?.language === 'lingcpp'
      ? buildLingCppLanguageContext(normalizedSourceCode, designerProject, moduleContext, activeFile?.path)
      : null,
    [activeFile?.language, activeFile?.path, designerProject, moduleContext, normalizedSourceCode]
  );
  const flushBeginnerDrafts = useCallback((applyToParent: boolean): FlushPendingEditsResult => {
    const currentSourceCode = latestSourceCodeRef.current;
    const result = applyPendingBeginnerCodeDrafts(currentSourceCode, beginnerCodeDraftsRef.current);
    if (!result.success) {
      setStructureEditError(result.diagnostics[0] || '新手代码提交失败，源码已保持不变。');
      return result;
    }
    if (result.changed && textEditHistory.record(result.sourceCode)) {
      setTextHistoryVersion(version => version + 1);
    }
    latestSourceCodeRef.current = result.sourceCode;
    beginnerCodeDraftsRef.current = {};
    setBeginnerCodeDrafts({});
    setStructureEditError(null);
    if (applyToParent && result.changed) onUpdateSourceContent?.(result.sourceCode);
    return result;
  }, [onUpdateSourceContent, textEditHistory]);

  const applyBeginnerHistoryValue = useCallback((value: string) => {
    latestSourceCodeRef.current = value;
    beginnerCodeDraftsRef.current = {};
    setBeginnerCodeDrafts({});
    setStructureEditError(null);
    onUpdateSourceContent?.(value);
    setTextHistoryVersion(version => version + 1);
  }, [onUpdateSourceContent]);

  const applyProfessionalHistoryValue = useCallback((value: string) => {
    professionalHistoryApplyRef.current = true;
    monacoEditorRef.current?.replaceValueAuthoritatively(value);
    applyBeginnerHistoryValue(value);
    queueMicrotask(() => {
      professionalHistoryApplyRef.current = false;
    });
  }, [applyBeginnerHistoryValue]);

  useImperativeHandle(ref, () => ({
    flushPendingEdits: async () => {
      const currentSourceCode = latestSourceCodeRef.current;
      if (activeFile?.language !== 'lingcpp' || editorExperienceMode !== 'beginner') {
        return {
          success: true,
          sourceCode: currentSourceCode,
          changed: false,
          diagnostics: [],
          appliedDraftCount: 0
        };
      }

      return flushBeginnerDrafts(false);
    },
    undo: async () => {
      if (viewType !== 'code' || viewMode !== 'chinese') return false;
      if (activeFile?.language === 'lingcpp' && editorExperienceMode === 'beginner') {
        const flushResult = flushBeginnerDrafts(true);
        if (!flushResult.success) return false;
        const previous = textEditHistory.undo();
        if (previous === undefined) return false;
        applyBeginnerHistoryValue(previous);
        return true;
      }
      const monacoSurfaceActive = activeFile?.language !== 'lingcpp' || editorExperienceMode === 'professional';
      if (!monacoSurfaceActive) return false;
      if (activeFile?.language !== 'lingcpp') return await monacoEditorRef.current?.undo() || false;
      const previous = textEditHistory.undo();
      if (previous === undefined) return false;
      applyProfessionalHistoryValue(previous);
      return true;
    },
    redo: async () => {
      if (viewType !== 'code' || viewMode !== 'chinese') return false;
      if (activeFile?.language === 'lingcpp' && editorExperienceMode === 'beginner') {
        const flushResult = flushBeginnerDrafts(true);
        if (!flushResult.success || flushResult.changed) return false;
        const next = textEditHistory.redo();
        if (next === undefined) return false;
        applyBeginnerHistoryValue(next);
        return true;
      }
      const monacoSurfaceActive = activeFile?.language !== 'lingcpp' || editorExperienceMode === 'professional';
      if (!monacoSurfaceActive) return false;
      if (activeFile?.language !== 'lingcpp') return await monacoEditorRef.current?.redo() || false;
      const next = textEditHistory.redo();
      if (next === undefined) return false;
      applyProfessionalHistoryValue(next);
      return true;
    },
    focusEditor: () => monacoEditorRef.current?.focus() || false
  }), [
    activeFile?.language,
    applyBeginnerHistoryValue,
    applyProfessionalHistoryValue,
    editorExperienceMode,
    flushBeginnerDrafts,
    textEditHistory,
    viewMode,
    viewType
  ]);
  const beginnerModuleCodeCompletions = useMemo(
    () => getBeginnerModuleCodeCompletions(moduleContext).map(item => ({
      label: item.label,
      detail: item.detail,
      insertText: item.insertText,
      aliases: item.aliases,
      kind: (item.kind === 'type' ? '类型' : item.kind === 'snippet' ? '代码' : '命令') as BeginnerCodeCompletion['kind'],
      cursorOffset: item.cursorOffset,
      selectLength: item.selectLength
    })),
    [moduleContext]
  );
  const beginnerDesignerControlCompletions = useMemo(
    () => getLingCppDesignerControlCompletions(normalizedSourceCode, designerProject).map(item => {
      const snippet = normalizeSnippetPlaceholders(item.insertText);
      return {
        label: item.label,
        detail: item.detail,
        insertText: snippet.text,
        aliases: [item.label, ...(item.aliases || []), ...(item.pinyin || [])],
        kind: (item.label === item.insertText ? '变量' : '代码') as BeginnerCodeCompletion['kind'],
        cursorOffset: snippet.cursorOffset,
        selectLength: snippet.selectLength
      };
    }),
    [designerProject, normalizedSourceCode]
  );
  const beginnerModuleCommandHints = useMemo(
    () => {
      const hints = getBeginnerModuleCommandHints(moduleContext);
      return Object.fromEntries(Object.entries(hints).map(([key, value]) => [key, {
        command: value.command,
        signature: value.signature,
        returnType: value.returnType,
        summary: value.summary,
        parameters: value.parameters,
        example: value.example
      }])) as Record<string, BeginnerCommandHintInfo>;
    },
    [moduleContext]
  );
  const beginnerCommandHints = useMemo(
    () => ({ ...BEGINNER_COMMAND_HINTS, ...beginnerModuleCommandHints }),
    [beginnerModuleCommandHints]
  );
  const structuredReadingRows = useMemo(
    () => lingCppLanguageContext
      ? getLingCppStructuredRows(lingCppLanguageContext)
      : [],
    [lingCppLanguageContext]
  );
  const pendingStructureEventCount = useMemo(
    () => structuredReadingRows.filter(row => row.editKind === 'missing-event' || row.status === 'missing-source').length,
    [structuredReadingRows]
  );
  const activeStructuredRow = useMemo(() => {
    if (activeFile?.language !== 'lingcpp') return null;
    const rows = structuredReadingRows.filter(row => row.line === cursorPosition.line);
    if (rows.length === 0) return null;
    const priority = (row: LingCppStructuredReadingRow) => {
      if (row.editKind === 'member') return 0;
      if (row.editKind === 'event') return 1;
      if (row.editKind === 'class') return 2;
      if (row.editKind === 'package') return 3;
      if (row.group === 'declaration') return 4;
      return 9;
    };
    return [...rows].sort((a, b) => priority(a) - priority(b))[0];
  }, [activeFile?.language, cursorPosition.line, structuredReadingRows]);
  const memberStructuredRows = useMemo(
    () => structuredReadingRows.filter(row => row.group === 'member'),
    [structuredReadingRows]
  );
  const eventHandlerStructuredRows = useMemo(
    () => structuredReadingRows.filter(row => row.editKind === 'event'),
    [structuredReadingRows]
  );
  const primaryLingCppClass = lingCppLanguageContext?.program.classes[0];
  const beginnerTasks = useMemo(
    () => activeFile?.language === 'lingcpp'
      ? getBeginnerTasks(normalizedSourceCode, designerProject, activeFile?.path, ignoredBeginnerTaskIds, moduleContext)
      : [],
    [activeFile?.language, activeFile?.path, designerProject, ignoredBeginnerTaskIds, moduleContext, normalizedSourceCode]
  );
  const visibleBeginnerTasks = useMemo(
    () => beginnerTasks.filter(task => task.status !== 'ignored'),
    [beginnerTasks]
  );
  const codeExplanation = useMemo(
    () => activeFile?.language === 'lingcpp'
      ? getCodeExplanation(normalizedSourceCode, cursorPosition.line, cursorPosition.column)
      : null,
    [activeFile?.language, cursorPosition.column, cursorPosition.line, normalizedSourceCode]
  );
  const activeBeginnerHandler = selectedBeginnerHandler
    || visibleBeginnerTasks.find(task => task.handlerName)?.handlerName
    || lingCppStructure.flatMap(node => node.children || []).find(node => node.kind === 'event')?.name
    || '';
  const actionBlocks = useMemo(
    () => activeFile?.language === 'lingcpp' && activeBeginnerHandler
      ? getActionBlocksForEvent(normalizedSourceCode, activeBeginnerHandler)
      : [],
    [activeBeginnerHandler, activeFile?.language, normalizedSourceCode]
  );
  const learningPath = useMemo(
    () => getLearningPathState(designerProject?.id || 'local-workspace', normalizedSourceCode, designerProject),
    [designerProject, normalizedSourceCode]
  );
  const designerTabLabel = designerProject?.windows.find(window => window.id === activeWindowId)?.fileName
    || designerProject?.windows[0]?.fileName
    || '界面可视化';
  const isLingCppBeginnerStructureMode = activeFile?.language === 'lingcpp' && editorExperienceMode === 'beginner';
  const isLingCppNativeMode = activeFile?.language === 'lingcpp' && editorExperienceMode === 'native';

  useEffect(() => {
    if (!isLingCppBeginnerStructureMode) setShowBeginnerTools(false);
  }, [isLingCppBeginnerStructureMode]);

  useEffect(() => {
    let surface: string | null = null;
    let surfaceReadOnly = false;
    if (viewType === 'designer') {
      surface = 'designer';
      surfaceReadOnly = true;
    } else if (viewMode !== 'chinese') {
      surface = `diff:${viewMode}`;
      surfaceReadOnly = true;
    } else if (isLingCppBeginnerStructureMode) {
      surface = 'beginner';
    } else if (isLingCppNativeMode) {
      surface = 'native';
      surfaceReadOnly = true;
    }
    if (!surface) return;
    if (surface === 'native' && nativePreviewState?.selectedFilePath) return;
    const preciseBeginnerState = surface === 'beginner'
      && latestEditorStateRef.current?.surface === 'beginner'
      && latestEditorStateRef.current.modelId === sourceModelRecord.modelId
      ? latestEditorStateRef.current
      : null;
    const state: MonacoEditorState = {
      modelId: sourceModelRecord.modelId,
      surface,
      line: cursorPosition.line,
      column: cursorPosition.column,
      selectionLength: preciseBeginnerState?.selectionLength || 0,
      canUndo: surface === 'beginner'
        ? textEditHistory.canUndo() || Object.keys(beginnerCodeDrafts).length > 0
        : false,
      canRedo: surface === 'beginner'
        ? textEditHistory.canRedo() && Object.keys(beginnerCodeDrafts).length === 0
        : false,
      readOnly: surfaceReadOnly,
      positionAvailable: surface === 'beginner' || surface === 'native'
    };
    latestEditorStateRef.current = state;
    onEditorStateChange?.(state);
    void textHistoryVersion;
  }, [
    cursorPosition.column,
    cursorPosition.line,
    beginnerCodeDrafts,
    isLingCppBeginnerStructureMode,
    isLingCppNativeMode,
    nativePreviewState?.selectedFilePath,
    onEditorStateChange,
    sourceModelRecord.modelId,
    textEditHistory,
    textHistoryVersion,
    viewMode,
    viewType
  ]);

  useLayoutEffect(() => {
    if (!isLingCppBeginnerStructureMode || viewType !== 'code' || viewMode !== 'chinese') return undefined;
    const savedState = workbenchTextModelService.getViewState(sourceModelIdentity, 'beginner');
    let restoreFrame: number | null = null;

    if (savedState) {
      setCursorPosition(savedState.cursor);
      const opaque = readSerializableObject(savedState.opaque);
      setSelectedBeginnerHandler(typeof opaque.selectedHandler === 'string' && opaque.selectedHandler
        ? opaque.selectedHandler
        : null);
      restoreFrame = window.requestAnimationFrame(() => {
        const root = beginnerStructureScrollRef.current;
        if (!root) return;
        root.scrollTop = savedState.scrollTop;
        root.scrollLeft = savedState.scrollLeft;
        const focusKey = typeof opaque.focusKey === 'string' ? opaque.focusKey : '';
        const textareas = root.querySelectorAll('[data-text-model-view-key]') as NodeListOf<HTMLTextAreaElement>;
        const textarea = Array.from(textareas)
          .find((item: HTMLTextAreaElement) => item.dataset.textModelViewKey === focusKey) as HTMLTextAreaElement | undefined;
        if (!textarea) return;
        const start = typeof opaque.selectionStart === 'number' ? opaque.selectionStart : 0;
        const end = typeof opaque.selectionEnd === 'number' ? opaque.selectionEnd : start;
        const direction = opaque.selectionDirection === 'backward' ? 'backward' : 'forward';
        textarea.setSelectionRange(
          Math.max(0, Math.min(textarea.value.length, start)),
          Math.max(0, Math.min(textarea.value.length, end)),
          direction
        );
        textarea.scrollTop = typeof opaque.textareaScrollTop === 'number' ? Math.max(0, opaque.textareaScrollTop) : 0;
        textarea.scrollLeft = typeof opaque.textareaScrollLeft === 'number' ? Math.max(0, opaque.textareaScrollLeft) : 0;
        // Restore the selection before focusing. The textarea focus handler
        // captures view state synchronously; focusing first would persist the
        // browser's default 0/0 selection and could overwrite this restore.
        textarea.focus({ preventScroll: true });
        captureBeginnerTextareaView(textarea);
      });
    } else {
      setCursorPosition({ line: 1, column: 1 });
      setSelectedBeginnerHandler(null);
      restoreFrame = window.requestAnimationFrame(() => {
        const root = beginnerStructureScrollRef.current;
        if (!root) return;
        root.scrollTop = 0;
        root.scrollLeft = 0;
      });
    }

    return () => {
      if (restoreFrame !== null) window.cancelAnimationFrame(restoreFrame);
      const root = beginnerStructureScrollRef.current;
      const activeElement = document.activeElement;
      const textarea = root && activeElement instanceof HTMLTextAreaElement && root.contains(activeElement)
        ? activeElement
        : null;
      const storedTextarea = textarea ? {
        focusKey: textarea.dataset.textModelViewKey || '',
        value: textarea.value,
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
        selectionDirection: textarea.selectionDirection || 'none' as const,
        scrollTop: textarea.scrollTop,
        scrollLeft: textarea.scrollLeft,
        startPosition: beginnerSourcePositionAtOffset(textarea, textarea.selectionStart),
        endPosition: beginnerSourcePositionAtOffset(textarea, textarea.selectionEnd)
      } : beginnerTextareaViewRef.current;
      const fallback = cursorPositionRef.current;
      const startPosition = storedTextarea?.startPosition || fallback;
      const endPosition = storedTextarea?.endPosition || fallback;
      const backwards = storedTextarea?.selectionDirection === 'backward';
      const state: TextEditorViewState = {
        cursor: backwards ? startPosition : endPosition,
        selection: {
          anchor: backwards ? endPosition : startPosition,
          active: backwards ? startPosition : endPosition
        },
        scrollTop: root?.scrollTop || 0,
        scrollLeft: root?.scrollLeft || 0,
        opaque: {
          selectedHandler: selectedBeginnerHandlerRef.current || '',
          focusKey: storedTextarea?.focusKey || '',
          selectionStart: storedTextarea?.selectionStart || 0,
          selectionEnd: storedTextarea?.selectionEnd || 0,
          selectionDirection: storedTextarea?.selectionDirection || 'none',
          textareaScrollTop: storedTextarea?.scrollTop || 0,
          textareaScrollLeft: storedTextarea?.scrollLeft || 0
        }
      };
      workbenchTextModelService.saveViewStateIfCurrent({
        modelId: sourceModelRecord.modelId,
        generation: sourceModelRecord.generation
      }, 'beginner', state);
    };
  }, [
    isLingCppBeginnerStructureMode,
    captureBeginnerTextareaView,
    sourceModelIdentity.filePath,
    sourceModelRecord.modelId,
    viewMode,
    viewType
  ]);

  useLayoutEffect(() => {
    const ownerKey = sourceModelOwnerKey;
    const ownerToken = { modelId: sourceModelRecord.modelId, generation: sourceModelRecord.generation };
    return () => {
      nativePreviewRequestRef.current += 1;
      nativePreviewAbortRef.current?.abort();
      const preview = nativePreviewStateRef.current;
      if (!preview?.selectedFilePath || nativePreviewOwnerRef.current?.ownerKey !== ownerKey) return;
      const latest = latestEditorStateRef.current;
      const cursor = latest?.surface.startsWith('native:')
        ? { line: latest.line, column: latest.column }
        : cursorPositionRef.current;
      workbenchTextModelService.saveViewStateIfCurrent(ownerToken, 'native', {
        cursor,
        selection: { anchor: cursor, active: cursor },
        scrollTop: 0,
        scrollLeft: 0,
        opaque: { selectedFilePath: preview.selectedFilePath }
      });
    };
  }, [sourceModelOwnerKey, sourceModelRecord.generation, sourceModelRecord.modelId]);

  useEffect(() => {
    setNativePreviewState(null);
    nativePreviewOwnerRef.current = null;
    setNativePreviewError(null);
  }, [sourceModelOwnerKey]);

  useEffect(() => {
    if (!isLingCppNativeMode || !nativePreviewState?.selectedFilePath) return;
    const owner = nativePreviewOwnerRef.current;
    if (!owner || owner.ownerKey !== sourceModelOwnerKey) return;
    const latest = latestEditorStateRef.current;
    const cursor = latest?.surface.startsWith('native:')
      ? { line: latest.line, column: latest.column }
      : cursorPositionRef.current;
    workbenchTextModelService.saveViewStateIfCurrent(owner.token, 'native', {
      cursor,
      selection: { anchor: cursor, active: cursor },
      scrollTop: 0,
      scrollLeft: 0,
      opaque: { selectedFilePath: nativePreviewState.selectedFilePath }
    });
  }, [
    isLingCppNativeMode,
    nativePreviewState?.selectedFilePath,
    sourceModelOwnerKey
  ]);
  const sourceLineNumbers = useMemo(() => {
    const lineCount = Math.max(1, normalizedSourceCode.split('\n').length);
    return Array.from({ length: lineCount }, (_, index) => index + 1);
  }, [normalizedSourceCode]);
  const sourceHighlightLines = useMemo(() => normalizedSourceCode.split('\n'), [normalizedSourceCode]);
  const eplVisualLines = useMemo(() => {
    return activeFile?.language === 'epl' ? buildEplVisualLines(sourceHighlightLines) : [];
  }, [activeFile?.language, sourceHighlightLines]);
  const selectedNativePreviewFile = useMemo(
    () => nativePreviewState?.files.find(file => file.relativePath === nativePreviewState.selectedFilePath) || nativePreviewState?.files[0],
    [nativePreviewState]
  );
  const nativeMappedDiagnostics = useMemo(
    () => mapNativeBuildDiagnostics(nativePreviewState?.lastBuildLogs || [], nativePreviewState?.sourceMap || []),
    [nativePreviewState]
  );

  const moduleQuickSnippets = beginnerModuleCodeCompletions
    .filter(item => item.kind !== '类型')
    .slice(0, 4)
    .map(item => ({ label: item.label, text: item.insertText }));

  const quickChineseSnippets = activeFile?.language === 'lingcpp' ? [
    { label: '类', text: '\n类 新窗口 : 公开 窗体\n公开:\n    构造()\n        调试输出("初始化完成")\n结束类\n' },
    { label: '事件', text: '    事件 按钮1_被单击()\n        信息框("提示内容", 64, "提示")\n' },
    { label: '如果', text: BEGINNER_IF_SNIPPET },
    { label: '返回', text: '返回' },
    { label: '信息框', text: '信息框("提示内容", 64, "提示")' },
    { label: '调试输出', text: '调试输出("调试信息")' },
    { label: '打开窗口', text: '打开窗口("窗口标题")' },
    ...moduleQuickSnippets
  ] : [
    { label: '.子程序', text: '\n.子程序 _按钮1_被单击\n    信息框 (“请输入提示内容”, 64, “提示”)\n' },
    { label: '如果', text: BEGINNER_IF_SNIPPET },
    { label: '如果真', text: '如果真 (条件)\n    \n如果真结束' },
    { label: '判断', text: '判断 (条件)\n    \n判断结束' },
    { label: '计次循环', text: '计次循环首 (次数, 计次变量)\n    \n计次循环尾 ()' },
    { label: '判断循环', text: '判断循环首 (条件)\n    \n判断循环尾 ()' },
    { label: '循环判断', text: '循环判断首 ()\n    \n循环判断尾 (条件)' },
    { label: '变量循环', text: '变量循环首 (起始值, 目标值, 递增值, 循环变量)\n    \n变量循环尾 ()' },
    { label: '返回', text: '返回 (返回值)' },
    { label: '结束', text: '结束 ()' },
    { label: '信息框', text: '信息框 (“提示内容”, 64, “提示”)' },
    { label: '调试输出', text: '调试输出 (“调试信息”)' }
  ];

  // Synchronized scrolling for split view
  const handleLeftScroll = () => {
    if (leftScrollRef.current && rightScrollRef.current) {
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
      rightScrollRef.current.scrollLeft = leftScrollRef.current.scrollLeft;
    }
  };

  const handleRightScroll = () => {
    if (leftScrollRef.current && rightScrollRef.current) {
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
      leftScrollRef.current.scrollLeft = rightScrollRef.current.scrollLeft;
    }
  };

  // Sync scroll on mount/viewMode change
  useEffect(() => {
    if (viewMode === 'split') {
      const left = leftScrollRef.current;
      const right = rightScrollRef.current;
      if (left && right) {
        left.addEventListener('scroll', handleLeftScroll);
        right.addEventListener('scroll', handleRightScroll);
      }
      return () => {
        if (left) left.removeEventListener('scroll', handleLeftScroll);
        if (right) right.removeEventListener('scroll', handleRightScroll);
      };
    }
  }, [viewMode]);

  // Adjust preset if isDarkMode changes
  useEffect(() => {
    setPreset(isDarkMode ? 'vs-dark' : 'classic-light');
  }, [isDarkMode]);

  // Dynamic Theme Styling based on Preset
  const getPresetStyles = () => {
    switch (preset) {
      case 'neon-high-contrast':
        return {
          bg: 'bg-[#050508]',
          text: 'text-[#e5e5f0] font-mono',
          added: 'bg-[#003810] text-[#4af27c] border-l-4 border-[#00ff3c]',
          addedWord: 'bg-[#00ff3c]/30 text-[#00ff3c] underline font-bold px-1 rounded',
          deleted: 'bg-[#3b0008] text-[#ff6177] border-l-4 border-[#ff0033]',
          deletedWord: 'bg-[#ff0033]/30 text-[#ff0033] line-through px-1 rounded',
          modified: 'bg-[#331c00] text-[#ffd67a] border-l-4 border-[#ffaa00]',
          modifiedWord: 'bg-[#ffaa00]/30 text-[#ffaa00] font-bold px-1 rounded border border-[#ffaa00]/50'
        };
      case 'cyberpunk':
        return {
          bg: 'bg-[#0b0c16]',
          text: 'text-[#a1a8c9] font-mono',
          added: 'bg-[#002f2f]/35 text-[#00ffff] border-l-4 border-[#00ffff]',
          addedWord: 'bg-[#00ffff]/20 text-[#00ffff] border-b border-[#00ffff] font-semibold',
          deleted: 'bg-[#2b001a]/35 text-[#ff007f] border-l-4 border-[#ff007f]',
          deletedWord: 'bg-[#ff007f]/20 text-[#ff007f] line-through font-semibold',
          modified: 'bg-[#261600]/40 text-[#ffea00] border-l-4 border-[#ffea00]',
          modifiedWord: 'bg-[#ffea00]/25 text-[#ffea00] font-semibold rounded px-0.5'
        };
      case 'solarized-dark':
        return {
          bg: 'bg-[#002b36]',
          text: 'text-[#93a1a1] font-mono',
          added: 'bg-[#073642]/60 text-[#859900] border-l-4 border-[#859900]',
          addedWord: 'bg-[#859900]/30 text-[#859900] rounded px-0.5',
          deleted: 'bg-[#073642]/60 text-[#dc322f] border-l-4 border-[#dc322f]',
          deletedWord: 'bg-[#dc322f]/30 text-[#dc322f] line-through rounded px-0.5',
          modified: 'bg-[#073642]/60 text-[#b58900] border-l-4 border-[#b58900]',
          modifiedWord: 'bg-[#b58900]/30 text-[#b58900] font-medium rounded px-0.5'
        };
      case 'classic-light':
        return {
          bg: 'bg-[#fafafa]',
          text: 'text-[#24292e] font-mono',
          added: 'bg-[#e6ffed] text-[#22863a] border-l-4 border-[#28a745]',
          addedWord: 'bg-[#acf2bd] text-[#14532d] px-0.5 rounded font-medium',
          deleted: 'bg-[#ffeef0] text-[#cb2431] border-l-4 border-[#d73a49]',
          deletedWord: 'bg-[#fdb8c0] text-[#730d14] px-0.5 rounded line-through',
          modified: 'bg-[#fffdef] text-[#b58105] border-l-4 border-[#e2b13c]',
          modifiedWord: 'bg-[#fbf089] text-[#78350f] px-0.5 rounded font-medium'
        };
      case 'vs-dark':
      default:
        return {
          bg: 'bg-[#1E1E1E]',
          text: 'text-[#D4D4D4] font-mono',
          added: 'bg-[#1A301E] text-[#81C784] border-l-2 border-[#73C991]',
          addedWord: 'bg-[#73C991]/30 text-[#A5D6A7] font-semibold px-0.5 rounded',
          deleted: 'bg-[#3B1C1C] text-[#E57373] border-l-2 border-[#F44336]',
          deletedWord: 'bg-[#F44336]/30 text-[#FFCDD2] line-through px-0.5 rounded',
          modified: 'bg-[#2D2A1E] text-[#F0C674] border-l-2 border-[#E2B13C]',
          modifiedWord: 'bg-[#E2B13C]/30 text-[#FFE082] font-semibold px-0.5 rounded'
        };
    }
  };

  const style = getPresetStyles();

  // Find the translated string mapped to this line
  const getStringForLine = (lineNum: number) => {
    return strings.find(s => s.line === lineNum);
  };

  const handleStartEdit = (lineNum: number) => {
    const str = getStringForLine(lineNum);
    if (str) {
      setEditingStringId(str.id);
      setEditingValue(str.translated || str.original);
    }
  };

  const handleSaveEdit = (id: string) => {
    onUpdateStringTranslation(id, editingValue);
    setEditingStringId(null);
  };

  const handleSourceScroll = () => {
    if (sourceEditorRef.current) {
      setSourceScroll({
        top: sourceEditorRef.current.scrollTop,
        left: sourceEditorRef.current.scrollLeft
      });
    }
  };

  const updateSourceCode = (nextCode: string, change?: MonacoContentChange) => {
    const normalizedNextCode = activeFile?.language === 'epl' ? optimizeEplName(nextCode) : nextCode;
    if (activeFile?.language === 'lingcpp' && editorExperienceMode === 'beginner') {
      if (textEditHistory.record(normalizedNextCode)) {
        setTextHistoryVersion(version => version + 1);
      }
    } else if (
      activeFile?.language === 'lingcpp'
      && editorExperienceMode === 'professional'
      && !professionalHistoryApplyRef.current
    ) {
      let historyChanged = change?.isUndoing
        ? textEditHistory.undoTo(normalizedNextCode)
        : change?.isRedoing
          ? textEditHistory.redoTo(normalizedNextCode)
          : textEditHistory.record(normalizedNextCode);
      if (!historyChanged && textEditHistory.current() !== normalizedNextCode) {
        // A third-party Monaco action produced a snapshot outside the known
        // timeline. Resetting is safer than turning an undo into a forward edit.
        textEditHistory.reset(normalizedNextCode);
        historyChanged = true;
      }
      if (historyChanged) setTextHistoryVersion(version => version + 1);
    }
    latestSourceCodeRef.current = normalizedNextCode;
    onUpdateSourceContent?.(normalizedNextCode);
  };

  const refreshNativePreview = async () => {
    if (!designerProject || activeFile?.language !== 'lingcpp') return;

    nativePreviewAbortRef.current?.abort();
    const controller = new AbortController();
    nativePreviewAbortRef.current = controller;
    const requestId = ++nativePreviewRequestRef.current;
    const requestOwnerKey = sourceModelOwnerKey;
    const requestIdentity = { ...sourceModelIdentity };
    const requestToken = { modelId: sourceModelRecord.modelId, generation: sourceModelRecord.generation };
    setIsNativePreviewLoading(true);
    setNativePreviewError(null);
    try {
      const response = await fetch('/api/window-designer/native-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          project: designerProject,
          activeWindowId,
          lingCppSourceCode: normalizedSourceCode,
          lingCppSourceFilePath: activeFile?.path
        })
      });
      const result = await response.json();
      if (requestId !== nativePreviewRequestRef.current
        || requestOwnerKey !== activeSourceOwnerKeyRef.current
        || !workbenchTextModelService.isCurrent(requestToken)) return;
      if (!response.ok || !result.ok) {
        throw new Error(result.error || '原生 C++ 预览生成失败');
      }
      const savedNativeState = workbenchTextModelService.getViewState(requestIdentity, 'native');
      const savedNativeOpaque = readSerializableObject(savedNativeState?.opaque);
      const savedSelectedFile = typeof savedNativeOpaque.selectedFilePath === 'string'
        ? savedNativeOpaque.selectedFilePath
        : '';
      nativePreviewOwnerRef.current = { ownerKey: requestOwnerKey, token: requestToken };
      setNativePreviewState(previous => ({
        files: result.files || [],
        diagnostics: result.diagnostics || [],
        enabledModules: result.enabledModules || [],
        sourceMap: result.sourceMap || [],
        selectedFilePath: savedSelectedFile && (result.files || []).some((file: LingCppNativePreviewFile) => file.relativePath === savedSelectedFile)
          ? savedSelectedFile
          : previous?.selectedFilePath && (result.files || []).some((file: LingCppNativePreviewFile) => file.relativePath === previous.selectedFilePath)
            ? previous.selectedFilePath
          : ((result.files || [])[0]?.relativePath || 'main.cpp'),
        selectedWindowTitle: result.selectedWindow?.title || '',
        lastExportDir: previous?.lastExportDir,
        lastBuildLogs: previous?.lastBuildLogs || []
      }));
    } catch (error: any) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (requestId !== nativePreviewRequestRef.current || requestOwnerKey !== activeSourceOwnerKeyRef.current) return;
      setNativePreviewError(error?.message || '原生 C++ 预览生成失败');
    } finally {
      if (requestId === nativePreviewRequestRef.current && requestOwnerKey === activeSourceOwnerKeyRef.current) {
        setIsNativePreviewLoading(false);
      }
    }
  };

  const exportNativePreview = async () => {
    if (!designerProject || activeFile?.language !== 'lingcpp') return;
    setNativePreviewError(null);
    try {
      const response = await fetch('/api/window-designer/native-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: designerProject,
          activeWindowId,
          lingCppSourceCode: normalizedSourceCode,
          lingCppSourceFilePath: activeFile?.path
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || '导出原生 C++ 工程失败');
      }
      setNativePreviewState(previous => previous ? {
        ...previous,
        lastExportDir: result.exportDir,
        lastBuildLogs: result.logs || previous.lastBuildLogs
      } : previous);
      if (window.lingBuilder?.shell && result.exportDir) {
        await window.lingBuilder.shell.openPath(result.exportDir);
      }
    } catch (error: any) {
      setNativePreviewError(error?.message || '导出原生 C++ 工程失败');
    }
  };

  const buildAndRunNativePreview = async () => {
    if (!designerProject || activeFile?.language !== 'lingcpp') return;
    setNativePreviewError(null);
    try {
      const response = await fetch('/api/window-designer/build-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: designerProject,
          activeWindowId,
          lingCppSourceCode: normalizedSourceCode,
          lingCppSourceFilePath: activeFile?.path,
          run: true
        })
      });
      const result = await response.json();
      const logs = Array.isArray(result.logs) ? result.logs : [];
      const compilerDiagnostics = Array.isArray(result.compilerDiagnostics)
        ? result.compilerDiagnostics
        : [];
      window.dispatchEvent(new CustomEvent('lingbuilder-compiler-diagnostics', {
        detail: { diagnostics: compilerDiagnostics }
      }));
      setNativePreviewState(previous => previous ? {
        ...previous,
        lastBuildLogs: logs,
        lastExportDir: result.exportDir || previous.lastExportDir,
        sourceMap: result.sourceMap || previous.sourceMap
      } : previous);
      if (!response.ok || !result.ok) {
        throw new Error(result.error || result.stage || '原生 C++ 编译运行失败');
      }
    } catch (error: any) {
      setNativePreviewError(error?.message || '原生 C++ 编译运行失败');
    }
  };

  const openNativeExportDirectory = async () => {
    const targetPath = nativePreviewState?.lastExportDir;
    if (!targetPath || !window.lingBuilder?.shell) {
      await exportNativePreview();
      return;
    }
    await window.lingBuilder.shell.openPath(targetPath);
  };

  const applyNativeImportResult = async (result: NativeCppImportResult) => {
    if (textEditHistory.record(result.lcppSource)) {
      setTextHistoryVersion(version => version + 1);
    }
    latestSourceCodeRef.current = result.lcppSource;
    onUpdateSourceContent?.(result.lcppSource);
    if (designerProject) {
      const nextWindows = Array.isArray(result.designerProjectPatch.windows) && result.designerProjectPatch.windows.length > 0
        ? result.designerProjectPatch.windows
        : designerProject.windows;
      saveWindowDesignerState({
        project: {
          ...designerProject,
          ...result.designerProjectPatch,
          windows: nextWindows
        },
        activeWindowId: activeWindowId || nextWindows[0]?.id || designerProject.windows[0]?.id || 'main-window',
        selectedControlId: null
      });
    }
    setShowNativeImportPanel(false);
    await onExperienceModeChange?.('professional');
  };

  const handleRunNativeImport = () => {
    try {
      const result = importNativeCppToLingBuilder(nativeImportSource, {
        project: designerProject,
        activeWindowId,
        manifestText: nativeImportManifest
      });
      setNativeImportResult(result);
      setNativeImportError(null);
    } catch (error: any) {
      setNativeImportResult(null);
      setNativeImportError(error?.message || '原生 C++ 适配失败');
    }
  };

  const revealNativeSourceLine = async (line: number, preferStructure: boolean) => {
    if (preferStructure) {
      setCursorPosition({ line, column: 1 });
      setStructuredRevealLine(line);
      const switched = await onExperienceModeChange?.('beginner');
      if (switched === false) setStructuredRevealLine(null);
      return;
    }
    setPendingNativeSourceReveal({ line, filePath: activeFile?.path });
    const switched = await onExperienceModeChange?.('professional');
    if (switched === false) setPendingNativeSourceReveal(null);
  };

  useEffect(() => {
    const handleFocusEplHandler = (event: Event) => {
      const customEvent = event as CustomEvent<{ handlerName?: string; filePath?: string; fileName?: string }>;
      const handlerName = customEvent.detail?.handlerName?.trim();
      if (!handlerName) return;

      const targetFile = customEvent.detail?.filePath
        ? allFiles.find(f => f.path === customEvent.detail?.filePath)
        : customEvent.detail?.fileName
          ? allFiles.find(f => f.name === customEvent.detail?.fileName)
          : undefined;

      if (targetFile && targetFile.path !== activeFile?.path) {
        onSelectTab(targetFile);
      } else if (activeFile?.name?.endsWith('.xml')) {
        const codeFileName = activeFile.name.replace(/\.xml$/i, '.lcpp');
        const codeFile = allFiles.find(f => f.name === codeFileName);
        if (codeFile) onSelectTab(codeFile);
      }
      setViewMode('chinese');
      onExperienceModeChange?.('beginner');
      setPendingHandlerFocus({ handlerName, filePath: targetFile?.path || customEvent.detail?.filePath });
    };

    window.addEventListener('focus-epl-handler', handleFocusEplHandler);
    return () => {
      window.removeEventListener('focus-epl-handler', handleFocusEplHandler);
    };
  }, [activeFile?.name, activeFile?.path, allFiles, onExperienceModeChange, onSelectTab]);

  useEffect(() => {
    const handleShowWindowDesigner = () => {
      setViewType('designer');
    };

    window.addEventListener('show-window-designer', handleShowWindowDesigner);
    return () => {
      window.removeEventListener('show-window-designer', handleShowWindowDesigner);
    };
  }, []);

  useEffect(() => {
    if (!isLingCppNativeMode) return;
    const timer = window.setTimeout(() => {
      void refreshNativePreview();
    }, 220);
    return () => {
      window.clearTimeout(timer);
      nativePreviewRequestRef.current += 1;
      nativePreviewAbortRef.current?.abort();
    };
  }, [activeFile?.path, activeWindowId, designerProject, isLingCppNativeMode, normalizedSourceCode]);

  useEffect(() => {
    if (!structuredRevealLine || editorExperienceMode !== 'beginner') return;
    const timer = window.setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-structured-line="${structuredRevealLine}"]`);
      if (!row) return;
      scrollElementInsideBeginnerEditor(row, 'center');
      setStructuredRevealLine(null);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [structuredRevealLine, editorExperienceMode]);

  useEffect(() => {
    if (!pendingNativeSourceReveal || editorExperienceMode !== 'professional') return;
    const timers = [40, 160, 360].map((delay, index, delays) => window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('lingcpp-reveal-line', {
        detail: {
          line: pendingNativeSourceReveal.line,
          column: 1,
          filePath: pendingNativeSourceReveal.filePath
        }
      }));
      if (index === delays.length - 1) setPendingNativeSourceReveal(null);
    }, delay));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [editorExperienceMode, pendingNativeSourceReveal]);

  useEffect(() => {
    if (!pendingHandlerFocus) return;
    const focusHandlerName = pendingHandlerFocus.handlerName.trim();
    if (!focusHandlerName) {
      setPendingHandlerFocus(null);
      return;
    }

    if (pendingHandlerFocus.filePath && activeFile?.path !== pendingHandlerFocus.filePath) {
      return;
    }

    if (activeFile?.language === 'lingcpp') {
      const normalizedHandlerName = normalizeIdentifier(focusHandlerName);
      const target = lingCppLanguageContext?.program.classes.flatMap(cls =>
        cls.methods.map(method => ({ className: cls.name, method }))
      ).find(item => {
        const methodName = normalizeIdentifier(item.method.name);
        const classPrefixedName = normalizeIdentifier(`${item.className}_${item.method.name}`);
        return methodName === normalizedHandlerName || classPrefixedName === normalizedHandlerName;
      });

      if (target) {
        onExperienceModeChange?.('beginner');
        setSelectedBeginnerHandler(target.method.name);
        setSelectedBeginnerCodeTarget({ className: target.className, methodName: target.method.name });
        setExpandedBeginnerEventTargetKey(`${target.className}:${target.method.kind}:${target.method.name}`);
        setCursorPosition({ line: target.method.line, column: 1 });
        setStructuredRevealLine(target.method.line);
        setPendingHandlerFocus(null);
        return;
      }

      const pendingRow = structuredReadingRows.find(row => {
        const rowName = normalizeIdentifier(row.targetName || row.name);
        return rowName === normalizedHandlerName;
      });
      if (pendingRow) {
        setCursorPosition({ line: pendingRow.line, column: 1 });
        setStructuredRevealLine(pendingRow.line);
        setPendingHandlerFocus(null);
      }
      return;
    }

    if (activeFile?.language !== 'epl') return;

    const handlerIndex = normalizedSourceCode.indexOf(focusHandlerName);
    if (handlerIndex < 0) return;

    window.requestAnimationFrame(() => {
      const editor = sourceEditorRef.current;
      if (!editor) return;

      const lineIndex = normalizedSourceCode.slice(0, handlerIndex).split('\n').length - 1;
      const nextScrollTop = Math.max(0, lineIndex * 24 - 72);

      editor.focus();
      editor.setSelectionRange(handlerIndex, handlerIndex + focusHandlerName.length);
      editor.scrollTop = nextScrollTop;
      setSourceScroll({ top: editor.scrollTop, left: editor.scrollLeft });
      setPendingHandlerFocus(null);
    });
  }, [
    activeFile?.language,
    activeFile?.path,
    lingCppLanguageContext,
    normalizedSourceCode,
    onExperienceModeChange,
    pendingHandlerFocus,
    structuredReadingRows
  ]);

  const insertSourceSnippet = (snippet: string) => {
    if (!onUpdateSourceContent) return;

    if (activeFile?.language === 'epl') {
      window.dispatchEvent(new CustomEvent('insert-epl-snippet', { detail: { text: snippet } }));
      return;
    }

    const editor = sourceEditorRef.current;
    if (!editor) {
      updateSourceCode(`${sourceCode}${snippet}`);
      return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const nextCode = `${sourceCode.slice(0, start)}${snippet}${sourceCode.slice(end)}`;
    updateSourceCode(nextCode);

    window.requestAnimationFrame(() => {
      editor.focus();
      const cursor = start + snippet.length;
      editor.setSelectionRange(cursor, cursor);
    });
  };

  const handleSourceKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab' || !onUpdateSourceContent) return;

    event.preventDefault();
    const editor = event.currentTarget;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const indent = '    ';
    const nextCode = `${sourceCode.slice(0, start)}${indent}${sourceCode.slice(end)}`;
    updateSourceCode(nextCode);

    window.requestAnimationFrame(() => {
      editor.setSelectionRange(start + indent.length, start + indent.length);
    });
  };

  const adjustEditorFontByWheel = useCallback((deltaY: number) => {
    if (!onFontSizeChange) return;
    onFontSizeChange(currentValue => currentValue + (deltaY < 0 ? 1 : -1));
  }, [onFontSizeChange]);

  const handleEditorFontWheel = (event: React.WheelEvent) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    event.stopPropagation();
    adjustEditorFontByWheel(event.deltaY);
  };

  useEffect(() => {
    if (!isLingCppBeginnerStructureMode) return undefined;

    const scrollRoot = beginnerStructureScrollRef.current;
    if (!scrollRoot) return undefined;

    const handleNativeFontWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;

      event.preventDefault();
      event.stopPropagation();
      adjustEditorFontByWheel(event.deltaY);
    };
    const wheelOptions: AddEventListenerOptions = { passive: false, capture: true };

    scrollRoot.addEventListener('wheel', handleNativeFontWheel, wheelOptions);
    return () => {
      scrollRoot.removeEventListener('wheel', handleNativeFontWheel, wheelOptions);
    };
  }, [activeFile?.path, adjustEditorFontByWheel, isLingCppBeginnerStructureMode]);

  const renderEplSourceToken = (token: string, index: number) => {
    if (token === '') return null;

    if (token.startsWith("'")) {
      return <span key={index} className="text-[#4aa34a]">{token}</span>;
    }
    if (token.startsWith('"') || token.startsWith('“')) {
      return <span key={index} className="text-[#d7c5a1]">{token}</span>;
    }
    if (/^\.(版本|支持库|程序集|程序集变量|子程序|局部变量)$/.test(token)) {
      return <span key={index} className="text-[#8f8f8f]">{token}</span>;
    }
    if (/^(窗口程序集_[\w\u4e00-\u9fa5]+)$/.test(token)) {
      return <span key={index} className="text-[#ff3bd7] font-semibold">{token}</span>;
    }
    if (/^_[\w\u4e00-\u9fa5]+_[\w\u4e00-\u9fa5_]+$/.test(token)) {
      return <span key={index} className="text-[#e5d47a]">{optimizeEplName(token)}</span>;
    }
    if (/^(文本型|整数型|逻辑型|小数型|双精度小数型|字节集|日期时间型)$/.test(token)) {
      return <span key={index} className="text-[#2bd4c6] font-semibold">{token}</span>;
    }
    if (/^(如果|如果真|否则如果|否则|如果结束|判断|判断结束|判断循环首|判断循环尾|循环判断首|循环判断尾|计次循环首|计次循环尾|变量循环首|变量循环尾|枚举循环首|循环尾)$/.test(token)) {
      return <span key={index} className="text-[#4ea5ff] font-semibold">{token}</span>;
    }
    if (/^(信息框|调试输出|输出调试文本|打开窗口|窗口_打开|载入窗口|载入新窗口|载入可视化设计|读取配置项|取运行目录|结束|返回)$/.test(token)) {
      return <span key={index} className="text-[#e9dfaa]">{token}</span>;
    }
    if (/^\d+$/.test(token)) {
      return <span key={index} className="text-[#b5cea8]">{token}</span>;
    }
    if (/^[＝=＋+\-*/（）(),，]$/.test(token)) {
      return <span key={index} className="text-[#cfcfcf]">{token}</span>;
    }

    return <span key={index} className="text-[#d7d7d7]">{token}</span>;
  };

  const renderEplFlowGuides = (guides: number[]) => {
    if (guides.length === 0) return null;

    return (
      <span aria-hidden="true" className="absolute inset-y-0 left-0 z-0">
        {guides.map((colorIndex, depth) => {
          const color = EPL_FLOW_GUIDE_COLORS[colorIndex % EPL_FLOW_GUIDE_COLORS.length];
          return (
            <span
              key={`${depth}-${colorIndex}`}
              className="absolute top-[3px] bottom-[3px] w-[2px] rounded-full"
              style={{
                left: `${depth * 14 + 3}px`,
                backgroundColor: color,
                boxShadow: `0 0 7px ${color}66`,
                opacity: 0.82
              }}
            />
          );
        })}
      </span>
    );
  };

  const renderEplSubprogramBox = (line: string, visualLine: EplVisualLine) => {
    const leadingSpace = line.match(/^\s*/)?.[0] ?? '';
    const subprogram = visualLine.subprogram;
    if (!subprogram) return null;

    const cellBorder = isDarkMode ? 'border-[#404047]' : 'border-slate-300';
    const labelClass = isDarkMode ? 'bg-[#24242a] text-[#8b949e]' : 'bg-slate-100 text-slate-500';
    const valueClass = isDarkMode ? 'bg-[#1d1d22] text-[#d6d6d6]' : 'bg-white text-slate-800';

    const renderCell = (label: string, value: string, valueColor = '') => (
      <span className={`inline-flex h-[22px] items-center border-r ${cellBorder}`}>
        <span className={`inline-flex h-full items-center px-2 text-[11px] ${labelClass}`}>{label}</span>
        <span className={`inline-flex h-full min-w-[72px] items-center px-2 text-[12px] ${valueClass} ${valueColor}`}>{value}</span>
      </span>
    );

    return (
      <>
        <span>{leadingSpace}</span>
        <span className={`inline-flex h-[22px] align-middle overflow-hidden rounded-[2px] border ${cellBorder}`}>
          {renderCell('子程序名', subprogram.name, 'text-[#ff4fda] font-semibold')}
          {renderCell('返回值类型', subprogram.returnType, subprogram.returnType === '无' ? 'text-[#888888]' : 'text-[#2bd4c6] font-semibold')}
          {renderCell('公开', subprogram.visibility, subprogram.visibility === '公开' ? 'text-[#39d98a] font-semibold' : '')}
          <span className="inline-flex h-[22px] items-center">
            <span className={`inline-flex h-full items-center px-2 text-[11px] ${labelClass}`}>备注</span>
            <span className={`inline-flex h-full min-w-[96px] items-center px-2 text-[12px] ${valueClass} text-[#6fbf73]`}>{subprogram.remark}</span>
          </span>
        </span>
      </>
    );
  };

  const renderEplVariableBox = (line: string, visualLine: EplVisualLine) => {
    const leadingSpace = line.match(/^\s*/)?.[0] ?? '';
    const variable = visualLine.variable;
    if (!variable) return null;

    const cellBorder = isDarkMode ? 'border-[#3f4a4a]' : 'border-teal-200';
    const labelClass = isDarkMode ? 'bg-[#1f2a2b] text-[#87a9a7]' : 'bg-teal-50 text-teal-700';
    const valueClass = isDarkMode ? 'bg-[#1b2022] text-[#d7e6e4]' : 'bg-white text-slate-800';

    const renderCell = (label: string, value: string, valueColor = '') => (
      <span className={`inline-flex h-[21px] items-center border-r ${cellBorder}`}>
        <span className={`inline-flex h-full items-center px-2 text-[11px] ${labelClass}`}>{label}</span>
        <span className={`inline-flex h-full min-w-[68px] items-center px-2 text-[12px] ${valueClass} ${valueColor}`}>{value}</span>
      </span>
    );

    return (
      <>
        <span>{leadingSpace}</span>
        <span className={`inline-flex h-[21px] align-middle overflow-hidden rounded-[2px] border ${cellBorder}`}>
          <span className={`inline-flex h-full items-center border-r px-2 text-[11px] font-semibold ${cellBorder} ${labelClass}`}>{variable.scope}</span>
          {renderCell('变量名', variable.name, 'text-[#ffd166] font-semibold')}
          {renderCell('类型', variable.type, 'text-[#2bd4c6] font-semibold')}
          <span className="inline-flex h-[21px] items-center">
            <span className={`inline-flex h-full items-center px-2 text-[11px] ${labelClass}`}>备注</span>
            <span className={`inline-flex h-full min-w-[82px] items-center px-2 text-[12px] ${valueClass} text-[#6fbf73]`}>{variable.remark}</span>
          </span>
        </span>
      </>
    );
  };

  const renderHighlightedSourceLine = (line: string, index: number, visualLine?: EplVisualLine) => {
    if (!line) return <span>&nbsp;</span>;

    const normalizedLine = activeFile?.language === 'epl' ? optimizeEplName(line) : line;
    if (activeFile?.language !== 'epl') {
      return renderSyntax(normalizedLine);
    }

    if (visualLine?.kind === 'subprogram') {
      return renderEplSubprogramBox(normalizedLine, visualLine);
    }
    if (visualLine?.kind === 'localVariable' || visualLine?.kind === 'programVariable') {
      return renderEplVariableBox(normalizedLine, visualLine);
    }

    const leadingSpace = normalizedLine.match(/^\s*/)?.[0] ?? '';
    const body = normalizedLine.slice(leadingSpace.length);

    if (body.startsWith("'")) {
      return (
        <>
          <span>{leadingSpace}</span>
          <span className="text-[#4aa34a]">{body}</span>
        </>
      );
    }

    const tokenPattern = /('.*$|“[^”]*”|"[^"]*"|\.(?:版本|支持库|程序集变量|程序集|子程序|局部变量)|如果真|否则如果|否则|如果结束|如果|判断循环首|判断循环尾|循环判断首|循环判断尾|计次循环首|计次循环尾|变量循环首|变量循环尾|枚举循环首|判断结束|判断|循环尾|信息框|调试输出|输出调试文本|打开窗口|窗口_打开|载入窗口|载入新窗口|载入可视化设计|读取配置项|取运行目录|结束|返回|文本型|整数型|逻辑型|小数型|双精度小数型|字节集|日期时间型|窗口程序集_[\w\u4e00-\u9fa5]+|_[\w\u4e00-\u9fa5]+_[\w\u4e00-\u9fa5_]+|\d+|[＝=＋+\-*/（）(),，])/g;
    return (
      <>
        <span>{leadingSpace}</span>
        {body.split(tokenPattern).map(renderEplSourceToken)}
      </>
    );
  };

  // C++ and EPL syntax coloring helper for increased legibility
  const renderSyntax = (text: string) => {
    if (!text) return <span>{text}</span>;

    if (activeFile?.language === 'epl') {
      // EPL syntax coloring
      const regex = /('.*)|(".*?")|(\.(?:版本|支持库|程序集|程序集变量|子程序|局部变量)|如果真|否则如果|否则|如果结束|如果|判断循环首|判断循环尾|循环判断首|循环判断尾|计次循环首|计次循环尾|变量循环首|变量循环尾|枚举循环首|判断结束|判断|循环尾|结束|返回|信息框|调试输出|输出调试文本|打开窗口|窗口_打开|载入窗口|载入新窗口|载入可视化设计|读取配置项|取运行目录)/g;
      const parts = text.split(regex);
      if (parts.length <= 1) {
        return <span>{text}</span>;
      }
      return (
        <span>
          {parts.map((part, index) => {
            if (part === undefined || part === '') return null;
            if (part.startsWith("'")) {
              return <span key={index} className="text-[#6A9955] font-mono italic">{part}</span>;
            }
            if (part.startsWith('"')) {
              return <span key={index} className="text-[#CE9178] font-mono font-semibold">{part}</span>;
            }
            if (/^(\.(?:版本|支持库|程序集|程序集变量|子程序|局部变量)|如果真|否则如果|否则|如果结束|如果|判断循环首|判断循环尾|循环判断首|循环判断尾|计次循环首|计次循环尾|变量循环首|变量循环尾|枚举循环首|判断结束|判断|循环尾|结束|返回|信息框|调试输出|输出调试文本|打开窗口|窗口_打开|载入窗口|载入新窗口|载入可视化设计|读取配置项|取运行目录)$/.test(part)) {
              return <span key={index} className="text-[#569CD6] font-semibold font-mono">{part}</span>;
            }
            return <span key={index}>{part}</span>;
          })}
        </span>
      );
    }

    // Highlight double quoted string literals, C++ keywords and comments
    const regex = /(\/\/.*)|(L?".*?")|(\b(?:const|int|char|wchar_t|void|return|if|else|struct|class|switch|case|break|default|include|define|wstring|string)\b)/g;
    const parts = text.split(regex);
    if (parts.length <= 1) {
      return <span>{text}</span>;
    }
    return (
      <span>
        {parts.map((part, index) => {
          if (part === undefined || part === '') return null;
          if (part.startsWith('//')) {
            return <span key={index} className="text-[#6A9955] font-mono">{part}</span>;
          }
          if (part.startsWith('"') || part.startsWith('L"')) {
            return <span key={index} className="text-[#CE9178] font-mono font-semibold">{part}</span>;
          }
          if (/^(const|int|char|wchar_t|void|return|if|else|struct|class|switch|case|break|default|include|define|wstring|string)$/.test(part)) {
            return <span key={index} className="text-[#569CD6] font-semibold font-mono">{part}</span>;
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  };

  // Code line highlighter for searched keywords
  const renderLineContent = (line: DiffLine, style: any) => {
    if (line.words) {
      return (
        <span className="break-all whitespace-pre-wrap">
          {line.words.map((word, idx) => {
            let className = '';
            if (word.changed) {
              if (line.type === 'modified') className = style.modifiedWord;
              else if (line.type === 'added') className = style.addedWord;
              else if (line.type === 'deleted') className = style.deletedWord;
            }

            // Apply search highlighting
            if (searchQuery && word.text.toLowerCase().includes(searchQuery.toLowerCase())) {
              className += ' bg-yellow-500 text-black font-bold outline outline-1 outline-yellow-400';
              return (
                <span key={idx} className={className}>
                  {word.text}
                </span>
              );
            }

            return (
              <span key={idx} className={className}>
                {renderSyntax(word.text)}
              </span>
            );
          })}
        </span>
      );
    }

    // Direct plain rendering
    const content = line.content;
    if (searchQuery && content.toLowerCase().includes(searchQuery.toLowerCase())) {
      const parts = content.split(new RegExp(`(${searchQuery})`, 'gi'));
      return (
        <span className="break-all whitespace-pre-wrap">
          {parts.map((part, idx) =>
            part.toLowerCase() === searchQuery.toLowerCase() ? (
              <mark key={idx} className="bg-yellow-500 text-black font-bold p-0.5 rounded animate-pulse">
                {part}
              </mark>
            ) : (
              <React.Fragment key={idx}>
                {renderSyntax(part)}
              </React.Fragment>
            )
          )}
        </span>
      );
    }

    return <span className="break-all whitespace-pre-wrap">{renderSyntax(content)}</span>;
  };

  // Collapse consecutive unchanged lines to avoid scrolling forever
  // E.g., if there are 10 unchanged lines, we can collapse them and show a folding header
  const getFolds = () => {
    const folds: { start: number; end: number }[] = [];
    let startUnchanged = -1;
    const threshold = 6; // Fold if more than 6 unchanged lines

    diffResult.originalLines.forEach((line, idx) => {
      const isUnchanged = line.type === 'unchanged';
      if (isUnchanged) {
        if (startUnchanged === -1) {
          startUnchanged = idx;
        }
      } else {
        if (startUnchanged !== -1) {
          const count = idx - startUnchanged;
          if (count >= threshold) {
            // Fold except 2 lines padding on start and end
            folds.push({ start: startUnchanged + 2, end: idx - 2 });
          }
          startUnchanged = -1;
        }
      }
    });

    if (startUnchanged !== -1) {
      const count = diffResult.originalLines.length - startUnchanged;
      if (count >= threshold) {
        folds.push({ start: startUnchanged + 2, end: diffResult.originalLines.length - 1 });
      }
    }

    return folds;
  };

  const folds = showFolds ? getFolds() : [];
  const foldedIndices = new Set<number>();
  const foldingHeaderMap = new Map<number, { count: number; end: number }>();

  folds.forEach(fold => {
    for (let idx = fold.start; idx < fold.end; idx++) {
      foldedIndices.add(idx);
    }
    foldingHeaderMap.set(fold.start, { count: fold.end - fold.start, end: fold.end });
  });

  const revealLingCppLine = (line: number) => {
    window.dispatchEvent(new CustomEvent('lingcpp-reveal-line', {
      detail: { filePath: activeFile?.path, line }
    }));
  };

  const revealReadableBlock = (block: LingCppReadableBlock) => {
    setFocusedReadableBlockId(block.id);
    if (block.handlerName) setSelectedBeginnerHandler(block.handlerName);
    window.dispatchEvent(new CustomEvent('lingcpp-reveal-block', {
      detail: { filePath: activeFile?.path, blockId: block.id, line: block.startLine }
    }));
  };

  const readableBlockGroups = useMemo(() => {
    const groups: Array<{ key: string; label: string; blocks: LingCppReadableBlock[] }> = [
      { key: 'class', label: '窗口入口', blocks: [] },
      { key: 'member-section', label: '窗口成员', blocks: [] },
      { key: 'constructor', label: '初始化', blocks: [] },
      { key: 'window-event', label: '窗口事件', blocks: [] },
      { key: 'control-event', label: '控件事件', blocks: [] },
      { key: 'menu-event', label: '菜单事件', blocks: [] },
      { key: 'other', label: '其他逻辑', blocks: [] }
    ];
    readableBlocks.forEach(block => {
      const key = block.kind === 'custom-event' || block.kind === 'method' || block.kind === 'destructor' ? 'other' : block.kind;
      const group = groups.find(item => item.key === key) || groups[groups.length - 1];
      group.blocks.push(block);
    });
    return groups.filter(group => group.blocks.length > 0);
  }, [readableBlocks]);

  const renderReadableBlockRow = (block: LingCppReadableBlock) => {
    const color =
      block.bindingStatus === 'missing-control'
        ? 'text-amber-300'
        : block.bindingStatus === 'missing-source'
          ? 'text-violet-300'
          : block.bindingStatus === 'bound'
            ? 'text-emerald-300'
            : isDarkMode
              ? 'text-slate-300'
              : 'text-slate-700';
    const isFocused = focusedReadableBlockId === block.id;

    return (
      <button
        key={block.id}
        type="button"
        onClick={() => revealReadableBlock(block)}
        onMouseEnter={() => setFocusedReadableBlockId(block.id)}
        onMouseLeave={() => setFocusedReadableBlockId(undefined)}
        className={`w-full grid grid-cols-[minmax(112px,1fr)_72px_54px] items-center gap-2 border-b px-2 py-1.5 text-left text-[11px] transition-colors ${
          isFocused
            ? isDarkMode ? 'border-amber-500/25 bg-amber-500/10' : 'border-amber-200 bg-amber-50'
            : isDarkMode ? 'border-[#2d2d34] hover:bg-[#272733]' : 'border-slate-200 hover:bg-slate-50'
        }`}
        title={`${block.title} - 第 ${block.startLine} 行到第 ${block.endLine} 行`}
      >
        <span className={`truncate font-semibold ${color}`}>{block.title}</span>
        <span className={`truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{block.summary || '无动作'}</span>
        <span className={`justify-self-end rounded px-1.5 py-0.5 text-[9px] font-semibold ${
          block.actionCount > 0
            ? isDarkMode ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700'
            : isDarkMode ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-100 text-slate-500'
        }`}>{block.actionCount} 动作</span>
      </button>
    );
  };

  const revealStructuredRow = (row: LingCppStructuredReadingRow) => {
    if (row.blockId) {
      setFocusedReadableBlockId(row.blockId);
      window.dispatchEvent(new CustomEvent('lingcpp-reveal-block', {
        detail: { filePath: activeFile?.path, blockId: row.blockId, line: row.line }
      }));
      return;
    }
    revealLingCppLine(row.line);
  };

  const splitParameterDraftParts = (value: string) => {
    const parts: string[] = [];
    let current = '';
    let quote: string | null = null;
    let depth = 0;

    for (const char of value) {
      if (quote) {
        current += char;
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        current += char;
        continue;
      }
      if (char === '(' || char === '（') {
        depth += 1;
        current += char;
        continue;
      }
      if (char === ')' || char === '）') {
        depth = Math.max(0, depth - 1);
        current += char;
        continue;
      }
      if ((char === ',' || char === '，') && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
      current += char;
    }

    parts.push(current);
    return parts;
  };

  const splitParameterDefaultDraft = (value: string) => {
    let quote: string | null = null;
    let depth = 0;

    for (let index = 0; index < value.length; index += 1) {
      const char = value[index];
      if (quote) {
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === '(' || char === '（') {
        depth += 1;
        continue;
      }
      if (char === ')' || char === '）') {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (char === '=' && depth === 0) {
        return {
          definition: value.slice(0, index).trim(),
          defaultValue: value.slice(index + 1).trim()
        };
      }
    }

    return { definition: value.trim(), defaultValue: '' };
  };

  const formatSingleParameterDraft = (parameter: LingCppParameter) => {
    const declaration = `${parameter.type} ${parameter.name}`.trim();
    const defaultValue = parameter.defaultValue?.trim();
    return defaultValue ? `${declaration} = ${defaultValue}` : declaration;
  };

  const formatParameterDraft = (parameters?: LingCppParameter[]) =>
    (parameters || []).map(formatSingleParameterDraft).join(', ');

  const parseParameterDraft = (value: string): LingCppParameter[] =>
    splitParameterDraftParts(value)
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const { definition, defaultValue } = splitParameterDefaultDraft(part);
        const [type, ...nameParts] = definition.split(/\s+/u).filter(Boolean);
        const name = nameParts.join('');
        const parameter: LingCppParameter = {
          type: name ? type : '对象',
          name: name || type
        };
        if (defaultValue) parameter.defaultValue = defaultValue;
        return parameter;
      });

  const applyStructureAstEdits = (edits: LingCppAstEdit[], revealLine?: number) => {
    if (!onUpdateSourceContent) {
      setStructureEditError('当前文件是只读状态，无法回写结构编辑。');
      return false;
    }

    let nextSource = normalizedSourceCode;
    for (const edit of edits) {
      const result = applyLingCppAstEdit(nextSource, edit);
      if (!result.success) {
        setStructureEditError(result.error || result.diagnostics[0]?.message || '结构编辑失败，源码已保持不变。');
        return false;
      }
      nextSource = result.sourceCode;
    }

    updateSourceCode(nextSource);
    setStructureEditDraft(null);
    setStructureEditError(null);
    if (revealLine) window.requestAnimationFrame(() => revealLingCppLine(revealLine));
    return true;
  };

  const startEditStructuredRow = (row: LingCppStructuredReadingRow) => {
    if (!row.editable || !row.editKind) return;
    setStructureEditError(null);
    if (row.editKind === 'missing-event') {
      setStructureEditDraft({
        mode: 'add-event',
        rowId: row.id,
        line: row.line,
        className: row.className || primaryLingCppClass?.name,
        targetName: row.targetName || row.name,
        name: row.targetName || row.name,
        type: '',
        baseClass: '',
        initialValue: '',
        parameters: '',
        returnType: '空',
        note: '由设计器绑定生成的事件处理器'
      });
      return;
    }
    if (row.editKind === 'note') return;
    setStructureEditDraft({
      mode: row.editKind,
      rowId: row.id,
      line: row.line,
      className: row.className,
      targetName: row.targetName || row.name,
      name: row.editKind === 'event' || row.editKind === 'method'
        ? row.targetName || row.name
        : row.name,
      type: row.editKind === 'member' ? row.type || '' : '',
      baseClass: row.editKind === 'class' ? row.value || '' : '',
      initialValue: row.initialValue || '',
      parameters: formatParameterDraft(row.parameters),
      returnType: row.returnType || row.type || '空',
      note: ''
    });
  };

  const startAddStructuredItem = (mode: 'add-member' | 'add-event') => {
    if (!primaryLingCppClass) {
      setStructureEditError('当前源码里还没有类，无法新增成员或事件。');
      return;
    }
    setStructureEditError(null);
    setStructureEditDraft({
      mode,
      className: primaryLingCppClass.name,
      name: mode === 'add-member' ? '新成员' : '_按钮1_被单击',
      type: mode === 'add-member' ? '文本型' : '',
      baseClass: '',
      initialValue: '',
      parameters: '',
      returnType: '空',
      note: ''
    });
  };

  const saveStructureEditDraft = () => {
    if (!structureEditDraft) return;
    const draft = structureEditDraft;
    const note = draft.note.trim();
    const edits: LingCppAstEdit[] = [];

    if ((draft.mode === 'package' || draft.mode === 'class' || draft.mode === 'member' || draft.mode === 'method' || draft.mode === 'event' || draft.mode === 'add-member' || draft.mode === 'add-event') && !draft.name.trim()) {
      setStructureEditError('名称不能为空。');
      return;
    }

    if (draft.mode === 'package') {
      edits.push({ kind: 'update-package', packageName: draft.name.trim() });
      if (note && draft.line) edits.push({ kind: 'update-note', line: draft.line, note });
    }

    if (draft.mode === 'class') {
      edits.push({
        kind: 'update-class',
        className: draft.className,
        line: draft.line,
        newName: draft.name.trim(),
        baseClass: draft.baseClass.trim() || undefined,
        note: note || undefined
      });
    }

    if (draft.mode === 'member') {
      if (!draft.type.trim()) {
        setStructureEditError('成员类型不能为空。');
        return;
      }
      edits.push({
        kind: 'update-member',
        className: draft.className,
        memberName: draft.targetName || draft.name,
        newName: draft.name.trim(),
        type: draft.type.trim(),
        initialValue: draft.initialValue.trim() || undefined,
        note: note || undefined
      });
    }

    if (draft.mode === 'method') {
      edits.push({
        kind: 'update-method-signature',
        className: draft.className,
        methodName: draft.targetName || draft.name,
        newName: draft.name.trim(),
        returnType: draft.returnType.trim() || '空',
        parameters: parseParameterDraft(draft.parameters),
        note: note || undefined
      });
    }

    if (draft.mode === 'event') {
      edits.push({
        kind: 'update-event',
        className: draft.className,
        handlerName: draft.targetName || draft.name,
        newHandlerName: draft.name.trim(),
        parameters: parseParameterDraft(draft.parameters),
        note: note || undefined
      });
    }

    if (draft.mode === 'add-member') {
      if (!draft.type.trim()) {
        setStructureEditError('成员类型不能为空。');
        return;
      }
      edits.push({
        kind: 'add-member',
        className: draft.className,
        member: {
          name: draft.name.trim(),
          type: draft.type.trim(),
          initialValue: draft.initialValue.trim() || undefined,
          note: note || undefined
        }
      });
    }

    if (draft.mode === 'add-event') {
      edits.push({
        kind: 'add-event',
        className: draft.className,
        event: {
          handlerName: draft.name.trim(),
          parameters: parseParameterDraft(draft.parameters),
          note: note || undefined
        }
      });
    }

    if (edits.length === 0) {
      setStructureEditError('没有可应用的结构编辑。');
      return;
    }

    applyStructureAstEdits(edits, draft.line);
  };

  const deleteStructuredRow = (row: LingCppStructuredReadingRow) => {
    if (!row.className || !row.targetName) return;
    const edit: LingCppAstEdit | undefined = row.editKind === 'member'
      ? { kind: 'delete-member', className: row.className, memberName: row.targetName }
      : row.editKind === 'event'
        ? { kind: 'delete-event', className: row.className, handlerName: row.targetName }
        : row.editKind === 'method'
          ? { kind: 'delete-method', className: row.className, methodName: row.targetName }
        : undefined;
    if (!edit) return;
    const label = row.editKind === 'member' ? '成员变量' : row.editKind === 'event' ? '事件处理器' : '子程序';
    if (!window.confirm(`确定删除${label}「${row.targetName}」吗？`)) return;
    applyStructureAstEdits([edit], row.line);
  };

  type DirectStructureField =
    | 'package-name'
    | 'class-name'
    | 'class-base'
    | 'member-type'
    | 'member-name'
    | 'member-initial'
    | 'member-static'
    | 'member-array'
    | 'member-note'
    | 'method-name'
    | 'method-return'
    | 'method-parameters'
    | 'event-handler'
    | 'event-parameters';

  const booleanCellValue = (checked?: boolean) => checked ? '真' : '假';
  const parseBooleanCellValue = (value: string) => /^(真|是|1|true|yes)$/i.test(value.trim());

  const commitDirectStructureValue = (
    row: LingCppStructuredReadingRow,
    field: DirectStructureField,
    rawValue: string
  ) => {
    if (!row.editable || !row.editKind) return;
    const nextValue = rawValue.trim();
    const currentParameters = formatParameterDraft(row.parameters);
    const currentValue =
      field === 'package-name' ? row.targetName || row.name :
      field === 'class-name' ? row.targetName || row.name :
      field === 'class-base' ? row.value || '' :
      field === 'member-type' ? row.type || '' :
      field === 'member-name' ? row.targetName || row.name :
      field === 'member-initial' ? row.initialValue || '' :
      field === 'member-static' ? booleanCellValue(row.isStatic) :
      field === 'member-array' ? booleanCellValue(row.isArray) :
      field === 'member-note' ? row.note || '' :
      field === 'method-name' ? row.targetName || row.name :
      field === 'method-return' ? row.returnType || row.type || '空' :
      field === 'method-parameters' ? currentParameters :
      field === 'event-handler' ? row.targetName || row.name :
      field === 'event-parameters' ? currentParameters :
      '';

    if (nextValue === currentValue) return;

    const requiredField = ![
      'member-initial',
      'member-static',
      'member-array',
      'member-note',
      'class-base',
      'method-parameters',
      'event-parameters'
    ].includes(field);
    if (requiredField && !nextValue) {
      setStructureEditError('名称、类型或返回值不能为空。');
      return;
    }

    const edit: LingCppAstEdit | undefined =
      field === 'package-name'
        ? { kind: 'update-package', packageName: nextValue }
        : row.editKind === 'class'
          ? {
              kind: 'update-class',
              className: row.className,
              line: row.line,
              newName: field === 'class-name' ? nextValue : row.targetName || row.name,
              baseClass: field === 'class-base' ? nextValue || undefined : row.value || undefined
            }
          : row.editKind === 'member'
            ? {
                kind: 'update-member',
                className: row.className,
                memberName: row.targetName || row.name,
                newName: field === 'member-name' ? nextValue : row.targetName || row.name,
                type: field === 'member-type' ? nextValue : row.type || '对象',
                initialValue: field === 'member-initial' ? nextValue || undefined : row.initialValue || undefined,
                isStatic: field === 'member-static' ? parseBooleanCellValue(nextValue) : row.isStatic,
                isArray: field === 'member-array' ? parseBooleanCellValue(nextValue) : row.isArray,
                note: field === 'member-note' ? nextValue : undefined
              }
            : row.editKind === 'method'
              ? {
                  kind: 'update-method-signature',
                  className: row.className,
                  methodName: row.targetName || row.name,
                  newName: field === 'method-name' ? nextValue : row.targetName || row.name,
                  returnType: field === 'method-return' ? nextValue || '空' : row.returnType || row.type || '空',
                  parameters: field === 'method-parameters' ? parseParameterDraft(nextValue) : row.parameters || []
                }
              : row.editKind === 'event'
                ? {
                    kind: 'update-event',
                    className: row.className,
                    handlerName: row.targetName || row.name,
                    newHandlerName: field === 'event-handler' ? nextValue : row.targetName || row.name,
                    parameters: field === 'event-parameters' ? parseParameterDraft(nextValue) : row.parameters || []
                  }
                : row.editKind === 'missing-event'
                  ? {
                      kind: 'add-event',
                      className: row.className || primaryLingCppClass?.name,
                      event: {
                        handlerName: field === 'event-handler' ? nextValue : row.targetName || row.name,
                        parameters: field === 'event-parameters' ? parseParameterDraft(nextValue) : row.parameters || [],
                        note: row.note || undefined
                      }
                    }
                  : undefined;

    if (!edit) return;
    applyStructureAstEdits([edit], row.line);
  };

  const directInputClasses = (tone: StructureInputTone = 'plain') => {
    const sizeClass = tone === 'procedure'
      ? 'h-[var(--beginner-procedure-input-height)] text-[length:var(--beginner-procedure-font-size)] leading-[var(--beginner-table-line-height)]'
      : 'h-[var(--beginner-input-height)] text-[length:var(--beginner-table-font-size)] leading-[var(--beginner-table-line-height)]';
    const toneClass =
      tone === 'procedure'
        ? isDarkMode ? 'font-bold text-cyan-200' : 'font-bold text-cyan-800'
        : tone === 'variable'
          ? isDarkMode ? 'font-semibold text-amber-200' : 'font-semibold text-amber-800'
          : tone === 'parameter'
            ? isDarkMode ? 'font-semibold text-violet-200' : 'font-semibold text-violet-700'
            : tone === 'type'
              ? isDarkMode ? 'font-semibold text-blue-300' : 'font-semibold text-blue-700'
              : tone === 'name'
                ? isDarkMode ? 'font-semibold text-slate-100' : 'font-semibold text-slate-900'
                : tone === 'value'
                  ? isDarkMode ? 'text-emerald-300' : 'text-emerald-700'
                  : isDarkMode ? 'text-slate-300' : 'text-slate-700';
    return `${sizeClass} box-border w-full max-w-full min-w-0 rounded border px-1.5 leading-5 outline-none transition-colors placeholder:text-slate-500 ${
      isDarkMode
        ? 'border-transparent bg-transparent hover:border-[#343442] hover:bg-[#111118] focus:border-cyan-500/70 focus:bg-[#111118]'
        : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-white focus:border-cyan-500 focus:bg-white'
    } ${toneClass}`;
  };

  const renderDirectStructureInput = (
    row: LingCppStructuredReadingRow,
    field: DirectStructureField,
    value: string,
    placeholder: string,
    tone: StructureInputTone = 'plain'
  ) => (
    <input
      key={`${row.id}:${field}:${value}`}
      defaultValue={value}
      placeholder={placeholder}
      list={
        field === 'member-name' ? 'beginner-member-name-suggestions'
        : field === 'method-name' || field === 'event-handler' ? 'beginner-method-name-suggestions'
        : undefined
      }
      autoComplete="off"
      readOnly={!onUpdateSourceContent || !row.editable}
      onBlur={event => commitDirectStructureValue(row, field, event.currentTarget.value)}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          event.currentTarget.value = value;
          event.currentTarget.blur();
        }
      }}
      onFocus={event => event.currentTarget.select()}
      className={directInputClasses(tone)}
      title="直接输入，回车或离开单元格后写回源码"
    />
  );

  const resetNewMemberDraft = () => {
    setNewMemberDraft({ type: '文本型', name: '', initialValue: '', isStatic: false, isArray: false, note: '' });
    setStructureEditError(null);
  };

  const commitNewMemberDraft = () => {
    const draft = newMemberDraft;
    const name = draft.name.trim();
    const type = draft.type.trim();
    if (!name) {
      setStructureEditError('新增成员需要填写名称。');
      return;
    }
    if (!type) {
      setStructureEditError('新增成员需要填写类型。');
      return;
    }
    if (!primaryLingCppClass) {
      setStructureEditError('当前源码里还没有类，无法新增成员。');
      return;
    }

    const applied = applyStructureAstEdits([{
      kind: 'add-member',
      className: primaryLingCppClass.name,
      member: {
        name,
        type,
        initialValue: draft.initialValue.trim() || undefined,
        isStatic: draft.isStatic,
        isArray: draft.isArray,
        note: draft.note.trim() || undefined
      }
    }]);
    if (applied) resetNewMemberDraft();
  };

  const renderNewMemberInput = (
    field: 'type' | 'name' | 'initialValue' | 'note',
    placeholder: string,
    tone: StructureInputTone = 'plain'
  ) => (
    <input
      value={newMemberDraft[field]}
      placeholder={placeholder}
      list={
        field === 'name' ? 'beginner-member-name-suggestions'
        : undefined
      }
      autoComplete="off"
      disabled={!onUpdateSourceContent || !primaryLingCppClass}
      onChange={event => setNewMemberDraft(current => ({ ...current, [field]: event.target.value }))}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          resetNewMemberDraft();
          event.currentTarget.blur();
        }
      }}
      className={`${directInputClasses(tone)} disabled:cursor-not-allowed disabled:opacity-40`}
      title="填写完整后点击“新增”写回源码"
    />
  );

  const renderMemberBooleanSwitch = (
    row: LingCppStructuredReadingRow,
    field: 'member-static' | 'member-array',
    checked = false,
    title: string
  ) => {
    const disabled = !onUpdateSourceContent || !row.editable;
    return (
      <label
        className={`inline-flex h-[var(--beginner-input-height)] w-full items-center justify-center ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
        title={title}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={event => commitDirectStructureValue(row, field, booleanCellValue(event.currentTarget.checked))}
        />
        <span className={`relative h-[var(--beginner-switch-height)] w-[var(--beginner-switch-width)] rounded-full transition-colors ${
          checked
            ? isDarkMode ? 'bg-cyan-500/80' : 'bg-cyan-600'
            : isDarkMode ? 'bg-[#2b2d34]' : 'bg-slate-300'
        }`}>
          <span className={`absolute top-[var(--beginner-switch-knob-offset)] h-[var(--beginner-switch-knob-size)] w-[var(--beginner-switch-knob-size)] rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[var(--beginner-switch-knob-translate)]' : 'translate-x-[var(--beginner-switch-knob-offset)]'
          }`} />
        </span>
      </label>
    );
  };

  const renderNewMemberBooleanSwitch = (
    field: 'isStatic' | 'isArray',
    title: string
  ) => {
    const checked = Boolean(newMemberDraft[field]);
    const disabled = !onUpdateSourceContent || !primaryLingCppClass;
    return (
      <label
        className={`inline-flex h-[var(--beginner-input-height)] w-full items-center justify-center ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
        title={title}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={event => {
            const nextChecked = event.currentTarget.checked;
            setNewMemberDraft(current => ({ ...current, [field]: nextChecked }));
          }}
        />
        <span className={`relative h-[var(--beginner-switch-height)] w-[var(--beginner-switch-width)] rounded-full transition-colors ${
          checked
            ? isDarkMode ? 'bg-cyan-500/80' : 'bg-cyan-600'
            : isDarkMode ? 'bg-[#2b2d34]' : 'bg-slate-300'
        }`}>
          <span className={`absolute top-[var(--beginner-switch-knob-offset)] h-[var(--beginner-switch-knob-size)] w-[var(--beginner-switch-knob-size)] rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[var(--beginner-switch-knob-translate)]' : 'translate-x-[var(--beginner-switch-knob-offset)]'
          }`} />
        </span>
      </label>
    );
  };

  const commitNewEventDraft = (patch: Partial<typeof newEventDraft> = {}) => {
    const draft = { ...newEventDraft, ...patch };
    setNewEventDraft(draft);
    const handlerName = draft.handlerName.trim();
    if (!handlerName) return;
    if (!primaryLingCppClass) {
      setStructureEditError('当前源码里还没有类，无法新增事件。');
      return;
    }

    const applied = applyStructureAstEdits([{
      kind: 'add-event',
      className: primaryLingCppClass.name,
      event: {
        handlerName,
        parameters: parseParameterDraft(draft.parameters)
      }
    }]);
    if (applied) {
      setNewEventDraft({ handlerName: '', parameters: '' });
      setSelectedBeginnerHandler(handlerName);
      setSelectedBeginnerCodeTarget({ className: primaryLingCppClass.name, methodName: handlerName });
      setExpandedBeginnerEventTargetKey(`${primaryLingCppClass.name}:event:${handlerName}`);
      window.requestAnimationFrame(() => {
        scrollElementInsideBeginnerEditor(document.getElementById('lingcpp-structure-section-event'), 'start');
      });
    }
  };

  const renderNewEventInput = (
    field: keyof typeof newEventDraft,
    placeholder: string,
    tone: StructureInputTone = 'plain'
  ) => (
    <input
      value={newEventDraft[field]}
      placeholder={placeholder}
      disabled={!onUpdateSourceContent || !primaryLingCppClass}
      onChange={event => setNewEventDraft(current => ({ ...current, [field]: event.target.value }))}
      onBlur={event => commitNewEventDraft({ [field]: event.currentTarget.value })}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setNewEventDraft({ handlerName: '', parameters: '' });
          event.currentTarget.blur();
        }
      }}
      className={`${directInputClasses(tone)} disabled:cursor-not-allowed disabled:opacity-40`}
      title="输入处理器名后自动新增事件"
    />
  );

  const commitNewFunctionDraft = (patch: Partial<typeof newFunctionDraft> = {}) => {
    const draft = { ...newFunctionDraft, ...patch };
    setNewFunctionDraft(draft);
    const name = draft.name.trim();
    if (!name) return;
    if (!primaryLingCppClass) {
      setStructureEditError('当前源码里还没有类，无法新增功能代码。');
      return;
    }

    const applied = applyStructureAstEdits([{
      kind: 'add-method',
      className: primaryLingCppClass.name,
      method: {
        name,
        returnType: draft.returnType.trim() || '空',
        parameters: parseParameterDraft(draft.parameters),
        note: '新手模式新增的功能代码'
      }
    }]);
    if (applied) {
      setNewFunctionDraft({ returnType: '空', name: '', parameters: '' });
      setSelectedBeginnerCodeTarget({ className: primaryLingCppClass.name, methodName: name });
      setExpandedBeginnerFunctionTargetKey(`${primaryLingCppClass.name}:method:${name}`);
      window.requestAnimationFrame(() => {
        scrollElementInsideBeginnerEditor(document.getElementById('lingcpp-structure-section-function'), 'start');
      });
    }
  };

  const renderNewFunctionInput = (
    field: keyof typeof newFunctionDraft,
    placeholder: string,
    tone: StructureInputTone = 'plain'
  ) => (
    <input
      value={newFunctionDraft[field]}
      placeholder={placeholder}
      list={
        field === 'name' ? 'beginner-method-name-suggestions'
        : undefined
      }
      autoComplete="off"
      disabled={!onUpdateSourceContent || !primaryLingCppClass}
      onChange={event => setNewFunctionDraft(current => ({ ...current, [field]: event.target.value }))}
      onBlur={event => commitNewFunctionDraft({ [field]: event.currentTarget.value })}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setNewFunctionDraft({ returnType: '空', name: '', parameters: '' });
          event.currentTarget.blur();
        }
      }}
      className={`${directInputClasses(tone)} disabled:cursor-not-allowed disabled:opacity-40`}
      title="输入功能名后自动新增功能代码"
    />
  );

  const methodBodyText = (method: LingCppMethod) =>
    method.statements.map(statement => statement.text).join('\n').replace(/\s+$/u, '');

  const methodBodyStartColumn = (method: LingCppMethod) => inferBeginnerBodyStartColumn(
    normalizedSourceLines,
    method.line,
    method.statements.map(statement => statement.line)
  );

  const methodBodySourceColumns = (method: LingCppMethod) => getBeginnerBodySourceColumns(
    method.statements,
    methodBodyStartColumn(method)
  );

  const commitBeginnerCodeBody = (
    className: string | undefined,
    methodName: string,
    currentBody: string,
    nextBody: string
  ) => {
    const normalizedNext = nextBody.replace(/\s+$/u, '');
    if (normalizedNext === currentBody.replace(/\s+$/u, '')) return true;
    return applyStructureAstEdits([{
      kind: 'update-method-body',
      className,
      methodName,
      bodyLines: normalizedNext ? normalizedNext.split(/\r?\n/u) : []
    }]);
  };

  const updateStructureDraft = (patch: Partial<StructureEditDraft>) => {
    setStructureEditDraft(current => current ? { ...current, ...patch } : current);
  };

  const renderStructureInput = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder?: string,
    autoFocus = false
  ) => (
    <label className="min-w-0">
      <span className={`mb-1 block text-[10px] font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`h-7 w-full rounded border px-2 text-[11px] outline-none transition-colors ${
          isDarkMode
            ? 'border-[#343442] bg-[#111118] text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/70'
            : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-cyan-500'
        }`}
      />
    </label>
  );

  const renderStructureEditForm = (draft: StructureEditDraft) => {
    const title: Record<StructureEditMode, string> = {
      package: '编辑包名',
      class: '编辑类',
      member: '编辑成员',
      method: '编辑方法',
      event: '编辑事件',
      'add-member': '新增成员',
      'add-event': '新增事件'
    };
    const isExistingMember = draft.mode === 'member';
    const isExistingEvent = draft.mode === 'event';
    const isMember = draft.mode === 'member' || draft.mode === 'add-member';
    const isEvent = draft.mode === 'event' || draft.mode === 'add-event';
    const isClass = draft.mode === 'class';
    const isMethod = draft.mode === 'method';
    const isPackage = draft.mode === 'package';
    const actionLabel = draft.mode === 'add-event'
      ? '生成事件'
      : draft.mode === 'add-member'
        ? '新增成员'
        : '保存修改';

    return (
      <form
        onSubmit={event => {
          event.preventDefault();
          saveStructureEditDraft();
        }}
        className={`border-b px-3 py-3 ${
          isDarkMode ? 'border-cyan-500/20 bg-[#20202a]' : 'border-cyan-200 bg-cyan-50/70'
        }`}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className={`truncate text-[12px] font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>属性编辑 · {title[draft.mode]}</div>
            <div className={`mt-0.5 truncate text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
              {draft.line ? `源码第 ${draft.line} 行` : '将写回当前 .lcpp 源码'}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="submit"
              className={`h-7 rounded px-2.5 inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                isDarkMode ? 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25' : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
              }`}
              title="保存结构编辑"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{actionLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStructureEditDraft(null);
                setStructureEditError(null);
              }}
              className={`h-7 rounded px-2 inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                isDarkMode ? 'text-slate-500 hover:bg-[#2d2d34] hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100'
              }`}
              title="取消结构编辑"
            >
              <X className="h-3.5 w-3.5" />
              <span>取消</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(isPackage || isClass || isExistingMember || isExistingEvent || isMethod) && renderStructureInput(
            isPackage ? '包名' : isClass ? '类名' : isMember ? '名称' : isEvent ? '处理器' : '方法名',
            draft.name,
            value => updateStructureDraft({ name: value }),
            undefined,
            true
          )}
          {(draft.mode === 'add-member' || draft.mode === 'add-event') && renderStructureInput(
            draft.mode === 'add-member' ? '名称' : '处理器',
            draft.name,
            value => updateStructureDraft({ name: value }),
            undefined,
            true
          )}
          {isClass && renderStructureInput('基础类', draft.baseClass, value => updateStructureDraft({ baseClass: value }), '窗体')}
          {isMember && renderStructureInput('类型', draft.type, value => updateStructureDraft({ type: value }), '文本型')}
          {isMember && renderStructureInput('初始值', draft.initialValue, value => updateStructureDraft({ initialValue: value }), '可留空')}
          {isMethod && renderStructureInput('返回值', draft.returnType, value => updateStructureDraft({ returnType: value }), '空')}
          {(isEvent || isMethod) && renderStructureInput('参数', draft.parameters, value => updateStructureDraft({ parameters: value }), '文本型 文本, 整数型 次数')}
        </div>
        <div className="mt-2">
          {renderStructureInput('备注（留空不改）', draft.note, value => updateStructureDraft({ note: value }), '会写入为上一行注释')}
        </div>
      </form>
    );
  };

  const createMissingDesignerEventEdit = (row: LingCppStructuredReadingRow): LingCppAstEdit | null => {
    const handlerName = row.targetName || row.name;
    const className = row.className || primaryLingCppClass?.name;
    if (!handlerName || !className) return null;
    return {
      kind: 'add-event',
      className,
      event: {
        handlerName,
        parameters: row.parameters || [],
        note: row.note || '由设计器事件自动生成'
      }
    };
  };

  const quickGenerateMissingDesignerEvent = (row: LingCppStructuredReadingRow) => {
    const edit = createMissingDesignerEventEdit(row);
    if (!edit || edit.kind !== 'add-event') {
      setStructureEditError('当前源码里还没有可绑定事件的类。');
      return false;
    }
    const applied = applyStructureAstEdits([edit], row.line);
    if (applied) {
      setSelectedBeginnerHandler(edit.event.handlerName);
      setSelectedBeginnerCodeTarget({ className: edit.className, methodName: edit.event.handlerName });
      setExpandedBeginnerEventTargetKey(`${edit.className}:event:${edit.event.handlerName}`);
    }
    return applied;
  };

  const renderStructuredReadingRows = () => {
    const groupTitle: Record<LingCppStructuredReadingRow['group'], string> = {
      declaration: '源码声明',
      package: '入口',
      class: '类',
      member: '成员声明',
      method: '方法',
      constructor: '初始化',
      event: '事件处理器',
      parameter: '参数',
      note: '备注'
    };
    const statusLabel = {
      bound: '已绑定',
      'unbound-source': '未绑定',
      'missing-source': '缺少源码',
      'missing-control': '缺少控件'
    } satisfies Record<NonNullable<LingCppStructuredReadingRow['status']>, string>;
    const isMissingEventRow = (row: LingCppStructuredReadingRow) =>
      row.editKind === 'missing-event' || row.status === 'missing-source';
    const pendingEventRows = structuredReadingRows.filter(isMissingEventRow);
    const normalRows = structuredReadingRows.filter(row => !isMissingEventRow(row));
    const panelGroupOrder: LingCppStructuredReadingRow['group'][] = [
      'class',
      'member',
      'event',
      'method',
      'constructor',
      'declaration',
      'package',
      'parameter',
      'note'
    ];
    const groups = panelGroupOrder
      .map(group => ({
        group,
        rows: normalRows.filter(row => row.group === group)
      }))
      .filter(group => group.rows.length > 0);

    const renderRowCard = (row: LingCppStructuredReadingRow, compact = false) => {
      const isMissingEvent = isMissingEventRow(row);
      const nameColor =
        row.status === 'missing-control' || row.status === 'missing-source'
          ? isDarkMode ? 'text-amber-300' : 'text-amber-700'
          : row.status === 'bound'
            ? isDarkMode ? 'text-emerald-300' : 'text-emerald-700'
            : isDarkMode ? 'text-slate-200' : 'text-slate-800';
      const handlePrimaryClick = () => {
        revealStructuredRow(row);
      };
      const isMemberRow = row.group === 'member';
      const isControlMember = isControlMemberRow(row);

      return (
        <div
          key={row.id}
          data-structured-line={row.line}
          onMouseEnter={() => row.blockId && setFocusedReadableBlockId(row.blockId)}
          onMouseLeave={() => row.blockId && setFocusedReadableBlockId(undefined)}
          className={`w-full border-b px-2 py-2 text-left text-[11px] transition-colors ${
            structureEditDraft?.rowId === row.id
              ? isDarkMode ? 'border-cyan-500/25 bg-cyan-500/10' : 'border-cyan-200 bg-cyan-50'
              : isDarkMode ? 'border-[#2d2d34] hover:bg-[#272733]' : 'border-slate-200 hover:bg-slate-50'
          }`}
          title={`${row.name} - 第 ${row.line} 行`}
        >
          <div className="flex items-start justify-between gap-2">
            <div
              onDoubleClick={handlePrimaryClick}
              className="min-w-0 flex-1 text-left"
            >
              {isMemberRow && !compact ? (
                <>
                  <div className="grid min-w-0 grid-cols-[72px_minmax(96px,1fr)] items-center gap-2">
                    <span className={`truncate rounded px-1.5 py-0.5 text-center text-[10px] font-semibold ${
                      isControlMember
                        ? isDarkMode ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700'
                        : isDarkMode ? 'bg-slate-700/60 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}>{row.type || '类型'}</span>
                    <span className={`truncate text-[12px] font-semibold ${nameColor}`}>{row.name}</span>
                  </div>
                  <div className={`mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-[10.5px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    <span>{isControlMember ? '控件成员' : '成员变量'}</span>
                    {row.access && <span>{row.access}</span>}
                    {row.initialValue && <span className="truncate">初始值：{row.initialValue}</span>}
                    <span className="truncate">第 {row.line} 行</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                      isMissingEvent
                        ? isDarkMode ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                        : isDarkMode ? 'bg-slate-700/60 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}>{isMissingEvent ? '待生成' : groupTitle[row.group]}</span>
                    {row.editKind === 'package' ? (
                      renderDirectStructureInput(row, 'package-name', row.targetName || row.name, '包名', 'name')
                    ) : row.editKind === 'class' ? (
                      <div className="grid min-w-0 flex-1 grid-cols-[minmax(80px,1fr)_minmax(60px,0.75fr)] gap-1.5">
                        {renderDirectStructureInput(row, 'class-name', row.targetName || row.name, '类名', 'name')}
                        {renderDirectStructureInput(row, 'class-base', row.value || '', '基础类', 'type')}
                      </div>
                    ) : row.editKind === 'event' ? (
                      <div className="grid min-w-0 flex-1 grid-cols-[minmax(96px,1fr)_minmax(70px,0.8fr)] gap-1.5">
                        {renderDirectStructureInput(row, 'event-handler', row.targetName || row.name, '处理器', 'procedure')}
                        {renderDirectStructureInput(row, 'event-parameters', formatParameterDraft(row.parameters), '参数', 'plain')}
                      </div>
                    ) : row.editKind === 'method' ? (
                      <div className="grid min-w-0 flex-1 grid-cols-[minmax(76px,1fr)_52px_minmax(70px,0.8fr)] gap-1.5">
                        {renderDirectStructureInput(row, 'method-name', row.targetName || row.name, '方法名', 'procedure')}
                        {renderDirectStructureInput(row, 'method-return', row.returnType || row.type || '空', '返回值', 'type')}
                        {renderDirectStructureInput(row, 'method-parameters', formatParameterDraft(row.parameters), '参数', 'plain')}
                      </div>
                    ) : (
                      <span className={`truncate font-semibold ${nameColor}`}>{row.name}</span>
                    )}
                  </div>
                  <div className={`mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-[10.5px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    {row.type && <span className="truncate">类型：{row.type}</span>}
                    {row.value && <span className="truncate">值：{row.value}</span>}
                    {!compact && row.status && <span className="truncate">状态：{statusLabel[row.status]}</span>}
                    {!compact && <span className="truncate">第 {row.line} 行</span>}
                    {!compact && row.note && <span className="truncate">备注：{row.note}</span>}
                  </div>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {isMissingEvent && (
                <button
                  type="button"
                  onClick={() => quickGenerateMissingDesignerEvent(row)}
                  disabled={!onUpdateSourceContent}
                  className={`rounded px-1.5 py-1 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    isDarkMode ? 'bg-amber-400/15 text-amber-200 hover:bg-amber-400/25' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  }`}
                  title={`快速生成事件 ${row.targetName || row.name}`}
                >
                  快速生成
                </button>
              )}
              {!compact && !isLingCppBeginnerStructureMode && (
                <button
                  type="button"
                  onClick={() => revealStructuredRow(row)}
                  className={`rounded px-1.5 py-1 text-[10px] font-semibold transition-colors ${
                    isDarkMode ? 'text-slate-400 hover:bg-[#343442] hover:text-slate-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  跳转
                </button>
              )}
            </div>
          </div>
        </div>
      );
    };

    const renderMemberTable = (rows: LingCppStructuredReadingRow[]) => (
      <section key="member">
        <div className={`sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-2 py-1.5 text-[10px] font-semibold ${
          isDarkMode ? 'border-[#2d2d34] bg-[#18181f] text-slate-500' : 'border-slate-200 bg-white text-slate-500'
        }`}>
          <span>成员声明</span>
          <span>{rows.length}</span>
        </div>
        <div className="px-2 py-2">
          <div className={`rounded-t border px-2 py-1 text-[10px] font-semibold ${
            isDarkMode ? 'border-[#30303a] bg-[#15151b] text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-500'
          }`}>
            <div className="grid min-w-0 grid-cols-[72px_minmax(86px,1fr)_54px_54px_minmax(72px,1fr)_44px] items-center gap-2">
              <span>类型</span>
              <span>名称</span>
              <span>静态</span>
              <span>数组</span>
              <span>备注</span>
              <span className="text-right">行</span>
            </div>
          </div>
          {rows.map(row => {
            const controlMember = isControlMemberRow(row);
            const isDesignerLink = /关联设计文件/u.test(row.name);
            const kindLabel = isDesignerLink ? '设计关联' : controlMember ? '控件成员' : '类成员';

            return (
              <div
                key={row.id}
                onDoubleClick={() => revealStructuredRow(row)}
                className={`border-x border-b px-2 py-1.5 text-[11px] ${
                  structureEditDraft?.rowId === row.id
                    ? isDarkMode ? 'border-cyan-500/25 bg-cyan-500/10' : 'border-cyan-200 bg-cyan-50'
                    : isDarkMode ? 'border-[#30303a] bg-[#18181f] hover:bg-[#24242d]' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div
                  className="grid min-w-0 grid-cols-[72px_minmax(86px,1fr)_54px_54px_minmax(72px,1fr)_44px] items-center gap-2 text-left"
                  title={`${row.name} - 第 ${row.line} 行`}
                >
                  {renderDirectStructureInput(row, 'member-type', row.type || '', '类型', 'type')}
                  {renderDirectStructureInput(row, 'member-name', row.targetName || row.name, '名称', 'variable')}
                  {renderMemberBooleanSwitch(row, 'member-static', Boolean(row.isStatic), `${kindLabel} · 静态`)}
                  {renderMemberBooleanSwitch(row, 'member-array', Boolean(row.isArray), `${kindLabel} · 数组`)}
                  {renderDirectStructureInput(row, 'member-note', row.note || '', '备注', 'plain')}
                  <span className={`text-right tabular-nums ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{row.line}</span>
                </div>
              </div>
            );
          })}
          <div className={`border-x border-b border-dashed px-2 py-1.5 text-[11px] ${
            isDarkMode ? 'border-[#30303a] bg-[#15151b]/70' : 'border-slate-200 bg-slate-50/80'
          }`}>
            <div className="grid min-w-0 grid-cols-[72px_minmax(86px,1fr)_54px_54px_minmax(72px,1fr)_44px] items-center gap-2 text-left">
              {renderNewMemberInput('type', '类型', 'type')}
              {renderNewMemberInput('name', '输入新成员', 'variable')}
              {renderNewMemberBooleanSwitch('isStatic', '新成员 · 静态')}
              {renderNewMemberBooleanSwitch('isArray', '新成员 · 数组')}
              {renderNewMemberInput('note', '备注', 'plain')}
              <span className={`text-right text-[10px] ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>新</span>
            </div>
          </div>
        </div>
      </section>
    );

    return (
      <>
        {groups.map(group => group.group === 'member' ? renderMemberTable(group.rows) : (
          <section key={group.group}>
            <div className={`sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-2 py-1.5 text-[10px] font-semibold ${
              isDarkMode ? 'border-[#2d2d34] bg-[#18181f] text-slate-500' : 'border-slate-200 bg-white text-slate-500'
            }`}>
              <span>{groupTitle[group.group]}</span>
              <span>{group.rows.length}</span>
            </div>
            {group.rows.map(row => renderRowCard(row))}
          </section>
        ))}
        {pendingEventRows.length > 0 && (
          <details className={`border-t ${
            isDarkMode ? 'border-[#2d2d34]' : 'border-slate-200'
          }`}>
            <summary className={`flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-2 text-[10px] font-semibold ${
              isDarkMode ? 'bg-amber-500/5 text-amber-300' : 'bg-amber-50 text-amber-700'
            }`}>
              <span>待生成事件</span>
              <span>{pendingEventRows.length}</span>
            </summary>
            {pendingEventRows.map(row => renderRowCard(row, true))}
          </details>
        )}
      </>
    );
  };

  const renderVolcanoStructuredRows = () => {
    const groupTitle: Record<LingCppStructuredReadingRow['group'], string> = {
      declaration: '源码声明',
      package: '入口',
      class: '类',
      member: '成员声明',
      method: '方法',
      constructor: '初始化',
      event: '事件处理器',
      parameter: '参数',
      note: '备注'
    };
    const statusLabel = {
      bound: '已绑定',
      'unbound-source': '未绑定',
      'missing-source': '缺少源码',
      'missing-control': '缺少控件'
    } satisfies Record<NonNullable<LingCppStructuredReadingRow['status']>, string>;
    const isMissingEventRow = (row: LingCppStructuredReadingRow) =>
      row.editKind === 'missing-event' || row.status === 'missing-source';
    const isEventParameterSummaryRow = (row: LingCppStructuredReadingRow) =>
      row.group === 'event' && row.type === '参数' && !row.editKind;
    const pendingEventRows = structuredReadingRows.filter(isMissingEventRow);
    const normalRows = structuredReadingRows.filter(row => !isMissingEventRow(row) && !isEventParameterSummaryRow(row));
    const declarationRows = normalRows.filter(row => row.group === 'declaration' || row.group === 'package');
    const classRows = normalRows.filter(row => row.group === 'class');
    const memberRows = normalRows.filter(row => row.group === 'member');
    const eventRows = normalRows.filter(row => row.group === 'event' && row.editKind === 'event');
    const methodRows = normalRows.filter(row => row.group === 'method' || row.group === 'constructor');
    const functionRows = methodRows.filter(row => row.editKind === 'method');
    const lifecycleRows = methodRows.filter(row => row.editKind !== 'method');
    const otherRows = normalRows.filter(row => row.group === 'parameter' || row.group === 'note');
    const codeTargets = (lingCppLanguageContext?.program.classes || []).flatMap(cls =>
      cls.methods
        .filter(method => method.kind !== 'destructor')
        .map(method => ({ className: cls.name, method }))
    );
    const functionTargets = codeTargets.filter(target => target.method.kind === 'method');
    const preferredCodeTarget = selectedBeginnerCodeTarget
      ? codeTargets.find(target =>
          target.method.name === selectedBeginnerCodeTarget.methodName &&
          (!selectedBeginnerCodeTarget.className || target.className === selectedBeginnerCodeTarget.className)
        )
      : undefined;
    const activeCodeTarget = preferredCodeTarget
      || codeTargets.find(target => target.method.kind === 'event' && target.method.name === activeBeginnerHandler)
      || codeTargets.find(target => target.method.kind === 'event')
      || codeTargets[0];
    const codeTargetKey = (target: BeginnerCodeTarget) =>
      createBeginnerCodeDraftKey(target.className, target.method.kind, target.method.name);
    const commonLingCppTypes = ['文本型', '整数型', '逻辑型', '小数型', '长整数型', '按钮', '标签', '编辑框', '复选框', '窗体', '对象'];
    const memberNameSuggestions = Array.from(new Set([
      ...memberRows.map(row => row.targetName || row.name),
      '标题',
      '内容',
      '计数',
      '当前状态',
      '是否成功'
    ].filter(Boolean)));
    const methodNameSuggestions = Array.from(new Set([
      ...codeTargets.map(target => target.method.name),
      '新子程序',
      '初始化数据',
      '刷新界面',
      '保存配置'
    ].filter(Boolean)));
    const typeSuggestions = Array.from(new Set([
      ...commonLingCppTypes,
      ...beginnerModuleCodeCompletions.filter(item => item.kind === '类型').map(item => item.label),
      ...memberRows.map(row => row.type || ''),
      ...codeTargets.flatMap(target => [target.method.returnType, ...target.method.parameters.map(parameter => parameter.type)])
    ].filter(Boolean)));
    const typeCompletionCatalog = buildBeginnerTypeCompletionCatalog(typeSuggestions);
    const windowTargetCompletionItems = buildBeginnerWindowTargetCompletions(designerProject);
    const defaultCodeArgument = (parameter: LingCppParameter) => {
      const defaultValue = parameter.defaultValue?.trim();
      if (defaultValue) return defaultValue;
      if (/文本/u.test(parameter.type)) return '"文本"';
      if (/逻辑/u.test(parameter.type)) return '真';
      if (/小数|双精度/u.test(parameter.type)) return '0.0';
      if (/整数|长整数/u.test(parameter.type)) return '0';
      return parameter.name || parameter.type || '参数';
    };
    const beginnerCodeCompletionItems = Array.from(
      new Map([
        ...BEGINNER_CODE_COMPLETIONS,
        ...beginnerModuleCodeCompletions,
        ...beginnerDesignerControlCompletions,
        ...memberRows.map(row => ({
          label: row.targetName || row.name,
          detail: `${row.type || '对象'} 变量`,
          insertText: row.targetName || row.name,
          aliases: [row.targetName || row.name, row.name, row.type || '变量'].filter(Boolean),
          kind: '变量' as BeginnerCodeCompletion['kind']
        })),
        ...codeTargets
          .filter(target => target.method.kind === 'method')
          .map(target => ({
            label: target.method.name,
            detail: `${target.method.returnType || '空'} 子程序调用`,
            insertText: `${target.method.name}(${target.method.parameters.map(defaultCodeArgument).join(', ')})`,
            aliases: [target.method.name, '子程序', '功能', '调用'],
            kind: '子程序' as BeginnerCodeCompletion['kind']
          })),
        ...typeSuggestions.map(type => ({
          label: type,
          detail: '类型名称',
          insertText: type,
          aliases: [type, '类型'],
          kind: '类型' as BeginnerCodeCompletion['kind']
        }))
      ].map(item => [`${item.label}:${item.insertText}`, item]))
        .values()
    );
    const updateBeginnerCodeDraft = (target: BeginnerCodeTarget, nextValue: string) => {
      const targetKey = codeTargetKey(target);
      const nextDrafts = { ...beginnerCodeDraftsRef.current, [targetKey]: nextValue };
      beginnerCodeDraftsRef.current = nextDrafts;
      setBeginnerCodeDrafts(nextDrafts);
    };
    const clearBeginnerCodeDraft = (target: BeginnerCodeTarget) => {
      const targetKey = codeTargetKey(target);
      if (!(targetKey in beginnerCodeDraftsRef.current)) return;
      const nextDrafts = { ...beginnerCodeDraftsRef.current };
      delete nextDrafts[targetKey];
      beginnerCodeDraftsRef.current = nextDrafts;
      setBeginnerCodeDrafts(nextDrafts);
    };
    const updateBeginnerCompletion = (
      target: BeginnerCodeTarget,
      input: HTMLTextAreaElement,
      includeAll = false
    ) => {
      const context = getBeginnerCompletionContext(input.value, input.selectionStart);
      const targetKey = codeTargetKey(target);
      if (!shouldShowBeginnerCompletion(context, includeAll)) {
        setBeginnerCompletionState(current => current?.targetKey === targetKey ? null : current);
        return;
      }
      const token = context.token;
      const sourceItems = context.isWindowTargetContext
        ? windowTargetCompletionItems
        : context.isWindowPlacementContext
          ? BEGINNER_WINDOW_PLACEMENT_COMPLETIONS
          : beginnerCodeCompletionItems;
      const items = filterBeginnerCodeCompletions(token, includeAll || context.isWindowTargetContext || context.isWindowPlacementContext, sourceItems);
      if (items.length === 0) {
        setBeginnerCompletionState(current => current?.targetKey === targetKey ? null : current);
        return;
      }
      setBeginnerCompletionState({
        targetKey,
        token,
        items,
        selectedIndex: 0,
        position: getBeginnerCompletionPanelPosition(input, token, items.length)
      });
    };
    const closeBeginnerCompletion = (target?: BeginnerCodeTarget) => {
      if (!target) {
        setBeginnerCompletionState(null);
        return;
      }
      const targetKey = codeTargetKey(target);
      setBeginnerCompletionState(current => current?.targetKey === targetKey ? null : current);
    };
    const closeBeginnerCommandHint = (target?: BeginnerCodeTarget) => {
      if (!target) {
        setBeginnerCommandHintState(null);
        return;
      }
      const targetKey = codeTargetKey(target);
      setBeginnerCommandHintState(current => current?.targetKey === targetKey ? null : current);
    };
    const updateBeginnerCommandHint = (
      target: BeginnerCodeTarget,
      input: HTMLTextAreaElement
    ) => {
      const targetKey = codeTargetKey(target);
      const token = getBeginnerCommandTokenAtCursor(input.value, input.selectionStart);
      if (!token) {
        closeBeginnerCommandHint(target);
        return;
      }

      const info = beginnerCommandHints[token.token];
      if (!info) {
        closeBeginnerCommandHint(target);
        return;
      }
      const estimatedPanelHeight = 102 + Math.max(1, info.parameters.length) * 28 + (info.example ? 28 : 0);
      setBeginnerCommandHintState({
        targetKey,
        token: token.token,
        info,
        position: getBeginnerCommandHintPanelPosition(input, token, estimatedPanelHeight)
      });
    };
    const moveBeginnerCompletionSelection = (target: BeginnerCodeTarget, delta: number) => {
      const targetKey = codeTargetKey(target);
      setBeginnerCompletionState(current => {
        if (!current || current.targetKey !== targetKey || current.items.length === 0) return current;
        const nextIndex = (current.selectedIndex + delta + current.items.length) % current.items.length;
        return { ...current, selectedIndex: nextIndex };
      });
    };
    const applyBeginnerCompletion = (
      target: BeginnerCodeTarget,
      input: HTMLTextAreaElement,
      completion: BeginnerCodeCompletion
    ) => {
      const cursor = input.selectionStart;
      const token = getBeginnerCompletionToken(input.value, cursor);
      const tokenStart = cursor - token.length;
      const nextValue = `${input.value.slice(0, tokenStart)}${completion.insertText}${input.value.slice(input.selectionEnd)}`;
      const cursorOffset = completion.cursorOffset ?? completion.insertText.length;
      const nextCursor = tokenStart + cursorOffset;
      const selectLength = completion.selectLength ?? 0;

      input.value = nextValue;
      updateBeginnerCodeDraft(target, nextValue);
      input.focus();
      window.requestAnimationFrame(() => {
        input.setSelectionRange(nextCursor, nextCursor + selectLength);
      });
      closeBeginnerCompletion(target);
    };
    const flashBeginnerJumpLine = (targetKey: string, line: number, label: string) => {
      if (beginnerJumpHighlightTimerRef.current !== null) {
        window.clearTimeout(beginnerJumpHighlightTimerRef.current);
      }
      setBeginnerJumpHighlight({ targetKey, line, label });
      beginnerJumpHighlightTimerRef.current = window.setTimeout(() => {
        setBeginnerJumpHighlight(current =>
          current?.targetKey === targetKey && current.line === line ? null : current
        );
        beginnerJumpHighlightTimerRef.current = null;
      }, 1200);
    };
    const moveBeginnerEditorCaretToLine = (
      target: BeginnerCodeTarget,
      input: HTMLTextAreaElement,
      line: number,
      label: string
    ) => {
      const lines = input.value.split('\n');
      const targetLine = Math.max(1, Math.min(line, Math.max(1, lines.length)));
      const start = getBeginnerLineOffset(lines, targetLine);
      const lineText = lines[targetLine - 1] || '';
      const caret = start + (lineText.match(/^\s*/u)?.[0].length || 0);
      const computedLineHeight = Number.parseFloat(window.getComputedStyle(input).lineHeight);
      const lineHeight = Number.isFinite(computedLineHeight) ? computedLineHeight : Math.max(18, editorFontSize * 1.65);
      const nextScrollTop = Math.max(0, (targetLine - 1) * lineHeight - input.clientHeight / 2 + lineHeight);
      const lineNumberColumn = input.closest('[data-beginner-editor-root]')?.querySelector('[data-beginner-line-numbers]');

      input.focus();
      input.scrollTop = nextScrollTop;
      if (lineNumberColumn instanceof HTMLElement) lineNumberColumn.scrollTop = nextScrollTop;
      input.setSelectionRange(caret, caret);
      closeBeginnerCompletion(target);
      flashBeginnerJumpLine(codeTargetKey(target), targetLine, label);
    };
    const navigateBeginnerStructure = (
      target: BeginnerCodeTarget,
      input: HTMLTextAreaElement,
      direction: 'previous' | 'next' | 'cycle' | 'outer-start' | 'end'
    ) => {
      const lines = input.value.split('\n');
      const currentLine = getBeginnerLineAtOffset(input.value, input.selectionStart);
      const blocks = findBeginnerIfBlocksAtLine(parseBeginnerIfBlocks(lines), currentLine);
      const currentBlock = blocks[0];
      if (!currentBlock) return false;

      if (direction === 'outer-start') {
        const outerBlock = blocks.at(-1) || currentBlock;
        moveBeginnerEditorCaretToLine(target, input, outerBlock.startLine, outerBlock.branches[0]?.text || '如果');
        return true;
      }

      if (direction === 'end') {
        moveBeginnerEditorCaretToLine(target, input, currentBlock.endLine, '如果结束');
        return true;
      }

      const anchors = beginnerStructureAnchors(currentBlock);
      if (anchors.length === 0) return false;

      if (direction === 'previous') {
        const branch = currentBeginnerBranch(currentBlock, currentLine);
        moveBeginnerEditorCaretToLine(target, input, branch.line, branch.text || '如果');
        return true;
      }

      if (direction === 'next') {
        const nextAnchor = anchors.find(anchor => anchor.line > currentLine)
          || anchors.find(anchor => anchor.line === currentBlock.endLine)
          || anchors[0];
        moveBeginnerEditorCaretToLine(target, input, nextAnchor.line, nextAnchor.label);
        return true;
      }

      const nextAnchor = anchors.find(anchor => anchor.line > currentLine) || anchors[0];
      moveBeginnerEditorCaretToLine(target, input, nextAnchor.line, nextAnchor.label);
      return true;
    };
    const handleBeginnerCodeChange = (
      target: BeginnerCodeTarget,
      event: React.ChangeEvent<HTMLTextAreaElement>
    ) => {
      updateBeginnerCodeDraft(target, event.currentTarget.value);
      updateBeginnerCompletion(target, event.currentTarget);
      updateBeginnerCommandHint(target, event.currentTarget);
    };
    const handleBeginnerCodeBlur = (
      target: BeginnerCodeTarget,
      currentBody: string,
      event: React.FocusEvent<HTMLTextAreaElement>
    ) => {
      closeBeginnerCommandHint(target);
      const applied = commitBeginnerCodeBody(
        target.className,
        target.method.name,
        currentBody,
        event.currentTarget.value
      );
      if (applied) clearBeginnerCodeDraft(target);
    };
    const handleBeginnerCodeKeyDown = (
      target: BeginnerCodeTarget,
      event: React.KeyboardEvent<HTMLTextAreaElement>
    ) => {
      const input = event.currentTarget;
      const targetKey = codeTargetKey(target);
      const activeCompletion = beginnerCompletionState?.targetKey === targetKey ? beginnerCompletionState : null;

      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'ArrowUp') {
        if (navigateBeginnerStructure(target, input, 'previous')) event.preventDefault();
        return;
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'ArrowDown') {
        if (navigateBeginnerStructure(target, input, 'next')) event.preventDefault();
        return;
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'Home') {
        if (navigateBeginnerStructure(target, input, 'outer-start')) event.preventDefault();
        return;
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'End') {
        if (navigateBeginnerStructure(target, input, 'end')) event.preventDefault();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === '\\' || event.code === 'Backslash')) {
        if (navigateBeginnerStructure(target, input, 'cycle')) event.preventDefault();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === ' ') {
        event.preventDefault();
        updateBeginnerCompletion(target, input, true);
        return;
      }

      if (activeCompletion) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          moveBeginnerCompletionSelection(target, 1);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          moveBeginnerCompletionSelection(target, -1);
          return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          const completion = activeCompletion.items[activeCompletion.selectedIndex] || activeCompletion.items[0];
          if (completion) applyBeginnerCompletion(target, input, completion);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          closeBeginnerCompletion(target);
          return;
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        input.blur();
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const nextValue = `${input.value.slice(0, start)}    ${input.value.slice(end)}`;
        input.value = nextValue;
        updateBeginnerCodeDraft(target, nextValue);
        window.requestAnimationFrame(() => {
          input.selectionStart = input.selectionEnd = start + 4;
        });
      }
    };
    const renderBeginnerCompletionPanel = (target: BeginnerCodeTarget) => {
      const targetKey = codeTargetKey(target);
      const state = beginnerCompletionState?.targetKey === targetKey ? beginnerCompletionState : null;
      if (!state || state.items.length === 0) return null;

      return (
        <div
          className={`absolute z-30 w-[280px] overflow-hidden rounded border shadow-xl ${
          isDarkMode ? 'border-[#343746] bg-[#191b22] text-slate-100 shadow-black/35' : 'border-slate-200 bg-white text-slate-900 shadow-slate-300/50'
        } ${state.position.placement === 'above' ? 'origin-bottom-left' : 'origin-top-left'}`}
          style={{ left: state.position.left, top: state.position.top }}
        >
          <div className={`flex items-center justify-between border-b px-2 py-1 text-[10px] ${
            isDarkMode ? 'border-[#2b2d34] text-slate-500' : 'border-slate-100 text-slate-500'
          }`}>
            <span>{state.token ? `补全 ${state.token}` : '代码补全'}</span>
            <span>Tab/Enter</span>
          </div>
          <div className="overflow-auto py-1" style={{ maxHeight: state.position.maxListHeight }}>
            {state.items.map((item, index) => (
              <button
                key={`${item.label}:${item.insertText}`}
                type="button"
                onMouseDown={event => {
                  event.preventDefault();
                  const editor = event.currentTarget.closest('[data-beginner-editor-root]')?.querySelector('textarea');
                  if (editor instanceof HTMLTextAreaElement) applyBeginnerCompletion(target, editor, item);
                }}
                className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[11px] ${
                  index === state.selectedIndex
                    ? isDarkMode ? 'bg-cyan-500/15 text-cyan-100' : 'bg-cyan-50 text-cyan-900'
                    : isDarkMode ? 'text-slate-300 hover:bg-[#232631]' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{item.label}</span>
                  <span className={`block truncate text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{item.detail}</span>
                </span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] ${
                  isDarkMode ? 'bg-[#2b2d34] text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}>{item.kind}</span>
              </button>
            ))}
          </div>
        </div>
      );
    };
    const renderBeginnerCommandHintPanel = (target: BeginnerCodeTarget) => {
      const targetKey = codeTargetKey(target);
      const state = beginnerCommandHintState?.targetKey === targetKey ? beginnerCommandHintState : null;
      const activeCompletion = beginnerCompletionState?.targetKey === targetKey ? beginnerCompletionState : null;
      if (!state || (activeCompletion && activeCompletion.items.length > 0)) return null;

      const contentMaxHeight = Math.max(86, state.position.maxListHeight - 32);
      return (
        <div
          className={`pointer-events-none absolute z-20 w-[420px] overflow-hidden rounded border text-[11px] shadow-2xl ${
            isDarkMode ? 'border-cyan-500/25 bg-[#171a20] text-slate-200 shadow-black/40' : 'border-cyan-200 bg-white text-slate-800 shadow-slate-300/60'
          } ${state.position.placement === 'above' ? 'origin-bottom-left' : 'origin-top-left'}`}
          style={{ left: state.position.left, top: state.position.top, maxHeight: state.position.maxListHeight }}
        >
          <div className={`flex items-center justify-between gap-2 border-b px-2.5 py-1.5 ${
            isDarkMode ? 'border-[#2b2f3a] bg-cyan-500/10' : 'border-cyan-100 bg-cyan-50'
          }`}>
            <span className={`font-semibold ${isDarkMode ? 'text-cyan-200' : 'text-cyan-700'}`}>命令提示</span>
            <span className={`rounded px-1.5 py-0.5 text-[9px] ${
              isDarkMode ? 'bg-[#242834] text-slate-300' : 'bg-white text-slate-600'
            }`}>{state.info.returnType}</span>
          </div>
          <div className="overflow-auto px-2.5 py-2" style={{ maxHeight: contentMaxHeight }}>
            <div className={`font-mono text-[12px] font-semibold ${
              isDarkMode ? 'text-amber-200' : 'text-amber-700'
            }`}>{state.info.signature}</div>
            <div className={`mt-1.5 leading-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {state.info.summary}
            </div>
            <div className={`mt-2 overflow-hidden rounded border ${
              isDarkMode ? 'border-[#303541]' : 'border-slate-200'
            }`}>
              <div className={`grid grid-cols-[88px_76px_minmax(0,1fr)] border-b px-2 py-1 text-[10px] font-semibold ${
                isDarkMode ? 'border-[#303541] bg-[#1e222b] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}>
                <span>参数名</span>
                <span>类型</span>
                <span>说明</span>
              </div>
              {(state.info.parameters.length ? state.info.parameters : [{ name: '无', type: '-', note: '这个命令没有参数。' }]).map(parameter => (
                <div
                  key={`${state.token}:${parameter.name}`}
                  className={`grid grid-cols-[88px_76px_minmax(0,1fr)] gap-0 border-b px-2 py-1 last:border-b-0 ${
                    isDarkMode ? 'border-[#2a2f3a]' : 'border-slate-100'
                  }`}
                >
                  <span className={isDarkMode ? 'text-cyan-200' : 'text-cyan-700'}>{parameter.name}</span>
                  <span className={isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}>{parameter.type}</span>
                  <span className={`min-w-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{parameter.note}</span>
                </div>
              ))}
            </div>
            <div className={`mt-2 rounded px-2 py-1.5 font-mono text-[10px] ${
              isDarkMode ? 'bg-[#0d0f14] text-emerald-300' : 'bg-slate-50 text-emerald-700'
            }`}>
              {state.info.example}
            </div>
          </div>
        </div>
      );
    };
    const findStructuredRowForCodeTarget = (target: BeginnerCodeTarget) => {
      const rows = target.method.kind === 'event'
        ? eventRows
        : target.method.kind === 'method'
          ? functionRows
          : lifecycleRows;
      return rows.find(row =>
        row.className === target.className &&
        (row.targetName || row.name) === target.method.name
      );
    };
    const applyCodeTargetSignature = (
      target: BeginnerCodeTarget,
      patch: {
        name?: string;
        returnType?: string;
        access?: LingCppAccessModifier;
        isStatic?: boolean;
        parameters?: LingCppParameter[];
        note?: string;
      }
    ) => {
      const nextName = patch.name?.trim();
      const nextReturnType = patch.returnType?.trim();
      const nextParameters = patch.parameters ?? target.method.parameters;
      const hasNotePatch = Object.prototype.hasOwnProperty.call(patch, 'note');
      const previousKey = codeTargetKey(target);
      const nextKey = `${target.className}:${target.method.kind}:${nextName || target.method.name}`;
      const edit: LingCppAstEdit = target.method.kind === 'event'
        ? {
            kind: 'update-event',
            className: target.className,
            handlerName: target.method.name,
            newHandlerName: nextName || target.method.name,
            access: patch.access,
            parameters: nextParameters,
            note: hasNotePatch ? patch.note?.trim() || '' : undefined
          }
        : {
            kind: 'update-method-signature',
            className: target.className,
            methodName: target.method.name,
            newName: nextName || target.method.name,
            returnType: nextReturnType || target.method.returnType || '空',
            access: patch.access,
            isStatic: patch.isStatic ?? target.method.isStatic,
            parameters: nextParameters,
            note: hasNotePatch ? patch.note?.trim() || '' : undefined
          };
      const applied = applyStructureAstEdits([edit], target.method.line);
      if (applied) {
        setExpandedBeginnerEventTargetKey(current => current === previousKey ? nextKey : current);
        setExpandedBeginnerFunctionTargetKey(current => current === previousKey ? nextKey : current);
        setSelectedFunctionTemplateKey(current => current === previousKey ? nextKey : current);
      }
      if (applied && nextName && nextName !== target.method.name) {
        setSelectedBeginnerCodeTarget({ className: target.className, methodName: nextName });
        if (target.method.kind === 'event') setSelectedBeginnerHandler(nextName);
      }
      return applied;
    };
    const commitCodeTargetParameter = (
      target: BeginnerCodeTarget,
      index: number,
      field: keyof LingCppParameter,
      rawValue: string
    ) => {
      const nextValue = rawValue.trim();
      if (field !== 'defaultValue' && !nextValue) {
        setStructureEditError('参数名和参数类型不能为空。');
        return;
      }
      const currentParameter = target.method.parameters[index];
      if (!currentParameter || (currentParameter[field] || '') === nextValue) return;
      const nextParameters = target.method.parameters.map((parameter, parameterIndex) =>
        parameterIndex === index
          ? { ...parameter, [field]: nextValue || undefined }
          : parameter
      );
      applyCodeTargetSignature(target, { parameters: nextParameters });
    };
    const commitNewCodeTargetParameter = (
      target: BeginnerCodeTarget,
      patch: Partial<LingCppParameter> = {}
    ) => {
      const key = codeTargetKey(target);
      const draft: ParameterDraft = { type: '文本型', name: '', defaultValue: '', ...(newParameterDrafts[key] || {}), ...patch };
      setNewParameterDrafts(current => ({ ...current, [key]: draft }));
      const name = draft.name.trim();
      if (!name) return;
      const type = draft.type.trim() || '对象';
      const defaultValue = draft.defaultValue.trim();
      const applied = applyCodeTargetSignature(target, {
        parameters: [...target.method.parameters, { type, name, defaultValue: defaultValue || undefined }]
      });
      if (applied) {
        setNewParameterDrafts(current => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
    };
    const removeCodeTargetParameter = (target: BeginnerCodeTarget, index: number) => {
      const currentParameter = target.method.parameters[index];
      if (!currentParameter) return;
      const nextParameters = target.method.parameters.filter((_, parameterIndex) => parameterIndex !== index);
      applyCodeTargetSignature(target, { parameters: nextParameters });
    };
    const toggleInlineCodeTarget = (target: BeginnerCodeTarget) => {
      const targetKey = codeTargetKey(target);
      if (target.method.kind === 'event') {
        setExpandedBeginnerEventTargetKey(current => current === targetKey ? null : targetKey);
        setSelectedBeginnerHandler(target.method.name);
      } else if (target.method.kind === 'method') {
        setExpandedBeginnerFunctionTargetKey(current => current === targetKey ? null : targetKey);
      }
      setSelectedBeginnerCodeTarget({ className: target.className, methodName: target.method.name });
    };
    const uniqueBeginnerName = (baseName: string, existingNames: string[]) => {
      const usedNames = new Set(existingNames);
      let candidate = baseName;
      let index = 2;
      while (usedNames.has(candidate)) {
        candidate = `${baseName}${index}`;
        index += 1;
      }
      return candidate;
    };
    const createBeginnerFunction = () => {
      if (!primaryLingCppClass) {
        setStructureEditError('当前源码里还没有类，无法新增子程序。');
        return;
      }
      const name = uniqueBeginnerName('新子程序', codeTargets.map(target => target.method.name));
      const applied = applyStructureAstEdits([{
        kind: 'add-method',
        className: primaryLingCppClass.name,
        method: {
          name,
          returnType: '空',
          bodyLines: [`调试输出("${name} 已执行")`],
          note: '新手模式右键新增的子程序'
        }
      }]);
      if (applied) {
        setSelectedBeginnerCodeTarget({ className: primaryLingCppClass.name, methodName: name });
        setExpandedBeginnerFunctionTargetKey(`${primaryLingCppClass.name}:method:${name}`);
      }
    };
    const createBeginnerMember = () => {
      if (!primaryLingCppClass) {
        setStructureEditError('当前源码里还没有类，无法新增变量。');
        return;
      }
      const name = uniqueBeginnerName('新变量', memberRows.map(row => row.targetName || row.name));
      applyStructureAstEdits([{
        kind: 'add-member',
        className: primaryLingCppClass.name,
        member: {
          name,
          type: '文本型',
          initialValue: '""',
          note: '新手模式右键新增的变量'
        }
      }]);
    };
    const deleteBeginnerCodeTarget = (target?: BeginnerCodeTarget) => {
      if (!target) return;
      if (target.method.kind === 'constructor') {
        setStructureEditError('构造子程序不能从新手模式删除。');
        return;
      }
      const isEvent = target.method.kind === 'event';
      const label = isEvent ? '事件处理器' : '子程序';
      if (!window.confirm(`确定删除${label}「${target.method.name}」吗？`)) return;
      const edit: LingCppAstEdit = isEvent
        ? { kind: 'delete-event', className: target.className, handlerName: target.method.name }
        : { kind: 'delete-method', className: target.className, methodName: target.method.name };
      const applied = applyStructureAstEdits([edit], target.method.line);
      if (applied) {
        setSelectedBeginnerCodeTarget(null);
        setSelectedBeginnerHandler(null);
        setExpandedBeginnerEventTargetKey(null);
        setExpandedBeginnerFunctionTargetKey(null);
      }
    };
    const appendBeginnerSnippet = (target: BeginnerCodeTarget | undefined, snippet: string) => {
      if (!target) return;
      const targetKey = codeTargetKey(target);
      const currentBody = beginnerCodeDrafts[targetKey] ?? methodBodyText(target.method);
      const nextBody = currentBody.trim() ? `${currentBody}\n${snippet}` : snippet;
      updateBeginnerCodeDraft(target, nextBody);
      const applied = commitBeginnerCodeBody(target.className, target.method.name, currentBody, nextBody);
      if (applied) clearBeginnerCodeDraft(target);
    };
    const openBeginnerContextMenu = (event: React.MouseEvent, target?: BeginnerCodeTarget) => {
      event.preventDefault();
      setBeginnerCompletionState(null);
      const effectiveTarget = target || activeCanvasTarget;
      if (effectiveTarget) {
        setSelectedBeginnerCodeTarget({ className: effectiveTarget.className, methodName: effectiveTarget.method.name });
        if (effectiveTarget.method.kind === 'event') setSelectedBeginnerHandler(effectiveTarget.method.name);
      }
      setBeginnerContextMenu({
        x: event.clientX,
        y: event.clientY,
        className: effectiveTarget?.className,
        methodName: effectiveTarget?.method.name
      });
    };
    const parameterExampleText = (parameter: LingCppParameter) =>
      `${parameter.name || parameter.type || '参数'} = ${defaultFunctionArgument(parameter)}`;

    const sectionDomId = (id: string) => `lingcpp-structure-section-${id}`;
    const isSectionCollapsed = (id: string) => collapsedVolcanoSections.includes(id);
    const expandVolcanoSection = (id: string) => {
      setCollapsedVolcanoSections(current => current.filter(item => item !== id));
    };
    const toggleVolcanoSection = (id: string) => {
      setCollapsedVolcanoSections(current =>
        current.includes(id)
          ? current.filter(item => item !== id)
          : [...current, id]
      );
    };
    const scrollToStructureSection = (id: string) => {
      expandVolcanoSection(id);
      window.requestAnimationFrame(() => {
        scrollElementInsideBeginnerEditor(document.getElementById(sectionDomId(id)), 'start');
      });
    };

    const tableChrome = isDarkMode
      ? 'border-[#2b2d34] bg-[#17181d]'
      : 'border-slate-200 bg-white';
    const tableHeadChrome = isDarkMode
      ? 'border-[#2b2d34] bg-[#111217] text-slate-400'
      : 'border-slate-200 bg-slate-50 text-slate-500';
    const rowChrome = (row?: LingCppStructuredReadingRow) => {
      const isProblem = row?.status === 'missing-control' || row?.status === 'missing-source' || row?.editKind === 'missing-event';
      if (isProblem) return isDarkMode ? 'bg-amber-500/[0.06]' : 'bg-amber-50';
      return isDarkMode ? 'bg-[#17181d] hover:bg-[#20222a]' : 'bg-white hover:bg-slate-50';
    };
    const cellClass = `border-b px-2 py-1.5 align-middle text-[11px] ${isDarkMode ? 'border-[#2b2d34]' : 'border-slate-200'}`;
    const headCellClass = `sticky top-8 z-10 border-b px-2 py-1.5 text-left text-[10px] font-semibold ${tableHeadChrome}`;

    const textTone = (tone: StructureTextTone = 'plain') => {
      if (tone === 'procedure') return isDarkMode ? 'text-[length:var(--beginner-procedure-font-size)] font-bold text-cyan-200' : 'text-[length:var(--beginner-procedure-font-size)] font-bold text-cyan-800';
      if (tone === 'variable') return isDarkMode ? 'font-semibold text-amber-200' : 'font-semibold text-amber-800';
      if (tone === 'parameter') return isDarkMode ? 'font-semibold text-violet-200' : 'font-semibold text-violet-700';
      if (tone === 'type') return isDarkMode ? 'font-semibold text-blue-300' : 'font-semibold text-blue-700';
      if (tone === 'name') return isDarkMode ? 'font-semibold text-slate-100' : 'font-semibold text-slate-900';
      if (tone === 'value') return isDarkMode ? 'text-emerald-300' : 'text-emerald-700';
      if (tone === 'muted') return isDarkMode ? 'text-slate-500' : 'text-slate-500';
      return isDarkMode ? 'text-slate-300' : 'text-slate-700';
    };

    const renderTextCell = (value?: string | number, tone: StructureTextTone = 'plain') => (
      <span className={`block min-w-0 truncate ${textTone(tone)}`} title={value ? String(value) : undefined}>
        {value || <span className={textTone('muted')}>-</span>}
      </span>
    );

    const defaultFunctionArgument = (parameter: LingCppParameter) => {
      const defaultValue = parameter.defaultValue?.trim();
      if (defaultValue) return defaultValue;
      if (/文本/u.test(parameter.type)) return '"文本"';
      if (/逻辑/u.test(parameter.type)) return '真';
      if (/小数|双精度/u.test(parameter.type)) return '0.0';
      if (/整数|长整数/u.test(parameter.type)) return '0';
      return parameter.name || parameter.type || '参数';
    };

    const formatFunctionCall = (name: string, parameters?: LingCppParameter[]) =>
      `${name}(${(parameters || []).map(defaultFunctionArgument).join(', ')})`;
    const formatFunctionSignature = (name: string, parameters?: LingCppParameter[]) =>
      `${name}(${(parameters || []).map(formatSingleParameterDraft).join(', ')})`;
    const functionCallDraftKey = (eventTarget: BeginnerCodeTarget, functionTarget: BeginnerCodeTarget) =>
      `${codeTargetKey(eventTarget)}=>${codeTargetKey(functionTarget)}`;
    const parameterCallArgumentKey = (parameter: LingCppParameter, index: number) =>
      `${index}:${parameter.name || parameter.type || 'parameter'}`;
    const getFunctionCallArgument = (
      parameter: LingCppParameter,
      index: number,
      draft: Record<string, string>
    ) => {
      const value = draft[parameterCallArgumentKey(parameter, index)]?.trim();
      return value || defaultFunctionArgument(parameter);
    };
    const formatFunctionCallWithDraft = (
      name: string,
      parameters: LingCppParameter[],
      draft: Record<string, string>
    ) => `${name}(${parameters.map((parameter, index) => getFunctionCallArgument(parameter, index, draft)).join(', ')})`;

    const renderParameterSummary = (parameters?: LingCppParameter[]) => {
      if (!parameters || parameters.length === 0) return renderTextCell('无参数', 'muted');
      return (
        <div className="grid gap-1">
          {parameters.map((parameter, index) => (
            <div
              key={`${parameter.name}:${parameter.type}:${index}`}
                className={`grid min-w-0 grid-cols-[minmax(72px,1fr)_minmax(72px,1fr)_minmax(82px,1fr)] gap-2 rounded px-1.5 py-0.5 ${
                  isDarkMode ? 'bg-[#111217]' : 'bg-slate-50'
                }`}
              >
                <span className={`truncate ${textTone('parameter')}`}>{parameter.name}</span>
                <span className={`truncate ${textTone('type')}`}>{parameter.type}</span>
                <span className={`truncate ${parameter.defaultValue?.trim() ? textTone('value') : textTone('muted')}`}>
                  {parameter.defaultValue?.trim() || '默认空'}
                </span>
              </div>
            ))}
        </div>
      );
    };
    const renderFunctionCallTemplatePreview = (
      name: string,
      parameters?: LingCppParameter[],
      compact = false
    ) => {
      const effectiveParameters = parameters || [];
      const callExample = formatFunctionCall(name, effectiveParameters);
      return (
        <div className={`rounded border px-2 py-1.5 ${
          isDarkMode ? 'border-[#343442] bg-[#111217]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={textTone('procedure')}>{name}</span>
            <span className={`text-[9px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
              {effectiveParameters.length ? formatFunctionSignature(name, effectiveParameters) : '无参数功能'}
            </span>
          </div>
          {effectiveParameters.length > 0 ? (
            <div className={`mt-1.5 grid gap-1 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
              {effectiveParameters.map((parameter, index) => (
                <div
                  key={`${name}:${parameter.name}:${index}`}
                  className={`grid min-w-0 grid-cols-[minmax(86px,1fr)_minmax(90px,1fr)] gap-2 rounded px-1.5 py-1 ${
                    isDarkMode ? 'bg-[#181a20] text-slate-300' : 'bg-white text-slate-700'
                  }`}
                >
                  <span className={`truncate ${textTone('parameter')}`}>{parameter.name}</span>
                  <span className="truncate">{parameterExampleText(parameter)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={`mt-1 text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>无参数，点击后会直接写入调用。</div>
          )}
          <div className={`mt-1.5 rounded px-1.5 py-1 font-mono ${compact ? 'text-[9px]' : 'text-[10px]'} ${
            isDarkMode ? 'bg-[#0d0f14] text-emerald-300' : 'bg-white text-emerald-700'
          }`}>
            {callExample}
          </div>
        </div>
      );
    };

    const renderCodeTargetFieldInput = (
      target: BeginnerCodeTarget,
      field: 'name' | 'returnType',
      value: string,
      placeholder: string,
      tone: StructureInputTone = 'plain',
      editable = true
    ) => {
      const inputKey = `${codeTargetKey(target)}:${field}`;
      const typeCompletion = field === 'returnType' && beginnerTypeCompletionState?.inputKey === inputKey
        ? beginnerTypeCompletionState
        : null;
      const updateTypeCompletion = (input: HTMLInputElement, includeAll = false) => {
        if (field !== 'returnType' || !editable || !onUpdateSourceContent) return;
        const rawValue = input.value;
        const items = filterBeginnerTypeCompletions(typeCompletionCatalog, rawValue, includeAll).slice(0, 8);
        const layout = getBeginnerTypeCompletionLayout(input, items.length);
        setBeginnerTypeCompletionState(items.length > 0
          ? { inputKey, value: rawValue, items, selectedIndex: 0, ...layout }
          : null
        );
      };
      const resolveReturnTypeInput = (rawValue: string) => {
        if (field !== 'returnType') return rawValue;
        const normalizedValue = rawValue.trim().toLowerCase();
        const exactAlias = typeCompletionCatalog.find(item =>
          item.aliases.some(alias => alias.toLowerCase() === normalizedValue)
        );
        return exactAlias?.label || rawValue;
      };
      const commitFieldValue = (input: HTMLInputElement) => {
        if (input.dataset.beginnerTypeApplied === 'true') {
          delete input.dataset.beginnerTypeApplied;
          return;
        }
        const nextValue = resolveReturnTypeInput(input.value.trim());
        if (nextValue === value) return;
        if (!nextValue) {
          setStructureEditError(field === 'name' ? '功能名不能为空。' : '返回值类型不能为空。');
          input.value = value;
          return;
        }
        input.value = nextValue;
        applyCodeTargetSignature(target, field === 'name' ? { name: nextValue } : { returnType: nextValue });
      };
      const applyTypeCompletion = (item: BeginnerTypeCompletionItem, input?: HTMLInputElement | null) => {
        if (input) {
          input.value = item.label;
          input.dataset.beginnerTypeApplied = 'true';
        }
        setBeginnerTypeCompletionState(null);
        applyCodeTargetSignature(target, { returnType: item.label });
      };

      return (
        <div className="relative min-w-0" data-beginner-type-wrap={inputKey}>
          <input
            key={`${codeTargetKey(target)}:${field}:${value}`}
            defaultValue={value}
            placeholder={placeholder}
            list={field === 'name' ? 'beginner-method-name-suggestions' : undefined}
            readOnly={!onUpdateSourceContent || !editable}
            onChange={event => updateTypeCompletion(event.currentTarget)}
            onBlur={event => {
              window.setTimeout(() => {
                setBeginnerTypeCompletionState(current => current?.inputKey === inputKey ? null : current);
              }, 120);
              commitFieldValue(event.currentTarget);
            }}
            onKeyDown={event => {
              if (field === 'returnType' && typeCompletion) {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setBeginnerTypeCompletionState(current => current?.inputKey === inputKey
                    ? { ...current, selectedIndex: (current.selectedIndex + 1) % current.items.length }
                    : current
                  );
                  return;
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setBeginnerTypeCompletionState(current => current?.inputKey === inputKey
                    ? { ...current, selectedIndex: (current.selectedIndex - 1 + current.items.length) % current.items.length }
                    : current
                  );
                  return;
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                  const item = typeCompletion.items[typeCompletion.selectedIndex];
                  if (item) {
                    event.preventDefault();
                    applyTypeCompletion(item, event.currentTarget);
                    event.currentTarget.blur();
                    return;
                  }
                }
              }
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                setBeginnerTypeCompletionState(null);
                event.currentTarget.value = value;
                event.currentTarget.blur();
              }
            }}
            className={`${directInputClasses(tone)} w-full`}
            title={field === 'returnType' ? '支持中文、英文、拼音输入，例如 int、string、void' : undefined}
          />
          {typeCompletion && (
            <div className={`absolute left-0 z-[90] w-64 overflow-hidden rounded border text-[11px] shadow-xl ${
              typeCompletion.placement === 'above' ? 'bottom-full mb-1' : 'top-full mt-1'
            } ${
              isDarkMode ? 'border-[#343442] bg-[#17181f] text-slate-200 shadow-black/30' : 'border-slate-200 bg-white text-slate-800 shadow-slate-200/80'
            }`}>
              <div className={`flex items-center justify-between border-b px-2 py-1 text-[10px] ${
                isDarkMode ? 'border-[#2b2d34] text-slate-500' : 'border-slate-100 text-slate-500'
              }`}>
                <span>类型补全</span>
                <span>Tab/Enter</span>
              </div>
              <div className="overflow-auto py-1" style={{ maxHeight: typeCompletion.maxListHeight }}>
                {typeCompletion.items.map((item, index) => (
                  <button
                    key={`${inputKey}:${item.label}`}
                    type="button"
                    onMouseDown={event => {
                      event.preventDefault();
                      const input = event.currentTarget.closest('[data-beginner-type-wrap]')?.querySelector('input');
                      applyTypeCompletion(item, input instanceof HTMLInputElement ? input : null);
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left ${
                      index === typeCompletion.selectedIndex
                        ? isDarkMode ? 'bg-cyan-500/15 text-cyan-100' : 'bg-cyan-50 text-cyan-900'
                        : isDarkMode ? 'text-slate-300 hover:bg-[#20222a]' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`block truncate ${textTone('type')}`}>{item.label}</span>
                      <span className={`block truncate text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{item.detail}</span>
                    </span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] ${
                      isDarkMode ? 'bg-[#252733] text-slate-400' : 'bg-slate-100 text-slate-500'
                    }`}>类型</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    };

    const renderCodeTargetAccessSelect = (
      target: BeginnerCodeTarget,
      value: LingCppAccessModifier
    ) => {
      const options: LingCppAccessModifier[] = ['公开', '私有', '保护'];
      return (
        <select
          key={`${codeTargetKey(target)}:access:${value}`}
          value={value}
          disabled={!onUpdateSourceContent}
          onChange={event => applyCodeTargetSignature(target, { access: event.currentTarget.value as LingCppAccessModifier })}
          className={`${directInputClasses('plain')} w-full appearance-none disabled:cursor-not-allowed disabled:opacity-40`}
          title="选择访问级别后立即写回源码"
        >
          {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    };

    const renderCodeTargetNoteInput = (
      target: BeginnerCodeTarget,
      value: string
    ) => {
      const editHint = '备注会写入为声明上一行注释；留空会删除紧邻声明的备注注释';
      return (
        <input
          key={`${codeTargetKey(target)}:note:${value}`}
          defaultValue={value}
          placeholder="备注"
          readOnly={!onUpdateSourceContent}
          aria-label={`子程序备注${value ? `：${value}` : ''}`}
          onBlur={event => {
            const nextValue = event.currentTarget.value.trim();
            if (nextValue === value) return;
            applyCodeTargetSignature(target, { note: nextValue });
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              event.currentTarget.value = value;
              event.currentTarget.blur();
            }
          }}
          className={directInputClasses('plain')}
          title={value ? `${value}\n\n${editHint}` : editHint}
        />
      );
    };

    const renderCodeTargetStaticSwitch = (
      target: BeginnerCodeTarget,
      editable = target.method.kind === 'method'
    ) => {
      const checked = Boolean(target.method.isStatic);
      const disabled = !onUpdateSourceContent || !editable;
      return (
        <label
          className={`inline-flex h-[var(--beginner-input-height)] w-full items-center justify-center ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
          title={editable ? '切换后写回为 静态 子程序声明' : '只有普通子程序支持静态'}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={checked}
            disabled={disabled}
            onChange={event => applyCodeTargetSignature(target, { isStatic: event.currentTarget.checked })}
          />
          <span className={`relative h-[var(--beginner-switch-height)] w-[var(--beginner-switch-width)] rounded-full transition-colors ${
            checked
              ? isDarkMode ? 'bg-cyan-500/80' : 'bg-cyan-600'
              : isDarkMode ? 'bg-[#2b2d34]' : 'bg-slate-300'
          }`}>
            <span className={`absolute top-[var(--beginner-switch-knob-offset)] h-[var(--beginner-switch-knob-size)] w-[var(--beginner-switch-knob-size)] rounded-full transition-transform ${
              checked ? 'translate-x-[var(--beginner-switch-knob-translate)]' : 'translate-x-[var(--beginner-switch-knob-offset)]'
            } ${isDarkMode ? 'bg-white' : 'bg-white'}`} />
          </span>
        </label>
      );
    };

    const renderParameterInput = (
      target: BeginnerCodeTarget,
      index: number,
      field: keyof LingCppParameter,
      value: string,
      placeholder: string,
      tone: StructureInputTone = 'plain'
    ) => (
      <input
        key={`${codeTargetKey(target)}:parameter:${index}:${field}:${value}`}
        defaultValue={value}
        placeholder={placeholder}
        list={
          field === 'name' ? 'beginner-member-name-suggestions'
          : undefined
        }
        autoComplete="off"
        readOnly={!onUpdateSourceContent}
        onBlur={event => commitCodeTargetParameter(target, index, field, event.currentTarget.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            event.currentTarget.value = value;
            event.currentTarget.blur();
          }
        }}
        className={directInputClasses(tone)}
      />
    );

    const renderNewParameterInput = (
      target: BeginnerCodeTarget,
      field: keyof LingCppParameter,
      placeholder: string,
      tone: StructureInputTone = 'plain'
    ) => {
      const key = codeTargetKey(target);
      const draft: ParameterDraft = { type: '文本型', name: '', defaultValue: '', ...(newParameterDrafts[key] || {}) };
      return (
        <input
          value={draft[field] || ''}
          placeholder={placeholder}
          list={
            field === 'name' ? 'beginner-member-name-suggestions'
            : undefined
          }
          autoComplete="off"
          disabled={!onUpdateSourceContent}
          onChange={event => {
            const nextValue = event.currentTarget.value;
            setNewParameterDrafts(current => ({
              ...current,
              [key]: { ...draft, [field]: nextValue }
            }));
          }}
          onBlur={event => commitNewCodeTargetParameter(target, { [field]: event.currentTarget.value })}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setNewParameterDrafts(current => {
                const next = { ...current };
                delete next[key];
                return next;
              });
              event.currentTarget.blur();
            }
          }}
          className={`${directInputClasses(tone)} disabled:cursor-not-allowed disabled:opacity-40`}
        />
      );
    };

    const renderProcessPropertyTable = (target: BeginnerCodeTarget) => {
      const row = findStructuredRowForCodeTarget(target);
      const kindLabel = target.method.kind === 'event'
        ? '事件'
        : target.method.kind === 'constructor'
          ? '构造'
          : '功能';
      const canEditName = target.method.kind === 'method' || target.method.kind === 'event';
      const canEditReturnType = target.method.kind === 'method';
      const canEditStatic = target.method.kind === 'method';
      const accessValue = row?.access || target.method.access || '公开';
      const noteValue = row?.note || '';

      return (
        <div className={`border-b ${isDarkMode ? 'border-[#2b2d34]' : 'border-slate-200'}`}>
          <table className={`w-full min-w-[640px] border-b text-left ${tableChrome}`}>
            <thead>
              <tr>
                <th className={`${headCellClass} w-[220px]`}>方法名</th>
                <th className={`${headCellClass} w-[120px]`}>返回值类型</th>
                <th className={`${headCellClass} w-[68px]`}>静态</th>
                <th className={`${headCellClass} w-[82px]`}>公开</th>
                <th className={`${headCellClass} w-[82px]`}>类别</th>
                <th className={`${headCellClass} w-[64px] text-right`}>行</th>
                <th className={headCellClass}>备注</th>
              </tr>
            </thead>
            <tbody>
              <tr className={rowChrome(row)}>
                <td className={cellClass}>
                  {canEditName
                    ? renderCodeTargetFieldInput(target, 'name', target.method.name, '方法名', 'procedure')
                    : renderTextCell(target.method.name, 'procedure')}
                </td>
                <td className={cellClass}>
                  {canEditReturnType
                    ? renderCodeTargetFieldInput(target, 'returnType', target.method.returnType || '空', '返回值', 'type')
                    : renderTextCell(target.method.returnType || '空', 'type')}
                </td>
                <td className={cellClass}>{renderCodeTargetStaticSwitch(target, canEditStatic)}</td>
                <td className={cellClass}>{renderCodeTargetAccessSelect(target, accessValue)}</td>
                <td className={cellClass}>{renderTextCell(kindLabel, 'type')}</td>
                <td className={`${cellClass} text-right tabular-nums`}>{renderTextCell(target.method.line, 'muted')}</td>
                <td className={cellClass}>{renderCodeTargetNoteInput(target, noteValue)}</td>
              </tr>
            </tbody>
          </table>
          <table className={`w-full min-w-[680px] border-b text-left ${tableChrome}`}>
            <thead>
              <tr>
                <th className={`${headCellClass} w-[160px]`}>参数名</th>
                <th className={`${headCellClass} w-[130px]`}>类型</th>
                <th className={`${headCellClass} w-[180px]`}>默认值</th>
                <th className={`${headCellClass} w-[140px]`}>参考</th>
                <th className={headCellClass}>操作</th>
              </tr>
            </thead>
            <tbody>
              {target.method.parameters.map((parameter, index) => (
                <tr key={`${codeTargetKey(target)}:parameter:${index}`} className={rowChrome(row)}>
                  <td className={cellClass}>{renderParameterInput(target, index, 'name', parameter.name, '参数名', 'parameter')}</td>
                  <td className={cellClass}>{renderParameterInput(target, index, 'type', parameter.type, '类型', 'type')}</td>
                  <td className={cellClass}>{renderParameterInput(target, index, 'defaultValue', parameter.defaultValue || '', '默认值', 'value')}</td>
                  <td className={cellClass}>{renderTextCell(parameterExampleText(parameter), 'muted')}</td>
                  <td className={cellClass}>
                    <button
                      type="button"
                      onClick={() => removeCodeTargetParameter(target, index)}
                      className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${
                        isDarkMode
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                          : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              <tr className={isDarkMode ? 'bg-[#121318]' : 'bg-slate-50'}>
                <td className={cellClass}>{renderNewParameterInput(target, 'name', '输入参数名', 'parameter')}</td>
                <td className={cellClass}>{renderNewParameterInput(target, 'type', '文本型', 'type')}</td>
                <td className={cellClass}>{renderNewParameterInput(target, 'defaultValue', '"文本"', 'value')}</td>
                <td className={cellClass}>{renderTextCell('输入名称后自动添加', 'muted')}</td>
                <td className={cellClass}>{renderTextCell('新参数', 'muted')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    };

    const renderEventFunctionCallBar = (target: BeginnerCodeTarget) => {
      if (target.method.kind !== 'event' || functionTargets.length === 0) return null;
      const selectedTemplateTarget =
        functionTargets.find(functionTarget => codeTargetKey(functionTarget) === selectedFunctionTemplateKey)
        || functionTargets[0];
      const assistantDraftKey = selectedTemplateTarget ? functionCallDraftKey(target, selectedTemplateTarget) : '';
      const argumentDraft = assistantDraftKey ? functionCallDrafts[assistantDraftKey] || {} : {};
      const callPreview = selectedTemplateTarget
        ? formatFunctionCallWithDraft(selectedTemplateTarget.method.name, selectedTemplateTarget.method.parameters, argumentDraft)
        : '';
      const insertSelectedFunctionCall = () => {
        if (!selectedTemplateTarget) return;
        const currentBody = methodBodyText(target.method);
        const nextBody = currentBody.trim()
          ? `${currentBody}\n${callPreview}`
          : callPreview;
        commitBeginnerCodeBody(
          target.className,
          target.method.name,
          currentBody,
          nextBody
        );
        if (assistantDraftKey) {
          setFunctionCallDrafts(current => {
            const next = { ...current };
            delete next[assistantDraftKey];
            return next;
          });
        }
      };
      return (
        <div className={`border-b ${
          isDarkMode ? 'border-[#2b2d34] bg-[#121318]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex min-h-[34px] items-center gap-2 px-2">
            <span className={`shrink-0 text-[10px] font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>调用功能</span>
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1">
              {functionTargets.map(functionTarget => {
                const functionKey = codeTargetKey(functionTarget);
                const parameterCount = functionTarget.method.parameters.length;
                return (
                  <button
                    key={`${functionTarget.className}:${functionTarget.method.name}:call`}
                    type="button"
                    onMouseEnter={() => setSelectedFunctionTemplateKey(functionKey)}
                    onFocus={() => setSelectedFunctionTemplateKey(functionKey)}
                    onClick={() => setSelectedFunctionTemplateKey(functionKey)}
                    className={`max-w-[240px] shrink-0 rounded border px-2 py-1 text-[10px] font-semibold transition-colors ${
                      selectedTemplateTarget && codeTargetKey(selectedTemplateTarget) === functionKey
                        ? isDarkMode
                          ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                          : 'border-emerald-300 bg-emerald-100 text-emerald-800'
                        : isDarkMode
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                    title={`选择后填写参数：${formatFunctionCall(functionTarget.method.name, functionTarget.method.parameters)}`}
                  >
                    <span className="truncate">{functionTarget.method.name}</span>
                    <span className={`ml-1 text-[9px] ${isDarkMode ? 'text-emerald-200/80' : 'text-emerald-800/80'}`}>
                      {parameterCount > 0 ? `${parameterCount} 参数` : '无参数'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {selectedTemplateTarget && (
            <div className={`border-t px-2 py-2 ${isDarkMode ? 'border-[#2b2d34]' : 'border-slate-200'}`}>
              <div className={`rounded border px-2 py-2 ${
                isDarkMode ? 'border-[#343442] bg-[#111217]' : 'border-slate-200 bg-white'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`truncate text-[10px] font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                      {selectedTemplateTarget.method.name}
                    </div>
                    <div className={`truncate text-[9px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                      {formatFunctionSignature(selectedTemplateTarget.method.name, selectedTemplateTarget.method.parameters)}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!onUpdateSourceContent}
                    onClick={insertSelectedFunctionCall}
                    className={`rounded border px-2 py-1 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      isDarkMode
                        ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25'
                        : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                    }`}
                  >
                    插入调用
                  </button>
                </div>
                {selectedTemplateTarget.method.parameters.length > 0 ? (
                  <div className="mt-2 grid gap-1.5">
                    {selectedTemplateTarget.method.parameters.map((parameter, index) => {
                      const argumentKey = parameterCallArgumentKey(parameter, index);
                      const defaultValue = defaultFunctionArgument(parameter);
                      return (
                        <label
                          key={`${assistantDraftKey}:${argumentKey}`}
                          className={`grid min-w-0 grid-cols-[minmax(92px,1fr)_minmax(72px,.7fr)_minmax(120px,1.4fr)] items-center gap-2 rounded px-1.5 py-1 text-[10px] ${
                            isDarkMode ? 'bg-[#181a20] text-slate-300' : 'bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className={`truncate ${textTone('parameter')}`}>{parameter.name}</span>
                          <span className={`truncate ${textTone('type')}`}>{parameter.type}</span>
                          <input
                            value={argumentDraft[argumentKey] || ''}
                            placeholder={parameter.defaultValue?.trim() ? `默认 ${parameter.defaultValue.trim()}` : defaultValue}
                            disabled={!onUpdateSourceContent}
                            onChange={event => {
                              const nextValue = event.currentTarget.value;
                              setFunctionCallDrafts(current => ({
                                ...current,
                                [assistantDraftKey]: {
                                  ...(current[assistantDraftKey] || {}),
                                  [argumentKey]: nextValue
                                }
                              }));
                            }}
                            onKeyDown={event => {
                              if (event.key === 'Enter') insertSelectedFunctionCall();
                              if (event.key === 'Escape') {
                                setFunctionCallDrafts(current => ({
                                  ...current,
                                  [assistantDraftKey]: {
                                    ...(current[assistantDraftKey] || {}),
                                    [argumentKey]: ''
                                  }
                                }));
                                event.currentTarget.blur();
                              }
                            }}
                            className={`${directInputClasses('value')} disabled:cursor-not-allowed disabled:opacity-40`}
                          />
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`mt-2 rounded px-1.5 py-1 text-[10px] ${isDarkMode ? 'bg-[#181a20] text-slate-500' : 'bg-slate-50 text-slate-500'}`}>
                    无参数，点击“插入调用”会直接写入事件代码。
                  </div>
                )}
                <div className={`mt-2 rounded px-1.5 py-1 font-mono text-[10px] ${
                  isDarkMode ? 'bg-[#0d0f14] text-emerald-300' : 'bg-slate-50 text-emerald-700'
                }`}>
                  {callPreview}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };

    const renderCodeBodyEditor = (target: BeginnerCodeTarget, compact = false) => {
      const bodyText = methodBodyText(target.method);
      const targetKey = codeTargetKey(target);
      const draftBodyText = beginnerCodeDrafts[targetKey] ?? bodyText;
      const bodyLines = draftBodyText.split('\n').length ? draftBodyText.split('\n') : [''];
      const ifBlocks = parseBeginnerIfBlocks(bodyLines);
      const editorHeightClass = compact ? 'min-h-[170px]' : 'min-h-[230px]';
      const lineHeight = Math.max(18, Math.round(editorFontSize * 1.65));
      const editorTextStyle = {
        fontSize: `${editorFontSize}px`,
        lineHeight: `${lineHeight}px`
      };
      const lineInFlowBlock = (lineNumber: number) =>
        ifBlocks.some(block => lineNumber >= block.startLine && lineNumber <= block.endLine);

      return (
        <div className="relative" data-beginner-editor-root onWheel={handleEditorFontWheel}>
          <div className={`grid grid-cols-[var(--beginner-gutter-width)_var(--beginner-flow-width)_minmax(0,1fr)] border-b text-[10px] font-semibold ${
            isDarkMode ? 'border-[#2b2d34] bg-[#111217] text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-500'
          }`}>
            <div className="border-r px-2 py-1.5 text-right">行</div>
            <div className="border-r px-1 py-1.5 text-center">流</div>
            <div className="flex min-w-0 items-center justify-between gap-2 px-2 py-1.5">
              <span>中文 / C++ 代码</span>
              <span className="truncate font-normal">Alt+↑/↓ 跳分支 · Ctrl+Shift+\ 循环</span>
            </div>
          </div>
          <div className={`grid ${editorHeightClass} grid-cols-[var(--beginner-gutter-width)_var(--beginner-flow-width)_minmax(0,1fr)] ${
            isDarkMode ? 'bg-[#101116]' : 'bg-slate-50'
          }`}>
            <div data-beginner-line-numbers className={`select-none overflow-hidden border-r px-2 py-2 text-right text-[11px] leading-6 tabular-nums ${
              isDarkMode ? 'border-[#2b2d34] bg-[#111217] text-slate-600' : 'border-slate-200 bg-slate-50 text-slate-400'
            }`} style={editorTextStyle}>
              {bodyLines.map((_, index) => {
                const lineNumber = index + 1;
                const isJumpTarget = beginnerJumpHighlight?.targetKey === targetKey && beginnerJumpHighlight.line === lineNumber;
                return (
                  <div
                    key={index}
                    className={`rounded px-1 transition-colors duration-150 ${
                      isJumpTarget
                        ? isDarkMode ? 'bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/40' : 'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-300'
                        : ''
                    }`}
                    title={isJumpTarget ? `已跳转到：${beginnerJumpHighlight.label}` : undefined}
                  >
                    {lineNumber}
                  </div>
                );
              })}
            </div>
            <div data-beginner-flow-guide className={`select-none overflow-hidden px-1 py-2 text-center text-[11px] tabular-nums ${
              isDarkMode ? 'bg-[#101116] text-cyan-500/70' : 'bg-slate-50 text-cyan-600/80'
            }`} style={editorTextStyle}>
              {bodyLines.map((line, index) => {
                const lineNumber = index + 1;
                const kind = beginnerIfLineKind(line);
                const inBlock = lineInFlowBlock(lineNumber);
                const mark =
                  kind === 'if' ? '┌' :
                  kind === 'elseif' || kind === 'else' ? '├' :
                  kind === 'end' ? '└' :
                  inBlock ? '│' : '';
                return (
                  <div
                    key={`${index}:${mark}`}
                    className={`relative ${kind ? 'font-semibold' : ''} ${
                      inBlock && !kind ? isDarkMode ? 'text-cyan-500/35' : 'text-cyan-600/45' : ''
                    }`}
                    title={kind ? line.trim() : undefined}
                  >
                    {mark}
                  </div>
                );
              })}
            </div>
            <textarea
              key={`${target.className}:${target.method.name}:${target.method.line}:${bodyText}:${compact ? 'inline' : 'section'}`}
              data-text-model-view-key={`${target.className}:${target.method.kind}:${target.method.name}`}
              data-lingbuilder-editor-command-owner="true"
              data-source-line-start={target.method.statements[0]?.line || target.method.line + 1}
              data-source-line-map={target.method.statements.map(statement => statement.line).join(',')}
              data-source-column-start={methodBodyStartColumn(target.method)}
              data-source-column-map={methodBodySourceColumns(target.method).join(',')}
              value={draftBodyText}
              spellCheck={false}
              readOnly={!onUpdateSourceContent}
              placeholder="输入中文代码，@ 后面写原生 C++"
              onChange={event => { handleBeginnerCodeChange(target, event); captureBeginnerTextareaView(event.currentTarget); }}
              onBlur={event => handleBeginnerCodeBlur(target, bodyText, event)}
              onFocus={event => { updateBeginnerCommandHint(target, event.currentTarget); captureBeginnerTextareaView(event.currentTarget); }}
              onClick={event => { updateBeginnerCommandHint(target, event.currentTarget); captureBeginnerTextareaView(event.currentTarget); }}
              onKeyDown={event => handleBeginnerCodeKeyDown(target, event)}
              onKeyUp={event => { updateBeginnerCommandHint(target, event.currentTarget); captureBeginnerTextareaView(event.currentTarget); }}
              onSelect={event => { updateBeginnerCommandHint(target, event.currentTarget); captureBeginnerTextareaView(event.currentTarget); }}
              onScroll={event => {
                const lineNumberColumn = event.currentTarget.closest('[data-beginner-editor-root]')?.querySelector('[data-beginner-line-numbers]');
                const flowGuideColumn = event.currentTarget.closest('[data-beginner-editor-root]')?.querySelector('[data-beginner-flow-guide]');
                if (lineNumberColumn instanceof HTMLElement) lineNumberColumn.scrollTop = event.currentTarget.scrollTop;
                if (flowGuideColumn instanceof HTMLElement) flowGuideColumn.scrollTop = event.currentTarget.scrollTop;
                captureBeginnerTextareaView(event.currentTarget);
              }}
              onWheel={handleEditorFontWheel}
              style={editorTextStyle}
              className={`${editorHeightClass} w-full resize-y border-0 bg-transparent px-3 py-2 font-mono outline-none ${
                isDarkMode
                  ? 'text-slate-100 placeholder:text-slate-600'
                  : 'text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>
          {renderBeginnerCompletionPanel(target)}
          {renderBeginnerCommandHintPanel(target)}
        </div>
      );
    };

    const renderStatusCell = (row: LingCppStructuredReadingRow) => {
      const status = row.status ? statusLabel[row.status] : row.access || '公开';
      const isBound = row.status === 'bound';
      const isWarning = row.status === 'missing-control' || row.status === 'missing-source' || row.editKind === 'missing-event';
      return (
        <span className={`inline-flex max-w-full items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
          isWarning
            ? isDarkMode ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
            : isBound
              ? isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
              : isDarkMode ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600'
        }`} title={status}>
          <span className="truncate">{status}</span>
        </span>
      );
    };

    const renderSectionFrame = (
      id: string,
      title: string,
      count: number,
      description: string,
      children: React.ReactNode
    ) => (
      <section id={sectionDomId(id)} className="scroll-mt-0">
        <div className={`sticky top-0 z-20 flex h-8 items-center justify-between gap-2 border-b ${
          isDarkMode ? 'border-[#2b2d34] bg-[#15161b]' : 'border-slate-200 bg-white'
        }`}>
          <button
            type="button"
            onClick={() => toggleVolcanoSection(id)}
            className={`flex h-full min-w-0 flex-1 items-center justify-between gap-2 px-3 text-left transition-colors ${
              isDarkMode ? 'hover:bg-[#1c1d23]' : 'hover:bg-slate-50'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              {isSectionCollapsed(id)
                ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />}
              <span className={`text-[12px] font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{title}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                isDarkMode ? 'bg-slate-700/60 text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}>{count}</span>
            </span>
            <span className={`truncate text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{description}</span>
          </button>
        </div>
        {!isSectionCollapsed(id) && children}
      </section>
    );

    const renderDeclarationTable = (rows: LingCppStructuredReadingRow[]) => renderSectionFrame(
      'declaration',
      '源码声明',
      rows.length,
      '包、使用库、设计器关联文件',
      <table className={`w-full min-w-[720px] border-b text-left ${tableChrome}`}>
        <thead>
          <tr>
            <th className={`${headCellClass} w-[110px]`}>类型</th>
            <th className={`${headCellClass} w-[180px]`}>名称</th>
            <th className={headCellClass}>值</th>
            <th className={`${headCellClass} w-[64px] text-right`}>行</th>
            <th className={`${headCellClass} w-[260px]`}>备注</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} data-structured-line={row.line} onDoubleClick={() => revealStructuredRow(row)} className={rowChrome(row)}>
              <td className={cellClass}>{renderTextCell(row.type, 'type')}</td>
              <td className={cellClass}>
                {row.editKind === 'package'
                  ? renderDirectStructureInput(row, 'package-name', row.targetName || row.name, '包名', 'name')
                  : renderTextCell(row.name, 'name')}
              </td>
              <td className={cellClass}>{renderTextCell(row.value || row.name, 'value')}</td>
              <td className={`${cellClass} text-right tabular-nums`}>{renderTextCell(row.line, 'muted')}</td>
              <td className={cellClass}>{renderTextCell(row.note, 'muted')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

    const renderClassTable = (rows: LingCppStructuredReadingRow[]) => renderSectionFrame(
      'class',
      '类',
      rows.length,
      '窗口类、基础类和公开状态',
      <table className={`w-full min-w-[720px] border-b text-left ${tableChrome}`}>
        <thead>
          <tr>
            <th className={`${headCellClass} w-[110px]`}>类型</th>
            <th className={`${headCellClass} w-[220px]`}>类名</th>
            <th className={`${headCellClass} w-[180px]`}>基础类</th>
            <th className={`${headCellClass} w-[90px]`}>性质</th>
            <th className={`${headCellClass} w-[64px] text-right`}>行</th>
            <th className={headCellClass}>备注</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} data-structured-line={row.line} onDoubleClick={() => revealStructuredRow(row)} className={rowChrome(row)}>
              <td className={cellClass}>{renderTextCell(row.type || groupTitle[row.group], 'type')}</td>
              <td className={cellClass}>{renderDirectStructureInput(row, 'class-name', row.targetName || row.name, '类名', 'name')}</td>
              <td className={cellClass}>{renderDirectStructureInput(row, 'class-base', row.value || '', '基础类', 'type')}</td>
              <td className={cellClass}>{renderStatusCell(row)}</td>
              <td className={`${cellClass} text-right tabular-nums`}>{renderTextCell(row.line, 'muted')}</td>
              <td className={cellClass}>{renderTextCell(row.note, 'muted')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

    const renderMemberTable = (rows: LingCppStructuredReadingRow[]) => renderSectionFrame(
      'member',
      '成员声明',
      rows.length + (primaryLingCppClass ? 1 : 0),
      '成员变量、控件成员和设计器关联',
      <table className={`w-full min-w-[760px] border-b text-left ${tableChrome}`}>
        <thead>
          <tr>
            <th className={`${headCellClass} w-[130px]`}>类型</th>
            <th className={`${headCellClass} w-[220px]`}>名称</th>
            <th className={`${headCellClass} w-[64px]`}>静态</th>
            <th className={`${headCellClass} w-[64px]`}>数组</th>
            <th className={`${headCellClass} w-[180px]`}>初始值</th>
            <th className={`${headCellClass} w-[64px] text-right`}>行</th>
            <th className={headCellClass}>备注</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const controlMember = isControlMemberRow(row);
            const isDesignerLink = /关联设计文件/u.test(row.name);
            const kindLabel = isDesignerLink ? '设计关联' : controlMember ? '控件成员' : '类成员';
            return (
              <tr key={row.id} data-structured-line={row.line} onDoubleClick={() => revealStructuredRow(row)} className={rowChrome(row)}>
                <td className={cellClass}>{renderDirectStructureInput(row, 'member-type', row.type || '', '类型', 'type')}</td>
                <td className={cellClass}>{renderDirectStructureInput(row, 'member-name', row.targetName || row.name, '名称', 'variable')}</td>
                <td className={cellClass}>{renderMemberBooleanSwitch(row, 'member-static', Boolean(row.isStatic), `${kindLabel} · 静态`)}</td>
                <td className={cellClass}>{renderMemberBooleanSwitch(row, 'member-array', Boolean(row.isArray), `${kindLabel} · 数组`)}</td>
                <td className={cellClass}>{renderDirectStructureInput(row, 'member-initial', row.initialValue || '', '未设置', 'value')}</td>
                <td className={`${cellClass} text-right tabular-nums`}>{renderTextCell(row.line, 'muted')}</td>
                <td className={cellClass}>{renderDirectStructureInput(row, 'member-note', row.note || '', '备注', 'plain')}</td>
              </tr>
            );
          })}
          {primaryLingCppClass && (
            <tr className={isDarkMode ? 'bg-[#121318]' : 'bg-slate-50'}>
              <td className={cellClass}>{renderNewMemberInput('type', '类型', 'type')}</td>
              <td className={cellClass}>{renderNewMemberInput('name', '输入新成员', 'variable')}</td>
              <td className={cellClass}>{renderNewMemberBooleanSwitch('isStatic', '新成员 · 静态')}</td>
              <td className={cellClass}>{renderNewMemberBooleanSwitch('isArray', '新成员 · 数组')}</td>
              <td className={cellClass}>{renderNewMemberInput('initialValue', '初始值', 'value')}</td>
              <td className={`${cellClass} text-right`}>{renderTextCell('新', 'muted')}</td>
              <td className={cellClass}>{renderNewMemberInput('note', '备注', 'plain')}</td>
            </tr>
          )}
        </tbody>
      </table>
    );

    const getMissingDesignerEventEdit = createMissingDesignerEventEdit;

    const generateMissingDesignerEvent = (row: LingCppStructuredReadingRow) => {
      const applied = quickGenerateMissingDesignerEvent(row);
      if (applied) {
        window.requestAnimationFrame(() => scrollToStructureSection('event'));
      }
    };

    const generateAllMissingDesignerEvents = () => {
      const seen = new Set<string>();
      const generated = pendingEventRows
        .map(row => ({ row, edit: getMissingDesignerEventEdit(row) }))
        .filter((item): item is { row: LingCppStructuredReadingRow; edit: LingCppAstEdit & { kind: 'add-event' } } => {
          if (!item.edit || item.edit.kind !== 'add-event') return false;
          const key = `${item.edit.className}:${item.edit.event.handlerName}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      if (generated.length === 0) {
        setStructureEditError('当前源码里还没有可绑定事件的类。');
        return;
      }

      const applied = applyStructureAstEdits(generated.map(item => item.edit), generated[0]?.row.line);
      if (applied) {
        const firstEdit = generated[0].edit;
        setSelectedBeginnerHandler(firstEdit.event.handlerName);
        setSelectedBeginnerCodeTarget({ className: firstEdit.className, methodName: firstEdit.event.handlerName });
        setExpandedBeginnerEventTargetKey(`${firstEdit.className}:event:${firstEdit.event.handlerName}`);
        window.requestAnimationFrame(() => scrollToStructureSection('event'));
      }
    };

    const renderEventTable = (rows: LingCppStructuredReadingRow[]) => {
      const allRows = [...rows, ...pendingEventRows];
      return renderSectionFrame(
        'event',
        '事件处理器',
        allRows.length + (primaryLingCppClass ? 1 : 0),
        '控件事件、窗口事件和绑定状态',
        <>
          {pendingEventRows.length > 0 && (
            <div className={`flex items-center justify-between gap-2 border-b px-2 py-1.5 text-[11px] ${
              isDarkMode ? 'border-[#2b2d34] bg-amber-500/[0.06] text-amber-200' : 'border-amber-100 bg-amber-50 text-amber-800'
            }`}>
              <span>有 {pendingEventRows.length} 个设计器事件缺少源码处理器。</span>
              <button
                type="button"
                onClick={generateAllMissingDesignerEvents}
                disabled={!onUpdateSourceContent}
                className={`h-6 shrink-0 rounded px-2 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isDarkMode ? 'bg-amber-400/15 text-amber-200 hover:bg-amber-400/25' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                }`}
                title="一次生成所有缺失的事件处理器"
              >
                一键补齐
              </button>
            </div>
          )}
          <table className={`w-full min-w-[820px] border-b text-left ${tableChrome}`}>
            <thead>
              <tr>
                <th className={`${headCellClass} w-[150px]`}>事件</th>
                <th className={`${headCellClass} w-[240px]`}>处理器</th>
                <th className={`${headCellClass} w-[120px]`}>绑定</th>
                <th className={`${headCellClass} w-[220px]`}>参数</th>
                <th className={`${headCellClass} w-[64px] text-right`}>行</th>
                <th className={headCellClass}>备注</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map(row => {
                const target = row.editKind === 'event'
                  ? codeTargets.find(item =>
                      item.className === row.className &&
                      item.method.kind === 'event' &&
                      item.method.name === (row.targetName || row.name)
                    )
                  : undefined;
                const selected = Boolean(target && expandedBeginnerEventTargetKey === codeTargetKey(target));

                return (
                  <React.Fragment key={row.id}>
                    <tr
                      data-structured-line={row.line}
                      onClick={() => {
                        if (target) {
                          toggleInlineCodeTarget(target);
                          return;
                        }
                        if (row.editKind === 'missing-event' || row.status === 'missing-source') {
                          generateMissingDesignerEvent(row);
                        }
                      }}
                      onDoubleClick={() => revealStructuredRow(row)}
                      className={`${selected ? isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-50' : rowChrome(row)} cursor-pointer`}
                      title={row.editKind === 'event' ? '单击后直接编写事件代码' : undefined}
                    >
                      <td className={cellClass}>
                        <div className="flex min-w-0 items-center gap-1.5">
                          {target ? (
                            selected
                              ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                              : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                          ) : null}
                          {renderTextCell(row.type || row.name, 'type')}
                        </div>
                      </td>
                      <td className={cellClass}>
                        <div className="flex min-w-0 items-center gap-1.5">
                          <div className="min-w-0 flex-1">
                            {renderDirectStructureInput(row, 'event-handler', row.targetName || row.name, '处理器', 'procedure')}
                          </div>
                          {(row.editKind === 'missing-event' || row.status === 'missing-source') && (
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                generateMissingDesignerEvent(row);
                              }}
                              disabled={!onUpdateSourceContent}
                              className={`h-6 shrink-0 rounded px-2 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                isDarkMode ? 'bg-amber-400/15 text-amber-200 hover:bg-amber-400/25' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              }`}
                              title={`快速生成事件 ${row.targetName || row.name}`}
                            >
                              快速生成
                            </button>
                          )}
                        </div>
                      </td>
                      <td className={cellClass}>{renderStatusCell(row)}</td>
                      <td className={cellClass}>
                        {row.editKind === 'event'
                          ? renderParameterSummary(row.parameters)
                          : renderTextCell(formatParameterDraft(row.parameters) || '生成后逐行添加', 'muted')}
                      </td>
                      <td className={`${cellClass} text-right tabular-nums`}>{renderTextCell(row.line, 'muted')}</td>
                      <td className={cellClass}>{renderTextCell(row.note || (row.editKind === 'event' ? '单击编写' : ''), 'muted')}</td>
                    </tr>
                    {target && selected && (
                      <tr className={isDarkMode ? 'bg-[#111217]' : 'bg-slate-50'}>
                        <td colSpan={6} className={`p-0 ${isDarkMode ? 'border-b border-[#2b2d34]' : 'border-b border-slate-200'}`}>
                          <div className="min-w-[820px]">
                            <div className={`border-b px-2 py-1.5 text-[10px] font-semibold ${
                              isDarkMode ? 'border-[#2b2d34] text-cyan-300' : 'border-slate-200 text-cyan-700'
                            }`}>
                              事件实现
                            </div>
                            {renderProcessPropertyTable(target)}
                            {renderEventFunctionCallBar(target)}
                            {renderCodeBodyEditor(target, true)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {primaryLingCppClass && (
                <tr className={isDarkMode ? 'bg-[#121318]' : 'bg-slate-50'}>
                  <td className={cellClass}>{renderTextCell('自定义事件', 'type')}</td>
                  <td className={cellClass}>{renderNewEventInput('handlerName', '输入处理器名', 'procedure')}</td>
                  <td className={cellClass}>{renderTextCell('新事件', 'muted')}</td>
                  <td className={cellClass}>{renderTextCell('生成后逐行添加', 'muted')}</td>
                  <td className={`${cellClass} text-right`}>{renderTextCell('新', 'muted')}</td>
                  <td className={cellClass}>{renderTextCell('输入处理器名后自动生成并展开', 'muted')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      );
    };

    const renderMethodTable = (rows: LingCppStructuredReadingRow[]) => renderSectionFrame(
      'method',
      '初始化',
      rows.length,
      '构造、析构和生命周期方法',
      <table className={`w-full min-w-[760px] border-b text-left ${tableChrome}`}>
        <thead>
          <tr>
            <th className={`${headCellClass} w-[120px]`}>类别</th>
            <th className={`${headCellClass} w-[220px]`}>名称</th>
            <th className={`${headCellClass} w-[120px]`}>返回值</th>
            <th className={`${headCellClass} w-[220px]`}>参数</th>
            <th className={`${headCellClass} w-[64px] text-right`}>行</th>
            <th className={headCellClass}>备注</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const editableMethod = row.editKind === 'method';
            return (
              <tr
                key={row.id}
                data-structured-line={row.line}
                onClick={() => {
                  if (row.targetName) {
                    setSelectedBeginnerCodeTarget({ className: row.className, methodName: row.targetName });
                    window.requestAnimationFrame(() => scrollToStructureSection('code'));
                  }
                }}
                onDoubleClick={() => revealStructuredRow(row)}
                className={`${rowChrome(row)} cursor-pointer`}
              >
                <td className={cellClass}>{renderTextCell(row.type || groupTitle[row.group], 'type')}</td>
                <td className={cellClass}>
                  {editableMethod
                    ? renderDirectStructureInput(row, 'method-name', row.targetName || row.name, '方法名', 'procedure')
                    : renderTextCell(row.targetName || row.name, 'procedure')}
                </td>
                <td className={cellClass}>
                  {editableMethod
                    ? renderDirectStructureInput(row, 'method-return', row.returnType || row.type || '空', '返回值', 'type')
                    : renderTextCell(row.returnType || row.type || '空', 'type')}
                </td>
                <td className={cellClass}>
                  {editableMethod
                    ? renderDirectStructureInput(row, 'method-parameters', formatParameterDraft(row.parameters), '参数', 'plain')
                    : renderTextCell(formatParameterDraft(row.parameters) || row.value, 'plain')}
                </td>
                <td className={`${cellClass} text-right tabular-nums`}>{renderTextCell(row.line, 'muted')}</td>
                <td className={cellClass}>{renderTextCell(row.note, 'muted')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );

    const renderFunctionTable = (rows: LingCppStructuredReadingRow[]) => renderSectionFrame(
      'function',
      '功能代码',
      rows.length + (primaryLingCppClass ? 1 : 0),
      '可被事件调用的普通功能方法',
      <table className={`w-full min-w-[800px] border-b text-left ${tableChrome}`}>
        <thead>
          <tr>
            <th className={`${headCellClass} w-[120px]`}>返回值</th>
            <th className={`${headCellClass} w-[220px]`}>功能名</th>
            <th className={`${headCellClass} w-[260px]`}>参数</th>
            <th className={`${headCellClass} w-[160px]`}>事件调用</th>
            <th className={`${headCellClass} w-[64px] text-right`}>行</th>
            <th className={headCellClass}>备注</th>
          </tr>
        </thead>
        <tbody>
            {rows.map(row => {
              const target = functionTargets.find(item =>
                item.className === row.className &&
                item.method.name === (row.targetName || row.name)
              );
            const selected = Boolean(target && expandedBeginnerFunctionTargetKey === codeTargetKey(target));

            return (
              <React.Fragment key={row.id}>
                <tr
                  data-structured-line={row.line}
                  onClick={() => {
                    if (target) toggleInlineCodeTarget(target);
                  }}
                  onDoubleClick={() => revealStructuredRow(row)}
                  className={`${selected ? isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-50' : rowChrome(row)} cursor-pointer`}
                  title="单击后在下方直接编写功能代码"
                >
                  <td className={cellClass}>{renderDirectStructureInput(row, 'method-return', row.returnType || row.type || '空', '返回值', 'type')}</td>
                  <td className={cellClass}>
                    <div className="flex min-w-0 items-center gap-1.5">
                      {target ? (
                        selected
                          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        {renderDirectStructureInput(row, 'method-name', row.targetName || row.name, '功能名', 'procedure')}
                      </div>
                    </div>
                  </td>
                  <td className={cellClass}>{renderParameterSummary(row.parameters)}</td>
                  <td className={cellClass}>{renderFunctionCallTemplatePreview(row.targetName || row.name, row.parameters, true)}</td>
                  <td className={`${cellClass} text-right tabular-nums`}>{renderTextCell(row.line, 'muted')}</td>
                  <td className={cellClass}>{renderTextCell(row.note || '单击编写', 'muted')}</td>
                </tr>
                {target && selected && (
                  <tr className={isDarkMode ? 'bg-[#111217]' : 'bg-slate-50'}>
                    <td colSpan={6} className={`p-0 ${isDarkMode ? 'border-b border-[#2b2d34]' : 'border-b border-slate-200'}`}>
                      <div className="min-w-[800px]">
                        <div className={`border-b px-2 py-1.5 text-[10px] font-semibold ${
                          isDarkMode ? 'border-[#2b2d34] text-cyan-300' : 'border-slate-200 text-cyan-700'
                        }`}>
                          功能实现
                        </div>
                        {renderProcessPropertyTable(target)}
                        {renderCodeBodyEditor(target, true)}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {primaryLingCppClass && (
            <tr className={isDarkMode ? 'bg-[#121318]' : 'bg-slate-50'}>
              <td className={cellClass}>{renderNewFunctionInput('returnType', '空', 'type')}</td>
              <td className={cellClass}>{renderNewFunctionInput('name', '输入功能名', 'procedure')}</td>
              <td className={cellClass}>{renderTextCell('生成后逐行添加', 'muted')}</td>
              <td className={cellClass}>{renderTextCell('功能名("文本", 0)', 'muted')}</td>
              <td className={`${cellClass} text-right`}>{renderTextCell('新', 'muted')}</td>
              <td className={cellClass}>{renderTextCell('输入功能名后自动新增并展开', 'muted')}</td>
            </tr>
          )}
        </tbody>
      </table>
    );

    const renderCodeEditorSection = () => renderSectionFrame(
      'code',
      '代码',
      codeTargets.length,
      activeCodeTarget ? `${activeCodeTarget.method.name} 的中文逻辑` : '选择事件或方法后编辑',
      <div className={`border-b ${tableChrome}`}>
        {activeCodeTarget ? (
          <div className="grid min-h-[260px] min-w-[760px] grid-cols-[190px_minmax(0,1fr)]">
            <div className={`border-r ${isDarkMode ? 'border-[#2b2d34] bg-[#121318]' : 'border-slate-200 bg-slate-50'}`}>
              <div className={`border-b px-2 py-1.5 text-[10px] font-semibold ${isDarkMode ? 'border-[#2b2d34] text-slate-500' : 'border-slate-200 text-slate-500'}`}>过程</div>
              <div className="max-h-[320px] overflow-auto py-1">
                {codeTargets.map(target => {
                  const selected = target.className === activeCodeTarget.className && target.method.name === activeCodeTarget.method.name;
                  const kindLabel = target.method.kind === 'event' ? '事件' : target.method.kind === 'constructor' ? '构造' : '方法';
                  return (
                    <button
                      key={`${target.className}:${target.method.name}:${target.method.line}`}
                      type="button"
                      onClick={() => {
                        setSelectedBeginnerCodeTarget({ className: target.className, methodName: target.method.name });
                        if (target.method.kind === 'event') setSelectedBeginnerHandler(target.method.name);
                      }}
                      className={`flex w-full items-center gap-2 border-l-2 px-2 py-1.5 text-left text-[11px] transition-colors ${
                        selected
                          ? isDarkMode ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200' : 'border-cyan-500 bg-cyan-50 text-cyan-800'
                          : isDarkMode ? 'border-transparent text-slate-400 hover:bg-[#1b1c22] hover:text-slate-100' : 'border-transparent text-slate-600 hover:bg-white hover:text-slate-950'
                      }`}
                      title={`${target.method.name} - 第 ${target.method.line} 行`}
                    >
                      <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] ${
                        target.method.kind === 'event'
                          ? isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                          : isDarkMode ? 'bg-slate-700/60 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}>{kindLabel}</span>
                      <span className="truncate font-semibold">{target.method.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="min-w-0">
              {renderProcessPropertyTable(activeCodeTarget)}
              {renderEventFunctionCallBar(activeCodeTarget)}
              {renderCodeBodyEditor(activeCodeTarget)}
            </div>
          </div>
        ) : (
          <div className="min-w-[760px] px-3 py-8 text-center text-xs text-slate-500">暂无可编辑的事件或方法。</div>
        )}
      </div>
    );

    const renderOtherTable = (rows: LingCppStructuredReadingRow[]) => renderSectionFrame(
      'other',
      '备注',
      rows.length,
      '参数摘要和注释说明',
      <table className={`w-full min-w-[680px] border-b text-left ${tableChrome}`}>
        <thead>
          <tr>
            <th className={`${headCellClass} w-[120px]`}>类型</th>
            <th className={`${headCellClass} w-[220px]`}>名称</th>
            <th className={headCellClass}>值</th>
            <th className={`${headCellClass} w-[64px] text-right`}>行</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} onDoubleClick={() => revealStructuredRow(row)} className={rowChrome(row)}>
              <td className={cellClass}>{renderTextCell(row.type || groupTitle[row.group], 'type')}</td>
              <td className={cellClass}>{renderTextCell(row.name, 'name')}</td>
              <td className={cellClass}>{renderTextCell(row.value || row.note, 'plain')}</td>
              <td className={`${cellClass} text-right tabular-nums`}>{renderTextCell(row.line, 'muted')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

    const canvasBorder = isDarkMode ? 'border-[#2b2d34]' : 'border-slate-200';
    const canvasBg = isDarkMode ? 'bg-[#15161b]' : 'bg-white';
    const editorCanvasBg = isDarkMode ? 'bg-[#101116]' : 'bg-slate-50';
    const gutterBg = isDarkMode ? 'bg-[#111217] text-slate-500' : 'bg-slate-50 text-slate-400';
    const allProcessTargets = [...codeTargets].sort((left, right) => left.method.line - right.method.line);
    const activeCanvasTarget = activeCodeTarget || allProcessTargets[0];
    const compactTableBorder = isDarkMode ? 'border-[#33343b]' : 'border-slate-300';
    const compactHeadCellClass = `h-[var(--beginner-table-row-height)] border px-[var(--beginner-table-cell-x)] text-[length:var(--beginner-table-head-font-size)] font-semibold leading-[var(--beginner-table-line-height)] ${compactTableBorder} ${
      isDarkMode ? 'bg-[#202127] text-slate-300' : 'bg-slate-100 text-slate-700'
    }`;
    const compactCellClass = `h-[var(--beginner-table-row-height)] border px-[var(--beginner-table-cell-x)] align-middle text-[length:var(--beginner-table-font-size)] leading-[var(--beginner-table-line-height)] ${compactTableBorder} ${
      isDarkMode ? 'bg-[#18191f] text-slate-200' : 'bg-white text-slate-800'
    }`;
    const compactEmptyCellClass = `h-[var(--beginner-table-row-height)] border px-[var(--beginner-table-cell-x)] align-middle text-[length:var(--beginner-table-font-size)] leading-[var(--beginner-table-line-height)] ${compactTableBorder} ${
      isDarkMode ? 'bg-[#15161b] text-slate-600' : 'bg-white text-slate-400'
    }`;
    type CompactColumn = { label: string; className?: string; style?: React.CSSProperties };
    const beginnerKnownMembers = new Set(memberRows.map(row => row.targetName || row.name).filter(Boolean));
    const beginnerKnownProcedures = new Set(codeTargets.map(target => target.method.name).filter(Boolean));
    const beginnerModuleCommands = new Set(getLingCppModuleCommandNames(moduleContext));
    const beginnerNativeVariables = extractLingCppNativeVariableNames(normalizedSourceCode);

    const findBeginnerLineCommentStart = (line: string) => {
      let inDoubleQuote = false;
      let inChineseQuote = false;
      for (let index = 0; index < line.length - 1; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === '\\') {
          index += 1;
          continue;
        }
        if (!inChineseQuote && char === '"') {
          inDoubleQuote = !inDoubleQuote;
          continue;
        }
        if (!inDoubleQuote && char === '“') {
          inChineseQuote = true;
          continue;
        }
        if (inChineseQuote && char === '”') {
          inChineseQuote = false;
          continue;
        }
        if (!inDoubleQuote && !inChineseQuote && char === '/' && next === '/') return index;
      }
      return -1;
    };

    const renderBeginnerCodeToken = (token: string, kind: LingCppPresentationTokenKind, index: number) => {
      if (!token) return null;
      const className = {
        string: isDarkMode ? 'text-[#d7c5a1]' : 'text-amber-700',
        command: isDarkMode ? 'text-[#dcdcaa]' : 'text-amber-700',
        keyword: isDarkMode ? 'text-[#4ea5ff]' : 'text-blue-700',
        type: isDarkMode ? 'text-[#2bd4c6]' : 'text-teal-700',
        literal: isDarkMode ? 'text-[#b5cea8]' : 'text-emerald-700',
        'module-command': isDarkMode ? 'font-bold text-[#22d3ee]' : 'font-bold text-[#006a7a]',
        member: isDarkMode ? 'text-amber-200' : 'text-amber-800',
        procedure: isDarkMode ? 'text-cyan-200' : 'text-cyan-800',
        operator: isDarkMode ? 'text-slate-400' : 'text-slate-500',
        'native-marker': isDarkMode ? 'font-bold text-[#c586c0]' : 'font-bold text-[#7a1fa2]',
        'native-keyword': isDarkMode ? 'font-semibold text-[#569cd6]' : 'font-semibold text-blue-700',
        'native-type': isDarkMode ? 'text-[#4ec9b0]' : 'text-teal-700',
        'native-namespace': isDarkMode ? 'text-[#4fc1ff]' : 'text-blue-700',
        'native-function': isDarkMode ? 'text-[#dcdcaa]' : 'text-[#795e26]',
        'native-variable': isDarkMode ? 'text-[#9cdcfe]' : 'text-[#001080]',
        identifier: isDarkMode ? 'text-slate-100' : 'text-slate-900'
      }[kind];
      return <span key={index} data-lingcpp-token={kind} className={className}>{token}</span>;
    };

    const renderBeginnerCodeLine = (line: string) => {
      if (!line) return <span>&nbsp;</span>;
      const leadingSpace = line.match(/^\s*/u)?.[0] || '';
      const body = line.slice(leadingSpace.length);
      const commentStart = findBeginnerLineCommentStart(body);
      const codePart = commentStart >= 0 ? body.slice(0, commentStart) : body;
      const commentPart = commentStart >= 0 ? body.slice(commentStart) : '';
      const isNativeCpp = codePart.trimStart().startsWith('@');
      const tokens = classifyLingCppPresentationCode(codePart, {
        isNativeCpp,
        moduleCommands: beginnerModuleCommands,
        knownMembers: beginnerKnownMembers,
        knownProcedures: beginnerKnownProcedures,
        nativeVariables: beginnerNativeVariables
      });
      return (
        <>
          <span>{leadingSpace}</span>
          {tokens.map((token, index) => renderBeginnerCodeToken(token.text, token.kind, index))}
          {commentPart && (
            <span className={isDarkMode ? 'text-[#6A9955]' : 'text-green-700'}>{commentPart}</span>
          )}
        </>
      );
    };

    const renderSourceShell = (
      id: string,
      visualLine: number,
      sourceLine: number,
      tone: 'plain' | 'active' | 'warning',
      children: React.ReactNode
    ) => (
      <section
        id={sectionDomId(id)}
        data-structured-line={sourceLine}
        className={`grid grid-cols-[var(--beginner-gutter-width)_minmax(0,1fr)] border-b ${canvasBorder} ${
          tone === 'active'
            ? `${canvasBg} ${isDarkMode ? 'shadow-[inset_2px_0_0_rgba(34,211,238,0.55)]' : 'shadow-[inset_2px_0_0_rgba(8,145,178,0.5)]'}`
            : tone === 'warning'
              ? isDarkMode ? 'bg-amber-500/[0.06]' : 'bg-amber-50'
              : canvasBg
        }`}
      >
        <button
          type="button"
          onClick={() => revealLingCppLine(sourceLine)}
          className={`border-r px-2 py-2 text-right font-mono text-[length:var(--beginner-table-font-size)] leading-[var(--beginner-table-line-height)] tabular-nums ${canvasBorder} ${gutterBg}`}
          title={`定位到源码第 ${sourceLine} 行`}
        >
          {sourceLine}
        </button>
        <div className="min-w-0 px-3 py-2">{children}</div>
      </section>
    );

    const renderBlankSourceLine = (visualLine: number) => (
      <section key={`blank-${visualLine}`} className={`grid grid-cols-[var(--beginner-gutter-width)_minmax(0,1fr)] ${editorCanvasBg}`}>
        <div className={`border-r px-2 py-1 text-right font-mono text-[length:var(--beginner-table-font-size)] leading-[var(--beginner-table-line-height)] tabular-nums ${canvasBorder} ${gutterBg}`} />
        <div className="h-[var(--beginner-blank-row-height)]" />
      </section>
    );

    const renderInlineTable = (
      columns: CompactColumn[],
      rows: React.ReactNode[],
      maxWidth: number
    ) => (
      <div className="inline-block w-full max-w-full align-top" style={{ maxWidth: `calc(${maxWidth}px * var(--beginner-table-scale))` }}>
        <table className={`w-full table-fixed border-collapse text-left font-sans text-[length:var(--beginner-table-font-size)] leading-[var(--beginner-table-line-height)] ${compactTableBorder}`}>
          <thead>
            <tr>
              {columns.map((column, columnIndex) => (
                <th
                  key={`${column.label}:${columnIndex}`}
                  className={`${compactHeadCellClass} ${column.className || ''}`}
                  style={column.style}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    );

    const classDeclarationRow = classRows[0] || normalRows.find(row => row.editKind === 'class');
    const packageDeclarationRow = declarationRows.find(row => row.editKind === 'package') || declarationRows[0];

    const renderDeclarationCanvas = () => {
      const row = classDeclarationRow || packageDeclarationRow;
      if (!row) return null;

      return renderSourceShell(
        'declaration',
        1,
        row.line,
        'plain',
        renderInlineTable(
          [
            { label: '窗口程序集名', className: 'w-[160px]' },
            { label: '保 留', className: 'w-[58px]' },
            { label: '保 留', className: 'w-[58px]' },
            { label: '备 注', className: 'w-[120px]' }
          ],
          [
            <tr key={row.id} className={rowChrome(row)}>
              <td className={compactCellClass}>
                {renderTextCell(row.targetName || row.name, 'name')}
              </td>
              <td className={compactEmptyCellClass}>{renderTextCell('', 'muted')}</td>
              <td className={compactEmptyCellClass}>{renderTextCell('', 'muted')}</td>
              <td className={compactCellClass}>{renderTextCell(row.note, 'muted')}</td>
            </tr>
          ],
          420
        )
      );
    };

    const isActiveProcessTarget = (target: BeginnerCodeTarget) =>
      Boolean(activeCanvasTarget && codeTargetKey(activeCanvasTarget) === codeTargetKey(target));

    const getProcessBodyLineCount = (target: BeginnerCodeTarget) =>
      Math.max(1, (beginnerCodeDrafts[codeTargetKey(target)] ?? methodBodyText(target.method)).split('\n').length);

    const renderProcessHeader = (target: BeginnerCodeTarget, visualLine: number) => {
      const row = findStructuredRowForCodeTarget(target);
      const canEditName = target.method.kind === 'method' || target.method.kind === 'event';
      const canEditReturnType = target.method.kind === 'method';
      const canEditStatic = target.method.kind === 'method';
      const accessValue = row?.access || target.method.access || '公开';
      const noteValue = row?.note || '';
      const selected = isActiveProcessTarget(target);
      const noteColumnWidth = Math.min(420, Math.max(280, Array.from(noteValue).length * 14 + 28));
      const processTableWidth = 438 + noteColumnWidth;

      return renderSourceShell(
        `${target.method.kind}-${target.method.name}-${target.method.line}`,
        visualLine,
        target.method.line,
        selected ? 'active' : 'plain',
        renderInlineTable(
          [
            { label: '子程序名', className: 'w-[220px]' },
            { label: '返回值类型', className: 'w-[90px]' },
            { label: '静态', className: 'w-[54px]' },
            { label: '公开', className: 'w-[74px]' },
            { label: '备注', style: { width: noteColumnWidth } }
          ],
          [
            <tr
              key={`${target.className}:${target.method.name}`}
              className={selected
                ? isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-50'
                : rowChrome(row)}
              onClick={() => {
                setSelectedBeginnerCodeTarget({ className: target.className, methodName: target.method.name });
                if (target.method.kind === 'event') setSelectedBeginnerHandler(target.method.name);
              }}
            >
              <td className={compactCellClass}>
                {canEditName
                  ? renderCodeTargetFieldInput(target, 'name', target.method.name, '子程序名', 'procedure')
                  : renderTextCell(target.method.name, 'procedure')}
              </td>
              <td className={compactCellClass}>
                {canEditReturnType
                  ? renderCodeTargetFieldInput(target, 'returnType', target.method.returnType || '空', '返回值类型', 'type')
                  : renderTextCell(target.method.returnType || '空', 'type')}
              </td>
              <td className={compactCellClass}>{renderCodeTargetStaticSwitch(target, canEditStatic)}</td>
              <td className={compactCellClass}>{renderCodeTargetAccessSelect(target, accessValue)}</td>
              <td className={compactCellClass}>{renderCodeTargetNoteInput(target, noteValue)}</td>
            </tr>
          ],
          processTableWidth
        )
      );
    };

    const renderMemberCanvas = (visualLineStart: number) => {
      const rows = memberRows;
      if (rows.length === 0 && !primaryLingCppClass) return null;
      const sourceLine = rows[0]?.line || primaryLingCppClass?.line || 1;
      const showNewMemberRow = Boolean(primaryLingCppClass);
      const countedRows = rows.length > 0
        ? rows.map((row, index) => ({ visualLine: visualLineStart + index, sourceLine: row.line }))
        : showNewMemberRow
          ? [{ visualLine: visualLineStart, sourceLine }]
          : [];

      return (
        <section
          id={sectionDomId('member')}
          data-structured-line={sourceLine}
          className={`grid grid-cols-[var(--beginner-gutter-width)_minmax(0,1fr)] border-b ${canvasBorder} ${canvasBg}`}
        >
          <div className={`select-none border-r px-2 py-2 text-right font-mono text-[length:var(--beginner-table-font-size)] leading-[var(--beginner-table-line-height)] tabular-nums ${canvasBorder} ${gutterBg}`}>
            <div className={`h-[var(--beginner-table-row-height)] border-b ${canvasBorder}`} />
            {countedRows.map(item => (
              <button
                key={`${item.visualLine}:${item.sourceLine}`}
                type="button"
                onClick={() => revealLingCppLine(item.sourceLine)}
                className="block h-[var(--beginner-table-row-height)] w-full text-right"
                title={`定位到源码第 ${item.sourceLine} 行`}
              >
                {item.sourceLine}
              </button>
            ))}
            {showNewMemberRow && rows.length > 0 && (
              <div className="h-[var(--beginner-table-row-height)] text-right text-slate-600">+</div>
            )}
          </div>
          <div className="min-w-0 px-3 py-2">
          {renderInlineTable(
            [
              { label: '程序集变量', className: 'w-[140px]' },
              { label: '类 型', className: 'w-[96px]' },
              { label: '静 态', className: 'w-[56px]' },
              { label: '数 组', className: 'w-[56px]' },
              { label: '备 注', className: 'w-[140px]' },
              { label: '操 作', className: 'w-[88px]' }
            ],
            [
              ...rows.map(row => (
                <tr key={`${row.id}:${row.line}`} className={rowChrome(row)}>
                  <td className={compactCellClass}>{renderDirectStructureInput(row, 'member-name', row.targetName || row.name, '变量名', 'variable')}</td>
                  <td className={compactCellClass}>{renderDirectStructureInput(row, 'member-type', row.type || '', '类型', 'type')}</td>
                  <td className={compactCellClass}>{renderMemberBooleanSwitch(row, 'member-static', Boolean(row.isStatic), '切换程序集变量静态')}</td>
                  <td className={compactCellClass}>{renderMemberBooleanSwitch(row, 'member-array', Boolean(row.isArray), '切换程序集变量数组')}</td>
                  <td className={compactCellClass}>{renderDirectStructureInput(row, 'member-note', row.note || '', '备注', 'plain')}</td>
                  <td className={compactCellClass}>
                    <button
                      type="button"
                      onClick={() => deleteStructuredRow(row)}
                      disabled={!onUpdateSourceContent || !row.editable || row.editKind !== 'member'}
                      className={`inline-flex h-[var(--beginner-input-height)] w-full items-center justify-center gap-1 rounded border px-2 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                        isDarkMode
                          ? 'border-rose-500/25 text-rose-300 hover:bg-rose-500/10'
                          : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                      }`}
                      title={`删除变量 ${row.targetName || row.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                      删除
                    </button>
                  </td>
                </tr>
              )),
              primaryLingCppClass ? (
                <tr key="new-member" className={isDarkMode ? 'bg-[#121318]' : 'bg-slate-50'}>
                  <td className={compactCellClass}>{renderNewMemberInput('name', '输入变量名', 'variable')}</td>
                  <td className={compactCellClass}>{renderNewMemberInput('type', '类型', 'type')}</td>
                  <td className={compactEmptyCellClass}>{renderNewMemberBooleanSwitch('isStatic', '新程序集变量 · 静态')}</td>
                  <td className={compactEmptyCellClass}>{renderNewMemberBooleanSwitch('isArray', '新程序集变量 · 数组')}</td>
                  <td className={compactCellClass}>{renderNewMemberInput('note', '备注', 'plain')}</td>
                  <td className={compactCellClass}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={commitNewMemberDraft}
                        disabled={!onUpdateSourceContent || !newMemberDraft.name.trim() || !newMemberDraft.type.trim()}
                        className={`inline-flex h-[var(--beginner-input-height)] flex-1 items-center justify-center gap-1 rounded border px-1.5 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                          isDarkMode
                            ? 'border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/10'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                        title="确认新增变量"
                      >
                        <Check className="h-3 w-3" />
                        新增
                      </button>
                      <button
                        type="button"
                        onClick={resetNewMemberDraft}
                        disabled={!newMemberDraft.name && !newMemberDraft.note && !newMemberDraft.initialValue && !newMemberDraft.isStatic && !newMemberDraft.isArray && newMemberDraft.type === '文本型'}
                        aria-label="取消新增变量"
                        className={`inline-flex h-[var(--beginner-input-height)] w-7 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                          isDarkMode
                            ? 'border-slate-600 text-slate-400 hover:bg-slate-700/50'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                        title="取消并清空新增变量表单"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null
            ].filter(Boolean) as React.ReactNode[],
            612
          )}
          </div>
        </section>
      );
    };

    const renderParameterCanvas = (target: BeginnerCodeTarget, visualLine: number) => {
      if (target.method.parameters.length === 0) return null;
      return renderSourceShell(
        `${target.method.kind}-${target.method.name}-params`,
        visualLine,
        target.method.line,
        'plain',
        renderInlineTable(
          [
            { label: '参数名', className: 'w-[140px]' },
            { label: '类 型', className: 'w-[96px]' },
            { label: '默认值', className: 'w-[96px]' },
            { label: '备 注', className: 'w-[140px]' }
          ],
          target.method.parameters.map((parameter, index) => (
            <tr key={`${codeTargetKey(target)}:param:${index}`} className={isDarkMode ? 'bg-[#18191f]' : 'bg-white'}>
              <td className={compactCellClass}>{renderParameterInput(target, index, 'name', parameter.name, '参数名', 'parameter')}</td>
              <td className={compactCellClass}>{renderParameterInput(target, index, 'type', parameter.type, '类型', 'type')}</td>
              <td className={compactCellClass}>{renderParameterInput(target, index, 'defaultValue', parameter.defaultValue || '', '默认值', 'value')}</td>
              <td className={compactCellClass}>{renderTextCell(parameterExampleText(parameter), 'muted')}</td>
            </tr>
          )),
          520
        )
      );
    };

    const renderContinuousCodeBody = (target: BeginnerCodeTarget, firstVisualLine: number) => {
      const bodyText = methodBodyText(target.method);
      const targetKey = codeTargetKey(target);
      const draftBodyText = beginnerCodeDrafts[targetKey] ?? bodyText;
      const bodyLines = draftBodyText.split('\n').length ? draftBodyText.split('\n') : [''];
      const ifBlocks = parseBeginnerIfBlocks(bodyLines);
      const lineHeight = Math.max(18, Math.round(editorFontSize * 1.65));
      const editorHeight = Math.max(lineHeight * Math.max(bodyLines.length, 1) + 16, lineHeight + 16);
      const editorTextStyle = { fontSize: `${editorFontSize}px`, lineHeight: `${lineHeight}px`, height: `${editorHeight}px` };
      const lineInFlowBlock = (lineNumber: number) =>
        ifBlocks.some(block => lineNumber >= block.startLine && lineNumber <= block.endLine);

      return (
        <section
          key={`${target.className}:${target.method.name}:code`}
          data-structured-line={target.method.statements[0]?.line || target.method.line}
          className={`relative grid grid-cols-[var(--beginner-gutter-width)_var(--beginner-flow-width)_minmax(0,1fr)] ${editorCanvasBg}`}
          data-beginner-editor-root
          onContextMenu={event => openBeginnerContextMenu(event, target)}
          onWheel={handleEditorFontWheel}
        >
          <div data-beginner-line-numbers className={`select-none overflow-hidden border-r px-2 py-2 text-right text-[11px] tabular-nums ${canvasBorder} ${gutterBg}`} style={editorTextStyle}>
            {bodyLines.map((_, index) => {
              const displayLine = target.method.statements[index]?.line
                || (target.method.statements[0]?.line || target.method.line + 1) + index;
              const localLine = index + 1;
              const isJumpTarget = beginnerJumpHighlight?.targetKey === targetKey && beginnerJumpHighlight.line === localLine;
              return (
                <div
                  key={displayLine}
                  className={`rounded px-1 transition-colors duration-150 ${
                    isJumpTarget
                      ? isDarkMode ? 'bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/40' : 'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-300'
                      : ''
                  }`}
                  title={isJumpTarget ? `已跳转到：${beginnerJumpHighlight.label}` : undefined}
                >
                  {displayLine}
                </div>
              );
            })}
          </div>
          <div data-beginner-flow-guide className={`select-none overflow-hidden px-1 py-2 text-center text-[11px] tabular-nums ${
            isDarkMode ? 'bg-[#101116] text-cyan-500/70' : 'bg-slate-50 text-cyan-600/80'
          }`} style={editorTextStyle}>
            {bodyLines.map((line, index) => {
              const localLine = index + 1;
              const kind = beginnerIfLineKind(line);
              const inBlock = lineInFlowBlock(localLine);
              const mark =
                kind === 'if' ? '┌' :
                kind === 'elseif' || kind === 'else' ? '├' :
                kind === 'end' ? '└' :
                inBlock ? '│' : '';
              return (
                <div
                  key={`${index}:${mark}`}
                  className={`${kind ? 'font-semibold' : ''} ${
                    inBlock && !kind ? isDarkMode ? 'text-cyan-500/35' : 'text-cyan-600/45' : ''
                  }`}
                  title={kind ? line.trim() : undefined}
                >
                  {mark}
                </div>
              );
            })}
          </div>
          <div className={`relative min-w-0 ${editorCanvasBg}`} style={editorTextStyle}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden px-3 py-2 font-mono font-normal not-italic tracking-normal"
              style={{ fontSize: `${editorFontSize}px`, lineHeight: `${lineHeight}px`, tabSize: 4 }}
            >
              {bodyLines.map((line, index) => (
                <div
                  key={`${targetKey}:highlight:${index}`}
                  className="whitespace-pre-wrap"
                  style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                >
                  {renderBeginnerCodeLine(line)}
                </div>
              ))}
            </div>
            <textarea
              key={`${target.className}:${target.method.name}:${target.method.line}:${bodyText}:yc-source`}
              data-text-model-view-key={`${target.className}:${target.method.kind}:${target.method.name}`}
              data-lingbuilder-editor-command-owner="true"
              data-source-line-start={target.method.statements[0]?.line || target.method.line + 1}
              data-source-line-map={target.method.statements.map(statement => statement.line).join(',')}
              data-source-column-start={methodBodyStartColumn(target.method)}
              data-source-column-map={methodBodySourceColumns(target.method).join(',')}
              value={draftBodyText}
              spellCheck={false}
              readOnly={!onUpdateSourceContent}
              placeholder="输入中文代码；@ 后面写原生 C++"
              onChange={event => { handleBeginnerCodeChange(target, event); captureBeginnerTextareaView(event.currentTarget); }}
              onBlur={event => handleBeginnerCodeBlur(target, bodyText, event)}
              onFocus={event => { updateBeginnerCommandHint(target, event.currentTarget); captureBeginnerTextareaView(event.currentTarget); }}
              onClick={event => { updateBeginnerCommandHint(target, event.currentTarget); captureBeginnerTextareaView(event.currentTarget); }}
              onKeyDown={event => handleBeginnerCodeKeyDown(target, event)}
              onKeyUp={event => { updateBeginnerCommandHint(target, event.currentTarget); captureBeginnerTextareaView(event.currentTarget); }}
              onSelect={event => { updateBeginnerCommandHint(target, event.currentTarget); captureBeginnerTextareaView(event.currentTarget); }}
              onScroll={event => {
                const root = event.currentTarget.closest('[data-beginner-editor-root]');
                const lineNumberColumn = root?.querySelector('[data-beginner-line-numbers]');
                const flowGuideColumn = root?.querySelector('[data-beginner-flow-guide]');
                if (lineNumberColumn instanceof HTMLElement) lineNumberColumn.scrollTop = event.currentTarget.scrollTop;
                if (flowGuideColumn instanceof HTMLElement) flowGuideColumn.scrollTop = event.currentTarget.scrollTop;
                captureBeginnerTextareaView(event.currentTarget);
              }}
              onWheel={handleEditorFontWheel}
              style={editorTextStyle}
              className={`relative z-10 w-full resize-none overflow-hidden border-0 bg-transparent px-3 py-2 font-mono font-normal not-italic tracking-normal text-transparent outline-none selection:bg-cyan-500/30 ${
                isDarkMode ? 'caret-cyan-200 placeholder:text-slate-600' : 'caret-cyan-700 placeholder:text-slate-400'
              }`}
            />
          </div>
          {renderBeginnerCompletionPanel(target)}
          {renderBeginnerCommandHintPanel(target)}
        </section>
      );
    };

    const declarationCanvas = renderDeclarationCanvas();
    const memberVisualLineStart = 2;
    const memberCanvas = renderMemberCanvas(memberVisualLineStart);
    const memberVisualLineCount = memberCanvas
      ? Math.max(1, memberRows.length)
      : 0;
    let nextVisualLine = memberVisualLineStart + memberVisualLineCount;
    const processCanvases: React.ReactNode[] = [];

    if (memberCanvas && allProcessTargets.length > 0) {
      processCanvases.push(renderBlankSourceLine(nextVisualLine));
      nextVisualLine += 1;
    }

    allProcessTargets.forEach((target, index) => {
      processCanvases.push(renderProcessHeader(target, nextVisualLine));
      nextVisualLine += 1;

      const parameterCanvas = renderParameterCanvas(target, nextVisualLine);
      if (parameterCanvas) {
        processCanvases.push(parameterCanvas);
        nextVisualLine += Math.max(1, target.method.parameters.length);
      }

      processCanvases.push(renderContinuousCodeBody(target, nextVisualLine));
      nextVisualLine += getProcessBodyLineCount(target);

      if (index < allProcessTargets.length - 1) {
        processCanvases.push(renderBlankSourceLine(nextVisualLine));
        nextVisualLine += 1;
      }
    });

    const contextTarget = beginnerContextMenu
      ? codeTargets.find(target =>
          target.className === beginnerContextMenu.className &&
          target.method.name === beginnerContextMenu.methodName
        ) || activeCanvasTarget
      : undefined;
    const renderContextMenuButton = (
      label: string,
      onClick: () => void,
      icon: React.ReactNode,
      danger = false,
      disabled = false
    ) => (
      <button
        type="button"
        disabled={disabled}
        onClick={event => {
          event.stopPropagation();
          if (disabled) return;
          onClick();
          setBeginnerContextMenu(null);
        }}
        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
          danger
            ? isDarkMode ? 'text-rose-300 hover:bg-rose-500/12' : 'text-rose-700 hover:bg-rose-50'
            : isDarkMode ? 'text-slate-200 hover:bg-[#2a2d36]' : 'text-slate-700 hover:bg-slate-50'
        }`}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
        <span className="truncate">{label}</span>
      </button>
    );
    const renderBeginnerContextMenu = () => {
      if (!beginnerContextMenu) return null;
      const canDeleteTarget = Boolean(contextTarget && contextTarget.method.kind !== 'constructor');
      return (
        <div
          className={`fixed z-50 w-[190px] overflow-hidden rounded border py-1 shadow-2xl ${
            isDarkMode ? 'border-[#343746] bg-[#191b22] shadow-black/40' : 'border-slate-200 bg-white shadow-slate-300/60'
          }`}
          style={{ left: beginnerContextMenu.x, top: beginnerContextMenu.y }}
          onClick={event => event.stopPropagation()}
          onContextMenu={event => event.preventDefault()}
        >
          {renderContextMenuButton('新建子程序', createBeginnerFunction, <Plus className="h-3.5 w-3.5" />)}
          {renderContextMenuButton('新建变量', createBeginnerMember, <Plus className="h-3.5 w-3.5" />)}
          <div className={`my-1 border-t ${canvasBorder}`} />
          {renderContextMenuButton('插入调试输出', () => appendBeginnerSnippet(contextTarget, '调试输出("")'), <Code className="h-3.5 w-3.5" />, false, !contextTarget)}
          {renderContextMenuButton('插入信息框', () => appendBeginnerSnippet(contextTarget, '信息框("提示内容", 64, "提示")'), <Lightbulb className="h-3.5 w-3.5" />, false, !contextTarget)}
          {renderContextMenuButton('插入打开窗口', () => appendBeginnerSnippet(contextTarget, '打开窗口("窗口标题")'), <ExternalLink className="h-3.5 w-3.5" />, false, !contextTarget)}
          {renderContextMenuButton('插入如果结构', () => appendBeginnerSnippet(contextTarget, BEGINNER_IF_SNIPPET), <ListTree className="h-3.5 w-3.5" />, false, !contextTarget)}
          {beginnerModuleCodeCompletions.filter(item => item.kind !== '类型').slice(0, 4).map(item => (
            <React.Fragment key={`module-context-menu-${item.label}`}>
              {renderContextMenuButton(`插入模块命令：${item.label}`, () => appendBeginnerSnippet(contextTarget, item.insertText), <Code className="h-3.5 w-3.5" />, false, !contextTarget)}
            </React.Fragment>
          ))}
          <div className={`my-1 border-t ${canvasBorder}`} />
          {renderContextMenuButton(
            contextTarget?.method.kind === 'event' ? '删除事件处理器' : '删除当前子程序',
            () => deleteBeginnerCodeTarget(contextTarget),
            <Trash2 className="h-3.5 w-3.5" />,
            true,
            !canDeleteTarget
          )}
        </div>
      );
    };
    const canvasItems = [
      declarationCanvas,
      memberCanvas,
      ...processCanvases
    ].filter(Boolean);

    return (
      <div
        ref={beginnerStructureScrollRef}
        data-beginner-structure-scroll
        className={`h-full min-h-0 overflow-auto ${editorCanvasBg}`}
        onContextMenu={event => openBeginnerContextMenu(event, activeCanvasTarget)}
      >
        <datalist id="beginner-member-name-suggestions">
          {memberNameSuggestions.map(item => <option key={item} value={item} />)}
        </datalist>
        <datalist id="beginner-method-name-suggestions">
          {methodNameSuggestions.map(item => <option key={item} value={item} />)}
        </datalist>
        {renderBeginnerContextMenu()}
        <div className="min-w-0">
          {canvasItems.length > 0 ? canvasItems.map((item, index) => <React.Fragment key={index}>{item}</React.Fragment>) : (
            <div className="p-4 text-center text-xs text-slate-500">暂无结构信息</div>
          )}
          {canvasItems.length > 0 && (
            <div aria-hidden="true" className="h-[50vh] min-h-[160px] max-h-[360px]" data-beginner-scroll-tail />
          )}
        </div>
      </div>
    );
  };

  const renderStructureNode = (node: LingCppStructureNode, depth = 0): React.ReactNode => {
    const color =
      node.status === 'missing-control'
        ? 'text-amber-300'
        : node.status === 'missing-source'
          ? 'text-violet-300'
          : node.status === 'bound'
            ? 'text-emerald-300'
            : isDarkMode
              ? 'text-slate-300'
              : 'text-slate-700';
    const kindLabel: Record<string, string> = {
      package: '包',
      use: '使用',
      class: '类',
      member: '成员',
      constructor: '构造',
      destructor: '析构',
      event: '事件',
      designer: '设计'
    };

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => revealLingCppLine(node.line)}
          className={`w-full grid grid-cols-[52px_minmax(90px,1fr)_minmax(80px,1fr)] items-center gap-2 border-b px-2 py-1.5 text-left text-[11px] transition-colors ${
            isDarkMode
              ? 'border-[#2d2d34] hover:bg-[#272733]'
              : 'border-slate-200 hover:bg-slate-50'
          }`}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          title={`${node.name} - 第 ${node.line} 行`}
        >
          <span className={`font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{kindLabel[node.kind] || node.kind}</span>
          <span className={`truncate font-semibold ${color}`}>{node.name}</span>
          <span className={`truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{node.detail || `第 ${node.line} 行`}</span>
        </button>
        {node.children?.map(child => renderStructureNode(child, depth + 1))}
      </div>
    );
  };

  const renderLingCppStructurePanel = () => (
    <aside className={`hidden lg:flex w-[390px] shrink-0 flex-col border-l ${
      isDarkMode ? 'bg-[#18181f] border-[#2d2d34]' : 'bg-white border-slate-200'
    }`}>
      <div className={`h-9 px-3 flex items-center justify-between border-b ${
        isDarkMode ? 'border-[#2d2d34]' : 'border-slate-200'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <ListTree className="w-3.5 h-3.5 text-cyan-400" />
          <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>结构编辑器</span>
          <span className="text-[10px] text-slate-500">{structuredReadingRows.length || readableBlocks.length || lingCppStructure.length}</span>
          {pendingStructureEventCount > 0 && (
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
              isDarkMode ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
            }`}>待生成 {pendingStructureEventCount}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowLingCppStructure(false)}
            className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${
              isDarkMode ? 'text-slate-500 hover:bg-[#2d2d34] hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100'
            }`}
            title="关闭结构表格"
          >
            <PanelRightClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {structureEditError && (
        <div className={`border-b px-3 py-2 text-[11px] ${
          isDarkMode ? 'border-[#2d2d34] bg-rose-950/20 text-rose-200' : 'border-rose-100 bg-rose-50 text-rose-700'
        }`}>
          {structureEditError}
        </div>
      )}
      <div className={`flex items-center justify-between gap-2 border-b px-2 py-1.5 text-[10px] font-semibold ${
        isDarkMode ? 'border-[#2d2d34] text-slate-500' : 'border-slate-200 text-slate-500'
      }`}>
        <span>源码结构</span>
        {pendingStructureEventCount > 0 && <span>待生成事件 {pendingStructureEventCount}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {structuredReadingRows.length > 0 ? (
          renderVolcanoStructuredRows()
        ) : readableBlockGroups.length > 0 ? (
          readableBlockGroups.map(group => (
            <section key={group.key}>
              <div className={`sticky top-0 z-10 border-b px-2 py-1.5 text-[10px] font-semibold ${
                isDarkMode ? 'border-[#2d2d34] bg-[#18181f] text-slate-500' : 'border-slate-200 bg-white text-slate-500'
              }`}>{group.label}</div>
              {group.blocks.map(renderReadableBlockRow)}
            </section>
          ))
        ) : lingCppStructure.length > 0 ? (
          lingCppStructure.map(node => renderStructureNode(node))
        ) : (
          <div className="p-4 text-center text-xs text-slate-500">暂无结构信息</div>
        )}
      </div>
    </aside>
  );

  const renderNativePreviewEditor = () => (
    <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${
      isDarkMode ? 'bg-[#18181f]' : 'bg-white'
    }`}>
      <div className={`border-b px-3 py-2 ${
        isDarkMode ? 'border-[#2d2d34] bg-[#18181f]' : 'border-slate-200 bg-white'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Code className="w-3.5 h-3.5 text-blue-400" />
            <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>原生 C++ 预览</span>
            <span className="text-[10px] text-slate-500">只读生成结果</span>
            {nativePreviewState?.selectedWindowTitle && (
              <span className="text-[10px] text-slate-500 truncate max-w-[240px]">{nativePreviewState.selectedWindowTitle}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void refreshNativePreview()}
              className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[10px] font-semibold transition-colors ${
                isDarkMode
                  ? 'border-[#343442] bg-[#25252b] text-slate-300 hover:bg-[#30303a] hover:text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${isNativePreviewLoading ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <button
              type="button"
              onClick={() => selectedNativePreviewFile && navigator.clipboard.writeText(selectedNativePreviewFile.content)}
              disabled={!selectedNativePreviewFile}
              className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[10px] font-semibold transition-colors disabled:opacity-40 ${
                isDarkMode
                  ? 'border-[#343442] bg-[#25252b] text-slate-300 hover:bg-[#30303a] hover:text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              <Copy className="w-3 h-3" />
              复制
            </button>
            <button
              type="button"
              onClick={() => void openNativeExportDirectory()}
              className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[10px] font-semibold transition-colors ${
                isDarkMode
                  ? 'border-[#343442] bg-[#25252b] text-slate-300 hover:bg-[#30303a] hover:text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              <FolderOpen className="w-3 h-3" />
              打开目录
            </button>
            <button
              type="button"
              onClick={() => void exportNativePreview()}
              className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[10px] font-semibold transition-colors ${
                isDarkMode
                  ? 'border-[#343442] bg-[#25252b] text-slate-300 hover:bg-[#30303a] hover:text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              <ExternalLink className="w-3 h-3" />
              导出工程
            </button>
            <button
              type="button"
              onClick={() => void buildAndRunNativePreview()}
              className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[10px] font-semibold transition-colors ${
                isDarkMode
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <PlayCircle className="w-3 h-3" />
              编译运行
            </button>
            <button
              type="button"
              onClick={() => setShowNativeImportPanel(current => !current)}
              className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[10px] font-semibold transition-colors ${
                isDarkMode
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <FileInput className="w-3 h-3" />
              导入 C++
            </button>
          </div>
        </div>
        {nativePreviewState?.enabledModules?.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {nativePreviewState.enabledModules.map(moduleName => (
              <span
                key={moduleName}
                className={`rounded border px-1.5 py-0.5 text-[9px] ${
                  isDarkMode ? 'border-[#343442] bg-[#121218] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                {moduleName}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`flex min-h-0 flex-1 ${showNativeImportPanel ? 'divide-x' : ''} ${isDarkMode ? 'divide-[#2d2d34]' : 'divide-slate-200'}`}>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className={`flex items-center gap-1 overflow-x-auto border-b px-2 py-1 ${
            isDarkMode ? 'border-[#2d2d34] bg-[#111118]' : 'border-slate-200 bg-slate-50'
          }`}>
            {(nativePreviewState?.files || []).map(file => {
              const selected = file.relativePath === selectedNativePreviewFile?.relativePath;
              return (
                <button
                  key={file.relativePath}
                  type="button"
                  onClick={() => setNativePreviewState(current => current ? { ...current, selectedFilePath: file.relativePath } : current)}
                  className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
                    selected
                      ? isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                      : isDarkMode ? 'text-slate-400 hover:bg-[#1c1c24] hover:text-slate-200' : 'text-slate-500 hover:bg-white hover:text-slate-800'
                  }`}
                >
                  {file.relativePath}
                </button>
              );
            })}
          </div>
          <div className="min-h-0 flex-1">
            {selectedNativePreviewFile ? (
              <MonacoCodeEditor
                sourceCode={selectedNativePreviewFile.content}
                language={selectedNativePreviewFile.language === 'text' ? 'plaintext' : selectedNativePreviewFile.language}
                isDarkMode={isDarkMode}
                readOnly
                onChange={() => {}}
                editorFontSize={editorFontSize}
                onFontSizeChange={onFontSizeChange}
                filePath={selectedNativePreviewFile.relativePath}
                modelIdentity={{
                  workspaceId: textModelWorkspaceId,
                  projectId: textModelProjectId,
                  filePath: `__native_preview__/${activeFile?.path || 'source'}/${selectedNativePreviewFile.relativePath}`
                }}
                modelSurface={`native:${selectedNativePreviewFile.relativePath}`}
                onEditorStateChange={publishEditorState}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">暂无原生预览文件</div>
            )}
          </div>
        </div>

        {showNativeImportPanel && (
          <aside className={`flex w-[420px] max-w-[42%] flex-col overflow-hidden ${
            isDarkMode ? 'bg-[#15151b]' : 'bg-white'
          }`}>
            <div className={`border-b px-3 py-2 ${isDarkMode ? 'border-[#2d2d34] bg-[#18181f]' : 'border-slate-200 bg-slate-50'}`}>
              <div className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>原生 C++ 适配</div>
              <div className="mt-0.5 text-[10px] text-slate-500">识别窗口、控件、事件和功能代码，未识别行保留为 @</div>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <label className="block">
                <span className={`mb-1 block text-[10px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>原生 C++</span>
                <textarea
                  value={nativeImportSource}
                  onChange={event => setNativeImportSource(event.target.value)}
                  placeholder="粘贴 main.cpp 或窗口类代码"
                  className={`min-h-[180px] w-full rounded border px-2 py-2 font-mono text-[11px] outline-none ${
                    isDarkMode ? 'border-[#343442] bg-[#0f1015] text-slate-100 placeholder:text-slate-600' : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </label>
              <label className="mt-3 block">
                <span className={`mb-1 block text-[10px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>导出 manifest（可选）</span>
                <textarea
                  value={nativeImportManifest}
                  onChange={event => setNativeImportManifest(event.target.value)}
                  placeholder="可粘贴 lingbuilder-native-manifest.json 提高识别准确度"
                  className={`min-h-[92px] w-full rounded border px-2 py-2 font-mono text-[11px] outline-none ${
                    isDarkMode ? 'border-[#343442] bg-[#0f1015] text-slate-100 placeholder:text-slate-600' : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </label>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunNativeImport}
                  className={`rounded border px-2 py-1 text-[10px] font-semibold ${
                    isDarkMode ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  转换预览
                </button>
                {nativeImportResult && (
                  <button
                    type="button"
                    onClick={() => applyNativeImportResult(nativeImportResult)}
                    className={`rounded border px-2 py-1 text-[10px] font-semibold ${
                      isDarkMode ? 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20' : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    应用到 .lcpp
                  </button>
                )}
              </div>
              {nativeImportError && <div className="mt-2 text-[10px] text-rose-400">{nativeImportError}</div>}
              {nativeImportResult && (
                <div className="mt-3 space-y-3">
                  <div>
                    <div className={`mb-1 text-[10px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>识别报告</div>
                    <div className={`rounded border p-2 text-[10px] ${
                      isDarkMode ? 'border-[#343442] bg-[#0f1015] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}>
                      {nativeImportResult.report.map(item => <div key={item}>{item}</div>)}
                      {nativeImportResult.diagnostics.map(item => <div key={item} className="text-amber-500">{item}</div>)}
                    </div>
                  </div>
                  <div>
                    <div className={`mb-1 text-[10px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>生成的 .lcpp 预览</div>
                    <textarea
                      readOnly
                      value={nativeImportResult.lcppSource}
                      className={`min-h-[180px] w-full rounded border px-2 py-2 font-mono text-[11px] outline-none ${
                        isDarkMode ? 'border-[#343442] bg-[#0f1015] text-slate-100' : 'border-slate-200 bg-white text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <div className={`border-t ${isDarkMode ? 'border-[#2d2d34] bg-[#111118]' : 'border-slate-200 bg-slate-50'}`}>
        {nativePreviewError && (
          <div className="border-b border-rose-500/20 px-3 py-2 text-[10px] text-rose-400">{nativePreviewError}</div>
        )}
        {nativePreviewState?.diagnostics?.length ? (
          <div className="border-b border-amber-500/20 px-3 py-2">
            <div className="mb-1 text-[10px] font-semibold text-amber-400">生成诊断</div>
            <div className="space-y-1 text-[10px] text-slate-300">
              {nativePreviewState.diagnostics.map(item => <div key={item}>{item}</div>)}
            </div>
          </div>
        ) : null}
        {nativeMappedDiagnostics.length ? (
          <div className="px-3 py-2">
            <div className="mb-1 text-[10px] font-semibold text-rose-400">编译定位</div>
            <div className="space-y-1">
              {nativeMappedDiagnostics.map(item => (
                <div
                  key={item.id}
                  className={`flex flex-wrap items-center gap-2 rounded border px-2 py-1 text-[10px] ${
                    isDarkMode ? 'border-[#343442] bg-[#18181f] text-slate-300' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <span className="font-mono text-rose-400">C++ 第 {item.generatedLine} 行</span>
                  <span className="min-w-0 flex-1">{item.message}</span>
                  {item.sourceLine ? (
                    <>
                      <button
                        type="button"
                        onClick={() => revealNativeSourceLine(item.sourceLine!, false)}
                        className="rounded border border-cyan-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-300"
                      >
                        源码第 {item.sourceLine} 行
                      </button>
                      <button
                        type="button"
                        onClick={() => revealNativeSourceLine(item.sourceLine!, true)}
                        className="rounded border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300"
                      >
                        结构定位
                      </button>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : nativePreviewState?.lastBuildLogs?.length ? (
          <div className="px-3 py-2 text-[10px] text-slate-400">
            {nativePreviewState.lastBuildLogs.slice(-6).map((item, index) => <div key={`${index}-${item}`}>{item}</div>)}
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderLingCppStructureTableEditor = () => (
    <LingCppStructureEditor
      rows={structuredReadingRows}
      structureNodes={lingCppStructure}
      pendingEventCount={pendingStructureEventCount}
      fileLabel={activeFile?.path || activeFile?.name || '当前中文源码'}
      sourceLineCount={Math.max(1, normalizedSourceCode.split(/\r?\n/u).length)}
      activeLine={cursorPosition.line}
      error={structureEditError}
      isDarkMode={isDarkMode}
      onRevealLine={revealLingCppLine}
      onGenerateMissingEvent={quickGenerateMissingDesignerEvent}
    >
      {structuredReadingRows.length > 0 ? renderVolcanoStructuredRows() : (
        <div className="p-4 text-center text-xs text-slate-500">暂无结构信息</div>
      )}
    </LingCppStructureEditor>
  );

  const revealBeginnerTask = (task: BeginnerTask) => {
    if (task.controlId || task.windowId) {
      window.dispatchEvent(new CustomEvent('show-window-designer'));
      setViewType('designer');
      return;
    }
    revealLingCppLine(task.line);
  };

  const applyBeginnerAction = (label: string, action: LingCppActionBlock) => {
    if (!activeBeginnerHandler || !activeFile?.path || !onApplyWorkspaceEdit) return;

    const proposal = createWorkspaceEditFromActionBlock({
      filePath: activeFile.path,
      sourceCode: normalizedSourceCode,
      handlerName: activeBeginnerHandler
    }, action) as unknown as WorkspaceEditProposal;
    const change = proposal.changes[0];
    const previewText = [
      proposal.summary,
      '',
      '将替换：',
      change?.originalText || '(空)',
      '',
      '替换为：',
      change?.newText || '(无变化)',
      '',
      '确认后才会应用到当前 .lcpp。'
    ].join('\n');

    if (!window.confirm(previewText)) return;

    const nextSource = applyWorkspaceEdit(normalizedSourceCode, proposal as any);
    onApplyWorkspaceEdit(proposal, [{
      filePath: activeFile.path,
      sourceCode: nextSource
    }]);
    setSelectedBeginnerHandler(activeBeginnerHandler);
    window.setTimeout(() => setCursorPosition(position => ({ ...position })), 0);
  };

  const createAction = (kind: LingCppActionBlock['kind'], label: string, params: Record<string, string> = {}): LingCppActionBlock => ({
    id: `new-${kind}`,
    kind,
    label,
    description: label,
    params
  });

  const renderBeginnerTaskCard = (task: BeginnerTask) => (
    <div
      key={task.id}
      className={`rounded border p-2.5 ${
        task.severity === 'must-fix'
          ? isDarkMode ? 'border-rose-500/25 bg-rose-950/15' : 'border-rose-200 bg-rose-50'
          : task.severity === 'suggestion'
            ? isDarkMode ? 'border-amber-500/25 bg-amber-950/15' : 'border-amber-200 bg-amber-50'
            : isDarkMode ? 'border-slate-700 bg-[#202027]' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-[12px] font-semibold leading-snug ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{task.title}</div>
          <div className={`mt-1 text-[11px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{task.description}</div>
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${
          task.status === 'ready'
            ? 'bg-emerald-500/15 text-emerald-500'
            : 'bg-slate-500/15 text-slate-400'
        }`}>{task.status === 'ready' ? '可做' : '待做'}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (task.handlerName) setSelectedBeginnerHandler(task.handlerName);
            revealBeginnerTask(task);
          }}
          className={`rounded border px-2 py-1 text-[10px] font-semibold ${
            isDarkMode ? 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20' : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
        >
          {task.actionLabel}
        </button>
        {task.handlerName && (
          <button
            type="button"
            onClick={() => {
              setSelectedBeginnerHandler(task.handlerName || null);
              applyBeginnerAction('生成提示框事件', createAction('message-box', '提示框', {
                text: `${task.controlName || '控件'} 已触发`,
                title: '提示'
              }));
            }}
            className={`rounded border px-2 py-1 text-[10px] font-semibold ${
              isDarkMode ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            生成提示框
          </button>
        )}
        {task.canIgnore && (
          <button
            type="button"
            onClick={() => onIgnoreBeginnerTask?.(task.id)}
            className={`rounded border px-2 py-1 text-[10px] ${
              isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
          >
            忽略
          </button>
        )}
      </div>
    </div>
  );

  const renderBeginnerStructuredReadingSection = () => {
    return (
      <section className={`overflow-hidden rounded border ${
        isDarkMode ? 'border-cyan-500/25 bg-cyan-950/10' : 'border-cyan-200 bg-cyan-50/60'
      }`}>
        <div className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${
          isDarkMode ? 'border-cyan-500/15' : 'border-cyan-100'
        }`}>
          <div className="flex items-center gap-1.5">
            <ListTree className="w-3.5 h-3.5 text-cyan-400" />
            <span className={`text-[12px] font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>结构编辑器</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              isDarkMode ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
            }`}>{structuredReadingRows.length}</span>
            {pendingStructureEventCount > 0 && (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                isDarkMode ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
              }`}>待生成 {pendingStructureEventCount}</span>
            )}
          </div>
        </div>
        {structureEditError && (
          <div className={`border-b px-3 py-2 text-[11px] ${
            isDarkMode ? 'border-cyan-500/15 bg-rose-950/20 text-rose-200' : 'border-rose-100 bg-rose-50 text-rose-700'
          }`}>
            {structureEditError}
          </div>
        )}
        <div className="max-h-[32rem] overflow-auto">
          {structuredReadingRows.length > 0 ? renderStructuredReadingRows() : (
            <div className="rounded border border-dashed border-slate-500/40 p-3 text-center text-[11px] text-slate-500">
              当前文件还没有可展示的结构。
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderBeginnerPanel = () => (
    <aside className={`${
      showBeginnerTools
        ? 'fixed inset-y-0 right-0 z-50 flex w-[min(360px,calc(100vw-32px))] shadow-2xl'
        : 'hidden'
    } xl:static xl:z-auto xl:flex xl:w-[360px] xl:shadow-none shrink-0 flex-col border-l ${
      isDarkMode ? 'bg-[#18181f] border-[#2d2d34]' : 'bg-white border-slate-200'
    }`}>
      <div className={`h-9 px-3 flex items-center justify-between border-b ${
        isDarkMode ? 'border-[#2d2d34]' : 'border-slate-200'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
          <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>新手工作台</span>
          <span className="text-[10px] text-slate-500">{visibleBeginnerTasks.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onExperienceModeChange?.('professional')}
            className={`rounded border px-2 py-1 text-[10px] font-semibold ${
              isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            专业模式
          </button>
          <button
            type="button"
            onClick={() => setShowBeginnerTools(false)}
            aria-label="关闭新手工具"
            className={`inline-flex h-6 w-6 items-center justify-center rounded xl:hidden ${
              isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 space-y-3">
        <section className={`rounded border p-3 ${
          isDarkMode ? 'border-[#2d2d34] bg-[#202027]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
              <span className={`text-[12px] font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>待处理任务</span>
            </div>
            {visibleBeginnerTasks.length > 0 && (
              <button
                type="button"
                onClick={onOpenProblemsPanel}
                className="text-[10px] font-semibold text-blue-500 hover:underline"
              >
                打开问题面板
              </button>
            )}
          </div>
          <div className="space-y-2">
            {visibleBeginnerTasks.length > 0
              ? visibleBeginnerTasks.slice(0, 4).map(renderBeginnerTaskCard)
              : <div className="py-4 text-center text-[11px] text-slate-500">当前没有必须处理的新手任务。</div>}
          </div>
        </section>

        <section className={`rounded border p-3 ${
          isDarkMode ? 'border-[#2d2d34] bg-[#202027]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="mb-2 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
            <span className={`text-[12px] font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>当前代码解释</span>
          </div>
          <div className={`text-[12px] font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{codeExplanation?.title}</div>
          <p className={`mt-1 text-[11px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{codeExplanation?.body}</p>
          {codeExplanation?.example && (
            <pre className={`mt-2 overflow-auto rounded border p-2 text-[10.5px] leading-relaxed ${
              isDarkMode ? 'border-slate-700 bg-black/20 text-emerald-300' : 'border-slate-200 bg-white text-emerald-700'
            }`}>{codeExplanation.example}</pre>
          )}
          {codeExplanation?.commonMistake && (
            <p className="mt-2 text-[11px] text-amber-500">{codeExplanation.commonMistake}</p>
          )}
        </section>

        <section className={`rounded border p-3 ${
          isDarkMode ? 'border-[#2d2d34] bg-[#202027]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-violet-400" />
              <span className={`text-[12px] font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>事件动作块</span>
            </div>
            <span className="truncate text-[10px] text-slate-500">{activeBeginnerHandler || '未选择事件'}</span>
          </div>
          <div className="space-y-1.5">
            {actionBlocks.length > 0 ? actionBlocks.map(block => (
              <div key={block.id} className={`rounded border px-2 py-1.5 ${
                block.readonly
                  ? isDarkMode ? 'border-slate-700 bg-slate-900/20 text-slate-500' : 'border-slate-200 bg-white text-slate-500'
                  : isDarkMode ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}>
                <div className="text-[11px] font-semibold">{block.label}</div>
                <div className="mt-0.5 text-[10px] opacity-80">{summarizeEventPreview([block])[0]}</div>
              </div>
            )) : (
              <div className="rounded border border-dashed border-slate-600/50 p-2 text-[11px] text-slate-500">选择或生成一个事件后，这里会显示可视化动作。</div>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => applyBeginnerAction('提示框', createAction('message-box', '提示框', { text: '操作成功', title: '提示' }))} className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-400">提示框</button>
            <button type="button" onClick={() => applyBeginnerAction('调试输出', createAction('debug-output', '调试输出', { text: '事件已触发' }))} className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">调试输出</button>
            <button type="button" onClick={() => applyBeginnerAction('结束程序', createAction('exit-program', '结束程序'))} className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-400">结束程序</button>
            <button type="button" onClick={() => applyBeginnerAction('打开窗口', createAction('open-window', '打开窗口', { window: '新窗口' }))} className="rounded border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-400">打开窗口</button>
          </div>
          <div className="mt-2 rounded border border-slate-700/50 p-2 text-[10.5px] text-slate-500">
            <div className="mb-1 flex items-center gap-1 text-slate-400"><PlayCircle className="h-3 w-3" />预览此事件</div>
            {summarizeEventPreview(actionBlocks).map((line, index) => <div key={index}>{line}</div>)}
          </div>
        </section>

        <section className={`rounded border p-3 ${
          isDarkMode ? 'border-[#2d2d34] bg-[#202027]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="mb-2 text-[12px] font-semibold">5 步学习路径</div>
          <div className="space-y-1.5">
            {learningPath.steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (step.target === 'designer') setViewType('designer');
                  if (step.target === 'tasks') onOpenProblemsPanel?.();
                  if (step.target === 'run') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5' }));
                }}
                className={`w-full rounded border px-2 py-1.5 text-left text-[11px] ${
                  step.completed
                    ? isDarkMode ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="font-semibold">{index + 1}. {step.title}</span>
                <span className="ml-2 opacity-75">{step.description}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );

  const renderBeginnerSummaryStrip = () => {
    if (activeFile?.language !== 'lingcpp' || editorExperienceMode !== 'beginner') return null;
    const taskCount = visibleBeginnerTasks.length;
    return (
      <div className={`xl:hidden border-b px-3 py-2 ${
        isDarkMode ? 'border-[#2d2d34] bg-[#18181f]' : 'border-slate-200 bg-white'
      }`}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <button
            type="button"
            onClick={onOpenProblemsPanel}
            className={`rounded border px-2.5 py-2 text-left ${
              isDarkMode ? 'border-amber-500/20 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              <ClipboardList className="h-3.5 w-3.5" />
              <span>{taskCount > 0 ? `还有 ${taskCount} 个事件待处理` : '暂无待处理事件'}</span>
            </div>
            <div className="mt-1 truncate text-[10px] opacity-80">{visibleBeginnerTasks[0]?.description || '可以继续编写窗口逻辑或运行程序。'}</div>
          </button>
          <button
            type="button"
            onClick={() => revealLingCppLine(codeExplanation?.line || cursorPosition.line)}
            className={`rounded border px-2.5 py-2 text-left ${
              isDarkMode ? 'border-blue-500/20 bg-blue-500/10 text-blue-200' : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              <Lightbulb className="h-3.5 w-3.5" />
              <span>当前代码：{codeExplanation?.title || '普通代码'}</span>
            </div>
            <div className="mt-1 truncate text-[10px] opacity-80">{codeExplanation?.body}</div>
          </button>
          <button
            type="button"
            onClick={() => setShowBeginnerTools(true)}
            className={`rounded border px-2.5 py-2 text-left ${
              isDarkMode ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              <Wand2 className="h-3.5 w-3.5" />
              <span>新手工具</span>
            </div>
            <div className="mt-1 truncate text-[10px] opacity-80">事件动作、代码解释与 5 步学习路径</div>
          </button>
        </div>
      </div>
    );
  };

  const renderActiveLineStructureBar = () => {
    if (activeFile?.language !== 'lingcpp' || !activeStructuredRow) return null;
    const row = activeStructuredRow;
    const titleMap: Record<LingCppStructuredReadingRow['group'], string> = {
      declaration: '源码声明',
      package: '包声明',
      class: '类声明',
      member: '成员声明',
      method: '方法声明',
      constructor: '构造函数',
      event: '事件处理器',
      parameter: '参数',
      note: '备注'
    };
    const isMember = row.group === 'member';
    const isControlMember = isControlMemberRow(row);
    const isDesignerLink = isMember && /关联设计文件/u.test(row.name);
    const memberBadge = isDesignerLink ? '设计器关联' : isControlMember ? '控件成员' : '类成员变量';

    const renderField = (label: string, value?: string) => value ? (
      <span className={`inline-flex min-w-0 items-center overflow-hidden rounded border ${
        isDarkMode ? 'border-[#343442] bg-[#15151b]' : 'border-slate-200 bg-white'
      }`}>
        <span className={`shrink-0 border-r px-2 py-1 text-[10px] font-semibold ${
          isDarkMode ? 'border-[#343442] text-slate-500' : 'border-slate-200 text-slate-500'
        }`}>{label}</span>
        <span className={`truncate px-2 py-1 text-[11px] font-semibold ${
          isDarkMode ? 'text-slate-200' : 'text-slate-800'
        }`}>{value}</span>
      </span>
    ) : null;

    return (
      <div className={`flex min-h-[34px] shrink-0 items-center justify-between gap-2 border-b px-3 py-1.5 ${
        isDarkMode ? 'border-[#2d2d34] bg-[#17171d]' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={`rounded px-2 py-1 text-[10px] font-semibold ${
            isMember
              ? isControlMember
                ? isDarkMode ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700'
                : isDarkMode ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700'
              : isDarkMode ? 'bg-slate-700/60 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}>{isMember ? memberBadge : titleMap[row.group]}</span>
          {isMember && renderField('所属', row.className)}
          {renderField('类型', row.type)}
          {renderField('名称', row.name)}
          {isMember && renderField('初始值', row.initialValue)}
          {!isMember && row.value && renderField('值', row.value)}
          <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>第 {row.line} 行</span>
        </div>
      </div>
    );
  };

  const renderLingCppClassStructureStrip = () => {
    if (activeFile?.language !== 'lingcpp' || activeStructuredRow || !primaryLingCppClass) return null;
    const previewMembers = memberStructuredRows.slice(0, 5);
    const extraMemberCount = Math.max(0, memberStructuredRows.length - previewMembers.length);

    return (
      <div className={`flex min-h-[36px] shrink-0 items-center gap-2 border-b px-3 py-1.5 ${
        isDarkMode ? 'border-[#2d2d34] bg-[#16161c]' : 'border-slate-200 bg-white'
      }`}>
        <div className="flex min-w-0 shrink-0 items-center gap-1.5">
          <span className={`rounded px-2 py-1 text-[10px] font-semibold ${
            isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
          }`}>类</span>
          <button
            type="button"
            onClick={() => revealLingCppLine(primaryLingCppClass.line)}
            className={`max-w-[160px] truncate text-[11px] font-semibold hover:underline ${
              isDarkMode ? 'text-slate-200' : 'text-slate-800'
            }`}
            title={`跳转到类：${primaryLingCppClass.name}`}
          >
            {primaryLingCppClass.name}
          </button>
          <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>成员 {memberStructuredRows.length}</span>
          <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>事件 {eventHandlerStructuredRows.length}</span>
          {pendingStructureEventCount > 0 && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              isDarkMode ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
            }`}>待生成 {pendingStructureEventCount}</span>
          )}
        </div>
        {previewMembers.length > 0 && (
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {previewMembers.map(row => (
              <button
                key={row.id}
                type="button"
                onClick={() => revealStructuredRow(row)}
                className={`inline-flex min-w-0 shrink items-center gap-1 rounded border px-1.5 py-1 text-[10px] transition-colors ${
                  isDarkMode
                    ? 'border-[#343442] bg-[#1d1d24] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-cyan-200 hover:text-cyan-700'
                }`}
                title={`${row.type || '类型'} ${row.name} - 第 ${row.line} 行`}
              >
                <span className={`shrink-0 ${isControlMemberRow(row) ? 'text-blue-400' : isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  {isControlMemberRow(row) ? '控件' : '成员'}
                </span>
                <span className="truncate">{row.name}</span>
              </button>
            ))}
            {extraMemberCount > 0 && (
              <span className={`shrink-0 text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>+{extraMemberCount}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const beginnerTableScale = Math.max(0.85, editorFontSize / 13);
  const beginnerTableFontSize = Math.max(11, Math.round(editorFontSize * 0.88));
  const beginnerTableHeadFontSize = Math.max(10, Math.round(beginnerTableFontSize * 0.9));
  const beginnerProcedureFontSize = Math.max(beginnerTableFontSize + 1, Math.round(editorFontSize * 0.96));
  const beginnerTableLineHeight = Math.max(16, Math.round(beginnerTableFontSize * 1.45));
  const beginnerTableRowHeight = Math.max(24, beginnerTableLineHeight + 9);
  const beginnerInputHeight = Math.max(24, beginnerTableRowHeight - 2);
  const beginnerProcedureInputHeight = Math.max(28, beginnerTableRowHeight);
  const beginnerBlankRowHeight = Math.max(28, Math.round(editorFontSize * 2.15));
  const beginnerSwitchHeight = Math.max(16, Math.round(beginnerInputHeight * 0.62));
  const beginnerSwitchWidth = Math.round(beginnerSwitchHeight * 1.75);
  const beginnerSwitchKnobSize = Math.max(12, beginnerSwitchHeight - 4);
  const beginnerSwitchKnobOffset = Math.max(2, Math.round((beginnerSwitchHeight - beginnerSwitchKnobSize) / 2));
  const beginnerScaleStyle = {
    '--beginner-table-scale': beginnerTableScale.toFixed(3),
    '--beginner-table-font-size': `${beginnerTableFontSize}px`,
    '--beginner-table-head-font-size': `${beginnerTableHeadFontSize}px`,
    '--beginner-procedure-font-size': `${beginnerProcedureFontSize}px`,
    '--beginner-table-line-height': `${beginnerTableLineHeight}px`,
    '--beginner-table-row-height': `${beginnerTableRowHeight}px`,
    '--beginner-input-height': `${beginnerInputHeight}px`,
    '--beginner-procedure-input-height': `${beginnerProcedureInputHeight}px`,
    '--beginner-blank-row-height': `${beginnerBlankRowHeight}px`,
    '--beginner-gutter-width': `${Math.max(54, Math.round(editorFontSize * 4.3))}px`,
    '--beginner-flow-width': `${Math.max(22, Math.round(editorFontSize * 1.75))}px`,
    '--beginner-table-cell-x': `${Math.max(8, Math.round(beginnerTableFontSize * 0.75))}px`,
    '--beginner-switch-height': `${beginnerSwitchHeight}px`,
    '--beginner-switch-width': `${beginnerSwitchWidth}px`,
    '--beginner-switch-knob-size': `${beginnerSwitchKnobSize}px`,
    '--beginner-switch-knob-offset': `${beginnerSwitchKnobOffset}px`,
    '--beginner-switch-knob-translate': `${beginnerSwitchWidth - beginnerSwitchKnobSize - beginnerSwitchKnobOffset}px`
  } as React.CSSProperties;

  return (
    <div id="diff-window-host" style={beginnerScaleStyle} className={`flex-1 flex flex-col overflow-hidden ${
      isDarkMode ? 'bg-[#141418]' : 'bg-white'
    }`}>
      {/* File Tabs Bar */}
      <div className={`flex px-2 pt-1 select-none items-center justify-between border-b ${
        isDarkMode ? 'bg-[#181820] border-[#2d2d34]' : 'bg-slate-100 border-slate-200'
      }`}>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto scrollbar-none">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setViewType('designer')}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') setViewType('designer');
            }}
            className={getEditorTabClassName(viewType === 'designer', isDarkMode)}
            title={`打开窗口设计器：${designerTabLabel}`}
            aria-label={`打开窗口设计器：${designerTabLabel}`}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-amber-500" />
            <span className="whitespace-nowrap">{designerTabLabel}</span>
          </div>

          {openTabs.map(tabPath => {
            const fileName = tabPath.split('/').pop() || tabPath;
            const isActive = viewType === 'code' && tabPath === activeTabPath;
            const file = allFiles.find(f => f.path === tabPath);
            if (!file) return null;

            return (
              <div
                key={tabPath}
                role="button"
                tabIndex={0}
                data-editor-tab-path={tabPath}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`打开文件标签：${fileName}`}
                onClick={() => onSelectTab(file)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') void onSelectTab(file);
                }}
                className={getEditorTabClassName(isActive, isDarkMode)}
              >
                <FileIcon fileName={fileName} isDarkMode={isDarkMode} />
                <span className="max-w-32 truncate whitespace-nowrap" title={fileName}>{fileName}</span>
                <button
                  onClick={(e) => onCloseTab(tabPath, e)}
                  aria-label={`关闭文件标签：${fileName}`}
                  className="w-3.5 h-3.5 shrink-0 rounded-full hover:bg-slate-400/20 flex items-center justify-center text-slate-500 hover:text-red-500 opacity-60 group-hover:opacity-100"
                >
                  <X className="w-2 h-2" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Top-Right Quick Toggle Button between Code/Designer */}
        <div className="flex shrink-0 items-center gap-2 pr-2">
          {activeFile?.name?.endsWith('.lcpp') && (
            viewType === 'designer' ? (
              <button
                onClick={() => setViewType('code')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                  isDarkMode
                    ? 'bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                }`}
                title="查看中文事件代码 (F7)"
              >
                <Code className="w-3 h-3 text-blue-500" />
                <span>查看代码 (Code)</span>
              </button>
            ) : (
              <button
                onClick={() => setViewType('designer')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                  isDarkMode
                    ? 'bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-500/30'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                }`}
                title="查看可视化设计器 (Shift+F7)"
              >
                <LayoutGrid className="w-3 h-3 text-amber-500" />
                <span>查看设计器 (Designer)</span>
              </button>
            )
          )}
        </div>
      </div>


      {/* Statistics Banner */}
      <div className={`px-4 py-1.5 border-b flex flex-wrap items-center justify-between gap-2 text-xs font-mono shrink-0 select-none ${
        isDarkMode ? 'bg-[#18181c]/50 border-[#2d2d34] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-650'
      }`}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          <span>对比统计：</span>
          <span className="text-emerald-500 font-bold">+{diffResult.stats.added} 插入</span>
          <span className="text-rose-500 font-bold">-{diffResult.stats.deleted} 移除</span>
          <span className="text-amber-500 font-bold">~{diffResult.stats.modified} 修改</span>
          <span>({diffResult.stats.unchanged} 行未改动)</span>
        </div>
        {viewType === 'code' && (
          <DiffViewModeSelector
            value={viewMode}
            onChange={mode => onDiffViewModeChange ? onDiffViewModeChange(mode) : setViewMode(mode)}
            isDarkMode={isDarkMode}
            hasDifferences={diffResult.stats.added + diffResult.stats.deleted + diffResult.stats.modified > 0}
          />
        )}
      </div>

      {/* Main Comparative Frame */}
      {viewType === 'designer' ? (
        <WpfDesigner
          key={`designer:${textModelProjectId}`}
          projectId={textModelProjectId}
          isDarkMode={isDarkMode}
          activeFile={activeFile}
        />
      ) : (
        <div className={`flex-1 flex overflow-hidden ${style.bg} ${style.text}`}>
          {viewMode === 'chinese' ? (
          // ================= CHINESE SOURCE EDITOR =================
          <div className="flex-1 flex flex-col min-w-0">
            <div className={`h-9 px-3 flex items-center justify-between gap-3 border-b shrink-0 ${
              isDarkMode ? 'bg-[#19191f] border-[#2d2d34]' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0"></span>
                <span className={`${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'} text-[11px] font-semibold whitespace-nowrap`}>
                  {isLingCppBeginnerStructureMode ? '中文结构编辑器' : '中文代码主编辑器'}
                </span>
                <span className={`text-[10px] truncate font-mono ${
                  isDarkMode ? 'text-slate-500' : 'text-slate-500'
                }`}>
                  {activeFile?.path || '未命名中文源码'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                  activeFile?.isModified || activeFile?.formatModified
                    ? isDarkMode
                      ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                    : isDarkMode
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}>
                  {activeFile?.isModified || activeFile?.formatModified ? '已修改' : '已同步'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {activeFile?.language === 'lingcpp' && (
                  <div className={`flex rounded border p-0.5 ${
                    isDarkMode ? 'bg-[#25252b] border-[#343442]' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <button
                      type="button"
                      onClick={() => onExperienceModeChange?.('beginner')}
                      aria-pressed={editorExperienceMode === 'beginner'}
                      aria-label="切换到新手编辑模式"
                      className={`px-2 py-0.5 text-[10px] rounded font-semibold ${
                        editorExperienceMode === 'beginner'
                          ? isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                          : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      新手
                    </button>
                    <button
                      type="button"
                      onClick={() => onExperienceModeChange?.('professional')}
                      aria-pressed={editorExperienceMode === 'professional'}
                      aria-label="切换到专业编辑模式"
                      className={`px-2 py-0.5 text-[10px] rounded font-semibold ${
                        editorExperienceMode === 'professional'
                          ? isDarkMode ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
                          : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      专业
                    </button>
                    <button
                      type="button"
                      onClick={() => onExperienceModeChange?.('native')}
                      aria-pressed={editorExperienceMode === 'native'}
                      aria-label="切换到原生 C++ 预览模式"
                      className={`px-2 py-0.5 text-[10px] rounded font-semibold ${
                        editorExperienceMode === 'native'
                          ? isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                          : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      原生
                    </button>
                  </div>
                )}
              </div>
            </div>

            {!isLingCppBeginnerStructureMode && !isLingCppNativeMode && (
              <div className={`min-h-9 px-3 py-1.5 border-b shrink-0 flex items-center justify-between gap-3 ${
                isDarkMode ? 'bg-[#15151b] border-[#2d2d34]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex min-w-0 items-center gap-2">
                  <ListTree className={`w-3.5 h-3.5 shrink-0 ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`} />
                  <span className={`text-[10px] font-semibold whitespace-nowrap ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    {activeFile?.language === 'lingcpp' ? '专业源码工具' : '源码工具'}
                  </span>
                  <span className={`hidden min-w-0 truncate text-[10px] md:block ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    {activeFile?.language === 'lingcpp' ? '整理格式、插入中文结构和常用语句' : '快速插入常用代码片段'}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-x-auto">
                {activeFile?.language === 'lingcpp' && !isLingCppBeginnerStructureMode && !isLingCppNativeMode && (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('lingcpp-format-document', { detail: { filePath: activeFile?.path } }))}
                    title="整理成易读格式"
                    className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                      isDarkMode
                        ? 'bg-[#25252b] border-[#343442] text-slate-300 hover:text-white hover:bg-[#30303a]'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                    }`}
                  >
                    <ListTree className="w-3 h-3" />
                    <span>整理</span>
                  </button>
                )}
                {!isLingCppBeginnerStructureMode && !isLingCppNativeMode && quickChineseSnippets.map((snippet, index) => (
                  <button
                    key={`${snippet.label}:${snippet.text}:${index}`}
                    type="button"
                    onClick={() => insertSourceSnippet(snippet.text)}
                    disabled={!onUpdateSourceContent}
                    title={`插入 ${snippet.label}`}
                    className={`h-7 rounded border px-2 text-[10px] font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition-colors whitespace-nowrap ${
                      isDarkMode
                        ? 'bg-[#25252b] border-[#343442] text-slate-300 hover:text-white hover:bg-[#30303a]'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                    }`}
                  >
                    {snippet.label}
                  </button>
                ))}
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 flex overflow-hidden">
              {isLingCppBeginnerStructureMode ? (
                <>
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    {renderBeginnerSummaryStrip()}
                    {renderLingCppStructureTableEditor()}
                  </div>
                  {renderBeginnerPanel()}
                </>
              ) : isLingCppNativeMode ? (
                renderNativePreviewEditor()
              ) : (
                <MonacoCodeEditor
                  ref={monacoEditorRef}
                  sourceCode={normalizedSourceCode}
                  language={activeFile?.language || 'plaintext'}
                  isDarkMode={isDarkMode}
                  readOnly={!onUpdateSourceContent}
                  onChange={updateSourceCode}
                  focusHandlerName={pendingHandlerFocus?.handlerName}
                  onFocusHandled={() => setPendingHandlerFocus(null)}
                  editorFontSize={editorFontSize}
                  onFontSizeChange={onFontSizeChange}
                  filePath={activeFile?.path}
                  designerProject={designerProject}
                  moduleContext={moduleContext}
                  onRevealDesignerBinding={() => setViewType('designer')}
                  onCursorPositionChange={setCursorPosition}
                  readingMode={activeFile?.language === 'lingcpp' ? readingMode : 'off'}
                  focusedBlockId={focusedReadableBlockId}
                  onRevealReadableBlock={setFocusedReadableBlockId}
                  modelIdentity={sourceModelIdentity}
                  modelSurface="professional"
                  onEditorStateChange={publishProfessionalEditorState}
                />
              )}
            </div>
          </div>
        ) : viewMode === 'split' ? (
          // ================= SPLIT VIEW (Side-by-side) =================
          <div className={`flex-1 flex divide-x overflow-hidden ${isDarkMode ? 'divide-[#2d2d34]' : 'divide-slate-200'}`}>
            {/* Left Pane - Original C++ Code */}
            <div
              ref={leftScrollRef}
              className="flex-1 overflow-auto scrollbar-thin select-text"
            >
              <div className="min-w-max p-4 pr-10">
                <div className="text-[10px] font-bold text-slate-500 mb-2 uppercase select-none flex items-center gap-1">
                  <span className="w-2 h-2 rounded bg-rose-500"></span>
                  <span>原代码 (C++)</span>
                </div>
                {diffResult.originalLines.map((line, idx) => {
                  if (foldedIndices.has(idx)) return null;

                  if (foldingHeaderMap.has(idx)) {
                    const fold = foldingHeaderMap.get(idx)!;
                    return (
                      <div
                        key={`fold-${idx}`}
                        onClick={() => setShowFolds(false)}
                        className={`py-1 px-4 my-1.5 text-xs font-mono rounded border border-dashed transition-all cursor-pointer select-none flex items-center gap-2 justify-center w-full ${
                          isDarkMode
                            ? 'bg-[#252530] text-slate-400 border-slate-700 hover:bg-[#2c2c3a]'
                            : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                        <span>已折叠 {fold.count} 行未修改代码（点击展开）</span>
                      </div>
                    );
                  }

                  const hasDiff = line.type !== 'unchanged';
                  const isHovered = hoveredLine === idx;

                  return (
                    <div
                      key={`orig-${idx}`}
                      id={`diff-line-${idx}`}
                      onMouseEnter={() => setHoveredLine(idx)}
                      onMouseLeave={() => setHoveredLine(null)}
                      className={`flex group items-stretch transition-colors h-6 ${
                        line.type === 'deleted'
                          ? style.deleted
                          : line.type === 'modified'
                          ? isDarkMode
                            ? 'bg-rose-500/5 text-slate-300 border-l-4 border-rose-850'
                            : 'bg-rose-50 text-slate-700 border-l-4 border-rose-600'
                          : isDarkMode ? 'hover:bg-slate-800/10' : 'hover:bg-slate-100/45'
                      }`}
                    >
                      <span className="w-12 shrink-0 text-right pr-3 select-none text-[10px] text-slate-550 font-mono self-center">
                        {line.originalLineNumber || ''}
                      </span>
                      <div className="flex-1 font-mono text-xs whitespace-pre self-center pl-2">
                        {renderLineContent(line, style)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Pane - Translated C++ Code */}
            <div
              ref={rightScrollRef}
              className="flex-1 overflow-auto scrollbar-thin select-text"
            >
              <div className="min-w-max p-4 pr-10">
                <div className="text-[10px] font-bold text-slate-500 mb-2 uppercase select-none flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-emerald-500"></span>
                    <span>本地化映射代码 (中文)</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-normal ${
                    isDarkMode ? 'bg-[#1e1e24] text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>双击进行手动微调</span>
                </div>
                {diffResult.translatedLines.map((line, idx) => {
                  if (foldedIndices.has(idx)) return null;

                  if (foldingHeaderMap.has(idx)) {
                    return <div key={`fold-r-${idx}`} className="h-9 my-1.5"></div>; // Invisible height sync
                  }

                  const mappedString = getStringForLine(line.lineNumber);
                  const isHovered = hoveredLine === idx;

                  return (
                    <div
                      key={`tran-${idx}`}
                      onMouseEnter={() => setHoveredLine(idx)}
                      onMouseLeave={() => setHoveredLine(null)}
                      onDoubleClick={() => handleStartEdit(line.lineNumber)}
                      className={`flex group items-stretch transition-colors h-6 relative ${
                        line.type === 'added'
                          ? style.added
                          : line.type === 'modified'
                          ? style.modified
                          : isDarkMode ? 'hover:bg-slate-800/10' : 'hover:bg-slate-100/45'
                      }`}
                    >
                      <span className="w-12 shrink-0 text-right pr-3 select-none text-[10px] text-slate-550 font-mono self-center">
                        {line.translatedLineNumber || ''}
                      </span>

                      {/* Display or Edit Literal inline */}
                      {editingStringId && mappedString?.id === editingStringId ? (
                        <div className="flex-1 flex items-center gap-1 px-1 py-0.5 z-10 self-center">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveEdit(mappedString.id);
                              if (e.key === 'Escape') setEditingStringId(null);
                            }}
                            className={`border text-xs rounded px-1.5 py-0.5 font-mono flex-1 focus:outline-none ${
                              isDarkMode
                                ? 'bg-[#2a2a35] border-blue-500 text-white'
                                : 'bg-white border-blue-650 text-slate-900 shadow-sm'
                            }`}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(mappedString.id)}
                            className="p-1 rounded bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1 font-mono text-xs whitespace-pre self-center pl-2">
                          {renderLineContent(line, style)}
                        </div>
                      )}

                      {/* Floating hover assist option card */}
                      {isHovered && mappedString && !editingStringId && (
                        <div className={`absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 shadow-lg border rounded px-1.5 py-0.5 z-20 select-none ${
                          isDarkMode ? 'bg-[#1e1e24] border-[#2d2d34]' : 'bg-white border-slate-200 shadow-md'
                        }`}>
                          <button
                            onClick={() => handleStartEdit(line.lineNumber)}
                            className="text-[10px] text-blue-500 hover:text-blue-700 font-semibold px-1 py-0.5 hover:bg-slate-100 rounded transition-colors"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => onResetTranslation(mappedString.id)}
                            className="text-[10px] text-slate-500 hover:text-slate-800 font-semibold px-1 py-0.5 hover:bg-slate-100 rounded transition-colors"
                          >
                            还原
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          // ================= UNIFIED VIEW (Inline) =================
          <div ref={unifiedScrollRef} className="flex-1 overflow-auto scrollbar-thin select-text p-4">
            <div className="min-w-max pr-10">
              {diffResult.originalLines.map((line, idx) => {
                if (foldedIndices.has(idx)) return null;

                if (foldingHeaderMap.has(idx)) {
                  const fold = foldingHeaderMap.get(idx)!;
                  return (
                    <div
                      key={`fold-u-${idx}`}
                      onClick={() => setShowFolds(false)}
                      className={`py-1.5 px-4 my-2 text-xs font-mono rounded border border-dashed transition-all cursor-pointer select-none flex items-center gap-2 justify-center w-full ${
                        isDarkMode
                          ? 'bg-[#252530] text-slate-400 border-slate-700 hover:bg-[#2c2c3a]'
                          : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      <span>已折叠 {fold.count} 行未修改代码（点击展开）</span>
                    </div>
                  );
                }

                const tranLine = diffResult.translatedLines[idx];
                const isModified = line.type === 'modified';

                if (isModified) {
                  // Render deletion (original) then addition (translated) consecutively
                  return (
                    <div key={`mod-${idx}`} id={`diff-line-${idx}`} className="flex flex-col">
                      {/* Original Line (Red) */}
                      <div className={`flex items-stretch h-6 ${style.deleted}`}>
                        <span className="w-12 shrink-0 text-right pr-3 select-none text-[10px] text-rose-500/80 font-mono self-center">
                          {line.originalLineNumber}
                        </span>
                        <span className="w-12 shrink-0 text-right pr-3 select-none text-[10px] text-slate-600 font-mono self-center">
                          -
                        </span>
                        <div className="flex-1 font-mono text-xs whitespace-pre self-center pl-2">
                          {renderLineContent(line, style)}
                        </div>
                      </div>
                      {/* Translated Line (Green) */}
                      <div className={`flex items-stretch h-6 ${style.added}`}>
                        <span className="w-12 shrink-0 text-right pr-3 select-none text-[10px] text-slate-600 font-mono self-center">
                          -
                        </span>
                        <span className="w-12 shrink-0 text-right pr-3 select-none text-[10px] text-emerald-500/80 font-mono self-center">
                          {tranLine?.translatedLineNumber}
                        </span>
                        <div className="flex-1 font-mono text-xs whitespace-pre self-center pl-2">
                          {renderLineContent(tranLine, style)}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Render Added only, Deleted only, or Unchanged
                const lineStyle =
                  line.type === 'deleted'
                    ? style.deleted
                    : line.type === 'added'
                    ? style.added
                    : isDarkMode ? 'hover:bg-slate-800/10' : 'hover:bg-slate-100/40';

                const displayLine = line.type === 'added' ? tranLine : line;

                return (
                  <div key={`uni-${idx}`} id={`diff-line-${idx}`} className={`flex items-stretch h-6 ${lineStyle}`}>
                    <span className="w-12 shrink-0 text-right pr-3 select-none text-[10px] text-slate-550 font-mono self-center">
                      {displayLine?.originalLineNumber || '-'}
                    </span>
                    <span className="w-12 shrink-0 text-right pr-3 select-none text-[10px] text-slate-550 font-mono self-center">
                      {displayLine?.translatedLineNumber || '-'}
                    </span>
                    <div className="flex-1 font-mono text-xs whitespace-pre self-center pl-2">
                      {renderLineContent(displayLine, style)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
});

DiffViewer.displayName = 'DiffViewer';

export default DiffViewer;
