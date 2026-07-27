import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { 
  Terminal, 
  AlertTriangle, 
  Info, 
  ListCollapse, 
  CheckCircle2, 
  ChevronRight, 
  CornerDownRight,
  Play,
  Square,
  RefreshCw,
  Bug,
  Sliders,
  Cpu,
  Eye,
  Copy,
  Trash
} from 'lucide-react';
import { BottomPanelTabType, CommandHintContent, ExtractedString, ProblemItem } from '../types';
import type { ModuleHintContent } from '../services/modules/types';
import TerminalPanel from './TerminalPanel';
import DebugInspector from './DebugInspector';
import TestExplorer from './TestExplorer';
import { countErrorListProblems, formatProblemsForClipboard } from '../services/problems/problemClipboard';

type LogContextMenuTab = 'problems' | 'output' | 'debug_logs';

function extractLocalPathFromLogLine(line: string): string | null {
  const match = line.match(/(?:[A-Za-z]:[\\/]|\\\\)[^\r\n]+/u);
  if (!match) return null;
  const targetPath = match[0].trim().replace(/[。；;,，]+$/u, '');
  return targetPath || null;
}

interface BottomPanelProps {
  strings: ExtractedString[];
  problems: ProblemItem[];
  buildLogs: string[];
  debugLogs: string[];
  onSelectLine: (lineNum: number) => void;
  onSelectProblem?: (problem: ProblemItem) => void;
  onUpdateStringTranslation: (id: string, value: string) => void;
  onSetStatus: (id: string, status: 'translated' | 'skipped' | 'pending') => void;
  isDarkMode?: boolean;
  activeTab: BottomPanelTabType;
  onActiveTabChange: (tab: BottomPanelTabType) => void;
  showCodeMapping: boolean;
  moduleHint: ModuleHintContent | null;
  commandHint: CommandHintContent | null;
  height: number;
  onClearLogs?: (tab: string) => void;
}

