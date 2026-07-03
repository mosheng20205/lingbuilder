import { useEffect, useRef, useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import { LING_CPP_COMMANDS, LING_CPP_KEYWORDS, LING_CPP_TYPES } from '../services/lingCpp/parser';
import {
  formatLingCpp,
  getLingCppBilingualCompletions,
  getLingCppDesignerBindings,
  getLingCppEventBlockHighlights,
  getLingCppFoldingRanges,
  getLingCppInlineHints,
  getLingCppSemanticDiagnostics,
  getLingCppStructuredReadingRows,
  getLingCppSymbols
} from '../services/lingCpp/languageService';
import { LingCppDesignerBindingHint, LingCppDocumentSymbol, LingCppReadingMode, LingCppStructuredReadingRow } from '../services/lingCpp/types';
import { LingWindowProject } from '../services/windowDesigner/types';
import { InstalledModule, LingCppModuleContext } from '../services/modules/types';

// Configure monaco loader path if needed (default CDN is fine)
loader.config({
  paths: {
    vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs'
  }
});

interface MonacoCodeEditorProps {
  sourceCode: string;
  language: string;
  isDarkMode: boolean;
  readOnly: boolean;
  onChange: (value: string) => void;
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
}

let lingCppProvidersRegistered = false;
let lingCppDesignerProjectSnapshot: LingWindowProject | undefined;
let lingCppFilePathSnapshot: string | undefined;
let lingCppRevealBindingSnapshot: ((binding: LingCppDesignerBindingHint) => void) | undefined;
let lingCppRevealCommandId: string | undefined;
let lingCppModuleContextSnapshot: LingCppModuleContext | undefined;

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
  '子程序', '局部变量', '返回', '结束'
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

const LINGCPP_BOOLEANS = ['真', '假'];

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
  /^\s*\.(子程序|局部变量|变量|程序集|程序集变量|版本|支持库)\b/
);

const lingCppMonarchLanguage = createMonarchLanguage(
  LING_CPP_KEYWORDS,
  LING_CPP_COMMANDS,
  LING_CPP_TYPES,
  LINGCPP_BOOLEANS,
  /^\s*(包|使用|类|公开|私有|保护|构造|析构|事件|结束类)\b/
);

