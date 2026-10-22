import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'win32-scroll-commands-smoke');

/** 2026-10-19 真机验收：Win32 程序化滚动 4 条命令（列表框/多行编辑框/数据表格），MSVC 双编译 + 启动存活。 */
async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('滚动命令冒烟目录越出工作区。');
  }
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'win32-scroll-commands-smoke',
    name: '滚动命令冒烟',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: '滚动命令冒烟',
      width: 900,
      height: 600,
      background: '#1f2937',
      description: '验证 列表框_滚动到项/编辑框_滚动/编辑框_滚动到底/表格_滚动到行 可由 MSVC 编译并正常运行',
      controls: [
        { id: 'ctrl-list', type: 'ListBox', name: '列表框1', content: '', x: 24, y: 24, width: 300, height: 220, fontSize: 12, background: '#0F172A', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-log', type: 'TextBox', name: '日志框', content: '', x: 340, y: 24, width: 520, height: 400, fontSize: 12, background: '#2D2D30', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible', properties: { multiline: true } },
        { id: 'ctrl-grid', type: 'DataGrid', name: '表格1', content: '', x: 24, y: 260, width: 300, height: 300, fontSize: 12, background: '#0F172A', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible', properties: { dataGridColumns: [{ id: 'name', title: '名称', type: 'text', width: 140 }], virtualMode: true, virtualRowCount: 200 } }
      ]
    }]
  };
  const source = [
    '类 MainWindow',
    '    事件 创建完毕()',
    '        局部 整数型 序号 = 0',
    '        计次循环首 (30, 序号)',
    '            控件_添加项目(列表框1, "项目 " + 到文本(序号))',
    '        计次循环尾 ()',
    '        列表框_滚动到项(列表框1, 29)',
    '        调试输出("列表框已滚动到最后一项")',
    '        局部 文本型 日志内容 = ""',
    '        计次循环首 (60, 序号)',
    '            日志内容 = 日志内容 + "日志行 " + 到文本(序号) + "\\n"',
    '        计次循环尾 ()',
    '        控件_设置文本(日志框, 日志内容)',
    '        编辑框_滚动(日志框, -3)',
    '        编辑框_滚动到底(日志框)',
    '        调试输出("日志框已滚动到底")',
    '        表格_滚动到行(表格1, 150)',
    '        表格_滚动到行(表格1, 5000)',
    '        调试输出("越界错误：", 表格_取最后错误(表格1))',
    '    结束',
    '结束类'
  ].join('\n');
  const enabledModules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(moduleId => {
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
  });
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: source,
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules
  });
  if (generated.blockingDiagnostics.length) {
    throw new Error(generated.blockingDiagnostics.join('\n'));
  }
  const runtimeHeader = generated.files.map(file => file.content).join('\n');
  const expectedSymbols = [
    '列表框_滚动到项(const wchar_t* controlName, int index)',
    '编辑框_滚动(const wchar_t* controlName, int lines)',
    '编辑框_滚动到底(const wchar_t* controlName)',
    '表格_滚动到行(const wchar_t*n,int rowIndex)',
    'LB_SETTOPINDEX',
    'EM_LINESCROLL',
    'EM_SCROLL, SB_BOTTOM',
    'L"行索引越界。"',
    'RegisterLingBuilderDataGridClass'
  ];
  for (const symbol of expectedSymbols) {
    if (!runtimeHeader.includes(symbol)) throw new Error(`生成 C++ 缺少滚动运行时符号：${symbol}`);
  }
  for (const forbidden of ['NUL', '\u0000']) {
    if (runtimeHeader.includes(forbidden) && forbidden === '\u0000') throw new Error('生成的 C++ 源码不能包含 NUL 字节。');
  }

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
    projectId: project.id,
    generatedFiles: generated.files,
    enabledModules
  });
  const msbuild = await findMsbuild();
  for (const platform of ['x64', 'Win32']) {
    await execFileAsync(msbuild, [
      exported.solutionPath,
      '/m',
      '/t:Build',
      '/p:Configuration=Release',
      `/p:Platform=${platform}`,
      '/v:minimal'
    ], {
      cwd: projectDir,
      windowsHide: true,
      timeout: 10 * 60 * 1000,
      maxBuffer: 32 * 1024 * 1024
    });
    const executable = path.join(projectDir, platform === 'x64' ? 'x64' : 'Win32', 'Release', 'bin', `${exported.projectName}.exe`);
    await fs.access(executable);
    console.log(`PASS MSVC ${platform} 编译：${executable}`);
    if (platform === 'x64') {
      const child = spawn(executable, [], { stdio: 'ignore', windowsHide: true, detached: false });
      const alive = await new Promise<boolean>(resolve => {
        const timer = setTimeout(() => resolve(true), 2500);
        child.once('exit', () => { clearTimeout(timer); resolve(false); });
        child.once('error', () => { clearTimeout(timer); resolve(false); });
      });
      if (alive) {
        child.kill();
        console.log('PASS x64 启动 2.5 秒存活（创建完毕事件内 4 条滚动命令全部执行未崩溃）');
      } else {
        throw new Error('x64 exe 启动后 2.5 秒内退出，疑似运行期崩溃。');
      }
    }
  }
  console.log(JSON.stringify({ ok: true, projectDir, solution: exported.solutionPath }, null, 2));
}

async function findMsbuild(): Promise<string> {
  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  );
  const installation = (await execFileAsync(vswhere, [
    '-latest',
    '-products',
    '*',
    '-requires',
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property',
    'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  await fs.access(msbuild);
  return msbuild;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
