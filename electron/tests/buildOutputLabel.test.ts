import assert from 'node:assert/strict';
import test from 'node:test';
import { describeBuildOutputDirectory, resolveBuildOutputKind } from '../src/services/tasks/buildOutputLabel';

test('构建日志产物标签按产物形态播报 exe/控制台/DLL', () => {
  assert.equal(resolveBuildOutputKind('exe', false), 'application');
  assert.equal(resolveBuildOutputKind('exe', true), 'console-application');
  assert.equal(resolveBuildOutputKind('dll', false), 'dynamic-library');
  // 产物以实际链接结果为准：outputType=dll 时即使项目带控制台形态，产物也是 DLL。
  assert.equal(resolveBuildOutputKind('dll', true), 'dynamic-library');

  assert.equal(describeBuildOutputDirectory('application'), 'exe 输出目录');
  assert.equal(describeBuildOutputDirectory('console-application'), '控制台程序输出目录');
  assert.equal(describeBuildOutputDirectory('dynamic-library'), 'DLL 输出目录');
});
