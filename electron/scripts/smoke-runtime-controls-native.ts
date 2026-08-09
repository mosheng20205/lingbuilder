import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project, type GeneratedLingCppNativeProject } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const newEmojiBuildDirectory = path.resolve(repoRoot, '.lingbuilder-build', 'runtime-controls-new-emoji-native-smoke');
const win32BuildDirectory = path.resolve(repoRoot, '.lingbuilder-build', 'runtime-controls-win32-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function resolveMsBuild(): Promise<string> {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, [
    '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  return path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
}

async function buildGeneratedProject(options: {
  buildDirectory: string;
  projectId: string;
  generated: GeneratedLingCppNativeProject;
  enabledModules: InstalledModule[];
  msbuild: string;
}): Promise<string[]> {
  const { buildDirectory, projectId, generated, enabledModules, msbuild } = options;
  if (!buildDirectory.startsWith(`${repoRoot}${path.sep}`)) throw new Error('运行时控件烟雾测试目录越出工作区。');
  await fs.rm(buildDirectory, { recursive: true, force: true });
  await fs.mkdir(buildDirectory, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(buildDirectory, file.relativePath);
    if (!target.startsWith(`${buildDirectory}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const executableIcon = path.join(buildDirectory, 'resources', 'lingbuilder-app.ico');
  await fs.mkdir(path.dirname(executableIcon), { recursive: true });
  await fs.copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v2.ico'), executableIcon);
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, buildDirectory);
  if (dependencyDiagnostics.length > 0) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({ projectDir: buildDirectory, projectId, generatedFiles: generated.files, enabledModules });
  const platforms: string[] = [];
  for (const platform of ['Win32', 'x64']) {
    try {
      await execFileAsync(msbuild, [
        exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'
      ], { cwd: buildDirectory, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    } catch (error: any) {
      throw new Error([error.stdout, error.stderr, error.message].filter(Boolean).join('\n'));
    }
    await fs.access(path.join(buildDirectory, platform, 'Release', 'bin', `${exported.projectName}.exe`));
    platforms.push(platform);
  }
  return platforms;
}

async function main() {
  const msbuild = await resolveMsBuild();
  const moduleRoot = path.join(repoRoot, '.lingbuilder', 'module-build', 'lingbuilder.new_emoji.ui');
  const manifest = JSON.parse(await fs.readFile(path.join(moduleRoot, 'lingbuilder.module.json'), 'utf8')) as InstalledModule['manifest'];
  const enabledModules: InstalledModule[] = [{
    manifest,
    installPath: moduleRoot,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }];
  const runtimeControls = (manifest.contributes?.designerControls || []).filter(control => control.runtimeControl);
  if (runtimeControls.length !== 93) throw new Error(`new_emoji 运行时控件目录应为 93 项，实际 ${runtimeControls.length} 项。`);

  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'runtime-controls-new-emoji-native-smoke',
    name: 'new_emoji 运行时控件原生烟雾测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '运行时控件烟雾测试',
      width: 520, height: 280, background: '#ffffff', description: '', designerBackend: 'new-emoji',
      controls: [{
        id: 'static-button', type: 'Button', designerType: 'lingbuilder.new_emoji.ui/Button', name: '静态按钮',
        x: 20, y: 20, width: 120, height: 36, content: '静态按钮', background: '#ffffff', foreground: '#111111',
        fontFamily: 'Microsoft YaHei UI', fontSize: 14, fontBold: false, fontItalic: false,
        visibility: 'Visible', isEnabled: true, tagText: '静态确认', tagInteger: 0, properties: {}, events: {}
      }]
    }]
  };
  const source = [
    '类 MainWindow',
    '    事件 创建完毕()',
    '        局部 NE按钮 动态按钮 = 控件_创建NE按钮(当前窗口, 170, 20, 120, 36, "动态按钮", "动态确认", -7)',
    '        局部 NE按钮 查找按钮 = 通过标记文本获取NE按钮("动态确认")',
    '        控件_设置启用(动态按钮, 真)',
    '        NE按钮_绑定被点击(动态按钮, &动态按钮被点击)',
    '        控件_是否有效(查找按钮)',
    '    结束',
    '    事件 动态按钮被点击()',
    '        调试输出("new_emoji 动态事件")',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window', lingCppSourceCode: source, lingCppSourceFilePath: 'src/MainWindow.lcpp', enabledModules
  });
  if (generated.blockingDiagnostics.length > 0) throw new Error(generated.blockingDiagnostics.join('\n'));
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  if ((mainCpp.match(/static LingControlRef 控件_创建NE/gu) || []).length !== 93) {
    throw new Error('生成的 C++ 未覆盖 93 个 new_emoji 高层创建器。');
  }

  const newEmojiPlatforms = await buildGeneratedProject({
    buildDirectory: newEmojiBuildDirectory, projectId: project.id, generated, enabledModules, msbuild
  });

  const win32Modules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.win32.common-controls')];
  const win32Project: LingWindowProject = {
    schemaVersion: 2,
    id: 'runtime-controls-win32-native-smoke',
    name: 'Win32 运行时控件原生烟雾测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'Win32 运行时控件烟雾测试',
      width: 620, height: 360, background: '#ffffff', description: '', controls: []
    }]
  };
  const win32Source = [
    '类 MainWindow',
    '    事件 创建完毕()',
    '        局部 按钮 动态按钮 = 控件_创建按钮(当前窗口, 20, 20, 120, 36, "动态按钮", "确认", 0)',
    '        局部 列表视图 动态列表 = 控件_创建列表视图(当前窗口, 20, 72, 320, 180, "", "数据", -1)',
    '        控件_设置启用(动态按钮, 真)',
    '        动态按钮.内容 = "Win32 动态按钮"',
    '        按钮_绑定被单击(动态按钮, &动态按钮被单击)',
    '        列表视图_绑定选择项被改变(动态列表, &动态列表选择改变)',
    '    结束',
    '    事件 动态按钮被单击()',
    '        调试输出("Win32 动态按钮事件")',
    '    结束',
    '    事件 动态列表选择改变()',
    '        调试输出("Win32 高级控件事件")',
    '    结束',
    '结束类'
  ].join('\n');
  const win32Generated = generateLingCppNativeWin32Project(win32Project, {
    activeWindowId: 'main-window', lingCppSourceCode: win32Source, lingCppSourceFilePath: 'src/MainWindow.lcpp', enabledModules: win32Modules
  });
  if (win32Generated.blockingDiagnostics.length > 0) throw new Error(win32Generated.blockingDiagnostics.join('\n'));
  const win32Platforms = await buildGeneratedProject({
    buildDirectory: win32BuildDirectory, projectId: win32Project.id, generated: win32Generated, enabledModules: win32Modules, msbuild
  });
  console.log(JSON.stringify({
    ok: true,
    newEmoji: { runtimeControls: runtimeControls.length, platforms: newEmojiPlatforms, buildDirectory: newEmojiBuildDirectory },
    win32: { runtimeControls: 32, platforms: win32Platforms, buildDirectory: win32BuildDirectory }
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
