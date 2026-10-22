import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 编译器探测唯一实现（F5/生成项目路由、AI Bridge build.run、EdgeView 控件预览共用）。
 *
 * 2026-10-21 用户反馈定案：旧实现（server.ts / aiBridgeService.ts 各一份复制）单次探测、
 * 任何一步失败都被静默吞掉，杀软拦截 cmd.exe/vswhere.exe 或 VS Installer 后台自更新等
 * 瞬时故障会被误报成「未检测到可用 C++ 编译器，请安装…」，用户重试 2~3 次才成功。
 * 本模块提供：进程内成功缓存（按架构）、全链失败自动重试、每步命令/退出码/耗时明细、
 * VS2026（目录名 18）回退路径、面向用户的中文诊断输出。
 */

export type CompilerKind = 'msvc' | 'g++' | 'clang++';
export type CompilerArchitecture = 'win32' | 'x64';

export interface DetectedCompiler {
  kind: CompilerKind;
  command: string;
  setupBatch?: string;
  /** MSVC 目标架构；PATH 里的 cl 一律按 x64 口径上报（与 AI Bridge 既有约定一致）。 */
  arch?: CompilerArchitecture;
}

export interface CompilerProbeStep {
  /** 第几次完整尝试（1 起）。 */
  attempt: number;
  /** 步骤中文名，如「vswhere 查询 Visual Studio 安装路径」。 */
  label: string;
  command: string;
  ok: boolean;
  /** null = 进程没有正常退出（启动失败或超时被杀），属异常而非「未安装」。 */
  exitCode: number | null;
  /** spawn 错误码（ENOENT/EPERM/EACCES…）或 'timeout'。 */
  error?: string;
  durationMs: number;
  /** 步骤结论补充，例如找到的安装路径、「未安装属正常」。 */
  detail?: string;
}

export interface CompilerDetectionOutcome {
  compiler: DetectedCompiler | null;
  /** 命中进程内缓存时为 true（steps 为空）。 */
  fromCache: boolean;
  attempts: number;
  /** 全部尝试的步骤明细，失败时用于构建日志。 */
  steps: CompilerProbeStep[];
  elapsedMs: number;
}

export interface CompilerCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface CompilerCommandOptions {
  timeoutMs: number;
  windowsVerbatimArguments?: boolean;
}

export type CompilerCommandRunner = (
  command: string,
  args: readonly string[],
  options: CompilerCommandOptions
) => Promise<CompilerCommandResult>;

export interface CompilerDetectionOptions {
  /** 构建配置目标架构；缺省按 AI Bridge 既有口径（PATH cl 视为 x64，vcvars 优先 vcvars64）。 */
  architecture?: CompilerArchitecture;
  environment?: NodeJS.ProcessEnv;
  /** 全链失败后的额外重试次数；缺省 1（共尝试 2 次）。传 0 保持旧的单次行为。 */
  retryAttempts?: number;
  retryDelayMs?: number;
  commandRunner?: CompilerCommandRunner;
  fileExists?: (candidate: string) => Promise<boolean>;
  delay?: (ms: number) => Promise<void>;
}

interface MsvcSetupBatchDeps {
  environment: NodeJS.ProcessEnv;
  commandRunner: CompilerCommandRunner;
  fileExists: (candidate: string) => Promise<boolean>;
}

/** 步骤明细收集器；缺省（如 AI Bridge 显式 arch 包装）时只探测不记录。 */
interface StepRecorder {
  attempt: number;
  steps: CompilerProbeStep[];
  now: () => number;
}

const DETECT_TIMEOUT_MS = 4_000;
const VSWHERE_TIMEOUT_MS = 5_000;
const VCVARS_VERIFY_TIMEOUT_MS = 20_000;
// Visual Studio 目录名按内部版本号递增（2026 为 "18"），不能只枚举年份。
const VS_VERSION_DIRECTORIES = ['18', '2022', '2019'];
const VS_EDITION_DIRECTORIES = ['Community', 'Professional', 'Enterprise', 'BuildTools'];

export const runCompilerCommand: CompilerCommandRunner = async (command, args, options = { timeoutMs: DETECT_TIMEOUT_MS }) => {
  return await new Promise(resolve => {
    execFile(command, [...args], {
      timeout: options.timeoutMs,
      windowsHide: true,
      windowsVerbatimArguments: options.windowsVerbatimArguments,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024
    }, (error, stdout, stderr) => {
      const stdoutText = String(stdout || '');
      const stderrText = String(stderr || '');
      if (!error) {
        resolve({ exitCode: 0, stdout: stdoutText, stderr: stderrText });
        return;
      }
      const normalized = error as NodeJS.ErrnoException & { killed?: boolean };
      if (typeof normalized.code === 'number') {
        resolve({ exitCode: normalized.code, stdout: stdoutText, stderr: stderrText });
        return;
      }
      resolve({
        exitCode: null,
        stdout: stdoutText,
        stderr: stderrText,
        error: normalized.killed
          ? 'timeout'
          : typeof normalized.code === 'string' ? normalized.code : 'unknown'
      });
    });
  });
};

