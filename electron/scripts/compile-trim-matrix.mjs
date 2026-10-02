/**
 * B2 裁剪矩阵验证：对「无模块 / edgeview / fbro / cef3 / edgeview+fbro / 三模块全开」
 * 六种启用组合各生成「一个窗口一个按钮」产物并逐一调用 MSVC 编译链接。
 * 裁剪片段的语法完整性（守卫配平、else-if 链、OnWindowCreated 调用列表）以编译为真值。
 *
 * 运行：cd electron && node --import tsx scripts/compile-trim-matrix.mjs [--x86]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { buildGoldenFixtures, builtinModulesByIds } = await import('../tests/goldenFixtures.ts').then(m => m).catch(async () => await import('../tests/goldenFixtures.mjs'));

const fixturesMod = await import('../tests/goldenFixtures.ts');
const fixtures = fixturesMod.buildGoldenFixtures();
const buttonFixture = JSON.parse(JSON.stringify(fixtures.find(f => f.name === 'button-only')));
const { generateLingCppNativeWin32Project } = await import('../src/services/windowDesigner/lingCppWin32Project.ts');
const { BUILTIN_MODULES } = await import('../src/services/modules/builtinModules.ts');

function modulesByIds(ids) {
  return ids
    .map(id => BUILTIN_MODULES.find(item => item.id === id))
    .filter(Boolean)
    .map(module => ({
      manifest: module,
      installPath: `builtin://${module.id}`,
      isBuiltin: true,
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    }));
}

const combinations = [
  { name: '无模块', ids: [] },
  { name: 'lingbuilder-3真实组合', ids: ['lingbuilder.win32.basic', 'lingbuilder.std.buffer', 'lingbuilder.advanced.process-memory'] },
  { name: 'edgeview', ids: ['lingbuilder.edgeview'] },
  { name: 'fbro', ids: ['lingbuilder.fbro.browser'] },
  { name: 'cef3(单文件)', ids: ['lingbuilder.cef3.browser'] },
  { name: 'edgeview+fbro', ids: ['lingbuilder.edgeview', 'lingbuilder.fbro.browser'] },
  { name: '三浏览器全开', ids: ['lingbuilder.edgeview', 'lingbuilder.fbro.browser', 'lingbuilder.cef3.browser'] }
];

const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
const installPath = execFileSync(vswhere, [
  '-latest', '-products', '*',
  '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
  '-property', 'installationPath'
], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
const arch = process.argv.includes('--x86') ? 'x86' : 'x64';
const vcvars = path.join(installPath, 'VC', 'Auxiliary', 'Build', 'vcvarsall.bat');
const libs = 'user32.lib gdi32.lib comctl32.lib comdlg32.lib ole32.lib oleaut32.lib shell32.lib shlwapi.lib gdiplus.lib windowscodecs.lib winhttp.lib wininet.lib ws2_32.lib advapi32.lib bcrypt.lib crypt32.lib odbc32.lib winmm.lib oleacc.lib uxtheme.lib mfplat.lib mfplay.lib mfuuid.lib delayimp.lib';

// 开发工作区自带的浏览器 SDK（真实构建经模块清单注入等价 /I 与 lib）
const devModulesDir = path.join(ROOT, '..', '.lingbuilder', 'modules');
const sdkDirs = {
  fbro: {
    includes: [path.join(devModulesDir, 'lingbuilder.fbro.sdk', 'sdk', 'include')],
    libs: [path.join(devModulesDir, 'lingbuilder.fbro.sdk', 'sdk', 'lib', arch === 'x86' ? 'Win32' : 'x64', 'LingBuilderFbroBridge.lib')]
  },
  cef3: {
    includes: [path.join(devModulesDir, 'lingbuilder.cef3.sdk', 'sdk', 'include'), path.join(devModulesDir, 'lingbuilder.cef3.sdk', 'sdk', 'bridge', arch === 'x86' ? 'Win32' : 'x64')],
    libs: [path.join(devModulesDir, 'lingbuilder.cef3.sdk', 'sdk', 'bridge', arch === 'x86' ? 'Win32' : 'x64', 'LingBuilderCefBridge.lib')]
  }
};

const results = [];
for (const combo of combinations) {
  // FBro/CEF3 仅支持 x64（vcxproj 内有 ValidateFbroArchitecture 构建阻断；CEF3 桥同为 x64 专用），x86 口径跳过。
  if (arch === 'x86' && (combo.ids.includes('lingbuilder.fbro.browser') || combo.ids.includes('lingbuilder.cef3.browser'))) {
    results.push({ name: combo.name + '（按设计跳过：仅x64）', ok: true, headerLines: 0, detail: '浏览器模块不支持 Win32，真实构建会先行阻断' });
    continue;
  }
  const options = { ...buttonFixture.options };
  if (combo.ids.length) options.enabledModules = modulesByIds(combo.ids);
  const generated = generateLingCppNativeWin32Project(buttonFixture.project, options);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingbuilder-trim-matrix-'));
  for (const file of generated.files) {
    const target = path.join(workDir, file.relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content, 'utf8');
  }
  const headerLines = generated.files.find(f => f.relativePath === 'lingbuilder_runtime.h')?.content.split('\n').length ?? 0;
  const includeArgs = combo.ids.flatMap(id => {
    if (id === 'lingbuilder.fbro.browser') return sdkDirs.fbro.includes.map(dir => '/I"' + dir + '"');
    if (id === 'lingbuilder.cef3.browser') return sdkDirs.cef3.includes.map(dir => '/I"' + dir + '"');
    return [];
  });
  const extraLibs = combo.ids.flatMap(id => {
    if (id === 'lingbuilder.fbro.browser') return sdkDirs.fbro.libs;
    if (id === 'lingbuilder.cef3.browser') return sdkDirs.cef3.libs;
    return [];
  }).map(file => '"' + file + '"').join(' ');
  fs.writeFileSync(path.join(workDir, 'build.cmd'), [
    '@echo off',
    `call "${vcvars}" ${arch} >nul`,
    'cl /nologo /utf-8 /std:c++17 /EHsc /bigobj /W3 /DUNICODE /D_UNICODE main.cpp /Fe:verify.exe /Fo:verify.obj ' + includeArgs.join(' ') + ' /link ' + libs + ' ' + extraLibs + ' /SUBSYSTEM:WINDOWS'
  ].join('\r\n'), 'utf8');
  try {
    execFileSync('cmd.exe', ['/d', '/q', '/c', path.join(workDir, 'build.cmd')], { cwd: workDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const ok = fs.existsSync(path.join(workDir, 'verify.exe'));
    results.push({ name: combo.name, ok, headerLines, detail: ok ? '' : '编译通过但未产出 exe' });
  } catch (error) {
    const text = [error.stdout, error.stderr].filter(Boolean).join('\n');
    const errors = text.split('\n').filter(l => /error C\d+/u.test(l)).slice(0, 3);
    results.push({ name: combo.name, ok: false, headerLines, detail: errors.join(' | ') || '未知编译失败' });
  }
}

console.log(`\n裁剪矩阵（${arch}）：`);
let allOk = true;
for (const r of results) {
  if (!r.ok) allOk = false;
  console.log(`  ${r.ok ? '✅' : '❌'} ${r.name.padEnd(14)} 头文件 ${String(r.headerLines).padStart(6)} 行 ${r.detail}`);
}
console.log(allOk ? '\n全部组合编译链接通过' : '\n存在失败组合');
process.exit(allOk ? 0 : 1);
