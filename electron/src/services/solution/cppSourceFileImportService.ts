import fs from 'node:fs/promises';
import path from 'node:path';

/** 允许导入的 C++ 源码/头文件扩展名（与「添加 C++ 源码…」文件对话框过滤一致）。 */
const CPP_SOURCE_EXTENSIONS = ['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp', '.hh', '.hxx'];

/** 导入源码的落盘子目录（相对项目源码根）。 */
export const CPP_SOURCE_IMPORT_DIRECTORY = 'cpp';

export interface CppSourceImportEntry {
  /** 项目源码根相对路径（如 cpp/mymath.cpp），可直接填进「源码 =」声明。 */
  relativePath: string;
  absoluteSource: string;
  absoluteTarget: string;
}

export interface CppSourceImportResult {
  ok: boolean;
  copied?: CppSourceImportEntry[];
  skipped?: Array<{ path: string; reason: string }>;
  error?: string;
}

/** 校验单个源路径：必须是允许扩展名的本机文件。返回中文原因或 undefined。 */
export function cppSourceImportRejection(sourcePath: string, extensionWhitelist: string[] = CPP_SOURCE_EXTENSIONS): string | undefined {
  const normalized = sourcePath.replace(/\\/gu, '/').trim();
  if (!normalized) return '路径为空。';
  const extension = path.posix.extname(normalized).toLowerCase();
  if (!extensionWhitelist.includes(extension)) {
    return `只支持 ${extensionWhitelist.join(' / ')} 文件，收到「${extension || '无扩展名'}」。`;
  }
  return undefined;
}

/** 目标重名时的追加后缀（-2/-3…），与图片资源导入同口径。 */
function suffixedName(directory: string, fileName: string, taken: Set<string>): string {
  const extension = path.posix.extname(fileName);
  const baseName = path.posix.basename(fileName, extension);
  let index = 1;
  let candidate = fileName;
  while (taken.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${baseName}-${index}${extension}`;
  }
  void directory;
  taken.add(candidate.toLowerCase());
  return candidate;
}

/**
 * 「添加 C++ 源码…」的复制落盘唯一实现：
 * 本机 .h/.cpp 复制进 <项目源码根>/cpp/（重名自动 -2/-3），返回可直接写进
 * 「源码 =」声明的项目相对路径。复制而非引用，保持工程自包含、源码随项目分发。
 */
export async function importCppSourceFiles(options: {
  sourcePaths: string[];
  sourceRootAbsolute: string;
}): Promise<CppSourceImportResult> {
  const { sourcePaths, sourceRootAbsolute } = options;
  if (!Array.isArray(sourcePaths) || sourcePaths.length === 0) {
    return { ok: false, error: '没有要导入的源码文件。' };
  }
  const targetDirectory = path.join(path.resolve(sourceRootAbsolute), CPP_SOURCE_IMPORT_DIRECTORY);
  const copied: CppSourceImportEntry[] = [];
  const skipped: Array<{ path: string; reason: string }> = [];
  try {
    await fs.mkdir(targetDirectory, { recursive: true });
    const existing = new Set((await fs.readdir(targetDirectory)).map(name => name.toLowerCase()));
    for (const sourcePath of sourcePaths) {
      const rejection = cppSourceImportRejection(sourcePath);
      if (rejection) {
        skipped.push({ path: sourcePath, reason: rejection });
        continue;
      }
      const absoluteSource = path.resolve(sourcePath);
      try {
        const stat = await fs.stat(absoluteSource);
        if (!stat.isFile()) {
          skipped.push({ path: sourcePath, reason: '不是文件。' });
          continue;
        }
      } catch {
        skipped.push({ path: sourcePath, reason: '文件不存在或无法读取。' });
        continue;
      }
      const targetName = suffixedName(targetDirectory, path.basename(absoluteSource), existing);
      const absoluteTarget = path.join(targetDirectory, targetName);
      await fs.copyFile(absoluteSource, absoluteTarget);
      copied.push({
        relativePath: `${CPP_SOURCE_IMPORT_DIRECTORY}/${targetName.replace(/\\/gu, '/')}`,
        absoluteSource,
        absoluteTarget
      });
    }
  } catch (error) {
    return { ok: false, copied, skipped, error: error instanceof Error ? error.message : String(error) };
  }
  if (copied.length === 0) {
    return { ok: false, copied, skipped, error: skipped.length > 0
      ? `没有可导入的文件：${skipped.map(item => `${path.basename(item.path)}（${item.reason}）`).join('、')}`
      : '没有可导入的文件。' };
  }
  return { ok: true, copied, skipped };
}
