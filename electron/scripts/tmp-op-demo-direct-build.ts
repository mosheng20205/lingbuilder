// OP 演示工程直连构建：生成 C++ 工程 + MSVC x64 编译 + 语义/覆盖对账 + op DLL 物化。
// 用法：cd electron && npx tsx scripts/tmp-op-demo-direct-build.ts
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const demoRoot = path.join(repositoryRoot, 'AI 视频自主生产', '进阶方案', 'OP后台图色全能力演示');
const projectId = 'op-all-capabilities-demo';
const projectDir = path.join(demoRoot, '.lingbuilder-build', projectId, 'x64', 'Debug');

function resolveModule(moduleId: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
  if (manifest) {
    return {
      manifest,
      installPath: `builtin://${moduleId}`,
      isBuiltin: true,
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    };
  }
  throw new Error(`未找到内置模块 ${moduleId}`);
}

async function main() {
  const solution = JSON.parse(await fs.readFile(path.join(demoRoot, '.lingbuilder', 'solution.json'), 'utf8')) as {
    projects: Array<{ id: string; sourceRoot: string; designerPath: string }>;
  };
  const project = solution.projects.find(item => item.id === projectId);
  if (!project) throw new Error(`solution.json 缺少项目 ${projectId}`);

  const sourceRoot = path.join(demoRoot, project.sourceRoot);
  const lcppFiles: string[] = [];
  const collect = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) await collect(child);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lcpp')) lcppFiles.push(child);
    }
  };
  await collect(sourceRoot);

  const designerProject = JSON.parse(
    await fs.readFile(path.join(demoRoot, project.designerPath), 'utf8')
  ) as LingWindowProject;
  const moduleRefs = JSON.parse(
    await fs.readFile(path.join(demoRoot, '.lingbuilder', 'projects', projectId, 'project-modules.json'), 'utf8')
  ) as { enabledModuleIds?: string[] };
  const enabledModules = (moduleRefs.enabledModuleIds ?? []).map(resolveModule);

  const lingCppSources = [];
  for (const filePath of lcppFiles) {
    lingCppSources.push({
      filePath: path.relative(sourceRoot, filePath).replace(/\\/gu, '/'),
      sourceCode: await fs.readFile(filePath, 'utf8')
    });
  }

  // ---- 覆盖对账：214 条命令每条必须有 处理器 + 按钮（控件名不含下划线，与命令名去下划线后同名）----
  const mainWindow = lingCppSources.find(item => item.filePath === 'MainWindow.lcpp');
  if (!mainWindow) throw new Error('缺少 MainWindow.lcpp');
  const opManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.op');
  if (!opManifest) throw new Error('缺少 lingbuilder.op 清单');
  const missingHandlers: string[] = [];
  const missingButtons: string[] = [];
  const seenButtonNames = new Set<string>();
  for (const command of opManifest.contributes.commands) {
    const controlName = command.name.replace(/_/gu, '');
    if (!mainWindow.sourceCode.includes(`事件 _${controlName}_被单击()`)) missingHandlers.push(command.name);
    if (!designerProject.windows[0]?.controls.some(control => control.name === controlName)) missingButtons.push(command.name);
    if (seenButtonNames.has(controlName)) throw new Error(`按钮名去下划线后撞名：${controlName}`);
    seenButtonNames.add(controlName);
  }
  if (missingHandlers.length > 0 || missingButtons.length > 0) {
    throw new Error(`覆盖缺失 处理器=${missingHandlers.length} 按钮=${missingButtons.length}\n${missingHandlers.slice(0, 5).join(',')}`);
  }
  // 孤儿处理器对账：每个 事件 _X_被单击() 都必须有同名控件（防「处理器在、按钮没进设计器」复发）
  const controlNames = new Set(designerProject.windows[0]?.controls.map(control => control.name) ?? []);
  const orphanHandlers = [...mainWindow.sourceCode.matchAll(/事件 _([^_]+)_被单击\(\)/gu)]
    .map(match => match[1])
    .filter(name => !controlNames.has(name));
  if (orphanHandlers.length > 0) {
    throw new Error(`孤儿处理器（无对应控件）：${orphanHandlers.join(', ')}`);
  }
  console.log(`覆盖对账 ${opManifest.contributes.commands.length}/${opManifest.contributes.commands.length}，孤儿处理器 0`);

  const generated = generateLingCppNativeWin32Project(designerProject, {
    activeWindowId: designerProject.windows[0]?.id,
    lingCppSources,
    enabledModules
  });
  if (generated.blockingDiagnostics.length > 0) {
    throw new Error(`阻断诊断：\n${generated.blockingDiagnostics.join('\n')}`);
  }
  // 非法转义扫描：生成 C++ 中的宽字符串不允许出现 C5332 类非法序列（\o 等）。
  let badEscapes = 0;
  for (const file of generated.files) {
    if (!file.relativePath.endsWith('.cpp') && !file.relativePath.endsWith('.h')) continue;
    for (const match of file.content.matchAll(/L"((?:[^"\\]|\\.)*)"/gu)) {
      for (const esc of match[1].matchAll(/\\(.)/gu)) {
        if (!'\\\'"?abfnrtv01234567xuU'.includes(esc[1])) {
          badEscapes += 1;
          const at = esc.index ?? 0;
          console.log('非法转义', file.relativePath, JSON.stringify(match[1].slice(Math.max(0, at - 40), at + 10)));
        }
      }
    }
  }
  if (badEscapes > 0) throw new Error(`非法转义 ${badEscapes} 处`);
  console.log('生成阻断 0，非法转义 0');

  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }

  const exported = await exportVisualStudioProject({
    projectDir,
    projectId,
    generatedFiles: generated.files,
    enabledModules
  });

  // 窗口图标物化（等价 WindowsExecutableIconService.materialize 的 lingbuilder 分支）
  const iconTarget = path.join(projectDir, 'resources', 'lingbuilder-app.ico');
  await fs.mkdir(path.dirname(iconTarget), { recursive: true });
  const iconCandidates = [
    path.join(repositoryRoot, 'electron', 'release', '2026-09-02', 'win-unpacked', 'resources', 'assets', 'lingbuilder-window.ico'),
    path.join(repositoryRoot, 'electron', '.tmp-installer-check-063', 'app', 'resources', 'assets', 'lingbuilder-window.ico')
  ];
  const iconSource = iconCandidates.find(candidate => fsSync.existsSync(candidate));
  if (!iconSource) throw new Error('找不到随包窗口图标 lingbuilder-window.ico');
  await fs.copyFile(iconSource, iconTarget);

  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    'Microsoft Visual Studio', 'Installer', 'vswhere.exe'
  );
  const { stdout } = await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.Component.MSBuild', '-property', 'installationPath']);
  const msbuild = path.join(stdout.trim().split(/\r?\n/)[0], 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');

  const build = await execFileAsync(msbuild, [
    exported.solutionPath,
    '/m',
    '/t:Build',
    '/p:Configuration=Debug',
    '/p:Platform=x64',
    `/p:OutDir=${path.join(projectDir, 'bin')}${path.sep}`,
    '/v:minimal'
  ], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  const warnings = build.stdout.split(/\r?\n/).filter(line => /warning/i.test(line));
  const errors = build.stdout.split(/\r?\n/).filter(line => /error/i.test(line));
  console.log(`MSVC x64：错误 ${errors.length} 行，警告 ${warnings.length} 行`);
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    throw new Error('MSVC 编译失败');
  }

  // op 运行库物化到 bin（等价 nativeDependencyService.materializeOpRuntime）
  const binDir = path.join(projectDir, 'bin');
  const dllSource = path.join(repositoryRoot, 'electron', 'third_party', 'op', 'x64', 'op_c_api_x64.dll');
  await fs.copyFile(dllSource, path.join(binDir, 'op_c_api_x64.dll'));

  const executable = path.join(binDir, `${exported.projectName}.exe`);
  await fs.access(executable);
  console.log(`PASS ${executable}`);
}

main().catch((error: unknown) => {
  const err = error as { message?: string; stderr?: string; stdout?: string };
  console.error(err?.message ?? error);
  if (err?.stdout) console.error('--- stdout ---\n' + err.stdout.slice(-4000));
  if (err?.stderr) console.error('--- stderr ---\n' + err.stderr.slice(-4000));
  process.exitCode = 1;
});
