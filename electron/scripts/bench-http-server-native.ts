import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
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
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'http-server-bench');
const outDir = path.join(projectDir, 'bench-out');
const resultsPath = path.join(outDir, 'results.json');
const reportHtmlPath = path.join(outDir, 'report.html');
const reportPngPath = path.join(outDir, 'report.png');

const WORKERS = 64;
const QUEUE_LIMIT = 2048;
const ROTATION = 1000;
const REQUEST_TIMEOUT_MS = 35000;
const WARMUP_SEC = 3;

interface StageResult {
  users: number;
  totalRequests: number;
  errors: number;
  errorRatePercent: number;
  avgRps: number;
  peakRps: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  perSecondRps: number[];
  secondsOffset: number;
  errorBreakdown: Record<string, number>;
}

interface BenchResults {
  generatedAt: string;
  moduleVersion: string;
  durationSec: number;
  warmupSec: number;
  workers: number;
  queueLimit: number;
  rotation: number;
  requestTarget: string;
  responseBytes: number;
  machine: { cpu: string; logicalProcessors: number; memoryGB: number; os: string };
  stages: StageResult[];
}

function log(message: string): void {
  console.log(`[bench] ${message}`);
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const flags = parseFlags(process.argv.slice(2));
  const durationSec = Number(flags.duration ?? 30);
  const stages = String(flags.stages ?? '10,50,100,200').split(',').map(Number);

  await fs.mkdir(outDir, { recursive: true });
  let results: BenchResults;
  if (args.has('--report-only')) {
    results = JSON.parse(await fs.readFile(resultsPath, 'utf8')) as BenchResults;
  } else {
    let port: number;
    if (args.has('--skip-build')) {
      port = Number(flags.port);
      if (!port) throw new Error('--skip-build 需要同时提供 --port');
    } else {
      port = await buildAndLaunch();
    }
    try {
      results = await runBench(port, stages, durationSec);
    } finally {
      await shutdownAndStop(port);
    }
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2), 'utf8');
  }
  const html = renderReport(results);
  await fs.writeFile(reportHtmlPath, html, 'utf8');
  await captureScreenshot();
  log(`结果 JSON：${resultsPath}`);
  log(`报告 HTML：${reportHtmlPath}`);
  log(`报告截图：${reportPngPath}`);
}

function parseFlags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of argv) {
    const match = item.match(/^--([a-z-]+)(?:=(.*))?$/u);
    if (match) out[match[1]!] = match[2] ?? 'true';
  }
  return out;
}

// ---------- build & launch ----------

let childProcess: ReturnType<typeof spawn> | undefined;
let executablePath = '';

async function buildAndLaunch(): Promise<number> {
  const port = await reserveAvailablePort();
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });

  const enabledModules = [builtinModule('lingbuilder.http.server')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'http-server-bench',
    name: 'HTTP 服务端并发压测',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'HTTP 服务端并发压测',
      width: 460,
      height: 220,
      background: '#202028',
      description: 'HTTP 服务端模块并发压测目标',
      controls: []
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: createBenchSource(port),
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, projectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const solutionProject: LingBuilderSolutionProject = {
    id: project.id, name: project.name, type: 'visual-cpp', sourceRoot: 'src', configRoot: 'config',
    designerPath: `.lingbuilder/projects/${project.id}/window-designer.json`, isDefault: true
  };
  await createWindowsExecutableIconService(projectDir, createDesignerAssetService(projectDir))
    .materialize(solutionProject, generated.selectedWindow, [projectDir]);
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });

  const msbuild = await findMsBuild();
  log('MSBuild 编译 x64 Release…');
  try {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], {
      cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024
    });
  } catch (error) {
    const stderr = error instanceof Error ? (error as { stderr?: string }).stderr ?? '' : '';
    throw new Error(`MSBuild 编译失败：\n${stderr || String(error)}`);
  }

  executablePath = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  childProcess = spawn(executablePath, [], { cwd: path.dirname(executablePath), windowsHide: true, stdio: 'ignore' });
  await waitForPort(port, 15000);
  log(`压测目标已启动：${executablePath} 端口 ${port}`);
  return port;
}

