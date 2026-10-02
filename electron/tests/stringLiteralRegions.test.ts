import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLingCppStringLiteralMask, collectLingCppStringLiteralRegions } from '../src/services/lingCpp/stringLiteralRegions';
import { isPlausibleCppPassthroughExpression, splitEplBinaryExpression } from '../src/services/windowDesigner/eplToCppRules';
import { parseLingCpp } from '../src/services/lingCpp/parser';
import { getLingCppSemanticDiagnostics } from '../src/services/lingCpp/languageService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { LingWindowProject } from '../src/services/windowDesigner/types';
import { InstalledModule } from '../src/services/modules/types';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';

test('字符串区间扫描：转义双引号、连续反斜杠奇偶、中文引号、单引号与未闭合', () => {
  // 基础：`\"` 不结束字符串（缺陷报告原形）。
  const escaped = collectLingCppStringLiteralRegions('"q\\"uote"');
  assert.equal(escaped.length, 1);
  assert.equal(escaped[0].start, 0);
  assert.equal(escaped[0].end, 9);
  assert.equal(escaped[0].closed, true);

  // 连续反斜杠奇偶：`"a\\"`（`\\` 是转义的反斜杠，引号正常闭合）。
  const evenBackslashes = collectLingCppStringLiteralRegions('"a\\\\"');
  assert.equal(evenBackslashes.length, 1);
  assert.equal(evenBackslashes[0].closed, true);
  assert.equal(evenBackslashes[0].end, 5);

  // `"a\\\\"`：两个转义反斜杠，闭合。
  assert.equal(collectLingCppStringLiteralRegions('"a\\\\\\\\"')[0].closed, true);

  // `"a\\\""`：第三个反斜杠转义了引号，字符串未闭合。
  const oddBackslashQuote = collectLingCppStringLiteralRegions('"a\\\\\\"');
  assert.equal(oddBackslashQuote.length, 1);
  assert.equal(oddBackslashQuote[0].closed, false);
  assert.equal(oddBackslashQuote[0].end, 6);

  // 中文引号：不解释反斜杠转义，遇第一个配对的 ” 结束（与既有 splitCallArguments 语义一致）。
  const chinese = collectLingCppStringLiteralRegions('前“中”后');
  assert.equal(chinese.length, 1);
  assert.equal(chinese[0].quote, '“');
  assert.equal(chinese[0].start, 1);
  assert.equal(chinese[0].end, 4);
  assert.equal(chinese[0].closed, true);
  assert.equal(collectLingCppStringLiteralRegions('“未闭合')[0].closed, false);

  // 未闭合的 ASCII 引号延伸到文本末尾。
  const unterminated = collectLingCppStringLiteralRegions('丁 = "未闭合');
  assert.equal(unterminated.length, 1);
  assert.equal(unterminated[0].closed, false);
  assert.equal(unterminated[0].end, 8);

  // 单引号仅按需识别。
  assert.equal(collectLingCppStringLiteralRegions("'a'").length, 0);
  assert.equal(collectLingCppStringLiteralRegions("'a'", { recognizeSingleQuotes: true }).length, 1);
  assert.equal(collectLingCppStringLiteralRegions("'a\\''", { recognizeSingleQuotes: true })[0].closed, true);

  // 掩码：字符串区间（含引号）整体标记，外部保持 0。
  const mask = buildLingCppStringLiteralMask('a + "x+y"');
  assert.equal(Array.from(mask).join(''), '000011111');
});

