/**
 * AI Bridge stdio 传输稳定性验证。
 * 用途：在把 stdio 形态交付给外部 skill 之前，确认 stdio 通道可行、稳定、无残留宿主。
 * 运行：npm run smoke:ai-bridge-stdio -- --host=packaged --phases=purity,cycles,concurrent,orphan
 */
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

type Host = 'dev' | 'packaged';
type Permission = 'readonly' | 'preview' | 'yolo';

interface LaunchSpec {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

interface Options {
  host: Host;
  exe: string;
  workspace: string;
  permission: Permission;
  cycles: number;
  concurrency: number;
  eofTimeoutMs: number;
  orphanWaitMs: number;
  phases: string[];
  keepHostCopy: boolean;
}

const PROTOCOL_VERSION = '2024-11-05';
const EXPECTED_TOOL_COUNT = 23;

function parseArgs(argv: string[]): Options {
  const args = new Map<string, string | true>();
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const eq = item.indexOf('=');
    if (eq < 0) args.set(item.slice(2), true);
    else args.set(item.slice(2, eq), item.slice(eq + 1));
  }
  const host: Host = String(args.get('host') || 'dev') === 'packaged' ? 'packaged' : 'dev';
  const defaultExe = path.resolve(import.meta.dirname, '..', 'release', 'win-unpacked', 'LingBuilder.exe');
  const phases = String(args.get('phases') || 'purity,cycles,concurrent,orphan')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const rawPermission = String(args.get('permission') || (phases.includes('build') ? 'yolo' : 'preview'));
  const permission: Permission = rawPermission === 'readonly' || rawPermission === 'yolo' ? rawPermission : 'preview';
  return {
    host,
    exe: String(args.get('exe') || defaultExe),
    workspace: path.resolve(String(args.get('workspace') || fs.mkdtempSync(path.join(os.tmpdir(), 'lb-stdio-')))),
    permission,
    cycles: Number(args.get('cycles') || 8),
    concurrency: Number(args.get('concurrency') || 3),
    eofTimeoutMs: Number(args.get('eof-timeout-ms') || 3000),
    orphanWaitMs: Number(args.get('orphan-wait-ms') || 15000),
    phases,
    keepHostCopy: args.get('keep-host-copy') === true
  };
}

function buildLaunch(options: Options, overrides: { workspaceRoot?: string; permission?: Permission; command?: string } = {}): LaunchSpec {
  const electronRoot = path.resolve(import.meta.dirname, '..');
  const workspaceRoot = overrides.workspaceRoot || options.workspace;
  const permission = overrides.permission || options.permission;
  if (options.host === 'packaged') {
    const exe = overrides.command || options.exe;
    const cliEntry = path.join(path.dirname(exe), 'resources', 'app.asar', 'dist', 'cli.cjs');
    return {
      command: exe,
      args: [cliEntry, 'ai-server', '--workspace', workspaceRoot, '--permission', permission, '--mcp', '--stdio-only'],
      cwd: path.dirname(exe),
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    };
  }
  return {
    command: overrides.command || process.execPath,
    args: ['--import', 'tsx', path.join(electronRoot, 'src', 'cli.ts'), 'ai-server', '--workspace', workspaceRoot, '--permission', permission, '--mcp', '--stdio-only'],
    cwd: electronRoot,
    env: { ...process.env }
  };
}

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string };
}

/** 手写 newline-delimited JSON-RPC 客户端：需要原样拿到 stdout 才能判断传输是否被污染。 */
class StdioMcpClient {
  private child!: ChildProcess;
  private nextId = 1;
  private buffer = '';
  private stderrText = '';
  private exitInfo: { code: number | null; signal: string | null } | null = null;
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
  stdoutLineCount = 0;
  pollutedLines: string[] = [];

  constructor(private readonly launch: LaunchSpec, readonly label: string) {}

  get pid(): number | undefined {
    return this.child?.pid;
  }

  get exited(): boolean {
    return this.exitInfo !== null;
  }

