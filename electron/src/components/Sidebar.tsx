import React, { useState, useEffect, useCallback, useRef } from 'react';
import { requestWorkbenchConfirm, requestWorkbenchPrompt } from '../services/workbench/workbenchConfirmService';
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
  Hash,
  Image as ImageIcon,
  FolderOutput
} from 'lucide-react';
import { CppFile, ExtractedString, SourceControlStatus } from '../types';
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
  fetchDesignerImagePreviewBlob,
  listDesignerImageResources,
  type DesignerImageDeleteResult,
  type DesignerImageImportResult,
  type DesignerImageReferenceInfo,
  type DesignerImageResource
} from '../services/windowDesigner/designerAssetClient';
import type { InstalledModule, ModuleHintContent, ModuleTargetContribution } from '../services/modules/types';
import { setModulePageActive } from '../services/modules/moduleDetailView';
import { BUILTIN_MODULES } from '../services/modules/builtinModules';
import { formatModulePublicType, formatModulePublicTypeSource, getModulePublicTypeKind } from '../services/modules/modulePublicTypeService';
import {
  getModuleFamilyModules,
  getModuleFamilySearchText,
  isModuleHiddenByFamily,
  MODULE_FAMILIES
} from '../services/modules/moduleFamilies';
import type { SolutionFolder, SolutionModel, SolutionProject } from '../services/solution/solutionClient';
import { isProjectDataTypesFilePath } from '../services/lingCpp/projectDataTypeService';
import { isProjectGlobalsFilePath } from '../services/lingCpp/projectGlobalService';
import { isProjectDllCommandsFilePath } from '../services/lingCpp/projectDllCommandService';
import type { CommandService } from '../services/commands/commandService';
import { getMenuService } from '../services/menus/menuService';
import { SOLUTION_EMBEDDED_RESOURCE_CONTEXT_MENU, SOLUTION_EXPLORER_CONTEXT_MENU, SOLUTION_PROJECT_CONTEXT_MENU } from '../services/menus/types';
import { isEmbeddedResourceSourceOpenable } from '../services/windowDesigner/embeddedResourceActions';
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
type ResourceContextMenu = { x: number; y: number; resource: DesignerImageResource; project: SolutionProject };
/** 内嵌资源条目右键菜单：携带逻辑名与源文件，供命令直接使用。 */
type EmbeddedResourceContextMenu = { x: number; y: number; name: string; file: string };
type ResourcePreview = { projectId: string; resource: DesignerImageResource };
type SolutionTreeItem =
  | { kind: 'folder'; folder: SolutionFolder }
  | { kind: 'project'; project: SolutionProject };

type ModuleCppRow = {
  label: string;
  values: Array<{ id: string; value: string }>;
};

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('模块服务暂未返回 JSON');
  }
  return response.json();
}

/** 判断项目源码根下是否已创建固定声明文件（路径规范化后比较，容忍前导斜杠与 ./ 前缀差异）。 */
function projectDeclarationFileExists(files: CppFile[], sourceRoot: string, fileName: string): boolean {
  const root = `/${sourceRoot.replace(/\\/gu, '/').replace(/^\.\//u, '').replace(/\/+$/u, '').replace(/^\/+/u, '').toLowerCase()}`;
  return files.some(file => {
    const normalized = `/${file.path.replace(/\\/gu, '/').replace(/^\.\//u, '').replace(/^\/+/u, '').toLowerCase()}`;
    const expected = `${root}/${fileName}`.toLowerCase();
    return normalized === expected || normalized.endsWith(expected);
  });
}

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
  workspaceKey?: string;
  files: CppFile[];
  activeFile: CppFile;
  onSelectFile: (file: CppFile, forceCodeView?: boolean) => void;
  onRunBuild: () => void;
  isBuilding: boolean;
  isDarkMode?: boolean;
  showLeftSidebar?: boolean;
  setShowLeftSidebar?: (val: boolean) => void;
  showDesignerToolbox?: boolean;
  onDesignerToolboxHostChange?: (host: HTMLElement | null) => void;
  showDesignerAssistant?: boolean;
  assistantContent?: React.ReactNode;
  onSetStatus?: (id: string, status: 'translated' | 'skipped' | 'pending') => void;
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
  onConfigureBuildPaths?: (projectId: string) => void | Promise<void>;
  onConfigureEmbeddedResources?: (projectId: string) => void | Promise<void>;
  onDeleteProject?: (projectId: string, deleteFiles: boolean) => void | Promise<void>;
  onSolutionCommand?: (command: 'build' | 'clean' | 'rebuild', projectId?: string) => void | Promise<void>;
  onCloseSolution?: () => void | Promise<void>;
  onOpenSolutionDirectory?: () => void | Promise<void>;
  onOpenProjectDirectory?: (projectId: string) => void | Promise<void>;
  onOpenProjectGlobalVariables?: (projectId: string) => void | Promise<void>;
  onOpenProjectDataTypes?: (projectId: string) => void | Promise<void>;
  onOpenProjectDllCommands?: (projectId: string) => void | Promise<void>;
  onCreateFunctionLibrary?: (projectId: string) => void | Promise<void>;
  onPasteFunctionLibrary?: (projectId: string) => void | Promise<void>;
  onCopySolutionFullPath?: () => boolean | Promise<boolean>;
  onCopyProjectFullPath?: (projectId: string) => boolean | Promise<boolean>;
  onAddProjectResource?: (projectId: string) => Promise<DesignerImageImportResult>;
  onExportLcppSourcePackage?: (projectId: string) => void | Promise<void>;
  onCopyProjectResourcePath?: (relativePath: string) => Promise<boolean>;
  onDeleteProjectResource?: (projectId: string, relativePath: string, confirmed: boolean) => Promise<DesignerImageDeleteResult>;
  activeModuleHintId?: string;
  onShowModuleHint?: (hint: ModuleHintContent) => void;
}

