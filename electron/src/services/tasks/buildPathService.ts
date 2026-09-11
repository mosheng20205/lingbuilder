import path from 'node:path';

import { type BuildPathTemplates, getEffectiveBuildPathTemplates, resolveBuildPathTemplate } from './buildPathTemplate';

/**
 * 构建输出路径解析服务：中文 IDE 的构建目录与可复制生成源码目录允许用户按
 * Visual Studio 习惯自定义，所有构建、导出、清理、运行链路必须从本服务解析路径，
 * 禁止重新散落硬编码 `.lingbuilder-build` / `generated/cpp` 字面量。
 * 模板宏与校验的纯函数部分见 `buildPathTemplate.ts`（渲染层共用）。
 */

export {
  BUILD_PATH_MACROS,
  DEFAULT_BUILD_DIRECTORY_TEMPLATE,
  DEFAULT_GENERATED_SOURCE_DIRECTORY_TEMPLATE,
  getActiveWorkspaceBuildExcludeDirs,
  getEffectiveBuildPathTemplates,
  isPathExcludedAsBuildOutput,
  isRelativePathInsideDir,
  resolveBuildPathTemplate,
  sanitizePathSegmentValue,
  setActiveWorkspaceBuildExcludeDirs,
  validateBuildPathTemplate
} from './buildPathTemplate';
export type { BuildPathTemplateVariables, BuildPathTemplates, EffectiveBuildPathTemplates } from './buildPathTemplate';

export interface ResolvedProjectBuildDirectories {
  /** 工作区相对构建目录（`/` 分隔）。 */
  relativeBuildDir: string;
  buildDir: string;
  sourceDir: string;
  binDir: string;
  objDir: string;
  /** 工作区相对可复制生成源码目录（`/` 分隔）。 */
  relativeExportDir: string;
  exportDir: string;
}

/**
 * 解析一个项目的全部构建输出目录。projectDirName 必须由调用方按既有规则净化，
 * 保证缺省模板解析结果与历史 `.lingbuilder-build/<净化ID>/<平台>/<配置>` 完全一致。
 */
export function resolveProjectBuildDirectories(options: {
  workspaceRoot: string;
  projectDirName: string;
  projectName?: string;
  platform: string;
  configuration: string;
  templates?: BuildPathTemplates | null;
}): ResolvedProjectBuildDirectories {
  const templates = getEffectiveBuildPathTemplates(options.templates);
  const variables = {
    projectDirName: options.projectDirName,
    projectName: options.projectName,
    platform: options.platform,
    configuration: options.configuration
  };
  const relativeBuildDir = resolveBuildPathTemplate(templates.buildDirectory, variables);
  const relativeExportDir = resolveBuildPathTemplate(templates.generatedSourceDirectory, variables);
  const buildDir = path.join(options.workspaceRoot, ...relativeBuildDir.split('/'));
  const exportDir = path.join(options.workspaceRoot, ...relativeExportDir.split('/'));
  assertDisjointProjectBuildPaths(buildDir, exportDir, options.workspaceRoot);
  return {
    relativeBuildDir,
    buildDir,
    sourceDir: path.join(buildDir, 'src'),
    binDir: path.join(buildDir, 'bin'),
    objDir: path.join(buildDir, 'obj'),
    relativeExportDir,
    exportDir
  };
}

/**
 * 保存前的一致性校验：构建目录与生成源码目录必须都落在工作区内，且互不重合、互不嵌套。
 * 与其他项目目录的冲突校验由 solutionService 在保存时统一执行。
 */
export function assertDisjointProjectBuildPaths(buildDir: string, exportDir: string, workspaceRoot: string): void {
  const resolvedBuild = path.resolve(buildDir);
  const resolvedExport = path.resolve(exportDir);
  const resolvedRoot = path.resolve(workspaceRoot);
  for (const [label, target] of [['构建目录', resolvedBuild], ['生成源码目录', resolvedExport]] as const) {
    const relative = path.relative(resolvedRoot, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`${label}必须位于当前工作区内：${target}`);
    }
  }
  const buildToExport = path.relative(resolvedBuild, resolvedExport);
  if (!buildToExport || (!buildToExport.startsWith('..') && !path.isAbsolute(buildToExport))) {
    throw new Error('生成源码目录不能与构建目录重合或位于构建目录内部。');
  }
  const exportToBuild = path.relative(resolvedExport, resolvedBuild);
  if (!exportToBuild.startsWith('..') && !path.isAbsolute(exportToBuild)) {
    throw new Error('构建目录不能与生成源码目录重合或位于生成源码目录内部。');
  }
}
