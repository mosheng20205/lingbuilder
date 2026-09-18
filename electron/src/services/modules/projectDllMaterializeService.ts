import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import {
  PROJECT_DLL_MEMORY_MAX_FILE_BYTES,
  PROJECT_DLL_MODULE_ID,
  buildProjectDllDefLines,
  collectProjectDllDeclaredExports,
  generateProjectDllDeclarationHeader,
  getProjectDllMemoryLibrarySpecs
} from '../lingCpp/projectDllCommandService';
import type { LingCppDllLibrary } from '../lingCpp/types';
import { detectLatestMsvcPlatformToolset } from '../windowDesigner/msvcPlatformToolset';

/** PE 文件 Machine 字段取值（COFF 头偏移 0x04）。 */
const PE_MACHINE_I386 = 0x014c;
const PE_MACHINE_AMD64 = 0x8664;

/**
 * 读取 PE 的 Machine 字段；不是有效 PE 时返回 null。
 * 内存加载要求 DLL 位数与目标程序一致，构建期先按该字段阻断，避免运行期才失败。
 */
export function readPeMachine(buffer: Buffer): number | null {
  try {
    if (buffer.length < 0x40 || buffer.readUInt16LE(0) !== 0x5a4d) return null;
    const peOffset = buffer.readUInt32LE(0x3c);
    if (peOffset <= 0 || peOffset + 6 > buffer.length || buffer.readUInt32LE(peOffset) !== 0x00004550) return null;
    return buffer.readUInt16LE(peOffset + 4);
  } catch {
    return null;
  }
}

function describePeMachine(machine: number | null): string {
  if (machine === PE_MACHINE_I386) return '32 位（x86）';
  if (machine === PE_MACHINE_AMD64) return '64 位（x64）';
  if (machine === null) return '无法识别的 PE 架构';
  return `未知架构（0x${machine.toString(16)}）`;
}

/**
 * 枚举 PE 导出表的全部导出名（latin1 读取，即 DLL 导出表原始字节）。
 * 解析失败返回 null；无导出表返回空数组。
 */
export function enumeratePeExports(buffer: Buffer): string[] | null {
  try {
    if (buffer.length < 0x40 + 24 || buffer.readUInt16LE(0) !== 0x5a4d) return null;
    const peOffset = buffer.readUInt32LE(0x3c);
    if (peOffset <= 0 || peOffset + 24 > buffer.length || buffer.readUInt32LE(peOffset) !== 0x00004550) return null;
    const numberOfSections = buffer.readUInt16LE(peOffset + 6);
    const optionalHeaderSize = buffer.readUInt16LE(peOffset + 20);
    const optionalHeaderOffset = peOffset + 24;
    if (optionalHeaderSize <= 0 || optionalHeaderOffset + optionalHeaderSize > buffer.length) return null;
    const magic = buffer.readUInt16LE(optionalHeaderOffset);
    const dataDirectoryOffset = optionalHeaderOffset + (magic === 0x20b ? 112 : 96);
    if (dataDirectoryOffset + 8 > buffer.length) return null;
    const exportRva = buffer.readUInt32LE(dataDirectoryOffset);
    if (exportRva === 0) return [];
    const sectionsOffset = optionalHeaderOffset + optionalHeaderSize;
    const sections: Array<{ rva: number; size: number; raw: number }> = [];
    for (let index = 0; index < numberOfSections; index += 1) {
      const entry = sectionsOffset + index * 40;
      if (entry + 40 > buffer.length) return null;
      const virtualSize = buffer.readUInt32LE(entry + 8);
      const virtualAddress = buffer.readUInt32LE(entry + 12);
      const sizeOfRawData = buffer.readUInt32LE(entry + 16);
      const pointerToRawData = buffer.readUInt32LE(entry + 20);
      sections.push({ rva: virtualAddress, size: Math.max(virtualSize, sizeOfRawData), raw: pointerToRawData });
    }
    const rvaToOffset = (rva: number): number => {
      for (const section of sections) {
        if (rva >= section.rva && rva < section.rva + section.size) return rva - section.rva + section.raw;
      }
      return 0;
    };
    const exportOffset = rvaToOffset(exportRva);
    if (exportOffset <= 0 || exportOffset + 40 > buffer.length) return null;
    const numberOfNames = buffer.readUInt32LE(exportOffset + 24);
    const addressOfNames = rvaToOffset(buffer.readUInt32LE(exportOffset + 32));
    if (addressOfNames <= 0 || addressOfNames + 4 > buffer.length) return null;
    const names: string[] = [];
    for (let index = 0; index < numberOfNames; index += 1) {
      const namePointerEntry = addressOfNames + index * 4;
      if (namePointerEntry + 4 > buffer.length) return null;
      const nameOffset = rvaToOffset(buffer.readUInt32LE(namePointerEntry));
      if (nameOffset <= 0 || nameOffset >= buffer.length) continue;
      const end = buffer.indexOf(0, nameOffset);
      if (end <= nameOffset || end - nameOffset > 256) continue;
      names.push(buffer.toString('utf8', nameOffset, end));
    }
    return names;
  } catch {
    return null;
  }
}

