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
import { createDesignerAssetService } from '../src/services/windowDesigner/designerAssetService';
import { createWindowsExecutableIconService } from '../src/services/windowDesigner/windowsExecutableIconService';
import type { LingBuilderSolutionProject } from '../src/services/solution/solutionService';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const win32ProjectDir = path.resolve(repoRoot, '.lingbuilder-build', 'http-server-native-smoke');
const newEmojiProjectDir = path.resolve(repoRoot, '.lingbuilder-build', 'http-server-new-emoji-native-smoke');

interface HttpResponse {
  status: number;
  headers: Map<string, string[]>;
  body: Buffer;
}

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

class RawHttpConnection {
  private socket?: net.Socket;
  private buffered = Buffer.alloc(0);

  constructor(private readonly port: number) {}

  async connect(): Promise<void> {
    const socket = net.createConnection({ host: '127.0.0.1', port: this.port });
    this.socket = socket;
    socket.on('data', chunk => { this.buffered = Buffer.concat([this.buffered, chunk]); });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
  }

  async request(chunks: Array<string | Buffer>): Promise<HttpResponse> {
    const socket = this.socket;
    if (!socket) throw new Error('HTTP 测试连接尚未建立。');
    chunks.forEach(chunk => socket.write(chunk));
    return await this.readResponse();
  }

  destroy(): void {
    this.socket?.destroy();
    this.socket = undefined;
  }

  private async readResponse(timeoutMs = 5000): Promise<HttpResponse> {
    const deadline = Date.now() + timeoutMs;
    let headerEnd = this.buffered.indexOf('\r\n\r\n');
    while (headerEnd < 0) {
      await this.waitForData(deadline);
      headerEnd = this.buffered.indexOf('\r\n\r\n');
    }
    const headerText = this.buffered.subarray(0, headerEnd).toString('latin1');
    this.buffered = this.buffered.subarray(headerEnd + 4);
    const lines = headerText.split('\r\n');
    const status = Number(lines.shift()?.match(/^HTTP\/1\.[01]\s+(\d{3})\b/u)?.[1] || 0);
    if (!status) throw new Error(`HTTP 响应状态行无效：${headerText}`);
    const headers = new Map<string, string[]>();
    lines.forEach(line => {
      const colon = line.indexOf(':');
      if (colon <= 0) throw new Error(`HTTP 响应头无效：${line}`);
      const key = line.slice(0, colon).trim().toLowerCase();
      headers.set(key, [...(headers.get(key) || []), line.slice(colon + 1).trim()]);
    });
    const length = Number(headers.get('content-length')?.[0] || 0);
    while (this.buffered.length < length) await this.waitForData(deadline);
    const body = Buffer.from(this.buffered.subarray(0, length));
    this.buffered = this.buffered.subarray(length);
    return { status, headers, body };
  }

  private async waitForData(deadline: number): Promise<void> {
    const socket = this.socket;
    if (!socket) throw new Error('HTTP 测试连接已关闭。');
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('等待 HTTP 响应超时。');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error('等待 HTTP 响应超时。')), remaining);
      const onData = () => finish();
      const onClose = () => finish(new Error('HTTP 响应完成前连接关闭。'));
      const onError = (error: Error) => finish(error);
      const finish = (error?: Error) => {
        clearTimeout(timeout);
        socket.off('data', onData);
        socket.off('close', onClose);
        socket.off('error', onError);
        if (error) reject(error); else resolve();
      };
      socket.once('data', onData);
      socket.once('close', onClose);
      socket.once('error', onError);
    });
  }
}

async function main(): Promise<void> {
  assertBuildDirectory(win32ProjectDir);
  assertBuildDirectory(newEmojiProjectDir);
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');

  const win32 = await buildAndSmoke({ projectDir: win32ProjectDir, projectId: 'http-server-native-smoke', backend: 'win32', platforms: ['Win32', 'x64'], msbuild });
  const newEmoji = await buildAndSmoke({ projectDir: newEmojiProjectDir, projectId: 'http-server-new-emoji-native-smoke', backend: 'new-emoji', platforms: ['x64'], msbuild });

  console.log(JSON.stringify({
    ok: true,
    win32,
    newEmoji,
    checks: ['keep-alive', 'query-form-decoding', 'path-plus', 'request-header', 'static-route', 'static-prefix', 'static-head', 'static-file', 'static-missing-404', 'connection-rotation', 'post-content-length', 'post-chunked', 'utf8-json', 'cookie', 'binary', 'file', 'redirect', 'empty-204', '404', '413', 'host-validation', 'request-target-validation', 'percent-validation', 'utf8-percent-validation', 'expectation-validation', 'shutdown']
  }, null, 2));
}

