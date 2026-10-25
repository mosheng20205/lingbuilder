import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { getLingCppSemanticDiagnostics } from '../src/services/lingCpp/languageService';
import { parseLingCpp } from '../src/services/lingCpp/parser';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule, LingWindowProject } from '../src/services/modules/types';

const projectDir = 'T:\\electron\\lingbuilder\\AI 视频自主生产\\进阶方案\\OP后台图色全能力演示';
const bm = (id: string): InstalledModule => {
  const manifest = BUILTIN_MODULES.find(x => x.id === id)!;
  return { manifest, installPath: 'builtin://' + id, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
};
async function main() {
  const designer = JSON.parse(fs.readFileSync(path.join(projectDir, '.lingbuilder', 'projects', 'op-all-capabilities-demo', 'window-designer.json'), 'utf8')) as unknown as LingWindowProject;
  const source = fs.readFileSync(path.join(projectDir, 'src', 'MainWindow.lcpp'), 'utf8');
  const globals = fs.readFileSync(path.join(projectDir, 'src', '项目全局变量.lcpp'), 'utf8');
  const enabledModules = [bm('lingbuilder.win32.basic'), bm('lingbuilder.win32.common-controls'), bm('lingbuilder.op'), bm('lingbuilder.fs.core'), bm('lingbuilder.std.text'), bm('lingbuilder.std.array')];
  const generated = generateLingCppNativeWin32Project(designer, {
    lingCppSources: [
      { filePath: '项目全局变量.lcpp', sourceCode: globals },
      { filePath: 'MainWindow.lcpp', sourceCode: source }
    ],
    enabledModules
  });
  console.log('生成阻断:', generated.blockingDiagnostics.length);
  for (const d of generated.blockingDiagnostics.slice(0, 6)) console.log('  -', d);
  const globalsParsed = parseLingCpp(globals);
  const semantic = getLingCppSemanticDiagnostics(source, designer, 'src/MainWindow.lcpp', { availableModules: enabledModules, enabledModules }, { filePath: '项目全局变量.lcpp', sourceCode: globals, constants: globalsParsed.program.constants, globals: globalsParsed.program.globals });
  const errors = semantic.filter(d => d.level === 'error');
  const missingControl = semantic.filter(d => String(d.message || '').includes('控件不存在'));
  console.log('语义诊断: 总', semantic.length, '错误', errors.length, '控件找不到', missingControl.length);
  for (const d of errors.slice(0, 6)) console.log('  E:', (d.message || '').slice(0, 110));
  for (const d of missingControl) console.log('  控件找不到:', (d.message || '').slice(0, 120));
  const mainCpp = generated.files.find(f => f.relativePath === 'main.cpp')!;
  const BS = String.fromCharCode(92);
  const badEscapes = mainCpp.content.split('\n').filter(line => (line.match(new RegExp('L"[^"]*', 'g')) || []).some(seg => seg.includes(BS + 'o')));
  console.log('非法转义:', badEscapes.length);
  const opCalls = new Set([...source.matchAll(/(后台_[\p{L}\p{N}_]+)\s*[（(]/gu)].map(m => m[1] || ''));
  const expected = new Set(BUILTIN_MODULES.find(m => m.id === 'lingbuilder.op')!.contributes!.commands.map(c => c.name));
  const missing = [...expected].filter(name => !opCalls.has(name));
  console.log('214 对账:', (expected.size - missing.length) + '/' + expected.size, missing.length ? '缺:' + missing.join(',') : '');
  if (generated.blockingDiagnostics.length || errors.length || missingControl.length || badEscapes.length || missing.length) process.exit(1);
  console.log('VERIFY OK');

  const outDir = path.join(projectDir, '_verify-build');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(outDir, file.relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content, 'utf8');
  }
  const { exportVisualStudioProject } = await import('../src/services/windowDesigner/visualStudioProjectExporter');
  const { materializeModuleNativeDependencies } = await import('../src/services/modules/nativeDependencyService');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  const exported = await exportVisualStudioProject({ projectDir: outDir, projectId: 'op-all-capabilities-demo', generatedFiles: generated.files, enabledModules });
  fs.mkdirSync(path.join(outDir, 'resources'), { recursive: true });
  fs.copyFileSync(path.resolve(process.cwd(), '..', 'image', 'lingbuilder-ide-icon-v1.ico'), path.join(outDir, 'resources', 'lingbuilder-app.ico'));
  await materializeModuleNativeDependencies(enabledModules, { buildDir: outDir, sourceDir: outDir, binDir: path.join(outDir, 'x64', 'Release', 'bin'), exportDir: outDir, preferredTargetId: 'windows-msvc-x64' });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  const build = await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], { cwd: outDir, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 }).then(() => ({ bad: [] as string[] }), (error: { stdout?: string }) => ({ bad: String(error.stdout || '').split('\n').filter(l => /error C\d|error LNK/.test(l)) }));
  console.log('MSVC 错误:', build.bad.length);
  for (const w of build.bad.slice(0, 5)) console.log(' ', w.trim());
  const exe = path.join(outDir, 'x64', 'Release', 'bin', 'op-all-capabilities-demo.exe');
  console.log('exe:', fs.existsSync(exe) ? 'OK' : 'MISSING');
  if (build.bad.length) process.exit(1);
  console.log('BUILD CLEAN');
}
main().catch(error => { console.error('FAILED:', error instanceof Error ? error.message : error); process.exit(1); });
