import {
  LingCppDllLibrary,
  LingCppDllArchitectureFile,
  LingCppDllCommand,
  LingCppDllStruct,
  LingCppDllStructField,
  LingCppParameter,
  LingCppProjectDllCommandContext,
  LingCppDiagnostic
} from './types';
import { parseLingCpp } from './parser';
import { InstalledModule, LingBuilderModuleManifest, ModuleBindingValueType } from '../modules/types';

/** 项目 DLL 命令声明专用源码文件（与 项目全局变量.lcpp / 项目数据类型.lcpp 同构）。 */
export const PROJECT_DLL_COMMANDS_FILE_NAME = '项目DLL命令.lcpp';

export const PROJECT_DLL_MODULE_ID = 'lingbuilder.project.dll';

export const EMPTY_PROJECT_DLL_COMMANDS_SOURCE = [
  '包 项目DLL命令',
  '',
  '// 本文件用于把项目自带的 DLL 导出函数声明为中文命令（无需封装 .lbmod 模块）。',
  '// 用法：',
  '//   DLL命令库 AdvancedMathDll',
  '//     Win32 = "dll/Win32/AdvancedMathDll.dll"',
  '//     x64 = "dll/x64/AdvancedMathDll.dll"',
  '//     整数型 加法计算(整数型 被加数, 整数型 加数)',
  '//   结束DLL命令库',
  '// 命令名即 DLL 导出函数名；DLL 文件按相对路径放在项目内，构建时自动复制到 exe 旁。',
  '// 需要「内存加载、不向磁盘释放 DLL」时，在库内加一行 `加载方式 = 内存`：',
  '//   DLL 会以资源内嵌进 EXE 并在首次调用时手工映射到内存，exe 旁不再出现该 DLL，',
  '//   代价是必须为项目启用「内存加载DLL模块」（lingbuilder.advanced.memorydll）。'
].join('\n');

export function isProjectDllCommandsFilePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/gu, '/');
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1);
  return fileName.toLocaleLowerCase() === PROJECT_DLL_COMMANDS_FILE_NAME.toLocaleLowerCase();
}

/** 允许跨 DLL 边界的中文类型 → ABI 类型（与模块 binding 口径一致，文本一律指针跨界）。 */
const DLL_BOUNDARY_TYPE_MAP: Record<string, { abi: ModuleBindingValueType; cpp: string }> = {
  '空': { abi: 'void', cpp: 'void' },
  '整数型': { abi: 'int', cpp: 'int' },
  '整数': { abi: 'int', cpp: 'int' },
  '长整数型': { abi: 'longLong', cpp: 'long long' },
  '长整数': { abi: 'longLong', cpp: 'long long' },
  '小数型': { abi: 'double', cpp: 'double' },
  '小数': { abi: 'double', cpp: 'double' },
  '单精度小数型': { abi: 'float', cpp: 'float' },
  '单精度小数': { abi: 'float', cpp: 'float' },
  '逻辑型': { abi: 'bool', cpp: 'bool' },
  '逻辑': { abi: 'bool', cpp: 'bool' },
  '字节型': { abi: 'int', cpp: 'unsigned char' },
  '字节': { abi: 'int', cpp: 'unsigned char' },
  '文本型': { abi: 'wideString', cpp: 'const wchar_t*' },
  '文本': { abi: 'wideString', cpp: 'const wchar_t*' },
  // 指针尺寸整数（uintptr_t）：承接系统 SDK 里 HANDLE/ULONG_PTR/SIZE_T 形参和返回值，
  // 随位数变化，与平台指针同宽，调用端按长整数型句柄交互。
  '指针整数': { abi: 'longLong', cpp: 'uintptr_t' }
};

export function resolveDllBoundaryType(chineseType: string): { abi: ModuleBindingValueType; cpp: string } | undefined {
  return DLL_BOUNDARY_TYPE_MAP[chineseType.trim()];
}

/** 传址形参类型（基类型指针）；文本/空不支持传址，返回 undefined。 */
export function resolveDllBoundaryPointerType(chineseType: string): string | undefined {
  const boundary = resolveDllBoundaryType(chineseType);
  if (!boundary || boundary.cpp === 'void' || boundary.abi === 'wideString') return undefined;
  return `${boundary.cpp}*`;
}

/**
 * 结构体字段支持的类型 → C++ 类型。「指针整数」= uintptr_t（随位数），用于 SDK 结构体里的
 * ULONG_PTR/HANDLE 尺寸字段，保证 Win32 与 x64 布局都正确。
 */
export const DLL_STRUCT_FIELD_TYPE_MAP: Record<string, string> = {
  '整数型': 'int',
  '长整数型': 'long long',
  '小数型': 'double',
  '单精度小数型': 'float',
  '逻辑型': 'bool',
  '字节型': 'unsigned char',
  '指针整数': 'uintptr_t'
};

/** 结构体字段的 C++ 类型；文本型字段必须带定长（wchar_t[N]），未支持类型返回 undefined。 */
export function resolveDllStructFieldCppType(field: LingCppDllStructField): string | undefined {
  if (field.type === '文本型') {
    return field.arrayLength !== undefined && field.arrayLength > 0 ? `wchar_t[${field.arrayLength}]` : undefined;
  }
  return DLL_STRUCT_FIELD_TYPE_MAP[field.type];
}

/** 结构体字段对应的调用端中文类型（自动取/置命令的参数与返回类型）。 */
export function resolveDllStructFieldCallerType(field: LingCppDllStructField): string {
  if (field.type === '文本型') return '文本型';
  if (field.type === '指针整数') return '长整数型';
  return field.type;
}

/** 结构体在库内查找；结构体参数按名引用同库结构体。 */
export function resolveDllLibraryStruct(library: LingCppDllLibrary, typeName: string): LingCppDllStruct | undefined {
  return library.structs.find(item => item.name === typeName);
}

/** 结构体的 C++ 类型名：别名结构体用真实 SDK 类型名，定义结构体用声明名。 */
export function getDllStructCppName(structItem: LingCppDllStruct): string {
  return structItem.aliasTypeName || structItem.name;
}

/** RC 资源号起始段（2001 起为内嵌释放文件、2101 起为内嵌站点文件，2201 起为内存加载的项目 DLL）。 */
export const PROJECT_DLL_MEMORY_RESOURCE_ID_BASE = 2201;

/** 单次构建允许内存加载的 DLL 数量上限（与内嵌释放文件同口径）。 */
export const PROJECT_DLL_MEMORY_LIBRARY_LIMIT = 8;

/** 单个内嵌 DLL 体积上限（32MB，与其它内嵌资源一致）。 */
export const PROJECT_DLL_MEMORY_MAX_FILE_BYTES = 32 * 1024 * 1024;

/** 内嵌 DLL 在构建目录内的归档路径前缀（相对源码根，rc 与资源写入两侧共用）。 */
export const PROJECT_DLL_MEMORY_RESOURCE_DIRECTORY = 'resources';