  get stderr(): string {
    return this.stderrText;
  }

  async start(): Promise<void> {
    this.child = spawn(this.launch.command, this.launch.args, {
      cwd: this.launch.cwd,
      env: this.launch.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    this.child.once('exit', (code, signal) => {
      this.exitInfo = { code, signal };
      for (const [, handler] of this.pending) handler.reject(new Error(`${this.label} 子进程已退出：code=${code} signal=${signal}`));
      this.pending.clear();
    });
    this.child.stdout!.setEncoding('utf8');
    this.child.stdout!.on('data', chunk => this.onStdout(String(chunk)));
    this.child.stderr!.setEncoding('utf8');
    this.child.stderr!.on('data', chunk => { this.stderrText += String(chunk); });
  }

  private onStdout(text: string): void {
    this.buffer += text;
    let index = this.buffer.indexOf('\n');
    while (index >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (line) this.consumeLine(line);
      index = this.buffer.indexOf('\n');
    }
  }

  private consumeLine(line: string): void {
    this.stdoutLineCount += 1;
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      this.pollutedLines.push(line.slice(0, 400));
      return;
    }
    if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') {
      this.pollutedLines.push(line.slice(0, 400));
      return;
    }
    if (typeof message.id === 'number') {
      const handler = this.pending.get(message.id);
      if (!handler) return;
      this.pending.delete(message.id);
      if (message.error) handler.reject(new Error(message.error.message || 'MCP 调用失败'));
      else handler.resolve(message.result);
      return;
    }
  }

  request<T = Record<string, unknown>>(method: string, params?: unknown, timeoutMs = 60_000): Promise<T> {
    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${this.label} ${method} 超时 ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value as T); },
        reject: reason => { clearTimeout(timer); reject(reason); }
      });
      this.child.stdin!.write(`${payload}\n`, error => {
        if (!error) return;
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  notify(method: string, params?: unknown): void {
    this.child.stdin!.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  async initialize(): Promise<{ tools: number; instructionsChars: number }> {
    const started = Date.now();
    const initResult = await this.request<{ instructions?: string }>('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'lingbuilder-stdio-stress', version: '1.0.0' }
    }, 90_000);
    this.notify('notifications/initialized');
    const listed = await this.request<{ tools: Array<{ name: string }> }>('tools/list', {}, 30_000);
    return { tools: listed.tools.length, instructionsChars: initResult.instructions?.length ?? 0 };
  }

  closeStdin(): void {
    try { this.child.stdin!.end(); } catch { /* 已关闭 */ }
  }

  kill(): void {
    try { this.child.kill('SIGKILL'); } catch { /* 已退出 */ }
  }

  async waitForExit(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.exited) return true;
      await sleep(100);
    }
    return this.exited;
  }
}

