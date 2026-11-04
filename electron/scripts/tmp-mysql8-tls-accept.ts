// MySQL 8 真机三场景验收（临时脚本，验收后可删）：用 docker 起的原生 MySQL 8（自签名证书）验证
// database.mysql 1.1.0 的 TLS 证书校验三档语义：
//   场景① MySQL_连接（不强制 TLS、不校验）→ 直连成功
//   场景② MySQL_连接扩展(…, 真, 假) → 强制 TLS 且跳过链校验 → 连接成功且 Ssl_cipher 非空（加密真实生效）
//   场景③ MySQL_连接扩展(…, 真, 真) → 强制 TLS 且校验证书链 → 连接失败且错误码 2026、错误含 NOT trusted（复现用户报错，证明开关有效）
// 用法：docker run -d --name lb-mysql8-accept -p 13307:3306 -e MYSQL_ROOT_PASSWORD=... -e MYSQL_DATABASE=test mysql:8.0
//       LINGBUILDER_MYSQL8_PORT=13307 LINGBUILDER_MYSQL8_PASSWORD=... npx tsx scripts/tmp-mysql8-tls-accept.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.join(repoRoot, '.lingbuilder-build', 'mysql8-tls-accept');

const acceptHost = process.env.LINGBUILDER_MYSQL8_HOST || '127.0.0.1';
const acceptPort = Number(process.env.LINGBUILDER_MYSQL8_PORT || '13307');
const acceptUser = process.env.LINGBUILDER_MYSQL8_USER || 'root';
const acceptPassword = process.env.LINGBUILDER_MYSQL8_PASSWORD || '';
const acceptDatabase = process.env.LINGBUILDER_MYSQL8_DATABASE || 'test';

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function removeDirectoryWithRetry(target: string, attempts = 8, delayMilliseconds = 10_000): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await fs.rm(target, { recursive: true, force: true });
      await fs.access(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    }
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, delayMilliseconds));
  }
  throw new Error(`无法删除被占用的验收目录：${target}。请关闭占用该目录的程序后重试。`);
}

