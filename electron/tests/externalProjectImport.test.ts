import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { extractPlatforms, parseSolutionFile } from '../src/services/solution/solutionFileParser';
import { ExternalProjectService } from '../src/services/solution/externalProjectService';
import { createSolutionService } from '../src/services/solution/solutionService';
import { detectExternalCppProjects, generateCMakeSkeleton } from '../src/services/solution/externalProjectDetect';
import { parseMsvcBuildOutput } from '../src/services/tasks/msvcOutputParser';

const SAMPLE_SLN = [
  'Microsoft Visual Studio Solution File, Format Version 12.00',
  '# Visual Studio Version 17',
  'Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "Core", "Core\\Core.vcxproj", "{11111111-1111-1111-1111-111111111111}"',
  'EndProject',
  'Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "App", "App\\App.vcxproj", "{22222222-2222-2222-2222-222222222222}"',
  '\tProjectSection(ProjectDependencies) = postProject',
  '\t\t{11111111-1111-1111-1111-111111111111} = {11111111-1111-1111-1111-111111111111}',
  '\tEndProjectSection',
  'EndProject',
  'Project("{2150E333-8FDC-42A3-9474-1A3956D46DE8}") = "Solution Items", "Solution Items", "{33333333-3333-3333-3333-333333333333}"',
  'EndProject',
  'Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "CSharpLib", "CSharpLib\\CSharpLib.csproj", "{44444444-4444-4444-4444-444444444444}"',
  'EndProject',
  'Global',
  '\tGlobalSection(SolutionConfigurationPlatforms) = preSolution',
  '\t\tDebug|x64 = Debug|x64',
  '\t\tRelease|x64 = Release|x64',
  '\tEndGlobalSection',
  '\tGlobalSection(ProjectConfigurationPlatforms) = postSolution',
  '\t\t{11111111-1111-1111-1111-111111111111}.Debug|x64.ActiveCfg = Debug|Win32',
  '\t\t{11111111-1111-1111-1111-111111111111}.Debug|x64.Build.0 = Debug|Win32',
  '\t\t{22222222-2222-2222-2222-222222222222}.Debug|x64.ActiveCfg = Debug|x64',
  '\t\t{22222222-2222-2222-2222-222222222222}.Debug|x64.Build.0 = Debug|x64',
  '\tEndGlobalSection',
  'EndGlobal'
].join('\r\n');

function writeVcxproj(root: string, relativePath: string, name: string): Promise<void> {
  return writeTextFile(root, relativePath, `<Project><PropertyGroup><RootNamespace>${name}</RootNamespace></PropertyGroup></Project>`);
}

async function writeTextFile(root: string, relativePath: string, content: string): Promise<void> {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
}

