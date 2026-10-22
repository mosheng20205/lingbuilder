import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectCompilerDetailed,
  formatCompilerDetectionDiagnostics,
  invalidateCachedCompiler,
  type CompilerCommandResult,
  type CompilerCommandRunner
} from '../src/services/tasks/compilerDetection';

const TEST_ENV = { ProgramFiles: 'X:\\PF', 'ProgramFiles(x86)': 'X:\\PF86' } as NodeJS.ProcessEnv;
const VSWHERE_FIXED_PATH = 'X:\\PF86\\Microsoft Visual Studio\\Installer\\vswhere.exe';
const VSWHERE_INSTALL_LINE = 'X:\\PF\\Microsoft Visual Studio\\2022\\Community\r\n';
const VCVARS64_2022 = 'X:\\PF\\Microsoft Visual Studio\\2022\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat';
const VCVARS64_2026 = 'X:\\PF\\Microsoft Visual Studio\\18\\BuildTools\\VC\\Auxiliary\\Build\\vcvars64.bat';

interface FakeInvocation {
  command: string;
  args: readonly string[];
}

function baseName(command: string): string {
  const normalized = command.replace(/\\/g, '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1).toLowerCase();
}

function createRunner(
  respond: (invocation: FakeInvocation) => CompilerCommandResult | Promise<CompilerCommandResult>
): CompilerCommandRunner & { invocations: FakeInvocation[] } {
  const invocations: FakeInvocation[] = [];
  return Object.assign(
    async (command: string, args: readonly string[]) => {
      const invocation = { command, args };
      invocations.push(invocation);
      return await respond(invocation);
    },
    { invocations }
  );
}

const spawnError = (error: string): CompilerCommandResult => ({ exitCode: null, stdout: '', stderr: '', error });
const notFound = (): CompilerCommandResult => ({ exitCode: 1, stdout: '', stderr: '' });

test('x64 探测成功后写进程内缓存，再次探测不再拉起任何子进程', async () => {
  invalidateCachedCompiler('x64');
  const runner = createRunner(invocation => {
    const executable = baseName(invocation.command);
    if (executable === 'vswhere.exe') return { exitCode: 0, stdout: VSWHERE_INSTALL_LINE, stderr: '' };
    if (executable === 'cmd.exe') return { exitCode: 0, stdout: '', stderr: '' };
    return notFound();
  });
  const options = {
    architecture: 'x64' as const,
    environment: TEST_ENV,
    commandRunner: runner,
    fileExists: async (candidate: string) => candidate === VSWHERE_FIXED_PATH || candidate === VCVARS64_2022,
    delay: async () => undefined
  };

  const first = await detectCompilerDetailed(options);
  assert.equal(first.fromCache, false);
  assert.equal(first.compiler?.kind, 'msvc');
  assert.equal(first.compiler?.setupBatch, VCVARS64_2022);
  assert.equal(first.compiler?.arch, 'x64');
  // 成功场景绝不允许输出失败结论文案（formatter 只在失败分支使用，但必须自洽）。
  assert.deepEqual(formatCompilerDetectionDiagnostics(first), []);
  const callsAfterFirst = runner.invocations.length;
  assert.ok(callsAfterFirst > 0);

  const second = await detectCompilerDetailed(options);
  assert.equal(second.fromCache, true);
  assert.equal(second.compiler?.setupBatch, VCVARS64_2022);
  assert.equal(runner.invocations.length, callsAfterFirst);
});

test('vswhere 被拦截（进程启动失败）时回退固定目录，VS2026 目录名 18 可被发现', async () => {
  invalidateCachedCompiler('x64');
  const runner = createRunner(invocation => {
    const executable = baseName(invocation.command);
    if (executable === 'vswhere.exe') return spawnError('EPERM');
    if (executable === 'cmd.exe') return { exitCode: 0, stdout: '', stderr: '' };
    return notFound();
  });
  const outcome = await detectCompilerDetailed({
    architecture: 'x64',
    environment: TEST_ENV,
    commandRunner: runner,
    fileExists: async candidate => candidate === VSWHERE_FIXED_PATH || candidate === VCVARS64_2026,
    delay: async () => undefined
  });

  assert.equal(outcome.compiler?.kind, 'msvc');
  assert.equal(outcome.compiler?.setupBatch, VCVARS64_2026);
  // 探测最终成功：EPERM 记录在步骤明细里，formatter 不输出失败文案。
  assert.ok(outcome.steps.some(step => step.error === 'EPERM' && step.label.includes('vswhere')));
  assert.deepEqual(formatCompilerDetectionDiagnostics(outcome), []);
});

test('vcvars 验证瞬时失败后自动重试成功，诊断携带两次尝试明细', async () => {
  invalidateCachedCompiler('x64');
  let verifyCalls = 0;
  const runner = createRunner(invocation => {
    const executable = baseName(invocation.command);
    if (executable === 'cmd.exe') {
      verifyCalls += 1;
      return verifyCalls === 1 ? spawnError('EPERM') : { exitCode: 0, stdout: '', stderr: '' };
    }
    if (executable === 'vswhere.exe') return { exitCode: 0, stdout: VSWHERE_INSTALL_LINE, stderr: '' };
    return notFound();
  });
  const outcome = await detectCompilerDetailed({
    architecture: 'x64',
    environment: TEST_ENV,
    commandRunner: runner,
    fileExists: async candidate => candidate === VSWHERE_FIXED_PATH || candidate === VCVARS64_2022,
    delay: async () => undefined
  });

  assert.equal(outcome.attempts, 2);
  assert.equal(outcome.compiler?.setupBatch, VCVARS64_2022);
  assert.ok(outcome.steps.some(step => step.attempt === 1 && !step.ok));
  assert.ok(outcome.steps.some(step => step.attempt === 2 && step.ok));
  // 重试后成功：步骤明细跨两次尝试，formatter 对成功结果输出空。
  assert.deepEqual(formatCompilerDetectionDiagnostics(outcome), []);
});

test('全链失败返回 null，诊断区分「未安装属正常」与「进程启动失败」', async () => {
  invalidateCachedCompiler('win32');
  const runner = createRunner(invocation => {
    const executable = baseName(invocation.command);
    // vswhere 与 cmd 被拦截（进程启动失败）；where/g++/clang++ 正常返回「未找到」。
    if (executable === 'vswhere.exe' || executable === 'cmd.exe') return spawnError('EPERM');
    return notFound();
  });
  const outcome = await detectCompilerDetailed({
    architecture: 'win32',
    environment: TEST_ENV,
    commandRunner: runner,
    fileExists: async candidate => candidate === VSWHERE_FIXED_PATH || candidate === VCVARS64_2022,
    delay: async () => undefined
  });

  assert.equal(outcome.compiler, null);
  // where cl 未安装 → vswhere 查询被拦截 ×2 → vcvars32 验证被拦截 → g++/clang++ 未安装
  const notInstalledSteps = outcome.steps.filter(step => step.exitCode === 1);
  assert.ok(notInstalledSteps.length >= 3);
  const blockedSteps = outcome.steps.filter(step => step.exitCode === null && step.error === 'EPERM');
  assert.ok(blockedSteps.length >= 3);
  const lines = formatCompilerDetectionDiagnostics(outcome).join('\n');
  assert.match(lines, /共尝试 2 次/);
  assert.match(lines, /第 1 次尝试/);
  assert.match(lines, /PATH 中没有 cl\.exe（正常/);
  assert.match(lines, /未安装属正常/);
  assert.match(lines, /进程启动失败（EPERM/);
  assert.match(lines, /暂时性失败/);
  assert.match(lines, /请再点一次「编译」重试/);
  assert.match(lines, /发给开发组/);
});

test('win32 构建 PATH 里有 cl.exe 时直接采用，不再拉起 vcvars 验证', async () => {
  invalidateCachedCompiler('win32');
  const runner = createRunner(invocation => {
    const executable = baseName(invocation.command);
    if (executable === 'where.exe' && invocation.args[0] === 'cl.exe') {
      return { exitCode: 0, stdout: 'C:\\VS\\VC\\Tools\\MSVC\\14.40\\bin\\HostX64\\x64\\cl.exe\r\n', stderr: '' };
    }
    return notFound();
  });
  const outcome = await detectCompilerDetailed({
    architecture: 'win32',
    environment: TEST_ENV,
    commandRunner: runner,
    fileExists: async () => false,
    delay: async () => undefined
  });

  assert.equal(outcome.compiler?.kind, 'msvc');
  assert.equal(outcome.compiler?.command, 'cl');
  assert.equal(outcome.compiler?.setupBatch, undefined);
  assert.equal(runner.invocations.filter(invocation => baseName(invocation.command) === 'cmd.exe').length, 0);
});

test('编译失败后 invalidateCachedCompiler 强制下一次全链重探', async () => {
  invalidateCachedCompiler('x64');
  let verifyCalls = 0;
  const runner = createRunner(invocation => {
    if (baseName(invocation.command) === 'cmd.exe') {
      verifyCalls += 1;
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    if (baseName(invocation.command) === 'vswhere.exe') return { exitCode: 0, stdout: VSWHERE_INSTALL_LINE, stderr: '' };
    return notFound();
  });
  const options = {
    architecture: 'x64' as const,
    environment: TEST_ENV,
    commandRunner: runner,
    fileExists: async candidate => candidate === VSWHERE_FIXED_PATH || candidate === VCVARS64_2022,
    delay: async () => undefined
  };

  await detectCompilerDetailed(options);
  const callsAfterFirst = runner.invocations.length;
  invalidateCachedCompiler('x64');
  await detectCompilerDetailed(options);
  assert.ok(runner.invocations.length > callsAfterFirst);
  assert.equal(verifyCalls, 2);
});

test('并发探测共享同一次在途链路，不会同时拉起多个 vswhere/vcvars', async () => {
  invalidateCachedCompiler('x64');
  const runner = createRunner(async invocation => {
    if (baseName(invocation.command) === 'vswhere.exe') {
      await new Promise(resolve => setTimeout(resolve, 20));
      return { exitCode: 0, stdout: VSWHERE_INSTALL_LINE, stderr: '' };
    }
    if (baseName(invocation.command) === 'cmd.exe') return { exitCode: 0, stdout: '', stderr: '' };
    return notFound();
  });
  const options = {
    architecture: 'x64' as const,
    environment: TEST_ENV,
    commandRunner: runner,
    fileExists: async candidate => candidate === VSWHERE_FIXED_PATH || candidate === VCVARS64_2022,
    delay: async () => undefined
  };

  const [first, second] = await Promise.all([
    detectCompilerDetailed(options),
    detectCompilerDetailed(options)
  ]);
  assert.equal(first.compiler?.setupBatch, VCVARS64_2022);
  assert.equal(second.compiler?.setupBatch, VCVARS64_2022);
  assert.equal(runner.invocations.filter(invocation => baseName(invocation.command) === 'vswhere.exe').length, 1);
  assert.equal(runner.invocations.filter(invocation => baseName(invocation.command) === 'cmd.exe').length, 1);
});
