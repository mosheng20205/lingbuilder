import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 工作区既有 C++ 工程检测（「打开文件夹」后的导入提示数据来源）。
 *
 * 浅层扫描（根目录 + 两层子目录）CMakeLists.txt / .sln / .vcxproj，
 * 并报告含 C/C++ 源码但没有任何工程文件的目录（供「生成 CMake 骨架并导入」）。
 * 只做只读探测，绝不修改工作区。
 */

export type DetectedExternalProjectKind = 'cmake' | 'msbuild' | 'sln';

export interface DetectedExternalProject {
  /** 工作区相对路径（正斜杠）。 */
  relativePath: string;
  kind: DetectedExternalProjectKind;
  /** 尽力猜测的显示名：CMake 取 project(...)，其余取文件名。 */
  name?: string;
}

export interface DetectedSourceDirectory {
  /** 工作区相对路径（正斜杠）。 */
  relativePath: string;
  sourceFileCount: number;
}

export interface ExternalProjectDetectionResult {
  candidates: DetectedExternalProject[];
  sourceDirectories: DetectedSourceDirectory[];
}

const MAX_CANDIDATES = 10;
const MAX_SOURCE_DIRECTORIES = 5;
const MAX_SCANNED_DIRECTORIES = 400;

/** 检测时跳过的构建产物、版本控制与 IDE 环境目录（小写比较）。 */
export const EXTERNAL_SCAN_SKIPPED_DIRECTORIES = new Set([
  '.lingbuilder', '.lingbuilder-build', '.git', '.svn', '.vs', '.vscode', '.idea', '.cache',
  'node_modules', 'generated', 'obj', 'bin', 'build', 'builds', 'out', 'output',
  'debug', 'release', 'x64', 'win32', 'cmake-build-debug', 'cmake-build-release'
]);

const SOURCE_EXTENSIONS = new Set(['.cpp', '.cc', '.cxx', '.c']);

function toPosixRelative(value: string): string {
  return value.replace(/\\/gu, '/') || '.';
}

async function readDirSafe(directory: string): Promise<Array<{ name: string; isDirectory: boolean }>> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries.map(entry => ({ name: entry.name, isDirectory: entry.isDirectory() }));
  } catch {
    return [];
  }
}

