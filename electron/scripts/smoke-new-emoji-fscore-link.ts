import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { materializeModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';

/**
 * new_emoji 后端 + 文件目录模块（lingbuilder.fs.core）链接冒烟：
 * 复刻 IDE build.run 的 cl 命令形态（user32/gdi32/comctl32/ole32，不含 shlwapi.lib），
 * 源码调用 文件_读取文本/目录_创建，验证链接成功且 exe 可启动。
 * 回归锚点：LB_EnumWalk 引用 PathMatchSpecExW 需要 shlwapi.lib，
 * 由 FILE_STREAM_RUNTIME 块顶的 #pragma comment(lib, "shlwapi.lib") 注入。
 * 用法：cd electron && npx tsx scripts/smoke-new-emoji-fscore-link.ts
 */
const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const buildDir = path.resolve(repoRoot, '.lingbuilder-build', 'new-emoji-fscore-link-smoke');
const sourceDir = path.join(buildDir, 'source');
const binDir = path.join(buildDir, 'bin');
const exportDir = path.join(buildDir, 'export');

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

async function main(): Promise<void> {
  const newEmojiInstallPath = path.join(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  const newEmojiManifest = JSON.parse(await fs.readFile(path.join(newEmojiInstallPath, 'lingbuilder.module.json'), 'utf8'));
  const fsCoreManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fs.core');
  if (!fsCoreManifest) throw new Error('缺少内置模块 lingbuilder.fs.core。');
  const enabledModules: InstalledModule[] = [
    { manifest: newEmojiManifest, installPath: newEmojiInstallPath, isInstalled: true, isEnabledForProject: true, diagnostics: [] },
    { manifest: fsCoreManifest, installPath: `builtin://lingbuilder.fs.core`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }
  ];

  const project = {
    schemaVersion: 2,
    id: 'new-emoji-fscore-link-smoke',
    name: 'new_emoji 文件目录链接冒烟',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '文件目录冒烟',
      width: 720, height: 480, background: '#EFEAFC', description: '',
      titleBarBackground: '#FFFFFF', titleBarForeground: '#0F172A',
      controls: [
        { id: 'label_1', type: 'Label', name: '说明文本', content: '文件目录冒烟', x: 24, y: 48, width: 200, height: 28, isEnabled: true, visibility: 'Visible', background: 'transparent', foreground: '', fontSize: 12, fontFamily: 'Microsoft YaHei UI', fontBold: false, fontItalic: false, fontUnderline: false, events: {} }
      ]
    }]
  } as unknown as LingWindowProject;

  const windowSource = [
    '类 MainWindow',
    '    事件 创建完毕()',
    '        局部 文本型 内容',
    '        目录_创建("fscore-smoke")',
    '        内容 = 文件_读取文本("fscore-smoke/读我.txt")',
    '        调试输出(内容)',
    '    结束',
    '结束类',
    ''
  ].join('\n');

  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main',
    enabledModules,
    lingCppSourceCode: windowSource
  });
  if (generated.blockingDiagnostics.length > 0) throw new Error(generated.blockingDiagnostics.join('\n'));
  const mainFile = generated.files.find(file => file.relativePath.replaceAll('\\', '/') === 'main.cpp');
  if (!mainFile) throw new Error('原生生成结果缺少 main.cpp。');
  for (const fragment of ['LB_EnumWalk', 'PathMatchSpecExW', '#pragma comment(lib, "shlwapi.lib")']) {
    if (!mainFile.content.includes(fragment)) throw new Error(`生成代码缺少关键片段：${fragment}`);
  }

  await fs.rm(buildDir, { recursive: true, force: true });
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.mkdir(binDir, { recursive: true });
  await fs.mkdir(exportDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(sourceDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const plan = await materializeModuleNativeDependencies(enabledModules, {
    buildDir, sourceDir, binDir, exportDir, preferredTargetId: 'windows-msvc-x64'
  });
  if (plan.blockingDiagnostics.length > 0) throw new Error(plan.blockingDiagnostics.join('\n'));

  const sourcePath = path.join(sourceDir, 'main.cpp');
  const exePath = path.join(binDir, 'new-emoji-fscore-link-smoke.exe');
  const delayloadArgs = plan.runtimeFiles.some(file => path.basename(file).toLowerCase() === 'new_emoji.dll')
    ? ['delayimp.lib', '/link', '/DELAYLOAD:new_emoji.dll']
    : [];
  const clArgs = [
    '/nologo', '/EHsc', `/std:c++${plan.requiredCppStandard === 20 ? 20 : 17}`, '/utf-8', '/bigobj',
    ...(plan.requiresDynamicCrt ? ['/MD'] : []),
    ...(plan.extraCompileDefines || []).map(define => `/D${define}`),
    '/DUNICODE', '/D_UNICODE',
    ...plan.includeDirs.flatMap(includeDir => ['/I', includeDir]),
    sourcePath,
    ...plan.sourceFiles,
    '/Fe:' + exePath,
    'user32.lib', 'gdi32.lib', 'comctl32.lib', 'ole32.lib',
    ...plan.libFiles,
    '/link', '/MANIFEST:EMBED',
    ...delayloadArgs
  ];
  const installation = await findVisualStudioInstallation();
  const vcvars = path.join(installation, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
  const script = [
    '@echo off',
    `call "${vcvars}" >nul`,
    `cl ${clArgs.map(arg => /[\s"]/.test(arg) ? `"${arg}"` : arg).join(' ')} > "${path.join(buildDir, 'link.log')}" 2>&1`,
    'exit /b %errorlevel%'
  ].join('\r\n');
  const scriptPath = path.join(buildDir, 'link.cmd');
  await fs.writeFile(scriptPath, script, 'utf8');
  try {
    await execFileAsync('cmd.exe', ['/d', '/c', scriptPath], { cwd: buildDir, windowsHide: true, timeout: 10 * 60 * 1000 });
  } catch (error) {
    const log = await fs.readFile(path.join(buildDir, 'link.log'), 'utf8').catch(() => '');
    throw new Error(`链接失败（退出码 ${(error as { code?: number }).code}）\n${log.split('\n').filter(line => line.includes('error')).slice(0, 20).join('\n')}`);
  }
  const log = await fs.readFile(path.join(buildDir, 'link.log'), 'utf8');
  if (log.includes('LNK2019')) throw new Error(`链接日志出现 LNK2019：\n${log.slice(0, 2000)}`);
  await fs.access(exePath);

  const runtime = spawn(exePath, [], { cwd: binDir, detached: false, stdio: 'ignore' });
  try {
    await new Promise(resolve => setTimeout(resolve, 4000));
    if (runtime.exitCode !== null) throw new Error(`冒烟程序提前退出：${runtime.exitCode}`);
    console.log('new_emoji + fs.core 链接冒烟：链接成功，exe 正常启动（窗口存活 4 秒）。');
  } finally {
    if (runtime.exitCode === null) runtime.kill();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
