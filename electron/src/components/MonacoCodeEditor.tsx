// 必须保持为第一条导入：在任何 monaco-editor 模块求值之前注入简体中文 NLS 表（右键菜单等内置界面文案）。
import '../services/monacoNls/monacoNlsZhCn';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { requestWorkbenchAlert, requestWorkbenchConfirm } from '../services/workbench/workbenchConfirmService';
import Editor, { loader } from '@monaco-editor/react';
import * as monacoRuntime from 'monaco-editor/esm/vs/editor/editor.api.js';
import MonacoEditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js';
import {
  buildLingCppLanguageContext,
  formatLingCpp,
  getLingCppCompletionItems,
  getLingCppDesignerBindings,
  getLingCppEventBlockHighlights,
  getLingCppFoldingRanges,
  getLingCppHover,
  getLingCppSourceDefinitionAtPosition,
  getLingCppInlineHints,
  getLingCppSemanticDiagnostics,
  getLingCppStructuredReadingRows,
  getLingCppSymbols
} from '../services/lingCpp/languageService';
import { createLingCppMonarchLanguage } from '../services/lingCpp/monacoTokens';
import { LingCppDesignerBindingHint, LingCppDocumentSymbol, LingCppProjectGlobalContext, LingCppProjectSourceFile, LingCppProjectTypeContext, LingCppReadingMode, LingCppStructuredReadingRow } from '../services/lingCpp/types';
import { findProjectGlobalDefinition, renameProjectGlobalAcrossSources } from '../services/lingCpp/projectGlobalService';
import { createProjectFunctionContext } from '../services/lingCpp/functionLibraryService';
import { findProjectDataTypeDefinition, resolveProjectDataFieldAccess } from '../services/lingCpp/projectDataTypeService';
import { applyWorkspaceEditToFiles } from '../services/lingCpp/aiEditService';
import { createProjectConstantRenameProposal, findProjectConstantReferences } from '../services/lingCpp/projectConstantReferenceService';
import { selectCompletionFilterText } from '../services/lingCpp/completionSearchAliases';
import { LingWindowProject } from '../services/windowDesigner/types';
import { InstalledModule, LingCppModuleContext } from '../services/modules/types';
import {
  MonacoTextModelAdapter,
  TextModelGeneration,
  TextModelIdentity,
  TextEditorStatus,
  WorkbenchTextModel,
  mapWorkbenchLanguageToMonaco,
  workbenchTextModelService
} from '../services/textModel';
import {
  createMonacoValueBinding,
  synchronizeMonacoModelValue
} from '../services/textModel/monacoModelSync';
import { applyLspRefactor, lspRangeToMonaco, markupToText, normalizeCompletionItems, normalizeLspLocations, previewLspRefactor, requestLsp } from '../services/lsp/lspClient';
import { MonacoFilePathRegistry } from '../services/lsp/monacoFilePathRegistry';
import type { CommandService } from '../services/commands/commandService';
import type { CommandContext } from '../services/commands/types';
import { getMenuService } from '../services/menus/menuService';
import { LINGCPP_CONTROL_REFERENCE_CONTEXT_MENU } from '../services/menus/types';
import {
  getLingCppControlReferenceAtPosition,
  getLingCppControlReferenceLocations,
  getLingCppControlReferences,
  type LingCppControlReference
} from '../services/lingCpp/controlReferenceService';
import {
  acquireLingCppControlReferenceCommands,
  REVEAL_LINGCPP_CONTROL_COMMAND
} from '../services/lingCpp/controlReferenceCommands';
import {
  buildLingCppControlReferenceSemanticTokenData,
  createLingCppControlReferenceEditorCss,
  LINGCPP_COMMENT_TOKEN_COLORS,
  LINGCPP_CONSTANT_TOKEN_COLORS,
  LINGCPP_CONTROL_REFERENCE_SEMANTIC_TOKEN,
  LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS
} from '../services/lingCpp/semanticTheme';

// Keep the primary editor fully local/offline. Every language used here can
// share Monaco's core editor worker; no CDN or hidden machine state is needed.
(globalThis as typeof globalThis & {
  MonacoEnvironment?: { getWorker: (_moduleId: string, _label: string) => Worker };
}).MonacoEnvironment = {
  getWorker: () => new MonacoEditorWorker()
};
loader.config({ monaco: monacoRuntime });

export type MonacoEditorState = TextEditorStatus;

export interface MonacoContentChange {
  isUndoing: boolean;
  isRedoing: boolean;
  isFlush: boolean;
}

export interface MonacoCodeEditorHandle {
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  replaceValueAuthoritatively: (value: string) => boolean;
  insertSnippet: (text: string, placeholderOffset?: number, placeholderLength?: number) => boolean;
  focus: () => boolean;
  captureViewState: () => boolean;
}

export interface MonacoCodeEditorProps {
  sourceCode: string;
  language: string;
  isDarkMode: boolean;
  readOnly: boolean;
  onChange: (value: string, change?: MonacoContentChange) => void;
  focusHandlerName?: string | null;
  onFocusHandled?: () => void;
  editorFontSize?: number;
  onFontSizeChange?: (size: number | ((curr: number) => number)) => void;
  filePath?: string;
  designerProject?: LingWindowProject;
  onRevealDesignerBinding?: (binding: LingCppDesignerBindingHint) => void;
  onCursorPositionChange?: (position: { line: number; column: number }) => void;
  readingMode?: LingCppReadingMode;
  focusedBlockId?: string;
  onRevealReadableBlock?: (blockId: string) => void;
  moduleContext?: LingCppModuleContext;
  projectGlobals?: LingCppProjectGlobalContext;
  projectTypes?: LingCppProjectTypeContext;
  projectSources?: LingCppProjectSourceFile[];
  onProjectSourcesChange?: (sources: LingCppProjectSourceFile[]) => void;
  modelIdentity?: TextModelIdentity;
  modelSurface?: string;
  onEditorStateChange?: (state: MonacoEditorState) => void;
  onFocusEditor?: () => void;
  commandService?: CommandService;
  getCommandContext?: () => CommandContext;
  onRevealControlReference?: (reference: LingCppControlReference) => void;
  onRenameControlReference?: (reference: LingCppControlReference, newName: string) => void;
}

let lingCppProvidersRegistered = false;
let lingCppTokensProviderDisposable: { dispose: () => void } | undefined;
let cppProvidersRegistered = false;
const cppFilePathRegistry = new MonacoFilePathRegistry();
let cppCodeActionCommandId: string | undefined;
let lingCppDesignerProjectSnapshot: LingWindowProject | undefined;
let lingCppFilePathSnapshot: string | undefined;
let lingCppRevealBindingSnapshot: ((binding: LingCppDesignerBindingHint) => void) | undefined;
let lingCppRevealCommandId: string | undefined;
let lingCppModuleContextSnapshot: LingCppModuleContext | undefined;
let lingCppProjectGlobalsSnapshot: LingCppProjectGlobalContext | undefined;
let lingCppProjectTypesSnapshot: LingCppProjectTypeContext | undefined;
let lingCppProjectSourcesSnapshot: LingCppProjectSourceFile[] | undefined;
let lingCppProjectSourcesChangeSnapshot: ((sources: LingCppProjectSourceFile[]) => void) | undefined;
let lingCppRevealControlReferenceSnapshot: ((reference: LingCppControlReference) => void) | undefined;
let lingCppRenameControlReferenceSnapshot: ((reference: LingCppControlReference, newName: string) => void) | undefined;

const EPL_KEYWORDS = [
  '如果', '如果真', '否则', '否则如果', '如果结束',
  '判断', '判断结束',
  '判断循环首', '判断循环尾',
  '循环判断首', '循环判断尾',
  '计次循环首', '计次循环尾',
  '变量循环首', '变量循环尾',
  '枚举循环首', '枚举循环尾',
  '跳出循环', '到循环尾',
  '尝试', '捕获',
  '子程序', '局部变量', '局部常量', '常量', '返回', '结束'
];

const EPL_COMMANDS = [
  '信息框', '调试输出', '输出调试文本',
  '载入可视化设计', '读取配置项', '取运行目录',
  '到文本', '到整数', '到小数', '到逻辑',
  '取文本长度', '取文本左边', '取文本右边', '取文本中间',
  '寻找文本', '替换文本', '删全部空', '分割文本',
  '取数组成员数', '加入成员', '删除成员', '清除数组',
  '取随机数', '取绝对值', '取整', '四舍五入',
  '延时', '取启动时间',
  '写到文件', '读入文件', '文件是否存在', '创建目录',
  '写配置项', '取现行时间',
  '窗口_取标题', '窗口_置标题',
  '窗口_显示', '窗口_隐藏', '窗口_关闭',
  '置剪辑板文本', '取剪辑板文本'
];

const EPL_TYPES = [
  '文本型', '整数型', '长整数型', '小数型', '双精度小数型', '逻辑型',
  '字节集', '日期时间型', '窗口', '按钮', '编辑框', '标签', '外部树型框',
  '外部控件操作', '外部超级列表框', '外部数据库', '外部数据提供者'
];

const EPL_BOOLEANS = ['真', '假'];

const createMonarchLanguage = (
  keywords: string[],
  commands: string[],
  types: string[],
  booleans: string[],
  tagPattern: RegExp
) => ({
  defaultToken: '',
  tokenPostfix: '.ling',
  keywords,
  commands,
  types,
  booleans,
  operators: [
    '=', '>', '<', '!', '~', '?', ':',
    '==', '<=', '>=', '!=', '&&', '||',
    '+', '-', '*', '/', '%', '^'
  ],
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  tokenizer: {
    root: [
      [/[a-zA-Z\u4e00-\u9fa5_][a-zA-Z0-9\u4e00-\u9fa5_]*/, {
        cases: {
          '@keywords': 'keyword',
          '@commands': 'predefined',
          '@types': 'type',
          '@booleans': 'keyword',
          '@default': 'identifier'
        }
      }],
      [tagPattern, 'tag'],
      { include: '@whitespace' },
      [/[{}()\[\]]/, '@brackets'],
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': ''
        }
      }],
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string'],
      [/“/, 'string', '@stringChinese'],
    ],
    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/(?:\/\/|').*/, 'comment'],
    ],
    string: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop']
    ],
    stringChinese: [
      [/[^\\”]+/, 'string'],
      [/\\./, 'string.escape'],
      [/”/, 'string', '@pop']
    ]
  }
});

