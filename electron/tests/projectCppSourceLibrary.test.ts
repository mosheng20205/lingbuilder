import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROJECT_CPP_SOURCE_LIBRARY_FILE_NAME,
  PROJECT_CPP_SOURCE_MODULE_ID,
  createProjectCppSourceDeclarationModule,
  createProjectCppSourceDeclarationModuleFromSources,
  generateProjectCppSourceDeclarationHeader,
  getProjectCppSourceLibraryDiagnostics,
  isProjectCppSourceLibraryFilePath,
  parseCppHeaderDeclarations,
  parseCppSourceDeclarationSnippet,
  serializeCppSourceCommandSnippet,
  serializeProjectCppSourceLibraries
} from '../src/services/lingCpp/projectCppSourceLibraryService';
import { parseLingCpp } from '../src/services/lingCpp/parser';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';

const SAMPLE_SOURCE = [
  '包 项目C++源码库',
  '',
  'C++源码库 数学库',
  '  源码 = cpp/mymath.cpp',
  '  头文件 = cpp/mymath.h',
  '  整数型 加法计算(整数型 a, 整数型 b) = add',
  '    备注: 计算两数之和',
  '  文本型 问候(文本型 名字) = greet',
  '  小数型 平均值(小数型 总和, 整数型 个数 传址 // 个数会被回写) = average',
  '    公开 = 假',
  '结束C++源码库'
].join('\n');

test('C++ 源码库声明解析出库/源码/头文件/命令，并识别参数备注与公开标记', () => {
  const parsed = parseLingCpp(SAMPLE_SOURCE);
  assert.equal(parsed.diagnostics.length, 0);
  assert.equal(parsed.program.cppLibraries.length, 1);
  const library = parsed.program.cppLibraries[0];
  assert.equal(library.name, '数学库');
  assert.deepEqual(library.sourceFiles.map(file => file.relativePath), ['cpp/mymath.cpp']);
  assert.deepEqual(library.headerFiles.map(file => file.relativePath), ['cpp/mymath.h']);
  assert.equal(library.commands.length, 3);
  const byRefCommand = library.commands[2];
  assert.equal(byRefCommand.cppName, 'average');
  assert.equal(byRefCommand.isPublic, false);
  assert.equal(byRefCommand.parameters[1].byRef, true);
  assert.equal(byRefCommand.parameters[1].note, '个数会被回写');
  assert.equal(library.commands[0].remark, '计算两数之和');
});

test('C++ 源码库声明序列化 100% 往返幂等', () => {
  const first = parseLingCpp(SAMPLE_SOURCE).program.cppLibraries;
  const serialized = serializeProjectCppSourceLibraries('项目C++源码库', first);
  const second = parseLingCpp(serialized).program.cppLibraries;
  // 行号随布局变化属预期：幂等口径是「序列化后再序列化」逐字节相等，语义字段一致。
  const serializedAgain = serializeProjectCppSourceLibraries('项目C++源码库', second);
  assert.equal(serializedAgain, serialized);
  assert.equal(second.length, first.length);
  const library = second[0];
  assert.equal(library.name, '数学库');
  assert.deepEqual(library.sourceFiles.map(file => file.relativePath), ['cpp/mymath.cpp']);
  assert.deepEqual(library.headerFiles.map(file => file.relativePath), ['cpp/mymath.h']);
  assert.equal(library.commands.length, 3);
  assert.equal(library.commands[0].cppName, 'add');
  assert.equal(library.commands[0].remark, '计算两数之和');
  assert.equal(library.commands[2].isPublic, false);
  assert.equal(library.commands[2].parameters[1].byRef, true);
  assert.equal(library.commands[2].parameters[1].note, '个数会被回写');
});

test('C++ 源码库缺结束语句、非法源码路径与无法识别行给中文诊断', () => {
  const missingClose = parseLingCpp('包 项目C++源码库\nC++源码库 数学库\n  源码 = cpp/a.cpp\n');
  assert.ok(missingClose.diagnostics.some(item => item.message.includes('C++源码库 声明缺少结束语句')));
  const badPath = parseLingCpp('包 项目C++源码库\nC++源码库 数学库\n  源码 = ../outside.cpp\n结束C++源码库');
  assert.ok(badPath.diagnostics.some(item => item.message.includes('项目内相对的 .cpp')));
  const unknownLine = parseLingCpp('包 项目C++源码库\nC++源码库 数学库\n  源码 = cpp/a.cpp\n  随便一行\n结束C++源码库');
  assert.ok(unknownLine.diagnostics.some(item => item.message.includes('无法识别的 C++ 源码库声明行')));
  // 多余的结束标记
  const strayClose = parseLingCpp('包 项目C++源码库\n结束C++源码库');
  assert.ok(strayClose.diagnostics.some(item => item.message.includes('多余的结束C++源码库')));
});

test('C++ 源码库声明诊断：缺函数名、非 ASCII 函数名、类型白名单、非法传址、重名', () => {
  const diagnostics = getProjectCppSourceLibraryDiagnostics([
    '包 项目C++源码库',
    'C++源码库 数学库',
    '  源码 = cpp/mymath.cpp',
    '  整数型 缺函数名(整数型 a) ',
    '  整数型 坏函数名(整数型 a) = 中文函数',
    '  数组型 非法返回() = bad_return',
    '  整数型 文本传址(文本型 值 传址) = text_ref',
    '  整数型 加法计算(整数型 a, 整数型 b) = add',
    '结束C++源码库',
    'C++源码库 第二库',
    '  源码 = cpp/second.cpp',
    '  整数型 加法计算(整数型 a, 整数型 b) = add',
    '结束C++源码库'
  ].join('\n'));
  const messages = diagnostics.map(item => item.message);
  assert.ok(messages.some(item => item.includes('缺少 C++ 函数名')));
  assert.ok(messages.some(item => item.includes('不是合法的英文 C++ 标识符')));
  assert.ok(messages.some(item => item.includes('返回类型「数组型」不支持')));
  assert.ok(messages.some(item => item.includes('不支持传址')));
  assert.ok(messages.filter(item => item.includes('重名') || item.includes('占用')).length >= 1);
  // 合法声明零诊断
  assert.equal(getProjectCppSourceLibraryDiagnostics(SAMPLE_SOURCE).length, 0);
});

