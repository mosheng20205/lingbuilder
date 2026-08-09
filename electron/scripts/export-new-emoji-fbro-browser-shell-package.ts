import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLcppSourcePackageService } from '../electron/lcppSourcePackageService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule, LingBuilderModuleManifest } from '../src/services/modules/types';
import { createSolutionService } from '../src/services/solution/solutionService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const projectId = 'new-emoji-fbro-browser-shell-complete';
const workspaceRoot = path.join(repositoryRoot, '.lingbuilder-build', 'new-emoji-fbro-browser-shell-source-package');
const packagePath = path.join(repositoryRoot, 'exports', 'new_emoji-FBro浏览器外壳完整复刻.lcpppkg');
const moduleIds = [
  'lingbuilder.win32.basic',
  'lingbuilder.new_emoji.ui',
  'lingbuilder.fbro.browser',
  'lingbuilder.fbro.sdk',
  'lingbuilder.new_emoji.fbro-shell'
] as const;

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

async function installed(workspace: string, moduleId: string): Promise<InstalledModule> {
  const installPath = path.join(workspace, '.lingbuilder', 'modules', moduleId);
  const manifest = JSON.parse(await fs.readFile(path.join(installPath, 'lingbuilder.module.json'), 'utf8')) as LingBuilderModuleManifest;
  return { manifest, installPath, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

function assertWorkspacePath(target: string): void {
  const relative = path.relative(repositoryRoot, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`拒绝操作工作区外的临时目录：${target}`);
  }
}

async function copyRequiredModules(): Promise<void> {
  for (const moduleId of ['lingbuilder.new_emoji.ui', 'lingbuilder.fbro.sdk']) {
    const source = path.join(repositoryRoot, '.lingbuilder', 'modules', moduleId);
    const target = path.join(workspaceRoot, '.lingbuilder', 'modules', moduleId);
    await fs.access(path.join(source, 'lingbuilder.module.json'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.cp(source, target, { recursive: true, errorOnExist: true });
  }
}

async function writeProjectMetadata(enabledModules: InstalledModule[]): Promise<void> {
  const pinnedVersions = Object.fromEntries(enabledModules.map(module => [module.manifest.id, module.manifest.version]));
  await fs.writeFile(path.join(workspaceRoot, '.lingbuilder', 'build-configuration.json'), JSON.stringify({
    schemaVersion: 1,
    mode: 'Debug',
    architecture: 'x64'
  }, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, '.lingbuilder', 'projects', projectId, 'project-modules.json'), JSON.stringify({
    schemaVersion: 1,
    enabledModuleIds: [...moduleIds],
    pinnedVersions
  }, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'src', projectId, 'README.md'), `# new_emoji FBro 浏览器外壳完整复刻

本项目按 \`T:\\github\\new_emoji\\examples\\python\\chrome_shell_demo.py\` 的 1180 x 760 Chrome 式界面结构生成：自绘标签栏、独立新建标签按钮、地址栏、下载/扩展/更多菜单、三组右键菜单、自定义窗口按钮和响应式布局均由 new_emoji 原生控件提供。

真实网页由 \`lingbuilder.new_emoji.fbro-shell\` 为每个标签页创建独立 FBro 句柄与非分层伴随宿主 HWND。伴随宿主按 \`BrowserViewport\` 的屏幕坐标同步移动、缩放、DPI、显隐和层级；\`BrowserViewport\` 只负责加载和错误占位，不能替代网页渲染。

导入后直接按 F5 即可使用 x64 配置运行；Visual Studio 导出使用相同的 C++ 生成器和运行时依赖。
`, 'utf8');
}

async function main(): Promise<void> {
  assertWorkspacePath(workspaceRoot);
  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await fs.mkdir(workspaceRoot, { recursive: true });
  try {
    await copyRequiredModules();
    const service = createSolutionService(workspaceRoot);
    const created = await service.createProject({
      name: 'new_emoji FBro浏览器外壳完整复刻',
      projectId,
      templateId: 'new-emoji-fbro-browser-shell',
      windowTitle: '浏览器式外壳 🌐'
    });
    const enabledModules = [
      builtin('lingbuilder.win32.basic'),
      await installed(workspaceRoot, 'lingbuilder.new_emoji.ui'),
      builtin('lingbuilder.fbro.browser'),
      await installed(workspaceRoot, 'lingbuilder.fbro.sdk'),
      builtin('lingbuilder.new_emoji.fbro-shell')
    ];
    await writeProjectMetadata(enabledModules);

    const sourcePath = path.join(workspaceRoot, 'src', projectId, 'MainWindow.lcpp');
    const source = await fs.readFile(sourcePath, 'utf8');
    if (!source.includes('浏览器外壳_新建标签页("home", "https://www.baidu.com", "新标签页")')) {
      throw new Error('完整浏览器外壳默认首页不是 https://www.baidu.com。');
    }
    if (/https?:\/\/(?:127\.0\.0\.1|localhost)/iu.test(source)) {
      throw new Error('完整浏览器外壳源码包含不允许作为默认首页的本地回环地址。');
    }
    for (const requiredLayout of [
      '标签区宽度 = 窗口宽度 - 300',
      '标签控件宽度 = 标签数量 * 标签宽度',
      '控件_设置位置大小(浏览器标签页, 16, 4, 标签控件宽度, 34)',
      '控件_设置位置大小(新建标签按钮, 新建标签横坐标, 5, 30, 30)'
    ]) {
      if (!source.includes(requiredLayout)) throw new Error(`完整浏览器外壳缺少标签栏布局契约：${requiredLayout}`);
    }
    const shellWindow = created.designerProject.windows[0];
    if (shellWindow?.controls.find(control => control.id === 'browser-tabs')?.width !== 220) {
      throw new Error('完整浏览器外壳的初始 Tabs 宽度没有收缩为单标签宽度。');
    }
    const generated = generateLingCppNativeWin32Project(created.designerProject, {
      activeWindowId: created.designerProject.windows[0]!.id,
      lingCppSourceFilePath: `src/${projectId}/MainWindow.lcpp`,
      lingCppSourceCode: source,
      enabledModules
    });
    if (generated.blockingDiagnostics.length > 0) {
      throw new Error(`完整浏览器外壳存在阻断诊断：\n${generated.blockingDiagnostics.join('\n')}`);
    }
    if (!generated.files.some(file => file.relativePath === 'main.cpp')) throw new Error('完整浏览器外壳没有生成 main.cpp。');

    await fs.mkdir(path.dirname(packagePath), { recursive: true });
    const packageService = createLcppSourcePackageService(workspaceRoot);
    const exported = await packageService.exportProject(projectId, packagePath, '0.3.0');
    const preview = await packageService.inspectPackage(packagePath);
    const importParent = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-browser-shell-package-import-'));
    try {
      const imported = await packageService.importPackage(packagePath, importParent);
      const importedSourcePath = path.join(imported.workspacePath, 'src', projectId, 'MainWindow.lcpp');
      const requiredPaths = [
        importedSourcePath,
        path.join(imported.workspacePath, 'src', projectId, 'README.md'),
        path.join(imported.workspacePath, '.lingbuilder', 'projects', projectId, 'window-designer.json'),
        path.join(imported.workspacePath, '.lingbuilder', 'projects', projectId, 'project-modules.json'),
        path.join(imported.workspacePath, '.lingbuilder', 'build-configuration.json'),
        path.join(imported.workspacePath, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui', 'lingbuilder.module.json'),
        path.join(imported.workspacePath, '.lingbuilder', 'modules', 'lingbuilder.fbro.sdk', 'lingbuilder.module.json')
      ];
      await Promise.all(requiredPaths.map(filePath => fs.access(filePath)));
      const importedSource = await fs.readFile(importedSourcePath, 'utf8');
      if (!importedSource.includes('浏览器外壳_新建标签页("home", "https://www.baidu.com", "新标签页")')
        || /https?:\/\/(?:127\.0\.0\.1|localhost)/iu.test(importedSource)) {
        throw new Error('回读后的源码包没有保持百度默认首页。');
      }
    } finally {
      await fs.rm(importParent, { recursive: true, force: true });
    }

    console.log(JSON.stringify({
      ok: true,
      packagePath,
      packageBytes: preview.totalBytes,
      packageSha256: preview.packageSha256,
      projectId,
      sourceFiles: exported.lcppFileCount,
      packagedFiles: exported.fileCount,
      generatedFileCount: generated.files.length,
      controls: created.designerProject.windows[0]!.controls.length,
      requiredModules: preview.manifest.modules.map(module => ({ id: module.id, version: module.version, bundled: module.bundled }))
    }, null, 2));
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
