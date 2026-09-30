import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { PROTOBUF_MODULE } from '../src/services/modules/protobufModule';
import { getLingCppSemanticDiagnostics } from '../src/services/lingCpp/languageService';
import {
  buildInlineCppApiMapMarkdown,
  buildInlineCppUsageSummaryLine,
  collectInlineCppLines,
  collectInlineCppReplacementHints,
  INLINE_CPP_REPLACEMENT_HINTS,
  isInlineCppLineExempt,
  summarizeInlineCppUsage
} from '../src/services/lingCpp/inlineCppKnowledge';
import { collectInlineCppAdmissionProblems, formatInlineCppAdmissionBlock } from '../src/services/lingCpp/inlineCppAdmission';

function findCommand(moduleId: string, commandName: string) {
  const manifest = BUILTIN_MODULES.find(module => module.id === moduleId);
  assert.ok(manifest, `内置模块 ${moduleId} 应存在`);
  const command = manifest.contributes?.commands?.find(item => item.name === commandName);
  assert.ok(command, `${moduleId} 应提供命令 ${commandName}`);
  const binding = manifest.bindings?.commands?.find(item => item.command === commandName);
  assert.ok(binding, `${moduleId} 应提供命令 ${commandName} 的 binding`);
  return { manifest, command, binding };
}

test('批①：std.math 提供 64 位位运算族且语义红线写进描述', () => {
  const math = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.std.math');
  assert.ok(math);
  assert.equal(math.version, '1.2.0');
  for (const name of ['位_与', '位_或', '位_异或', '位_取反', '位_左移', '位_右移', '位_算术右移', '位_循环左移32', '位_取字节', '位_测试']) {
    findCommand('lingbuilder.std.math', name);
  }
  const logicalShift = math.contributes!.commands!.find(item => item.name === '位_右移')!;
  assert.ok(logicalShift.description.includes('补 0'));
  const arithmetic = math.contributes!.commands!.find(item => item.name === '位_算术右移')!;
  assert.ok(arithmetic.description.includes('符号位'));
});

test('批①：编码模块 RAW 语义进入运行时（按码点低 8 位截断/还原）', async () => {
  const { generateStandardLibraryRuntime } = await import('../src/services/windowDesigner/standardLibraryRuntime');
  const { TEXT_CODECS_RUNTIME } = await import('../src/services/windowDesigner/textCodecsRuntime');
  const runtime = TEXT_CODECS_RUNTIME + generateStandardLibraryRuntime([
    { manifest: { id: 'lingbuilder.std.encoding' } } as never
  ]);
  assert.ok(runtime.includes('LB_EncodingKind::Raw'));
  assert.ok(runtime.includes('L"RAW" || value == L"LATIN1"'));
  assert.ok(runtime.includes('按码点低 8 位直接截断'));
  assert.ok(runtime.includes('每个字节映射为等值码点的字符'));
  findCommand('lingbuilder.std.encoding', '编码_文本转字节集');
  const decode = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.std.encoding')!
    .bindings!.commands!.find(item => item.command === '编码_字节集转文本')!;
  assert.ok(decode.parameters!.find(parameter => parameter.name === '编码名称')!.description.includes('RAW'));
});

test('批③：protobuf v1.1.0 提供无 schema wire 命令且运行时不依赖 SDK 守卫', async () => {
  assert.equal(PROTOBUF_MODULE.version, '1.1.0');
  for (const name of [
    'PB_写字段_varint', 'PB_写字段_固定32', 'PB_写字段_固定64', 'PB_写字段_字节集', 'PB_写字段_文本', 'PB_写字段_嵌套',
    'PB_取字段_varint', 'PB_取字段_字节集', 'PB_字段信息JSON', 'PB_字节集转文本树', 'PB_导出Proto草稿'
  ]) {
    assert.ok(PROTOBUF_MODULE.contributes?.commands?.some(command => command.name === name), `protobuf 应提供 ${name}`);
    assert.ok(PROTOBUF_MODULE.bindings?.commands?.some(binding => binding.command === name), `protobuf 应提供 ${name} 的 binding`);
  }
  const { generateProtobufRuntime } = await import('../src/services/windowDesigner/protobufRuntime');
  const enabledRuntime = generateProtobufRuntime([{ manifest: { id: 'lingbuilder.data.protobuf' } } as never]);
  assert.ok(enabledRuntime.includes('long long PB_取字段_varint'));
  assert.ok(enabledRuntime.includes('PB_写字段_varint(const std::vector<unsigned char>&'));
  assert.ok(enabledRuntime.includes('PB_字节集转文本树'));
  assert.ok(enabledRuntime.includes('PB_导出Proto草稿'));
  // wire 命令必须在 SDK 守卫之外：SDK 缺失（#else 分支）时同样可用
  const guardedIndex = enabledRuntime.indexOf('#if LINGBUILDER_PROTOBUF_AVAILABLE');
  const wireIndex = enabledRuntime.indexOf('std::vector<unsigned char> PB_写字段_varint');
  assert.ok(wireIndex >= 0 && guardedIndex > wireIndex, 'wire 编解码必须位于 SDK 守卫之前');
  assert.ok(!enabledRuntime.includes('Protobuf SDK 不可用'));
});

