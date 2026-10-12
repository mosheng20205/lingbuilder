/**
 * lingbuilder.http.server 工作线程数去上限（1～64 → ≥1 不设固定上限）真机验收：
 * 生成窗口工程 → MSBuild Win32+x64 Release → 运行 exe（以 256 工作线程起服务、写端口文件、驻留消息循环）
 * → 脚本读端口文件后真实 HTTP 请求静态路由 → 断言响应 → 结束 exe。
 * 覆盖：HTTP_配置服务 接受 256 工作线程（旧 64 上限会拒绝）、HTTP_启动 成功、临时端口读回、静态路由 200。
 * 运行：cd electron && npm run smoke:http-server-workers
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'http-server-workers-native-smoke');
const PORT_FILE = 'http-server-smoke-port.txt';
const WORKER_COUNT = 256;
const ROUTE_BODY = 'http-server-workers-ok';

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('http server workers 冒烟目录越出工作区。');
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.http.server')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'http-server-workers-native-smoke',
    name: 'HTTP服务端工作线程数去上限原生冒烟测试',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'HTTP服务端工作线程数去上限原生冒烟测试', width: 420, height: 240, background: '#202028', description: '256 工作线程起服务+静态路由真机回环', controls: [] }]
  };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        局部 HTTP服务端 服务器',
    '        服务器 = HTTP_创建服务()',
    '        局部 逻辑型 配置成功',
    `        配置成功 = HTTP_配置服务(服务器, "127.0.0.1", 0, ${WORKER_COUNT}, 1024)`,
    `        HTTP_添加静态路由(服务器, "GET", "/ping", "${ROUTE_BODY}", "text/plain")`,
    '        局部 逻辑型 启动成功',
    '        启动成功 = HTTP_启动(服务器)',
    '        局部 整数型 端口',
    '        端口 = HTTP_取监听端口(服务器)',
    `        @ std::remove("${PORT_FILE}");`,
    `        @ { std::ofstream out("${PORT_FILE}", std::ios::binary | std::ios::trunc); out << (配置成功 ? 1 : 0) << ' ' << (启动成功 ? 1 : 0) << ' ' << 端口 << std::flush; }`,
    '    结束',
    '结束类'
  ].join('\n');

  const generated = generateLingCppNativeWin32Project(project, { enabledModules, lingCppSourceCode: source });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
  await fs.copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'), path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  for (const platform of ['Win32', 'x64'] as const) {
    try {
      await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    } catch (error) {
      const output = [error.stdout, error.stderr].filter(Boolean).join('\n');
      const failure = output.split('\n').filter(line => /error|错误/i.test(line)).slice(0, 30).join('\n');
      throw new Error(`${platform} MSBuild 失败：\n${failure || output.slice(-4000) || error.message}`);
    }
    const binDir = path.join(projectDir, platform, 'Release', 'bin');
    const executable = path.join(binDir, `${exported.projectName}.exe`);
    const child = spawn(executable, [], { cwd: binDir, windowsHide: true, stdio: 'ignore', detached: false });
    try {
      const portPath = path.join(binDir, PORT_FILE);
      let statusLine = '';
      for (let attempt = 0; attempt < 60; ++attempt) {
        await new Promise(resolve => setTimeout(resolve, 500));
        statusLine = await fs.readFile(portPath, 'utf8').catch(() => '');
        if (statusLine.trim()) break;
      }
      if (!statusLine.trim()) throw new Error(`${platform} 30 秒内未写出端口文件，服务未能启动。`);
      const [configFlag, startFlag, portText] = statusLine.trim().split(' ');
      if (configFlag !== '1') throw new Error(`${platform} HTTP_配置服务(…, ${WORKER_COUNT}, …) 应成功（旧 64 上限会拒绝）：${statusLine}`);
      if (startFlag !== '1') throw new Error(`${platform} HTTP_启动 应成功：${statusLine}`);
      const port = Number(portText);
      if (!(port > 0 && port < 65536)) throw new Error(`${platform} 监听端口读回异常：${statusLine}`);
      const response = await fetch(`http://127.0.0.1:${port}/ping`);
      const body = await response.text();
      if (response.status !== 200 || body !== ROUTE_BODY) throw new Error(`${platform} 静态路由响应异常：status=${response.status} body=${JSON.stringify(body.slice(0, 120))}`);
      console.log(`[${platform}] http-server workers 原生冒烟 PASS（port=${port}）`);
    } finally {
      try { await execFileAsync('taskkill', ['/pid', String(child.pid), '/F', '/T'], { windowsHide: true }); } catch { /* 进程可能已退出 */ }
    }
  }
  console.log(JSON.stringify({ ok: true, projectDir, platforms: ['Win32', 'x64'] }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
