import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { parseLingCpp } from '../src/services/lingCpp/parser';
import { createProjectCppSourceDeclarationModule } from '../src/services/lingCpp/projectCppSourceLibraryService';
import { materializeProjectCppSourceLibraries } from '../src/services/modules/projectCppSourceMaterializeService';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'cpp-source-library-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

// 用户 C++ 源码（模拟「别人写好的函数」）：
//  数学库走「头文件 =」模式（声明以头文件为准），文本库走自动前置声明模式（期望签名）。
const USER_MATH_CPP = [
  '#include "mymath.h"',
  '#include "third_party/helper.h"',
  '',
  'int add(int a, int b) {',
  '    return a + b;',
  '}',
  '',
  'double average(double total, int count) {',
  '    // helper_bonus() 来自附加包含目录：能编译链接说明「包含目录 =」的复制副本被相对包含命中。',
  '    return count > 0 ? (total + helper_bonus() * 0) / count : 0.0;',
  '}'
].join('\r\n');

const USER_MATH_H = [
  '#pragma once',
  'int add(int a, int b);',
  'double average(double total, int count);'
].join('\r\n');

// 附加包含目录（v3）：cpp/third_party/helper.h 随「包含目录 =」整目录复制，
// mymath.cpp 用相对路径 #include "third_party/helper.h" 命中复制副本。
const USER_HELPER_H = [
  '#pragma once',
  '',
  'inline int helper_bonus() {',
  '    return 7;',
  '}'
].join('\r\n');

const USER_TEXT_CPP = [
  '#include <string>',
  '#include <vector>',
  '#include <algorithm>',
  '#include <functional>',
  '#include <stdexcept>',
  '',
  'const wchar_t* greet(const wchar_t* name) {',
  '    static std::wstring message;',
  '    message = std::wstring(L"你好，") + (name ? name : L"");',
  '    return message.c_str();',
  '}',
  '',
  'void accumulate(int* value, int delta) {',
  '    if (value) *value += delta;',
  '}',
  '',
  'std::vector<unsigned char> make_bytes() {',
  '    return { 0x41, 0x42, 0x43 };',
  '}',
  '',
  'std::vector<unsigned char> reverse_bytes(const std::vector<unsigned char>& data) {',
  '    return std::vector<unsigned char>(data.rbegin(), data.rend());',
  '}',
  '',
  'int check_bytes(const std::vector<unsigned char>& data) {',
  '    return (data.size() == 3 && data[0] == 0x43 && data[1] == 0x42 && data[2] == 0x41) ? 1 : 0;',
  '}',
  '',
  'void run_progress(int count, std::function<void(int, const wchar_t*)> callback) {',
  '    for (int i = 1; i <= count; ++i) {',
  '        callback(i, L"步");',
  '    }',
  '}',
  '',
  'std::vector<int> source_numbers() {',
  '    return { 1, 2, 3 };',
  '}',
  '',
  'std::vector<int> scale_values(const std::vector<int>& data, int factor) {',
  '    std::vector<int> output;',
  '    output.reserve(data.size());',
  '    for (int value : data) output.push_back(value * factor);',
  '    return output;',
  '}',
  '',
  'int check_scaled(const std::vector<int>& data) {',
  '    return (data.size() == 3 && data[0] == 3 && data[1] == 6 && data[2] == 9) ? 1 : 0;',
  '}',
  '',
  'int count_passing(int count, std::function<bool(int)> judge) {',
  '    int passed = 0;',
  '    for (int i = 1; i <= count; ++i) {',
  '        if (judge(i)) passed += 1;',
  '    }',
  '    return passed;',
  '}',
  '',
  'int risky(int mode) {',
  '    if (mode == 0) throw std::runtime_error("boom-v3");',
  '    return mode + 100;',
  '}',
  '',
  'namespace lbv4 {',
  '    int plus3(int a, int b, int c) {',
  '        return a + b + c;',
  '    }',
  '}'
].join('\r\n');

// 类定义（模拟别人写好的类）：方法全内联在头文件里，声明层只写「头文件 =」，不另写 counter.cpp。
const USER_COUNTER_H = [
  '#pragma once',
  '',
  'class Counter {',
  'public:',
  '    Counter(int initial) : value_(initial) {}',
  '    ~Counter() {}',
  '    int get_value() const { return value_; }',
  '    void add_value(int step) { value_ += step; }',
  'private:',
  '    int value_;',
  '};'
].join('\r\n');

