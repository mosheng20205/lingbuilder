import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { BUILTIN_LIBRARY_COMMON_RUNTIME, generateStandardLibraryRuntime } from '../src/services/windowDesigner/standardLibraryRuntime';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'array-native-smoke');
const ARRAY_MODULE_ID = 'lingbuilder.std.array';

/** `--runtime-only` 只编译并运行数组运行时行为验证，用于没有安装 vcxproj 平台工具集的机器。 */
const runtimeOnly = process.argv.includes('--runtime-only');

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('数组原生烟雾测试目录越出工作区。');
  }
  if (runtimeOnly) {
    await fs.mkdir(projectDir, { recursive: true });
    const runtimeExecutable = await compileAndRunRuntimeBehaviorSmoke(projectDir, await findVisualStudioInstallation());
    console.log(JSON.stringify({ ok: true, projectDir, runtimeExecutable }, null, 2));
    return;
  }

  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'array-native-smoke',
    name: '数组原生烟雾测试',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: '数组原生烟雾测试',
      width: 360,
      height: 180,
      background: '#202028',
      description: '验证数组运行时可由 Win32 导出工程使用 MSVC 编译',
      controls: []
    }]
  };
  const source = [
    '类 MainWindow : 公开 窗体',
    '    事件 创建完毕()',
    '        局部 文本型 名单[]',
    '        局部 整数型 编号[]',
    '        局部 文本型 当前项',
    '        数组_加入成员(名单, "张三")',
    '        数组_加入成员(名单, "李四")',
    '        数组_插入成员(名单, 0, "王五")',
    '        数组_置成员(名单, 2, "赵六")',
    '        数组_排序(名单, 真)',
    '        数组_倒序(名单)',
    '        数组_重定义(编号, 3)',
    '        数组_置成员(编号, 0, 7)',
    '        调试输出(数组_取成员数(名单), 数组_取成员(名单, 0), 数组_查找(名单, "赵六"))',
    '        调试输出(数组_是否包含(名单, "张三"), 数组_是否为空(编号), 数组_取成员(编号, 0))',
    '        枚举循环首 (名单, 当前项)',
    '            调试输出(当前项)',
    '        枚举循环尾 ()',
    '        数组_删除成员(名单, 0)',
    '        数组_清空(名单)',
    '    结束',
    '结束类'
  ].join('\n');
  const enabledModules: InstalledModule[] = ['lingbuilder.win32.basic', ARRAY_MODULE_ID].map(moduleId => {
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
  });
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: source,
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules
  });
  if (generated.blockingDiagnostics.length) {
    throw new Error(generated.blockingDiagnostics.join('\n'));
  }

  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const resourcesDir = path.join(projectDir, 'resources');
  await fs.mkdir(resourcesDir, { recursive: true });
  await fs.copyFile(
    path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'),
    path.join(resourcesDir, 'lingbuilder-app.ico')
  );
  const exported = await exportVisualStudioProject({
    projectDir,
    projectId: project.id,
    generatedFiles: generated.files,
    enabledModules
  });
  const installation = await findVisualStudioInstallation();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  await execFileAsync(msbuild, [
    exported.solutionPath,
    '/m',
    '/t:Build',
    '/p:Configuration=Release',
    '/p:Platform=x64',
    '/v:minimal'
  ], {
    cwd: projectDir,
    windowsHide: true,
    timeout: 10 * 60 * 1000,
    maxBuffer: 32 * 1024 * 1024
  });

  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  const runtimeExecutable = await compileAndRunRuntimeBehaviorSmoke(projectDir, installation);
  console.log(JSON.stringify({ ok: true, projectDir, executable, runtimeExecutable }, null, 2));
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

