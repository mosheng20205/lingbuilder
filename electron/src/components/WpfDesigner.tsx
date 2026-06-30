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
  Zap
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
}

const CONTROL_TYPES: LingControlType[] = [
  'Button',
  'TextBox',
  'Label',
  'CheckBox',
  'RadioButton',
  'ProgressBar',
  'ComboBox',
  'Image'
];

const CONTROL_LABELS: Record<LingControlType, string> = {
  Button: '按钮',
  TextBox: '文本框',
  Label: '标签',
  CheckBox: '复选框',
  RadioButton: '单选框',
  Image: '图片',
  ProgressBar: '进度条',
  ComboBox: '下拉框',
  Grid: '网格'
};

const TYPE_ICONS: Record<LingControlType, React.ReactNode> = {
  Button: <SquareDot className="w-3.5 h-3.5 text-blue-400" />,
  TextBox: <Keyboard className="w-3.5 h-3.5 text-teal-400" />,
  Label: <Type className="w-3.5 h-3.5 text-cyan-400" />,
  CheckBox: <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />,
  RadioButton: <CircleDot className="w-3.5 h-3.5 text-purple-400" />,
  Image: <Palette className="w-3.5 h-3.5 text-pink-400" />,
  ProgressBar: <Minus className="w-3.5 h-3.5 text-emerald-400" />,
  ComboBox: <List className="w-3.5 h-3.5 text-violet-400" />,
  Grid: <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
};

const TITLE_BAR_HEIGHT = 28;
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

