import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeFunctionLibraryDependencyClosure,
  analyzeFunctionLibraryDependencies,
  createProjectFunctionContext,
  getFunctionLibraryDiagnostics,
  mergeFunctionLibraryProjectResources,
  renameFunctionLibraryAcrossSources
} from '../src/services/lingCpp/functionLibraryService';
import type { InstalledModule } from '../src/services/modules/types';
import { buildLingCppLanguageContext, getLingCppCompletionItems } from '../src/services/lingCpp/languageService';
import { parseLingCpp } from '../src/services/lingCpp/parser';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const libraryPath = 'src/功能/文本工具.lcpp';
const librarySource = [
  '功能库 文本工具',
  '公开:',
  '  文本型 合并(文本型 前缀, 文本型 内容)',
  '    返回(前缀 + 内容)',
  '  结束',
  '私有:',
  '  空 内部记录()',
  '    调试输出("内部")',
  '  结束',
  '结束功能库',
  ''
].join('\n');

test('功能库解析为独立无状态结构并保留公开和私有功能', () => {
  const result = parseLingCpp(librarySource);
  assert.equal(result.program.classes.length, 0);
  assert.equal(result.program.functionLibraries.length, 1);
  assert.deepEqual(result.program.functionLibraries[0]?.methods.map(method => [method.name, method.access, method.returnType]), [
    ['合并', '公开', '文本型'],
    ['内部记录', '私有', '空']
  ]);
  assert.equal(result.diagnostics.some(item => item.level === 'error'), false, JSON.stringify(result.diagnostics));
});

test('项目上下文提供限定补全并诊断私有、缺失功能库调用', () => {
  const windowPath = 'src/主窗口.lcpp';
  const windowSource = '类 主窗口\n  事件 创建完毕()\n    文本工具.合并("A", "B")\n    文本工具.内部记录()\n    不存在库.执行()\n  结束\n结束类\n';
  const projectFunctions = createProjectFunctionContext([
    { filePath: libraryPath, sourceCode: librarySource, language: 'lingcpp' },
    { filePath: windowPath, sourceCode: windowSource, language: 'lingcpp' }
  ]);
  const diagnostics = getFunctionLibraryDiagnostics(windowSource, windowPath, projectFunctions);
  assert.ok(diagnostics.some(item => /私有功能/u.test(item.message)));
  assert.ok(diagnostics.some(item => /找不到功能库/u.test(item.message)));

  const completionSource = '类 主窗口\n  事件 创建完毕()\n    文本工具.\n  结束\n结束类\n';
  const context = buildLingCppLanguageContext(completionSource, undefined, undefined, windowPath, undefined, undefined, projectFunctions);
  const completions = getLingCppCompletionItems({ source: completionSource, line: 3, column: 10 }, context);
  assert.ok(completions.some(item => item.label === '合并'));
  assert.equal(completions.some(item => item.label === '内部记录'), false);
});

test('行首 @ 的内嵌 C++ 行不触发功能库调用误判', () => {
  const windowPath = 'src/主窗口.lcpp';
  const nativeSource = [
    '类 主窗口',
    '  事件 创建完毕()',
    '    @ int 原生答案 = 40 + 2;',
    '    @ std::wstring 提示 = L"这是 @ 行写出的原生字符串";',
    '    @ MessageBoxW(GetActiveWindow(), 提示.c_str(), L"内嵌 C++", MB_OK);',
    '    @ 提示 += L"继续写原生代码";',
    '  结束',
    '结束类',
    ''
  ].join('\n');
  const projectFunctions = createProjectFunctionContext([
    { filePath: libraryPath, sourceCode: librarySource, language: 'lingcpp' }
  ]);
  const diagnostics = getFunctionLibraryDiagnostics(nativeSource, windowPath, projectFunctions);
  const libraryErrors = diagnostics.filter(item => /功能库/u.test(item.message));
  assert.deepEqual(libraryErrors, [], JSON.stringify(libraryErrors));
});

