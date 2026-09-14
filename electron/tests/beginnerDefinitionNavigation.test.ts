import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBeginnerLibraryCallAtCursor,
  resolveBeginnerFunctionLibraryDefinition
} from '../src/services/lingCpp/beginnerDefinitionNavigation';
import type { LingCppProjectFunctionLibrary } from '../src/services/lingCpp/types';

const libraries: LingCppProjectFunctionLibrary[] = [
  {
    name: '文本工具',
    filePath: 'src/功能/文本工具.lcpp',
    methods: [
      { name: '组装标题', returnType: '文本型', access: '公开', line: 17, parameters: [{ name: '模块名', type: '文本型' }], locals: [], statements: [] },
      { name: '是空文本', returnType: '逻辑型', access: '私有', line: 31, parameters: [{ name: '内容', type: '文本型' }], locals: [], statements: [] }
    ]
  } as unknown as LingCppProjectFunctionLibrary
];

const SOURCE = [
  '    列表视图_添加行(结果列表, 组装行("文本工具.组装标题", 文本工具.组装标题("功能代码演示")))',
  '    @提示.c_str()',
  ''
].join('\n');

function cursorOver(source: string, needle: string, offsetInNeedle = 0): number {
  const index = source.indexOf(needle);
  assert.ok(index >= 0, `source should contain ${needle}`);
  return index + offsetInNeedle;
}

test('限定调用识别：光标落在库名或功能名上均可命中', () => {
  const line = SOURCE.split('\n')[0];
  const overLibrary = cursorOver(line, '文本工具.组装标题("功能代码演示")', 1);
  const overFunction = cursorOver(line, '文本工具.组装标题("功能代码演示")', '文本工具.'.length + 1);

  const libraryHit = getBeginnerLibraryCallAtCursor(SOURCE, overLibrary, libraries);
  assert.ok(libraryHit);
  assert.equal(libraryHit.libraryName, '文本工具');
  assert.equal(libraryHit.functionName, '组装标题');

  const functionHit = getBeginnerLibraryCallAtCursor(SOURCE, overFunction, libraries);
  assert.ok(functionHit);
  assert.equal(functionHit.functionName, '组装标题');
});

test('限定调用识别：字符串、内嵌 C++ 行与未知名称不命中', () => {
  // 字符串里的 "文本工具.组装标题" 不是调用：光标在字符串内应返回 null
  const line = SOURCE.split('\n')[0];
  const inString = cursorOver(line, '"文本工具.组装标题"', 5);
  assert.equal(getBeginnerLibraryCallAtCursor(SOURCE, inString, libraries), null);

  // @ 行的 提示.c_str() 是原生成员调用
  const nativeLine = SOURCE.split('\n')[1];
  const nativeCursor = cursorOver(SOURCE, '@提示.c_str()', 4);
  assert.ok(nativeLine.startsWith('    @'));
  assert.equal(getBeginnerLibraryCallAtCursor(SOURCE, nativeCursor, libraries), null);

  // 未登记的功能库/功能
  const unknownSource = '    本地工具.组装标题("x")';
  assert.equal(getBeginnerLibraryCallAtCursor(unknownSource, cursorOver(unknownSource, '本地工具.', 1), libraries), null);
});

test('功能库定义解析：返回库文件路径与方法，大小写不敏感', () => {
  const definition = resolveBeginnerFunctionLibraryDefinition(libraries, '文本工具', '组装标题');
  assert.ok(definition);
  assert.equal(definition.filePath, 'src/功能/文本工具.lcpp');
  assert.equal(definition.method.line, 17);
  assert.equal(definition.method.access, '公开');

  assert.equal(resolveBeginnerFunctionLibraryDefinition(libraries, '数值工具', '组装标题'), undefined);
  assert.equal(resolveBeginnerFunctionLibraryDefinition(libraries, '文本工具', '不存在'), undefined);
});