export interface ProjectDllMemoryLibrarySpec {
  library: LingCppDllLibrary;
  libraryName: string;
  /** RC 资源号：2201 起按声明顺序分配。 */
  resourceId: number;
  /** 内嵌 DLL 在源码目录内的相对路径；各构建只写入当前目标架构的字节。 */
  resourceFileName: string;
}

/** 声明顺序即资源号顺序：rc 行、资源写入与生成代码三方共用同一份映射。 */
export function getProjectDllMemoryLibrarySpecs(dllLibraries: LingCppDllLibrary[]): ProjectDllMemoryLibrarySpec[] {
  return dllLibraries
    .filter(library => library.memoryLoad === true && library.isSystem !== true && library.commands.length > 0)
    .slice(0, PROJECT_DLL_MEMORY_LIBRARY_LIMIT)
    .map((library, index) => ({
      library,
      libraryName: library.name,
      resourceId: PROJECT_DLL_MEMORY_RESOURCE_ID_BASE + index,
      resourceFileName: `${PROJECT_DLL_MEMORY_RESOURCE_DIRECTORY}/lingbuilder-project-dll-${index + 1}.dll`
    }));
}

/**
 * 内嵌 DLL 的 rc 行：先 `#define` 再引用，资源号才会以数字登记（与窗口图标/内嵌释放文件同口径），
 * 生成代码用 `FindResourceW(MAKEINTRESOURCEW(资源号))` 按数字取回；路径相对 rc 所在目录。
 */
