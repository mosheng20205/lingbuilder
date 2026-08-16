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
const projectId = 'new-emoji-fbro-multi-browser-manager';
const packagePath = path.join(repositoryRoot, 'exports', 'new_emoji-FBro多浏览器管理器-v0.3.5.lcpppkg');
const requiredModuleIds = [
  'lingbuilder.win32.basic',
  'lingbuilder.win32.common-controls',
  'lingbuilder.std.text',
  'lingbuilder.new_emoji.ui',
  'lingbuilder.fbro.browser',
  'lingbuilder.new_emoji.fbro-shell'
] as const;
const pluginAssetRoot = path.join(repositoryRoot, 'assets', projectId, 'doubao-downloader');

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function syncPluginSource(): Promise<void> {
  const source = argumentValue('--plugin-source') || process.env.LINGBUILDER_DOUBAO_PLUGIN_SOURCE;
  if (!source) return;
  const sourceRoot = path.resolve(source);
  const validation = await new BrowserExtensionService().validate(sourceRoot);
  if (!validation.ok || validation.manifestVersion !== 3 || validation.version !== '2.0.4') {
    throw new Error('插件源码必须是版本 2.0.4 的有效 Manifest V3 扩展。');
  }
  const targetRoot = pluginAssetRoot;
  await fs.mkdir(targetRoot, { recursive: true });
  for (const file of ['manifest.json', 'logo.png', 'popup.html', 'doubao-downloader.user.js']) {
    await fs.copyFile(path.join(sourceRoot, file), path.join(targetRoot, file));
  }
}

