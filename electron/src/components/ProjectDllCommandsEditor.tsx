import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardPaste, Copy, FileUp, Plus, Search, Trash2, X } from 'lucide-react';
import type { CommandService } from '../services/commands/commandService';
import type { CommandContext } from '../services/commands/types';
import { getMenuService } from '../services/menus/menuService';
import { LINGCPP_DLL_COMMANDS_CONTEXT_MENU } from '../services/menus/types';
import {
  acquireLingCppDllCommandsEditorCommands
} from '../services/lingCpp/dllCommandsEditorCommands';
import {
  PROJECT_DLL_COMMANDS_FILE_NAME,
  getProjectDllCommandsDiagnostics,
  parseDllDeclarationSnippet,
  parseDllHeaderDeclarations,
  serializeDllCommandSnippet,
  serializeProjectDllCommandLibraries
} from '../services/lingCpp/projectDllCommandService';
import { parseLingCpp } from '../services/lingCpp/parser';
import { getLingCppCommentTokenColor } from '../services/lingCpp/semanticTheme';
import {
  LingCppDllArchitectureFile,
  LingCppDllCommand,
  LingCppDllLibrary,
  LingCppParameter
} from '../services/lingCpp/types';

interface ProjectDllCommandsEditorProps {
  sourceCode: string;
  filePath: string;
  isDarkMode: boolean;
  readOnly?: boolean;
  /** 提供后启用右键菜单（搜索/展开所有/折叠所有）；缺省时右键无菜单。 */
  commandService?: CommandService;
  onChange: (sourceCode: string) => void;
}

const RETURN_TYPES = ['整数型', '长整数型', '小数型', '逻辑型', '字节型', '文本型', '空'];
const PARAMETER_TYPES = ['整数型', '长整数型', '小数型', '逻辑型', '字节型', '文本型'];

const PLACEHOLDER_ARCH_FILES: LingCppDllArchitectureFile[] = [
  { arch: 'Win32', relativePath: 'dll/Win32/示例.dll', line: 0 },
  { arch: 'x64', relativePath: 'dll/x64/示例.dll', line: 0 }
];

/** 易语言 DLL 命令定义表式统一网格：命令名 / 类型 / 传址 / 备注 / 行操作列。 */
const GRID_COLUMNS = '176px 136px 52px minmax(200px, 1fr) 34px';

function packageNameOf(sourceCode: string): string {
  const match = sourceCode.match(/^包\s+(.+)$/mu);
  return match?.[1]?.trim() || '项目DLL命令';
}

/**
 * 编辑器右键菜单解析与命令执行共用的上下文。
 * 三个视图命令注册时声明了 when: 'workspace.open'，解析菜单和 executeCommand 必须用同一份上下文，
 * 否则会出现「菜单项可用、点下去却按不可用抛错」的不一致。
 */
const DLL_COMMANDS_EDITOR_MENU_CONTEXT: CommandContext = { 'workspace.open': true };

/** 新建库时的架构 DLL 占位路径：按库名生成，避免所有新库都写「示例.dll」。 */
function archFilesForLibrary(name: string): LingCppDllArchitectureFile[] {
  const label = name.trim() || '示例';
  return [
    { arch: 'Win32', relativePath: `dll/Win32/${label}.dll`, line: 0 },
    { arch: 'x64', relativePath: `dll/x64/${label}.dll`, line: 0 }
  ];
}

function createEmptyLibrary(): LingCppDllLibrary {
  return {
    name: '',
    line: 0,
    archFiles: PLACEHOLDER_ARCH_FILES.map(file => ({ ...file })),
    commands: [],
    structs: [],
    sdkHeaders: []
  };
}

/** 「添加命令」的占位命令名：取全文件不冲突的 `新命令N`，避免空名序列化成解析器不认的死行。 */
function nextCommandName(libraries: LingCppDllLibrary[]): string {
  const used = new Set(libraries.flatMap(library => library.commands.map(command => command.name)));
  let index = 1;
  while (used.has(`新命令${index}`)) index += 1;
  return `新命令${index}`;
}