export function buildProjectDllMemoryResourceLines(specs: ProjectDllMemoryLibrarySpec[]): string[] {
  return specs.flatMap(spec => {
    const symbol = `ID_RCDATA_LINGBUILDER_PROJECT_DLL_${spec.resourceId}`;
    // rc 字符串里反斜杠是转义符：必须双写，否则路径里的 \l 之类会被解析成转义序列。
    const relative = spec.resourceFileName.replace(/\//gu, '\\\\');
    return [
      `#define ${symbol} ${spec.resourceId}`,
      `${symbol} RCDATA "${relative}"`
    ];
  });
}

/** 从项目源码集合中识别声明文件并合成虚拟模块；无声明文件时返回 undefined。 */
export function createProjectDllDeclarationModuleFromSources(
  sources: Array<{ filePath: string; sourceCode: string }>,
  projectId: string
): InstalledModule | undefined {
  const source = sources.find(item => isProjectDllCommandsFilePath(item.filePath));
  if (!source || !source.sourceCode.trim()) return undefined;
  const parsed = parseLingCpp(source.sourceCode);
  return createProjectDllDeclarationModule(parsed.program.dllLibraries || [], projectId);
}

export function createProjectDllCommandContext(filePath: string, sourceCode: string): LingCppProjectDllCommandContext {
  const parsed = parseLingCpp(sourceCode);
  return {
    filePath,
    sourceCode,
    dllLibraries: parsed.program.dllLibraries || []
  };
}

/** 声明文件守卫诊断：类型越界、缺架构、DLL 路径约定；解析错误已随 program.diagnostics 上抛。 */
export function getProjectDllCommandsDiagnostics(sourceCode: string, filePath: string): LingCppDiagnostic[] {
  const parsed = parseLingCpp(sourceCode);
  const diagnostics: LingCppDiagnostic[] = [];
  const sourceLines = sourceCode.split(/\r?\n/);
  let diagnosticSequence = 0;
  const push = (line: number, message: string, suggestion: string) => {
    diagnosticSequence += 1;
    diagnostics.push({
      id: `project-dll-${line}-${diagnosticSequence}`,
      line,
      level: 'error',
      message,
      codeSnippet: (sourceLines[line - 1] || '').trim(),
      suggestion
    });
  };
  const memoryLibraries = parsed.program.dllLibraries.filter(library => library.memoryLoad === true);
  if (memoryLibraries.length > PROJECT_DLL_MEMORY_LIBRARY_LIMIT) {
    diagnosticSequence += 1;
    const overflow = memoryLibraries[PROJECT_DLL_MEMORY_LIBRARY_LIMIT];
    diagnostics.push({
      id: `project-dll-${overflow.line}-${diagnosticSequence}`,
      line: overflow.line,
      level: 'error',
      message: `内存加载的 DLL 命令库最多 ${PROJECT_DLL_MEMORY_LIBRARY_LIMIT} 个，当前有 ${memoryLibraries.length} 个。`,
      codeSnippet: overflow.name,
      suggestion: '请把部分 DLL命令库 改为默认的「同目录加载」，或拆分为多个项目。'
    });
  }
  // 结构体全局查重：访问器命令名按「结构名_字段」生成，跨库重名会互相冲突。
  const seenStructNames = new Map<string, string>();
  parsed.program.dllLibraries.forEach(library => {
    library.structs.forEach(structItem => {
      const owner = seenStructNames.get(structItem.name);
      if (owner) {
        diagnostics.push({
          id: `project-dll-${structItem.line}-${diagnosticSequence += 1}`,
          line: structItem.line,
          level: 'error',
          message: `结构体 ${structItem.name} 与「${owner}」库中的结构体重名。`,
          codeSnippet: structItem.name,
          suggestion: '结构体名必须在整个声明文件内唯一（自动生成的创建/取/置命令依赖它命名）。'
        });
        return;
      }
      seenStructNames.set(structItem.name, library.name);
    });
  });
  parsed.program.dllLibraries.forEach(library => {
    // 结构体校验：字段类型白名单、文本型定长、别名结构体不需要字段布局校验之外的东西。
    library.structs.forEach(structItem => {
      if (structItem.fields.length === 0) {
        diagnostics.push({
          id: `project-dll-${structItem.line}-${diagnosticSequence += 1}`,
          line: structItem.line,
          level: 'error',
          message: `结构体 ${structItem.name} 没有任何字段。`,
          codeSnippet: structItem.name,
          suggestion: '请在 结构体 与 结束结构体 之间声明字段，例如 `整数型 dwSize`。'
        });
      }
      structItem.fields.forEach(field => {
        const cppType = resolveDllStructFieldCppType(field);
        if (!cppType) {
          diagnostics.push({
            id: `project-dll-${field.line}-${diagnosticSequence += 1}`,
            line: field.line,
            level: 'error',
            message: `结构体 ${structItem.name} 的字段「${field.name}」类型「${field.type}」不支持。`,
            codeSnippet: field.name,
            suggestion: field.type === '文本型'
              ? '文本型字段必须声明定长，例如 `文本型 szExeFile[260]`。'
              : '字段仅支持：整数型、长整数型、小数型、单精度小数型、逻辑型、字节型、指针整数、文本型[定长]。'
          });
        }
      });
    });
    // 系统 DLL（user32/kernel32 等）链接系统导入库，不需要架构文件映射，豁免缺架构诊断。
    if (!library.isSystem && !library.archFiles.length) {
      diagnosticSequence += 1;
      diagnostics.push({
        id: `project-dll-${library.line}-${diagnosticSequence}`,
        line: library.line,
        level: 'error',
        message: `DLL命令库 ${library.name} 未声明任何架构 DLL 文件。`,
        codeSnippet: library.name,
        suggestion: library.memoryLoad
          ? '内存加载同样需要 DLL 字节来源，请添加 `Win32 = "dll/Win32/xxx.dll"` 与 `x64 = "dll/x64/xxx.dll"`。'
          : '请添加 `Win32 = "dll/Win32/xxx.dll"` 与 `x64 = "dll/x64/xxx.dll"`。'
      });
    }
    if (library.memoryLoad && library.isSystem) {
      diagnosticSequence += 1;
      diagnostics.push({
        id: `project-dll-${library.line}-${diagnosticSequence}`,
        line: library.line,
        level: 'error',
        message: `DLL命令库 ${library.name} 同时声明了「系统 = 真」与「加载方式 = 内存」。`,
        codeSnippet: library.name,
        suggestion: '系统 DLL 由 Windows 从系统目录加载，无需内存加载；请删除其中一行。'
      });
    }
    if (library.isSystem) {
      // 系统 DLL 只按 Windows SDK 头文件里的真实符号生成声明；命令名不是可用的 C 标识符时
      // 必须用「= 真实导出名」指定要调用的系统函数，否则生成的 C++ 会直接报「找不到标识符」。
      // 普通 DLL / 内存加载的 DLL 不受此限：它们可以真的导出中文名（构建期导出表校验兜底）。
      library.commands.forEach(command => {
        if (command.exportName) return;
        if (isUsableSystemSymbolName(command.name)) return;
        push(
          command.line,
          `系统 DLL 命令「${command.name}」缺少真实导出名。`,
          `系统 DLL 不会凭空生成声明，请写成「整数型 ${command.name}(参数...) = 真实导出函数名」，例如 = GetSystemMetrics 或 = MessageBeep。`
        );
      });
    }
    library.commands.forEach(command => {
      const returnStruct = resolveDllLibraryStruct(library, command.returnType);
      if (returnStruct) {
        push(command.line, `DLL 命令 ${command.name} 的返回类型不能是结构体「${returnStruct.name}」。`, '结构体参数按句柄交互，返回类型请改用句柄（长整数型）或标量类型。');
      } else {
        const returnType = resolveDllBoundaryType(command.returnType);
        if (!returnType) push(command.line, `DLL 命令 ${command.name} 的返回类型「${command.returnType}」不能跨 DLL 边界。`, '仅支持：空、整数型、长整数型、小数型、单精度小数型、逻辑型、字节型、文本型。');
      }
      command.parameters.forEach(parameter => {
        const parameterStruct = resolveDllLibraryStruct(library, parameter.type);
        if (parameterStruct) {
          if (parameter.byRef) {
            push(command.line, `DLL 命令 ${command.name} 的结构体参数「${parameter.name}」按指针传递，无需勾选传址。`, '请取消该参数的传址勾选；结构体本身以指针形式传给 DLL。');
          }
          if (library.isSystem && !parameterStruct.aliasTypeName) {
            push(command.line, `系统 DLL 命令 ${command.name} 的结构体参数「${parameter.name}」使用了自定义结构体 ${parameterStruct.name}。`, `系统函数原型使用 SDK 真实类型，请把结构体声明改为别名写法：\`结构体 ${parameterStruct.name} = 真实SDK类型名\`（例如 = WPROCESSENTRY32W），并用「头文件 = tlhelp32.h」引入所需头文件。`);
          }
          return;
        }
        if (!resolveDllBoundaryType(parameter.type)) {
          push(command.line, `DLL 命令 ${command.name} 的参数「${parameter.name}」类型「${parameter.type}」不能跨 DLL 边界。`, '仅支持：整数型、长整数型、小数型、单精度小数型、逻辑型、字节型、文本型，或本库声明的结构体。');
          return;
        }
        if (parameter.byRef && resolveDllBoundaryPointerType(parameter.type) === undefined) {
          push(command.line, `DLL 命令 ${command.name} 的传址参数「${parameter.name}」类型「${parameter.type}」不支持传址。`, '仅整数型、长整数型、小数型、单精度小数型、逻辑型、字节型支持传址；文本型请改为返回值或整数句柄。');
        }
      });
    });
  });
  return diagnostics;
}

const toCommandParameters = (library: LingCppDllLibrary, parameters: LingCppParameter[]) => parameters.map(parameter => {
  const parameterStruct = resolveDllLibraryStruct(library, parameter.type);
  if (parameterStruct) {
    // 结构体参数：调用端传长整数型句柄，生成 C++ 时调用点自动加 `(结构名 *)` 强转。
    return {
      name: parameter.name,
      type: 'longLong' as ModuleBindingValueType,
      description: parameter.note || `结构体 ${parameterStruct.name} 句柄（由 ${parameterStruct.name}_创建 创建）。`,
      cppStructName: parameterStruct.name
    };
  }
  const boundary = resolveDllBoundaryType(parameter.type);
  return {
    name: parameter.name,
    type: (boundary?.abi || 'raw') as ModuleBindingValueType,
    description: parameter.note || 'DLL 导出参数。',
    byRef: parameter.byRef === true ? true : undefined
  };
});

/** 结构体自动命令的调用端中文类型 → ABI 类型（全部落在既有边界映射内）。 */
const toStructAccessorAbi = (callerType: string): ModuleBindingValueType =>
  resolveDllBoundaryType(callerType)?.abi || 'longLong';

/**
 * 由结构体声明生成自动命令：`结构名_创建` / `结构名_销毁` / `结构名_取大小` 与每字段一对
 * `结构名_取字段` / `结构名_置字段`。调用端以长整数型句柄持有结构体，字段访问全部命令化，
 * 不扩展 .lcpp 表达式语言。
 */
const buildProjectDllStructAccessorCommands = (structItem: LingCppDllStruct) => {
  const prefix = `${structItem.name}_`;
  const commands: Array<{
    name: string;
    signature: string;
    description: string;
    insertText: string;
    returnType: string;
    category: '其他';
    visibility: 'default';
  }> = [
    {
      name: `${prefix}创建`,
      signature: `${prefix}创建()`,
      description: `创建一个零初始化的 ${structItem.name} 结构体并返回句柄；用完请调用 ${prefix}销毁 释放。`,
      insertText: `${prefix}创建()`,
      returnType: '长整数型',
      category: '其他',
      visibility: 'default'
    },
    {
      name: `${prefix}销毁`,
      signature: `${prefix}销毁(句柄)`,
      description: `释放 ${prefix}创建 返回的 ${structItem.name} 结构体内存。`,
      insertText: `${prefix}销毁()`,
      returnType: '空',
      category: '其他',
      visibility: 'default'
    },
    {
      name: `${prefix}取大小`,
      signature: `${prefix}取大小()`,
      description: `返回 ${structItem.name} 的字节大小；SDK 结构体请在调用前把 dwSize 类字段置为该值。`,
      insertText: `${prefix}取大小()`,
      returnType: '长整数型',
      category: '其他',
      visibility: 'default'
    }
  ];
  const bindings: Array<{
    command: string;
    runtimeName: string;
    parameters: Array<{ name: string; type: ModuleBindingValueType; description?: string; cppStructName?: string }>;
    returnType: ModuleBindingValueType;
    encoding: 'wide';
    example: string;
  }> = [
    { command: `${prefix}创建`, runtimeName: `${prefix}创建`, parameters: [], returnType: 'longLong', encoding: 'wide', example: `${prefix}创建()` },
    { command: `${prefix}销毁`, runtimeName: `${prefix}销毁`, parameters: [{ name: '句柄', type: 'longLong' }], returnType: 'void', encoding: 'wide', example: `${prefix}销毁(句柄)` },
    { command: `${prefix}取大小`, runtimeName: `${prefix}取大小`, parameters: [], returnType: 'longLong', encoding: 'wide', example: `${prefix}取大小()` }
  ];
  structItem.fields.forEach(field => {
    const callerType = resolveDllStructFieldCallerType(field);
    const fieldNote = field.note ? `（${field.note}）` : '';
    commands.push({
      name: `${prefix}取${field.name}`,
      signature: `${prefix}取${field.name}(句柄)`,
      description: `读取 ${structItem.name} 的 ${field.name} 字段${fieldNote}。`,
      insertText: `${prefix}取${field.name}()`,
      returnType: callerType,
      category: '其他',
      visibility: 'default'
    });
    commands.push({
      name: `${prefix}置${field.name}`,
      signature: `${prefix}置${field.name}(句柄, 值)`,
      description: `写入 ${structItem.name} 的 ${field.name} 字段${fieldNote}。`,
      insertText: `${prefix}置${field.name}()`,
      returnType: '空',
      category: '其他',
      visibility: 'default'
    });
    bindings.push({
      command: `${prefix}取${field.name}`,
      runtimeName: `${prefix}取${field.name}`,
      parameters: [{ name: '句柄', type: 'longLong' }],
      returnType: toStructAccessorAbi(callerType),
      encoding: 'wide',
      example: `${prefix}取${field.name}(句柄)`
    });
    bindings.push({
      command: `${prefix}置${field.name}`,
      runtimeName: `${prefix}置${field.name}`,
      parameters: [
        { name: '句柄', type: 'longLong' },
        { name: '值', type: toStructAccessorAbi(callerType) }
      ],
      returnType: 'void',
      encoding: 'wide',
      example: `${prefix}置${field.name}(句柄, 值)`
    });
  });
  return { commands, bindings };
};

/**
 * 由项目 DLL 命令声明合成虚拟模块（lingbuilder.project.dll）。
 * 注入 enabledModules 后，诊断/补全/C++ 生成/构建物化自动复用模块链路；
 * targets 里的 include/lib 路径指向构建期生成到 `modules/<id>/` 布局的文件。
 */
export function createProjectDllDeclarationModule(dllLibraries: LingCppDllLibrary[], projectId: string): InstalledModule | undefined {
  const libraries = dllLibraries.filter(library => library.commands.length > 0);
  if (libraries.length === 0) return undefined;
  const structAccessorItems = libraries.flatMap(library => library.structs.map(buildProjectDllStructAccessorCommands));
  // 英文导出名登记为别名：敲 HalfF 能筛出「半值」，上屏仍是中文主名（非中文别名按补全目录规则
  // 只作检索键、不单独成条），生成 C++ 仍走 binding 的真实导出名。别名与任何命令名或其它别名
  // 冲突时不登记——同一模块内名称与别名必须唯一，否则清单校验与跳转都会歧义。
  const declaredNames = new Set<string>([
    ...libraries.flatMap(library => library.commands.map(command => command.name)),
    ...structAccessorItems.flatMap(item => item.commands.map(command => command.name))
  ]);
  const usedAliases = new Set<string>();
  const exportAliasOf = (command: LingCppDllCommand): string[] | undefined => {
    const alias = command.exportName?.trim();
    if (!alias || alias === command.name || declaredNames.has(alias) || usedAliases.has(alias)) return undefined;
    usedAliases.add(alias);
    return [alias];
  };
  const manifest: LingBuilderModuleManifest = {
    schemaVersion: 2,
    id: PROJECT_DLL_MODULE_ID,
    name: '项目 DLL 命令',
    version: '1.0.0',
    category: '其他',
    description: '由项目「DLL 命令」声明合成的项目级模块：中文命令直连项目自带 DLL 的导出函数。',
    author: 'LingBuilder',
    tags: ['项目声明', 'DLL'],
    contributes: {
      commands: [
        ...libraries.flatMap(library => library.commands.map(command => ({
          name: command.name,
          aliases: exportAliasOf(command),
          signature: `${command.name}(${command.parameters.map(parameter => parameter.name).join(', ')})`,
          description: command.remark || `调用 DLL「${library.name}」的导出函数${command.exportName ? `（${command.exportName}）` : ''}。`,
          insertText: `${command.name}(${command.parameters.map(parameter => parameter.name).join(', ')})`,
          returnType: command.returnType,
          category: '其他' as const,
          visibility: 'default' as const
        }))),
        ...structAccessorItems.flatMap(item => item.commands)
      ]
    },
    targets: ['Win32', 'x64'].map(arch => ({
      id: arch === 'Win32' ? 'windows-msvc-win32' : 'windows-msvc-x64',
      platform: 'windows' as const,
      arch: (arch === 'Win32' ? 'win32' : 'x64') as 'win32' | 'x64',
      toolchain: 'msvc' as const,
      includeDirs: ['include'],
      headers: ['include/ProjectDllCommands.h'],
      // 内存加载的库不生成导入库、也不把 DLL 复制到 exe 旁：字节以 RCDATA 内嵌，运行时手工映射。
      libs: libraries.filter(lib => !lib.isSystem && !lib.memoryLoad).flatMap(lib =>
        lib.archFiles.filter(f => (f.arch === 'x64' ? 'x64' : 'Win32') === arch).map(f => `lib/${arch}/${lib.name}.lib`)),
      runtimeFiles: libraries.filter(lib => !lib.memoryLoad).flatMap(library => library.archFiles
        .filter(file => file.arch === arch)
        .map(file => file.relativePath))
    })),
    bindings: {
      commands: [
        ...libraries.flatMap(library => library.commands.map(command => {
          const boundaryReturn = resolveDllBoundaryType(command.returnType);
          return {
            command: command.name,
            runtimeName: command.exportName || command.name,
            parameters: toCommandParameters(library, command.parameters),
            returnType: boundaryReturn?.abi || 'void',
            encoding: 'wide' as const,
            example: `${command.name}(${command.parameters.map(parameter => parameter.name).join(', ')})`
          };
        })),
        ...structAccessorItems.flatMap(item => item.bindings)
      ]
    }
  };
  return {
    manifest,
    installPath: `__project_dll__/${projectId}`,
    isBuiltin: false,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
}

/** C++ 字符串字面量转义：库名/导出名会被写进生成头文件，必须转义反斜杠与引号。 */
function escapeHeaderStringLiteral(value: string): string {
  return value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"').replace(/\r?\n/gu, ' ');
}

/**
 * 系统 DLL 命令名是否可能对应 Windows SDK 里已有的 C 符号。
 * 只放行纯 ASCII 标识符（如 GetCurrentProcessId）：中文等非 ASCII 名字在 SDK 里不存在，
 * 没有 `= 导出名` 时生成的头文件不会声明任何符号，生成的调用必然 C3861。
 */
export function isUsableSystemSymbolName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name);
}