// 成功结果按架构缓存；只缓存成功、不缓存失败。并发构建共享同一次在途探测，
// 避免解决方案并行构建时同时拉起多个 cmd.exe/vcvars（放大杀软拦截面）。
const cachedCompilers = new Map<string, DetectedCompiler>();
const inFlightDetections = new Map<string, Promise<CompilerDetectionOutcome>>();

/** 编译失败（尤其 MSVC 链接类失败）后调用：下一次探测强制重走全链，防止 VS 升级/卸载后拿着失效路径反复失败。 */
export function invalidateCachedCompiler(architecture?: CompilerArchitecture): void {
  if (architecture) {
    cachedCompilers.delete(architecture);
    return;
  }
  cachedCompilers.clear();
}

export async function detectCompilerDetailed(
  options: CompilerDetectionOptions = {}
): Promise<CompilerDetectionOutcome> {
  const cacheKey = options.architecture ?? 'default';
  const cached = cachedCompilers.get(cacheKey);
  if (cached) {
    return { compiler: cached, fromCache: true, attempts: 0, steps: [], elapsedMs: 0 };
  }

  const inFlight = inFlightDetections.get(cacheKey);
  if (inFlight) return await inFlight;

  const detection = performDetectionWithRetry(options).then(outcome => {
    inFlightDetections.delete(cacheKey);
    if (outcome.compiler) cachedCompilers.set(cacheKey, outcome.compiler);
    return outcome;
  }, error => {
    inFlightDetections.delete(cacheKey);
    throw error;
  });
  inFlightDetections.set(cacheKey, detection);
  return await detection;
}

async function performDetectionWithRetry(options: CompilerDetectionOptions): Promise<CompilerDetectionOutcome> {
  const retryAttempts = Math.max(0, Math.trunc(options.retryAttempts ?? 1));
  const retryDelayMs = Math.max(0, Math.trunc(options.retryDelayMs ?? 500));
  const delay = options.delay || ((ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); }));
  const startedAt = Date.now();
  const steps: CompilerProbeStep[] = [];
  let attempts = 0;

  for (let attempt = 1; attempt <= retryAttempts + 1; attempt += 1) {
    attempts = attempt;
    if (attempt > 1 && retryDelayMs > 0) await delay(retryDelayMs);
    const compiler = await performDetectionOnce(options, attempt, steps);
    if (compiler) {
      return { compiler, fromCache: false, attempts, steps, elapsedMs: Date.now() - startedAt };
    }
  }

  return { compiler: null, fromCache: false, attempts, steps, elapsedMs: Date.now() - startedAt };
}

async function performDetectionOnce(
  options: CompilerDetectionOptions,
  attempt: number,
  steps: CompilerProbeStep[]
): Promise<DetectedCompiler | null> {
  const recorder: StepRecorder = { attempt, steps, now: Date.now };
  const deps: MsvcSetupBatchDeps = {
    environment: options.environment || process.env,
    commandRunner: options.commandRunner || runCompilerCommand,
    fileExists: options.fileExists || (async candidate => {
      try { await fs.stat(candidate); return true; } catch { return false; }
    })
  };
  const architecture = options.architecture;

  // x64 构建优先走 vcvars64（PATH 里的 cl 极少见且无法区分位数）。旧实现在这条路径之后
  // 还会把同一探测原样重跑一遍，已合并：x64 的 vcvars 尝试只做一次，重试交给外层。
  if (architecture === 'x64') {
    const compiler = await tryMsvcViaSetupBatch(deps, recorder, 'x64');
    if (compiler) return compiler;
  }

  const pathCompiler = await tryCompilerOnPath(deps, recorder);
  if (pathCompiler) return pathCompiler;

  if (architecture !== 'x64') {
    const fallbackCompiler = await tryMsvcViaSetupBatch(deps, recorder, architecture ?? 'x64');
    if (fallbackCompiler) return fallbackCompiler;
  }

  const gpp = await tryAlternativeCompiler(deps, recorder, 'g++');
  if (gpp) return gpp;
  return await tryAlternativeCompiler(deps, recorder, 'clang++');
}

async function tryCompilerOnPath(deps: MsvcSetupBatchDeps, recorder: StepRecorder): Promise<DetectedCompiler | null> {
  const step = await runRecordedStep(recorder, deps.commandRunner, 'cl.exe PATH 探测', 'where.exe', ['cl.exe'], DETECT_TIMEOUT_MS, async run => {
    if (run.exitCode === 0 && firstPathLine(run.stdout)) {
      return { ok: true, detail: 'cl.exe 已在 PATH 中' };
    }
    return { ok: false, detail: 'PATH 中没有 cl.exe（正常，MSVC 通常不加入 PATH）' };
  });
  if (!step?.ok) return null;
  return { kind: 'msvc', command: 'cl', arch: 'x64' };
}

