import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { ARIA2_MODULE_ID } from '../src/services/modules/aria2Module';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.join(repoRoot, '.lingbuilder-build', 'aria2-native-smoke');
const payload = Buffer.alloc(3 * 1024 * 1024, 0x5a);

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main(): Promise<void> {
  if (process.platform !== 'win32') throw new Error('Aria2 原生 smoke 仅支持 Windows。');
  const msbuild = await findMsBuild();
  const port = await reserveAvailablePort();
  const server = http.createServer((request, response) => {
    if (request.url !== '/payload.bin') {
      response.writeHead(404);
      response.end('not found');
      return;
    }
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/u);
    const start = range ? Number(range[1]) : 0;
    const requestedEnd = range?.[2] ? Number(range[2]) : payload.length - 1;
    const end = Math.min(Math.max(start, requestedEnd), payload.length - 1);
    if (!Number.isSafeInteger(start) || start < 0 || start >= payload.length || end < start) {
      response.writeHead(416);
      response.end();
      return;
    }
    const chunk = payload.subarray(start, end + 1);
    response.writeHead(range ? 206 : 200, {
      'Content-Type': 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Content-Length': chunk.length,
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${payload.length}` } : {})
    });
    let offset = 0;
    const timer = setInterval(() => {
      if (offset >= chunk.length) {
        clearInterval(timer);
        response.end();
        return;
      }
      const next = Math.min(offset + 64 * 1024, chunk.length);
      response.write(chunk.subarray(offset, next));
      offset = next;
    }, 70);
    response.once('close', () => clearInterval(timer));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  try {
    const result = await buildAndRun(msbuild, port);
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

async function buildAndRun(msbuild: string, port: number): Promise<{ executable: string; downloadedBytes: number }> {
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'aria2-native-smoke',
    name: 'Aria2 原生冒烟测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'Aria2 原生冒烟测试',
      width: 420, height: 180, background: '#202028', description: '验证 aria2c 受控运行时', controls: []
    }]
  };
  const enabledModules = [builtin(ARIA2_MODULE_ID)];
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: createSource(port),
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules
  });
  if (generated.blockingDiagnostics.length > 0) throw new Error(generated.blockingDiagnostics.join('\n'));
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const symbol of ['namespace LingAria2', 'CreateProcessW', 'Aria2_下载', 'Aria2_下载_窗口', 'Aria2_取下载速度', 'Aria2_取保存目录', 'Aria2_打开目录', 'ProgressMessage', 'DispatchAria2ProgressEvent', 'JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE']) {
    if (!mainCpp.includes(symbol)) throw new Error(`生成的 Aria2 C++ 缺少：${symbol}`);
  }
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const defaultIcon = path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v2.ico');
  await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
  await fs.copyFile(defaultIcon, path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, projectDir);
  if (dependencyDiagnostics.length > 0) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({
    projectDir,
    projectId: project.id,
    generatedFiles: generated.files,
    enabledModules
  });
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], {
    cwd: projectDir,
    windowsHide: true,
    timeout: 10 * 60 * 1000,
    maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  for (const file of ['aria2c.exe', 'COPYING', 'NOTICE.md']) await fs.access(path.join(path.dirname(executable), file));
  const child = spawn(executable, [], { cwd: path.dirname(executable), windowsHide: true, stdio: 'ignore' });
  const exitCode = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Aria2 原生 smoke 超时。'));
    }, 45000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); resolve(code ?? -1); });
  });
  if (exitCode !== 0) throw new Error(`Aria2 原生 smoke 退出码异常：${exitCode}`);
  const downloaded = await fs.readFile(path.join(path.dirname(executable), 'downloads', 'payload.bin'));
  assert.deepEqual(downloaded, payload);
  return { executable, downloadedBytes: downloaded.length };
}

function createSource(port: number): string {
  return [
    '类 MainWindow',
    '    Aria2任务 任务',
    '    整数型 回调次数 = 0',
    '    长整数型 最高速度 = 0',
    '    事件 _MainWindow_创建完毕()',
    `        任务 = Aria2_下载("http://127.0.0.1:${port}/payload.bin", "downloads", "payload.bin", 1, 1, &下载进度)`,
    '        如果 (任务 == 0)',
    '            @ ExitProcess(3);',
    '        如果结束',
    '    结束',
    '    事件 下载进度(Aria2任务 回调任务, 整数型 进度, 长整数型 已下载字节, 长整数型 总字节, 长整数型 速度字节每秒, 文本型 状态)',
    '        回调次数 = 回调次数 + 1',
    '        如果 (速度字节每秒 > 最高速度)',
    '            最高速度 = 速度字节每秒',
    '        如果结束',
    '        @ if (状态 == L"已完成") {',
    '        @     const bool ok = 回调任务 == 任务 && 回调次数 >= 2 && 进度 == 100 && 已下载字节 == 3145728 && 总字节 == 3145728 && 最高速度 > 0;',
    '        @     const wchar_t* directoryResult = Aria2_取保存目录(任务);',
    '        @     if (!directoryResult || !directoryResult[0]) ExitProcess(7);',
    '        @     Aria2_释放(任务);',
    '        @     ExitProcess(ok ? 0 : 2);',
    '        @ }',
    '        @ if (状态 == L"已失败" || 状态 == L"已停止") ExitProcess(8);',
    '    结束',
    '结束类'
  ].join('\n');
}

async function findMsBuild(): Promise<string> {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, [
    '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  return path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
}

async function reserveAvailablePort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法分配 Aria2 原生 smoke 端口。');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

void main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
