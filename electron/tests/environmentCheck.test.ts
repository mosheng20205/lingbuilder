import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EnvironmentCheckService,
  type EnvironmentCommandResult,
  type EnvironmentCommandRunner
} from '../src/services/tasks/environmentCheckService';

const ok = (stdout = '', stderr = ''): EnvironmentCommandResult => ({ exitCode: 0, stdout, stderr });
const missing = (): EnvironmentCommandResult => ({ exitCode: 1, stdout: '', stderr: 'not found' });

test('environment check reports versions and paths for a complete Windows toolchain', async () => {
  const runner = createRunner((command, args) => {
    const executable = baseName(command);
    if (executable === 'where.exe') {
      const paths: Record<string, string> = {
        'cl.exe': 'C:\\VS\\VC\\bin\\cl.exe',
        'rc.exe': 'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.26100.0\\x64\\rc.exe',
        cmake: 'C:\\Tools\\CMake\\bin\\cmake.exe',
        'g++': 'C:\\Tools\\MinGW\\bin\\g++.exe',
        'clang++': 'C:\\Tools\\LLVM\\bin\\clang++.exe'
      };
      return paths[args[0]] ? ok(`${paths[args[0]]}\r\n`) : missing();
    }
    if (executable === 'cl.exe') {
      return { exitCode: 2, stdout: '', stderr: 'Microsoft (R) C/C++ Optimizing Compiler Version 19.40.33811 for x64' };
    }
    if (executable === 'rc.exe') {
      return ok('Microsoft (R) Windows (R) Resource Compiler Version 10.0.10011.16384');
    }
    if (executable === 'cmake.exe') return ok('cmake version 3.30.2');
    if (executable === 'g++.exe') return ok('g++ (MinGW-W64 x86_64-ucrt-posix-seh) 13.2.0');
    if (executable === 'clang++.exe') return ok('clang version 18.1.8');
    if (executable === 'reg.exe') {
      return ok([
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
        '    pv    REG_SZ    126.0.2592.113',
        '    location    REG_SZ    C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application'
      ].join('\r\n'));
    }
    return missing();
  });

  const result = await new EnvironmentCheckService({
    commandRunner: runner,
    platform: 'win32',
    architecture: 'x64',
    osRelease: '10.0.26100',
    nodeVersion: '22.14.0',
    nodePath: 'C:\\Node\\node.exe',
    environment: { SystemRoot: 'C:\\Windows', 'ProgramFiles(x86)': 'C:\\Program Files (x86)' },
    now: () => new Date('2026-07-10T08:00:00.000Z')
  }).check();

  assert.equal(result.ready, true);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.checkedAt, '2026-07-10T08:00:00.000Z');
  assert.deepEqual(result.checks.node, {
    available: true,
    version: '22.14.0',
    path: 'C:\\Node\\node.exe',
    detail: 'LingBuilder 当前正在 Node.js 22.14.0 运行时上运行。'
  });
  assert.equal(result.checks.msvc.available, true);
  assert.equal(result.checks.msvc.version, '19.40.33811');
  assert.equal(result.checks.windowsSdk.version, '10.0.26100.0');
  assert.equal(result.checks.cmake.version, '3.30.2');
  assert.equal(result.checks.gpp.version, '13.2.0');
  assert.equal(result.checks.clangpp.version, '18.1.8');
  assert.equal(result.checks.webView2.version, '126.0.2592.113');
  assert.equal(
    result.checks.webView2.path,
    'C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application\\126.0.2592.113\\msedgewebview2.exe'
  );
  assert.equal(result.checks.platform.path, 'C:\\Windows');
});

