import type { CppFile } from '../../types';

export interface ProjectFileUiState {
  files: CppFile[];
  openTabs: string[];
  activeFilePath: string | null;
}

export function applyProjectFileRename(
  state: ProjectFileUiState,
  sourcePath: string,
  targetPath: string,
  language: CppFile['language']
): ProjectFileUiState {
  const source = state.files.find(file => file.path === sourcePath);
  if (!source) throw new Error(`当前工作台中找不到待重命名文件：${sourcePath}`);
  if (state.files.some(file => file.path === targetPath)) {
    throw new Error(`目标文件已在工作台中打开：${targetPath}`);
  }

  const renamed: CppFile = {
    ...source,
    path: targetPath,
    name: targetPath.split('/').pop() || targetPath,
    language
  };
  return {
    files: state.files.map(file => file.path === sourcePath ? renamed : file),
    openTabs: dedupePaths(state.openTabs.map(tabPath => tabPath === sourcePath ? targetPath : tabPath)),
    activeFilePath: state.activeFilePath === sourcePath ? targetPath : state.activeFilePath
  };
}

export function applyProjectFileDelete(
  state: ProjectFileUiState,
  filePath: string
): ProjectFileUiState {
  if (!state.files.some(file => file.path === filePath)) {
    throw new Error(`当前工作台中找不到待删除文件：${filePath}`);
  }

  const files = state.files.filter(file => file.path !== filePath);
  const deletedTabIndex = state.openTabs.indexOf(filePath);
  let openTabs = state.openTabs.filter(tabPath => tabPath !== filePath && files.some(file => file.path === tabPath));
  if (openTabs.length === 0 && files.length > 0) openTabs = [files[0].path];

  let activeFilePath = state.activeFilePath;
  if (activeFilePath === filePath || (activeFilePath && !files.some(file => file.path === activeFilePath))) {
    const neighborIndex = Math.max(0, Math.min(deletedTabIndex, openTabs.length - 1));
    activeFilePath = openTabs[neighborIndex] || files[0]?.path || null;
  }
  return { files, openTabs, activeFilePath };
}

function dedupePaths(paths: string[]): string[] {
  return paths.filter((path, index) => paths.indexOf(path) === index);
}

/**
 * 项目文本文件扩展名白名单：与服务端 `/api/window-designer/files` 保存门禁同一份
 * 单一事实源（server.ts 的 isAllowedProjectTextPath 也从这里导入），两边口径必须逐字一致。
 */
export const PROJECT_SAVE_TEXT_EXTS: readonly string[] = [
  '.lcpp', '.cpp', '.h', '.rc', '.xml', '.json', '.ini', '.e'
];

export interface ProjectSaveScope {
  sourceRoot?: string;
  configRoot?: string;
  isDefault?: boolean;
}

/**
 * 归一化项目作用域根：`.` 与空串按「项目根 = 工作区根」处理（与
 * resolveLingCppProjectSources 的 sourceRoot 语义一致），否则去掉尾部斜杠。
 */
function normalizeProjectScopeRoot(root: string | undefined): string {
  const normalized = String(root || '').replace(/\\/g, '/').replace(/^\.\/?$/u, '').replace(/\/+$/u, '');
  return normalized;
}

/**
 * 路径是否落在项目作用域内（sourceRoot / configRoot，默认项目兼容 src/、config/）。
 * 只判作用域，不判扩展名与越界——服务端按失败原因分别报错，客户端组合判断用于过滤。
 */
export function isPathInsideProjectScope(path: string, scope: ProjectSaveScope): boolean {
  const normalized = path.replace(/\\/g, '/');
  const inRoot = (root: string | undefined): boolean => {
    const prefix = normalizeProjectScopeRoot(root);
    return prefix === '' ? true : normalized.startsWith(`${prefix}/`);
  };
  if (inRoot(scope.sourceRoot) || inRoot(scope.configRoot)) return true;
  if (scope.isDefault && (normalized.startsWith('src/') || normalized.startsWith('config/'))) return true;
  return false;
}