/** Compiles the array runtime on its own and asserts every documented boundary result. */
async function compileAndRunRuntimeBehaviorSmoke(buildDir: string, visualStudioInstallation: string): Promise<string> {
  const sourcePath = path.join(buildDir, 'array-runtime-behavior-smoke.cpp');
  const executable = path.join(buildDir, 'array-runtime-behavior-smoke.exe');
  const arrayModule: InstalledModule = {
    manifest: BUILTIN_MODULES.find(item => item.id === ARRAY_MODULE_ID)!,
    installPath: `builtin://${ARRAY_MODULE_ID}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const source = `#include <windows.h>
#include <algorithm>
#include <array>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>
${BUILTIN_LIBRARY_COMMON_RUNTIME}
${generateStandardLibraryRuntime([arrayModule])}

// 记录型不带比较运算：查找、包含和排序必须稳定返回失败值，而不是编译失败。
struct 用户 { int 编号; };

int main() {
  std::vector<std::wstring> 名单;
  if (数组_取成员数(名单) != 0 || !数组_是否为空(名单)) return 10;
  if (数组_加入成员(名单, L"张三") != 1) return 11;
  if (数组_加入成员(名单, L"李四") != 2) return 12;
  if (!数组_插入成员(名单, 0, L"王五") || 数组_取成员数(名单) != 3) return 13;
  if (数组_插入成员(名单, 9, L"越界")) return 14;
  if (!数组_插入成员(名单, 3, L"末尾") || 数组_取成员数(名单) != 4) return 15;
  if (std::wstring(数组_取成员(名单, 0)) != L"王五") return 16;
  if (std::wstring(数组_取成员(名单, 99)) != L"") return 17;
  if (!数组_置成员(名单, 0, L"赵六") || 数组_置成员(名单, 99, L"越界")) return 18;
  if (数组_查找(名单, L"李四") != 2 || 数组_查找(名单, L"不存在") != -1) return 19;
  if (!数组_是否包含(名单, L"末尾") || 数组_是否包含(名单, L"不存在")) return 20;
  if (!数组_排序(名单, true) || std::wstring(数组_取成员(名单, 0)) != L"张三") return 21;
  if (!数组_排序(名单, false) || std::wstring(数组_取成员(名单, 0)) != L"赵六") return 22;
  if (!数组_倒序(名单) || std::wstring(数组_取成员(名单, 0)) != L"张三") return 23;
  if (!数组_删除成员(名单, 0) || 数组_取成员数(名单) != 3) return 24;
  if (数组_删除成员(名单, 99)) return 25;
  if (!数组_清空(名单) || !数组_是否为空(名单)) return 26;

  std::vector<int> 编号;
  if (!数组_重定义(编号, 3) || 数组_取成员数(编号) != 3) return 30;
  if (数组_取成员(编号, 0) != 0 || 数组_取成员(编号, 2) != 0) return 31;
  if (数组_重定义(编号, -1)) return 32;
  if (!数组_置成员(编号, 1, 7) || 数组_取成员(编号, 1) != 7) return 33;
  if (!数组_重定义(编号, 1) || 数组_取成员数(编号) != 1) return 34;
  if (数组_取成员(编号, 0) != 0) return 35;

  std::vector<用户> 用户表;
  if (数组_加入成员(用户表, 用户{1}) != 1) return 40;
  if (数组_取成员数(用户表) != 1 || 数组_取成员(用户表, 0).编号 != 1) return 41;
  if (数组_查找(用户表, 用户{1}) != -1) return 42;
  if (数组_是否包含(用户表, 用户{1})) return 43;
  if (数组_排序(用户表, true)) return 44;
  if (!数组_倒序(用户表) || !数组_清空(用户表)) return 45;
  return 0;
}
`;
  await fs.writeFile(sourcePath, source, 'utf8');
  const vcvars = path.join(visualStudioInstallation, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
  await execFileAsync('cmd.exe', [
    '/d',
    '/c',
    `call "${vcvars}" >nul && cl /nologo /utf-8 /std:c++17 /EHsc /O2 "${sourcePath}" /Fe:"${executable}"`
  ], {
    cwd: buildDir,
    windowsHide: true,
    windowsVerbatimArguments: true,
    timeout: 2 * 60 * 1000,
    maxBuffer: 16 * 1024 * 1024
  });
  await execFileAsync(executable, [], {
    cwd: buildDir,
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 1024 * 1024
  });
  return executable;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
