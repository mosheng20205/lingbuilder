import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clapperboard,
  Copy,
  FileCode,
  FileText,
  FolderOpen,
  FileUp,
  Globe,
  HelpCircle,
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
import ListViewDesignerPreview from './ListViewDesignerPreview';
import HeaderDesignerPreview from './HeaderDesignerPreview';
import TabControlDesignerPreview from './TabControlDesignerPreview';
import UpDownDesignerPreview from './UpDownDesignerPreview';
import ListViewCollectionDialog, { type ListViewCollectionEditorKind } from './ListViewCollectionDialog';
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
  getDesignerWindowContentOffset,
  getEplEventHandlerName,
  getEventsForType,
  getPrimaryDesignerEventBinding,
  getPrimaryEventNameForType,
  hasDesignerWindowMenu,
  notifyWindowDesignerDirtyStateChanged,
  readWindowDesignerState,
  saveWindowDesignerState,
  WINDOW_DESIGNER_PROJECT_UPDATED,
  PersistedWindowDesignerState,
  WindowDesignerDirtyStateDetail
} from '../services/windowDesigner/windowDesignerService';
import { normalizeToolbarButtons } from '../services/windowDesigner/toolbarButtonCollectionModel';
import { normalizeStatusBarParts } from '../services/windowDesigner/statusBarPartCollectionModel';
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
  WIN32_CONTROL_DEFINITIONS,
  Win32ControlPropertyDefinition,
  Win32ControlPropertyValue
} from '../services/windowDesigner/win32ControlRegistry';
import { CONTROL_FONT_FAMILY_OPTIONS, DEFAULT_CONTROL_FONT_FAMILY, getControlFontCssStyle, normalizeControlFont } from '../services/windowDesigner/controlFont';
import {
  buildControlHierarchy,
  canReparentControls,
  getEffectiveControlState,
  getControlDescendantIds,
  LingControlHierarchyNode,
  orderControlsForDesignerPainting,
  reparentControls
} from '../services/windowDesigner/controlHierarchy';
import { applyDesignerLayout, createNextRebarBand, DesignerHistory, nudgeControls, reconcileRebarBands, updateControlWithDescendants, type DesignerLayoutOperation } from '../services/windowDesigner/designerOperations';
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
import { getDesignerImagePreviewSource, selectAndImportDesignerAnimation, selectAndImportDesignerGif, selectAndImportDesignerIcon, selectAndImportDesignerImage, selectAndImportDesignerVideo } from '../services/windowDesigner/designerAssetClient';
import {
  isNewEmojiDesignerControlSupported,
  isNewEmojiDesignerEnabled
} from '../services/windowDesigner/newEmojiDesignerAdapter';
import {
  getControlTabSlot,
  getSelectedTabPage,
  getTabControlPages,
  isControlOnSelectedTab,
  isTabControlHeaderHidden,
  normalizeTabControlPages,
  type TabControlPage,
  type TabControlPageMutation
} from '../services/windowDesigner/tabControlModel';

type InspectorTab = 'properties' | 'events' | 'layout';
type ResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type DesignerZoomMode = 'fit' | 'manual';
const WINDOW_ROOT_DROP_TARGET = '__layout_window_root__';

export function parseStringListPropertyText(text: string): string[] {
  return text.split(/\r?\n/).filter(item => item.length > 0);
}

interface DesignerContextMenuState {
  x: number;
  y: number;
  controlId: string;
}

interface OpenControlEventCodeDetail {
  controlId: string;
  controlName: string;
  controlContent: string;
  controlType: LingControlType;
  eventName: string;
  handlerName: string;
  windowFileName: string;
  windowClassName: string;
  windowTitle: string;
}

