import React, { useRef, useEffect, useLayoutEffect, useMemo, useState, useCallback, useImperativeHandle, startTransition } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { requestWorkbenchConfirm } from '../services/workbench/workbenchConfirmService';
import { Sparkles, Undo2, Check, Code, LayoutGrid, FileCode, FileText, X, ListTree, PanelRightClose, Lightbulb, PlayCircle, Pencil, Save, Trash2, Plus, Minus, ChevronDown, ChevronRight, RefreshCw, FolderOpen, Copy, FileInput, ExternalLink, GripHorizontal, ArrowUp, ArrowDown, Scissors, ClipboardPaste, Package } from 'lucide-react';

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

/** 模块页浏览态的主区占位：不显示编辑器/设计器，引导在左侧选择模块。 */
function ModulePageEmptyState({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className={`flex-1 flex flex-col items-center justify-center gap-3 select-none ${isDarkMode ? 'bg-[#141418] text-slate-500' : 'bg-white text-slate-400'}`}>
      <Package className="w-10 h-10 opacity-40" aria-hidden="true" />
      <div className="text-sm font-semibold">模块生态</div>
      <div className="max-w-xs text-center text-xs leading-5">
        在左侧列表选择一个模块，将在主区打开模块详情页；
        切换回「文件」页即可继续编辑代码与界面设计。
      </div>
    </div>
  );
}
import { CommandHintContent, DiffLine, DiffResult, ExtractedString, ProblemItem } from '../types';
import WpfDesigner, { type WpfDesignerHandle, type WpfDesignerHistoryAvailability } from './WpfDesigner';
import DesignerErrorBoundary from './DesignerErrorBoundary';
import type { CommandService } from '../services/commands/commandService';
import { keyboardEventToKeybinding } from '../services/commands/keybindingService';
import { describeModuleBindingParameterType } from '../services/modules/bindingValueType';
import { MODULE_DETAIL_OPEN_EVENT, MODULE_PAGE_ACTIVE_EVENT } from '../services/modules/moduleDetailView';
import ModuleDetailPage from './ModuleDetailPage';
import type { CommandContext } from '../services/commands/types';
import MonacoCodeEditor, {
  MonacoContentChange,
  MonacoCodeEditorHandle,
  MonacoEditorState
} from './MonacoCodeEditor';
import LingCppStructureEditor from './LingCppStructureEditor';
import ProjectGlobalVariableEditor from './ProjectGlobalVariableEditor';
import ProjectDataTypeEditor from './ProjectDataTypeEditor';
import ProjectDllCommandsEditor from './ProjectDllCommandsEditor';
import {
  DIFF_VIEW_MODE_CHANGE_EVENT,
  type DiffViewMode
} from '../services/editor/diffViewMode';
import {
  BEGINNER_TABLE_MIN_COLUMN_WIDTH,
  readBeginnerTableColumnWidthOverrides,
  writeBeginnerTableColumnWidths,
  type BeginnerTableColumnWidthOverrides,
  type BeginnerTableKey
} from '../services/editor/beginnerTableColumnWidths';
import BeginnerVirtualCanvas, { type BeginnerCanvasItem, type BeginnerVirtualCanvasHandle } from './beginner/BeginnerVirtualCanvas';
import { buildLingCppLanguageContext, getLingCppDesignerControlCompletions, getLingCppReadableBlocks, getLingCppSourceDefinitionAtPosition, getLingCppStructuredRows, getLingCppStructureView } from '../services/lingCpp/languageService';
import { LingCppAccessModifier, LingCppAstEdit, LingCppLocalVariable, LingCppMethod, LingCppNativeSourceMapEntry, LingCppParameter, LingCppProjectGlobalContext, LingCppProjectTypeContext, LingCppReadableBlock, LingCppReadingMode, LingCppStructuredReadingRow, LingCppStructureNode } from '../services/lingCpp/types';
import { getBeginnerCommandTokenAtCursor, getBeginnerCompletionContext, getBeginnerCompletionToken, shouldShowBeginnerCompletion } from '../services/lingCpp/beginnerCompletionContext';
import { getBeginnerLibraryCallAtCursor, getBeginnerProcedureCallAtCursor, resolveBeginnerFunctionLibraryDefinition, resolveBeginnerProcedureDefinition } from '../services/lingCpp/beginnerDefinitionNavigation';
import { getBeginnerTextareaOffsetAtPoint, getBeginnerIdentifierSpanAtOffset } from '../services/lingCpp/beginnerTextPosition';
import {
  type BeginnerFlowGuideRow,
  type BeginnerCrossSegmentFlowFold,
  beginnerIfLineKind,
  beginnerStructureAnchors,
  currentBeginnerBranch,
  findBeginnerIfBlocksAtLine,
  formatBeginnerFlowIndentation,
  getBeginnerCrossSegmentFlowFolds,
  getBeginnerNextLineIndentation,
  getBeginnerIfFlowGuideRows,
  parseBeginnerIfBlocks
} from '../services/lingCpp/beginnerFlowGuide';
import { BEGINNER_BUILTIN_VALUE_COMPLETIONS } from '../services/lingCpp/beginnerBuiltinValueCompletions';
import { toggleBeginnerLineComment } from '../services/lingCpp/beginnerLineComment';
import { formatBeginnerAssignmentAtCursor } from '../services/lingCpp/beginnerStatementFormat';
import { applyLingCppAstEdit } from '../services/lingCpp/astEditService';
import {
  BeginnerMethodBodySegment,
  getBeginnerLocalAnchorLayout,
  getBeginnerLocalInsertShortcutKind,
  getBeginnerLocalInsertStatementIndex,
  getBeginnerMethodBodySegments
} from '../services/lingCpp/beginnerLocalVariableLayout';
import {
  analyzeBeginnerAutoLocalAssignment,
  analyzeBeginnerAutoLocalCommandArgument,
  analyzeBeginnerAutoLocalLoopVariable
} from '../services/lingCpp/beginnerAutoLocalService';
import {
  BeginnerCommandParameterCatalog,
  parseBeginnerCommandExpansion,
  updateBeginnerCommandArgument
} from '../services/lingCpp/beginnerCommandExpansion';
import {
  BeginnerTypeCompletionItem,
  adaptBeginnerInitialValueForType,
  buildBeginnerTypeCompletionCatalog,
  filterBeginnerTypeCompletions,
  resolveBeginnerTypeAlias
} from '../services/lingCpp/beginnerTypeCompletion';
import { createBeginnerConstantCompletion, createBeginnerVariableCompletion } from '../services/lingCpp/beginnerVariableCompletion';
import { buildChineseCompletionSearchAliases } from '../services/lingCpp/completionSearchAliases';
import { LingCppNativePreviewFile, LingWindowProject, NativeCppImportResult } from '../services/windowDesigner/types';
import { EditorExperienceMode } from '../services/lingCpp/beginnerService';
import { importNativeCppToLingBuilder } from '../services/windowDesigner/nativeCppImportService';
import { saveWindowDesignerState } from '../services/windowDesigner/windowDesignerService';
import { normalizeIdentifier, parseLingCpp } from '../services/lingCpp/parser';
import { createProjectGlobalContext, isProjectGlobalsFilePath } from '../services/lingCpp/projectGlobalService';
import { createProjectTypeContext, isProjectDataTypesFilePath } from '../services/lingCpp/projectDataTypeService';
import { isProjectDllCommandsFilePath } from '../services/lingCpp/projectDllCommandService';
import { createProjectFunctionContext } from '../services/lingCpp/functionLibraryService';
import { fetchWithSdkDependencies } from '../services/sdkDependencies/sdkDependencyClient';
import { getLingCppParameterElementType, isLingCppArrayParameterType, setLingCppArrayParameterType } from '../services/lingCpp/parameterTypeService';
import { getProjectConstantNameAtCursor } from '../services/lingCpp/projectConstantReferenceService';
import {
  classifyLingCppPresentationCode,
  extractLingCppNativeVariableNames,
  LingCppPresentationTokenKind,
  splitLingCppLineComment
} from '../services/lingCpp/beginnerSyntaxPresentation';
import { getLingCppModuleCommandNames } from '../services/lingCpp/monacoTokens';
import { LingCppModuleContext } from '../services/modules/types';
import { getModuleConstants } from '../services/modules/moduleConstantService';
import {
  getLingCppControlReferenceAtPosition,
  getLingCppControlReferences,
  renameLingCppControlReference,
  type LingCppControlReference
} from '../services/lingCpp/controlReferenceService';
import {
  getLingCppCommentTokenColor,
  getLingCppConstantTokenColor,
  getLingCppControlReferenceTokenColor
} from '../services/lingCpp/semanticTheme';
import {
  acquireLingCppControlReferenceCommands,
  REVEAL_LINGCPP_CONTROL_COMMAND
} from '../services/lingCpp/controlReferenceCommands';
import {
  acquireLingCppBeginnerCommands,
  activeLingCppBeginnerCommandTargetService,
  ADD_BEGINNER_ASSEMBLY_VARIABLE_COMMAND,
  ADD_BEGINNER_LOCAL_CONSTANT_COMMAND,
  ADD_BEGINNER_LOCAL_VARIABLE_COMMAND,
  ADD_BEGINNER_SUBPROGRAM_COMMAND,
  COPY_BEGINNER_SUBPROGRAM_COMMAND,
  CUT_BEGINNER_SUBPROGRAM_COMMAND,
  MOVE_BEGINNER_SUBPROGRAM_DOWN_COMMAND,
  MOVE_BEGINNER_SUBPROGRAM_UP_COMMAND,
  PASTE_BEGINNER_SUBPROGRAM_COMMAND,
  type LingCppBeginnerMethodTarget
} from '../services/lingCpp/beginnerCommandTargetService';
import { getLingCppMethodBlock } from '../services/lingCpp/astEditService';
import { getMenuService } from '../services/menus/menuService';
import { LINGCPP_BEGINNER_CONTEXT_MENU, LINGCPP_CONTROL_REFERENCE_CONTEXT_MENU } from '../services/menus/types';
import {
  requestDesignerNavigation,
  subscribeDesignerNavigation
} from '../services/windowDesigner/designerNavigationService';
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
  TextModelIdentity,
  getOrCreateWorkbenchTextHistory,
  getBeginnerBodySourceColumns,
  getBeginnerBodySourceLines,
  inferBeginnerBodyStartColumn,
  mapBeginnerBodyTextPosition,
  reconcileTextEditHistory,
  workbenchTextModelService
} from '../services/textModel';
import { collectLingCppTextBlockLines, scanLingCppTextBlockRanges } from '../services/lingCpp/textBlock';

/** 草稿文本中属于多行文本块（开始行/内容行/结束标记）的 1-based 行号集合。 */
const beginnerTextBlockLineSet = (value: string): Set<number> => {
  const lines = value.split('\n');
  return collectLingCppTextBlockLines(scanLingCppTextBlockRanges(lines), lines.length);
};

let beginnerProcedureNameMeasureCanvas: HTMLCanvasElement | null = null;
let diffViewerCommandTargetSerial = 0;

function measureBeginnerProcedureName(name: string, fontSize: number) {
  if (typeof document === 'undefined') {
    return Array.from(name).reduce((width, character) =>
      width + (/^[\u0000-\u007f]$/u.test(character) ? fontSize * 0.72 : fontSize), 0);
  }

  beginnerProcedureNameMeasureCanvas ||= document.createElement('canvas');
  const context = beginnerProcedureNameMeasureCanvas.getContext('2d');
  if (!context) return Array.from(name).length * fontSize;
  const fontFamily = window.getComputedStyle(document.body).fontFamily || 'sans-serif';
  context.font = `700 ${fontSize}px ${fontFamily}`;
  return context.measureText(name).width;
}

function measureRenderedInputText(input: HTMLInputElement) {
  beginnerProcedureNameMeasureCanvas ||= document.createElement('canvas');
  const context = beginnerProcedureNameMeasureCanvas.getContext('2d');
  if (!context) return input.scrollWidth;
  const style = window.getComputedStyle(input);
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return context.measureText(input.value).width +
    Number.parseFloat(style.paddingLeft || '0') +
    Number.parseFloat(style.paddingRight || '0') +
    Number.parseFloat(style.borderLeftWidth || '0') +
    Number.parseFloat(style.borderRightWidth || '0');
}

// Same stack as Tailwind's default `font-mono` used by the beginner code body,
// so a source-column indent measured here lands on the rendered code text.
const BEGINNER_MONO_FONT_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
let beginnerMonoMeasureCanvas: HTMLCanvasElement | null = null;

function measureBeginnerMonoCharWidth(fontSize: number): number {
  if (typeof document === 'undefined') return fontSize * 0.6;
  beginnerMonoMeasureCanvas ||= document.createElement('canvas');
  const context = beginnerMonoMeasureCanvas.getContext('2d');
  if (!context) return fontSize * 0.6;
  context.font = `${fontSize}px ${BEGINNER_MONO_FONT_STACK}`;
  return context.measureText('0').width;
}

export interface DiffViewerHandle {
  flushPendingEdits: () => Promise<FlushPendingEditsResult>;
  /**
   * Replaces the mounted editor content authoritatively. Callers that change the
   * active file outside the editor (AI edit apply, external reload) must use this
   * before any save, because a save flush reads the editor draft as the source of truth.
   */
  applyExternalSourceCode: (value: string) => void;
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
  onUpdateProjectSources?: (sources: Array<{ filePath: string; sourceCode: string }>) => void;
  onOpenProjectDataTypes?: () => void;
  onOpenProjectDllCommands?: () => void;
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
  designerToolboxHost?: HTMLElement | null;
  onDesignerViewActiveChange?: (active: boolean) => void;
  moduleContext?: LingCppModuleContext;
  activeWindowId?: string;
  editorExperienceMode?: EditorExperienceMode;
  onExperienceModeChange?: (mode: EditorExperienceMode) => void | boolean | Promise<void | boolean>;
  problems?: ProblemItem[];
  onShowCommandHint?: (hint: CommandHintContent | null) => void;
  textModelWorkspaceId?: string;
  textModelProjectId?: string;
  onEditorStateChange?: (state: MonacoEditorState) => void;
  commandService?: CommandService;
  getCommandContext?: () => CommandContext;
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

type StructureEditMode = 'package' | 'global' | 'class' | 'member' | 'method' | 'event' | 'add-member' | 'add-event';

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

type LocalVariableDraft = {
  type: string;
  name: string;
  initialValue: string;
  note: string;
  isArray: boolean;
  isConstant: boolean;
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
type BeginnerCodeSegment = Extract<BeginnerMethodBodySegment, { kind: 'code' }>;
type BeginnerCodeSegmentContext = {
  segment: BeginnerCodeSegment;
  segments: BeginnerMethodBodySegment[];
  /** Folds anchored in an earlier segment whose range extends into this one. */
  externalFlowFolds?: BeginnerCrossSegmentFlowFold[];
};

type BeginnerFlowLineTarget = {
  targetKey: string;
  segmentId: string;
  line: number;
};

type StructureInputTone = 'plain' | 'type' | 'name' | 'value' | 'procedure' | 'variable' | 'parameter' | 'note';
type StructureTextTone = StructureInputTone | 'muted';

interface BeginnerCodeCompletion {
  label: string;
  detail: string;
  insertText: string;
  aliases: string[];
  kind: '命令' | '流程' | '代码' | '变量' | '常量' | '子程序' | '类型' | '窗口' | '位置';
  cursorOffset?: number;
  selectLength?: number;
  /** 预计算的小写检索值（label + 别名）：补全过滤每个键都跑，避免重复 toLowerCase。 */
  searchValues?: string[];
}

interface BeginnerCompletionState {
  targetKey: string;
  segmentId: string;
  token: string;
  /** 弹出/刷新补全时的光标偏移；上屏前校验光标与 token 是否仍然对应。 */
  cursor: number;
  items: BeginnerCodeCompletion[];
  selectedIndex: number;
  position: BeginnerCompletionPosition;
  /** 面板渲染在画布内容层（不在块内），记录目标与 textarea 定位键用于回查与上屏。 */
  target: BeginnerCodeTarget;
  segmentContext?: BeginnerCodeSegmentContext;
  viewKey: string;
}

interface BeginnerCompletionPosition {
  top: number;
  left: number;
  maxListHeight: number;
  placement: 'above' | 'below';
}

interface BeginnerAutoLocalTypeState {
  targetKey: string;
  segmentId: string;
  variableName: string;
  expression: string;
  subtitle: string;
  items: string[];
  selectedIndex: number;
  position: BeginnerCompletionPosition;
  /** 同 BeginnerCompletionState：面板出块后需要目标与 textarea 定位键。 */
  target: BeginnerCodeTarget;
  segmentContext?: BeginnerCodeSegmentContext;
  viewKey: string;
}

interface BeginnerContextMenuState {
  x: number;
  y: number;
  className?: string;
  methodName?: string;
  definitionName?: string;
  libraryCall?: { libraryName: string; functionName: string };
  controlReference?: LingCppControlReference;
}

interface BeginnerJumpHighlightState {
  targetKey: string;
  line: number;
  label: string;
}

interface BeginnerTypeCompletionState {
  inputKey: string;
  value: string;
  items: BeginnerTypeCompletionItem[];
  selectedIndex: number;
  placement: 'above' | 'below';
  maxListHeight: number;
}

interface BeginnerInitialValueEditorState {
  target: BeginnerCodeTarget;
  local: LingCppLocalVariable;
  onSave: (value: string) => boolean;
}

type BeginnerCommandHintInfo = CommandHintContent;

// The beginner editor paints syntax colors over a transparent textarea. Token
// decoration must not change glyph metrics, otherwise the native textarea caret
// drifts away from the visible code as weighted Chinese glyphs accumulate.
const BEGINNER_CODE_OVERLAY_TOKEN_STYLE: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 'inherit',
  fontWeight: 'inherit',
  fontStyle: 'inherit',
  letterSpacing: 'inherit'
};

const BEGINNER_IF_SNIPPET = '如果 (条件)\n    \n否则\n    \n如果结束';

/** 会改变新手结构画布「流程图 / 分支折叠」的关键字行首词；只有它们变化才需要重渲结构。 */
const BEGINNER_FLOW_KEYWORD_HEADS = new Set<string>([
  '如果', '如果真', '否则', '否则如果', '如果结束', '如果真结束',
  '循环', '循环结束', '判断循环首', '判断循环尾', '循环判断首', '循环判断尾',
  '计次循环首', '计次循环尾', '变量循环首', '变量循环尾', '枚举循环首', '枚举循环尾',
  '选择', '选择结束', '判断', '判断结束', '分支', '情况', '默认',
  '尝试', '尝试结束', '捕获', '最终',
  '跳出循环', '到循环尾', '继续循环', '抛出', '结束', '返回'
]);

const BEGINNER_IF_TRUE_SNIPPET = '如果真 (条件)\n    \n如果真结束';
const BEGINNER_SELECT_SNIPPET = '选择 (表达式)\n    分支 (值)\n        \n    默认\n        \n选择结束';
const BEGINNER_LOOP_SNIPPET = '循环\n    \n循环结束';
const BEGINNER_WHILE_SNIPPET = '判断循环首 (条件)\n    \n判断循环尾 ()';
const BEGINNER_DO_WHILE_SNIPPET = '循环判断首 ()\n    \n循环判断尾 (条件)';
const BEGINNER_COUNT_LOOP_SNIPPET = '计次循环首 (次数, 计次变量)\n    \n计次循环尾 ()';
const BEGINNER_RANGE_LOOP_SNIPPET = '变量循环首 (起始值, 目标值, 递增值, 循环变量)\n    \n变量循环尾 ()';
const BEGINNER_FOREACH_SNIPPET = '枚举循环首 (集合, 当前项)\n    \n枚举循环尾 ()';
const BEGINNER_TRY_SNIPPET = '尝试\n    \n捕获 (错误信息)\n    \n最终\n    \n尝试结束';

// 工具栏片段插入后要选中的第一个中文占位词，例如「如果 (条件)」里的「条件」、
// 「信息框("提示内容", …)」里的「提示内容」。找不到时插入后光标落在片段末尾。
function findSnippetPlaceholderSelection(snippet: string): { offset: number; length: number } | undefined {
  const openIndex = snippet.search(/[（(]/u);
  if (openIndex < 0) return undefined;
  const contentStart = openIndex + 1;
  const closeIndex = snippet.slice(contentStart).search(/[）)]/u);
  if (closeIndex < 0) return undefined;
  let token = snippet.slice(contentStart, contentStart + closeIndex);
  const quoted = token.startsWith('"') || token.startsWith('“');
  if (quoted) token = token.slice(1, -1);
  const commaIndex = token.search(/[,，]/u);
  if (commaIndex >= 0) token = token.slice(0, commaIndex);
  token = token.trim();
  if (!token) return undefined;
  return { offset: contentStart + (quoted ? 1 : 0), length: token.length };
}

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
    signature: '调试输出(参数1, 参数2, ...)',
    returnType: '空',
    summary: '把任意数量的文本、整数或逻辑值写到调试输出窗口，各参数使用英文逗号分隔。',
    parameters: [
      { name: '参数...', type: '任意可输出类型', note: '可连续传入多个参数，运行时按英文逗号和空格连接。' }
    ],
    example: '调试输出("当前选择项", 控件_取选择项("列表框1"), 真)'
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
  选择: {
    command: '选择',
    signature: '选择 (表达式) ... 分支 (值) ... 默认 ... 选择结束',
    returnType: '流程控制',
    summary: '根据整数表达式进入匹配的分支；没有匹配值时进入默认分支。',
    parameters: [{ name: '表达式', type: '整数型', note: '用于匹配各个分支值。' }],
    example: '选择 (状态码)'
  },
  分支: {
    command: '分支', signature: '分支 (值1, [值2...])', returnType: '流程控制',
    summary: '声明选择结构中的一个或多个匹配值。',
    parameters: [{ name: '值...', type: '整数型', note: '多个值使用逗号分隔。' }], example: '分支 (1, 2)'
  },
  默认: {
    command: '默认', signature: '默认', returnType: '流程控制', summary: '处理选择结构中没有匹配值的情况。', parameters: [], example: '默认'
  },
  循环: {
    command: '循环', signature: '循环 ... 循环结束', returnType: '流程控制', summary: '持续执行循环体，直到返回、结束程序或跳出循环。', parameters: [], example: '循环'
  },
  判断循环首: {
    command: '判断循环首', signature: '判断循环首 (条件)', returnType: '流程控制', summary: '条件成立时反复执行循环体。', parameters: [{ name: '条件', type: '逻辑型', note: '每次进入循环前重新判断。' }], example: '判断循环首 (次数 < 10)'
  },
  循环判断首: {
    command: '循环判断首', signature: '循环判断首 () ... 循环判断尾 (条件)', returnType: '流程控制', summary: '先执行一次循环体，再判断是否继续。', parameters: [], example: '循环判断首 ()'
  },
  计次循环首: {
    command: '计次循环首', signature: '计次循环首 (次数, [计次变量])', returnType: '流程控制', summary: '按指定次数执行循环体，计次从 1 开始。', parameters: [{ name: '次数', type: '整数型', note: '循环体要执行的总次数。' }, { name: '计次变量', type: '整数型', note: '可选，需预先声明。' }], example: '计次循环首 (10, 次数)'
  },
  变量循环首: {
    command: '变量循环首', signature: '变量循环首 (起始值, 目标值, 递增值, 循环变量)', returnType: '流程控制', summary: '让已声明变量按指定步长遍历数值区间。', parameters: [{ name: '起始值', type: '数值型', note: '第一次循环使用的值。' }, { name: '目标值', type: '数值型', note: '包含在遍历范围内的终点。' }, { name: '递增值', type: '数值型', note: '正数递增、负数递减，不能为 0。' }, { name: '循环变量', type: '数值型', note: '需预先声明，用于接收当前值。' }], example: '变量循环首 (1, 10, 1, 索引)'
  },
  枚举循环首: {
    command: '枚举循环首', signature: '枚举循环首 (集合, 当前项)', returnType: '流程控制', summary: '依次读取数组或集合中的每一项。', parameters: [{ name: '集合', type: '数组或集合', note: '要遍历的数组或集合变量。' }, { name: '当前项', type: '兼容元素类型', note: '需预先声明。' }], example: '枚举循环首 (名称列表, 当前名称)'
  },
  跳出循环: {
    command: '跳出循环', signature: '跳出循环', returnType: '流程控制', summary: '立即离开当前最内层循环。', parameters: [], example: '跳出循环'
  },
  继续循环: {
    command: '继续循环', signature: '继续循环', returnType: '流程控制', summary: '跳过当前循环剩余语句并进入下一次循环。', parameters: [], example: '继续循环'
  },
  尝试: {
    command: '尝试', signature: '尝试 ... 捕获 (错误信息) ... 最终 ... 尝试结束', returnType: '流程控制', summary: '捕获运行时异常；最终块无论正常、异常或提前返回都会执行。', parameters: [], example: '尝试'
  },
  抛出: {
    command: '抛出', signature: '抛出 (错误信息)', returnType: '流程控制', summary: '主动抛出文本异常，由最近的捕获块处理。', parameters: [{ name: '错误信息', type: '文本型', note: '用于诊断和捕获处理的中文说明。' }], example: '抛出("文件无效")'
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

const BEGINNER_CONTROL_BOUNDARY_COMPLETIONS: BeginnerCodeCompletion[] = [
  ['分支', '分支 (值)', '选择结构的匹配分支'],
  ['默认', '默认', '选择结构的默认分支'],
  ['选择结束', '选择结束', '结束多路选择结构'],
  ['循环结束', '循环结束', '结束无限循环结构'],
  ['判断循环尾', '判断循环尾 ()', '结束前置条件循环'],
  ['循环判断尾', '循环判断尾 (条件)', '结束后置条件循环并判断是否继续'],
  ['计次循环尾', '计次循环尾 ()', '结束计次循环'],
  ['变量循环尾', '变量循环尾 ()', '结束变量循环'],
  ['枚举循环尾', '枚举循环尾 ()', '结束枚举循环'],
  ['到循环尾', '到循环尾', '继续下一次循环的兼容命令'],
  ['捕获', '捕获 (错误信息)', '捕获尝试块中的异常'],
  ['最终', '最终', '无论结果如何都执行的清理分支'],
  ['尝试结束', '尝试结束', '结束异常处理结构']
].map(([label, insertText, detail]) => ({
  label,
  insertText,
  detail,
  aliases: [label],
  kind: '流程' as const
}));

const BEGINNER_CODE_COMPLETIONS: BeginnerCodeCompletion[] = [
  ...BEGINNER_BUILTIN_VALUE_COMPLETIONS,
  ...BEGINNER_CONTROL_BOUNDARY_COMPLETIONS,
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
    label: '如果真',
    detail: '易语言风格的真条件判断结构',
    insertText: BEGINNER_IF_TRUE_SNIPPET,
    aliases: ['rgz', 'rgt', 'ruguozhen', 'iftrue', '如果真'],
    kind: '流程',
    cursorOffset: '如果真 ('.length,
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
    label: '选择', detail: '多路分支选择结构', insertText: BEGINNER_SELECT_SNIPPET,
    aliases: ['xz', 'xuanze', 'pd', 'panduan', 'switch', 'case'], kind: '流程', cursorOffset: '选择 ('.length, selectLength: '表达式'.length
  },
  {
    label: '循环', detail: '无限循环结构', insertText: BEGINNER_LOOP_SNIPPET,
    aliases: ['xh', 'xunhuan', 'loop', 'forever'], kind: '流程'
  },
  {
    label: '判断循环', detail: '先判断条件的循环', insertText: BEGINNER_WHILE_SNIPPET,
    aliases: ['pdxh', 'panduanxunhuan', 'while'], kind: '流程', cursorOffset: '判断循环首 ('.length, selectLength: '条件'.length
  },
  {
    label: '循环判断', detail: '至少执行一次的循环', insertText: BEGINNER_DO_WHILE_SNIPPET,
    aliases: ['xhpd', 'xunhuanpanduan', 'do', 'do while'], kind: '流程'
  },
  {
    label: '计次循环', detail: '按指定次数循环', insertText: BEGINNER_COUNT_LOOP_SNIPPET,
    aliases: ['jcxh', 'jicixunhuan', 'for', 'repeat'], kind: '流程', cursorOffset: '计次循环首 ('.length, selectLength: '次数'.length
  },
  {
    label: '变量循环', detail: '按数值区间和步长循环', insertText: BEGINNER_RANGE_LOOP_SNIPPET,
    aliases: ['blxh', 'bianliangxunhuan', 'range'], kind: '流程', cursorOffset: '变量循环首 ('.length, selectLength: '起始值'.length
  },
  {
    label: '枚举循环', detail: '遍历数组或集合', insertText: BEGINNER_FOREACH_SNIPPET,
    aliases: ['mjxh', 'meijuxunhuan', 'foreach', 'for each'], kind: '流程', cursorOffset: '枚举循环首 ('.length, selectLength: '集合'.length
  },
  {
    label: '跳出循环', detail: '立即离开当前循环', insertText: '跳出循环',
    aliases: ['tcxh', 'tiaochuxunhuan', 'break'], kind: '流程'
  },
  {
    label: '继续循环', detail: '跳过本次循环的剩余语句', insertText: '继续循环',
    aliases: ['jjxh', 'jixuxunhuan', 'dxhw', '到循环尾', 'continue'], kind: '流程'
  },
  {
    label: '尝试捕获', detail: '捕获异常并始终执行最终块', insertText: BEGINNER_TRY_SNIPPET,
    aliases: ['cs', 'changshi', 'bh', 'buhuo', 'try', 'catch', 'finally'], kind: '流程'
  },
  {
    label: '抛出', detail: '主动抛出文本异常', insertText: '抛出("错误信息")',
    aliases: ['pc', 'paochu', 'throw'], kind: '流程', cursorOffset: '抛出("'.length, selectLength: '错误信息'.length
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
    behavior: 'auto'
  });

  if (window.scrollX !== 0 || window.scrollY !== 0) {
    window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
  }
};

/** 按 data-text-model-view-key 回查当前挂载的代码 textarea（重挂后旧引用失效）。 */
const findBeginnerCodeTextareaByViewKey = (viewKey: string): HTMLTextAreaElement | null => {
  if (!viewKey) return null;
  const fresh = document.querySelector<HTMLTextAreaElement>(
    `textarea[data-text-model-view-key="${CSS.escape(viewKey)}"]`
  );
  return fresh instanceof HTMLTextAreaElement && fresh.isConnected ? fresh : null;
};

/**
 * 把闭包里捕获的 textarea 解析成当前仍挂载的节点。
 * 回车/Tab/注释/补全上屏等路径会用 rAF 延迟恢复光标；若期间该编辑器因 key 变化重挂，
 * 闭包引用指向已卸载节点，直接 setSelectionRange 会静默丢光标，这里按定位键找回新节点。
 */
const resolveBeginnerCodeTextarea = (input: HTMLTextAreaElement): HTMLTextAreaElement | null =>
  input.isConnected ? input : findBeginnerCodeTextareaByViewKey(input.dataset.textModelViewKey || '');

