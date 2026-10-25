// 一次性真机验证：时钟 periodHandler 指向普通子程序的生成产物经 MSVC 编译通过（无 C2535）。
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'clock-period-handler-msvc-verify');

async function findVisualStudioInstallation(): Promise<string> {
  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  );
  const { stdout } = await execFileAsync(vswhere, [
    '-latest', '-products', '*', '-requires', 'Microsoft.Component.MSBuild',
    '-property', 'installationPath'
  ]);
  const installation = stdout.split(/\r?\n/).map(line => line.trim()).find(Boolean);
  if (!installation) throw new Error('vswhere 未找到 Visual Studio 安装。');
  return installation;
}

async function main() {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.win32.basic');
  if (!manifest) throw new Error('缺少内置模块 lingbuilder.win32.basic。');
  const enabledModules = [{
    manifest,
    installPath: 'builtin://lingbuilder.win32.basic',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }];

  // periodHandler 指向「空」声明的普通子程序（douyin-engine 实测触发形态），
  // 且普通子程序带返回值调用链，验证保留声明返回类型后调用侧仍编译通过。
  const source = `类 MainWindow
    事件 _MainWindow_创建完毕()
        界面时钟滴答()
        调试输出("启动完成")
    结束
    空 界面时钟滴答()
        调试输出("滴答")
    结束
    整数型 取计数上限()
        返回 10
    结束
结束类`;

  const project = {
    schemaVersion: 2,
    id: 'clock-period-handler-msvc-verify',
    name: '时钟普通子程序真机验证',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: '时钟普通子程序真机验证',
      width: 360,
      height: 200,
      background: '#202028',
      description: '验证时钟 periodHandler 指向普通子程序时生成产物可由 MSVC 编译',
      controls: []
    }],
    resources: [{
      id: 'clock-1', type: 'Clock', name: '界面时钟', ownerWindowId: 'main-window',
      periodMilliseconds: 1000, startEnabled: true, periodHandler: '界面时钟滴答'
    }]
  };

  const generated = generateLingCppNativeWin32Project(project as never, {
    activeWindowId: 'main-window',
    lingCppSourceCode: source,
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules
  });
  if (generated.blockingDiagnostics.length) {
    throw new Error(`生成阻断：\n${generated.blockingDiagnostics.join('\n')}`);
  }
  const mainCpp = generated.files.reduce((acc: string, file: { relativePath: string; content: string }) => file.relativePath === 'main.cpp' ? acc + file.content : acc, '');
  const definitionCount = (mainCpp.match(/void 界面时钟滴答\(\)/gu) || []).length;
  if (definitionCount !== 1) throw new Error(`界面时钟滴答 定义份数异常：${definitionCount}`);

  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const resourcesDir = path.join(projectDir, 'resources');
  await fs.mkdir(resourcesDir, { recursive: true });
  await fs.copyFile(
    path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'),
    path.join(resourcesDir, 'lingbuilder-app.ico')
  );
  const exported = await exportVisualStudioProject({
    projectDir,
    projectId: (project as { id: string }).id,
    generatedFiles: generated.files,
    enabledModules
  });
  const installation = await findVisualStudioInstallation();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  await execFileAsync(msbuild, [
    exported.solutionPath,
    '/m',
    '/t:Build',
    '/p:Configuration=Release',
    '/p:Platform=x64',
    '/v:minimal'
  ], {
    cwd: projectDir,
    windowsHide: true,
    timeout: 10 * 60 * 1000,
    maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  console.log(JSON.stringify({ ok: true, definitionCount, executable }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