test('批④：crypto.hash 提供七种算法的字节集变体', () => {
  for (const suffix of ['MD5', 'SHA1', 'SHA256', 'SHA3_256', 'SM3', 'BLAKE2b', 'BLAKE3']) {
    findCommand('lingbuilder.crypto.hash', `哈希_${suffix}字节集`);
  }
});

test('生成器连词边界：位_异或 等「或/且」内嵌命令名不再被拆成逻辑运算符', async () => {
  const { generateLingCppNativeWin32Project } = await import('../src/services/windowDesigner/lingCppWin32Project');
  const win32Basic = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.basic')!;
  const stdMath = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.std.math')!;
  const project = {
    id: 'inline-cpp-bitname-project',
    name: '位运算命令名验证',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'MainWindow',
      width: 640, height: 480, background: '#202020', description: '主窗口', controls: []
    }]
  } as never;
  const generated = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: ['类 MainWindow', '    事件 _MainWindow_创建完毕()', '        调试输出(到文本(位_异或(240, 15)))', '        调试输出(到文本(位_与(12, 10)))', '    结束', '结束类'].join('\n'),
    enabledModules: [win32Basic, stdMath].map(manifest => ({ manifest, installPath: `builtin://${(manifest as { id: string }).id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] })) as never
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.ok(mainCpp.includes('位_异或(240, 15)'), '位_异或 必须整体保留（曾被拆成 位_异||）');
  assert.ok(mainCpp.includes('位_与(12, 10)'), '位_与 必须整体保留');
  assert.ok(!mainCpp.includes('位_异||'), '不得出现 位_异|| 拆分形态');
});

test('生成器结束语句边界：以「结束」开头的赋值不再被当成退出语句吞掉', async () => {
  const { generateLingCppNativeWin32Project } = await import('../src/services/windowDesigner/lingCppWin32Project');
  const win32Basic = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.basic')!;
  const project = {
    id: 'inline-cpp-exitname-project',
    name: '结束前缀赋值验证',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'MainWindow',
      width: 640, height: 480, background: '#202020', description: '主窗口', controls: []
    }]
  } as never;
  const generated = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: ['类 MainWindow', '    事件 _MainWindow_创建完毕()', '        局部 长整数型 起始', '        局部 长整数型 结束毫秒', '        起始 = 1', '        结束毫秒 = 起始 + 100', '        调试输出(到文本(结束毫秒))', '    结束', '结束类'].join('\n'),
    enabledModules: [{ manifest: win32Basic, installPath: `builtin://lingbuilder.win32.basic`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }] as never
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.ok(mainCpp.replace(/ /g, '').includes('结束毫秒=起始+100;'), '以「结束」开头的赋值语句必须完整保留');
  assert.ok(!mainCpp.includes('结束();'), '不得再把该语句当成退出命令');
});

test('批⑦：进程内存_写字节集 与 设置鼠标位置 已登记且带运行时', async () => {
  const writeBytes = findCommand('lingbuilder.advanced.process-memory', '进程内存_写字节集');
  assert.equal(writeBytes.binding.parameters?.[2]?.type, 'bytes');
  const setMouse = findCommand('lingbuilder.win32.basic', '设置鼠标位置');
  assert.equal(setMouse.binding.returnType, 'bool');
  const { generatePlatformAdvancedRuntime } = await import('../src/services/windowDesigner/platformAdvancedRuntime');
  const advancedRuntime = generatePlatformAdvancedRuntime([
    { manifest: { id: 'lingbuilder.advanced.process-memory' } } as never
  ]);
  assert.ok(advancedRuntime.includes('bool 进程内存_写字节集(long long process, long long address, const std::vector<unsigned char>& bytes)'));
  // 生成产物侧：普通 Win32 与 new_emoji 两后端都必须带 设置鼠标位置 的运行时定义
  const { generateLingCppNativeWin32Project } = await import('../src/services/windowDesigner/lingCppWin32Project');
  const win32Basic = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.basic')!;
  const project = {
    id: 'inline-cpp-set-mouse-project',
    name: '设置鼠标位置验证',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'MainWindow',
      width: 640,
      height: 480,
      background: '#202020',
      description: '主窗口',
      controls: []
    }]
  } as never;
  const generated = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: ['类 MainWindow', '    事件 _MainWindow_创建完毕()', '        调试输出(设置鼠标位置(取鼠标水平位置(), 取鼠标垂直位置()))', '    结束', '结束类'].join('\n'),
    enabledModules: [{ manifest: win32Basic, installPath: `builtin://lingbuilder.win32.basic`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] } as never]
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.ok(mainCpp.includes('bool 设置鼠标位置(int x, int y) const'), '常规 Win32 后端应生成 设置鼠标位置 成员定义');
  assert.ok(mainCpp.includes('SetCursorPos(x, y) != 0'), '应生成 SetCursorPos 调用');
});

