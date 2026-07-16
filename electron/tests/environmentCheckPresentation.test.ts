import test from 'node:test';
import assert from 'node:assert/strict';

import { formatEnvironmentCheckOutput } from '../src/services/tasks/environmentCheckPresentation';

test('environment check UI output distinguishes required failures, optional gaps, and honest readiness', () => {
  const logs = formatEnvironmentCheckOutput({
    ready: true,
    platform: 'Windows x64',
    checks: [
      { id: 'gpp', label: 'GNU g++', available: true, required: false, version: '14.2.0', path: 'C:/g++.exe' },
      { id: 'msvc', label: 'MSVC C++ 编译器', available: false, required: false, detail: '未检测到 MSVC。' },
      { id: 'cmake', label: 'CMake', available: false, required: true, detail: '未检测到 CMake。' }
    ],
    warnings: ['依赖 Visual Studio .lib 的模块不可构建。']
  }, '12:00:00');
  const output = logs.join('\n');

  assert.match(output, /✓ GNU g\+\+/u);
  assert.match(output, /○ MSVC C\+\+ 编译器/u);
  assert.match(output, /✗ CMake/u);
  assert.match(output, /基础构建环境已就绪/u);
  assert.doesNotMatch(output, /满足 Win32 生成与编译要求/u);
  assert.match(output, /\[警告\]/u);
});

test('environment check UI output reports the not-ready empty state', () => {
  const logs = formatEnvironmentCheckOutput({ ready: false, checks: [] }, '12:00:01');
  assert.match(logs.join('\n'), /自检未就绪/u);
});

test('environment check UI output omits the warning hint when there are no warnings', () => {
  const logs = formatEnvironmentCheckOutput({
    ready: true,
    checks: [{ id: 'msvc', label: 'MSVC C++ 编译器', available: true }],
    warnings: []
  }, '12:00:02');
  assert.match(logs.join('\n'), /核心开发环境已全部就绪/u);
  assert.doesNotMatch(logs.join('\n'), /查看上方警告/u);
});
