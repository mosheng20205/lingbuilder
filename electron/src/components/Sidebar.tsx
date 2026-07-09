import React, { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  FileCode,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Play,
  AlertTriangle,
  Wrench,
  Sparkles,
  RefreshCw,
  FolderMinus,
  Plus,
  Trash2,
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
  CheckCircle,
  Monitor,
  Package
} from 'lucide-react';
import { CppFile, ExtractedString, GlossaryTerm, SourceControlStatus } from '../types';
import ModuleInspector from './ModuleInspector';
import {
  createBlankWindow,
  getLingWindowSourceFileName,
  readWindowDesignerState,
  saveWindowDesignerState,
  WINDOW_DESIGNER_PROJECT_UPDATED,
  PersistedWindowDesignerState
} from '../services/windowDesigner/windowDesignerService';
import type { LingWindowModel } from '../services/windowDesigner/types';
import type { InstalledModule } from '../services/modules/types';
import { BUILTIN_MODULES } from '../services/modules/builtinModules';

type WindowContextMenu =
  | { x: number; y: number; target: 'group' }
  | { x: number; y: number; target: 'window'; windowModel: LingWindowModel };

type ModuleContextMenu = { x: number; y: number; module: InstalledModule };

interface ModuleParameterDoc {
  name: string;
  type: string;
  example: string;
  description: string;
}

