import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Sparkles, Undo2, Check, Code, LayoutGrid } from 'lucide-react';
import { DiffLine, DiffResult, ExtractedString } from '../types';
import WpfDesigner from './WpfDesigner';
import EplStructuredEditor from './EplStructuredEditor';

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
}

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

export default function DiffViewer({
  diffResult,
  strings,
  onUpdateStringTranslation,
  onResetTranslation,
  onUpdateSourceContent,
  isDarkMode,
  activeFile,
  editorFontSize = 13,
  onFontSizeChange
}: DiffViewerProps) {
  const [activeView, setActiveView] = useState<'code' | 'designer'>('code');
  const [viewMode, setViewMode] = useState<'chinese' | 'split' | 'unified'>('chinese');
  const [preset, setPreset] = useState<DiffPreset>(isDarkMode ? 'vs-dark' : 'classic-light');
  const searchQuery: string = '';
  const [editingStringId, setEditingStringId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [showFolds, setShowFolds] = useState(true);
  const [sourceScroll, setSourceScroll] = useState({ top: 0, left: 0 });
  const [pendingHandlerFocus, setPendingHandlerFocus] = useState<string | null>(null);

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const unifiedScrollRef = useRef<HTMLDivElement>(null);
  const sourceEditorRef = useRef<HTMLTextAreaElement>(null);
  const sourceLineNumberRef = useRef<HTMLDivElement>(null);

  const sourceCode = activeFile?.isModified || activeFile?.translatedContent
    ? activeFile?.translatedContent ?? ''
    : activeFile?.originalContent || diffResult.translatedLines.map(line => line.content).join('\n');
  const normalizedSourceCode = activeFile?.language === 'epl' ? optimizeEplName(sourceCode) : sourceCode;
  const sourceLineNumbers = useMemo(() => {
    const lineCount = Math.max(1, normalizedSourceCode.split('\n').length);
    return Array.from({ length: lineCount }, (_, index) => index + 1);
  }, [normalizedSourceCode]);
  const sourceHighlightLines = useMemo(() => normalizedSourceCode.split('\n'), [normalizedSourceCode]);
  const eplVisualLines = useMemo(() => {
    return activeFile?.language === 'epl' ? buildEplVisualLines(sourceHighlightLines) : [];
  }, [activeFile?.language, sourceHighlightLines]);

  const quickChineseSnippets = [
    { label: '.子程序', text: '\n.子程序 _按钮1_被单击\n    信息框 (“请输入提示内容”, 64, “提示”)\n' },
    { label: '如果', text: '如果 (条件)\n    \n如果结束' },
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

  const updateSourceCode = (nextCode: string) => {
    onUpdateSourceContent?.(activeFile?.language === 'epl' ? optimizeEplName(nextCode) : nextCode);
  };

  useEffect(() => {
    const handleFocusEplHandler = (event: Event) => {
      const customEvent = event as CustomEvent<{ handlerName?: string }>;
      const handlerName = customEvent.detail?.handlerName?.trim();
      if (!handlerName) return;

      setActiveView('code');
      setViewMode('chinese');
      setPendingHandlerFocus(handlerName);
    };

    window.addEventListener('focus-epl-handler', handleFocusEplHandler);
    return () => {
      window.removeEventListener('focus-epl-handler', handleFocusEplHandler);
    };
  }, []);

  useEffect(() => {
    const handleShowWindowDesigner = () => {
      setActiveView('designer');
    };

    window.addEventListener('show-window-designer', handleShowWindowDesigner);
    return () => {
      window.removeEventListener('show-window-designer', handleShowWindowDesigner);
    };
  }, []);

  useEffect(() => {
    if (!pendingHandlerFocus || activeFile?.language !== 'epl') return;

    const handlerIndex = normalizedSourceCode.indexOf(pendingHandlerFocus);
    if (handlerIndex < 0) return;

    window.requestAnimationFrame(() => {
      const editor = sourceEditorRef.current;
      if (!editor) return;

      const lineIndex = normalizedSourceCode.slice(0, handlerIndex).split('\n').length - 1;
      const nextScrollTop = Math.max(0, lineIndex * 24 - 72);

      editor.focus();
      editor.setSelectionRange(handlerIndex, handlerIndex + pendingHandlerFocus.length);
      editor.scrollTop = nextScrollTop;
      setSourceScroll({ top: editor.scrollTop, left: editor.scrollLeft });
      setPendingHandlerFocus(null);
    });
  }, [activeFile?.language, normalizedSourceCode, pendingHandlerFocus]);

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
    if (/^(如果|如果真|如果结束|判断|判断结束|判断循环首|判断循环尾|循环判断首|循环判断尾|计次循环首|计次循环尾|变量循环首|变量循环尾|枚举循环首|循环尾)$/.test(token)) {
      return <span key={index} className="text-[#4ea5ff] font-semibold">{token}</span>;
    }
    if (/^(信息框|调试输出|输出调试文本|载入可视化设计|读取配置项|取运行目录|结束|返回)$/.test(token)) {
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

    const tokenPattern = /('.*$|“[^”]*”|"[^"]*"|\.(?:版本|支持库|程序集变量|程序集|子程序|局部变量)|如果真|如果结束|如果|判断循环首|判断循环尾|循环判断首|循环判断尾|计次循环首|计次循环尾|变量循环首|变量循环尾|枚举循环首|判断结束|判断|循环尾|信息框|调试输出|输出调试文本|载入可视化设计|读取配置项|取运行目录|结束|返回|文本型|整数型|逻辑型|小数型|双精度小数型|字节集|日期时间型|窗口程序集_[\w\u4e00-\u9fa5]+|_[\w\u4e00-\u9fa5]+_[\w\u4e00-\u9fa5_]+|\d+|[＝=＋+\-*/（）(),，])/g;
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
      const regex = /('.*)|(".*?")|(\.(?:版本|支持库|程序集|程序集变量|子程序|局部变量)|如果真|如果结束|如果|判断循环首|判断循环尾|循环判断首|循环判断尾|计次循环首|计次循环尾|变量循环首|变量循环尾|枚举循环首|判断结束|判断|循环尾|结束|返回|信息框|调试输出|载入可视化设计|读取配置项|取运行目录)/g;
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
            if (/^(\.(?:版本|支持库|程序集|程序集变量|子程序|局部变量)|如果真|如果结束|如果|判断循环首|判断循环尾|循环判断首|循环判断尾|计次循环首|计次循环尾|变量循环首|变量循环尾|枚举循环首|判断结束|判断|循环尾|结束|返回|信息框|调试输出|载入可视化设计|读取配置项|取运行目录)$/.test(part)) {
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

  if (activeView === 'designer') {
    return (
      <div id="diff-window-host" className={`flex-1 flex flex-col overflow-hidden ${
        isDarkMode ? 'bg-[#141418]' : 'bg-white'
      }`}>
        {/* Document Tab Bar */}
        <div className={`flex px-1.5 shrink-0 select-none items-center justify-between border-b ${
          isDarkMode ? 'bg-[#16161c] border-[#2d2d34]' : 'bg-slate-100 border-slate-200'
        }`}>
          <div className="flex">
            <button
              onClick={() => setActiveView('code')}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold border-t-2 border-transparent cursor-pointer transition-all ${
                isDarkMode 
                  ? 'text-slate-400 hover:bg-[#25252b] hover:text-slate-200' 
                  : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <Code className="w-3.5 h-3.5 text-blue-500" />
              <span>中文代码编辑器</span>
            </button>
            <button
              onClick={() => setActiveView('designer')}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] border-t-2 font-bold cursor-pointer transition-all ${
                isDarkMode 
                  ? 'bg-[#141418] border-amber-500 text-white' 
                  : 'bg-white border-amber-500 text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-amber-500" />
              <span>可视化 UI 界面设计器</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-normal border ${
                isDarkMode 
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}>
                内置核心
              </span>
            </button>
          </div>
          <div className="text-[10px] text-slate-500 font-mono pr-3 hidden md:block">
            自主高精度可视化渲染引擎 • 全部支持中文化变量
          </div>
        </div>
        <WpfDesigner isDarkMode={isDarkMode} />
      </div>
    );
  }

  return (
    <div id="diff-window-host" className={`flex-1 flex flex-col overflow-hidden ${
      isDarkMode ? 'bg-[#141418]' : 'bg-white'
    }`}>
      {/* Document Tab Bar */}
      <div className={`flex px-1.5 shrink-0 select-none items-center justify-between border-b ${
        isDarkMode ? 'bg-[#16161c] border-[#2d2d34]' : 'bg-slate-100 border-slate-200'
      }`}>
        <div className="flex">
          <button
            onClick={() => setActiveView('code')}
            className={`flex items-center gap-1.5 px-4 py-2 text-[11px] border-t-2 font-bold cursor-pointer transition-all ${
              isDarkMode 
                ? 'bg-[#141418] border-blue-500 text-white' 
                : 'bg-white border-blue-600 text-slate-900'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-blue-500" />
            <span>中文代码编辑器</span>
          </button>
          <button
            onClick={() => setActiveView('designer')}
            className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold border-t-2 border-transparent cursor-pointer transition-all ${
              isDarkMode 
                ? 'text-slate-400 hover:bg-[#25252b] hover:text-slate-200' 
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-amber-500" />
            <span>可视化 UI 界面设计器</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-normal border ${
              isDarkMode 
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              内置核心
            </span>
          </button>
        </div>
        <div className="text-[10px] text-slate-500 font-mono pr-3 hidden md:block">
          自主高精度可视化渲染引擎 • 全部支持中文化变量
        </div>
      </div>

      {/* Statistics Banner */}
      <div className={`px-4 py-1.5 border-b flex gap-4 text-xs font-mono shrink-0 select-none ${
        isDarkMode ? 'bg-[#18181c]/50 border-[#2d2d34] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-650'
      }`}>
        <span>对比统计：</span>
        <span className="text-emerald-500 font-bold">+{diffResult.stats.added} 插入</span>
        <span className="text-rose-500 font-bold">-{diffResult.stats.deleted} 移除</span>
        <span className="text-amber-500 font-bold">~{diffResult.stats.modified} 修改</span>
        <span>({diffResult.stats.unchanged} 行未改动)</span>
      </div>

      {/* Main Comparative Frame */}
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
                  中文代码主编辑器
                </span>
                <span className={`text-[10px] truncate font-mono ${
                  isDarkMode ? 'text-slate-500' : 'text-slate-500'
                }`}>
                  {activeFile?.path || '未命名中文源码'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                  activeFile?.isModified
                    ? isDarkMode
                      ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                    : isDarkMode
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}>
                  {activeFile?.isModified ? '已修改' : '已同步'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 max-w-[70%]">
                {quickChineseSnippets.map(snippet => (
                  <button
                    key={snippet.label}
                    type="button"
                    onClick={() => insertSourceSnippet(snippet.text)}
                    disabled={!onUpdateSourceContent}
                    title={`插入 ${snippet.label}`}
                    className={`px-2 py-1 text-[10.5px] rounded border font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition-colors whitespace-nowrap ${
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

            {activeFile?.language === 'epl' ? (
              <EplStructuredEditor
                sourceCode={normalizedSourceCode}
                isDarkMode={isDarkMode}
                readOnly={!onUpdateSourceContent}
                onChange={updateSourceCode}
                focusHandlerName={pendingHandlerFocus}
                onFocusHandled={() => setPendingHandlerFocus(null)}
                editorFontSize={editorFontSize}
                onFontSizeChange={onFontSizeChange}
              />
            ) : (
              <div className={`flex-1 flex overflow-hidden ${
                isDarkMode ? 'bg-[#1e1e1e]' : 'bg-white'
              }`}>
                <div
                  ref={sourceLineNumberRef}
                  aria-hidden="true"
                  className={`w-14 shrink-0 overflow-hidden border-r text-right select-none ${
                    isDarkMode ? 'bg-[#19191f] border-[#2d2d34] text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <div
                    className="py-3"
                    style={{ transform: `translateY(${-sourceScroll.top}px)` }}
                  >
                    {sourceLineNumbers.map(lineNumber => (
                      <div key={lineNumber} className="h-6 leading-6 pr-3 text-[12px] font-mono tabular-nums">
                        {lineNumber}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="relative flex-1 min-w-0 h-full overflow-hidden">
                  <pre
                    aria-hidden="true"
                    className="absolute inset-0 pointer-events-none overflow-hidden m-0 px-4 py-3 text-[13px] leading-6 font-mono tabular-nums"
                    style={{
                      fontFamily: '"Microsoft YaHei UI", "Cascadia Code", Consolas, monospace',
                      fontSize: `${editorFontSize}px`,
                      lineHeight: `${Math.max(18, Math.round(editorFontSize * 1.55))}px`,
                      transform: `translate(${-sourceScroll.left}px, ${-sourceScroll.top}px)`
                    }}
                  >
                    {sourceHighlightLines.map((line, lineIndex) => {
                      const visualLine = eplVisualLines[lineIndex];
                      return (
                        <div key={`${lineIndex}-${line}`} className="relative h-6 leading-6 whitespace-pre">
                          {visualLine ? renderEplFlowGuides(visualLine.guides) : null}
                          <span className="relative z-10">
                            {renderHighlightedSourceLine(line, lineIndex, visualLine)}
                          </span>
                        </div>
                      );
                    })}
                  </pre>
                  <textarea
                    ref={sourceEditorRef}
                    value={normalizedSourceCode}
                    onChange={event => updateSourceCode(event.target.value)}
                    onKeyDown={handleSourceKeyDown}
                    onScroll={handleSourceScroll}
                    readOnly={!onUpdateSourceContent}
                    spellCheck={false}
                    wrap="off"
                    aria-label="中文代码编辑器"
                    className={`absolute inset-0 w-full h-full resize-none overflow-auto border-0 outline-none px-4 py-3 text-[13px] leading-6 font-mono tabular-nums bg-transparent text-transparent selection:bg-blue-500/35 ${
                      isDarkMode ? 'caret-[#0bbdff]' : 'caret-blue-700'
                    }`}
                    style={{
                      fontFamily: '"Microsoft YaHei UI", "Cascadia Code", Consolas, monospace',
                      fontSize: `${editorFontSize}px`,
                      lineHeight: `${Math.max(18, Math.round(editorFontSize * 1.55))}px`
                    }}
                  />
                </div>
              </div>
            )}
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
    </div>
  );
}
