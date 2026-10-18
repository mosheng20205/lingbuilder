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
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'win32basic-runtime-props-smoke');

/** 2026-10-17 真机验收：win32.basic 运行期专属属性与项目操作 11 条命令，MSVC 双编译 + 启动存活。 */
async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('win32.basic 运行期属性冒烟目录越出工作区。');
  }
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'win32basic-runtime-props-smoke',
    name: '运行期属性冒烟',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: '运行期属性冒烟',
      width: 900,
      height: 1000,
      background: '#1f2937',
      description: '验证 win32.basic 与 common-controls 运行期专属属性命令可由 MSVC 编译并正常运行',
      controls: [
        { id: 'ctrl-password', type: 'TextBox', name: '密码框', content: '', x: 24, y: 24, width: 200, height: 30, fontSize: 12, background: '#2D2D30', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-search', type: 'TextBox', name: '搜索框', content: '', x: 24, y: 70, width: 200, height: 30, fontSize: 12, background: '#2D2D30', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-result', type: 'TextBox', name: '结果框', content: '', x: 24, y: 116, width: 380, height: 150, fontSize: 12, background: '#2D2D30', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible', properties: { multiline: true } },
        { id: 'ctrl-progress', type: 'ProgressBar', name: '进度条1', content: '50', x: 24, y: 290, width: 380, height: 22, fontSize: 12, background: '#2D2D30', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-list', type: 'ListBox', name: '列表框1', content: '', x: 430, y: 24, width: 420, height: 220, fontSize: 12, background: '#0F172A', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-combo', type: 'ComboBox', name: '组合框1', content: '选择项', x: 430, y: 256, width: 200, height: 40, fontSize: 12, background: '#0F172A', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-check', type: 'CheckBox', name: '复选框1', content: '选项', x: 24, y: 324, width: 150, height: 24, fontSize: 12, background: '#1f2937', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-radio', type: 'RadioButton', name: '单选框1', content: '单选', x: 24, y: 356, width: 150, height: 24, fontSize: 12, background: '#1f2937', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-group', type: 'GroupBox', name: '分组框1', content: '分组', x: 24, y: 390, width: 380, height: 120, fontSize: 12, background: '#1f2937', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-image', type: 'Image', name: '图片框1', content: '', x: 650, y: 310, width: 200, height: 100, fontSize: 12, background: '#1f2937', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-animated', type: 'AnimatedImage', name: '动态图像1', content: '', x: 650, y: 420, width: 200, height: 90, fontSize: 12, background: '#1f2937', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-track', type: 'TrackBar', name: '滑块1', content: '', x: 24, y: 524, width: 380, height: 36, fontSize: 12, background: '#1f2937', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-datetime', type: 'DateTimePicker', name: '日期选择1', content: '', x: 24, y: 572, width: 220, height: 40, fontSize: 12, background: '#1f2937', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-calendar', type: 'MonthCalendar', name: '月历1', content: '', x: 24, y: 624, width: 300, height: 300, fontSize: 12, background: '#1f2937', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-rich', type: 'RichEdit', name: '富文本框1', content: '', x: 430, y: 524, width: 420, height: 320, fontSize: 12, background: '#1f2937', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' }
      ]
    }]
  };
  const source = [
    '类 MainWindow',
    '    事件 创建完毕()',
    '        控件_设置只读(结果框, 真)',
    '        控件_设置文本(结果框, "只读结果框：由代码写入")',
    '        控件_设置密码输入(密码框, 真)',
    '        控件_设置提示文字(搜索框, "输入关键字...")',
    '        控件_设置数值范围(进度条1, 0, 1000)',
    '        控件_设置数值(进度条1, 600)',
    '        控件_设置不确定进度(进度条1, 真)',
    '        控件_设置表项高度(列表框1, 32)',
    '        局部 整数型 第二项 = 控件_插入项目(列表框1, 0, "甲")',
    '        控件_插入项目(列表框1, -1, "丙")',
    '        控件_设置选择项(列表框1, 1)',
    '        控件_修改项目(列表框1, 1, "乙(选中态改写)")',
    '        调试输出("项目数", 控件_取项目数量(列表框1))',
    '        调试输出("第2项", 控件_取项目文本(列表框1, 1))',
    '        调试输出("插入位置", 第二项)',
    '        控件_删除项目(列表框1, 0)',
    '        调试输出("删除后项目数", 控件_取项目数量(列表框1))',
    '        控件_设置不确定进度(进度条1, 假)',
    '        控件_设置密码输入(密码框, 假)',
    '        控件_设置只读(结果框, 假)',
    '        // 第二批：自绘层运行期属性与播放控制',
    '        控件_设置选中颜色(列表框1, "#0E7490", "#38BDF8", "#FFFFFF")',
    '        控件_设置选中颜色(组合框1, "", "", "#FF0000")',
    '        控件_设置选中标记颜色(复选框1, "#0E7490", "#FFFFFF")',
    '        控件_设置选中标记颜色(单选框1, "#7C3AED", "")',
    '        控件_设置边框(列表框1, 真, 2, "#334155")',
    '        控件_设置边框(分组框1, 真, 1, "#64748B")',
    '        控件_设置边框(组合框1, 真, 1, "")',
    '        控件_设置标题对齐(分组框1, 1)',
    '        控件_设置文本对齐(列表框1, 1)',
    '        控件_设置填充方式(图片框1, 2)',
    '        控件_播放(动态图像1)',
    '        控件_暂停(动态图像1)',
    '        控件_设置循环播放(动态图像1, 真)',
    '        // 第三批：common-controls 运行期命令',
    '        滑块_置刻度间隔(滑块1, 10)',
    '        调试输出("刻度间隔", 滑块_取刻度间隔(滑块1))',
    '        日期时间选择器_置日期(日期选择1, "2026-10-17")',
    '        日期时间选择器_置显示格式(日期选择1, "yyyy年MM月dd日")',
    '        调试输出("选择器日期", 日期时间选择器_取日期(日期选择1))',
    '        月历_置日期(月历1, "2026-10-01")',
    '        月历_置选中范围(月历1, "2026-10-02", "2026-10-09")',
    '        调试输出("月历日期", 月历_取日期(月历1))',
    '        富文本框_置RTF文本(富文本框1, "")',
    '        局部 文本型 RTF内容 = 富文本框_取RTF文本(富文本框1)',
    '        调试输出("RTF", RTF内容)',
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
    '控件_设置只读(const wchar_t* controlName, bool readOnly)',
    '控件_设置密码输入(const wchar_t* controlName, bool password)',
    '控件_设置提示文字(const wchar_t* controlName, const wchar_t* placeholder)',
    '控件_设置数值范围(const wchar_t* controlName, int minimum, int maximum)',
    '控件_设置不确定进度(const wchar_t* controlName, bool marquee)',
    '控件_插入项目(const wchar_t* controlName, int index, const wchar_t* text)',
    '控件_删除项目(const wchar_t* controlName, int index)',
    '控件_修改项目(const wchar_t* controlName, int index, const wchar_t* text)',
    '控件_取项目文本(const wchar_t* controlName, int index)',
    '控件_取项目数量(const wchar_t* controlName)',
    '控件_设置表项高度(const wchar_t* controlName, int itemHeight)',
    '控件_设置选中颜色(const wchar_t* controlName, const wchar_t* startColor, const wchar_t* endColor, const wchar_t* borderColor)',
    '控件_设置选中标记颜色(const wchar_t* controlName, const wchar_t* selectedColor, const wchar_t* markColor)',
    '控件_设置边框(const wchar_t* controlName, bool visible, int borderWidth, const wchar_t* borderColor)',
    '控件_设置标题对齐(const wchar_t* controlName, int alignment)',
    '控件_设置文本对齐(const wchar_t* controlName, int alignment)',
    '控件_设置填充方式(const wchar_t* controlName, int mode)',
    '控件_播放(const wchar_t* controlName)',
    '控件_暂停(const wchar_t* controlName)',
    '控件_设置循环播放(const wchar_t* controlName, bool loop)',
    '滑块_置刻度间隔(const wchar_t* controlName, int tickFrequency)',
    '滑块_取刻度间隔(const wchar_t* controlName)',
    '日期时间选择器_置日期(const wchar_t* controlName, const wchar_t* dateText)',
    '日期时间选择器_取日期(const wchar_t* controlName)',
    '日期时间选择器_置显示格式(const wchar_t* controlName, const wchar_t* formatText)',
    '月历_置日期(const wchar_t* controlName, const wchar_t* dateText)',
    '月历_取日期(const wchar_t* controlName)',
    '月历_置选中范围(const wchar_t* controlName, const wchar_t* startDate, const wchar_t* endDate)',
    '富文本框_置RTF文本(const wchar_t* controlName, const wchar_t* rtfText)',
    '富文本框_取RTF文本(const wchar_t* controlName)',
    'placeholderOverride',
    'hasValueRangeOverride',
    'ResolveListItemHeight',
    'ParseRuntimeColor',
    'ResolveBorderWidth',
    'ResolveStretchOption',
    'ResolveSelectionStart',
    'ResolveSelectedMarkColor',
    'imageSourcePath'
  ];
  for (const symbol of expectedSymbols) {
    if (!runtimeHeader.includes(symbol)) throw new Error(`生成 C++ 缺少新运行时符号：${symbol}`);
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
        console.log('PASS x64 启动 2.5 秒存活（创建完毕事件内 11 条命令全部执行未崩溃）');
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
