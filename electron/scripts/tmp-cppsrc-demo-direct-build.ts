// C++源码库演示工程直连构建验证：生成 C++ 工程 + 双平台 MSVC 编译 + v6 结构体发射断言。
// 用法：cd electron && npx tsx scripts/tmp-cppsrc-demo-direct-build.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { parseLingCpp } from '../src/services/lingCpp/parser';
import { createProjectCppSourceDeclarationModule } from '../src/services/lingCpp/projectCppSourceLibraryService';
import { materializeProjectCppSourceLibraries } from '../src/services/modules/projectCppSourceMaterializeService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const demoRoot = path.join(repositoryRoot, 'AI 视频自主生产', '进阶方案', 'C++源码库演示');
const projectId = 'cpp-source-demo';
const buildRoot = path.join(demoRoot, '.lingbuilder-build', projectId);

function resolveModule(moduleId: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
  if (!manifest) throw new Error(`未找到内置模块 ${moduleId}`);
  return { manifest, installPath: `builtin://${moduleId}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main() {
  const solution = JSON.parse(await fs.readFile(path.join(demoRoot, '.lingbuilder', 'solution.json'), 'utf8')) as {
    projects: Array<{ id: string; sourceRoot: string; designerPath: string }>;
  };
  const project = solution.projects.find(item => item.id === projectId);
  if (!project) throw new Error(`solution.json 缺少项目 ${projectId}`);
  const sourceRoot = path.join(demoRoot, project.sourceRoot);
  const designerProject = JSON.parse(
    await fs.readFile(path.join(demoRoot, project.designerPath), 'utf8')
  ) as LingWindowProject;

  const lcppSources: Array<{ filePath: string; sourceCode: string }> = [];
  const collect = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) await collect(child);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lcpp')) {
        lcppSources.push({
          filePath: path.relative(sourceRoot, child).replace(/\\/gu, '/'),
          sourceCode: await fs.readFile(child, 'utf8')
        });
      }
    }
  };
  await collect(sourceRoot);

  const declaration = lcppSources.find(item => item.filePath.endsWith('项目C++源码库.lcpp'));
  if (!declaration) throw new Error('缺少 项目C++源码库.lcpp');
  const cppLibraries = parseLingCpp(declaration.sourceCode).program.cppLibraries || [];
  const virtualModule = createProjectCppSourceDeclarationModule(cppLibraries, projectId);
  if (!virtualModule) throw new Error('C++ 源码库虚拟模块未合成');
  const enabledModules = [resolveModule('lingbuilder.win32.basic'), virtualModule];

  const generated = generateLingCppNativeWin32Project(designerProject, {
    activeWindowId: designerProject.windows[0]?.id,
    lingCppSources: lcppSources,
    enabledModules
  });
  if (generated.blockingDiagnostics.length > 0) throw new Error(`阻断诊断：\n${generated.blockingDiagnostics.join('\n')}`);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const needle of ['点_创建()', '点_置x(a, 3)', '两点距离(a, b)', '取中点(a, b)', '点_取名称(中点)', '点_销毁(中点)']) {
    if (!mainCpp.includes(needle)) throw new Error(`main.cpp 缺结构体调用：${needle}`);
  }
  console.log('生成阻断 0，结构体调用发射齐全');

  for (const attempt of [1, 2, 3, 4, 5]) {
    try {
      await fs.rm(buildRoot, { recursive: true, force: true });
      break;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  const projectDir = buildRoot;
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const materialized = await materializeProjectCppSourceLibraries({
    cppLibraries,
    sourceRootAbsolute: sourceRoot,
    buildDir: projectDir,
    sourceDir: projectDir,
    binDir: projectDir,
    exportDir: projectDir,
    logs: []
  });
  if (materialized.blocking.length > 0) throw new Error(`源码库物化阻断：\n${materialized.blocking.join('\n')}`);
  const declarationHeader = await fs.readFile(path.join(projectDir, 'modules', 'lingbuilder.project.cppsrc', 'include', 'CppSourceLibraries.h'), 'utf8');
  if (declarationHeader.includes('struct Point {')) throw new Error('头文件库不应生成 struct 定义（示例 geometry.h 自带定义）');
  if (!declarationHeader.includes('inline long long 点_创建() { return reinterpret_cast<long long>(new Point()); }')) throw new Error('声明头缺结构体访问器');
  console.log('物化完成（头文件库模式：定义来自 cpp/geometry.h）');

  const exported = await exportVisualStudioProject({ projectDir, projectId, generatedFiles: generated.files, enabledModules });
  const iconTarget = path.join(projectDir, 'resources', 'lingbuilder-app.ico');
  await fs.mkdir(path.dirname(iconTarget), { recursive: true });
  await fs.copyFile(path.join(repositoryRoot, 'image', 'lingbuilder-ide-icon-v1.ico'), iconTarget);
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  for (const platform of ['Win32', 'x64']) {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    console.log(`MSBuild ${platform} PASS`);
  }
  console.log(JSON.stringify({ ok: true, projectDir, note: '双平台编译通过；运行行为由 smoke:cpp-source-library 同构代码覆盖' }));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
