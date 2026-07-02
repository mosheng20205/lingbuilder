import { useEffect, useRef } from 'react';
import Editor, { loader } from '@monaco-editor/react';

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
}

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

const eplMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.e',

  keywords: EPL_KEYWORDS,
  commands: EPL_COMMANDS,
  types: EPL_TYPES,
  booleans: EPL_BOOLEANS,

  operators: [
    '=', '>', '<', '!', '~', '?', ':',
    '==', '<=', '>=', '!=', '&&', '||',
    '+', '-', '*', '/', '%', '^'
  ],

  symbols: /[=><!~?:&|+\-*\/\^%]+/,

  tokenizer: {
    root: [
      // Identifiers & Keywords
      [/[a-zA-Z\u4e00-\u9fa5_][a-zA-Z0-9\u4e00-\u9fa5_]*/, {
        cases: {
          '@keywords': 'keyword',
          '@commands': 'predefined',
          '@types': 'type',
          '@booleans': 'keyword',
          '@default': 'identifier'
        }
      }],

      // Headers (e.g. .子程序, .局部变量, .变量)
      [/^\s*\.[子程序|局部变量|变量]+/, 'tag'],
      [/^\s*\.\s*[a-zA-Z\u4e00-\u9fa5_]*/, 'tag'],

      // Whitespace
      { include: '@whitespace' },

      // Delimiters and operators
      [/[{}()\[\]]/, '@brackets'],
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': ''
        }
      }],

      // Numbers
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],

      // Strings
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
};

export default function MonacoCodeEditor({
  sourceCode,
  language,
  isDarkMode,
  readOnly,
  onChange,
  focusHandlerName,
  onFocusHandled,
  editorFontSize = 14
}: MonacoCodeEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  // Sync focusHandlerName to scroll to correct subprogram
  useEffect(() => {
    if (!focusHandlerName || !editorRef.current) return;

    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const lines = model.getLinesContent();
    // Look for a line containing ".子程序" and the handler name
    const regex = new RegExp(`\\.子程序\\s+${focusHandlerName}(?:\\s|,|，|$)`);
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

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

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

  const mapLanguage = (lang: string) => {
    const l = lang.toLowerCase();
    if (l === 'epl') return 'epl';
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
          minimap: { enabled: true },
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10
          },
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          cursorBlinking: 'blink',
          wordWrap: 'off'
        }}
      />
    </div>
  );
}
