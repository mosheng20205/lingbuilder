import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { BUILTIN_MODULE_DOCUMENT_PATHS } from '../src/services/modules/builtinModuleDocuments';
import { QRCODE_MODULE, QRCODE_MODULE_ID } from '../src/services/modules/qrcodeModules';
import { generateQrCodeRuntime, QRCODE_MODULE_ID as RUNTIME_MODULE_ID, QRCODE_RUNTIME } from '../src/services/windowDesigner/qrCodeRuntime';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('二维码模块已注册进内置清单且元信息完整', () => {
  assert.ok(BUILTIN_MODULES.some(module => module.id === QRCODE_MODULE_ID), 'BUILTIN_MODULES 缺少 lingbuilder.qrcode');
  assert.equal(QRCODE_MODULE.id, 'lingbuilder.qrcode');
  assert.equal(QRCODE_MODULE.name, '二维码模块');
  assert.equal(QRCODE_MODULE.category, '图像');
  assert.equal(QRCODE_MODULE.version, '1.0.0');
});

test('二维码命令面与 bindings 齐备且 ABI 类型正确', () => {
  const commands = QRCODE_MODULE.contributes?.commands || [];
  const bindings = QRCODE_MODULE.bindings?.commands || [];
  const expectedNames = [
    '二维码_取版本', '二维码_生成', '二维码_取错误', '二维码_取模块数', '二维码_取版本号', '二维码_取掩码',
    '二维码_取纠错级别', '二维码_取深色', '二维码_保存PNG', '二维码_取位图', '二维码_自检', '二维码_释放',
    '二维码_释放全部', '二维码_识别PNG', '二维码_识别位图', '二维码_识别字节集', '二维码_识别屏幕',
    '二维码_识别取文本', '二维码_识别取字节', '二维码_识别取版本', '二维码_识别取掩码', '二维码_识别取纠错级别',
    '二维码_识别取模式', '二维码_识别取修复码字数', '二维码_识别取定位点数', '二维码_识别取角点横坐标',
    '二维码_识别取角点纵坐标', '二维码_识别取外接四边形', '二维码_识别取错误', '二维码_识别释放', '二维码_识别释放全部'
  ];
  assert.deepEqual(commands.map(command => command.name), expectedNames);
  assert.equal(bindings.length, expectedNames.length);
  const targetIds = (QRCODE_MODULE.targets || []).map(target => target.id).sort();
  assert.deepEqual(targetIds, ['windows-msvc-win32', 'windows-msvc-x64']);
  for (const binding of bindings) {
    assert.equal(binding.runtimeName, binding.command);
    assert.ok(binding.command.startsWith('二维码_'));
  }
  const types = QRCODE_MODULE.contributes?.types || [];
  assert.deepEqual(types.map(type => type.name).sort(), ['二维码句柄', '二维码识别结果'].sort());
  for (const type of types) assert.equal((type as { cppType?: string }).cppType, 'long long');
  const byName = new Map(bindings.map(binding => [binding.command, binding]));
  assert.equal(byName.get('二维码_识别字节集')?.parameters?.[0]?.type, 'bytes');
  assert.equal(byName.get('二维码_识别取字节')?.returnType, 'bytes');
  assert.equal(byName.get('二维码_识别取外接四边形')?.returnType, 'bytes');
  assert.equal(byName.get('二维码_生成')?.returnType, '二维码句柄');
  assert.equal(byName.get('二维码_识别PNG')?.returnType, '二维码识别结果');
  for (const command of commands) assert.ok(command.description.length > 4, `${command.name} 缺少中文描述`);
});

test('二维码 uiExamples 两段示例已声明且文件存在', () => {
  const examples = QRCODE_MODULE.contributes?.examples || [];
  assert.ok(examples.length >= 2);
  for (const example of examples) {
    const absolute = path.join(repoRoot, example.path);
    assert.ok(fs.existsSync(absolute), `${example.path} 不存在`);
  }
});

test('二维码文档为手工维护版：清单内联 docs 且未进生成登记表，文件存在', () => {
  assert.equal(BUILTIN_MODULE_DOCUMENT_PATHS[QRCODE_MODULE_ID], undefined);
  assert.ok(QRCODE_MODULE.contributes?.docs?.some(doc => doc.path === 'docs/modules/qrcode/README.md'));
  assert.ok(fs.existsSync(path.join(repoRoot, 'docs/modules/qrcode/README.md')));
});

test('二维码生成器注入：未启用为空、启用携带完整运行时', () => {
  assert.equal(generateQrCodeRuntime([]), '');
  const injected = generateQrCodeRuntime([{ manifest: QRCODE_MODULE } as never]);
  assert.equal(injected, QRCODE_RUNTIME);
  for (const marker of ['二维码_生成', '二维码_识别PNG', '二维码_自检', 'buildFunctionPattern', 'decodeGrayImage']) {
    assert.ok(injected.includes(marker), `注入运行时缺少 ${marker}`);
  }
  assert.equal(RUNTIME_MODULE_ID, QRCODE_MODULE_ID);
});

test('二维码运行时满足 String.raw 注入安全（无反引号与插值序列）', () => {
  assert.equal(QRCODE_RUNTIME.includes('`'), false);
  assert.equal(QRCODE_RUNTIME.includes('${'), false);
});

test('二维码注入运行时与 native 源码无漂移（qrcode:runtime --check）', () => {
  execSync('npm run qrcode:runtime:check', { cwd: repoRoot, stdio: 'pipe' });
});