test('C++ 源码库声明合成虚拟模块：中文命令绑定 C++ 函数名，英文函数名登记为别名', () => {
  const module = createProjectCppSourceDeclarationModuleFromSources(
    [{ filePath: `src/${PROJECT_CPP_SOURCE_LIBRARY_FILE_NAME}`, sourceCode: SAMPLE_SOURCE }],
    'proj-1'
  );
  assert.ok(module);
  assert.equal(module.manifest.id, PROJECT_CPP_SOURCE_MODULE_ID);
  const addCommand = module.manifest.bindings.commands.find(item => item.command === '加法计算');
  assert.ok(addCommand);
  assert.equal(addCommand.runtimeName, 'add');
  assert.equal(addCommand.returnType, 'int');
  const greetCommand = module.manifest.bindings.commands.find(item => item.command === '问候');
  assert.equal(greetCommand?.returnType, 'wideString');
  const contributions = module.manifest.contributes.commands.filter(item => item.name === '加法计算');
  assert.equal(contributions.length, 1);
  assert.deepEqual(contributions[0].aliases, ['add']);
  // 未公开命令不进补全，但绑定仍在（生成调用不受影响）
  assert.ok(!module.manifest.contributes.commands.some(item => item.name === '平均值'));
  assert.ok(module.manifest.bindings.commands.some(item => item.command === '平均值'));
  // targets.sources 收录源码文件（多库去重）
  assert.ok(module.manifest.targets.every(target => target.sources.includes('sources/cpp/mymath.cpp')));
  assert.equal(module.installPath, '__project_cppsrc__/proj-1');
  // 无声明文件时返回 undefined
  assert.equal(createProjectCppSourceDeclarationModule([], 'proj-1'), undefined);
  assert.equal(createProjectCppSourceDeclarationModuleFromSources([{ filePath: 'src/Main.lcpp', sourceCode: '类 A\n结束类' }], 'p'), undefined);
});

test('C++ 源码库生成声明头：无头文件发期望签名前置声明，有头文件只 include', () => {
  const parsed = parseLingCpp(SAMPLE_SOURCE).program.cppLibraries;
  const header = generateProjectCppSourceDeclarationHeader(parsed);
  assert.ok(header.includes('#include "../sources/cpp/mymath.h"'));
  // 有用户头文件的库不再发前置声明（避免与用户定义冲突）
  assert.ok(!header.includes(' add('));
  const withoutHeader = parseLingCpp(SAMPLE_SOURCE.replace('  头文件 = cpp/mymath.h\n', '')).program.cppLibraries;
  const forwardHeader = generateProjectCppSourceDeclarationHeader(withoutHeader);
  assert.ok(forwardHeader.includes('int add(int p0, int p1);'));
  assert.ok(forwardHeader.includes('const wchar_t* greet(const wchar_t* p0);'));
  assert.ok(forwardHeader.includes('double average(double p0, int* p1);'));
  assert.equal(generateProjectCppSourceDeclarationHeader([]), '');
});

test('C++ 源码库 .h 导入解析支持非空参数表并映射中文类型', () => {
  const commands = parseCppHeaderDeclarations([
    '#pragma once',
    'int add(int a, int b);',
    'extern "C" __declspec(dllexport) const wchar_t* greet(const wchar_t* name);',
    'double average(double total, int count);',
    'void fill(std::vector<unsigned char>& buffer); // 模板参数初稿跳过',
    'long long total_size(uintptr_t handle);'
  ].join('\n'));
  const byName = new Map(commands.map(command => [command.name, command]));
  assert.equal(byName.get('add')?.returnType, '整数型');
  assert.equal(byName.get('add')?.parameters.length, 2);
  assert.equal(byName.get('add')?.parameters[1].type, '整数型');
  assert.equal(byName.get('greet')?.returnType, '文本型');
  assert.equal(byName.get('greet')?.cppName, 'greet');
  assert.equal(byName.get('average')?.parameters[0].type, '小数型');
  assert.ok(!byName.has('fill'));
  assert.equal(byName.get('total_size')?.returnType, '长整数型');
  assert.equal(byName.get('total_size')?.parameters[0].type, '指针整数');
});

test('C++ 源码库命令片段复制粘贴往返，裸片段并入当前库', () => {
  const parsed = parseLingCpp(SAMPLE_SOURCE).program.cppLibraries;
  const snippet = serializeCppSourceCommandSnippet(parsed[0].commands[2]);
  assert.ok(snippet.includes('小数型 平均值(小数型 总和, 整数型 个数 传址 // 个数会被回写) = average'));
  const reparsed = parseCppSourceDeclarationSnippet(snippet);
  assert.equal(reparsed.bare, true);
  assert.equal(reparsed.libraries[0].commands[0].cppName, 'average');
  const whole = parseCppSourceDeclarationSnippet(`C++源码库 整库\n  源码 = cpp/x.cpp\n  整数型 一() = one\n结束C++源码库`);
  assert.equal(whole.bare, false);
  assert.equal(whole.libraries[0].name, '整库');
});

test('C++ 源码库声明文件路径识别与 DLL 声明文件互不干扰', () => {
  assert.ok(isProjectCppSourceLibraryFilePath(`src/${PROJECT_CPP_SOURCE_LIBRARY_FILE_NAME}`));
  assert.ok(isProjectCppSourceLibraryFilePath('src/项目c++源码库.lcpp'));
  assert.ok(!isProjectCppSourceLibraryFilePath('src/项目DLL命令.lcpp'));
  // 同一文件里 DLL 命令库与 C++ 源码库可以并存且互不串扰
  const mixed = parseLingCpp([
    '包 混合声明',
    'DLL命令库 数学DLL',
    '  整数型 加法计算(整数型 a, 整数型 b)',
    '结束DLL命令库',
    'C++源码库 数学库',
    '  源码 = cpp/mymath.cpp',
    '  整数型 减法计算(整数型 a, 整数型 b) = subtract',
    '结束C++源码库'
  ].join('\n'));
  assert.equal(mixed.diagnostics.length, 0);
  assert.equal(mixed.program.dllLibraries.length, 1);
  assert.equal(mixed.program.cppLibraries.length, 1);
  assert.equal(mixed.program.cppLibraries[0].commands[0].cppName, 'subtract');
});

// ===== v2：回调（传函数）与类句柄化 =====

const V2_SOURCE = [
  '包 项目C++源码库',
  '',
  'C++源码库 下载库',
  '  源码 = cpp/downloader.cpp',
  '  头文件 = cpp/downloader.h',
  '  空 执行进度(整数型 次数, 处理器 进度回调(整数型 序号, 文本型 阶段)) = run_progress',
  '结束C++源码库',
  '',
  'C++源码库 计数器库',
  '  源码 = cpp/counter.cpp',
  '  头文件 = cpp/counter.h',
  '  类 计数器 = Counter',
  '    方法 计数器 创建(整数型 初始值)',
  '    方法 空 销毁()',
  '    方法 整数型 取当前() = get_value',
  '    方法 空 累加(整数型 步长) = add_value',
  '      备注: 按步长累加',
  '  结束类',
  '结束C++源码库'
].join('\n');

