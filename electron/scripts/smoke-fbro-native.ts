import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { InstalledModule } from '../src/services/modules/types';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.join(repoRoot, '.lingbuilder-build', 'fbro-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main() {
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.fbro.browser')];
  const project: LingWindowProject = {
    id: 'fbro-native-smoke', name: 'FBro 原生冒烟测试', windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'FBro 冒烟测试',
      width: 760, height: 520, background: '#202124', description: '验证 FBro 设计器控件',
      controls: [{
        id: 'fbro-browser-1', type: 'FBroBrowser', name: 'FBro浏览器1', content: '', x: 16, y: 16,
        width: 700, height: 430, background: '#ffffff', foreground: '#000000', fontSize: 14,
        isEnabled: true, visibility: 'Visible', properties: {
          url: 'https://example.com', cacheDir: '.fbro-global-cache/profile-smoke-browser-1', enableJs: true,
          loadImages: true, enableWebGL: true, muteAudio: true, proxyMode: 'system', fingerprintProfile: ''
        }, events: { Created: 'FBro浏览器1_创建完成', LoadEnd: 'FBro浏览器1_加载完成', Error: 'FBro浏览器1_错误' }
      }]
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 FBro浏览器1_创建完成()',
      '        调试输出("FBro 已创建")',
      '        调试输出("FBro VIP 应用结果", FBro指纹_应用配置("FBro浏览器1", "{}"))',
      '        调试输出("FBro VIP 授权信息", FBro_取最近错误("FBro浏览器1"))',
      '    结束',
      '    事件 FBro浏览器1_加载完成()',
      '        调试输出(FBro_取地址("FBro浏览器1"))',
      '    结束',
      '    事件 FBro浏览器1_错误()',
      '        调试输出(FBro_取最近错误("FBro浏览器1"))',
      '    结束',
      '结束类'
    ].join('\n')
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, projectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({
    projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules
  });
  const msbuild = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe';
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], {
    cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  console.log(JSON.stringify({ ok: true, projectDir, executable }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
