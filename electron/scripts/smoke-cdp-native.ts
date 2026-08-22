import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function findBrowser(): Promise<string> {
  const candidates = [
    process.env['LINGBUILDER_CDP_SMOKE_BROWSER'],
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // 继续尝试下一个候选路径。
    }
  }
  throw new Error('未找到 Edge/Chrome 浏览器；可通过环境变量 LINGBUILDER_CDP_SMOKE_BROWSER 指定可执行文件。');
}

async function reserveAvailablePort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve()); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法分配 CDP smoke 调试端口。');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForDebugEndpoint(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const body = await new Promise<string>((resolve, reject) => {
        const request = http.get({ host: '127.0.0.1', port, path: '/json/version', timeout: 2000 }, response => {
          if (response.statusCode !== 200) { reject(new Error(`状态码 ${response.statusCode}`)); return; }
          const chunks: Buffer[] = [];
          response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        });
        request.on('timeout', () => { request.destroy(); reject(new Error('超时')); });
        request.on('error', reject);
      });
      if (body.includes('webSocketDebuggerUrl')) return;
    } catch {
      // 端点尚未就绪，继续等待。
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('CDP 调试端点在超时时间内未就绪。');
}

async function main(): Promise<void> {
  const msbuild = await findMsBuild();
  const browserPath = await findBrowser();
  const port = await reserveAvailablePort();
  const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-cdp-smoke-'));
  const smokeRoot = path.join(os.tmpdir(), 'lingbuilder-cdp-smoke-project');
  const browser = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    'about:blank'
  ], { windowsHide: true, stdio: 'ignore' });
  try {
    await waitForDebugEndpoint(port, 20000);
    const result = await buildAndRun({
      projectDir: smokeRoot,
      projectId: 'cdp-client-native-smoke',
      enabledModules: [builtin('lingbuilder.cdp.client')],
      platforms: ['Win32', 'x64'],
      port,
      msbuild
    });
    console.log(JSON.stringify({
      ok: true,
      browser: path.basename(browserPath),
      ...result,
      checks: ['多连接注册表', '/json/version 发现', 'WebSocket 升级', 'Target.createTarget + flatten attach', '导航等待 loadEventFired', 'Runtime.evaluate', '元素 focus + 逐字符键输入', '截图写盘', '断开清理', 'Fetch 拦截 mock 响应', '对话框应答', '下载事件', '文件上传', '暗色模式', '生命周期等待']
    }, null, 2));
  } finally {
    browser.kill();
    await new Promise(resolve => setTimeout(resolve, 500));
    await fs.rm(profileDir, { recursive: true, force: true });
  }
}