const eplMonarchLanguage = createMonarchLanguage(
  EPL_KEYWORDS,
  EPL_COMMANDS,
  EPL_TYPES,
  EPL_BOOLEANS,
  /^\s*\.(子程序|局部变量|变量|常量|程序集|程序集变量|版本|支持库)\b/
);

const MonacoCodeEditor = forwardRef<MonacoCodeEditorHandle, MonacoCodeEditorProps>(function MonacoCodeEditor({
  sourceCode,
  language,
  isDarkMode,
  readOnly,
  onChange,
  focusHandlerName,
  onFocusHandled,
  editorFontSize = 14,
  onFontSizeChange,
  filePath,
  designerProject,
  onRevealDesignerBinding,
  onCursorPositionChange,
  readingMode = 'off',
  focusedBlockId,
  onRevealReadableBlock,
  moduleContext: providedModuleContext,
  projectGlobals, projectTypes, projectSources, onProjectSourcesChange,
  modelIdentity: providedModelIdentity,
  modelSurface = 'professional',
  onEditorStateChange,
  onFocusEditor,
  commandService,
  getCommandContext,
  onRevealControlReference,
  onRenameControlReference
}: MonacoCodeEditorProps, ref) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const cppFilePathOwnerRef = useRef<object>({});
  const onFocusEditorRef = useRef(onFocusEditor);
  onFocusEditorRef.current = onFocusEditor;
  const decorationIdsRef = useRef<string[]>([]);
  const debugDecorationIdsRef = useRef<string[]>([]);
  const coverageDecorationIdsRef = useRef<string[]>([]);
  const [coverageLines, setCoverageLines] = useState<Array<{ line: number; state: 'covered' | 'uncovered'; hits: number }>>([]);
  const stateFrameRef = useRef<number | null>(null);
  const modelIdentity = useMemo<TextModelIdentity>(() => providedModelIdentity || ({
    workspaceId: 'lingbuilder-renderer',
    projectId: 'default-project',
    filePath: filePath || 'untitled/source.txt'
  }), [filePath, providedModelIdentity]);
  const modelRecord = workbenchTextModelService.ensure(modelIdentity);
  const activeContextRef = useRef({
    identity: modelIdentity,
    modelId: modelRecord.modelId,
    uri: modelRecord.uri,
    token: { modelId: modelRecord.modelId, generation: modelRecord.generation } as TextModelGeneration,
    surface: modelSurface,
    sourceCode,
    readOnly,
    filePath,
    language,
    onCursorPositionChange,
    onEditorStateChange
  });
  activeContextRef.current = {
    identity: modelIdentity,
    modelId: modelRecord.modelId,
    uri: modelRecord.uri,
    token: { modelId: modelRecord.modelId, generation: modelRecord.generation },
    surface: modelSurface,
    sourceCode,
    readOnly,
    filePath,
    language,
    onCursorPositionChange,
    onEditorStateChange
  };
  const boundContextRef = useRef<typeof activeContextRef.current | null>(null);
  const nativeHistoryContextRef = useRef<string | null>(null);
  // 本编辑器最近通过 onChange 发出的值。App 状态提交有延迟，延迟到达的旧 prop
  // 只是回声；若此时做 authoritative setValue 会回退用户刚输入的字符并把光标
  // 复位到第 1 行，因此 bindCurrentModel 用这份记录识别并跳过回声同步。
  const emittedValuesRef = useRef<string[]>([]);
  const adapterRef = useRef(new MonacoTextModelAdapter<WorkbenchTextModel>());
  const [fetchedModuleContext, setFetchedModuleContext] = useState<LingCppModuleContext | undefined>();
  const [debugBreakpointLines, setDebugBreakpointLines] = useState<number[]>([]);
  const moduleContext = providedModuleContext || fetchedModuleContext;
  const monacoValueBinding = createMonacoValueBinding(language, sourceCode);

  const emitEditorState = useCallback(() => {
    const editor = editorRef.current;
    const model = editor?.getModel?.() as WorkbenchTextModel | undefined;
    const context = boundContextRef.current || activeContextRef.current;
    if (!editor || !model || model.isDisposed?.() || adapterRef.current.getCurrentModel() !== model) return;
    const position = editor.getPosition?.() || { lineNumber: 1, column: 1 };
    const selection = editor.getSelection?.();
    let selectionLength = 0;
    if (selection && model.getOffsetAt) {
      try {
        const anchorOffset = model.getOffsetAt({
          lineNumber: selection.selectionStartLineNumber,
          column: selection.selectionStartColumn
        });
        const activeOffset = model.getOffsetAt({
          lineNumber: selection.positionLineNumber,
          column: selection.positionColumn
        });
        selectionLength = Math.abs(activeOffset - anchorOffset);
      } catch {
        selectionLength = 0;
      }
    }
    const state: MonacoEditorState = {
      modelId: context.modelId,
      surface: context.surface,
      line: Math.max(1, position.lineNumber || 1),
      column: Math.max(1, position.column || 1),
      selectionLength,
      canUndo: !context.readOnly && adapterRef.current.canUndo(),
      canRedo: !context.readOnly && adapterRef.current.canRedo(),
      readOnly: context.readOnly,
      positionAvailable: true
    };
    context.onCursorPositionChange?.({ line: state.line, column: state.column });
    context.onEditorStateChange?.(state);
  }, []);

  const captureBoundViewState = useCallback(() => {
    const context = boundContextRef.current;
    if (!context) return false;
    const state = adapterRef.current.captureViewState();
    if (!state) return false;
    return workbenchTextModelService.saveViewStateIfCurrent(context.token, context.surface, state);
  }, []);

  const scheduleStateUpdate = useCallback(() => {
    if (stateFrameRef.current !== null) return;
    stateFrameRef.current = window.requestAnimationFrame(() => {
      stateFrameRef.current = null;
      captureBoundViewState();
      emitEditorState();
    });
  }, [captureBoundViewState, emitEditorState]);

  const syncCppModelFilePath = useCallback((model: WorkbenchTextModel | null | undefined) => {
    const owner = cppFilePathOwnerRef.current;
    const context = activeContextRef.current;
    const modelUri = model?.uri?.toString?.();
    if (
      !modelUri
      || modelUri !== context.uri
      || mapWorkbenchLanguageToMonaco(context.language) !== 'cpp'
      || !context.filePath
    ) {
      cppFilePathRegistry.release(owner);
      return false;
    }
    cppFilePathRegistry.bind(owner, modelUri, context.filePath);
    return true;
  }, []);

  const bindCurrentModel = useCallback(() => {
    const editor = editorRef.current;
    const model = editor?.getModel?.() as WorkbenchTextModel | null | undefined;
    const context = activeContextRef.current;
    if (!editor || !model || model.isDisposed?.()) return false;

    const modelUri = model.uri?.toString?.();
    if (modelUri && modelUri !== context.uri) return false;
    const previousBoundContext = boundContextRef.current;
    const shouldRestoreSavedView = adapterRef.current.getCurrentModel() !== model
      || previousBoundContext?.modelId !== context.modelId
      || previousBoundContext?.surface !== context.surface;

    const nativeHistoryContext = `${context.modelId}:${context.language}`;
    const isStaleSelfEcho = previousBoundContext !== null
      && previousBoundContext.modelId === context.modelId
      && emittedValuesRef.current.includes(context.sourceCode);
    if (previousBoundContext === null || previousBoundContext.modelId !== context.modelId) {
      emittedValuesRef.current = [];
    }
    const syncResult = isStaleSelfEcho
      ? 'unchanged'
      : synchronizeMonacoModelValue(model, editor, context.sourceCode, {
        // LingCpp has one canonical per-file history shared with beginner mode.
        // A retained Monaco model must not create a second undo entry when it is
        // rebound to a canonical snapshot produced outside the Monaco surface.
        authoritative: context.language === 'lingcpp',
        readOnly: context.readOnly,
        resetNativeHistory: context.language === 'lingcpp'
          && nativeHistoryContextRef.current !== nativeHistoryContext
      });
    if (syncResult !== 'unavailable') nativeHistoryContextRef.current = nativeHistoryContext;

    if (!workbenchTextModelService.attachModelIfCurrent(context.token, model)) return false;
    adapterRef.current.bind(editor, model);
    boundContextRef.current = { ...context };
    syncCppModelFilePath(model);
    if (shouldRestoreSavedView) {
      const savedState = workbenchTextModelService.getViewState(context.identity, context.surface);
      if (savedState) adapterRef.current.restoreViewState(savedState);
    }
    emitEditorState();
    return true;
  }, [emitEditorState, syncCppModelFilePath]);

  useImperativeHandle(ref, () => ({
    undo: async () => {
      const context = activeContextRef.current;
      if (context.readOnly || !bindCurrentModel()) return false;
      const changed = await adapterRef.current.undo();
      if (changed) scheduleStateUpdate();
      return changed;
    },
    redo: async () => {
      const context = activeContextRef.current;
      if (context.readOnly || !bindCurrentModel()) return false;
      const changed = await adapterRef.current.redo();
      if (changed) scheduleStateUpdate();
      return changed;
    },
    replaceValueAuthoritatively: (value: string) => {
      const context = activeContextRef.current;
      if (context.readOnly || !bindCurrentModel()) return false;
      const editor = editorRef.current;
      const model = editor?.getModel?.() as WorkbenchTextModel | null | undefined;
      if (!editor || !model || model.isDisposed?.() || !model.setValue) return false;
      adapterRef.current.bind(editor, model);
      if (!adapterRef.current.replaceValuePreservingView(value)) return false;
      emitEditorState();
      return true;
    },
    insertSnippet: (text: string, placeholderOffset?: number, placeholderLength?: number) => {
      const context = activeContextRef.current;
      if (context.readOnly || !bindCurrentModel()) return false;
      const editor = editorRef.current;
      const model = editor?.getModel?.();
      if (!editor || !model || model.isDisposed?.()) return false;
      const selection = editor.getSelection?.() || null;
      const anchorPosition = selection
        ? {
          lineNumber: selection.selectionStartLineNumber || 1,
          column: selection.selectionStartColumn || 1
        }
        : editor.getPosition?.();
      if (!anchorPosition) return false;
      const applied = editor.executeEdits?.('lingbuilder.snippet', [{
        range: selection || {
          startLineNumber: anchorPosition.lineNumber,
          startColumn: anchorPosition.column,
          endLineNumber: anchorPosition.lineNumber,
          endColumn: anchorPosition.column
        },
        text,
        forceMoveMarkers: true
      }]);
      if (applied === false) return false;
      if (placeholderOffset !== undefined && placeholderLength && placeholderLength > 0
        && model.getOffsetAt && model.getPositionAt) {
        try {
          const baseOffset = model.getOffsetAt(anchorPosition);
          const anchor = model.getPositionAt(baseOffset + placeholderOffset);
          const active = model.getPositionAt(baseOffset + placeholderOffset + placeholderLength);
          if (anchor && active) {
            editor.setSelection?.({
              selectionStartLineNumber: anchor.lineNumber,
              selectionStartColumn: anchor.column,
              positionLineNumber: active.lineNumber,
              positionColumn: active.column
            });
          }
        } catch {
          // 占位定位失败时保留插入后的默认光标位置。
        }
      }
      editor.focus?.();
      return true;
    },
    focus: () => {
      if (!editorRef.current) return false;
      editorRef.current.focus?.();
      return true;
    },
    captureViewState: captureBoundViewState
  }), [bindCurrentModel, captureBoundViewState, scheduleStateUpdate]);

  useLayoutEffect(() => () => {
    if (stateFrameRef.current !== null) {
      window.cancelAnimationFrame(stateFrameRef.current);
      stateFrameRef.current = null;
    }
    captureBoundViewState();
    cppFilePathRegistry.release(cppFilePathOwnerRef.current);
    boundContextRef.current = null;
  }, [captureBoundViewState, modelRecord.uri, modelSurface]);

  useLayoutEffect(() => {
    syncCppModelFilePath(editorRef.current?.getModel?.());
    return () => cppFilePathRegistry.release(cppFilePathOwnerRef.current);
  }, [filePath, language, modelRecord.uri, syncCppModelFilePath]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      bindCurrentModel();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bindCurrentModel, modelRecord.uri, modelSurface, sourceCode]);

  useEffect(() => () => {
    captureBoundViewState();
    if (stateFrameRef.current !== null) {
      window.cancelAnimationFrame(stateFrameRef.current);
      stateFrameRef.current = null;
    }
    emittedValuesRef.current = [];
    cppFilePathRegistry.release(cppFilePathOwnerRef.current);
    boundContextRef.current = null;
  }, [captureBoundViewState]);

  useEffect(() => {
    editorRef.current?.updateOptions?.({ fontSize: editorFontSize });
  }, [editorFontSize]);

  // Sync focusHandlerName to scroll to correct subprogram
  useEffect(() => {
    if (!focusHandlerName || !editorRef.current) return;

    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const lines = model.getLinesContent();
    const regex = new RegExp(`(?:\\.子程序\\s+|事件\\s+)${focusHandlerName}(?:\\s|,|，|[（(]|$)`);
    let targetLine = -1;

    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        targetLine = i + 1;
        break;
      }
    }

    if (targetLine !== -1) {
      editor.revealLineInCenter(targetLine);
      editor.setPosition({ lineNumber: targetLine, column: 1 });
      editor.focus();
    }
    
    onFocusHandled?.();
  }, [focusHandlerName, onFocusHandled]);

  useEffect(() => {
    const handleRevealLine = (event: Event) => {
      const detail = (event as CustomEvent<{
        filePath?: string;
        line: number;
        column?: number;
        endLine?: number;
        endColumn?: number;
      }>).detail;
      if (!detail || !editorRef.current) return;
      const normalizePath = (value: string) => value.replace(/\\/gu, '/').replace(/^\.\//u, '').toLocaleLowerCase();
      if (filePath && detail.filePath && normalizePath(filePath) !== normalizePath(detail.filePath)) return;
      const line = Math.max(1, detail.line);
      const column = Math.max(1, detail.column || 1);
      const endLine = Math.max(line, detail.endLine || line);
      const endColumn = Math.max(endLine === line ? column : 1, detail.endColumn || column);
      editorRef.current.revealLineInCenter(line);
      editorRef.current.setSelection({
        startLineNumber: line,
        startColumn: column,
        endLineNumber: endLine,
        endColumn
      });
      editorRef.current.focus();
    };

    window.addEventListener('lingcpp-reveal-line', handleRevealLine);
    return () => window.removeEventListener('lingcpp-reveal-line', handleRevealLine);
  }, [filePath]);

  useEffect(() => {
    const editor = editorRef.current; const monaco = monacoRef.current; if (!editor || !monaco) return;
    coverageDecorationIdsRef.current = editor.deltaDecorations(coverageDecorationIdsRef.current, coverageLines.map(item => ({ range: new monaco.Range(item.line, 1, item.line, 1), options: { isWholeLine: true, className: item.state === 'covered' ? 'lingbuilder-coverage-covered' : 'lingbuilder-coverage-uncovered', linesDecorationsClassName: item.state === 'covered' ? 'lingbuilder-coverage-gutter-covered' : 'lingbuilder-coverage-gutter-uncovered', hoverMessage: { value: item.state === 'covered' ? `覆盖：执行 ${item.hits} 次` : '未覆盖' } } })));
  }, [coverageLines]);

  useEffect(() => { const update = (event: Event) => { const detail = (event as CustomEvent<{ filePath?: string; lines?: Array<{ line: number; state: 'covered' | 'uncovered'; hits: number }> }>).detail; if (!detail?.filePath || detail.filePath.replace(/\\/gu, '/') !== (filePath || '').replace(/\\/gu, '/')) return; setCoverageLines(detail.lines || []); }; window.addEventListener('lingbuilder-coverage-updated', update); return () => window.removeEventListener('lingbuilder-coverage-updated', update); }, [filePath]);

  useEffect(() => {
    const handleRevealBlock = (event: Event) => {
      const detail = (event as CustomEvent<{ filePath?: string; blockId?: string; line?: number }>).detail;
      if (!detail || !editorRef.current) return;
      if (filePath && detail.filePath && filePath !== detail.filePath) return;
      const blocks = getLingCppEventBlockHighlights(sourceCode, designerProject, filePath, moduleContext);
      const block = detail.blockId ? blocks.find(item => item.blockId === detail.blockId) : undefined;
      const line = Math.max(1, block?.startLine || detail.line || 1);
      editorRef.current.revealLineInCenter(line);
      editorRef.current.setSelection({
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: Math.max(line, block?.endLine || line),
        endColumn: 1
      });
      editorRef.current.focus();
      if (detail.blockId) onRevealReadableBlock?.(detail.blockId);
    };

    const handleFormatDocument = (event: Event) => {
      const detail = (event as CustomEvent<{ filePath?: string }>).detail;
      if (filePath && detail?.filePath && filePath !== detail.filePath) return;
      const action = editorRef.current?.getAction?.('editor.action.formatDocument');
      action?.run?.();
    };

    window.addEventListener('lingcpp-reveal-block', handleRevealBlock);
    window.addEventListener('lingcpp-format-document', handleFormatDocument);
    return () => {
      window.removeEventListener('lingcpp-reveal-block', handleRevealBlock);
      window.removeEventListener('lingcpp-format-document', handleFormatDocument);
    };
  }, [sourceCode, designerProject, filePath, moduleContext, onRevealReadableBlock]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    injectLingCppEditorStyles();
    bindCurrentModel();
    window.dispatchEvent(new Event('lingbuilder-debug-breakpoints-request'));
    const editorDomNode = editor.getDomNode?.();
    const handleFontWheel = (event: WheelEvent) => {
      if (!onFontSizeChange || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      onFontSizeChange(currentValue => currentValue + (event.deltaY < 0 ? 1 : -1));
    };
    editorDomNode?.addEventListener('wheel', handleFontWheel, { passive: false });
    const controlReferenceContextKey = editor.createContextKey?.('lingcppControlReference', false);
    const updateControlReferenceContext = (position: { lineNumber: number; column: number } | undefined) => {
      if (!position || language !== 'lingcpp') {
        controlReferenceContextKey?.set(false);
        return undefined;
      }
      const reference = getLingCppControlReferenceAtPosition(
        editor.getModel?.()?.getValue?.() || sourceCode,
        position.lineNumber,
        position.column,
        lingCppDesignerProjectSnapshot,
        lingCppModuleContextSnapshot,
        lingCppFilePathSnapshot
      );
      controlReferenceContextKey?.set(Boolean(reference?.symbol));
      return reference;
    };
    const cursorRegistration = editor.onDidChangeCursorPosition?.((event: any) => updateControlReferenceContext(event.position));
    const contextMenuRegistration = editor.onContextMenu?.((event: any) => updateControlReferenceContext(event.target?.position || editor.getPosition?.()));
    const controlCommandRegistration = commandService ? acquireLingCppControlReferenceCommands(commandService) : undefined;
    const resolvedControlMenuItem = commandService
      ? getMenuService(commandService).resolveMenu(
          LINGCPP_CONTROL_REFERENCE_CONTEXT_MENU,
          { ...(getCommandContext?.() || {}), 'workspace.open': true },
          { includeDisabled: true }
        ).find(item => item.kind === 'command' && item.command.id === REVEAL_LINGCPP_CONTROL_COMMAND)
      : undefined;
    const revealActionRegistration = resolvedControlMenuItem?.kind === 'command'
      ? editor.addAction?.({
          id: REVEAL_LINGCPP_CONTROL_COMMAND,
          label: resolvedControlMenuItem.command.title,
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1,
          precondition: 'lingcppControlReference',
          run: () => {
            const reference = updateControlReferenceContext(editor.getPosition?.());
            if (reference?.symbol) lingCppRevealControlReferenceSnapshot?.(reference);
          }
        })
      : undefined;
    editor.onDidDispose?.(() => {
      editorDomNode?.removeEventListener('wheel', handleFontWheel);
      cursorRegistration?.dispose?.();
      contextMenuRegistration?.dispose?.();
      revealActionRegistration?.dispose?.();
      controlCommandRegistration?.dispose?.();
      cppFilePathRegistry.release(cppFilePathOwnerRef.current);
    });
    editor.onDidChangeCursorSelection?.(scheduleStateUpdate);
    editor.onDidScrollChange?.(scheduleStateUpdate);
    editor.onDidChangeModelContent?.(scheduleStateUpdate);
    editor.onDidFocusEditorText?.(() => onFocusEditorRef.current?.());
    editor.onMouseDown?.((event: any) => {
      if (!filePath || language !== 'lingcpp' || event.target?.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;
      const line = event.target?.position?.lineNumber;
      if (Number.isInteger(line) && line > 0) window.dispatchEvent(new CustomEvent('lingbuilder-debug-breakpoint-toggle', {
        detail: { filePath, line, conditionRequested: Boolean(event.event?.browserEvent?.shiftKey) }
      }));
    });
    editor.onDidChangeModel?.(() => {
      cppFilePathRegistry.release(cppFilePathOwnerRef.current);
      window.setTimeout(() => {
        bindCurrentModel();
        scheduleStateUpdate();
      }, 0);
    });
    lingCppRevealCommandId ||= editor.addCommand(0, (_accessor: any, binding: LingCppDesignerBindingHint) => {
      lingCppRevealBindingSnapshot?.(binding);
    });
    cppCodeActionCommandId ||= editor.addCommand(0, async (_accessor: any, edit: unknown, title: string, targetPath: string, sourceText: string) => {
      try {
        const preview = await previewLspRefactor({ kind: 'codeAction', edit, filePath: targetPath, sourceText });
        const summary = preview.files.map((file: any) => `${file.filePath}（${file.editCount} 处）`).join('\n');
        if (!await requestWorkbenchConfirm({ title: '应用代码操作', description: `应用代码操作“${title}”？\n\n${summary}`, confirmLabel: '应用', cancelLabel: '取消' })) return;
        await applyLspRefactor(preview.previewId);
        window.dispatchEvent(new CustomEvent('lingbuilder-lsp-files-applied', { detail: { files: preview.files.map((file: any) => file.filePath) } }));
      } catch (error) { await requestWorkbenchAlert({ title: '代码操作失败', description: error instanceof Error ? error.message : '代码操作失败。', confirmLabel: '知道了' }); }
    });

    // Define EPL custom language if not registered
    if (!monaco.languages.getLanguages().some((lang: any) => lang.id === 'epl')) {
      monaco.languages.register({ id: 'epl' });
      monaco.languages.setMonarchTokensProvider('epl', eplMonarchLanguage);
      
      // Auto-completions
      monaco.languages.registerCompletionItemProvider('epl', {
        provideCompletionItems: (model: any, position: any) => {
          const suggestions: any[] = [];
          
          EPL_KEYWORDS.forEach(kw => {
            suggestions.push({
              label: kw,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: kw,
              detail: '流程控制关键字'
            });
          });

          EPL_COMMANDS.forEach(cmd => {
            suggestions.push({
              label: cmd,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: cmd,
              detail: '系统命令'
            });
          });

          EPL_TYPES.forEach(t => {
            suggestions.push({
              label: t,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: t,
              detail: '数据类型'
            });
          });

          return { suggestions };
        }
      });
    }
    if (!monaco.languages.getLanguages().some((lang: any) => lang.id === 'lingcpp')) {
      monaco.languages.register({ id: 'lingcpp' });
    }
    lingCppTokensProviderDisposable?.dispose();
    lingCppTokensProviderDisposable = monaco.languages.setMonarchTokensProvider(
      'lingcpp',
      createLingCppMonarchLanguage(lingCppModuleContextSnapshot)
    );

    if (!lingCppProvidersRegistered) {
      lingCppProvidersRegistered = true;

      monaco.languages.registerFoldingRangeProvider('lingcpp', {
        provideFoldingRanges: (model: any) =>
          getLingCppFoldingRanges(model.getValue()).map(range => ({
            start: range.startLine,
            end: range.endLine,
            kind: monaco.languages.FoldingRangeKind.Region
          }))
      });

      monaco.languages.registerDocumentSymbolProvider('lingcpp', {
        provideDocumentSymbols: (model: any) =>
          getLingCppSymbols(model.getValue()).map(symbol => toMonacoDocumentSymbol(symbol, monaco))
      });

      monaco.languages.registerDocumentSemanticTokensProvider('lingcpp', {
        getLegend: () => ({
          tokenTypes: [LINGCPP_CONTROL_REFERENCE_SEMANTIC_TOKEN],
          tokenModifiers: []
        }),
        provideDocumentSemanticTokens: (model: any) => ({
          data: buildLingCppControlReferenceSemanticTokenData(
            getLingCppControlReferences(
              model.getValue(),
              lingCppDesignerProjectSnapshot,
              lingCppModuleContextSnapshot,
              lingCppFilePathSnapshot
            ).filter(reference => reference.status === 'resolved').map(reference => reference.range)
          )
        }),
        releaseDocumentSemanticTokens: () => undefined
      });

      monaco.languages.registerCompletionItemProvider('lingcpp', {
        triggerCharacters: ['_', ' ', '(', '"', '“', '.', '#'],
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };

          const source = model.getValue();
          const suggestions = getLingCppCompletionItems({
            source,
            line: position.lineNumber,
            column: position.column,
            triggerText: word.word
          }, buildLingCppLanguageContext(
            source,
            lingCppDesignerProjectSnapshot,
            lingCppModuleContextSnapshot,
            lingCppFilePathSnapshot,
            lingCppProjectGlobalsSnapshot,
            lingCppProjectTypesSnapshot
            , createProjectFunctionContext((lingCppProjectSourcesSnapshot || []).map(item => ({ ...item, language: 'lingcpp' })))
          )).map(item => ({
            label: item.label,
            kind: toMonacoCompletionKind(item.kind, monaco),
            insertText: item.insertText,
            insertTextRules: item.isSnippet
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
            filterText: selectCompletionFilterText(
              item.label,
              [...(item.aliases || []), ...(item.pinyin || [])],
              word.word
            ),
            detail: item.detail,
            documentation: buildCompletionDocumentation(item),
            range
          }));

          return { suggestions };
        }
      });

      monaco.languages.registerHoverProvider('lingcpp', {
        provideHover: (model: any, position: any) => {
          const source = model.getValue();
          const hover = getLingCppHover({
            source,
            line: position.lineNumber,
            column: position.column
          }, buildLingCppLanguageContext(
            source,
            lingCppDesignerProjectSnapshot,
            lingCppModuleContextSnapshot,
            lingCppFilePathSnapshot,
            lingCppProjectGlobalsSnapshot,
            lingCppProjectTypesSnapshot
            , createProjectFunctionContext((lingCppProjectSourcesSnapshot || []).map(item => ({ ...item, language: 'lingcpp' })))
          ));
          if (!hover) return null;
          return {
            range: hover.range ? {
              startLineNumber: hover.range.startLine,
              startColumn: hover.range.startColumn,
              endLineNumber: hover.range.endLine,
              endColumn: hover.range.endColumn
            } : undefined,
            contents: [{ value: hover.contents }]
          };
        }
      });

      monaco.languages.registerDefinitionProvider('lingcpp', {
        provideDefinition: (model: any, position: any) => {
          const controlReference = getLingCppControlReferenceAtPosition(
            model.getValue(),
            position.lineNumber,
            position.column,
            lingCppDesignerProjectSnapshot,
            lingCppModuleContextSnapshot,
            lingCppFilePathSnapshot
          );
          if (controlReference?.symbol) {
            lingCppRevealControlReferenceSnapshot?.(controlReference);
            return null;
          }
          const word = model.getWordAtPosition(position);
          if (!word?.word) return null;
          const sourceDefinition = getLingCppSourceDefinitionAtPosition(
            model.getValue(), position.lineNumber, position.column
          );
          if (sourceDefinition) {
            return {
              uri: model.uri,
              range: {
                startLineNumber: sourceDefinition.range.startLine,
                startColumn: sourceDefinition.range.startColumn,
                endLineNumber: sourceDefinition.range.endLine,
                endColumn: sourceDefinition.range.endColumn
              }
            };
          }
          const constant = lingCppProjectGlobalsSnapshot?.constants.find(item => item.name === word.word);
          const globalDefinition = lingCppProjectGlobalsSnapshot ? findProjectGlobalDefinition(word.word, lingCppProjectGlobalsSnapshot) : undefined;
          const typeDefinition = findProjectDataTypeDefinition(word.word, lingCppProjectTypesSnapshot);
          const lineText = model.getLineContent(position.lineNumber) as string;
          const memberAccess = [...lineText.matchAll(/[\p{L}_][\p{L}\p{N}_]*(?:\s*\.\s*[\p{L}_][\p{L}\p{N}_]*)+/gu)]
            .find(match => (match.index || 0) < position.column && (match.index || 0) + match[0].length >= position.column - 1)?.[0];
          const globalTypes = new Map((lingCppProjectGlobalsSnapshot?.globals || []).map(global => [global.name, global.type]));
          const fieldDefinition = memberAccess ? resolveProjectDataFieldAccess(model.getValue(), position.lineNumber, memberAccess, lingCppProjectTypesSnapshot, globalTypes) : undefined;
          const definition = constant
            ? { filePath: lingCppProjectGlobalsSnapshot!.filePath, line: constant.line, name: constant.name }
            : globalDefinition
              ? { filePath: globalDefinition.filePath, line: globalDefinition.line, name: globalDefinition.global.name }
              : fieldDefinition
                ? { filePath: fieldDefinition.filePath, line: fieldDefinition.line, name: fieldDefinition.field.name }
                : typeDefinition
                  ? { filePath: typeDefinition.filePath, line: typeDefinition.line, name: typeDefinition.dataType.name }
                  : undefined;
          if (!definition) return null;
          const range = {
            startLineNumber: definition.line,
            startColumn: 1,
            endLineNumber: definition.line,
            endColumn: Math.max(2, definition.name.length + 1)
          };
          const normalizePath = (value: string) => value.replace(/\\/gu, '/').replace(/^\.\//u, '').toLocaleLowerCase();
          if (lingCppFilePathSnapshot && normalizePath(definition.filePath) === normalizePath(lingCppFilePathSnapshot)) {
            return { uri: model.uri, range };
          }
          window.dispatchEvent(new CustomEvent('lingcpp-reveal-definition', {
            detail: { filePath: definition.filePath, line: definition.line, column: 1 }
          }));
          return null;
        }
      });

      monaco.languages.registerRenameProvider('lingcpp', {
        resolveRenameLocation: (model: any, position: any) => {
          const controlReference = getLingCppControlReferenceAtPosition(
            model.getValue(), position.lineNumber, position.column,
            lingCppDesignerProjectSnapshot, lingCppModuleContextSnapshot, lingCppFilePathSnapshot
          );
          if (controlReference?.symbol) return {
            text: controlReference.symbol.name,
            range: {
              startLineNumber: controlReference.range.startLine,
              startColumn: controlReference.range.startColumn,
              endLineNumber: controlReference.range.endLine,
              endColumn: controlReference.range.endColumn
            }
          };
          const word = model.getWordAtPosition(position);
          const isConstant = Boolean(word?.word && lingCppProjectGlobalsSnapshot?.constants.some(item => item.name === word.word));
          const definition = word?.word && lingCppProjectGlobalsSnapshot ? findProjectGlobalDefinition(word.word, lingCppProjectGlobalsSnapshot) : undefined;
          if (!word?.word || (!definition && !isConstant)) return { rejectReason: '当前符号不是项目变量或项目常量。' };
          return {
            text: word.word,
            range: {
              startLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endLineNumber: position.lineNumber,
              endColumn: word.endColumn
            }
          };
        },
        provideRenameEdits: (model: any, position: any, newName: string) => {
          const controlReference = getLingCppControlReferenceAtPosition(
            model.getValue(), position.lineNumber, position.column,
            lingCppDesignerProjectSnapshot, lingCppModuleContextSnapshot, lingCppFilePathSnapshot
          );
          if (controlReference?.symbol) {
            if (!lingCppRenameControlReferenceSnapshot) return { edits: [], rejectReason: '控件重命名服务尚未就绪。' };
            try {
              lingCppRenameControlReferenceSnapshot(controlReference, newName);
              return { edits: [] };
            } catch (error) {
              return { edits: [], rejectReason: error instanceof Error ? error.message : '控件重命名失败。' };
            }
          }
          const word = model.getWordAtPosition(position);
          if (!word?.word || !lingCppProjectGlobalsSnapshot || !lingCppProjectSourcesSnapshot?.length || !lingCppProjectSourcesChangeSnapshot) {
            return { edits: [], rejectReason: '项目全局变量上下文尚未就绪。' };
          }
          try {
            const isConstant = lingCppProjectGlobalsSnapshot.constants.some(item => item.name === word.word);
            const sources = isConstant
              ? applyWorkspaceEditToFiles(
                  lingCppProjectSourcesSnapshot,
                  createProjectConstantRenameProposal(
                    lingCppProjectSourcesSnapshot,
                    lingCppProjectGlobalsSnapshot.filePath,
                    word.word,
                    newName
                  )
                )
              : renameProjectGlobalAcrossSources(
                  lingCppProjectSourcesSnapshot,
                  lingCppProjectGlobalsSnapshot,
                  word.word,
                  newName
                );
            lingCppProjectSourcesChangeSnapshot(sources);
            return { edits: [] };
          } catch (error) {
            return { edits: [], rejectReason: error instanceof Error ? error.message : '项目符号重命名失败。' };
          }
        }
      });

      monaco.languages.registerReferenceProvider('lingcpp', {
        provideReferences: (model: any, position: any) => {
          const controlReference = getLingCppControlReferenceAtPosition(
            model.getValue(), position.lineNumber, position.column,
            lingCppDesignerProjectSnapshot, lingCppModuleContextSnapshot, lingCppFilePathSnapshot
          );
          if (controlReference?.symbol && lingCppProjectSourcesSnapshot?.length) {
            return getLingCppControlReferenceLocations(
              lingCppProjectSourcesSnapshot,
              controlReference.symbol,
              lingCppDesignerProjectSnapshot,
              lingCppModuleContextSnapshot
            ).map(location => ({
              uri: location.filePath === lingCppFilePathSnapshot ? model.uri : monaco.Uri.file(location.filePath),
              range: {
                startLineNumber: location.range.startLine,
                startColumn: location.range.startColumn,
                endLineNumber: location.range.endLine,
                endColumn: location.range.endColumn
              }
            }));
          }
          const word = model.getWordAtPosition(position);
          if (!word?.word || !lingCppProjectGlobalsSnapshot?.constants.some(item => item.name === word.word) || !lingCppProjectSourcesSnapshot?.length) return [];
          return findProjectConstantReferences(lingCppProjectSourcesSnapshot, word.word).map(reference => ({
            uri: reference.filePath === lingCppFilePathSnapshot ? model.uri : monaco.Uri.file(reference.filePath),
            range: {
              startLineNumber: reference.line,
              startColumn: reference.column,
              endLineNumber: reference.line,
              endColumn: reference.column + word.word.length
            }
          }));
        }
      });

      monaco.languages.registerCodeActionProvider('lingcpp', {
        provideCodeActions: (model: any, range: any) => {
          const actions = getLingCppControlReferences(
            model.getValue(),
            lingCppDesignerProjectSnapshot,
            lingCppModuleContextSnapshot,
            lingCppFilePathSnapshot
          ).filter(reference => reference.quoted && reference.status === 'resolved'
            && reference.range.startLine <= range.endLineNumber
            && reference.range.endLine >= range.startLineNumber)
            .map(reference => ({
              title: `改为控件引用：${reference.name}`,
              kind: 'quickfix',
              isPreferred: true,
              edit: {
                edits: [{
                  resource: model.uri,
                  textEdit: {
                    range: {
                      startLineNumber: reference.range.startLine,
                      startColumn: reference.range.startColumn,
                      endLineNumber: reference.range.endLine,
                      endColumn: reference.range.endColumn
                    },
                    text: reference.name
                  },
                  versionId: model.getVersionId?.()
                }]
              }
            }));
          return { actions, dispose: () => undefined };
        }
      });

      monaco.languages.registerDocumentFormattingEditProvider('lingcpp', {
        provideDocumentFormattingEdits: (model: any) => [
          {
            range: model.getFullModelRange(),
            text: formatLingCpp(model.getValue())
          }
        ]
      });

      monaco.languages.registerCodeLensProvider('lingcpp', {
        provideCodeLenses: (model: any) => {
          const bindings = getLingCppDesignerBindings(
            model.getValue(),
            lingCppDesignerProjectSnapshot,
            lingCppFilePathSnapshot,
            lingCppModuleContextSnapshot
          );
          return {
            lenses: bindings.map(binding => ({
              range: {
                startLineNumber: Math.max(1, binding.line),
                startColumn: 1,
                endLineNumber: Math.max(1, binding.line),
                endColumn: 1
              },
              command: {
                id: lingCppRevealCommandId || 'lingcpp.designerBindingHint',
                title: binding.displayText || binding.message,
                arguments: [binding]
              }
            })),
            dispose: () => undefined
          };
        },
        resolveCodeLens: (_model: any, codeLens: any) => codeLens
      });
    }

    if (!cppProvidersRegistered) {
      cppProvidersRegistered = true;
      const pathFor = (model: any) => cppFilePathRegistry.resolve(model.uri.toString());
      const cancellation = (token: any) => {
        const controller = new AbortController();
        token?.onCancellationRequested?.(() => controller.abort());
        return controller.signal;
      };
      monaco.languages.registerCompletionItemProvider('cpp', {
        triggerCharacters: ['.', '>', ':', '#', '"', '<'],
        provideCompletionItems: async (model: any, position: any, _context: any, token: any) => {
          const targetPath = pathFor(model); if (!targetPath) return { suggestions: [] };
          const result = await requestLsp<any>({ method: 'textDocument/completion', filePath: targetPath, line: position.lineNumber, column: position.column }, cancellation(token));
          const word = model.getWordUntilPosition(position);
          return { suggestions: normalizeCompletionItems(result).map(item => ({
            label: typeof item.label === 'string' ? item.label : item.label?.label,
            kind: monaco.languages.CompletionItemKind.Text,
            insertText: item.insertText || item.textEdit?.newText || (typeof item.label === 'string' ? item.label : item.label?.label),
            detail: item.detail,
            documentation: { value: markupToText(item.documentation) },
            range: item.textEdit?.range ? lspRangeToMonaco(item.textEdit.range) : {
              startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
              startColumn: word.startColumn, endColumn: word.endColumn
            }
          })) };
        }
      });
      monaco.languages.registerHoverProvider('cpp', {
        provideHover: async (model: any, position: any, token: any) => {
          const targetPath = pathFor(model); if (!targetPath) return null;
          const result = await requestLsp<any>({ method: 'textDocument/hover', filePath: targetPath, line: position.lineNumber, column: position.column }, cancellation(token));
          return result ? { range: result.range ? lspRangeToMonaco(result.range) : undefined, contents: [{ value: markupToText(result.contents) }] } : null;
        }
      });
      monaco.languages.registerSignatureHelpProvider('cpp', {
        signatureHelpTriggerCharacters: ['(', ','],
        provideSignatureHelp: async (model: any, position: any, token: any) => {
          const targetPath = pathFor(model); if (!targetPath) return null;
          const value = await requestLsp<any>({ method: 'textDocument/signatureHelp', filePath: targetPath, line: position.lineNumber, column: position.column }, cancellation(token));
          return value ? { value, dispose: () => undefined } : null;
        }
      });
      const locations = (method: 'textDocument/definition' | 'textDocument/implementation' | 'textDocument/references') => async (model: any, position: any, token: any) => {
        const targetPath = pathFor(model); if (!targetPath) return [];
        const value = await requestLsp<any>({ method, filePath: targetPath, line: position.lineNumber, column: position.column }, cancellation(token));
        return normalizeLspLocations(value).map(location => ({ uri: monaco.Uri.parse(location.uri), range: lspRangeToMonaco(location.range) }));
      };
      monaco.languages.registerDefinitionProvider('cpp', { provideDefinition: locations('textDocument/definition') });
      monaco.languages.registerImplementationProvider('cpp', { provideImplementation: locations('textDocument/implementation') });
      monaco.languages.registerReferenceProvider('cpp', { provideReferences: locations('textDocument/references') });
      monaco.languages.registerRenameProvider('cpp', {
        resolveRenameLocation: async (model: any, position: any, token: any) => {
          const targetPath = pathFor(model); if (!targetPath) return { rejectReason: '未找到工作区文件。' };
          const value = await requestLsp<any>({ method: 'textDocument/prepareRename', filePath: targetPath, line: position.lineNumber, column: position.column }, cancellation(token));
          if (!value) return { rejectReason: 'clangd 认为该符号不可重命名。' };
          const range = value.range || value;
          return { range: lspRangeToMonaco(range), text: value.placeholder || model.getValueInRange(lspRangeToMonaco(range)) };
        },
        provideRenameEdits: async (model: any, position: any, newName: string, token: any) => {
          const targetPath = pathFor(model); if (!targetPath) return { edits: [], rejectReason: '未找到工作区文件。' };
          try {
            const preview = await previewLspRefactor({ kind: 'rename', filePath: targetPath, sourceText: model.getValue(), newName, position: { line: position.lineNumber - 1, character: position.column - 1 } });
            const summary = preview.files.map((file: any) => `${file.filePath}（${file.editCount} 处）`).join('\n');
            if (!await requestWorkbenchConfirm({ title: '确认重命名', description: `确认把符号重命名为“${newName}”？\n\n${summary}`, confirmLabel: '重命名', cancelLabel: '取消' })) return { edits: [], rejectReason: '用户取消了重命名。' };
            await applyLspRefactor(preview.previewId);
            window.dispatchEvent(new CustomEvent('lingbuilder-lsp-files-applied', { detail: { files: preview.files.map((file: any) => file.filePath) } }));
            return { edits: [] };
          } catch (error) { return { edits: [], rejectReason: error instanceof Error ? error.message : '重命名失败。' }; }
        }
      });
      monaco.languages.registerCodeActionProvider('cpp', {
        provideCodeActions: async (model: any, range: any, context: any, token: any) => {
          const targetPath = pathFor(model); if (!targetPath) return { actions: [], dispose: () => undefined };
          const values = await requestLsp<any[]>({
            method: 'textDocument/codeAction', filePath: targetPath,
            range: { start: { line: range.startLineNumber - 1, character: range.startColumn - 1 }, end: { line: range.endLineNumber - 1, character: range.endColumn - 1 } },
            context: { diagnostics: context.markers || [] }
          }, cancellation(token));
          return {
            actions: (Array.isArray(values) ? values : []).filter(action => action.edit).map(action => ({
              title: action.title, kind: action.kind, diagnostics: context.markers,
              command: { id: cppCodeActionCommandId, title: action.title, arguments: [action.edit, action.title, targetPath, model.getValue()] }
            })),
            dispose: () => undefined
          };
        }
      });
      monaco.languages.registerDocumentSymbolProvider('cpp', {
        provideDocumentSymbols: async (model: any, token: any) => {
          const targetPath = pathFor(model); if (!targetPath) return [];
          const values = await requestLsp<any[]>({ method: 'textDocument/documentSymbol', filePath: targetPath }, cancellation(token));
          const mapSymbol = (item: any): any => ({
            name: item.name, detail: item.detail || '', kind: monaco.languages.SymbolKind.Variable,
            range: lspRangeToMonaco(item.range || item.location?.range),
            selectionRange: lspRangeToMonaco(item.selectionRange || item.range || item.location?.range),
            children: Array.isArray(item.children) ? item.children.map(mapSymbol) : undefined
          });
          return Array.isArray(values) ? values.map(mapSymbol) : [];
        }
      });
      // `registerWorkspaceSymbolProvider` is exposed by some VS Code-style
      // Monaco hosts, but it is not part of every standalone Monaco runtime.
      // Restored professional editors mount immediately in Electron, so an
      // unconditional call here used to tear down the complete React tree and
      // leave only the BrowserWindow background visible.
      const registerWorkspaceSymbolProvider = (monaco.languages as any).registerWorkspaceSymbolProvider;
      if (typeof registerWorkspaceSymbolProvider === 'function') {
        registerWorkspaceSymbolProvider.call(monaco.languages, {
          provideWorkspaceSymbols: async (query: string, token: any) => {
            const values = await requestLsp<any[]>({ method: 'workspace/symbol', query }, cancellation(token));
            return (Array.isArray(values) ? values : []).filter(item => item.location?.uri && item.location?.range).map(item => ({
              name: item.name, kind: monaco.languages.SymbolKind.Variable,
              containerName: item.containerName || '',
              location: { uri: monaco.Uri.parse(item.location.uri), range: lspRangeToMonaco(item.location.range) }
            }));
          }
        });
      }
    }

    // Configure themes
    monaco.editor.defineTheme('epl-dark', {
      base: 'vs-dark',
      inherit: true,
      semanticHighlighting: true,
      rules: [
        { token: 'keyword', foreground: '569cd6', fontStyle: 'bold' },
        { token: 'predefined', foreground: '4ec9b0' },
        { token: 'module.command', foreground: '22d3ee', fontStyle: 'bold' },
        { token: 'native.marker', foreground: 'c586c0', fontStyle: 'bold' },
        { token: 'type', foreground: '4fc1ff' },
        { token: 'tag', foreground: 'c586c0', fontStyle: 'bold' },
        { token: 'comment', foreground: LINGCPP_COMMENT_TOKEN_COLORS.dark.slice(1), fontStyle: 'italic' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' }
        ,{ token: LINGCPP_CONTROL_REFERENCE_SEMANTIC_TOKEN, foreground: LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.dark.slice(1), fontStyle: 'bold' }
        ,{ token: 'constant', foreground: LINGCPP_CONSTANT_TOKEN_COLORS.dark.slice(1) }
      ],
      colors: {
        'editor.background': '#1e1e24',
        'editor.foreground': '#d4d4d4',
        'editorLineNumber.foreground': '#5a5a6a',
        'editorLineNumber.activeForeground': '#007acc',
        'editor.lineHighlightBackground': '#2d2d34'
      }
    });

    monaco.editor.defineTheme('epl-light', {
      base: 'vs',
      inherit: true,
      semanticHighlighting: true,
      rules: [
        { token: 'keyword', foreground: '0000ff', fontStyle: 'bold' },
        { token: 'predefined', foreground: '008080' },
        { token: 'module.command', foreground: '006a7a', fontStyle: 'bold' },
        { token: 'native.marker', foreground: '7a1fa2', fontStyle: 'bold' },
        { token: 'type', foreground: '0000ff' },
        { token: 'tag', foreground: '800080', fontStyle: 'bold' },
        { token: 'comment', foreground: LINGCPP_COMMENT_TOKEN_COLORS.light.slice(1), fontStyle: 'italic' },
        { token: 'string', foreground: 'a31515' },
        { token: 'number', foreground: '098658' }
        ,{ token: LINGCPP_CONTROL_REFERENCE_SEMANTIC_TOKEN, foreground: LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.light.slice(1), fontStyle: 'bold' }
        ,{ token: 'constant', foreground: LINGCPP_CONSTANT_TOKEN_COLORS.light.slice(1) }
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#000000',
        'editorLineNumber.foreground': '#a5a5a5',
        'editorLineNumber.activeForeground': '#007acc',
        'editor.lineHighlightBackground': '#f2f2f2'
      }
    });

    // Update active theme
    monaco.editor.setTheme(isDarkMode ? 'epl-dark' : 'epl-light');
  };

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(isDarkMode ? 'epl-dark' : 'epl-light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor || language !== 'lingcpp') return;
    lingCppTokensProviderDisposable?.dispose();
    lingCppTokensProviderDisposable = monaco.languages.setMonarchTokensProvider(
      'lingcpp',
      createLingCppMonarchLanguage(moduleContext)
    );
    const model = editor.getModel?.();
    model?.forceTokenization?.(model.getLineCount());
  }, [language, moduleContext]);

  useEffect(() => {
    if (providedModuleContext) return;
    const projectId = designerProject?.id || 'lingbuilder-ui-project';
    let cancelled = false;

    Promise.all([
      fetch(`/api/modules/installed?projectId=${encodeURIComponent(projectId)}`).then(res => res.json()).catch(() => ({ ok: false, modules: [] })),
      fetch(`/api/modules/project?projectId=${encodeURIComponent(projectId)}`).then(res => res.json()).catch(() => ({ ok: false, modules: [] }))
    ]).then(([installedResult, enabledResult]) => {
      if (cancelled) return;
      const availableModules = Array.isArray(installedResult.modules) ? installedResult.modules as InstalledModule[] : [];
      const enabledModulesBase = Array.isArray(enabledResult.modules) ? enabledResult.modules as InstalledModule[] : [];
      // 项目级 DLL 命令声明：虚拟模块只并入补全上下文。
      const declaredModule = (enabledResult as { projectDeclarationModule?: InstalledModule | null }).projectDeclarationModule ?? null;
      const enabledModules = declaredModule ? [...enabledModulesBase, declaredModule] : enabledModulesBase;
      setFetchedModuleContext({ availableModules, enabledModules });
    });

    return () => {
      cancelled = true;
    };
  }, [designerProject?.id, providedModuleContext]);

  useEffect(() => {
    lingCppDesignerProjectSnapshot = designerProject;
    lingCppFilePathSnapshot = filePath;
    lingCppRevealBindingSnapshot = onRevealDesignerBinding;
    lingCppModuleContextSnapshot = moduleContext;
    lingCppProjectGlobalsSnapshot = projectGlobals;
    lingCppProjectTypesSnapshot = projectTypes;
    lingCppProjectSourcesSnapshot = projectSources;
    lingCppProjectSourcesChangeSnapshot = onProjectSourcesChange;
    lingCppRevealControlReferenceSnapshot = onRevealControlReference;
    lingCppRenameControlReferenceSnapshot = onRenameControlReference;

    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor?.getModel?.();
    if (!monaco || !model) return;

    if (mapWorkbenchLanguageToMonaco(language) !== 'lingcpp') {
      monaco.editor.setModelMarkers(model, 'lingcpp', []);
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
      return;
    }

    // 语义诊断 + 设计器绑定 + 全部装饰是全量同步重算（大文件 ~200ms+/次），
    // 与 App 的问题面板各跑一遍；这里同样按 300ms 去抖，连续输入先上屏，停顿后一次算完。
    // 上面的 snapshot 赋值必须保持同步：补全/悬停等 provider 闭包实时读取它们。
    const timer = window.setTimeout(() => {
      if (monacoRef.current !== monaco || editorRef.current !== editor || model.isDisposed?.() || editor.getModel?.() !== model) return;

      const markers = getLingCppSemanticDiagnostics(sourceCode, designerProject, filePath, moduleContext, projectGlobals, projectTypes, createProjectFunctionContext((projectSources || []).map(item => ({ ...item, language: 'lingcpp' })))).map(diagnostic => {
        const line = Math.max(1, Math.min(diagnostic.line, model.getLineCount()));
        return {
          severity: toMonacoMarkerSeverity(diagnostic.level, monaco),
          startLineNumber: diagnostic.range?.startLine || line,
          startColumn: diagnostic.range?.startColumn || 1,
          endLineNumber: diagnostic.range?.endLine || line,
          endColumn: diagnostic.range?.endColumn || Math.max(2, model.getLineMaxColumn(line)),
          message: `${diagnostic.message}\n${diagnostic.suggestion}`,
          code: diagnostic.id
        };
      });

      monaco.editor.setModelMarkers(model, 'lingcpp', markers);

      const bindings = getLingCppDesignerBindings(sourceCode, designerProject, filePath, moduleContext);
      const bindingDecorations = bindings.map(binding => ({
        range: new monaco.Range(Math.max(1, binding.line), 1, Math.max(1, binding.line), 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: glyphClassForBinding(binding.status),
          glyphMarginHoverMessage: { value: `**${binding.displayText || binding.message}**\n\n${binding.detailText || binding.suggestion}` }
        }
      }));

      const structureDecorations = buildStructureLabelDecorations(
        monaco,
        sourceCode,
        designerProject,
        filePath,
        readingMode,
        moduleContext
      );

      const readingDecorations = readingMode === 'off' ? [] : buildReadingDecorations(
        monaco,
        sourceCode,
        designerProject,
        filePath,
        readingMode,
        moduleContext,
        focusedBlockId
      );

      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, [...bindingDecorations, ...structureDecorations, ...readingDecorations]);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [sourceCode, language, designerProject, filePath, onRevealDesignerBinding, onRevealControlReference, onRenameControlReference, moduleContext, projectGlobals, projectTypes, projectSources, readingMode, focusedBlockId]);

  useEffect(() => {
    const editor = editorRef.current; const monaco = monacoRef.current; if (!editor || !monaco) return;
    debugDecorationIdsRef.current = editor.deltaDecorations(debugDecorationIdsRef.current, debugBreakpointLines.map(line => ({
      range: new monaco.Range(line, 1, line, 1),
      options: { isWholeLine: false, glyphMarginClassName: 'lingbuilder-debug-breakpoint', glyphMarginHoverMessage: { value: `断点：第 ${line} 行` } }
    })));
  }, [debugBreakpointLines]);

  useEffect(() => {
    const update = (event: Event) => {
      const items = (event as CustomEvent<{ breakpoints?: Array<{ filePath: string; line: number }> }>).detail?.breakpoints || [];
      setDebugBreakpointLines(items.filter(item => item.filePath === filePath).map(item => item.line));
    };
    window.addEventListener('lingbuilder-debug-breakpoints-changed', update);
    return () => window.removeEventListener('lingbuilder-debug-breakpoints-changed', update);
  }, [filePath]);

  return (
    <div data-lingbuilder-editor-command-owner="true" className="flex-1 w-full h-full relative overflow-hidden">
      <Editor
        height="100%"
        width="100%"
        defaultValue={monacoValueBinding.defaultValue}
        value={monacoValueBinding.value}
        path={modelRecord.uri}
        language={mapWorkbenchLanguageToMonaco(language)}
        theme={isDarkMode ? 'epl-dark' : 'epl-light'}
        onMount={handleEditorDidMount}
        onChange={(value, event) => {
          const nextValue = value || '';
          const emittedTrail = emittedValuesRef.current;
          if (emittedTrail[emittedTrail.length - 1] !== nextValue) {
            emittedTrail.push(nextValue);
            if (emittedTrail.length > 8) emittedTrail.shift();
          }
          onChange(nextValue, {
            isUndoing: event.isUndoing,
            isRedoing: event.isRedoing,
            isFlush: event.isFlush
          });
        }}
        saveViewState={false}
        keepCurrentModel
        options={{
          readOnly,
          fontSize: editorFontSize,
          fontFamily: '"Microsoft YaHei UI", "Cascadia Code", Consolas, monospace',
          minimap: { enabled: readingMode === 'off' },
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10
          },
          lineNumbers: 'on',
          codeLens: false,
          quickSuggestions: { other: true, comments: false, strings: false },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          cursorBlinking: 'blink',
          wordWrap: readingMode === 'off' ? 'off' : 'on',
          glyphMargin: true
        }}
      />
    </div>
  );
});

export default MonacoCodeEditor;

function injectLingCppEditorStyles(): void {
  const existing = document.getElementById('lingcpp-editor-language-service-styles') as HTMLStyleElement | null;
  const style = existing || document.createElement('style');
  style.id = 'lingcpp-editor-language-service-styles';
  style.textContent = [
    '.lingcpp-glyph-bound::before,',
    '.lingcpp-glyph-event::before,',
    '.lingcpp-glyph-warning::before,',
    '.lingcpp-glyph-missing::before,',
    '.lingcpp-action-message::before,',
    '.lingcpp-action-debug::before,',
    '.lingcpp-action-exit::before,',
    '.lingcpp-action-text::before,',
    '.lingcpp-action-window::before {',
    '  content: "";',
    '  display: block;',
    '  width: 6px;',
    '  height: 6px;',
    '  margin: 7px auto 0;',
    '  border-radius: 999px;',
    '  opacity: 0.72;',
    '}',
    '.lingcpp-glyph-bound::before { background: #34d399; }',
    '.lingcpp-glyph-event::before { background: #60a5fa; }',
    '.lingcpp-glyph-warning::before { background: #f59e0b; }',
    '.lingcpp-glyph-missing::before { background: #a78bfa; box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.18); }',
    '.lingcpp-readable-line { background: rgba(148, 163, 184, 0.026); }',
    '.lingcpp-readable-window { background: rgba(16, 185, 129, 0.04); }',
    '.lingcpp-readable-control { background: rgba(59, 130, 246, 0.04); }',
    '.lingcpp-readable-menu { background: rgba(168, 85, 247, 0.04); }',
    '.lingcpp-readable-focused { background: rgba(245, 158, 11, 0.12) !important; outline: 1px solid rgba(245, 158, 11, 0.32); }',
    '.lingcpp-readable-gutter::before,',
    '.lingcpp-structure-gutter::before {',
    '  content: "";',
    '  display: block;',
    '  width: 3px;',
    '  height: 14px;',
    '  margin: 3px auto 0;',
    '  border-radius: 999px;',
    '  background: rgba(148, 163, 184, 0.32);',
    '}',
    '.lingcpp-readable-gutter-window::before, .lingcpp-structure-gutter-class::before { background: rgba(52, 211, 153, 0.72); }',
    '.lingcpp-readable-gutter-control::before, .lingcpp-structure-gutter-member::before { background: rgba(96, 165, 250, 0.72); }',
    '.lingcpp-readable-gutter-menu::before, .lingcpp-structure-gutter-event::before { background: rgba(192, 132, 252, 0.72); }',
    '.lingcpp-structure-gutter-package::before, .lingcpp-structure-gutter-declaration::before { background: rgba(103, 232, 249, 0.72); }',
    '.lingcpp-structure-gutter-constructor::before, .lingcpp-structure-gutter-method::before { background: rgba(253, 230, 138, 0.72); }',
    '.lingcpp-structure-gutter-parameter::before, .lingcpp-structure-gutter-note::before { background: rgba(196, 181, 253, 0.54); }',
    '.lingcpp-inline-hint { color: #94a3b8; font-size: 11px; font-style: normal; margin-left: 12px; opacity: 0.62; }',
    '.lingcpp-inline-hint-event { color: #67e8f9; }',
    '.lingcpp-inline-hint-action { color: #fbbf24; }',
    '.lingcpp-member-inline-hint { color: #94a3b8; font-size: 11px; font-style: normal; margin-left: 14px; opacity: 0.76; }',
    '.lingcpp-structure-inline-member { color: #67e8f9; opacity: 0.9; }',
    '.lingcpp-structure-inline-class { color: #86efac; opacity: 0.86; }',
    '.lingcpp-structure-inline-event { color: #c4b5fd; opacity: 0.86; }',
    '.lingcpp-structure-line { background: rgba(148, 163, 184, 0.018); }',
    '.lingcpp-action-message::before { background: #38bdf8; }',
    '.lingcpp-action-debug::before { background: #34d399; }',
    '.lingcpp-action-exit::before { background: #fb7185; }',
    '.lingcpp-action-text::before { background: #fbbf24; }',
    '.lingcpp-action-window::before { background: #c084fc; }',
    ...createLingCppControlReferenceEditorCss(),
    '.lingbuilder-debug-breakpoint::before { content: ""; display: block; width: 10px; height: 10px; margin: 5px auto 0; border-radius: 999px; background: #ef4444; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.22); } .lingbuilder-coverage-covered { background: rgba(34,197,94,.10); } .lingbuilder-coverage-uncovered { background: rgba(244,63,94,.13); } .lingbuilder-coverage-gutter-covered { border-left: 3px solid #22c55e; } .lingbuilder-coverage-gutter-uncovered { border-left: 3px solid #f43f5e; }'
  ].join('\n');
  if (!existing) document.head.appendChild(style);
}

function buildReadingDecorations(
  monaco: any,
  sourceCode: string,
  designerProject: LingWindowProject | undefined,
  filePath: string | undefined,
  readingMode: LingCppReadingMode,
  moduleContext: LingCppModuleContext | undefined,
  focusedBlockId?: string
): any[] {
  const highlights = getLingCppEventBlockHighlights(sourceCode, designerProject, filePath, moduleContext);
  const hints = getLingCppInlineHints(sourceCode, designerProject, filePath, readingMode, moduleContext);
  const lineCount = sourceCode.split(/\r?\n/).length;
  const decorations: any[] = [];

  highlights.forEach(highlight => {
    const start = clampLine(highlight.startLine, lineCount);
    const end = clampLine(highlight.endLine, lineCount);
    const readableLineClass = readableClassForKind(highlight.kind);
    decorations.push({
      range: new monaco.Range(start, 1, end, 1),
      options: {
        isWholeLine: true,
        className: [
          'lingcpp-readable-line',
          readableLineClass,
          focusedBlockId === highlight.blockId ? 'lingcpp-readable-focused' : ''
        ].filter(Boolean).join(' '),
        linesDecorationsClassName: `lingcpp-readable-gutter ${readableGutterClassForKind(highlight.kind)}`,
        minimap: readingMode === 'focused' ? undefined : {
          color: 'rgba(56, 189, 248, 0.4)',
          position: monaco.editor.MinimapPosition.Inline
        }
      }
    });
  });

  const visibleHints = readingMode === 'beginner'
    ? hints.filter(hint => hint.kind !== 'action')
    : hints;

  visibleHints.forEach(hint => {
    const line = clampLine(hint.line, lineCount);
    decorations.push({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        after: {
          content: `  ${hint.text}`,
          inlineClassName: `lingcpp-inline-hint ${hint.kind === 'action' ? 'lingcpp-inline-hint-action' : hint.kind === 'event' ? 'lingcpp-inline-hint-event' : ''}`
        },
        hoverMessage: hint.hover ? { value: hint.hover } : undefined
      }
    });
  });

  highlights.forEach(highlight => {
    const actionClass = glyphClassForAction(highlight.actionKinds[0]);
    if (!actionClass) return;
    decorations.push({
      range: new monaco.Range(clampLine(highlight.startLine, lineCount), 1, clampLine(highlight.startLine, lineCount), 1),
      options: {
        glyphMarginClassName: actionClass
      }
    });
  });

  return decorations;
}