/**
 * 系统 DLL 中「无别名且命令名不是 C 标识符」的命令：生成前必须阻断，不能交给编译器报 C3861。
 * 为什么只针对系统 DLL：系统 DLL 的声明一律来自 Windows SDK 头文件里的真实符号，中文命令名
 * 在 SDK 里不存在；而普通 DLL / 内存加载的 DLL 完全可能导出中文名（中文项目导出的 DLL 就是这样），
 * 它们的导出名存在性由构建期的导出表校验负责，不能在这里误判。
 */
export function collectProjectDllMissingSystemAliasDiagnostics(dllLibraries: LingCppDllLibrary[]): string[] {
  return dllLibraries
    .filter(library => library.isSystem === true)
    .flatMap(library => library.commands
      .filter(command => !command.exportName && !isUsableSystemSymbolName(command.name))
      .map(command => `第 ${command.line} 行：系统 DLL 命令「${command.name}」缺少真实导出名；请写成「整数型 ${command.name}(参数...) = 真实导出函数名」（例如 = GetSystemMetrics），否则生成的 C++ 找不到标识符。`));
}

/** 命令参数的 C++ 形参类型：结构体参数 → `结构名*`；传址 → 基类型指针；普通 → 边界类型。 */
function getDllCommandParameterCppType(library: LingCppDllLibrary, parameter: LingCppParameter): string {
  const parameterStruct = resolveDllLibraryStruct(library, parameter.type);
  if (parameterStruct) return `${getDllStructCppName(parameterStruct)}*`;
  if (parameter.byRef) return resolveDllBoundaryPointerType(parameter.type) || 'void*';
  const base = resolveDllBoundaryType(parameter.type);
  return `${base?.cpp || 'void*'}`;
}

