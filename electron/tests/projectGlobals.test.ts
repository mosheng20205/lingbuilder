import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLingCppAstEdit } from '../src/services/lingCpp/astEditService';
import { analyzeBeginnerAutoLocalAssignment } from '../src/services/lingCpp/beginnerAutoLocalService';
import { buildLingCppLanguageContext, getLingCppCompletionItems, getLingCppSemanticDiagnostics } from '../src/services/lingCpp/languageService';
import { parseLingCpp } from '../src/services/lingCpp/parser';
import { createProjectGlobalContext, findProjectGlobalDefinition, getProjectGlobalDiagnostics, renameProjectGlobalAcrossSources } from '../src/services/lingCpp/projectGlobalService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { LingWindowProject } from '../src/services/windowDesigner/types';

const globalPath = 'src/demo/项目全局变量.lcpp';

test('项目全局变量解析和增删改保持语法往返', () => {
  const source = '// 当前登录用户\n全局 文本型 当前用户 = "访客"\n全局 整数型 访问次数 = 1\n全局 文本型 标签列表[]\n';
  const parsed = parseLingCpp(source);
  assert.deepEqual(parsed.program.globals.map(global => [global.name, global.type, global.isArray]), [
    ['当前用户', '文本型', false],
    ['访问次数', '整数型', false],
    ['标签列表', '文本型', true]
  ]);

  const added = applyLingCppAstEdit(source, { kind: 'add-global', global: { name: '启用缓存', type: '逻辑型', initialValue: '真', note: '跨窗口共享' } });
  assert.equal(added.success, true);
  const updated = applyLingCppAstEdit(added.sourceCode, { kind: 'update-global', globalName: '访问次数', newName: '累计访问', initialValue: '2' });
  assert.equal(updated.success, true);
  const deleted = applyLingCppAstEdit(updated.sourceCode, { kind: 'delete-global', globalName: '标签列表' });
  assert.equal(deleted.success, true);
  assert.deepEqual(parseLingCpp(deleted.sourceCode).program.globals.map(global => global.name), ['当前用户', '累计访问', '启用缓存']);
});

test('项目全局变量初始化仅允许安全表达式和前置声明', () => {
  const invalid = [
    '全局 整数型 后声明 = 1',
    '全局 整数型 提前引用 = 真正后声明 + 1',
    '全局 整数型 真正后声明 = 2',
    '全局 文本型 非法调用 = 取当前时间()',
    '全局 文本型 数组值[] = "禁止"'
  ].join('\n');
  const messages = getProjectGlobalDiagnostics(invalid, globalPath).map(diagnostic => diagnostic.message).join('\n');
  assert.match(messages, /前面已经声明/u);
  assert.match(messages, /包含函数调用/u);
  assert.match(messages, /默认空数组/u);
  assert.equal(getProjectGlobalDiagnostics('全局 整数型 基数 = 2\n全局 整数型 合计 = (基数 + 3) * 2\n', globalPath).length, 0);
});

test('跨文件语言上下文提供全局补全并阻止智能误建局部变量', () => {
  const globals = createProjectGlobalContext(globalPath, '全局 文本型 当前用户 = "访客"\n');
  const source = '类 主窗口\n  事件 创建完毕()\n    当前用户 = "管理员"\n  结束\n结束类\n';
  const context = buildLingCppLanguageContext(source, undefined, undefined, 'src/demo/主窗口.lcpp', globals);
  const completions = getLingCppCompletionItems({ source, line: 3, column: 7, triggerText: '当前' }, context);
  assert.ok(completions.some(item => item.label === '当前用户' && item.detail.includes('项目全局')));
  const semanticDiagnostics = getLingCppSemanticDiagnostics(source, undefined, 'src/demo/主窗口.lcpp', undefined, globals);
  assert.equal(semanticDiagnostics.some(item => /变量 .*尚未声明/u.test(item.message)), false, JSON.stringify(semanticDiagnostics));
  const method = context.program.classes[0].methods[0];
  assert.equal(analyzeBeginnerAutoLocalAssignment({ lineText: '当前用户 = "管理员"', method, ownerClass: context.program.classes[0], globals: globals.globals }).kind, 'none');
});

