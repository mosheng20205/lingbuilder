/**
 * 真机验证：第三方「纯头文件 C++ 库」（炫语言/易语言生态典型形态）能否被 LingBuilder
 * C++源码库管线直接为己用。三场景：
 *   A. GBK 编码头文件（生态分发常态）→ 期望物化期中文阻断（防线有效性）。
 *   B. 同一份头文件转 UTF-8（中文注释/中文成员名/中文字面量齐全）→ 完整链
 *      生成 → 物化 → VS 导出 → MSBuild(Win32+x64) → 运行 exe → 断言中文往返。
 *   C. 头文件里 C++ 符号名本身是中文（= 中文求和）→ 期望声明期诊断阻断（能力边界）。
 * 运行：cd electron && npx tsx scripts/tmp-verify-thirdparty-header.ts
 */
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
import { createProjectCppSourceDeclarationModule, getProjectCppSourceLibraryDiagnostics } from '../src/services/lingCpp/projectCppSourceLibraryService';
import { materializeProjectCppSourceLibraries } from '../src/services/modules/projectCppSourceMaterializeService';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const baseDir = path.resolve(repoRoot, '.lingbuilder-build', 'tmp-thirdparty-header-verify');
const gbkDir = path.resolve(repoRoot, '.lingbuilder-build', 'tmp-thirdparty-header-verify-gbk');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function rmWithRetry(dir: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// 第三方头文件样本：模拟炫语言生态「呵呵仙」式纯头文件模块——
// ASCII 对外符号（SmartArray/ArraySum），内部全中文（注释/成员名/参数名/字面量）。
const THIRD_PARTY_H = [
  '#pragma once',
  '#include <windows.h>',
  '#include <vector>',
  '#include <string>',
  '',
  '// 第三方头文件样本：模拟炫语言生态模块的典型形态（中文注释、中文成员名、内联实现）。',
  'class SmartArray {',
  'public:',
  '    SmartArray() {}',
  '    ~SmartArray() {}',
  '    void Add(const wchar_t* 文本) { 成员列表.push_back(文本 ? 文本 : L""); }',
  '    int Count() const { return static_cast<int>(成员列表.size()); }',
  '    const wchar_t* ItemAt(int 序号) const {',
  '        if (序号 < 1 || 序号 > static_cast<int>(成员列表.size())) return L"";',
  '        return 成员列表[static_cast<size_t>(序号) - 1].c_str();',
  '    }',
  'private:',
  '    std::vector<std::wstring> 成员列表;',
  '};',
  '',
  '// 中文参数名的内联自由函数：验证 /utf-8 下第三方头文件里的中文标识符可编译。',
  'inline int ArraySum(int 左数, int 右数) {',
  '    return 左数 + 右数;',
  '}'
].join('\r\n');

const DECLARATION = [
  '包 项目C++源码库',
  '',
  'C++源码库 第三方数组库',
  '  头文件 = cpp/thirdparty.h',
  '  类 智能数组 = SmartArray',
  '    方法 智能数组 创建()',
  '    方法 空 销毁()',
  '    方法 空 加入(文本型 内容) = Add',
  '    方法 整数型 取数量() = Count',
  '    方法 文本型 取项(整数型 序号) = ItemAt',
  '  结束类',
  '结束C++源码库',
  '',
  '// 纯头文件的自由函数要声明成命令，当前管线要求库带「源码 =」：挂一行 shim .cpp（能力边界实锤）。',
  'C++源码库 第三方函数库',
  '  源码 = cpp/thirdparty_shim.cpp',
  '  头文件 = cpp/thirdparty.h',
  '  整数型 数组相加(整数型 左数, 整数型 右数) = ArraySum',
  '结束C++源码库'
].join('\n');

const THIRD_PARTY_SHIM_CPP = [
  '#include "thirdparty.h"',
  '',
  '// shim：头文件库的函数命令需要库声明「源码 =」，本翻译单元只负责 include 第三方头。',
  'const int thirdparty_shim_anchor = 0;'
].join('\r\n');

const DECLARATION_GBK = [
  '包 项目C++源码库',
  '',
  'C++源码库 GBK数组库',
  '  头文件 = cpp/thirdparty_gbk.h',
  '  整数型 数组相加(整数型 左数, 整数型 右数) = ArraySum',
  '结束C++源码库'
].join('\n');

const DECLARATION_CHINESE_SYMBOL = [
  '包 项目C++源码库',
  '',
  'C++源码库 中文符号库',
  '  头文件 = cpp/thirdparty.h',
  '  整数型 中文相加(整数型 左数, 整数型 右数) = 中文求和',
  '结束C++源码库'
].join('\n');

const MAIN_SOURCE = [
  '类 MainWindow',
  '    事件 _MainWindow_创建完毕()',
  '        局部 智能数组 表 = 0',
  '        局部 整数型 数量 = 0',
  '        局部 文本型 首项 = ""',
  '        局部 整数型 和值 = 0',
  '        表 = 智能数组_创建()',
  '        智能数组_加入(表, "中文项甲")',
  '        智能数组_加入(表, "中文项乙")',
  '        数量 = 智能数组_取数量(表)',
  '        首项 = 智能数组_取项(表, 1)',
  '        和值 = 数组相加(20, 22)',
  '        智能数组_销毁(表)',
  '        如果 (数量 != 2)',
  '            @ ExitProcess(3);',
  '        如果结束',
  '        如果 (首项 != "中文项甲")',
  '            @ ExitProcess(4);',
  '        如果结束',
  '        如果 (和值 != 42)',
  '            @ ExitProcess(5);',
  '        如果结束',
  '        @ std::ofstream report("thirdparty-header-verify.txt", std::ios::binary | std::ios::trunc); report << "OK " << 数量 << " " << (首项 == std::wstring(L"中文项甲") ? 1 : 0) << " " << 和值 << "\\n"; report.close();',
  '        @ ExitProcess(0);',
  '    结束',
  '结束类'
].join('\n');

async function toGbkFile(sourceFile: string, targetFile: string) {
  const candidates = [
    'iconv',
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Git', 'usr', 'bin', 'iconv.exe')
  ];
  let lastError: unknown = null;
  for (const iconv of candidates) {
    try {
      const { stdout } = await execFileAsync(iconv, ['-f', 'UTF-8', '-t', 'GBK', sourceFile], { windowsHide: true, encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 });
      await fs.writeFile(targetFile, stdout as unknown as Buffer);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`iconv 转码失败：${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function main() {
  const results: Record<string, any> = {};
  const enabledModules = [builtin('lingbuilder.win32.basic')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'thirdparty-header-verify',
    name: '第三方头文件真机验证',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '第三方头文件真机验证', width: 420, height: 240, background: '#202028', description: '验证第三方纯头文件 C++ 库接入', controls: [] }]
  };

  // ===== 场景 A：GBK 编码头文件 → 物化自动转码（v7），原文件不动 =====
  await rmWithRetry(gbkDir);
  await fs.mkdir(path.join(gbkDir, 'cpp'), { recursive: true });
  await fs.writeFile(path.join(gbkDir, 'cpp', 'thirdparty_gbk.utf8'), THIRD_PARTY_H, 'utf8');
  await toGbkFile(path.join(gbkDir, 'cpp', 'thirdparty_gbk.utf8'), path.join(gbkDir, 'cpp', 'thirdparty_gbk.h'));
  {
    const gbkBytes = await fs.readFile(path.join(gbkDir, 'cpp', 'thirdparty_gbk.h'));
    const utf8Probe = Buffer.from('中文', 'utf8');
    const isReallyGbk = gbkBytes.includes(utf8Probe) === false;
    const cppLibraries = parseLingCpp(DECLARATION_GBK).program.cppLibraries || [];
    const materialized = await materializeProjectCppSourceLibraries({
      cppLibraries,
      sourceRootAbsolute: gbkDir,
      buildDir: gbkDir,
      sourceDir: gbkDir,
      binDir: gbkDir,
      exportDir: gbkDir,
      logs: []
    });
    const targetHeader = await fs.readFile(path.join(gbkDir, 'modules', 'lingbuilder.project.cppsrc', 'sources', 'cpp', 'thirdparty_gbk.h'));
    const originalAfter = await fs.readFile(path.join(gbkDir, 'cpp', 'thirdparty_gbk.h'));
    results.scenarioA = {
      gbkEncoded: isReallyGbk,
      blocked: materialized.blocking.length > 0,
      transcodeNote: materialized.notes.some(text => text.includes('已自动按 GBK')),
      targetIsUtf8: targetHeader.includes(utf8Probe) && !targetHeader.includes(Buffer.from([0xd6, 0xd0, 0xce, 0xc4])),
      originalUnchanged: originalAfter.equals(gbkBytes)
    };
    if (!isReallyGbk || results.scenarioA.blocked || !results.scenarioA.transcodeNote || !results.scenarioA.targetIsUtf8 || !results.scenarioA.originalUnchanged) {
      throw new Error(`场景 A 失败：GBK 自动转码未按预期工作。${JSON.stringify(results.scenarioA)}`);
    }
    // 坏字节子场景：0xFF 非 UTF-8 亦非 GBK/GB18030 → 中文阻断。
    await fs.writeFile(path.join(gbkDir, 'cpp', 'bad_bytes.h'), Buffer.from([0x23, 0x41, 0xff, 0x42, 0x0a]));
    const badDeclaration = `${DECLARATION_GBK}\n\nC++源码库 坏字节库\n  头文件 = cpp/bad_bytes.h\n  整数型 坏探针(整数型 a) = bad_probe\n结束C++源码库`;
    const badMaterialized = await materializeProjectCppSourceLibraries({
      cppLibraries: parseLingCpp(badDeclaration).program.cppLibraries || [],
      sourceRootAbsolute: gbkDir,
      buildDir: gbkDir,
      sourceDir: gbkDir,
      binDir: gbkDir,
      exportDir: gbkDir,
      logs: []
    });
    results.scenarioBadBytes = {
      blocked: badMaterialized.blocking.length > 0,
      message: badMaterialized.blocking.find(text => text.includes('bad_bytes.h')) || null
    };
    if (!results.scenarioBadBytes.blocked || !results.scenarioBadBytes.message?.includes('无法自动转码')) {
      throw new Error(`坏字节子场景失败：未按预期阻断。${JSON.stringify(results.scenarioBadBytes)}`);
    }
  }

  // ===== 场景 B：GBK 头文件直接入 cpp/ → 物化自动转码后完整链构建 + 运行（v7 最强证明）=====
  await rmWithRetry(baseDir);
  await fs.mkdir(path.join(baseDir, 'cpp'), { recursive: true });
  await fs.writeFile(path.join(baseDir, 'cpp', 'thirdparty.utf8'), THIRD_PARTY_H, 'utf8');
  // 头文件以 GBK 字节落盘（生态分发常态）：全链构建运行 PASS = 转码在真实 MSVC 编译下成立。
  await toGbkFile(path.join(baseDir, 'cpp', 'thirdparty.utf8'), path.join(baseDir, 'cpp', 'thirdparty.h'));
  await fs.writeFile(path.join(baseDir, 'cpp', 'thirdparty_shim.cpp'), THIRD_PARTY_SHIM_CPP, 'utf8');
  await fs.mkdir(path.join(baseDir, 'resources'), { recursive: true });
  await fs.copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'), path.join(baseDir, 'resources', 'lingbuilder-app.ico'));

  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSourceCode: MAIN_SOURCE,
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    lingCppSources: [
      { filePath: 'src/MainWindow.lcpp', sourceCode: MAIN_SOURCE },
      { filePath: 'src/项目C++源码库.lcpp', sourceCode: DECLARATION }
    ]
  });
  if (generated.blockingDiagnostics.length) throw new Error(`生成前阻断：\n${generated.blockingDiagnostics.join('\n')}`);

  const cppLibraries = parseLingCpp(DECLARATION).program.cppLibraries || [];
  const virtualModule = createProjectCppSourceDeclarationModule(cppLibraries, project.id);
  if (!virtualModule) throw new Error('C++ 源码库虚拟模块未合成。');
  const materialized = await materializeProjectCppSourceLibraries({
    cppLibraries,
    sourceRootAbsolute: baseDir,
    buildDir: baseDir,
    sourceDir: baseDir,
    binDir: baseDir,
    exportDir: baseDir,
    logs: []
  });
  if (materialized.blocking.length) throw new Error(`源码库物化阻断：\n${materialized.blocking.join('\n')}`);
  if (!materialized.notes.some(text => text.includes('thirdparty.h') && text.includes('已自动按 GBK'))) {
    throw new Error(`场景 B 物化 notes 缺 GBK 转码说明：${materialized.notes.join(' / ')}`);
  }
  {
    const declarationHeader = await fs.readFile(path.join(baseDir, 'modules', 'lingbuilder.project.cppsrc', 'include', 'CppSourceLibraries.h'), 'utf8');
    if (!declarationHeader.includes('#include "../sources/cpp/thirdparty.h"')) throw new Error('声明头未 include 用户头文件（头文件库模式失效）。');
    const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
    if (!mainCpp.includes('new SmartArray(')) throw new Error('main.cpp 未发射 new SmartArray（类句柄流缺失）。');
  }
  for (const file of generated.files) {
    const target = path.resolve(baseDir, file.relativePath);
    if (!target.startsWith(`${baseDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const exported = await exportVisualStudioProject({
    projectDir: baseDir,
    projectId: project.id,
    generatedFiles: generated.files,
    enabledModules: [...enabledModules, virtualModule]
  });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  const platforms: string[] = [];
  for (const platform of ['Win32', 'x64']) {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: baseDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    platforms.push(platform);
  }
  const executable = path.join(baseDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  const run = await execFileAsync(executable, [], { cwd: path.dirname(executable), windowsHide: true, timeout: 3 * 60 * 1000, maxBuffer: 1024 * 1024 }).then(() => ({}), error => ({ error }));
  const reportPath = path.join(path.dirname(executable), 'thirdparty-header-verify.txt');
  const report = (await fs.readFile(reportPath, 'utf8').catch(() => '')).trim();
  if ('error' in run && report !== 'OK 2 1 42') throw new Error(`场景 B 运行失败（exit=${(run.error as { code?: number }).code}）：${report}`);
  if (report !== 'OK 2 1 42') throw new Error(`场景 B 断言失败：期望 "OK 2 1 42"，实际 "${report}"`);
  results.scenarioB = { platforms, report, executable };

  // ===== 场景 C：C++ 符号名本身是中文 → 期望声明期诊断 =====
  {
    const diagnostics = getProjectCppSourceLibraryDiagnostics(DECLARATION_CHINESE_SYMBOL);
    const errors = diagnostics.filter(item => item.level === 'error');
    results.scenarioC = {
      errorCount: errors.length,
      messages: diagnostics.map(item => item.message),
      rejected: diagnostics.some(item => item.message.includes('标识符'))
    };
    if (!results.scenarioC.rejected) throw new Error(`场景 C 失败：中文 C++ 符号名未被声明期拒绝。${JSON.stringify(results.scenarioC)}`);
  }

  console.log(JSON.stringify({ ok: true, ...results }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
