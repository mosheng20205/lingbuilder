import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { InstalledModule } from './types';
import { validateModuleRelativePath } from './manifest';
import { getPreferredModuleTarget, getUnsupportedModuleTargetDiagnostic } from './targetResolver';
import { CRYPTO_SDK_MODULE_IDS } from './dataMediaModules';

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
  /** 缺失后不允许继续编译或运行的原生依赖错误。 */
  blockingDiagnostics: string[];
  requiresMsvc: boolean;
  /** CEF3 等模块要求主程序与 C++ 运行时使用动态 CRT（/MD）。 */
  requiresDynamicCrt?: boolean;
  /** 已启用原生模块要求的最低 C++ 语言标准；普通项目默认使用 C++17。 */
  requiredCppStandard?: 17 | 20;
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
    blockingDiagnostics: [],
    requiresMsvc: false
  };

  const enabledIds = new Set(enabledModules.map(module => module.manifest.id));
  if (enabledIds.has('lingbuilder.fbro.browser') && enabledIds.has('lingbuilder.cef3.browser')) {
    addBlockingDiagnostic(plan, 'FBro 浏览器（CEF 135）与 LingBuilder CEF3 浏览器（CEF 150）不能在同一项目中启用。请禁用其中一个模块。');
    return plan;
  }
  if (enabledIds.has('lingbuilder.fbro.browser')) {
    const otherCefModule = enabledModules.find(module => module.manifest.id !== 'lingbuilder.fbro.browser'
      && (module.manifest.targets || []).some(target => (target.runtimeFiles || [])
        .some(file => path.basename(file).toLowerCase() === 'libcef.dll')));
    if (otherCefModule) {
      addBlockingDiagnostic(plan, `FBro 浏览器检测到其它模块 ${otherCefModule.manifest.name} 也携带 libcef.dll，已阻止混用不同 CEF 版本。`);
      return plan;
    }
  }

  if (enabledModules.some(module => module.manifest.id === 'lingbuilder.edgeview')) {
    await materializeEdgeViewSdk(layout, plan);
  }

  if (enabledModules.some(module => module.manifest.id === 'lingbuilder.cef3.browser')) {
    await materializeCef3Sdk(layout, plan);
  }

  if (enabledModules.some(module => module.manifest.id === 'lingbuilder.fbro.browser')) {
    await materializeFbroSdk(layout, plan);
  }

  if (enabledModules.some(module => CRYPTO_SDK_MODULE_IDS.includes(module.manifest.id as typeof CRYPTO_SDK_MODULE_IDS[number]))) {
    await materializeCryptoSdk(layout, plan);
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
    const plan: ModuleNativeDependencyPlan = { includeDirs: [], sourceFiles: [], libFiles: [], runtimeFiles: [], diagnostics, blockingDiagnostics: [], requiresMsvc: true };
    await materializeEdgeViewSdk({
      buildDir: exportDir,
      sourceDir: exportDir,
      binDir: exportDir,
      exportDir,
      preferredTargetId: 'windows-msvc-win32'
    }, plan);
  }
  if (enabledModules.some(module => module.manifest.id === 'lingbuilder.cef3.browser')) {
    const plan: ModuleNativeDependencyPlan = { includeDirs: [], sourceFiles: [], libFiles: [], runtimeFiles: [], diagnostics, blockingDiagnostics: [], requiresMsvc: true };
    await materializeCef3Sdk({
      buildDir: exportDir,
      sourceDir: exportDir,
      binDir: exportDir,
      exportDir,
      preferredTargetId: 'windows-msvc-win32'
    }, plan);
  }
  if (enabledModules.some(module => module.manifest.id === 'lingbuilder.fbro.browser')) {
    const plan: ModuleNativeDependencyPlan = { includeDirs: [], sourceFiles: [], libFiles: [], runtimeFiles: [], diagnostics, blockingDiagnostics: [], requiresMsvc: true };
    await materializeFbroSdk({
      buildDir: exportDir,
      sourceDir: exportDir,
      binDir: exportDir,
      exportDir,
      preferredTargetId: 'windows-msvc-x64'
    }, plan);
  }
  if (enabledModules.some(module => CRYPTO_SDK_MODULE_IDS.includes(module.manifest.id as typeof CRYPTO_SDK_MODULE_IDS[number]))) {
    const plan: ModuleNativeDependencyPlan = { includeDirs: [], sourceFiles: [], libFiles: [], runtimeFiles: [], diagnostics, blockingDiagnostics: [], requiresMsvc: true };
    await materializeCryptoSdk({
      buildDir: exportDir,
      sourceDir: exportDir,
      binDir: exportDir,
      exportDir,
      preferredTargetId: 'windows-msvc-win32'
    }, plan);
  }
  for (const module of enabledModules.filter(item => !item.isBuiltin)) {
    const preferredTarget = getPreferredModuleTarget(module);
    if (!preferredTarget) {
      const diagnostic = getUnsupportedModuleTargetDiagnostic(module);
      if (diagnostic) diagnostics.push(diagnostic);
      continue;
    }
    if (!module.installPath || module.installPath.startsWith('builtin://')) continue;
    const exportModuleRoot = path.join(exportDir, 'modules', module.manifest.id);
    // Visual Studio 导出同时声明 Win32/x64 配置，因此可移植工程必须携带模块
    // 已发布的全部 Windows MSVC target，不能只复制当前机器首选架构。
    const exportTargets = (module.manifest.targets || []).filter(target => (
      target.platform === 'windows' && target.toolchain === 'msvc'
    ));
    const targets = exportTargets.length > 0 ? exportTargets : [preferredTarget];
    for (const relativePath of unique([
      ...targets.flatMap(target => target.headers || []),
      ...targets.flatMap(target => target.sources || []),
      ...targets.flatMap(target => target.libs || []),
      ...targets.flatMap(target => target.runtimeFiles || [])
    ])) {
      await copyModuleFile(module, relativePath, exportModuleRoot, diagnostics);
    }
  }
  return diagnostics;
}

