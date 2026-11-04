import fs from 'node:fs/promises';
import path from 'node:path';
import { LingCppCppSourceLibrary } from '../lingCpp/types';
import { PROJECT_CPP_SOURCE_MODULE_ID, generateProjectCppSourceDeclarationHeader } from '../lingCpp/projectCppSourceLibraryService';
import { LEGACY_TEXT_SOURCE_ENCODINGS, convertProjectFileBytesToUtf8 } from '../files/encodingConversion';

export interface MaterializeProjectCppSourceLibrariesOptions {
  cppLibraries: LingCppCppSourceLibrary[];
  /** 项目源码根绝对路径（源码/头文件的相对路径基准）。 */
  sourceRootAbsolute: string;
  buildDir: string;
  sourceDir: string;
  binDir: string;
  exportDir: string;
  logs: string[];
}

export interface MaterializeProjectCppSourceLibrariesResult {
  /** 阻断构建的中文错误（源码缺失/越界/无法解码的编码/入口符号冲突）。 */
  blocking: string[];
  /** 参与多 TU 编译的用户源码绝对路径（并入 moduleNativePlan.sourceFiles）。 */
  sourceFiles: string[];
  notes: string[];
}

/** 用户源码里禁止出现的入口符号：与生成工程的 wWinMain/wmain 冲突会直接链接失败。 */
const FORBIDDEN_ENTRY_SYMBOL_RES = [
  /\bwWinMain\s*\(/u,
  /\bDllMain\s*\(/u,
  /\b(?:int|void)\s+main\s*\(/u
];

/** 剥掉注释再扫入口符号，避免注释里提到 wWinMain 造成误报。 */
function stripCppComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/\/\/[^\n]*/gu, ' ');
}

function isUtf8Buffer(buffer: Buffer): boolean {
  // UTF-8 BOM 直接放行；其余按严格模式解码，GBK/GB2312 中文注释会解码失败。
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return true;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

/** 参与编码检测的用户代码文件扩展名（包含目录逐文件检测用；其余扩展名不碰）。 */
const CODE_FILE_EXT_RE = /\.(h|hpp|hh|hxx|cpp|cc|cxx|c)$/iu;

type LegacyTranscodeOutcome = {
  kind: 'transcoded' | 'passthrough' | 'blocked';
  bytes?: Buffer;
  label?: string;
};

/**
 * 非 UTF-8 字节的三分支处置（2026-11-04 v7）：
 * - transcoded：GBK/GB18030 严格解码成功，返回 UTF-8 字节（只动物化副本，原文件不动）；
 * - passthrough：UTF-16 等 BOM 编码（decodeTextFile 可读）——MSVC 认 BOM，原样透传；
 * - blocked：既非 UTF-8 也非 GBK/GB18030（含 UTF-32 等不支持格式），交阻断。
 */
function transcodeLegacyBuffer(content: Buffer): LegacyTranscodeOutcome {
  for (const encoding of LEGACY_TEXT_SOURCE_ENCODINGS) {
    const converted = convertProjectFileBytesToUtf8(content, encoding);
    if (converted.ok && converted.bytes) {
      return { kind: 'transcoded', bytes: converted.bytes, label: encoding === 'gbk' ? 'GBK' : 'GB18030' };
    }
    if (converted.code === 'ALREADY_READABLE') return { kind: 'passthrough' };
    if (converted.code === 'UNSUPPORTED_ENCODING') return { kind: 'blocked' };
  }
  return { kind: 'blocked' };
}

/** 递归收集目录下的代码文件绝对路径（其余扩展名不参与编码检测）。 */
async function collectCodeFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(current: string) {
    let items;
    try {
      items = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) await walk(full);
      else if (item.isFile() && CODE_FILE_EXT_RE.test(item.name)) files.push(full);
    }
  }
  await walk(dir);
  return files;
}

/**
 * 项目 C++ 源码库物化（与 materializeProjectDllDeclarationModules 同位）：
 * 1) 用户 .cpp/.h 从项目源码根复制到 build/source/export 三处 `modules/lingbuilder.project.cppsrc/sources/`；
 * 2) 生成声明头写入 `modules/lingbuilder.project.cppsrc/include/CppSourceLibraries.h`（main.cpp 前导已按 manifest headers 注入）；
 * 3) 用户 .cpp 绝对路径并入 plan.sourceFiles，编译期逐 TU `cl /c` 后统一链接。
 * bin 目录无文件：源码库不产生 DLL/运行时（同一 EXE 内链接）。
 */
