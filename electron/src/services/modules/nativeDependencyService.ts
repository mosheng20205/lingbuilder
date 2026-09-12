import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { InstalledModule } from './types';
import { validateModuleRelativePath } from './manifest';
import { getPreferredModuleTarget, getUnsupportedModuleTargetDiagnostic } from './targetResolver';
import { CRYPTO_SDK_MODULE_IDS } from './dataMediaModules';
import { OPENCV_MODULE_ID, OPENCV_SDK_MODULE_ID, OPENCV_VERSION } from './opencvModules';
import { PROTOBUF_MODULE_ID } from './protobufModule';
import { validateProtobufSdk, type ProtobufTargetArchitecture } from './protobufSdk';
import { ARIA2_MODULE_ID, ARIA2_RUNTIME_FILES } from './aria2Module';
import { SQLITE_MODULE_ID, SQLITE_BUNDLED_RUNTIME_SHA256 } from './sqliteModule';
import { MYSQL_MODULE_ID, MYSQL_BUNDLED_RUNTIME_SHA256 } from './mysqlModule';
import { EXCEL_MODULE_ID, EXCEL_BUNDLED_RUNTIME_SHA256 } from './excelModule';
import {
  getSdkDependencyResource,
  getSdkRootCandidates,
  resolveSdkCacheRoot
} from '../sdkDependencies/sdkDependencyCatalog';