async function tryAlternativeCompiler(
  deps: MsvcSetupBatchDeps,
  recorder: StepRecorder,
  command: 'g++' | 'clang++'
): Promise<DetectedCompiler | null> {
  const step = await runRecordedStep(recorder, deps.commandRunner, `${command} 探测`, command, ['--version'], DETECT_TIMEOUT_MS, async run => {
    if (run.exitCode === 0) return { ok: true, detail: `${command} 可用` };
    return { ok: false, detail: `PATH 中没有 ${command}（未安装属正常）` };
  });
  if (!step?.ok) return null;
  return { kind: command, command };
}

async function tryMsvcViaSetupBatch(
  deps: MsvcSetupBatchDeps,
  recorder: StepRecorder,
  architecture: CompilerArchitecture
): Promise<DetectedCompiler | null> {
  const setupBatch = await findMsvcSetupBatch(architecture, deps, recorder);
  if (!setupBatch) return null;
  const step = await runRecordedStep(
    recorder,
    deps.commandRunner,
    `${path.basename(setupBatch)} 环境验证`,
    'cmd.exe',
    ['/d', '/c', `call ${quoteCmdArg(setupBatch)} >nul && where cl >nul`],
    VCVARS_VERIFY_TIMEOUT_MS,
    async run => {
      if (run.exitCode === null && run.error === 'timeout') {
        return { ok: false, detail: '等待超时；常见于首次冷启动被杀毒软件逐文件扫描' };
      }
      if (run.exitCode === null) {
        return { ok: false, detail: '进程启动失败；常见于杀毒软件拦截 cmd.exe' };
      }
      if (run.exitCode !== 0) {
        return { ok: false, detail: 'vcvars 环境初始化或 where cl 失败' };
      }
      return { ok: true, detail: 'cl.exe 经 vcvars 环境验证可用' };
    },
    true
  );
  if (!step?.ok) return null;
  return { kind: 'msvc', command: 'cl', setupBatch, arch: architecture };
}

/**
 * 定位 MSVC 环境初始化批处理：vswhere 优先（限定 C++ 工具集，未命中再放开限定），
 * 失败回退常见安装目录（含 VS2026 目录名 18）。
 */
export async function findMsvcSetupBatch(
  architecture: CompilerArchitecture,
  deps?: Partial<MsvcSetupBatchDeps>,
  recorder?: StepRecorder
): Promise<string | null> {
  const resolved: MsvcSetupBatchDeps = {
    environment: deps?.environment || process.env,
    commandRunner: deps?.commandRunner || runCompilerCommand,
    fileExists: deps?.fileExists || (async candidate => {
      try { await fs.stat(candidate); return true; } catch { return false; }
    })
  };

  const installPaths = new Set<string>();
  const vswherePath = await locateVsWhereExecutable(resolved);
  if (vswherePath) {
    for (const query of [
      ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'],
      // 兜底：不限定 C++ 工作负载也允许解析出安装路径（验证阶段仍要求 where cl 成功）。
      ['-latest', '-products', '*', '-property', 'installationPath']
    ]) {
      let installationPath: string | null = null;
      await runRecordedStep(
        recorder,
        resolved.commandRunner,
        'vswhere 查询 Visual Studio 安装路径',
        vswherePath,
        query,
        VSWHERE_TIMEOUT_MS,
        async run => {
          const found = firstPathLine(run.stdout);
          if (run.exitCode === 0 && found) {
            installationPath = found;
            return { ok: true, detail: `安装路径 ${found}` };
          }
          if (run.exitCode === null && run.error === 'timeout') {
            return { ok: false, detail: '等待超时；将回退常见安装目录' };
          }
          if (run.exitCode === null) {
            return { ok: false, detail: '进程启动失败；常见于杀毒软件拦截 vswhere.exe，将回退常见安装目录' };
          }
          return { ok: false, detail: '查询无结果；将回退常见安装目录' };
        }
      );
      if (installationPath) {
        installPaths.add(installationPath);
        break;
      }
    }
  }

  const programFiles = resolved.environment.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = resolved.environment['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  for (const root of [programFiles, programFilesX86]) {
    for (const version of VS_VERSION_DIRECTORIES) {
      for (const edition of VS_EDITION_DIRECTORIES) {
        installPaths.add(path.join(root, 'Microsoft Visual Studio', version, edition));
      }
    }
  }

  for (const installPath of installPaths) {
    const vcvars = (name: string) => path.join(installPath, 'VC', 'Auxiliary', 'Build', name);
    const candidates = architecture === 'x64'
      ? [vcvars('vcvars64.bat'), path.join(installPath, 'Common7', 'Tools', 'VsDevCmd.bat')]
      : [vcvars('vcvars32.bat'), vcvars('vcvars64.bat'), path.join(installPath, 'Common7', 'Tools', 'VsDevCmd.bat')];
    for (const candidate of candidates) {
      if (await resolved.fileExists(candidate)) return candidate;
    }
  }
  return null;
}