async function buildAndSmoke(options: {
  projectDir: string;
  projectId: string;
  backend: 'win32' | 'new-emoji';
  platforms: Array<'Win32' | 'x64'>;
  msbuild: string;
}) {
  const port = await reserveAvailablePort();
  await fs.rm(options.projectDir, { recursive: true, force: true });
  await fs.mkdir(options.projectDir, { recursive: true });
  const fixturePath = path.join(options.projectDir, 'http-fixture.txt');
  await fs.writeFile(fixturePath, 'LingBuilder HTTP 文件响应\n', 'utf8');

  const enabledModules = await getEnabledModules(options.backend);
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: options.projectId,
    name: options.backend === 'new-emoji' ? 'New_Emoji HTTP 服务端原生冒烟测试' : 'HTTP 服务端原生冒烟测试',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: options.backend === 'new-emoji' ? 'New_Emoji HTTP 原生冒烟测试' : 'HTTP 原生冒烟测试',
      designerBackend: options.backend === 'new-emoji' ? 'new-emoji' : undefined,
      width: 460,
      height: 220,
      background: '#202028',
      description: '验证受管 HTTP/1.1 服务端协议行为',
      controls: []
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: createHttpSource(port, fixturePath.replaceAll('\\', '/')),
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const required of ['class LingHttpServerRuntime', 'HTTP_创建服务', options.backend === 'new-emoji' ? 'g_httpServerRuntime' : 'WM_LINGBUILDER_HTTP_SERVER_REQUEST']) {
    if (!mainCpp.includes(required)) throw new Error(`生成的 HTTP C++ 缺少：${required}`);
  }

  for (const file of generated.files) {
    const target = path.resolve(options.projectDir, file.relativePath);
    if (!target.startsWith(`${options.projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, options.projectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const solutionProject: LingBuilderSolutionProject = {
    id: project.id, name: project.name, type: 'visual-cpp', sourceRoot: 'src', configRoot: 'config',
    designerPath: `.lingbuilder/projects/${project.id}/window-designer.json`, isDefault: true
  };
  // standalone 生成项目必须先物化 exe 图标（与 F5 同一服务），否则 rc.exe 报 RC2135。
  await createWindowsExecutableIconService(options.projectDir, createDesignerAssetService(options.projectDir))
    .materialize(solutionProject, generated.selectedWindow, [options.projectDir]);
  const exported = await exportVisualStudioProject({ projectDir: options.projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
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
  try {
    await waitForPort(port, 10000);
    await runHttpProtocolChecks(port);
    await requestShutdown(port);
    await waitForPortClosed(port, 10000);
  } finally {
    await stopChild(child);
  }
  return { projectDir: options.projectDir, executable, port, compiledPlatforms: options.platforms };
}

async function getEnabledModules(backend: 'win32' | 'new-emoji'): Promise<InstalledModule[]> {
  const modules = [builtin('lingbuilder.http.server')];
  if (backend === 'win32') return modules;
  const installPath = path.join(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  const manifest = JSON.parse(await fs.readFile(path.join(installPath, 'lingbuilder.module.json'), 'utf8')) as InstalledModule['manifest'];
  return [{ manifest, installPath, isInstalled: true, isEnabledForProject: true, diagnostics: [] }, ...modules];
}

function createHttpSource(port: number, fixturePath: string): string {
  return [
    '类 MainWindow',
    '    HTTP服务端 服务',
    '    事件 _MainWindow_创建完毕()',
    '        服务 = HTTP_创建服务()',
    `        HTTP_配置服务(服务, "127.0.0.1", ${port}, 4, 64)`,
    '        HTTP_设置请求限制(服务, 64, 1, 5000)',
    '        HTTP_添加路由(服务, "GET", "/health", &健康检查)',
    `        HTTP_添加静态路由(服务, "GET", "/static/data", "{\\"ok\\":true,\\"source\\":\\"static\\"}", "application/json; charset=utf-8")`,
    '        HTTP_添加静态路由(服务, "GET", "/static/prefix/*", "prefix-hit", "text/plain; charset=utf-8")',
    `        HTTP_添加静态文件路由(服务, "GET", "/static/file", "${fixturePath.replaceAll('\\', '/')}", "静态文件.txt", "text/plain; charset=utf-8")`,
    `        HTTP_添加静态文件路由(服务, "GET", "/static/missing", "${fixturePath.replaceAll('\\', '/')}.gone", "", "text/plain; charset=utf-8")`,
    '        HTTP_设置连接轮转(服务, 100)',
    '        HTTP_添加路由(服务, "GET", "/query", &查询参数)',
    '        HTTP_添加路由(服务, "GET", "/header", &读取请求头)',
    '        HTTP_添加路由(服务, "GET", "/path+plus", &读取路径)',
    '        HTTP_添加路由(服务, "POST", "/echo", &回显正文)',
    '        HTTP_添加路由(服务, "GET", "/cookie", &设置Cookie)',
    '        HTTP_添加路由(服务, "GET", "/binary", &发送二进制)',
    '        HTTP_添加路由(服务, "GET", "/file", &发送文件)',
    '        HTTP_添加路由(服务, "GET", "/redirect", &发送重定向)',
    '        HTTP_添加路由(服务, "GET", "/empty", &发送空响应)',
    '        HTTP_添加路由(服务, "GET", "/stop", &停止服务)',
    '        HTTP_绑定请求处理器(服务, &未找到路由)',
    '        HTTP_启动(服务)',
    '    结束',
    '    事件 健康检查()',
    '        HTTP_发送JSON(HTTP_取当前请求(), "{\\"ok\\":true,\\"message\\":\\"正常\\"}", 200)',
    '    结束',
    '    事件 查询参数()',
    '        HTTP请求 请求 = HTTP_取当前请求()',
    '        HTTP_发送文本(请求, HTTP_取查询参数(请求, "name"), "text/plain; charset=utf-8", 200)',
    '    结束',
    '    事件 读取请求头()',
    '        HTTP请求 请求 = HTTP_取当前请求()',
    '        HTTP_发送文本(请求, HTTP_取请求头(请求, "X-Ling-Test"), "text/plain; charset=utf-8", 200)',
    '    结束',
    '    事件 读取路径()',
    '        HTTP请求 请求 = HTTP_取当前请求()',
    '        HTTP_发送文本(请求, HTTP_取请求路径(请求), "text/plain; charset=utf-8", 200)',
    '    结束',
    '    事件 回显正文()',
    '        HTTP请求 请求 = HTTP_取当前请求()',
    '        HTTP_发送文本(请求, HTTP_取请求正文(请求), "text/plain; charset=utf-8", 200)',
    '    结束',
    '    事件 设置Cookie()',
    '        HTTP请求 请求 = HTTP_取当前请求()',
    '        HTTP_设置Cookie(请求, "session", "lingbuilder", "/", 60, 真, 假, "Lax")',
    '        HTTP_发送文本(请求, "cookie", "text/plain; charset=utf-8", 200)',
    '    结束',
    '    事件 发送二进制()',
    '        HTTP_发送十六进制(HTTP_取当前请求(), "000102feff", "application/octet-stream", 200)',
    '    结束',
    '    事件 发送文件()',
    `        HTTP_发送文件(HTTP_取当前请求(), "${fixturePath}", "下载.txt", "text/plain; charset=utf-8", 200)`,
    '    结束',
    '    事件 发送重定向()',
    '        HTTP_重定向(HTTP_取当前请求(), "/health", 307)',
    '    结束',
    '    事件 发送空响应()',
    '        HTTP_发送空响应(HTTP_取当前请求(), 204)',
    '    结束',
    '    事件 未找到路由()',
    '        HTTP_发送JSON(HTTP_取当前请求(), "{\\"error\\":\\"not_found\\"}", 404)',
    '    结束',
    '    事件 停止服务()',
    '        HTTP_停止(服务)',
    '    结束',
    '结束类'
  ].join('\n');
}

async function runHttpProtocolChecks(port: number): Promise<void> {
  const keepAlive = new RawHttpConnection(port);
  await keepAlive.connect();
  try {
    assertResponse(await keepAlive.request([requestHead('GET', '/health', port, { Connection: 'keep-alive' })]), 200, '{"ok":true,"message":"正常"}');
    assertResponse(await keepAlive.request([requestHead('GET', '/query?name=Ling+Builder', port, { Connection: 'keep-alive' })]), 200, 'Ling Builder');
    assertResponse(await keepAlive.request([requestHead('GET', '/path+plus', port, { Connection: 'keep-alive' })]), 200, '/path+plus');
    assertResponse(await keepAlive.request([requestHead('GET', '/header', port, { 'X-Ling-Test': 'header-ok', Connection: 'close' })]), 200, 'header-ok');
  } finally {
    keepAlive.destroy();
  }

  const staticBody = '{"ok":true,"source":"static"}';
  const staticConn = new RawHttpConnection(port);
  await staticConn.connect();
  try {
    const staticResponse = await staticConn.request([requestHead('GET', '/static/data', port, { Connection: 'keep-alive' })]);
    assertResponse(staticResponse, 200, staticBody);
    if (staticResponse.headers.get('content-type')?.[0] !== 'application/json; charset=utf-8') throw new Error('静态路由响应 Content-Type 不正确。');
    assertResponse(await staticConn.request([requestHead('GET', '/static/prefix/deep/path', port, { Connection: 'close' })]), 200, 'prefix-hit');
  } finally {
    staticConn.destroy();
  }

  const head = await headOneShot(port, '/static/data');
  if (head.status !== 200 || head.headers.get('content-length')?.[0] !== String(Buffer.byteLength(staticBody))) throw new Error('HEAD 静态路由应返回 200 与真实 Content-Length。');

  const headDynamic = await headOneShot(port, '/health');
  if (headDynamic.status !== 200) throw new Error('HEAD 应回落匹配 GET 动态路由并返回 200。');

  const staticFile = await oneShot(port, 'GET', '/static/file');
  assertResponse(staticFile, 200, 'LingBuilder HTTP 文件响应\n');
  if (!staticFile.headers.get('content-disposition')?.[0]?.includes("filename*=UTF-8''")) throw new Error('静态文件路由缺少 RFC 5987 下载名称。');

  const staticMissing = await oneShot(port, 'GET', '/static/missing');
  if (staticMissing.status !== 404 || staticMissing.body.toString('utf8') !== 'File Not Found') throw new Error('静态文件路由在文件缺失时应返回 404 File Not Found。');

  const rotation = new RawHttpConnection(port);
  await rotation.connect();
  try {
    for (let index = 1; index <= 100; index += 1) {
      const response = await rotation.request([requestHead('GET', '/static/data', port, { Connection: 'keep-alive' })]);
      assertResponse(response, 200, staticBody);
      const closing = response.headers.get('connection')?.[0] === 'close';
      if (index < 100 && closing) throw new Error(`连接轮转口径错误：第 ${index} 个请求就返回了 Connection: close。`);
      if (index === 100 && !closing) throw new Error('连接轮转口径错误：第 100 个请求应返回 Connection: close。');
    }
  } finally {
    rotation.destroy();
  }

  const contentLengthBody = Buffer.from('正文 Content-Length', 'utf8');
  const contentLength = new RawHttpConnection(port);
  await contentLength.connect();
  try {
    assertResponse(await contentLength.request([
      requestHead('POST', '/echo', port, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': String(contentLengthBody.length), Connection: 'close' }),
      contentLengthBody
    ]), 200, '正文 Content-Length');
  } finally {
    contentLength.destroy();
  }

  const chunkedBody = Buffer.from('分块中文正文', 'utf8');
  const chunked = new RawHttpConnection(port);
  await chunked.connect();
  try {
    assertResponse(await chunked.request([
      requestHead('POST', '/echo', port, { 'Transfer-Encoding': 'chunked', Connection: 'close' }),
      `${chunkedBody.length.toString(16)}\r\n`, chunkedBody, '\r\n0\r\n\r\n'
    ]), 200, '分块中文正文');
  } finally {
    chunked.destroy();
  }

  const cookie = await oneShot(port, 'GET', '/cookie');
  assertResponse(cookie, 200, 'cookie');
  if (!cookie.headers.get('set-cookie')?.some(value => value.includes('session=lingbuilder; Path=/; Max-Age=60; HttpOnly; SameSite=Lax'))) throw new Error('Cookie 响应属性不完整。');

  const binary = await oneShot(port, 'GET', '/binary');
  if (binary.status !== 200 || !binary.body.equals(Buffer.from([0, 1, 2, 254, 255]))) throw new Error('二进制响应不正确。');

  const file = await oneShot(port, 'GET', '/file');
  assertResponse(file, 200, 'LingBuilder HTTP 文件响应\n');
  if (!file.headers.get('content-disposition')?.[0]?.includes("filename*=UTF-8''")) throw new Error('文件响应缺少 RFC 5987 下载名称。');

  const redirect = await oneShot(port, 'GET', '/redirect');
  if (redirect.status !== 307 || redirect.headers.get('location')?.[0] !== '/health') throw new Error('HTTP 重定向响应不正确。');
  const empty = await oneShot(port, 'GET', '/empty');
  if (empty.status !== 204 || empty.body.length !== 0) throw new Error('HTTP 204 空响应不正确。');
  assertResponse(await oneShot(port, 'GET', '/missing'), 404, '{"error":"not_found"}');

  const oversized = new RawHttpConnection(port);
  await oversized.connect();
  try {
    const response = await oversized.request([requestHead('POST', '/echo', port, { 'Content-Length': String(1024 * 1024 + 1), Connection: 'close' })]);
    if (response.status !== 413) throw new Error(`超限正文应返回 413，实际为 ${response.status}。`);
  } finally {
    oversized.destroy();
  }

  if ((await rawOneShot(port, 'GET /health HTTP/1.1\r\nConnection: close\r\n\r\n')).status !== 400) throw new Error('HTTP/1.1 缺少 Host 没有返回 400。');
  if ((await rawOneShot(port, `GET /health HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nHost: duplicate\r\nConnection: close\r\n\r\n`)).status !== 400) throw new Error('重复 Host 没有返回 400。');
  if ((await rawOneShot(port, `GET http://127.0.0.1:${port}/health HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`)).status !== 400) throw new Error('绝对形式 request-target 没有返回 400。');
  if ((await rawOneShot(port, `GET /invalid%2 HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`)).status !== 400) throw new Error('错误百分号编码没有返回 400。');
  if ((await rawOneShot(port, `GET /invalid%FF HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`)).status !== 400) throw new Error('非法 UTF-8 百分号编码没有返回 400。');
  if ((await rawOneShot(port, `POST /echo HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nExpect: custom\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`)).status !== 417) throw new Error('不支持的 Expect 没有返回 417。');
}

function requestHead(method: string, target: string, port: number, headers: Record<string, string> = {}): string {
  return [
    `${method} ${target} HTTP/1.1`,
    `Host: 127.0.0.1:${port}`,
    ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`),
    '',
    ''
  ].join('\r\n');
}

async function oneShot(port: number, method: string, target: string): Promise<HttpResponse> {
  const connection = new RawHttpConnection(port);
  await connection.connect();
  try {
    return await connection.request([requestHead(method, target, port, { Connection: 'close' })]);
  } finally {
    connection.destroy();
  }
}

async function headOneShot(port: number, target: string): Promise<{ status: number; headers: Map<string, string[]> }> {
  const socket = net.connect({ host: '127.0.0.1', port });
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    socket.on('data', chunk => chunks.push(chunk));
    socket.once('close', resolve);
    socket.once('error', reject);
    socket.write(requestHead('HEAD', target, port, { Connection: 'close' }));
  });
  const headerText = Buffer.concat(chunks).toString('latin1').split('\r\n\r\n')[0] ?? '';
  const lines = headerText.split('\r\n');
  const status = Number(lines.shift()?.match(/^HTTP\/1\.[01]\s+(\d{3})\b/u)?.[1] || 0);
  const headers = new Map<string, string[]>();
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon > 0) headers.set(line.slice(0, colon).trim().toLowerCase(), [line.slice(colon + 1).trim()]);
  }
  return { status, headers };
}

async function rawOneShot(port: number, request: string): Promise<HttpResponse> {
  const connection = new RawHttpConnection(port);
  await connection.connect();
  try {
    return await connection.request([request]);
  } finally {
    connection.destroy();
  }
}

function assertResponse(response: HttpResponse, status: number, body: string): void {
  const actual = response.body.toString('utf8');
  if (response.status !== status || actual !== body) throw new Error(`HTTP 响应不匹配：期望 ${status} ${JSON.stringify(body)}，实际 ${response.status} ${JSON.stringify(actual)}。`);
}

async function requestShutdown(port: number): Promise<void> {
  const connection = new RawHttpConnection(port);
  await connection.connect();
  try {
    await connection.request([requestHead('GET', '/stop', port, { Connection: 'close' })]).catch(() => undefined);
  } finally {
    connection.destroy();
  }
}

async function reserveAvailablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法分配 HTTP 原生冒烟测试端口。');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canConnect(port)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`等待 HTTP 服务端监听端口 ${port} 超时。`);
}

async function waitForPortClosed(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!await canConnect(port)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`HTTP 服务端停止后端口 ${port} 仍可连接。`);
}

async function canConnect(port: number): Promise<boolean> {
  return await new Promise<boolean>(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

async function stopChild(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill();
  if (child.exitCode !== null) return;
  await new Promise<void>(resolve => {
    const timeout = setTimeout(resolve, 3000);
    child.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
}

function assertBuildDirectory(directory: string): void {
  if (!directory.startsWith(`${repoRoot}${path.sep}`)) throw new Error(`HTTP 原生冒烟测试目录越出工作区：${directory}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