test('v2 解析处理器内联签名与类块，序列化往返保留', () => {
  const parsed = parseLingCpp(V2_SOURCE);
  assert.equal(parsed.diagnostics.length, 0);
  const downloader = parsed.program.cppLibraries[0];
  const handlerParameter = downloader.commands[0].parameters[1];
  assert.equal(handlerParameter.type, '处理器');
  assert.deepEqual((handlerParameter.handlerSignatureParameters || []).map(item => `${item.type} ${item.name}`), ['整数型 序号', '文本型 阶段']);
  const counter = parsed.program.cppLibraries[1];
  assert.equal(counter.classes.length, 1);
  const classItem = counter.classes[0];
  assert.equal(classItem.name, '计数器');
  assert.equal(classItem.cppName, 'Counter');
  assert.equal(classItem.methods.length, 4);
  assert.equal(classItem.methods[0].returnType, '计数器');
  assert.equal(classItem.methods[2].cppName, 'get_value');
  assert.equal(classItem.methods[3].remark, '按步长累加');
  // 序列化幂等 + 语义字段保留
  const serialized = serializeProjectCppSourceLibraries('项目C++源码库', parseLingCpp(V2_SOURCE).program.cppLibraries);
  const reparsed = parseLingCpp(serialized).program.cppLibraries;
  assert.equal(serializeProjectCppSourceLibraries('项目C++源码库', reparsed), serialized);
  assert.equal(reparsed[1].classes[0].methods.length, 4);
  assert.equal(reparsed[1].classes[0].methods[2].cppName, 'get_value');
  assert.deepEqual((reparsed[0].commands[0].parameters[1].handlerSignatureParameters || []).map(item => item.type), ['整数型', '文本型']);
  // 处理器参数声明行原文形态
  assert.ok(serialized.includes('处理器 进度回调(整数型 序号, 文本型 阶段)) = run_progress'));
  assert.ok(serialized.includes('类 计数器 = Counter'));
});

test('v2 诊断：缺签名、嵌套处理器、签名传址、类缺头文件、创建返回类型、销毁参数、方法缺 C++ 名', () => {
  const diagnostics = getProjectCppSourceLibraryDiagnostics([
    '包 项目C++源码库',
    'C++源码库 库一',
    '  源码 = cpp/a.cpp',
    '  空 执行(整数型 次数, 处理器 回调) = run',
    '  空 嵌套(处理器 回调(处理器 内层)) = nested',
    '  空 签名传址(处理器 回调(整数型 值 传址)) = refcb',
    '  空 坏签名类型(处理器 回调(数组型 值)) = badcb',
    '结束C++源码库',
    'C++源码库 库二',
    '  源码 = cpp/b.cpp',
    '  类 计数器 = 中文类',
    '    方法 计数器 创建(整数型 初始值)',
    '  结束类',
    '结束C++源码库',
    'C++源码库 库三',
    '  源码 = cpp/c.cpp',
    '  头文件 = cpp/c.h',
    '  类 计数器 = Counter',
    '    方法 整数型 创建(整数型 初始值)',
    '    方法 整数型 销毁(整数型 多余)',
    '    方法 整数型 取当前()',
    '  结束类',
    '结束C++源码库'
  ].join('\n'));
  const messages = diagnostics.map(item => item.message);
  assert.ok(messages.some(item => item.includes('缺少内联签名')));
  assert.ok(messages.some(item => item.includes('不允许嵌套处理器')));
  assert.ok(messages.some(item => item.includes('回调签名参数「值」不支持传址')));
  assert.ok(messages.some(item => item.includes('回调签名参数「值」类型「数组型」不支持')));
  assert.ok(messages.some(item => item.includes('类名「中文类」不是合法的英文 C++ 标识符')));
  assert.ok(messages.filter(item => item.includes('未声明「头文件 =」') && item.includes('类 计数器')).length >= 1);
  assert.ok(messages.some(item => item.includes('「创建」方法返回类型必须是本类名')));
  assert.ok(messages.some(item => item.includes('「销毁」方法返回类型必须是空')));
  assert.ok(messages.some(item => item.includes('「销毁」方法不能声明参数')));
  assert.ok(messages.some(item => item.includes('方法 取当前 缺少 C++ 方法名')));
  // 合法 v2 声明零诊断
  assert.equal(getProjectCppSourceLibraryDiagnostics(V2_SOURCE).length, 0);
});

test('v2 虚拟模块：类合成 创建/销毁/方法 命令带 cppClassMethod invocation，处理器参数带 handlerSignature 与 cppCallback', () => {
  const module = createProjectCppSourceDeclarationModule(parseLingCpp(V2_SOURCE).program.cppLibraries, 'proj-v2');
  assert.ok(module);
  const bindings = module.manifest.bindings.commands;
  const createBinding = bindings.find(item => item.command === '计数器_创建');
  assert.ok(createBinding);
  assert.equal(createBinding.returnType, 'longLong');
  assert.deepEqual(createBinding.invocation, { kind: 'cppClassMethod', className: 'Counter', form: 'constructor' });
  const destroyBinding = bindings.find(item => item.command === '计数器_销毁');
  assert.deepEqual(destroyBinding?.invocation, { kind: 'cppClassMethod', className: 'Counter', form: 'destructor' });
  assert.deepEqual(destroyBinding?.parameters?.[0], { name: '对象', type: 'longLong', description: '计数器 对象句柄（由 计数器_创建 返回）。' });
  const methodBinding = bindings.find(item => item.command === '计数器_取当前');
  assert.deepEqual(methodBinding?.invocation, { kind: 'cppClassMethod', className: 'Counter', cppMethodName: 'get_value', form: 'method' });
  assert.ok(bindings.some(item => item.command === '计数器_累加'));
  // 处理器参数：handler 词表 + handlerSignature；整条命令带 cppCallback invocation
  const progressBinding = bindings.find(item => item.command === '执行进度');
  assert.ok(progressBinding);
  assert.equal(progressBinding.parameters?.[1].type, 'handler');
  assert.deepEqual(progressBinding.parameters?.[1].handlerSignature, { parameterTypes: ['整数型', '文本型'], returnType: '空' });
  assert.deepEqual(progressBinding.invocation, { kind: 'cppCallback' });
  // 类「创建」命令返回类型标注为长整数型（句柄），补全贡献包含合成命令
  const contributions = module.manifest.contributes.commands;
  assert.ok(contributions.some(item => item.name === '计数器_创建' && item.returnType === '长整数型'));
  assert.ok(contributions.some(item => item.name === '计数器_累加'));
});

test('v2 声明头：<functional> 与 std::function 形参；类注释指向头文件', () => {
  const header = generateProjectCppSourceDeclarationHeader(parseLingCpp(V2_SOURCE).program.cppLibraries);
  assert.ok(header.includes('#include <functional>'));
  // 下载库带头文件 → include 模式，无前置声明；类注释出现
  assert.ok(header.includes('#include "../sources/cpp/downloader.h"'));
  assert.ok(header.includes('类 计数器 → Counter'));
  // 无头文件的库 + 处理器命令 → 前置声明含 std::function
  const noHeaderSource = [
    '包 项目C++源码库',
    'C++源码库 库一',
    '  源码 = cpp/a.cpp',
    '  空 执行进度(整数型 次数, 处理器 进度回调(整数型 序号, 字节集 数据)) = run_progress',
    '结束C++源码库'
  ].join('\n');
  const forwardHeader = generateProjectCppSourceDeclarationHeader(parseLingCpp(noHeaderSource).program.cppLibraries);
  assert.ok(forwardHeader.includes('void run_progress(int p0, std::function<void(int, const std::vector<unsigned char>&)> p1);'));
});

