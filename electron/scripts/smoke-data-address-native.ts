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
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'data-address-native-smoke');
const DATA_ADDRESS_MODULE_IDS = ['lingbuilder.std.bytes', 'lingbuilder.std.text'];

/** `--runtime-only` 只编译并运行运行时行为验证，用于没有安装 vcxproj 平台工具集的机器。 */
const runtimeOnly = process.argv.includes('--runtime-only');

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('取数据地址原生烟雾测试目录越出工作区。');
  }
  if (runtimeOnly) {
    await fs.mkdir(projectDir, { recursive: true });
    const runtimeExecutable = await compileAndRunRuntimeBehaviorSmoke(projectDir, await findVisualStudioInstallation());
    console.log(JSON.stringify({ ok: true, projectDir, runtimeExecutable }, null, 2));
    return;
  }

  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'data-address-native-smoke',
    name: '取数据地址原生烟雾测试',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: '取数据地址原生烟雾测试',
      width: 360,
      height: 180,
      background: '#202028',
      description: '验证 字节集_取数据地址/文本_取数据地址 由 MSVC 编译执行',
      controls: []
    }]
  };
  const source = [
    '类 MainWindow : 公开 窗体',
    '    事件 创建完毕()',
    '        局部 字节集 数据',
    '        局部 长整数型 数据地址',
    '        局部 文本型 缓冲文本',
    '        局部 长整数型 文本地址',
    '        数据 = 字节集_从文本("LB")',
    '        数据地址 = 字节集_取数据地址(数据)',
    '        缓冲文本 = "LingBuilder"',
    '        文本地址 = 文本_取数据地址(缓冲文本)',
    '        调试输出(数据地址 > 0, 文本地址 > 0, 字节集_取数据地址(字节集_截取(数据, 0, 0)) = 0)',
    '    结束',
    '结束类'
  ].join('\n');
  const enabledModules: InstalledModule[] = DATA_ADDRESS_MODULE_IDS.map(moduleId => {
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

/** 单独编译取数据地址运行时并断言全部文档化边界行为（往返读回、空字节集、空指针兜底）。 */
async function compileAndRunRuntimeBehaviorSmoke(buildDir: string, visualStudioInstallation: string): Promise<string> {
  const sourcePath = path.join(buildDir, 'data-address-runtime-behavior-smoke.cpp');
  const executable = path.join(buildDir, 'data-address-runtime-behavior-smoke.exe');
  const enabledModules: InstalledModule[] = DATA_ADDRESS_MODULE_IDS.map(moduleId => ({
    manifest: BUILTIN_MODULES.find(item => item.id === moduleId)!,
    installPath: `builtin://${moduleId}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  const source = `#include <windows.h>
#include <algorithm>
#include <array>
#include <cstdint>
#include <limits>
#include <sstream>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>
${BUILTIN_LIBRARY_COMMON_RUNTIME}
${generateStandardLibraryRuntime(enabledModules)}

int main() {
  // 字节集：非空返回数据首地址且经指针读回内容一致；空字节集返回 0。
  std::vector<unsigned char> 数据 = {0x4C, 0x42, 0x00, 0xFF};
  long long 数据地址 = 字节集_取数据地址(数据);
  if (数据地址 != reinterpret_cast<long long>(数据.data())) return 10;
  const unsigned char* 数据指针 = reinterpret_cast<const unsigned char*>(static_cast<uintptr_t>(数据地址));
  if (数据指针[0] != 0x4C || 数据指针[1] != 0x42 || 数据指针[3] != 0xFF) return 11;
  if (字节集_取数据地址(std::vector<unsigned char>()) != 0) return 12;

  // 文本：变量缓冲区地址读回内容一致；拼接结果在语句内地址有效；空指针兜底到 L""。
  std::wstring 缓冲文本 = L"LingBuilder";
  long long 文本地址 = 文本_取数据地址(缓冲文本.c_str());
  const wchar_t* 文本指针 = reinterpret_cast<const wchar_t*>(static_cast<uintptr_t>(文本地址));
  if (std::wstring(文本指针) != L"LingBuilder") return 20;
  if (文本_取数据地址(nullptr) == 0) return 21;
  if (文本_取数据地址((缓冲文本 + L"！").c_str()) == 0) return 22;
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
  process.exit(1);
});