function builtinModule(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

function createBenchSource(port: number): string {
  return [
    '类 MainWindow',
    '    HTTP服务端 服务',
    '    事件 _MainWindow_创建完毕()',
    '        服务 = HTTP_创建服务()',
    `        HTTP_配置服务(服务, "127.0.0.1", ${port}, ${WORKERS}, ${QUEUE_LIMIT})`,
    '        HTTP_设置请求限制(服务, 64, 1, 30000)',
    `        HTTP_设置连接轮转(服务, ${ROTATION})`,
    '        HTTP_添加静态路由(服务, "GET", "/api/data", "{\\"ok\\":true,\\"source\\":\\"LingBuilder HTTP Server\\"}", "application/json; charset=utf-8")',
    '        HTTP_添加路由(服务, "GET", "/stop", &停止服务)',
    '        HTTP_绑定请求处理器(服务, &未找到路由)',
    '        HTTP_启动(服务)',
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

async function findMsBuild(): Promise<string> {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  return path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
}

async function shutdownAndStop(port: number): Promise<void> {
  try {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => { socket.write(`GET /stop HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`); resolve(); });
      socket.once('error', reject);
    }).catch(() => undefined);
    socket.destroy();
    await waitForPortClosed(port, 10000).catch(() => undefined);
  } finally {
    if (childProcess && childProcess.exitCode === null) childProcess.kill();
    childProcess = undefined;
  }
}

// ---------- load generator ----------

class BenchConnection {
  private socket = new net.Socket();
  private buffered = Buffer.alloc(0);
  private wake: (() => void) | undefined;
  private dead = false;

  constructor(private readonly port: number) {
    this.socket.on('data', chunk => { this.buffered = Buffer.concat([this.buffered, chunk]); this.wake?.(); });
    this.socket.on('close', () => { this.dead = true; this.wake?.(); });
    this.socket.on('error', () => { this.dead = true; this.wake?.(); });
  }

  get closed(): boolean { return this.dead; }

  async connect(): Promise<void> {
    this.socket.connect(this.port, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      this.socket.once('connect', resolve);
      this.socket.once('error', () => reject(new Error('connect-failed')));
    });
  }

  async request(): Promise<{ status: number; closeAfter: boolean }> {
    this.socket.write('GET /api/data HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: keep-alive\r\nAccept: */*\r\n\r\n');
    const deadline = Date.now() + REQUEST_TIMEOUT_MS;
    let headerEnd = this.buffered.indexOf('\r\n\r\n');
    while (headerEnd < 0) {
      await this.waitForData(deadline);
      headerEnd = this.buffered.indexOf('\r\n\r\n');
    }
    const headerText = this.buffered.subarray(0, headerEnd).toString('latin1');
    this.buffered = this.buffered.subarray(headerEnd + 4);
    const statusLine = headerText.split('\r\n')[0] ?? '';
    const status = Number(statusLine.match(/^HTTP\/1\.[01]\s+(\d{3})/u)?.[1] ?? 0);
    if (!status) throw new Error('bad-status-line');
    const lower = headerText.toLowerCase();
    const length = Number(lower.match(/content-length:\s*(\d+)/u)?.[1] ?? 0);
    while (this.buffered.length < length) await this.waitForData(deadline);
    this.buffered = this.buffered.subarray(length);
    return { status, closeAfter: lower.includes('connection: close') };
  }

  destroy(): void { this.dead = true; this.socket.destroy(); }

  private async waitForData(deadline: number): Promise<void> {
    if (this.dead) throw new Error('connection-closed');
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('request-timeout');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('request-timeout')), remaining);
      const onData = () => finish();
      const onClose = () => finish(new Error('connection-closed'));
      const onError = () => finish(new Error('connection-closed'));
      const finish = (error?: Error) => {
        clearTimeout(timer);
        this.socket.off('data', onData);
        this.socket.off('close', onClose);
        this.socket.off('error', onError);
        this.wake = undefined;
        if (error) reject(error); else resolve();
      };
      this.wake = finish;
      this.socket.once('data', onData);
      this.socket.once('close', onClose);
      this.socket.once('error', onError);
    });
    if (this.dead) throw new Error('connection-closed');
  }
}

interface StageRecorder {
  ok: (latencyMs: number, atMs: number) => void;
  err: (reason: string, atMs: number) => void;
}