// ===== v3：回调返回值 / 数组参数 / 附加包含目录 / 异常捕获 =====

const V3_SOURCE = [
  '包 项目C++源码库',
  '',
  'C++源码库 算法库',
  '  源码 = cpp/algo.cpp',
  '  头文件 = cpp/algo.h',
  '  包含目录 = cpp/third_party',
  '  异常 = 捕获',
  '  整数型 求和(整数型[] 数据) = sum_values',
  '  文本型[] 名称列表() = list_names',
  '  逻辑型 全部通过(整数型[] 分数, 处理器 校验器(整数型 值) 回传 逻辑型) = check_all',
  '结束C++源码库'
].join('\n');

test('v3 解析数组参数、包含目录、异常捕获与回调回传，序列化往返保留', () => {
  const parsed = parseLingCpp(V3_SOURCE);
  assert.equal(parsed.diagnostics.length, 0);
  const library = parsed.program.cppLibraries[0];
  assert.deepEqual(library.includeDirs.map(item => item.relativePath), ['cpp/third_party']);
  assert.equal(library.exceptionCapture, true);
  assert.equal(library.commands[0].parameters[0].type, '整数型[]');
  assert.equal(library.commands[1].returnType, '文本型[]');
  const handlerParameter = library.commands[2].parameters[1];
  assert.equal(handlerParameter.handlerReturnType, '逻辑型');
  // 序列化幂等 + 语义保留
  const serialized = serializeProjectCppSourceLibraries('项目C++源码库', parseLingCpp(V3_SOURCE).program.cppLibraries);
  const reparsed = parseLingCpp(serialized).program.cppLibraries;
  assert.equal(serializeProjectCppSourceLibraries('项目C++源码库', reparsed), serialized);
  assert.equal(reparsed[0].exceptionCapture, true);
  assert.equal(reparsed[0].commands[2].parameters[1].handlerReturnType, '逻辑型');
  assert.ok(serialized.includes('包含目录 = cpp/third_party'));
  assert.ok(serialized.includes('异常 = 捕获'));
  assert.ok(serialized.includes('处理器 校验器(整数型 值) 回传 逻辑型'));
});

test('v3 虚拟模块：数组 binding、包装名改写、取错误命令、捕获类命令省略 invocation', () => {
  const captureClassSource = [
    V3_SOURCE,
    '',
    'C++源码库 池库',
    '  头文件 = cpp/pool.h',
    '  异常 = 捕获',
    '  类 对象池 = Pool',
    '    方法 对象池 创建(整数型 容量)',
    '    方法 空 销毁()',
    '  结束类',
    '结束C++源码库'
  ].join('\n');
  const module = createProjectCppSourceDeclarationModule(parseLingCpp(captureClassSource).program.cppLibraries, 'proj-v3');
  assert.ok(module);
  const bindings = module.manifest.bindings.commands;
  // 数组：abi=array，文本型[] 返回
  const sumBinding = bindings.find(item => item.command === '求和');
  assert.equal(sumBinding?.parameters?.[0].type, 'array');
  assert.equal(bindings.find(item => item.command === '名称列表')?.returnType, 'array');
  // 回调返回：handlerSignature.returnType = 逻辑型
  assert.deepEqual(bindings.find(item => item.command === '全部通过')?.parameters?.[1].handlerSignature, { parameterTypes: ['整数型'], returnType: '逻辑型' });
  // 异常包装：命令 runtimeName 改包装
  assert.equal(sumBinding?.runtimeName, 'LB_CppSrcWrap_1_sum_values');
  // 捕获库的类命令：runtimeName 指包装、invocation 省略
  const poolCreate = bindings.find(item => item.command === '对象池_创建');
  assert.equal(poolCreate?.runtimeName, 'LB_CppSrcWrap_2_New_Pool');
  assert.equal(poolCreate?.invocation, undefined);
  const poolDestroy = bindings.find(item => item.command === '对象池_销毁');
  assert.equal(poolDestroy?.runtimeName, 'LB_CppSrcWrap_2_Delete_Pool');
  // 自动取错误命令（每个捕获库一条）
  assert.equal(bindings.find(item => item.command === '算法库_取错误')?.runtimeName, 'LB_CppSrcTakeError');
  assert.equal(bindings.find(item => item.command === '池库_取错误')?.runtimeName, 'LB_CppSrcTakeError');
  assert.ok(module.manifest.contributes.commands.some(item => item.name === '算法库_取错误' && item.returnType === '文本型'));
});

test('v3 声明头：std::function 非空返回、数组 vector 形参、异常包装与运行时', () => {
  // 算法库带头文件 → include 模式无前置声明；前置声明断言用无头文件的等价库。
  const header = generateProjectCppSourceDeclarationHeader(parseLingCpp(V3_SOURCE).program.cppLibraries);
  assert.ok(header.includes('inline int LB_CppSrcWrap_1_sum_values(const std::vector<int>& p0) {'));
  const forwardSource = V3_SOURCE.replace('  头文件 = cpp/algo.h\n', '');
  const forwardHeader = generateProjectCppSourceDeclarationHeader(parseLingCpp(forwardSource).program.cppLibraries);
  assert.ok(forwardHeader.includes('int sum_values(const std::vector<int>& p0);'));
  assert.ok(forwardHeader.includes('std::vector<std::wstring> list_names();'));
  assert.ok(forwardHeader.includes('bool check_all(const std::vector<int>& p0, std::function<bool(int)> p1);'));
  // 异常包装（真实声明 + 包装定义）与运行时
  assert.ok(header.includes('inline int LB_CppSrcWrap_1_sum_values(const std::vector<int>& p0) {'));
  assert.ok(header.includes('catch (const std::exception& lbError) { LB_CppSrcRecordCppError(lbError.what()); }'));
  assert.ok(header.includes('inline std::wstring LB_CppSrcTakeError() {'));
  assert.ok(header.includes('thread_local std::wstring'));
});

test('v3 诊断：数组元素白名单、数组禁传址、回传类型白名单', () => {
  const diagnostics = getProjectCppSourceLibraryDiagnostics([
    '包 项目C++源码库',
    'C++源码库 库一',
    '  源码 = cpp/a.cpp',
    '  整数型 坏元素(字节集[] 数据) = bad_elem',
    '  空 数组传址(整数型[] 数据 传址) = arr_ref',
    '  逻辑型 坏回传(处理器 回调(整数型 值) 回传 数组型) = bad_ret',
    '结束C++源码库'
  ].join('\n'));
  const messages = diagnostics.map(item => item.message);
  assert.ok(messages.some(item => item.includes('参数「数据」类型「字节集[]」不支持')));
  assert.ok(messages.some(item => item.includes('传址参数「数据」类型「整数型[]」不支持传址')));
  assert.ok(messages.some(item => item.includes('回传类型「数组型」不支持')));
  // 合法 v3 声明零诊断
  assert.equal(getProjectCppSourceLibraryDiagnostics(V3_SOURCE).length, 0);
});