test('splitEplBinaryExpression：拼接表达式含 \\" 时仍能找到顶层运算符（缺陷主修）', () => {
  const defect = '报告 + 转义拼接复现.收("需转义字符", "mms.pinduoduo.com", "q\\"uote", "back", "/a b", 真, 假, 0, -1)';
  const split = splitEplBinaryExpression(defect);
  assert.ok(split, '含 \\" 的拼接表达式必须能拆分');
  assert.equal(split.operator, '+');
  assert.equal(split.left, '报告');
  assert.equal(split.right, '转义拼接复现.收("需转义字符", "mms.pinduoduo.com", "q\\"uote", "back", "/a b", 真, 假, 0, -1)');

  // 连续反斜杠三种奇偶形态都必须正常拆分（`"a\\\""` 是未闭合字符串，区间同样不透明）。
  for (const literal of ['"a\\\\"', '"a\\\\\\\\"', '"a\\\\\\"']) {
    const result = splitEplBinaryExpression(`报告 + 甲.收(${literal})`);
    assert.ok(result, `字面量 ${literal} 必须能拆分拼接表达式`);
    assert.equal(result.operator, '+');
  }

  // 既有语义不回归：字符串内的运算符不参与拆分。
  const insideString = splitEplBinaryExpression('a + "x+y"');
  assert.ok(insideString);
  assert.equal(insideString.left, 'a');
  assert.equal(insideString.right, '"x+y"');
  const quotedOperator = splitEplBinaryExpression('"+" + b');
  assert.ok(quotedOperator);
  assert.equal(quotedOperator.left, '"+"');
  assert.equal(quotedOperator.right, 'b');

  // 中文运算符与括号。
  assert.equal(splitEplBinaryExpression('真 或 假')?.operator, '或');
  assert.equal(splitEplBinaryExpression('(a + b) + c')?.right, 'c');
});

test('isPlausibleCppPassthroughExpression：只有合法 C++ 形态才允许透传', () => {
  assert.equal(isPlausibleCppPassthroughExpression('-1'), true);
  assert.equal(isPlausibleCppPassthroughExpression('甲[0]'), true);
  assert.equal(isPlausibleCppPassthroughExpression('(甲)[0]'), true);
  assert.equal(isPlausibleCppPassthroughExpression(''), false);
  assert.equal(isPlausibleCppPassthroughExpression('甲["键"]'), false);
  assert.equal(isPlausibleCppPassthroughExpression('"未闭合'), false);
  assert.equal(isPlausibleCppPassthroughExpression('“未闭合'), false);
  assert.equal(isPlausibleCppPassthroughExpression('a、b'), false);
  assert.equal(isPlausibleCppPassthroughExpression('（x）'), false);
});

test('parser 形参拆分：默认值含 \\" 与字符串内等号不再拆错位', () => {
  const source = [
    '类 测试类',
    '公开:',
    '    整数型 校验(文本型 名 = "a\\"b", 整数型 个数 = 3, 逻辑型 开 = 真)',
    '        返回 (0)',
    '    结束',
    '    整数型 校验等号(文本型 名2 = "a=\\"=\\"b")',
    '        返回 (0)',
    '    结束',
    '    整数型 校验多参(文本型 a, 文本型 b = "q\\"uote", 整数型 c)',
    '        返回 (0)',
    '    结束',
    '结束类'
  ].join('\n');
  const parsed = parseLingCpp(source);
  const methods = parsed.program.classes[0].methods;

  const check = methods.find(method => method.name === '校验');
  assert.ok(check);
  assert.equal(check.parameters.length, 3);
  assert.equal(check.parameters[0].name, '名');
  assert.equal(check.parameters[0].type, '文本型');
  assert.equal(check.parameters[0].defaultValue, '"a\\"b"');
  assert.equal(check.parameters[1].defaultValue, '3');
  assert.equal(check.parameters[2].defaultValue, '真');

  const equalSign = methods.find(method => method.name === '校验等号');
  assert.ok(equalSign);
  assert.equal(equalSign.parameters.length, 1);
  assert.equal(equalSign.parameters[0].name, '名2');
  assert.equal(equalSign.parameters[0].defaultValue, '"a=\\"=\\"b"');

  const multi = methods.find(method => method.name === '校验多参');
  assert.ok(multi);
  assert.deepEqual(multi.parameters.map(parameter => parameter.name), ['a', 'b', 'c']);
  assert.equal(multi.parameters[1].defaultValue, '"q\\"uote"');
});

const win32Modules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({
  manifest: BUILTIN_MODULES.find(item => item.id === id)!,
  installPath: 'builtin',
  isBuiltin: true,
  isInstalled: true,
  isEnabledForProject: true,
  diagnostics: []
}));

