import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createLcppSourcePackageService } from '../electron/lcppSourcePackageService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const demosRoot = path.join(repositoryRoot, 'examples', 'edgeview-response-demos');

interface DemoSpec {
  id: string;
  workspaceName: string;
  packageName: string;
  moduleIds: string[];
  requiredSourceFragments: string[];
}

const demos: DemoSpec[] = [
  {
    id: 'edgeview-replace-response-demo',
    workspaceName: 'replace-response',
    packageName: 'EdgeView替换响应Demo.lcpppkg',
    moduleIds: ['lingbuilder.win32.basic', 'lingbuilder.edgeview'],
    requiredSourceFragments: [
      'EdgeView_绑定控件事件(演示浏览器, "Web资源请求", &收到资源请求)',
      'EdgeView资源_设置事件响应文本(演示浏览器, 200, "OK"'
    ]
  },
  {
    id: 'edgeview-read-response-demo',
    workspaceName: 'read-response',
    packageName: 'EdgeView读取响应Demo.lcpppkg',
    moduleIds: ['lingbuilder.win32.basic', 'lingbuilder.edgeview', 'lingbuilder.std.bytes', 'lingbuilder.data.json'],
    requiredSourceFragments: [
      'EdgeView_绑定控件事件(演示浏览器, "Web资源响应收到", &收到Web资源响应)',
      'EdgeView事件_取字段(演示浏览器, "requestHandle")',
      'EdgeView事件_取字段(演示浏览器, "responseHandle")',
      'EdgeView事件_取字段(演示浏览器, "statusCode")',
      'EdgeView事件_取字段(演示浏览器, "reason")',
      'EdgeView资源_读响应正文异步(演示浏览器, 当前响应句柄, 1048576, &响应正文读取完成)',
      '字节_十六进制转文本(正文十六进制)'
    ]
  }
];

