import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLingCpp } from '../src/services/lingCpp/parser';
import {
  createBeginnerLibraryFunctionCompletions,
  getBeginnerDefaultArgument
} from '../src/services/lingCpp/beginnerLibraryCompletion';
import type { LingCppFunctionLibrary } from '../src/services/lingCpp/types';

function buildLibraries(source: string): LingCppFunctionLibrary[] {
  return parseLingCpp(source).program.functionLibraries;
}

const cookieLibrarySource = [
  '功能库 Cookie导出',
  '公开:',
  '  整数型 读取(文本型 路径, 逻辑型 仅会话)',
  '    返回(0)',
  '  结束',
  '  文本型 取用户目录()',
  '    返回("")',
  '  结束',
  '私有:',
  '  空 内部清理()',
  '    返回()',
  '  结束',
  '结束功能库',
  ''
].join('\n');

test('跨文件功能库公开功能折叠成 库名.功能名 限定名补全条目', () => {
  const items = createBeginnerLibraryFunctionCompletions(buildLibraries(cookieLibrarySource));
  assert.equal(items.length, 2);

  const read = items.find(item => item.label === 'Cookie导出.读取');
  assert.ok(read, '公开功能 读取 应生成限定名条目');
  assert.equal(read.detail, '整数型 子程序调用');
  assert.equal(read.insertText, 'Cookie导出.读取("文本", 真)');
  assert.equal(read.kind, '子程序');
  assert.ok(read.aliases.includes('读取'), '别名应含裸功能名，支持手打裸名包含命中');
  assert.ok(read.aliases.includes('Cookie导出'), '别名应含库名');

  const dir = items.find(item => item.label === 'Cookie导出.取用户目录');
  assert.ok(dir, '无参公开功能也应生成条目');
  assert.equal(dir.insertText, 'Cookie导出.取用户目录()');
});

test('私有功能不进入跨文件补全条目', () => {
  const items = createBeginnerLibraryFunctionCompletions(buildLibraries(cookieLibrarySource));
  assert.ok(!items.some(item => item.label === 'Cookie导出.内部清理'));
});

test('excludeLibraryNames 按标识符归一整库排除，当前文件自己的功能库不重复出条目', () => {
  const libraries = buildLibraries(cookieLibrarySource);
  assert.equal(createBeginnerLibraryFunctionCompletions(libraries, ['Cookie导出']).length, 0);
  assert.equal(createBeginnerLibraryFunctionCompletions(libraries, [' Cookie导出 ']).length, 0);
  // 与功能库名称匹配同口径：normalizeIdentifier 不折叠大小写，大小写不同的两个库是合法并存的。
  assert.equal(createBeginnerLibraryFunctionCompletions(libraries, ['cookie导出']).length, 2);
  assert.equal(createBeginnerLibraryFunctionCompletions(libraries, ['其他库']).length, 2);
});

test('空清单与 undefined 安全返回空数组', () => {
  assert.deepEqual(createBeginnerLibraryFunctionCompletions(undefined), []);
  assert.deepEqual(createBeginnerLibraryFunctionCompletions([]), []);
});

test('限定名条目与补全 token 规则兼容：库名. 前缀与裸功能名都能命中', () => {
  // filterBeginnerCodeCompletions 的三档匹配：exact / startsWith / includes（searchValues = label + aliases 小写）。
  const items = createBeginnerLibraryFunctionCompletions(buildLibraries(cookieLibrarySource));
  const read = items.find(item => item.label === 'Cookie导出.读取')!;
  const searchValues = [read.label, ...read.aliases].map(value => value.toLowerCase());

  assert.ok(searchValues.some(value => value.startsWith('cookie导出.')), 'token `Cookie导出.` 应按 startsWith 命中');
  assert.ok(searchValues.some(value => value.startsWith('cookie导出.读')), 'token `Cookie导出.读` 应按 startsWith 命中');
  assert.ok(searchValues.some(value => value === '读取'), 'token `读取` 应按 exact 命中（上屏替换 token 后补出完整限定调用）');
});

test('默认实参按参数类型映射，与当前文件子程序条目同一口径', () => {
  assert.equal(getBeginnerDefaultArgument({ name: '路径', type: '文本型' }), '"文本"');
  assert.equal(getBeginnerDefaultArgument({ name: '仅会话', type: '逻辑型' }), '真');
  assert.equal(getBeginnerDefaultArgument({ name: '次数', type: '整数型' }), '0');
  assert.equal(getBeginnerDefaultArgument({ name: '时长', type: '长整数型' }), '0');
  assert.equal(getBeginnerDefaultArgument({ name: '比例', type: '小数型' }), '0.0');
  assert.equal(getBeginnerDefaultArgument({ name: '比例', type: '双精度小数型' }), '0.0');
  assert.equal(getBeginnerDefaultArgument({ name: '数据', type: '字节集' }), '数据');
  assert.equal(getBeginnerDefaultArgument({ name: '超时', type: '整数型', defaultValue: ' 30 ' }), '30');
});