// ===== v4：命名空间 =====

const V4_SOURCE = [
  '包 项目C++源码库',
  '',
  'C++源码库 算法库',
  '  源码 = cpp/algo.cpp',
  '  头文件 = cpp/algo.h',
  '  命名空间 = lb_algo',
  '  整数型 加法计算(整数型 a, 整数型 b) = add',
  '结束C++源码库'
].join('\n');

test('v4 解析命名空间并序列化往返，重复命名空间给诊断', () => {
  const parsed = parseLingCpp(V4_SOURCE);
  assert.equal(parsed.diagnostics.length, 0);
  assert.equal(parsed.program.cppLibraries[0].namespaceName, 'lb_algo');
  const serialized = serializeProjectCppSourceLibraries('项目C++源码库', parsed.program.cppLibraries);
  const reparsed = parseLingCpp(serialized).program.cppLibraries;
  assert.equal(serializeProjectCppSourceLibraries('项目C++源码库', reparsed), serialized);
  assert.equal(reparsed[0].namespaceName, 'lb_algo');
  assert.ok(serialized.includes('命名空间 = lb_algo'));
  // 重复声明（不同名）诊断
  const dup = parseLingCpp([
    '包 项目C++源码库',
    'C++源码库 库一',
    '  源码 = cpp/a.cpp',
    '  命名空间 = ns_a',
    '  命名空间 = ns_b',
    '结束C++源码库'
  ].join('\n'));
  assert.ok(dup.diagnostics.some(item => item.message.includes('重复声明命名空间')));
  // 非法命名空间名（数字开头/中文）整行不匹配 → 落无法识别行诊断
  const bad = parseLingCpp([
    '包 项目C++源码库',
    'C++源码库 库一',
    '  源码 = cpp/a.cpp',
    '  命名空间 = 9bad',
    '结束C++源码库'
  ].join('\n'));
  assert.ok(bad.diagnostics.some(item => item.message.includes('无法识别的 C++ 源码库声明行')));
});

test('v4 虚拟模块：命名空间库绑定 runtimeName 改为中文命令名（转发函数名）', () => {
  const module = createProjectCppSourceDeclarationModule(parseLingCpp(V4_SOURCE).program.cppLibraries, 'proj-v4');
  assert.ok(module);
  const binding = module.manifest.bindings.commands.find(item => item.command === '加法计算');
  assert.equal(binding?.runtimeName, '加法计算');
  // 与异常捕获叠加：捕获优先（包装体内做限定调用），runtimeName 仍是包装
  const bothSource = V4_SOURCE.replace('  命名空间 = lb_algo', '  命名空间 = lb_algo\n  异常 = 捕获');
  const bothModule = createProjectCppSourceDeclarationModule(parseLingCpp(bothSource).program.cppLibraries, 'proj-v4b');
  assert.equal(bothModule?.manifest.bindings.commands.find(item => item.command === '加法计算')?.runtimeName, 'LB_CppSrcWrap_1_add');
});

test('v4 声明头：namespace 块前置声明 + 中文命令名全局转发函数；包装体限定调用', () => {
  const header = generateProjectCppSourceDeclarationHeader(parseLingCpp(V4_SOURCE).program.cppLibraries);
  // 带头文件 → include 模式（声明以头文件为准），namespace 块只出现在无头文件库；转发函数两种模式都发。
  assert.ok(header.includes('inline int 加法计算(int p0, int p1) { return lb_algo::add(p0, p1); }'));
  const noHeaderSource = V4_SOURCE.replace('  头文件 = cpp/algo.h\n', '');
  const noHeaderHeader = generateProjectCppSourceDeclarationHeader(parseLingCpp(noHeaderSource).program.cppLibraries);
  assert.ok(noHeaderHeader.includes('namespace lb_algo {'));
  assert.ok(noHeaderHeader.includes('  int add(int p0, int p1);'));
  // 与异常捕获叠加：包装体限定调用命名空间内函数
  const bothSource = V4_SOURCE.replace('  命名空间 = lb_algo', '  命名空间 = lb_algo\n  异常 = 捕获');
  const bothHeader = generateProjectCppSourceDeclarationHeader(parseLingCpp(bothSource).program.cppLibraries);
  assert.ok(bothHeader.includes('inline int LB_CppSrcWrap_1_add(int p0, int p1) {'));
  assert.ok(bothHeader.includes('return lb_algo::add(p0, p1);'));
  // 类块 + 命名空间 → warning 诊断
  const classNamespaceSource = [
    '包 项目C++源码库',
    'C++源码库 库一',
    '  源码 = cpp/a.cpp',
    '  头文件 = cpp/a.h',
    '  命名空间 = ns_a',
    '  类 计数器 = Counter',
    '    方法 计数器 创建(整数型 初始值)',
    '  结束类',
    '结束C++源码库'
  ].join('\n');
  const warnings = getProjectCppSourceLibraryDiagnostics(classNamespaceSource).filter(item => item.level === 'warning');
  assert.ok(warnings.some(item => item.message.includes('暂不支持命名空间')));
});

// ===== v5：类类型化局部变量 =====

test('v5 虚拟模块把类名登记为不透明句柄类型（cppType=long long），生成器按 long long 翻译局部声明', () => {
  const module = createProjectCppSourceDeclarationModule(parseLingCpp(V2_SOURCE).program.cppLibraries, 'proj-v5');
  assert.ok(module);
  const contributedType = module.manifest.contributes.types?.find(item => item.name === '计数器');
  assert.ok(contributedType);
  assert.equal(contributedType.cppType, 'long long');
  // 生成器链路：类类型局部声明翻译为 long long（句柄），赋 0 初始化合法
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.win32.basic');
  const enabledModules: InstalledModule[] = [{ manifest: manifest!, installPath: 'builtin://lingbuilder.win32.basic', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }];
  const project = {
    schemaVersion: 2,
    id: 'cpp-source-v5',
    name: '类类型化局部变量',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'v5', width: 320, height: 200, background: '#202028', description: '', controls: [] }]
  } as never;
  const typedLocalSource = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        局部 计数器 对象 = 0',
    '        对象 = 计数器_创建(40)',
    '        计数器_销毁(对象)',
    '    结束',
    '结束类'
  ].join('\n');
  const declaration = V2_SOURCE;
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSourceCode: typedLocalSource,
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    lingCppSources: [
      { filePath: 'src/MainWindow.lcpp', sourceCode: typedLocalSource },
      { filePath: 'src/项目C++源码库.lcpp', sourceCode: declaration }
    ]
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('long long 对象 = 0;'), 'main.cpp 未把类类型局部声明翻译为 long long 句柄');
});

// ===== v6：结构体映射 =====

