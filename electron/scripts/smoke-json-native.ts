import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { JSON_MODULE_ID } from '../src/services/modules/jsonModule';
import type { InstalledModule } from '../src/services/modules/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { JSON_RUNTIME } from '../src/services/windowDesigner/jsonRuntime';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'json-native-smoke');

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('JSON 原生烟雾测试目录越出工作区。');
  }

  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'json-native-smoke',
    name: 'JSON 原生烟雾测试',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'JSON 原生烟雾测试',
      width: 360,
      height: 180,
      background: '#202028',
      description: '验证 JSON 运行时可由 Win32 导出工程使用 MSVC 编译',
      controls: []
    }]
  };
  const source = [
    '类 MainWindow : 公开 窗体',
    '    事件 创建完毕()',
    '        局部 文本型 JSON文本 = "{\\"name\\":\\"LingBuilder\\",\\"items\\":[1]}"',
    '        局部 文本型 规则 = "{\\"type\\":\\"object\\",\\"required\\":[\\"name\\",\\"edition\\"]}"',
    '        局部 JSON值 文档 = JSON_解析(JSON文本)',
    '        局部 JSON值 版本 = JSON_创建整数(2)',
    '        JSON_对象_设置(文档, "edition", 版本)',
    '        JSON_指针_设置(文档, "/metadata/channel", JSON_创建文本("stable"), 真)',
    '        JSON_应用补丁(文档, "[{\\"op\\":\\"add\\",\\"path\\":\\"/items/-\\",\\"value\\":3}]")',
    '        JSON_Schema验证(文档, 规则)',
    '        调试输出(JSON_序列化格式化(文档, 2))',
    '        JSON_释放(版本)',
    '        JSON_释放(文档)',
    '    结束',
    '结束类'
  ].join('\n');
  const enabledModules: InstalledModule[] = ['lingbuilder.win32.basic', JSON_MODULE_ID].map(moduleId => {
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

async function compileAndRunRuntimeBehaviorSmoke(buildDir: string, visualStudioInstallation: string): Promise<string> {
  const sourcePath = path.join(buildDir, 'json-runtime-behavior-smoke.cpp');
  const executable = path.join(buildDir, 'json-runtime-behavior-smoke.exe');
  const source = `#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <cwctype>
#include <iomanip>
#include <limits>
#include <locale>
#include <memory>
#include <mutex>
#include <regex>
#include <sstream>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

static std::wstring LB_Wide(const wchar_t* value) { return value ? std::wstring(value) : std::wstring(); }
static const wchar_t* LB_ReturnText(std::wstring value) {
  static thread_local std::wstring storage;
  storage = std::move(value);
  return storage.c_str();
}
static int LB_HexDigit(wchar_t value) {
  if (value >= L'0' && value <= L'9') return value - L'0';
  if (value >= L'a' && value <= L'f') return value - L'a' + 10;
  if (value >= L'A' && value <= L'F') return value - L'A' + 10;
  return -1;
}

${JSON_RUNTIME}

int main() {
  if (!JSON_是否有效(L"{\\"valid\\":true}") || JSON_是否有效(L"{]")) return 10;
  const long long document = JSON_解析(L"{\\"name\\":\\"LingBuilder\\",\\"items\\":[1]}");
  const long long edition = JSON_创建整数(2);
  const long long channel = JSON_创建文本(L"stable");
  if (!document || !edition || !channel) return 11;
  if (!JSON_对象_设置(document, L"edition", edition)) return 12;
  if (!JSON_指针_设置(document, L"/metadata/channel", channel, true)) return 13;
  if (!JSON_应用补丁(document, L"[{\\"op\\":\\"add\\",\\"path\\":\\"/items/-\\",\\"value\\":3},{\\"op\\":\\"replace\\",\\"path\\":\\"/edition\\",\\"value\\":3}]")) return 14;
  const long long items = JSON_指针_取(document, L"/items");
  const long long resolvedChannel = JSON_指针_取(document, L"/metadata/channel");
  if (!items || !resolvedChannel || JSON_数组_数量(items) != 2 || std::wstring(JSON_取文本值(resolvedChannel, L"")) != L"stable") return 15;
  if (!JSON_Schema验证(document, L"{\\"type\\":\\"object\\",\\"required\\":[\\"name\\",\\"edition\\"],\\"properties\\":{\\"items\\":{\\"type\\":\\"array\\",\\"minItems\\":2,\\"items\\":{\\"type\\":\\"integer\\"}}}}")) return 16;
  const long long copied = JSON_克隆(document);
  if (!copied || std::wstring(JSON_生成补丁(document, copied)) != L"[]") return 17;
  if (!JSON_合并补丁(copied, L"{\\"metadata\\":{\\"status\\":\\"ok\\"}}")) return 18;
  const std::wstring serialized = JSON_序列化格式化(copied, 2);
  if (serialized.find(L"\\"status\\": \\"ok\\"") == std::wstring::npos) return 19;
  if (!JSON_释放(items) || !JSON_释放(resolvedChannel) || !JSON_释放(copied) || !JSON_释放(channel) || !JSON_释放(edition) || !JSON_释放(document)) return 20;
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