test('项目全局变量定义跳转和跨文件重命名跳过字符串及注释', () => {
  const globals = createProjectGlobalContext(globalPath, '全局 文本型 当前用户 = "访客"\n');
  assert.deepEqual(findProjectGlobalDefinition('当前用户', globals)?.line, 1);
  const renamed = renameProjectGlobalAcrossSources([
    { filePath: globalPath, sourceCode: globals.sourceCode },
    { filePath: 'src/demo/主窗口.lcpp', sourceCode: '类 主窗口\n  事件 创建完毕()\n    当前用户 = "当前用户" // 当前用户只是备注\n  结束\n结束类\n' }
  ], globals, '当前用户', '登录用户');
  assert.match(renamed[0].sourceCode, /全局 文本型 登录用户/u);
  assert.match(renamed[1].sourceCode, /登录用户 = "当前用户" \/\/ 当前用户只是备注/u);
});

test('多窗口源码共享同一 C++ 全局命名空间并生成逐文件映射', () => {
  const project: LingWindowProject = {
    id: 'demo', name: '全局变量演示', windows: [
      { id: 'main', fileName: '主窗口.xml', className: '主窗口', title: '主窗口', description: '主窗口', width: 640, height: 480, background: '#ffffff', controls: [] },
      { id: 'child', fileName: '子窗口.xml', className: '子窗口', title: '子窗口', description: '子窗口', width: 480, height: 320, background: '#ffffff', controls: [] }
    ]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main',
    lingCppSources: [
      { filePath: globalPath, sourceCode: '全局 文本型 当前用户 = "访客"\n全局 整数型 访问次数 = 0\n' },
      { filePath: 'src/demo/主窗口.lcpp', sourceCode: '类 主窗口\n  事件 创建完毕()\n    访问次数 = 访问次数 + 1\n  结束\n结束类\n' },
      { filePath: 'src/demo/子窗口.lcpp', sourceCode: '类 子窗口\n  事件 创建完毕()\n    调试输出(当前用户, 访问次数)\n  结束\n结束类\n' }
    ]
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(mainCpp, /namespace LingBuilderProjectGlobals/u);
  assert.match(mainCpp, /std::wstring 当前用户 = L"访客";/u);
  assert.match(mainCpp, /int 访问次数 = 0;/u);
  assert.ok(generated.sourceMap.some(entry => entry.kind === 'global' && entry.sourceFile === globalPath));
  assert.ok(generated.sourceMap.some(entry => entry.kind === 'class' && entry.sourceFile === 'src/demo/主窗口.lcpp'));
  assert.ok(generated.sourceMap.some(entry => entry.kind === 'class' && entry.sourceFile === 'src/demo/子窗口.lcpp'));
  assert.equal(generated.blockingDiagnostics.length, 0);
});

test('错误文件位置、重复类名和重复全局名阻止多源码生成', () => {
  const project: LingWindowProject = { id: 'bad', name: '错误项目', windows: [{ id: 'main', fileName: 'A.xml', className: 'A', title: 'A', description: 'A', width: 320, height: 240, background: '#fff', controls: [] }] };
  const generated = generateLingCppNativeWin32Project(project, { lingCppSources: [
    { filePath: globalPath, sourceCode: '全局 整数型 重复 = 1\n全局 整数型 重复 = 2\n' },
    { filePath: 'src/demo/A.lcpp', sourceCode: '全局 整数型 放错位置 = 1\n类 A\n结束类\n' },
    { filePath: 'src/demo/A2.lcpp', sourceCode: '类 A\n结束类\n' }
  ] });
  assert.ok(generated.blockingDiagnostics.some(message => /只能声明/u.test(message)));
  assert.ok(generated.blockingDiagnostics.some(message => /重复/u.test(message)));
});