const V6_SOURCE = [
  '包 项目C++源码库',
  '',
  'C++源码库 几何库',
  '  源码 = cpp/geometry.cpp',
  '  结构体 点 = Point',
  '    小数型 x // 横坐标',
  '    小数型 y',
  '    文本型 名称',
  '  结束结构体',
  '  小数型 两点距离(点 a, 点 b) = distance',
  '  点 取中点(点 a, 点 b) = midpoint',
  '  文本型 描述(点 p) = describe',
  '结束C++源码库'
].join('\n');

test('v6 解析结构体块（字段/备注/C++类型名）并序列化 100% 往返幂等', () => {
  const parsed = parseLingCpp(V6_SOURCE);
  assert.equal(parsed.diagnostics.length, 0);
  const library = parsed.program.cppLibraries[0];
  assert.equal(library.structs.length, 1);
  const structItem = library.structs[0];
  assert.equal(structItem.name, '点');
  assert.equal(structItem.cppName, 'Point');
  assert.deepEqual(structItem.fields.map(field => `${field.type} ${field.name}`), ['小数型 x', '小数型 y', '文本型 名称']);
  assert.equal(structItem.fields[0].note, '横坐标');
  const serialized = serializeProjectCppSourceLibraries('项目C++源码库', parsed.program.cppLibraries);
  assert.ok(serialized.includes('结构体 点 = Point'), serialized);
  assert.ok(serialized.includes('小数型 x // 横坐标'));
  const second = parseLingCpp(serialized).program.cppLibraries;
  const serializedAgain = serializeProjectCppSourceLibraries('项目C++源码库', second);
  assert.equal(serializedAgain, serialized);
  assert.equal(second[0].commands[1].returnType, '点');
  assert.equal(second[0].commands[1].parameters[0].type, '点');
});

test('v6 诊断：字段类型白名单、结构体重名、非 ASCII 类型名、访问器命令名冲突', () => {
  const badFieldsSource = [
    '包 项目C++源码库',
    'C++源码库 库一',
    '  源码 = cpp/a.cpp',
    '  结构体 点 = Point',
    '    小数型 x',
    '    字节集 数据',
    '  结束结构体',
    '  结构体 点 = Vec2',
    '    整数型[8] 数据',
    '  结束结构体',
    '  结构体 坐标 = 坐标',
    '    小数型 x',
    '  结束结构体',
    '结束C++源码库'
  ].join('\n');
  const messages = getProjectCppSourceLibraryDiagnostics(badFieldsSource).map(item => item.message);
  assert.ok(messages.some(item => item.includes('字段「数据」类型「字节集」不支持')), messages.join('\n'));
  assert.ok(messages.some(item => item.includes('与「库一」库中的结构体重名')), messages.join('\n'));
  assert.ok(messages.some(item => item.includes('C++ 类型名「坐标」不是合法的英文标识符')), messages.join('\n'));
  const nestedSource = [
    '包 项目C++源码库',
    'C++源码库 库一',
    '  源码 = cpp/a.cpp',
    '  结构体 点 = Point',
    '    小数型 x',
    '  结束结构体',
    '  结构体 线段 = Segment',
    '    点 起点',
    '  结束结构体',
    '结束C++源码库'
  ].join('\n');
  const nestedMessages = getProjectCppSourceLibraryDiagnostics(nestedSource).map(item => item.message);
  assert.ok(nestedMessages.some(item => item.includes('字段「起点」类型「点」是结构体')), nestedMessages.join('\n'));
  const accessorClashSource = [
    '包 项目C++源码库',
    'C++源码库 库一',
    '  源码 = cpp/a.cpp',
    '  结构体 点 = Point',
    '    小数型 x',
    '  结束结构体',
    '  整数型 点_创建() = make_point',
    '结束C++源码库'
  ].join('\n');
  const clashMessages = getProjectCppSourceLibraryDiagnostics(accessorClashSource).map(item => item.message);
  assert.ok(clashMessages.some(item => item.includes('访问器命令 点_创建 与已声明的命令重名')), clashMessages.join('\n'));
});

test('v6 诊断：跨库结构体引用、类方法结构体、回调签名结构体、命名空间+结构体、结构体传址', () => {
  const crossLibrarySource = [
    '包 项目C++源码库',
    'C++源码库 库一',
    '  源码 = cpp/a.cpp',
    '  结构体 点 = Point',
    '    小数型 x',
    '  结束结构体',
    '结束C++源码库',
    'C++源码库 库二',
    '  源码 = cpp/b.cpp',
    '  小数型 长度(点 p) = length',
    '结束C++源码库'
  ].join('\n');
  const crossMessages = getProjectCppSourceLibraryDiagnostics(crossLibrarySource)
    .map(item => `${item.message} ${item.suggestion}`);
  assert.ok(crossMessages.some(item => item.includes('「点」是「库一」库的结构体') && item.includes('库内作用域')), crossMessages.join('\n'));
  const classMethodSource = [
    '包 项目C++源码库',
    'C++源码库 库一',
    '  源码 = cpp/a.cpp',
    '  头文件 = cpp/a.h',
    '  结构体 点 = Point',
    '    小数型 x',
    '  结束结构体',
    '  类 计数器 = Counter',
    '    方法 小数型 计算含点(点 p)',
    '    方法 点 取原点()',
    '  结束类',
    '结束C++源码库'
  ].join('\n');
  const classMessages = getProjectCppSourceLibraryDiagnostics(classMethodSource)
    .map(item => `${item.message} ${item.suggestion}`);
  assert.ok(classMessages.some(item => item.includes('类方法暂不支持结构体参数')), classMessages.join('\n'));
  assert.ok(classMessages.some(item => item.includes('方法 取原点 返回类型「点」是结构体')), classMessages.join('\n'));
  const callbackSource = V6_SOURCE.replace(
    '  文本型 描述(点 p) = describe',
    '  空 执行(处理器 回调(点 状态)) = run');
  const callbackMessages = getProjectCppSourceLibraryDiagnostics(callbackSource).map(item => item.message);
  assert.ok(callbackMessages.some(item => item.includes('回调签名参数「状态」类型「点」是结构体')), callbackMessages.join('\n'));
  const namespaceSource = V6_SOURCE.replace('  源码 = cpp/geometry.cpp', '  源码 = cpp/geometry.cpp\n  命名空间 = geo');
  const namespaceMessages = getProjectCppSourceLibraryDiagnostics(namespaceSource).map(item => item.message);
  assert.ok(namespaceMessages.some(item => item.includes('结构体 点 暂不支持命名空间')), namespaceMessages.join('\n'));
  const byRefSource = V6_SOURCE.replace('小数型 两点距离(点 a, 点 b)', '小数型 两点距离(点 a 传址, 点 b)');
  const byRefMessages = getProjectCppSourceLibraryDiagnostics(byRefSource).map(item => item.message);
  assert.ok(byRefMessages.some(item => item.includes('结构体参数「a」不支持传址')), byRefMessages.join('\n'));
});