interface FbroRuntimeManifestFile {
  path: string;
  size: number;
  sha256: string;
}

interface FbroRuntimeManifest {
  schemaVersion: 1;
  sdkVersion: string;
  architecture: 'x64';
  bridgeVersion: string;
  files: FbroRuntimeManifestFile[];
}

const fbroMaterializationLocks = new Map<string, Promise<void>>();

async function materializeFbroSdk(
  layout: ModuleNativeDependencyLayout,
  plan: ModuleNativeDependencyPlan
): Promise<void> {
  plan.requiresMsvc = true;
  if (process.platform !== 'win32') {
    addBlockingDiagnostic(plan, 'FBro 浏览器首版仅支持 Windows、MSVC、x64。');
    return;
  }
  if (layout.preferredTargetId && layout.preferredTargetId !== 'windows-msvc-x64') {
    addBlockingDiagnostic(plan, `FBro 浏览器不支持目标 ${layout.preferredTargetId}，请切换为 windows-msvc-x64。`);
    return;
  }

  const sdkRoot = await findFbroSdkRoot(layout);
  if (!sdkRoot) {
    addBlockingDiagnostic(plan, 'FBro 浏览器缺少内置 SDK。请运行 npm run module:fbro-sdk，或设置 FBRO_SDK_ROOT 指向已生成的 lingbuilder.fbro.sdk/sdk 目录。');
    return;
  }

  const lockKey = path.resolve(layout.binDir);
  const previous = fbroMaterializationLocks.get(lockKey) || Promise.resolve();
  const current = previous.then(() => withFbroFilesystemLock(
    layout.binDir,
    () => materializeFbroSdkUnlocked(sdkRoot, layout, plan)
  ));
  fbroMaterializationLocks.set(lockKey, current);
  try {
    await current;
  } finally {
    if (fbroMaterializationLocks.get(lockKey) === current) fbroMaterializationLocks.delete(lockKey);
  }
}

