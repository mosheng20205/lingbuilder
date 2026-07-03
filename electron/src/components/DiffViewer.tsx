import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Sparkles, Undo2, Check, Code, LayoutGrid, FileCode, FileText, X, ListTree, PanelRightClose, GraduationCap, Lightbulb, ClipboardList, Wand2, PlayCircle, Pencil, Save, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';

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
import { AppliedWorkspaceFile, DiffLine, DiffResult, ExtractedString, ProblemItem, WorkspaceEditProposal } from '../types';
import WpfDesigner from './WpfDesigner';
import MonacoCodeEditor from './MonacoCodeEditor';
import { buildLingCppLanguageContext, getLingCppReadableBlocks, getLingCppStructuredRows, getLingCppStructureView } from '../services/lingCpp/languageService';
import { LingCppAstEdit, LingCppMethod, LingCppParameter, LingCppReadableBlock, LingCppReadingMode, LingCppStructuredReadingRow, LingCppStructureNode } from '../services/lingCpp/types';
import { applyLingCppAstEdit } from '../services/lingCpp/astEditService';
import { LingWindowProject } from '../services/windowDesigner/types';
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
  editorExperienceMode?: EditorExperienceMode;
  onExperienceModeChange?: (mode: EditorExperienceMode) => void;
  problems?: ProblemItem[];
  ignoredBeginnerTaskIds?: string[];
  onIgnoreBeginnerTask?: (taskId: string) => void;
  onApplyWorkspaceEdit?: (proposal: WorkspaceEditProposal, appliedFiles: AppliedWorkspaceFile[]) => void;
  onOpenProblemsPanel?: () => void;
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