function buildStructureLabelDecorations(
  monaco: any,
  sourceCode: string,
  designerProject: LingWindowProject | undefined,
  filePath: string | undefined,
  readingMode: LingCppReadingMode,
  moduleContext: LingCppModuleContext | undefined
): any[] {
  const structuredRows = getLingCppStructuredReadingRows(
    sourceCode,
    designerProject,
    filePath,
    moduleContext
  );
  const lineCount = sourceCode.split(/\r?\n/).length;

  return structuredRows.map(row => {
    const line = clampLine(row.line, lineCount);
    const inlineHint = structureInlineHint(row, readingMode);
    return {
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className: 'lingcpp-structure-line',
        linesDecorationsClassName: `lingcpp-structure-gutter lingcpp-structure-gutter-${row.group}`,
        after: inlineHint ? {
          content: `  [${inlineHint}]`,
          inlineClassName: `lingcpp-member-inline-hint lingcpp-structure-inline-${row.group}`
        } : undefined,
        hoverMessage: {
          value: [
            `**${structureTextForGroup(row.group)}：${row.name}**`,
            row.type ? `类型：${row.type}` : '',
            row.value ? `值：${row.value}` : '',
            row.note || ''
          ].filter(Boolean).join('\n\n')
        }
      }
    };
  });
}