async function isProcessAlive(pid: number): Promise<boolean> {
  if (process.platform === 'win32') {
    const output = await runCommand('tasklist.exe', ['/FI', `PID eq ${pid}`, '/NH']);
    return new RegExp(`\\b${pid}\\b`).test(output);
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise(resolve => {
    execFile(command, args, { windowsHide: true }, (error, stdout) => resolve(error ? '' : stdout));
  });
}

const reports: Array<{ name: string; ok: boolean; detail: string }> = [];
const trackedPids = new Set<number>();

function record(name: string, ok: boolean, detail: string): void {
  reports.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function toolPayload(result: unknown): Record<string, any> {
  const content = (result as { content?: Array<{ text?: string }> })?.content;
  const text = content?.[0]?.text;
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, any>;
  } catch {
    return { rawText: text.slice(0, 2000) };
  }
}

function unwrap(payload: Record<string, any>): Record<string, any> {
  return (payload?.result && typeof payload.result === 'object' ? payload.result : payload) as Record<string, any>;
}

async function phasePurity(options: Options): Promise<void> {
  const client = new StdioMcpClient(buildLaunch(options), 'purity');
  await client.start();
  if (client.pid) trackedPids.add(client.pid);
  const info = await client.initialize();
  record('tools/list 数量', info.tools === EXPECTED_TOOL_COUNT, `实际 ${info.tools}（约定 ${EXPECTED_TOOL_COUNT}），instructions ${info.instructionsChars} 字符`);

  const latencies: number[] = [];
  let failures = 0;
  for (let i = 0; i < 20; i += 1) {
    const started = Date.now();
    const result = await client.request('tools/call', { name: 'lingbuilder.workspace.list', arguments: {} }, 30_000).catch(() => null);
    if (!result) failures += 1;
    latencies.push(Date.now() - started);
  }
  record('只读调用 20 次', failures === 0, `失败 ${failures}，p50 ${percentile(latencies, 0.5)}ms，max ${percentile(latencies, 1)}ms`);

  const search = await client.request('tools/call', { name: 'lingbuilder.file.search', arguments: { query: 'lingbuilder', maxResults: 5 } }, 30_000)
    .then(() => 'ok').catch(error => (error as Error).message);
  const stillUsable = await client.request('tools/call', { name: 'lingbuilder.workspace.list', arguments: {} }, 30_000).then(() => true).catch(() => false);
  record('调用异常不摧毁会话', stillUsable, `search=${search}，后续调用=${stillUsable ? '正常' : '失败'}`);

  const stderrHasReady = /LINGBUILDER_AI_BRIDGE_READY/u.test(client.stderr);
  record('stderr 携带 READY 行', stderrHasReady, stderrHasReady ? '可被宿主解析' : `缺失：${client.stderr.slice(0, 200)}`);
  record('stdout 传输纯净（无杂散输出）', client.pollutedLines.length === 0,
    client.pollutedLines.length ? `污染 ${client.pollutedLines.length} 行，例如：${client.pollutedLines[0]}` : `${client.stdoutLineCount} 行全部为合法 JSON-RPC`);
  client.kill();
  await client.waitForExit(5000);
}

async function phaseCycles(options: Options): Promise<void> {
  const latencies: number[] = [];
  let eofExited = 0;
  let lingering = 0;
  for (let i = 0; i < options.cycles; i += 1) {
    const client = new StdioMcpClient(buildLaunch(options), `cycle-${i}`);
    await client.start();
    const pid = client.pid;
    if (pid) trackedPids.add(pid);
    const started = Date.now();
    try {
      await client.initialize();
      latencies.push(Date.now() - started);
    } catch (error) {
      record(`周期 ${i} 握手`, false, (error as Error).message);
      client.kill();
      await client.waitForExit(5000);
      continue;
    }
    client.closeStdin();
    if (await client.waitForExit(options.eofTimeoutMs)) eofExited += 1;
    else {
      if (pid && await isProcessAlive(pid)) lingering += 1;
      client.kill();
      await client.waitForExit(5000);
    }
  }
  record(`关闭 stdin 后自动退出（${options.cycles} 轮）`, eofExited === options.cycles,
    `正常退出 ${eofExited}/${options.cycles}，EOF 后仍存活 ${lingering}；握手 p50 ${percentile(latencies, 0.5)}ms max ${percentile(latencies, 1)}ms`);
}

async function phaseConcurrent(options: Options): Promise<void> {
  const clients: StdioMcpClient[] = [];
  for (let i = 0; i < options.concurrency; i += 1) {
    const client = new StdioMcpClient(buildLaunch(options), `concurrent-${i}`);
    await client.start();
    if (client.pid) trackedPids.add(client.pid);
    clients.push(client);
  }
  const results = await Promise.allSettled(clients.map(client => client.initialize()));
  const connected = results.filter(item => item.status === 'fulfilled').length;
  record(`${options.concurrency} 会话并发握手`, connected === options.concurrency, `成功 ${connected}/${options.concurrency}`);

  const calls = await Promise.allSettled(clients.map(client => client.request('tools/call', { name: 'lingbuilder.workspace.list', arguments: {} }, 30_000)));
  const callOk = calls.filter(item => item.status === 'fulfilled').length;
  record('并发调用互不串扰', callOk === options.concurrency, `成功 ${callOk}/${options.concurrency}`);

  clients.forEach(client => client.kill());
  await Promise.all(clients.map(client => client.waitForExit(8000)));
}

async function phaseOrphan(options: Options): Promise<void> {
  const launch = buildLaunch(options);
  const wrapperSource = [
    "const { spawn } = require('node:child_process');",
    `const child = spawn(${JSON.stringify(launch.command)}, ${JSON.stringify(launch.args)}, { cwd: ${JSON.stringify(launch.cwd)}, env: ${JSON.stringify(launch.env)}, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });`,
    "child.stdout.on('data', () => {});",
    "child.stderr.on('data', () => {});",
    "child.stdin.on('error', () => {});",
    "process.stdout.write('CHILD ' + child.pid + '\\n');",
    'setInterval(() => {}, 1000);'
  ].join('\n');
  const wrapper = spawn(process.execPath, ['-e', wrapperSource], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const childPid = await new Promise<number>((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(new Error(`包装宿主未上报子进程 PID：${text}`)), 90_000);
    timer.unref();
    wrapper.stdout!.setEncoding('utf8');
    wrapper.stdout!.on('data', chunk => {
      text += String(chunk);
      const match = text.match(/CHILD (\d+)/u);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    wrapper.once('error', error => { clearTimeout(timer); reject(error); });
  });
  trackedPids.add(childPid);
  wrapper.kill('SIGKILL');
  await sleep(options.orphanWaitMs);
  const stillAlive = await isProcessAlive(childPid);
  record(`客户端被强杀后宿主不残留（等待 ${options.orphanWaitMs / 1000}s）`, !stillAlive, stillAlive
    ? `宿主 PID ${childPid} 仍在运行：管道断裂后无人回收`
    : `宿主 PID ${childPid} 已随客户端退出`);
  if (stillAlive) await runCommand('taskkill.exe', ['/PID', String(childPid), '/F']);
}

async function phasePackagedAlias(options: Options): Promise<void> {
  const dir = path.dirname(options.exe);
  const alias = path.join(dir, 'lingbuilder-cli.exe');
  const cliEntry = path.join(dir, 'resources', 'app.asar', 'dist', 'cli.cjs');
  if (fs.existsSync(alias)) {
    record('宿主改名副本', false, `${alias} 已存在，先手工清理后重跑`);
    return;
  }
  const linkOutput = await runCommand('cmd.exe', ['/c', 'mklink', '/H', alias, options.exe]);
  if (!fs.existsSync(alias)) {
    record('宿主改名副本', false, `硬链接创建失败：${linkOutput.trim() || '无输出'}`);
    return;
  }
  try {
    const version = await new Promise<string>((resolve, reject) => {
      execFile(alias, [cliEntry, '--version'], { cwd: dir, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true },
        (error, stdout) => (error ? reject(error) : resolve(stdout.trim())));
    });
    record('改名副本可独立跑 CLI', /LingBuilder CLI/u.test(version), version || '无输出');

    const client = new StdioMcpClient(buildLaunch(options, { command: alias }), 'alias-host');
    await client.start();
    if (client.pid) trackedPids.add(client.pid);
    const info = await client.initialize();
    record('改名副本完成 stdio 握手', info.tools === EXPECTED_TOOL_COUNT, `工具数 ${info.tools}，进程名与 IDE 主程序已脱钩`);
    client.kill();
    await client.waitForExit(5000);
  } catch (error) {
    record('改名副本可用', false, (error as Error).message);
  } finally {
    if (!options.keepHostCopy) fs.rmSync(alias, { force: true });
  }
}

async function phaseLock(options: Options): Promise<void> {
  const asar = path.join(path.dirname(options.exe), 'resources', 'app.asar');
  if (!fs.existsSync(asar)) {
    record('app.asar 占用探测', false, `${asar} 不存在`);
    return;
  }
  const client = new StdioMcpClient(buildLaunch(options), 'lock-probe');
  await client.start();
  if (client.pid) trackedPids.add(client.pid);
  await client.initialize();
  let blocked = '';
  try {
    const handle = fs.openSync(asar, 'r+');
    fs.closeSync(handle);
  } catch (error) {
    blocked = (error as NodeJS.ErrnoException).code || String(error);
  }
  record('宿主存活期间 app.asar 可写开', !blocked, blocked ? `被占用：${blocked}（安装器改名/覆盖会失败）` : '以 r+ 打开成功，未被独占');
  client.kill();
  await client.waitForExit(5000);
}

async function phaseBuild(options: Options): Promise<void> {
  const client = new StdioMcpClient(buildLaunch(options, { permission: 'yolo' }), 'build-chain');
  await client.start();
  if (client.pid) trackedPids.add(client.pid);
  await client.initialize();

  const created = unwrap(toolPayload(await client.request('tools/call', {
    name: 'lingbuilder.project.create',
    arguments: { name: 'stdio_probe', templateId: 'hello-window', approved: true }
  }, 180_000)));
  const projectId: string = String(created?.project?.id || created?.id || '');
  const fileList: string[] = Array.isArray(created?.files)
    ? created.files.map((file: any) => String(file?.path || file?.filePath || ''))
    : [];
  const sourceFile = fileList.find(file => file.endsWith('.lcpp')) || '';
  record('project.create 落盘', Boolean(projectId), `projectId=${projectId || '空'}，源码文件=${sourceFile || JSON.stringify(Object.keys(created)).slice(0, 200)}`);
  if (!projectId) {
    client.kill();
    await client.waitForExit(5000);
    return;
  }

  const diagPath = sourceFile || `src/${projectId}/MainWindow.lcpp`;
  const diagnostics = unwrap(toolPayload(await client.request('tools/call', {
    name: 'lingbuilder.lingcpp.diagnostics',
    arguments: { filePath: diagPath, projectId }
  }, 90_000)));
  const errorCount = ((diagnostics?.diagnostics || []) as Array<{ severity?: string }>).filter(item => item.severity === 'error').length;
  record('diagnostics 无 error', errorCount === 0, `error ${errorCount} 条；响应 keys=${Object.keys(diagnostics).join(',')}`);

  const absoluteSource = path.join(options.workspace, diagPath);
  const sourceExists = fs.existsSync(absoluteSource);
  let proposalOk = false;
  let proposalDetail = '源码文件不存在，跳过提案';
  if (sourceExists) {
    const lines = fs.readFileSync(absoluteSource, 'utf8').split(/\r?\n/u);
    const target = Math.max(1, lines.length - 1);
    const proposal = unwrap(toolPayload(await client.request('tools/call', {
      name: 'lingbuilder.edit.propose',
      arguments: {
        filePath: diagPath,
        instruction: 'append an embedded C++ marker line',
        projectId,
        files: [{ filePath: diagPath, edits: [{ startLine: target, newText: `${lines[target - 1]}\n@ // stdio probe marker` }] }]
      }
    }, 90_000)));
    const proposalId = String(proposal?.proposal?.id || proposal?.id || proposal?.proposalId || '');
    proposalOk = Boolean(proposalId);
    proposalDetail = proposalId ? `proposalId=${proposalId}` : JSON.stringify(proposal).slice(0, 400);
    if (proposalId) {
      await client.request('tools/call', { name: 'lingbuilder.edit.apply', arguments: { proposalId, approved: true } }, 120_000);
      proposalOk = fs.readFileSync(absoluteSource, 'utf8').includes('stdio probe marker');
      proposalDetail = `${proposalDetail}；apply 后磁盘${proposalOk ? '已含' : '未含'}标记行`;
    }
  }
  record('edit.propose/apply 写盘生效', proposalOk, proposalDetail);

  const built = unwrap(toolPayload(await client.request('tools/call', {
    name: 'lingbuilder.build.run',
    arguments: { projectId, run: false, approved: true }
  }, 600_000)));
  const builtOk = built?.ok === true || built?.status === 'succeeded' || built?.success === true;
  record('build.run 编译通过', Boolean(builtOk), builtOk ? `keys=${Object.keys(built).join(',')}` : JSON.stringify(built).slice(0, 800));

  await client.request('tools/call', { name: 'lingbuilder.build.stop', arguments: { projectId } }, 30_000).catch(() => undefined);
  record('构建全程 stdout 未被污染', client.pollutedLines.length === 0,
    client.pollutedLines.length ? `污染 ${client.pollutedLines.length} 行：${client.pollutedLines.slice(0, 3).join(' | ')}` : `${client.stdoutLineCount} 行全部合法`);
  client.kill();
  await client.waitForExit(8000);
}

/**
 * 用硬链接名探测 app.asar 是否被宿主句柄挡住改名/删除（NSIS 安装失败的真实语义）。
 * 全程只创建并重命名我们自己的链接名，绝不触碰 app.asar 本身。
 */
async function tryRenameProbe(dir: string): Promise<{ ok: boolean; code: string }> {
  const target = path.join(dir, 'resources', 'app.asar');
  const link = path.join(dir, 'resources', 'app.asar.renameprobe');
  const moved = path.join(dir, 'resources', 'app.asar.renameprobe2');
  fs.rmSync(link, { force: true });
  fs.rmSync(moved, { force: true });
  const made = await runCommand('cmd.exe', ['/c', 'mklink', '/H', link, target]);
  if (!fs.existsSync(link)) return { ok: false, code: `硬链接创建失败：${made.trim() || '无输出'}` };
  try {
    fs.renameSync(link, moved);
    return { ok: true, code: '' };
  } catch (error) {
    return { ok: false, code: (error as NodeJS.ErrnoException).code || String(error) };
  } finally {
    fs.rmSync(moved, { force: true });
    fs.rmSync(link, { force: true });
  }
}

async function phaseAsarRenameLock(options: Options): Promise<void> {
  const dir = path.dirname(options.exe);
  const baseline = await tryRenameProbe(dir);
  record('基线：宿主未运行时 app.asar 可改名', baseline.ok, baseline.ok ? '硬链接改名成功，探测手段有效' : `失败：${baseline.code}`);
  if (!baseline.ok) return;

  const client = new StdioMcpClient(buildLaunch(options), 'rename-probe');
  await client.start();
  if (client.pid) trackedPids.add(client.pid);
  await client.initialize();
  const withHost = await tryRenameProbe(dir);
  record('宿主存活时 app.asar 可改名（决定改名宿主是否必要）', withHost.ok,
    withHost.ok ? '未被宿主句柄阻止：node 模式 stdio 宿主不影响安装器改名' : `被阻止：${withHost.code}（stdio 宿主仍会挡安装，需把 CLI 移出 app.asar 或用改名副本）`);
  client.kill();
  await client.waitForExit(5000);
}

async function phaseRun(options: Options): Promise<void> {
  const client = new StdioMcpClient(buildLaunch(options, { permission: 'yolo' }), 'run-chain');
  await client.start();
  if (client.pid) trackedPids.add(client.pid);
  await client.initialize();

  const created = unwrap(toolPayload(await client.request('tools/call', {
    name: 'lingbuilder.project.create',
    arguments: { name: 'stdio_run_probe', templateId: 'windows-console', approved: true }
  }, 180_000)));
  const projectId = String(created?.project?.id || created?.id || '');
  record('控制台项目创建', Boolean(projectId), `projectId=${projectId || JSON.stringify(Object.keys(created)).slice(0, 200)}`);
  if (!projectId) {
    client.kill();
    await client.waitForExit(5000);
    return;
  }

  const built = unwrap(toolPayload(await client.request('tools/call', {
    name: 'lingbuilder.build.run',
    arguments: { projectId, run: true, approved: true }
  }, 600_000)));
  const runInfo = built?.run || built?.process || built;
  record('build.run 带 run 启动', built?.ok === true, `keys=${Object.keys(built).join(',')}；run=${JSON.stringify(runInfo).slice(0, 200)}`);

  const waited = unwrap(toolPayload(await client.request('tools/call', {
    name: 'lingbuilder.run.wait',
    arguments: { projectId, timeoutSeconds: 60 }
  }, 120_000)));
  const exitCode = waited?.exitCode ?? waited?.code;
  record('run.wait 拿到退出码', typeof exitCode === 'number' && waited?.running !== true, `running=${waited?.running}，exitCode=${exitCode}，keys=${Object.keys(waited).join(',')}`);

  const logged = unwrap(toolPayload(await client.request('tools/call', {
    name: 'lingbuilder.run.log',
    arguments: { projectId, tailLines: 50 }
  }, 60_000)));
  const logText = String(logged?.log ?? logged?.output ?? JSON.stringify(logged).slice(0, 400));
  record('run.log 读回运行输出', logText.trim().length > 0, `长度 ${logText.length}，开头：${logText.slice(0, 120).replace(/\r?\n/gu, ' / ')}`);

  await client.request('tools/call', { name: 'lingbuilder.build.stop', arguments: { projectId } }, 30_000).catch(() => undefined);
  record('运行链 stdout 未被污染', client.pollutedLines.length === 0,
    client.pollutedLines.length ? `污染 ${client.pollutedLines.length} 行：${client.pollutedLines.slice(0, 3).join(' | ')}` : `${client.stdoutLineCount} 行全部合法`);
  client.kill();
  await client.waitForExit(8000);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(options.workspace, { recursive: true });
  if (options.host === 'packaged' && !fs.existsSync(options.exe)) {
    console.error(`打包宿主不存在：${options.exe}`);
    process.exitCode = 1;
    return;
  }
  const launch = buildLaunch(options);
  console.log(`宿主形态：${options.host}`);
  console.log(`启动命令：${launch.command}`);
  console.log(`参数：${launch.args.join(' ')}`);
  console.log(`工作区：${options.workspace}`);
  console.log(`阶段：${options.phases.join(', ')}\n`);

  if (options.phases.includes('purity')) await phasePurity(options);
  if (options.phases.includes('cycles')) await phaseCycles(options);
  if (options.phases.includes('concurrent')) await phaseConcurrent(options);
  if (options.phases.includes('orphan')) await phaseOrphan(options);
  if (options.phases.includes('alias')) {
    if (options.host === 'packaged') await phasePackagedAlias(options);
    else console.log('SKIP  alias — 仅打包宿主形态适用');
  }
  if (options.phases.includes('lock')) {
    if (options.host === 'packaged') await phaseLock(options);
    else console.log('SKIP  lock — 仅打包宿主形态适用');
  }
  if (options.phases.includes('rename-lock')) {
    if (options.host === 'packaged') await phaseAsarRenameLock(options);
    else console.log('SKIP  rename-lock — 仅打包宿主形态适用');
  }
  if (options.phases.includes('build')) await phaseBuild(options);
  if (options.phases.includes('run')) await phaseRun(options);

  let leftovers = 0;
  for (const pid of trackedPids) {
    if (!await isProcessAlive(pid)) continue;
    leftovers += 1;
    await runCommand('taskkill.exe', ['/PID', String(pid), '/F']);
  }
  record('收尾无残留宿主', leftovers === 0, leftovers ? `强制清理残留 ${leftovers} 个` : `跟踪 ${trackedPids.size} 个子进程全部退出`);

  const failed = reports.filter(item => !item.ok);
  console.log(`\n合计 ${reports.length} 项，失败 ${failed.length} 项`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || String(error) : String(error));
  process.exitCode = 1;
});
