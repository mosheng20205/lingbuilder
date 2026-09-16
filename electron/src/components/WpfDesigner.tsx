import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { requestWorkbenchConfirm } from '../services/workbench/workbenchConfirmService';
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clapperboard,
  Copy,
  FileCode,
  FileText,
  FolderOpen,
  FileUp,
  Fingerprint,
  Globe,
  Keyboard,
  Layers,
  LayoutGrid,
  ListTree,
  List,
  Maximize2,
  Minus,
  Monitor,
  MousePointer,
  Palette,
  Play,
  Plus,
  RefreshCw,
  Search,
  SquareDot,
  Terminal,
  Trash2,
  Type,
  Upload,
  Wrench,
  X,
  Zap,
  Menu,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import ModuleInspector from './ModuleInspector';
import WorkbenchContextMenu from './WorkbenchContextMenu';
import ListViewDesignerPreview from './ListViewDesignerPreview';
import DataGridDesignerPreview from './DataGridDesignerPreview';
import HeaderDesignerPreview from './HeaderDesignerPreview';
import TabControlDesignerPreview from './TabControlDesignerPreview';
import UpDownDesignerPreview from './UpDownDesignerPreview';
import NewEmojiDesignerControlPreview, { getNewEmojiPreviewKind } from './NewEmojiDesignerControlPreview';
import ListViewCollectionDialog, { type ListViewCollectionEditorKind } from './ListViewCollectionDialog';
import DataGridEditorDialog from './DataGridEditorDialog';
import FbroJsQueryEditorDialog, { parseFbroJsQueryChannels } from './FbroJsQueryEditorDialog';
import NewEmojiTableEditorDialog, { getNewEmojiTableEditorData, isNewEmojiTableDataProperty } from './NewEmojiTableEditorDialog';
import ToolbarButtonsDialog from './ToolbarButtonsDialog';
import StatusBarPartsDialog from './StatusBarPartsDialog';
import TabControlPagesDialog from './TabControlPagesDialog';
import MenuBarItemsDialog from './MenuBarItemsDialog';
import TreeViewCollectionDialog from './TreeViewCollectionDialog';
import {
  createBlankWindow,
  createControl,
  DEFAULT_WINDOW_CORNER_STYLE,
  DEFAULT_WINDOW_ICON_STYLE,
  DEFAULT_WINDOW_TITLE_BAR_BACKGROUND,
  DEFAULT_WINDOW_TITLE_BAR_FOREGROUND,
  NEW_EMOJI_BROWSER_SHELL_FRAME_FLAGS,
  NEW_EMOJI_WINDOW_FRAME_FLAG_OPTIONS,
  getDesignerWindowContentOffset,
  getEplEventHandlerName,
  getEventsForType,
  getPrimaryDesignerEventBinding,
  getPrimaryEventNameForType,
  hasDesignerWindowMenu,
  notifyWindowDesignerDirtyStateChanged,
  normalizeWindowDesignerState,
  normalizeLingWindowFrame,
  readWindowDesignerState,
  saveWindowDesignerSelection,
  saveWindowDesignerState,
  WINDOW_DESIGNER_PROJECT_UPDATED,
  PersistedWindowDesignerState,
  WindowDesignerDirtyStateDetail
} from '../services/windowDesigner/windowDesignerService';
import { DEFAULT_WINDOW_BORDER_STYLE, LING_WINDOW_BORDER_STYLE_OPTIONS, deriveLingWindowBorderStyle, resolveLingWindowBorder, toggleBorderFamily } from '../services/windowDesigner/windowBorderStyle';
import { normalizeToolbarButtons } from '../services/windowDesigner/toolbarButtonCollectionModel';
import { normalizeStatusBarParts } from '../services/windowDesigner/statusBarPartCollectionModel';
import { fetchWithSdkDependencies } from '../services/sdkDependencies/sdkDependencyClient';
import { draftFromEmbeddedSite, embeddedSiteFromDraft, getEmbeddedSiteEntryDirectory, parseEmbeddedSiteFilesText, pickEmbeddedSiteEntry, validateEmbeddedSiteDraft, type EmbeddedSiteDraft } from '../services/windowDesigner/embeddedSiteModel';
import { normalizeDataGridModel } from '../services/windowDesigner/dataGridModel';
import { captureDesignerHotKey } from '../services/windowDesigner/hotKeyProperty';
import {
  notifyWindowDesignerBuildRunState,
  requestWindowDesignerBuildRun,
  requestWindowDesignerLingCppSource,
  WINDOW_DESIGNER_BUILD_RUN_REQUEST
} from '../services/windowDesigner/windowDesignerCommands';
import {
  LingControl,
  LingControlType,
  LingDesignerResource,
  LingFileDialogResource,
  LingImageListResource,
  LingMenuResource,
  LingMenuResourceItem,
  LingPropertySheetResource,
  LingToolTipResource,
  LingWindowBorderStyle,
  LingWindowModel,
  LingWindowCornerStyle,
  LingWindowIconStyle,
  LingWindowOpenPlacement,
  LingWindowProject
} from '../services/windowDesigner/types';
import { parseMenuBarItems } from '../services/windowDesigner/menuBarItemsModel';
import {
  getCreatableWin32ControlDefinitions,
  getWin32ControlDefinition,
  getWin32RuntimeControlContract,
  WIN32_CONTROL_DEFINITIONS,
  Win32ControlPropertyDefinition,
  Win32ControlPropertyValue
} from '../services/windowDesigner/win32ControlRegistry';
import { findControlTagConflict, normalizeControlTagInteger, normalizeControlTagText } from '../services/windowDesigner/controlTagService';
import { CONTROL_FONT_FAMILY_OPTIONS, DEFAULT_CONTROL_FONT_FAMILY, getControlFontCssStyle, normalizeControlFont } from '../services/windowDesigner/controlFont';
import {
  buildControlHierarchy,
  canReparentControls,
  getEffectiveControlStates,
  getControlDescendantIds,
  LingControlHierarchyNode,
  orderControlsForDesignerPainting,
  reparentControls
} from '../services/windowDesigner/controlHierarchy';
import { applyDesignerLayout, createNextRebarBand, DesignerHistory, nudgeControls, reconcileRebarBands, reorderDesignerControls, updateControlWithDescendants, type DesignerLayoutOperation } from '../services/windowDesigner/designerOperations';
import { CommandService, createCommandService } from '../services/commands/commandService';
import type { CommandContext } from '../services/commands/types';
import { DESIGNER_CANVAS_CONTEXT_MENU, DESIGNER_CONTROL_CONTEXT_MENU, DESIGNER_RESOURCE_CONTEXT_MENU, getMenuService, type ResolvedMenuCommandItem } from '../services/menus';
import { createDesignerContainerLayoutRegistry } from '../services/windowDesigner/containerLayoutRegistry';
import { DesignerClipboardService, removeClipboardSelection } from '../services/windowDesigner/designerClipboardService';
import { acquireDesignerCommands, activeDesignerCommandTargetService, type DesignerCommandTarget, type DesignerLayerOperation } from '../services/windowDesigner/designerCommandTargetService';
import {
  getPendingDesignerNavigation,
  registerDesignerNavigationTarget as registerDesignerNavigationTargetHandler,
  subscribeDesignerNavigation,
  type DesignerNavigationRequest
} from '../services/windowDesigner/designerNavigationService';
import { applyDesignerEditEnvelope, getDesignerModelRevision, isDesignerEditEnvelope, type DesignerCommandInvocation } from '../services/windowDesigner/designerExtensionEditService';
import type { ExtensionHostSnapshot } from '../services/extensions/types';
import {
  getWindowEventHandlerName,
  WINDOW_EVENT_CATEGORIES,
  WINDOW_EVENT_DEFINITIONS
} from '../services/windowDesigner/windowEventRegistry';
import {
  normalizeListViewColumns,
  normalizeListViewRows,
  type ListViewEditableColumn,
  type ListViewEditableRow
} from '../services/windowDesigner/listViewCollectionModel';
import { flattenTreeViewNodes, normalizeTreeViewNodes } from '../services/windowDesigner/treeViewCollectionModel';
import { getDesignerImagePreviewSource, scanEmbeddedSiteDirectory, selectAndImportDesignerAnimation, selectAndImportDesignerGif, selectAndImportDesignerIcon, selectAndImportDesignerImage, selectAndImportDesignerVideo } from '../services/windowDesigner/designerAssetClient';
import {
  getNewEmojiThemePreview,
  isNewEmojiDesignerControlSupported,
  isNewEmojiDesignerEnabled,
  NEW_EMOJI_MODULE_ID,
  type NewEmojiThemePreview
} from '../services/windowDesigner/newEmojiDesignerAdapter';
import {
  createControlToolboxGroups,
  getControlToolboxModuleDisabledMessage,
  readControlToolboxExpansionState,
  saveControlToolboxExpansionState,
  type ControlToolboxExpansionState,
  type ControlToolboxGroup,
  type ControlToolboxGroupId
} from '../services/windowDesigner/controlToolboxModel';
import { migrateDesignerBackend } from '../services/windowDesigner/designerControlRegistry';
import type { InstalledModule, ModuleDesignerControlContribution } from '../services/modules/types';
import { describeModuleDesignerEventParameters } from '../services/modules/moduleDesignerEventService';
import type { OpenControlEventCodeDetail } from '../services/windowDesigner/controlEventCodeService';
import {
  getControlTabSlot,
  getSelectedTabPage,
  getTabContainerContentOffset,
  getTabControlPages,
  isControlOnSelectedTab,
  isNewEmojiTabsControl,
  isTabContainerControl,
  type TabControlPage,
  type TabControlPageMutation
} from '../services/windowDesigner/tabControlModel';

type InspectorTab = 'properties' | 'events' | 'layout';
type ResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface DesignerControlInteractionPreview {
  windowId: string;
  controlId: string;
  fields: Partial<Pick<LingControl, 'x' | 'y' | 'width' | 'height'>>;
}
interface DesignerWindowInteractionPreview {
  windowId: string;
  width: number;
  height: number;
}
interface DesignerResourceInteractionPreview {
  resourceId: string;
  x: number;
  y: number;
}
type DesignerZoomMode = 'fit' | 'manual';

interface DesignerControlRenderProps {
  control: LingControl;
  projectId: string;
  isSelected: boolean;
  handleMouseDown: (event: React.MouseEvent, control: LingControl, action: 'drag' | ResizeDirection) => void;
  setSelectedControlId: (id: string | null) => void;
  onOpenEventCode: (event: React.MouseEvent, control: LingControl) => void;
  onOpenContextMenu: (event: React.MouseEvent, controlId: string) => void;
  contentOffset: number;
  useNewEmojiDesigner: boolean;
  newEmojiThemePreview: NewEmojiThemePreview;
  isEffectivelyVisible: boolean;
  isEffectivelyEnabled: boolean;
  ancestorsVisible: boolean;
  onSelectTabPage?: (pageId: string) => void;
  onReorderRebarBand?: (fromIndex: number, toIndex: number) => void;
  navigationRef?: (element: HTMLElement | null) => void;
}
const WINDOW_ROOT_DROP_TARGET = '__layout_window_root__';
const LINGBUILDER_WINDOW_ICON_PREVIEW = new URL('../../../image/lingbuilder-ide-icon-v2.png', import.meta.url).href;
const DESIGNER_CANVAS_PADDING = 48;
const DESIGNER_CANVAS_HORIZONTAL_INSET = DESIGNER_CANVAS_PADDING;
const DESIGNER_CANVAS_VERTICAL_INSET = 82;

/** Keep fit zoom deterministic when the viewport is measured at fractional DPI sizes. */
export function calculateDesignerFitScale(
  viewportWidth: number,
  viewportHeight: number,
  canvasWidth: number,
  canvasHeight: number
): number {
  const availableWidth = Math.max(240, viewportWidth - DESIGNER_CANVAS_HORIZONTAL_INSET);
  const availableHeight = Math.max(180, viewportHeight - DESIGNER_CANVAS_VERTICAL_INSET);
  const safeCanvasWidth = Math.max(1, canvasWidth);
  const safeCanvasHeight = Math.max(1, canvasHeight);
  return Math.max(
    0.25,
    Math.min(1, availableWidth / safeCanvasWidth, availableHeight / safeCanvasHeight)
  );
}

export function parseStringListPropertyText(text: string): string[] {
  return text.split(/\r?\n/).filter(item => item.length > 0);
}

interface DesignerContextMenuState {
  x: number;
  y: number;
  menuId: string;
  controlId?: string;
  resourceId?: string;
}

type EdgeControlPreviewState = { status: 'idle' | 'preparing' | 'compiling' | 'running' | 'failed' | 'stopping'; message?: string; pid?: number };

export interface WpfDesignerProps {
  isDarkMode: boolean;
  activeFile?: any;
  projectId: string;
  authoritativeProject?: LingWindowProject;
  authoritativeActiveWindowId?: string;
  onProjectChange?: (state: PersistedWindowDesignerState) => void;
  onDirtyChange?: (detail: WindowDesignerDirtyStateDetail) => void;
  commandService?: CommandService;
  getCommandContext?: () => CommandContext;
  toolboxHost?: HTMLElement | null;
}

export const CREATABLE_DESIGNER_CONTROL_TYPES: LingControlType[] = [
  ...getCreatableWin32ControlDefinitions().filter(definition => definition.isVisual !== false).map(definition => definition.type as LingControlType),
  'FileDialog',
  'ContextMenu',
  'PopupMenu'
];

const CONTROL_LABELS: Record<string, string> = Object.fromEntries([
  ...WIN32_CONTROL_DEFINITIONS.map(definition => [definition.type, definition.label]),
  ['MenuBar', '窗口菜单栏']
]);

const DEDICATED_CONTROL_PREVIEW_TYPES = new Set<LingControlType>([
  'Button', 'TextBox', 'Label', 'SysLink', 'CheckBox', 'RadioButton', 'ListBox',
  'ProgressBar', 'ComboBox', 'ComboBoxEx', 'GroupBox', 'Image', 'AnimatedImage',
  'VideoPlayer', 'ListView', 'DataGrid', 'Header', 'TreeView', 'TabControl', 'StatusBar', 'ReBar',
  'IPAddress', 'TrackBar', 'UpDown', 'Upload', 'DragUpload', 'RichEdit', 'ColorPicker', 'EdgeBrowser', 'CefBrowser', 'FBroBrowser'
]);

export function hasDedicatedControlPreview(type: LingControlType): boolean {
  return DEDICATED_CONTROL_PREVIEW_TYPES.has(type);
}

const TYPE_ICONS: Partial<Record<LingControlType | 'MenuBar', React.ReactNode>> = {
  Button: <SquareDot className="w-3.5 h-3.5 text-blue-400" />,
  TextBox: <Keyboard className="w-3.5 h-3.5 text-teal-400" />,
  Label: <Type className="w-3.5 h-3.5 text-cyan-400" />,
  CheckBox: <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />,
  RadioButton: <CircleDot className="w-3.5 h-3.5 text-purple-400" />,
  Image: <Palette className="w-3.5 h-3.5 text-pink-400" />,
  AnimatedImage: <Play className="w-3.5 h-3.5 text-fuchsia-400" />,
  VideoPlayer: <Clapperboard className="w-3.5 h-3.5 text-rose-400" />,
  ColorPicker: <Palette className="w-3.5 h-3.5 text-violet-400" />,
  ProgressBar: <Minus className="w-3.5 h-3.5 text-emerald-400" />,
  Upload: <Upload className="w-3.5 h-3.5 text-sky-400" />,
  DragUpload: <FileUp className="w-3.5 h-3.5 text-fuchsia-400" />,
  FileDialog: <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />,
  ContextMenu: <Menu className="w-3.5 h-3.5 text-amber-400" />,
  PopupMenu: <Menu className="w-3.5 h-3.5 text-orange-400" />,
  ComboBox: <List className="w-3.5 h-3.5 text-violet-400" />,
  CefBrowser: <Globe className="w-3.5 h-3.5 text-sky-400" />,
  FBroBrowser: <Fingerprint className="w-3.5 h-3.5 text-amber-400" />,
  EdgeBrowser: <Globe className="w-3.5 h-3.5 text-emerald-400" />,
  Grid: <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />,
  MenuBar: <Menu className="w-3.5 h-3.5 text-amber-400" />
} as any;

function getControlIcon(type: LingControlType | 'MenuBar'): React.ReactNode {
  return TYPE_ICONS[type] || <SquareDot className="h-3.5 w-3.5 text-sky-400" />;
}

const WINDOW_OPEN_PLACEMENT_OPTIONS: { value: LingWindowOpenPlacement; label: string }[] = [
  { value: 'default', label: '系统默认' },
  { value: 'center', label: '居中显示' },
  { value: 'top-left', label: '左上角' },
  { value: 'top-right', label: '右上角' },
  { value: 'bottom-left', label: '左下角' },
  { value: 'bottom-right', label: '右下角' },
  { value: 'custom', label: '自定义坐标' }
];

export default function WpfDesigner({
  isDarkMode,
  activeFile,
  projectId,
  authoritativeProject,
  authoritativeActiveWindowId,
  onProjectChange,
  onDirtyChange,
  commandService,
  getCommandContext,
  toolboxHost,
}: WpfDesignerProps) {
  const fallbackCommandServiceRef = useRef<CommandService | null>(null);
  if (!fallbackCommandServiceRef.current) fallbackCommandServiceRef.current = createCommandService();
  const designerCommandService = commandService || fallbackCommandServiceRef.current;
  const designerMenuService = useMemo(() => getMenuService(designerCommandService), [designerCommandService]);
  const designerInstanceId = useId();
  const layoutRegistryRef = useRef(createDesignerContainerLayoutRegistry());
  const clipboardServiceRef = useRef<DesignerClipboardService | null>(null);
  if (!clipboardServiceRef.current) {
    const clipboard = typeof navigator !== 'undefined' && navigator.clipboard
      ? { writeText: (value: string) => navigator.clipboard.writeText(value), readText: () => navigator.clipboard.readText() }
      : undefined;
    clipboardServiceRef.current = new DesignerClipboardService(layoutRegistryRef.current, clipboard);
  }
  const designerContextRef = useRef<CommandContext>({});
  const designerActionsRef = useRef<Omit<DesignerCommandTarget, 'id' | 'getContext'> | null>(null);
  const [initialDesignerState] = useState<PersistedWindowDesignerState>(() => {
    const cachedState = readWindowDesignerState(projectId);
    if (!authoritativeProject || authoritativeProject.id !== projectId) return cachedState;
    return normalizeWindowDesignerState({
      project: authoritativeProject,
      activeWindowId: authoritativeProject.windows.some(window => window.id === authoritativeActiveWindowId)
        ? authoritativeActiveWindowId
        : authoritativeProject.windows[0]?.id,
      selectedControlId: cachedState.project.id === projectId ? cachedState.selectedControlId : null
    });
  });
  const [project, setProject] = useState<LingWindowProject>(() => initialDesignerState.project);
  const [edgeControlPreview, setEdgeControlPreview] = useState<EdgeControlPreviewState>({ status: 'idle' });
  const currentProjectRef = useRef(project);
  const observedProjectRef = useRef(project);
  const suppressNextDirtySignalRef = useRef(false);
  const suppressNextProjectPublishRef = useRef(false);
  const publishingDesignerStateRef = useRef(false);
  currentProjectRef.current = project;
  const [enabledDesignerModules, setEnabledDesignerModules] = useState<Set<string>>(() => new Set(['lingbuilder.win32.basic']));
  const [enabledDesignerModuleRecords, setEnabledDesignerModuleRecords] = useState<InstalledModule[]>([]);
  const [activeWindowId, setActiveWindowId] = useState(initialDesignerState.activeWindowId);
  const activeWindowIdRef = useRef(activeWindowId);
  activeWindowIdRef.current = activeWindowId;

  useEffect(() => {
    if (activeFile && activeFile.name) {
      const className = activeFile.name.replace(/\.lcpp$/i, '');
      const xmlName = activeFile.name.replace(/\.lcpp$/i, '.xml');
      const foundWindow = project.windows.find(w =>
        w.fileName.toLowerCase() === xmlName.toLowerCase()
        || w.className.toLowerCase() === className.toLowerCase()
      );
      if (foundWindow) setActiveWindowId(currentWindowId => (
        foundWindow.id === currentWindowId ? currentWindowId : foundWindow.id
      ));
    }
  }, [activeFile?.name]);

  useEffect(() => {
    if (activeWindowId && project.windows) {
      const currentWin = project.windows.find(w => w.id === activeWindowId);
      if (currentWin) {
        window.dispatchEvent(new CustomEvent('designer-switch-window', {
          detail: { fileName: currentWin.fileName, className: currentWin.className }
        }));
      }
    }
  }, [activeWindowId]);
  const [selectedControlId, setSelectedControlId] = useState<string | null>(initialDesignerState.selectedControlId);
  const selectedControlIdRef = useRef(selectedControlId);
  selectedControlIdRef.current = selectedControlId;
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>(initialDesignerState.selectedControlId ? [initialDesignerState.selectedControlId] : []);
  const selectedControlIdsRef = useRef(selectedControlIds);
  selectedControlIdsRef.current = selectedControlIds;
  const selectionPersistenceTimerRef = useRef<number | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const designerNavigationTargetsRef = useRef(new Map<string, { element: HTMLElement; dispose(): void }>());
  const designerNavigationTargetElementsRef = useRef(new Map<string, HTMLElement>());
  const registerDesignerNavigationTargetElement = useCallback((kind: 'control' | 'resource', id: string, element: HTMLElement | null) => {
    const key = `${kind}:${id}`;
    const existing = designerNavigationTargetsRef.current.get(key);
    if (existing?.element === element) return;
    existing?.dispose();
    designerNavigationTargetsRef.current.delete(key);
    if (!element) {
      designerNavigationTargetElementsRef.current.delete(key);
      return;
    }
    designerNavigationTargetElementsRef.current.set(key, element);
    const currentProject = currentProjectRef.current;
    const currentWindowId = activeWindowIdRef.current;
    if (!currentWindowId) return;
    const control = currentProject.windows.find(window => window.id === currentWindowId)?.controls.find(item => item.id === id);
    const registration = registerDesignerNavigationTargetHandler({
      projectId: currentProject.id,
      windowId: currentWindowId,
      controlId: id,
      kind: kind === 'resource' ? 'resource' : getWin32ControlDefinition(control?.type || '')?.isVisual === false ? 'nonVisual' : 'visual'
    }, request => {
      const details = element.closest('details');
      if (details instanceof HTMLDetailsElement) details.open = true;
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: 'center', inline: 'center' });
      return request.controlId === id;
    });
    designerNavigationTargetsRef.current.set(key, { element, dispose: registration.dispose });
  }, []);
  const designerNavigationRefCallbacksRef = useRef(new Map<string, (element: HTMLElement | null) => void>());
  const registerDesignerNavigationTarget = useCallback((kind: 'control' | 'resource', id: string) => {
    const key = `${kind}:${id}`;
    const existing = designerNavigationRefCallbacksRef.current.get(key);
    if (existing) return existing;
    const callback = (element: HTMLElement | null) => registerDesignerNavigationTargetElement(kind, id, element);
    designerNavigationRefCallbacksRef.current.set(key, callback);
    return callback;
  }, [registerDesignerNavigationTargetElement]);
  useEffect(() => {
    // Ref callbacks are stable during drag, so refresh registrations only when
    // the project/window context changes instead of on every render.
    const elements = [...designerNavigationTargetElementsRef.current.entries()];
    elements.forEach(([key, element]) => {
      const [kind, ...idParts] = key.split(':');
      const id = idParts.join(':');
      const existing = designerNavigationTargetsRef.current.get(key);
      existing?.dispose();
      designerNavigationTargetsRef.current.delete(key);
      registerDesignerNavigationTargetElement(kind as 'control' | 'resource', id, element);
    });
  }, [activeWindowId, project.id, registerDesignerNavigationTargetElement]);
  useEffect(() => () => {
    designerNavigationTargetsRef.current.forEach(target => target.dispose());
    designerNavigationTargetsRef.current.clear();
    designerNavigationTargetElementsRef.current.clear();
    designerNavigationRefCallbacksRef.current.clear();
  }, []);
  const selectOnlyControl = useCallback((id: string | null) => {
    setSelectedControlId(id);
    setSelectedControlIds(id && !id.startsWith('__window_') ? [id] : []);
    setSelectedResourceId(null);
  }, []);
  const designerHistoryRef = useRef(new DesignerHistory(initialDesignerState.project));
  const applyingHistoryRef = useRef(false);
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>('properties');
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);
  const [controlContextMenu, setControlContextMenu] = useState<DesignerContextMenuState | null>(null);
  const [isNativeBuilding, setIsNativeBuilding] = useState(false);
  useEffect(() => { if (!selectedControlId || selectedControlId.startsWith('__window_')) { if (selectedControlIds.length) setSelectedControlIds([]); } else if (!selectedControlIds.includes(selectedControlId)) setSelectedControlIds([selectedControlId]); }, [selectedControlId]);
  useEffect(() => {
    if (selectedControlId !== null && selectedResourceId !== null) setSelectedResourceId(null);
  }, [selectedControlId, selectedResourceId]);

  useEffect(() => {
    const revealTarget = (request: DesignerNavigationRequest) => {
      if (request.projectId !== project.id) return;
      const targetWindow = project.windows.find(window => window.id === request.windowId);
      if (!targetWindow) return;
      const targetExists = request.kind === 'resource'
        ? Boolean((project.resources || []).some(resource => resource.id === request.controlId))
        : targetWindow.controls.some(control => control.id === request.controlId);
      if (!targetExists) return;

      setActiveWindowId(targetWindow.id);
      setActiveInspectorTab('properties');
      if (request.kind === 'resource') {
        setSelectedControlId(null);
        setSelectedControlIds([]);
        setSelectedResourceId(request.controlId);
      } else {
        setSelectedResourceId(null);
        setSelectedControlId(request.controlId);
        setSelectedControlIds([request.controlId]);
      }

    };
    const registration = subscribeDesignerNavigation(revealTarget);
    const pending = getPendingDesignerNavigation(project.id);
    if (pending) revealTarget(pending);
    return () => registration.dispose();
  }, [project]);

  useEffect(() => {
    const handleDesignerProjectUpdated = (event: Event) => {
      if (publishingDesignerStateRef.current) return;
      const nextState = (event as CustomEvent<PersistedWindowDesignerState>).detail;
      if (!nextState) return;
      if (nextState.project.id !== projectId) return;

      if (currentProjectRef.current !== nextState.project) {
        suppressNextDirtySignalRef.current = true;
        suppressNextProjectPublishRef.current = true;
        setProject(nextState.project);
      }
      setActiveWindowId(nextState.activeWindowId);
      setSelectedControlId(nextState.selectedControlId);
      setSelectedControlIds(nextState.selectedControlId ? [nextState.selectedControlId] : []);
      designerHistoryRef.current = new DesignerHistory(nextState.project);
    };

    window.addEventListener(WINDOW_DESIGNER_PROJECT_UPDATED, handleDesignerProjectUpdated);
    return () => {
      window.removeEventListener(WINDOW_DESIGNER_PROJECT_UPDATED, handleDesignerProjectUpdated);
    };
  }, [projectId]);

  useEffect(() => {
    if (!authoritativeProject || authoritativeProject.id !== projectId) return;
    if (JSON.stringify(currentProjectRef.current) === JSON.stringify(authoritativeProject)) return;
    const cachedState = readWindowDesignerState(projectId);
    const nextState = normalizeWindowDesignerState({
      project: authoritativeProject,
      activeWindowId: authoritativeProject.windows.some(window => window.id === authoritativeActiveWindowId)
        ? authoritativeActiveWindowId
        : authoritativeProject.windows[0]?.id,
      selectedControlId: cachedState.project.id === projectId ? cachedState.selectedControlId : null
    });
    suppressNextDirtySignalRef.current = true;
    suppressNextProjectPublishRef.current = true;
    setProject(nextState.project);
    setActiveWindowId(nextState.activeWindowId);
    setSelectedControlId(nextState.selectedControlId);
    setSelectedControlIds(nextState.selectedControlId ? [nextState.selectedControlId] : []);
    designerHistoryRef.current = new DesignerHistory(nextState.project);
    saveWindowDesignerState(nextState, { notify: false });
  }, [authoritativeActiveWindowId, authoritativeProject, projectId]);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [draggingResourceId, setDraggingResourceId] = useState<string | null>(null);
  const [resourceDragOffset, setResourceDragOffset] = useState({ x: 0, y: 0 });
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>('se');
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });
  const [initialControlPos, setInitialControlPos] = useState({ x: 0, y: 0 });
  const controlInteractionPreviewRef = useRef<DesignerControlInteractionPreview | null>(null);
  const pendingControlInteractionPreviewRef = useRef<DesignerControlInteractionPreview | null>(null);
  const controlInteractionFrameRef = useRef<number | null>(null);
  const windowInteractionPreviewRef = useRef<DesignerWindowInteractionPreview | null>(null);
  const pendingWindowInteractionPreviewRef = useRef<DesignerWindowInteractionPreview | null>(null);
  const resourceInteractionPreviewRef = useRef<DesignerResourceInteractionPreview | null>(null);
  const pendingResourceInteractionPreviewRef = useRef<DesignerResourceInteractionPreview | null>(null);
  const interactionPreviewFrameRef = useRef<number | null>(null);
  const windowResizeActiveRef = useRef(false);
  const [inspectorWidth, setInspectorWidth] = useState(300);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [controlToolboxSearch, setControlToolboxSearch] = useState('');
  const [expandedControlToolboxGroups, setExpandedControlToolboxGroups] = useState(
    () => readControlToolboxExpansionState(project.id)
  );
  const controlToolboxProjectIdRef = useRef(project.id);
  const skipNextControlToolboxSaveRef = useRef(false);
  const [zoomMode, setZoomMode] = useState<DesignerZoomMode>('fit');
  const [manualZoom, setManualZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);

  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasFrameRef = useRef<HTMLDivElement>(null);
  const canvasResizePreviewRef = useRef<HTMLDivElement>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const projectIdRef = useRef(project.id);
  projectIdRef.current = project.id;

  const activeWindow = useMemo(() => {
    return project.windows.find(window => window.id === activeWindowId) || project.windows[0];
  }, [activeWindowId, project.windows]);
  const activeWindowRef = useRef(activeWindow);
  activeWindowRef.current = activeWindow;
  const activeControlsById = useMemo(
    () => new Map(activeWindow.controls.map(control => [control.id, control])),
    [activeWindow.controls]
  );
  const activeControlsByIdRef = useRef(activeControlsById);
  activeControlsByIdRef.current = activeControlsById;
  const descendantIdsByControlId = useMemo(() => {
    const childrenByParent = new Map<string, string[]>();
    activeWindow.controls.forEach(control => {
      if (!control.parentId) return;
      const children = childrenByParent.get(control.parentId) || [];
      children.push(control.id);
      childrenByParent.set(control.parentId, children);
    });

    const result = new Map<string, string[]>();
    activeWindow.controls.forEach(control => {
      const descendants: string[] = [];
      const pending = [...(childrenByParent.get(control.id) || [])];
      const visited = new Set<string>();
      while (pending.length > 0) {
        const childId = pending.shift()!;
        if (visited.has(childId)) continue;
        visited.add(childId);
        descendants.push(childId);
        pending.push(...(childrenByParent.get(childId) || []));
      }
      result.set(control.id, descendants);
    });
    return result;
  }, [activeWindow.controls]);
  const descendantIdsByControlIdRef = useRef(descendantIdsByControlId);
  descendantIdsByControlIdRef.current = descendantIdsByControlId;
  const effectiveControlStates = useMemo(
    () => getEffectiveControlStates(activeWindow.controls),
    [activeWindow.controls]
  );
  const selectedTabVisibility = useMemo(() => {
    const visibility = new Map<string, boolean>();
    activeWindow.controls.forEach(control => {
      visibility.set(control.id, isControlOnSelectedTab(activeWindow.controls, control.id));
    });
    return visibility;
  }, [activeWindow.controls]);
  const designerControlNodesRef = useRef(new Map<string, HTMLElement>());
  const designerResourceNodesRef = useRef(new Map<string, HTMLElement>());
  const windowContentOffsetRef = useRef(0);
  const displayedWindowSize = activeWindow;
  const activeFileDialogs = useMemo(
    () => (project.resources || []).filter((resource): resource is LingFileDialogResource => (
      resource.type === 'FileDialog' && resource.ownerWindowId === activeWindow.id
    )),
    [activeWindow.id, project.resources]
  );
  const selectedFileDialog = useMemo(
    () => activeFileDialogs.find(resource => resource.id === selectedResourceId) || null,
    [activeFileDialogs, selectedResourceId]
  );
  const activeMenuResources = useMemo(
    () => (project.resources || []).filter((resource): resource is LingMenuResource => (
      (resource.type === 'ContextMenu' || resource.type === 'PopupMenu') && resource.ownerWindowId === activeWindow.id
    )),
    [activeWindow.id, project.resources]
  );
  const selectedMenuResource = useMemo(
    () => activeMenuResources.find(resource => resource.id === selectedResourceId) || null,
    [activeMenuResources, selectedResourceId]
  );
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const controlNodes = new Map<string, HTMLElement>();
    canvas.querySelectorAll<HTMLElement>('[data-designer-control-id]').forEach(node => {
      const id = node.dataset.designerControlId;
      if (id) controlNodes.set(id, node);
    });
    const resourceNodes = new Map<string, HTMLElement>();
    canvas.querySelectorAll<HTMLElement>('[data-designer-resource-id]').forEach(node => {
      const id = node.dataset.designerResourceId;
      if (id) resourceNodes.set(id, node);
    });
    designerControlNodesRef.current = controlNodes;
    designerResourceNodesRef.current = resourceNodes;
  }, [activeWindow.id, activeWindow.controls, project.resources]);
  const designerPaintControls = useMemo(
    () => orderControlsForDesignerPainting(activeWindow.controls),
    [activeWindow.controls]
  );
  const windowContentOffset = getDesignerWindowContentOffset(activeWindow);
  windowContentOffsetRef.current = windowContentOffset;

  /**
   * Interaction previews intentionally bypass React. The designer can contain
   * hundreds of controls; rendering the whole workbench for every mousemove
   * makes dragging janky even when persistence is deferred. These helpers only
   * touch the affected DOM nodes and the canvas frame, then the final pointer
   * position is committed to the project model on mouseup.
  */
  const previewAffectedControlIdsRef = useRef(new Set<string>());
  const previewAffectedResourceIdsRef = useRef(new Set<string>());
  const previewControlStylesRef = useRef(new Map<string, {
    transform: string;
    transformOrigin: string;
    width: string;
    height: string;
    willChange: string;
  }>());
  const previewResourceStylesRef = useRef(new Map<string, {
    left: string;
    top: string;
    transform: string;
    willChange: string;
  }>());
  const previewWindowStylesRef = useRef<{
    frameWidth: string;
    frameHeight: string;
    frameOverflow: string;
    frameWillChange: string;
    canvasWillChange: string;
    resizeHandleVisibility: Array<{ node: HTMLElement; visibility: string }>;
    overlayDisplay: string;
    overlayWidth: string;
    overlayHeight: string;
  } | null>(null);
  const applyControlInteractionPreviewToDom = useCallback((preview: DesignerControlInteractionPreview) => {
    const windowModel = activeWindowRef.current;
    if (preview.windowId !== windowModel.id) return;

    let nodes = designerControlNodesRef.current;
    if (nodes.size < windowModel.controls.length) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rebuilt = new Map<string, HTMLElement>();
      canvas.querySelectorAll<HTMLElement>('[data-designer-control-id]').forEach(node => {
        const id = node.dataset.designerControlId;
        if (id) rebuilt.set(id, node);
      });
      designerControlNodesRef.current = rebuilt;
      nodes = rebuilt;
    }

    const target = activeControlsByIdRef.current.get(preview.controlId);
    if (!target) return;
    const fields = preview.fields;
    const deltaX = typeof fields.x === 'number' ? fields.x - target.x : 0;
    const deltaY = typeof fields.y === 'number' ? fields.y - target.y : 0;
    const affectedIds = [preview.controlId, ...(descendantIdsByControlIdRef.current.get(preview.controlId) || [])];

    affectedIds.forEach(controlId => {
      const persisted = activeControlsByIdRef.current.get(controlId);
      const node = nodes.get(controlId);
      if (!persisted || !node) return;

      const isTarget = controlId === preview.controlId;
      if (!previewControlStylesRef.current.has(controlId)) {
        previewControlStylesRef.current.set(controlId, {
          transform: node.style.transform,
          transformOrigin: node.style.transformOrigin,
          width: node.style.width,
          height: node.style.height,
          willChange: node.style.willChange
        });
        node.style.willChange = 'transform';
      }
      const hasResizePreview = isTarget
        && (typeof fields.width === 'number' || typeof fields.height === 'number');
      const scaleX = hasResizePreview && typeof fields.width === 'number'
        ? Math.max(0.01, fields.width / Math.max(1, target.width))
        : 1;
      const scaleY = hasResizePreview && typeof fields.height === 'number'
        ? Math.max(0.01, fields.height / Math.max(1, target.height))
        : 1;
      const hasTranslation = deltaX !== 0 || deltaY !== 0;
      node.style.transform = hasTranslation || scaleX !== 1 || scaleY !== 1
        ? `translate3d(${deltaX}px, ${deltaY}px, 0) scale3d(${scaleX}, ${scaleY}, 1)`
        : '';
      if (hasResizePreview) node.style.transformOrigin = 'top left';
      node.dataset.designerInteractionPreview = 'true';
      previewAffectedControlIdsRef.current.add(controlId);
    });
  }, []);

  const applyWindowInteractionPreviewToDom = useCallback((preview: DesignerWindowInteractionPreview) => {
    const windowModel = activeWindowRef.current;
    const frame = canvasFrameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas || preview.windowId !== windowModel.id) return;
    if (!previewWindowStylesRef.current) {
      const resizeHandleVisibility = Array.from(
        canvas.querySelectorAll<HTMLElement>('[data-designer-window-resize-handle]')
      ).map(node => ({ node, visibility: node.style.visibility }));
      previewWindowStylesRef.current = {
        frameWidth: frame.style.width,
        frameHeight: frame.style.height,
        frameOverflow: frame.style.overflow,
        frameWillChange: frame.style.willChange,
        canvasWillChange: canvas.style.willChange,
        resizeHandleVisibility,
        overlayDisplay: canvasResizePreviewRef.current?.style.display || '',
        overlayWidth: canvasResizePreviewRef.current?.style.width || '',
        overlayHeight: canvasResizePreviewRef.current?.style.height || ''
      };
      frame.style.overflow = 'hidden';
      frame.style.willChange = 'width, height';
      canvas.style.willChange = 'transform';
      resizeHandleVisibility.forEach(({ node }) => { node.style.visibility = 'hidden'; });
    }
    const previewWidth = preview.width * canvasScaleRef.current;
    const previewHeight = preview.height * canvasScaleRef.current;
    frame.style.width = `${previewWidth}px`;
    frame.style.height = `${previewHeight}px`;
    const overlay = canvasResizePreviewRef.current;
    if (overlay) {
      overlay.style.display = 'block';
      overlay.style.width = `${previewWidth}px`;
      overlay.style.height = `${previewHeight}px`;
    }
  }, []);

  const applyResourceInteractionPreviewToDom = useCallback((preview: DesignerResourceInteractionPreview) => {
    const resourceNode = designerResourceNodesRef.current.get(preview.resourceId);
    if (!resourceNode) return;
    if (!previewResourceStylesRef.current.has(preview.resourceId)) {
      previewResourceStylesRef.current.set(preview.resourceId, {
        left: resourceNode.style.left,
        top: resourceNode.style.top,
        transform: resourceNode.style.transform,
        willChange: resourceNode.style.willChange
      });
      resourceNode.style.willChange = 'transform';
    }
    const original = previewResourceStylesRef.current.get(preview.resourceId);
    if (!original) return;
    const originalX = Number.parseFloat(original.left) || 0;
    const originalY = Number.parseFloat(original.top) || 0;
    const deltaX = preview.x - originalX;
    const deltaY = preview.y + windowContentOffsetRef.current - originalY;
    resourceNode.style.transform = deltaX !== 0 || deltaY !== 0
      ? `translate3d(${deltaX}px, ${deltaY}px, 0)`
      : '';
    resourceNode.dataset.designerInteractionPreview = 'true';
    previewAffectedResourceIdsRef.current.add(preview.resourceId);
  }, []);

  const clearInteractionPreviewDom = useCallback((preservePreviewValues = false) => {
    previewAffectedControlIdsRef.current.forEach(controlId => {
      const node = designerControlNodesRef.current.get(controlId);
      if (!node) return;
      const original = previewControlStylesRef.current.get(controlId);
      if (original) {
        node.style.transform = original.transform;
        node.style.transformOrigin = original.transformOrigin;
        if (!preservePreviewValues) {
          node.style.width = original.width;
          node.style.height = original.height;
        }
        node.style.willChange = original.willChange;
      } else {
        node.style.transform = '';
        node.style.willChange = '';
      }
      node.removeAttribute('data-designer-interaction-preview');
    });
    previewAffectedControlIdsRef.current.clear();
    previewControlStylesRef.current.clear();
    previewAffectedResourceIdsRef.current.forEach(resourceId => {
      const node = designerResourceNodesRef.current.get(resourceId);
      const original = previewResourceStylesRef.current.get(resourceId);
      if (node && original) {
        if (!preservePreviewValues) {
          node.style.left = original.left;
          node.style.top = original.top;
        }
        node.style.transform = original.transform;
        node.style.willChange = original.willChange;
      }
      node?.removeAttribute('data-designer-interaction-preview');
    });
    previewAffectedResourceIdsRef.current.clear();
    previewResourceStylesRef.current.clear();

    const originalWindow = previewWindowStylesRef.current;
    const frame = canvasFrameRef.current;
    const canvas = canvasRef.current;
    if (originalWindow && frame && canvas) {
      if (!preservePreviewValues) {
        frame.style.width = originalWindow.frameWidth;
        frame.style.height = originalWindow.frameHeight;
      }
      frame.style.overflow = originalWindow.frameOverflow;
      frame.style.willChange = originalWindow.frameWillChange;
      canvas.style.willChange = originalWindow.canvasWillChange;
      originalWindow.resizeHandleVisibility.forEach(({ node, visibility }) => {
        node.style.visibility = visibility;
      });
      const overlay = canvasResizePreviewRef.current;
      if (overlay) {
        overlay.style.display = originalWindow.overlayDisplay;
        overlay.style.width = originalWindow.overlayWidth;
        overlay.style.height = originalWindow.overlayHeight;
      }
    }
    previewWindowStylesRef.current = null;
    canvasRef.current?.removeAttribute('data-designer-interaction-preview');
  }, []);

  const commitInteractionPreviewDom = useCallback((
    controlPreview: DesignerControlInteractionPreview | null,
    windowPreview: DesignerWindowInteractionPreview | null,
    resourcePreview: DesignerResourceInteractionPreview | null
  ) => {
    if (controlPreview && controlPreview.windowId === activeWindowRef.current.id) {
      const target = activeControlsByIdRef.current.get(controlPreview.controlId);
      if (target) {
        const fields = controlPreview.fields;
        const deltaX = typeof fields.x === 'number' ? fields.x - target.x : 0;
        const deltaY = typeof fields.y === 'number' ? fields.y - target.y : 0;
        const affectedIds = [controlPreview.controlId, ...(descendantIdsByControlIdRef.current.get(controlPreview.controlId) || [])];
        affectedIds.forEach(controlId => {
          const node = designerControlNodesRef.current.get(controlId);
          const persisted = activeControlsByIdRef.current.get(controlId);
          if (!node || !persisted) return;
          const original = previewControlStylesRef.current.get(controlId);
          node.style.left = `${persisted.x + deltaX}px`;
          node.style.top = `${persisted.y + deltaY + windowContentOffsetRef.current}px`;
          if (controlId === controlPreview.controlId && typeof fields.width === 'number') {
            node.style.width = `${fields.width}px`;
          }
          if (controlId === controlPreview.controlId && typeof fields.height === 'number') {
            node.style.height = `${fields.height}px`;
          }
          node.style.transform = original?.transform || '';
          node.style.transformOrigin = original?.transformOrigin || '';
          node.style.willChange = original?.willChange || '';
          node.removeAttribute('data-designer-interaction-preview');
        });
      }
    }

    if (resourcePreview) {
      const node = designerResourceNodesRef.current.get(resourcePreview.resourceId);
      const original = previewResourceStylesRef.current.get(resourcePreview.resourceId);
      if (node) {
        node.style.left = `${resourcePreview.x}px`;
        node.style.top = `${resourcePreview.y + windowContentOffsetRef.current}px`;
        node.style.transform = original?.transform || '';
        node.style.willChange = original?.willChange || '';
        node.removeAttribute('data-designer-interaction-preview');
      }
    }

    if (windowPreview) {
      const frame = canvasFrameRef.current;
      const canvas = canvasRef.current;
      if (frame && canvas && windowPreview.windowId === activeWindowRef.current.id) {
        frame.style.width = `${windowPreview.width * canvasScaleRef.current}px`;
        frame.style.height = `${windowPreview.height * canvasScaleRef.current}px`;
        canvas.style.width = `${windowPreview.width}px`;
        canvas.style.height = `${windowPreview.height}px`;
        const overlay = canvasResizePreviewRef.current;
        if (overlay) {
          overlay.style.display = 'none';
          overlay.style.width = '';
          overlay.style.height = '';
        }
        previewWindowStylesRef.current?.resizeHandleVisibility.forEach(({ node, visibility }) => {
          node.style.visibility = visibility;
        });
        if (previewWindowStylesRef.current) frame.style.overflow = previewWindowStylesRef.current.frameOverflow;
        frame.style.willChange = previewWindowStylesRef.current?.frameWillChange || '';
        canvas.style.willChange = previewWindowStylesRef.current?.canvasWillChange || '';
      }
    }

    previewAffectedControlIdsRef.current.clear();
    previewControlStylesRef.current.clear();
    previewAffectedResourceIdsRef.current.clear();
    previewResourceStylesRef.current.clear();
    previewWindowStylesRef.current = null;
    canvasRef.current?.removeAttribute('data-designer-interaction-preview');
  }, []);

  // React may still commit unrelated work while the pointer is held down.
  // Reapply the latest preview after such a commit so model-owned inline styles
  // cannot temporarily snap the active interaction back to its old position.
  useLayoutEffect(() => {
    const controlPreview = controlInteractionPreviewRef.current;
    if (controlPreview) applyControlInteractionPreviewToDom(controlPreview);
    const windowPreview = windowInteractionPreviewRef.current;
    if (windowPreview) applyWindowInteractionPreviewToDom(windowPreview);
    const resourcePreview = resourceInteractionPreviewRef.current;
    if (resourcePreview) applyResourceInteractionPreviewToDom(resourcePreview);
  });

  const newEmojiModuleEnabled = isNewEmojiDesignerEnabled(enabledDesignerModules);
  const useNewEmojiDesigner = migrateDesignerBackend(activeWindow.designerBackend, newEmojiModuleEnabled) === 'new-emoji';
  const newEmojiThemePreview = useMemo(
    () => getNewEmojiThemePreview(activeWindow.background),
    [activeWindow.background]
  );
  const newEmojiDesignerControls = useMemo(() => enabledDesignerModuleRecords
    .find(module => module.manifest.id === NEW_EMOJI_MODULE_ID)
    ?.manifest.contributes?.designerControls || [], [enabledDesignerModuleRecords]);
  const ensureDesignerModuleAccess = useCallback(async (force = false) => {
    if (!useNewEmojiDesigner && !force) return;
    const local = await fetch(`/api/module-access/status?moduleId=${encodeURIComponent(NEW_EMOJI_MODULE_ID)}`)
      .then(response => response.json())
      .catch(() => null);
    if (local?.status?.allowed) return;
    const cloudModules = window.lingBuilder?.cloudAccount;
    if (!cloudModules?.authorizeModule) throw new Error('new_emoji 是收费模块，请在 LingBuilder 桌面端注册并登录后使用。');
    const authorization = await cloudModules.authorizeModule(NEW_EMOJI_MODULE_ID);
    if (!authorization?.ok) throw new Error((authorization as { error?: string })?.error || 'new_emoji 模块授权检查失败，请稍后重试。');
    if (!authorization?.status?.allowed) throw new Error(authorization?.status?.reason || '当前账号没有 new_emoji 的有效权益。');
  }, [useNewEmojiDesigner]);
  const controlToolboxGroups = useMemo(
    () => createControlToolboxGroups(CREATABLE_DESIGNER_CONTROL_TYPES, useNewEmojiDesigner),
    [useNewEmojiDesigner]
  );
  const normalizedControlToolboxSearch = controlToolboxSearch.trim().toLocaleLowerCase('zh-CN');
  const visibleControlToolboxGroups = useMemo(() => controlToolboxGroups.map(group => ({
    ...group,
    controlTypes: group.controlTypes.filter(type => {
      if (!normalizedControlToolboxSearch) return true;
      const definition = getWin32ControlDefinition(type);
      return [
        CONTROL_LABELS[type],
        type,
        group.label,
        definition?.category,
        definition?.moduleId
      ].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN').includes(normalizedControlToolboxSearch);
    })
  })).filter(group => !normalizedControlToolboxSearch || group.controlTypes.length > 0 || (group.id === 'new-emoji' && newEmojiDesignerControls.some(control => [control.label, control.type, control.category].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN').includes(normalizedControlToolboxSearch)))), [
    controlToolboxGroups,
    normalizedControlToolboxSearch,
    newEmojiDesignerControls
  ]);

  useEffect(() => {
    if (controlToolboxProjectIdRef.current === project.id) return;
    controlToolboxProjectIdRef.current = project.id;
    skipNextControlToolboxSaveRef.current = true;
    setExpandedControlToolboxGroups(readControlToolboxExpansionState(project.id));
  }, [project.id]);

  useEffect(() => {
    if (skipNextControlToolboxSaveRef.current) {
      skipNextControlToolboxSaveRef.current = false;
      return;
    }
    saveControlToolboxExpansionState(project.id, expandedControlToolboxGroups);
  }, [expandedControlToolboxGroups, project.id]);

  const toggleControlToolboxGroup = (groupId: ControlToolboxGroupId) => {
    setExpandedControlToolboxGroups(previous => ({
      ...previous,
      [groupId]: !previous[groupId]
    }));
  };

  const refreshDesignerModules = useCallback(async (projectId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/modules/project/designer?projectId=${encodeURIComponent(projectId)}`, {
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('模块服务不可用');
      const result = await response.json();
      if (projectIdRef.current !== projectId) return true;
      const ids = (Array.isArray(result.modules) ? result.modules : [])
        .map((module: any) => module?.manifest?.id)
        .filter((id: unknown): id is string => typeof id === 'string');
      setEnabledDesignerModules(new Set(['lingbuilder.win32.basic', ...ids]));
      setEnabledDesignerModuleRecords(Array.isArray(result.modules) ? result.modules : []);
      return true;
    } catch {
      if (projectIdRef.current === projectId) {
        setEnabledDesignerModules(new Set(['lingbuilder.win32.basic']));
        setEnabledDesignerModuleRecords([]);
      }
      return false;
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let retryTimer: number | undefined;
    let retryAttempt = 0;

    const refreshWithRetry = async () => {
      const loaded = await refreshDesignerModules(project.id);
      if (disposed || loaded || retryAttempt >= 4) return;
      const delay = Math.min(2_000, 250 * (2 ** retryAttempt));
      retryAttempt += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void refreshWithRetry();
      }, delay);
    };

    void refreshWithRetry();

    const handleModulesChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string; scope?: string }>).detail;
      if (detail?.scope === 'project' && detail.projectId && detail.projectId !== project.id) return;
      retryAttempt = 0;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      retryTimer = undefined;
      void refreshWithRetry();
    };

    window.addEventListener('lingbuilder-modules-changed', handleModulesChanged);
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      window.removeEventListener('lingbuilder-modules-changed', handleModulesChanged);
    };
  }, [project.id, refreshDesignerModules]);

  useEffect(() => {
    const registrations: Array<{ dispose(): void }> = [];
    const reportContribution = (message: string) => window.dispatchEvent(new CustomEvent('add-app-log', { detail: { message } }));
    for (const installed of enabledDesignerModuleRecords) {
      const moduleId = installed.manifest.id;
      for (const control of installed.manifest.contributes?.designerControls || []) {
        if (!control.isContainer) continue;
        if (!control.layout) reportContribution(`> 【布局贡献】${moduleId}/${control.type} 未声明 layout，当前按窗口绝对坐标兼容；请在下一个模块版本补齐。`);
        const descriptor = control.layout || {
          mode: 'absolute' as const,
          coordinateSpace: 'window' as const,
          adapterId: `module.${moduleId}.${control.type}.legacy-absolute`
        };
        try {
          registrations.push(layoutRegistryRef.current.registerContainer(
            control.namespacedType || `${moduleId}/${control.type}`,
            descriptor
          ));
        } catch (error) {
          reportContribution(`> 【布局贡献】${moduleId}：${error instanceof Error ? error.message : String(error)}`);
        }
      }
      for (const submenu of installed.manifest.contributes?.submenus || []) {
        try {
          registrations.push(designerMenuService.registerSubmenu({ ...submenu, source: 'module', sourceId: moduleId }));
        } catch (error) {
          reportContribution(`> 【菜单贡献】${moduleId}：${error instanceof Error ? error.message : String(error)}`);
        }
      }
      for (const menu of installed.manifest.contributes?.menus || []) {
        try {
          registrations.push(designerMenuService.registerMenuItem({ ...menu, source: 'module', sourceId: moduleId }));
        } catch (error) {
          reportContribution(`> 【菜单贡献】${moduleId}：${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    return () => [...registrations].reverse().forEach(registration => registration.dispose());
  }, [designerMenuService, enabledDesignerModuleRecords]);

  useEffect(() => {
    let disposed = false;
    let registrations: Array<{ dispose(): void }> = [];
    const disposeRegistrations = () => {
      [...registrations].reverse().forEach(registration => registration.dispose());
      registrations = [];
    };
    const refresh = async () => {
      try {
        const response = await fetch('/api/extensions');
        const payload = await response.json() as { ok?: boolean; host?: ExtensionHostSnapshot; error?: string };
        if (!response.ok || !payload.ok || !payload.host) throw new Error(payload.error || '扩展宿主不可用。');
        if (disposed) return;
        disposeRegistrations();
        for (const extension of payload.host.extensions.filter(item => item.enabled)) {
          const extensionId = extension.id;
          const permissions = new Set(extension.manifest.permissions || []);
          const designerMenus = extension.manifest.contributes?.menus || [];
          const contributedCommandIds = new Set(designerMenus.map(menu => menu.command).filter((id): id is string => Boolean(id)));
          if (designerMenus.some(menu => menu.menu.startsWith('designer/')) && !permissions.has('designer.read')) {
            window.dispatchEvent(new CustomEvent('add-app-log', { detail: { message: `> 【扩展菜单】${extensionId} 未声明 designer.read，已忽略设计器菜单。` } }));
            continue;
          }
          for (const command of extension.manifest.contributes?.commands || []) {
            if (!contributedCommandIds.has(command.command) || designerCommandService.hasCommand(command.command)) continue;
            registrations.push(designerCommandService.registerCommand({
              id: command.command,
              title: command.title,
              category: command.category || '扩展·设计器',
              when: 'designer.active',
              handler: async (_context, ...args) => {
                const currentProject = currentProjectRef.current;
                const windowId = activeWindowIdRef.current;
                const currentWindow = currentProject.windows.find(item => item.id === windowId) || currentProject.windows[0];
                const selected = new Set(selectedControlIdsRef.current);
                const invocation: DesignerCommandInvocation = {
                  projectId: currentProject.id,
                  windowId: currentWindow.id,
                  revision: getDesignerModelRevision(currentProject),
                  targetKind: designerContextRef.current['designer.targetKind'],
                  selectedControls: currentWindow.controls.filter(control => selected.has(control.id)).map(control => ({
                    id: control.id, name: control.name, type: control.type, designerType: control.designerType,
                    parentId: control.parentId, containerSlot: control.containerSlot,
                    x: control.x, y: control.y, width: control.width, height: control.height,
                    designerLocked: control.designerLocked
                  }))
                };
                const resultResponse = await fetch(`/api/extensions/commands/${encodeURIComponent(command.command)}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ args: [invocation, ...args] })
                });
                const resultPayload = await resultResponse.json();
                if (!resultResponse.ok || !resultPayload.ok) throw new Error(resultPayload.error || '扩展命令执行失败。');
                if (isDesignerEditEnvelope(resultPayload.result)) {
                  if (!permissions.has('designer.write')) throw new Error(`扩展 ${extensionId} 未声明 designer.write，不能修改设计器。`);
                  const latestProject = currentProjectRef.current;
                  const enabledIds = new Set(['lingbuilder.win32.basic', ...enabledDesignerModuleRecords.map(item => item.manifest.id)]);
                  const nextProject = applyDesignerEditEnvelope(
                    latestProject,
                    activeWindowIdRef.current,
                    resultPayload.result,
                    layoutRegistryRef.current,
                    control => {
                      if (control.designerType) return enabledDesignerModuleRecords.some(item => item.manifest.contributes?.designerControls?.some(contribution => (contribution.namespacedType || `${item.manifest.id}/${contribution.type}`) === control.designerType));
                      const definition = getWin32ControlDefinition(control.type);
                      return Boolean(definition && enabledIds.has(definition.moduleId));
                    }
                  );
                  setProject(nextProject);
                }
                return resultPayload.result;
              }
            }));
          }
          for (const submenu of extension.manifest.contributes?.submenus || []) {
            registrations.push(designerMenuService.registerSubmenu({ ...submenu, source: 'extension', sourceId: extensionId }));
          }
          for (const menu of designerMenus) {
            registrations.push(designerMenuService.registerMenuItem({ ...menu, source: 'extension', sourceId: extensionId }));
          }
        }
      } catch (error) {
        if (!disposed) window.dispatchEvent(new CustomEvent('add-app-log', { detail: { message: `> 【扩展菜单】${error instanceof Error ? error.message : String(error)}` } }));
      }
    };
    void refresh();
    const handleChanged = () => { void refresh(); };
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener('lingbuilder-extensions-changed', handleChanged);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('lingbuilder-extensions-changed', handleChanged);
      disposeRegistrations();
    };
  }, [designerCommandService, designerMenuService, enabledDesignerModuleRecords]);

  const canvasScale = zoomMode === 'fit' ? fitScale : manualZoom;
  const canvasScaleRef = useRef(canvasScale);
  canvasScaleRef.current = canvasScale;

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport || !activeWindow) return;
    let lastViewportBox: { width: number; height: number } | null = null;

    const updateFitScale = (measurement?: { width: number; height: number }) => {
      // ResizeObserver contentRect is fractional and excludes padding/scrollbars. Add the
      // viewport padding back so the helper receives the same border-box dimensions used
      // by the initial synchronous measurement.
      const viewportWidth = measurement?.width ?? viewport.clientWidth;
      const viewportHeight = measurement?.height ?? viewport.clientHeight;
      const nextScale = calculateDesignerFitScale(
        viewportWidth,
        viewportHeight,
        activeWindow.width,
        activeWindow.height
      );
      setFitScale(previous => Math.abs(previous - nextScale) < 0.005 ? previous : nextScale);
    };

    const updateFitScaleForViewport = () => {
      // A scrollbar changes the content box but not the viewport's outer box.
      // Ignore that observer pass so fit zoom cannot oscillate at the edge.
      const rect = viewport.getBoundingClientRect();
      const nextBox = { width: rect.width, height: rect.height };
      if (lastViewportBox
        && Math.abs(lastViewportBox.width - nextBox.width) < 0.5
        && Math.abs(lastViewportBox.height - nextBox.height) < 0.5) {
        return;
      }
      lastViewportBox = nextBox;
      updateFitScale();
    };

    updateFitScaleForViewport();
    const observer = new ResizeObserver(entries => {
      const contentRect = entries[0]?.contentRect;
      if (!contentRect) {
        updateFitScaleForViewport();
        return;
      }
      const rect = viewport.getBoundingClientRect();
      const nextBox = { width: rect.width, height: rect.height };
      if (lastViewportBox
        && Math.abs(lastViewportBox.width - nextBox.width) < 0.5
        && Math.abs(lastViewportBox.height - nextBox.height) < 0.5) {
        return;
      }
      lastViewportBox = nextBox;
      updateFitScale({
        width: contentRect.width + DESIGNER_CANVAS_HORIZONTAL_INSET,
        height: contentRect.height + DESIGNER_CANVAS_PADDING
      });
    });
    const handleWindowResize = () => updateFitScaleForViewport();
    observer.observe(viewport);
    window.addEventListener('resize', handleWindowResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [activeWindow?.height, activeWindow?.width]);

  const setCanvasZoom = (nextZoom: number) => {
    setZoomMode('manual');
    setManualZoom(Math.max(0.25, Math.min(1.5, nextZoom)));
  };

  const isWindowMenuInteractionActive = Boolean(
    isMenuDropdownOpen
    || selectedControlId === '__window_menu_bar__'
    || selectedControlId?.startsWith('__window_menu_item_')
  );

  const selectedControl = useMemo<LingControl | undefined>(() => {
    if (selectedControlId === '__window_menu_bar__') {
      return {
        id: '__window_menu_bar__',
        type: 'MenuBar' as any,
        name: activeWindow.menuName || '窗口菜单栏',
        x: 0,
        y: 0,
        width: activeWindow.width,
        height: 24,
        content: activeWindow.menuItems || '关于太空冒险客户端, 太空冒险安全账户登录, 关联设计文件',
        fontSize: activeWindow.menuFontSize ?? 11,
        fontFamily: activeWindow.menuFontFamily || DEFAULT_CONTROL_FONT_FAMILY,
        fontBold: activeWindow.menuFontBold === true,
        fontItalic: activeWindow.menuFontItalic === true,
        fontUnderline: activeWindow.menuFontUnderline === true,
        background: activeWindow.menuBackground || '#ffffff',
        foreground: activeWindow.menuForeground || '#000000',
        isEnabled: true,
        visibility: 'Visible',
        events: activeWindow.menuEvents || {
          'Select': activeWindow.menuEvents?.['Select'] || `_${activeWindow.className}_窗口菜单被选择`
        }
      };
    }
    
    if (selectedControlId && selectedControlId.startsWith('__window_menu_item_')) {
      const idxStr = selectedControlId.replace('__window_menu_item_', '').replace('__', '');
      const idx = parseInt(idxStr, 10);
      const items = (activeWindow.menuItems || '关于太空冒险客户端, 太空冒险安全账户登录, 关联设计文件')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const itemName = items[idx] || `菜单项_${idx}`;
      
      return {
        id: selectedControlId,
        type: 'MenuItem' as any,
        name: itemName,
        x: 0,
        y: 0,
        width: 120,
        height: 20,
        content: itemName,
        fontSize: 11,
        background: '#ffffff',
        foreground: '#000000',
        isEnabled: true,
        visibility: 'Visible',
        events: {
          'Select': activeWindow.menuEvents?.[`Item_${idx}`] || `_${activeWindow.className}_${itemName}_被选择`
        }
      };
    }

    return activeWindow?.controls.find(control => control.id === selectedControlId) || null;
  }, [activeWindow, selectedControlId]);
  const selectedModuleControl = useMemo(() => selectedControl?.designerType
    ? newEmojiDesignerControls.find(control => (control.namespacedType || `${NEW_EMOJI_MODULE_ID}/${control.type}`) === selectedControl.designerType)
    : undefined, [newEmojiDesignerControls, selectedControl]);

  const addLog = useCallback((message: string) => {
    window.dispatchEvent(new CustomEvent('add-app-log', { detail: { message } }));
  }, []);

  const previewSelectedEdgeControl = useCallback(async () => {
    const currentProject = currentProjectRef.current;
    const windowId = activeWindowIdRef.current;
    const currentWindow = currentProject.windows.find(item => item.id === windowId) || currentProject.windows[0];
    const selectedId = selectedControlIdsRef.current.at(-1);
    const control = currentWindow?.controls.find(item => item.id === selectedId);
    if (!currentWindow || !control || control.type !== 'EdgeBrowser') throw new Error('请先选择一个 Edge 浏览器控件。');
    setEdgeControlPreview({ status: 'preparing', message: '正在准备独立原生预览…' });
    const response = await fetch('/api/window-designer/edge-control-preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: currentProject, windowId: currentWindow.id, controlId: control.id })
    });
    const payload = await response.json() as { ok?: boolean; error?: string; message?: string; pid?: number; logs?: string[] };
    (payload.logs || []).forEach(addLog);
    if (!response.ok || !payload.ok) {
      const message = payload.error || 'Edge 控件预览失败。';
      setEdgeControlPreview({ status: 'failed', message });
      throw new Error(message);
    }
    setEdgeControlPreview({ status: 'running', message: payload.message || '独立 Edge 控件预览正在运行。', pid: payload.pid });
  }, [addLog]);

  const stopEdgeControlPreview = useCallback(async () => {
    setEdgeControlPreview(previous => ({ ...previous, status: 'stopping', message: '正在停止预览…' }));
    const response = await fetch('/api/window-designer/edge-control-preview/stop', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId })
    });
    const payload = await response.json() as { ok?: boolean; error?: string; message?: string };
    setEdgeControlPreview(response.ok && payload.ok ? { status: 'idle', message: payload.message || '预览已停止。' } : { status: 'failed', message: payload.error || '停止预览失败。' });
  }, [projectId]);

  useEffect(() => () => { void fetch('/api/window-designer/edge-control-preview/stop', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId })
  }); }, [projectId]);

  useEffect(() => {
    if (project.id !== projectId) return;
    if (suppressNextProjectPublishRef.current) {
      suppressNextProjectPublishRef.current = false;
      return;
    }
    publishingDesignerStateRef.current = true;
    try {
      saveWindowDesignerState({
        project,
        activeWindowId,
        selectedControlId: selectedControlIdRef.current
      });
    } finally {
      publishingDesignerStateRef.current = false;
    }
  }, [activeWindowId, project, projectId]);

  useEffect(() => {
    if (project.id !== projectId || !activeWindowId) return;
    if (selectionPersistenceTimerRef.current !== null) {
      window.clearTimeout(selectionPersistenceTimerRef.current);
    }
    selectionPersistenceTimerRef.current = window.setTimeout(() => {
      selectionPersistenceTimerRef.current = null;
      saveWindowDesignerSelection(projectId, activeWindowIdRef.current, selectedControlIdRef.current);
    }, 120);
    return () => {
      if (selectionPersistenceTimerRef.current !== null) {
        window.clearTimeout(selectionPersistenceTimerRef.current);
        selectionPersistenceTimerRef.current = null;
      }
    };
  }, [activeWindowId, project.id, projectId, selectedControlId]);

  useEffect(() => {
    const previousProject = observedProjectRef.current;
    observedProjectRef.current = project;
    if (previousProject === project) return;
    if (suppressNextDirtySignalRef.current) {
      suppressNextDirtySignalRef.current = false;
      return;
    }
    if (project.id !== projectId) return;

    const state: PersistedWindowDesignerState = {
      project,
      activeWindowId,
      selectedControlId
    };
    const detail: WindowDesignerDirtyStateDetail = {
      projectId: project.id,
      isDirty: true,
      state,
      source: 'designer'
    };
    onProjectChange?.(state);
    onDirtyChange?.(detail);
    notifyWindowDesignerDirtyStateChanged(detail);
  }, [activeWindowId, onDirtyChange, onProjectChange, project, projectId]);

  const updateActiveWindow = (updater: (window: LingWindowModel) => LingWindowModel) => {
    setProject(prev => {
      let changed = false;
      const windows = prev.windows.map(window => {
        if (window.id !== activeWindowId) return window;
        const nextWindow = updater(window);
        if (nextWindow !== window) changed = true;
        return nextWindow;
      });
      return changed ? { ...prev, windows } : prev;
    });
  };

  const startResizeInspector = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    const startX = mouseDownEvent.clientX;
    const startWidth = inspectorWidth;

    const doDrag = (mouseMoveEvent: MouseEvent) => {
      const deltaX = mouseMoveEvent.clientX - startX;
      setInspectorWidth(Math.max(240, Math.min(600, startWidth - deltaX)));
    };

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  const startResizeWindow = (mouseDownEvent: React.MouseEvent, direction: 'r' | 'b' | 'se') => {
    mouseDownEvent.preventDefault();
    mouseDownEvent.stopPropagation();
    if (
      isDragging
      || isResizing
      || draggingResourceId
      || controlInteractionPreviewRef.current
      || windowInteractionPreviewRef.current
      || resourceInteractionPreviewRef.current
    ) {
      finishPointerInteraction();
    }
    const startX = mouseDownEvent.clientX;
    const startY = mouseDownEvent.clientY;
    const startWidth = activeWindow.width;
    const startHeight = activeWindow.height;
    windowResizeActiveRef.current = true;

    const doDrag = (mouseMoveEvent: MouseEvent) => {
      const deltaX = (mouseMoveEvent.clientX - startX) / canvasScale;
      const deltaY = (mouseMoveEvent.clientY - startY) / canvasScale;

      let nextWidth = startWidth;
      let nextHeight = startHeight;

      if (direction === 'r' || direction === 'se') {
        nextWidth = Math.max(300, Math.min(1920, startWidth + deltaX));
      }
      if (direction === 'b' || direction === 'se') {
        nextHeight = Math.max(200, Math.min(1080, startHeight + deltaY));
      }

      windowInteractionPreviewRef.current = { windowId: activeWindow.id, width: nextWidth, height: nextHeight };
      pendingWindowInteractionPreviewRef.current = windowInteractionPreviewRef.current;
      if (interactionPreviewFrameRef.current === null) {
        interactionPreviewFrameRef.current = window.requestAnimationFrame(() => {
          interactionPreviewFrameRef.current = null;
          const pending = pendingWindowInteractionPreviewRef.current;
          pendingWindowInteractionPreviewRef.current = null;
          if (pending) applyWindowInteractionPreviewToDom(pending);
        });
      }
    };

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      finishPointerInteraction();
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  const updateSelectedControl = (updatedFields: Partial<LingControl>) => {
    if (!selectedControlId) return;
    if (selectedControlId === '__window_menu_bar__') {
      updateActiveWindow(window => ({
        ...window,
        menuName: updatedFields.name !== undefined ? updatedFields.name : window.menuName,
        menuItems: updatedFields.content !== undefined ? updatedFields.content : window.menuItems,
        menuBackground: updatedFields.background !== undefined ? updatedFields.background : window.menuBackground,
        menuForeground: updatedFields.foreground !== undefined ? updatedFields.foreground : window.menuForeground,
        menuFontFamily: updatedFields.fontFamily !== undefined ? updatedFields.fontFamily : window.menuFontFamily,
        menuFontSize: updatedFields.fontSize !== undefined ? updatedFields.fontSize : window.menuFontSize,
        menuFontBold: updatedFields.fontBold !== undefined ? updatedFields.fontBold : window.menuFontBold,
        menuFontItalic: updatedFields.fontItalic !== undefined ? updatedFields.fontItalic : window.menuFontItalic,
        menuFontUnderline: updatedFields.fontUnderline !== undefined ? updatedFields.fontUnderline : window.menuFontUnderline,
        menuEvents: updatedFields.events !== undefined ? { ...(window.menuEvents || {}), ...updatedFields.events } : window.menuEvents
      }));
      return;
    }
    if (selectedControlId.startsWith('__window_menu_item_')) {
      const idxStr = selectedControlId.replace('__window_menu_item_', '').replace('__', '');
      const idx = parseInt(idxStr, 10);
      const items = (activeWindow.menuItems || '关于太空冒险客户端, 太空冒险安全账户登录, 关联设计文件')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
        
      if (updatedFields.content !== undefined) {
        items[idx] = updatedFields.content;
      } else if (updatedFields.name !== undefined) {
        items[idx] = updatedFields.name;
      }
      
      const newMenuItems = items.join(', ');
      const newMenuEvents = { ...(activeWindow.menuEvents || {}) };
      if (updatedFields.events !== undefined) {
        Object.assign(newMenuEvents, updatedFields.events);
      }
      
      updateActiveWindow(window => ({
        ...window,
        menuItems: newMenuItems,
        menuEvents: newMenuEvents
      }));
      return;
    }
    const persistedControl = activeWindow.controls.find(control => control.id === selectedControlId);
    if (persistedControl?.designerLocked) {
      const { x: _x, y: _y, width: _width, height: _height, parentId: _parentId, containerSlot: _containerSlot, designerLayout: _designerLayout, ...editableFields } = updatedFields;
      updatedFields = editableFields;
    }
    updateActiveWindow(window => ({
      ...window,
      controls: reconcileRebarBands(updateControlWithDescendants(window.controls, selectedControlId, updatedFields))
    }));
  };

  const commitControlFieldsImmediately = (controlId: string, updatedFields: Partial<LingControl>) => {
    const targetWindowId = activeWindowIdRef.current;
    const currentProject = currentProjectRef.current;
    const nextWindows = currentProject.windows.map(window => window.id === targetWindowId
      ? {
          ...window,
          controls: reconcileRebarBands(updateControlWithDescendants(window.controls, controlId, updatedFields))
        }
      : window);
    const nextProject = { ...currentProject, windows: nextWindows };
    const nextState: PersistedWindowDesignerState = {
      project: nextProject,
      activeWindowId: targetWindowId,
      selectedControlId: controlId
    };

    currentProjectRef.current = nextProject;
    suppressNextProjectPublishRef.current = true;
    setProject(nextProject);
    publishingDesignerStateRef.current = true;
    try {
      saveWindowDesignerState(nextState);
    } finally {
      publishingDesignerStateRef.current = false;
    }
  };

  const scheduleControlInteractionPreview = useCallback((preview: DesignerControlInteractionPreview) => {
    controlInteractionPreviewRef.current = preview;
    pendingControlInteractionPreviewRef.current = preview;
    if (controlInteractionFrameRef.current !== null) return;
    controlInteractionFrameRef.current = window.requestAnimationFrame(() => {
      controlInteractionFrameRef.current = null;
      const pending = pendingControlInteractionPreviewRef.current;
      pendingControlInteractionPreviewRef.current = null;
      if (pending) applyControlInteractionPreviewToDom(pending);
    });
  }, [applyControlInteractionPreviewToDom]);

  const finishPointerInteraction = useCallback(() => {
    const preview = controlInteractionPreviewRef.current;
    controlInteractionPreviewRef.current = null;
    pendingControlInteractionPreviewRef.current = null;
    if (controlInteractionFrameRef.current !== null) {
      window.cancelAnimationFrame(controlInteractionFrameRef.current);
      controlInteractionFrameRef.current = null;
    }
    if (interactionPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(interactionPreviewFrameRef.current);
      interactionPreviewFrameRef.current = null;
    }
    setIsDragging(false);
    setIsResizing(false);
    windowResizeActiveRef.current = false;
    setDraggingResourceId(null);
    setResizeDirection('se');

    const windowPreview = windowInteractionPreviewRef.current;
    const resourcePreview = resourceInteractionPreviewRef.current;
    windowInteractionPreviewRef.current = null;
    pendingWindowInteractionPreviewRef.current = null;
    resourceInteractionPreviewRef.current = null;
    pendingResourceInteractionPreviewRef.current = null;
    if (!preview && !windowPreview && !resourcePreview) return;
    // Transfer the preview into final DOM coordinates before React takes over.
    // This avoids both a release-time snap-back and a stale transform lingering
    // after React has committed the new model.
    commitInteractionPreviewDom(preview, windowPreview, resourcePreview);
    setProject(previous => ({
      ...previous,
      windows: preview || windowPreview
        ? previous.windows.map(window => {
            if (preview && window.id === preview.windowId) {
              return { ...window, controls: reconcileRebarBands(updateControlWithDescendants(window.controls, preview.controlId, preview.fields)) };
            }
            if (windowPreview && window.id === windowPreview.windowId) {
              return { ...window, width: windowPreview.width, height: windowPreview.height };
            }
            return window;
          })
        : previous.windows,
      resources: resourcePreview
        ? (previous.resources || []).map(resource => resource.id === resourcePreview.resourceId
          ? { ...resource, designerX: resourcePreview.x, designerY: resourcePreview.y }
          : resource)
        : previous.resources
    }));
  }, [clearInteractionPreviewDom, commitInteractionPreviewDom]);

  useEffect(() => () => {
    if (controlInteractionFrameRef.current !== null) {
      window.cancelAnimationFrame(controlInteractionFrameRef.current);
      controlInteractionFrameRef.current = null;
    }
    if (interactionPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(interactionPreviewFrameRef.current);
      interactionPreviewFrameRef.current = null;
    }
    clearInteractionPreviewDom();
  }, [clearInteractionPreviewDom]);

  const handleSelectWindow = (windowId: string) => {
    const nextWindow = project.windows.find(window => window.id === windowId);
    if (!nextWindow) return;
    setActiveWindowId(windowId);
    selectOnlyControl(nextWindow.controls[0]?.id || null);
  };

  const updateTabControlPages = (controlId: string, pages: TabControlPage[], mutation?: TabControlPageMutation) => {
    updateActiveWindow(window => {
      const tabControl = window.controls.find(control => control.id === controlId && isTabContainerControl(control));
      if (!tabControl) return window;
      const selectedPageId = getSelectedTabPage(tabControl)?.id;
      const remappedSelectedPageId = mutation?.type === 'rename' && selectedPageId === mutation.previousId
        ? mutation.nextId
        : mutation?.type === 'remove' && selectedPageId === mutation.removedId
          ? mutation.fallbackId
          : selectedPageId;
      const selectedIndex = Math.max(0, pages.findIndex(page => page.id === remappedSelectedPageId));
      const legacyFallbackPageId = getTabControlPages(tabControl)[0]?.id;
      const controls = window.controls.map(control => {
        if (control.id === controlId) {
          return {
            ...control,
            properties: {
              ...(control.properties || {}),
              tabs: pages.map(page => ({ ...page })),
              items: pages.map(page => ({ ...page })),
              selectedIndex,
              activeIndex: selectedIndex,
              ...(isNewEmojiTabsControl(control) ? { contentVisible: true } : {})
            }
          };
        }
        if (control.parentId !== controlId) return control;
        const currentSlot = control.containerSlot || legacyFallbackPageId;
        const nextSlot = mutation?.type === 'rename' && currentSlot === mutation.previousId
          ? mutation.nextId
          : mutation?.type === 'remove' && currentSlot === mutation.removedId
            ? mutation.fallbackId
            : currentSlot;
        return nextSlot && nextSlot !== control.containerSlot ? { ...control, containerSlot: nextSlot } : control;
      });
      return { ...window, controls };
    });
  };

  const handleReparentControls = (controlIds: string[], parentId?: string, containerSlot?: string) => {
    const uniqueControlIds = [...new Set(controlIds)].filter(id => activeWindow.controls.some(control => control.id === id));
    const selectedSet = new Set(uniqueControlIds);
    const topLevelIds = uniqueControlIds.filter(controlId => !uniqueControlIds.some(otherId => (
      otherId !== controlId && selectedSet.has(otherId) && getControlDescendantIds(activeWindow.controls, otherId).has(controlId)
    )));
    const positionedIds = new Set(topLevelIds.flatMap(controlId => [
      controlId,
      ...getControlDescendantIds(activeWindow.controls, controlId)
    ]));
    const sources = activeWindow.controls.filter(control => topLevelIds.includes(control.id));
    const target = parentId ? activeWindow.controls.find(control => control.id === parentId) : undefined;
    if (!sources.length || (parentId && (!target || !getWin32ControlDefinition(target.type)?.isContainer))) return;
    if (sources.some(control => control.designerLocked)) {
      addLog('> 【布局】已锁定控件不能更换父容器。');
      return;
    }
    if (!canReparentControls(activeWindow.controls, uniqueControlIds, parentId, containerSlot)) return;

    updateActiveWindow(window => {
      const controls = reconcileRebarBands(reparentControls(window.controls, uniqueControlIds, parentId, containerSlot));
      if (controls === window.controls) return window;
      if (!target) return { ...window, controls };
      const inset = 12;
      const tabOffset = isTabContainerControl(target) ? getTabContainerContentOffset(target) : { x: 0, y: 0 };
      const topInset = tabOffset.y || inset;
      const sourceLeft = Math.min(...sources.map(control => control.x));
      const sourceTop = Math.min(...sources.map(control => control.y));
      const sourceRight = Math.max(...sources.map(control => control.x + control.width));
      const sourceBottom = Math.max(...sources.map(control => control.y + control.height));
      const availableLeft = target.x + tabOffset.x + inset;
      const availableTop = target.y + topInset;
      const availableRight = Math.max(availableLeft, target.x + target.width - inset);
      const availableBottom = Math.max(availableTop, target.y + target.height - inset);
      const shiftX = Math.max(availableLeft - sourceLeft, Math.min(0, availableRight - sourceRight));
      const shiftY = Math.max(availableTop - sourceTop, Math.min(0, availableBottom - sourceBottom));
      return {
        ...window,
        controls: controls.map(control => positionedIds.has(control.id) ? {
          ...control,
          x: control.x + shiftX,
          y: control.y + shiftY
        } : control)
      };
    });
    setSelectedControlIds(uniqueControlIds);
    setSelectedControlId(uniqueControlIds.at(-1) || null);
    const page = target && isTabContainerControl(target)
      ? getTabControlPages(target).find(item => item.id === containerSlot)
      : undefined;
    const sourceLabel = uniqueControlIds.length > 1 ? `${uniqueControlIds.length} 个控件` : sources[0].name;
    addLog(`> [${new Date().toLocaleTimeString()}] 【可视化设计】已将 ${sourceLabel} 移到${page ? `${target?.name} / ${page.title}` : target ? `容器 ${target.name}` : '窗口根级'}。`);
  };

  const handleSelectTabPage = (tabControlId: string, pageId: string) => {
    const tabControl = activeWindow.controls.find(control => control.id === tabControlId && isTabContainerControl(control));
    if (!tabControl) return;
    const pageIndex = getTabControlPages(tabControl).findIndex(page => page.id === pageId);
    if (pageIndex < 0) return;
    updateActiveWindow(window => ({
      ...window,
      controls: window.controls.map(control => control.id === tabControlId
        ? { ...control, properties: { ...(control.properties || {}), selectedIndex: pageIndex, activeIndex: pageIndex } }
        : control)
    }));
    selectOnlyControl(tabControlId);
  };

  const handleReorderRebarBand = (rebarId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    updateActiveWindow(window => ({
      ...window,
      controls: window.controls.map(control => {
        if (control.id !== rebarId) return control;
        const bands: Array<Record<string, unknown>> = Array.isArray(control.properties?.bands)
          ? control.properties.bands.filter((band): band is Record<string, unknown> => Boolean(band) && typeof band === 'object').map(band => ({ ...band }))
          : [];
        if (fromIndex >= bands.length || toIndex >= bands.length) return control;
        const [moved] = bands.splice(fromIndex, 1);
        bands.splice(toIndex, 0, moved);
        return { ...control, properties: { ...(control.properties || {}), bands } };
      })
    }));
  };

  const handleCanvasDoubleClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    const isBackground = target === canvasRef.current;
    const isTitleBar = target.closest('.canvas-title-bar');
    
    if (isBackground || isTitleBar) {
      const handlerName = activeWindow.events?.Loaded?.trim()
        || getWindowEventHandlerName(activeWindow.className, 'Loaded');
      const detail = {
        controlId: activeWindow.id,
        controlName: activeWindow.className,
        controlContent: activeWindow.title,
        controlType: 'Grid',
        eventName: 'Loaded',
        handlerName,
        windowFileName: activeWindow.fileName,
        windowClassName: activeWindow.className,
        windowTitle: activeWindow.title
      };
      window.dispatchEvent(new CustomEvent('open-control-event-code', { detail }));
      addLog(`> [${new Date().toLocaleTimeString()}] 【事件代码】已定位窗体自身创建完毕事件：${handlerName}`);
    }
  };

  const handleAddWindow = async () => {
    const backend = newEmojiModuleEnabled && await requestWorkbenchConfirm({
      title: '选择新窗口 UI 后端',
      description: '新窗口是否使用 new_emoji 后端？\n选择“取消”将创建 Win32 窗口。',
      confirmLabel: '使用 new_emoji',
      cancelLabel: '使用 Win32'
    })
      ? 'new-emoji'
      : 'win32';
    const nextWindow = createBlankWindow(project.windows.length + 1, backend);
    setProject(prev => ({
      ...prev,
      windows: [...prev.windows, nextWindow]
    }));
    setActiveWindowId(nextWindow.id);
    setSelectedControlId(nextWindow.controls[0]?.id || null);
    addLog(`> [${new Date().toLocaleTimeString()}] 【窗体设计】已创建新窗口：${nextWindow.fileName}，可继续拖拽控件并绑定中文事件。`);
    window.dispatchEvent(new CustomEvent('window-added', { detail: nextWindow }));
  };

  const handleDeleteWindow = () => {
    if (project.windows.length <= 1) {
      addLog(`> [${new Date().toLocaleTimeString()}] 【窗体设计】至少需要保留一个窗口，未执行删除。`);
      return;
    }

    const currentIndex = project.windows.findIndex(window => window.id === activeWindowId);
    const deletedWindow = project.windows[currentIndex];
    const nextWindows = project.windows.filter(window => window.id !== activeWindowId);
    const nextWindow = nextWindows[Math.max(0, currentIndex - 1)] || nextWindows[0];

    setProject(prev => ({
      ...prev,
      windows: nextWindows
    }));
    setActiveWindowId(nextWindow.id);
    setSelectedControlId(nextWindow.controls[0]?.id || null);
    addLog(`> [${new Date().toLocaleTimeString()}] 【窗体设计】已从窗口程序集中移除当前窗口。`);
    window.dispatchEvent(new CustomEvent('window-deleted', {
      detail: { deletedWindow, nextWindow }
    }));
  };

  useEffect(() => { if (applyingHistoryRef.current) { applyingHistoryRef.current = false; return; } const timer = setTimeout(() => { designerHistoryRef.current.commit(project); }, 250); return () => clearTimeout(timer); }, [project]);
  const applyHistoryValue = (value: LingWindowProject | null) => { if (!value) return; applyingHistoryRef.current = true; setProject(value); };
  const undoDesigner = () => { designerHistoryRef.current.commit(project); applyHistoryValue(designerHistoryRef.current.undo()); };
  const redoDesigner = () => applyHistoryValue(designerHistoryRef.current.redo());
  // 布局与微移的校验计算必须在 setState updater 外执行：React 19 会吞掉 updater
  // 在 eager 计算中抛出的异常并照常入队，渲染阶段重新抛出会卸载整棵组件树（黑屏）。
  const applyLayoutOperation = (operation: DesignerLayoutOperation) => {
    const source = currentProjectRef.current;
    let nextWindows: LingWindowModel[];
    try {
      nextWindows = source.windows.map(item => item.id === activeWindowId ? applyDesignerLayout(item, selectedControlIds, operation) : item);
    } catch (error) {
      addLog(`> 【布局】${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    setProject(previous => ({ ...previous, windows: previous === source ? nextWindows : previous.windows }));
  };
  const nudgeSelection = (dx: number, dy: number) => {
    if (!selectedControlIds.length) return;
    if (activeWindow.controls.some(control => selectedControlIds.includes(control.id) && control.designerLocked)) {
      addLog('> 【布局】选区中包含已锁定控件，未执行移动。');
      return;
    }
    const source = currentProjectRef.current;
    let nextWindows: LingWindowModel[];
    try {
      nextWindows = source.windows.map(item => item.id === activeWindowId ? nudgeControls(item, selectedControlIds, dx, dy) : item);
    } catch (error) {
      addLog(`> 【布局】${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    setProject(previous => ({ ...previous, windows: previous === source ? nextWindows : previous.windows }));
  };

  const handleDuplicateWindow = () => {
    if (!activeWindow) return;
    const cloneIndex = project.windows.length + 1;
    const clonedWindow: LingWindowModel = {
      ...activeWindow,
      id: `window_clone_${Date.now()}`,
      fileName: `CopyOf${activeWindow.fileName}`,
      className: `${activeWindow.className}副本`,
      title: `${activeWindow.title} 副本`,
      controls: activeWindow.controls.map(control => ({
        ...control,
        id: `${control.id}_copy_${cloneIndex}`,
        name: `${control.name}_副本`
      }))
    };

    setProject(prev => ({
      ...prev,
      windows: [...prev.windows, clonedWindow]
    }));
    setActiveWindowId(clonedWindow.id);
    setSelectedControlId(clonedWindow.controls[0]?.id || null);
    addLog(`> [${new Date().toLocaleTimeString()}] 【窗体设计】已复制窗口：${clonedWindow.fileName}。`);
    window.dispatchEvent(new CustomEvent('window-duplicated', { detail: clonedWindow }));
  };

  const handleAddControl = async (type: LingControlType, moduleControl?: ModuleDesignerControlContribution) => {
    if (moduleControl) {
      try {
        await ensureDesignerModuleAccess(true);
      } catch (error) {
        addLog(`> 【模块授权】${error instanceof Error ? error.message : String(error)}`);
        return;
      }
    }
    if (!activeWindow) return;
    const definition = getWin32ControlDefinition(type);
    if (definition && !enabledDesignerModules.has(definition.moduleId)) {
      addLog(`> [${new Date().toLocaleTimeString()}] 【模块】${definition.label} 需要先启用 Win32高级控件模块。`);
      return;
    }
    if (type === 'FileDialog') {
      const existing = (project.resources || []).filter((resource): resource is LingFileDialogResource => resource.type === 'FileDialog');
      let suffix = existing.length + 1;
      while ((project.resources || []).some(resource => resource.id === `file-dialog-${suffix}`)) suffix += 1;
      const resource: LingFileDialogResource = {
        id: `file-dialog-${suffix}`,
        type: 'FileDialog',
        name: `文件对话框${suffix}`,
        designerX: 15 + ((existing.filter(item => item.ownerWindowId === activeWindow.id).length % 4) * 145),
        designerY: Math.max(0, activeWindow.height - windowContentOffset - 55),
        ownerWindowId: activeWindow.id,
        triggerControlId: '',
        dropTargetId: activeWindow.id,
        title: '选择文件',
        filter: '所有文件|*.*',
        multiple: false,
        allowDrop: false
      };
      setProject(previous => ({ ...previous, resources: [...(previous.resources || []), resource] }));
      selectOnlyControl(null);
      setSelectedResourceId(resource.id);
      setActiveInspectorTab('properties');
      addLog(`> [${new Date().toLocaleTimeString()}] 【非可视组件】已添加${resource.name}；请绑定打开触发控件和拖放目标。`);
      return;
    }
    if (type === 'ContextMenu' || type === 'PopupMenu') {
      const existing = (project.resources || []).filter((resource): resource is LingMenuResource => resource.type === type);
      const prefix = type === 'ContextMenu' ? 'context-menu' : 'popup-menu';
      const label = type === 'ContextMenu' ? '上下文菜单' : '弹出菜单';
      let suffix = existing.length + 1;
      while ((project.resources || []).some(resource => resource.id === `${prefix}-${suffix}`)) suffix += 1;
      const resource: LingMenuResource = {
        id: `${prefix}-${suffix}`,
        type,
        name: `${label}${suffix}`,
        designerX: 15 + (((activeFileDialogs.length + activeMenuResources.length) % 4) * 145),
        designerY: Math.max(0, activeWindow.height - windowContentOffset - 55),
        ownerWindowId: activeWindow.id,
        targetControlId: type === 'ContextMenu' ? activeWindow.id : '',
        items: [
          { id: 'item-1', label: '菜单项 1', enabled: true },
          { id: 'item-2', label: '菜单项 2', enabled: true }
        ]
      };
      setProject(previous => ({ ...previous, resources: [...(previous.resources || []), resource] }));
      selectOnlyControl(null);
      setSelectedResourceId(resource.id);
      setActiveInspectorTab('properties');
      addLog(`> [${new Date().toLocaleTimeString()}] 【非可视组件】已添加${resource.name}。`);
      return;
    }
    const stableDesignerType = moduleControl?.namespacedType || (moduleControl ? `${NEW_EMOJI_MODULE_ID}/${moduleControl.type}` : undefined);
    const typeIndex = activeWindow.controls.filter(control => (control.designerType || control.type) === (stableDesignerType || type)).length + 1;
    const selectedParent = activeWindow.controls.find(control => (
      control.id === selectedControlId && getWin32ControlDefinition(control.type)?.isContainer
    ));
    const selectedPage = selectedParent && isTabContainerControl(selectedParent) ? getSelectedTabPage(selectedParent) : undefined;
    const selectedParentTabOffset = selectedParent && isTabContainerControl(selectedParent)
      ? getTabContainerContentOffset(selectedParent)
      : { x: 0, y: 0 };
    const createdControl = createControl(type, typeIndex);
    const moduleDefaults = moduleControl?.defaultProps || {};
    const newControl: LingControl = {
      ...createdControl,
      ...(moduleControl ? {
        designerType: stableDesignerType,
        name: `${moduleControl.label.replace(/\s+[A-Za-z][A-Za-z0-9]*$/u, '')}${typeIndex}`,
        content: String(moduleDefaults.content ?? moduleControl.label),
        width: Number(moduleDefaults.width || createdControl.width),
        height: Number(moduleDefaults.height || createdControl.height),
        background: String(moduleDefaults.background || createdControl.background),
        foreground: String(moduleDefaults.foreground || createdControl.foreground),
        properties: Object.fromEntries((moduleControl.properties || []).map(property => [property.key, property.defaultValue])) as LingControl['properties']
      } : {}),
      x: selectedParent ? selectedParent.x + selectedParentTabOffset.x + 12 : createdControl.x,
      y: selectedParent ? selectedParent.y + selectedParentTabOffset.y + (selectedParentTabOffset.y === 0 ? 12 : 0) : createdControl.y,
      parentId: selectedParent?.id,
      containerSlot: selectedPage?.id
    };
    updateActiveWindow(window => ({
      ...window,
      controls: reconcileRebarBands([...window.controls, newControl])
    }));
    setSelectedControlId(newControl.id);
    setActiveInspectorTab('properties');
    addLog(`> [${new Date().toLocaleTimeString()}] 【可视化设计】已在 ${activeWindow.fileName} 添加控件：${moduleControl?.label || CONTROL_LABELS[type]}。`);
  };

  const deleteControlById = (controlId: string) => {
    if (controlId === '__window_menu_bar__') {
      updateActiveWindow(window => ({
        ...window,
        menuName: undefined,
        menuItems: undefined,
        menuEvents: undefined
      }));
      setSelectedControlId(null);
      setSelectedControlIds([]);
      addLog(`> [${new Date().toLocaleTimeString()}] 已移除当前窗口菜单栏。`);
      return;
    }
    if (controlId.startsWith('__window_menu_item_')) {
      const itemIndex = Number.parseInt(controlId.replace('__window_menu_item_', '').replace('__', ''), 10);
      updateActiveWindow(window => {
        const items = (window.menuItems || '').split(',').map(item => item.trim()).filter(Boolean);
        if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= items.length) return window;
        items.splice(itemIndex, 1);
        const nextEvents: Record<string, string> = {};
        Object.entries(window.menuEvents || {}).forEach(([key, value]) => {
          const match = /^Item_(\d+)$/.exec(key);
          if (!match) nextEvents[key] = value;
          else {
            const index = Number.parseInt(match[1], 10);
            if (index < itemIndex) nextEvents[key] = value;
            if (index > itemIndex) nextEvents[`Item_${index - 1}`] = value;
          }
        });
        return { ...window, menuItems: items.join(', '), menuEvents: nextEvents };
      });
      setSelectedControlId('__window_menu_bar__');
      setSelectedControlIds([]);
      addLog(`> [${new Date().toLocaleTimeString()}] 已删除窗口菜单项。`);
      return;
    }
    const idsToDelete = selectedControlIds.includes(controlId) && selectedControlIds.length
      ? new Set(selectedControlIds)
      : new Set([controlId]);
    if (activeWindow.controls.some(control => idsToDelete.has(control.id) && control.designerLocked)) {
      addLog('> 【删除】选区中包含已锁定控件，请先解除锁定。');
      return;
    }
    updateActiveWindow(window => ({
      ...window,
      controls: reconcileRebarBands(window.controls
        .filter(control => !idsToDelete.has(control.id))
        .map(control => idsToDelete.has(control.parentId || '')
          ? { ...control, parentId: undefined }
          : control))
    }));
    setSelectedControlId(null);
    setSelectedControlIds([]);
  };

  const handleDeleteControl = () => {
    if (selectedControlId) deleteControlById(selectedControlId);
  };

  const duplicateControlById = (controlId: string) => {
    if (controlId === '__window_menu_bar__') return;
    if (controlId.startsWith('__window_menu_item_')) {
      const itemIndex = Number.parseInt(controlId.replace('__window_menu_item_', '').replace('__', ''), 10);
      updateActiveWindow(window => {
        const items = (window.menuItems || '').split(',').map(item => item.trim()).filter(Boolean);
        if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= items.length) return window;
        items.splice(itemIndex + 1, 0, `${items[itemIndex]} 副本`);
        return { ...window, menuItems: items.join(', ') };
      });
      setSelectedControlId(`__window_menu_item_${itemIndex + 1}__`);
      addLog(`> [${new Date().toLocaleTimeString()}] 已复制窗口菜单项。`);
      return;
    }
    const source = activeWindow.controls.find(control => control.id === controlId);
    if (!source) return;
    const copy: LingControl = {
      ...source,
      id: `${source.id}_copy_${Date.now()}`,
      name: `${source.name}副本`,
      x: Math.max(0, Math.min(activeWindow.width - source.width, source.x + 10)),
      y: Math.max(0, Math.min(activeWindow.height - windowContentOffset - source.height, source.y + 10)),
      events: source.events ? { ...source.events } : undefined,
      properties: source.properties ? { ...source.properties } : undefined
    };
    updateActiveWindow(window => ({ ...window, controls: [...window.controls, copy] }));
    selectOnlyControl(copy.id);
    addLog(`> [${new Date().toLocaleTimeString()}] 已复制控件：${source.name}。`);
  };

  const getSelectedPersistedIds = () => selectedControlIds.filter(id => activeWindow.controls.some(control => control.id === id));

  const resolveControlModuleId = (control: LingControl): string | undefined => {
    if (control.designerType) {
      const slash = control.designerType.lastIndexOf('/');
      if (slash > 0) return control.designerType.slice(0, slash);
    }
    return getWin32ControlDefinition(control.type)?.moduleId;
  };

  const supportsDesignerControl = (control: LingControl): boolean => {
    if (control.designerType) {
      return enabledDesignerModuleRecords.some(installed => installed.manifest.contributes?.designerControls?.some(item => (
        item.namespacedType || `${installed.manifest.id}/${item.type}`
      ) === control.designerType));
    }
    const definition = getWin32ControlDefinition(control.type);
    return Boolean(definition && enabledDesignerModules.has(definition.moduleId));
  };

  const writeDesignerSelection = async () => {
    const ids = getSelectedPersistedIds();
    const payload = clipboardServiceRef.current!.createPayload(project, activeWindow, ids, { resolveModuleId: resolveControlModuleId });
    const result = await clipboardServiceRef.current!.writePayload(payload);
    addLog(`> 【设计器剪贴板】已复制 ${payload.rootControlIds.length} 个顶层控件（${payload.controls.length} 个节点）。`);
    if (result.warning) addLog(`> 【设计器剪贴板】${result.warning}`);
    return payload;
  };

  const resolvePasteTarget = (controlId = controlContextMenu?.controlId) => {
    const targetControl = controlId ? activeWindow.controls.find(control => control.id === controlId) : undefined;
    const moduleControl = targetControl?.designerType
      ? enabledDesignerModuleRecords.flatMap(installed => (installed.manifest.contributes?.designerControls || []).map(item => ({ ...item, resolvedType: item.namespacedType || `${installed.manifest.id}/${item.type}` })))
        .find(item => item.resolvedType === targetControl.designerType)
      : undefined;
    const isContainer = Boolean(targetControl && (getWin32ControlDefinition(targetControl.type)?.isContainer || moduleControl?.isContainer));
    if (isContainer && targetControl) {
      return {
        parentId: targetControl.id,
        containerSlot: isTabContainerControl(targetControl) ? getSelectedTabPage(targetControl)?.id : undefined
      };
    }
    return { parentId: targetControl?.parentId, containerSlot: targetControl?.containerSlot };
  };

  const pasteDesignerPayload = async (payloadInput?: Awaited<ReturnType<DesignerClipboardService['readPayload']>>, target = resolvePasteTarget()) => {
    const payload = payloadInput || await clipboardServiceRef.current!.readPayload();
    let effectiveModules = new Set(enabledDesignerModules);
    const supportsWithEffectiveModules = (control: LingControl) => {
      const moduleId = resolveControlModuleId(control);
      return moduleId ? effectiveModules.has(moduleId) : supportsDesignerControl(control);
    };
    let plan = clipboardServiceRef.current!.planPaste(payload, project, activeWindow, {
      target,
      enabledModules: effectiveModules,
      supportsControl: supportsWithEffectiveModules
    });
    if (plan.missingModules.length) {
      const accepted = await requestWorkbenchConfirm({
        title: '粘贴需要启用模块',
        description: `${plan.missingModules.join('\n')}\n\n是否现在启用？`,
        confirmLabel: '启用并继续',
        cancelLabel: '取消粘贴'
      });
      if (!accepted) throw new Error(`已取消粘贴；未启用模块：${plan.missingModules.join('、')}。`);
      for (const moduleId of plan.missingModules) {
        const response = await fetch('/api/modules/project/enable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project.id, moduleId })
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || `无法启用模块 ${moduleId}。`);
        effectiveModules.add(moduleId);
      }
      window.dispatchEvent(new CustomEvent('lingbuilder-modules-changed', { detail: { projectId: project.id, scope: 'project' } }));
      await refreshDesignerModules(project.id);
      plan = clipboardServiceRef.current!.planPaste(payload, project, activeWindow, {
        target,
        enabledModules: effectiveModules,
        supportsControl: supportsWithEffectiveModules
      });
    }
    if (!plan.ok) throw new Error(plan.errors.join('；'));
    if (plan.warnings.length) {
      const accepted = await requestWorkbenchConfirm({
        title: '粘贴预览',
        description: `${plan.warnings.join('\n')}\n\n是否接受转换并粘贴？`,
        confirmLabel: '接受并粘贴',
        cancelLabel: '取消粘贴'
      });
      if (!accepted) throw new Error('已取消粘贴。');
    }
    setProject(plan.project);
    setSelectedControlIds(plan.insertedControlIds);
    setSelectedControlId(plan.insertedControlIds.at(-1) || null);
    addLog(`> 【设计器剪贴板】已通过容器布局适配器粘贴 ${plan.insertedControlIds.length} 个控件树。`);
  };

  const copyDesignerSelection = async () => { await writeDesignerSelection(); };

  const cutDesignerSelection = async () => {
    const ids = getSelectedPersistedIds();
    if (activeWindow.controls.some(control => ids.includes(control.id) && control.designerLocked)) throw new Error('选区中包含已锁定控件。');
    await writeDesignerSelection();
    setProject(previous => ({
      ...previous,
      windows: previous.windows.map(window => window.id === activeWindowId ? removeClipboardSelection(window, ids) : window)
    }));
    setSelectedControlId(null);
    setSelectedControlIds([]);
  };

  const duplicateDesignerSelection = async () => {
    const ids = getSelectedPersistedIds();
    if (!ids.length && controlContextMenu?.controlId) { duplicateControlById(controlContextMenu.controlId); return; }
    const payload = clipboardServiceRef.current!.createPayload(project, activeWindow, ids, { resolveModuleId: resolveControlModuleId });
    const primary = activeWindow.controls.find(control => control.id === selectedControlId) || activeWindow.controls.find(control => ids.includes(control.id));
    await pasteDesignerPayload(payload, { parentId: primary?.parentId, containerSlot: primary?.containerSlot });
  };

  const reorderSelection = (operation: DesignerLayerOperation) => {
    updateActiveWindow(window => reorderDesignerControls(window, getSelectedPersistedIds(), operation));
  };

  const setSelectionLocked = (locked: boolean) => {
    const ids = new Set(getSelectedPersistedIds());
    updateActiveWindow(window => ({
      ...window,
      controls: window.controls.map(control => ids.has(control.id) ? { ...control, designerLocked: locked || undefined } : control)
    }));
    addLog(`> 【设计器】已${locked ? '锁定' : '解除锁定'} ${ids.size} 个控件。`);
  };

  const selectParentControl = () => {
    const primary = activeWindow.controls.find(control => control.id === selectedControlId);
    if (primary?.parentId) selectOnlyControl(primary.parentId);
  };

  const selectDirectChildren = () => {
    if (!selectedControlId) return;
    const ids = activeWindow.controls.filter(control => control.parentId === selectedControlId).map(control => control.id);
    if (!ids.length) return;
    setSelectedControlIds(ids);
    setSelectedControlId(ids.at(-1) || null);
  };

  const openControlContextMenu = (event: React.MouseEvent, controlId: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedControlIds.includes(controlId)) selectOnlyControl(controlId);
    setActiveInspectorTab('properties');
    activeDesignerCommandTargetService.activate(`${projectId}:${designerInstanceId}`);
    setControlContextMenu({ x: event.clientX, y: event.clientY, menuId: DESIGNER_CONTROL_CONTEXT_MENU, controlId });
  };

  const openCanvasContextMenu = (event: React.MouseEvent) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    selectOnlyControl(null);
    activeDesignerCommandTargetService.activate(`${projectId}:${designerInstanceId}`);
    setControlContextMenu({ x: event.clientX, y: event.clientY, menuId: DESIGNER_CANVAS_CONTEXT_MENU });
  };

  const openResourceContextMenu = (event: React.MouseEvent, resourceId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedControlId(null);
    setSelectedControlIds([]);
    setSelectedResourceId(resourceId);
    setActiveInspectorTab('properties');
    activeDesignerCommandTargetService.activate(`${projectId}:${designerInstanceId}`);
    setControlContextMenu({ x: event.clientX, y: event.clientY, menuId: DESIGNER_RESOURCE_CONTEXT_MENU, resourceId });
  };

  const handleMouseDown = (event: React.MouseEvent, control: LingControl, action: 'drag' | ResizeDirection) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    if (
      isDragging
      || isResizing
      || draggingResourceId
      || controlInteractionPreviewRef.current
      || windowInteractionPreviewRef.current
      || resourceInteractionPreviewRef.current
    ) {
      finishPointerInteraction();
    }
    setSelectedResourceId(null);
    setActiveInspectorTab('properties');
    if (event.shiftKey || event.ctrlKey || event.metaKey) { setSelectedControlIds(current => current.includes(control.id) ? current.filter(id => id !== control.id) : [...current, control.id]); setSelectedControlId(control.id); return; }
    if (!selectedControlIds.includes(control.id)) setSelectedControlIds([control.id]);
    setSelectedControlId(control.id);

    if (control.designerLocked) {
      addLog('> 【设计器】该控件已锁定，可继续选择和编辑事件，但不能移动或缩放。');
      return;
    }

    controlInteractionPreviewRef.current = null;
    pendingControlInteractionPreviewRef.current = null;
    if (controlInteractionFrameRef.current !== null) {
      window.cancelAnimationFrame(controlInteractionFrameRef.current);
      controlInteractionFrameRef.current = null;
    }
    if (action === 'drag') {
      setIsDragging(true);
      setInitialPos({ x: event.clientX, y: event.clientY });
      setInitialControlPos({ x: control.x, y: control.y });
      return;
    }

    setIsResizing(true);
    setResizeDirection(action);
    setInitialSize({ width: control.width, height: control.height });
    setInitialPos({ x: event.clientX, y: event.clientY });
    setInitialControlPos({ x: control.x, y: control.y });
  };

  const getFileDialogDesignerPosition = (resource: LingFileDialogResource, index: number) => ({
    x: resource.designerX ?? 15 + ((index % 4) * 145),
    y: resource.designerY ?? Math.max(0, activeWindow.height - windowContentOffset - 55 - (Math.floor(index / 4) * 50))
  });

  const getMenuResourceDesignerPosition = (resource: LingMenuResource, index: number) => ({
    x: resource.designerX ?? 15 + (((activeFileDialogs.length + index) % 4) * 145),
    y: resource.designerY ?? Math.max(0, activeWindow.height - windowContentOffset - 55 - (Math.floor((activeFileDialogs.length + index) / 4) * 50))
  });

  const getDisplayedResourcePosition = (_resource: LingDesignerResource, fallback: { x: number; y: number }) => fallback;

  const handleFileDialogMouseDown = (event: React.MouseEvent, resource: LingFileDialogResource, index: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (
      isDragging
      || isResizing
      || draggingResourceId
      || controlInteractionPreviewRef.current
      || windowInteractionPreviewRef.current
      || resourceInteractionPreviewRef.current
    ) {
      finishPointerInteraction();
    }
    const position = getFileDialogDesignerPosition(resource, index);
    setSelectedControlId(null);
    setSelectedControlIds([]);
    setSelectedResourceId(resource.id);
    setActiveInspectorTab('properties');
    setDraggingResourceId(resource.id);
    setResourceDragOffset({
      x: event.clientX - position.x * canvasScale,
      y: event.clientY - position.y * canvasScale
    });
  };

  const handleMenuResourceMouseDown = (event: React.MouseEvent, resource: LingMenuResource, index: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (
      isDragging
      || isResizing
      || draggingResourceId
      || controlInteractionPreviewRef.current
      || windowInteractionPreviewRef.current
      || resourceInteractionPreviewRef.current
    ) {
      finishPointerInteraction();
    }
    const position = getMenuResourceDesignerPosition(resource, index);
    setSelectedControlId(null);
    setSelectedControlIds([]);
    setSelectedResourceId(resource.id);
    setActiveInspectorTab('properties');
    setDraggingResourceId(resource.id);
    setResourceDragOffset({
      x: event.clientX - position.x * canvasScale,
      y: event.clientY - position.y * canvasScale
    });
  };

  const handleControlDoubleClick = async (event: React.MouseEvent, control: LingControl) => {
    event.preventDefault();
    event.stopPropagation();

    if (!activeWindow) return;

    const moduleControl = control.designerType
      ? newEmojiDesignerControls.find(item => (item.namespacedType || `${NEW_EMOJI_MODULE_ID}/${item.type}`) === control.designerType)
      : undefined;
    const { eventName, handlerName, menuEventKey } = getPrimaryDesignerEventBinding(control, activeWindow, moduleControl);
    const moduleEvent = moduleControl?.events?.find(item => item.name === eventName || (item.aliases || []).includes(eventName));

    if (moduleControl) {
      try {
        await ensureDesignerModuleAccess();
      } catch (error) {
        addLog(`> 【模块授权】${error instanceof Error ? error.message : String(error)}`);
        return;
      }
    }

    setSelectedControlId(control.id);
    setActiveInspectorTab('events');
    
    if (menuEventKey === 'Select') {
      updateActiveWindow(window => window.menuEvents?.Select === handlerName ? window : ({
        ...window,
        menuEvents: { ...(window.menuEvents || {}), Select: handlerName }
      }));
    } else if (menuEventKey) {
      updateActiveWindow(window => window.menuEvents?.[menuEventKey] === handlerName ? window : ({
        ...window,
        menuEvents: { ...(window.menuEvents || {}), [menuEventKey]: handlerName }
      }));
    } else {
      commitControlFieldsImmediately(control.id, {
        events: {
          ...(control.events || {}),
          [eventName]: handlerName
        }
      });
    }

    const detail: OpenControlEventCodeDetail = {
      controlId: control.id,
      controlName: control.name,
      controlContent: control.content,
      controlType: control.type,
      eventName,
      handlerName,
      eventParameters: moduleEvent ? [...(moduleEvent.parameters || [])] : undefined,
      eventStarterStatements: moduleEvent?.starterStatements ? [...moduleEvent.starterStatements] : undefined,
      windowFileName: activeWindow.fileName,
      windowClassName: activeWindow.className,
      windowTitle: activeWindow.title
    };

    window.dispatchEvent(new CustomEvent<OpenControlEventCodeDetail>('open-control-event-code', { detail }));
    addLog(`> [${new Date().toLocaleTimeString()}] 【事件代码】已定位 ${control.name} 的默认事件：${handlerName}`);
  };

  // Memoized canvas controls keep their event closures stable. The refs below
  // always point at the latest parent handlers, so a skipped child render never
  // observes stale selection, window or module state.
  const handleMouseDownRef = useRef(handleMouseDown);
  handleMouseDownRef.current = handleMouseDown;
  const stableHandleMouseDown = useCallback<DesignerControlRenderProps['handleMouseDown']>(
    (event, control, action) => handleMouseDownRef.current(event, control, action),
    []
  );
  const handleControlDoubleClickRef = useRef(handleControlDoubleClick);
  handleControlDoubleClickRef.current = handleControlDoubleClick;
  const stableHandleControlDoubleClick = useCallback<DesignerControlRenderProps['onOpenEventCode']>(
    (event, control) => { void handleControlDoubleClickRef.current(event, control); },
    []
  );
  const openControlContextMenuRef = useRef(openControlContextMenu);
  openControlContextMenuRef.current = openControlContextMenu;
  const stableOpenControlContextMenu = useCallback<DesignerControlRenderProps['onOpenContextMenu']>(
    (event, controlId) => openControlContextMenuRef.current(event, controlId),
    []
  );
  const handleSelectTabPageRef = useRef(handleSelectTabPage);
  handleSelectTabPageRef.current = handleSelectTabPage;
  const stableHandleSelectTabPage = useCallback((tabControlId: string, pageId: string) => {
    handleSelectTabPageRef.current(tabControlId, pageId);
  }, []);
  const handleReorderRebarBandRef = useRef(handleReorderRebarBand);
  handleReorderRebarBandRef.current = handleReorderRebarBand;
  const stableHandleReorderRebarBand = useCallback((rebarId: string, fromIndex: number, toIndex: number) => {
    handleReorderRebarBandRef.current(rebarId, fromIndex, toIndex);
  }, []);

  const persistedSelection = activeWindow.controls.filter(control => selectedControlIds.includes(control.id));
  const contextPrimaryControl = activeWindow.controls.find(control => control.id === (controlContextMenu?.controlId || selectedControlId));
  const contextHasSpecialSelection = Boolean(selectedControlId?.startsWith('__window_'));
  const contextAnyLocked = persistedSelection.some(control => control.designerLocked);
  const contextAllLocked = persistedSelection.length > 0 && persistedSelection.every(control => control.designerLocked);
  const contextSameLayoutScope = new Set(persistedSelection.map(control => `${control.parentId || ''}\0${control.containerSlot || ''}`)).size <= 1;
  designerContextRef.current = {
    ...(getCommandContext?.() || {}),
    'editor.surface': 'designer',
    'editor.readOnly': false,
    'designer.active': true,
    'designer.projectId': project.id,
    'designer.windowId': activeWindow.id,
    'designer.targetKind': controlContextMenu?.menuId === DESIGNER_CANVAS_CONTEXT_MENU
      ? 'canvas'
      : controlContextMenu?.menuId === DESIGNER_RESOURCE_CONTEXT_MENU ? 'resource' : contextHasSpecialSelection ? 'menu' : 'control',
    'designer.selectionCount': persistedSelection.length,
    'designer.hasSelection': persistedSelection.length > 0 || contextHasSpecialSelection,
    'designer.multipleSelection': persistedSelection.length > 1,
    'designer.control.type': contextPrimaryControl?.type,
    'designer.control.designerType': contextPrimaryControl?.designerType,
    'designer.control.moduleId': contextPrimaryControl ? resolveControlModuleId(contextPrimaryControl) : undefined,
    'designer.control.isContainer': Boolean(contextPrimaryControl && getWin32ControlDefinition(contextPrimaryControl.type)?.isContainer),
    'designer.resourceId': controlContextMenu?.resourceId,
    'designer.resourceType': controlContextMenu?.resourceId ? project.resources?.find(resource => resource.id === controlContextMenu.resourceId)?.type : undefined,
    'designer.anyLocked': contextAnyLocked,
    'designer.allLocked': contextAllLocked,
    'designer.canCopy': persistedSelection.length > 0,
    'designer.canCut': persistedSelection.length > 0 && !contextAnyLocked,
    'designer.canPaste': true,
    'designer.canDelete': contextHasSpecialSelection || (persistedSelection.length > 0 && !contextAnyLocked),
    'designer.canDuplicate': Boolean(selectedControlId?.startsWith('__window_menu_item_')) || persistedSelection.length > 0,
    'designer.canReorder': persistedSelection.length > 0 && !contextAnyLocked,
    'designer.canLayout': persistedSelection.length > 1 && contextSameLayoutScope && !contextAnyLocked,
    'designer.hasParent': Boolean(contextPrimaryControl?.parentId),
    'designer.hasChildren': Boolean(contextPrimaryControl && activeWindow.controls.some(control => control.parentId === contextPrimaryControl.id)),
    'designer.canMoveToRoot': persistedSelection.some(control => control.parentId) && !contextAnyLocked,
    'designer.readOnly': false
  };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent<CommandContext>('lingbuilder-designer-command-context', { detail: designerContextRef.current }));
    return () => {
      window.dispatchEvent(new CustomEvent<CommandContext>('lingbuilder-designer-command-context', { detail: { 'designer.active': false } }));
    };
  }, [activeWindow.id, contextAnyLocked, controlContextMenu?.menuId, project.id, selectedControlId, selectedControlIds, selectedResourceId]);

  designerActionsRef.current = {
    openDefaultEvent: () => {
      if (!selectedControl) return;
      handleControlDoubleClick({ preventDefault() {}, stopPropagation() {} } as React.MouseEvent, selectedControl);
    },
    openProperties: () => setActiveInspectorTab('properties'),
    copy: copyDesignerSelection,
    cut: cutDesignerSelection,
    paste: async () => pasteDesignerPayload(),
    duplicate: duplicateDesignerSelection,
    deleteSelection: handleDeleteControl,
    deleteResource: () => {
      if (!selectedResourceId) return;
      setProject(previous => ({ ...previous, resources: (previous.resources || []).filter(resource => resource.id !== selectedResourceId) }));
      setSelectedResourceId(null);
    },
    selectAll: () => {
      const ids = activeWindow.controls.map(control => control.id);
      setSelectedControlIds(ids);
      setSelectedControlId(ids.at(-1) || null);
    },
    applyLayout: applyLayoutOperation,
    reorder: reorderSelection,
    setLocked: setSelectionLocked,
    selectParent: selectParentControl,
    selectChildren: selectDirectChildren,
    moveToRoot: () => handleReparentControls(getSelectedPersistedIds()),
    previewEdgeControl: previewSelectedEdgeControl
  };

  useEffect(() => {
    const registration = acquireDesignerCommands(designerCommandService, designerMenuService);
    return () => registration.dispose();
  }, [designerCommandService, designerMenuService]);

  useEffect(() => {
    const target: DesignerCommandTarget = {
      id: `${projectId}:${designerInstanceId}`,
      getContext: () => designerContextRef.current,
      openDefaultEvent: () => designerActionsRef.current?.openDefaultEvent(),
      openProperties: () => designerActionsRef.current?.openProperties(),
      copy: async () => designerActionsRef.current?.copy(),
      cut: async () => designerActionsRef.current?.cut(),
      paste: async () => designerActionsRef.current?.paste(),
      duplicate: async () => designerActionsRef.current?.duplicate(),
      deleteSelection: () => designerActionsRef.current?.deleteSelection(),
      deleteResource: () => designerActionsRef.current?.deleteResource(),
      selectAll: () => designerActionsRef.current?.selectAll(),
      applyLayout: operation => designerActionsRef.current?.applyLayout(operation),
      reorder: operation => designerActionsRef.current?.reorder(operation),
      setLocked: locked => designerActionsRef.current?.setLocked(locked),
      selectParent: () => designerActionsRef.current?.selectParent(),
      selectChildren: () => designerActionsRef.current?.selectChildren(),
      moveToRoot: () => designerActionsRef.current?.moveToRoot(),
      previewEdgeControl: async () => designerActionsRef.current?.previewEdgeControl()
    };
    const registration = activeDesignerCommandTargetService.register(target);
    activeDesignerCommandTargetService.activate(target.id);
    return () => registration.dispose();
  }, [designerInstanceId, projectId]);

  const resolvedContextMenuItems = useMemo(() => controlContextMenu
    ? designerMenuService.resolveMenu(controlContextMenu.menuId, designerContextRef.current, { includeDisabled: true })
    : [], [controlContextMenu, designerMenuService, project, selectedControlId, selectedControlIds]);

  const executeDesignerCommand = async (commandId: string, ...args: unknown[]) => {
    activeDesignerCommandTargetService.activate(`${projectId}:${designerInstanceId}`);
    try {
      await designerCommandService.executeCommand(commandId, designerContextRef.current, ...args);
    } catch (error) {
      addLog(`> 【设计器命令】${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const executeContextMenuItem = async (item: ResolvedMenuCommandItem) => {
    await executeDesignerCommand(item.command.id, ...item.arguments);
    setControlContextMenu(null);
  };

  useEffect(() => {
    const handleAddFromToolbar = (event: Event) => {
      const customEvent = event as CustomEvent<{ type?: LingControlType }>;
      if (customEvent.detail?.type) {
        handleAddControl(customEvent.detail.type);
      }
    };

    window.addEventListener('add-designer-control', handleAddFromToolbar);
    return () => {
      window.removeEventListener('add-designer-control', handleAddFromToolbar);
    };
  }, [activeWindow, activeWindowId, project.windows.length]);

  useEffect(() => {
    const handleGlobalClick = () => {
      setIsMenuDropdownOpen(false);
      setControlContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,[contenteditable="true"]')) return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (modifier && key === 'z') { event.preventDefault(); event.shiftKey ? redoDesigner() : undoDesigner(); return; }
      if (modifier && key === 'y') { event.preventDefault(); redoDesigner(); return; }
      const commandId = modifier ? ({
        x: 'designer.action.cut',
        c: 'designer.action.copy',
        v: 'designer.action.paste',
        d: 'designer.action.duplicate',
        a: 'designer.action.selectAll'
      } as Record<string, string>)[key] : event.key === 'Delete' ? 'designer.action.delete' : undefined;
      if (commandId) {
        event.preventDefault();
        void executeDesignerCommand(commandId);
        setControlContextMenu(null);
        return;
      }
      const step = event.shiftKey ? 10 : 1;
      const movement: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (movement[event.key] && selectedControlIds.length) { event.preventDefault(); nudgeSelection(...movement[event.key]); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [project, selectedControlId, selectedControlIds, activeWindowId]);

  useEffect(() => {
    const handlePointerFinished = () => finishPointerInteraction();
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') finishPointerInteraction();
    };
    window.addEventListener('mouseup', handlePointerFinished);
    window.addEventListener('blur', handlePointerFinished);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('mouseup', handlePointerFinished);
      window.removeEventListener('blur', handlePointerFinished);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [finishPointerInteraction]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!activeWindow || !selectedControlId || !selectedControl) return;
      if ((event.buttons & 1) === 0) {
        finishPointerInteraction();
        return;
      }

      if (isDragging) {
        const maxX = Math.max(0, activeWindow.width - selectedControl.width);
        const maxY = Math.max(0, activeWindow.height - windowContentOffset - selectedControl.height);
        const nextX = Math.max(0, Math.min(maxX, initialControlPos.x + (event.clientX - initialPos.x) / canvasScale));
        const nextY = Math.max(0, Math.min(maxY, initialControlPos.y + (event.clientY - initialPos.y) / canvasScale));

        scheduleControlInteractionPreview({
          windowId: activeWindow.id,
          controlId: selectedControlId,
          fields: {
            x: Math.round(nextX / 5) * 5,
            y: Math.round(nextY / 5) * 5
          }
        });
      }

      if (isResizing) {
        const deltaX = (event.clientX - initialPos.x) / canvasScale;
        const deltaY = (event.clientY - initialPos.y) / canvasScale;
        const minWidth = 20;
        const minHeight = 15;
        const maxCanvasX = activeWindow.width;
        const maxCanvasY = activeWindow.height - windowContentOffset;
        const originalRight = initialControlPos.x + initialSize.width;
        const originalBottom = initialControlPos.y + initialSize.height;
        const hasWest = resizeDirection.includes('w');
        const hasEast = resizeDirection.includes('e');
        const hasNorth = resizeDirection.includes('n');
        const hasSouth = resizeDirection.includes('s');
        let nextX = initialControlPos.x;
        let nextY = initialControlPos.y;
        let nextWidth = initialSize.width;
        let nextHeight = initialSize.height;

        if (hasEast) {
          nextWidth = Math.max(minWidth, Math.min(maxCanvasX - initialControlPos.x, initialSize.width + deltaX));
        }

        if (hasWest) {
          nextX = Math.max(0, Math.min(originalRight - minWidth, initialControlPos.x + deltaX));
          nextWidth = Math.max(minWidth, originalRight - nextX);
        }

        if (hasSouth) {
          nextHeight = Math.max(minHeight, Math.min(maxCanvasY - initialControlPos.y, initialSize.height + deltaY));
        }

        if (hasNorth) {
          nextY = Math.max(0, Math.min(originalBottom - minHeight, initialControlPos.y + deltaY));
          nextHeight = Math.max(minHeight, originalBottom - nextY);
        }

        scheduleControlInteractionPreview({
          windowId: activeWindow.id,
          controlId: selectedControlId,
          fields: {
            x: Math.round(nextX / 5) * 5,
            y: Math.round(nextY / 5) * 5,
            width: Math.round(nextWidth / 5) * 5,
            height: Math.round(nextHeight / 5) * 5
          }
        });
      }
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [
    activeWindow,
    canvasScale,
    finishPointerInteraction,
    initialPos,
    initialControlPos,
    initialSize,
    isDragging,
    isResizing,
    resizeDirection,
    scheduleControlInteractionPreview,
    selectedControl,
    selectedControlId,
    windowContentOffset
  ]);

  useEffect(() => {
    if (!draggingResourceId) return;
    const handleMouseMove = (event: MouseEvent) => {
      const placeholderWidth = 135;
      const placeholderHeight = 42;
      const nextX = Math.max(0, Math.min(activeWindow.width - placeholderWidth, (event.clientX - resourceDragOffset.x) / canvasScale));
      const nextY = Math.max(0, Math.min(activeWindow.height - windowContentOffset - placeholderHeight, (event.clientY - resourceDragOffset.y) / canvasScale));
      const preview = {
        resourceId: draggingResourceId,
        x: Math.round(nextX / 5) * 5,
        y: Math.round(nextY / 5) * 5
      };
      resourceInteractionPreviewRef.current = preview;
      pendingResourceInteractionPreviewRef.current = preview;
      if (interactionPreviewFrameRef.current === null) {
        interactionPreviewFrameRef.current = window.requestAnimationFrame(() => {
          interactionPreviewFrameRef.current = null;
          const pending = pendingResourceInteractionPreviewRef.current;
          pendingResourceInteractionPreviewRef.current = null;
          if (pending) applyResourceInteractionPreviewToDom(pending);
        });
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [activeWindow.height, activeWindow.width, applyResourceInteractionPreviewToDom, canvasScale, draggingResourceId, resourceDragOffset, windowContentOffset]);

  const handleBuildAndRunNative = useCallback(async () => {
    if (isNativeBuilding) {
      addLog(`> [${new Date().toLocaleTimeString()}] 【窗口运行】已有生成运行任务正在执行。`);
      return;
    }

    setIsNativeBuilding(true);
    notifyWindowDesignerBuildRunState({
      status: 'started',
      message: '窗口设计器正在生成、编译并运行 Win32 预览窗口'
    });
    addLog(`> [${new Date().toLocaleTimeString()}] 【窗口运行】开始导出当前窗口程序集并生成 Win32 C++ 工程...`);

    try {
      await ensureDesignerModuleAccess();
      const lingCppSource = requestWindowDesignerLingCppSource(
        activeWindowId,
        activeWindow?.fileName,
        activeWindow?.className
      );
      const response = await fetchWithSdkDependencies(() => fetch('/api/window-designer/build-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project,
          activeWindowId,
          lingCppSourceCode: lingCppSource.sourceCode,
          lingCppSourceFilePath: lingCppSource.filePath,
          lingCppSources: lingCppSource.sources,
          run: true
        })
      }));

      const result = await response.json();
      const logs: string[] = Array.isArray(result.logs) ? result.logs : [];
      window.dispatchEvent(new CustomEvent('lingbuilder-compiler-diagnostics', {
        detail: { diagnostics: Array.isArray(result.compilerDiagnostics) ? result.compilerDiagnostics : [] }
      }));

      logs.forEach(message => {
        addLog(`> [${new Date().toLocaleTimeString()}] ${message}`);
      });

      if (result.ok) {
        addLog(`> [${new Date().toLocaleTimeString()}] 【窗口运行】运行窗口已启动，界面由当前设计器模型生成。`);
        notifyWindowDesignerBuildRunState({
          status: 'completed',
          ok: true,
          stage: result.stage,
          message: '窗口设计器生成并运行完成'
        });
      } else {
        addLog(`> [${new Date().toLocaleTimeString()}] 【窗口运行】未能完成真实运行：${result.error || result.stage || '未知错误'}`);
        notifyWindowDesignerBuildRunState({
          status: 'failed',
          ok: false,
          stage: result.stage,
          message: result.error || result.stage || '窗口设计器生成运行失败'
        });
      }
    } catch (error: any) {
      addLog(`> [${new Date().toLocaleTimeString()}] 【窗口运行】请求失败：${error?.message || '无法连接本地构建服务'}`);
      notifyWindowDesignerBuildRunState({
        status: 'failed',
        ok: false,
        message: error?.message || '无法连接本地构建服务'
      });
    } finally {
      setIsNativeBuilding(false);
    }
  }, [activeWindowId, addLog, isNativeBuilding, project]);

  useEffect(() => {
    const handleBuildRunRequest = () => {
      void handleBuildAndRunNative();
    };

    window.addEventListener(WINDOW_DESIGNER_BUILD_RUN_REQUEST, handleBuildRunRequest);
    return () => {
      window.removeEventListener(WINDOW_DESIGNER_BUILD_RUN_REQUEST, handleBuildRunRequest);
    };
  }, [handleBuildAndRunNative]);

  if (!activeWindow) return null;

  const controlToolbox = (
    <DesignerControlToolbox
      isDarkMode={isDarkMode}
      useNewEmojiDesigner={useNewEmojiDesigner}
      search={controlToolboxSearch}
      normalizedSearch={normalizedControlToolboxSearch}
      groups={visibleControlToolboxGroups}
      expandedGroups={expandedControlToolboxGroups}
      newEmojiControls={newEmojiDesignerControls}
      enabledDesignerModules={enabledDesignerModules}
      onSearchChange={setControlToolboxSearch}
      onToggleGroup={toggleControlToolboxGroup}
      onAddControl={handleAddControl}
    />
  );

  const canvasBorder = resolveLingWindowBorder(activeWindow.borderStyle, activeWindow.maximizable !== false);
  const isFrameBorderStyle = activeWindow.borderStyle === 'frame-resizable' || activeWindow.borderStyle === 'frame-fixed';

  return (
    <div className={`flex-1 flex flex-col overflow-hidden font-sans ${isDarkMode ? 'bg-[#141418]' : 'bg-white'}`}>
      <div
        className={`flex items-center justify-between gap-3 px-4 py-2 shrink-0 select-none border-b ${
          isDarkMode ? 'bg-[#1a1a22] border-[#2d2d34]' : 'bg-slate-100 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <LayoutGrid className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="min-w-0">
            <div className={`text-xs font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
              多窗口可视化界面设计器
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {project.name} / {project.windows.length} 个窗口 / 当前：{activeWindow.fileName}
            </div>
          </div>
        </div>

        <div
          className={`flex items-center gap-1 p-0.5 rounded border overflow-x-auto max-w-[58vw] ${
            isDarkMode ? 'bg-[#25252b] border-slate-700/40' : 'bg-white border-slate-300'
          }`}
        >
          {project.windows.map(window => {
            const isActive = window.id === activeWindow.id;
            return (
              <button
                key={window.id}
                onClick={() => handleSelectWindow(window.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-600/90 text-white shadow-sm'
                    : isDarkMode
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title={window.description}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>{window.title}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { void handleAddWindow(); }}
            className={`p-1.5 rounded border cursor-pointer transition-colors ${
              isDarkMode
                ? 'bg-[#25252b] border-slate-700/40 text-emerald-400 hover:bg-[#30303a]'
                : 'bg-white border-slate-300 text-emerald-600 hover:bg-slate-100'
            }`}
            title="新建窗口"
            aria-label="新建窗口"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDuplicateWindow}
            className={`p-1.5 rounded border cursor-pointer transition-colors ${
              isDarkMode
                ? 'bg-[#25252b] border-slate-700/40 text-sky-400 hover:bg-[#30303a]'
                : 'bg-white border-slate-300 text-sky-600 hover:bg-slate-100'
            }`}
            title="复制当前窗口"
            aria-label="复制当前窗口"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDeleteWindow}
            className={`p-1.5 rounded border cursor-pointer transition-colors ${
              isDarkMode
                ? 'bg-[#25252b] border-red-900/40 text-red-400 hover:bg-red-950/30'
                : 'bg-white border-red-200 text-red-600 hover:bg-red-50'
            }`}
            title="删除当前窗口"
            aria-label="删除当前窗口"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {toolboxHost ? createPortal(controlToolbox, toolboxHost) : null}

        <div ref={canvasViewportRef} className={`wpf-designer-canvas-viewport flex-1 p-6 flex flex-col overflow-auto items-center justify-start relative select-none ${
          isDarkMode ? 'bg-[#101014]' : 'bg-slate-100/50'
        }`}>
          <div className="mb-2 flex w-full shrink-0 items-center justify-between gap-3 text-[10px] text-slate-500 select-none">
            <span className="truncate font-mono uppercase">
              [{activeWindow.fileName} / {activeWindow.width} x {activeWindow.height}]
            </span>
            <span className="hidden truncate xl:inline">拖拽控件移动，拖动八向控制点调整尺寸</span>
            <div className={`flex shrink-0 items-center gap-0.5 rounded border p-0.5 ${
              isDarkMode ? 'border-slate-700 bg-[#25252b]' : 'border-slate-300 bg-white'
            }`}>
              <button type="button" onClick={undoDesigner} title="撤销设计操作 Ctrl+Z" className="rounded px-1 py-0.5 hover:bg-slate-500/15">撤销</button><button type="button" onClick={redoDesigner} title="重做设计操作 Ctrl+Y" className="rounded px-1 py-0.5 hover:bg-slate-500/15">重做</button>
              {([['align-left','左齐'],['align-top','顶齐'],['align-right','右齐'],['align-bottom','底齐'],['align-hcenter','水平居中'],['align-vcenter','垂直居中'],['distribute-horizontal','横向分布'],['distribute-vertical','纵向分布'],['same-width','等宽'],['same-height','等高']] as Array<[DesignerLayoutOperation,string]>).map(([operation,label]) => <button key={operation} type="button" disabled={(operation === 'distribute-horizontal' || operation === 'distribute-vertical' ? selectedControlIds.length < 3 : selectedControlIds.length < 2)} title={(operation === 'distribute-horizontal' || operation === 'distribute-vertical') && selectedControlIds.length < 3 ? `${label}至少需要三个控件` : label} onClick={() => applyLayoutOperation(operation)} className="rounded px-1 py-0.5 hover:bg-slate-500/15 disabled:opacity-30">{label}</button>)}
              <button
                type="button"
                onClick={() => setCanvasZoom(canvasScale - 0.1)}
                className="rounded p-1 hover:bg-slate-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={canvasScale <= 0.25}
                title="缩小画布"
                aria-label="缩小画布"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomMode('fit')}
                className={`min-w-14 rounded px-1.5 py-1 font-sans font-semibold ${
                  zoomMode === 'fit' ? 'bg-blue-500/15 text-blue-400' : 'hover:bg-slate-500/15'
                }`}
                title="自动缩放并显示完整组件布局"
              >
                适应 · {Math.round(canvasScale * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setCanvasZoom(canvasScale + 0.1)}
                className="rounded p-1 hover:bg-slate-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={canvasScale >= 1.5}
                title="放大画布"
                aria-label="放大画布"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div
            ref={canvasFrameRef}
            className="relative shrink-0"
            style={{
              width: `${displayedWindowSize.width * canvasScale}px`,
              height: `${displayedWindowSize.height * canvasScale}px`,
              contain: 'layout paint size'
            }}
          >
            <div
              ref={canvasRef}
              id="wpf-design-canvas"
              onDoubleClick={handleCanvasDoubleClick}
              onContextMenu={openCanvasContextMenu}
              onPointerDownCapture={() => activeDesignerCommandTargetService.activate(`${projectId}:${designerInstanceId}`)}
              className="absolute left-0 top-0 shadow-2xl border-2 border-slate-700/60 overflow-hidden shrink-0 select-none"
              style={{
                width: `${displayedWindowSize.width}px`,
                height: `${displayedWindowSize.height}px`,
                boxSizing: 'border-box',
                contain: 'layout paint size',
                transform: `scale(${canvasScale})`,
                transformOrigin: 'top left',
                backgroundColor: useNewEmojiDesigner ? newEmojiThemePreview.panelBackground : activeWindow.background,
                backgroundImage: useNewEmojiDesigner
                  ? `radial-gradient(circle at 1px 1px, ${newEmojiThemePreview.mode === 'dark' ? 'rgba(148,163,184,0.18)' : 'rgba(71,85,105,0.16)'} 0.8px, transparent 0.9px)`
                  : isDarkMode
                    ? 'radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.34) 0.85px, transparent 0.95px)'
                    : 'radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.24) 0.85px, transparent 0.95px)',
                backgroundSize: '12px 12px',
                backgroundPosition: '0 0',
                borderRadius: activeWindow.cornerStyle === 'square'
                  ? '0'
                  : activeWindow.cornerStyle === 'small-rounded' ? '4px' : '8px',
                ...(isFrameBorderStyle ? { outline: '3px double #9ca3af', outlineOffset: '-1px' } : {})
              }}
              onClick={() => {
                selectOnlyControl(null);
                setActiveInspectorTab('properties');
              }}
            >
            {/* Window Resize Handles */}
            <div
              data-designer-window-resize-handle="true"
              onMouseDown={e => startResizeWindow(e, 'r')}
              className="absolute right-[-4px] top-0 w-[8px] h-full cursor-col-resize z-50 hover:bg-blue-500/20"
            />
            <div
              data-designer-window-resize-handle="true"
              onMouseDown={e => startResizeWindow(e, 'b')}
              className="absolute left-0 bottom-[-4px] w-full h-[8px] cursor-row-resize z-50 hover:bg-blue-500/20"
            />
            <div
              data-designer-window-resize-handle="true"
              onMouseDown={e => startResizeWindow(e, 'se')}
              className="absolute right-[-6px] bottom-[-6px] w-[12px] h-[12px] cursor-se-resize z-51 rounded-full bg-blue-500 border border-white hover:scale-125 transition-transform"
            />
            {canvasBorder.hasCaption && (
            <div
              className={`${canvasBorder.captionKind === 'thin' ? 'h-5' /* thin=DESIGNER_THIN_TITLE_BAR_HEIGHT(20px) */ : 'h-7'} flex items-center justify-between px-3 border-b border-black/25 select-none canvas-title-bar`}
              style={{
                backgroundColor: useNewEmojiDesigner
                  ? newEmojiThemePreview.titleBarBackground
                  : activeWindow.titleBarBackground || DEFAULT_WINDOW_TITLE_BAR_BACKGROUND,
                color: useNewEmojiDesigner
                  ? newEmojiThemePreview.titleBarForeground
                  : activeWindow.titleBarForeground || DEFAULT_WINDOW_TITLE_BAR_FOREGROUND
              }}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-sans font-medium min-w-0">
                {(activeWindow.iconStyle || DEFAULT_WINDOW_ICON_STYLE) === 'custom' && activeWindow.iconPath ? (
                  <img src={getDesignerImagePreviewSource(projectId, activeWindow.iconPath)} alt="窗口图标" className="h-3.5 w-3.5 shrink-0 object-contain" />
                ) : (activeWindow.iconStyle || DEFAULT_WINDOW_ICON_STYLE) === 'lingbuilder' ? (
                  <img src={LINGBUILDER_WINDOW_ICON_PREVIEW} alt="LingBuilder 窗口图标" className="h-3.5 w-3.5 shrink-0 object-contain" />
                ) : (activeWindow.iconStyle || DEFAULT_WINDOW_ICON_STYLE) !== 'none' ? (
                  <Monitor className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : null}
                <span className="truncate">{activeWindow.title}</span>
              </div>
              <div className="flex items-center gap-1 opacity-60">
                <Minus className="w-3 h-3" />
                <Maximize2 className={`w-3 h-3 ${activeWindow.maximizable === false ? 'opacity-25' : ''}`} />
                <X className="w-3 h-3" />
              </div>
            </div>
            )}
            {/* Menu Bar (Simulating native Win32 window menu bar) */}
            {hasDesignerWindowMenu(activeWindow) && <div
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onContextMenu={(event) => openControlContextMenu(event, '__window_menu_bar__')}
              onClick={(e) => {
                e.stopPropagation();
                selectOnlyControl('__window_menu_bar__');
                setActiveInspectorTab('properties');
                setIsMenuDropdownOpen(prev => !prev);
              }}
              className={`h-6 px-3 flex items-center border-b select-none text-[10.5px] font-sans cursor-pointer transition-colors ${
                isDarkMode 
                  ? 'bg-[#1E1E1E] text-slate-300 border-slate-800/80 hover:bg-slate-800/60' 
                  : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
              } ${isWindowMenuInteractionActive ? 'ring-1 ring-amber-500 z-50 relative' : ''}`}
              style={{
                ...getControlFontCssStyle({
                  fontFamily: activeWindow.menuFontFamily,
                  fontSize: activeWindow.menuFontSize ?? 11,
                  fontBold: activeWindow.menuFontBold,
                  fontItalic: activeWindow.menuFontItalic,
                  fontUnderline: activeWindow.menuFontUnderline
                }),
                backgroundColor: activeWindow.menuBackground || '#ffffff',
                color: activeWindow.menuForeground || '#000000'
              }}
            >
              <div className="relative">
                <span style={{ color: activeWindow.menuForeground || '#000000' }} className={`px-2 py-0.5 rounded transition-colors ${
                  isDarkMode ? 'hover:bg-slate-700/50 text-slate-300' : 'hover:bg-slate-200 text-slate-850'
                }`}>
                  窗口(W)
                </span>
                {/* Dropdown Menu listing all window menu items */}
                {isMenuDropdownOpen && (
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onMouseUp={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    style={{
                      backgroundColor: activeWindow.menuBackground || '#ffffff',
                      color: activeWindow.menuForeground || '#000000'
                    }}
                    className={`absolute left-0 top-5 w-48 flex flex-col py-1 border rounded shadow-lg z-[99] pointer-events-auto ${
                    isDarkMode 
                      ? 'bg-[#252526] border-[#3c3c3c] text-slate-200' 
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                  >
                    {(activeWindow.menuItems || '关于太空冒险客户端, 太空冒险安全账户登录, 关联设计文件')
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean)
                      .map((item, idx) => {
                        const isItemSelected = selectedControlId === `__window_menu_item_${idx}__`;
                        return (
                          <div
                            key={idx}
                            onContextMenu={(event) => openControlContextMenu(event, `__window_menu_item_${idx}__`)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onMouseUp={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              selectOnlyControl(`__window_menu_item_${idx}__`);
                              setActiveInspectorTab('properties');
                            }}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const handlerName = activeWindow.menuEvents?.[`Item_${idx}`] || `_${activeWindow.className}_${item}_被选择`;
                              handleControlDoubleClick(e, {
                                id: `__window_menu_item_${idx}__`,
                                type: 'MenuItem' as any,
                                name: item,
                                events: { 'Select': handlerName }
                              } as any);
                              setIsMenuDropdownOpen(false);
                            }}
                            className={`px-3 py-1.5 flex items-center justify-between cursor-pointer text-[10.5px] transition-colors ${
                              isItemSelected
                                ? 'bg-amber-600/90 text-white font-bold'
                                : isDarkMode 
                                  ? 'hover:bg-[#007ACC] hover:text-white' 
                                  : 'hover:bg-[#007ACC] hover:text-white'
                            }`}
                          >
                            <span className="truncate">{item}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>}

            {designerPaintControls.map(control => {
              const effectiveState = effectiveControlStates.get(control.id) || { visible: true, enabled: true };
              const ancestorsVisible = !control.parentId
                || (effectiveControlStates.get(control.parentId)?.visible ?? true);
              return (
                <MemoizedDesignerControl
                  key={control.id}
                  control={control}
                  projectId={projectId}
                  isSelected={selectedControlIds.includes(control.id)}
                  handleMouseDown={stableHandleMouseDown}
                  setSelectedControlId={setSelectedControlId}
                  onOpenEventCode={stableHandleControlDoubleClick}
                  onOpenContextMenu={stableOpenControlContextMenu}
                  contentOffset={windowContentOffset}
                  useNewEmojiDesigner={useNewEmojiDesigner}
                  newEmojiThemePreview={newEmojiThemePreview}
                  isEffectivelyVisible={effectiveState.visible}
                  isEffectivelyEnabled={effectiveState.enabled}
                  ancestorsVisible={ancestorsVisible && (selectedTabVisibility.get(control.id) ?? true)}
                  onSelectTabPage={isTabContainerControl(control) ? pageId => stableHandleSelectTabPage(control.id, pageId) : undefined}
                  onReorderRebarBand={control.type === 'ReBar' ? (fromIndex, toIndex) => stableHandleReorderRebarBand(control.id, fromIndex, toIndex) : undefined}
                  navigationRef={registerDesignerNavigationTarget('control', control.id)}
                />
              );
            })}
            {activeFileDialogs.map((resource, index) => {
              const position = getDisplayedResourcePosition(resource, getFileDialogDesignerPosition(resource, index));
              const selected = selectedResourceId === resource.id;
              return (
                <div
                  key={resource.id}
                  ref={registerDesignerNavigationTarget('resource', resource.id)}
                  data-designer-resource-id={resource.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`文件对话框占位：${resource.name}`}
                  aria-pressed={selected}
                  onContextMenu={event => openResourceContextMenu(event, resource.id)}
                  onMouseDown={event => handleFileDialogMouseDown(event, resource, index)}
                  onClick={event => {
                    event.stopPropagation();
                    setSelectedControlId(null);
                    setSelectedControlIds([]);
                    setSelectedResourceId(resource.id);
                    setActiveInspectorTab('properties');
                  }}
                  onKeyDown={event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setSelectedControlId(null);
                    setSelectedControlIds([]);
                    setSelectedResourceId(resource.id);
                    setActiveInspectorTab('properties');
                  }}
                  className={`absolute z-30 flex cursor-move items-center gap-2 rounded border border-dashed px-2 shadow-md select-none ${
                    selected
                      ? 'border-emerald-300 bg-emerald-500/25 ring-2 ring-emerald-400'
                      : isDarkMode
                        ? 'border-emerald-500/70 bg-[#12352d] hover:bg-emerald-500/20'
                        : 'border-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                  style={{
                    left: `${position.x}px`,
                    top: `${position.y + windowContentOffset}px`,
                    width: '135px',
                    height: '42px'
                  }}
                  title="设计期非可视组件：单击编辑属性，拖拽移动占位"
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span className="min-w-0 leading-tight">
                    <span className={`block truncate text-[10px] font-semibold ${isDarkMode ? 'text-emerald-100' : 'text-emerald-900'}`}>{resource.name}</span>
                    <span className={`block text-[8px] ${isDarkMode ? 'text-emerald-300/75' : 'text-emerald-700'}`}>文件对话框 · 非可视</span>
                  </span>
                </div>
              );
            })}
            {activeMenuResources.map((resource, index) => {
              const position = getDisplayedResourcePosition(resource, getMenuResourceDesignerPosition(resource, index));
              const selected = selectedResourceId === resource.id;
              const isContext = resource.type === 'ContextMenu';
              return (
                <div
                  key={resource.id}
                  ref={registerDesignerNavigationTarget('resource', resource.id)}
                  data-designer-resource-id={resource.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${isContext ? '上下文菜单' : '弹出菜单'}占位：${resource.name}`}
                  aria-pressed={selected}
                  onContextMenu={event => openResourceContextMenu(event, resource.id)}
                  onMouseDown={event => handleMenuResourceMouseDown(event, resource, index)}
                  onClick={event => {
                    event.stopPropagation();
                    setSelectedControlId(null);
                    setSelectedControlIds([]);
                    setSelectedResourceId(resource.id);
                    setActiveInspectorTab('properties');
                  }}
                  onKeyDown={event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setSelectedControlId(null);
                    setSelectedControlIds([]);
                    setSelectedResourceId(resource.id);
                    setActiveInspectorTab('properties');
                  }}
                  className={`absolute z-30 flex cursor-move items-center gap-2 rounded border border-dashed px-2 shadow-md select-none ${
                    selected
                      ? 'border-amber-300 bg-amber-500/25 ring-2 ring-amber-400'
                      : isDarkMode
                        ? 'border-amber-500/70 bg-[#3a2c12] hover:bg-amber-500/20'
                        : 'border-amber-600 bg-amber-50 hover:bg-amber-100'
                  }`}
                  style={{ left: `${position.x}px`, top: `${position.y + windowContentOffset}px`, width: '135px', height: '42px' }}
                  title="设计期非可视菜单：单击编辑属性，拖拽移动占位"
                >
                  <Menu className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                  <span className="min-w-0 leading-tight">
                    <span className={`block truncate text-[10px] font-semibold ${isDarkMode ? 'text-amber-100' : 'text-amber-900'}`}>{resource.name}</span>
                    <span className={`block text-[8px] ${isDarkMode ? 'text-amber-300/75' : 'text-amber-700'}`}>{isContext ? '上下文菜单' : '弹出菜单'} · 非可视</span>
                  </span>
                </div>
              );
            })}
            </div>
            <div
              ref={canvasResizePreviewRef}
              aria-hidden="true"
              className={`pointer-events-none absolute left-0 top-0 z-[60] border-2 border-dashed ${isDarkMode ? 'border-sky-300/90' : 'border-sky-600/90'}`}
              style={{
                display: 'none',
                boxSizing: 'border-box',
                backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.06)' : 'rgba(14, 165, 233, 0.06)'
              }}
            />
          </div>
        </div>

        <div className="relative z-20 flex w-[4px] shrink-0 items-center justify-center">
          <div
            onMouseDown={startResizeInspector}
            className={`h-full w-full cursor-col-resize transition-colors hover:bg-blue-500/50 ${
              isDarkMode ? 'bg-[#2d2d34]' : 'bg-slate-200'
            }`}
            style={{ cursor: 'col-resize' }}
          />
          <button
            type="button"
            onClick={() => setIsInspectorCollapsed(previous => !previous)}
            onMouseDown={event => event.stopPropagation()}
            className="group absolute left-1/2 top-1/2 flex h-12 w-[16px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border border-[#444] bg-[#2d2d36] opacity-60 shadow-lg transition-all hover:scale-105 hover:border-blue-500/60 hover:bg-[#3a3a45] active:bg-[#4a4a58]"
            title={isInspectorCollapsed ? '展开右侧属性面板' : '折叠右侧属性面板'}
            aria-label={isInspectorCollapsed ? '展开右侧属性面板' : '折叠右侧属性面板'}
            aria-expanded={!isInspectorCollapsed}
          >
            {isInspectorCollapsed ? (
              <ChevronLeft className="h-3 w-3 text-amber-500 transition-transform group-hover:scale-110 group-hover:text-amber-400" />
            ) : (
              <ChevronRight className="h-3 w-3 text-slate-400 transition-transform group-hover:text-blue-400" />
            )}
          </button>
        </div>
        <div
          style={{ width: isInspectorCollapsed ? 0 : `${inspectorWidth}px` }}
          aria-hidden={isInspectorCollapsed}
          className={`flex shrink-0 select-none flex-col overflow-hidden border-l transition-[width] duration-150 ${
            isDarkMode ? 'bg-[#1a1a20] border-[#2d2d34]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className={`p-2.5 border-b flex items-center justify-between ${
            isDarkMode ? 'border-[#2d2d34] bg-[#22222a]/30' : 'border-slate-200 bg-slate-100/60'
          }`}>
            <Layers className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
            <div className={`flex p-0.5 rounded border ${isDarkMode ? 'bg-[#2a2a34] border-[#3e3e4a]' : 'bg-slate-200 border-slate-300'}`}>
              <IconTabButton active={activeInspectorTab === 'properties'} isDarkMode={isDarkMode} onClick={() => setActiveInspectorTab('properties')} title="属性">
                <Wrench className="w-3.5 h-3.5" />
                <span>属性</span>
              </IconTabButton>
              <IconTabButton active={activeInspectorTab === 'events'} isDarkMode={isDarkMode} onClick={() => setActiveInspectorTab('events')} title="事件">
                <Zap className="w-3.5 h-3.5" />
                <span>事件</span>
              </IconTabButton>
              <IconTabButton active={activeInspectorTab === 'layout'} isDarkMode={isDarkMode} onClick={() => setActiveInspectorTab('layout')} title="布局内容">
                <ListTree className="w-3.5 h-3.5" />
                <span>布局</span>
              </IconTabButton>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {activeInspectorTab === 'properties' && (
              selectedFileDialog ? (
                <FileDialogProperties
                  resource={selectedFileDialog}
                  windows={project.windows}
                  isDarkMode={isDarkMode}
                  onChange={fields => setProject(previous => ({
                    ...previous,
                    resources: (previous.resources || []).map(resource => resource.id === selectedFileDialog.id && resource.type === 'FileDialog'
                      ? { ...resource, ...fields }
                      : resource)
                  }))}
                  onDelete={() => {
                    setProject(previous => ({ ...previous, resources: (previous.resources || []).filter(resource => resource.id !== selectedFileDialog.id) }));
                    setSelectedResourceId(null);
                  }}
                />
              ) : selectedMenuResource ? (
                <MenuResourceProperties
                  resource={selectedMenuResource}
                  windows={project.windows}
                  isDarkMode={isDarkMode}
                  onChange={fields => setProject(previous => ({
                    ...previous,
                    resources: (previous.resources || []).map(resource => resource.id === selectedMenuResource.id && (resource.type === 'ContextMenu' || resource.type === 'PopupMenu')
                      ? { ...resource, ...fields }
                      : resource)
                  }))}
                  onDelete={() => {
                    setProject(previous => ({ ...previous, resources: (previous.resources || []).filter(resource => resource.id !== selectedMenuResource.id) }));
                    setSelectedResourceId(null);
                  }}
                />
              ) : <>
                <ImageListResourceEditor
                  resources={(project.resources || []).filter((resource): resource is LingImageListResource => resource.type === 'ImageList')}
                  isDarkMode={isDarkMode}
                  onChange={resources => setProject(previous => ({ ...previous, resources: [...(previous.resources || []).filter(resource => resource.type !== 'ImageList'), ...resources] }))}
                  revealResourceId={selectedResourceId}
                  registerNavigationTarget={registerDesignerNavigationTarget}
                />
                <BehaviorResourceEditor
                  resources={project.resources || []}
                  windows={project.windows}
                  activeWindow={activeWindow}
                  isDarkMode={isDarkMode}
                  onChange={resources => setProject(previous => ({ ...previous, resources }))}
                  registerNavigationTarget={registerDesignerNavigationTarget}
                />
                {selectedControlId === null ? (
                  <WindowProperties
                    projectId={projectId}
                    window={activeWindow}
                    isDarkMode={isDarkMode}
                    newEmojiAvailable={newEmojiModuleEnabled}
                    onChange={fields => {
                      if (fields.designerBackend === 'new-emoji') {
                        void ensureDesignerModuleAccess(true)
                          .then(() => updateActiveWindow(window => ({ ...window, ...fields })))
                          .catch(error => addLog(`> 【模块授权】${error instanceof Error ? error.message : String(error)}`));
                        return;
                      }
                      updateActiveWindow(window => ({ ...window, ...fields }));
                    }}
                  />
                ) : (
                  <ControlProperties
                    projectId={projectId}
                    control={selectedControl}
                    controls={activeWindow.controls}
                    imageLists={(project.resources || []).filter((resource): resource is LingImageListResource => resource.type === 'ImageList')}
                    isDarkMode={isDarkMode}
                    moduleControl={selectedModuleControl}
                    onChange={fields => {
                      if (!selectedModuleControl) { updateSelectedControl(fields); return; }
                      void ensureDesignerModuleAccess()
                        .then(() => updateSelectedControl(fields))
                        .catch(error => addLog(`> 【模块授权】${error instanceof Error ? error.message : String(error)}`));
                    }}
                    onTabPagesChange={updateTabControlPages}
                    edgePreviewState={edgeControlPreview}
                    onPreviewEdge={() => void executeDesignerCommand('designer.edgeview.previewControl')}
                    onStopEdgePreview={() => void stopEdgeControlPreview()}
                    onDelete={handleDeleteControl}
                  />
                )}
              </>
            )}

            {activeInspectorTab === 'events' && (
              selectedFileDialog ? (
                <FileDialogEvents
                  resource={selectedFileDialog}
                  windowModel={activeWindow}
                  isDarkMode={isDarkMode}
                  onChange={fields => setProject(previous => ({
                    ...previous,
                    resources: (previous.resources || []).map(resource => resource.id === selectedFileDialog.id && resource.type === 'FileDialog'
                      ? { ...resource, ...fields }
                      : resource)
                  }))}
                />
              ) : selectedMenuResource ? (
                <MenuResourceEvents
                  resource={selectedMenuResource}
                  windowModel={activeWindow}
                  isDarkMode={isDarkMode}
                  onChange={items => setProject(previous => ({
                    ...previous,
                    resources: (previous.resources || []).map(resource => resource.id === selectedMenuResource.id && (resource.type === 'ContextMenu' || resource.type === 'PopupMenu')
                      ? { ...resource, items }
                      : resource)
                  }))}
                />
              ) : selectedControlId === null ? (
                <WindowEvents
                  window={activeWindow}
                  isDarkMode={isDarkMode}
                  onChange={events => updateActiveWindow(window => ({ ...window, events }))}
                />
              ) : (
                <ControlEvents
                  control={selectedControl}
                  moduleControl={selectedModuleControl}
                  windowModel={activeWindow}
                  isDarkMode={isDarkMode}
                  onChange={async fields => {
                    try {
                      if (selectedModuleControl) await ensureDesignerModuleAccess();
                      if (!selectedControlId) return;
                      commitControlFieldsImmediately(selectedControlId, fields);
                    } catch (error) {
                      addLog(`> 【模块授权】${error instanceof Error ? error.message : String(error)}`);
                      throw error;
                    }
                  }}
                />
              )
            )}

            {activeInspectorTab === 'layout' && (
              <LayoutHierarchy
                window={activeWindow}
                selectedControlId={selectedControlId}
                selectedControlIds={selectedControlIds}
                isDarkMode={isDarkMode}
                onSelectControls={(controlIds, primaryControlId) => {
                  setSelectedControlIds(controlIds);
                  setSelectedControlId(primaryControlId);
                  if (primaryControlId === null) setActiveInspectorTab('properties');
                }}
                onSelectTabPage={handleSelectTabPage}
                onReparentControls={handleReparentControls}
              />
            )}
          </div>
        </div>
      </div>

      {controlContextMenu && (
        <WorkbenchContextMenu
          x={controlContextMenu.x}
          y={controlContextMenu.y}
          items={resolvedContextMenuItems}
          isDarkMode={isDarkMode}
          ariaLabel={controlContextMenu.menuId === DESIGNER_CANVAS_CONTEXT_MENU ? '设计画布快捷菜单' : '控件快捷菜单'}
          onExecute={executeContextMenuItem}
          onClose={() => setControlContextMenu(null)}
        />
      )}
    </div>
  );
}

interface DesignerControlToolboxProps {
  isDarkMode: boolean;
  useNewEmojiDesigner: boolean;
  search: string;
  normalizedSearch: string;
  groups: ControlToolboxGroup[];
  expandedGroups: ControlToolboxExpansionState;
  newEmojiControls: ModuleDesignerControlContribution[];
  enabledDesignerModules: Set<string>;
  onSearchChange: (value: string) => void;
  onToggleGroup: (groupId: ControlToolboxGroupId) => void;
  onAddControl: (type: LingControlType, moduleControl?: ModuleDesignerControlContribution) => void | Promise<void>;
}

function DesignerControlToolbox({
  isDarkMode,
  useNewEmojiDesigner,
  search,
  normalizedSearch,
  groups,
  expandedGroups,
  newEmojiControls,
  enabledDesignerModules,
  onSearchChange,
  onToggleGroup,
  onAddControl
}: DesignerControlToolboxProps) {
  const toolboxId = useId();

  return (
    <div className="space-y-2 p-2" data-designer-control-toolbox>
      <p className={`px-1 text-[10px] leading-relaxed ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
        点击控件即可添加到当前窗口，随后可在画布中拖拽、改尺寸、绑定中文事件。
      </p>
      <label className={`flex h-7 items-center gap-1.5 rounded border px-2 focus-within:ring-1 focus-within:ring-blue-500/70 ${
        isDarkMode ? 'border-[#34343c] bg-[#141419] text-slate-400' : 'border-slate-300 bg-white text-slate-500'
      }`}>
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="sr-only">搜索控件</span>
        <input
          type="search"
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          placeholder="搜索控件…"
          aria-label="搜索全部控件分组"
          className={`min-w-0 flex-1 bg-transparent text-[11px] outline-none ${
            isDarkMode ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-800 placeholder:text-slate-400'
          }`}
        />
      </label>

      <div className="space-y-1" aria-label="控件分组">
        {groups.map(group => {
          const isNewEmojiGroup = group.id === 'new-emoji';
          const moduleControls = isNewEmojiGroup && useNewEmojiDesigner
            ? newEmojiControls.filter(control => !normalizedSearch || [control.label, control.type, control.category].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN').includes(normalizedSearch))
            : [];
          const displayedControlCount = moduleControls.length || group.controlTypes.length;
          const groupAvailable = !isNewEmojiGroup || enabledDesignerModules.has(NEW_EMOJI_MODULE_ID);
          const expanded = normalizedSearch.length > 0 || expandedGroups[group.id];
          const groupContentId = `${toolboxId}-${group.id}`;
          const groupIcon = group.id === 'basic'
            ? <LayoutGrid className="h-3.5 w-3.5 text-blue-400" />
            : group.id === 'advanced'
              ? <Zap className="h-3.5 w-3.5 text-violet-400" />
              : group.id === 'browser'
                ? <Globe className="h-3.5 w-3.5 text-sky-400" />
                : <Palette className="h-3.5 w-3.5 text-fuchsia-400" />;

          return (
            <section key={group.id} className={`overflow-hidden rounded border ${
              isDarkMode ? 'border-[#303038] bg-[#17171c]' : 'border-slate-200 bg-white'
            }`}>
              <button
                type="button"
                onClick={() => onToggleGroup(group.id)}
                aria-expanded={expanded}
                aria-controls={groupContentId}
                title={groupAvailable ? group.description : '当前项目未启用 lingbuilder.new_emoji.ui 模块'}
                className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] font-medium outline-none transition-colors focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                  isDarkMode ? 'text-slate-300 hover:bg-[#25252b] hover:text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {expanded
                  ? <ChevronDown className="h-3 w-3 shrink-0 text-slate-500" aria-hidden="true" />
                  : <ChevronRight className="h-3 w-3 shrink-0 text-slate-500" aria-hidden="true" />}
                {groupIcon}
                <span className="min-w-0 flex-1 truncate">{group.label}</span>
                {!groupAvailable && <span className="rounded border border-slate-500/30 px-1 py-0.5 text-[8px] font-normal text-slate-500">未启用</span>}
                <span className={`min-w-5 rounded px-1 py-0.5 text-center font-mono text-[9px] font-normal ${
                  isDarkMode ? 'bg-[#2b2b32] text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}>{displayedControlCount}</span>
              </button>
              {expanded && (
                <div id={groupContentId} className={`grid grid-cols-1 gap-0.5 border-t p-1 ${
                  isDarkMode ? 'border-[#2d2d34]' : 'border-slate-200'
                }`}>
                  {moduleControls.length > 0 ? moduleControls.map(control => {
                    const previewType = (control.previewType || control.type) as LingControlType;
                    return <button
                      key={control.namespacedType || control.type}
                      type="button"
                      onClick={() => { void onAddControl(previewType, control); }}
                      title={`添加 ${control.label}`}
                      aria-label={`添加 ${control.label}`}
                      className={`flex items-center gap-2 rounded border border-transparent px-2 py-1.5 text-left text-[11px] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-fuchsia-500 ${isDarkMode ? 'text-slate-300 hover:border-[#3c3c44] hover:bg-[#25252b]/80 hover:text-white' : 'text-slate-700 hover:border-slate-200 hover:bg-slate-100'}`}
                    >
                      {getControlIcon(previewType)}
                      <span className="min-w-0 flex-1 truncate">{control.label}</span>
                      <span className="text-[8px] text-fuchsia-400">NE</span>
                    </button>;
                  }) : group.controlTypes.length === 0 ? (
                    <div className="px-2 py-2 text-[10px] leading-relaxed text-slate-500">
                      {isNewEmojiGroup && !groupAvailable ? '请先在当前项目中启用 New_Emoji 模块。' : '此分组暂无可用控件。'}
                    </div>
                  ) : group.controlTypes.map(type => {
                    const definition = getWin32ControlDefinition(type);
                    const moduleEnabled = !definition || enabledDesignerModules.has(definition.moduleId);
                    const backendSupported = !useNewEmojiDesigner || isNewEmojiDesignerControlSupported(type);
                    const enabled = moduleEnabled && backendSupported;
                    const disabledReason = !moduleEnabled
                      ? getControlToolboxModuleDisabledMessage(definition?.moduleId)
                      : `new_emoji 设计后端暂不支持 ${CONTROL_LABELS[type]}`;
                    return <button
                      key={type}
                      type="button"
                      onClick={() => { void onAddControl(type); }}
                      disabled={!enabled}
                      title={enabled ? `添加${isNewEmojiGroup ? 'New_Emoji ' : ''}${CONTROL_LABELS[type]}` : disabledReason}
                      aria-label={enabled ? `添加${CONTROL_LABELS[type]}` : disabledReason}
                      className={`flex items-center gap-2 rounded border px-2 py-1.5 text-left text-[11px] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-blue-500 ${
                        !enabled ? 'cursor-not-allowed opacity-45 ' : 'cursor-pointer '
                      }${
                        isDarkMode
                          ? 'border-transparent text-slate-300 hover:border-[#3c3c44] hover:bg-[#25252b]/80 hover:text-white'
                          : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {getControlIcon(type)}
                      <span className="min-w-0 flex-1 truncate">{CONTROL_LABELS[type]} ({type})</span>
                      {isNewEmojiGroup && <span className="text-[8px] text-fuchsia-300">NE</span>}
                    </button>;
                  })}
                </div>
              )}
            </section>
          );
        })}
        {groups.length === 0 && (
          <div role="status" className={`rounded border px-2 py-3 text-center text-[10px] ${
            isDarkMode ? 'border-[#303038] bg-[#17171c] text-slate-500' : 'border-slate-200 bg-white text-slate-500'
          }`}>
            没有找到“{search.trim()}”相关控件
          </div>
        )}
      </div>
    </div>
  );
}

function LayoutHierarchy({
  window,
  selectedControlId,
  selectedControlIds,
  isDarkMode,
  onSelectControls,
  onSelectTabPage,
  onReparentControls
}: {
  window: LingWindowModel;
  selectedControlId: string | null;
  selectedControlIds: string[];
  isDarkMode: boolean;
  onSelectControls: (controlIds: string[], primaryControlId: string | null) => void;
  onSelectTabPage: (tabControlId: string, pageId: string) => void;
  onReparentControls: (controlIds: string[], parentId?: string, containerSlot?: string) => void;
}) {
  const hierarchy = useMemo(() => buildControlHierarchy(window.controls), [window.controls]);
  const hierarchySignature = window.controls.map(control => `${control.id}:${control.parentId || ''}`).join('|');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set([window.id]));
  const [draggedControlIds, setDraggedControlIds] = useState<string[]>([]);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [invalidDropTargetId, setInvalidDropTargetId] = useState<string | null>(null);
  const [dragFeedback, setDragFeedback] = useState('');
  const selectionAnchorRef = useRef<string | null>(selectedControlId);
  const menuItems = (window.menuItems || '').split(',').map(item => item.trim()).filter(Boolean);
  const controlTreeOrder = useMemo(() => {
    const orderedIds: string[] = [];
    const appendNodes = (nodes: LingControlHierarchyNode[]) => {
      nodes.forEach(node => {
        orderedIds.push(node.control.id);
        if (!expandedIds.has(node.control.id)) return;
        const tabPages = isTabContainerControl(node.control) ? getTabControlPages(node.control) : [];
        if (tabPages.length > 0) {
          tabPages.forEach(page => {
            const pageTreeId = `${node.control.id}:${page.id}`;
            if (expandedIds.has(pageTreeId)) {
              appendNodes(node.children.filter(child => getControlTabSlot(child.control, node.control) === page.id));
            }
          });
        } else {
          appendNodes(node.children);
        }
      });
    };
    appendNodes(hierarchy);
    return orderedIds;
  }, [expandedIds, hierarchy]);

  useEffect(() => {
    const parentIds = window.controls
      .filter(control => window.controls.some(item => item.parentId === control.id))
      .map(control => control.id);
    const tabPageIds = window.controls.flatMap(control => isTabContainerControl(control)
      ? getTabControlPages(control)
        .filter(page => window.controls.some(child => child.parentId === control.id && getControlTabSlot(child, control) === page.id))
        .map(page => `${control.id}:${page.id}`)
      : []);
    setExpandedIds(previous => new Set([...previous, window.id, ...parentIds, ...tabPageIds]));
  }, [hierarchySignature, window.id]);

  const toggleExpanded = (id: string) => {
    setExpandedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getRowClassName = (selected: boolean, isDropTarget = false, isInvalidDropTarget = false) => `group flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 text-left text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-sky-400 ${
    isDropTarget
      ? isDarkMode ? 'bg-emerald-900/70 text-emerald-100 ring-1 ring-inset ring-emerald-400' : 'bg-emerald-100 text-emerald-950 ring-1 ring-inset ring-emerald-500'
      : isInvalidDropTarget
      ? isDarkMode ? 'bg-red-950/70 text-red-100 ring-1 ring-inset ring-red-500' : 'bg-red-100 text-red-950 ring-1 ring-inset ring-red-500'
      : selected
      ? isDarkMode ? 'bg-[#094771] text-white' : 'bg-blue-100 text-blue-900'
      : isDarkMode ? 'text-slate-300 hover:bg-[#2a2d2e]' : 'text-slate-700 hover:bg-slate-100'
  }`;

  const readDraggedControlIds = (event: React.DragEvent) => {
    if (draggedControlIds.length > 0) return draggedControlIds;
    const serializedIds = event.dataTransfer.getData('application/x-lingbuilder-control-ids');
    if (serializedIds) {
      try {
        const parsedIds = JSON.parse(serializedIds);
        if (Array.isArray(parsedIds)) return parsedIds.filter((id): id is string => typeof id === 'string');
      } catch {
        // 兼容旧的单控件拖拽数据。
      }
    }
    const controlId = event.dataTransfer.getData('application/x-lingbuilder-control-id')
      || event.dataTransfer.getData('text/plain');
    return controlId ? [controlId] : [];
  };

  const canDropOnParent = (controlIds: string[], parentId?: string, containerSlot?: string) => {
    if (!canReparentControls(window.controls, controlIds, parentId, containerSlot)) return false;
    if (!parentId) return true;
    const target = window.controls.find(control => control.id === parentId);
    return Boolean(target && getWin32ControlDefinition(target.type)?.isContainer);
  };

  const handleDragStart = (event: React.DragEvent, controlId: string) => {
    event.stopPropagation();
    const controlIds = selectedControlIds.includes(controlId) ? selectedControlIds : [controlId];
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-lingbuilder-control-id', controlId);
    event.dataTransfer.setData('application/x-lingbuilder-control-ids', JSON.stringify(controlIds));
    event.dataTransfer.setData('text/plain', controlId);
    setDraggedControlIds(controlIds);
    setDropTargetId(null);
    setInvalidDropTargetId(null);
    setDragFeedback(`正在拖动 ${controlIds.length} 个控件`);
    selectionAnchorRef.current = controlId;
    onSelectControls(controlIds, controlId);
  };

  const handleDragOver = (event: React.DragEvent, parentId?: string, containerSlot?: string) => {
    const controlIds = readDraggedControlIds(event);
    const targetId = containerSlot ? `${parentId}:${containerSlot}` : parentId || WINDOW_ROOT_DROP_TARGET;
    if (!canDropOnParent(controlIds, parentId, containerSlot)) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'none';
      setDropTargetId(null);
      setInvalidDropTargetId(targetId);
      setDragFeedback('不能移动到这里：目标位于选区内部，或父级没有变化');
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetId(targetId);
    setInvalidDropTargetId(null);
    setDragFeedback(`松开可移动 ${controlIds.length} 个控件`);
  };

  const handleDragLeave = (event: React.DragEvent, targetId: string) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
    setDropTargetId(previous => previous === targetId ? null : previous);
    setInvalidDropTargetId(previous => previous === targetId ? null : previous);
  };

  const handleDrop = (event: React.DragEvent, parentId?: string, containerSlot?: string) => {
    const controlIds = readDraggedControlIds(event);
    if (!canDropOnParent(controlIds, parentId, containerSlot)) return;
    event.preventDefault();
    event.stopPropagation();
    onReparentControls(controlIds, parentId, containerSlot);
    setExpandedIds(previous => new Set([
      ...previous,
      parentId || window.id,
      ...(parentId && containerSlot ? [`${parentId}:${containerSlot}`] : [])
    ]));
    setDraggedControlIds([]);
    setDropTargetId(null);
    setInvalidDropTargetId(null);
    setDragFeedback(`已移动 ${controlIds.length} 个控件`);
  };

  const handleDragEnd = () => {
    setDraggedControlIds([]);
    setDropTargetId(null);
    setInvalidDropTargetId(null);
    setDragFeedback('');
  };

  const handleControlSelection = (event: React.MouseEvent, controlId: string) => {
    const toggleSelection = event.ctrlKey || event.metaKey;
    const rangeSelection = event.shiftKey && selectionAnchorRef.current;

    if (rangeSelection) {
      const anchorIndex = controlTreeOrder.indexOf(selectionAnchorRef.current!);
      const controlIndex = controlTreeOrder.indexOf(controlId);
      if (anchorIndex >= 0 && controlIndex >= 0) {
        const rangeIds = controlTreeOrder.slice(Math.min(anchorIndex, controlIndex), Math.max(anchorIndex, controlIndex) + 1);
        const nextIds = toggleSelection ? [...new Set([...selectedControlIds, ...rangeIds])] : rangeIds;
        onSelectControls(nextIds, controlId);
        return;
      }
    }

    selectionAnchorRef.current = controlId;
    if (toggleSelection) {
      const nextIds = selectedControlIds.includes(controlId)
        ? selectedControlIds.filter(id => id !== controlId)
        : [...selectedControlIds, controlId];
      onSelectControls(nextIds, nextIds.includes(controlId) ? controlId : nextIds.at(-1) || null);
      return;
    }
    onSelectControls([controlId], controlId);
  };

  const renderControlNode = (node: LingControlHierarchyNode, depth: number): React.ReactNode => {
    const tabPages = isTabContainerControl(node.control) ? getTabControlPages(node.control) : [];
    const selectedTabPage = isTabContainerControl(node.control) ? getSelectedTabPage(node.control) : undefined;
    const hasChildren = node.children.length > 0 || tabPages.length > 0;
    const expanded = expandedIds.has(node.control.id);
    const selected = selectedControlIds.includes(node.control.id);
    const isContainer = Boolean(getWin32ControlDefinition(node.control.type)?.isContainer);
    const defaultDropSlot = isTabContainerControl(node.control) ? selectedTabPage?.id : undefined;
    const nodeDropTargetId = defaultDropSlot ? `${node.control.id}:${defaultDropSlot}` : node.control.id;
    const isDropTarget = dropTargetId === nodeDropTargetId;
    const isInvalidDropTarget = invalidDropTargetId === nodeDropTargetId;

    return (
      <React.Fragment key={node.control.id}>
        <div
          role="treeitem"
          aria-expanded={hasChildren ? expanded : undefined}
          aria-selected={selected}
          className={`flex min-w-0 items-center ${draggedControlIds.includes(node.control.id) ? 'opacity-55' : ''}`}
          style={{ paddingLeft: `${depth * 16}px` }}
          onDragOver={event => isContainer && handleDragOver(event, node.control.id, defaultDropSlot)}
          onDragLeave={event => isContainer && handleDragLeave(event, nodeDropTargetId)}
          onDrop={event => isContainer && handleDrop(event, node.control.id, defaultDropSlot)}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggleExpanded(node.control.id)}
            className={`flex h-6 w-5 shrink-0 items-center justify-center rounded ${
              hasChildren ? 'cursor-pointer hover:bg-slate-500/20' : 'cursor-default text-transparent'
            }`}
            aria-label={hasChildren ? `${expanded ? '折叠' : '展开'}${node.control.name}` : undefined}
            tabIndex={hasChildren ? 0 : -1}
          >
            {hasChildren && (expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
          </button>
          <button
            type="button"
            draggable
            aria-grabbed={draggedControlIds.includes(node.control.id)}
            onDragStart={event => handleDragStart(event, node.control.id)}
            onDragEnd={handleDragEnd}
            onClick={event => handleControlSelection(event, node.control.id)}
            className={`${getRowClassName(selected, isDropTarget, isInvalidDropTarget)} cursor-grab active:cursor-grabbing`}
            title={isContainer ? 'Ctrl 多选、Shift 连选；拖动选区或将其他控件拖到这里更换父级' : 'Ctrl 多选、Shift 连选；拖动选区到窗口或容器节点'}
          >
            <span className="shrink-0">{getControlIcon(node.control.type)}</span>
            <span className="min-w-0 flex-1 truncate">{node.control.name}</span>
            {selected && selectedControlIds.length > 1 && <Check className="h-3 w-3 shrink-0 text-sky-300" aria-hidden="true" />}
            <span className="shrink-0 text-[9px] text-slate-500">{CONTROL_LABELS[node.control.type]}</span>
          </button>
        </div>
        {hasChildren && expanded && (tabPages.length > 0 ? tabPages.map(page => {
          const pageSelected = selectedControlId === node.control.id && selectedTabPage?.id === page.id;
          const pageDropTargetId = `${node.control.id}:${page.id}`;
          const pageChildren = node.children.filter(child => getControlTabSlot(child.control, node.control) === page.id);
          const pageExpanded = expandedIds.has(pageDropTargetId);
          return (
            <React.Fragment key={page.id}>
              <div
                role="treeitem"
                aria-expanded={pageChildren.length > 0 ? pageExpanded : undefined}
                aria-selected={pageSelected}
                className="flex min-w-0 items-center"
                style={{ paddingLeft: `${(depth + 1) * 16}px` }}
                onDragOver={event => handleDragOver(event, node.control.id, page.id)}
                onDragLeave={event => handleDragLeave(event, pageDropTargetId)}
                onDrop={event => handleDrop(event, node.control.id, page.id)}
              >
                <button
                  type="button"
                  onClick={() => pageChildren.length > 0 && toggleExpanded(pageDropTargetId)}
                  className={`flex h-6 w-5 shrink-0 items-center justify-center rounded text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 ${
                    pageChildren.length > 0 ? 'cursor-pointer hover:bg-slate-500/20' : 'cursor-default'
                  }`}
                  aria-label={pageChildren.length > 0 ? `${pageExpanded ? '折叠' : '展开'}${page.title}` : undefined}
                  tabIndex={pageChildren.length > 0 ? 0 : -1}
                >
                  {pageChildren.length > 0 && (pageExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTabPage(node.control.id, page.id)}
                  className={getRowClassName(pageSelected, dropTargetId === pageDropTargetId, invalidDropTargetId === pageDropTargetId)}
                  title={`选择 ${page.title}；将控件拖到这里可移动到此页面`}
                >
                  <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                  <span className="min-w-0 flex-1 truncate">{page.title}</span>
                  <span className="shrink-0 text-[9px] text-slate-500">页面 HWND</span>
                </button>
              </div>
              {pageExpanded && pageChildren.map(child => renderControlNode(child, depth + 2))}
            </React.Fragment>
          );
        }) : node.children.map(child => renderControlNode(child, depth + 1)))}
      </React.Fragment>
    );
  };

  const rootExpanded = expandedIds.has(window.id);
  const menuNodeId = `${window.id}:menu`;
  const menuExpanded = expandedIds.has(menuNodeId);
  const hasRootChildren = window.controls.length > 0 || menuItems.length > 0;

  return (
    <section className={`overflow-hidden rounded border ${isDarkMode ? 'border-[#34343c] bg-[#18181d]' : 'border-slate-200 bg-white'}`}>
      <div className={`border-b px-2.5 py-2 ${isDarkMode ? 'border-[#34343c] bg-[#222229]' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
          <ListTree className="h-3.5 w-3.5 text-amber-500" />
          <span>布局内容</span>
          <span className="ml-auto rounded bg-slate-500/15 px-1.5 py-0.5 text-[9px] font-normal">
            {selectedControlIds.length > 1 ? `已选 ${selectedControlIds.length} / ` : ''}{window.controls.length} 个控件
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-4 text-slate-500">Ctrl 多选、Shift 连选；按住任一已选控件拖到窗口或容器可整组选中项。</p>
        <p aria-live="polite" className={`min-h-4 text-[10px] leading-4 ${invalidDropTargetId ? 'text-red-400' : dropTargetId ? 'text-emerald-400' : 'text-slate-500'}`}>
          {dragFeedback || (selectedControlIds.length > 1 ? `已选择 ${selectedControlIds.length} 个控件，可按住其中任一项拖拽。` : '')}
        </p>
      </div>

      <div role="tree" aria-multiselectable="true" aria-label={`${window.title}布局组件树`} className="max-h-[62vh] overflow-auto p-1.5">
        <div
          role="treeitem"
          aria-expanded={hasRootChildren ? rootExpanded : undefined}
          aria-selected={selectedControlId === null}
          className="flex min-w-0 items-center"
          onDragOver={event => handleDragOver(event)}
          onDragLeave={event => handleDragLeave(event, WINDOW_ROOT_DROP_TARGET)}
          onDrop={event => handleDrop(event)}
        >
          <button
            type="button"
            onClick={() => hasRootChildren && toggleExpanded(window.id)}
            className="flex h-6 w-5 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-slate-500/20"
            aria-label={`${rootExpanded ? '折叠' : '展开'}窗口`}
          >
            {hasRootChildren && (rootExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
          </button>
          <button
            type="button"
            onClick={() => {
              selectionAnchorRef.current = null;
              onSelectControls([], null);
            }}
            className={getRowClassName(selectedControlId === null, dropTargetId === WINDOW_ROOT_DROP_TARGET, invalidDropTargetId === WINDOW_ROOT_DROP_TARGET)}
            title="将已选控件拖到这里可提升为窗口根级控件"
          >
            <Monitor className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1 truncate font-semibold">{window.title}</span>
            <span className="shrink-0 text-[9px] text-slate-500">窗口</span>
          </button>
        </div>

        {rootExpanded && (
          <div role="group">
            {menuItems.length > 0 && (
              <>
                <div role="treeitem" aria-expanded={menuExpanded} aria-selected={selectedControlId === '__window_menu_bar__'} className="flex min-w-0 items-center pl-4">
                  <button type="button" onClick={() => toggleExpanded(menuNodeId)} className="flex h-6 w-5 shrink-0 items-center justify-center rounded hover:bg-slate-500/20">
                    {menuExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  <button type="button" onClick={() => onSelectControls([], '__window_menu_bar__')} className={getRowClassName(selectedControlId === '__window_menu_bar__')}>
                    {TYPE_ICONS.MenuBar}
                    <span className="min-w-0 flex-1 truncate">{window.menuName || '窗口菜单栏'}</span>
                    <span className="text-[9px] text-slate-500">菜单栏</span>
                  </button>
                </div>
                {menuExpanded && menuItems.map((item, index) => {
                  const itemId = `__window_menu_item_${index}__`;
                  return (
                    <div key={itemId} role="treeitem" aria-selected={selectedControlId === itemId} className="flex min-w-0 items-center pl-8">
                      <span className="h-6 w-5 shrink-0" />
                      <button type="button" onClick={() => onSelectControls([], itemId)} className={getRowClassName(selectedControlId === itemId)}>
                        <Menu className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <span className="min-w-0 flex-1 truncate">{item}</span>
                        <span className="text-[9px] text-slate-500">菜单项</span>
                      </button>
                    </div>
                  );
                })}
              </>
            )}
            {hierarchy.map(node => renderControlNode(node, 1))}
          </div>
        )}
      </div>
    </section>
  );
}

function renderControl(
  control: LingControl,
  projectId: string,
  isSelected: boolean,
  handleMouseDown: (event: React.MouseEvent, control: LingControl, action: 'drag' | ResizeDirection) => void,
  setSelectedControlId: (id: string) => void,
  onOpenEventCode: (event: React.MouseEvent, control: LingControl) => void,
  onOpenContextMenu: (event: React.MouseEvent, controlId: string) => void,
  contentOffset: number,
  useNewEmojiDesigner: boolean,
  newEmojiThemePreview: NewEmojiThemePreview,
  isEffectivelyVisible: boolean,
  isEffectivelyEnabled: boolean,
  ancestorsVisible: boolean,
  onSelectTabPage?: (pageId: string) => void,
  onReorderRebarBand?: (fromIndex: number, toIndex: number) => void,
  navigationRef?: (element: HTMLElement | null) => void
) {
  const isCollapsed = !isEffectivelyVisible && ancestorsVisible;
  const isHiddenByAncestor = !ancestorsVisible;
  const definition = getWin32ControlDefinition(control.type);
  const controlFontStyle = getControlFontCssStyle(control);
  const newEmojiPreviewKind = getNewEmojiPreviewKind(control);
  const useNewEmojiControlPreview = Boolean(newEmojiPreviewKind) && !isTabContainerControl(control);
  const newEmojiSupported = Boolean(control.designerType) || isNewEmojiDesignerControlSupported(control.type);
  const hasSpecialPreview = Boolean(newEmojiPreviewKind) || isTabContainerControl(control) || hasDedicatedControlPreview(control.type)
    || (useNewEmojiDesigner && !newEmojiSupported);
  const resizeHandles: Array<{
    direction: ResizeDirection;
    className: string;
    cursor: string;
    title: string;
  }> = [
    { direction: 'nw', className: '-left-1.5 -top-1.5', cursor: 'cursor-nw-resize', title: '左上拉伸' },
    { direction: 'n', className: 'left-1/2 -translate-x-1/2 -top-1.5', cursor: 'cursor-n-resize', title: '向上拉伸' },
    { direction: 'ne', className: '-right-1.5 -top-1.5', cursor: 'cursor-ne-resize', title: '右上拉伸' },
    { direction: 'e', className: '-right-1.5 top-1/2 -translate-y-1/2', cursor: 'cursor-e-resize', title: '向右拉伸' },
    { direction: 'se', className: '-right-1.5 -bottom-1.5', cursor: 'cursor-se-resize', title: '右下拉伸' },
    { direction: 's', className: 'left-1/2 -translate-x-1/2 -bottom-1.5', cursor: 'cursor-s-resize', title: '向下拉伸' },
    { direction: 'sw', className: '-left-1.5 -bottom-1.5', cursor: 'cursor-sw-resize', title: '左下拉伸' },
    { direction: 'w', className: '-left-1.5 top-1/2 -translate-y-1/2', cursor: 'cursor-w-resize', title: '向左拉伸' }
  ];

  return (
    <div
      key={control.id}
      ref={navigationRef}
      data-designer-control-id={control.id}
      tabIndex={-1}
      onClick={event => {
        event.stopPropagation();
        setSelectedControlId(control.id);
      }}
      onDoubleClick={event => onOpenEventCode(event, control)}
      onContextMenu={event => onOpenContextMenu(event, control.id)}
      onMouseDown={event => handleMouseDown(event, control, 'drag')}
      title={control.designerLocked ? `已锁定 · 双击打开事件代码：${getEplEventHandlerName(control.name, getPrimaryEventNameForType(control.type))}` : `双击打开事件代码：${getEplEventHandlerName(control.name, getPrimaryEventNameForType(control.type))}`}
      className={`absolute group select-none ${control.designerLocked ? 'cursor-not-allowed' : 'cursor-move'} ${
        definition?.isContainer
          ? isSelected ? 'ring-1 ring-amber-500 z-10' : 'hover:ring-1 hover:ring-slate-500 z-10'
          : isSelected ? 'ring-1 ring-amber-500 z-40' : 'hover:ring-1 hover:ring-slate-500 z-20'
      } ${isCollapsed ? 'opacity-30 border border-dashed border-red-500' : ''}`}
      style={{
        left: `${control.x}px`,
        top: `${control.y + contentOffset}px`,
        width: `${control.width}px`,
        height: `${control.height}px`,
        visibility: isHiddenByAncestor ? 'hidden' : undefined
      }}
    >
      {control.designerLocked && <span className="pointer-events-none absolute -right-1.5 -top-1.5 z-[70] rounded bg-slate-900 px-1 py-0.5 text-[8px] text-amber-300 shadow">锁定</span>}
      {isSelected && !control.designerLocked && (
        <>
          <div className="absolute top-1/2 -left-[1000px] right-full h-px border-t border-dashed border-amber-500/65 pointer-events-none z-50">
            <span className="absolute -top-4 left-4 bg-slate-900/80 text-amber-400 px-1.5 py-0.5 rounded text-[8px] font-mono shadow border border-amber-500/20">
              左: {control.x}px
            </span>
          </div>
          <div className="absolute left-1/2 -top-[1000px] bottom-full w-px border-l border-dashed border-amber-500/65 pointer-events-none z-50">
            <span className="absolute left-2 top-4 bg-slate-900/80 text-amber-400 px-1.5 py-0.5 rounded text-[8px] font-mono shadow border border-amber-500/20">
              顶: {control.y}px
            </span>
          </div>
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-bold px-1 py-0.5 rounded text-[8px] font-mono shadow select-none pointer-events-none">
            宽:{control.width} x 高:{control.height}
          </div>
        </>
      )}

      <div className={`w-full h-full relative select-none ${control.type === 'ReBar' && isSelected ? 'pointer-events-auto' : 'pointer-events-none'}`} style={controlFontStyle}>
        {useNewEmojiControlPreview ? (
          <NewEmojiDesignerControlPreview control={control} isEnabled={isEffectivelyEnabled} isSelected={isSelected} theme={newEmojiThemePreview} />
        ) : (
          <>
        {control.type === 'Button' && (
          <button
            disabled={!isEffectivelyEnabled}
            className="w-full h-full text-center text-xs flex items-center justify-center px-2 select-none border"
            style={{
              background: useNewEmojiDesigner
                ? control.background === 'transparent'
                  ? isEffectivelyEnabled ? newEmojiThemePreview.buttonBackground : newEmojiThemePreview.buttonDisabledBackground
                  : control.background
                : control.background,
              borderColor: useNewEmojiDesigner
                ? isEffectivelyEnabled ? newEmojiThemePreview.border : newEmojiThemePreview.disabledBorder
                : 'transparent',
              color: useNewEmojiDesigner && control.foreground === 'transparent'
                ? isEffectivelyEnabled ? newEmojiThemePreview.textPrimary : newEmojiThemePreview.textMuted
                : control.foreground,
              fontSize: `${control.fontSize}px`,
              fontFamily: controlFontStyle.fontFamily,
              fontWeight: controlFontStyle.fontWeight,
              fontStyle: controlFontStyle.fontStyle,
              textDecoration: controlFontStyle.textDecoration,
              opacity: useNewEmojiDesigner ? 1 : isEffectivelyEnabled ? 1 : 0.5,
              borderRadius: `${useNewEmojiDesigner ? 6 : Math.min(Math.max(Number(control.properties?.cornerRadius ?? 6), 0), Math.min(control.width, control.height) / 2)}px`
            }}
          >
            {control.content}
          </button>
        )}

        {control.type === 'TextBox' && (
          <div
            className="w-full h-full border px-2 py-1 flex text-xs select-none"
            style={{
              backgroundColor: useNewEmojiDesigner && control.background === 'transparent' ? newEmojiThemePreview.editBackground : control.background,
              borderColor: useNewEmojiDesigner
                ? isEffectivelyEnabled ? newEmojiThemePreview.border : newEmojiThemePreview.disabledBorder
                : '#334155',
              borderRadius: useNewEmojiDesigner ? '4px' : undefined,
              color: useNewEmojiDesigner && control.foreground === 'transparent'
                ? isEffectivelyEnabled ? newEmojiThemePreview.textPrimary : newEmojiThemePreview.textMuted
                : control.foreground,
              fontSize: `${control.fontSize}px`,
              opacity: useNewEmojiDesigner ? 1 : isEffectivelyEnabled ? 1 : 0.5,
              alignItems: control.properties?.verticalAlign === 'top' ? 'flex-start' : control.properties?.verticalAlign === 'bottom' ? 'flex-end' : 'center',
              justifyContent: control.properties?.textAlign === 'center' ? 'center' : control.properties?.textAlign === 'right' ? 'flex-end' : 'flex-start',
              textAlign: control.properties?.textAlign === 'center' ? 'center' : control.properties?.textAlign === 'right' ? 'right' : 'left'
            }}
          >
            {control.content}
          </div>
        )}

        {control.type === 'Label' && (
          <div
            className="w-full h-full flex items-center text-xs leading-normal select-none overflow-hidden"
            style={{
              color: control.foreground,
              fontSize: `${control.fontSize}px`,
              backgroundColor: control.background,
              fontWeight: controlFontStyle.fontWeight,
              justifyContent: control.properties?.textAlign === 'center' ? 'center' : control.properties?.textAlign === 'right' ? 'flex-end' : 'flex-start',
              textAlign: control.properties?.textAlign === 'center' ? 'center' : control.properties?.textAlign === 'right' ? 'right' : 'left'
            }}
          >
            {control.content}
          </div>
        )}

        {control.type === 'CheckBox' && (
          <div
            className="w-full h-full flex items-center gap-2 text-xs select-none"
            style={{ color: control.foreground, fontSize: `${control.fontSize}px`, backgroundColor: control.background === 'transparent' ? 'transparent' : control.background }}
          >
            <div className="w-3.5 h-3.5 border rounded flex items-center justify-center shrink-0" style={{ borderColor: control.properties?.checked === true ? String(control.properties?.selectedColor ?? '#0E7490') : '#64748B', backgroundColor: control.properties?.checked === true ? String(control.properties?.selectedColor ?? '#0E7490') : (control.background === 'transparent' ? 'transparent' : control.background) }}>
              {control.properties?.checked === true && <Check className="w-2.5 h-2.5" style={{ color: String(control.properties?.selectedMarkColor ?? '#FFFFFF') }} />}
            </div>
            <span className="truncate">{control.content}</span>
          </div>
        )}

        {control.type === 'RadioButton' && (
          <div
            className="w-full h-full flex items-center gap-2 text-xs select-none"
            style={{ color: control.foreground, fontSize: `${control.fontSize}px`, backgroundColor: control.background === 'transparent' ? 'transparent' : control.background }}
          >
            <div className="w-3.5 h-3.5 border rounded-full flex items-center justify-center shrink-0" style={{ borderColor: control.properties?.checked === true ? String(control.properties?.selectedColor ?? '#0E7490') : '#64748B', backgroundColor: control.background === 'transparent' ? 'transparent' : control.background }}>
              {control.properties?.checked === true && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: String(control.properties?.selectedMarkColor ?? '#FFFFFF') }} />}
            </div>
            <span className="truncate">{control.content}</span>
          </div>
        )}

        {control.type === 'ProgressBar' && (
          <div
            className="w-full h-full rounded overflow-hidden relative select-none border border-slate-700 flex items-center justify-center"
            style={{ backgroundColor: control.background === 'transparent' ? '#1E1E24' : control.background }}
          >
            <div
              className="absolute left-0 top-0 bottom-0"
              style={{
                width: `${Math.min(100, Math.max(0, parseInt(control.content) || 0))}%`,
                background: useNewEmojiDesigner ? `linear-gradient(90deg, ${control.foreground}, #A855F7)` : control.foreground
              }}
            />
            <span className="z-10 font-mono text-[9px] text-white select-none">{control.content}%</span>
          </div>
        )}

        {(control.type === 'ComboBox' || control.type === 'ComboBoxEx') && (() => {
          const items = Array.isArray(control.properties?.items)
            ? control.properties.items.map(item => typeof item === 'string'
              ? item
              : String((item as Record<string, unknown>).title ?? (item as Record<string, unknown>).label ?? (item as Record<string, unknown>).text ?? ''))
            : [];
          const sortedItems = control.properties?.sorted === true ? [...items].sort((left, right) => left.localeCompare(right, 'zh-CN')) : items;
          const selectedIndex = typeof control.properties?.selectedIndex === 'number' ? control.properties.selectedIndex : 0;
          const selectedText = sortedItems[selectedIndex] ?? control.content;
          return (
            <div
              className="h-full w-full overflow-hidden rounded border px-2 text-xs select-none flex items-center justify-between"
              style={{
                backgroundColor: control.background === 'transparent' ? '#1E1E24' : control.background,
                borderColor: String(control.properties?.borderColor ?? '#334155'),
                opacity: isEffectivelyEnabled ? 1 : 0.5
              }}
            >
              <span style={{ color: control.foreground, fontSize: `${control.fontSize}px` }} className="truncate">
                {selectedText}
              </span>
              <svg aria-hidden="true" viewBox="0 0 12 8" className="h-2 w-3 shrink-0" style={{ color: control.foreground }}>
                <path d="M1 1.5 6 6.5l5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          );
        })()}

        {control.type === 'ColorPicker' && (() => {
          const currentColor = typeof control.properties?.currentColor === 'string'
            && /^#[0-9a-f]{6}$/iu.test(control.properties.currentColor)
            ? control.properties.currentColor.toUpperCase()
            : '#3B82F6';
          return (
            <div
              aria-label="颜色选择器预览"
              className="flex h-full w-full items-center gap-2 overflow-hidden rounded border border-slate-600 px-2 select-none"
              style={{
                backgroundColor: control.background === 'transparent' ? '#1E293B' : control.background,
                color: control.foreground,
                fontSize: `${control.fontSize}px`,
                opacity: isEffectivelyEnabled ? 1 : 0.5
              }}
            >
              <span className="h-[65%] min-h-3 w-7 shrink-0 rounded border border-white/30 shadow-inner" style={{ backgroundColor: currentColor }} />
              {control.properties?.showColorText !== false && <span className="min-w-0 flex-1 truncate font-mono">{currentColor}</span>}
              <svg aria-hidden="true" viewBox="0 0 12 8" className="h-2 w-3 shrink-0 opacity-70">
                <path d="M1 1.5 6 6.5l5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          );
        })()}

        {control.type === 'ListBox' && (() => {
          const items = Array.isArray(control.properties?.items)
            ? control.properties.items.map(item => typeof item === 'string'
              ? item
              : String((item as Record<string, unknown>).title ?? (item as Record<string, unknown>).label ?? (item as Record<string, unknown>).text ?? ''))
            : [];
          const sortedItems = control.properties?.sorted === true ? [...items].sort((left, right) => left.localeCompare(right, 'zh-CN')) : items;
          const selectedIndex = typeof control.properties?.selectedIndex === 'number' ? control.properties.selectedIndex : (sortedItems.length > 0 ? 0 : -1);
          const showBorder = control.properties?.showBorder !== false;
          const borderWidth = showBorder ? Math.max(0, Math.min(8, Number(control.properties?.borderWidth ?? 1))) : 0;
          const borderColor = String(control.properties?.borderColor ?? '#334155');
          const selectionStartColor = String(control.properties?.selectionStartColor ?? '#7C3AED');
          const selectionEndColor = String(control.properties?.selectionEndColor ?? '#0891B2');
          const selectionBorderColor = String(control.properties?.selectionBorderColor ?? '#38BDF8');
          const selectionCornerRadius = Math.max(0, Math.min(24, Number(control.properties?.selectionCornerRadius ?? 4)));
          const itemHeight = Math.max(16, Math.min(96, Number(control.properties?.itemHeight ?? 28)));
          const itemSpacing = Math.max(0, Math.min(24, Number(control.properties?.itemSpacing ?? 0)));
          const contentPadding = Math.max(0, Math.min(24, Number(control.properties?.contentPadding ?? 4)));
          const scrollBarVisibility = String(control.properties?.scrollBarVisibility ?? 'auto');
          const scrollBarWidth = Math.max(4, Math.min(24, Number(control.properties?.scrollBarWidth ?? 8)));
          const scrollBarTrackColor = String(control.properties?.scrollBarTrackColor ?? '#172033');
          const scrollBarThumbColor = String(control.properties?.scrollBarThumbColor ?? '#0E7490');
          const availableHeight = Math.max(1, control.height - borderWidth * 2 - contentPadding * 2);
          const contentHeight = sortedItems.length * itemHeight + Math.max(0, sortedItems.length - 1) * itemSpacing;
          const showScrollBar = scrollBarVisibility === 'visible'
            || (scrollBarVisibility !== 'hidden' && contentHeight > availableHeight);
          const scrollThumbHeight = Math.max(scrollBarWidth * 2, Math.min(availableHeight, availableHeight * Math.min(1, availableHeight / Math.max(1, contentHeight))));
          return (
            <div
              className={`relative h-full w-full overflow-hidden text-[11px] ${useNewEmojiDesigner ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_28px_rgba(8,145,178,0.12)]' : ''}`}
              style={{
                backgroundColor: control.background === 'transparent' ? '#0F172A' : control.background,
                borderStyle: borderWidth > 0 ? 'solid' : 'none',
                borderWidth: `${borderWidth}px`,
                borderColor,
                color: control.foreground,
                fontSize: `${control.fontSize}px`,
                opacity: isEffectivelyEnabled ? 1 : 0.5
              }}
            >
              {control.content && (
                <div className="truncate border-b border-cyan-400/20 px-2 py-1 font-semibold text-cyan-100">{control.content}</div>
              )}
              <div
                className="h-full overflow-hidden"
                style={{
                  padding: `${contentPadding}px`,
                  paddingRight: `${contentPadding + (showScrollBar ? scrollBarWidth + 2 : 0)}px`
                }}
              >
                {sortedItems.length > 0 ? sortedItems.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="flex shrink-0 items-center truncate border px-2"
                    style={index === selectedIndex ? {
                      height: `${itemHeight}px`,
                      marginBottom: index < sortedItems.length - 1 ? `${itemSpacing}px` : undefined,
                      backgroundImage: `linear-gradient(90deg, ${selectionStartColor}, ${selectionEndColor})`,
                      borderColor: selectionBorderColor,
                      borderRadius: `${selectionCornerRadius}px`,
                      color: control.foreground
                    } : {
                      height: `${itemHeight}px`,
                      marginBottom: index < sortedItems.length - 1 ? `${itemSpacing}px` : undefined,
                      borderColor: 'transparent',
                      borderRadius: `${selectionCornerRadius}px`,
                      color: control.foreground
                    }}
                    aria-selected={index === selectedIndex}
                  >
                    {item || `项目 ${index + 1}`}
                  </div>
                )) : <div className="flex h-full items-center justify-center text-slate-500">暂无列表项</div>}
              </div>
              {showScrollBar && (
                <div
                  aria-hidden="true"
                  className="absolute overflow-hidden"
                  style={{
                    top: `${contentPadding}px`,
                    right: `${contentPadding}px`,
                    bottom: `${contentPadding}px`,
                    width: `${scrollBarWidth}px`,
                    borderRadius: `${scrollBarWidth / 2}px`,
                    backgroundColor: scrollBarTrackColor
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${scrollThumbHeight}px`,
                      borderRadius: `${scrollBarWidth / 2}px`,
                      backgroundColor: scrollBarThumbColor
                    }}
                  />
                </div>
              )}
            </div>
          );
        })()}

        {control.type === 'Image' && (
          <div className={`w-full h-full border rounded flex items-center justify-center overflow-hidden relative ${useNewEmojiDesigner ? 'border-fuchsia-400/30 bg-slate-950/70 shadow-[0_10px_28px_rgba(124,58,237,0.14)]' : 'border-indigo-500/20 bg-indigo-950/20'}`}>
            {typeof control.properties?.imageSource === 'string' && control.properties.imageSource ? (
              <img
                src={getDesignerImagePreviewSource(projectId, control.properties.imageSource)}
                alt={control.content || '图片'}
                className="h-full w-full"
                style={{ objectFit: control.properties?.stretch === 'fill' ? 'fill' : control.properties?.stretch === 'uniformToFill' ? 'cover' : control.properties?.stretch === 'none' ? 'none' : 'contain' }}
              />
            ) : (
              <>
                <div className="absolute inset-0 opacity-15 bg-gradient-to-tr from-cyan-500 via-violet-500 to-fuchsia-500" />
                <span className="z-10 max-w-full truncate px-2 text-[10px] font-semibold text-indigo-200">{control.content || '请设置图片源'}</span>
              </>
            )}
          </div>
        )}

        {control.type === 'TrackBar' && (
          <TrackBarDesignerPreview control={control} isEnabled={isEffectivelyEnabled} />
        )}

        {control.type === 'RichEdit' && (
          <div
            className="h-full w-full overflow-hidden whitespace-pre-wrap rounded border border-slate-700 px-2 py-1 text-left select-none"
            style={{
              backgroundColor: control.background === 'transparent' ? 'transparent' : control.background,
              color: control.foreground,
              fontSize: `${control.fontSize}px`,
              fontFamily: controlFontStyle.fontFamily,
              fontWeight: controlFontStyle.fontWeight,
              fontStyle: controlFontStyle.fontStyle,
              textDecoration: controlFontStyle.textDecoration,
              opacity: isEffectivelyEnabled ? 1 : 0.5
            }}
          >
            {control.content}
          </div>
        )}

        {control.type === 'VideoPlayer' && (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded border border-slate-700 bg-black text-slate-300">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(51,65,85,0.36),transparent_62%)]" />
            <div className="z-10 flex max-w-full flex-col items-center gap-2 px-3 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10">
                <Play className="h-5 w-5 fill-current" />
              </span>
              <span className="max-w-full truncate text-[10px] font-semibold">
                {typeof control.properties?.videoSource === 'string' && control.properties.videoSource
                  ? control.properties.videoSource.split(/[\\/]/u).pop()
                  : '请选择 MP4 / WMV 视频'}
              </span>
              <span className="text-[8px] text-slate-500">Media Foundation · 音量 {String(control.properties?.volume ?? 100)}%</span>
            </div>
          </div>
        )}

        {control.type === 'CefBrowser' && (
          <div className="flex h-full w-full flex-col overflow-hidden rounded border border-sky-500/40 bg-white">
            <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-100 px-1.5 py-1">
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <span className="ml-1 flex h-4 min-w-0 flex-1 items-center gap-1 rounded bg-white px-1.5 text-[8px] text-slate-500 border border-slate-200">
                <Globe className="h-2.5 w-2.5 shrink-0 text-sky-500" />
                <span className="truncate">{typeof control.properties?.url === 'string' && control.properties.url ? control.properties.url : 'about:blank'}</span>
              </span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-1 px-2 text-center">
                <Globe className="h-6 w-6 text-sky-400" />
                <span className="max-w-full truncate text-[9px] font-semibold text-slate-500">{control.name}</span>
                <span className="text-[8px] text-slate-400">CEF3 · Chromium</span>
              </div>
            </div>
          </div>
        )}

        {control.type === 'FBroBrowser' && (
          <div
            className="flex h-full w-full flex-col overflow-hidden rounded border border-amber-500/45 bg-white"
            style={{ contain: 'layout paint' }}
          >
            <div className="flex items-center gap-1 border-b border-amber-200 bg-amber-50 px-1.5 py-1">
              <Fingerprint className="h-3 w-3 shrink-0 text-amber-500" />
              <span className="ml-1 flex h-4 min-w-0 flex-1 items-center rounded border border-amber-200 bg-white px-1.5 text-[8px] text-slate-500">
                <span className="truncate">{typeof control.properties?.url === 'string' && control.properties.url ? control.properties.url : 'about:blank'}</span>
              </span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-gradient-to-br from-amber-50 to-slate-50">
              <div className="flex flex-col items-center gap-1 px-2 text-center">
                <Fingerprint className="h-7 w-7 text-amber-500" />
                <span className="max-w-full truncate text-[9px] font-semibold text-slate-600">{control.name}</span>
                <span className="text-[8px] text-slate-400">FBro · CEF 135 · x64</span>
              </div>
            </div>
          </div>
        )}

        {control.type === 'EdgeBrowser' && (
          <div className="flex h-full w-full flex-col overflow-hidden rounded border border-emerald-500/40 bg-white">
            <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-100 px-1.5 py-1">
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <span className="ml-1 flex h-4 min-w-0 flex-1 items-center gap-1 rounded border border-slate-200 bg-white px-1.5 text-[8px] text-slate-500">
                <Globe className="h-2.5 w-2.5 shrink-0 text-emerald-500" />
                <span className="truncate">{typeof control.properties?.url === 'string' && control.properties.url ? control.properties.url : 'about:blank'}</span>
              </span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-1 px-2 text-center">
                <Globe className="h-6 w-6 text-emerald-400" />
                <span className="max-w-full truncate text-[9px] font-semibold text-slate-500">{control.name}</span>
                <span className="text-[8px] text-slate-400">Microsoft Edge · WebView2</span>
              </div>
            </div>
          </div>
        )}

        {control.type === 'AnimatedImage' && (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded border border-fuchsia-500/30 bg-fuchsia-950/20">
            {typeof control.properties?.gifSource === 'string' && control.properties.gifSource ? (
              <img
                src={getDesignerImagePreviewSource(projectId, control.properties.gifSource)}
                alt={control.content || '动态图像'}
                className="h-full w-full"
                style={{ objectFit: control.properties?.stretch === 'fill' ? 'fill' : control.properties?.stretch === 'uniformToFill' ? 'cover' : control.properties?.stretch === 'none' ? 'none' : 'contain' }}
              />
            ) : (
              <>
                <div className="absolute inset-0 bg-gradient-to-tr from-fuchsia-500 via-violet-500 to-cyan-500 opacity-15" />
                <Play className="z-10 mr-1 h-4 w-4 text-fuchsia-300" />
                <span className="z-10 max-w-full truncate px-1 text-[10px] font-semibold text-fuchsia-200">请设置 GIF 文件</span>
              </>
            )}
          </div>
        )}

        {control.type === 'SysLink' && (
          <div
            className="flex h-full w-full items-center overflow-hidden px-1 text-xs underline"
            style={{
              color: control.foreground,
              fontSize: `${control.fontSize}px`,
              backgroundColor: control.background === 'transparent' ? 'transparent' : control.background,
              opacity: isEffectivelyEnabled ? 1 : 0.5
            }}
          >
            <span className="truncate">{control.content}</span>
          </div>
        )}

        {control.type === 'IPAddress' && (() => {
          const configuredAddress = String(control.properties?.address || control.content || '127.0.0.1');
          const fields = configuredAddress.split('.').slice(0, 4);
          while (fields.length < 4) fields.push('0');
          const borderWidth = Math.max(0, Math.min(8, Number(control.properties?.borderWidth ?? 1)));
          const borderColor = String(control.properties?.borderColor ?? '#64748B');
          const verticalAlign = control.properties?.verticalAlign === 'top' || control.properties?.verticalAlign === 'bottom'
            ? control.properties.verticalAlign
            : 'center';
          return (
            <div
              className="flex h-full w-full min-w-0 overflow-hidden px-1 font-mono"
              style={{
                alignItems: verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center',
                backgroundColor: control.background === 'transparent' ? 'transparent' : control.background,
                borderColor,
                borderStyle: borderWidth > 0 ? 'solid' : 'none',
                borderWidth: `${borderWidth}px`,
                boxSizing: 'border-box',
                color: control.foreground,
                fontSize: `${control.fontSize}px`,
                opacity: isEffectivelyEnabled ? 1 : 0.5
              }}
            >
              {fields.map((field, index) => (
                <React.Fragment key={index}>
                  <span className="min-w-0 flex-1 truncate text-center leading-tight">{field}</span>
                  {index < fields.length - 1 && <span className="shrink-0 px-0.5 leading-tight">.</span>}
                </React.Fragment>
              ))}
            </div>
          );
        })()}

        {control.type === 'UpDown' && <UpDownDesignerPreview isEnabled={isEffectivelyEnabled} />}

        {(control.type === 'Upload' || control.type === 'DragUpload') && (() => {
          const dragEnabled = control.type === 'DragUpload' || control.properties?.dropEnabled === true;
          const multiple = control.properties?.multiple !== false;
          const tip = String(control.properties?.tip || (dragEnabled ? '将文件拖到此处，或点击选择文件' : '点击选择本地文件'));
          const initialFiles = Array.isArray(control.properties?.initialFiles) ? control.properties.initialFiles : [];
          return (
            <div
              className={`flex h-full w-full flex-col overflow-hidden rounded-xl border p-3 ${dragEnabled ? 'border-dashed border-fuchsia-400/70 bg-fuchsia-950/20' : 'border-sky-400/45 bg-slate-950/55'} shadow-[0_12px_34px_rgba(14,165,233,0.12)]`}
              style={{ color: control.foreground, opacity: isEffectivelyEnabled ? 1 : 0.5 }}
            >
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
                {dragEnabled ? <FileUp className="h-8 w-8 text-fuchsia-300" /> : <Upload className="h-7 w-7 text-sky-300" />}
                <span className="max-w-full truncate text-sm">{control.content}</span>
                <span className="max-w-full truncate text-[10px] text-slate-400">{tip}</span>
                <span className="rounded bg-sky-500 px-3 py-1 text-[10px] text-white">{String(control.properties?.triggerText || '选择文件')}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-[9px] text-slate-400">
                <span>{multiple ? '允许多选' : '单文件'} · {String(control.properties?.accept || '*.*')}</span>
                <span>{initialFiles.length ? `${initialFiles.length} 个初始文件` : dragEnabled ? '已启用拖放' : '点击选择'}</span>
              </div>
            </div>
          );
        })()}

        {control.type === 'ListView' && <ListViewDesignerPreview control={control} />}

        {control.type === 'DataGrid' && <DataGridDesignerPreview control={control} />}

        {control.type === 'Header' && <HeaderDesignerPreview control={control} />}

        {control.type === 'StatusBar' && (
          <StatusBarDesignerPreview control={control} isEnabled={isEffectivelyEnabled} />
        )}

        {control.type === 'ReBar' && (
          <RebarDesignerPreview control={control} onReorder={onReorderRebarBand} interactive={isSelected} />
        )}

        {isTabContainerControl(control) && <TabControlDesignerPreview control={control} onSelectPage={onSelectTabPage} />}

        {control.type === 'TreeView' && <TreeViewDesignerPreview control={control} isEnabled={isEffectivelyEnabled} />}

        {control.type === 'GroupBox' && (() => {
          const showBorder = control.properties?.showBorder !== false;
          const borderWidth = showBorder ? Math.max(0, Math.min(8, Number(control.properties?.borderWidth ?? 1))) : 0;
          const borderColor = String(control.properties?.borderColor ?? '#64748B');
          const titleAlign = control.properties?.titleAlign === 'center' || control.properties?.titleAlign === 'right'
            ? control.properties.titleAlign
            : 'left';
          return (
            <fieldset
              className="h-full w-full min-w-0 overflow-hidden px-2 pb-2"
              style={{
                backgroundColor: control.background === 'transparent' ? 'transparent' : control.background,
                borderStyle: borderWidth > 0 ? 'solid' : 'none',
                borderWidth: `${borderWidth}px`,
                borderColor,
                color: control.foreground,
                fontSize: `${control.fontSize}px`,
                opacity: isEffectivelyEnabled ? 1 : 0.5
              }}
            >
              <legend
                className="max-w-[calc(100%-12px)] truncate px-1"
                style={{
                  color: control.foreground,
                  marginLeft: titleAlign === 'left' ? 0 : 'auto',
                  marginRight: titleAlign === 'right' ? 0 : 'auto'
                }}
              >
                {control.content}
              </legend>
            </fieldset>
          );
        })()}

        {useNewEmojiDesigner && !newEmojiSupported && (
          <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-red-400/60 bg-red-950/35 px-2 text-center text-[10px] text-red-200">
            new_emoji 暂不支持 {definition?.label || control.type}
          </div>
        )}

        {!hasSpecialPreview && (
          <div
            className={`flex h-full w-full overflow-hidden rounded border ${definition?.isContainer ? 'items-start border-dashed p-2' : 'items-center justify-center px-2'} border-sky-500/40 ${control.background === 'transparent' ? 'bg-transparent' : 'bg-sky-950/15'} text-sky-200`}
            style={{ fontSize: `${control.fontSize}px`, backgroundColor: control.background === 'transparent' ? undefined : control.background, color: control.foreground }}
          >
            <span className="truncate">{control.content || definition?.label || control.type}</span>
            {definition?.isContainer && <span className="ml-auto text-[9px] text-sky-400/70">容器</span>}
          </div>
        )}
          </>
        )}
      </div>

      {isSelected && !control.designerLocked && (
        <>
          {resizeHandles.map(handle => (
            <div
              key={handle.direction}
              onMouseDown={event => handleMouseDown(event, control, handle.direction)}
              className={`absolute h-3 w-3 rounded-[2px] border border-slate-950 bg-amber-400 shadow-[0_0_0_1px_rgba(255,255,255,0.3),0_0_10px_rgba(245,158,11,0.45)] z-50 ${handle.cursor} ${handle.className}`}
              title={handle.title}
            />
          ))}
        </>
      )}
    </div>
  );
}

// The canvas updates interaction previews at pointer frequency. Keep each
// control isolated so a selection/preview update only reconciles affected
// controls instead of rebuilding every preview subtree.
const MemoizedDesignerControl = React.memo(
  function MemoizedDesignerControl(props: DesignerControlRenderProps) {
    return renderControl(
      props.control,
      props.projectId,
      props.isSelected,
      props.handleMouseDown,
      props.setSelectedControlId,
      props.onOpenEventCode,
      props.onOpenContextMenu,
      props.contentOffset,
      props.useNewEmojiDesigner,
      props.newEmojiThemePreview,
      props.isEffectivelyVisible,
      props.isEffectivelyEnabled,
      props.ancestorsVisible,
      props.onSelectTabPage,
      props.onReorderRebarBand,
      props.navigationRef
    );
  },
  (previous, next) => (
    previous.control === next.control
    && previous.projectId === next.projectId
    && previous.isSelected === next.isSelected
    && previous.contentOffset === next.contentOffset
    && previous.useNewEmojiDesigner === next.useNewEmojiDesigner
    && previous.newEmojiThemePreview === next.newEmojiThemePreview
    && previous.isEffectivelyVisible === next.isEffectivelyVisible
    && previous.isEffectivelyEnabled === next.isEffectivelyEnabled
    && previous.ancestorsVisible === next.ancestorsVisible
  )
);

export function TrackBarDesignerPreview({ control, isEnabled }: { control: LingControl; isEnabled: boolean }) {
  const minimum = Number.isFinite(Number(control.properties?.minimum)) ? Number(control.properties?.minimum) : 0;
  const maximumCandidate = Number.isFinite(Number(control.properties?.maximum)) ? Number(control.properties?.maximum) : 100;
  const maximum = Math.max(minimum, maximumCandidate);
  const valueCandidate = Number.isFinite(Number(control.properties?.value)) ? Number(control.properties?.value) : minimum;
  const value = Math.min(maximum, Math.max(minimum, valueCandidate));
  const range = maximum - minimum;
  const position = range > 0 ? ((value - minimum) / range) * 100 : 0;
  const frequency = Math.max(1, Math.trunc(Number(control.properties?.tickFrequency) || 1));
  const regularTickCount = range > 0 ? Math.min(100, Math.floor(range / frequency) + 1) : 1;
  const tickValues = Array.from({ length: regularTickCount }, (_, index) => minimum + index * frequency);
  if (range > 0 && tickValues[tickValues.length - 1] !== maximum) tickValues.push(maximum);
  const ticks = tickValues.map(tickValue => range > 0 ? ((tickValue - minimum) / range) * 100 : 0);

  return (
    <div
      aria-label={`滑块预览，当前值 ${value}`}
      className="relative h-full w-full overflow-hidden"
      style={{
        backgroundColor: control.background === 'transparent' ? 'transparent' : control.background,
        opacity: isEnabled ? 1 : 0.5
      }}
    >
      <div className="absolute left-[5px] right-[5px] top-[38%] h-[4px] -translate-y-1/2 border border-slate-400/60 bg-slate-100/75 shadow-[inset_0_1px_1px_rgba(15,23,42,0.45)]" />
      {ticks.map((left, index) => (
        <span
          aria-hidden="true"
          className="absolute top-[58%] h-[3px] w-px -translate-x-1/2 bg-slate-400/70"
          key={`${left}-${index}`}
          style={{ left: `calc(5px + (100% - 10px) * ${left / 100})` }}
        />
      ))}
      <span
        aria-hidden="true"
        className="absolute top-[38%] h-[17px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-[1px] border border-sky-200/70 bg-sky-600 shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
        style={{ left: `calc(5px + (100% - 10px) * ${position / 100})` }}
      />
    </div>
  );
}

export function StatusBarDesignerPreview({ control, isEnabled }: { control: LingControl; isEnabled: boolean }) {
  const configuredParts = normalizeStatusBarParts(control.properties?.parts);
  const textAlign = control.properties?.textAlign === 'center' || control.properties?.textAlign === 'right'
    ? control.properties.textAlign
    : 'left';
  const parts = configuredParts.length > 0
    ? configuredParts
    : [{ title: control.content || '就绪', width: control.width }];
  const background = control.background === 'transparent' ? 'transparent' : control.background;
  const foregroundMatch = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu.exec(control.foreground);
  const separatorColor = foregroundMatch
    ? `rgba(${Number.parseInt(foregroundMatch[1], 16)}, ${Number.parseInt(foregroundMatch[2], 16)}, ${Number.parseInt(foregroundMatch[3], 16)}, 0.22)`
    : `color-mix(in srgb, ${control.foreground} 22%, transparent)`;

  return (
    <div
      aria-label={`状态栏预览，共 ${parts.length} 个分区`}
      className="flex h-full w-full min-w-0 overflow-hidden border"
      style={{
        backgroundColor: background,
        borderColor: separatorColor,
        color: control.foreground,
        fontSize: `${control.fontSize}px`,
        opacity: isEnabled ? 1 : 0.5
      }}
    >
      {parts.map((part, index) => (
        <span
          key={`${index}-${part.title}`}
          className="flex min-w-0 shrink-0 items-center truncate border-r px-2 last:flex-1 last:border-r-0"
          style={{
            borderColor: separatorColor,
            flexBasis: index + 1 === parts.length ? 0 : `${part.width}px`,
            flexGrow: index + 1 === parts.length ? 1 : 0,
            justifyContent: textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start',
            textAlign
          }}
        >
          {part.title}
        </span>
      ))}
    </div>
  );
}

function RebarDesignerPreview({
  control,
  interactive,
  onReorder
}: {
  control: LingControl;
  interactive: boolean;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const configured = Array.isArray(control.properties?.bands) ? control.properties.bands : [];
  const showGrippers = control.properties?.showGrippers !== false && control.properties?.locked !== true;
  const fixedHeight = control.properties?.fixedHeight === true;
  const showBandBorders = control.properties?.showBandBorders === true;
  return (
    <div
      className={`flex h-full w-full content-start overflow-hidden bg-slate-200/90 p-0.5 ${fixedHeight ? 'flex-nowrap' : 'flex-wrap'}`}
      style={{ opacity: control.isEnabled ? 1 : 0.55 }}
      aria-label={`${control.name} Rebar 带区预览`}
    >
      {configured.length === 0 ? (
        <div className="flex h-full w-full items-center justify-center border border-dashed border-slate-500/60 px-2 text-[9px] text-slate-600">
          将控件拖入 Rebar 后自动创建带区
        </div>
      ) : configured.map((rawBand, index) => {
        const band = rawBand && typeof rawBand === 'object' ? rawBand as Record<string, unknown> : {};
        const title = String(band.title ?? `带区 ${index + 1}`);
        const width = Math.max(Number(band.minWidth) || 40, Number(band.width) || 120);
        const height = fixedHeight ? control.height - 4 : Math.max(24, Math.min(control.height - 4, Number(band.height) || 28));
        const breakLine = band.breakLine === true;
        return (
          <React.Fragment key={String(band.id ?? index)}>
          {breakLine && index > 0 && <span className="h-0 basis-full" aria-hidden="true" />}
          <div
            draggable={interactive && control.properties?.locked !== true}
            onMouseDown={event => event.stopPropagation()}
            onDragStart={event => { event.stopPropagation(); setDraggedIndex(index); event.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={event => { if (interactive) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
            onDrop={event => { event.preventDefault(); event.stopPropagation(); if (draggedIndex !== null) onReorder?.(draggedIndex, index); setDraggedIndex(null); }}
            onDragEnd={() => setDraggedIndex(null)}
            className={`flex shrink-0 items-center overflow-hidden bg-gradient-to-b from-slate-50 to-slate-300 text-slate-800 ${showBandBorders ? 'border border-slate-500' : 'border-r border-slate-400/60'} ${draggedIndex === index ? 'opacity-45' : ''}`}
            style={{ width: `${width}px`, height: `${height}px` }}
            title={interactive ? (control.properties?.locked === true ? '带区已锁定' : '拖动可调整带区顺序') : title}
          >
            {showGrippers && <span className="mx-1 grid shrink-0 grid-cols-2 gap-[2px]" aria-hidden="true">{Array.from({ length: 6 }, (_, dot) => <i key={dot} className="h-[2px] w-[2px] rounded-full bg-slate-500" />)}</span>}
            <span className="truncate px-1 text-[9px] font-semibold">{title}</span>
          </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

interface TreeViewPreviewNode {
  id: string;
  title: string;
  expanded: boolean;
  children: TreeViewPreviewNode[];
}

function TreeViewDesignerPreview({ control, isEnabled }: { control: LingControl; isEnabled: boolean }) {
  const normalizeNodes = (value: unknown, path = 'node'): TreeViewPreviewNode[] => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item, index) => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      return [{
        id: String(record.id ?? `${path}-${index}`),
        title: String(record.title ?? record.label ?? record.name ?? record.text ?? record.id ?? ''),
        expanded: record.expanded === true,
        children: normalizeNodes(record.children, `${path}-${index}`)
      }];
    });
  };
  const nodes = normalizeNodes(control.properties?.nodes);
  const showLines = control.properties?.showLines !== false;
  const showCheckBoxes = control.properties?.checkBoxes === true;
  const borderWidth = Math.max(0, Math.min(8, Number(control.properties?.borderWidth ?? 1)));
  const borderColor = String(control.properties?.borderColor ?? '#64748B');
  const nodeSpacing = Math.max(0, Math.min(24, Number(control.properties?.nodeSpacing ?? 2)));
  const nodePadding = Math.max(0, Math.min(24, Number(control.properties?.nodePadding ?? 3)));

  const renderNodes = (items: TreeViewPreviewNode[], depth = 0): React.ReactNode => items.map(node => (
    <React.Fragment key={`${depth}:${node.id}`}>
      <div
        className="relative flex min-w-0 items-center gap-1.5 pr-1"
        style={{
          minHeight: `${Math.max(18, control.fontSize + nodePadding * 2)}px`,
          marginBottom: `${nodeSpacing}px`,
          paddingLeft: `${nodePadding + 4 + depth * (18 + nodePadding)}px`,
          paddingTop: `${nodePadding}px`,
          paddingBottom: `${nodePadding}px`
        }}
      >
        {showLines && depth > 0 && (
          <span className="absolute bottom-1/2 top-0 border-l opacity-45" style={{ left: `${nodePadding + 11 + (depth - 1) * (18 + nodePadding)}px`, borderColor: control.foreground }} />
        )}
        <span className="w-3 shrink-0 text-center text-[9px] opacity-70">{node.children.length > 0 ? node.expanded ? '▾' : '▸' : ''}</span>
        {showCheckBoxes && <span className="h-3 w-3 shrink-0 border opacity-70" style={{ borderColor: control.foreground }} />}
        <span className="min-w-0 truncate">{node.title}</span>
      </div>
      {node.expanded && node.children.length > 0 && renderNodes(node.children, depth + 1)}
    </React.Fragment>
  ));

  return (
    <div
      className="box-border h-full w-full overflow-hidden"
      style={{
        backgroundColor: control.background === 'transparent' ? '#1E1E24' : control.background,
        borderStyle: borderWidth > 0 ? 'solid' : 'none',
        borderWidth: `${borderWidth}px`,
        borderColor,
        color: control.foreground,
        fontSize: `${control.fontSize}px`,
        opacity: isEnabled ? 1 : 0.5
      }}
    >
      {renderNodes(nodes)}
    </div>
  );
}

function PropertyGroup({
  title,
  isDarkMode,
  defaultOpen = true,
  children
}: {
  title: string;
  isDarkMode: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className={`overflow-hidden rounded border ${
        isDarkMode ? 'border-[#30303a] bg-[#18181e]' : 'border-slate-200 bg-white'
      }`}
    >
      <summary className={`flex h-7 cursor-pointer select-none items-center px-2 text-[10px] font-bold uppercase tracking-wide ${
        isDarkMode ? 'bg-[#22222a] text-slate-300 hover:bg-[#292934]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}>
        {title}
      </summary>
      <div className={`divide-y ${isDarkMode ? 'divide-[#2b2b34]' : 'divide-slate-200'}`}>
        {children}
      </div>
    </details>
  );
}

function PropertyRow({
  label,
  isDarkMode,
  children
}: {
  label: string;
  isDarkMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid min-h-8 grid-cols-[40%_60%] items-stretch text-[11px] ${
      isDarkMode ? 'text-slate-300' : 'text-slate-700'
    }`}>
      <span className={`flex items-center border-r px-2 font-medium ${
        isDarkMode ? 'border-[#2b2b34] bg-[#202026] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
      }`}>
        {label}
      </span>
      <span className="flex min-w-0 items-center px-2 py-1">
        {children}
      </span>
    </div>
  );
}

function openDesignerSelectPicker(event: React.MouseEvent<HTMLSelectElement>): void {
  if (event.button !== 0 || typeof event.currentTarget.showPicker !== 'function') return;
  try {
    event.currentTarget.focus();
    event.currentTarget.showPicker();
    event.preventDefault();
  } catch {
    // Let Chromium continue with the native select behavior when showPicker is unavailable.
  }
}

function WindowProperties({
  projectId,
  window,
  isDarkMode,
  newEmojiAvailable,
  onChange
}: {
  projectId: string;
  window: LingWindowModel;
  isDarkMode: boolean;
  newEmojiAvailable: boolean;
  onChange: (fields: Partial<LingWindowModel>) => void;
}) {
  const [isSelectingIcon, setIsSelectingIcon] = useState(false);
  const [iconStatus, setIconStatus] = useState('');
  const [siteDraft, setSiteDraft] = useState<EmbeddedSiteDraft>(() => draftFromEmbeddedSite(window.embeddedSite));
  const [siteScanDirectory, setSiteScanDirectory] = useState(() => getEmbeddedSiteEntryDirectory(window.embeddedSite?.entry || '').replace(/\/$/u, ''));
  const [siteScanning, setSiteScanning] = useState(false);
  const [siteStatus, setSiteStatus] = useState('');
  useEffect(() => {
    setSiteDraft(draftFromEmbeddedSite(window.embeddedSite));
    setSiteScanDirectory(getEmbeddedSiteEntryDirectory(window.embeddedSite?.entry || '').replace(/\/$/u, ''));
    setSiteStatus('');
    // 切换选中窗口时才重置内嵌站点草稿；编辑过程中以本地草稿为准，失焦时提交。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window.id]);
  const commitEmbeddedSiteDraft = (draft: EmbeddedSiteDraft) => {
    setSiteDraft(draft);
    onChange({ embeddedSite: embeddedSiteFromDraft(draft) });
  };
  const runEmbeddedSiteScan = async () => {
    const directory = siteScanDirectory.trim();
    if (!directory) {
      setSiteStatus('请先填写站点目录（工作区相对路径，如 www）。');
      return;
    }
    setSiteScanning(true);
    try {
      const files = await scanEmbeddedSiteDirectory(directory);
      if (files.length === 0) {
        setSiteStatus(`目录 ${directory} 中没有文件。`);
        return;
      }
      const entry = siteDraft.entry.trim().replace(/\\/gu, '/');
      const nextEntry = entry && files.includes(entry) ? entry : pickEmbeddedSiteEntry(files);
      commitEmbeddedSiteDraft({ ...siteDraft, entry: nextEntry, filesText: files.join('\n') });
      setSiteStatus(`已扫描 ${files.length} 个文件，入口：${nextEntry}`);
    } catch (error) {
      setSiteStatus(`扫描失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSiteScanning(false);
    }
  };
  const embeddedSiteProblems = validateEmbeddedSiteDraft(siteDraft);
  const openPlacement = window.openPlacement || 'default';
  const windowFrame = normalizeLingWindowFrame(window.windowFrame, deriveLingWindowBorderStyle(window.borderStyle), window.cornerStyle);
  const updateWindowFrameFlag = (flag: number, enabled: boolean) => {
    const flags = enabled ? windowFrame.flags | flag : windowFrame.flags & ~flag;
    onChange({
      windowFrame: { ...windowFrame, preset: 'custom', flags },
      ...(flag === 0x08 ? {
        resizable: enabled,
        borderStyle: toggleBorderFamily(window.borderStyle, enabled)
      } : {}),
      ...(flag === 0x10 ? { cornerStyle: enabled ? 'rounded' : 'square' } : {})
    });
  };
  const handleOpenPlacementChange = (value: LingWindowOpenPlacement) => {
    onChange({
      openPlacement: value,
      ...(value === 'custom' ? { openX: window.openX ?? 120, openY: window.openY ?? 80 } : {})
    });
  };
  const chooseCustomIcon = async () => {
    setIsSelectingIcon(true);
    setIconStatus('正在选择图标…');
    try {
      const result = await selectAndImportDesignerIcon(projectId);
      if (result.canceled) {
        setIconStatus('已取消选择。');
        return;
      }
      if (!result.ok || !result.relativePath) {
        setIconStatus(result.error || '窗口图标复制失败。');
        return;
      }
      onChange({ iconStyle: 'custom', iconPath: result.relativePath });
      setIconStatus(`已导入：${result.relativePath}`);
    } catch (error) {
      setIconStatus(error instanceof Error ? error.message : '窗口图标选择失败。');
    } finally {
      setIsSelectingIcon(false);
    }
  };

  return (
    <div className="space-y-2">
      <PropertyGroup title="当前窗口 / 布局" isDarkMode={isDarkMode}>
        <PropertyRow label="设计后端" isDarkMode={isDarkMode}>
          <select
            value={migrateDesignerBackend(window.designerBackend, newEmojiAvailable)}
            onChange={event => onChange({ designerBackend: event.target.value })}
            disabled={window.controls.length > 0}
            title={window.controls.length > 0 ? '窗口已有控件时不能切换后端，请新建窗口或先清空控件。' : undefined}
            aria-label="窗口设计后端"
            className={`w-full rounded border px-2 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`}
          >
            <option value="win32">Win32 原生控件</option>
            <option value="new-emoji" disabled={!newEmojiAvailable}>new_emoji 模块</option>
          </select>
        </PropertyRow>
        {window.controls.length > 0 && <div className="px-2 pb-1 text-[9px] leading-4 text-slate-500">窗口已有控件，后端已锁定；新建窗口可选择另一后端。</div>}
        <NumberField label="宽度" value={window.width} min={360} isDarkMode={isDarkMode} onChange={value => onChange({ width: value })} />
        <NumberField label="高度" value={window.height} min={240} isDarkMode={isDarkMode} onChange={value => onChange({ height: value })} />
      </PropertyGroup>
      <PropertyGroup title="当前窗口 / 打开位置" isDarkMode={isDarkMode}>
        <PropertyRow label="打开位置" isDarkMode={isDarkMode}>
          <select
            value={openPlacement}
            onChange={event => handleOpenPlacementChange(event.target.value as LingWindowOpenPlacement)}
            className={`w-full rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 ${
              isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
            }`}
            aria-label="窗口打开位置"
          >
            {WINDOW_OPEN_PLACEMENT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </PropertyRow>
        {openPlacement === 'custom' && (
          <>
            <NumberField label="屏幕左距" value={window.openX ?? 120} min={0} isDarkMode={isDarkMode} onChange={value => onChange({ openPlacement: 'custom', openX: value })} />
            <NumberField label="屏幕顶距" value={window.openY ?? 80} min={0} isDarkMode={isDarkMode} onChange={value => onChange({ openPlacement: 'custom', openY: value })} />
          </>
        )}
      </PropertyGroup>
      <PropertyGroup title="当前窗口 / 外观" isDarkMode={isDarkMode}>
        <TextField label="窗口标题" value={window.title} isDarkMode={isDarkMode} onChange={value => onChange({ title: value })} />
        <TextField label="说明" value={window.description} isDarkMode={isDarkMode} onChange={value => onChange({ description: value })} />
        <ColorField
          label="背景颜色"
          value={window.background}
          isDarkMode={isDarkMode}
          swatches={['#FFFFFF', '#F8FAFC', '#1E1E24', '#252526', '#0F172A', '#111827', '#1D4ED8', '#0F766E']}
          onChange={value => onChange({ background: value })}
        />
        <ColorField
          label="标题栏颜色"
          value={window.titleBarBackground || DEFAULT_WINDOW_TITLE_BAR_BACKGROUND}
          isDarkMode={isDarkMode}
          swatches={['#FFFFFF', '#F8FAFC', '#2D2D30', '#1F2937', '#0F172A', '#1D4ED8', '#0F766E']}
          onChange={value => onChange({ titleBarBackground: value })}
        />
        <ColorField
          label="标题文字颜色"
          value={window.titleBarForeground || DEFAULT_WINDOW_TITLE_BAR_FOREGROUND}
          isDarkMode={isDarkMode}
          swatches={['#FFFFFF', '#F8FAFC', '#CBD5E1', '#111827', '#0F172A', '#FDE68A']}
          onChange={value => onChange({ titleBarForeground: value })}
        />
        <PropertyRow label="边框" isDarkMode={isDarkMode}>
          <select
            value={window.borderStyle || DEFAULT_WINDOW_BORDER_STYLE}
            onChange={event => {
              const borderStyle = event.target.value as LingWindowBorderStyle;
              const hasSizingBorder = deriveLingWindowBorderStyle(borderStyle);
              onChange({
                borderStyle,
                borderlessDraggable: false,
                resizable: hasSizingBorder,
                windowFrame: {
                  ...windowFrame,
                  ...(windowFrame.preset === 'custom' ? { flags: hasSizingBorder ? windowFrame.flags | 0x08 : windowFrame.flags & ~0x08 } : {}),
                  resizeBorder: hasSizingBorder ? windowFrame.resizeBorder : { left: 0, top: 0, right: 0, bottom: 0 }
                }
              });
            }}
            className={`w-full rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
            aria-label="窗口边框"
          >
            {LING_WINDOW_BORDER_STYLE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </PropertyRow>
        {(window.borderStyle || DEFAULT_WINDOW_BORDER_STYLE) === 'none' && (
          <PropertyRow label="允许拖动移动窗口" isDarkMode={isDarkMode}>
            <input
              type="checkbox"
              checked={window.borderlessDraggable === true}
              onChange={event => onChange({ borderlessDraggable: event.target.checked })}
              aria-label="无边框窗口拖动移动"
              className="h-4 w-4 accent-amber-500"
            />
          </PropertyRow>
        )}
        <PropertyRow label="窗口圆角" isDarkMode={isDarkMode}>
          <select
            value={window.cornerStyle || DEFAULT_WINDOW_CORNER_STYLE}
            onChange={event => {
              const cornerStyle = event.target.value as LingWindowCornerStyle;
              const cornerRadius = cornerStyle === 'square' ? 0 : cornerStyle === 'small-rounded' ? 6 : 10;
              onChange({ cornerStyle, windowFrame: { ...windowFrame, cornerRadius } });
            }}
            className={`w-full rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
            aria-label="窗口圆角"
          >
            <option value="rounded">圆角（系统支持时）</option>
            <option value="small-rounded">小圆角（系统支持时）</option>
            <option value="square">直角</option>
            <option value="system">跟随系统</option>
          </select>
        </PropertyRow>
        <PropertyRow label="窗口图标" isDarkMode={isDarkMode}>
          <select
            value={window.iconStyle || DEFAULT_WINDOW_ICON_STYLE}
            onChange={event => onChange({ iconStyle: event.target.value as LingWindowIconStyle })}
            className={`w-full rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
            aria-label="窗口图标"
          >
            <option value="lingbuilder">LingBuilder 内置图标</option>
            <option value="system">系统应用图标</option>
            <option value="custom">自定义图标</option>
            <option value="none">不显示图标</option>
          </select>
        </PropertyRow>
        {(window.iconStyle || DEFAULT_WINDOW_ICON_STYLE) === 'custom' && (
          <PropertyRow label="图标文件" isDarkMode={isDarkMode}>
            <div className="min-w-0 space-y-1">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={window.iconPath || ''}
                  readOnly
                  placeholder="请选择 .ico 图标"
                  aria-label="自定义窗口图标路径"
                  className={`min-w-0 flex-1 rounded border px-2 py-0.5 text-xs ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700'}`}
                />
                <button
                  type="button"
                  onClick={() => void chooseCustomIcon()}
                  disabled={isSelectingIcon}
                  title="选择 ICO 文件并复制到当前项目 assets 目录"
                  aria-label="选择自定义窗口图标"
                  className={`flex h-7 w-8 shrink-0 items-center justify-center rounded border transition-colors disabled:cursor-wait disabled:opacity-50 ${isDarkMode ? 'border-[#3c3c44] bg-[#24242b] text-amber-400 hover:bg-[#303038]' : 'border-slate-300 bg-white text-amber-600 hover:bg-slate-100'}`}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className={`text-[9px] leading-3 ${iconStatus.includes('失败') || iconStatus.includes('必须') ? 'text-red-400' : 'text-slate-500'}`}>
                {iconStatus || '建议 ICO 内包含 16、32、48、256 像素尺寸，以兼顾标题栏和任务栏清晰度。'}
              </div>
            </div>
          </PropertyRow>
        )}
      </PropertyGroup>
      <PropertyGroup title="当前窗口 / 内嵌站点" isDarkMode={isDarkMode}>
        <PropertyRow label="内嵌站点" isDarkMode={isDarkMode}>
          <input
            type="checkbox"
            checked={Boolean(window.embeddedSite)}
            onChange={event => {
              if (!event.target.checked) {
                onChange({ embeddedSite: undefined });
                setSiteStatus('');
                return;
              }
              commitEmbeddedSiteDraft(siteDraft);
            }}
            aria-label="启用内嵌站点"
            className="h-4 w-4 accent-amber-500"
          />
        </PropertyRow>
        {window.embeddedSite && (
          <>
            <PropertyRow label="主机名" isDarkMode={isDarkMode}>
              <input
                type="text"
                value={siteDraft.host}
                placeholder="embedded.local"
                aria-label="内嵌站点主机名"
                onChange={event => commitEmbeddedSiteDraft({ ...siteDraft, host: event.target.value })}
                className={`w-full rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
              />
            </PropertyRow>
            <PropertyRow label="入口文件" isDarkMode={isDarkMode}>
              <input
                type="text"
                value={siteDraft.entry}
                placeholder="www/index.html"
                aria-label="内嵌站点入口文件"
                onChange={event => commitEmbeddedSiteDraft({ ...siteDraft, entry: event.target.value })}
                className={`w-full rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
              />
            </PropertyRow>
            <PropertyRow label="扫描目录" isDarkMode={isDarkMode}>
              <div className="min-w-0 space-y-1">
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={siteScanDirectory}
                    placeholder="工作区内目录，如 www"
                    aria-label="内嵌站点扫描目录"
                    onChange={event => setSiteScanDirectory(event.target.value)}
                    className={`min-w-0 flex-1 rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
                  />
                  <button
                    type="button"
                    onClick={() => void runEmbeddedSiteScan()}
                    disabled={siteScanning}
                    title="递归扫描目录并把全部文件填入清单（替换现有清单）"
                    className={`h-7 shrink-0 whitespace-nowrap rounded border px-2 text-xs transition-colors disabled:cursor-wait disabled:opacity-50 ${isDarkMode ? 'border-[#3c3c44] bg-[#24242b] text-amber-400 hover:bg-[#303038]' : 'border-slate-300 bg-white text-amber-600 hover:bg-slate-100'}`}
                  >
                    {siteScanning ? '扫描中…' : '扫描目录'}
                  </button>
                </div>
              </div>
            </PropertyRow>
            <PropertyRow label="文件清单" isDarkMode={isDarkMode}>
              <div className="min-w-0 space-y-1">
                <textarea
                  value={siteDraft.filesText}
                  onChange={event => setSiteDraft({ ...siteDraft, filesText: event.target.value })}
                  onBlur={() => commitEmbeddedSiteDraft(siteDraft)}
                  rows={8}
                  spellCheck={false}
                  placeholder={'每行一个工作区相对路径，如：\nwww/index.html\nwww/assets/index.js'}
                  aria-label="内嵌站点文件清单"
                  className={`w-full rounded border px-2 py-1 font-mono text-[11px] leading-4 focus:outline-none focus:border-amber-500 ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
                />
                <div className={`text-[9px] leading-3 ${embeddedSiteProblems.length > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {embeddedSiteProblems.length > 0
                    ? embeddedSiteProblems.join('；')
                    : `共 ${parseEmbeddedSiteFilesText(siteDraft.filesText).length} 个文件。构建时编入 EXE 内存服务，运行期零释放；需配合 EdgeBrowser 控件与 EdgeView 浏览器模块使用。`}
                </div>
                {siteStatus && (
                  <div className={`text-[9px] leading-3 ${siteStatus.includes('失败') || siteStatus.includes('没有文件') ? 'text-red-400' : 'text-slate-500'}`}>
                    {siteStatus}
                  </div>
                )}
              </div>
            </PropertyRow>
          </>
        )}
      </PropertyGroup>
      {migrateDesignerBackend(window.designerBackend, newEmojiAvailable) === 'new-emoji' && (
        <PropertyGroup title="当前窗口 / 原生框架" isDarkMode={isDarkMode}>
          <PropertyRow label="框架预设" isDarkMode={isDarkMode}>
            <select
              value={windowFrame.preset}
              onChange={event => {
                const preset = event.target.value as 'system' | 'browserShell' | 'custom';
                const flags = preset === 'browserShell' ? NEW_EMOJI_BROWSER_SHELL_FRAME_FLAGS : preset === 'system' ? 0 : windowFrame.flags;
                onChange({
                  windowFrame: { ...windowFrame, preset, flags },
                  ...(preset === 'browserShell' ? { resizable: true, cornerStyle: 'rounded' as const, borderStyle: DEFAULT_WINDOW_BORDER_STYLE } : {})
                });
              }}
              className={`w-full rounded border px-2 py-0.5 text-xs ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`}
              aria-label="new_emoji 窗口框架预设"
            >
              <option value="system">系统窗口</option>
              <option value="browserShell">浏览器外壳</option>
              <option value="custom">自定义 flags</option>
            </select>
          </PropertyRow>
          <ReadOnlyTextField label="精确 flags" value={`0x${windowFrame.flags.toString(16).padStart(2, '0').toUpperCase()}`} isDarkMode={isDarkMode} />
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 px-2 py-1">
            {NEW_EMOJI_WINDOW_FRAME_FLAG_OPTIONS.map(option => (
              <label key={option.flag} className="flex min-w-0 items-center gap-1.5 text-[10px] text-slate-500">
                <input
                  type="checkbox"
                  checked={(windowFrame.flags & option.flag) !== 0}
                  onChange={event => updateWindowFrameFlag(option.flag, event.target.checked)}
                  disabled={option.flag === 0x08 && (window.borderStyle || DEFAULT_WINDOW_BORDER_STYLE) === 'none'}
                  className="h-3.5 w-3.5 accent-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40"
                />
                <span className="truncate">{option.label}</span>
              </label>
            ))}
          </div>
          <NumberField label="左缩放边框" value={windowFrame.resizeBorder.left} min={0} max={64} isDarkMode={isDarkMode} onChange={value => onChange({ windowFrame: { ...windowFrame, resizeBorder: { ...windowFrame.resizeBorder, left: value } } })} />
          <NumberField label="上缩放边框" value={windowFrame.resizeBorder.top} min={0} max={64} isDarkMode={isDarkMode} onChange={value => onChange({ windowFrame: { ...windowFrame, resizeBorder: { ...windowFrame.resizeBorder, top: value } } })} />
          <NumberField label="右缩放边框" value={windowFrame.resizeBorder.right} min={0} max={64} isDarkMode={isDarkMode} onChange={value => onChange({ windowFrame: { ...windowFrame, resizeBorder: { ...windowFrame.resizeBorder, right: value } } })} />
          <NumberField label="下缩放边框" value={windowFrame.resizeBorder.bottom} min={0} max={64} isDarkMode={isDarkMode} onChange={value => onChange({ windowFrame: { ...windowFrame, resizeBorder: { ...windowFrame.resizeBorder, bottom: value } } })} />
          <NumberField label="圆角半径" value={windowFrame.cornerRadius} min={0} max={64} isDarkMode={isDarkMode} onChange={value => onChange({ windowFrame: { ...windowFrame, cornerRadius: value } })} />
        </PropertyGroup>
      )}
      <PropertyGroup title="当前窗口 / 状态" isDarkMode={isDarkMode} defaultOpen={false}>
        <PropertyRow label="禁止窗口最大化" isDarkMode={isDarkMode}>
          <input
            type="checkbox"
            checked={window.maximizable === false}
            disabled={(window.borderStyle || DEFAULT_WINDOW_BORDER_STYLE) === 'none'}
            onChange={event => onChange({ maximizable: !event.target.checked })}
            aria-label="禁止窗口最大化"
            className="h-4 w-4 accent-amber-500 disabled:opacity-40"
          />
        </PropertyRow>
        <ReadOnlyTextField label="类名" value={window.className} isDarkMode={isDarkMode} />
        <ReadOnlyTextField label="文件名" value={window.fileName} isDarkMode={isDarkMode} />
        <div
          role="note"
          className={`px-2.5 py-2 text-[9.5px] leading-4 ${
            isDarkMode ? 'bg-amber-500/5 text-amber-200/70' : 'bg-amber-50 text-amber-800'
          }`}
        >
          类名和文件名与中文源码关联。当前设计器中只读，工作台也会阻止单独重命名已绑定的 .lcpp；请通过创建或迁移窗口保持三者一致，避免静默脱钩。
        </div>
      </PropertyGroup>
    </div>
  );
}

const FILE_DIALOG_FILTER_PRESETS = [
  { id: 'all', label: '所有文件', description: '不限制文件类型', filter: '所有文件|*.*' },
  { id: 'image', label: '图片文件', description: 'PNG、JPG、BMP、GIF、WebP', filter: '图片文件|*.png;*.jpg;*.jpeg;*.bmp;*.gif;*.webp' },
  { id: 'document', label: '文档文件', description: 'PDF、Word、Excel、文本', filter: '文档文件|*.pdf;*.doc;*.docx;*.xls;*.xlsx;*.txt' },
  { id: 'audio', label: '音频文件', description: 'MP3、WAV、FLAC、AAC', filter: '音频文件|*.mp3;*.wav;*.flac;*.aac' },
  { id: 'video', label: '视频文件', description: 'MP4、AVI、MOV、MKV', filter: '视频文件|*.mp4;*.avi;*.mov;*.mkv' },
  { id: 'archive', label: '压缩包', description: 'ZIP、7Z、RAR', filter: '压缩包|*.zip;*.7z;*.rar' }
] as const;

function parseFileDialogFilter(filter: string) {
  const parts = filter.split('|');
  return {
    label: parts[0]?.trim() || '自定义文件',
    patterns: parts[1]?.trim() || '*.*'
  };
}

function normalizeFileDialogExtensions(value: string) {
  const patterns = value
    .split(/[\s,;，；]+/u)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => item === '*' || item === '*.*' ? '*.*' : item.startsWith('*.') ? item : item.startsWith('.') ? `*${item}` : `*.${item}`);
  return patterns.length > 0 ? patterns.join(';') : '*.*';
}

function formatFileDialogExtensions(patterns: string) {
  return patterns.split(';').map(item => item.trim() === '*.*' ? '*' : item.trim().replace(/^\*/u, '')).filter(Boolean).join(', ');
}

function FileDialogFilterEditor({ value, isDarkMode, onChange }: { value: string; isDarkMode: boolean; onChange: (value: string) => void }) {
  const preset = FILE_DIALOG_FILTER_PRESETS.find(item => item.filter === value);
  const parsed = parseFileDialogFilter(value);
  const [extensionDraft, setExtensionDraft] = useState(() => formatFileDialogExtensions(parsed.patterns));
  useEffect(() => setExtensionDraft(formatFileDialogExtensions(parsed.patterns)), [parsed.patterns]);
  const inputClass = `w-full rounded border px-2 py-1.5 text-[10px] ${isDarkMode ? 'border-[#3c3c44] bg-[#1b1b20] text-slate-200' : 'border-slate-300 bg-white text-slate-800'}`;
  return (
    <div className={`space-y-2 p-2 text-[10px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
      <label className="block space-y-1">
        <span className="font-medium">文件类型</span>
        <select
          aria-label="文件对话框文件类型"
          value={preset?.id || 'custom'}
          onChange={event => {
            const selected = FILE_DIALOG_FILTER_PRESETS.find(item => item.id === event.target.value);
            onChange(selected?.filter || '自定义文件|*.*');
          }}
          className={inputClass}
        >
          {FILE_DIALOG_FILTER_PRESETS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          <option value="custom">自定义…</option>
        </select>
      </label>
      {preset ? (
        <div className={`rounded border px-2 py-1.5 leading-4 ${isDarkMode ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200/80' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          将只显示：{preset.description}
        </div>
      ) : (
        <div className={`space-y-2 rounded border p-2 ${isDarkMode ? 'border-amber-500/25 bg-amber-500/5' : 'border-amber-200 bg-amber-50'}`}>
          <label className="block space-y-1"><span>类型名称</span><input aria-label="自定义文件类型名称" value={parsed.label} onChange={event => onChange(`${event.target.value || '自定义文件'}|${parsed.patterns}`)} placeholder="例如：设计图" className={inputClass} /></label>
          <label className="block space-y-1"><span>允许的扩展名</span><input aria-label="自定义文件扩展名" value={extensionDraft} onChange={event => setExtensionDraft(event.target.value)} onBlur={() => onChange(`${parsed.label}|${normalizeFileDialogExtensions(extensionDraft)}`)} placeholder=".png, .jpg, .webp" className={inputClass} /></label>
          <div className="leading-4 text-slate-500">用逗号分隔，例如 <code>.png, .jpg</code>。</div>
        </div>
      )}
      <details className={`rounded border ${isDarkMode ? 'border-[#34343d]' : 'border-slate-200'}`}>
        <summary className="cursor-pointer px-2 py-1.5 text-slate-500">高级：原始筛选规则</summary>
        <div className="space-y-1 border-t border-inherit p-2">
          <input aria-label="文件对话框原始筛选规则" value={value} onChange={event => onChange(event.target.value)} className={inputClass} />
          <div className="leading-4 text-slate-500">兼容格式：<code>图片|*.png;*.jpg</code>，通常无需手动修改。</div>
        </div>
      </details>
    </div>
  );
}

function FileDialogProperties({
  resource,
  windows,
  isDarkMode,
  onChange,
  onDelete
}: {
  resource: LingFileDialogResource;
  windows: LingWindowModel[];
  isDarkMode: boolean;
  onChange: (fields: Partial<LingFileDialogResource>) => void;
  onDelete: () => void;
}) {
  const ownerWindow = windows.find(window => window.id === resource.ownerWindowId) || windows[0];
  const ownerControls = ownerWindow?.controls || [];
  const triggerControls = ownerControls.filter(control => ['Button', 'Label', 'SysLink'].includes(control.type));
  const inputClass = `w-full rounded border px-1.5 py-1 text-[10px] ${isDarkMode ? 'border-[#3c3c44] bg-[#1b1b20] text-slate-200' : 'border-slate-300 bg-white text-slate-800'}`;
  return (
    <div className="space-y-3" aria-label={`文件对话框属性：${resource.name}`}>
      <div className={`flex items-center gap-2 border-b pb-2 text-[11px] ${isDarkMode ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
        <FolderOpen className="h-4 w-4 text-emerald-500" />
        <span className="font-semibold">文件对话框：{resource.name}</span>
        <span className="ml-auto rounded border border-emerald-500/30 px-1.5 py-0.5 text-[8px] text-emerald-500">设计控件</span>
      </div>
      <PropertyGroup title="外观与位置" isDarkMode={isDarkMode}>
        <PropertyRow label="名称" isDarkMode={isDarkMode}><input aria-label="文件对话框组件名称" value={resource.name} onChange={event => onChange({ name: event.target.value })} className={inputClass} /></PropertyRow>
        <PropertyRow label="左" isDarkMode={isDarkMode}><input aria-label="文件对话框左坐标" type="number" min={0} value={resource.designerX ?? 0} onChange={event => onChange({ designerX: Math.max(0, Number(event.target.value) || 0) })} className={inputClass} /></PropertyRow>
        <PropertyRow label="顶" isDarkMode={isDarkMode}><input aria-label="文件对话框顶坐标" type="number" min={0} value={resource.designerY ?? 0} onChange={event => onChange({ designerY: Math.max(0, Number(event.target.value) || 0) })} className={inputClass} /></PropertyRow>
      </PropertyGroup>
      <PropertyGroup title="文件选择" isDarkMode={isDarkMode}>
        <PropertyRow label="所属窗口" isDarkMode={isDarkMode}><select aria-label="文件对话框所属窗口" value={resource.ownerWindowId} onChange={event => onChange({ ownerWindowId: event.target.value, triggerControlId: '', dropTargetId: event.target.value })} className={inputClass}>{windows.map(window => <option key={window.id} value={window.id}>{window.title}</option>)}</select></PropertyRow>
        <PropertyRow label="打开控件" isDarkMode={isDarkMode}><select aria-label="文件对话框打开触发控件" value={resource.triggerControlId} onChange={event => onChange({ triggerControlId: event.target.value })} className={inputClass}><option value="">不自动绑定（代码打开）</option>{triggerControls.map(control => <option key={control.id} value={control.id}>{control.name}（{CONTROL_LABELS[control.type]}）</option>)}</select></PropertyRow>
        <PropertyRow label="拖放目标" isDarkMode={isDarkMode}><select aria-label="文件对话框拖放目标" value={resource.dropTargetId} onChange={event => onChange({ dropTargetId: event.target.value, allowDrop: true })} className={inputClass}><option value={ownerWindow?.id || ''}>当前窗口</option>{ownerControls.map(control => <option key={control.id} value={control.id}>{control.name}（{CONTROL_LABELS[control.type]}）</option>)}</select></PropertyRow>
        <PropertyRow label="标题" isDarkMode={isDarkMode}><input aria-label="文件对话框标题" value={resource.title} onChange={event => onChange({ title: event.target.value })} className={inputClass} /></PropertyRow>
        <FileDialogFilterEditor value={resource.filter} isDarkMode={isDarkMode} onChange={filter => onChange({ filter })} />
        <PropertyRow label="选项" isDarkMode={isDarkMode}><span className="flex flex-wrap gap-3 text-[10px]"><label className="flex items-center gap-1"><input type="checkbox" checked={resource.multiple} onChange={event => onChange({ multiple: event.target.checked })} />允许多选</label><label className="flex items-center gap-1"><input type="checkbox" checked={resource.allowDrop} onChange={event => onChange({ allowDrop: event.target.checked })} />允许拖放</label></span></PropertyRow>
      </PropertyGroup>
      <div className="text-[9px] leading-4 text-slate-500">运行时不绘制占位外观。代码可调用：文件对话框_打开(&quot;{resource.name}&quot;)。</div>
      <button type="button" onClick={onDelete} className="flex w-full items-center justify-center gap-1 rounded border border-red-500/30 py-1.5 text-[10px] text-red-400 hover:bg-red-500/10"><Trash2 className="h-3 w-3" />删除文件对话框</button>
    </div>
  );
}

function FileDialogEvents({ resource, windowModel, isDarkMode, onChange }: { resource: LingFileDialogResource; windowModel: LingWindowModel; isDarkMode: boolean; onChange: (fields: Partial<LingFileDialogResource>) => void }) {
  const definitions: Array<{ field: 'filesSelectedHandler' | 'filesDroppedHandler' | 'cancelledHandler'; eventName: string; label: string; description: string; suffix: string }> = [
    { field: 'filesSelectedHandler', eventName: 'FilesSelected', label: '文件已选择', description: '用户在文件对话框中确认选择后触发。', suffix: '文件已选择' },
    { field: 'filesDroppedHandler', eventName: 'FilesDropped', label: '文件被拖入', description: '文件被拖放到绑定目标后触发。', suffix: '文件被拖入' },
    { field: 'cancelledHandler', eventName: 'Cancelled', label: '选择被取消', description: '用户取消文件选择后触发。', suffix: '选择被取消' }
  ];
  const openEventCode = (definition: typeof definitions[number]) => {
    const current = resource[definition.field] || '';
    const handlerName = current.trim() || `_${resource.name}_${definition.suffix}`;
    onChange({ [definition.field]: handlerName });
    const detail: OpenControlEventCodeDetail = {
      controlId: resource.id,
      controlName: resource.name,
      controlContent: resource.title,
      controlType: 'FileDialog',
      eventName: definition.eventName,
      handlerName,
      windowFileName: windowModel.fileName,
      windowClassName: windowModel.className,
      windowTitle: windowModel.title
    };
    globalThis.window.dispatchEvent(new CustomEvent<OpenControlEventCodeDetail>('open-control-event-code', { detail }));
  };
  return (
    <div className="space-y-3" aria-label={`文件对话框事件：${resource.name}`}>
      <div className={`flex items-center gap-1.5 border-b pb-2 text-[11px] ${isDarkMode ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'}`}><Zap className="h-3.5 w-3.5 text-amber-500" /><span className="font-semibold">事件绑定：{resource.name}</span></div>
      {definitions.map(definition => {
        const current = resource[definition.field] || '';
        const isBound = Boolean(current.trim());
        const handlerName = current.trim() || `_${resource.name}_${definition.suffix}`;
        return <button key={definition.eventName} type="button" onClick={() => openEventCode(definition)} aria-label={`${isBound ? '打开' : '创建并打开'}${definition.label}事件处理器 ${handlerName}`} className={`group w-full rounded border p-2.5 text-left ${isDarkMode ? 'border-slate-800/70 bg-slate-900/40 hover:border-amber-500/45' : 'border-slate-200 bg-white hover:border-amber-400'}`}>
          <div className="flex items-start justify-between gap-2"><span><span className={`block text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{definition.label}</span><span className="mt-0.5 block text-[9.5px] text-slate-500">{definition.description}</span></span><span className={`shrink-0 rounded border px-1.5 py-0.5 text-[8px] ${isBound ? 'border-emerald-500/25 text-emerald-400' : 'border-amber-500/25 text-amber-500'}`}>{isBound ? '已绑定' : '未绑定'}</span></div>
          <div className={`mt-2 flex min-h-7 items-center gap-2 rounded border px-2 py-1 ${isDarkMode ? 'border-[#2d2d34] bg-[#1b1b20]' : 'border-slate-200 bg-slate-50'}`}><FileCode className={`h-3.5 w-3.5 ${isBound ? 'text-emerald-400' : 'text-amber-500'}`} /><span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-slate-500">{handlerName}</span><span className="text-[9px] font-semibold text-slate-500">{isBound ? '打开代码' : '生成并打开'}</span></div>
        </button>;
      })}
    </div>
  );
}

function createMenuResourceItem(items: LingMenuResourceItem[]): LingMenuResourceItem {
  let suffix = items.length + 1;
  while (items.some(item => item.id === `item-${suffix}`)) suffix += 1;
  return { id: `item-${suffix}`, label: `菜单项 ${suffix}`, enabled: true };
}

function MenuResourceProperties({ resource, windows, isDarkMode, onChange, onDelete }: {
  resource: LingMenuResource;
  windows: LingWindowModel[];
  isDarkMode: boolean;
  onChange: (fields: Partial<LingMenuResource>) => void;
  onDelete: () => void;
}) {
  const ownerWindow = windows.find(window => window.id === resource.ownerWindowId) || windows[0];
  const inputClass = `w-full rounded border px-1.5 py-1 text-[10px] ${isDarkMode ? 'border-[#3c3c44] bg-[#1b1b20] text-slate-200' : 'border-slate-300 bg-white text-slate-800'}`;
  const updateItem = (index: number, fields: Partial<LingMenuResourceItem>) => onChange({
    items: resource.items.map((item, row) => row === index ? { ...item, ...fields } : item)
  });
  return (
    <div className="space-y-3" aria-label={`${resource.type === 'ContextMenu' ? '上下文菜单' : '弹出菜单'}属性：${resource.name}`}>
      <div className={`flex items-center gap-2 border-b pb-2 text-[11px] ${isDarkMode ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
        <Menu className="h-4 w-4 text-amber-500" />
        <span className="font-semibold">{resource.type === 'ContextMenu' ? '上下文菜单' : '弹出菜单'}：{resource.name}</span>
        <span className="ml-auto rounded border border-amber-500/30 px-1.5 py-0.5 text-[8px] text-amber-500">非可视</span>
      </div>
      <PropertyGroup title="组件" isDarkMode={isDarkMode}>
        <PropertyRow label="名称" isDarkMode={isDarkMode}><input aria-label="菜单组件名称" value={resource.name} onChange={event => onChange({ name: event.target.value })} className={inputClass} /></PropertyRow>
        <PropertyRow label="左" isDarkMode={isDarkMode}><input aria-label="菜单占位左坐标" type="number" min={0} value={resource.designerX ?? 0} onChange={event => onChange({ designerX: Math.max(0, Number(event.target.value) || 0) })} className={inputClass} /></PropertyRow>
        <PropertyRow label="顶" isDarkMode={isDarkMode}><input aria-label="菜单占位顶坐标" type="number" min={0} value={resource.designerY ?? 0} onChange={event => onChange({ designerY: Math.max(0, Number(event.target.value) || 0) })} className={inputClass} /></PropertyRow>
        <PropertyRow label="所属窗口" isDarkMode={isDarkMode}><select aria-label="菜单所属窗口" value={resource.ownerWindowId} onChange={event => onChange({ ownerWindowId: event.target.value, targetControlId: resource.type === 'ContextMenu' ? event.target.value : '' })} className={inputClass}>{windows.map(window => <option key={window.id} value={window.id}>{window.title}</option>)}</select></PropertyRow>
        {resource.type === 'ContextMenu' && <PropertyRow label="右键目标" isDarkMode={isDarkMode}><select aria-label="上下文菜单右键目标" value={resource.targetControlId || ownerWindow?.id || ''} onChange={event => onChange({ targetControlId: event.target.value })} className={inputClass}><option value={ownerWindow?.id || ''}>当前窗口</option>{(ownerWindow?.controls || []).map(control => <option key={control.id} value={control.id}>{control.name}（{CONTROL_LABELS[control.type]}）</option>)}</select></PropertyRow>}
      </PropertyGroup>
      <PropertyGroup title={`菜单项（${resource.items.length}）`} isDarkMode={isDarkMode}>
        <div className="space-y-2 p-2">
          {resource.items.map((item, index) => <div key={item.id} className={`space-y-1 rounded border p-2 ${isDarkMode ? 'border-[#34343d]' : 'border-slate-200'}`}>
            <div className="flex items-center gap-1">
              <input aria-label={`第 ${index + 1} 个菜单项文字`} value={item.label} disabled={item.separator} onChange={event => updateItem(index, { label: event.target.value })} className={inputClass} />
              <button type="button" aria-label={`删除第 ${index + 1} 个菜单项`} onClick={() => onChange({ items: resource.items.filter((_, row) => row !== index) })} className="shrink-0 rounded p-1 text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex flex-wrap gap-3 text-[9px] text-slate-500">
              <label className="flex items-center gap-1"><input type="checkbox" checked={item.separator === true} onChange={event => updateItem(index, { separator: event.target.checked, label: event.target.checked ? '' : (item.label || `菜单项 ${index + 1}`) })} />分隔线</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={item.enabled !== false} disabled={item.separator} onChange={event => updateItem(index, { enabled: event.target.checked })} />启用</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={item.checked === true} disabled={item.separator} onChange={event => updateItem(index, { checked: event.target.checked })} />勾选</label>
              <span className="font-mono">{item.id}</span>
            </div>
          </div>)}
          <div className="flex gap-2">
            <button type="button" onClick={() => onChange({ items: [...resource.items, createMenuResourceItem(resource.items)] })} className="flex-1 rounded border border-amber-500/30 py-1.5 text-[10px] text-amber-500 hover:bg-amber-500/10"><Plus className="mr-1 inline h-3 w-3" />新增菜单项</button>
            <button type="button" onClick={() => onChange({ items: [...resource.items, { ...createMenuResourceItem(resource.items), label: '', separator: true }] })} className="flex-1 rounded border border-slate-500/30 py-1.5 text-[10px] text-slate-500">新增分隔线</button>
          </div>
        </div>
      </PropertyGroup>
      <div className="text-[9px] leading-4 text-slate-500">运行时不绘制占位。{resource.type === 'ContextMenu' ? '绑定目标收到右键消息时自动弹出，也可调用“上下文菜单_显示”。' : '请通过“弹出菜单_显示”或“弹出菜单_在坐标显示”主动触发。'}</div>
      <button type="button" onClick={onDelete} className="flex w-full items-center justify-center gap-1 rounded border border-red-500/30 py-1.5 text-[10px] text-red-400 hover:bg-red-500/10"><Trash2 className="h-3 w-3" />删除菜单组件</button>
    </div>
  );
}

function MenuResourceEvents({ resource, windowModel, isDarkMode, onChange }: {
  resource: LingMenuResource;
  windowModel: LingWindowModel;
  isDarkMode: boolean;
  onChange: (items: LingMenuResourceItem[]) => void;
}) {
  const openEventCode = (item: LingMenuResourceItem, index: number) => {
    if (item.separator) return;
    const handlerName = item.selectedHandler?.trim() || `_${resource.name}_${item.label || `菜单项${index + 1}`}_被选择`;
    onChange(resource.items.map(current => current.id === item.id ? { ...current, selectedHandler: handlerName } : current));
    const detail: OpenControlEventCodeDetail = {
      controlId: `${resource.id}:${item.id}`,
      controlName: `${resource.name}.${item.label}`,
      controlContent: item.label,
      controlType: resource.type,
      eventName: 'ItemSelected',
      handlerName,
      windowFileName: windowModel.fileName,
      windowClassName: windowModel.className,
      windowTitle: windowModel.title
    };
    globalThis.window.dispatchEvent(new CustomEvent<OpenControlEventCodeDetail>('open-control-event-code', { detail }));
  };
  return <div className="space-y-2" aria-label={`菜单项事件：${resource.name}`}>
    <div className={`flex items-center gap-1.5 border-b pb-2 text-[11px] ${isDarkMode ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'}`}><Zap className="h-3.5 w-3.5 text-amber-500" /><span className="font-semibold">菜单项事件：{resource.name}</span></div>
    {resource.items.filter(item => !item.separator).map((item, index) => {
      const handlerName = item.selectedHandler?.trim() || `_${resource.name}_${item.label || `菜单项${index + 1}`}_被选择`;
      return <button key={item.id} type="button" onClick={() => openEventCode(item, index)} className={`w-full rounded border p-2.5 text-left ${isDarkMode ? 'border-slate-800/70 bg-slate-900/40 hover:border-amber-500/45' : 'border-slate-200 bg-white hover:border-amber-400'}`}><span className="block text-[11px] font-semibold">{item.label}</span><span className="mt-1 block truncate font-mono text-[9.5px] text-slate-500">{handlerName}</span></button>;
    })}
  </div>;
}

function BehaviorResourceEditor({ resources, windows, activeWindow, isDarkMode, onChange, registerNavigationTarget }: {
  resources: LingDesignerResource[];
  windows: LingWindowModel[];
  activeWindow: LingWindowModel;
  isDarkMode: boolean;
  onChange: (resources: LingDesignerResource[]) => void;
  registerNavigationTarget: (kind: 'control' | 'resource', id: string) => (element: HTMLElement | null) => void;
}) {
  const controls = windows.flatMap(window => window.controls);
  const tooltips = resources.filter((resource): resource is LingToolTipResource => resource.type === 'ToolTip');
  const sheets = resources.filter((resource): resource is LingPropertySheetResource => resource.type === 'PropertySheet');
  const replace = (resource: LingDesignerResource) => onChange(resources.map(item => item.id === resource.id ? resource : item));
  const remove = (id: string) => onChange(resources.filter(item => item.id !== id));
  const uniqueId = (prefix: string) => { let index = 1; while (resources.some(resource => resource.id === `${prefix}-${index}`)) index += 1; return `${prefix}-${index}`; };
  const openPropertySheetAppliedEvent = (resource: LingPropertySheetResource) => {
    const handlerName = resource.appliedHandler?.trim() || `_${resource.name}_属性被应用`;
    replace({ ...resource, appliedHandler: handlerName });
    const detail: OpenControlEventCodeDetail = {
      controlId: resource.id,
      controlName: resource.name,
      controlContent: resource.title,
      controlType: 'PropertySheet',
      eventName: 'Applied',
      handlerName,
      windowFileName: activeWindow.fileName,
      windowClassName: activeWindow.className,
      windowTitle: activeWindow.title
    };
    globalThis.window.dispatchEvent(new CustomEvent<OpenControlEventCodeDetail>('open-control-event-code', { detail }));
  };
  const inputClass = `w-full rounded border px-1 py-0.5 text-[10px] ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`;
  return <PropertyGroup title={`项目 / 附加行为（${tooltips.length + sheets.length}）`} isDarkMode={isDarkMode} defaultOpen={false}>
    <div className="space-y-2 p-2">
      {tooltips.map(resource => <div key={resource.id} ref={registerNavigationTarget('resource', resource.id)} tabIndex={-1} data-designer-resource-id={resource.id} className={`space-y-1 rounded border p-2 ${isDarkMode ? 'border-[#34343d]' : 'border-slate-200'}`}>
        <div className="flex items-center gap-1"><span className="text-[10px] font-semibold text-cyan-500">ToolTip · {resource.name}</span><button type="button" onClick={() => remove(resource.id)} className="ml-auto text-red-400"><Trash2 className="h-3 w-3" /></button></div>
        <select aria-label="工具提示目标控件" value={resource.targetControlId} onChange={event => replace({ ...resource, targetControlId: event.target.value })} className={inputClass}><option value="">选择目标控件</option>{controls.map(control => <option key={control.id} value={control.id}>{control.name}</option>)}</select>
        <input aria-label="工具提示文字" value={resource.text} onChange={event => replace({ ...resource, text: event.target.value })} placeholder="提示文字" className={inputClass} />
        <input aria-label="工具提示延迟" type="number" min={0} value={resource.initialDelay} onChange={event => replace({ ...resource, initialDelay: Math.max(0, Number(event.target.value) || 0) })} className={inputClass} />
      </div>)}
      {sheets.map(resource => <div key={resource.id} ref={registerNavigationTarget('resource', resource.id)} tabIndex={-1} data-designer-resource-id={resource.id} className={`space-y-1 rounded border p-2 ${isDarkMode ? 'border-[#34343d]' : 'border-slate-200'}`}>
        <div className="flex items-center gap-1"><span className="text-[10px] font-semibold text-violet-500">PropertySheet · {resource.name}</span><button type="button" onClick={() => remove(resource.id)} className="ml-auto text-red-400"><Trash2 className="h-3 w-3" /></button></div>
        <input aria-label="属性页窗口标题" value={resource.title} onChange={event => replace({ ...resource, title: event.target.value })} className={inputClass} />
        <button
          type="button"
          onClick={() => openPropertySheetAppliedEvent(resource)}
          aria-label={`${resource.appliedHandler?.trim() ? '打开' : '创建并打开'}属性页应用事件处理器 ${resource.appliedHandler?.trim() || `_${resource.name}_属性被应用`}`}
          className={`group w-full rounded border p-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-500/70 ${
            isDarkMode
              ? 'border-slate-800/70 bg-slate-900/40 hover:border-amber-500/45 hover:bg-amber-500/[0.06]'
              : 'border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/60'
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            <span className={`text-[10px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>属性被应用 (Applied)</span>
            <span className={`rounded border px-1.5 py-0.5 text-[8px] ${resource.appliedHandler?.trim() ? 'border-emerald-500/25 text-emerald-400' : 'border-amber-500/25 text-amber-500'}`}>{resource.appliedHandler?.trim() ? '已绑定' : '未绑定'}</span>
          </span>
          <span className="mt-1.5 flex items-center gap-1.5 font-mono text-[9.5px] text-slate-500">
            <FileCode className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{resource.appliedHandler?.trim() || `_${resource.name}_属性被应用`}</span>
            <span className="font-sans text-[8px] font-semibold">{resource.appliedHandler?.trim() ? '打开代码' : '生成并打开'}</span>
          </span>
        </button>
        {resource.pages.map((page, index) => <div key={page.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1">
          <input aria-label="属性页标题" value={page.title} onChange={event => replace({ ...resource, pages: resource.pages.map((item, row) => row === index ? { ...item, title: event.target.value } : item) })} className={inputClass} />
          <input aria-label="属性页内容" value={page.content} onChange={event => replace({ ...resource, pages: resource.pages.map((item, row) => row === index ? { ...item, content: event.target.value } : item) })} className={inputClass} />
          <button type="button" onClick={() => replace({ ...resource, pages: resource.pages.filter((_, row) => row !== index) })} className="text-red-400">×</button>
          <select aria-label="属性页控件模板窗口" value={page.sourceWindowId || ''} onChange={event => replace({ ...resource, pages: resource.pages.map((item, row) => row === index ? { ...item, sourceWindowId: event.target.value || undefined } : item) })} className={`${inputClass} col-span-2`}><option value="">仅显示页面文字</option>{windows.map(window => <option key={window.id} value={window.id}>{window.title}（{window.controls.length} 个控件）</option>)}</select>
        </div>)}
        <button type="button" onClick={() => replace({ ...resource, pages: [...resource.pages, { id: `page-${resource.pages.length + 1}`, title: `页面 ${resource.pages.length + 1}`, content: '' }] })} className="w-full text-[9px] text-emerald-500">+ 添加属性页</button>
        <div className="text-[9px] text-slate-500">中文代码调用：属性页_显示({resource.name})</div>
      </div>)}
      <div className="flex gap-1">
        <button type="button" onClick={() => { const id = uniqueId('tooltip'); onChange([...resources, { id, type: 'ToolTip', name: `工具提示 ${tooltips.length + 1}`, targetControlId: '', text: '提示文字', initialDelay: 500 }]); }} className="flex-1 rounded border border-cyan-500/30 py-1 text-[9px] text-cyan-500">+ ToolTip</button>
        <button type="button" onClick={() => { const id = uniqueId('property-sheet'); onChange([...resources, { id, type: 'PropertySheet', name: `属性页 ${sheets.length + 1}`, title: '属性', pages: [{ id: 'page-1', title: '常规', content: '' }] }]); }} className="flex-1 rounded border border-violet-500/30 py-1 text-[9px] text-violet-500">+ PropertySheet</button>
      </div>
    </div>
  </PropertyGroup>;
}

function ImageListResourceEditor({
  resources,
  isDarkMode,
  onChange,
  revealResourceId,
  registerNavigationTarget
}: {
  resources: LingImageListResource[];
  isDarkMode: boolean;
  onChange: (resources: LingImageListResource[]) => void;
  revealResourceId: string | null;
  registerNavigationTarget: (kind: 'control' | 'resource', id: string) => (element: HTMLElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (revealResourceId && resources.some(resource => resource.id === revealResourceId)) setOpen(true);
  }, [resources, revealResourceId]);
  const update = (id: string, fields: Partial<LingImageListResource>) => onChange(resources.map(resource => resource.id === id ? { ...resource, ...fields } : resource));
  const add = () => {
    let suffix = resources.length + 1;
    while (resources.some(resource => resource.id === `images-${suffix}`)) suffix += 1;
    onChange([...resources, { id: `images-${suffix}`, type: 'ImageList', name: `图像列表 ${suffix}`, imageWidth: 16, imageHeight: 16, images: [] }]);
    setOpen(true);
  };
  return (
    <PropertyGroup title={`项目 / 图像列表资源（${resources.length}）`} isDarkMode={isDarkMode} defaultOpen={false}>
      <div className="space-y-2 p-2">
        <button type="button" onClick={() => setOpen(value => !value)} className="w-full rounded border border-cyan-500/30 px-2 py-1 text-[10px] text-cyan-500">{open ? '收起资源编辑器' : '管理 ImageList'}</button>
        {open && resources.map(resource => (
          <div key={resource.id} ref={registerNavigationTarget('resource', resource.id)} tabIndex={-1} data-designer-resource-id={resource.id} className={`space-y-1 rounded border p-2 ${isDarkMode ? 'border-[#34343d] bg-black/10' : 'border-slate-200 bg-white'}`}>
            <div className="flex gap-1">
              <input aria-label="图像列表名称" value={resource.name} onChange={event => update(resource.id, { name: event.target.value })} className={`min-w-0 flex-1 rounded border px-1 py-0.5 text-[10px] ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`} />
              <button type="button" aria-label={`删除图像列表 ${resource.name}`} onClick={() => onChange(resources.filter(item => item.id !== resource.id))} className="rounded px-1 text-red-400"><Trash2 className="h-3 w-3" /></button>
            </div>
            <div className="text-[9px] text-slate-500">资源 ID：{resource.id}</div>
            <div className="flex gap-1">
              <input aria-label="图像宽度" type="number" min={1} value={resource.imageWidth} onChange={event => update(resource.id, { imageWidth: Math.max(1, Number(event.target.value) || 1) })} className={`w-1/2 rounded border px-1 py-0.5 text-[10px] ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`} />
              <input aria-label="图像高度" type="number" min={1} value={resource.imageHeight} onChange={event => update(resource.id, { imageHeight: Math.max(1, Number(event.target.value) || 1) })} className={`w-1/2 rounded border px-1 py-0.5 text-[10px] ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`} />
            </div>
            <textarea aria-label="图像文件列表" value={resource.images.join('\n')} onChange={event => update(resource.id, { images: event.target.value.split(/\r?\n/).map(item => item.trim()).filter(Boolean) })} rows={3} placeholder="每行一个工作区内图片路径" className={`w-full resize-y rounded border px-1 py-0.5 text-[10px] ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`} />
          </div>
        ))}
        {open && resources.length === 0 && <div className="text-[10px] text-slate-500">尚未创建图像列表资源。</div>}
        <button type="button" onClick={add} className="flex w-full items-center justify-center gap-1 rounded border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-500"><Plus className="h-3 w-3" />新建图像列表</button>
      </div>
    </PropertyGroup>
  );
}

function ControlProperties({
  projectId,
  control,
  controls,
  imageLists,
  isDarkMode,
  moduleControl,
  onChange,
  onTabPagesChange,
  edgePreviewState,
  onPreviewEdge,
  onStopEdgePreview,
  onDelete
}: {
  projectId: string;
  control: LingControl | null;
  controls: LingControl[];
  imageLists: LingImageListResource[];
  isDarkMode: boolean;
  moduleControl?: ModuleDesignerControlContribution;
  onChange: (fields: Partial<LingControl>) => void;
  onTabPagesChange: (controlId: string, pages: TabControlPage[], mutation?: TabControlPageMutation) => void;
  edgePreviewState: EdgeControlPreviewState;
  onPreviewEdge: () => void;
  onStopEdgePreview: () => void;
  onDelete: () => void;
}) {
  const [listViewEditorKind, setListViewEditorKind] = useState<ListViewCollectionEditorKind | null>(null);
  const [dataGridEditorOpen, setDataGridEditorOpen] = useState(false);
  const [fbroJsQueryEditorOpen, setFbroJsQueryEditorOpen] = useState(false);
  const [cef3JsQueryEditorOpen, setCef3JsQueryEditorOpen] = useState(false);
  const [newEmojiTableEditorOpen, setNewEmojiTableEditorOpen] = useState(false);
  const [headerColumnsEditorOpen, setHeaderColumnsEditorOpen] = useState(false);
  const [toolbarButtonsEditorOpen, setToolbarButtonsEditorOpen] = useState(false);
  const [statusBarPartsEditorOpen, setStatusBarPartsEditorOpen] = useState(false);
  const [tabPagesEditorOpen, setTabPagesEditorOpen] = useState(false);
  const [menuBarItemsEditorOpen, setMenuBarItemsEditorOpen] = useState(false);
  const [treeViewEditorOpen, setTreeViewEditorOpen] = useState(false);
  const [modulePropertySearch, setModulePropertySearch] = useState('');
  const [showAdvancedModuleProperties, setShowAdvancedModuleProperties] = useState(false);
  const [tagValidationMessage, setTagValidationMessage] = useState('');

  useEffect(() => {
    setListViewEditorKind(null);
    setDataGridEditorOpen(false);
    setNewEmojiTableEditorOpen(false);
    setHeaderColumnsEditorOpen(false);
    setToolbarButtonsEditorOpen(false);
    setStatusBarPartsEditorOpen(false);
    setTabPagesEditorOpen(false);
    setMenuBarItemsEditorOpen(false);
    setTreeViewEditorOpen(false);
    setTagValidationMessage('');
  }, [control?.id]);

  if (!control) {
    return (
      <div className={`h-40 flex flex-col items-center justify-center text-center text-xs p-4 border border-dashed rounded ${
        isDarkMode ? 'text-slate-600 border-slate-800' : 'text-slate-400 border-slate-300 bg-slate-50'
      }`}>
        <MousePointer className="w-6 h-6 mb-2" />
        <span>请选择一个控件，或从左侧工具箱添加控件。</span>
      </div>
    );
  }

  const handleNameChange = (value: string) => {
    const primaryEventName = getPrimaryEventNameForType(control.type);
    const nextEvents = { ...(control.events || {}) };

    if (nextEvents[primaryEventName]?.trim()) {
      nextEvents[primaryEventName] = getEplEventHandlerName(value, primaryEventName);
      onChange({ name: value, events: nextEvents });
      return;
    }

    onChange({ name: value });
  };

  const descendantIds = getControlDescendantIds(controls, control.id);
  const availableParents = controls.filter(item => (
    getWin32ControlDefinition(item.type)?.isContainer
    && item.id !== control.id
    && !descendantIds.has(item.id)
  ));
  const controlDefinition = getWin32ControlDefinition(control.type);
  const supportsRuntimeTags = Boolean(moduleControl?.runtimeControl || (controlDefinition && getWin32RuntimeControlContract(controlDefinition)));
  const updateTagText = (value: string) => {
    const normalized = normalizeControlTagText(value);
    const conflict = findControlTagConflict(controls, control.id, 'text', normalized);
    if (conflict) {
      setTagValidationMessage(`标记文本已被同类型控件“${conflict.controlName}”使用。`);
      return;
    }
    setTagValidationMessage('');
    onChange({ tagText: normalized });
  };
  const updateTagInteger = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setTagValidationMessage('');
      onChange({ tagInteger: undefined });
      return;
    }
    if (!/^-?\d+$/u.test(trimmed)) {
      setTagValidationMessage('标记整数必须是有符号 32 位整数。');
      return;
    }
    const normalized = normalizeControlTagInteger(Number(trimmed));
    if (normalized === undefined) {
      setTagValidationMessage('标记整数范围为 -2147483648 到 2147483647。');
      return;
    }
    const conflict = findControlTagConflict(controls, control.id, 'integer', normalized);
    if (conflict) {
      setTagValidationMessage(`标记整数已被同类型控件“${conflict.controlName}”使用。`);
      return;
    }
    setTagValidationMessage('');
    onChange({ tagInteger: normalized });
  };
  const listViewColumns = control.type === 'ListView'
    ? normalizeListViewColumns(control.properties?.columns)
    : [];
  const listViewRows = control.type === 'ListView'
    ? normalizeListViewRows(control.properties?.items)
    : [];
  const dataGridModel = control.type === 'DataGrid'
    ? normalizeDataGridModel({
      columns: control.properties?.dataGridColumns as any,
      rows: control.properties?.dataGridRows as any,
      selectionMode: control.properties?.selectionMode as any,
      emptyText: control.properties?.emptyText as any,
      virtualMode: control.properties?.virtualMode as any,
      virtualRowCount: control.properties?.virtualRowCount as any
    })
    : undefined;
  const headerColumnCount = control.type === 'Header'
    ? normalizeListViewColumns(control.properties?.columns).length
    : 0;
  const treeViewNodeCount = control.type === 'TreeView'
    ? flattenTreeViewNodes(normalizeTreeViewNodes(control.properties?.nodes)).length
    : 0;
  const toolbarButtonCount = control.type === 'ToolBar'
    ? normalizeToolbarButtons(control.properties?.buttons).length
    : 0;
  const statusBarPartCount = control.type === 'StatusBar'
    ? normalizeStatusBarParts(control.properties?.parts).length
    : 0;
  const tabPageCount = isTabContainerControl(control)
    ? getTabControlPages(control).length
    : 0;
  const moduleHasBackgroundColor = Boolean(moduleControl?.properties?.some(property => property.key === 'backgroundColor'));
  const handleControlBackgroundChange = (value: string) => {
    onChange({
      background: value,
      ...(moduleHasBackgroundColor
        ? { properties: { ...(control.properties || {}), backgroundColor: value } }
        : {})
    });
  };
  const updateControlProperty = (key: string, value: Win32ControlPropertyValue) => {
    const properties = { ...(control.properties || {}), [key]: value };
    const content = key === 'value' && control.type === 'ProgressBar' ? String(value) : control.content;
    onChange({
      properties,
      content,
      ...(key === 'backgroundColor' && typeof value === 'string' ? { background: value } : {})
    });
  };
  const updateListViewCollections = (columns: ListViewEditableColumn[], rows: ListViewEditableRow[]) => {
    onChange({
      properties: {
        ...(control.properties || {}),
        columns,
        items: rows
      }
    });
  };
  const newEmojiTableEditorData = control.designerType?.endsWith('/Table')
    ? getNewEmojiTableEditorData(control)
    : { columns: 0, rows: 0 };

  return (
    <div className="space-y-2">
      {control.type === 'EdgeBrowser' && (
        <PropertyGroup title="EdgeView / 独立原生预览" isDarkMode={isDarkMode}>
          <div className="space-y-1.5">
            <div role="status" className={`rounded border px-2 py-1.5 text-[10px] ${edgePreviewState.status === 'failed' ? 'border-red-500/30 text-red-400' : edgePreviewState.status === 'running' ? 'border-emerald-500/30 text-emerald-400' : 'border-slate-500/30 text-slate-500'}`}>
              {edgePreviewState.message || '设计画布只显示安全占位；可在独立 Win32 窗口运行当前控件。'}
              {edgePreviewState.pid ? `（PID ${edgePreviewState.pid}）` : ''}
            </div>
            <div className="rounded border border-amber-500/25 px-2 py-1 text-[9px] text-amber-500">缓存、Profile、隐私模式、语言及标注为创建期的属性，修改后需要重新运行预览或调用“重建控件”才会生效。</div>
            <div className="flex gap-1.5">
              <button type="button" onClick={onPreviewEdge} disabled={edgePreviewState.status === 'preparing' || edgePreviewState.status === 'compiling' || edgePreviewState.status === 'stopping'} className="flex flex-1 items-center justify-center gap-1 rounded border border-emerald-500/40 px-2 py-1 text-[10px] text-emerald-500 disabled:opacity-50"><Play className="h-3 w-3" />运行此 Edge 控件预览</button>
              {(edgePreviewState.status === 'running' || edgePreviewState.status === 'failed') && <button type="button" onClick={onStopEdgePreview} className="rounded border border-red-500/30 px-2 py-1 text-[10px] text-red-400">停止</button>}
            </div>
          </div>
        </PropertyGroup>
      )}
      <PropertyGroup title="控件 / 布局" isDarkMode={isDarkMode}>
        {control.type !== ('MenuBar' as any) && control.type !== ('MenuItem' as any) && (
          <PropertyRow label="父级容器" isDarkMode={isDarkMode}>
            <select
              value={control.parentId || ''}
              onChange={event => onChange({ parentId: event.target.value || undefined })}
              className={`w-full rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 ${
                isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
              }`}
              aria-label="父级容器"
            >
              <option value="">当前窗口（根级）</option>
              {availableParents.map(parent => (
                <option key={parent.id} value={parent.id}>{parent.name}</option>
              ))}
            </select>
          </PropertyRow>
        )}
        <NumberField label="左距" value={control.x} min={0} isDarkMode={isDarkMode} onChange={value => onChange({ x: value })} />
        <NumberField label="顶距" value={control.y} min={0} isDarkMode={isDarkMode} onChange={value => onChange({ y: value })} />
        <NumberField label="宽度" value={control.width} min={20} isDarkMode={isDarkMode} onChange={value => onChange({ width: value })} />
        <NumberField
          label={control.type === 'MonthCalendar' ? '月历高度' : control.type === 'DateTimePicker' ? '选择框高度' : '高度'}
          value={control.height}
          min={control.type === 'MonthCalendar' ? 200 : 15}
          isDarkMode={isDarkMode}
          onChange={value => onChange({ height: value })}
        />
      </PropertyGroup>

      {supportsRuntimeTags && (
        <PropertyGroup title="控件 / 代码标记" isDarkMode={isDarkMode}>
          <TextField label="标记文本" value={control.tagText || ''} isDarkMode={isDarkMode} onChange={updateTagText} />
          <PropertyRow label="标记整数" isDarkMode={isDarkMode}>
            <input
              type="number"
              min={-2147483648}
              max={2147483647}
              step={1}
              value={control.tagInteger ?? ''}
              placeholder="留空"
              aria-label="标记整数"
              onChange={event => updateTagInteger(event.target.value)}
              className={`w-full min-w-0 rounded border px-2 py-1 text-xs outline-none focus:border-amber-500 ${
                isDarkMode ? 'border-[#3c3c44] bg-[#1b1b20] text-slate-200' : 'border-slate-300 bg-white text-slate-800'
              }`}
            />
          </PropertyRow>
          {tagValidationMessage && <div role="alert" className="px-1 text-[10px] leading-4 text-red-400">{tagValidationMessage}</div>}
        </PropertyGroup>
      )}

      <PropertyGroup title="控件 / 外观" isDarkMode={isDarkMode}>
        <PropertyRow label="控件类型" isDarkMode={isDarkMode}>
          <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-500">
            {CONTROL_LABELS[control.type]}
          </span>
        </PropertyRow>
        <TextField label="中文名称" value={control.name} isDarkMode={isDarkMode} onChange={handleNameChange} />
        {control.type === ('MenuBar' as any) ? (
          <PropertyRow label="显示内容" isDarkMode={isDarkMode}>
            <button
              type="button"
              onClick={() => setMenuBarItemsEditorOpen(true)}
              className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                isDarkMode
                  ? 'border-[#3f3f49] bg-[#24242b] text-slate-200 hover:bg-[#303038]'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
              }`}
            >
              <span>{parseMenuBarItems(control.content).length} 个菜单项</span>
              <span className="font-semibold text-cyan-500">编辑菜单项</span>
            </button>
          </PropertyRow>
        ) : control.type !== 'Grid' && (
          <TextField
            label={control.type === 'ProgressBar' ? '进度值' : control.type === 'Upload' || control.type === 'DragUpload' ? '上传标题' : '显示内容'}
            value={control.content}
            isDarkMode={isDarkMode}
            onChange={value => onChange(control.type === 'ProgressBar'
              ? { content: value, properties: { ...(control.properties || {}), value: Number.parseInt(value, 10) || 0 } }
              : { content: value })}
          />
        )}
        <PropertyRow label="字体名称" isDarkMode={isDarkMode}>
          <select
            value={normalizeControlFont(control).family}
            onChange={event => onChange({ fontFamily: event.target.value })}
            className={`w-full rounded border px-2 py-1 text-xs focus:outline-none focus:border-amber-500 ${
              isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
            }`}
            aria-label="字体名称"
          >
            {CONTROL_FONT_FAMILY_OPTIONS.map(fontFamily => (
              <option key={fontFamily.value} value={fontFamily.value}>{fontFamily.label}</option>
            ))}
          </select>
        </PropertyRow>
        <PropertyRow label="字体大小" isDarkMode={isDarkMode}>
          <div className="flex w-full items-center gap-2">
            <input
              type="range"
              min="9"
              max="32"
              value={control.fontSize}
              onChange={event => onChange({ fontSize: parseInt(event.target.value, 10) })}
              className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-lg bg-[#24242b] accent-amber-500"
              aria-label="字体大小"
            />
            <span className="w-10 text-right font-mono text-[10px] text-slate-500">{control.fontSize}px</span>
          </div>
        </PropertyRow>
        <PropertyRow label="字体样式" isDarkMode={isDarkMode}>
          <div className="flex w-full flex-wrap gap-x-3 gap-y-1 text-xs">
            {([
              ['fontBold', '粗体'],
              ['fontItalic', '斜体'],
              ['fontUnderline', '下划线']
            ] as const).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={control[key] === true}
                  onChange={event => onChange({ [key]: event.target.checked })}
                  className="accent-amber-500"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </PropertyRow>
        <ColorField
          label="文字颜色"
          value={control.foreground}
          isDarkMode={isDarkMode}
          swatches={['#FFFFFF', '#CCCCCC', '#AAAAAA', '#73C991', '#4FC1FF', '#FFD166', '#FF6B6B', '#111827']}
          onChange={value => onChange({ foreground: value })}
        />
        <ColorField
          label="背景颜色"
          value={control.background}
          isDarkMode={isDarkMode}
          swatches={['transparent', '#1E1E24', '#2D2D30', '#007ACC', '#2e7d32', '#3E3E40', '#4a148c', '#111111']}
          onChange={handleControlBackgroundChange}
        />
      </PropertyGroup>

      {moduleControl && (
        <ModuleControlProperties
          control={control}
          definition={moduleControl}
          controls={controls}
          imageLists={imageLists}
          projectId={projectId}
          isDarkMode={isDarkMode}
          search={modulePropertySearch}
          showAdvanced={showAdvancedModuleProperties}
          onSearchChange={setModulePropertySearch}
          onShowAdvancedChange={setShowAdvancedModuleProperties}
          onPropertyChange={updateControlProperty}
          onEditTabPages={() => setTabPagesEditorOpen(true)}
          newEmojiTableColumnCount={newEmojiTableEditorData.columns}
          newEmojiTableRowCount={newEmojiTableEditorData.rows}
          onEditNewEmojiTable={() => setNewEmojiTableEditorOpen(true)}
        />
      )}

      {!moduleControl && controlDefinition && controlDefinition.properties.length > 0 && (
        <PropertyGroup title="控件 / 专属属性" isDarkMode={isDarkMode}>
          {controlDefinition.properties.map(property => {
            if (control.type === 'ListView' && (property.key === 'columns' || property.key === 'items')) {
              const isColumns = property.key === 'columns';
              const count = isColumns ? listViewColumns.length : listViewRows.length;
              return (
                <PropertyRow key={property.key} label={property.label} isDarkMode={isDarkMode}>
                  <button
                    type="button"
                    onClick={() => setListViewEditorKind(isColumns ? 'columns' : 'rows')}
                    className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      isDarkMode
                        ? 'border-[#3f3f49] bg-[#24242b] text-slate-200 hover:bg-[#303038]'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <span>{count} {isColumns ? '列' : '行'}</span>
                    <span className="font-semibold text-cyan-500">{isColumns ? '编辑列' : '编辑数据'}</span>
                  </button>
                </PropertyRow>
              );
            }
            if (control.type === 'FBroBrowser' && property.key === 'jsQueryFunctions') {
              const channelCount = parseFbroJsQueryChannels(control.properties?.jsQueryFunctions).length;
              return (
                <PropertyRow key={property.key} label={property.label} isDarkMode={isDarkMode}>
                  <button
                    type="button"
                    onClick={() => setFbroJsQueryEditorOpen(true)}
                    className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      isDarkMode ? 'border-[#3f3f49] bg-[#24242b] text-slate-200 hover:bg-[#303038]' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <span>{channelCount ? `${channelCount} 条通道` : '未配置'}</span>
                    <span className="font-semibold text-cyan-500">配置函数</span>
                  </button>
                </PropertyRow>
              );
            }
            if (control.type === 'CefBrowser' && property.key === 'jsQueryFunctions') {
              const channelCount = parseFbroJsQueryChannels(control.properties?.jsQueryFunctions).length;
              return (
                <PropertyRow key={property.key} label={property.label} isDarkMode={isDarkMode}>
                  <button
                    type="button"
                    onClick={() => setCef3JsQueryEditorOpen(true)}
                    className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      isDarkMode ? 'border-[#3f3f49] bg-[#24242b] text-slate-200 hover:bg-[#303038]' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <span>{channelCount ? `${channelCount} 条通道` : '未配置'}</span>
                    <span className="font-semibold text-cyan-500">配置函数</span>
                  </button>
                </PropertyRow>
              );
            }
            if (control.type === 'DataGrid' && (property.type === 'dataGridColumns' || property.type === 'dataGridRows')) {
              const count = property.type === 'dataGridColumns' ? dataGridModel?.columns.length || 0 : dataGridModel?.rows.length || 0;
              return (
                <PropertyRow key={property.key} label={property.label} isDarkMode={isDarkMode}>
                  <button
                    type="button"
                    onClick={() => setDataGridEditorOpen(true)}
                    className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      isDarkMode ? 'border-[#3f3f49] bg-[#24242b] text-slate-200 hover:bg-[#303038]' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <span>{count} {property.type === 'dataGridColumns' ? '列' : '行'}</span>
                    <span className="font-semibold text-cyan-500">编辑表格</span>
                  </button>
                </PropertyRow>
              );
            }
            if (control.type === 'Header' && property.key === 'columns') {
              return (
                <PropertyRow key={property.key} label={property.label} isDarkMode={isDarkMode}>
                  <button
                    type="button"
                    onClick={() => setHeaderColumnsEditorOpen(true)}
                    className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      isDarkMode
                        ? 'border-[#3f3f49] bg-[#24242b] text-slate-200 hover:bg-[#303038]'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <span>{headerColumnCount} 列</span>
                    <span className="font-semibold text-cyan-500">编辑列</span>
                  </button>
                </PropertyRow>
              );
            }
            if (control.type === 'TreeView' && property.key === 'nodes') {
              return (
                <PropertyRow key={property.key} label={property.label} isDarkMode={isDarkMode}>
                  <button
                    type="button"
                    onClick={() => setTreeViewEditorOpen(true)}
                    className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      isDarkMode
                        ? 'border-[#3f3f49] bg-[#24242b] text-slate-200 hover:bg-[#303038]'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <span>{treeViewNodeCount} 个节点</span>
                    <span className="font-semibold text-cyan-500">编辑节点</span>
                  </button>
                </PropertyRow>
              );
            }
            if (control.type === 'ToolBar' && property.key === 'buttons') {
              return (
                <PropertyRow key={property.key} label={property.label} isDarkMode={isDarkMode}>
                  <button
                    type="button"
                    onClick={() => setToolbarButtonsEditorOpen(true)}
                    className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      isDarkMode
                        ? 'border-[#3f3f49] bg-[#24242b] text-slate-200 hover:bg-[#303038]'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <span>{toolbarButtonCount} 个按钮</span>
                    <span className="font-semibold text-cyan-500">编辑按钮</span>
                  </button>
                </PropertyRow>
              );
            }
            if (control.type === 'StatusBar' && property.key === 'parts') {
              return (
                <PropertyRow key={property.key} label={property.label} isDarkMode={isDarkMode}>
                  <button
                    type="button"
                    onClick={() => setStatusBarPartsEditorOpen(true)}
                    className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      isDarkMode
                        ? 'border-[#3f3f49] bg-[#24242b] text-slate-200 hover:bg-[#303038]'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <span>{statusBarPartCount} 个分区</span>
                    <span className="font-semibold text-cyan-500">编辑分区</span>
                  </button>
                </PropertyRow>
              );
            }
            if (control.type === 'TabControl' && property.key === 'tabs') {
              return (
                <PropertyRow key={property.key} label={property.label} isDarkMode={isDarkMode}>
                  <button
                    type="button"
                    onClick={() => setTabPagesEditorOpen(true)}
                    className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      isDarkMode
                        ? 'border-[#3f3f49] bg-[#24242b] text-slate-200 hover:bg-[#303038]'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <span>{tabPageCount} 个标签页</span>
                    <span className="font-semibold text-cyan-500">编辑标签页</span>
                  </button>
                </PropertyRow>
              );
            }
            return (
              <ControlPropertyField
                key={property.key}
                definition={property}
                controlType={control.type}
                controlProperties={control.properties || {}}
                value={control.properties?.[property.key] ?? property.defaultValue}
                controls={control.type === 'ReBar' && property.key === 'bands'
                  ? controls.filter(item => item.parentId === control.id)
                  : controls}
                imageLists={imageLists}
                isDarkMode={isDarkMode}
                projectId={projectId}
                onChange={value => updateControlProperty(property.key, value)}
              />
            );
          })}
        </PropertyGroup>
      )}

      <PropertyGroup title="控件 / 状态" isDarkMode={isDarkMode}>
        <PropertyRow label="启用" isDarkMode={isDarkMode}>
          <input
            type="checkbox"
            checked={control.isEnabled}
            onChange={event => onChange({ isEnabled: event.target.checked })}
            className="h-4 w-4 cursor-pointer accent-emerald-500"
            aria-label="启用控件"
          />
        </PropertyRow>
        <PropertyRow label="可见性" isDarkMode={isDarkMode}>
          <select
            value={control.visibility}
            onChange={event => onChange({ visibility: event.target.value as LingControl['visibility'] })}
            className={`w-full rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 ${
              isDarkMode ? 'bg-[#24242b] border-[#3c3c44] text-slate-300' : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            <option value="Visible">显示</option>
            <option value="Collapsed">隐藏</option>
          </select>
        </PropertyRow>
        {control.type !== 'MenuItem' as any && (
          <div className="p-2">
            <button
              onClick={onDelete}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded border border-red-900/30 bg-red-950/30 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-900/35 hover:text-red-300"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>删除此控件</span>
            </button>
          </div>
        )}
      </PropertyGroup>

      {control.type === 'ListView' && listViewEditorKind && (
        <ListViewCollectionDialog
          kind={listViewEditorKind}
          controlName={control.name}
          columnsValue={control.properties?.columns}
          rowsValue={control.properties?.items}
          showImages={Boolean(control.properties?.imageListId)}
          isDarkMode={isDarkMode}
          onChange={updateListViewCollections}
          onClose={() => setListViewEditorKind(null)}
        />
      )}
      {control.type === 'DataGrid' && dataGridEditorOpen && (
        <DataGridEditorDialog
          control={control}
          isDarkMode={isDarkMode}
          onSave={properties => {
            onChange({ properties: { ...(control.properties || {}), ...properties } });
            setDataGridEditorOpen(false);
          }}
          onClose={() => setDataGridEditorOpen(false)}
        />
      )}
      {control.type === 'FBroBrowser' && fbroJsQueryEditorOpen && (
        <FbroJsQueryEditorDialog
          control={control}
          isDarkMode={isDarkMode}
          onSave={properties => {
            onChange({ properties: { ...(control.properties || {}), ...properties } });
            setFbroJsQueryEditorOpen(false);
          }}
          onClose={() => setFbroJsQueryEditorOpen(false)}
        />
      )}
      {control.type === 'CefBrowser' && cef3JsQueryEditorOpen && (
        <FbroJsQueryEditorDialog
          control={control}
          isDarkMode={isDarkMode}
          mode="cef3"
          onSave={properties => {
            onChange({ properties: { ...(control.properties || {}), ...properties } });
            setCef3JsQueryEditorOpen(false);
          }}
          onClose={() => setCef3JsQueryEditorOpen(false)}
        />
      )}
      {control.designerType?.endsWith('/Table') && newEmojiTableEditorOpen && (
        <NewEmojiTableEditorDialog
          control={control}
          isDarkMode={isDarkMode}
          onSave={properties => {
            onChange({ properties: { ...(control.properties || {}), ...properties } });
            setNewEmojiTableEditorOpen(false);
          }}
          onClose={() => setNewEmojiTableEditorOpen(false)}
        />
      )}
      {control.type === 'Header' && headerColumnsEditorOpen && (
        <ListViewCollectionDialog
          kind="columns"
          columnOwner="header"
          controlName={control.name}
          columnsValue={control.properties?.columns}
          rowsValue={[]}
          showImages={Boolean(control.properties?.imageListId)}
          isDarkMode={isDarkMode}
          onChange={columns => updateControlProperty('columns', columns)}
          onClose={() => setHeaderColumnsEditorOpen(false)}
        />
      )}
      {control.type === 'ToolBar' && toolbarButtonsEditorOpen && (
        <ToolbarButtonsDialog
          controlName={control.name}
          value={control.properties?.buttons}
          hasImageList={Boolean(control.properties?.imageListId)}
          isDarkMode={isDarkMode}
          onChange={buttons => updateControlProperty('buttons', buttons.map(button => ({ ...button })))}
          onClose={() => setToolbarButtonsEditorOpen(false)}
        />
      )}
      {control.type === 'StatusBar' && statusBarPartsEditorOpen && (
        <StatusBarPartsDialog
          controlName={control.name}
          value={control.properties?.parts}
          isDarkMode={isDarkMode}
          onChange={parts => updateControlProperty('parts', parts.map(part => ({ ...part })))}
          onClose={() => setStatusBarPartsEditorOpen(false)}
        />
      )}
      {isTabContainerControl(control) && tabPagesEditorOpen && (
        <TabControlPagesDialog
          controlName={control.name}
          value={getTabControlPages(control) as unknown as Win32ControlPropertyValue}
          hasImageList={!isNewEmojiTabsControl(control) && Boolean(control.properties?.imageListId)}
          isDarkMode={isDarkMode}
          onChange={(pages, mutation) => onTabPagesChange(control.id, pages, mutation)}
          onClose={() => setTabPagesEditorOpen(false)}
        />
      )}
      {control.type === ('MenuBar' as any) && menuBarItemsEditorOpen && (
        <MenuBarItemsDialog
          controlName={control.name}
          value={control.content}
          isDarkMode={isDarkMode}
          onSave={content => onChange({ content })}
          onClose={() => setMenuBarItemsEditorOpen(false)}
        />
      )}
      {control.type === 'TreeView' && treeViewEditorOpen && (
        <TreeViewCollectionDialog
          controlName={control.name}
          value={control.properties?.nodes}
          showImages={Boolean(control.properties?.imageListId)}
          isDarkMode={isDarkMode}
          onChange={nodes => updateControlProperty('nodes', nodes)}
          onClose={() => setTreeViewEditorOpen(false)}
        />
      )}
    </div>
  );
}

function ControlEvents({
  control,
  moduleControl,
  windowModel,
  isDarkMode,
  onChange
}: {
  control: LingControl | null;
  moduleControl?: ModuleDesignerControlContribution;
  windowModel: LingWindowModel;
  isDarkMode: boolean;
  onChange: (fields: Partial<LingControl>) => void | Promise<void>;
}) {
  const [openingEventName, setOpeningEventName] = useState<string | null>(null);
  if (!control) {
    return (
      <div className={`h-40 flex flex-col items-center justify-center text-center text-xs p-4 border border-dashed rounded ${
        isDarkMode ? 'text-slate-600 border-slate-800' : 'text-slate-400 border-slate-300 bg-slate-50'
      }`}>
        <Zap className="w-6 h-6 mb-2" />
        <span>请选择控件后绑定中文事件处理器。</span>
      </div>
    );
  }

  const eventInfos: Array<{
    name: string;
    label: string;
    desc: string;
    handlerPattern?: string;
    handlerSuffix?: string;
    parameters?: NonNullable<ModuleDesignerControlContribution['events']>[number]['parameters'];
    starterStatements?: string[];
  }> = moduleControl
    ? (moduleControl.events || []).filter(eventInfo => Boolean(eventInfo.runtimeCommand)).map(eventInfo => ({
        name: eventInfo.name,
        label: `${eventInfo.label} (${eventInfo.name})`,
        desc: eventInfo.parameters?.length
          ? `事件参数：${describeModuleDesignerEventParameters(eventInfo.parameters)}`
          : '由 new_emoji 原生运行时触发。',
        handlerPattern: eventInfo.handlerPattern,
        handlerSuffix: eventInfo.label,
        parameters: eventInfo.parameters,
        starterStatements: eventInfo.starterStatements
      }))
    : getEventsForType(control.type);

  const openEventCode = async (eventName: string, handlerPattern?: string) => {
    const eventInfo = eventInfos.find(item => item.name === eventName);
    const suggestedName = handlerPattern?.replace('{controlName}', control.name)
      || getEplEventHandlerName(control.name, eventInfo?.handlerSuffix || eventName);
    const handlerName = control.events?.[eventName]?.trim() || suggestedName;
    setOpeningEventName(eventName);
    try {
      await onChange({
        events: {
          ...(control.events || {}),
          [eventName]: handlerName
        }
      });
    } catch {
      setOpeningEventName(null);
      return;
    }
    setOpeningEventName(null);

    const detail: OpenControlEventCodeDetail = {
      controlId: control.id,
      controlName: control.name,
      controlContent: control.content,
      controlType: control.type,
      eventName,
      handlerName,
      eventParameters: moduleControl ? [...(eventInfo?.parameters || [])] : undefined,
      eventStarterStatements: eventInfo?.starterStatements ? [...eventInfo.starterStatements] : undefined,
      windowFileName: windowModel.fileName,
      windowClassName: windowModel.className,
      windowTitle: windowModel.title
    };
    globalThis.window.dispatchEvent(new CustomEvent<OpenControlEventCodeDetail>('open-control-event-code', { detail }));
  };

  return (
    <div className="space-y-3">
      <div className={`text-[11px] border-b pb-1.5 flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400 border-slate-800' : 'text-slate-600 border-slate-200'}`}>
        <Zap className="w-3.5 h-3.5 text-amber-500" />
        <span className="font-semibold">事件绑定：{control.name}</span>
      </div>
      {eventInfos.length === 0 && (
        <div role="status" className={`rounded border border-dashed px-3 py-4 text-center text-[10px] leading-relaxed ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}>
          当前组件目录中的事件尚无已验证的原生回调映射，因此不会生成无效处理器绑定。
        </div>
      )}
      {eventInfos.map(eventInfo => {
        const currentHandler = control.events?.[eventInfo.name] || '';
        const suggestedHandler = getEplEventHandlerName(control.name, eventInfo.handlerSuffix || eventInfo.name);
        const isBound = Boolean(currentHandler.trim());
        const handlerName = currentHandler.trim() || suggestedHandler;
        return (
          <button
            key={eventInfo.name}
            type="button"
            onClick={() => void openEventCode(eventInfo.name, eventInfo.handlerPattern)}
            disabled={openingEventName !== null}
            aria-label={`${isBound ? '打开' : '创建并打开'}${eventInfo.label}事件处理器 ${handlerName}`}
            className={`group w-full cursor-pointer rounded border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70 ${
              isDarkMode
                ? 'border-slate-800/70 bg-slate-900/40 hover:border-amber-500/45 hover:bg-amber-500/[0.06]'
                : 'border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/60'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{eventInfo.label}</div>
                <div className="mt-0.5 text-[9.5px] leading-tight text-slate-500">{eventInfo.desc}</div>
              </div>
              <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[8px] ${
                isBound
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/25 bg-amber-500/10 text-amber-500'
              }`}>{isBound ? '已绑定' : '未绑定'}</span>
            </div>
            <div className={`mt-2 flex min-h-7 items-center gap-2 rounded border px-2 py-1 ${
              isDarkMode ? 'border-[#2d2d34] bg-[#1b1b20]' : 'border-slate-200 bg-slate-50'
            }`}>
              <FileCode className={`h-3.5 w-3.5 shrink-0 transition-colors ${isBound ? 'text-emerald-400' : 'text-amber-500'}`} />
              <span className={`min-w-0 flex-1 truncate font-mono text-[10.5px] ${
                isBound ? isDarkMode ? 'text-emerald-300' : 'text-emerald-700' : 'text-slate-500'
              }`}>{handlerName}</span>
              <span className={`shrink-0 text-[9px] font-semibold transition-colors ${
                isDarkMode ? 'text-slate-500 group-hover:text-amber-400' : 'text-slate-500 group-hover:text-amber-700'
              }`}>{openingEventName === eventInfo.name ? '正在打开' : isBound ? '打开代码' : '生成并打开'}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

type CollectionField = { key: string; label: string; kind?: 'number' | 'control' | 'style' | 'alignment' | 'boolean' };

function StructuredCollectionEditor({
  propertyKey,
  controlType,
  value,
  controls,
  isDarkMode,
  onChange
}: {
  propertyKey: string;
  controlType: LingControl['type'];
  value: Win32ControlPropertyValue;
  controls: LingControl[];
  isDarkMode: boolean;
  onChange: (value: Win32ControlPropertyValue) => void;
}) {
  const [collectionStatus, setCollectionStatus] = useState('');
  const items = Array.isArray(value) ? value.map(item => typeof item === 'string' ? { title: item } : { ...(item as Record<string, unknown>) }) : [];
  const fields: CollectionField[] = propertyKey === 'tabs'
    ? [{ key: 'id', label: '页面 ID' }, { key: 'title', label: '标题' }, { key: 'image', label: '图片', kind: 'number' }]
    : propertyKey === 'buttons'
      ? [{ key: 'id', label: '命令 ID', kind: 'number' }, { key: 'title', label: '文字' }, { key: 'image', label: '图片', kind: 'number' }, { key: 'style', label: '样式', kind: 'style' }]
      : propertyKey === 'parts'
        ? [{ key: 'title', label: '文字' }, { key: 'width', label: '宽度', kind: 'number' }]
        : propertyKey === 'bands'
          ? [{ key: 'id', label: '带区 ID' }, { key: 'title', label: '文字' }, { key: 'childControl', label: '子控件', kind: 'control' }, { key: 'width', label: '宽度', kind: 'number' }, { key: 'minWidth', label: '最小宽度', kind: 'number' }, { key: 'height', label: '带区高度', kind: 'number' }, { key: 'breakLine', label: '另起一行', kind: 'boolean' }, { key: 'resizable', label: '允许调整宽度', kind: 'boolean' }]
          : [
              { key: 'title', label: '标题' },
              { key: 'width', label: '宽度', kind: 'number' },
              ...(controlType === 'Header' ? [{ key: 'alignment', label: '文字对齐', kind: 'alignment' as const }] : []),
              { key: 'image', label: '图片', kind: 'number' }
            ];
  const defaults = Object.fromEntries(fields.map(field => [field.key,
    field.kind === 'number'
      ? (field.key === 'image' ? -1 : field.key === 'width' ? 120 : field.key === 'minWidth' ? 40 : field.key === 'height' ? 28 : items.length + 1)
      : field.kind === 'boolean' ? field.key === 'resizable' : field.kind === 'style' ? 'button' : field.kind === 'alignment' ? 'left' : ''
  ]));
  const commit = (next: Array<Record<string, unknown>>) => onChange(next);
  const addItem = () => {
    if (propertyKey !== 'bands') {
      commit([...items, defaults]);
      return;
    }
    const result = createNextRebarBand(items, controls);
    setCollectionStatus(result.message);
    if (result.band) commit([...items, result.band]);
  };
  const inputClass = `w-full rounded border px-1 py-0.5 text-[10px] ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`;
  return (
    <div className="w-full space-y-1.5" aria-label={`${propertyKey} 结构化集合编辑器`}>
      {items.map((item, index) => (
        <div key={index} className={`space-y-1 rounded border p-1.5 ${isDarkMode ? 'border-[#34343d]' : 'border-slate-200'}`}>
          {fields.map(field => (
            <label key={field.key} className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-1 text-[9px] text-slate-500">
              <span>{field.label}</span>
              {field.kind === 'control' ? (
                <select value={String(item[field.key] ?? '')} onChange={event => commit(items.map((current, row) => row === index ? { ...current, [field.key]: event.target.value } : current))} className={inputClass}>
                  <option value="">未绑定</option>{controls.map(control => <option key={control.id} value={control.id}>{control.name}</option>)}
                </select>
              ) : field.kind === 'boolean' ? (
                <input type="checkbox" checked={item[field.key] === true} onChange={event => commit(items.map((current, row) => row === index ? { ...current, [field.key]: event.target.checked } : current))} className="h-3.5 w-3.5 accent-cyan-500" />
              ) : field.kind === 'style' ? (
                <select value={String(item[field.key] ?? 'button')} onChange={event => commit(items.map((current, row) => row === index ? { ...current, [field.key]: event.target.value } : current))} className={inputClass}>
                  <option value="button">普通按钮</option><option value="check">切换按钮</option><option value="separator">分隔符</option><option value="dropdown">下拉按钮</option>
                </select>
              ) : field.kind === 'alignment' ? (
                <select value={String(item[field.key] ?? 'left')} onChange={event => commit(items.map((current, row) => row === index ? { ...current, [field.key]: event.target.value } : current))} className={inputClass} aria-label={`第 ${index + 1} 列文字对齐`}>
                  <option value="left">居左</option><option value="center">居中</option><option value="right">居右</option>
                </select>
              ) : (
                <input type={field.kind === 'number' ? 'number' : 'text'} value={String(item[field.key] ?? '')} onChange={event => {
                  const nextValue = field.kind === 'number' ? Number(event.target.value) : event.target.value;
                  commit(items.map((current, row) => row === index ? { ...current, [field.key]: nextValue } : current));
                }} className={inputClass} />
              )}
            </label>
          ))}
          <div className="flex justify-end gap-1">
            <button type="button" disabled={index === 0} onClick={() => { const next = [...items]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; commit(next); }} className="px-1 text-cyan-500 disabled:opacity-30">上移</button>
            <button type="button" disabled={index === items.length - 1} onClick={() => { const next = [...items]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; commit(next); }} className="px-1 text-cyan-500 disabled:opacity-30">下移</button>
            <button type="button" onClick={() => commit(items.filter((_, row) => row !== index))} className="px-1 text-red-400">删除</button>
          </div>
        </div>
      ))}
      {propertyKey === 'bands' && (
        <div className={`rounded border px-2 py-1.5 text-[9px] leading-relaxed ${isDarkMode ? 'border-cyan-500/20 bg-cyan-500/[0.06] text-slate-400' : 'border-cyan-200 bg-cyan-50 text-slate-600'}`}>
          用法：先选中 Rebar，再从工具箱添加工具栏等控件；开启“自动绑定子控件”时会立即创建带区。也可关闭自动绑定后，用下面按钮依次绑定尚未绑定的直接子控件。
        </div>
      )}
      <button type="button" onClick={addItem} className="w-full rounded border border-emerald-500/30 py-1 text-[10px] text-emerald-500">{propertyKey === 'bands' ? '+ 绑定下一个子控件' : '+ 添加项目'}</button>
      {collectionStatus && <div role="status" className="text-[9px] leading-relaxed text-amber-500">{collectionStatus}</div>}
    </div>
  );
}

function getCompatibleDesignerControls(
  controls: LingControl[],
  constraint?: Pick<Win32ControlPropertyDefinition, 'controlTypes' | 'controlKinds'>
): LingControl[] {
  if (constraint?.controlKinds?.length && !constraint.controlKinds.includes('visual')) return [];
  const allowedTypes = new Set(constraint?.controlTypes || []);
  if (allowedTypes.size === 0) return controls;
  return controls.filter(control => {
    const candidates = [control.designerType, control.type].filter((value): value is string => Boolean(value));
    return candidates.some(type => allowedTypes.has(type) || [...allowedTypes].some(allowed => allowed.endsWith(`/${type}`)));
  });
}

function RecordListPropertyEditor({
  definition,
  value,
  controls,
  isDarkMode,
  onChange
}: {
  definition: Win32ControlPropertyDefinition;
  value: Win32ControlPropertyValue;
  controls: LingControl[];
  isDarkMode: boolean;
  onChange: (value: Win32ControlPropertyValue) => void;
}) {
  const fields = definition.fields || [];
  const items = Array.isArray(value)
    ? value.map(item => item && typeof item === 'object' ? { ...(item as Record<string, unknown>) } : {})
    : [];
  const inputClass = `min-w-0 w-full rounded border px-1.5 py-1 text-[10px] ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`;
  const commit = (next: Array<Record<string, unknown>>) => onChange(next);
  const updateField = (row: number, key: string, nextValue: unknown) => {
    commit(items.map((item, index) => index === row ? { ...item, [key]: nextValue } : item));
  };
  const addItem = () => {
    const next = Object.fromEntries(fields.map(field => [field.key, field.defaultValue ?? (field.type === 'boolean' ? false : field.type === 'number' ? 0 : '')]));
    if (definition.recordKey) {
      const used = new Set(items.map(item => String(item[definition.recordKey!] ?? '')));
      let suffix = items.length + 1;
      while (used.has(`${definition.recordKey}${suffix}`)) suffix += 1;
      next[definition.recordKey] = `${definition.recordKey}${suffix}`;
    }
    commit([...items, next]);
  };
  return (
    <PropertyRow label={definition.label} isDarkMode={isDarkMode}>
      <div className="w-full space-y-1.5" aria-label={`${definition.label}结构化集合编辑器`}>
        {items.map((item, index) => (
          <section key={String(item[definition.recordKey || 'id'] ?? index)} className={`space-y-1 rounded border p-1.5 ${isDarkMode ? 'border-[#34343d]' : 'border-slate-200'}`}>
            {fields.map(field => {
              const compatibleControls = field.type === 'controlRef'
                ? getCompatibleDesignerControls(controls, field as Win32ControlPropertyDefinition)
                : [];
              return (
                <label key={field.key} className="grid grid-cols-[68px_minmax(0,1fr)] items-center gap-1 text-[9px] text-slate-500">
                  <span>{field.label}</span>
                  {field.type === 'boolean' ? (
                    <input type="checkbox" checked={item[field.key] === true} onChange={event => updateField(index, field.key, event.target.checked)} className="h-3.5 w-3.5 accent-fuchsia-500" />
                  ) : field.type === 'enum' ? (
                    <select value={String(item[field.key] ?? '')} onChange={event => updateField(index, field.key, event.target.value)} className={inputClass}>
                      {(field.options || []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : field.type === 'controlRef' ? (
                    <select value={String(item[field.key] ?? '')} onChange={event => updateField(index, field.key, event.target.value)} className={inputClass}>
                      <option value="">未绑定</option>
                      {compatibleControls.map(control => <option key={control.id} value={control.id}>{control.name}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'color' ? 'color' : 'text'}
                      value={String(item[field.key] ?? '')}
                      required={field.required === true}
                      onChange={event => updateField(index, field.key, field.type === 'number' ? Number(event.target.value) : event.target.value)}
                      className={inputClass}
                    />
                  )}
                </label>
              );
            })}
            <div className="flex justify-end gap-1 text-[9px]">
              <button type="button" disabled={index === 0} onClick={() => { const next = [...items]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; commit(next); }} className="px-1 text-cyan-500 disabled:opacity-30">上移</button>
              <button type="button" disabled={index === items.length - 1} onClick={() => { const next = [...items]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; commit(next); }} className="px-1 text-cyan-500 disabled:opacity-30">下移</button>
              <button type="button" onClick={() => commit(items.filter((_, row) => row !== index))} className="px-1 text-red-400">删除</button>
            </div>
          </section>
        ))}
        <button type="button" onClick={addItem} className="w-full rounded border border-emerald-500/30 py-1 text-[10px] text-emerald-500">+ 添加项目</button>
      </div>
    </PropertyRow>
  );
}

function ModuleControlProperties({ control, definition, controls, imageLists, projectId, isDarkMode, search, showAdvanced, onSearchChange, onShowAdvancedChange, onPropertyChange, onEditTabPages, newEmojiTableColumnCount, newEmojiTableRowCount, onEditNewEmojiTable }: {
  control: LingControl;
  definition: ModuleDesignerControlContribution;
  controls: LingControl[];
  imageLists: LingImageListResource[];
  projectId: string;
  isDarkMode: boolean;
  search: string;
  showAdvanced: boolean;
  onSearchChange: (value: string) => void;
  onShowAdvancedChange: (value: boolean) => void;
  onPropertyChange: (key: string, value: Win32ControlPropertyValue) => void;
  onEditTabPages: () => void;
  newEmojiTableColumnCount: number;
  newEmojiTableRowCount: number;
  onEditNewEmojiTable: () => void;
}) {
  const isNewEmojiTable = control.designerType?.endsWith('/Table') === true;
  const normalizedSearch = search.trim().toLocaleLowerCase('zh-CN');
  const matched = (definition.properties || []).filter(property => (showAdvanced || property.level !== 'advanced') && (!normalizedSearch || [property.label, property.key, property.group, property.description].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN').includes(normalizedSearch)));
  const visible = matched.filter(property => Boolean(property.runtimeCommand));
  const unsupported = matched.filter(property => !property.runtimeCommand);
  const groups = [...new Set(visible.map(property => property.group || '组件属性'))];
  return <div className="space-y-2">
    <PropertyGroup title="模块 / 属性筛选" isDarkMode={isDarkMode}>
      <PropertyRow label="所属模块" isDarkMode={isDarkMode}><span className="truncate text-[10px] text-fuchsia-400">lingbuilder.new_emoji.ui</span></PropertyRow>
      <PropertyRow label="组件类型" isDarkMode={isDarkMode}><span className="truncate font-mono text-[10px]">{definition.namespacedType || definition.type}</span></PropertyRow>
      <PropertyRow label="搜索属性" isDarkMode={isDarkMode}><input type="search" value={search} onChange={event => onSearchChange(event.target.value)} placeholder="名称、键或分组" aria-label="搜索模块控件属性" className={`w-full rounded border px-2 py-1 text-xs ${isDarkMode ? 'border-[#3c3c44] bg-[#1b1b20]' : 'border-slate-300 bg-white'}`}/></PropertyRow>
      <PropertyRow label="高级属性" isDarkMode={isDarkMode}><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showAdvanced} onChange={event => onShowAdvancedChange(event.target.checked)} className="accent-fuchsia-500"/>显示底层与高成本选项</label></PropertyRow>
    </PropertyGroup>
    {groups.map(group => <PropertyGroup key={group} title={`new_emoji / ${group}`} isDarkMode={isDarkMode}>
      {visible.filter(property => (property.group || '组件属性') === group).map(property => {
        if (isNewEmojiTable && isNewEmojiTableDataProperty(property.key) && property.key !== 'columns') return null;
        return <div key={property.key} className="group relative">
        {isNewEmojiTable && property.key === 'columns' ? (
          <PropertyRow label="表格数据" isDarkMode={isDarkMode}>
            <button
              type="button"
              onClick={onEditNewEmojiTable}
              className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                isDarkMode
                  ? 'border-[#3f3f49] bg-[#24242b] text-slate-200 hover:bg-[#303038]'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
              }`}
            >
              <span>{newEmojiTableColumnCount} 列 · {newEmojiTableRowCount} 行</span>
              <span className="font-semibold text-cyan-500">编辑列与行</span>
            </button>
          </PropertyRow>
        ) : isNewEmojiTabsControl(control) && property.key === 'items' ? (
          <PropertyRow label={property.label} isDarkMode={isDarkMode}>
            <button
              type="button"
              onClick={onEditTabPages}
              className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                isDarkMode
                  ? 'border-[#3f3f49] bg-[#24242b] text-slate-200 hover:bg-[#303038]'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
              }`}
            >
              <span>{getTabControlPages(control).length} 个标签页</span>
              <span className="font-semibold text-cyan-500">编辑标签页</span>
            </button>
          </PropertyRow>
        ) : isNewEmojiTabsControl(control) && property.key === 'contentVisible' ? (
          <PropertyRow label={property.label} isDarkMode={isDarkMode}>
            <span className="text-[10px] leading-relaxed">
              <span className="block text-emerald-500">分页容器内容区固定开启</span>
              <span className="block text-slate-500">标签页表头可由“显示标签页表头”独立控制</span>
            </span>
          </PropertyRow>
        ) : (
          <ControlPropertyField
            definition={property as Win32ControlPropertyDefinition}
            controlType={control.type}
            controlProperties={control.properties || {}}
            value={(control.properties?.[property.key] ?? property.defaultValue) as Win32ControlPropertyValue}
            controls={controls}
            imageLists={imageLists}
            isDarkMode={isDarkMode}
            projectId={projectId}
            onChange={value => onPropertyChange(property.key, value)}
          />
        )}
        <button
          type="button"
          onClick={() => onPropertyChange(property.key, property.defaultValue as Win32ControlPropertyValue)}
          title={`恢复 ${property.label} 默认值`}
          aria-label={`恢复 ${property.label} 默认值`}
          className="pointer-events-none absolute top-1 rounded px-1 text-[9px] text-slate-500 opacity-0 transition-opacity hover:text-fuchsia-400 focus:pointer-events-auto focus:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
          style={{ right: 'calc(60% + 4px)' }}
        >
          默认
        </button>
      </div>;
      })}
    </PropertyGroup>)}
    {unsupported.length > 0 && (
      <div role="status" className={`rounded border px-3 py-2 text-[10px] leading-relaxed ${isDarkMode ? 'border-amber-500/25 bg-amber-500/[0.06] text-amber-300' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
        {unsupported.length} 个目录属性尚未声明已验证的运行时映射，已锁定编辑，避免保存后生成结果不生效。
      </div>
    )}
    {visible.length === 0 && <div role="status" className={`rounded border border-dashed px-3 py-4 text-center text-[10px] ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}>没有匹配的属性；可清空搜索或显示高级属性。</div>}
  </div>;
}

function ControlPropertyField({
  definition,
  controlType,
  controlProperties,
  value,
  controls,
  imageLists,
  isDarkMode,
  projectId,
  onChange
}: {
  key?: React.Key;
  definition: Win32ControlPropertyDefinition;
  controlType: LingControl['type'];
  controlProperties: Readonly<Record<string, Win32ControlPropertyValue>>;
  value: Win32ControlPropertyValue;
  controls: LingControl[];
  imageLists: LingImageListResource[];
  isDarkMode: boolean;
  projectId: string;
  onChange: (value: Win32ControlPropertyValue) => void;
}) {
  const complex = ['columns', 'tabs'].includes(definition.type);
  const [fileStatus, setFileStatus] = useState('');
  const [isSelectingFile, setIsSelectingFile] = useState(false);

  if (definition.type === 'date') {
    const timeMode = controlType === 'DateTimePicker' && controlProperties.format === 'time';
    const rawValue = String(value ?? '');
    const inputValue = timeMode
      ? /^\d{2}:\d{2}(?::\d{2})?$/u.test(rawValue) ? rawValue : ''
      : /^\d{4}-\d{2}-\d{2}$/u.test(rawValue) ? rawValue : '';
    return (
      <PropertyRow label={timeMode ? '当前时间' : definition.label} isDarkMode={isDarkMode}>
        <input
          type={timeMode ? 'time' : 'date'}
          step={timeMode ? 1 : undefined}
          value={inputValue}
          aria-label={timeMode ? '当前时间' : definition.label}
          onChange={event => onChange(event.target.value)}
          className={`w-full rounded border px-2 py-0.5 text-xs ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`}
        />
      </PropertyRow>
    );
  }

  if (definition.type === 'boolean') {
    return <PropertyRow label={definition.label} isDarkMode={isDarkMode}><input type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} className="h-4 w-4 accent-amber-500" /></PropertyRow>;
  }
  if (definition.type === 'number') {
    return (
      <NumberField
        label={definition.label}
        value={typeof value === 'number' ? value : 0}
        min={definition.min}
        max={definition.max}
        isDarkMode={isDarkMode}
        onChange={onChange}
      />
    );
  }
  if (definition.type === 'hotkey') {
    return <HotKeyField label={definition.label} value={String(value ?? '')} isDarkMode={isDarkMode} onChange={onChange} />;
  }
  if (definition.type === 'enum') {
    return (
      <PropertyRow label={definition.label} isDarkMode={isDarkMode}>
        <select
          value={String(value ?? '')}
          aria-label={definition.label}
          data-designer-enum-property={definition.key}
          onMouseDown={openDesignerSelectPicker}
          onChange={event => onChange(event.target.value)}
          className={`w-full cursor-pointer rounded border px-2 py-0.5 text-xs outline-none focus:border-fuchsia-500 focus-visible:ring-2 focus-visible:ring-fuchsia-500/40 ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`}
        >
          {(definition.options || []).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </PropertyRow>
    );
  }
  if (definition.type === 'color') {
    return (
      <ColorField
        label={definition.label}
        value={String(value ?? definition.defaultValue)}
        isDarkMode={isDarkMode}
        swatches={['transparent', '#0F172A', '#1E293B', '#334155', '#7C3AED', '#6366F1', '#0891B2', '#38BDF8', '#E2E8F0']}
        onChange={onChange}
      />
    );
  }
  if (definition.type === 'controlRef') {
    const compatibleControls = getCompatibleDesignerControls(controls, definition);
    return (
      <PropertyRow label={definition.label} isDarkMode={isDarkMode}>
        <select value={String(value ?? '')} onChange={event => onChange(event.target.value)} className={`w-full rounded border px-2 py-0.5 text-xs ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`}>
          <option value="">未绑定</option>
          {compatibleControls.map(control => <option key={control.id} value={control.id}>{control.name}</option>)}
        </select>
      </PropertyRow>
    );
  }
  if (definition.type === 'recordList') {
    return <RecordListPropertyEditor definition={definition} value={value} controls={controls} isDarkMode={isDarkMode} onChange={onChange} />;
  }
  if (definition.type === 'file' && definition.key === 'imageSource') {
    const chooseImage = async () => {
      setIsSelectingFile(true);
      setFileStatus('正在选择图片…');
      try {
        const result = await selectAndImportDesignerImage(projectId);
        if (result.canceled) {
          setFileStatus('已取消选择。');
          return;
        }
        if (!result.ok || !result.relativePath) {
          setFileStatus(result.error || '图片复制失败。');
          return;
        }
        onChange(result.relativePath);
        setFileStatus(`已复制到 ${result.relativePath}`);
      } catch (error) {
        setFileStatus(error instanceof Error ? error.message : '图片复制失败。');
      } finally {
        setIsSelectingFile(false);
      }
    };
    return (
      <PropertyRow label={definition.label} isDarkMode={isDarkMode}>
        <div className="min-w-0 w-full space-y-1">
          <div className="flex min-w-0 w-full gap-1">
            <input
              type="text"
              value={String(value ?? '')}
              onChange={event => onChange(event.target.value)}
              placeholder="assets/项目/图片.png"
              className={`min-w-0 flex-1 rounded border px-2 py-0.5 text-xs ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`}
            />
            <button
              type="button"
              onClick={() => void chooseImage()}
              disabled={isSelectingFile}
              title="选择本地图片并复制到项目 assets 目录"
              aria-label="选择本地图片"
              className={`flex h-7 w-8 shrink-0 items-center justify-center rounded border transition-colors disabled:cursor-wait disabled:opacity-50 ${isDarkMode ? 'border-[#3c3c44] bg-[#24242b] text-amber-400 hover:bg-[#303038]' : 'border-slate-300 bg-white text-amber-600 hover:bg-slate-100'}`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </button>
          </div>
          {fileStatus && <div role="status" className={`text-[9px] leading-3 ${fileStatus.includes('失败') || fileStatus.includes('仅在') ? 'text-red-400' : 'text-slate-500'}`}>{fileStatus}</div>}
        </div>
      </PropertyRow>
    );
  }
  if (definition.type === 'file' && definition.key === 'gifSource') {
    const chooseGif = async () => {
      setIsSelectingFile(true);
      setFileStatus('正在选择 GIF 动态图像…');
      try {
        const result = await selectAndImportDesignerGif(projectId);
        if (result.canceled) {
          setFileStatus('已取消选择。');
          return;
        }
        if (!result.ok || !result.relativePath) {
          setFileStatus(result.error || 'GIF 复制失败。');
          return;
        }
        onChange(result.relativePath);
        setFileStatus(`已复制到 ${result.relativePath}`);
      } catch (error) {
        setFileStatus(error instanceof Error ? error.message : 'GIF 复制失败。');
      } finally {
        setIsSelectingFile(false);
      }
    };
    return (
      <PropertyRow label={definition.label} isDarkMode={isDarkMode}>
        <div className="min-w-0 w-full space-y-1">
          <div className="flex min-w-0 w-full gap-1">
            <input type="text" value={String(value ?? '')} onChange={event => onChange(event.target.value)} placeholder="assets/项目/动画.gif" className={`min-w-0 flex-1 rounded border px-2 py-0.5 text-xs ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`} />
            <button type="button" onClick={() => void chooseGif()} disabled={isSelectingFile} title="选择 GIF 并复制到项目 assets 目录" aria-label="选择 GIF 动态图像" className={`flex h-7 w-8 shrink-0 items-center justify-center rounded border transition-colors disabled:cursor-wait disabled:opacity-50 ${isDarkMode ? 'border-[#3c3c44] bg-[#24242b] text-fuchsia-400 hover:bg-[#303038]' : 'border-slate-300 bg-white text-fuchsia-600 hover:bg-slate-100'}`}>
              <FolderOpen className="h-3.5 w-3.5" />
            </button>
          </div>
          {fileStatus && <div role="status" className={`text-[9px] leading-3 ${fileStatus.includes('失败') || fileStatus.includes('仅在') || fileStatus.includes('仅支持') ? 'text-red-400' : 'text-slate-500'}`}>{fileStatus}</div>}
        </div>
      </PropertyRow>
    );
  }
  if (definition.type === 'file' && definition.key === 'aviSource') {
    const chooseAnimation = async () => {
      setIsSelectingFile(true);
      setFileStatus('正在选择 AVI 动画…');
      try {
        const result = await selectAndImportDesignerAnimation(projectId);
        if (result.canceled) {
          setFileStatus('已取消选择。');
          return;
        }
        if (!result.ok || !result.relativePath) {
          setFileStatus(result.error || 'AVI 动画复制失败。');
          return;
        }
        onChange(result.relativePath);
        setFileStatus(`已复制到 ${result.relativePath}`);
      } catch (error) {
        setFileStatus(error instanceof Error ? error.message : 'AVI 动画复制失败。');
      } finally {
        setIsSelectingFile(false);
      }
    };
    return (
      <PropertyRow label={definition.label} isDarkMode={isDarkMode}>
        <div className="min-w-0 w-full space-y-1">
          <div className="flex min-w-0 w-full gap-1">
            <input
              type="text"
              value={String(value ?? '')}
              onChange={event => onChange(event.target.value)}
              placeholder="assets/项目/动画.avi"
              className={`min-w-0 flex-1 rounded border px-2 py-0.5 text-xs ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`}
            />
            <button
              type="button"
              onClick={() => void chooseAnimation()}
              disabled={isSelectingFile}
              title="选择本地 AVI 并复制到项目 assets 目录"
              aria-label="选择本地 AVI 动画"
              className={`flex h-7 w-8 shrink-0 items-center justify-center rounded border transition-colors disabled:cursor-wait disabled:opacity-50 ${isDarkMode ? 'border-[#3c3c44] bg-[#24242b] text-amber-400 hover:bg-[#303038]' : 'border-slate-300 bg-white text-amber-600 hover:bg-slate-100'}`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </button>
          </div>
          {fileStatus && <div role="status" className={`text-[9px] leading-3 ${fileStatus.includes('失败') || fileStatus.includes('仅在') ? 'text-red-400' : 'text-slate-500'}`}>{fileStatus}</div>}
        </div>
      </PropertyRow>
    );
  }
  if (definition.type === 'file' && definition.key === 'videoSource') {
    const chooseVideo = async () => {
      setIsSelectingFile(true);
      setFileStatus('正在选择视频…');
      try {
        const result = await selectAndImportDesignerVideo(projectId);
        if (result.canceled) {
          setFileStatus('已取消选择。');
          return;
        }
        if (!result.ok || !result.relativePath) {
          setFileStatus(result.error || '视频复制失败。');
          return;
        }
        onChange(result.relativePath);
        setFileStatus(`已复制到 ${result.relativePath}`);
      } catch (error) {
        setFileStatus(error instanceof Error ? error.message : '视频复制失败。');
      } finally {
        setIsSelectingFile(false);
      }
    };
    return (
      <PropertyRow label={definition.label} isDarkMode={isDarkMode}>
        <div className="space-y-1">
          <div className="flex gap-1">
            <input type="text" value={String(value ?? '')} onChange={event => onChange(event.target.value)} placeholder="assets/项目/视频.mp4" className={`min-w-0 flex-1 rounded border px-2 py-0.5 text-xs ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`} />
            <button type="button" onClick={() => void chooseVideo()} disabled={isSelectingFile} title="选择本地视频并复制到项目 assets 目录" aria-label="选择本地视频" className={`flex h-7 w-8 shrink-0 items-center justify-center rounded border transition-colors disabled:cursor-wait disabled:opacity-50 ${isDarkMode ? 'border-[#3c3c44] bg-[#24242b] text-amber-400 hover:bg-[#303038]' : 'border-slate-300 bg-white text-amber-600 hover:bg-slate-100'}`}>
              <FolderOpen className="h-3.5 w-3.5" />
            </button>
          </div>
          {fileStatus && <div role="status" className={`text-[9px] leading-3 ${fileStatus.includes('失败') || fileStatus.includes('仅在') ? 'text-red-400' : 'text-slate-500'}`}>{fileStatus}</div>}
        </div>
      </PropertyRow>
    );
  }
  if (definition.key === 'imageListId') {
    return (
      <PropertyRow label={definition.label} isDarkMode={isDarkMode}>
        <select value={String(value ?? '')} onChange={event => onChange(event.target.value)} className={`w-full rounded border px-2 py-0.5 text-xs ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`}>
          <option value="">不使用图像列表</option>
          {imageLists.map(resource => <option key={resource.id} value={resource.id}>{resource.name}（{resource.id}）</option>)}
        </select>
      </PropertyRow>
    );
  }
  if (definition.type === 'stringList') {
    return (
      <PropertyRow label={definition.label} isDarkMode={isDarkMode}>
        <StringListPropertyEditor value={value} isDarkMode={isDarkMode} onChange={onChange} />
      </PropertyRow>
    );
  }
  if (complex) {
    return (
      <PropertyRow label={definition.label} isDarkMode={isDarkMode}>
        <StructuredCollectionEditor propertyKey={definition.key} controlType={controlType} value={value} controls={controls} isDarkMode={isDarkMode} onChange={onChange} />
      </PropertyRow>
    );
  }
  return <TextField label={definition.label} value={String(value ?? '')} isDarkMode={isDarkMode} onChange={onChange} />;
}

function StringListPropertyEditor({
  value,
  isDarkMode,
  onChange
}: {
  value: Win32ControlPropertyValue;
  isDarkMode: boolean;
  onChange: (value: Win32ControlPropertyValue) => void;
}) {
  const items = Array.isArray(value) ? value.map(item => String(item)) : [];
  const externalText = items.join('\n');
  const externalSignature = JSON.stringify(items);
  const lastEmittedSignature = useRef(externalSignature);
  const [draft, setDraft] = useState(externalText);

  useEffect(() => {
    if (externalSignature === lastEmittedSignature.current) return;
    lastEmittedSignature.current = externalSignature;
    setDraft(externalText);
  }, [externalSignature, externalText]);

  return (
    <textarea
      value={draft}
      onChange={event => {
        const nextDraft = event.target.value;
        const nextItems = parseStringListPropertyText(nextDraft);
        setDraft(nextDraft);
        lastEmittedSignature.current = JSON.stringify(nextItems);
        onChange(nextItems);
      }}
      onBlur={() => setDraft(current => parseStringListPropertyText(current).join('\n'))}
      rows={4}
      aria-label="项目集合，每行一个项目"
      placeholder="每行一个项目，按 Enter 换行"
      className={`w-full resize-y rounded border px-2 py-1 text-xs ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`}
    />
  );
}

function WindowEvents({
  window,
  isDarkMode,
  onChange
}: {
  window: LingWindowModel;
  isDarkMode: boolean;
  onChange: (events: NonNullable<LingWindowModel['events']>) => void;
}) {
  const [searchText, setSearchText] = useState('');
  const [onlyBound, setOnlyBound] = useState(false);
  const normalizedSearch = searchText.trim().toLocaleLowerCase();
  const eventValue = (eventName: string) => {
    if (Object.prototype.hasOwnProperty.call(window.events || {}, eventName)) return window.events?.[eventName] || '';
    return eventName === 'Loaded' ? getWindowEventHandlerName(window.className, eventName) : '';
  };
  const visibleEvents = WINDOW_EVENT_DEFINITIONS.filter(definition => {
    const handler = eventValue(definition.name).trim();
    if (onlyBound && !handler) return false;
    if (!normalizedSearch) return true;
    return [definition.label, definition.name, definition.handlerSuffix, definition.description]
      .some(value => value.toLocaleLowerCase().includes(normalizedSearch));
  });

  const updateBinding = (eventName: string, handlerName: string) => {
    onChange({ ...(window.events || {}), [eventName]: handlerName });
  };

  const openEventCode = (eventName: string) => {
    const handlerName = eventValue(eventName).trim() || getWindowEventHandlerName(window.className, eventName);
    updateBinding(eventName, handlerName);
    const detail: OpenControlEventCodeDetail = {
      controlId: window.id,
      controlName: window.className,
      controlContent: window.title,
      controlType: 'Grid',
      eventName,
      handlerName,
      windowFileName: window.fileName,
      windowClassName: window.className,
      windowTitle: window.title
    };
    globalThis.window.dispatchEvent(new CustomEvent<OpenControlEventCodeDetail>('open-control-event-code', { detail }));
  };

  return (
    <div className="space-y-3" aria-label={`窗口事件绑定：${window.className}`}>
      <div className={`border-b pb-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className={`flex items-center gap-1.5 text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-semibold">窗口事件：{window.className}</span>
        </div>
        <input
          type="search"
          value={searchText}
          onChange={event => setSearchText(event.target.value)}
          placeholder="搜索窗口事件…"
          aria-label="搜索窗口事件"
          className={`mt-2 w-full rounded border px-2.5 py-1.5 text-xs focus:border-amber-500 focus:outline-none ${
            isDarkMode ? 'border-[#2d2d34] bg-[#1b1b20] text-slate-200' : 'border-slate-300 bg-white text-slate-800'
          }`}
        />
        <label className={`mt-2 flex cursor-pointer items-center gap-1.5 text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          <input type="checkbox" checked={onlyBound} onChange={event => setOnlyBound(event.target.checked)} className="accent-amber-500" />
          仅显示已绑定事件
        </label>
      </div>

      {WINDOW_EVENT_CATEGORIES.map(category => {
        const items = visibleEvents.filter(definition => definition.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="space-y-1.5" aria-label={category}>
            <div className={`text-[10px] font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{category}</div>
            {items.map(definition => {
              const handler = eventValue(definition.name);
              const isBound = Boolean(handler.trim());
              const handlerName = handler.trim() || getWindowEventHandlerName(window.className, definition.name);
              const parameterSummary = definition.parameters?.length
                ? `参数：${definition.parameters.map(parameter => `${parameter.type} ${parameter.name}`).join('，')}`
                : '';
              return (
                <button
                  key={definition.name}
                  type="button"
                  onClick={() => openEventCode(definition.name)}
                  aria-label={`${isBound ? '打开' : '创建并打开'}${definition.label}事件处理器 ${handlerName}`}
                  className={`group w-full cursor-pointer rounded border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70 ${
                    isDarkMode
                      ? 'border-slate-800/70 bg-slate-900/40 hover:border-amber-500/45 hover:bg-amber-500/[0.06]'
                      : 'border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        {definition.label} <span className="font-mono text-[9px] font-normal text-slate-500">({definition.name})</span>
                      </div>
                      <div className="mt-0.5 text-[9.5px] leading-tight text-slate-500">{definition.description}</div>
                      {parameterSummary && <div className="mt-1 text-[9.5px] leading-tight text-cyan-500/80">{parameterSummary}</div>}
                    </div>
                    <span className={`shrink-0 rounded border px-1 py-0.5 text-[8px] ${
                      isBound ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : 'border-slate-500/20 text-slate-500'
                    }`}>{isBound ? '已绑定' : '未绑定'}</span>
                  </div>
                  <div className={`mt-2 flex min-h-7 items-center gap-2 rounded border px-2 py-1 ${
                    isDarkMode ? 'border-[#2d2d34] bg-[#1b1b20]' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <FileCode className={`h-3.5 w-3.5 shrink-0 ${isBound ? 'text-emerald-400' : 'text-amber-500'}`} />
                    <span className={`min-w-0 flex-1 truncate font-mono text-[10.5px] ${
                      isBound ? isDarkMode ? 'text-emerald-300' : 'text-emerald-700' : 'text-slate-500'
                    }`}>{handlerName}</span>
                    <span className={`shrink-0 text-[9px] font-semibold transition-colors ${
                      isDarkMode ? 'text-slate-500 group-hover:text-amber-400' : 'text-slate-500 group-hover:text-amber-700'
                    }`}>{isBound ? '打开代码' : '生成并打开'}</span>
                  </div>
                </button>
              );
            })}
          </section>
        );
      })}

      {visibleEvents.length === 0 && (
        <div className={`rounded border border-dashed p-4 text-center text-xs ${isDarkMode ? 'border-slate-800 text-slate-500' : 'border-slate-300 text-slate-500'}`}>
          没有符合条件的窗口事件。
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  isDarkMode,
  onChange
}: {
  label: string;
  value: string;
  isDarkMode: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <PropertyRow label={label} isDarkMode={isDarkMode}>
      <input
        type="text"
        value={value}
        onChange={event => onChange(event.target.value)}
        className={`w-full rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 ${
          isDarkMode ? 'bg-[#24242b] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
        }`}
      />
    </PropertyRow>
  );
}

function HotKeyField({
  label,
  value,
  isDarkMode,
  onChange
}: {
  label: string;
  value: string;
  isDarkMode: boolean;
  onChange: (value: string) => void;
}) {
  const descriptionId = useId();
  const [message, setMessage] = useState('');

  return (
    <PropertyRow label={label} isDarkMode={isDarkMode}>
      <div className="min-w-0 w-full space-y-1">
        <input
          type="text"
          readOnly
          value={value}
          placeholder="请按快捷键"
          aria-label={label}
          aria-describedby={descriptionId}
          title="单击后按下组合键；Backspace/Delete 清空，Esc 取消"
          onFocus={() => setMessage('请按下组合键；Backspace/Delete 清空。')}
          onBlur={() => setMessage('')}
          onKeyDown={event => {
            const result = captureDesignerHotKey(event);
            if (result.kind === 'pass') return;
            event.preventDefault();
            event.stopPropagation();

            if (result.kind === 'capture') {
              onChange(result.value);
              setMessage(`已设置 ${result.value}`);
            } else if (result.kind === 'clear') {
              onChange('');
              setMessage('已清空默认热键。');
            } else if (result.kind === 'cancel') {
              event.currentTarget.blur();
            } else if (result.kind === 'pending') {
              setMessage('请继续按下字母、数字或 F1–F12。');
            } else {
              setMessage(result.message);
            }
          }}
          onKeyUp={event => event.stopPropagation()}
          className={`w-full cursor-default rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 ${
            isDarkMode ? 'bg-[#24242b] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
          }`}
        />
        <div id={descriptionId} role="status" className="min-h-3 text-[9px] leading-3 text-slate-500">{message}</div>
      </div>
    </PropertyRow>
  );
}

function ReadOnlyTextField({
  label,
  value,
  isDarkMode
}: {
  label: string;
  value: string;
  isDarkMode: boolean;
}) {
  return (
    <PropertyRow label={label} isDarkMode={isDarkMode}>
      <input
        type="text"
        value={value}
        readOnly
        aria-label={`${label}（由工作台维护，只读）`}
        title="请通过工作台重命名流程修改，设计器不会单独改写源码关联。"
        className={`w-full cursor-text rounded border px-2 py-0.5 text-xs ${
          isDarkMode ? 'border-[#34343c] bg-[#1a1a20] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
        }`}
      />
    </PropertyRow>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  isDarkMode,
  onChange
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  isDarkMode: boolean;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(String(value));
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!isEditingRef.current) {
      setDraftValue(String(value));
    }
  }, [value]);

  const clampValue = (nextValue: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, nextValue));
  const commitDraftValue = (draft: string) => {
    const parsedValue = Number.parseInt(draft, 10);
    const nextValue = clampValue(Number.isFinite(parsedValue) ? parsedValue : value);
    setDraftValue(String(nextValue));
    if (nextValue !== value) {
      onChange(nextValue);
    }
  };

  return (
    <PropertyRow label={label} isDarkMode={isDarkMode}>
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={draftValue}
        aria-label={label}
        onFocus={() => {
          isEditingRef.current = true;
        }}
        onChange={event => {
          const nextDraftValue = event.target.value;
          setDraftValue(nextDraftValue);
          const parsedValue = Number.parseInt(nextDraftValue, 10);
          if (
            Number.isFinite(parsedValue)
            && (min === undefined || parsedValue >= min)
            && (max === undefined || parsedValue <= max)
          ) {
            onChange(parsedValue);
          }
        }}
        onBlur={() => {
          isEditingRef.current = false;
          commitDraftValue(draftValue);
        }}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        className={`w-full rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 ${
          isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
        }`}
      />
    </PropertyRow>
  );
}

function ColorField({
  label,
  value,
  swatches,
  isDarkMode,
  onChange
}: {
  label: string;
  value: string;
  swatches: string[];
  isDarkMode: boolean;
  onChange: (value: string) => void;
}) {
  const normalizedValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#1E1E24';

  return (
    <PropertyRow label={label} isDarkMode={isDarkMode}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={normalizedValue}
            onChange={event => onChange(event.target.value)}
            className="h-5 w-6 cursor-pointer rounded border border-slate-600/50 bg-transparent p-0"
            aria-label={`设置${label}`}
          />
          <span className="truncate font-mono text-[9px] text-slate-500">{value}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {swatches.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className={`relative h-5 w-5 shrink-0 cursor-pointer rounded-full border transition-transform hover:scale-110 ${
                value === color
                  ? 'border-amber-400 ring-1 ring-amber-400/70'
                  : isDarkMode ? 'border-slate-600/50' : 'border-slate-300'
              }`}
              style={{
                backgroundColor: color === 'transparent' ? 'transparent' : color,
                backgroundImage: color === 'transparent'
                  ? 'linear-gradient(45deg, #64748b 25%, transparent 25%), linear-gradient(-45deg, #64748b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #64748b 75%), linear-gradient(-45deg, transparent 75%, #64748b 75%)'
                  : undefined,
                backgroundSize: color === 'transparent' ? '8px 8px' : undefined,
                backgroundPosition: color === 'transparent' ? '0 0, 0 4px, 4px -4px, -4px 0px' : undefined
              }}
              title={color}
              aria-label={`设置${label} ${color}`}
            >
              {value === color && (
                <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white drop-shadow">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </PropertyRow>
  );
}

function IconTabButton({
  active,
  isDarkMode,
  onClick,
  title,
  children
}: {
  active: boolean;
  isDarkMode: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 p-1.5 rounded cursor-pointer text-[12px] transition-all ${
        active
          ? isDarkMode ? 'bg-[#3b3b45] text-amber-400 font-bold' : 'bg-white text-amber-600 font-bold shadow-sm'
          : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
      }`}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}
