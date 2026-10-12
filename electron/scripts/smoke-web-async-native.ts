import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'web-async-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

// 本地回显服务：记录每次请求的 path / UA / 正文 / method，供脚本侧对拍。
type ProbeRecord = { path: string; userAgent: string; body: string; method: string };

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('web.http 异步冒烟测试目录越出工作区。');
  const probes: ProbeRecord[] = [];
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', chunk => chunks.push(chunk as Buffer));
    request.on('end', () => {
      probes.push({ path: String(request.url || ''), userAgent: String(request.headers['user-agent'] || ''), body: Buffer.concat(chunks).toString('utf8'), method: String(request.method || '') });
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('ECHO-OK');
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  if (!port) throw new Error('本地回显服务端口分配失败。');
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.web.http')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'web-async-native-smoke',
    name: '网页异步访问1.3原生冒烟测试',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '网页异步访问1.3原生冒烟测试', width: 420, height: 240, background: '#202028', description: '验证 1.3.0 尾部可选参数与旧三参调用并存', controls: [] }]
  };
  // 三路请求：
  //  甲 带自定义 UA + POST 表单正文（第 4/6 参按位透传）
  //  乙 旧三参调用（C++ 默认参数兜底 → 默认 UA、GET）
  //  丙 禁止重定向（第 7 参 真；服务器直接 200，断言不影响正常路径）
  // 完成处理器按请求编号隔离结果，三路都到齐才写 OK 退出。
  const source = [
    '类 MainWindow',
    '    整数型 请求编号甲',
    '    整数型 请求编号乙',
    '    整数型 请求编号丙',
    '    整数型 完成计数',
    '    文本型 返回文本',
    '    事件 _MainWindow_创建完毕()',
    `        请求编号甲 = 网页_异步访问("http://127.0.0.1:${port}/probe", 1, &带UA完成, "name=lingbuilder&ver=130", "", "User-Agent: LBAsyncProbe/1.0")`,
    `        请求编号乙 = 网页_异步访问("http://127.0.0.1:${port}/legacy", 0, &旧调用完成)`,
    `        请求编号丙 = 网页_异步访问("http://127.0.0.1:${port}/noredirect", 0, &禁止重定向完成, "", "", "", 真)`,
    '        如果 (请求编号甲 == 0 或 请求编号乙 == 0 或 请求编号丙 == 0)',
    '            @ ExitProcess(3);',
    '        如果结束',
    '    结束',
    '    事件 带UA完成()',
    '        如果 (网页_异步取当前请求编号() != 请求编号甲)',
    '            @ ExitProcess(4);',
    '        如果结束',
    '        如果 (网页_异步取状态代码(请求编号甲) != 200)',
    '            @ ExitProcess(5);',
    '        如果结束',
    '        返回文本 = 网页_异步取返回文本(请求编号甲)',
    '        如果 (返回文本 != "ECHO-OK")',
    '            @ ExitProcess(11);',
    '        如果结束',
    '        完成计数 = 完成计数 + 1',
    '        如果 (完成计数 == 3)',
    '            @ std::ofstream report("web-async-native-smoke.txt", std::ios::binary | std::ios::trunc); report << "OK\\n"; report.close();',
    '            @ ExitProcess(0);',
    '        如果结束',
    '    结束',
    '    事件 旧调用完成()',
    '        如果 (网页_异步取当前请求编号() != 请求编号乙)',
    '            @ ExitProcess(6);',
    '        如果结束',
    '        如果 (网页_异步取状态代码(请求编号乙) != 200)',
    '            @ ExitProcess(7);',
    '        如果结束',
    '        完成计数 = 完成计数 + 1',
    '        如果 (完成计数 == 3)',
    '            @ std::ofstream report("web-async-native-smoke.txt", std::ios::binary | std::ios::trunc); report << "OK\\n"; report.close();',
    '            @ ExitProcess(0);',
    '        如果结束',
    '    结束',
    '    事件 禁止重定向完成()',
    '        如果 (网页_异步取当前请求编号() != 请求编号丙)',
    '            @ ExitProcess(8);',
    '        如果结束',
    '        如果 (网页_异步取状态代码(请求编号丙) != 200)',
    '            @ ExitProcess(9);',
    '        如果结束',
    '        完成计数 = 完成计数 + 1',
    '        如果 (完成计数 == 3)',
    '            @ std::ofstream report("web-async-native-smoke.txt", std::ios::binary | std::ios::trunc); report << "OK\\n"; report.close();',
    '            @ ExitProcess(0);',
    '        如果结束',
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
  for (const platform of ['Win32', 'x64']) {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  }
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  const run = await execFileAsync(executable, [], { cwd: path.dirname(executable), windowsHide: true, timeout: 3 * 60 * 1000, maxBuffer: 1024 * 1024 }).then(() => ({}), error => ({ error }));
  server.close();
  const reportPath = path.join(path.dirname(executable), 'web-async-native-smoke.txt');
  const report = await fs.readFile(reportPath, 'utf8').catch(() => '');
  if ('error' in run && report.trim() !== 'OK') throw new Error(`运行未正常退出（exit=${(run.error as { code?: number }).code}）：\n${report}`);
  if (report.trim() !== 'OK') throw new Error(`原生 网页_异步访问 1.3 冒烟失败：\n${report}`);
  // 服务器侧对拍：参数确实到达网络层，而不是只进了形参。
  const probePost = probes.find(p => p.path === '/probe');
  if (!probePost || probePost.method !== 'POST' || probePost.body !== 'name=lingbuilder&ver=130') throw new Error(`回显服务未收到带正文 POST：${JSON.stringify(probes)}`);
  if (probePost.userAgent !== 'LBAsyncProbe/1.0') throw new Error(`附加协议头 User-Agent 透传失败：实际 "${probePost.userAgent}"`);
  const legacyGet = probes.find(p => p.path === '/legacy');
  if (!legacyGet || legacyGet.userAgent !== 'LingBuilder-WebHttp/1.0') throw new Error(`旧三参调用默认 UA 缺失（默认参数兜底失效）：${JSON.stringify(legacyGet)}`);
  const noredirectGet = probes.find(p => p.path === '/noredirect');
  if (!noredirectGet || noredirectGet.userAgent !== 'LingBuilder-WebHttp/1.0') throw new Error(`禁止重定向路线异常：${JSON.stringify(noredirectGet)}`);
  console.log(JSON.stringify({ ok: true, projectDir, executable, platforms: ['Win32', 'x64'], report: report.trim(), probes }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