function parseLibraries(sourceCode: string): LingCppDllLibrary[] {
  const libraries = parseLingCpp(sourceCode).program.dllLibraries || [];
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
  throw new Error('无法读取剪贴板，请先在其他项目里复制 DLL 命令声明。');
}

export default function ProjectDllCommandsEditor(props: ProjectDllCommandsEditorProps) {
  const { sourceCode, filePath, isDarkMode, readOnly, commandService, onChange } = props;
  const diagnostics = useMemo(() => getProjectDllCommandsDiagnostics(sourceCode, filePath), [sourceCode, filePath]);

  const [libraries, setLibraries] = useState<LingCppDllLibrary[]>(() => parseLibraries(sourceCode));
  const [feedback, setFeedback] = useState('');
  const [headerText, setHeaderText] = useState('');
  const [showHeaderImport, setShowHeaderImport] = useState(false);
  /** 折叠的命令卡片（key = 库名::命令名，库内命令名唯一）。 */
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  /** 卡片「库文件名」的输入草稿（onBlur/回车时提交移动）。 */
  const [libraryDrafts, setLibraryDrafts] = useState<Record<string, string>>({});
  /** 「添加命令」后待定位的卡片（库索引::命令索引），渲染完成后滚动并聚焦命令名。 */
  const [focusRequest, setFocusRequest] = useState<string | null>(null);

  const packageName = packageNameOf(sourceCode);
  const header = libraries[0];

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
  // 易语言 DLL 命令定义表配色：命令名/库文件名金黄，类型青色，备注用新手模式备注绿，参数名保持默认白。
  const commandNameColor = isDarkMode ? '#e5c07b' : '#8a6d1a';
  const typeColor = isDarkMode ? '#56b6c2' : '#0e7490';
  const noteColor = getLingCppCommentTokenColor(isDarkMode);

  const collapsedKeyOf = (library: LingCppDllLibrary, command: LingCppDllCommand) => `${library.name}::${command.name}`;
  const toggleCollapsed = (key: string) => {
    setCollapsedKeys(previous => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const normalizedSearch = searchText.trim().toLowerCase();
  const matchesSearch = (command: LingCppDllCommand) => {
    if (!normalizedSearch) return true;
    const haystack = [
      command.name,
      command.exportName || '',
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
      const searchInput = document.getElementById('dll-commands-search-input') as HTMLInputElement | null;
      searchInput?.focus();
      searchInput?.select();
    },
    onExpandAll: () => setCollapsedKeys(new Set()),
    onCollapseAll: () => setCollapsedKeys(new Set(libraries.flatMap(library => library.commands.map(command => collapsedKeyOf(library, command)))))
  };
  useEffect(() => {
    if (!commandService) return;
    const registration = acquireLingCppDllCommandsEditorCommands(commandService, {
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
  const rowLabel = `shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`;
  const miniButton = `inline-flex h-6 items-center gap-1 rounded-sm border px-1.5 text-[11px] transition-colors ${isDarkMode ? 'border-transparent text-slate-400 hover:border-[#41434d] hover:bg-[#24262d] hover:text-slate-200' : 'border-transparent text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700'}`;
  const gridStyle = { gridTemplateColumns: GRID_COLUMNS } as const;

  const resolveForSerialize = (models: LingCppDllLibrary[]) => models.map((library, index) =>
    index === 0 && !library.name.trim() ? { ...library, name: '示例DLL' } : library);

  const applyModel = (nextLibraries: LingCppDllLibrary[]) => {
    if (readOnly) return;
    setLibraries(nextLibraries);
    setFeedback('');
    onChange(serializeProjectDllCommandLibraries(packageName, resolveForSerialize(nextLibraries)));
  };

  const updateHeader = (patch: Partial<Pick<LingCppDllLibrary, 'name' | 'isSystem' | 'memoryLoad' | 'archFiles'>>) => {
    applyModel(libraries.map((library, index) => index === 0 ? { ...library, ...patch } : library));
  };

  /** 卡片「库文件名」编辑：把该命令移动到目标库（库名不存在时自动新建库），对齐易语言「每条命令自带库文件名」的体验。 */
  const moveCommandToLibrary = (libraryIndex: number, commandIndex: number, targetName: string) => {
    const trimmed = targetName.trim();
    if (!trimmed || trimmed === libraries[libraryIndex]?.name) return;
    const next = libraries.map(library => ({ ...library, archFiles: [...library.archFiles], commands: [...library.commands] }));
    const [moved] = next[libraryIndex].commands.splice(commandIndex, 1);
    if (!moved) return;
    let targetIndex = next.findIndex(library => library.name === trimmed);
    if (targetIndex < 0) {
      next.splice(libraryIndex + 1, 0, { name: trimmed, line: 0, archFiles: archFilesForLibrary(trimmed), commands: [], structs: [], sdkHeaders: [] });
      targetIndex = libraryIndex + 1;
    }
    next[targetIndex].commands.push({ ...moved, line: next[targetIndex].commands.length + 1 });
    if (next[libraryIndex].commands.length === 0 && next.length > 1) next.splice(libraryIndex, 1);
    applyModel(next);
  };

  const updateCommand = (libraryIndex: number, commandIndex: number, patch: Partial<LingCppDllCommand>) => {
    applyModel(libraries.map((library, index) => {
      if (index !== libraryIndex) return library;
      return { ...library, commands: library.commands.map((command, i) => i === commandIndex ? { ...command, ...patch } : command) };
    }));
  };

  const updateParameter = (libraryIndex: number, commandIndex: number, parameterIndex: number, patch: Partial<LingCppParameter>) => {
    applyModel(libraries.map((library, index) => {
      if (index !== libraryIndex) return library;
      return {
        ...library,
        commands: library.commands.map((command, i) => {
          if (i !== commandIndex) return command;
          return { ...command, parameters: command.parameters.map((parameter, j) => j === parameterIndex ? { ...parameter, ...patch } : parameter) };
        })
      };
    }));
  };

  const addCommand = () => {
    const command: LingCppDllCommand = {
      name: nextCommandName(libraries),
      returnType: '整数型',
      parameters: [{ name: '参数1', type: '整数型' }],
      callingConvention: 'cdecl',
      line: (header?.commands.length || 0) + 1
    };
    // 搜索中新增的空名命令会被过滤掉，先清空搜索保证新卡片可见。
    setSearchText('');
    setFocusRequest(`0::${header?.commands.length || 0}`);
    applyModel(libraries.map((library, index) => index === 0 ? { ...library, commands: [...library.commands, command] } : library));
  };

  useEffect(() => {
    if (!focusRequest) return;
    setFocusRequest(null);
    const card = document.querySelector(`[data-dll-command-card="${focusRequest}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const nameInput = card.querySelector('[data-dll-command-name-input]') as HTMLInputElement | null;
    nameInput?.focus({ preventScroll: true });
  }, [focusRequest]);

  const removeCommand = (libraryIndex: number, commandIndex: number) => {
    applyModel(libraries.map((library, index) => {
      if (index !== libraryIndex) return library;
      return { ...library, commands: library.commands.filter((_, i) => i !== commandIndex) };
    }));
  };

  const importHeader = () => {
    const imported = parseDllHeaderDeclarations(headerText);
    if (imported.length === 0) {
      setFeedback('未在头文件文本中识别到可导入的导出声明（需 extern "C" 风格：返回类型 函数名(参数列表);）。');
      return;
    }
    applyModel(libraries.map((library, index) => index === 0 ? { ...library, commands: imported } : library));
    setFeedback(`已从头文件导入 ${imported.length} 条声明，请核对参数与返回类型。`);
  };

  const copyCommand = async (command: LingCppDllCommand) => {
    const text = serializeDllCommandSnippet(command);
    try {
      await copyTextWithFallback(text);
      setFeedback(`已复制命令「${command.name}」的声明行，粘贴到其他项目的 ${PROJECT_DLL_COMMANDS_FILE_NAME} 时会并入当前 DLL 命令库。`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '复制失败，请重试。');
    }
  };

  const copyAll = async () => {
    const text = serializeProjectDllCommandLibraries(packageName, resolveForSerialize(libraries));
    try {
      await copyTextWithFallback(text);
      setFeedback(`已复制全部 DLL 命令声明（${libraries.reduce((sum, library) => sum + library.commands.length, 0)} 条命令）。`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '复制失败，请重试。');
    }
  };

  const pasteDeclaration = async () => {
    let text = '';
    try {
      text = await readClipboardText();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '无法读取剪贴板。');
      return;
    }
    if (!text.trim()) {
      setFeedback('剪贴板为空，没有可粘贴的 DLL 命令声明。');
      return;
    }
    const parsedSnippet = parseDllDeclarationSnippet(text);
    if (parsedSnippet.libraries.length === 0) {
      setFeedback('剪贴板内容中没有识别到 DLL 命令声明：支持「DLL命令库 … 结束DLL命令库」整库片段，也支持「复制此命令」产出的单条声明行。');
      return;
    }
    const next = libraries.map(library => ({ ...library, archFiles: [...library.archFiles], commands: [...library.commands] }));
    // 裸声明片段不带库信息：改写成当前第一个库的名字，让命令并入现有库而不是凭空多出一个临时库。
    const incoming = parsedSnippet.bare
      ? [{ ...parsedSnippet.libraries[0], name: next[0]?.name || '示例DLL' }]
      : parsedSnippet.libraries;
    const droppedStructCount = parsedSnippet.bare ? parsedSnippet.libraries[0].structs.length : 0;
    const added: string[] = [];
    const skipped: string[] = [];
    const newLibraries: string[] = [];
    incoming.forEach(incomingLibrary => {
      const target = next.find(library => library.name === incomingLibrary.name);
      if (target) {
        incomingLibrary.commands.forEach(command => {
          if (!command.name || target.commands.some(existing => existing.name === command.name)) {
            skipped.push(command.name || '未命名命令');
            return;
          }
          target.commands.push({ ...command, line: target.commands.length + 1 });
          added.push(command.name);
        });
        return;
      }
      const commands = incomingLibrary.commands
        .filter(command => {
          const duplicated = next.some(library => library.commands.some(existing => existing.name === command.name));
          if (duplicated) {
            skipped.push(command.name);
            return false;
          }
          added.push(command.name);
          return true;
        })
        .map((command, index) => ({ ...command, line: index + 1 }));
      if (commands.length === 0) return;
      const libraryToAdd: LingCppDllLibrary = { ...incomingLibrary, archFiles: [...incomingLibrary.archFiles], commands };
      const placeholderIndex = next.findIndex(library => !library.name.trim() && library.commands.length === 0);
      if (placeholderIndex >= 0) next[placeholderIndex] = libraryToAdd;
      else next.push(libraryToAdd);
      newLibraries.push(incomingLibrary.name);
    });
    if (added.length === 0 && newLibraries.length === 0) {
      setFeedback(`没有新增命令：${skipped.join('、')} 与现有命令重名，已跳过。`);
      return;
    }
    applyModel(next);
    const parts = [`已粘贴 ${added.length} 条命令`];
    if (newLibraries.length) parts.push(`新增命令库：${newLibraries.join('、')}`);
    if (skipped.length) parts.push(`跳过重复命令：${skipped.join('、')}`);
    if (droppedStructCount) parts.push(`裸片段中的 ${droppedStructCount} 个结构体未粘贴，请改用「复制全部声明」整库粘贴`);
    setFeedback(`${parts.join('；')}。`);
  };

  const errorTexts = diagnostics.filter(item => item.level === 'error').map(item => item.message);
  const totalCommands = libraries.reduce((sum, library) => sum + library.commands.length, 0);
  const visibleEntries = libraries.flatMap((library, libraryIndex) =>
    library.commands
      .map((command, commandIndex) => ({ library, libraryIndex, command, commandIndex }))
      .filter(entry => matchesSearch(entry.command)));
  const matchedCount = visibleEntries.length;
  const archEditorFiles = header && header.isSystem !== true
    ? (header.archFiles.length > 0 ? header.archFiles : PLACEHOLDER_ARCH_FILES)
    : [];

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-auto p-4"
      style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
      onContextMenu={event => {
        if (readOnly || !commandService) return;
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <div className={`rounded border p-3 text-xs leading-5 ${surface}`}>
        <div className={`font-semibold ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>项目 DLL 命令声明</div>
        <div className="mt-1 opacity-80">
          声明项目自带 DLL 的导出函数为中文命令（无需封装 .lbmod 模块）。DLL 文件按相对路径放在项目内，
          构建时自动生成导入库并把 DLL 复制到 exe 同目录。命令名可用中文，导出函数名可留空表示与命令名一致。
        </div>
        <div className={`mt-1 ${isDarkMode ? 'text-sky-300' : 'text-sky-700'}`}>
          勾选「内存加载」后：DLL 会以资源内嵌进 EXE，运行期手工映射到内存（不落盘、exe 旁不再出现该 DLL），
          需要在「项目模块」里启用「内存加载DLL模块」；DLL 必须与目标位数一致且不得加壳。
        </div>
      </div>

      <div className={`rounded border p-3 text-xs ${surface}`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span>DLL 文件名（不含 .dll，即声明库标识）</span>
            <input className={`w-56 ${input}`} value={header?.name || ''} readOnly={readOnly}
              title="这里是整个库的名字：改名后本库全部命令下方的「库文件名」一起更新，其它库不受影响；只改某条命令的所属库请改那一条的「库文件名」"
              onChange={event => updateHeader({ name: event.target.value.trim() })} placeholder="AdvancedMathDll" />
          </label>
          {archEditorFiles.map(file => (
            <label key={file.arch} className="flex flex-col gap-1">
              <span>{file.arch} DLL 相对路径</span>
              <input className={`w-64 ${input}`} value={file.relativePath} readOnly={readOnly}
                onChange={event => {
                  const base = header && header.archFiles.length > 0 ? header.archFiles : PLACEHOLDER_ARCH_FILES;
                  updateHeader({ archFiles: base.map(item => item.arch === file.arch ? { ...item, relativePath: event.target.value } : item) });
                }}
                placeholder={`dll/${file.arch}/${header?.name || '示例'}.dll`} />
            </label>
          ))}
          <label className="flex items-center gap-2 pb-1">
            <input type="checkbox" checked={header?.isSystem === true} disabled={readOnly}
              onChange={event => updateHeader({ isSystem: event.target.checked || undefined })} />
            <span>系统 DLL（user32/gdi32 等，免分发）</span>
          </label>
          <label className="flex items-center gap-2 pb-1">
            <input type="checkbox" checked={header?.memoryLoad === true} disabled={readOnly || header?.isSystem === true}
              onChange={event => updateHeader({ memoryLoad: event.target.checked || undefined })} />
            <span>内存加载（内嵌进 EXE，不落盘）</span>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className={button} onClick={() => setShowHeaderImport(value => !value)} disabled={readOnly}>
            <FileUp className="h-3.5 w-3.5" /> 从 .h 导入
          </button>
          <button className={button} onClick={addCommand} disabled={readOnly}>
            <Plus className="h-3.5 w-3.5" /> 添加命令
          </button>
          <button className={button} onClick={() => { void copyAll(); }} disabled={readOnly}>
            <Copy className="h-3.5 w-3.5" /> 复制全部声明
          </button>
          <button className={button} onClick={() => { void pasteDeclaration(); }} disabled={readOnly}>
            <ClipboardPaste className="h-3.5 w-3.5" /> 粘贴声明
          </button>
        </div>
        {showHeaderImport && (
          <div className="mt-3">
            <textarea className={`h-24 w-full rounded border p-2 font-mono ${input}`} placeholder='粘贴头文件内容，例如：__declspec(dllimport) int __cdecl demo_add(int a, int b);'
              value={headerText} onChange={event => setHeaderText(event.target.value)} />
            <button className={`${button} mt-2`} onClick={importHeader} disabled={readOnly}>解析并导入</button>
          </div>
        )}
      </div>

      {(header?.structs?.length || 0) > 0 && (
        <div className="space-y-2">
          {(header?.structs || []).map(structItem => (
            <div key={`struct-${structItem.name}`} className={`border p-3 text-xs ${surface}`}>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="min-w-0 font-semibold" style={{ color: typeColor }}>
                  结构体 {structItem.name}{structItem.aliasTypeName ? ` = ${structItem.aliasTypeName}` : ''}
                </span>
                <span className="shrink-0 opacity-60">只读 · 通过文本或 AI 编辑</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                {structItem.fields.map(field => (
                  <div key={field.name} className="flex min-w-0 items-baseline gap-1.5">
                    <span className="shrink-0 whitespace-nowrap font-mono" style={{ color: typeColor }}>{field.type}</span>
                    <span className="shrink-0 whitespace-nowrap" style={{ color: commandNameColor }}>
                      {field.name}{field.arrayLength !== undefined ? `[${field.arrayLength}]` : ''}
                    </span>
                    {field.note && <span className="max-w-[18rem] min-w-0 truncate opacity-60" title={field.note}>{field.note}</span>}
                  </div>
                ))}
              </div>
              <div className="mt-2 opacity-60">
                命令端用法：{structItem.name}_创建() 创建句柄、{structItem.name}_取字段 / _置字段 访问成员、{structItem.name}_销毁() 释放、{structItem.name}_取大小() 供 dwSize 类字段赋值。
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold">
          {normalizedSearch ? `导出命令（匹配 ${matchedCount} / 共 ${totalCommands} 条）` : `导出命令（${totalCommands} 条）`}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 opacity-50" />
          <input
            id="dll-commands-search-input"
            className={`${input} w-56 pl-7 pr-6`}
            value={searchText}
            readOnly={readOnly}
            placeholder="搜索命令名 / 参数 / 备注"
            title="按命令名、导出名、参数名或备注过滤（搜索时全部展开）"
            onChange={event => setSearchText(event.target.value)}
          />
          {searchText && (
            <button type="button" title="清除搜索" className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-white/10"
              onClick={() => setSearchText('')}>
              <X className="h-3 w-3 opacity-60" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {visibleEntries.map(({ library, libraryIndex, command, commandIndex }) => {
          const collapseKey = collapsedKeyOf(library, command);
          const isCollapsed = collapsedKeys.has(collapseKey) && !normalizedSearch;
          return (
            <div key={`block-${libraryIndex}-${commandIndex}`} data-dll-command-card={`${libraryIndex}::${commandIndex}`} className={`border text-xs ${surface}`}>
              <div className={`grid items-center ${line}`} style={gridStyle}>
                <div className={thCell}>Dll命令名</div>
                <div className={`${thCell} border-l ${line}`}>返回值类型</div>
                <div className={`${thCell} border-l ${line} justify-center`}>公开</div>
                <div className={`${thCell} border-l ${line} col-span-2`}
                  title="备注：写入补全与悬停提示，序列化为声明中的「备注:」行">备　注</div>
              </div>
              <div className={`grid items-center border-t ${line}`} style={gridStyle}>
                <div className={tdCell}>
                  <button type="button" className={`mr-0.5 shrink-0 rounded p-0.5 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`}
                    title={isCollapsed ? '展开该命令' : '折叠该命令'}
                    onClick={() => toggleCollapsed(collapseKey)}>
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <input className={cellInput} style={{ color: commandNameColor }} value={command.name} readOnly={readOnly}
                      data-dll-command-name-input=""
                      onChange={event => {
                        const nextName = event.target.value.trim();
                        if (!nextName) {
                          setFeedback('命令名不能为空；要删掉整条命令请用卡片右下「删除此命令」。');
                          return;
                        }
                        updateCommand(libraryIndex, commandIndex, { name: nextName });
                      }}
                      placeholder="如：加法计算" />
                  </div>
                </div>
                <div className={`${tdCell} border-l ${line}`}>
                  <select className={cellSelect} style={{ color: typeColor }} value={command.returnType} disabled={readOnly}
                    onChange={event => updateCommand(libraryIndex, commandIndex, { returnType: event.target.value })}>
                    {RETURN_TYPES.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div className={`${tdCell} border-l ${line} justify-center`}>
                  <input type="checkbox" checked={command.isPublic !== false} disabled={readOnly}
                    title="公开：勾选后该命令对补全与新手编辑器可见"
                    onChange={event => updateCommand(libraryIndex, commandIndex, { isPublic: event.target.checked ? undefined : false })} />
                </div>
                <div className={`${tdCell} border-l ${line} col-span-2 gap-2`}>
                  <div className="min-w-0 flex-1">
                    <input className={cellInput} style={{ color: noteColor }} value={command.remark || ''} readOnly={readOnly}
                      onChange={event => updateCommand(libraryIndex, commandIndex, { remark: event.target.value || undefined })}
                      placeholder="选填" />
                  </div>
                  {isCollapsed && <span className="shrink-0 pr-1 text-[10px] opacity-60">{command.parameters.length} 参数</span>}
                </div>
              </div>
              {!isCollapsed && (<>
              <div className={`flex h-8 items-center gap-2 border-t px-2 ${line}`}>
                <span className={rowLabel}>库文件名:</span>
                {(() => {
                  // 草稿按「行」区分，不能按「库」：同库多条命令共用一个键时，一行的输入会让整库的行一起显示该库名。
                  const draftKey = `${libraryIndex}::${commandIndex}::${command.name}`;
                  const draftValue = libraryDrafts[draftKey] ?? library.name;
                  const commit = () => {
                    const draft = libraryDrafts[draftKey];
                    // 移动会让行下标整体位移，提交后统一清空草稿，避免残留草稿落到别的命令上。
                    setLibraryDrafts({});
                    if (draft !== undefined) moveCommandToLibrary(libraryIndex, commandIndex, draft);
                  };
                  return (
                    <input className={cellInput} style={{ color: commandNameColor, width: 208 }} value={draftValue} readOnly={readOnly}
                      title="输入库名后按回车：该命令移动到对应 DLL 命令库；新库名会自动创建（需补架构 DLL 路径）"
                      onChange={event => setLibraryDrafts(previous => ({ ...previous, [draftKey]: event.target.value }))}
                      onKeyDown={event => { if (event.key === 'Enter') { commit(); } }}
                      onBlur={commit}
                      placeholder="示例DLL" />
                  );
                })()}
                <span className={rowLabel}>.dll</span>
                {library.isSystem === true && (
                  <span className={`rounded-sm border px-1 py-px text-[10px] ${isDarkMode ? 'border-emerald-700/60 text-emerald-400' : 'border-emerald-500 text-emerald-600'}`}>
                    系统 DLL · 免分发
                  </span>
                )}
                {library.memoryLoad === true && library.isSystem !== true && (
                  <span className={`rounded-sm border px-1 py-px text-[10px] ${isDarkMode ? 'border-sky-700/60 text-sky-300' : 'border-sky-500 text-sky-700'}`}>
                    内存加载 · 不落盘
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1">
                  <span className={rowLabel}>调用约定:</span>
                  <select className={`${cellSelect} w-20`} value={command.callingConvention} disabled={readOnly}
                    onChange={event => updateCommand(libraryIndex, commandIndex, { callingConvention: event.target.value as 'cdecl' | 'stdcall' })}>
                    <option value="cdecl">cdecl</option>
                    <option value="stdcall">stdcall</option>
                  </select>
                </span>
              </div>
              <div className={`flex h-8 items-center gap-2 border-t px-2 ${line}`}>
                <span className={rowLabel}>在库中对应命令名:</span>
                <input className={cellInput} style={{ color: commandNameColor }} value={command.exportName || ''} readOnly={readOnly}
                  onChange={event => updateCommand(libraryIndex, commandIndex, { exportName: event.target.value.trim() || undefined })}
                  placeholder="留空 = 与命令名一致" />
              </div>
              <div className={`grid items-center border-t ${line}`} style={gridStyle}>
                <div className={thCell}>参数名</div>
                <div className={`${thCell} border-l ${line}`}>类　型</div>
                <div className={`${thCell} border-l ${line} justify-center`} title="传址：按指针传给 DLL 回填结果（文本型不支持）">传址</div>
                <div className={`${thCell} border-l ${line}`} title="参数备注：补全可见，序列化为 // 备注">备　注</div>
                <div className={thCell} />
              </div>
              {command.parameters.map((parameter, parameterIndex) => (
                <div key={`param-${libraryIndex}-${commandIndex}-${parameterIndex}`}
                  className={`grid items-center border-t ${line}`} style={gridStyle}>
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
                    <input type="checkbox" checked={parameter.byRef === true} disabled={readOnly}
                      title="传址：按指针传给 DLL 回填结果（文本型不支持）"
                      onChange={event => updateParameter(libraryIndex, commandIndex, parameterIndex, { byRef: event.target.checked })} />
                  </div>
                  <div className={`${tdCell} border-l ${line}`}>
                    <input className={cellInput} style={{ color: noteColor }} value={parameter.note || ''} readOnly={readOnly}
                      onChange={event => updateParameter(libraryIndex, commandIndex, parameterIndex, { note: event.target.value || undefined })}
                      placeholder="选填" />
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
                <div className={`grid border-t ${line}`} style={gridStyle}>
                  <div className="flex h-8 items-center px-2 opacity-50 col-span-5">无参数</div>
                </div>
              )}
              </>)}
              <div className={`flex h-9 items-center justify-between border-t px-2 ${line}`}>
                {!isCollapsed && (
                  <button className={miniButton} disabled={readOnly}
                    onClick={() => updateCommand(libraryIndex, commandIndex, { parameters: [...command.parameters, { name: `参数${command.parameters.length + 1}`, type: '整数型' }] })}>
                    <Plus className="h-3 w-3" />添加参数
                  </button>
                )}
                <div className="ml-auto flex gap-1.5">
                  <button className={miniButton} disabled={readOnly} onClick={() => { void copyCommand(command); }}>
                    <Copy className="h-3 w-3" />复制此命令
                  </button>
                  <button className={miniButton} disabled={readOnly} onClick={() => removeCommand(libraryIndex, commandIndex)}>
                    <Trash2 className="h-3 w-3" />删除此命令
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {(totalCommands === 0 || (normalizedSearch && matchedCount === 0)) && (
          <div className={`rounded border p-4 text-xs ${surface}`}>
            {normalizedSearch
              ? `没有匹配「${searchText.trim()}」的命令；可点击上方搜索框右侧 × 清除搜索。`
              : '暂无命令。点击上方「添加命令」创建第一条 DLL 命令声明，或从 .h 头文件导入、粘贴其他项目复制来的声明片段。'}
          </div>
        )}
      </div>

      {(errorTexts.length > 0 || feedback) && (
        <div className={`rounded border p-2 text-xs ${errorTexts.length ? 'border-red-500/60 text-red-400' : isDarkMode ? 'border-[#3b3d46] text-slate-300' : 'border-slate-300 text-slate-600'}`}>
          {errorTexts.length ? errorTexts.map((message, index) => <div key={index}>✗ {message}</div>) : feedback}
        </div>
      )}

      <div className="text-xs opacity-60">
        声明文件：{PROJECT_DLL_COMMANDS_FILE_NAME}（保存在项目源码目录，随项目一起复制与分享）。右键可搜索、展开或折叠全部命令。
      </div>

      {contextMenu && commandService && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} onContextMenu={event => { event.preventDefault(); setContextMenu(null); }} />
          {(() => {
            const items = getMenuService(commandService).resolveMenu(
              LINGCPP_DLL_COMMANDS_CONTEXT_MENU,
              DLL_COMMANDS_EDITOR_MENU_CONTEXT,
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
                      item.command.enabled
                        ? isDarkMode ? 'hover:bg-blue-500 hover:text-white' : 'hover:bg-blue-500 hover:text-white'
                        : 'cursor-not-allowed opacity-40'
                    }`}
                    onClick={event => {
                      event.stopPropagation();
                      // 三个视图命令都以 when: 'workspace.open' 注册，执行时必须传同一份上下文：
                      // 不传会按空上下文判定为「当前上下文中不可用」抛出，被 void 吞掉后表现为点了没反应。
                      if (item.command.enabled) {
                        void commandService
                          .executeCommand(item.command.id, DLL_COMMANDS_EDITOR_MENU_CONTEXT)
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