export async function materializeProjectCppSourceLibraries(
  options: MaterializeProjectCppSourceLibrariesOptions
): Promise<MaterializeProjectCppSourceLibrariesResult> {
  const { cppLibraries, sourceRootAbsolute, buildDir, sourceDir, exportDir } = options;
  const result: MaterializeProjectCppSourceLibrariesResult = { blocking: [], sourceFiles: [], notes: [] };
  const libraries = cppLibraries.filter(library => library.commands.length > 0 || library.classes.length > 0 || library.structs.length > 0);
  if (libraries.length === 0) return result;
  void options.binDir;
  void options.logs;

  const moduleRoots = [buildDir, sourceDir, exportDir].map(dir => path.join(dir, 'modules', PROJECT_CPP_SOURCE_MODULE_ID));
  // 头文件库结构体（v6）：收集头文件文本，供「struct 定义是否真的写在头文件里」静态扫描。
  const headerTextsByLibrary = new Map<string, string[]>();
  // 包含目录内自动转码的文件数（按相对路径去重，跨三处副本只计一次）。
  let includeDirTranscodedCount = 0;

  for (const library of libraries) {
    // 附加包含目录（v3）：整目录递归复制进 modules/<id>/sources/<目录>，源码内的相对
    // #include（相对 .cpp 自身目录解析）即可命中；三处目录与源码文件同一份布局。
    for (const dirRef of library.includeDirs || []) {
      const absoluteDir = path.resolve(sourceRootAbsolute, dirRef.relativePath);
      const normalizedRootForDir = path.resolve(sourceRootAbsolute);
      if (absoluteDir !== normalizedRootForDir && !absoluteDir.startsWith(normalizedRootForDir + path.sep)) {
        result.blocking.push(`第 ${dirRef.line} 行：源码库「${library.name}」的包含目录 ${dirRef.relativePath} 越出了项目源码根，必须放在项目目录内。`);
        continue;
      }
      let dirStat;
      try {
        dirStat = await fs.stat(absoluteDir);
      } catch {
        result.blocking.push(`第 ${dirRef.line} 行：源码库「${library.name}」找不到包含目录 ${dirRef.relativePath}（相对项目源码根 ${sourceRootAbsolute}）。`);
        continue;
      }
      if (!dirStat.isDirectory()) {
        result.blocking.push(`第 ${dirRef.line} 行：源码库「${library.name}」的包含目录 ${dirRef.relativePath} 不是目录。`);
        continue;
      }
      // 包含目录编码（2026-11-04 v7）：复制完成后对三处副本里的代码文件逐个检测，
      // 非 UTF-8 的 GBK/GB18030 文件原位转码（只动副本）；以首份副本的处置结果为准去重记数/阻断。
      const transcodedRelativeInDir = new Set<string>();
      for (const [rootIndex, moduleRoot] of moduleRoots.entries()) {
        const targetPath = path.join(moduleRoot, 'sources', dirRef.relativePath);
        try {
          await fs.cp(absoluteDir, targetPath, { recursive: true, force: true });
        } catch (error) {
          result.blocking.push(`复制包含目录失败：${dirRef.relativePath} → ${error instanceof Error ? error.message : String(error)}`);
          continue;
        }
        for (const codeFile of await collectCodeFiles(targetPath)) {
          const bytes = await fs.readFile(codeFile);
          if (isUtf8Buffer(bytes)) continue;
          const relativeInDir = path.relative(targetPath, codeFile);
          const outcome = transcodeLegacyBuffer(bytes);
          if (outcome.kind === 'transcoded' && outcome.bytes) {
            await fs.writeFile(codeFile, outcome.bytes);
            transcodedRelativeInDir.add(relativeInDir);
          } else if (outcome.kind === 'blocked' && rootIndex === 0) {
            result.blocking.push(`第 ${dirRef.line} 行：源码库「${library.name}」包含目录 ${dirRef.relativePath} 内的文件 ${relativeInDir} 不是 UTF-8，也不是 GBK/GB18030，无法自动转码。请把该文件另存为 UTF-8 后重试。`);
          }
        }
      }
      if (transcodedRelativeInDir.size > 0) {
        includeDirTranscodedCount += transcodedRelativeInDir.size;
      }
    }
    for (const fileRef of [...library.sourceFiles, ...library.headerFiles]) {
      const absolutePath = path.resolve(sourceRootAbsolute, fileRef.relativePath);
      const normalizedRoot = path.resolve(sourceRootAbsolute);
      if (absolutePath !== normalizedRoot && !absolutePath.startsWith(normalizedRoot + path.sep)) {
        result.blocking.push(`第 ${fileRef.line} 行：源码库「${library.name}」的文件 ${fileRef.relativePath} 越出了项目源码根，必须放在项目目录内。`);
        continue;
      }
      let content: Buffer;
      try {
        content = await fs.readFile(absolutePath);
      } catch {
        result.blocking.push(`第 ${fileRef.line} 行：源码库「${library.name}」找不到文件 ${fileRef.relativePath}（相对项目源码根 ${sourceRootAbsolute}）。请确认文件已放进项目。`);
        continue;
      }
      if (!isUtf8Buffer(content)) {
        // 编码（2026-11-04 v7）：非 UTF-8 不再直接阻断——GBK/GB18030 自动转码出 UTF-8 副本
        //（只动物化副本，用户原文件保持原编码不动）；UTF-16 带 BOM 原样透传（MSVC 认 BOM）；
        // 都不行才阻断。后续文本扫描一律用解码后的 text，防止 GBK 注释转乱后误报入口符号。
        const outcome = transcodeLegacyBuffer(content);
        if (outcome.kind === 'transcoded' && outcome.bytes) {
          content = outcome.bytes;
          result.notes.push(`第 ${fileRef.line} 行：源码库「${library.name}」的文件 ${fileRef.relativePath} 不是 UTF-8，已自动按 ${outcome.label} 解码并写入 UTF-8 副本（原文件保持不变）。`);
        } else if (outcome.kind === 'passthrough') {
          result.notes.push(`第 ${fileRef.line} 行：源码库「${library.name}」的文件 ${fileRef.relativePath} 是 UTF-16 等 BOM 编码，MSVC 可直接编译，已原样并入。`);
        } else {
          result.blocking.push(`第 ${fileRef.line} 行：源码库「${library.name}」的文件 ${fileRef.relativePath} 不是 UTF-8，也不是 GBK/GB18030，无法自动转码。请把文件另存为 UTF-8 后重试（编译链按 /utf-8 处理）。`);
          continue;
        }
      }
      const decodedText = content.toString('utf8');
      if (/\.(h|hpp|hh|hxx)$/iu.test(fileRef.relativePath) && library.structs.length > 0) {
        const texts = headerTextsByLibrary.get(library.name) || [];
        texts.push(decodedText);
        headerTextsByLibrary.set(library.name, texts);
      }
      if (/\.(cpp|cc|cxx|c)$/iu.test(fileRef.relativePath)) {
        const stripped = stripCppComments(decodedText);
        for (const entryRe of FORBIDDEN_ENTRY_SYMBOL_RES) {
          if (entryRe.test(stripped)) {
            result.blocking.push(`源码库「${library.name}」的文件 ${fileRef.relativePath} 定义了程序入口函数（main/wWinMain/DllMain）。LingBuilder 生成的工程自带入口，入口符号冲突会直接链接失败；请删除该函数或改名为普通函数。`);
            break;
          }
        }
      }
      for (const moduleRoot of moduleRoots) {
        const targetPath = path.join(moduleRoot, 'sources', fileRef.relativePath);
        try {
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          // 写 content 字节而非 copyFile 原文件：content 可能已转码为 UTF-8（原文件保持不动）。
          await fs.writeFile(targetPath, content);
        } catch (error) {
          result.blocking.push(`复制源码库文件失败：${fileRef.relativePath} → ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (/\.(cpp|cc|cxx|c)$/iu.test(fileRef.relativePath)) {
        result.sourceFiles.push(path.join(moduleRoots[1], 'sources', fileRef.relativePath));
      }
    }
  }

  // 头文件库结构体定义静态扫描（v6）：字段行只是访问器契约，定义必须真的来自头文件。
  // 只扫声明的那几个头文件文本（定义可能经其它头引入，所以是 notes 提示而非阻断）。
  for (const library of libraries) {
    if (library.structs.length === 0 || library.headerFiles.length === 0) continue;
    const texts = headerTextsByLibrary.get(library.name) || [];
    if (texts.length === 0) continue;
    for (const structItem of library.structs) {
      const definitionRe = new RegExp(`\\bstruct\\s+${structItem.cppName}\\s*[^;]{0,400}\\{`, 'u');
      const found = texts.some(text => definitionRe.test(stripCppComments(text)));
      if (!found) {
        result.notes.push(`C++ 源码库「${library.name}」：结构体 ${structItem.name}（${structItem.cppName}）的 struct 定义未在声明的头文件文本中直接找到（若定义经其它头引入可忽略；编译报 ${structItem.cppName} 未定义时请把定义补进头文件）。`);
      }
    }
  }

  const declarationHeader = generateProjectCppSourceDeclarationHeader(libraries);
  if (declarationHeader) {
    for (const moduleRoot of moduleRoots) {
      try {
        await fs.mkdir(path.join(moduleRoot, 'include'), { recursive: true });
        await fs.writeFile(path.join(moduleRoot, 'include', 'CppSourceLibraries.h'), declarationHeader, 'utf8');
      } catch (error) {
        result.blocking.push(`写入 C++ 源码库声明头失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    result.notes.push(`C++ 源码库：已并入 ${result.sourceFiles.length} 个用户源码文件，与生成的工程一起编译。`);
  }
  if (includeDirTranscodedCount > 0) {
    result.notes.push(`C++ 源码库：包含目录内已自动将 ${includeDirTranscodedCount} 个非 UTF-8 文件转码为 UTF-8 副本（原目录保持不变）。`);
  }
  return result;
}