const DECLARATION_SOURCE = [
  '包 项目C++源码库',
  '',
  'C++源码库 数学库',
  '  源码 = cpp/mymath.cpp',
  '  头文件 = cpp/mymath.h',
  '  包含目录 = cpp/third_party',
  '  整数型 加法计算(整数型 被加数, 整数型 加数) = add',
  '    备注: 计算两数之和',
  '  小数型 平均值(小数型 总和, 整数型 个数) = average',
  '结束C++源码库',
  '',
  'C++源码库 文本库',
  '  源码 = cpp/textlib.cpp',
  '  文本型 问候(文本型 名字) = greet',
  '  空 累计(整数型 当前值 传址, 整数型 增量) = accumulate',
  '  字节集 源字节() = make_bytes',
  '  字节集 倒序字节(字节集 数据) = reverse_bytes',
  '  整数型 校验字节(字节集 数据) = check_bytes',
  '  空 执行进度(整数型 次数, 处理器 进度回调(整数型 序号, 文本型 阶段)) = run_progress',
  '  整数型[] 源数组() = source_numbers',
  '  整数型[] 缩放数组(整数型[] 数据, 整数型 倍数) = scale_values',
  '  整数型 校验缩放(整数型[] 数据) = check_scaled',
  '  整数型 统计通过(整数型 次数, 处理器 判定(整数型 值) 回传 逻辑型) = count_passing',
  '结束C++源码库',
  '',
  'C++源码库 扩展库',
  '  源码 = cpp/textlib.cpp',
  '  命名空间 = lbv4',
  '  整数型 三数相加(整数型 a, 整数型 b, 整数型 c) = plus3',
  '结束C++源码库',
  '',
  'C++源码库 工具库',
  '  源码 = cpp/textlib.cpp',
  '  异常 = 捕获',
  '  整数型 危险操作(整数型 模式) = risky',
  '结束C++源码库',
  '',
  'C++源码库 计数器库',
  '  头文件 = cpp/counter.h',
  '  类 计数器 = Counter',
  '    方法 计数器 创建(整数型 初始值)',
  '    方法 空 销毁()',
  '    方法 整数型 取当前() = get_value',
  '    方法 空 累加(整数型 步长) = add_value',
  '  结束类',
  '结束C++源码库'
].join('\n');

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('C++ 源码库冒烟目录越出工作区。');
  const enabledModules = [builtin('lingbuilder.win32.basic')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'cpp-source-library-smoke',
    name: 'C++源码库原生冒烟测试',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'C++源码库原生冒烟测试', width: 420, height: 240, background: '#202028', description: '验证 源码级 C++ 函数映射（整数/文本/小数/传址/字节集）', controls: [] }]
  };
  // 五路检查全部在 创建完毕 内完成：任一不符按位退出，全对写 OK 报告并退出 0。
  // 字节集链路由三条源码库命令夹出：源字节() 产出 {0x41,0x42,0x43}，倒序字节() 在 C++ 侧反转，
  // 校验字节() 断言入参正好被倒过——参数与返回两个方向的 字节集 ABI 都被真实调用覆盖。
  const source = [
    '类 MainWindow',
    '    整数型 回调计数',
    '    事件 _MainWindow_创建完毕()',
    '        局部 整数型 和值 = 加法计算(123, 456)',
    '        如果 (和值 != 579)',
    '            @ ExitProcess(3);',
    '        如果结束',
    '        局部 小数型 均值 = 平均值(10.0, 4)',
    '        如果 (均值 != 2.5)',
    '            @ ExitProcess(4);',
    '        如果结束',
    '        局部 文本型 问候文本 = 问候("灵码")',
    '        如果 (问候文本 != "你好，灵码")',
    '            @ ExitProcess(5);',
    '        如果结束',
    '        局部 整数型 计数 = 40',
    '        累计(计数, 2)',
    '        如果 (计数 != 42)',
    '            @ ExitProcess(6);',
    '        如果结束',
    '        局部 字节集 原始 = 源字节()',
    '        局部 字节集 倒序 = 倒序字节(原始)',
    '        如果 (校验字节(倒序) != 1)',
    '            @ ExitProcess(7);',
    '        如果结束',
    '        回调计数 = 0',
    '        执行进度(5, &进度回调)',
    '        如果 (回调计数 != 5)',
    '            @ ExitProcess(8);',
    '        如果结束',
    '        局部 整数型 通过数 = 统计通过(5, &达标判定)',
    '        如果 (通过数 != 2)',
    '            @ ExitProcess(10);',
    '        如果结束',
    '        // 数组返回值就地消费（嵌套调用）：.lcpp 的「局部 整数型[] 名 = 命令()」数组局部声明',
    '        // 是既有语言边界（会降级为暂不支持注释），数组链路全程用嵌套调用穿起来。',
    '        如果 (校验缩放(缩放数组(源数组(), 3)) != 1)',
    '            @ ExitProcess(11);',
    '        如果结束',
    '        // 异常捕获：危险操作(0) 在 C++ 侧 throw，包装捕获后返回兜底 0，异常文本经 工具库_取错误() 读取。',
    '        局部 整数型 异常结果 = 危险操作(0)',
    '        如果 (异常结果 != 0)',
    '            @ ExitProcess(12);',
    '        如果结束',
    '        局部 文本型 异常文本 = 工具库_取错误()',
    '        如果 (异常文本 == "")',
    '            @ ExitProcess(13);',
    '        如果结束',
    '        局部 整数型 正常结果 = 危险操作(5)',
    '        如果 (正常结果 != 105)',
    '            @ ExitProcess(14);',
    '        如果结束',
    '        局部 整数型 三和 = 三数相加(1, 2, 3)',
    '        如果 (三和 != 6)',
    '            @ ExitProcess(15);',
    '        如果结束',
    '        // 类句柄流程必须「先声明（不带初始化）后按序赋值」：带初始化的局部声明会被提升到子程序最前，',
    '        // 取当前值 的初始化器会抢在 累加 之前求值（本 smoke 首跑实抓 exit=9，与 CEF3 句柄流同一陷阱）。',
    '        局部 长整数型 对象 = 0',
    '        局部 整数型 当前值 = 0',
    '        对象 = 计数器_创建(40)',
    '        计数器_累加(对象, 2)',
    '        当前值 = 计数器_取当前(对象)',
    '        计数器_销毁(对象)',
    '        如果 (当前值 != 42)',
    '            @ ExitProcess(9);',
    '        如果结束',
    '        @ std::ofstream report("cpp-source-library-smoke.txt", std::ios::binary | std::ios::trunc); report << "OK\\n"; report.close();',
    '        @ ExitProcess(0);',
    '    结束',
    '    空 进度回调(整数型 序号, 文本型 阶段)',
    '        回调计数 = 回调计数 + 1',
    '    结束',
    '    逻辑型 达标判定(整数型 值)',
    '        如果 (值 >= 4)',
    '            返回(真)',
    '        如果结束',
    '        返回(假)',
    '    结束',
    '结束类'
  ].join('\n');
  const declaration = DECLARATION_SOURCE;

  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSourceCode: source,
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    lingCppSources: [
      { filePath: 'src/MainWindow.lcpp', sourceCode: source },
      { filePath: 'src/项目C++源码库.lcpp', sourceCode: declaration }
    ]
  });
  if (generated.blockingDiagnostics.length) throw new Error(`生成前阻断：\n${generated.blockingDiagnostics.join('\n')}`);
  {
    // v2 发射钉子：回调 lambda（[this] 捕获成员子程序）与类句柄调用（new/delete/成员方法）必须真实出现在 main.cpp；
    // std::function 前置声明在物化的声明头里，物化后单独断言。
    const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
    if (!mainCpp.includes('[this](int p0, const wchar_t* p1) { return this->进度回调(p0, p1); }')) throw new Error('main.cpp 未发射 [this] 回调 lambda（v2 回调发射缺失）。');
    if (!mainCpp.includes('new Counter(')) throw new Error('main.cpp 未发射 new Counter（v2 类构造发射缺失）。');
    if (!mainCpp.includes('reinterpret_cast<Counter*>(')) throw new Error('main.cpp 未发射类指针强转（v2 类方法发射缺失）。');
    if (!mainCpp.includes('delete reinterpret_cast<Counter*>(')) throw new Error('main.cpp 未发射 delete（v2 类析构发射缺失）。');
  }

  // 与构建调度同序：物化源码库 → VS 导出（虚拟模块并入 → ClCompile 登记用户源码）。
  const cppLibraries = parseLingCpp(declaration).program.cppLibraries || [];
  const virtualModule = createProjectCppSourceDeclarationModule(cppLibraries, project.id);
  if (!virtualModule) throw new Error('C++ 源码库虚拟模块未合成。');
  // MSBuild FileTracker/节点会短时占用旧目录：EBUSY/ENOTEMPTY 重试几次再放行。
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rm(projectDir, { recursive: true, force: true });
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  await fs.mkdir(path.join(projectDir, 'cpp'), { recursive: true });
  await fs.writeFile(path.join(projectDir, 'cpp', 'mymath.cpp'), USER_MATH_CPP, 'utf8');
  await fs.writeFile(path.join(projectDir, 'cpp', 'mymath.h'), USER_MATH_H, 'utf8');
  await fs.writeFile(path.join(projectDir, 'cpp', 'textlib.cpp'), USER_TEXT_CPP, 'utf8');
  await fs.writeFile(path.join(projectDir, 'cpp', 'counter.h'), USER_COUNTER_H, 'utf8');
  // 附加包含目录（v3）：「包含目录 = cpp/third_party」整目录随物化复制。
  await fs.mkdir(path.join(projectDir, 'cpp', 'third_party'), { recursive: true });
  await fs.writeFile(path.join(projectDir, 'cpp', 'third_party', 'helper.h'), USER_HELPER_H, 'utf8');
  await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
  await fs.copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'), path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
  const materialized = await materializeProjectCppSourceLibraries({
    cppLibraries,
    sourceRootAbsolute: projectDir,
    buildDir: projectDir,
    sourceDir: projectDir,
    binDir: projectDir,
    exportDir: projectDir,
    logs: []
  });
  if (materialized.blocking.length) throw new Error(`源码库物化阻断：\n${materialized.blocking.join('\n')}`);
  {
    const declarationHeader = await fs.readFile(path.join(projectDir, 'modules', 'lingbuilder.project.cppsrc', 'include', 'CppSourceLibraries.h'), 'utf8');
    if (!declarationHeader.includes('std::function<void(int, const wchar_t*)>')) throw new Error('声明头未发射 std::function 期望签名（v2 回调声明缺失）。');
    // v3 发射钉子：std::function 非空返回、数组 vector 形参、异常包装与取错误运行时。
    if (!declarationHeader.includes('std::function<bool(int)>')) throw new Error('声明头未发射非空返回回调（v3 回传 缺失）。');
    if (!declarationHeader.includes('int count_passing(int p0, std::function<bool(int)> p1);')) throw new Error('声明头回调签名不正确（v3）。');
    if (!declarationHeader.includes('const std::vector<int>&')) throw new Error('声明头未发射数组 const 引用形参（v3 数组缺失）。');
    if (!declarationHeader.includes('std::vector<int> scale_values(')) throw new Error('声明头未发射数组按值返回（v3 数组返回缺失）。');
    if (!declarationHeader.includes('inline int LB_CppSrcWrap_4_risky(int p0) {')) throw new Error('声明头未发射异常包装（v3 异常捕获缺失）。');
    if (!declarationHeader.includes('inline std::wstring LB_CppSrcTakeError() {')) throw new Error('声明头未发射取错误运行时（v3）。');
    if (!declarationHeader.includes('namespace lbv4 {')) throw new Error('声明头未发射命名空间前置声明块（v4 缺失）。');
    if (!declarationHeader.includes('inline int 三数相加(int p0, int p1, int p2) { return lbv4::plus3(p0, p1, p2); }')) throw new Error('声明头未发射命名空间转发函数（v4 缺失）。');
    const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
    if (!mainCpp.includes('return this->达标判定(p0);')) throw new Error('main.cpp 回调 lambda 未转发返回值（v3 回传缺失）。');
    if (!mainCpp.includes('LB_CppSrcTakeError()')) throw new Error('main.cpp 未调用取错误命令（v3 异常捕获缺失）。');
    if (!mainCpp.includes('三数相加(1, 2, 3)')) throw new Error('main.cpp 未发射命名空间命令调用（v4 缺失）。');
  }
  if (materialized.sourceFiles.length !== 4) throw new Error(`源码库物化应登记 4 个编译源码（mymath/textlib/工具库共用 textlib），实际 ${materialized.sourceFiles.length}`);
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const exported = await exportVisualStudioProject({
    projectDir,
    projectId: project.id,
    generatedFiles: generated.files,
    enabledModules: [...enabledModules, virtualModule]
  });
  const vcxproj = await fs.readFile(exported.projectPath, 'utf8');
  if (!vcxproj.includes('modules\\lingbuilder.project.cppsrc\\sources\\cpp\\mymath.cpp')) {
    throw new Error('vcxproj 未登记用户源码 ClCompile 条目（虚拟模块 targets.sources 未被导出器消费）。');
  }
  if (!vcxproj.includes('modules\\lingbuilder.project.cppsrc\\include')) {
    throw new Error('vcxproj 未登记源码库包含目录。');
  }
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  for (const platform of ['Win32', 'x64']) {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  }
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  const run = await execFileAsync(executable, [], { cwd: path.dirname(executable), windowsHide: true, timeout: 3 * 60 * 1000, maxBuffer: 1024 * 1024 }).then(() => ({}), error => ({ error }));
  const reportPath = path.join(path.dirname(executable), 'cpp-source-library-smoke.txt');
  const report = await fs.readFile(reportPath, 'utf8').catch(() => '');
  if ('error' in run && report.trim() !== 'OK') throw new Error(`运行未正常退出（exit=${(run.error as { code?: number }).code}）：\n${report}`);
  if (report.trim() !== 'OK') throw new Error(`C++ 源码库原生冒烟失败：\n${report}`);
  console.log(JSON.stringify({
    ok: true,
    projectDir,
    executable,
    platforms: ['Win32', 'x64'],
    report: report.trim(),
    sourceFiles: materialized.sourceFiles.map(file => path.relative(projectDir, file))
  }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