test('collectInlineCppLines：文本块内的 @ 不计数', () => {
  const source = [
    '类 窗口1',
    '    事件 按钮1_点击()',
    '        局部 文本型 模板',
    '        模板 = """',
    '        @ 这不是内嵌 C++，是文本内容',
    '        """',
    '        @ int x = 1;',
    '    结束',
    '结束类'
  ].join('\n');
  const lines = collectInlineCppLines(source);
  assert.deepEqual(lines.map(line => line.line), [7]);
});

test('isInlineCppLineExempt：行尾「// 允许:」豁免标记', () => {
  assert.ok(isInlineCppLineExempt('@ int x = 1; // 允许: 无替代命令'));
  assert.ok(isInlineCppLineExempt('@ int x = 1; // 允许：无替代命令'));
  assert.ok(!isInlineCppLineExempt('@ int x = 1;'));
});

test('替代知识表命中进程内存/鼠标/位运算 API', () => {
  const readHints = collectInlineCppReplacementHints('@ HANDLE h = OpenProcess(...); ReadProcessMemory(h, addr, buf, 4, NULL);');
  assert.ok(readHints.some(hint => hint.api === 'OpenProcess'));
  assert.ok(readHints.some(hint => hint.api === 'ReadProcessMemory'));
  const bitHints = collectInlineCppReplacementHints('@ unsigned x = (value >> 7) | 0x80;');
  assert.ok(bitHints.some(hint => hint.api === '位运算（右移常量）'));
  const cursorHints = collectInlineCppReplacementHints('@ POINT p; GetCursorPos(&p);');
  assert.ok(cursorHints.some(hint => hint.api === 'GetCursorPos'));
  assert.equal(collectInlineCppReplacementHints('@ std::wstring s = L"普通";').length, 0);
});

test('lingcpp-inline-cpp-replaceable 警告：warning 级、列出替代命令、豁免行不再提示', () => {
  const source = [
    '类 窗口1',
    '    事件 按钮1_点击()',
    '        @ HANDLE h = OpenProcess(PROCESS_ALL_ACCESS, FALSE, pid);',
    '        @ ReadProcessMemory(h, addr, buf, 4, NULL); // 允许: 临时调试',
    '        @ VirtualQueryEx(h, addr, &mbi, sizeof(mbi));',
    '    结束',
    '结束类'
  ].join('\n');
  const diagnostics = getLingCppSemanticDiagnostics(source, undefined, 'src/演示/主窗口.lcpp');
  const warnings = diagnostics.filter(item => item.id.startsWith('lingcpp-inline-cpp-replaceable-'));
  assert.ok(warnings.length > 0, '应给出内嵌 C++ 替代警告');
  for (const warning of warnings) {
    assert.equal(warning.level, 'warning', '替代警告必须是 warning 级（永不阻断）');
  }
  // ReadProcessMemory 所在行带豁免标记：不提示；VirtualQueryEx 无豁免：必须提示并点名命令与模块
  assert.ok(!warnings.some(item => item.message.includes('ReadProcessMemory')), '豁免行不应提示');
  const queryWarning = warnings.find(item => item.message.includes('VirtualQueryEx'));
  assert.ok(queryWarning, '应提示 VirtualQueryEx 可替代');
  assert.ok(queryWarning.message.includes('进程内存_枚举区域JSON'));
  assert.ok(queryWarning.message.includes('lingbuilder.advanced.process-memory'));
  assert.ok(queryWarning.message.includes('第 5 行'), '警告应锚定 VirtualQueryEx 所在行');
});

test('无 @ 行时不产生替代警告', () => {
  const source = ['类 窗口1', '    事件 按钮1_点击()', '        调试输出("你好")', '    结束', '结束类'].join('\n');
  const diagnostics = getLingCppSemanticDiagnostics(source, undefined, 'src/演示/主窗口.lcpp');
  assert.equal(diagnostics.filter(item => item.id.startsWith('lingcpp-inline-cpp-replaceable-')).length, 0);
});