test('environment check discovers MSVC and Windows SDK through vswhere and vcvars', async () => {
  const calls: Array<{ command: string; args: readonly string[] }> = [];
  const runner = createRunner((command, args) => {
    calls.push({ command, args });
    const executable = baseName(command);
    if (executable === 'where.exe') {
      return args[0] === 'vswhere.exe'
        ? ok('C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe\r\n')
        : missing();
    }
    if (executable === 'vswhere.exe') {
      return ok('C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\r\n');
    }
    if (executable === 'cmd.exe') {
      const commandText = args.at(-1) || '';
      if (commandText.includes('vcvars64.bat') && commandText.includes('cl.exe /Bv')) {
        return ok(
          'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC\\14.40.33807\\bin\\Hostx64\\x64\\cl.exe',
          'Microsoft (R) C/C++ Optimizing Compiler Version 19.40.33811 for x64'
        );
      }
      if (commandText.includes('vcvars64.bat') && commandText.includes('rc.exe /?')) {
        return ok([
          'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\rc.exe',
          'Microsoft (R) Windows (R) Resource Compiler Version 10.0.22621.0'
        ].join('\r\n'));
      }
    }
    return missing();
  });

  const result = await new EnvironmentCheckService({
    commandRunner: runner,
    platform: 'win32',
    architecture: 'x64',
    osRelease: '10.0.22631',
    nodeVersion: '22.14.0',
    nodePath: 'C:\\Node\\node.exe',
    environment: { SystemRoot: 'C:\\Windows', 'ProgramFiles(x86)': 'C:\\Program Files (x86)' }
  }).check();

  assert.equal(result.ready, true);
  assert.equal(result.checks.msvc.available, true);
  assert.equal(result.checks.msvc.version, '19.40.33811');
  assert.match(result.checks.msvc.detail, /vswhere.*vcvars64\.bat/u);
  assert.match(result.checks.msvc.path || '', /cl\.exe$/iu);
  assert.equal(result.checks.windowsSdk.available, true);
  assert.equal(result.checks.windowsSdk.version, '10.0.22621.0');
  assert.ok(calls.some(call => call.command === 'cmd.exe' && (call.args.at(-1) || '').includes('rc.exe /?')));
  assert.equal(result.warnings.some(warning => warning.includes('g++')), false);
  assert.equal(result.warnings.some(warning => warning.includes('clang++')), false);
});

test('environment check discovers the CMake bundled with Visual Studio when it is not on PATH', async () => {
  const visualStudioCmakePath = [
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community',
    'Common7\\IDE\\CommonExtensions\\Microsoft\\CMake\\CMake\\bin\\cmake.exe'
  ].join('\\');
  const runner = createRunner((command, args) => {
    const executable = baseName(command);
    if (executable === 'where.exe') return missing();
    if (executable === 'vswhere.exe') {
      if (args.includes('-?')) return ok('Visual Studio Locator version 3.1.7');
      if (args.includes('-latest') && args.includes('-find')) return ok(`${visualStudioCmakePath}\r\n`);
      return missing();
    }
    if (command === visualStudioCmakePath) return ok('cmake version 3.31.6-msvc6');
    return missing();
  });

  const result = await new EnvironmentCheckService({
    commandRunner: runner,
    platform: 'win32',
    architecture: 'x64',
    osRelease: '10.0.19045',
    nodeVersion: '26.4.0',
    nodePath: 'C:\\Program Files\\nodejs\\node.exe',
    environment: {
      SystemRoot: 'C:\\Windows',
      ProgramFiles: 'C:\\Program Files',
      'ProgramFiles(x86)': 'C:\\Program Files (x86)'
    }
  }).check();

  assert.equal(result.checks.cmake.available, true);
  assert.equal(result.checks.cmake.version, '3.31.6-msvc6');
  assert.equal(result.checks.cmake.path, visualStudioCmakePath);
  assert.match(result.checks.cmake.detail, /Visual Studio Installer/u);
  assert.equal(result.warnings.some(warning => warning.includes('未检测到 CMake')), false);
});

