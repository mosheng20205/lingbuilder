import fs from 'node:fs/promises';
import path from 'node:path';
import { InstalledModule } from './types';
import { validateModuleRelativePath } from './manifest';
import { getPreferredModuleTarget, getUnsupportedModuleTargetDiagnostic } from './targetResolver';

export interface ModuleNativeDependencyLayout {
  buildDir: string;
  sourceDir: string;
  binDir: string;
  exportDir: string;
  preferredTargetId?: string;
}

export interface ModuleNativeDependencyPlan {
  includeDirs: string[];
  sourceFiles: string[];
  libFiles: string[];
  runtimeFiles: string[];
  diagnostics: string[];
  requiresMsvc: boolean;
}

export async function materializeModuleNativeDependencies(
  enabledModules: InstalledModule[],
  layout: ModuleNativeDependencyLayout
): Promise<ModuleNativeDependencyPlan> {
  const plan: ModuleNativeDependencyPlan = {
    includeDirs: [],
    sourceFiles: [],
    libFiles: [],
    runtimeFiles: [],
    diagnostics: [],
    requiresMsvc: false
  };

  if (enabledModules.some(module => module.manifest.id === 'lingbuilder.edgeview')) {
    await materializeEdgeViewSdk(layout, plan);
  }

  for (const module of enabledModules.filter(item => !item.isBuiltin)) {
    const target = getPreferredModuleTarget(module, layout.preferredTargetId);
    if (!target) {
      const diagnostic = getUnsupportedModuleTargetDiagnostic(module, layout.preferredTargetId);
      if (diagnostic) plan.diagnostics.push(diagnostic);
      continue;
    }
    if (!module.installPath || module.installPath.startsWith('builtin://')) continue;

    const moduleId = module.manifest.id;
    const buildModuleRoot = path.join(layout.buildDir, 'modules', moduleId);
    const sourceModuleRoot = path.join(layout.sourceDir, 'modules', moduleId);
    const exportModuleRoot = path.join(layout.exportDir, 'modules', moduleId);

    for (const relativePath of unique([
      ...(target.headers || []),
      ...(target.sources || []),
      ...(target.libs || []),
      ...(target.runtimeFiles || [])
    ])) {
      await copyModuleFile(module, relativePath, buildModuleRoot, plan.diagnostics);
      await copyModuleFile(module, relativePath, exportModuleRoot, plan.diagnostics);
    }
    for (const relativePath of unique((module.manifest.targets || []).flatMap(candidate => [
      ...(candidate.headers || []), ...(candidate.sources || []), ...(candidate.libs || []), ...(candidate.runtimeFiles || [])
    ]))) {
      await copyModuleFile(module, relativePath, exportModuleRoot, plan.diagnostics);
    }

    for (const relativePath of unique([...(target.headers || []), ...(target.sources || [])])) {
      await copyModuleFile(module, relativePath, sourceModuleRoot, plan.diagnostics);
    }

    for (const includeDir of target.includeDirs || []) {
      if (!validateModuleRelativePath(includeDir)) {
        plan.diagnostics.push(`模块 ${module.manifest.name} 的 includeDirs 包含不安全路径：${includeDir}`);
        continue;
      }
      plan.includeDirs.push(path.join(sourceModuleRoot, includeDir));
    }

    for (const header of target.headers || []) {
      const firstSegment = normalizeRelativePath(header).split('/')[0];
      if (firstSegment && !plan.includeDirs.includes(path.join(sourceModuleRoot, firstSegment))) {
        plan.includeDirs.push(path.join(sourceModuleRoot, firstSegment));
      }
    }

    for (const source of target.sources || []) {
      if (!validateModuleRelativePath(source)) {
        plan.diagnostics.push(`模块 ${module.manifest.name} 的源码包含不安全路径：${source}`);
        continue;
      }
      plan.sourceFiles.push(path.join(sourceModuleRoot, source));
    }

    for (const lib of target.libs || []) {
      if (!validateModuleRelativePath(lib)) {
        plan.diagnostics.push(`模块 ${module.manifest.name} 的库文件包含不安全路径：${lib}`);
        continue;
      }
      if (lib.toLowerCase().endsWith('.lib')) plan.requiresMsvc = true;
      plan.libFiles.push(path.join(buildModuleRoot, lib));
    }

    for (const runtimeFile of target.runtimeFiles || []) {
      if (!validateModuleRelativePath(runtimeFile)) {
        plan.diagnostics.push(`模块 ${module.manifest.name} 的运行时文件包含不安全路径：${runtimeFile}`);
        continue;
      }
      const sourcePath = path.join(module.installPath, runtimeFile);
      const targetPath = path.join(layout.binDir, path.basename(runtimeFile));
      try {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.copyFile(sourcePath, targetPath);
        plan.runtimeFiles.push(targetPath);
      } catch (error) {
        plan.diagnostics.push(`复制模块运行时文件失败：${module.manifest.name} / ${runtimeFile} / ${errorMessage(error)}`);
      }
    }
  }

  plan.includeDirs = unique(plan.includeDirs);
  plan.sourceFiles = unique(plan.sourceFiles);
  plan.libFiles = unique(plan.libFiles);
  plan.runtimeFiles = unique(plan.runtimeFiles);
  return plan;
}