export default function BottomPanel({
  strings,
  problems,
  buildLogs,
  debugLogs,
  onSelectLine,
  onSelectProblem,
  onUpdateStringTranslation,
  onSetStatus,
  isDarkMode = true,
  activeTab,
  onActiveTabChange,
  showCodeMapping,
  moduleHint,
  commandHint,
  height,
  onClearLogs
}: BottomPanelProps) {
  const [filterType, setFilterType] = useState<'all' | 'string' | 'comment'>('all');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const logViewportRef = useRef<HTMLDivElement | null>(null);
  const [copyNotice, setCopyNotice] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    tabType: LogContextMenuTab | null;
    lineText: string | null;
  }>({ show: false, x: 0, y: 0, tabType: null, lineText: null });

  useEffect(() => {
    const handleClose = () => {
      setContextMenu(prev => prev.show ? { ...prev, show: false } : prev);
    };
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  useEffect(() => {
    if (!copyNotice) return undefined;
    const timer = window.setTimeout(() => setCopyNotice(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copyNotice]);

  useLayoutEffect(() => {
    if (activeTab !== 'output') return;
    const viewport = logViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'auto' });
    const frame = window.requestAnimationFrame(() => {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, buildLogs.length]);

  useEffect(() => {
    if (!showCodeMapping && activeTab === 'extracted') {
      onActiveTabChange('output');
    }
  }, [activeTab, onActiveTabChange, showCodeMapping]);

  const getLogsText = (tabType: LogContextMenuTab) => {
    if (tabType === 'problems') {
      return formatProblemsForClipboard(problems);
    }
    if (tabType === 'output') {
      return buildLogs.length > 0 ? buildLogs.join('\n') : '> [输出] 空';
    }
    return debugLogs.length > 0 ? debugLogs.join('\n') : '> [调试输出] 空';
  };

  const copyLogsToClipboard = (tabType: LogContextMenuTab) => {
    const logsText = getLogsText(tabType);
    navigator.clipboard.writeText(logsText)
      .then(() => setCopyNotice({
        message: tabType === 'problems' ? `已复制全部 ${problems.length} 条诊断到剪贴板` : '已复制全部日志到剪贴板',
        tone: 'success'
      }))
      .catch(() => setCopyNotice({ message: '复制失败，请重试', tone: 'error' }));
  };

  const copyLineToClipboard = (lineText: string) => {
    navigator.clipboard.writeText(lineText)
      .then(() => setCopyNotice({ message: '已复制当前行到剪贴板', tone: 'success' }))
      .catch(() => setCopyNotice({ message: '复制失败，请重试', tone: 'error' }));
  };

  const revealLogPath = async (lineText: string) => {
    const targetPath = extractLocalPathFromLogLine(lineText);
    if (!targetPath) return;
    const revealWorkspacePath = window.lingBuilder?.shell?.revealWorkspacePath;
    if (!revealWorkspacePath) {
      setCopyNotice({ message: '请在 LingBuilder 桌面版中打开生成目录', tone: 'error' });
      return;
    }
    try {
      const error = await revealWorkspacePath(targetPath);
      setCopyNotice(error
        ? { message: error, tone: 'error' }
        : { message: '已在文件资源管理器中定位', tone: 'success' });
    } catch {
      setCopyNotice({ message: '无法在文件资源管理器中定位该路径', tone: 'error' });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, tabType: LogContextMenuTab, lineText: string | null = null) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const menuWidth = 160;
    const menuHeight = tabType === 'problems' ? 76 : 112;
    setContextMenu({
      show: true,
      x: Math.max(4, Math.min(x, rect.width - menuWidth - 4)),
      y: Math.max(4, Math.min(y, rect.height - menuHeight - 4)),
      tabType,
      lineText
    });
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');


  const filteredStrings = strings.filter(s => {
    if (filterType === 'all') return true;
    return s.type === filterType;
  });
  const errorListProblemCount = countErrorListProblems(problems);

  const handleStartEdit = (s: ExtractedString) => {
    setEditingId(s.id);
    setEditVal(s.translated || s.original);
  };

  const handleSaveEdit = (id: string) => {
    onUpdateStringTranslation(id, editVal);
    setEditingId(null);
  };

  // Dispatch global keystrokes to control active App compilation and debug simulator
  const triggerDebugStart = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5' }));
    onActiveTabChange('output');
  };

  const triggerDebugStop = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', shiftKey: true }));
    onActiveTabChange('output');
  };

  const triggerRebuild = () => {
    // Custom simulated rebuild action
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', shiftKey: true }));
    setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5' }));
    }, 400);
    onActiveTabChange('output');
  };


  return (
    <div 
      ref={panelRef}
      id="vs-bottom-tabs" 
      className={`flex flex-col font-sans overflow-hidden shrink-0 select-none border-t relative ${
        isDarkMode 
          ? 'bg-[#1E1E1E] border-[#181818]' 
          : 'bg-white border-slate-300'
      }`}
      style={{ height }}
    >
      {copyNotice && (
        <div
          role="status"
          className={`pointer-events-none absolute right-4 top-11 z-[1000] flex items-center gap-2 rounded border px-3 py-2 text-[11px] font-semibold shadow-xl ${
            copyNotice.tone === 'success'
              ? isDarkMode
                ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-200 shadow-black/40'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-slate-300/50'
              : isDarkMode
                ? 'border-rose-500/30 bg-rose-950/90 text-rose-200 shadow-black/40'
                : 'border-rose-200 bg-rose-50 text-rose-700 shadow-slate-300/50'
          }`}
        >
          {copyNotice.tone === 'success'
            ? <CheckCircle2 className="h-3.5 w-3.5" />
            : <AlertTriangle className="h-3.5 w-3.5" />}
          <span>{copyNotice.message}</span>
        </div>
      )}

      {/* Visual Studio Classic Tab Headers with Complete Debugging and Building controllers */}
      <div 
        className={`flex items-center justify-between px-4 shrink-0 h-9 border-b ${
          isDarkMode ? 'border-[#181818] bg-[#252526]' : 'border-slate-300 bg-[#EEEEEE]'
        }`}
      >
        
        {/* Left Side: Standard VS Panels Tabs */}
        <div className="flex min-w-0 flex-1 gap-1 h-full items-end overflow-x-auto scrollbar-none flex-nowrap">
          {showCodeMapping && (
            <button
              onClick={() => onActiveTabChange('extracted')}
              className={`h-8 px-3 text-[11px] font-semibold relative cursor-pointer flex items-center gap-1.5 transition-colors border-t border-x whitespace-nowrap shrink-0 ${
                activeTab === 'extracted'
                  ? isDarkMode
                    ? 'text-white bg-[#1E1E1E] border-[#2d2d30] border-b-transparent z-10'
                    : 'text-slate-900 bg-white border-slate-300 border-b-transparent z-10'
                  : isDarkMode
                    ? 'text-slate-400 hover:text-slate-200 bg-transparent border-transparent'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/40 bg-transparent border-transparent'
              }`}
            >
              <ListCollapse className="w-3.5 h-3.5 text-blue-500" />
              <span>中文代码映射表 ({strings.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onActiveTabChange('module_hint')}
            className={`h-8 px-3 text-[11px] font-semibold relative cursor-pointer flex items-center gap-1.5 transition-colors border-t border-x whitespace-nowrap shrink-0 ${
              activeTab === 'module_hint'
                ? isDarkMode
                  ? 'text-white bg-[#1E1E1E] border-[#2d2d30] border-b-transparent z-10'
                  : 'text-slate-900 bg-white border-slate-300 border-b-transparent z-10'
                : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 bg-transparent border-transparent'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/40 bg-transparent border-transparent'
            }`}
            aria-label="提示"
            title={commandHint?.signature || (moduleHint ? `${moduleHint.kind} · ${moduleHint.title}` : '查看命令和模块提示')}
          >
            <Info className="w-3.5 h-3.5 text-sky-500" />
            <span>提示</span>
          </button>

          <button
            onClick={() => onActiveTabChange('problems')}
            className={`h-8 px-3 text-[11px] font-semibold relative cursor-pointer flex items-center gap-1.5 transition-colors border-t border-x whitespace-nowrap shrink-0 ${
              activeTab === 'problems' 
                ? isDarkMode
                  ? 'text-white bg-[#1E1E1E] border-[#2d2d30] border-b-transparent z-10' 
                  : 'text-slate-900 bg-white border-slate-300 border-b-transparent z-10'
                : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 bg-transparent border-transparent'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/40 bg-transparent border-transparent'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${errorListProblemCount > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`} />
            <span>错误列表 ({errorListProblemCount})</span>
          </button>

          <button
            onClick={() => onActiveTabChange('output')}
            className={`h-8 px-3 text-[11px] font-semibold relative cursor-pointer flex items-center gap-1.5 transition-colors border-t border-x whitespace-nowrap shrink-0 ${
              activeTab === 'output' 
                ? isDarkMode
                  ? 'text-white bg-[#1E1E1E] border-[#2d2d30] border-b-transparent z-10' 
                  : 'text-slate-900 bg-white border-slate-300 border-b-transparent z-10'
                : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 bg-transparent border-transparent'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/40 bg-transparent border-transparent'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-500" />
            <span>输出窗口 (Output) - 编译与生成</span>
          </button>

          <button
            onClick={() => onActiveTabChange('terminal')}
            className={`h-8 px-3 text-[11px] font-semibold relative cursor-pointer flex items-center gap-1.5 transition-colors border-t border-x whitespace-nowrap shrink-0 ${activeTab === 'terminal' ? isDarkMode ? 'text-white bg-[#1E1E1E] border-[#2d2d30]' : 'text-slate-900 bg-white border-slate-300' : isDarkMode ? 'text-slate-400 hover:text-slate-200 border-transparent' : 'text-slate-600 hover:text-slate-800 border-transparent'}`}
          >
            <Terminal className="w-3.5 h-3.5 text-sky-500" /><span>终端</span>
          </button>

          <button onClick={() => onActiveTabChange('tests')} className={`h-8 px-3 text-[11px] font-semibold relative cursor-pointer flex items-center gap-1.5 transition-colors border-t border-x whitespace-nowrap shrink-0 ${activeTab === 'tests' ? isDarkMode ? 'text-white bg-[#1E1E1E] border-[#2d2d30]' : 'text-slate-900 bg-white border-slate-300' : isDarkMode ? 'text-slate-400 hover:text-slate-200 border-transparent' : 'text-slate-600 hover:text-slate-800 border-transparent'}`}><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span>测试</span></button>

          <button
            onClick={() => onActiveTabChange('debug_logs')}
            className={`h-8 px-3 text-[11px] font-semibold relative cursor-pointer flex items-center gap-1.5 transition-colors border-t border-x whitespace-nowrap shrink-0 ${
              activeTab === 'debug_logs' 
                ? isDarkMode
                  ? 'text-white bg-[#1E1E1E] border-[#2d2d30] border-b-transparent z-10' 
                  : 'text-slate-900 bg-white border-slate-300 border-b-transparent z-10'
                : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 bg-transparent border-transparent'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/40 bg-transparent border-transparent'
            }`}
          >
            <Bug className="w-3.5 h-3.5 text-amber-500" />
            <span>调试日志</span>
          </button>

          <button
            onClick={() => onActiveTabChange('debug_locals')}
            className={`h-8 px-3 text-[11px] font-semibold relative cursor-pointer flex items-center gap-1.5 transition-colors border-t border-x whitespace-nowrap shrink-0 ${
              activeTab === 'debug_locals' 
                ? isDarkMode
                  ? 'text-white bg-[#1E1E1E] border-[#2d2d30] border-b-transparent z-10' 
                  : 'text-slate-900 bg-white border-slate-300 border-b-transparent z-10'
                : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 bg-transparent border-transparent'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/40 bg-transparent border-transparent'
            }`}
          >
            <Bug className="w-3.5 h-3.5 text-amber-500" />
            <span>局部变量 / 监视 / 调用栈</span>
          </button>
        </div>

        {/* Copy Logs button when logs or output or debug logs is selected */}
        {(activeTab === 'problems' || activeTab === 'output' || activeTab === 'debug_logs') && (
          <button
            onClick={() => {
              copyLogsToClipboard(activeTab);
            }}
            className={`flex shrink-0 items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded border cursor-pointer transition-all ${
              isDarkMode 
                ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/30' 
                : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <Copy className="w-3 h-3" />
            <span>{activeTab === 'problems' ? '复制全部诊断' : '复制全部日志'}</span>
          </button>
        )}

        {/* Right Side: Visual Studio 2022 Debugging Toolbar Buttons */}
        <div className="flex shrink-0 items-center gap-3">
          {/* Debug/Release Selectors (Standard Visual Studio) */}
          <div 
            className={`hidden lg:flex items-center gap-1.5 border rounded px-1.5 py-0.5 text-[10px] ${
              isDarkMode ? 'bg-[#202021] border-slate-700/50 text-slate-300' : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            <Sliders className="w-3 h-3 text-slate-400" />
            <select className={`bg-transparent border-none focus:outline-none font-semibold cursor-pointer ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
              <option value="Debug" className={isDarkMode ? 'bg-[#252526] text-slate-300' : 'bg-white text-slate-800'}>调试型 (Debug)</option>
              <option value="Release" className={isDarkMode ? 'bg-[#252526] text-slate-300' : 'bg-white text-slate-800'}>发行型 (Release)</option>
            </select>
            <span className="text-slate-400">|</span>
            <Cpu className="w-3 h-3 text-slate-400" />
            <select className={`bg-transparent border-none focus:outline-none font-semibold cursor-pointer ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
              <option value="x64" className={isDarkMode ? 'bg-[#252526] text-slate-300' : 'bg-white text-slate-800'}>独占 x64 平台</option>
              <option value="x86" className={isDarkMode ? 'bg-[#252526] text-slate-300' : 'bg-white text-slate-800'}>兼容 x86 平台</option>
              <option value="Any" className={isDarkMode ? 'bg-[#252526] text-slate-300' : 'bg-white text-slate-800'}>任一 CPU (Any CPU)</option>
            </select>
          </div>

          {/* Quick Filter inside Mapping Table */}
          {showCodeMapping && activeTab === 'extracted' && (
            <div className={`flex items-center gap-1 text-[10px] border-l pl-3 ${isDarkMode ? 'border-slate-700/60' : 'border-slate-300'}`}>
              <span className="text-slate-400 font-medium">过滤:</span>
              <div className={`flex rounded p-0.5 border ${isDarkMode ? 'bg-[#37373D] border-[#181818]' : 'bg-[#E3E3E3] border-slate-300'}`}>
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer text-[9px] transition-colors ${
                    filterType === 'all' 
                      ? isDarkMode ? 'bg-[#1E1E1E] text-white font-bold' : 'bg-white text-slate-900 shadow-sm font-bold border border-slate-300/40' 
                      : 'text-slate-500'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => setFilterType('string')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer text-[9px] transition-colors ${
                    filterType === 'string' 
                      ? isDarkMode ? 'bg-[#1E1E1E] text-white font-bold' : 'bg-white text-slate-900 shadow-sm font-bold border border-slate-300/40' 
                      : 'text-slate-500'
                  }`}
                >
                  字符
                </button>
                <button
                  onClick={() => setFilterType('comment')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer text-[9px] transition-colors ${
                    filterType === 'comment' 
                      ? isDarkMode ? 'bg-[#1E1E1E] text-white font-bold' : 'bg-white text-slate-900 shadow-sm font-bold border border-slate-300/40' 
                      : 'text-slate-500'
                  }`}
                >
                  注释
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Active Tab Panel Body */}
      <div ref={logViewportRef} className={`flex-1 overflow-auto min-h-0 ${isDarkMode ? 'bg-[#1E1E1E]' : 'bg-white text-slate-800'}`}>
        {showCodeMapping && activeTab === 'extracted' && (
          // ================= EXTRACTED STRINGS PANEL =================
          <table className="w-full text-left border-collapse text-xs select-text">
            <thead>
              <tr className={`select-none ${isDarkMode ? 'bg-[#252526] border-b border-[#181818] text-slate-400' : 'bg-slate-100 border-b border-slate-200 text-slate-600'}`}>
                <th className="py-2 px-4 font-semibold w-16">行号</th>
                <th className="py-2 px-4 font-semibold w-20">类型</th>
                <th className="py-2 px-4 font-semibold w-1/3">原文 (C++ / 资源宏)</th>
                <th className="py-2 px-4 font-semibold w-1/3">易语言中文映射绑定 (Chinese Map)</th>
                <th className="py-2 px-4 font-semibold w-24">当前状态</th>
              </tr>
            </thead>
            <tbody className={`font-mono divide-y ${isDarkMode ? 'divide-[#181818]' : 'divide-slate-200'}`}>
              {filteredStrings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500 font-sans">
                    此设计文件暂无需要绑定中文代码的成员变量。
                  </td>
                </tr>
              ) : (
                filteredStrings.map(s => {
                  const isEditing = editingId === s.id;
                  return (
                    <tr
                      key={s.id}
                      className={`transition-colors group cursor-pointer text-[11px] ${
                        isDarkMode ? 'hover:bg-[#2A2D2E]' : 'hover:bg-slate-50 border-b border-slate-100'
                      }`}
                    >
                      <td
                        onClick={() => onSelectLine(s.line)}
                        className={`py-1.5 px-4 font-bold underline ${isDarkMode ? 'text-slate-500 hover:text-sky-400' : 'text-slate-400 hover:text-blue-600'}`}
                      >
                        {s.line}
                      </td>
                      <td
                        onClick={() => onSelectLine(s.line)}
                        className="py-1.5 px-4"
                      >
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            s.type === 'comment'
                              ? isDarkMode
                                ? 'bg-amber-950/40 text-amber-300 border border-amber-500/20'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                              : s.type === 'string'
                              ? isDarkMode
                                ? 'bg-[#1E3A1E] text-[#73C991] border border-[#73C991]/20'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isDarkMode
                              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/20'
                              : 'bg-teal-50 text-teal-700 border border-teal-200'
                          }`}
                        >
                          {s.type === 'comment' ? '程序注释' : s.type === 'string' ? '中文文本' : '窗体资源'}
                        </span>
                      </td>
                      <td
                        onClick={() => onSelectLine(s.line)}
                        className={`py-1.5 px-4 break-all select-text font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}
                      >
                        {s.original}
                      </td>
                      <td className="py-1.5 px-4 select-text">
                        {isEditing ? (
                          <div className="flex gap-1.5 items-center w-full">
                            <input
                              type="text"
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveEdit(s.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className={`border rounded px-2 py-0.5 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                isDarkMode ? 'bg-[#24242b] border-[#007ACC] text-white' : 'bg-white border-slate-300 text-slate-800'
                              }`}
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEdit(s.id)}
                              className="px-2 py-0.5 bg-[#007ACC] hover:bg-blue-600 text-white rounded text-[10px] font-bold cursor-pointer"
                            >
                              确定绑定
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            <span
                              onClick={() => handleStartEdit(s)}
                              className={`flex-1 min-h-5 truncate cursor-text ${
                                s.translated 
                                  ? isDarkMode ? 'text-[#73C991] font-semibold' : 'text-emerald-600 font-semibold' 
                                  : isDarkMode ? 'text-slate-500 italic font-normal' : 'text-slate-400 italic font-normal'
                              }`}
                            >
                              {s.translated || '点击在此直接改写成中文代码/绑定方法...'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-4 shrink-0 select-none">
                        <select
                          value={s.status}
                          onChange={e => onSetStatus(s.id, e.target.value as any)}
                          className={`border rounded text-[10px] py-0.5 px-1.5 focus:outline-none cursor-pointer ${
                            isDarkMode 
                              ? 'bg-[#37373D] border-[#181818] text-slate-300 focus:border-[#007ACC]' 
                              : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500'
                          }`}
                        >
                          <option value="pending" className={isDarkMode ? 'bg-[#252526] text-slate-300' : 'bg-white text-slate-800'}>原生未改</option>
                          <option value="translated" className={isDarkMode ? 'bg-[#252526] text-slate-300' : 'bg-white text-slate-800'}>中文化正常</option>
                          <option value="skipped" className={isDarkMode ? 'bg-[#252526] text-slate-300' : 'bg-white text-slate-800'}>跳过生成</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'module_hint' && commandHint && (
          <section className="h-full overflow-auto p-4 font-sans select-text" aria-live="polite" aria-label="命令提示信息">
            <div className={`mx-auto max-w-5xl overflow-hidden rounded border ${
              isDarkMode ? 'border-slate-700/70 bg-[#18181c]' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className={`flex min-w-0 items-start gap-3 border-b px-4 py-3 ${
                isDarkMode ? 'border-slate-700/60 bg-[#202024]' : 'border-slate-200 bg-white'
              }`}>
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded ${
                  isDarkMode ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-100 text-sky-700'
                }`}><Info className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className={`break-all font-mono text-sm font-semibold ${isDarkMode ? 'text-amber-200' : 'text-amber-700'}`}>
                      {commandHint.signature}
                    </h2>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                      isDarkMode ? 'border-sky-500/25 bg-sky-500/10 text-sky-300' : 'border-sky-200 bg-sky-50 text-sky-700'
                    }`}>{commandHint.returnType}</span>
                  </div>
                  <p className={`mt-1 text-xs leading-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    {commandHint.summary}
                  </p>
                </div>
              </div>

              <div className="space-y-4 p-4">
                {commandHint.returnDescription && (
                  <div className={`rounded border px-3 py-2 ${
                    isDarkMode ? 'border-sky-500/20 bg-sky-500/[0.06]' : 'border-sky-200 bg-sky-50'
                  }`}>
                    <div className={`text-[10px] font-semibold ${isDarkMode ? 'text-sky-300' : 'text-sky-700'}`}>返回值</div>
                    <div className={`mt-1 flex items-start gap-2 text-[11px] leading-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 font-semibold ${
                        isDarkMode ? 'bg-sky-500/10 text-sky-300' : 'bg-white text-sky-700'
                      }`}>{commandHint.returnType}</span>
                      <span>{commandHint.returnDescription}</span>
                    </div>
                  </div>
                )}
                <div className={`overflow-hidden rounded border ${isDarkMode ? 'border-slate-700/60' : 'border-slate-200'}`}>
                  <div className={`grid grid-cols-[minmax(80px,120px)_minmax(70px,110px)_minmax(0,1fr)] border-b px-3 py-2 text-[10px] font-semibold ${
                    isDarkMode ? 'border-slate-700/50 bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-600'
                  }`}>
                    <span>参数名</span><span>类型</span><span>说明</span>
                  </div>
                  {(commandHint.parameters.length ? commandHint.parameters : [{ name: '无', type: '-', note: '这个命令没有参数。' }]).map(parameter => (
                    <div key={`${commandHint.command}:${parameter.name}`} className={`grid grid-cols-[minmax(80px,120px)_minmax(70px,110px)_minmax(0,1fr)] border-b px-3 py-2 text-[11px] last:border-b-0 ${
                      isDarkMode ? 'border-slate-700/50' : 'border-slate-200 bg-white'
                    }`}>
                      <span className={isDarkMode ? 'text-cyan-200' : 'text-cyan-700'}>{parameter.name}</span>
                      <span className={isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}>{parameter.type}</span>
                      <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{parameter.note}</span>
                    </div>
                  ))}
                </div>
                {commandHint.example && (
                  <div>
                    <div className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>示例</div>
                    <pre className={`overflow-x-auto rounded border px-3 py-2 font-mono text-[11px] leading-5 whitespace-pre-wrap break-all ${
                      isDarkMode ? 'border-slate-700/60 bg-black/25 text-emerald-300' : 'border-slate-200 bg-white text-emerald-800'
                    }`}>{commandHint.example}</pre>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'module_hint' && !commandHint && moduleHint && (
          <section
            className="h-full overflow-auto p-4 font-sans select-text"
            aria-live="polite"
            aria-label={`${moduleHint.kind}提示信息`}
          >
            <div className={`mx-auto max-w-5xl overflow-hidden rounded border ${
              isDarkMode ? 'border-slate-700/70 bg-[#18181c]' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className={`flex min-w-0 items-start gap-3 border-b px-4 py-3 ${
                isDarkMode ? 'border-slate-700/60 bg-[#202024]' : 'border-slate-200 bg-white'
              }`}>
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded ${
                  isDarkMode ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-100 text-sky-700'
                }`}>
                  <Info className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className={`break-all text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                      {moduleHint.title}
                    </h2>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                      isDarkMode
                        ? 'border-sky-500/25 bg-sky-500/10 text-sky-300'
                        : 'border-sky-200 bg-sky-50 text-sky-700'
                    }`}>
                      {moduleHint.kind}
                    </span>
                  </div>
                  <div className={`mt-0.5 break-all text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    {moduleHint.moduleName} · {moduleHint.moduleId}
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <div className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    说明
                  </div>
                  <p className={`whitespace-pre-wrap break-words text-xs leading-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    {moduleHint.description}
                  </p>
                </div>

                {moduleHint.declaration && (
                  <div>
                    <div className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                      声明 / 标识
                    </div>
                    <pre className={`overflow-x-auto rounded border px-3 py-2 font-mono text-[11px] leading-5 whitespace-pre-wrap break-all ${
                      isDarkMode
                        ? 'border-slate-700/60 bg-black/25 text-cyan-300'
                        : 'border-slate-200 bg-white text-cyan-800'
                    }`}>
                      {moduleHint.declaration}
                    </pre>
                  </div>
                )}

                {moduleHint.fields && moduleHint.fields.length > 0 && (
                  <dl className={`grid grid-cols-[minmax(96px,160px)_minmax(0,1fr)] overflow-hidden rounded border text-[11px] ${
                    isDarkMode ? 'border-slate-700/60' : 'border-slate-200'
                  }`}>
                    {moduleHint.fields.map(field => (
                      <React.Fragment key={`${field.label}:${field.value}`}>
                        <dt className={`border-b px-3 py-2 font-semibold last:border-b-0 ${
                          isDarkMode ? 'border-slate-700/50 bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}>
                          {field.label}
                        </dt>
                        <dd className={`border-b px-3 py-2 font-mono whitespace-pre-wrap break-all last:border-b-0 ${
                          isDarkMode ? 'border-slate-700/50 text-slate-300' : 'border-slate-200 bg-white text-slate-700'
                        }`}>
                          {field.value}
                        </dd>
                      </React.Fragment>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'module_hint' && !commandHint && !moduleHint && (
          <div className="flex h-full items-center justify-center px-6 text-center font-sans text-xs text-slate-400">
            单击中文代码中的命令后，这里会显示命令说明、参数和示例。
          </div>
        )}

        {activeTab === 'problems' && (
          // ================= DIAGNOSIS Trap checklist =================
          <div
            onContextMenu={(e) => handleContextMenu(e, 'problems')}
            title="右键打开错误列表菜单"
            className="p-4 space-y-3 font-mono text-xs select-text cursor-context-menu"
          >
            {problems.length === 0 ? (
              <div className={`text-center py-10 flex flex-col items-center gap-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <span className="font-sans mt-2">错误列表未检测到任何编译障碍。C++ WPF 中文逻辑符合国家级易语言通用编译器规范。</span>
              </div>
            ) : (
              problems.map(prob => (
                <div
                  key={prob.id}
                  onClick={() => onSelectProblem ? onSelectProblem(prob) : onSelectLine(prob.line)}
                  className={`p-3 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:scale-[1.002] transition-transform ${
                    prob.level === 'error'
                      ? isDarkMode
                        ? 'bg-rose-950/15 border-rose-500/20 text-rose-300 hover:bg-rose-950/25'
                        : 'bg-rose-50/70 border-rose-200 text-rose-800 hover:bg-rose-50'
                      : prob.level === 'warning'
                      ? isDarkMode
                        ? 'bg-amber-950/15 border-amber-500/20 text-amber-300 hover:bg-amber-950/25'
                        : 'bg-amber-50/70 border-amber-200 text-amber-800 hover:bg-amber-50'
                      : isDarkMode
                      ? 'bg-blue-950/15 border-blue-500/20 text-blue-300 hover:bg-blue-950/25'
                      : 'bg-blue-50/70 border-blue-200 text-blue-800 hover:bg-blue-50'
                  }`}
                >
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          prob.level === 'error'
                            ? 'bg-red-500 text-white'
                            : prob.level === 'warning'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        {prob.level === 'error' ? '编译阻断 (Error)' : prob.level === 'warning' ? '规范缺陷 (Warning)' : '辅助信息 (Info)'}
                      </span>
                      <span className="font-semibold text-slate-400 text-[10px]">{prob.filePath}{" -> "}{prob.locationKind === 'insertion' ? '待生成事件（类末尾）' : `第 ${prob.line} 行${prob.column ? `:${prob.column}` : ''}`}{prob.code ? ` · ${prob.code}` : ''}</span>
                    </div>
                    <p className={`text-xs font-sans mt-1.5 leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{prob.message}</p>
                    <div className={`flex items-center gap-1.5 text-[11px] p-1.5 rounded border mt-1 max-w-full overflow-x-auto select-text ${
                      isDarkMode ? 'bg-black/20 border-[#2d2d34]/40 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      <CornerDownRight className="w-3 h-3 text-slate-500 shrink-0" />
                      <code>{prob.codeSnippet}</code>
                    </div>
                  </div>
                  <div className={`shrink-0 font-sans text-xs border-t md:border-t-0 md:border-l md:pl-4 pt-2 md:pt-0 max-w-xs ${isDarkMode ? 'border-slate-700/50 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
                    <span className="font-semibold block text-[10px] uppercase mb-0.5 text-blue-500">易语言一键修复建议：</span>
                    <span className={`text-[11px] leading-relaxed block ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{prob.suggestion}</span>
                    {prob.actionLabel && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectLine(prob.line);
                        }}
                        className={`mt-2 inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-semibold transition-colors ${
                          isDarkMode
                            ? 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                            : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        <CornerDownRight className="w-3 h-3" />
                        <span>{prob.actionLabel}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'output' && (
          // ================= COMPILE OUTPUT TERMINAL =================
          <div 
            onContextMenu={(e) => handleContextMenu(e, 'output')}
            title="右键打开日志菜单"
            className={`p-4 font-mono text-xs space-y-1.5 select-text cursor-context-menu ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            {buildLogs.length === 0 ? (
              <div className="text-slate-400 py-10 text-center font-sans">
                💡 暂无编译与生成输出记录。请点击右上角 【调试 (F5)】 或 【重新生成】 按钮进行编译。
              </div>
            ) : (
              buildLogs.map((log, idx) => {
                let className = isDarkMode ? 'text-slate-400' : 'text-slate-600';
                if (log.includes('error') || log.includes('Failed') || log.includes('严重') || log.includes('🔴')) {
                  className = 'text-rose-600 font-semibold';
                } else if (log.includes('warning') || log.includes('警告')) {
                  className = 'text-amber-600';
                } else if (log.includes('success') || log.includes('成功') || log.includes('SUCCESS') || log.includes('Succeeded')) {
                  className = 'text-emerald-600 font-bold';
                } else if (log.startsWith('>') || log.startsWith('>>>')) {
                  className = 'text-sky-600 font-semibold';
                }

                return log.split(/\r?\n/u).map((line, lineIndex) => {
                  const linePath = extractLocalPathFromLogLine(line);
                  return (
                    <div
                      key={`${idx}:${lineIndex}`}
                      onContextMenu={(event) => handleContextMenu(event, 'output', line)}
                      onDoubleClick={linePath ? () => void revealLogPath(linePath) : undefined}
                      title={linePath ? '双击在文件资源管理器中定位' : undefined}
                      className={`${className} min-h-[1lh] whitespace-pre-wrap break-all leading-normal ${
                        linePath ? 'cursor-pointer hover:underline underline-offset-2' : ''
                      }`}
                    >
                      {line || '\u00a0'}
                    </div>
                  );
                });
              })
            )}
          </div>
        )}

        {activeTab === 'terminal' && <TerminalPanel isDarkMode={isDarkMode} />}
        {activeTab === 'tests' && <TestExplorer isDarkMode={isDarkMode} />}

        {activeTab === 'debug_logs' && (
          // ================= RUNTIME DEBUG LOGS PANEL =================
          <div 
            onContextMenu={(e) => handleContextMenu(e, 'debug_logs')}
            title="右键打开日志菜单"
            className="p-4 font-mono text-xs space-y-1.5 select-text cursor-context-menu"
          >
            {debugLogs.length === 0 ? (
              <div className="text-slate-400 py-10 text-center font-sans">
                💡 暂无运行时调试日志。当您在运行的程序中触发中文事件（如单击按钮或选择菜单）时，这里将实时输出“调试输出”数据。
              </div>
            ) : (
              debugLogs.flatMap((log, idx) => log.split(/\r?\n/u).map((line, lineIndex) => (
                <div
                  key={`${idx}:${lineIndex}`}
                  onContextMenu={(event) => handleContextMenu(event, 'debug_logs', line)}
                  className="min-h-[1lh] text-amber-500 whitespace-pre-wrap break-all leading-normal"
                >
                  {line || '\u00a0'}
                </div>
              )))
            )}
          </div>
        )}

        {activeTab === 'debug_locals' && <DebugInspector isDarkMode={isDarkMode} />}
      </div>

      {/* Visual Studio Style Context Menu */}
      {contextMenu.show && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          role="menu"
          aria-label="日志操作"
          className={`absolute z-[999] w-40 py-1 border rounded shadow-xl font-sans text-xs select-none ${
            isDarkMode 
              ? 'bg-[#252526] border-[#3c3c3c] text-slate-200 shadow-black/50' 
              : 'bg-white border-slate-200 text-slate-800 shadow-slate-300'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.tabType !== 'problems' && (
            <button
              type="button"
              role="menuitem"
              disabled={contextMenu.lineText === null}
              onClick={() => {
                if (contextMenu.lineText !== null) {
                  copyLineToClipboard(contextMenu.lineText);
                }
                setContextMenu(prev => ({ ...prev, show: false }));
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                contextMenu.lineText === null
                  ? 'cursor-not-allowed opacity-40'
                  : 'cursor-pointer hover:bg-[#007ACC] hover:text-white'
              }`}
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>复制行</span>
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (contextMenu.tabType) {
                copyLogsToClipboard(contextMenu.tabType);
              }
              setContextMenu(prev => ({ ...prev, show: false }));
            }}
            className={`flex w-full px-3 py-1.5 items-center gap-2 text-left cursor-pointer transition-colors ${
              isDarkMode ? 'hover:bg-[#007ACC] hover:text-white' : 'hover:bg-[#007ACC] hover:text-white'
            }`}
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>复制全部</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (contextMenu.tabType && onClearLogs) {
                onClearLogs(contextMenu.tabType);
              }
              setContextMenu(prev => ({ ...prev, show: false }));
            }}
            className={`flex w-full px-3 py-1.5 items-center gap-2 text-left cursor-pointer transition-colors border-t ${
              isDarkMode 
                ? 'border-slate-800/80 hover:bg-[#007ACC] hover:text-white' 
                : 'border-slate-100 hover:bg-[#007ACC] hover:text-white'
            }`}
          >
            <Trash className="w-3.5 h-3.5 text-rose-500" />
            <span>{contextMenu.tabType === 'problems' ? '清空错误列表' : '清空日志'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
