import React, { useState, useEffect } from 'react';
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
  FileCode,
  FileText,
  Layers,
  Copy,
  Trash
} from 'lucide-react';
import { BottomPanelTabType, DesignerGeneratedPanelData, ExtractedString, ProblemItem } from '../types';

interface BottomPanelProps {
  strings: ExtractedString[];
  problems: ProblemItem[];
  buildLogs: string[];
  debugLogs: string[];
  onSelectLine: (lineNum: number) => void;
  onUpdateStringTranslation: (id: string, value: string) => void;
  onSetStatus: (id: string, status: 'translated' | 'skipped' | 'pending') => void;
  isDarkMode?: boolean;
  activeTab: BottomPanelTabType;
  onActiveTabChange: (tab: BottomPanelTabType) => void;
  generatedPanels: DesignerGeneratedPanelData;
  height: number;
  onClearLogs?: (tab: string) => void;
}

export default function BottomPanel({
  strings,
  problems,
  buildLogs,
  debugLogs,
  onSelectLine,
  onUpdateStringTranslation,
  onSetStatus,
  isDarkMode = true,
  activeTab,
  onActiveTabChange,
  generatedPanels,
  height,
  onClearLogs
}: BottomPanelProps) {
  const [filterType, setFilterType] = useState<'all' | 'string' | 'comment'>('all');
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    tabType: 'designer_logs' | 'output' | 'debug_logs' | null;
  }>({ show: false, x: 0, y: 0, tabType: null });

  useEffect(() => {
    const handleClose = () => {
      setContextMenu(prev => prev.show ? { ...prev, show: false } : prev);
    };
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, tabType: 'designer_logs' | 'output' | 'debug_logs') => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setContextMenu({
      show: true,
      x: Math.min(x, rect.width - 150),
      y: Math.min(y, rect.height - 80),
      tabType
    });
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  // Simulating WPF Live Controls watch states inside C# IDE
  const [wpfLocals, setWpfLocals] = useState([
    { id: 'txt_account', name: '账号输入框', type: 'System.Windows.Controls.TextBox', value: 'admin@space_adventure.com', binding: '关联设计文件 / .局部变量 系统配置', status: '正在监视' },
    { id: 'btn_launch', name: '按钮1', type: 'System.Windows.Controls.Button', value: '已被单击 / 触发 _按钮1_被单击', binding: '信息框 ("开始运行太空冒险...", 64, "运行成功")', status: '就绪' },
    { id: 'progress_sync', name: '资源同步进度条', type: 'System.Windows.Controls.ProgressBar', value: '35%', binding: '载入可视化设计 (关联设计文件)', status: '正在更新' },
    { id: 'chk_remember', name: '记住配置复选框', type: 'System.Windows.Controls.CheckBox', value: '已勾选 (True)', binding: '记住配置_Checked 事件绑定', status: '就绪' },
    { id: 'lbl_login_title', name: '登录窗体标题标签', type: 'System.Windows.Controls.Label', value: '太空冒险安全账户登录', binding: '静态属性', status: '只读' }
  ]);

  const filteredStrings = strings.filter(s => {
    if (filterType === 'all') return true;
    return s.type === filterType;
  });

  const designerCodePanel = (() => {
    if (activeTab === 'designer_xml') {
      return {
        code: generatedPanels.xmlCode,
        colorClass: 'text-cyan-400/90',
        emptyText: '等待窗口设计器生成 XML 预览。'
      };
    }

    if (activeTab === 'designer_cpp') {
      return {
        code: generatedPanels.cppCode,
        colorClass: 'text-emerald-400/95',
        emptyText: '等待窗口设计器生成头文件预览。'
      };
    }

    if (activeTab === 'designer_manifest') {
      return {
        code: generatedPanels.manifestCode,
        colorClass: 'text-amber-300/90',
        emptyText: '等待窗口设计器生成窗口程序集。'
      };
    }

    if (activeTab === 'designer_logs') {
      return {
        code: generatedPanels.logs.length > 0 ? generatedPanels.logs.join('\n') : '> [编译日志] 等待 F5 触发真实 Win32 构建。',
        colorClass: 'text-slate-300',
        emptyText: '等待编译日志。'
      };
    }

    return null;
  })();

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

  const handleLocalValChange = (id: string, newVal: string) => {
    setWpfLocals(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, value: newVal };
      }
      return item;
    }));
  };

  return (
    <div 
      id="vs-bottom-tabs" 
      className={`flex flex-col font-sans overflow-hidden shrink-0 select-none border-t relative ${
        isDarkMode 
          ? 'bg-[#1E1E1E] border-[#181818]' 
          : 'bg-white border-slate-300'
      }`}
      style={{ height }}
    >
      {/* Visual Studio Classic Tab Headers with Complete Debugging and Building controllers */}
      <div 
        className={`flex items-center justify-between px-4 shrink-0 h-9 border-b ${
          isDarkMode ? 'border-[#181818] bg-[#252526]' : 'border-slate-300 bg-[#EEEEEE]'
        }`}
      >
        
        {/* Left Side: Standard VS Panels Tabs */}
        <div className="flex gap-1 h-full items-end overflow-x-auto scrollbar-none flex-nowrap shrink-0">
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

          <button
            onClick={() => onActiveTabChange('designer_xml')}
            className={`h-8 px-3 text-[11px] font-semibold relative cursor-pointer flex items-center gap-1.5 transition-colors border-t border-x whitespace-nowrap shrink-0 ${
              activeTab === 'designer_xml'
                ? isDarkMode
                  ? 'text-white bg-[#1E1E1E] border-[#2d2d30] border-b-transparent z-10'
                  : 'text-slate-900 bg-white border-slate-300 border-b-transparent z-10'
                : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 bg-transparent border-transparent'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/40 bg-transparent border-transparent'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-cyan-500" />
            <span>{generatedPanels.xmlLabel}</span>
          </button>

          <button
            onClick={() => onActiveTabChange('designer_cpp')}
            className={`h-8 px-3 text-[11px] font-semibold relative cursor-pointer flex items-center gap-1.5 transition-colors border-t border-x whitespace-nowrap shrink-0 ${
              activeTab === 'designer_cpp'
                ? isDarkMode
                  ? 'text-white bg-[#1E1E1E] border-[#2d2d30] border-b-transparent z-10'
                  : 'text-slate-900 bg-white border-slate-300 border-b-transparent z-10'
                : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 bg-transparent border-transparent'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/40 bg-transparent border-transparent'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-500" />
            <span>{generatedPanels.cppLabel}</span>
          </button>

          <button
            onClick={() => onActiveTabChange('designer_manifest')}
            className={`h-8 px-3 text-[11px] font-semibold relative cursor-pointer flex items-center gap-1.5 transition-colors border-t border-x whitespace-nowrap shrink-0 ${
              activeTab === 'designer_manifest'
                ? isDarkMode
                  ? 'text-white bg-[#1E1E1E] border-[#2d2d30] border-b-transparent z-10'
                  : 'text-slate-900 bg-white border-slate-300 border-b-transparent z-10'
                : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 bg-transparent border-transparent'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/40 bg-transparent border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>{generatedPanels.manifestLabel}</span>
          </button>

          <button
            onClick={() => onActiveTabChange('designer_logs')}
            className={`h-8 px-3 text-[11px] font-semibold relative cursor-pointer flex items-center gap-1.5 transition-colors border-t border-x whitespace-nowrap shrink-0 ${
              activeTab === 'designer_logs'
                ? isDarkMode
                  ? 'text-white bg-[#1E1E1E] border-[#2d2d30] border-b-transparent z-10'
                  : 'text-slate-900 bg-white border-slate-300 border-b-transparent z-10'
                : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 bg-transparent border-transparent'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/40 bg-transparent border-transparent'
            }`}
          >
            <Terminal className={`w-3.5 h-3.5 ${generatedPanels.isBuilding ? 'text-amber-400 animate-pulse' : 'text-emerald-500'}`} />
            <span>编译日志</span>
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
            <AlertTriangle className={`w-3.5 h-3.5 ${problems.length > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`} />
            <span>错误列表 ({problems.length})</span>
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
            <span>局部变量 & WPF 监视器 (Locals)</span>
          </button>
        </div>

        {/* Copy Logs button when logs or output or debug logs is selected */}
        {(activeTab === 'designer_logs' || activeTab === 'output' || activeTab === 'debug_logs') && (
          <button
            onClick={() => {
              const logsText = activeTab === 'designer_logs' 
                ? (generatedPanels.logs.length > 0 ? generatedPanels.logs.join('\n') : '> [编译日志] 空')
                : activeTab === 'output'
                ? (buildLogs.length > 0 ? buildLogs.join('\n') : '> [输出] 空')
                : (debugLogs.length > 0 ? debugLogs.join('\n') : '> [调试输出] 空');
              navigator.clipboard.writeText(logsText);
              alert('已复制全部日志到剪贴板！');
            }}
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded border cursor-pointer transition-all ${
              isDarkMode 
                ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/30' 
                : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <Copy className="w-3 h-3" />
            <span>复制全部日志</span>
          </button>
        )}

        {/* Right Side: Visual Studio 2022 Debugging Toolbar Buttons */}
        <div className="flex items-center gap-3">
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
          {activeTab === 'extracted' && (
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
      <div className={`flex-1 overflow-auto min-h-0 ${isDarkMode ? 'bg-[#1E1E1E]' : 'bg-white text-slate-800'}`}>
        {activeTab === 'extracted' && (
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

        {designerCodePanel && (
          <div 
            onContextMenu={(e) => handleContextMenu(e, 'designer_logs')}
            title="右键打开日志菜单"
            className="h-full overflow-auto p-3 bg-[#0d0d10] font-mono text-[11.5px] leading-relaxed select-text cursor-context-menu">
            {designerCodePanel.code.trim() ? (
              <pre className="whitespace-pre min-w-max">
                <span className={designerCodePanel.colorClass}>{designerCodePanel.code}</span>
              </pre>
            ) : (
              <div className="text-slate-500 py-10 text-center font-sans">{designerCodePanel.emptyText}</div>
            )}
          </div>
        )}

        {activeTab === 'problems' && (
          // ================= DIAGNOSIS Trap checklist =================
          <div className="p-4 space-y-3 font-mono text-xs">
            {problems.length === 0 ? (
              <div className={`text-center py-10 flex flex-col items-center gap-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <span className="font-sans mt-2">错误列表未检测到任何编译障碍。C++ WPF 中文逻辑符合国家级易语言通用编译器规范。</span>
              </div>
            ) : (
              problems.map(prob => (
                <div
                  key={prob.id}
                  onClick={() => onSelectLine(prob.line)}
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
                      <span className="font-semibold text-slate-400 text-[10px]">{prob.filePath}{" -> "}第 {prob.line} 行</span>
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

                return (
                  <div key={idx} className={`${className} whitespace-pre-wrap break-all leading-normal`}>
                    {log}
                  </div>
                );
              })
            )}
          </div>
        )}

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
              debugLogs.map((log, idx) => (
                <div key={idx} className="text-amber-500 whitespace-pre-wrap break-all leading-normal">
                  {log}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'debug_locals' && (
          // ================= DEBUG LOCALS & WATCH (WPF & EPL BRIDGING) =================
          <div className="p-4 overflow-x-auto">
            <div 
              className={`mb-2 text-[10px] font-sans flex justify-between items-center p-2 rounded border ${
                isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <span>在 C# WPF 底层架构下，以下中文 易语言(EPL) 变量与可视标签属性正处于实时内存监视状态：</span>
              <span className="text-emerald-500 flex items-center gap-1 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>调试器正常工作 (端口: 3000)</span>
              </span>
            </div>
            
            <table className="w-full text-left border-collapse text-xs select-text">
              <thead>
                <tr className={`select-none ${isDarkMode ? 'bg-[#252526] border-b border-[#181818] text-slate-400' : 'bg-slate-100 border-b border-slate-200 text-slate-600'}`}>
                  <th className="py-2 px-4 font-semibold w-28">变量/控件标识符</th>
                  <th className="py-2 px-4 font-semibold w-36">易语言中文化绑定名称</th>
                  <th className="py-2 px-4 font-semibold w-48">WPF 宿主底层托管类型</th>
                  <th className="py-2 px-4 font-semibold w-1/3">实时内存数值 (Value) [双击修改]</th>
                  <th className="py-2 px-4 font-semibold w-36">WPF 后台绑定逻辑</th>
                  <th className="py-2 px-4 font-semibold w-24">运行状态</th>
                </tr>
              </thead>
              <tbody className={`font-mono divide-y ${isDarkMode ? 'divide-[#181818]' : 'divide-slate-200'}`}>
                {wpfLocals.map(item => (
                  <tr key={item.id} className={`transition-colors group ${isDarkMode ? 'hover:bg-[#2A2D2E]' : 'hover:bg-slate-50'}`}>
                    <td className={`py-1.5 px-4 font-semibold ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>{item.id}</td>
                    <td className={`py-1.5 px-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{item.name}</td>
                    <td className="py-1.5 px-4 text-slate-400 text-[11px]">{item.type}</td>
                    <td className="py-1.5 px-4">
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => handleLocalValChange(item.id, e.target.value)}
                        className={`bg-transparent border border-transparent rounded px-1.5 py-0.5 w-full focus:outline-none transition-all text-xs ${
                          isDarkMode 
                            ? 'hover:border-slate-700 focus:border-[#007ACC] focus:bg-[#252526] text-slate-200' 
                            : 'hover:border-slate-300 focus:border-blue-500 focus:bg-slate-50 text-slate-800'
                        }`}
                      />
                    </td>
                    <td className="py-1.5 px-4 text-slate-400 text-[10px]">{item.binding}</td>
                    <td className="py-1.5 px-4">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                        item.status === '正在监视' 
                          ? isDarkMode
                            ? 'bg-blue-950/40 text-blue-400 border border-blue-500/20' 
                            : 'bg-blue-50 text-blue-600 border border-blue-200'
                          : item.status === '正在更新'
                          ? isDarkMode
                            ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20'
                            : 'bg-amber-50 text-amber-600 border border-amber-200'
                          : isDarkMode
                          ? 'bg-slate-800 text-slate-400 border border-slate-700/50'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Visual Studio Style Context Menu */}
      {contextMenu.show && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className={`absolute z-[999] w-36 py-1 border rounded shadow-xl font-sans text-xs select-none ${
            isDarkMode 
              ? 'bg-[#252526] border-[#3c3c3c] text-slate-200 shadow-black/50' 
              : 'bg-white border-slate-200 text-slate-800 shadow-slate-300'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            onClick={() => {
              const logsText = contextMenu.tabType === 'designer_logs' 
                ? (generatedPanels.logs.length > 0 ? generatedPanels.logs.join('\n') : '> [编译日志] 空')
                : contextMenu.tabType === 'output'
                ? (buildLogs.length > 0 ? buildLogs.join('\n') : '> [输出] 空')
                : (debugLogs.length > 0 ? debugLogs.join('\n') : '> [调试输出] 空');
              navigator.clipboard.writeText(logsText);
              alert('已复制全部日志到剪贴板！');
              setContextMenu(prev => ({ ...prev, show: false }));
            }}
            className={`px-3 py-1.5 flex items-center gap-2 cursor-pointer transition-colors ${
              isDarkMode ? 'hover:bg-[#007ACC] hover:text-white' : 'hover:bg-[#007ACC] hover:text-white'
            }`}
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>复制全部</span>
          </div>
          <div
            onClick={() => {
              if (contextMenu.tabType && onClearLogs) {
                onClearLogs(contextMenu.tabType);
              }
              setContextMenu(prev => ({ ...prev, show: false }));
            }}
            className={`px-3 py-1.5 flex items-center gap-2 cursor-pointer transition-colors border-t ${
              isDarkMode 
                ? 'border-slate-800/80 hover:bg-[#007ACC] hover:text-white' 
                : 'border-slate-100 hover:bg-[#007ACC] hover:text-white'
            }`}
          >
            <Trash className="w-3.5 h-3.5 text-rose-500" />
            <span>清空日志</span>
          </div>
        </div>
      )}
    </div>
  );
}