export default function WpfDesigner({ isDarkMode }: WpfDesignerProps) {
  const initialDesignerState = getInitialDesignerState();
  const [project, setProject] = useState<LingWindowProject>(() => initialDesignerState.project);
  const [activeWindowId, setActiveWindowId] = useState(initialDesignerState.activeWindowId);
  const [selectedControlId, setSelectedControlId] = useState<string | null>(initialDesignerState.selectedControlId);
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>('properties');
  const [nativeBuildLogs, setNativeBuildLogs] = useState<string[]>([
    '> [编译日志] 等待 F5 或“生成并运行”触发真实 Win32 构建。'
  ]);
  const [isNativeBuilding, setIsNativeBuilding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  const activeWindow = useMemo(() => {
    return project.windows.find(window => window.id === activeWindowId) || project.windows[0];
  }, [activeWindowId, project.windows]);

  const selectedControl = useMemo(() => {
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

  const updateSelectedControl = (updatedFields: Partial<LingControl>) => {
    if (!selectedControlId) return;
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

  const handleAddWindow = () => {
    const nextWindow = createBlankWindow(project.windows.length + 1);
    setProject(prev => ({
      ...prev,
      windows: [...prev.windows, nextWindow]
    }));
    setActiveWindowId(nextWindow.id);
    setSelectedControlId(nextWindow.controls[0]?.id || null);
    addLog(`> [${new Date().toLocaleTimeString()}] 【窗体设计】已创建新窗口：${nextWindow.fileName}，可继续拖拽控件并绑定中文事件。`);
  };

  const handleDeleteWindow = () => {
    if (project.windows.length <= 1) {
      addLog(`> [${new Date().toLocaleTimeString()}] 【窗体设计】至少需要保留一个窗口，未执行删除。`);
      return;
    }

    const currentIndex = project.windows.findIndex(window => window.id === activeWindowId);
    const nextWindows = project.windows.filter(window => window.id !== activeWindowId);
    const nextWindow = nextWindows[Math.max(0, currentIndex - 1)] || nextWindows[0];

    setProject(prev => ({
      ...prev,
      windows: nextWindows
    }));
    setActiveWindowId(nextWindow.id);
    setSelectedControlId(nextWindow.controls[0]?.id || null);
    addLog(`> [${new Date().toLocaleTimeString()}] 【窗体设计】已从窗口程序集中移除当前窗口。`);
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
  };

  const handleAddControl = (type: LingControlType) => {
    if (!activeWindow) return;
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

  const handleMouseDown = (event: React.MouseEvent, control: LingControl, action: 'drag' | 'resize') => {
    event.stopPropagation();
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
    setInitialSize({ width: control.width, height: control.height });
    setInitialPos({ x: event.clientX, y: event.clientY });
  };

  const handleControlDoubleClick = (event: React.MouseEvent, control: LingControl) => {
    event.preventDefault();
    event.stopPropagation();

    if (!activeWindow) return;

    const eventName = getPrimaryEventNameForType(control.type);
    const handlerName = getEplEventHandlerName(control.name, eventName);

    setSelectedControlId(control.id);
    setActiveInspectorTab('events');
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
        const nextWidth = Math.max(20, Math.min(activeWindow.width - selectedControl.x, initialSize.width + deltaX));
        const nextHeight = Math.max(15, Math.min(activeWindow.height - TITLE_BAR_HEIGHT - selectedControl.y, initialSize.height + deltaY));

        updateSelectedControl({
          width: Math.round(nextWidth / 5) * 5,
          height: Math.round(nextHeight / 5) * 5
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
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
    initialSize,
    isDragging,
    isResizing,
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
      const eplSourceCode = requestWindowDesignerEplSource();
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
              <span>拖拽控件移动，拖动右下角调整尺寸</span>
            </div>
          </div>

          <div
            ref={canvasRef}
            id="wpf-design-canvas"
            className="relative rounded-lg shadow-2xl border-2 border-slate-700/60 overflow-hidden shrink-0 select-none"
            style={{
              width: `${activeWindow.width}px`,
              height: `${activeWindow.height}px`,
              backgroundColor: activeWindow.background,
              backgroundImage: `
                radial-gradient(circle, #33333e 1px, transparent 1px),
                radial-gradient(circle, #33333e 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 10px 10px'
            }}
            onClick={() => setSelectedControlId(null)}
          >
            <div className="h-7 bg-[#2D2D30] flex items-center justify-between px-3 text-slate-400 border-b border-slate-800 select-none">
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
          className={`w-72 flex flex-col shrink-0 select-none border-l ${
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
              <IconTabButton active={activeInspectorTab === 'modules'} isDarkMode={isDarkMode} onClick={() => setActiveInspectorTab('modules')} title="模块">
                <Layers className="w-3.5 h-3.5" />
              </IconTabButton>
            </div>
          </div>

          {activeInspectorTab === 'modules' ? (
            <ModuleInspector isDarkMode={isDarkMode} onAddLog={addLog} />
          ) : (
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
          )}
        </div>
      </div>

    </div>
  );
}

function renderControl(
  control: LingControl,
  isSelected: boolean,
  handleMouseDown: (event: React.MouseEvent, control: LingControl, action: 'drag' | 'resize') => void,
  setSelectedControlId: (id: string) => void,
  onOpenEventCode: (event: React.MouseEvent, control: LingControl) => void
) {
  const isCollapsed = control.visibility === 'Collapsed';

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
        <div
          onMouseDown={event => handleMouseDown(event, control, 'resize')}
          className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-amber-500 border border-slate-900 rounded-sm cursor-se-resize z-50 shadow"
          title="拖动调整大小"
        />
      )}
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
    <div className={`space-y-2 p-2 rounded border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className="text-[10px] text-slate-500 font-bold uppercase">当前窗口</div>
      <TextField label="窗口标题" value={window.title} isDarkMode={isDarkMode} onChange={value => onChange({ title: value })} />
      <TextField label="类名" value={window.className} isDarkMode={isDarkMode} onChange={value => onChange({ className: value })} />
      <TextField label="文件名" value={window.fileName} isDarkMode={isDarkMode} onChange={value => onChange({ fileName: value })} />
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="宽度" value={window.width} min={360} isDarkMode={isDarkMode} onChange={value => onChange({ width: value })} />
        <NumberField label="高度" value={window.height} min={240} isDarkMode={isDarkMode} onChange={value => onChange({ height: value })} />
      </div>
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
    <div className="space-y-3">
      <div className={`flex items-center justify-between p-2 rounded border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
        <span className="text-[10px] text-slate-500 font-mono font-semibold uppercase">控件类型</span>
        <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/10">
          {CONTROL_LABELS[control.type]}
        </span>
      </div>

      <TextField label="中文映射名称" value={control.name} isDarkMode={isDarkMode} onChange={handleNameChange} />
      {control.type !== 'Grid' && (
        <TextField label={control.type === 'ProgressBar' ? '当前进度值' : '显示内容'} value={control.content} isDarkMode={isDarkMode} onChange={value => onChange({ content: value })} />
      )}

      <div className={`grid grid-cols-2 gap-2 p-2 rounded border ${isDarkMode ? 'bg-[#22222a]/30 border-[#2d2d34]/40' : 'bg-white border-slate-200'}`}>
        <NumberField label="宽度" value={control.width} min={20} isDarkMode={isDarkMode} onChange={value => onChange({ width: value })} />
        <NumberField label="高度" value={control.height} min={15} isDarkMode={isDarkMode} onChange={value => onChange({ height: value })} />
        <NumberField label="左距" value={control.x} min={0} isDarkMode={isDarkMode} onChange={value => onChange({ x: value })} />
        <NumberField label="顶距" value={control.y} min={0} isDarkMode={isDarkMode} onChange={value => onChange({ y: value })} />
      </div>

      <div className={`space-y-2 p-2 rounded border ${isDarkMode ? 'bg-[#22222a]/30 border-[#2d2d34]/40' : 'bg-white border-slate-200'}`}>
        <label className="text-[10px] text-slate-500 font-semibold block uppercase">字体大小</label>
        <input
          type="range"
          min="9"
          max="32"
          value={control.fontSize}
          onChange={event => onChange({ fontSize: parseInt(event.target.value) })}
          className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#24242b] rounded-lg appearance-none"
        />
        <div className="flex justify-between text-[9px] text-slate-500 font-mono">
          <span>9px</span>
          <span>当前: {control.fontSize}px</span>
          <span>32px</span>
        </div>
      </div>

      <div className={`space-y-2 p-2 rounded border ${isDarkMode ? 'bg-[#22222a]/30 border-[#2d2d34]/40' : 'bg-white border-slate-200'}`}>
        <div className="space-y-2">
          <label className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
            <Palette className="w-3 h-3 text-cyan-400" />
            <span>颜色</span>
          </label>
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
        </div>
      </div>

      <div className="space-y-2.5">
        <label className="text-[10px] text-slate-500 font-semibold block uppercase">状态</label>
        <label className={`flex items-center justify-between text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
          <span>启用控件</span>
          <input type="checkbox" checked={control.isEnabled} onChange={event => onChange({ isEnabled: event.target.checked })} className="accent-emerald-500 w-4 h-4 cursor-pointer" />
        </label>
        <div className={`flex items-center justify-between text-xs gap-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
          <span>可见性</span>
          <select
            value={control.visibility}
            onChange={event => onChange({ visibility: event.target.value as LingControl['visibility'] })}
            className={`border rounded text-xs px-2 py-0.5 focus:outline-none ${
              isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300' : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            <option value="Visible">显示</option>
            <option value="Collapsed">隐藏</option>
          </select>
        </div>
      </div>

      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-red-950/30 hover:bg-red-900/35 text-red-400 hover:text-red-300 rounded border border-red-900/30 text-xs transition-colors cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>删除此控件</span>
      </button>
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
    <label className="space-y-1 block">
      <span className="text-[10px] text-slate-500 font-semibold block uppercase">{label}</span>
      <input
        type="text"
        value={value}
        onChange={event => onChange(event.target.value)}
        className={`w-full border rounded px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500 ${
          isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
        }`}
      />
    </label>
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
    <label className="space-y-1 block">
      <span className="text-[9px] text-slate-500 block uppercase font-semibold">{label}</span>
      <input
        type="number"
        value={value}
        onChange={event => onChange(Math.max(min, parseInt(event.target.value) || min))}
        className={`w-full border rounded px-2 py-0.5 text-xs focus:outline-none ${
          isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
        }`}
      />
    </label>
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] text-slate-500 block uppercase font-semibold">{label}</span>
        <div className="flex items-center gap-1.5">
          {value === 'transparent' && (
            <span className="text-[9px] text-slate-500 font-mono">transparent</span>
          )}
          <input
            type="color"
            value={normalizedValue}
            onChange={event => onChange(event.target.value)}
            className="w-6 h-5 p-0 border border-slate-600/50 rounded bg-transparent cursor-pointer"
            aria-label={`设置${label}`}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {swatches.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`w-5 h-5 rounded-full border cursor-pointer hover:scale-110 transition-transform relative shrink-0 ${
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
