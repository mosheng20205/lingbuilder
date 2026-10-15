import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { StringDecoder } from 'node:string_decoder';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'http-sse-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

interface SseClient {
  status: number;
  headers: http.IncomingHttpHeaders;
  raw(): string;
  contains(chunk: string): boolean;
  ended(): Promise<boolean>;
}

// 直连 /events 的 SSE 客户端：响应头到达即返回，事件流持续累积，服务端关闭时 ended() 落定。
// exe 冷启动到监听就绪需要时间，连接被拒时按 250ms 间隔重试（最多 timeoutMs）。
async function openSseClient(port: number, timeoutMs = 30000): Promise<SseClient> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      return await new Promise<SseClient>((resolve, reject) => {
        const chunks: Buffer[] = [];
        let endedByServer = false;
        let endedResolve: ((value: boolean) => void) | null = null;
        const request = http.get({ host: '127.0.0.1', port, path: '/events', headers: { Accept: 'text/event-stream' } }, response => {
          const decoder = new StringDecoder('utf8');
          response.on('data', chunk => chunks.push(chunk as Buffer));
          const finish = (byServer: boolean) => {
            chunks.push(Buffer.from(decoder.end()));
            if (!endedByServer) {
              endedByServer = byServer;
              endedResolve?.(byServer);
            }
          };
          response.on('end', () => finish(true));
          response.on('error', () => finish(false));
          response.socket.setTimeout(timeoutMs, () => request.destroy(new Error('SSE 客户端等待超时')));
          resolve({
            status: response.statusCode || 0,
            headers: response.headers,
            raw: () => Buffer.concat(chunks).toString('utf8'),
            contains: (needle: string) => Buffer.concat(chunks).toString('utf8').includes(needle),
            ended: () => new Promise<boolean>(resolveEnded => { endedResolve = resolveEnded; if (endedByServer) resolveEnded(endedByServer); })
          });
        });
        request.on('error', reject);
      });
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw new Error(`SSE 客户端连接失败（已重试至超时）：${lastError instanceof Error ? lastError.message : lastError}`);
}

