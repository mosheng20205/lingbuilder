import assert from 'node:assert/strict';
import test from 'node:test';
import { collectProCommandAdmissionProblems, formatProCommandAdmissionBlock } from '../src/services/lingCpp/proCommandAdmission';
import { isProAccessActive, parseProAccessEnv, type ProCommandAuthorizationState } from '../src/services/lingCpp/proCommandAccess';
import { getLingCppSemanticDiagnostics } from '../src/services/lingCpp/languageService';
import type { LingCppModuleContext } from '../src/services/modules/types';

const STD_TEXT_MANIFEST = {
  schemaVersion: 2,
  id: 'lingbuilder.std.text',
  name: '文本处理模块',
  version: '1.3.0',
  category: '其他',
  description: '文本',
  author: 'LingBuilder',
  license: 'MIT',
  tags: ['内置'],
  contributes: {
    commands: [
      { name: '文本_取长度', signature: '文本_取长度(文本)', description: '长度', returnType: '整数型' },
      { name: '文本_倒序', signature: '文本_倒序(文本)', description: '【Pro 专享】倒序', returnType: '文本型', access: 'pro' }
    ]
  },
  targets: [],
  bindings: {
    commands: [
      { command: '文本_取长度', runtimeName: '文本_取长度', returnType: 'int' },
      { command: '文本_倒序', runtimeName: '文本_倒序', returnType: 'wideString', access: 'pro' }
    ]
  }
} as never;

function moduleContext(): LingCppModuleContext {
  const installed = { manifest: STD_TEXT_MANIFEST, installPath: '', isBuiltin: true, isInstalled: true, diagnostics: [] };
  return { availableModules: [installed], enabledModules: [installed] } as never;
}

const SOURCE = `包 演示
类 启动类
    子程序 启动()
        调试输出(文本_倒序("abc"))
        调试输出(文本_取长度("abc"))`;

test('parseProAccessEnv：缺失/非法返回 null，合法载荷原样返回', () => {
  assert.equal(parseProAccessEnv(undefined), null);
  assert.equal(parseProAccessEnv(''), null);
  assert.equal(parseProAccessEnv('not-json'), null);
  assert.equal(parseProAccessEnv('{"endsAt":null}'), null);
  const state = parseProAccessEnv('{"active":true,"endsAt":null}');
  assert.equal(state?.active, true);
});

test('isProAccessActive：active 且离线宽限未过才放行，未知状态一律未授权', () => {
  assert.equal(isProAccessActive(null), false);
  assert.equal(isProAccessActive(undefined), false);
  assert.equal(isProAccessActive({ active: false }), false);
  assert.equal(isProAccessActive({ active: true }), true);
  const expired: ProCommandAuthorizationState = { active: true, offlineUntil: new Date(Date.now() - 1000).toISOString() };
  assert.equal(isProAccessActive(expired), false);
  const valid: ProCommandAuthorizationState = { active: true, offlineUntil: new Date(Date.now() + 60_000).toISOString() };
  assert.equal(isProAccessActive(valid), true);
});

test('编辑器链路：未授权调用 Pro 命令报 warning，免费命令与授权后不报', () => {
  const context = moduleContext();
  const warnings = getLingCppSemanticDiagnostics(SOURCE, undefined, 'MainWindow.lcpp', context, undefined, undefined, undefined, { proCommandAuthorization: { active: false } });
  const proWarnings = warnings.filter(item => item.id.startsWith('lingcpp-pro-command-'));
  assert.equal(proWarnings.length, 1);
  assert.equal(proWarnings[0].level, 'warning');
  assert.match(proWarnings[0].message, /文本_倒序/u);
  assert.doesNotMatch(proWarnings[0].message, /文本_取长度/u);

  const authorized = getLingCppSemanticDiagnostics(SOURCE, undefined, 'MainWindow.lcpp', context, undefined, undefined, undefined, { proCommandAuthorization: { active: true } });
  assert.equal(authorized.filter(item => item.id.startsWith('lingcpp-pro-command-')).length, 0);

  const unknownState = getLingCppSemanticDiagnostics(SOURCE, undefined, 'MainWindow.lcpp', context);
  assert.equal(unknownState.filter(item => item.id.startsWith('lingcpp-pro-command-')).length, 1, '状态未知按未授权 fail-closed');
});

test('构建链路：proCommandEnforce 置 error 供生成器 blockingDiagnostics 阻断', () => {
  const context = moduleContext();
  const enforced = getLingCppSemanticDiagnostics(SOURCE, undefined, 'MainWindow.lcpp', context, undefined, undefined, undefined, { proCommandAuthorization: { active: false }, proCommandEnforce: true });
  const errors = enforced.filter(item => item.id.startsWith('lingcpp-pro-command-'));
  assert.equal(errors.length, 1);
  assert.equal(errors[0].level, 'error');
});

test('准入：未授权给出中文问题清单，授权后清零，免费命令不受影响', () => {
  const context = moduleContext();
  const sources = [{ filePath: 'MainWindow.lcpp', sourceCode: SOURCE }];
  const blocked = collectProCommandAdmissionProblems({ sources, moduleContext: context, proAuthorization: { active: false } });
  assert.equal(blocked.length, 1);
  assert.match(blocked[0], /文本_倒序/u);
  assert.match(blocked[0], /Pro 专享命令/u);

  const allowed = collectProCommandAdmissionProblems({ sources, moduleContext: context, proAuthorization: { active: true } });
  assert.equal(allowed.length, 0);

  const freeOnly = collectProCommandAdmissionProblems({ sources: [{ filePath: 'MainWindow.lcpp', sourceCode: '子程序 启动\n    调试输出(文本_取长度("x"))' }], moduleContext: context, proAuthorization: { active: false } });
  assert.equal(freeOnly.length, 0);
});

test('阻断文案包含开通指引与行动标签', () => {
  const text = formatProCommandAdmissionBlock('lingbuilder.build.run', ['MainWindow.lcpp 第 3 行：示例']);
  assert.match(text, /lingbuilder\.build\.run 被阻止/u);
  assert.match(text, /赞助活动/u);
});

test('远程规则合并：增量并入标记、停用/无规则不影响、不改原对象', async () => {
  const { applyProCommandRules } = await import('../src/services/modules/proAccessStateFile.js');
  const context = moduleContext();
  const source = `包 演示
类 启动类
    子程序 启动()
        调试输出(文本_取长度("abc"))`;

  const before = getLingCppSemanticDiagnostics(source, undefined, 'MainWindow.lcpp', context, undefined, undefined, undefined, { proCommandAuthorization: { active: false }, proCommandEnforce: true });
  assert.equal(before.filter(item => item.id.startsWith('lingcpp-pro-command-')).length, 0, '清单未标记且无远程规则时不拦');

  const marked = applyProCommandRules(context.enabledModules, { 'lingbuilder.std.text': ['文本_取长度'] });
  const markedContext = { ...context, enabledModules: marked } as LingCppModuleContext;
  const blocked = getLingCppSemanticDiagnostics(source, undefined, 'MainWindow.lcpp', markedContext, undefined, undefined, undefined, { proCommandAuthorization: { active: false }, proCommandEnforce: true });
  assert.equal(blocked.filter(item => item.id.startsWith('lingcpp-pro-command-')).length, 1, '远程标记后未授权构建阻断');

  const disabled = applyProCommandRules(context.enabledModules, {});
  assert.equal(disabled, context.enabledModules, '空规则原数组返回');
  assert.equal((context.enabledModules[0].manifest.bindings.commands.find((item: any) => item.command === '文本_重复') as any)?.access, undefined, '原对象不被修改');
});
