import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBeginnerCommandExpansion,
  updateBeginnerCommandArgument
} from '../src/services/lingCpp/beginnerCommandExpansion';
import { analyzeBeginnerAutoLocalCommandArgument } from '../src/services/lingCpp/beginnerAutoLocalService';
import { parseLingCpp } from '../src/services/lingCpp/parser';

const catalog = {
  网页_访问_对象: [
    { name: '网址', type: '文本型' },
    { name: '访问方式', type: '整数型' },
    { name: '提交信息', type: '文本型' },
    { name: '提交Cookies', type: '文本型' }
  ]
};

test('多参数赋值命令展开时保留接收变量和等号', () => {
  const expansion = parseBeginnerCommandExpansion(
    '返回字节 = 网页_访问_对象("https://example.com?a=1,b=2", 1, 生成正文("a", "b"))',
    catalog
  );

  assert.equal(expansion?.receiver, '返回字节');
  assert.equal(expansion?.operator, '=');
  assert.equal(expansion?.commandName, '网页_访问_对象');
  assert.deepEqual(expansion?.arguments.slice(0, 3).map(argument => argument.value), [
    '"https://example.com?a=1,b=2"',
    '1',
    '生成正文("a", "b")'
  ]);
  assert.equal(expansion?.arguments[3]?.provided, false);
  assert.equal(expansion?.arguments[3]?.name, '提交Cookies');
});

test('已知多参数命令即使省略可选参数仍可展开', () => {
  const expansion = parseBeginnerCommandExpansion('网页_访问_对象("https://example.com") // 使用默认访问方式', catalog);

  assert.equal(expansion?.arguments.length, 4);
  assert.equal(expansion?.arguments[0]?.provided, true);
  assert.equal(expansion?.arguments[1]?.provided, false);
});

test('未知单参数命令不显示展开入口，未知多参数命令使用序号参数名', () => {
  assert.equal(parseBeginnerCommandExpansion('打开窗口("主窗口")'), null);
  const expansion = parseBeginnerCommandExpansion('调试输出("结果：", 获取结果(1, 2))');
  assert.equal(expansion?.arguments[0]?.name, '参数 1');
  assert.equal(expansion?.arguments[1]?.value, '获取结果(1, 2)');
});

test('全角赋值符也按等号结构显示且不会误判字符串中的等号', () => {
  const expansion = parseBeginnerCommandExpansion('返回字节 ＝ 网页_访问_对象("a=b", 0)', catalog);
  assert.equal(expansion?.operator, '=');
  assert.equal(expansion?.receiver, '返回字节');
  assert.equal(expansion?.arguments[0]?.value, '"a=b"');
});

test('展开参数编辑会写回原命令行并保留缩进和注释', () => {
  const updated = updateBeginnerCommandArgument(
    '        返回字节 = 网页_访问_对象(网址, 0) // GET 请求',
    catalog,
    1,
    '1'
  );
  assert.equal(updated, '        返回字节 = 网页_访问_对象(网址, 1) // GET 请求');
});

test('编辑后置可选参数时按类型补齐中间位置参数', () => {
  const updated = updateBeginnerCommandArgument(
    '网页_访问_对象(网址)',
    catalog,
    3,
    '"session=LingBuilder"'
  );
  assert.equal(updated, '网页_访问_对象(网址, 0, "", "session=LingBuilder")');
});

test('清空尾部参数会恢复为省略状态', () => {
  const updated = updateBeginnerCommandArgument(
    '网页_访问_对象(网址, 1, "正文")',
    catalog,
    2,
    ''
  );
  assert.equal(updated, '网页_访问_对象(网址, 1)');
});

test('返回类参数填写未声明标识符时推断并自动声明对应类型', () => {
  const parsed = parseLingCpp(`类 测试窗口 : 公开 窗体
公开:
    空 测试请求()
        局部 字节集 返回字节
        返回字节 = 网页_访问_对象("https://example.com", 0)
    结束
结束类`);
  const ownerClass = parsed.program.classes[0];
  const method = ownerClass.methods[0];

  assert.deepEqual(analyzeBeginnerAutoLocalCommandArgument({
    value: '返回cookie',
    parameterName: '返回Cookies',
    parameterType: '文本型',
    method,
    ownerClass
  }), {
    kind: 'declare',
    name: '返回cookie',
    inferredType: '文本型'
  });
  assert.deepEqual(analyzeBeginnerAutoLocalCommandArgument({
    value: '状态码',
    parameterName: '返回状态代码',
    parameterType: '整数型',
    method,
    ownerClass
  }), {
    kind: 'declare',
    name: '状态码',
    inferredType: '整数型'
  });
});

test('普通输入参数、表达式和已声明变量不会触发自动局部变量', () => {
  const parsed = parseLingCpp(`类 测试窗口 : 公开 窗体
公开:
    空 测试请求()
        局部 文本型 已有Cookie
        调试输出(已有Cookie)
    结束
结束类`);
  const ownerClass = parsed.program.classes[0];
  const method = ownerClass.methods[0];
  const analyze = (value: string, parameterName: string, parameterType = '文本型') =>
    analyzeBeginnerAutoLocalCommandArgument({ value, parameterName, parameterType, method, ownerClass });

  assert.equal(analyze('网址变量', '网址').kind, 'none');
  assert.equal(analyze('网页_取返回Cookies()', '返回Cookies').kind, 'none');
  assert.equal(analyze('"返回cookie"', '返回Cookies').kind, 'none');
  assert.deepEqual(analyze('已有Cookie', '返回Cookies'), { kind: 'none', reason: 'already-declared' });
});