test('v6 虚拟模块：访问器命令与 binding（句柄=longLong）、命令 runtimeName 指向适配器、结构体名登记句柄类型', () => {
  const module = createProjectCppSourceDeclarationModule(parseLingCpp(V6_SOURCE).program.cppLibraries, 'proj-v6');
  assert.ok(module);
  const commands = module.manifest.contributes.commands;
  const accessorNames = ['点_创建', '点_销毁', '点_取x', '点_置x', '点_取y', '点_置y', '点_取名称', '点_置名称'];
  accessorNames.forEach(name => assert.ok(commands.some(item => item.name === name), `缺少访问器命令 ${name}`));
  assert.equal(commands.find(item => item.name === '点_取x')?.returnType, '小数型');
  assert.equal(commands.find(item => item.name === '点_置x')?.returnType, '空');
  assert.equal(commands.find(item => item.name === '点_取名称')?.returnType, '文本型');
  const bindings = module.manifest.bindings.commands;
  const distanceBinding = bindings.find(item => item.command === '两点距离');
  assert.equal(distanceBinding?.runtimeName, '两点距离');
  assert.equal(distanceBinding?.returnType, 'double');
  assert.ok(distanceBinding?.parameters.every(parameter => parameter.type === 'longLong'));
  const midpointBinding = bindings.find(item => item.command === '取中点');
  assert.equal(midpointBinding?.runtimeName, '取中点');
  assert.equal(midpointBinding?.returnType, 'longLong');
  const createBinding = bindings.find(item => item.command === '点_创建');
  assert.equal(createBinding?.runtimeName, '点_创建');
  assert.ok(!JSON.stringify(createBinding).includes('invocation'), '访问器不应带 invocation');
  const contributedType = module.manifest.contributes.types?.find(item => item.name === '点');
  assert.ok(contributedType);
  assert.equal(contributedType.cppType, 'long long');
  const aliasSource = V6_SOURCE.replace('文本型 描述(点 p) = describe', '文本型 描述(点 p) = 点_取x');
  const aliasModule = createProjectCppSourceDeclarationModule(parseLingCpp(aliasSource).program.cppLibraries, 'proj-v6b');
  const describeCommand = aliasModule?.manifest.contributes.commands.find(item => item.name === '描述');
  assert.equal(describeCommand?.aliases, undefined);
});

test('v6 声明头：结构体定义在期望签名之前、签名 const Point&/按值返回、访问器与适配器发射', () => {
  const header = generateProjectCppSourceDeclarationHeader(parseLingCpp(V6_SOURCE).program.cppLibraries);
  const structDefIndex = header.indexOf('struct Point {');
  const declIndex = header.indexOf('double distance(const Point& p0, const Point& p1);');
  assert.ok(structDefIndex >= 0, '缺结构体定义');
  assert.ok(declIndex > structDefIndex, '期望签名必须在结构体定义之后');
  assert.ok(header.includes('Point midpoint(const Point& p0, const Point& p1);'), header);
  assert.ok(header.includes('std::wstring 名称;'), '文本型字段应为 std::wstring');
  assert.ok(header.includes('#include <string>'), '文本型字段需要 <string>');
  assert.ok(header.includes('inline long long 点_创建() { return reinterpret_cast<long long>(new Point()); }'));
  assert.ok(header.includes('inline void 点_销毁(long long lbHandle) { if (lbHandle) delete reinterpret_cast<Point*>(lbHandle); }'));
  assert.ok(header.includes('inline double 点_取x(long long lbHandle) { return lbHandle ? reinterpret_cast<Point*>(lbHandle)->x : 0.0; }'));
  assert.ok(header.includes('inline const wchar_t* 点_取名称(long long lbHandle) { return lbHandle ? reinterpret_cast<Point*>(lbHandle)->名称.c_str() : L""; }'));
  assert.ok(header.includes('inline void 点_置名称(long long lbHandle, const wchar_t* lbValue)'));
  assert.ok(header.includes('inline double 两点距离(long long p0, long long p1) { return distance(*reinterpret_cast<Point*>(p0), *reinterpret_cast<Point*>(p1)); }'));
  assert.ok(header.includes('inline long long 取中点(long long p0, long long p1) { return reinterpret_cast<long long>(new Point(midpoint(*reinterpret_cast<Point*>(p0), *reinterpret_cast<Point*>(p1)))); }'));
  const headeredSource = V6_SOURCE.replace('  源码 = cpp/geometry.cpp', '  源码 = cpp/geometry.cpp\n  头文件 = cpp/geometry.h');
  const headeredHeader = generateProjectCppSourceDeclarationHeader(parseLingCpp(headeredSource).program.cppLibraries);
  assert.ok(!headeredHeader.includes('struct Point {'), '头文件库不应发结构体定义');
  assert.ok(headeredHeader.includes('结构体 点 → Point（定义来自上方头文件'), headeredHeader);
  const captureSource = V6_SOURCE.replace('  源码 = cpp/geometry.cpp', '  源码 = cpp/geometry.cpp\n  异常 = 捕获');
  const captureHeader = generateProjectCppSourceDeclarationHeader(parseLingCpp(captureSource).program.cppLibraries);
  assert.ok(captureHeader.includes('inline long long LB_CppSrcWrap_1_midpoint(long long p0, long long p1) {'), captureHeader);
  assert.ok(captureHeader.includes('try { return reinterpret_cast<long long>(new Point(midpoint(*reinterpret_cast<Point*>(p0), *reinterpret_cast<Point*>(p1)))); }'));
  assert.ok(!captureHeader.includes('inline long long 取中点('), '捕获库不应另发适配器');
});

test('v6 生成器：结构体命令调用发射适配器调用，结构体名局部声明翻译为 long long', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.win32.basic');
  const enabledModules: InstalledModule[] = [{ manifest: manifest!, installPath: 'builtin://lingbuilder.win32.basic', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }];
  const project = {
    schemaVersion: 2,
    id: 'cpp-source-v6',
    name: '结构体映射',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'v6', width: 320, height: 200, background: '#202028', description: '', controls: [] }]
  } as never;
  const windowSource = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        局部 点 a = 0',
    '        局部 点 b = 0',
    '        局部 小数型 距离 = 0',
    '        局部 点 中点 = 0',
    '        a = 点_创建()',
    '        b = 点_创建()',
    '        点_置x(a, 3)',
    '        点_置y(a, 4)',
    '        距离 = 两点距离(a, b)',
    '        中点 = 取中点(a, b)',
    '        调试输出(点_取名称(中点))',
    '        点_销毁(中点)',
    '        点_销毁(b)',
    '        点_销毁(a)',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSourceCode: windowSource,
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    lingCppSources: [
      { filePath: 'src/MainWindow.lcpp', sourceCode: windowSource },
      { filePath: 'src/项目C++源码库.lcpp', sourceCode: V6_SOURCE }
    ]
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('long long a = 0;'), '结构体类型局部声明应翻译为 long long 句柄');
  assert.ok(mainCpp.includes('点_创建()'));
  assert.ok(mainCpp.includes('点_置x(a, 3)'));
  assert.ok(mainCpp.includes('两点距离(a, b)'));
  assert.ok(mainCpp.includes('取中点(a, b)'));
  assert.ok(mainCpp.includes('点_取名称(中点)'));
  assert.ok(mainCpp.includes('点_销毁(中点)'));
});