async function waitForRaw(label: string, client: SseClient, needle: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (!client.contains(needle)) {
    if (Date.now() - startedAt > timeoutMs) throw new Error(`等待超时：${label}\n当前流：${JSON.stringify(client.raw())}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('HTTP SSE 冒烟测试目录越出工作区。');
  // 选用空闲端口并在生成期烘焙进源码（exe 侧不读环境）。
  const probeServer = http.createServer();
  await new Promise<void>(resolve => probeServer.listen(0, '127.0.0.1', resolve));
  const port = (probeServer.address() as { port: number }).port;
  probeServer.close();

  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.http.server')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'http-sse-native-smoke',
    name: 'HTTP服务端SSE单向推送原生冒烟测试',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'HTTP服务端SSE单向推送原生冒烟测试', width: 420, height: 240, background: '#202028', description: '验证 SSE 会话分离、双客户端推送与心跳、主动结束与自动结算', controls: [] }]
  };
  const source = [
    '类 MainWindow',
    '    HTTP服务端 推送服务',
    '    HTTP请求 订阅甲',
    '    HTTP请求 订阅乙',
    '    事件 _MainWindow_创建完毕()',
    '        推送服务 = HTTP_创建服务()',
    `        HTTP_配置服务(推送服务, "127.0.0.1", ${port}, 4, 64)`,
    '        HTTP_添加路由(推送服务, "GET", "/events", &处理订阅)',
    '        如果 (HTTP_启动(推送服务) == 假)',
    '            @ ExitProcess(2);',
    '        如果结束',
    '        延迟调用(200, &检查订阅)',
    '    结束',
    '    事件 处理订阅()',
    '        局部 HTTP请求 请求 = HTTP_取当前请求()',
    '        HTTP_设置响应头(请求, "Access-Control-Allow-Origin", "*")',
    '        如果 (HTTP_SSE_开始(请求) == 假)',
    '            @ ExitProcess(3);',
    '        如果结束',
    '        HTTP_SSE_推送事件(请求, "hello", "已连接")',
    '        如果 (订阅甲 == 0)',
    '            订阅甲 = 请求',
    '        否则',
    '            订阅乙 = 请求',
    '        如果结束',
    '    结束',
    '    事件 检查订阅()',
    '        如果 (HTTP_SSE_取连接数(推送服务) >= 2)',
    '            HTTP_SSE_推送事件(订阅甲, "progress", "50%")',
    '            HTTP_SSE_推送心跳(订阅乙)',
    '            HTTP_SSE_推送(订阅甲, "plain-broadcast")',
    '            延迟调用(400, &收尾)',
    '        否则',
    '            延迟调用(200, &检查订阅)',
    '        如果结束',
    '    结束',
    '    事件 收尾()',
    '        局部 逻辑型 在线甲 = HTTP_SSE_是否连接(订阅甲)',
    '        局部 逻辑型 在线乙 = HTTP_SSE_是否连接(订阅乙)',
    '        @ std::ofstream dbg("http-sse-native-smoke.dbg", std::ios::binary | std::ios::trunc); dbg << "onlineA=" << (在线甲 ? 1 : 0) << " onlineB=" << (在线乙 ? 1 : 0) << " idA=" << 订阅甲 << " idB=" << 订阅乙 << " sessions=" << HTTP_SSE_取连接数(推送服务) << " err=" << HTTP_取服务错误(推送服务); dbg.close();',
    '        如果 (在线甲 == 假)',
    '            @ ExitProcess(4);',
    '        如果结束',
    '        HTTP_SSE_结束(订阅甲)',
    '        HTTP_SSE_结束(订阅乙)',
    '        如果 (HTTP_SSE_取连接数(推送服务) != 0)',
    '            @ ExitProcess(5);',
    '        如果结束',
    '        @ std::ofstream report("http-sse-native-smoke.txt", std::ios::binary | std::ios::trunc); report << "OK\\n"; report.close();',
    '        @ ExitProcess(0);',
    '    结束',
    '结束类'
  ].join('\n');

  const generated = generateLingCppNativeWin32Project(project, { enabledModules, lingCppSourceCode: source });
  if (generated.blockingDiagnostics.length) throw new Error(`生成被阻断：\n${generated.blockingDiagnostics.join('\n')}`);
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
  for (const platform of ['Win32', 'x64']) {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  }
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  const workingDir = path.dirname(executable);
  const runPromise = execFileAsync(executable, [], { cwd: workingDir, windowsHide: true, timeout: 3 * 60 * 1000, maxBuffer: 1024 * 1024 }).then(() => ({ exitCode: 0 }), error => ({ exitCode: (error as { code?: number }).code }));

  // 双客户端订阅：甲先连、乙后连，验证两个分离会话各自收到全部事件并被服务端主动关闭。
  const clientA = await openSseClient(port);
  if (clientA.status !== 200) throw new Error(`SSE 响应状态码异常：${clientA.status}`);
  if (!String(clientA.headers['content-type'] || '').startsWith('text/event-stream')) throw new Error(`Content-Type 不是 text/event-stream：${clientA.headers['content-type']}`);
  if (clientA.headers['cache-control'] !== 'no-cache') throw new Error(`Cache-Control 缺失 no-cache：${clientA.headers['cache-control']}`);
  if (clientA.headers['access-control-allow-origin'] !== '*') throw new Error(`开始前设置的响应头未随 SSE 响应发出：${clientA.headers['access-control-allow-origin']}`);
  if (clientA.headers.connection !== 'close') throw new Error(`SSE 响应应为 Connection: close：${clientA.headers.connection}`);
  await waitForRaw('客户端甲收到 hello 事件', clientA, 'event: hello\ndata: 已连接\n\n', 15000);
  const clientB = await openSseClient(port);
  if (!String(clientB.headers['content-type'] || '').startsWith('text/event-stream')) throw new Error('客户端乙未收到 SSE 响应头');

  const run = await runPromise;
  // exe 写 OK 报告退出前必然已 HTTP_SSE_结束 两个会话；此处按客户端分别断言事件流
  //（甲=具名+匿名推送，乙=具名 hello + 心跳注释行）。
  const expectations: Array<[string, SseClient, string[]]> = [
    ['甲', clientA, ['event: hello\ndata: 已连接\n\n', 'event: progress\ndata: 50%\n\n', 'data: plain-broadcast\n\n']],
    ['乙', clientB, ['event: hello\ndata: 已连接\n\n', ': ping\n\n']]
  ];
  for (const [label, client, chunks] of expectations) {
    for (const chunk of chunks) {
      if (!client.contains(chunk)) throw new Error(`客户端${label} 缺少事件块：${JSON.stringify(chunk)}\n实际流：${JSON.stringify(client.raw())}`);
    }
    const byServer = await Promise.race([client.ended(), new Promise<boolean>(resolve => setTimeout(() => resolve(false), 15000))]);
    if (!byServer) throw new Error(`客户端${label} 的连接不是由服务端主动关闭\n实际流：${JSON.stringify(client.raw())}`);
  }
  const reportPath = path.join(workingDir, 'http-sse-native-smoke.txt');
  const report = await fs.readFile(reportPath, 'utf8').catch(() => '');
  if (report.trim() !== 'OK') throw new Error(`exe 侧自检未通过（exit=${(run as { exitCode?: number }).exitCode}）：\n${report}`);
  if ((run as { exitCode?: number }).exitCode !== 0) throw new Error(`exe 退出码异常：${(run as { exitCode?: number }).exitCode}`);
  console.log(JSON.stringify({ ok: true, projectDir, executable, platforms: ['Win32', 'x64'], port, clients: 2, clientA: clientA.raw, clientB: clientB.raw, report: report.trim() }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
