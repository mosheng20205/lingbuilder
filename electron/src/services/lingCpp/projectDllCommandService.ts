import {
  LingCppDllLibrary,
  LingCppDllArchitectureFile,
  LingCppDllCommand,
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
  '// 命令名即 DLL 导出函数名；DLL 文件按相对路径放在项目内，构建时自动复制到 exe 旁。'
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
  '逻辑型': { abi: 'bool', cpp: 'bool' },
  '逻辑': { abi: 'bool', cpp: 'bool' },
  '字节型': { abi: 'int', cpp: 'unsigned char' },
  '字节': { abi: 'int', cpp: 'unsigned char' },
  '文本型': { abi: 'wideString', cpp: 'const wchar_t*' },
  '文本': { abi: 'wideString', cpp: 'const wchar_t*' }
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
  parsed.program.dllLibraries.forEach(library => {
    // 系统 DLL（user32 等）链接系统导入库，不需要架构文件映射，豁免缺架构诊断。
    if (!library.isSystem && !library.archFiles.length) {
      diagnosticSequence += 1;
      diagnostics.push({
        id: `project-dll-${library.line}-${diagnosticSequence}`,
        line: library.line,
        level: 'error',
        message: `DLL命令库 ${library.name} 未声明任何架构 DLL 文件。`,
        codeSnippet: library.name,
        suggestion: '请添加 `Win32 = "dll/Win32/xxx.dll"` 与 `x64 = "dll/x64/xxx.dll"`。'
      });
    }
    library.commands.forEach(command => {
      const returnType = resolveDllBoundaryType(command.returnType);
      if (!returnType) push(command.line, `DLL 命令 ${command.name} 的返回类型「${command.returnType}」不能跨 DLL 边界。`, '仅支持：空、整数型、长整数型、小数型、逻辑型、字节型、文本型。');
      command.parameters.forEach(parameter => {
        if (!resolveDllBoundaryType(parameter.type)) {
          push(command.line, `DLL 命令 ${command.name} 的参数「${parameter.name}」类型「${parameter.type}」不能跨 DLL 边界。`, '仅支持：整数型、长整数型、小数型、逻辑型、字节型、文本型。');
          return;
        }
        if (parameter.byRef && resolveDllBoundaryPointerType(parameter.type) === undefined) {
          push(command.line, `DLL 命令 ${command.name} 的传址参数「${parameter.name}」类型「${parameter.type}」不支持传址。`, '仅整数型、长整数型、小数型、逻辑型、字节型支持传址；文本型请改为返回值或整数句柄。');
        }
      });
    });
  });
  return diagnostics;
}

const toCommandParameters = (parameters: LingCppParameter[]) => parameters.map(parameter => {
  const boundary = resolveDllBoundaryType(parameter.type);
  return {
    name: parameter.name,
    type: (boundary?.abi || 'raw') as ModuleBindingValueType,
    description: parameter.note || 'DLL 导出参数。',
    byRef: parameter.byRef === true ? true : undefined
  };
});

/**
 * 由项目 DLL 命令声明合成虚拟模块（lingbuilder.project.dll）。
 * 注入 enabledModules 后，诊断/补全/C++ 生成/构建物化自动复用模块链路；
 * targets 里的 include/lib 路径指向构建期生成到 `modules/<id>/` 布局的文件。
 */
