import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFileArgument, findLbmodArgument, isLbmodPath, isLocalModulePackagePath } from '../src/services/modules/modulePackageIntakeService';
import { readFile } from 'node:fs/promises';
import { hasLbmodFileAssociation } from '../src/services/modules/modulePackageIntakeService';

test('识别 .lbmod 启动参数且不混入工作区参数', () => {
  assert.equal(findLbmodArgument(['app.exe', '--foo', 'C:\\tmp\\demo.lbmod']), 'C:\\tmp\\demo.lbmod');
  assert.equal(classifyFileArgument('demo.lbmod'), 'module');
  assert.equal(classifyFileArgument('demo.lbsln'), 'workspace');
  assert.equal(classifyFileArgument('demo.txt'), 'unsupported');
});

test('模块扩展名大小写不敏感', () => assert.equal(isLbmodPath('demo.LBMOD'), true));

test('识别本机绝对路径并拒绝工作区相对路径', () => {
  assert.equal(isLocalModulePackagePath('C:\\Users\\me\\Downloads\\demo.lbmod'), true);
  assert.equal(isLocalModulePackagePath('C:/Users/me/Downloads/demo.lbmod'), true);
  assert.equal(isLocalModulePackagePath('D:/包/demo.lbmod'), true);
  assert.equal(isLocalModulePackagePath('/home/me/demo.lbmod'), true);
  assert.equal(isLocalModulePackagePath('  C:\\tmp\\demo.lbmod  '), true);
  assert.equal(isLocalModulePackagePath('.lingbuilder/module-packages/demo.lbmod'), false);
  assert.equal(isLocalModulePackagePath('module-packages/demo.lbmod'), false);
  assert.equal(isLocalModulePackagePath('./demo.lbmod'), false);
  assert.equal(isLocalModulePackagePath(''), false);
});

test('electron-builder 配置注册 .lbmod 文件关联', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(hasLbmodFileAssociation(pkg), true);
});