interface SidebarProps {
  files: CppFile[];
  activeFile: CppFile;
  onSelectFile: (file: CppFile, forceCodeView?: boolean) => void;
  onRunBuild: () => void;
  isBuilding: boolean;
  isDarkMode?: boolean;
  showLeftSidebar?: boolean;
  setShowLeftSidebar?: (val: boolean) => void;
  onBatchTranslate?: (translations: { id: string; translated: string }[]) => void;
  onSetStatus?: (id: string, status: 'translated' | 'skipped' | 'pending') => void;
  glossary?: GlossaryTerm[];
  drawerWidth?: number;
  onDeleteFile?: (file: CppFile) => void;
  onRenameFile?: (file: CppFile, newName: string) => void;
  sourceControlStatus?: SourceControlStatus | null;
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
  drawerWidth = 264,
  onDeleteFile,
  onRenameFile,
  sourceControlStatus = null
}: SidebarProps) {
  // Tabs: 'explorer' (解决方案), 'actions' (快捷工具), 'outline' (大纲视图)
  const [activeTab, setActiveTab] = useState<'explorer' | 'actions' | 'outline'>('explorer');
  const [isSolutionOpen, setIsSolutionOpen] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: CppFile } | null>(null);
  const [windowContextMenu, setWindowContextMenu] = useState<WindowContextMenu | null>(null);
  const [moduleContextMenu, setModuleContextMenu] = useState<ModuleContextMenu | null>(null);
  const [moduleInfoDialog, setModuleInfoDialog] = useState<InstalledModule | null>(null);
  const [designerState, setDesignerState] = useState(() => readWindowDesignerState());

  useEffect(() => {
    const handleCloseMenu = () => {
      setContextMenu(null);
      setWindowContextMenu(null);
      setModuleContextMenu(null);
    };
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);
  const [isSrcOpen, setIsSrcOpen] = useState(true);
  const [isWindowsOpen, setIsWindowsOpen] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isProjectModulesOpen, setIsProjectModulesOpen] = useState(true);
  const [expandedModuleIds, setExpandedModuleIds] = useState<Record<string, boolean>>({});
  const [expandedModuleGroups, setExpandedModuleGroups] = useState<Record<string, boolean>>({});
  const [projectModules, setProjectModules] = useState<InstalledModule[]>([]);
  const [projectModulesStatus, setProjectModulesStatus] = useState('正在读取项目模块...');
  const [selectedModuleInspectorId, setSelectedModuleInspectorId] = useState<string | null>(null);
  
  // Search query for files
  const [fileSearch, setFileSearch] = useState('');

  // States for Quick Actions panel
  const [isTranslating, setIsTranslating] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [placeholderErrors, setPlaceholderErrors] = useState<{ line: number; msg: string; text: string }[]>([]);
  const [hasCheckedPlaceholders, setHasCheckedPlaceholders] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Group files by directories
  const normalizedFileSearch = fileSearch.trim().toLowerCase();
  const includesSearch = (...values: Array<string | undefined>) => (
    !normalizedFileSearch || values.some(value => value?.toLowerCase().includes(normalizedFileSearch))
  );
  const srcFiles = files.filter(f => f.path.startsWith('src/') && includesSearch(f.name, f.path));
  const configFiles = files.filter(f => f.path.startsWith('config/') && includesSearch(f.name, f.path));
  const designerWindows = designerState.project.windows.filter(windowModel => includesSearch(
    windowModel.title,
    windowModel.fileName,
    windowModel.className,
    getLingWindowSourceFileName(windowModel.fileName, windowModel.className)
  ));
  const filteredProjectModules = projectModules.filter(module => includesSearch(
    module.manifest.name,
    module.manifest.id,
    module.manifest.description,
    module.manifest.category,
    ...(module.manifest.tags || []),
    ...(module.manifest.contributes?.commands || []).flatMap(command => [
      command.name,
      command.signature,
      command.description,
      command.returnType,
      command.cppRuntimeName
    ]),
    ...(module.manifest.contributes?.types || []).flatMap(type => [type.name, type.description, type.cppType]),
    ...(module.manifest.contributes?.designerControls || []).flatMap(control => [
      control.label,
      control.type,
      ...(control.events || []).flatMap(event => [event.label, event.handlerPattern])
    ]),
    ...(module.manifest.contributes?.snippets || []).flatMap(snippet => [snippet.label, snippet.description]),
    ...(module.manifest.contributes?.docs || []).flatMap(doc => [doc.title, doc.path])
  ));

  const refreshProjectModules = useCallback(async () => {
    const projectId = designerState.project.id || 'lingbuilder-ui-project';
    try {
      const result = await fetchJson(`/api/modules/project?projectId=${encodeURIComponent(projectId)}`);
      if (!result.ok) throw new Error(result.error || '项目模块读取失败');
      const modules = Array.isArray(result.modules) ? result.modules as InstalledModule[] : [];
      setProjectModules(modules.length > 0 ? modules : getFallbackProjectModules());
      setProjectModulesStatus(modules.length > 0 ? '项目模块已载入' : '当前项目未启用模块');
    } catch (error) {
      setProjectModules(getFallbackProjectModules());
      setProjectModulesStatus('模块服务等待重启，已显示内置基础模块');
    }
  }, [designerState.project.id]);

  useEffect(() => {
    const handleDesignerProjectUpdated = (event: Event) => {
      const detail = (event as CustomEvent<PersistedWindowDesignerState>).detail;
      setDesignerState(detail || readWindowDesignerState());
    };

    window.addEventListener(WINDOW_DESIGNER_PROJECT_UPDATED, handleDesignerProjectUpdated);
    return () => {
      window.removeEventListener(WINDOW_DESIGNER_PROJECT_UPDATED, handleDesignerProjectUpdated);
    };
  }, []);

  useEffect(() => {
    refreshProjectModules();
  }, [refreshProjectModules]);

  useEffect(() => {
    const handleModulesChanged = () => refreshProjectModules();
    window.addEventListener('lingbuilder-modules-changed', handleModulesChanged);
    return () => window.removeEventListener('lingbuilder-modules-changed', handleModulesChanged);
  }, [refreshProjectModules]);

  const openModuleInspector = useCallback((moduleId: string) => {
    setSelectedModuleInspectorId(moduleId);
    setActiveTab('outline');
    if (setShowLeftSidebar) setShowLeftSidebar(true);
  }, [setShowLeftSidebar]);

  const toggleModuleInterface = useCallback((moduleId: string) => {
    setExpandedModuleIds(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
  }, []);

  const toggleModuleGroup = useCallback((groupId: string) => {
    setExpandedModuleGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const getProgress = (file: CppFile) => {
    const total = file.strings.length;
    const translated = file.strings.filter(s => s.status === 'translated').length;
    return total === 0 ? 100 : Math.round((translated / total) * 100);
  };

  const getSourceFileForWindow = (windowModel: LingWindowModel) => {
    const sourceName = getLingWindowSourceFileName(windowModel.fileName, windowModel.className);
    const sourcePath = `src/${sourceName}`;
    return files.find(file => file.path === sourcePath || file.name === sourceName);
  };

  const handleOpenDesignerWindow = (windowModel: LingWindowModel) => {
    const sourceName = getLingWindowSourceFileName(windowModel.fileName, windowModel.className);
    const sourceFile = getSourceFileForWindow(windowModel);

    if (!sourceFile) {
      triggerSuccess(`未找到 ${sourceName}，请先在设计器中保存或重新生成窗口代码文件。`);
      return;
    }

    setDesignerState(prev => ({
      ...prev,
      activeWindowId: windowModel.id,
      selectedControlId: windowModel.controls[0]?.id || null
    }));
    onSelectFile(sourceFile, false);
    window.dispatchEvent(new CustomEvent('show-window-designer'));
  };

  const commitDesignerState = (nextState: PersistedWindowDesignerState) => {
    const savedState = saveWindowDesignerState(nextState);
    setDesignerState(savedState);
    return savedState;
  };

  const handleCreateWindowFromExplorer = () => {
    const nextWindow = createBlankWindow(designerState.project.windows.length + 1);
    commitDesignerState({
      project: {
        ...designerState.project,
        windows: [...designerState.project.windows, nextWindow]
      },
      activeWindowId: nextWindow.id,
      selectedControlId: nextWindow.controls[0]?.id || null
    });
    setIsWindowsOpen(true);
    window.dispatchEvent(new CustomEvent('window-added', { detail: nextWindow }));
    window.dispatchEvent(new CustomEvent('show-window-designer'));
    triggerSuccess(`已新建窗口：${nextWindow.fileName}`);
  };

  const handleDuplicateWindowFromExplorer = (windowModel: LingWindowModel) => {
    const cloneIndex = designerState.project.windows.length + 1;
    const clonedWindow: LingWindowModel = {
      ...windowModel,
      id: `window_clone_${Date.now()}`,
      fileName: `CopyOf${windowModel.fileName}`,
      className: `${windowModel.className}副本`,
      title: `${windowModel.title} 副本`,
      controls: windowModel.controls.map(control => ({
        ...control,
        id: `${control.id}_copy_${cloneIndex}`,
        name: `${control.name}_副本`
      }))
    };

    commitDesignerState({
      project: {
        ...designerState.project,
        windows: [...designerState.project.windows, clonedWindow]
      },
      activeWindowId: clonedWindow.id,
      selectedControlId: clonedWindow.controls[0]?.id || null
    });
    setIsWindowsOpen(true);
    window.dispatchEvent(new CustomEvent('window-duplicated', { detail: clonedWindow }));
    window.dispatchEvent(new CustomEvent('show-window-designer'));
    triggerSuccess(`已复制窗口：${clonedWindow.fileName}`);
  };

  const handleDeleteWindowFromExplorer = (windowModel: LingWindowModel) => {
    if (designerState.project.windows.length <= 1) {
      triggerSuccess('至少需要保留一个窗口，未执行删除。');
      return;
    }

    const currentIndex = designerState.project.windows.findIndex(window => window.id === windowModel.id);
    const nextWindows = designerState.project.windows.filter(window => window.id !== windowModel.id);
    const nextWindow = nextWindows[Math.max(0, currentIndex - 1)] || nextWindows[0];

    commitDesignerState({
      project: {
        ...designerState.project,
        windows: nextWindows
      },
      activeWindowId: nextWindow.id,
      selectedControlId: nextWindow.controls[0]?.id || null
    });
    window.dispatchEvent(new CustomEvent('window-deleted', {
      detail: { deletedWindow: windowModel, nextWindow }
    }));
    triggerSuccess(`已删除窗口：${windowModel.fileName}`);
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
        onContextMenu={(e) => {
          e.preventDefault();
          setWindowContextMenu(null);
          setContextMenu({ x: e.clientX, y: e.clientY, file });
        }}
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
          {file.name.endsWith('.cpp') ? (
            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-sky-500/15 text-sky-400 border border-sky-500/20 select-none shrink-0 font-sans">C++</span>
          ) : file.name.endsWith('.h') ? (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20 select-none shrink-0 font-sans">H</span>
          ) : file.name.endsWith('.lcpp') ? (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 select-none shrink-0 font-sans">中C</span>
          ) : file.name.endsWith('.e') ? (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 select-none shrink-0 font-sans">易</span>
          ) : (
            <FileCode className={`w-3.5 h-3.5 shrink-0 ${
              file.name.endsWith('.rc')
                ? 'text-rose-400'
                : file.name.endsWith('.ini')
                  ? 'text-amber-400'
                  : isActive ? (isDarkMode ? 'text-[#007ACC]' : 'text-blue-600') : 'text-slate-400'
            }`} />
          )}
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

  const renderWindowRow = (windowModel: LingWindowModel) => {
    const sourceName = getLingWindowSourceFileName(windowModel.fileName, windowModel.className);
    const isActive = activeFile.name === sourceName;

    return (
      <button
        type="button"
        key={windowModel.id}
        onClick={() => handleOpenDesignerWindow(windowModel)}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setContextMenu(null);
          setWindowContextMenu({
            x: event.clientX,
            y: event.clientY,
            target: 'window',
            windowModel
          });
        }}
        title={`打开窗口设计器：${windowModel.title} (${windowModel.fileName})`}
        aria-label={`打开窗口设计器：${windowModel.title}`}
        className={`group w-full flex items-center justify-between gap-2 py-1 px-3 pl-8 text-xs cursor-pointer border-l-2 transition-all text-left ${
          isActive
            ? isDarkMode
              ? 'bg-[#37373D] border-amber-500 text-amber-300 font-medium'
              : 'bg-amber-50 border-amber-500 text-amber-700 font-semibold'
            : isDarkMode
              ? 'border-transparent text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white'
              : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Monitor className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-400' : 'text-amber-500'}`} />
          <span className="min-w-0 flex flex-col leading-tight">
            <span className="truncate">{windowModel.title}</span>
            <span className={`truncate text-[9px] ${isDarkMode ? 'text-slate-500 group-hover:text-slate-400' : 'text-slate-400 group-hover:text-slate-500'}`}>
              {windowModel.fileName}
            </span>
          </span>
        </span>
        <span className={`shrink-0 text-[9px] px-1 rounded border ${
          isDarkMode
            ? 'bg-[#1E1E1E] border-amber-500/20 text-amber-300'
            : 'bg-white border-amber-200 text-amber-700'
        }`}>
          {windowModel.controls.length}
        </span>
      </button>
    );
  };

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    return (
      <div
        style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        className={`fixed z-[9999] min-w-[140px] py-1 rounded shadow-lg border text-xs select-none ${
          isDarkMode 
            ? 'bg-[#252526] border-[#454545] text-slate-200' 
            : 'bg-white border-slate-250 text-slate-800'
        }`}
        onClick={() => setContextMenu(null)}
      >
        <div
          className={`px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer transition-colors flex items-center gap-1.5`}
          onClick={() => onSelectFile(contextMenu.file)}
        >
          <span>打开文件 (O)</span>
        </div>
        <div
          className={`px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer transition-colors`}
          onClick={() => {
            navigator.clipboard.writeText(contextMenu.file.path);
            triggerSuccess('已复制文件绝对路径');
          }}
        >
          <span>复制路径 (C)</span>
        </div>
        <div
          className={`px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer transition-colors`}
          onClick={() => {
            const newName = window.prompt(`重命名文件 ${contextMenu.file.name}`, contextMenu.file.name);
            if (newName && newName.trim() && newName !== contextMenu.file.name) {
              onRenameFile?.(contextMenu.file, newName.trim());
              triggerSuccess(`重命名文件为 ${newName.trim()}`);
            }
          }}
        >
          <span>重命名 (R)</span>
        </div>
        <div className="h-[1px] bg-slate-700/20 dark:bg-slate-700/50 my-1" />
        <div
          className={`px-3 py-1.5 text-rose-500 hover:bg-rose-500 hover:text-white cursor-pointer transition-colors`}
          onClick={() => {
            onDeleteFile?.(contextMenu.file);
          }}
        >
          <span>删除文件 (D)</span>
        </div>
      </div>
    );
  };

  const renderWindowContextMenu = () => {
    if (!windowContextMenu) return null;

    const canDeleteWindow = designerState.project.windows.length > 1;
    const menuItemClass = `px-3 py-1.5 cursor-pointer transition-colors flex items-center gap-2 ${
      isDarkMode ? 'hover:bg-blue-500 hover:text-white' : 'hover:bg-blue-500 hover:text-white'
    }`;
    const disabledMenuItemClass = `px-3 py-1.5 flex items-center gap-2 cursor-not-allowed ${
      isDarkMode ? 'text-slate-600' : 'text-slate-400'
    }`;

    return (
      <div
        style={{ top: `${windowContextMenu.y}px`, left: `${windowContextMenu.x}px` }}
        className={`fixed z-[9999] min-w-[168px] py-1 rounded shadow-lg border text-xs select-none font-sans ${
          isDarkMode
            ? 'bg-[#252526] border-[#454545] text-slate-200'
            : 'bg-white border-slate-250 text-slate-800'
        }`}
        onClick={() => setWindowContextMenu(null)}
      >
        {windowContextMenu.target === 'window' && (
          <>
            <div
              className={menuItemClass}
              onClick={() => handleOpenDesignerWindow(windowContextMenu.windowModel)}
            >
              <Monitor className="w-3.5 h-3.5 text-amber-500" />
              <span>打开设计器 (O)</span>
            </div>
            <div
              className={menuItemClass}
              onClick={() => handleDuplicateWindowFromExplorer(windowContextMenu.windowModel)}
            >
              <Copy className="w-3.5 h-3.5 text-sky-500" />
              <span>复制窗口 (C)</span>
            </div>
            <div className="h-[1px] bg-slate-700/20 dark:bg-slate-700/50 my-1" />
            <div
              className={canDeleteWindow ? `${menuItemClass} text-rose-500 hover:bg-rose-500` : disabledMenuItemClass}
              title={canDeleteWindow ? '删除当前窗口及对应中文代码文件' : '至少需要保留一个窗口'}
              onClick={(event) => {
                event.stopPropagation();
                if (!canDeleteWindow) {
                  triggerSuccess('至少需要保留一个窗口，未执行删除。');
                  setWindowContextMenu(null);
                  return;
                }
                handleDeleteWindowFromExplorer(windowContextMenu.windowModel);
                setWindowContextMenu(null);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>删除窗口 (D)</span>
            </div>
          </>
        )}

        {windowContextMenu.target === 'group' && (
          <>
            <div
              className={menuItemClass}
              onClick={() => handleCreateWindowFromExplorer()}
            >
              <Plus className="w-3.5 h-3.5 text-emerald-500" />
              <span>新建窗口 (N)</span>
            </div>
            <div
              className={menuItemClass}
              onClick={() => setIsWindowsOpen(prev => !prev)}
            >
              {isWindowsOpen ? (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{isWindowsOpen ? '折叠窗口组' : '展开窗口组'}</span>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderModuleContextMenu = () => {
    if (!moduleContextMenu) return null;
    const module = moduleContextMenu.module;
    const isExpanded = Boolean(expandedModuleIds[module.manifest.id]);
    const menuItemClass = `px-3 py-1.5 cursor-pointer transition-colors flex items-center gap-2 ${
      isDarkMode ? 'hover:bg-blue-500 hover:text-white' : 'hover:bg-blue-500 hover:text-white'
    }`;

    return (
      <div
        style={{ top: `${moduleContextMenu.y}px`, left: `${moduleContextMenu.x}px` }}
        className={`fixed z-[9999] min-w-[190px] py-1 rounded shadow-lg border text-xs select-none font-sans ${
          isDarkMode
            ? 'bg-[#252526] border-[#454545] text-slate-200'
            : 'bg-white border-slate-250 text-slate-800'
        }`}
        onClick={() => setModuleContextMenu(null)}
      >
        <div
          className={menuItemClass}
          onClick={() => {
            setModuleInfoDialog(module);
            setModuleContextMenu(null);
          }}
        >
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span>查看模块信息 (V)</span>
        </div>
        <div
          className={menuItemClass}
          onClick={() => {
            setExpandedModuleIds(prev => ({ ...prev, [module.manifest.id]: !isExpanded }));
            setModuleContextMenu(null);
          }}
        >
          {isExpanded ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          <span>{isExpanded ? '折叠接口树' : '展开接口树'}</span>
        </div>
        <div
          className={menuItemClass}
          onClick={() => {
            openModuleInspector(module.manifest.id);
            setModuleContextMenu(null);
          }}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-violet-400" />
          <span>打开模块管理器 (O)</span>
        </div>
        <div className="h-[1px] bg-slate-700/20 dark:bg-slate-700/50 my-1" />
        <div
          className={menuItemClass}
          onClick={() => {
            navigator.clipboard.writeText(module.manifest.id);
            triggerSuccess('已复制模块 ID');
            setModuleContextMenu(null);
          }}
        >
          <Copy className="w-3.5 h-3.5 text-emerald-400" />
          <span>复制模块 ID (C)</span>
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
                <div className="flex items-center gap-2 text-slate-400">
                  <RefreshCw 
                    className="w-3.5 h-3.5 hover:text-slate-200 cursor-pointer transition-colors" 
                    title="刷新" 
                    onClick={() => {
                      if (onSelectFile && activeFile) {
                        onSelectFile(activeFile);
                      }
                    }} 
                  />
                  <FolderMinus 
                    className="w-3.5 h-3.5 hover:text-slate-200 cursor-pointer transition-colors" 
                    title="折叠全部" 
                    onClick={() => {
                      setIsSolutionOpen(false);
                      setIsWindowsOpen(false);
                      setIsSrcOpen(false);
                      setIsConfigOpen(false);
                    }} 
                  />
                </div>
              </div>

              {/* File Search Input */}
              <div className="p-2 border-b shrink-0" style={{ borderColor: isDarkMode ? '#181818' : '#e2e8f0', backgroundColor: isDarkMode ? 'transparent' : '#f8fafc' }}>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={fileSearch}
                    onChange={e => setFileSearch(e.target.value)}
                    placeholder="搜索文件或窗口..."
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
                <div className={`mt-2 rounded border px-2 py-1.5 text-[10px] font-sans ${
                  isDarkMode ? 'border-[#2d2d34] bg-[#1E1E1E] text-slate-400' : 'border-slate-200 bg-white text-slate-600'
                }`}>
                  {sourceControlStatus?.isRepository ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">Git: {sourceControlStatus.branch || 'detached'}</span>
                      <span className="text-amber-500 font-semibold">{sourceControlStatus.files.length} 个改动</span>
                    </div>
                  ) : (
                    <span>Git: 当前目录未检测到可用仓库状态</span>
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
                    <div className="pl-1.5 border-l border-slate-750/30 dark:border-slate-800 ml-4">
                      {/* Project Subnode */}
                      <div className={`flex items-center gap-1.5 px-4 py-1 text-xs font-bold font-sans ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        <div className="w-2.5 h-2.5 rounded-sm bg-purple-600"></div>
                        <span className="text-purple-600 font-bold">GameClient (Visual C++)</span>
                      </div>

                      {/* Project modules group */}
                      <div className="pl-2 mt-1">
                        <div
                          onClick={() => setIsProjectModulesOpen(!isProjectModulesOpen)}
                          className={`flex items-center gap-1 px-2 py-1 cursor-pointer text-xs font-sans transition-colors ${
                            isDarkMode ? 'hover:bg-[#2A2D2E]/50 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                          title="查看和配置当前项目所使用的模块"
                        >
                          {isProjectModulesOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          <Layers className="w-3.5 h-3.5 text-violet-500" />
                          <span className="truncate">模块</span>
                          <span className={`ml-auto text-[9px] px-1 rounded border ${
                            isDarkMode ? 'border-violet-500/20 text-violet-300 bg-violet-500/5' : 'border-violet-200 text-violet-700 bg-violet-50'
                          }`}>
                            {projectModules.length}
                          </span>
                        </div>
                        {isProjectModulesOpen && (
                          <div className="mt-0.5 border-l border-slate-750/30 dark:border-slate-800 ml-3.5 pl-0.5">
                            <button
                              onClick={() => {
                                setActiveTab('outline');
                                if (setShowLeftSidebar) setShowLeftSidebar(true);
                              }}
                              className={`w-[calc(100%-4px)] ml-1 mb-1 flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-sans text-left cursor-pointer transition-colors ${
                                isDarkMode
                                  ? 'text-violet-300 hover:text-violet-100 hover:bg-violet-500/10 border border-violet-500/20'
                                  : 'text-violet-700 hover:text-violet-900 hover:bg-violet-50 border border-violet-200'
                              }`}
                              title="打开模块管理器，安装、卸载、启用或禁用项目模块"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              <span className="truncate">配置项目所使用模块</span>
                            </button>
                            {filteredProjectModules.length === 0 ? (
                              <div className="pl-8 text-slate-500 text-[10px] py-1 font-sans">{projectModulesStatus}</div>
                            ) : (
                              filteredProjectModules.map(module => {
                                const moduleId = module.manifest.id;
                                const isModuleExpanded = Boolean(expandedModuleIds[moduleId]);
                                const capabilityCount = getModuleCapabilityCount(module);
                                return (
                                  <div key={moduleId} className="min-w-0">
                                    <div
                                      onContextMenu={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setContextMenu(null);
                                        setWindowContextMenu(null);
                                        setModuleContextMenu({ x: event.clientX, y: event.clientY, module });
                                      }}
                                      className={`group w-[calc(100%-4px)] flex items-center gap-1 px-1.5 py-1 ml-1 rounded text-[11px] font-sans text-left transition-colors ${
                                        isDarkMode ? 'text-slate-300 hover:bg-[#2A2D2E]/40' : 'text-slate-700 hover:bg-slate-100'
                                      }`}
                                      title={`${module.manifest.name} ${module.manifest.version}\n展开查看模块接口树，点击名称打开完整能力面板。\n${module.manifest.description}`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => toggleModuleInterface(moduleId)}
                                        className={`shrink-0 rounded p-0.5 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`}
                                        title={isModuleExpanded ? '折叠模块接口' : '展开模块接口'}
                                      >
                                        {isModuleExpanded ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                                      </button>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                      <button
                                        type="button"
                                        onClick={() => openModuleInspector(moduleId)}
                                        className="min-w-0 flex-1 truncate text-left"
                                      >
                                        {module.manifest.name}
                                      </button>
                                      <span className={`shrink-0 text-[9px] px-1 rounded ${
                                        isDarkMode ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-200 text-slate-600'
                                      }`}>
                                        {capabilityCount}
                                      </span>
                                    </div>
                                    {isModuleExpanded && (
                                      <ModuleInterfaceTree
                                        module={module}
                                        isDarkMode={isDarkMode}
                                        expandedGroups={expandedModuleGroups}
                                        onToggleGroup={toggleModuleGroup}
                                        onOpenModule={() => openModuleInspector(moduleId)}
                                      />
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>

                      {/* Window designer group */}
                      <div className="pl-2">
                        <div
                          onClick={() => setIsWindowsOpen(!isWindowsOpen)}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setContextMenu(null);
                            setWindowContextMenu({
                              x: event.clientX,
                              y: event.clientY,
                              target: 'group'
                            });
                          }}
                          className={`flex items-center gap-1 px-2 py-1 cursor-pointer text-xs font-sans transition-colors ${
                            isDarkMode ? 'hover:bg-[#2A2D2E]/50 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                          title="展开查看所有窗口，点击窗口可直接进入窗口设计器"
                        >
                          {isWindowsOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10" />
                          <span className="truncate">窗口</span>
                          <span className={`ml-auto text-[9px] px-1 rounded border ${
                            isDarkMode ? 'border-amber-500/20 text-amber-300 bg-amber-500/5' : 'border-amber-200 text-amber-700 bg-amber-50'
                          }`}>
                            {designerState.project.windows.length}
                          </span>
                        </div>
                        {isWindowsOpen && (
                          <div className="mt-0.5 border-l border-slate-750/30 dark:border-slate-800 ml-3.5 pl-0.5">
                            {designerWindows.length === 0 ? (
                              <div className="pl-8 text-slate-500 text-[10px] py-1 font-sans">未找到匹配窗口</div>
                            ) : (
                              designerWindows.map(renderWindowRow)
                            )}
                          </div>
                        )}
                      </div>

                      {/* includes / src Folder */}
                      <div className="pl-2 mt-1.5">
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
                          <div className="mt-0.5 border-l border-slate-750/30 dark:border-slate-800 ml-3.5 pl-0.5">
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
                          <div className="mt-0.5 border-l border-slate-750/30 dark:border-slate-800 ml-3.5 pl-0.5">
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
              <ModuleInspector
                isDarkMode={isDarkMode}
                selectedModuleId={selectedModuleInspectorId}
                onAddLog={(msg) => {
                  window.dispatchEvent(new CustomEvent('add-app-log', { detail: { message: msg } }));
                }}
              />
            </div>
          )}

        </div>
      )}
      {renderContextMenu()}
      {renderWindowContextMenu()}
      {renderModuleContextMenu()}
      {moduleInfoDialog && (
        <ModuleInfoDialog
          module={moduleInfoDialog}
          isDarkMode={isDarkMode}
          onClose={() => setModuleInfoDialog(null)}
        />
      )}
    </div>
  );
}

function ModuleInterfaceTree({
  module,
  isDarkMode,
  expandedGroups,
  onToggleGroup,
  onOpenModule
}: {
  module: InstalledModule;
  isDarkMode: boolean;
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (groupId: string) => void;
  onOpenModule: () => void;
}) {
  const contributes = module.manifest.contributes || {};
  const commands = contributes.commands || [];
  const types = contributes.types || [];
  const snippets = contributes.snippets || [];
  const designerControls = contributes.designerControls || [];
  const docs = contributes.docs || [];
  const cpp = contributes.cpp;
  const cppRows = [
    { label: '头文件', values: cpp?.headers || [] },
    { label: '源码', values: cpp?.sources || [] },
    { label: '库文件', values: cpp?.libs || [] },
    { label: '运行时文件', values: cpp?.runtimeFiles || [] },
    { label: '包含目录', values: cpp?.includeDirs || [] },
    { label: '宏定义', values: cpp?.defines || [] },
    { label: '文档', values: docs.map(doc => `${doc.title} · ${doc.path}`) }
  ].filter(row => row.values.length > 0);
  const hasInterface = commands.length > 0 || types.length > 0 || snippets.length > 0 || designerControls.length > 0 || cppRows.length > 0;
  const subtleClass = isDarkMode ? 'text-slate-500' : 'text-slate-500';

  if (!hasInterface) {
    return (
      <div className="ml-8 border-l border-slate-750/30 pl-2 py-1 text-[10px] font-sans text-slate-500">
        该模块暂未声明可浏览接口。
      </div>
    );
  }

  return (
    <div className="ml-8 border-l border-slate-750/30 pl-1.5 py-0.5 font-sans">
      <button
        type="button"
        onClick={onOpenModule}
        className={`mb-0.5 flex w-[calc(100%-4px)] items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-[10px] ${
          isDarkMode ? 'text-violet-300 hover:bg-violet-500/10' : 'text-violet-700 hover:bg-violet-50'
        }`}
        title="打开完整模块能力面板"
      >
        <Info className="h-3 w-3 shrink-0" />
        <span className="truncate">查看完整接口说明</span>
      </button>

      <ModuleTreeGroup
        id={`${module.manifest.id}:types`}
        title={`类型/类 ${types.length}`}
        count={types.length}
        icon={<Layers className="h-3 w-3 text-amber-400" />}
        isDarkMode={isDarkMode}
        expandedGroups={expandedGroups}
        onToggleGroup={onToggleGroup}
        defaultOpen
      >
        {types.map(type => (
          <ModuleTreeLeaf
            key={`${module.manifest.id}:type:${type.name}`}
            icon={<BookOpen className="h-3 w-3 text-amber-300" />}
            title={type.name}
            detail={type.cppType ? `${type.description} · C++ ${type.cppType}` : type.description}
            isDarkMode={isDarkMode}
          />
        ))}
      </ModuleTreeGroup>

      <ModuleTreeGroup
        id={`${module.manifest.id}:commands`}
        title={`命令接口 ${commands.length}`}
        count={commands.length}
        icon={<Wrench className="h-3 w-3 text-cyan-400" />}
        isDarkMode={isDarkMode}
        expandedGroups={expandedGroups}
        onToggleGroup={onToggleGroup}
        defaultOpen={types.length === 0}
        footer={commands.length > 120 ? `已显示前 120 个接口，可用上方搜索缩小范围。` : undefined}
      >
        {commands.slice(0, 120).map(command => (
          <ModuleTreeLeaf
            key={`${module.manifest.id}:command:${command.name}:${command.signature}`}
            icon={<FileCode className="h-3 w-3 text-cyan-300" />}
            title={command.name}
            badge={command.returnType}
            detail={command.signature}
            description={command.description}
            isDarkMode={isDarkMode}
          />
        ))}
      </ModuleTreeGroup>

      <ModuleTreeGroup
        id={`${module.manifest.id}:designer`}
        title={`设计器控件 ${designerControls.length}`}
        count={designerControls.length}
        icon={<Monitor className="h-3 w-3 text-violet-400" />}
        isDarkMode={isDarkMode}
        expandedGroups={expandedGroups}
        onToggleGroup={onToggleGroup}
      >
        {designerControls.map(control => (
          <ModuleTreeLeaf
            key={`${module.manifest.id}:control:${control.type}`}
            icon={<CheckCircle className="h-3 w-3 text-violet-300" />}
            title={control.label}
            detail={control.type}
            description={(control.events || []).map(event => `${event.label}：${event.handlerPattern}`).join('；') || '未声明事件'}
            isDarkMode={isDarkMode}
          />
        ))}
      </ModuleTreeGroup>

      <ModuleTreeGroup
        id={`${module.manifest.id}:snippets`}
        title={`代码片段 ${snippets.length}`}
        count={snippets.length}
        icon={<FileText className="h-3 w-3 text-emerald-400" />}
        isDarkMode={isDarkMode}
        expandedGroups={expandedGroups}
        onToggleGroup={onToggleGroup}
      >
        {snippets.map(snippet => (
          <ModuleTreeLeaf
            key={`${module.manifest.id}:snippet:${snippet.label}`}
            icon={<FileText className="h-3 w-3 text-emerald-300" />}
            title={snippet.label}
            detail={snippet.description}
            isDarkMode={isDarkMode}
          />
        ))}
      </ModuleTreeGroup>

      <ModuleTreeGroup
        id={`${module.manifest.id}:cpp`}
        title={`C++依赖/文档 ${cppRows.reduce((total, row) => total + row.values.length, 0)}`}
        count={cppRows.length}
        icon={<FileCode className="h-3 w-3 text-slate-400" />}
        isDarkMode={isDarkMode}
        expandedGroups={expandedGroups}
        onToggleGroup={onToggleGroup}
      >
        {cppRows.map(row => (
          <div key={`${module.manifest.id}:cpp:${row.label}`} className="min-w-0">
            <div className={`px-1.5 py-0.5 text-[10px] font-semibold ${subtleClass}`}>{row.label}</div>
            {row.values.map(value => (
              <ModuleTreeLeaf
                key={`${module.manifest.id}:cpp:${row.label}:${value}`}
                icon={<FileText className="h-3 w-3 text-slate-400" />}
                title={value}
                isDarkMode={isDarkMode}
                compact
              />
            ))}
          </div>
        ))}
      </ModuleTreeGroup>
    </div>
  );
}

function ModuleTreeGroup({
  id,
  title,
  count,
  icon,
  isDarkMode,
  expandedGroups,
  onToggleGroup,
  children,
  defaultOpen = false,
  footer
}: {
  id: string;
  title: string;
  count: number;
  icon: React.ReactNode;
  isDarkMode: boolean;
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (groupId: string) => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
  footer?: string;
}) {
  if (count === 0) return null;
  const isOpen = expandedGroups[id] ?? defaultOpen;
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => onToggleGroup(id)}
        className={`flex w-[calc(100%-4px)] items-center gap-1 rounded px-1.5 py-0.5 text-left text-[10px] ${
          isDarkMode ? 'text-slate-300 hover:bg-[#2A2D2E]/40' : 'text-slate-700 hover:bg-slate-100'
        }`}
        title={isOpen ? '折叠接口分组' : '展开接口分组'}
      >
        {isOpen ? <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" /> : <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />}
        {icon}
        <span className="min-w-0 flex-1 truncate">{title}</span>
      </button>
      {isOpen && (
        <div className="ml-3 border-l border-slate-750/30 pl-1">
          {children}
          {footer && <div className="px-1.5 py-1 text-[10px] text-slate-500">{footer}</div>}
        </div>
      )}
    </div>
  );
}

function ModuleTreeLeaf({
  icon,
  title,
  detail,
  description,
  badge,
  isDarkMode,
  compact = false
}: {
  key?: React.Key;
  icon: React.ReactNode;
  title: string;
  detail?: string;
  description?: string;
  badge?: string;
  isDarkMode: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded px-1.5 ${compact ? 'py-0.5' : 'py-1'} text-[10px] ${
        isDarkMode ? 'text-slate-300 hover:bg-[#2A2D2E]/30' : 'text-slate-700 hover:bg-slate-50'
      }`}
      title={[title, detail, description].filter(Boolean).join('\n')}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {badge && (
          <span className={`shrink-0 rounded px-1 text-[9px] ${
            isDarkMode ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
          }`}>
            {badge}
          </span>
        )}
      </div>
      {detail && <div className="ml-4 truncate font-mono text-[9px] text-slate-500">{detail}</div>}
      {description && <div className="ml-4 truncate text-[9px] text-slate-500">{description}</div>}
    </div>
  );
}

function getModuleCapabilityCount(module: InstalledModule): number {
  const contributes = module.manifest.contributes || {};
  const cpp = contributes.cpp;
  return (contributes.commands || []).length
    + (contributes.types || []).length
    + (contributes.snippets || []).length
    + (contributes.designerControls || []).length
    + (contributes.docs || []).length
    + (cpp?.headers || []).length
    + (cpp?.sources || []).length
    + (cpp?.libs || []).length
    + (cpp?.runtimeFiles || []).length;
}

function getModuleCommandParameterDocs(command: { name: string; signature: string; description: string }): ModuleParameterDoc[] {
  const match = (command.signature || '').match(/^[^(（]+[（(](.*)[）)]/u);
  if (!match || !match[1].trim()) return [];
  return match[1]
    .split(/[，,]/u)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const [rawName, rawType] = part.split(/[:：]/u).map(value => value.trim());
      const name = rawName || part;
      const builtin = getBuiltinCommandParameterDoc(command.name, name);
      return {
        name,
        type: rawType || builtin.type,
        example: builtin.example,
        description: builtin.description
      };
    });
}

function getBuiltinCommandParameterDoc(commandName: string, parameterName: string): Omit<ModuleParameterDoc, 'name'> {
  const key = `${commandName}:${parameterName}`;
  const docs: Record<string, Omit<ModuleParameterDoc, 'name'>> = {
    '信息框:内容': {
      type: '文本',
      example: '"保存成功"',
      description: '消息框正文内容，通常用于提示用户发生了什么。'
    },
    '信息框:标志': {
      type: '整数',
      example: '64',
      description: 'Win32 MessageBox 标志值，用于控制图标和按钮。常见值：64 表示信息图标，48 表示警告，16 表示错误。'
    },
    '信息框:标题': {
      type: '文本',
      example: '"提示"',
      description: '消息框标题栏文字。'
    },
    '调试输出:内容': {
      type: '文本',
      example: '"当前状态：已启动"',
      description: '要输出到调试窗口和控制台的文本。'
    }
  };
  if (docs[key]) return docs[key];
  if (/内容|文本|标题|名称|路径|消息|说明/u.test(parameterName)) {
    return { type: '文本', example: `"${parameterName}"`, description: `传入${parameterName}文本。` };
  }
  if (/标志|宽度|高度|坐标|数量|编号|ID|id|x|y|w|h/u.test(parameterName)) {
    return { type: '整数', example: '0', description: `传入${parameterName}数值。` };
  }
  if (/是否|启用|显示|公开/u.test(parameterName)) {
    return { type: '逻辑值', example: '真', description: `传入${parameterName}开关。` };
  }
  return { type: '参数', example: parameterName, description: '模块未提供该参数的详细说明，请结合命令签名和模块文档使用。' };
}

function ModuleInfoDialog({
  module,
  isDarkMode,
  onClose
}: {
  module: InstalledModule;
  isDarkMode: boolean;
  onClose: () => void;
}) {
  const [searchText, setSearchText] = useState('');
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [navWidth, setNavWidth] = useState(260);
  const [selectedInfoNodeId, setSelectedInfoNodeId] = useState<string | null>(null);
  const [expandedInfoGroups, setExpandedInfoGroups] = useState<Record<string, boolean>>({
    types: true,
    commands: true,
    designerControls: true
  });
  const manifest = module.manifest;
  const contributes = manifest.contributes || {};
  const commands = contributes.commands || [];
  const types = contributes.types || [];
  const snippets = contributes.snippets || [];
  const designerControls = contributes.designerControls || [];
  const docs = contributes.docs || [];
  const cpp = contributes.cpp;
  const normalizedSearch = searchText.trim().toLowerCase();
  const matchesSearch = (...values: Array<string | undefined>) => (
    !normalizedSearch || values.some(value => value?.toLowerCase().includes(normalizedSearch))
  );
  const filteredTypes = types.filter(type => matchesSearch(type.name, type.description, type.cppType));
  const filteredCommands = commands.filter(command => matchesSearch(
    command.name,
    command.signature,
    command.description,
    command.returnType,
    command.cppRuntimeName
  ));
  const filteredControls = designerControls.filter(control => matchesSearch(
    control.label,
    control.type,
    ...(control.events || []).flatMap(event => [event.label, event.handlerPattern])
  ));
  const filteredSnippets = snippets.filter(snippet => matchesSearch(snippet.label, snippet.description, snippet.insertText));
  const filteredDocs = docs.filter(doc => matchesSearch(doc.title, doc.path));
  const cppRows = [
    { label: '头文件', values: cpp?.headers || [] },
    { label: '源码', values: cpp?.sources || [] },
    { label: '库文件', values: cpp?.libs || [] },
    { label: '运行时文件', values: cpp?.runtimeFiles || [] },
    { label: '包含目录', values: cpp?.includeDirs || [] },
    { label: '宏定义', values: cpp?.defines || [] }
  ].map(row => ({ ...row, values: row.values.filter(value => matchesSearch(row.label, value)) })).filter(row => row.values.length > 0);
  const totalVisible = filteredTypes.length
    + filteredCommands.length
    + filteredControls.length
    + filteredSnippets.length
    + filteredDocs.length
    + cppRows.reduce((total, row) => total + row.values.length, 0);
  const panelClass = isDarkMode ? 'bg-[#1f1f1f] text-slate-100' : 'bg-white text-slate-900';
  const borderClass = isDarkMode ? 'border-[#3c3c3c]' : 'border-slate-200';
  const subtleClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const sectionClass = isDarkMode ? 'border-[#333] bg-[#252526]' : 'border-slate-200 bg-slate-50';
  const resizeHandleClass = isDarkMode ? 'bg-[#2a2a2a] hover:bg-sky-500/60' : 'bg-slate-200 hover:bg-sky-500/60';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const toggleInfoGroup = (groupId: string) => {
    setExpandedInfoGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleNavResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = navWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(420, Math.max(180, startWidth + moveEvent.clientX - startX));
      setNavWidth(nextWidth);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const selectedInfoDetail = (() => {
    if (!selectedInfoNodeId) return null;
    const selectedType = types.find(type => selectedInfoNodeId === `type:${type.name}`);
    if (selectedType) {
      return {
        kind: '类型/类',
        title: selectedType.name,
        declaration: selectedType.cppType || '类型贡献',
        description: selectedType.description,
        badge: selectedType.cppType ? 'C++ 类型' : undefined
      };
    }
    const selectedCommand = commands.find(command => selectedInfoNodeId === `command:${command.name}:${command.signature}`);
    if (selectedCommand) {
      return {
        kind: '命令接口',
        title: selectedCommand.name,
        declaration: selectedCommand.signature,
        description: selectedCommand.description,
        badge: selectedCommand.returnType || '空',
        extra: selectedCommand.cppRuntimeName ? `C++ 运行时：${selectedCommand.cppRuntimeName}` : undefined,
        parameters: getModuleCommandParameterDocs(selectedCommand),
        example: selectedCommand.insertText || selectedCommand.signature,
        copyText: selectedCommand.insertText || selectedCommand.signature
      };
    }
    const selectedControl = designerControls.find(control => selectedInfoNodeId === `control:${control.type}`);
    if (selectedControl) {
      return {
        kind: '设计器控件',
        title: selectedControl.label,
        declaration: selectedControl.type,
        description: (selectedControl.events || []).map(event => `${event.label}：${event.handlerPattern}`).join('；') || '该控件未声明事件。',
        badge: '控件'
      };
    }
    const selectedSnippet = snippets.find(snippet => selectedInfoNodeId === `snippet:${snippet.label}`);
    if (selectedSnippet) {
      return {
        kind: '代码片段',
        title: selectedSnippet.label,
        declaration: selectedSnippet.insertText,
        description: selectedSnippet.description,
        badge: '片段',
        copyText: selectedSnippet.insertText
      };
    }
    const selectedDoc = docs.find(doc => selectedInfoNodeId === `doc:${doc.path}`);
    if (selectedDoc) {
      return {
        kind: '文档',
        title: selectedDoc.title,
        declaration: selectedDoc.path,
        description: '模块随包文档路径。',
        badge: '文档',
        copyText: selectedDoc.path
      };
    }
    for (const row of cppRows) {
      const value = row.values.find(item => selectedInfoNodeId === `cpp:${row.label}:${item}`);
      if (value) {
        return {
          kind: 'C++ 依赖',
          title: value,
          declaration: value,
          description: row.label,
          badge: row.label,
          copyText: value
        };
      }
    }
    return null;
  })();

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/45 p-4 font-sans" role="dialog" aria-modal="true">
      <div className={`flex h-[min(760px,92vh)] w-[min(1120px,96vw)] min-w-0 flex-col overflow-hidden rounded border shadow-2xl ${panelClass} ${borderClass}`}>
        <div className={`flex min-w-0 items-center gap-3 border-b px-3 py-2 ${borderClass}`}>
          <Package className="h-4 w-4 shrink-0 text-violet-400" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">模块公开信息 - {manifest.name}</div>
            <div className={`truncate text-[11px] ${subtleClass}`}>{manifest.id} · v{manifest.version} · {manifest.category}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded p-1 transition-colors ${isDarkMode ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside
            className={`relative min-h-0 shrink-0 overflow-y-auto border-r ${isNavCollapsed ? 'p-1.5' : 'p-3'} ${borderClass}`}
            style={{ width: isNavCollapsed ? 44 : navWidth }}
          >
            <button
              type="button"
              onClick={() => setIsNavCollapsed(prev => !prev)}
              className={`mb-2 flex h-7 w-full items-center justify-center rounded transition-colors ${isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}
              title={isNavCollapsed ? '展开左侧模块导航' : '折叠左侧模块导航'}
            >
              {isNavCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>

            {isNavCollapsed ? (
              <div className="space-y-1">
                <ModuleInfoNavIcon icon={<Package className="h-3.5 w-3.5 text-violet-400" />} value={totalVisible} title={manifest.name} isDarkMode={isDarkMode} />
                <ModuleInfoNavIcon icon={<BookOpen className="h-3.5 w-3.5 text-amber-400" />} value={filteredTypes.length} title="类型/类" isDarkMode={isDarkMode} />
                <ModuleInfoNavIcon icon={<Wrench className="h-3.5 w-3.5 text-cyan-400" />} value={filteredCommands.length} title="命令接口" isDarkMode={isDarkMode} />
                <ModuleInfoNavIcon icon={<Monitor className="h-3.5 w-3.5 text-violet-300" />} value={filteredControls.length} title="设计器控件" isDarkMode={isDarkMode} />
                <ModuleInfoNavIcon icon={<FileText className="h-3.5 w-3.5 text-emerald-400" />} value={filteredSnippets.length} title="代码片段" isDarkMode={isDarkMode} />
                <ModuleInfoNavIcon icon={<FileCode className="h-3.5 w-3.5 text-slate-400" />} value={cppRows.reduce((total, row) => total + row.values.length, 0)} title="C++依赖" isDarkMode={isDarkMode} />
              </div>
            ) : (
              <>
                <div className={`flex h-8 min-w-0 items-center gap-2 rounded border px-2 ${borderClass} ${isDarkMode ? 'bg-[#181818]' : 'bg-white'}`}>
                  <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <input
                    value={searchText}
                    onChange={event => {
                      setSearchText(event.target.value);
                      setSelectedInfoNodeId(null);
                    }}
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                    placeholder="搜索命令、类型、备注..."
                  />
                </div>
                <label className={`mt-2 flex items-center gap-2 text-[11px] ${subtleClass}`}>
                  <input type="checkbox" checked readOnly className="h-3.5 w-3.5" />
                  搜索命令
                </label>
                <label className={`mt-1 flex items-center gap-2 text-[11px] ${subtleClass}`}>
                  <input type="checkbox" checked readOnly className="h-3.5 w-3.5" />
                  搜索备注
                </label>

                <div className="mt-3 space-y-0.5 text-xs">
                  <ModuleInfoNavRow
                    icon={<Package className="h-3.5 w-3.5 text-violet-400" />}
                    label={manifest.name}
                    value={totalVisible}
                    isDarkMode={isDarkMode}
                    onClick={() => setSelectedInfoNodeId(null)}
                  />
                  <ModuleInfoTreeGroup
                    id="types"
                    icon={<BookOpen className="h-3.5 w-3.5 text-amber-400" />}
                    label="类型/类"
                    value={filteredTypes.length}
                    isOpen={Boolean(expandedInfoGroups.types)}
                    isDarkMode={isDarkMode}
                    onToggle={toggleInfoGroup}
                  >
                    {filteredTypes.map(type => (
                      <ModuleInfoTreeLeaf
                        key={`type:${type.name}`}
                        icon={<BookOpen className="h-3 w-3 text-amber-300" />}
                        label={type.name}
                        detail={type.cppType}
                        isDarkMode={isDarkMode}
                        selected={selectedInfoNodeId === `type:${type.name}`}
                        onClick={() => setSelectedInfoNodeId(`type:${type.name}`)}
                      />
                    ))}
                  </ModuleInfoTreeGroup>
                  <ModuleInfoTreeGroup
                    id="commands"
                    icon={<Wrench className="h-3.5 w-3.5 text-cyan-400" />}
                    label="命令接口"
                    value={filteredCommands.length}
                    isOpen={Boolean(expandedInfoGroups.commands)}
                    isDarkMode={isDarkMode}
                    onToggle={toggleInfoGroup}
                  >
                    {filteredCommands.slice(0, 160).map(command => (
                      <ModuleInfoTreeLeaf
                        key={`command:${command.name}:${command.signature}`}
                        icon={<FileCode className="h-3 w-3 text-cyan-300" />}
                        label={command.name}
                        detail={command.signature}
                        isDarkMode={isDarkMode}
                        selected={selectedInfoNodeId === `command:${command.name}:${command.signature}`}
                        onClick={() => setSelectedInfoNodeId(`command:${command.name}:${command.signature}`)}
                      />
                    ))}
                  </ModuleInfoTreeGroup>
                  <ModuleInfoTreeGroup
                    id="designerControls"
                    icon={<Monitor className="h-3.5 w-3.5 text-violet-300" />}
                    label="设计器控件"
                    value={filteredControls.length}
                    isOpen={Boolean(expandedInfoGroups.designerControls)}
                    isDarkMode={isDarkMode}
                    onToggle={toggleInfoGroup}
                  >
                    {filteredControls.map(control => (
                      <ModuleInfoTreeLeaf
                        key={`control:${control.type}`}
                        icon={<Monitor className="h-3 w-3 text-violet-300" />}
                        label={control.label}
                        detail={control.type}
                        isDarkMode={isDarkMode}
                        selected={selectedInfoNodeId === `control:${control.type}`}
                        onClick={() => setSelectedInfoNodeId(`control:${control.type}`)}
                      />
                    ))}
                  </ModuleInfoTreeGroup>
                  <ModuleInfoTreeGroup
                    id="snippets"
                    icon={<FileText className="h-3.5 w-3.5 text-emerald-400" />}
                    label="代码片段"
                    value={filteredSnippets.length}
                    isOpen={Boolean(expandedInfoGroups.snippets)}
                    isDarkMode={isDarkMode}
                    onToggle={toggleInfoGroup}
                  >
                    {filteredSnippets.map(snippet => (
                      <ModuleInfoTreeLeaf
                        key={`snippet:${snippet.label}`}
                        icon={<FileText className="h-3 w-3 text-emerald-300" />}
                        label={snippet.label}
                        detail={snippet.description}
                        isDarkMode={isDarkMode}
                        selected={selectedInfoNodeId === `snippet:${snippet.label}`}
                        onClick={() => setSelectedInfoNodeId(`snippet:${snippet.label}`)}
                      />
                    ))}
                  </ModuleInfoTreeGroup>
                  <ModuleInfoTreeGroup
                    id="cpp"
                    icon={<FileCode className="h-3.5 w-3.5 text-slate-400" />}
                    label="C++依赖"
                    value={cppRows.reduce((total, row) => total + row.values.length, 0)}
                    isOpen={Boolean(expandedInfoGroups.cpp)}
                    isDarkMode={isDarkMode}
                    onToggle={toggleInfoGroup}
                  >
                    {cppRows.flatMap(row => row.values.map(value => (
                      <ModuleInfoTreeLeaf
                        key={`cpp:${row.label}:${value}`}
                        icon={<FileText className="h-3 w-3 text-slate-400" />}
                        label={value}
                        detail={row.label}
                        isDarkMode={isDarkMode}
                        selected={selectedInfoNodeId === `cpp:${row.label}:${value}`}
                        onClick={() => setSelectedInfoNodeId(`cpp:${row.label}:${value}`)}
                      />
                    )))}
                  </ModuleInfoTreeGroup>
                  <ModuleInfoTreeGroup
                    id="docs"
                    icon={<Info className="h-3.5 w-3.5 text-sky-400" />}
                    label="文档"
                    value={filteredDocs.length}
                    isOpen={Boolean(expandedInfoGroups.docs)}
                    isDarkMode={isDarkMode}
                    onToggle={toggleInfoGroup}
                  >
                    {filteredDocs.map(doc => (
                      <ModuleInfoTreeLeaf
                        key={`doc:${doc.path}`}
                        icon={<Info className="h-3 w-3 text-sky-400" />}
                        label={doc.title}
                        detail={doc.path}
                        isDarkMode={isDarkMode}
                        selected={selectedInfoNodeId === `doc:${doc.path}`}
                        onClick={() => setSelectedInfoNodeId(`doc:${doc.path}`)}
                      />
                    ))}
                  </ModuleInfoTreeGroup>
                </div>

                <div className={`mt-4 rounded border p-2 text-[11px] leading-5 ${sectionClass}`}>
                  <div className="font-semibold">模块说明</div>
                  <div className={`mt-1 break-words ${subtleClass}`}>{manifest.description}</div>
                  <div className={`mt-2 break-all ${subtleClass}`}>安装位置：{module.installPath}</div>
                  {module.diagnostics.length > 0 && (
                    <div className="mt-2 text-amber-300">{module.diagnostics.join('；')}</div>
                  )}
                </div>
                <div
                  onMouseDown={handleNavResizeStart}
                  onDoubleClick={() => setNavWidth(260)}
                  className={`absolute right-[-3px] top-0 h-full w-1.5 cursor-col-resize transition-colors ${resizeHandleClass}`}
                  title="拖动调整左侧宽度，双击恢复默认宽度"
                />
              </>
            )}
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto p-4">
            {selectedInfoDetail ? (
              <ModuleSelectedInfoPanel
                detail={selectedInfoDetail}
                isDarkMode={isDarkMode}
                onCopy={copyText}
              />
            ) : (
              <>
                <ModuleInfoSection title="插入到 LingBuilder" isDarkMode={isDarkMode}>
                  <ModuleInfoTable
                    headers={['名称', '声明/内容', '公开', '备注']}
                    rows={[
                      ...filteredTypes.map(type => [type.name, type.cppType || '类型贡献', '✓', type.description]),
                      ...filteredCommands.map(command => [command.name, command.signature, '✓', command.description]),
                      ...filteredControls.map(control => [
                        control.label,
                        control.type,
                        '✓',
                        (control.events || []).map(event => `${event.label}(${event.handlerPattern})`).join('；') || '设计器控件'
                      ]),
                      ...filteredSnippets.map(snippet => [snippet.label, snippet.insertText, '✓', snippet.description])
                    ]}
                    isDarkMode={isDarkMode}
                    onCopy={copyText}
                  />
                </ModuleInfoSection>

                <ModuleInfoSection title={`命令接口 ${filteredCommands.length}/${commands.length}`} isDarkMode={isDarkMode}>
                  {filteredCommands.length === 0 ? (
                    <ModuleInfoEmpty text="没有匹配的命令接口。" />
                  ) : (
                    <div className="space-y-2">
                      {filteredCommands.map(command => (
                        <div key={`${command.name}:${command.signature}`} className={`rounded border p-2 ${sectionClass}`}>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="min-w-0 flex-1 break-all text-sm font-semibold text-cyan-300">{command.name}</span>
                            {command.returnType && <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">{command.returnType}</span>}
                            <button type="button" onClick={() => copyText(command.insertText || command.signature)} className={`shrink-0 rounded px-2 py-1 text-[10px] ${isDarkMode ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-200 text-slate-700'}`}>
                              复制声明代码
                            </button>
                          </div>
                          <div className="mt-1 break-all font-mono text-[11px] text-slate-400">{command.signature}</div>
                          <div className={`mt-1 break-words text-[11px] leading-5 ${subtleClass}`}>{command.description}</div>
                          {command.cppRuntimeName && <div className={`mt-1 break-all text-[10px] ${subtleClass}`}>C++ 运行时：{command.cppRuntimeName}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </ModuleInfoSection>

                <ModuleInfoSection title={`类型/类 ${filteredTypes.length}/${types.length}`} isDarkMode={isDarkMode}>
                  <ModuleInfoTable
                    headers={['类型名称', 'C++类型', '公开', '备注']}
                    rows={filteredTypes.map(type => [type.name, type.cppType || '-', '✓', type.description])}
                    isDarkMode={isDarkMode}
                    onCopy={copyText}
                    emptyText="没有匹配的类型/类。"
                  />
                </ModuleInfoSection>

                <ModuleInfoSection title={`设计器控件 ${filteredControls.length}/${designerControls.length}`} isDarkMode={isDarkMode}>
                  <ModuleInfoTable
                    headers={['控件名称', '控件类型', '公开', '事件/备注']}
                    rows={filteredControls.map(control => [
                      control.label,
                      control.type,
                      '✓',
                      (control.events || []).map(event => `${event.label}：${event.handlerPattern}`).join('；') || '未声明事件'
                    ])}
                    isDarkMode={isDarkMode}
                    onCopy={copyText}
                    emptyText="没有匹配的设计器控件。"
                  />
                </ModuleInfoSection>

                <ModuleInfoSection title="C++ 依赖与文档" isDarkMode={isDarkMode}>
                  {cppRows.length === 0 && filteredDocs.length === 0 ? (
                    <ModuleInfoEmpty text="没有匹配的 C++ 依赖或文档。" />
                  ) : (
                    <div className="space-y-3">
                      {cppRows.map(row => (
                        <div key={row.label}>
                          <div className={`mb-1 text-xs font-semibold ${subtleClass}`}>{row.label}</div>
                          <ModuleInfoTable
                            headers={['项目', '路径/值']}
                            rows={row.values.map(value => [row.label, value])}
                            isDarkMode={isDarkMode}
                            onCopy={copyText}
                          />
                        </div>
                      ))}
                      {filteredDocs.length > 0 && (
                        <ModuleInfoTable
                          headers={['文档', '路径']}
                          rows={filteredDocs.map(doc => [doc.title, doc.path])}
                          isDarkMode={isDarkMode}
                          onCopy={copyText}
                        />
                      )}
                    </div>
                  )}
                </ModuleInfoSection>
              </>
            )}
          </main>
        </div>

        <div className={`flex items-center justify-between border-t px-3 py-1.5 text-[11px] ${borderClass} ${subtleClass}`}>
          <span>状态：{searchText.trim() ? `已筛选 ${totalVisible} 项` : `共 ${getModuleCapabilityCount(module)} 项公开能力`}</span>
          <span>{module.isEnabledForProject ? '当前项目已引用' : '当前项目未引用'}</span>
        </div>
      </div>
    </div>
  );
}

function ModuleInfoNavRow({
  icon,
  label,
  value,
  isDarkMode,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  isDarkMode: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full min-w-0 items-center gap-2 rounded px-2 py-1 text-left ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{value}</span>
    </button>
  );
}

function ModuleInfoNavIcon({
  icon,
  value,
  title,
  isDarkMode
}: {
  icon: React.ReactNode;
  value: number;
  title: string;
  isDarkMode: boolean;
}) {
  return (
    <div
      className={`relative flex h-8 items-center justify-center rounded ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
      title={`${title}：${value}`}
    >
      {icon}
      {value > 0 && (
        <span className={`absolute -right-0.5 -top-0.5 rounded px-1 text-[8px] leading-3 ${isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'}`}>
          {value > 99 ? '99+' : value}
        </span>
      )}
    </div>
  );
}

function ModuleSelectedInfoPanel({
  detail,
  isDarkMode,
  onCopy
}: {
  detail: {
    kind: string;
    title: string;
    declaration: string;
    description: string;
    badge?: string;
    extra?: string;
    parameters?: ModuleParameterDoc[];
    example?: string;
    copyText?: string;
  };
  isDarkMode: boolean;
  onCopy: (text: string) => void;
}) {
  return (
    <section className={`mb-4 rounded border p-3 ${isDarkMode ? 'border-sky-500/30 bg-sky-500/5' : 'border-sky-200 bg-sky-50'}`}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${isDarkMode ? 'bg-sky-500/15 text-sky-200' : 'bg-sky-100 text-sky-800'}`}>{detail.kind}</span>
            {detail.badge && (
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${isDarkMode ? 'bg-emerald-500/15 text-emerald-200' : 'bg-emerald-100 text-emerald-800'}`}>{detail.badge}</span>
            )}
          </div>
          <div className="mt-2 break-words text-base font-semibold text-cyan-300">{detail.title}</div>
          <div className={`mt-1 break-all font-mono text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{detail.declaration}</div>
          <div className={`mt-2 break-words text-xs leading-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{detail.description}</div>
          {detail.extra && <div className={`mt-1 break-all text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{detail.extra}</div>}
          {detail.parameters && detail.parameters.length > 0 && (
            <div className="mt-4">
              <div className={`mb-2 text-xs font-semibold ${isDarkMode ? 'text-sky-200' : 'text-sky-800'}`}>参数说明</div>
              <div className={`overflow-hidden rounded border ${isDarkMode ? 'border-sky-500/20' : 'border-sky-200'}`}>
                <table className="w-full table-fixed border-collapse text-left text-xs">
                  <thead className={isDarkMode ? 'bg-white/5 text-slate-200' : 'bg-white text-slate-800'}>
                    <tr>
                      <th className="w-[18%] px-2 py-1.5">参数</th>
                      <th className="w-[18%] px-2 py-1.5">类型</th>
                      <th className="w-[24%] px-2 py-1.5">示例值</th>
                      <th className="px-2 py-1.5">说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.parameters.map(parameter => (
                      <tr key={parameter.name} className={isDarkMode ? 'border-t border-sky-500/15' : 'border-t border-sky-100'}>
                        <td className="px-2 py-1.5 font-semibold text-cyan-300">{parameter.name}</td>
                        <td className={`px-2 py-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{parameter.type}</td>
                        <td className="break-all px-2 py-1.5 font-mono text-[11px] text-emerald-300">{parameter.example}</td>
                        <td className={`px-2 py-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{parameter.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {detail.example && (
            <div className="mt-4">
              <div className={`mb-1 text-xs font-semibold ${isDarkMode ? 'text-sky-200' : 'text-sky-800'}`}>调用示例</div>
              <pre className={`overflow-x-auto rounded border px-3 py-2 text-xs ${isDarkMode ? 'border-sky-500/20 bg-black/20 text-slate-200' : 'border-sky-200 bg-white text-slate-800'}`}>{detail.example}</pre>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onCopy(detail.copyText || detail.declaration)}
          className={`shrink-0 rounded px-2 py-1 text-[11px] ${isDarkMode ? 'text-slate-200 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-200'}`}
          title="复制当前项声明"
        >
          复制声明代码
        </button>
      </div>
    </section>
  );
}

function ModuleInfoTreeGroup({
  id,
  icon,
  label,
  value,
  isOpen,
  isDarkMode,
  onToggle,
  children
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  isOpen: boolean;
  isDarkMode: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className={`flex w-full min-w-0 items-center gap-1 rounded px-1.5 py-1 text-left ${
          isDarkMode ? 'text-slate-200 hover:bg-white/8' : 'text-slate-800 hover:bg-slate-100'
        }`}
        title={isOpen ? `折叠${label}` : `展开${label}`}
      >
        {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
        <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{value}</span>
      </button>
      {isOpen && (
        <div className="ml-4 border-l border-slate-500/25 pl-1">
          {React.Children.count(children) > 0 ? children : (
            <div className="px-2 py-1 text-[11px] text-slate-500">暂无公开项</div>
          )}
        </div>
      )}
    </div>
  );
}

function ModuleInfoTreeLeaf({
  icon,
  label,
  detail,
  isDarkMode,
  selected = false,
  onClick
}: {
  key?: React.Key;
  icon: React.ReactNode;
  label: string;
  detail?: string;
  isDarkMode: boolean;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full min-w-0 items-start gap-1.5 rounded px-1.5 py-0.5 text-left ${
        selected
          ? isDarkMode
            ? 'bg-sky-500/25 text-sky-100'
            : 'bg-sky-100 text-sky-900'
          : isDarkMode
            ? 'text-slate-300 hover:bg-sky-500/15 hover:text-sky-200'
            : 'text-slate-700 hover:bg-sky-50 hover:text-sky-800'
      }`}
      title={[label, detail].filter(Boolean).join('\n')}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px]">{label}</span>
        {detail && <span className="block truncate text-[9px] text-slate-500">{detail}</span>}
      </span>
    </button>
  );
}

function ModuleInfoSection({
  title,
  isDarkMode,
  children
}: {
  title: string;
  isDarkMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4">
      <div className={`mb-2 text-sm font-semibold ${isDarkMode ? 'text-sky-300' : 'text-sky-700'}`}>{title}</div>
      {children}
    </section>
  );
}

function ModuleInfoTable({
  headers,
  rows,
  isDarkMode,
  onCopy,
  emptyText = '没有可显示的公开信息。'
}: {
  headers: string[];
  rows: string[][];
  isDarkMode: boolean;
  onCopy: (text: string) => void;
  emptyText?: string;
}) {
  if (rows.length === 0) return <ModuleInfoEmpty text={emptyText} />;
  return (
    <div className={`overflow-hidden rounded border ${isDarkMode ? 'border-[#3c3c3c]' : 'border-slate-200'}`}>
      <table className="w-full table-fixed border-collapse text-left text-xs">
        <thead className={isDarkMode ? 'bg-[#2d332d] text-slate-200' : 'bg-emerald-50 text-slate-800'}>
          <tr>
            {headers.map(header => (
              <th key={header} className={`border-b px-2 py-1.5 font-semibold ${isDarkMode ? 'border-[#3c3c3c]' : 'border-slate-200'}`}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row.join(':')}:${rowIndex}`} className={isDarkMode ? 'odd:bg-[#1f1f1f] even:bg-[#242424]' : 'odd:bg-white even:bg-slate-50'}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}:${cellIndex}`}
                  className={`border-b px-2 py-1.5 align-top ${isDarkMode ? 'border-[#333]' : 'border-slate-200'} ${cellIndex === 0 ? 'text-blue-300' : isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}
                  title={cell}
                  onDoubleClick={() => onCopy(cell)}
                >
                  <div className="break-words">{cell}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModuleInfoEmpty({ text }: { text: string }) {
  return <div className="rounded border border-dashed border-slate-500/30 p-3 text-xs text-slate-500">{text}</div>;
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('模块服务暂未返回 JSON');
  }
  return response.json();
}

function getFallbackProjectModules(): InstalledModule[] {
  return BUILTIN_MODULES.map(manifest => ({
    manifest,
    installPath: `builtin://${manifest.id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
}