test('功能库内的 @ 内联 C++ 不因 & 被误判为处理器引用', () => {
  const nativeLibraryPath = 'src/功能/Cookie导出.lcpp';
  const nativeLibrarySource = [
    '功能库 Cookie导出',
    '公开:',
    '  文本型 提取并导出(文本型 验证串)',
    '    @ if (a&&b) { }',
    '    @ auto p = &buf[0];',
    '    @ const auto flags = attr & FILE_ATTRIBUTE_DIRECTORY;',
    '    @ auto& 引用 = 会话.get();',
    '    返回(验证串)',
    '  结束',
    '结束功能库',
    ''
  ].join('\n');
  const context = createProjectFunctionContext([
    { filePath: nativeLibraryPath, sourceCode: nativeLibrarySource, language: 'lingcpp' }
  ]);
  const diagnostics = getFunctionLibraryDiagnostics(nativeLibrarySource, nativeLibraryPath, context);
  const handlerErrors = diagnostics.filter(item => /处理器/u.test(item.message));
  assert.deepEqual(handlerErrors, [], `@ 行里的 C++ 取地址/逻辑与/位与不得当成 &处理器：${JSON.stringify(handlerErrors)}`);
});

test('功能库内真实的 &处理器 传参仍然阻断', () => {
  const handlerLibrary = '功能库 任务工具\n公开:\n  空 启动()\n    线程_提交完成(工作, &完成处理器, 0)\n  结束\n结束功能库\n';
  const filePath = 'src/功能/任务工具.lcpp';
  const context = createProjectFunctionContext([{ filePath, sourceCode: handlerLibrary, language: 'lingcpp' }]);
  const diagnostics = getFunctionLibraryDiagnostics(handlerLibrary, filePath, context);
  assert.ok(
    diagnostics.some(item => /处理器/u.test(item.message) && item.level === 'error'),
    `真实 &处理器 必须继续报错：${JSON.stringify(diagnostics)}`
  );
});

test('功能库文件名含 ASCII 大写时不误报名称不一致且保留真实路径大小写', () => {
  const filePath = 'src\\功能\\Cookie导出.lcpp';
  const source = '功能库 Cookie导出\n公开:\n  空 导出()\n    调试输出("x")\n  结束\n结束功能库\n';
  const context = createProjectFunctionContext([{ filePath, sourceCode: source, language: 'lingcpp' }]);
  assert.equal(context.libraries[0]?.filePath, 'src/功能/Cookie导出.lcpp', '登记的 filePath 必须保留磁盘真实大小写，只统一分隔符');
  const diagnostics = getFunctionLibraryDiagnostics(source, filePath, context);
  assert.equal(
    diagnostics.some(item => /文件名/u.test(item.message)),
    false,
    `路径大小写规范化不得制造不一致告警：${JSON.stringify(diagnostics)}`
  );

  const mismatched = getFunctionLibraryDiagnostics(source, 'src/功能/别的名字.lcpp', context);
  assert.ok(mismatched.some(item => /文件名/u.test(item.message)), '库名与文件名真的不同时必须仍然告警');
});

test('Win32 生成器输出隐藏功能库方法并翻译限定调用', () => {
  const project: LingWindowProject = {
    id: 'library-demo', name: '功能库演示', windows: [
      { id: 'main', fileName: '主窗口.xml', className: '主窗口', title: '主窗口', description: '主窗口', width: 640, height: 480, background: '#ffffff', controls: [] }
    ]
  };
  const generated = generateLingCppNativeWin32Project(project, { lingCppSources: [
    { filePath: libraryPath, sourceCode: librarySource },
    { filePath: 'src/主窗口.lcpp', sourceCode: '类 主窗口\n  事件 创建完毕()\n    调试输出(文本工具.合并("A", "B"))\n  结束\n结束类\n' }
  ] });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /std::wstring LBFL_文本工具_合并\(std::wstring 前缀, std::wstring 内容\)/u);
  assert.match(cpp, /调试输出\(LBFL_文本工具_合并\(L"A", L"B"\)\)/u);
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
});