export function createProjectDllDeclarationModule(dllLibraries: LingCppDllLibrary[], projectId: string): InstalledModule | undefined {
  const libraries = dllLibraries.filter(library => library.commands.length > 0);
  if (libraries.length === 0) return undefined;
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
      commands: libraries.flatMap(library => library.commands.map(command => ({
        name: command.name,
        signature: `${command.name}(${command.parameters.map(parameter => parameter.name).join(', ')})`,
        description: command.remark || `调用 DLL「${library.name}」的导出函数${command.exportName ? `（${command.exportName}）` : ''}。`,
        insertText: `${command.name}(${command.parameters.map(parameter => parameter.name).join(', ')})`,
        returnType: command.returnType,
        category: '其他' as const,
        visibility: 'default' as const
      })))
    },
    targets: ['Win32', 'x64'].map(arch => ({
      id: arch === 'Win32' ? 'windows-msvc-win32' : 'windows-msvc-x64',
      platform: 'windows' as const,
      arch: (arch === 'Win32' ? 'win32' : 'x64') as 'win32' | 'x64',
      toolchain: 'msvc' as const,
      includeDirs: ['include'],
      headers: ['include/ProjectDllCommands.h'],
      libs: libraries.filter(lib => !lib.isSystem).flatMap(lib =>
        lib.archFiles.filter(f => (f.arch === 'x64' ? 'x64' : 'Win32') === arch).map(f => `lib/${arch}/${lib.name}.lib`)),
      runtimeFiles: libraries.flatMap(library => library.archFiles
        .filter(file => file.arch === arch)
        .map(file => file.relativePath))
    })),
    bindings: {
      commands: libraries.flatMap(library => library.commands.map(command => {
        const boundaryReturn = resolveDllBoundaryType(command.returnType);
        return {
          command: command.name,
          runtimeName: command.exportName || command.name,
          parameters: toCommandParameters(command.parameters),
          returnType: boundaryReturn?.abi || 'void',
          encoding: 'wide' as const,
          example: `${command.name}(${command.parameters.map(parameter => parameter.name).join(', ')})`
        };
      }))
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

/** 声明命令的 C++ 声明头（构建期写入 modules/lingbuilder.project.dll/include/）。 */
export function generateProjectDllDeclarationHeader(dllLibraries: LingCppDllLibrary[]): string {
  const lines: string[] = [
    '// 由 LingBuilder 项目 DLL 命令声明自动生成：中文命令 → DLL 导出函数（extern "C"）。',
    '// 文本参数/返回一律使用指针（const wchar_t*），不要让 std::wstring 跨 DLL 边界。',
    '#pragma once',
    '',
    '#ifdef __cplusplus',
    'extern "C" {',
    '#endif',
    ''
  ];
  dllLibraries.forEach(library => {
    if (library.commands.length === 0) return;
    lines.push(`// ${library.name}${library.isSystem ? '（系统 DLL）' : ''}`);
    library.commands.forEach(command => {
      const boundaryReturn = resolveDllBoundaryType(command.returnType);
      const parameters = command.parameters.map(parameter => {
        const base = resolveDllBoundaryType(parameter.type);
        const cpp = parameter.byRef ? resolveDllBoundaryPointerType(parameter.type) : `${base?.cpp || 'void*'}`;
        return `${cpp || 'void*'} ${parameter.name}`;
      });
      const convention = command.callingConvention === 'stdcall' ? '__stdcall' : '__cdecl';
      if (command.remark) lines.push(`// ${command.remark}`);
      lines.push(`__declspec(dllimport) ${boundaryReturn?.cpp || 'void'} ${convention} ${command.name}(${parameters.join(', ')});`);
    });
    lines.push('');
  });
  lines.push('#ifdef __cplusplus', '}', '#endif', '');
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

/** 生成 .def 的 EXPORTS 条目：有别名时输出 `别名 = 导出名`，否则裸导出名。 */
export function buildProjectDllDefLines(libraryName: string, dllBaseName: string, actualExports: string[], declaredCommands: Array<{ commandName: string; exportName: string }>): string[] {
  const lines = [`LIBRARY ${dllBaseName.replace(/\.dll$/iu, '')}`, 'EXPORTS'];
  const declaredExports = new Set(declaredCommands.map(item => item.exportName));
  actualExports.forEach(name => {
    if (declaredExports.has(name)) {
      const alias = declaredCommands.find(item => item.exportName === name)?.commandName;
      lines.push(alias && alias !== name ? `    ${alias} = ${name}` : `    ${name}`);
    } else {
      lines.push(`    ${name}`);
    }
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
  const lines = [`  ${command.returnType} ${command.name}(${parameters})${convention}`];
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
    library.archFiles.forEach(file => {
      lines.push(`  ${file.arch} = "${file.relativePath}"`);
    });
    if (library.archFiles.length) lines.push('');
    library.commands.forEach(command => {
      lines.push(...serializeDllCommandLines(command));
    });
    lines.push('结束DLL命令库');
  });
  return lines.join('\n') + '\n';
}

/** 将单条命令序列化为可粘贴的独立声明片段（含 DLL命令库 包裹与架构文件映射），粘贴后可直接被解析器识别。 */
export function serializeSingleDllCommand(
  libraryName: string,
  isSystem: boolean,
  command: LingCppDllCommand,
  archFiles: LingCppDllArchitectureFile[] = []
): string {
  const lines = [`DLL命令库 ${libraryName || '示例DLL'}`];
  if (isSystem) lines.push('  系统 = 真');
  archFiles.forEach(file => {
    lines.push(`  ${file.arch} = "${file.relativePath}"`);
  });
  if (archFiles.length) lines.push('');
  lines.push(...serializeDllCommandLines(command));
  lines.push('结束DLL命令库');
  return lines.join('\n') + '\n';
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