async function runStage(port: number, users: number, durationSec: number): Promise<StageResult> {
  const start = Date.now();
  const warmupEnd = start + WARMUP_SEC * 1000;
  const endAt = warmupEnd + durationSec * 1000;
  const latencies: number[] = [];
  const errorBreakdown: Record<string, number> = {};
  let errors = 0;
  const perSecond: number[] = [];
  const recorder: StageRecorder = {
    ok: (latencyMs, atMs) => {
      if (atMs < warmupEnd) return;
      latencies.push(latencyMs);
      const bucket = Math.min(Math.floor((atMs - warmupEnd) / 1000), durationSec - 1);
      perSecond[bucket] = (perSecond[bucket] ?? 0) + 1;
    },
    err: (reason, atMs) => {
      if (atMs < warmupEnd) return;
      errors += 1;
      errorBreakdown[reason] = (errorBreakdown[reason] ?? 0) + 1;
    }
  };

  log(`  并发 ${users}：预热 ${WARMUP_SEC}s + 计时 ${durationSec}s …`);
  await Promise.all(Array.from({ length: users }, () => virtualUser(port, endAt, recorder)));

  const measuredSec = Math.max(1, Math.round((Date.now() - warmupEnd) / 1000));
  const total = latencies.length;
  const sorted = [...latencies].sort((a, b) => a - b);
  const filledPerSecond = Array.from({ length: measuredSec }, (_, index) => perSecond[index] ?? 0);
  return {
    users,
    totalRequests: total,
    errors,
    errorRatePercent: total + errors > 0 ? Number((errors / (total + errors) * 100).toFixed(4)) : 0,
    avgRps: Math.round(total / measuredSec),
    peakRps: filledPerSecond.length ? Math.max(...filledPerSecond) : 0,
    avgLatencyMs: total ? Number((latencies.reduce((a, b) => a + b, 0) / total).toFixed(2)) : 0,
    p95LatencyMs: total ? Number(percentile(sorted, 0.95).toFixed(2)) : 0,
    p99LatencyMs: total ? Number(percentile(sorted, 0.99).toFixed(2)) : 0,
    perSecondRps: filledPerSecond,
    secondsOffset: 0,
    errorBreakdown
  };
}

async function virtualUser(port: number, endAt: number, recorder: StageRecorder): Promise<void> {
  let connection: BenchConnection | undefined;
  while (Date.now() < endAt) {
    try {
      if (!connection || connection.closed) {
        connection?.destroy();
        connection = new BenchConnection(port);
        await connection.connect();
      }
      const t0 = Date.now();
      const response = await connection.request();
      const latency = Date.now() - t0;
      if (response.status === 200) recorder.ok(latency, Date.now());
      else recorder.err(`http-${response.status}`, Date.now());
      if (response.closeAfter) { connection.destroy(); connection = undefined; }
    } catch (error) {
      connection?.destroy();
      connection = undefined;
      const reason = error instanceof Error && error.message ? error.message : 'unknown';
      recorder.err(reason, Date.now());
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  connection?.destroy();
}

async function runBench(port: number, stages: number[], durationSec: number): Promise<BenchResults> {
  const results: StageResult[] = [];
  let offset = 0;
  for (const users of stages) {
    const stage = await runStage(port, users, durationSec);
    stage.secondsOffset = offset;
    offset += WARMUP_SEC + stage.perSecondRps.length;
    results.push(stage);
    log(`  并发 ${users} 完成：平均 ${stage.avgRps} req/s，峰值 ${stage.peakRps} req/s，错误率 ${stage.errorRatePercent}%`);
  }
  const cpus = os.cpus();
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.http.server');
  return {
    generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    moduleVersion: manifest?.version ?? '2.0.0',
    durationSec,
    warmupSec: WARMUP_SEC,
    workers: WORKERS,
    queueLimit: QUEUE_LIMIT,
    rotation: ROTATION,
    requestTarget: 'GET /api/data（静态路由固定 JSON）',
    responseBytes: 48,
    machine: {
      cpu: cpus[0]?.model?.trim() ?? '未知',
      logicalProcessors: cpus.length,
      memoryGB: Math.round(os.totalmem() / 1073741824),
      os: `Windows ${os.release()} (${os.arch()})`
    },
    stages: results
  };
}

function percentile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)] ?? 0;
}

// ---------- report ----------