test('an alternative compiler is build-ready but exposes missing optional capabilities as warnings', async () => {
  const runner = createRunner((command, args) => {
    const executable = baseName(command);
    if (executable === 'where.exe' && args[0] === 'g++') return ok('D:\\mingw64\\bin\\g++.exe\r\n');
    if (executable === 'g++.exe') return ok('g++ (Rev2, Built by MSYS2 project) 14.2.0');
    return missing();
  });

  const result = await new EnvironmentCheckService({
    commandRunner: runner,
    platform: 'win32',
    architecture: 'x64',
    osRelease: '10.0.22631',
    nodeVersion: '20.18.0',
    nodePath: 'C:\\Node\\node.exe',
    environment: { SystemRoot: 'C:\\Windows' }
  }).check();

  assert.equal(result.ready, true);
  assert.equal(result.checks.gpp.available, true);
  assert.equal(result.checks.msvc.available, false);
  assert.ok(result.warnings.some(warning => warning.includes('未检测到 MSVC')));
  assert.ok(result.warnings.some(warning => warning.includes('rc.exe')));
  assert.equal(result.warnings.some(warning => warning.includes('未检测到可用的 C++ 编译器')), false);
  assert.equal(result.warnings.some(warning => warning.includes('clang++')), false);
});

test('unsupported platform and missing compilers make the environment not ready', async () => {
  let commandCount = 0;
  const result = await new EnvironmentCheckService({
    commandRunner: async () => {
      commandCount += 1;
      return missing();
    },
    platform: 'linux',
    architecture: 'x64',
    osRelease: '6.8.0',
    nodeVersion: '',
    nodePath: '/usr/bin/node',
    environment: {}
  }).check();

  assert.equal(result.ready, false);
  assert.equal(result.checks.platform.available, false);
  assert.equal(result.checks.node.available, false);
  assert.equal(result.checks.msvc.available, false);
  assert.equal(result.checks.windowsSdk.available, false);
  assert.equal(result.checks.webView2.available, false);
  assert.ok(result.warnings.some(warning => warning.includes('不是 Windows')));
  assert.ok(result.warnings.some(warning => warning.includes('Node.js')));
  assert.ok(result.warnings.some(warning => warning.includes('C++ 编译器')));
  assert.equal(commandCount, 3, '非 Windows 平台仅应探测三个跨平台工具');
});

test('environment check enforces one overall timeout and observes late command failures', async () => {
  let rejectCommand: ((reason: Error) => void) | undefined;
  const pendingCommand = new Promise<EnvironmentCommandResult>((_resolve, reject) => {
    rejectCommand = reject;
  });
  const service = new EnvironmentCheckService({
    commandRunner: async () => await pendingCommand,
    platform: 'linux',
    architecture: 'x64',
    osRelease: '6.8.0',
    nodeVersion: '22.14.0',
    nodePath: '/usr/bin/node',
    environment: {},
    overallTimeoutMs: 20
  });

  const startedAt = Date.now();
  await assert.rejects(service.check(), /\u5f00发环境检测超过 20 毫秒/u);
  assert.ok(Date.now() - startedAt < 1_000, '总超时不应等待各个命令的独立超时');

  // Simulate a command failure arriving after the aggregate timeout. The
  // service must already have a rejection observer attached to that promise.
  assert.ok(rejectCommand);
  rejectCommand(new Error('late command failure'));
  await new Promise<void>(resolve => setImmediate(resolve));
});

test('environment check rejects sub-millisecond overall timeouts', () => {
  assert.throws(
    () => new EnvironmentCheckService({ overallTimeoutMs: 0.5 }),
    /环境检测总超时时间必须是大于 0/u
  );
});

function createRunner(
  handler: (command: string, args: readonly string[]) => EnvironmentCommandResult
): EnvironmentCommandRunner {
  return async (command, args) => handler(command, args);
}

function baseName(command: string): string {
  return command.replace(/\\/gu, '/').split('/').at(-1)?.toLowerCase() || command.toLowerCase();
}