function structureInlineHint(row: LingCppStructuredReadingRow, readingMode: LingCppReadingMode): string | undefined {
  if (readingMode === 'off' && row.group !== 'member' && row.group !== 'class' && row.group !== 'event') {
    return undefined;
  }

  if (row.group === 'class') {
    return row.value ? `窗口类 · 基础类 ${row.value}` : '类声明';
  }

  if (row.group === 'event') {
    return row.status === 'bound' ? '事件处理器 · 已绑定' : '事件处理器';
  }

  if (row.group !== 'member') {
    return readingMode === 'off' ? undefined : structureTextForGroup(row.group);
  }

  const isControlMember = /按钮|标签|编辑框|复选框|单选框|下拉框|控件|窗体/u.test(row.type || '');
  const isDesignerLink = /关联设计文件/u.test(row.name);
  const hasInitialValue = Boolean(row.initialValue || row.value);
  const baseText = isDesignerLink
    ? '设计器关联 · 类成员'
    : isControlMember
      ? '设计器控件成员'
      : '类成员变量';
  return hasInitialValue
    ? `${baseText} · 已设初始值`
    : baseText;
}

function structureTextForGroup(group: LingCppStructuredReadingRow['group']): string {
  const labels: Record<LingCppStructuredReadingRow['group'], string> = {
    declaration: '声明',
    package: '入口',
    global: '项目全局变量',
    class: '类',
    member: '成员',
    local: '局部声明',
    method: '方法',
    constructor: '初始化',
    event: '事件',
    parameter: '参数',
    note: '备注'
  };
  return labels[group];
}