const FBRO_SDK_VERSION = '135.0.21';
const FBRO_BRIDGE_VERSION = '2.7.0';
const FBRO_V3_HEADER_MARKERS = [
  'LB_FBRO_ABI_VERSION_V3',
  'LB_FBRO_EVENT_PACKET_V3',
  'LB_FBRO_EVENT_RESPONSE_V3',
  'LB_FBRO_CONTINUATION_HANDLE',
  'LB_FBro_SetEventCallbackV3',
  'LB_FBro_SetEventSubscription',
  'LB_FBro_CompleteEventContinuation',
  'LB_FBro_CancelEventContinuation',
  'LB_FBro_CreateEx2',
  'LB_FBro_CookieSetJsonAsync'
] as const;

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
  /**
   * 启用模块要求主程序与全部编译单元携带的预处理器定义（/D）。
   * 例如 protobuf 以 DLL 形式消费时，所有包含其头文件的编译单元都必须定义 PROTOBUF_USE_DLLS，
   * 否则 MSVC 会按静态库语义生成对象，链接能过但运行期虚表错位直接 AV。
   */
  extraCompileDefines?: string[];
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
  // When another Chromium module is present, FBro's CEF 135 runtime is copied
  // only to fbro-host. Project generation blocks any remaining in-process FBro
  // controls before compilation, so the executable's libcef.dll stays owned by
  // the other module (for example CEF3's CEF 150).
  const fbroHostOnly = enabledIds.has('lingbuilder.fbro.browser') && enabledModules.some(module =>
    module.manifest.id !== 'lingbuilder.fbro.browser' && (module.manifest.id === 'lingbuilder.cef3.browser'
      || (module.manifest.targets || []).some(target => (target.runtimeFiles || [])
        .some(file => path.basename(file).toLowerCase() === 'libcef.dll'))));

  if (enabledModules.some(module => module.manifest.id === 'lingbuilder.edgeview')) {
    await materializeEdgeViewSdk(layout, plan);
  }

  if (enabledModules.some(module => module.manifest.id === 'lingbuilder.cef3.browser')) {
    await materializeCef3Sdk(layout, plan);
  }

  if (enabledModules.some(module => module.manifest.id === 'lingbuilder.fbro.browser')) {
    await materializeFbroSdk(layout, plan, fbroHostOnly);
  }

  if (enabledModules.some(module => CRYPTO_SDK_MODULE_IDS.includes(module.manifest.id as typeof CRYPTO_SDK_MODULE_IDS[number]))) {
    await materializeCryptoSdk(layout, plan);
  }

  if (enabledIds.has(OPENCV_MODULE_ID)) {
    await materializeOpenCvSdk(layout, plan);
  }

  if (enabledIds.has(PROTOBUF_MODULE_ID)) {
    await materializeProtobufSdk(layout, plan);
  }

  if (enabledIds.has(ARIA2_MODULE_ID)) {
    await materializeAria2Runtime(layout, plan);
  }

  if (enabledIds.has(SQLITE_MODULE_ID)) {
    await materializeSqliteRuntime(layout, plan);
  }

  if (enabledIds.has(MYSQL_MODULE_ID)) {
    await materializeMysqlRuntime(layout, plan);
  }

  if (enabledIds.has(EXCEL_MODULE_ID)) {
    await materializeExcelRuntime(layout, plan);
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
      const normalizedRuntimeFile = runtimeFile.replaceAll('\\', '/');
      const runtimePrefix = normalizedRuntimeFile.toLowerCase().startsWith('runtime/')
        ? normalizedRuntimeFile.slice('runtime/'.length)
        : path.basename(normalizedRuntimeFile);
      const targetPath = path.join(layout.binDir, ...runtimePrefix.split('/'));
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
  if (enabledModules.some(module => module.manifest.id === OPENCV_MODULE_ID)) {
    const plan: ModuleNativeDependencyPlan = { includeDirs: [], sourceFiles: [], libFiles: [], runtimeFiles: [], diagnostics, blockingDiagnostics: [], requiresMsvc: true };
    await materializeOpenCvSdk({
      buildDir: exportDir,
      sourceDir: exportDir,
      binDir: exportDir,
      exportDir,
      preferredTargetId: 'windows-msvc-x64'
    }, plan);
  }
  if (enabledModules.some(module => module.manifest.id === PROTOBUF_MODULE_ID)) {
    const plan: ModuleNativeDependencyPlan = { includeDirs: [], sourceFiles: [], libFiles: [], runtimeFiles: [], diagnostics, blockingDiagnostics: [], requiresMsvc: true };
    await materializeProtobufSdk({
      buildDir: exportDir,
      sourceDir: exportDir,
      binDir: exportDir,
      exportDir,
      preferredTargetId: 'windows-msvc-win32'
    }, plan);
    diagnostics.push(...plan.blockingDiagnostics);
  }
  if (enabledModules.some(module => module.manifest.id === ARIA2_MODULE_ID)) {
    const plan: ModuleNativeDependencyPlan = { includeDirs: [], sourceFiles: [], libFiles: [], runtimeFiles: [], diagnostics, blockingDiagnostics: [], requiresMsvc: true };
    await materializeAria2Runtime({
      buildDir: exportDir,
      sourceDir: exportDir,
      binDir: exportDir,
      exportDir,
      preferredTargetId: 'windows-msvc-x64'
    }, plan);
    diagnostics.push(...plan.blockingDiagnostics);
  }
  if (enabledModules.some(module => module.manifest.id === SQLITE_MODULE_ID)) {
    const plan: ModuleNativeDependencyPlan = { includeDirs: [], sourceFiles: [], libFiles: [], runtimeFiles: [], diagnostics, blockingDiagnostics: [], requiresMsvc: false };
    await materializeSqliteRuntimeForExport(exportDir, plan);
    diagnostics.push(...plan.blockingDiagnostics);
  }
  if (enabledModules.some(module => module.manifest.id === MYSQL_MODULE_ID)) {
    const plan: ModuleNativeDependencyPlan = { includeDirs: [], sourceFiles: [], libFiles: [], runtimeFiles: [], diagnostics, blockingDiagnostics: [], requiresMsvc: false };
    await materializeMysqlRuntimeForExport(exportDir, plan);
    diagnostics.push(...plan.blockingDiagnostics);
  }

  if (enabledModules.some(module => module.manifest.id === EXCEL_MODULE_ID)) {
    const plan: ModuleNativeDependencyPlan = { includeDirs: [], sourceFiles: [], libFiles: [], runtimeFiles: [], diagnostics, blockingDiagnostics: [], requiresMsvc: false };
    await materializeExcelRuntimeForExport(exportDir, plan);
    diagnostics.push(...plan.blockingDiagnostics);
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
    // Visual Studio 导出同时声明 Win32/x64 配置，因此可移植工程必须携带模块
    // 已发布的全部 Windows MSVC target，不能只复制当前机器首选架构。
    const exportTargets = (module.manifest.targets || []).filter(target => (
      target.platform === 'windows' && target.toolchain === 'msvc'
    ));
    const preferredTarget = exportTargets[0] || getPreferredModuleTarget(module);
    if (!preferredTarget) {
      const diagnostic = getUnsupportedModuleTargetDiagnostic(module);
      if (diagnostic) diagnostics.push(diagnostic);
      continue;
    }
    if (!module.installPath || module.installPath.startsWith('builtin://')) continue;
    const exportModuleRoot = path.join(exportDir, 'modules', module.manifest.id);
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

async function materializeProtobufSdk(
  layout: ModuleNativeDependencyLayout,
  plan: ModuleNativeDependencyPlan
): Promise<void> {
  plan.requiresMsvc = true;
  const sdkRoot = await resolveProtobufSdkRoot(layout);
  const targetArchitecture: ProtobufTargetArchitecture = layout.preferredTargetId === 'windows-msvc-x64' ? 'x64' : 'win32';
  if (layout.preferredTargetId && layout.preferredTargetId !== 'windows-msvc-win32' && layout.preferredTargetId !== 'windows-msvc-x64') {
    addBlockingDiagnostic(plan, `Protobuf 模块不支持目标 ${layout.preferredTargetId}，当前仅支持 Windows MSVC Win32/x64。`);
    return;
  }
  let sdk;
  try {
    sdk = await validateProtobufSdk(sdkRoot, targetArchitecture);
  } catch (error) {
    addBlockingDiagnostic(plan, error instanceof Error ? error.message : String(error));
    return;
  }
  plan.extraCompileDefines = [
    ...(plan.extraCompileDefines || []),
    // protobuf 以 DLL 形式消费。
    'PROTOBUF_USE_DLLS',
    // abseil 单体 DLL（abseil_dll.dll）的消费模式：生成的 .pb.cc 走 absl 哈希内部
    // 时会引用其静态数据成员（如 MixingHashState::kSeed），必须 dllimport 才能链接。
    'ABSL_CONSUME_DLL'
  ];
  // libprotobuf.dll / abseil_dll.dll 以 Release /MD 构建；消费者 Debug 配置若用 /MTd，
  // 跨 DLL 边界的 std::string（如 SerializeToString）会因迭代器调试布局不同直接崩溃，
  // 因此与 CEF3/Crypto 一致强制全部配置使用动态 CRT。
  plan.requiresDynamicCrt = true;
  const allFiles = ['runtime-manifest.json', ...sdk.files.keys()];
  const sourceFiles = [...sdk.files.keys()].filter(relative => relative.startsWith('include/'));

  const isPortableExport = layout.buildDir === layout.exportDir && layout.sourceDir === layout.exportDir && layout.binDir === layout.exportDir;
  if (isPortableExport) {
    const exportRoot = path.join(layout.exportDir, 'modules', PROTOBUF_MODULE_ID, 'sdk');
    await copyProtobufFiles(sdkRoot, exportRoot, allFiles, plan.diagnostics, plan.blockingDiagnostics);
    return;
  }

  const buildRoot = path.join(layout.buildDir, 'modules', PROTOBUF_MODULE_ID, 'sdk');
  const sourceRoot = path.join(layout.sourceDir, 'modules', PROTOBUF_MODULE_ID, 'sdk');
  const exportRoot = path.join(layout.exportDir, 'modules', PROTOBUF_MODULE_ID, 'sdk');
  await Promise.all([
    copyProtobufFiles(sdkRoot, buildRoot, allFiles, plan.diagnostics, plan.blockingDiagnostics),
    copyProtobufFiles(sdkRoot, sourceRoot, sourceFiles, plan.diagnostics, plan.blockingDiagnostics),
    copyProtobufFiles(sdkRoot, exportRoot, allFiles, plan.diagnostics, plan.blockingDiagnostics)
  ]);
  plan.includeDirs.push(path.join(sourceRoot, 'include'));
  plan.libFiles.push(
    path.join(buildRoot, 'lib', targetArchitecture, 'libprotobuf.lib'),
    path.join(buildRoot, 'lib', targetArchitecture, 'abseil_dll.lib')
  );
  try {
    for (const runtimeName of ['libprotobuf.dll', 'abseil_dll.dll']) {
      const runtimeTarget = path.join(layout.binDir, runtimeName);
      await fs.mkdir(path.dirname(runtimeTarget), { recursive: true });
      await copyFileAtomicallyIfDifferent(path.join(sdkRoot, 'bin', targetArchitecture, runtimeName), runtimeTarget);
      plan.runtimeFiles.push(runtimeTarget);
    }
  } catch (error) {
    addBlockingDiagnostic(plan, `复制 Protobuf 运行时失败：${errorMessage(error)}`);
  }
}

const ARIA2_EXECUTABLE_SHA256 = 'be2099c214f63a3cb4954b09a0becd6e2e34660b886d4c898d260febfe9d70c2';

async function materializeAria2Runtime(
  layout: ModuleNativeDependencyLayout,
  plan: ModuleNativeDependencyPlan
): Promise<void> {
  plan.requiresMsvc = true;
  if (process.platform !== 'win32') {
    addBlockingDiagnostic(plan, 'Aria2 下载模块首版仅支持 Windows x64 MSVC。');
    return;
  }
  if (layout.preferredTargetId && layout.preferredTargetId !== 'windows-msvc-x64') {
    addBlockingDiagnostic(plan, `Aria2 下载模块不支持目标 ${layout.preferredTargetId}，请切换为 windows-msvc-x64。`);
    return;
  }

  const bundledRoot = await findBundledAria2Root();
  if (!bundledRoot) {
    addBlockingDiagnostic(plan, '未找到 LingBuilder 随附的 aria2c.exe、GPLv2 许可证或来源说明，无法生成 Aria2 下载模块。');
    return;
  }
  const executable = path.join(bundledRoot, 'aria2c.exe');
  try {
    const digest = await sha256File(executable);
    if (digest.toLowerCase() !== ARIA2_EXECUTABLE_SHA256) {
      addBlockingDiagnostic(plan, `LingBuilder 随附的 aria2c.exe SHA-256 不匹配：期望 ${ARIA2_EXECUTABLE_SHA256}，实际 ${digest}。`);
      return;
    }
  } catch (error) {
    addBlockingDiagnostic(plan, `校验 aria2c.exe 失败：${errorMessage(error)}`);
    return;
  }

  const moduleRoots = unique([
    path.join(layout.buildDir, 'modules', ARIA2_MODULE_ID),
    path.join(layout.exportDir, 'modules', ARIA2_MODULE_ID)
  ]);
  for (const runtimeFile of ARIA2_RUNTIME_FILES) {
    const source = path.join(bundledRoot, path.basename(runtimeFile));
    try {
      for (const root of moduleRoots) {
        await copyFileAtomicallyIfDifferent(source, path.join(root, runtimeFile));
      }
      const output = path.join(layout.binDir, path.basename(runtimeFile));
      await copyFileAtomicallyIfDifferent(source, output);
      plan.runtimeFiles.push(output);
    } catch (error) {
      addBlockingDiagnostic(plan, `复制 Aria2 运行时文件失败：${path.basename(runtimeFile)}：${errorMessage(error)}`);
    }
  }
}

async function findBundledAria2Root(): Promise<string | null> {
  const candidates = unique([
    process.env.LINGBUILDER_ARIA2_ROOT || '',
    process.resourcesPath ? path.join(process.resourcesPath, 'third_party', 'aria2') : '',
    path.resolve(process.cwd(), 'third_party', 'aria2'),
    path.resolve(process.cwd(), 'electron', 'third_party', 'aria2')
  ].filter(Boolean));
  for (const candidate of candidates) {
    try {
      await Promise.all([
        fs.access(path.join(candidate, 'aria2c.exe')),
        fs.access(path.join(candidate, 'COPYING')),
        fs.access(path.join(candidate, 'NOTICE.md'))
      ]);
      return candidate;
    } catch {
      // 尝试下一个由开发环境、打包资源或显式配置提供的位置。
    }
  }
  return null;
}

async function findBundledSqliteRoot(): Promise<string | null> {
  const candidates = unique([
    process.env.LINGBUILDER_SQLITE_RUNTIME_ROOT || '',
    process.resourcesPath ? path.join(process.resourcesPath, 'third_party', 'sqlite') : '',
    path.resolve(process.cwd(), 'third_party', 'sqlite'),
    path.resolve(process.cwd(), 'electron', 'third_party', 'sqlite')
  ].filter(Boolean));
  for (const candidate of candidates) {
    try {
      await Promise.all([
        fs.access(path.join(candidate, 'x64', 'sqlite3.dll')),
        fs.access(path.join(candidate, 'x86', 'sqlite3.dll')),
        fs.access(path.join(candidate, 'NOTICE.md'))
      ]);
      return candidate;
    } catch {
      // 尝试下一个由开发环境、打包资源或显式配置提供的位置。
    }
  }
  return null;
}

async function verifyBundledSqliteRuntime(
  source: string,
  architecture: 'x86' | 'x64',
  plan: ModuleNativeDependencyPlan
): Promise<boolean> {
  try {
    const digest = await sha256File(source);
    const expected = SQLITE_BUNDLED_RUNTIME_SHA256[architecture];
    if (digest.toLowerCase() !== expected) {
      addBlockingDiagnostic(plan, `LingBuilder 随附的 sqlite3.dll（${architecture}）SHA-256 不匹配：期望 ${expected}，实际 ${digest}。`);
      return false;
    }
    return true;
  } catch (error) {
    addBlockingDiagnostic(plan, `校验随附 sqlite3.dll 失败：${errorMessage(error)}`);
    return false;
  }
}

/** F5 构建 / AI Bridge build.run：按当前目标架构把随附 sqlite3.dll 复制到模块镜像与 exe 同目录。 */
async function materializeSqliteRuntime(
  layout: ModuleNativeDependencyLayout,
  plan: ModuleNativeDependencyPlan
): Promise<void> {
  if (process.platform !== 'win32') {
    plan.diagnostics.push('SQLite 随附运行库当前仅提供 Windows 版本；可使用 SQLite_加载运行库 指定自备的 SQLCipher 兼容 sqlite3.dll。');
    return;
  }
  const bundledRoot = await findBundledSqliteRoot();
  if (!bundledRoot) {
    plan.diagnostics.push('未找到 LingBuilder 随附的 sqlite3.dll（SQLite3MultipleCiphers）；加密打开命令需要随附运行库、自备 SQLCipher 兼容运行库或通过 SQLite_加载运行库 指定路径。');
    return;
  }
  const architecture = layout.preferredTargetId === 'windows-msvc-win32' ? 'x86' : 'x64';
  const source = path.join(bundledRoot, architecture, 'sqlite3.dll');
  if (!await verifyBundledSqliteRuntime(source, architecture, plan)) return;
  const moduleRoots = unique([
    path.join(layout.buildDir, 'modules', SQLITE_MODULE_ID),
    path.join(layout.exportDir, 'modules', SQLITE_MODULE_ID)
  ]);
  try {
    const runtimeLayout = path.join(architecture, 'sqlite3.dll');
    for (const root of moduleRoots) {
      await copyFileAtomicallyIfDifferent(source, path.join(root, runtimeLayout));
    }
    const output = path.join(layout.binDir, 'sqlite3.dll');
    await copyFileAtomicallyIfDifferent(source, output);
    plan.runtimeFiles.push(output);
  } catch (error) {
    addBlockingDiagnostic(plan, `复制 SQLite 随附运行库失败：${errorMessage(error)}`);
  }
}

/** Visual Studio 工程导出：同时物化两个架构到模块镜像，供 vcxproj 的 Win32/x64 配置按 targets[].runtimeFiles 平铺复制到 exe 同目录。 */
async function materializeSqliteRuntimeForExport(exportDir: string, plan: ModuleNativeDependencyPlan): Promise<void> {
  if (process.platform !== 'win32') return;
  const bundledRoot = await findBundledSqliteRoot();
  if (!bundledRoot) {
    plan.diagnostics.push('未找到 LingBuilder 随附的 sqlite3.dll（SQLite3MultipleCiphers）；导出工程将缺少随附 SQLite 加密运行库。');
    return;
  }
  for (const architecture of ['x86', 'x64'] as const) {
    const source = path.join(bundledRoot, architecture, 'sqlite3.dll');
    if (!await verifyBundledSqliteRuntime(source, architecture, plan)) continue;
    try {
      await copyFileAtomicallyIfDifferent(
        source,
        path.join(exportDir, 'modules', SQLITE_MODULE_ID, architecture, 'sqlite3.dll')
      );
    } catch (error) {
      addBlockingDiagnostic(plan, `复制 SQLite 随附运行库（${architecture}）失败：${errorMessage(error)}`);
    }
  }
}

async function findBundledMariadbRoot(): Promise<string | null> {
  const candidates = unique([
    process.env.LINGBUILDER_MARIADB_RUNTIME_ROOT || '',
    process.resourcesPath ? path.join(process.resourcesPath, 'third_party', 'mariadb') : '',
    path.resolve(process.cwd(), 'third_party', 'mariadb'),
    path.resolve(process.cwd(), 'electron', 'third_party', 'mariadb')
  ].filter(Boolean));
  for (const candidate of candidates) {
    try {
      await Promise.all([
        fs.access(path.join(candidate, 'x64', 'libmariadb.dll')),
        fs.access(path.join(candidate, 'x86', 'libmariadb.dll')),
        fs.access(path.join(candidate, 'NOTICE.md'))
      ]);
      return candidate;
    } catch {
      // 尝试下一个由开发环境、打包资源或显式配置提供的位置。
    }
  }
  return null;
}

async function verifyBundledMariadbRuntime(
  source: string,
  architecture: 'x86' | 'x64',
  plan: ModuleNativeDependencyPlan
): Promise<boolean> {
  try {
    const digest = await sha256File(source);
    const expected = MYSQL_BUNDLED_RUNTIME_SHA256[architecture];
    if (digest.toLowerCase() !== expected) {
      addBlockingDiagnostic(plan, `LingBuilder 随附的 libmariadb.dll（${architecture}）SHA-256 不匹配：期望 ${expected}，实际 ${digest}。`);
      return false;
    }
    return true;
  } catch (error) {
    addBlockingDiagnostic(plan, `校验随附 libmariadb.dll 失败：${errorMessage(error)}`);
    return false;
  }
}

/** F5 构建 / AI Bridge build.run：按当前目标架构把随附 libmariadb.dll 复制到模块镜像与 exe 同目录。 */
async function materializeMysqlRuntime(
  layout: ModuleNativeDependencyLayout,
  plan: ModuleNativeDependencyPlan
): Promise<void> {
  if (process.platform !== 'win32') {
    plan.diagnostics.push('MySQL 随附运行库当前仅提供 Windows 版本；可使用 MySQL_加载运行库 指定自备的 MariaDB Connector/C 运行库。');
    return;
  }
  const bundledRoot = await findBundledMariadbRoot();
  if (!bundledRoot) {
    plan.diagnostics.push('未找到 LingBuilder 随附的 libmariadb.dll（MariaDB Connector/C）；MySQL 连接命令需要随附运行库或通过 MySQL_加载运行库 指定路径。');
    return;
  }
  const architecture = layout.preferredTargetId === 'windows-msvc-win32' ? 'x86' : 'x64';
  const source = path.join(bundledRoot, architecture, 'libmariadb.dll');
  if (!await verifyBundledMariadbRuntime(source, architecture, plan)) return;
  const moduleRoots = unique([
    path.join(layout.buildDir, 'modules', MYSQL_MODULE_ID),
    path.join(layout.exportDir, 'modules', MYSQL_MODULE_ID)
  ]);
  try {
    const runtimeLayout = path.join(architecture, 'libmariadb.dll');
    for (const root of moduleRoots) {
      await copyFileAtomicallyIfDifferent(source, path.join(root, runtimeLayout));
    }
    const output = path.join(layout.binDir, 'libmariadb.dll');
    await copyFileAtomicallyIfDifferent(source, output);
    plan.runtimeFiles.push(output);
  } catch (error) {
    addBlockingDiagnostic(plan, `复制 MySQL 随附运行库失败：${errorMessage(error)}`);
  }
}

/** Visual Studio 工程导出：同时物化两个架构到模块镜像，供 vcxproj 的 Win32/x64 配置按 targets[].runtimeFiles 平铺复制到 exe 同目录。 */
async function materializeMysqlRuntimeForExport(exportDir: string, plan: ModuleNativeDependencyPlan): Promise<void> {
  if (process.platform !== 'win32') return;
  const bundledRoot = await findBundledMariadbRoot();
  if (!bundledRoot) {
    plan.diagnostics.push('未找到 LingBuilder 随附的 libmariadb.dll（MariaDB Connector/C）；导出工程将缺少随附 MySQL 运行库。');
    return;
  }
  for (const architecture of ['x86', 'x64'] as const) {
    const source = path.join(bundledRoot, architecture, 'libmariadb.dll');
    if (!await verifyBundledMariadbRuntime(source, architecture, plan)) continue;
    try {
      await copyFileAtomicallyIfDifferent(
        source,
        path.join(exportDir, 'modules', MYSQL_MODULE_ID, architecture, 'libmariadb.dll')
      );
    } catch (error) {
      addBlockingDiagnostic(plan, `复制 MySQL 随附运行库（${architecture}）失败：${errorMessage(error)}`);
    }
  }
}


async function findBundledExcelRoot(): Promise<string | null> {
  const candidates = unique([
    process.env.LINGBUILDER_EXCEL_RUNTIME_ROOT || '',
    process.resourcesPath ? path.join(process.resourcesPath, 'third_party', 'excel') : '',
    path.resolve(process.cwd(), 'third_party', 'excel'),
    path.resolve(process.cwd(), 'electron', 'third_party', 'excel')
  ].filter(Boolean));
  for (const candidate of candidates) {
    try {
      await Promise.all([
        fs.access(path.join(candidate, 'x64', 'LingBuilderExcel.dll')),
        fs.access(path.join(candidate, 'x86', 'LingBuilderExcel.dll')),
        fs.access(path.join(candidate, 'NOTICE.md'))
      ]);
      return candidate;
    } catch {
      // 尝试下一个由开发环境、打包资源或显式配置提供的位置。
    }
  }
  return null;
}

async function verifyBundledExcelRuntime(
  source: string,
  architecture: 'x86' | 'x64',
  plan: ModuleNativeDependencyPlan
): Promise<boolean> {
  try {
    const digest = await sha256File(source);
    const expected = EXCEL_BUNDLED_RUNTIME_SHA256[architecture];
    if (digest.toLowerCase() !== expected) {
      addBlockingDiagnostic(plan, `LingBuilder 随附的 LingBuilderExcel.dll（${architecture}）SHA-256 不匹配：期望 ${expected}，实际 ${digest}。`);
      return false;
    }
    return true;
  } catch (error) {
    addBlockingDiagnostic(plan, `校验随附 LingBuilderExcel.dll 失败：${errorMessage(error)}`);
    return false;
  }
}

/** F5 构建 / AI Bridge build.run：按当前目标架构把随附 LingBuilderExcel.dll 复制到模块镜像与 exe 同目录。 */
async function materializeExcelRuntime(
  layout: ModuleNativeDependencyLayout,
  plan: ModuleNativeDependencyPlan
): Promise<void> {
  if (process.platform !== 'win32') {
    plan.diagnostics.push('Excel 表格模块当前仅提供 Windows 随附运行桥 LingBuilderExcel.dll。');
    return;
  }
  const bundledRoot = await findBundledExcelRoot();
  if (!bundledRoot) {
    plan.diagnostics.push('未找到 LingBuilder 随附的 LingBuilderExcel.dll；Excel 命令运行时需要该运行桥位于 exe 同目录。');
    return;
  }
  const architecture = layout.preferredTargetId === 'windows-msvc-win32' ? 'x86' : 'x64';
  const source = path.join(bundledRoot, architecture, 'LingBuilderExcel.dll');
  if (!await verifyBundledExcelRuntime(source, architecture, plan)) return;
  const moduleRoots = unique([
    path.join(layout.buildDir, 'modules', EXCEL_MODULE_ID),
    path.join(layout.exportDir, 'modules', EXCEL_MODULE_ID)
  ]);
  try {
    const runtimeLayout = path.join(architecture, 'LingBuilderExcel.dll');
    for (const root of moduleRoots) {
      await copyFileAtomicallyIfDifferent(source, path.join(root, runtimeLayout));
    }
    const output = path.join(layout.binDir, 'LingBuilderExcel.dll');
    await copyFileAtomicallyIfDifferent(source, output);
    plan.runtimeFiles.push(output);
  } catch (error) {
    addBlockingDiagnostic(plan, `复制 Excel 随附运行桥失败：${errorMessage(error)}`);
  }
}

/** Visual Studio 工程导出：同时物化两个架构到模块镜像，供 vcxproj 的 Win32/x64 配置按 targets[].runtimeFiles 平铺复制到 exe 同目录。 */
async function materializeExcelRuntimeForExport(exportDir: string, plan: ModuleNativeDependencyPlan): Promise<void> {
  if (process.platform !== 'win32') return;
  const bundledRoot = await findBundledExcelRoot();
  if (!bundledRoot) {
    plan.diagnostics.push('未找到 LingBuilder 随附的 LingBuilderExcel.dll；导出工程将缺少随附 Excel 运行桥。');
    return;
  }
  for (const architecture of ['x86', 'x64'] as const) {
    const source = path.join(bundledRoot, architecture, 'LingBuilderExcel.dll');
    if (!await verifyBundledExcelRuntime(source, architecture, plan)) continue;
    try {
      await copyFileAtomicallyIfDifferent(
        source,
        path.join(exportDir, 'modules', EXCEL_MODULE_ID, architecture, 'LingBuilderExcel.dll')
      );
    } catch (error) {
      addBlockingDiagnostic(plan, `复制 Excel 随附运行桥（${architecture}）失败：${errorMessage(error)}`);
    }
  }
}

async function copyProtobufFiles(
  sourceRoot: string,
  targetRoot: string,
  relativeFiles: readonly string[],
  diagnostics: string[],
  blockingDiagnostics: string[] = diagnostics
): Promise<void> {
  for (const relative of relativeFiles) {
    try {
      const target = path.join(targetRoot, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await copyFileAtomicallyIfDifferent(path.join(sourceRoot, relative), target);
    } catch (error) {
      const message = `复制 Protobuf SDK 文件失败：${relative}：${errorMessage(error)}`;
      diagnostics.push(message);
      if (blockingDiagnostics !== diagnostics) blockingDiagnostics.push(message);
    }
  }
}

async function resolveProtobufSdkRoot(layout: ModuleNativeDependencyLayout): Promise<string> {
  const configured = process.env.LINGBUILDER_PROTOBUF_SDK_ROOT?.trim();
  if (configured) return path.resolve(configured);
  let current = path.resolve(layout.buildDir);
  for (let index = 0; index < 8; index += 1) {
    if (await pathExists(path.join(current, '.lingbuilder'))) return path.join(current, '.lingbuilder', 'toolchains', 'protobuf');
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(layout.buildDir, '..', '..', '..', '..', '.lingbuilder', 'toolchains', 'protobuf');
}

/**
 * 读取 PE 导出表，判断 DLL 是否导出指定符号。
 * 返回 'has' / 'missing'（成功解析但缺符号）/ 'notPe'（无法按 PE 解析，探测不适用）。
 * 用于检测手工覆盖模块目录后 DLL 与清单不同步的陈旧桥接（避免 F5 以 LNK2019 收场）。
 */
export function peExportProbe(buffer: Buffer, exportName: string): 'has' | 'missing' | 'notPe' {
  try {
    if (buffer.length < 0x40 + 24 || buffer.readUInt16LE(0) !== 0x5a4d) return 'notPe';
    const peOffset = buffer.readUInt32LE(0x3c);
    if (peOffset <= 0 || peOffset + 24 > buffer.length || buffer.readUInt32LE(peOffset) !== 0x00004550) return 'notPe';
    const numberOfSections = buffer.readUInt16LE(peOffset + 6);
    const optionalHeaderSize = buffer.readUInt16LE(peOffset + 20);
    const optionalHeaderOffset = peOffset + 24;
    if (optionalHeaderSize <= 0 || optionalHeaderOffset + optionalHeaderSize > buffer.length) return 'notPe';
    const magic = buffer.readUInt16LE(optionalHeaderOffset);
    const dataDirectoryOffset = optionalHeaderOffset + (magic === 0x20b ? 112 : 96);
    if (dataDirectoryOffset + 8 > buffer.length) return 'notPe';
    const exportRva = buffer.readUInt32LE(dataDirectoryOffset);
    if (exportRva === 0) return 'notPe';
    const sectionsOffset = optionalHeaderOffset + optionalHeaderSize;
    const sections: Array<{ rva: number; size: number; raw: number }> = [];
    for (let index = 0; index < numberOfSections; index += 1) {
      const entry = sectionsOffset + index * 40;
      if (entry + 40 > buffer.length) return 'notPe';
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
    if (exportOffset <= 0 || exportOffset + 40 > buffer.length) return 'notPe';
    const numberOfNames = buffer.readUInt32LE(exportOffset + 24);
    const addressOfNames = rvaToOffset(buffer.readUInt32LE(exportOffset + 32));
    if (addressOfNames <= 0 || addressOfNames + 4 > buffer.length) return 'notPe';
    for (let index = 0; index < numberOfNames; index += 1) {
      const namePointerEntry = addressOfNames + index * 4;
      if (namePointerEntry + 4 > buffer.length) return 'notPe';
      const nameOffset = rvaToOffset(buffer.readUInt32LE(namePointerEntry));
      if (nameOffset <= 0 || nameOffset >= buffer.length) continue;
      const end = buffer.indexOf(0, nameOffset);
      if (end <= nameOffset || end - nameOffset > 256) continue;
      if (buffer.toString('latin1', nameOffset, end) === exportName) return 'has';
    }
    return 'missing';
  } catch {
    return 'notPe';
  }
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
  plan: ModuleNativeDependencyPlan,
  hostOnly = false
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
    addBlockingDiagnostic(plan, 'FBro 浏览器缺少环境 SDK。请在 LingBuilder 的 SDK 下载提示中安装 FBro 环境 SDK，或设置 FBRO_SDK_ROOT 指向有效 SDK 目录。');
    return;
  }

  const lockKey = path.resolve(layout.binDir);
  const previous = fbroMaterializationLocks.get(lockKey) || Promise.resolve();
  const current = previous.then(() => withFbroFilesystemLock(
    layout.binDir,
    () => materializeFbroSdkUnlocked(sdkRoot, layout, plan, hostOnly)
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
  plan: ModuleNativeDependencyPlan,
  hostOnly: boolean
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
  if (manifest.sdkVersion !== FBRO_SDK_VERSION || manifest.bridgeVersion !== FBRO_BRIDGE_VERSION || manifest.architecture !== 'x64') {
    addBlockingDiagnostic(plan, `FBro SDK、Bridge 或架构不匹配：需要 ${FBRO_SDK_VERSION}/Bridge ${FBRO_BRIDGE_VERSION}/x64，实际为 ${manifest.sdkVersion}/Bridge ${manifest.bridgeVersion}/${manifest.architecture}。请在 LingBuilder 的 SDK 下载面板重装 FBro 环境 SDK。`);
    return;
  }

  const moduleRoot = path.join('modules', 'lingbuilder.fbro.browser');
  const bridgeHeader = path.join(sdkRoot, 'include', 'LingBuilderFbroBridge.h');
  const processRuntimeHeader = path.join(sdkRoot, 'include', 'LingBuilderFbroProcessRuntime.hpp');
  const jsonHeader = path.join(sdkRoot, 'include', 'nlohmann', 'json.hpp');
  const jsonLicense = path.join(sdkRoot, 'include', 'nlohmann', 'LICENSE.MIT');
  const bridgeLib = path.join(sdkRoot, 'lib', 'x64', 'LingBuilderFbroBridge.lib');
  const bridgeDll = path.join(sdkRoot, 'bridge', 'x64', 'LingBuilderFbroBridge.dll');
  for (const required of [bridgeHeader, processRuntimeHeader, jsonHeader, jsonLicense, bridgeLib, bridgeDll]) {
    if (!await pathExists(required)) {
      addBlockingDiagnostic(plan, `FBro SDK 文件缺失：${path.relative(sdkRoot, required).replace(/\\/g, '/')}`);
      return;
    }
  }
  // 陈旧桥接 DLL 探测：手工覆盖模块目录时清单可能被同步改过，但 DLL 仍是旧版，
  // 缺少资源正文捕获导出会让 F5 以 LNK2019 收场。这里提前给出可操作的中文诊断。
  // 无法按 PE 解析的文件（异常损坏/占位）不在此判定，交由后续链接阶段暴露。
  try {
    const bridgeDllBuffer = await fs.readFile(bridgeDll);
    if (peExportProbe(bridgeDllBuffer, 'LB_FBro_ResourceBodyBegin') === 'missing') {
      addBlockingDiagnostic(plan, '已安装的 FBro SDK 桥接 DLL 缺少导出 LB_FBro_ResourceBodyBegin（资源响应正文捕获）。请在 LingBuilder 的 SDK 下载面板重装 FBro 环境 SDK。');
      return;
    }
    if (peExportProbe(bridgeDllBuffer, 'LB_FBro_ResourceReplaceSet') === 'missing') {
      addBlockingDiagnostic(plan, '已安装的 FBro SDK 桥接 DLL 缺少导出 LB_FBro_ResourceReplaceSet（非 VIP 响应正文查找替换）。请在 LingBuilder 的 SDK 下载面板重装 FBro 环境 SDK。');
      return;
    }
  } catch (error) {
    addBlockingDiagnostic(plan, `读取 FBro 桥接 DLL 失败：${errorMessage(error)}`);
    return;
  }
  const bridgeHeaderSource = await fs.readFile(bridgeHeader, 'utf8').catch(() => '');
  const missingV3Markers = FBRO_V3_HEADER_MARKERS.filter(marker => !bridgeHeaderSource.includes(marker));
  if (missingV3Markers.length) {
    addBlockingDiagnostic(plan, `FBro Bridge 头文件不是完整 C ABI v3，缺少：${missingV3Markers.join('、')}。请运行“cd electron && npm run module:fbro-sdk -- --install”重新生成。`);
    return;
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
      await copyFileAtomicallyIfDifferent(processRuntimeHeader, path.join(root, 'include', 'LingBuilderFbroProcessRuntime.hpp'));
      await copyFileAtomicallyIfDifferent(jsonHeader, path.join(root, 'include', 'nlohmann', 'json.hpp'));
      await copyFileAtomicallyIfDifferent(jsonLicense, path.join(root, 'include', 'nlohmann', 'LICENSE.MIT'));
      await copyFileAtomicallyIfDifferent(bridgeLib, path.join(root, 'lib', 'x64', 'LingBuilderFbroBridge.lib'));
      await copyFileAtomicallyIfDifferent(bridgeDll, path.join(root, 'bin', 'x64', 'LingBuilderFbroBridge.dll'));
      await copyFileAtomicallyIfDifferent(manifestPath, path.join(root, 'runtime-manifest.json'));
    }
    await writeTextAtomically(path.join(buildModuleRoot, 'materialize-fbro-runtime.ps1'), fbroExportMaterializerScript());
    await writeTextAtomically(path.join(exportModuleRoot, 'materialize-fbro-runtime.ps1'), fbroExportMaterializerScript());
    await fs.mkdir(layout.binDir, { recursive: true });
    if (!hostOnly) {
      const bridgeTarget = path.join(layout.binDir, 'LingBuilderFbroBridge.dll');
      await copyFileAtomicallyIfDifferent(bridgeDll, bridgeTarget);
      plan.runtimeFiles.push(bridgeTarget);
    }
    const hostRuntimeDirectory = path.join(layout.binDir, 'fbro-host');
    const hostBridgeTarget = path.join(hostRuntimeDirectory, 'LingBuilderFbroBridge.dll');
    await copyFileAtomicallyIfDifferent(bridgeDll, hostBridgeTarget);
    plan.runtimeFiles.push(hostBridgeTarget);

    const copiedFiles: FbroRuntimeManifestFile[] = [];
    for (const entry of manifest.files) {
      const normalized = normalizeRelativePath(entry.path);
      if (!validateModuleRelativePath(normalized)) {
        throw new Error(`清单包含不安全路径：${entry.path}`);
      }
      const source = path.join(sdkRoot, 'runtime', 'x64', ...normalized.split('/'));
      const target = path.join(layout.binDir, ...normalized.split('/'));
      const hostTarget = path.join(hostRuntimeDirectory, ...normalized.split('/'));
      const sourceMatches = await fileMatchesManifest(source, entry);
      if (!sourceMatches) throw new Error(`源 SDK 文件缺失或哈希错误：runtime/x64/${normalized}`);
      if (!hostOnly && !await fileMatchesManifest(target, entry)) {
        await copyFileAtomically(source, target);
        if (!await fileMatchesManifest(target, entry)) throw new Error(`复制后校验失败：${normalized}`);
      }
      if (!await fileMatchesManifest(hostTarget, entry)) {
        await copyFileAtomically(source, hostTarget);
        if (!await fileMatchesManifest(hostTarget, entry)) throw new Error(`复制 FBro Host 后校验失败：${normalized}`);
      }
      const exportTarget = path.join(exportModuleRoot, 'runtime', 'x64', ...normalized.split('/'));
      if (!await fileMatchesManifest(exportTarget, entry)) await copyFileAtomically(source, exportTarget);
      copiedFiles.push(entry);
      if (!hostOnly) plan.runtimeFiles.push(target);
      plan.runtimeFiles.push(hostTarget);
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
  return `param([Parameter(Mandatory=$true)][string]$Destination, [string]$RuntimeRoot = '', [switch]$HostOnly)\n` +
    `$ErrorActionPreference = 'Stop'\n` +
    `$moduleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path\n` +
    `$manifest = Get-Content -LiteralPath (Join-Path $moduleRoot 'runtime-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json\n` +
    `if ([string]::IsNullOrWhiteSpace($RuntimeRoot)) { $RuntimeRoot = Join-Path $moduleRoot 'runtime\\x64' }\n` +
    `New-Item -ItemType Directory -Force -Path $Destination | Out-Null\n` +
    `$hostDestination = Join-Path $Destination 'fbro-host'\n` +
    `New-Item -ItemType Directory -Force -Path $hostDestination | Out-Null\n` +
    `foreach ($entry in $manifest.files) {\n` +
    `  $relative = $entry.path -replace '/', '\\'\n` +
    `  $source = Join-Path $RuntimeRoot $relative\n` +
    `  $targets = if ($HostOnly) { @((Join-Path $hostDestination $relative)) } else { @((Join-Path $Destination $relative), (Join-Path $hostDestination $relative)) }\n` +
    `  foreach ($target in $targets) {\n` +
    `  $copy = -not (Test-Path -LiteralPath $target)\n` +
    `  if (-not $copy) { $info = Get-Item -LiteralPath $target; $copy = $info.Length -ne [int64]$entry.size }\n` +
    `  if (-not $copy) { $copy = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256.ToLowerInvariant() }\n` +
    `  if ($copy) {\n` +
    `    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null\n` +
    `    $temporary = $target + '.lingbuilder-tmp-' + $PID\n` +
    `    Copy-Item -LiteralPath $source -Destination $temporary -Force\n` +
    `    Move-Item -LiteralPath $temporary -Destination $target -Force\n` +
    `  }\n` +
    `  }\n` +
    `}\n` +
    `$bridge = Join-Path $Destination 'LingBuilderFbroBridge.dll'\n` +
    `if (-not (Test-Path -LiteralPath $bridge)) { $bridge = Join-Path $moduleRoot 'bin\\x64\\LingBuilderFbroBridge.dll' }\n` +
    `if (Test-Path -LiteralPath $bridge) { Copy-Item -LiteralPath $bridge -Destination (Join-Path $hostDestination 'LingBuilderFbroBridge.dll') -Force }\n`;
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
  const candidates = getSdkRootCandidates(getSdkDependencyResource('fbro'), {
    workspaceRoot,
    cacheRoot: resolveSdkCacheRoot(),
    resourcesPath: process.resourcesPath
  });
  for (const candidate of candidates) {
    if (await pathExists(path.join(candidate.root, 'runtime-manifest.json')) &&
        await pathExists(path.join(candidate.root, 'include', 'LingBuilderFbroBridge.h'))) return candidate.root;
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

interface OpenCvSdkManifest {
  schemaVersion: 1;
  opencvVersion: string;
  bridgeVersion: string;
  bridgeAbiVersion: number;
  architecture: 'x64';
  toolset: string;
  runtimeLibrary: 'MD';
  files: CryptoSdkManifestFile[];
}

async function materializeOpenCvSdk(
  layout: ModuleNativeDependencyLayout,
  plan: ModuleNativeDependencyPlan
): Promise<void> {
  plan.requiresMsvc = true;
  plan.requiresDynamicCrt = true;
  plan.requiredCppStandard = Math.max(plan.requiredCppStandard || 17, 17) as 17 | 20;
  if (process.platform !== 'win32') {
    addBlockingDiagnostic(plan, 'OpenCV 模块当前只支持 Windows MSVC x64。');
    return;
  }
  if (layout.preferredTargetId && layout.preferredTargetId !== 'windows-msvc-x64') {
    addBlockingDiagnostic(plan, 'OpenCV 模块仅支持 Windows MSVC x64，请把构建目标切换为 x64。');
    return;
  }
  const sdkRoot = await findOpenCvSdkRoot(layout);
  if (!sdkRoot) {
    addBlockingDiagnostic(plan, 'OpenCV 模块缺少 lingbuilder.opencv.sdk。请运行“cd electron && npm run module:opencv-sdk -- --install”生成并安装经过哈希校验的 OpenCV 4.14.0 x64 SDK。');
    return;
  }
  let manifest: OpenCvSdkManifest;
  try {
    manifest = JSON.parse(await fs.readFile(path.join(sdkRoot, 'runtime-manifest.json'), 'utf8')) as OpenCvSdkManifest;
  } catch (error) {
    addBlockingDiagnostic(plan, `OpenCV SDK 清单读取失败：${errorMessage(error)}`);
    return;
  }
  if (manifest.schemaVersion !== 1 || manifest.opencvVersion !== OPENCV_VERSION || manifest.bridgeVersion !== '1.0.0'
      || manifest.bridgeAbiVersion !== 1 || manifest.architecture !== 'x64' || manifest.toolset !== 'msvc-v143'
      || manifest.runtimeLibrary !== 'MD' || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    addBlockingDiagnostic(plan, 'OpenCV SDK 清单格式、版本、架构或 CRT 不符合要求。');
    return;
  }
  for (const entry of manifest.files) {
    const relative = normalizeRelativePath(entry.path || '');
    if (!validateModuleRelativePath(relative) || !Number.isSafeInteger(entry.size) || entry.size < 0 || !/^[a-f0-9]{64}$/i.test(entry.sha256 || '')) {
      addBlockingDiagnostic(plan, `OpenCV SDK 清单包含无效文件记录：${entry.path || '未知路径'}`);
      return;
    }
    if (!await fileMatchesManifest(path.join(sdkRoot, relative), entry)) {
      addBlockingDiagnostic(plan, `OpenCV SDK 文件缺失或哈希不一致：${relative}`);
      return;
    }
  }
  const required = [
    'include/LingBuilderOpenCvBridge.h',
    'lib/x64/LingBuilderOpenCvBridge.lib',
    'bin/x64/LingBuilderOpenCvBridge.dll',
    'bin/x64/opencv_core4140.dll',
    'bin/x64/opencv_imgproc4140.dll',
    'bin/x64/opencv_imgcodecs4140.dll'
  ];
  const manifestPaths = new Set(manifest.files.map(entry => normalizeRelativePath(entry.path || '')));
  for (const relative of required) {
    if (!manifestPaths.has(relative) || !await pathExists(path.join(sdkRoot, ...relative.split('/')))) {
      addBlockingDiagnostic(plan, `OpenCV SDK 清单缺少必要资产：${relative}`);
      return;
    }
  }
  const moduleRoot = path.join('modules', OPENCV_SDK_MODULE_ID);
  try {
    for (const root of unique([
      path.join(layout.buildDir, moduleRoot),
      path.join(layout.sourceDir, moduleRoot),
      path.join(layout.exportDir, moduleRoot)
    ])) await copyDirectoryRecursive(sdkRoot, root);
    await fs.mkdir(layout.binDir, { recursive: true });
    for (const runtimeName of ['LingBuilderOpenCvBridge.dll', 'opencv_core4140.dll', 'opencv_imgproc4140.dll', 'opencv_imgcodecs4140.dll']) {
      const runtimeTarget = path.join(layout.binDir, runtimeName);
      await copyFileAtomicallyIfDifferent(path.join(sdkRoot, 'bin', 'x64', runtimeName), runtimeTarget);
      plan.runtimeFiles.push(runtimeTarget);
    }
    plan.includeDirs.push(path.join(layout.sourceDir, moduleRoot, 'include'));
    plan.libFiles.push(path.join(layout.buildDir, moduleRoot, 'lib', 'x64', 'LingBuilderOpenCvBridge.lib'));
  } catch (error) {
    addBlockingDiagnostic(plan, `准备 OpenCV SDK 失败：${errorMessage(error)}`);
  }
}

async function findOpenCvSdkRoot(layout: ModuleNativeDependencyLayout): Promise<string | null> {
  const workspaceRoot = inferWorkspaceRootFromBuildDir(layout.buildDir);
  const packagedRoot = process.resourcesPath
    ? path.join(process.resourcesPath, 'default-workspace', '.lingbuilder', 'modules', OPENCV_SDK_MODULE_ID, 'sdk')
    : '';
  const candidates = unique([
    process.env.LINGBUILDER_OPENCV_SDK_ROOT || '',
    path.join(workspaceRoot, '.lingbuilder', 'modules', OPENCV_SDK_MODULE_ID, 'sdk'),
    packagedRoot,
    path.resolve('.lingbuilder', 'modules', OPENCV_SDK_MODULE_ID, 'sdk')
  ].filter(Boolean));
  for (const candidate of candidates) {
    if (await pathExists(path.join(candidate, 'runtime-manifest.json')) &&
        await pathExists(path.join(candidate, 'include', 'LingBuilderOpenCvBridge.h'))) return candidate;
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
    // Windows 上刚落盘的大 DLL 可能被杀软/索引器短暂锁定，rename 报 EPERM/EBUSY；
    // 带退避重试几次，避免偶发锁定让整次构建失败。
    for (let attempt = 0; ; attempt += 1) {
      try {
        await fs.rename(temporary, target);
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException)?.code;
        if ((code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') || attempt >= 6) throw error;
        await new Promise(resolve => setTimeout(resolve, 120 * (attempt + 1)));
      }
    }
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
    addBlockingDiagnostic(plan, 'CEF3 浏览器缺少环境 SDK。请在 LingBuilder 的 SDK 下载提示中安装 CEF3 环境 SDK，或设置 CEF3_SDK_ROOT 指向有效 SDK 目录。');
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
    } else if (!await cef3BridgeHeaderSupportsResourceBody(bridgeHeader)) {
      addBlockingDiagnostic(plan, 'CEF3 SDK Bridge header is outdated: missing LB_CEF3_ResourceResponseBodyBegin. Please update the CEF3 SDK automatically.');
    } else {
      for (const root of roots) {
        await fs.mkdir(path.join(root, 'include'), { recursive: true });
        await copyFileAtomicallyIfDifferent(bridgeHeader, path.join(root, 'include', 'LingBuilderCefBridge.h'));
      }
      await copyFileAtomicallyIfDifferent(bridgeLib, path.join(libTargetDir, 'LingBuilderCefBridge.lib'));
      const bridgeRuntime = path.join(layout.binDir, 'LingBuilderCefBridge.dll');
      await copyFileAtomicallyIfDifferent(bridgeDll, bridgeRuntime);
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
  // 示例项目通常位于仓库根目录的多层子目录中，而 SDK 安装在仓库根目录
  // 的 .lingbuilder/modules/... 下。仅检查项目目录会把 F5 导向旧缓存/旧安装。
  // 因此按 buildDir 向上遍历所有祖先目录，并优先选择包含新版 Bridge 符号的 SDK。
  const workspaceRoots = workspaceRoot ? ancestorDirectories(workspaceRoot) : [];
  const resource = getSdkDependencyResource('cef3');
  const fallbackCandidates = getSdkRootCandidates(resource, {
    cacheRoot: resolveSdkCacheRoot(),
    resourcesPath: process.resourcesPath
  });
  const candidates = [
    ...fallbackCandidates.filter(candidate => candidate.source === 'environment'),
    ...workspaceRoots.flatMap(root => getSdkRootCandidates(resource, {
      workspaceRoot: root,
      cacheRoot: resolveSdkCacheRoot(),
      resourcesPath: process.resourcesPath
    }).filter(candidate => candidate.source === 'workspace')),
    ...fallbackCandidates.filter(candidate => candidate.source !== 'environment')
  ];
  let staleCandidate: string | null = null;
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(candidate.root, 'include', 'cef_app.h'));
      const bridgeHeader = path.join(candidate.root, 'bridge', 'x64', 'LingBuilderCefBridge.h');
      if (await cef3BridgeHeaderSupportsResourceBody(bridgeHeader)) return candidate.root;
      staleCandidate ||= candidate.root;
    } catch {
      // 尝试下一个候选 SDK 根目录。
    }
  }
  return staleCandidate;
}

function ancestorDirectories(start: string): string[] {
  const result: string[] = [];
  let current = path.resolve(start);
  while (true) {
    result.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return result;
}

async function cef3BridgeHeaderSupportsResourceBody(headerPath: string): Promise<boolean> {
  try {
    const header = await fs.readFile(headerPath, 'utf8');
    return /\bLB_CEF3_ResourceResponseBodyBegin\b/u.test(header);
  } catch {
    return false;
  }
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