async function locateVsWhereExecutable(deps: MsvcSetupBatchDeps): Promise<string | null> {
  const programFilesX86 = deps.environment['ProgramFiles(x86)'];
  if (programFilesX86) {
    const candidate = path.join(programFilesX86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
    if (await deps.fileExists(candidate)) return candidate;
  }
  try {
    const lookup = await deps.commandRunner('where.exe', ['vswhere.exe'], { timeoutMs: DETECT_TIMEOUT_MS });
    if (lookup.exitCode === 0) {
      const found = lookup.stdout.split(/\r?\n/u)
        .map(line => line.trim())
        .find(line => line.toLowerCase().endsWith('vswhere.exe'));
      if (found) return found;
    }
  } catch {
    // where 不可用时只依赖固定路径。
  }
  return null;
}

/** 执行一条探测命令并记录明细；recorder 缺省时只执行不记录。 */
async function runRecordedStep(
  recorder: StepRecorder | undefined,
  commandRunner: CompilerCommandRunner,
  label: string,
  command: string,
  args: readonly string[],
  timeoutMs: number,
  describe: (run: CompilerCommandResult) => Promise<{ ok: boolean; detail?: string }>,
  windowsVerbatimArguments = false
): Promise<CompilerProbeStep | null> {
  const startedAt = recorder ? recorder.now() : 0;
  let run: CompilerCommandResult;
  try {
    run = await commandRunner(command, args, { timeoutMs, windowsVerbatimArguments });
  } catch (error) {
    run = { exitCode: null, stdout: '', stderr: '', error: error instanceof Error ? error.message : 'unknown' };
  }
  const conclusion = await describe(run);
  if (!recorder) return null;
  const step: CompilerProbeStep = {
    attempt: recorder.attempt,
    label,
    command: [command, ...args].join(' '),
    ok: conclusion.ok,
    exitCode: run.exitCode,
    error: run.error,
    durationMs: recorder.now() - startedAt,
    detail: conclusion.detail
  };
  recorder.steps.push(step);
  return step;
}

/** 把探测明细翻译成面向用户的中文日志（只在探测失败时由构建分支并入 logs，便于用户整段反馈）。 */
export function formatCompilerDetectionDiagnostics(outcome: CompilerDetectionOutcome): string[] {
  if (outcome.compiler) return [];
  const lines: string[] = [`【编译器探测明细】共尝试 ${outcome.attempts} 次、耗时 ${outcome.elapsedMs}ms：`];
  let lastAttempt = 0;
  for (const step of outcome.steps) {
    if (step.attempt !== lastAttempt) {
      lastAttempt = step.attempt;
      lines.push(`第 ${step.attempt} 次尝试：`);
    }
    lines.push(`  ${describeProbeStep(step)}`);
  }
  lines.push(
    '【结论】所有编译器探测均失败。若本机确实装有 Visual Studio/Build Tools，这很可能是暂时性失败'
    + '（杀毒软件拦截 LingBuilder 拉起 cmd.exe/vswhere.exe、Visual Studio Installer 正在后台自更新、系统瞬时繁忙）：'
    + '请再点一次「编译」重试；若反复出现，请把本段日志完整复制发给开发组，便于定位具体环节。'
  );
  return lines;
}

function describeProbeStep(step: CompilerProbeStep): string {
  if (step.ok) {
    return `✓ ${step.label}：成功（${step.durationMs}ms）${step.detail ? `——${step.detail}` : ''}`;
  }
  if (step.exitCode === null && step.error === 'timeout') {
    return `✗ ${step.label}：等待超时（超过 ${Math.round(step.durationMs)}ms）${step.detail ? `——${step.detail}` : ''}`;
  }
  if (step.exitCode === null) {
    return `✗ ${step.label}：进程启动失败（${step.error || '未知错误'}，${step.durationMs}ms）${step.detail ? `——${step.detail}` : ''}`;
  }
  return `✗ ${step.label}：退出码 ${step.exitCode}（${step.durationMs}ms）${step.detail ? `——${step.detail}` : ''}`;
}

function firstPathLine(output: string): string | null {
  return output.split(/\r?\n/u)
    .map(line => line.trim())
    .find(line => /^[A-Za-z]:[\\/]/u.test(line) || line.startsWith('\\\\')) || null;
}

function quoteCmdArg(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
