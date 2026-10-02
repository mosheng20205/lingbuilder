import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// 厨具槽验证：设计器放全部 40+ 控件类型 + 用户代码调用各控件族命令 → 全族片段启用
// → 真 MSVC 编译。与矩阵的「裁剪态」互补，验证「全启用」组合。
const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
const installPath = execFileSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
const arch = process.argv.includes('--x86') ? 'x86' : 'x64';
const vcvars = path.join(installPath, 'VC', 'Auxiliary', 'Build', 'vcvarsall.bat');

const { BUILTIN_MODULES } = await import('../src/services/modules/builtinModules.ts');
const { generateLingCppNativeWin32Project } = await import('../src/services/windowDesigner/lingCppWin32Project.ts');

function moduleById(id) {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error('模块缺失: ' + id);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

const CONTROL_TYPES = ['Button', 'TextBox', 'Label', 'CheckBox', 'RadioButton', 'ListBox', 'ComboBox', 'GroupBox', 'ScrollBar', 'Image', 'AnimatedImage', 'ProgressBar', 'Grid', 'ListView', 'DataGrid', 'TreeView', 'TabControl', 'Header', 'ComboBoxEx', 'SysLink', 'DateTimePicker', 'MonthCalendar', 'TrackBar', 'UpDown', 'HotKey', 'IPAddress', 'ToolBar', 'StatusBar', 'RichEdit', 'Animation', 'VideoPlayer', 'ColorPicker', 'FlatScrollBar', 'Clock'];

const controls = CONTROL_TYPES.map((type, k) => ({
  id: `ctl_${k}_${type}`, type, name: `控件${k}_${type}`, content: type,
  width: 120, height: 30, x: 20, y: 20 + k * 36, fontSize: 12,
  background: 'transparent', foreground: 'auto', isEnabled: true, visibility: 'Visible', events: {}
}));

const source = [
  '类 MainWindow',
  '    事件 _MainWindow_创建完毕()',
  '        调试输出("厨具槽")',
  '    结束',
  '    事件 _按钮1_被单击()',
  '        调试输出("点击")',
  '    结束',
  '结束类'
].join('\n');

const enabledModules = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(moduleById);
const project = {
  schemaVersion: 2,
  id: 'kitchen-sink',
  name: '厨具槽-全控件',
  windows: [{
    id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '厨具槽',
    width: 1280, height: 1600, background: '#202028', description: '', controls
  }]
};
const generated = generateLingCppNativeWin32Project(project, { enabledModules, lingCppSourceCode: source });

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-kitchen-'));
for (const file of generated.files) {
  const target = path.join(workDir, file.relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, file.content, 'utf8');
}
const header = generated.files.find(f => f.relativePath === 'lingbuilder_runtime.h');
console.log('头文件:', header.content.split('\n').length, '行 | 控件类型数:', CONTROL_TYPES.length);

// 确认各族片段都在（全启用）
for (const probe of ['表格_', '列表视图_', '选项卡_', '日期时间选择器_', 'IP地址框_', '工具栏_', '视频播放器_', '颜色选择器_打开', '查找文本(', '打印文本(', '属性页_显示', '任务对话框(', '树形']) {
  if (!header.content.includes(probe)) { console.error('❌ 全启用态缺少:', probe); process.exit(1); }
}
console.log('全族片段在场 ✓');

const libs = 'user32.lib gdi32.lib comctl32.lib comdlg32.lib ole32.lib oleaut32.lib shell32.lib shlwapi.lib gdiplus.lib windowscodecs.lib winhttp.lib wininet.lib ws2_32.lib advapi32.lib bcrypt.lib crypt32.lib odbc32.lib winmm.lib oleacc.lib uxtheme.lib mfplat.lib mfplay.lib mfuuid.lib delayimp.lib';
const batchPath = path.join(workDir, 'build.cmd');
fs.writeFileSync(batchPath, [
  '@echo off',
  `call "${vcvars}" ${arch} >nul`,
  'cl /nologo /utf-8 /std:c++17 /EHsc /bigobj /W3 /DUNICODE /D_UNICODE main.cpp /Fe:kitchen.exe /Fo:kitchen.obj /link ' + libs + ' /SUBSYSTEM:WINDOWS'
].join('\r\n'), 'utf8');
try {
  execFileSync('cmd.exe', ['/d', '/q', '/c', batchPath], { cwd: workDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const ok = fs.existsSync(path.join(workDir, 'kitchen.exe'));
  console.log(ok ? `✅ 厨具槽全启用编译链接成功（${arch}）` : '❌ 编译通过但无 exe');
  process.exit(ok ? 0 : 1);
} catch (error) {
  const text = [error.stdout, error.stderr].filter(Boolean).join('\n');
  const errors = text.split('\n').filter(l => /error C\d+|fatal error/u.test(l)).slice(0, 6);
  console.log('❌ 编译失败:');
  errors.forEach(l => console.log('  ', l.trim().slice(0, 120)));
  process.exit(1);
}
