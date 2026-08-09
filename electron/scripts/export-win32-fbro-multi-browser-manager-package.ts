import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLcppSourcePackageService } from '../electron/lcppSourcePackageService';
import { BrowserExtensionService } from '../src/services/browserWorkbench/browserExtensionService';
import { normalizeBrowserWorkspaceDocument } from '../src/services/browserWorkbench/browserInstanceService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule, LingBuilderModuleManifest } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const projectId = 'win32-fbro-multi-browser-manager';
const packagePath = path.join(repositoryRoot, 'exports', '独立浏览器管理器.lcpppkg');
const pluginModuleId = 'lingbuilder.browser.doubao-downloader';
const requiredModuleIds = [
  'lingbuilder.win32.basic',
  'lingbuilder.win32.common-controls',
  'lingbuilder.fbro.browser',
  pluginModuleId
] as const;
const forbiddenUiDependency = /new[_-]?emoji|emoji[._-]?ui/iu;
const forbiddenDeveloperPath = /(?:[A-Za-z]:[\\/](?:Users[\\/]Administrator[\\/](?:Downloads|AppData)|Csharp|FBro5\.0))/iu;
const textExtensions = new Set(['.c', '.cc', '.cpp', '.h', '.hpp', '.ini', '.json', '.lcpp', '.md', '.props', '.rc', '.sln', '.targets', '.txt', '.vcxproj', '.xml']);

