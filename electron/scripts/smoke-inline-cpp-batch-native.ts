import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_LIBRARY_COMMON_RUNTIME, generateStandardLibraryRuntime } from '../src/services/windowDesigner/standardLibraryRuntime';
import { generateSystemLibraryRuntime } from '../src/services/windowDesigner/systemLibraryRuntime';
import { TEXT_CODECS_RUNTIME } from '../src/services/windowDesigner/textCodecsRuntime';
import { generateProtobufRuntime } from '../src/services/windowDesigner/protobufRuntime';
import { generateCryptoRuntime } from '../src/services/windowDesigner/cryptoRuntime';
import { generatePlatformAdvancedRuntime } from '../src/services/windowDesigner/platformAdvancedRuntime';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';

/**
 * 内嵌 C++ 清零批次（批①③④⑦，2026-09-27）原生验收：
 * ① 编译级：把位运算族 / RAW 编码 / 无 schema protobuf wire / 哈希字节集族 / 进程内存_写字节集
 *    的运行时整包用 MSVC /c 编译（不链接，不需要 botan/libprotobuf SDK），验证生成 C++ 语法；
 * ② 行为级：链接并运行不含第三方 SDK 依赖的探针（位运算 64 位补码位模式、移位取模、
 *    RAW 按码点低 8 位截断/还原、PB varint/文本/固定32 拼装与回读、截断数据容错、
 *    文本树/字段信息JSON/导出草稿、设置鼠标位置、进程内存_写字节集 负样本容错）。
 * 用法：cd electron && npx tsx scripts/smoke-inline-cpp-batch-native.ts
 */
const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const buildDir = path.resolve(repoRoot, '.lingbuilder-build', 'inline-cpp-batch-smoke');

