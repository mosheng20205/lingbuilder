/**
 * 内嵌资源原生烟雾测试（无头、可重复）。
 *
 * 覆盖三件事：
 * 1. 项目级内嵌资源以 RCDATA 打进 EXE：资源_是否存在 / 资源_取大小 / 资源_取文本 / 资源_列表 结果正确，
 *    未声明「启动释放」的资源运行期不落盘。
 * 2. extract = 真的资源在启动时释放到 %TEMP%\lingbuilder-embedded\<工程ID>\<逻辑名>（含子目录），
 *    字节与源文件一致。
 * 3. 旧「窗口内嵌文件」（embeddedFiles）自动迁移成 extract = true 的内嵌资源，
 *    且窗口图标选「不显示」时不再静默丢弃（历史缺陷回归）。
 *
 * 运行：cd electron && npx tsx scripts/smoke-embedded-resource-native.ts
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { migrateLegacyEmbeddedFiles } from '../src/services/windowDesigner/embeddedResourceMigration';
import { getEmbeddedResourceSpecs } from '../src/services/windowDesigner/embeddedResourceService';
import { createDesignerAssetService } from '../src/services/windowDesigner/designerAssetService';
import { createWindowsExecutableIconService } from '../src/services/windowDesigner/windowsExecutableIconService';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import type { LingBuilderSolutionProject } from '../src/services/solution/solutionService';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const scratchRoot = path.resolve(repoRoot, '.lingbuilder-build', 'embedded-resource-smoke');
const PROJECT_ID = 'embedded-resource-smoke';
const TEXT_CONTENT = '内嵌资源演示 OK（含中文与符号）';
const TEXT_LOGICAL_NAME = 'resources/说明.txt';
const ZIP_LOGICAL_NAME = 'bundle/素材.zip';
const LEGACY_LOGICAL_NAME = 'legacy.bin';

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function resolveMsbuild(): Promise<string> {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, [
    '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  return path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
}

async function writeProjectFiles(projectDir: string, files: Array<{ relativePath: string; content: string }>): Promise<void> {
  for (const file of files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
}

/**
 * 清理构建目录：刚运行过的 exe / MSBuild 节点会短暂占用句柄（EBUSY/EPERM），
 * 按退避重试；仍失败时改名让路，避免整个冒烟因锁失败。
 */
async function removeDirectoryWithRetry(directory: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fs.rm(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'EBUSY' && code !== 'EPERM' && code !== 'ENOTEMPTY') throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  const renamed = `${directory}-stale-${Date.now()}`;
  await fs.rename(directory, renamed).catch(() => undefined);
  await fs.rm(renamed, { recursive: true, force: true }).catch(() => undefined);
}

const MAIN_SOURCE = [
  '包 内嵌资源烟雾',
  '使用 Win32窗口基础模块',
  '使用 内嵌资源模块',
  '',
  '类 资源窗口 : 窗口',
  '公开',
  '  事件 _资源窗口_创建完毕()',
  '    局部 逻辑型 说明存在 = 假',
  '    局部 整数型 说明大小 = 0',
  '    局部 文本型 说明文本 = ""',
  '    局部 文本型 清单 = ""',
  '    局部 逻辑型 释放资源存在 = 假',
  '    局部 逻辑型 旧文件存在 = 假',
  '    说明存在 = 资源_是否存在("resources/说明.txt")',
  '    说明大小 = 资源_取大小("resources/说明.txt")',
  '    说明文本 = 资源_取文本("resources/说明.txt")',
  '    清单 = 资源_列表()',
  '    释放资源存在 = 资源_是否存在("bundle/素材.zip")',
  '    旧文件存在 = 资源_是否存在("legacy.bin")',
  '    @ const bool lbTextOk = 说明文本 == L"内嵌资源演示 OK（含中文与符号）";',
  '    @ const bool lbListOk = 清单.find(L"bundle/素材.zip") != std::wstring::npos && 清单.find(L"legacy.bin") != std::wstring::npos;',
  '    @ FILE* lbReport = nullptr;',
  '    @ fopen_s(&lbReport, "embed-report.txt", "wb");',
  '    @ if (lbReport) fprintf(lbReport, "%d|%d|%d|%d|%d|%d\\n", 说明存在 ? 1 : 0, 说明大小, lbTextOk ? 1 : 0, 释放资源存在 ? 1 : 0, 旧文件存在 ? 1 : 0, lbListOk ? 1 : 0);',
  '    @ if (lbReport) fclose(lbReport);',
  '    @ PostQuitMessage(0);',
  '  结束',
  '结束类',
  ''
].join('\n');