/**
 * 系统 DLL 命令是否需要「按导出名 GetProcAddress 解析」的内联包装：
 * 结构体参数或指针整数（uintptr_t）参数时，SDK 原型的真实类型名不可直接匹配
 * （long long/uintptr_t → HANDLE 无隐式转换），改用声明即真相的函数指针签名调用。
 * 返回 指针整数 的命令同样走包装：uintptr_t 返回值赋给调用端长整数型变量才是合法转换。
 */
function usesRuntimeResolvedSignature(library: LingCppDllLibrary, command: LingCppDllCommand): boolean {
  if (!library.isSystem) return false;
  if (resolveDllBoundaryType(command.returnType)?.cpp === 'uintptr_t') return true;
  return command.parameters.some(parameter =>
    resolveDllLibraryStruct(library, parameter.type) !== undefined || parameter.type === '指针整数');
}

/** 声明命令的 C++ 声明头（构建期写入 modules/lingbuilder.project.dll/include/）。 */
export function generateProjectDllDeclarationHeader(dllLibraries: LingCppDllLibrary[]): string {
  const sdkHeaders = [...new Set(dllLibraries.flatMap(library => library.sdkHeaders || []))];
  const aliasStructs = dllLibraries.flatMap(library => library.structs.filter(structItem => structItem.aliasTypeName));
  const definedStructs = dllLibraries.flatMap(library => library.structs.filter(structItem => !structItem.aliasTypeName));
  const lines: string[] = [
    '// 由 LingBuilder 项目 DLL 命令声明自动生成：中文命令 → DLL 导出函数（extern "C"）。',
    '// 文本参数/返回一律使用指针（const wchar_t*），不要让 std::wstring 跨 DLL 边界。',
    '// 结构体参数按指针传递：调用端以长整数型句柄持有结构体，创建/销毁/取/置命令在文件底部。',
    '#pragma once',
    '#include <cstdint>',
    '#include <cstdlib>',
    '#include <cwchar>',
    ...sdkHeaders.map(header => `#include <${header}>`),
    ''
  ];
  // 定义结构体：字段布局按声明生成，须与 DLL 侧约定逐字节一致。
  definedStructs.forEach(structItem => {
    lines.push(`typedef struct ${structItem.name} {`);
    structItem.fields.forEach(field => {
      const note = field.note ? ` // ${field.note}` : '';
      lines.push(`    ${resolveDllStructFieldCppType(field) || 'unsigned char'} ${field.name};${note}`);
    });
    lines.push(`} ${structItem.name};`);
    lines.push('');
  });
  // 别名结构体：C++ 侧直接使用 SDK 真实类型（类型由 SDK 头文件提供）。
  // 生成头会被 main.cpp 以 extern "C" 包裹引入，必须用 C 兼容的 typedef 而非 using。
  if (aliasStructs.length > 0) {
    aliasStructs.forEach(structItem => {
      lines.push(`typedef ${structItem.aliasTypeName} ${structItem.name};`);
    });
    lines.push('');
  }
  lines.push('#ifdef __cplusplus', 'extern "C" {', '#endif', '');
  dllLibraries.forEach(library => {
    if (library.commands.length === 0 || library.memoryLoad) return;
    lines.push(`// ${library.name}${library.isSystem ? '（系统 DLL）' : ''}`);
    library.commands.forEach(command => {
      const boundaryReturn = resolveDllBoundaryType(command.returnType);
      const parameters = command.parameters.map(parameter => `${getDllCommandParameterCppType(library, parameter)} ${parameter.name}`);
      const parameterText = parameters.join(', ');
      const convention = command.callingConvention === 'stdcall' ? '__stdcall' : '__cdecl';
      if (command.remark) lines.push(`// ${command.remark}`);
      if (library.isSystem && !command.exportName) {
        if (usesRuntimeResolvedSignature(library, command)) return; // 结构体/指针整数参数命令改走底部按名解析包装，这里不重复。
        // 系统 DLL 的原生导出名（如 GetCurrentProcessId）已由 Windows SDK 头文件声明；
        // 再生成一份 dllimport 声明会因返回类型/类型修饰不同触发 C2556/C2373，符号由系统导入库解析。
        lines.push(`// ${command.name}：由 ${library.name}.dll 导出，声明来自 Windows SDK 头文件。`);
        return;
      }
      if (library.isSystem && command.exportName) {
        if (usesRuntimeResolvedSignature(library, command)) return; // 结构体/指针整数参数命令改走底部按名解析包装。
        // 系统 DLL 的中文别名命令：生成转发内联函数（调用真实导出名，经系统导入库链接）。
        // 不用 dllimport + 别名导入库：x86 下 def 别名无法表达 stdcall 装饰，会产生栈不平衡。
        lines.push(`inline ${boundaryReturn?.cpp || 'void'} __cdecl ${command.name}(${parameterText}) { return ${command.exportName}(${command.parameters.map(parameter => parameter.name).join(', ')}); }`);
        return;
      }
      // 声明名必须与调用点一致：binding.runtimeName = 导出名（有别名时用真实导出名），
      // 否则第三方 DLL 的英文导出别名命令会在调用点报 C3861 找不到标识符。
      const declaredName = command.exportName || command.name;
      lines.push(`__declspec(dllimport) ${boundaryReturn?.cpp || 'void'} ${convention} ${declaredName}(${parameterText});`);
    });
    lines.push('');
  });
  lines.push('#ifdef __cplusplus', '}', '#endif', '');
  const memorySection = generateProjectDllMemoryWrappers(dllLibraries);
  if (memorySection) lines.push(memorySection);
  const accessorSection = generateProjectDllStructAccessorHeader(dllLibraries);
  if (accessorSection) lines.push(accessorSection);
  return lines.join('\n');
}

