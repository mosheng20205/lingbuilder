import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'monthcal-repeat-probe');

/**
 * 2026-10-25 真机回归：月历左右箭头连点后「松手仍自动跳月」。
 * 根因是 ControlSubclassProc 在转发 WM_LBUTTONUP 之前抢先 ReleaseCapture，原生 MonthCal
 * 把 WM_CAPTURECHANGED 当成取消，跳过收尾的 KillTimer，内部自动重复定时器持续翻月。
 * 本脚本生成最小月历窗口（月历 + 状态标签 + 按钮），双平台编译后用鼠标真机连点，
 * 断言：① 连点后画面静止 ② 点击日期仍派发 ValueChanged ③ 点击按钮仍派发 Click。
 */
async function main() {
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'monthcal-repeat-probe',
    name: '月历连点探针',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: '月历连点探针',
      width: 420,
      height: 500,
      background: '#1E1E1E',
      description: '复现月历左右箭头连点后自动跳月',
      controls: [
        {
          id: 'ctrl-cal', type: 'MonthCalendar', name: '月历1', content: '',
          x: 20, y: 20, width: 300, height: 300, fontSize: 12,
          background: '#2D2D30', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible',
          properties: { value: '2026-10-24' }
        },
        {
          id: 'ctrl-label', type: 'Label', name: '状态标签', content: '就绪',
          x: 20, y: 330, width: 360, height: 24, fontSize: 12,
          background: '#1E1E1E', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible',
          properties: {}
        },
        {
          id: 'ctrl-button', type: 'Button', name: '测试按钮', content: '点我',
          x: 20, y: 370, width: 120, height: 36, fontSize: 12,
          background: '#2563EB', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible',
          properties: {}
        }
      ]
    }]
  };
  const source = [
    '类 MainWindow',
    '    事件 _月历1_日期被改变()',
    '        控件_设置文本(状态标签, "日期：" + 月历_取日期(月历1))',
    '    结束',
    '',
    '    事件 _测试按钮_被单击()',
    '        控件_设置文本(状态标签, "按钮已点击")',
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
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));

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
  const platforms: Array<'x64' | 'Win32'> = ['x64', 'Win32'];
  for (const platform of platforms) {
    await execFileAsync(msbuild, [
      exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'
    ], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    const built = path.join(projectDir, platform, 'Release', 'bin', `${exported.projectName}.exe`);
    await fs.access(built);
    console.log(`PASS MSVC ${platform} 编译：${built}`);
  }
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);

  // 1) 连点右箭头 6 次后停止输入：月历必须立即静止（不出现自动翻月），且点击本身仍生效。
  const burst = await runDriver(executable, ['-Mode', 'click', '-RelX', '0.7583', '-RelY', '0.2733',
    '-Clicks', '6', '-ClickGapMs', '60', '-SampleCount', '12', '-SampleGapMs', '250']);
  assertEqual(burst, 'DISTINCT_FRAMES_AFTER_RELEASE', '1', '连点箭头后松手仍在自动翻月');
  assertEqual(burst, 'FINAL_VS_BEFORE_CHANGED', 'True', '连点箭头没有真正翻月（点击未生效）');
  console.log('PASS 连点右箭头 6 次后停止输入：画面立即静止，无自动翻月');

  // 2) 点击日期格：ValueChanged 事件仍要派发到中文处理器（改写状态标签）。
  const valueChanged = await runDriver(executable, ['-Mode', 'click', '-CaptureRegion', 'label',
    '-ClickDx', '152', '-ClickDy', '160', '-Clicks', '1', '-SampleCount', '1', '-SampleGapMs', '400']);
  assertEqual(valueChanged, 'FINAL_VS_BEFORE_CHANGED', 'True', '点击日期后 ValueChanged 未派发（状态标签未改写）');
  console.log('PASS 点击日期格：ValueChanged 派发并改写状态标签');

  // 3) 点击按钮：BN_CLICKED 事件仍要派发（WM_LBUTTONUP 转发顺序调整不能影响按钮）。
  const buttonClick = await runDriver(executable, ['-Mode', 'click', '-CaptureRegion', 'label',
    '-ClickDx', '60', '-ClickDy', '368', '-Clicks', '1', '-SampleCount', '1', '-SampleGapMs', '400']);
  assertEqual(buttonClick, 'FINAL_VS_BEFORE_CHANGED', 'True', '点击按钮后 Click 事件未派发（状态标签未改写）');
  console.log('PASS 点击按钮：Click 派发并改写状态标签');

  console.log(JSON.stringify({ ok: true, executable, projectDir }, null, 2));
}

async function runDriver(executable: string, args: string[]): Promise<string> {
  const driver = path.resolve(import.meta.dirname, 'smoke-monthcal-arrow-repeat.ps1');
  const outDir = path.join(projectDir, 'shots');
  const { stdout } = await execFileAsync('powershell', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', driver,
    '-Exe', executable, '-OutDir', outDir, ...args
  ], { windowsHide: true, timeout: 3 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 });
  const matched = /ERROR: [^\r\n]+/u.exec(stdout);
  if (matched) throw new Error(`驱动失败：${matched[0]}`);
  return stdout;
}

function assertEqual(output: string, key: string, expected: string, message: string) {
  const matched = new RegExp(`${key}=([^\\r\\n]+)`, 'u').exec(output);
  if (!matched) throw new Error(`驱动输出缺少 ${key}：${message}`);
  if (matched[1].trim() !== expected) {
    throw new Error(`${message}（期望 ${key}=${expected}，实际 ${key}=${matched[1].trim()}）`);
  }
}

async function findMsbuild(): Promise<string> {
  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Microsoft Visual Studio', 'Installer', 'vswhere.exe'
  );
  const installation = (await execFileAsync(vswhere, [
    '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property', 'installationPath'
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