function clampLine(line: number, lineCount: number): number {
  return Math.max(1, Math.min(line, Math.max(1, lineCount)));
}

function readableClassForKind(kind: string): string {
  if (kind === 'window-event' || kind === 'constructor') return 'lingcpp-readable-window';
  if (kind === 'control-event') return 'lingcpp-readable-control';
  if (kind === 'menu-event') return 'lingcpp-readable-menu';
  return '';
}

function readableGutterClassForKind(kind: string): string {
  if (kind === 'window-event' || kind === 'constructor') return 'lingcpp-readable-gutter-window';
  if (kind === 'control-event') return 'lingcpp-readable-gutter-control';
  if (kind === 'menu-event') return 'lingcpp-readable-gutter-menu';
  return '';
}

function glyphClassForAction(kind?: string): string | undefined {
  if (kind === 'message-box') return 'lingcpp-action-message';
  if (kind === 'debug-output') return 'lingcpp-action-debug';
  if (kind === 'exit-program') return 'lingcpp-action-exit';
  if (kind === 'set-control-text') return 'lingcpp-action-text';
  if (kind === 'open-window') return 'lingcpp-action-window';
  return undefined;
}

function buildCompletionDocumentation(item: any): string {
  const lines = [
    item.audienceText || item.documentation || item.detail,
    item.aliases?.length ? `英文别名：${item.aliases.join(', ')}` : '',
    item.pinyin?.length ? `拼音/首字母：${item.pinyin.join(', ')}` : '',
    item.example ? `示例：${item.example}` : ''
  ].filter(Boolean);
  return lines.join('\n\n');
}