async function main(): Promise<void> {
  if (!scratchRoot.startsWith(`${repoRoot}${path.sep}`)) throw new Error('内嵌资源烟雾测试目录越出工作区。');
  const projectDir = path.join(scratchRoot, 'native-x64');
  await fs.mkdir(scratchRoot, { recursive: true });
  await removeDirectoryWithRetry(projectDir);
  await fs.mkdir(projectDir, { recursive: true });

  // 源文件：一个文本（不释放）、一个 zip 扩展名字节（启动释放）、一个旧「内嵌文件」源文件。
  const textBytes = Buffer.from(TEXT_CONTENT, 'utf8');
  const zipBytes = Buffer.from('PK\u0003\u0004 内嵌资源冒烟 zip 占位内容', 'utf8');
  const legacyBytes = Buffer.from('legacy embedded file payload', 'utf8');
  await fs.mkdir(path.join(projectDir, 'src', 'resources', 'bundle'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'src', 'legacy'), { recursive: true });
  await fs.writeFile(path.join(projectDir, 'src', 'resources', '说明.txt'), textBytes);
  await fs.writeFile(path.join(projectDir, 'src', 'resources', 'bundle', '素材.zip'), zipBytes);
  await fs.writeFile(path.join(projectDir, 'src', 'legacy', '旧文件.bin'), legacyBytes);

  const project: LingWindowProject = {
    schemaVersion: 2,
    id: PROJECT_ID,
    name: '内嵌资源烟雾测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: '资源窗口', title: '内嵌资源烟雾测试',
      width: 520, height: 240, background: '#202028', description: '无头验证内嵌资源与启动释放',
      // 图标选「不显示」：历史上这一项会让声明的内嵌文件被静默丢弃，这里作为回归条件。
      iconStyle: 'none',
      controls: [],
      embeddedFiles: [{ file: 'src/legacy/旧文件.bin', extractName: LEGACY_LOGICAL_NAME }]
    }],
    embeddedResources: [
      { name: TEXT_LOGICAL_NAME, file: 'src/resources/说明.txt' },
      { name: ZIP_LOGICAL_NAME, file: 'src/resources/bundle/素材.zip', extract: true }
    ]
  };
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.resource.embed')];
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceFilePath: 'src/资源演示.lcpp',
    lingCppSourceCode: MAIN_SOURCE,
    enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(`生成被阻断：\n${generated.blockingDiagnostics.join('\n')}`);
  await writeProjectFiles(projectDir, generated.files);

  // rc：三个资源都必须在（普通资源、启动释放资源、由旧内嵌文件迁移来的资源），且不含图标行。
  const resourceFile = generated.files.find(file => file.relativePath === 'lingbuilder-app.rc');
  if (!resourceFile) throw new Error('缺少 lingbuilder-app.rc。');
  for (const pattern of [
    /ID_RCDATA_LINGBUILDER_RESOURCE_2301 RCDATA "resources\\\\res-0001\.txt"/u,
    /ID_RCDATA_LINGBUILDER_RESOURCE_2302 RCDATA "resources\\\\res-0002\.zip"/u,
    /ID_RCDATA_LINGBUILDER_RESOURCE_2303 RCDATA "resources\\\\res-0003\.bin"/u
  ]) {
    if (!pattern.test(resourceFile.content)) throw new Error(`rc 缺少内嵌资源行（${pattern}）：\n${resourceFile.content}`);
  }
  if (/IDI_LINGBUILDER_APP/u.test(resourceFile.content)) throw new Error('窗口图标为「不显示」时 rc 不应包含图标行。');

  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  if (!/LB_EmbeddedResourceReleaseExtracted\(\);/u.test(cpp)) throw new Error('main.cpp 缺少启动释放调用。');

  // 物化：与 F5 构建同一套服务，把源文件复制成 rc 里引用的 ASCII 归档名。
  const solutionProject: LingBuilderSolutionProject = {
    id: PROJECT_ID, name: project.name, type: 'visual-cpp', sourceRoot: 'src', configRoot: 'config',
    designerPath: `.lingbuilder/projects/${PROJECT_ID}/window-designer.json`, isDefault: true
  };
  const migrated = migrateLegacyEmbeddedFiles(project);
  const assetService = createDesignerAssetService(projectDir);
  const iconService = createWindowsExecutableIconService(projectDir, assetService);
  await iconService.materialize(solutionProject, generated.selectedWindow, [projectDir], {
    embeddedResourceSpecs: getEmbeddedResourceSpecs(migrated.project)
  });
  await fs.access(path.join(projectDir, 'resources', 'res-0001.txt'));
  await fs.access(path.join(projectDir, 'resources', 'res-0002.zip'));
  await fs.access(path.join(projectDir, 'resources', 'res-0003.bin'));

  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  const msbuild = await resolveMsbuild();
  try {
    await execFileAsync(msbuild, [
      exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'
    ], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  } catch (error) {
    const detail = error as { stdout?: string; stderr?: string };
    throw new Error(`MSBuild 失败：\n${String(detail.stdout || '').slice(-8000)}\n${String(detail.stderr || '').slice(-2000)}`);
  }

  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  const executableDir = path.dirname(executable);
  const extractRoot = path.join(os.tmpdir(), 'lingbuilder-embedded', PROJECT_ID);
  await fs.rm(extractRoot, { recursive: true, force: true });
  await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 2 * 60 * 1000, maxBuffer: 1024 * 1024 });

  const report = (await fs.readFile(path.join(executableDir, 'embed-report.txt'), 'utf8')).trim();
  const expected = `1|${textBytes.byteLength}|1|1|1|1`;
  if (report !== expected) throw new Error(`内嵌资源运行结果不符：期望 ${expected}，实际 ${report}`);

  // 启动释放：extract = true 与迁移来的旧内嵌文件都在 %TEMP% 里，且字节一致。
  const extractedZip = path.join(extractRoot, 'bundle', '素材.zip');
  const extractedLegacy = path.join(extractRoot, LEGACY_LOGICAL_NAME);
  const [zipWritten, legacyWritten] = await Promise.all([fs.readFile(extractedZip), fs.readFile(extractedLegacy)]);
  if (!zipWritten.equals(zipBytes)) throw new Error('启动释放的 zip 资源内容与源文件不一致。');
  if (!legacyWritten.equals(legacyBytes)) throw new Error('旧内嵌文件迁移后释放的内容与源文件不一致。');
  // 未声明启动释放的资源不得落盘（内嵌资源默认零释放）。
  const notExtracted = await fs.access(path.join(extractRoot, 'resources', '说明.txt')).then(() => true, () => false);
  if (notExtracted) throw new Error('未声明启动释放的内嵌资源不应写进 %TEMP%。');

  console.log(JSON.stringify({
    ok: true,
    scratchRoot,
    executable,
    report,
    extracted: [extractedZip, extractedLegacy],
    deprecation: generated.diagnostics.filter(text => text.includes('embeddedFiles'))
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