function installedModule(moduleId: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
  if (!manifest) throw new Error(`缺少内置模块：${moduleId}`);
  return { manifest, installPath: `builtin://${moduleId}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

const PROBE_MODULE_IDS = [
  'lingbuilder.std.math',
  'lingbuilder.std.bytes',
  'lingbuilder.std.encoding',
  'lingbuilder.std.buffer',
  'lingbuilder.advanced.process-memory'
];

const FULL_COMPILE_MODULE_IDS = [
  ...PROBE_MODULE_IDS,
  'lingbuilder.std.text',
  'lingbuilder.std.array',
  'lingbuilder.std.buffer',
  'lingbuilder.std.datetime',
  'lingbuilder.crypto.hash'
];

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

function commonPrelude(): string {
  // LingCppWideToUtf8/LingCppUtf8ToWide 在真实工程里由生成器主模板（lingCppWin32Project.ts）提供，
  // 且位于 protobuf/crypto 运行时之前；本探针绕过生成器拼装，必须自带同款定义。
  return `#include <windows.h>
#include <shlwapi.h>
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
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
#pragma comment(lib, "advapi32.lib")

static std::string LingCppWideToUtf8(const std::wstring& value) {
    if (value.empty()) return {};
    int length = WideCharToMultiByte(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
    std::string result(static_cast<size_t>((std::max)(0, length)), '\\0');
    if (length > 0) WideCharToMultiByte(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()), result.data(), length, nullptr, nullptr);
    return result;
}

static std::wstring LingCppUtf8ToWide(const char* value) {
    if (!value || !value[0]) return {};
    int length = MultiByteToWideChar(CP_UTF8, 0, value, -1, nullptr, 0);
    std::wstring result(static_cast<size_t>((std::max)(0, length)), L'\\0');
    if (length > 1) MultiByteToWideChar(CP_UTF8, 0, value, -1, result.data(), length);
    return result;
}
`;
}

async function runMsvc(visualStudioInstallation: string, scriptName: string, lines: string[]): Promise<void> {
  const vcvars = path.join(visualStudioInstallation, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
  const script = ['@echo off', `call "${vcvars}" >nul`, ...lines, 'if errorlevel 1 exit /b 1'].join('\r\n');
  const scriptPath = path.join(buildDir, scriptName);
  const logPath = path.join(buildDir, `${scriptName}.log`);
  await fs.writeFile(scriptPath, script, 'utf8');
  // 本机 shell 常开 CL=/bigobj（C1128 约定），MSYS 传给子进程时会被路径改写成
  // "C:/Program Files/Git/bigobj" 污染 cl 命令行；探针单文件用不到，剥掉。
  const env = { ...process.env };
  delete env.CL;
  delete env._CL_;
  try {
    await execFileAsync('cmd.exe', ['/d', '/c', scriptPath], { windowsHide: true, timeout: 5 * 60 * 1000, env });
  } catch (error) {
    const log = await fs.readFile(logPath, 'utf8').catch(() => '');
    throw new Error(`MSVC 步骤失败：${scriptName}\n${log.split('\n').slice(-40).join('\n')}`);
  }
}

async function main(): Promise<void> {
  await fs.mkdir(buildDir, { recursive: true });
  const visualStudioInstallation = await findVisualStudioInstallation();

  // ===== ① 编译级：全量运行时（含哈希字节集/protobuf wire/进程内存写）MSVC /c 编译 =====
  const fullRuntime = [
    BUILTIN_LIBRARY_COMMON_RUNTIME,
    TEXT_CODECS_RUNTIME,
    generateStandardLibraryRuntime(FULL_COMPILE_MODULE_IDS.map(installedModule)),
    generateSystemLibraryRuntime([installedModule('lingbuilder.fs.core')]),
    generateProtobufRuntime([{ manifest: { id: 'lingbuilder.data.protobuf' } } as never]),
    generateCryptoRuntime(new Set(['lingbuilder.crypto.hash'])),
    generatePlatformAdvancedRuntime([
      installedModule('lingbuilder.advanced.process-memory'),
      installedModule('lingbuilder.advanced.assembly')
    ])
  ].join('\n');
  const fullSource = `${commonPrelude()}${fullRuntime}\nint LB_UNUSED_ANCHOR() { return 0; }\n`;
  const fullSourcePath = path.join(buildDir, 'full-runtime.cpp');
  await fs.writeFile(fullSourcePath, fullSource, 'utf8');
  // 哈希运行时 #include <botan/ffi.h> 等：用仓库内随模块供应的 crypto SDK 头（只编译不链接）。
  const cryptoSdkInclude = path.resolve(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.crypto.sdk', 'sdk', 'include');
  await fs.access(cryptoSdkInclude);
  await runMsvc(visualStudioInstallation, 'compile-full.cmd', [
    `cl /nologo /utf-8 /std:c++17 /EHsc /W3 /c /I"${cryptoSdkInclude}" /Fo:"${path.join(buildDir, 'full-runtime.obj')}" "${fullSourcePath}" > "${path.join(buildDir, 'compile-full.cmd.log')}" 2>&1`
  ]);
  console.log('PASS ① 全量运行时 MSVC /c 编译（位运算/RAW/PB wire/哈希字节集/进程内存_写字节集）');

  // ===== ② 行为级：无 SDK 依赖探针 =====
  const probeRuntime = [
    BUILTIN_LIBRARY_COMMON_RUNTIME,
    TEXT_CODECS_RUNTIME,
    generateStandardLibraryRuntime(PROBE_MODULE_IDS.map(installedModule)),
    generateProtobufRuntime([{ manifest: { id: 'lingbuilder.data.protobuf' } } as never]),
    generateCryptoRuntime(new Set(['lingbuilder.crypto.hash'])),
    generatePlatformAdvancedRuntime([installedModule('lingbuilder.advanced.process-memory')])
  ].join('\n');
  const probe = `${commonPrelude()}${probeRuntime}

static int 断言(bool condition, int code) { return condition ? 0 : code; }

// 取鼠标*位置/设置鼠标位置 的运行时定义在生成器主模板（双后端各一份）；
// 探针内嵌与 lingCppWin32Project.ts 逐字相同的定义做真机编译与行为验证，
// 生成产物侧由 tests/inlineCpp.test.ts 钉住生成 main.cpp 必须含同名定义。
static int 取鼠标水平位置() { POINT point = {}; return GetCursorPos(&point) ? point.x : 0; }
static int 取鼠标垂直位置() { POINT point = {}; return GetCursorPos(&point) ? point.y : 0; }
static bool 设置鼠标位置(int x, int y) { return SetCursorPos(x, y) != 0; }

int main() {
    // 位运算族：64 位补码位模式，移位对 64 取模，逻辑/算术右移分野。
    if (int code = 断言(位_与(12, 10) == 8, 1)) return code;
    if (int code = 断言(位_或(12, 10) == 14, 2)) return code;
    if (int code = 断言(位_异或(240, 15) == 255, 3)) return code;
    if (int code = 断言(位_取反(0) == -1, 4)) return code;
    if (int code = 断言(位_右移(-1, 1) == 9223372036854775807LL, 5)) return code;
    if (int code = 断言(位_算术右移(-1, 1) == -1, 6)) return code;
    if (int code = 断言(位_左移(1, 63) == (static_cast<long long>(1ULL << 63)), 7)) return code;
    if (int code = 断言(位_左移(1, 64) == 1, 8)) return code;          // 位数对 64 取模
    if (int code = 断言(位_右移(-1, 64) == -1, 9)) return code;
    if (int code = 断言(位_循环左移32(1, 1) == 2, 10)) return code;
    if (int code = 断言(位_循环左移32(static_cast<long long>(2147483648LL), 1) == 1, 11)) return code;
    if (int code = 断言(位_循环左移32(0x12345678LL, 0) == 0x12345678, 12)) return code;
    if (int code = 断言(位_循环左移32(0x12345678LL, 33) == 位_循环左移32(0x12345678LL, 1), 13)) return code;
    if (int code = 断言(位_取字节(-1, 7) == 255 && 位_取字节(0x1234, 1) == 0x12 && 位_取字节(0x1234, 9) == 0x12, 14)) return code;
    if (int code = 断言(位_测试(5, 2) && !位_测试(5, 1), 15)) return code;

    // RAW 编码：按码点低 8 位截断/还原，不查代码页；LATIN1 别名同语义。
    const std::vector<unsigned char> raw = 编码_文本转字节集(L"AB中", L"RAW");
    if (int code = 断言(raw.size() == 3 && raw[0] == 0x41 && raw[1] == 0x42 && raw[2] == 0x2D, 20)) return code;
    // RAW 的正确不变量：解码把每字节映射为等值码点（"AB中" 截断后解出 L"AB-"，不是原字符串），
    // 再编码必须还原同一字节序列（对字节空间无损）。
    const std::wstring 还原文本(编码_字节集转文本(raw, L"RAW"));
    if (还原文本.size() != 3 || 还原文本[0] != L'A' || 还原文本[1] != L'B' || 还原文本[2] != 0x2D) return 121;
    const std::vector<unsigned char> 还原字节 = 编码_文本转字节集(还原文本.c_str(), L"RAW");
    if (还原字节 != raw) return 122;
    const std::vector<unsigned char> rawAlias = 编码_文本转字节集(L"AB中", L"LATIN1");
    if (int code = 断言(rawAlias.size() == 3 && rawAlias[2] == 0x2D, 22)) return code;
    const std::vector<unsigned char> rawCn = 编码_文本转字节集(L"中文", L"RAW");
    if (int code = 断言(rawCn.size() == 2 && rawCn[0] == 0x2D && rawCn[1] == 0x87, 23)) return code;

    // 无 schema protobuf：varint（含负数 10 字节补码）/文本/固定32 拼装与回读。
    std::vector<unsigned char> 消息 = PB_写字段_varint(std::vector<unsigned char>(), 1, 150);
    if (int code = 断言(消息.size() == 3 && 消息[0] == 0x08 && 消息[1] == 0x96 && 消息[2] == 0x01, 30)) return code;
    消息 = PB_写字段_文本(消息, 2, L"abc");
    if (int code = 断言(消息.size() == 8 && 消息[3] == 0x12 && 消息[4] == 0x03, 31)) return code;
    if (int code = 断言(PB_取字段_varint(消息, 1) == 150, 32)) return code;
    {
        const std::vector<unsigned char> 载荷 = PB_取字段_字节集(消息, 2);
        if (int code = 断言(载荷.size() == 3 && 载荷[0] == 'a' && 载荷[1] == 'b' && 载荷[2] == 'c', 33)) return code;
    }
    const std::vector<unsigned char> 负数 = PB_写字段_varint(std::vector<unsigned char>(), 1, -1);
    if (int code = 断言(负数.size() == 11 && 负数[0] == 0x08 && 负数[10] == 0x01, 34)) return code;
    const std::vector<unsigned char> 固定32 = PB_写字段_固定32(std::vector<unsigned char>(), 3, 0x01020304);
    if (int code = 断言(固定32.size() == 5 && 固定32[0] == 0x1D && 固定32[1] == 0x04 && 固定32[4] == 0x01, 35)) return code;
    if (int code = 断言(PB_取字段_varint(固定32, 3) == 0x01020304, 36)) return code;
    // 截断数据：回读给 0 + 中文错误，文本树标 [非法]，不崩溃。
    const std::vector<unsigned char> 截断 = { 0x08 };
    if (int code = 断言(PB_取字段_varint(截断, 1) == 0 && std::wstring(PB_取最后错误()).find(L"截断") != std::wstring::npos, 37)) return code;
    if (int code = 断言(std::wstring(PB_字节集转文本树(截断, 2)).rfind(L"[非法]", 0) == 0, 38)) return code;
    const std::wstring 树 = PB_字节集转文本树(消息, 2);
    if (int code = 断言(树.find(L"字段1(wire0): 150") != std::wstring::npos && 树.find(L"字段2(wire2)") != std::wstring::npos && 树.find(L"abc") != std::wstring::npos, 39)) return code;
    const std::wstring 信息 = PB_字段信息JSON(消息);
    if (int code = 断言(信息.find(L"\\\"字段号\\\":1") != std::wstring::npos && 信息.find(L"\\\"varint\\\":150") != std::wstring::npos, 40)) return code;
    const std::wstring 草稿 = PB_导出Proto草稿(消息);
    if (int code = 断言(草稿.find(L"int64 f1 = 1;") != std::wstring::npos && 草稿.find(L"bytes f2 = 2;") != std::wstring::npos, 41)) return code;
    if (int code = 断言(PB_写字段_varint(std::vector<unsigned char>(), 0, 1).empty() && std::wstring(PB_取最后错误()).find(L"字段号") != std::wstring::npos, 42)) return code;

    // 设置鼠标位置：就地回设当前坐标必须成功（三函数定义在 main 之前，逐字同 lingCppWin32Project.ts）。
    if (int code = 断言(设置鼠标位置(取鼠标水平位置(), 取鼠标垂直位置()), 50)) return code;

    // 哈希字节集族：与文本形态逐字一致（同一字节序列两种入口必须同摘要）。
    if (int code = 断言(std::wstring(哈希_SM3字节集(std::vector<unsigned char>{ 'L', 'i', 'n', 'g' })) == std::wstring(哈希_SM3文本(L"Ling")), 53)) return code;
    if (int code = 断言(std::wstring(哈希_MD5字节集(std::vector<unsigned char>{ 'L', 'i', 'n', 'g' })) == std::wstring(哈希_MD5文本(L"Ling")), 54)) return code;
    if (int code = 断言(std::wstring(哈希_SM3字节集(std::vector<unsigned char>{ 0x00, 0xFF })).size() == 64, 55)) return code;

    // 进程内存_写字节集 负样本：句柄 0 不执行任何写入，给中文错误。
    if (int code = 断言(!进程内存_写字节集(0, 100, std::vector<unsigned char>{ 1, 2 }), 51)) return code;
    if (int code = 断言(std::wstring(进程内存_取错误()).find(L"句柄无效") != std::wstring::npos, 52)) return code;
    return 0;
}
`;
  const probePath = path.join(buildDir, 'probe.cpp');
  await fs.writeFile(probePath, probe, 'utf8');
  const executablePath = path.join(buildDir, 'probe.exe');
  // 哈希运行时链接 botan-3.lib / blake3：用仓库内随模块供应的 crypto SDK。
  const cryptoSdkRoot = path.resolve(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.crypto.sdk', 'sdk');
  const cryptoSdkLib = path.join(cryptoSdkRoot, 'lib', 'x64');
  const blake3Source = path.join(cryptoSdkRoot, 'src', 'blake3_amalgamation.c');
  await fs.access(path.join(cryptoSdkLib, 'botan-3.lib'));
  await fs.access(blake3Source);
  await runMsvc(visualStudioInstallation, 'run-probe.cmd', [
    // botan-3.dll 必须与 exe 同目录（真实工程由构建管线复制到 bin）。
    `copy /y "${path.join(cryptoSdkRoot, 'bin', 'x64', 'botan-3.dll')}" "${path.join(buildDir, 'botan-3.dll')}" >nul`,
    `cl /nologo /utf-8 /std:c++17 /EHsc /W3 /I"${cryptoSdkRoot}\\include" /Fe:"${executablePath}" "${probePath}" "${blake3Source}" /link /LIBPATH:"${cryptoSdkLib}" botan-3.lib user32.lib bcrypt.lib > "${path.join(buildDir, 'run-probe.cmd.log')}" 2>&1`,
    `if errorlevel 1 exit /b 1`,
    `"${executablePath}"`,
    'exit /b %errorlevel%'
  ]);
  console.log('PASS ② 行为探针全过（位运算语义/RAW 往返/PB 拼装回读与容错/设置鼠标位置/SM3·MD5 字节集一致性/进程内存_写字节集 容错）');
  console.log('SMOKE ALL PASS');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