/** 内存加载库的取值默认返回值（解析失败时的兜底，保证不会把未初始化值往外传）。 */
function memoryFallbackReturn(cppType: string): string | undefined {
  switch (cppType) {
    case 'void': return undefined;
    case 'bool': return 'false';
    case 'const wchar_t*': return 'nullptr';
    case 'double': return '0.0';
    case 'float': return '0.0f';
    default: return '0';
  }
}

/**
 * 内存加载命令的惰性解析包装：命令签名与「同目录加载」完全一致，差异只有
 * 首次调用时从内嵌资源手工映射 DLL（不落盘）、按导出名解析并缓存函数地址。
 * 运行期实现位于 main.cpp 的「内存加载 DLL 运行时」区块。
 */
function generateProjectDllMemoryWrappers(dllLibraries: LingCppDllLibrary[]): string {
  const specs = getProjectDllMemoryLibrarySpecs(dllLibraries);
  if (specs.length === 0) return '';
  const lines: string[] = [
    '#ifdef __cplusplus',
    '',
    '// ===== 内存加载的 DLL：RCDATA 内嵌 + 运行期手工映射，不向磁盘释放 DLL 文件 =====',
    '// 需要为项目启用「内存加载DLL模块」（lingbuilder.advanced.memorydll）；',
    '// 解析失败时写入中文原因，可用 内存DLL_取错误信息() 查看。',
    'extern long long LB_MemDllLoadFromResource(unsigned int resourceId, const wchar_t* virtualName);',
    'extern void* LB_MemDllResolveSymbol(long long moduleAddress, const char* exportName);',
    'extern void LB_MemDllReportMissingExport(const wchar_t* libraryName, const char* exportName);',
    ''
  ];
  specs.forEach((spec, index) => {
    const ensureName = `LB_MemDllEnsure_${index + 1}`;
    lines.push(`// ${spec.libraryName}：内嵌资源号 ${spec.resourceId}`);
    lines.push(`inline long long ${ensureName}() {`);
    lines.push('    static long long lbModule = 0;');
    lines.push(`    if (lbModule == 0) lbModule = LB_MemDllLoadFromResource(${spec.resourceId}u, L"${escapeHeaderStringLiteral(spec.libraryName)}");`);
    lines.push('    return lbModule;');
    lines.push('}');
    // 包装函数名必须与生成代码实际调用的名字一致：binding.runtimeName = 导出名（有别名时用别名后的真实导出名）。
    // 因此这里按导出名声明包装，中文命令名只作为补全/提示入口，与系统 DLL 别名命令同一口径。
    const emittedWrappers = new Set<string>();
    spec.library.commands.forEach(command => {
      const exportName = command.exportName || command.name;
      if (emittedWrappers.has(exportName)) return; // 多条中文命令指向同一导出时只生成一个包装。
      emittedWrappers.add(exportName);
      const boundaryReturn = resolveDllBoundaryType(command.returnType);
      const returnCpp = boundaryReturn?.cpp || 'void';
      const convention = command.callingConvention === 'stdcall' ? '__stdcall' : '__cdecl';
      const parameterCppTypes = command.parameters.map(parameter => getDllCommandParameterCppType(spec.library, parameter));
      const parameters = command.parameters.map((parameter, parameterIndex) => `${parameterCppTypes[parameterIndex]} ${parameter.name}`);
      const argumentList = command.parameters.map(parameter => parameter.name).join(', ');
      const fallback = memoryFallbackReturn(returnCpp);
      if (command.remark) lines.push(`// ${command.remark}`);
      lines.push(exportName === command.name
        ? `// ${exportName}`
        : `// 中文命令 ${command.name} → 导出 ${exportName}`);
      lines.push(`inline ${returnCpp} ${convention} ${exportName}(${parameters.join(', ')}) {`);
      lines.push(`    using lbFunctionType = ${returnCpp} (${convention}*)(${parameterCppTypes.join(', ')});`);
      lines.push('    static lbFunctionType lbFunction = nullptr;');
      lines.push(`    if (lbFunction == nullptr) lbFunction = reinterpret_cast<lbFunctionType>(LB_MemDllResolveSymbol(${ensureName}(), "${escapeHeaderStringLiteral(exportName)}"));`);
      lines.push(`    if (lbFunction == nullptr) { LB_MemDllReportMissingExport(L"${escapeHeaderStringLiteral(spec.libraryName)}", "${escapeHeaderStringLiteral(exportName)}"); ${fallback ? `return ${fallback}; ` : 'return; '}}`);
      lines.push(`    ${fallback ? 'return ' : ''}lbFunction(${argumentList});`);
      lines.push('}');
    });
    lines.push('');
  });
  lines.push('#endif', '');
  return lines.join('\n');
}

/**
 * 结构体自动命令 + 系统 DLL 结构体参数命令的 C++ 内联实现（附在声明头底部，C++ 区段）。
 * - 创建/销毁/取大小/取字段/置字段：调用端以长整数型句柄持有结构体。
 * - 系统 DLL 命令带结构体参数时，SDK 原型里的真实类型名不可知，改为首次调用按导出名
 *   GetProcAddress 解析（kernel32 等 System DLL 已在进程内，GetModuleHandleW 即可）。
 */
