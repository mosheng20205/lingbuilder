import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeNsisString,
  type InstallerInstallMode,
  generateInstallerNsi,
  normalizeInstallerVersion,
  sanitizeInstallerDisplayName,
  sanitizeInstallerFileName,
  type InstallerNsiSpec
} from '../src/services/installer/installerScriptGenerator';
import {
  collectInstallerPayloadFiles,
  exportInstallerFromManifest,
  getInstallerManifestPath,
  readInstallerBuildManifest,
  resolveBuiltIconPath,
  resolveMakensisExecutable,
  resolveVcRedistInstaller,
  writeInstallerBuildManifest,
  type InstallerBuildManifest
} from '../src/services/installer/installerExportService';

function buildSpec(overrides: Partial<InstallerNsiSpec> = {}): InstallerNsiSpec {
  return {
    appName: '库存管理',
    exeFileName: '库存管理.exe',
    version: '1.0.0',
    architecture: 'x64',
    requireAdministrator: false,
    requiresDynamicCrt: false,
    files: [
      { relativePath: '库存管理.exe', absolutePath: 'C:\\build\\bin\\库存管理.exe' },
      { relativePath: 'locales/zh-CN.pak', absolutePath: 'C:\\build\\bin\\locales\\zh-CN.pak' },
      { relativePath: 'data/config.ini', absolutePath: 'C:\\build\\bin\\data\\config.ini' }
    ],
    outputFileName: '库存管理-1.0.0-setup.exe',
    ...overrides
  };
}