const escapeLibraryProject: LingWindowProject = {
  id: 'escape-repro',
  name: '转义拼接复现',
  windows: [
    {
      id: 'window-1',
      fileName: 'MainWindow.xml',
      className: '游戏主窗体',
      title: '转义拼接复现',
      width: 800,
      height: 600,
      background: '#1E1E24',
      description: '主窗体',
      controls: []
    }
  ]
};

const escapeWindowSource = [
  '类 游戏主窗体 : 公开 窗体',
  '公开:',
  '    事件 _游戏主窗体_创建完毕()',
  '        调试输出("就绪")',
  '    结束',
  '结束类'
].join('\n');

const escapeLibrarySource = [
  '功能库 转义拼接复现',
  '公开:',
  '  文本型 收(文本型 标题, 文本型 域, 文本型 名, 文本型 值, 文本型 路, 逻辑型 安全, 逻辑型 只, 长整数型 期, 整数型 站)',
  '    返回 (标题 + 域 + 名 + 值 + 路)',
  '  结束',
  '',
  '  文本型 简单赋值对照()',
  '    局部 文本型 丙1',
  '    局部 文本型 丙5',
  '    丙1 = 转义拼接复现.收("需转义字符", "mms.pinduoduo.com", "q\\"uote", "back\\\\slash\\ttab", "/a b", 真, 假, 0, -1)',
  '    丙5 = 转义拼接复现.收("需转义字符", "mms.pinduoduo.com", "q\\"uote", "back", "/a b", 真, 假, 0, -1)',
  '    返回 (丙1 + 丙5)',
  '  结束',
  '',
  '  文本型 拼接触发()',
  '    局部 文本型 丁1',
  '    局部 文本型 丁2',
  '    局部 文本型 丁3',
  '    局部 文本型 己1',
  '    局部 文本型 己2',
  '    局部 文本型 报告',
  '    报告 = ""',
  '    丁1 = 报告 + 转义拼接复现.收("需转义字符", "mms.pinduoduo.com", "q\\"uote", "back\\\\slash\\ttab", "/a b", 真, 假, 0, -1)',
  '    丁2 = 报告 + 转义拼接复现.收("需转义字符", "mms.pinduoduo.com", "quote", "back", "/a b", 真, 假, 0, -1)',
  '    丁3 = 报告 + 转义拼接复现.收("需转义字符", "mms.pinduoduo.com", "q\\"uote", "back", "/a b", 真, 假, 0, -1)',
  '    己1 = 报告 + 转义拼接复现.收("需转义字符", "mms.pinduoduo.com", "quote", "back\\\\slash", "/a b", 真, 假, 0, -1)',
  '    己2 = 报告 + 转义拼接复现.收("需转义字符", "mms.pinduoduo.com", "quote", "back\\ttab", "/a b", 真, 假, 0, -1)',
  '    返回 (丁1 + 丁2 + 丁3 + 己1 + 己2)',
  '  结束',
  '结束功能库'
].join('\n');

