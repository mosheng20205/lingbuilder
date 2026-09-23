import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { BUILTIN_LIBRARY_COMMON_RUNTIME, generateStandardLibraryRuntime } from '../src/services/windowDesigner/standardLibraryRuntime';
import { generateSystemLibraryRuntime } from '../src/services/windowDesigner/systemLibraryRuntime';
import { TEXT_CODECS_RUNTIME } from '../src/services/windowDesigner/textCodecsRuntime';

/**
 * 「零内嵌 C++」能力批次原生验收：
 * ① 用 MSVC 真跑一次运行时行为探针（显示宽度/填充/居中/连接/分割/文件时间必须给出文档承诺的结果）；
 * ② 生成含全部验收写法的窗口项目并整体编译（到文本拼接、数组成员拼接、功能库返回值实参、
 *    多行编辑框换行、文本_分割 四参形态都必须真编译通过）。
 * 用法：cd electron && npx tsx scripts/smoke-zero-inline-cpp-native.ts
 */
const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const buildDir = path.resolve(repoRoot, '.lingbuilder-build', 'zero-inline-cpp-smoke');

const RUNTIME_MODULE_IDS = [
  'lingbuilder.win32.basic',
  'lingbuilder.std.text',
  'lingbuilder.std.array',
  'lingbuilder.fs.core',
  'lingbuilder.std.datetime'
];