test('v6 .h 导入器跳过 struct 定义（提示手写声明块）', () => {
  const headerText = [
    'struct Point { double x; double y; };',
    'int add(int a, int b);'
  ].join('\n');
  const commands = parseCppHeaderDeclarations(headerText);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].cppName, 'add');
});

// ===== v6.2：跨线程回调封送（「界面线程」处理器） =====

const V62_SOURCE = [
  '包 项目C++源码库',
  '',
  'C++源码库 后台库',
  '  源码 = cpp/worker.cpp',
  '  空 执行任务(整数型 次数, 处理器 进度回调(整数型 序号, 文本型 阶段) 界面线程) = run_worker',
  '结束C++源码库'
].join('\n');

test('v6.2 解析「界面线程」封送后缀并序列化往返；封送+回传给中文阻断', () => {
  const parsed = parseLingCpp(V62_SOURCE);
  assert.equal(parsed.diagnostics.length, 0);
  const parameter = parsed.program.cppLibraries[0].commands[0].parameters[1];
  assert.equal(parameter.type, '处理器');
  assert.equal(parameter.handlerMarshalUiThread, true);
  assert.deepEqual((parameter.handlerSignatureParameters || []).map(item => item.type), ['整数型', '文本型']);
  // 序列化 100% 往返
  const serialized = serializeProjectCppSourceLibraries('项目C++源码库', parsed.program.cppLibraries);
  assert.ok(serialized.includes('处理器 进度回调(整数型 序号, 文本型 阶段) 界面线程'), serialized);
  const second = parseLingCpp(serialized).program.cppLibraries;
  assert.equal(serializeProjectCppSourceLibraries('项目C++源码库', second), serialized);
  // 与 回传 同现可解析，但诊断阻断（封送是异步投递，无法同步回传）
  const withReturn = V62_SOURCE.replace(
    '处理器 进度回调(整数型 序号, 文本型 阶段) 界面线程',
    '处理器 进度回调(整数型 序号) 回传 逻辑型 界面线程');
  const blocked = getProjectCppSourceLibraryDiagnostics(withReturn).map(item => `${item.message} ${item.suggestion}`);
  assert.ok(blocked.some(item => item.includes('「界面线程」封送且带非空返回')), blocked.join('\n'));
  // 回调签名里不能写界面线程（整体不匹配处理器片段 → 该参数落不进内联签名）
  assert.equal(parseLingCpp(V62_SOURCE).program.cppLibraries[0].commands[0].parameters[0].type, '整数型');
});

test('v6.2 虚拟模块 binding 参数带 handlerMarshalUiThread 标记', () => {
  const module = createProjectCppSourceDeclarationModule(parseLingCpp(V62_SOURCE).program.cppLibraries, 'proj-v62');
  assert.ok(module);
  const binding = module?.manifest.bindings.commands.find(item => item.command === '执行任务');
  assert.ok(binding);
  const handlerParameter = binding.parameters.find(item => item.type === 'handler');
  assert.ok(handlerParameter);
  assert.equal(handlerParameter.handlerMarshalUiThread, true);
  // 未声明封送的回调不带标记（维持线程透传）
  const plainSource = V62_SOURCE.replace(' 界面线程) = run_worker', ') = run_worker');
  const plainModule = createProjectCppSourceDeclarationModule(parseLingCpp(plainSource).program.cppLibraries, 'proj-v62b');
  const plainHandler = plainModule?.manifest.bindings.commands.find(item => item.command === '执行任务')?.parameters.find(item => item.type === 'handler');
  assert.equal(plainHandler?.handlerMarshalUiThread, undefined);
});

test('v6.2 生成器：封送回调发射 PostMessage 闭包，main.cpp 带封送窗口运行时与界面线程创建调用', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.win32.basic');
  const enabledModules: InstalledModule[] = [{ manifest: manifest!, installPath: 'builtin://lingbuilder.win32.basic', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }];
  const project = {
    schemaVersion: 2,
    id: 'cpp-source-v62',
    name: '跨线程封送',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'v6.2', width: 320, height: 200, background: '#202028', description: '', controls: [] }]
  } as never;
  const windowSource = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        执行任务(3, &任务进度)',
    '    结束',
    '    空 任务进度(整数型 序号, 文本型 阶段)',
    '        调试输出(到文本(序号) + 阶段)',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSourceCode: windowSource,
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    lingCppSources: [
      { filePath: 'src/MainWindow.lcpp', sourceCode: windowSource },
      { filePath: 'src/项目C++源码库.lcpp', sourceCode: V62_SOURCE }
    ]
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const allGenerated = generated.files.map(file => file.content).join('\n');
  // 封送 lambda：外层捕获 this，载荷值拷贝（文本型 → std::wstring），经 LB_CppSrcPostToUiThread 投递
  assert.ok(
    mainCpp.includes('[this](int p0, const wchar_t* p1) { std::function<void()>* lbInvoke = new std::function<void()>([this, lbP0(p0), lbP1(std::wstring(p1))]() { this->任务进度(lbP0, lbP1.c_str()); }); LB_CppSrcPostToUiThread(lbInvoke); }'),
    'main.cpp 未发射封送 lambda'
  );
  // 封送窗口运行时与界面线程创建调用仅在真实使用时发射（运行时在 main.cpp 或分体布局的 lingbuilder_runtime.h）
  assert.ok(allGenerated.includes('WM_LINGBUILDER_CPPSRC_MARSHAL'), '生成产物缺封送窗口运行时');
  assert.ok(allGenerated.includes('PostMessageW(g_lbCppSrcMarshalWindow'), '生成产物缺 PostMessage 投递');
  assert.ok(mainCpp.includes('LB_CppSrcCreateMarshalWindow();'), 'wWinMain 缺封送窗口创建调用');
  // 负例：未使用封送回调的工程不发射封送运行时
  const plainDeclaration = V62_SOURCE.replace(' 界面线程) = run_worker', ') = run_worker');
  const plainGenerated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSourceCode: windowSource,
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    lingCppSources: [
      { filePath: 'src/MainWindow.lcpp', sourceCode: windowSource },
      { filePath: 'src/项目C++源码库.lcpp', sourceCode: plainDeclaration }
    ]
  });
  const plainMainCpp = plainGenerated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const plainAllGenerated = plainGenerated.files.map(file => file.content).join('\n');
  assert.ok(!plainAllGenerated.includes('WM_LINGBUILDER_CPPSRC_MARSHAL'), '未用封送不应发射封送窗口运行时');
  assert.ok(plainMainCpp.includes('[this](int p0, const wchar_t* p1) { return this->任务进度(p0, p1); }'), '未封送回调应维持线程透传直调 lambda');
});
