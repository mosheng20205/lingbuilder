import fs from 'node:fs/promises';
import net from 'node:net';
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
const win32ProjectDir = path.join(repoRoot, '.lingbuilder-build', 'websocket-client-native-smoke');
const newEmojiProjectDir = path.join(repoRoot, '.lingbuilder-build', 'websocket-client-new-emoji-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main() {
  const msbuild = await findMsBuild();
  const win32 = await buildAndRunWin32(msbuild);
  const newEmoji = await buildAndRunNewEmoji(msbuild);
  console.log(JSON.stringify({
    ok: true,
    win32,
    newEmoji,
    checks: ['managed-client', 'background-events', 'origin', 'subprotocol', 'text', 'binary', 'close', 'automatic-reconnect', 'statistics', 'Win32/x64']
  }, null, 2));
}

async function buildAndRunWin32(msbuild: string) {
  const port = await reserveAvailablePort();
  const enabledModules = [builtin('lingbuilder.websocket.client'), builtin('lingbuilder.websocket.server')];
  const project = createProject('websocket-client-native-smoke', 'WebSocket 客户端原生烟雾测试', 'win32');
  const exported = await generateAndExport(projectDirGuard(win32ProjectDir), project, enabledModules, port);
  for (const platform of ['Win32', 'x64']) await build(msbuild, exported.solutionPath, win32ProjectDir, platform);
  const executable = path.join(win32ProjectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await runUntilSuccessfulExit(executable, 20000);
  return { projectDir: win32ProjectDir, executable, compiledPlatforms: ['Win32', 'x64'], port };
}

async function buildAndRunNewEmoji(msbuild: string) {
  const port = await reserveAvailablePort();
  const installPath = path.join(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  const manifest = JSON.parse(await fs.readFile(path.join(installPath, 'lingbuilder.module.json'), 'utf8')) as InstalledModule['manifest'];
  const enabledModules: InstalledModule[] = [
    { manifest, installPath, isInstalled: true, isEnabledForProject: true, diagnostics: [] },
    builtin('lingbuilder.websocket.client'),
    builtin('lingbuilder.websocket.server')
  ];
  const project = createProject('websocket-client-new-emoji-native-smoke', 'New_Emoji WebSocket 客户端原生烟雾测试', 'new-emoji');
  const exported = await generateAndExport(projectDirGuard(newEmojiProjectDir), project, enabledModules, port);
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, newEmojiProjectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  await build(msbuild, exported.solutionPath, newEmojiProjectDir, 'x64');
  const executable = path.join(newEmojiProjectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await runUntilSuccessfulExit(executable, 20000);
  return { projectDir: newEmojiProjectDir, executable, compiledPlatforms: ['x64'], port };
}

function createProject(id: string, name: string, designerBackend: 'win32' | 'new-emoji'): LingWindowProject {
  return {
    schemaVersion: 2,
    id,
    name,
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: name,
      designerBackend, width: 460, height: 220, background: '#202028', description: '验证 WebSocket 客户端 2.0', controls: []
    }]
  };
}

async function generateAndExport(projectDir: string, project: LingWindowProject, enabledModules: InstalledModule[], port: number) {
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: createSource(port),
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  return await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
}

function createSource(port: number): string {
  return [
    '类 MainWindow',
    '    整数型 客户端连接次数 = 0',
    '    整数型 客户端消息数 = 0',
    '    事件 _MainWindow_创建完毕()',
    '        局部 WebSocket服务端 服务 = WSS_创建服务()',
    `        WSS_配置服务(服务, "127.0.0.1", ${port}, 16)`,
    '        WSS_设置资源限制(服务, 64, 16, 8, 30000)',
    '        WSS_设置访问路径(服务, "/ws")',
    '        WSS_设置允许来源(服务, "https://example.com")',
    '        WSS_设置子协议(服务, "chat.v2, chat.v1")',
    '        WSS_绑定消息处理器(服务, &服务端收到消息)',
    '        WSS_启动(服务)',
    '        局部 WebSocket连接 连接 = WS_创建连接()',
    `        WS_配置连接(连接, "ws://127.0.0.1:${port}/ws?smoke=1")`,
    '        WS_设置资源限制(连接, 5000, 10000, 16, 8)',
    '        WS_设置请求头(连接, "X-LingBuilder-Smoke: client-2.0")',
    '        WS_设置Origin(连接, "https://example.com")',
    '        WS_设置子协议(连接, "chat.v1, chat.v2")',
    '        WS_设置自动重连(连接, 真, 4, 100, 500)',
    '        WS_绑定已连接处理器(连接, &客户端已连接)',
    '        WS_绑定消息处理器(连接, &客户端收到消息)',
    '        WS_绑定已断开处理器(连接, &客户端已断开)',
    '        WS_绑定错误处理器(连接, &客户端错误)',
    '        WS_绑定重连处理器(连接, &客户端重连)',
    '        WS_开始连接(连接)',
    '    结束',
    '    事件 服务端收到消息()',
    '        如果 (WSS_取当前消息类型() == "文本")',
    '            如果 (WSS_取当前文本() == "第一次连接")',
    '                WSS_关闭客户端(WSS_取当前客户端(), 1012, "触发客户端自动重连")',
    '            否则',
    '                WSS_发送文本给客户端(WSS_取当前客户端(), WSS_取当前文本())',
    '            如果结束',
    '        否则',
    '            WSS_发送二进制给客户端(WSS_取当前客户端(), WSS_取当前二进制())',
    '        如果结束',
    '    结束',
    '    事件 客户端已连接()',
    '        客户端连接次数 = 客户端连接次数 + 1',
    '        如果 (客户端连接次数 == 1)',
    '            WS_发送文本到连接(WS_取当前连接(), "第一次连接")',
    '        否则',
    '            WS_发送文本到连接(WS_取当前连接(), "重连成功")',
    '            局部 字节集 空二进制',
    '            WS_发送二进制到连接(WS_取当前连接(), 空二进制)',
    '        如果结束',
    '    结束',
    '    事件 客户端收到消息()',
    '        客户端消息数 = 客户端消息数 + 1',
    '        如果 (客户端消息数 >= 2)',
    '            如果 (WS_取协商子协议(WS_取当前连接()) == "chat.v2")',
    '                如果 (WS_取握手状态码(WS_取当前连接()) == 101)',
    '                    如果 (WS_取重连次数(WS_取当前连接()) >= 1)',
    '                        如果 (WS_取发送消息数(WS_取当前连接()) >= 3)',
    '                            如果 (WS_取接收消息数(WS_取当前连接()) >= 2)',
    '                                WS_关闭连接(WS_取当前连接(), 1000, "验收完成")',
    '                                结束()',
    '                            如果结束',
    '                        如果结束',
    '                    如果结束',
    '                如果结束',
    '            如果结束',
    '        如果结束',
    '    结束',
    '    事件 客户端已断开()',
    '        调试输出(WS_取当前关闭原因())',
    '    结束',
    '    事件 客户端错误()',
    '        调试输出(WS_取当前错误())',
    '    结束',
    '    事件 客户端重连()',
    '        调试输出(WS_取当前重连次数())',
    '    结束',
    '结束类'
  ].join('\n');
}

async function build(msbuild: string, solutionPath: string, cwd: string, platform: string) {
  await execFileAsync(msbuild, [solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], {
    cwd, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024
  });
}

async function runUntilSuccessfulExit(executable: string, timeoutMs: number) {
  const child = spawn(executable, [], { cwd: path.dirname(executable), windowsHide: true, stdio: 'ignore' });
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`WebSocket 客户端原生进程 ${timeoutMs} 毫秒内未完成协议验收。`));
    }, timeoutMs);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); resolve(code); });
  });
  if (exitCode !== 0) throw new Error(`WebSocket 客户端原生进程退出码异常：${exitCode}`);
}

async function findMsBuild(): Promise<string> {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  return path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
}

function projectDirGuard(value: string): string {
  if (!value.startsWith(`${repoRoot}${path.sep}`)) throw new Error('WebSocket 客户端原生烟雾测试目录越出工作区。');
  return value;
}

async function reserveAvailablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法分配 WebSocket 客户端原生烟雾测试端口。');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
