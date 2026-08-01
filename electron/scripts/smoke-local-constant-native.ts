import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'local-constant-native-smoke');

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('局部常量原生烟雾测试目录越出工作区。');
  }

  const sourcePath = 'src/MainWindow.lcpp';
  const source = [
    '类 MainWindow : 公开 窗体',
    '    整数型 取最大次数()',
    '        返回 7',
    '    结束',
    '    事件 创建完毕()',
    '        调试输出("before")',
    '        局部常量 整数型 最大次数 = 取最大次数()',
    '        局部常量 文本型 标题 = "ready"',
    '        调试输出(最大次数)',
    '    结束',
    '结束类'
  ].join('\n');
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'local-constant-native-smoke',
    name: '局部常量原生烟雾测试',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: '局部常量原生烟雾测试',
      width: 360,
      height: 180,
      background: '#202028',
      description: '验证运行时初始化一次、只读声明和源码顺序',
      controls: []
    }]
  };

  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: source,
    lingCppSourceFilePath: sourcePath
  });
  if (generated.blockingDiagnostics.length) {
    throw new Error(generated.blockingDiagnostics.join('\n'));
  }

  const generatedCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const integerDeclaration = extractDeclaration(generatedCpp, /^\s*int const 最大次数 = 取最大次数\(\);\s*$/mu, '整数型局部常量');
  const textDeclaration = extractDeclaration(generatedCpp, /^\s*std::wstring const 标题 = L"ready";\s*$/mu, '文本型局部常量');
  const beforeIndex = generatedCpp.indexOf('调试输出(L"before")');
  const declarationIndex = generatedCpp.indexOf(integerDeclaration);
  const useIndex = generatedCpp.indexOf('调试输出(最大次数)');
  if (beforeIndex < 0 || declarationIndex < 0 || useIndex < 0 || !(beforeIndex < declarationIndex && declarationIndex < useIndex)) {
    throw new Error('局部常量没有按 .lcpp 源码顺序生成。');
  }
  if (!generated.sourceMap.some(entry => (
    entry.kind === 'local'
    && entry.symbolName === '最大次数'
    && entry.sourceFile === sourcePath
    && entry.sourceStartLine === 7
  ))) {
    const localEntries = generated.sourceMap.filter(entry => entry.kind === 'local');
    throw new Error(`局部常量缺少可跳回声明行的 local source map：${JSON.stringify(localEntries)}`);
  }

  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  const smokeFiles = [{
    relativePath: 'local_constant_smoke.cpp',
    content: createStandaloneSmokeSource(integerDeclaration, textDeclaration)
  }];
  await fs.writeFile(path.join(projectDir, smokeFiles[0].relativePath), smokeFiles[0].content, 'utf8');

  const exported = await exportVisualStudioProject({
    projectDir,
    projectId: project.id,
    generatedFiles: smokeFiles,
    enabledModules: []
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
  const executableDir = path.dirname(executable);
  await fs.access(executable);
  await execFileAsync(executable, [], {
    cwd: executableDir,
    windowsHide: true,
    timeout: 2 * 60 * 1000,
    maxBuffer: 1024 * 1024
  });
  const reportLines = (await fs.readFile(path.join(executableDir, 'local-constant-native-smoke.txt'), 'utf8'))
    .trim()
    .split(/\r?\n/u);
  const report = reportLines[0] || '';
  const initializerCalls = Number(reportLines[1]);
  if (report !== 'OK' || initializerCalls !== 1) {
    throw new Error(`局部常量原生验证失败：${reportLines.join(' / ')}`);
  }

  console.log(JSON.stringify({ ok: true, projectDir, executable, report, initializerCalls }, null, 2));
}

function extractDeclaration(cpp: string, pattern: RegExp, label: string): string {
  const declaration = cpp.match(pattern)?.[0]?.trim();
  if (!declaration) throw new Error(`LingCpp 生成结果缺少${label}的 T const 声明。`);
  if (/constexpr/u.test(declaration)) throw new Error(`${label}错误使用了 constexpr。`);
  return declaration;
}

function createStandaloneSmokeSource(integerDeclaration: string, textDeclaration: string): string {
  return `#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <fstream>
#include <string>
#include <vector>

static int 初始化次数 = 0;

static int 取最大次数() {
  ++初始化次数;
  return 7;
}

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
  std::vector<int> 顺序;
  顺序.push_back(1);
  ${integerDeclaration}
  ${textDeclaration}
  顺序.push_back(2);
  const int 观察值 = 最大次数;
  顺序.push_back(3);

  const bool ok = 初始化次数 == 1
    && 最大次数 == 7
    && 观察值 == 7
    && 标题 == L"ready"
    && 顺序 == std::vector<int>{1, 2, 3};
  std::ofstream report("local-constant-native-smoke.txt", std::ios::binary);
  report << (ok ? "OK\\n" : "FAIL\\n") << 初始化次数 << "\\n";
  return ok ? 0 : 2;
}
`;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
