import fs from 'node:fs/promises';
import http from 'node:http';
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
const win32ProjectDir = path.join(repoRoot, '.lingbuilder-build', 'http-client-native-smoke');
const newEmojiProjectDir = path.join(repoRoot, '.lingbuilder-build', 'http-client-new-emoji-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main(): Promise<void> {
  const msbuild = await findMsBuild();
  const port = await reserveAvailablePort();
  const server = http.createServer((request, response) => {
    if (request.url === '/whoami' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(String(request.headers.cookie ?? ''));
      return;
    }
    if (request.url === '/echo' && request.method === 'POST') {
      const chunks: Buffer[] = [];
      request.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))));
      request.on('end', () => {
        const body = Buffer.concat(chunks);
        response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': body.length });
        response.end(body);
      });
      return;
    }
    if (request.url !== '/hello' || request.method !== 'GET') {
      response.writeHead(404);
      response.end('not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength('LingBuilder HTTP smoke') });
    response.end('LingBuilder HTTP smoke');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  try {
    const win32 = await buildAndRun({
      backend: 'win32',
      projectDir: win32ProjectDir,
      projectId: 'http-client-native-smoke',
      enabledModules: [builtin('lingbuilder.net.http-client'), builtin('lingbuilder.std.array')],
      platforms: ['Win32', 'x64'],
      port,
      msbuild
    });
    const newEmojiManifestPath = path.join(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui', 'lingbuilder.module.json');
    const newEmojiManifest = JSON.parse(await fs.readFile(newEmojiManifestPath, 'utf8')) as InstalledModule['manifest'];
    const newEmoji = await buildAndRun({
      backend: 'new-emoji',
      projectDir: newEmojiProjectDir,
      projectId: 'http-client-new-emoji-native-smoke',
      enabledModules: [
        { manifest: newEmojiManifest, installPath: path.dirname(newEmojiManifestPath), isInstalled: true, isEnabledForProject: true, diagnostics: [] },
        builtin('lingbuilder.net.http-client'),
        builtin('lingbuilder.std.array')
      ],
      platforms: ['x64'],
      port,
      msbuild
    });
    console.log(JSON.stringify({ ok: true, win32, newEmoji, checks: ['WinHTTP GET/POST', 'status 200', 'UTF-8 response', 'protocol metadata', 'upload byte accounting', 'request/client cleanup'] }, null, 2));
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

async function buildAndRun(options: {
  backend: 'win32' | 'new-emoji';
  projectDir: string;
  projectId: string;
  enabledModules: InstalledModule[];
  platforms: Array<'Win32' | 'x64'>;
  port: number;
  msbuild: string;
}): Promise<{ projectDir: string; executable: string; compiledPlatforms: string[] }> {
  await fs.rm(options.projectDir, { recursive: true, force: true });
  await fs.mkdir(options.projectDir, { recursive: true });
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: options.projectId,
    name: options.backend === 'new-emoji' ? 'New_Emoji HTTP 客户端原生冒烟测试' : 'HTTP 客户端原生冒烟测试',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'HTTP 客户端原生冒烟测试',
      designerBackend: options.backend === 'new-emoji' ? 'new-emoji' : undefined,
      width: 460,
      height: 220,
      background: '#202028',
      description: '验证共享 WinHTTP 客户端 runtime',
      controls: []
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: createSource(options.port),
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules: options.enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const required of ['class LingHttpClientRuntime', 'WinHttpSendRequest(', 'HTTP客户端_执行同步']) {
    if (!mainCpp.includes(required)) throw new Error(`生成的 HTTP 客户端 C++ 缺少：${required}`);
  }
  for (const file of generated.files) {
    const target = path.resolve(options.projectDir, file.relativePath);
    if (!target.startsWith(`${options.projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  await fs.mkdir(path.join(options.projectDir, 'resources'), { recursive: true });
  await fs.copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'), path.join(options.projectDir, 'resources', 'lingbuilder-app.ico'));
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
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`HTTP 客户端原生 smoke ${options.backend} 超时。`)); }, 30000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); resolve(code ?? -1); });
  });
  if (exitCode !== 0) throw new Error(`HTTP 客户端原生 smoke ${options.backend} 退出码异常：${exitCode}`);
  return { projectDir: options.projectDir, executable, compiledPlatforms: options.platforms };
}

function createSource(port: number): string {
  return [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        @ long long client = HTTP客户端_创建客户端();',
    `        @ long long request = HTTP客户端_创建请求(client, L"GET", L"http://127.0.0.1:${port}/hello");`,
    '        @ bool ok = request != 0 && HTTP客户端_执行同步(request) && HTTP客户端_取响应状态码(request) == 200;',
    '        @ ok = ok && std::wstring(HTTP客户端_取响应文本编码(request, L"UTF-8")) == L"LingBuilder HTTP smoke";',
    '        @ ok = ok && !std::wstring(HTTP客户端_取响应协议(request)).empty();',
    `        @ long long upload = HTTP客户端_创建请求(client, L"POST", L"http://127.0.0.1:${port}/echo");`,
    '        @ ok = ok && upload != 0 && HTTP客户端_设置文本正文(upload, L"LingBuilder upload", L"text/plain; charset=utf-8") && HTTP客户端_执行同步(upload) && HTTP客户端_取响应状态码(upload) == 200;',
    '        @ ok = ok && HTTP客户端_取上传字节数(upload) == 18 && std::wstring(HTTP客户端_取响应文本编码(upload, L"UTF-8")) == L"LingBuilder upload";',
    '        @ HTTP客户端_销毁请求(upload);',
    `        @ long long ck = HTTP客户端_创建请求(client, L"GET", L"http://127.0.0.1:${port}/whoami");`,
    '        @ ok = ok && ck != 0 && HTTP客户端_请求置Cookie(ck, L"PASS_ID=smoke-1") && HTTP客户端_执行同步(ck);',
    '        @ ok = ok && std::wstring(HTTP客户端_取响应文本编码(ck, L"UTF-8")) == L"PASS_ID=smoke-1";',
    '        @ HTTP客户端_销毁请求(ck);',
    '        @ ok = ok && HTTP客户端_置Cookie(client, L"a", L"1", L"", L"/") && HTTP客户端_置Cookie(client, L"b", L"2", L"other.test", L"/");',
    `        @ long long jar = HTTP客户端_创建请求(client, L"GET", L"http://127.0.0.1:${port}/whoami");`,
    '        @ ok = ok && jar != 0 && HTTP客户端_执行同步(jar) && std::wstring(HTTP客户端_取响应文本编码(jar, L"UTF-8")) == L"a=1";',
    '        @ ok = ok && std::wstring(HTTP客户端_取CookieJSON(client)).find(L"\\"name\\":\\"a\\"") != std::wstring::npos;',
    '        @ ok = ok && HTTP客户端_删除全部Cookie(client) && std::wstring(HTTP客户端_取CookieJSON(client)) == L"[]";',
    '        @ HTTP客户端_销毁请求(jar);',
    // D-1/D-2 编译探针：调用形态实参与指针文本拼接必须经 LingCppWideArg 归一后生成可编译 C++（运行结果不参与 ok 判定）。
    '        局部 文本型 名单[]',
    '        局部 文本型 拼接演示',
    '        数组_加入成员(名单, "甲")',
    '        拼接演示 = 数组_取成员(名单, 0) + HTTP客户端_取内容类型(request)',
    '        HTTP客户端_设置文本正文(request, HTTP客户端_取请求地址(request), "text/plain; charset=utf-8")',
    '        @ HTTP客户端_销毁请求(request); HTTP客户端_销毁客户端(client);',
    '        @ ExitProcess(ok ? 0 : 2);',
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

async function reserveAvailablePort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve()); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法分配 HTTP 客户端 smoke 端口。');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
