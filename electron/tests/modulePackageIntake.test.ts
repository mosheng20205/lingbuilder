import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFileArgument, findLbmodArgument, isLbmodPath } from '../src/services/modules/modulePackageIntakeService';
import { readFile } from 'node:fs/promises';
import { hasLbmodFileAssociation } from '../src/services/modules/modulePackageIntakeService';

test('识别 .lbmod 启动参数且不混入工作区参数', () => {
  assert.equal(findLbmodArgument(['app.exe', '--foo', 'C:\\tmp\\demo.lbmod']), 'C:\\tmp\\demo.lbmod');
  assert.equal(classifyFileArgument('demo.lbmod'), 'module');
  assert.equal(classifyFileArgument('demo.lbsln'), 'workspace');
  assert.equal(classifyFileArgument('demo.txt'), 'unsupported');
});

test('模块扩展名大小写不敏感', () => assert.equal(isLbmodPath('demo.LBMOD'), true));

test('electron-builder 配置注册 .lbmod 文件关联', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(hasLbmodFileAssociation(pkg), true);
});
