import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardPaste, Copy, FileUp, Plus, Search, Trash2, X } from 'lucide-react';
import type { CommandService } from '../services/commands/commandService';
import type { CommandContext } from '../services/commands/types';
import { getMenuService } from '../services/menus/menuService';
import { LINGCPP_CPP_SOURCE_LIBRARY_CONTEXT_MENU } from '../services/menus/types';
import {
  PROJECT_CPP_SOURCE_LIBRARY_FILE_NAME,
  getProjectCppSourceLibraryDiagnostics,
  parseCppSourceDeclarationSnippet,
  parseCppHeaderDeclarations,
  serializeCppSourceCommandSnippet,
  serializeProjectCppSourceLibraries
} from '../services/lingCpp/projectCppSourceLibraryService';
import { parseLingCpp } from '../services/lingCpp/parser';
import { getLingCppCommentTokenColor } from '../services/lingCpp/semanticTheme';
import {
  acquireLingCppCppSourceLibraryEditorCommands
} from '../services/lingCpp/cppSourceLibraryEditorCommands';
import {
  LingCppCppSourceCommand,
  LingCppCppClass,
  LingCppCppClassMethod,
  LingCppCppSourceLibrary,
  LingCppParameter
} from '../services/lingCpp/types';

interface ProjectCppSourceLibraryEditorProps {
  sourceCode: string;
  filePath: string;
  isDarkMode: boolean;
  readOnly?: boolean;
  /** 提供后启用右键菜单（搜索/展开所有/折叠所有）；缺省时右键无菜单。 */
  commandService?: CommandService;
  onChange: (sourceCode: string) => void;
}

const RETURN_TYPES = ['整数型', '长整数型', '小数型', '单精度小数型', '逻辑型', '字节型', '文本型', '字节集', '指针整数', '整数型[]', '文本型[]', '小数型[]', '空'];
const PARAMETER_TYPES = ['整数型', '长整数型', '小数型', '单精度小数型', '逻辑型', '字节型', '文本型', '字节集', '指针整数', '整数型[]', '长整数型[]', '小数型[]', '文本型[]', '处理器'];

/** 易语言定义表式统一网格：命令名 / 返回类型 / C++ 函数名 / 备注 / 行操作列。 */
const GRID_COLUMNS = '168px 132px 148px minmax(180px, 1fr) 34px';
/** 参数子表网格：参数名 / 类型 / 传址 / 备注 / 行操作列。 */
const PARAM_GRID_COLUMNS = '148px 132px 52px minmax(160px, 1fr) 34px';

function packageNameOf(sourceCode: string): string {
  const match = sourceCode.match(/^包\s+(.+)$/mu);
  return match?.[1]?.trim() || '项目C++源码库';
}

/** 编辑器右键菜单解析与命令执行共用的上下文（三个视图命令均以 when: 'workspace.open' 注册）。 */
const CPP_SOURCE_LIBRARY_EDITOR_MENU_CONTEXT: CommandContext = { 'workspace.open': true };

function createEmptyLibrary(): LingCppCppSourceLibrary {
  return {
    name: '',
    line: 0,
    sourceFiles: [],
    headerFiles: [],
    includeDirs: [],
    commands: [],
    classes: []
  };
}

/** 处理器参数签名的文本形态解析（编辑单元格用）：`整数型 已下载, 整数型 总大小 [回传 逻辑型]`。 */
function parseHandlerSignatureText(text: string): { parameters: LingCppParameter[]; returnType?: string } {
  let source = text.trim();
  let returnType: string | undefined;
  const returnMatch = source.match(/\s*回传\s+(\S+)\s*$/u);
  if (returnMatch) {
    returnType = returnMatch[1];
    source = source.slice(0, returnMatch.index).trim();
  }
  const parameters = source.split(/[,，]/u).map(piece => piece.trim()).filter(Boolean).map((piece, index) => {
    const pieces = piece.split(/\s+/u).filter(Boolean);
    const parameterType = pieces[0] || '整数型';
    const parameterName = pieces.length > 1 ? pieces.slice(1).join('') : `参数${index + 1}`;
    return { name: parameterName, type: parameterType };
  });
  return { parameters, returnType };
}

function serializeHandlerSignatureText(parameters: LingCppParameter[] | undefined, returnType?: string): string {
  const signatureText = (parameters || []).map(parameter => `${parameter.type} ${parameter.name}`).join(', ');
  return returnType ? `${signatureText} 回传 ${returnType}` : signatureText;
}

/** 类内「添加方法」的占位方法名：取本类不冲突的 `新方法N`。 */
function nextClassMethodName(classItem: LingCppCppClass): string {
  const used = new Set(classItem.methods.map(method => method.name));
  let index = 1;
  while (used.has(`新方法${index}`)) index += 1;
  return `新方法${index}`;
}

/** 「添加命令」的占位命令名：取全文件不冲突的 `新命令N`，避免空名序列化成解析器不认的死行。 */
function nextCommandName(libraries: LingCppCppSourceLibrary[]): string {
  const used = new Set(libraries.flatMap(library => library.commands.map(command => command.name)));
  let index = 1;
  while (used.has(`新命令${index}`)) index += 1;
  return `新命令${index}`;
}

