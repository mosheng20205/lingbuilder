import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { InstalledModule } from '../src/services/modules/types';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.join(repoRoot, '.lingbuilder-build', 'fbro-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main() {
  const enabledModules = [
    builtin('lingbuilder.win32.basic'),
    builtin('lingbuilder.fbro.browser'),
    builtin('lingbuilder.fbro.events'),
    builtin('lingbuilder.fbro.session'),
    builtin('lingbuilder.fbro.transfer'),
    builtin('lingbuilder.fbro.automation'),
    builtin('lingbuilder.fbro.objects'),
    builtin('lingbuilder.fbro.network'),
    builtin('lingbuilder.fbro.vip')
  ];
  const project: LingWindowProject = {
    id: 'fbro-native-smoke', name: 'FBro 原生冒烟测试', windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'FBro 冒烟测试',
      width: 760, height: 520, background: '#202124', description: '验证 FBro 设计器控件',
      controls: [{
        id: 'fbro-browser-1', type: 'FBroBrowser', name: 'FBro浏览器1', content: '', x: 16, y: 16,
        width: 700, height: 430, background: '#ffffff', foreground: '#000000', fontSize: 14,
        isEnabled: true, visibility: 'Visible', properties: {
          url: 'https://example.com', cacheDir: '.fbro-global-cache/profile-smoke-browser-1', enableJs: true,
          loadImages: true, enableWebGL: true, muteAudio: true, proxyMode: 'system', fingerprintProfile: ''
        }, events: {
          Created: 'FBro浏览器1_创建完成', LoadEnd: 'FBro浏览器1_加载完成', Error: 'FBro浏览器1_错误',
          CertificateError: 'FBro浏览器1_证书错误', DragEnter: 'FBro浏览器1_拖入浏览器'
        }
      }]
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 FBro浏览器1_创建完成()',
      '        局部 长整数型 测试缓冲',
      '        局部 长整数型 二进制缓冲',
      '        局部 长整数型 测试值',
      '        局部 长整数型 测试字典',
      '        局部 长整数型 嵌套字典',
      '        局部 长整数型 取回字典',
      '        局部 长整数型 测试列表',
      '        局部 长整数型 取回列表',
      '        局部 长整数型 测试流',
      '        局部 长整数型 流读取缓冲',
      '        局部 整数型 首次释放结果',
      '        局部 整数型 重复释放结果',
      '        测试缓冲 = FBro缓冲_从文本("AB")',
      '        调试输出("FBro 缓冲大小", FBro缓冲_取大小(测试缓冲))',
      '        调试输出("FBro 缓冲十六进制", FBro缓冲_转十六进制(测试缓冲))',
      '        测试值 = FBro值_创建()',
      '        FBro值_设置整数(测试值, 42)',
      '        调试输出("FBro Value 整数", FBro值_取整数(测试值), FBro对象_取类型(测试值))',
      '        FBro值_设置文本(测试值, "对象文本")',
      '        调试输出("FBro Value 文本", FBro值_取文本(测试值))',
      '        测试字典 = FBro字典_创建()',
      '        FBro字典_设置整数(测试字典, "answer", 42)',
      '        FBro字典_设置文本(测试字典, "name", "LingBuilder")',
      '        调试输出("FBro Dictionary", FBro字典_取数量(测试字典), FBro字典_取整数(测试字典, "answer"), FBro字典_取文本(测试字典, "name"))',
      '        调试输出("FBro Dictionary Keys", FBro字典_取键列表JSON(测试字典))',
      '        测试列表 = FBro列表_创建()',
      '        FBro列表_设置数量(测试列表, 3)',
      '        FBro列表_设置文本(测试列表, 0, "first")',
      '        FBro列表_设置整数(测试列表, 1, 7)',
      '        FBro列表_设置二进制(测试列表, 2, 测试缓冲)',
      '        二进制缓冲 = FBro列表_取二进制(测试列表, 2)',
      '        调试输出("FBro List", FBro列表_取数量(测试列表), FBro列表_取文本(测试列表, 0), FBro列表_取整数(测试列表, 1))',
      '        调试输出("FBro Binary", FBro缓冲_转十六进制(二进制缓冲))',
      '        FBro字典_设置列表(测试字典, "items", 测试列表)',
      '        取回列表 = FBro字典_取列表(测试字典, "items")',
      '        调试输出("FBro Nested List", FBro列表_取文本(取回列表, 0))',
      '        嵌套字典 = FBro字典_创建()',
      '        FBro字典_设置文本(嵌套字典, "child", "nested")',
      '        FBro值_设置字典(测试值, 嵌套字典)',
      '        取回字典 = FBro值_取字典(测试值)',
      '        调试输出("FBro Nested Dictionary", FBro字典_取文本(取回字典, "child"))',
      '        测试流 = FBro流_从缓冲创建(测试缓冲)',
      '        流读取缓冲 = FBro流_读取(测试流, 1, 4)',
      '        调试输出("FBro Stream", FBro缓冲_转十六进制(流读取缓冲), FBro流_取位置(测试流), FBro流_是否结束(测试流))',
      '        FBro流_定位(测试流, 0, 0)',
      '        调试输出("FBro Stream Seek", FBro流_取位置(测试流))',
      '        调试输出("FBro 对象类型错误", FBro字典_取数量(测试值))',
      '        首次释放结果 = FBro对象_释放(测试值)',
      '        重复释放结果 = FBro对象_释放(测试值)',
      '        调试输出("FBro 对象释放", 首次释放结果, 重复释放结果)',
      '        调试输出("FBro 子对象级联释放", FBro字典_取数量(嵌套字典), FBro字典_取数量(取回字典))',
      '        FBro对象_释放(测试字典)',
      '        FBro对象_释放(测试流)',
      '        FBro缓冲_释放(测试缓冲)',
      '        FBro缓冲_释放(二进制缓冲)',
      '        FBro缓冲_释放(流读取缓冲)',
      '        FBro_设置缩放级别(FBro浏览器1, 0)',
      '        FBro_设置静音(FBro浏览器1, 真)',
      '        FBro_设置焦点(FBro浏览器1, 真)',
      '        FBro_设置宿主焦点(FBro浏览器1, 真)',
      '        FBro_设置自动调整大小(FBro浏览器1, 假, 0, 0, 1080, 1920)',
      '        FBro_查找(FBro浏览器1, "Example", 真, 假, 假)',
      '        FBro_停止查找(FBro浏览器1, 真)',
      '        调试输出("FBro 浏览器状态", FBro_是否可后退(FBro浏览器1), FBro_是否可前进(FBro浏览器1), FBro_是否加载中(FBro浏览器1))',
      '        调试输出("FBro 缩放和音频", FBro_取缩放级别(FBro浏览器1), FBro_是否静音(FBro浏览器1))',
      '        调试输出("FBro DevTools 状态", FBro_是否打开开发者工具(FBro浏览器1))',
      '        调试输出("FBro 实例状态", FBro_取浏览器标识(FBro浏览器1), FBro_是否同一实例(FBro浏览器1, FBro浏览器1), FBro_是否弹出窗口(FBro浏览器1), FBro_是否有文档(FBro浏览器1), FBro_是否有视图(FBro浏览器1))',
      '        FBro_关闭开发者工具(FBro浏览器1)',
      '        FBro_绑定事件(FBro浏览器1, "TitleChanged", &FBro浏览器1_加载完成)',
      '        调试输出("FBro 已创建")',
      '        调试输出("FBro VIP 应用结果", FBro指纹_应用配置(FBro浏览器1, "{}"))',
      '        调试输出("FBro VIP 授权信息", FBro_取最近错误(FBro浏览器1))',
      '    结束',
      '    事件 FBro浏览器1_加载完成()',
      '        局部 长整数型 主框架',
      '        局部 长整数型 按标识框架',
      '        局部 文本型 主框架标识',
      '        局部 长整数型 图像任务',
      '        局部 长整数型 图像对象',
      '        局部 长整数型 PNG缓冲',
      '        局部 长整数型 证书任务',
      '        局部 长整数型 证书对象',
      '        局部 长整数型 证书主体',
      '        局部 长整数型 DER缓冲',
      '        局部 长整数型 Cookie设置任务',
      '        局部 长整数型 Cookie读取任务',
      '        局部 长整数型 Cookie全部任务',
      '        局部 长整数型 Cookie刷新任务',
      '        局部 长整数型 Cookie删除任务',
      '        局部 长整数型 缓存清理任务',
      '        局部 长整数型 PDF任务',
      '        局部 长整数型 截图任务',
      '        局部 长整数型 文件对话框任务',
      '        局部 长整数型 文件对话框无效任务',
      '        调试输出(FBro_取地址(FBro浏览器1))',
      '        主框架 = FBro框架_取主框架(FBro浏览器1)',
      '        主框架标识 = FBro框架_取标识(主框架)',
      '        按标识框架 = FBro框架_按标识取框架(FBro浏览器1, 主框架标识)',
      '        调试输出("FBro Frame", FBro对象_取类型(主框架), FBro框架_是否有效(主框架), FBro框架_是否主框架(主框架), FBro框架_是否焦点框架(主框架), FBro框架_取地址(主框架), FBro框架_取名称(主框架), 主框架标识)',
      '        调试输出("FBro Frame Lookup", FBro对象_取类型(按标识框架), FBro框架_取浏览器实例(主框架), FBro框架_取父框架(主框架), FBro框架_取标识列表JSON(FBro浏览器1), FBro框架_取名称列表JSON(FBro浏览器1))',
      '        调试输出("FBro Frame Focused", FBro框架_取焦点框架(FBro浏览器1), FBro框架_按名称取框架(FBro浏览器1, FBro框架_取名称(主框架)))',
      '        FBro框架_执行JS(主框架, "document.documentElement.dataset.lingbuilderFrameSmoke=\'ok\'", "lingbuilder://frame-smoke", 1)',
      '        FBro框架_复制(主框架)',
      '        Cookie设置任务 = FBro会话_异步设置Cookie(FBro浏览器1, "https://example.com", "lingbuilder_session_smoke", "ok", "", "/", 真, 真)',
      '        调试输出("FBro Cookie Set", FBro任务_等待(Cookie设置任务, 10000))',
      '        调试输出("FBro Cookie Set Result", FBro任务_取结果(Cookie设置任务))',
      '        Cookie读取任务 = FBro会话_异步取地址Cookie(FBro浏览器1, "https://example.com", 真)',
      '        调试输出("FBro Cookie Visit", FBro任务_等待(Cookie读取任务, 10000))',
      '        调试输出("FBro Cookie Visit Result", FBro任务_取结果(Cookie读取任务))',
      '        Cookie全部任务 = FBro会话_异步取全部Cookie(FBro浏览器1)',
      '        调试输出("FBro Cookie Visit All", FBro任务_等待(Cookie全部任务, 10000))',
      '        调试输出("FBro Cookie Visit All Result", FBro任务_取结果(Cookie全部任务))',
      '        Cookie刷新任务 = FBro会话_异步刷新Cookie存储(FBro浏览器1)',
      '        调试输出("FBro Cookie Flush", FBro任务_等待(Cookie刷新任务, 10000))',
      '        Cookie删除任务 = FBro会话_异步删除Cookie(FBro浏览器1, "https://example.com", "lingbuilder_session_smoke")',
      '        调试输出("FBro Cookie Delete", FBro任务_等待(Cookie删除任务, 10000))',
      '        缓存清理任务 = FBro会话_异步清理缓存(FBro浏览器1, "https://example.com", 1, 7)',
      '        调试输出("FBro Cache Clear", FBro任务_等待(缓存清理任务, 10000))',
      '        调试输出("FBro Cache Clear Result", FBro任务_取结果(缓存清理任务))',
      '        PDF任务 = FBro传输_异步生成PDF(FBro浏览器1, "fbro-transfer-smoke.pdf", "{}")',
      '        调试输出("FBro PDF Wait", FBro任务_等待(PDF任务, 20000))',
      '        调试输出("FBro PDF Result", FBro任务_取结果(PDF任务))',
      '        截图任务 = FBro传输_异步截图(FBro浏览器1, "png", 90, 0, 0, 0, 0, 1, 真, 真)',
      '        调试输出("FBro Screenshot Invalid VIP Wait", FBro任务_等待(截图任务, 10000))',
      '        调试输出("FBro Screenshot Invalid VIP Error", FBro任务_取错误(截图任务), FBro任务_取缓冲(截图任务))',
      '        文件对话框无效任务 = FBro传输_异步打开文件对话框(FBro浏览器1, 9, "无效模式", "", "[]")',
      '        调试输出("FBro File Dialog Invalid", 文件对话框无效任务)',
      '        图像任务 = FBro图像_异步下载(FBro浏览器1, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", 假, 64, 真)',
      '        调试输出("FBro Image Wait", FBro任务_等待(图像任务, 10000))',
      '        图像对象 = FBro任务_取对象(图像任务)',
      '        PNG缓冲 = FBro图像_转PNG缓冲(图像对象, 1, 真)',
      '        调试输出("FBro Image", FBro图像_是否为空(图像对象), FBro图像_取宽度(图像对象), FBro图像_取高度(图像对象), FBro图像_取表示信息JSON(图像对象, 1), FBro缓冲_取大小(PNG缓冲))',
      '        证书任务 = FBro证书_异步取当前(FBro浏览器1)',
      '        调试输出("FBro Certificate Wait", FBro任务_等待(证书任务, 10000))',
      '        证书对象 = FBro任务_取对象(证书任务)',
      '        证书主体 = FBro证书_取主体(证书对象)',
      '        DER缓冲 = FBro证书_取DER缓冲(证书对象)',
      '        调试输出("FBro Certificate", FBro证书主体_取通用名(证书主体), FBro证书主体_取组织JSON(证书主体), FBro证书_取生效时间(证书对象), FBro证书_取失效时间(证书对象), FBro证书_取颁发链数量(证书对象), FBro缓冲_取大小(DER缓冲))',
      ...(process.env.LINGBUILDER_FBRO_INTERACTIVE_FILE_DIALOG === '1' ? [
        '        调试输出("FBro File Dialog Starting")',
        '        文件对话框任务 = FBro传输_异步打开文件对话框(FBro浏览器1, 0, "FBro 文件对话框冒烟测试", "", "[]")',
        '        调试输出("FBro File Dialog Wait", FBro任务_等待(文件对话框任务, 60000))',
        '        调试输出("FBro File Dialog Result", FBro任务_取结果(文件对话框任务))'
      ] : []),
      '        FBro缓冲_释放(PNG缓冲)',
      '        FBro缓冲_释放(DER缓冲)',
      '        FBro对象_释放(图像对象)',
      '        FBro对象_释放(证书对象)',
      '        FBro对象_释放(按标识框架)',
      '        FBro对象_释放(主框架)',
      '        FBro任务_释放(图像任务)',
      '        FBro任务_释放(证书任务)',
      '        FBro任务_释放(Cookie设置任务)',
      '        FBro任务_释放(Cookie读取任务)',
      '        FBro任务_释放(Cookie全部任务)',
      '        FBro任务_释放(Cookie刷新任务)',
      '        FBro任务_释放(Cookie删除任务)',
      '        FBro任务_释放(缓存清理任务)',
      '        FBro任务_释放(PDF任务)',
      '        FBro任务_释放(文件对话框任务)',
      '        FBro任务_释放(截图任务)',
      '    结束',
      '    事件 FBro浏览器1_错误()',
      '        调试输出(FBro_取最近错误(FBro浏览器1))',
      '    结束',
      '    事件 FBro浏览器1_证书错误()',
      '        调试输出("FBro Certificate Event", FBro_取事件对象(FBro浏览器1), FBro_取事件数据(FBro浏览器1))',
      '        FBro_设置事件结果(FBro浏览器1, 2)',
      '    结束',
      '    事件 FBro浏览器1_拖入浏览器()',
      '        调试输出("FBro Drag Event", FBro_取事件对象(FBro浏览器1), FBro_取事件数据(FBro浏览器1))',
      '    结束',
      '结束类'
    ].join('\n')
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const bundledIconCandidates = [
    path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v2.ico'),
    path.join(repoRoot, 'electron', 'assets', 'lingbuilder-window.ico')
  ];
  let bundledIcon = '';
  for (const candidate of bundledIconCandidates) {
    try { await fs.access(candidate); bundledIcon = candidate; break; } catch { /* Try the next bundled icon path. */ }
  }
  if (bundledIcon) {
    await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
    await fs.copyFile(bundledIcon, path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, projectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({
    projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules
  });
  const msbuild = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe';
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], {
    cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  if (process.argv.includes('--build-only')) {
    console.log(JSON.stringify({ ok: true, buildOnly: true, projectDir, executable }, null, 2));
    return;
  }
  const runtime = spawn(executable, [], {
    cwd: path.dirname(executable),
    windowsHide: true,
    stdio: 'ignore'
  });
  await new Promise<void>((resolve, reject) => {
    runtime.once('spawn', resolve);
    runtime.once('error', reject);
  });
  if (!runtime.pid) throw new Error('FBro Win32 原生 smoke 未取得进程 ID。');
  let rendererProcessCount = 0;
  try {
    await new Promise(resolve => setTimeout(resolve, 10_000));
    if (runtime.exitCode !== null) throw new Error(`FBro Win32 原生程序在 10 秒前退出：${runtime.exitCode}`);
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `@(Get-CimInstance Win32_Process -Filter \"ParentProcessId = ${runtime.pid} AND Name = 'FBroSubprocess.exe'\" | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Compress`
    ], { windowsHide: true, timeout: 30_000 });
    const parsed = stdout.trim() ? JSON.parse(stdout) : [];
    const children = Array.isArray(parsed) ? parsed : [parsed];
    rendererProcessCount = children.filter(item => String(item.CommandLine || '').includes('--type=renderer')).length;
    if (rendererProcessCount < 1) throw new Error('FBro Win32 原生 smoke 未检测到 renderer 子进程。');
  } finally {
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$children=@(Get-CimInstance Win32_Process -Filter \"ParentProcessId = ${runtime.pid} AND Name = 'FBroSubprocess.exe'\"); Stop-Process -Id ${runtime.pid} -Force -ErrorAction SilentlyContinue; $children | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`
    ], { windowsHide: true, timeout: 30_000 }).catch(() => undefined);
  }
  console.log(JSON.stringify({ ok: true, projectDir, executable, runtimeSeconds: 10, rendererProcessCount }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
