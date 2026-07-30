import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'datagrid-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('DataGrid 冒烟测试目录越出工作区。');
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.win32.common-controls')];
  const project: LingWindowProject = {
    schemaVersion: 2, id: 'datagrid-native-smoke', name: 'DataGrid 原生冒烟测试',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'DataGrid 原生冒烟测试',
      width: 900, height: 560, background: '#202028', description: '验证强类型列和按钮事件',
      controls: [{
        id: 'orders', type: 'DataGrid', name: '订单表格', content: '', x: 20, y: 20, width: 820, height: 440,
        fontSize: 12, background: '#0F172A', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible',
        properties: {
          dataGridSchemaVersion: 1, selectionMode: 'cell', emptyText: '暂无订单', virtualMode: false, virtualRowCount: 0,
          headerHeight: 34, itemHeight: 36, borderColor: '#475569', borderWidth: 1,
          dataGridColumns: [
            { id: 'selected', title: '选择', type: 'checkbox', width: 70, threeState: true },
            { id: 'image', title: '图片', type: 'image', width: 90, imageMode: 'contain' },
            { id: 'name', title: '订单', type: 'text', width: 170 },
            { id: 'status', title: '状态', type: 'combo', width: 130, options: [{ value: 'new', label: '新订单' }, { value: 'done', label: '已完成' }] },
            { id: 'enabled', title: '启用', type: 'switch', width: 90, onText: '启用', offText: '停用' },
            { id: 'progress', title: '进度', type: 'progress', width: 130, progressMinimum: 0, progressMaximum: 100 },
            { id: 'actions', title: '操作', type: 'buttons', width: 210, buttons: [{ id: 'view', text: '查看', style: 'primary' }, { id: 'edit', text: '编辑', style: 'normal' }, { id: 'delete', text: '删除', style: 'danger' }] }
          ],
          dataGridRows: [
            { key: 'order-1001', enabled: true, cells: { selected: true, image: '', name: '订单 1001', status: 'new', enabled: true, progress: 35, actions: '' } },
            { key: 'order-1002', enabled: true, cells: { selected: false, image: '', name: '订单 1002', status: 'done', enabled: false, progress: 100, actions: '' } }
          ]
        },
        events: { CellButtonClick: '订单表格_按钮点击' }
      }]
    }]
  };
  const source = [
    '类 MainWindow',
    '    事件 订单表格_按钮点击()',
    '        调试输出(表格_取事件行键("订单表格"), ":", 表格_取事件按钮ID("订单表格"))',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(project, { enabledModules, lingCppSourceCode: source });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, projectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  const child = spawn(executable, [], { cwd: path.dirname(executable), windowsHide: true, stdio: 'ignore' });
  await new Promise(resolve => setTimeout(resolve, 3000));
  if (child.exitCode !== null) throw new Error(`DataGrid 冒烟程序提前退出，代码 ${child.exitCode}。`);
  child.kill();
  console.log(JSON.stringify({ ok: true, projectDir, executable, survivedMilliseconds: 3000 }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