const getBeginnerCompletionPanelPosition = (
  input: HTMLTextAreaElement,
  token: string,
  itemCount: number
): BeginnerCompletionPosition => {
  // 面板渲染在画布内容层（z-[90] 浮层），坐标必须落在内容坐标系；
  // 虚拟化/非虚拟化两种模式下内容层都是滚动根的直接子节点。找不到时回退编辑块根。
  const scrollRoot = input.closest('[data-beginner-structure-scroll]');
  const canvasContent = scrollRoot instanceof HTMLElement
    ? scrollRoot.querySelector(':scope > [data-beginner-canvas-content]')
    : null;
  const root = canvasContent instanceof HTMLElement
    ? canvasContent
    : (input.closest('[data-beginner-editor-root]') instanceof HTMLElement
      ? input.closest('[data-beginner-editor-root]')
      : null);
  if (!(root instanceof HTMLElement)) {
    return { top: 34, left: 60, maxListHeight: 190, placement: 'below' };
  }

  const rootRect = root.getBoundingClientRect();
  const inputRect = input.getBoundingClientRect();
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

const withBeginnerCompletionSearchValues = (item: BeginnerCodeCompletion): BeginnerCodeCompletion => ({
  ...item,
  searchValues: [item.label, ...item.aliases].map(value => value.toLowerCase())
});

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
      const values = item.searchValues || [item.label, ...item.aliases].map(value => value.toLowerCase());
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

interface BeginnerInitialValueEditorProps {
  variableName: string;
  variableType: string;
  value: string;
  isConstant: boolean;
  isDarkMode: boolean;
  readOnly: boolean;
  onSave: (value: string) => void;
  onClose: () => void;
}

function BeginnerInitialValueEditor({
  variableName,
  variableType,
  value,
  isConstant,
  isDarkMode,
  readOnly,
  onSave,
  onClose
}: BeginnerInitialValueEditorProps) {
  const [draft, setDraft] = useState(value);
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 24, y: 48 };
    return {
      x: Math.max(12, Math.round((window.innerWidth - 720) / 2)),
      y: Math.max(12, Math.round((window.innerHeight - 560) / 2))
    };
  });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setDraft(value);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [value]);

  useEffect(() => () => {
    dragCleanupRef.current?.();
  }, []);

  const clampPosition = useCallback((x: number, y: number) => {
    const dialog = editorRef.current;
    const dialogWidth = dialog?.getBoundingClientRect().width
      || Math.min(720, Math.max(320, window.innerWidth - 24));
    const dialogHeight = dialog?.getBoundingClientRect().height
      || Math.min(560, Math.max(300, window.innerHeight - 24));
    return {
      x: Math.max(12, Math.min(x, Math.max(12, window.innerWidth - dialogWidth - 12))),
      y: Math.max(12, Math.min(y, Math.max(12, window.innerHeight - dialogHeight - 12)))
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setPosition(current => clampPosition(current.x, current.y));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target instanceof HTMLElement && event.target.closest('button'))) return;
    event.preventDefault();
    dragCleanupRef.current?.();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = position;
    const handleMove = (moveEvent: PointerEvent) => {
      const next = clampPosition(
        origin.x + moveEvent.clientX - startX,
        origin.y + moveEvent.clientY - startY
      );
      setPosition(next);
    };
    const stop = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      dragCleanupRef.current = null;
    };
    dragCleanupRef.current = stop;
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      textareaRef.current?.focus();
      textareaRef.current?.select();
      setCopied(false);
    }
  };

  const save = () => {
    if (!readOnly) onSave(draft);
  };

  return (
    <div
      role="dialog"
      aria-labelledby="beginner-initial-value-title"
      tabIndex={-1}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !readOnly) {
          event.preventDefault();
          save();
        }
      }}
      ref={editorRef}
      className={`fixed z-[180] flex min-h-0 flex-col resize overflow-hidden rounded-lg border shadow-2xl outline-none ${
        isDarkMode
          ? 'border-[#464752] bg-[#1b1c23] text-slate-100 shadow-black/60'
          : 'border-slate-300 bg-white text-slate-900 shadow-slate-500/30'
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: 'min(720px, calc(100vw - 24px))',
        height: 'min(560px, calc(100vh - 24px))',
        minWidth: 'min(320px, calc(100vw - 24px))',
        minHeight: 'min(300px, calc(100vh - 24px))',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100vh - 24px)'
      }}
    >
      <div
        onPointerDown={beginDrag}
        className={`flex shrink-0 cursor-move select-none items-center justify-between gap-3 border-b px-3 py-2 ${
          isDarkMode ? 'border-[#34353f] bg-[#24252e]' : 'border-slate-200 bg-slate-50'
        }`}
        style={{ touchAction: 'none' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <GripHorizontal className={`h-4 w-4 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} aria-hidden="true" />
          <div className="min-w-0">
            <div id="beginner-initial-value-title" className="truncate text-[12px] font-semibold">初始值编辑器</div>
            <div className={`mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className="max-w-[260px] truncate">{variableName || '未命名局部声明'}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{variableType || '未指定类型'}</span>
              {isConstant && <span className="shrink-0">· 只读常量</span>}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭初始值编辑器"
          title="关闭"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors ${
            isDarkMode ? 'text-slate-400 hover:bg-[#34353f] hover:text-white' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div className={`flex shrink-0 items-center justify-between gap-2 text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
          <span>完整初始值 · 支持换行</span>
          <span className="tabular-nums">{Array.from(draft).length} 个字符</span>
        </div>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={event => setDraft(event.currentTarget.value)}
          readOnly={readOnly}
          spellCheck={false}
          aria-label={`${variableName || '局部声明'}的初始值`}
          placeholder={isConstant ? '局部常量必须填写初始值' : '可留空'}
          className={`min-h-0 flex-1 resize-none rounded border p-3 font-mono text-[12px] leading-5 outline-none transition-colors ${
            isDarkMode
              ? 'border-[#3c3d48] bg-[#111218] text-emerald-200 placeholder:text-slate-600 focus:border-cyan-500/70'
              : 'border-slate-300 bg-white text-emerald-800 placeholder:text-slate-400 focus:border-cyan-500'
          }`}
        />
        <div className={`flex shrink-0 flex-wrap items-center justify-between gap-2 border-t pt-2 text-[10px] ${
          isDarkMode ? 'border-[#34353f] text-slate-500' : 'border-slate-200 text-slate-500'
        }`}>
          <span>{readOnly ? '当前文件只读，可复制查看。' : '拖动标题栏移动；可直接编辑并保存。'}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void copyValue()}
              className={`inline-flex h-7 items-center gap-1 rounded border px-2 font-semibold transition-colors ${
                isDarkMode ? 'border-[#454651] text-slate-300 hover:bg-[#2c2d36] hover:text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
              title="复制完整初始值"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{copied ? '已复制' : '复制'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`inline-flex h-7 items-center gap-1 rounded border px-2 font-semibold transition-colors ${
                isDarkMode ? 'border-[#454651] text-slate-300 hover:bg-[#2c2d36] hover:text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <X className="h-3.5 w-3.5" />
              取消
            </button>
            <button
              type="button"
              onClick={save}
              disabled={readOnly}
              className={`inline-flex h-7 items-center gap-1 rounded border px-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                isDarkMode ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25' : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const DiffViewer = React.forwardRef<DiffViewerHandle, DiffViewerProps>(function DiffViewer({
  diffResult,
  strings,
  onUpdateStringTranslation,
  onResetTranslation,
  onUpdateSourceContent,
  onUpdateProjectSources,
  onOpenProjectDataTypes,
  onOpenProjectDllCommands,
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
  designerToolboxHost,
  onDesignerViewActiveChange,
  moduleContext,
  activeWindowId,
  editorExperienceMode = 'beginner',
  onExperienceModeChange,
  problems = [],
  onShowCommandHint,
  textModelWorkspaceId = 'lingbuilder-renderer',
  textModelProjectId = 'default-project',
  onEditorStateChange,
  commandService,
  getCommandContext
}: DiffViewerProps, ref) {
  const [viewType, setViewType] = useState<'code' | 'designer' | 'module'>('code');
  const [moduleDetailModuleId, setModuleDetailModuleId] = useState<string | null>(null);
  const moduleDetailOpenCountRef = useRef(0);

  useEffect(() => {
    // 侧栏模块列表点击 → 主区打开「模块详情」页签（与 force-code-view 同一套事件模式）。
    const handleOpenModuleDetail = (event: Event) => {
      const detail = (event as CustomEvent<{ moduleId?: string }>).detail;
      if (!detail?.moduleId) return;
      moduleDetailOpenCountRef.current += 1;
      setModuleDetailModuleId(detail.moduleId);
      setViewType('module');
    };
    window.addEventListener(MODULE_DETAIL_OPEN_EVENT, handleOpenModuleDetail);
    return () => window.removeEventListener(MODULE_DETAIL_OPEN_EVENT, handleOpenModuleDetail);
  }, []);

  const [beginnerCommandTargetId] = useState(() => `lingcpp-beginner-editor-${++diffViewerCommandTargetSerial}`);
  const beginnerCommandHandlerRef = useRef<{
    addSubprogram?: (target?: LingCppBeginnerMethodTarget) => unknown;
    addAssemblyVariable?: () => unknown;
    addVariable?: (target?: LingCppBeginnerMethodTarget) => unknown;
    addConstant?: (target?: LingCppBeginnerMethodTarget) => unknown;
    moveSubprogram?: (target: LingCppBeginnerMethodTarget | undefined, direction: 'up' | 'down') => unknown;
    cutSubprogram?: (target?: LingCppBeginnerMethodTarget) => unknown;
    copySubprogram?: (target?: LingCppBeginnerMethodTarget) => unknown;
    pasteSubprogram?: (target?: LingCppBeginnerMethodTarget) => unknown;
  }>({});
  const beginnerMethodClipboardRef = useRef<{ name: string; access: LingCppAccessModifier; blockLines: string[] } | null>(null);

  useEffect(() => {
    const handleForceCodeView = () => {
      setModulePageActive(false);
      setViewType('code');
    };
    window.addEventListener('force-code-view', handleForceCodeView);
    return () => {
      window.removeEventListener('force-code-view', handleForceCodeView);
    };
  }, []);

  // 模块侧栏页激活时主区显示占位页（隐藏编辑器/设计器）；打开模块详情页签后由详情页接管。
  const [modulePageActive, setModulePageActive] = useState(false);
  useEffect(() => {
    const handleModulePageActive = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      setModulePageActive(detail?.active === true);
    };
    window.addEventListener(MODULE_PAGE_ACTIVE_EVENT, handleModulePageActive);
    return () => window.removeEventListener(MODULE_PAGE_ACTIVE_EVENT, handleModulePageActive);
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

  useEffect(() => {
    if (!designerProject && viewType === 'designer') setViewType('code');
  }, [designerProject, viewType]);

  const closeModuleDetailTab = useCallback(() => {
    setModuleDetailModuleId(null);
    if (viewType === 'module') setViewType('code');
  }, [viewType]);

  useEffect(() => {
    const isDesignerActive = viewType === 'designer' && Boolean(designerProject);
    onDesignerViewActiveChange?.(isDesignerActive);
    return () => onDesignerViewActiveChange?.(false);
  }, [designerProject, onDesignerViewActiveChange, viewType]);
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
  const [pendingProjectConstantFocus, setPendingProjectConstantFocus] = useState<string>();
  const [collapsedVolcanoSections, setCollapsedVolcanoSections] = useState<string[]>([]);
  const [readingMode, setReadingMode] = useState<LingCppReadingMode>(editorExperienceMode === 'beginner' ? 'beginner' : 'off');
  const [focusedReadableBlockId, setFocusedReadableBlockId] = useState<string | undefined>();
  const [structureEditDraft, setStructureEditDraft] = useState<StructureEditDraft | null>(null);
  const [structureEditError, setStructureEditError] = useState<string | null>(null);
  const [newMemberDraft, setNewMemberDraft] = useState({ type: '文本型', name: '', initialValue: '', isStatic: false, isArray: false, note: '' });
  const [newEventDraft, setNewEventDraft] = useState({ handlerName: '', parameters: '' });
  const [newFunctionDraft, setNewFunctionDraft] = useState({ returnType: '空', name: '', parameters: '' });
  const [beginnerParameterFocus, setBeginnerParameterFocus] = useState<{ targetKey: string; parameterName: string } | null>(null);
  const [sourceScroll, setSourceScroll] = useState({ top: 0, left: 0 });
  const [pendingHandlerFocus, setPendingHandlerFocus] = useState<{ handlerName: string; filePath?: string } | null>(null);
  const [expandedBeginnerEventTargetKey, setExpandedBeginnerEventTargetKey] = useState<string | null>(null);
  const [expandedBeginnerFunctionTargetKey, setExpandedBeginnerFunctionTargetKey] = useState<string | null>(null);
  const [collapsedBeginnerProcessTargetKeys, setCollapsedBeginnerProcessTargetKeys] = useState<string[]>([]);
  const [collapsedBeginnerLocalGroupKeys, setCollapsedBeginnerLocalGroupKeys] = useState<string[]>([]);
  const [isBeginnerMemberTableCollapsed, setIsBeginnerMemberTableCollapsed] = useState(false);
  const [collapsedBeginnerFlowBlockKeys, setCollapsedBeginnerFlowBlockKeys] = useState<string[]>([]);
  const [hoveredBeginnerFlowLine, setHoveredBeginnerFlowLine] = useState<BeginnerFlowLineTarget | null>(null);
  const [activeBeginnerFlowLine, setActiveBeginnerFlowLine] = useState<BeginnerFlowLineTarget | null>(null);
  const [expandedBeginnerCommand, setExpandedBeginnerCommand] = useState<string | null>(null);
  const [beginnerCommandArgumentDrafts, setBeginnerCommandArgumentDrafts] = useState<Record<string, string>>({});
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
  const [beginnerCompletionState, _setBeginnerCompletionState] = useState<BeginnerCompletionState | null>(null);
  const [beginnerAutoLocalTypeState, _setBeginnerAutoLocalTypeState] = useState<BeginnerAutoLocalTypeState | null>(null);
  /**
   * 补全面板 / 自动局部变量类型面板的状态镜像。
   * React 对「函数式 setState 返回同一个值」仍然会安排一次渲染，而新手结构化画布
   * 一次重渲要几十毫秒；这两个状态在每次按键都会被条件性清空，因此必须在这里
   * 先比对再决定要不要真的 setState（2026-09-17 实测：12 键触发 50 次画布重渲）。
   */
  const beginnerCompletionStateRef = useRef<BeginnerCompletionState | null>(null);
  const beginnerAutoLocalTypeStateRef = useRef<BeginnerAutoLocalTypeState | null>(null);
  const setBeginnerCompletionState = useCallback<React.Dispatch<React.SetStateAction<BeginnerCompletionState | null>>>(next => {
    const resolved = typeof next === 'function'
      ? (next as (current: BeginnerCompletionState | null) => BeginnerCompletionState | null)(beginnerCompletionStateRef.current)
      : next;
    if (Object.is(resolved, beginnerCompletionStateRef.current)) return;
    beginnerCompletionStateRef.current = resolved;
    _setBeginnerCompletionState(resolved);
  }, []);
  const setBeginnerAutoLocalTypeState = useCallback<React.Dispatch<React.SetStateAction<BeginnerAutoLocalTypeState | null>>>(next => {
    const resolved = typeof next === 'function'
      ? (next as (current: BeginnerAutoLocalTypeState | null) => BeginnerAutoLocalTypeState | null)(beginnerAutoLocalTypeStateRef.current)
      : next;
    if (Object.is(resolved, beginnerAutoLocalTypeStateRef.current)) return;
    beginnerAutoLocalTypeStateRef.current = resolved;
    _setBeginnerAutoLocalTypeState(resolved);
  }, []);
  const [beginnerJumpHighlight, setBeginnerJumpHighlight] = useState<BeginnerJumpHighlightState | null>(null);
  const [beginnerCodeDrafts, setBeginnerCodeDrafts] = useState<Record<string, string>>({});
  const beginnerCodeDraftsRef = useRef<Record<string, string>>({});
  /** 连续输入的去抖同步定时器：见 updateBeginnerCodeDraft 的说明。 */
  const beginnerDraftSyncTimerRef = useRef<number | null>(null);
  /** 已同步进 state 的草稿结构指纹，用于跳过「只改字词」的无意义重渲。 */
  const beginnerDraftSignaturesRef = useRef<Record<string, string>>({});
  /** 外部（非连续输入）改写草稿的版本号，用于让 code textarea 重新挂载并刷新内容。 */
  const beginnerDraftExternalRevisionRef = useRef<Record<string, number>>({});
  /**
   * 新手补全目录缓存（按输入指纹失效）。启用 new_emoji 等大模块时目录可达数千条，
   * 而光标同步/补全状态每个键都会重渲 DiffViewer；不缓存则每次重建 Map + 检索别名，
   * 是新手模式输入卡顿的主要来源之一。
   */
  const beginnerCompletionCatalogCacheRef = useRef<{
    fingerprint: string;
    windowTargetItems: BeginnerCodeCompletion[];
    items: BeginnerCodeCompletion[];
    perTargetItems: Map<string, BeginnerCodeCompletion[]>;
  } | null>(null);
  const beginnerCodeSegmentLineCountsRef = useRef<Record<string, Record<string, number>>>({});
  const beginnerLocalStatementAnchorsRef = useRef<Record<string, Record<string, number>>>({});
  const [beginnerContextMenu, setBeginnerContextMenu] = useState<BeginnerContextMenuState | null>(null);
  const [beginnerTypeCompletionState, setBeginnerTypeCompletionState] = useState<BeginnerTypeCompletionState | null>(null);
  const [beginnerInitialValueEditor, setBeginnerInitialValueEditor] = useState<BeginnerInitialValueEditorState | null>(null);
  const [beginnerColumnWidthOverrides, setBeginnerColumnWidthOverrides] = useState<BeginnerTableColumnWidthOverrides>(
    () => readBeginnerTableColumnWidthOverrides()
  );
  const beginnerColumnWidthOverridesRef = useRef(beginnerColumnWidthOverrides);
  beginnerColumnWidthOverridesRef.current = beginnerColumnWidthOverrides;

  const setBeginnerColumnWidthOverride = useCallback((tableKey: BeginnerTableKey, columnIndex: number, width: number | null) => {
    const current = beginnerColumnWidthOverridesRef.current;
    const columns = [...(current[tableKey] || [])];
    if (width === null) {
      if (columnIndex >= columns.length) return;
      columns[columnIndex] = 0;
    } else {
      columns[columnIndex] = Math.max(BEGINNER_TABLE_MIN_COLUMN_WIDTH, Math.round(width));
    }
    const next: BeginnerTableColumnWidthOverrides = { ...current, [tableKey]: columns };
    beginnerColumnWidthOverridesRef.current = next;
    setBeginnerColumnWidthOverrides(next);
  }, []);

  const persistBeginnerColumnWidthOverrides = useCallback(() => {
    writeBeginnerTableColumnWidths(beginnerColumnWidthOverridesRef.current);
  }, []);

  const beginBeginnerColumnResize = useCallback((event: ReactPointerEvent<HTMLSpanElement>, tableKey: BeginnerTableKey, columnIndex: number, startWidth: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const previousBodyCursor = document.body.style.cursor;
    const previousBodyUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const handleMove = (moveEvent: PointerEvent) => {
      setBeginnerColumnWidthOverride(tableKey, columnIndex, startWidth + moveEvent.clientX - startX);
    };
    const stop = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.style.cursor = previousBodyCursor;
      document.body.style.userSelect = previousBodyUserSelect;
      persistBeginnerColumnWidthOverrides();
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }, [persistBeginnerColumnWidthOverrides, setBeginnerColumnWidthOverride]);

  const resetBeginnerColumnWidth = useCallback((tableKey: BeginnerTableKey, columnIndex: number) => {
    setBeginnerColumnWidthOverride(tableKey, columnIndex, null);
    persistBeginnerColumnWidthOverrides();
  }, [persistBeginnerColumnWidthOverrides, setBeginnerColumnWidthOverride]);

  useEffect(() => {
    setCollapsedBeginnerProcessTargetKeys([]);
    setCollapsedBeginnerLocalGroupKeys([]);
    setIsBeginnerMemberTableCollapsed(false);
    setCollapsedBeginnerFlowBlockKeys([]);
    setHoveredBeginnerFlowLine(null);
    setActiveBeginnerFlowLine(null);
    setExpandedBeginnerCommand(null);
    setBeginnerCommandArgumentDrafts({});
    setBeginnerInitialValueEditor(null);
    beginnerCodeSegmentLineCountsRef.current = {};
    beginnerLocalStatementAnchorsRef.current = {};
  }, [sourceModelOwnerKey]);

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
    setBeginnerCompletionState(null);
    setBeginnerAutoLocalTypeState(null);
    setBeginnerJumpHighlight(null);
    beginnerCodeDraftsRef.current = {};
    beginnerCodeSegmentLineCountsRef.current = {};
    beginnerLocalStatementAnchorsRef.current = {};
    if (beginnerDraftSyncTimerRef.current !== null) {
      window.clearTimeout(beginnerDraftSyncTimerRef.current);
      beginnerDraftSyncTimerRef.current = null;
    }
    beginnerDraftSignaturesRef.current = {};
    if (beginnerCursorSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(beginnerCursorSyncFrameRef.current);
      beginnerCursorSyncFrameRef.current = null;
    }
    beginnerCursorSyncRef.current = null;
    setBeginnerCodeDrafts({});
    setBeginnerContextMenu(null);
    setBeginnerTypeCompletionState(null);
    setCollapsedBeginnerFlowBlockKeys([]);
    setHoveredBeginnerFlowLine(null);
    setActiveBeginnerFlowLine(null);
    setExpandedBeginnerCommand(null);
    setBeginnerCommandArgumentDrafts({});
    onShowCommandHint?.(null);
  }, [activeFile?.path, onShowCommandHint]);

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
  // 新手结构画布的窗口化句柄：跳转到行时先让目标块进入视口，再定位到具体行。
  const beginnerCanvasHandleRef = useRef<BeginnerVirtualCanvasHandle | null>(null);
  const beginnerJumpHighlightTimerRef = useRef<number | null>(null);
  const beginnerPointerSyncFramesRef = useRef<{ first: number | null; second: number | null }>({
    first: null,
    second: null
  });
  const cursorPositionRef = useRef(cursorPosition);
  cursorPositionRef.current = cursorPosition;
  /** 待合并提交的光标位置与编辑器状态（见 flushBeginnerCursorSync）。 */
  const beginnerCursorSyncRef = useRef<{ cursor?: { line: number; column: number }; state?: MonacoEditorState } | null>(null);
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
    const pointerFrames = beginnerPointerSyncFramesRef.current;
    if (pointerFrames.first !== null) window.cancelAnimationFrame(pointerFrames.first);
    if (pointerFrames.second !== null) window.cancelAnimationFrame(pointerFrames.second);
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
  /**
   * 新手编辑器在每次按键/选区变化/指针同步时都会刷新光标视图状态；直接 setState +
   * 回调父级会在一帧内触发多次 App/DiffViewer 重渲（实测每键 5 次 App 重渲）。
   * 这里合并到一次 requestAnimationFrame 里提交，光标同步也保持同值短路。
   */
  const beginnerCursorSyncFrameRef = useRef<number | null>(null);
  const flushBeginnerCursorSync = useCallback(() => {
    beginnerCursorSyncFrameRef.current = null;
    const pending = beginnerCursorSyncRef.current;
    beginnerCursorSyncRef.current = null;
    if (!pending) return;
    // 光标/状态栏发布属于「可以晚一点」的更新：放进 transition，输入事件优先渲染，
    // 避免每次按键都被整棵工作台的重渲挡住。
    startTransition(() => {
      if (pending.cursor) {
        setCursorPosition(current => (
          current.line === pending.cursor!.line && current.column === pending.cursor!.column ? current : pending.cursor!
        ));
      }
      if (pending.state) onEditorStateChange?.(pending.state);
    });
  }, [onEditorStateChange]);
  const scheduleBeginnerCursorSync = useCallback(() => {
    if (beginnerCursorSyncFrameRef.current !== null) return;
    beginnerCursorSyncFrameRef.current = window.requestAnimationFrame(flushBeginnerCursorSync);
  }, [flushBeginnerCursorSync]);
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
    if (cursorPositionRef.current.line !== cursor.line || cursorPositionRef.current.column !== cursor.column) {
      cursorPositionRef.current = cursor;
      beginnerCursorSyncRef.current = { ...(beginnerCursorSyncRef.current || {}), cursor };
      scheduleBeginnerCursorSync();
    }
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
    const previous = latestEditorStateRef.current;
    const stateChanged = !previous
      || previous.modelId !== state.modelId
      || previous.surface !== state.surface
      || previous.line !== state.line
      || previous.column !== state.column
      || previous.selectionLength !== state.selectionLength
      || previous.canUndo !== state.canUndo
      || previous.canRedo !== state.canRedo
      || previous.readOnly !== state.readOnly
      || previous.positionAvailable !== state.positionAvailable;
    if (stateChanged) {
      latestEditorStateRef.current = state;
      beginnerCursorSyncRef.current = { cursor, state };
      scheduleBeginnerCursorSync();
    }
  }, [onEditorStateChange, sourceModelRecord.modelId, textEditHistory]);
  const saveBeginnerViewState = useCallback(() => {
    const root = beginnerStructureScrollRef.current;
    if (!root) return false;

    const activeElement = document.activeElement;
    const textarea = activeElement instanceof HTMLTextAreaElement && root.contains(activeElement)
      ? activeElement
      : null;
    if (textarea) captureBeginnerTextareaView(textarea);

    const storedTextarea = beginnerTextareaViewRef.current;
    const fallback = cursorPositionRef.current;
    const startPosition = storedTextarea?.startPosition || fallback;
    const endPosition = storedTextarea?.endPosition || fallback;
    const backwards = storedTextarea?.selectionDirection === 'backward';
    return workbenchTextModelService.saveViewStateIfCurrent(
      { modelId: sourceModelRecord.modelId, generation: sourceModelRecord.generation },
      'beginner',
      {
        cursor: backwards ? startPosition : endPosition,
        selection: {
          anchor: backwards ? endPosition : startPosition,
          active: backwards ? startPosition : endPosition
        },
        scrollTop: root.scrollTop,
        scrollLeft: root.scrollLeft,
        opaque: {
          selectedHandler: selectedBeginnerHandlerRef.current || '',
          focusKey: storedTextarea?.focusKey || '',
          selectionStart: storedTextarea?.selectionStart || 0,
          selectionEnd: storedTextarea?.selectionEnd || 0,
          selectionDirection: storedTextarea?.selectionDirection || 'none',
          textareaScrollTop: storedTextarea?.scrollTop || 0,
          textareaScrollLeft: storedTextarea?.scrollLeft || 0
        }
      }
    );
  }, [captureBeginnerTextareaView, sourceModelRecord.generation, sourceModelRecord.modelId]);
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
  const projectGlobals = useMemo<LingCppProjectGlobalContext | undefined>(() => {
    const globalFile = allFiles.find(file => isProjectGlobalsFilePath(String(file.path || file.name || '')));
    if (!globalFile) return undefined;
    const sourceCode = activeFile?.path === globalFile.path
      ? normalizedSourceCode
      : String(globalFile.translatedContent || globalFile.originalContent || '');
    return createProjectGlobalContext(String(globalFile.path || globalFile.name || ''), sourceCode);
  }, [activeFile?.path, allFiles, moduleContext, normalizedSourceCode]);
  const projectTypes = useMemo<LingCppProjectTypeContext | undefined>(() => {
    const typeFile = allFiles.find(file => isProjectDataTypesFilePath(String(file.path || file.name || '')));
    if (!typeFile) return undefined;
    const sourceCode = activeFile?.path === typeFile.path
      ? normalizedSourceCode
      : String(typeFile.translatedContent || typeFile.originalContent || '');
    return createProjectTypeContext(String(typeFile.path || typeFile.name || ''), sourceCode);
  }, [activeFile?.path, allFiles, normalizedSourceCode]);
  const isActiveProjectDllCommandsFile = Boolean(activeFile?.path && isProjectDllCommandsFilePath(String(activeFile.path)));
  const lingCppProjectSources = useMemo(() => allFiles
    .filter(file => file.language === 'lingcpp' || String(file.path || '').toLocaleLowerCase().endsWith('.lcpp'))
    .map(file => ({
      filePath: String(file.path || file.name || ''),
      sourceCode: file.path === activeFile?.path
        ? normalizedSourceCode
        : String(file.translatedContent || file.originalContent || '')
    })), [activeFile?.path, allFiles, normalizedSourceCode]);
  const projectClassNames = useMemo(() => lingCppProjectSources.flatMap(source =>
    parseLingCpp(source.sourceCode).program.classes.map(cls => cls.name)
  ), [lingCppProjectSources]);
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
      ? buildLingCppLanguageContext(normalizedSourceCode, designerProject, moduleContext, activeFile?.path, projectGlobals, projectTypes, createProjectFunctionContext(lingCppProjectSources.map(item => ({ ...item, language: 'lingcpp' }))))
      : null,
    [activeFile?.language, activeFile?.path, designerProject, lingCppProjectSources, moduleContext, normalizedSourceCode, projectGlobals, projectTypes]
  );
  const revealControlReference = useCallback((reference: LingCppControlReference) => {
    if (!reference.symbol) return;
    const request = {
      projectId: reference.symbol.projectId,
      windowId: reference.symbol.windowId,
      controlId: reference.symbol.controlId,
      kind: reference.symbol.kind,
      name: reference.symbol.name
    };
    saveBeginnerViewState();
    if (!designerProject) return;
    setViewType('designer');
    if (commandService) {
      void commandService.executeCommand(
        REVEAL_LINGCPP_CONTROL_COMMAND,
        { ...(getCommandContext?.() || {}), 'workspace.open': true, 'lingcpp.controlReference': true },
        request
      );
    } else {
      requestDesignerNavigation(request);
    }
  }, [commandService, designerProject, getCommandContext, saveBeginnerViewState]);
  const renameControlReference = useCallback((reference: LingCppControlReference, newName: string) => {
    if (!reference.symbol || !designerProject || !moduleContext || !onUpdateProjectSources) {
      throw new Error('控件重命名需要完整的设计器、模块和项目源码上下文。');
    }
    const result = renameLingCppControlReference(
      lingCppProjectSources,
      designerProject,
      moduleContext,
      reference.symbol,
      newName
    );
    saveWindowDesignerState({
      project: result.project,
      activeWindowId: reference.symbol.windowId,
      selectedControlId: reference.symbol.kind === 'resource' ? null : reference.symbol.controlId
    });
    onUpdateProjectSources(result.sources);
  }, [designerProject, lingCppProjectSources, moduleContext, onUpdateProjectSources]);
  useEffect(() => {
    if (!commandService) return;
    const registration = acquireLingCppControlReferenceCommands(commandService);
    return () => registration.dispose();
  }, [commandService]);
  useEffect(() => {
    if (!commandService) return;
    const menus = getMenuService(commandService);
    const commandRegistration = acquireLingCppBeginnerCommands(commandService, menus);
    const targetRegistration = activeLingCppBeginnerCommandTargetService.register({
      id: beginnerCommandTargetId,
      addSubprogram: target => beginnerCommandHandlerRef.current.addSubprogram?.(target),
      addAssemblyVariable: () => beginnerCommandHandlerRef.current.addAssemblyVariable?.(),
      addLocalVariable: target => beginnerCommandHandlerRef.current.addVariable?.(target),
      addLocalConstant: target => beginnerCommandHandlerRef.current.addConstant?.(target),
      moveSubprogram: (target, direction) => beginnerCommandHandlerRef.current.moveSubprogram?.(target, direction),
      cutSubprogram: target => beginnerCommandHandlerRef.current.cutSubprogram?.(target),
      copySubprogram: target => beginnerCommandHandlerRef.current.copySubprogram?.(target),
      pasteSubprogram: target => beginnerCommandHandlerRef.current.pasteSubprogram?.(target)
    });
    activeLingCppBeginnerCommandTargetService.activate(beginnerCommandTargetId);
    return () => {
      targetRegistration.dispose();
      commandRegistration.dispose();
    };
  }, [beginnerCommandTargetId, commandService]);
  useEffect(() => {
    const registration = subscribeDesignerNavigation(request => {
      if (request.projectId === designerProject?.id) {
        saveBeginnerViewState();
        setViewType('designer');
      }
    });
    return () => registration.dispose();
  }, [designerProject?.id, saveBeginnerViewState]);
  const flushBeginnerDrafts = useCallback((applyToParent: boolean): FlushPendingEditsResult => {
    const currentSourceCode = latestSourceCodeRef.current;
    const result = applyPendingBeginnerCodeDrafts(
      currentSourceCode,
      beginnerCodeDraftsRef.current,
      beginnerLocalStatementAnchorsRef.current
    );
    if (!result.success) {
      setStructureEditError(result.diagnostics[0] || '新手代码提交失败，源码已保持不变。');
      return result;
    }
    if (result.changed && textEditHistory.record(result.sourceCode)) {
      setTextHistoryVersion(version => version + 1);
    }
    latestSourceCodeRef.current = result.sourceCode;
    beginnerCodeDraftsRef.current = {};
    beginnerCodeSegmentLineCountsRef.current = {};
    beginnerLocalStatementAnchorsRef.current = {};
    setBeginnerCodeDrafts({});
    setStructureEditError(null);
    if (applyToParent && result.changed) onUpdateSourceContent?.(result.sourceCode);
    return result;
  }, [onUpdateSourceContent, textEditHistory]);

  const applyBeginnerHistoryValue = useCallback((value: string) => {
    latestSourceCodeRef.current = value;
    beginnerCodeDraftsRef.current = {};
    beginnerCodeSegmentLineCountsRef.current = {};
    beginnerLocalStatementAnchorsRef.current = {};
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
    applyExternalSourceCode: (value: string) => {
      if (activeFile?.language === 'lingcpp' && editorExperienceMode === 'beginner') {
        applyBeginnerHistoryValue(value);
        return;
      }
      applyProfessionalHistoryValue(value);
    },
    undo: async () => {
      if (viewType === 'designer') return designerHistoryHandleRef.current?.undo() || false;
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
      if (viewType === 'designer') return designerHistoryHandleRef.current?.redo() || false;
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
  const beginnerDesignerControlCompletionCatalog = useMemo(
    () => getLingCppDesignerControlCompletions(normalizedSourceCode, designerProject, moduleContext),
    [designerProject, moduleContext, normalizedSourceCode]
  );
  const beginnerDesignerControlCompletions = useMemo(
    () => beginnerDesignerControlCompletionCatalog.map(item => {
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
    [beginnerDesignerControlCompletionCatalog]
  );
  const beginnerDesignerCommandHints = useMemo(
    () => Object.fromEntries(beginnerDesignerControlCompletionCatalog
      .filter(item => item.signature)
      .map(item => [item.label, {
        command: item.label,
        signature: item.signature || `${item.label}()`,
        returnType: item.returnType || '空',
        summary: item.documentation || item.detail,
        parameters: item.label.endsWith('.设置选择项')
          ? [{ name: '索引', type: '整数型', note: '从 0 开始的目标选择项索引。' }]
          : [],
        example: normalizeSnippetPlaceholders(item.insertText).text
      }])) as Record<string, BeginnerCommandHintInfo>,
    [beginnerDesignerControlCompletionCatalog]
  );
  const beginnerModuleCommandHints = useMemo(
    () => {
      const hints = getBeginnerModuleCommandHints(moduleContext);
      return Object.fromEntries(Object.entries(hints).map(([key, value]) => [key, {
        command: value.command,
        signature: value.signature,
        returnType: value.returnType,
        returnDescription: value.returnDescription,
        summary: value.summary,
        parameters: value.parameters,
        example: value.example
      }])) as Record<string, BeginnerCommandHintInfo>;
    },
    [moduleContext]
  );
  const beginnerCommandHints = useMemo(
    () => ({ ...BEGINNER_COMMAND_HINTS, ...beginnerModuleCommandHints, ...beginnerDesignerCommandHints }),
    [beginnerDesignerCommandHints, beginnerModuleCommandHints]
  );
  const beginnerCommandHintNames = useMemo(
    () => new Set(Object.keys(beginnerCommandHints)),
    [beginnerCommandHints]
  );
  const beginnerCommandParameterCatalog = useMemo<BeginnerCommandParameterCatalog>(() => {
    const catalog: Record<string, Array<{ name: string; type?: string; note?: string }>> = {};
    Object.values(beginnerCommandHints).forEach(hint => {
      catalog[hint.command] = hint.parameters.map(parameter => ({
        name: parameter.name,
        type: parameter.type,
        note: parameter.note
      }));
    });
    (moduleContext?.enabledModules || [])
      .filter(module => module.diagnostics.length === 0)
      .forEach(module => {
        (module.manifest.bindings?.commands || []).forEach(binding => {
          const contributed = catalog[binding.command] || [];
          const bindingParameters = binding.parameters || [];
          const count = Math.max(contributed.length, bindingParameters.length);
          catalog[binding.command] = Array.from({ length: count }, (_, index) => ({
            name: bindingParameters[index]?.name || contributed[index]?.name || `参数 ${index + 1}`,
            type: bindingParameters[index]?.type
              ? describeModuleBindingParameterType(bindingParameters[index])
              : contributed[index]?.type,
            note: bindingParameters[index]?.description || contributed[index]?.note
          }));
        });
      });
    lingCppLanguageContext?.program.classes.forEach(cls => {
      cls.methods.forEach(method => {
        catalog[method.name] = method.parameters.map(parameter => ({
          name: parameter.name,
          type: parameter.type,
          note: parameter.defaultValue ? `默认值：${parameter.defaultValue}` : undefined
        }));
      });
    });
    lingCppLanguageContext?.program.functionLibraries.forEach(library => {
      library.methods.forEach(method => {
        catalog[`${library.name}.${method.name}`] = method.parameters.map(parameter => ({
          name: parameter.name,
          type: parameter.type,
          note: parameter.defaultValue ? `默认值：${parameter.defaultValue}` : undefined
        }));
      });
    });
    return catalog;
  }, [beginnerCommandHints, lingCppLanguageContext, moduleContext]);
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
  const primaryFunctionLibrary = lingCppLanguageContext?.program.functionLibraries[0];
  const primaryMethodOwnerName = primaryLingCppClass?.name || primaryFunctionLibrary?.name;
  const activeBeginnerHandler = selectedBeginnerHandler
    || lingCppStructure.flatMap(node => node.children || []).find(node => node.kind === 'event')?.name
    || '';
  const activeDesignerWindow = designerProject?.windows.find(window => window.id === activeWindowId)
    || designerProject?.windows[0];
  // 设计器标签页对用户只显示功能名称，真实设计文件名保留在悬停提示中。
  const designerTabLabel = '界面设计';
  const designerTabTooltip = activeDesignerWindow
    ? `打开窗口设计器：界面设计（${activeDesignerWindow.title || activeDesignerWindow.fileName}）`
    : '打开窗口设计器：界面设计';
  const isLingCppBeginnerStructureMode = activeFile?.language === 'lingcpp' && editorExperienceMode === 'beginner';
  const isLingCppNativeMode = activeFile?.language === 'lingcpp' && editorExperienceMode === 'native';

  // 设计器撤销/重做：WpfDesigner 持有 DesignerHistory，这里持其 handle 与可用性镜像，
  // 让工作台顶部撤销/重做按钮与命令上下文在设计器视图下跟随真实历史状态。
  const designerHistoryHandleRef = useRef<WpfDesignerHandle>(null);
  const [designerHistoryAvailability, setDesignerHistoryAvailability] = useState<WpfDesignerHistoryAvailability>({ canUndo: false, canRedo: false });
  const handleDesignerHistoryStateChange = useCallback((availability: WpfDesignerHistoryAvailability) => {
    setDesignerHistoryAvailability(previous => (
      previous.canUndo === availability.canUndo && previous.canRedo === availability.canRedo ? previous : availability
    ));
  }, []);

  useEffect(() => {
    let surface: string | null = null;
    let surfaceReadOnly = false;
    if (viewType === 'designer') {
      surface = 'designer';
      surfaceReadOnly = false;
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
      canUndo: surface === 'designer'
        ? designerHistoryAvailability.canUndo
        : surface === 'beginner'
          ? textEditHistory.canUndo() || Object.keys(beginnerCodeDrafts).length > 0
          : false,
      canRedo: surface === 'designer'
        ? designerHistoryAvailability.canRedo
        : surface === 'beginner'
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
    designerHistoryAvailability,
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
      // The editor DOM ref is cleared before a view-switch cleanup runs. The
      // live scroll/selection state is saved on scroll and before navigation;
      // do not overwrite it with a zeroed state after the ref disappears.
      saveBeginnerViewState();
    };
  }, [
    isLingCppBeginnerStructureMode,
    captureBeginnerTextareaView,
    saveBeginnerViewState,
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
    { label: '如果真', text: BEGINNER_IF_TRUE_SNIPPET },
    { label: '选择', text: BEGINNER_SELECT_SNIPPET },
    { label: '循环', text: BEGINNER_LOOP_SNIPPET },
    { label: '判断循环', text: BEGINNER_WHILE_SNIPPET },
    { label: '计次循环', text: BEGINNER_COUNT_LOOP_SNIPPET },
    { label: '尝试', text: BEGINNER_TRY_SNIPPET },
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
      const response = await fetchWithSdkDependencies(() => fetch('/api/window-designer/native-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          project: designerProject,
          activeWindowId,
          lingCppSourceCode: normalizedSourceCode,
          lingCppSourceFilePath: activeFile?.path,
          lingCppSources: lingCppProjectSources
        })
      }));
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
      const response = await fetchWithSdkDependencies(() => fetch('/api/window-designer/native-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: designerProject,
          activeWindowId,
          lingCppSourceCode: normalizedSourceCode,
          lingCppSourceFilePath: activeFile?.path,
          lingCppSources: lingCppProjectSources
        })
      }));
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
      const response = await fetchWithSdkDependencies(() => fetch('/api/window-designer/build-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: designerProject,
          activeWindowId,
          lingCppSourceCode: normalizedSourceCode,
          lingCppSourceFilePath: activeFile?.path,
          lingCppSources: lingCppProjectSources,
          run: true
        })
      }));
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
      if (!designerProject) return;
      saveBeginnerViewState();
      setViewType('designer');
    };

    window.addEventListener('show-window-designer', handleShowWindowDesigner);
    return () => {
      window.removeEventListener('show-window-designer', handleShowWindowDesigner);
    };
  }, [designerProject, saveBeginnerViewState]);

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
    let cancelled = false;
    let attempts = 0;
    // 结构画布改为窗口化渲染后，目标行所在的块可能还没进 DOM：先让画布把该块滚入视口，
    // 再重试定位具体行（最多约 0.8s），避免跳转失效。
    const run = () => {
      if (cancelled) return;
      attempts += 1;
      const row = document.querySelector<HTMLElement>(`[data-structured-line="${structuredRevealLine}"]`);
      if (row) {
        scrollElementInsideBeginnerEditor(row, 'center');
        setStructuredRevealLine(null);
        return;
      }
      if (attempts === 1) beginnerCanvasHandleRef.current?.scrollToSourceLine(structuredRevealLine);
      if (attempts < 12) window.setTimeout(run, 60);
      else setStructuredRevealLine(null);
    };
    const timer = window.setTimeout(run, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
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

    // 专业模式 Monaco：在当前光标选区插入，并把光标/选中区落在片段占位词上。
    // 插入引发的 onChange 会自动同步 App 状态与撤销历史，无需在这里改 state。
    const placeholder = findSnippetPlaceholderSelection(snippet);
    if (monacoEditorRef.current?.insertSnippet(snippet, placeholder?.offset, placeholder?.length)) return;

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
      return <span key={index} style={{ color: getLingCppCommentTokenColor(isDarkMode) }}>{token}</span>;
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
          <span style={{ color: getLingCppCommentTokenColor(isDarkMode) }}>{body}</span>
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
              return <span key={index} className="text-[color:var(--lingcpp-comment-color)] font-mono italic">{part}</span>;
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
            return <span key={index} className="text-[color:var(--lingcpp-comment-color)] font-mono">{part}</span>;
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
    if (row.group === 'member') setIsBeginnerMemberTableCollapsed(false);
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
    if (row.editKind === 'note' || row.editKind === 'local') return;
    setStructureEditDraft({
      mode: row.editKind,
      rowId: row.id,
      line: row.line,
      className: row.className,
      targetName: row.targetName || row.name,
      name: row.editKind === 'event' || row.editKind === 'method'
        ? row.targetName || row.name
        : row.name,
      type: row.editKind === 'member' || row.editKind === 'global' ? row.type || '' : '',
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

    if ((draft.mode === 'package' || draft.mode === 'global' || draft.mode === 'class' || draft.mode === 'member' || draft.mode === 'method' || draft.mode === 'event' || draft.mode === 'add-member' || draft.mode === 'add-event') && !draft.name.trim()) {
      setStructureEditError('名称不能为空。');
      return;
    }

    if (draft.mode === 'package') {
      edits.push({ kind: 'update-package', packageName: draft.name.trim() });
      if (note && draft.line) edits.push({ kind: 'update-note', line: draft.line, note });
    }
    if (draft.mode === 'global') {
      return applyStructureAstEdits([{
        kind: 'update-global',
        globalName: draft.targetName,
        newName: draft.name,
        type: draft.type,
        initialValue: draft.initialValue || undefined,
        note: draft.note
      }], draft.line);
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

  const deleteStructuredRow = async (row: LingCppStructuredReadingRow) => {
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
    if (!await requestWorkbenchConfirm({ title: '删除确认', description: `确定删除${label}「${row.targetName}」吗？`, confirmLabel: '删除', cancelLabel: '取消' })) return;
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
                  : tone === 'note'
                    ? 'text-[color:var(--lingcpp-comment-color)]'
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

  const resetNewEventDraft = () => {
    setNewEventDraft({ handlerName: '', parameters: '' });
  };

  const resetNewFunctionDraft = () => {
    setNewFunctionDraft({ returnType: '空', name: '', parameters: '' });
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
      resetNewEventDraft();
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
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitNewEventDraft({ [field]: event.currentTarget.value });
        }
        if (event.key === 'Escape') {
          resetNewEventDraft();
          event.currentTarget.blur();
        }
      }}
      className={`${directInputClasses(tone)} disabled:cursor-not-allowed disabled:opacity-40`}
      title="填写处理器名和参数后点击“新增”"
    />
  );

  const commitNewFunctionDraft = (patch: Partial<typeof newFunctionDraft> = {}) => {
    const draft = { ...newFunctionDraft, ...patch };
    setNewFunctionDraft(draft);
    const name = draft.name.trim();
    if (!name) return;
    if (!primaryMethodOwnerName) {
      setStructureEditError('当前源码里还没有类或功能库，无法新增功能代码。');
      return;
    }

    const applied = applyStructureAstEdits([{
      kind: 'add-method',
      className: primaryMethodOwnerName,
      method: {
        name,
        returnType: draft.returnType.trim() || '空',
        access: primaryFunctionLibrary ? '公开' : undefined,
        parameters: parseParameterDraft(draft.parameters),
        note: '新手模式新增的功能代码'
      }
    }]);
    if (applied) {
      resetNewFunctionDraft();
      setSelectedBeginnerCodeTarget({ className: primaryMethodOwnerName, methodName: name });
      setExpandedBeginnerFunctionTargetKey(`${primaryMethodOwnerName}:method:${name}`);
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
      disabled={!onUpdateSourceContent || !primaryMethodOwnerName}
      onChange={event => setNewFunctionDraft(current => ({ ...current, [field]: event.target.value }))}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitNewFunctionDraft({ [field]: event.currentTarget.value });
        }
        if (event.key === 'Escape') {
          resetNewFunctionDraft();
          event.currentTarget.blur();
        }
      }}
      className={`${directInputClasses(tone)} disabled:cursor-not-allowed disabled:opacity-40`}
      title="填写返回值、功能名和参数后点击“新增”"
    />
  );

  const methodBodyText = (method: LingCppMethod) => {
    const meaningfulStatements = method.statements.filter(statement => statement.text.trim());
    const baseIndentLength = meaningfulStatements.reduce(
      (minimum, statement) => Math.min(minimum, statement.indent.length),
      Number.POSITIVE_INFINITY
    );
    const baseIndent = Number.isFinite(baseIndentLength) ? baseIndentLength : 0;
    const relativeLines = method.statements.map(statement =>
      `${statement.indent.slice(Math.min(baseIndent, statement.indent.length))}${statement.text}`
    );
    return formatBeginnerFlowIndentation(relativeLines).join('\n').replace(/\s+$/u, '');
  };

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
    nextBody: string,
    localStatementAnchors?: Record<string, number>
  ) => {
    const normalizedNext = formatBeginnerFlowIndentation(nextBody.split(/\r?\n/u))
      .join('\n')
      .replace(/\s+$/u, '');
    if (normalizedNext === currentBody.replace(/\s+$/u, '')) return true;
    return applyStructureAstEdits([{
      kind: 'update-method-body',
      className,
      methodName,
      bodyLines: normalizedNext ? normalizedNext.split(/\r?\n/u) : [],
      localStatementAnchors
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
      global: '编辑项目全局变量',
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
      global: '项目全局变量',
      class: '类',
      member: '成员声明',
      local: '局部声明',
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
      global: '项目全局变量',
      class: '类',
      member: '成员声明',
      local: '局部声明',
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
    const codeTargets = [
      ...(lingCppLanguageContext?.program.classes || []).map(cls => ({ name: cls.name, methods: cls.methods })),
      ...(lingCppLanguageContext?.program.functionLibraries || []).map(library => ({ name: library.name, methods: library.methods }))
    ].flatMap(owner =>
      owner.methods
        .filter(method => method.kind !== 'destructor')
        .map(method => ({ className: owner.name, method }))
    );
    const functionTargets = codeTargets.filter(target => target.method.kind === 'method');
    const isFunctionLibraryOwner = (ownerName: string) => lingCppLanguageContext?.program.functionLibraries.some(
      library => normalizeIdentifier(library.name) === normalizeIdentifier(ownerName)
    ) ?? false;
    const functionCallName = (target: BeginnerCodeTarget) =>
      isFunctionLibraryOwner(target.className)
        ? `${target.className}.${target.method.name}`
        : target.method.name;
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
    const commonLingCppTypes = ['文本型', '整数型', '逻辑型', '小数型', '长整数型', '字节集', '按钮', '标签', '编辑框', '复选框', '窗体', '对象'];
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
      ...(projectTypes?.dataTypes || []).map(dataType => dataType.name),
      ...beginnerModuleCodeCompletions.filter(item => item.kind === '类型').map(item => item.label),
      ...memberRows.map(row => row.type || ''),
      ...codeTargets.flatMap(target => [target.method.returnType, ...target.method.parameters.map(parameter => parameter.type)])
    ].filter(Boolean)));
    const beginnerAutoLocalReturnTypes = new Map<string, string>([
      ...Object.values(beginnerCommandHints)
        .filter(hint => hint.returnType && !/^(空|无|流程控制)$/u.test(hint.returnType))
        .map(hint => [normalizeIdentifier(hint.command), hint.returnType] as [string, string]),
      ...codeTargets
        .filter(target => target.method.kind === 'method' && !/^(空|无)$/u.test(target.method.returnType))
        .map(target => [normalizeIdentifier(target.method.name), target.method.returnType] as [string, string])
    ]);
    const typeCompletionCatalog = buildBeginnerTypeCompletionCatalog(typeSuggestions);
    const resolveBeginnerTypeInput = (rawValue: string) =>
      resolveBeginnerTypeAlias(typeCompletionCatalog, rawValue);
    const updateBeginnerTypeCompletion = (
      inputKey: string,
      input: HTMLInputElement,
      includeAll = false
    ) => {
      if (!onUpdateSourceContent) return;
      const items = filterBeginnerTypeCompletions(typeCompletionCatalog, input.value, includeAll).slice(0, 8);
      const layout = getBeginnerTypeCompletionLayout(input, items.length);
      setBeginnerTypeCompletionState(items.length > 0
        ? { inputKey, value: input.value, items, selectedIndex: 0, ...layout }
        : null
      );
    };
    const closeBeginnerTypeCompletionLater = (inputKey: string) => {
      window.setTimeout(() => {
        setBeginnerTypeCompletionState(current => current?.inputKey === inputKey ? null : current);
      }, 120);
    };
    const moveBeginnerTypeCompletion = (inputKey: string, delta: number) => {
      setBeginnerTypeCompletionState(current => {
        if (!current || current.inputKey !== inputKey || current.items.length === 0) return current;
        return {
          ...current,
          selectedIndex: (current.selectedIndex + delta + current.items.length) % current.items.length
        };
      });
    };
    const renderBeginnerTypeCompletionPopup = (
      inputKey: string,
      onApply: (item: BeginnerTypeCompletionItem, input: HTMLInputElement | null) => void
    ) => {
      const typeCompletion = beginnerTypeCompletionState?.inputKey === inputKey
        ? beginnerTypeCompletionState
        : null;
      if (!typeCompletion) return null;
      return (
        <div className={`absolute left-0 z-[90] w-64 max-w-[calc(100vw_-_24px)] overflow-hidden rounded border text-[11px] shadow-xl ${
          typeCompletion.placement === 'above' ? 'bottom-full mb-1' : 'top-full mt-1'
        } ${
          isDarkMode ? 'border-[#343442] bg-[#17181f] text-slate-200 shadow-black/30' : 'border-slate-200 bg-white text-slate-800 shadow-slate-200/80'
        }`} role="listbox" aria-label="类型补全">
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
                role="option"
                aria-selected={index === typeCompletion.selectedIndex}
                onMouseDown={event => {
                  event.preventDefault();
                  const input = event.currentTarget.closest('[data-beginner-type-wrap]')?.querySelector('input');
                  onApply(item, input instanceof HTMLInputElement ? input : null);
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
      );
    };
    const defaultCodeArgument = (parameter: LingCppParameter) => {
      const defaultValue = parameter.defaultValue?.trim();
      if (defaultValue) return defaultValue;
      if (/文本/u.test(parameter.type)) return '"文本"';
      if (/逻辑/u.test(parameter.type)) return '真';
      if (/小数|双精度/u.test(parameter.type)) return '0.0';
      if (/整数|长整数/u.test(parameter.type)) return '0';
      return parameter.name || parameter.type || '参数';
    };
    // 目录输入指纹：模块清单/常量/项目全局/程序集成员/子程序签名（含局部变量名与类型）/类型表/设计器窗口。
    // 输入未变时（连续输入、光标同步、补全状态变化）直接复用缓存目录，不重建数千条的 Map。
    const completionCatalogFingerprint = [
      beginnerModuleCodeCompletions.length,
      beginnerDesignerControlCompletions.length,
      moduleContext?.showAdvancedApi === true ? 'adv' : '',
      (moduleContext?.enabledModules || []).map(module => `${module.manifest.id}@${module.manifest.version ?? ''}`).join(','),
      (projectGlobals?.constants || []).map(constant => `${constant.name}=${constant.initialValue}`).join(','),
      (projectGlobals?.globals || []).map(global => `${global.name}:${global.type}`).join(','),
      memberRows.map(row => `${row.targetName || row.name}:${row.type || ''}`).join(','),
      codeTargets.map(target => `${target.className}.${target.method.kind}.${target.method.name}(${target.method.parameters.map(parameter => parameter.type).join('/')})=${target.method.returnType || '空'}:locals=${(target.method.locals || []).map(local => `${local.name}:${local.type}`).join('/')}`).join(','),
      typeSuggestions.join(','),
      (designerProject?.windows || []).map(window => `${window.className || ''}|${window.title || ''}|${window.fileName || ''}`).join(',')
    ].join('\u0002');
    const cachedCompletionCatalog = beginnerCompletionCatalogCacheRef.current;
    const completionCatalog = cachedCompletionCatalog && cachedCompletionCatalog.fingerprint === completionCatalogFingerprint
      ? cachedCompletionCatalog
      : (() => {
          // 启用模块的同名命令优先：内置条目（如 调试输出）在模块也提供同名命令时退位，
          // 避免补全面板出现两条同名命令（用户拍板：去掉上面的内置版，保留带真实签名的模块版）。
          const moduleCommandLabels = new Set(beginnerModuleCodeCompletions.map(item => item.label));
          const builtinCompletions = beginnerModuleCodeCompletions.length > 0
            ? BEGINNER_CODE_COMPLETIONS.filter(item => !moduleCommandLabels.has(item.label))
            : BEGINNER_CODE_COMPLETIONS;
          const catalog = {
            fingerprint: completionCatalogFingerprint,
            windowTargetItems: buildBeginnerWindowTargetCompletions(designerProject)
              .map(withBeginnerCompletionSearchValues),
            items: Array.from(
              new Map([
                ...builtinCompletions,
                ...beginnerModuleCodeCompletions,
                ...beginnerDesignerControlCompletions,
                ...getModuleConstants(moduleContext?.enabledModules || [])
                  .filter(constant => moduleContext?.showAdvancedApi === true || constant.level !== 'advanced')
                  .map(constant => createBeginnerConstantCompletion({
                    name: constant.name,
                    type: constant.type,
                    origin: '模块常量',
                    value: typeof constant.value === 'boolean' ? (constant.value ? '真' : '假') : String(constant.value),
                    moduleName: constant.moduleName,
                    aliases: [constant.moduleId, constant.description]
                  })),
                ...(projectGlobals?.constants || []).map(constant => createBeginnerConstantCompletion({
                  name: constant.name,
                  type: constant.type,
                  origin: '项目常量',
                  value: constant.initialValue
                })),
                ...(projectGlobals?.globals || []).map(global => createBeginnerVariableCompletion({
                  name: global.name,
                  type: global.type,
                  scope: '项目全局变量'
                })),
                ...memberRows.map(row => createBeginnerVariableCompletion({
                  name: row.targetName || row.name,
                  type: row.type,
                  scope: '程序集变量',
                  aliases: [row.name]
                })),
                ...codeTargets
                  .filter(target => target.method.kind === 'method')
                  .map(target => ({
                    label: functionCallName(target),
                    detail: `${target.method.returnType || '空'} 子程序调用`,
                    insertText: `${functionCallName(target)}(${target.method.parameters.map(defaultCodeArgument).join(', ')})`,
                    aliases: Array.from(new Set([
                      target.method.name,
                      '子程序', '功能', '调用',
                      ...buildChineseCompletionSearchAliases(functionCallName(target)),
                      ...buildChineseCompletionSearchAliases(target.method.name)
                    ])),
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
            ).map(withBeginnerCompletionSearchValues),
            perTargetItems: new Map<string, BeginnerCodeCompletion[]>()
          };
          beginnerCompletionCatalogCacheRef.current = catalog;
          return catalog;
        })();
    const windowTargetCompletionItems = completionCatalog.windowTargetItems;
    const beginnerCodeCompletionItems = completionCatalog.items;
    const getBeginnerCodeCompletionItems = (target: BeginnerCodeTarget) => {
      // 「目录 + 该目标局部变量」的合并结果按目标缓存：每次击键的补全过滤都要拿这份清单。
      const targetKey = codeTargetKey(target);
      const cached = completionCatalog.perTargetItems.get(targetKey);
      if (cached) return cached;
      const merged = Array.from(
        new Map([
          ...beginnerCodeCompletionItems,
          ...(target.method.locals || []).map(local => withBeginnerCompletionSearchValues(createBeginnerVariableCompletion({
            name: local.name,
            type: local.type,
            scope: local.isConstant ? '局部常量' : '局部变量',
            ownerName: target.method.name
          })))
        ].map(item => [`${item.label}:${item.insertText}`, item]))
          .values()
      );
      completionCatalog.perTargetItems.set(targetKey, merged);
      return merged;
    };
    const cancelBeginnerDraftSync = () => {
      if (beginnerDraftSyncTimerRef.current !== null) {
        window.clearTimeout(beginnerDraftSyncTimerRef.current);
        beginnerDraftSyncTimerRef.current = null;
      }
    };
    /**
     * 草稿的「结构指纹」：行数 + 每行缩进 + 控制流关键字。
     * 只改字词（结构不变）时不需要重渲结构画布，因为流程图/分支折叠不会变；
     * 改行数、缩进或 如果/循环/选择 之类关键字时才需要。
     */
    const beginnerDraftStructureSignature = (value: string) => value
      .split('\n')
      .map(line => {
        const indent = line.match(/^\s*/u)?.[0].length ?? 0;
        const head = line.trim().match(/^[\u4e00-\u9fa5A-Za-z_]+/u)?.[0] ?? '';
        return `${indent}:${BEGINNER_FLOW_KEYWORD_HEADS.has(head) ? head : '·'}`;
      })
      .join('|');
    const scheduleBeginnerDraftSync = (delay = 400) => {
      cancelBeginnerDraftSync();
      beginnerDraftSyncTimerRef.current = window.setTimeout(() => {
        beginnerDraftSyncTimerRef.current = null;
        const drafts = beginnerCodeDraftsRef.current;
        const nextSignatures: Record<string, string> = { ...beginnerDraftSignaturesRef.current };
        let changed = false;
        for (const [key, value] of Object.entries(drafts)) {
          const signature = beginnerDraftStructureSignature(value);
          if (nextSignatures[key] !== signature) {
            nextSignatures[key] = signature;
            changed = true;
          }
        }
        for (const key of Object.keys(nextSignatures)) {
          if (!(key in drafts)) {
            delete nextSignatures[key];
            changed = true;
          }
        }
        if (!changed) return;
        beginnerDraftSignaturesRef.current = nextSignatures;
        setBeginnerCodeDrafts({ ...drafts });
      }, delay);
    };
    const updateBeginnerCodeDraft = (
      target: BeginnerCodeTarget,
      nextValue: string,
      options?: { defer?: boolean }
    ) => {
      const targetKey = codeTargetKey(target);
      const nextDrafts = { ...beginnerCodeDraftsRef.current, [targetKey]: nextValue };
      beginnerCodeDraftsRef.current = nextDrafts;
      // 连续输入只写 ref，再空闲 500ms 同步一次 state：
      // 之前每个按键都 setState → 重渲整棵结构画布，实测 ~100ms/键。
      if (options?.defer) {
        scheduleBeginnerDraftSync();
        return;
      }
      cancelBeginnerDraftSync();
      beginnerDraftSignaturesRef.current = {
        ...beginnerDraftSignaturesRef.current,
        [targetKey]: beginnerDraftStructureSignature(nextValue)
      };
      // 外部改写（补全上屏、插入局部变量、格式化等）需要让 textarea 重新挂载以显示新内容。
      beginnerDraftExternalRevisionRef.current = {
        ...beginnerDraftExternalRevisionRef.current,
        [targetKey]: (beginnerDraftExternalRevisionRef.current[targetKey] ?? 0) + 1
      };
      setBeginnerCodeDrafts(nextDrafts);
    };
    const getCodeSegmentLineCounts = (
      target: BeginnerCodeTarget,
      segments: BeginnerMethodBodySegment[]
    ) => {
      const targetKey = codeTargetKey(target);
      const current = beginnerCodeSegmentLineCountsRef.current[targetKey] || {};
      const next = { ...current };
      segments.forEach(segment => {
        if (segment.kind === 'code' && next[segment.id] === undefined) {
          next[segment.id] = segment.statements.length;
        }
      });
      beginnerCodeSegmentLineCountsRef.current[targetKey] = next;
      let statementIndex = 0;
      const localAnchors: Record<string, number> = {};
      segments.forEach(segment => {
        if (segment.kind === 'code') {
          statementIndex += next[segment.id] ?? segment.statements.length;
          return;
        }
        segment.locals.forEach(local => {
          localAnchors[local.name] = statementIndex;
        });
      });
      beginnerLocalStatementAnchorsRef.current[targetKey] = localAnchors;
      return next;
    };
    const getCodeSegmentDraft = (
      target: BeginnerCodeTarget,
      context: BeginnerCodeSegmentContext
    ) => {
      const targetKey = codeTargetKey(target);
      const fullBody = beginnerCodeDraftsRef.current[targetKey] ?? methodBodyText(target.method);
      const fullLines = fullBody ? fullBody.split('\n') : [];
      const counts = getCodeSegmentLineCounts(target, context.segments);
      const codeSegments = context.segments.filter((segment): segment is BeginnerCodeSegment => segment.kind === 'code');
      const segmentIndex = codeSegments.findIndex(segment => segment.id === context.segment.id);
      const start = codeSegments
        .slice(0, Math.max(0, segmentIndex))
        .reduce((total, segment) => total + (counts[segment.id] ?? segment.statements.length), 0);
      const isLastCodeSegment = segmentIndex === codeSegments.length - 1;
      const count = isLastCodeSegment
        ? Math.max(0, fullLines.length - start)
        : counts[context.segment.id] ?? context.segment.statements.length;
      return {
        value: fullLines.slice(start, start + count).join('\n'),
        start,
        count
      };
    };
    const updateBeginnerCodeSegmentDraft = (
      target: BeginnerCodeTarget,
      context: BeginnerCodeSegmentContext,
      nextSegmentValue: string,
      options?: { defer?: boolean }
    ) => {
      const targetKey = codeTargetKey(target);
      const currentFullBody = beginnerCodeDraftsRef.current[targetKey] ?? methodBodyText(target.method);
      const currentFullLines = currentFullBody ? currentFullBody.split('\n') : [];
      const currentSegment = getCodeSegmentDraft(target, context);
      const nextSegmentLines = nextSegmentValue ? nextSegmentValue.split('\n') : [];
      const nextFullLines = [
        ...currentFullLines.slice(0, currentSegment.start),
        ...nextSegmentLines,
        ...currentFullLines.slice(currentSegment.start + currentSegment.count)
      ];
      const counts = getCodeSegmentLineCounts(target, context.segments);
      beginnerCodeSegmentLineCountsRef.current[targetKey] = {
        ...counts,
        [context.segment.id]: nextSegmentLines.length
      };
      getCodeSegmentLineCounts(target, context.segments);
      updateBeginnerCodeDraft(target, nextFullLines.join('\n'), options);
    };
    const clearBeginnerCodeDraft = (target: BeginnerCodeTarget) => {
      const targetKey = codeTargetKey(target);
      if (!(targetKey in beginnerCodeDraftsRef.current)) return;
      const nextDrafts = { ...beginnerCodeDraftsRef.current };
      delete nextDrafts[targetKey];
      beginnerCodeDraftsRef.current = nextDrafts;
      const nextCounts = { ...beginnerCodeSegmentLineCountsRef.current };
      delete nextCounts[targetKey];
      beginnerCodeSegmentLineCountsRef.current = nextCounts;
      const nextAnchors = { ...beginnerLocalStatementAnchorsRef.current };
      delete nextAnchors[targetKey];
      beginnerLocalStatementAnchorsRef.current = nextAnchors;
      beginnerDraftExternalRevisionRef.current = {
        ...beginnerDraftExternalRevisionRef.current,
        [targetKey]: (beginnerDraftExternalRevisionRef.current[targetKey] ?? 0) + 1
      };
      setBeginnerCodeDrafts(nextDrafts);
    };
    const updateBeginnerCompletion = (
      target: BeginnerCodeTarget,
      input: HTMLTextAreaElement,
      includeAll = false,
      segmentContext?: BeginnerCodeSegmentContext
    ) => {
      const context = getBeginnerCompletionContext(input.value, input.selectionStart);
      const targetKey = codeTargetKey(target);
      const segmentId = segmentContext?.segment.id || 'all';
      if (!shouldShowBeginnerCompletion(context, includeAll)) {
        setBeginnerCompletionState(current => current?.targetKey === targetKey ? null : current);
        return;
      }
      const token = context.token;
      // # 触发：只出常量清单，且 # 已在源码中，上屏剥掉前缀避免 ##。
      const sourceItems = context.isWindowTargetContext
        ? windowTargetCompletionItems
        : context.isWindowPlacementContext
          ? BEGINNER_WINDOW_PLACEMENT_COMPLETIONS
          : context.isConstantReference
            ? getBeginnerCodeCompletionItems(target)
              .filter(item => item.insertText.startsWith('#'))
              .map(item => ({ ...item, insertText: item.insertText.slice(1) }))
            : getBeginnerCodeCompletionItems(target);
      const items = filterBeginnerCodeCompletions(token, includeAll || context.isWindowTargetContext || context.isWindowPlacementContext || context.isConstantReference, sourceItems);
      if (items.length === 0) {
        setBeginnerCompletionState(current => current?.targetKey === targetKey ? null : current);
        return;
      }
      setBeginnerCompletionState({
        targetKey,
        segmentId,
        token,
        cursor: input.selectionStart,
        items,
        selectedIndex: 0,
        position: getBeginnerCompletionPanelPosition(input, token, items.length),
        target,
        segmentContext,
        viewKey: input.dataset.textModelViewKey || ''
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
    const updateBeginnerCommandHint = (
      _target: BeginnerCodeTarget,
      input: HTMLTextAreaElement
    ) => {
      const token = getBeginnerCommandTokenAtCursor(input.value, input.selectionStart, beginnerCommandHintNames);
      if (!token) {
        // 功能库限定调用提示：光标落在 库名.功能名 任一段都显示签名与说明。
        const libraryCall = getLibraryCallFromInput(input);
        if (libraryCall && lingCppLanguageContext) {
          const library = (lingCppLanguageContext.projectFunctions?.libraries || []).find(
            item => item.name === libraryCall.libraryName
          );
          const method = library?.methods.find(item => item.name === libraryCall.functionName);
          if (library && method) {
            const parameterText = method.parameters.map(parameter => `${parameter.type} ${parameter.name}`).join(', ');
            onShowCommandHint?.({
              command: `${library.name}.${method.name}`,
              signature: `${method.returnType || '空'} ${library.name}.${method.name}(${parameterText})`,
              returnType: method.returnType || '空',
              summary: `${library.name} 功能库${method.access === '公开' ? '公开' : '私有'}功能；库内路径 ${library.filePath}`,
              parameters: method.parameters.map(parameter => ({
                name: parameter.name,
                type: parameter.type,
                note: parameter.defaultValue ? `默认值：${parameter.defaultValue}` : ''
              })),
              example: `${library.name}.${method.name}(${method.parameters.map(parameter => /文本/u.test(parameter.type) ? '"文本"' : /逻辑/u.test(parameter.type) ? '真' : /小数|双精度/u.test(parameter.type) ? '0.0' : '0').join(', ')})`
            });
            return;
          }
        }
        onShowCommandHint?.(null);
        return;
      }

      const info = beginnerCommandHints[token.token];
      if (!info) {
        onShowCommandHint?.(null);
        return;
      }
      onShowCommandHint?.(info);
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
      completion: BeginnerCodeCompletion,
      segmentContext?: BeginnerCodeSegmentContext,
      completionState?: BeginnerCompletionState | null
    ) => {
      const cursor = input.selectionStart;
      const token = getBeginnerCompletionToken(input.value, cursor);
      // 面板弹出后光标可能已被鼠标/方向键移动（如粘贴后点击括号右侧再按回车）：
      // token 与光标任一不再对应面板状态时上屏，会把候选插到无关位置（变量名在括号外重复）。
      // 此时只关闭面板不上屏，返回 false 让按键继续走普通分支。
      if (!completionState || completionState.token !== token || completionState.cursor !== cursor) {
        closeBeginnerCompletion(target);
        return false;
      }
      const tokenStart = cursor - token.length;
      const rawNextValue = `${input.value.slice(0, tokenStart)}${completion.insertText}${input.value.slice(input.selectionEnd)}`;
      const cursorOffset = completion.cursorOffset ?? completion.insertText.length;
      const rawNextCursor = tokenStart + cursorOffset;
      const selectLength = completion.selectLength ?? 0;
      const includesStructureLines = completion.insertText.includes('\n');
      const nextValue = includesStructureLines
        ? formatBeginnerFlowIndentation(rawNextValue.split('\n')).join('\n')
        : rawNextValue;
      const mapRawOffsetToFormatted = (offset: number) => includesStructureLines
        ? formatBeginnerFlowIndentation(rawNextValue.slice(0, offset).split('\n')).join('\n').length
        : offset;
      const nextCursor = mapRawOffsetToFormatted(rawNextCursor);
      const nextSelectionEnd = mapRawOffsetToFormatted(rawNextCursor + selectLength);

      input.value = nextValue;
      // 已直接写入 DOM 的改写走 defer：立即同步会自增外部修订号（参与 textarea key）
      // 触发重挂，随后 rAF 对旧节点恢复光标会静默失效。
      if (segmentContext) updateBeginnerCodeSegmentDraft(target, segmentContext, nextValue, { defer: true });
      else updateBeginnerCodeDraft(target, nextValue, { defer: true });
      input.focus();
      window.requestAnimationFrame(() => {
        const fresh = resolveBeginnerCodeTextarea(input);
        if (!fresh) return;
        fresh.focus();
        fresh.setSelectionRange(nextCursor, nextSelectionEnd);
        captureBeginnerTextareaView(fresh);
      });
      closeBeginnerCompletion(target);
      return true;
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
      event: React.ChangeEvent<HTMLTextAreaElement>,
      segmentContext?: BeginnerCodeSegmentContext
    ) => {
      setBeginnerAutoLocalTypeState(current =>
        current?.targetKey === codeTargetKey(target) ? null : current
      );
      if (segmentContext) updateBeginnerCodeSegmentDraft(target, segmentContext, event.currentTarget.value, { defer: true });
      else updateBeginnerCodeDraft(target, event.currentTarget.value, { defer: true });
      updateBeginnerCompletion(target, event.currentTarget, false, segmentContext);
      updateBeginnerCommandHint(target, event.currentTarget);
    };
    const handleBeginnerCodeBlur = (
      target: BeginnerCodeTarget,
      currentBody: string,
      _event: React.FocusEvent<HTMLTextAreaElement>
    ) => {
      closeBeginnerCompletion(target);
      const targetKey = codeTargetKey(target);
      const nextBody = beginnerCodeDraftsRef.current[targetKey] ?? currentBody;
      const applied = commitBeginnerCodeBody(
        target.className,
        target.method.name,
        currentBody,
        nextBody,
        beginnerLocalStatementAnchorsRef.current[targetKey]
      );
      if (applied) clearBeginnerCodeDraft(target);
    };
    const insertBeginnerLocalAtCursor = (
      target: BeginnerCodeTarget,
      input: HTMLTextAreaElement,
      segmentContext?: BeginnerCodeSegmentContext,
      isConstant = false
    ) => {
      const localKindLabel = isConstant ? '局部常量' : '局部变量';
      const structureScroll = beginnerStructureScrollRef.current;
      const previousStructureScroll = structureScroll
        ? { top: structureScroll.scrollTop, left: structureScroll.scrollLeft }
        : null;
      captureBeginnerTextareaView(input);
      saveBeginnerViewState();
      if (segmentContext) updateBeginnerCodeSegmentDraft(target, segmentContext, input.value);
      else updateBeginnerCodeDraft(target, input.value);
      const targetKey = codeTargetKey(target);
      const statementIndex = getBeginnerLocalInsertStatementIndex(
        input.value,
        input.selectionStart,
        segmentContext?.segment.statementStartIndex ?? 0
      );
      const flushed = applyPendingBeginnerCodeDrafts(
        latestSourceCodeRef.current,
        beginnerCodeDraftsRef.current,
        beginnerLocalStatementAnchorsRef.current
      );
      if (!flushed.success) {
        setStructureEditError(flushed.diagnostics[0] || `插入${localKindLabel}前提交正文失败。`);
        return;
      }

      const parsed = parseLingCpp(flushed.sourceCode);
      const parsedClass = parsed.program.classes.find(cls => cls.name === target.className);
      const parsedMethod = parsedClass?.methods.find(method =>
        method.name === target.method.name && method.kind === target.method.kind
      );
      if (!parsedMethod) {
        setStructureEditError(`无法定位子程序 ${target.method.name}，${localKindLabel}未插入。`);
        return;
      }

      const name = uniqueBeginnerName(localKindLabel, [
        ...parsedMethod.parameters.map(parameter => parameter.name),
        ...(parsedMethod.locals || []).map(local => local.name)
      ]);
      const statementAtCursor = parsedMethod.statements[Math.min(statementIndex, parsedMethod.statements.length - 1)];
      const insertBeforeLine = statementIndex < parsedMethod.statements.length
        ? statementAtCursor?.line
        : parsedMethod.endLine;
      const inserted = applyLingCppAstEdit(flushed.sourceCode, {
        kind: 'add-local',
        className: target.className,
        methodName: target.method.name,
        insertBeforeLine,
        local: {
          name,
          type: '文本型',
          initialValue: '""',
          isConstant
        }
      });
      if (!inserted.success) {
        setStructureEditError(inserted.error || inserted.diagnostics[0]?.message || `${localKindLabel}插入失败。`);
        return;
      }

      beginnerCodeDraftsRef.current = {};
      beginnerCodeSegmentLineCountsRef.current = {};
      beginnerLocalStatementAnchorsRef.current = {};
      setBeginnerCodeDrafts({});
      setCollapsedBeginnerProcessTargetKeys(current => current.filter(key => key !== targetKey));
      setStructureEditError(null);
      updateSourceCode(inserted.sourceCode);
      window.requestAnimationFrame(() => {
        const root = beginnerStructureScrollRef.current;
        if (root && previousStructureScroll) {
          root.scrollTop = previousStructureScroll.top;
          root.scrollLeft = previousStructureScroll.left;
        }
        const localNameInput = root?.querySelector(
          `[data-beginner-local-target-key="${CSS.escape(targetKey)}"][data-beginner-local-name="${CSS.escape(name)}"]`
        );
        if (localNameInput instanceof HTMLInputElement) {
          localNameInput.focus({ preventScroll: true });
          localNameInput.select();
        }
        if (root && previousStructureScroll) {
          root.scrollTop = previousStructureScroll.top;
          root.scrollLeft = previousStructureScroll.left;
        }
      });
    };
    const commitBeginnerAutoLocal = (
      target: BeginnerCodeTarget,
      input: HTMLTextAreaElement,
      segmentContext: BeginnerCodeSegmentContext,
      variableName: string,
      variableType: string
    ) => {
      const targetKey = codeTargetKey(target);
      const cursor = input.selectionEnd;
      const lineStart = input.value.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
      const meaningfulLinesBefore = input.value
        .slice(0, lineStart)
        .split('\n')
        .filter(line => line.trim()).length;
      const segmentDraft = getCodeSegmentDraft(target, segmentContext);
      const statementIndex = segmentDraft.start + meaningfulLinesBefore;
      const nextSegmentValue = `${input.value.slice(0, input.selectionStart)}\n${input.value.slice(input.selectionEnd)}`;

      updateBeginnerCodeSegmentDraft(target, segmentContext, input.value);
      const flushed = applyPendingBeginnerCodeDrafts(
        latestSourceCodeRef.current,
        beginnerCodeDraftsRef.current,
        beginnerLocalStatementAnchorsRef.current
      );
      if (!flushed.success) {
        setStructureEditError(flushed.diagnostics[0] || '自动声明局部变量前提交正文失败。');
        return false;
      }

      const parsed = parseLingCpp(flushed.sourceCode);
      const parsedClass = parsed.program.classes.find(cls => cls.name === target.className);
      const parsedMethod = parsedClass?.methods.find(method =>
        method.name === target.method.name && method.kind === target.method.kind
      );
      if (!parsedMethod) {
        setStructureEditError(`无法定位子程序 ${target.method.name}，局部变量未自动声明。`);
        return false;
      }

      const normalizedVariableName = normalizeIdentifier(variableName);
      const alreadyDeclared = [
        ...parsedClass.members.map(member => member.name),
        ...parsedMethod.parameters.map(parameter => parameter.name),
        ...(parsedMethod.locals || []).map(local => local.name)
      ].some(name => normalizeIdentifier(name) === normalizedVariableName);
      if (alreadyDeclared) {
        setBeginnerAutoLocalTypeState(null);
        return false;
      }

      const statementAtCursor = parsedMethod.statements[Math.min(statementIndex, parsedMethod.statements.length - 1)];
      const inserted = applyLingCppAstEdit(flushed.sourceCode, {
        kind: 'add-local',
        className: target.className,
        methodName: target.method.name,
        insertBeforeLine: statementAtCursor?.line ?? parsedMethod.endLine ?? parsedMethod.line + 1,
        local: {
          name: variableName,
          type: variableType
        }
      });
      if (!inserted.success) {
        setStructureEditError(inserted.error || inserted.diagnostics[0]?.message || '局部变量自动声明失败。');
        return false;
      }

      input.value = nextSegmentValue;
      updateBeginnerCodeSegmentDraft(target, segmentContext, nextSegmentValue);
      const pendingBody = beginnerCodeDraftsRef.current[targetKey] ?? nextSegmentValue;
      beginnerCodeDraftsRef.current = { [targetKey]: pendingBody };
      beginnerCodeSegmentLineCountsRef.current = {};
      beginnerLocalStatementAnchorsRef.current = {};
      setBeginnerCodeDrafts({ [targetKey]: pendingBody });
      setBeginnerAutoLocalTypeState(null);
      closeBeginnerCompletion(target);
      setCollapsedBeginnerProcessTargetKeys(current => current.filter(key => key !== targetKey));
      setStructureEditError(null);
      updateSourceCode(inserted.sourceCode);

      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        const editors = Array.from(document.querySelectorAll(
          `textarea[data-beginner-target-key="${CSS.escape(targetKey)}"]`
        )).filter((editor): editor is HTMLTextAreaElement => editor instanceof HTMLTextAreaElement);
        const continuation = editors.find(editor =>
          Number(editor.dataset.beginnerStatementStart) === statementIndex
        ) || editors.at(-1);
        if (!continuation) return;
        const firstLineEnd = continuation.value.indexOf('\n');
        const nextCursor = firstLineEnd >= 0 ? firstLineEnd + 1 : continuation.value.length;
        continuation.focus();
        continuation.setSelectionRange(nextCursor, nextCursor);
        captureBeginnerTextareaView(continuation);
      }));
      return true;
    };
    const openBeginnerAutoLocalTypePanel = (
      target: BeginnerCodeTarget,
      input: HTMLTextAreaElement,
      segmentContext: BeginnerCodeSegmentContext,
      variableName: string,
      expression: string,
      subtitle: string,
      preferredType?: string
    ) => {
      const knownTypes = typeSuggestions.filter(type => !/^(空|无)$/u.test(type));
      if (knownTypes.length === 0) return false;
      const items = preferredType && !knownTypes.includes(preferredType)
        ? [preferredType, ...knownTypes]
        : knownTypes;
      closeBeginnerCompletion(target);
      setBeginnerAutoLocalTypeState({
        targetKey: codeTargetKey(target),
        segmentId: segmentContext.segment.id,
        variableName,
        expression,
        subtitle,
        items,
        selectedIndex: preferredType ? Math.max(0, items.indexOf(preferredType)) : 0,
        position: getBeginnerCompletionPanelPosition(input, variableName, items.length),
        target,
        segmentContext,
        viewKey: input.dataset.textModelViewKey || ''
      });
      return true;
    };
    const tryBeginnerAutoLocalOnEnter = (
      target: BeginnerCodeTarget,
      input: HTMLTextAreaElement,
      segmentContext?: BeginnerCodeSegmentContext
    ) => {
      if (!segmentContext || input.selectionStart !== input.selectionEnd) return false;
      const cursor = input.selectionEnd;
      const lineStart = input.value.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
      const nextBreak = input.value.indexOf('\n', cursor);
      const lineEnd = nextBreak >= 0 ? nextBreak : input.value.length;
      const lineText = input.value.slice(lineStart, lineEnd);
      // 文本块开始行/内容行/结束标记不触发自动声明（raw 内容不是可执行语句）。
      if (beginnerTextBlockLineSet(input.value).has(input.value.slice(0, lineStart).split('\n').length)) return false;
      const meaningfulLineEnd = lineStart + lineText.replace(/\s+$/u, '').length;
      if (cursor < meaningfulLineEnd || input.value.slice(cursor, lineEnd).trim()) return false;

      const ownerClass = lingCppLanguageContext?.program.classes.find(cls => cls.name === target.className);
      const autoLocalOptions = {
        lineText,
        method: target.method,
        ownerClass,
        globals: projectGlobals?.globals,
        moduleContext,
        commandReturnTypes: beginnerAutoLocalReturnTypes
      };
      const assignment = analyzeBeginnerAutoLocalAssignment(autoLocalOptions);
      if (assignment.kind === 'declare') {
        if (assignment.inferredType) {
          return commitBeginnerAutoLocal(
            target,
            input,
            segmentContext,
            assignment.name,
            assignment.inferredType
          );
        }
        return openBeginnerAutoLocalTypePanel(
          target,
          input,
          segmentContext,
          assignment.name,
          assignment.expression,
          '无法确定右侧表达式类型 · ↑↓ 选择 · Enter 确认'
        );
      }

      // 计次/变量/枚举循环首的行尾回车：像易语言一样提示创建未声明的循环变量，
      // 类型可推断时在面板中预选，推断不出时由用户自行选择。
      const loop = analyzeBeginnerAutoLocalLoopVariable(autoLocalOptions);
      if (loop.kind !== 'declare') return false;
      return openBeginnerAutoLocalTypePanel(
        target,
        input,
        segmentContext,
        loop.name,
        loop.statement,
        loop.inferredType
          ? `循环变量 · 推荐 ${loop.inferredType} · Enter 确认，↑↓ 可更改`
          : '无法推断元素类型 · ↑↓ 选择 · Enter 确认',
        loop.inferredType
      );
    };
    const handleBeginnerCodeKeyDown = (
      target: BeginnerCodeTarget,
      event: React.KeyboardEvent<HTMLTextAreaElement>,
      segmentContext?: BeginnerCodeSegmentContext
    ) => {
      const input = event.currentTarget;
      const targetKey = codeTargetKey(target);
      const segmentId = segmentContext?.segment.id || 'all';
      // 必须读镜像 ref 而不是渲染闭包里的 state：textarea 位于按 revision 记忆化的块内，
      // 补全面板已出块、补全状态不再进 blockRevision，闭包里的 state 可能是旧值，
      // 会让 Enter/方向键在补全打开时走错分支（回车变换行、选中项不动）。
      const liveCompletionState = beginnerCompletionStateRef.current;
      const liveAutoLocalTypeState = beginnerAutoLocalTypeStateRef.current;
      const activeCompletion = liveCompletionState?.targetKey === targetKey
        && liveCompletionState.segmentId === segmentId
        ? liveCompletionState
        : null;
      const activeAutoLocalType = liveAutoLocalTypeState?.targetKey === targetKey
        && liveAutoLocalTypeState.segmentId === segmentContext?.segment.id
        ? liveAutoLocalTypeState
        : null;

      if (activeAutoLocalType) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          setBeginnerAutoLocalTypeState(current => {
            if (!current || current.targetKey !== targetKey || current.items.length === 0) return current;
            const selectedIndex = (current.selectedIndex + delta + current.items.length) % current.items.length;
            return { ...current, selectedIndex };
          });
          return;
        }
        if ((event.key === 'Enter' || event.key === 'Tab') && segmentContext) {
          event.preventDefault();
          const type = activeAutoLocalType.items[activeAutoLocalType.selectedIndex] || activeAutoLocalType.items[0];
          if (type) commitBeginnerAutoLocal(
            target,
            input,
            segmentContext,
            activeAutoLocalType.variableName,
            type
          );
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setBeginnerAutoLocalTypeState(null);
          return;
        }
        setBeginnerAutoLocalTypeState(null);
      }

      const localInsertShortcutKind = getBeginnerLocalInsertShortcutKind(event);
      if (localInsertShortcutKind) {
        event.preventDefault();
        event.stopPropagation();
        insertBeginnerLocalAtCursor(target, input, segmentContext, localInsertShortcutKind === 'constant');
        return;
      }

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
        updateBeginnerCompletion(target, input, true, segmentContext);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && (event.key === '/' || event.code === 'Slash')) {
        event.preventDefault();
        closeBeginnerCompletion(target);
        const result = toggleBeginnerLineComment(input.value, input.selectionStart, input.selectionEnd);
        if (result.value === input.value) return;
        input.value = result.value;
        if (segmentContext) updateBeginnerCodeSegmentDraft(target, segmentContext, result.value, { defer: true });
        else updateBeginnerCodeDraft(target, result.value, { defer: true });
        window.requestAnimationFrame(() => {
          const fresh = resolveBeginnerCodeTextarea(input);
          if (!fresh) return;
          fresh.focus();
          fresh.setSelectionRange(result.selectionStart, result.selectionEnd);
          captureBeginnerTextareaView(fresh);
          updateBeginnerCommandHint(target, fresh);
        });
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
          if (!completion) return;
          // 上屏被拒绝（光标已移动、token 失配）时面板已关闭，回车/Tab 继续走普通分支。
          if (applyBeginnerCompletion(target, input, completion, segmentContext, activeCompletion)) return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          closeBeginnerCompletion(target);
          return;
        }
      }

      if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        if (tryBeginnerAutoLocalOnEnter(target, input, segmentContext)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        event.preventDefault();
        // 行尾提交语句时先规范化赋值等号两侧的空格（数值=0 → 数值 = 0）；
        // 有选区或光标在行中时是拆行操作，不做改写。
        const hasSelection = input.selectionStart !== input.selectionEnd;
        const formatted = hasSelection
          ? { value: input.value, cursor: input.selectionStart, changed: false }
          : formatBeginnerAssignmentAtCursor(input.value, input.selectionStart);
        const start = formatted.cursor;
        const end = hasSelection ? input.selectionEnd : start;
        const indent = getBeginnerNextLineIndentation(formatted.value, start);
        const nextValue = `${formatted.value.slice(0, start)}\n${indent}${formatted.value.slice(end)}`;
        input.value = nextValue;
        // 换行已直接写入 DOM；立即同步草稿会重挂 textarea，让下面的光标恢复落在旧节点上。
        if (segmentContext) updateBeginnerCodeSegmentDraft(target, segmentContext, nextValue, { defer: true });
        else updateBeginnerCodeDraft(target, nextValue, { defer: true });
        window.requestAnimationFrame(() => {
          const nextCursor = start + indent.length + 1;
          const fresh = resolveBeginnerCodeTextarea(input);
          if (!fresh) return;
          fresh.focus();
          fresh.setSelectionRange(nextCursor, nextCursor);
          captureBeginnerTextareaView(fresh);
          updateBeginnerCommandHint(target, fresh);
        });
        return;
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
        if (segmentContext) updateBeginnerCodeSegmentDraft(target, segmentContext, nextValue, { defer: true });
        else updateBeginnerCodeDraft(target, nextValue, { defer: true });
        window.requestAnimationFrame(() => {
          const fresh = resolveBeginnerCodeTextarea(input);
          if (!fresh) return;
          fresh.focus();
          fresh.selectionStart = fresh.selectionEnd = start + 4;
          captureBeginnerTextareaView(fresh);
        });
      }
    };
    /**
     * 补全面板渲染在画布内容层浮层（BeginnerVirtualCanvas overlay），不再进入任何结构块：
     * 虚拟化块包装器带 transform（独立层叠上下文），块内 z-30 面板会被后续块盖住；
     * 且面板入块要求把补全状态写进 blockRevision，会让每个键全量重渲可见块。
     * 点击上屏通过 state.viewKey 回查当前挂载的 textarea。
     */
    const renderHoistedBeginnerCompletionPanel = () => {
      const state = beginnerCompletionState;
      if (!state || state.items.length === 0) return null;

      return (
        <div
          className={`absolute z-[90] w-[280px] overflow-hidden rounded border shadow-xl ${
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
                  const editor = findBeginnerCodeTextareaByViewKey(state.viewKey);
                  if (editor) applyBeginnerCompletion(state.target, editor, item, state.segmentContext, state);
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
    const renderHoistedBeginnerAutoLocalTypePanel = () => {
      const state = beginnerAutoLocalTypeState;
      if (!state || state.items.length === 0) return null;

      return (
        <div
          className={`absolute left-2 z-[90] w-[calc(100%_-_16px)] max-w-[280px] overflow-hidden rounded border shadow-xl ${
            isDarkMode ? 'border-amber-400/30 bg-[#191b22] text-slate-100 shadow-black/35' : 'border-amber-300 bg-white text-slate-900 shadow-slate-300/50'
          } ${state.position.placement === 'above' ? 'origin-bottom-left' : 'origin-top-left'}`}
          style={{ top: state.position.top, left: state.position.left }}
          role="listbox"
          aria-label={`选择局部变量 ${state.variableName} 的类型`}
        >
          <div className={`border-b px-2 py-1.5 text-[10px] ${
            isDarkMode ? 'border-[#2b2d34] text-amber-200' : 'border-amber-100 text-amber-800'
          }`}>
            <div className="font-semibold">为 {state.variableName} 选择类型</div>
            <div className={`truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`} title={state.expression}>
              {state.subtitle}
            </div>
          </div>
          <div className="overflow-auto py-1" style={{ maxHeight: state.position.maxListHeight }}>
            {state.items.map((type, index) => (
              <button
                key={type}
                type="button"
                role="option"
                aria-selected={index === state.selectedIndex}
                onMouseDown={event => {
                  event.preventDefault();
                  const editor = findBeginnerCodeTextareaByViewKey(state.viewKey);
                  if (editor) {
                    commitBeginnerAutoLocal(state.target, editor, state.segmentContext!, state.variableName, type);
                  }
                }}
                className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[11px] ${
                  index === state.selectedIndex
                    ? isDarkMode ? 'bg-amber-400/15 text-amber-100' : 'bg-amber-50 text-amber-900'
                    : isDarkMode ? 'text-slate-300 hover:bg-[#232631]' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="font-semibold">{type}</span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] ${
                  isDarkMode ? 'bg-[#2b2d34] text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}>局部变量</span>
              </button>
            ))}
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
        setCollapsedBeginnerProcessTargetKeys(current =>
          current.includes(previousKey)
            ? Array.from(new Set(current.map(key => key === previousKey ? nextKey : key)))
            : current
        );
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
      const currentParameter = target.method.parameters[index];
      if (!currentParameter) return;
      const nextValue = field === 'type'
        ? setLingCppArrayParameterType(rawValue, isLingCppArrayParameterType(rawValue) || isLingCppArrayParameterType(currentParameter.type))
        : rawValue.trim();
      if ((field === 'name' || field === 'type') && !nextValue) {
        setStructureEditError('参数名和参数类型不能为空。');
        return;
      }
      if ((currentParameter[field] || '') === nextValue) return;
      const nextParameters = target.method.parameters.map((parameter, parameterIndex) =>
        parameterIndex === index
          ? { ...parameter, [field]: nextValue || undefined }
          : parameter
      );
      applyCodeTargetSignature(target, { parameters: nextParameters });
    };
    const setCodeTargetParameterArray = (
      target: BeginnerCodeTarget,
      index: number,
      isArray: boolean
    ) => {
      const currentParameter = target.method.parameters[index];
      if (!currentParameter) return;
      const nextType = setLingCppArrayParameterType(currentParameter.type, isArray);
      if (nextType === currentParameter.type) return;
      const nextParameters = target.method.parameters.map((parameter, parameterIndex) =>
        parameterIndex === index ? { ...parameter, type: nextType } : parameter
      );
      applyCodeTargetSignature(target, { parameters: nextParameters });
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
    const insertCodeTargetParameter = (target: BeginnerCodeTarget, insertIndex = target.method.parameters.length) => {
      const name = uniqueBeginnerName('参数', target.method.parameters.map(parameter => parameter.name));
      const nextParameters = [
        ...target.method.parameters.slice(0, insertIndex),
        { type: '文本型', name },
        ...target.method.parameters.slice(insertIndex)
      ];
      const applied = applyCodeTargetSignature(target, { parameters: nextParameters });
      if (applied) setBeginnerParameterFocus({ targetKey: codeTargetKey(target), parameterName: name });
    };
    const createBeginnerFunction = (target?: BeginnerCodeTarget) => {
      if (!primaryMethodOwnerName) {
        setStructureEditError('当前源码里还没有类或功能库，无法新增子程序。');
        return;
      }
      const anchor = target && target.className === primaryMethodOwnerName ? target : undefined;
      const name = uniqueBeginnerName('新子程序', codeTargets.map(item => item.method.name));
      const applied = applyStructureAstEdits([{
        kind: 'add-method',
        className: primaryMethodOwnerName,
        insertAfterMethodName: anchor?.method.name,
        method: {
          name,
          returnType: '空',
          access: primaryFunctionLibrary ? '公开' : undefined,
          bodyLines: [`调试输出("${name} 已执行")`],
          note: anchor ? '新手模式在当前子程序下方新增' : '新手模式右键新增的子程序'
        }
      }], anchor?.method.line);
      if (applied) {
        setSelectedBeginnerCodeTarget({ className: primaryMethodOwnerName, methodName: name });
        setExpandedBeginnerFunctionTargetKey(`${primaryMethodOwnerName}:method:${name}`);
      }
    };
    const requireSubprogramTarget = (target?: BeginnerCodeTarget): BeginnerCodeTarget | undefined => {
      if (!target) {
        setStructureEditError('请先在要操作的子程序上右键。');
        return undefined;
      }
      if (target.method.kind !== 'method') {
        setStructureEditError('事件处理器与构造、析构子程序不支持移动、剪切或复制。');
        return undefined;
      }
      return target;
    };
    const moveBeginnerSubprogram = (target: BeginnerCodeTarget | undefined, direction: 'up' | 'down') => {
      if (!requireSubprogramTarget(target)) return;
      applyStructureAstEdits([{
        kind: 'move-method',
        className: target.className,
        methodName: target.method.name,
        direction
      }]);
    };
    const copyBeginnerSubprogram = (target?: BeginnerCodeTarget) => {
      if (!requireSubprogramTarget(target)) return;
      const block = getLingCppMethodBlock(normalizedSourceCode, target.className, target.method.name);
      if (!block) {
        setStructureEditError(`未找到子程序「${target.method.name}」，无法复制。`);
        return;
      }
      beginnerMethodClipboardRef.current = block;
      setStructureEditError(null);
    };
    const cutBeginnerSubprogram = (target?: BeginnerCodeTarget) => {
      if (!requireSubprogramTarget(target)) return;
      const block = getLingCppMethodBlock(normalizedSourceCode, target.className, target.method.name);
      if (!block) {
        setStructureEditError(`未找到子程序「${target.method.name}」，无法剪切。`);
        return;
      }
      beginnerMethodClipboardRef.current = block;
      const applied = applyStructureAstEdits([{
        kind: 'delete-method',
        className: target.className,
        methodName: target.method.name
      }]);
      if (applied) {
        const targetKey = codeTargetKey(target);
        setSelectedBeginnerCodeTarget(null);
        setSelectedBeginnerHandler(null);
        setExpandedBeginnerFunctionTargetKey(current => (current === targetKey ? null : current));
        setCollapsedBeginnerProcessTargetKeys(current => current.filter(key => key !== targetKey));
      }
    };
    const pasteBeginnerSubprogram = (target?: BeginnerCodeTarget) => {
      const clipboard = beginnerMethodClipboardRef.current;
      if (!clipboard) {
        setStructureEditError('剪贴板里还没有子程序，请先剪切或复制一个子程序。');
        return;
      }
      if (!primaryMethodOwnerName) {
        setStructureEditError('当前源码里还没有类或功能库，无法粘贴子程序。');
        return;
      }
      const ownerMethodNames = codeTargets
        .filter(item => item.className === primaryMethodOwnerName)
        .map(item => item.method.name);
      if (ownerMethodNames.some(name => normalizeIdentifier(name) === normalizeIdentifier(clipboard.name))) {
        setStructureEditError(`无法粘贴：当前已存在同名子程序「${clipboard.name}」，请先重命名后再粘贴。`);
        return;
      }
      const anchor = target && target.className === primaryMethodOwnerName ? target : undefined;
      const applied = applyStructureAstEdits([{
        kind: 'insert-method-block',
        className: primaryMethodOwnerName,
        blockLines: clipboard.blockLines,
        access: clipboard.access,
        insertAfterMethodName: anchor?.method.name
      }], anchor?.method.line);
      if (applied) {
        setSelectedBeginnerCodeTarget({ className: primaryMethodOwnerName, methodName: clipboard.name });
        setExpandedBeginnerFunctionTargetKey(`${primaryMethodOwnerName}:method:${clipboard.name}`);
        setStructureEditError(null);
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
    const commitNewLocalVariable = (
      target: BeginnerCodeTarget,
      draftOverride?: Partial<LocalVariableDraft>,
      insertBeforeLine?: number
    ) => {
      const draft: LocalVariableDraft = {
        type: '文本型',
        name: '',
        initialValue: '',
        note: '',
        isArray: false,
        isConstant: false,
        ...(draftOverride || {})
      };
      const name = draft.name.trim();
      const type = draft.type.trim();
      if (!name || !type) {
        setStructureEditError('新增局部声明需要填写名称和类型。');
        return false;
      }
      if (draft.isConstant && draft.isArray) {
        setStructureEditError(`局部常量 ${name} 不支持数组，请改用普通局部变量。`);
        return false;
      }
      if (draft.isConstant && !draft.initialValue.trim()) {
        setStructureEditError(`局部常量 ${name} 必须填写初始值。`);
        return false;
      }
      const usedNames = new Set([
        ...target.method.parameters.map(parameter => parameter.name),
        ...(target.method.locals || []).map(local => local.name)
      ].map(normalizeIdentifier));
      if (usedNames.has(normalizeIdentifier(name))) {
        setStructureEditError(`局部声明 ${name} 与现有参数、局部变量或局部常量重名。`);
        return false;
      }
      const applied = applyStructureAstEdits([{
        kind: 'add-local',
        className: target.className,
        methodName: target.method.name,
        insertBeforeLine,
        local: {
          name,
          type,
          initialValue: draft.initialValue.trim() || undefined,
          note: draft.note.trim() || undefined,
          isArray: draft.isArray,
          isConstant: draft.isConstant
        }
      }], target.method.line);
      return applied;
    };
    const createBeginnerLocal = (target?: BeginnerCodeTarget, isConstant = false) => {
      if (!target) {
        setStructureEditError(`请先选择要添加局部${isConstant ? '常量' : '变量'}的事件或子程序。`);
        return;
      }
      const name = uniqueBeginnerName(isConstant ? '局部常量' : '局部变量', [
        ...target.method.parameters.map(parameter => parameter.name),
        ...(target.method.locals || []).map(local => local.name)
      ]);
      commitNewLocalVariable(target, { name, type: '文本型', initialValue: '""', isConstant });
    };
    const updateLocalVariable = (
      target: BeginnerCodeTarget,
      local: LingCppLocalVariable,
      patch: { newName?: string; type?: string; initialValue?: string; note?: string; isArray?: boolean; isConstant?: boolean }
    ) => {
      const nextName = patch.newName?.trim();
      const nextType = patch.type?.trim();
      const nextIsConstant = patch.isConstant ?? local.isConstant ?? false;
      const nextIsArray = patch.isArray ?? local.isArray ?? false;
      const nextInitialValue = patch.initialValue !== undefined
        ? patch.initialValue.trim()
        : local.initialValue?.trim() || '';
      // 类型变化时初始值自动适配新类型（方案A）；用户显式修改初始值时尊重用户输入。
      const initialValuePatch = patch.initialValue !== undefined
        ? patch.initialValue
        : adaptBeginnerInitialValueForType({
          previousType: local.type,
          nextType: nextType || local.type,
          isConstant: nextIsConstant
        });
      if (patch.newName !== undefined && !nextName) {
        setStructureEditError('局部声明名称不能为空。');
        return false;
      }
      if (patch.type !== undefined && !nextType) {
        setStructureEditError('局部声明类型不能为空。');
        return false;
      }
      if (nextIsConstant && nextIsArray) {
        setStructureEditError(`局部变量 ${local.name} 是数组，不能转换为局部常量；请先取消数组。`);
        return false;
      }
      if (nextIsConstant && !nextInitialValue) {
        setStructureEditError(`局部常量 ${local.name} 必须有初始值，不能留空。`);
        return false;
      }
      return applyStructureAstEdits([{
        kind: 'update-local',
        className: target.className,
        methodName: target.method.name,
        localName: local.name,
        newName: nextName,
        type: nextType,
        initialValue: initialValuePatch,
        note: patch.note,
        isArray: patch.isArray,
        isConstant: patch.isConstant
      }], local.line);
    };
    const focusBeginnerLocalNameInput = (targetKey: string, name: string) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        const root = beginnerStructureScrollRef.current;
        const input = root?.querySelector(
          `[data-beginner-local-target-key="${CSS.escape(targetKey)}"][data-beginner-local-name="${CSS.escape(name)}"]`
        );
        if (input instanceof HTMLInputElement) {
          input.focus({ preventScroll: true });
          input.select();
        }
      }));
    };
    const appendBeginnerLocalFromTable = (
      target: BeginnerCodeTarget,
      local: LingCppLocalVariable,
      field: 'name' | 'type' | 'initialValue' | 'note',
      rawValue: string
    ) => {
      if (!onUpdateSourceContent) return false;

      const value = field === 'type'
        ? resolveBeginnerTypeInput(rawValue.trim())
        : rawValue.trim();
      if ((field === 'name' || field === 'type') && !value) {
        setStructureEditError(`局部声明${field === 'name' ? '名称' : '类型'}不能为空。`);
        return false;
      }

      const patch = field === 'name'
        ? { newName: value }
        : field === 'type'
          ? { type: value }
          : field === 'initialValue'
            ? { initialValue: value }
            : { note: value };
      const nextInitialValue = field === 'initialValue'
        ? value
        : local.initialValue?.trim() || '';
      if (local.isConstant && !nextInitialValue) {
        setStructureEditError(`局部常量 ${local.name} 必须填写初始值。`);
        return false;
      }

      let nextSource = normalizedSourceCode;
      const needsCurrentCellCommit = value !== (field === 'name'
        ? local.name
        : field === 'type'
          ? local.type
          : field === 'initialValue'
            ? local.initialValue || ''
            : local.note || '');
      if (needsCurrentCellCommit) {
        const updated = applyLingCppAstEdit(nextSource, {
          kind: 'update-local',
          className: target.className,
          methodName: target.method.name,
          localName: local.name,
          ...patch
        });
        if (!updated.success) {
          setStructureEditError(updated.error || updated.diagnostics[0]?.message || '局部声明写回失败。');
          return false;
        }
        nextSource = updated.sourceCode;
      }

      const parsed = parseLingCpp(nextSource);
      const method = parsed.program.classes
        .find(cls => cls.name === target.className)
        ?.methods.find(item => item.name === target.method.name && item.kind === target.method.kind);
      const currentName = field === 'name' ? value : local.name;
      const currentLocal = method?.locals?.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(currentName));
      if (!method || !currentLocal) {
        setStructureEditError('无法定位当前局部声明，未新增下一行。');
        return false;
      }

      const nextName = uniqueBeginnerName(
        currentLocal.isConstant ? '局部常量' : '局部变量',
        [...method.parameters.map(parameter => parameter.name), ...(method.locals || []).map(item => item.name)]
      );
      const added = applyLingCppAstEdit(nextSource, {
        kind: 'add-local',
        className: target.className,
        methodName: target.method.name,
        insertBeforeLine: currentLocal.line + 1,
        local: {
          name: nextName,
          type: currentLocal.type,
          initialValue: currentLocal.isConstant ? currentLocal.initialValue || '0' : undefined,
          isArray: Boolean(currentLocal.isArray),
          isConstant: Boolean(currentLocal.isConstant)
        }
      });
      if (!added.success) {
        setStructureEditError(added.error || added.diagnostics[0]?.message || '新增局部声明失败。');
        return false;
      }

      updateSourceCode(added.sourceCode);
      setStructureEditError(null);
      focusBeginnerLocalNameInput(codeTargetKey(target), nextName);
      return true;
    };
    const deleteLocalVariable = (target: BeginnerCodeTarget, local: LingCppLocalVariable) => {
      applyStructureAstEdits([{
        kind: 'delete-local',
        className: target.className,
        methodName: target.method.name,
        localName: local.name
      }], local.line);
    };
    const resolveBeginnerCommandTarget = (target?: LingCppBeginnerMethodTarget) => target
      ? codeTargets.find(item => item.className === target.className && item.method.name === target.methodName)
      : activeCanvasTarget;
    beginnerCommandHandlerRef.current = {
      addSubprogram: target => createBeginnerFunction(resolveBeginnerCommandTarget(target)),
      addAssemblyVariable: createBeginnerMember,
      addVariable: target => createBeginnerLocal(resolveBeginnerCommandTarget(target), false),
      addConstant: target => createBeginnerLocal(resolveBeginnerCommandTarget(target), true),
      moveSubprogram: (target, direction) => moveBeginnerSubprogram(resolveBeginnerCommandTarget(target), direction),
      cutSubprogram: target => cutBeginnerSubprogram(resolveBeginnerCommandTarget(target)),
      copySubprogram: target => copyBeginnerSubprogram(resolveBeginnerCommandTarget(target)),
      pasteSubprogram: target => pasteBeginnerSubprogram(resolveBeginnerCommandTarget(target))
    };
    const deleteBeginnerCodeTarget = async (target?: BeginnerCodeTarget) => {
      if (!target) return;
      if (target.method.kind === 'constructor') {
        setStructureEditError('构造子程序不能从新手模式删除。');
        return;
      }
      const isEvent = target.method.kind === 'event';
      const label = isEvent ? '事件处理器' : '子程序';
      if (!await requestWorkbenchConfirm({ title: '删除确认', description: `确定删除${label}「${target.method.name}」吗？`, confirmLabel: '删除', cancelLabel: '取消' })) return;
      const edit: LingCppAstEdit = isEvent
        ? { kind: 'delete-event', className: target.className, handlerName: target.method.name }
        : { kind: 'delete-method', className: target.className, methodName: target.method.name };
      const applied = applyStructureAstEdits([edit], target.method.line);
      if (applied) {
        const targetKey = codeTargetKey(target);
        setSelectedBeginnerCodeTarget(null);
        setSelectedBeginnerHandler(null);
        setExpandedBeginnerEventTargetKey(null);
        setExpandedBeginnerFunctionTargetKey(null);
        setCollapsedBeginnerProcessTargetKeys(current => current.filter(key => key !== targetKey));
      }
    };
    const appendBeginnerSnippet = (target: BeginnerCodeTarget | undefined, snippet: string) => {
      if (!target) return;
      const targetKey = codeTargetKey(target);
      const currentBody = beginnerCodeDraftsRef.current[targetKey] ?? beginnerCodeDrafts[targetKey] ?? methodBodyText(target.method);
      const nextBody = currentBody.trim() ? `${currentBody}\n${snippet}` : snippet;
      updateBeginnerCodeDraft(target, nextBody);
      const applied = commitBeginnerCodeBody(target.className, target.method.name, currentBody, nextBody);
      if (applied) clearBeginnerCodeDraft(target);
    };
    const getProcedureCallFromInput = (input: HTMLTextAreaElement, cursor = input.selectionStart) =>
      getBeginnerProcedureCallAtCursor(
        input.value,
        cursor,
        codeTargets.map(candidate => candidate.method.name)
      );
    const getLibraryCallFromInput = (input: HTMLTextAreaElement, cursor = input.selectionStart) =>
      lingCppLanguageContext
        ? getBeginnerLibraryCallAtCursor(input.value, cursor, lingCppLanguageContext.projectFunctions?.libraries || [])
        : null;
    const cancelBeginnerPointerSync = () => {
      const frames = beginnerPointerSyncFramesRef.current;
      if (frames.first !== null) window.cancelAnimationFrame(frames.first);
      if (frames.second !== null) window.cancelAnimationFrame(frames.second);
      frames.first = null;
      frames.second = null;
    };
    const scheduleBeginnerPointerSync = (
      target: BeginnerCodeTarget,
      input: HTMLTextAreaElement
    ) => {
      cancelBeginnerPointerSync();
      const frames = beginnerPointerSyncFramesRef.current;
      frames.first = window.requestAnimationFrame(() => {
        frames.first = null;
        frames.second = window.requestAnimationFrame(() => {
          frames.second = null;
          if (!input.isConnected || document.activeElement !== input) return;
          updateBeginnerCommandHint(target, input);
          captureBeginnerTextareaView(input);
        });
      });
    };
    const revealBeginnerProcedureDefinition = (callerClassName: string, procedureName: string) => {
      if (!lingCppLanguageContext) return false;
      const definition = resolveBeginnerProcedureDefinition(
        lingCppLanguageContext.program,
        callerClassName,
        procedureName
      );
      if (!definition) return false;

      const definitionTarget: BeginnerCodeTarget = {
        className: definition.className,
        method: definition.method
      };
      const definitionKey = codeTargetKey(definitionTarget);
      setSelectedBeginnerCodeTarget({
        className: definition.className,
        methodName: definition.method.name
      });
      if (definition.method.kind === 'event') {
        setSelectedBeginnerHandler(definition.method.name);
        setExpandedBeginnerEventTargetKey(definitionKey);
      } else if (definition.method.kind === 'method') {
        setExpandedBeginnerFunctionTargetKey(definitionKey);
      }
      setCollapsedBeginnerProcessTargetKeys(current => current.filter(key => key !== definitionKey));
      setCursorPosition({ line: definition.method.line, column: 1 });
      setStructuredRevealLine(definition.method.line);
      closeBeginnerCompletion();

      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        const header = document.querySelector<HTMLElement>(
          `[data-beginner-process-key="${CSS.escape(definitionKey)}"]`
        );
        if (header) scrollElementInsideBeginnerEditor(header, 'center');
      }));
      return true;
    };
    // 跳转到功能库功能定义：切换到功能库 .lcpp 页签，再由 pendingHandlerFocus 定位到功能行。
    const revealFunctionLibraryDefinition = (libraryName: string, functionName: string) => {
      if (!lingCppLanguageContext) return false;
      const definition = resolveBeginnerFunctionLibraryDefinition(
        lingCppLanguageContext.projectFunctions?.libraries || [],
        libraryName,
        functionName
      );
      if (!definition) return false;
      const normalizedTarget = definition.filePath.replace(/\\/gu, '/').toLowerCase();
      const targetFile = allFiles.find(file => String(file.path || '').replace(/\\/gu, '/').toLowerCase() === normalizedTarget)
        || allFiles.find(file => String(file.path || '').replace(/\\/gu, '/').toLowerCase().endsWith(normalizedTarget));
      if (!targetFile) return false;
      if (targetFile.path !== activeFile?.path) onSelectTab(targetFile);
      setViewMode('chinese');
      onExperienceModeChange?.('beginner');
      setPendingHandlerFocus({ handlerName: functionName, filePath: targetFile.path });
      closeBeginnerCompletion();
      return true;
    };
    const revealProjectConstantDefinition = (constantName: string) => {
      const globalFile = allFiles.find(file => isProjectGlobalsFilePath(String(file.path || file.name || '')));
      if (!globalFile) return false;
      setPendingProjectConstantFocus(constantName);
      onSelectTab(globalFile);
      closeBeginnerCompletion();
      return true;
    };
    // 双击选中完整标识符（变量名/命令名）：中文没有空格分词，浏览器原生双击
    // 按词典只选中一段（缓冲区句柄 → 缓冲区），这里按标识符边界整段选中。
    const handleBeginnerCodeDoubleClick = (
      target: BeginnerCodeTarget,
      event: React.MouseEvent<HTMLTextAreaElement>
    ) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const input = event.currentTarget;
      const offset = getBeginnerTextareaOffsetAtPoint(input, event.clientX, event.clientY);
      const span = getBeginnerIdentifierSpanAtOffset(input.value, offset);
      if (!span || span.end <= span.start) return;
      input.setSelectionRange(span.start, span.end);
      scheduleBeginnerPointerSync(target, input);
    };
    const handleBeginnerCodeClick = (
      target: BeginnerCodeTarget,
      event: React.MouseEvent<HTMLTextAreaElement>
    ) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) {
        // 普通点击会移动光标：补全面板对应的 token 随即失效，直接关闭，
        // 避免面板残留后在错误位置上屏（曾致「粘贴后点括号右侧按回车」在括号外重复变量名）。
        closeBeginnerCompletion(target);
        scheduleBeginnerPointerSync(target, event.currentTarget);
        return;
      }
      cancelBeginnerPointerSync();
      updateBeginnerCommandHint(target, event.currentTarget);
      captureBeginnerTextareaView(event.currentTarget);

      const cursor = getBeginnerTextareaOffsetAtPoint(event.currentTarget, event.clientX, event.clientY);
      const sourcePosition = beginnerSourcePositionAtOffset(event.currentTarget, cursor);
      const controlReference = getLingCppControlReferenceAtPosition(
        normalizedSourceCode,
        sourcePosition.line,
        sourcePosition.column,
        designerProject,
        moduleContext,
        activeFile?.path
      );
      const call = getProcedureCallFromInput(event.currentTarget, cursor);
      const libraryCall = getLibraryCallFromInput(event.currentTarget, cursor);
      const sourceDefinition = getLingCppSourceDefinitionAtPosition(
        normalizedSourceCode,
        sourcePosition.line,
        sourcePosition.column
      );
      const constantName = getProjectConstantNameAtCursor(
        event.currentTarget.value,
        cursor,
        projectGlobals?.constants.map(constant => constant.name) || []
      );
      const revealed = controlReference?.symbol
        ? (revealControlReference(controlReference), true)
        : sourceDefinition && (sourceDefinition.kind === 'local' || sourceDefinition.kind === 'parameter')
          ? (setCursorPosition({ line: sourceDefinition.range.startLine, column: sourceDefinition.range.startColumn }), setStructuredRevealLine(sourceDefinition.range.startLine), true)
        : call
          ? revealBeginnerProcedureDefinition(target.className, call.name)
        : libraryCall
          ? revealFunctionLibraryDefinition(libraryCall.libraryName, libraryCall.functionName)
        : constantName
          ? revealProjectConstantDefinition(constantName)
          : false;
      if (!revealed) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const openBeginnerContextMenu = (
      event: React.MouseEvent,
      target?: BeginnerCodeTarget,
      input?: HTMLTextAreaElement
    ) => {
      event.preventDefault();
      event.stopPropagation();
      setBeginnerCompletionState(null);
      const effectiveTarget = target || activeCanvasTarget;
      const contextCursor = input
        ? getBeginnerTextareaOffsetAtPoint(input, event.clientX, event.clientY)
        : undefined;
      const procedureCall = input && contextCursor !== undefined
        ? getProcedureCallFromInput(input, contextCursor)
        : null;
      const libraryCall = input && contextCursor !== undefined
        ? getLibraryCallFromInput(input, contextCursor)
        : null;
      const inputOffset = input
        ? getBeginnerTextareaOffsetAtPoint(input, event.clientX, event.clientY)
        : undefined;
      const sourcePosition = input && inputOffset !== undefined
        ? beginnerSourcePositionAtOffset(input, inputOffset)
        : undefined;
      const controlReference = sourcePosition
        ? getLingCppControlReferenceAtPosition(
            normalizedSourceCode,
            sourcePosition.line,
            sourcePosition.column,
            designerProject,
            moduleContext,
            activeFile?.path
          )
        : undefined;
      if (effectiveTarget) {
        setSelectedBeginnerCodeTarget({ className: effectiveTarget.className, methodName: effectiveTarget.method.name });
        if (effectiveTarget.method.kind === 'event') setSelectedBeginnerHandler(effectiveTarget.method.name);
      }
      setBeginnerContextMenu({
        x: event.clientX,
        y: event.clientY,
        className: effectiveTarget?.className,
        methodName: effectiveTarget?.method.name,
        definitionName: procedureCall?.name,
        libraryCall: libraryCall ? { libraryName: libraryCall.libraryName, functionName: libraryCall.functionName } : undefined,
        controlReference
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
      if (tone === 'note') return 'text-[color:var(--lingcpp-comment-color)]';
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
      if (effectiveParameters.length === 0) return renderTextCell('无参数功能', 'muted');
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
      const ensureProcedureNameIsVisible = (input: HTMLInputElement) => {
        if (field !== 'name') return;
        window.requestAnimationFrame(() => {
          if (!input.isConnected) return;
          const requiredInputWidth = Math.ceil(measureRenderedInputText(input) + 12);
          const currentInputWidth = input.getBoundingClientRect().width;
          const missingWidth = requiredInputWidth - currentInputWidth;
          if (missingWidth <= 0) return;

          const table = input.closest('table');
          const wrapper = input.closest<HTMLElement>('[data-beginner-preserve-width="true"]');
          const nameHeader = table?.querySelector<HTMLElement>('thead th:first-child');
          if (!wrapper || !nameHeader) return;
          const nextTableWidth = Math.ceil(wrapper.getBoundingClientRect().width + missingWidth);
          const nextNameWidth = Math.ceil(nameHeader.getBoundingClientRect().width + missingWidth);
          wrapper.style.width = `${nextTableWidth}px`;
          wrapper.style.minWidth = `${nextTableWidth}px`;
          nameHeader.style.width = `${nextNameWidth}px`;
        });
      };

      return (
        <div className="relative min-w-0" data-beginner-type-wrap={inputKey}>
          <input
            key={`${codeTargetKey(target)}:${field}:${value}`}
            ref={input => {
              if (input) ensureProcedureNameIsVisible(input);
            }}
            defaultValue={value}
            placeholder={placeholder}
            readOnly={!onUpdateSourceContent || !editable}
            onInput={event => ensureProcedureNameIsVisible(event.currentTarget)}
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
            className={`${directInputClasses(tone)} w-full whitespace-nowrap`}
            title={field === 'returnType' ? '支持中文、英文、拼音输入，例如 int、string、void' : value}
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
          className={directInputClasses('note')}
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
    ) => {
      const inputKey = `${codeTargetKey(target)}:parameter:${index}:${field}`;
      const typeCompletion = field === 'type' && beginnerTypeCompletionState?.inputKey === inputKey
        ? beginnerTypeCompletionState
        : null;
      const applyTypeCompletion = (item: BeginnerTypeCompletionItem, input: HTMLInputElement | null) => {
        if (input) {
          input.value = item.label;
          input.dataset.beginnerTypeApplied = 'true';
        }
        setBeginnerTypeCompletionState(null);
        commitCodeTargetParameter(target, index, field, item.label);
      };

      return (
        <div className="relative min-w-0" data-beginner-type-wrap={field === 'type' ? inputKey : undefined}>
          <input
            key={`${codeTargetKey(target)}:parameter:${index}:${field}:${value}`}
            ref={field === 'name' ? (node: HTMLInputElement | null) => {
              if (
                node &&
                beginnerParameterFocus &&
                beginnerParameterFocus.targetKey === codeTargetKey(target) &&
                beginnerParameterFocus.parameterName === value
              ) {
                setBeginnerParameterFocus(null);
                node.focus();
                node.select();
              }
            } : undefined}
            data-beginner-parameter-type={field === 'type' ? index : undefined}
            defaultValue={value}
            placeholder={placeholder}
            list={field === 'name' ? 'beginner-member-name-suggestions' : undefined}
            autoComplete="off"
            spellCheck={false}
            readOnly={!onUpdateSourceContent}
            onChange={event => {
              if (field === 'type') updateBeginnerTypeCompletion(inputKey, event.currentTarget);
            }}
            onBlur={event => {
              if (field === 'type') closeBeginnerTypeCompletionLater(inputKey);
              if (event.currentTarget.dataset.beginnerTypeApplied === 'true') {
                delete event.currentTarget.dataset.beginnerTypeApplied;
                return;
              }
              const rawValue = event.currentTarget.value;
              const nextValue = field === 'type' ? resolveBeginnerTypeInput(rawValue) : rawValue;
              event.currentTarget.value = nextValue;
              commitCodeTargetParameter(target, index, field, nextValue);
            }}
            onKeyDown={event => {
              if (field === 'type' && typeCompletion) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  moveBeginnerTypeCompletion(inputKey, event.key === 'ArrowDown' ? 1 : -1);
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
              if (event.key === 'Enter') {
                const rawValue = event.currentTarget.value;
                const nextValue = field === 'type' ? resolveBeginnerTypeInput(rawValue) : rawValue;
                event.currentTarget.value = nextValue;
                const currentName = (field === 'name' ? nextValue : target.method.parameters[index]?.name || '').trim();
                commitCodeTargetParameter(target, index, field, nextValue);
                event.currentTarget.blur();
                if (currentName) insertCodeTargetParameter(target, index + 1);
                return;
              }
              if (event.key === 'Escape') {
                setBeginnerTypeCompletionState(null);
                event.currentTarget.value = value;
                event.currentTarget.blur();
              }
            }}
            className={directInputClasses(tone)}
            title={field === 'type' ? '支持中文、英文和拼音简写，例如 wb、zs、string、int' : undefined}
          />
          {field === 'type' && renderBeginnerTypeCompletionPopup(inputKey, applyTypeCompletion)}
        </div>
      );
    };

    const renderParameterArraySwitch = (
      target: BeginnerCodeTarget,
      index: number,
      checked: boolean
    ) => {
      const disabled = !onUpdateSourceContent;
      return (
        <label
          className={`inline-flex h-[var(--beginner-input-height)] w-full items-center justify-center ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
          title={checked ? '关闭参数数组' : '将参数设为数组'}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={checked}
            disabled={disabled}
            aria-label={`切换参数 ${target.method.parameters[index]?.name || index + 1} 数组状态`}
            onChange={event => setCodeTargetParameterArray(target, index, event.currentTarget.checked)}
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
                <th className={`${headCellClass} w-[64px]`}>数组</th>
                <th className={`${headCellClass} w-[180px]`}>默认值</th>
                <th className={`${headCellClass} w-[180px]`}>备注</th>
                <th className={headCellClass}>操作</th>
              </tr>
            </thead>
            <tbody>
              {target.method.parameters.map((parameter, index) => (
                <tr key={`${codeTargetKey(target)}:parameter:${index}`} className={rowChrome(row)}>
                  <td className={cellClass}>{renderParameterInput(target, index, 'name', parameter.name, '参数名', 'parameter')}</td>
                  <td className={cellClass}>{renderParameterInput(target, index, 'type', getLingCppParameterElementType(parameter.type), '类型', 'type')}</td>
                  <td className={cellClass}>{renderParameterArraySwitch(target, index, isLingCppArrayParameterType(parameter.type))}</td>
                  <td className={cellClass}>{renderParameterInput(target, index, 'defaultValue', parameter.defaultValue || '', '默认值', 'value')}</td>
                  <td className={cellClass}>{renderParameterInput(target, index, 'note', parameter.note || '', '备注', 'plain')}</td>
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
                <td className={cellClass} colSpan={6}>
                  <button
                    type="button"
                    onClick={() => insertCodeTargetParameter(target)}
                    disabled={!onUpdateSourceContent}
                    className={`inline-flex h-[var(--beginner-input-height)] items-center gap-1 rounded border px-2 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                      isDarkMode
                        ? 'border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/10'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                    title="在参数表末尾插入新参数；在参数行按 Enter 可在当前行下方插入"
                  >
                    <Plus className="h-3 w-3" />
                    插入参数
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    };

    const renderBeginnerNestedFlowTracks = (
      flow: BeginnerFlowGuideRow,
      rowKey: string,
      lineHeight: number,
      codePadding = 0
    ) => {
      const nestedTracks = flow.tracks.filter(track => track.depth > 0);
      if (!nestedTracks.length) return null;
      const railSpacing = Math.max(18, Math.round(editorFontSize * 2.45));
      return nestedTracks.map(track => (
        <span
          key={`${rowKey}:flow:${track.depth}:${track.mark}`}
          aria-hidden="true"
          className={`pointer-events-none absolute z-0 flex items-center font-mono text-[11px] tabular-nums ${
            track.mark === '│'
              ? isDarkMode ? 'text-cyan-500/35' : 'text-cyan-600/45'
              : isDarkMode ? 'text-cyan-500/70 font-semibold' : 'text-cyan-600/80 font-semibold'
          }`}
          style={{
            left: `${codePadding + Math.round((track.depth - 0.5) * railSpacing)}px`,
            height: `${lineHeight}px`,
            lineHeight: `${lineHeight}px`
          }}
        >
          {track.mark}
        </span>
      ));
    };

    const renderCodeBodyEditor = (target: BeginnerCodeTarget, compact = false) => {
      const bodyText = methodBodyText(target.method);
      const targetKey = codeTargetKey(target);
      const draftBodyText = beginnerCodeDraftsRef.current[targetKey] ?? beginnerCodeDrafts[targetKey] ?? bodyText;
      const bodyLines = draftBodyText.split('\n').length ? draftBodyText.split('\n') : [''];
      const flowGuideRows = getBeginnerIfFlowGuideRows(bodyLines);
      const editorHeightClass = compact ? 'min-h-[170px]' : 'min-h-[230px]';
      const lineHeight = Math.max(18, Math.round(editorFontSize * 1.65));
      const editorTextStyle = {
        fontSize: `${editorFontSize}px`,
        lineHeight: `${lineHeight}px`
      };
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
                const flow = flowGuideRows[index];
                const outerMark = flow.tracks.find(track => track.depth === 0)?.mark || '';
                return (
                  <div
                    key={`${index}:${outerMark}`}
                    className={`relative ${flow.kind ? 'font-semibold' : ''} ${
                      flow.inBlock && !flow.kind ? isDarkMode ? 'text-cyan-500/35' : 'text-cyan-600/45' : ''
                    }`}
                    title={flow.kind ? line.trim() : undefined}
                    style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                  >
                    {outerMark}
                  </div>
                );
              })}
            </div>
            <div className="relative min-w-0">
              <div data-beginner-nested-flow-guide aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden px-3 py-2">
                {bodyLines.map((_, index) => (
                  <div
                    key={`${targetKey}:nested-flow:${index}`}
                    className="relative"
                    style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                  >
                    {renderBeginnerNestedFlowTracks(flowGuideRows[index], `${targetKey}:${index}`, lineHeight, 12)}
                  </div>
                ))}
              </div>
              <textarea
                key={`${target.className}:${target.method.name}:${target.method.line}:${bodyText}:${compact ? 'inline' : 'section'}:${beginnerDraftExternalRevisionRef.current[codeTargetKey(target)] ?? 0}`}
                data-text-model-view-key={`${target.className}:${target.method.kind}:${target.method.name}`}
                data-lingbuilder-editor-command-owner="true"
                data-source-line-start={target.method.statements[0]?.line || target.method.line + 1}
                data-source-line-map={target.method.statements.map(statement => statement.line).join(',')}
                data-source-column-start={methodBodyStartColumn(target.method)}
                data-source-column-map={methodBodySourceColumns(target.method).join(',')}
                defaultValue={draftBodyText}
                wrap="off"
                spellCheck={false}
                readOnly={!onUpdateSourceContent}
                placeholder="输入中文代码，@ 后面写原生 C++"
                onChange={event => { handleBeginnerCodeChange(target, event); captureBeginnerTextareaView(event.currentTarget); }}
                onBlur={event => handleBeginnerCodeBlur(target, bodyText, event)}
                onFocus={event => scheduleBeginnerPointerSync(target, event.currentTarget)}
                onClick={event => handleBeginnerCodeClick(target, event)}
                onDoubleClick={event => handleBeginnerCodeDoubleClick(target, event)}
                onContextMenu={event => openBeginnerContextMenu(event, target, event.currentTarget)}
                onKeyDown={event => handleBeginnerCodeKeyDown(target, event)}
                onKeyUp={event => { updateBeginnerCommandHint(target, event.currentTarget); captureBeginnerTextareaView(event.currentTarget); }}
                onSelect={event => scheduleBeginnerPointerSync(target, event.currentTarget)}
                onScroll={event => {
                  const lineNumberColumn = event.currentTarget.closest('[data-beginner-editor-root]')?.querySelector('[data-beginner-line-numbers]');
                  const flowGuideColumn = event.currentTarget.closest('[data-beginner-editor-root]')?.querySelector('[data-beginner-flow-guide]');
                  const nestedFlowGuide = event.currentTarget.closest('[data-beginner-editor-root]')?.querySelector('[data-beginner-nested-flow-guide]');
                  if (lineNumberColumn instanceof HTMLElement) lineNumberColumn.scrollTop = event.currentTarget.scrollTop;
                  if (flowGuideColumn instanceof HTMLElement) flowGuideColumn.scrollTop = event.currentTarget.scrollTop;
                  if (nestedFlowGuide instanceof HTMLElement) nestedFlowGuide.style.transform = `translateX(-${event.currentTarget.scrollLeft}px)`;
                  captureBeginnerTextareaView(event.currentTarget);
                }}
                onWheel={handleEditorFontWheel}
                title="Ctrl+单击局部控件变量、项目子程序调用或 &处理器名可转到定义"
                style={editorTextStyle}
                className={`relative z-10 ${editorHeightClass} w-full resize-y overflow-x-auto overflow-y-hidden whitespace-pre border-0 bg-transparent px-3 py-2 font-mono outline-none ${
                  isDarkMode
                    ? 'text-slate-100 placeholder:text-slate-600'
                    : 'text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>
          </div>
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
      rows.length + (primaryMethodOwnerName ? 1 : 0),
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
          {primaryMethodOwnerName && (
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
                  <td className={cellClass}>{renderNewEventInput('parameters', '文本型 内容, 整数型 次数', 'plain')}</td>
                  <td className={`${cellClass} text-right`}>{renderTextCell('新', 'muted')}</td>
                  <td className={cellClass}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => commitNewEventDraft()}
                        disabled={!onUpdateSourceContent || !primaryLingCppClass || !newEventDraft.handlerName.trim()}
                        className={`inline-flex h-[var(--beginner-input-height)] flex-1 items-center justify-center gap-1 rounded border px-1.5 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                          isDarkMode
                            ? 'border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/10'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                        title="按当前处理器名和参数新增事件"
                      >
                        <Check className="h-3 w-3" />
                        新增
                      </button>
                      <button
                        type="button"
                        onClick={resetNewEventDraft}
                        disabled={!newEventDraft.handlerName && !newEventDraft.parameters}
                        aria-label="取消新增事件"
                        className={`inline-flex h-[var(--beginner-input-height)] w-7 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                          isDarkMode
                            ? 'border-slate-600 text-slate-400 hover:bg-slate-700/50'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                        title="取消并清空新增事件表单"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
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
      rows.length + (primaryMethodOwnerName ? 1 : 0),
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
                  <td className={cellClass}>{renderFunctionCallTemplatePreview(target ? functionCallName(target) : (row.targetName || row.name), row.parameters, true)}</td>
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
          {primaryMethodOwnerName && (
            <tr className={isDarkMode ? 'bg-[#121318]' : 'bg-slate-50'}>
              <td className={cellClass}>{renderNewFunctionInput('returnType', '空', 'type')}</td>
              <td className={cellClass}>{renderNewFunctionInput('name', '输入功能名', 'procedure')}</td>
              <td className={cellClass}>{renderNewFunctionInput('parameters', '文本型 内容, 整数型 次数', 'plain')}</td>
              <td className={cellClass}>{renderTextCell('填写后可插入调用', 'muted')}</td>
              <td className={`${cellClass} text-right`}>{renderTextCell('新', 'muted')}</td>
              <td className={cellClass}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => commitNewFunctionDraft()}
                    disabled={!onUpdateSourceContent || !primaryMethodOwnerName || !newFunctionDraft.name.trim()}
                    className={`inline-flex h-[var(--beginner-input-height)] flex-1 items-center justify-center gap-1 rounded border px-1.5 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                      isDarkMode
                        ? 'border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/10'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                    title="按当前返回值、功能名和参数新增功能"
                  >
                    <Check className="h-3 w-3" />
                    新增
                  </button>
                  <button
                    type="button"
                    onClick={resetNewFunctionDraft}
                    disabled={newFunctionDraft.returnType === '空' && !newFunctionDraft.name && !newFunctionDraft.parameters}
                    aria-label="取消新增功能"
                    className={`inline-flex h-[var(--beginner-input-height)] w-7 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                      isDarkMode
                        ? 'border-slate-600 text-slate-400 hover:bg-slate-700/50'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                    title="取消并清空新增功能表单"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </td>
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
    const isBeginnerProcessCollapsed = (target: BeginnerCodeTarget) =>
      collapsedBeginnerProcessTargetKeys.includes(codeTargetKey(target));
    const toggleBeginnerProcessCollapsed = (target: BeginnerCodeTarget) => {
      const targetKey = codeTargetKey(target);
      setCollapsedBeginnerProcessTargetKeys(current =>
        current.includes(targetKey)
          ? current.filter(key => key !== targetKey)
          : [...current, targetKey]
      );
    };
    const collapseAllBeginnerProcesses = () => {
      setCollapsedBeginnerProcessTargetKeys(allProcessTargets.map(codeTargetKey));
    };
    const expandAllBeginnerProcesses = () => {
      setCollapsedBeginnerProcessTargetKeys([]);
    };
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
    type CompactColumn = { label: string; width: number };
    const beginnerKnownMembers = new Set([
      ...memberRows.map(row => row.targetName || row.name),
      ...(projectGlobals?.constants || []).map(constant => constant.name),
      ...(projectGlobals?.globals || []).map(global => global.name)
    ].filter(Boolean));
    const beginnerKnownProcedures = new Set(codeTargets.map(target => target.method.name).filter(Boolean));
    const beginnerModuleCommands = new Set(getLingCppModuleCommandNames(moduleContext));
    const beginnerControlReferenceNames = new Set(getLingCppControlReferences(
      normalizedSourceCode,
      designerProject,
      moduleContext,
      activeFile?.path
    ).filter(reference => reference.status === 'resolved').map(reference => reference.name));
    const beginnerNativeVariables = extractLingCppNativeVariableNames(normalizedSourceCode);
    const beginnerLocalNames = new Set([
      ...structuredReadingRows.filter(row => row.group === 'local').map(row => row.name),
      ...codeTargets.flatMap(item => (item.method.locals || []).map(local => local.name))
    ].filter(Boolean));

    const renderBeginnerCodeToken = (token: string, kind: LingCppPresentationTokenKind, index: number) => {
      if (!token) return null;
      const className = {
        string: isDarkMode ? 'text-[#d7c5a1]' : 'text-amber-700',
        command: isDarkMode ? 'text-[#dcdcaa]' : 'text-amber-700',
        keyword: isDarkMode ? 'text-[#4ea5ff]' : 'text-blue-700',
        type: isDarkMode ? 'text-[#2bd4c6]' : 'text-teal-700',
        literal: isDarkMode ? 'text-[#b5cea8]' : 'text-emerald-700',
        'module-command': isDarkMode ? 'text-[#22d3ee]' : 'text-[#006a7a]',
        'control-reference': '',
        constant: '',
        local: isDarkMode ? 'text-[#9df59c]' : 'text-[#047857]',
        member: isDarkMode ? 'text-amber-200' : 'text-amber-800',
        procedure: isDarkMode ? 'text-cyan-200' : 'text-cyan-800',
        operator: isDarkMode ? 'text-slate-400' : 'text-slate-500',
        'native-marker': isDarkMode ? 'text-[#c586c0]' : 'text-[#7a1fa2]',
        'native-keyword': isDarkMode ? 'text-[#569cd6]' : 'text-blue-700',
        'native-type': isDarkMode ? 'text-[#4ec9b0]' : 'text-teal-700',
        'native-namespace': isDarkMode ? 'text-[#4fc1ff]' : 'text-blue-700',
        'native-function': isDarkMode ? 'text-[#dcdcaa]' : 'text-[#795e26]',
        'native-variable': isDarkMode ? 'text-[#9cdcfe]' : 'text-[#001080]',
        identifier: isDarkMode ? 'text-slate-100' : 'text-slate-900'
      }[kind];
      return (
        <span
          key={index}
          data-lingcpp-token={kind}
          className={className}
          style={{
            ...BEGINNER_CODE_OVERLAY_TOKEN_STYLE,
            ...(kind === 'control-reference' ? { color: getLingCppControlReferenceTokenColor(isDarkMode), fontWeight: 600 } : {}),
            ...(kind === 'constant' ? { color: getLingCppConstantTokenColor(isDarkMode) } : {})
          }}
        >
          {token}
        </span>
      );
    };

    const renderBeginnerCodeLine = (line: string, target?: BeginnerCodeTarget, isTextBlockLine = false) => {
      if (!line) return <span>&nbsp;</span>;
      if (isTextBlockLine) {
        // 多行文本块内容行：整行按字符串着色，不做注释切分与命令 token 化。
        const blockIndent = line.match(/^\s*/u)?.[0] || '';
        return (
          <>
            <span>{blockIndent}</span>
            <span data-lingcpp-token="string" style={{ ...BEGINNER_CODE_OVERLAY_TOKEN_STYLE, color: isDarkMode ? '#d7c5a1' : '#b45309' }}>
              {line.slice(blockIndent.length)}
            </span>
          </>
        );
      }
      const { code, comment } = splitLingCppLineComment(line);
      // A whole-line comment (`//` or a leading `'`) is never tokenized: keeping
      // it out of the code path is what makes it read as a comment rather than
      // as executable identifiers in the plain-text color.
      if (!code.trim()) {
        if (!comment) return <span>&nbsp;</span>;
        return (
          <>
            <span>{code}</span>
            <span style={{ color: getLingCppCommentTokenColor(isDarkMode) }}>{comment}</span>
          </>
        );
      }
      const leadingSpace = code.match(/^\s*/u)?.[0] || '';
      const body = code.slice(leadingSpace.length);
      const isNativeCpp = body.trimStart().startsWith('@');
      const tokens = classifyLingCppPresentationCode(body, {
        isNativeCpp,
        moduleCommands: beginnerModuleCommands,
        knownMembers: beginnerKnownMembers,
        knownLocals: new Set([
          ...beginnerLocalNames,
          ...(target?.method.parameters || []).map(parameter => parameter.name),
          ...(target?.method.locals || []).map(local => local.name)
        ].filter(Boolean)),
        knownProcedures: beginnerKnownProcedures,
        controlReferences: beginnerControlReferenceNames,
        nativeVariables: beginnerNativeVariables
      });
      return (
        <>
          <span>{leadingSpace}</span>
          {tokens.map((token, index) => renderBeginnerCodeToken(token.text, token.kind, index))}
          {comment && (
            <span style={{ color: getLingCppCommentTokenColor(isDarkMode) }}>{comment}</span>
          )}
        </>
      );
    };

    const renderSourceShell = (
      id: string,
      visualLine: number,
      sourceLine: number,
      tone: 'plain' | 'active' | 'warning',
      children: React.ReactNode,
      fold?: {
        collapsed: boolean;
        onToggle: () => void;
        targetKey?: string;
        contentMinWidth?: number;
        deleteAction?: {
          label: string;
          onDelete: () => void;
          disabled?: boolean;
        };
      },
      flow?: {
        column: React.ReactNode;
        minWidthPx: number;
      }
    ) => (
      <section
        id={sectionDomId(id)}
        data-structured-line={sourceLine}
        data-beginner-process-key={fold?.targetKey}
        style={fold?.contentMinWidth
          ? { minWidth: `calc(var(--beginner-gutter-width) + ${fold.contentMinWidth}px)` }
          : flow
            ? { minWidth: `calc(var(--beginner-gutter-width) + var(--beginner-flow-width) + ${flow.minWidthPx}px)` }
            : undefined}
        className={`group relative grid ${flow
          ? 'grid-cols-[var(--beginner-gutter-width)_var(--beginner-flow-width)_minmax(0,1fr)]'
          : 'grid-cols-[var(--beginner-gutter-width)_minmax(0,1fr)]'} border-b ${canvasBorder} ${
          tone === 'active'
            ? `${canvasBg} ${isDarkMode ? 'shadow-[inset_2px_0_0_rgba(34,211,238,0.55)]' : 'shadow-[inset_2px_0_0_rgba(8,145,178,0.5)]'}`
            : tone === 'warning'
              ? isDarkMode ? 'bg-amber-500/[0.06]' : 'bg-amber-50'
              : canvasBg
        }`}
      >
        <div className={`relative border-r ${canvasBorder} ${gutterBg}`}>
          <button
            type="button"
            onClick={() => revealLingCppLine(sourceLine)}
            className="h-full w-full px-2 py-2 text-right font-mono text-[length:var(--beginner-table-font-size)] leading-[var(--beginner-table-line-height)] tabular-nums"
            title={`定位到源码第 ${sourceLine} 行`}
          >
            {sourceLine}
          </button>
          {fold && (
            <button
              type="button"
              aria-expanded={!fold.collapsed}
              aria-label={fold.collapsed ? '展开当前子程序' : '折叠当前子程序'}
              onClick={event => {
                event.stopPropagation();
                fold.onToggle();
              }}
              className={`absolute left-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded transition-colors ${
                isDarkMode ? 'text-slate-500 hover:bg-slate-700/60 hover:text-cyan-200' : 'text-slate-400 hover:bg-slate-200 hover:text-cyan-700'
              }`}
              title={fold.collapsed ? '展开当前子程序' : '折叠当前子程序'}
            >
              {fold.collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        {flow?.column}
        <div className="min-w-0 px-3 py-2">{children}</div>
        {fold?.deleteAction && (
          <button
            type="button"
            aria-label={fold.deleteAction.label}
            title={fold.deleteAction.label}
            disabled={fold.deleteAction.disabled}
            onPointerDown={event => event.stopPropagation()}
            onClick={event => {
              event.stopPropagation();
              fold.deleteAction?.onDelete();
            }}
            className={`absolute right-3 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-[3px] border opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 disabled:cursor-not-allowed disabled:opacity-35 ${
              isDarkMode
                ? 'border-[#5a5a72] bg-[#252526] text-[#9a9ab8] hover:border-rose-400 hover:bg-rose-500/15 hover:text-rose-400'
                : 'border-slate-300 bg-white text-slate-500 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-600'
            }`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </section>
    );

    const renderBlankSourceLine = (visualLine: number) => (
      <section key={`blank-${visualLine}`} className={`grid grid-cols-[var(--beginner-gutter-width)_minmax(0,1fr)] ${editorCanvasBg}`}>
        <div className={`border-r px-2 py-1 text-right font-mono text-[length:var(--beginner-table-font-size)] leading-[var(--beginner-table-line-height)] tabular-nums ${canvasBorder} ${gutterBg}`} />
        <div className="h-[var(--beginner-blank-row-height)]" />
      </section>
    );

    const resolveBeginnerColumnWidths = (tableKey: BeginnerTableKey, widths: number[]) =>
      widths.map((width, columnIndex) =>
        Math.max(BEGINNER_TABLE_MIN_COLUMN_WIDTH, beginnerColumnWidthOverrides[tableKey]?.[columnIndex] || width)
      );

    const renderInlineTable = (
      tableKey: BeginnerTableKey,
      columns: CompactColumn[],
      rows: React.ReactNode[],
      maxWidth: number,
      preserveWidth = false
    ) => {
      const effectiveWidths = resolveBeginnerColumnWidths(tableKey, columns.map(column => column.width));
      const tableWidth = Math.max(maxWidth, effectiveWidths.reduce((sum, width) => sum + width, 0));
      return (
        <div
          data-beginner-preserve-width={preserveWidth ? 'true' : undefined}
          data-beginner-table={tableKey}
          className={`inline-block align-top ${preserveWidth ? 'max-w-none' : 'w-full max-w-full'}`}
          style={preserveWidth
            ? {
                width: `${tableWidth}px`,
                minWidth: `${tableWidth}px`
              }
            : { maxWidth: `calc(${tableWidth}px * var(--beginner-table-scale))` }}
        >
          <table className={`w-full table-fixed border-collapse text-left font-sans text-[length:var(--beginner-table-font-size)] leading-[var(--beginner-table-line-height)] ${compactTableBorder}`}>
            <thead>
              <tr>
                {columns.map((column, columnIndex) => (
                  <th
                    key={`${column.label}:${columnIndex}`}
                    className={`${compactHeadCellClass} relative select-none`}
                    style={{ width: effectiveWidths[columnIndex] }}
                  >
                    {column.label}
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`调整「${column.label}」列宽`}
                      title="拖动调整列宽，双击恢复默认"
                      onPointerDown={event => beginBeginnerColumnResize(event, tableKey, columnIndex, effectiveWidths[columnIndex])}
                      onDoubleClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        resetBeginnerColumnWidth(tableKey, columnIndex);
                      }}
                      className="absolute inset-y-0 right-0 z-10 w-[7px] cursor-col-resize touch-none after:absolute after:inset-y-[3px] after:right-0 after:w-[2px] after:rounded-full after:bg-transparent hover:after:bg-cyan-500/70"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      );
    };

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
          'declaration',
          [
            { label: '窗口程序集名', width: 160 },
            { label: '保 留', width: 58 },
            { label: '保 留', width: 58 },
            { label: '备 注', width: 120 }
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

    const getProcedureNameColumnWidth = (name: string) => {
      const cellHorizontalPadding = Math.max(8, Math.round(beginnerTableFontSize * 0.75)) * 2;
      const inputHorizontalPaddingAndEditingRoom = 24;
      return Math.max(
        220,
        Math.ceil(
          measureBeginnerProcedureName(name, beginnerProcedureFontSize) +
          cellHorizontalPadding +
          inputHorizontalPaddingAndEditingRoom
        )
      );
    };

    const renderProcessHeader = (target: BeginnerCodeTarget, visualLine: number) => {
      const row = findStructuredRowForCodeTarget(target);
      const canEditName = target.method.kind === 'method' || target.method.kind === 'event';
      const canEditReturnType = target.method.kind === 'method';
      const canEditStatic = target.method.kind === 'method';
      const accessValue = row?.access || target.method.access || '公开';
      const noteValue = row?.note || '';
      const selected = isActiveProcessTarget(target);
      const nameColumnWidth = getProcedureNameColumnWidth(target.method.name);
      const returnTypeColumnWidth = Math.ceil(90 * beginnerTableScale);
      const staticColumnWidth = Math.ceil(54 * beginnerTableScale);
      const accessColumnWidth = Math.ceil(74 * beginnerTableScale);
      const noteColumnWidth = Math.min(420, Math.max(280, Array.from(noteValue).length * 14 + 28));
      const processTableWidth = resolveBeginnerColumnWidths('process', [
        nameColumnWidth,
        returnTypeColumnWidth,
        staticColumnWidth,
        accessColumnWidth,
        noteColumnWidth
      ]).reduce((sum, width) => sum + width, 0);
      const collapsed = isBeginnerProcessCollapsed(target);

      return renderSourceShell(
        `${target.method.kind}-${target.method.name}-${target.method.line}`,
        visualLine,
        target.method.line,
        selected ? 'active' : 'plain',
        renderInlineTable(
          'process',
          [
            { label: '子程序名', width: nameColumnWidth },
            { label: '返回值类型', width: returnTypeColumnWidth },
            { label: '静态', width: staticColumnWidth },
            { label: '公开', width: accessColumnWidth },
            { label: '备注', width: noteColumnWidth }
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
          processTableWidth,
          true
        ),
        {
          collapsed,
          onToggle: () => toggleBeginnerProcessCollapsed(target),
          targetKey: codeTargetKey(target),
          contentMinWidth: processTableWidth + 24,
          deleteAction: target.method.kind === 'constructor'
            ? undefined
            : {
                label: `删除${target.method.kind === 'event' ? '事件处理器' : '子程序'}「${target.method.name}」`,
                onDelete: () => { void deleteBeginnerCodeTarget(target); },
                disabled: !onUpdateSourceContent
              }
        }
      );
    };

    const renderMemberCanvas = (visualLineStart: number) => {
      const rows = memberRows;
      if (rows.length === 0 && !primaryLingCppClass) return null;
      const sourceLine = rows[0]?.line || primaryLingCppClass?.line || 1;
      const showNewMemberRow = Boolean(primaryLingCppClass);
      const memberCollapsed = isBeginnerMemberTableCollapsed;
      const countedRows = memberCollapsed
        ? []
        : rows.length > 0
          ? rows.map((row, index) => ({ visualLine: visualLineStart + index, sourceLine: row.line }))
          : showNewMemberRow
            ? [{ visualLine: visualLineStart, sourceLine }]
            : [];

      return (
        <section
          id={sectionDomId('member')}
          data-structured-line={sourceLine}
          className={`group relative grid grid-cols-[var(--beginner-gutter-width)_minmax(0,1fr)] border-b ${canvasBorder} ${canvasBg}`}
        >
          <div className={`select-none border-r px-2 py-2 text-right font-mono text-[length:var(--beginner-table-font-size)] leading-[var(--beginner-table-line-height)] tabular-nums ${canvasBorder} ${gutterBg}`}>
            <div className={`relative h-[var(--beginner-table-row-height)] border-b ${canvasBorder}`}>
              <button
                type="button"
                aria-expanded={!memberCollapsed}
                aria-label={memberCollapsed ? '展开程序集变量表' : '折叠程序集变量表'}
                onClick={() => setIsBeginnerMemberTableCollapsed(current => !current)}
                className={`absolute left-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded transition-colors ${
                  isDarkMode ? 'text-slate-500 hover:bg-slate-700/60 hover:text-cyan-200' : 'text-slate-400 hover:bg-slate-200 hover:text-cyan-700'
                }`}
                title={memberCollapsed ? '展开程序集变量表' : '折叠程序集变量表'}
              >
                {memberCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>
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
            {!memberCollapsed && showNewMemberRow && rows.length > 0 && (
              <div className="h-[var(--beginner-table-row-height)] text-right text-slate-600">+</div>
            )}
          </div>
          <div className="min-w-0 px-3 py-2">
          {renderInlineTable(
            'member',
            [
              { label: memberCollapsed ? `程序集变量 · ${rows.length} 项` : '程序集变量', width: 140 },
              { label: '类 型', width: 96 },
              { label: '静 态', width: 56 },
              { label: '数 组', width: 56 },
              { label: '备 注', width: 140 },
              { label: '操 作', width: 88 }
            ],
            [
              ...(memberCollapsed ? [] : rows.map(row => (
                <tr key={`${row.id}:${row.line}`} className={rowChrome(row)}>
                  <td className={compactCellClass}>{renderDirectStructureInput(row, 'member-name', row.targetName || row.name, '变量名', 'variable')}</td>
                  <td className={compactCellClass}>{renderDirectStructureInput(row, 'member-type', row.type || '', '类型', 'type')}</td>
                  <td className={compactCellClass}>{renderMemberBooleanSwitch(row, 'member-static', Boolean(row.isStatic), '切换程序集变量静态')}</td>
                  <td className={compactCellClass}>{renderMemberBooleanSwitch(row, 'member-array', Boolean(row.isArray), '切换程序集变量数组')}</td>
                  <td className={compactCellClass}>{renderDirectStructureInput(row, 'member-note', row.note || '', '备注', 'plain')}</td>
                  <td className={compactCellClass}>
                    <button
                      type="button"
                      onClick={() => { void deleteStructuredRow(row); }}
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
              ))),
              !memberCollapsed && primaryLingCppClass ? (
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
      const targetKey = codeTargetKey(target);
      return renderSourceShell(
        `${target.method.kind}-${target.method.name}-params`,
        visualLine,
        target.method.line,
        'plain',
        <div className="min-w-0">
          {renderInlineTable(
            'parameters',
            [
              { label: '参数名', width: 140 },
              { label: '类 型', width: 96 },
              { label: '数 组', width: 56 },
              { label: '默认值', width: 96 },
              { label: '备 注', width: 140 },
              { label: '操 作', width: 104 }
            ],
            [
              ...target.method.parameters.map((parameter, index) => (
                <tr key={`${targetKey}:param:${index}`} className={isDarkMode ? 'bg-[#18191f]' : 'bg-white'}>
                  <td className={compactCellClass}>{renderParameterInput(target, index, 'name', parameter.name, '参数名', 'parameter')}</td>
                  <td className={compactCellClass}>{renderParameterInput(target, index, 'type', getLingCppParameterElementType(parameter.type), '类型', 'type')}</td>
                  <td className={compactCellClass}>{renderParameterArraySwitch(target, index, isLingCppArrayParameterType(parameter.type))}</td>
                  <td className={compactCellClass}>{renderParameterInput(target, index, 'defaultValue', parameter.defaultValue || '', '默认值', 'value')}</td>
                  <td className={compactCellClass}>{renderParameterInput(target, index, 'note', parameter.note || '', '备注', 'plain')}</td>
                  <td className={compactCellClass}>
                    <button
                      type="button"
                      onClick={() => removeCodeTargetParameter(target, index)}
                      disabled={!onUpdateSourceContent}
                      className={`inline-flex h-[var(--beginner-input-height)] w-full items-center justify-center gap-1 whitespace-nowrap rounded border px-1.5 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                        isDarkMode
                          ? 'border-rose-500/25 text-rose-300 hover:bg-rose-500/10'
                          : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                      }`}
                      title={`删除参数 ${parameter.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                      删除
                    </button>
                  </td>
                </tr>
              )),
              <tr key={`${targetKey}:insert-parameter`} className={isDarkMode ? 'bg-[#121318]' : 'bg-slate-50'}>
                <td className={compactCellClass} colSpan={6}>
                  <button
                    type="button"
                    onClick={() => insertCodeTargetParameter(target)}
                    disabled={!onUpdateSourceContent}
                    className={`inline-flex h-[var(--beginner-input-height)] items-center gap-1 rounded border px-2 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                      isDarkMode
                        ? 'border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/10'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                    title="在参数表末尾插入新参数；在参数行按 Enter 可在当前行下方插入"
                  >
                    <Plus className="h-3 w-3" />
                    插入参数
                  </button>
                </td>
              </tr>
            ],
            704
          )}
        </div>
      );
    };

    const renderLocalVariableInput = (
      target: BeginnerCodeTarget,
      local: LingCppLocalVariable,
      field: 'name' | 'type' | 'initialValue' | 'note',
      value: string,
      placeholder: string,
      tone: StructureInputTone,
      isLastInGroup = false
    ) => {
      const inputKey = `${codeTargetKey(target)}:local:${local.line}:${local.name}:${field}`;
      const fieldLabel = field === 'name' ? '名称' : field === 'type' ? '类型' : field === 'initialValue' ? '初始值' : '备注';
      const typeCompletion = field === 'type' && beginnerTypeCompletionState?.inputKey === inputKey
        ? beginnerTypeCompletionState
        : null;
      const applyTypeCompletion = (item: BeginnerTypeCompletionItem, input: HTMLInputElement | null) => {
        if (input) {
          input.value = item.label;
          input.dataset.beginnerTypeApplied = 'true';
        }
        setBeginnerTypeCompletionState(null);
        updateLocalVariable(target, local, { type: item.label });
      };

      return (
        <div className="relative min-w-0" data-beginner-type-wrap={field === 'type' ? inputKey : undefined}>
          <input
            key={`${codeTargetKey(target)}:${local.line}:${local.name}:${field}:${value}`}
            data-beginner-local-target-key={field === 'name' ? codeTargetKey(target) : undefined}
            data-beginner-local-name={field === 'name' ? local.name : undefined}
            data-beginner-local-type={field === 'type' ? local.name : undefined}
            defaultValue={value}
            onDoubleClick={field === 'name' ? event => {
              // 中文变量名无分词边界，原生双击只选中词典片段（如 缓冲区句柄 → 缓冲区）；
              // 名称列的值就是完整标识符，双击按标识符边界整段选中。
              const input = event.currentTarget;
              const span = getBeginnerIdentifierSpanAtOffset(input.value, input.selectionStart ?? input.value.length);
              if (span) input.setSelectionRange(span.start, span.end);
            } : undefined}
            placeholder={placeholder}
            aria-label={`局部${local.isConstant ? '常量' : '变量'} ${local.name} ${fieldLabel}`}
            autoComplete="off"
            readOnly={!onUpdateSourceContent}
            onChange={event => {
              if (field === 'type') updateBeginnerTypeCompletion(inputKey, event.currentTarget);
            }}
            onBlur={event => {
              if (field === 'type') closeBeginnerTypeCompletionLater(inputKey);
              if (event.currentTarget.dataset.beginnerTypeApplied === 'true') {
                delete event.currentTarget.dataset.beginnerTypeApplied;
                return;
              }
              const rawValue = event.currentTarget.value.trim();
              const nextValue = field === 'type' ? resolveBeginnerTypeInput(rawValue) : rawValue;
              if (nextValue === value) return;
              event.currentTarget.value = nextValue;
              if (field === 'name') updateLocalVariable(target, local, { newName: nextValue });
              if (field === 'type') updateLocalVariable(target, local, { type: nextValue });
              if (field === 'initialValue') updateLocalVariable(target, local, { initialValue: nextValue });
              if (field === 'note') updateLocalVariable(target, local, { note: nextValue });
            }}
            onKeyDown={event => {
              if (field === 'type' && typeCompletion) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  moveBeginnerTypeCompletion(inputKey, event.key === 'ArrowDown' ? 1 : -1);
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
              if (event.key === 'Enter') {
                event.preventDefault();
                if (isLastInGroup && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
                  appendBeginnerLocalFromTable(target, local, field, event.currentTarget.value);
                  return;
                }
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                setBeginnerTypeCompletionState(null);
                event.currentTarget.value = value;
                event.currentTarget.blur();
              }
            }}
            className={directInputClasses(tone)}
            title={field === 'type' ? '支持中文、英文和拼音简写，例如 wb、zs、string、int' : undefined}
          />
          {field === 'type' && renderBeginnerTypeCompletionPopup(inputKey, applyTypeCompletion)}
        </div>
      );
    };

    const renderLocalInitialValueCell = (
      target: BeginnerCodeTarget,
      local: LingCppLocalVariable,
      isLastInGroup: boolean
    ) => (
      <div className="flex min-w-0 items-center gap-1">
        <div className="min-w-0 flex-1">
          {renderLocalVariableInput(
            target,
            local,
            'initialValue',
            local.initialValue || '',
            local.isConstant ? '常量必填' : '可留空',
            'value',
            isLastInGroup
          )}
        </div>
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            setBeginnerInitialValueEditor({
              target,
              local,
              onSave: value => updateLocalVariable(target, local, { initialValue: value })
            });
          }}
          aria-label={`打开局部声明 ${local.name || '未命名'} 的初始值编辑器`}
          title="打开初始值编辑器"
          className={`flex h-[var(--beginner-input-height)] w-7 shrink-0 items-center justify-center rounded border transition-colors ${
            isDarkMode
              ? 'border-[#3b3c46] text-cyan-300 hover:border-cyan-500/60 hover:bg-cyan-500/10'
              : 'border-slate-200 text-cyan-700 hover:border-cyan-300 hover:bg-cyan-50'
          }`}
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );

    const renderLocalVariableCanvas = (
      target: BeginnerCodeTarget,
      visualLine: number,
      locals: LingCppLocalVariable[] = target.method.locals || [],
      groupId = 'default'
    ) => {
      if (locals.length === 0) return null;
      const sourceLine = locals[0]?.line || target.method.line + 1;
      const localGroupKey = `${codeTargetKey(target)}:${groupId}`;
      const collapsed = collapsedBeginnerLocalGroupKeys.includes(localGroupKey);
      // A 局部声明 inside a 如果/循环 block used to render as a full-width banner
      // between the block header and its body, splitting the flow tree. Instead,
      // align the table with the declaration's own source indent and continue the
      // enclosing flow rails through the table rows. Top-level declarations keep
      // the legacy single-column shell shifted by one fake flow column.
      const anchorLayout = getBeginnerLocalAnchorLayout(target.method, sourceLine, normalizedSourceLines);
      const outerTrack = anchorLayout.tracks.find(track => track.depth === 0);
      const nestedTracks = anchorLayout.tracks.filter(track => track.depth > 0);
      const railSpacing = Math.max(18, Math.round(editorFontSize * 2.45));
      const indentPx = outerTrack
        ? Math.round(anchorLayout.indentColumns * measureBeginnerMonoCharWidth(editorFontSize))
        : 0;
      const tableBlock = (
        <>
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? '展开局部声明组' : '折叠局部声明组'}
            onClick={() => setCollapsedBeginnerLocalGroupKeys(current =>
              current.includes(localGroupKey)
                ? current.filter(key => key !== localGroupKey)
                : [...current, localGroupKey]
            )}
            className={`flex w-full items-center gap-1.5 border-b px-2 py-1 text-left text-[10px] font-semibold ${tableHeadChrome}`}
            title={collapsed ? '展开局部声明组' : '折叠局部声明组'}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span>局部声明 · {locals.length} 个 · 变量与只读常量仅在当前子程序内有效</span>
            <span className="ml-auto font-normal opacity-70">Ctrl+L 变量 · Ctrl+B 常量</span>
          </button>
          {!collapsed && renderInlineTable(
            'locals',
            [
              { label: '类 别', width: 78 },
              { label: '名 称', width: 130 },
              { label: '类 型', width: 105 },
              { label: '数 组', width: 56 },
              { label: '初始值', width: 165 },
              { label: '备 注', width: 160 },
              { label: '操 作', width: 88 }
            ],
            locals.map((local, index) => {
              const isLastInGroup = index === locals.length - 1;
              return (
              <tr key={`${codeTargetKey(target)}:local:${local.line}:${local.name}`} className={isDarkMode ? 'bg-[#18191f]' : 'bg-white'}>
                  <td className={compactCellClass}>
                    <select
                      value={local.isConstant ? 'constant' : 'variable'}
                      disabled={!onUpdateSourceContent}
                      onChange={event => updateLocalVariable(target, local, {
                        isConstant: event.currentTarget.value === 'constant'
                      })}
                      aria-label={`选择局部声明 ${local.name} 的类别`}
                      className={directInputClasses('plain')}
                    >
                      <option value="variable">变量</option>
                      <option value="constant">常量</option>
                    </select>
                  </td>
                  <td className={compactCellClass}>{renderLocalVariableInput(target, local, 'name', local.name, '变量名', 'variable', isLastInGroup)}</td>
                  <td className={compactCellClass}>{renderLocalVariableInput(target, local, 'type', local.type, '类型', 'type', isLastInGroup)}</td>
                  <td className={compactCellClass}>
                    <label className="inline-flex h-[var(--beginner-input-height)] w-full cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={Boolean(local.isArray)}
                        disabled={!onUpdateSourceContent || Boolean(local.isConstant)}
                        onChange={event => updateLocalVariable(target, local, { isArray: event.currentTarget.checked })}
                        className="h-3.5 w-3.5 accent-cyan-500"
                        aria-label={`切换局部声明 ${local.name} 数组状态`}
                        title={local.isConstant ? '局部常量不支持数组' : undefined}
                      />
                    </label>
                  </td>
                  <td className={compactCellClass}>{renderLocalInitialValueCell(target, local, isLastInGroup)}</td>
                  <td className={compactCellClass}>{renderLocalVariableInput(target, local, 'note', local.note || '', '备注', 'plain', isLastInGroup)}</td>
                  <td className={compactCellClass}>
                    <button
                      type="button"
                      onClick={() => deleteLocalVariable(target, local)}
                      disabled={!onUpdateSourceContent}
                      className={`inline-flex h-[var(--beginner-input-height)] w-full items-center justify-center gap-1 rounded border px-2 text-[10px] font-semibold ${
                        isDarkMode ? 'border-rose-500/25 text-rose-300 hover:bg-rose-500/10' : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                      }`}
                    >
                      <Trash2 className="h-3 w-3" />删除
                    </button>
                  </td>
              </tr>
              );
            }),
            574
          )}
        </>
      );
      if (!outerTrack) {
        return renderSourceShell(
          `${target.method.kind}-${target.method.name}-locals`,
          visualLine,
          sourceLine,
          'plain',
          <div className="min-w-0" style={{ marginLeft: 'var(--beginner-flow-width)' }}>{tableBlock}</div>
        );
      }
      return renderSourceShell(
        `${target.method.kind}-${target.method.name}-locals`,
        visualLine,
        sourceLine,
        'plain',
        <div className="relative min-w-0">
          {nestedTracks.map(track => (
            <span
              key={`${localGroupKey}:rail:${track.depth}`}
              aria-hidden="true"
              className={`pointer-events-none absolute -top-2 -bottom-2 w-px ${
                isDarkMode ? 'bg-cyan-500/35' : 'bg-cyan-600/45'
              }`}
              // The shell's content column adds px-3 padding that the code body's
              // own rail container does not have; pull rails back so they sit on
              // the same absolute x as the nested rails beside the code lines.
              style={{ left: `${Math.round((track.depth - 0.5) * railSpacing) - 12}px` }}
            />
          ))}
          <div className="min-w-0" style={{ marginLeft: `${indentPx}px` }}>{tableBlock}</div>
        </div>,
        undefined,
        {
          column: (
            <div className={`relative ${isDarkMode ? 'bg-[#101116]' : 'bg-slate-50'}`}>
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-y-0 left-1/2 w-px ${
                  isDarkMode ? 'bg-cyan-500/55' : 'bg-cyan-600/60'
                }`}
              />
            </div>
          ),
          minWidthPx: indentPx + 590
        }
      );
    };

    const renderContinuousCodeBody = (
      target: BeginnerCodeTarget,
      firstVisualLine: number,
      segmentContext?: BeginnerCodeSegmentContext
    ) => {
      const bodyText = methodBodyText(target.method);
      const targetKey = codeTargetKey(target);
      const draftBodyText = segmentContext
        ? getCodeSegmentDraft(target, segmentContext).value
        : beginnerCodeDraftsRef.current[targetKey] ?? beginnerCodeDrafts[targetKey] ?? bodyText;
      const segmentStatements = segmentContext?.segment.statements || target.method.statements;
      const bodyLines = draftBodyText.split('\n').length ? draftBodyText.split('\n') : [''];
      const textBlockLines = beginnerTextBlockLineSet(draftBodyText);
      const flowGuideRows = getBeginnerIfFlowGuideRows(bodyLines);
      const lineHeight = Math.max(18, Math.round(editorFontSize * 1.65));
      const editorHeight = Math.max(lineHeight * Math.max(bodyLines.length, 1) + 24, lineHeight + 24);
      const editorTextStyle = { fontSize: `${editorFontSize}px`, lineHeight: `${lineHeight}px`, height: `${editorHeight}px` };
      const segmentId = segmentContext?.segment.id || 'all';
      const commandExpansionKey = (index: number) => `${targetKey}:${segmentId}:${index}`;
      const commandExpansions = bodyLines.map((line, index) =>
        textBlockLines.has(index + 1)
          ? null
          : parseBeginnerCommandExpansion(line, beginnerCommandParameterCatalog)
      );
      const expandedCommandIndex = expandedBeginnerCommand
        ? commandExpansions.findIndex((expansion, index) =>
            Boolean(expansion) && expandedBeginnerCommand === commandExpansionKey(index)
          )
        : -1;
      const activeCommandExpansion = expandedCommandIndex >= 0
        ? commandExpansions[expandedCommandIndex]
        : null;
      const expandedSourceLines = getBeginnerBodySourceLines(segmentStatements);
      const displaySourceLine = (index: number) => expandedSourceLines[index]
        || (segmentStatements[0]?.line || segmentContext?.segment.sourceLine || target.method.line + 1) + index;
      const toggleCommandExpansion = (
        event: React.MouseEvent<HTMLButtonElement>,
        index: number
      ) => {
        event.stopPropagation();
        const key = commandExpansionKey(index);
        setExpandedBeginnerCommand(current => current === key ? null : key);
      };
      const flowBlocks = parseBeginnerIfBlocks(bodyLines);
      const flowBlockKey = (block: (typeof flowBlocks)[number]) =>
        `${targetKey}:${segmentId}:${block.family}:${block.startLine}`;
      const collapsedFlowBlocks = flowBlocks.filter(block =>
        collapsedBeginnerFlowBlockKeys.includes(flowBlockKey(block))
      );
      const externalFlowFolds = segmentContext?.externalFlowFolds;
      const anchorFoldFor = (block: (typeof flowBlocks)[number]) =>
        externalFlowFolds?.find(fold =>
          fold.anchorSegmentId === segmentId && fold.anchorStartLine === block.startLine
        );
      const flowBlockAtStartLine = (line: number) => flowBlocks.find(block => block.startLine === line);
      const isSameFlowLineTarget = (value: BeginnerFlowLineTarget | null, line: number) =>
        value?.targetKey === targetKey && value.segmentId === segmentId && value.line === line;
      const updateActiveBeginnerFlowLine = (input: HTMLTextAreaElement) => {
        const line = getBeginnerLineAtOffset(input.value, input.selectionStart);
        setActiveBeginnerFlowLine(current => isSameFlowLineTarget(current, line)
          ? current
          : { targetKey, segmentId, line });
      };
      const updateHoveredBeginnerFlowLine = (
        input: HTMLTextAreaElement,
        clientY: number
      ) => {
        const rect = input.getBoundingClientRect();
        const line = Math.max(1, Math.min(
          bodyLines.length,
          Math.floor((clientY - rect.top - 8 + input.scrollTop) / lineHeight) + 1
        ));
        setHoveredBeginnerFlowLine(current => isSameFlowLineTarget(current, line)
          ? current
          : { targetKey, segmentId, line });
      };
      const clearHoveredBeginnerFlowLine = () => {
        setHoveredBeginnerFlowLine(current =>
          current?.targetKey === targetKey && current.segmentId === segmentId ? null : current
        );
      };
      const toggleBeginnerFlowBlock = (block: (typeof flowBlocks)[number]) => {
        const key = flowBlockKey(block);
        const isCollapsed = collapsedBeginnerFlowBlockKeys.includes(key);
        if (!isCollapsed) {
          const nextBody = beginnerCodeDraftsRef.current[targetKey] ?? bodyText;
          const applied = commitBeginnerCodeBody(
            target.className,
            target.method.name,
            bodyText,
            nextBody,
            beginnerLocalStatementAnchorsRef.current[targetKey]
          );
          if (!applied) return;
          clearBeginnerCodeDraft(target);
        }
        setExpandedBeginnerCommand(current => current?.startsWith(`${targetKey}:${segmentId}:`) ? null : current);
        setCollapsedBeginnerFlowBlockKeys(current => isCollapsed
          ? current.filter(item => item !== key)
          : [...current, key]
        );
      };
      const renderBeginnerFlowFoldButton = (
        block: (typeof flowBlocks)[number],
        line: string,
        isCollapsed: boolean
      ) => {
        const isVisible = isCollapsed
          || isSameFlowLineTarget(hoveredBeginnerFlowLine, block.startLine)
          || isSameFlowLineTarget(activeBeginnerFlowLine, block.startLine);
        if (!isVisible) return null;
        const indentColumns = line.match(/^\s*/u)?.[0].length || 0;
        return (
          <button
            type="button"
            data-beginner-flow-fold={`${segmentId}:${block.startLine}`}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? `展开第 ${block.startLine} 行流程结构` : `收起第 ${block.startLine} 行流程结构`}
            title={isCollapsed ? '展开流程结构' : '收起流程结构'}
            onMouseDown={event => event.preventDefault()}
            onClick={event => {
              event.stopPropagation();
              toggleBeginnerFlowBlock(block);
            }}
            className={`pointer-events-auto absolute z-30 flex h-4 w-4 items-center justify-center rounded border transition-colors ${
              isDarkMode
                ? 'border-cyan-400/55 bg-[#111720] text-cyan-200 hover:bg-cyan-500/20'
                : 'border-cyan-500/50 bg-white text-cyan-700 hover:bg-cyan-50'
            }`}
            style={{
              left: `calc(0.75rem + ${indentColumns}ch - 1.125rem)`,
              top: 'calc(50% - 0.5rem)'
            }}
          >
            {isCollapsed ? <Plus className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
          </button>
        );
      };
      const commandArgumentDraftKey = (argumentIndex: number) =>
        `${commandExpansionKey(expandedCommandIndex)}:argument:${argumentIndex}`;
      const clearCommandArgumentDraft = (argumentIndex: number) => {
        const draftKey = commandArgumentDraftKey(argumentIndex);
        setBeginnerCommandArgumentDrafts(current => {
          if (!(draftKey in current)) return current;
          const next = { ...current };
          delete next[draftKey];
          return next;
        });
      };
      const commitCommandArgument = (argumentIndex: number, value: string) => {
        if (expandedCommandIndex < 0 || !activeCommandExpansion) return;
        const currentLine = bodyLines[expandedCommandIndex] || '';
        const nextLine = updateBeginnerCommandArgument(
          currentLine,
          beginnerCommandParameterCatalog,
          argumentIndex,
          value
        );
        clearCommandArgumentDraft(argumentIndex);

        const argument = activeCommandExpansion.arguments[argumentIndex];
        const ownerClass = lingCppLanguageContext?.program.classes.find(cls => cls.name === target.className);
        const autoLocal = analyzeBeginnerAutoLocalCommandArgument({
          value,
          parameterName: argument?.name,
          parameterType: argument?.type,
          parameterNote: argument?.note,
          method: target.method,
          ownerClass,
          globals: projectGlobals?.globals
        });
        if (nextLine === currentLine && autoLocal.kind !== 'declare') return;

        const nextBodyLines = [...bodyLines];
        nextBodyLines[expandedCommandIndex] = nextLine;
        const nextSegmentBody = nextBodyLines.join('\n');
        if (nextLine !== currentLine) {
          if (segmentContext) updateBeginnerCodeSegmentDraft(target, segmentContext, nextSegmentBody);
          else updateBeginnerCodeDraft(target, nextSegmentBody);
        }

        if (autoLocal.kind === 'declare') {
          const flushed = applyPendingBeginnerCodeDrafts(
            latestSourceCodeRef.current,
            beginnerCodeDraftsRef.current,
            beginnerLocalStatementAnchorsRef.current
          );
          if (!flushed.success) {
            setStructureEditError(flushed.diagnostics[0] || `自动声明局部变量 ${autoLocal.name} 前提交参数失败。`);
            return;
          }

          const parsed = parseLingCpp(flushed.sourceCode);
          const parsedClass = parsed.program.classes.find(cls => cls.name === target.className);
          const parsedMethod = parsedClass?.methods.find(method =>
            method.name === target.method.name && method.kind === target.method.kind
          );
          if (!parsedClass || !parsedMethod) {
            setStructureEditError(`无法定位子程序 ${target.method.name}，局部变量 ${autoLocal.name} 未自动声明。`);
            return;
          }

          const latestAnalysis = analyzeBeginnerAutoLocalCommandArgument({
            value,
            parameterName: argument?.name,
            parameterType: argument?.type,
            parameterNote: argument?.note,
            method: parsedMethod,
            ownerClass: parsedClass,
            globals: projectGlobals?.globals
          });
          if (latestAnalysis.kind === 'declare') {
            const meaningfulLinesBefore = nextBodyLines
              .slice(0, expandedCommandIndex)
              .filter(line => line.trim()).length;
            const statementIndex = (segmentContext?.segment.statementStartIndex ?? 0) + meaningfulLinesBefore;
            const statementAtArgument = parsedMethod.statements[Math.min(
              statementIndex,
              Math.max(0, parsedMethod.statements.length - 1)
            )];
            const inserted = applyLingCppAstEdit(flushed.sourceCode, {
              kind: 'add-local',
              className: target.className,
              methodName: target.method.name,
              insertBeforeLine: statementAtArgument?.line ?? parsedMethod.endLine ?? parsedMethod.line + 1,
              local: {
                name: latestAnalysis.name,
                type: latestAnalysis.inferredType
              }
            });
            if (!inserted.success) {
              setStructureEditError(inserted.error || inserted.diagnostics[0]?.message || `局部变量 ${latestAnalysis.name} 自动声明失败。`);
              return;
            }

            beginnerCodeDraftsRef.current = {};
            beginnerCodeSegmentLineCountsRef.current = {};
            beginnerLocalStatementAnchorsRef.current = {};
            setBeginnerCodeDrafts({});
            setCollapsedBeginnerProcessTargetKeys(current => current.filter(key => key !== targetKey));
            setStructureEditError(null);
            updateSourceCode(inserted.sourceCode);
            return;
          }
        }

        const currentBody = methodBodyText(target.method);
        const pendingBody = beginnerCodeDraftsRef.current[targetKey] ?? currentBody;
        const applied = commitBeginnerCodeBody(
          target.className,
          target.method.name,
          currentBody,
          pendingBody,
          beginnerLocalStatementAnchorsRef.current[targetKey]
        );
        if (applied) clearBeginnerCodeDraft(target);
      };
      const flowMarkForLine = (_line: string, index: number) => flowGuideRows[index];

      if (collapsedFlowBlocks.length > 0 || (externalFlowFolds?.length ?? 0) > 0) {
        const isLineHidden = (line: number, index: number) =>
          collapsedFlowBlocks.some(block =>
            line > block.startLine && line <= block.endLine
          ) || Boolean(externalFlowFolds?.some(fold => {
            const sourceLine = displaySourceLine(index);
            return sourceLine > fold.sourceFrom && sourceLine <= fold.sourceTo;
          }));
        const visibleLines = bodyLines
          .map((line, index) => ({ line, index, lineNumber: index + 1 }))
          .filter(item => !isLineHidden(item.lineNumber, item.index));
        if (visibleLines.length === 0) return null;

        return (
          <section
            key={`${target.className}:${target.method.name}:code:${segmentId}:flow-collapsed`}
            data-structured-line={segmentStatements[0]?.line || target.method.line}
            className={`relative grid grid-cols-[var(--beginner-gutter-width)_var(--beginner-flow-width)_minmax(0,1fr)] ${editorCanvasBg}`}
            data-beginner-editor-root
            onContextMenu={event => openBeginnerContextMenu(event, target)}
            onMouseLeave={clearHoveredBeginnerFlowLine}
            onWheel={handleEditorFontWheel}
          >
            <div className={`select-none overflow-hidden border-r px-2 py-2 text-right font-mono text-[11px] tabular-nums ${canvasBorder} ${gutterBg}`}>
              {visibleLines.map(({ index, lineNumber }) => (
                <div
                  key={`${targetKey}:flow-fold-line:${index}`}
                  style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                >
                  {displaySourceLine(index)}
                </div>
              ))}
            </div>
            <div className={`select-none overflow-hidden px-1 py-2 text-center text-[11px] tabular-nums ${
              isDarkMode ? 'bg-[#101116] text-cyan-500/70' : 'bg-slate-50 text-cyan-600/80'
            }`}>
              {visibleLines.map(({ index, line, lineNumber }) => {
                const flow = flowGuideRows[index];
                const outerMark = flow.tracks.find(track => track.depth === 0)?.mark || '';
                return (
                  <div
                    key={`${targetKey}:flow-fold-guide:${index}`}
                    className={flow.kind ? 'font-semibold' : ''}
                    title={flow.kind ? line.trim() : undefined}
                    style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                  >
                    {outerMark}
                  </div>
                );
              })}
            </div>
            <div className={`min-w-0 py-2 font-mono ${editorCanvasBg}`} style={{ fontSize: `${editorFontSize}px`, lineHeight: `${lineHeight}px` }}>
              {visibleLines.map(({ line, index, lineNumber }) => {
                const block = flowBlockAtStartLine(lineNumber);
                const isCollapsed = Boolean(block && collapsedBeginnerFlowBlockKeys.includes(flowBlockKey(block)));
                return (
                  <div
                    key={`${targetKey}:flow-fold-code:${index}`}
                    className="relative min-w-0 whitespace-pre px-3"
                    onMouseEnter={() => setHoveredBeginnerFlowLine({ targetKey, segmentId, line: lineNumber })}
                    style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                  >
                    {renderBeginnerNestedFlowTracks(flowGuideRows[index], `${targetKey}:flow-fold:${index}`, lineHeight)}
                    {block && renderBeginnerFlowFoldButton(block, line, isCollapsed)}
                    <span className="relative z-10">{renderBeginnerCodeLine(line, target, textBlockLines.has(index + 1))}</span>
                    {isCollapsed && block && (
                      <span className={`relative z-10 ml-3 text-[10px] ${
                        isDarkMode ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {`... 已收起 ${anchorFoldFor(block)?.hiddenRows ?? Math.max(0, block.endLine - block.startLine)} 行`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      }

      if (activeCommandExpansion && expandedBeginnerCommand) {
        return (
          <section
            key={`${target.className}:${target.method.name}:code:${segmentId}:expanded`}
            data-structured-line={segmentStatements[0]?.line || target.method.line}
            data-beginner-editor-root
            className={editorCanvasBg}
            onContextMenu={event => openBeginnerContextMenu(event, target)}
            onWheel={handleEditorFontWheel}
          >
            {bodyLines.map((line, index) => {
              const displayLine = displaySourceLine(index);
              const expansion = commandExpansions[index];
              const expansionOpen = expandedBeginnerCommand === commandExpansionKey(index);
              const flow = flowMarkForLine(line, index);
              const outerMark = flow.tracks.find(track => track.depth === 0)?.mark || '';
              return (
                <React.Fragment key={`${displayLine}:${index}`}>
                  <div
                    className="grid grid-cols-[var(--beginner-gutter-width)_var(--beginner-flow-width)_minmax(0,1fr)]"
                    style={{ minHeight: `${lineHeight}px`, fontSize: `${editorFontSize}px`, lineHeight: `${lineHeight}px` }}
                  >
                    <div className={`relative flex items-center justify-end border-r px-2 text-[11px] tabular-nums ${canvasBorder} ${gutterBg}`}>
                      {expansion && (
                        <button
                          type="button"
                          data-beginner-command-expand={displayLine}
                          aria-expanded={expansionOpen}
                          aria-label={expansionOpen
                            ? `收起第 ${displayLine} 行 ${expansion.commandName} 的参数`
                            : `展开第 ${displayLine} 行 ${expansion.commandName} 的参数`}
                          title={expansionOpen ? '收起命令参数' : `展开 ${expansion.commandName} 的参数`}
                          onMouseDown={event => event.preventDefault()}
                          onClick={event => toggleCommandExpansion(event, index)}
                          className={`absolute left-2 flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                            expansionOpen
                              ? isDarkMode
                                ? 'border-cyan-400/55 bg-cyan-500/15 text-cyan-200'
                                : 'border-cyan-500/50 bg-cyan-50 text-cyan-700'
                              : isDarkMode
                                ? 'border-slate-600 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-200'
                                : 'border-slate-300 text-slate-500 hover:border-cyan-400 hover:text-cyan-700'
                          }`}
                        >
                          {expansionOpen ? <Minus className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
                        </button>
                      )}
                      <span>{displayLine}</span>
                    </div>
                    <div className={`select-none px-1 text-center text-[11px] ${
                      isDarkMode ? 'bg-[#101116] text-cyan-500/70' : 'bg-slate-50 text-cyan-600/80'
                    }`} title={flow.kind ? line.trim() : undefined}>
                      {outerMark}
                    </div>
                    <div
                      className={`relative min-w-0 overflow-x-auto whitespace-pre px-3 font-mono ${editorCanvasBg}`}
                      title="收起参数后可继续按普通代码方式编辑整行"
                    >
                      {renderBeginnerNestedFlowTracks(flow, `${targetKey}:expanded:${index}`, lineHeight, 12)}
                      <span className="relative z-10">{renderBeginnerCodeLine(line, target, textBlockLines.has(index + 1))}</span>
                    </div>
                  </div>
                  {expansionOpen && expansion && (
                    <div
                      data-beginner-command-expansion={expansion.commandName}
                      className={`border-y ${canvasBorder} ${isDarkMode ? 'bg-[#0d1117]' : 'bg-cyan-50/30'}`}
                    >
                      {expansion.arguments.map((argument, argumentIndex) => {
                        const isLast = argumentIndex === expansion.arguments.length - 1;
                        const draftKey = commandArgumentDraftKey(argumentIndex);
                        return (
                          <div
                            key={`${argument.name}:${argumentIndex}`}
                            className="grid grid-cols-[var(--beginner-gutter-width)_var(--beginner-flow-width)_minmax(0,1fr)]"
                            style={{ minHeight: `${Math.max(30, lineHeight + 6)}px` }}
                          >
                            <div className={`flex items-center justify-end border-r px-2 font-mono text-[10px] tabular-nums ${canvasBorder} ${gutterBg} ${
                              isDarkMode ? 'text-amber-500/70' : 'text-amber-700/70'
                            }`}>
                              {displayLine}.{argumentIndex + 1}
                            </div>
                            <div className={`flex items-center justify-center font-mono text-[12px] ${
                              isDarkMode ? 'text-cyan-500/65' : 'text-cyan-700/65'
                            }`} aria-hidden="true">
                              {isLast ? '└' : '├'}
                            </div>
                            <div className={`flex min-w-0 items-center gap-2 border-b px-3 py-1 last:border-b-0 ${
                              isDarkMode ? 'border-[#242a33]' : 'border-cyan-100'
                            }`}>
                              <label className="flex min-w-0 flex-1 items-center gap-2">
                                <span className={`shrink-0 font-mono text-[12px] font-semibold ${
                                  isDarkMode ? 'text-cyan-300' : 'text-cyan-800'
                                }`}>
                                  ※{argument.name}：
                                </span>
                                 <input
                                   data-beginner-command-argument={argumentIndex}
                                   value={beginnerCommandArgumentDrafts[draftKey]
                                     ?? (argument.provided ? argument.value : '')}
                                   spellCheck={false}
                                   autoComplete="off"
                                   placeholder="未填写（使用默认值）"
                                   aria-label={`编辑参数 ${argument.name}`}
                                   title={`编辑 ${argument.name}，按回车或移开焦点写回源码`}
                                   onPointerDown={event => event.stopPropagation()}
                                   onMouseDown={event => event.stopPropagation()}
                                   onClick={event => event.stopPropagation()}
                                   onInput={event => {
                                     const value = event.currentTarget.value;
                                     setBeginnerCommandArgumentDrafts(current => ({ ...current, [draftKey]: value }));
                                   }}
                                   onBlur={event => commitCommandArgument(argumentIndex, event.currentTarget.value)}
                                   onKeyDown={event => {
                                     event.stopPropagation();
                                     if (event.key === 'Enter') {
                                       event.preventDefault();
                                       event.currentTarget.blur();
                                    }
                                    if (event.key === 'Escape') {
                                      event.preventDefault();
                                      event.currentTarget.value = argument.provided ? argument.value : '';
                                      clearCommandArgumentDraft(argumentIndex);
                                       event.currentTarget.blur();
                                     }
                                   }}
                                   className={`pointer-events-auto h-7 min-w-[180px] max-w-[680px] flex-1 cursor-text select-text rounded-sm border px-2 font-mono text-[12px] outline-none transition-colors ${
                                     isDarkMode
                                       ? 'border-slate-700 bg-[#111720] text-slate-100 placeholder:text-slate-600 hover:border-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/25'
                                       : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-500/20'
                                   }`}
                                 />
                              </label>
                              <span
                                className={`max-w-[260px] shrink truncate text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}
                                title={[argument.type, argument.note].filter(Boolean).join(' · ') || '未提供定义'}
                              >
                                {argument.type || '参数'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </section>
        );
      }

      return (
        <section
          key={`${target.className}:${target.method.name}:code:${segmentContext?.segment.id || 'all'}`}
          data-structured-line={segmentStatements[0]?.line || target.method.line}
          className={`relative grid grid-cols-[var(--beginner-gutter-width)_var(--beginner-flow-width)_minmax(0,1fr)] ${editorCanvasBg}`}
          data-beginner-editor-root
          onContextMenu={event => openBeginnerContextMenu(event, target)}
          onMouseLeave={clearHoveredBeginnerFlowLine}
          onWheel={handleEditorFontWheel}
        >
          <div data-beginner-line-numbers className={`select-none overflow-hidden border-r px-2 py-2 text-right text-[11px] tabular-nums ${canvasBorder} ${gutterBg}`} style={editorTextStyle}>
            {bodyLines.map((_, index) => {
              const displayLine = displaySourceLine(index);
              const localLine = index + 1;
              const isJumpTarget = beginnerJumpHighlight?.targetKey === targetKey && beginnerJumpHighlight.line === localLine;
              const expansion = commandExpansions[index];
              const expansionOpen = Boolean(expansion && expandedBeginnerCommand === commandExpansionKey(index));
              return (
                <div
                  key={displayLine}
                  className={`relative flex items-center justify-end rounded px-1 transition-colors duration-150 ${
                    isJumpTarget
                      ? isDarkMode ? 'bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/40' : 'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-300'
                      : ''
                  }`}
                  title={isJumpTarget ? `已跳转到：${beginnerJumpHighlight.label}` : undefined}
                >
                  {expansion && (
                    <button
                      type="button"
                      data-beginner-command-expand={displayLine}
                      aria-expanded={expansionOpen}
                      aria-label={expansionOpen
                        ? `收起第 ${displayLine} 行 ${expansion.commandName} 的参数`
                        : `展开第 ${displayLine} 行 ${expansion.commandName} 的参数`}
                      title={expansionOpen ? '收起命令参数' : `展开 ${expansion.commandName} 的 ${expansion.arguments.length} 个参数`}
                      onMouseDown={event => event.preventDefault()}
                      onClick={event => toggleCommandExpansion(event, index)}
                      className={`absolute left-0 flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                        expansionOpen
                          ? isDarkMode
                            ? 'border-cyan-400/55 bg-cyan-500/15 text-cyan-200'
                            : 'border-cyan-500/50 bg-cyan-50 text-cyan-700'
                          : isDarkMode
                            ? 'border-slate-600 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-200'
                            : 'border-slate-300 text-slate-500 hover:border-cyan-400 hover:text-cyan-700'
                      }`}
                    >
                      {expansionOpen ? <Minus className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
                    </button>
                  )}
                  <span>{displayLine}</span>
                </div>
              );
            })}
          </div>
          <div data-beginner-flow-guide className={`select-none overflow-hidden px-1 py-2 text-center text-[11px] tabular-nums ${
            isDarkMode ? 'bg-[#101116] text-cyan-500/70' : 'bg-slate-50 text-cyan-600/80'
          }`} style={editorTextStyle}>
            {bodyLines.map((line, index) => {
              const flow = flowGuideRows[index];
              const outerMark = flow.tracks.find(track => track.depth === 0)?.mark || '';
              return (
                <div
                  key={`${index}:${outerMark}`}
                  className={`${flow.kind ? 'font-semibold' : ''} ${
                    flow.inBlock && !flow.kind ? isDarkMode ? 'text-cyan-500/35' : 'text-cyan-600/45' : ''
                  }`}
                  title={flow.kind ? line.trim() : undefined}
                  style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                >
                  {outerMark}
                </div>
              );
            })}
          </div>
          <div className={`relative min-w-0 ${editorCanvasBg}`} style={editorTextStyle}>
            <div
              aria-hidden="true"
              data-beginner-code-highlight
              className="pointer-events-none absolute inset-0 overflow-hidden px-3 py-2 font-mono font-normal not-italic tracking-normal"
              style={{ fontSize: `${editorFontSize}px`, lineHeight: `${lineHeight}px`, tabSize: 4 }}
            >
              {bodyLines.map((line, index) => (
                <div
                  key={`${targetKey}:highlight:${index}`}
                  className="relative whitespace-pre"
                  style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                >
                  {renderBeginnerNestedFlowTracks(flowGuideRows[index], `${targetKey}:highlight:${index}`, lineHeight)}
                  <span className="relative z-10">{renderBeginnerCodeLine(line, target, textBlockLines.has(index + 1))}</span>
                </div>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-0 z-20 py-2">
              {bodyLines.map((line, index) => {
                const block = flowBlockAtStartLine(index + 1);
                return (
                  <div
                    key={`${targetKey}:flow-fold-control:${index}`}
                    className="relative px-3"
                    style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                  >
                    {block && renderBeginnerFlowFoldButton(block, line, false)}
                  </div>
                );
              })}
            </div>
            <textarea
              key={`${target.className}:${target.method.name}:${target.method.line}:${segmentContext?.segment.id || 'all'}:${bodyText}:${beginnerDraftExternalRevisionRef.current[targetKey] ?? 0}:yc-source`}
              data-text-model-view-key={`${target.className}:${target.method.kind}:${target.method.name}:${segmentContext?.segment.id || 'all'}`}
              data-beginner-target-key={targetKey}
              data-beginner-statement-start={segmentContext?.segment.statementStartIndex ?? 0}
              data-lingbuilder-editor-command-owner="true"
              data-source-line-start={segmentStatements[0]?.line || segmentContext?.segment.sourceLine || target.method.line + 1}
              data-source-line-map={getBeginnerBodySourceLines(segmentStatements).join(',')}
              data-source-column-start={methodBodyStartColumn(target.method)}
              data-source-column-map={getBeginnerBodySourceColumns(segmentStatements, methodBodyStartColumn(target.method)).join(',')}
              defaultValue={draftBodyText}
              wrap="off"
              spellCheck={false}
              readOnly={!onUpdateSourceContent}
              placeholder="输入中文代码；@ 后面写原生 C++"
              onChange={event => {
                handleBeginnerCodeChange(target, event, segmentContext);
                captureBeginnerTextareaView(event.currentTarget);
                updateActiveBeginnerFlowLine(event.currentTarget);
              }}
              onBlur={event => {
                setActiveBeginnerFlowLine(current =>
                  current?.targetKey === targetKey && current.segmentId === segmentId ? null : current
                );
                handleBeginnerCodeBlur(target, bodyText, event);
              }}
              onFocus={event => {
                scheduleBeginnerPointerSync(target, event.currentTarget);
                updateActiveBeginnerFlowLine(event.currentTarget);
              }}
              onClick={event => {
                updateActiveBeginnerFlowLine(event.currentTarget);
                handleBeginnerCodeClick(target, event);
              }}
              onDoubleClick={event => handleBeginnerCodeDoubleClick(target, event)}
              onContextMenu={event => openBeginnerContextMenu(event, target, event.currentTarget)}
              onKeyDown={event => handleBeginnerCodeKeyDown(target, event, segmentContext)}
              onKeyUp={event => {
                updateBeginnerCommandHint(target, event.currentTarget);
                captureBeginnerTextareaView(event.currentTarget);
                updateActiveBeginnerFlowLine(event.currentTarget);
              }}
              onSelect={event => {
                scheduleBeginnerPointerSync(target, event.currentTarget);
                updateActiveBeginnerFlowLine(event.currentTarget);
              }}
              onMouseMove={event => updateHoveredBeginnerFlowLine(event.currentTarget, event.clientY)}
              onScroll={event => {
                const root = event.currentTarget.closest('[data-beginner-editor-root]');
                const lineNumberColumn = root?.querySelector('[data-beginner-line-numbers]');
                const flowGuideColumn = root?.querySelector('[data-beginner-flow-guide]');
                const codeHighlight = root?.querySelector('[data-beginner-code-highlight]');
                // This editor grows to fit every source row, so it must never retain an
                // internal vertical offset. A hidden textarea scroll previously shifted
                // the flow guide upward and drew 如果/否则 brackets beside earlier lines.
                if (event.currentTarget.scrollTop !== 0) event.currentTarget.scrollTop = 0;
                if (lineNumberColumn instanceof HTMLElement) lineNumberColumn.scrollTop = 0;
                if (flowGuideColumn instanceof HTMLElement) flowGuideColumn.scrollTop = 0;
                if (codeHighlight instanceof HTMLElement) codeHighlight.scrollLeft = event.currentTarget.scrollLeft;
                captureBeginnerTextareaView(event.currentTarget);
              }}
              onWheel={handleEditorFontWheel}
              title="Ctrl+单击局部控件变量、项目子程序调用或 &处理器名可转到定义"
              style={editorTextStyle}
              className={`relative z-10 w-full resize-none overflow-x-auto overflow-y-hidden whitespace-pre border-0 bg-transparent px-3 py-2 font-mono font-normal not-italic tracking-normal text-transparent outline-none selection:bg-cyan-500/30 [&::-webkit-scrollbar]:h-2 ${
                isDarkMode ? 'caret-cyan-200 placeholder:text-slate-600' : 'caret-cyan-700 placeholder:text-slate-400'
              }`}
            />
          </div>
        </section>
      );
    };

    // 结构化画布改为「描述 + 惰性渲染」：只有进入视口窗口的块才真正创建 React 元素与 DOM。
    // 之前这里会把 260 个块全部 eager 建好，是打开 3.8s、交互 1.3s/次的主要来源。
    //
    // blockRevision：块内容真正依赖的状态指纹。App/DiffViewer 因为无关状态（命令提示、
    // 面板显隐、后台刷新等）重渲时指纹不变，BeginnerVirtualCanvas 内的记忆化外壳就会跳过
    // 整棵子树，避免每次按键/悬浮都重建几十毫秒的结构画布。
    const blockRevision = [
      isDarkMode ? 'd' : 'l',
      editorFontSize,
      beginnerTableFontSize,
      beginnerTableScale,
      normalizedSourceCode,
      activeFile?.path || '',
      textHistoryVersion,
      JSON.stringify(beginnerColumnWidthOverrides),
      selectedBeginnerHandler || '',
      activeBeginnerHandler || '',
      selectedBeginnerCodeTarget ? `${selectedBeginnerCodeTarget.className || ''}.${selectedBeginnerCodeTarget.methodName}` : '',
      beginnerJumpHighlight ? `${beginnerJumpHighlight.targetKey}:${beginnerJumpHighlight.line}:${beginnerJumpHighlight.label}` : '',
      beginnerParameterFocus ? `${beginnerParameterFocus.targetKey}:${beginnerParameterFocus.parameterName}` : '',
      structureEditDraft ? JSON.stringify(structureEditDraft) : '',
      isBeginnerMemberTableCollapsed ? '1' : '0',
      collapsedBeginnerProcessTargetKeys.join(','),
      collapsedBeginnerLocalGroupKeys.join(','),
      collapsedBeginnerFlowBlockKeys.join(','),
      expandedBeginnerCommand || '',
      expandedBeginnerEventTargetKey || '',
      expandedBeginnerFunctionTargetKey || '',
      // 补全面板/自动局部类型面板已提升到画布 overlay（不在任何块内），
      // 其状态不再进入 blockRevision：否则补全打开期间每个键都会全量重渲可见块。
      beginnerTypeCompletionState ? `${beginnerTypeCompletionState.inputKey}:${beginnerTypeCompletionState.value}` : '',
      Object.keys(beginnerCommandArgumentDrafts).join(','),
      beginnerContextMenu ? `${beginnerContextMenu.className}:${beginnerContextMenu.methodName}` : '',
      Object.entries(beginnerCodeDrafts).map(([key, value]) => `${key}#${value.length}`).join(',')
    ].join('\u0001');
    const canvasItems: BeginnerCanvasItem[] = [];
    /**
     * 悬浮/当前行只会影响「所属块」的折叠按钮显隐，因此只把这份状态挂到对应 targetKey 的块上：
     * 鼠标划过时只有那一两个块重渲，而不是视口内所有块（实测从 60~90ms 降到 10ms 级）。
     * 补全/自动局部面板虽然已提升到画布层，但正在输入的块需要跟着刷新：
     * 块内的语法高亮覆盖层（textarea 文本透明，可见文字全靠覆盖层）与 textarea 事件闭包
     * 都在块内；无此切片时补全打开期间覆盖层会滞后一拍、闭包读到旧草稿。
     * 草稿长度切片（|d:）覆盖「无补全」的逐键输入：字符串内打空格这类行内改动
     * 不改结构指纹，400ms 延迟同步不会触发；没有它，空格会「看得见地没反应」，
     * 直到下一次结构变化才把积压内容一次性补显。
     */
    const interactionSliceFor = (targetKey?: string) => {
      if (!targetKey) return '';
      const hovered = hoveredBeginnerFlowLine?.targetKey === targetKey
        ? `${hoveredBeginnerFlowLine.segmentId}:${hoveredBeginnerFlowLine.line}`
        : '';
      const active = activeBeginnerFlowLine?.targetKey === targetKey
        ? `${activeBeginnerFlowLine.segmentId}:${activeBeginnerFlowLine.line}`
        : '';
      const completion = beginnerCompletionState?.targetKey === targetKey
        ? `${beginnerCompletionState.segmentId}:${beginnerCompletionState.token}:${beginnerCompletionState.selectedIndex}:${beginnerCompletionState.items.length}`
        : '';
      const autoLocal = beginnerAutoLocalTypeState?.targetKey === targetKey
        ? `${beginnerAutoLocalTypeState.variableName}:${beginnerAutoLocalTypeState.selectedIndex}`
        : '';
      const draft = beginnerCodeDraftsRef.current[targetKey];
      const draftLength = draft !== undefined ? String(draft.length) : '';
      return `|h:${hovered}|a:${active}|c:${completion}|l:${autoLocal}|d:${draftLength}`;
    };
    const pushCanvasItem = (
      key: string,
      estimateSize: number,
      sourceFrom: number,
      sourceTo: number,
      render: () => React.ReactNode,
      interactionTargetKey?: string
    ) => {
      canvasItems.push({
        key,
        revision: `${blockRevision}${interactionSliceFor(interactionTargetKey)}`,
        estimateSize,
        sourceFrom,
        sourceTo,
        render
      });
    };
    const sourceRangeOfRows = (rows: LingCppStructuredReadingRow[], fallback = 1) => {
      const lines = rows.map(row => row.line).filter(line => Number.isFinite(line) && line > 0);
      return lines.length
        ? { from: Math.min(...lines), to: Math.max(...lines) }
        : { from: fallback, to: fallback };
    };
    const estimateCodeBodySize = (body: string) => 34 + Math.max(1, body.split('\n').length) * 26;

    const hasDeclarationCanvas = Boolean(classDeclarationRow || packageDeclarationRow);
    const hasMemberCanvas = memberRows.length > 0 || Boolean(primaryLingCppClass);
    const memberVisualLineStart = 2;
    const memberVisualLineCount = hasMemberCanvas
      ? (isBeginnerMemberTableCollapsed ? 1 : Math.max(1, memberRows.length))
      : 0;
    let nextVisualLine = memberVisualLineStart + memberVisualLineCount;

    if (hasDeclarationCanvas) {
      const declarationRow = classDeclarationRow || packageDeclarationRow;
      pushCanvasItem(
        'declaration',
        96,
        declarationRow?.line || 1,
        declarationRow?.line || 1,
        () => renderDeclarationCanvas()
      );
    }
    if (hasMemberCanvas) {
      const memberRange = sourceRangeOfRows(memberRows, primaryLingCppClass?.line || 1);
      pushCanvasItem(
        'member',
        isBeginnerMemberTableCollapsed ? 56 : 56 + Math.max(1, memberRows.length) * 34,
        memberRange.from,
        memberRange.to,
        () => renderMemberCanvas(memberVisualLineStart)
      );
    }

    if (hasMemberCanvas && allProcessTargets.length > 0) {
      const blankLine = nextVisualLine;
      pushCanvasItem(`blank:${blankLine}`, 26, blankLine, blankLine, () => renderBlankSourceLine(blankLine));
      nextVisualLine += 1;
    }

    allProcessTargets.forEach((target, index) => {
      const targetKey = codeTargetKey(target);
      const targetLastLine = target.method.endLine || target.method.line;
      const processHeaderLine = nextVisualLine;
      pushCanvasItem(
        `process:${targetKey}:${processHeaderLine}`,
        46,
        target.method.line,
        targetLastLine,
        () => renderProcessHeader(target, processHeaderLine)
      );
      nextVisualLine += 1;

      if (!isBeginnerProcessCollapsed(target)) {
        const parameterLine = nextVisualLine;
        const parameterCount = target.method.parameters.length;
        pushCanvasItem(
          `parameters:${targetKey}:${parameterLine}`,
          parameterCount * 34 + 76,
          target.method.line,
          target.method.line,
          () => renderParameterCanvas(target, parameterLine)
        );
        nextVisualLine += Math.max(1, target.method.parameters.length + 1);

        const bodySegments = getBeginnerMethodBodySegments(target.method);
        let foldStatementCursor = 0;
        const foldSegmentSources = bodySegments.flatMap(segment => {
          if (segment.kind !== 'code') return [];
          const source = {
            segmentId: segment.id,
            lines: (getCodeSegmentDraft(target, { segment, segments: bodySegments }).value || '').split('\n'),
            statementStart: foldStatementCursor
          };
          foldStatementCursor += segment.statements.length;
          return [source];
        });
        const crossSegmentFolds = collapsedBeginnerFlowBlockKeys.length > 0
          ? getBeginnerCrossSegmentFlowFolds(
              foldSegmentSources,
              target.method.statements,
              target.method.locals || [],
              collapsedBeginnerFlowBlockKeys,
              codeTargetKey(target)
            )
          : [];
        const isStatementRangeHidden = (index: number) => crossSegmentFolds.some(fold =>
          index >= fold.statementFrom && index <= fold.statementTo
        );
        const isSourceRangeHidden = (line: number | undefined) =>
          line !== undefined && crossSegmentFolds.some(fold =>
            line > fold.sourceFrom && line <= fold.sourceTo
          );
        let codeStatementCursor = 0;

        bodySegments.forEach(segment => {
          if (segment.kind === 'locals') {
            // 位于某个跨段折叠范围内（结构首行与结束行之间）的局部声明表随折叠收起。
            if (isSourceRangeHidden(segment.locals[0]?.line ?? segment.sourceLine)) return;
            const groupKey = `${segment.id}:${segment.locals.map(local => local.name).join('|')}`;
            const collapsed = collapsedBeginnerLocalGroupKeys.includes(`${codeTargetKey(target)}:${groupKey}`);
            const localCanvasLine = nextVisualLine;
            if (segment.locals.length > 0) {
              const localStartLine = segment.locals[0]?.line ?? segment.sourceLine;
              const localEndLine = segment.locals[segment.locals.length - 1]?.line ?? localStartLine;
              pushCanvasItem(
                `locals:${codeTargetKey(target)}:${groupKey}:${localCanvasLine}`,
                collapsed ? 40 : 46 + segment.locals.length * 34,
                localStartLine,
                localEndLine,
                () => renderLocalVariableCanvas(target, localCanvasLine, segment.locals, groupKey),
                codeTargetKey(target)
              );
            }
            nextVisualLine += collapsed
              ? 1
              : Math.max(1, segment.locals.length);
            return;
          }

          const segmentStatementStart = codeStatementCursor;
          codeStatementCursor += segment.statements.length;
          const segmentContext = { segment, segments: bodySegments };
          const segmentBody = getCodeSegmentDraft(target, segmentContext).value;
          const segmentSourceLines = segment.statements
            .map(statement => statement.line)
            .filter(line => Number.isFinite(line) && line > 0);
          const segmentSourceFrom = segmentSourceLines[0] ?? target.method.line;
          const segmentSourceTo = segmentSourceLines[segmentSourceLines.length - 1] ?? segmentSourceFrom;

          if (crossSegmentFolds.length > 0 && segment.statements.length > 0) {
            const statementIndices = segment.statements.map((_, offset) => segmentStatementStart + offset);
            if (statementIndices.every(isStatementRangeHidden)) return;
            const hiddenCount = statementIndices.filter(isStatementRangeHidden).length;
            // 锚点段即使自身没有隐藏行，也要拿到折叠信息用于显示真实收起行数。
            const anchorsHere = crossSegmentFolds.some(fold => fold.anchorSegmentId === segment.id);
            if (hiddenCount > 0 || anchorsHere) {
              const foldedCanvasLine = nextVisualLine;
              pushCanvasItem(
                `code:${codeTargetKey(target)}:${segment.id}:${foldedCanvasLine}`,
                estimateCodeBodySize(segmentBody),
                segmentSourceFrom,
                segmentSourceTo,
                () => renderContinuousCodeBody(target, foldedCanvasLine, {
                  ...segmentContext,
                  externalFlowFolds: crossSegmentFolds
                }),
                codeTargetKey(target)
              );
              nextVisualLine += Math.max(1, segmentBody.split('\n').length - hiddenCount);
              return;
            }
          }

          const codeCanvasLine = nextVisualLine;
          pushCanvasItem(
            `code:${codeTargetKey(target)}:${segment.id}:${codeCanvasLine}`,
            estimateCodeBodySize(segmentBody),
            segmentSourceFrom,
            segmentSourceTo,
            () => renderContinuousCodeBody(target, codeCanvasLine, segmentContext),
            codeTargetKey(target)
          );
          nextVisualLine += Math.max(1, segmentBody.split('\n').length);
        });
      }

      if (index < allProcessTargets.length - 1) {
        const trailingBlankLine = nextVisualLine;
        pushCanvasItem(
          `blank:${trailingBlankLine}`,
          26,
          trailingBlankLine,
          trailingBlankLine,
          () => renderBlankSourceLine(trailingBlankLine)
        );
        nextVisualLine += 1;
      }
    });

    const contextTarget = beginnerContextMenu
      ? codeTargets.find(target =>
          target.className === beginnerContextMenu.className &&
          target.method.name === beginnerContextMenu.methodName
        ) || activeCanvasTarget
      : undefined;
    const contextDefinition = beginnerContextMenu?.definitionName && contextTarget && lingCppLanguageContext
      ? resolveBeginnerProcedureDefinition(
          lingCppLanguageContext.program,
          beginnerContextMenu.className || contextTarget.className,
          beginnerContextMenu.definitionName
        )
      : undefined;
    const contextLibraryDefinition = beginnerContextMenu?.libraryCall && lingCppLanguageContext
      ? resolveBeginnerFunctionLibraryDefinition(
          lingCppLanguageContext.projectFunctions?.libraries || [],
          beginnerContextMenu.libraryCall.libraryName,
          beginnerContextMenu.libraryCall.functionName
        )
      : undefined;
    const contextDefinitionLabel = beginnerContextMenu?.definitionName
      ? `转到定义：${beginnerContextMenu.definitionName}`
      : beginnerContextMenu?.libraryCall
        ? `转到定义：${beginnerContextMenu.libraryCall.libraryName}.${beginnerContextMenu.libraryCall.functionName}`
        : '转到定义';
    const contextControlMenuItem = beginnerContextMenu?.controlReference?.symbol && commandService
      ? getMenuService(commandService).resolveMenu(
          LINGCPP_CONTROL_REFERENCE_CONTEXT_MENU,
          { ...(getCommandContext?.() || {}), 'workspace.open': true, 'lingcpp.controlReference': true },
          { includeDisabled: true }
        ).find(item => item.kind === 'command' && item.command.id === REVEAL_LINGCPP_CONTROL_COMMAND)
      : undefined;
    const canMoveBeginnerSubprogram = (target: BeginnerCodeTarget | undefined, direction: 'up' | 'down'): boolean => {
      if (!target || target.method.kind !== 'method') return false;
      const ordered = codeTargets
        .filter(item => item.className === target.className)
        .sort((left, right) => left.method.line - right.method.line);
      const index = ordered.findIndex(item => item.method.name === target.method.name);
      if (index < 0) return false;
      return direction === 'up' ? index > 0 : index < ordered.length - 1;
    };
    const getBeginnerCommandContext = (target?: BeginnerCodeTarget): CommandContext => ({
      ...(getCommandContext?.() || {}),
      'workspace.open': true,
      'designer.active': false,
      'lingcpp.beginner.active': true,
      'lingcpp.beginner.hasTarget': Boolean(target),
      'lingcpp.beginner.canAddSubprogram': Boolean(primaryMethodOwnerName),
      'lingcpp.beginner.canAddAssemblyVariable': Boolean(primaryLingCppClass),
      'lingcpp.beginner.hasSubprogramTarget': target?.method.kind === 'method',
      'lingcpp.beginner.canMoveSubprogramUp': canMoveBeginnerSubprogram(target, 'up'),
      'lingcpp.beginner.canMoveSubprogramDown': canMoveBeginnerSubprogram(target, 'down'),
      'lingcpp.beginner.canPasteSubprogram': Boolean(beginnerMethodClipboardRef.current) && Boolean(primaryMethodOwnerName),
      'lingcpp.beginner.writable': Boolean(onUpdateSourceContent)
    });
    const beginnerCommandContext = getBeginnerCommandContext(contextTarget);
    const beginnerCreationMenuItems = commandService
      ? getMenuService(commandService).resolveMenu(
          LINGCPP_BEGINNER_CONTEXT_MENU,
          beginnerCommandContext,
          { includeDisabled: true }
        ).filter(item => item.kind === 'command' && (
          item.command.id === ADD_BEGINNER_SUBPROGRAM_COMMAND
          || item.command.id === ADD_BEGINNER_ASSEMBLY_VARIABLE_COMMAND
          || item.command.id === ADD_BEGINNER_LOCAL_VARIABLE_COMMAND
          || item.command.id === ADD_BEGINNER_LOCAL_CONSTANT_COMMAND
        ))
      : [];
    const beginnerSubprogramMenuItems = commandService
      ? getMenuService(commandService).resolveMenu(
          LINGCPP_BEGINNER_CONTEXT_MENU,
          beginnerCommandContext,
          { includeDisabled: true }
        ).filter(item => item.kind === 'command' && (
          item.command.id === MOVE_BEGINNER_SUBPROGRAM_UP_COMMAND
          || item.command.id === MOVE_BEGINNER_SUBPROGRAM_DOWN_COMMAND
          || item.command.id === CUT_BEGINNER_SUBPROGRAM_COMMAND
          || item.command.id === COPY_BEGINNER_SUBPROGRAM_COMMAND
          || item.command.id === PASTE_BEGINNER_SUBPROGRAM_COMMAND
        ))
      : [];
    const executeBeginnerCreationCommand = (commandId: string, target?: BeginnerCodeTarget) => {
      if (!commandService) return;
      activeLingCppBeginnerCommandTargetService.activate(beginnerCommandTargetId);
      const targetArgument = target
        ? { className: target.className, methodName: target.method.name }
        : undefined;
      void commandService.executeCommand(
        commandId,
        getBeginnerCommandContext(target),
        targetArgument
      ).catch(error => setStructureEditError(
        error instanceof Error ? error.message : '新手模式快捷插入失败。'
      ));
    };
    const handleBeginnerCreationShortcut = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!commandService || event.defaultPrevented) return;
      const keybinding = keyboardEventToKeybinding(event.nativeEvent);
      if (!keybinding) return;
      const context = getBeginnerCommandContext(activeCanvasTarget);
      const command = commandService.resolveKeybinding(keybinding, context).find(item => (
        item.id === ADD_BEGINNER_SUBPROGRAM_COMMAND
        || item.id === ADD_BEGINNER_ASSEMBLY_VARIABLE_COMMAND
        || item.id === ADD_BEGINNER_LOCAL_VARIABLE_COMMAND
        || item.id === ADD_BEGINNER_LOCAL_CONSTANT_COMMAND
      ));
      if (!command) return;
      event.preventDefault();
      event.stopPropagation();
      executeBeginnerCreationCommand(command.id, activeCanvasTarget);
    };
    const renderContextMenuButton = (
      label: string,
      onClick: () => void,
      icon: React.ReactNode,
      danger = false,
      disabled = false,
      shortcut?: string
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
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {shortcut && <kbd className="ml-auto shrink-0 font-sans text-[10px] tabular-nums opacity-60">{shortcut}</kbd>}
      </button>
    );
    const renderBeginnerContextMenu = () => {
      if (!beginnerContextMenu) return null;
      const canDeleteTarget = Boolean(contextTarget && contextTarget.method.kind !== 'constructor');
      const menuOnBottomHalf = beginnerContextMenu.y > window.innerHeight / 2;
      const verticalInset = menuOnBottomHalf
        ? Math.max(8, window.innerHeight - beginnerContextMenu.y)
        : Math.max(8, beginnerContextMenu.y);
      const menuWidth = Math.min(220, window.innerWidth - 16);
      return (
        <div
          className={`fixed z-50 overflow-x-hidden overflow-y-auto rounded border py-1 shadow-2xl ${
            isDarkMode ? 'border-[#343746] bg-[#191b22] shadow-black/40' : 'border-slate-200 bg-white shadow-slate-300/60'
          }`}
          style={{
            width: menuWidth,
            left: Math.max(8, Math.min(beginnerContextMenu.x, window.innerWidth - menuWidth - 8)),
            top: menuOnBottomHalf ? undefined : verticalInset,
            bottom: menuOnBottomHalf ? verticalInset : undefined,
            maxHeight: `calc(100vh - ${verticalInset + 8}px)`
          }}
          onClick={event => event.stopPropagation()}
          onContextMenu={event => event.preventDefault()}
        >
          {contextControlMenuItem?.kind === 'command' && beginnerContextMenu.controlReference?.symbol && renderContextMenuButton(
            contextControlMenuItem.command.title,
            () => revealControlReference(beginnerContextMenu.controlReference!),
            <LayoutGrid className="h-3.5 w-3.5" />
          )}
          {contextControlMenuItem?.kind === 'command' && <div className={`my-1 border-t ${canvasBorder}`} />}
          {renderContextMenuButton(
            contextDefinitionLabel,
            () => {
              if (beginnerContextMenu.definitionName && contextTarget) {
                revealBeginnerProcedureDefinition(
                  beginnerContextMenu.className || contextTarget.className,
                  beginnerContextMenu.definitionName
                );
                return;
              }
              if (beginnerContextMenu.libraryCall) {
                revealFunctionLibraryDefinition(
                  beginnerContextMenu.libraryCall.libraryName,
                  beginnerContextMenu.libraryCall.functionName
                );
              }
            },
            <ExternalLink className="h-3.5 w-3.5" />,
            false,
            !contextDefinition && !contextLibraryDefinition
          )}
          <div className={`my-1 border-t ${canvasBorder}`} />
          {beginnerCreationMenuItems.map(item => item.kind === 'command' && (
            <React.Fragment key={item.id}>
              {renderContextMenuButton(
                item.command.id === ADD_BEGINNER_SUBPROGRAM_COMMAND && contextTarget
                  ? '在当前下方新建子程序'
                  : item.command.title,
                () => executeBeginnerCreationCommand(item.command.id, contextTarget),
                <Plus className="h-3.5 w-3.5" />,
                false,
                !item.command.enabled,
                item.command.keybindings[0]
              )}
            </React.Fragment>
          ))}
          <div className={`my-1 border-t ${canvasBorder}`} />
          {beginnerSubprogramMenuItems.map(item => item.kind === 'command' && (
            <React.Fragment key={item.id}>
              {renderContextMenuButton(
                item.command.title,
                () => executeBeginnerCreationCommand(item.command.id, contextTarget),
                item.command.id === MOVE_BEGINNER_SUBPROGRAM_UP_COMMAND ? <ArrowUp className="h-3.5 w-3.5" />
                  : item.command.id === MOVE_BEGINNER_SUBPROGRAM_DOWN_COMMAND ? <ArrowDown className="h-3.5 w-3.5" />
                    : item.command.id === CUT_BEGINNER_SUBPROGRAM_COMMAND ? <Scissors className="h-3.5 w-3.5" />
                      : item.command.id === COPY_BEGINNER_SUBPROGRAM_COMMAND ? <Copy className="h-3.5 w-3.5" />
                        : <ClipboardPaste className="h-3.5 w-3.5" />,
                false,
                !item.command.enabled
              )}
            </React.Fragment>
          ))}
          <div className={`my-1 border-t ${canvasBorder}`} />
          {renderContextMenuButton('展开全部子程序', expandAllBeginnerProcesses, <ChevronDown className="h-3.5 w-3.5" />, false, allProcessTargets.length === 0)}
          {renderContextMenuButton('折叠全部子程序', collapseAllBeginnerProcesses, <ChevronRight className="h-3.5 w-3.5" />, false, allProcessTargets.length === 0)}
          {renderContextMenuButton(
            isBeginnerMemberTableCollapsed ? '展开程序集变量表' : '折叠程序集变量表',
            () => setIsBeginnerMemberTableCollapsed(current => !current),
            isBeginnerMemberTableCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />,
            false,
            !hasMemberCanvas
          )}
          {renderContextMenuButton(
            contextTarget && isBeginnerProcessCollapsed(contextTarget) ? '展开当前子程序' : '折叠当前子程序',
            () => contextTarget && toggleBeginnerProcessCollapsed(contextTarget),
            contextTarget && isBeginnerProcessCollapsed(contextTarget)
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />,
            false,
            !contextTarget
          )}
          <div className={`my-1 border-t ${canvasBorder}`} />
          {renderContextMenuButton('插入调试输出', () => appendBeginnerSnippet(contextTarget, '调试输出("")'), <Code className="h-3.5 w-3.5" />, false, !contextTarget)}
          {renderContextMenuButton('插入信息框', () => appendBeginnerSnippet(contextTarget, '信息框("提示内容", 64, "提示")'), <Lightbulb className="h-3.5 w-3.5" />, false, !contextTarget)}
          {renderContextMenuButton('插入打开窗口', () => appendBeginnerSnippet(contextTarget, '打开窗口("窗口标题")'), <ExternalLink className="h-3.5 w-3.5" />, false, !contextTarget)}
          {renderContextMenuButton('插入如果结构', () => appendBeginnerSnippet(contextTarget, BEGINNER_IF_SNIPPET), <ListTree className="h-3.5 w-3.5" />, false, !contextTarget)}
          {renderContextMenuButton('插入如果真结构', () => appendBeginnerSnippet(contextTarget, BEGINNER_IF_TRUE_SNIPPET), <ListTree className="h-3.5 w-3.5" />, false, !contextTarget)}
          {renderContextMenuButton('插入选择结构', () => appendBeginnerSnippet(contextTarget, BEGINNER_SELECT_SNIPPET), <ListTree className="h-3.5 w-3.5" />, false, !contextTarget)}
          {renderContextMenuButton('插入判断循环', () => appendBeginnerSnippet(contextTarget, BEGINNER_WHILE_SNIPPET), <ListTree className="h-3.5 w-3.5" />, false, !contextTarget)}
          {renderContextMenuButton('插入计次循环', () => appendBeginnerSnippet(contextTarget, BEGINNER_COUNT_LOOP_SNIPPET), <ListTree className="h-3.5 w-3.5" />, false, !contextTarget)}
          {renderContextMenuButton('插入异常处理', () => appendBeginnerSnippet(contextTarget, BEGINNER_TRY_SNIPPET), <ListTree className="h-3.5 w-3.5" />, false, !contextTarget)}
          {beginnerModuleCodeCompletions.filter(item => item.kind !== '类型').slice(0, 4).map(item => (
            <React.Fragment key={`module-context-menu-${item.label}`}>
              {renderContextMenuButton(`插入模块命令：${item.label}`, () => appendBeginnerSnippet(contextTarget, item.insertText), <Code className="h-3.5 w-3.5" />, false, !contextTarget)}
            </React.Fragment>
          ))}
          <div className={`my-1 border-t ${canvasBorder}`} />
          {renderContextMenuButton(
            contextTarget?.method.kind === 'event' ? '删除事件处理器' : '删除当前子程序',
            () => { void deleteBeginnerCodeTarget(contextTarget); },
            <Trash2 className="h-3.5 w-3.5" />,
            true,
            !canDeleteTarget
          )}
        </div>
      );
    };
    return (
      <BeginnerVirtualCanvas
        items={canvasItems}
        scrollRef={beginnerStructureScrollRef}
        handleRef={beginnerCanvasHandleRef}
        className={`h-full min-h-0 overflow-auto ${editorCanvasBg}`}
        onFocusCapture={() => activeLingCppBeginnerCommandTargetService.activate(beginnerCommandTargetId)}
        onPointerDownCapture={() => activeLingCppBeginnerCommandTargetService.activate(beginnerCommandTargetId)}
        onKeyDown={handleBeginnerCreationShortcut}
        onScroll={saveBeginnerViewState}
        onContextMenu={event => openBeginnerContextMenu(event, activeCanvasTarget)}
        overlay={(
          <>
            {renderHoistedBeginnerCompletionPanel()}
            {renderHoistedBeginnerAutoLocalTypePanel()}
          </>
        )}
        footer={canvasItems.length > 0 ? (
          <div aria-hidden="true" className="h-[50vh] min-h-[160px] max-h-[360px]" data-beginner-scroll-tail />
        ) : null}
      >
        <datalist id="beginner-member-name-suggestions">
          {memberNameSuggestions.map(item => <option key={item} value={item} />)}
        </datalist>
        <datalist id="beginner-method-name-suggestions">
          {methodNameSuggestions.map(item => <option key={item} value={item} />)}
        </datalist>
        {renderBeginnerContextMenu()}
        {canvasItems.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-500">暂无结构信息</div>
        )}
      </BeginnerVirtualCanvas>
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
      onSwitchToProfessional={() => { void onExperienceModeChange?.('professional'); }}
    >
      {structuredReadingRows.length > 0 ? renderVolcanoStructuredRows() : (
        <div className="p-4 text-center text-xs text-slate-500">暂无结构信息</div>
      )}
    </LingCppStructureEditor>
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

  const renderActiveLineStructureBar = () => {
    if (activeFile?.language !== 'lingcpp' || !activeStructuredRow) return null;
    const row = activeStructuredRow;
    const titleMap: Record<LingCppStructuredReadingRow['group'], string> = {
      declaration: '源码声明',
      package: '包声明',
      global: '项目全局变量',
      class: '类声明',
      member: '成员声明',
      local: '局部声明',
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
    <div id="diff-window-host" style={{ ...beginnerScaleStyle, '--lingcpp-comment-color': getLingCppCommentTokenColor(isDarkMode) } as React.CSSProperties} className={`flex-1 flex flex-col overflow-hidden ${
      isDarkMode ? 'bg-[#141418]' : 'bg-white'
    }`}>
      {/* File Tabs Bar */}
      {!(modulePageActive && !moduleDetailModuleId) && (
      <div className={`flex px-2 pt-1 select-none items-center justify-between border-b ${
        isDarkMode ? 'bg-[#181820] border-[#2d2d34]' : 'bg-slate-100 border-slate-200'
      }`}>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto scrollbar-none">
          {designerProject && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => { saveBeginnerViewState(); setViewType('designer'); }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  saveBeginnerViewState();
                  setViewType('designer');
                }
              }}
              className={getEditorTabClassName(viewType === 'designer', isDarkMode)}
              title={designerTabTooltip}
              aria-label={designerTabTooltip}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-amber-500" />
              <span className="whitespace-nowrap">{designerTabLabel}</span>
            </div>
          )}

          {moduleDetailModuleId && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setViewType('module')}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') setViewType('module');
              }}
              className={getEditorTabClassName(viewType === 'module', isDarkMode)}
              title={`模块详情：${moduleDetailModuleId}`}
              aria-label={`模块详情页签：${moduleDetailModuleId}`}
              aria-current={viewType === 'module' ? 'page' : undefined}
            >
              <Package className="w-3.5 h-3.5 text-violet-400" />
              <span className="whitespace-nowrap">模块详情</span>
              <button
                onClick={event => {
                  event.stopPropagation();
                  closeModuleDetailTab();
                }}
                onKeyDown={event => event.stopPropagation()}
                aria-label="关闭模块详情页签"
                className="w-3.5 h-3.5 shrink-0 rounded-full hover:bg-slate-400/20 flex items-center justify-center text-slate-500 hover:text-red-500 opacity-60 group-hover:opacity-100"
              >
                <X className="w-2 h-2" />
              </button>
            </div>
          )}

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
                onClick={() => { if (viewType !== 'code') setViewType('code'); onSelectTab(file); }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') { if (viewType !== 'code') setViewType('code'); void onSelectTab(file); }
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
          {onOpenProjectDllCommands && editorExperienceMode === 'beginner' && viewType === 'code' && activeFile?.language === 'lingcpp' && isActiveProjectDllCommandsFile && (
            <button
              type="button"
              onClick={onOpenProjectDllCommands}
              className={`flex items-center gap-1 rounded border px-2.5 py-1 text-[10px] font-medium ${isDarkMode ? 'border-amber-500/30 bg-amber-600/10 text-amber-300 hover:bg-amber-600/20' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
              title="打开项目 DLL 命令声明"
            >
              <span className="font-semibold">DLL</span>
              <span>命令</span>
            </button>
          )}
          {onOpenProjectDataTypes && editorExperienceMode === 'beginner' && viewType === 'code' && activeFile?.language === 'lingcpp' && (
            <button
              type="button"
              onClick={onOpenProjectDataTypes}
              className={`flex items-center gap-1 rounded border px-2.5 py-1 text-[10px] font-medium ${isDarkMode ? 'border-emerald-500/30 bg-emerald-600/10 text-emerald-300 hover:bg-emerald-600/20' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
              title="打开项目自定义数据类型"
            >
              <ListTree className="h-3 w-3" />
              <span>数据类型</span>
            </button>
          )}
          {designerProject && activeFile?.name?.endsWith('.lcpp') && (
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
                onClick={() => { saveBeginnerViewState(); setViewType('designer'); }}
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
      )}
      {/* Main Comparative Frame */}
      {viewType === 'module' && moduleDetailModuleId ? (
        <ModuleDetailPage
          key={`module-detail:${moduleDetailModuleId}`}
          moduleId={moduleDetailModuleId}
          projectId={textModelProjectId}
          isDarkMode={isDarkMode}
          onClose={closeModuleDetailTab}
        />
      ) : modulePageActive && !moduleDetailModuleId ? (
        <ModulePageEmptyState isDarkMode={isDarkMode} />
      ) : viewType === 'designer' && designerProject ? (
        <DesignerErrorBoundary resetKey={`designer:${textModelProjectId}`} isDarkMode={isDarkMode}>
          <WpfDesigner
            key={`designer:${textModelProjectId}`}
            ref={designerHistoryHandleRef}
            projectId={textModelProjectId}
            authoritativeProject={designerProject}
            authoritativeActiveWindowId={activeWindowId}
            isDarkMode={isDarkMode}
            activeFile={activeFile}
            commandService={commandService}
            getCommandContext={getCommandContext}
            toolboxHost={designerToolboxHost}
            onHistoryStateChange={handleDesignerHistoryStateChange}
          />
        </DesignerErrorBoundary>
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
              {isActiveProjectDllCommandsFile ? (
                <ProjectDllCommandsEditor
                  sourceCode={normalizedSourceCode}
                  filePath={activeFile?.path}
                  isDarkMode={isDarkMode}
                  readOnly={!onUpdateSourceContent}
                  commandService={commandService}
                  onChange={updateSourceCode}
                />
              ) : isLingCppBeginnerStructureMode && isProjectDataTypesFilePath(activeFile?.path) ? (
                <ProjectDataTypeEditor
                  sourceCode={normalizedSourceCode}
                  filePath={activeFile?.path}
                  moduleContext={moduleContext}
                  projectClassNames={projectClassNames}
                  isDarkMode={isDarkMode}
                  readOnly={!onUpdateSourceContent}
                  onChange={updateSourceCode}
                  projectSources={lingCppProjectSources}
                  onProjectSourcesChange={onUpdateProjectSources}
                />
              ) : isLingCppBeginnerStructureMode && isProjectGlobalsFilePath(activeFile?.path) ? (
                <ProjectGlobalVariableEditor
                  sourceCode={normalizedSourceCode}
                  filePath={activeFile?.path}
                  moduleContext={moduleContext}
                  projectTypes={projectTypes}
                  isDarkMode={isDarkMode}
                  readOnly={!onUpdateSourceContent}
                  onChange={updateSourceCode}
                  projectSources={lingCppProjectSources}
                  onProjectSourcesChange={onUpdateProjectSources}
                  focusConstantName={pendingProjectConstantFocus}
                />
              ) : isLingCppBeginnerStructureMode ? (
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  {renderLingCppStructureTableEditor()}
                </div>
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
                  projectGlobals={projectGlobals}
                  projectTypes={projectTypes}
                  projectSources={lingCppProjectSources}
                  onProjectSourcesChange={onUpdateProjectSources}
                  onRevealDesignerBinding={() => {
                    if (!designerProject) return;
                    saveBeginnerViewState();
                    setViewType('designer');
                  }}
                  commandService={commandService}
                  getCommandContext={getCommandContext}
                  onRevealControlReference={revealControlReference}
                  onRenameControlReference={renameControlReference}
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
      {beginnerInitialValueEditor && (
        <BeginnerInitialValueEditor
          key={`${beginnerInitialValueEditor.target.className}:${beginnerInitialValueEditor.target.method.name}:${beginnerInitialValueEditor.local.line}:${beginnerInitialValueEditor.local.name}`}
          variableName={beginnerInitialValueEditor.local.name}
          variableType={beginnerInitialValueEditor.local.type}
          value={beginnerInitialValueEditor.local.initialValue || ''}
          isConstant={Boolean(beginnerInitialValueEditor.local.isConstant)}
          isDarkMode={isDarkMode}
          readOnly={!onUpdateSourceContent}
          onClose={() => setBeginnerInitialValueEditor(null)}
          onSave={value => {
            if (beginnerInitialValueEditor.onSave(value)) setBeginnerInitialValueEditor(null);
          }}
        />
      )}
    </div>
  );
});

DiffViewer.displayName = 'DiffViewer';

export default DiffViewer;

