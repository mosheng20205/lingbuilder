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
