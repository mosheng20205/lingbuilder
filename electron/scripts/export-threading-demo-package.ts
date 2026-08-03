import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createLcppSourcePackageService } from '../electron/lcppSourcePackageService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { THREADING_COMMAND_SPECS } from '../src/services/modules/threadingModule';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const projectId = 'threading-api-demo';
const sourceRoot = path.join(repositoryRoot, 'src', projectId);
const designerPath = path.join(repositoryRoot, '.lingbuilder', 'projects', projectId, 'window-designer.json');
const exportPath = path.join(repositoryRoot, 'exports', 'LingBuilder-多线程模块2.0-完整演示.lcpppkg');

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

async function validateDemoSource() {
  const project = JSON.parse(await fs.readFile(designerPath, 'utf8')) as LingWindowProject;
  const mainSource = await fs.readFile(path.join(sourceRoot, 'MainWindow.lcpp'), 'utf8');
  const typeSource = await fs.readFile(path.join(sourceRoot, '项目数据类型.lcpp'), 'utf8');
  const missingCommands = THREADING_COMMAND_SPECS
    .map(command => command.name)
    .filter(command => !mainSource.includes(`${command}(`));
  if (missingCommands.length > 0) throw new Error(`演示源码缺少线程命令：${missingCommands.join('、')}`);

  const window = project.windows[0];
  const tabControl = window?.controls.find(control => control.type === 'TabControl');
  if (!tabControl) throw new Error('演示界面缺少 TabControl。');
  const tabs = Array.isArray(tabControl.properties?.tabs) ? tabControl.properties.tabs : [];
  if (tabs.length !== 5) throw new Error(`演示界面应包含 5 个标签页，当前为 ${tabs.length} 个。`);
  const logControl = window.controls.find(control => control.name === '运行日志');
  if (logControl?.type !== 'TextBox' || logControl.properties?.multiline !== true) throw new Error('演示界面缺少多行日志框。');
  const buttonCount = window.controls.filter(control => control.type === 'Button').length;
  if (buttonCount < 20) throw new Error(`演示按钮数量不足：${buttonCount}`);
  for (const tab of tabs) {
    const slot = String((tab as { id?: unknown }).id || '');
    const controls = window.controls.filter(control => control.parentId === tabControl.id && control.containerSlot === slot);
    for (const control of controls) {
      if (control.x < 0 || control.y < 0 || control.x + control.width > tabControl.width || control.y + control.height > tabControl.height) {
        throw new Error(`标签页 ${slot} 中的控件 ${control.name} 越出可视区域。`);
      }
    }
    const buttons = controls.filter(control => control.type === 'Button');
    for (let leftIndex = 0; leftIndex < buttons.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < buttons.length; rightIndex += 1) {
        const left = buttons[leftIndex];
        const right = buttons[rightIndex];
        const overlaps = left.x < right.x + right.width
          && left.x + left.width > right.x
          && left.y < right.y + right.height
          && left.y + left.height > right.y;
        if (overlaps) throw new Error(`标签页 ${slot} 的按钮 ${left.name} 与 ${right.name} 重叠。`);
      }
    }
  }

  const enabledModules = [
    builtin('lingbuilder.win32.basic'),
    builtin('lingbuilder.win32.common-controls'),
    builtin('lingbuilder.threading')
  ];
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: window.id,
    lingCppSources: [
      { filePath: `src/${projectId}/MainWindow.lcpp`, sourceCode: mainSource },
      { filePath: `src/${projectId}/项目数据类型.lcpp`, sourceCode: typeSource }
    ],
    enabledModules
  });
  if (generated.blockingDiagnostics.length > 0) {
    throw new Error(`演示源码存在阻断诊断：\n${generated.blockingDiagnostics.join('\n')}`);
  }
  if (!generated.files.some(file => file.relativePath === 'main.cpp')) throw new Error('演示项目未生成 main.cpp。');
  return {
    commandCount: THREADING_COMMAND_SPECS.length,
    buttonCount,
    tabCount: tabs.length,
    generatedFileCount: generated.files.length,
    generated,
    enabledModules
  };
}

async function verifyNativeBuild(
  project: LingWindowProject,
  generatedFiles: ReturnType<typeof generateLingCppNativeWin32Project>['files'],
  enabledModules: InstalledModule[]
) {
  const buildRoot = path.join(repositoryRoot, '.lingbuilder-build', 'threading-api-demo-verify');
  if (!buildRoot.startsWith(`${repositoryRoot}${path.sep}`)) throw new Error('原生验证目录越出工作区。');
  await fs.rm(buildRoot, { recursive: true, force: true });
  await fs.mkdir(buildRoot, { recursive: true });
  for (const file of generatedFiles) {
    const target = path.resolve(buildRoot, file.relativePath);
    if (!target.startsWith(`${buildRoot}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const exported = await exportVisualStudioProject({
    projectDir: buildRoot,
    projectId: project.id,
    generatedFiles,
    enabledModules
  });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, [
    '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  const platforms: string[] = [];
  for (const platform of ['Win32', 'x64']) {
    await execFileAsync(msbuild, [
      exported.solutionPath,
      '/m',
      '/t:Build',
      '/p:Configuration=Release',
      `/p:Platform=${platform}`,
      '/v:minimal'
    ], { cwd: buildRoot, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    platforms.push(platform);
  }
  return platforms;
}

async function main() {
  const validation = await validateDemoSource();
  const project = JSON.parse(await fs.readFile(designerPath, 'utf8')) as LingWindowProject;
  const nativePlatforms = process.argv.includes('--verify-native')
    ? await verifyNativeBuild(project, validation.generated.files, validation.enabledModules)
    : [];
  await fs.mkdir(path.dirname(exportPath), { recursive: true });
  const service = createLcppSourcePackageService(repositoryRoot);
  const exported = await service.exportProject(projectId, exportPath, '0.2.7');
  const preview = await service.inspectPackage(exportPath);
  const importParent = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-threading-demo-import-'));
  try {
    const imported = await service.importPackage(exportPath, importParent);
    await fs.access(path.join(imported.workspacePath, 'src', projectId, 'MainWindow.lcpp'));
    await fs.access(path.join(imported.workspacePath, 'src', projectId, '项目数据类型.lcpp'));
    await fs.access(path.join(imported.workspacePath, '.lingbuilder', 'projects', projectId, 'window-designer.json'));
  } finally {
    await fs.rm(importParent, { recursive: true, force: true });
  }

  console.log(JSON.stringify({
    ok: true,
    packagePath: exportPath,
    packageBytes: preview.totalBytes,
    packageSha256: preview.packageSha256,
    sourceFiles: exported.lcppFileCount,
    packagedFiles: exported.fileCount,
    commandCount: validation.commandCount,
    buttonCount: validation.buttonCount,
    tabCount: validation.tabCount,
    generatedFileCount: validation.generatedFileCount,
    nativePlatforms
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