test('generateInstallerNsi 基础形态：Unicode/MUI2/简体中文/文件清单/卸载清单', () => {
  const result = generateInstallerNsi(buildSpec());
  const script = result.script;
  assert.match(script, /^Unicode true/m);
  assert.match(script, /!include "MUI2\.nsh"/m);
  assert.match(script, /!insertmacro MUI_LANGUAGE "SimpChinese"/m);
  assert.match(script, /OutFile "库存管理-1\.0\.0-setup\.exe"/m);
  assert.match(script, /VIProductVersion "1\.0\.0\.0"/m);
  assert.match(script, /RequestExecutionLevel user/m);
  assert.match(script, /InstallDir "\$LOCALAPPDATA\\Programs\\\$\{APP_NAME\}"/m);
  // 文件清单：子目录先 SetOutPath 再按 /oname 落名
  assert.match(script, /SetOutPath "\$INSTDIR\\locales"/m);
  assert.match(script, /File "\/oname=zh-CN\.pak" "C:\\build\\bin\\locales\\zh-CN\.pak"/m);
  // 卸载要删每个文件并清理注册表与快捷方式
  assert.match(script, /Delete "\$INSTDIR\\locales\\zh-CN\.pak"/m);
  assert.match(script, /DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\$\{UNINSTALL_KEY\}"/m);
  assert.doesNotMatch(script, /DetailPrint "提示：本程序使用动态 CRT/);
  assert.equal(script.startsWith('\uFEFF'), false, '生成器不写 BOM，由调用方写入');
});

test('generateInstallerNsi 管理员项目与 /MD 提示', () => {
  const result = generateInstallerNsi(buildSpec({ requireAdministrator: true, requiresDynamicCrt: true }));
  assert.match(result.script, /RequestExecutionLevel admin/m);
  assert.match(result.script, /InstallDir "\$PROGRAMFILES64\\/m);
  assert.match(result.script, /WriteRegStr HKLM/m);
  assert.match(result.script, /DetailPrint "提示：本程序使用动态 CRT（\/MD）构建/);
  assert.ok(result.warnings.some(warning => warning.includes('VC++ 运行库')));
});

test('generateInstallerNsi 名称与特殊字符转义', () => {
  const result = generateInstallerNsi(buildSpec({ appName: '我的"应用"$1', exeFileName: 'app$v2.exe' }));
  const script = result.script;
  // 显示名先清洗引号/换行，再把 $ 转义成 $$（$ 混入名称时不得破坏 NSIS define）
  assert.match(script, /!define APP_NAME "我的 应用 [$][$]1"/m);
  assert.match(script, /!define APP_EXE "app[$][$]v2\.exe"/m);
  assert.match(script, /Name "我的 应用 [$][$]1"/m);
});

test('generateInstallerNsi 空文件清单直接中文报错', () => {
  assert.throws(() => generateInstallerNsi(buildSpec({ files: [] })), /请先成功构建/);
});

test('sanitizeInstallerFileName 剥离路径与非法字符并补扩展名', () => {
  assert.equal(sanitizeInstallerFileName('..\\..\\evil app?.exe', 'setup', '.exe'), 'evil app.exe');
  assert.equal(sanitizeInstallerFileName('我的安装包', 'setup', '.exe'), '我的安装包.exe');
  assert.equal(sanitizeInstallerDisplayName('  我 的\n应用 "X" '), '我 的 应用 X');
});

test('normalizeInstallerVersion 规范为四段数字', () => {
  assert.equal(normalizeInstallerVersion('2.1'), '2.1.0.0');
  assert.equal(normalizeInstallerVersion('1.2.3'), '1.2.3.0');
  assert.equal(normalizeInstallerVersion('1.2.3.4.5'), '1.2.3.4');
  assert.equal(normalizeInstallerVersion('随便'), '1.0.0.0');
  assert.equal(normalizeInstallerVersion(''), '1.0.0.0');
});

async function makeTempDir(prefix: string): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function buildManifest(buildDir: string, overrides: Partial<InstallerBuildManifest> = {}): InstallerBuildManifest {
  return {
    schemaVersion: 1,
    projectId: 'demo-project',
    projectName: '库存管理',
    outputFileName: '库存管理.exe',
    buildDir,
    binDir: path.join(buildDir, 'bin'),
    architecture: 'x64',
    buildMode: 'Debug',
    requireAdministrator: false,
    requiresDynamicCrt: true,
    outputType: 'exe',
    builtAt: '2026-10-12T00:00:00.000Z',
    ...overrides
  };
}

test('安装包清单写读回环；损坏与异版本返回 null', async () => {
  const buildDir = await makeTempDir('lb-installer-manifest-');
  try {
    await writeInstallerBuildManifest(buildDir, buildManifest(buildDir));
    const manifest = await readInstallerBuildManifest(buildDir);
    assert.ok(manifest);
    assert.equal(manifest.projectName, '库存管理');
    assert.equal(getInstallerManifestPath(buildDir).endsWith('installer-build-manifest.json'), true);
    await fs.writeFile(getInstallerManifestPath(buildDir), '{broken', 'utf8');
    assert.equal(await readInstallerBuildManifest(buildDir), null);
    await writeInstallerBuildManifest(buildDir, { ...buildManifest(buildDir), schemaVersion: 99 } as InstallerBuildManifest);
    assert.equal(await readInstallerBuildManifest(buildDir), null);
  } finally {
    await fs.rm(buildDir, { recursive: true, force: true });
  }
});

test('collectInstallerPayloadFiles 递归收集并排序', async () => {
  const buildDir = await makeTempDir('lb-installer-collect-');
  try {
    const binDir = path.join(buildDir, 'bin');
    await fs.mkdir(path.join(binDir, 'locales'), { recursive: true });
    await fs.writeFile(path.join(binDir, 'app.exe'), 'exe');
    await fs.writeFile(path.join(binDir, 'locales', 'zh-CN.pak'), 'pak');
    const collection = await collectInstallerPayloadFiles(binDir);
    assert.deepEqual(collection.files.map(file => file.relativePath), ['app.exe', 'locales/zh-CN.pak']);
    assert.equal(collection.totalBytes, 6);
  } finally {
    await fs.rm(buildDir, { recursive: true, force: true });
  }
});

test('exportInstallerFromManifest 缺主程序给中文指引', async () => {
  const buildDir = await makeTempDir('lb-installer-missing-');
  try {
    await fs.mkdir(path.join(buildDir, 'bin'), { recursive: true });
    const result = await exportInstallerFromManifest({ manifest: buildManifest(buildDir), makensisPath: 'X:\\none\\makensis.exe' });
    assert.equal(result.ok, false);
    assert.match(result.error || '', /请重新构建本项目后再导出安装包/);
  } finally {
    await fs.rm(buildDir, { recursive: true, force: true });
  }
});

test('exportInstallerFromManifest 端到端（注入 makensis 桩）', async () => {
  const buildDir = await makeTempDir('lb-installer-e2e-');
  try {
    const binDir = path.join(buildDir, 'bin');
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(path.join(binDir, '库存管理.exe'), 'MZ');
    const manifest = buildManifest(buildDir, { installerVersion: '2.5' });
    // 规范化后的版本进文件名与响应（2.5 → 2.5.0.0）
    const scripts: string[] = [];
    const result = await exportInstallerFromManifest({
      manifest,
      runMakensis: async scriptPath => {
        scripts.push(await fs.readFile(scriptPath, 'utf8'));
        // 模拟 makensis 在脚本目录产出 OutFile。
        await fs.writeFile(path.join(buildDir, 'installer', '库存管理-2.5.0.0-setup.exe'), 'setup-bytes');
        return { stdout: 'Output: ok', stderr: '' };
      }
    });
    assert.equal(result.ok, true);
    assert.equal(result.version, '2.5.0.0', '未显式传版本时沿用清单 installerVersion 并规范为四段');
    assert.equal(result.fileCount, 1);
    assert.ok(result.installerPath && result.installerPath.includes('installer'));
    assert.equal(result.requiresVcRedist, true);
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].startsWith('\uFEFF'), true, '.nsi 必须带 UTF-8 BOM');
    assert.match(scripts[0], /OutFile "库存管理-2\.5\.0\.0-setup\.exe"/);
    // 回写版本记忆
    const updated = await readInstallerBuildManifest(buildDir);
    assert.equal(updated?.installerVersion, '2.5.0.0');
  } finally {
    await fs.rm(buildDir, { recursive: true, force: true });
  }
});

test('exportInstallerFromManifest makensis 失败回传输出', async () => {
  const buildDir = await makeTempDir('lb-installer-fail-');
  try {
    const binDir = path.join(buildDir, 'bin');
    await fs.mkdir(binDir, { recursive: true });
    const manifest = buildManifest(buildDir, { projectName: 'app' });
    await fs.writeFile(path.join(binDir, manifest.outputFileName), 'MZ');
    const result = await exportInstallerFromManifest({
      manifest,
      version: '1.0',
      runMakensis: async () => {
        throw Object.assign(new Error('Command failed: makensis'), { stderr: Buffer.from('Processing config: error') });
      }
    });
    assert.equal(result.ok, false);
    assert.match(result.error || '', /NSIS 编译失败/);
    assert.match(result.error || '', /error/);
    assert.equal(result.version, undefined);
  } finally {
    await fs.rm(buildDir, { recursive: true, force: true });
  }
});

test('resolveMakensisExecutable 环境变量与显式候选优先', async () => {
  const dir = await makeTempDir('lb-installer-nsis-');
  try {
    await fs.writeFile(path.join(dir, 'makensis.exe'), 'stub');
    const viaEnv = await resolveMakensisExecutable({ env: { LINGBUILDER_NSIS_PATH: dir } as NodeJS.ProcessEnv });
    assert.equal(viaEnv.toLowerCase(), path.join(dir, 'makensis.exe').toLowerCase());
    const viaCandidate = await resolveMakensisExecutable({ env: {} as NodeJS.ProcessEnv, candidates: [path.join(dir, 'makensis.exe')] });
    assert.ok(viaCandidate.toLowerCase().endsWith('makensis.exe'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('resolveMakensisExecutable 找不到时给中文修法', async () => {
  await assert.rejects(
    () => resolveMakensisExecutable({ env: { LINGBUILDER_NSIS_PATH: '', LOCALAPPDATA: '' } as NodeJS.ProcessEnv, candidates: ['Z:\\nope\\makensis.exe'] }),
    /LINGBUILDER_NSIS_PATH/
  );
});

test('generateInstallerNsi 项目图标写入 MUI_ICON/MUI_UNICON', () => {
  const result = generateInstallerNsi(buildSpec({ iconPath: 'C:\\icons\\lingbuilder-app.ico' }));
  assert.match(result.script, /!define MUI_ICON "C:\\icons\\lingbuilder-app[.]ico"/m);
  assert.match(result.script, /!define MUI_UNICON "C:\\icons\\lingbuilder-app[.]ico"/m);
});

test('generateInstallerNsi 捆绑 VC++ 运行库：File+注册表检测+ExecWait+装完删包，且不再出通用 /MD 提示', () => {
  const BS = String.fromCharCode(92);
  const result = generateInstallerNsi(buildSpec({
    requiresDynamicCrt: true,
    bundleVcRedist: { fileName: 'vc_redist.x64.exe', absolutePath: 'C:\\cache\\vc_redist.x64.exe', architecture: 'x64' }
  }));
  const script = result.script;
  assert.ok(script.includes('File "/oname=vc_redist.x64.exe" "C:\\cache\\vc_redist.x64.exe"'), script);
  assert.ok(script.includes(`ReadRegDWORD $0 HKLM "SOFTWARE${BS}Microsoft${BS}VisualStudio${BS}14.0${BS}VC${BS}Runtimes${BS}x64" "Installed"`), script);
  assert.ok(script.includes(`ExecWait '"$INSTDIR${BS}vc_redist.x64.exe" /install /quiet /norestart' $0`), script);
  assert.ok(script.includes(`Delete "$INSTDIR${BS}vc_redist.x64.exe"`), script);
  assert.match(script, /IntCmpU \$0 3010 vc_redist_reboot/m);
  assert.ok(!script.includes('提示：本程序使用动态 CRT'), script);
});

test('generateInstallerNsi 安装目录策略三态', () => {
  const perUser = generateInstallerNsi(buildSpec({ requireAdministrator: true, installMode: 'perUser' }));
  assert.match(perUser.script, /RequestExecutionLevel user/m);
  assert.match(perUser.script, /InstallDir "\$LOCALAPPDATA/m);
  assert.match(perUser.script, /WriteRegStr HKCU/m);
  assert.ok(perUser.warnings.some(warning => warning.includes('仅当前用户')));

  const perMachine = generateInstallerNsi(buildSpec({ requireAdministrator: false, installMode: 'perMachine' }));
  assert.match(perMachine.script, /RequestExecutionLevel admin/m);
  assert.match(perMachine.script, /InstallDir "\$PROGRAMFILES64/m);
  assert.match(perMachine.script, /WriteRegStr HKLM/m);
  assert.ok(perMachine.warnings.some(warning => warning.includes('安装到所有用户')));

  const auto = generateInstallerNsi(buildSpec({ requireAdministrator: true, installMode: 'auto' }));
  assert.match(auto.script, /RequestExecutionLevel admin/m);
  assert.equal(auto.warnings.some(warning => warning.includes('策略')), false);
});

test('resolveVcRedistInstaller 环境变量目录与用户缓存命中', async () => {
  const root = await makeTempDir('lb-redist-root-');
  try {
    const cacheDir = path.join(root, 'LingBuilder', 'vc-redist');
    await fs.mkdir(cacheDir, { recursive: true });
    const exe = path.join(cacheDir, 'vc_redist.x64.exe');
    await fs.writeFile(exe, Buffer.alloc(2 * 1024 * 1024, 1));
    const viaEnv = await resolveVcRedistInstaller('x64', { env: { LINGBUILDER_VC_REDIST_DIR: cacheDir } as NodeJS.ProcessEnv });
    assert.equal(viaEnv, exe);
    const viaCache = await resolveVcRedistInstaller('x64', { env: { LOCALAPPDATA: root } as NodeJS.ProcessEnv });
    assert.equal(viaCache, exe);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('resolveVcRedistInstaller 缓存缺失时自动下载并落缓存', async () => {
  const root = await makeTempDir('lb-redist-dl-');
  try {
    const payload = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2 * 1024 * 1024, 7)]);
    const arrayBuffer = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
    const result = await resolveVcRedistInstaller('x86', {
      env: { LOCALAPPDATA: root } as NodeJS.ProcessEnv,
      fetchImpl: (async () => ({ ok: true, status: 200, arrayBuffer: async () => arrayBuffer })) as unknown as typeof fetch
    });
    assert.equal(result, path.join(root, 'LingBuilder', 'vc-redist', 'vc_redist.x86.exe'));
    assert.equal((await fs.stat(result)).size, payload.byteLength);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('resolveVcRedistInstaller 下载失败给中文修法（含手动地址与环境变量）', async () => {
  const root = await makeTempDir('lb-redist-fail-');
  try {
    await assert.rejects(
      () => resolveVcRedistInstaller('x64', {
        env: { LOCALAPPDATA: root } as NodeJS.ProcessEnv,
        fetchImpl: (async () => ({ ok: false, status: 403 })) as unknown as typeof fetch
      }),
      /LINGBUILDER_VC_REDIST_DIR/
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('resolveBuiltIconPath 从构建图标列表取 buildDir 下那份', () => {
  const buildDir = 'C:' + path.sep + 'b';
  const expected = path.join(buildDir, 'resources', 'lingbuilder-app.ico');
  const hit = resolveBuiltIconPath(buildDir, [
    path.join(buildDir, 'src', 'resources', 'lingbuilder-app.ico'),
    expected
  ]);
  assert.equal(hit, expected);
  assert.equal(resolveBuiltIconPath(buildDir, [path.join(buildDir, 'elsewhere', 'x.ico')]), undefined);
});

test('exportInstallerFromManifest 透传二期选项（图标+运行库+目录策略）', async () => {
  const buildDir = await makeTempDir('lb-installer-opt-');
  try {
    const binDir = path.join(buildDir, 'bin');
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(path.join(binDir, 'app.exe'), 'MZ');
    const iconPath = path.join(buildDir, 'resources', 'lingbuilder-app.ico');
    await fs.mkdir(path.dirname(iconPath), { recursive: true });
    await fs.writeFile(iconPath, 'ico-bytes');
    const manifest = buildManifest(buildDir, { projectName: 'app', outputFileName: 'app.exe', iconPath, requiresDynamicCrt: true });
    const scripts: string[] = [];
    const result = await exportInstallerFromManifest({
      manifest,
      version: '2.0',
      useProjectIcon: true,
      bundleVcRedist: true,
      installMode: 'perMachine',
      makensisPath: 'X:',
      runMakensis: async scriptPath => {
        scripts.push(await fs.readFile(scriptPath, 'utf8'));
        await fs.writeFile(path.join(buildDir, 'installer', 'app-2.0.0.0-setup.exe'), 'setup');
        return { stdout: '', stderr: '' };
      },
      resolveVcRedist: async () => {
        const redist = path.join(buildDir, 'vc_redist.x64.exe');
        await fs.writeFile(redist, 'MZ-redist');
        return redist;
      }
    });
    assert.equal(result.ok, true, result.error || '');
    assert.equal(scripts.length, 1);
    assert.ok(scripts[0].includes('!define MUI_ICON'), scripts[0]);
    assert.ok(scripts[0].includes('vc_redist.x64.exe'), scripts[0]);
    assert.match(scripts[0], /RequestExecutionLevel admin/m);
    assert.equal(result.requiresVcRedist, false, '捆绑后目标机器不再需要预装运行库');
  } finally {
    await fs.rm(buildDir, { recursive: true, force: true });
  }
});
