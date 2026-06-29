import React, { useState } from 'react';
import {
  Folder,
  FileCode,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Play,
  AlertTriangle,
  Wrench,
  Sparkles,
  RefreshCw,
  Layers,
  BookOpen,
  Search,
  Check,
  RotateCcw,
  FileText,
  Terminal,
  Brain,
  Copy,
  Info,
  Sliders,
  X,
  HelpCircle,
  FolderOpen,
  SlidersHorizontal,
  CheckCircle
} from 'lucide-react';
import { CppFile, ExtractedString, GlossaryTerm } from '../types';

interface SidebarProps {
  files: CppFile[];
  activeFile: CppFile;
  onSelectFile: (file: CppFile) => void;
  onRunBuild: () => void;
  isBuilding: boolean;
  isDarkMode?: boolean;
  showLeftSidebar?: boolean;
  setShowLeftSidebar?: (val: boolean) => void;
  onBatchTranslate?: (translations: { id: string; translated: string }[]) => void;
  onSetStatus?: (id: string, status: 'translated' | 'skipped' | 'pending') => void;
  glossary?: GlossaryTerm[];
  drawerWidth?: number;
}

export default function Sidebar({
  files,
  activeFile,
  onSelectFile,
  onRunBuild,
  isBuilding,
  isDarkMode = true,
  showLeftSidebar = true,
  setShowLeftSidebar,
  onBatchTranslate,
  onSetStatus,
  glossary = [],
  drawerWidth = 264
}: SidebarProps) {
  // Tabs: 'explorer' (解决方案), 'actions' (快捷工具), 'outline' (大纲视图)
  const [activeTab, setActiveTab] = useState<'explorer' | 'actions' | 'outline'>('explorer');
  const [isSolutionOpen, setIsSolutionOpen] = useState(true);
  const [isSrcOpen, setIsSrcOpen] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  
  // Search query for files
  const [fileSearch, setFileSearch] = useState('');

  // States for Quick Actions panel
  const [isTranslating, setIsTranslating] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [placeholderErrors, setPlaceholderErrors] = useState<{ line: number; msg: string; text: string }[]>([]);
  const [hasCheckedPlaceholders, setHasCheckedPlaceholders] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Group files by directories
  const srcFiles = files.filter(f => f.path.startsWith('src/') && f.name.toLowerCase().includes(fileSearch.toLowerCase()));
  const configFiles = files.filter(f => f.path.startsWith('config/') && f.name.toLowerCase().includes(fileSearch.toLowerCase()));

  const getProgress = (file: CppFile) => {
    const total = file.strings.length;
    const translated = file.strings.filter(s => s.status === 'translated').length;
    return total === 0 ? 100 : Math.round((translated / total) * 100);
  };

  // Switch tab, and handle collapse/expand in VS style
  const handleTabClick = (tab: 'explorer' | 'actions' | 'outline') => {
    if (showLeftSidebar && activeTab === tab) {
      // Collapse if clicking the already active tab
      if (setShowLeftSidebar) setShowLeftSidebar(false);
    } else {
      // Switch tab and ensure it is expanded
      setActiveTab(tab);
      if (setShowLeftSidebar) setShowLeftSidebar(true);
    }
  };

  // Helper for triggering action success banner
  const triggerSuccess = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => {
      setActionSuccessMessage(null);
    }, 4000);
  };

  // --- Quick Action: Smart Auto Translate Active File ---
  const handleSmartTranslate = async () => {
    if (isTranslating) return;
    setIsTranslating(true);
    setHasCheckedPlaceholders(false);

    // Dynamic timeout to simulate compilation/AI thinking
    setTimeout(() => {
      const pendingStrings = activeFile.strings.filter(s => s.status === 'pending');
      if (pendingStrings.length === 0) {
        setIsTranslating(false);
        triggerSuccess('当前文件已全部切换为中文代码编写，无需再次配置！');
        return;
      }

      // Dictionary of standard translations for our test app files
      const dictionary: Record<string, string> = {
        'My Awesome Game Client v1.0': '我的超级游戏客户端 v1.0 Pro',
        'Starting initialization of game engine...': '正在启动游戏引擎初始化程序...',
        'Critical Error: Engine failed to initialize! Please check configuration.': '致命错误：引擎初始化失败！请检查配置文件。',
        'Initialization Failure': '初始化失败',
        'Render engine active. Entering message loop.': '渲染引擎已激活。正在进入窗口消息循环。',
        'Window creation failed with error code: ': '窗口创建失败，错误代码: ',
        'Welcome to the game world! Press Space to jump.': '欢迎来到游戏世界！按下空格键可以跳跃。',
        'Are you sure you want to quit?': '你确定要退出游戏吗？',
        'Quit Game': '退出游戏',
        'Global Variables:': '全局变量声明:',
        'Forward declarations of functions included in this code module:': '本代码模块中包含的函数前向声明:',
        'Initialize global strings': '初始化全局字符串',
        'TODO: Add initialization code here.': '待办：在此处添加初始化代码。',
        'Main message loop:': '主消息循环:',
        'Store instance handle in our global variable': '将实例句柄存储在我们的全局变量中',
        'TODO: Add any drawing code that uses hdc here...': '待办：在此处添加任何使用 hdc 的绘图代码...',
        'Parse the menu selections:': '解析菜单项选择:',
        'IDS_APP_TITLE': '空间探险客户端',
        'IDS_ERROR_CONNECT': '网络连接建立失败。请重试。',
        'IDS_STATUS_CONNECTED': '核心引擎网络连通成功。',
        'Space Adventure Game Client': '《星际探险》官方中文客户端',
        'File(F)': '文件(F)',
        'Help(H)': '帮助(H)',
        'Connection Failed': '服务器连接失败',
        'Engine Core Online': '引擎核心上线',
        'IDD_ABOUTBOX': '关于对话框',
        'Space Adventure Client': '星际探险客户端',
        'Database connection is offline!': '数据库连接处于离线状态！'
      };

      const translationsToApply = activeFile.strings.map(s => {
        if (s.status === 'pending') {
          // Check glossary terms first
          const glossaryMatch = glossary.find(g => s.original.toLowerCase().includes(g.english.toLowerCase()));
          let trText = dictionary[s.original] || s.translated;
          
          if (!trText && glossaryMatch) {
            // Simple replace
            trText = s.original.replace(new RegExp(glossaryMatch.english, 'gi'), glossaryMatch.chinese);
          }

          if (!trText) {
            // Default placeholder if none found
            trText = `[中文代码] ${s.original}`;
          }

          return { id: s.id, translated: trText };
        }
        return { id: s.id, translated: s.translated };
      }).filter(t => t.translated !== '');

      if (onBatchTranslate) {
        onBatchTranslate(translationsToApply);
        triggerSuccess(`成功通过智能编译器配置了 ${pendingStrings.length} 处中文代码！`);
      } else {
        triggerSuccess('编译器本地化模块未挂载，已启用模拟映射！');
      }

      setIsTranslating(false);
    }, 1200);
  };

  // --- Quick Action: Format Specifier Integrity Check ---
  const handleCheckPlaceholders = () => {
    const errors: { line: number; msg: string; text: string }[] = [];
    
    activeFile.strings.forEach(s => {
      if (s.status === 'translated' && s.translated) {
        // Find formatting specifiers e.g. %s, %d, %ls, %ld, {0}, {1}
        const specifierRegex = /%[a-zA-Z]+|%\d*[a-zA-Z]|\{\d+\}/g;
        const origMatches: string[] = s.original.match(specifierRegex) || [];
        const transMatches: string[] = s.translated.match(specifierRegex) || [];

        // Check for missing specifiers
        origMatches.forEach(spec => {
          if (!transMatches.includes(spec)) {
            errors.push({
              line: s.line,
              msg: `中文代码中缺少原始句式必要的占位符 "${spec}"，这在 C++ 运行时将导致程序解析或输出崩溃！`,
              text: s.translated
            });
          }
        });
      }
    });

    setPlaceholderErrors(errors);
    setHasCheckedPlaceholders(true);
    
    if (errors.length === 0) {
      triggerSuccess('✓ 占位符格式安全性校验通过！未发现任何致命隐患。');
    }
  };

  // --- Quick Action: Reset Active File Translations ---
  const handleResetFile = () => {
    if (onSetStatus) {
      activeFile.strings.forEach(s => {
        onSetStatus(s.id, 'pending');
      });
      triggerSuccess('已成功清空当前文件所有的中文代码映射，恢复原生状态！');
    } else {
      triggerSuccess('已重置当前文件为英文代码状态！');
    }
    setShowResetConfirm(false);
    setHasCheckedPlaceholders(false);
    setPlaceholderErrors([]);
  };

  // --- Quick Action: Apply Glossary Terms directly ---
  const handleApplyGlossary = () => {
    let count = 0;
    const appliedTranslations = activeFile.strings.map(s => {
      let currentTranslated = s.translated || s.original;
      let isChanged = false;
      
      glossary.forEach(g => {
        const regex = new RegExp(`\\b${g.english}\\b`, 'gi');
        if (regex.test(currentTranslated)) {
          currentTranslated = currentTranslated.replace(regex, g.chinese);
          isChanged = true;
        }
      });

      if (isChanged) {
        count++;
        return { id: s.id, translated: currentTranslated };
      }
      return null;
    }).filter(Boolean) as { id: string; translated: string }[];

    if (appliedTranslations.length > 0 && onBatchTranslate) {
      onBatchTranslate(appliedTranslations);
      triggerSuccess(`术语规范器：在当前文件中应用了 ${count} 处专业术语转换！`);
    } else {
      triggerSuccess('未找到符合术语表中规则的英文文本，无需转换。');
    }
  };

  // Copy translated code shortcut
  const handleCopyCode = () => {
    const codeToCopy = activeFile.translatedContent || activeFile.originalContent;
    navigator.clipboard.writeText(codeToCopy);
    triggerSuccess('✓ 中文版映射 C++ 代码已复制到您的剪贴板！');
  };

  const renderFileRow = (file: CppFile) => {
    const isActive = file.path === activeFile.path;
    const progress = getProgress(file);

    return (
      <div
        key={file.path}
        id={`file-row-${file.name.replace('.', '-')}`}
        onClick={() => onSelectFile(file)}
        className={`group flex items-center justify-between py-1 px-3 pl-8 text-xs cursor-pointer border-l-2 transition-all ${
          isActive
            ? isDarkMode 
              ? 'bg-[#37373D] border-[#007ACC] text-[#007ACC] font-medium'
              : 'bg-slate-200 border-blue-600 text-blue-700 font-semibold'
            : isDarkMode
              ? 'border-transparent text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white'
              : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <FileCode className={`w-3.5 h-3.5 shrink-0 ${isActive ? (isDarkMode ? 'text-[#007ACC]' : 'text-blue-600') : 'text-slate-400'}`} />
          <span className="truncate">{file.name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {progress === 100 ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-[#73C991]" />
          ) : progress > 0 ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-amber-500 font-bold">{progress}%</span>
              <div className={`w-8 h-1 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <div className="h-full bg-amber-500" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          ) : (
            <span className={`text-[9px] px-1 rounded border ${
              isDarkMode 
                ? 'bg-[#1E1E1E] border-slate-700/50 text-[#888]' 
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}>原生</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      id="vs-dockable-sidebar"
      className={`h-full flex shrink-0 select-none border-r ${
        isDarkMode ? 'bg-[#252526] border-[#181818] text-[#D4D4D4]' : 'bg-slate-50 border-slate-300 text-slate-800'
      } transition-all duration-200`}
    >
      {/* 1. Visual Studio Signature Activity Bar (Slim vertical strip on left) */}
      <div
        className={`w-12 h-full flex flex-col justify-between items-center py-2 select-none border-r shrink-0 ${
          isDarkMode ? 'bg-[#1E1E1E] border-[#181818]' : 'bg-[#EAEAEA] border-slate-300'
        }`}
      >
        <div className="flex flex-col gap-1.5 w-full items-center">
          {/* Solution Explorer Tab Icon */}
          <button
            onClick={() => handleTabClick('explorer')}
            className={`w-10 h-10 rounded flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors relative group ${
              showLeftSidebar && activeTab === 'explorer'
                ? isDarkMode ? 'bg-[#37373D] text-[#007ACC]' : 'bg-[#CCCCCC] text-[#007ACC]'
                : isDarkMode ? 'text-[#888888] hover:text-white hover:bg-[#2D2D2D]' : 'text-slate-600 hover:text-black hover:bg-slate-300'
            }`}
            title="解决方案资源管理器"
          >
            <Folder className="w-5 h-5" />
            <span className="text-[9px] scale-90 font-semibold leading-none font-sans">文件</span>
            {showLeftSidebar && activeTab === 'explorer' && (
              <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-[#007ACC] rounded-r"></div>
            )}
          </button>

          {/* Quick Action Tools Tab Icon */}
          <button
            onClick={() => handleTabClick('actions')}
            className={`w-10 h-10 rounded flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors relative group ${
              showLeftSidebar && activeTab === 'actions'
                ? isDarkMode ? 'bg-[#37373D] text-[#007ACC]' : 'bg-[#CCCCCC] text-[#007ACC]'
                : isDarkMode ? 'text-[#888888] hover:text-white hover:bg-[#2D2D2D]' : 'text-slate-600 hover:text-black hover:bg-slate-300'
            }`}
            title="快捷编程工具箱"
          >
            <Wrench className="w-5 h-5" />
            <span className="text-[9px] scale-90 font-semibold leading-none font-sans">工具</span>
            {showLeftSidebar && activeTab === 'actions' && (
              <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-[#007ACC] rounded-r"></div>
            )}
          </button>

          {/* Code Outline Tab Icon */}
          <button
            onClick={() => handleTabClick('outline')}
            className={`w-10 h-10 rounded flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors relative group ${
              showLeftSidebar && activeTab === 'outline'
                ? isDarkMode ? 'bg-[#37373D] text-[#007ACC]' : 'bg-[#CCCCCC] text-[#007ACC]'
                : isDarkMode ? 'text-[#888888] hover:text-white hover:bg-[#2D2D2D]' : 'text-slate-600 hover:text-black hover:bg-slate-300'
            }`}
            title="文本与函数模块"
          >
            <Layers className="w-5 h-5" />
            <span className="text-[9px] scale-90 font-semibold leading-none font-sans">模块</span>
            {showLeftSidebar && activeTab === 'outline' && (
              <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-[#007ACC] rounded-r"></div>
            )}
          </button>
        </div>

        {/* Bottom Help Icon in Activity Bar */}
        <div className="flex flex-col gap-3 items-center">
          <HelpCircle
            className={`w-4.5 h-4.5 cursor-pointer ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'}`}
            title="双击或点击底栏词条可编写中文代码"
            onClick={() => triggerSuccess('提示: 双击中间编辑区的任意代码行，即可在底栏直接用中文替换原生符号！')}
          />
        </div>
      </div>

      {/* 2. Main Expanded Content Drawer (Only visible when expanded) */}
      {showLeftSidebar && (
        <div 
          style={{ width: `${drawerWidth}px` }} 
          className={`h-full flex flex-col overflow-hidden border-r ${
            isDarkMode ? 'border-[#2d2d34]' : 'border-slate-200'
          }`}
        >
          
          {/* Action toast inside sidebar */}
          {actionSuccessMessage && (
            <div className={`text-[11px] p-2.5 flex items-start gap-2 animate-fade-in shrink-0 font-sans border-b ${
              isDarkMode 
                ? 'bg-[#1E3A1E] border-emerald-500/30 text-[#73C991]' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <Check className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
              <span>{actionSuccessMessage}</span>
            </div>
          )}

          {/* ================= TAB 1: SOLUTION EXPLORER ================= */}
          {activeTab === 'explorer' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Solution Explorer Header */}
              <div className={`p-2.5 border-b flex items-center justify-between shrink-0 ${
                isDarkMode ? 'border-[#181818] bg-[#2D2D2D]/20' : 'border-slate-200 bg-slate-100/60'
              }`}>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">解决方案资源管理器</span>
              </div>

              {/* File Search Input */}
              <div className="p-2 border-b shrink-0" style={{ borderColor: isDarkMode ? '#181818' : '#e2e8f0', backgroundColor: isDarkMode ? 'transparent' : '#f8fafc' }}>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={fileSearch}
                    onChange={e => setFileSearch(e.target.value)}
                    placeholder="搜索 C++ 文件..."
                    className={`w-full text-xs py-1 pl-7 pr-2 rounded focus:outline-none focus:ring-1 focus:ring-[#007ACC] font-sans ${
                      isDarkMode
                        ? 'bg-[#1E1E1E] border-[#2d2d34] text-slate-200 placeholder-slate-600 border'
                        : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 border'
                    }`}
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2" />
                  {fileSearch && (
                    <X
                      className={`w-3 h-3 absolute right-2 cursor-pointer ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`}
                      onClick={() => setFileSearch('')}
                    />
                  )}
                </div>
              </div>

              {/* Solution Tree */}
              <div className="flex-1 overflow-y-auto py-2 font-mono text-[11px]">
                <div>
                  <div
                    onClick={() => setIsSolutionOpen(!isSolutionOpen)}
                    className={`flex items-center gap-1 px-2.5 py-1 cursor-pointer text-xs font-semibold font-sans transition-colors ${
                      isDarkMode ? 'hover:bg-[#2A2D2E]/40 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {isSolutionOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    <span className="truncate text-slate-400 text-[10px] tracking-wider uppercase font-sans">解决方案 'UI_CppLocProj'</span>
                  </div>

                  {isSolutionOpen && (
                    <div className="pl-1">
                      {/* Project Subnode */}
                      <div className={`flex items-center gap-1.5 px-4 py-1 text-xs font-bold font-sans ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        <div className="w-2.5 h-2.5 rounded-sm bg-purple-600"></div>
                        <span className="text-purple-600 font-bold">GameClient (Visual C++)</span>
                      </div>

                      {/* includes / src Folder */}
                      <div className="pl-2">
                        <div
                          onClick={() => setIsSrcOpen(!isSrcOpen)}
                          className={`flex items-center gap-1 px-2 py-1 cursor-pointer text-xs font-sans transition-colors ${
                            isDarkMode ? 'hover:bg-[#2A2D2E]/50 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isSrcOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          <Folder className="w-3.5 h-3.5 text-blue-500 fill-blue-500/10" />
                          <span>游戏源码与头文件 (src)</span>
                        </div>
                        {isSrcOpen && (
                          <div className="mt-0.5">
                            {srcFiles.length === 0 ? (
                              <div className="pl-8 text-slate-500 text-[10px] py-1 font-sans">未找到匹配文件</div>
                            ) : (
                              srcFiles.map(renderFileRow)
                            )}
                          </div>
                        )}
                      </div>

                      {/* Config Folder */}
                      <div className="pl-2 mt-1.5">
                        <div
                          onClick={() => setIsConfigOpen(!isConfigOpen)}
                          className={`flex items-center gap-1 px-2 py-1 cursor-pointer text-xs font-sans transition-colors ${
                            isDarkMode ? 'hover:bg-[#2A2D2E]/50 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isConfigOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10" />
                          <span>本地配置文件 (config)</span>
                        </div>
                        {isConfigOpen && (
                          <div className="mt-0.5">
                            {configFiles.length === 0 ? (
                              <div className="pl-8 text-slate-500 text-[10px] py-1 font-sans">未找到匹配文件</div>
                            ) : (
                              configFiles.map(renderFileRow)
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Compact outline as a secondary collapsible module inside file explorer */}
              <div 
                className={`h-40 border-t p-2.5 flex flex-col overflow-hidden shrink-0 ${
                  isDarkMode ? 'bg-[#1E1E1E]/20' : 'bg-slate-50'
                }`} 
                style={{ borderColor: isDarkMode ? '#181818' : '#e2e8f0' }}
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-sans">当前文件模块 (快速跳转)</span>
                <div className="flex-1 overflow-y-auto text-[11px] space-y-1.5 font-mono">
                  {activeFile.strings.slice(0, 4).map(s => (
                    <div
                      key={s.id}
                      className={`flex items-center gap-1.5 cursor-pointer truncate font-sans py-0.5 px-1 rounded transition-colors ${
                        isDarkMode 
                          ? 'text-slate-400 hover:text-white hover:bg-[#2A2D2E]/40' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                      onClick={() => {
                        const el = document.getElementById(`diff-line-${s.line - 1}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      <span className={`font-bold text-[9px] px-1 rounded uppercase scale-90 font-mono ${
                        isDarkMode ? 'bg-[#1E1E1E] text-[#007ACC]' : 'bg-slate-200 text-blue-600'
                      }`}>L{s.line}</span>
                      <span className="truncate italic">"{s.original}"</span>
                    </div>
                  ))}
                  {activeFile.strings.length > 4 && (
                    <div
                      className={`text-[10px] font-bold hover:underline cursor-pointer pt-1 font-sans pl-1 ${
                        isDarkMode ? 'text-[#007ACC]' : 'text-blue-600'
                      }`}
                      onClick={() => setActiveTab('outline')}
                    >
                      查看全部模块项 ({activeFile.strings.length})...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: QUICK ACTIONS TOOLBOX ================= */}
          {activeTab === 'actions' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden p-3 font-sans">
              <div className="border-b pb-2 mb-3 shrink-0" style={{ borderColor: isDarkMode ? '#2d2d34' : '#e2e8f0' }}>
                <h3 className={`text-xs font-bold flex items-center gap-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  <Wrench className="w-3.5 h-3.5 text-[#007ACC]" />
                  <span>快捷本地化工具箱</span>
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">大幅提升 C++ 与界面布局中文代码开发与映射效率</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* 1. Batch Smart AI Translation */}
                <div className={`p-2.5 rounded border space-y-2 ${
                  isDarkMode ? 'bg-[#1E1E1E]/50 border-slate-800/40' : 'bg-slate-100/60 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>智能中文代码映射器</span>
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-950/40 text-emerald-300 rounded border border-emerald-500/10 scale-90">
                      Gemini Core
                    </span>
                  </div>
                  <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    一键分析当前 C++ 代码上下文，批量生成对应的中文代码层，并保护原有格式与占位符。
                  </p>
                  <button
                    onClick={handleSmartTranslate}
                    disabled={isTranslating}
                    className={`w-full py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      isDarkMode 
                        ? 'bg-[#1E3A1E] hover:bg-emerald-800 text-[#73C991] hover:text-white border border-emerald-500/30' 
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm'
                    }`}
                  >
                    {isTranslating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>AI 智能代码映射生成中...</span>
                      </>
                    ) : (
                      <>
                        <Brain className="w-3.5 h-3.5" />
                        <span>一键智能编写中文代码</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 2. Format integrity checker */}
                <div className={`p-2.5 rounded border space-y-2 ${
                  isDarkMode ? 'bg-[#1E1E1E]/50 border-slate-800/40' : 'bg-slate-100/60 border-slate-200'
                }`}>
                  <span className="text-[11px] font-bold text-[#007ACC] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    <span>C++ 占位符安全性校验</span>
                  </span>
                  <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    检测中文代码中是否漏掉了原始格式占位符（如 <code className={`font-mono px-1 py-0.5 rounded ${isDarkMode ? 'bg-slate-900 text-amber-400' : 'bg-slate-200 text-amber-800'}`}>%s</code>, <code className={`font-mono px-1 py-0.5 rounded ${isDarkMode ? 'bg-slate-900 text-amber-400' : 'bg-slate-200 text-amber-800'}`}>%d</code> 等），防止还原英文编译时发生崩溃。
                  </p>
                  <button
                    onClick={handleCheckPlaceholders}
                    className={`w-full py-1.5 rounded text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                      isDarkMode 
                        ? 'bg-[#37373D] hover:bg-[#3E3E40] text-slate-200 hover:text-white border-slate-700/50' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-sm'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                    <span>一键占位符一致性校验</span>
                  </button>

                  {/* Placeholder check result area */}
                  {hasCheckedPlaceholders && (
                    <div className={`mt-2 text-[11px] border-t pt-2 space-y-1 ${isDarkMode ? 'border-slate-800/85' : 'border-slate-200'}`}>
                      {placeholderErrors.length === 0 ? (
                        <div className={`flex items-center gap-1 py-0.5 px-1 rounded text-[10px] ${
                          isDarkMode ? 'text-[#73C991] bg-[#1E3A1E]/20' : 'text-emerald-700 bg-emerald-50'
                        }`}>
                          <span>✓ 格式匹配完美，未发现格式缺失</span>
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          <span className="text-rose-500 font-bold block text-[10px] mb-1">
                            ⚠️ 检测到 {placeholderErrors.length} 处占位符隐患:
                          </span>
                          {placeholderErrors.map((err, idx) => (
                            <div
                              key={idx}
                              className={`p-1.5 border rounded text-[10px] font-mono cursor-pointer transition-colors ${
                                isDarkMode 
                                  ? 'bg-[#3B1C1C]/40 border-red-900/30 text-rose-300 hover:bg-red-950/20' 
                                  : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                              }`}
                              onClick={() => {
                                const el = document.getElementById(`diff-line-${err.line - 1}`);
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                            >
                              <span className="font-bold underline block mb-0.5 font-mono">第 {err.line} 行:</span>
                              <span className="leading-tight block opacity-90">{err.msg}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Batch apply glossary terms */}
                <div className={`p-2.5 rounded border space-y-2 ${
                  isDarkMode ? 'bg-[#1E1E1E]/50 border-slate-800/40' : 'bg-slate-100/60 border-slate-200'
                }`}>
                  <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-amber-500" />
                    <span>术语规范器 (Glossary Sync)</span>
                  </span>
                  <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    一键扫描并应用“中文编程术语映射”中的全部中文规则，保证中文代码命名标识符百分百一致。
                  </p>
                  <button
                    onClick={handleApplyGlossary}
                    className={`w-full py-1.5 rounded text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isDarkMode 
                        ? 'bg-[#37373D] hover:bg-[#3E3E40] text-amber-400 hover:text-white border-amber-500/10' 
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 shadow-sm'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                    <span>应用专业术语映射</span>
                  </button>
                </div>

                {/* 4. Output Copying & Testing */}
                <div className={`p-2.5 rounded border space-y-2 ${
                  isDarkMode ? 'bg-[#1E1E1E]/50 border-slate-800/40' : 'bg-slate-100/60 border-slate-200'
                }`}>
                  <span className={`text-[11px] font-bold flex items-center gap-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                    <Info className="w-3.5 h-3.5 text-sky-450" />
                    <span>映射代码导出与调试</span>
                  </span>
                  <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    将当前编写的中文 C++ 代码对应的英文可编译代码一键复制至剪贴板或准备发布。
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleCopyCode}
                      className={`py-1 px-2 rounded text-[11px] border flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                        isDarkMode 
                          ? 'bg-[#37373D] hover:bg-[#3E3E40] text-slate-300 hover:text-white border-slate-700/50' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
                      }`}
                      title="复制代码"
                    >
                      <Copy className="w-3 h-3" />
                      <span>复制代码</span>
                    </button>
                    <button
                      onClick={onRunBuild}
                      className="py-1 px-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-sm"
                      title="模拟在系统内进行程序构建测试"
                    >
                      <Terminal className="w-3 h-3" />
                      <span>构建测试</span>
                    </button>
                  </div>
                </div>

                {/* 5. Reset File Translations */}
                <div className="pt-2">
                  {showResetConfirm ? (
                    <div className={`p-2.5 rounded border space-y-2 ${
                      isDarkMode ? 'bg-red-950/20 border-red-500/20' : 'bg-red-50 border-red-200'
                    }`}>
                      <p className={`text-[10px] leading-normal ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
                        确认清空本文件 ({activeFile.name}) 的全部中文代码，将其重置为标准原生英文代码吗？此操作无法撤销。
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleResetFile}
                          className="flex-1 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer shadow-sm"
                        >
                          确认重置
                        </button>
                        <button
                          onClick={() => setShowResetConfirm(false)}
                          className={`flex-1 py-1 rounded text-[10px] cursor-pointer ${
                            isDarkMode ? 'bg-[#37373D] hover:bg-[#3E3E40] text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                          }`}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowResetConfirm(true)}
                      className="w-full py-1.5 rounded hover:bg-rose-950/10 text-rose-600 hover:text-rose-700 text-xs font-semibold border border-rose-450/40 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                      <span>恢复原始英文 (重置)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: DOCUMENT OUTLINE ================= */}
          {activeTab === 'outline' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden font-sans">
              <div className={`p-2.5 border-b flex items-center justify-between shrink-0 ${
                isDarkMode ? 'border-[#181818] bg-[#2D2D2D]/20' : 'border-slate-200 bg-slate-100/60'
              }`}>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">文本与函数模块</span>
                <span className={`text-[10px] px-1.5 py-0.5 border rounded ${
                  isDarkMode 
                    ? 'bg-[#1E1E1E] text-slate-400 border-slate-700/40' 
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {activeFile.strings.length} 个模块
                </span>
              </div>

              <div className={`p-2 text-[10.5px] border-b shrink-0 leading-relaxed ${
                isDarkMode ? 'text-slate-400 bg-[#1E1E1E]/10 border-slate-800' : 'text-slate-600 bg-slate-50 border-slate-200'
              }`}>
                双击或单击模块项可直接在 comparative editor (对比编辑器) 中<strong className={isDarkMode ? 'text-[#007ACC]' : 'text-blue-600'}>精确滚动并闪烁定位</strong>到该代码位置。
              </div>

              {/* Interactive Symbols Outline list */}
              <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-2">
                <div className="text-slate-500 uppercase text-[9px] tracking-widest font-bold font-sans">代码节点与符号类型</div>
                
                <div className="space-y-1 font-sans">
                  {/* Scope specific nodes */}
                  {activeFile.language === 'cpp' ? (
                    <div className={`border rounded p-2 space-y-1.5 ${
                      isDarkMode ? 'border-slate-800/50 bg-[#1E1E1E]/30' : 'border-slate-200 bg-slate-100/40'
                    }`}>
                      <div className={`font-mono text-[10px] uppercase border-b pb-1 mb-1 font-sans ${isDarkMode ? 'text-slate-500 border-slate-800' : 'text-slate-500 border-slate-200'}`}>C++ Subroutines</div>
                      <div className={`flex items-center gap-1.5 cursor-pointer text-xs ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`} onClick={() => onRunBuild()}>
                        <span className={`font-bold text-[9px] px-1 rounded font-mono ${isDarkMode ? 'bg-indigo-950/50 text-indigo-300' : 'bg-indigo-55 text-indigo-700 border border-indigo-100'}`}>FUNC</span>
                        <span>wWinMain(...)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 cursor-pointer text-xs ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`} onClick={() => onRunBuild()}>
                        <span className={`font-bold text-[9px] px-1 rounded font-mono ${isDarkMode ? 'bg-indigo-950/50 text-indigo-300' : 'bg-indigo-55 text-indigo-700 border border-indigo-100'}`}>FUNC</span>
                        <span>InitInstance(...)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 cursor-pointer text-xs ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`} onClick={() => onRunBuild()}>
                        <span className={`font-bold text-[9px] px-1 rounded font-mono ${isDarkMode ? 'bg-indigo-950/50 text-indigo-300' : 'bg-indigo-55 text-indigo-700 border border-indigo-100'}`}>FUNC</span>
                        <span>WndProc(...)</span>
                      </div>
                    </div>
                  ) : activeFile.language === 'resource' ? (
                    <div className={`border rounded p-2 space-y-1.5 ${
                      isDarkMode ? 'border-slate-800/50 bg-[#1E1E1E]/30' : 'border-slate-200 bg-slate-100/40'
                    }`}>
                      <div className={`font-mono text-[10px] uppercase border-b pb-1 mb-1 font-sans ${isDarkMode ? 'text-slate-500 border-slate-800' : 'text-slate-500 border-slate-200'}`}>Win32 Resource Elements</div>
                      <div className={`flex items-center gap-1.5 text-xs ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                        <span className={`font-bold text-[9px] px-1 rounded font-mono ${isDarkMode ? 'bg-amber-950/50' : 'bg-amber-50 text-amber-800 border border-amber-100'}`}>TABL</span>
                        <span>STRINGTABLE (资源字符串表)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        <span className={`font-bold text-[9px] px-1 rounded font-mono ${isDarkMode ? 'bg-emerald-950/50' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'}`}>DLG</span>
                        <span>IDD_ABOUTBOX (关于对话框窗体)</span>
                      </div>
                    </div>
                  ) : activeFile.language === 'header' ? (
                    <div className={`border rounded p-2 space-y-1.5 ${
                      isDarkMode ? 'border-slate-800/50 bg-[#1E1E1E]/30' : 'border-slate-200 bg-slate-100/40'
                    }`}>
                      <div className={`font-mono text-[10px] uppercase border-b pb-1 mb-1 font-sans ${isDarkMode ? 'text-slate-500 border-slate-800' : 'text-slate-500 border-slate-200'}`}>Macros Definitions</div>
                      <div className={`flex items-center gap-1.5 text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        <span className={`font-bold text-[9px] px-1 rounded font-mono ${isDarkMode ? 'bg-slate-900' : 'bg-slate-200 text-slate-800'}`}>DEF</span>
                        <span>IDS_APP_TITLE</span>
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        <span className={`font-bold text-[9px] px-1 rounded font-mono ${isDarkMode ? 'bg-slate-900' : 'bg-slate-200 text-slate-800'}`}>DEF</span>
                        <span>IDM_ABOUT</span>
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        <span className={`font-bold text-[9px] px-1 rounded font-mono ${isDarkMode ? 'bg-slate-900' : 'bg-slate-200 text-slate-800'}`}>DEF</span>
                        <span>IDM_EXIT</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Extracted string lines */}
                <div className="text-slate-500 uppercase text-[9px] tracking-widest font-bold font-sans pt-3">中文代码局部映射符号</div>
                <div className="space-y-1.5">
                  {activeFile.strings.map(s => (
                    <div
                      key={s.id}
                      onClick={() => {
                        const el = document.getElementById(`diff-line-${s.line - 1}`);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          el.classList.add('animate-pulse', 'bg-blue-500/20');
                          setTimeout(() => el.classList.remove('animate-pulse', 'bg-blue-500/20'), 1500);
                        }
                      }}
                      className={`p-2 rounded border transition-colors cursor-pointer group flex flex-col gap-1 text-[11px] ${
                        isDarkMode 
                          ? 'bg-[#1E1E1E]/40 hover:bg-[#2A2D2E]/60 border-slate-800/60 text-slate-300' 
                          : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-center text-[9px] text-[#888] font-sans">
                        <span className={`font-mono px-1 py-0.2 rounded font-semibold ${
                          isDarkMode ? 'bg-slate-900 text-[#007ACC]' : 'bg-slate-100 text-blue-600'
                        }`}>第 {s.line} 行</span>
                        <span className="font-sans font-bold capitalize text-slate-400">
                          {s.type === 'string' ? '字符串' : s.type === 'comment' ? '注释' : s.type}
                        </span>
                      </div>
                      <div className={`truncate text-[11px] font-mono select-text font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                        {s.original}
                      </div>
                      {s.translated && (
                        <div className={`truncate font-sans text-[10.5px] border-t pt-1 flex items-center gap-1 ${
                          isDarkMode ? 'text-[#73C991] border-slate-800/40' : 'text-emerald-600 border-slate-100'
                        }`}>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="truncate">{s.translated}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