async function withFbroFilesystemLock(binDir: string, action: () => Promise<void>): Promise<void> {
  await fs.mkdir(binDir, { recursive: true });
  const lockPath = path.join(binDir, '.lingbuilder-fbro-135.0.21.lock');
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      const handle = await fs.open(lockPath, 'wx');
      try {
        await handle.writeFile(`${process.pid}\n${new Date().toISOString()}\n`, 'utf8');
        await action();
      } finally {
        await handle.close();
        await fs.rm(lockPath, { force: true });
      }
      return;
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'EEXIST') throw error;
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > 5 * 60 * 1000) {
          await fs.rm(lockPath, { force: true });
          continue;
        }
      } catch (statError) {
        if (!isNodeError(statError) || statError.code !== 'ENOENT') throw statError;
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('等待 FBro 135.0.21 运行时物化锁超时。');
}

async function materializeFbroSdkUnlocked(
  sdkRoot: string,
  layout: ModuleNativeDependencyLayout,
  plan: ModuleNativeDependencyPlan
): Promise<void> {
  const manifestPath = path.join(sdkRoot, 'runtime-manifest.json');
  let manifest: FbroRuntimeManifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as FbroRuntimeManifest;
  } catch (error) {
    addBlockingDiagnostic(plan, `读取 FBro 运行时清单失败：${errorMessage(error)}`);
    return;
  }
  const manifestError = validateFbroRuntimeManifest(manifest);
  if (manifestError) {
    addBlockingDiagnostic(plan, `FBro 运行时清单无效：${manifestError}`);
    return;
  }
  if (manifest.sdkVersion !== '135.0.21' || manifest.architecture !== 'x64') {
    addBlockingDiagnostic(plan, `FBro SDK 版本或架构不匹配：需要 135.0.21/x64，实际为 ${manifest.sdkVersion}/${manifest.architecture}。`);
    return;
  }

  const moduleRoot = path.join('modules', 'lingbuilder.fbro.browser');
  const bridgeHeader = path.join(sdkRoot, 'include', 'LingBuilderFbroBridge.h');
  const bridgeLib = path.join(sdkRoot, 'lib', 'x64', 'LingBuilderFbroBridge.lib');
  const bridgeDll = path.join(sdkRoot, 'bridge', 'x64', 'LingBuilderFbroBridge.dll');
  for (const required of [bridgeHeader, bridgeLib, bridgeDll]) {
    if (!await pathExists(required)) {
      addBlockingDiagnostic(plan, `FBro SDK 文件缺失：${path.relative(sdkRoot, required).replace(/\\/g, '/')}`);
      return;
    }
  }

  const roots = unique([
    path.join(layout.buildDir, moduleRoot),
    path.join(layout.sourceDir, moduleRoot),
    path.join(layout.exportDir, moduleRoot)
  ]);
  const buildModuleRoot = path.join(layout.buildDir, moduleRoot);
  const exportModuleRoot = path.join(layout.exportDir, moduleRoot);
  try {
    for (const root of roots) {
      await copyFileAtomicallyIfDifferent(bridgeHeader, path.join(root, 'include', 'LingBuilderFbroBridge.h'));
      await copyFileAtomicallyIfDifferent(bridgeLib, path.join(root, 'lib', 'x64', 'LingBuilderFbroBridge.lib'));
      await copyFileAtomicallyIfDifferent(bridgeDll, path.join(root, 'bin', 'x64', 'LingBuilderFbroBridge.dll'));
      await copyFileAtomicallyIfDifferent(manifestPath, path.join(root, 'runtime-manifest.json'));
    }
    await writeTextAtomically(path.join(buildModuleRoot, 'materialize-fbro-runtime.ps1'), fbroExportMaterializerScript());
    await writeTextAtomically(path.join(exportModuleRoot, 'materialize-fbro-runtime.ps1'), fbroExportMaterializerScript());
    await fs.mkdir(layout.binDir, { recursive: true });
    const bridgeTarget = path.join(layout.binDir, 'LingBuilderFbroBridge.dll');
    await copyFileAtomicallyIfDifferent(bridgeDll, bridgeTarget);
    plan.runtimeFiles.push(bridgeTarget);

    const copiedFiles: FbroRuntimeManifestFile[] = [];
    for (const entry of manifest.files) {
      const normalized = normalizeRelativePath(entry.path);
      if (!validateModuleRelativePath(normalized)) {
        throw new Error(`清单包含不安全路径：${entry.path}`);
      }
      const source = path.join(sdkRoot, 'runtime', 'x64', ...normalized.split('/'));
      const target = path.join(layout.binDir, ...normalized.split('/'));
      const sourceMatches = await fileMatchesManifest(source, entry);
      if (!sourceMatches) throw new Error(`源 SDK 文件缺失或哈希错误：runtime/x64/${normalized}`);
      if (!await fileMatchesManifest(target, entry)) {
        await copyFileAtomically(source, target);
        if (!await fileMatchesManifest(target, entry)) throw new Error(`复制后校验失败：${normalized}`);
      }
      const exportTarget = path.join(exportModuleRoot, 'runtime', 'x64', ...normalized.split('/'));
      if (!await fileMatchesManifest(exportTarget, entry)) await copyFileAtomically(source, exportTarget);
      copiedFiles.push(entry);
      plan.runtimeFiles.push(target);
    }

    const statePath = path.join(layout.binDir, '.lingbuilder-fbro-runtime.json');
    const state = {
      schemaVersion: 1,
      sdkVersion: manifest.sdkVersion,
      bridgeVersion: manifest.bridgeVersion,
      architecture: manifest.architecture,
      verifiedAt: new Date().toISOString(),
      files: copiedFiles
    };
    await writeTextAtomically(statePath, `${JSON.stringify(state, null, 2)}\n`);
    plan.includeDirs.push(path.join(layout.sourceDir, moduleRoot, 'include'));
    plan.libFiles.push(path.join(layout.buildDir, moduleRoot, 'lib', 'x64', 'LingBuilderFbroBridge.lib'));
  } catch (error) {
    addBlockingDiagnostic(plan, `准备 FBro SDK 失败：${errorMessage(error)}`);
  }
}

