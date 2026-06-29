import React, { useRef, useEffect, useState } from 'react';
import { Split, Eye, ChevronUp, ChevronDown, Sparkles, Undo2, Check, Search, Settings, Code, LayoutGrid } from 'lucide-react';
import { DiffLine, DiffResult, ExtractedString } from '../types';
import WpfDesigner from './WpfDesigner';

interface DiffViewerProps {
  diffResult: DiffResult;
  strings: ExtractedString[];
  onUpdateStringTranslation: (id: string, value: string) => void;
  onResetTranslation: (id: string) => void;
  isDarkMode: boolean;
  activeFile?: any;
}

// Diff Contrast Presets for customized developer visibility
type DiffPreset = 'vs-dark' | 'neon-high-contrast' | 'cyberpunk' | 'solarized-dark' | 'classic-light';

export default function DiffViewer({
  diffResult,
  strings,
  onUpdateStringTranslation,
  onResetTranslation,
  isDarkMode,
  activeFile
}: DiffViewerProps) {
  const [activeView, setActiveView] = useState<'code' | 'designer'>('code');
  const [viewMode, setViewMode] = useState<'chinese' | 'split' | 'unified'>('chinese');
  const [preset, setPreset] = useState<DiffPreset>(isDarkMode ? 'vs-dark' : 'classic-light');
  const [showConfig, setShowConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [editingStringId, setEditingStringId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [showFolds, setShowFolds] = useState(true);

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const unifiedScrollRef = useRef<HTMLDivElement>(null);

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

  // Search logic
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const matches: number[] = [];
    diffResult.originalLines.forEach((line, idx) => {
      const matchInOrig = line.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchInTran = diffResult.translatedLines[idx]?.content.toLowerCase().includes(searchQuery.toLowerCase());
      if (matchInOrig || matchInTran) {
        matches.push(idx);
      }
    });

    setSearchMatches(matches);
    if (matches.length > 0) {
      setCurrentMatchIndex(0);
      scrollToLine(matches[0]);
    } else {
      setCurrentMatchIndex(-1);
    }
  };

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIdx);
    scrollToLine(searchMatches[nextIdx]);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIdx);
    scrollToLine(searchMatches[prevIdx]);
  };

  const scrollToLine = (lineIdx: number) => {
    const elId = `diff-line-${lineIdx}`;
    const el = document.getElementById(elId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

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

  // C++ and EPL syntax coloring helper for increased legibility
  const renderSyntax = (text: string) => {
    if (!text) return <span>{text}</span>;

    if (activeFile?.language === 'epl') {
      // EPL syntax coloring
      const regex = /('.*)|(".*?")|(\.(?:版本|支持库|程序集|程序集变量|子程序|局部变量)|如果结束|如果|结束|返回|信息框|调试输出|载入可视化设计|读取配置项|取运行目录)/g;
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
            if (/^(\.(?:版本|支持库|程序集|程序集变量|子程序|局部变量)|如果结束|如果|结束|返回|信息框|调试输出|载入可视化设计|读取配置项|取运行目录)$/.test(part)) {
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

      {/* Visual Studio style document tab & toolbar */}
      <div className={`border-b flex flex-wrap items-center justify-between px-3 py-1.5 gap-2 shrink-0 ${
        isDarkMode ? 'bg-[#18181c] border-[#2d2d34]' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${
            isDarkMode ? 'text-slate-300' : 'text-slate-700'
          }`}>
            <Split className="w-3.5 h-3.5 text-blue-500" />
            <span>视图模式：</span>
          </div>

          {/* Toggle Chinese / Split / Unified */}
          <div className={`flex rounded-md p-0.5 border ${
            isDarkMode ? 'bg-[#25252b] border-[#2d2d34]' : 'bg-slate-200/60 border-slate-300'
          }`}>
            <button
              onClick={() => setViewMode('chinese')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                viewMode === 'chinese'
                  ? isDarkMode ? 'bg-[#3b3b45] text-white' : 'bg-white text-slate-900 shadow-sm'
                  : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>仅中文源码</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                viewMode === 'split'
                  ? isDarkMode ? 'bg-[#3b3b45] text-white' : 'bg-white text-slate-900 shadow-sm'
                  : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>双栏对比</span>
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                viewMode === 'unified'
                  ? isDarkMode ? 'bg-[#3b3b45] text-white' : 'bg-white text-slate-900 shadow-sm'
                  : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>单栏混合</span>
            </button>
          </div>

          {/* Fold Toggle */}
          <button
            onClick={() => setShowFolds(!showFolds)}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded border cursor-pointer transition-all ${
              showFolds
                ? isDarkMode ? 'bg-[#2563eb]/10 border-blue-500/30 text-blue-300 hover:bg-blue-600/15' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 shadow-sm'
                : isDarkMode ? 'bg-transparent border-[#2d2d34] text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'bg-transparent border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>{showFolds ? '折叠未修改' : '显示完整代码'}</span>
          </button>
        </div>

        {/* Action Controls & Contrast presets */}
        <div className="flex items-center gap-3">
          {/* Quick Search inside diff */}
          <form onSubmit={handleSearch} className="flex items-center relative">
            <input
              type="text"
              placeholder="搜索对比代码..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`border rounded pl-8 pr-16 py-1 text-xs focus:outline-none focus:border-blue-500 w-44 ${
                isDarkMode 
                  ? 'bg-[#24242b] border-[#2d2d34] text-slate-200' 
                  : 'bg-white border-slate-300 text-slate-850'
              }`}
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
            {searchMatches.length > 0 && (
              <div className="flex items-center gap-1 absolute right-2">
                <span className="text-[10px] text-slate-500 font-mono">
                  {currentMatchIndex + 1}/{searchMatches.length}
                </span>
                <button
                  type="button"
                  onClick={handlePrevMatch}
                  className={`p-0.5 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMatch}
                  className={`p-0.5 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            )}
          </form>

          {/* Diff Contrast Preset Config */}
          <div className="relative">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`p-1.5 rounded transition-colors cursor-pointer border ${
                isDarkMode 
                  ? 'bg-transparent border-[#2d2d34] text-slate-400 hover:text-white hover:bg-[#25252b]' 
                  : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-sm'
              }`}
              title="修改高亮对比配色"
            >
              <Settings className="w-4 h-4" />
            </button>
            {showConfig && (
              <div className={`absolute right-0 mt-2 w-56 rounded-md shadow-xl p-3 z-50 border ${
                isDarkMode ? 'bg-[#1e1e24] border-[#2d2d34]' : 'bg-white border-slate-200'
              }`}>
                <span className={`text-[11px] font-semibold block mb-2 uppercase tracking-wider ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  差异对比高亮配色主题
                </span>
                <div className="space-y-1">
                  {(['vs-dark', 'neon-high-contrast', 'cyberpunk', 'solarized-dark', 'classic-light'] as DiffPreset[]).map(
                    p => (
                      <button
                        key={p}
                        onClick={() => {
                          setPreset(p);
                          setShowConfig(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                          preset === p 
                            ? 'bg-blue-600 text-white font-medium shadow-sm' 
                            : isDarkMode ? 'text-slate-400 hover:bg-[#25252b]' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="capitalize">{p.replace('-', ' ')}</span>
                        {preset === p && <Check className="w-3.5 h-3.5" />}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
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
          // ================= CHINESE ONLY VIEW (Single Column) =================
          <div className="flex-1 overflow-auto scrollbar-thin select-text">
            <div className="min-w-max p-4 pr-10">
              <div className="text-[10px] font-bold text-slate-500 mb-2 uppercase select-none flex items-center justify-between font-sans">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                  <span className={`${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} font-semibold`}>中文代码主编辑器</span>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded font-mono border ${
                  isDarkMode 
                    ? 'bg-[#25252b] text-slate-400 border-slate-700/50' 
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  双击代码行即可进行手动汉化微调
                </span>
              </div>
              {diffResult.translatedLines.map((line, idx) => {
                if (foldedIndices.has(idx)) return null;

                if (foldingHeaderMap.has(idx)) {
                  const fold = foldingHeaderMap.get(idx)!;
                  return (
                    <div
                      key={`fold-c-${idx}`}
                      onClick={() => setShowFolds(false)}
                      className={`py-1.5 px-4 my-2 text-xs font-mono rounded border border-dashed transition-all cursor-pointer select-none flex items-center gap-2 justify-center w-full ${
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

                const mappedString = getStringForLine(line.lineNumber);
                const isHovered = hoveredLine === idx;

                return (
                  <div
                    key={`tran-c-${idx}`}
                    onMouseEnter={() => setHoveredLine(idx)}
                    onMouseLeave={() => setHoveredLine(null)}
                    onDoubleClick={() => handleStartEdit(line.lineNumber)}
                    className={`flex group items-stretch transition-colors h-6 relative ${
                      line.type === 'added'
                        ? style.added
                        : line.type === 'modified'
                        ? style.modified
                        : isDarkMode ? 'hover:bg-slate-800/10' : 'hover:bg-slate-100/40'
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