export interface ProjectDllMaterializeOptions {
  dllLibraries: LingCppDllLibrary[];
  /** 项目源码根的绝对路径（声明里的 DLL 相对路径以此为基准）。 */
  sourceRootAbsolute: string;
  buildDir: string;
  sourceDir: string;
  binDir: string;
  exportDir: string;
  /** 本次构建的目标机器：决定生成哪一架构的导入库。 */
  machine: 'X64' | 'X86';
  logs: string[];
}

export interface ProjectDllMaterializeResult {
  blocking: string[];
  /** 需要追加进 plan.libFiles 的导入库绝对路径（系统 DLL 时为系统导入库名）。 */
  libFiles: string[];
  /** 构建日志（内存加载的内嵌资源写入情况等），由调用方并入构建输出。 */
  notes: string[];
}

async function locateMsvcLibExecutable(): Promise<string | null> {
  const probe = await detectLatestMsvcPlatformToolset();
  if (!probe.installationPath) return null;
  const toolsRoot = path.join(probe.installationPath, 'VC', 'Tools', 'MSVC');
  let versions: string[] = [];
  try {
    versions = await fs.readdir(toolsRoot);
  } catch {
    return null;
  }
  const ordered = versions.sort((left, right) => right.localeCompare(left));
  for (const version of ordered) {
    const candidate = path.join(toolsRoot, version, 'bin', 'Hostx64', 'x64', 'lib.exe');
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // 继续尝试其它版本。
    }
  }
  return null;
}

const DLL_MODULE_TARGET_DIR_BY_MACHINE: Record<'X64' | 'X86', string> = { X64: 'x64', X86: 'Win32' };

async function runLibExecutable(libExecutable: string, args: string[], cwd: string): Promise<{ code: number; stderr: string }> {
  return new Promise(resolve => {
    execFile(libExecutable, args, { cwd, windowsHide: true, timeout: 60_000, maxBuffer: 1024 * 1024 * 2 }, (error, _stdout, stderr) => {
      const code = (error as { code?: number | string } | null)?.code;
      resolve({ code: typeof code === 'number' ? code : code ? Number(code) : 0, stderr: String(stderr || '') });
    });
  });
}

/**
 * 项目 DLL 命令声明物化：生成声明头、按实际导出表生成 .def（支持「中文命令 = 导出名」别名）与导入库、
 * 把 DLL 复制到 exe 目录；导入库路径由调用方追加进 plan.libFiles 参与链接。
 * 系统 DLL（isSystem）跳过文件部署，链接系统导入库；导出校验读 System32，读不到降级为日志。
 * 返回阻断诊断与需要参与链接的导入库路径。
 */