function fbroExportMaterializerScript(): string {
  return `param([Parameter(Mandatory=$true)][string]$Destination, [string]$RuntimeRoot = '')\n` +
    `$ErrorActionPreference = 'Stop'\n` +
    `$moduleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path\n` +
    `$manifest = Get-Content -LiteralPath (Join-Path $moduleRoot 'runtime-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json\n` +
    `if ([string]::IsNullOrWhiteSpace($RuntimeRoot)) { $RuntimeRoot = Join-Path $moduleRoot 'runtime\\x64' }\n` +
    `New-Item -ItemType Directory -Force -Path $Destination | Out-Null\n` +
    `foreach ($entry in $manifest.files) {\n` +
    `  $relative = $entry.path -replace '/', '\\'\n` +
    `  $source = Join-Path $RuntimeRoot $relative\n` +
    `  $target = Join-Path $Destination $relative\n` +
    `  $copy = -not (Test-Path -LiteralPath $target)\n` +
    `  if (-not $copy) { $info = Get-Item -LiteralPath $target; $copy = $info.Length -ne [int64]$entry.size }\n` +
    `  if (-not $copy) { $copy = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256.ToLowerInvariant() }\n` +
    `  if ($copy) {\n` +
    `    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null\n` +
    `    $temporary = $target + '.lingbuilder-tmp-' + $PID\n` +
    `    Copy-Item -LiteralPath $source -Destination $temporary -Force\n` +
    `    Move-Item -LiteralPath $temporary -Destination $target -Force\n` +
    `  }\n` +
    `}\n`;
}

function validateFbroRuntimeManifest(value: FbroRuntimeManifest): string | null {
  if (!value || value.schemaVersion !== 1) return 'schemaVersion 必须为 1。';
  if (!value.sdkVersion || !value.bridgeVersion || value.architecture !== 'x64') return '版本或架构字段缺失。';
  if (!Array.isArray(value.files) || value.files.length === 0) return 'files 不能为空。';
  const seen = new Set<string>();
  for (const file of value.files) {
    const relative = normalizeRelativePath(file?.path || '');
    if (!validateModuleRelativePath(relative)) return `文件路径不安全：${file?.path || ''}`;
    if (seen.has(relative.toLowerCase())) return `文件路径重复：${relative}`;
    seen.add(relative.toLowerCase());
    if (!Number.isSafeInteger(file.size) || file.size < 0) return `文件大小无效：${relative}`;
    if (!/^[a-f0-9]{64}$/i.test(file.sha256 || '')) return `SHA-256 无效：${relative}`;
  }
  return null;
}