function renderReport(results: BenchResults): string {
  const esc = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const formatNumber = (value: number): string => value.toLocaleString('en-US');
  const rows = results.stages.map(stage => `
      <tr>
        <td class="users">${stage.users}</td>
        <td>${formatNumber(stage.totalRequests)}</td>
        <td class="hl">${formatNumber(stage.avgRps)}</td>
        <td>${formatNumber(stage.peakRps)}</td>
        <td>${stage.avgLatencyMs}</td>
        <td>${stage.p95LatencyMs}</td>
        <td>${stage.p99LatencyMs}</td>
        <td>${stage.errorRatePercent}%</td>
      </tr>`).join('');

  const best = [...results.stages].sort((a, b) => b.avgRps - a.avgRps)[0];
  const totalErrors = results.stages.reduce((sum, stage) => sum + stage.errors, 0);
  const totalRequests = results.stages.reduce((sum, stage) => sum + stage.totalRequests, 0);

  const chart = buildThroughputChart(results);
  const timeline = buildTimelineChart(results);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1920px; height: 1080px; overflow: hidden; }
  body { background: #14151a; color: #e6e8ee; font-family: "Microsoft YaHei UI", "Segoe UI", sans-serif; }
  .wrap { padding: 34px 48px; height: 100%; display: flex; flex-direction: column; }
  .head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #2c2f3a; padding-bottom: 18px; }
  .title { font-size: 30px; font-weight: 700; letter-spacing: 1px; }
  .title .accent { color: #4da3ff; }
  .subtitle { font-size: 15px; color: #8b93a7; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin: 20px 0; }
  .card { background: #1b1d24; border: 1px solid #2a2d38; border-radius: 10px; padding: 16px 20px; }
  .card .label { font-size: 13px; color: #8b93a7; margin-bottom: 8px; }
  .card .value { font-size: 24px; font-weight: 700; color: #4da3ff; font-family: Consolas, monospace; }
  .card .note { font-size: 12.5px; color: #9aa2b5; margin-top: 6px; line-height: 1.55; }
  .cols { display: grid; grid-template-columns: 880px 1fr; gap: 24px; flex: 1; min-height: 0; }
  .panel { background: #1b1d24; border: 1px solid #2a2d38; border-radius: 10px; padding: 18px 22px; }
  .panel h3 { font-size: 16px; margin-bottom: 12px; color: #cdd3e0; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 15px; }
  th { text-align: right; color: #8b93a7; font-weight: 500; padding: 8px 10px; border-bottom: 1px solid #2f3340; }
  td { text-align: right; padding: 9px 10px; border-bottom: 1px solid #23262f; font-family: Consolas, monospace; }
  th:first-child, td:first-child { text-align: left; }
  td.users { color: #ffd166; font-weight: 700; }
  td.hl { color: #4da3ff; font-weight: 700; }
  .foot { margin-top: 14px; font-size: 12.5px; color: #6d7484; line-height: 1.7; }
  .right { display: flex; flex-direction: column; gap: 18px; min-height: 0; }
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <div class="title">LingBuilder <span class="accent">HTTP 服务端模块</span> · 并发压力测试报告</div>
    <div class="subtitle">${esc(results.generatedAt)} &nbsp;|&nbsp; lingbuilder.http.server v${esc(results.moduleVersion)}</div>
  </div>
  <div class="cards">
    <div class="card"><div class="label">测试环境</div><div class="value">${results.machine.logicalProcessors} 逻辑处理器</div><div class="note">${esc(results.machine.cpu)}<br>${results.machine.memoryGB} GB 内存 · ${esc(results.machine.os)}</div></div>
    <div class="card"><div class="label">压测方法</div><div class="value">阶梯并发 · Keep-Alive</div><div class="note">10 / 50 / 100 / 200 并发用户，每阶段 ${results.durationSec} 秒（另计 ${results.warmupSec} 秒预热不计入）<br>请求：${esc(results.requestTarget)}</div></div>
    <div class="card"><div class="label">服务端配置</div><div class="value">${results.workers} 工作线程</div><div class="note">静态路由工作线程直回（不占 UI 线程）· 连接轮转 ${results.rotation}<br>监听 127.0.0.1 回环 · 等待队列 ${results.queueLimit} · 请求头 64KB / 超时 30s</div></div>
    <div class="card"><div class="label">结果概要</div><div class="value">峰值 ${formatNumber(best?.peakRps ?? 0)} req/s</div><div class="note">总完成 ${formatNumber(totalRequests)} 请求 · 总错误 ${formatNumber(totalErrors)}（${totalRequests + totalErrors > 0 ? (totalErrors / (totalRequests + totalErrors) * 100).toFixed(3) : '0'}%）<br>最高平均吞吐 ${formatNumber(best?.avgRps ?? 0)} req/s（${best?.users ?? 0} 并发）</div></div>
  </div>
  <div class="cols">
    <div class="panel">
      <h3>分阶段结果</h3>
      <table>
        <tr><th>并发用户</th><th>完成请求</th><th>平均吞吐 (req/s)</th><th>峰值 (req/s)</th><th>平均延迟 (ms)</th><th>P95 (ms)</th><th>P99 (ms)</th><th>错误率</th></tr>
        ${rows}
      </table>
      <h3 style="margin-top:20px">每秒吞吐时间线</h3>
      ${timeline}
      <div class="foot">说明：压测端与服务端运行于同一台机器，经 127.0.0.1 回环连接；请求为 HTTP/1.1 Keep-Alive 长连接、零思考时间连续压取。服务端为 LingBuilder IDE 生成的原生 Win32 x64 可执行文件。</div>
    </div>
    <div class="right">
      <div class="panel" style="flex:1"><h3>平均吞吐量（req/s）</h3>${chart}</div>
      <div class="panel"><h3>延迟分布（ms，对数刻度）</h3>${buildLatencyChart(results)}</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

function buildThroughputChart(results: BenchResults): string {
  const stages = results.stages;
  const width = 880, height = 300, left = 70, bottom = 40, top = 20;
  const max = Math.max(...stages.map(stage => stage.avgRps), 1) * 1.15;
  const barWidth = (width - left - 20) / stages.length * 0.55;
  const bars = stages.map((stage, index) => {
    const slot = (width - left - 20) / stages.length;
    const x = left + slot * index + (slot - barWidth) / 2;
    const h = (stage.avgRps / max) * (height - top - bottom);
    return `<rect x="${x}" y="${height - bottom - h}" width="${barWidth}" height="${h}" rx="4" fill="url(#gbar)"/>
      <text x="${x + barWidth / 2}" y="${height - bottom - h - 8}" fill="#e6e8ee" font-size="15" font-weight="700" text-anchor="middle" font-family="Consolas">${stage.avgRps.toLocaleString('en-US')}</text>
      <text x="${x + barWidth / 2}" y="${height - 14}" fill="#8b93a7" font-size="14" text-anchor="middle">${stage.users} 并发</text>`;
  }).join('');
  const gridLines = [0.25, 0.5, 0.75, 1].map(ratio => {
    const y = height - bottom - ratio * (height - top - bottom);
    return `<line x1="${left}" y1="${y}" x2="${width - 10}" y2="${y}" stroke="#2a2d38"/>
      <text x="${left - 8}" y="${y + 4}" fill="#6d7484" font-size="12" text-anchor="end" font-family="Consolas">${Math.round(max * ratio).toLocaleString('en-US')}</text>`;
  }).join('');
  return `<svg width="${width}" height="${height}">
    <defs><linearGradient id="gbar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#63b3ff"/><stop offset="1" stop-color="#2f6fd0"/></linearGradient></defs>
    <line x1="${left}" y1="${height - bottom}" x2="${width - 10}" y2="${height - bottom}" stroke="#3a3f4e"/>
    ${gridLines}${bars}
  </svg>`;
}

function buildLatencyChart(results: BenchResults): string {
  const stages = results.stages;
  const width = 880, height = 210, left = 70, bottom = 36, top = 16;
  const maxLat = Math.max(...stages.flatMap(stage => [stage.p95LatencyMs, stage.avgLatencyMs]), 1) * 1.2;
  const log = (value: number): number => value <= 0 ? 0 : Math.log10(value + 1);
  const logMax = log(maxLat);
  const slot = (width - left - 20) / stages.length;
  const barWidth = slot * 0.28;
  let bars = '';
  stages.forEach((stage, index) => {
    const x = left + slot * index + slot * 0.18;
    const hAvg = (log(stage.avgLatencyMs) / logMax) * (height - top - bottom);
    const hP95 = (log(stage.p95LatencyMs) / logMax) * (height - top - bottom);
    bars += `<rect x="${x}" y="${height - bottom - hAvg}" width="${barWidth}" height="${Math.max(hAvg, 1)}" rx="3" fill="#4da3ff"/>
      <text x="${x + barWidth / 2}" y="${height - bottom - hAvg - 6}" fill="#9aa2b5" font-size="12" text-anchor="middle" font-family="Consolas">${stage.avgLatencyMs}</text>
      <rect x="${x + barWidth + 6}" y="${height - bottom - hP95}" width="${barWidth}" height="${Math.max(hP95, 1)}" rx="3" fill="#ffd166"/>
      <text x="${x + barWidth * 1.5 + 6}" y="${height - bottom - hP95 - 6}" fill="#9aa2b5" font-size="12" text-anchor="middle" font-family="Consolas">${stage.p95LatencyMs}</text>
      <text x="${x + barWidth + 3}" y="${height - 12}" fill="#8b93a7" font-size="13" text-anchor="middle">${stage.users} 并发</text>`;
  });
  return `<svg width="${width}" height="${height}">${bars}
    <line x1="${left}" y1="${height - bottom}" x2="${width - 10}" y2="${height - bottom}" stroke="#3a3f4e"/>
    <rect x="${left + 6}" y="4" width="12" height="12" fill="#4da3ff"/><text x="${left + 24}" y="15" fill="#9aa2b5" font-size="13">平均</text>
    <rect x="${left + 70}" y="4" width="12" height="12" fill="#ffd166"/><text x="${left + 88}" y="15" fill="#9aa2b5" font-size="13">P95</text>
  </svg>`;
}

function buildTimelineChart(results: BenchResults): string {
  const width = 836, height = 190, left = 56, bottom = 28, top = 14;
  const series: { stage: StageResult; rps: number; t: number }[] = [];
  let maxRps = 1;
  for (const stage of results.stages) {
    stage.perSecondRps.forEach((rps, index) => {
      series.push({ stage, rps, t: stage.secondsOffset + WARMUP_SEC + index });
      if (rps > maxRps) maxRps = rps;
    });
  }
  const totalSeconds = Math.max(...series.map(item => item.t), 1) + 1;
  const x = (t: number): number => left + (t / totalSeconds) * (width - left - 16);
  const y = (rps: number): number => height - bottom - (rps / (maxRps * 1.1)) * (height - top - bottom);
  const colors = ['#4da3ff', '#7bd88f', '#ffd166', '#ff8f6b'];
  let paths = '';
  let boundaries = '';
  results.stages.forEach((stage, index) => {
    const points = stage.perSecondRps.map((rps, second) => `${x(stage.secondsOffset + WARMUP_SEC + second).toFixed(1)},${y(rps).toFixed(1)}`).join(' ');
    paths += `<polyline points="${points}" fill="none" stroke="${colors[index % colors.length]}" stroke-width="2"/>`;
    const startX = x(stage.secondsOffset + WARMUP_SEC);
    boundaries += `<line x1="${startX}" y1="${top}" x2="${startX}" y2="${height - bottom}" stroke="#2f3340" stroke-dasharray="4 4"/>
      <text x="${startX + 4}" y="${top + 12}" fill="${colors[index % colors.length]}" font-size="12.5">${stage.users} 并发</text>`;
  });
  const grid = [0.5, 1].map(ratio => {
    const gy = height - bottom - ratio * (height - top - bottom);
    return `<line x1="${left}" y1="${gy}" x2="${width - 10}" y2="${gy}" stroke="#23262f"/>
      <text x="${left - 6}" y="${gy + 4}" fill="#6d7484" font-size="11" text-anchor="end" font-family="Consolas">${Math.round(maxRps * 1.1 * ratio).toLocaleString('en-US')}</text>`;
  }).join('');
  return `<svg width="${width}" height="${height}">${grid}${boundaries}${paths}
    <line x1="${left}" y1="${height - bottom}" x2="${width - 10}" y2="${height - bottom}" stroke="#3a3f4e"/>
    <text x="${width - 12}" y="${height - 10}" fill="#6d7484" font-size="11" text-anchor="end">秒（每阶段 ${results.durationSec}s 计时）</text>
  </svg>`;
}

// ---------- screenshot ----------

async function captureScreenshot(): Promise<void> {
  const candidates = [
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ];
  let edge = '';
  for (const candidate of candidates) {
    if (await fs.stat(candidate).then(() => true, () => false)) { edge = candidate; break; }
  }
  if (!edge) throw new Error('未找到 Microsoft Edge，无法生成报告截图。');
  const userDataDir = path.join(os.tmpdir(), `lb-bench-edge-${Date.now()}`);
  await fs.rm(reportPngPath, { force: true });
  await execFileAsync(edge, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=1920,1080`, `--user-data-dir=${userDataDir}`,
    '--virtual-time-budget=8000', `--screenshot=${reportPngPath}`, `file:///${reportHtmlPath.replaceAll('\\', '/')}`
  ], { windowsHide: true, timeout: 90000 });
  await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  const stat = await fs.stat(reportPngPath).catch(() => undefined);
  if (!stat || stat.size < 10000) throw new Error('Edge 截图失败或图片过小。');
}

// ---------- helpers ----------

async function reserveAvailablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法分配压测端口。');
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

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
