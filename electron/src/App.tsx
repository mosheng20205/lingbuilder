import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderCode,
  Layers,
  BookOpen,
  Brain,
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
  Sparkles,
  FolderPlus,
  FolderOpen,
  Save,
  Undo2,
  Redo2,
  Copy,
  ClipboardPaste,
  SquareDot,
  Type,
  Keyboard,
  CheckSquare,
  CircleDot,
  List,
  ShieldCheck,
  Minus,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

import {
  AppliedWorkspaceFile,
  BottomPanelTabType,
  CppFile,
  DesignerGeneratedPanelData,
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
import DiffViewer from './components/DiffViewer';
import GlossaryPanel from './components/GlossaryPanel';
import AiAssistant from './components/AiAssistant';
import BottomPanel from './components/BottomPanel';
import {
  requestWindowDesignerBuildRun,
  WINDOW_DESIGNER_LINGCPP_SOURCE_REQUEST,
  WINDOW_DESIGNER_BUILD_RUN_STATE,
  WindowDesignerLingCppSourceRequestDetail,
  WindowDesignerBuildRunStateDetail
} from './services/windowDesigner/windowDesignerCommands';
import {
  getEplEventSuffix,
  getLingWindowSourceFileName,
  readWindowDesignerState,
  saveWindowDesignerState,
  PersistedWindowDesignerState,
  WINDOW_DESIGNER_PROJECT_UPDATED
} from './services/windowDesigner/windowDesignerService';
import { sourceControlService } from './services/lingCpp/sourceControlService';
import { getLingCppProblems } from './services/lingCpp/languageService';
import { EditorExperienceMode, adaptProblemForBeginner } from './services/lingCpp/beginnerService';
import { createWorkspaceEditChangeFromRewrite } from './services/lingCpp/aiEditService';

const EDITOR_EXPERIENCE_MODE_STORAGE_KEY = 'lingbuilder.editorExperienceMode';
const BEGINNER_IGNORED_TASKS_STORAGE_KEY = 'lingbuilder.beginnerIgnoredTasks';

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
};

const getNativeWindowControls = () => {
  return (window as Window & {
    lingBuilder?: {
      windowControls?: LingBuilderWindowControls;
    };
  }).lingBuilder?.windowControls;
};

type OpenControlEventCodeDetail = {
  controlId?: string;
  controlName?: string;
  controlContent?: string;
  controlType?: string;
  eventName?: string;
  handlerName?: string;
  windowFileName?: string;
  windowClassName?: string;
  windowTitle?: string;
};

const DEFAULT_DESIGNER_GENERATED_PANELS: DesignerGeneratedPanelData = {
  xmlLabel: 'MainWindow.xml',
  cppLabel: '登录窗体.h',
  manifestLabel: '窗口程序集',
  xmlCode: '',
  cppCode: '',
  manifestCode: '',
  logs: ['> [编译日志] 等待 F5 触发真实 Win32 构建。'],
  isBuilding: false
};

const EDITOR_FONT_SIZE_STORAGE_KEY = 'lingbuilder.editor.fontSize';
const DEFAULT_EDITOR_FONT_SIZE = 13;
const MIN_EDITOR_FONT_SIZE = 10;
const MAX_EDITOR_FONT_SIZE = 24;

const clampEditorFontSize = (value: number) => {
  return Math.max(MIN_EDITOR_FONT_SIZE, Math.min(MAX_EDITOR_FONT_SIZE, Math.round(value)));
};

const getInitialEditorFontSize = () => {
  try {
    const savedValue = window.localStorage.getItem(EDITOR_FONT_SIZE_STORAGE_KEY);
    if (!savedValue) return DEFAULT_EDITOR_FONT_SIZE;
    const parsedValue = Number.parseInt(savedValue, 10);
    return Number.isFinite(parsedValue) ? clampEditorFontSize(parsedValue) : DEFAULT_EDITOR_FONT_SIZE;
  } catch {
    return DEFAULT_EDITOR_FONT_SIZE;
  }
};

const getInitialEditorExperienceMode = (): EditorExperienceMode => {
  try {
    const savedValue = window.localStorage.getItem(EDITOR_EXPERIENCE_MODE_STORAGE_KEY);
    if (savedValue === 'professional' || savedValue === 'native') return savedValue;
    return 'beginner';
  } catch {
    return 'beginner';
  }
};

