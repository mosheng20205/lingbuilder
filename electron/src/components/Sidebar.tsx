import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Package,
  GitBranch,
  Link,
  Image as ImageIcon
} from 'lucide-react';
import { CppFile, ExtractedString, GlossaryTerm, SourceControlStatus } from '../types';
import ModuleInspector from './ModuleInspector';
import {
  createBlankWindow,
  getLingWindowSourceFileName,
  getLingWindowSourceFilePath,
  readWindowDesignerState,
  saveWindowDesignerState,
  WINDOW_DESIGNER_PROJECT_UPDATED,
  PersistedWindowDesignerState
} from '../services/windowDesigner/windowDesignerService';
import type { LingWindowModel } from '../services/windowDesigner/types';
import {
  getDesignerImagePreviewSource,
  listDesignerImageResources,
  type DesignerImageImportResult,
  type DesignerImageResource
} from '../services/windowDesigner/designerAssetClient';
import type { InstalledModule, ModuleHintContent, ModuleTargetContribution } from '../services/modules/types';
import { BUILTIN_MODULES } from '../services/modules/builtinModules';
import { formatModulePublicType, formatModulePublicTypeSource, getModulePublicTypeKind } from '../services/modules/modulePublicTypeService';
import {
  getModuleFamilyModules,
  getModuleFamilySearchText,
  isModuleHiddenByFamily,
  MODULE_FAMILIES
} from '../services/modules/moduleFamilies';
import type { SolutionFolder, SolutionModel, SolutionProject } from '../services/solution/solutionClient';
import type { CommandService } from '../services/commands/commandService';
import { getMenuService } from '../services/menus/menuService';
import { SOLUTION_EXPLORER_CONTEXT_MENU, SOLUTION_PROJECT_CONTEXT_MENU } from '../services/menus/types';
import {
  MOVE_PROJECT_TO_SOLUTION_FOLDER_COMMAND,
  RENAME_SOLUTION_PROJECT_COMMAND,
  registerSolutionExplorerMenu
} from '../services/solution/solutionExplorerMenu';
import SourceControlPanel from './SourceControlPanel';
import type { SourceControlMutation } from '../services/lingCpp/sourceControlService';
import ExtensionHostPanel from './ExtensionHostPanel';
import DependencyPanel from './DependencyPanel';
import RcResourcePanel from './RcResourcePanel';
import PublishingPanel from './PublishingPanel';
import AiIndexPanel from './AiIndexPanel';
import SettingsSyncPanel from './SettingsSyncPanel';
import { isFunctionLibrarySource } from '../services/lingCpp/functionLibraryService';

type WindowContextMenu =
  | { x: number; y: number; target: 'group' }
  | { x: number; y: number; target: 'window'; projectId: string; windowModel: LingWindowModel };

type ModuleContextMenu = { x: number; y: number; module: InstalledModule };
type SolutionContextMenu =
  | { x: number; y: number; target: 'solution' }
  | { x: number; y: number; target: 'project'; project: SolutionProject };
type ResourceContextMenu = { x: number; y: number; resource: DesignerImageResource };
type ResourcePreview = { projectId: string; resource: DesignerImageResource };
type SolutionTreeItem =
  | { kind: 'folder'; folder: SolutionFolder }
  | { kind: 'project'; project: SolutionProject };

interface ModuleParameterDoc {
  name: string;
  type: string;
  example: string;
  description: string;
}

type ModuleCppRow = {
  label: string;
  values: Array<{ id: string; value: string }>;
};