export default function MonacoCodeEditor({
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
  onRevealReadableBlock
}: MonacoCodeEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const [moduleContext, setModuleContext] = useState<LingCppModuleContext | undefined>();

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
      const detail = (event as CustomEvent<{ filePath?: string; line: number }>).detail;
      if (!detail || !editorRef.current) return;
      if (filePath && detail.filePath && filePath !== detail.filePath) return;
      const line = Math.max(1, detail.line);
      editorRef.current.revealLineInCenter(line);
      editorRef.current.setPosition({ lineNumber: line, column: 1 });
      editorRef.current.focus();
    };

    window.addEventListener('lingcpp-reveal-line', handleRevealLine);
    return () => window.removeEventListener('lingcpp-reveal-line', handleRevealLine);
  }, [filePath]);

  useEffect(() => {
    const handleRevealBlock = (event: Event) => {
      const detail = (event as CustomEvent<{ filePath?: string; blockId?: string; line?: number }>).detail;
      if (!detail || !editorRef.current) return;
      if (filePath && detail.filePath && filePath !== detail.filePath) return;
      const blocks = getLingCppEventBlockHighlights(sourceCode, designerProject, filePath);
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
  }, [sourceCode, designerProject, filePath, onRevealReadableBlock]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    injectLingCppEditorStyles();
    const initialPosition = editor.getPosition?.();
    if (initialPosition) {
      onCursorPositionChange?.({ line: initialPosition.lineNumber, column: initialPosition.column });
    }
    const editorDomNode = editor.getDomNode?.();
    const handleFontWheel = (event: WheelEvent) => {
      if (!onFontSizeChange || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      onFontSizeChange(currentValue => currentValue + (event.deltaY < 0 ? 1 : -1));
    };
    editorDomNode?.addEventListener('wheel', handleFontWheel, { passive: false });
    editor.onDidDispose?.(() => {
      editorDomNode?.removeEventListener('wheel', handleFontWheel);
    });
    editor.onDidChangeCursorPosition?.((event: any) => {
      onCursorPositionChange?.({ line: event.position.lineNumber, column: event.position.column });
    });
    lingCppRevealCommandId ||= editor.addCommand(0, (_accessor: any, binding: LingCppDesignerBindingHint) => {
      lingCppRevealBindingSnapshot?.(binding);
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
      monaco.languages.setMonarchTokensProvider('lingcpp', lingCppMonarchLanguage);
    }

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

      monaco.languages.registerCompletionItemProvider('lingcpp', {
        triggerCharacters: ['_', ' ', '('],
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };

          const suggestions = getLingCppBilingualCompletions({
            source: model.getValue(),
            line: position.lineNumber,
            column: position.column,
            triggerText: word.word
          }, lingCppDesignerProjectSnapshot, lingCppModuleContextSnapshot).map(item => ({
            label: item.label,
            kind: toMonacoCompletionKind(item.kind, monaco),
            insertText: item.insertText,
            insertTextRules: item.isSnippet
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
            detail: item.detail,
            documentation: buildCompletionDocumentation(item),
            range
          }));

          return { suggestions };
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
            lingCppFilePathSnapshot
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

    // Configure themes
    monaco.editor.defineTheme('epl-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '569cd6', fontStyle: 'bold' },
        { token: 'predefined', foreground: '4ec9b0' },
        { token: 'type', foreground: '4fc1ff' },
        { token: 'tag', foreground: 'c586c0', fontStyle: 'bold' },
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' }
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
      rules: [
        { token: 'keyword', foreground: '0000ff', fontStyle: 'bold' },
        { token: 'predefined', foreground: '008080' },
        { token: 'type', foreground: '0000ff' },
        { token: 'tag', foreground: '800080', fontStyle: 'bold' },
        { token: 'comment', foreground: '008000', fontStyle: 'italic' },
        { token: 'string', foreground: 'a31515' },
        { token: 'number', foreground: '098658' }
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
    const projectId = designerProject?.id || 'lingbuilder-ui-project';
    let cancelled = false;

    Promise.all([
      fetch(`/api/modules/installed?projectId=${encodeURIComponent(projectId)}`).then(res => res.json()).catch(() => ({ ok: false, modules: [] })),
      fetch(`/api/modules/project?projectId=${encodeURIComponent(projectId)}`).then(res => res.json()).catch(() => ({ ok: false, modules: [] }))
    ]).then(([installedResult, enabledResult]) => {
      if (cancelled) return;
      const availableModules = Array.isArray(installedResult.modules) ? installedResult.modules as InstalledModule[] : [];
      const enabledModules = Array.isArray(enabledResult.modules) ? enabledResult.modules as InstalledModule[] : [];
      setModuleContext({ availableModules, enabledModules });
    });

    return () => {
      cancelled = true;
    };
  }, [designerProject?.id]);

  useEffect(() => {
    lingCppDesignerProjectSnapshot = designerProject;
    lingCppFilePathSnapshot = filePath;
    lingCppRevealBindingSnapshot = onRevealDesignerBinding;
    lingCppModuleContextSnapshot = moduleContext;

    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor?.getModel?.();
    if (!monaco || !model) return;

    if (mapLanguage(language) !== 'lingcpp') {
      monaco.editor.setModelMarkers(model, 'lingcpp', []);
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
      return;
    }

    const markers = getLingCppSemanticDiagnostics(sourceCode, designerProject, filePath, moduleContext).map(diagnostic => {
      const line = Math.max(1, Math.min(diagnostic.line, model.getLineCount()));
      return {
        severity: toMonacoMarkerSeverity(diagnostic.level, monaco),
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: Math.max(2, model.getLineMaxColumn(line)),
        message: `${diagnostic.message}\n${diagnostic.suggestion}`,
        code: diagnostic.id
      };
    });

    monaco.editor.setModelMarkers(model, 'lingcpp', markers);

    const bindings = getLingCppDesignerBindings(sourceCode, designerProject, filePath);
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
      readingMode
    );

    const readingDecorations = readingMode === 'off' ? [] : buildReadingDecorations(
      monaco,
      sourceCode,
      designerProject,
      filePath,
      readingMode,
      focusedBlockId
    );

    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, [...bindingDecorations, ...structureDecorations, ...readingDecorations]);
  }, [sourceCode, language, designerProject, filePath, onRevealDesignerBinding, moduleContext, readingMode, focusedBlockId]);

  const mapLanguage = (lang: string) => {
    const l = lang.toLowerCase();
    if (l === 'epl') return 'epl';
    if (l === 'lingcpp' || l === 'lcpp') return 'lingcpp';
    if (l === 'cpp' || l === 'h') return 'cpp';
    if (l === 'rc' || l === 'ini') return 'ini';
    return 'plaintext';
  };

  return (
    <div className="flex-1 w-full h-full relative overflow-hidden">
      <Editor
        height="100%"
        width="100%"
        value={sourceCode}
        language={mapLanguage(language)}
        theme={isDarkMode ? 'epl-dark' : 'epl-light'}
        onMount={handleEditorDidMount}
        onChange={value => onChange(value || '')}
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
}

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
    '.lingcpp-action-window::before { background: #c084fc; }'
  ].join('\n');
  if (!existing) document.head.appendChild(style);
}

function buildReadingDecorations(
  monaco: any,
  sourceCode: string,
  designerProject: LingWindowProject | undefined,
  filePath: string | undefined,
  readingMode: LingCppReadingMode,
  focusedBlockId?: string
): any[] {
  const highlights = getLingCppEventBlockHighlights(sourceCode, designerProject, filePath);
  const hints = getLingCppInlineHints(sourceCode, designerProject, filePath, readingMode);
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
  readingMode: LingCppReadingMode
): any[] {
  const structuredRows = getLingCppStructuredReadingRows(sourceCode, designerProject, filePath);
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
    class: '类',
    member: '成员',
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