function glyphClassForBinding(status: LingCppDesignerBindingHint['status']): string {
  if (status === 'bound') return 'lingcpp-glyph-bound';
  if (status === 'missing-source') return 'lingcpp-glyph-missing';
  if (status === 'missing-control') return 'lingcpp-glyph-warning';
  return 'lingcpp-glyph-event';
}

function toMonacoDocumentSymbol(symbol: LingCppDocumentSymbol, monaco: any): any {
  const startLine = Math.max(1, symbol.line);
  const endLine = Math.max(startLine, symbol.endLine || symbol.line);
  return {
    name: symbol.name,
    detail: symbol.detail || '',
    kind: toMonacoSymbolKind(symbol.kind, monaco),
    range: {
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: 1
    },
    selectionRange: {
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: startLine,
      endColumn: 1
    },
    children: (symbol.children || []).map(child => toMonacoDocumentSymbol(child, monaco))
  };
}

function toMonacoSymbolKind(kind: LingCppDocumentSymbol['kind'], monaco: any): number {
  switch (kind) {
    case 'package':
      return monaco.languages.SymbolKind.Package;
    case 'use':
      return monaco.languages.SymbolKind.Namespace;
    case 'class':
      return monaco.languages.SymbolKind.Class;
    case 'data-type':
      return monaco.languages.SymbolKind.Struct;
    case 'data-field':
      return monaco.languages.SymbolKind.Field;
    case 'member':
      return monaco.languages.SymbolKind.Field;
    case 'constructor':
      return monaco.languages.SymbolKind.Constructor;
    case 'destructor':
    case 'method':
      return monaco.languages.SymbolKind.Method;
    case 'event':
      return monaco.languages.SymbolKind.Event;
    default:
      return monaco.languages.SymbolKind.Object;
  }
}

function toMonacoCompletionKind(kind: string, monaco: any): number {
  switch (kind) {
    case 'keyword':
      return monaco.languages.CompletionItemKind.Keyword;
    case 'type':
      return monaco.languages.CompletionItemKind.Class;
    case 'function':
      return monaco.languages.CompletionItemKind.Function;
    case 'event':
      return monaco.languages.CompletionItemKind.Event;
    case 'snippet':
      return monaco.languages.CompletionItemKind.Snippet;
    default:
      return monaco.languages.CompletionItemKind.Text;
  }
}

function toMonacoMarkerSeverity(level: string, monaco: any): number {
  if (level === 'error') return monaco.MarkerSeverity.Error;
  if (level === 'warning') return monaco.MarkerSeverity.Warning;
  return monaco.MarkerSeverity.Info;
}