test('用量统计与构建日志汇总行', () => {
  const sources = [
    { filePath: 'src/演示/签名.lcpp', sourceCode: '功能库 签名\n功能 计算签名()\n@ unsigned x = v >> 7;\n@ int y = 1; // 允许: 临时\n结束功能库' },
    { filePath: 'src/演示/主窗口.lcpp', sourceCode: '类 窗口1\n    事件 按钮1_点击()\n        @ GetCursorPos(&p);\n    结束\n结束类' }
  ];
  const summary = summarizeInlineCppUsage(sources);
  assert.equal(summary.totalLines, 3);
  assert.equal(summary.exemptLines, 1);
  assert.equal(summary.replaceableLines, 2);
  assert.equal(summary.fileCount, 2);
  assert.ok(summary.suggestions.some(item => item.api === '位运算（右移常量）'));
  const line = buildInlineCppUsageSummaryLine(sources);
  assert.ok(line && line.includes('合计 3 行') && line.includes('2 行已有中文命令可替代'));
  assert.equal(buildInlineCppUsageSummaryLine([{ filePath: 'src/a.lcpp', sourceCode: '类 窗口1\n结束类' }]), undefined);
});

test('forbidInlineCpp 门禁：关闭不拦、开启拦、豁免双通道放行', () => {
  const source = '功能库 签名\n功能 计算签名()\n@ unsigned x = ReadProcessMemory(p, a, b, 4, NULL);\n@ int y = 2; // 允许: 无替代\n结束功能库';
  const sources = [{ filePath: 'src/演示/签名.lcpp', sourceCode: source }];
  assert.equal(collectInlineCppAdmissionProblems({ sources, policy: { forbidInlineCpp: false, inlineCppAllowFiles: [] } }).length, 0);

  const problems = collectInlineCppAdmissionProblems({ sources, policy: { forbidInlineCpp: true, inlineCppAllowFiles: [] } });
  assert.equal(problems.length, 1);
  assert.equal(problems[0].lineCount, 1, '豁免行不计入阻断');
  assert.ok(problems[0].hintSummary.includes('ReadProcessMemory'));
  assert.ok(problems[0].hintSummary.includes('进程内存_读字节集'));
  const block = formatInlineCppAdmissionBlock('lingbuilder.build.run', problems);
  assert.ok(block.includes('被阻止'));
  assert.ok(block.includes('forbidInlineCpp'));
  assert.ok(block.includes('inlineCppAllowFiles'));

  const allowed = collectInlineCppAdmissionProblems({ sources, policy: { forbidInlineCpp: true, inlineCppAllowFiles: ['src\\演示\\签名.lcpp'] } });
  assert.equal(allowed.length, 0, '整文件豁免（反斜杠路径）应放行');
});

test('替代知识表中的模块与命令必须真实存在', () => {
  for (const hint of INLINE_CPP_REPLACEMENT_HINTS) {
    if (!hint.moduleId) continue;
    const manifest = BUILTIN_MODULES.find(module => module.id === hint.moduleId);
    assert.ok(manifest, `知识表引用的模块 ${hint.moduleId} 必须存在`);
  }
  const knownCommands = new Map<string, Set<string>>();
  for (const manifest of BUILTIN_MODULES) {
    knownCommands.set(manifest.id, new Set(manifest.contributes?.commands?.map(command => command.name) ?? []));
  }
  const checks: Array<[string, string]> = [
    ['lingbuilder.advanced.process-memory', '进程内存_读字节集'],
    ['lingbuilder.advanced.process-memory', '进程内存_写字节集'],
    ['lingbuilder.win32.basic', '设置鼠标位置'],
    ['lingbuilder.std.math', '位_右移'],
    ['lingbuilder.std.math', '位_循环左移32'],
    ['lingbuilder.std.encoding', '编码_文本转字节集'],
    ['lingbuilder.std.bytes', '字节集_拼接'],
    ['lingbuilder.std.datetime', '时间_当前时间戳'],
    ['lingbuilder.crypto.hash', '哈希_SM3字节集'],
    ['lingbuilder.win32.window-utils', '窗口_取标题'],
    ['lingbuilder.process', '程序_启动'],
    ['lingbuilder.system.shell', '系统_打开'],
    ['lingbuilder.config.registry', '注册表_读文本'],
    ['lingbuilder.win32.basic', '格式化文本']
  ];
  for (const [moduleId, commandName] of checks) {
    assert.ok(knownCommands.get(moduleId)!.has(commandName), `${moduleId} 必须提供 ${commandName}`);
  }
});

test('批⑤：对照表文档由知识表确定性生成（含表头、行数与位运算口径）', () => {
  const markdown = buildInlineCppApiMapMarkdown();
  assert.ok(markdown.includes('# 内嵌 C++（@ 行）→ 中文命令替代对照表'));
  assert.ok(markdown.includes('知识表共 22 条'));
  for (const hint of INLINE_CPP_REPLACEMENT_HINTS) {
    assert.ok(markdown.includes(hint.api), `对照表应包含 ${hint.api}`);
  }
  assert.ok(markdown.includes('64 位补码位模式'));
});