export default function Sidebar({
  workspaceKey = '',
  files,
  activeFile,
  onSelectFile,
  onRunBuild,
  isBuilding,
  isDarkMode = true,
  showLeftSidebar = true,
  setShowLeftSidebar,
  showDesignerToolbox = false,
  onDesignerToolboxHostChange,
  showDesignerAssistant = false,
  assistantContent,
  onSetStatus,
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
  onConfigureBuildPaths,
  onConfigureEmbeddedResources,
  onDeleteProject,
  onSolutionCommand,
  onCloseSolution,
  onOpenSolutionDirectory,
  onOpenProjectDirectory,
  onOpenProjectGlobalVariables,
  onOpenProjectDataTypes,
  onOpenProjectDllCommands,
  onCreateFunctionLibrary,
  onPasteFunctionLibrary,
  onCopySolutionFullPath,
  onCopyProjectFullPath,
  onAddProjectResource,
  onExportLcppSourcePackage,
  onCopyProjectResourcePath,
  onDeleteProjectResource,
  activeModuleHintId,
  onShowModuleHint
}: SidebarProps) {
  // Activity views: solution explorer, tools, modules and Git changes.
  const [activeTab, setActiveTab] = useState<'explorer' | 'properties' | 'assistant' | 'actions' | 'outline' | 'git'>('explorer');
  // 模块页激活状态广播：主区据此在浏览模块列表时显示占位页而非编辑器/设计器（详情页签打开除外）。
  useEffect(() => {
    setModulePageActive(activeTab === 'outline');
  }, [activeTab]);
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
  const [embeddedResourceContextMenu, setEmbeddedResourceContextMenu] = useState<EmbeddedResourceContextMenu | null>(null);
  const [resourcePreview, setResourcePreview] = useState<ResourcePreview | null>(null);
  const [resourceDeleteTarget, setResourceDeleteTarget] = useState<{ project: SolutionProject; resource: DesignerImageResource } | null>(null);
  const [resourceDeleteReferences, setResourceDeleteReferences] = useState<DesignerImageReferenceInfo[]>([]);
  const [resourceDeleteTruncated, setResourceDeleteTruncated] = useState(0);
  const [resourceDeleteBusy, setResourceDeleteBusy] = useState(false);
  const [designerState, setDesignerState] = useState(() => readWindowDesignerState());

  useEffect(() => {
    const handleCloseMenu = () => {
      setContextMenu(null);
      setWindowContextMenu(null);
      setModuleContextMenu(null);
      setSolutionContextMenu(null);
      setResourceContextMenu(null);
      setEmbeddedResourceContextMenu(null);
    };
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);
  useEffect(() => {
    const menuRegistration = registerSolutionExplorerMenu(getMenuService(commandService));
    const openModuleInfo = async (_context: unknown, module: unknown) => {
        if (!module || typeof module !== 'object') throw new Error('模块信息无效。');
        await window.lingBuilder?.modules?.openInfo(module);
      };
    const commandRegistration = commandService.registerCommands([
      { id: 'lingbuilder.modules.openModuleInfo', title: '查看模块信息', aliases: ['打开模块信息'], category: '模块', description: '在独立窗口查看模块公开 API、文档和示例。', handler: openModuleInfo },
      { id: 'lingbuilder.modules.focusModuleInfo', title: '激活模块信息窗口', category: '模块', handler: openModuleInfo },
      { id: 'lingbuilder.modules.refreshModuleInfo', title: '刷新模块信息', category: '模块', handler: openModuleInfo }
    ]);
    return () => { menuRegistration.dispose(); commandRegistration.dispose(); };
  }, [commandService]);
  const [isSrcOpen, setIsSrcOpen] = useState(true);
  const [isFunctionLibraryOpen, setIsFunctionLibraryOpen] = useState(true);
  const [isEmbeddedResourcesOpen, setIsEmbeddedResourcesOpen] = useState(true);
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
  const workspaceKeyRef = useRef(workspaceKey);
  workspaceKeyRef.current = workspaceKey;

  // Group files by directories
  const normalizedFileSearch = fileSearch.trim().toLowerCase();
  const includesSearch = (...values: Array<string | undefined>) => (
    !normalizedFileSearch || values.some(value => value?.toLowerCase().includes(normalizedFileSearch))
  );
  const srcFiles = files.filter(f => f.path.startsWith('src/') && includesSearch(f.name, f.path));
  const functionLibraryFiles = files.filter(file => file.language === 'lingcpp' && includesSearch(file.name, file.path) && isFunctionLibrarySource(file.translatedContent || file.originalContent));
  const designerStateMatchesActiveProject = designerState.project.id === activeSolutionProjectId;
  // 项目级内嵌资源清单：与设计器「窗口属性 → 项目 / 内嵌资源」面板消费同一份模型数据。
  const activeEmbeddedResources = designerStateMatchesActiveProject ? designerState.project.embeddedResources || [] : [];
  const embeddedResourceSourcePaths = new Set(activeEmbeddedResources.map(resource => resource.file));
  const projectEmbeddedResources = activeEmbeddedResources.filter(resource => includesSearch(resource.name, resource.file));
  const regularSrcFiles = srcFiles.filter(file =>
    !functionLibraryFiles.includes(file)
    // 项目固定结构文件（项目全局变量/项目数据类型/项目DLL命令）由解决方案树顶部的固定入口展示，不在 src 目录下重复列出。
    && !isProjectGlobalsFilePath(file.path)
    && !isProjectDataTypesFilePath(file.path)
    && !isProjectDllCommandsFilePath(file.path)
    // 已声明为内嵌资源的源文件由「内嵌资源」组统一展示（同一文件不在两处重复出现）。
    && !embeddedResourceSourcePaths.has(file.path));
  const configFiles = files.filter(f => f.path.startsWith('config/') && includesSearch(f.name, f.path));
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
    const requestedWorkspaceKey = workspaceKey;
    setProjectModules([]);
    setProjectModulesStatus(`正在读取项目 ${projectId} 的模块...`);
    try {
      const result = await fetchJson(`/api/modules/project?projectId=${encodeURIComponent(projectId)}`);
      if (moduleProjectIdRef.current !== projectId || workspaceKeyRef.current !== requestedWorkspaceKey) return;
      if (!result.ok) throw new Error(result.error || '项目模块读取失败');
      const modules = Array.isArray(result.modules) ? result.modules as InstalledModule[] : [];
      setProjectModules(modules.length > 0 ? modules : getFallbackProjectModules());
      setProjectModulesStatus(modules.length > 0 ? '项目模块已载入' : '当前项目未启用模块');
    } catch (error) {
      if (moduleProjectIdRef.current !== projectId || workspaceKeyRef.current !== requestedWorkspaceKey) return;
      setProjectModules(getFallbackProjectModules());
      setProjectModulesStatus('模块服务等待重启，已显示内置基础模块');
    }
  }, [moduleProjectId, workspaceKey]);

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
  const handleTabClick = (tab: 'explorer' | 'properties' | 'assistant' | 'actions' | 'outline' | 'git') => {
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

  // 解决方案树模块节点右键「从项目中禁用」：与模块管理页的禁用开关共用同一接口和级联禁用语义。
  const disableProjectModuleFromTree = async (module: InstalledModule) => {
    const projectId = moduleProjectIdRef.current;
    if (module.manifest.id === 'lingbuilder.win32.basic') {
      triggerError('Win32窗口基础模块是普通项目的默认基础能力，不能禁用。');
      return;
    }
    try {
      const planResponse = await fetch('/api/modules/project/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, moduleId: module.manifest.id, action: 'disable' })
      });
      const planResult = await planResponse.json();
      if (!planResult.ok) throw new Error(planResult.error || '模块依赖计划生成失败');
      const dependentModuleIds: string[] = planResult.plan?.dependentModuleIds || [];
      const cascade = dependentModuleIds.length > 0;
      if (cascade && !await requestWorkbenchConfirm({
        title: '级联禁用确认',
        description: `以下模块依赖“${module.manifest.name}”，必须一并禁用：\n${dependentModuleIds.join('\n')}\n\n是否级联禁用？`,
        confirmLabel: '级联禁用',
        cancelLabel: '取消'
      })) return;
      const response = await fetch('/api/modules/project/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, moduleId: module.manifest.id, cascade })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '禁用模块失败');
      triggerSuccess(cascade
        ? `已从项目禁用 ${module.manifest.name}，并级联禁用：${dependentModuleIds.join('、')}。`
        : `已从项目禁用 ${module.manifest.name}。`);
      window.dispatchEvent(new CustomEvent('lingbuilder-modules-changed', {
        detail: { projectId, moduleId: module.manifest.id, scope: 'project' }
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      triggerError(`从项目禁用模块失败：${message}`);
    }
  };

  const refreshProjectImageResources = useCallback(async (projectId: string): Promise<boolean> => {
    const requestedWorkspaceKey = workspaceKey;
    setProjectResourceStatus(previous => ({ ...previous, [projectId]: 'loading' }));
    try {
      const resources = await listDesignerImageResources(projectId);
      if (workspaceKeyRef.current !== requestedWorkspaceKey) return false;
      setProjectImageResources(previous => ({ ...previous, [projectId]: resources }));
      setProjectResourceStatus(previous => ({ ...previous, [projectId]: 'ready' }));
      return true;
    } catch {
      if (workspaceKeyRef.current !== requestedWorkspaceKey) return false;
      setProjectResourceStatus(previous => ({ ...previous, [projectId]: 'error' }));
      return false;
    }
  }, [workspaceKey]);

  useEffect(() => {
    setProjectImageResources({});
    setProjectResourceStatus({});
    setExpandedResourceProjectIds({});
    setResourceContextMenu(null);
    setResourcePreview(null);
    setResourceDeleteTarget(null);
    setResourceDeleteReferences([]);
    setResourceDeleteTruncated(0);
    setResourceDeleteBusy(false);
  }, [workspaceKey]);

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

  // 删除图片资源：先不带 confirmed 发一次拿引用清单，有引用时弹确认框让用户二次确认。
  const startResourceDelete = async (projectId: string, resource: DesignerImageResource) => {
    if (resourceDeleteBusy) return;
    const project = solution?.projects.find(candidate => candidate.id === projectId);
    if (!project) {
      triggerError('未找到图片资源所属项目。');
      return;
    }
    if (!onDeleteProjectResource) {
      triggerError('当前工作台未提供图片资源删除命令。');
      return;
    }
    setResourceContextMenu(null);
    setResourceDeleteBusy(true);
    try {
      const result = await onDeleteProjectResource(projectId, resource.relativePath, false);
      if (result.status === 'error') {
        triggerError(result.error);
        return;
      }
      if (result.status === 'needs-confirmation') {
        setResourceDeleteReferences(result.references);
        setResourceDeleteTruncated(result.truncated);
      } else {
        setResourceDeleteReferences([]);
        setResourceDeleteTruncated(0);
      }
      setResourceDeleteTarget({ project, resource });
    } catch (error) {
      triggerError(error instanceof Error ? error.message : '图片资源删除失败。');
    } finally {
      setResourceDeleteBusy(false);
    }
  };

  const confirmResourceDelete = async () => {
    const target = resourceDeleteTarget;
    if (!target || resourceDeleteBusy || !onDeleteProjectResource) return;
    setResourceDeleteBusy(true);
    try {
      const result = await onDeleteProjectResource(target.project.id, target.resource.relativePath, true);
      if (result.status === 'error') {
        triggerError(result.error);
        return;
      }
      setResourceDeleteTarget(null);
      setResourceDeleteReferences([]);
      setResourceDeleteTruncated(0);
      if (resourcePreview?.projectId === target.project.id && resourcePreview.resource.relativePath === target.resource.relativePath) {
        setResourcePreview(null);
      }
      await refreshProjectImageResources(target.project.id);
      triggerSuccess(`已删除图片资源：${target.resource.relativePath}`);
    } catch (error) {
      triggerError(error instanceof Error ? error.message : '图片资源删除失败。');
    } finally {
      setResourceDeleteBusy(false);
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
              界面设计
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
        {/\.(?:cpp|cc|cxx|c)$/iu.test(contextMenu.file.name) && (
          <div
            className={`px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer transition-colors`}
            onClick={() => { onExecuteCommand?.('workbench.action.project.adaptNativeCpp', contextMenu.file.path); }}
          >
            <span>适配为中文工程…</span>
          </div>
        )}
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
            void (async () => {
              const newName = await requestWorkbenchPrompt({
                title: '重命名文件',
                description: `重命名文件 ${contextMenu.file.name}`,
                inputLabel: '新文件名',
                inputValue: contextMenu.file.name
              });
              if (newName && newName.trim() && newName !== contextMenu.file.name) {
                void Promise.resolve(onRenameFile?.(contextMenu.file, newName.trim()) ?? false).then(success => {
                  if (success) triggerSuccess(`已重命名文件为 ${newName.trim()}`);
                });
              }
            })();
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
            <div className={menuItemClass} onClick={() => void onConfigureBuildPaths?.(project.id)}>
              <FolderOutput className="w-3.5 h-3.5 text-emerald-400" />
              <span>构建目录…</span>
            </div>
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

  /**
   * 内嵌资源条目右键菜单：菜单项一律来自 MenuService 贡献（solution/embeddedResource/context），
   * 动作经 CommandService 执行 —— 复制逻辑名（写 资源_* 调用最常用）、复制源文件路径、打开源文件、打开配置对话框。
   */
  const renderEmbeddedResourceContextMenu = () => {
    if (!embeddedResourceContextMenu) return null;
    const { name, file } = embeddedResourceContextMenu;
    const sourceFile = files.find(candidate => candidate.path === file);
    const context = {
      'workspace.open': Boolean(solution),
      'embeddedResource.name': name,
      'embeddedResource.file': file,
      // 只按扩展名判断（文件列表异步加载，用它判断会让「打开源文件」一闪一没）；命令侧对未加载的文本文件仍有中文兜底。
      'embeddedResource.openable': isEmbeddedResourceSourceOpenable(file)
    };
    const items = getMenuService(commandService).resolveMenu(SOLUTION_EMBEDDED_RESOURCE_CONTEXT_MENU, context, { includeDisabled: true });
    if (items.length === 0) return null;
    return (
      <div
        style={{ top: `${embeddedResourceContextMenu.y}px`, left: `${embeddedResourceContextMenu.x}px` }}
        className={`fixed z-[9999] min-w-[210px] py-1 rounded shadow-lg border text-xs select-none font-sans ${
          isDarkMode ? 'bg-[#252526] border-[#454545] text-slate-200' : 'bg-white border-slate-250 text-slate-800'
        }`}
        onClick={() => setEmbeddedResourceContextMenu(null)}
      >
        <div className={`px-3 py-1 text-[10px] font-mono ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{name}</div>
        {items.map(item => item.kind === 'separator' ? (
          <div key={item.id} className="my-1 h-[1px] bg-slate-700/20 dark:bg-slate-700/50" />
        ) : item.kind === 'command' ? (
          <div
            key={item.id}
            title={item.command.description}
            className={`flex items-center gap-2 px-3 py-1.5 transition-colors ${
              item.command.enabled ? 'cursor-pointer hover:bg-blue-500 hover:text-white' : 'cursor-not-allowed opacity-50'
            }`}
            onClick={() => {
              if (!item.command.enabled) return;
              setEmbeddedResourceContextMenu(null);
              void commandService.executeCommand(item.command.id, context, { name, file })
                .then(ok => {
                  if (ok === false) triggerError('内嵌资源命令未执行完成，详见输出面板。');
                })
                .catch((error: unknown) => triggerError(error instanceof Error ? error.message : '内嵌资源命令执行失败。'));
            }}
          >
            {item.command.id.endsWith('copyEmbeddedResourceName') ? <Copy className="w-3.5 h-3.5 text-sky-400" />
              : item.command.id.endsWith('copyEmbeddedResourceSource') ? <Copy className="w-3.5 h-3.5 text-emerald-400" />
              : item.command.id.endsWith('openEmbeddedResourceSource') ? <FileText className="w-3.5 h-3.5 text-blue-400" />
              : <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />}
            <span className="truncate">{item.command.title}</span>
          </div>
        ) : null)}
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
        <div
          className="px-3 py-1.5 cursor-pointer transition-colors flex items-center gap-2 hover:bg-rose-500 hover:text-white"
          onClick={() => {
            const project = resourceContextMenu.project;
            const resource = resourceContextMenu.resource;
            void startResourceDelete(project.id, resource);
          }}
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span>删除图片资源</span>
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
            void commandService.executeCommand('lingbuilder.modules.openModuleInfo', {}, module);
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
          <span>定位到模块页当前模块 (O)</span>
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
        {module.manifest.id !== 'lingbuilder.win32.basic' && (
          <>
            <div className="h-[1px] bg-slate-700/20 dark:bg-slate-700/50 my-1" />
            <div
              className="px-3 py-1.5 cursor-pointer transition-colors flex items-center gap-2 hover:bg-rose-500 hover:text-white"
              onClick={() => {
                void disableProjectModuleFromTree(module);
                setModuleContextMenu(null);
              }}
            >
              <X className="w-3.5 h-3.5 text-rose-400" />
              <span>从项目中禁用</span>
            </div>
          </>
        )}
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

          {/* Designer Properties / Toolbox Tab Icon */}
          {showDesignerToolbox && (
            <button
              type="button"
              onClick={() => handleTabClick('properties')}
              aria-label="打开控件工具箱"
              aria-pressed={showLeftSidebar && activeTab === 'properties'}
              className={`w-10 h-10 rounded flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#007ACC] ${
                showLeftSidebar && activeTab === 'properties'
                  ? isDarkMode ? 'bg-[#37373D] text-[#007ACC]' : 'bg-[#CCCCCC] text-[#007ACC]'
                  : isDarkMode ? 'text-[#888888] hover:text-white hover:bg-[#2D2D2D]' : 'text-slate-600 hover:text-black hover:bg-slate-300'
              }`}
              title="控件工具箱"
            >
              <Wrench className="w-5 h-5" aria-hidden="true" />
              <span className="text-[10px] font-semibold leading-none font-sans">控件</span>
              {showLeftSidebar && activeTab === 'properties' && (
                <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-[#007ACC] rounded-r" />
              )}
            </button>
          )}

          {/* AI Assistant Tab */}
          {showDesignerAssistant && (
            <button
              type="button"
              onClick={() => handleTabClick('assistant')}
              aria-label="打开 AI 智能编程助手"
              aria-pressed={showLeftSidebar && activeTab === 'assistant'}
              className={`w-10 h-10 rounded flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#007ACC] ${
                showLeftSidebar && activeTab === 'assistant'
                  ? isDarkMode ? 'bg-[#37373D] text-[#007ACC]' : 'bg-[#CCCCCC] text-[#007ACC]'
                  : isDarkMode ? 'text-[#888888] hover:text-white hover:bg-[#2D2D2D]' : 'text-slate-600 hover:text-black hover:bg-slate-300'
              }`}
              title="AI 智能编程助手"
            >
              <Sparkles className="w-5 h-5" aria-hidden="true" />
              <span className="text-[10px] font-semibold leading-none font-sans">AI</span>
              {showLeftSidebar && activeTab === 'assistant' && (
                <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-[#007ACC] rounded-r" />
              )}
            </button>
          )}

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
      {(
        <div 
          style={{ width: `${drawerWidth}px` }} 
          className={`${showLeftSidebar ? 'flex' : 'hidden'} h-full flex-col overflow-hidden border-r ${
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
                            {!projectDeclarationFileExists(files, project.sourceRoot, '项目数据类型.lcpp') && (
                              <span className="ml-auto text-[9px] opacity-60">未创建</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void onOpenProjectDllCommands?.(project.id)}
                            className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[13px] font-sans transition-colors ${
                              isDarkMode ? 'text-slate-300 hover:bg-[#2A2D2E]/50' : 'text-slate-700 hover:bg-slate-100'
                            }`}
                            title="声明项目自带 DLL 的导出函数为中文命令；旧项目会在首次编辑时创建文件"
                          >
                            <span aria-hidden="true" className="h-4 w-4 shrink-0" />
                            <FileCode className="h-4 w-4 shrink-0 text-amber-500" />
                            <span className="truncate">DLL 命令</span>
                            {!projectDeclarationFileExists(files, project.sourceRoot, '项目DLL命令.lcpp') && (
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
                                      onClick={() => toggleModuleInterface(moduleId)}
                                      onContextMenu={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setContextMenu(null);
                                        setWindowContextMenu(null);
                                        setModuleContextMenu({ x: event.clientX, y: event.clientY, module });
                                      }}
                                      className={`group w-[calc(100%-4px)] flex items-center gap-1.5 px-1.5 py-1.5 ml-1 rounded text-[13px] font-sans text-left cursor-pointer transition-colors ${
                                        isDarkMode ? 'text-slate-300 hover:bg-[#2A2D2E]/40' : 'text-slate-700 hover:bg-slate-100'
                                      }`}
                                      title={`${module.manifest.name} ${module.manifest.version}\n${isModuleExpanded ? '点击折叠模块接口树' : '点击展开模块接口树'}；右键打开模块菜单。\n${module.manifest.description}`}
                                    >
                                      <button
                                        type="button"
                                        onClick={event => { event.stopPropagation(); toggleModuleInterface(moduleId); }}
                                        className={`shrink-0 rounded p-0.5 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`}
                                        title={isModuleExpanded ? '折叠模块接口' : '展开模块接口'}
                                      >
                                        {isModuleExpanded ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                                      </button>
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                      <button
                                        type="button"
                                        onClick={event => { event.stopPropagation(); toggleModuleInterface(moduleId); }}
                                        className="min-w-0 flex-1 truncate text-left cursor-pointer"
                                        title={isModuleExpanded ? '点击折叠模块接口树；右键打开模块菜单' : '点击展开模块接口树；右键打开模块菜单'}
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
                      {isProjectOpen && project.type === 'visual-cpp' && <div className="pl-6">
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
                                    setResourceContextMenu({ x: event.clientX, y: event.clientY, resource, project });
                                  }}
                                  className={`group w-full flex items-center gap-2 py-1.5 px-3 pl-7 text-[13px] cursor-pointer transition-colors font-sans ${
                                    resourcePreview?.projectId === project.id && resourcePreview.resource.relativePath === resource.relativePath
                                      ? isDarkMode ? 'bg-cyan-500/10 text-cyan-200' : 'bg-cyan-50 text-cyan-800'
                                      : isDarkMode ? 'text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                                  }`}
                                  title={`${resource.relativePath}\n单击预览，右键可复制相对路径或删除`}
                                >
                                  <ImageIcon className="w-4 h-4 shrink-0 text-cyan-400" />
                                  <span className="min-w-0 flex-1 truncate">{resource.fileName}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>}

                      {/* Project embedded resources group */}
                      {isProjectOpen && <div className="pl-6 mt-1.5">
                        <div
                          onClick={() => setIsEmbeddedResourcesOpen(!isEmbeddedResourcesOpen)}
                          className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer text-[13px] font-sans transition-colors ${
                            isDarkMode ? 'hover:bg-[#2A2D2E]/50 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                          title="构建期以 RCDATA 打进 EXE 的项目内嵌资源（跨窗口共享），运行期用 资源_* 命令按逻辑名读取"
                        >
                          {isEmbeddedResourcesOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <Package className="w-4 h-4 text-amber-500" />
                          <span className="truncate">内嵌资源</span>
                          <span className={`ml-auto text-[9px] px-1 rounded border ${
                            isDarkMode ? 'border-amber-500/20 text-amber-300 bg-amber-500/5' : 'border-amber-200 text-amber-700 bg-amber-50'
                          }`}>
                            {projectEmbeddedResources.length}
                          </span>
                        </div>
                        {isEmbeddedResourcesOpen && (
                          <div className="mt-0.5 border-l border-slate-750/30 dark:border-slate-800 ml-3.5 pl-0.5">
                            <button
                              onClick={() => void onConfigureEmbeddedResources?.(project.id)}
                              disabled={!designerStateMatchesActiveProject}
                              className={`w-[calc(100%-4px)] ml-1 mb-1 flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-sans text-left cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                isDarkMode
                                  ? 'text-amber-300 hover:text-amber-100 hover:bg-amber-500/10 border border-amber-500/20'
                                  : 'text-amber-700 hover:text-amber-900 hover:bg-amber-50 border border-amber-200'
                              }`}
                              title="打开窗口设计器的内嵌资源面板：添加文件/文件夹、改逻辑名、勾选启动释放"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              <span className="truncate">配置项目内嵌资源</span>
                            </button>
                            {projectEmbeddedResources.length === 0 ? (
                              <div className="pl-8 text-slate-500 text-[10px] py-1 font-sans">
                                {designerStateMatchesActiveProject
                                  ? (normalizedFileSearch ? '未找到匹配资源' : '暂无内嵌资源，点上方「配置项目内嵌资源」添加')
                                  : '正在载入当前项目资源…'}
                              </div>
                            ) : (
                              projectEmbeddedResources.map(resource => {
                                const sourceFile = files.find(candidate => candidate.path === resource.file);
                                return (
                                  <div
                                    key={resource.name}
                                    onClick={() => { if (sourceFile) onSelectFile(sourceFile); else void onConfigureEmbeddedResources?.(project.id); }}
                                    onContextMenu={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      setContextMenu(null);
                                      setWindowContextMenu(null);
                                      setModuleContextMenu(null);
                                      setSolutionContextMenu(null);
                                      setResourceContextMenu(null);
                                      setEmbeddedResourceContextMenu({ x: event.clientX, y: event.clientY, name: resource.name, file: resource.file });
                                    }}
                                    className={`group w-full flex items-center gap-2 py-1.5 px-3 pl-7 text-[13px] cursor-pointer transition-colors font-sans ${
                                      isDarkMode ? 'text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                                    }`}
                                    title={`逻辑名：${resource.name}\n源文件：${resource.file}${resource.extract === true ? '\n启动释放：程序启动时释放到 %TEMP%\\lingbuilder-embedded\\<工程 ID>\\' : ''}\n${sourceFile ? '单击打开源文件' : '源文件不是文本文件：单击打开内嵌资源配置对话框'}`}
                                  >
                                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${resource.extract === true ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                                    <span className="min-w-0 flex-1 truncate">{resource.name}</span>
                                    {resource.extract === true && (
                                      <span className={`shrink-0 rounded px-1 text-[9px] ${
                                        isDarkMode ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                                      }`}>启动释放</span>
                                    )}
                                  </div>
                                );
                              })
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

            </div>
          )}

          {/* ================= TAB 2: DESIGNER PROPERTIES / TOOLBOX ================= */}
          {activeTab === 'properties' && (
            <div className="flex h-full flex-col overflow-hidden font-sans">
              <div className={`flex shrink-0 items-center gap-2 border-b p-2.5 ${
                isDarkMode ? 'border-[#181818] bg-[#2D2D2D]/20' : 'border-slate-200 bg-slate-100/60'
              }`}>
                <Wrench className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">属性</span>
              </div>
              <div ref={onDesignerToolboxHostChange} className="min-h-0 flex-1 overflow-y-auto" />
            </div>
          )}

          {/* ================= TAB 3: AI ASSISTANT ================= */}
          {showDesignerAssistant && (
            <div className={`${activeTab === 'assistant' ? 'flex' : 'hidden'} h-full flex-col overflow-hidden font-sans`} aria-hidden={activeTab !== 'assistant'}>
              <div className={`flex shrink-0 items-center gap-2 border-b p-2.5 ${
                isDarkMode ? 'border-[#181818] bg-[#2D2D2D]/20' : 'border-slate-200 bg-slate-100/60'
              }`}>
                <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" aria-hidden="true" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">AI 智能编程助手</span>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {assistantContent || (
                  <div className="flex h-full items-center justify-center p-4 text-xs text-slate-500">AI 助手暂未挂载</div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 4: QUICK ACTIONS TOOLBOX ================= */}
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
                activeFilePath={activeFile?.path || activeFile?.name || ''}
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
      {renderEmbeddedResourceContextMenu()}
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
          onDelete={() => {
            const current = resourcePreview;
            if (current) void startResourceDelete(current.projectId, current.resource);
          }}
        />
      )}
      {resourceDeleteTarget && (
        <ResourceDeleteConfirmDialog
          target={resourceDeleteTarget}
          references={resourceDeleteReferences}
          truncated={resourceDeleteTruncated}
          busy={resourceDeleteBusy}
          isDarkMode={isDarkMode}
          onCancel={() => {
            setResourceDeleteTarget(null);
            setResourceDeleteReferences([]);
            setResourceDeleteTruncated(0);
          }}
          onConfirm={() => { void confirmResourceDelete(); }}
        />
      )}
    </div>
  );
}

function ImageResourcePreviewDialog({
  preview,
  isDarkMode,
  onClose,
  onCopyPath,
  onDelete
}: {
  preview: ResourcePreview;
  isDarkMode: boolean;
  onClose: () => void;
  onCopyPath: (relativePath: string) => void | Promise<void>;
  onDelete: () => void;
}) {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [previewSource, setPreviewSource] = useState('');
  const [loadError, setLoadError] = useState('');
  const { projectId, resource } = preview;

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setLoadState('loading');
    setDimensions(null);
    setPreviewSource('');
    setLoadError('');
    void fetchDesignerImagePreviewBlob(projectId, resource.relativePath, controller.signal)
      .then(blob => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewSource(objectUrl);
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : '图片资源读取失败。');
        setLoadState('error');
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, resource.relativePath]);

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
              <span>图片无法预览：{loadError || '浏览器无法解码图片数据。'}</span>
            </div>
          )}
          {previewSource && (
            <img
              src={previewSource}
              alt={resource.fileName}
              className={`max-h-[65vh] max-w-full object-contain ${loadState === 'error' ? 'hidden' : ''}`}
              onLoad={event => {
                setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
                setLoadState('ready');
              }}
              onError={() => {
                setLoadError('浏览器无法解码图片数据。');
                setLoadState('error');
              }}
            />
          )}
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
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2.5 py-1.5 font-medium text-rose-400 transition-colors hover:bg-rose-500/20"
            title="删除这张图片资源；仍被引用时会先列出引用位置"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>删除</span>
          </button>
        </footer>
      </section>
    </div>
  );
}

function ResourceDeleteConfirmDialog({
  target,
  references,
  truncated,
  busy,
  isDarkMode,
  onCancel,
  onConfirm
}: {
  target: { project: SolutionProject; resource: DesignerImageResource };
  references: DesignerImageReferenceInfo[];
  truncated: number;
  busy: boolean;
  isDarkMode: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 p-3 font-sans sm:p-6"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-label={`删除图片资源：${target.resource.fileName}`}
        className={`w-full max-w-lg overflow-hidden rounded-xl border shadow-2xl ${
          isDarkMode ? 'border-slate-700 bg-[#1E1E24] text-slate-100' : 'border-slate-200 bg-white text-slate-900'
        }`}
      >
        <header className={`flex items-center gap-3 border-b px-4 py-3 ${isDarkMode ? 'border-slate-700/80' : 'border-slate-200'}`}>
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">删除图片资源</h2>
            <p className={`truncate text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{target.resource.relativePath}</p>
          </div>
        </header>
        <div className="px-4 py-3 text-[13px]">
          {references.length > 0 ? (
            <>
              <p>
                该图片仍被 {references.length + truncated} 处引用，删除后这些位置将无法再显示它：
              </p>
              <ul className={`mt-2 max-h-44 overflow-auto rounded-md border p-2 text-[12px] ${isDarkMode ? 'border-slate-700 bg-black/20' : 'border-slate-200 bg-slate-50'}`}>
                {references.map((reference, index) => (
                  <li key={`${reference.location}-${index}`} className="flex items-start gap-1.5 py-0.5">
                    <span className={`mt-0.5 shrink-0 rounded px-1 text-[10px] font-medium ${
                      reference.source === 'designer'
                        ? 'bg-cyan-500/15 text-cyan-400'
                        : 'bg-violet-500/15 text-violet-400'
                    }`}>
                      {reference.source === 'designer' ? '设计器' : '源码'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{reference.location}</span>
                      {reference.detail && (
                        <span className={`block truncate text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{reference.detail}</span>
                      )}
                    </span>
                  </li>
                ))}
                {truncated > 0 && <li className="py-0.5 text-slate-400">…还有 {truncated} 处引用未逐条列出</li>}
              </ul>
            </>
          ) : (
            <p>未发现设计器窗口或项目源码仍在引用该图片。</p>
          )}
          <p className={`mt-2 text-[12px] ${isDarkMode ? 'text-rose-300' : 'text-rose-600'}`}>删除后不可恢复，确定要删除吗？</p>
        </div>
        <footer className={`flex items-center justify-end gap-2 border-t px-4 py-3 ${isDarkMode ? 'border-slate-700/80' : 'border-slate-200'}`}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
              isDarkMode ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? '正在删除…' : '删除'}
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
  activeHintId,
  onShowHint
}: {
  module: InstalledModule;
  isDarkMode: boolean;
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (groupId: string) => void;
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
        onClick={() => { void window.lingBuilder?.modules?.openInfo(module); }}
        className={`mb-0.5 flex w-[calc(100%-4px)] items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-[10px] ${
          isDarkMode ? 'text-violet-300 hover:bg-violet-500/10' : 'text-violet-700 hover:bg-violet-50'
        }`}
        title="在独立窗口查看完整接口说明"
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
    + (contributes.constants || []).length
    + (contributes.snippets || []).length
    + (contributes.designerControls || []).length
    + (contributes.docs || []).length
    + (contributes.examples || []).length
    + targets.reduce((sum, target) => sum
      + (target.headers || []).length
      + (target.sources || []).length
      + (target.libs || []).length
      + (target.runtimeFiles || []).length, 0)
    + (module.manifest.bindings?.commands || []).length;
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