export async function exportModuleNativeDependencies(
  enabledModules: InstalledModule[],
  exportDir: string
): Promise<string[]> {
  const diagnostics: string[] = [];
  if (enabledModules.some(module => module.manifest.id === 'lingbuilder.edgeview')) {
    const plan: ModuleNativeDependencyPlan = { includeDirs: [], sourceFiles: [], libFiles: [], runtimeFiles: [], diagnostics, requiresMsvc: true };
    await materializeEdgeViewSdk({
      buildDir: exportDir,
      sourceDir: exportDir,
      binDir: exportDir,
      exportDir,
      preferredTargetId: 'windows-msvc-win32'
    }, plan);
  }
  for (const module of enabledModules.filter(item => !item.isBuiltin)) {
    const target = getPreferredModuleTarget(module);
    if (!target) {
      const diagnostic = getUnsupportedModuleTargetDiagnostic(module);
      if (diagnostic) diagnostics.push(diagnostic);
      continue;
    }
    if (!module.installPath || module.installPath.startsWith('builtin://')) continue;
    const exportModuleRoot = path.join(exportDir, 'modules', module.manifest.id);
    for (const relativePath of unique([
      ...(target.headers || []),
      ...(target.sources || []),
      ...(target.libs || []),
      ...(target.runtimeFiles || [])
    ])) {
      await copyModuleFile(module, relativePath, exportModuleRoot, diagnostics);
    }
  }
  return diagnostics;
}

async function materializeEdgeViewSdk(
  layout: ModuleNativeDependencyLayout,
  plan: ModuleNativeDependencyPlan
): Promise<void> {
  const packageRoot = await findLatestWebView2Package();
  if (!packageRoot) {
    plan.diagnostics.push('EdgeView 模块缺少 Microsoft.Web.WebView2 NuGet SDK。请先恢复该包后重新构建。');
    plan.requiresMsvc = true;
    return;
  }
  const moduleRoot = path.join('modules', 'lingbuilder.edgeview');
  const includeSource = path.join(packageRoot, 'build', 'native', 'include');
  const architecture = layout.preferredTargetId === 'windows-msvc-x64' ? 'x64' : 'x86';
  const loaderSource = path.join(packageRoot, 'build', 'native', architecture, 'WebView2Loader.dll');
  const roots = unique([
    path.join(layout.buildDir, moduleRoot),
    path.join(layout.sourceDir, moduleRoot),
    path.join(layout.exportDir, moduleRoot)
  ]);
  try {
    for (const root of roots) {
      await fs.mkdir(path.join(root, 'include'), { recursive: true });
      await fs.copyFile(path.join(includeSource, 'WebView2.h'), path.join(root, 'include', 'WebView2.h'));
      await fs.copyFile(path.join(includeSource, 'WebView2EnvironmentOptions.h'), path.join(root, 'include', 'WebView2EnvironmentOptions.h'));
      const packagedLoader = path.join(root, 'bin', architecture, 'WebView2Loader.dll');
      await fs.mkdir(path.dirname(packagedLoader), { recursive: true });
      await fs.copyFile(loaderSource, packagedLoader);
    }
    for (const exportArchitecture of ['x86', 'x64']) {
      const exportLoaderSource = path.join(packageRoot, 'build', 'native', exportArchitecture, 'WebView2Loader.dll');
      const exportLoaderTarget = path.join(layout.exportDir, moduleRoot, 'bin', exportArchitecture, 'WebView2Loader.dll');
      await fs.mkdir(path.dirname(exportLoaderTarget), { recursive: true });
      await fs.copyFile(exportLoaderSource, exportLoaderTarget);
    }
    await fs.mkdir(layout.binDir, { recursive: true });
    const runtimeTarget = path.join(layout.binDir, 'WebView2Loader.dll');
    await fs.copyFile(loaderSource, runtimeTarget);
    plan.includeDirs.push(path.join(layout.sourceDir, moduleRoot, 'include'));
    plan.runtimeFiles.push(runtimeTarget);
    plan.requiresMsvc = true;
  } catch (error) {
    plan.diagnostics.push(`准备 EdgeView WebView2 SDK 失败：${errorMessage(error)}`);
  }
}

async function findLatestWebView2Package(): Promise<string | null> {
  const candidates = unique([
    process.env.NUGET_PACKAGES ? path.join(process.env.NUGET_PACKAGES, 'microsoft.web.webview2') : '',
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.nuget', 'packages', 'microsoft.web.webview2') : ''
  ].filter(Boolean));
  for (const root of candidates) {
    try {
      const versions = (await fs.readdir(root, { withFileTypes: true }))
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
      for (const version of versions) {
        const packageRoot = path.join(root, version);
        await fs.access(path.join(packageRoot, 'build', 'native', 'include', 'WebView2.h'));
        return packageRoot;
      }
    } catch {
      // Try the next configured NuGet package root.
    }
  }
  return null;
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/');
}

async function copyModuleFile(
  module: InstalledModule,
  relativePath: string,
  targetRoot: string,
  diagnostics: string[]
): Promise<void> {
  if (!validateModuleRelativePath(relativePath)) {
    diagnostics.push(`模块 ${module.manifest.name} 包含不安全路径：${relativePath}`);
    return;
  }

  const sourcePath = path.join(module.installPath, relativePath);
  const targetPath = path.join(targetRoot, relativePath);
  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  } catch (error) {
    diagnostics.push(`复制模块文件失败：${module.manifest.name} / ${relativePath} / ${errorMessage(error)}`);
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
