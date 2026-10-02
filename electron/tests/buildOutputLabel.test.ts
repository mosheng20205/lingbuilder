import assert from 'node:assert/strict';
import test from 'node:test';
import { describeBuildOutputDirectory, formatBuildPathSummaryLines, formatSuccessCompileChannel, resolveBuildOutputKind } from '../src/services/tasks/buildOutputLabel';

test('构建日志产物标签按产物形态播报 exe/控制台/DLL', () => {
  assert.equal(resolveBuildOutputKind('exe', false), 'application');
  assert.equal(resolveBuildOutputKind('exe', true), 'console-application');
  assert.equal(resolveBuildOutputKind('dll', false), 'dynamic-library');
  // 产物以实际链接结果为准：outputType=dll 时即使项目带控制台形态，产物也是 DLL。
  assert.equal(resolveBuildOutputKind('dll', true), 'dynamic-library');

  assert.equal(describeBuildOutputDirectory('application'), 'exe 输出目录');
  assert.equal(describeBuildOutputDirectory('console-application'), '控制台程序输出目录');
  assert.equal(describeBuildOutputDirectory('dynamic-library'), 'DLL 输出目录');
});

test('formatBuildPathSummaryLines 压缩为三行：生成目录锚点+可复制 VS 工程+产物输出目录', () => {
  const lines = formatBuildPathSummaryLines({
    buildDir: 'C:\ws\.lingbuilder-build\p\Win32\Debug',
    exportDir: 'C:\ws\generated\cpp\p',
    binDir: 'C:\ws\.lingbuilder-build\p\Win32\Debug\bin',
    outputKind: 'application',
    compilerSummary: 'msvc (cl)',
    buildConfigurationSummary: 'Debug|Win32'
  });
  assert.deepEqual(lines, [
    '已生成 Win32 C++ 工程：C:\ws\.lingbuilder-build\p\Win32\Debug（msvc (cl) · Debug|Win32）',
    '可复制 Visual Studio 工程（含 .sln）：C:\ws\generated\cpp\p',
    'exe 输出目录：C:\ws\.lingbuilder-build\p\Win32\Debug\bin'
  ]);

  // 无备注时锚点行不带括注；DLL 产物按 DLL 口径播报。
  const minimal = formatBuildPathSummaryLines({
    buildDir: 'C:\b', exportDir: 'C:\e', binDir: 'C:\b\bin', outputKind: 'dynamic-library'
  });
  assert.deepEqual(minimal, [
    '已生成 Win32 C++ 工程：C:\b',
    '可复制 Visual Studio 工程（含 .sln）：C:\e',
    'DLL 输出目录：C:\b\bin'
  ]);
});

test('formatBuildPathSummaryLines 首行播报解决方案 .lbsln 完整路径，缺省时省略该行', () => {
  const withSolution = formatBuildPathSummaryLines({
    buildDir: 'C:/ws/.lingbuilder-build/p/x64/Release',
    exportDir: 'C:/ws/generated/cpp/p',
    binDir: 'C:/ws/.lingbuilder-build/p/x64/Release/bin',
    outputKind: 'dynamic-library',
    solutionPath: 'C:/ws/中文项目生成DLL演示解决方案.lbsln'
  });
  assert.deepEqual(withSolution, [
    '解决方案：C:/ws/中文项目生成DLL演示解决方案.lbsln',
    '已生成 Win32 C++ 工程：C:/ws/.lingbuilder-build/p/x64/Release',
    '可复制 Visual Studio 工程（含 .sln）：C:/ws/generated/cpp/p',
    'DLL 输出目录：C:/ws/.lingbuilder-build/p/x64/Release/bin'
  ]);

  // 解决方案尚未建立（解析失败）时不传 solutionPath，保持原有三行形状。
  const withoutSolution = formatBuildPathSummaryLines({
    buildDir: 'C:/b', exportDir: 'C:/e', binDir: 'C:/b/bin', outputKind: 'application'
  });
  assert.equal(withoutSolution.some(line => line.startsWith('解决方案：')), false);
});

test('formatSuccessCompileChannel 成功路径丢弃纯回显、保留警告与错误', () => {
  // cl 正常编译只回显源文件名，属纯噪音，应丢弃。
  assert.equal(formatSuccessCompileChannel('stdout', 'main.cpp\n'), '');
  assert.equal(formatSuccessCompileChannel('stdout', ''), '');
  assert.equal(formatSuccessCompileChannel('stdout', undefined), '');
  assert.equal(formatSuccessCompileChannel('link stderr', '   '), '');
  // 中文 MSVC 的「正在生成代码。」也不该出现在成功日志里。
  assert.equal(formatSuccessCompileChannel('stdout', 'main.cpp\n正在生成代码。'), '');
  // 警告/错误关键字（中英文）保留完整通道内容。
  assert.equal(
    formatSuccessCompileChannel('stdout', 'main.cpp\nmain.cpp(10): warning C4100: 未引用的形参'),
    'stdout:\nmain.cpp\nmain.cpp(10): warning C4100: 未引用的形参'
  );
  assert.equal(
    formatSuccessCompileChannel('stderr', 'fatal error C1083: 无法打开包括文件'),
    'stderr:\nfatal error C1083: 无法打开包括文件'
  );
  assert.equal(
    formatSuccessCompileChannel('link stdout', 'main.obj : 警告 LNK4042: 对象指定的类型不匹配'),
    'link stdout:\nmain.obj : 警告 LNK4042: 对象指定的类型不匹配'
  );
});