function generateProjectDllStructAccessorHeader(dllLibraries: LingCppDllLibrary[]): string {
  const structs = dllLibraries.flatMap(library => library.structs);
  const systemStructCommands = dllLibraries
    .filter(library => library.isSystem === true)
    .flatMap(library => library.commands
      .filter(command => usesRuntimeResolvedSignature(library, command))
      .map(command => ({ library, command })));
  if (structs.length === 0 && systemStructCommands.length === 0) return '';
  const lines: string[] = ['#ifdef __cplusplus', '', '// ===== 结构体自动命令：创建/销毁/取大小/取字段/置字段（句柄为零时安全返回零值） =====', ''];
  structs.forEach(structItem => {
    const cppName = getDllStructCppName(structItem);
    const prefix = `${structItem.name}_`;
    lines.push(`inline long long ${prefix}创建() {`);
    lines.push(`    void* lbMemory = calloc(1, sizeof(${cppName}));`);
    lines.push('    return lbMemory ? reinterpret_cast<long long>(lbMemory) : 0;');
    lines.push('}');
    lines.push('');
    lines.push(`inline void ${prefix}销毁(long long lbHandle) {`);
    lines.push('    free(reinterpret_cast<void*>(lbHandle));');
    lines.push('}');
    lines.push('');
    lines.push(`inline long long ${prefix}取大小() {`);
    lines.push(`    return static_cast<long long>(sizeof(${cppName}));`);
    lines.push('}');
    lines.push('');
    structItem.fields.forEach(field => {
      const fieldCpp = resolveDllStructFieldCppType(field) || 'unsigned char';
      const zeroValue = field.type === '逻辑型' ? 'false' : field.type === '小数型' ? '0.0' : field.type === '单精度小数型' ? '0.0f' : field.type === '文本型' ? 'L""' : '0';
      lines.push(`inline ${field.type === '文本型' ? 'const wchar_t*' : fieldCpp} ${prefix}取${field.name}(long long lbHandle) {`);
      lines.push(`    return lbHandle ? reinterpret_cast<${cppName}*>(lbHandle)->${field.name} : ${zeroValue};`);
      lines.push('}');
      lines.push('');
      if (field.type === '文本型') {
        lines.push(`inline void ${prefix}置${field.name}(long long lbHandle, const wchar_t* lbValue) {`);
        lines.push(`    if (lbHandle) wcsncpy_s(reinterpret_cast<${cppName}*>(lbHandle)->${field.name}, lbValue ? lbValue : L"", _TRUNCATE);`);
        lines.push('}');
      } else {
        lines.push(`inline void ${prefix}置${field.name}(long long lbHandle, ${fieldCpp} lbValue) {`);
        lines.push(`    if (lbHandle) reinterpret_cast<${cppName}*>(lbHandle)->${field.name} = lbValue;`);
        lines.push('}');
      }
      lines.push('');
    });
  });
  if (systemStructCommands.length > 0) {
    lines.push('// ===== 系统 DLL 结构体参数命令：首次调用按导出名解析，函数签名以声明为准 =====', '');
    systemStructCommands.forEach(({ library, command }) => {
      const returnCpp = resolveDllBoundaryType(command.returnType)?.cpp || 'void';
      const exportName = command.exportName || command.name;
      const moduleName = `${library.name.replace(/\.dll$/iu, '')}.dll`;
      const fallback = memoryFallbackReturn(returnCpp);
      const parameterText = command.parameters.map(parameter => `${getDllCommandParameterCppType(library, parameter)} ${parameter.name}`).join(', ');
      lines.push(`// ${command.name}${command.exportName ? ` → 导出 ${command.exportName}` : ''}（${library.name}.dll）`);
      lines.push(`inline ${returnCpp} ${command.name}(${parameterText}) {`);
      lines.push(`    using lbFunctionType = ${returnCpp} (__stdcall*)(${command.parameters.map(parameter => getDllCommandParameterCppType(library, parameter)).join(', ')});`);
      lines.push('    static lbFunctionType lbFunction = nullptr;');
      lines.push('    if (lbFunction == nullptr) {');
      lines.push(`        HMODULE lbModule = ::GetModuleHandleW(L"${escapeHeaderStringLiteral(moduleName)}");`);
      lines.push('        if (lbModule == nullptr) lbModule = ::LoadLibraryW(' + `L"${escapeHeaderStringLiteral(moduleName)}"` + ');');
      lines.push(`        lbFunction = lbModule ? reinterpret_cast<lbFunctionType>(::GetProcAddress(lbModule, "${escapeHeaderStringLiteral(exportName)}")) : nullptr;`);
      lines.push('    }');
      lines.push(`    if (lbFunction == nullptr) { ${fallback ? `return ${fallback};` : 'return;'} }`);
      const argumentList = command.parameters.map(parameter => parameter.name).join(', ');
      lines.push(`    return lbFunction(${argumentList});`);
      lines.push('}');
      lines.push('');
    });
  }
  lines.push('#endif', '');
  return lines.join('\n');
}
/** 枚举声明库要求的导出名（供 .def 生成与导出存在性校验）；exportName 为实际导出名。 */
export function collectProjectDllDeclaredExports(dllLibraries: LingCppDllLibrary[], libraryName: string, arch: 'Win32' | 'x64'): { dllRelativePath?: string; exports: Array<{ commandName: string; exportName: string }> } {
  const library = dllLibraries.find(item => item.name === libraryName);
  if (!library) return { exports: [] };
  return {
    dllRelativePath: library.archFiles.find(file => file.arch === arch)?.relativePath,
    exports: library.commands.map(command => ({
      commandName: command.name,
      exportName: command.exportName || command.name
    }))
  };
}

/**
 * 生成 .def 的 EXPORTS 条目：一律输出 DLL 的真实导出名。
 * 调用点（binding.runtimeName）与 dllimport 头文件声明都用「有别名时 = 导出名」的真实导出名，
 * 导入库只需承载真实符号；再生成「中文名 = 导出名」重命名符号会让英文别名命令 LNK2019。
 */
export function buildProjectDllDefLines(libraryName: string, dllBaseName: string, actualExports: string[], declaredCommands: Array<{ commandName: string; exportName: string }>): string[] {
  void declaredCommands;
  const lines = [`LIBRARY ${dllBaseName.replace(/\.dll$/iu, '')}`, 'EXPORTS'];
  actualExports.forEach(name => {
    lines.push(`    ${name}`);
  });
  return lines;
}

/** 单条 DLL 命令的声明行序列（声明行 + 备注 + 公开标记），供整库与单命令序列化共用。 */
const serializeDllCommandLines = (command: LingCppDllCommand): string[] => {
  const parameters = command.parameters.map(parameter => {
    const byRef = parameter.byRef ? ' 传址' : '';
    const note = parameter.note ? ` // ${parameter.note}` : '';
    return `${parameter.type} ${parameter.name}${byRef}${note}`;
  }).join(', ');
  const convention = command.callingConvention === 'stdcall' ? ' stdcall' : '';
  // 别名必须写回：解析器的语法是「命令名(参数) = 导出名 [cdecl|stdcall]」，别名在调用约定之前。
  // 漏写会让结构化编辑器的任何一次编辑都静默删除 `= 真实导出名`（曾导致系统 DLL 声明退化成 C3861）。
  const alias = command.exportName ? ` = ${command.exportName}` : '';
  const lines = [`  ${command.returnType} ${command.name}(${parameters})${alias}${convention}`];
  if (command.remark) lines.push(`  备注: ${command.remark}`);
  if (command.isPublic === false) lines.push('  公开 = 假');
  return lines;
};

