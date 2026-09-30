import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBeginnerLibraryCallAtCursor,
  getBeginnerLocalReferenceAtCursor,
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

const LOCAL_SOURCE = [
  '    结果 = ""',
  '    段数 = 文本_分割(原文, 旧, 分段, 假)',
  '    计次循环首(段数, i)',
  '        结果 = 结果 + 数组_取成员(分段, i - 1)',
  '    计次循环尾()',
  '    返回(结果)',
  '    // 段数 在注释里不算引用',
  '    调试输出("段数 在字符串里不算引用")'
].join('\n');

const LOCAL_DECLARATIONS = [
  { name: '原文', line: 12, kind: 'parameter' as const },
  { name: '分段', line: 34, kind: 'local' as const },
  { name: '段数', line: 35, kind: 'local' as const },
  { name: '上限', line: 36, kind: 'constant' as const },
  { name: 'i', line: 37, kind: 'local' as const }
];

test('局部引用识别：光标落在局部变量上命中声明行', () => {
  // 计次循环首(段数, i) 里的 段数，光标落在中间
  const loopLine = LOCAL_SOURCE.split('\n')[2];
  const cursor = LOCAL_SOURCE.indexOf(loopLine) + '    计次循环首('.length + 1;
  const hit = getBeginnerLocalReferenceAtCursor(LOCAL_SOURCE, cursor, LOCAL_DECLARATIONS);
  assert.ok(hit);
  assert.equal(hit.name, '段数');
  assert.equal(hit.line, 35);
  assert.equal(hit.kind, 'local');

  // 光标落在标识符末尾（紧贴逗号）也算命中
  const tailCursor = LOCAL_SOURCE.indexOf('段数, i') + '段数'.length;
  const tailHit = getBeginnerLocalReferenceAtCursor(LOCAL_SOURCE, tailCursor, LOCAL_DECLARATIONS);
  assert.ok(tailHit);
  assert.equal(tailHit.name, '段数');

  // 参数与局部常量带各自 kind
  const paramCursor = LOCAL_SOURCE.indexOf('原文, 旧') + 1;
  const paramHit = getBeginnerLocalReferenceAtCursor(LOCAL_SOURCE, paramCursor, LOCAL_DECLARATIONS);
  assert.ok(paramHit);
  assert.equal(paramHit.kind, 'parameter');
});

test('局部引用识别：字符串、注释、@ 行、文本块与未知名称不命中', () => {
  // 注释里的 段数
  const commentCursor = LOCAL_SOURCE.indexOf('// 段数 在注释里') + '// '.length;
  assert.equal(getBeginnerLocalReferenceAtCursor(LOCAL_SOURCE, commentCursor, LOCAL_DECLARATIONS), null);

  // 字符串里的 段数
  const stringCursor = LOCAL_SOURCE.indexOf('"段数 在字符串里') + 1;
  assert.equal(getBeginnerLocalReferenceAtCursor(LOCAL_SOURCE, stringCursor, LOCAL_DECLARATIONS), null);

  // @ 内嵌 C++ 行不识别
  const nativeSource = '    @int count = 段数_count;';
  assert.equal(getBeginnerLocalReferenceAtCursor(nativeSource, nativeSource.indexOf('段数') + 1, LOCAL_DECLARATIONS), null);

  // 多行文本块内不识别
  const blockSource = '    提示 = """\n段数\n"""\n';
  assert.equal(getBeginnerLocalReferenceAtCursor(blockSource, blockSource.indexOf('段数') + 1, LOCAL_DECLARATIONS), null);

  // 未声明的名字（命令名/关键字）不命中
  const commandCursor = LOCAL_SOURCE.indexOf('文本_分割(') + 1;
  assert.equal(getBeginnerLocalReferenceAtCursor(LOCAL_SOURCE, commandCursor, LOCAL_DECLARATIONS), null);

  // 空声明表直接返回 null
  assert.equal(getBeginnerLocalReferenceAtCursor(LOCAL_SOURCE, 1, []), null);
});