export default function DiffViewer({
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
  editorExperienceMode = 'beginner',
  onExperienceModeChange,
  problems = [],
  ignoredBeginnerTaskIds = [],
  onIgnoreBeginnerTask,
  onApplyWorkspaceEdit,
  onOpenProblemsPanel
}: DiffViewerProps) {
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





  const [viewMode, setViewMode] = useState<'chinese' | 'split' | 'unified'>('chinese');
  const [preset, setPreset] = useState<DiffPreset>(isDarkMode ? 'vs-dark' : 'classic-light');
  const searchQuery: string = '';
  const [editingStringId, setEditingStringId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [showFolds, setShowFolds] = useState(true);
  const [showLingCppStructure, setShowLingCppStructure] = useState(true);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [selectedBeginnerHandler, setSelectedBeginnerHandler] = useState<string | null>(null);
  const [selectedBeginnerCodeTarget, setSelectedBeginnerCodeTarget] = useState<{ className?: string; methodName: string } | null>(null);
  const [collapsedVolcanoSections, setCollapsedVolcanoSections] = useState<string[]>([]);
  const [readingMode, setReadingMode] = useState<LingCppReadingMode>(editorExperienceMode === 'beginner' ? 'beginner' : 'off');
  const [focusedReadableBlockId, setFocusedReadableBlockId] = useState<string | undefined>();
  const [structureEditDraft, setStructureEditDraft] = useState<StructureEditDraft | null>(null);
  const [structureEditError, setStructureEditError] = useState<string | null>(null);
  const [newMemberDraft, setNewMemberDraft] = useState({ type: '文本型', name: '', initialValue: '' });
  const [newEventDraft, setNewEventDraft] = useState({ handlerName: '', parameters: '' });
  const [newFunctionDraft, setNewFunctionDraft] = useState({ returnType: '空', name: '', parameters: '' });
  const [newParameterDrafts, setNewParameterDrafts] = useState<Record<string, { type: string; name: string }>>({});
  const [sourceScroll, setSourceScroll] = useState({ top: 0, left: 0 });
  const [pendingHandlerFocus, setPendingHandlerFocus] = useState<string | null>(null);

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
    setSelectedBeginnerCodeTarget(null);
  }, [activeFile?.path]);

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const unifiedScrollRef = useRef<HTMLDivElement>(null);
  const sourceEditorRef = useRef<HTMLTextAreaElement>(null);
  const sourceLineNumberRef = useRef<HTMLDivElement>(null);

  const sourceCode = activeFile?.isModified || activeFile?.translatedContent
    ? activeFile?.translatedContent ?? ''
    : activeFile?.originalContent || diffResult.translatedLines.map(line => line.content).join('\n');
  const normalizedSourceCode = activeFile?.language === 'epl' ? optimizeEplName(sourceCode) : sourceCode;
  const lingCppStructure = useMemo(
    () => activeFile?.language === 'lingcpp'
      ? getLingCppStructureView(normalizedSourceCode, designerProject, activeFile?.path)
      : [],
    [activeFile?.language, activeFile?.path, designerProject, normalizedSourceCode]
  );
  const readableBlocks = useMemo(
    () => activeFile?.language === 'lingcpp'
      ? getLingCppReadableBlocks(normalizedSourceCode, designerProject, activeFile?.path)
      : [],
    [activeFile?.language, activeFile?.path, designerProject, normalizedSourceCode]
  );
  const lingCppLanguageContext = useMemo(
    () => activeFile?.language === 'lingcpp'
      ? buildLingCppLanguageContext(normalizedSourceCode, designerProject, undefined, activeFile?.path)
      : null,
    [activeFile?.language, activeFile?.path, designerProject, normalizedSourceCode]
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
      ? getBeginnerTasks(normalizedSourceCode, designerProject, activeFile?.path, ignoredBeginnerTaskIds)
      : [],
    [activeFile?.language, activeFile?.path, designerProject, ignoredBeginnerTaskIds, normalizedSourceCode]
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
  const isLingCppBeginnerStructureMode = activeFile?.language === 'lingcpp' && editorExperienceMode === 'beginner';
  const sourceLineNumbers = useMemo(() => {
    const lineCount = Math.max(1, normalizedSourceCode.split('\n').length);
    return Array.from({ length: lineCount }, (_, index) => index + 1);
  }, [normalizedSourceCode]);
  const sourceHighlightLines = useMemo(() => normalizedSourceCode.split('\n'), [normalizedSourceCode]);
  const eplVisualLines = useMemo(() => {
    return activeFile?.language === 'epl' ? buildEplVisualLines(sourceHighlightLines) : [];
  }, [activeFile?.language, sourceHighlightLines]);

  const quickChineseSnippets = activeFile?.language === 'lingcpp' ? [
    { label: '类', text: '\n类 新窗口 : 公开 窗体\n公开:\n    构造()\n        调试输出("初始化完成")\n结束类\n' },
    { label: '事件', text: '    事件 按钮1_被单击()\n        信息框("提示内容", 64, "提示")\n' },
    { label: '如果', text: '如果 (条件)\n    \n如果结束' },
    { label: '返回', text: '返回' },
    { label: '信息框', text: '信息框("提示内容", 64, "提示")' },
    { label: '调试输出', text: '调试输出("调试信息")' }
  ] : [
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

      if (activeFile?.name?.endsWith('.xml')) {
        const codeFileName = activeFile.name.replace(/\.xml$/i, '.lcpp');
        const codeFile = allFiles.find(f => f.name === codeFileName);
        if (codeFile) onSelectTab(codeFile);
      }
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
      setViewType('designer');
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

  const formatParameterDraft = (parameters?: LingCppParameter[]) =>
    (parameters || []).map(parameter => `${parameter.type} ${parameter.name}`.trim()).join(', ');

  const parseParameterDraft = (value: string): LingCppParameter[] =>
    value
      .split(/[,，]/u)
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [type, ...nameParts] = part.split(/\s+/u).filter(Boolean);
        const name = nameParts.join('');
        return {
          type: name ? type : '对象',
          name: name || type
        };
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
        : undefined;
    if (!edit) return;
    const label = row.editKind === 'member' ? '成员变量' : '事件处理器';
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
    | 'method-name'
    | 'method-return'
    | 'method-parameters'
    | 'event-handler'
    | 'event-parameters';

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
      field === 'method-name' ? row.targetName || row.name :
      field === 'method-return' ? row.returnType || row.type || '空' :
      field === 'method-parameters' ? currentParameters :
      field === 'event-handler' ? row.targetName || row.name :
      field === 'event-parameters' ? currentParameters :
      '';

    if (nextValue === currentValue) return;

    const requiredField = field !== 'member-initial' && field !== 'class-base' && field !== 'method-parameters' && field !== 'event-parameters';
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
                initialValue: field === 'member-initial' ? nextValue || undefined : row.initialValue || undefined
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

  const directInputClasses = (tone: 'plain' | 'type' | 'name' | 'value' = 'plain') => {
    const toneClass =
      tone === 'type'
        ? isDarkMode ? 'font-semibold text-blue-300' : 'font-semibold text-blue-700'
        : tone === 'name'
          ? isDarkMode ? 'font-semibold text-slate-100' : 'font-semibold text-slate-900'
          : tone === 'value'
            ? isDarkMode ? 'text-emerald-300' : 'text-emerald-700'
            : isDarkMode ? 'text-slate-300' : 'text-slate-700';
    return `h-6 min-w-0 rounded border px-1.5 text-[11px] outline-none transition-colors ${
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
    tone: 'plain' | 'type' | 'name' | 'value' = 'plain'
  ) => (
    <input
      key={`${row.id}:${field}:${value}`}
      defaultValue={value}
      placeholder={placeholder}
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

  const commitNewMemberDraft = (patch: Partial<typeof newMemberDraft> = {}) => {
    const draft = { ...newMemberDraft, ...patch };
    setNewMemberDraft(draft);
    const name = draft.name.trim();
    const type = draft.type.trim();
    if (!name) return;
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
        initialValue: draft.initialValue.trim() || undefined
      }
    }]);
    if (applied) setNewMemberDraft({ type: '文本型', name: '', initialValue: '' });
  };

  const renderNewMemberInput = (
    field: keyof typeof newMemberDraft,
    placeholder: string,
    tone: 'plain' | 'type' | 'name' | 'value' = 'plain'
  ) => (
    <input
      value={newMemberDraft[field]}
      placeholder={placeholder}
      disabled={!onUpdateSourceContent || !primaryLingCppClass}
      onChange={event => setNewMemberDraft(current => ({ ...current, [field]: event.target.value }))}
      onBlur={event => commitNewMemberDraft({ [field]: event.currentTarget.value })}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setNewMemberDraft({ type: '文本型', name: '', initialValue: '' });
          event.currentTarget.blur();
        }
      }}
      className={`${directInputClasses(tone)} disabled:cursor-not-allowed disabled:opacity-40`}
      title="输入名称后自动新增成员"
    />
  );

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
    if (applied) setNewEventDraft({ handlerName: '', parameters: '' });
  };

  const renderNewEventInput = (
    field: keyof typeof newEventDraft,
    placeholder: string,
    tone: 'plain' | 'type' | 'name' | 'value' = 'plain'
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
    }
  };

  const renderNewFunctionInput = (
    field: keyof typeof newFunctionDraft,
    placeholder: string,
    tone: 'plain' | 'type' | 'name' | 'value' = 'plain'
  ) => (
    <input
      value={newFunctionDraft[field]}
      placeholder={placeholder}
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

  const commitBeginnerCodeBody = (
    className: string | undefined,
    methodName: string,
    currentBody: string,
    nextBody: string
  ) => {
    const normalizedNext = nextBody.replace(/\s+$/u, '');
    if (normalizedNext === currentBody.replace(/\s+$/u, '')) return;
    applyStructureAstEdits([{
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
                        {renderDirectStructureInput(row, 'event-handler', row.targetName || row.name, '处理器', 'name')}
                        {renderDirectStructureInput(row, 'event-parameters', formatParameterDraft(row.parameters), '参数', 'plain')}
                      </div>
                    ) : row.editKind === 'method' ? (
                      <div className="grid min-w-0 flex-1 grid-cols-[minmax(76px,1fr)_52px_minmax(70px,0.8fr)] gap-1.5">
                        {renderDirectStructureInput(row, 'method-name', row.targetName || row.name, '方法名', 'name')}
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
            <div className="grid min-w-0 grid-cols-[72px_minmax(86px,1fr)_64px_minmax(72px,1fr)_44px] items-center gap-2">
              <span>类型</span>
              <span>名称</span>
              <span>性质</span>
              <span>初始值</span>
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
                  className="grid min-w-0 grid-cols-[72px_minmax(86px,1fr)_64px_minmax(72px,1fr)_44px] items-center gap-2 text-left"
                  title={`${row.name} - 第 ${row.line} 行`}
                >
                  {renderDirectStructureInput(row, 'member-type', row.type || '', '类型', 'type')}
                  {renderDirectStructureInput(row, 'member-name', row.targetName || row.name, '名称', 'name')}
                  <span className={`truncate text-[10px] ${controlMember ? 'text-blue-400' : isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{kindLabel}</span>
                  {renderDirectStructureInput(row, 'member-initial', row.initialValue || '', '未设置', 'value')}
                  <span className={`text-right tabular-nums ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{row.line}</span>
                </div>
              </div>
            );
          })}
          <div className={`border-x border-b border-dashed px-2 py-1.5 text-[11px] ${
            isDarkMode ? 'border-[#30303a] bg-[#15151b]/70' : 'border-slate-200 bg-slate-50/80'
          }`}>
            <div className="grid min-w-0 grid-cols-[72px_minmax(86px,1fr)_64px_minmax(72px,1fr)_44px] items-center gap-2 text-left">
              {renderNewMemberInput('type', '类型', 'type')}
              {renderNewMemberInput('name', '输入新成员', 'name')}
              <span className={`truncate text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>新成员</span>
              {renderNewMemberInput('initialValue', '初始值', 'value')}
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
    type BeginnerCodeTarget = { className: string; method: LingCppMethod };
    const codeTargetKey = (target: BeginnerCodeTarget) =>
      `${target.className}:${target.method.name}:${target.method.line}`;
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
        parameters?: LingCppParameter[];
        note?: string;
      }
    ) => {
      const nextName = patch.name?.trim();
      const nextReturnType = patch.returnType?.trim();
      const nextParameters = patch.parameters ?? target.method.parameters;
      const edit: LingCppAstEdit = target.method.kind === 'event'
        ? {
            kind: 'update-event',
            className: target.className,
            handlerName: target.method.name,
            newHandlerName: nextName || target.method.name,
            parameters: nextParameters,
            note: patch.note?.trim() || undefined
          }
        : {
            kind: 'update-method-signature',
            className: target.className,
            methodName: target.method.name,
            newName: nextName || target.method.name,
            returnType: nextReturnType || target.method.returnType || '空',
            parameters: nextParameters,
            note: patch.note?.trim() || undefined
          };
      const applied = applyStructureAstEdits([edit], target.method.line);
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
      if (!nextValue) {
        setStructureEditError('参数名和参数类型不能为空。');
        return;
      }
      const currentParameter = target.method.parameters[index];
      if (!currentParameter || currentParameter[field] === nextValue) return;
      const nextParameters = target.method.parameters.map((parameter, parameterIndex) =>
        parameterIndex === index ? { ...parameter, [field]: nextValue } : parameter
      );
      applyCodeTargetSignature(target, { parameters: nextParameters });
    };
    const commitNewCodeTargetParameter = (
      target: BeginnerCodeTarget,
      patch: Partial<LingCppParameter> = {}
    ) => {
      const key = codeTargetKey(target);
      const draft = { type: '文本型', name: '', ...(newParameterDrafts[key] || {}), ...patch };
      setNewParameterDrafts(current => ({ ...current, [key]: draft }));
      const name = draft.name.trim();
      if (!name) return;
      const type = draft.type.trim() || '对象';
      const applied = applyCodeTargetSignature(target, {
        parameters: [...target.method.parameters, { type, name }]
      });
      if (applied) {
        setNewParameterDrafts(current => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
    };

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
        document.getElementById(sectionDomId(id))?.scrollIntoView({ block: 'start', behavior: 'smooth' });
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

    const textTone = (tone: 'plain' | 'type' | 'name' | 'value' | 'muted' = 'plain') => {
      if (tone === 'type') return isDarkMode ? 'font-semibold text-blue-300' : 'font-semibold text-blue-700';
      if (tone === 'name') return isDarkMode ? 'font-semibold text-slate-100' : 'font-semibold text-slate-900';
      if (tone === 'value') return isDarkMode ? 'text-emerald-300' : 'text-emerald-700';
      if (tone === 'muted') return isDarkMode ? 'text-slate-500' : 'text-slate-500';
      return isDarkMode ? 'text-slate-300' : 'text-slate-700';
    };

    const renderTextCell = (value?: string | number, tone: 'plain' | 'type' | 'name' | 'value' | 'muted' = 'plain') => (
      <span className={`block min-w-0 truncate ${textTone(tone)}`} title={value ? String(value) : undefined}>
        {value || <span className={textTone('muted')}>-</span>}
      </span>
    );

    const defaultFunctionArgument = (parameter: LingCppParameter) => {
      if (/文本/u.test(parameter.type)) return '"文本"';
      if (/逻辑/u.test(parameter.type)) return '真';
      if (/小数|双精度/u.test(parameter.type)) return '0.0';
      if (/整数|长整数/u.test(parameter.type)) return '0';
      return parameter.name || parameter.type || '参数';
    };

    const formatFunctionCall = (name: string, parameters?: LingCppParameter[]) =>
      `${name}(${(parameters || []).map(defaultFunctionArgument).join(', ')})`;

    const renderParameterSummary = (parameters?: LingCppParameter[]) => {
      if (!parameters || parameters.length === 0) return renderTextCell('无参数', 'muted');
      return (
        <div className="grid gap-1">
          {parameters.map((parameter, index) => (
            <div
              key={`${parameter.name}:${parameter.type}:${index}`}
              className={`grid min-w-0 grid-cols-[minmax(72px,1fr)_minmax(72px,1fr)] gap-2 rounded px-1.5 py-0.5 ${
                isDarkMode ? 'bg-[#111217]' : 'bg-slate-50'
              }`}
            >
              <span className={`truncate font-semibold ${textTone('name')}`}>{parameter.name}</span>
              <span className={`truncate ${textTone('type')}`}>{parameter.type}</span>
            </div>
          ))}
        </div>
      );
    };

    const renderCodeTargetFieldInput = (
      target: BeginnerCodeTarget,
      field: 'name' | 'returnType',
      value: string,
      placeholder: string,
      tone: 'plain' | 'type' | 'name' | 'value' = 'plain',
      editable = true
    ) => (
      <input
        key={`${codeTargetKey(target)}:${field}:${value}`}
        defaultValue={value}
        placeholder={placeholder}
        readOnly={!onUpdateSourceContent || !editable}
        onBlur={event => {
          const nextValue = event.currentTarget.value.trim();
          if (nextValue === value) return;
          if (!nextValue) {
            setStructureEditError(field === 'name' ? '功能名不能为空。' : '返回值类型不能为空。');
            event.currentTarget.value = value;
            return;
          }
          applyCodeTargetSignature(target, field === 'name' ? { name: nextValue } : { returnType: nextValue });
        }}
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

    const renderParameterInput = (
      target: BeginnerCodeTarget,
      index: number,
      field: keyof LingCppParameter,
      value: string,
      placeholder: string,
      tone: 'plain' | 'type' | 'name' | 'value' = 'plain'
    ) => (
      <input
        key={`${codeTargetKey(target)}:parameter:${index}:${field}:${value}`}
        defaultValue={value}
        placeholder={placeholder}
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
      tone: 'plain' | 'type' | 'name' | 'value' = 'plain'
    ) => {
      const key = codeTargetKey(target);
      const draft = { type: '文本型', name: '', ...(newParameterDrafts[key] || {}) };
      return (
        <input
          value={draft[field]}
          placeholder={placeholder}
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

      return (
        <div className={`border-b ${isDarkMode ? 'border-[#2b2d34]' : 'border-slate-200'}`}>
          <table className={`w-full min-w-[560px] border-b text-left ${tableChrome}`}>
            <thead>
              <tr>
                <th className={`${headCellClass} w-[220px]`}>方法名</th>
                <th className={`${headCellClass} w-[120px]`}>返回值类型</th>
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
                    ? renderCodeTargetFieldInput(target, 'name', target.method.name, '方法名', 'name')
                    : renderTextCell(target.method.name, 'name')}
                </td>
                <td className={cellClass}>
                  {canEditReturnType
                    ? renderCodeTargetFieldInput(target, 'returnType', target.method.returnType || '空', '返回值', 'type')
                    : renderTextCell(target.method.returnType || '空', 'type')}
                </td>
                <td className={cellClass}>{renderTextCell(row?.access || target.method.access, 'plain')}</td>
                <td className={cellClass}>{renderTextCell(kindLabel, 'type')}</td>
                <td className={`${cellClass} text-right tabular-nums`}>{renderTextCell(target.method.line, 'muted')}</td>
                <td className={cellClass}>{renderTextCell(row?.note, 'muted')}</td>
              </tr>
            </tbody>
          </table>
          <table className={`w-full min-w-[560px] border-b text-left ${tableChrome}`}>
            <thead>
              <tr>
                <th className={`${headCellClass} w-[180px]`}>参数名</th>
                <th className={`${headCellClass} w-[140px]`}>类型</th>
                <th className={`${headCellClass} w-[70px]`}>参考</th>
                <th className={`${headCellClass} w-[70px]`}>可空</th>
                <th className={`${headCellClass} w-[70px]`}>数组</th>
                <th className={headCellClass}>备注</th>
              </tr>
            </thead>
            <tbody>
              {target.method.parameters.map((parameter, index) => (
                <tr key={`${codeTargetKey(target)}:parameter:${index}`} className={rowChrome(row)}>
                  <td className={cellClass}>{renderParameterInput(target, index, 'name', parameter.name, '参数名', 'name')}</td>
                  <td className={cellClass}>{renderParameterInput(target, index, 'type', parameter.type, '类型', 'type')}</td>
                  <td className={cellClass}>{renderTextCell('否', 'muted')}</td>
                  <td className={cellClass}>{renderTextCell('否', 'muted')}</td>
                  <td className={cellClass}>{renderTextCell('否', 'muted')}</td>
                  <td className={cellClass}>{renderTextCell('', 'muted')}</td>
                </tr>
              ))}
              <tr className={isDarkMode ? 'bg-[#121318]' : 'bg-slate-50'}>
                <td className={cellClass}>{renderNewParameterInput(target, 'name', '输入参数名', 'name')}</td>
                <td className={cellClass}>{renderNewParameterInput(target, 'type', '文本型', 'type')}</td>
                <td className={cellClass}>{renderTextCell('否', 'muted')}</td>
                <td className={cellClass}>{renderTextCell('否', 'muted')}</td>
                <td className={cellClass}>{renderTextCell('否', 'muted')}</td>
                <td className={cellClass}>{renderTextCell('新参数', 'muted')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    };

    const renderCodeBodyEditor = (target: BeginnerCodeTarget, compact = false) => {
      const bodyText = methodBodyText(target.method);
      const bodyLines = bodyText.split('\n').length ? bodyText.split('\n') : [''];
      const editorHeightClass = compact ? 'min-h-[170px]' : 'min-h-[230px]';

      return (
        <>
          <div className={`grid grid-cols-[54px_minmax(0,1fr)] border-b text-[10px] font-semibold ${
            isDarkMode ? 'border-[#2b2d34] bg-[#111217] text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-500'
          }`}>
            <div className="border-r px-2 py-1.5 text-right">行</div>
            <div className="px-2 py-1.5">中文 / C++ 代码</div>
          </div>
          <div className={`grid ${editorHeightClass} grid-cols-[54px_minmax(0,1fr)]`}>
            <div className={`select-none border-r px-2 py-2 text-right text-[11px] leading-6 tabular-nums ${
              isDarkMode ? 'border-[#2b2d34] bg-[#111217] text-slate-600' : 'border-slate-200 bg-slate-50 text-slate-400'
            }`}>
              {bodyLines.map((_, index) => (
                <div key={index}>{index + 1}</div>
              ))}
            </div>
            <textarea
              key={`${target.className}:${target.method.name}:${target.method.line}:${bodyText}:${compact ? 'inline' : 'section'}`}
              defaultValue={bodyText}
              spellCheck={false}
              readOnly={!onUpdateSourceContent}
              placeholder="输入中文代码，@ 后面写原生 C++"
              onBlur={event => commitBeginnerCodeBody(
                target.className,
                target.method.name,
                methodBodyText(target.method),
                event.currentTarget.value
              )}
              onKeyDown={event => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Tab') {
                  event.preventDefault();
                  const input = event.currentTarget;
                  const start = input.selectionStart;
                  const end = input.selectionEnd;
                  const nextValue = `${input.value.slice(0, start)}    ${input.value.slice(end)}`;
                  input.value = nextValue;
                  input.selectionStart = input.selectionEnd = start + 4;
                }
              }}
              className={`${editorHeightClass} w-full resize-y border-0 bg-transparent px-3 py-2 font-mono text-[12px] leading-6 outline-none ${
                isDarkMode
                  ? 'text-slate-100 placeholder:text-slate-600 focus:bg-[#111118]'
                  : 'text-slate-900 placeholder:text-slate-400 focus:bg-white'
              }`}
            />
          </div>
        </>
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
            <tr key={row.id} onDoubleClick={() => revealStructuredRow(row)} className={rowChrome(row)}>
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
            <tr key={row.id} onDoubleClick={() => revealStructuredRow(row)} className={rowChrome(row)}>
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
            <th className={`${headCellClass} w-[110px]`}>性质</th>
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
              <tr key={row.id} onDoubleClick={() => revealStructuredRow(row)} className={rowChrome(row)}>
                <td className={cellClass}>{renderDirectStructureInput(row, 'member-type', row.type || '', '类型', 'type')}</td>
                <td className={cellClass}>{renderDirectStructureInput(row, 'member-name', row.targetName || row.name, '名称', 'name')}</td>
                <td className={cellClass}>{renderTextCell(kindLabel, controlMember ? 'type' : 'muted')}</td>
                <td className={cellClass}>{renderDirectStructureInput(row, 'member-initial', row.initialValue || '', '未设置', 'value')}</td>
                <td className={`${cellClass} text-right tabular-nums`}>{renderTextCell(row.line, 'muted')}</td>
                <td className={cellClass}>{renderTextCell(row.note, 'muted')}</td>
              </tr>
            );
          })}
          {primaryLingCppClass && (
            <tr className={isDarkMode ? 'bg-[#121318]' : 'bg-slate-50'}>
              <td className={cellClass}>{renderNewMemberInput('type', '类型', 'type')}</td>
              <td className={cellClass}>{renderNewMemberInput('name', '输入新成员', 'name')}</td>
              <td className={cellClass}>{renderTextCell('新成员', 'muted')}</td>
              <td className={cellClass}>{renderNewMemberInput('initialValue', '初始值', 'value')}</td>
              <td className={`${cellClass} text-right`}>{renderTextCell('新', 'muted')}</td>
              <td className={cellClass}>{renderTextCell('输入名称后自动写回源码', 'muted')}</td>
            </tr>
          )}
        </tbody>
      </table>
    );

    const generateMissingDesignerEvent = (row: LingCppStructuredReadingRow) => {
      const handlerName = row.targetName || row.name;
      const className = row.className || primaryLingCppClass?.name;
      if (!handlerName || !className) {
        setStructureEditError('当前源码里还没有可绑定事件的类。');
        return;
      }
      const applied = applyStructureAstEdits([{
        kind: 'add-event',
        className,
        event: {
          handlerName,
          parameters: row.parameters || [],
          note: row.note || '由设计器事件自动生成'
        }
      }], row.line);
      if (applied) {
        setSelectedBeginnerHandler(handlerName);
        setSelectedBeginnerCodeTarget({ className, methodName: handlerName });
        scrollToStructureSection('code');
      }
    };

    const renderEventTable = (rows: LingCppStructuredReadingRow[]) => {
      const allRows = [...rows, ...pendingEventRows];
      return renderSectionFrame(
        'event',
        '事件处理器',
        allRows.length + (primaryLingCppClass ? 1 : 0),
        '控件事件、窗口事件和绑定状态',
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
            {allRows.map(row => (
              <tr
                key={row.id}
                onClick={() => {
                  if (row.editKind === 'event' && row.targetName) {
                    setSelectedBeginnerCodeTarget({ className: row.className, methodName: row.targetName });
                    setSelectedBeginnerHandler(row.targetName);
                    scrollToStructureSection('code');
                    return;
                  }
                  if (row.editKind === 'missing-event' || row.status === 'missing-source') {
                    generateMissingDesignerEvent(row);
                  }
                }}
                onDoubleClick={() => revealStructuredRow(row)}
                className={`${rowChrome(row)} cursor-pointer`}
              >
                <td className={cellClass}>{renderTextCell(row.type || row.name, 'type')}</td>
                <td className={cellClass}>{renderDirectStructureInput(row, 'event-handler', row.targetName || row.name, '处理器', 'name')}</td>
                <td className={cellClass}>{renderStatusCell(row)}</td>
                <td className={cellClass}>{renderDirectStructureInput(row, 'event-parameters', formatParameterDraft(row.parameters), '参数', 'plain')}</td>
                <td className={`${cellClass} text-right tabular-nums`}>{renderTextCell(row.line, 'muted')}</td>
                <td className={cellClass}>{renderTextCell(row.note, 'muted')}</td>
              </tr>
            ))}
            {primaryLingCppClass && (
              <tr className={isDarkMode ? 'bg-[#121318]' : 'bg-slate-50'}>
                <td className={cellClass}>{renderTextCell('自定义事件', 'type')}</td>
                <td className={cellClass}>{renderNewEventInput('handlerName', '输入处理器名', 'name')}</td>
                <td className={cellClass}>{renderTextCell('新事件', 'muted')}</td>
                <td className={cellClass}>{renderNewEventInput('parameters', '参数', 'plain')}</td>
                <td className={`${cellClass} text-right`}>{renderTextCell('新', 'muted')}</td>
                <td className={cellClass}>{renderTextCell('输入处理器名后自动写回源码', 'muted')}</td>
              </tr>
            )}
          </tbody>
        </table>
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
                    ? renderDirectStructureInput(row, 'method-name', row.targetName || row.name, '方法名', 'name')
                    : renderTextCell(row.targetName || row.name, 'name')}
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
            const selected = Boolean(
              target &&
              activeCodeTarget?.method.kind === 'method' &&
              activeCodeTarget.className === target.className &&
              activeCodeTarget.method.name === target.method.name
            );

            return (
              <React.Fragment key={row.id}>
                <tr
                  onClick={() => {
                    if (row.targetName) {
                      setSelectedBeginnerCodeTarget({ className: row.className, methodName: row.targetName });
                    }
                  }}
                  onDoubleClick={() => revealStructuredRow(row)}
                  className={`${selected ? isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-50' : rowChrome(row)} cursor-pointer`}
                  title="单击后在下方直接编写功能代码"
                >
                  <td className={cellClass}>{renderDirectStructureInput(row, 'method-return', row.returnType || row.type || '空', '返回值', 'type')}</td>
                  <td className={cellClass}>{renderDirectStructureInput(row, 'method-name', row.targetName || row.name, '功能名', 'name')}</td>
                  <td className={cellClass}>{renderParameterSummary(row.parameters)}</td>
                  <td className={cellClass}>{renderTextCell(formatFunctionCall(row.targetName || row.name, row.parameters), 'value')}</td>
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
              <td className={cellClass}>{renderNewFunctionInput('name', '输入功能名', 'name')}</td>
              <td className={cellClass}>{renderNewFunctionInput('parameters', '文本型 文本, 整数型 次数', 'plain')}</td>
              <td className={cellClass}>{renderTextCell('功能名("文本", 0)', 'muted')}</td>
              <td className={`${cellClass} text-right`}>{renderTextCell('新', 'muted')}</td>
              <td className={cellClass}>{renderTextCell('输入功能名后自动新增', 'muted')}</td>
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
              {activeCodeTarget.method.kind === 'event' && functionTargets.length > 0 && (
                <div className={`flex min-h-[34px] items-center gap-2 border-b px-2 ${
                  isDarkMode ? 'border-[#2b2d34] bg-[#121318]' : 'border-slate-200 bg-slate-50'
                }`}>
                  <span className={`shrink-0 text-[10px] font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>调用功能</span>
                  <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                    {functionTargets.map(target => (
                      <button
                        key={`${target.className}:${target.method.name}:call`}
                        type="button"
                        onClick={() => {
                          const currentBody = methodBodyText(activeCodeTarget.method);
                          const callText = formatFunctionCall(target.method.name, target.method.parameters);
                          const nextBody = currentBody.trim()
                            ? `${currentBody}\n${callText}`
                            : callText;
                          commitBeginnerCodeBody(
                            activeCodeTarget.className,
                            activeCodeTarget.method.name,
                            currentBody,
                            nextBody
                          );
                        }}
                        className={`max-w-[220px] shrink-0 truncate rounded border px-2 py-1 text-[10px] font-semibold transition-colors ${
                          isDarkMode
                            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                        title={`向当前事件追加：${formatFunctionCall(target.method.name, target.method.parameters)}`}
                      >
                        {formatFunctionCall(target.method.name, target.method.parameters)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className={`grid grid-cols-[54px_minmax(0,1fr)] border-b text-[10px] font-semibold ${
                isDarkMode ? 'border-[#2b2d34] bg-[#111217] text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}>
                <div className="border-r px-2 py-1.5 text-right">行</div>
                <div className="px-2 py-1.5">中文 / C++ 代码</div>
              </div>
              <div className="grid min-h-[230px] grid-cols-[54px_minmax(0,1fr)]">
                <div className={`select-none border-r px-2 py-2 text-right text-[11px] leading-6 tabular-nums ${
                  isDarkMode ? 'border-[#2b2d34] bg-[#111217] text-slate-600' : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}>
                  {(methodBodyText(activeCodeTarget.method).split('\n').length ? methodBodyText(activeCodeTarget.method).split('\n') : ['']).map((_, index) => (
                    <div key={index}>{index + 1}</div>
                  ))}
                </div>
                <textarea
                  key={`${activeCodeTarget.className}:${activeCodeTarget.method.name}:${activeCodeTarget.method.line}:${methodBodyText(activeCodeTarget.method)}`}
                  defaultValue={methodBodyText(activeCodeTarget.method)}
                  spellCheck={false}
                  readOnly={!onUpdateSourceContent}
                  placeholder="输入中文代码，@ 后面写原生 C++"
                  onBlur={event => commitBeginnerCodeBody(
                    activeCodeTarget.className,
                    activeCodeTarget.method.name,
                    methodBodyText(activeCodeTarget.method),
                    event.currentTarget.value
                  )}
                  onKeyDown={event => {
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Tab') {
                      event.preventDefault();
                      const target = event.currentTarget;
                      const start = target.selectionStart;
                      const end = target.selectionEnd;
                      const nextValue = `${target.value.slice(0, start)}    ${target.value.slice(end)}`;
                      target.value = nextValue;
                      target.selectionStart = target.selectionEnd = start + 4;
                    }
                  }}
                  className={`min-h-[230px] w-full resize-none border-0 bg-transparent px-3 py-2 font-mono text-[12px] leading-6 outline-none ${
                    isDarkMode
                      ? 'text-slate-100 placeholder:text-slate-600 focus:bg-[#111118]'
                      : 'text-slate-900 placeholder:text-slate-400 focus:bg-white'
                  }`}
                />
              </div>
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

    const sections = [
      { id: 'class', label: '类', count: classRows.length, render: () => renderClassTable(classRows), visible: classRows.length > 0 },
      { id: 'code', label: '代码', count: codeTargets.length, render: renderCodeEditorSection, visible: codeTargets.length > 0 },
      { id: 'function', label: '功能', count: functionRows.length + (primaryLingCppClass ? 1 : 0), render: () => renderFunctionTable(functionRows), visible: functionRows.length > 0 || Boolean(primaryLingCppClass) },
      { id: 'member', label: '成员', count: memberRows.length + (primaryLingCppClass ? 1 : 0), render: () => renderMemberTable(memberRows), visible: memberRows.length > 0 || Boolean(primaryLingCppClass) },
      { id: 'event', label: '事件', count: eventRows.length + pendingEventRows.length + (primaryLingCppClass ? 1 : 0), render: () => renderEventTable(eventRows), visible: eventRows.length > 0 || pendingEventRows.length > 0 || Boolean(primaryLingCppClass) },
      { id: 'method', label: '初始化', count: lifecycleRows.length, render: () => renderMethodTable(lifecycleRows), visible: lifecycleRows.length > 0 },
      { id: 'declaration', label: '声明', count: declarationRows.length, render: () => renderDeclarationTable(declarationRows), visible: declarationRows.length > 0 },
      { id: 'other', label: '备注', count: otherRows.length, render: () => renderOtherTable(otherRows), visible: otherRows.length > 0 }
    ].filter(section => section.visible);

    return (
      <div className="flex h-full min-h-0">
        <aside className={`hidden w-[118px] shrink-0 flex-col border-r md:flex ${
          isDarkMode ? 'border-[#2b2d34] bg-[#121318]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className={`border-b px-3 py-2 text-[10px] font-semibold ${
            isDarkMode ? 'border-[#2b2d34] text-slate-500' : 'border-slate-200 text-slate-500'
          }`}>结构</div>
          <div className="min-h-0 flex-1 overflow-auto py-1">
            {sections.map(section => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToStructureSection(section.id)}
                className={`flex w-full items-center justify-between gap-2 border-l-2 px-3 py-2 text-left text-[11px] transition-colors ${
                  isDarkMode
                    ? 'border-transparent text-slate-400 hover:border-cyan-500/60 hover:bg-[#1b1c22] hover:text-slate-100'
                    : 'border-transparent text-slate-600 hover:border-cyan-500 hover:bg-white hover:text-slate-950'
                }`}
              >
                <span className="truncate font-semibold">{section.label}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                  isDarkMode ? 'bg-[#23252d] text-slate-400' : 'bg-white text-slate-500'
                }`}>{section.count}</span>
              </button>
            ))}
          </div>
        </aside>
        <div className="min-w-0 flex-1 overflow-auto">
          <div className="min-w-[760px]">
            {sections.map(section => (
              <React.Fragment key={section.id}>{section.render()}</React.Fragment>
            ))}
          </div>
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

  const renderLingCppStructureTableEditor = () => (
    <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${
      isDarkMode ? 'bg-[#18181f]' : 'bg-white'
    }`}>
      <div className={`h-9 px-3 flex items-center justify-between gap-2 border-b shrink-0 ${
        isDarkMode ? 'border-[#2d2d34] bg-[#18181f]' : 'border-slate-200 bg-white'
      }`}>
        <div className="flex min-w-0 items-center gap-2">
          <ListTree className="w-3.5 h-3.5 text-cyan-400" />
          <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>结构编辑器</span>
          <span className="text-[10px] text-slate-500">{structuredReadingRows.length}</span>
          {pendingStructureEventCount > 0 && (
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
              isDarkMode ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
            }`}>待生成 {pendingStructureEventCount}</span>
          )}
        </div>
        <div className={`truncate text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
          {activeFile?.path || activeFile?.name || '当前中文源码'}
        </div>
      </div>
      {structureEditError && (
        <div className={`border-b px-3 py-2 text-[11px] ${
          isDarkMode ? 'border-[#2d2d34] bg-rose-950/20 text-rose-200' : 'border-rose-100 bg-rose-50 text-rose-700'
        }`}>
          {structureEditError}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        {structuredReadingRows.length > 0 ? renderVolcanoStructuredRows() : (
          <div className="p-4 text-center text-xs text-slate-500">暂无结构信息</div>
        )}
      </div>
    </div>
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
    <aside className={`hidden xl:flex w-[360px] shrink-0 flex-col border-l ${
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
        <button
          type="button"
          onClick={() => onExperienceModeChange?.('professional')}
          className={`rounded border px-2 py-1 text-[10px] font-semibold ${
            isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          专业模式
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 space-y-3">
        {renderBeginnerStructuredReadingSection()}

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
            onClick={() => {
              if (activeBeginnerHandler) {
                applyBeginnerAction('调试输出', createAction('debug-output', '调试输出', { text: '事件已触发' }));
              }
            }}
            disabled={!activeBeginnerHandler}
            className={`rounded border px-2.5 py-2 text-left disabled:opacity-50 ${
              isDarkMode ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              <Wand2 className="h-3.5 w-3.5" />
              <span>事件动作块</span>
            </div>
            <div className="mt-1 truncate text-[10px] opacity-80">{activeBeginnerHandler || '先选择一个事件处理器'}</div>
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



  return (
    <div id="diff-window-host" className={`flex-1 flex flex-col overflow-hidden ${
      isDarkMode ? 'bg-[#141418]' : 'bg-white'
    }`}>
      {/* File Tabs Bar */}
      <div className={`flex px-2 pt-1 select-none items-center justify-between border-b ${
        isDarkMode ? 'bg-[#181820] border-[#2d2d34]' : 'bg-slate-100 border-slate-200'
      }`}>
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {openTabs.map(tabPath => {
            const fileName = tabPath.split('/').pop() || tabPath;
            const isActive = tabPath === activeTabPath;
            const file = allFiles.find(f => f.path === tabPath);
            if (!file) return null;

            return (
              <div
                key={tabPath}
                onClick={() => onSelectTab(file)}
                className={`group flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold rounded-t cursor-pointer transition-all border-t border-x ${
                  isActive
                    ? isDarkMode
                      ? 'bg-[#1e1e24] border-[#2d2d34] text-white border-b-transparent'
                      : 'bg-white border-slate-300 text-slate-900 border-b-transparent'
                    : isDarkMode
                      ? 'bg-[#141418] border-transparent text-slate-400 hover:text-slate-200'
                      : 'bg-slate-200/50 border-transparent text-slate-600 hover:text-slate-800'
                }`}
              >
                <FileIcon fileName={fileName} isDarkMode={isDarkMode} />
                <span>{fileName}</span>
                <button
                  onClick={(e) => onCloseTab(tabPath, e)}
                  className="w-3.5 h-3.5 rounded-full hover:bg-slate-400/20 flex items-center justify-center text-slate-500 hover:text-red-500 opacity-60 group-hover:opacity-100"
                >
                  <X className="w-2 h-2" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Top-Right Quick Toggle Button between Code/Designer */}
        <div className="flex items-center gap-2 pr-2">
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
      {activeFile?.name?.endsWith('.lcpp') && viewType === 'designer' ? (
        <WpfDesigner isDarkMode={isDarkMode} activeFile={activeFile} />
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
                {activeFile?.language === 'lingcpp' && (
                  <div className={`flex rounded border p-0.5 ${
                    isDarkMode ? 'bg-[#25252b] border-[#343442]' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <button
                      type="button"
                      onClick={() => onExperienceModeChange?.('beginner')}
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
                      className={`px-2 py-0.5 text-[10px] rounded font-semibold ${
                        editorExperienceMode === 'professional'
                          ? isDarkMode ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
                          : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      专业
                    </button>
                  </div>
                )}
                {activeFile?.language === 'lingcpp' && !isLingCppBeginnerStructureMode && (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('lingcpp-format-document', { detail: { filePath: activeFile?.path } }))}
                    title="整理成易读格式"
                    className={`px-2 py-1 text-[10.5px] rounded border font-semibold cursor-pointer transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
                      isDarkMode
                        ? 'bg-[#25252b] border-[#343442] text-slate-300 hover:text-white hover:bg-[#30303a]'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                    }`}
                  >
                    <ListTree className="w-3 h-3" />
                    <span>整理</span>
                  </button>
                )}
                {!isLingCppBeginnerStructureMode && quickChineseSnippets.map(snippet => (
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

            <div className="flex-1 min-h-0 flex overflow-hidden">
              {isLingCppBeginnerStructureMode ? (
                renderLingCppStructureTableEditor()
              ) : (
                <MonacoCodeEditor
                  sourceCode={normalizedSourceCode}
                  language={activeFile?.language || 'plaintext'}
                  isDarkMode={isDarkMode}
                  readOnly={!onUpdateSourceContent}
                  onChange={updateSourceCode}
                  focusHandlerName={pendingHandlerFocus}
                  onFocusHandled={() => setPendingHandlerFocus(null)}
                  editorFontSize={editorFontSize}
                  onFontSizeChange={onFontSizeChange}
                  filePath={activeFile?.path}
                  designerProject={designerProject}
                  onRevealDesignerBinding={() => setViewType('designer')}
                  onCursorPositionChange={setCursorPosition}
                  readingMode={activeFile?.language === 'lingcpp' ? readingMode : 'off'}
                  focusedBlockId={focusedReadableBlockId}
                  onRevealReadableBlock={setFocusedReadableBlockId}
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
}