function builtin(moduleId: string): InstalledModule {
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

async function locateMsBuild(): Promise<string> {
  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  );
  const installation = (await execFileAsync(vswhere, [
    '-latest',
    '-products', '*',
    '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property', 'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  return path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
}

async function validateAndGenerate(demo: DemoSpec) {
  const workspaceRoot = path.join(demosRoot, demo.workspaceName);
  const sourceRelativePath = `src/${demo.id}/MainWindow.lcpp`;
  const sourcePath = path.join(workspaceRoot, sourceRelativePath);
  const designerPath = path.join(workspaceRoot, '.lingbuilder', 'projects', demo.id, 'window-designer.json');
  const [sourceCode, designerText] = await Promise.all([
    fs.readFile(sourcePath, 'utf8'),
    fs.readFile(designerPath, 'utf8')
  ]);
  for (const fragment of demo.requiredSourceFragments) {
    if (!sourceCode.includes(fragment)) throw new Error(`${demo.id} 缺少关键演示代码：${fragment}`);
  }

  const project = JSON.parse(designerText) as LingWindowProject;
  const window = project.windows[0];
  if (!window) throw new Error(`${demo.id} 缺少主窗口。`);
  const browser = window.controls.find(control => control.name === '演示浏览器');
  if (browser?.type !== 'EdgeBrowser' || browser.visibility !== 'Visible') {
    throw new Error(`${demo.id} 缺少可见的演示浏览器控件。`);
  }

  const enabledModules = demo.moduleIds.map(builtin);
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: window.id,
    lingCppSources: [{ filePath: sourceRelativePath, sourceCode }],
    enabledModules
  });
  if (generated.blockingDiagnostics.length > 0) {
    throw new Error(`${demo.id} 存在阻断诊断：\n${generated.blockingDiagnostics.join('\n')}`);
  }
  if (!generated.files.some(file => file.relativePath === 'main.cpp')) {
    throw new Error(`${demo.id} 未生成 main.cpp。`);
  }
  const generatedMain = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  if (generatedMain.includes('暂不支持的中文 C++ 语句')) {
    throw new Error(`${demo.id} 仍包含被生成器降级的中文语句。`);
  }
  return { workspaceRoot, project, generated, enabledModules };
}

async function verifyNativeBuild(
  demo: DemoSpec,
  project: LingWindowProject,
  generated: ReturnType<typeof generateLingCppNativeWin32Project>,
  enabledModules: InstalledModule[],
  msbuild: string
) {
  const buildRoot = path.join(repositoryRoot, '.lingbuilder-build', 'edgeview-response-demos', demo.id);
  if (!buildRoot.startsWith(`${repositoryRoot}${path.sep}`)) throw new Error('原生验证目录越出工作区。');
  await fs.rm(buildRoot, { recursive: true, force: true });
  await fs.mkdir(buildRoot, { recursive: true });
  for (const file of generated.files) {
    const targetPath = path.resolve(buildRoot, file.relativePath);
    if (!targetPath.startsWith(`${buildRoot}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, file.content, 'utf8');
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, buildRoot);
  if (dependencyDiagnostics.length > 0) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({
    projectDir: buildRoot,
    projectId: project.id,
    generatedFiles: generated.files,
    enabledModules
  });

  const platforms: string[] = [];
  for (const platform of ['Win32', 'x64']) {
    try {
      await execFileAsync(msbuild, [
        exported.solutionPath,
        '/m',
        '/t:Build',
        '/p:Configuration=Release',
        `/p:Platform=${platform}`,
        '/v:minimal'
      ], {
        cwd: buildRoot,
        windowsHide: true,
        timeout: 10 * 60 * 1000,
        maxBuffer: 64 * 1024 * 1024
      });
    } catch (error) {
      const processError = error as Error & { stdout?: string; stderr?: string };
      throw new Error([
        `${demo.id} 的 ${platform} 原生编译失败。`,
        processError.stdout?.trim(),
        processError.stderr?.trim(),
        processError.message
      ].filter(Boolean).join('\n'));
    }
    const executable = path.join(buildRoot, platform, 'Release', 'bin', `${exported.projectName}.exe`);
    // WebView2 Loader 已静态链接进 EXE，不再要求 exe 同目录存在 WebView2Loader.dll。
    await fs.access(executable);
    platforms.push(platform);
  }
  return { buildRoot, platforms };
}

async function exportAndVerifyPackage(demo: DemoSpec, workspaceRoot: string, ideVersion: string) {
  const exportPath = path.join(repositoryRoot, 'exports', demo.packageName);
  await fs.mkdir(path.dirname(exportPath), { recursive: true });
  const service = createLcppSourcePackageService(workspaceRoot);
  const exported = await service.exportProject(demo.id, exportPath, ideVersion);
  const preview = await service.inspectPackage(exportPath);
  const importParent = await fs.mkdtemp(path.join(os.tmpdir(), `lingbuilder-${demo.id}-import-`));
  try {
    const imported = await service.importPackage(exportPath, importParent);
    await Promise.all([
      fs.access(path.join(imported.workspacePath, 'src', demo.id, 'MainWindow.lcpp')),
      fs.access(path.join(imported.workspacePath, 'src', demo.id, 'README.md')),
      fs.access(path.join(imported.workspacePath, '.lingbuilder', 'projects', demo.id, 'window-designer.json')),
      fs.access(path.join(imported.workspacePath, '.lingbuilder', 'projects', demo.id, 'project-modules.json'))
    ]);
  } finally {
    await fs.rm(importParent, { recursive: true, force: true });
  }
  return {
    packagePath: exportPath,
    packageBytes: preview.totalBytes,
    packageSha256: preview.packageSha256,
    sourceFiles: exported.lcppFileCount,
    packagedFiles: exported.fileCount,
    requiredCapabilities: preview.manifest.requiredCapabilities,
    minimumGeneratorVersion: preview.manifest.minimumGeneratorVersion
  };
}

async function main() {
  const electronPackage = JSON.parse(await fs.readFile(path.join(repositoryRoot, 'electron', 'package.json'), 'utf8')) as { version?: string };
  const ideVersion = electronPackage.version || '0.2.9';
  const verifyNative = process.argv.includes('--verify-native');
  const msbuild = verifyNative ? await locateMsBuild() : '';
  const results: Array<Record<string, unknown>> = [];
  for (const demo of demos) {
    const validation = await validateAndGenerate(demo);
    const native = verifyNative
      ? await verifyNativeBuild(demo, validation.project, validation.generated, validation.enabledModules, msbuild)
      : { buildRoot: '', platforms: [] };
    const packageResult = await exportAndVerifyPackage(demo, validation.workspaceRoot, ideVersion);
    results.push({
      id: demo.id,
      generatedFileCount: validation.generated.files.length,
      nonBlockingDiagnostics: validation.generated.diagnostics,
      nativePlatforms: native.platforms,
      nativeBuildRoot: native.buildRoot,
      ...packageResult
    });
  }
  console.log(JSON.stringify({ ok: true, ideVersion, results }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