/** 递归统计目录子树中的 C/C++ 源码文件数（跳过构建产物与环境目录）。 */
async function countSourceFilesDeep(directory: string): Promise<number> {
  let count = 0;
  for (const entry of await readDirSafe(directory)) {
    if (entry.isDirectory) {
      if (EXTERNAL_SCAN_SKIPPED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
      count += await countSourceFilesDeep(path.join(directory, entry.name));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      count += 1;
    }
  }
  return count;
}

function classifyProjectFile(fileName: string): DetectedExternalProjectKind | null {
  const lower = fileName.toLowerCase();
  if (lower === 'cmakelists.txt') return 'cmake';
  if (lower.endsWith('.sln')) return 'sln';
  if (lower.endsWith('.vcxproj')) return 'msbuild';
  return null;
}

/** 浅层扫描工作区，返回既有工程候选与含源码目录。 */
export async function detectExternalCppProjects(workspaceRoot: string): Promise<ExternalProjectDetectionResult> {
  const candidates: DetectedExternalProject[] = [];
  const sourceDirectories: DetectedSourceDirectory[] = [];
  const directoriesWithProjects = new Set<string>();
  let scanned = 0;

  const scanDirectory = async (absoluteDirectory: string, relativeDirectory: string, depth: number): Promise<void> => {
    if (candidates.length >= MAX_CANDIDATES || scanned >= MAX_SCANNED_DIRECTORIES) return;
    scanned += 1;
    const entries = await readDirSafe(absoluteDirectory);
    let hasProjectFile = false;
    for (const entry of entries) {
      if (candidates.length >= MAX_CANDIDATES) break;
      const entryPath = path.join(absoluteDirectory, entry.name);
      if (!entry.isDirectory) {
        const kind = classifyProjectFile(entry.name);
        if (kind) {
          hasProjectFile = true;
          directoriesWithProjects.add(relativeDirectory);
          if (candidates.length < MAX_CANDIDATES) {
            candidates.push({
              relativePath: toPosixRelative(path.join(relativeDirectory, entry.name)),
              kind,
              name: guessProjectName(kind, entryPath, entry.name)
            });
          }
        }
      }
    }
    if (depth < 2) {
      for (const entry of entries) {
        if (!entry.isDirectory || EXTERNAL_SCAN_SKIPPED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
        await scanDirectory(path.join(absoluteDirectory, entry.name), toPosixRelative(path.join(relativeDirectory, entry.name)), depth + 1);
      }
    }
    // 源码目录只报告深度 ≤1 的目录，且本身没有任何工程文件；源码数量按子树递归统计。
    if (!hasProjectFile && depth <= 1 && sourceDirectories.length < MAX_SOURCE_DIRECTORIES
      && !directoriesWithProjects.has(relativeDirectory)) {
      const deepSourceCount = await countSourceFilesDeep(absoluteDirectory);
      if (deepSourceCount > 0) sourceDirectories.push({ relativePath: relativeDirectory, sourceFileCount: deepSourceCount });
    }
  };

  await scanDirectory(workspaceRoot, '.', 0);
  return { candidates, sourceDirectories };
}

function guessProjectName(kind: DetectedExternalProjectKind, absoluteFile: string, fileName: string): string {
  if (kind === 'sln') return path.basename(fileName, path.extname(fileName));
  if (kind === 'msbuild') return path.basename(fileName, '.vcxproj');
  try {
    // 同步读取可行：检测为一次性浅层操作，文件很小。
    const content = readFileSync(absoluteFile, 'utf8');
    return content.match(/\bproject\s*\(\s*([A-Za-z0-9_.-]+)/iu)?.[1] || path.basename(path.dirname(absoluteFile));
  } catch {
    return path.basename(path.dirname(absoluteFile));
  }
}

/** 收集目录（含最多三层子目录）中的 C/C++ 源码文件，返回相对 baseDirectory 的正斜杠路径。 */
export async function collectCppSourceFiles(baseDirectory: string, maxFiles = 500): Promise<string[]> {
  const sourceFiles: string[] = [];
  const walk = async (absoluteDirectory: string, relativeDirectory: string, depth: number): Promise<void> => {
    if (sourceFiles.length >= maxFiles || depth > 3) return;
    const entries = await readDirSafe(absoluteDirectory);
    for (const entry of entries) {
      if (sourceFiles.length >= maxFiles) return;
      const relativePath = relativeDirectory === '.' ? entry.name : `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory) {
        if (EXTERNAL_SCAN_SKIPPED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
        await walk(path.join(absoluteDirectory, entry.name), relativePath, depth + 1);
      } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        sourceFiles.push(relativePath);
      }
    }
  };
  await walk(baseDirectory, '.', 0);
  return sourceFiles.sort((left, right) => left.localeCompare(right));
}

/** 生成最小可构建的 CMakeLists.txt（显式源码列表，C++17）；生成物由注释明确标注。 */
export function generateCMakeSkeleton(projectName: string, sourceFiles: readonly string[]): string {
  const lines = [
    '# 本文件由 LingBuilder 扫描源码目录自动生成，可自由修改。',
    'cmake_minimum_required(VERSION 3.20)',
    `project(${projectName} LANGUAGES CXX)`,
    '',
    'set(CMAKE_CXX_STANDARD 17)',
    'set(CMAKE_CXX_STANDARD_REQUIRED ON)',
    '',
    `add_executable(${projectName}`
  ];
  for (const sourceFile of sourceFiles) lines.push(`  "${sourceFile}"`);
  lines.push(')');
  return `${lines.join('\n')}\n`;
}