async function createTempWorkspace(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('solution file parser keeps Visual C++ projects, dependencies and per-project platforms', () => {
  const parsed = parseSolutionFile(SAMPLE_SLN);
  assert.equal(parsed.projects.length, 2);
  assert.equal(parsed.solutionConfigurations.join(','), 'Debug|x64,Release|x64');
  const core = parsed.projects.find(entry => entry.name === 'Core')!;
  const app = parsed.projects.find(entry => entry.name === 'App')!;
  assert.equal(core.guid, '{11111111-1111-1111-1111-111111111111}');
  assert.equal(core.relativePath.replace(/\\/gu, '/'), 'Core/Core.vcxproj');
  assert.deepEqual(core.dependencies, []);
  assert.deepEqual(app.dependencies, ['{11111111-1111-1111-1111-111111111111}']);
  assert.deepEqual(extractPlatforms(core.configPlatforms), ['Win32']);
  assert.deepEqual(extractPlatforms(app.configPlatforms), ['x64']);
  // 非 Visual C++ 项目被过滤并给出中文告警。
  assert.ok(parsed.warnings.some(warning => warning.includes('CSharpLib')));
  assert.ok(parsed.warnings.some(warning => warning.includes('Solution Items')));
});

test('inspectSolution expands a sln into external projects, defaults x64 and skips outside-workspace entries', async t => {
  const root = await createTempWorkspace('lingbuilder-sln-expand-'); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await writeVcxproj(root, 'Core/Core.vcxproj', 'Core');
  await writeVcxproj(root, 'App/App.vcxproj', 'App');
  const outsideRoot = await createTempWorkspace('lingbuilder-sln-outside-'); t.after(() => fs.rm(outsideRoot, { recursive: true, force: true }));
  await writeVcxproj(outsideRoot, 'Out/Out.vcxproj', 'Out');
  const slnLines = SAMPLE_SLN.split('\r\n');
  // 插在 Solution Items 块结束（索引 10 的 EndProject）之后、CSharpLib 之前。
  const sln = [
    ...slnLines.slice(0, 11),
    `Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "Out", "${path.relative(root, path.join(outsideRoot, 'Out', 'Out.vcxproj'))}", "{55555555-5555-5555-5555-555555555555}"`,
    'EndProject',
    ...slnLines.slice(11)
  ].join('\r\n');
  await writeTextFile(root, 'Demo.sln', sln);

  const service = new ExternalProjectService(root);
  const inspected = await service.inspectSolution('Demo.sln');
  assert.equal(inspected.projects.length, 2);
  const app = inspected.projects.find(project => project.name === 'App')!;
  const core = inspected.projects.find(project => project.name === 'Core')!;
  assert.equal(app.buildProperties.architecture, 'x64');
  assert.equal(core.buildProperties.architecture, 'Win32');
  assert.ok(inspected.logs.some(line => line.includes('x64')));
  assert.ok(inspected.warnings.some(warning => warning.includes('CSharpLib')));
  assert.ok(inspected.warnings.some(warning => warning.includes('Out') && warning.includes('工作区外')));
  assert.equal(app.type, 'external-msbuild');
  assert.equal(app.projectFile, 'App/App.vcxproj');
});

test('importExternalProject expands sln into projects with references wired and clean solution.json', async () => {
  const root = await createTempWorkspace('lingbuilder-sln-import-');
  try {
    await writeVcxproj(root, 'Core/Core.vcxproj', 'Core');
    await writeVcxproj(root, 'App/App.vcxproj', 'App');
    await writeTextFile(root, 'Demo.sln', SAMPLE_SLN);
    const service = createSolutionService(root);

    const result = await service.importExternalProject('Demo.sln');
    assert.equal(result.projects!.length, 2);
    const app = result.projects!.find(project => project.name === 'App')!;
    const core = result.projects!.find(project => project.name === 'Core')!;
    assert.deepEqual(app.references, [core.id]);
    assert.deepEqual(core.references, []);
    // 依赖顺序：构建 App 前先构建 Core。
    assert.deepEqual(service.getBuildOrder(result.solution, [app.id]).map(project => project.id), [core.id, app.id]);
    const persisted = JSON.parse(await fs.readFile(path.join(root, '.lingbuilder', 'solution.json'), 'utf8'));
    const persistedApp = persisted.projects.find((project: any) => project.name === 'App');
    assert.ok(!('solutionGuid' in persistedApp));
    assert.ok(!('solutionDependencies' in persistedApp));

    // mode:'single' 回退为整 sln 单目标导入。
    const singleRoot = await createTempWorkspace('lingbuilder-sln-single-');
    try {
      await writeTextFile(singleRoot, 'Demo.sln', SAMPLE_SLN);
      const singleService = createSolutionService(singleRoot);
      const single = await singleService.importExternalProject('Demo.sln', { mode: 'single' });
      assert.equal(single.project.type, 'external-msbuild');
      assert.equal(single.project.projectFile, 'Demo.sln');
      assert.equal(single.projects, undefined);
    } finally {
      await fs.rm(singleRoot, { recursive: true, force: true });
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('external build pins output directories for deterministic artifact lookup', async t => {
  const root = await createTempWorkspace('lingbuilder-ext-outdir-'); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await writeTextFile(root, 'cmake/CMakeLists.txt', 'project(App)');
  await writeVcxproj(root, 'msbuild/App.vcxproj', 'App');
  const calls: Array<{ command: string; args: readonly string[] }> = [];
  const service = new ExternalProjectService(root, async (command, args) => { calls.push({ command, args: [...args] }); return { exitCode: 0, stdout: 'ok', stderr: '' }; });
  const cmake = await service.inspect('cmake');
  await service.build(cmake);
  assert.ok(calls[0].args.some(argument => String(argument).startsWith('-DCMAKE_RUNTIME_OUTPUT_DIRECTORY=')));
  assert.ok(calls[1].args.includes('--config'));
  const msbuild = await service.inspect('msbuild/App.vcxproj');
  const result = await service.build(msbuild);
  assert.equal(result.ok, true);
  const outDirArgument = calls[2].args.find(argument => String(argument).startsWith('/p:OutDir='))!;
  assert.ok(outDirArgument.endsWith(path.sep), 'OutDir 必须以路径分隔符结尾');
  assert.equal(path.resolve(String(outDirArgument).slice('/p:OutDir='.length)), path.resolve(result.outputDir));
});

test('locateExecutable finds the built exe in pinned, conventional and deep locations', async t => {
  const root = await createTempWorkspace('lingbuilder-ext-locate-'); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await writeVcxproj(root, 'msbuild/App.vcxproj', 'App');
  const service = new ExternalProjectService(root, async () => ({ exitCode: 0, stdout: '', stderr: '' }));
  const project = await service.inspect('msbuild/App.vcxproj');

  const outputDir = path.join(root, 'build-output');
  await fs.mkdir(path.join(outputDir, 'Debug'), { recursive: true });
  await fs.writeFile(path.join(outputDir, 'Debug', 'App.exe'), 'exe');
  assert.equal(await service.locateExecutable(project, outputDir), path.join(outputDir, 'Debug', 'App.exe'));

  // executableName 精确匹配优先于“最新”。
  await fs.writeFile(path.join(outputDir, 'other.exe'), 'exe');
  const named = { ...project, buildProperties: { ...project.buildProperties, executableName: 'other' } };
  assert.equal(await service.locateExecutable(named, outputDir), path.join(outputDir, 'other.exe'));

  // 兜底：工程目录浅层递归能找到传统 x64/Debug 布局。
  const deepDir = path.join(root, 'msbuild', 'x64', 'Debug');
  await fs.mkdir(deepDir, { recursive: true });
  await fs.writeFile(path.join(deepDir, 'Legacy.exe'), 'exe');
  const emptyOutput = path.join(root, 'nothing-here');
  assert.equal(await service.locateExecutable(project, emptyOutput), path.join(deepDir, 'Legacy.exe'));
});

test('msvc output parser extracts compiler, linker and msbuild diagnostics with Chinese explanations', () => {
  const stdout = [
    '1>------ 已启动生成: 项目: App, 配置: Debug Win32 ------',
    '1>main.cpp(12,5): error C2065: “foo”: 未声明的标识符',
    '1>main.cpp(20): warning C4244: “初始化”: 从“double”转换到“int”，可能丢失数据',
    'LINK : fatal error LNK1120: 1 个无法解析的外部命令',
    'C:\\p\\App.vcxproj(13,5): error MSB4044: 任务未获得必需输入',
    '1>main.cpp(12,5): error C2065: “foo”: 未声明的标识符'
  ].join('\n');
  const diagnostics = parseMsvcBuildOutput(stdout, '');
  assert.equal(diagnostics.length, 4);
  const c2065 = diagnostics[0]!;
  assert.equal(c2065.code, 'C2065');
  assert.equal(c2065.severity, 'error');
  assert.equal(c2065.line, 12);
  assert.equal(c2065.column, 5);
  assert.ok(c2065.message.includes('未声明的标识符'), '错误码应附带中文解释');
  assert.equal(diagnostics[1]!.severity, 'warning');
  assert.equal(diagnostics[2]!.code, 'LNK1120');
  assert.ok(diagnostics[2]!.message.includes('LNK2019'));
  assert.equal(diagnostics[3]!.code, 'MSB4044');
  // 普通日志与未知代码段不误判。
  assert.equal(parseMsvcBuildOutput('已跳过 3 个项目', '').length, 0);
  assert.equal(parseMsvcBuildOutput('note: unknown tool: error XY999: weird', '').length, 0);
});

test('detectExternalCppProjects shallow-scans project files and reports bare source directories', async t => {
  const root = await createTempWorkspace('lingbuilder-detect-'); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await writeTextFile(root, 'CMakeLists.txt', 'project(RootApp)');
  await writeTextFile(root, 'native/Native.sln', SAMPLE_SLN);
  await writeVcxproj(root, 'native/Deep/Deep.vcxproj', 'Deep');
  await writeTextFile(root, 'hello-src/main.cpp', 'int main() { return 0; }');
  await writeTextFile(root, 'hello-src/util/impl.cpp', 'void impl() {}');
  await writeTextFile(root, 'build/junk.obj.cpp', 'int junk() { return 0; }');
  const detection = await detectExternalCppProjects(root);
  const kinds = detection.candidates.map(candidate => candidate.kind).sort();
  assert.deepEqual(kinds, ['cmake', 'msbuild', 'sln']);
  const cmake = detection.candidates.find(candidate => candidate.kind === 'cmake')!;
  assert.equal(cmake.name, 'RootApp');
  assert.equal(detection.sourceDirectories.length, 1);
  assert.equal(detection.sourceDirectories[0]!.relativePath, 'hello-src');
  assert.equal(detection.sourceDirectories[0]!.sourceFileCount, 2);
});

test('importSourceDirectory generates a CMake skeleton, imports it and guards overwrites', async () => {
  const root = await createTempWorkspace('lingbuilder-src-import-');
  try {
    await writeTextFile(root, 'hello-src/main.cpp', 'int main() { return 0; }');
    await writeTextFile(root, 'hello-src/math/add.cpp', 'int add(int a, int b) { return a + b; }');
    const service = createSolutionService(root);
    const result = await service.importSourceDirectory('hello-src');
    assert.equal(result.project.type, 'external-cmake');
    assert.equal(result.project.name, 'hello-src');
    assert.equal(result.generatedCMakeListsPath, 'hello-src/CMakeLists.txt');
    const generated = await fs.readFile(path.join(root, 'hello-src', 'CMakeLists.txt'), 'utf8');
    assert.ok(generated.includes('project(hello-src'));
    assert.ok(generated.includes('"main.cpp"'));
    assert.ok(generated.includes('"math/add.cpp"'));
    assert.ok(generated.includes('LingBuilder 扫描源码目录自动生成'));
    // 已存在时阻断；确认覆盖后只重写该文件并完成导入。
    await assert.rejects(service.importSourceDirectory('hello-src'), /已存在 CMakeLists/u);
    const overwritten = await service.importSourceDirectory('hello-src', { overwrite: true });
    assert.equal(overwritten.project.type, 'external-cmake');
    // 空目录没有源码时给出中文诊断。
    await fs.mkdir(path.join(root, 'empty-src'), { recursive: true });
    await assert.rejects(service.importSourceDirectory('empty-src'), /没有找到 C\/C\+\+ 源码/u);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('generateCMakeSkeleton lists sources explicitly and pins C++17', () => {
  const skeleton = generateCMakeSkeleton('MyApp', ['a.cpp', 'sub/b.cpp']);
  assert.ok(skeleton.includes('add_executable(MyApp'));
  assert.ok(skeleton.includes('  "a.cpp"'));
  assert.ok(skeleton.includes('  "sub/b.cpp"'));
  assert.ok(skeleton.includes('CMAKE_CXX_STANDARD 17'));
});

test('adaptNativeCppToProject translates cpp into a new Chinese project without touching the source', async () => {
  const root = await createTempWorkspace('lingbuilder-adapt-');
  try {
    const cppSource = [
      '#include <windows.h>',
      'LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) { return DefWindowProcW(hwnd, msg, wParam, lParam); }',
      'int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE, LPSTR, int nCmdShow) {',
      '  HWND hwnd = CreateWindowW(L"MyApp", L"我的应用", WS_OVERLAPPEDWINDOW, 0, 0, 640, 480, NULL, NULL, hInstance, NULL);',
      '  ShowWindow(hwnd, nCmdShow);',
      '  return 0;',
      '}'
    ].join('\r\n');
    await writeTextFile(root, 'native/Demo.cpp', cppSource);
    const service = createSolutionService(root);
    const result = await service.adaptNativeCppToProject('native/Demo.cpp');
    assert.equal(result.project.type, 'visual-cpp');
    assert.ok(result.project.name.includes('Demo'));
    // 生成了 .lcpp 与设计器模型，且原 C++ 文件保持原样。
    const lcppFiles = await fs.readdir(path.join(root, result.project.sourceRoot));
    assert.ok(lcppFiles.some(file => file.endsWith('.lcpp')));
    const designer = JSON.parse(await fs.readFile(path.join(root, result.project.designerPath), 'utf8'));
    assert.ok(Array.isArray(designer.windows) && designer.windows.length > 0);
    const persisted = JSON.parse(await fs.readFile(path.join(root, '.lingbuilder', 'solution.json'), 'utf8'));
    assert.ok(persisted.projects.some((project: any) => project.id === result.project.id));
    assert.equal(await fs.readFile(path.join(root, 'native', 'Demo.cpp'), 'utf8'), cppSource);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('locateLibraries collects import libraries from pinned and conventional output locations', async t => {
  const root = await createTempWorkspace('lingbuilder-ext-libs-'); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await writeVcxproj(root, 'msbuild/App.vcxproj', 'App');
  const service = new ExternalProjectService(root, async () => ({ exitCode: 0, stdout: '', stderr: '' }));
  const project = await service.inspect('msbuild/App.vcxproj');
  const outputDir = path.join(root, 'build-output');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'App.lib'), 'lib');
  const libraries = await service.locateLibraries(project, outputDir);
  assert.deepEqual(libraries.map(file => path.basename(file)).sort(), ['App.lib']);
});