async function findFbroSdkRoot(layout: ModuleNativeDependencyLayout): Promise<string | null> {
  const workspaceRoot = inferWorkspaceRootFromBuildDir(layout.buildDir);
  const packagedRoot = process.resourcesPath
    ? path.join(process.resourcesPath, 'default-workspace', '.lingbuilder', 'modules', 'lingbuilder.fbro.sdk', 'sdk')
    : '';
  const candidates = unique([
    process.env.FBRO_SDK_ROOT || '',
    path.join(workspaceRoot, '.lingbuilder', 'modules', 'lingbuilder.fbro.sdk', 'sdk'),
    packagedRoot,
    path.resolve('.lingbuilder', 'modules', 'lingbuilder.fbro.sdk', 'sdk')
  ].filter(Boolean));
  for (const candidate of candidates) {
    if (await pathExists(path.join(candidate, 'runtime-manifest.json')) &&
        await pathExists(path.join(candidate, 'include', 'LingBuilderFbroBridge.h'))) return candidate;
  }
  return null;
}

interface CryptoSdkManifestFile {
  path: string;
  size: number;
  sha256: string;
}

interface CryptoSdkManifest {
  schemaVersion: 1;
  botanVersion: string;
  blake3Version: string;
  files: CryptoSdkManifestFile[];
}

async function materializeCryptoSdk(
  layout: ModuleNativeDependencyLayout,
  plan: ModuleNativeDependencyPlan
): Promise<void> {
  plan.requiresMsvc = true;
  plan.requiresDynamicCrt = true;
  plan.requiredCppStandard = 20;
  if (process.platform !== 'win32') {
    addBlockingDiagnostic(plan, 'LingBuilder 密码学模块当前只提供 Windows/MSVC 的已审计 SDK。');
    return;
  }
  const sdkRoot = await findCryptoSdkRoot(layout);
  if (!sdkRoot) {
    addBlockingDiagnostic(plan, '密码学模块缺少 lingbuilder.crypto.sdk。请运行“cd electron && npm run module:crypto-sdk -- --install”生成并安装经过哈希校验的 Botan/BLAKE3 SDK。');
    return;
  }
  let manifest: CryptoSdkManifest;
  try {
    manifest = JSON.parse(await fs.readFile(path.join(sdkRoot, 'runtime-manifest.json'), 'utf8')) as CryptoSdkManifest;
  } catch (error) {
    addBlockingDiagnostic(plan, `密码学 SDK 清单读取失败：${errorMessage(error)}`);
    return;
  }
  if (manifest.schemaVersion !== 1 || !manifest.botanVersion || !manifest.blake3Version || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    addBlockingDiagnostic(plan, '密码学 SDK 清单格式无效。');
    return;
  }
  for (const entry of manifest.files) {
    const relative = normalizeRelativePath(entry.path || '');
    if (!validateModuleRelativePath(relative) || !Number.isSafeInteger(entry.size) || entry.size < 0 || !/^[a-f0-9]{64}$/i.test(entry.sha256 || '')) {
      addBlockingDiagnostic(plan, `密码学 SDK 清单包含无效文件记录：${entry.path || '未知路径'}`);
      return;
    }
    if (!await fileMatchesManifest(path.join(sdkRoot, relative), entry)) {
      addBlockingDiagnostic(plan, `密码学 SDK 文件缺失或哈希不一致：${relative}`);
      return;
    }
  }
  const moduleRoot = path.join('modules', 'lingbuilder.crypto.sdk');
  const architecture = layout.preferredTargetId === 'windows-msvc-x64' ? 'x64' : 'Win32';
  try {
    const roots = unique([
      path.join(layout.buildDir, moduleRoot),
      path.join(layout.sourceDir, moduleRoot),
      path.join(layout.exportDir, moduleRoot)
    ]);
    for (const root of roots) await copyDirectoryRecursive(sdkRoot, root);
    const runtimeSource = path.join(sdkRoot, 'bin', architecture, 'botan-3.dll');
    const runtimeTarget = path.join(layout.binDir, 'botan-3.dll');
    await fs.mkdir(layout.binDir, { recursive: true });
    await copyFileAtomicallyIfDifferent(runtimeSource, runtimeTarget);
    plan.includeDirs.push(path.join(layout.sourceDir, moduleRoot, 'include'));
    plan.sourceFiles.push(path.join(layout.sourceDir, moduleRoot, 'src', 'blake3_amalgamation.c'));
    plan.libFiles.push(path.join(layout.buildDir, moduleRoot, 'lib', architecture, 'botan-3.lib'));
    plan.runtimeFiles.push(runtimeTarget);
  } catch (error) {
    addBlockingDiagnostic(plan, `准备密码学 SDK 失败：${errorMessage(error)}`);
  }
}