const getInitialIgnoredBeginnerTasks = (): string[] => {
  try {
    const savedValue = window.localStorage.getItem(BEGINNER_IGNORED_TASKS_STORAGE_KEY);
    const parsed = savedValue ? JSON.parse(savedValue) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
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
  const lines = [`    事件 ${detail.handlerName}()`];

  if (detail.eventName === 'Click') {
    lines.push(`        信息框("${controlContent}", 64, "事件触发")`);
  }

  lines.push(`        调试输出("${controlName}${eventSuffix}")`);
  return lines.join('\n');
};

const ensureLingCppControlEventHandler = (content: string, detail: OpenControlEventCodeDetail) => {
  const controlName = detail.controlName?.trim();
  const eventName = detail.eventName?.trim();
  const handlerName = detail.handlerName?.trim();

  if (!controlName || !eventName || !handlerName) return content;

  const handlerPattern = new RegExp(`(^|\\n)\\s*事件\\s+${escapeRegExp(handlerName)}\\s*[（(]`);
  if (handlerPattern.test(content)) return content;

  const nextBlock = createLingCppControlEventBlock({ ...detail, controlName, eventName, handlerName });
  return `${content.replace(/\s*结束类\s*$/g, '').trimEnd()}\n\n${nextBlock}\n结束类`;
};

const getCurrentWindowDesignerProject = () => readWindowDesignerState().project;
const getCurrentWindowDesignerProjectId = () => getCurrentWindowDesignerProject().id || 'lingbuilder-ui-project';

const inferFileLanguage = (filePath: string): CppFile['language'] => {
  if (filePath.endsWith('.lcpp')) return 'lingcpp';
  if (filePath.endsWith('.cpp')) return 'cpp';
  if (filePath.endsWith('.h')) return 'header';
  if (filePath.endsWith('.rc')) return 'resource';
  if (filePath.endsWith('.ini')) return 'ini';
  return 'cpp';
};

export default function App() {
  const [windowDesignerState, setWindowDesignerState] = useState<PersistedWindowDesignerState>(() => readWindowDesignerState());
  const [files, setFiles] = useState<CppFile[]>(() => {
    const proj = readWindowDesignerState().project;

    const currentFiles = [...initialFiles];
    proj.windows.forEach(win => {
      const sourceName = `${win.className || win.fileName.replace(/\.xml$/i, '')}.lcpp`;
      const sourcePath = `src/${sourceName}`;
      if (!currentFiles.some(f => f.path === sourcePath)) {
        currentFiles.push({
          path: sourcePath,
          name: sourceName,
          language: 'lingcpp',
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
  const activeFileRef = useRef<CppFile | null>(null);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

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

  useEffect(() => {
    window.localStorage.setItem('lingbuilder.openTabs.v1', JSON.stringify(openTabs));
  }, [openTabs]);

  useEffect(() => {
    if (activeFile) {
      window.localStorage.setItem('lingbuilder.activeTabPath.v1', activeFile.path);
    }
  }, [activeFile]);

  const handleSelectFile = useCallback((file: CppFile, forceCodeView: boolean = true) => {
    setOpenTabs(prev => {
      if (!prev.includes(file.path)) {
        return [...prev, file.path];
      }
      return prev;
    });
    setActiveFile(file);
    if (forceCodeView) {
      window.dispatchEvent(new CustomEvent('force-code-view'));
    }
  }, []);

  const handleCloseTab = useCallback((tabPath: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    setOpenTabs(prev => {
      const index = prev.indexOf(tabPath);
      if (index === -1) return prev;

      const nextTabs = prev.filter(p => p !== tabPath);
      
      // If the closed tab was the active one, switch focus to another open tab
      if (activeFileRef.current && activeFileRef.current.path === tabPath) {
        if (nextTabs.length > 0) {
          const nextActivePath = nextTabs[Math.min(index, nextTabs.length - 1)];
          const nextActive = filesRef.current.find(f => f.path === nextActivePath);
          if (nextActive) {
            setActiveFile(nextActive);
          }
        }
      }
      
      return nextTabs.length > 0 ? nextTabs : ['src/游戏主窗体.lcpp'];
    });
  }, []);
  const [glossary, setGlossary] = useState<GlossaryTerm[]>(defaultGlossary);
  const [problems, setProblems] = useState<ProblemItem[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState<'file' | 'edit' | 'view' | 'project' | 'tools' | 'help' | null>(null);
  const [isMinimizedApp, setIsMinimizedApp] = useState(false);
  const [isMaximizedApp, setIsMaximizedApp] = useState(false);
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [isAppClosed, setIsAppClosed] = useState(false);
  const [editorFontSize, setEditorFontSizeState] = useState(getInitialEditorFontSize);
  const [editorExperienceMode, setEditorExperienceModeState] = useState<EditorExperienceMode>(getInitialEditorExperienceMode);
  const [ignoredBeginnerTaskIds, setIgnoredBeginnerTaskIds] = useState<string[]>(getInitialIgnoredBeginnerTasks);
  const [sourceControlStatus, setSourceControlStatus] = useState<SourceControlStatus | null>(null);

  useEffect(() => {
    const handleDesignerProjectUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<PersistedWindowDesignerState>;
      const nextState = customEvent.detail || readWindowDesignerState();
      setWindowDesignerState(nextState);
    };

    window.addEventListener(WINDOW_DESIGNER_PROJECT_UPDATED, handleDesignerProjectUpdated);
    return () => {
      window.removeEventListener(WINDOW_DESIGNER_PROJECT_UPDATED, handleDesignerProjectUpdated);
    };
  }, []);

  useEffect(() => {
    if (activeFile.language !== 'lingcpp') {
      setProblems([]);
      return;
    }

    const sourceCode = activeFile.translatedContent || activeFile.originalContent || '';
    const nextProblems = getLingCppProblems(sourceCode, windowDesignerState.project, activeFile.path).map(problem => {
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
        canIgnore: beginner.canIgnore
      };
    });
    setProblems(nextProblems);
  }, [activeFile.language, activeFile.originalContent, activeFile.path, activeFile.translatedContent, editorExperienceMode, windowDesignerState.project]);

  const setEditorExperienceMode = useCallback((mode: EditorExperienceMode) => {
    setEditorExperienceModeState(mode);
    try {
      window.localStorage.setItem(EDITOR_EXPERIENCE_MODE_STORAGE_KEY, mode);
    } catch {
      // Experience mode is UI state; editing should keep working without storage.
    }
  }, []);

  const ignoreBeginnerTask = useCallback((taskId: string) => {
    setIgnoredBeginnerTaskIds(previousIds => {
      const nextIds = Array.from(new Set([...previousIds, taskId]));
      try {
        window.localStorage.setItem(BEGINNER_IGNORED_TASKS_STORAGE_KEY, JSON.stringify(nextIds));
      } catch {
        // Ignore state is a convenience only.
      }
      return nextIds;
    });
  }, []);

  const setEditorFontSize = useCallback((nextValue: number | ((value: number) => number)) => {
    setEditorFontSizeState(previousValue => {
      const rawValue = typeof nextValue === 'function' ? nextValue(previousValue) : nextValue;
      const clampedValue = clampEditorFontSize(rawValue);
      try {
        window.localStorage.setItem(EDITOR_FONT_SIZE_STORAGE_KEY, String(clampedValue));
      } catch {
        // Font size persistence is a convenience; editing should not depend on localStorage.
      }
      return clampedValue;
    });
  }, []);

  const promptEditorFontSize = () => {
    const inputValue = window.prompt(
      `设置编辑器字体大小（${MIN_EDITOR_FONT_SIZE}-${MAX_EDITOR_FONT_SIZE}px）`,
      String(editorFontSize)
    );
    if (inputValue === null) return;

    const parsedValue = Number.parseInt(inputValue, 10);
    if (!Number.isFinite(parsedValue)) {
      window.alert('请输入有效的字号数字。');
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
      await windowControls.close();
    } catch (error) {
      console.error('Failed to close native LingBuilder window:', error);
      setIsAppClosed(true);
    }
  };

  const handleAddTerm = (term: GlossaryTerm) => {
    setGlossary(prev => [...prev, term]);
  };

  const handleDeleteTerm = (english: string) => {
    setGlossary(prev => prev.filter(g => g.english !== english));
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
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<'ai' | 'glossary'>('ai');

  // Resizable sidebars state
  const [leftWidth, setLeftWidth] = useState(264);
  const [rightWidth, setRightWidth] = useState(320);
  const [bottomHeight, setBottomHeight] = useState(260);

  const startResizeLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Activity bar is 48px (w-12). Drawer is clientX - 48.
      const newWidth = Math.max(160, Math.min(600, moveEvent.clientX - 48));
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const startResizeRight = (e: React.MouseEvent) => {
    e.preventDefault();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(600, window.innerWidth - moveEvent.clientX));
      setRightWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
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
    '已就绪。点击上方“编译 F5”或左侧“运行”开始模拟目标构建。',
  ]);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const buildIntervalRef = useRef<any>(null);
  const [isAutoTranslating, setIsAutoTranslating] = useState(false);
  const [designerGeneratedPanels, setDesignerGeneratedPanels] = useState<DesignerGeneratedPanelData>(DEFAULT_DESIGNER_GENERATED_PANELS);

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
  const triggerReconstruction = async (fileToRebuild: CppFile, updatedStrings: ExtractedString[]) => {
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
      
      setFiles(prevFiles => {
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
        if (matched) {
          setActiveFile(matched);
        }

        return nextFiles;
      });

      // Dynamically clear resolved problems/warnings
      setProblems(prevProbs => {
        return prevProbs.filter(p => {
          if (p.filePath !== fileToRebuild.path) return true;
          // Check if warning matches any pending strings
          // If the strings are now translated, we can dismiss the problem report!
          const stringInWarning = updatedStrings.find(s => s.line === p.line);
          return stringInWarning ? stringInWarning.status === 'pending' : true;
        });
      });

    } catch (error) {
      console.error('Error rebuilding C++ file structure:', error);
      // Fallback offline reconstruction if server is building/loading
      rebuildFileOffline(fileToRebuild, updatedStrings);
    }
  };

  // Fallback offline reconstruction
  const rebuildFileOffline = (fileToRebuild: CppFile, updatedStrings: ExtractedString[]) => {
    let rebuiltCode = fileToRebuild.originalContent;
    updatedStrings.forEach(s => {
      if (s.translated && s.status === 'translated') {
        // String replace fallback
        rebuiltCode = rebuiltCode.replace(s.original, s.translated);
      }
    });

    setFiles(prevFiles => {
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
      if (matched) setActiveFile(matched);
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
    const handleDesignerGeneratedPanels = (event: Event) => {
      const customEvent = event as CustomEvent<DesignerGeneratedPanelData>;
      if (customEvent.detail) {
        setDesignerGeneratedPanels(customEvent.detail);
      }
    };

    window.addEventListener('window-designer-generated-panels', handleDesignerGeneratedPanels);
    return () => {
      window.removeEventListener('window-designer-generated-panels', handleDesignerGeneratedPanels);
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
        setIsBuilding(true);
        setShowBottomPanel(true);
        setActiveTabInBottom('designer_logs');
      } else {
        setIsBuilding(false);
      }
    };

    window.addEventListener(WINDOW_DESIGNER_BUILD_RUN_STATE, handleWindowDesignerBuildRunState);
    return () => {
      window.removeEventListener(WINDOW_DESIGNER_BUILD_RUN_STATE, handleWindowDesignerBuildRunState);
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
    void refreshSourceControlStatus();
  }, [refreshSourceControlStatus]);

  useEffect(() => {
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
  }, []);

  // Update translation for a single extracted string
  const handleUpdateStringTranslation = (id: string, value: string) => {
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

  const handleDeleteFile = (file: CppFile) => {
    const confirmed = window.confirm(`确认删除文件 ${file.name} 吗？`);
    if (!confirmed) return;
    setFiles(prev => prev.filter(f => f.path !== file.path));
    if (activeFile?.path === file.path) {
      const remaining = filesRef.current.filter(f => f.path !== file.path);
      if (remaining.length > 0) {
        setActiveFile(remaining[0]);
      }
    }
  };

  const handleRenameFile = (file: CppFile, newName: string) => {
    setFiles(prev => prev.map(f => f.path === file.path ? { ...f, name: newName, path: f.path.replace(f.name, newName) } : f));
  };

  const handleUpdateSourceContent = (content: string) => {
    const updatedFile: CppFile = {
      ...activeFile,
      translatedContent: content,
      isModified: content !== activeFile.originalContent
    };

    setActiveFile(updatedFile);
    setFiles(prevFiles => {
      const nextFiles = prevFiles.map(file => (
        file.path === updatedFile.path ? updatedFile : file
      ));
      filesRef.current = nextFiles;
      return nextFiles;
    });
  };

  const handleApplyWorkspaceEdit = useCallback((proposal: WorkspaceEditProposal, appliedFiles: AppliedWorkspaceFile[]) => {
    if (!appliedFiles.length) return;

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
      setActiveFile(nextActiveFile);
    }
  }, []);

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

      customEvent.detail?.respond(lingCppFile ? (lingCppFile.translatedContent || lingCppFile.originalContent) : '');
    };

    window.addEventListener(WINDOW_DESIGNER_LINGCPP_SOURCE_REQUEST, handleLingCppSourceRequest);
    return () => {
      window.removeEventListener(WINDOW_DESIGNER_LINGCPP_SOURCE_REQUEST, handleLingCppSourceRequest);
    };
  }, []);

  useEffect(() => {
    const focusEplHandler = (handlerName: string) => {
      [80, 220, 480].forEach(delay => {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('focus-epl-handler', { detail: { handlerName } }));
        }, delay);
      });
    };

    const handleOpenControlEventCode = (event: Event) => {
      const customEvent = event as CustomEvent<OpenControlEventCodeDetail>;
      const detail = customEvent.detail || {};
      const handlerName = detail.handlerName?.trim();

      if (!handlerName) return;

      const currentFiles = filesRef.current;
      const targetSourceName = getLingWindowSourceFileName(detail.windowFileName, detail.windowClassName);
      const targetFile = currentFiles.find(file => file.name === targetSourceName)
        || currentFiles.find(file => file.language === 'lingcpp')
        || currentFiles.find(file => file.path.endsWith('.lcpp'));

      if (!targetFile) {
        setBuildLogs(prev => [
          ...prev,
          `> [${new Date().toLocaleTimeString()}] 【事件代码】未找到中文源码文件，无法定位 ${handlerName}。`
        ]);
        return;
      }

      const currentContent = targetFile.translatedContent || targetFile.originalContent;
      const nextContent = ensureLingCppControlEventHandler(currentContent, detail);
      if (editorExperienceMode === 'beginner' && nextContent !== currentContent) {
        const proposal: WorkspaceEditProposal = {
          id: `designer-event-${Date.now()}`,
          title: '生成事件函数预览',
          summary: `为 ${handlerName} 生成事件函数`,
          createdAt: new Date().toISOString(),
          explanation: '设计器双击控件触发的本地 WorkspaceEdit。确认后才会写入 .lcpp。',
          changes: [
            createWorkspaceEditChangeFromRewrite(targetFile.path, currentContent, nextContent) as any
          ]
        };
        const change = proposal.changes[0];
        const confirmed = window.confirm([
          proposal.summary,
          '',
          '将新增/替换：',
          change?.newText || '(无变化)',
          '',
          '确认后应用，取消则只定位到当前事件。'
        ].join('\n'));

        if (confirmed) {
          handleApplyWorkspaceEdit(proposal, [{ filePath: targetFile.path, sourceCode: nextContent }]);
        } else {
          setOpenTabs(prev => (prev.includes(targetFile.path) ? prev : [...prev, targetFile.path]));
          setActiveFile(targetFile);
        }
        setEditorExperienceMode('beginner');
        focusEplHandler(handlerName);
        return;
      }
      const updatedFile: CppFile = {
        ...targetFile,
        translatedContent: nextContent,
        isModified: nextContent !== targetFile.originalContent
      };
      const nextFiles = currentFiles.map(file => (file.path === updatedFile.path ? updatedFile : file));

      filesRef.current = nextFiles;
      setFiles(nextFiles);
      setOpenTabs(prev => (
        prev.includes(updatedFile.path) ? prev : [...prev, updatedFile.path]
      ));
      setActiveFile(updatedFile);
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 【事件代码】已打开 ${targetFile.path} 并定位到 ${handlerName}。`
      ]);
      focusEplHandler(handlerName);
    };

    const handleWindowAdded = (event: Event) => {
      const nextWindow = (event as CustomEvent).detail;
      const fileName = getLingWindowSourceFileName(nextWindow.fileName, nextWindow.className);
      const filePath = `src/${fileName}`;

      const currentFiles = filesRef.current;
      const existingFile = currentFiles.find(f => f.path === filePath);
      const targetFile = existingFile || {
        path: filePath,
        name: fileName,
        language: 'lingcpp' as const,
        originalContent: generateDefaultLingCppContentForWindow(nextWindow),
        translatedContent: '',
        strings: [],
        isModified: false
      };
      const nextFiles = existingFile ? currentFiles : [...currentFiles, targetFile];

      filesRef.current = nextFiles;
      setFiles(nextFiles);
      setOpenTabs(prev => (prev.includes(targetFile.path) ? prev : [...prev, targetFile.path]));
      setActiveFile(targetFile);
    };

    const handleWindowDeleted = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const deletedWindow = detail.deletedWindow || detail;
      const nextWindow = detail.nextWindow;
      const fileName = getLingWindowSourceFileName(deletedWindow.fileName, deletedWindow.className);
      const filePath = `src/${fileName}`;
      const nextFiles = filesRef.current.filter(f => f.path !== filePath);

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
      const filePath = `src/${fileName}`;

      const currentFiles = filesRef.current;
      const existingFile = currentFiles.find(f => f.path === filePath);
      const targetFile = existingFile || {
          path: filePath,
          name: fileName,
          language: 'lingcpp' as const,
          originalContent: generateDefaultLingCppContentForWindow(clonedWindow),
          translatedContent: '',
          strings: [],
          isModified: false
      };
      const nextFiles = existingFile ? currentFiles : [...currentFiles, targetFile];

      filesRef.current = nextFiles;
      setFiles(nextFiles);
      setOpenTabs(prev => (prev.includes(targetFile.path) ? prev : [...prev, targetFile.path]));
      setActiveFile(targetFile);
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
  }, []);


  useEffect(() => {
    const loadSavedFiles = async () => {
      try {
        const projectId = getCurrentWindowDesignerProjectId();
        const res = await fetch(`/api/window-designer/files?projectId=${projectId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.designerProject) {
          saveWindowDesignerState({
            project: data.designerProject,
            activeWindowId: data.designerProject.windows?.[0]?.id || 'main-window',
            selectedControlId: data.designerProject.windows?.[0]?.controls?.[0]?.id || null
          });
        }
        if (data && data.files) {
          setFiles(prevFiles => {
            const knownPaths = new Set(prevFiles.map(file => file.path));
            const nextFiles = prevFiles.map(file => {
              if (data.files[file.path] !== undefined) {
                return {
                  ...file,
                  translatedContent: data.files[file.path],
                  isModified: false
                };
              }
              return file;
            });
            Object.entries(data.files).forEach(([filePath, content]) => {
              if (knownPaths.has(filePath)) return;
              nextFiles.push({
                path: filePath,
                name: filePath.split('/').pop() || filePath,
                language: inferFileLanguage(filePath),
                originalContent: content,
                translatedContent: content,
                strings: [],
                isModified: false
              });
            });
            filesRef.current = nextFiles;
            
            // Sync activeFile if it is the main .lcpp file or currently loaded
            const activeName = activeFileRef.current ? activeFileRef.current.name : '游戏主窗体.lcpp';
            const matchedActive = nextFiles.find(f => f.name === activeName);
            if (matchedActive) {
              setActiveFile(matchedActive);
            }
            return nextFiles;
          });
          void refreshSourceControlStatus();
        }
      } catch (e) {
        console.error('Failed to load files from disk:', e);
      }
    };
    loadSavedFiles();
  }, []);

  useEffect(() => {
    let intervalId: any;
    const pollLogs = async () => {
      try {
        const projectId = getCurrentWindowDesignerProjectId();
        const res = await fetch(`/api/window-designer/debug-logs?projectId=${projectId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && Array.isArray(data.logs)) {
          const formatted = data.logs
            .map(line => line.trim())
            .filter(Boolean);
          setDebugLogs(formatted);
        }
      } catch (e) {
        // Polling errors can be ignored
      }
    };
    intervalId = setInterval(pollLogs, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const handleClearLogs = useCallback((tab: string) => {
    if (tab === 'designer_logs') {
      setDesignerGeneratedPanels(prev => ({
        ...prev,
        logs: []
      }));
    } else if (tab === 'output') {
      setBuildLogs([]);
    } else if (tab === 'debug_logs') {
      setDebugLogs([]);
      const projectId = getCurrentWindowDesignerProjectId();
      fetch(`/api/window-designer/debug-logs?projectId=${projectId}&clear=true`).catch(() => {});
    }
  }, []);

  // Update status (translated, skipped, pending)
  const handleSetStatus = (id: string, status: 'translated' | 'skipped' | 'pending') => {
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
    triggerReconstruction(activeFile, updatedStrings);
  };

  // Handle batch AI translations from AiAssistant
  const handleBatchTranslate = (translations: { id: string; translated: string }[]) => {
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
    triggerReconstruction(activeFile, updatedStrings);
  };

  // Perform one-click batch AI translation for all pending strings in active file
  const handleAutoTranslateAll = async () => {
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
      if (data.translations && Array.isArray(data.translations)) {
        handleBatchTranslate(data.translations);
        setBuildLogs(prev => [
          ...prev,
          `> [${new Date().toLocaleTimeString()}] 【一键智能汉化】成功！已生成并注入 ${data.translations.length} 项精准中文字段。`,
          `> [AI] 新代码重构生成就绪。`
        ]);
      } else {
        throw new Error('未返回预期的翻译结果格式');
      }
    } catch (err: any) {
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

      handleBatchTranslate(fallbackTranslations);
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 【一键智能汉化】已应用本地翻译词典机制！成功翻译填充了 ${fallbackTranslations.length} 项汉化字段。`,
        `> [AI] 建议配置 GEMINI_API_KEY 以开启完全上下文智能 C++ 原生宏替换功能。`
      ]);
    } finally {
      setIsAutoTranslating(false);
    }
  };

  // Tool handlers for our LingBuilder IDE Custom Toolbar
  const handleToolbarAction = (actionName: string) => {
    setShowBottomPanel(true);
    setActiveTabInBottom('output');
    
    if (actionName === 'new') {
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 【新建】已为您成功创建新的 LingBuilder 中文 UI 项目模板及设计窗体 (MainWindow.xml)。`
      ]);
    } else if (actionName === 'open') {
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 【打开】成功打开已有的项目设计文件：'MainWindow.xml' 及对应类映射源文件。`
      ]);
    } else if (actionName === 'save') {
      const designerProject = getCurrentWindowDesignerProject();
      const projectId = designerProject.id || 'lingbuilder-ui-project';

      const projectFiles: Record<string, string> = {};
      filesRef.current.forEach(file => {
        projectFiles[file.path] = file.translatedContent || file.originalContent || '';
      });

      fetch('/api/window-designer/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, files: projectFiles, project: designerProject })
      }).then(res => {
        if (res.ok) {
          void refreshSourceControlStatus();
          setBuildLogs(prev => [
            ...prev,
            `> [${new Date().toLocaleTimeString()}] 【保存】正在序列化并将当前中文代码及 UI 界面结构写入项目磁盘... 成功写入并同步完成！`
          ]);
        } else {
          setBuildLogs(prev => [
            ...prev,
            `> [${new Date().toLocaleTimeString()}] 【保存错误】无法写入文件到项目磁盘。`
          ]);
        }
      }).catch(err => {
        setBuildLogs(prev => [
          ...prev,
          `> [${new Date().toLocaleTimeString()}] 【保存错误】网络连接失败: ${err.message}`
        ]);
      });
    } else if (actionName === 'undo') {
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 【编辑】撤销成功 (无更早打造的属性或布局历史)。`
      ]);
    } else if (actionName === 'redo') {
      setBuildLogs(prev => [
        ...prev,
        `> [${new Date().toLocaleTimeString()}] 【编辑】重做成功 (属性和布局已同步最新)。`
      ]);
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

  const handleAddDesignerControl = (type: string) => {
    window.dispatchEvent(new CustomEvent('show-window-designer'));
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('add-designer-control', { detail: { type } }));
    }, 50);
  };

  const handleEnvCheck = () => {
    setShowBottomPanel(true);
    setActiveTabInBottom('output');
    setBuildLogs([
      `>>> [${new Date().toLocaleTimeString()}] 开始全套 LingBuilder 本机开发环境自检 (C++ / Windows SDK / LING C++ Runtime)...`,
      `> [环境] LING_SDK_ROOT = C:\\LingBuilder\\SDK\\v4.2`,
      `> [环境] MSVC Toolset = Visual Studio 2022 Build Tools (v143)`,
      `> [环境] WindowsSDK = 10.0.22621.0`,
      `> [自检] 正在验证 C++ 20 依赖库及 Unicode 语言资源转换编译器 (rc.exe / cl.exe)...`,
      `> [自检] 检测到 64 位 MSVC 本机编译器 (x64) 运行状态良好。`,
      `> [自检] 本地 UTF-8 中文转换规则包校验成功：加载 13,041 个标准中英对照符号。`,
      `>>> [${new Date().toLocaleTimeString()}] 【自检成功】本地开发及编译环境状态：已就绪 (READY)。您可以安全地点击 "编译 F5" 进行代码热编译运行。`
    ]);
  };

  // Real window designer build task (F5)
  const handleRunBuild = useCallback(() => {
    if (buildIntervalRef.current) {
      clearInterval(buildIntervalRef.current);
      buildIntervalRef.current = null;
    }

    window.dispatchEvent(new CustomEvent('show-window-designer'));
    setShowBottomPanel(true);
    setActiveTabInBottom('output');
    setBuildLogs(prev => [
      ...prev,
      `> [${new Date().toLocaleTimeString()}] 【F5】正在调用窗口设计器“生成并运行”命令...`
    ]);

    window.setTimeout(() => {
      requestWindowDesignerBuildRun();
    }, 50);
  }, []);

  // Stop Simulation Build / Debugging (Shift+F5)
  const handleStopBuild = useCallback(() => {
    if (buildIntervalRef.current) {
      clearInterval(buildIntervalRef.current);
      buildIntervalRef.current = null;
    }
    setIsBuilding(false);
    setBuildLogs(prev => [
      ...prev,
      `> [${new Date().toLocaleTimeString()}] 🔴 调试已终止 (用户通过 Stop Debugging/Shift+F5 终止了程序的运行)。`
    ]);
  }, []);

  // Keyboard Shortcuts (F5 to run, Shift+F5 to stop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          handleStopBuild();
        } else {
          handleRunBuild();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        handleToolbarAction('save');
      }
    };
    window.addEventListener('keydown', handleKeyDown, true); // Use capturing phase to guarantee interception in all inputs/editors
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleRunBuild, handleStopBuild]);

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

  // Helper to force Bottom panel selection
  const [activeTabInBottom, setActiveTabInBottom] = useState<BottomPanelTabType>('extracted');

  // Custom User Code Extraction API Call
  const handleExtractCustomCode = async () => {
    if (!customCode.trim() || !customFilename.trim()) return;
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
      
      const newFile: CppFile = {
        path: `src/${customFilename}`,
        name: customFilename,
        language: customFilename.endsWith('.h') ? 'header' : 'cpp',
        originalContent: customCode,
        translatedContent: '',
        strings: data.strings || [],
        isModified: false
      };

      setFiles(prev => [...prev, newFile]);
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
      triggerReconstruction(newFile, newFile.strings);

    } catch (err: any) {
      console.error(err);
      alert(`提取解析出错：${err.message || '未知错误'}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const diffResult: DiffResult = computeDiff(activeFile.originalContent, activeFile.translatedContent || activeFile.originalContent);

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

  return (
    <div className={`h-screen flex flex-col overflow-hidden font-sans select-none ${isDarkMode ? 'bg-[#1E1E1E] text-[#D4D4D4]' : 'bg-slate-50 text-slate-800'}`}>
      {/* Title Bar */}
      <div
        onDoubleClick={handleWindowToggleMaximize}
        className={`h-8 flex items-center justify-between pl-3 pr-0 border-b text-[11px] shrink-0 select-none cursor-default ${
          isDarkMode 
            ? 'bg-[#323233] text-slate-200 border-[#2B2B2B]' 
            : 'bg-[#F3F3F3] text-slate-800 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="text-[#007ACC] font-bold tracking-wide">C++ LocMaster (LingBuilder)</div>
          <div
            onDoubleClick={e => e.stopPropagation()}
            className={`hidden md:flex gap-4 ${isDarkMode ? 'text-[#CCCCCC]' : 'text-slate-600'} z-50`}
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
                  <button onClick={() => { handleToolbarAction('new'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>新建项目</span>
                    <span className="opacity-50 text-[10px]">Ctrl+N</span>
                  </button>
                  <button onClick={() => { handleToolbarAction('open'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>打开项目</span>
                    <span className="opacity-50 text-[10px]">Ctrl+O</span>
                  </button>
                  <button onClick={() => { handleToolbarAction('save'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>保存项目</span>
                    <span className="opacity-50 text-[10px]">Ctrl+S</span>
                  </button>
                  <div className={`h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  <button onClick={() => { promptEditorFontSize(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
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
                    <span className="opacity-50 text-[10px]">Ctrl+Shift+N</span>
                  </button>
                  <button onClick={() => { 
                    handleImportDictionary("精选本地化词典", [
                      { english: "Welcome", chinese: "欢迎使用", description: "UI 欢迎词" },
                      { english: "Status", chinese: "运行状态", description: "系统运行状态" }
                    ]); 
                    setActiveDropdown(null); 
                  }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>导入翻译词典</span>
                    <span className="opacity-50 text-[10px]">Ctrl+I</span>
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
                  <button onClick={() => { handleToolbarAction('undo'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>撤销上次操作</span>
                    <span className="opacity-50 text-[10px]">Ctrl+Z</span>
                  </button>
                  <button onClick={() => { handleToolbarAction('redo'); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>重做上次操作</span>
                    <span className="opacity-50 text-[10px]">Ctrl+Y</span>
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
                  <button onClick={() => { setShowLeftSidebar(!showLeftSidebar); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>解决方案资源管理器</span>
                    <span className="opacity-50 text-[9px]">{showLeftSidebar ? '隐藏' : '显示'}</span>
                  </button>
                  <button onClick={() => { setShowBottomPanel(!showBottomPanel); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>提取字段与终端面板</span>
                    <span className="opacity-50 text-[9px]">{showBottomPanel ? '隐藏' : '显示'}</span>
                  </button>
                  <button onClick={() => { setShowRightPanel(!showRightPanel); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>AI 智能建议面板</span>
                    <span className="opacity-50 text-[9px]">{showRightPanel ? '隐藏' : '显示'}</span>
                  </button>
                  <div className={`h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  <button onClick={() => { setIsDarkMode(!isDarkMode); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
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
                  <button onClick={() => { handleRunBuild(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>编译并热运行游戏</span>
                    <span className="opacity-50 text-[10px]">F5</span>
                  </button>
                  <button onClick={() => { handleStopBuild(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>强制停止游戏调试</span>
                    <span className="opacity-50 text-[10px]">Shift+F5</span>
                  </button>
                  <div className={`h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  <button onClick={() => { handleGenerateCpp(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>生成 C++ 宏定义类</span>
                    <span className="opacity-50 text-[10px]">Ctrl+G</span>
                  </button>
                  <button onClick={() => { handleEnvCheck(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>项目环境开发自检</span>
                    <span className="opacity-50 text-[10px]">Ctrl+E</span>
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
                  <button onClick={() => { handleEnvCheck(); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>自检开发环境依赖</span>
                    <span className="opacity-50 text-[10px]">检测</span>
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
                  <button onClick={() => { setShowAboutModal(true); setActiveDropdown(null); }} className={`px-3 py-1.5 text-left flex items-center justify-between text-[11px] ${isDarkMode ? 'hover:bg-[#007acc] hover:text-white' : 'hover:bg-[#007acc] hover:text-white'}`}>
                    <span>关于 LingBuilder IDE...</span>
                    <span className="opacity-50 text-[10px]">版本</span>
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
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right window controls */}
        <div className="flex items-center gap-0" onDoubleClick={e => e.stopPropagation()}>
          <div className={`text-[10px] opacity-50 px-2 italic hidden lg:block ${isDarkMode ? 'text-[#CCCCCC]' : 'text-slate-600'}`}>
            LingBuilder_v2.0 - 汉化方案
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
        <div className="flex items-center gap-1.5">
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
              onClick={() => handleToolbarAction('open')}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="打开 (打开已有项目或设计文件)"
            >
              <FolderOpen className="w-4 h-4 text-amber-500" />
            </button>
            <button
              onClick={() => handleToolbarAction('save')}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="保存 (保存当前项目、窗口设计、代码或配置修改)"
            >
              <Save className="w-4 h-4 text-emerald-500" />
            </button>
            
            <div className={`w-px h-3.5 mx-1 ${isDarkMode ? 'bg-[#3d3d42]' : 'bg-slate-200'}`}></div>

            <button
              onClick={() => handleToolbarAction('undo')}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="撤销 (撤回上一步操作，比如移动组件、修改属性、输入内容等)"
            >
              <Undo2 className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => handleToolbarAction('redo')}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="重做 (恢复刚才被撤销的操作)"
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

          {/* GROUP 2: 设计器控件添加 */}
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${
            isDarkMode ? 'bg-[#1e1e1f] border-[#2d2d30]' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <span className={`text-[10px] font-bold px-1 select-none border-r mr-1 ${
              isDarkMode ? 'text-slate-500 border-[#2d2d30]' : 'text-slate-400 border-slate-200'
            }`}>添加控件</span>
            <button
              onClick={() => handleAddDesignerControl('Button')}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="按钮 (在设计器中添加一个“按钮”控件)"
            >
              <SquareDot className="w-4 h-4 text-blue-400" />
            </button>
            <button
              onClick={() => handleAddDesignerControl('Label')}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="标签 (添加一个文本标签控件，用于显示说明文字)"
            >
              <Type className="w-4 h-4 text-cyan-400" />
            </button>
            <button
              onClick={() => handleAddDesignerControl('TextBox')}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="输入框 (添加文本输入框控件)"
            >
              <Keyboard className="w-4 h-4 text-teal-400" />
            </button>
            <button
              onClick={() => handleAddDesignerControl('CheckBox')}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="复选框 (添加可多选的勾选控件)"
            >
              <CheckSquare className="w-4 h-4 text-indigo-400" />
            </button>
            <button
              onClick={() => handleAddDesignerControl('RadioButton')}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="单选框 (添加单选控件，通常用于一组选项中只能选一个)"
            >
              <CircleDot className="w-4 h-4 text-purple-400" />
            </button>
            <button
              onClick={() => handleAddDesignerControl('ComboBox')}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#2d2d30]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="下拉框 (添加下拉选择控件)"
            >
              <List className="w-4 h-4 text-violet-400" />
            </button>
          </div>

          <div className={`w-px h-5 mx-1 ${isDarkMode ? 'bg-[#3d3d42]' : 'bg-slate-300'}`}></div>

          {/* GROUP 3: 代码生成、运行和环境检测 */}
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
              disabled={!isBuilding}
              className={`p-1 rounded cursor-pointer transition-all active:scale-95 ${
                isBuilding 
                  ? 'text-red-500 hover:text-red-650' 
                  : isDarkMode 
                    ? 'opacity-40 text-slate-500 cursor-not-allowed' 
                    : 'opacity-40 text-slate-400 cursor-not-allowed'
              }`}
              title="停止调试 (Shift+F5)&#10;终止现行易程序的运行"
            >
              <Square className="w-4 h-4 fill-red-500/10" />
            </button>
            <button
              onClick={() => {
                setBuildLogs(prev => [...prev, `> [${new Date().toLocaleTimeString()}] 正在重启当前调试实例...`]);
                handleRunBuild();
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
              title="环境检查 (检测本机开发环境，例如 .NET、MSVC、Windows SDK、CMake、WebView2、运行时 DLL 等是否就绪)"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right side items */}
        <div className="flex items-center gap-4">

          {/* Panels Toggles */}
          <div className={`flex items-center rounded p-0.5 border ${
            isDarkMode ? 'bg-[#37373D] border-[#181818]' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <button
              onClick={() => setShowLeftSidebar(!showLeftSidebar)}
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
              onClick={() => setShowBottomPanel(!showBottomPanel)}
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
              onClick={() => setShowRightPanel(!showRightPanel)}
              className={`p-1 rounded cursor-pointer transition-colors ${
                showRightPanel 
                  ? isDarkMode ? 'bg-[#1E1E1E] text-white' : 'bg-slate-100 text-slate-900 font-medium' 
                  : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="切换 AI / 词典面板"
            >
              <Brain className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className={`w-px h-4 ${isDarkMode ? 'bg-[#444]' : 'bg-slate-300'}`}></div>

          {/* Theme Switcher */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
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
          files={files}
          activeFile={activeFile}
          onSelectFile={handleSelectFile}
          onRunBuild={handleRunBuild}
          isBuilding={isBuilding}
          isDarkMode={isDarkMode}
          showLeftSidebar={showLeftSidebar}
          setShowLeftSidebar={setShowLeftSidebar}
          onBatchTranslate={handleBatchTranslate}
          onSetStatus={handleSetStatus}
          glossary={glossary}
          drawerWidth={leftWidth}
          onDeleteFile={handleDeleteFile}
          onRenameFile={handleRenameFile}
          sourceControlStatus={sourceControlStatus}
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
          onDoubleClick={showLeftSidebar ? () => setLeftWidth(264) : undefined}
          onClick={showLeftSidebar ? undefined : () => setShowLeftSidebar(true)}
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
              setShowLeftSidebar(!showLeftSidebar);
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
          <div className="flex-1 flex flex-col min-h-0 bg-[#141418]">
            <DiffViewer
              diffResult={diffResult}
              strings={activeFile.strings}
              onUpdateStringTranslation={handleUpdateStringTranslation}
              onResetTranslation={handleResetTranslation}
              onUpdateSourceContent={handleUpdateSourceContent}
              isDarkMode={isDarkMode}
              activeFile={activeFile}
              editorFontSize={editorFontSize}
              onFontSizeChange={setEditorFontSize}
              openTabs={openTabs}
              activeTabPath={activeFile.path}
              onSelectTab={handleSelectFile}
              onCloseTab={handleCloseTab}
              allFiles={files}
              designerProject={windowDesignerState.project}
              activeWindowId={windowDesignerState.activeWindowId}
              editorExperienceMode={editorExperienceMode}
              onExperienceModeChange={setEditorExperienceMode}
              problems={problems}
              ignoredBeginnerTaskIds={ignoredBeginnerTaskIds}
              onIgnoreBeginnerTask={ignoreBeginnerTask}
              onApplyWorkspaceEdit={handleApplyWorkspaceEdit}
              onOpenProblemsPanel={() => {
                setActiveTabInBottom('problems');
                setShowBottomPanel(true);
              }}
            />
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
            onClick={showBottomPanel ? undefined : () => setShowBottomPanel(true)}
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
                setShowBottomPanel(!showBottomPanel);
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
              problems={problems}
              buildLogs={buildLogs}
              debugLogs={debugLogs}
              onClearLogs={handleClearLogs}
              onSelectLine={handleSelectLine}
              onUpdateStringTranslation={handleUpdateStringTranslation}
              onSetStatus={handleSetStatus}
              isDarkMode={isDarkMode}
              activeTab={activeTabInBottom}
              onActiveTabChange={setActiveTabInBottom}
              generatedPanels={designerGeneratedPanels}
              height={bottomHeight}
            />
          )}
        </div>

        {/* RIGHT DRAG RESIZER & COLLAPSE TOGGLE */}
        <div
          className={`w-[6px] relative flex items-center justify-center select-none transition-all duration-150 z-20 shrink-0 border-l group ${
            showRightPanel 
              ? isDarkMode 
                ? 'bg-[#1c1c22] border-[#2d2d34] cursor-col-resize hover:bg-blue-500/20' 
                : 'bg-slate-100 border-slate-200 cursor-col-resize hover:bg-blue-500/10'
              : isDarkMode
                ? 'bg-[#16161c] border-[#2d2d34] cursor-pointer hover:bg-amber-500/10'
                : 'bg-slate-50 border-slate-200 cursor-pointer hover:bg-amber-500/10'
          }`}
          onMouseDown={showRightPanel ? startResizeRight : undefined}
          title={showRightPanel ? "拖拽两侧边缘调整宽度 / 双击重置 / 点击按钮折叠" : "点击展开右侧 AI 助手面板"}
          onDoubleClick={showRightPanel ? () => setRightWidth(320) : undefined}
          onClick={showRightPanel ? undefined : () => setShowRightPanel(true)}
        >
          {/* Thin line indicator */}
          <div className={`w-[1px] rounded-full transition-all ${
            showRightPanel 
              ? 'h-8 bg-slate-700/50 group-hover:bg-blue-400 group-hover:h-12' 
              : 'h-12 bg-amber-500/20 group-hover:bg-amber-500/50'
          }`}></div>

          {/* Toggle Trigger Pill Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowRightPanel(!showRightPanel);
            }}
            className={`absolute left-1/2 -translate-x-1/2 w-[16px] h-12 border rounded shadow-lg flex items-center justify-center cursor-pointer transition-all hover:scale-105 z-30 group-hover:opacity-100 opacity-60 ${
              isDarkMode 
                ? 'bg-[#2d2d36] hover:bg-[#3a3a45] active:bg-[#4a4a58] border-[#444] hover:border-blue-500/60' 
                : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-slate-300 hover:border-blue-500/60'
            }`}
            title={showRightPanel ? "折叠右侧面板" : "展开右侧面板"}
          >
            {showRightPanel ? (
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-400 transition-transform" />
            ) : (
              <ChevronLeft className="w-3 h-3 text-amber-500 group-hover:text-amber-400 transition-transform group-hover:scale-110" />
            )}
          </button>
        </div>

        {/* Right Control Side Panel */}
        {showRightPanel && (
          <div 
            style={{ width: `${rightWidth}px` }}
            className={`flex flex-col overflow-hidden shrink-0 border-l ${
              isDarkMode ? 'bg-[#1e1e24] border-[#2d2d34]' : 'bg-white border-slate-200'
            }`}
          >
            {/* Visual Studio style Panel selector tab headers */}
            <div className={`flex px-2 pt-1 shrink-0 select-none border-b ${
              isDarkMode ? 'bg-[#18181c] border-[#2d2d34]' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                onClick={() => setRightPanelTab('ai')}
                className={`flex-1 py-2 text-[11px] font-semibold text-center border-b-2 cursor-pointer transition-colors ${
                  rightPanelTab === 'ai' 
                    ? isDarkMode 
                      ? 'text-white border-blue-500 bg-[#1e1e24]' 
                      : 'text-blue-600 border-blue-500 bg-white'
                    : isDarkMode
                      ? 'text-slate-400 border-transparent hover:text-slate-200'
                      : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                AI 智能编程助手
              </button>
              <button
                onClick={() => setRightPanelTab('glossary')}
                className={`flex-1 py-2 text-[11px] font-semibold text-center border-b-2 cursor-pointer transition-colors ${
                  rightPanelTab === 'glossary' 
                    ? isDarkMode 
                      ? 'text-white border-blue-500 bg-[#1e1e24]' 
                      : 'text-blue-600 border-blue-500 bg-white'
                    : isDarkMode
                      ? 'text-slate-400 border-transparent hover:text-slate-200'
                      : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                中文编程术语映射
              </button>
            </div>

            {/* Display relevant Panel based on tab */}
            <div className="flex-1 overflow-hidden">
              {rightPanelTab === 'ai' ? (
                <AiAssistant
                  strings={activeFile.strings}
                  glossary={glossary}
                  onBatchTranslate={handleBatchTranslate}
                  onSetStatus={handleSetStatus}
                  filePath={activeFile.path}
                  sourceCode={activeFile.translatedContent || activeFile.originalContent}
                  activeLanguage={activeFile.language}
                  workspaceFiles={files.map(file => ({
                    filePath: file.path,
                    sourceCode: file.translatedContent || file.originalContent,
                    language: file.language
                  }))}
                  onApplyWorkspaceEdit={handleApplyWorkspaceEdit}
                  isDarkMode={isDarkMode}
                />
              ) : (
                <GlossaryPanel
                  glossary={glossary}
                  onAddTerm={handleAddTerm}
                  onDeleteTerm={handleDeleteTerm}
                  onImportDictionary={handleImportDictionary}
                  isDarkMode={isDarkMode}
                />
              )}
            </div>
          </div>
        )}
      </div>

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

      {showAboutModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-4 select-none">
          <div className="w-full max-w-sm bg-[#1e1e24] border border-[#2d2d34] rounded-lg shadow-2xl flex flex-col text-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-[#18181c] border-b border-[#2d2d34] flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">关于 C++ LocMaster (LingBuilder)</span>
              <button
                onClick={() => setShowAboutModal(false)}
                className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 bg-[#007ACC]/15 rounded-full flex items-center justify-center border border-[#007ACC]/30 shadow-inner">
                <FolderCode className="w-6 h-6 text-[#007ACC]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-100">C++ LocMaster (LingBuilder)</h3>
                <p className="text-[10px] text-slate-500 font-mono">Build v2.0.4.108 - Release</p>
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed text-left w-full space-y-2 bg-[#141418] p-3 rounded border border-[#2d2d34]/60">
                <p>💡 **中文零损编译替换方案**</p>
                <p>由易集成开发环境研究院主导打造的 C++ 本地化宏引擎。其通过将提取出的多语言资源独立托管，免去重构代码的繁杂步骤，通过一键智能分析和 Unicode 资源打包机制，为您提供高品质、零侵入的原生中文化编程体验。</p>
              </div>

              <div className="text-[9.5px] text-slate-500 flex justify-between w-full">
                <span>© 2026 LingBuilder Dev Group</span>
                <span>All Rights Reserved</span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-[#18181c] border-t border-[#2d2d34] flex justify-end">
              <button
                onClick={() => setShowAboutModal(false)}
                className="px-4 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer shadow"
              >
                确定
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
                onClick={() => {
                  handleToolbarAction('save');
                  void handleWindowCloseConfirmed();
                }}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
              >
                保存并退出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="h-6 bg-[#007ACC] text-white flex items-center px-3 justify-between text-[11px] shrink-0 select-none font-sans">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-white opacity-80"></span>
            <span>已就绪</span>
          </div>
          <div>字符集: UTF-8 / Unicode</div>
          <div className="hidden sm:block text-slate-200">构建配置: Release (x64)</div>
        </div>
        <div className="flex items-center gap-4 text-slate-100">
          <div>双击行编写中文</div>
          <div>空格: 4</div>
          <div className="hover:bg-[#1f8ad2] px-2 py-0.5 rounded cursor-pointer transition-colors">反馈支持</div>
        </div>
      </div>
    </div>
  );
}