test('跨项目复制分析依赖且重命名只改声明和限定调用', () => {
  const source = '功能库 订单工具\n公开:\n  空 保存()\n    日志工具.写入(当前用户)\n  结束\n结束功能库\n';
  const files = [
    { filePath: 'src/功能/订单工具.lcpp', sourceCode: source, language: 'lingcpp' as const },
    { filePath: 'src/项目全局变量.lcpp', sourceCode: '全局 文本型 当前用户 = "访客"\n', language: 'lingcpp' as const },
    { filePath: 'src/功能/日志工具.lcpp', sourceCode: '功能库 日志工具\n公开:\n  空 写入(文本型 内容)\n  结束\n结束功能库\n', language: 'lingcpp' as const }
  ];
  const dependencies = analyzeFunctionLibraryDependencies(source, files);
  assert.deepEqual(dependencies.libraries, ['日志工具']);
  assert.deepEqual(dependencies.projectSymbols, ['当前用户']);
  const renamed = renameFunctionLibraryAcrossSources([
    files[0],
    { filePath: 'src/主窗口.lcpp', sourceCode: '订单工具.保存()\n调试输出("订单工具.保存()") // 订单工具.保存()', language: 'lingcpp' }
  ], '订单工具', '订单服务');
  assert.match(renamed[0]!.sourceCode, /^功能库 订单服务/mu);
  assert.match(renamed[1]!.sourceCode, /^订单服务\.保存\(\)/mu);
  assert.match(renamed[1]!.sourceCode, /"订单工具\.保存\(\)"\) \/\/ 订单工具\.保存\(\)/u);
});

test('跨项目复制递归闭包包含间接功能库、嵌套类型、项目符号和模块', () => {
  const files = [
    { filePath: 'src/功能/入口工具.lcpp', sourceCode: '功能库 入口工具\n公开:\n  空 执行()\n    中间工具.处理(当前订单)\n  结束\n结束功能库\n', language: 'lingcpp' as const },
    { filePath: 'src/功能/中间工具.lcpp', sourceCode: '功能库 中间工具\n公开:\n  空 处理(订单 值)\n    底层工具.发送()\n  结束\n结束功能库\n', language: 'lingcpp' as const },
    { filePath: 'src/功能/底层工具.lcpp', sourceCode: '功能库 底层工具\n公开:\n  空 发送()\n    网络_请求("https://example.com")\n  结束\n结束功能库\n', language: 'lingcpp' as const },
    { filePath: 'src/项目数据类型.lcpp', sourceCode: '数据类型 地址\n  文本型 城市\n结束数据类型\n\n数据类型 订单\n  地址 收货地址\n结束数据类型\n', language: 'lingcpp' as const },
    { filePath: 'src/项目全局变量.lcpp', sourceCode: '常量 整数型 默认重试 = 2\n全局 订单 当前订单\n', language: 'lingcpp' as const }
  ];
  const networkModule: InstalledModule = {
    manifest: {
      schemaVersion: 2, id: 'demo.network', name: '网络模块', version: '1.0.0', category: '网络', description: '测试',
      contributes: { commands: [{ name: '网络_请求', signature: '网络_请求(文本型 地址)', description: '请求' }] }
    },
    installPath: 'builtin://demo.network', isInstalled: true, isEnabledForProject: true, diagnostics: []
  };
  const closure = analyzeFunctionLibraryDependencyClosure('src/功能/入口工具.lcpp', files, { enabledModules: [networkModule], availableModules: [networkModule] });
  assert.deepEqual(closure.files.map(file => file.name), ['底层工具', '中间工具', '入口工具']);
  assert.deepEqual(closure.projectTypes, ['地址', '订单']);
  assert.deepEqual(closure.projectSymbols, ['当前订单']);
  assert.deepEqual(closure.modules, ['demo.network']);
  assert.deepEqual(closure.missingLibraries, []);

  const merged = mergeFunctionLibraryProjectResources(closure, files, [
    { filePath: 'target/项目数据类型.lcpp', sourceCode: '// 目标类型\n', language: 'lingcpp' },
    { filePath: 'target/项目全局变量.lcpp', sourceCode: '// 目标符号\n', language: 'lingcpp' }
  ]);
  assert.deepEqual(merged.projectTypes.copied, ['地址', '订单']);
  assert.deepEqual(merged.projectSymbols.copied, ['当前订单']);
  assert.deepEqual(parseLingCpp(merged.dataTypesSource || '').program.dataTypes.map(item => item.name), ['地址', '订单']);
  assert.deepEqual(parseLingCpp(merged.globalsSource || '').program.globals.map(item => item.name), ['当前订单']);
  assert.deepEqual(merged.conflicts, []);
});