function buildModuleCppRows(
  targets: ModuleTargetContribution[],
  bindings: Array<{ command: string; runtimeName: string; returnType?: string }>,
  docs: Array<{ title: string; path: string }>
): ModuleCppRow[] {
  const targetValues = (field: keyof Pick<ModuleTargetContribution, 'headers' | 'sources' | 'libs' | 'runtimeFiles' | 'includeDirs' | 'defines'>) => (
    targets.flatMap((target, targetIndex) => (target[field] || []).map((value, valueIndex) => ({
      id: `${field}:${target.id}:${targetIndex}:${valueIndex}:${value}`,
      value
    })))
  );
  return [
    {
      label: '目标',
      values: targets.map((target, index) => ({
        id: `target:${target.id}:${index}`,
        value: `${target.id} · ${target.platform}/${target.toolchain}/${target.arch}`
      }))
    },
    { label: '头文件', values: targetValues('headers') },
    { label: '源码', values: targetValues('sources') },
    { label: '库文件', values: targetValues('libs') },
    { label: '运行时文件', values: targetValues('runtimeFiles') },
    { label: '包含目录', values: targetValues('includeDirs') },
    { label: '宏定义', values: targetValues('defines') },
    {
      label: '命令绑定',
      values: bindings.map((binding, index) => ({
        id: `binding:${binding.command}:${binding.runtimeName}:${index}`,
        value: `${binding.command} -> ${binding.runtimeName}`
      }))
    },
    {
      label: '文档',
      values: docs.map((doc, index) => ({
        id: `doc:${doc.path}:${index}`,
        value: `${doc.title} · ${doc.path}`
      }))
    }
  ].filter(row => row.values.length > 0);
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
  onDeleteFile?: (file: CppFile) => boolean | Promise<boolean>;
  onRenameFile?: (file: CppFile, newName: string) => boolean | Promise<boolean>;
  sourceControlStatus?: SourceControlStatus | null;
  onSourceControlChanged?: () => void;
  onExecuteSourceControlCommand?: (operation: SourceControlMutation, payload?: Record<string, unknown>) => Promise<unknown>;
  solution?: SolutionModel;
  commandService: CommandService;
  onExecuteCommand?: (commandId: string, ...args: unknown[]) => Promise<boolean>;
  activeProjectId?: string;
  onRefreshSolution?: () => void | Promise<unknown>;
  onCreateProject?: () => void | Promise<void>;
  onSetStartupProject?: (projectId: string) => void | Promise<void>;
  onConfigureProjectReferences?: (projectId: string) => void | Promise<void>;
  onToggleMultiStartupProject?: (projectId: string) => void | Promise<void>;
  onConfigureExternalProject?: (projectId: string) => void | Promise<void>;
  onDeleteProject?: (projectId: string, deleteFiles: boolean) => void | Promise<void>;
  onSolutionCommand?: (command: 'build' | 'clean' | 'rebuild', projectId?: string) => void | Promise<void>;
  onCloseSolution?: () => void | Promise<void>;
  onOpenSolutionDirectory?: () => void | Promise<void>;
  onOpenProjectDirectory?: (projectId: string) => void | Promise<void>;
  onOpenProjectGlobalVariables?: (projectId: string) => void | Promise<void>;
  onOpenProjectDataTypes?: (projectId: string) => void | Promise<void>;
  onCreateFunctionLibrary?: (projectId: string) => void | Promise<void>;
  onPasteFunctionLibrary?: (projectId: string) => void | Promise<void>;
  onCopySolutionFullPath?: () => boolean | Promise<boolean>;
  onCopyProjectFullPath?: (projectId: string) => boolean | Promise<boolean>;
  onAddProjectResource?: (projectId: string) => Promise<DesignerImageImportResult>;
  onExportLcppSourcePackage?: (projectId: string) => void | Promise<void>;
  onCopyProjectResourcePath?: (relativePath: string) => Promise<boolean>;
  activeModuleHintId?: string;
  onShowModuleHint?: (hint: ModuleHintContent) => void;
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
  sourceControlStatus = null,
  onSourceControlChanged,
  onExecuteSourceControlCommand,
  solution,
  commandService,
  onExecuteCommand,
  activeProjectId,
  onRefreshSolution,
  onCreateProject,
  onSetStartupProject,
  onConfigureProjectReferences,
  onToggleMultiStartupProject,
  onConfigureExternalProject,
  onDeleteProject,
  onSolutionCommand,
  onCloseSolution,
  onOpenSolutionDirectory,
  onOpenProjectDirectory,
  onOpenProjectGlobalVariables,
  onOpenProjectDataTypes,
  onCreateFunctionLibrary,
  onPasteFunctionLibrary,
  onCopySolutionFullPath,
  onCopyProjectFullPath,
  onAddProjectResource,
  onExportLcppSourcePackage,
  onCopyProjectResourcePath,
  activeModuleHintId,
  onShowModuleHint
}: SidebarProps) {
  // Activity views: solution explorer, tools, modules and Git changes.
  const [activeTab, setActiveTab] = useState<'explorer' | 'actions' | 'outline' | 'git'>('explorer');
  const [isSolutionOpen, setIsSolutionOpen] = useState(true);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});
  const [expandedSolutionFolderIds, setExpandedSolutionFolderIds] = useState<Record<string, boolean>>({});
  const [draggedSolutionProjectId, setDraggedSolutionProjectId] = useState<string | null>(null);
  const [solutionDropTarget, setSolutionDropTarget] = useState<string | 'root' | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: CppFile } | null>(null);
  const [windowContextMenu, setWindowContextMenu] = useState<WindowContextMenu | null>(null);
  const [moduleContextMenu, setModuleContextMenu] = useState<ModuleContextMenu | null>(null);
  const [solutionContextMenu, setSolutionContextMenu] = useState<SolutionContextMenu | null>(null);
  const [resourceContextMenu, setResourceContextMenu] = useState<ResourceContextMenu | null>(null);
  const [resourcePreview, setResourcePreview] = useState<ResourcePreview | null>(null);
  const [moduleInfoDialog, setModuleInfoDialog] = useState<InstalledModule | null>(null);
  const [designerState, setDesignerState] = useState(() => readWindowDesignerState());

  useEffect(() => {
    const handleCloseMenu = () => {
      setContextMenu(null);
      setWindowContextMenu(null);
      setModuleContextMenu(null);
      setSolutionContextMenu(null);
      setResourceContextMenu(null);
    };
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);
  useEffect(() => registerSolutionExplorerMenu(getMenuService(commandService)).dispose, [commandService]);
  const [isSrcOpen, setIsSrcOpen] = useState(true);
  const [isFunctionLibraryOpen, setIsFunctionLibraryOpen] = useState(true);
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
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [resourceImportingProjectId, setResourceImportingProjectId] = useState<string | null>(null);
  const [projectImageResources, setProjectImageResources] = useState<Record<string, DesignerImageResource[]>>({});
  const [projectResourceStatus, setProjectResourceStatus] = useState<Record<string, 'loading' | 'ready' | 'error'>>({});
  const [expandedResourceProjectIds, setExpandedResourceProjectIds] = useState<Record<string, boolean>>({});
  const [placeholderErrors, setPlaceholderErrors] = useState<{ line: number; msg: string; text: string }[]>([]);
  const [hasCheckedPlaceholders, setHasCheckedPlaceholders] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const solutionProjects = solution?.projects || [];
  const solutionFolders = solution?.folders || [];
  const solutionTreeItems: SolutionTreeItem[] = [
    ...solutionProjects.filter(project => !project.solutionFolderId).map(project => ({ kind: 'project' as const, project })),
    ...solutionFolders.flatMap<SolutionTreeItem>(folder => [
      { kind: 'folder', folder },
      ...(expandedSolutionFolderIds[folder.id] === false
        ? []
        : solutionProjects
          .filter(project => project.solutionFolderId === folder.id)
          .map(project => ({ kind: 'project' as const, project })))
    ])
  ];
  const activeSolutionProjectId = activeProjectId || solution?.startupProjectId || solutionProjects[0]?.id;
  const activeSolutionProject = solutionProjects.find(project => project.id === activeSolutionProjectId);
  const moduleProjectId = activeSolutionProjectId || designerState.project.id || 'lingbuilder-ui-project';
  const moduleProjectIdRef = useRef(moduleProjectId);
  moduleProjectIdRef.current = moduleProjectId;

  // Group files by directories
  const normalizedFileSearch = fileSearch.trim().toLowerCase();
  const includesSearch = (...values: Array<string | undefined>) => (
    !normalizedFileSearch || values.some(value => value?.toLowerCase().includes(normalizedFileSearch))
  );
  const srcFiles = files.filter(f => f.path.startsWith('src/') && includesSearch(f.name, f.path));
  const functionLibraryFiles = files.filter(file => file.language === 'lingcpp' && includesSearch(file.name, file.path) && isFunctionLibrarySource(file.translatedContent || file.originalContent));
  const regularSrcFiles = srcFiles.filter(file => !functionLibraryFiles.includes(file));
  const configFiles = files.filter(f => f.path.startsWith('config/') && includesSearch(f.name, f.path));
  const designerStateMatchesActiveProject = designerState.project.id === activeSolutionProjectId;
  const designerWindows = (designerStateMatchesActiveProject ? designerState.project.windows : []).filter(windowModel => includesSearch(
    windowModel.title,
    windowModel.fileName,
    windowModel.className,
    getLingWindowSourceFileName(windowModel.fileName, windowModel.className)
  ));
  const projectModuleFamilyStates = MODULE_FAMILIES.map(definition => {
    const modules = getModuleFamilyModules(projectModules, definition);
    return {
      definition,
      modules,
      searchText: getModuleFamilySearchText(definition, modules),
      capabilityCount: modules.reduce((total, familyModule) => total + getModuleCapabilityCount(familyModule), 0)
    };
  });
  const projectModuleFamilyStateByRootId = new Map(
    projectModuleFamilyStates.map(state => [state.definition.rootModuleId, state])
  );
  const visibleProjectModules = projectModules.filter(module => !isModuleHiddenByFamily(module.manifest.id));
  const filteredProjectModules = visibleProjectModules.filter(module => {
    const familyState = projectModuleFamilyStateByRootId.get(module.manifest.id);
    if (familyState) return includesSearch(familyState.searchText);
    return includesSearch(
      module.manifest.name,
      module.manifest.id,
      module.manifest.description,
      module.manifest.category,
      ...(module.manifest.tags || []),
      ...(module.manifest.contributes?.commands || []).flatMap(command => [
        command.name,
        command.signature,
        command.description,
        command.returnType
      ]),
      ...(module.manifest.contributes?.types || []).flatMap(type => [
        type.name,
        type.description,
        type.cppType,
        type.elementType,
        ...(type.fields || []).flatMap(field => [field.name, field.type, field.description])
      ]),
      ...(module.manifest.contributes?.designerControls || []).flatMap(control => [
        control.label,
        control.type,
        ...(control.events || []).flatMap(event => [event.label, event.handlerPattern])
      ]),
      ...(module.manifest.contributes?.snippets || []).flatMap(snippet => [snippet.label, snippet.description]),
      ...(module.manifest.contributes?.docs || []).flatMap(doc => [doc.title, doc.path]),
      ...(module.manifest.targets || []).flatMap(target => [
        target.id,
        target.platform,
        target.arch,
        target.toolchain,
        ...(target.headers || []),
        ...(target.sources || []),
        ...(target.libs || []),
        ...(target.runtimeFiles || [])
      ]),
      ...(module.manifest.bindings?.commands || []).flatMap(binding => [binding.command, binding.runtimeName])
    );
  });

  const refreshProjectModules = useCallback(async () => {
    const projectId = moduleProjectId;
    setProjectModules([]);
    setProjectModulesStatus(`正在读取项目 ${projectId} 的模块...`);
    try {
      const result = await fetchJson(`/api/modules/project?projectId=${encodeURIComponent(projectId)}`);
      if (moduleProjectIdRef.current !== projectId) return;
      if (!result.ok) throw new Error(result.error || '项目模块读取失败');
      const modules = Array.isArray(result.modules) ? result.modules as InstalledModule[] : [];
      setProjectModules(modules.length > 0 ? modules : getFallbackProjectModules());
      setProjectModulesStatus(modules.length > 0 ? '项目模块已载入' : '当前项目未启用模块');
    } catch (error) {
      if (moduleProjectIdRef.current !== projectId) return;
      setProjectModules(getFallbackProjectModules());
      setProjectModulesStatus('模块服务等待重启，已显示内置基础模块');
    }
  }, [moduleProjectId]);

  useEffect(() => {
    const handleDesignerProjectUpdated = (event: Event) => {
      const detail = (event as CustomEvent<PersistedWindowDesignerState>).detail;
      if (detail?.project.id && activeSolutionProjectId && detail.project.id !== activeSolutionProjectId) return;
      setDesignerState(detail || readWindowDesignerState());
    };

    window.addEventListener(WINDOW_DESIGNER_PROJECT_UPDATED, handleDesignerProjectUpdated);
    return () => {
      window.removeEventListener(WINDOW_DESIGNER_PROJECT_UPDATED, handleDesignerProjectUpdated);
    };
  }, [activeSolutionProjectId]);

  useEffect(() => {
    refreshProjectModules();
  }, [refreshProjectModules]);

  useEffect(() => {
    const handleModulesChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string; scope?: 'project' | 'workspace' }>).detail;
      if (detail?.scope === 'project' && detail.projectId && detail.projectId !== moduleProjectId) return;
      refreshProjectModules();
    };
    window.addEventListener('lingbuilder-modules-changed', handleModulesChanged);
    return () => window.removeEventListener('lingbuilder-modules-changed', handleModulesChanged);
  }, [moduleProjectId, refreshProjectModules]);

  useEffect(() => {
    setSelectedModuleInspectorId(null);
    setExpandedModuleIds({});
    setExpandedModuleGroups({});
  }, [moduleProjectId]);

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
    const sourcePath = getLingWindowSourceFilePath(activeSolutionProject?.sourceRoot, windowModel.fileName, windowModel.className);
    return files.find(file => file.path === sourcePath || file.name === sourceName);
  };

  const handleOpenDesignerWindow = (projectId: string, windowModel: LingWindowModel) => {
    if (projectId !== activeSolutionProjectId || designerState.project.id !== projectId) {
      triggerSuccess('项目窗口状态仍在载入，请稍后重试。');
      return;
    }
    const sourceName = getLingWindowSourceFileName(windowModel.fileName, windowModel.className);
    const sourceFile = getSourceFileForWindow(windowModel);

    const nextState = saveWindowDesignerState({
      ...designerState,
      activeWindowId: windowModel.id,
      selectedControlId: windowModel.controls[0]?.id || null
    });
    setDesignerState(nextState);

    if (!sourceFile) {
      window.dispatchEvent(new CustomEvent('window-added', { detail: windowModel }));
      window.dispatchEvent(new CustomEvent('show-window-designer', {
        detail: { projectId, windowId: windowModel.id }
      }));
      triggerSuccess(`已重新生成 ${sourceName}，请保存项目。`);
      return;
    }

    onSelectFile(sourceFile, false);
    window.dispatchEvent(new CustomEvent('show-window-designer', {
      detail: { projectId, windowId: windowModel.id }
    }));
  };

  const commitDesignerState = (nextState: PersistedWindowDesignerState) => {
    const savedState = saveWindowDesignerState(nextState);
    setDesignerState(savedState);
    return savedState;
  };

  const handleCreateWindowFromExplorer = () => {
    if (!designerStateMatchesActiveProject) {
      triggerSuccess('项目窗口状态仍在载入，请稍后重试。');
      return;
    }
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
    if (!designerStateMatchesActiveProject) {
      triggerSuccess('项目窗口状态仍在载入，请稍后重试。');
      return;
    }
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
    if (!designerStateMatchesActiveProject) {
      triggerSuccess('项目窗口状态仍在载入，请稍后重试。');
      return;
    }
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
  const handleTabClick = (tab: 'explorer' | 'actions' | 'outline' | 'git') => {
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
    setActionErrorMessage(null);
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

  const copyFunctionLibraryToClipboard = (file: CppFile) => {
    const payload = { sourceProjectId: activeSolutionProjectId, sourcePath: file.path };
    void navigator.clipboard.writeText(`LINGBUILDER_FUNCTION_LIBRARY:${JSON.stringify(payload)}`)
      .then(() => triggerSuccess('已复制功能库，可在其他项目节点按 Ctrl+V 或右键粘贴'))
      .catch(() => triggerError('复制功能库到剪贴板失败。'));
  };

  const renderFileRow = (file: CppFile) => {
    const isActive = file.path === activeFile.path;
    const progress = getProgress(file);

    return (
      <div
        key={file.path}
        tabIndex={0}
        id={`file-row-${file.name.replace('.', '-')}`}
        onClick={() => onSelectFile(file)}
        onContextMenu={(e) => {
          e.preventDefault();
          setWindowContextMenu(null);
          setContextMenu({ x: e.clientX, y: e.clientY, file });
        }}
        onKeyDown={(event) => {
          if (!event.ctrlKey || event.key.toLocaleLowerCase() !== 'c') return;
          if (file.language !== 'lingcpp' || !isFunctionLibrarySource(file.translatedContent || file.originalContent)) return;
          event.preventDefault();
          copyFunctionLibraryToClipboard(file);
        }}
        className={`group flex items-center justify-between gap-2 py-1.5 px-3 pl-8 text-[13px] cursor-pointer border-l-2 transition-all ${
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
            <FileCode className={`w-4 h-4 shrink-0 ${
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
            <CheckCircle2 className="w-4 h-4 text-[#73C991]" />
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

  const triggerError = (msg: string) => {
    setActionSuccessMessage(null);
    setActionErrorMessage(msg);
    setTimeout(() => {
      setActionErrorMessage(null);
    }, 6000);
  };

  const refreshProjectImageResources = useCallback(async (projectId: string): Promise<boolean> => {
    setProjectResourceStatus(previous => ({ ...previous, [projectId]: 'loading' }));
    try {
      const resources = await listDesignerImageResources(projectId);
      setProjectImageResources(previous => ({ ...previous, [projectId]: resources }));
      setProjectResourceStatus(previous => ({ ...previous, [projectId]: 'ready' }));
      return true;
    } catch {
      setProjectResourceStatus(previous => ({ ...previous, [projectId]: 'error' }));
      return false;
    }
  }, []);

  useEffect(() => {
    if (!activeSolutionProjectId) return;
    void refreshProjectImageResources(activeSolutionProjectId);
  }, [activeSolutionProjectId, refreshProjectImageResources]);

  const handleAddProjectResource = async (project: SolutionProject) => {
    if (resourceImportingProjectId) return;
    if (!onAddProjectResource) {
      triggerError('当前工作台未提供项目资源导入命令。');
      return;
    }
    setResourceImportingProjectId(project.id);
    setActionErrorMessage(null);
    try {
      const result = await onAddProjectResource(project.id);
      if (result.canceled) return;
      if (!result.ok || !result.relativePath) {
        triggerError(result.error || '图片复制到项目失败。');
        return;
      }
      await refreshProjectImageResources(project.id);
      setExpandedResourceProjectIds(previous => ({ ...previous, [project.id]: true }));
      triggerSuccess(`已添加图片资源：${result.relativePath}`);
    } catch (error) {
      triggerError(error instanceof Error ? error.message : '添加图片资源失败。');
    } finally {
      setResourceImportingProjectId(null);
    }
  };

  useEffect(() => {
    const openGitChanges = () => {
      setActiveTab('git');
      if (setShowLeftSidebar) setShowLeftSidebar(true);
    };
    window.addEventListener('lingbuilder-open-git-changes', openGitChanges);
    return () => window.removeEventListener('lingbuilder-open-git-changes', openGitChanges);
  }, [setShowLeftSidebar]);

  const renderWindowRow = (projectId: string, windowModel: LingWindowModel) => {
    const sourceName = getLingWindowSourceFileName(windowModel.fileName, windowModel.className);
    const isActive = activeFile.name === sourceName;

    return (
      <button
        type="button"
        key={windowModel.id}
        onClick={() => handleOpenDesignerWindow(projectId, windowModel)}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setContextMenu(null);
          setWindowContextMenu({
            x: event.clientX,
            y: event.clientY,
            target: 'window',
            projectId,
            windowModel
          });
        }}
        title={`打开窗口设计器：${windowModel.title} (${windowModel.fileName})`}
        aria-label={`打开窗口设计器：${windowModel.title}`}
        className={`group w-full flex items-center justify-between gap-2 py-1.5 px-3 pl-8 text-[13px] cursor-pointer border-l-2 transition-all text-left ${
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
          <Monitor className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-amber-500'}`} />
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
        {contextMenu.file.language === 'lingcpp' && isFunctionLibrarySource(contextMenu.file.translatedContent || contextMenu.file.originalContent) && (
          <div
            className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer transition-colors flex items-center gap-1.5"
            onClick={() => {
              copyFunctionLibraryToClipboard(contextMenu.file);
            }}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>复制功能库</span>
          </div>
        )}
        <div
          className={`px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer transition-colors`}
          onClick={() => {
            const newName = window.prompt(`重命名文件 ${contextMenu.file.name}`, contextMenu.file.name);
            if (newName && newName.trim() && newName !== contextMenu.file.name) {
              void Promise.resolve(onRenameFile?.(contextMenu.file, newName.trim()) ?? false).then(success => {
                if (success) triggerSuccess(`已重命名文件为 ${newName.trim()}`);
              });
            }
          }}
        >
          <span>重命名 (R)</span>
        </div>
        <div className="h-[1px] bg-slate-700/20 dark:bg-slate-700/50 my-1" />
        <div
          className={`px-3 py-1.5 text-rose-500 hover:bg-rose-500 hover:text-white cursor-pointer transition-colors`}
          onClick={() => {
            const fileName = contextMenu.file.name;
            void Promise.resolve(onDeleteFile?.(contextMenu.file) ?? false).then(success => {
              if (success) triggerSuccess(`已删除文件 ${fileName}`);
            });
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
              onClick={() => handleOpenDesignerWindow(windowContextMenu.projectId, windowContextMenu.windowModel)}
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

  const moveDraggedProject = async (projectId: string, folderId: string | null) => {
    const project = solutionProjects.find(item => item.id === projectId);
    if (!project || (project.solutionFolderId || null) === folderId) {
      setSolutionDropTarget(null);
      setDraggedSolutionProjectId(null);
      return;
    }
    const targetFolder = folderId ? solutionFolders.find(item => item.id === folderId) : undefined;
    const success = await onExecuteCommand?.(MOVE_PROJECT_TO_SOLUTION_FOLDER_COMMAND, projectId, folderId);
    if (success) {
      triggerSuccess(`已将“${project.name}”移动到${targetFolder ? `“${targetFolder.name}”` : '解决方案根节点'}`);
      if (folderId) setExpandedSolutionFolderIds(previous => ({ ...previous, [folderId]: true }));
    } else {
      triggerError(`移动项目“${project.name}”失败。`);
    }
    setSolutionDropTarget(null);
    setDraggedSolutionProjectId(null);
  };

  const renderSolutionContextMenu = () => {
    if (!solutionContextMenu) return null;
    const menuItemClass = `px-3 py-1.5 cursor-pointer transition-colors flex items-center gap-2 ${
      isDarkMode ? 'hover:bg-blue-500 hover:text-white' : 'hover:bg-blue-500 hover:text-white'
    }`;
    const dangerItemClass = `px-3 py-1.5 cursor-pointer transition-colors flex items-center gap-2 text-rose-500 hover:bg-rose-500 hover:text-white`;
    const project = solutionContextMenu.target === 'project' ? solutionContextMenu.project : null;
    const isLastProject = (solution?.projects.length || 0) <= 1;
    const isStartup = project?.id === (activeProjectId || solution?.startupProjectId);
    const contributedItems = getMenuService(commandService).resolveMenu(
      solutionContextMenu.target === 'solution' ? SOLUTION_EXPLORER_CONTEXT_MENU : SOLUTION_PROJECT_CONTEXT_MENU,
      {
          'workspace.open': Boolean(solution),
          'workbench.modalOpen': false
      },
      { includeDisabled: true }
    );

    return (
      <div
        style={{ top: `${solutionContextMenu.y}px`, left: `${solutionContextMenu.x}px` }}
        className={`fixed z-[9999] min-w-[210px] py-1 rounded shadow-lg border text-xs select-none font-sans ${
          isDarkMode
            ? 'bg-[#252526] border-[#454545] text-slate-200'
            : 'bg-white border-slate-250 text-slate-800'
        }`}
        onClick={() => setSolutionContextMenu(null)}
      >
        {solutionContextMenu.target === 'solution' ? (
          <>
            {contributedItems.map(item => item.kind === 'separator' ? (
              <div key={item.id} className="h-[1px] bg-slate-700/20 dark:bg-slate-700/50 my-1" />
            ) : item.kind === 'command' ? (
              <div
                key={item.id}
                className={item.command.enabled ? menuItemClass : `${menuItemClass} cursor-not-allowed opacity-40`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (item.command.enabled) void onExecuteCommand?.(item.command.id, ...item.arguments);
                  setSolutionContextMenu(null);
                }}
              >
                <Folder className="w-3.5 h-3.5 text-amber-400 fill-amber-400/10" />
                <span>{item.command.title}</span>
              </div>
            ) : null)}
            <div className={menuItemClass} onClick={() => void onCreateProject?.()}>
              <Plus className="w-3.5 h-3.5 text-emerald-500" />
              <span>新建项目 (N)</span>
            </div>
            <div className="h-[1px] bg-slate-700/20 dark:bg-slate-700/50 my-1" />
            <div className={menuItemClass} onClick={() => void onSolutionCommand?.('build')}>
              <Play className="w-3.5 h-3.5 text-emerald-500" />
              <span>生成解决方案</span>
            </div>
            <div className={menuItemClass} onClick={() => void onSolutionCommand?.('rebuild')}>
              <RefreshCw className="w-3.5 h-3.5 text-sky-500" />
              <span>重新生成解决方案</span>
            </div>
            <div className={menuItemClass} onClick={() => void onSolutionCommand?.('clean')}>
              <Trash2 className="w-3.5 h-3.5 text-amber-500" />
              <span>清理解决方案</span>
            </div>
            <div className="h-[1px] bg-slate-700/20 dark:bg-slate-700/50 my-1" />
            <div className={menuItemClass} onClick={() => void onOpenSolutionDirectory?.()}>
              <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>打开解决方案所在目录</span>
            </div>
            <div
              className={menuItemClass}
              onClick={() => void Promise.resolve(onCopySolutionFullPath?.() ?? false).then(success => {
                if (success) triggerSuccess('已复制解决方案完整路径');
                else triggerError('复制解决方案完整路径失败。');
              })}
            >
              <Copy className="w-3.5 h-3.5 text-sky-400" />
              <span>复制完整路径</span>
            </div>
            <div className={menuItemClass} onClick={() => void onCloseSolution?.()}>
              <FolderMinus className="w-3.5 h-3.5 text-amber-400" />
              <span>关闭解决方案</span>
            </div>
            <div className={menuItemClass} onClick={() => void onRefreshSolution?.()}>
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>刷新</span>
            </div>
          </>
        ) : project && (
          <>
            {project.type === 'visual-cpp' && <div className={menuItemClass} onClick={() => void onCreateFunctionLibrary?.(project.id)}>
              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>新建功能库…</span>
            </div>}
            {project.type === 'visual-cpp' && <div className={menuItemClass} onClick={() => void onPasteFunctionLibrary?.(project.id)}>
              <Copy className="w-3.5 h-3.5 text-cyan-400" />
              <span>粘贴功能库…</span>
            </div>}
            <div className="h-[1px] bg-slate-700/20 dark:bg-slate-700/50 my-1" />
            <div className={menuItemClass} onClick={() => void onSetStartupProject?.(project.id)}>
              <CheckCircle2 className={`w-3.5 h-3.5 ${isStartup ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span>{isStartup ? '当前启动项目' : '设为启动项目'}</span>
            </div>
            <div className={menuItemClass} onClick={() => void onToggleMultiStartupProject?.(project.id)}>
              <Play className="w-3.5 h-3.5 text-sky-400" />
              <span>{solution?.startupProjectIds?.includes(project.id) ? '从多启动项移除' : '添加到多启动项'}</span>
            </div>
            <div className={menuItemClass} onClick={() => void onConfigureProjectReferences?.(project.id)}>
              <Link className="w-3.5 h-3.5 text-violet-400" />
              <span>配置项目引用…</span>
            </div>
            {project.type !== 'visual-cpp' && <div className={menuItemClass} onClick={() => void onConfigureExternalProject?.(project.id)}>
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>构建属性…</span>
            </div>}
            <div className={menuItemClass} onClick={() => void onCreateProject?.()}>
              <Plus className="w-3.5 h-3.5 text-emerald-500" />
              <span>新建项目</span>
            </div>
            <div
              className={resourceImportingProjectId ? `${menuItemClass} cursor-not-allowed opacity-50` : menuItemClass}
              onClick={() => {
                if (!resourceImportingProjectId) void handleAddProjectResource(project);
              }}
            >
              {resourceImportingProjectId === project.id
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                : <Plus className="w-3.5 h-3.5 text-sky-400" />}
              <span>{resourceImportingProjectId === project.id ? '正在添加资源…' : '添加资源…'}</span>
            </div>
            <div className={menuItemClass} onClick={() => void onExportLcppSourcePackage?.(project.id)}>
              <Package className="w-3.5 h-3.5 text-emerald-400" />
              <span>一键导出 LCPP 源码包…</span>
            </div>
            <div className="h-[1px] bg-slate-700/20 dark:bg-slate-700/50 my-1" />
            <div className={menuItemClass} onClick={() => void onOpenProjectDirectory?.(project.id)}>
              <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>打开项目所在目录</span>
            </div>
            <div
              className={menuItemClass}
              onClick={() => void Promise.resolve(onCopyProjectFullPath?.(project.id) ?? false).then(success => {
                if (success) triggerSuccess('已复制项目完整路径');
                else triggerError('复制项目完整路径失败。');
              })}
            >
              <Copy className="w-3.5 h-3.5 text-sky-400" />
              <span>复制完整路径</span>
            </div>
            <div className="h-[1px] bg-slate-700/20 dark:bg-slate-700/50 my-1" />
            <div className={menuItemClass} onClick={() => void onSolutionCommand?.('build', project.id)}>
              <Play className="w-3.5 h-3.5 text-emerald-500" />
              <span>生成项目</span>
            </div>
            <div className={menuItemClass} onClick={() => void onSolutionCommand?.('rebuild', project.id)}>
              <RefreshCw className="w-3.5 h-3.5 text-sky-500" />
              <span>重新生成项目</span>
            </div>
            <div className={menuItemClass} onClick={() => void onSolutionCommand?.('clean', project.id)}>
              <Trash2 className="w-3.5 h-3.5 text-amber-500" />
              <span>清理项目</span>
            </div>
            <div className="h-[1px] bg-slate-700/20 dark:bg-slate-700/50 my-1" />
            {contributedItems.map(item => item.kind === 'separator' ? (
              <div key={item.id} className="h-[1px] bg-slate-700/20 dark:bg-slate-700/50 my-1" />
            ) : item.kind === 'command' ? (
              <div
                key={item.id}
                className={item.command.enabled ? menuItemClass : `${menuItemClass} cursor-not-allowed opacity-40`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (item.command.enabled) void onExecuteCommand?.(item.command.id, project.id, ...item.arguments);
                  setSolutionContextMenu(null);
                }}
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span>{item.command.title} (F2)</span>
              </div>
            ) : null)}
            <div className="h-[1px] bg-slate-700/20 dark:bg-slate-700/50 my-1" />
            <div
              className={isLastProject ? `${menuItemClass} cursor-not-allowed opacity-40` : dangerItemClass}
              onClick={(event) => {
                event.stopPropagation();
                if (!isLastProject) void onDeleteProject?.(project.id, false);
              }}
            >
              <FolderMinus className="w-3.5 h-3.5" />
              <span>从解决方案移除</span>
            </div>
            <div
              className={(isLastProject || project.isDefault) ? `${menuItemClass} cursor-not-allowed opacity-40` : dangerItemClass}
              onClick={(event) => {
                event.stopPropagation();
                if (!isLastProject && !project.isDefault) void onDeleteProject?.(project.id, true);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>删除项目文件...</span>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderResourceContextMenu = () => {
    if (!resourceContextMenu) return null;
    const resource = resourceContextMenu.resource;
    return (
      <div
        style={{ top: `${resourceContextMenu.y}px`, left: `${resourceContextMenu.x}px` }}
        className={`fixed z-[9999] min-w-[190px] py-1 rounded shadow-lg border text-xs select-none font-sans ${
          isDarkMode
            ? 'bg-[#252526] border-[#454545] text-slate-200'
            : 'bg-white border-slate-250 text-slate-800'
        }`}
        onClick={() => setResourceContextMenu(null)}
      >
        <div
          className="px-3 py-1.5 cursor-pointer transition-colors flex items-center gap-2 hover:bg-blue-500 hover:text-white"
          onClick={() => {
            void Promise.resolve(onCopyProjectResourcePath?.(resource.relativePath) ?? false).then(success => {
              if (success) triggerSuccess(`已复制相对路径：${resource.relativePath}`);
              else triggerError('复制图片资源相对路径失败。');
            });
          }}
        >
          <Copy className="w-3.5 h-3.5 text-sky-400" />
          <span>复制相对路径</span>
        </div>
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
            <span className="text-[10px] font-semibold leading-none font-sans">文件</span>
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
            <span className="text-[10px] font-semibold leading-none font-sans">工具</span>
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
            <span className="text-[10px] font-semibold leading-none font-sans">模块</span>
            {showLeftSidebar && activeTab === 'outline' && (
              <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-[#007ACC] rounded-r"></div>
            )}
          </button>

          {/* Git Changes Tab Icon */}
          <button
            type="button"
            onClick={() => handleTabClick('git')}
            aria-label="打开 Git 更改"
            aria-pressed={showLeftSidebar && activeTab === 'git'}
            className={`w-10 h-10 rounded flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#007ACC] ${
              showLeftSidebar && activeTab === 'git'
                ? isDarkMode ? 'bg-[#37373D] text-[#007ACC]' : 'bg-[#CCCCCC] text-[#007ACC]'
                : isDarkMode ? 'text-[#888888] hover:text-white hover:bg-[#2D2D2D]' : 'text-slate-600 hover:text-black hover:bg-slate-300'
            }`}
            title="Git 更改"
          >
            <GitBranch className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-semibold leading-none font-sans">Git更改</span>
            {Boolean(sourceControlStatus?.files.length) && (
              <span
                className="absolute right-0.5 top-0.5 min-w-3.5 rounded-full bg-[#007ACC] px-0.5 text-center text-[8px] font-bold leading-3.5 text-white"
                aria-label={`${sourceControlStatus?.files.length} 个 Git 更改`}
              >
                {sourceControlStatus!.files.length > 99 ? '99+' : sourceControlStatus!.files.length}
              </span>
            )}
            {showLeftSidebar && activeTab === 'git' && (
              <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-[#007ACC] rounded-r" />
            )}
          </button>
        </div>

        {/* Bottom Help Icon in Activity Bar */}
        <div className="flex flex-col gap-3 items-center">
          <button
            type="button"
            title="双击或点击底栏词条可编写中文代码"
            aria-label="显示中文代码输入提示"
            onClick={() => triggerSuccess('提示: 双击中间编辑区的任意代码行，即可在底栏直接用中文替换原生符号！')}
            className={`rounded p-1 ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'}`}
          >
            <HelpCircle className="h-4.5 w-4.5" aria-hidden="true" />
          </button>
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
            <div role="status" className={`text-[11px] p-2.5 flex items-start gap-2 animate-fade-in shrink-0 font-sans border-b ${
              isDarkMode 
                ? 'bg-[#1E3A1E] border-emerald-500/30 text-[#73C991]' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <Check className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
              <span className="min-w-0 break-all">{actionSuccessMessage}</span>
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
                  <button
                    type="button"
                    className="rounded p-0.5 transition-colors hover:text-slate-200"
                    title="刷新"
                    aria-label="刷新解决方案资源管理器"
                    onClick={() => {
                      if (onSelectFile && activeFile) {
                        onSelectFile(activeFile);
                      }
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 transition-colors hover:text-slate-200"
                    title="折叠全部"
                    aria-label="折叠解决方案资源管理器中的全部项目"
                    onClick={() => {
                      setIsSolutionOpen(false);
                      setExpandedProjectIds(Object.fromEntries(solutionProjects.map(project => [project.id, false])));
                      setIsWindowsOpen(false);
                      setIsSrcOpen(false);
                      setIsConfigOpen(false);
                    }}
                  >
                    <FolderMinus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
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
              </div>

              {/* Solution Tree */}
              <div className="flex-1 overflow-y-auto py-2 font-mono text-[13px]">
                <div>
                  <div
                    onClick={() => setIsSolutionOpen(!isSolutionOpen)}
                    onDragOver={(event) => {
                      if (!draggedSolutionProjectId) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setSolutionDropTarget('root');
                    }}
                    onDragLeave={() => setSolutionDropTarget(current => current === 'root' ? null : current)}
                    onDrop={(event) => {
                      if (!draggedSolutionProjectId) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const projectId = event.dataTransfer.getData('application/x-lingbuilder-solution-project') || draggedSolutionProjectId;
                      void moveDraggedProject(projectId, null);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setContextMenu(null);
                      setWindowContextMenu(null);
                      setModuleContextMenu(null);
                      setSolutionContextMenu({ x: event.clientX, y: event.clientY, target: 'solution' });
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer text-[13px] font-semibold font-sans transition-colors ${
                      solutionDropTarget === 'root'
                        ? 'bg-blue-500/20 text-blue-200 ring-1 ring-inset ring-blue-400/70'
                        : isDarkMode ? 'hover:bg-[#2A2D2E]/40 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {isSolutionOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <span className="truncate text-slate-300 text-[13px] font-semibold font-sans">解决方案 '{solution?.name || 'UI_CppLocProj'}'</span>
                  </div>

                  {isSolutionOpen && (
                    <div className="pl-1.5 border-l border-slate-750/30 dark:border-slate-800 ml-4">
                      {/* Project Subnode */}
                      {solutionTreeItems.map(item => {
                        if (item.kind === 'folder') {
                          const folder = item.folder;
                          const isFolderOpen = expandedSolutionFolderIds[folder.id] !== false;
                          const projectCount = solutionProjects.filter(project => project.solutionFolderId === folder.id).length;
                          const isDropTarget = solutionDropTarget === folder.id;
                          return (
                            <div
                              key={`folder:${folder.id}`}
                              data-solution-folder={folder.id}
                              onClick={() => setExpandedSolutionFolderIds(previous => ({ ...previous, [folder.id]: !isFolderOpen }))}
                              onDragOver={(event) => {
                                if (!draggedSolutionProjectId) return;
                                event.preventDefault();
                                event.stopPropagation();
                                event.dataTransfer.dropEffect = 'move';
                                setSolutionDropTarget(folder.id);
                              }}
                              onDragLeave={() => setSolutionDropTarget(current => current === folder.id ? null : current)}
                              onDrop={(event) => {
                                if (!draggedSolutionProjectId) return;
                                event.preventDefault();
                                event.stopPropagation();
                                const projectId = event.dataTransfer.getData('application/x-lingbuilder-solution-project') || draggedSolutionProjectId;
                                void moveDraggedProject(projectId, folder.id);
                              }}
                              className={`mb-1 flex min-h-8 items-center gap-1.5 rounded px-2 py-1.5 text-[13px] font-semibold font-sans cursor-pointer transition-colors ${
                                isDropTarget
                                  ? 'bg-blue-500/20 text-blue-100 ring-1 ring-inset ring-blue-400/80'
                                  : isDarkMode ? 'text-amber-200 hover:bg-[#2A2D2E]/60' : 'text-amber-800 hover:bg-amber-50'
                              }`}
                              title={`解决方案文件夹“${folder.name}”\n按住项目并拖到这里进行归类；不会移动磁盘文件。`}
                            >
                              {isFolderOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />}
                              <Folder className="w-4 h-4 shrink-0 text-amber-400 fill-amber-400/15" />
                              <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                              <span className="text-[9px] text-slate-500">{projectCount}</span>
                            </div>
                          );
                        }
                        const project = item.project;
                        const isStartupProject = project.id === (activeProjectId || solution?.startupProjectId);
                        const isProjectOpen = isStartupProject && expandedProjectIds[project.id] !== false;
                        const imageResources = (projectImageResources[project.id] || []).filter(resource => includesSearch(
                          resource.fileName,
                          resource.relativePath
                        ));
                        const resourceStatus = projectResourceStatus[project.id];
                        const isResourceGroupOpen = expandedResourceProjectIds[project.id]
                          ?? project.id === activeSolutionProjectId;
                        return (
                        <div
                          key={project.id}
                          data-solution-project={project.id}
                          className={`mb-2 last:mb-0 overflow-hidden rounded-md border ${project.solutionFolderId ? 'ml-4' : ''} ${
                            isStartupProject
                              ? isDarkMode
                                ? 'border-violet-500/25 bg-violet-500/[0.025]'
                                : 'border-violet-300 bg-violet-50/35'
                              : isDarkMode
                                ? 'border-slate-800/80 bg-black/5'
                                : 'border-slate-200 bg-white/50'
                          }`}
                        >
                        <div
                          tabIndex={0}
                          draggable
                          aria-grabbed={draggedSolutionProjectId === project.id}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('application/x-lingbuilder-solution-project', project.id);
                            event.dataTransfer.setData('text/plain', project.name);
                            setDraggedSolutionProjectId(project.id);
                          }}
                          onDragEnd={() => {
                            setDraggedSolutionProjectId(null);
                            setSolutionDropTarget(null);
                          }}
                          onClick={() => {
                            setExpandedProjectIds(previous => ({ ...previous, [project.id]: true }));
                            void onSetStartupProject?.(project.id);
                          }}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setContextMenu(null);
                            setWindowContextMenu(null);
                            setModuleContextMenu(null);
                            setSolutionContextMenu({ x: event.clientX, y: event.clientY, target: 'project', project });
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'F2') {
                              event.preventDefault();
                              event.stopPropagation();
                              void onExecuteCommand?.(RENAME_SOLUTION_PROJECT_COMMAND, project.id);
                              return;
                            }
                            if (!event.ctrlKey || event.key.toLocaleLowerCase() !== 'v' || project.type !== 'visual-cpp') return;
                            event.preventDefault();
                            void onPasteFunctionLibrary?.(project.id);
                          }}
                          className={`flex min-h-8 items-center gap-1.5 px-2 py-2 text-[13px] font-semibold font-sans cursor-pointer border-l-2 transition-colors ${
                            isStartupProject
                              ? 'bg-violet-500/10 text-violet-300'
                              : isDarkMode ? 'text-slate-300 hover:bg-[#2A2D2E]/40' : 'text-slate-700 hover:bg-slate-100'
                          } ${isStartupProject ? 'border-violet-500/70' : 'border-transparent'}`}
                          title={`${project.name} (${project.id})\n按住并拖动可移动到解决方案文件夹。`}
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (isStartupProject) {
                                setExpandedProjectIds(previous => ({ ...previous, [project.id]: !isProjectOpen }));
                                return;
                              }
                              setExpandedProjectIds(previous => ({ ...previous, [project.id]: true }));
                              void onSetStartupProject?.(project.id);
                            }}
                            aria-expanded={isProjectOpen}
                            className={`shrink-0 rounded p-0.5 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`}
                            title={isProjectOpen ? '折叠项目' : '展开项目'}
                          >
                            {isProjectOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          </button>
                          <Package className={`w-4 h-4 shrink-0 ${isStartupProject ? 'text-violet-300' : 'text-violet-400'}`} />
                          <span className="text-violet-300 font-semibold truncate">{project.name}</span>
                          {isStartupProject && (
                            <span className="ml-auto text-[9px] text-emerald-400">启动</span>
                          )}
                          {(project.references?.length || 0) > 0 && <span className="text-[9px] text-sky-400">引用 {project.references!.length}</span>}
                        </div>

                      {/* Project-global variables are a fixed source entry for native Visual C++ projects. */}
                      {isProjectOpen && project.type === 'visual-cpp' && (
                        <div className="pl-6 mt-1">
                          <button
                            type="button"
                            onClick={() => void onOpenProjectGlobalVariables?.(project.id)}
                            className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[13px] font-sans transition-colors ${
                              isDarkMode ? 'text-slate-300 hover:bg-[#2A2D2E]/50' : 'text-slate-700 hover:bg-slate-100'
                            }`}
                            title="打开当前项目固定的变量与常量文件"
                          >
                            <span aria-hidden="true" className="h-4 w-4 shrink-0" />
                            <FileCode className="h-4 w-4 shrink-0 text-cyan-500" />
                            <span className="truncate">项目变量与常量</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void onOpenProjectDataTypes?.(project.id)}
                            className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[13px] font-sans transition-colors ${
                              isDarkMode ? 'text-slate-300 hover:bg-[#2A2D2E]/50' : 'text-slate-700 hover:bg-slate-100'
                            }`}
                            title="打开项目级记录型数据类型；旧项目会在首次编辑时创建文件"
                          >
                            <span aria-hidden="true" className="h-4 w-4 shrink-0" />
                            <FileCode className="h-4 w-4 shrink-0 text-emerald-500" />
                            <span className="truncate">自定义数据类型</span>
                            {!files.some(file => file.path.replace(/\\/gu, '/').endsWith(`/${project.sourceRoot.replace(/\\/gu, '/').replace(/^\.\//u, '').replace(/\/+$/u, '')}/项目数据类型.lcpp`)) && (
                              <span className="ml-auto text-[9px] opacity-60">未创建</span>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Project modules group */}
                      {isProjectOpen && <div className="pl-6 mt-1">
                        <div
                          onClick={() => setIsProjectModulesOpen(!isProjectModulesOpen)}
                          className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer text-[13px] font-sans transition-colors ${
                            isDarkMode ? 'hover:bg-[#2A2D2E]/50 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                          title="查看和配置当前项目所使用的模块"
                        >
                          {isProjectModulesOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <Layers className="w-4 h-4 text-violet-500" />
                          <span className="truncate">模块</span>
                          <span className={`ml-auto text-[9px] px-1 rounded border ${
                            isDarkMode ? 'border-violet-500/20 text-violet-300 bg-violet-500/5' : 'border-violet-200 text-violet-700 bg-violet-50'
                          }`}>
                            {visibleProjectModules.length}
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
                                const familyState = projectModuleFamilyStateByRootId.get(moduleId);
                                const capabilityCount = familyState?.capabilityCount || getModuleCapabilityCount(module);
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
                                      className={`group w-[calc(100%-4px)] flex items-center gap-1.5 px-1.5 py-1.5 ml-1 rounded text-[13px] font-sans text-left transition-colors ${
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
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
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
                                        activeHintId={activeModuleHintId}
                                        onShowHint={onShowModuleHint}
                                      />
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>}

                      {/* Window designer group */}
                      {isProjectOpen && <div className="pl-6">
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
                          className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer text-[13px] font-sans transition-colors ${
                            isDarkMode ? 'hover:bg-[#2A2D2E]/50 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                          title="展开查看所有窗口，点击窗口可直接进入窗口设计器"
                        >
                          {isWindowsOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <Folder className="w-4 h-4 text-amber-500 fill-amber-500/10" />
                          <span className="truncate">窗口</span>
                          <span className={`ml-auto text-[9px] px-1 rounded border ${
                            isDarkMode ? 'border-amber-500/20 text-amber-300 bg-amber-500/5' : 'border-amber-200 text-amber-700 bg-amber-50'
                          }`}>
                            {designerStateMatchesActiveProject ? designerState.project.windows.length : 0}
                          </span>
                        </div>
                        {isWindowsOpen && (
                          <div className="mt-0.5 border-l border-slate-750/30 dark:border-slate-800 ml-3.5 pl-0.5">
                            {designerWindows.length === 0 ? (
                              <div className="pl-8 text-slate-500 text-[10px] py-1 font-sans">
                                {designerStateMatchesActiveProject ? '未找到匹配窗口' : '正在载入当前项目窗口…'}
                              </div>
                            ) : (
                              designerWindows.map(windowModel => renderWindowRow(project.id, windowModel))
                            )}
                          </div>
                        )}
                      </div>}

                      {/* Project image assets group */}
                      {isProjectOpen && <div className="pl-6">
                        <div
                          onClick={() => {
                            const nextOpen = !isResourceGroupOpen;
                            setExpandedResourceProjectIds(previous => ({ ...previous, [project.id]: nextOpen }));
                            if (nextOpen && resourceStatus !== 'ready' && resourceStatus !== 'loading') {
                              void refreshProjectImageResources(project.id);
                            }
                          }}
                          className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer text-[13px] font-sans transition-colors ${
                            isDarkMode ? 'hover:bg-[#2A2D2E]/50 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                          title="查看项目 assets 目录中的全部图片资源"
                        >
                          {isResourceGroupOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <Folder className="w-4 h-4 text-cyan-500 fill-cyan-500/10" />
                          <span className="truncate">图片资源 (assets)</span>
                          <span className={`ml-auto text-[9px] px-1 rounded border ${
                            isDarkMode ? 'border-cyan-500/20 text-cyan-300 bg-cyan-500/5' : 'border-cyan-200 text-cyan-700 bg-cyan-50'
                          }`}>
                            {(projectImageResources[project.id] || []).length}
                          </span>
                        </div>
                        {isResourceGroupOpen && (
                          <div className="mt-0.5 border-l border-slate-750/30 dark:border-slate-800 ml-3.5 pl-0.5">
                            {resourceStatus === 'loading' ? (
                              <div className="pl-6 flex items-center gap-1.5 text-slate-500 text-[10px] py-1.5 font-sans">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>正在读取图片资源…</span>
                              </div>
                            ) : resourceStatus === 'error' ? (
                              <button
                                type="button"
                                onClick={() => void refreshProjectImageResources(project.id)}
                                className="pl-6 text-rose-400 hover:text-rose-300 text-[10px] py-1.5 font-sans"
                              >
                                读取失败，点击重试
                              </button>
                            ) : imageResources.length === 0 ? (
                              <div className="pl-6 text-slate-500 text-[10px] py-1.5 font-sans">
                                {normalizedFileSearch ? '未找到匹配图片' : '暂无图片，可右键项目添加资源'}
                              </div>
                            ) : (
                              imageResources.map(resource => (
                                <div
                                  key={resource.relativePath}
                                  onClick={() => setResourcePreview({ projectId: project.id, resource })}
                                  onContextMenu={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setContextMenu(null);
                                    setWindowContextMenu(null);
                                    setModuleContextMenu(null);
                                    setSolutionContextMenu(null);
                                    setResourceContextMenu({ x: event.clientX, y: event.clientY, resource });
                                  }}
                                  className={`group w-full flex items-center gap-2 py-1.5 px-3 pl-7 text-[13px] cursor-pointer transition-colors font-sans ${
                                    resourcePreview?.projectId === project.id && resourcePreview.resource.relativePath === resource.relativePath
                                      ? isDarkMode ? 'bg-cyan-500/10 text-cyan-200' : 'bg-cyan-50 text-cyan-800'
                                      : isDarkMode ? 'text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                                  }`}
                                  title={`${resource.relativePath}\n单击预览，右键复制相对路径`}
                                >
                                  <ImageIcon className="w-4 h-4 shrink-0 text-cyan-400" />
                                  <span className="min-w-0 flex-1 truncate">{resource.fileName}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>}

                      {/* Project function libraries */}
                      {isProjectOpen && <div className="pl-6 mt-1.5">
                        <div
                          onClick={() => setIsFunctionLibraryOpen(!isFunctionLibraryOpen)}
                          className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer text-[13px] font-sans transition-colors ${
                            isDarkMode ? 'hover:bg-[#2A2D2E]/50 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                          title="独立、无状态、可跨项目复制的 .lcpp 功能库"
                        >
                          {isFunctionLibraryOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <Layers className="w-4 h-4 text-cyan-400" />
                          <span>功能代码</span>
                          <span className="ml-auto text-[9px] text-slate-500">{functionLibraryFiles.length}</span>
                        </div>
                        {isFunctionLibraryOpen && (
                          <div className="mt-0.5 border-l border-slate-750/30 dark:border-slate-800 ml-3.5 pl-0.5">
                            {functionLibraryFiles.length === 0
                              ? <div className="pl-8 text-slate-500 text-[10px] py-1 font-sans">右键项目可新建或粘贴功能库</div>
                              : functionLibraryFiles.map(renderFileRow)}
                          </div>
                        )}
                      </div>}

                      {/* includes / src Folder */}
                      {isProjectOpen && <div className="pl-6 mt-1.5">
                        <div
                          onClick={() => setIsSrcOpen(!isSrcOpen)}
                          className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer text-[13px] font-sans transition-colors ${
                            isDarkMode ? 'hover:bg-[#2A2D2E]/50 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isSrcOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <Folder className="w-4 h-4 text-blue-500 fill-blue-500/10" />
                          <span>游戏源码与头文件 (src)</span>
                        </div>
                        {isSrcOpen && (
                          <div className="mt-0.5 border-l border-slate-750/30 dark:border-slate-800 ml-3.5 pl-0.5">
                            {regularSrcFiles.length === 0 ? (
                              <div className="pl-8 text-slate-500 text-[10px] py-1 font-sans">未找到匹配文件</div>
                            ) : (
                              regularSrcFiles.map(renderFileRow)
                            )}
                          </div>
                        )}
                      </div>}

                      {/* Config Folder */}
                      {isProjectOpen && <div className="pl-6 mt-1.5">
                        <div
                          onClick={() => setIsConfigOpen(!isConfigOpen)}
                          className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer text-[13px] font-sans transition-colors ${
                            isDarkMode ? 'hover:bg-[#2A2D2E]/50 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isConfigOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <Folder className="w-4 h-4 text-amber-500 fill-amber-500/10" />
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
                      </div>}
                      </div>
                      );})}
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
                      <span className={`font-bold text-[9px] px-1 rounded uppercase font-mono ${
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
                  <span>工作台工具</span>
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">项目服务、发布和本地化开发工具</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                <section aria-labelledby="workspace-services-title" className="space-y-2">
                  <h4 id="workspace-services-title" className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    工作区服务
                  </h4>
                  <ExtensionHostPanel isDarkMode={isDarkMode} />
                  <DependencyPanel isDarkMode={isDarkMode} />
                  <RcResourcePanel isDarkMode={isDarkMode} />
                  <PublishingPanel isDarkMode={isDarkMode} />
                  <AiIndexPanel isDarkMode={isDarkMode} />
                  <SettingsSyncPanel isDarkMode={isDarkMode} />
                </section>

                <div className="border-t" style={{ borderColor: isDarkMode ? '#2d2d34' : '#e2e8f0' }} />

                {/* 1. Batch Smart AI Translation */}
                <div className={`p-2.5 rounded border space-y-2 ${
                  isDarkMode ? 'bg-[#1E1E1E]/50 border-slate-800/40' : 'bg-slate-100/60 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>智能中文代码映射器</span>
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-950/40 text-emerald-300 rounded border border-emerald-500/10">
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
                projectId={moduleProjectId}
                isDarkMode={isDarkMode}
                selectedModuleId={selectedModuleInspectorId}
                onAddLog={(msg) => {
                  window.dispatchEvent(new CustomEvent('add-app-log', { detail: { message: msg } }));
                }}
              />
            </div>
          )}
          {resourceImportingProjectId && !actionSuccessMessage && !actionErrorMessage && (
            <div role="status" className={`text-[11px] p-2.5 flex items-start gap-2 shrink-0 font-sans border-b ${
              isDarkMode
                ? 'bg-sky-950/30 border-sky-500/30 text-sky-300'
                : 'bg-sky-50 border-sky-200 text-sky-800'
            }`}>
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin mt-0.5" />
              <span>正在选择并复制图片资源…</span>
            </div>
          )}
          {actionErrorMessage && (
            <div role="alert" className={`text-[11px] p-2.5 flex items-start gap-2 animate-fade-in shrink-0 font-sans border-b ${
              isDarkMode
                ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="min-w-0 break-all">{actionErrorMessage}</span>
            </div>
          )}

          {/* ================= TAB 4: GIT CHANGES ================= */}
          {activeTab === 'git' && (
            <div className="flex-1 min-h-0 overflow-hidden font-sans">
              <SourceControlPanel
                initialStatus={sourceControlStatus}
                isDarkMode={isDarkMode}
                variant="full"
                onChanged={onSourceControlChanged}
                onExecuteCommand={onExecuteSourceControlCommand}
              />
            </div>
          )}

        </div>
      )}
      {renderContextMenu()}
      {renderWindowContextMenu()}
      {renderSolutionContextMenu()}
      {renderResourceContextMenu()}
      {renderModuleContextMenu()}
      {resourcePreview && (
        <ImageResourcePreviewDialog
          preview={resourcePreview}
          isDarkMode={isDarkMode}
          onClose={() => setResourcePreview(null)}
          onCopyPath={async relativePath => {
            const success = await Promise.resolve(onCopyProjectResourcePath?.(relativePath) ?? false);
            if (success) triggerSuccess(`已复制相对路径：${relativePath}`);
            else triggerError('复制图片资源相对路径失败。');
          }}
        />
      )}
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

function ImageResourcePreviewDialog({
  preview,
  isDarkMode,
  onClose,
  onCopyPath
}: {
  preview: ResourcePreview;
  isDarkMode: boolean;
  onClose: () => void;
  onCopyPath: (relativePath: string) => void | Promise<void>;
}) {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const { projectId, resource } = preview;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 p-3 font-sans sm:p-6"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`图片资源预览：${resource.fileName}`}
        className={`flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border shadow-2xl ${
          isDarkMode ? 'border-slate-700 bg-[#1E1E24] text-slate-100' : 'border-slate-200 bg-white text-slate-900'
        }`}
      >
        <header className={`flex items-center gap-3 border-b px-4 py-3 ${isDarkMode ? 'border-slate-700/80' : 'border-slate-200'}`}>
          <ImageIcon className="h-5 w-5 shrink-0 text-cyan-400" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">{resource.fileName}</h2>
            <p className={`truncate text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{resource.relativePath}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭图片预览"
            title="关闭 (Esc)"
            className={`rounded-md p-1.5 transition-colors ${isDarkMode ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div
          className="relative flex min-h-56 flex-1 items-center justify-center overflow-auto p-5 sm:min-h-80"
          style={{
            backgroundColor: isDarkMode ? '#15151a' : '#f8fafc',
            backgroundImage: 'linear-gradient(45deg, rgba(100,116,139,.12) 25%, transparent 25%), linear-gradient(-45deg, rgba(100,116,139,.12) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(100,116,139,.12) 75%), linear-gradient(-45deg, transparent 75%, rgba(100,116,139,.12) 75%)',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
            backgroundSize: '16px 16px'
          }}
        >
          {loadState === 'loading' && (
            <div className="absolute flex items-center gap-2 rounded-md bg-black/45 px-3 py-2 text-xs text-slate-200">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>正在载入图片…</span>
            </div>
          )}
          {loadState === 'error' && (
            <div className="flex flex-col items-center gap-2 text-center text-sm text-rose-400" role="alert">
              <AlertTriangle className="h-6 w-6" />
              <span>图片无法预览，请确认资源文件没有损坏。</span>
            </div>
          )}
          <img
            src={getDesignerImagePreviewSource(projectId, resource.relativePath)}
            alt={resource.fileName}
            className={`max-h-[65vh] max-w-full object-contain ${loadState === 'error' ? 'hidden' : ''}`}
            onLoad={event => {
              setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
              setLoadState('ready');
            }}
            onError={() => setLoadState('error')}
          />
        </div>

        <footer className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-3 text-[11px] ${isDarkMode ? 'border-slate-700/80 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
          <span>{formatResourceFileSize(resource.size)}</span>
          {dimensions && <span>{dimensions.width} × {dimensions.height} 像素</span>}
          <button
            type="button"
            onClick={() => void onCopyPath(resource.relativePath)}
            className="ml-auto flex items-center gap-1.5 rounded-md bg-cyan-500/10 px-2.5 py-1.5 font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>复制相对路径</span>
          </button>
        </footer>
      </section>
    </div>
  );
}

function formatResourceFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function ModuleInterfaceTree({
  module,
  isDarkMode,
  expandedGroups,
  onToggleGroup,
  onOpenModule,
  activeHintId,
  onShowHint
}: {
  module: InstalledModule;
  isDarkMode: boolean;
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (groupId: string) => void;
  onOpenModule: () => void;
  activeHintId?: string;
  onShowHint?: (hint: ModuleHintContent) => void;
}) {
  const contributes = module.manifest.contributes || {};
  const commands = contributes.commands || [];
  const types = contributes.types || [];
  const snippets = contributes.snippets || [];
  const designerControls = contributes.designerControls || [];
  const docs = contributes.docs || [];
  const targets = module.manifest.targets || [];
  const bindings = module.manifest.bindings?.commands || [];
  const cppRows = buildModuleCppRows(targets, bindings, docs);
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
            detail={`${type.description} · ${formatModulePublicType(type)}`}
            isDarkMode={isDarkMode}
            selected={activeHintId === `${module.manifest.id}:type:${type.name}`}
            onClick={() => onShowHint?.({
              itemId: `${module.manifest.id}:type:${type.name}`,
              moduleId: module.manifest.id,
              moduleName: module.manifest.name,
              kind: '类型',
              title: type.name,
              description: type.description || '该模块未提供此类型的详细说明。',
              declaration: formatModulePublicTypeSource(type),
              fields: [
                { label: '中文类型', value: type.name },
                { label: '类型种类', value: getModulePublicTypeKind(type) === 'record' ? '公开记录' : getModulePublicTypeKind(type) === 'array' ? '公开数组' : '不透明类型' },
                ...(type.fields || []).map(field => ({ label: `字段 · ${field.name}`, value: `${field.type}${field.isArray ? '[]' : ''}` })),
                ...(type.elementType ? [{ label: '元素类型', value: type.elementType }] : []),
                ...(type.cppType ? [{ label: '对应 C++ 类型', value: type.cppType }] : [])
              ]
            })}
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
          (() => {
            const itemId = `${module.manifest.id}:command:${command.name}:${command.signature}`;
            const binding = bindings.find(item => item.command === command.name);
            return (
              <ModuleTreeLeaf
                key={itemId}
                icon={<FileCode className="h-3 w-3 text-cyan-300" />}
                title={command.name}
                badge={command.returnType}
                detail={command.signature}
                description={command.description}
                isDarkMode={isDarkMode}
                selected={activeHintId === itemId}
                onClick={() => onShowHint?.({
                  itemId,
                  moduleId: module.manifest.id,
                  moduleName: module.manifest.name,
                  kind: '命令接口',
                  title: command.name,
                  description: command.description || '该模块未提供此命令的详细说明。',
                  declaration: command.signature,
                  fields: [
                    { label: '返回值', value: command.returnType || '空' },
                    ...(command.returnDescription ? [{ label: '返回值说明', value: command.returnDescription }] : []),
                    { label: '插入代码', value: command.insertText || command.signature },
                    { label: 'C++ 运行时', value: binding?.runtimeName || '模块未声明绑定' },
                    { label: '编码', value: binding?.encoding || '默认' },
                    { label: '适用目标', value: binding?.targetIds?.join('、') || '全部已支持目标' }
                  ]
                })}
              />
            );
          })()
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
            selected={activeHintId === `${module.manifest.id}:control:${control.type}`}
            onClick={() => onShowHint?.({
              itemId: `${module.manifest.id}:control:${control.type}`,
              moduleId: module.manifest.id,
              moduleName: module.manifest.name,
              kind: '设计器控件',
              title: control.label,
              description: (control.events || []).length > 0
                ? '该控件可在窗口设计器中使用，并提供下列事件绑定。'
                : '该控件可在窗口设计器中使用，模块暂未声明事件。',
              declaration: control.type,
              fields: [
                { label: '控件类型', value: control.type },
                { label: '默认属性', value: Object.keys(control.defaultProps || {}).length > 0 ? JSON.stringify(control.defaultProps, null, 2) : '模块未声明' },
                { label: '事件', value: (control.events || []).map(event => `${event.label}（${event.name}）→ ${event.handlerPattern}`).join('\n') || '模块未声明' }
              ]
            })}
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
            {row.values.map(item => (
              <ModuleTreeLeaf
                key={`${module.manifest.id}:cpp:${item.id}`}
                icon={<FileText className="h-3 w-3 text-slate-400" />}
                title={item.value}
                isDarkMode={isDarkMode}
                compact
                selected={activeHintId === `${module.manifest.id}:cpp:${item.id}`}
                onClick={() => onShowHint?.({
                  itemId: `${module.manifest.id}:cpp:${item.id}`,
                  moduleId: module.manifest.id,
                  moduleName: module.manifest.name,
                  kind: 'C++ 依赖',
                  title: item.value,
                  description: `这是模块声明的${row.label}信息，构建或导出 C++ 工程时由模块服务按目标平台处理。`,
                  declaration: item.value,
                  fields: [
                    { label: '依赖类别', value: row.label },
                    { label: '声明值', value: item.value },
                    { label: '模块标识', value: module.manifest.id }
                  ]
                })}
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
  compact = false,
  selected = false,
  onClick
}: {
  key?: React.Key;
  icon: React.ReactNode;
  title: string;
  detail?: string;
  description?: string;
  badge?: string;
  isDarkMode: boolean;
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-[calc(100%-4px)] min-w-0 rounded px-1.5 text-left ${compact ? 'py-0.5' : 'py-1'} text-[10px] ${
        selected
          ? isDarkMode
            ? 'bg-sky-500/20 text-sky-100'
            : 'bg-sky-100 text-sky-900'
          : isDarkMode
            ? 'text-slate-300 hover:bg-[#2A2D2E]/30'
            : 'text-slate-700 hover:bg-slate-50'
      }`}
      title={[title, detail, description].filter(Boolean).join('\n')}
      aria-label={`查看${title}的提示信息`}
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
    </button>
  );
}

function getModuleCapabilityCount(module: InstalledModule): number {
  const contributes = module.manifest.contributes || {};
  const targets = module.manifest.targets || [];
  return (contributes.commands || []).length
    + (contributes.types || []).length
    + (contributes.snippets || []).length
    + (contributes.designerControls || []).length
    + (contributes.docs || []).length
    + targets.reduce((sum, target) => sum
      + (target.headers || []).length
      + (target.sources || []).length
      + (target.libs || []).length
      + (target.runtimeFiles || []).length, 0)
    + (module.manifest.bindings?.commands || []).length;
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
  const targets = manifest.targets || [];
  const bindings = manifest.bindings?.commands || [];
  const normalizedSearch = searchText.trim().toLowerCase();
  const matchesSearch = (...values: Array<string | undefined>) => (
    !normalizedSearch || values.some(value => value?.toLowerCase().includes(normalizedSearch))
  );
  const filteredTypes = types.filter(type => matchesSearch(
    type.name,
    type.description,
    type.cppType,
    type.elementType,
    ...(type.fields || []).flatMap(field => [field.name, field.type, field.description])
  ));
  const filteredCommands = commands.filter(command => matchesSearch(
    command.name,
    command.signature,
    command.description,
    command.returnType,
    bindings.find(binding => binding.command === command.name)?.runtimeName
  ));
  const filteredControls = designerControls.filter(control => matchesSearch(
    control.label,
    control.type,
    ...(control.events || []).flatMap(event => [event.label, event.handlerPattern])
  ));
  const filteredSnippets = snippets.filter(snippet => matchesSearch(snippet.label, snippet.description, snippet.insertText));
  const filteredDocs = docs.filter(doc => matchesSearch(doc.title, doc.path));
  const cppRows = buildModuleCppRows(targets, bindings, docs)
    .map(row => ({ ...row, values: row.values.filter(item => matchesSearch(row.label, item.value)) }))
    .filter(row => row.values.length > 0);
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
        declaration: formatModulePublicTypeSource(selectedType),
        description: selectedType.description,
        badge: getModulePublicTypeKind(selectedType) === 'record' ? '公开记录' : getModulePublicTypeKind(selectedType) === 'array' ? '公开数组' : '不透明类型'
      };
    }
    const selectedCommand = commands.find(command => selectedInfoNodeId === `command:${command.name}:${command.signature}`);
    if (selectedCommand) {
      const selectedBinding = bindings.find(binding => binding.command === selectedCommand.name);
      return {
        kind: '命令接口',
        title: selectedCommand.name,
        declaration: selectedCommand.signature,
        description: selectedCommand.description,
        badge: selectedCommand.returnType || '空',
        extra: selectedBinding ? `C++ 运行时：${selectedBinding.runtimeName}` : undefined,
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
      const item = row.values.find(value => selectedInfoNodeId === `cpp:${value.id}`);
      if (item) {
        return {
          kind: 'C++ 依赖',
          title: item.value,
          declaration: item.value,
          description: row.label,
          badge: row.label,
          copyText: item.value
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
                        detail={formatModulePublicType(type)}
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
                    {cppRows.flatMap(row => row.values.map(item => (
                      <ModuleInfoTreeLeaf
                        key={`cpp:${item.id}`}
                        icon={<FileText className="h-3 w-3 text-slate-400" />}
                        label={item.value}
                        detail={row.label}
                        isDarkMode={isDarkMode}
                        selected={selectedInfoNodeId === `cpp:${item.id}`}
                        onClick={() => setSelectedInfoNodeId(`cpp:${item.id}`)}
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
                      ...filteredTypes.map(type => [type.name, formatModulePublicType(type), '✓', type.description]),
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
                          {bindings.find(binding => binding.command === command.name) && (
                            <div className={`mt-1 break-all text-[10px] ${subtleClass}`}>
                              C++ 运行时：{bindings.find(binding => binding.command === command.name)?.runtimeName}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ModuleInfoSection>

                <ModuleInfoSection title={`类型/类 ${filteredTypes.length}/${types.length}`} isDarkMode={isDarkMode}>
                  <ModuleInfoTable
                    headers={['类型名称', '类型声明', '公开', '备注']}
                    rows={filteredTypes.map(type => [type.name, formatModulePublicType(type), '✓', type.description])}
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
                            rows={row.values.map(item => [row.label, item.value])}
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
  return BUILTIN_MODULES.filter(manifest => manifest.id === 'lingbuilder.win32.basic').map(manifest => ({
    manifest,
    installPath: `builtin://${manifest.id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
}