function installedModule(moduleId: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
  if (!manifest) throw new Error(`缺少内置模块：${moduleId}`);
  return {
    manifest,
    installPath: `builtin://${moduleId}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
}

async function findVisualStudioInstallation(): Promise<string> {
  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  );
  const installation = (await execFileAsync(vswhere, [
    '-latest',
    '-products',
    '*',
    '-requires',
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property',
    'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  return installation;
}

async function compileAndRun(
  visualStudioInstallation: string,
  sourcePath: string,
  executablePath: string,
  logPath: string
): Promise<number> {
  const vcvars = path.join(visualStudioInstallation, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
  const script = [
    '@echo off',
    `call "${vcvars}" >nul`,
    `cl /nologo /utf-8 /std:c++17 /EHsc /W3 /Fe:"${executablePath}" "${sourcePath}" > "${logPath}" 2>&1`,
    `if errorlevel 1 exit /b 1`,
    `"${executablePath}"`,
    'exit /b %errorlevel%'
  ].join('\r\n');
  const scriptPath = path.join(buildDir, `run-${path.basename(sourcePath, '.cpp')}.cmd`);
  await fs.writeFile(scriptPath, script, 'utf8');
  try {
    const result = await execFileAsync('cmd.exe', ['/d', '/c', scriptPath], { windowsHide: true, timeout: 5 * 60 * 1000 });
    return 0;
  } catch (error) {
    const exitCode = (error as { code?: number }).code;
    const log = await fs.readFile(logPath, 'utf8').catch(() => '');
    throw new Error(`原生探针失败（退出码 ${exitCode}）\n${log.split('\n').slice(-40).join('\n')}`);
  }
}

async function runRuntimeBehaviorProbe(visualStudioInstallation: string): Promise<void> {
  const runtime = [
    BUILTIN_LIBRARY_COMMON_RUNTIME,
    TEXT_CODECS_RUNTIME,
    generateStandardLibraryRuntime(RUNTIME_MODULE_IDS.map(installedModule)),
    generateSystemLibraryRuntime([installedModule('lingbuilder.fs.core')])
  ].join('\n');
  const source = `#include <windows.h>
#include <shlwapi.h>
#include <algorithm>
#include <array>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <random>
#include <regex>
#include <sstream>
#include <string>
#include <thread>
#include <type_traits>
#include <unordered_map>
#include <utility>
#include <vector>
#pragma comment(lib, "shlwapi.lib")
${runtime}

static int 断言(bool condition, int code) { return condition ? 0 : code; }

int main() {
    const std::wstring 店名 = L"莫生网店";
    // 显示宽度：中日韩全角 2 列，ASCII 1 列，控制字符 0 列。
    if (int code = 断言(文本_取显示宽度(L"莫生网店") == 8, 1)) return code;
    if (int code = 断言(文本_取显示宽度(L"A店") == 3, 2)) return code;
    if (int code = 断言(文本_取显示宽度(L"abc") == 3, 3)) return code;
    if (int code = 断言(文本_取显示宽度(L"莫生网店", false) == 4, 4)) return code;
    if (int code = 断言(文本_取显示宽度(L"\\t") == 0, 5)) return code;

    // 定宽填充：目标宽度是显示列数，填充后宽度必须精确等于目标；已够宽时原样返回且不截断。
    if (int code = 断言(文本_取显示宽度(文本_填充右边(店名.c_str(), 12)) == 12, 10)) return code;
    if (int code = 断言(std::wstring(文本_填充右边(店名.c_str(), 12)) == L"莫生网店    ", 11)) return code;
    if (int code = 断言(std::wstring(文本_填充左边(L"999", 8)) == L"     999", 12)) return code;
    if (int code = 断言(std::wstring(文本_居中(L"标题", 12)) == L"    标题    ", 13)) return code;
    if (int code = 断言(std::wstring(文本_填充右边(L"超长文本不会截断", 4)) == L"超长文本不会截断", 14)) return code;
    if (int code = 断言(std::wstring(文本_填充右边(L"ab", 6, L"*")) == L"ab****", 15)) return code;

    // 中英文混排表格：三列各自补齐后，两行的显示列宽必须相等（这是排版对齐的硬判据）。
    const std::wstring 行一 = 文本_填充右边(L"莫生网店", 12) + std::wstring(文本_填充右边(L"423831013", 14)) + std::wstring(文本_填充左边(L"有效", 8));
    const std::wstring 行二 = 文本_填充右边(L"A店", 12) + std::wstring(文本_填充右边(L"999", 14)) + std::wstring(文本_填充左边(L"无效", 8));
    if (int code = 断言(文本_取显示宽度(行一.c_str()) == 34 && 文本_取显示宽度(行二.c_str()) == 34, 20)) return code;
    // 第三列必须从同一视觉列开始：两行前两列的显示宽度都等于 26 列。
    const std::wstring 行一前两列 = 文本_填充右边(L"莫生网店", 12) + std::wstring(文本_填充右边(L"423831013", 14));
    const std::wstring 行二前两列 = 文本_填充右边(L"A店", 12) + std::wstring(文本_填充右边(L"999", 14));
    if (int code = 断言(文本_取显示宽度(行一前两列.c_str()) == 26 && 文本_取显示宽度(行二前两列.c_str()) == 26, 21)) return code;

    // 文本_连接：join 是 文本_分割 的反向操作，区间与数量参数必须按文档生效。
    std::vector<std::wstring> 名单;
    名单.push_back(L"a"); 名单.push_back(L"b"); 名单.push_back(L"c");
    if (int code = 断言(std::wstring(文本_连接(名单, L",")) == L"a,b,c", 30)) return code;
    if (int code = 断言(std::wstring(文本_连接(名单, L",", 1, 1)) == L"b", 31)) return code;
    if (int code = 断言(std::wstring(文本_连接(名单, L"", 0, 0)) == L"abc", 32)) return code;
    std::vector<int> 编号; 编号.push_back(1); 编号.push_back(2);
    if (int code = 断言(std::wstring(文本_连接(编号, L"-")) == L"1-2", 33)) return code;
    std::vector<std::wstring> 空名单;
    if (int code = 断言(std::wstring(文本_连接(空名单, L",")) == L"", 34)) return code;

    // 文本_分割：默认保留尾空段（旧行为），传 真 只丢掉末尾连续空段，中间空段保留。
    std::vector<std::wstring> 分段;
    if (int code = 断言(文本_分割(L"a|b|", L"|", 分段) == 3 && 分段.size() == 3 && 分段[2].empty(), 40)) return code;
    if (int code = 断言(文本_分割(L"a|b|", L"|", 分段, true) == 2 && 分段[1] == L"b", 41)) return code;
    if (int code = 断言(文本_分割(L"a||b", L"|", 分段, true) == 3 && 分段[1].empty(), 42)) return code;
    if (int code = 断言(文本_分割(L"a|b||", L"|", 分段, true) == 2, 43)) return code;

    // 文件时间：与 std.datetime 的日期时间同一表示，能算间隔、能取年份；取最新文件挑出最新的那个。
    const std::wstring 目录 = std::filesystem::temp_directory_path().wstring() + L"lingbuilder-smoke-" + std::to_wstring(GetCurrentProcessId());
    std::filesystem::create_directories(目录);
    const std::wstring 旧文件 = 目录 + L"\\\\old.txt";
    const std::wstring 新文件 = 目录 + L"\\\\new.txt";
    { std::ofstream(旧文件) << "old"; std::ofstream(新文件) << "new"; }
    std::filesystem::last_write_time(旧文件, std::filesystem::file_time_type::clock::now() - std::chrono::hours(48));
    const long long 旧时间 = 文件_取修改时间(旧文件.c_str());
    const long long 新时间 = 文件_取修改时间(新文件.c_str());
    if (int code = 断言(旧时间 != 0 && 新时间 != 0, 50)) return code;
    SYSTEMTIME 本地; GetLocalTime(&本地);
    if (int code = 断言(时间_取年份(新时间) == 本地.wYear && 时间_取月份(新时间) == 本地.wMonth, 51)) return code;
    if (int code = 断言(时间_取间隔(新时间, 旧时间, 6) > 40, 52)) return code;
    if (int code = 断言(文件_取创建时间(新文件.c_str()) != 0 && 文件_取访问时间(新文件.c_str()) != 0, 53)) return code;
    std::vector<std::wstring> 命中;
    if (int code = 断言(文件_取最新文件(目录.c_str(), L"*.txt", 命中) == 1, 54)) return code;
    if (int code = 断言(命中.size() == 1 && std::wstring(命中[0]) == 新文件, 55)) return code;
    if (int code = 断言(std::wstring(文件_取错误()) == L"", 56)) return code;
    if (int code = 断言(文件_取修改时间(L"不存在的路径.txt") == 0, 57)) return code;
    const std::wstring 错误 = 文件_取错误();
    if (int code = 断言(错误.find(L"修改时间") != std::wstring::npos && 错误.find(L"不存在") != std::wstring::npos, 58)) return code;
    if (int code = 断言(文件_取最新文件(目录.c_str(), L"*.不存在", 命中) == 0 && std::wstring(文件_取错误()).find(L"没有匹配") != std::wstring::npos, 59)) return code;
    std::error_code 清理错误;
    std::filesystem::remove_all(目录, 清理错误);
    return 0;
}
`;
  const sourcePath = path.join(buildDir, 'runtime-behavior.cpp');
  await fs.writeFile(sourcePath, source, 'utf8');
  await compileAndRun(visualStudioInstallation, sourcePath, path.join(buildDir, 'runtime-behavior.exe'), path.join(buildDir, 'runtime-behavior.log'));
  console.log('运行时行为探针：全部断言通过（显示宽度/填充/居中/连接/分割/文件时间）。');
}

async function compileGeneratedAcceptanceProject(visualStudioInstallation: string): Promise<void> {
  const project: LingWindowProject = {
    id: 'zero-inline-cpp-smoke',
    name: '零内嵌 C++ 验收',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: '主窗体',
      title: '零内嵌 C++ 验收',
      width: 900,
      height: 620,
      background: '#1E1E24',
      description: '验收窗口',
      controls: [
        {
          id: 'edit-1', type: 'TextBox', name: '结果框', content: '', width: 320, height: 200, x: 24, y: 40,
          fontSize: 13, background: '#FFFFFF', foreground: '#000000', isEnabled: true, visibility: 'Visible',
          properties: { multiline: true }
        }
      ]
    }]
  };
  const librarySource = [
    '功能库 店铺弹窗',
    '公开:',
    '  文本型 用户代理串()',
    '    返回("Mozilla/5.0")',
    '  结束',
    '结束功能库',
    ''
  ].join('\n');
  const windowSource = [
    '类 主窗体 : 公开 窗体',
    '公开:',
    '    事件 创建完毕()',
    '        局部 整数型 个数 = 3',
    '        局部 文本型 显示',
    '        局部 文本型 名单[]',
    '        局部 整数型 段数',
    '        局部 日期时间 最新时间',
    '        数组_加入成员(名单, "甲")',
    '        数组_加入成员(名单, "乙")',
    '        显示 = "共 " + 到文本(个数) + " 条"',
    '        显示 = 到文本(个数) + 显示',
    '        显示 = 数组_取成员(名单, 0) + "  （" + 数组_取成员(名单, 1) + "）"',
    '        显示 = 文本_填充右边("莫生网店", 12) + 文本_填充左边(到文本(个数), 8)',
    '        显示 = 文本_连接(名单, ",") + 到文本(文本_取显示宽度(显示))',
    '        段数 = 文本_分割("a|b|", "|", 名单, 真)',
    '        文件_写入文本("smoke-out.txt", 店铺弹窗.用户代理串())',
    '        文件_写入文本("smoke-out.txt", (店铺弹窗.用户代理串()))',
    '        最新时间 = 文件_取修改时间("smoke-out.txt")',
    '        个数 = 文件_取最新文件(".", "*.txt", 名单)',
    '        控件_设置文本(结果框, "第一行\\n第二行" + 到文本(最新时间) + 到文本(段数))',
    '    结束',
    '结束类',
    ''
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: windowSource,
    lingCppSources: [
      { filePath: 'src/MainWindow.lcpp', sourceCode: windowSource },
      { filePath: 'src/店铺弹窗.lcpp', sourceCode: librarySource }
    ],
    enabledModules: [...RUNTIME_MODULE_IDS, 'lingbuilder.net.http-client'].map(installedModule)
  });
  if (generated.blockingDiagnostics.length) {
    throw new Error(generated.blockingDiagnostics.join('\n'));
  }
  const projectDir = path.join(buildDir, 'acceptance-project');
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp');
  if (!mainCpp) throw new Error('生成结果缺少 main.cpp');
  const mainPath = path.join(projectDir, 'main.cpp');
  await fs.writeFile(mainPath, mainCpp.content, 'utf8');
  const vcvars = path.join(visualStudioInstallation, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
  const script = [
    '@echo off',
    `call "${vcvars}" >nul`,
    `cl /nologo /utf-8 /std:c++17 /EHsc /DUNICODE /D_UNICODE /c "${mainPath}" /Fo:"${path.join(projectDir, 'main.obj')}" > "${path.join(projectDir, 'compile.log')}" 2>&1`,
    'exit /b %errorlevel%'
  ].join('\r\n');
  const scriptPath = path.join(projectDir, 'compile.cmd');
  await fs.writeFile(scriptPath, script, 'utf8');
  try {
    await execFileAsync('cmd.exe', ['/d', '/c', scriptPath], { windowsHide: true, timeout: 10 * 60 * 1000 });
  } catch (error) {
    const log = await fs.readFile(path.join(projectDir, 'compile.log'), 'utf8').catch(() => '');
    throw new Error(`验收项目整体编译失败（退出码 ${(error as { code?: number }).code}）\n${log.split('\n').filter(line => line.includes('error')).slice(0, 20).join('\n')}`);
  }
  const log = await fs.readFile(path.join(projectDir, 'compile.log'), 'utf8');
  if (log.includes('error C')) throw new Error(`验收项目编译日志出现 C 系列错误：\n${log.slice(0, 2000)}`);
  console.log('验收项目整体编译：MSVC 零错误通过（到文本拼接 / 数组成员拼接 / 功能库返回值实参 / 多行编辑框换行 / 文本_分割 四参）。');
}

async function main(): Promise<void> {
  await fs.mkdir(buildDir, { recursive: true });
  const installation = await findVisualStudioInstallation();
  await runRuntimeBehaviorProbe(installation);
  await compileGeneratedAcceptanceProject(installation);
  console.log(JSON.stringify({ ok: true, buildDir }, null, 2));
}

await main();
