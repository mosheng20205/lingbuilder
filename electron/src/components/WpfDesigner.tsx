import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckSquare,
  CircleDot,
  Copy,
  FileCode,
  FileText,
  HelpCircle,
  Keyboard,
  Layers,
  LayoutGrid,
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
  Wrench,
  X,
  Zap,
  Menu
} from 'lucide-react';
import ModuleInspector from './ModuleInspector';
import { DesignerGeneratedPanelData } from '../types';
import {
  createBlankWindow,
  createControl,
  createDefaultWindowProject,
  getEplEventHandlerName,
  generateProjectManifest,
  generateWindowCpp,
  generateWindowXml,
  getEventsForType,
  getPrimaryEventNameForType
} from '../services/windowDesigner/windowDesignerService';
import {
  notifyWindowDesignerBuildRunState,
  requestWindowDesignerBuildRun,
  requestWindowDesignerEplSource,
  WINDOW_DESIGNER_BUILD_RUN_REQUEST
} from '../services/windowDesigner/windowDesignerCommands';
import { LingControl, LingControlType, LingWindowModel, LingWindowProject } from '../services/windowDesigner/types';

type InspectorTab = 'properties' | 'events' | 'modules';
type ResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface OpenControlEventCodeDetail {
  controlId: string;
  controlName: string;
  controlContent: string;
  controlType: LingControlType;
  eventName: string;
  handlerName: string;
  windowFileName: string;
  windowTitle: string;
}

interface WpfDesignerProps {
  isDarkMode: boolean;
  activeFile?: any;
}

const CONTROL_TYPES: (LingControlType | 'MenuBar')[] = [
  'Button',
  'TextBox',
  'Label',
  'CheckBox',
  'RadioButton',
  'ProgressBar',
  'ComboBox',
  'Image',
  'MenuBar'
] as any;

const CONTROL_LABELS: Record<LingControlType | 'MenuBar', string> = {
  Button: '按钮',
  TextBox: '文本框',
  Label: '标签',
  CheckBox: '复选框',
  RadioButton: '单选框',
  Image: '图片',
  ProgressBar: '进度条',
  ComboBox: '下拉框',
  Grid: '网格',
  MenuBar: '窗口菜单栏'
} as any;

const TYPE_ICONS: Record<LingControlType | 'MenuBar', React.ReactNode> = {
  Button: <SquareDot className="w-3.5 h-3.5 text-blue-400" />,
  TextBox: <Keyboard className="w-3.5 h-3.5 text-teal-400" />,
  Label: <Type className="w-3.5 h-3.5 text-cyan-400" />,
  CheckBox: <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />,
  RadioButton: <CircleDot className="w-3.5 h-3.5 text-purple-400" />,
  Image: <Palette className="w-3.5 h-3.5 text-pink-400" />,
  ProgressBar: <Minus className="w-3.5 h-3.5 text-emerald-400" />,
  ComboBox: <List className="w-3.5 h-3.5 text-violet-400" />,
  Grid: <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />,
  MenuBar: <Menu className="w-3.5 h-3.5 text-amber-400" />
} as any;

const TITLE_BAR_HEIGHT = 52;
const DESIGNER_AUTOSAVE_KEY = 'lingbuilder.windowDesigner.autosave.v1';

interface PersistedDesignerState {
  project: LingWindowProject;
  activeWindowId: string;
  selectedControlId: string | null;
}

let cachedInitialDesignerState: PersistedDesignerState | null = null;

function getInitialDesignerState(): PersistedDesignerState {
  if (cachedInitialDesignerState) {
    return cachedInitialDesignerState;
  }

  const fallbackProject = createDefaultWindowProject();
  const fallbackState: PersistedDesignerState = {
    project: fallbackProject,
    activeWindowId: 'main-window',
    selectedControlId: 'btn_launch'
  };

  try {
    const rawState = window.localStorage.getItem(DESIGNER_AUTOSAVE_KEY);
    if (!rawState) {
      cachedInitialDesignerState = fallbackState;
      return fallbackState;
    }

    const parsedState = JSON.parse(rawState) as Partial<PersistedDesignerState>;
    if (!parsedState.project || !Array.isArray(parsedState.project.windows) || parsedState.project.windows.length === 0) {
      cachedInitialDesignerState = fallbackState;
      return fallbackState;
    }

    const activeWindowId = parsedState.project.windows.some(window => window.id === parsedState.activeWindowId)
      ? parsedState.activeWindowId!
      : parsedState.project.windows[0].id;
    const activeWindow = parsedState.project.windows.find(window => window.id === activeWindowId) || parsedState.project.windows[0];
    const selectedControlId = activeWindow.controls.some(control => control.id === parsedState.selectedControlId)
      ? parsedState.selectedControlId!
      : activeWindow.controls[0]?.id || null;

    cachedInitialDesignerState = {
      project: parsedState.project,
      activeWindowId,
      selectedControlId
    };
    return cachedInitialDesignerState;
  } catch {
    cachedInitialDesignerState = fallbackState;
    return fallbackState;
  }
}

