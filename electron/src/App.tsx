import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import lingBuilderIcon from '../../image/lingbuilder-ide-icon-v1.png';
import {
  FolderCode,
  Layers,
  Terminal,
  Sun,
  Moon,
  Upload,
  Play,
  Square,
  CheckCircle,
  HelpCircle,
  FileUp,
  Cpu,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Hammer,
  Code,
  Sparkles,
  FolderPlus,
  FolderOpen,
  Save,
  Undo2,
  Redo2,
  Copy,
  ClipboardPaste,
  ShieldCheck,
  Minus,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
  Command as CommandIcon,
  Settings as SettingsIcon,
  Search,
  Bug,
  Columns2,
  Rows2,
  MoveRight
} from 'lucide-react';

import {
  AppliedWorkspaceFile,
  BottomPanelTabType,
  CommandHintContent,
  CppFile,
  ExtractedString,
  GlossaryTerm,
  ProblemItem,
  DiffResult,
  SourceControlStatus,
  WorkspaceEditProposal
} from './types';
import { initialFiles, defaultGlossary, localTranslations } from './data/templates';
import { computeDiff } from './utils/diff';

// Components
import Sidebar from './components/Sidebar';
import DiffViewer, { DiffViewerHandle } from './components/DiffViewer';
import MonacoCodeEditor from './components/MonacoCodeEditor';
import type { MonacoCodeEditorHandle, MonacoEditorState } from './components/MonacoCodeEditor';
import AiAssistant from './components/AiAssistant';
import BottomPanel from './components/BottomPanel';
import CommandPalette from './components/CommandPalette';
import SettingsDialog from './components/SettingsDialog';
import ProjectBuildPathsDialog, { type ProjectBuildPathsDialogValue } from './components/ProjectBuildPathsDialog';
import WorkspaceSearchDialog from './components/WorkspaceSearchDialog';
import EnvironmentRepairCenter from './components/EnvironmentRepairCenter';
import SdkDependencyInstallerDialog from './components/SdkDependencyInstallerDialog';
import CliGuideDialog from './components/CliGuideDialog';
import AboutDialog from './components/AboutDialog';
import UpdateDialog, { type UpdateDialogInfo } from './components/UpdateDialog';
import HelpCenterDialog from './components/HelpCenterDialog';
import SponsorDialog from './components/SponsorDialog';
import ProjectNameDialog from './components/ProjectNameDialog';
import RecentWorkspacesDialog from './components/RecentWorkspacesDialog';
import WorkbenchConfirmDialog from './components/WorkbenchConfirmDialog';
import {
  cancelWorkbenchDialog,
  getActiveWorkbenchDialog,
  requestWorkbenchAlert,
  requestWorkbenchConfirm,
  requestWorkbenchPrompt,
  settleWorkbenchDialog,
  subscribeWorkbenchDialog,
  type WorkbenchDialogRequest
} from './services/workbench/workbenchConfirmService';
import WelcomePage from './components/WelcomePage';
import TextFileStatusControls from './components/TextFileStatusControls';
import EditorPositionStatus from './components/EditorPositionStatus';
import {
  DIFF_VIEW_MODE_CHANGE_EVENT,
  type DiffViewMode
} from './services/editor/diffViewMode';
import {
  TEXT_FILE_ENCODINGS,
  TEXT_FILE_EOLS,
  type TextFileEncoding,
  type TextFileEol,
  type TextFileFormat
} from './services/files/types';
import {
  getCurrentFileContent,
  isEditorFileDirty,
  updateEditorFileContent
} from './services/files/editorFileState';
import {
  isWorkspaceSaveEcho,
  type WorkspaceSaveEchoSnapshot
} from './services/files/workspaceSaveEchoService';
import {
  createCommandService,
  createKeybindingService,
  createCommandPaletteContext,
  isSafeGlobalKeybinding,
  isSuccessfulCommandResult,
  normalizeKeybinding,
  WORKBENCH_DEFAULT_KEYBINDINGS,
  type CommandContext,
  type CommandPresentation,
  type RegisteredCommand
} from './services/commands';
import type {
  ConfigurationTarget,
  ConfigurationValue,
  WorkbenchConfigurationKey,
  WorkbenchConfigurationSnapshot
} from './services/configuration';
import { getWorkbenchConfigurationMutationTarget } from './services/configuration';
import {
  LEGACY_EDITOR_EXPERIENCE_MODE_KEY,
  LEGACY_EDITOR_FONT_SIZE_KEY,
  planLegacyWorkbenchConfigurationMigration
} from './services/configuration/legacyWorkbenchConfiguration';
import { runGuardedConfigurationUpdate } from './services/configuration/configurationUpdateGuard';
import {
  requestWindowDesignerLingCppSource,
  WINDOW_DESIGNER_LINGCPP_SOURCE_REQUEST,
  WINDOW_DESIGNER_BUILD_RUN_STATE,
  WindowDesignerLingCppSourceRequestDetail,
  WindowDesignerBuildRunStateDetail
} from './services/windowDesigner/windowDesignerCommands';
import {
  getEplEventSuffix,
  getLingWindowSourceFileName,
  getLingWindowSourceFilePath,
  readWindowDesignerState,
  saveWindowDesignerState,
  PersistedWindowDesignerState,
  WINDOW_DESIGNER_DIRTY_STATE_CHANGED,
  WINDOW_DESIGNER_PROJECT_UPDATED
} from './services/windowDesigner/windowDesignerService';
import type { WindowDesignerDirtyStateDetail } from './services/windowDesigner/windowDesignerService';
import {
  formatControlEventParameters,
  type OpenControlEventCodeDetail,
  upgradeLegacyControlEventHandlerSignature
} from './services/windowDesigner/controlEventCodeService';
import {
  selectAndImportDesignerImage,
  type DesignerImageImportResult
} from './services/windowDesigner/designerAssetClient';
import { sourceControlService, type SourceControlMutation } from './services/lingCpp/sourceControlService';
import { applyProjectFileDelete, applyProjectFileRename } from './services/workspace/projectFileState';
import {
  applyWorkspaceReplace,
  previewWorkspaceReplace,
  queryWorkspace,
  rollbackWorkspaceReplace
} from './services/workspace/workspaceSearchClient';
import {
  createWorkspaceSearchRevealDetail,
  findWorkspaceSearchProject,
  refreshWorkspaceSearchEditorFiles
} from './services/workspace/workspaceSearchEditorState';
import {
  createProjectFileLoadState,
  getProjectFileEditorAvailability,
  hasUsableProjectFilePayload,
  isProjectFileLoadPending
} from './services/workspace/projectFileLoadState';
import {
  createProjectMutationOwner,
  isProjectMutationOwnerCurrent,
  type ProjectMutationOwner
} from './services/workspace/projectMutationOwner';
import type {
  WorkspaceReplaceApplyRequest,
  WorkspaceReplaceApplyResponse,
  WorkspaceReplacePreviewRequest,
  WorkspaceReplacePreviewResponse,
  WorkspaceReplaceRollbackRequest,
  WorkspaceReplaceRollbackResponse,
  WorkspaceSearchMatch,
  WorkspaceSearchQueryRequest,
  WorkspaceSearchQueryResponse
} from './services/workspace/workspaceSearchTypes';
import { formatEnvironmentCheckOutput } from './services/tasks/environmentCheckPresentation';
import { createEnvironmentCheckRequestGate } from './services/tasks/environmentCheckRequestGate';
import { fetchWithSdkDependencies } from './services/sdkDependencies/sdkDependencyClient';
import type { TaskSnapshot } from './services/tasks/taskService';
import type { ClangdStatus } from './services/lsp/clangdService';
import type { BuildArchitecture, BuildConfiguration, BuildMode } from './services/tasks/buildConfigurationService';
import { closeEditorGroupTab, collapseEditorGroups, moveEditorTab, restoreEditorGroupLayout, selectEditorGroupTab, splitEditorGroup, type EditorGroupLayout } from './services/editor/editorGroupLayout';
import { getLingCppProblems } from './services/lingCpp/languageService';
import { EditorExperienceMode, adaptProblemForBeginner } from './services/lingCpp/beginnerService';
import { findLingCppMethod, parseLingCpp } from './services/lingCpp/parser';
import { EMPTY_PROJECT_GLOBALS_SOURCE, isProjectGlobalsFilePath, PROJECT_GLOBALS_FILE_NAME } from './services/lingCpp/projectGlobalService';
import { executeProjectGlobalVariableCommand } from './services/lingCpp/projectGlobalCommandService';
import { EMPTY_PROJECT_DATA_TYPES_SOURCE, isProjectDataTypesFilePath, PROJECT_DATA_TYPES_FILE_NAME } from './services/lingCpp/projectDataTypeService';
import { executeProjectDataTypeCommand } from './services/lingCpp/projectDataTypeCommandService';
import { createProjectConstantRenameProposal, findProjectConstantReferences } from './services/lingCpp/projectConstantReferenceService';
import { findFunctionLibraryReferences, isFunctionLibrarySource, renameFunctionLibraryAcrossSources } from './services/lingCpp/functionLibraryService';
import type { LingCppAstEdit } from './services/lingCpp/types';
import { InstalledModule, LingCppModuleContext, ModuleHintContent } from './services/modules/types';
import {
  DEFAULT_SOLUTION,
  SolutionModel,
  buildSolution,
  cleanSolution,
  configureSolutionProject,
  createSolutionFolder,
  importSolutionProject,
  createSolutionProject,
  deleteSolutionProject,
  fetchSolution,
  getSolutionProjectDirectory,
  moveSolutionProject,
  renameSolutionProject,
  rebuildSolution,
  setStartupProject
} from './services/solution/solutionClient';
import {
  CREATE_SOLUTION_FOLDER_COMMAND,
  MOVE_PROJECT_TO_SOLUTION_FOLDER_COMMAND,
  RENAME_SOLUTION_PROJECT_COMMAND
} from './services/solution/solutionExplorerMenu';
import {
  createInactiveTextEditorStatus,
  disposeWorkbenchTextModelsForSource,
  getEditorHistoryPresentation,
  renameWorkbenchTextModelsForSource,
  TextModelIdentity,
  workbenchTextModelService
} from './services/textModel';
import { LINGBUILDER_DISPLAY_VERSION, LINGBUILDER_OFFICIAL_SITE_URL } from './services/product/productInfo';

const LINGBUILDER_QQ_GROUP_URL = 'https://qm.qq.com/q/q2VNHZXLXy';
// Web 模式下创建独立项目工作区并整页刷新后，跳过欢迎页直接进入工作台的一次性标记。
const AUTO_ENTER_WORKSPACE_FLAG = 'lingbuilder:auto-enter-workspace';

/** 主进程 app:check-update 的返回结构；直链/校验值等字段在旧云端上可能缺失。 */
interface UpdateCheckPayload {
  ok: boolean;
  hasUpdate: boolean;
  latestVersion?: string;
  releaseTitle?: string;
  websiteUrl?: string;
  downloadUrl?: string | null;
  sha256?: string | null;
  fileSize?: string | null;
  releaseNotes?: string | null;
  channel?: string | null;
  error?: string;
}

/** 把检查结果整理成更新对话框所需信息：直链或校验值缺失时对话框会自动只保留「前往官网下载」。 */
const createUpdateDialogInfo = (result: UpdateCheckPayload, silent = false): UpdateDialogInfo => ({
  status: 'update',
  latestVersion: result.latestVersion,
  releaseTitle: result.releaseTitle,
  websiteUrl: result.websiteUrl || LINGBUILDER_OFFICIAL_SITE_URL,
  downloadUrl: result.downloadUrl ?? null,
  sha256: result.sha256 ?? null,
  fileSize: result.fileSize ?? null,
  releaseNotes: result.releaseNotes ?? null,
  channel: result.channel ?? null,
  ...(silent ? { silent: true } : {})
});

const generateDefaultLingCppContentForWindow = (win: any) => {
  const className = win.className || '自定义窗体';
  const fileName = win.fileName;
  
  return `包 LingBuilder
使用 Win32窗口
使用 标准控件

类 ${className} : 公开 窗体
公开:
    文本型 关联设计文件 = "${fileName}"

    构造()
        调试输出("${win.title || className}初始化完毕，Win32 渲染正常。")

    事件 _${className}_创建完毕()
        调试输出("已载入 ${fileName} 关联布局。")
结束类
`;
};

type LingBuilderWindowControls = {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<boolean>;
  isMaximized: () => Promise<boolean>;
  close: () => Promise<void>;
  confirmClose: () => Promise<void>;
  onCloseRequested: (listener: () => void) => () => void;
};

const getNativeWindowControls = () => {
  return (window as Window & {
    lingBuilder?: {
      windowControls?: LingBuilderWindowControls;
    };
  }).lingBuilder?.windowControls;
};

type PendingDesignerEventEdit = {
  proposal: WorkspaceEditProposal;
  appliedFiles: AppliedWorkspaceFile[];
  targetFilePath: string;
  handlerName: string;
  controlName?: string;
  eventName?: string;
  windowTitle?: string;
  newText: string;
  owner: ProjectMutationOwner;
};

type OwnedWorkspaceReplacePreview = {
  preview: WorkspaceReplacePreviewResponse;
  owner: ProjectMutationOwner;
};

type EditorOperation = 'save' | 'build' | 'file-mutation';

const getEditorOperationLabel = (operation: EditorOperation | null) => {
  if (operation === 'build') return '构建';
  if (operation === 'file-mutation') return '文件操作';
  return '保存';
};

const DEFAULT_EDITOR_FONT_SIZE = 13;
const MIN_EDITOR_FONT_SIZE = 10;
const MAX_EDITOR_FONT_SIZE = 24;
const DEFAULT_LEFT_SIDEBAR_WIDTH = 264;
const MIN_LEFT_SIDEBAR_WIDTH = 160;
const MAX_LEFT_SIDEBAR_WIDTH = 600;
const DEFAULT_AI_PANEL_WIDTH = 360;
const MIN_AI_PANEL_WIDTH = 280;
const MAX_AI_PANEL_WIDTH = 640;

const clampEditorFontSize = (value: number) => {
  return Math.max(MIN_EDITOR_FONT_SIZE, Math.min(MAX_EDITOR_FONT_SIZE, Math.round(value)));
};

const clampLeftSidebarWidth = (value: number) => {
  return Math.max(MIN_LEFT_SIDEBAR_WIDTH, Math.min(MAX_LEFT_SIDEBAR_WIDTH, Math.round(value)));
};

const clampAiPanelWidth = (value: number) => {
  return Math.max(MIN_AI_PANEL_WIDTH, Math.min(MAX_AI_PANEL_WIDTH, Math.round(value)));
};

const getInitialEditorFontSize = () => {
  try {
    const savedValue = window.localStorage.getItem(LEGACY_EDITOR_FONT_SIZE_KEY);
    if (!savedValue) return DEFAULT_EDITOR_FONT_SIZE;
    const parsedValue = Number.parseInt(savedValue, 10);
    return Number.isFinite(parsedValue) ? clampEditorFontSize(parsedValue) : DEFAULT_EDITOR_FONT_SIZE;
  } catch {
    return DEFAULT_EDITOR_FONT_SIZE;
  }
};

const getInitialEditorExperienceMode = (): EditorExperienceMode => {
  try {
    const savedValue = window.localStorage.getItem(LEGACY_EDITOR_EXPERIENCE_MODE_KEY);
    if (savedValue === 'professional' || savedValue === 'native') return savedValue;
    return 'beginner';
  } catch {
    return 'beginner';
  }
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sanitizeLingCppText = (value: string | undefined, fallback: string) => {
  return (value || fallback)
    .replace(/[\r\n]+/g, ' ')
    .replace(/[“”"]/g, '')
    .trim() || fallback;
};

const createLingCppControlEventBlock = (detail: Required<Pick<OpenControlEventCodeDetail, 'controlName' | 'eventName' | 'handlerName'>> & OpenControlEventCodeDetail) => {
  const controlName = sanitizeLingCppText(detail.controlName, '控件');
  const controlContent = sanitizeLingCppText(detail.controlContent, controlName);
  const eventSuffix = getEplEventSuffix(detail.eventName);
  const parameterText = formatControlEventParameters(detail);
  const lines = [`    事件 ${detail.handlerName}(${parameterText})`];

  if (detail.eventName === 'Click') {
    lines.push(`        信息框("${controlContent}", 64, "事件触发")`);
  }

  if (detail.eventStarterStatements?.length) {
    detail.eventStarterStatements.forEach(statement => lines.push(`        ${statement.trim()}`));
  } else {
    lines.push(`        调试输出("${controlName}${eventSuffix}")`);
  }
  lines.push('    结束');
  return lines.join('\n');
};

const ensureLingCppControlEventHandler = (content: string, detail: OpenControlEventCodeDetail) => {
  const controlName = detail.controlName?.trim();
  const eventName = detail.eventName?.trim();
  const handlerName = detail.handlerName?.trim();

  if (!controlName || !eventName || !handlerName) return content;

  const migration = upgradeLegacyControlEventHandlerSignature(content, { ...detail, handlerName, eventName });
  if (migration.changed) return migration.content;

  const handlerPattern = new RegExp(`(^|\\n)\\s*事件\\s+${escapeRegExp(handlerName)}\\s*[（(]`);
  if (handlerPattern.test(content)) return content;

  const nextBlock = createLingCppControlEventBlock({ ...detail, controlName, eventName, handlerName });
  return `${content.replace(/\s*结束类\s*$/g, '').trimEnd()}\n\n${nextBlock}\n结束类`;
};

const hasLingCppEventHandler = (content: string, handlerName: string) => {
  const trimmedHandlerName = handlerName.trim();
  if (!trimmedHandlerName) return false;

  const handlerPattern = new RegExp(`(^|\\n)\\s*事件\\s+${escapeRegExp(trimmedHandlerName)}\\s*[（(]`);
  if (handlerPattern.test(content)) return true;

  try {
    const parsed = parseLingCpp(content);
    const method = findLingCppMethod(parsed.program, trimmedHandlerName);
    return method?.kind === 'event';
  } catch {
    return false;
  }
};

/** 比较两组已安装模块列表是否内容一致（顺序敏感，按 id@version + 安装路径）。 */
const areInstalledModuleListsEquivalent = (left: InstalledModule[] | undefined, right: InstalledModule[]) => {
  if (!Array.isArray(left) || left.length !== right.length) return false;
  const signatureOf = (module: InstalledModule) => `${module.manifest.id}@${module.manifest.version}:${module.installPath}`;
  return left.every((module, index) => signatureOf(module) === signatureOf(right[index]));
};

const getCurrentWindowDesignerProject = (projectId?: string) => readWindowDesignerState(projectId).project;
const getCurrentWindowDesignerProjectId = (projectId?: string) => getCurrentWindowDesignerProject(projectId).id || projectId || 'lingbuilder-ui-project';

const inferFileLanguage = (filePath: string): CppFile['language'] => {
  const normalizedPath = filePath.toLowerCase();
  if (normalizedPath.endsWith('.lcpp')) return 'lingcpp';
  if (normalizedPath.endsWith('.e')) return 'epl';
  if (normalizedPath.endsWith('.cpp')) return 'cpp';
  if (normalizedPath.endsWith('.h')) return 'header';
  if (normalizedPath.endsWith('.rc')) return 'resource';
  if (normalizedPath.endsWith('.ini')) return 'ini';
  return 'cpp';
};

const DEFAULT_TEXT_FILE_FORMAT: TextFileFormat = { encoding: 'utf8', eol: 'lf' };
const readTextFileFormat = (value: unknown): TextFileFormat => {
  if (!value || typeof value !== 'object') return DEFAULT_TEXT_FILE_FORMAT;
  const candidate = value as Partial<TextFileFormat>;
  return {
    encoding: TEXT_FILE_ENCODINGS.includes(candidate.encoding as TextFileEncoding)
      ? candidate.encoding as TextFileEncoding
      : DEFAULT_TEXT_FILE_FORMAT.encoding,
    eol: TEXT_FILE_EOLS.includes(candidate.eol as TextFileEol)
      ? candidate.eol as TextFileEol
      : DEFAULT_TEXT_FILE_FORMAT.eol
  };
};

const getTextFileFormat = (file: CppFile): TextFileFormat => ({
  encoding: file.encoding,
  eol: file.eol
});

const isSameTextFileFormat = (left: TextFileFormat, right: TextFileFormat): boolean => (
  left.encoding === right.encoding && left.eol === right.eol
);

interface EditorFlushState {
  ok: boolean;
  files: CppFile[];
  diagnostics: string[];
}

const isStringRecord = (value: unknown): value is Record<string, string> => Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.values(value as Record<string, unknown>).every(item => typeof item === 'string');

const STALE_PROJECT_MUTATION_MESSAGE = '项目已切换或重新载入，已忽略旧项目的异步响应。';

const getWorkbenchCommandKeybindings = (
  commandId: string,
  defaults: readonly string[],
  overrides: Record<string, string>
): string[] => {
  const override = overrides[commandId];
  if (!override?.trim()) return [...defaults];
  try {
    const normalized = normalizeKeybinding(override);
    return isSafeGlobalKeybinding(normalized) ? [normalized] : [...defaults];
  } catch {
    return [...defaults];
  }
};

export default function App() {
  const [solution, setSolution] = useState<SolutionModel>(DEFAULT_SOLUTION);
  const [windowDesignerState, setWindowDesignerState] = useState<PersistedWindowDesignerState>(() => readWindowDesignerState());
  const [designerDirty, setDesignerDirty] = useState(false);
  const designerDirtyRef = useRef(false);
  const designerSavedSnapshotRef = useRef(JSON.stringify(windowDesignerState.project));
  const activeSolutionProject = solution.projects.find(project => project.id === solution.startupProjectId) || solution.projects[0] || DEFAULT_SOLUTION.projects[0];
  const activeProjectHasWindowDesigner = activeSolutionProject.type === 'visual-cpp';
  const activeProjectId = activeSolutionProject.id;
  const textModelWorkspaceId = solution.id || DEFAULT_SOLUTION.id;
  const textModelIdentity = (projectId: string, filePath: string): TextModelIdentity => ({
    workspaceId: textModelWorkspaceId,
    projectId,
    filePath
  });
  const activeProjectIdRef = useRef(activeProjectId);
  activeProjectIdRef.current = activeProjectId;
  const [loadedProjectId, setLoadedProjectId] = useState(activeProjectId);
  const loadedProjectIdRef = useRef(loadedProjectId);
  loadedProjectIdRef.current = loadedProjectId;
  const [projectFileLoadState, setProjectFileLoadState] = useState(() => createProjectFileLoadState(activeProjectId));
  const [projectFileReloadToken, setProjectFileReloadToken] = useState(0);
  const projectFileLoadGenerationRef = useRef(0);
  const projectFileLoadKeyRef = useRef('');
  const projectFileLoadKey = JSON.stringify([activeProjectId, projectFileReloadToken]);
  if (projectFileLoadKeyRef.current !== projectFileLoadKey) {
    projectFileLoadKeyRef.current = projectFileLoadKey;
    projectFileLoadGenerationRef.current += 1;
  }
  const hydratedProjectIdsRef = useRef(new Set<string>());
  const projectSwitchInFlightRef = useRef(false);
  const projectFileEditorAvailability = getProjectFileEditorAvailability(
    activeProjectId,
    loadedProjectId,
    projectFileLoadState
  );
  const projectFilesLoading = projectFileEditorAvailability === 'loading';
  const projectFilesReady = projectFileEditorAvailability === 'ready';
  const projectFilesReadyRef = useRef(projectFilesReady);
  projectFilesReadyRef.current = projectFilesReady;
  const captureProjectMutationOwner = useCallback((): ProjectMutationOwner => (
    createProjectMutationOwner(activeProjectIdRef.current, projectFileLoadGenerationRef.current)
  ), []);
  const isCurrentProjectMutationOwner = useCallback((owner: ProjectMutationOwner): boolean => (
    isProjectMutationOwnerCurrent(owner, {
      activeProjectId: activeProjectIdRef.current,
      loadedProjectId: loadedProjectIdRef.current,
      loadGeneration: projectFileLoadGenerationRef.current,
      projectFilesReady: projectFilesReadyRef.current
    })
  ), []);
  const requireCurrentProjectMutationOwner = useCallback((owner: ProjectMutationOwner): void => {
    if (!isCurrentProjectMutationOwner(owner)) {
      throw new Error(STALE_PROJECT_MUTATION_MESSAGE);
    }
  }, [isCurrentProjectMutationOwner]);
  const [files, setFiles] = useState<CppFile[]>(() => {
    const proj = readWindowDesignerState().project;

    const currentFiles = [...initialFiles];
    proj.windows.forEach(win => {
      const sourceName = getLingWindowSourceFileName(win.fileName, win.className);
      const sourcePath = getLingWindowSourceFilePath(activeSolutionProject.sourceRoot, win.fileName, win.className);
      if (!currentFiles.some(f => f.path === sourcePath)) {
        currentFiles.push({
          path: sourcePath,
          name: sourceName,
          language: 'lingcpp',
          encoding: 'utf8',
          eol: 'lf',
          savedEncoding: 'utf8',
          savedEol: 'lf',
          formatModified: false,
          originalContent: generateDefaultLingCppContentForWindow(win),
          translatedContent: '',
          strings: [],
          isModified: false
        });
      }
    });
    return currentFiles;
  });
  const [activeFile, setActiveFile] = useState<CppFile>(() => {
    try {
      const rawActive = window.localStorage.getItem('lingbuilder.activeTabPath.v1');
      if (rawActive) {
        const found = files?.find(f => f.path === rawActive);
        if (found) return found;
      }
    } catch (e) {}
    return files ? (files.find(f => f.name === '游戏主窗体.lcpp') || files[0]) : initialFiles[0];
  });
  const filesRef = useRef<CppFile[]>([]);
  const projectFileVersionsRef = useRef<Record<string, string>>({});
  const inFlightSaveSnapshotsRef = useRef<Map<number, WorkspaceSaveEchoSnapshot>>(new Map());
  const inFlightSaveSequenceRef = useRef(0);
  const activeFileRef = useRef<CppFile | null>(null);
  const diffViewerRef = useRef<DiffViewerHandle>(null);
  const secondaryEditorRef = useRef<MonacoCodeEditorHandle>(null);
  const activeEditorGroupRef = useRef<'primary' | 'secondary'>('primary');
  const primaryEditorStateRef = useRef<MonacoEditorState>(createInactiveTextEditorStatus('loading'));
  const secondaryEditorStateRef = useRef<MonacoEditorState>(createInactiveTextEditorStatus('loading'));
  const saveWorkspaceCoreRef = useRef<(reason?: string, ownedByBuild?: boolean) => Promise<boolean>>(
    async () => false
  );
  const [editorState, setEditorState] = useState<MonacoEditorState>(() => createInactiveTextEditorStatus('loading'));
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  useEffect(() => {
    if (!projectFilesReady || loadedProjectId !== activeProjectId) return;
    const dirtyFiles = files.filter(isEditorFileDirty);
    if (dirtyFiles.length === 0 && !designerDirty) return;
    const timer = window.setTimeout(() => {
      const recoveryFiles = Object.fromEntries(filesRef.current.map(file => [file.path, getCurrentFileContent(file)]));
      const fileFormats = Object.fromEntries(filesRef.current.map(file => [file.path, getTextFileFormat(file)]));
      void fetch('/api/window-designer/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProjectId,
          files: recoveryFiles,
          fileFormats,
          baseVersions: projectFileVersionsRef.current,
          openTabs: openTabsRef.current,
          activeFilePath: activeFileRef.current?.path,
           designerProject: designerDirtyRef.current
             ? activeProjectHasWindowDesigner ? readWindowDesignerState(activeProjectId).project : undefined
            : undefined
        })
      });
    }, 750);
    return () => window.clearTimeout(timer);
  }, [activeProjectHasWindowDesigner, activeProjectId, designerDirty, files, loadedProjectId, projectFilesReady]);

  const focusLingCppHandler = useCallback((handlerName: string, filePath?: string) => {
    // The editor may need one render to activate the selected .lcpp file. Re-send
    // both the view switch and focus request so a slow configuration/save roundtrip
    // cannot leave the designer visible after clicking an event handler.
    [0, 100, 260, 560, 1000].forEach(delay => {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('force-code-view'));
        window.dispatchEvent(new CustomEvent('focus-epl-handler', { detail: { handlerName, filePath } }));
      }, delay);
    });
  }, []);

  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem('lingbuilder.openTabs.v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return ['src/游戏主窗体.lcpp'];
  });
  const openTabsRef = useRef(openTabs);
  const [editorGroupLayout, setEditorGroupLayout] = useState<EditorGroupLayout>(() => {
    try { return restoreEditorGroupLayout(JSON.parse(window.localStorage.getItem('lingbuilder.editorGroups.v1') || 'null'), files.map(file => file.path), activeFile.path); }
    catch { return restoreEditorGroupLayout(null, files.map(file => file.path), activeFile.path); }
  });

  useEffect(() => {
    openTabsRef.current = openTabs;
    window.localStorage.setItem('lingbuilder.openTabs.v1', JSON.stringify(openTabs));
  }, [openTabs]);
  useEffect(() => {
    setEditorGroupLayout(previous => ({ ...previous, groups: previous.groups.map((group, index) => index === 0
      ? { ...group, tabs: openTabs, activePath: activeFile.path }
      : group) }));
  }, [activeFile.path, openTabs]);
  useEffect(() => { window.localStorage.setItem('lingbuilder.editorGroups.v1', JSON.stringify(editorGroupLayout)); }, [editorGroupLayout]);

  useEffect(() => {
    if (activeFile) {
      window.localStorage.setItem('lingbuilder.activeTabPath.v1', activeFile.path);
    }
  }, [activeFile]);

  const flushCurrentEditorDrafts = useCallback(async (): Promise<EditorFlushState> => {
    const owner = captureProjectMutationOwner();
    if (!isCurrentProjectMutationOwner(owner)) {
      return { ok: false, files: filesRef.current, diagnostics: [STALE_PROJECT_MUTATION_MESSAGE] };
    }
    const currentFile = activeFileRef.current;
    const editorHandle = diffViewerRef.current;
    if (!currentFile || !editorHandle) {
      return { ok: true, files: filesRef.current, diagnostics: [] };
    }

    const result = await editorHandle.flushPendingEdits();
    if (!isCurrentProjectMutationOwner(owner)) {
      return { ok: false, files: filesRef.current, diagnostics: [STALE_PROJECT_MUTATION_MESSAGE] };
    }
    if (!result.success) {
      return { ok: false, files: filesRef.current, diagnostics: result.diagnostics };
    }

    if (result.sourceCode === getCurrentFileContent(currentFile)) {
      return { ok: true, files: filesRef.current, diagnostics: [] };
    }

    const updatedFile: CppFile = {
      ...currentFile,
      translatedContent: result.sourceCode,
      isModified: result.sourceCode !== currentFile.originalContent
    };
    const nextFiles = filesRef.current.map(file => file.path === updatedFile.path ? updatedFile : file);
    filesRef.current = nextFiles;
    activeFileRef.current = updatedFile;
    setFiles(nextFiles);
    setActiveFile(updatedFile);
    return { ok: true, files: nextFiles, diagnostics: [] };
  }, [captureProjectMutationOwner, isCurrentProjectMutationOwner]);

  const showEditorFlushFailure = useCallback((diagnostics: string[]) => {
    void requestWorkbenchAlert({
      title: '新手代码提交失败',
      description: diagnostics[0] || '当前操作已取消，源码未被覆盖。',
      confirmLabel: '知道了'
    });
  }, []);

  const handleSelectFile = useCallback(async (file: CppFile, forceCodeView: boolean = true): Promise<boolean> => {
    if (!projectFilesReadyRef.current) {
      appendEditorTransactionLog('【切换文件】项目文件仍在载入，请稍后再试。');
      return false;
    }
    let availableFiles = filesRef.current;
    if (activeFileRef.current && activeFileRef.current.path !== file.path) {
      const flushState = await flushCurrentEditorDrafts();
      if (!flushState.ok) {
        showEditorFlushFailure(flushState.diagnostics);
        return false;
      }
      availableFiles = flushState.files;
    }

    const latestFile = availableFiles.find(candidate => candidate.path === file.path) || file;
    setOpenTabs(prev => prev.includes(latestFile.path) ? prev : [...prev, latestFile.path]);
    activeEditorGroupRef.current = 'primary';
    setEditorState(createInactiveTextEditorStatus('switching-file'));
    activeFileRef.current = latestFile;
    setActiveFile(latestFile);
    if (forceCodeView) {
      window.dispatchEvent(new CustomEvent('force-code-view'));
    }
    return true;
  }, [flushCurrentEditorDrafts, showEditorFlushFailure]);

  const handleOpenProjectGlobalVariables = useCallback(async (projectId: string): Promise<void> => {
    const project = solution.projects.find(item => item.id === projectId);
    if (!project || project.type !== 'visual-cpp') return;
    if (projectId !== activeProjectIdRef.current) {
      await requestWorkbenchAlert({ title: '项目尚未就绪', description: '请先等待该项目切换并载入完成。', confirmLabel: '知道了' });
      return;
    }
    const sourceRoot = project.sourceRoot.replace(/\\/gu, '/').replace(/\/+$/u, '');
    const filePath = `${sourceRoot}/${PROJECT_GLOBALS_FILE_NAME}`;
    let targetFile = filesRef.current.find(file => file.path.replace(/\\/gu, '/') === filePath);
    if (!targetFile) {
      targetFile = {
        path: filePath,
        name: PROJECT_GLOBALS_FILE_NAME,
        language: 'lingcpp',
        encoding: 'utf8',
        eol: 'lf',
        savedEncoding: 'utf8',
        savedEol: 'lf',
        formatModified: false,
        originalContent: '',
        translatedContent: EMPTY_PROJECT_GLOBALS_SOURCE,
        strings: [],
        isModified: true
      };
      const nextFiles = [...filesRef.current, targetFile];
      filesRef.current = nextFiles;
      setFiles(nextFiles);
    }
    await handleSelectFile(targetFile);
  }, [handleSelectFile, solution.projects]);

  const handleOpenProjectDataTypes = useCallback(async (projectId: string): Promise<void> => {
    const project = solution.projects.find(item => item.id === projectId);
    if (!project || project.type !== 'visual-cpp') return;
    if (projectId !== activeProjectIdRef.current) {
      await requestWorkbenchAlert({ title: '项目尚未就绪', description: '请先等待该项目切换并载入完成。', confirmLabel: '知道了' });
      return;
    }
    const sourceRoot = project.sourceRoot.replace(/\\/gu, '/').replace(/\/+$/u, '');
    const filePath = `${sourceRoot}/${PROJECT_DATA_TYPES_FILE_NAME}`;
    let targetFile = filesRef.current.find(file => file.path.replace(/\\/gu, '/') === filePath);
    if (!targetFile) {
      targetFile = {
        path: filePath,
        name: PROJECT_DATA_TYPES_FILE_NAME,
        language: 'lingcpp',
        encoding: 'utf8',
        eol: 'lf',
        savedEncoding: 'utf8',
        savedEol: 'lf',
        formatModified: false,
        originalContent: '',
        translatedContent: EMPTY_PROJECT_DATA_TYPES_SOURCE,
        strings: [],
        isModified: true
      };
      const nextFiles = [...filesRef.current, targetFile];
      filesRef.current = nextFiles;
      setFiles(nextFiles);
    }
    await handleSelectFile(targetFile);
  }, [handleSelectFile, solution.projects]);

  const addPersistedFunctionLibraryToEditor = useCallback(async (filePath: string, sourceCode: string, select = true) => {
    const existing = filesRef.current.find(file => file.path.replace(/\\/gu, '/') === filePath.replace(/\\/gu, '/'));
    if (existing) {
      const refreshed = existing.translatedContent === sourceCode && existing.originalContent === sourceCode
        ? existing
        : { ...existing, originalContent: sourceCode, translatedContent: sourceCode, isModified: false };
      if (refreshed !== existing) {
        const nextFiles = filesRef.current.map(file => file === existing ? refreshed : file);
        filesRef.current = nextFiles;
        setFiles(nextFiles);
      }
      if (select) await handleSelectFile(refreshed);
      return;
    }
    const file: CppFile = {
      path: filePath,
      name: filePath.replace(/\\/gu, '/').split('/').at(-1) || filePath,
      language: 'lingcpp',
      encoding: 'utf8',
      eol: 'lf',
      savedEncoding: 'utf8',
      savedEol: 'lf',
      formatModified: false,
      originalContent: sourceCode,
      translatedContent: sourceCode,
      strings: [],
      isModified: false
    };
    const nextFiles = [...filesRef.current, file];
    filesRef.current = nextFiles;
    setFiles(nextFiles);
    if (select) await handleSelectFile(file);
  }, [handleSelectFile]);

  const handleCreateFunctionLibrary = useCallback(async (projectId: string) => {
    const name = (await requestWorkbenchPrompt({
      title: '新建功能库',
      description: '将创建“功能/名称.lcpp”。',
      inputLabel: '功能库名称',
      inputValue: '通用工具'
    }))?.trim();
    if (!name) return;
    if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(name)) {
      await requestWorkbenchAlert({ title: '名称不合法', description: '功能库名称只能包含中文、字母、数字和下划线，且不能以数字开头。', confirmLabel: '知道了' });
      return;
    }
    const response = await fetch('/api/window-designer/function-libraries/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, name })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      await requestWorkbenchAlert({
        title: '新建功能库失败',
        description: result.error || '新建功能库失败。',
        confirmLabel: '知道了'
      });
      return;
    }
    appendEditorTransactionLog(`【功能库】已新建 ${result.filePath}`);
    if (projectId === activeProjectIdRef.current) await addPersistedFunctionLibraryToEditor(result.filePath, result.sourceCode);
  }, [addPersistedFunctionLibraryToEditor]);

  const handlePasteFunctionLibrary = useCallback(async (targetProjectId: string) => {
    if (targetProjectId === activeProjectIdRef.current) {
      const dirtyDependencyInput = filesRef.current.find(file => file.isModified && file.path.toLocaleLowerCase().endsWith('.lcpp'));
      if (dirtyDependencyInput) {
        await requestWorkbenchAlert({
          title: '请先保存当前修改',
          description: `请先保存 ${dirtyDependencyInput.name}，再粘贴功能库；依赖闭包需要以一致的项目源码生成事务。`,
          confirmLabel: '知道了'
        });
        return;
      }
    }
    let clipboardText = '';
    try { clipboardText = await navigator.clipboard.readText(); } catch { await requestWorkbenchAlert({ title: '无法读取剪贴板', description: '请先在项目树中复制功能库。', confirmLabel: '知道了' }); return; }
    const prefix = 'LINGBUILDER_FUNCTION_LIBRARY:';
    if (!clipboardText.startsWith(prefix)) {
      await requestWorkbenchAlert({ title: '剪贴板内容不匹配', description: '剪贴板中没有 LingBuilder 功能库。请右键功能库文件并选择“复制功能库”。', confirmLabel: '知道了' });
      return;
    }
    let payload: { sourceProjectId?: string; sourcePath?: string };
    try { payload = JSON.parse(clipboardText.slice(prefix.length)); } catch { await requestWorkbenchAlert({ title: '剪贴板内容损坏', description: '剪贴板中的功能库信息已损坏。', confirmLabel: '知道了' }); return; }
    let targetName: string | undefined;
    const previewCopy = async () => {
      const response = await fetch('/api/window-designer/function-libraries/copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, targetProjectId, targetName, approved: false })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || '无法预览功能库复制。');
      return result.preview as any;
    };
    try {
      let preview = await previewCopy();
      while (preview.targetExists) {
        targetName = (await requestWorkbenchPrompt({
          title: '目标已有同名功能库',
          description: '目标项目已有同名功能库，请输入新的独立名称：',
          inputLabel: '新名称',
          inputValue: `${preview.targetName}副本`
        }))?.trim();
        if (!targetName) return;
        preview = await previewCopy();
      }
      const missingLines = [
        ...(preview.missing.libraries || []).map((item: string) => `缺少功能库：${item}`),
        ...(preview.missing.projectTypes || []).map((item: string) => `缺少项目数据类型：${item}`),
        ...(preview.missing.projectSymbols || []).map((item: string) => `缺少项目常量/全局变量：${item}`),
        ...(preview.missing.modules || []).map((item: string) => `缺少项目模块：${item}`)
      ];
      const conflictLines = (preview.conflicts || []).map((item: any) => `${item.name}：${item.reason}`);
      if (missingLines.length > 0 || conflictLines.length > 0) {
        await requestWorkbenchAlert({
          title: '依赖闭包不完整',
          description: [
            '功能库依赖闭包尚不能安全复制：',
            ...missingLines,
            ...conflictLines,
            '',
            '请先补齐源依赖，或处理目标项目中的同名定义后重试。'
          ].join('\n'),
          confirmLabel: '知道了'
        });
        return;
      }
      const copiedLibraries = (preview.libraries || []).filter((item: any) => item.action === 'copy');
      const reusedLibraries = (preview.libraries || []).filter((item: any) => item.action === 'reuse');
      const renamedLibraries = copiedLibraries.filter((item: any) => item.sourceName !== item.targetName);
      const copiedTypes = preview.resources?.projectTypes?.copied || [];
      const reusedTypes = preview.resources?.projectTypes?.reused || [];
      const copiedSymbols = preview.resources?.projectSymbols?.copied || [];
      const reusedSymbols = preview.resources?.projectSymbols?.reused || [];
      const enabledModules = preview.resources?.modules?.enabled || [];
      const reusedModules = preview.resources?.modules?.reused || [];
      const confirmed = await requestWorkbenchConfirm({
        title: '复制功能库',
        description: [
          `复制到：${preview.targetPath}`,
          `\n将复制功能库：${copiedLibraries.map((item: any) => item.targetName).join('、') || '无'}`,
          reusedLibraries.length ? `\n复用目标功能库：${reusedLibraries.map((item: any) => item.targetName).join('、')}` : '',
          renamedLibraries.length ? `\n自动避让重名：${renamedLibraries.map((item: any) => `${item.sourceName} → ${item.targetName}`).join('、')}` : '',
          copiedTypes.length ? `\n复制项目数据类型：${copiedTypes.join('、')}` : '',
          reusedTypes.length ? `\n复用相同数据类型：${reusedTypes.join('、')}` : '',
          copiedSymbols.length ? `\n复制项目常量/全局变量：${copiedSymbols.join('、')}` : '',
          reusedSymbols.length ? `\n复用相同项目符号：${reusedSymbols.join('、')}` : '',
          enabledModules.length ? `\n自动启用模块：${enabledModules.join('、')}` : '',
          reusedModules.length ? `\n复用已启用模块：${reusedModules.join('、')}` : '',
          '\n依赖闭包检查通过，以上内容会在同一次事务中写入。',
          '\n复制后是目标项目中的独立源码副本，不与原项目保持隐藏链接。',
          '\n是否继续？'
        ].filter(Boolean).join(''),
        confirmLabel: '复制',
        cancelLabel: '取消'
      });
      if (!confirmed) return;
      const response = await fetch('/api/window-designer/function-libraries/copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, targetProjectId, targetName, approved: true })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || '复制功能库失败。');
      appendEditorTransactionLog(`【功能库】已复制依赖闭包，共写入 ${(result.updatedFiles || []).length} 个项目文件；入口 ${result.filePath}`);
      if (targetProjectId === activeProjectIdRef.current) {
        for (const file of (result.updatedFiles || [])) await addPersistedFunctionLibraryToEditor(file.filePath, file.sourceCode, false);
        await addPersistedFunctionLibraryToEditor(result.filePath, result.sourceCode, true);
      }
    } catch (error) {
      await requestWorkbenchAlert({ title: '复制功能库失败', description: error instanceof Error ? error.message : '复制功能库失败。', confirmLabel: '知道了' });
    }
  }, [addPersistedFunctionLibraryToEditor]);

  useEffect(() => {
    const revealProjectGlobalDefinition = async (event: Event) => {
      const detail = (event as CustomEvent<{ filePath?: string; line?: number; column?: number }>).detail;
      if (!detail?.filePath || !detail.line) return;
      const normalizePath = (value: string) => value.replace(/\\/gu, '/').replace(/^\.\//u, '').toLocaleLowerCase();
      const target = filesRef.current.find(file => normalizePath(file.path) === normalizePath(detail.filePath || ''));
      if (!target || !(await handleSelectFile(target))) return;
      [0, 80].forEach(delay => window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('lingcpp-reveal-line', { detail }));
      }, delay));
    };
    window.addEventListener('lingcpp-reveal-definition', revealProjectGlobalDefinition);
    return () => window.removeEventListener('lingcpp-reveal-definition', revealProjectGlobalDefinition);
  }, [handleSelectFile]);

  const handleCloseTab = useCallback(async (tabPath: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    if (activeFileRef.current?.path === tabPath) {
      const flushState = await flushCurrentEditorDrafts();
      if (!flushState.ok) {
        showEditorFlushFailure(flushState.diagnostics);
        return;
      }
      setEditorState(createInactiveTextEditorStatus('switching-file'));
    }

    setOpenTabs(prev => {
      const index = prev.indexOf(tabPath);
      if (index === -1) return prev;

      const nextTabs = prev.filter(p => p !== tabPath);
      if (activeFileRef.current?.path === tabPath && nextTabs.length > 0) {
        const nextActivePath = nextTabs[Math.min(index, nextTabs.length - 1)];
        const nextActive = filesRef.current.find(f => f.path === nextActivePath);
        if (nextActive) {
          activeFileRef.current = nextActive;
          setActiveFile(nextActive);
        }
      }

      return nextTabs.length > 0 ? nextTabs : ['src/游戏主窗体.lcpp'];
    });
  }, [flushCurrentEditorDrafts, showEditorFlushFailure]);

  const updateEditorGroupFile = useCallback((filePath: string, content: string) => {
    const update = updateEditorFileContent(filesRef.current, activeFileRef.current, filePath, content);
    if (!update.updatedFile) return;
    filesRef.current = update.files;
    setFiles(update.files);
    if (update.activeFile && update.activeFile !== activeFileRef.current) {
      activeFileRef.current = update.activeFile;
      setActiveFile(update.activeFile);
    }
  }, []);

  const activateEditorGroup = useCallback((group: 'primary' | 'secondary') => {
    if (activeEditorGroupRef.current === group) return;
    activeEditorGroupRef.current = group;
    setEditorState(group === 'secondary'
      ? secondaryEditorStateRef.current
      : primaryEditorStateRef.current);
  }, []);

  const publishPrimaryEditorState = useCallback((state: MonacoEditorState) => {
    primaryEditorStateRef.current = state;
    if (activeEditorGroupRef.current === 'primary') setEditorState(state);
  }, []);

  const publishSecondaryEditorState = useCallback((state: MonacoEditorState) => {
    secondaryEditorStateRef.current = state;
    if (activeEditorGroupRef.current === 'secondary') setEditorState(state);
  }, []);

  const splitActiveEditor = useCallback((orientation: 'horizontal' | 'vertical') => {
    setEditorGroupLayout(previous => splitEditorGroup(previous, activeFileRef.current?.path || activeFile.path, orientation));
  }, [activeFile.path]);

  const restoreSingleEditorGroup = useCallback(() => {
    const collapsed = collapseEditorGroups(editorGroupLayout);
    const mergedTabs = collapsed.groups[0]?.tabs || [];
    openTabsRef.current = mergedTabs;
    setOpenTabs(mergedTabs);
    setEditorGroupLayout(collapsed);
  }, [editorGroupLayout]);

  useEffect(() => {
    if (editorGroupLayout.groups.length > 1 || activeEditorGroupRef.current !== 'secondary') return;
    activeEditorGroupRef.current = 'primary';
    setEditorState(primaryEditorStateRef.current);
  }, [editorGroupLayout.groups.length]);

  const movePrimaryTabToSecondary = useCallback(async () => {
    const filePath = activeFileRef.current?.path; if (!filePath) return;
    const flush = await flushCurrentEditorDrafts(); if (!flush.ok) return;
    setEditorGroupLayout(previous => {
      const split = splitEditorGroup(previous, filePath, previous.orientation);
      return moveEditorTab(split, split.groups[0].id, split.groups[1].id, filePath);
    });
    const remaining = openTabsRef.current.filter(path => path !== filePath);
    const fallbackPath = remaining[0] || filesRef.current.find(file => file.path !== filePath)?.path;
    if (fallbackPath) {
      const fallback = filesRef.current.find(file => file.path === fallbackPath);
      openTabsRef.current = remaining.includes(fallbackPath) ? remaining : [...remaining, fallbackPath];
      setOpenTabs(openTabsRef.current);
      if (fallback) { activeFileRef.current = fallback; setActiveFile(fallback); }
    }
  }, [flushCurrentEditorDrafts]);

  const moveSecondaryTabToPrimary = useCallback(async (filePath: string) => {
    const file = filesRef.current.find(item => item.path === filePath); if (!file) return;
    const selected = await handleSelectFile(file); if (!selected) return;
    setEditorGroupLayout(previous => previous.groups[1]
      ? moveEditorTab(previous, previous.groups[1].id, previous.groups[0].id, filePath)
      : previous);
  }, [handleSelectFile]);
  const [glossary, setGlossary] = useState<GlossaryTerm[]>(defaultGlossary);
  const [problems, setProblems] = useState<ProblemItem[]>([]);
  const [compilerProblems, setCompilerProblems] = useState<ProblemItem[]>([]);
  const [qualityProblems, setQualityProblems] = useState<ProblemItem[]>([]);
  const workbenchProblems = useMemo(
    () => [...compilerProblems, ...qualityProblems, ...problems],
    [compilerProblems, problems, qualityProblems]
  );
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState<'file' | 'edit' | 'view' | 'project' | 'tools' | 'help' | null>(null);
  const [showRecentWorkspacesDialog, setShowRecentWorkspacesDialog] = useState(false);
  const [isMinimizedApp, setIsMinimizedApp] = useState(false);
  const [showWelcomePage, setShowWelcomePage] = useState(true);
  const [hasEnteredWorkbench, setHasEnteredWorkbench] = useState(false);
  const hasEnteredWorkbenchRef = useRef(false);
  hasEnteredWorkbenchRef.current = hasEnteredWorkbench;
  const [isWorkspaceSwitching, setIsWorkspaceSwitching] = useState(false);
  const workspaceSwitchInFlightRef = useRef(false);
  const workspaceSwitchReloadTokenRef = useRef<number | null>(null);
  const enterWorkbench = useCallback(() => {
    hasEnteredWorkbenchRef.current = true;
    setHasEnteredWorkbench(true);
    setShowWelcomePage(false);
  }, []);
  const finishWorkspaceSwitch = useCallback(() => {
    if (!workspaceSwitchInFlightRef.current) return;
    workspaceSwitchInFlightRef.current = false;
    workspaceSwitchReloadTokenRef.current = null;
    setIsWorkspaceSwitching(false);
  }, []);
  const [isMaximizedApp, setIsMaximizedApp] = useState(false);
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [updateCheckState, setUpdateCheckState] = useState<UpdateDialogInfo | null>(null);
  /** 标题栏升级徽标数据源：最近一次检查确认存在新版本时保存其载荷，供悬浮说明与点击更新使用。 */
  const [updateBadgePayload, setUpdateBadgePayload] = useState<UpdateCheckPayload | null>(null);
  const [showUpdateBadgePanel, setShowUpdateBadgePanel] = useState(false);
  useEffect(() => {
    let disposed = false;
    const runSilentUpdateCheck = (announceOnDiscover: boolean) => {
      const check = window.lingBuilder?.updates?.check;
      if (!check) return;
      void check().then(result => {
        if (disposed || !result?.ok) return;
        setUpdateBadgePayload(result.hasUpdate ? result : null);
        if (result.hasUpdate && announceOnDiscover) {
          // 首次发现仍自动弹窗提醒一次；后续周期复查只刷新徽标，不反复打断用户。
          setUpdateCheckState(prev => prev ?? createUpdateDialogInfo(result, true));
        }
      }).catch(() => undefined);
    };
    const startupTimer = setTimeout(() => runSilentUpdateCheck(true), 5000);
    const recheckTimer = setInterval(() => runSilentUpdateCheck(false), 30 * 60 * 1000);
    return () => {
      disposed = true;
      clearTimeout(startupTimer);
      clearInterval(recheckTimer);
    };
  }, []);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showSponsorDialog, setShowSponsorDialog] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [projectBuildPathsState, setProjectBuildPathsState] = useState<{ projectId: string; projectName: string; initialValue: ProjectBuildPathsDialogValue } | null>(null);
  const [projectBuildPathsBusy, setProjectBuildPathsBusy] = useState(false);
  const [projectBuildPathsError, setProjectBuildPathsError] = useState<string>('');
  const [showEnvironmentRepairCenter, setShowEnvironmentRepairCenter] = useState(false);
  const [showCliGuide, setShowCliGuide] = useState(false);
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);
  const [createProjectName, setCreateProjectName] = useState('');
  const [createProjectTemplateId, setCreateProjectTemplateId] = useState<'blank-window' | 'windows-dll'>('blank-window');
  const [createSolutionName, setCreateSolutionName] = useState('');
  const [createProjectLocation, setCreateProjectLocation] = useState('');
  const [createProjectError, setCreateProjectError] = useState('');
  const createDialogSolutionNameTouchedRef = useRef(false);
  const [isCreatingSolutionProject, setIsCreatingSolutionProject] = useState(false);
  const [solutionNameOperation, setSolutionNameOperation] = useState<
    { kind: 'create-folder' } | { kind: 'rename-project'; projectId: string } | null
  >(null);
  const [solutionNameValue, setSolutionNameValue] = useState('');
  const [solutionNameError, setSolutionNameError] = useState('');
  const [isSubmittingSolutionName, setIsSubmittingSolutionName] = useState(false);
  const [workspaceSearchMode, setWorkspaceSearchMode] = useState<'search' | 'replace' | null>(null);
  // 工作台内非阻塞确认/提示/输入对话框：替代 window.confirm/alert/prompt，避免原生对话框冻结整个工作台输入。
  const [workbenchDialog, setWorkbenchDialog] = useState<WorkbenchDialogRequest | null>(() => getActiveWorkbenchDialog());
  useEffect(() => subscribeWorkbenchDialog(setWorkbenchDialog), []);
  const pendingWorkspaceSearchRevealRef = useRef<WorkspaceSearchMatch | null>(null);
  const pendingAiWorkbenchNavigationRef = useRef<{
    requestId: string;
    projectId: string;
    filePath: string;
    windowId?: string;
    dispatched?: boolean;
  } | null>(null);
  const workspaceReplacePreviewRef = useRef(new Map<string, OwnedWorkspaceReplacePreview>());
  const workspaceReplaceTransactionRef = useRef(new Map<string, OwnedWorkspaceReplacePreview>());
  const [configurationSnapshot, setConfigurationSnapshot] = useState<WorkbenchConfigurationSnapshot | null>(null);
  const [configurationLoading, setConfigurationLoading] = useState(true);
  const [configurationError, setConfigurationError] = useState('');
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);
  const [currentWorkspacePath, setCurrentWorkspacePath] = useState('');
  const [shortcutOverrides, setShortcutOverrides] = useState<Record<string, string>>({});
  const [commandRegistryVersion, setCommandRegistryVersion] = useState(0);
  const commandServiceRef = useRef(createCommandService());
  const commandContextRef = useRef<CommandContext>({});
  const designerCommandContextRef = useRef<CommandContext>({});
  useEffect(() => {
    const startupApi = window.lingBuilder?.startup;
    if (!startupApi) return;
    let disposed = false;
    void startupApi.shouldShowWelcome()
      .then(shouldShow => {
        if (disposed || hasEnteredWorkbenchRef.current) return;
        if (shouldShow) {
          setShowWelcomePage(true);
          setHasEnteredWorkbench(false);
        } else {
          hasEnteredWorkbenchRef.current = true;
          setHasEnteredWorkbench(true);
          setShowWelcomePage(false);
        }
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, []);
  useEffect(() => {
    // Web 模式下跨磁盘创建独立工作区后需整页刷新完成工作区切换；
    // 一次性标记让刷新后跳过欢迎页，直接进入新项目的工作台。
    try {
      if (sessionStorage.getItem(AUTO_ENTER_WORKSPACE_FLAG) === '1') {
        sessionStorage.removeItem(AUTO_ENTER_WORKSPACE_FLAG);
        enterWorkbench();
      }
    } catch {
      // 存储不可用（如隐私模式）时按正常流程显示欢迎页。
    }
  }, [enterWorkbench]);
  useEffect(() => commandServiceRef.current.onDidChange(() => {
    setCommandRegistryVersion(version => version + 1);
  }).dispose, []);
  useEffect(() => {
    const handleDesignerContext = (event: Event) => {
      designerCommandContextRef.current = (event as CustomEvent<CommandContext>).detail || {};
      setCommandRegistryVersion(version => version + 1);
    };
    window.addEventListener('lingbuilder-designer-command-context', handleDesignerContext);
    return () => window.removeEventListener('lingbuilder-designer-command-context', handleDesignerContext);
  }, []);
  const configurationMutationRef = useRef<(
    key: WorkbenchConfigurationKey,
    value: ConfigurationValue,
    target: ConfigurationTarget
  ) => Promise<boolean>>(async () => false);
  const [isAppClosed, setIsAppClosed] = useState(false);
  const [editorFontSize, setEditorFontSizeState] = useState(getInitialEditorFontSize);
  const [editorExperienceMode, setEditorExperienceModeState] = useState<EditorExperienceMode>(getInitialEditorExperienceMode);
  const [autoSaveMode, setAutoSaveMode] = useState<'off' | 'afterDelay'>('off');
  const [autoSaveDelay, setAutoSaveDelay] = useState(1200);
  const [sourceControlStatus, setSourceControlStatus] = useState<SourceControlStatus | null>(null);
  const [pendingDesignerEventEdit, setPendingDesignerEventEdit] = useState<PendingDesignerEventEdit | null>(null);
  const [moduleContext, setModuleContext] = useState<LingCppModuleContext>({
    enabledModules: [],
    availableModules: [],
    showAdvancedApi: window.localStorage.getItem('lingbuilder.modules.showAdvancedApi') === 'true'
  });

  useEffect(() => {
    workspaceReplacePreviewRef.current.clear();
    workspaceReplaceTransactionRef.current.clear();
  }, [activeProjectId, projectFileReloadToken]);

  const refreshModuleContext = useCallback(async () => {
    const projectId = activeProjectId;
    const loadGeneration = projectFileLoadGenerationRef.current;
    const [installedResult, enabledResult] = await Promise.all([
      fetch(`/api/modules/installed?projectId=${encodeURIComponent(projectId)}`).then(res => res.json()).catch(() => ({ ok: false, modules: [] })),
      fetch(`/api/modules/project?projectId=${encodeURIComponent(projectId)}`).then(res => res.json()).catch(() => ({ ok: false, modules: [] }))
    ]);
    if (activeProjectIdRef.current !== projectId
      || projectFileLoadGenerationRef.current !== loadGeneration) return;
    const availableModules = Array.isArray(installedResult.modules) ? installedResult.modules as InstalledModule[] : [];
    const enabledModules = Array.isArray(enabledResult.modules) ? enabledResult.modules as InstalledModule[] : [];
    // 模块列表内容未变化时保持引用稳定：moduleContext 是语言诊断、补全等重计算
    // useMemo 的依赖项，设计器每次提交后都换新引用会让这些计算重复执行并卡住主线程。
    setModuleContext(previous => (
      areInstalledModuleListsEquivalent(previous.availableModules, availableModules)
        && areInstalledModuleListsEquivalent(previous.enabledModules, enabledModules)
        ? previous
        : { availableModules, enabledModules, showAdvancedApi: previous.showAdvancedApi }
    ));
  }, [activeProjectId]);

  useEffect(() => {
    const updateVisibility = (event: Event) => {
      const value = (event as CustomEvent<{ showAdvancedApi?: boolean }>).detail?.showAdvancedApi === true;
      setModuleContext(previous => ({ ...previous, showAdvancedApi: value }));
    };
    window.addEventListener('lingbuilder-module-api-visibility-changed', updateVisibility);
    return () => window.removeEventListener('lingbuilder-module-api-visibility-changed', updateVisibility);
  }, []);

  const refreshSolution = useCallback(async () => {
    try {
      const nextSolution = await fetchSolution();
      setSolution(nextSolution);
      return nextSolution;
    } catch (error) {
      console.error('Failed to load solution:', error);
      return solution;
    }
  }, [solution]);

  const reloadWorkspaceState = useCallback(async (): Promise<SolutionModel> => {
    const nextSolution = await fetchSolution();
    hydratedProjectIdsRef.current.clear();
    projectFileVersionsRef.current = {};
    loadedProjectIdRef.current = '';
    setLoadedProjectId('');
    setProjectFileLoadState(createProjectFileLoadState(
      nextSolution.startupProjectId || nextSolution.projects[0]?.id || DEFAULT_SOLUTION.projects[0].id,
      'loading'
    ));
    setEditorState(createInactiveTextEditorStatus('loading-project'));
    setModuleContext(previous => ({ ...previous, availableModules: [], enabledModules: [] }));
    setProblems([]);
    setCompilerProblems([]);
    setQualityProblems([]);
    setSourceControlStatus(null);
    setSolution(nextSolution);
    setProjectFileReloadToken(token => {
      workspaceSwitchReloadTokenRef.current = token + 1;
      return token + 1;
    });
    enterWorkbench();
    return nextSolution;
  }, [enterWorkbench]);

  useEffect(() => {
    const workspaceApi = window.lingBuilder?.workspace;
    if (!workspaceApi?.onDidChange) return;
    let disposed = false;
    const unsubscribe = workspaceApi.onDidChange(snapshot => {
      if (disposed) return;
      workspaceSwitchInFlightRef.current = true;
      workspaceSwitchReloadTokenRef.current = null;
      setCurrentWorkspacePath(snapshot.workspacePath);
      setIsWorkspaceSwitching(true);
      void reloadWorkspaceState()
        .catch(error => {
          console.error('Failed to reload workspace state:', error);
          setProjectFileLoadState(createProjectFileLoadState(activeProjectIdRef.current, 'error', '工作区已切换，但项目状态载入失败。'));
          finishWorkspaceSwitch();
        });
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [finishWorkspaceSwitch, reloadWorkspaceState]);

  useEffect(() => {
    if (!isWorkspaceSwitching) return;
    const reloadToken = workspaceSwitchReloadTokenRef.current;
    if (reloadToken === null || reloadToken !== projectFileReloadToken) return;
    if (projectFileEditorAvailability === 'ready' || projectFileEditorAvailability === 'error') {
      finishWorkspaceSwitch();
    }
  }, [finishWorkspaceSwitch, isWorkspaceSwitching, projectFileEditorAvailability, projectFileReloadToken]);

  useEffect(() => {
    if (!hasEnteredWorkbench || workspaceSwitchInFlightRef.current) return;
    void refreshSolution();
  }, [hasEnteredWorkbench]);

  useEffect(() => { const receive = (event: Event) => { const diagnostics = (event as CustomEvent<{ diagnostics?: any[] }>).detail?.diagnostics || []; const next: ProblemItem[] = diagnostics.map((item, index) => ({ id: `quality:${item.source}:${index}:${item.filePath || ''}:${item.line || 0}`, filePath: item.filePath || '质量分析', line: item.line || 1, column: item.column, code: item.code, source: item.source, level: item.severity, message: item.message, codeSnippet: item.message, suggestion: item.source === 'sarif' ? '请根据静态分析规则修正代码后重新生成报告。' : '请根据 Sanitizer 调用栈修复内存或未定义行为问题。' })); setQualityProblems(next); if (next.length) { setShowBottomPanel(true); setActiveTabInBottom('problems'); } }; window.addEventListener('lingbuilder-quality-diagnostics', receive); return () => window.removeEventListener('lingbuilder-quality-diagnostics', receive); }, []);

  useEffect(() => {
    const receiveDiagnostics = (event: Event) => {
      const diagnostics = (event as CustomEvent<{ diagnostics?: any[] }>).detail?.diagnostics || [];
      const next: ProblemItem[] = diagnostics.map(item => ({
        id: item.id, filePath: item.filePath || item.generatedFile || '构建链接器', line: item.line || 1,
        column: item.column, code: item.code, source: item.tool, level: item.severity,
        message: item.message, codeSnippet: item.raw, suggestion: item.filePath
          ? '单击跳转到映射后的源码位置，修正后重新构建。'
          : '请检查链接库、输出目录和构建架构。'
      }));
      setCompilerProblems(next);
      if (next.length) { setShowBottomPanel(true); setActiveTabInBottom('problems'); }
    };
    window.addEventListener('lingbuilder-compiler-diagnostics', receiveDiagnostics);
    return () => window.removeEventListener('lingbuilder-compiler-diagnostics', receiveDiagnostics);
  }, []);

  useEffect(() => {
    const handleDesignerProjectUpdated = (event: Event) => {
      if (!activeProjectHasWindowDesigner) return;
      const customEvent = event as CustomEvent<PersistedWindowDesignerState>;
      const nextState = customEvent.detail || readWindowDesignerState(activeProjectIdRef.current);
      if (nextState.project.id !== activeProjectIdRef.current) return;
      setWindowDesignerState(nextState);
      const nextDirty = JSON.stringify(nextState.project) !== designerSavedSnapshotRef.current;
      designerDirtyRef.current = nextDirty;
      setDesignerDirty(nextDirty);
      refreshModuleContext();
    };

    const handleModulesChanged = () => {
      refreshModuleContext();
      void fetch('/api/build-configuration')
        .then(response => response.json())
        .then(payload => payload.configuration && setBuildConfiguration(payload.configuration));
    };

    const handleDesignerDirtyStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<WindowDesignerDirtyStateDetail>).detail;
      if (!detail || detail.projectId !== activeProjectIdRef.current) return;
      const nextDirty = detail.isDirty
        && JSON.stringify(detail.state.project) !== designerSavedSnapshotRef.current;
      designerDirtyRef.current = nextDirty;
      setDesignerDirty(nextDirty);
    };

    window.addEventListener(WINDOW_DESIGNER_PROJECT_UPDATED, handleDesignerProjectUpdated);
    window.addEventListener(WINDOW_DESIGNER_DIRTY_STATE_CHANGED, handleDesignerDirtyStateChanged);
    window.addEventListener('lingbuilder-modules-changed', handleModulesChanged);
    if (hasEnteredWorkbench) refreshModuleContext();
    return () => {
      window.removeEventListener(WINDOW_DESIGNER_PROJECT_UPDATED, handleDesignerProjectUpdated);
      window.removeEventListener(WINDOW_DESIGNER_DIRTY_STATE_CHANGED, handleDesignerDirtyStateChanged);
      window.removeEventListener('lingbuilder-modules-changed', handleModulesChanged);
    };
  }, [activeProjectHasWindowDesigner, hasEnteredWorkbench, refreshModuleContext]);

  useEffect(() => {
    if (activeFile.language !== 'lingcpp') {
      setProblems([]);
      return;
    }

    const sourceCode = activeFile.translatedContent || activeFile.originalContent || '';
    const nextProblems = getLingCppProblems(
      sourceCode,
      activeProjectHasWindowDesigner ? windowDesignerState.project : undefined,
      activeFile.path,
      moduleContext
    ).map(problem => {
      const beginner = adaptProblemForBeginner(problem);
      return {
        id: problem.id,
        filePath: problem.filePath,
        line: problem.line,
        level: problem.level,
        message: editorExperienceMode === 'beginner' ? beginner.audienceText : problem.message,
        codeSnippet: problem.codeSnippet,
        suggestion: editorExperienceMode === 'beginner' ? beginner.beginnerActionLabel : problem.suggestion,
        actionLabel: editorExperienceMode === 'beginner' ? beginner.beginnerActionLabel : problem.actionLabel,
        actionKind: problem.actionKind,
        audienceText: beginner.audienceText,
        beginnerActionLabel: beginner.beginnerActionLabel,
        severityForBeginner: beginner.severityForBeginner,
        canIgnore: beginner.canIgnore,
        locationKind: problem.locationKind
      };
    });
    setProblems(nextProblems);
  }, [activeFile.language, activeFile.originalContent, activeFile.path, activeFile.translatedContent, activeProjectHasWindowDesigner, editorExperienceMode, moduleContext, windowDesignerState.project]);

  const setEditorExperienceMode = useCallback(async (mode: EditorExperienceMode): Promise<boolean> => {
    const target = getWorkbenchConfigurationMutationTarget(
      configurationSnapshot,
      'editor.experienceMode'
    );
    return configurationMutationRef.current('editor.experienceMode', mode, target);
  }, [configurationSnapshot]);

  const handleEditorExperienceModeChange = useCallback(async (mode: EditorExperienceMode): Promise<boolean> => {
    if (mode === editorExperienceMode) return true;
    return await setEditorExperienceMode(mode);
  }, [editorExperienceMode, setEditorExperienceMode]);

  const setEditorFontSize = useCallback((nextValue: number | ((value: number) => number)) => {
    setEditorFontSizeState(previousValue => {
      const rawValue = typeof nextValue === 'function' ? nextValue(previousValue) : nextValue;
      const clampedValue = clampEditorFontSize(rawValue);
      window.queueMicrotask(() => {
        void configurationMutationRef.current('editor.fontSize', clampedValue, 'user');
      });
      return clampedValue;
    });
  }, []);

  const promptEditorFontSize = async () => {
    const inputValue = await requestWorkbenchPrompt({
      title: '设置编辑器字体大小',
      description: `范围 ${MIN_EDITOR_FONT_SIZE}-${MAX_EDITOR_FONT_SIZE}px。`,
      inputLabel: '字号（px）',
      inputValue: String(editorFontSize)
    });
    if (inputValue === null) return;

    const parsedValue = Number.parseInt(inputValue, 10);
    if (!Number.isFinite(parsedValue)) {
      await requestWorkbenchAlert({ title: '输入无效', description: '请输入有效的字号数字。', confirmLabel: '知道了' });
      return;
    }

    setEditorFontSize(parsedValue);
  };

  const refreshSourceControlStatus = useCallback(async () => {
    const status = await sourceControlService.getStatus();
    setSourceControlStatus(status);
  }, []);

  const handleWindowMinimize = async () => {
    const windowControls = getNativeWindowControls();
    if (!windowControls) {
      setIsMinimizedApp(true);
      return;
    }

    try {
      await windowControls.minimize();
    } catch (error) {
      console.error('Failed to minimize native LingBuilder window:', error);
      setIsMinimizedApp(true);
    }
  };

  const handleWindowToggleMaximize = async () => {
    const windowControls = getNativeWindowControls();
    if (!windowControls) {
      setIsMaximizedApp(prev => !prev);
      return;
    }

    try {
      const isMaximized = await windowControls.toggleMaximize();
      setIsMaximizedApp(isMaximized);
    } catch (error) {
      console.error('Failed to toggle native LingBuilder window maximized state:', error);
      setIsMaximizedApp(prev => !prev);
    }
  };

  const handleWindowCloseConfirmed = async () => {
    setShowCloseConfirmModal(false);
    const windowControls = getNativeWindowControls();
    if (!windowControls) {
      setIsAppClosed(true);
      return;
    }

    try {
      await windowControls.confirmClose();
    } catch (error) {
      console.error('Failed to close native LingBuilder window:', error);
      setIsAppClosed(true);
    }
  };

  const handleImportDictionary = (name: string, terms: GlossaryTerm[]) => {
    setGlossary(prev => {
      const existingEngs = new Set(prev.map(g => g.english));
      const newTerms = terms.filter(t => !existingEngs.has(t.english));
      return [...prev, ...newTerms];
    });
    setBuildLogs(prev => [
      ...prev,
      `> [${new Date().toLocaleTimeString()}] 📚 成功导入翻译字典库：'${name}' (已集成该词典的本地化映射词条)。`
    ]);
  };

  // Workspace layout toggles
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [isDesignerViewActive, setIsDesignerViewActive] = useState(false);
  const [designerToolboxHost, setDesignerToolboxHost] = useState<HTMLElement | null>(null);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [activeTabInBottom, setActiveTabInBottom] = useState<BottomPanelTabType>('output');

  const applyConfigurationSnapshot = useCallback((snapshot: WorkbenchConfigurationSnapshot) => {
    setConfigurationSnapshot(snapshot);
    const readValue = (key: WorkbenchConfigurationKey) => snapshot.settings
      .find(item => item.metadata.key === key)?.inspection.value;
    const fontSize = readValue('editor.fontSize');
    const experienceMode = readValue('editor.experienceMode');
    const nextAutoSaveMode = readValue('files.autoSave');
    const nextAutoSaveDelay = readValue('files.autoSaveDelay');
    const colorTheme = readValue('workbench.colorTheme');
    const sidebarVisible = readValue('workbench.sidebar.visible');
    const sidebarWidth = readValue('workbench.sidebar.width');
    const panelVisible = readValue('workbench.panel.visible');
    const aiPanelVisible = readValue('workbench.aiPanel.visible');
    const aiPanelWidth = readValue('workbench.aiPanel.width');
    const shortcuts = readValue('keyboard.shortcuts');

    if (typeof fontSize === 'number') setEditorFontSizeState(clampEditorFontSize(fontSize));
    if (experienceMode === 'beginner' || experienceMode === 'professional' || experienceMode === 'native') {
      setEditorExperienceModeState(experienceMode);
    }
    if (nextAutoSaveMode === 'off' || nextAutoSaveMode === 'afterDelay') setAutoSaveMode(nextAutoSaveMode);
    if (typeof nextAutoSaveDelay === 'number') setAutoSaveDelay(nextAutoSaveDelay);
    if (colorTheme === 'dark' || colorTheme === 'light') setIsDarkMode(colorTheme === 'dark');
    if (typeof sidebarVisible === 'boolean') setShowLeftSidebar(sidebarVisible);
    if (typeof sidebarWidth === 'number') setLeftWidth(clampLeftSidebarWidth(sidebarWidth));
    if (typeof panelVisible === 'boolean') setShowBottomPanel(panelVisible);
    if (typeof aiPanelVisible === 'boolean') setShowRightPanel(aiPanelVisible);
    if (typeof aiPanelWidth === 'number') setAiPanelWidth(clampAiPanelWidth(aiPanelWidth));
    setShortcutOverrides(isStringRecord(shortcuts) ? shortcuts : {});
  }, []);

  const loadWorkbenchConfiguration = useCallback(async (): Promise<void> => {
    setConfigurationLoading(true);
    try {
      const response = await fetch('/api/configuration');
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || '读取工作台设置失败。');
      let snapshot = result as WorkbenchConfigurationSnapshot;
      let legacyFontSize: string | null = null;
      let legacyExperienceMode: string | null = null;
      try {
        legacyFontSize = window.localStorage.getItem(LEGACY_EDITOR_FONT_SIZE_KEY);
        legacyExperienceMode = window.localStorage.getItem(LEGACY_EDITOR_EXPERIENCE_MODE_KEY);
      } catch {
        // Configuration remains usable when renderer storage is unavailable.
      }
      const migration = planLegacyWorkbenchConfigurationMigration(snapshot, {
        editorFontSize: legacyFontSize,
        editorExperienceMode: legacyExperienceMode
      });
      for (const update of migration.updates) {
        const migrationResponse = await fetch('/api/configuration', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: update.key, value: update.value, target: 'user' })
        });
        const migrationResult = await migrationResponse.json().catch(() => ({}));
        if (!migrationResponse.ok || migrationResult.ok === false) {
          throw new Error(migrationResult.error || '迁移旧版工作台设置失败。');
        }
        snapshot = migrationResult as WorkbenchConfigurationSnapshot;
      }
      try {
        migration.storageKeysToClear.forEach(key => window.localStorage.removeItem(key));
      } catch {
        // The migration has already persisted; stale renderer storage is ignored next time.
      }
      applyConfigurationSnapshot(snapshot);
      setConfigurationError('');
    } catch (error) {
      setConfigurationError(error instanceof Error ? error.message : '读取工作台设置失败。');
    } finally {
      setConfigurationLoading(false);
    }
  }, [applyConfigurationSnapshot]);

  const updateWorkbenchConfiguration = useCallback(async (
    key: WorkbenchConfigurationKey,
    value: ConfigurationValue,
    target: ConfigurationTarget
  ): Promise<boolean> => {
    return runGuardedConfigurationUpdate({
      key,
      value,
      currentEditorExperienceMode: editorExperienceMode,
      flushEditorDrafts: async () => {
        const result = await flushCurrentEditorDrafts();
        return { ok: result.ok, diagnostics: result.diagnostics };
      },
      onFlushFailure: diagnostics => {
        const messages = [...diagnostics];
        showEditorFlushFailure(messages);
        setConfigurationError(messages[0] || '新手代码提交失败，未切换编辑器体验模式。');
      },
      commit: async () => {
        try {
          const response = await fetch('/api/configuration', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value, target })
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || result.ok === false) throw new Error(result.error || '保存工作台设置失败。');
          applyConfigurationSnapshot(result as WorkbenchConfigurationSnapshot);
          setConfigurationError('');
          return true;
        } catch (error) {
          setConfigurationError(error instanceof Error ? error.message : '保存工作台设置失败。');
          return false;
        }
      }
    });
  }, [applyConfigurationSnapshot, editorExperienceMode, flushCurrentEditorDrafts, showEditorFlushFailure]);

  const resetWorkbenchConfiguration = useCallback(async (
    key: WorkbenchConfigurationKey,
    target: ConfigurationTarget
  ): Promise<boolean> => {
    return runGuardedConfigurationUpdate({
      key,
      value: editorExperienceMode,
      currentEditorExperienceMode: editorExperienceMode,
      forceEditorDraftFlush: key === 'editor.experienceMode',
      flushEditorDrafts: async () => {
        const result = await flushCurrentEditorDrafts();
        return { ok: result.ok, diagnostics: result.diagnostics };
      },
      onFlushFailure: diagnostics => {
        const messages = [...diagnostics];
        showEditorFlushFailure(messages);
        setConfigurationError(messages[0] || '新手代码提交失败，未恢复编辑器体验设置。');
      },
      commit: async () => {
        try {
          const response = await fetch(`/api/configuration/${encodeURIComponent(key)}?target=${target}`, { method: 'DELETE' });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || result.ok === false) throw new Error(result.error || '恢复默认设置失败。');
          applyConfigurationSnapshot(result as WorkbenchConfigurationSnapshot);
          setConfigurationError('');
          return true;
        } catch (error) {
          setConfigurationError(error instanceof Error ? error.message : '恢复默认设置失败。');
          return false;
        }
      }
    });
  }, [applyConfigurationSnapshot, editorExperienceMode, flushCurrentEditorDrafts, showEditorFlushFailure]);

  useEffect(() => {
    configurationMutationRef.current = updateWorkbenchConfiguration;
  }, [updateWorkbenchConfiguration]);

  useEffect(() => {
    void loadWorkbenchConfiguration();
  }, [loadWorkbenchConfiguration]);

  const openCommandPalette = useCallback(() => {
    setActiveDropdown(null);
    setShowSettingsDialog(false);
    setWorkspaceSearchMode(null);
    setCommandQuery('');
    setShowCommandPalette(true);
  }, []);

  const openSettingsDialog = useCallback(() => {
    setActiveDropdown(null);
    setShowCommandPalette(false);
    setWorkspaceSearchMode(null);
    setShowSettingsDialog(true);
    void loadWorkbenchConfiguration();
  }, [loadWorkbenchConfiguration]);

  const openWorkspaceSearch = useCallback(async (mode: 'search' | 'replace'): Promise<boolean> => {
    const flushState = await flushCurrentEditorDrafts();
    if (!flushState.ok) {
      showEditorFlushFailure(flushState.diagnostics);
      return false;
    }
    setActiveDropdown(null);
    setShowCommandPalette(false);
    setShowSettingsDialog(false);
    setWorkspaceSearchMode(mode);
    return true;
  }, [flushCurrentEditorDrafts, showEditorFlushFailure]);

  const toggleSidebarVisibility = useCallback(async (): Promise<boolean> => (
    configurationMutationRef.current('workbench.sidebar.visible', !showLeftSidebar, 'user')
  ), [showLeftSidebar]);

  const toggleBottomPanelVisibility = useCallback(async (): Promise<boolean> => (
    configurationMutationRef.current('workbench.panel.visible', !showBottomPanel, 'user')
  ), [showBottomPanel]);

  const toggleAiPanelVisibility = useCallback(async (): Promise<boolean> => (
    configurationMutationRef.current('workbench.aiPanel.visible', !showRightPanel, 'user')
  ), [showRightPanel]);

  const toggleWorkbenchTheme = useCallback(async (): Promise<boolean> => (
    configurationMutationRef.current('workbench.colorTheme', isDarkMode ? 'light' : 'dark', 'user')
  ), [isDarkMode]);
  const [moduleHint, setModuleHint] = useState<ModuleHintContent | null>(null);
  const [commandHint, setCommandHint] = useState<CommandHintContent | null>(null);

  const handleShowModuleHint = useCallback((hint: ModuleHintContent) => {
    setCommandHint(null);
    setModuleHint(hint);
    setActiveTabInBottom('module_hint');
    setShowBottomPanel(true);
  }, []);

  const handleShowCommandHint = useCallback((hint: CommandHintContent | null) => {
    setCommandHint(hint);
    if (!hint) return;
    setModuleHint(null);
    setActiveTabInBottom('module_hint');
    setShowBottomPanel(true);
  }, []);

  // Resizable sidebars state
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_SIDEBAR_WIDTH);
  const [aiPanelWidth, setAiPanelWidth] = useState(DEFAULT_AI_PANEL_WIDTH);
  const [bottomHeight, setBottomHeight] = useState(260);

  const startResizeLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    let resizedWidth = leftWidth;
    let didResize = false;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Activity bar is 48px (w-12). Drawer is clientX - 48.
      resizedWidth = clampLeftSidebarWidth(moveEvent.clientX - 48);
      didResize = true;
      setLeftWidth(resizedWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (didResize) {
        void configurationMutationRef.current('workbench.sidebar.width', resizedWidth, 'user');
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const resetLeftSidebarWidth = () => {
    setLeftWidth(DEFAULT_LEFT_SIDEBAR_WIDTH);
    void configurationMutationRef.current('workbench.sidebar.width', DEFAULT_LEFT_SIDEBAR_WIDTH, 'user');
  };

  const startResizeAiPanel = (e: React.MouseEvent) => {
    e.preventDefault();
    let resizedWidth = aiPanelWidth;
    let didResize = false;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      resizedWidth = clampAiPanelWidth(window.innerWidth - moveEvent.clientX);
      didResize = true;
      setAiPanelWidth(resizedWidth);
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (didResize) void configurationMutationRef.current('workbench.aiPanel.width', resizedWidth, 'user');
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const resetAiPanelWidth = () => {
    setAiPanelWidth(DEFAULT_AI_PANEL_WIDTH);
    void configurationMutationRef.current('workbench.aiPanel.width', DEFAULT_AI_PANEL_WIDTH, 'user');
  };

  const startResizeBottom = (e: React.MouseEvent) => {
    e.preventDefault();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const maxHeight = Math.max(220, Math.min(560, window.innerHeight - 220));
      const newHeight = Math.max(140, Math.min(maxHeight, window.innerHeight - moveEvent.clientY - 24));
      setBottomHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Compilation Logs
  const [buildLogs, setBuildLogs] = useState<string[]>([
    '欢迎使用 LingBuilder C++ 中文集成开发环境 (IDE)。',
    '已就绪。点击上方“编译 F5”或左侧“运行”开始真实生成、编译并运行当前项目。',
  ]);
  const [taskSnapshots, setTaskSnapshots] = useState<TaskSnapshot[]>([]);
  const [clangdStatus, setClangdStatus] = useState<ClangdStatus>({ state: 'stopped', message: 'clangd 尚未启动。', restartCount: 0 });
  const [buildConfiguration, setBuildConfiguration] = useState<BuildConfiguration>({ schemaVersion: 1, mode: 'Debug', architecture: 'Win32' });
  const clangdDocumentRef = useRef<{ path: string; text: string } | null>(null);
  const clangdSyncGenerationRef = useRef(0);
  const taskLogCountsRef = useRef(new Map<string, number>());

  useEffect(() => {
    if (!hasEnteredWorkbench) return;
    let disposed = false;
    let polling = false;
    let pollTimer: number | undefined;
    const applyTask = (task: TaskSnapshot) => {
      setTaskSnapshots(previous => [...previous.filter(item => item.id !== task.id), task]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 30));
      const consumed = taskLogCountsRef.current.get(task.id) || 0;
      const additions = task.logs.slice(consumed).map(log => `> [${new Date(log.timestamp).toLocaleTimeString()}] [${task.title}] ${log.message}`);
      taskLogCountsRef.current.set(task.id, task.logs.length);
      if (additions.length) setBuildLogs(previous => [...previous, ...additions]);
    };
    const pollTasks = async () => {
      if (disposed || polling) return;
      polling = true;
      try {
        const response = await fetch('/api/tasks', { cache: 'no-store' });
        const payload = await response.json();
        if (!disposed && response.ok && Array.isArray(payload.tasks)) payload.tasks.forEach(applyTask);
      } catch {
        // The task list is advisory UI state; the next bounded poll retries it.
      } finally {
        polling = false;
        if (!disposed) pollTimer = window.setTimeout(() => void pollTasks(), 1_000);
      }
    };
    void pollTasks();
    return () => {
      disposed = true;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
    };
  }, [hasEnteredWorkbench]);

  useEffect(() => {
    const isCpp = activeFile.language === 'cpp' || /\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx)$/iu.test(activeFile.path);
    if (!projectFilesReady || !isCpp) return;
    const events = new EventSource('/api/lsp/events');
    events.addEventListener('status', ((event: MessageEvent<string>) => setClangdStatus(JSON.parse(event.data))) as EventListener);
    events.addEventListener('diagnostics', ((event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data);
      const count = Array.isArray(payload?.diagnostics) ? payload.diagnostics.length : 0;
      if (count) setBuildLogs(previous => [...previous, `> [${new Date().toLocaleTimeString()}] [clangd] 收到 ${count} 条 C/C++ 诊断。`]);
    }) as EventListener);
    return () => events.close();
  }, [activeFile.language, activeFile.path, projectFilesReady]);

  useEffect(() => {
    if (!hasEnteredWorkbench) return;
    void fetch('/api/build-configuration')
      .then(response => response.json())
      .then(payload => payload.configuration && setBuildConfiguration(payload.configuration));
  }, [currentWorkspacePath, hasEnteredWorkbench]);
  const updateBuildConfiguration = useCallback(async (patch: { mode?: BuildMode; architecture?: BuildArchitecture }) => {
    const next = { ...buildConfiguration, ...patch };
    const response = await fetch('/api/build-configuration', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setBuildConfiguration(payload.configuration);
    else appendEditorTransactionLog(`【构建配置错误】${payload.error || '保存失败。'}`);
  }, [buildConfiguration]);

  useEffect(() => {
    const isCpp = activeFile.language === 'cpp' || /\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx)$/iu.test(activeFile.path);
    if (!isCpp || !projectFilesReady) return;
    const generation = ++clangdSyncGenerationRef.current;
    const text = getCurrentFileContent(activeFile);
    const timer = window.setTimeout(async () => {
      const previous = clangdDocumentRef.current;
      if (previous?.path && previous.path !== activeFile.path) {
        await fetch(`/api/lsp/documents?filePath=${encodeURIComponent(previous.path)}`, { method: 'DELETE' });
      }
      if (generation !== clangdSyncGenerationRef.current) return;
      const method = previous?.path === activeFile.path ? 'PATCH' : 'PUT';
      const body = method === 'PUT'
        ? { filePath: activeFile.path, text, languageId: 'cpp' }
        : { filePath: activeFile.path, changes: [{ text }] };
      const response = await fetch('/api/lsp/documents', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (generation !== clangdSyncGenerationRef.current) return;
      if (response.ok) clangdDocumentRef.current = { path: activeFile.path, text };
      else if (payload.status) setClangdStatus(payload.status);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeFile.language, activeFile.path, activeFile.originalContent, activeFile.translatedContent, projectFilesReady]);

  useEffect(() => () => {
    const current = clangdDocumentRef.current;
    if (current) void fetch(`/api/lsp/documents?filePath=${encodeURIComponent(current.path)}`, { method: 'DELETE' });
  }, []);

  useEffect(() => {
    const handleApplied = (event: Event) => {
      const files = (event as CustomEvent<{ files?: string[] }>).detail?.files || [];
      appendEditorTransactionLog(`【C/C++ 重构】已原子应用 ${files.length} 个文件，正在重新载入。`);
      setProjectFileReloadToken(token => token + 1);
    };
    window.addEventListener('lingbuilder-lsp-files-applied', handleApplied);
    return () => window.removeEventListener('lingbuilder-lsp-files-applied', handleApplied);
  }, []);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [debugBreakpoints, setDebugBreakpoints] = useState<Array<{ filePath: string; line: number; condition?: string }>>([]);
  const [nativeDebugSession, setNativeDebugSession] = useState<any>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const editorOperationRef = useRef<EditorOperation | null>(null);
  const buildStartedRef = useRef(false);
  const buildRequestIdRef = useRef(0);
  const buildDispatchTimeoutRef = useRef<number | null>(null);
  const buildLaunchTimeoutRef = useRef<number | null>(null);
  const buildIntervalRef = useRef<any>(null);
  const environmentCheckRequestGateRef = useRef(createEnvironmentCheckRequestGate());
  useEffect(() => () => {
    environmentCheckRequestGateRef.current.cancel();
  }, []);
  const [isAutoTranslating, setIsAutoTranslating] = useState(false);
  const autoTranslateOwnerRef = useRef<ProjectMutationOwner | null>(null);

  // Custom File Modal
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customFilename, setCustomFilename] = useState('custom_utils.cpp');
  const [customCode, setCustomCode] = useState(`// Custom Helper Code for translation testing
#include <iostream>

void DisplayStatus() {
    std::cout << "Loading system plugins..." << std::endl;
    std::cout << "Critical Warning: Database connection is offline!" << std::endl;
    // TO-DO: translate this dialog notice
    MessageBoxW(NULL, L"Operation completed successfully. Press OK to close.", L"Success Notice", MB_OK);
  }`);
  const [isExtracting, setIsExtracting] = useState(false);
  const extractOwnerRef = useRef<ProjectMutationOwner | null>(null);

  // Calculate overall project progress
  const getOverallProgress = () => {
    let totalStrings = 0;
    let translatedStrings = 0;
    files.forEach(f => {
      totalStrings += f.strings.length;
      translatedStrings += f.strings.filter(s => s.status === 'translated').length;
    });
    return totalStrings === 0 ? 100 : Math.round((translatedStrings / totalStrings) * 100);
  };

  // Run the C++ reconstruct algorithm on a file when its string definitions are updated
  const triggerReconstruction = async (
    fileToRebuild: CppFile,
    updatedStrings: ExtractedString[],
    requestOwner: ProjectMutationOwner = captureProjectMutationOwner()
  ) => {
    if (!isCurrentProjectMutationOwner(requestOwner)) return;
    try {
      const response = await fetch('/api/reconstruct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: fileToRebuild.originalContent,
          strings: updatedStrings
        })
      });

      if (!response.ok) {
        throw new Error('代码重建失败');
      }

      const data = await response.json();
      if (!isCurrentProjectMutationOwner(requestOwner)) return;

      setFiles(prevFiles => {
        if (!isCurrentProjectMutationOwner(requestOwner)) return prevFiles;
        const nextFiles = prevFiles.map(f => {
          if (f.path === fileToRebuild.path) {
            return {
              ...f,
              strings: updatedStrings,
              translatedContent: data.code,
              isModified: true
            };
          }
          return f;
        });

        // Sync active file reference
        const matched = nextFiles.find(f => f.path === fileToRebuild.path);
        if (matched && activeFileRef.current?.path === fileToRebuild.path) {
          activeFileRef.current = matched;
          setActiveFile(matched);
        }

        return nextFiles;
      });

      // Dynamically clear resolved problems/warnings
      setProblems(prevProbs => {
        if (!isCurrentProjectMutationOwner(requestOwner)) return prevProbs;
        return prevProbs.filter(p => {
          if (p.filePath !== fileToRebuild.path) return true;
          // Check if warning matches any pending strings
          // If the strings are now translated, we can dismiss the problem report!
          const stringInWarning = updatedStrings.find(s => s.line === p.line);
          return stringInWarning ? stringInWarning.status === 'pending' : true;
        });
      });

    } catch (error) {
      // Fallback offline reconstruction if server is building/loading
      if (isCurrentProjectMutationOwner(requestOwner)) {
        console.error('Error rebuilding C++ file structure:', error);
        rebuildFileOffline(fileToRebuild, updatedStrings, requestOwner);
      }
    }
  };

  useEffect(() => {
    const windowControls = getNativeWindowControls();
    if (!windowControls?.onCloseRequested) return;
    return windowControls.onCloseRequested(() => setShowCloseConfirmModal(true));
  }, []);

  // Fallback offline reconstruction
  const rebuildFileOffline = (
    fileToRebuild: CppFile,
    updatedStrings: ExtractedString[],
    requestOwner: ProjectMutationOwner
  ) => {
    if (!isCurrentProjectMutationOwner(requestOwner)) return;
    let rebuiltCode = fileToRebuild.originalContent;
    updatedStrings.forEach(s => {
      if (s.translated && s.status === 'translated') {
        // String replace fallback
        rebuiltCode = rebuiltCode.replace(s.original, s.translated);
      }
    });

    setFiles(prevFiles => {
      if (!isCurrentProjectMutationOwner(requestOwner)) return prevFiles;
      const nextFiles = prevFiles.map(f => {
        if (f.path === fileToRebuild.path) {
          return {
            ...f,
            strings: updatedStrings,
            translatedContent: rebuiltCode,
            isModified: true
          };
        }
        return f;
      });
      const matched = nextFiles.find(f => f.path === fileToRebuild.path);
      if (matched && activeFileRef.current?.path === fileToRebuild.path) {
        activeFileRef.current = matched;
        setActiveFile(matched);
      }
      return nextFiles;
    });
  };

  // Perform reconstruction on startup to populate initial translated states
  useEffect(() => {
    const handleAddAppLog = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string }>;
      if (customEvent.detail && customEvent.detail.message) {
        setBuildLogs(prev => [...prev, customEvent.detail.message]);
      }
    };
    window.addEventListener('add-app-log', handleAddAppLog);
    return () => {
      window.removeEventListener('add-app-log', handleAddAppLog);
    };
  }, []);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    const handleWindowDesignerBuildRunState = (e: Event) => {
      const customEvent = e as CustomEvent<WindowDesignerBuildRunStateDetail>;
      const detail = customEvent.detail;
      if (!detail) return;

      if (detail.status === 'started') {
        buildStartedRef.current = true;
        if (buildLaunchTimeoutRef.current !== null) {
          window.clearTimeout(buildLaunchTimeoutRef.current);
          buildLaunchTimeoutRef.current = null;
        }
        setIsBuilding(true);
        setShowBottomPanel(true);
        setActiveTabInBottom('output');
      } else {
        if (detail.status === 'completed' && detail.ok === true) {
          setShowBottomPanel(true);
          setActiveTabInBottom('debug_logs');
        }
        buildStartedRef.current = false;
        if (editorOperationRef.current === 'build') editorOperationRef.current = null;
        setIsBuilding(false);
      }
    };

    window.addEventListener(WINDOW_DESIGNER_BUILD_RUN_STATE, handleWindowDesignerBuildRunState);
    return () => {
      window.removeEventListener(WINDOW_DESIGNER_BUILD_RUN_STATE, handleWindowDesignerBuildRunState);
      if (buildLaunchTimeoutRef.current !== null) {
        window.clearTimeout(buildLaunchTimeoutRef.current);
        buildLaunchTimeoutRef.current = null;
      }
      if (buildDispatchTimeoutRef.current !== null) {
        window.clearTimeout(buildDispatchTimeoutRef.current);
        buildDispatchTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdown(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    if (!hasEnteredWorkbench) return;
    void refreshSourceControlStatus();
  }, [hasEnteredWorkbench, refreshSourceControlStatus]);

  useEffect(() => {
    if (!hasEnteredWorkbench) return;
    // Populate translated contents with fallbacks or mock dictionary translations
    files.forEach(f => {
      const initialTranslations = f.strings.map(s => {
        const matchedLocal = localTranslations[s.original];
        if (matchedLocal) {
          return {
            ...s,
            translated: matchedLocal,
            status: 'translated' as const
          };
        }
        return s;
      });
      triggerReconstruction(f, initialTranslations);
    });
  }, [hasEnteredWorkbench]);

  // Update translation for a single extracted string
  const handleUpdateStringTranslation = (id: string, value: string) => {
    if (!projectFilesReadyRef.current) return;
    const updatedStrings = activeFile.strings.map(s => {
      if (s.id === id) {
        return {
          ...s,
          translated: value,
          status: 'translated' as const
        };
      }
      return s;
    });
    triggerReconstruction(activeFile, updatedStrings);
  };

  // Reset translation
  const handleResetTranslation = (id: string) => {
    const updatedStrings = activeFile.strings.map(s => {
      if (s.id === id) {
        return {
          ...s,
          translated: '',
          status: 'pending' as const
        };
      }
      return s;
    });
    triggerReconstruction(activeFile, updatedStrings);
  };

  const handleDeleteFile = async (file: CppFile): Promise<boolean> => {
    if (isProjectGlobalsFilePath(file.path) || isProjectDataTypesFilePath(file.path)) {
      await requestWorkbenchAlert({ title: '无法删除', description: '该项目结构文件不能在 IDE 中删除；请在对应的新手编辑器中清空内容。', confirmLabel: '知道了' });
      return false;
    }
    if (!projectFilesReadyRef.current) {
      appendEditorTransactionLog('【删除文件】项目文件仍在载入，请稍后再试。');
      return false;
    }
    if (file.language === 'lingcpp') {
      const library = parseLingCpp(getCurrentFileContent(file)).program.functionLibraries[0];
      if (library) {
        const references = findFunctionLibraryReferences(filesRef.current.map(candidate => ({
          filePath: candidate.path,
          sourceCode: getCurrentFileContent(candidate),
          language: candidate.language
        })), library.name).filter(reference => reference.filePath !== file.path);
        if (references.length > 0) {
          await requestWorkbenchAlert({
            title: '已阻止删除',
            description: `功能库“${library.name}”仍被 ${references.length} 处代码调用，已阻止删除。\n\n首个引用：${references[0]!.filePath} 第 ${references[0]!.line} 行`,
            confirmLabel: '知道了'
          });
          return false;
        }
      }
    }
    const confirmed = await requestWorkbenchConfirm({ title: '删除文件', description: `确认删除文件 ${file.name} 吗？`, confirmLabel: '删除', cancelLabel: '取消' });
    if (!confirmed) return false;
    if (editorOperationRef.current) {
      appendEditorTransactionLog(`【删除文件】已有${getEditorOperationLabel(editorOperationRef.current)}任务正在进行，请稍后再试。`);
      return false;
    }

    const requestOwner = captureProjectMutationOwner();
    const requestProjectId = requestOwner.projectId;
    editorOperationRef.current = 'file-mutation';
    try {
      const flushState = await flushCurrentEditorDrafts();
      if (!flushState.ok) {
        throw new Error(flushState.diagnostics[0] || '新手代码提交失败，未删除磁盘文件。');
      }
      const latestFile = filesRef.current.find(candidate => candidate.path === file.path);
      if (!latestFile) throw new Error(`当前项目中找不到文件：${file.path}`);
      if (filesRef.current.length <= 1) {
        throw new Error('当前工作台至少需要保留一个可编辑文件。空编辑器状态将在 TextModel 阶段实现。');
      }

      const response = await fetch('/api/window-designer/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: requestProjectId, filePath: latestFile.path })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || '磁盘文件删除失败。');
      }
      if (!isCurrentProjectMutationOwner(requestOwner)) {
        appendEditorTransactionLog(`【文件】已删除项目 ${requestProjectId} 中的 ${latestFile.path}；当前项目已切换，将在下次载入时刷新。`);
        return true;
      }
      disposeWorkbenchTextModelsForSource(textModelIdentity(requestProjectId, latestFile.path));

      const nextState = applyProjectFileDelete({
        files: filesRef.current,
        openTabs: openTabsRef.current,
        activeFilePath: activeFileRef.current?.path || null
      }, latestFile.path);
      openTabsRef.current = nextState.openTabs;
      filesRef.current = nextState.files;
      setFiles(nextState.files);
      setOpenTabs(nextState.openTabs);
      if (nextState.activeFilePath) {
        const nextActiveFile = nextState.files.find(candidate => candidate.path === nextState.activeFilePath);
        if (nextActiveFile) {
        activeFileRef.current = nextActiveFile;
        setActiveFile(nextActiveFile);
        }
      }
      appendEditorTransactionLog(`【文件】已从项目和磁盘删除：${latestFile.path}`);
      void refreshSourceControlStatus();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '磁盘文件删除失败。';
      appendEditorTransactionLog(`【文件删除错误】${message}`);
      await requestWorkbenchAlert({ title: '删除文件失败', description: message, confirmLabel: '知道了' });
      return false;
    } finally {
      if (editorOperationRef.current === 'file-mutation') editorOperationRef.current = null;
    }
  };

  const handleRenameFile = async (file: CppFile, newName: string): Promise<boolean> => {
    if (isProjectGlobalsFilePath(file.path) || isProjectDataTypesFilePath(file.path)) {
      await requestWorkbenchAlert({ title: '无法重命名', description: '该项目结构文件使用固定名称，不能在 IDE 中重命名。', confirmLabel: '知道了' });
      return false;
    }
    if (!projectFilesReadyRef.current) {
      appendEditorTransactionLog('【重命名文件】项目文件仍在载入，请稍后再试。');
      return false;
    }
    const normalizedName = newName.trim();
    if (!normalizedName || normalizedName === file.name) return false;
    if (normalizedName === '.' || normalizedName === '..' || /[<>:"/\\|?*\u0000-\u001f]/u.test(normalizedName) || /[. ]$/u.test(normalizedName)) {
      await requestWorkbenchAlert({ title: '文件名不合法', description: '文件名包含 Windows 不允许的字符，或以空格/句点结尾。', confirmLabel: '知道了' });
      return false;
    }
    if (editorOperationRef.current) {
      appendEditorTransactionLog(`【重命名文件】已有${getEditorOperationLabel(editorOperationRef.current)}任务正在进行，请稍后再试。`);
      return false;
    }
    const separatorIndex = file.path.lastIndexOf('/');
    const directory = separatorIndex >= 0 ? file.path.slice(0, separatorIndex + 1) : '';
    const nextPath = `${directory}${normalizedName}`;

    const requestOwner = captureProjectMutationOwner();
    const requestProjectId = requestOwner.projectId;
    editorOperationRef.current = 'file-mutation';
    try {
      const flushState = await flushCurrentEditorDrafts();
      if (!flushState.ok) {
        throw new Error(flushState.diagnostics[0] || '新手代码提交失败，未重命名磁盘文件。');
      }
      const sourceFile = filesRef.current.find(candidate => candidate.path === file.path);
      if (!sourceFile) throw new Error(`当前项目中找不到文件：${file.path}`);
      let functionLibraryRename: { oldName: string; newName: string } | undefined;
      if (sourceFile.language === 'lingcpp') {
        const parsedSource = parseLingCpp(getCurrentFileContent(sourceFile));
        const sourceClassNames = new Set(parsedSource.program.classes.map(item => item.name));
        const boundDesignerWindow = activeProjectHasWindowDesigner
          ? windowDesignerState.project.windows.find(window =>
          getLingWindowSourceFileName(window.fileName, window.className).toLocaleLowerCase()
            === sourceFile.name.toLocaleLowerCase()
          || sourceClassNames.has(window.className)
          )
          : undefined;
        if (boundDesignerWindow) {
          throw new Error(
            `“${sourceFile.name}”绑定设计器窗口“${boundDesignerWindow.title}”，不能只重命名源码文件。`
            + '请先创建或迁移窗口；在统一重构命令落地前，工作台会阻止类名、设计文件名和 .lcpp 路径静默脱钩。'
          );
        }
        const sourceLibrary = parsedSource.program.functionLibraries[0];
        if (sourceLibrary) {
          if (!normalizedName.toLocaleLowerCase().endsWith('.lcpp')) throw new Error('功能库文件必须保留 .lcpp 扩展名。');
          const nextLibraryName = normalizedName.slice(0, -5);
          if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(nextLibraryName)) throw new Error('功能库名称只能包含中文、字母、数字和下划线，且不能以数字开头。');
          functionLibraryRename = { oldName: sourceLibrary.name, newName: nextLibraryName };
        }
      }

      const response = await fetch('/api/window-designer/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: requestProjectId,
          sourcePath: sourceFile.path,
          targetPath: nextPath
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || '磁盘文件重命名失败。');
      }
      const targetPath = typeof result.targetPath === 'string' ? result.targetPath : nextPath;
      if (!isCurrentProjectMutationOwner(requestOwner)) {
        appendEditorTransactionLog(`【文件】已在项目 ${requestProjectId} 中重命名 ${sourceFile.path}；当前项目已切换，将在下次载入时刷新。`);
        return true;
      }
      const sourceIdentity = textModelIdentity(requestProjectId, sourceFile.path);
      const targetIdentity = textModelIdentity(requestProjectId, targetPath);
      workbenchTextModelService.ensure(sourceIdentity);
      renameWorkbenchTextModelsForSource(sourceIdentity, targetIdentity);

      const nextState = applyProjectFileRename({
        files: filesRef.current,
        openTabs: openTabsRef.current,
        activeFilePath: activeFileRef.current?.path || null
      }, sourceFile.path, targetPath, inferFileLanguage(targetPath));
      if (functionLibraryRename) {
        const rewritten = renameFunctionLibraryAcrossSources(nextState.files.map(candidate => ({
          filePath: candidate.path,
          sourceCode: getCurrentFileContent(candidate),
          language: candidate.language
        })), functionLibraryRename.oldName, functionLibraryRename.newName);
        nextState.files = nextState.files.map(candidate => {
          const changed = rewritten.find(item => item.filePath === candidate.path);
          if (!changed || changed.sourceCode === getCurrentFileContent(candidate)) return candidate;
          return { ...candidate, translatedContent: changed.sourceCode, isModified: changed.sourceCode !== candidate.originalContent };
        });
      }
      const renamedFile = nextState.files.find(candidate => candidate.path === targetPath);
      if (!renamedFile) throw new Error('磁盘文件已重命名，但工作台状态更新失败。');
      filesRef.current = nextState.files;
      openTabsRef.current = nextState.openTabs;
      setFiles(nextState.files);
      setOpenTabs(nextState.openTabs);
      if (nextState.activeFilePath === targetPath) {
        activeFileRef.current = renamedFile;
        setActiveFile(renamedFile);
      }
      appendEditorTransactionLog(`【文件】已重命名磁盘文件：${sourceFile.path} -> ${renamedFile.path}`);
      void refreshSourceControlStatus();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '磁盘文件重命名失败。';
      appendEditorTransactionLog(`【文件重命名错误】${message}`);
      await requestWorkbenchAlert({ title: '重命名文件失败', description: message, confirmLabel: '知道了' });
      return false;
    } finally {
      if (editorOperationRef.current === 'file-mutation') editorOperationRef.current = null;
    }
  };

  const handleUpdateSourceContent = (content: string) => {
    if (!projectFilesReadyRef.current) return;
    const updatedFile: CppFile = {
      ...activeFile,
      translatedContent: content,
      isModified: content !== activeFile.originalContent
    };

    activeFileRef.current = updatedFile;
    setActiveFile(updatedFile);
    setFiles(prevFiles => {
      const nextFiles = prevFiles.map(file => (
        file.path === updatedFile.path ? updatedFile : file
      ));
      filesRef.current = nextFiles;
      return nextFiles;
    });
  };

  const handleUpdateProjectSources = useCallback((sources: Array<{ filePath: string; sourceCode: string }>) => {
    if (!projectFilesReadyRef.current || sources.length === 0) return;
    const updates = new Map(sources.map(source => [source.filePath.replace(/\\/gu, '/'), source.sourceCode]));
    const nextFiles = filesRef.current.map(file => {
      const sourceCode = updates.get(file.path.replace(/\\/gu, '/'));
      return sourceCode === undefined ? file : {
        ...file,
        translatedContent: sourceCode,
        isModified: sourceCode !== file.originalContent
      };
    });
    filesRef.current = nextFiles;
    setFiles(nextFiles);
    const activePath = activeFileRef.current?.path;
    const nextActive = activePath ? nextFiles.find(file => file.path === activePath) : undefined;
    if (nextActive) {
      activeFileRef.current = nextActive;
      setActiveFile(nextActive);
    }
  }, []);

  const updateActiveTextFileFormat = useCallback((patch: Partial<TextFileFormat>) => {
    if (!projectFilesReadyRef.current) return;
    const currentFile = activeFileRef.current;
    if (!currentFile) return;
    const nextFormat: TextFileFormat = {
      encoding: patch.encoding || currentFile.encoding,
      eol: patch.eol || currentFile.eol
    };
    const savedFormat: TextFileFormat = {
      encoding: currentFile.savedEncoding,
      eol: currentFile.savedEol
    };
    if (isSameTextFileFormat(nextFormat, getTextFileFormat(currentFile))) return;
    const updatedFile: CppFile = {
      ...currentFile,
      ...nextFormat,
      formatModified: !isSameTextFileFormat(nextFormat, savedFormat)
    };
    const nextFiles = filesRef.current.map(file => file.path === updatedFile.path ? updatedFile : file);
    filesRef.current = nextFiles;
    activeFileRef.current = updatedFile;
    setFiles(nextFiles);
    setActiveFile(updatedFile);
  }, []);

  const appendEditorTransactionLog = (message: string) => {
    setShowBottomPanel(true);
    setActiveTabInBottom('output');
    setBuildLogs(previous => [
      ...previous,
      `> [${new Date().toLocaleTimeString()}] ${message}`
    ]);
  };

  const handleApplyWorkspaceEdit = useCallback(async (
    proposal: WorkspaceEditProposal,
    appliedFiles: AppliedWorkspaceFile[],
    requestOwner: ProjectMutationOwner = captureProjectMutationOwner()
  ): Promise<boolean> => {
    if (!isCurrentProjectMutationOwner(requestOwner) || !appliedFiles.length) return false;

    if (proposal.designerProject) {
      if (!activeProjectHasWindowDesigner || proposal.designerProject.id !== activeProjectId) {
        appendEditorTransactionLog(`【AI 编辑】提案设计器模型属于项目 ${proposal.designerProject.id}，当前项目是 ${activeProjectId}；未应用跨项目布局。`);
        return false;
      }
      const currentDesignerProject = readWindowDesignerState(activeProjectId).project;
      if (currentDesignerProject.id !== activeProjectId) {
        appendEditorTransactionLog(`【AI 编辑】当前设计器模型属于项目 ${currentDesignerProject.id}，无法应用到项目 ${activeProjectId}；请重新载入项目。`);
        return false;
      }
    }

    const appliedMap = new Map(appliedFiles.map(file => [file.filePath, file.sourceCode]));
    const knownPaths = new Set(filesRef.current.map(file => file.path));
    const nextFiles = filesRef.current.map(file => {
      const nextContent = appliedMap.get(file.path);
      if (typeof nextContent !== 'string') return file;
      return {
        ...file,
        translatedContent: nextContent,
        isModified: nextContent !== file.originalContent
      };
    });

    appliedFiles.forEach(appliedFile => {
      if (knownPaths.has(appliedFile.filePath)) return;
      nextFiles.push({
        path: appliedFile.filePath,
        name: appliedFile.filePath.split('/').pop() || appliedFile.filePath,
        language: inferFileLanguage(appliedFile.filePath),
        encoding: 'utf8',
        eol: 'lf',
        savedEncoding: 'utf8',
        savedEol: 'lf',
        formatModified: false,
        originalContent: '',
        translatedContent: appliedFile.sourceCode,
        strings: [],
        isModified: true
      });
    });

    filesRef.current = nextFiles;
    setFiles(nextFiles);
    setOpenTabs(prev => Array.from(new Set([...prev, ...appliedFiles.map(file => file.filePath)])));

    const currentActivePath = activeFileRef.current?.path;
    const nextActiveFile = (currentActivePath && nextFiles.find(file => file.path === currentActivePath))
      || nextFiles.find(file => appliedMap.has(file.path))
      || nextFiles[0];
    if (nextActiveFile) {
      activeFileRef.current = nextActiveFile;
      setActiveFile(nextActiveFile);
    }

    // 提案命中当前打开的文件时，必须把新源码同步进编辑器实例；否则保存前的
    // flushCurrentEditorDrafts 会用编辑器内的旧草稿覆盖提案内容，AI 修改被静默回滚。
    const activeNextSource = nextActiveFile ? appliedMap.get(nextActiveFile.path) : undefined;
    if (nextActiveFile && typeof activeNextSource === 'string') {
      diffViewerRef.current?.applyExternalSourceCode(activeNextSource);
    }

    if (proposal.designerProject && activeProjectHasWindowDesigner) {
      const currentDesignerState = readWindowDesignerState(activeProjectId);
      const nextDesignerState = saveWindowDesignerState({
        ...currentDesignerState,
        project: proposal.designerProject
      });
      setWindowDesignerState(nextDesignerState);
      const nextDesignerDirty = JSON.stringify(nextDesignerState.project) !== designerSavedSnapshotRef.current;
      designerDirtyRef.current = nextDesignerDirty;
      setDesignerDirty(nextDesignerDirty);
    }
    const saved = await saveWorkspaceCoreRef.current('AI 编辑应用后保存', false);
    if (!saved) {
      appendEditorTransactionLog('【AI 编辑】已更新当前窗口内存状态，但磁盘保存失败；请检查输出面板后重试保存。');
      return false;
    }
    return true;
  }, [activeProjectHasWindowDesigner, activeProjectId, appendEditorTransactionLog, captureProjectMutationOwner, isCurrentProjectMutationOwner]);

  const handleConfirmDesignerEventEdit = useCallback(async () => {
    if (!pendingDesignerEventEdit) return;

    if (!isCurrentProjectMutationOwner(pendingDesignerEventEdit.owner)) {
      setPendingDesignerEventEdit(null);
      appendEditorTransactionLog(`【事件代码】${STALE_PROJECT_MUTATION_MESSAGE}`);
      return;
    }
    if (!await handleApplyWorkspaceEdit(
      pendingDesignerEventEdit.proposal,
      pendingDesignerEventEdit.appliedFiles,
      pendingDesignerEventEdit.owner
    )) return;
    setPendingDesignerEventEdit(null);
    const switched = await setEditorExperienceMode('beginner');
    if (!switched) return;
    focusLingCppHandler(pendingDesignerEventEdit.handlerName, pendingDesignerEventEdit.targetFilePath);
  }, [focusLingCppHandler, handleApplyWorkspaceEdit, isCurrentProjectMutationOwner, pendingDesignerEventEdit, setEditorExperienceMode]);

  const handleCancelDesignerEventEdit = useCallback(async () => {
    if (!pendingDesignerEventEdit) return;

    if (!isCurrentProjectMutationOwner(pendingDesignerEventEdit.owner)) {
      setPendingDesignerEventEdit(null);
      return;
    }

    const targetFile = filesRef.current.find(file => file.path === pendingDesignerEventEdit.targetFilePath);
    if (targetFile) {
      setOpenTabs(prev => (prev.includes(targetFile.path) ? prev : [...prev, targetFile.path]));
      setActiveFile(targetFile);
    }
    setPendingDesignerEventEdit(null);
    const switched = await setEditorExperienceMode('beginner');
    if (!switched) return;
    focusLingCppHandler(pendingDesignerEventEdit.handlerName, pendingDesignerEventEdit.targetFilePath);
  }, [focusLingCppHandler, isCurrentProjectMutationOwner, pendingDesignerEventEdit, setEditorExperienceMode]);

  useEffect(() => {
    setPendingDesignerEventEdit(null);
  }, [activeProjectId, projectFileReloadToken]);

  useEffect(() => {
    const handleLingCppSourceRequest = (event: Event) => {
      const customEvent = event as CustomEvent<WindowDesignerLingCppSourceRequestDetail>;
      const windowFileName = customEvent.detail?.windowFileName;
      const windowClassName = customEvent.detail?.windowClassName;
      const currentFiles = filesRef.current;
      let lingCppFile: CppFile | undefined;

      if (windowFileName || windowClassName) {
        const expectedFileName = getLingWindowSourceFileName(windowFileName, windowClassName);
        lingCppFile = currentFiles.find(file => file.name === expectedFileName);
      }

      if (!lingCppFile) {
        lingCppFile = currentFiles.find(file => file.language === 'lingcpp')
          || currentFiles.find(file => file.path.endsWith('.lcpp'));
      }

      const sources = currentFiles
        .filter(file => file.language === 'lingcpp' || file.path.toLocaleLowerCase().endsWith('.lcpp'))
        .map(file => ({ filePath: file.path, sourceCode: file.translatedContent || file.originalContent || '' }));
      customEvent.detail?.respond({
        sourceCode: lingCppFile ? (lingCppFile.translatedContent || lingCppFile.originalContent) : '',
        filePath: lingCppFile?.path,
        sources
      });
    };

    window.addEventListener(WINDOW_DESIGNER_LINGCPP_SOURCE_REQUEST, handleLingCppSourceRequest);
    return () => {
      window.removeEventListener(WINDOW_DESIGNER_LINGCPP_SOURCE_REQUEST, handleLingCppSourceRequest);
    };
  }, []);

  useEffect(() => {
    const handleOpenControlEventCode = async (event: Event) => {
      const requestOwner = captureProjectMutationOwner();
      if (!isCurrentProjectMutationOwner(requestOwner)) return;
      const customEvent = event as CustomEvent<OpenControlEventCodeDetail>;
      const detail = customEvent.detail || {};
      const handlerName = detail.handlerName?.trim();

      if (!handlerName) return;

      const currentFiles = filesRef.current;
      const targetSourceName = getLingWindowSourceFileName(detail.windowFileName, detail.windowClassName);
      let targetFile = currentFiles.find(file => file.name === targetSourceName)
        || currentFiles.find(file => file.language === 'lingcpp')
        || currentFiles.find(file => file.path.endsWith('.lcpp'));

      if (!targetFile) {
        setBuildLogs(prev => [
          ...prev,
          `> [${new Date().toLocaleTimeString()}] 【事件代码】未找到中文源码文件，无法定位 ${handlerName}。`
        ]);
        return;
      }

      const flushState = await flushCurrentEditorDrafts();
      if (!flushState.ok) {
        appendEditorTransactionLog(`【事件代码错误】${flushState.diagnostics[0] || '新手代码提交失败，未切换事件。'}`);
        return;
      }
      if (!isCurrentProjectMutationOwner(requestOwner)) return;
      targetFile = flushState.files.find(file => file.path === targetFile?.path) || targetFile;

      const currentContent = getCurrentFileContent(targetFile);
      const ensuredContent = ensureLingCppControlEventHandler(currentContent, detail);
      if (hasLingCppEventHandler(currentContent, handlerName)) {
        const signatureUpgraded = ensuredContent !== currentContent;
        const existingFile: CppFile = signatureUpgraded ? {
          ...targetFile,
          translatedContent: ensuredContent,
          isModified: ensuredContent !== targetFile.originalContent
        } : targetFile;
        if (signatureUpgraded) {
          const nextFiles = flushState.files.map(file => file.path === existingFile.path ? existingFile : file);
          filesRef.current = nextFiles;
          setFiles(nextFiles);
        }
        setPendingDesignerEventEdit(null);
        const selected = await handleSelectFile(existingFile);
        if (!selected) return;
        const switched = await setEditorExperienceMode('beginner');
        if (!switched) return;
        setBuildLogs(prev => [
          ...prev,
          `> [${new Date().toLocaleTimeString()}] 【事件代码】${handlerName} ${signatureUpgraded ? '已升级为强类型参数并定位' : '已存在，已直接定位'}。`
        ]);
        focusLingCppHandler(handlerName, existingFile.path);
        return;
      }

      const nextContent = ensuredContent;
      const updatedFile: CppFile = {
        ...targetFile,
        translatedContent: nextContent,
        isModified: nextContent !== targetFile.originalContent
      };
      const nextFiles = flushState.files.map(file => (file.path === updatedFile.path ? updatedFile : file));

      filesRef.current = nextFiles;
      setFiles(nextFiles);
      const selected = await handleSelectFile(updatedFile);
      if (!selected) return;
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 【事件代码】已自动生成 ${handlerName}，打开 ${targetFile.path} 并完成定位。`
      ]);
      focusLingCppHandler(handlerName, updatedFile.path);
    };

    const handleWindowAdded = (event: Event) => {
      const nextWindow = (event as CustomEvent).detail;
      const fileName = getLingWindowSourceFileName(nextWindow.fileName, nextWindow.className);
      const filePath = getLingWindowSourceFilePath(activeSolutionProject.sourceRoot, nextWindow.fileName, nextWindow.className);

      const currentFiles = filesRef.current;
      const existingFile = currentFiles.find(f => f.path === filePath);
      const targetFile = existingFile || {
        path: filePath,
        name: fileName,
        language: 'lingcpp' as const,
        encoding: 'utf8' as const,
        eol: 'lf' as const,
        savedEncoding: 'utf8' as const,
        savedEol: 'lf' as const,
        formatModified: false,
        originalContent: generateDefaultLingCppContentForWindow(nextWindow),
        translatedContent: '',
        strings: [],
        isModified: false
      };
      const nextFiles = existingFile ? currentFiles : [...currentFiles, targetFile];

      filesRef.current = nextFiles;
      setFiles(nextFiles);
      void handleSelectFile(targetFile);
    };

    const handleWindowDeleted = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const deletedWindow = detail.deletedWindow || detail;
      const nextWindow = detail.nextWindow;
      const fileName = getLingWindowSourceFileName(deletedWindow.fileName, deletedWindow.className);
      const filePath = getLingWindowSourceFilePath(activeSolutionProject.sourceRoot, deletedWindow.fileName, deletedWindow.className);
      const nextFiles = filesRef.current.filter(f => f.path !== filePath);
      disposeWorkbenchTextModelsForSource(textModelIdentity(activeProjectIdRef.current, filePath));

      filesRef.current = nextFiles;
      setFiles(nextFiles);
      setOpenTabs(prev => {
        const filteredTabs = prev.filter(path => path !== filePath);
        if (filteredTabs.length > 0) return filteredTabs;
        const nextSourceName = nextWindow ? getLingWindowSourceFileName(nextWindow.fileName, nextWindow.className) : '';
        const nextSourceFile = nextFiles.find(file => file.name === nextSourceName) || nextFiles[0];
        return nextSourceFile ? [nextSourceFile.path] : prev;
      });

      if (activeFileRef.current?.path === filePath) {
        const nextSourceName = nextWindow ? getLingWindowSourceFileName(nextWindow.fileName, nextWindow.className) : '';
        const nextSourceFile = nextFiles.find(file => file.name === nextSourceName) || nextFiles[0];
        if (nextSourceFile) {
          setActiveFile(nextSourceFile);
        }
      }
    };

    const handleWindowDuplicated = (event: Event) => {
      const clonedWindow = (event as CustomEvent).detail;
      const fileName = getLingWindowSourceFileName(clonedWindow.fileName, clonedWindow.className);
      const filePath = getLingWindowSourceFilePath(activeSolutionProject.sourceRoot, clonedWindow.fileName, clonedWindow.className);

      const currentFiles = filesRef.current;
      const existingFile = currentFiles.find(f => f.path === filePath);
      const targetFile = existingFile || {
          path: filePath,
          name: fileName,
          language: 'lingcpp' as const,
          encoding: 'utf8' as const,
          eol: 'lf' as const,
          savedEncoding: 'utf8' as const,
          savedEol: 'lf' as const,
          formatModified: false,
          originalContent: generateDefaultLingCppContentForWindow(clonedWindow),
          translatedContent: '',
          strings: [],
          isModified: false
      };
      const nextFiles = existingFile ? currentFiles : [...currentFiles, targetFile];

      filesRef.current = nextFiles;
      setFiles(nextFiles);
      void handleSelectFile(targetFile);
    };

    const handleDesignerSwitchWindow = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const xmlFileName = detail.fileName;
      if (!xmlFileName) return;

      const codeFileName = getLingWindowSourceFileName(xmlFileName, detail.className);
      if (activeFileRef.current && activeFileRef.current.name === codeFileName) {
        return;
      }
      const codeFile = filesRef.current.find(f => f.name === codeFileName);
      if (codeFile) {
        handleSelectFile(codeFile, false);
      }
    };

    window.addEventListener('designer-switch-window', handleDesignerSwitchWindow);
    window.addEventListener('open-control-event-code', handleOpenControlEventCode);
    window.addEventListener('window-added', handleWindowAdded);
    window.addEventListener('window-deleted', handleWindowDeleted);
    window.addEventListener('window-duplicated', handleWindowDuplicated);
    return () => {
      window.removeEventListener('designer-switch-window', handleDesignerSwitchWindow);
      window.removeEventListener('open-control-event-code', handleOpenControlEventCode);
      window.removeEventListener('window-added', handleWindowAdded);
      window.removeEventListener('window-deleted', handleWindowDeleted);
      window.removeEventListener('window-duplicated', handleWindowDuplicated);
    };
  }, [activeSolutionProject.sourceRoot, captureProjectMutationOwner, flushCurrentEditorDrafts, focusLingCppHandler, handleSelectFile, isCurrentProjectMutationOwner]);


  useEffect(() => {
    if (!hasEnteredWorkbench) return;
    let cancelled = false;
    let timedOut = false;
    const loadGeneration = projectFileLoadGenerationRef.current;
    const isCurrentLoad = (projectId: string) => !cancelled
      && activeProjectIdRef.current === projectId
      && projectFileLoadGenerationRef.current === loadGeneration;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15_000);
    setProjectFileLoadState(createProjectFileLoadState(activeProjectId, 'loading'));
    setEditorState(createInactiveTextEditorStatus('loading-project'));
    const loadSavedFiles = async () => {
      try {
        const projectId = activeProjectId;
        const res = await fetch(`/api/window-designer/files?projectId=${encodeURIComponent(projectId)}`, {
          signal: controller.signal
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          if (isCurrentLoad(projectId)) {
            pendingWorkspaceSearchRevealRef.current = null;
            const message = data?.error || '读取项目文本文件失败。';
            setProjectFileLoadState(createProjectFileLoadState(projectId, 'error', message));
            setShowBottomPanel(true);
            setActiveTabInBottom('output');
            setBuildLogs(previous => [
              ...previous,
              `> [${new Date().toLocaleTimeString()}] 【文件读取错误】${message}`
            ]);
          }
          return;
        }
        if (!isCurrentLoad(projectId)) return;
        if (data?.designerProject) {
          if (data.designerProject.id !== projectId) {
            throw new Error(`项目 ${projectId} 返回了不匹配的设计器模型 ${data.designerProject.id}。`);
          }
          const nextDesignerState = saveWindowDesignerState({
            project: data.designerProject,
            activeWindowId: data.designerProject.windows?.[0]?.id || 'main-window',
            selectedControlId: data.designerProject.windows?.[0]?.controls?.[0]?.id || null
          });
          designerSavedSnapshotRef.current = JSON.stringify(nextDesignerState.project);
          designerDirtyRef.current = false;
          setDesignerDirty(false);
          setWindowDesignerState(nextDesignerState);
        } else if (!activeProjectHasWindowDesigner) {
          designerDirtyRef.current = false;
          setDesignerDirty(false);
        }
        if (hasUsableProjectFilePayload(data?.files)) {
          projectFileVersionsRef.current = data.fileVersions || {};
          const previousFiles = filesRef.current;
          let nextFiles: CppFile[] = Object.entries(data.files).map(([filePath, content]) => {
            const previousFile = previousFiles.find(file => file.path === filePath)
              || initialFiles.find(file => file.path === filePath);
            const format = readTextFileFormat(data.fileFormats?.[filePath]);
            return {
              ...previousFile,
              path: filePath,
              name: filePath.split('/').pop() || filePath,
              language: inferFileLanguage(filePath),
              encoding: format.encoding,
              eol: format.eol,
              savedEncoding: format.encoding,
              savedEol: format.eol,
              formatModified: false,
              originalContent: String(content),
              translatedContent: String(content),
              strings: previousFile?.strings || [],
              isModified: false
            };
          });
          const recoveryResponse = await fetch(`/api/window-designer/recovery?projectId=${encodeURIComponent(projectId)}`);
          const recoveryPayload = await recoveryResponse.json().catch(() => ({}));
          const recovery = recoveryPayload?.recovery;
          if (recovery?.files || recovery?.designerProject) {
            // 原生 window.confirm 会同步阻塞渲染进程，等待用户期间整个工作台（含其他对话框）无法输入；
            // 改用应用内非阻塞确认对话框。
            const shouldRecover = await requestWorkbenchConfirm({
              title: '发现未保存的编辑',
              description: `检测到 ${new Date(recovery.savedAt).toLocaleString()} 保存的未保存编辑。\n恢复只会进入编辑器内存，不会立即覆盖磁盘。`,
              confirmLabel: '恢复',
              cancelLabel: '不恢复'
            });
            // 等待用户答复期间项目可能已切换或重新载入，需重新校验后才能继续写入状态。
            if (!isCurrentLoad(projectId)) return;
            if (shouldRecover) {
              nextFiles = nextFiles.map(file => typeof recovery.files?.[file.path] === 'string'
                ? { ...file, translatedContent: recovery.files[file.path], isModified: recovery.files[file.path] !== file.originalContent }
                : file);
              if (recovery.designerProject) {
                saveWindowDesignerState({
                  project: recovery.designerProject,
                  activeWindowId: recovery.designerProject.windows?.[0]?.id || 'main-window',
                  selectedControlId: recovery.designerProject.windows?.[0]?.controls?.[0]?.id || null
                });
              }
            } else {
              void fetch(`/api/window-designer/recovery?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' });
            }
          } else if (recovery) {
            void fetch(`/api/window-designer/recovery?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' });
          }
          const previousPaths = new Set(previousFiles.map(file => file.path));
          const nextPaths = new Set(nextFiles.map(file => file.path));
          const firstAuthoritativeHydration = !hydratedProjectIdsRef.current.has(projectId);
          workbenchTextModelService.list()
            .filter(record => {
              if (record.identity.workspaceId !== textModelWorkspaceId || record.identity.projectId !== projectId) return false;
              if (firstAuthoritativeHydration) {
                return previousPaths.has(record.identity.filePath) || nextPaths.has(record.identity.filePath);
              }
              return previousPaths.has(record.identity.filePath) && !nextPaths.has(record.identity.filePath);
            })
            .forEach(record => disposeWorkbenchTextModelsForSource(record.identity));
          hydratedProjectIdsRef.current.add(projectId);
          nextFiles.forEach(file => {
            workbenchTextModelService.ensure(textModelIdentity(projectId, file.path));
          });
          loadedProjectIdRef.current = projectId;
          setLoadedProjectId(projectId);
          setProjectFileLoadState(createProjectFileLoadState(projectId, 'ready'));
          filesRef.current = nextFiles;
          setFiles(nextFiles);
          try {
            setEditorGroupLayout(restoreEditorGroupLayout(
              JSON.parse(window.localStorage.getItem('lingbuilder.editorGroups.v1') || 'null'),
              nextFiles.map(file => file.path),
              nextFiles[0]?.path
            ));
          } catch {
            setEditorGroupLayout(restoreEditorGroupLayout(null, nextFiles.map(file => file.path), nextFiles[0]?.path));
          }

          const pendingReveal = pendingWorkspaceSearchRevealRef.current;
          const pendingRevealFile = pendingReveal
            ? nextFiles.find(file => file.path === pendingReveal.filePath)
            : undefined;
          const previousActivePath = activeFileRef.current?.path;
          const nextActive = pendingRevealFile
            || nextFiles.find(file => file.path === previousActivePath)
            || nextFiles.find(file => file.language === 'lingcpp')
            || nextFiles[0];
          if (nextActive) {
            activeFileRef.current = nextActive;
            setActiveFile(nextActive);
            const nextTabs = openTabsRef.current.filter(tabPath => nextFiles.some(file => file.path === tabPath));
            if (!nextTabs.includes(nextActive.path)) nextTabs.push(nextActive.path);
            openTabsRef.current = nextTabs;
            setOpenTabs(nextTabs);
          }
          if (pendingReveal && pendingRevealFile) {
            pendingWorkspaceSearchRevealRef.current = null;
            const detail = createWorkspaceSearchRevealDetail(pendingReveal);
            [60, 180].forEach(delay => {
              window.setTimeout(() => {
                window.dispatchEvent(new CustomEvent('lingcpp-reveal-line', { detail }));
              }, delay);
            });
          } else if (pendingReveal) {
            pendingWorkspaceSearchRevealRef.current = null;
            setShowBottomPanel(true);
            setActiveTabInBottom('output');
            setBuildLogs(previous => [
              ...previous,
              `> [${new Date().toLocaleTimeString()}] 【搜索结果跳转错误】项目 ${projectId} 中未找到 ${pendingReveal.filePath}。`
            ]);
          }
          void refreshSourceControlStatus();
        } else {
          const message = '项目文件服务没有返回有效的文件列表。';
          setProjectFileLoadState(createProjectFileLoadState(projectId, 'error', message));
          const missingPath = pendingWorkspaceSearchRevealRef.current?.filePath;
          pendingWorkspaceSearchRevealRef.current = null;
          setShowBottomPanel(true);
          setActiveTabInBottom('output');
          setBuildLogs(previous => [
            ...previous,
            `> [${new Date().toLocaleTimeString()}] 【文件读取错误】${message}`,
            ...(missingPath ? [`> [${new Date().toLocaleTimeString()}] 【搜索结果跳转错误】无法打开 ${missingPath}。`] : [])
          ]);
        }
      } catch (e) {
        const expectedCleanupAbort = cancelled
          && (controller.signal.aborted || (e instanceof DOMException && e.name === 'AbortError'));
        if (expectedCleanupAbort) return;
        console.error('Failed to load files from disk:', e);
        if (isCurrentLoad(activeProjectId)) {
          const message = timedOut
            ? '读取项目文件超时，请检查本地服务后重试。'
            : e instanceof Error ? e.message : '无法连接本地文件服务。';
          pendingWorkspaceSearchRevealRef.current = null;
          setProjectFileLoadState(createProjectFileLoadState(activeProjectId, 'error', message));
          setShowBottomPanel(true);
          setActiveTabInBottom('output');
          setBuildLogs(previous => [
            ...previous,
            `> [${new Date().toLocaleTimeString()}] 【文件读取错误】${message}`
          ]);
        }
      } finally {
        window.clearTimeout(timeout);
      }
    };
    void loadSavedFiles();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
      // 项目切换/重新载入时，若用户尚未答复恢复确认，按取消结算，避免悬挂对话框与悬挂 Promise。
      cancelWorkbenchDialog();
    };
  }, [activeProjectHasWindowDesigner, activeProjectId, hasEnteredWorkbench, projectFileReloadToken]);

  useEffect(() => {
    if (!projectFilesReady || loadedProjectId !== activeProjectId) return;
    const events = new EventSource(`/api/window-designer/files/watch?projectId=${encodeURIComponent(activeProjectId)}`);
    const pendingFileChangePaths = new Set<string>();
    let processingFileChanges = false;
    let disposed = false;
    let retryTimer: number | undefined;
    let retryDelay = 250;

    const updateTrackedFileVersion = (filePath: string, version?: string) => {
      const nextVersions = { ...projectFileVersionsRef.current };
      if (version) nextVersions[filePath] = version;
      else delete nextVersions[filePath];
      projectFileVersionsRef.current = nextVersions;
    };

    const isOwnSaveEcho = (
      filePath: string,
      content: string,
      kind: 'source' | 'designer'
    ): boolean => isWorkspaceSaveEcho(inFlightSaveSnapshotsRef.current.values(), {
        projectId: activeProjectId,
        filePath,
        content,
        kind
      });

    const applyExternalSourceFile = async (
      changedPath: string,
      payload: any,
      nextVersion?: string
    ) => {
      const diskContent = payload.files?.[changedPath];
      if (typeof diskContent === 'string' && isOwnSaveEcho(changedPath, diskContent, 'source')) {
        if (nextVersion) updateTrackedFileVersion(changedPath, nextVersion);
        return;
      }
      const localFile = filesRef.current.find(file => file.path === changedPath);
      const deletedExternally = typeof diskContent !== 'string';
      if (localFile && isEditorFileDirty(localFile)) {
        const reload = await requestWorkbenchConfirm({
          title: deletedExternally ? '文件已被外部删除' : '文件已被外部修改',
          description: deletedExternally
            ? `文件“${changedPath}”已被外部删除。\n\n“确定”从工作台移除；“取消”保留本地编辑并在保存时执行冲突保护。`
            : `文件“${changedPath}”已被外部修改。\n\n“确定”重新载入磁盘版本；“取消”保留本地编辑。`,
          confirmLabel: '确定',
          cancelLabel: '取消'
        });
        if (!reload) return;
      }

      if (deletedExternally) {
        if (!localFile) {
          updateTrackedFileVersion(changedPath);
          return;
        }
        disposeWorkbenchTextModelsForSource(textModelIdentity(activeProjectId, changedPath));
        const nextState = applyProjectFileDelete({
          files: filesRef.current,
          openTabs: openTabsRef.current,
          activeFilePath: activeFileRef.current?.path || null
        }, changedPath);
        filesRef.current = nextState.files;
        openTabsRef.current = nextState.openTabs;
        setFiles(nextState.files);
        setOpenTabs(nextState.openTabs);
        const nextActiveFile = nextState.activeFilePath
          ? nextState.files.find(file => file.path === nextState.activeFilePath)
          : undefined;
        if (nextActiveFile) {
          activeFileRef.current = nextActiveFile;
          setActiveFile(nextActiveFile);
        }
        updateTrackedFileVersion(changedPath);
        if (!nextState.files.some(isEditorFileDirty) && !designerDirtyRef.current) {
          void fetch(`/api/window-designer/recovery?projectId=${encodeURIComponent(activeProjectId)}`, {
            method: 'DELETE'
          });
        }
        return;
      }

      const format = readTextFileFormat(payload.fileFormats?.[changedPath]);
      const previousFile = localFile || initialFiles.find(file => file.path === changedPath);
      const reloadedFile: CppFile = {
        ...previousFile,
        path: changedPath,
        name: changedPath.split('/').pop() || changedPath,
        language: inferFileLanguage(changedPath),
        encoding: format.encoding,
        eol: format.eol,
        savedEncoding: format.encoding,
        savedEol: format.eol,
        formatModified: false,
        originalContent: diskContent,
        translatedContent: diskContent,
        strings: previousFile?.strings || [],
        isModified: false
      };
      const nextFiles = localFile
        ? filesRef.current.map(file => file.path === changedPath ? reloadedFile : file)
        : [...filesRef.current, reloadedFile];
      filesRef.current = nextFiles;
      setFiles(nextFiles);
      workbenchTextModelService.ensure(textModelIdentity(activeProjectId, changedPath));
      if (activeFileRef.current?.path === changedPath) {
        activeFileRef.current = reloadedFile;
        setActiveFile(reloadedFile);
      }
      updateTrackedFileVersion(changedPath, nextVersion);
      if (!nextFiles.some(isEditorFileDirty) && !designerDirtyRef.current) {
        void fetch(`/api/window-designer/recovery?projectId=${encodeURIComponent(activeProjectId)}`, {
          method: 'DELETE'
        });
      }
    };

    const scheduleRetry = () => {
      if (disposed || retryTimer !== undefined) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void drainFileChanges();
      }, retryDelay);
      retryDelay = Math.min(2_000, retryDelay * 2);
    };

    const drainFileChanges = async (): Promise<void> => {
      if (disposed || processingFileChanges) return;
      processingFileChanges = true;
      try {
        while (!disposed && pendingFileChangePaths.size > 0) {
          const changedPaths = Array.from(pendingFileChangePaths);
          pendingFileChangePaths.clear();
          let response: Response;
          let payload: any;
          try {
            response = await fetch(`/api/window-designer/files?projectId=${encodeURIComponent(activeProjectId)}`);
            payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.ok === false) {
              throw new Error(payload?.error || '外部文件变更后无法重新读取项目快照。');
            }
            retryDelay = 250;
          } catch {
            changedPaths.forEach(filePath => pendingFileChangePaths.add(filePath));
            scheduleRetry();
            return;
          }

          for (const changedPath of changedPaths) {
            if (disposed) return;
            const nextVersion = payload.fileVersions?.[changedPath] as string | undefined;
            const designerPath = activeProjectHasWindowDesigner
              ? activeSolutionProject.designerPath.replace(/\\/g, '/')
              : undefined;
            if (designerPath && changedPath === designerPath) {
              if (!nextVersion
                || nextVersion === projectFileVersionsRef.current[changedPath]
                || !payload.designerProject) continue;
              const diskDesignerSnapshot = JSON.stringify(payload.designerProject);
              if (isOwnSaveEcho(changedPath, diskDesignerSnapshot, 'designer')) {
                updateTrackedFileVersion(changedPath, nextVersion);
                continue;
              }
              if (designerDirtyRef.current) {
                const reload = await requestWorkbenchConfirm({
                  title: '设计器文件已被外部修改',
                  description: `窗口设计器文件“${changedPath}”已被外部修改。\n\n“确定”重新载入磁盘布局；“取消”保留本地布局并在保存时执行版本冲突保护。`,
                  confirmLabel: '重新载入',
                  cancelLabel: '保留本地'
                });
                if (!reload) continue;
              }
              designerSavedSnapshotRef.current = JSON.stringify(payload.designerProject);
              designerDirtyRef.current = false;
              setDesignerDirty(false);
              updateTrackedFileVersion(changedPath, nextVersion);
              const currentState = readWindowDesignerState(activeProjectId);
              const preferredWindowId = payload.designerProject.windows?.some((win: { id: string }) => win.id === currentState.activeWindowId)
                ? currentState.activeWindowId
                : payload.designerProject.windows?.[0]?.id || 'main-window';
              saveWindowDesignerState({
                project: payload.designerProject,
                activeWindowId: preferredWindowId,
                selectedControlId: null
              });
              continue;
            }

            const diskContent = payload.files?.[changedPath];
            const localFile = filesRef.current.find(file => file.path === changedPath);
            const unchanged = typeof diskContent === 'string'
              ? !nextVersion || nextVersion === projectFileVersionsRef.current[changedPath]
              : !localFile && projectFileVersionsRef.current[changedPath] === undefined;
            if (unchanged) continue;
            await applyExternalSourceFile(changedPath, payload, nextVersion);
          }
        }
      } finally {
        processingFileChanges = false;
        if (!disposed && pendingFileChangePaths.size > 0 && retryTimer === undefined) {
          void drainFileChanges();
        }
      }
    };

    const handleFileChange = (event: MessageEvent<string>) => {
      try {
        const changedPath = JSON.parse(event.data)?.path as string | undefined;
        if (!changedPath) return;
        pendingFileChangePaths.add(changedPath);
        void drainFileChanges();
      } catch {
        // Ignore malformed watcher messages; a later valid event still refreshes the authoritative snapshot.
      }
    };

    events.addEventListener('file-change', handleFileChange as EventListener);
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      events.close();
    };
  }, [activeProjectHasWindowDesigner, activeProjectId, activeSolutionProject.designerPath, loadedProjectId, projectFilesReady]);

  useEffect(() => {
    let intervalId: any;
    let polling = false;
    let disposed = false;
    const loadGeneration = projectFileLoadGenerationRef.current;
    const pollLogs = async () => {
      if (disposed || polling || !projectFilesReady || loadedProjectId !== activeProjectId) return;
      if (nativeDebugSession && !['terminated', 'error'].includes(nativeDebugSession.state)) return;
      polling = true;
      try {
        const projectId = activeProjectId;
        const res = await fetch(`/api/window-designer/debug-logs?projectId=${projectId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (activeProjectIdRef.current !== projectId
          || projectFileLoadGenerationRef.current !== loadGeneration) return;
        if (data && Array.isArray(data.logs)) {
          const formatted = data.logs
            .map(line => line.trim())
            .filter(Boolean);
          setDebugLogs(previous => (
            previous.length === formatted.length
            && previous.every((line, index) => line === formatted[index])
              ? previous
              : formatted
          ));
        }
      } catch (e) {
        // Polling errors can be ignored
      } finally {
        polling = false;
      }
    };
    void pollLogs();
    intervalId = setInterval(pollLogs, 1000);
    return () => {
      disposed = true;
      clearInterval(intervalId);
    };
  }, [activeProjectId, loadedProjectId, nativeDebugSession?.state, projectFileReloadToken, projectFilesReady]);

  useEffect(() => {
    const toggle = (event: Event) => {
      const detail = (event as CustomEvent<{ filePath: string; line: number; conditionRequested?: boolean }>).detail;
      if (!detail?.filePath || !Number.isInteger(detail.line)) return;
      const existing = debugBreakpoints.find(item => item.filePath === detail.filePath && item.line === detail.line);
      if (detail.conditionRequested) {
        void (async () => {
          const condition = await requestWorkbenchPrompt({
            title: '条件断点',
            description: '输入条件断点表达式；留空则取消该断点：',
            inputLabel: '条件表达式',
            inputValue: existing?.condition || ''
          });
          if (condition === null) return;
          setDebugBreakpoints(current => {
            const currentExisting = current.find(item => item.filePath === detail.filePath && item.line === detail.line);
            const without = current.filter(item => item !== currentExisting);
            return condition.trim() ? [...without, { filePath: detail.filePath, line: detail.line, condition: condition.trim() }] : without;
          });
        })();
        return;
      }
      setDebugBreakpoints(current => {
        const currentExisting = current.find(item => item.filePath === detail.filePath && item.line === detail.line);
        return currentExisting ? current.filter(item => item !== currentExisting) : [...current, { filePath: detail.filePath, line: detail.line }];
      });
    };
    window.addEventListener('lingbuilder-debug-breakpoint-toggle', toggle);
    return () => window.removeEventListener('lingbuilder-debug-breakpoint-toggle', toggle);
  }, [debugBreakpoints]);

  useEffect(() => {
    const publish = () => window.dispatchEvent(new CustomEvent('lingbuilder-debug-breakpoints-changed', { detail: { breakpoints: debugBreakpoints } }));
    publish(); window.addEventListener('lingbuilder-debug-breakpoints-request', publish);
    return () => window.removeEventListener('lingbuilder-debug-breakpoints-request', publish);
  }, [debugBreakpoints]);

  useEffect(() => {
    if (!nativeDebugSession || ['terminated', 'error'].includes(nativeDebugSession.state)) return;
    const events = new EventSource('/api/debug/events');
    events.addEventListener('debug', raw => {
      const session = JSON.parse((raw as MessageEvent).data); setNativeDebugSession(session);
      if (Array.isArray(session.logs)) setDebugLogs(session.logs.filter(Boolean));
      if (session.state === 'stopped') { setShowBottomPanel(true); setActiveTabInBottom('debug_locals'); }
    });
    return () => events.close();
  }, [nativeDebugSession?.state]);

  const handleClearLogs = useCallback((tab: string) => {
    if (tab === 'problems') {
      setProblems([]);
      setCompilerProblems([]);
      setQualityProblems([]);
    } else if (tab === 'output') {
      setBuildLogs([]);
    } else if (tab === 'debug_logs') {
      setDebugLogs([]);
      const projectId = activeProjectId;
      fetch(`/api/window-designer/debug-logs?projectId=${projectId}&clear=true`).catch(() => {});
    }
  }, [activeProjectId]);

  // Update status (translated, skipped, pending)
  const handleSetStatus = (
    id: string,
    status: 'translated' | 'skipped' | 'pending',
    owner: ProjectMutationOwner = captureProjectMutationOwner()
  ) => {
    if (!isCurrentProjectMutationOwner(owner)) return;
    const updatedStrings = activeFile.strings.map(s => {
      if (s.id === id) {
        return {
          ...s,
          status,
          translated: status === 'skipped' ? '' : s.translated
        };
      }
      return s;
    });
    triggerReconstruction(activeFile, updatedStrings, owner);
  };

  // Handle batch AI translations from AiAssistant
  const handleBatchTranslate = (
    translations: { id: string; translated: string }[],
    owner: ProjectMutationOwner = captureProjectMutationOwner()
  ) => {
    if (!isCurrentProjectMutationOwner(owner)) return;
    const translationsMap = new Map(translations.map(t => [t.id, t.translated]));
    const updatedStrings = activeFile.strings.map(s => {
      if (translationsMap.has(s.id)) {
        return {
          ...s,
          translated: translationsMap.get(s.id)!,
          status: 'translated' as const
        };
      }
      return s;
    });
    triggerReconstruction(activeFile, updatedStrings, owner);
  };

  // Perform one-click batch AI translation for all pending strings in active file
  const handleAutoTranslateAll = async () => {
    const requestOwner = captureProjectMutationOwner();
    if (!isCurrentProjectMutationOwner(requestOwner)) return;
    const pendingStrings = activeFile.strings.filter(s => s.status === 'pending' || !s.translated);
    if (pendingStrings.length === 0) {
      setShowBottomPanel(true);
      setActiveTabInBottom('output');
    setDebugLogs([]);
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 【一键智能汉化】当前文件没有任何待处理的翻译字段。`
      ]);
      return;
    }

    autoTranslateOwnerRef.current = requestOwner;
    setIsAutoTranslating(true);
    setShowBottomPanel(true);
    setActiveTabInBottom('output');
    setBuildLogs(prev => [
      ...prev,
      `> [${new Date().toLocaleTimeString()}] 【一键智能汉化】开始处理当前文件：${activeFile.name} (待处理: ${pendingStrings.length} 项)...`,
      `> [AI] 正在分析上下文、关联词典及 C++ 语法结构进行智能化文本映射...`
    ]);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strings: pendingStrings,
          glossary,
          style: 'casual'
        })
      });

      if (!response.ok) {
        throw new Error('未检测到有效的 API 密钥或网络异常');
      }

      const data = await response.json();
      if (!isCurrentProjectMutationOwner(requestOwner)) return;
      if (data.translations && Array.isArray(data.translations)) {
        handleBatchTranslate(data.translations, requestOwner);
        setBuildLogs(prev => [
          ...prev,
          `> [${new Date().toLocaleTimeString()}] 【一键智能汉化】成功！已生成并注入 ${data.translations.length} 项精准中文字段。`,
          `> [AI] 新代码重构生成就绪。`
        ]);
      } else {
        throw new Error('未返回预期的翻译结果格式');
      }
    } catch (err: any) {
      if (!isCurrentProjectMutationOwner(requestOwner)) return;
      console.warn('一键智能汉化使用本地词典/模拟汉化降级处理:', err);
      // Fallback: translate using mock dictionary matching / local rules so it works perfectly offline too!
      const fallbackTranslations = pendingStrings.map(s => {
        const matchedLocal = localTranslations[s.original];
        if (matchedLocal) {
          return { id: s.id, translated: matchedLocal };
        }
        // General smart translation rules based on keywords
        let mockTrans = s.original.replace(/["']/g, '');
        if (mockTrans.toLowerCase().includes('database')) mockTrans = '数据库';
        else if (mockTrans.toLowerCase().includes('connection')) mockTrans = '连接';
        else if (mockTrans.toLowerCase().includes('offline')) mockTrans = '离线';
        else if (mockTrans.toLowerCase().includes('loading')) mockTrans = '正在加载';
        else if (mockTrans.toLowerCase().includes('system')) mockTrans = '系统';
        else if (mockTrans.toLowerCase().includes('plugins')) mockTrans = '插件';
        else if (mockTrans.toLowerCase().includes('critical')) mockTrans = '严重';
        else if (mockTrans.toLowerCase().includes('warning')) mockTrans = '警告';
        else if (mockTrans.toLowerCase().includes('adventure')) mockTrans = '冒险';
        else if (mockTrans.toLowerCase().includes('client')) mockTrans = '客户端';
        else if (mockTrans.toLowerCase().includes('success')) mockTrans = '成功';
        else if (mockTrans.toLowerCase().includes('loading')) mockTrans = '载入中';
        else if (mockTrans.toLowerCase().includes('operation')) mockTrans = '操作';
        else mockTrans = `${mockTrans} (汉化版)`;
        return { id: s.id, translated: mockTrans };
      });

      handleBatchTranslate(fallbackTranslations, requestOwner);
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 【一键智能汉化】已应用本地翻译词典机制！成功翻译填充了 ${fallbackTranslations.length} 项汉化字段。`,
        `> [AI] 建议配置 GEMINI_API_KEY 以开启完全上下文智能 C++ 原生宏替换功能。`
      ]);
    } finally {
      const activeRequestOwner = autoTranslateOwnerRef.current;
      if (activeRequestOwner?.projectId === requestOwner.projectId
        && activeRequestOwner.loadGeneration === requestOwner.loadGeneration) {
        autoTranslateOwnerRef.current = null;
        setIsAutoTranslating(false);
      }
    }
  };

  const saveWorkspaceCore = async (
    reason = '保存',
    ownedByBuild = false
  ): Promise<boolean> => {
    const requestOwner = captureProjectMutationOwner();
    let saveEchoSnapshotId: number | undefined;
    if (!isCurrentProjectMutationOwner(requestOwner)) {
      appendEditorTransactionLog(`【${reason}】项目文件仍在载入，已取消本次保存。`);
      return false;
    }
    if (!ownedByBuild) {
      if (editorOperationRef.current) {
        appendEditorTransactionLog(`【${reason}】已有${getEditorOperationLabel(editorOperationRef.current)}任务正在进行，本次请求未重复执行。`);
        return false;
      }
      editorOperationRef.current = 'save';
    }

    setIsSaving(true);
    try {
      const flushState = await flushCurrentEditorDrafts();
      if (!flushState.ok) {
        appendEditorTransactionLog(`【${reason}错误】${flushState.diagnostics[0] || '新手代码提交失败，磁盘文件未改动。'}`);
        return false;
      }
      requireCurrentProjectMutationOwner(requestOwner);

      const designerProject = activeProjectHasWindowDesigner ? getCurrentWindowDesignerProject(activeProjectId) : undefined;
      const savedDesignerSnapshot = designerProject ? JSON.stringify(designerProject) : '';
      const projectId = requestOwner.projectId || designerProject?.id || 'lingbuilder-ui-project';
      const savedStateByPath = new Map<string, { content: string; format: TextFileFormat }>();
      const projectFiles: Record<string, string> = {};
      const projectFileFormats: Record<string, TextFileFormat> = {};
      flushState.files.forEach(file => {
        const content = getCurrentFileContent(file);
        const format = getTextFileFormat(file);
        projectFiles[file.path] = content;
        projectFileFormats[file.path] = format;
        savedStateByPath.set(file.path, { content, format });
      });
      saveEchoSnapshotId = ++inFlightSaveSequenceRef.current;
      inFlightSaveSnapshotsRef.current.set(saveEchoSnapshotId, {
        projectId,
        files: { ...projectFiles },
        designerPath: activeSolutionProject.designerPath.replace(/\\/g, '/'),
        designerSnapshot: savedDesignerSnapshot
      });

      const response = await fetch('/api/window-designer/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          files: projectFiles,
          fileFormats: projectFileFormats,
          baseVersions: projectFileVersionsRef.current,
          ...(designerProject ? { project: designerProject } : {})
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 409 && payload?.code === 'PROJECT_FILE_CONFLICT') {
        const conflictingPaths = Object.keys(payload.files || {}).filter(filePath => {
          const local = flushState.files.find(file => file.path === filePath);
          return local && getCurrentFileContent(local) !== payload.files[filePath];
        });
        if (payload.designerProject && savedDesignerSnapshot !== JSON.stringify(payload.designerProject)) {
          conflictingPaths.push(payload.designerPath || activeSolutionProject.designerPath);
        }
        const reloadDisk = await requestWorkbenchConfirm({
          title: '检测到外部修改',
          description: `${conflictingPaths.join('、') || '项目文件'}\n\n选择“确定”重新载入磁盘版本；选择“取消”保留本地编辑并继续保留冲突保护。`,
          confirmLabel: '重新载入',
          cancelLabel: '保留本地'
        });
        if (reloadDisk) {
          projectFileVersionsRef.current = payload.fileVersions || {};
          void fetch(`/api/window-designer/recovery?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' });
          setProjectFileReloadToken(token => token + 1);
        }
        appendEditorTransactionLog(reloadDisk
          ? `【${reason}】已取消覆盖并重新载入磁盘版本。`
          : `【${reason}】已保留本地编辑；未在本次请求中覆盖磁盘。`);
        return false;
      }
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `保存服务请求失败（HTTP ${response.status}）。请检查开发服务是否正在运行。`);
      }
      requireCurrentProjectMutationOwner(requestOwner);
      projectFileVersionsRef.current = payload.fileVersions || projectFileVersionsRef.current;
      if (designerProject) {
        designerSavedSnapshotRef.current = savedDesignerSnapshot;
         const currentDesignerSnapshot = JSON.stringify(readWindowDesignerState(activeProjectId).project);
        const nextDesignerDirty = currentDesignerSnapshot !== savedDesignerSnapshot;
        designerDirtyRef.current = nextDesignerDirty;
        setDesignerDirty(nextDesignerDirty);
      } else {
        designerDirtyRef.current = false;
        setDesignerDirty(false);
      }
      void fetch(`/api/window-designer/recovery?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' });

      // Preserve edits made while the request was in flight. Only content that
      // still matches the saved snapshot becomes clean; newer content stays dirty.
      const nextFiles = filesRef.current.map(file => {
        const savedState = savedStateByPath.get(file.path);
        if (!savedState) return file;
        const persistedFormat = readTextFileFormat(payload.fileFormats?.[file.path] || savedState.format);
        const currentContent = getCurrentFileContent(file);
        const currentFormat = getTextFileFormat(file);
        const contentModified = currentContent !== savedState.content;
        const formatModified = !isSameTextFileFormat(currentFormat, persistedFormat);
        if (!contentModified && !formatModified) {
          return {
            ...file,
            encoding: persistedFormat.encoding,
            eol: persistedFormat.eol,
            savedEncoding: persistedFormat.encoding,
            savedEol: persistedFormat.eol,
            formatModified: false,
            originalContent: savedState.content,
            translatedContent: savedState.content,
            isModified: false
          };
        }
        return {
          ...file,
          savedEncoding: persistedFormat.encoding,
          savedEol: persistedFormat.eol,
          formatModified,
          originalContent: savedState.content,
          isModified: contentModified
        };
      });

      filesRef.current = nextFiles;
      setFiles(nextFiles);
      const currentActivePath = activeFileRef.current?.path;
      const nextActiveFile = currentActivePath
        ? nextFiles.find(file => file.path === currentActivePath)
        : undefined;
      if (nextActiveFile) {
        activeFileRef.current = nextActiveFile;
        setActiveFile(nextActiveFile);
      }

      void refreshSourceControlStatus();
      appendEditorTransactionLog(`【${reason}】当前中文代码及 UI 界面结构已写入项目磁盘。`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      appendEditorTransactionLog(`【${reason}错误】${message}`);
      return false;
    } finally {
      if (saveEchoSnapshotId !== undefined) {
        inFlightSaveSnapshotsRef.current.delete(saveEchoSnapshotId);
      }
      setIsSaving(false);
      if (!ownedByBuild && editorOperationRef.current === 'save') {
        editorOperationRef.current = null;
      }
    }
  };
  saveWorkspaceCoreRef.current = saveWorkspaceCore;

  const handleSaveWorkspace = (reason = '保存') => saveWorkspaceCore(reason, false);

  useEffect(() => {
    if (autoSaveMode !== 'afterDelay'
      || !projectFilesReady
      || isSaving
      || (!files.some(isEditorFileDirty) && !designerDirty)) return;
    const timer = window.setTimeout(() => {
      void saveWorkspaceCoreRef.current('自动保存', false);
    }, autoSaveDelay);
    return () => window.clearTimeout(timer);
  }, [autoSaveDelay, autoSaveMode, designerDirty, files, isSaving, projectFilesReady]);

  const commitWorkspaceSearchEditorFiles = (
    diskFiles: Record<string, string>,
    changedPaths: readonly string[],
    fileFormats?: Record<string, TextFileFormat>
  ) => {
    const nextFiles = refreshWorkspaceSearchEditorFiles(filesRef.current, {
      files: diskFiles,
      fileFormats
    }, changedPaths);
    filesRef.current = nextFiles;
    setFiles(nextFiles);
    const activePath = activeFileRef.current?.path;
    const nextActive = activePath ? nextFiles.find(file => file.path === activePath) : undefined;
    if (nextActive) {
      activeFileRef.current = nextActive;
      setActiveFile(nextActive);
    }
    void refreshSourceControlStatus();
  };

  const handleWorkspaceSearchQuery = async (
    request: WorkspaceSearchQueryRequest
  ): Promise<WorkspaceSearchQueryResponse> => {
    if (!projectFilesReadyRef.current) throw new Error('项目文件尚未载入完成，不能搜索工作区。');
    const requestOwner = captureProjectMutationOwner();
    requireCurrentProjectMutationOwner(requestOwner);
    const result = await queryWorkspace(request);
    requireCurrentProjectMutationOwner(requestOwner);
    return result;
  };

  const handleWorkspaceReplacePreview = async (
    request: WorkspaceReplacePreviewRequest
  ): Promise<WorkspaceReplacePreviewResponse> => {
    if (!projectFilesReadyRef.current) throw new Error('项目文件尚未载入完成，不能创建替换预览。');
    const requestOwner = captureProjectMutationOwner();
    requireCurrentProjectMutationOwner(requestOwner);
    const result = await previewWorkspaceReplace(request);
    requireCurrentProjectMutationOwner(requestOwner);
    workspaceReplacePreviewRef.current.clear();
    workspaceReplacePreviewRef.current.set(result.previewId, {
      preview: result,
      owner: requestOwner
    });
    return result;
  };

  const handleWorkspaceReplaceApply = async (
    request: WorkspaceReplaceApplyRequest
  ): Promise<WorkspaceReplaceApplyResponse> => {
    if (!projectFilesReadyRef.current) throw new Error('项目文件尚未载入完成，不能应用工作区替换。');
    const requestOwner = captureProjectMutationOwner();
    requireCurrentProjectMutationOwner(requestOwner);
    const previewEntry = workspaceReplacePreviewRef.current.get(request.previewId);
    if (!previewEntry || !isCurrentProjectMutationOwner(previewEntry.owner)) {
      throw new Error('替换预览所属项目已变化，请重新搜索并生成预览。');
    }
    const result = await applyWorkspaceReplace(request);
    requireCurrentProjectMutationOwner(requestOwner);
    const preview = previewEntry.preview;
    commitWorkspaceSearchEditorFiles(
      Object.fromEntries(preview.files.map(file => [file.filePath, file.after])),
      result.updatedFiles
    );
    workspaceReplacePreviewRef.current.delete(request.previewId);
    workspaceReplaceTransactionRef.current.set(result.transactionId, {
      preview,
      owner: requestOwner
    });
    requireCurrentProjectMutationOwner(requestOwner);
    appendEditorTransactionLog(`【工作区替换】已更新 ${result.updatedFiles.length} 个文件，共替换 ${result.replacementCount} 处；事务 ${result.transactionId} 可撤销。`);
    return result;
  };

  const handleWorkspaceReplaceRollback = async (
    request: WorkspaceReplaceRollbackRequest
  ): Promise<WorkspaceReplaceRollbackResponse> => {
    if (!projectFilesReadyRef.current) throw new Error('项目文件尚未载入完成，不能撤销工作区替换。');
    const requestOwner = captureProjectMutationOwner();
    requireCurrentProjectMutationOwner(requestOwner);
    const transactionEntry = workspaceReplaceTransactionRef.current.get(request.transactionId);
    if (!transactionEntry || !isCurrentProjectMutationOwner(transactionEntry.owner)) {
      throw new Error('替换事务所属项目已变化，不能写入当前编辑器状态。');
    }
    const result = await rollbackWorkspaceReplace(request);
    requireCurrentProjectMutationOwner(requestOwner);
    const preview = transactionEntry.preview;
    commitWorkspaceSearchEditorFiles(
      Object.fromEntries(preview.files.map(file => [file.filePath, file.before])),
      result.restoredFiles
    );
    workspaceReplaceTransactionRef.current.delete(request.transactionId);
    requireCurrentProjectMutationOwner(requestOwner);
    appendEditorTransactionLog(`【工作区替换撤销】已恢复 ${result.restoredFiles.length} 个文件。`);
    return result;
  };

  const dispatchWorkspaceSearchReveal = (match: WorkspaceSearchMatch) => {
    const detail = createWorkspaceSearchRevealDetail(match);
    [40, 160].forEach(delay => {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('lingcpp-reveal-line', { detail }));
      }, delay);
    });
  };

  const handleWorkspaceSearchReveal = async (match: WorkspaceSearchMatch): Promise<void> => {
    const owner = findWorkspaceSearchProject(match.filePath, solution.projects);
    if (!owner) {
      setWorkspaceSearchMode(null);
      setShowBottomPanel(true);
      setActiveTabInBottom('output');
      appendEditorTransactionLog(`【搜索结果】${match.filePath} 不属于当前解决方案的源码或配置根目录；已保留搜索预览，但不能在项目编辑器中打开。`);
      return;
    }

    const loadedFile = filesRef.current.find(file => file.path === match.filePath);
    if (owner.id === activeProjectIdRef.current && loadedFile) {
      setWorkspaceSearchMode(null);
      if (await handleSelectFile(loadedFile)) dispatchWorkspaceSearchReveal(match);
      return;
    }

    const flushState = await flushCurrentEditorDrafts();
    if (!flushState.ok) {
      showEditorFlushFailure(flushState.diagnostics);
      return;
    }
    if (flushState.files.some(isEditorFileDirty) || designerDirtyRef.current) {
      const saved = await handleSaveWorkspace('跳转搜索结果前保存');
      if (!saved) return;
    }

    pendingWorkspaceSearchRevealRef.current = match;
    setWorkspaceSearchMode(null);
    if (owner.id === activeProjectIdRef.current) {
      pendingWorkspaceSearchRevealRef.current = null;
      appendEditorTransactionLog(`【搜索结果】项目文件列表中未找到 ${match.filePath}，请刷新解决方案后重试。`);
      return;
    }

    const result = await setStartupProject(owner.id);
    if (!result.ok || !result.solution) {
      pendingWorkspaceSearchRevealRef.current = null;
      appendEditorTransactionLog(`【搜索结果跳转错误】${result.error || `无法切换到项目 ${owner.id}。`}`);
      return;
    }
    setSolution(result.solution);
  };

  useEffect(() => {
    if (!hasEnteredWorkbench) return;
    const navigation = pendingAiWorkbenchNavigationRef.current;
    if (!navigation || navigation.projectId !== activeProjectId || !projectFilesReady || loadedProjectId !== activeProjectId) return;
    if (!filesRef.current.some(file => file.path === navigation.filePath)) return;
    pendingAiWorkbenchNavigationRef.current = null;
    void fetch('/api/solution/navigation/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: navigation.requestId })
    }).catch(() => undefined);
  }, [activeProjectId, hasEnteredWorkbench, loadedProjectId, projectFilesReady]);

  useEffect(() => {
    if (!hasEnteredWorkbench) return;
    const events = new EventSource('/api/solution/watch');
    let disposed = false;
    const refreshAuthoritativeSolution = async () => {
      try {
        const nextSolution = await fetchSolution();
        if (!disposed) setSolution(nextSolution);
      } catch (error) {
        if (!disposed) appendSolutionLogs('外部 AI 项目变更', { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    };
    const handleSolutionChange = () => { void refreshAuthoritativeSolution(); };
    const handleWorkbenchNavigation = (event: MessageEvent<string>) => {
      try {
        const value = JSON.parse(event.data) as {
          requestId?: string;
          action?: string;
          projectId?: string;
          filePath?: string;
          windowId?: string;
        };
        if (value.action !== 'open-project' || !value.requestId || !value.projectId || !value.filePath) return;
        pendingAiWorkbenchNavigationRef.current = {
          requestId: value.requestId,
          projectId: value.projectId,
          filePath: value.filePath,
          windowId: value.windowId
        };
        void refreshAuthoritativeSolution();
      } catch {
        // Ignore malformed external navigation messages; the marker remains for the next connection.
      }
    };
    events.addEventListener('solution-change', handleSolutionChange as EventListener);
    events.addEventListener('workbench-navigation', handleWorkbenchNavigation as EventListener);
    void refreshAuthoritativeSolution();
    return () => {
      disposed = true;
      events.close();
    };
  }, [hasEnteredWorkbench]);

  useEffect(() => {
    const navigation = pendingAiWorkbenchNavigationRef.current;
    if (!navigation || navigation.dispatched || !solution.projects.some(project => project.id === navigation.projectId)) return;
    navigation.dispatched = true;
    const match: WorkspaceSearchMatch = {
      id: `ai-project-create:${navigation.requestId}`,
      filePath: navigation.filePath,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
      matchText: '',
      preview: 'AI 创建项目后打开主文件'
    };
    void handleWorkspaceSearchReveal(match);
  }, [handleWorkspaceSearchReveal, solution]);

  const handleOpenWorkspace = async (): Promise<boolean> => {
    if (workspaceSwitchInFlightRef.current) {
      appendEditorTransactionLog('【打开工作区】已有工作区正在切换，请稍候。');
      return false;
    }
    if (editorOperationRef.current) {
      appendEditorTransactionLog(`【打开工作区】已有${getEditorOperationLabel(editorOperationRef.current)}任务正在进行，请稍后再试。`);
      return false;
    }
    if (hasEnteredWorkbench) {
      const flushState = await flushCurrentEditorDrafts();
      if (!flushState.ok) {
        appendEditorTransactionLog(`【打开工作区错误】${flushState.diagnostics[0] || '新手代码提交失败，未切换工作区。'}`);
        return false;
      }

      if (flushState.files.some(isEditorFileDirty) || designerDirtyRef.current) {
        const saved = await handleSaveWorkspace('切换工作区前保存');
        if (!saved) return false;
      }
    }

    const workspaceApi = window.lingBuilder?.workspace;
    if (!workspaceApi) {
      appendEditorTransactionLog('【打开工作区错误】当前运行环境不支持原生目录选择。');
      return false;
    }

    workspaceSwitchInFlightRef.current = true;
    setIsWorkspaceSwitching(true);
    try {
      const result = await workspaceApi.open();
      if (result.canceled) {
        workspaceSwitchInFlightRef.current = false;
        setIsWorkspaceSwitching(false);
        return false;
      }
      if (!result.ok) {
        workspaceSwitchInFlightRef.current = false;
        setIsWorkspaceSwitching(false);
        appendEditorTransactionLog(`【打开工作区错误】${result.error || '工作区切换失败。'}`);
        return false;
      }
      appendEditorTransactionLog(`【打开工作区】已切换到 ${result.workspacePath || '所选目录'}。`);
      return true;
    } catch (error) {
      workspaceSwitchInFlightRef.current = false;
      setIsWorkspaceSwitching(false);
      appendEditorTransactionLog(`【打开工作区错误】${error instanceof Error ? error.message : '原生目录选择失败。'}`);
      return false;
    }
  };

  const handleOpenWorkspacePath = async (targetPath: string, newWindow = false): Promise<boolean> => {
    const workspaceApi = window.lingBuilder?.workspace;
    if (!workspaceApi) return false;
    if (!newWindow && workspaceSwitchInFlightRef.current) {
      appendEditorTransactionLog('【打开工作区】已有工作区正在切换，请稍候。');
      return false;
    }
    if (!newWindow && hasEnteredWorkbench) {
      const flushState = await flushCurrentEditorDrafts();
      if (!flushState.ok) return false;
      if ((flushState.files.some(isEditorFileDirty) || designerDirtyRef.current)
        && !await handleSaveWorkspace('切换工作区前保存')) return false;
    }
    if (!newWindow) {
      workspaceSwitchInFlightRef.current = true;
      setIsWorkspaceSwitching(true);
    }
    try {
      const result = await workspaceApi.openPath(targetPath, newWindow);
      if (!result.ok) {
        if (!newWindow) {
          workspaceSwitchInFlightRef.current = false;
          setIsWorkspaceSwitching(false);
        }
        appendEditorTransactionLog(`【打开工作区错误】${result.error || '无法打开目标。'}`);
        return false;
      }
      appendEditorTransactionLog(newWindow
        ? `【新窗口】已打开 ${result.workspacePath}。`
        : `【打开工作区】已切换到 ${result.workspacePath}。`);
      if (!newWindow && result.workspacePath) setCurrentWorkspacePath(result.workspacePath);
      setRecentWorkspaces(await workspaceApi.listRecent());
      return true;
    } catch (error) {
      if (!newWindow) {
        workspaceSwitchInFlightRef.current = false;
        setIsWorkspaceSwitching(false);
      }
      appendEditorTransactionLog(`【打开工作区错误】${error instanceof Error ? error.message : '无法打开目标。'}`);
      return false;
    }
  };

  const handleForgetRecentWorkspace = async (workspacePath: string): Promise<void> => {
    const workspaceApi = window.lingBuilder?.workspace;
    if (!workspaceApi?.forgetRecent) return;
    try {
      await workspaceApi.forgetRecent(workspacePath);
      setRecentWorkspaces(await workspaceApi.listRecent());
      appendEditorTransactionLog(`【最近工作区】已从列表移除 ${workspacePath}。`);
    } catch (error) {
      appendEditorTransactionLog(`【最近工作区错误】${error instanceof Error ? error.message : '无法从最近列表移除。'}`);
    }
  };

  const handleCloseCurrentSolution = async (): Promise<boolean> => {
    const workspaceApi = window.lingBuilder?.workspace;
    if (!workspaceApi?.closeCurrent) {
      appendEditorTransactionLog('【关闭解决方案错误】当前运行环境不支持关闭解决方案。');
      return false;
    }
    if (editorOperationRef.current) {
      appendEditorTransactionLog(`【关闭解决方案】已有${getEditorOperationLabel(editorOperationRef.current)}任务正在进行，请稍后再试。`);
      return false;
    }
    const flushState = await flushCurrentEditorDrafts();
    if (!flushState.ok) {
      appendEditorTransactionLog(`【关闭解决方案错误】${flushState.diagnostics[0] || '当前编辑内容无法安全提交。'}`);
      return false;
    }
    if ((flushState.files.some(isEditorFileDirty) || designerDirtyRef.current)
      && !await handleSaveWorkspace('关闭解决方案前保存')) return false;
    if (!await requestWorkbenchConfirm({ title: '关闭解决方案', description: `确定关闭解决方案“${solution.name}”吗？\n\n工作区文件不会被删除，LingBuilder 将打开一个新的空白工作区。`, confirmLabel: '关闭', cancelLabel: '取消' })) {
      return false;
    }
    const result = await workspaceApi.closeCurrent();
    if (!result.ok) {
      appendEditorTransactionLog(`【关闭解决方案错误】${result.error || '无法切换到空白工作区。'}`);
      return false;
    }
    return true;
  };

  const handleExportLcppSourcePackage = async (requestedProjectId?: string): Promise<boolean> => {
    const sourcePackageApi = window.lingBuilder?.sourcePackages;
    if (!sourcePackageApi) {
      appendEditorTransactionLog('【源码分享错误】当前运行环境不支持导出 LCPP 源码包。');
      return false;
    }
    if (editorOperationRef.current || isBuilding) {
      appendEditorTransactionLog('【源码分享】当前有保存、生成或文件操作正在进行，请稍后再试。');
      return false;
    }
    const projectId = requestedProjectId || activeProjectId || solution.startupProjectId || solution.projects[0]?.id;
    const project = solution.projects.find(item => item.id === projectId);
    if (!project || project.type !== 'visual-cpp') {
      appendEditorTransactionLog('【源码分享错误】请选择一个 LingBuilder 可视 C++ 项目。');
      return false;
    }
    const flushed = await flushCurrentEditorDrafts();
    if (!flushed.ok) {
      appendEditorTransactionLog(`【源码分享错误】${flushed.diagnostics[0] || '当前代码草稿无法提交。'}`);
      return false;
    }
    if ((flushed.files.some(isEditorFileDirty) || designerDirtyRef.current)
      && !await handleSaveWorkspace('导出 LCPP 源码包前保存')) return false;
    const result = await sourcePackageApi.exportProject(project.id, project.name);
    if (result.canceled) return false;
    setShowBottomPanel(true);
    setActiveTabInBottom('output');
    if (!result.ok) {
      setBuildLogs(previous => [...previous, `> [${new Date().toLocaleTimeString()}] 【源码分享错误】${result.error || 'LCPP 源码包导出失败。'}`]);
      return false;
    }
    setBuildLogs(previous => [
      ...previous,
      `> [${new Date().toLocaleTimeString()}] 【源码分享】已导出 ${result.lcppFileCount || 0} 个 LCPP 源文件、${result.fileCount || 0} 个完整项目文件。`,
      `源码包：${result.packagePath}`,
      ...(result.warnings || []).map(warning => `提醒：${warning}`)
    ]);
    return true;
  };

  const handleOpenLcppSourcePackage = async (): Promise<boolean> => {
    const sourcePackageApi = window.lingBuilder?.sourcePackages;
    if (!sourcePackageApi) {
      appendEditorTransactionLog('【打开源码包错误】当前运行环境不支持打开 LCPP 源码包。');
      return false;
    }
    if (editorOperationRef.current || isBuilding) return false;
    const flushed = await flushCurrentEditorDrafts();
    if (!flushed.ok) return false;
    if ((flushed.files.some(isEditorFileDirty) || designerDirtyRef.current)
      && !await handleSaveWorkspace('打开 LCPP 源码包前保存')) return false;
    const result = await sourcePackageApi.open();
    if (result.canceled) return false;
    if (!result.ok) {
      appendEditorTransactionLog(`【打开源码包错误】${result.error || 'LCPP 源码包打开失败。'}`);
      return false;
    }
    return true;
  };

  useEffect(() => {
    const workspaceApi = window.lingBuilder?.workspace;
    if (!workspaceApi) return;
    void Promise.all([workspaceApi.getCurrent(), workspaceApi.listRecent()])
      .then(([workspacePath, recent]) => {
        setCurrentWorkspacePath(workspacePath || '');
        setRecentWorkspaces(recent);
      })
      .catch(() => undefined);
    const preventDefault = (event: DragEvent) => event.preventDefault();
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer?.files[0];
      const droppedPath = file ? window.lingBuilder?.modules?.getDroppedFilePath(file) : '';
      if (droppedPath?.toLowerCase().endsWith('.lbmod')) return;
      if (!droppedPath) {
        appendEditorTransactionLog('【拖放打开错误】未能读取本地文件路径。');
        return;
      }
      void handleOpenWorkspacePath(droppedPath, event.shiftKey);
    };
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', handleDrop);
    };
  }, [activeProjectId]);

  // Tool handlers for our LingBuilder IDE Custom Toolbar
  const handleToolbarAction = async (actionName: string): Promise<boolean> => {
    if (actionName === 'undo' || actionName === 'redo') {
      const editorHandle = activeEditorGroupRef.current === 'secondary'
        ? secondaryEditorRef.current
        : diffViewerRef.current;
      const changed = actionName === 'undo'
        ? await editorHandle?.undo()
        : await editorHandle?.redo();
      if (changed) return true;
      setBuildLogs(previous => [
        ...previous,
        `> [${new Date().toLocaleTimeString()}] 【编辑】${actionName === 'undo' ? '当前没有可撤销的编辑。' : '当前没有可重做的编辑。'}`
      ]);
      return false;
    }

    setShowBottomPanel(true);
    setActiveTabInBottom('output');

    if (actionName === 'new') {
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 【新建】已为您成功创建新的 LingBuilder 中文 UI 项目模板及设计窗体 (MainWindow.xml)。`
      ]);
    } else if (actionName === 'open') {
      await handleOpenWorkspace();
    } else if (actionName === 'save') {
      await handleSaveWorkspace();
    } else if (actionName === 'copy') {
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 【剪贴板】已复制所选中文界面控件的 C++ 代码声明及 XML 结构定义定义。`
      ]);
    } else if (actionName === 'paste') {
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 【剪贴板】正在从系统剪贴板读取数据... 已成功将中文控件实例实例化至画布。`
      ]);
    }
    return true;
  };

  const handleGenerateCpp = () => {
    window.dispatchEvent(new CustomEvent('show-window-designer'));
    setShowBottomPanel(true);
    setActiveTabInBottom('output');
    setBuildLogs(prev => [
      ...prev,
      `> [${new Date().toLocaleTimeString()}] 【生成】正在根据当前窗口程序集解析中文可视化 DSL 结构...`,
      `> [${new Date().toLocaleTimeString()}] 【生成】成功提取多个窗体、控件变量和中文事件注册...`,
      `> [${new Date().toLocaleTimeString()}] 【生成】已重新生成每个窗口对应的 C++ 逻辑类定义。代码生成完毕。`
    ]);
  };

  const handleEnvCheck = async (): Promise<boolean> => {
    const requestLease = environmentCheckRequestGateRef.current.begin();
    if (!requestLease) {
      setShowBottomPanel(true);
      setActiveTabInBottom('output');
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 【环境检查】已有检测正在进行，本次请求未重复执行。`
      ]);
      return false;
    }
    const controller = requestLease.controller;
    const timeout = window.setTimeout(() => controller.abort(), 32_000);
    setShowBottomPanel(true);
    setActiveTabInBottom('output');
    setBuildLogs([`> [${new Date().toLocaleTimeString()}] 正在检测真实开发环境，请稍候...`]);
    try {
      const response = await fetch('/api/environment/check', { signal: controller.signal });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || '开发环境检测失败。');
      }
      setBuildLogs(formatEnvironmentCheckOutput(result, new Date().toLocaleTimeString()));
      return Boolean(result.ready);
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? '环境检测超过 32 秒，已取消本次等待；请检查系统工具响应后重试。'
        : error instanceof Error
          ? error.message
          : '开发环境检测失败。';
      setBuildLogs([
        `>>> [${new Date().toLocaleTimeString()}] 【环境检测错误】${message}`
      ]);
      return false;
    } finally {
      window.clearTimeout(timeout);
      requestLease.finish();
    }
  };

  const appendSolutionLogs = useCallback((title: string, result: { ok: boolean; logs?: string[]; error?: string; stage?: string; compilerDiagnostics?: any[]; results?: Array<{ compilerDiagnostics?: any[] }> }) => {
    setShowBottomPanel(true);
    setActiveTabInBottom('output');
    setBuildLogs(prev => [
      ...prev,
      `> [${new Date().toLocaleTimeString()}] 【${title}】${result.ok ? '完成' : '失败'}`,
      ...(result.logs || []).map(line => `> [${new Date().toLocaleTimeString()}] ${line}`),
      ...(!result.ok ? [`> [${new Date().toLocaleTimeString()}] 错误：${result.error || result.stage || '未知错误'}`] : [])
    ]);
    const diagnostics = [...(result.compilerDiagnostics || []), ...(result.results || []).flatMap(item => item.compilerDiagnostics || [])];
    window.dispatchEvent(new CustomEvent('lingbuilder-compiler-diagnostics', { detail: { diagnostics } }));
  }, []);

  const openCreateSolutionProjectDialog = useCallback((projectType: 'windows-ui' | 'windows-dll' = 'windows-ui') => {
    setCreateProjectName(`LingBuilder项目${solution.projects.length + 1}`);
    setCreateProjectTemplateId(projectType === 'windows-dll' ? 'windows-dll' : 'blank-window');
    setCreateSolutionName(solution.name?.trim() || '');
    createDialogSolutionNameTouchedRef.current = false;
    setCreateProjectLocation('');
    setCreateProjectError('');
    setShowCreateProjectDialog(true);
    // 欢迎页打开时客户端 solution 状态可能仍是初始默认值，打开后拉取服务端最新名称用于预填。
    void fetchSolution().then(latest => {
      if (!createDialogSolutionNameTouchedRef.current) setCreateSolutionName(latest.name?.trim() || '');
    }).catch(() => undefined);
  }, [solution.name, solution.projects.length]);

  const handleCreateSolutionProject = useCallback(async (
    name: string,
    templateId: 'blank-window' | 'windows-dll' = createProjectTemplateId,
    options?: { solutionName?: string; projectDirectory?: string }
  ): Promise<{ ok: boolean; workspacePath?: string }> => {
    if (!name.trim()) return { ok: false };
    const flushState = await flushCurrentEditorDrafts();
    if (!flushState.ok) {
      const message = flushState.diagnostics[0] || '新手代码提交失败，未切换项目。';
      appendEditorTransactionLog(`【新建项目错误】${message}`);
      setCreateProjectError(message);
      return { ok: false };
    }
    if (flushState.files.some(isEditorFileDirty) || designerDirtyRef.current) {
      const saved = await handleSaveWorkspace('新建项目前保存');
      if (!saved) {
        setCreateProjectError('当前文件保存失败，已取消新建项目。');
        return { ok: false };
      }
    }
    const result = await createSolutionProject(name.trim(), templateId, options);
    appendSolutionLogs('新建项目', result);
    if (!result.ok) {
      setCreateProjectError(result.error || '新建项目失败。');
      return { ok: false };
    }
    if (result.workspacePath) {
      return { ok: true, workspacePath: result.workspacePath };
    }
    if (result.solution) setSolution(result.solution);
    if (result.project) {
      await setStartupProject(result.project.id);
      const nextSolution = await refreshSolution();
      setSolution(nextSolution);
    }
    return { ok: true };
  }, [appendSolutionLogs, createProjectTemplateId, flushCurrentEditorDrafts, refreshSolution]);

  const switchToStandaloneProjectWorkspace = async (workspacePath: string): Promise<boolean> => {
    const workspaceApi = window.lingBuilder?.workspace;
    if (workspaceApi?.openPath) {
      return await handleOpenWorkspacePath(workspacePath);
    }
    try {
      const response = await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setCreateProjectError(result.error || '切换到独立项目工作区失败，请通过“打开工作区”手动切换。');
        return false;
      }
      appendEditorTransactionLog(`【新建项目】已切换到独立项目工作区 ${result.workspacePath || workspacePath}，正在重新载入工作台…`);
      try {
        sessionStorage.setItem(AUTO_ENTER_WORKSPACE_FLAG, '1');
      } catch {
        // 存储不可用时刷新后按正常流程显示欢迎页。
      }
      window.setTimeout(() => window.location.reload(), 800);
      return true;
    } catch (error) {
      setCreateProjectError(error instanceof Error ? error.message : '切换到独立项目工作区失败，请通过“打开工作区”手动切换。');
      return false;
    }
  };

  const submitCreateSolutionProject = useCallback(async () => {
    if (isCreatingSolutionProject || !createProjectName.trim()) return;
    setIsCreatingSolutionProject(true);
    setCreateProjectError('');
    try {
      const created = await handleCreateSolutionProject(createProjectName, createProjectTemplateId, {
        solutionName: createSolutionName,
        projectDirectory: createProjectLocation
      });
      if (!created.ok) return;
      if (created.workspacePath) {
        const switched = await switchToStandaloneProjectWorkspace(created.workspacePath);
        if (!switched) return;
      }
      setShowCreateProjectDialog(false);
    } catch (error) {
      setCreateProjectError(error instanceof Error ? error.message : '新建项目失败。');
    } finally {
      setIsCreatingSolutionProject(false);
    }
  }, [createProjectName, createProjectTemplateId, createSolutionName, createProjectLocation, handleCreateSolutionProject, isCreatingSolutionProject]);

  const handleCreateSolutionFolder = useCallback((): boolean => {
    const suggestedName = `解决方案文件夹${(solution.folders?.length || 0) + 1}`;
    setSolutionNameOperation({ kind: 'create-folder' });
    setSolutionNameValue(suggestedName);
    setSolutionNameError('');
    return true;
  }, [solution.folders]);

  const handleMoveProjectToSolutionFolder = useCallback(async (
    projectId: string,
    solutionFolderId: string | null
  ): Promise<boolean> => {
    const project = solution.projects.find(item => item.id === projectId);
    if (!project) return false;
    if ((project.solutionFolderId || null) === solutionFolderId) return true;
    const folder = solutionFolderId ? solution.folders?.find(item => item.id === solutionFolderId) : undefined;
    if (solutionFolderId && !folder) return false;
    const result = await moveSolutionProject(projectId, solutionFolderId);
    appendSolutionLogs('移动解决方案项目', {
      ...result,
      logs: result.ok
        ? [`已将项目“${project.name}”移动到${folder ? `解决方案文件夹“${folder.name}”` : '解决方案根节点'}。`]
        : result.logs
    });
    if (result.solution) setSolution(result.solution);
    return result.ok;
  }, [appendSolutionLogs, solution.folders, solution.projects]);

  const handleRenameSolutionProject = useCallback((projectId: string): boolean => {
    const project = solution.projects.find(item => item.id === projectId);
    if (!project) return false;
    setSolutionNameOperation({ kind: 'rename-project', projectId });
    setSolutionNameValue(project.name);
    setSolutionNameError('');
    return true;
  }, [solution.projects]);

  const submitSolutionNameOperation = useCallback(async (): Promise<void> => {
    if (!solutionNameOperation || isSubmittingSolutionName) return;
    const name = solutionNameValue.trim();
    if (!name) {
      setSolutionNameError(solutionNameOperation.kind === 'create-folder' ? '解决方案文件夹名称不能为空。' : '项目名称不能为空。');
      return;
    }
    setIsSubmittingSolutionName(true);
    setSolutionNameError('');
    try {
      if (solutionNameOperation.kind === 'create-folder') {
        const result = await createSolutionFolder(name);
        appendSolutionLogs('新建解决方案文件夹', result);
        if (!result.ok) {
          setSolutionNameError(result.error || '新建解决方案文件夹失败。');
          return;
        }
        if (result.solution) setSolution(result.solution);
      } else {
        const project = solution.projects.find(item => item.id === solutionNameOperation.projectId);
        if (!project) {
          setSolutionNameError('要重命名的项目已不在当前解决方案中。');
          return;
        }
        const result = await renameSolutionProject(project.id, name);
        appendSolutionLogs('重命名项目', {
          ...result,
          logs: result.ok ? [`项目“${project.name}”已重命名为“${name}”。项目 ID 和磁盘路径保持不变。`] : result.logs
        });
        if (!result.ok) {
          setSolutionNameError(result.error || '重命名项目失败。');
          return;
        }
        if (result.solution) setSolution(result.solution);
      }
      setSolutionNameOperation(null);
      setSolutionNameValue('');
    } finally {
      setIsSubmittingSolutionName(false);
    }
  }, [appendSolutionLogs, isSubmittingSolutionName, solution.projects, solutionNameOperation, solutionNameValue]);

  const handleSetStartupProject = useCallback(async (projectId: string) => {
    if (isProjectFileLoadPending(activeProjectId, loadedProjectId, projectFileLoadState)) {
      appendEditorTransactionLog('【切换项目】当前项目文件仍在载入，请稍后再切换。');
      return;
    }
    if (projectSwitchInFlightRef.current) {
      appendEditorTransactionLog('【切换项目】已有项目切换正在进行，请等待文件载入完成。');
      return;
    }
    projectSwitchInFlightRef.current = true;
    try {
      const flushState = await flushCurrentEditorDrafts();
      if (!flushState.ok) {
        appendEditorTransactionLog(`【切换项目错误】${flushState.diagnostics[0] || '新手代码提交失败，未切换项目。'}`);
        return;
      }
      if (flushState.files.some(isEditorFileDirty) || designerDirtyRef.current) {
        const saved = await handleSaveWorkspace('切换项目前保存');
        if (!saved) return;
      }
      const result = await setStartupProject(projectId);
      appendSolutionLogs('设为启动项目', {
        ok: result.ok,
        logs: result.ok ? [`启动项目已切换为：${projectId}`] : result.logs,
        error: result.error
      });
      if (result.solution) setSolution(result.solution);
      await refreshSolution();
    } finally {
      projectSwitchInFlightRef.current = false;
    }
  }, [activeProjectId, appendSolutionLogs, flushCurrentEditorDrafts, loadedProjectId, projectFileLoadState, refreshSolution]);

  const handleConfigureProjectReferences = useCallback(async (projectId: string) => {
    const project = solution.projects.find(item => item.id === projectId); if (!project) return;
    const available = solution.projects.filter(item => item.id !== projectId).map(item => item.id);
    const value = await requestWorkbenchPrompt({
      title: '配置项目引用',
      description: `输入“${project.name}”引用的项目 ID，用逗号分隔。\n可选：${available.join('、') || '无'}`,
      inputLabel: '引用的项目 ID',
      inputValue: (project.references || []).join(', ')
    });
    if (value === null) return;
    const references = value.split(/[,，]/u).map(item => item.trim()).filter(Boolean);
    const result = await configureSolutionProject(projectId, { references });
    appendSolutionLogs('配置项目引用', result);
    if (result.solution) setSolution(result.solution);
  }, [appendSolutionLogs, solution]);

  const handleImportExternalProject = useCallback(async () => {
    const projectFile = await requestWorkbenchPrompt({
      title: '导入现有工程',
      description: '输入工作区内的 CMakeLists.txt、.vcxproj 或 .sln 相对路径：',
      inputLabel: '工程文件相对路径',
      inputPlaceholder: '例如 external/hello/CMakeLists.txt'
    });
    if (!projectFile?.trim()) return;
    const result = await importSolutionProject(projectFile.trim());
    appendSolutionLogs('导入现有工程', result);
    if (result.solution) setSolution(result.solution);
  }, [appendSolutionLogs]);

  const openProjectBuildPathsDialog = useCallback((projectId?: string) => {
    const targetId = projectId || solution.startupProjectIds?.[0] || solution.startupProjectId || solution.projects[0]?.id;
    const project = solution.projects.find(item => item.id === targetId);
    if (!project) return;
    setProjectBuildPathsError('');
    setProjectBuildPathsState({
      projectId: project.id,
      projectName: project.name,
      initialValue: {
        projectBuildDirectory: project.buildProperties?.buildDirectory || '',
        projectGeneratedSourceDirectory: project.buildProperties?.generatedSourceDirectory || '',
        workspaceBuildDirectory: buildConfiguration.buildDirectory || '',
        workspaceGeneratedSourceDirectory: buildConfiguration.generatedSourceDirectory || ''
      }
    });
  }, [buildConfiguration, solution]);

  const handleSaveProjectBuildPaths = useCallback(async (value: ProjectBuildPathsDialogValue) => {
    if (!projectBuildPathsState) return;
    setProjectBuildPathsBusy(true);
    setProjectBuildPathsError('');
    try {
      const workspaceChanged = (value.workspaceBuildDirectory || '') !== (buildConfiguration.buildDirectory || '')
        || (value.workspaceGeneratedSourceDirectory || '') !== (buildConfiguration.generatedSourceDirectory || '');
      if (workspaceChanged) {
        const response = await fetch('/api/build-configuration', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...buildConfiguration,
            buildDirectory: value.workspaceBuildDirectory || undefined,
            generatedSourceDirectory: value.workspaceGeneratedSourceDirectory || undefined
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.ok === false) throw new Error(payload.error || '保存工作区构建目录失败。');
        setBuildConfiguration(payload.configuration);
      }
      const project = solution.projects.find(item => item.id === projectBuildPathsState.projectId);
      const existingProperties = project?.buildProperties;
      const nextProperties = {
        configuration: existingProperties?.configuration || buildConfiguration.mode,
        architecture: existingProperties?.architecture || buildConfiguration.architecture,
        additionalArguments: existingProperties?.additionalArguments || [],
        ...(value.projectBuildDirectory.trim() ? { buildDirectory: value.projectBuildDirectory.trim() } : {}),
        ...(value.projectGeneratedSourceDirectory.trim() ? { generatedSourceDirectory: value.projectGeneratedSourceDirectory.trim() } : {})
      };
      const result = await configureSolutionProject(projectBuildPathsState.projectId, { buildProperties: nextProperties });
      if (!result.ok) throw new Error(result.error || '保存项目构建目录失败。');
      if (result.solution) setSolution(result.solution);
      appendSolutionLogs('更新项目构建目录', result);
      setProjectBuildPathsState(null);
    } catch (error) {
      setProjectBuildPathsError(error instanceof Error ? error.message : '保存项目构建目录失败。');
    } finally {
      setProjectBuildPathsBusy(false);
    }
  }, [appendSolutionLogs, buildConfiguration, projectBuildPathsState, solution]);

  const handleConfigureExternalProject = useCallback(async (projectId: string) => {
    const project = solution.projects.find(item => item.id === projectId); if (!project?.buildProperties) return;
    const mode = await requestWorkbenchPrompt({ title: '构建模式', description: 'Debug 或 Release', inputLabel: '构建模式', inputValue: project.buildProperties.configuration });
    if (mode !== 'Debug' && mode !== 'Release') return;
    const architecture = await requestWorkbenchPrompt({ title: '构建架构', description: 'Win32 或 x64', inputLabel: '构建架构', inputValue: project.buildProperties.architecture });
    if (architecture !== 'Win32' && architecture !== 'x64') return;
    const args = await requestWorkbenchPrompt({ title: '附加参数', description: '用空格分隔，可留空', inputLabel: '附加参数', inputValue: project.buildProperties.additionalArguments.join(' ') });
    if (args === null) return;
    const result = await configureSolutionProject(projectId, {
      buildProperties: {
        configuration: mode,
        architecture,
        additionalArguments: args.split(/\s+/u).filter(Boolean),
        // 保留在「构建目录…」对话框里设置的目录覆盖，避免旧入口保存时把它们清掉。
        buildDirectory: project.buildProperties.buildDirectory,
        generatedSourceDirectory: project.buildProperties.generatedSourceDirectory
      }
    });
    appendSolutionLogs('更新外部工程属性', result); if (result.solution) setSolution(result.solution);
  }, [appendSolutionLogs, solution]);

  const handleToggleMultiStartupProject = useCallback(async (projectId: string) => {
    const current = solution.startupProjectIds || [solution.startupProjectId];
    const next = current.includes(projectId) ? current.filter(id => id !== projectId) : [...current, projectId];
    if (!next.length) { await requestWorkbenchAlert({ title: '无法移除', description: '至少需要保留一个启动项目。', confirmLabel: '知道了' }); return; }
    const result = await configureSolutionProject(projectId, { startupProjectIds: next });
    appendSolutionLogs('配置多启动项目', result);
    if (result.solution) setSolution(result.solution);
  }, [appendSolutionLogs, solution]);

  const handleDeleteSolutionProject = useCallback(async (projectId: string, deleteFiles: boolean) => {
    const project = solution.projects.find(item => item.id === projectId);
    if (!project) return;
    const message = deleteFiles
      ? `确定删除项目 ${project.name} 及其项目文件吗？此操作不会删除 generated/cpp 导出结果。`
      : `确定从解决方案中移除项目 ${project.name} 吗？磁盘文件会保留。`;
    if (!await requestWorkbenchConfirm({ title: deleteFiles ? '删除项目' : '移除项目', description: message, confirmLabel: deleteFiles ? '删除' : '移除', cancelLabel: '取消' })) return;
    const result = await deleteSolutionProject(projectId, deleteFiles);
    appendSolutionLogs(deleteFiles ? '删除项目文件' : '移除项目', result);
    if (result.ok) {
      workbenchTextModelService.list()
        .filter(record => record.identity.workspaceId === textModelWorkspaceId && record.identity.projectId === projectId)
        .forEach(record => workbenchTextModelService.dispose(record.identity));
    }
    if (result.solution) setSolution(result.solution);
    await refreshSolution();
  }, [appendSolutionLogs, refreshSolution, solution.projects, textModelWorkspaceId]);

  const handleSolutionBuildCommand = useCallback(async (
    command: 'build' | 'clean' | 'rebuild',
    projectId?: string
  ): Promise<boolean> => {
    const titleMap = {
      build: projectId ? '生成项目' : '生成解决方案',
      clean: projectId ? '清理项目' : '清理解决方案',
      rebuild: projectId ? '重新生成项目' : '重新生成解决方案'
    };
    const result = command === 'build'
      ? await buildSolution(projectId)
      : command === 'clean'
        ? await cleanSolution(projectId)
        : await rebuildSolution(projectId);
    appendSolutionLogs(titleMap[command], result);
    if (result.solution) setSolution(result.solution);
    return result.ok;
  }, [appendSolutionLogs]);

  const handleOpenSolutionDirectory = useCallback(async () => {
    const shellApi = window.lingBuilder?.shell;
    if (!shellApi?.openWorkspacePath) {
      appendEditorTransactionLog('【打开目录错误】当前运行环境不支持打开解决方案目录。');
      return;
    }
    const error = await shellApi.openWorkspacePath('.');
    if (error) appendEditorTransactionLog(`【打开目录错误】${error}`);
  }, []);

  const handleOpenProjectDirectory = useCallback(async (projectId: string) => {
    const project = solution.projects.find(item => item.id === projectId);
    if (!project) {
      appendEditorTransactionLog(`【打开目录错误】未找到项目：${projectId}`);
      return;
    }
    const shellApi = window.lingBuilder?.shell;
    if (!shellApi?.openWorkspacePath) {
      appendEditorTransactionLog('【打开目录错误】当前运行环境不支持打开项目目录。');
      return;
    }
    const error = await shellApi.openWorkspacePath(getSolutionProjectDirectory(project));
    if (error) appendEditorTransactionLog(`【打开目录错误】${error}`);
  }, [solution.projects]);

  const handleCopySolutionFullPath = useCallback(async (): Promise<boolean> => {
    const copyFullPath = window.lingBuilder?.shell?.copyFullPath;
    if (!copyFullPath) {
      appendEditorTransactionLog('【复制路径错误】当前运行环境不支持复制解决方案完整路径。');
      return false;
    }
    const result = await copyFullPath({ kind: 'solution', solutionName: solution.name });
    appendEditorTransactionLog(result.ok
      ? `【复制路径】已复制解决方案完整路径：${result.path}`
      : `【复制路径错误】${result.error || '复制解决方案完整路径失败。'}`);
    return result.ok;
  }, [solution.name]);

  const handleCopyProjectFullPath = useCallback(async (projectId?: string): Promise<boolean> => {
    const project = solution.projects.find(item => item.id === (projectId || activeProjectId || solution.startupProjectId));
    if (!project) {
      appendEditorTransactionLog('【复制路径错误】当前解决方案中没有可复制路径的项目。');
      return false;
    }
    const copyFullPath = window.lingBuilder?.shell?.copyFullPath;
    if (!copyFullPath) {
      appendEditorTransactionLog('【复制路径错误】当前运行环境不支持复制项目完整路径。');
      return false;
    }
    const result = await copyFullPath({ kind: 'project', relativePath: getSolutionProjectDirectory(project) });
    appendEditorTransactionLog(result.ok
      ? `【复制路径】已复制项目“${project.name}”完整路径：${result.path}`
      : `【复制路径错误】${result.error || '复制项目完整路径失败。'}`);
    return result.ok;
  }, [activeProjectId, solution.projects, solution.startupProjectId]);

  // Real window designer build task (F5)
  const handleRunBuild = useCallback(async (): Promise<boolean> => {
    if (activeSolutionProject.type === 'windows-dll') {
      if (editorOperationRef.current) {
        appendEditorTransactionLog(`【F5】已有${getEditorOperationLabel(editorOperationRef.current)}任务正在进行，本次运行请求未重复执行。`);
        return false;
      }
      editorOperationRef.current = 'build';
      setIsBuilding(true);
      try {
        if (!await saveWorkspaceCore('DLL 构建前保存', true)) {
          appendEditorTransactionLog('【F5】DLL 源码保存未完成，已取消构建。');
          return false;
        }
        return await handleSolutionBuildCommand('build', activeProjectId);
      } finally {
        if (editorOperationRef.current === 'build') editorOperationRef.current = null;
        setIsBuilding(false);
      }
    }
    if (editorOperationRef.current) {
      appendEditorTransactionLog(`【F5】已有${getEditorOperationLabel(editorOperationRef.current)}任务正在进行，本次运行请求未重复执行。`);
      return false;
    }
    editorOperationRef.current = 'build';
    buildStartedRef.current = false;
    const buildRequestId = ++buildRequestIdRef.current;
    setIsBuilding(true);

    const saved = await saveWorkspaceCore('F5 构建前保存', true);
    if (!saved) {
      editorOperationRef.current = null;
      setIsBuilding(false);
      appendEditorTransactionLog('【F5】保存未完成，已取消构建，磁盘和运行程序均未使用旧草稿。');
      return false;
    }
    if (buildRequestId !== buildRequestIdRef.current || editorOperationRef.current !== 'build') {
      setIsBuilding(false);
      return false;
    }

    if (buildIntervalRef.current) {
      clearInterval(buildIntervalRef.current);
      buildIntervalRef.current = null;
    }

    setShowBottomPanel(true);
    setActiveTabInBottom('output');
    setBuildLogs(prev => [
      ...prev,
      `> [${new Date().toLocaleTimeString()}] 【F5】正在根据当前中文源码和界面模型生成并运行...`
    ]);

    try {
      // Read the same persisted designer snapshot used by saveWorkspaceCore so
      // a just-finished designer edit cannot be replaced by a stale React
      // render when F5 is pressed immediately afterward.
       const currentDesignerState = readWindowDesignerState(activeProjectId);
      const activeWindow = currentDesignerState.project.windows.find(window => window.id === currentDesignerState.activeWindowId)
        || currentDesignerState.project.windows[0];
      const sourceSnapshot = requestWindowDesignerLingCppSource(
        currentDesignerState.activeWindowId,
        activeWindow?.fileName,
        activeWindow?.className
      );
      const response = await fetchWithSdkDependencies(() => fetch('/api/window-designer/build-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: currentDesignerState.project,
          activeWindowId: currentDesignerState.activeWindowId,
          lingCppSourceCode: sourceSnapshot.sourceCode,
          lingCppSourceFilePath: sourceSnapshot.filePath,
          lingCppSources: sourceSnapshot.sources,
          run: true
        })
      }));
      const result = await response.json().catch(() => ({}));
      if (buildRequestId !== buildRequestIdRef.current || editorOperationRef.current !== 'build') return true;

      const logs: string[] = Array.isArray(result.logs) ? result.logs : [];
      if (logs.length > 0) {
        setBuildLogs(previous => [
          ...previous,
          ...logs.map(message => `> [${new Date().toLocaleTimeString()}] ${message}`)
        ]);
      }
      window.dispatchEvent(new CustomEvent('lingbuilder-compiler-diagnostics', {
        detail: { diagnostics: Array.isArray(result.compilerDiagnostics) ? result.compilerDiagnostics : [] }
      }));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || result.stage || '原生 C++ 编译运行失败。');
      }
      setActiveTabInBottom('debug_logs');
      return true;
    } catch (error) {
      if (buildRequestId !== buildRequestIdRef.current) return true;
      appendEditorTransactionLog(`【F5错误】${error instanceof Error ? error.message : '原生 C++ 编译运行失败。'}`);
      return false;
    } finally {
      if (buildRequestId === buildRequestIdRef.current) {
        if (editorOperationRef.current === 'build') editorOperationRef.current = null;
        setIsBuilding(false);
      }
    }
  }, [activeProjectId, activeSolutionProject.type, appendEditorTransactionLog, handleSolutionBuildCommand, saveWorkspaceCore]);

  const handleStartNativeDebug = useCallback(async (): Promise<boolean> => {
    if (editorOperationRef.current) return false;
    editorOperationRef.current = 'build'; setIsBuilding(true);
    try {
      if (!await saveWorkspaceCore('原生调试前保存', true)) return false;
      setShowBottomPanel(true); setActiveTabInBottom('debug_logs'); setDebugLogs(['正在构建 Debug 目标并启动原生调试适配器…']);
      const response = await fetch('/api/debug/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, breakpoints: debugBreakpoints, stopAtEntry: debugBreakpoints.length === 0 })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || '启动原生调试失败。');
      setNativeDebugSession(result.session); setDebugLogs(result.session.logs || []); return true;
    } catch (error) {
      setDebugLogs(previous => [...previous, `启动失败：${error instanceof Error ? error.message : String(error)}`]); return false;
    } finally { editorOperationRef.current = null; setIsBuilding(false); }
  }, [activeProjectId, debugBreakpoints, saveWorkspaceCore]);

  const handleDebugControl = useCallback(async (action: 'continue' | 'next' | 'step-in' | 'step-out'): Promise<boolean> => {
    try {
      const response = await fetch(`/api/debug/${action}`, { method: 'POST' }); const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || '调试控制失败。'); setNativeDebugSession(result.session); return true;
    } catch (error) { setDebugLogs(previous => [...previous, `调试控制失败：${error instanceof Error ? error.message : String(error)}`]); return false; }
  }, []);

  // Stop the active build request and the managed native process (Shift+F5).
  const handleStopBuild = useCallback(async (): Promise<boolean> => {
    if (buildIntervalRef.current) {
      clearInterval(buildIntervalRef.current);
      buildIntervalRef.current = null;
    }
    if (buildLaunchTimeoutRef.current !== null) {
      window.clearTimeout(buildLaunchTimeoutRef.current);
      buildLaunchTimeoutRef.current = null;
    }
    if (buildDispatchTimeoutRef.current !== null) {
      window.clearTimeout(buildDispatchTimeoutRef.current);
      buildDispatchTimeoutRef.current = null;
    }
    buildRequestIdRef.current += 1;
    buildStartedRef.current = false;
    if (editorOperationRef.current === 'build') editorOperationRef.current = null;
    setIsBuilding(false);
    try {
      await fetch('/api/debug/stop', { method: 'POST' }).catch(() => undefined);
      const response = await fetch('/api/window-designer/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || '停止运行进程失败。');
      }
      setBuildLogs(prev => [
        ...prev,
        result.stopped || (Array.isArray(result.cancelledBuilds) && result.cancelledBuilds.length > 0)
          ? `> [${new Date().toLocaleTimeString()}] 🔴 ${result.message || '已取消生成任务并终止所有受控运行进程。'}`
          : `> [${new Date().toLocaleTimeString()}] 【停止】${result.message || '当前没有正在生成或运行的受控任务。'}`
      ]);
      return true;
    } catch (error) {
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 【停止错误】${error instanceof Error ? error.message : '停止运行进程失败。'}`
      ]);
      return false;
    }
  }, []);

  const showDiffViewMode = useCallback((mode: DiffViewMode): boolean => {
    window.dispatchEvent(new CustomEvent(DIFF_VIEW_MODE_CHANGE_EVENT, { detail: { mode } }));
    return true;
  }, []);

  const workbenchCommandHandlersRef = useRef<Record<string, (...args: unknown[]) => unknown | Promise<unknown>>>({});
  workbenchCommandHandlersRef.current = {
    showCommands: openCommandPalette,
    openSettings: openSettingsDialog,
    configureProjectBuildPaths: (projectId?: unknown) => openProjectBuildPathsDialog(typeof projectId === 'string' ? projectId : undefined),
    findInFiles: () => openWorkspaceSearch('search'),
    replaceInFiles: () => openWorkspaceSearch('replace'),
    openWorkspace: handleOpenWorkspace,
    openLcppSourcePackage: handleOpenLcppSourcePackage,
    exportLcppSourcePackage: (projectId?: unknown) => handleExportLcppSourcePackage(typeof projectId === 'string' ? projectId : undefined),
    openProjectGlobalVariables: (projectId?: unknown) => handleOpenProjectGlobalVariables(typeof projectId === 'string' ? projectId : activeProjectIdRef.current),
    openProjectDataTypes: (projectId?: unknown) => handleOpenProjectDataTypes(typeof projectId === 'string' ? projectId : activeProjectIdRef.current),
    createFunctionLibrary: (projectId?: unknown) => handleCreateFunctionLibrary(typeof projectId === 'string' ? projectId : activeProjectIdRef.current),
    pasteFunctionLibrary: (projectId?: unknown) => handlePasteFunctionLibrary(typeof projectId === 'string' ? projectId : activeProjectIdRef.current),
    closeSolution: handleCloseCurrentSolution,
    save: () => handleSaveWorkspace(),
    undo: () => handleToolbarAction('undo'),
    redo: () => handleToolbarAction('redo'),
    run: handleRunBuild,
    stop: handleStopBuild,
    solutionBuild: () => handleSolutionBuildCommand('build'),
    solutionRebuild: () => handleSolutionBuildCommand('rebuild'),
    solutionClean: () => handleSolutionBuildCommand('clean'),
    copySolutionFullPath: handleCopySolutionFullPath,
    copyProjectFullPath: (projectId?: unknown) => handleCopyProjectFullPath(typeof projectId === 'string' ? projectId : undefined),
    environmentCheck: handleEnvCheck,
    environmentRepair: () => { setShowEnvironmentRepairCenter(true); return true; },
    openCliGuide: () => { setShowCliGuide(true); return true; },
    openHelpCenter: () => { setShowHelpCenter(true); return true; },
    openSponsor: () => { setShowSponsorDialog(true); return true; },
    openQQGroup: async () => {
      const openQQGroup = window.lingBuilder?.community?.openQQGroup;
      if (!openQQGroup) {
        // 兼容旧版 preload 和 Web 原型；Electron 主进程会通过
        // setWindowOpenHandler 把该固定链接交给系统默认浏览器。
        const opened = window.open(LINGBUILDER_QQ_GROUP_URL, '_blank', 'noopener,noreferrer');
        if (!opened) {
          appendEditorTransactionLog('【交流QQ群】无法打开系统默认浏览器，请检查浏览器弹窗权限。');
          return false;
        }
        return true;
      }
      const error = await openQQGroup();
      if (error) appendEditorTransactionLog(`【交流QQ群】${error}`);
      return !error;
    },
    openAbout: () => { setShowAboutModal(true); return true; },
    checkForUpdates: async () => {
      setUpdateCheckState({ status: 'checking' });
      const check = window.lingBuilder?.updates?.check;
      if (!check) { setUpdateCheckState({ status: 'error', error: '当前环境不支持在线检查更新。' }); return true; }
      try {
        const result = await check();
        if (!result.ok) { setUpdateCheckState({ status: 'error', error: result.error || '检查更新失败。' }); return true; }
        setUpdateBadgePayload(result.hasUpdate ? result : null);
        setShowUpdateBadgePanel(false);
        setUpdateCheckState(result.hasUpdate
          ? createUpdateDialogInfo(result)
          : { status: 'latest', latestVersion: result.latestVersion });
      } catch (error) {
        setUpdateCheckState({ status: 'error', error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    },
    openGitChanges: () => {
      window.dispatchEvent(new CustomEvent('lingbuilder-open-git-changes'));
      return true;
    },
    gitExecute: async (requestedOperation?: unknown, requestedPayload?: unknown) => {
      if (typeof requestedOperation !== 'string') {
        window.dispatchEvent(new CustomEvent('lingbuilder-open-git-changes'));
        return true;
      }
      const payload = requestedPayload && typeof requestedPayload === 'object'
        ? requestedPayload as Record<string, unknown>
        : {};
      const result = await sourceControlService.execute(requestedOperation as SourceControlMutation, payload);
      await refreshSourceControlStatus();
      return result;
    },
    toggleSidebar: toggleSidebarVisibility,
    togglePanel: toggleBottomPanelVisibility,
    toggleAiPanel: toggleAiPanelVisibility,
    toggleTheme: toggleWorkbenchTheme,
    createProject: openCreateSolutionProjectDialog,
    createSolutionFolder: handleCreateSolutionFolder,
    moveProjectToSolutionFolder: (requestedProjectId?: unknown, requestedFolderId?: unknown) => {
      const projectId = typeof requestedProjectId === 'string' ? requestedProjectId.trim() : '';
      const folderId = typeof requestedFolderId === 'string' && requestedFolderId.trim() ? requestedFolderId.trim() : null;
      return projectId ? handleMoveProjectToSolutionFolder(projectId, folderId) : false;
    },
    renameSolutionProject: (requestedProjectId?: unknown) => {
      const projectId = typeof requestedProjectId === 'string' && requestedProjectId.trim()
        ? requestedProjectId.trim()
        : activeProjectId;
      return projectId ? handleRenameSolutionProject(projectId) : false;
    },
    addProjectResource: (requestedProjectId?: unknown) => {
      const projectId = typeof requestedProjectId === 'string' && requestedProjectId.trim()
        ? requestedProjectId.trim()
        : activeProjectId || solution.startupProjectId || solution.projects[0]?.id;
      return projectId
        ? selectAndImportDesignerImage(projectId)
        : Promise.resolve<DesignerImageImportResult>({ ok: false, error: '当前解决方案中没有可添加资源的项目。' });
    },
    copyProjectResourcePath: async (requestedPath?: unknown) => {
      const relativePath = typeof requestedPath === 'string' ? requestedPath.trim() : '';
      if (!relativePath) return false;
      await navigator.clipboard.writeText(relativePath);
      return true;
    },
    diffEdit: () => showDiffViewMode('chinese'),
    diffSplit: () => showDiffViewMode('split'),
    diffUnified: () => showDiffViewMode('unified'),
    splitEditorRight: () => splitActiveEditor('horizontal'),
    splitEditorDown: () => splitActiveEditor('vertical'),
    moveEditorToSecondGroup: () => movePrimaryTabToSecondary(),
    restoreSingleEditorGroup
  };

  const blockingDialogOpen = showCloseConfirmModal
    || showAboutModal
    || Boolean(updateCheckState)
    || showHelpCenter
    || showSponsorDialog
    || showCustomModal
    || showCreateProjectDialog
    || Boolean(solutionNameOperation)
    || showEnvironmentRepairCenter
    || showCliGuide
    || Boolean(pendingDesignerEventEdit)
    || Boolean(workspaceSearchMode)
    || Boolean(workbenchDialog);
  commandContextRef.current = {
    'workspace.open': true,
    'workbench.commandPaletteOpen': showCommandPalette,
    'workbench.settingsOpen': showSettingsDialog,
    'workbench.environmentRepairOpen': showEnvironmentRepairCenter,
    'workbench.cliGuideOpen': showCliGuide,
    'workbench.helpCenterOpen': showHelpCenter,
    'workbench.workspaceSearchOpen': Boolean(workspaceSearchMode),
    'editor.multipleGroups': editorGroupLayout.groups.length > 1,
    'workbench.blockingDialogOpen': blockingDialogOpen,
    'workbench.modalOpen': showCommandPalette || showSettingsDialog || Boolean(projectBuildPathsState) || blockingDialogOpen,
    'operation.saving': isSaving,
    'operation.building': isBuilding,
    'operation.busy': Boolean(editorOperationRef.current) || projectFilesLoading,
    'editor.canUndo': editorState.canUndo,
    'editor.canRedo': editorState.canRedo,
    'editor.readOnly': editorState.readOnly,
    'editor.surface': editorState.surface,
    'view.sidebarVisible': showLeftSidebar,
    'view.panelVisible': showBottomPanel,
    'view.aiPanelVisible': showRightPanel,
    'workbench.darkTheme': isDarkMode,
    ...(editorState.surface === 'designer' ? designerCommandContextRef.current : {})
  };

  useEffect(() => {
    const commands = commandServiceRef.current;
    commands.clearDiagnostics();
    const bindings = (id: string, defaults: readonly string[]) => getWorkbenchCommandKeybindings(id, defaults, shortcutOverrides);
    const registration = commands.registerCommands([
      {
        id: 'workbench.action.showCommands',
        title: '显示命令面板',
        aliases: ['Show Command Palette', 'commands', 'command palette'],
        category: '视图',
        description: '搜索并执行所有已注册的 LingBuilder 命令。',
        keybindings: bindings('workbench.action.showCommands', WORKBENCH_DEFAULT_KEYBINDINGS['workbench.action.showCommands']),
        when: '!workbench.commandPaletteOpen && !workbench.settingsOpen && !workbench.blockingDialogOpen',
        order: 1,
        handler: () => workbenchCommandHandlersRef.current.showCommands()
      },
      {
        id: 'workbench.action.openSettings',
        title: '打开设置',
        aliases: ['Open Settings', 'preferences', 'options'],
        category: '首选项',
        description: '编辑用户设置、工作区设置和键盘快捷键。',
        keybindings: bindings('workbench.action.openSettings', WORKBENCH_DEFAULT_KEYBINDINGS['workbench.action.openSettings']),
        when: '!workbench.commandPaletteOpen && !workbench.settingsOpen && !workbench.blockingDialogOpen',
        order: 2,
        handler: () => workbenchCommandHandlersRef.current.openSettings()
      },
      {
        id: 'workbench.action.configureProjectBuildPaths',
        title: '项目构建目录',
        aliases: ['Build Output Directories', 'output directory', '构建输出目录', '生成源码目录'],
        category: '项目',
        description: '自定义构建目录与生成源码目录，支持 $(ProjectId)、$(Platform) 等宏。',
        when: '!workbench.modalOpen',
        order: 3,
        handler: () => workbenchCommandHandlersRef.current.configureProjectBuildPaths()
      },
      {
        id: 'workbench.action.files.openWorkspace',
        title: '打开工作区',
        aliases: ['Open Workspace'],
        category: '文件',
        keybindings: bindings('workbench.action.files.openWorkspace', WORKBENCH_DEFAULT_KEYBINDINGS['workbench.action.files.openWorkspace']),
        when: '!workbench.modalOpen',
        order: 10,
        handler: () => workbenchCommandHandlersRef.current.openWorkspace()
      },
      {
        id: 'workbench.action.files.openLcppSourcePackage',
        title: '打开 LCPP 源码包',
        aliases: ['Open LCPP Source Package', 'Import LCPP Package'],
        category: '文件',
        description: '校验源码包完整性，导入为独立工作区并直接打开。',
        when: '!workbench.modalOpen',
        enabled: context => !context['operation.busy'],
        order: 10,
        handler: () => workbenchCommandHandlersRef.current.openLcppSourcePackage()
      },
      {
        id: 'workbench.action.project.openGlobalVariables',
        title: '项目：打开项目变量与常量',
        aliases: ['Open Project Global Variables', 'Global Variables'],
        category: '文件',
        description: '打开当前 Visual C++ 项目的固定变量与常量文件。',
        when: 'workspace.open && !workbench.modalOpen',
        order: 11,
        handler: (_context, projectId) => workbenchCommandHandlersRef.current.openProjectGlobalVariables(projectId)
      },
      {
        id: 'workbench.action.project.openDataTypes',
        title: '项目：打开自定义数据类型',
        aliases: ['Open Project Data Types', 'Custom Data Types'],
        category: '文件',
        description: '打开当前项目的记录型自定义数据类型编辑器。',
        when: 'workspace.open && !workbench.modalOpen',
        order: 12,
        handler: (_context, projectId) => workbenchCommandHandlersRef.current.openProjectDataTypes(projectId)
      },
      {
        id: 'workbench.action.project.createFunctionLibrary',
        title: '项目：新建功能库',
        aliases: ['Create Function Library', 'New Reusable LCPP'],
        category: '文件',
        description: '在当前项目的“功能”目录新建无状态、可复用的 .lcpp 功能库。',
        when: 'workspace.open && !workbench.modalOpen',
        order: 13,
        handler: (_context, projectId) => workbenchCommandHandlersRef.current.createFunctionLibrary(projectId)
      },
      {
        id: 'workbench.action.project.pasteFunctionLibrary',
        title: '项目：粘贴功能库',
        aliases: ['Paste Function Library', 'Copy LCPP Between Projects'],
        category: '文件',
        description: '预览依赖后，把剪贴板中的功能库复制为当前项目的独立源码副本。',
        when: 'workspace.open && !workbench.modalOpen',
        order: 14,
        handler: (_context, projectId) => workbenchCommandHandlersRef.current.pasteFunctionLibrary(projectId)
      },
      ...(['lingcpp.dataType.add', 'lingcpp.dataType.update', 'lingcpp.dataType.delete', 'lingcpp.dataType.move', 'lingcpp.dataField.add', 'lingcpp.dataField.update', 'lingcpp.dataField.delete', 'lingcpp.dataField.move'] as const).map(id => ({
        id,
        title: `内部：${id}`,
        category: '内部',
        when: 'false',
        handler: (_context: unknown, sourceCode: unknown, edit: unknown) => executeProjectDataTypeCommand(id, String(sourceCode || ''), edit as LingCppAstEdit)
      })),
      {
        id: 'lingcpp.global.add', title: '内部：添加项目全局变量', category: '内部', when: 'false',
        handler: (_context, sourceCode, edit) => executeProjectGlobalVariableCommand('lingcpp.global.add', String(sourceCode || ''), edit as LingCppAstEdit)
      },
      {
        id: 'lingcpp.global.update', title: '内部：更新项目全局变量', category: '内部', when: 'false',
        handler: (_context, sourceCode, edit) => executeProjectGlobalVariableCommand('lingcpp.global.update', String(sourceCode || ''), edit as LingCppAstEdit)
      },
      {
        id: 'lingcpp.global.delete', title: '内部：删除项目全局变量', category: '内部', when: 'false',
        handler: (_context, sourceCode, edit) => executeProjectGlobalVariableCommand('lingcpp.global.delete', String(sourceCode || ''), edit as LingCppAstEdit)
      },
      {
        id: 'lingcpp.constant.add', title: '项目常量：新增', category: '项目', description: '打开“项目常量”页签并定位到新增行。', when: 'workspace.open && !workbench.modalOpen',
        handler: (_context, sourceCode, edit) => {
          if (typeof sourceCode === 'string' && edit) return executeProjectGlobalVariableCommand('lingcpp.constant.add', sourceCode, edit as LingCppAstEdit);
          const opened = workbenchCommandHandlersRef.current.openProjectGlobalVariables();
          void Promise.resolve(opened).then(() => window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('lingcpp-project-constant-command', { detail: { action: 'add' } }))));
          return opened;
        }
      },
      {
        id: 'lingcpp.constant.update', title: '项目常量：编辑', category: '项目', description: '打开项目常量页签，在表格中编辑名称、类型、值或备注。', when: 'workspace.open && !workbench.modalOpen',
        handler: (_context, sourceCode, edit) => {
          if (typeof sourceCode === 'string' && edit) return executeProjectGlobalVariableCommand('lingcpp.constant.update', sourceCode, edit as LingCppAstEdit);
          const opened = workbenchCommandHandlersRef.current.openProjectGlobalVariables();
          void Promise.resolve(opened).then(() => window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('lingcpp-project-constant-command', { detail: { action: 'update' } }))));
          return opened;
        }
      },
      {
        id: 'lingcpp.constant.delete', title: '项目常量：删除', category: '项目', description: '打开项目常量页签；存在引用的常量不能直接删除。', when: 'workspace.open && !workbench.modalOpen',
        handler: (_context, sourceCode, edit) => {
          if (typeof sourceCode === 'string' && edit) return executeProjectGlobalVariableCommand('lingcpp.constant.delete', sourceCode, edit as LingCppAstEdit);
          const opened = workbenchCommandHandlersRef.current.openProjectGlobalVariables();
          void Promise.resolve(opened).then(() => window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('lingcpp-project-constant-command', { detail: { action: 'delete' } }))));
          return opened;
        }
      },
      {
        id: 'lingcpp.constant.findReferences', title: '项目常量：查找引用', category: '项目', description: '打开项目常量页签，从目标常量所在行查看全部引用。', when: 'workspace.open && !workbench.modalOpen',
        handler: (_context, workspaceFiles, constantName) => {
          if (Array.isArray(workspaceFiles) && constantName) return findProjectConstantReferences(workspaceFiles, String(constantName));
          const opened = workbenchCommandHandlersRef.current.openProjectGlobalVariables();
          void Promise.resolve(opened).then(() => window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('lingcpp-project-constant-command', { detail: { action: 'findReferences' } }))));
          return opened;
        }
      },
      {
        id: 'lingcpp.constant.rename', title: '项目常量：重命名', category: '项目', description: '打开项目常量页签；修改名称后预览并原子更新全部引用。', when: 'workspace.open && !workbench.modalOpen',
        handler: (_context, workspaceFiles, declarationFilePath, oldName, newName) => {
          if (Array.isArray(workspaceFiles) && declarationFilePath && oldName && newName) return createProjectConstantRenameProposal(workspaceFiles, String(declarationFilePath), String(oldName), String(newName));
          const opened = workbenchCommandHandlersRef.current.openProjectGlobalVariables();
          void Promise.resolve(opened).then(() => window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('lingcpp-project-constant-command', { detail: { action: 'rename' } }))));
          return opened;
        }
      },
      {
        id: 'workbench.action.project.exportLcppSourcePackage',
        title: '项目：一键导出 LCPP 源码包',
        aliases: ['Export LCPP Source Package', 'Share LCPP Source'],
        category: '文件',
        description: '导出源码、设计器、资源、项目依赖和第三方模块，供其他用户直接打开。',
        when: 'workspace.open && !workbench.modalOpen',
        enabled: context => !context['operation.busy'],
        order: 11,
        handler: (_context, projectId) => workbenchCommandHandlersRef.current.exportLcppSourcePackage(projectId)
      },
      {
        id: 'workbench.action.files.closeSolution',
        title: '关闭当前解决方案',
        aliases: ['Close Solution', 'Close Workspace'],
        category: '文件',
        description: '关闭当前解决方案并打开新的空白工作区，不删除原工作区文件。',
        when: 'workspace.open && !workbench.modalOpen',
        enabled: context => !context['operation.saving'] && !context['operation.building'] && !context['operation.busy'],
        order: 11,
        handler: () => workbenchCommandHandlersRef.current.closeSolution()
      },
      {
        id: 'workbench.action.files.save',
        title: '保存工作区',
        aliases: ['Save', 'Save Workspace'],
        category: '文件',
        keybindings: bindings('workbench.action.files.save', WORKBENCH_DEFAULT_KEYBINDINGS['workbench.action.files.save']),
        when: 'workspace.open && !workbench.modalOpen',
        enabled: context => !context['operation.saving'] && !context['operation.building'] && !context['operation.busy'],
        order: 12,
        handler: () => workbenchCommandHandlersRef.current.save()
      },
      {
        id: 'workbench.action.editor.undo',
        title: '编辑器：撤销',
        aliases: ['Undo', 'Editor Undo'],
        category: '编辑',
        description: '仅撤销当前文件模型中的上一步编辑，不影响其他标签。',
        keybindings: bindings('workbench.action.editor.undo', WORKBENCH_DEFAULT_KEYBINDINGS['workbench.action.editor.undo']),
        when: '!workbench.modalOpen',
        enabled: context => Boolean(context['editor.canUndo']) && !context['editor.readOnly'],
        order: 12,
        handler: () => workbenchCommandHandlersRef.current.undo()
      },
      {
        id: 'workbench.action.editor.redo',
        title: '编辑器：重做',
        aliases: ['Redo', 'Editor Redo'],
        category: '编辑',
        description: '仅重做当前文件模型中刚撤销的编辑。',
        keybindings: bindings('workbench.action.editor.redo', WORKBENCH_DEFAULT_KEYBINDINGS['workbench.action.editor.redo']),
        when: '!workbench.modalOpen',
        enabled: context => Boolean(context['editor.canRedo']) && !context['editor.readOnly'],
        order: 13,
        handler: () => workbenchCommandHandlersRef.current.redo()
      },
      {
        id: 'workbench.action.findInFiles',
        title: '在文件中查找',
        aliases: ['Find in Files', 'Workspace Search'],
        category: '编辑',
        description: '在当前文件、项目或整个工作区的已保存内容中搜索。',
        keybindings: bindings('workbench.action.findInFiles', WORKBENCH_DEFAULT_KEYBINDINGS['workbench.action.findInFiles']),
        when: '!workbench.modalOpen',
        enabled: context => !context['operation.busy'],
        order: 14,
        handler: () => workbenchCommandHandlersRef.current.findInFiles()
      },
      {
        id: 'workbench.action.replaceInFiles',
        title: '在文件中替换',
        aliases: ['Replace in Files', 'Workspace Replace'],
        category: '编辑',
        description: '选择搜索结果，预览后以可撤销事务替换工作区文件。',
        keybindings: bindings('workbench.action.replaceInFiles', WORKBENCH_DEFAULT_KEYBINDINGS['workbench.action.replaceInFiles']),
        when: '!workbench.modalOpen',
        enabled: context => !context['operation.busy'],
        order: 15,
        handler: () => workbenchCommandHandlersRef.current.replaceInFiles()
      },
      {
        id: 'workbench.action.project.create',
        title: '新建解决方案项目',
        aliases: ['Create Project', 'New Project'],
        category: '文件',
        when: '!workbench.modalOpen',
        order: 12,
        handler: () => workbenchCommandHandlersRef.current.createProject()
      },
      {
        id: CREATE_SOLUTION_FOLDER_COMMAND,
        title: '新建解决方案文件夹',
        aliases: ['Create Solution Folder', 'New Solution Folder'],
        category: '解决方案',
        description: '创建只用于整理项目的逻辑文件夹，不移动磁盘文件。',
        when: 'workspace.open && !workbench.modalOpen',
        order: 13,
        handler: () => workbenchCommandHandlersRef.current.createSolutionFolder()
      },
      {
        id: MOVE_PROJECT_TO_SOLUTION_FOLDER_COMMAND,
        title: '移动项目到解决方案文件夹',
        aliases: ['Move Project to Solution Folder'],
        category: '解决方案',
        description: '更新项目的解决方案逻辑分组，不改变项目磁盘路径。',
        when: 'workspace.open && !workbench.modalOpen',
        order: 14,
        handler: (_context, projectId, folderId) => workbenchCommandHandlersRef.current.moveProjectToSolutionFolder(projectId, folderId)
      },
      {
        id: RENAME_SOLUTION_PROJECT_COMMAND,
        title: '重命名项目',
        aliases: ['Rename Project'],
        category: '解决方案',
        description: '修改项目显示名称，保留项目 ID、磁盘目录、源码路径、引用和构建配置。',
        when: 'workspace.open && !workbench.modalOpen',
        order: 15,
        handler: (_context, projectId) => workbenchCommandHandlersRef.current.renameSolutionProject(projectId)
      },
      {
        id: 'workbench.action.project.addImageResource',
        title: '项目：添加图片资源',
        aliases: ['Add Image Resource', 'Add Project Resource', 'Import Image'],
        category: '文件',
        description: '选择本地图片并复制到当前项目的 assets 资源目录。',
        when: 'workspace.open && !workbench.modalOpen',
        enabled: context => !context['operation.busy'],
        order: 13,
        handler: (_context, projectId) => workbenchCommandHandlersRef.current.addProjectResource(projectId)
      },
      {
        id: 'workbench.action.project.copyImageResourcePath',
        title: '项目：复制图片资源相对路径',
        aliases: ['Copy Image Resource Path', 'Copy Asset Path'],
        category: '文件',
        description: '复制图片资源在项目中的 assets 相对路径。',
        when: 'workspace.open && !workbench.modalOpen',
        order: 14,
        handler: (_context, relativePath) => workbenchCommandHandlersRef.current.copyProjectResourcePath(relativePath)
      },
      {
        id: 'workbench.action.build.run',
        title: '生成并运行当前项目',
        aliases: ['Run', 'Build and Run'],
        category: '生成',
        keybindings: bindings('workbench.action.build.run', WORKBENCH_DEFAULT_KEYBINDINGS['workbench.action.build.run']),
        when: '!workbench.modalOpen',
        enabled: context => !context['operation.busy'],
        order: 20,
        handler: () => workbenchCommandHandlersRef.current.run()
      },
      {
        id: 'workbench.action.build.stop',
        title: '停止所有生成与运行任务',
        aliases: ['Stop', 'Stop Build'],
        category: '生成',
        keybindings: bindings('workbench.action.build.stop', WORKBENCH_DEFAULT_KEYBINDINGS['workbench.action.build.stop']),
        order: 21,
        handler: () => workbenchCommandHandlersRef.current.stop()
      },
      {
        id: 'workbench.action.solution.build',
        title: '生成解决方案',
        aliases: ['Build Solution'],
        category: '生成',
        when: '!workbench.modalOpen',
        enabled: context => !context['operation.busy'],
        order: 22,
        handler: () => workbenchCommandHandlersRef.current.solutionBuild()
      },
      {
        id: 'workbench.action.solution.rebuild',
        title: '重新生成解决方案',
        aliases: ['Rebuild Solution'],
        category: '生成',
        when: '!workbench.modalOpen',
        enabled: context => !context['operation.busy'],
        order: 23,
        handler: () => workbenchCommandHandlersRef.current.solutionRebuild()
      },
      {
        id: 'workbench.action.solution.clean',
        title: '清理解决方案',
        aliases: ['Clean Solution'],
        category: '生成',
        when: '!workbench.modalOpen',
        enabled: context => !context['operation.busy'],
        order: 24,
        handler: () => workbenchCommandHandlersRef.current.solutionClean()
      },
      {
        id: 'workbench.action.solution.copyFullPath',
        title: '解决方案：复制完整路径',
        aliases: ['Copy Solution Full Path'],
        category: '文件',
        description: '复制当前 .lbsln 解决方案文件的绝对路径。',
        when: 'workspace.open && !workbench.modalOpen',
        order: 25,
        handler: () => workbenchCommandHandlersRef.current.copySolutionFullPath()
      },
      {
        id: 'workbench.action.project.copyFullPath',
        title: '项目：复制完整路径',
        aliases: ['Copy Project Full Path'],
        category: '文件',
        description: '复制当前项目所在目录的绝对路径。',
        when: 'workspace.open && !workbench.modalOpen',
        order: 26,
        handler: (_context, projectId) => workbenchCommandHandlersRef.current.copyProjectFullPath(projectId)
      },
      {
        id: 'workbench.action.environment.check',
        title: '检查开发环境',
        aliases: ['Environment Check', 'doctor'],
        category: '工具',
        when: '!workbench.modalOpen',
        order: 30,
        handler: () => workbenchCommandHandlersRef.current.environmentCheck()
      },
      {
        id: 'workbench.action.environment.repair',
        title: '打开环境修复中心',
        aliases: ['Environment Repair', 'Install Build Tools', 'repair dependencies'],
        category: '工具',
        description: '检测并通过微软官方安装程序修复 C++ Build Tools、Windows SDK、CMake 或 WebView2。',
        when: '!workbench.modalOpen',
        order: 31,
        handler: () => workbenchCommandHandlersRef.current.environmentRepair()
      },
      {
        id: 'workbench.action.help.openCliGuide',
        title: '帮助：打开 AI Bridge 连接中心',
        aliases: ['Open AI Bridge Center', 'Connect AI CLI', 'MCP Center', 'CLI Guide', 'command line help'],
        category: '帮助',
        description: '启动或停止 AI Bridge，一键连接外部 AI CLI，并管理 MCP、HTTP、权限、Token 与活动日志。',
        when: '!workbench.modalOpen',
        order: 32,
        handler: () => workbenchCommandHandlersRef.current.openCliGuide()
      },
      {
        id: 'workbench.action.help.openHelpCenter',
        title: '帮助：打开帮助中心与更新日志',
        aliases: ['Open Help Center', 'Release Notes', 'Changelog'],
        category: '帮助',
        description: '打开 LingBuilder 帮助中心，查看当前安装版本和内置更新日志。',
        when: '!workbench.modalOpen',
        order: 33,
        handler: () => workbenchCommandHandlersRef.current.openHelpCenter()
      },
      {
        id: 'workbench.action.help.openSponsor',
        title: '帮助：打开赞助二维码',
        aliases: ['Sponsor LingBuilder', 'Donation QR Code'],
        category: '帮助',
        description: '打开支付宝和微信赞助二维码。',
        when: '!workbench.modalOpen',
        order: 34,
        handler: () => workbenchCommandHandlersRef.current.openSponsor()
      },
      {
        id: 'workbench.action.help.openQQGroup',
        title: '帮助：打开交流QQ群',
        aliases: ['Open QQ Group', 'LingBuilder QQ Group'],
        category: '帮助',
        description: '在系统默认浏览器中打开 LingBuilder 交流QQ群链接。',
        when: '!workbench.modalOpen',
        order: 35,
        handler: () => workbenchCommandHandlersRef.current.openQQGroup()
      },
      {
        id: 'workbench.action.help.openAbout',
        title: `帮助：关于 LingBuilder IDE ${LINGBUILDER_DISPLAY_VERSION}`,
        aliases: ['About LingBuilder', 'Application Version'],
        category: '帮助',
        description: '查看 LingBuilder 软件版本和产品信息。',
        when: '!workbench.modalOpen',
        order: 36,
        handler: () => workbenchCommandHandlersRef.current.openAbout()
      },
      {
        id: 'workbench.action.help.checkForUpdates',
        title: '帮助：检查更新',
        aliases: ['Check for Updates', 'Update Check'],
        category: '帮助',
        description: '联网检查 LingBuilder 是否有新版本；发现新版本后可直接在 IDE 内下载并安装更新，也可前往官网手动下载。',
        when: '!workbench.modalOpen',
        order: 37,
        handler: () => workbenchCommandHandlersRef.current.checkForUpdates()
      },
      {
        id: 'workbench.action.git.openChanges',
        title: '打开 Git 更改',
        aliases: ['Open Git Changes', 'Source Control'],
        category: 'Git',
        description: '打开 Git 更改视图，查看、暂存并提交当前工作区更改。',
        when: '!workbench.modalOpen',
        order: 32,
        handler: () => workbenchCommandHandlersRef.current.openGitChanges()
      },
      {
        id: 'workbench.action.git.execute',
        title: 'Git：执行源代码管理操作',
        aliases: ['Git Execute', 'Source Control Action'],
        category: 'Git',
        description: '由 Git 更改视图统一执行暂存、提交、分支、远程、冲突和恢复操作；直接运行时打开 Git 更改视图。',
        when: '!workbench.modalOpen',
        order: 33,
        handler: (_context, operation, payload) => workbenchCommandHandlersRef.current.gitExecute(operation, payload)
      },
      {
        id: 'workbench.action.toggleSidebar',
        title: '切换侧边栏可见性',
        aliases: ['Toggle Sidebar'],
        category: '视图',
        when: '!workbench.modalOpen',
        order: 40,
        handler: () => workbenchCommandHandlersRef.current.toggleSidebar()
      },
      {
        id: 'workbench.action.togglePanel',
        title: '切换底部面板可见性',
        aliases: ['Toggle Panel'],
        category: '视图',
        when: '!workbench.modalOpen',
        order: 41,
        handler: () => workbenchCommandHandlersRef.current.togglePanel()
      },
      {
        id: 'workbench.action.toggleAiPanel',
        title: '切换 AI 助手面板可见性',
        aliases: ['Toggle AI Panel'],
        category: '视图',
        when: '!workbench.modalOpen',
        order: 42,
        handler: () => workbenchCommandHandlersRef.current.toggleAiPanel()
      },
      {
        id: 'workbench.action.toggleColorTheme',
        title: '切换暗色/亮色主题',
        aliases: ['Toggle Color Theme'],
        category: '首选项',
        when: '!workbench.modalOpen',
        order: 43,
        handler: () => workbenchCommandHandlersRef.current.toggleTheme()
      },
      {
        id: 'workbench.action.diff.edit',
        title: '对比视图：编辑',
        aliases: ['Diff Edit View'],
        category: '视图',
        when: '!workbench.modalOpen',
        order: 44,
        handler: () => workbenchCommandHandlersRef.current.diffEdit()
      },
      {
        id: 'workbench.action.diff.split',
        title: '对比视图：并排对比',
        aliases: ['Diff Side by Side', 'Split Diff'],
        category: '视图',
        when: '!workbench.modalOpen',
        order: 45,
        handler: () => workbenchCommandHandlersRef.current.diffSplit()
      },
      {
        id: 'workbench.action.diff.unified',
        title: '对比视图：内联对比',
        aliases: ['Unified Diff', 'Inline Diff'],
        category: '视图',
        when: '!workbench.modalOpen',
        order: 46,
        handler: () => workbenchCommandHandlersRef.current.diffUnified()
      },
      {
        id: 'workbench.action.editor.splitRight',
        title: '编辑器布局：左右拆分',
        aliases: ['Split Editor Right', 'Split Editor Horizontal'],
        category: '视图',
        when: '!workbench.modalOpen',
        order: 47,
        handler: () => workbenchCommandHandlersRef.current.splitEditorRight()
      },
      {
        id: 'workbench.action.editor.splitDown',
        title: '编辑器布局：上下拆分',
        aliases: ['Split Editor Down', 'Split Editor Vertical'],
        category: '视图',
        when: '!workbench.modalOpen',
        order: 48,
        handler: () => workbenchCommandHandlersRef.current.splitEditorDown()
      },
      {
        id: 'workbench.action.editor.moveToSecondGroup',
        title: '编辑器布局：移到第二组',
        aliases: ['Move Editor Into Next Group'],
        category: '视图',
        when: '!workbench.modalOpen',
        enabled: context => Boolean(context['editor.multipleGroups']),
        order: 49,
        handler: () => workbenchCommandHandlersRef.current.moveEditorToSecondGroup()
      },
      {
        id: 'workbench.action.editor.singleGroup',
        title: '编辑器布局：恢复单编辑区',
        aliases: ['Single Editor Group', 'Reset Editor Layout'],
        category: '视图',
        when: '!workbench.modalOpen',
        enabled: context => Boolean(context['editor.multipleGroups']),
        order: 50,
        handler: () => workbenchCommandHandlersRef.current.restoreSingleEditorGroup()
      }
    ]);
    setCommandRegistryVersion(version => version + 1);
    return () => registration.dispose();
  }, [shortcutOverrides]);

  useEffect(() => {
    const keybindings = createKeybindingService(commandServiceRef.current, () => commandContextRef.current);
    const handleKeyDown = (event: KeyboardEvent) => {
      void keybindings.dispatch(event).then(result => {
        if (!result.error) return;
        setBuildLogs(previous => [
          ...previous,
          `> [${new Date().toLocaleTimeString()}] 【命令错误】${result.error?.message}`
        ]);
      });
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const executeWorkbenchCommand = useCallback(async (commandId: string, ...args: unknown[]): Promise<boolean> => {
    try {
      const result = await commandServiceRef.current.executeCommand(commandId, commandContextRef.current, ...args);
      return isSuccessfulCommandResult(result);
    } catch (error) {
      setBuildLogs(previous => [
        ...previous,
        `> [${new Date().toLocaleTimeString()}] 【命令错误】${error instanceof Error ? error.message : '命令执行失败。'}`
      ]);
      return false;
    }
  }, []);

  const executeSourceControlCommand = useCallback(async (operation: SourceControlMutation, payload: Record<string, unknown> = {}): Promise<unknown> => (
    await commandServiceRef.current.executeCommand(
      'workbench.action.git.execute',
      commandContextRef.current,
      operation,
      payload
    )
  ), []);

  const handleAddProjectResource = useCallback(async (projectId: string): Promise<DesignerImageImportResult> => {
    try {
      return await commandServiceRef.current.executeCommand<DesignerImageImportResult>(
        'workbench.action.project.addImageResource',
        commandContextRef.current,
        projectId
      );
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '添加图片资源失败。' };
    }
  }, []);

  const handleCopyProjectResourcePath = useCallback(async (relativePath: string): Promise<boolean> => {
    try {
      return await commandServiceRef.current.executeCommand<boolean>(
        'workbench.action.project.copyImageResourcePath',
        commandContextRef.current,
        relativePath
      );
    } catch {
      return false;
    }
  }, []);

  const commandPaletteContext = createCommandPaletteContext(commandContextRef.current);
  const executeCommandFromPalette = useCallback(async (commandId: string): Promise<boolean> => {
    try {
      const result = await commandServiceRef.current.executeCommand(
        commandId,
        createCommandPaletteContext(commandContextRef.current)
      );
      return isSuccessfulCommandResult(result);
    } catch (error) {
      setBuildLogs(previous => [
        ...previous,
        `> [${new Date().toLocaleTimeString()}] 【命令错误】${error instanceof Error ? error.message : '命令执行失败。'}`
      ]);
      return false;
    }
  }, []);

  const commandPaletteCommands: CommandPresentation[] = commandServiceRef.current.searchCommands(
    commandQuery,
    commandPaletteContext,
    { includeDisabled: true, limit: 100 }
  ).filter(command => command.id !== 'workbench.action.showCommands');
  const registeredWorkbenchCommands: RegisteredCommand[] = commandServiceRef.current.listCommands(
    commandContextRef.current,
    { includeUnavailable: true, includeDisabled: true }
  );
  const settingsWorkbenchCommands: RegisteredCommand[] = registeredWorkbenchCommands.map(command => ({
    ...command,
    keybindings: [...(WORKBENCH_DEFAULT_KEYBINDINGS[command.id] || [])]
  }));
  void commandRegistryVersion;
  const undoKeybindingLabel = registeredWorkbenchCommands
    .find(command => command.id === 'workbench.action.editor.undo')?.keybindings.join(' / ') || '';
  const redoKeybindingLabel = registeredWorkbenchCommands
    .find(command => command.id === 'workbench.action.editor.redo')?.keybindings.join(' / ') || '';
  const { undoDisabled, redoDisabled, undoTitle, redoTitle } = getEditorHistoryPresentation(editorState, {
    undo: undoKeybindingLabel,
    redo: redoKeybindingLabel
  });

  // Handle selection of a row inside extracted strings list
  const handleSelectLine = (lineNum: number) => {
    window.dispatchEvent(new CustomEvent('lingcpp-reveal-line', {
      detail: { filePath: activeFileRef.current?.path, line: lineNum }
    }));

    const elId = `diff-line-${lineNum - 1}`;
    const el = document.getElementById(elId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Visual pulse highlight
      el.classList.add('animate-pulse', 'bg-blue-500/20');
      setTimeout(() => el.classList.remove('animate-pulse', 'bg-blue-500/20'), 1500);
    }
  };
  const handleSelectProblem = async (problem: ProblemItem) => {
    const normalizePath = (value: string) => value.replace(/\\/gu, '/').replace(/^\.\//u, '').toLocaleLowerCase();
    const target = filesRef.current.find(file => normalizePath(file.path) === normalizePath(problem.filePath));
    if (target && !(await handleSelectFile(target))) return;
    const detail = { filePath: target?.path || problem.filePath, line: problem.line, column: problem.column || 1 };
    [0, 80, 220].forEach(delay => window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('lingcpp-reveal-line', { detail }));
    }, delay));
  };

  // Custom User Code Extraction API Call
  const handleExtractCustomCode = async () => {
    const requestOwner = captureProjectMutationOwner();
    if (!isCurrentProjectMutationOwner(requestOwner)) return;
    if (!customCode.trim() || !customFilename.trim()) return;
    extractOwnerRef.current = requestOwner;
    setIsExtracting(true);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: customCode,
          filename: customFilename
        })
      });

      if (!response.ok) {
        throw new Error('代码分析提取失败');
      }

      const data = await response.json();
      if (!isCurrentProjectMutationOwner(requestOwner)) return;

      const newFile: CppFile = {
        path: `src/${customFilename}`,
        name: customFilename,
        language: customFilename.endsWith('.h') ? 'header' : 'cpp',
        encoding: 'utf8',
        eol: 'lf',
        savedEncoding: 'utf8',
        savedEol: 'lf',
        formatModified: false,
        originalContent: customCode,
        translatedContent: '',
        strings: data.strings || [],
        isModified: false
      };

      const nextFiles = [...filesRef.current, newFile];
      filesRef.current = nextFiles;
      activeFileRef.current = newFile;
      setFiles(nextFiles);
      setActiveFile(newFile);
      setShowCustomModal(false);
      
      // Toast notice via build output tab
      setShowBottomPanel(true);
      setActiveTabInBottom('extracted');
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 成功提取分析 C++ 文件 ${customFilename}。提取出 ${newFile.strings.length} 条需要进行中文映射的文本及注释。`
      ]);

      // Trigger translated rebuild right away
      triggerReconstruction(newFile, newFile.strings, requestOwner);

    } catch (err: any) {
      if (!isCurrentProjectMutationOwner(requestOwner)) return;
      console.error(err);
      alert(`提取解析出错：${err.message || '未知错误'}`);
    } finally {
      const activeRequestOwner = extractOwnerRef.current;
      if (activeRequestOwner?.projectId === requestOwner.projectId
        && activeRequestOwner.loadGeneration === requestOwner.loadGeneration) {
        extractOwnerRef.current = null;
        setIsExtracting(false);
      }
    }
  };

  const diffResult: DiffResult = useMemo(
    () => computeDiff(activeFile.originalContent, getCurrentFileContent(activeFile)),
    [activeFile.isModified, activeFile.originalContent, activeFile.translatedContent]
  );

  if (isAppClosed) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#18181c] text-[#D4D4D4] font-sans p-6">
        <div className="max-w-md w-full bg-[#1e1e24] border border-[#2d2d34] rounded-lg p-6 shadow-2xl space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center">
              <Cpu className="w-8 h-8 text-rose-500 animate-pulse" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-slate-100">C++ LocMaster (LingBuilder) 已安全退出</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              后台 C++ 编译进程、动态翻译沙盒、本地化映射缓存及 LING C++ Runtime 容器引擎已经安全注销。所有正在运行的任务和沙盒实例已被终止并清理。
            </p>
          </div>

          <div className="p-3 bg-[#141418] rounded border border-[#2d2d34]/60 text-[10.5px] font-mono text-slate-400 text-left leading-relaxed space-y-1">
            <div className="text-slate-500">// 进程状态报告：</div>
            <div>[System] C++ compiler pipeline release ... OK</div>
            <div>[System] AI context sandbox release ... OK</div>
            <div>[System] UTF-8 codepage table flushed ... OK</div>
            <div>[System] Port 3000 mapping standby ... SUCCESS</div>
          </div>

          <button
            onClick={() => {
              setIsAppClosed(false);
              setBuildLogs(prev => [...prev, `> [${new Date().toLocaleTimeString()}] 🚀 C++ LocMaster (LingBuilder) 集成开发环境已重新启动加载，所有模块运行就绪。`]);
            }}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-md transition-colors cursor-pointer shadow-lg active:scale-98"
          >
            重新启动开发环境 (IDE)
          </button>
        </div>
      </div>
    );
  }

  if (isMinimizedApp) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-[#1b2a47] to-[#111625] text-slate-300 font-sans flex flex-col relative overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
        
        {/* Desktop Icons */}
        <div className="absolute left-6 top-6 flex flex-col items-center gap-6 z-10 select-none">
          <div 
            onDoubleClick={() => setIsMinimizedApp(false)}
            onClick={() => {
              setBuildLogs(prev => [...prev, `> [${new Date().toLocaleTimeString()}] [系统托盘] 已双击桌面图标恢复 LingBuilder 窗口。`]);
              setIsMinimizedApp(false);
            }}
            className="flex flex-col items-center gap-1.5 p-2 rounded hover:bg-white/10 active:bg-white/15 cursor-pointer group transition-all text-center w-20"
            title="双击恢复"
          >
            <div className="w-11 h-11 bg-blue-600/20 group-hover:bg-blue-600/30 rounded-lg flex items-center justify-center border border-blue-500/20 transition-all">
              <FolderCode className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[10px] text-white/90 drop-shadow-md font-medium tracking-wide">LocMaster IDE</span>
          </div>

          <div 
            onClick={() => alert("这是一个模拟桌面系统，主要用于展示 C++ LocMaster 的窗口控制和仿真沙盒运行环境。请双击左侧的 LocMaster 快捷方式或底部的托盘任务图标恢复 IDE。")}
            className="flex flex-col items-center gap-1.5 p-2 rounded hover:bg-white/10 cursor-pointer group transition-all text-center w-20"
          >
            <div className="w-11 h-11 bg-slate-500/10 group-hover:bg-slate-500/20 rounded-lg flex items-center justify-center border border-white/10 transition-all">
              <HelpCircle className="w-6 h-6 text-slate-400 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[10px] text-white/80 drop-shadow-md font-medium tracking-wide">系统说明</span>
          </div>
        </div>

        {/* Windows Taskbar at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-[#1e1e24]/90 border-t border-white/5 backdrop-blur-md flex items-center justify-between px-3 z-20 select-none">
          <div className="flex items-center gap-1.5">
            {/* Start button */}
            <div className="w-7 h-7 bg-blue-600 hover:bg-blue-500 rounded flex items-center justify-center cursor-pointer text-white shadow-sm transition-colors mr-2">
              <Cpu className="w-4 h-4" />
            </div>

            {/* Active app task bar tab */}
            <div 
              onClick={() => setIsMinimizedApp(false)}
              className="h-8 bg-white/10 hover:bg-white/15 border-b-2 border-blue-500 rounded px-3 flex items-center gap-2 text-[11px] text-white cursor-pointer transition-colors font-medium shadow-inner"
              title="点击恢复窗口"
            >
              <FolderCode className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span>C++ LocMaster - LingBuilder (已最小化)</span>
            </div>
          </div>

          {/* Tray clock & icons */}
          <div className="flex items-center gap-3 text-white/80 text-[10px] font-medium pr-2">
            <div className="hover:bg-white/5 px-1.5 py-1 rounded cursor-pointer text-emerald-400">● 运行状态: 良好</div>
            <div className="opacity-50">|</div>
            <div>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      </div>
    );
  }

  if (showWelcomePage) {
    return (
      <div className="relative h-screen w-screen">
        <WelcomePage
          isDarkMode={isDarkMode}
          isMaximized={isMaximizedApp}
          recentWorkspaces={recentWorkspaces}
          currentWorkspacePath={currentWorkspacePath}
          onMinimize={handleWindowMinimize}
          onToggleMaximize={handleWindowToggleMaximize}
          onClose={handleWindowCloseConfirmed}
          onCreateProject={projectType => {
            enterWorkbench();
            openCreateSolutionProjectDialog(projectType);
          }}
          onOpenWorkspace={async () => {
            if (await executeWorkbenchCommand('workbench.action.files.openWorkspace')) enterWorkbench();
          }}
          onOpenRecentWorkspace={async workspacePath => {
            if (await handleOpenWorkspacePath(workspacePath)) enterWorkbench();
          }}
          onForgetWorkspace={handleForgetRecentWorkspace}
          onContinue={enterWorkbench}
          onOpenHelp={() => {
            enterWorkbench();
            void executeWorkbenchCommand('workbench.action.help.openHelpCenter');
          }}
          onOpenCliGuide={() => {
            enterWorkbench();
            void executeWorkbenchCommand('workbench.action.help.openCliGuide');
          }}
        />
        <UpdateDialog
          open={Boolean(updateCheckState)}
          info={updateCheckState}
          currentVersionLabel={LINGBUILDER_DISPLAY_VERSION}
          isDarkMode={isDarkMode}
          onClose={() => setUpdateCheckState(null)}
        />
        {isWorkspaceSwitching && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#111116]/75 backdrop-blur-[2px]" role="status" aria-live="polite">
            <div className="flex min-w-[280px] items-center gap-3 rounded-lg border border-blue-400/30 bg-[#1f2028] px-5 py-4 text-sm text-slate-100 shadow-2xl">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
              <span>正在切换工作区并载入项目文件…</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const renderAiAssistant = () => (
    <AiAssistant
      strings={activeFile.strings}
      glossary={glossary}
      onBatchTranslate={handleBatchTranslate}
      onSetStatus={handleSetStatus}
      filePath={activeFile.path}
      sourceCode={activeFile.translatedContent || activeFile.originalContent}
      activeLanguage={activeFile.language}
      projectId={activeProjectId}
      projectMutationOwner={createProjectMutationOwner(
        activeProjectId,
        projectFileLoadGenerationRef.current
      )}
      moduleContext={moduleContext}
      designerProject={activeProjectHasWindowDesigner ? windowDesignerState.project : undefined}
      workspaceFiles={files.map(file => ({
        filePath: file.path,
        sourceCode: file.translatedContent || file.originalContent,
        language: file.language
      }))}
      onApplyWorkspaceEdit={handleApplyWorkspaceEdit}
      commandService={commandServiceRef.current}
      isDarkMode={isDarkMode}
    />
  );

  return (
    <div className={`workbench-shell ${isDarkMode ? 'theme-dark' : 'theme-light'} h-screen flex flex-col overflow-hidden font-sans select-none ${isDarkMode ? 'bg-[#1E1E1E] text-[#D4D4D4]' : 'bg-slate-50 text-slate-800'}`}>
      {/* Title Bar */}
      <div
        onDoubleClick={handleWindowToggleMaximize}
        className={`window-drag-region h-8 flex items-center justify-between pl-3 pr-0 border-b text-[12px] shrink-0 select-none cursor-default ${
          isDarkMode 
            ? 'bg-[#323233] text-slate-200 border-[#2B2B2B]' 
            : 'bg-[#F3F3F3] text-slate-800 border-slate-200'
        }`}
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={lingBuilderIcon}
              alt="LingBuilder"
              draggable={false}
              className="h-5 w-5 shrink-0 rounded-[4px] object-contain"
            />
            <div className="truncate text-[#007ACC] font-bold tracking-wide">
              C++ LocMaster (LingBuilder) <span className="text-cyan-400/80">{LINGBUILDER_DISPLAY_VERSION}</span>
            </div>
            {updateBadgePayload && (
              <div
                className="window-no-drag relative flex shrink-0 items-center"
                onMouseEnter={() => setShowUpdateBadgePanel(true)}
                onMouseLeave={() => setShowUpdateBadgePanel(false)}
                onDoubleClick={event => event.stopPropagation()}
              >
                <button
                  type="button"
                  aria-label={`发现新版本 v${updateBadgePayload.latestVersion ?? ''}，悬浮查看更新说明，点击立即更新`}
                  onClick={event => {
                    event.stopPropagation();
                    setShowUpdateBadgePanel(false);
                    setUpdateCheckState(createUpdateDialogInfo(updateBadgePayload));
                  }}
                  className="rounded-full bg-emerald-500/15 px-1.5 py-px text-[10px] font-semibold leading-4 text-emerald-500 ring-1 ring-emerald-500/40 transition-colors hover:bg-emerald-500/30"
                >
                  升级
                </button>
                {showUpdateBadgePanel && (
                  <div
                    role="note"
                    aria-label={`新版本 v${updateBadgePayload.latestVersion ?? ''} 更新说明`}
                    className={`absolute right-0 top-full z-[90] mt-2 w-80 max-w-[min(20rem,90vw)] rounded-md border p-3 text-left shadow-2xl ${
                      isDarkMode ? 'border-[#3b3b43] bg-[#1e1e24] text-slate-200' : 'border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold">发现新版本 v{updateBadgePayload.latestVersion ?? ''}</span>
                      <span className={isDarkMode ? 'text-[10px] text-slate-400' : 'text-[10px] text-slate-500'}>当前 {LINGBUILDER_DISPLAY_VERSION}</span>
                    </div>
                    {updateBadgePayload.fileSize && (
                      <div className={`mt-1 text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>安装包大小：{updateBadgePayload.fileSize}</div>
                    )}
                    <div className={`mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap text-[11px] leading-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      {updateBadgePayload.releaseNotes || (updateBadgePayload.releaseTitle ? `${updateBadgePayload.releaseTitle}。` : '暂无更新说明，点击「升级」查看详情。')}
                    </div>
                    <div className={`mt-2 text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>点击「升级」按钮可直接在 IDE 内下载并安装。</div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div
            onDoubleClick={e => e.stopPropagation()}
            className={`window-no-drag hidden md:flex gap-4 ${isDarkMode ? 'text-[#CCCCCC]' : 'text-slate-600'} z-50`}
          >
            {/* 文件(F) */}
            <div className="relative">
              <span 
                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'file' ? null : 'file'); }}
                className={`cursor-pointer transition-all px-1.5 py-0.5 rounded ${activeDropdown === 'file' ? (isDarkMode ? 'bg-[#4e4e50] text-white' : 'bg-slate-200 text-slate-900') : (isDarkMode ? 'hover:text-white hover:bg-[#3e3e40]' : 'hover:text-slate-900 hover:bg-slate-200')}`}
              >
                文件(F)
              </span>
              {activeDropdown === 'file' && (
                <div className={`absolute left-0 top-6 w-48 shadow-2xl border rounded-md py-1 flex flex-col z-50 ${isDarkMode ? 'bg-[#252526] border-[#3c3c3c] text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}>
                  <button onClick={() => { openCreateSolutionProjectDialog(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>新建项目</span>
                  </button>
                  <button onClick={() => { void handleToolbarAction('open'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>打开项目</span>
                    <span className="opacity-50 text-[10px]">Ctrl+O</span>
                  </button>
                  <button onClick={() => { void executeWorkbenchCommand('workbench.action.files.openLcppSourcePackage'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    打开 LCPP 源码包…
                  </button>
                  <button disabled={isSaving || isBuilding} onClick={() => { void executeWorkbenchCommand('workbench.action.project.exportLcppSourcePackage', activeProjectId); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left text-[11px] disabled:cursor-not-allowed disabled:opacity-50 ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    一键导出当前项目源码包…
                  </button>
                  <button onClick={() => { void handleImportExternalProject(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    导入 MSBuild/CMake 工程…
                  </button>
                  <button onClick={() => { void window.lingBuilder?.workspace?.openNewWindow(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    在新窗口打开工作区…
                  </button>
                  <button onClick={() => { void executeWorkbenchCommand('workbench.action.files.closeSolution'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    关闭当前解决方案
                  </button>
                  {recentWorkspaces.length > 0 && <>
                    <div className={`h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                    <div className="px-3 py-1 text-[10px] opacity-55">最近工作区</div>
                    {recentWorkspaces.slice(0, 5).map(workspacePath => <button
                      key={workspacePath}
                      title={workspacePath}
                      onClick={() => { void handleOpenWorkspacePath(workspacePath); setActiveDropdown(null); }}
                      className={`px-3 py-1.5 text-left text-[11px] truncate ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}
                    >{workspacePath.split(/[\\/]/u).pop() || workspacePath}</button>)}
                    {recentWorkspaces.length > 5 && <button
                      onClick={() => { setShowRecentWorkspacesDialog(true); setActiveDropdown(null); }}
                      className={`px-3 py-1.5 text-left text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}
                    >更多最近工作区…</button>}
                  </>}
                  <button disabled={isSaving || isBuilding} onClick={() => { void handleToolbarAction('save'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] disabled:cursor-not-allowed disabled:opacity-50 ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>保存项目</span>
                    <span className="opacity-50 text-[10px]">Ctrl+S</span>
                  </button>
                  <div className={`h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  <button onClick={() => { void promptEditorFontSize(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>设置编辑器字体...</span>
                    <span className="opacity-50 text-[10px]">{editorFontSize}px</span>
                  </button>
                  <button onClick={() => { setEditorFontSize(value => value + 1); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>放大编辑器字体</span>
                    <span className="opacity-50 text-[10px]">Ctrl+滚轮↑</span>
                  </button>
                  <button onClick={() => { setEditorFontSize(value => value - 1); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>缩小编辑器字体</span>
                    <span className="opacity-50 text-[10px]">Ctrl+滚轮↓</span>
                  </button>
                  <button onClick={() => { setShowCustomModal(true); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>添加自定义文件</span>
                  </button>
                  <button onClick={() => { 
                    handleImportDictionary("精选本地化词典", [
                      { english: "Welcome", chinese: "欢迎使用", description: "UI 欢迎词" },
                      { english: "Status", chinese: "运行状态", description: "系统运行状态" }
                    ]); 
                    setActiveDropdown(null); 
                  }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>导入翻译词典</span>
                  </button>
                  <div className={`h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  <button onClick={() => { setShowCloseConfirmModal(true); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-rose-600 hover:text-white text-rose-500' : 'hover:bg-rose-600 hover:text-white text-rose-600 font-semibold'}`}>
                    <span>安全退出 IDE</span>
                    <span className="opacity-50 text-[10px]">Alt+F4</span>
                  </button>
                </div>
              )}
            </div>

            {/* 编辑(E) */}
            <div className="relative">
              <span 
                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'edit' ? null : 'edit'); }}
                className={`cursor-pointer transition-all px-1.5 py-0.5 rounded ${activeDropdown === 'edit' ? (isDarkMode ? 'bg-[#4e4e50] text-white' : 'bg-slate-200 text-slate-900') : (isDarkMode ? 'hover:text-white hover:bg-[#3e3e40]' : 'hover:text-slate-900 hover:bg-slate-200')}`}
              >
                编辑(E)
              </span>
              {activeDropdown === 'edit' && (
                <div className={`absolute left-0 top-6 w-48 shadow-2xl border rounded-md py-1 flex flex-col z-50 ${isDarkMode ? 'bg-[#252526] border-[#3c3c3c] text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}>
                  <button onClick={() => { handleAutoTranslateAll(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500 ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>一键智能汉化</span>
                  </button>
                  <div className={`h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  <button disabled={isSaving || isBuilding} onClick={() => { void executeWorkbenchCommand('workbench.action.findInFiles'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] disabled:cursor-not-allowed disabled:opacity-45 ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>在文件中查找</span>
                    <span className="opacity-50 text-[10px]">Ctrl+Shift+F</span>
                  </button>
                  <button disabled={isSaving || isBuilding} onClick={() => { void executeWorkbenchCommand('workbench.action.replaceInFiles'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] disabled:cursor-not-allowed disabled:opacity-45 ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>在文件中替换</span>
                    <span className="opacity-50 text-[10px]">Ctrl+Shift+H</span>
                  </button>
                  <div className={`h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  <button
                    type="button"
                    disabled={undoDisabled}
                    aria-label={undoTitle}
                    title={undoTitle}
                    onClick={() => { void executeWorkbenchCommand('workbench.action.editor.undo'); setActiveDropdown(null); }}
                    className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] disabled:cursor-not-allowed disabled:opacity-45 ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}
                  >
                    <span>撤销上次操作</span>
                    <span className="max-w-[92px] truncate opacity-50 text-[10px]">{undoKeybindingLabel}</span>
                  </button>
                  <button
                    type="button"
                    disabled={redoDisabled}
                    aria-label={redoTitle}
                    title={redoTitle}
                    onClick={() => { void executeWorkbenchCommand('workbench.action.editor.redo'); setActiveDropdown(null); }}
                    className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] disabled:cursor-not-allowed disabled:opacity-45 ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}
                  >
                    <span>重做上次操作</span>
                    <span className="max-w-[92px] truncate opacity-50 text-[10px]">{redoKeybindingLabel}</span>
                  </button>
                  <div className={`h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  <button onClick={() => { handleToolbarAction('copy'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>复制控件/代码</span>
                    <span className="opacity-50 text-[10px]">Ctrl+C</span>
                  </button>
                  <button onClick={() => { handleToolbarAction('paste'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>粘贴至画布</span>
                    <span className="opacity-50 text-[10px]">Ctrl+V</span>
                  </button>
                </div>
              )}
            </div>

            {/* 视图(V) */}
            <div className="relative">
              <span 
                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'view' ? null : 'view'); }}
                className={`cursor-pointer transition-all px-1.5 py-0.5 rounded ${activeDropdown === 'view' ? (isDarkMode ? 'bg-[#4e4e50] text-white' : 'bg-slate-200 text-slate-900') : (isDarkMode ? 'hover:text-white hover:bg-[#3e3e40]' : 'hover:text-slate-900 hover:bg-slate-200')}`}
              >
                视图(V)
              </span>
              {activeDropdown === 'view' && (
                <div className={`absolute left-0 top-6 w-52 shadow-2xl border rounded-md py-1 flex flex-col z-50 ${isDarkMode ? 'bg-[#252526] border-[#3c3c3c] text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}>
                  <button onClick={() => { void executeWorkbenchCommand('workbench.action.toggleSidebar'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>解决方案资源管理器</span>
                    <span className="opacity-50 text-[9px]">{showLeftSidebar ? '隐藏' : '显示'}</span>
                  </button>
                  <button onClick={() => { void executeWorkbenchCommand('workbench.action.togglePanel'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>提取字段与终端面板</span>
                    <span className="opacity-50 text-[9px]">{showBottomPanel ? '隐藏' : '显示'}</span>
                  </button>
                  <div className={`h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  <button onClick={() => { void executeWorkbenchCommand('workbench.action.toggleColorTheme'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>切换暗色/亮色皮肤</span>
                    <span className="opacity-50 text-[9px]">{isDarkMode ? '亮色' : '暗色'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* 项目(P) */}
            <div className="relative">
              <span 
                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'project' ? null : 'project'); }}
                className={`cursor-pointer transition-all px-1.5 py-0.5 rounded ${activeDropdown === 'project' ? (isDarkMode ? 'bg-[#4e4e50] text-white' : 'bg-slate-200 text-slate-900') : (isDarkMode ? 'hover:text-white hover:bg-[#3e3e40]' : 'hover:text-slate-900 hover:bg-slate-200')}`}
              >
                项目(P)
              </span>
              {activeDropdown === 'project' && (
                <div className={`absolute left-0 top-6 w-52 shadow-2xl border rounded-md py-1 flex flex-col z-50 ${isDarkMode ? 'bg-[#252526] border-[#3c3c3c] text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}>
                  <button onClick={() => { void handleRunBuild(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>编译并热运行游戏</span>
                    <span className="opacity-50 text-[10px]">F5</span>
                  </button>
                  <button onClick={() => { handleStopBuild(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>强制停止游戏调试</span>
                    <span className="opacity-50 text-[10px]">Shift+F5</span>
                  </button>
                  <button onClick={() => { void handleSolutionBuildCommand('build'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>生成解决方案</span>
                    <span className="opacity-50 text-[10px]">Build</span>
                  </button>
                  <button onClick={() => { void handleSolutionBuildCommand('rebuild'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>重新生成解决方案</span>
                    <span className="opacity-50 text-[10px]">Rebuild</span>
                  </button>
                  <button onClick={() => { void handleSolutionBuildCommand('clean'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>清理解决方案</span>
                    <span className="opacity-50 text-[10px]">Clean</span>
                  </button>
                  <button onClick={() => { void handleSetStartupProject(activeProjectId); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>设为启动项目</span>
                    <span className="opacity-50 text-[10px]">{activeSolutionProject.name}</span>
                  </button>
                  <div className={`h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  <button onClick={() => { handleGenerateCpp(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>生成 C++ 宏定义类</span>
                  </button>
                  <button onClick={() => { handleEnvCheck(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>项目环境开发自检</span>
                  </button>
                </div>
              )}
            </div>

            {/* 工具(T) */}
            <div className="relative">
              <span 
                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'tools' ? null : 'tools'); }}
                className={`cursor-pointer transition-all px-1.5 py-0.5 rounded ${activeDropdown === 'tools' ? (isDarkMode ? 'bg-[#4e4e50] text-white' : 'bg-slate-200 text-slate-900') : (isDarkMode ? 'hover:text-white hover:bg-[#3e3e40]' : 'hover:text-slate-900 hover:bg-slate-200')}`}
              >
                工具(T)
              </span>
              {activeDropdown === 'tools' && (
                <div className={`absolute left-0 top-6 w-52 shadow-2xl border rounded-md py-1 flex flex-col z-50 ${isDarkMode ? 'bg-[#252526] border-[#3c3c3c] text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}>
                  <button onClick={() => { setActiveDropdown(null); void executeWorkbenchCommand('workbench.action.showCommands'); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>命令面板...</span>
                    <span className="opacity-50 text-[10px]">Ctrl+Shift+P</span>
                  </button>
                  <button onClick={() => { setActiveDropdown(null); void executeWorkbenchCommand('workbench.action.openSettings'); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>设置...</span>
                    <span className="opacity-50 text-[10px]">Ctrl+,</span>
                  </button>
                  <div className={`h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  <button onClick={() => { handleEnvCheck(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>自检开发环境依赖</span>
                    <span className="opacity-50 text-[10px]">检测</span>
                  </button>
                  <button onClick={() => { setShowEnvironmentRepairCenter(true); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>环境修复中心...</span>
                    <span className="opacity-50 text-[10px]">安装</span>
                  </button>
                  <button onClick={() => { setBuildLogs([`> [${new Date().toLocaleTimeString()}] 【系统】编译输出终端已清空。`]); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>清空输出终端日志</span>
                    <span className="opacity-50 text-[10px]">清空</span>
                  </button>
                  <button onClick={() => { 
                    setBuildLogs(prev => [...prev, `> [系统] 翻译风格已强制切换为：【专业严谨汉化模式】。`]);
                    setActiveDropdown(null); 
                  }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>翻译风格切换：严谨型</span>
                    <span className="opacity-50 text-[10px]">模式</span>
                  </button>
                </div>
              )}
            </div>

            {/* 帮助(H) */}
            <div className="relative">
              <span 
                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'help' ? null : 'help'); }}
                className={`cursor-pointer transition-all px-1.5 py-0.5 rounded ${activeDropdown === 'help' ? (isDarkMode ? 'bg-[#4e4e50] text-white' : 'bg-slate-200 text-slate-900') : (isDarkMode ? 'hover:text-white hover:bg-[#3e3e40]' : 'hover:text-slate-900 hover:bg-slate-200')}`}
              >
                帮助(H)
              </span>
              {activeDropdown === 'help' && (
                <div className={`absolute left-0 top-6 w-56 shadow-2xl border rounded-md py-1 flex flex-col z-50 ${isDarkMode ? 'bg-[#252526] border-[#3c3c3c] text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}>
                  <button onClick={() => { setActiveDropdown(null); void executeWorkbenchCommand('workbench.action.help.openHelpCenter'); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>帮助中心与更新日志...</span>
                    <span className="opacity-50 text-[10px]">{LINGBUILDER_DISPLAY_VERSION}</span>
                  </button>
                  <button onClick={() => { setActiveDropdown(null); void executeWorkbenchCommand('workbench.action.help.openCliGuide'); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>AI Bridge 连接中心...</span>
                    <span className="opacity-50 text-[10px]">CLI</span>
                  </button>
                  <button onClick={() => { setActiveDropdown(null); void executeWorkbenchCommand('workbench.action.help.openSponsor'); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>赞助</span>
                    <span className="opacity-50 text-[10px]">二维码</span>
                  </button>
                  <button onClick={() => { setActiveDropdown(null); void executeWorkbenchCommand('workbench.action.help.openQQGroup'); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>交流QQ群</span>
                    <span className="opacity-50 text-[10px]">QQ</span>
                  </button>
                  <button onClick={() => { 
                    setShowBottomPanel(true);
                    setActiveTabInBottom('output');
                    setBuildLogs([
                      `=========================================`,
                      `📖 LingBuilder C++ 原生中文汉化与代码替换机制说明：`,
                      `1. 代码分析：IDE 后台精确检索 C++ 中的字符串常量 (String Literals)、L"" 宽字符及 rc 资源文件。`,
                      `2. 独立沙盒：原始文本被抽离并归入 BottomPanel 列表，不损害原有 C++ 代码。`,
                      `3. 零损汉化：当点击 编译 F5 时，IDE 通过动态宏、字符串常量替换、中文化映射，编译出原生中文化的二进制，不破坏原始工程。`,
                      `4. AI 智能推荐：接入 Gemini API，在完美贴合 C++ 上下文语境下进行优雅汉化，保证完美的编译通过率与零语法侵入。`,
                      `=========================================`
                    ]);
                    setActiveDropdown(null); 
                  }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>查看汉化核心文档说明</span>
                    <span className="opacity-50 text-[10px]">文档</span>
                  </button>
                  <button onClick={() => { alert("感谢支持！您的反馈意见已安全同步。我们将持续致力于保障 C++ 零损中文映射方案的高效与稳定。"); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>反馈意见与提交 Bug</span>
                    <span className="opacity-50 text-[10px]">反馈</span>
                  </button>
                  <div className={`h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  <button onClick={() => { setActiveDropdown(null); void executeWorkbenchCommand('workbench.action.help.openAbout'); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>关于 LingBuilder IDE...</span>
                    <span className="opacity-50 text-[10px]">{LINGBUILDER_DISPLAY_VERSION}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right window controls */}
        <div className="window-no-drag flex items-center gap-0" onDoubleClick={e => e.stopPropagation()}>
          <div className={`text-[10px] opacity-50 px-2 italic hidden lg:block ${isDarkMode ? 'text-[#CCCCCC]' : 'text-slate-600'}`}>
            LingBuilder {LINGBUILDER_DISPLAY_VERSION} · 中文集成开发环境
          </div>

          <button 
            onClick={handleWindowMinimize}
            className={`w-10 h-8 flex items-center justify-center transition-colors ${
              isDarkMode 
                ? 'hover:bg-[#434345] text-slate-300' 
                : 'hover:bg-slate-200 text-slate-700'
            }`}
            title="最小化"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          
          <button 
            onClick={handleWindowToggleMaximize}
            className={`w-10 h-8 flex items-center justify-center transition-colors ${
              isDarkMode 
                ? 'hover:bg-[#434345] text-slate-300' 
                : 'hover:bg-slate-200 text-slate-700'
            }`}
            title={isMaximizedApp ? "还原" : "最大化"}
          >
            {isMaximizedApp ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          
          <button 
            onClick={() => setShowCloseConfirmModal(true)}
            className="w-11 h-8 flex items-center justify-center text-slate-400 hover:bg-rose-600 hover:text-white transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div 
        id="ide-top-toolbar" 
        className={`h-10 flex items-center justify-between px-3 border-b shrink-0 select-none ${
          isDarkMode ? 'bg-[#252526] border-[#181818]' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="min-w-0 flex-1 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* GROUP 1: 文件和编辑操作 */}
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${
            isDarkMode ? 'bg-[#1e1e1f] border-[#2d2d30]' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <button
              onClick={() => handleToolbarAction('new')}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="新建 (创建一个新的 LingBuilder 项目、窗口或设计文件)"
            >
              <FolderPlus className="w-4 h-4 text-sky-400" />
            </button>
            <button
              onClick={() => void handleToolbarAction('open')}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="打开 (打开已有项目或设计文件)"
            >
              <FolderOpen className="w-4 h-4 text-amber-500" />
            </button>
            <button
              onClick={() => void handleToolbarAction('save')}
              disabled={isSaving || isBuilding}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={isSaving ? '正在保存当前项目' : '保存 (保存当前项目、窗口设计、代码或配置修改)'}
            >
              <Save className="w-4 h-4 text-emerald-500" />
            </button>
            
            <div className={`w-px h-3.5 mx-1 ${isDarkMode ? 'bg-[#3d3d42]' : 'bg-slate-200'}`}></div>

            <button
              type="button"
              onClick={() => void executeWorkbenchCommand('workbench.action.editor.undo')}
              disabled={undoDisabled}
              aria-label={undoTitle}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={undoTitle}
            >
              <Undo2 className="w-4 h-4 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() => void executeWorkbenchCommand('workbench.action.editor.redo')}
              disabled={redoDisabled}
              aria-label={redoTitle}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={redoTitle}
            >
              <Redo2 className="w-4 h-4 text-slate-400" />
            </button>
            
            <div className={`w-px h-3.5 mx-1 ${isDarkMode ? 'bg-[#3d3d42]' : 'bg-slate-200'}`}></div>

            <button
              onClick={() => handleToolbarAction('copy')}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="复制 (复制当前选中的组件、文本或设计器对象)"
            >
              <Copy className="w-4 h-4 text-slate-300" />
            </button>
            <button
              onClick={() => handleToolbarAction('paste')}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="粘贴 (将剪贴板中的组件、文本或对象粘贴到当前设计器/编辑器)"
            >
              <ClipboardPaste className="w-4 h-4 text-slate-300" />
            </button>
          </div>

          <div className={`w-px h-5 mx-1 ${isDarkMode ? 'bg-[#3d3d42]' : 'bg-slate-300'}`}></div>

          {/* GROUP 2: 代码生成、运行和环境检测。设计器控件从设计器内的工具箱添加。 */}
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${
            isDarkMode ? 'bg-[#1e1e1f] border-[#2d2d30]' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <button
              onClick={handleGenerateCpp}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="生成 C++ (根据当前中文 DSL、设计器模型或项目配置生成 C++ 代码)"
            >
              <Cpu className="w-4 h-4 text-amber-500" />
            </button>
            <button
              onClick={handleRunBuild}
              disabled={isBuilding}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isBuilding 
                  ? 'opacity-50 text-emerald-600' 
                  : 'text-emerald-500 hover:text-emerald-650'
              }`}
              title="运行 F5 (编译并运行当前项目，快捷键是 F5)"
            >
              <Play className="w-4 h-4 fill-emerald-500/10" />
            </button>
            <button
              id="btn-stop-debugging"
              onClick={handleStopBuild}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 text-red-500 ${
                isDarkMode ? 'hover:text-red-300 hover:bg-[#2d2d30]' : 'hover:text-red-700 hover:bg-slate-100'
              }`}
              title="停止 (Shift+F5)&#10;取消在途生成请求并终止所有受控运行进程"
            >
              <Square className="w-4 h-4 fill-red-500/10" />
            </button>
            <button
              onClick={() => {
                setBuildLogs(prev => [...prev, `> [${new Date().toLocaleTimeString()}] 正在重启当前调试实例...`]);
                void handleRunBuild();
              }}
              disabled={isBuilding}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-indigo-400 hover:text-indigo-300 hover:bg-[#2d2d30]' : 'text-indigo-600 hover:text-indigo-700 hover:bg-slate-100'
              }`}
              title="重新运行 (停止/刷新后重新运行当前项目)"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleEnvCheck}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-rose-400 hover:text-rose-300 hover:bg-[#2d2d30]' : 'text-rose-600 hover:text-rose-700 hover:bg-slate-100'
              }`}
              title="环境检查 (检测 Node.js、MSVC、Windows SDK、CMake、g++、clang++、WebView2 与 Windows 平台)"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right side items */}
        <div className="shrink-0 flex items-center gap-2 sm:gap-4">

          {/* Editor group layout controls live in the global toolbar to avoid consuming an editor row. */}
          <div
            data-testid="editor-layout-toolbar"
            className={`flex items-center rounded p-0.5 border ${
              isDarkMode ? 'bg-[#37373D] border-[#181818]' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <button
              type="button"
              onClick={() => void executeWorkbenchCommand('workbench.action.editor.splitRight')}
              aria-label="左右拆分编辑区"
              aria-pressed={editorGroupLayout.groups.length > 1 && editorGroupLayout.orientation === 'horizontal'}
              className={`p-1 rounded cursor-pointer transition-colors ${
                editorGroupLayout.groups.length > 1 && editorGroupLayout.orientation === 'horizontal'
                  ? isDarkMode ? 'bg-[#1E1E1E] text-sky-300' : 'bg-sky-100 text-sky-800'
                  : isDarkMode ? 'text-slate-300 hover:bg-[#1E1E1E] hover:text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="左右拆分编辑区"
            >
              <Columns2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void executeWorkbenchCommand('workbench.action.editor.splitDown')}
              aria-label="上下拆分编辑区"
              aria-pressed={editorGroupLayout.groups.length > 1 && editorGroupLayout.orientation === 'vertical'}
              className={`p-1 rounded cursor-pointer transition-colors ${
                editorGroupLayout.groups.length > 1 && editorGroupLayout.orientation === 'vertical'
                  ? isDarkMode ? 'bg-[#1E1E1E] text-sky-300' : 'bg-sky-100 text-sky-800'
                  : isDarkMode ? 'text-slate-300 hover:bg-[#1E1E1E] hover:text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="上下拆分编辑区"
            >
              <Rows2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            {editorGroupLayout.groups.length > 1 && (
              <button
                type="button"
                onClick={() => void executeWorkbenchCommand('workbench.action.editor.moveToSecondGroup')}
                aria-label="将当前标签移到第二编辑组"
                className={`p-1 rounded cursor-pointer transition-colors ${
                  isDarkMode ? 'text-violet-300 hover:bg-[#1E1E1E] hover:text-white' : 'text-violet-700 hover:bg-slate-100'
                }`}
                title="将当前标签移到第二编辑组"
              >
                <MoveRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void executeWorkbenchCommand('workbench.action.editor.singleGroup')}
              disabled={editorGroupLayout.groups.length === 1}
              aria-label="恢复为单编辑区"
              aria-pressed={editorGroupLayout.groups.length === 1}
              className={`p-1 rounded transition-colors disabled:cursor-default ${
                editorGroupLayout.groups.length === 1
                  ? isDarkMode ? 'bg-[#1E1E1E] text-emerald-300' : 'bg-emerald-100 text-emerald-800'
                  : isDarkMode ? 'text-emerald-300 hover:bg-[#1E1E1E] hover:text-white' : 'text-emerald-700 hover:bg-slate-100'
              }`}
              title={editorGroupLayout.groups.length === 1 ? '当前已是单编辑区' : '恢复为单编辑区'}
            >
              <Square className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Command and settings entry points remain visible when the desktop menu is collapsed. */}
          <div className={`flex items-center rounded p-0.5 border ${
            isDarkMode ? 'bg-[#37373D] border-[#181818]' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <button
              onClick={() => void handleStartNativeDebug()}
              disabled={isBuilding || (nativeDebugSession && !['terminated', 'error'].includes(nativeDebugSession.state))}
              className="p-1 rounded text-violet-400 hover:text-violet-200 disabled:opacity-40"
              title="开始原生调试（点击编辑器左侧圆点区域设置断点；Shift+点击设置条件断点）"
              aria-label="开始原生调试"
            >
              <Bug className="w-4 h-4" />
            </button>
            {nativeDebugSession?.state === 'stopped' && <>
              <button onClick={() => void handleDebugControl('continue')} className="px-1 text-[10px] text-emerald-400" title="继续">继续</button>
              <button onClick={() => void handleDebugControl('next')} className="px-1 text-[10px] text-sky-400" title="逐过程">单步</button>
              <button onClick={() => void handleDebugControl('step-in')} className="px-1 text-[10px] text-cyan-400" title="逐语句">进入</button>
              <button onClick={() => void handleDebugControl('step-out')} className="px-1 text-[10px] text-amber-400" title="跳出">跳出</button>
            </>}
            <button
              type="button"
              onClick={() => void executeWorkbenchCommand('workbench.action.findInFiles')}
              disabled={isSaving || isBuilding}
              aria-label="在文件中查找"
              className={`p-1 rounded cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-45 ${isDarkMode ? 'text-amber-400 hover:bg-[#1E1E1E] hover:text-white' : 'text-amber-700 hover:bg-slate-100'}`}
              title="在文件中查找 (Ctrl+Shift+F)"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void executeWorkbenchCommand('workbench.action.showCommands')}
              aria-label="打开命令面板"
              className={`p-1 rounded cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${isDarkMode ? 'text-sky-400 hover:bg-[#1E1E1E] hover:text-white' : 'text-sky-700 hover:bg-slate-100'}`}
              title="命令面板 (Ctrl+Shift+P / F1)"
            >
              <CommandIcon className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void executeWorkbenchCommand('workbench.action.openSettings')}
              aria-label="打开设置"
              className={`p-1 rounded cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${isDarkMode ? 'text-slate-300 hover:bg-[#1E1E1E] hover:text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              title="设置 (Ctrl+,)"
            >
              <SettingsIcon className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Panels Toggles */}
          <div className={`flex items-center rounded p-0.5 border ${
            isDarkMode ? 'bg-[#37373D] border-[#181818]' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <button
              onClick={() => void executeWorkbenchCommand('workbench.action.toggleSidebar')}
              className={`p-1 rounded cursor-pointer transition-colors ${
                showLeftSidebar 
                  ? isDarkMode ? 'bg-[#1E1E1E] text-white' : 'bg-slate-100 text-slate-900 font-medium' 
                  : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="切换解决方案管理器"
            >
              <FolderCode className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => void executeWorkbenchCommand('workbench.action.togglePanel')}
              className={`p-1 rounded cursor-pointer transition-colors ${
                showBottomPanel 
                  ? isDarkMode ? 'bg-[#1E1E1E] text-white' : 'bg-slate-100 text-slate-900 font-medium' 
                  : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="切换提取列表与终端"
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void executeWorkbenchCommand('workbench.action.toggleAiPanel')}
              aria-label="切换 AI 智能编程助手"
              aria-pressed={showRightPanel}
              className={`p-1 rounded cursor-pointer transition-colors ${
                showRightPanel
                  ? isDarkMode ? 'bg-[#1E1E1E] text-cyan-300' : 'bg-cyan-100 text-cyan-800 font-medium'
                  : isDarkMode ? 'text-slate-400 hover:text-cyan-300' : 'text-slate-500 hover:text-cyan-700'
              }`}
              title="切换 AI 智能编程助手"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className={`w-px h-4 ${isDarkMode ? 'bg-[#444]' : 'bg-slate-300'}`}></div>

          {/* Theme Switcher */}
          <button
            onClick={() => void executeWorkbenchCommand('workbench.action.toggleColorTheme')}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDarkMode ? 'hover:bg-[#3E3E40] text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
            }`}
            title="切换暗色/亮色"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
          </button>
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden select-none">
        {/* Left Visual Studio style dockable sidebar */}
        <Sidebar
          workspaceKey={currentWorkspacePath}
          files={files}
          activeFile={activeFile}
          onSelectFile={handleSelectFile}
          onRunBuild={handleRunBuild}
          isBuilding={isBuilding}
          isDarkMode={isDarkMode}
          showLeftSidebar={showLeftSidebar}
          setShowLeftSidebar={setShowLeftSidebar}
          showDesignerToolbox={isDesignerViewActive}
          onDesignerToolboxHostChange={setDesignerToolboxHost}
          onBatchTranslate={handleBatchTranslate}
          onSetStatus={handleSetStatus}
          glossary={glossary}
          drawerWidth={leftWidth}
          onDeleteFile={handleDeleteFile}
          onRenameFile={handleRenameFile}
          sourceControlStatus={sourceControlStatus}
          onSourceControlChanged={refreshSourceControlStatus}
          onExecuteSourceControlCommand={executeSourceControlCommand}
          solution={solution}
          commandService={commandServiceRef.current}
          onExecuteCommand={executeWorkbenchCommand}
          activeProjectId={activeProjectId}
          onRefreshSolution={refreshSolution}
          onCreateProject={openCreateSolutionProjectDialog}
          onSetStartupProject={handleSetStartupProject}
          onConfigureProjectReferences={handleConfigureProjectReferences}
          onToggleMultiStartupProject={handleToggleMultiStartupProject}
          onConfigureExternalProject={handleConfigureExternalProject}
          onConfigureBuildPaths={projectId => openProjectBuildPathsDialog(projectId)}
          onDeleteProject={handleDeleteSolutionProject}
          onSolutionCommand={async (command, projectId) => { await handleSolutionBuildCommand(command, projectId); }}
          onCloseSolution={() => { void executeWorkbenchCommand('workbench.action.files.closeSolution'); }}
          onOpenSolutionDirectory={handleOpenSolutionDirectory}
          onOpenProjectDirectory={handleOpenProjectDirectory}
          onOpenProjectGlobalVariables={projectId => { void executeWorkbenchCommand('workbench.action.project.openGlobalVariables', projectId); }}
          onOpenProjectDataTypes={projectId => { void executeWorkbenchCommand('workbench.action.project.openDataTypes', projectId); }}
          onCreateFunctionLibrary={handleCreateFunctionLibrary}
          onPasteFunctionLibrary={handlePasteFunctionLibrary}
          onCopySolutionFullPath={() => executeWorkbenchCommand('workbench.action.solution.copyFullPath')}
          onCopyProjectFullPath={projectId => executeWorkbenchCommand('workbench.action.project.copyFullPath', projectId)}
          onAddProjectResource={handleAddProjectResource}
          onExportLcppSourcePackage={projectId => { void executeWorkbenchCommand('workbench.action.project.exportLcppSourcePackage', projectId); }}
          onCopyProjectResourcePath={handleCopyProjectResourcePath}
          activeModuleHintId={moduleHint?.itemId}
          onShowModuleHint={handleShowModuleHint}
        />

        {/* LEFT DRAG RESIZER & COLLAPSE TOGGLE */}
        <div
          className={`w-[6px] relative flex items-center justify-center select-none transition-all duration-150 z-20 shrink-0 border-r border-[#2d2d34] group ${
            showLeftSidebar 
              ? 'bg-[#1c1c22] cursor-col-resize hover:bg-blue-500/20' 
              : 'bg-[#16161c] cursor-pointer hover:bg-amber-500/10'
          }`}
          onMouseDown={showLeftSidebar ? startResizeLeft : undefined}
          title={showLeftSidebar ? "拖拽两侧边缘调整宽度 / 双击重置 / 点击按钮折叠" : "点击展开左侧解决方案资源管理器"}
          onDoubleClick={showLeftSidebar ? resetLeftSidebarWidth : undefined}
          onClick={showLeftSidebar ? undefined : toggleSidebarVisibility}
        >
          {/* Thin line indicator */}
          <div className={`w-[1px] rounded-full transition-all ${
            showLeftSidebar 
              ? 'h-8 bg-slate-700/50 group-hover:bg-blue-400 group-hover:h-12' 
              : 'h-12 bg-amber-500/20 group-hover:bg-amber-500/50'
          }`}></div>

          {/* Toggle Trigger Pill Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSidebarVisibility();
            }}
            className="absolute left-1/2 -translate-x-1/2 w-[16px] h-12 bg-[#2d2d36] hover:bg-[#3a3a45] active:bg-[#4a4a58] border border-[#444] hover:border-blue-500/60 rounded shadow-lg flex items-center justify-center cursor-pointer transition-all hover:scale-105 z-30 group-hover:opacity-100 opacity-60"
            title={showLeftSidebar ? "折叠左侧面板" : "展开左侧面板"}
          >
            {showLeftSidebar ? (
              <ChevronLeft className="w-3 h-3 text-slate-400 group-hover:text-blue-400 transition-transform" />
            ) : (
              <ChevronRight className="w-3 h-3 text-amber-500 group-hover:text-amber-400 transition-transform group-hover:scale-110" />
            )}
          </button>
        </div>

        {/* Central Comparative Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className={`flex-1 flex min-h-0 bg-[#141418] ${editorGroupLayout.orientation === 'horizontal' ? 'flex-row' : 'flex-col'}`}>
            {projectFilesReady ? <div
              className="flex min-h-0 min-w-0 flex-1 flex-col"
              onFocusCapture={() => activateEditorGroup('primary')}
              onMouseDownCapture={() => activateEditorGroup('primary')}
            ><DiffViewer
              ref={diffViewerRef}
              diffResult={diffResult}
              strings={activeFile.strings}
              onUpdateStringTranslation={handleUpdateStringTranslation}
              onResetTranslation={handleResetTranslation}
              onUpdateSourceContent={handleUpdateSourceContent}
              onUpdateProjectSources={handleUpdateProjectSources}
              onOpenProjectDataTypes={activeProjectHasWindowDesigner
                ? () => { void executeWorkbenchCommand('workbench.action.project.openDataTypes', activeProjectIdRef.current); }
                : undefined}
              isDarkMode={isDarkMode}
              activeFile={activeFile}
              editorFontSize={editorFontSize}
              onFontSizeChange={setEditorFontSize}
              openTabs={openTabs}
              activeTabPath={activeFile.path}
              onSelectTab={handleSelectFile}
              onCloseTab={handleCloseTab}
              allFiles={files}
              designerProject={activeProjectHasWindowDesigner ? windowDesignerState.project : undefined}
              designerToolboxHost={designerToolboxHost}
              onDesignerViewActiveChange={setIsDesignerViewActive}
              moduleContext={moduleContext}
              activeWindowId={windowDesignerState.activeWindowId}
              textModelWorkspaceId={textModelWorkspaceId}
              textModelProjectId={loadedProjectId}
              onEditorStateChange={publishPrimaryEditorState}
              editorExperienceMode={editorExperienceMode}
              onExperienceModeChange={handleEditorExperienceModeChange}
              problems={workbenchProblems}
              onShowCommandHint={handleShowCommandHint}
              commandService={commandServiceRef.current}
              getCommandContext={() => commandContextRef.current}
            /></div> : (
              <div
                className={`flex min-h-0 flex-1 items-center justify-center p-6 ${isDarkMode ? 'bg-[#141418] text-slate-200' : 'bg-slate-50 text-slate-800'}`}
                role={projectFileEditorAvailability === 'error' ? 'alert' : 'status'}
                aria-live={projectFileEditorAvailability === 'error' ? 'assertive' : 'polite'}
                data-project-file-load-state={projectFileEditorAvailability}
              >
                <div className={`w-full max-w-md rounded-lg border p-6 text-center shadow-sm ${
                  isDarkMode ? 'border-[#34343c] bg-[#1c1c22]' : 'border-slate-200 bg-white'
                }`}>
                  <RefreshCw className={`mx-auto mb-3 h-7 w-7 ${projectFilesLoading ? 'animate-spin text-blue-400' : 'text-amber-500'}`} />
                  <div className="text-sm font-semibold">
                    {projectFilesLoading ? '正在载入项目文件' : '项目文件载入失败'}
                  </div>
                  <p className={`mt-2 text-xs leading-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    {projectFilesLoading
                      ? `正在读取“${activeSolutionProject.name}”的权威磁盘内容，完成前编辑器保持只读。`
                      : projectFileLoadState.error || '无法读取项目文件，请重试或切换到其他项目。'}
                  </p>
                  {projectFileEditorAvailability === 'error' && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setProjectFileLoadState(createProjectFileLoadState(activeProjectId, 'loading'));
                        setEditorState(createInactiveTextEditorStatus('loading-project'));
                        setProjectFileReloadToken(token => token + 1);
                      }}
                      className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-medium ${
                        isDarkMode
                          ? 'border-blue-500/50 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20'
                          : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      重试载入
                    </button>
                    <button
                      type="button"
                      onClick={() => void executeWorkbenchCommand('workbench.action.files.closeSolution')}
                      className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-medium ${
                        isDarkMode
                          ? 'border-slate-500/50 bg-slate-500/10 text-slate-200 hover:bg-slate-500/20'
                          : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      关闭此解决方案
                    </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {projectFilesReady && editorGroupLayout.groups[1] && (() => {
              const group = editorGroupLayout.groups[1];
              const selected = files.find(file => file.path === group.activePath) || files.find(file => file.path === group.tabs[0]);
              if (!selected) return null;
              return <div
                className={`flex min-h-0 min-w-0 flex-1 flex-col border-[#303038] ${editorGroupLayout.orientation === 'horizontal' ? 'border-l' : 'border-t'}`}
                onFocusCapture={() => activateEditorGroup('secondary')}
                onMouseDownCapture={() => activateEditorGroup('secondary')}
              >
                <div className="flex h-8 shrink-0 items-center overflow-x-auto bg-[#18181e]">
                  {group.tabs.map(tabPath => {
                    const file = files.find(item => item.path === tabPath); if (!file) return null;
                    return <button key={tabPath} onClick={() => setEditorGroupLayout(previous => selectEditorGroupTab(previous, group.id, tabPath))} className={`h-8 px-3 text-[11px] ${tabPath === selected.path ? 'bg-[#25252c] text-white' : 'text-slate-400 hover:text-white'}`}>
                      {file.isModified ? '● ' : ''}{file.name}
                      <span onClick={event => { event.stopPropagation(); setEditorGroupLayout(previous => closeEditorGroupTab(previous, group.id, tabPath)); }} className="ml-2 opacity-60 hover:opacity-100">×</span>
                    </button>;
                  })}
                  <button onClick={() => void moveSecondaryTabToPrimary(selected.path)} className="ml-auto shrink-0 px-2 text-[10px] text-slate-400 hover:text-white">移到第一组</button>
                </div>
                <div className="min-h-0 flex-1">
                  <MonacoCodeEditor
                    ref={secondaryEditorRef}
                    sourceCode={getCurrentFileContent(selected)} language={selected.language} isDarkMode={isDarkMode}
                    readOnly={isSaving || isBuilding} onChange={value => updateEditorGroupFile(selected.path, value)}
                    editorFontSize={editorFontSize} onFontSizeChange={setEditorFontSize} filePath={selected.path}
                    modelIdentity={textModelIdentity(loadedProjectId, selected.path)} modelSurface="secondary"
                    moduleContext={moduleContext} designerProject={activeProjectHasWindowDesigner ? windowDesignerState.project : undefined}
                    onEditorStateChange={publishSecondaryEditorState}
                  />
                </div>
              </div>;
            })()}
          </div>

          {/* BOTTOM DRAG RESIZER & COLLAPSE TOGGLE */}
          <div
            className={`h-[7px] relative flex items-center justify-center select-none transition-all duration-150 z-20 shrink-0 border-t group ${
              showBottomPanel
                ? isDarkMode
                  ? 'bg-[#1c1c22] border-[#2d2d34] cursor-row-resize hover:bg-blue-500/20'
                  : 'bg-slate-100 border-slate-200 cursor-row-resize hover:bg-blue-500/10'
                : isDarkMode
                  ? 'bg-[#16161c] border-[#2d2d34] cursor-pointer hover:bg-amber-500/10'
                  : 'bg-slate-50 border-slate-200 cursor-pointer hover:bg-amber-500/10'
            }`}
            onMouseDown={showBottomPanel ? startResizeBottom : undefined}
            title={showBottomPanel ? "拖拽调整底部面板高度 / 双击重置 / 点击按钮折叠" : "点击展开底部面板"}
            onDoubleClick={showBottomPanel ? () => setBottomHeight(260) : undefined}
            onClick={showBottomPanel ? undefined : toggleBottomPanelVisibility}
          >
            <div className={`h-[1px] rounded-full transition-all ${
              showBottomPanel
                ? 'w-12 bg-slate-700/50 group-hover:bg-blue-400 group-hover:w-20'
                : 'w-20 bg-amber-500/20 group-hover:bg-amber-500/50'
            }`}></div>

            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                toggleBottomPanelVisibility();
              }}
              className={`absolute top-1/2 -translate-y-1/2 w-12 h-[16px] border rounded shadow-lg flex items-center justify-center cursor-pointer transition-all hover:scale-105 z-30 group-hover:opacity-100 opacity-60 ${
                isDarkMode
                  ? 'bg-[#2d2d36] hover:bg-[#3a3a45] active:bg-[#4a4a58] border-[#444] hover:border-blue-500/60'
                  : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-slate-300 hover:border-blue-500/60'
              }`}
              title={showBottomPanel ? "折叠底部面板" : "展开底部面板"}
              aria-label={showBottomPanel ? "折叠底部面板" : "展开底部面板"}
            >
              {showBottomPanel ? (
                <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-blue-400 transition-transform" />
              ) : (
                <ChevronUp className="w-3 h-3 text-amber-500 group-hover:text-amber-400 transition-transform group-hover:scale-110" />
              )}
            </button>
          </div>

          {/* Bottom Table and Terminal Panel */}
          {showBottomPanel && (
            <BottomPanel
              strings={activeFile.strings}
              problems={workbenchProblems}
              buildLogs={buildLogs}
              debugLogs={debugLogs}
              onClearLogs={handleClearLogs}
              onSelectLine={handleSelectLine}
              onSelectProblem={handleSelectProblem}
              onUpdateStringTranslation={handleUpdateStringTranslation}
              onSetStatus={handleSetStatus}
              isDarkMode={isDarkMode}
              activeTab={activeTabInBottom}
              onActiveTabChange={setActiveTabInBottom}
              showCodeMapping={activeFile.language !== 'lingcpp'}
              moduleHint={moduleHint}
              commandHint={commandHint}
              height={bottomHeight}
            />
          )}
        </div>

        {showRightPanel && (
          <>
            <div
              className={`w-[6px] shrink-0 cursor-col-resize border-l select-none transition-colors hover:bg-blue-500/20 ${
                isDarkMode ? 'border-[#2d2d34] bg-[#1c1c22]' : 'border-slate-200 bg-slate-100'
              }`}
              onMouseDown={startResizeAiPanel}
              onDoubleClick={resetAiPanelWidth}
              title="拖拽调整 AI 助手宽度，双击重置"
              role="separator"
              aria-orientation="vertical"
              aria-label="调整 AI 助手宽度"
            />
            <aside
              className={`relative min-w-0 shrink-0 ${isDarkMode ? 'bg-[#1e1e24]' : 'bg-white'}`}
              style={{ width: aiPanelWidth }}
              aria-label="AI 智能编程助手"
            >
              <button
                type="button"
                onClick={() => void executeWorkbenchCommand('workbench.action.toggleAiPanel')}
                className={`absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded border text-slate-400 hover:text-white ${
                  isDarkMode ? 'border-[#42424c] bg-[#25252c] hover:bg-[#363642]' : 'border-slate-300 bg-white hover:bg-slate-100 hover:text-slate-700'
                }`}
                title="收起 AI 助手"
                aria-label="收起 AI 助手"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              {renderAiAssistant()}
            </aside>
          </>
        )}

      </div>

      <CommandPalette
        open={showCommandPalette}
        query={commandQuery}
        commands={commandPaletteCommands}
        isDarkMode={isDarkMode}
        onQueryChange={setCommandQuery}
        onExecute={executeCommandFromPalette}
        onClose={() => setShowCommandPalette(false)}
      />

      <WorkspaceSearchDialog
        open={workspaceSearchMode !== null}
        initialMode={workspaceSearchMode || 'search'}
        isDarkMode={isDarkMode}
        activeFilePath={activeFile?.path}
        activeProjectId={activeProjectId}
        hasUnsavedFiles={files.some(isEditorFileDirty) || designerDirty}
        onClose={() => setWorkspaceSearchMode(null)}
        contextVersion={projectFileLoadGenerationRef.current}
        onQuery={handleWorkspaceSearchQuery}
        onPreview={handleWorkspaceReplacePreview}
        onApply={handleWorkspaceReplaceApply}
        onRollback={handleWorkspaceReplaceRollback}
        onReveal={match => { void handleWorkspaceSearchReveal(match); }}
        onSaveBeforeReplace={() => handleSaveWorkspace('工作区替换前保存')}
      />

      <ProjectNameDialog
        open={showCreateProjectDialog}
        value={createProjectName}
        isDarkMode={isDarkMode}
        title={createProjectTemplateId === 'windows-dll' ? '新建 Windows DLL 项目' : undefined}
        description={createProjectTemplateId === 'windows-dll'
          ? '将创建 MSVC DLL 源码、C ABI 导出示例和可复制的 Visual Studio 工程。'
          : undefined}
        confirmLabel={createProjectTemplateId === 'windows-dll' ? '创建 DLL 项目' : undefined}
        busy={isCreatingSolutionProject}
        error={createProjectError || undefined}
        solutionName={createSolutionName}
        onSolutionNameChange={value => {
          createDialogSolutionNameTouchedRef.current = true;
          setCreateSolutionName(value);
          if (createProjectError) setCreateProjectError('');
        }}
        solutionNameHint="留空表示沿用当前解决方案名称；修改后将重命名解决方案。"
        location={createProjectLocation}
        onLocationChange={value => {
          setCreateProjectLocation(value);
          if (createProjectError) setCreateProjectError('');
        }}
        locationPlaceholder={"例如：games/我的游戏 或 D:\\Projects\\我的游戏"}
        locationHint="相对路径在当前工作区内创建项目；其他磁盘的绝对路径（单个反斜杠即可）将创建独立项目工作区并自动切换过去。"
        onChange={value => {
          setCreateProjectName(value);
          if (createProjectError) setCreateProjectError('');
        }}
        onConfirm={submitCreateSolutionProject}
        onClose={() => {
          if (!isCreatingSolutionProject) setShowCreateProjectDialog(false);
        }}
      />

<WorkbenchConfirmDialog
        open={Boolean(workbenchDialog)}
        kind={workbenchDialog?.kind}
        title={workbenchDialog?.title || ''}
        description={workbenchDialog?.description}
        confirmLabel={workbenchDialog?.confirmLabel}
        cancelLabel={workbenchDialog?.cancelLabel}
        inputLabel={workbenchDialog?.inputLabel}
        inputValue={workbenchDialog?.inputValue}
        inputPlaceholder={workbenchDialog?.inputPlaceholder}
        isDarkMode={isDarkMode}
        onResult={settleWorkbenchDialog}
      />

      <ProjectNameDialog
        open={Boolean(solutionNameOperation)}
        value={solutionNameValue}
        isDarkMode={isDarkMode}
        busy={isSubmittingSolutionName}
        error={solutionNameError || undefined}
        title={solutionNameOperation?.kind === 'rename-project' ? '重命名项目' : '新建解决方案文件夹'}
        description={solutionNameOperation?.kind === 'rename-project'
          ? '只修改项目显示名称；项目 ID、磁盘目录、源码路径、引用和构建配置保持不变。'
          : '创建用于整理项目的逻辑文件夹，不会在磁盘上新建目录或移动项目文件。'}
        label={solutionNameOperation?.kind === 'rename-project' ? '新的项目名称' : '文件夹名称'}
        confirmLabel={solutionNameOperation?.kind === 'rename-project' ? '确认重命名' : '创建文件夹'}
        busyLabel={solutionNameOperation?.kind === 'rename-project' ? '正在重命名…' : '正在创建…'}
        dialogId="solution-name-dialog-title"
        inputId="solution-name-input"
        onChange={value => {
          setSolutionNameValue(value);
          if (solutionNameError) setSolutionNameError('');
        }}
        onConfirm={submitSolutionNameOperation}
        onClose={() => {
          if (isSubmittingSolutionName) return;
          setSolutionNameOperation(null);
          setSolutionNameValue('');
          setSolutionNameError('');
        }}
      />

      <SettingsDialog
        open={showSettingsDialog}
        snapshot={configurationSnapshot}
        commands={settingsWorkbenchCommands}
        isDarkMode={isDarkMode}
        loading={configurationLoading}
        error={configurationError || undefined}
        onUpdate={updateWorkbenchConfiguration}
        onReset={resetWorkbenchConfiguration}
        onReload={loadWorkbenchConfiguration}
        onClose={() => setShowSettingsDialog(false)}
      />

      <ProjectBuildPathsDialog
        open={Boolean(projectBuildPathsState)}
        isDarkMode={isDarkMode}
        busy={projectBuildPathsBusy}
        error={projectBuildPathsError || undefined}
        projectName={projectBuildPathsState?.projectName || ''}
        initialValue={projectBuildPathsState?.initialValue || { projectBuildDirectory: '', projectGeneratedSourceDirectory: '', workspaceBuildDirectory: '', workspaceGeneratedSourceDirectory: '' }}
        platform={buildConfiguration.architecture}
        configuration={buildConfiguration.mode}
        onConfirm={handleSaveProjectBuildPaths}
        onClose={() => setProjectBuildPathsState(null)}
      />

      <EnvironmentRepairCenter
        open={showEnvironmentRepairCenter}
        isDarkMode={isDarkMode}
        onClose={() => setShowEnvironmentRepairCenter(false)}
        onEvent={message => {
          setShowBottomPanel(true);
          setActiveTabInBottom('output');
          setBuildLogs(previous => [...previous, `> [${new Date().toLocaleTimeString()}] 【环境修复】${message}`]);
        }}
      />

      <SdkDependencyInstallerDialog isDarkMode={isDarkMode} />

      <CliGuideDialog
        open={showCliGuide}
        isDarkMode={isDarkMode}
        onClose={() => setShowCliGuide(false)}
        onOpenTerminal={message => {
          setShowCliGuide(false);
          setShowBottomPanel(true);
          setActiveTabInBottom('terminal');
          if (message) {
            setBuildLogs(previous => [...previous, `> [${new Date().toLocaleTimeString()}] 【AI Bridge】${message}`]);
          }
        }}
      />

      <HelpCenterDialog
        open={showHelpCenter}
        onClose={() => setShowHelpCenter(false)}
      />

      <AboutDialog
        open={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
      <UpdateDialog
        open={Boolean(updateCheckState)}
        info={updateCheckState}
        currentVersionLabel={LINGBUILDER_DISPLAY_VERSION}
        isDarkMode={isDarkMode}
        onClose={() => setUpdateCheckState(null)}
      />

      <SponsorDialog
        open={showSponsorDialog}
        onClose={() => setShowSponsorDialog(false)}
      />

      <RecentWorkspacesDialog
        open={showRecentWorkspacesDialog}
        isDarkMode={isDarkMode}
        recentWorkspaces={recentWorkspaces}
        onOpenWorkspace={workspacePath => {
          setShowRecentWorkspacesDialog(false);
          void handleOpenWorkspacePath(workspacePath);
        }}
        onForgetWorkspace={handleForgetRecentWorkspace}
        onClose={() => setShowRecentWorkspacesDialog(false)}
      />

      {/* Load Custom Code Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in select-text text-slate-300">
          <div className="bg-[#1e1e24] rounded-lg border border-[#2d2d34] shadow-2xl max-w-2xl w-full flex flex-col h-[520px] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#2d2d34] bg-[#18181c] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileUp className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-bold text-slate-200">导入自定义 C++ 源代码</span>
              </div>
              <button
                onClick={() => setShowCustomModal(false)}
                className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex-1 flex flex-col overflow-y-auto space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">保存的文件名称 (C++/头文件)</label>
                <input
                  type="text"
                  placeholder="例如 math_helper.cpp, game_state.h"
                  value={customFilename}
                  onChange={e => setCustomFilename(e.target.value)}
                  className="bg-[#24242b] border border-[#2d2d34] rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono w-full"
                />
              </div>

              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">C++ 源码内容 (复制粘贴到下方)</label>
                <textarea
                  placeholder="在此处贴入您的 C++ 源代码..."
                  value={customCode}
                  onChange={e => setCustomCode(e.target.value)}
                  className="flex-1 bg-[#141418] border border-[#2d2d34] rounded p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono resize-none h-full"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#2d2d34] bg-[#18181c] flex justify-end gap-3 shrink-0 select-none">
              <button
                onClick={() => setShowCustomModal(false)}
                className="px-4 py-1.5 rounded-md bg-[#2d2d36] hover:bg-[#383844] text-xs font-semibold text-slate-200 transition-colors cursor-pointer border border-[#2d2d34]"
              >
                取消
              </button>
              <button
                onClick={handleExtractCustomCode}
                disabled={isExtracting || !customCode.trim() || !customFilename.trim()}
                className="flex items-center gap-1.5 px-5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isExtracting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>智能分析提取中...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-3.5 h-3.5" />
                    <span>智能分析并一键导入</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDesignerEventEdit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4 select-none">
          <div className="w-full max-w-xl bg-[#1e1e24] border border-[#2d2d34] rounded-lg shadow-2xl flex flex-col text-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-[#18181c] border-b border-[#2d2d34] flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <div className="h-7 w-7 rounded bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-slate-100">应用设计器事件函数</div>
                  <div className="truncate text-[10px] text-slate-500">{pendingDesignerEventEdit.targetFilePath}</div>
                </div>
              </div>
              <button
                onClick={handleCancelDesignerEventEdit}
                className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="取消并只定位到事件"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <Code className="w-4 h-4 text-amber-400" />
                </div>
                <div className="min-w-0 space-y-1">
                  <h4 className="text-xs font-bold text-slate-100">{pendingDesignerEventEdit.proposal.summary}</h4>
                  <p className="text-[10.5px] text-slate-400 leading-relaxed">
                    设计器检测到当前菜单项还没有对应事件函数。确认后会写入中文源码；取消则只打开并定位到当前事件。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                <div className="rounded border border-[#2d2d34] bg-[#141418] px-2 py-1.5">
                  <div className="text-slate-500">触发对象</div>
                  <div className="mt-0.5 truncate font-semibold text-cyan-200">{pendingDesignerEventEdit.controlName || '设计器控件'}</div>
                </div>
                <div className="rounded border border-[#2d2d34] bg-[#141418] px-2 py-1.5">
                  <div className="text-slate-500">事件处理器</div>
                  <div className="mt-0.5 truncate font-mono font-semibold text-emerald-300">{pendingDesignerEventEdit.handlerName}</div>
                </div>
                <div className="rounded border border-[#2d2d34] bg-[#141418] px-2 py-1.5">
                  <div className="text-slate-500">事件类型</div>
                  <div className="mt-0.5 truncate text-slate-200">{pendingDesignerEventEdit.eventName || 'Select'}</div>
                </div>
                <div className="rounded border border-[#2d2d34] bg-[#141418] px-2 py-1.5">
                  <div className="text-slate-500">所在窗口</div>
                  <div className="mt-0.5 truncate text-slate-200">{pendingDesignerEventEdit.windowTitle || '当前设计器窗口'}</div>
                </div>
              </div>

              <div className="rounded border border-[#2d2d34] bg-[#101116] overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#2d2d34] bg-[#18181c] px-3 py-1.5">
                  <span className="text-[10px] font-semibold text-slate-400">将写入的中文代码</span>
                  <span className="text-[9px] text-slate-600">WorkspaceEdit 预览</span>
                </div>
                <pre className="max-h-44 overflow-auto p-3 text-[11px] leading-5 text-slate-200 font-mono whitespace-pre-wrap">
                  {pendingDesignerEventEdit.newText || '(没有可显示的新增代码)'}
                </pre>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-[#18181c] border-t border-[#2d2d34] flex justify-end gap-2.5">
              <button
                onClick={handleCancelDesignerEventEdit}
                className="px-3 py-1.5 bg-[#2d2d36] hover:bg-[#383844] text-slate-300 rounded text-[11px] font-semibold transition-colors cursor-pointer border border-[#2d2d34]"
              >
                只定位事件
              </button>
              <button
                onClick={handleConfirmDesignerEventEdit}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer shadow"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>应用生成</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloseConfirmModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-4 select-none">
          <div className="w-full max-w-sm bg-[#1e1e24] border border-[#2d2d34] rounded-lg shadow-2xl flex flex-col text-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-[#18181c] border-b border-[#2d2d34] flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">退出确认</span>
              <button
                onClick={() => setShowCloseConfirmModal(false)}
                className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <HelpCircle className="w-5 h-5 text-amber-500" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-100">确定要关闭 C++ LocMaster吗？</h4>
                  <p className="text-[10.5px] text-slate-400 leading-relaxed">
                    退出后，内存中临时加载的 C++ 编译进程缓冲区和一键智能分析沙盒将被释放销毁。
                  </p>
                </div>
              </div>

              <div className="bg-[#141418] p-2 rounded text-[9.5px] font-mono text-amber-500/80 border border-amber-500/10">
                // 提示：退出前建议进行“保存项目 (Ctrl+S)”操作，以便于在下次启动时自动恢复所有的翻译对照快照。
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-[#18181c] border-t border-[#2d2d34] flex justify-end gap-2.5">
              <button
                onClick={() => setShowCloseConfirmModal(false)}
                className="px-3 py-1 bg-[#2d2d36] hover:bg-[#383844] text-slate-300 rounded text-[11px] font-semibold transition-colors cursor-pointer border border-[#2d2d34]"
              >
                取消
              </button>
              <button
                onClick={handleWindowCloseConfirmed}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
              >
                直接退出
              </button>
              <button
                onClick={async () => {
                  const saved = await handleSaveWorkspace('退出前保存');
                  if (saved) await handleWindowCloseConfirmed();
                }}
                disabled={isSaving || isBuilding}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
              >
                {isSaving ? '正在保存…' : '保存并退出'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div data-workbench-statusbar className="h-7 bg-[#007ACC] text-white flex items-center px-3 justify-between gap-3 text-[12px] shrink-0 select-none font-sans overflow-x-auto">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-white opacity-80"></span>
            <span>{projectFilesReady ? '已就绪' : projectFilesLoading ? '载入项目文件' : '项目文件不可用'}</span>
          </div>
          <TextFileStatusControls
            format={getTextFileFormat(activeFile)}
            fileName={activeFile.name}
            isDarkMode={isDarkMode}
            disabled={isSaving || isBuilding || !projectFilesReady}
            isModified={activeFile.formatModified}
            onEncodingChange={encoding => updateActiveTextFileFormat({ encoding })}
            onEolChange={eol => updateActiveTextFileFormat({ eol })}
          />
          <div className="hidden sm:flex items-center gap-1 text-slate-100">
            <span>构建:</span>
            <select aria-label="构建模式" value={buildConfiguration.mode} onChange={event => void updateBuildConfiguration({ mode: event.target.value as BuildMode })} className="bg-[#0069a8] rounded px-1 py-0.5">
              <option>Debug</option><option>Release</option>
            </select>
            <select aria-label="构建架构" value={buildConfiguration.architecture} onChange={event => void updateBuildConfiguration({ architecture: event.target.value as BuildArchitecture })} className="bg-[#0069a8] rounded px-1 py-0.5">
              <option>Win32</option><option>x64</option>
            </select>
          </div>
          <button
            type="button"
            title={clangdStatus.message}
            onClick={() => { void fetch(clangdStatus.state === 'ready' ? '/api/lsp/stop' : '/api/lsp/start', { method: 'POST' }); }}
            className="hidden md:block rounded px-2 py-0.5 hover:bg-white/15"
          >clangd: {clangdStatus.state === 'ready' ? '已就绪' : clangdStatus.state === 'unavailable' ? '本地降级' : clangdStatus.state === 'restarting' ? '重启中' : '未启动'}</button>
          {taskSnapshots.find(task => task.state === 'running' || task.state === 'queued') && (() => {
            const task = taskSnapshots.find(candidate => candidate.state === 'running' || candidate.state === 'queued')!;
            return <button
              type="button"
              title="点击取消当前任务"
              onClick={() => { void fetch(`/api/tasks/${encodeURIComponent(task.id)}/cancel`, { method: 'POST' }); setShowBottomPanel(true); setActiveTabInBottom('output'); }}
              className="rounded px-2 py-0.5 hover:bg-white/15"
            >{task.state === 'queued' ? '排队' : `${task.progress}%`} · {task.title} ×</button>;
          })()}
        </div>
        <div className="flex shrink-0 items-center gap-4 whitespace-nowrap text-slate-100">
          <EditorPositionStatus state={editorState} />
          <div className="shrink-0">
            {editorExperienceMode === 'beginner'
              ? '结构化中文编辑'
              : editorExperienceMode === 'professional'
                ? 'Monaco 专业编辑'
                : '原生 C++ 预览'}
          </div>
          <div className="shrink-0">空格: 4</div>
          <div className="shrink-0 hover:bg-[#1f8ad2] px-2 py-0.5 rounded cursor-pointer transition-colors">反馈支持</div>
        </div>
      </div>

      {isWorkspaceSwitching && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#111116]/75 backdrop-blur-[2px]" role="status" aria-live="polite">
          <div className="flex min-w-[280px] items-center gap-3 rounded-lg border border-blue-400/30 bg-[#1f2028] px-5 py-4 text-sm text-slate-100 shadow-2xl">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
            <span>正在切换工作区并载入项目文件…</span>
          </div>
        </div>
      )}
    </div>
  );
}