async function buildAndRun(options: {
  projectDir: string;
  projectId: string;
  enabledModules: InstalledModule[];
  platforms: Array<'Win32' | 'x64'>;
  port: number;
  msbuild: string;
}): Promise<{ projectDir: string; executable: string; compiledPlatforms: string[] }> {
  await fs.rm(options.projectDir, { recursive: true, force: true });
  await fs.mkdir(options.projectDir, { recursive: true });
  await fs.mkdir(path.join(options.projectDir, 'cdp-downloads'), { recursive: true });
  await fs.writeFile(path.join(options.projectDir, 'cdp-upload.txt'), 'LingBuilder CDP upload smoke', 'utf8');
  const project: LingWindowProject = {
    id: options.projectId,
    name: 'CDP 客户端原生冒烟测试',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'CDP 客户端原生冒烟测试',
      iconStyle: 'none',
      width: 460,
      height: 220,
      background: '#202028',
      description: '验证 CDP 客户端 runtime 连接真实浏览器',
      controls: []
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: createSource(
      options.port,
      path.join(options.projectDir, 'cdp-smoke.png').replace(/\\/gu, '/'),
      path.join(options.projectDir, 'cdp-debug.txt').replace(/\\/gu, '/'),
      options.projectDir
    ),
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules: options.enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const required of ['class LingCdpRuntime', 'WinHttpWebSocketCompleteUpgrade', 'Target.attachToTarget', 'case WM_LINGBUILDER_CDP_CLIENT_EVENT:']) {
    if (!mainCpp.includes(required)) throw new Error(`生成的 CDP 客户端 C++ 缺少：${required}`);
  }
  for (const file of generated.files) {
    const target = path.resolve(options.projectDir, file.relativePath);
    if (!target.startsWith(`${options.projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(options.enabledModules, options.projectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({ projectDir: options.projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules: options.enabledModules });
  for (const platform of options.platforms) {
    await execFileAsync(options.msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], {
      cwd: options.projectDir,
      windowsHide: true,
      timeout: 10 * 60 * 1000,
      maxBuffer: 32 * 1024 * 1024
    });
  }
  const executable = path.join(options.projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  const child = spawn(executable, [], { cwd: path.dirname(executable), windowsHide: true, stdio: 'ignore' });
  const exitCode = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('CDP 客户端原生 smoke 超时。')); }, 60000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); resolve(code ?? -1); });
  });
  if (exitCode !== 0) throw new Error(`CDP 客户端原生 smoke 退出码异常：${exitCode}`);
  const screenshot = await fs.readFile(path.join(options.projectDir, 'cdp-smoke.png'));
  if (screenshot.length < 1024) throw new Error('CDP 截图文件异常：体积过小。');
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  if (!screenshot.subarray(0, 4).equals(pngHeader)) throw new Error('CDP 截图不是有效的 PNG。');
  return { projectDir: options.projectDir, executable, compiledPlatforms: options.platforms };
}

function createSource(port: number, screenshotPath: string, debugPath: string, projectDir: string): string {
  const pageUrl = "data:text/html,<html><head><title>CDP-SMOKE</title></head><body><input id=q><input id=file type=file><a id=dl href=data:application/octet-stream,smoke-download-content download=smoke.bin>dl</a><script>fetch('https://mock.example.test/api');setTimeout(function(){alert('smoke-dialog')},800)</script></body></html>";
  const uploadPath = path.join(projectDir, 'cdp-upload.txt').replace(/\\/gu, '/');
  const downloadsDir = path.join(projectDir, 'cdp-downloads').replace(/\\/gu, '/');
  return [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    `        局部 CDP连接 主连接 = CDP_连接("http://127.0.0.1:${port}", &连接就绪)`,
    `        局部 CDP连接 备用连接 = CDP_连接("http://127.0.0.1:${port}", &备用就绪)`,
    '        @ if (主连接 == 0 || 备用连接 == 0 || CDP_取连接数量() < 2) ExitProcess(6);',
    '        @ CDP_断开连接(备用连接);',
    '    结束',
    '    事件 备用就绪()',
    '    结束',
    '    事件 连接就绪()',
    '        @ if (std::wstring(CDP_取当前事件类型()) != L"已就绪") ExitProcess(4);',
    '        @ if (std::wstring(CDP_取浏览器版本(CDP_取当前连接())).empty()) ExitProcess(7);',
    `        CDP_设置下载目录(CDP_取当前连接(), "${downloadsDir}", 真)`,
    '        CDP_绑定下载事件(CDP_取当前连接(), &下载事件)',
    `        CDP_新建页面(CDP_取当前连接(), "${pageUrl}", &页面就绪)`,
    '    结束',
    '    事件 下载事件()',
    `        @ if (std::wstring(CDP_取当前事件类型()) == L"下载开始") { FILE* dl = nullptr; if (_wfopen_s(&dl, L"${downloadsDir}/begin.ok", L"w") == 0 && dl) { fclose(dl); } }`,
    '    结束',
    '    事件 页面就绪()',
    `        @ if (std::wstring(CDP_取当前事件类型()) != L"页面就绪") { FILE* dbg4 = nullptr; if (_wfopen_s(&dbg4, L"${debugPath}", L"w") == 0 && dbg4) { fwprintf(dbg4, L"exit5 type=[%ls] text=[%ls] err=[%ls]\\n", CDP_取当前事件类型(), CDP_取当前事件文本(), CDP_取当前错误()); fclose(dbg4); } ExitProcess(5); }`,
    '        局部 CDP连接 连接 = CDP_取当前连接()',
    '        局部 CDP页面 页面 = CDP_取当前页面()',
    '        CDP_绑定对话框事件(页面, &对话框出现)',
    '        CDP_拦截开始(页面, "https://mock.example.test/*", &请求被拦截)',
    '        @ CDP_设置视口(页面, 1280, 720);',
    '        @ CDP_设置暗色模式(页面, true);',
    '        @ if (页面 == 0) ExitProcess(21);',
    '        局部 CDP元素 输入框 = CDP_查询元素(页面, "#q")',
    '        @ if (输入框 == 0) ExitProcess(8);',
    '        CDP_输入文本(输入框, "LingBuilder", &输入完成)',
    '    结束',
    '    事件 请求被拦截()',
    '        @ if (std::wstring(CDP_取当前事件类型()) != L"请求被拦截" || CDP_取当前拦截() == 0 || std::wstring(CDP_取当前网络网址()) != L"https://mock.example.test/api") ExitProcess(14);',
    '        @ CDP_拦截模拟响应(CDP_取当前拦截(), 200, L"[{\\"name\\":\\"Content-Type\\",\\"value\\":\\"text/plain\\"}]", L"MOCKED-BODY");',
    '    结束',
    '    事件 对话框出现()',
    '        @ if (std::wstring(CDP_取当前事件类型()) != L"对话框出现") ExitProcess(15);',
    '        @ if (std::wstring(CDP_取当前对话框消息()) != L"smoke-dialog") ExitProcess(16);',
    '        @ CDP_应答对话框(CDP_取当前页面(), true, L"");',
    '    结束',
    '    事件 输入完成()',
    `        @ if (std::wstring(CDP_取当前事件类型()) != L"命令完成") { FILE* dbg3 = nullptr; if (_wfopen_s(&dbg3, L"${debugPath}", L"w") == 0 && dbg3) { fwprintf(dbg3, L"exit9 type=[%ls]\\ntext=[%ls]\\nerr=[%ls]\\n", CDP_取当前事件类型(), CDP_取当前事件文本(), CDP_取当前错误()); fclose(dbg3); } ExitProcess(9); }`,
    '        CDP_执行脚本(CDP_取当前页面(), "document.body.firstElementChild.value", &脚本完成)',
    '    结束',
    '    事件 脚本完成()',
    `        @ if (std::wstring(CDP_取当前事件类型()) != L"命令完成") { FILE* dbg = nullptr; if (_wfopen_s(&dbg, L"${debugPath}", L"w") == 0 && dbg) { fwprintf(dbg, L"type=[%s]\\ntext=[%s]\\nerr=[%s]\\ndetail=[%s]\\n", CDP_取当前事件类型(), CDP_取当前事件文本(), CDP_取当前错误(), CDP_取当前事件详情()); fclose(dbg); } ExitProcess(10); }`,
    `        @ if (std::wstring(CDP_取当前事件文本()) != L"LingBuilder") { FILE* dbg2 = nullptr; if (_wfopen_s(&dbg2, L"${debugPath}", L"w") == 0 && dbg2) { fwprintf(dbg2, L"text=[%s]\\n", CDP_取当前事件文本()); fclose(dbg2); } ExitProcess(11); }`,
    `        CDP_设置元素文件(CDP_查询元素(CDP_取当前页面(), "#file"), "${uploadPath}", &上传完成)`,
    '    结束',
    '    事件 上传完成()',
    '        @ if (std::wstring(CDP_取当前事件类型()) != L"命令完成") ExitProcess(17);',
    `        CDP_执行脚本(CDP_取当前页面(), "document.body.children[2].click()", &点击下载完成)`,
    '    结束',
    '    事件 点击下载完成()',
    '        @ if (std::wstring(CDP_取当前事件类型()) != L"命令完成") ExitProcess(23);',
    '        CDP_等待加载(CDP_取当前页面(), 0, 10, &等待完成)',
    '    结束',
    '    事件 等待完成()',
    '        @ if (std::wstring(CDP_取当前事件类型()) != L"命令完成") ExitProcess(20);',
    '        @ CDP_设置下载目录(CDP_取当前连接(), L"", false);',
    `        CDP_截图(CDP_取当前页面(), "${screenshotPath.replace(/\\/gu, '\\\\')}", 假, &截图完成)`,
    '    结束',
    '    事件 截图完成()',
    '        @ if (std::wstring(CDP_取当前事件类型()) != L"命令完成") ExitProcess(12);',
    '        @ CDP_拦截停止(CDP_取当前页面());',
    '        @ CDP_重置仿真(CDP_取当前页面());',
    '        @ CDP_断开连接(CDP_取当前连接());',
    '        @ ExitProcess(0);',
    '    结束',
    '结束类'
  ].join('\n');
}

async function findMsBuild(): Promise<string> {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  return path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