/**
 * 模块内部路径（`.lingbuilder/modules/**`）：内置/第三方模块的安装目录与升级自愈暂存
 * 目录（`.lingbuilder.new_emoji.ui.next-<pid>` 形态）都在这里。它们永远不是用户项目
 * 文件——即使因模块文档查看等原因成了打开的编辑器文档，也不能进「构建前保存」载荷，
 * 否则服务端保存门禁会拒绝整个保存并取消 F5（真机 2026-10-03）。
 */
export function isModuleInternalPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  return normalized === '.lingbuilder/modules'
    || normalized.startsWith('.lingbuilder/modules/');
}

/**
 * IDE 管理目录（`.lingbuilder/**`、`.lingbuilder-build/**`、`generated/**`）：
 * 工作区配置、模块安装与升级快照（`.lingbuilder/module-snapshots/<id>-<时间戳>`，
 * 含 6MB+ 的模块清单与目录 JSON）、构建产物和 F5 生成的 C++ 工程都在这里。
 * 它们不是用户项目源码，但白名单扩展名（.json/.h/.cpp…）都命中——在 configRoot='.'
 * 的项目（进程代理工作台实测）里整棵工作区都在保存作用域内，这些文件会被「构建前
 * 保存」整包 POST（实测 32MB 级载荷 → HTTP 413 → F5 取消），甚至把编辑器内容回写进
 * 模块升级快照。因此可保存性判定必须整树排除；设计器模型不受影响（经请求体 project
 * 字段整份保存，excludedPaths 只负责防同目标双写）。服务端保存/转码路由用同一份
 * 谓词拒绝（口径逐字一致）。
 */
export function isIdeManagedWorkspacePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  return IDE_MANAGED_WORKSPACE_DIRS.some(dir => normalized === dir || normalized.startsWith(`${dir}/`));
}

const IDE_MANAGED_WORKSPACE_DIRS: readonly string[] = ['.lingbuilder', '.lingbuilder-build', 'generated'];

/**
 * 「构建前保存」可保存性：与服务端保存门禁逐条同口径——
 * ① 不越界（无 `..` 段）；② 非 IDE 管理目录路径（含模块内部与升级快照）；
 * ③ 扩展名在白名单内；
 * ④ 落在项目作用域内（sourceRoot / configRoot，默认项目兼容 src/、config/）；
 * ⑤ 不在排除名单（excludedPaths：随保存请求单独通道传输的文件，典型是
 *    项目 designerPath——设计器模型经请求体 project 字段整份保存，若它同时
 *    出现在 files[]，服务端会因同目标写两次而整单拒绝，真机 2026-10-03）。
 * 客户端先按同一口径过滤，避免一个不可保存文件被服务端整单拒绝、取消整个 F5。
 */
export function isProjectSaveableFilePath(
  path: string,
  scope: ProjectSaveScope,
  excludedPaths?: readonly string[]
): boolean {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.split('/').includes('..')) return false;
  if (isIdeManagedWorkspacePath(normalized)) return false;
  if (excludedPaths?.some(excluded => normalized === excluded.replace(/\\/g, '/'))) return false;
  const lower = normalized.toLowerCase();
  if (!PROJECT_SAVE_TEXT_EXTS.some(ext => lower.endsWith(ext))) return false;
  return isPathInsideProjectScope(normalized, scope);
}

/** 按可保存性过滤文件集合，返回保留项、剔除数量与剔除样例（供日志展示）。 */
export function filterProjectSaveableFiles<T extends { path: string }>(
  files: readonly T[],
  scope: ProjectSaveScope,
  excludedPaths?: readonly string[]
): { kept: T[]; dropped: number; droppedPaths: string[] } {
  const kept: T[] = [];
  const droppedPaths: string[] = [];
  for (const file of files) {
    if (isProjectSaveableFilePath(file.path, scope, excludedPaths)) {
      kept.push(file);
    } else {
      droppedPaths.push(file.path);
    }
  }
  return { kept, dropped: droppedPaths.length, droppedPaths };
}