function builtin(moduleId: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
  if (!manifest) throw new Error(`缺少内置模块：${moduleId}`);
  return {
    manifest,
    installPath: `builtin://${moduleId}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
}

async function installed(workspaceRoot: string, moduleId: string): Promise<InstalledModule> {
  const installPath = path.join(workspaceRoot, '.lingbuilder', 'modules', moduleId);
  const manifest = JSON.parse(
    await fs.readFile(path.join(installPath, 'lingbuilder.module.json'), 'utf8')
  ) as LingBuilderModuleManifest;
  return { manifest, installPath, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function loadModules(workspaceRoot: string): Promise<InstalledModule[]> {
  return [
    builtin('lingbuilder.win32.basic'),
    builtin('lingbuilder.win32.common-controls'),
    builtin('lingbuilder.fbro.browser'),
    await installed(workspaceRoot, pluginModuleId)
  ];
}

function verifyProject(project: LingWindowProject, source: string, moduleIds: string[]): void {
  const window = project.windows[0];
  const controls = window?.controls || [];
  const tab = controls.find(control => control.id === 'browser-pages');
  const list = controls.find(control => control.id === 'browser-list');
  const downloadDetail = controls.find(control => control.id === 'instance-detail');
  const downloadProgress = controls.find(control => control.id === 'download-progress');
  const openDownloadDirectory = controls.find(control => control.id === 'open-download');
  if (window?.designerBackend !== 'win32' || tab?.type !== 'TabControl'
    || tab.properties?.hideHeader !== true || list?.type !== 'ListBox') {
    throw new Error('目标项目必须使用 Win32 后端、隐藏表头 TabControl 和左侧 ListBox。');
  }
  if (downloadDetail?.type !== 'TextBox' || downloadProgress?.type !== 'ProgressBar'
    || openDownloadDirectory?.type !== 'Button') {
    throw new Error('目标项目必须包含下载详情文本框、原生进度条和打开目录按钮。');
  }
  if (controls.some(control => control.type === 'FBroBrowser' || Boolean(control.designerType))) {
    throw new Error('目标项目不得包含固定 FBroBrowser 控件或其它 UI 后端设计器控件。');
  }
  if (JSON.stringify(moduleIds) !== JSON.stringify(requiredModuleIds)) {
    throw new Error('项目模块引用不符合最小 Win32 + FBro + 插件资源集合。');
  }
  const serialized = JSON.stringify(project);
  if (forbiddenUiDependency.test(serialized) || forbiddenUiDependency.test(source)) {
    throw new Error('目标项目源码或设计器模型包含 new_emoji 依赖。');
  }
  for (const required of [
    '浏览器管理器_初始化(浏览器页面, 浏览器实例列表',
    '浏览器管理器_绑定下载视图(实例详情, 下载进度)',
    '浏览器管理器_新增实例(',
    '浏览器管理器_切换索引(',
    '浏览器管理器_导入Cookie(',
    '浏览器管理器_导出Cookie(',
    '浏览器管理器_打开当前下载目录()',
    '浏览器管理器_删除当前(',
    '浏览器管理器_取当前插件状态()'
  ]) {
    if (!source.includes(required)) throw new Error(`中文源码缺少管理器能力：${required}`);
  }
}

function verifyGeneratedFiles(files: Array<{ relativePath: string; content: string }>): void {
  const mainCpp = files.find(file => file.relativePath === 'main.cpp')?.content || '';
  if (!mainCpp.includes('LB_FBroProcess_RunHostIfRequested')
    || !mainCpp.includes('浏览器管理器_初始化')
    || !mainCpp.includes('浏览器管理器_绑定下载视图')
    || !mainCpp.includes('OnDownloadUpdated')
    || !mainCpp.includes('PBM_SETPOS')
    || !mainCpp.includes('LingFbroProcessController::Instance().Start(config, false)')
    || !mainCpp.includes('TCM_SETITEM') && !mainCpp.includes('TabCtrl_InsertItem')) {
    throw new Error('生成的 C++ 缺少独立 FBro Host、浏览器管理器或 Win32 TabControl 运行时。');
  }
  for (const file of files) {
    if (forbiddenUiDependency.test(file.relativePath) || forbiddenUiDependency.test(file.content)) {
      throw new Error(`生成文件包含 new_emoji 依赖：${file.relativePath}`);
    }
    if (forbiddenDeveloperPath.test(file.content)) {
      throw new Error(`生成文件包含开发机绝对路径：${file.relativePath}`);
    }
  }
}

async function collectFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile()) result.push(absolute);
    }
  }
  return result;
}

async function verifyImportedWorkspace(workspaceRoot: string, expectedSource: string): Promise<void> {
  const projectDirectory = path.join(workspaceRoot, '.lingbuilder', 'projects', projectId);
  const [source, designerText, moduleText, browserConfigText, fbroRuntimeText] = await Promise.all([
    fs.readFile(path.join(workspaceRoot, 'src', projectId, 'MainWindow.lcpp'), 'utf8'),
    fs.readFile(path.join(projectDirectory, 'window-designer.json'), 'utf8'),
    fs.readFile(path.join(projectDirectory, 'project-modules.json'), 'utf8'),
    fs.readFile(path.join(workspaceRoot, 'config', projectId, 'browser-instances.json'), 'utf8'),
    fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'modules', 'lingbuilder.fbro.sdk', 'sdk', 'runtime-manifest.json'), 'utf8')
  ]);
  const project = JSON.parse(designerText) as LingWindowProject;
  const modules = JSON.parse(moduleText) as { enabledModuleIds?: string[] };
  const browserConfig = normalizeBrowserWorkspaceDocument(JSON.parse(browserConfigText) as unknown);
  const fbroRuntime = JSON.parse(fbroRuntimeText) as { sdkVersion?: string; architecture?: string };
  if (source !== expectedSource) throw new Error('复制并导入后的 MainWindow.lcpp 与原始源码不一致。');
  verifyProject(project, source, modules.enabledModuleIds || []);
  if (fbroRuntime.sdkVersion !== '135.0.21' || fbroRuntime.architecture !== 'x64') {
    throw new Error('导入包携带的 FBro SDK 版本或架构不兼容。');
  }
  for (const instance of browserConfig.instances) {
    if (instance.cacheDirectory !== `profiles/${instance.id}` || path.isAbsolute(instance.cacheDirectory)) {
      throw new Error(`默认实例“${instance.id}”包含不可迁移缓存路径。`);
    }
  }

  const pluginRoot = path.join(workspaceRoot, '.lingbuilder', 'modules', pluginModuleId, 'runtime', 'doubao-downloader');
  const pluginValidation = await new BrowserExtensionService().validate(pluginRoot);
  if (!pluginValidation.ok || pluginValidation.manifestVersion !== 3 || pluginValidation.version !== '2.0.4') {
    throw new Error(`导入包中的插件资源无效：${pluginValidation.diagnostic || '未知错误'}`);
  }
  const pluginDocs = await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'modules', pluginModuleId, 'docs', 'README.md'), 'utf8');
  if (!pluginDocs.trim()) throw new Error('导入包中的插件模块文档为空。');

  const importedModules = await loadModules(workspaceRoot);
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceFilePath: `src/${projectId}/MainWindow.lcpp`,
    lingCppSourceCode: source,
    enabledModules: importedModules
  });
  if (generated.blockingDiagnostics.length > 0) {
    throw new Error(`导入后的项目无法重新生成 C++：\n${generated.blockingDiagnostics.join('\n')}`);
  }
  verifyGeneratedFiles(generated.files);

  const files = await collectFiles(workspaceRoot);
  for (const absolute of files) {
    const relative = path.relative(workspaceRoot, absolute).split(path.sep).join('/');
    if (forbiddenUiDependency.test(relative)) throw new Error(`导入包包含 new_emoji 文件：${relative}`);
    if (/(^|\/)(profiles?|cookies?|cache|localstorage|indexeddb|credentials?|secrets?|tokens?)(\/|$)/iu.test(relative)) {
      throw new Error(`导入包包含不允许的浏览器用户数据或凭据：${relative}`);
    }
    if (!textExtensions.has(path.extname(relative).toLowerCase())) continue;
    const content = await fs.readFile(absolute, 'utf8');
    if (forbiddenUiDependency.test(content)) throw new Error(`导入包文本包含 new_emoji：${relative}`);
    if (forbiddenDeveloperPath.test(content)) throw new Error(`导入包文本包含开发机绝对路径：${relative}`);
  }
}

async function main(): Promise<void> {
  const projectDirectory = path.join(repositoryRoot, '.lingbuilder', 'projects', projectId);
  const [designerText, source, moduleText, browserConfigText, enabledModules] = await Promise.all([
    fs.readFile(path.join(projectDirectory, 'window-designer.json'), 'utf8'),
    fs.readFile(path.join(repositoryRoot, 'src', projectId, 'MainWindow.lcpp'), 'utf8'),
    fs.readFile(path.join(projectDirectory, 'project-modules.json'), 'utf8'),
    fs.readFile(path.join(repositoryRoot, 'config', projectId, 'browser-instances.json'), 'utf8'),
    loadModules(repositoryRoot)
  ]);
  const project = JSON.parse(designerText) as LingWindowProject;
  const moduleConfig = JSON.parse(moduleText) as { enabledModuleIds?: string[] };
  normalizeBrowserWorkspaceDocument(JSON.parse(browserConfigText) as unknown);
  verifyProject(project, source, moduleConfig.enabledModuleIds || []);

  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceFilePath: `src/${projectId}/MainWindow.lcpp`,
    lingCppSourceCode: source,
    enabledModules
  });
  if (generated.blockingDiagnostics.length > 0) {
    throw new Error(`目标项目存在阻断诊断：\n${generated.blockingDiagnostics.join('\n')}`);
  }
  verifyGeneratedFiles(generated.files);

  await fs.mkdir(path.dirname(packagePath), { recursive: true });
  const verifyExisting = process.argv.includes('--verify-existing');
  const replaceExisting = process.argv.includes('--replace');
  let packageExists = false;
  try {
    await fs.access(packagePath);
    packageExists = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (packageExists && replaceExisting) {
    await fs.rm(packagePath, { force: true });
    packageExists = false;
  }
  if (packageExists && !verifyExisting) throw new Error(`目标源码包已存在，拒绝覆盖：${packagePath}`);

  const packageService = createLcppSourcePackageService(repositoryRoot);
  const exported = packageExists
    ? undefined
    : await packageService.exportProject(projectId, packagePath, '0.3.0');
  const preview = await packageService.inspectPackage(packagePath);
  const packageModuleIds = preview.manifest.modules.map(module => module.id);
  for (const moduleId of requiredModuleIds) {
    if (!packageModuleIds.includes(moduleId)) throw new Error(`源码包缺少模块：${moduleId}`);
  }
  if (!preview.manifest.bundledSupportModuleIds.includes('lingbuilder.fbro.sdk')) {
    throw new Error('源码包未自动携带 lingbuilder.fbro.sdk 支持资产。');
  }
  if (packageModuleIds.some(moduleId => forbiddenUiDependency.test(moduleId))
    || preview.manifest.files.some(file => forbiddenUiDependency.test(file.path))) {
    throw new Error('源码包清单包含 new_emoji 依赖。');
  }
  const pluginEntries = preview.manifest.files.filter(file => file.path.includes('doubao-downloader/'));
  for (const required of ['manifest.json', 'logo.png', 'popup.html', 'doubao-downloader.user.js']) {
    if (!pluginEntries.some(file => file.path.endsWith(`doubao-downloader/${required}`))) {
      throw new Error(`源码包缺少插件资源：${required}`);
    }
  }
  if (!preview.manifest.files.some(file => file.path === `config/${projectId}/browser-instances.json`)) {
    throw new Error('源码包缺少可迁移的浏览器实例默认配置。');
  }

  const importParent = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-win32-browser-package-'));
  try {
    const copiedPackage = path.join(importParent, 'copied', path.basename(packagePath));
    await fs.mkdir(path.dirname(copiedPackage), { recursive: true });
    await fs.copyFile(packagePath, copiedPackage);
    const copiedPreview = await packageService.inspectPackage(copiedPackage);
    if (copiedPreview.packageSha256 !== preview.packageSha256) throw new Error('复制后的源码包 SHA-256 不一致。');
    const imported = await packageService.importPackage(copiedPackage, path.join(importParent, 'imports'));
    await verifyImportedWorkspace(imported.workspacePath, source);
  } finally {
    await fs.rm(importParent, { recursive: true, force: true });
  }

  console.log(JSON.stringify({
    ok: true,
    projectId,
    packagePath,
    packageBytes: preview.totalBytes,
    packageSha256: preview.packageSha256,
    sourceFiles: exported?.lcppFileCount
      ?? preview.manifest.files.filter(file => file.path.toLowerCase().endsWith('.lcpp')).length,
    packagedFiles: exported?.fileCount ?? preview.manifest.files.length,
    generatedFileCount: generated.files.length,
    modules: preview.manifest.modules.map(module => ({ id: module.id, version: module.version, bundled: module.bundled })),
    supportModules: preview.manifest.bundledSupportModuleIds
  }, null, 2));
}

void main();