async function findCryptoSdkRoot(layout: ModuleNativeDependencyLayout): Promise<string | null> {
  const workspaceRoot = inferWorkspaceRootFromBuildDir(layout.buildDir);
  const packagedRoot = process.resourcesPath
    ? path.join(process.resourcesPath, 'default-workspace', '.lingbuilder', 'modules', 'lingbuilder.crypto.sdk', 'sdk')
    : '';
  const candidates = unique([
    process.env.LINGBUILDER_CRYPTO_SDK_ROOT || '',
    path.join(workspaceRoot, '.lingbuilder', 'modules', 'lingbuilder.crypto.sdk', 'sdk'),
    packagedRoot,
    path.resolve('.lingbuilder', 'modules', 'lingbuilder.crypto.sdk', 'sdk')
  ].filter(Boolean));
  for (const candidate of candidates) {
    if (await pathExists(path.join(candidate, 'runtime-manifest.json')) &&
        await pathExists(path.join(candidate, 'include', 'botan', 'ffi.h')) &&
        await pathExists(path.join(candidate, 'include', 'blake3.h'))) return candidate;
  }
  return null;
}

export function inferWorkspaceRootFromBuildDir(buildDir: string): string {
  let current = path.resolve(buildDir);
  while (true) {
    if (path.basename(current).toLowerCase() === '.lingbuilder-build') return path.dirname(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(buildDir, '..', '..');
}

function addBlockingDiagnostic(plan: ModuleNativeDependencyPlan, message: string): void {
  plan.diagnostics.push(message);
  plan.blockingDiagnostics.push(message);
}

async function fileMatchesManifest(target: string, entry: FbroRuntimeManifestFile): Promise<boolean> {
  try {
    const stat = await fs.stat(target);
    if (!stat.isFile() || stat.size !== entry.size) return false;
    return (await sha256File(target)).toLowerCase() === entry.sha256.toLowerCase();
  } catch {
    return false;
  }
}

async function sha256File(target: string): Promise<string> {
  const data = await fs.readFile(target);
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function copyFileAtomically(source: string, target: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.lingbuilder-tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  try {
    await fs.copyFile(source, temporary);
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
}

async function copyFileAtomicallyIfDifferent(source: string, target: string): Promise<void> {
  try {
    const [sourceStat, targetStat] = await Promise.all([fs.stat(source), fs.stat(target)]);
    if (sourceStat.size === targetStat.size && await sha256File(source) === await sha256File(target)) return;
  } catch {
    // 文件缺失时执行复制。
  }
  await copyFileAtomically(source, target);
}

async function writeTextAtomically(target: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.lingbuilder-tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  try {
    await fs.writeFile(temporary, content, 'utf8');
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
}

async function materializeEdgeViewSdk(
  layout: ModuleNativeDependencyLayout,
  plan: ModuleNativeDependencyPlan
): Promise<void> {
  const packageRoot = await findWebView2Package(EDGEVIEW_WEBVIEW2_SDK_VERSION);
  if (!packageRoot) {
    plan.diagnostics.push(`EdgeView 模块缺少固定版本 Microsoft.Web.WebView2 ${EDGEVIEW_WEBVIEW2_SDK_VERSION}。请恢复该 NuGet 包；构建不会自动改用其它缓存版本。`);
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
    const actualHeaderSha256 = await sha256File(path.join(includeSource, 'WebView2.h'));
    if (actualHeaderSha256 !== EDGEVIEW_WEBVIEW2_HEADER_SHA256) {
      throw new Error(`WebView2.h 哈希不匹配：期望 ${EDGEVIEW_WEBVIEW2_HEADER_SHA256}，实际 ${actualHeaderSha256}`);
    }
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
  plan.requiredCppStandard = 20;
  if (!sdkRoot) {
    plan.diagnostics.push('CEF3 模块缺少 Chromium Embedded Framework SDK。推荐方式：安装 CEF3 内核 SDK 离线模块包（lingbuilder.cef3.sdk，含预编译 libcef_dll_wrapper，免下载免编译）。手动方式：从 https://cef-builds.spotifycdn.com/index.html 下载最新稳定版 windows64 标准包（如 cef_binary_150.0.14+..._windows64.tar.bz2），解压后把 cef_binary_* 目录内容放到工作区 .lingbuilder/cef3-sdk 或 C:\\cef3-sdk，或设置 CEF3_SDK_ROOT 环境变量指向该目录，然后重新构建。LingBuilder 会自动用 CMake 编译 libcef_dll_wrapper。');
    return;
  }
  const moduleRoot = path.join('modules', 'lingbuilder.cef3.browser');
  const architecture = layout.preferredTargetId === 'windows-msvc-x64' ? 'x64' : 'Win32';
  const isOfficialLayout = await pathExists(path.join(sdkRoot, 'Release', 'libcef.dll'));
  const roots = unique([
    path.join(layout.buildDir, moduleRoot),
    path.join(layout.sourceDir, moduleRoot),
    path.join(layout.exportDir, moduleRoot)
  ]);
  try {
    const dllSource = isOfficialLayout
      ? path.join(sdkRoot, 'Release')
      : path.join(sdkRoot, 'bin', architecture);

    const libTargetDir = path.join(layout.buildDir, moduleRoot, 'lib', architecture);
    await fs.mkdir(libTargetDir, { recursive: true });
    const bridgeRoot = path.join(sdkRoot, 'bridge', 'x64');
    const bridgeHeader = path.join(bridgeRoot, 'LingBuilderCefBridge.h');
    const bridgeLib = path.join(bridgeRoot, 'LingBuilderCefBridge.lib');
    const bridgeDll = path.join(bridgeRoot, 'LingBuilderCefBridge.dll');
    if (architecture !== 'x64') {
      plan.diagnostics.push('CEF3 Bridge 仅支持 windows-msvc-x64，当前架构不受支持。');
    } else if (!await pathExists(bridgeHeader) || !await pathExists(bridgeLib) || !await pathExists(bridgeDll)) {
      plan.diagnostics.push('CEF3 SDK 缺少 LingBuilderCefBridge x64 资产。请运行 npm run module:cef3-bridge -- --install 重新生成 Bridge。');
    } else {
      for (const root of roots) {
        await fs.mkdir(path.join(root, 'include'), { recursive: true });
        await fs.copyFile(bridgeHeader, path.join(root, 'include', 'LingBuilderCefBridge.h'));
      }
      await fs.copyFile(bridgeLib, path.join(libTargetDir, 'LingBuilderCefBridge.lib'));
      const bridgeRuntime = path.join(layout.binDir, 'LingBuilderCefBridge.dll');
      await fs.copyFile(bridgeDll, bridgeRuntime);
      plan.libFiles.push(path.join(libTargetDir, 'LingBuilderCefBridge.lib'));
      plan.runtimeFiles.push(bridgeRuntime);
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
  const workspaceRoot = layout ? inferWorkspaceRootFromBuildDir(layout.buildDir) : '';
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

async function findWebView2Package(version: string): Promise<string | null> {
  const candidates = unique([
    process.env.NUGET_PACKAGES ? path.join(process.env.NUGET_PACKAGES, 'microsoft.web.webview2') : '',
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.nuget', 'packages', 'microsoft.web.webview2') : ''
  ].filter(Boolean));
  for (const root of candidates) {
    try {
      const packageRoot = path.join(root, version);
      await fs.access(path.join(packageRoot, 'build', 'native', 'include', 'WebView2.h'));
      return packageRoot;
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
const EDGEVIEW_WEBVIEW2_SDK_VERSION = '1.0.4078.44';
const EDGEVIEW_WEBVIEW2_HEADER_SHA256 = 'dff1e3181ec7ec203a34ef6efa966590e0ef0ba1a5c3fe3b69da6508c2f8a02e';
