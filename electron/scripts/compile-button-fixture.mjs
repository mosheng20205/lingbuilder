/**
 * B2 裁剪验证：生成「一个窗口一个按钮」夹具并直接调用 MSVC 编译链接。
 * 这是裁剪正确性的真值判据——片段边界错漏会以编译错误暴露。
 *
 * 运行：cd electron && node scripts/compile-button-fixture.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = (await import('../tests/goldenFixtures.ts')).buildGoldenFixtures();
const fixture = fixtures.find(f => f.name === 'button-only');
const { generateLingCppNativeWin32Project } = await import('../src/services/windowDesigner/lingCppWin32Project.ts');

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingbuilder-trim-verify-'));
for (const file of generateLingCppNativeWin32Project(fixture.project, fixture.options).files) {
  const target = path.join(workDir, file.relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, file.content, 'utf8');
}
console.log('产物目录:', workDir);
console.log('main.cpp:', fs.readFileSync(path.join(workDir, 'main.cpp'), 'utf8').split('\n').length, '行');
console.log('lingbuilder_runtime.h:', fs.readFileSync(path.join(workDir, 'lingbuilder_runtime.h'), 'utf8').split('\n').length, '行');

// —— 定位 MSVC ——
const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
const installPath = execFileSync(vswhere, [
  '-latest', '-products', '*',
  '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
  '-property', 'installationPath'
], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
if (!installPath) throw new Error('未找到 MSVC 安装');
console.log('MSVC:', installPath);

const arch = process.argv.includes('--x86') ? 'x86' : 'x64';
const vcvars = path.join(installPath, 'VC', 'Auxiliary', 'Build', 'vcvarsall.bat');
const libs = 'user32.lib gdi32.lib comctl32.lib comdlg32.lib ole32.lib oleaut32.lib shell32.lib shlwapi.lib gdiplus.lib windowscodecs.lib winhttp.lib wininet.lib ws2_32.lib advapi32.lib bcrypt.lib crypt32.lib odbc32.lib winmm.lib oleacc.lib uxtheme.lib mfplat.lib mfplay.lib mfuuid.lib delayimp.lib';
const batchPath = path.join(workDir, 'build.cmd');
fs.writeFileSync(batchPath, [
  '@echo off',
  `call "${vcvars}" ${arch} >nul`,
  'cl /nologo /utf-8 /std:c++17 /EHsc /bigobj /W3 /DUNICODE /D_UNICODE main.cpp /Fe:trimmed-verify.exe /Fo:trimmed-verify.obj /link ' + libs + ' /SUBSYSTEM:WINDOWS'
].join('\r\n'), 'utf8');
console.log(`编译（${arch}）...`);
const output = execFileSync('cmd.exe', ['/d', '/q', '/c', batchPath], {
  cwd: workDir,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});
console.log(output.split('\n').slice(-12).join('\n'));
const exe = path.join(workDir, 'trimmed-verify.exe');
if (!fs.existsSync(exe)) throw new Error('编译产物缺失');
console.log('✅ 裁剪后产物编译链接成功:', exe, (fs.statSync(exe).size / 1024).toFixed(0) + ' KB');