export interface WpfDesignerProps {
  isDarkMode: boolean;
  activeFile?: any;
  projectId: string;
  onProjectChange?: (state: PersistedWindowDesignerState) => void;
  onDirtyChange?: (detail: WindowDesignerDirtyStateDetail) => void;
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
  'VideoPlayer', 'ListView', 'Header', 'TreeView', 'TabControl', 'StatusBar', 'ReBar',
  'IPAddress', 'TrackBar', 'UpDown', 'Upload', 'DragUpload', 'RichEdit', 'ColorPicker', 'CefBrowser'
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
  onProjectChange,
  onDirtyChange
}: WpfDesignerProps) {
  const initialDesignerState = readWindowDesignerState();
  const [project, setProject] = useState<LingWindowProject>(() => initialDesignerState.project);
  const currentProjectRef = useRef(project);
  const observedProjectRef = useRef(project);
  const suppressNextDirtySignalRef = useRef(false);
  const publishingDesignerStateRef = useRef(false);
  currentProjectRef.current = project;
  const [enabledDesignerModules, setEnabledDesignerModules] = useState<Set<string>>(() => new Set(['lingbuilder.win32.basic']));
  const [activeWindowId, setActiveWindowId] = useState(initialDesignerState.activeWindowId);

  useEffect(() => {
    if (activeFile && activeFile.name) {
      const className = activeFile.name.replace(/\.lcpp$/i, '');
      const xmlName = activeFile.name.replace(/\.lcpp$/i, '.xml');
      const foundWindow = project.windows.find(w =>
        w.fileName.toLowerCase() === xmlName.toLowerCase()
        || w.className.toLowerCase() === className.toLowerCase()
      );
      if (foundWindow && foundWindow.id !== activeWindowId) {
        setActiveWindowId(foundWindow.id);
      }
    }
  }, [activeFile, project.windows, activeWindowId]);

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
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>(initialDesignerState.selectedControlId ? [initialDesignerState.selectedControlId] : []);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const selectOnlyControl = (id: string | null) => { setSelectedControlId(id); setSelectedControlIds(id && !id.startsWith('__window_') ? [id] : []); setSelectedResourceId(null); };
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
    const handleDesignerProjectUpdated = (event: Event) => {
      if (publishingDesignerStateRef.current) return;
      const nextState = (event as CustomEvent<PersistedWindowDesignerState>).detail;
      if (!nextState) return;
      if (nextState.project.id !== projectId) return;

      if (currentProjectRef.current !== nextState.project) {
        suppressNextDirtySignalRef.current = true;
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

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [draggingResourceId, setDraggingResourceId] = useState<string | null>(null);
  const [resourceDragOffset, setResourceDragOffset] = useState({ x: 0, y: 0 });
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>('se');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });
  const [initialControlPos, setInitialControlPos] = useState({ x: 0, y: 0 });
  const [inspectorWidth, setInspectorWidth] = useState(300);
  const [zoomMode, setZoomMode] = useState<DesignerZoomMode>('fit');
  const [manualZoom, setManualZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);

  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const projectIdRef = useRef(project.id);
  projectIdRef.current = project.id;

  const activeWindow = useMemo(() => {
    return project.windows.find(window => window.id === activeWindowId) || project.windows[0];
  }, [activeWindowId, project.windows]);
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
  const designerPaintControls = useMemo(
    () => orderControlsForDesignerPainting(activeWindow.controls),
    [activeWindow.controls]
  );
  const windowContentOffset = getDesignerWindowContentOffset(activeWindow);
  const useNewEmojiDesigner = isNewEmojiDesignerEnabled(enabledDesignerModules);

  const refreshDesignerModules = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/modules/project?projectId=${encodeURIComponent(projectId)}`);
      if (!response.ok) throw new Error('模块服务不可用');
      const result = await response.json();
      if (projectIdRef.current !== projectId) return;
      const ids = (Array.isArray(result.modules) ? result.modules : [])
        .map((module: any) => module?.manifest?.id)
        .filter((id: unknown): id is string => typeof id === 'string');
      setEnabledDesignerModules(new Set(['lingbuilder.win32.basic', ...ids]));
    } catch {
      if (projectIdRef.current === projectId) {
        setEnabledDesignerModules(new Set(['lingbuilder.win32.basic']));
      }
    }
  }, []);

  useEffect(() => {
    void refreshDesignerModules(project.id);

    const handleModulesChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string; scope?: string }>).detail;
      if (detail?.scope === 'project' && detail.projectId && detail.projectId !== project.id) return;
      void refreshDesignerModules(project.id);
    };

    window.addEventListener('lingbuilder-modules-changed', handleModulesChanged);
    return () => window.removeEventListener('lingbuilder-modules-changed', handleModulesChanged);
  }, [project.id, refreshDesignerModules]);

  const canvasScale = zoomMode === 'fit' ? fitScale : manualZoom;

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport || !activeWindow) return;

    const updateFitScale = () => {
      const availableWidth = Math.max(240, viewport.clientWidth - 48);
      const availableHeight = Math.max(180, viewport.clientHeight - 82);
      const nextScale = Math.max(
        0.25,
        Math.min(1, availableWidth / activeWindow.width, availableHeight / activeWindow.height)
      );
      setFitScale(previous => Math.abs(previous - nextScale) < 0.005 ? previous : nextScale);
    };

    updateFitScale();
    const observer = new ResizeObserver(updateFitScale);
    observer.observe(viewport);
    window.addEventListener('resize', updateFitScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateFitScale);
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

  const addLog = useCallback((message: string) => {
    window.dispatchEvent(new CustomEvent('add-app-log', { detail: { message } }));
  }, []);

  useEffect(() => {
    if (project.id !== projectId) return;
    publishingDesignerStateRef.current = true;
    try {
      saveWindowDesignerState({
        project,
        activeWindowId,
        selectedControlId
      });
    } finally {
      publishingDesignerStateRef.current = false;
    }
  }, [activeWindowId, project, projectId, selectedControlId]);

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
  }, [activeWindowId, onDirtyChange, onProjectChange, project, projectId, selectedControlId]);

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
    const startX = mouseDownEvent.clientX;
    const startY = mouseDownEvent.clientY;
    const startWidth = activeWindow.width;
    const startHeight = activeWindow.height;

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

      updateActiveWindow(window => ({
        ...window,
        width: nextWidth,
        height: nextHeight
      }));
    };

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
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
    updateActiveWindow(window => ({
      ...window,
      controls: reconcileRebarBands(updateControlWithDescendants(window.controls, selectedControlId, updatedFields))
    }));
  };

  const handleSelectWindow = (windowId: string) => {
    const nextWindow = project.windows.find(window => window.id === windowId);
    if (!nextWindow) return;
    setActiveWindowId(windowId);
    selectOnlyControl(nextWindow.controls[0]?.id || null);
  };

  const updateTabControlPages = (controlId: string, pages: TabControlPage[], mutation?: TabControlPageMutation) => {
    updateActiveWindow(window => {
      const tabControl = window.controls.find(control => control.id === controlId && control.type === 'TabControl');
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
            properties: { ...(control.properties || {}), tabs: pages.map(page => ({ ...page })), selectedIndex }
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
    if (!canReparentControls(activeWindow.controls, uniqueControlIds, parentId, containerSlot)) return;

    updateActiveWindow(window => {
      const controls = reconcileRebarBands(reparentControls(window.controls, uniqueControlIds, parentId, containerSlot));
      if (controls === window.controls) return window;
      if (!target) return { ...window, controls };
      const inset = 12;
      const topInset = target.type === 'TabControl' && !isTabControlHeaderHidden(target) ? 36 : inset;
      const sourceLeft = Math.min(...sources.map(control => control.x));
      const sourceTop = Math.min(...sources.map(control => control.y));
      const sourceRight = Math.max(...sources.map(control => control.x + control.width));
      const sourceBottom = Math.max(...sources.map(control => control.y + control.height));
      const availableLeft = target.x + inset;
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
    const page = target?.type === 'TabControl'
      ? getTabControlPages(target).find(item => item.id === containerSlot)
      : undefined;
    const sourceLabel = uniqueControlIds.length > 1 ? `${uniqueControlIds.length} 个控件` : sources[0].name;
    addLog(`> [${new Date().toLocaleTimeString()}] 【可视化设计】已将 ${sourceLabel} 移到${page ? `${target?.name} / ${page.title}` : target ? `容器 ${target.name}` : '窗口根级'}。`);
  };

  const handleSelectTabPage = (tabControlId: string, pageId: string) => {
    const tabControl = activeWindow.controls.find(control => control.id === tabControlId && control.type === 'TabControl');
    if (!tabControl) return;
    const pageIndex = getTabControlPages(tabControl).findIndex(page => page.id === pageId);
    if (pageIndex < 0) return;
    updateActiveWindow(window => ({
      ...window,
      controls: window.controls.map(control => control.id === tabControlId
        ? { ...control, properties: { ...(control.properties || {}), selectedIndex: pageIndex } }
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

  const handleAddWindow = () => {
    const nextWindow = createBlankWindow(project.windows.length + 1);
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
  const applyLayoutOperation = (operation: DesignerLayoutOperation) => { try { setProject(previous => ({ ...previous, windows: previous.windows.map(item => item.id === activeWindowId ? applyDesignerLayout(item, selectedControlIds, operation) : item) })); } catch (error) { addLog(`> 【布局】${error instanceof Error ? error.message : String(error)}`); } };
  const nudgeSelection = (dx: number, dy: number) => { if (!selectedControlIds.length) return; setProject(previous => ({ ...previous, windows: previous.windows.map(item => item.id === activeWindowId ? nudgeControls(item, selectedControlIds, dx, dy) : item) })); };

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

  const handleAddControl = (type: LingControlType) => {
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
    const typeIndex = activeWindow.controls.filter(control => control.type === type).length + 1;
    const selectedParent = activeWindow.controls.find(control => (
      control.id === selectedControlId && getWin32ControlDefinition(control.type)?.isContainer
    ));
    const selectedPage = selectedParent?.type === 'TabControl' ? getSelectedTabPage(selectedParent) : undefined;
    const createdControl = createControl(type, typeIndex);
    const newControl = {
      ...createdControl,
      x: selectedParent ? selectedParent.x + 12 : createdControl.x,
      y: selectedParent ? selectedParent.y + (selectedParent.type === 'TabControl' && !isTabControlHeaderHidden(selectedParent) ? 36 : 12) : createdControl.y,
      parentId: selectedParent?.id,
      containerSlot: selectedPage?.id
    };
    updateActiveWindow(window => ({
      ...window,
      controls: reconcileRebarBands([...window.controls, newControl])
    }));
    setSelectedControlId(newControl.id);
    setActiveInspectorTab('properties');
    addLog(`> [${new Date().toLocaleTimeString()}] 【可视化设计】已在 ${activeWindow.fileName} 添加控件：${CONTROL_LABELS[type]}。`);
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

  const openControlContextMenu = (event: React.MouseEvent, controlId: string) => {
    event.preventDefault();
    event.stopPropagation();
    selectOnlyControl(controlId);
    setActiveInspectorTab('properties');
    setControlContextMenu({ x: event.clientX, y: event.clientY, controlId });
  };

  const handleMouseDown = (event: React.MouseEvent, control: LingControl, action: 'drag' | ResizeDirection) => {
    event.stopPropagation();
    event.preventDefault();
    setSelectedResourceId(null);
    setActiveInspectorTab('properties');
    if (event.shiftKey || event.ctrlKey || event.metaKey) { setSelectedControlIds(current => current.includes(control.id) ? current.filter(id => id !== control.id) : [...current, control.id]); setSelectedControlId(control.id); return; }
    if (!selectedControlIds.includes(control.id)) setSelectedControlIds([control.id]);
    setSelectedControlId(control.id);

    if (action === 'drag') {
      setIsDragging(true);
      setDragOffset({
        x: event.clientX - control.x * canvasScale,
        y: event.clientY - control.y * canvasScale
      });
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

  const handleFileDialogMouseDown = (event: React.MouseEvent, resource: LingFileDialogResource, index: number) => {
    event.preventDefault();
    event.stopPropagation();
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
    event.preventDefault();
    event.stopPropagation();
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

  const handleControlDoubleClick = (event: React.MouseEvent, control: LingControl) => {
    event.preventDefault();
    event.stopPropagation();

    if (!activeWindow) return;

    const { eventName, handlerName, menuEventKey } = getPrimaryDesignerEventBinding(control, activeWindow);

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
      updateActiveWindow(window => {
        let changed = false;
        const controls = window.controls.map(item => {
          if (item.id !== control.id) return item;
          if (item.events?.[eventName] === handlerName) return item;
          changed = true;
          return {
            ...item,
            events: {
              ...(item.events || {}),
              [eventName]: handlerName
            }
          };
        });
        return changed ? { ...window, controls } : window;
      });
    }

    const detail: OpenControlEventCodeDetail = {
      controlId: control.id,
      controlName: control.name,
      controlContent: control.content,
      controlType: control.type,
      eventName,
      handlerName,
      windowFileName: activeWindow.fileName,
      windowClassName: activeWindow.className,
      windowTitle: activeWindow.title
    };

    window.dispatchEvent(new CustomEvent<OpenControlEventCodeDetail>('open-control-event-code', { detail }));
    addLog(`> [${new Date().toLocaleTimeString()}] 【事件代码】已定位 ${control.name} 的默认事件：${handlerName}`);
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

  useEffect(() => { const keydown = (event: KeyboardEvent) => { const target = event.target as HTMLElement | null; if (target?.closest('input,textarea,select,[contenteditable="true"]')) return; if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redoDesigner() : undoDesigner(); return; } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redoDesigner(); return; } if (event.key === 'Delete' && selectedControlId) { event.preventDefault(); deleteControlById(selectedControlId); setControlContextMenu(null); return; } const step = event.shiftKey ? 10 : 1; const movement: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }; if (movement[event.key] && selectedControlIds.length) { event.preventDefault(); nudgeSelection(...movement[event.key]); } }; window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown); }, [project, selectedControlId, selectedControlIds, activeWindowId]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!activeWindow || !selectedControlId || !selectedControl) return;

      if (isDragging) {
        const maxX = Math.max(0, activeWindow.width - selectedControl.width);
        const maxY = Math.max(0, activeWindow.height - windowContentOffset - selectedControl.height);
        const nextX = Math.max(0, Math.min(maxX, (event.clientX - dragOffset.x) / canvasScale));
        const nextY = Math.max(0, Math.min(maxY, (event.clientY - dragOffset.y) / canvasScale));

        updateSelectedControl({
          x: Math.round(nextX / 5) * 5,
          y: Math.round(nextY / 5) * 5
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

        updateSelectedControl({
          x: Math.round(nextX / 5) * 5,
          y: Math.round(nextY / 5) * 5,
          width: Math.round(nextWidth / 5) * 5,
          height: Math.round(nextHeight / 5) * 5
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection('se');
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    activeWindow,
    canvasScale,
    dragOffset,
    initialPos,
    initialControlPos,
    initialSize,
    isDragging,
    isResizing,
    resizeDirection,
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
      setProject(previous => ({
        ...previous,
        resources: (previous.resources || []).map(resource => resource.id === draggingResourceId && (resource.type === 'FileDialog' || resource.type === 'ContextMenu' || resource.type === 'PopupMenu')
          ? { ...resource, designerX: Math.round(nextX / 5) * 5, designerY: Math.round(nextY / 5) * 5 }
          : resource)
      }));
    };
    const handleMouseUp = () => setDraggingResourceId(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeWindow.height, activeWindow.width, canvasScale, draggingResourceId, resourceDragOffset, windowContentOffset]);

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
      const lingCppSourceCode = requestWindowDesignerLingCppSource(
        activeWindowId,
        activeWindow?.fileName,
        activeWindow?.className
      );
      const response = await fetch('/api/window-designer/build-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project,
          activeWindowId,
          lingCppSourceCode,
          run: true
        })
      });

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
            onClick={handleAddWindow}
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
        <div
          className={`w-60 flex flex-col shrink-0 select-none border-r ${
            isDarkMode ? 'bg-[#1a1a20] border-[#2d2d34]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className={`p-2.5 border-b ${isDarkMode ? 'border-[#2d2d34]' : 'border-slate-200'}`}>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>窗口程序集</span>
            </div>
          </div>

          <div className="p-2 space-y-1 border-b border-slate-800/40">
            {project.windows.map(window => (
              <button
                key={window.id}
                onClick={() => handleSelectWindow(window.id)}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left text-[11px] cursor-pointer border ${
                  window.id === activeWindow.id
                    ? isDarkMode
                      ? 'bg-[#37373D] border-[#007ACC]/60 text-white'
                      : 'bg-blue-50 border-blue-300 text-blue-700'
                    : isDarkMode
                      ? 'bg-transparent border-transparent text-slate-400 hover:bg-[#25252b] hover:text-slate-200'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <Monitor className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                  <span className="truncate">{window.fileName}</span>
                </span>
                <span className="text-[9px] text-slate-500 shrink-0">{window.controls.length}</span>
              </button>
            ))}
          </div>

          <div className={`p-2.5 border-b ${isDarkMode ? 'border-[#2d2d34]' : 'border-slate-200'}`}>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Wrench className="w-3.5 h-3.5 text-blue-500" />
              <span>控件工具箱</span>
              {useNewEmojiDesigner && <span className="ml-auto rounded border border-fuchsia-400/30 bg-fuchsia-500/10 px-1.5 py-0.5 text-[8px] normal-case tracking-normal text-fuchsia-300">new_emoji 原生</span>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <p className={`text-[10px] px-1 leading-relaxed ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
              点击控件即可添加到当前窗口，随后可在画布中拖拽、改尺寸、绑定中文事件。
            </p>
            <div className="grid grid-cols-1 gap-1">
              {CREATABLE_DESIGNER_CONTROL_TYPES.map(type => (
                (() => {
                  const definition = getWin32ControlDefinition(type);
                  const moduleEnabled = !definition || enabledDesignerModules.has(definition.moduleId);
                  const backendSupported = !useNewEmojiDesigner || isNewEmojiDesignerControlSupported(type);
                  const enabled = moduleEnabled && backendSupported;
                  const disabledReason = !moduleEnabled
                    ? `需要启用 ${definition?.moduleId}`
                    : `new_emoji 设计后端暂不支持 ${CONTROL_LABELS[type]}`;
                  return (
                <button
                  key={type}
                  onClick={() => handleAddControl(type)}
                  disabled={!enabled}
                  title={enabled ? `添加${useNewEmojiDesigner ? 'new_emoji ' : ''}${CONTROL_LABELS[type]}` : disabledReason}
                  aria-label={enabled ? `添加${CONTROL_LABELS[type]}` : disabledReason}
                  className={`flex items-center gap-2 px-2.5 py-2 text-left text-xs rounded border cursor-pointer transition-all ${
                    !enabled ? 'opacity-45 cursor-not-allowed ' : ''
                  }${
                    isDarkMode
                      ? 'text-slate-300 hover:text-white border-transparent hover:border-[#3c3c44] hover:bg-[#25252b]/80'
                      : 'text-slate-700 hover:text-slate-900 border-slate-200 bg-white hover:bg-slate-100 shadow-sm'
                  }`}
                >
                  {getControlIcon(type)}
                  <span className="min-w-0 flex-1 truncate">{CONTROL_LABELS[type]} ({type})</span>
                  {useNewEmojiDesigner && backendSupported && <span className="text-[8px] text-fuchsia-300">NE</span>}
                  {definition?.moduleId === 'lingbuilder.win32.common-controls' && <span className="text-[8px] text-violet-400">高级</span>}
                </button>
                  );
                })()
              ))}
            </div>

            <div className={`mt-4 p-2 rounded text-[10px] leading-relaxed border ${
              isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-amber-50 border-amber-200 text-slate-700'
            }`}>
              <span className="font-semibold text-amber-600 flex items-center gap-1 mb-1">
                <HelpCircle className="w-3 h-3" />
                中文窗口设计
              </span>
              每个窗口都会生成独立的中文 XML 布局和中文 C++ 类，事件处理器可直接用中文命名。
            </div>
            {useNewEmojiDesigner && (
              <div role="status" className="rounded border border-fuchsia-400/25 bg-fuchsia-500/10 p-2 text-[10px] leading-relaxed text-fuchsia-200">
                <span className="mb-1 flex items-center gap-1 font-semibold"><Check className="h-3 w-3" />new_emoji 设计后端已启用</span>
                画布与 F5 将使用 Direct2D/DirectWrite 原生控件；未适配控件会保持禁用并说明原因。
              </div>
            )}
          </div>
        </div>

        <div ref={canvasViewportRef} className={`flex-1 p-6 flex flex-col overflow-auto items-center justify-start relative select-none ${
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
              {([['align-left','左齐'],['align-top','顶齐'],['align-right','右齐'],['align-bottom','底齐'],['align-hcenter','水平居中'],['align-vcenter','垂直居中'],['distribute-horizontal','横向分布'],['distribute-vertical','纵向分布'],['same-width','等宽'],['same-height','等高']] as Array<[DesignerLayoutOperation,string]>).map(([operation,label]) => <button key={operation} type="button" disabled={selectedControlIds.length < 2} onClick={() => applyLayoutOperation(operation)} title={label} className="rounded px-1 py-0.5 hover:bg-slate-500/15 disabled:opacity-30">{label}</button>)}
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
            className="relative shrink-0"
            style={{
              width: `${activeWindow.width * canvasScale}px`,
              height: `${activeWindow.height * canvasScale}px`
            }}
          >
            <div
              ref={canvasRef}
              id="wpf-design-canvas"
              onDoubleClick={handleCanvasDoubleClick}
              className="relative shadow-2xl border-2 border-slate-700/60 overflow-hidden shrink-0 select-none"
              style={{
                width: `${activeWindow.width}px`,
                height: `${activeWindow.height}px`,
                transform: `scale(${canvasScale})`,
                transformOrigin: 'top left',
                backgroundColor: activeWindow.background,
                backgroundImage: useNewEmojiDesigner
                  ? 'radial-gradient(circle at 15% 10%, rgba(168,85,247,0.16), transparent 32%), radial-gradient(circle at 85% 90%, rgba(34,211,238,0.12), transparent 34%), radial-gradient(circle at 1px 1px, rgba(148,163,184,0.22) 0.8px, transparent 0.9px)'
                  : isDarkMode
                    ? 'radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.34) 0.85px, transparent 0.95px)'
                    : 'radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.24) 0.85px, transparent 0.95px)',
                backgroundSize: '12px 12px',
                backgroundPosition: '0 0',
                borderRadius: activeWindow.cornerStyle === 'square'
                  ? '0'
                  : activeWindow.cornerStyle === 'small-rounded' ? '4px' : '8px'
              }}
              onClick={() => {
                selectOnlyControl(null);
                setActiveInspectorTab('properties');
              }}
            >
            {/* Window Resize Handles */}
            <div
              onMouseDown={e => startResizeWindow(e, 'r')}
              className="absolute right-[-4px] top-0 w-[8px] h-full cursor-col-resize z-50 hover:bg-blue-500/20"
            />
            <div
              onMouseDown={e => startResizeWindow(e, 'b')}
              className="absolute left-0 bottom-[-4px] w-full h-[8px] cursor-row-resize z-50 hover:bg-blue-500/20"
            />
            <div
              onMouseDown={e => startResizeWindow(e, 'se')}
              className="absolute right-[-6px] bottom-[-6px] w-[12px] h-[12px] cursor-se-resize z-51 rounded-full bg-blue-500 border border-white hover:scale-125 transition-transform"
            />
            <div
              className="h-7 flex items-center justify-between px-3 border-b border-black/25 select-none canvas-title-bar"
              style={{
                backgroundColor: activeWindow.titleBarBackground || DEFAULT_WINDOW_TITLE_BAR_BACKGROUND,
                color: activeWindow.titleBarForeground || DEFAULT_WINDOW_TITLE_BAR_FOREGROUND,
                backgroundImage: useNewEmojiDesigner ? 'linear-gradient(90deg, rgba(126,34,206,0.7), rgba(8,145,178,0.55))' : undefined
              }}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-sans font-medium min-w-0">
                {(activeWindow.iconStyle || DEFAULT_WINDOW_ICON_STYLE) === 'custom' && activeWindow.iconPath ? (
                  <img src={getDesignerImagePreviewSource(projectId, activeWindow.iconPath)} alt="窗口图标" className="h-3.5 w-3.5 shrink-0 object-contain" />
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
              const effectiveState = getEffectiveControlState(activeWindow.controls, control.id);
              const ancestorsVisible = !control.parentId
                || getEffectiveControlState(activeWindow.controls, control.parentId).visible;
              return renderControl(
                control,
                projectId,
                selectedControlIds.includes(control.id),
                handleMouseDown,
                setSelectedControlId,
                handleControlDoubleClick,
                openControlContextMenu,
                windowContentOffset,
                useNewEmojiDesigner,
                effectiveState.visible,
                effectiveState.enabled,
                ancestorsVisible && isControlOnSelectedTab(activeWindow.controls, control.id),
                control.type === 'TabControl' ? pageId => handleSelectTabPage(control.id, pageId) : undefined,
                control.type === 'ReBar' ? (fromIndex, toIndex) => handleReorderRebarBand(control.id, fromIndex, toIndex) : undefined
              );
            })}
            {activeFileDialogs.map((resource, index) => {
              const position = getFileDialogDesignerPosition(resource, index);
              const selected = selectedResourceId === resource.id;
              return (
                <div
                  key={resource.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`文件对话框占位：${resource.name}`}
                  aria-pressed={selected}
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
              const position = getMenuResourceDesignerPosition(resource, index);
              const selected = selectedResourceId === resource.id;
              const isContext = resource.type === 'ContextMenu';
              return (
                <div
                  key={resource.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${isContext ? '上下文菜单' : '弹出菜单'}占位：${resource.name}`}
                  aria-pressed={selected}
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
          </div>
        </div>

        <div
          onMouseDown={startResizeInspector}
          className={`w-[4px] cursor-col-resize hover:bg-blue-500/50 transition-colors shrink-0 z-10 ${
            isDarkMode ? 'bg-[#2d2d34]' : 'bg-slate-200'
          }`}
          style={{ cursor: 'col-resize' }}
        />
        <div
          style={{ width: `${inspectorWidth}px` }}
          className={`flex flex-col shrink-0 select-none border-l ${
            isDarkMode ? 'bg-[#1a1a20] border-[#2d2d34]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className={`p-2.5 border-b flex items-center justify-between ${
            isDarkMode ? 'border-[#2d2d34] bg-[#22222a]/30' : 'border-slate-200 bg-slate-100/60'
          }`}>
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 text-slate-500">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>属性、事件与布局</span>
            </span>
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
                />
                <BehaviorResourceEditor
                  resources={project.resources || []}
                  windows={project.windows}
                  isDarkMode={isDarkMode}
                  onChange={resources => setProject(previous => ({ ...previous, resources }))}
                />
                {selectedControlId === null ? (
                  <WindowProperties
                    projectId={projectId}
                    window={activeWindow}
                    isDarkMode={isDarkMode}
                    onChange={fields => updateActiveWindow(window => ({ ...window, ...fields }))}
                  />
                ) : (
                  <ControlProperties
                    projectId={projectId}
                    control={selectedControl}
                    controls={activeWindow.controls}
                    imageLists={(project.resources || []).filter((resource): resource is LingImageListResource => resource.type === 'ImageList')}
                    isDarkMode={isDarkMode}
                    onChange={updateSelectedControl}
                    onTabPagesChange={updateTabControlPages}
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
                  windowModel={activeWindow}
                  isDarkMode={isDarkMode}
                  onChange={updateSelectedControl}
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
        <div
          role="menu"
          aria-label="控件快捷菜单"
          className={`fixed z-[200] min-w-36 overflow-hidden rounded-md border py-1 shadow-2xl ${
            isDarkMode ? 'border-[#45454f] bg-[#252526] text-slate-200' : 'border-slate-200 bg-white text-slate-800'
          }`}
          style={{
            left: `${Math.min(controlContextMenu.x, window.innerWidth - 160)}px`,
            top: `${Math.min(controlContextMenu.y, window.innerHeight - 90)}px`
          }}
          onClick={event => event.stopPropagation()}
          onContextMenu={event => event.preventDefault()}
        >
          <button
            type="button"
            role="menuitem"
            disabled={controlContextMenu.controlId === '__window_menu_bar__'}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
              isDarkMode ? 'hover:bg-[#094771]' : 'hover:bg-blue-50'
            } disabled:cursor-not-allowed disabled:opacity-40`}
            onClick={() => {
              duplicateControlById(controlContextMenu.controlId);
              setControlContextMenu(null);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            <span>复制</span>
          </button>
          <div className={isDarkMode ? 'my-1 border-t border-[#3c3c44]' : 'my-1 border-t border-slate-200'} />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-rose-500 transition-colors hover:bg-rose-500/15"
            onClick={() => {
              deleteControlById(controlContextMenu.controlId);
              setControlContextMenu(null);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>删除</span>
            <span className="ml-auto text-[10px] opacity-60">Delete</span>
          </button>
        </div>
      )}
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
        const tabPages = node.control.type === 'TabControl' ? getTabControlPages(node.control) : [];
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
    const tabPageIds = window.controls.flatMap(control => control.type === 'TabControl'
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
    const tabPages = node.control.type === 'TabControl' ? getTabControlPages(node.control) : [];
    const selectedTabPage = node.control.type === 'TabControl' ? getSelectedTabPage(node.control) : undefined;
    const hasChildren = node.children.length > 0 || tabPages.length > 0;
    const expanded = expandedIds.has(node.control.id);
    const selected = selectedControlIds.includes(node.control.id);
    const isContainer = Boolean(getWin32ControlDefinition(node.control.type)?.isContainer);
    const defaultDropSlot = node.control.type === 'TabControl' ? selectedTabPage?.id : undefined;
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
  isEffectivelyVisible: boolean,
  isEffectivelyEnabled: boolean,
  ancestorsVisible: boolean,
  onSelectTabPage?: (pageId: string) => void,
  onReorderRebarBand?: (fromIndex: number, toIndex: number) => void
) {
  const isCollapsed = !isEffectivelyVisible && ancestorsVisible;
  const isHiddenByAncestor = !ancestorsVisible;
  const definition = getWin32ControlDefinition(control.type);
  const controlFontStyle = getControlFontCssStyle(control);
  const newEmojiSupported = isNewEmojiDesignerControlSupported(control.type);
  const hasSpecialPreview = hasDedicatedControlPreview(control.type)
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
      onClick={event => {
        event.stopPropagation();
        setSelectedControlId(control.id);
      }}
      onDoubleClick={event => onOpenEventCode(event, control)}
      onContextMenu={event => onOpenContextMenu(event, control.id)}
      onMouseDown={event => handleMouseDown(event, control, 'drag')}
      title={`双击打开事件代码：${getEplEventHandlerName(control.name, getPrimaryEventNameForType(control.type))}`}
      className={`absolute group cursor-move select-none ${
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
      {isSelected && (
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
        {control.type === 'Button' && (
          <button
            disabled={!isEffectivelyEnabled}
            className={`w-full h-full text-center text-xs shadow flex items-center justify-center px-2 select-none border ${useNewEmojiDesigner ? 'border-fuchsia-300/35 shadow-[0_8px_24px_rgba(124,58,237,0.24)]' : 'border-transparent'}`}
            style={{
              background: useNewEmojiDesigner ? `linear-gradient(135deg, ${control.background === 'transparent' ? '#7C3AED' : control.background}, #0891B2)` : control.background,
              color: control.foreground,
              fontSize: `${control.fontSize}px`,
              fontFamily: controlFontStyle.fontFamily,
              fontWeight: controlFontStyle.fontWeight,
              fontStyle: controlFontStyle.fontStyle,
              textDecoration: controlFontStyle.textDecoration,
              opacity: isEffectivelyEnabled ? 1 : 0.5,
              borderRadius: `${useNewEmojiDesigner ? Math.max(8, Math.min(control.height / 2, 12)) : Math.min(Math.max(Number(control.properties?.cornerRadius ?? 6), 0), Math.min(control.width, control.height) / 2)}px`
            }}
          >
            {control.content}
          </button>
        )}

        {control.type === 'TextBox' && (
          <div
            className={`w-full h-full rounded border px-2 py-1 flex text-xs select-none ${useNewEmojiDesigner ? 'border-fuchsia-300/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'border-slate-700'}`}
            style={{
              backgroundColor: useNewEmojiDesigner && control.background === 'transparent' ? 'rgba(15,23,42,0.82)' : control.background,
              color: control.foreground,
              fontSize: `${control.fontSize}px`,
              opacity: isEffectivelyEnabled ? 1 : 0.5,
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
            <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center shrink-0 ${useNewEmojiDesigner ? 'border-fuchsia-300/70 bg-fuchsia-950/60' : 'border-slate-500 bg-slate-900'}`}>
              {control.properties?.checked === true && <Check className="w-2.5 h-2.5" style={{ color: control.foreground }} />}
            </div>
            <span className="truncate">{control.content}</span>
          </div>
        )}

        {control.type === 'RadioButton' && (
          <div
            className="w-full h-full flex items-center gap-2 text-xs select-none"
            style={{ color: control.foreground, fontSize: `${control.fontSize}px`, backgroundColor: control.background === 'transparent' ? 'transparent' : control.background }}
          >
            <div className={`w-3.5 h-3.5 border rounded-full flex items-center justify-center shrink-0 ${useNewEmojiDesigner ? 'border-cyan-300/80 bg-cyan-950/60 shadow-[0_0_10px_rgba(34,211,238,0.28)]' : 'border-slate-500 bg-slate-900'}`}>
              {control.properties?.checked === true && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: control.foreground }} />}
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

        {control.type === 'Header' && <HeaderDesignerPreview control={control} />}

        {control.type === 'StatusBar' && (
          <StatusBarDesignerPreview control={control} isEnabled={isEffectivelyEnabled} />
        )}

        {control.type === 'ReBar' && (
          <RebarDesignerPreview control={control} onReorder={onReorderRebarBand} interactive={isSelected} />
        )}

        {control.type === 'TabControl' && <TabControlDesignerPreview control={control} onSelectPage={onSelectTabPage} />}

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
      </div>

      {isSelected && (
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

function WindowProperties({
  projectId,
  window,
  isDarkMode,
  onChange
}: {
  projectId: string;
  window: LingWindowModel;
  isDarkMode: boolean;
  onChange: (fields: Partial<LingWindowModel>) => void;
}) {
  const [isSelectingIcon, setIsSelectingIcon] = useState(false);
  const [iconStatus, setIconStatus] = useState('');
  const openPlacement = window.openPlacement || 'default';
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
        <PropertyRow label="窗口圆角" isDarkMode={isDarkMode}>
          <select
            value={window.cornerStyle || DEFAULT_WINDOW_CORNER_STYLE}
            onChange={event => onChange({ cornerStyle: event.target.value as LingWindowCornerStyle })}
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
      <PropertyGroup title="当前窗口 / 状态" isDarkMode={isDarkMode} defaultOpen={false}>
        <PropertyRow label="禁止拖拽调整大小" isDarkMode={isDarkMode}>
          <input
            type="checkbox"
            checked={window.resizable === false}
            onChange={event => onChange({ resizable: !event.target.checked })}
            aria-label="禁止拖拽窗口大小"
            className="h-4 w-4 accent-amber-500"
          />
        </PropertyRow>
        <PropertyRow label="禁止窗口最大化" isDarkMode={isDarkMode}>
          <input
            type="checkbox"
            checked={window.maximizable === false}
            onChange={event => onChange({ maximizable: !event.target.checked })}
            aria-label="禁止窗口最大化"
            className="h-4 w-4 accent-amber-500"
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

function BehaviorResourceEditor({ resources, windows, isDarkMode, onChange }: { resources: LingDesignerResource[]; windows: LingWindowModel[]; isDarkMode: boolean; onChange: (resources: LingDesignerResource[]) => void }) {
  const controls = windows.flatMap(window => window.controls);
  const tooltips = resources.filter((resource): resource is LingToolTipResource => resource.type === 'ToolTip');
  const sheets = resources.filter((resource): resource is LingPropertySheetResource => resource.type === 'PropertySheet');
  const replace = (resource: LingDesignerResource) => onChange(resources.map(item => item.id === resource.id ? resource : item));
  const remove = (id: string) => onChange(resources.filter(item => item.id !== id));
  const uniqueId = (prefix: string) => { let index = 1; while (resources.some(resource => resource.id === `${prefix}-${index}`)) index += 1; return `${prefix}-${index}`; };
  const inputClass = `w-full rounded border px-1 py-0.5 text-[10px] ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`;
  return <PropertyGroup title={`项目 / 附加行为（${tooltips.length + sheets.length}）`} isDarkMode={isDarkMode} defaultOpen={false}>
    <div className="space-y-2 p-2">
      {tooltips.map(resource => <div key={resource.id} className={`space-y-1 rounded border p-2 ${isDarkMode ? 'border-[#34343d]' : 'border-slate-200'}`}>
        <div className="flex items-center gap-1"><span className="text-[10px] font-semibold text-cyan-500">ToolTip · {resource.name}</span><button type="button" onClick={() => remove(resource.id)} className="ml-auto text-red-400"><Trash2 className="h-3 w-3" /></button></div>
        <select aria-label="工具提示目标控件" value={resource.targetControlId} onChange={event => replace({ ...resource, targetControlId: event.target.value })} className={inputClass}><option value="">选择目标控件</option>{controls.map(control => <option key={control.id} value={control.id}>{control.name}</option>)}</select>
        <input aria-label="工具提示文字" value={resource.text} onChange={event => replace({ ...resource, text: event.target.value })} placeholder="提示文字" className={inputClass} />
        <input aria-label="工具提示延迟" type="number" min={0} value={resource.initialDelay} onChange={event => replace({ ...resource, initialDelay: Math.max(0, Number(event.target.value) || 0) })} className={inputClass} />
      </div>)}
      {sheets.map(resource => <div key={resource.id} className={`space-y-1 rounded border p-2 ${isDarkMode ? 'border-[#34343d]' : 'border-slate-200'}`}>
        <div className="flex items-center gap-1"><span className="text-[10px] font-semibold text-violet-500">PropertySheet · {resource.name}</span><button type="button" onClick={() => remove(resource.id)} className="ml-auto text-red-400"><Trash2 className="h-3 w-3" /></button></div>
        <input aria-label="属性页窗口标题" value={resource.title} onChange={event => replace({ ...resource, title: event.target.value })} className={inputClass} />
        <input aria-label="属性页应用事件处理器" value={resource.appliedHandler || ''} onChange={event => replace({ ...resource, appliedHandler: event.target.value })} placeholder="如：_设置属性页_属性被应用" className={inputClass} />
        {resource.pages.map((page, index) => <div key={page.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1">
          <input aria-label="属性页标题" value={page.title} onChange={event => replace({ ...resource, pages: resource.pages.map((item, row) => row === index ? { ...item, title: event.target.value } : item) })} className={inputClass} />
          <input aria-label="属性页内容" value={page.content} onChange={event => replace({ ...resource, pages: resource.pages.map((item, row) => row === index ? { ...item, content: event.target.value } : item) })} className={inputClass} />
          <button type="button" onClick={() => replace({ ...resource, pages: resource.pages.filter((_, row) => row !== index) })} className="text-red-400">×</button>
          <select aria-label="属性页控件模板窗口" value={page.sourceWindowId || ''} onChange={event => replace({ ...resource, pages: resource.pages.map((item, row) => row === index ? { ...item, sourceWindowId: event.target.value || undefined } : item) })} className={`${inputClass} col-span-2`}><option value="">仅显示页面文字</option>{windows.map(window => <option key={window.id} value={window.id}>{window.title}（{window.controls.length} 个控件）</option>)}</select>
        </div>)}
        <button type="button" onClick={() => replace({ ...resource, pages: [...resource.pages, { id: `page-${resource.pages.length + 1}`, title: `页面 ${resource.pages.length + 1}`, content: '' }] })} className="w-full text-[9px] text-emerald-500">+ 添加属性页</button>
        <div className="text-[9px] text-slate-500">中文代码调用：属性页_显示(&quot;{resource.id}&quot;)</div>
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
  onChange
}: {
  resources: LingImageListResource[];
  isDarkMode: boolean;
  onChange: (resources: LingImageListResource[]) => void;
}) {
  const [open, setOpen] = useState(false);
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
          <div key={resource.id} className={`space-y-1 rounded border p-2 ${isDarkMode ? 'border-[#34343d] bg-black/10' : 'border-slate-200 bg-white'}`}>
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
  onChange,
  onTabPagesChange,
  onDelete
}: {
  projectId: string;
  control: LingControl | null;
  controls: LingControl[];
  imageLists: LingImageListResource[];
  isDarkMode: boolean;
  onChange: (fields: Partial<LingControl>) => void;
  onTabPagesChange: (controlId: string, pages: TabControlPage[], mutation?: TabControlPageMutation) => void;
  onDelete: () => void;
}) {
  const [listViewEditorKind, setListViewEditorKind] = useState<ListViewCollectionEditorKind | null>(null);
  const [headerColumnsEditorOpen, setHeaderColumnsEditorOpen] = useState(false);
  const [toolbarButtonsEditorOpen, setToolbarButtonsEditorOpen] = useState(false);
  const [statusBarPartsEditorOpen, setStatusBarPartsEditorOpen] = useState(false);
  const [tabPagesEditorOpen, setTabPagesEditorOpen] = useState(false);
  const [menuBarItemsEditorOpen, setMenuBarItemsEditorOpen] = useState(false);
  const [treeViewEditorOpen, setTreeViewEditorOpen] = useState(false);

  useEffect(() => {
    setListViewEditorKind(null);
    setHeaderColumnsEditorOpen(false);
    setToolbarButtonsEditorOpen(false);
    setStatusBarPartsEditorOpen(false);
    setTabPagesEditorOpen(false);
    setMenuBarItemsEditorOpen(false);
    setTreeViewEditorOpen(false);
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
  const listViewColumns = control.type === 'ListView'
    ? normalizeListViewColumns(control.properties?.columns)
    : [];
  const listViewRows = control.type === 'ListView'
    ? normalizeListViewRows(control.properties?.items)
    : [];
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
  const tabPageCount = control.type === 'TabControl'
    ? normalizeTabControlPages(control.properties?.tabs).length
    : 0;
  const updateControlProperty = (key: string, value: Win32ControlPropertyValue) => {
    const properties = { ...(control.properties || {}), [key]: value };
    const content = key === 'value' && control.type === 'ProgressBar' ? String(value) : control.content;
    onChange({ properties, content });
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

  return (
    <div className="space-y-2">
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
          onChange={value => onChange({ background: value })}
        />
      </PropertyGroup>

      {controlDefinition && controlDefinition.properties.length > 0 && (
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
      {control.type === 'TabControl' && tabPagesEditorOpen && (
        <TabControlPagesDialog
          controlName={control.name}
          value={control.properties?.tabs}
          hasImageList={Boolean(control.properties?.imageListId)}
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
  windowModel,
  isDarkMode,
  onChange
}: {
  control: LingControl | null;
  windowModel: LingWindowModel;
  isDarkMode: boolean;
  onChange: (fields: Partial<LingControl>) => void;
}) {
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

  const openEventCode = (eventName: string) => {
    const handlerName = control.events?.[eventName]?.trim() || getEplEventHandlerName(control.name, eventName);
    onChange({
      events: {
        ...(control.events || {}),
        [eventName]: handlerName
      }
    });

    const detail: OpenControlEventCodeDetail = {
      controlId: control.id,
      controlName: control.name,
      controlContent: control.content,
      controlType: control.type,
      eventName,
      handlerName,
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
      {getEventsForType(control.type).map(eventInfo => {
        const currentHandler = control.events?.[eventInfo.name] || '';
        const suggestedHandler = getEplEventHandlerName(control.name, eventInfo.name);
        const isBound = Boolean(currentHandler.trim());
        const handlerName = currentHandler.trim() || suggestedHandler;
        return (
          <button
            key={eventInfo.name}
            type="button"
            onClick={() => openEventCode(eventInfo.name)}
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
              }`}>{isBound ? '打开代码' : '生成并打开'}</span>
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

function ControlPropertyField({
  definition,
  controlType,
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
        <select value={String(value ?? '')} onChange={event => onChange(event.target.value)} className={`w-full rounded border px-2 py-0.5 text-xs ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`}>
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
        swatches={['#0F172A', '#1E293B', '#334155', '#7C3AED', '#6366F1', '#0891B2', '#38BDF8', '#E2E8F0']}
        onChange={onChange}
      />
    );
  }
  if (definition.type === 'controlRef') {
    return (
      <PropertyRow label={definition.label} isDarkMode={isDarkMode}>
        <select value={String(value ?? '')} onChange={event => onChange(event.target.value)} className={`w-full rounded border px-2 py-0.5 text-xs ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`}>
          <option value="">未绑定</option>
          {controls.map(control => <option key={control.id} value={control.id}>{control.name}</option>)}
        </select>
      </PropertyRow>
    );
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
      className={`flex items-center gap-1 p-1.5 rounded cursor-pointer text-[10px] transition-all ${
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