export async function materializeProjectDllDeclarationModules(options: ProjectDllMaterializeOptions): Promise<ProjectDllMaterializeResult> {
  const blocking: string[] = [];
  const libFiles: string[] = [];
  const notes: string[] = [];
  const { dllLibraries } = options;
  if (!dllLibraries.some(library => library.commands.length > 0)) return { blocking, libFiles, notes };

  const memorySpecByLibrary = new Map(
    getProjectDllMemoryLibrarySpecs(dllLibraries).map(spec => [spec.libraryName, spec])
  );

  const header = generateProjectDllDeclarationHeader(dllLibraries);
  const headerTargets = [
    path.join(options.sourceDir, 'modules', PROJECT_DLL_MODULE_ID, 'include'),
    path.join(options.buildDir, 'modules', PROJECT_DLL_MODULE_ID, 'include'),
    path.join(options.exportDir, 'modules', PROJECT_DLL_MODULE_ID, 'include')
  ];
  for (const target of headerTargets) {
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'ProjectDllCommands.h'), header, 'utf8');
  }

  const archKey = options.machine === 'X64' ? 'x64' : 'Win32';
  const archDir = DLL_MODULE_TARGET_DIR_BY_MACHINE[options.machine];
  for (const library of dllLibraries) {
    const declared = collectProjectDllDeclaredExports(dllLibraries, library.name, options.machine === 'X64' ? 'x64' : 'Win32').exports;

    if (library.isSystem) {
      // 系统 DLL：不复制文件、链接系统导入库（kernel32.lib/user32.lib 等）。
      // 命令的 C++ 侧声明由声明头生成：无别名命令（如 GetCurrentProcessId）使用 Windows SDK
      // 头文件既有声明（重复 dllimport 声明会因返回类型/修饰不同触发 C2556/C2373）；
      // 中文别名命令生成 inline 转发函数调用真实导出名，经系统导入库链接。
      const systemDllPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', `${library.name}.dll`);
      let systemExports: string[] | null = null;
      try {
        systemExports = enumeratePeExports(await fs.readFile(systemDllPath));
      } catch {
        systemExports = null; // 读不到 System32 DLL 时降级为不校验导出表。
      }
      // 仅校验显式别名（= 真实导出名）；无别名命令的符号由系统导入库与 API Set 转发解析
      // （如 IsDebuggerPresent 在 user32.dll 导出表中不存在但链接运行均正常），不做静态校验。
      library.commands.forEach(command => {
        if (!command.exportName || !systemExports) return;
        if (!systemExports.includes(command.exportName)) {
          blocking.push(`系统 DLL「${library.name}」未导出「${command.exportName}」，请核对真实导出名。`);
        }
      });
      libFiles.push(`${library.name}.lib`);
      options.logs.push(`系统 DLL：${library.name}（链接系统导入库 ${library.name}.lib，不复制文件）`);
      continue;
    }

    const archFile = library.archFiles.find(file => (file.arch === 'x64' ? 'X64' : 'X86') === options.machine);
    if (!archFile) {
      blocking.push(`DLL命令库 ${library.name} 未声明 ${archKey} 架构的 DLL 文件，无法完成本次构建。`);
      continue;
    }
    const dllAbsolute = path.resolve(options.sourceRootAbsolute, archFile.relativePath);
    let dllBuffer: Buffer;
    try {
      dllBuffer = await fs.readFile(dllAbsolute);
    } catch {
      blocking.push(`找不到声明的 DLL 文件：${archFile.relativePath}（解析为 ${dllAbsolute}）`);
      continue;
    }
    const actualExports = enumeratePeExports(dllBuffer);
    if (actualExports === null) {
      blocking.push(`无法解析 DLL 导出表：${archFile.relativePath}（可能不是有效的 PE 文件）。`);
      continue;
    }
    const missing = declared.filter(item => !actualExports.includes(item.exportName));
    missing.forEach(item => {
      blocking.push(`DLL「${library.name}」未导出命令对应的函数 ${item.exportName}；请确认 DLL 版本与声明一致。`);
    });

    const memorySpec = memorySpecByLibrary.get(library.name);
    if (memorySpec) {
      // 加载方式 = 内存：不生成导入库、不把 DLL 复制到 exe 目录，只把当前目标架构的字节写成
      // 内嵌资源（rc 引用），运行期由 内存DLL_* 运行时手工映射；exe 同目录不会出现该 DLL。
      const machine = readPeMachine(dllBuffer);
      const expectedMachine = options.machine === 'X64' ? PE_MACHINE_AMD64 : PE_MACHINE_I386;
      if (machine !== expectedMachine) {
        blocking.push(`DLL「${library.name}」是${describePeMachine(machine)}，与本次${options.machine === 'X64' ? '64 位' : '32 位'}构建不一致；内存加载要求 DLL 与程序位数一致。请更换 ${archFile.relativePath} 或改用对应架构的 DLL。`);
        continue;
      }
      if (dllBuffer.length > PROJECT_DLL_MEMORY_MAX_FILE_BYTES) {
        blocking.push(`DLL「${library.name}」体积 ${(dllBuffer.length / 1024 / 1024).toFixed(1)}MB 超过内嵌上限 32MB（${archFile.relativePath}）。`);
        continue;
      }
      for (const targetRoot of [options.sourceDir, options.exportDir]) {
        const target = path.resolve(targetRoot, ...memorySpec.resourceFileName.split('/'));
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile(dllAbsolute, target);
      }
      notes.push(`已内嵌内存加载 DLL（${archDir}，资源号 ${memorySpec.resourceId}）：${path.basename(archFile.relativePath)} → 不复制到 exe 目录`);
      continue;
    }

    const libExecutable = await locateMsvcLibExecutable();
    if (!libExecutable) {
      blocking.push('项目 DLL 命令声明需要 MSVC 的 lib.exe 生成导入库；未检测到 Visual Studio C++ 工具集，请安装后重试。');
      continue;
    }

    const moduleRoot = path.join(options.buildDir, 'modules', PROJECT_DLL_MODULE_ID, 'lib', archDir);
    await fs.mkdir(moduleRoot, { recursive: true });
    const defPath = path.join(moduleRoot, `${library.name}.def`);
    const libPath = path.join(moduleRoot, `${library.name}.lib`);
    const defLines = buildProjectDllDefLines(library.name, path.basename(archFile.relativePath), actualExports, declared);
    // lib.exe 的 .def 按 UTF-8（带 BOM）解析中文导出名与别名；无 BOM 会退回系统代码页导致名字错位。
    const defContent = '﻿' + defLines.join('\r\n') + '\r\n';
    await fs.writeFile(defPath, defContent, 'utf8');
    const libArgs = [`/def:${defPath}`, `/machine:${options.machine}`, `/out:${libPath}`];
    const result = await runLibExecutable(libExecutable, libArgs, options.buildDir);
    if (result.code !== 0) {
      blocking.push(`生成项目 DLL 导入库失败（lib.exe 退出码 ${result.code}）：${result.stderr.slice(0, 400)}`);
      continue;
    }
    libFiles.push(libPath);
    options.logs.push(`已生成项目 DLL 导入库（${archDir}）：${library.commands.map(command => command.name).join('、')}`);
    const binTargetPath = path.join(options.binDir, path.basename(archFile.relativePath));
    await fs.mkdir(options.binDir, { recursive: true });
    await fs.copyFile(dllAbsolute, binTargetPath);
    options.logs.push(`已把声明 DLL 复制到 exe 目录：${path.basename(archFile.relativePath)}`);
    const exportModuleRoot = path.join(options.exportDir, 'modules', PROJECT_DLL_MODULE_ID, 'lib', archDir);
    await fs.mkdir(exportModuleRoot, { recursive: true });
    await fs.copyFile(libPath, path.join(exportModuleRoot, `${library.name}.lib`));
    await fs.copyFile(defPath, path.join(exportModuleRoot, `${library.name}.def`));
  }
  return { blocking, libFiles, notes };
}