export default function WpfDesigner({ isDarkMode, activeFile }: WpfDesignerProps) {
  const initialDesignerState = getInitialDesignerState();
  const [project, setProject] = useState<LingWindowProject>(() => initialDesignerState.project);
  const [activeWindowId, setActiveWindowId] = useState(initialDesignerState.activeWindowId);

  useEffect(() => {
    if (activeFile && activeFile.name) {
      const xmlName = activeFile.name.replace(/\.e$/i, '.xml');
      const foundWindow = project.windows.find(w => w.fileName.toLowerCase() === xmlName.toLowerCase());
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
          detail: { fileName: currentWin.fileName }
        }));
      }
    }
  }, [activeWindowId]);
  const [selectedControlId, setSelectedControlId] = useState<string | null>(initialDesignerState.selectedControlId);
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>('properties');
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);
  const [nativeBuildLogs, setNativeBuildLogs] = useState<string[]>([
    '> [编译日志] 等待 F5 或“生成并运行”触发真实 Win32 构建。'
  ]);
  const [isNativeBuilding, setIsNativeBuilding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>('se');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });
  const [initialControlPos, setInitialControlPos] = useState({ x: 0, y: 0 });
  const [inspectorWidth, setInspectorWidth] = useState(300);

  const canvasRef = useRef<HTMLDivElement>(null);

  const activeWindow = useMemo(() => {
    return project.windows.find(window => window.id === activeWindowId) || project.windows[0];
  }, [activeWindowId, project.windows]);

  const selectedControl = useMemo(() => {
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
        fontSize: 11,
        background: '#ffffff',
        foreground: '#000000',
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

  const xmlCode = activeWindow ? generateWindowXml(activeWindow) : '';
  const cppCode = activeWindow ? generateWindowCpp(activeWindow) : '';
  const manifestCode = generateProjectManifest(project);

  useEffect(() => {
    if (!activeWindow) return;

    const detail: DesignerGeneratedPanelData = {
      xmlLabel: activeWindow.fileName,
      cppLabel: `${activeWindow.className}.h`,
      manifestLabel: '窗口程序集',
      xmlCode,
      cppCode,
      manifestCode,
      logs: nativeBuildLogs,
      isBuilding: isNativeBuilding
    };

    window.dispatchEvent(new CustomEvent<DesignerGeneratedPanelData>('window-designer-generated-panels', { detail }));
  }, [
    activeWindow,
    cppCode,
    isNativeBuilding,
    manifestCode,
    nativeBuildLogs,
    xmlCode
  ]);

  const addLog = useCallback((message: string) => {
    setNativeBuildLogs(prev => [...prev, message]);
    window.dispatchEvent(new CustomEvent('add-app-log', { detail: { message } }));
  }, []);

  useEffect(() => {
    try {
      const nextState: PersistedDesignerState = {
        project,
        activeWindowId,
        selectedControlId
      };
      cachedInitialDesignerState = nextState;
      window.localStorage.setItem(DESIGNER_AUTOSAVE_KEY, JSON.stringify(nextState));
    } catch {
      // Autosave is best-effort in the prototype; editing should keep working if storage is unavailable.
    }
  }, [activeWindowId, project, selectedControlId]);

  const updateActiveWindow = (updater: (window: LingWindowModel) => LingWindowModel) => {
    setProject(prev => ({
      ...prev,
      windows: prev.windows.map(window => (window.id === activeWindowId ? updater(window) : window))
    }));
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
      const deltaX = mouseMoveEvent.clientX - startX;
      const deltaY = mouseMoveEvent.clientY - startY;

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
      controls: window.controls.map(control => {
        if (control.id !== selectedControlId) return control;
        return { ...control, ...updatedFields };
      })
    }));
  };

  const handleSelectWindow = (windowId: string) => {
    const nextWindow = project.windows.find(window => window.id === windowId);
    if (!nextWindow) return;
    setActiveWindowId(windowId);
    setSelectedControlId(nextWindow.controls[0]?.id || null);
  };

  const handleCanvasDoubleClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    const isBackground = target === canvasRef.current;
    const isTitleBar = target.closest('.canvas-title-bar');
    
    if (isBackground || isTitleBar) {
      const handlerName = `_${activeWindow.className}_创建完毕`;
      const detail = {
        controlId: activeWindow.id,
        controlName: activeWindow.className,
        controlContent: activeWindow.title,
        controlType: 'Grid',
        eventName: 'Loaded',
        handlerName,
        windowFileName: activeWindow.fileName,
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
    window.dispatchEvent(new CustomEvent('window-deleted', { detail: deletedWindow }));
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

  const handleAddControl = (type: LingControlType | 'MenuBar') => {
    if (!activeWindow) return;
    if (type === 'MenuBar') {
      updateActiveWindow(window => ({
        ...window,
        menuName: window.menuName || '窗口菜单栏',
        menuItems: window.menuItems || '关于太空冒险客户端, 太空冒险安全账户登录, 关于太空冒险客户端',
        menuEvents: window.menuEvents || {
          'Select': `_${window.className}_窗口菜单被选择`
        }
      }));
      setSelectedControlId('__window_menu_bar__');
      setActiveInspectorTab('properties');
      addLog(`> [${new Date().toLocaleTimeString()}] 【可视化设计】已在 ${activeWindow.fileName} 启用并选中窗口菜单栏。`);
      return;
    }
    const typeIndex = activeWindow.controls.filter(control => control.type === type).length + 1;
    const newControl = createControl(type, typeIndex);
    updateActiveWindow(window => ({
      ...window,
      controls: [...window.controls, newControl]
    }));
    setSelectedControlId(newControl.id);
    setActiveInspectorTab('properties');
    addLog(`> [${new Date().toLocaleTimeString()}] 【可视化设计】已在 ${activeWindow.fileName} 添加控件：${CONTROL_LABELS[type]}。`);
  };

  const handleDeleteControl = () => {
    if (!selectedControlId) return;
    updateActiveWindow(window => ({
      ...window,
      controls: window.controls.filter(control => control.id !== selectedControlId)
    }));
    setSelectedControlId(null);
  };

  const handleMouseDown = (event: React.MouseEvent, control: LingControl, action: 'drag' | ResizeDirection) => {
    event.stopPropagation();
    event.preventDefault();
    setSelectedControlId(control.id);

    if (action === 'drag') {
      setIsDragging(true);
      setDragOffset({
        x: event.clientX - control.x,
        y: event.clientY - control.y
      });
      return;
    }

    setIsResizing(true);
    setResizeDirection(action);
    setInitialSize({ width: control.width, height: control.height });
    setInitialPos({ x: event.clientX, y: event.clientY });
    setInitialControlPos({ x: control.x, y: control.y });
  };

  const handleControlDoubleClick = (event: React.MouseEvent, control: LingControl) => {
    event.preventDefault();
    event.stopPropagation();

    if (!activeWindow) return;

    const eventName = getPrimaryEventNameForType(control.type);
    const handlerName = control.id === '__window_menu_bar__'
      ? (activeWindow.menuEvents?.['Select'] || `_${activeWindow.className}_窗口菜单被选择`)
      : getEplEventHandlerName(control.name, eventName);

    setSelectedControlId(control.id);
    setActiveInspectorTab('events');
    
    if (control.id === '__window_menu_bar__') {
      updateActiveWindow(window => ({
        ...window,
        menuEvents: {
          ...(window.menuEvents || {}),
          [eventName]: handlerName
        }
      }));
    } else if (control.id.startsWith('__window_menu_item_')) {
      const idxStr = control.id.replace('__window_menu_item_', '').replace('__', '');
      const idx = parseInt(idxStr, 10);
      const eventKey = `Item_${idx}`;
      updateActiveWindow(window => ({
        ...window,
        menuEvents: {
          ...(window.menuEvents || {}),
          [eventKey]: handlerName
        }
      }));
    } else {
      updateActiveWindow(window => ({
        ...window,
        controls: window.controls.map(item => {
          if (item.id !== control.id) return item;
          return {
            ...item,
            events: {
              ...(item.events || {}),
              [eventName]: handlerName
            }
          };
        })
      }));
    }

    const detail: OpenControlEventCodeDetail = {
      controlId: control.id,
      controlName: control.name,
      controlContent: control.content,
      controlType: control.type,
      eventName,
      handlerName,
      windowFileName: activeWindow.fileName,
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
    };
    window.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!activeWindow || !selectedControlId || !selectedControl) return;

      if (isDragging) {
        const maxX = Math.max(0, activeWindow.width - selectedControl.width);
        const maxY = Math.max(0, activeWindow.height - TITLE_BAR_HEIGHT - selectedControl.height);
        const nextX = Math.max(0, Math.min(maxX, event.clientX - dragOffset.x));
        const nextY = Math.max(0, Math.min(maxY, event.clientY - dragOffset.y));

        updateSelectedControl({
          x: Math.round(nextX / 5) * 5,
          y: Math.round(nextY / 5) * 5
        });
      }

      if (isResizing) {
        const deltaX = event.clientX - initialPos.x;
        const deltaY = event.clientY - initialPos.y;
        const minWidth = 20;
        const minHeight = 15;
        const maxCanvasX = activeWindow.width;
        const maxCanvasY = activeWindow.height - TITLE_BAR_HEIGHT;
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
    dragOffset,
    initialPos,
    initialControlPos,
    initialSize,
    isDragging,
    isResizing,
    resizeDirection,
    selectedControl,
    selectedControlId
  ]);

  const handleBuildAndRunNative = useCallback(async () => {
    if (isNativeBuilding) {
      addLog(`> [${new Date().toLocaleTimeString()}] 【窗口运行】已有生成运行任务正在执行。`);
      return;
    }

    setNativeBuildLogs([]);
    setIsNativeBuilding(true);
    notifyWindowDesignerBuildRunState({
      status: 'started',
      message: '窗口设计器正在生成、编译并运行 Win32 预览窗口'
    });
    addLog(`> [${new Date().toLocaleTimeString()}] 【窗口运行】开始导出当前窗口程序集并生成 Win32 C++ 工程...`);

    try {
      const eplSourceCode = requestWindowDesignerEplSource(activeWindowId, activeWindow?.fileName);
      const response = await fetch('/api/window-designer/build-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project,
          activeWindowId,
          eplSourceCode,
          run: true
        })
      });

      const result = await response.json();
      const logs: string[] = Array.isArray(result.logs) ? result.logs : [];

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
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <p className={`text-[10px] px-1 leading-relaxed ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
              点击控件即可添加到当前窗口，随后可在画布中拖拽、改尺寸、绑定中文事件。
            </p>
            <div className="grid grid-cols-1 gap-1">
              {CONTROL_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => handleAddControl(type)}
                  className={`flex items-center gap-2 px-2.5 py-2 text-left text-xs rounded border cursor-pointer transition-all ${
                    isDarkMode
                      ? 'text-slate-300 hover:text-white border-transparent hover:border-[#3c3c44] hover:bg-[#25252b]/80'
                      : 'text-slate-700 hover:text-slate-900 border-slate-200 bg-white hover:bg-slate-100 shadow-sm'
                  }`}
                >
                  {TYPE_ICONS[type]}
                  <span>{CONTROL_LABELS[type]} ({type})</span>
                </button>
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
          </div>
        </div>

        <div className={`flex-1 p-6 flex flex-col overflow-auto items-center justify-start relative select-none ${
          isDarkMode ? 'bg-[#101014]' : 'bg-slate-100/50'
        }`}>
          <div className="text-[10px] text-slate-500 font-mono mb-2 uppercase select-none w-full flex justify-center">
            <div className="flex justify-between w-full" style={{ maxWidth: `${Math.max(560, activeWindow.width)}px` }}>
              <span>[{activeWindow.fileName} / {activeWindow.width} x {activeWindow.height}]</span>
              <span>拖拽控件移动，拖动八向控制点调整尺寸</span>
            </div>
          </div>

          <div
            ref={canvasRef}
            id="wpf-design-canvas"
            onDoubleClick={handleCanvasDoubleClick}
            className="relative rounded-lg shadow-2xl border-2 border-slate-700/60 overflow-hidden shrink-0 select-none"
            style={{
              width: `${activeWindow.width}px`,
              height: `${activeWindow.height}px`,
              backgroundColor: activeWindow.background,
              backgroundImage: isDarkMode
                ? 'radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.34) 0.85px, transparent 0.95px)'
                : 'radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.24) 0.85px, transparent 0.95px)',
              backgroundSize: '12px 12px',
              backgroundPosition: '0 0'
            }}
            onClick={() => setSelectedControlId(null)}
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
            <div className="h-7 bg-[#2D2D30] flex items-center justify-between px-3 text-slate-400 border-b border-slate-800 select-none canvas-title-bar">
              <div className="flex items-center gap-1.5 text-[11px] font-sans font-medium text-slate-300 min-w-0">
                <Monitor className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{activeWindow.title}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-500">
                <Minus className="w-3 h-3" />
                <Maximize2 className="w-3 h-3" />
                <X className="w-3 h-3" />
              </div>
            </div>
            {/* Menu Bar (Simulating native Win32 window menu bar) */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setSelectedControlId('__window_menu_bar__');
                setIsMenuDropdownOpen(prev => !prev);
              }}
              className={`h-6 px-3 flex items-center border-b select-none text-[10.5px] font-sans cursor-pointer transition-colors ${
                isDarkMode 
                  ? 'bg-[#1E1E1E] text-slate-300 border-slate-800/80 hover:bg-slate-800/60' 
                  : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
              } ${selectedControlId === '__window_menu_bar__' ? 'ring-1 ring-amber-500 z-50 relative' : ''}`}
            >
              <div className="relative">
                <span className={`px-2 py-0.5 rounded transition-colors ${
                  isDarkMode ? 'hover:bg-slate-700/50 text-slate-300' : 'hover:bg-slate-200 text-slate-850'
                }`}>
                  窗口(W)
                </span>
                {/* Dropdown Menu listing all window menu items */}
                {isMenuDropdownOpen && (
                  <div className={`absolute left-0 top-5 w-48 flex flex-col py-1 border rounded shadow-lg z-[99] ${
                    isDarkMode 
                      ? 'bg-[#252526] border-[#3c3c3c] text-slate-200' 
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    {(activeWindow.menuItems || '关于太空冒险客户端, 太空冒险安全账户登录, 关联设计文件')
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean)
                      .map((item, idx) => {
                        const isItemSelected = selectedControlId === `__window_menu_item_${idx}__`;
                        return (
                          <div
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedControlId(`__window_menu_item_${idx}__`);
                            }}
                            onDoubleClick={(e) => {
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
            </div>

            {activeWindow.controls.map(control => renderControl(
              control,
              control.id === selectedControlId,
              handleMouseDown,
              setSelectedControlId,
              handleControlDoubleClick
            ))}
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
              <span>属性与事件</span>
            </span>
            <div className={`flex p-0.5 rounded border ${isDarkMode ? 'bg-[#2a2a34] border-[#3e3e4a]' : 'bg-slate-200 border-slate-300'}`}>
              <IconTabButton active={activeInspectorTab === 'properties'} isDarkMode={isDarkMode} onClick={() => setActiveInspectorTab('properties')} title="属性">
                <Wrench className="w-3.5 h-3.5" />
              </IconTabButton>
              <IconTabButton active={activeInspectorTab === 'events'} isDarkMode={isDarkMode} onClick={() => setActiveInspectorTab('events')} title="事件">
                <Zap className="w-3.5 h-3.5" />
              </IconTabButton>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {activeInspectorTab === 'properties' && (
              <>
                <WindowProperties
                  window={activeWindow}
                  isDarkMode={isDarkMode}
                  onChange={fields => updateActiveWindow(window => ({ ...window, ...fields }))}
                />
                <ControlProperties
                  control={selectedControl}
                  isDarkMode={isDarkMode}
                  onChange={updateSelectedControl}
                  onDelete={handleDeleteControl}
                />
              </>
            )}

            {activeInspectorTab === 'events' && (
              <ControlEvents control={selectedControl} isDarkMode={isDarkMode} onChange={updateSelectedControl} />
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

function renderControl(
  control: LingControl,
  isSelected: boolean,
  handleMouseDown: (event: React.MouseEvent, control: LingControl, action: 'drag' | ResizeDirection) => void,
  setSelectedControlId: (id: string) => void,
  onOpenEventCode: (event: React.MouseEvent, control: LingControl) => void
) {
  const isCollapsed = control.visibility === 'Collapsed';
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
      onMouseDown={event => handleMouseDown(event, control, 'drag')}
      title={`双击打开事件代码：${getEplEventHandlerName(control.name, getPrimaryEventNameForType(control.type))}`}
      className={`absolute group cursor-move select-none ${
        isSelected ? 'ring-1 ring-amber-500 z-40' : 'hover:ring-1 hover:ring-slate-500 z-20'
      } ${isCollapsed ? 'opacity-30 border border-dashed border-red-500' : ''}`}
      style={{
        left: `${control.x}px`,
        top: `${control.y + TITLE_BAR_HEIGHT}px`,
        width: `${control.width}px`,
        height: `${control.height}px`
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

      <div className="w-full h-full relative select-none pointer-events-none">
        {control.type === 'Button' && (
          <button
            disabled={!control.isEnabled}
            className="w-full h-full rounded text-center text-xs font-semibold shadow flex items-center justify-center px-2 select-none"
            style={{ backgroundColor: control.background, color: control.foreground, fontSize: `${control.fontSize}px`, opacity: control.isEnabled ? 1 : 0.5 }}
          >
            {control.content}
          </button>
        )}

        {control.type === 'TextBox' && (
          <div
            className="w-full h-full rounded border border-slate-700 px-2 flex items-center justify-start text-xs select-none"
            style={{ backgroundColor: control.background, color: control.foreground, fontSize: `${control.fontSize}px`, opacity: control.isEnabled ? 1 : 0.5 }}
          >
            {control.content}
          </div>
        )}

        {control.type === 'Label' && (
          <div
            className="w-full h-full flex items-center justify-start text-xs leading-normal select-none overflow-hidden"
            style={{ color: control.foreground, fontSize: `${control.fontSize}px`, backgroundColor: control.background, fontWeight: control.fontSize > 14 ? 'bold' : 'normal' }}
          >
            {control.content}
          </div>
        )}

        {control.type === 'CheckBox' && (
          <div
            className="w-full h-full flex items-center gap-2 text-xs select-none"
            style={{ color: control.foreground, fontSize: `${control.fontSize}px`, backgroundColor: control.background === 'transparent' ? 'transparent' : control.background }}
          >
            <div className="w-3.5 h-3.5 border border-slate-500 rounded bg-slate-900 flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5 text-emerald-400" />
            </div>
            <span className="truncate">{control.content}</span>
          </div>
        )}

        {control.type === 'RadioButton' && (
          <div
            className="w-full h-full flex items-center gap-2 text-xs select-none"
            style={{ color: control.foreground, fontSize: `${control.fontSize}px`, backgroundColor: control.background === 'transparent' ? 'transparent' : control.background }}
          >
            <div className="w-3.5 h-3.5 border border-slate-500 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
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
                backgroundColor: control.foreground
              }}
            />
            <span className="z-10 font-mono text-[9px] text-white select-none">{control.content}%</span>
          </div>
        )}

        {control.type === 'ComboBox' && (
          <div
            className="w-full h-full rounded border border-slate-700 px-2 flex items-center justify-between text-xs select-none"
            style={{ backgroundColor: control.background === 'transparent' ? '#1E1E24' : control.background }}
          >
            <span style={{ color: control.foreground, fontSize: `${control.fontSize}px` }} className="truncate">
              {control.content}
            </span>
            <span className="text-[9px] text-slate-500">v</span>
          </div>
        )}

        {control.type === 'Image' && (
          <div className="w-full h-full bg-indigo-950/20 border border-indigo-500/20 rounded flex items-center justify-center overflow-hidden relative">
            <div className="absolute inset-0 opacity-10 bg-gradient-to-tr from-cyan-500 to-indigo-500" />
            <span className="text-[10px] text-indigo-400 font-bold z-10 font-sans truncate">{control.content}</span>
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
  window,
  isDarkMode,
  onChange
}: {
  window: LingWindowModel;
  isDarkMode: boolean;
  onChange: (fields: Partial<LingWindowModel>) => void;
}) {
  return (
    <div className="space-y-2">
      <PropertyGroup title="当前窗口 / 布局" isDarkMode={isDarkMode}>
        <NumberField label="宽度" value={window.width} min={360} isDarkMode={isDarkMode} onChange={value => onChange({ width: value })} />
        <NumberField label="高度" value={window.height} min={240} isDarkMode={isDarkMode} onChange={value => onChange({ height: value })} />
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
      </PropertyGroup>
      <PropertyGroup title="当前窗口 / 状态" isDarkMode={isDarkMode} defaultOpen={false}>
        <TextField label="类名" value={window.className} isDarkMode={isDarkMode} onChange={value => onChange({ className: value })} />
        <TextField label="文件名" value={window.fileName} isDarkMode={isDarkMode} onChange={value => onChange({ fileName: value })} />
      </PropertyGroup>
    </div>
  );
}

function ControlProperties({
  control,
  isDarkMode,
  onChange,
  onDelete
}: {
  control: LingControl | null;
  isDarkMode: boolean;
  onChange: (fields: Partial<LingControl>) => void;
  onDelete: () => void;
}) {
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

  return (
    <div className="space-y-2">
      <PropertyGroup title="控件 / 布局" isDarkMode={isDarkMode}>
        <NumberField label="左距" value={control.x} min={0} isDarkMode={isDarkMode} onChange={value => onChange({ x: value })} />
        <NumberField label="顶距" value={control.y} min={0} isDarkMode={isDarkMode} onChange={value => onChange({ y: value })} />
        <NumberField label="宽度" value={control.width} min={20} isDarkMode={isDarkMode} onChange={value => onChange({ width: value })} />
        <NumberField label="高度" value={control.height} min={15} isDarkMode={isDarkMode} onChange={value => onChange({ height: value })} />
      </PropertyGroup>

      <PropertyGroup title="控件 / 外观" isDarkMode={isDarkMode}>
        <PropertyRow label="控件类型" isDarkMode={isDarkMode}>
          <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-500">
            {CONTROL_LABELS[control.type]}
          </span>
        </PropertyRow>
        <TextField label="中文名称" value={control.name} isDarkMode={isDarkMode} onChange={handleNameChange} />
        {control.type !== 'Grid' && (
          <TextField label={control.type === 'ProgressBar' ? '进度值' : '显示内容'} value={control.content} isDarkMode={isDarkMode} onChange={value => onChange({ content: value })} />
        )}
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
        {control.type !== 'MenuBar' as any && control.type !== 'MenuItem' as any && (
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
    </div>
  );
}

function ControlEvents({
  control,
  isDarkMode,
  onChange
}: {
  control: LingControl | null;
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

  return (
    <div className="space-y-3">
      <div className={`text-[11px] border-b pb-1.5 flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400 border-slate-800' : 'text-slate-600 border-slate-200'}`}>
        <Zap className="w-3.5 h-3.5 text-amber-500" />
        <span className="font-semibold">事件绑定：{control.name}</span>
      </div>
      {getEventsForType(control.type).map(eventInfo => {
        const currentHandler = control.events?.[eventInfo.name] || '';
        const suggestedHandler = getEplEventHandlerName(control.name, eventInfo.name);
        return (
          <div key={eventInfo.name} className={`space-y-1.5 p-2 rounded border ${
            isDarkMode ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{eventInfo.label}</span>
              <span className="text-[8px] px-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded font-mono font-bold">Event</span>
            </div>
            <span className="text-[9.5px] text-slate-500 block leading-tight">{eventInfo.desc}</span>
            <input
              type="text"
              placeholder={`如: ${suggestedHandler}`}
              value={currentHandler}
              onChange={event => {
                onChange({
                  events: {
                    ...(control.events || {}),
                    [eventInfo.name]: event.target.value
                  }
                });
              }}
              className={`w-full border rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-amber-500 ${
                isDarkMode ? 'bg-[#1b1b20] border-[#2d2d34] text-slate-300' : 'bg-white border-slate-300 text-slate-800'
              }`}
            />
          </div>
        );
      })}
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

function NumberField({
  label,
  value,
  min,
  isDarkMode,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  isDarkMode: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <PropertyRow label={label} isDarkMode={isDarkMode}>
      <input
        type="number"
        value={value}
        onChange={event => onChange(Math.max(min, parseInt(event.target.value, 10) || min))}
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
      className={`p-1.5 rounded cursor-pointer transition-all ${
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
