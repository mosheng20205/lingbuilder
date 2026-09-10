import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODULE_GENERATION_MAX_REQUIREMENT_LENGTH,
  buildModuleGenerationMessages,
  sanitizeModuleRequirement
} from '../src/services/modules/aiModuleGeneration';

test('模块需求描述校验拒绝空值与超长输入', () => {
  assert.equal(sanitizeModuleRequirement('').ok, false);
  assert.equal(sanitizeModuleRequirement('   ').ok, false);
  assert.equal(sanitizeModuleRequirement(undefined).ok, false);
  assert.equal(sanitizeModuleRequirement(42).ok, false);
  const overLong = sanitizeModuleRequirement('长'.repeat(MODULE_GENERATION_MAX_REQUIREMENT_LENGTH + 1));
  assert.equal(overLong.ok, false);
  assert.match(overLong.error || '', /过长/u);
  const valid = sanitizeModuleRequirement('  做一个字符串工具模块  ');
  assert.equal(valid.ok, true);
  assert.equal(valid.text, '做一个字符串工具模块');
});

test('模块生成提示词包含规范全文、需求与输出契约', () => {
  const { systemPrompt, userPrompt } = buildModuleGenerationMessages('做一个文本工具模块', 'SPEC-CONTENT-示例规范');
  assert.match(systemPrompt, /### 文件：<相对路径>/u);
  assert.match(systemPrompt, /lingbuilder\.module\.json/u);
  assert.match(systemPrompt, /controlRef/u);
  assert.match(systemPrompt, /module-build-errors\.md/u);
  assert.match(userPrompt, /LINGBUILDER_MODULE_SPEC/u);
  assert.match(userPrompt, /SPEC-CONTENT-示例规范/u);
  assert.match(userPrompt, /REQUIREMENT/u);
  assert.match(userPrompt, /做一个文本工具模块/u);
  assert.ok(userPrompt.indexOf('SPEC-CONTENT-示例规范') < userPrompt.indexOf('做一个文本工具模块'), '规范全文应出现在需求之前');
});