function builtin(moduleId: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
  if (!manifest) throw new Error(`缺少内置模块：${moduleId}`);
  return { manifest, installPath: `builtin://${moduleId}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function installed(moduleId: string): Promise<InstalledModule> {
  const installPath = path.join(repositoryRoot, '.lingbuilder', 'modules', moduleId);
  const manifest = JSON.parse(await fs.readFile(path.join(installPath, 'lingbuilder.module.json'), 'utf8')) as LingBuilderModuleManifest;
  return { manifest, installPath, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function loadModules(): Promise<InstalledModule[]> {
  return [
    builtin('lingbuilder.win32.basic'),
    builtin('lingbuilder.win32.common-controls'),
    builtin('lingbuilder.std.text'),
    await installed('lingbuilder.new_emoji.ui'),
    builtin('lingbuilder.fbro.browser'),
    builtin('lingbuilder.new_emoji.fbro-shell')
  ];
}

function verifyManagerLayout(project: LingWindowProject, source: string): void {
  const controls = project.windows[0]?.controls || [];
  const browserControls = controls.filter(control => control.type === 'FBroBrowser');
  const browserViewport = controls.find(control => control.designerType === 'lingbuilder.new_emoji.ui/BrowserViewport');
  if (browserControls.length !== 0 || !browserViewport || browserViewport.visibility !== 'Visible'
    || browserViewport.x < 300 || browserViewport.width < 1200 || browserViewport.height < 700) {
    throw new Error('多浏览器管理器不得预创建固定数量的 FBroBrowser；右侧必须由 BrowserViewport 提供动态 Host 布局边界。');
  }
  const richList = controls.find(control => control.designerType === 'lingbuilder.new_emoji.ui/RichList');
  if (!richList || richList.x > 40 || richList.width < 260 || richList.width > 310 || richList.height < 520
    || richList.events?.SelectionChanged !== '_浏览器实例列表_选择变化'
    || richList.events?.ContextMenu !== '_浏览器实例列表_右键菜单') {
    throw new Error('多浏览器管理器左侧必须使用 new_emoji RichList 作为实例切换入口。');
  }
  const instanceMenu = project.resources?.find(resource => resource.id === 'browser-instance-context-menu');
  if (!instanceMenu || instanceMenu.type !== 'PopupMenu' || instanceMenu.ownerWindowId !== 'main-window'
    || instanceMenu.items.filter(item => !item.separator).length !== 9
    || !instanceMenu.items.some(item => item.id === 'browserWorkbench.instance.deleteRetainData')
    || !instanceMenu.items.some(item => item.id === 'browserWorkbench.instance.deleteClearData')) {
    throw new Error('浏览器实例右键菜单必须来自统一命令/菜单契约并包含完整实例操作。');
  }
  const canvasTitle = controls.find(control => control.id === 'title');
  const subtitle = controls.find(control => control.id === 'subtitle');
  if (canvasTitle || !subtitle || subtitle.y > 24 || subtitle.height > 24) {
    throw new Error('顶部只能保留原生窗口标题；画布架构说明必须单独排列，不能与标题栏或其它文本重叠。');
  }
  const workspaceTabs = controls.find(control => control.id === 'workspace-pages');
  const browserTabs = controls.find(control => control.id === 'browser-host-pages');
  const configurationWorkspace = controls.find(control => control.id === 'configuration-workspace');
  const settingsPanel = controls.find(control => control.id === 'settings-panel');
  const toolsPanel = controls.find(control => control.id === 'tools-panel');
  const workspaceItems = Array.isArray(workspaceTabs?.properties?.items) ? workspaceTabs.properties.items : [];
  const browserItems = Array.isArray(browserTabs?.properties?.items) ? browserTabs.properties.items : [];
  if (workspaceTabs?.designerType !== 'lingbuilder.new_emoji.ui/Tabs'
    || workspaceItems.length !== 2
    || workspaceTabs.properties?.headerVisible !== false
    || browserTabs?.parentId !== workspaceTabs?.id
    || browserTabs?.containerSlot !== 'browser-workspace'
    || browserTabs?.properties?.headerVisible !== false
    || String(browserTabs?.properties?.position) !== '0'
    || browserItems.length !== 0
    || browserViewport.parentId !== workspaceTabs?.id
    || browserViewport.containerSlot !== 'browser-workspace'
    || configurationWorkspace?.parentId !== workspaceTabs?.id
    || configurationWorkspace?.containerSlot !== 'configuration-workspace'
    || settingsPanel?.parentId !== configurationWorkspace?.id
    || toolsPanel?.parentId !== configurationWorkspace?.id) {
    throw new Error('右侧必须使用“浏览器 / 实例设置与工具”两页 Tabs；浏览器实例 Tabs 初始为空、隐藏表头，并由运行时动态增加标签。');
  }
  for (const name of ['默认首页输入', '代理输入', 'UserAgent输入', '指纹配置输入', '宽度输入', '高度输入']) {
    const control = controls.find(item => item.name === name);
    if (!control || control.parentId !== settingsPanel.id) throw new Error(`配置字段“${name}”必须位于实例设置弹窗内。`);
  }
  const addressOmnibox = controls.find(control => control.id === 'address-input');
  if (addressOmnibox?.designerType !== 'lingbuilder.new_emoji.ui/Omnibox'
    || addressOmnibox.events?.TextChanged !== '_地址输入_提交') {
    throw new Error('主界面地址栏必须使用带回车提交回调的 new_emoji Omnibox。');
  }
  const rootInputs = controls.filter(control => control.designerType === 'lingbuilder.new_emoji.ui/Input' && !control.parentId);
  if (rootInputs.length !== 0) {
    throw new Error('主界面右侧除 Omnibox 地址栏外不得常驻代理、指纹、尺寸或工具输入框。');
  }
  const addInstance = controls.find(control => control.id === 'add-instance');
  const globalSettings = controls.find(control => control.id === 'global-settings');
  if (!addInstance || addInstance.events?.Clicked !== '_添加实例_被点击'
    || !globalSettings || globalSettings.events?.Clicked !== '_全局设置_被点击'
    || controls.some(control => ['show-current', 'restart-current', 'close-current'].includes(control.id))) {
    throw new Error('左下角只能提供添加实例与全局设置，不能保留启动、重启或关闭按钮。');
  }
  if (!source.includes('事件 _浏览器实例列表_选择变化(文本型 选中键列表)')
    || !source.includes('浏览器外壳_绑定实例列表(浏览器实例列表)')
    || !source.includes('浏览器外壳_新建独立实例(稳定ID, 默认首页, 实例标题, "profiles/" + 稳定ID)')
    || !source.includes('浏览器外壳_启用实例持久化("new-emoji-fbro-multi-browser-manager")')
    || !source.includes('浏览器外壳_导入实例Cookie')
    || !source.includes('浏览器外壳_导出实例Cookie')
    || !source.includes('浏览器外壳_确认删除实例')
    || !source.includes('浏览器外壳_选择列表键(选中键列表)')
    || !source.includes('事件 _浏览器实例列表_右键菜单(文本型 事件数据)')
    || !source.includes('弹出菜单_显示(浏览器实例右键菜单)')
    || !source.includes('控件_设置选择项(右侧工作区, 1)')
    || !source.includes('空 保存当前设置()')
    || !source.includes('浏览器外壳_按配置重建当前')
    || !source.includes('空 同步当前地址栏()')
    || !source.includes('浏览器外壳_取地址()')
    || !source.includes('事件 _地址输入_提交(文本型 地址)')
    || !source.includes('事件 浏览器状态改变(整数型 标签索引, 文本型 地址, 文本型 标题, 逻辑型 加载中)')
    || !source.includes('空 添加实例()')
    || source.includes('已添加实例数量 < 6')
    || source.includes('当前模板已启用全部 6 个')
    || source.includes('空 隐藏所有浏览器()')
    || source.includes('实例设置遮罩')
    || source.includes('更多工具遮罩')) {
    throw new Error('多浏览器管理器缺少 RichList/实例标签切换、设置工作区页或按实例保存配置逻辑。');
  }
}

async function main(): Promise<void> {
  await syncPluginSource();
  const projectDirectory = path.join(repositoryRoot, '.lingbuilder', 'projects', projectId);
  const sourcePath = path.join(repositoryRoot, 'src', projectId, 'MainWindow.lcpp');
  const browserConfigPath = path.join(repositoryRoot, 'config', projectId, 'browser-instances.json');
  const [designerText, source, enabledModules, browserConfigText] = await Promise.all([
    fs.readFile(path.join(projectDirectory, 'window-designer.json'), 'utf8'),
    fs.readFile(sourcePath, 'utf8'),
    loadModules(),
    fs.readFile(browserConfigPath, 'utf8')
  ]);
  const project = JSON.parse(designerText) as LingWindowProject;
  normalizeBrowserWorkspaceDocument(JSON.parse(browserConfigText) as unknown);
  verifyManagerLayout(project, source);
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceFilePath: `src/${projectId}/MainWindow.lcpp`,
    lingCppSourceCode: source,
    enabledModules
  });
  if (generated.blockingDiagnostics.length > 0) {
    throw new Error(`多浏览器管理器存在阻断诊断：\n${generated.blockingDiagnostics.join('\n')}`);
  }
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  if (!mainCpp.includes('LB_FBroProcess_RunHostIfRequested')) throw new Error('生成结果未包含 FBro 独立 Host 入口。');
  if (!mainCpp.includes('EU_CreateRichList')) throw new Error('生成结果未包含 new_emoji RichList 原生创建调用。');
  if (!mainCpp.includes('EU_CreateOmnibox') || !mainCpp.includes('EU_SetOmniboxCommitCallback')) throw new Error('生成结果未包含 Omnibox 原生地址栏及回车提交回调。');
  if ((mainCpp.match(/LB_NE_RegisterFbro\(L/g) || []).length !== 0) throw new Error('生成结果仍包含固定 FBro Host 槽位。');
  if (!mainCpp.includes('static bool 浏览器外壳_新建独立实例')
    || !mainCpp.includes('static int 浏览器外壳_启用实例持久化')
    || !mainCpp.includes('static std::wstring 浏览器外壳_导入实例Cookie')
    || !mainCpp.includes('LB_NE_BrowserShellExtensionPath')
    || !mainCpp.includes('EU_SetRichListItems(g_newEmojiWindow')
    || !mainCpp.includes('LingFbroProcessController::Instance().Start(config, false)')
    || !mainCpp.includes('CreatePopupMenu()')
    || !mainCpp.includes('browserWorkbench.instance.deleteClearData')) {
    throw new Error('生成结果缺少动态独立进程、RichList 同步或非阻塞 Host 启动实现。');
  }

  await fs.mkdir(path.dirname(packagePath), { recursive: true });
  try {
    await fs.access(packagePath);
    throw new Error(`目标源码包已存在，拒绝覆盖：${packagePath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const packageService = createLcppSourcePackageService(repositoryRoot);
  const exported = await packageService.exportProject(projectId, packagePath, '0.3.5');
  const preview = await packageService.inspectPackage(packagePath);
  if (!preview.manifest.bundledSupportModuleIds.includes('lingbuilder.fbro.sdk')) {
    throw new Error('源码包未自动携带 lingbuilder.fbro.sdk 支持资产。');
  }
  const pluginEntries = preview.manifest.files.filter(file => file.path.startsWith(`assets/${projectId}/doubao-downloader/`));
  for (const required of ['manifest.json', 'logo.png', 'popup.html', 'doubao-downloader.user.js']) {
    if (!pluginEntries.some(file => file.path === `assets/${projectId}/doubao-downloader/${required}`)) {
      throw new Error(`源码包缺少插件资源：${required}`);
    }
  }
  if (!preview.manifest.files.some(file => file.path === `config/${projectId}/browser-instances.json`)) {
    throw new Error('源码包缺少可迁移的浏览器实例结构配置。');
  }
  const sensitiveEntry = preview.manifest.files.find(file => /(^|\/)(cookies?|cache|localstorage|indexeddb|credentials?|secrets?|tokens?)(\/|$)/iu.test(file.path));
  if (sensitiveEntry) throw new Error(`源码包包含不允许的浏览器用户数据或凭据：${sensitiveEntry.path}`);
  const importParent = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-multi-browser-package-import-'));
  try {
    const imported = await packageService.importPackage(packagePath, importParent);
    const importedSource = await fs.readFile(path.join(imported.workspacePath, 'src', projectId, 'MainWindow.lcpp'), 'utf8');
    const importedDesigner = JSON.parse(await fs.readFile(path.join(imported.workspacePath, '.lingbuilder', 'projects', projectId, 'window-designer.json'), 'utf8')) as LingWindowProject;
    const importedModules = JSON.parse(await fs.readFile(path.join(imported.workspacePath, '.lingbuilder', 'projects', projectId, 'project-modules.json'), 'utf8')) as { enabledModuleIds?: string[] };
    const importedFbroRuntimeManifest = JSON.parse(await fs.readFile(path.join(imported.workspacePath, '.lingbuilder', 'modules', 'lingbuilder.fbro.sdk', 'sdk', 'runtime-manifest.json'), 'utf8')) as { sdkVersion?: string; bridgeVersion?: string; architecture?: string };
    const importedBrowserConfig = normalizeBrowserWorkspaceDocument(JSON.parse(await fs.readFile(
      path.join(imported.workspacePath, 'config', projectId, 'browser-instances.json'), 'utf8'
    )) as unknown);
    if (importedSource !== source) throw new Error('回读后的 MainWindow.lcpp 与导出源不一致。');
    verifyManagerLayout(importedDesigner, importedSource);
    if (importedDesigner.windows[0]?.designerBackend !== 'new-emoji') throw new Error('回读项目丢失 new_emoji 后端。');
    if (importedDesigner.windows[0]?.controls.some(control => control.type === 'FBroBrowser')) throw new Error('回读项目重新出现了固定 FBro Host 槽位。');
    if (!importedDesigner.windows[0]?.controls.some(control => control.designerType === 'lingbuilder.new_emoji.ui/BrowserViewport')) throw new Error('回读项目丢失动态 FBro BrowserViewport。');
    for (const moduleId of requiredModuleIds) {
      if (!importedModules.enabledModuleIds?.includes(moduleId)) throw new Error(`回读项目缺少模块引用：${moduleId}`);
    }
    if (importedModules.enabledModuleIds?.includes('lingbuilder.fbro.sdk')) {
      throw new Error('FBro SDK 是自动携带的支持资产，不应作为项目显式启用模块。');
    }
    if (importedFbroRuntimeManifest.sdkVersion !== '135.0.21'
      || importedFbroRuntimeManifest.bridgeVersion !== '2.2.0'
      || importedFbroRuntimeManifest.architecture !== 'x64') {
      throw new Error('回读项目携带的 FBro SDK/Bridge 版本不兼容。');
    }
    for (const instance of importedBrowserConfig.instances) {
      if (instance.cacheDirectory !== `profiles/${instance.id}` || path.isAbsolute(instance.cacheDirectory)) {
        throw new Error(`回读实例“${instance.id}”包含不可迁移缓存路径。`);
      }
    }
    const importedPluginRoot = path.join(imported.workspacePath, 'assets', projectId, 'doubao-downloader');
    const importedPluginValidation = await new BrowserExtensionService().validate(importedPluginRoot);
    if (!importedPluginValidation.ok || importedPluginValidation.version !== '2.0.4') {
      throw new Error(`回读插件资源无效：${importedPluginValidation.diagnostic || '未知错误'}`);
    }
    if (await fs.access(path.join(imported.workspacePath, '.lingbuilder', 'modules',
      'lingbuilder.browser.doubao-downloader')).then(() => true).catch(() => false)) {
      throw new Error('回读源码包不应包含豆包下载器插件模块目录。');
    }
    const forbiddenDeveloperPaths = [
      'C:\\Users\\Administrator\\Downloads\\doubao-downloader',
      'C:/Users/Administrator/Downloads/doubao-downloader',
      'T:\\Csharp\\FBro5.0'
    ];
    for (const relativePath of [
      `src/${projectId}/MainWindow.lcpp`,
      `.lingbuilder/projects/${projectId}/window-designer.json`,
      `config/${projectId}/browser-instances.json`,
      `assets/${projectId}/doubao-downloader/manifest.json`
    ]) {
      const content = await fs.readFile(path.join(imported.workspacePath, ...relativePath.split('/')), 'utf8');
      if (forbiddenDeveloperPaths.some(forbidden => content.includes(forbidden))) {
        throw new Error(`回读文件包含开发机绝对路径：${relativePath}`);
      }
    }
    await Promise.all([
      fs.access(path.join(imported.workspacePath, '.lingbuilder', 'build-configuration.json')),
      fs.access(path.join(imported.workspacePath, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui', 'lingbuilder.module.json')),
      fs.access(path.join(imported.workspacePath, '.lingbuilder', 'modules', 'lingbuilder.fbro.sdk', 'lingbuilder.module.json')),
      fs.access(path.join(imported.workspacePath, 'assets', projectId, 'doubao-downloader', 'manifest.json'))
    ]);
  } finally {
    await fs.rm(importParent, { recursive: true, force: true });
  }
  console.log(JSON.stringify({
    ok: true,
    projectId,
    packagePath,
    packageBytes: preview.totalBytes,
    packageSha256: preview.packageSha256,
    sourceFiles: exported.lcppFileCount,
    packagedFiles: exported.fileCount,
    generatedFileCount: generated.files.length,
    requiredModules: preview.manifest.modules.map(module => ({ id: module.id, version: module.version, bundled: module.bundled }))
  }, null, 2));
}

void main();