async function findMsBuild(): Promise<string> {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, [
    '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  return path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
}

async function installedToolset(msbuild: string): Promise<string | undefined> {
  const vcRoot = path.join(path.dirname(msbuild), '..', '..', 'Microsoft', 'VC');
  const versions = (await fs.readdir(vcRoot).catch(() => [])).filter(name => /^v\d+$/.test(name)).sort().reverse();
  for (const version of versions) {
    const toolsets = (await fs.readdir(path.join(vcRoot, version, 'Platforms', 'x64', 'PlatformToolsets')).catch(() => []))
      .filter(name => /^v\d+$/.test(name)).sort();
    if (toolsets.length) return toolsets[toolsets.length - 1];
  }
  return undefined;
}

function createSource(): string {
  const connect = `MySQL_连接(L"${acceptHost}", ${acceptPort}, L"${acceptUser}", L"${acceptPassword}", dbName.c_str())`;
  const connectExt = (verify: boolean) =>
    `MySQL_连接扩展(L"${acceptHost}", ${acceptPort}, L"${acceptUser}", L"${acceptPassword}", dbName.c_str(), 15, true, ${verify ? 'true' : 'false'})`;
  return [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    `        @ const std::wstring dbName = L"${acceptDatabase}";`,
    '        @ bool ok = true; std::wstring failStep; std::wstring lastErr; unsigned int lastCode = 0; std::wstring cipher;',
    '        @ std::wstring reportLines;',
    '        @ auto Note = [&](const wchar_t* name, bool condition) { lastErr = MySQL_取错误(); lastCode = MySQL_取错误码(); if (!condition && failStep.empty()) failStep = name; ok = ok && condition; reportLines += std::wstring(name) + L"|" + (condition ? L"PASS" : L"FAIL") + L"|" + lastErr + L"|" + std::to_wstring(lastCode) + L"\\n"; return condition; };',
    '        @ long long plain = 0; long long tlsNoVerify = 0; long long tlsVerify = 0;',
    `        @ Note(L"load_runtime", MySQL_加载运行库(L"libmariadb.dll"));`,
    // 场景①：MySQL_连接 = 不强制 TLS、不校验证书 → 原生 MySQL 8（自签名证书、默认 require_secure_transport=OFF）必须直连成功
    `        @ plain = ${connect};`,
    `        @ Note(L"s1_plain_connect", plain != 0);`,
    `        @ Note(L"s1_server_info", plain == 0 || !std::wstring(MySQL_取服务器信息(plain)).empty());`,
    `        @ Note(L"s1_close", plain == 0 || MySQL_关闭连接(plain));`,
    // 场景②：强制 TLS + SSL证书校验=假 → 连接成功即证明 TLS 已真实建立；再以 performance_schema 的 Ssl_cipher 正向验证（MySQL 8 无 information_schema.SESSION_STATUS）
    `        @ tlsNoVerify = ${connectExt(false)};`,
    `        @ Note(L"s2_tls_noverify_connect", tlsNoVerify != 0);`,
    `        @ cipher = tlsNoVerify ? std::wstring(MySQL_查询首值(tlsNoVerify, L"SELECT VARIABLE_VALUE FROM performance_schema.session_status WHERE VARIABLE_NAME = 'Ssl_cipher'")) : L"";`,
    `        @ Note(L"s2_ssl_cipher_nonempty", !cipher.empty());`,
    `        @ Note(L"s2_close", tlsNoVerify == 0 || MySQL_关闭连接(tlsNoVerify));`,
    // 场景③：强制 TLS + SSL证书校验=真 → 必须失败：错误码 2026、错误含 NOT trusted（= 用户报错原样复现，开关有效）。
    // 注意：Connector/C 对 localhost/127.0.0.1/::1（本地连接）且未提供 CA 时不强制信任链（my_auth.c is_local_connection
    // 豁免），因此本场景刻意用 127.0.0.2（同为回环、同端口可连，但不在本地豁免名单内）——与用户「远程 MySQL 8 自签名
    // 证书报 2026」的真实路径同一判定分支。
    `        @ tlsVerify = MySQL_连接扩展(L"127.0.0.2", ${acceptPort}, L"${acceptUser}", L"${acceptPassword}", dbName.c_str(), 15, true, true);`,
    `        @ lastErr = MySQL_取错误(); lastCode = MySQL_取错误码();`,
    `        @ std::wstring s3Lower; for (auto ch : lastErr) s3Lower += (wchar_t)tolower(ch);`,
    `        @ Note(L"s3_verify_rejected_2026", tlsVerify == 0 && lastCode == 2026 && (s3Lower.find(L"not trusted") != std::wstring::npos || s3Lower.find(L"untrustedroot") != std::wstring::npos));`,
    `        @ Note(L"unload_runtime", MySQL_卸载运行库());`,
    `        @ std::ofstream report("mysql8-accept-result.txt", std::ios::binary | std::ios::trunc);`,
    `        @ report << (ok ? "OK" : "FAIL") << "\\n" << LB_WideToUtf8(failStep.c_str()) << "\\n" << LB_WideToUtf8(cipher.c_str()) << "\\n" << LB_WideToUtf8(reportLines.c_str());`,
    `        @ ExitProcess(ok ? 0 : 2);`,
    '    结束',
    '结束类'
  ].join('\n');
}

async function main(): Promise<void> {
  if (!acceptPassword) throw new Error('缺少 LINGBUILDER_MYSQL8_PASSWORD。');
  const mariadbDll = path.join(repoRoot, 'electron', 'third_party', 'mariadb', 'x64', 'libmariadb.dll');
  await fs.access(mariadbDll);
  const enabledModules = [builtin('lingbuilder.database.mysql')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'mysql8-tls-accept',
    name: 'MySQL 8 TLS 三场景验收',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'MySQL 8 TLS 三场景验收',
      width: 420, height: 180, background: '#202028', description: '验证 MySQL 1.1.0 TLS 证书校验三档语义', controls: []
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: createSource(),
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  const mainCpp = generated.files
    .filter(file => file.relativePath === 'lingbuilder_runtime.h' || file.relativePath === 'main.cpp')
    .map(file => file.content)
    .join('\n');
  for (const required of [
    'namespace LingBuilderMysql',
    'long long MySQL_连接扩展(const wchar_t* host, int port, const wchar_t* user, const wchar_t* password, const wchar_t* database, int timeoutSeconds, bool enableSsl, bool verifyCert = true)',
    'OptSslVerifyServerCert = 21'
  ]) {
    if (!mainCpp.includes(required)) throw new Error(`生成的 MySQL C++ 缺少：${required}`);
  }

  await removeDirectoryWithRetry(projectDir);
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
  await fs.copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'), path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  await exportModuleNativeDependencies(enabledModules, projectDir);
  await fs.access(path.join(projectDir, 'modules', 'lingbuilder.database.mysql', 'x64', 'libmariadb.dll'));

  const msbuild = await findMsBuild();
  const toolset = await installedToolset(msbuild);
  await execFileAsync(msbuild, [
    exported.solutionPath, '/m', '/nodeReuse:false', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64',
    ...(toolset ? [`/p:PlatformToolset=${toolset}`] : []), '/v:minimal'
  ], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });

  const executableDir = path.join(projectDir, 'x64', 'Release', 'bin');
  const executable = path.join(executableDir, `${exported.projectName}.exe`);
  await fs.access(path.join(executableDir, 'libmariadb.dll'));
  await fs.rm(path.join(executableDir, 'mysql8-accept-result.txt'), { force: true });
  try {
    await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 2 * 60 * 1000, maxBuffer: 1024 * 1024 });
  } catch {
    // 退出码非 0 时仍然读取结果文件，把失败步给出来。
  }
  const report = await fs.readFile(path.join(executableDir, 'mysql8-accept-result.txt'), 'utf8');
  const lines = report.split('\n');
  if (lines[0]?.trim() !== 'OK') {
    throw new Error(`MySQL 8 三场景验收失败：\n${report}`);
  }
  const scenarioResults: Record<string, string> = {};
  for (const line of lines.slice(3)) {
    const [name, verdict] = line.split('|');
    if (name && verdict) scenarioResults[name] = verdict;
  }
  console.log(JSON.stringify({
    ok: true,
    server: `${acceptHost}:${acceptPort}/${acceptDatabase}`,
    scenarios: {
      '① MySQL_连接 直连（不强制TLS/不校验）': scenarioResults['s1_plain_connect'] === 'PASS' ? 'PASS' : scenarioResults,
      '② 连接扩展(启用SSL=真, SSL证书校验=假) 强制TLS连接 + Ssl_cipher': `PASS（Ssl_cipher=${(lines[2] || '').trim()}）`,
      '③ 连接扩展(启用SSL=真, SSL证书校验=真) 复现2026拒绝': 'PASS'
    },
    detail: lines.slice(3).filter(Boolean),
    projectDir
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