test('依赖资源遇到相同定义时复用，遇到不同定义时阻止覆盖', () => {
  const closure = { projectTypes: ['订单'], projectSymbols: ['当前订单'] };
  const sourceFiles = [
    { filePath: 'src/项目数据类型.lcpp', sourceCode: '数据类型 订单\n  文本型 编号\n结束数据类型\n', language: 'lingcpp' as const },
    { filePath: 'src/项目全局变量.lcpp', sourceCode: '全局 文本型 当前订单 = "A"\n', language: 'lingcpp' as const }
  ];
  const reused = mergeFunctionLibraryProjectResources(closure, sourceFiles, sourceFiles);
  assert.deepEqual(reused.projectTypes.reused, ['订单']);
  assert.deepEqual(reused.projectSymbols.reused, ['当前订单']);
  assert.deepEqual(reused.conflicts, []);

  const conflicted = mergeFunctionLibraryProjectResources(closure, sourceFiles, [
    { filePath: 'target/项目数据类型.lcpp', sourceCode: '数据类型 订单\n  整数型 编号\n结束数据类型\n', language: 'lingcpp' },
    { filePath: 'target/项目全局变量.lcpp', sourceCode: '全局 文本型 当前订单 = "B"\n', language: 'lingcpp' }
  ]);
  assert.deepEqual(conflicted.conflicts.map(item => item.name), ['订单', '当前订单']);
  assert.equal(conflicted.dataTypesSource, undefined);
  assert.equal(conflicted.globalsSource, undefined);
});

test('new_emoji 后端的功能库声明在前、定义排在命令包装之后', async () => {
  // 回归：功能库内部可以调用任意 new_emoji 命令包装（含较晚生成的宽字符包装），
  // 因此定义必须排在命令包装之后，而声明要留在前面供运行期事件分发生成的调用使用。
  const workspaceRoot = path.resolve('..');
  const manifestPath = path.join(workspaceRoot, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui', 'lingbuilder.module.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const enabledModules: InstalledModule[] = [{
    manifest,
    installPath: 'builtin://lingbuilder.new_emoji.ui',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }];
  const project: LingWindowProject = {
    id: 'library-new-emoji-demo',
    name: '功能库 new_emoji 演示',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '演示窗口', title: '功能库 new_emoji 演示',
      description: '功能库调用 new_emoji 命令包装', width: 1280, height: 800, background: '#181825',
      designerBackend: 'new-emoji', controls: []
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSources: [
      {
        filePath: 'src/功能库/卡片页.lcpp',
        sourceCode: '功能库 卡片页\n公开:\n  空 建卡片(NE面板 父容器)\n    局部 NE标签页 演示标签页 = 控件_创建NE标签页(父容器, 24, 24, 620, 36, "预览|代码", "MK001", 1)\n    NE标签页_设置标签项(演示标签页, "预览|代码")\n  结束\n结束功能库\n'
      },
      {
        filePath: 'src/演示窗口.lcpp',
        sourceCode: '类 演示窗口 : 窗口\n  事件 创建完毕()\n    局部 NE容器 根容器 = 控件_创建NE容器(当前窗口, 0, 0, 1200, 700, "MKROOT", "根容器", 1)\n    卡片页.建卡片(根容器)\n  结束\n结束类\n'
      }
    ]
  });
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const declarationIndex = cpp.indexOf('static void LBFL_卡片页_建卡片(LingControlRef 父容器);');
  const definitionIndex = cpp.indexOf('static void LBFL_卡片页_建卡片(LingControlRef 父容器) {');
  const wrapperDefinitionIndex = cpp.indexOf('static bool NE标签页_设置标签项(const wchar_t* controlName');
  const callIndex = cpp.indexOf('LBFL_卡片页_建卡片(根容器);');
  assert.ok(declarationIndex >= 0, '功能库应生成前置声明');
  assert.ok(definitionIndex >= 0, '功能库应生成定义');
  assert.ok(wrapperDefinitionIndex >= 0, 'new_emoji 宽字符包装应生成定义');
  assert.ok(callIndex >= 0, '窗口类应生成功能库调用');
  assert.ok(declarationIndex < wrapperDefinitionIndex, '功能库声明必须早于命令包装，事件分发才能调用');
  assert.ok(definitionIndex > wrapperDefinitionIndex, '功能库定义必须晚于命令包装，否则包装不可见（C3861）');
});
