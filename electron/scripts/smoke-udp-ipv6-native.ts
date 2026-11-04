import dgram from 'node:dgram';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'udp-ipv6-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

// 探测矩阵（全部以退出码编码，零文本报告依赖）：
//  甲 UDP_发送文本("::1")        → 服务器收到原生 IPv6 数据报并回 V6回复
//  乙 UDP_发送文本("127.0.0.1")  → 服务器收到 IPv4 数据报（::ffff:127.0.0.1）并回 V4回复
//  丙 UDP_发送文本("localhost")  → 域名同时有 A+AAAA，实锤 v4 优先策略（服务器须按 ::ffff:127.0.0.1 收到）
//  丁 exe 双栈绑定端口收 3 条回复：V4回复 来源必须是点分十进制 127.0.0.1（v4-mapped 归一化实锤），
//     V6回复 来源必须是 ::1
//  戊 UDP_允许广播(真) 后发 255.255.255.255：sendto 不失败即双栈套接字广播成立（方案 A 裁决点），
//     失败退出码 10 = 触发方案 B（按族切换套接字）。
// 退出码：2 绑定失败 / 3 ::1 发送失败 / 4 127.0.0.1 发送失败 / 5 localhost 发送失败 /
//   6/7/12 三次接收超时 / 13 V4回复数不对 / 14 V6回复数不对 / 8 v4 来源非点分十进制 /
//   9 v6 来源非 ::1 / 10 广播发送失败 / 0 全部通过。

type Receipt = { text: string; address: string; port: number };