/** 序列化 DLL 命令库为声明源码（结构化编辑器的写回通道）。 */
export function serializeProjectDllCommandLibraries(packageName: string, dllLibraries: LingCppDllLibrary[]): string {
  const lines: string[] = [`包 ${packageName}`];
  dllLibraries.forEach(library => {
    lines.push('', `DLL命令库 ${library.name}`);
    if (library.isSystem) lines.push('  系统 = 真');
    if (library.memoryLoad) lines.push('  加载方式 = 内存');
    library.archFiles.forEach(file => {
      lines.push(`  ${file.arch} = "${file.relativePath}"`);
    });
    (library.sdkHeaders || []).forEach(header => {
      lines.push(`  头文件 = ${header}`);
    });
    (library.structs || []).forEach(structItem => {
      lines.push('', `  结构体 ${structItem.name}${structItem.aliasTypeName ? ` = ${structItem.aliasTypeName}` : ''}`);
      structItem.fields.forEach(field => {
        const length = field.arrayLength !== undefined ? `[${field.arrayLength}]` : '';
        const note = field.note ? ` // ${field.note}` : '';
        lines.push(`    ${field.type} ${field.name}${length}${note}`);
      });
      lines.push('  结束结构体');
    });
    if (library.archFiles.length || (library.sdkHeaders && library.sdkHeaders.length) || (library.structs && library.structs.length)) lines.push('');
    library.commands.forEach(command => {
      // 无命令名的模型序列化出来是解析器不认的死行（如 `整数型 ()`），写出即丢：跳过它，
      // 让文件内容与表格模型保持一致，命令名非空由编辑器入口和诊断负责兜住。
      if (!command.name.trim()) return;
      lines.push(...serializeDllCommandLines(command));
    });
    lines.push('结束DLL命令库');
  });
  return lines.join('\n') + '\n';
}

/** 「复制此命令」产出的裸命令声明片段（无 DLL命令库 包裹），粘贴时并入目标项目的当前库。 */
export function serializeDllCommandSnippet(command: LingCppDllCommand): string {
  return serializeDllCommandLines(command)
    .map(line => line.replace(/^ {2}/u, ''))
    .join('\n') + '\n';
}

/** 裸声明片段兜底解析时使用的临时库名，不会写回用户源码。 */
const PASTED_SNIPPET_LIBRARY_NAME = '粘贴片段';

/**
 * 解析剪贴板中的 DLL 命令声明。优先按 `DLL命令库 … 结束DLL命令库` 整库块解析；
 * 识别不到时把文本包进临时库按「裸命令声明」再解析一次，`bare` 为真表示调用方应把命令
 * 并入当前库，而不是新建一个名为临时库的库。
 */
export function parseDllDeclarationSnippet(text: string): { libraries: LingCppDllLibrary[]; bare: boolean } {
  const withCommands = (source: string) =>
    (parseLingCpp(source).program.dllLibraries || []).filter(library => library.commands.length > 0);
  const wholeLibraries = withCommands(text);
  if (wholeLibraries.length > 0) return { libraries: wholeLibraries, bare: false };
  const bare = withCommands(`包 粘贴片段\nDLL命令库 ${PASTED_SNIPPET_LIBRARY_NAME}\n${text}\n结束DLL命令库`);
  return bare.length > 0 ? { libraries: bare, bare: true } : { libraries: [], bare: false };
}

/** 从 .h 头文件文本解析 extern "C" 声明行，生成声明初稿（复杂头文件请手填补齐）。 */
export function parseDllHeaderDeclarations(headerText: string): LingCppDllCommand[] {
  const joined = headerText
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .split(/\r?\n/)
    .map(line => line.replace(/\/\/.*$/u, '').trim())
    .join(' ');
  const commands: LingCppDllCommand[] = [];
  const declarationRe = /(?:__declspec\s*\(\s*dllimport\s*\)\s*|__declspec\s*\(\s*dllexport\s*\)\s*)?((?:unsigned\s+char|long\s+long|const\s+wchar_t\s*\*|void|int|double|bool)\s+(?:__cdecl|__stdcall)?\s*\*?\s*([\p{L}_][\p{L}\p{N}_]*)\s*\()\s*\)((?:\s*\[[^\]]*\])?)/gu;
  const parameterRe = /(const\s+wchar_t\s*\*|unsigned\s+char|long\s+long|int|double|bool|void)\s+\*?\s*([\p{L}_][\p{L}\p{N}_]*)?/gu;
  let match: RegExpExecArray | null;
  while ((match = declarationRe.exec(joined)) !== null) {
    const returnTypeText = (match[1] || '').replace(/\s+/gu, ' ').trim();
    const name = match[2] || '';
    if (!name) continue;
    const cppReturnType = returnTypeText
      .replace(/__cdecl|__stdcall/gu, '')
      .replace(/\*/gu, '')
      .replace(/\s+/gu, ' ')
      .trim();
    const isWidePointer = /const\s+wchar_t\s*\*/u.test(returnTypeText);
    const isStdcall = /__stdcall/u.test(returnTypeText);
    const chineseReturn = cppReturnType === 'void'
      ? '空'
      : cppReturnType === 'int'
        ? '整数型'
        : cppReturnType === 'long long'
          ? '长整数型'
          : cppReturnType === 'double'
            ? '小数型'
            : cppReturnType === 'float'
              ? '单精度小数型'
              : cppReturnType === 'bool'
                ? '逻辑型'
                : cppReturnType === 'unsigned char'
                  ? '字节型'
                  : isWidePointer ? '文本型' : '';
    if (!chineseReturn) continue;
    const parameters: LingCppParameter[] = [];
    const parameterText = (match[3] || '').trim();
    if (parameterText && parameterText !== 'void') {
      let parameterMatch: RegExpExecArray | null;
      parameterRe.lastIndex = 0;
      while ((parameterMatch = parameterRe.exec(parameterText)) !== null) {
        const abiType = parameterMatch[1].replace(/\s+/gu, ' ').trim();
        const isPointer = abiType.includes('*') || /wchar_t\s*\*/u.test(abiType);
        const chineseType = abiType === 'int'
          ? '整数型'
          : abiType === 'long long'
            ? '长整数型'
            : abiType === 'double'
              ? '小数型'
              : abiType === 'float'
                ? '单精度小数型'
                : abiType === 'bool'
                  ? '逻辑型'
                  : abiType === 'unsigned char'
                    ? '字节型'
                    : isPointer && /wchar_t/u.test(abiType)
                      ? '文本型'
                      : '';
        if (!chineseType) continue;
        parameters.push({
          name: parameterMatch[2] || `参数${parameters.length + 1}`,
          type: chineseType
        });
      }
    }
    commands.push({
      name,
      returnType: chineseReturn,
      parameters,
      callingConvention: isStdcall ? 'stdcall' : 'cdecl',
      line: commands.length + 1
    });
  }
  return commands;
}
