import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_MODULE_MANIFEST_FILE, parseAiModuleOutputText } from '../src/services/modules/aiModuleImportParser';

const sampleManifest = JSON.stringify({
  schemaVersion: 2,
  id: 'ai.text.tools',
  name: 'AI 文本工具',
  version: '1.0.0',
  category: '系统',
  description: '示例模块。'
});

test('解析标准“### 文件：路径”标题加代码块格式', () => {
  const text = [
    '你好，下面是完整模块：',
    '',
    '### 文件：lingbuilder.module.json',
    '```json',
    sampleManifest,
    '```',
    '',
    '### 文件：include/text_tools_bridge.h',
    '```cpp',
    '#pragma once',
    'int 文本_统计字符数(const std::wstring& 文本);',
    '```',
    '',
    '### 文件：examples/最小示例.lcpp',
    '```text',
    '类 MainWindow',
    '结束',
    '```'
  ].join('\n');

  const result = parseAiModuleOutputText(text);
  assert.equal(result.files.length, 3);
  assert.deepEqual(result.files.map(file => file.path), [
    'lingbuilder.module.json',
    'include/text_tools_bridge.h',
    'examples/最小示例.lcpp'
  ]);
  assert.equal(result.files[1].content, '#pragma once\nint 文本_统计字符数(const std::wstring& 文本);');
  assert.equal(result.diagnostics.length, 0);
});

test('解析常见标题变体：#### 路径、**文件：路径**、纯“文件：路径”行', () => {
  const text = [
    '#### lingbuilder.module.json',
    '```json',
    sampleManifest,
    '```',
    '**文件：include/a.h**',
    '```cpp',
    '#pragma once',
    '```',
    '文件：src/a.cpp',
    '```cpp',
    '#include "a.h"',
    '```'
  ].join('\n');

  const result = parseAiModuleOutputText(text);
  assert.equal(result.files.length, 3);
  assert.equal(result.files[0].path, 'lingbuilder.module.json');
  assert.equal(result.files[1].path, 'include/a.h');
  assert.equal(result.files[2].path, 'src/a.cpp');
});

test('四反引号围栏内的三反引号内容不会提前截断', () => {
  const text = [
    '### 文件：README.md',
    '````markdown',
    '示例代码：',
    '```cpp',
    'int main() {}',
    '```',
    '结束。',
    '````'
  ].join('\n');

  const result = parseAiModuleOutputText(text);
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].path, 'README.md');
  assert.equal(result.files[0].content, '示例代码：\n```cpp\nint main() {}\n```\n结束。');
});

test('重复文件使用最后一次内容并产生诊断', () => {
  const text = [
    '### 文件：lingbuilder.module.json',
    '```json',
    sampleManifest,
    '```',
    '### 文件：lingbuilder.module.json',
    '```json',
    sampleManifest.replace('"1.0.0"', '"1.0.1"'),
    '```'
  ].join('\n');

  const result = parseAiModuleOutputText(text);
  assert.equal(result.files.length, 1);
  assert.ok(result.files[0].content.includes('1.0.1'));
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.includes('出现多次')));
});

test('缺少 manifest 时给出明确诊断', () => {
  const text = [
    '### 文件：include/a.h',
    '```cpp',
    '#pragma once',
    '```'
  ].join('\n');

  const result = parseAiModuleOutputText(text);
  assert.equal(result.files.length, 1);
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.includes(AI_MODULE_MANIFEST_FILE)));
});

test('不安全或不受支持的路径被拒绝并给出诊断', () => {
  const text = [
    '### 文件：../escape.h',
    '```cpp',
    '#pragma once',
    '```',
    '### 文件：C:/abs/a.cpp',
    '```cpp',
    'int x;',
    '```',
    '### 文件：bin/tool.exe',
    '```text',
    'binary',
    '```',
    '### 文件：lingbuilder.module.json',
    '```json',
    sampleManifest,
    '```'
  ].join('\n');

  const result = parseAiModuleOutputText(text);
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].path, 'lingbuilder.module.json');
  assert.equal(result.diagnostics.filter(diagnostic => diagnostic.includes('忽略无法识别的文件路径')).length, 3);
});

test('只有标题没有代码块时给出诊断', () => {
  const text = [
    '### 文件：lingbuilder.module.json',
    '内容直接写在这里，没有代码块。',
    '### 文件：include/a.h',
    '```cpp',
    '#pragma once',
    '```'
  ].join('\n');

  const result = parseAiModuleOutputText(text);
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].path, 'include/a.h');
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.includes('lingbuilder.module.json') && diagnostic.includes('没有找到代码块')));
});

test('空文本与无文件文本返回空结果和中文诊断', () => {
  assert.deepEqual(parseAiModuleOutputText(''), { files: [], diagnostics: [] });
  assert.deepEqual(parseAiModuleOutputText('   \n  '), { files: [], diagnostics: [] });

  const noFiles = parseAiModuleOutputText('这是普通文本，没有代码块。');
  assert.equal(noFiles.files.length, 0);
  assert.ok(noFiles.diagnostics.some(diagnostic => diagnostic.includes('未识别到任何文件')));
});

test('CRLF 换行与路径反斜杠被归一化', () => {
  const text = [
    '### 文件：include\\text_tools_bridge.h',
    '```cpp',
    '#pragma once',
    '```'
  ].join('\r\n');

  const result = parseAiModuleOutputText(text);
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].path, 'include/text_tools_bridge.h');
  assert.equal(result.files[0].content, '#pragma once');
});

test('普通代码块（无文件标题）被忽略，不影响后续解析', () => {
  const text = [
    '先看说明：',
    '```text',
    '这里只是一段说明代码块。',
    '```',
    '### 文件：lingbuilder.module.json',
    '```json',
    sampleManifest,
    '```'
  ].join('\n');

  const result = parseAiModuleOutputText(text);
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].path, 'lingbuilder.module.json');
});