async function pickFreeUdpPort(): Promise<number> {
  const socket = dgram.createSocket({ type: 'udp6', ipv6Only: false });
  await new Promise<void>(resolve => socket.bind(0, '::', resolve));
  const port = socket.address().port;
  await new Promise<void>(resolve => socket.close(() => resolve()));
  return port;
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('UDP IPv6 冒烟测试目录越出工作区。');
  const receipts: Receipt[] = [];
  const server = dgram.createSocket({ type: 'udp6', ipv6Only: false });
  server.on('message', (message, rinfo) => {
    const text = message.toString('utf8');
    receipts.push({ text, address: rinfo.address, port: rinfo.port });
    const reply = text === 'V6探测' ? 'V6回复' : 'V4回复';
    server.send(Buffer.from(reply, 'utf8'), rinfo.port, rinfo.address, () => undefined);
  });
  await new Promise<void>(resolve => server.bind(0, '::', resolve));
  const serverPort = server.address().port;
  const clientPort = await pickFreeUdpPort();
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.net.udp')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'udp-ipv6-native-smoke',
    name: 'UDP双栈原生冒烟测试',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'UDP双栈原生冒烟测试', width: 420, height: 240, background: '#202028', description: '验证 net.udp IPv6 双栈发送接收与广播', controls: [] }]
  };
  const receiveBlock = (emptyCode: number) => [
    '        回复文本 = UDP_接收文本(1024, 10000)',
    `        如果 (回复文本 == "")`,
    `            @ ExitProcess(${emptyCode});`,
    '        如果结束',
    '        如果 (回复文本 == "V4回复")',
    '            V4回复数 = V4回复数 + 1',
    '            如果 (UDP_取来源地址() == "127.0.0.1")',
    '                V4来源正确 = 真',
    '            如果结束',
    '            如果 (UDP_取来源地址() != "127.0.0.1")',
    '                V4来源正确 = 假',
    '            如果结束',
    '        如果结束',
    '        如果 (回复文本 == "V6回复")',
    '            V6回复数 = V6回复数 + 1',
    '            如果 (UDP_取来源地址() == "::1")',
    '                V6来源正确 = 真',
    '            如果结束',
    '            如果 (UDP_取来源地址() != "::1")',
    '                V6来源正确 = 假',
    '            如果结束',
    '        如果结束'
  ].join('\n');
  const source = [
    '类 MainWindow',
    '    逻辑型 V4来源正确',
    '    逻辑型 V6来源正确',
    '    逻辑型 绑定结果',
    '    整数型 V4回复数',
    '    整数型 V6回复数',
    '    整数型 发送结果',
    '    文本型 回复文本',
    '    事件 _MainWindow_创建完毕()',
    '        V4来源正确 = 假',
    '        V6来源正确 = 假',
    '        V4回复数 = 0',
    '        V6回复数 = 0',
    `        绑定结果 = UDP_绑定(${clientPort})`,
    '        如果 (绑定结果 == 假)',
    '            @ ExitProcess(2);',
    '        如果结束',
    '        UDP_允许广播(真)',
    `        发送结果 = UDP_发送文本("::1", ${serverPort}, "V6探测")`,
    '        如果 (发送结果 < 0)',
    '            @ ExitProcess(3);',
    '        如果结束',
    `        发送结果 = UDP_发送文本("127.0.0.1", ${serverPort}, "V4探测")`,
    '        如果 (发送结果 < 0)',
    '            @ ExitProcess(4);',
    '        如果结束',
    `        发送结果 = UDP_发送文本("localhost", ${serverPort}, "NAME探测")`,
    '        如果 (发送结果 < 0)',
    '            @ ExitProcess(5);',
    '        如果结束',
    receiveBlock(6),
    receiveBlock(7),
    receiveBlock(12),
    '        如果 (V4回复数 != 2)',
    '            @ ExitProcess(13);',
    '        如果结束',
    '        如果 (V6回复数 != 1)',
    '            @ ExitProcess(14);',
    '        如果结束',
    '        如果 (V4来源正确 == 假)',
    '            @ ExitProcess(8);',
    '        如果结束',
    '        如果 (V6来源正确 == 假)',
    '            @ ExitProcess(9);',
    '        如果结束',
    `        发送结果 = UDP_发送文本("255.255.255.255", ${serverPort}, "广播探测")`,
    '        如果 (发送结果 < 0)',
    '            @ ExitProcess(10);',
    '        如果结束',
    '        @ ExitProcess(0);',
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
  const run = await execFileAsync(executable, [], { cwd: path.dirname(executable), windowsHide: true, timeout: 2 * 60 * 1000, maxBuffer: 1024 * 1024 }).then(() => ({ code: 0 }), error => ({ error: error as { code?: number } }));
  server.close();
  const exitCode = 'error' in run ? (run.error.code ?? -1) : 0;
  const v6Probe = receipts.find(item => item.text === 'V6探测');
  const v4Probe = receipts.find(item => item.text === 'V4探测');
  const nameProbe = receipts.find(item => item.text === 'NAME探测');
  // 服务器侧对拍：v6 字面量按原生 IPv6 到达；v4 字面量与 localhost 域名都按 IPv4-mapped
  // 到达（localhost 实锤「域名同时有 A+AAAA 时优先 IPv4」策略）。
  const serverChecks: Array<{ name: string; ok: boolean; detail: string }> = [
    { name: 'V6字面量按原生IPv6到达', ok: Boolean(v6Probe && v6Probe.address === '::1'), detail: JSON.stringify(v6Probe) },
    { name: 'V4字面量按IPv4到达', ok: Boolean(v4Probe && v4Probe.address === '::ffff:127.0.0.1'), detail: JSON.stringify(v4Probe) },
    { name: 'localhost域名v4优先', ok: Boolean(nameProbe && nameProbe.address === '::ffff:127.0.0.1'), detail: JSON.stringify(nameProbe) }
  ];
  const failedServerCheck = serverChecks.find(item => !item.ok);
  if (exitCode === 10) {
    throw new Error('双栈套接字上 255.255.255.255 广播 sendto 失败（退出码 10）：单播 v4/v6 已通过但映射广播被拒，触发方案 B（按族切换套接字）。服务器对拍：' + JSON.stringify(serverChecks));
  }
  if (exitCode !== 0) throw new Error(`UDP IPv6 冒烟失败，退出码 ${exitCode}（2 绑定/3 v6发送/4 v4发送/5 域名发送/6 7 12 接收超时/8 v4来源/9 v6来源/13 14 回复数）。服务器对拍：${JSON.stringify({ receipts, serverChecks })}`);
  if (failedServerCheck) throw new Error(`服务器侧对拍失败【${failedServerCheck.name}】：${failedServerCheck.detail}；全部回执：${JSON.stringify(receipts)}`);
  console.log(JSON.stringify({ ok: true, projectDir, executable, platforms: ['Win32', 'x64'], exitCode, serverChecks, broadcastAcceptedOnDualStack: true }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
