import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
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
  /** CEF3 等模块要求主程序与 C++ 运行时使用动态 CRT（/MD）。 */
  requiresDynamicCrt?: boolean;
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

  if (enabledModules.some(module => module.manifest.id === 'lingbuilder.cef3.browser')) {
    await materializeCef3Sdk(layout, plan);
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
  if (enabledModules.some(module => module.manifest.id === 'lingbuilder.cef3.browser')) {
    const plan: ModuleNativeDependencyPlan = { includeDirs: [], sourceFiles: [], libFiles: [], runtimeFiles: [], diagnostics, requiresMsvc: true };
    await materializeCef3Sdk({
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

async function materializeCef3Sdk(
  layout: ModuleNativeDependencyLayout,
  plan: ModuleNativeDependencyPlan
): Promise<void> {
  const sdkRoot = await findCef3SdkRoot(layout);
  plan.requiresMsvc = true;
  plan.requiresDynamicCrt = true;
  if (!sdkRoot) {
    plan.diagnostics.push('CEF3 模块缺少 Chromium Embedded Framework SDK。推荐方式：安装 CEF3 内核 SDK 离线模块包（lingbuilder.cef3.sdk，含预编译 libcef_dll_wrapper，免下载免编译）。手动方式：从 https://cef-builds.spotifycdn.com/index.html 下载最新稳定版 windows64 标准包（如 cef_binary_150.0.14+..._windows64.tar.bz2），解压后把 cef_binary_* 目录内容放到工作区 .lingbuilder/cef3-sdk 或 C:\\cef3-sdk，或设置 CEF3_SDK_ROOT 环境变量指向该目录，然后重新构建。LingBuilder 会自动用 CMake 编译 libcef_dll_wrapper。');
    return;
  }
  const moduleRoot = path.join('modules', 'lingbuilder.cef3.browser');
  const architecture = layout.preferredTargetId === 'windows-msvc-x64' ? 'x64' : 'Win32';
  const isOfficialLayout = await pathExists(path.join(sdkRoot, 'Release', 'libcef.dll'));
  const includeSource = path.join(sdkRoot, 'include');
  const roots = unique([
    path.join(layout.buildDir, moduleRoot),
    path.join(layout.sourceDir, moduleRoot),
    path.join(layout.exportDir, moduleRoot)
  ]);
  try {
    for (const root of roots) {
      await copyDirectoryRecursive(includeSource, path.join(root, 'include'));
    }

    const libcefLibSource = isOfficialLayout
      ? path.join(sdkRoot, 'Release', 'libcef.lib')
      : path.join(sdkRoot, 'lib', architecture, 'libcef.lib');
    const dllSource = isOfficialLayout
      ? path.join(sdkRoot, 'Release')
      : path.join(sdkRoot, 'bin', architecture);

    let wrapperLibSource: string | null;
    if (isOfficialLayout) {
      wrapperLibSource = await ensureCefDllWrapper(sdkRoot, architecture, plan);
    } else {
      wrapperLibSource = path.join(sdkRoot, 'lib', architecture, 'libcef_dll_wrapper.lib');
    }

    const libTargetDir = path.join(layout.buildDir, moduleRoot, 'lib', architecture);
    await fs.mkdir(libTargetDir, { recursive: true });
    await fs.copyFile(libcefLibSource, path.join(libTargetDir, 'libcef.lib'));
    if (wrapperLibSource && await pathExists(wrapperLibSource)) {
      await fs.copyFile(wrapperLibSource, path.join(libTargetDir, 'libcef_dll_wrapper.lib'));
    } else {
      plan.diagnostics.push('CEF3 缺少 libcef_dll_wrapper.lib，链接将失败。请确认 SDK 完整或 CMake 可用。');
    }

    await fs.mkdir(layout.binDir, { recursive: true });
    // v8_context_snapshot.bin 缺失时渲染进程无法启动（白屏）；GPU/软渲染 DLL 按 CEF 官方分发要求一并复制。
    const requiredRuntimeFiles = ['libcef.dll', 'chrome_elf.dll', 'v8_context_snapshot.bin'];
    const optionalRuntimeFiles = [
      'd3dcompiler_47.dll', 'dxcompiler.dll', 'dxil.dll', 'libEGL.dll', 'libGLESv2.dll',
      'vk_swiftshader.dll', 'vk_swiftshader_icd.json', 'vulkan-1.dll'
    ];
    for (const name of requiredRuntimeFiles) {
      try {
        await fs.copyFile(path.join(dllSource, name), path.join(layout.binDir, name));
      } catch {
        plan.diagnostics.push(`CEF3 运行时文件缺失：${isOfficialLayout ? 'Release' : `bin/${architecture}`}/${name}。`);
      }
    }
    for (const name of optionalRuntimeFiles) {
      try {
        await fs.copyFile(path.join(dllSource, name), path.join(layout.binDir, name));
      } catch {
        // 可选 GPU 运行时文件缺失时不阻断构建。
      }
    }
    const resourcesSource = path.join(sdkRoot, 'Resources');
    try {
      await copyDirectoryRecursive(resourcesSource, layout.binDir);
    } catch {
      // Resources 目录可选；缺失时 CEF 会给出自己的诊断。
    }
    plan.includeDirs.push(path.join(layout.sourceDir, moduleRoot, 'include'));
    plan.includeDirs.push(path.join(layout.sourceDir, moduleRoot));
    plan.libFiles.push(path.join(libTargetDir, 'libcef.lib'));
    plan.libFiles.push(path.join(libTargetDir, 'libcef_dll_wrapper.lib'));
  } catch (error) {
    plan.diagnostics.push(`准备 CEF3 SDK 失败：${errorMessage(error)}`);
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function runCefCommand(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 15 * 60 * 1000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${errorMessage(error)}\n${stderr || stdout || ''}`.trim()));
        return;
      }
      resolve({ stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

async function findCmake(): Promise<string | null> {
  try {
    const { stdout } = await runCefCommand('where.exe', ['cmake.exe'], process.cwd());
    const first = stdout.split(/\r?\n/).map(line => line.trim()).find(Boolean);
    if (first) return first;
  } catch {
    // PATH 中没有 CMake，继续查找 Visual Studio 内置版本。
  }
  const programFiles = [process.env['ProgramFiles'] || 'C:\\Program Files', process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'];
  const relative = path.join('Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin', 'cmake.exe');
  for (const root of programFiles) {
    for (const version of ['2022', '2019']) {
      for (const edition of ['Community', 'Professional', 'Enterprise', 'BuildTools']) {
        const candidate = path.join(root, 'Microsoft Visual Studio', version, edition, relative);
        if (await pathExists(candidate)) return candidate;
      }
    }
  }
  return null;
}

async function ensureCefDllWrapper(sdkRoot: string, architecture: string, plan: ModuleNativeDependencyPlan): Promise<string | null> {
  // LingBuilder 编译链使用 /MD 动态 CRT；wrapper 必须用相同 CRT 编译，否则链接时报 LNK2038。
  // 目录带 _md 后缀，避免命中历史 /MT 产物。
  const buildDir = path.join(sdkRoot, `build_wrapper_${architecture}_md`);
  const wrapperCandidates = [
    path.join(buildDir, 'libcef_dll_wrapper', 'Release', 'libcef_dll_wrapper.lib'),
    path.join(buildDir, 'libcef_dll', 'Release', 'libcef_dll_wrapper.lib'),
    path.join(buildDir, 'Release', 'libcef_dll_wrapper.lib'),
    path.join(buildDir, 'libcef_dll_wrapper.lib')
  ];
  for (const candidate of wrapperCandidates) {
    if (await pathExists(candidate)) return candidate;
  }

  const cmake = await findCmake();
  if (!cmake) {
    plan.diagnostics.push('CEF3 官方包需要用 CMake 编译 libcef_dll_wrapper，但未找到 CMake。请安装 CMake 并加入 PATH，或安装 Visual Studio 2022（自带 CMake）后重新构建。');
    return null;
  }

  plan.diagnostics.push('首次构建 CEF3：正在用 CMake 编译 libcef_dll_wrapper（约 1-3 分钟，仅一次）…');
  try {
    await patchCefCMakeListsForCxxOnly(sdkRoot);
    await runCefCommand(cmake, ['-S', sdkRoot, '-B', buildDir, '-A', architecture, '-DCMAKE_BUILD_TYPE=Release', '-DUSE_SANDBOX=Off', '-DCEF_RUNTIME_LIBRARY_FLAG=/MD'], sdkRoot);
    await runCefCommand(cmake, ['--build', buildDir, '--config', 'Release', '--target', 'libcef_dll_wrapper'], sdkRoot);
    for (const candidate of wrapperCandidates) {
      if (await pathExists(candidate)) return candidate;
    }
    const found = await findFileRecursive(buildDir, 'libcef_dll_wrapper.lib');
    if (found) return found;
    plan.diagnostics.push(`CEF3 libcef_dll_wrapper 编译完成但未在 ${buildDir} 下找到 libcef_dll_wrapper.lib，请检查 CMake 输出。`);
    return null;
  } catch (error) {
    plan.diagnostics.push(`CEF3 libcef_dll_wrapper 编译失败：${errorMessage(error)}`);
    return null;
  }
}

// CEF 官方 CMakeLists 的 project(cef) 默认启用 C+CXX 两种语言；部分 Visual Studio 自带
// CMake 在 C 编译器工具查找阶段会崩溃（0xC0000409）。wrapper 是纯 C++，改为只启用 CXX。
async function patchCefCMakeListsForCxxOnly(sdkRoot: string): Promise<void> {
  const cmakeListsPath = path.join(sdkRoot, 'CMakeLists.txt');
  try {
    const content = await fs.readFile(cmakeListsPath, 'utf8');
    if (/project\(cef\)/.test(content)) {
      await fs.writeFile(cmakeListsPath, content.replace(/project\(cef\)/, 'project(cef LANGUAGES CXX)'), 'utf8');
    }
  } catch {
    // CMakeLists.txt 缺失或不可写时保持原样，由后续 CMake 输出给出诊断。
  }
}

async function findFileRecursive(root: string, fileName: string): Promise<string | null> {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const found = await findFileRecursive(full, fileName);
      if (found) return found;
    } else if (entry.isFile() && entry.name === fileName) {
      return full;
    }
  }
  return null;
}

async function findCef3SdkRoot(layout?: ModuleNativeDependencyLayout): Promise<string | null> {
  // buildDir 固定为 <workspace>/.lingbuilder-build/<项目>，据此反推工作区根目录，
  // 避免相对路径候选受进程 cwd 影响。
  const workspaceRoot = layout ? path.resolve(layout.buildDir, '..', '..') : '';
  const sdkModuleRelative = path.join('.lingbuilder', 'modules', 'lingbuilder.cef3.sdk', 'sdk');
  const candidates = unique([
    process.env.CEF3_SDK_ROOT || '',
    workspaceRoot ? path.join(workspaceRoot, '.lingbuilder', 'cef3-sdk') : '',
    workspaceRoot ? path.join(workspaceRoot, sdkModuleRelative) : '',
    path.join('.lingbuilder', 'cef3-sdk'),
    sdkModuleRelative,
    'C:\\cef3-sdk'
  ].filter(Boolean));
  for (const root of candidates) {
    try {
      await fs.access(path.join(root, 'include', 'cef_app.h'));
      return root;
    } catch {
      // 尝试下一个候选 SDK 根目录。
    }
  }
  return null;
}

async function copyDirectoryRecursive(source: string, target: string): Promise<void> {
  const entries = await fs.readdir(source, { withFileTypes: true });
  await fs.mkdir(target, { recursive: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDirectoryRecursive(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
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