test('生成器端到端：转义拼接复现用例全部翻译为 LBFL 调用，不再原样吐中文', () => {
  const generated = generateLingCppNativeWin32Project(escapeLibraryProject, {
    lingCppSourceCode: escapeWindowSource,
    lingCppSources: [
      { filePath: 'src/MainWindow.lcpp', sourceCode: escapeWindowSource },
      { filePath: 'src/转义拼接复现.lcpp', sourceCode: escapeLibrarySource }
    ],
    enabledModules: win32Modules
  });
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
  // 运行时拆分（2026-09-30）后窗口/事件代码在 main.cpp、功能库方法在 lingbuilder_runtime.h，
  // 断言面向两份生成文本的拼接。
  const cpp = generated.files
    .filter(file => file.relativePath === 'main.cpp' || file.relativePath === 'lingbuilder_runtime.h')
    .map(file => file.content)
    .join('\n');

  // 简单赋值与拼接两种形态都翻译为功能库调用；`\"` 解释为内容引号（与词法扫描器口径一致），
  // `\\` 恒生成 C++ 的 `\\`、`\t` 生成制表转义（2026-10-01 转义根治）。
  assert.match(cpp, /丁1 = 报告\+LBFL_转义拼接复现_收\(L"需转义字符", L"mms\.pinduoduo\.com", L"q\\"uote", L"back\\\\slash\\ttab", L"\/a b", true, false, 0, -1\);/u);
  assert.match(cpp, /丁3 = 报告\+LBFL_转义拼接复现_收\(L"需转义字符", L"mms\.pinduoduo\.com", L"q\\"uote", L"back", L"\/a b", true, false, 0, -1\);/u);
  assert.match(cpp, /丙1 = LBFL_转义拼接复现_收\(L"需转义字符"/u);
  assert.match(cpp, /己1 = 报告\+LBFL_转义拼接复现_收\([^\n]*L"back\\\\slash", L"\/a b", true, false, 0, -1\);/u);
  assert.match(cpp, /己2 = 报告\+LBFL_转义拼接复现_收\([^\n]*L"back\\ttab", L"\/a b", true, false, 0, -1\);/u);

  // 不再出现整句中文原样输出。
  assert.doesNotMatch(cpp, /丁[13] = 报告 \+ 转义拼接复现/u);
  assert.doesNotMatch(cpp, /转义拼接复现\.收\(/u);
  assert.doesNotMatch(cpp, /丁3 = [^\n]*(真|假),/u);
});

test('生成器兜底加固：确实无法翻译的表达式按空文本降级并给出中文阻断诊断', () => {
  const source = [
    '类 游戏主窗体 : 公开 窗体',
    '公开:',
    '    事件 _游戏主窗体_创建完毕()',
    '        局部 文本型 甲',
    '        局部 文本型 键文本',
    '        键文本 = 甲["键"]',
    '        调试输出("就绪")',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(escapeLibraryProject, {
    lingCppSourceCode: source,
    lingCppSources: [{ filePath: 'src/MainWindow.lcpp', sourceCode: source }],
    enabledModules: win32Modules
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(cpp.includes('键文本 = L"" /* 无法翻译的表达式：甲["键"] */'), '无法翻译的表达式必须降级为空文本加注释');
  const blocking = generated.blockingDiagnostics.find(message => message.includes('无法翻译成 C++'));
  assert.ok(blocking, '必须产出中文阻断诊断');
  assert.match(blocking, /第 6 行/u);
  assert.match(blocking, /src\/MainWindow\.lcpp/u);
});

test('语言服务：未闭合字符串给出中文错误与行列，转义与文本块不误报', () => {
  const source = [
    '类 测试类',
    '公开:',
    '    事件 取值被单击()',
    '        局部 文本型 丁',
    '        丁 = "未闭合',
    '        丁 = "a\\\\"',
    '    结束',
    '结束类'
  ].join('\n');
  const diagnostics = getLingCppSemanticDiagnostics(source, undefined, 'src/MainWindow.lcpp');
  const hit = diagnostics.find(item => item.id === 'lingcpp-string-unterminated-5');
  assert.ok(hit, '未闭合字符串必须给出诊断');
  assert.equal(hit.level, 'error');
  assert.match(hit.message, /缺少收尾引号/);
  assert.ok(hit.range);
  assert.equal(hit.range!.startLine, 5);
  assert.equal(hit.range!.startColumn, 13);
  assert.equal(diagnostics.find(item => item.id === 'lingcpp-string-unterminated-6'), undefined, '闭合的转义反斜杠不误报');

  // `@` 内嵌 C++ 行与多行文本块整体跳过。
  const exemptSource = [
    '类 测试类',
    '公开:',
    '    事件 取值被单击()',
    '        @ const wchar_t* raw = "unclosed;',
    '        丁 = """',
    '内容里有孤引号 "',
    '"""',
    '    结束',
    '结束类'
  ].join('\n');
  const exempt = getLingCppSemanticDiagnostics(exemptSource, undefined, 'src/MainWindow.lcpp');
  assert.equal(exempt.find(item => item.id.startsWith('lingcpp-string-unterminated')), undefined, '@ 行与文本块不检查');
});

test('生成器兜底加固：未闭合字符串同样降级并阻断，而不是吐出吞行的坏 C++', () => {
  const source = [
    '类 游戏主窗体 : 公开 窗体',
    '公开:',
    '    事件 _游戏主窗体_创建完毕()',
    '        局部 文本型 丁',
    '        丁 = "未闭合',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(escapeLibraryProject, {
    lingCppSourceCode: source,
    lingCppSources: [{ filePath: 'src/MainWindow.lcpp', sourceCode: source }],
    enabledModules: win32Modules
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(cpp.includes('/* 无法翻译的表达式：'), '未闭合字符串必须降级，不能原样吐进 C++');
  assert.ok(generated.blockingDiagnostics.some(message => message.includes('无法翻译成 C++')));
});

test('生成器字面量转义根治：\\\\ 优先于字母转义，串首/串中不再吐三反斜杠', () => {
  // 缺陷原案（2026-10-01）：`"\\runtime\\…"` 曾生成 `L"\\\runtime…"`——`\\` 折叠后剩下的
  // `\r` 与 r 结合成回车，路径写坏且 文件_追加文本 静默失败。旧实现是 replace 链先处理
  // \t/\n/\r 最后折叠 `\\`；根治后单趟扫描、`\\` 配对先于字母转义消费。
  const source = [
    '类 游戏主窗体 : 公开 窗体',
    '公开:',
    '    事件 _游戏主窗体_创建完毕()',
    '        局部 文本型 路径 = "\\\\runtime\\\\运行日志.txt"',
    '        局部 文本型 名单 = "日志\\\\name"',
    '        局部 文本型 前缀串 = "前缀\\\\temp"',
    '        局部 文本型 制表 = "列1\\t列2"',
    '        局部 文本型 双斜 = "C:\\\\\\\\dir\\\\\\\\a.txt"',
    '        局部 文本型 引号 = "说\\"你好\\""',
    '        局部 文本型 对照甲 = "runtime\\\\代理配置.txt"',
    '        局部 文本型 对照乙 = "\\\\笔记详情响应.txt"',
    '        局部 文本型 反例甲 = "\\\\xray.txt"',
    '        局部 文本型 反例乙 = "\\\\0tail.txt"',
    '        局部 文本型 反例丙 = "\\\\beta.txt"',
    '        调试输出("\\\\runtime\\\\运行日志.txt")',
    '        调试输出("工作区" + "\\\\notes\\\\tmp\\\\日志.txt")',
    '        调试输出("第一行\\n第二行")',
    '        调试输出("说\\"你好\\"")',
    '        信息框("前缀\\\\temp", 0, "标题")',
    '        窗口_设置自身标题("\\\\运行窗口")',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(escapeLibraryProject, {
    lingCppSourceCode: source,
    lingCppSources: [{ filePath: 'src/MainWindow.lcpp', sourceCode: source }],
    enabledModules: win32Modules
  });
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  // 串首/串中「双反斜杠 + t/n/r」：恒为两个反斜杠，不得出现三反斜杠接引导字母。
  assert.ok(cpp.includes('std::wstring 路径 = L"\\\\runtime\\\\运行日志.txt";'), '缺陷原案（赋值路径）');
  assert.ok(cpp.includes('std::wstring 名单 = L"日志\\\\name";'), '串中 \\\\n');
  assert.ok(cpp.includes('std::wstring 前缀串 = L"前缀\\\\temp";'), '串中 \\\\t');
  assert.ok(cpp.includes('调试输出((std::wstring(LingCppWideArg(L"工作区")) + LingCppWideArg(L"\\\\notes\\\\tmp\\\\日志.txt")));'), '拼接路径');
  assert.ok(cpp.includes('调试输出(L"\\\\runtime\\\\运行日志.txt");'), '调试输出单实参路径');
  assert.ok(!cpp.includes('L"\\\\\\r'), '禁止三反斜杠接字母 r');
  assert.ok(!cpp.includes('L"\\\\\\n'), '禁止三反斜杠接字母 n');
  assert.ok(!cpp.includes('L"\\\\\\t'), '禁止三反斜杠接字母 t');

  // 单个 \t/\n 仍解释为制表/换行（再转义为 C++ 转义序列）。
  assert.ok(cpp.includes('std::wstring 制表 = L"列1\\t列2";'), '\\t → 制表');
  assert.ok(cpp.includes('调试输出(L"第一行\\n第二行");'), '\\n → 换行');

  // \\\\ 合成两个反斜杠；\" 解释为内容引号。
  assert.ok(cpp.includes('std::wstring 双斜 = L"C:\\\\\\\\dir\\\\\\\\a.txt";'), '\\\\\\\\ → 两个反斜杠');
  assert.ok(cpp.includes('std::wstring 引号 = L"说\\"你好\\"";'), '\\" → 内容引号');
  assert.ok(cpp.includes('调试输出(L"说\\"你好\\"");'), '调试输出路径的 \\"');

  // 对照组：值不回归。
  assert.ok(cpp.includes('std::wstring 对照甲 = L"runtime\\\\代理配置.txt";'), '非串首反斜杠对照');
  assert.ok(cpp.includes('std::wstring 对照乙 = L"\\\\笔记详情响应.txt";'), '反斜杠 + 中文对照');
  assert.ok(cpp.includes('std::wstring 反例甲 = L"\\\\xray.txt";'), '\\\\x 反例（不得引入控制字符）');
  assert.ok(cpp.includes('std::wstring 反例乙 = L"\\\\0tail.txt";'), '\\\\0 反例');
  assert.ok(cpp.includes('std::wstring 反例丙 = L"\\\\beta.txt";'), '\\\\b 反例');

  // 信息框与模块 wideString 纯字面量实参同走统一出口。
  assert.ok(cpp.includes('信息框(L"前缀\\\\temp", MB_OK, L"标题");'), '信息框文本路径');
  assert.ok(cpp.includes('窗口_设置自身标题(L"\\\\运行窗口")'), '模块 wideString 纯字面量实参路径');
});

test('生成器字面量转义根治：同一字面量经两条发射路径得到相同的 C++ 字面量', () => {
  // 修复前：调试输出 单实参走「原文直出」、赋值/拼接走「C 风格解释」，同一字面量
  // 两条路径的运行时值不同（\n 在一边是字面反斜杠+n、另一边是换行）。收敛后必须一致。
  const literal = '日志A\\n日志B\\\\路径C\\t列D';
  const viaDebug = [
    '类 游戏主窗体 : 公开 窗体',
    '公开:',
    '    事件 _游戏主窗体_创建完毕()',
    `        调试输出("${literal}")`,
    '    结束',
    '结束类'
  ].join('\n');
  const viaAssignment = [
    '类 游戏主窗体 : 公开 窗体',
    '公开:',
    '    事件 _游戏主窗体_创建完毕()',
    '        局部 文本型 消息',
    `        消息 = "${literal}"`,
    '        调试输出(消息)',
    '    结束',
    '结束类'
  ].join('\n');
  const options = (src: string) => ({
    lingCppSourceCode: src,
    lingCppSources: [{ filePath: 'src/MainWindow.lcpp', sourceCode: src }],
    enabledModules: win32Modules
  });
  const debugCpp = generateLingCppNativeWin32Project(escapeLibraryProject, options(viaDebug))
    .files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const assignCpp = generateLingCppNativeWin32Project(escapeLibraryProject, options(viaAssignment))
    .files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const debugLiteral = debugCpp.match(/调试输出\((L"(?:[^"\\]|\\.)*")\);/u)?.[1];
  const assignLiteral = assignCpp.match(/消息 = (L"(?:[^"\\]|\\.)*");/u)?.[1];
  assert.ok(debugLiteral, '调试输出路径生成字面量');
  assert.ok(assignLiteral, '赋值路径生成字面量');
  assert.equal(debugLiteral, assignLiteral, `两条路径必须生成相同字面量：${debugLiteral} vs ${assignLiteral}`);
});