/** 按文件路径读取持久化的折叠命令集合（损坏/缺失一律按「全部展开」处理）。 */
function readStoredCollapsedKeys(filePath: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(`lingbuilder.cppSourceLibrary.collapsed.v1:${filePath}`);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((item): item is string => typeof item === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

function parseLibraries(sourceCode: string): LingCppCppSourceLibrary[] {
  const libraries = parseLingCpp(sourceCode).program.cppLibraries || [];
  return libraries.length > 0 ? libraries.map(library => ({ ...library })) : [createEmptyLibrary()];
}

async function copyTextWithFallback(value: string): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // 部分 Electron/WebView 环境暴露 navigator.clipboard 但会拒绝写入。
  }
  if (typeof document === 'undefined') throw new Error('当前环境不支持剪贴板。');
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.setAttribute('readonly', '');
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('剪贴板写入失败。');
}

async function readClipboardText(): Promise<string> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      return await navigator.clipboard.readText();
    }
  } catch {
    // 读取失败时统一按不支持处理。
  }
  throw new Error('无法读取剪贴板，请先在其他项目里复制 C++ 源码命令声明。');
}

export default function ProjectCppSourceLibraryEditor(props: ProjectCppSourceLibraryEditorProps) {
  const { sourceCode, filePath, isDarkMode, readOnly, commandService, onChange } = props;
  const diagnostics = useMemo(() => getProjectCppSourceLibraryDiagnostics(sourceCode), [sourceCode]);

  const [libraries, setLibraries] = useState<LingCppCppSourceLibrary[]>(() => parseLibraries(sourceCode));
  const [feedback, setFeedback] = useState('');
  const [headerText, setHeaderText] = useState('');
  const [showHeaderImport, setShowHeaderImport] = useState(false);
  /** 折叠的命令卡片（key = 库名::命令名，库内命令名唯一）；按文件记进 localStorage。 */
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => readStoredCollapsedKeys(filePath));
  const collapseStorageKey = `lingbuilder.cppSourceLibrary.collapsed.v1:${filePath}`;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(collapseStorageKey, JSON.stringify([...collapsedKeys]));
    } catch {
      // 存储不可用（隐私模式/配额）时折叠记忆退化为会话内状态，不影响编辑。
    }
  }, [collapseStorageKey, collapsedKeys]);
  const [searchText, setSearchText] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const packageName = packageNameOf(sourceCode);

  const surface = isDarkMode ? 'border-[#34343e] bg-[#17181d] text-slate-200' : 'border-slate-200 bg-white text-slate-800';
  const input = `h-7 rounded border px-2 text-xs outline-none ${isDarkMode ? 'border-[#3b3d46] bg-[#101116] text-slate-100' : 'border-slate-300 bg-white'}`;
  const button = `inline-flex h-7 items-center gap-1 rounded border px-2 text-xs ${isDarkMode ? 'border-[#41434d] bg-[#24262d] hover:bg-[#30323a]' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`;

  // 表格流单元格：静态时与表格融为一体，悬停淡边框、聚焦蓝色边框。
  const cellBase = 'w-full h-8 bg-transparent border border-transparent rounded-none px-2 text-xs outline-none transition-colors';
  const cellTone = isDarkMode
    ? 'text-slate-100 placeholder:text-slate-500 hover:border-[#3f414b] focus:border-sky-600'
    : 'text-slate-800 placeholder:text-slate-400 hover:border-slate-300 focus:border-sky-600';
  const cellInput = `${cellBase} ${cellTone}`;
  const cellSelect = `${cellBase} ${cellTone} pr-1 cursor-pointer`;
  const line = isDarkMode ? 'border-[#2c2d35]' : 'border-slate-200';
  // 配色与 DLL 命令定义表一致：命令名金黄、类型青色、备注绿、C++ 函数名天蓝以示「源码侧名字」。
  const commandNameColor = isDarkMode ? '#e5c07b' : '#8a6d1a';
  const typeColor = isDarkMode ? '#56b6c2' : '#0e7490';
  const cppNameColor = isDarkMode ? '#7dd3fc' : '#0369a1';
  const noteColor = getLingCppCommentTokenColor(isDarkMode);

  const collapsedKeyOf = (library: LingCppCppSourceLibrary, command: LingCppCppSourceCommand) => `${library.name}::${command.name}`;
  const toggleCollapsed = (key: string) => {
    setCollapsedKeys(previous => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const normalizedSearch = searchText.trim().toLowerCase();
  const matchesSearch = (command: LingCppCppSourceCommand) => {
    if (!normalizedSearch) return true;
    const haystack = [
      command.name,
      command.cppName || '',
      command.remark || '',
      ...command.parameters.flatMap(parameter => [parameter.name, parameter.note || ''])
    ];
    return haystack.some(value => value.toLowerCase().includes(normalizedSearch));
  };

  // 右键菜单动作经 CommandService 命令触发（MenuService 贡献），回调经 ref 保持最新。
  const actionsRef = useRef({ onSearch: () => {}, onExpandAll: () => {}, onCollapseAll: () => {} });
  actionsRef.current = {
    onSearch: () => {
      setCollapsedKeys(new Set());
      const searchInput = document.getElementById('cpp-source-library-search-input') as HTMLInputElement | null;
      searchInput?.focus();
      searchInput?.select();
    },
    onExpandAll: () => setCollapsedKeys(new Set()),
    onCollapseAll: () => setCollapsedKeys(new Set(libraries.flatMap(library => library.commands.map(command => collapsedKeyOf(library, command)))))
  };
  useEffect(() => {
    if (!commandService) return;
    const registration = acquireLingCppCppSourceLibraryEditorCommands(commandService, {
      onSearch: () => actionsRef.current.onSearch(),
      onExpandAll: () => actionsRef.current.onExpandAll(),
      onCollapseAll: () => actionsRef.current.onCollapseAll()
    });
    return () => registration.dispose();
  }, [commandService]);
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('click', close);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('click', close);
    };
  }, [contextMenu]);
  const thCell = `h-7 flex items-center px-2 text-[11px] font-medium ${isDarkMode ? 'text-slate-400 bg-[#1c1d24]' : 'text-slate-500 bg-slate-50'}`;
  const tdCell = 'h-8 flex items-center min-w-0';
  const miniButton = `inline-flex h-6 items-center gap-1 rounded-sm border px-1.5 text-[11px] transition-colors ${isDarkMode ? 'border-transparent text-slate-400 hover:border-[#41434d] hover:bg-[#24262d] hover:text-slate-200' : 'border-transparent text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700'}`;
  const gridStyle = { gridTemplateColumns: GRID_COLUMNS } as const;
  const paramGridStyle = { gridTemplateColumns: PARAM_GRID_COLUMNS } as const;

  const resolveForSerialize = (models: LingCppCppSourceLibrary[]) => models.map((library, index) =>
    index === 0 && !library.name.trim() ? { ...library, name: '示例库' } : library);

  const applyModel = (nextLibraries: LingCppCppSourceLibrary[]) => {
    if (readOnly) return;
    setLibraries(nextLibraries);
    setFeedback('');
    onChange(serializeProjectCppSourceLibraries(packageName, resolveForSerialize(nextLibraries)));
  };

  const updateLibrary = (libraryIndex: number, patch: Partial<Pick<LingCppCppSourceLibrary, 'name' | 'sourceFiles' | 'headerFiles' | 'includeDirs' | 'exceptionCapture' | 'namespaceName'>>) => {
    applyModel(libraries.map((library, index) => index === libraryIndex ? { ...library, ...patch } : library));
  };

  const updateCommand = (libraryIndex: number, commandIndex: number, patch: Partial<LingCppCppSourceCommand>) => {
    applyModel(libraries.map((library, index) => index !== libraryIndex ? library : {
      ...library,
      commands: library.commands.map((command, i) => i === commandIndex ? { ...command, ...patch } : command)
    }));
  };

  const updateParameter = (libraryIndex: number, commandIndex: number, parameterIndex: number, patch: Partial<LingCppParameter>) => {
    updateCommand(libraryIndex, commandIndex, {
      parameters: libraries[libraryIndex].commands[commandIndex].parameters.map((parameter, i) =>
        i === parameterIndex ? { ...parameter, ...patch } : parameter)
    });
  };

  // ===== 类块操作（类名/C++类名/方法/方法参数） =====
  const updateClass = (libraryIndex: number, classIndex: number, patch: Partial<Pick<LingCppCppClass, 'name' | 'cppName'>>) => {
    applyModel(libraries.map((library, index) => index !== libraryIndex ? library : {
      ...library,
      classes: library.classes.map((classItem, i) => i === classIndex ? { ...classItem, ...patch } : classItem)
    }));
  };
  const addClass = () => {
    const targetIndex = libraries.findIndex(matchesAnyCommand);
    const libraryIndex = targetIndex >= 0 ? targetIndex : 0;
    applyModel(libraries.map((library, index) => index !== libraryIndex ? library : {
      ...library,
      classes: [...library.classes, { name: `新类${library.classes.length + 1}`, cppName: '', line: 0, methods: [] }]
    }));
  };
  const removeClass = (libraryIndex: number, classIndex: number) => {
    applyModel(libraries.map((library, index) => index !== libraryIndex ? library : {
      ...library,
      classes: library.classes.filter((_, i) => i !== classIndex)
    }));
  };
  const updateClassMethod = (libraryIndex: number, classIndex: number, methodIndex: number, patch: Partial<LingCppCppClassMethod>) => {
    applyModel(libraries.map((library, index) => index !== libraryIndex ? library : {
      ...library,
      classes: library.classes.map((classItem, i) => i !== classIndex ? classItem : {
        ...classItem,
        methods: classItem.methods.map((method, j) => j === methodIndex ? { ...method, ...patch } : method)
      })
    }));
  };
  const addClassMethod = (libraryIndex: number, classIndex: number) => {
    applyModel(libraries.map((library, index) => index !== libraryIndex ? library : {
      ...library,
      classes: library.classes.map((classItem, i) => i !== classIndex ? classItem : {
        ...classItem,
        methods: [...classItem.methods, {
          name: nextClassMethodName(classItem),
          returnType: '整数型',
          parameters: [],
          cppName: '',
          line: 0
        }]
      })
    }));
  };
  const removeClassMethod = (libraryIndex: number, classIndex: number, methodIndex: number) => {
    applyModel(libraries.map((library, index) => index !== libraryIndex ? library : {
      ...library,
      classes: library.classes.map((classItem, i) => i !== classIndex ? classItem : {
        ...classItem,
        methods: classItem.methods.filter((_, j) => j !== methodIndex)
      })
    }));
  };
  const updateClassMethodParameter = (libraryIndex: number, classIndex: number, methodIndex: number, parameterIndex: number, patch: Partial<LingCppParameter>) => {
    updateClassMethod(libraryIndex, classIndex, methodIndex, {
      parameters: libraries[libraryIndex].classes[classIndex].methods[methodIndex].parameters.map((parameter, i) =>
        i === parameterIndex ? { ...parameter, ...patch } : parameter)
    });
  };

  const addCommand = () => {
    const targetIndex = libraries.findIndex(library => matchesAnyCommand(library));
    const libraryIndex = targetIndex >= 0 ? targetIndex : 0;
    const next = libraries.map((library, index) => index !== libraryIndex ? library : {
      ...library,
      commands: [...library.commands, {
        name: nextCommandName(libraries),
        returnType: '整数型',
        parameters: [],
        cppName: '',
        line: 0
      }]
    });
    setCollapsedKeys(previous => {
      const nextKeys = new Set(previous);
      nextKeys.delete(collapsedKeyOf(next[libraryIndex], next[libraryIndex].commands[next[libraryIndex].commands.length - 1]));
      return nextKeys;
    });
    applyModel(next);
  };

  const matchesAnyCommand = (library: LingCppCppSourceLibrary) => library.commands.some(matchesSearch);

  const removeCommand = (libraryIndex: number, commandIndex: number) => {
    applyModel(libraries.map((library, index) => index !== libraryIndex ? library : {
      ...library,
      commands: library.commands.filter((_, i) => i !== commandIndex)
    }));
  };

  const copyCommand = async (command: LingCppCppSourceCommand) => {
    try {
      await copyTextWithFallback(serializeCppSourceCommandSnippet(command));
      setFeedback('已复制命令声明，可在其他库或项目粘贴。');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '复制失败。');
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await readClipboardText();
      const { libraries: parsedLibraries, bare } = parseCppSourceDeclarationSnippet(text);
      if (parsedLibraries.length === 0) {
        setFeedback('剪贴板里没有识别到 C++ 源码命令声明。');
        return;
      }
      if (bare) {
        const targetIndex = libraries.findIndex(matchesAnyCommand);
        const libraryIndex = targetIndex >= 0 ? targetIndex : 0;
        applyModel(libraries.map((library, index) => index !== libraryIndex ? library : {
          ...library,
          commands: [...library.commands, ...parsedLibraries[0].commands]
        }));
      } else {
        applyModel([...libraries.filter(library => library.commands.length > 0 || library.name.trim()), ...parsedLibraries]);
      }
      setFeedback('已粘贴命令声明。');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '粘贴失败。');
    }
  };

  const importHeaderDeclarations = () => {
    const commands = parseCppHeaderDeclarations(headerText);
    if (commands.length === 0) {
      setFeedback('没有从头文件解析出受支持的声明。仅支持 白名单类型 的全局函数；模板/类/复杂签名请手写声明。');
      return;
    }
    const targetIndex = libraries.findIndex(matchesAnyCommand);
    const libraryIndex = targetIndex >= 0 ? targetIndex : 0;
    const existing = new Set(libraries[libraryIndex].commands.map(command => command.cppName || command.name));
    const fresh = commands.filter(command => !existing.has(command.cppName));
    applyModel(libraries.map((library, index) => index !== libraryIndex ? library : {
      ...library,
      commands: [...library.commands, ...fresh]
    }));
    setFeedback(`已从头文件导入 ${fresh.length} 条声明初稿（跳过 ${commands.length - fresh.length} 条重复/不支持项）；请逐条核对函数名与参数。`);
    setHeaderText('');
    setShowHeaderImport(false);
  };

  const errorTexts = diagnostics.map(diagnostic => `${filePath.split('/').pop() || ''} 第 ${diagnostic.line} 行：${diagnostic.message} ${diagnostic.suggestion}`);
  const visibleLibraries = libraries.map(library => ({
    library,
    commands: library.commands.map((command, index) => ({ command, index })).filter(({ command }) => matchesSearch(command))
  }));
  const totalCommands = libraries.reduce((total, library) => total + library.commands.length, 0);
  const matchedCount = visibleLibraries.reduce((total, item) => total + item.commands.length, 0);

  return (
    <div
      className={`h-full overflow-auto p-3 text-xs font-sans ${isDarkMode ? 'bg-[#141519] text-slate-200' : 'bg-slate-50 text-slate-800'}`}
      onContextMenu={event => {
        if (!commandService) return;
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <div className={`flex flex-wrap items-center gap-2 rounded border px-3 py-2 mb-3 ${surface}`}>
        <span className="text-sm font-medium">C++ 源码库</span>
        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>把别人写好的 .h/.cpp 声明为中文命令，源码直接并入生成的工程一起编译（无需先编译成 DLL）。</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
            <input
              id="cpp-source-library-search-input"
              className={`${input} pl-7 pr-6 w-52`}
              value={searchText}
              placeholder="搜索命令名 / 函数名 / 备注"
              onChange={event => setSearchText(event.target.value)}
            />
            {searchText && (
              <button className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100" title="清除搜索"
                onClick={() => setSearchText('')}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button className={button} disabled={readOnly} onClick={addCommand}><Plus className="h-3.5 w-3.5" />添加命令</button>
          <button className={button} disabled={readOnly} onClick={() => { setShowHeaderImport(value => !value); }}><FileUp className="h-3.5 w-3.5" />从 .h 导入</button>
          <button className={button} disabled={readOnly} onClick={() => { void pasteFromClipboard(); }}><ClipboardPaste className="h-3.5 w-3.5" />粘贴声明</button>
        </div>
      </div>

      {showHeaderImport && (
        <div className={`rounded border p-2 mb-3 ${surface}`}>
          <div className="flex items-center gap-2 mb-1.5">
            <span>粘贴 C++ 头文件内容（.h），自动解析白名单类型 的全局函数为声明初稿：</span>
            <button className={`${button} ml-auto`} disabled={readOnly || !headerText.trim()} onClick={importHeaderDeclarations}>解析并追加</button>
            <button className={button} onClick={() => { setShowHeaderImport(false); setHeaderText(''); }}>取消</button>
          </div>
          <textarea
            className={`w-full h-28 rounded border p-2 font-mono text-xs outline-none ${isDarkMode ? 'border-[#3b3d46] bg-[#101116] text-slate-100' : 'border-slate-300 bg-white'}`}
            value={headerText}
            placeholder={'int add(int a, int b);\nconst wchar_t* greet(const wchar_t* name);'}
            onChange={event => setHeaderText(event.target.value)}
          />
        </div>
      )}

      {visibleLibraries.map(({ library, commands }, libraryIndex) => (
        <div key={libraryIndex} className={`rounded border p-3 mb-3 ${surface}`}>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>库</span>
            <input className={`${input} w-40`} style={{ color: commandNameColor }} value={library.name} readOnly={readOnly}
              placeholder="库名，如 数学库"
              onChange={event => updateLibrary(libraryIndex, { name: event.target.value })} />
            <span className={`ml-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>源码（相对项目源码根）</span>
          </div>
          {library.sourceFiles.map((file, fileIndex) => (
            <div key={`src-${fileIndex}`} className="flex items-center gap-1.5 mb-1.5">
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>源码 =</span>
              <input className={`${input} w-72`} value={file.relativePath} readOnly={readOnly} placeholder="cpp/mymath.cpp"
                onChange={event => updateLibrary(libraryIndex, {
                  sourceFiles: library.sourceFiles.map((item, i) => i === fileIndex ? { ...item, relativePath: event.target.value.trim() } : item)
                })} />
              <button className={miniButton} disabled={readOnly} title="删除该源码文件"
                onClick={() => updateLibrary(libraryIndex, { sourceFiles: library.sourceFiles.filter((_, i) => i !== fileIndex) })}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button className={miniButton} disabled={readOnly}
            onClick={() => updateLibrary(libraryIndex, {
              sourceFiles: [...library.sourceFiles, { relativePath: `cpp/${(library.name.trim() || '示例').toLowerCase()}.cpp`, line: 0 }]
            })}>
            <Plus className="h-3 w-3" />添加源码文件
          </button>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>头文件（可选，缺省自动生成期望签名）</span>
          </div>
          {library.headerFiles.map((file, fileIndex) => (
            <div key={`hdr-${fileIndex}`} className="flex items-center gap-1.5 mt-1.5">
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>头文件 =</span>
              <input className={`${input} w-72`} value={file.relativePath} readOnly={readOnly} placeholder="cpp/mymath.h"
                onChange={event => updateLibrary(libraryIndex, {
                  headerFiles: library.headerFiles.map((item, i) => i === fileIndex ? { ...item, relativePath: event.target.value.trim() } : item)
                })} />
              <button className={miniButton} disabled={readOnly} title="删除该头文件"
                onClick={() => updateLibrary(libraryIndex, { headerFiles: library.headerFiles.filter((_, i) => i !== fileIndex) })}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button className={miniButton} disabled={readOnly}
            onClick={() => updateLibrary(libraryIndex, {
              headerFiles: [...library.headerFiles, { relativePath: `cpp/${(library.name.trim() || '示例').toLowerCase()}.h`, line: 0 }]
            })}>
            <Plus className="h-3 w-3" />添加头文件
          </button>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>命名空间（仅函数命令）</span>
            <input className={`${input} w-40`} value={library.namespaceName || ''} readOnly={readOnly} placeholder="留空表示全局命名空间"
              title="命名空间 = xxx：C++ 函数位于该命名空间，生成头自动发全局转发函数；类块不支持命名空间"
              onChange={event => updateLibrary(libraryIndex, { namespaceName: event.target.value.trim() || undefined })} />
            <label className={`ml-auto inline-flex items-center gap-1 text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
              title="异常 = 捕获：本库全部命令经 try/catch 包装，异常文本经「库名_取错误()」读取；未捕获时返回确定性零值">
              <input type="checkbox" checked={library.exceptionCapture === true} disabled={readOnly}
                onChange={event => updateLibrary(libraryIndex, { exceptionCapture: event.target.checked || undefined })} />
              异常 = 捕获
            </label>
          </div>
          {library.includeDirs.map((file, fileIndex) => (
            <div key={`inc-${fileIndex}`} className="flex items-center gap-1.5 mt-1.5">
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>包含目录 =</span>
              <input className={`${input} w-72`} value={file.relativePath} readOnly={readOnly} placeholder="cpp/third_party"
                onChange={event => updateLibrary(libraryIndex, {
                  includeDirs: library.includeDirs.map((item, i) => i === fileIndex ? { ...item, relativePath: event.target.value.trim() } : item)
                })} />
              <button className={miniButton} disabled={readOnly} title="删除该包含目录"
                onClick={() => updateLibrary(libraryIndex, { includeDirs: library.includeDirs.filter((_, i) => i !== fileIndex) })}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button className={miniButton} disabled={readOnly}
            onClick={() => updateLibrary(libraryIndex, {
              includeDirs: [...library.includeDirs, { relativePath: 'cpp/third_party', line: 0 }]
            })}>
            <Plus className="h-3 w-3" />添加包含目录
          </button>

          {/* ===== 类块：类 中文 = CppClass + 方法表（合成 类名_创建/销毁/方法 命令） ===== */}
          {library.classes.map((classItem, classIndex) => (
            <div key={`class-${classIndex}`} className={`rounded border mt-3 p-2 ${isDarkMode ? 'border-[#3b3d46]' : 'border-slate-300'}`}>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>类</span>
                <input className={`${input} w-32`} style={{ color: commandNameColor }} value={classItem.name} readOnly={readOnly}
                  onChange={event => updateClass(libraryIndex, classIndex, { name: event.target.value })} />
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>=</span>
                <input className={`${input} w-40`} style={{ color: cppNameColor }} value={classItem.cppName} readOnly={readOnly} placeholder="Counter"
                  title="C++ 侧类名（英文标识符）；类定义必须来自本库声明的头文件"
                  onChange={event => updateClass(libraryIndex, classIndex, { cppName: event.target.value.trim() })} />
                <button className={`${miniButton} ml-auto`} disabled={readOnly} title="删除此类"
                  onClick={() => removeClass(libraryIndex, classIndex)}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className={`grid border-t pt-1 ${line}`} style={gridStyle}>
                <div className={thCell}>方法名</div>
                <div className={`${thCell} border-l ${line}`}>返回类型</div>
                <div className={`${thCell} border-l ${line}`}>C++ 方法名</div>
                <div className={`${thCell} border-l ${line}`}>备注</div>
                <div className={`${thCell} border-l ${line}`} />
              </div>
              {classItem.methods.map((method, methodIndex) => (
                <div key={methodIndex} className={`rounded border my-1.5 ${isDarkMode ? 'border-[#2c2d35]' : 'border-slate-200'}`}>
                  <div className={`grid ${line}`} style={gridStyle}>
                    <div className={tdCell}>
                      <input className={cellInput} style={{ color: commandNameColor }} value={method.name} readOnly={readOnly}
                        title="「创建」「销毁」为保留名：分别发射 new/delete；其余方法合成 类名_方法名 命令（首参自动为对象句柄）"
                        onChange={event => updateClassMethod(libraryIndex, classIndex, methodIndex, { name: event.target.value })} />
                    </div>
                    <div className={`${tdCell} border-l ${line}`}>
                      <select className={cellSelect} style={{ color: typeColor }} value={method.returnType} disabled={readOnly}
                        onChange={event => updateClassMethod(libraryIndex, classIndex, methodIndex, { returnType: event.target.value })}>
                        {RETURN_TYPES.map(item => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                    <div className={`${tdCell} border-l ${line}`}>
                      <input className={cellInput} style={{ color: cppNameColor }} value={method.cppName || ''} readOnly={readOnly}
                        placeholder={method.name === '创建' || method.name === '销毁' ? '保留名，无需填写' : 'get_value'}
                        onChange={event => updateClassMethod(libraryIndex, classIndex, methodIndex, { cppName: event.target.value.trim() || undefined })} />
                    </div>
                    <div className={`${tdCell} border-l ${line}`}>
                      <input className={cellInput} style={{ color: noteColor }} value={method.remark || ''} readOnly={readOnly} placeholder="选填"
                        onChange={event => updateClassMethod(libraryIndex, classIndex, methodIndex, { remark: event.target.value || undefined })} />
                    </div>
                    <div className={`${tdCell} border-l ${line} justify-center`}>
                      <button className={miniButton} disabled={readOnly} title="删除此方法"
                        onClick={() => removeClassMethod(libraryIndex, classIndex, methodIndex)}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className={`grid border-t ${line}`} style={paramGridStyle}>
                    <div className={thCell}>参数名</div>
                    <div className={`${thCell} border-l ${line}`}>类型</div>
                    <div className={`${thCell} border-l ${line} justify-center`}>传址</div>
                    <div className={`${thCell} border-l ${line}`}>备注/签名</div>
                    <div className={`${thCell} border-l ${line}`} />
                  </div>
                  {method.parameters.map((parameter, parameterIndex) => (
                    <div key={parameterIndex} className={`grid border-t ${line}`} style={paramGridStyle}>
                      <div className={tdCell}>
                        <input className={cellInput} value={parameter.name} readOnly={readOnly}
                          onChange={event => updateClassMethodParameter(libraryIndex, classIndex, methodIndex, parameterIndex, { name: event.target.value })} />
                      </div>
                      <div className={`${tdCell} border-l ${line}`}>
                        <select className={cellSelect} style={{ color: typeColor }} value={parameter.type} disabled={readOnly}
                          onChange={event => updateClassMethodParameter(libraryIndex, classIndex, methodIndex, parameterIndex, { type: event.target.value })}>
                          {PARAMETER_TYPES.map(item => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </div>
                      <div className={`${tdCell} border-l ${line} justify-center`}>
                        <input type="checkbox" checked={parameter.byRef === true} disabled={readOnly || parameter.type === '处理器'}
                          onChange={event => updateClassMethodParameter(libraryIndex, classIndex, methodIndex, parameterIndex, { byRef: event.target.checked })} />
                      </div>
                      <div className={`${tdCell} border-l ${line}`}>
                        {parameter.type === '处理器' ? (
                          <input className={cellInput} style={{ color: cppNameColor }} value={serializeHandlerSignatureText(parameter.handlerSignatureParameters, parameter.handlerReturnType)} readOnly={readOnly}
                            placeholder="整数型 已下载, 整数型 总大小 回传 逻辑型"
                            title="回调签名（可带 `回传 类型` 指定返回，缺省为空）：C++ 侧收 std::function<...>；.lcpp 调用时传 &子程序名"
                            onChange={event => updateClassMethodParameter(libraryIndex, classIndex, methodIndex, parameterIndex, (() => {
                              const parsed = parseHandlerSignatureText(event.target.value);
                              return { handlerSignatureParameters: parsed.parameters, handlerReturnType: parsed.returnType };
                            })())} />
                        ) : (
                          <input className={cellInput} style={{ color: noteColor }} value={parameter.note || ''} readOnly={readOnly} placeholder="选填"
                            onChange={event => updateClassMethodParameter(libraryIndex, classIndex, methodIndex, parameterIndex, { note: event.target.value || undefined })} />
                        )}
                      </div>
                      <div className={`${tdCell} justify-center`}>
                        <button className={miniButton} disabled={readOnly} title="删除参数"
                          onClick={() => updateClassMethod(libraryIndex, classIndex, methodIndex, { parameters: method.parameters.filter((_, i) => i !== parameterIndex) })}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className={`flex h-9 items-center border-t px-2 ${line}`}>
                    <button className={miniButton} disabled={readOnly}
                      onClick={() => updateClassMethod(libraryIndex, classIndex, methodIndex, { parameters: [...method.parameters, { name: `参数${method.parameters.length + 1}`, type: '整数型' }] })}>
                      <Plus className="h-3 w-3" />添加参数
                    </button>
                  </div>
                </div>
              ))}
              <button className={miniButton} disabled={readOnly}
                onClick={() => addClassMethod(libraryIndex, classIndex)}>
                <Plus className="h-3 w-3" />添加方法
              </button>
            </div>
          ))}
          <button className={miniButton} disabled={readOnly} onClick={addClass} title="类块：合成 类名_创建/销毁/方法 命令，句柄=长整数型">
            <Plus className="h-3 w-3" />添加类
          </button>

          <div className={`grid border-t mt-3 pt-1 ${line}`} style={gridStyle}>
            <div className={thCell}>命令名</div>
            <div className={`${thCell} border-l ${line}`}>返回类型</div>
            <div className={`${thCell} border-l ${line}`}>C++ 函数名</div>
            <div className={`${thCell} border-l ${line}`}>备注</div>
            <div className={`${thCell} border-l ${line}`} />
          </div>
          {commands.map(({ command, index: commandIndex }) => {
            const isCollapsed = collapsedKeys.has(collapsedKeyOf(library, command));
            return (
              <div key={`${libraryIndex}-${commandIndex}`} className={`rounded border mb-2 ${isDarkMode ? 'border-[#2c2d35]' : 'border-slate-200'}`}>
                <div className={`grid ${line}`} style={gridStyle}>
                  <div className={tdCell}>
                    <button type="button" className="px-1 opacity-70 hover:opacity-100" title={isCollapsed ? '展开' : '折叠'}
                      onClick={() => toggleCollapsed(collapsedKeyOf(library, command))}>
                      {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    <input className={cellInput} style={{ color: commandNameColor }} value={command.name} readOnly={readOnly}
                      onChange={event => updateCommand(libraryIndex, commandIndex, { name: event.target.value })} />
                  </div>
                  <div className={`${tdCell} border-l ${line}`}>
                    <select className={cellSelect} style={{ color: typeColor }} value={command.returnType} disabled={readOnly}
                      onChange={event => updateCommand(libraryIndex, commandIndex, { returnType: event.target.value })}>
                      {RETURN_TYPES.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className={`${tdCell} border-l ${line}`}>
                    <input className={cellInput} style={{ color: cppNameColor }} value={command.cppName} readOnly={readOnly}
                      placeholder="add"
                      title="源码里的全局 C++ 函数名（英文标识符），必填"
                      onChange={event => updateCommand(libraryIndex, commandIndex, { cppName: event.target.value.trim() })} />
                  </div>
                  <div className={`${tdCell} border-l ${line}`}>
                    {!isCollapsed ? (
                      <input className={cellInput} style={{ color: noteColor }} value={command.remark || ''} readOnly={readOnly}
                        placeholder="选填"
                        onChange={event => updateCommand(libraryIndex, commandIndex, { remark: event.target.value || undefined })} />
                    ) : (
                      <span className="px-2 opacity-60 truncate">{command.remark || ''} {command.parameters.length > 0 ? `${command.parameters.length} 参数` : ''}</span>
                    )}
                  </div>
                  <div className={`${tdCell} border-l ${line} justify-center`}>
                    <button className={miniButton} disabled={readOnly} title="删除此命令"
                      onClick={() => removeCommand(libraryIndex, commandIndex)}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {!isCollapsed && (<>
                  <div className={`grid border-t ${line}`} style={paramGridStyle}>
                    <div className={thCell}>参数名</div>
                    <div className={`${thCell} border-l ${line}`}>类型</div>
                    <div className={`${thCell} border-l ${line} justify-center`}>传址</div>
                    <div className={`${thCell} border-l ${line}`}>备注</div>
                    <div className={`${thCell} border-l ${line}`} />
                  </div>
                  {command.parameters.map((parameter, parameterIndex) => (
                    <div key={parameterIndex} className={`grid border-t ${line}`} style={paramGridStyle}>
                      <div className={tdCell}>
                        <input className={cellInput} value={parameter.name} readOnly={readOnly}
                          onChange={event => updateParameter(libraryIndex, commandIndex, parameterIndex, { name: event.target.value })} />
                      </div>
                      <div className={`${tdCell} border-l ${line}`}>
                        <select className={cellSelect} style={{ color: typeColor }} value={parameter.type} disabled={readOnly}
                          onChange={event => updateParameter(libraryIndex, commandIndex, parameterIndex, { type: event.target.value })}>
                          {PARAMETER_TYPES.map(item => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </div>
                      <div className={`${tdCell} border-l ${line} justify-center`}>
                        <input type="checkbox" checked={parameter.byRef === true} disabled={readOnly || parameter.type === '处理器'}
                          title="传址：C++ 侧写指针形参（如 int*），调用端自动传 &变量（文本型/字节集/处理器不支持）"
                          onChange={event => updateParameter(libraryIndex, commandIndex, parameterIndex, { byRef: event.target.checked })} />
                      </div>
                      <div className={`${tdCell} border-l ${line}`}>
                        {parameter.type === '处理器' ? (
                          <input className={cellInput} style={{ color: cppNameColor }} value={serializeHandlerSignatureText(parameter.handlerSignatureParameters, parameter.handlerReturnType)} readOnly={readOnly}
                            placeholder="整数型 已下载, 整数型 总大小 回传 逻辑型"
                            title="回调签名（可带 `回传 类型` 指定返回，缺省为空）：C++ 侧收 std::function<...>；.lcpp 调用时传 &子程序名"
                            onChange={event => updateParameter(libraryIndex, commandIndex, parameterIndex, (() => {
                              const parsed = parseHandlerSignatureText(event.target.value);
                              return { handlerSignatureParameters: parsed.parameters, handlerReturnType: parsed.returnType };
                            })())} />
                        ) : (
                          <input className={cellInput} style={{ color: noteColor }} value={parameter.note || ''} readOnly={readOnly}
                            placeholder="选填"
                            onChange={event => updateParameter(libraryIndex, commandIndex, parameterIndex, { note: event.target.value || undefined })} />
                        )}
                      </div>
                      <div className={`${tdCell} justify-center`}>
                        <button className={miniButton} disabled={readOnly} title="删除参数"
                          onClick={() => updateCommand(libraryIndex, commandIndex, { parameters: command.parameters.filter((_, i) => i !== parameterIndex) })}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {command.parameters.length === 0 && (
                    <div className={`grid border-t ${line}`} style={paramGridStyle}>
                      <div className="flex h-8 items-center px-2 opacity-50 col-span-5">无参数</div>
                    </div>
                  )}
                  <div className={`flex h-9 items-center justify-between border-t px-2 ${line}`}>
                    <button className={miniButton} disabled={readOnly}
                      onClick={() => updateCommand(libraryIndex, commandIndex, { parameters: [...command.parameters, { name: `参数${command.parameters.length + 1}`, type: '整数型' }] })}>
                      <Plus className="h-3 w-3" />添加参数
                    </button>
                    <div className="ml-auto flex gap-1.5">
                      <button className={miniButton} disabled={readOnly} onClick={() => { void copyCommand(command); }}>
                        <Copy className="h-3 w-3" />复制此命令
                      </button>
                      <button className={miniButton} disabled={readOnly} onClick={() => removeCommand(libraryIndex, commandIndex)}>
                        <Trash2 className="h-3 w-3" />删除此命令
                      </button>
                    </div>
                  </div>
                </>)}
              </div>
            );
          })}
        </div>
      ))}

      {(totalCommands === 0 || (normalizedSearch && matchedCount === 0)) && (
        <div className={`rounded border p-4 text-xs ${surface}`}>
          {normalizedSearch
            ? `没有匹配「${searchText.trim()}」的命令；可点击上方搜索框右侧 × 清除搜索。`
            : '暂无命令。先在库头写「源码 =」指向项目里的 .cpp 文件，再点「添加命令」创建声明，或从 .h 头文件导入、粘贴其他项目复制来的声明片段。'}
        </div>
      )}

      {(errorTexts.length > 0 || feedback) && (
        <div className={`rounded border p-2 text-xs ${errorTexts.length ? 'border-red-500/60 text-red-400' : isDarkMode ? 'border-[#3b3d46] text-slate-300' : 'border-slate-300 text-slate-600'}`}>
          {errorTexts.length ? errorTexts.map((message, index) => <div key={index}>✗ {message}</div>) : feedback}
        </div>
      )}

      <div className="text-xs opacity-60">
        声明文件：{PROJECT_CPP_SOURCE_LIBRARY_FILE_NAME}（保存在项目源码目录，源码文件一并随项目复制与分享）。右键可搜索、展开或折叠全部命令。
      </div>

      {contextMenu && commandService && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} onContextMenu={event => { event.preventDefault(); setContextMenu(null); }} />
          {(() => {
            const items = getMenuService(commandService).resolveMenu(
              LINGCPP_CPP_SOURCE_LIBRARY_CONTEXT_MENU,
              CPP_SOURCE_LIBRARY_EDITOR_MENU_CONTEXT,
              { includeDisabled: true }
            );
            const left = Math.min(contextMenu.x, window.innerWidth - 220);
            const top = Math.min(contextMenu.y, window.innerHeight - 130);
            return (
              <div
                style={{ top: `${top}px`, left: `${left}px` }}
                className={`fixed z-[9999] min-w-[190px] py-1 rounded shadow-lg border text-xs select-none font-sans ${
                  isDarkMode ? 'bg-[#252526] border-[#454545] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {items.map(item => item.kind === 'separator' ? (
                  <div key={item.id} className="h-[1px] bg-slate-700/20 my-1" />
                ) : item.kind === 'command' ? (
                  <div
                    key={item.id}
                    className={`px-3 py-1.5 cursor-pointer transition-colors flex items-center gap-2 ${
                      item.command.enabled ? 'hover:bg-blue-500 hover:text-white' : 'cursor-not-allowed opacity-40'
                    }`}
                    onClick={event => {
                      event.stopPropagation();
                      // 三个视图命令都以 when: 'workspace.open' 注册，执行时必须传同一份上下文，
                      // 否则按空上下文判定「不可用」抛错且被 void 吞掉，表现为点了没反应。
                      if (item.command.enabled) {
                        void commandService
                          .executeCommand(item.command.id, CPP_SOURCE_LIBRARY_EDITOR_MENU_CONTEXT)
                          .catch(error => setFeedback(error instanceof Error ? error.message : '命令执行失败。'));
                      }
                      setContextMenu(null);
                    }}
                  >
                    <span>{item.command.title}</span>
                  </div>
                ) : null)}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
