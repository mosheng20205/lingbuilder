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
const projectDir = path.join(repoRoot, '.lingbuilder-build', 'mysql-native-smoke');

const smokeHost = process.env.LINGBUILDER_MYSQL_SMOKE_HOST || '127.0.0.1';
const smokePort = Number(process.env.LINGBUILDER_MYSQL_SMOKE_PORT || '3306');
const smokeUser = process.env.LINGBUILDER_MYSQL_SMOKE_USER || 'root';
const smokePassword = process.env.LINGBUILDER_MYSQL_SMOKE_PASSWORD || '';
const smokeDatabase = process.env.LINGBUILDER_MYSQL_SMOKE_DATABASE || 'test';

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main(): Promise<void> {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('MySQL smoke 目录越出工作区。');
  const mariadbDll = path.join(repoRoot, 'electron', 'third_party', 'mariadb', 'x64', 'libmariadb.dll');
  await fs.access(mariadbDll);
  const enabledModules = [builtin('lingbuilder.database.mysql')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'mysql-native-smoke',
    name: 'MySQL 模块原生冒烟测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'MySQL 模块原生冒烟测试',
      width: 420, height: 180, background: '#202028', description: '验证 MySQL 1.0 运行时', controls: []
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: createSource(),
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const required of [
    'namespace LingBuilderMysql',
    'long long MySQL_连接',
    'long long MySQL_连接扩展',
    'long long MySQL_准备',
    'int MySQL_语句步进',
    'std::vector<unsigned char> MySQL_取列字节集',
    'bool MySQL_开始事务',
    'LoadLibraryW(path && path[0] ? path : L"libmariadb.dll")'
  ]) {
    if (!mainCpp.includes(required)) throw new Error(`生成的 MySQL C++ 缺少：${required}`);
  }

  // Windows 安全软件可能短暂锁定刚编译过的产物目录，删除失败时退避重试。
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
  for (const architecture of ['x86', 'x64']) {
    await fs.access(path.join(projectDir, 'modules', 'lingbuilder.database.mysql', architecture, 'libmariadb.dll'));
  }
  const msbuild = await findMsBuild();
  const toolset = await installedToolset(msbuild);
  for (const platform of ['Win32', 'x64']) {
    await execFileAsync(msbuild, [
      exported.solutionPath, '/m', '/nodeReuse:false', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`,
      ...(toolset ? [`/p:PlatformToolset=${toolset}`] : []), '/v:minimal'
    ], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  }

  const executableDir = path.join(projectDir, 'x64', 'Release', 'bin');
  const executable = path.join(executableDir, `${exported.projectName}.exe`);
  await fs.access(path.join(executableDir, 'libmariadb.dll'));
  await fs.rm(path.join(executableDir, 'mysql-smoke-result.txt'), { force: true });
  await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 2 * 60 * 1000, maxBuffer: 1024 * 1024 });
  const report = await fs.readFile(path.join(executableDir, 'mysql-smoke-result.txt'), 'utf8');
  const [status] = report.split('\n');
  if (status?.trim() !== 'OK') {
    throw new Error(`MySQL 冒烟失败：\n${report}`);
  }
  console.log(JSON.stringify({
    ok: true,
    projectDir,
    mariadbDll,
    server: `${smokeHost}:${smokePort}/${smokeDatabase}`,
    compiledPlatforms: ['Win32', 'x64'],
    runtimePlatform: 'x64',
    checks: ['动态加载', '密码连接与错误密码失败路径', 'utf8mb4 中文', '参数化绑定', 'NULL/BLOB/文本', '逐行读取与列名', '事务提交与回滚', '查询首值', '错误码诊断', '资源释放与卸载']
  }, null, 2));
}

function createSource(): string {
  // 连接参数在生成期注入；密码只进入本地生成源码，不进入冒烟输出。
  const goodConnect = `MySQL_连接(L"${smokeHost}", ${smokePort}, L"${smokeUser}", L"${smokePassword}", L"${smokeDatabase}")`;
  const badConnect = `MySQL_连接(L"${smokeHost}", ${smokePort}, L"${smokeUser}", L"__冒烟错误密码__", L"${smokeDatabase}")`;
  const reconnect = `MySQL_连接(L"${smokeHost}", ${smokePort}, L"${smokeUser}", L"${smokePassword}", dbName.c_str())`;
  const check = (condition: string, note?: string): string => note
    ? `        @ SmokeCheck((${condition}), ${note});`
    : `        @ SmokeCheck((${condition}));`;
  return [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    `        @ const std::wstring dbName = L"${smokeDatabase}";`,
    '        @ bool ok = true; int smokeStep = 0; int smokeFailStep = 0; std::wstring smokeFailError; std::wstring smokeFailNote;',
    '        @ auto SmokeCheck = [&](bool condition, const std::wstring& note = L"") { ++smokeStep; if (!condition && smokeFailStep == 0) { smokeFailStep = smokeStep; smokeFailError = MySQL_取错误(); smokeFailNote = note; } ok = ok && condition; return condition; };',
    '        @ long long database = 0; long long badConnection = 0; long long insert = 0; long long query = 0; int qFieldCount = 0; int qStep = 0; std::wstring qErr;',
    '        @ std::vector<unsigned char> payload{0, 1, 2, 127, 128, 255};',
    '        @ SmokeCheck(MySQL_加载运行库(L"libmariadb.dll"));',
    `        @ database = ${goodConnect};`,
    check('database != 0'),
    check('MySQL_连接是否有效(database) && !std::wstring(MySQL_取服务器信息(database)).empty()'),
    `        @ badConnection = ${badConnect};`,
    check('badConnection == 0 && MySQL_取错误码() != 0 && std::wstring(MySQL_取错误()).find(L"失败") != std::wstring::npos'),
    '        @ MySQL_关闭连接(badConnection);',
    check('MySQL_执行(database, L"DROP TABLE IF EXISTS lb_mysql_smoke") >= 0'),
    check('MySQL_执行(database, L"CREATE TABLE lb_mysql_smoke(id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(200), score DOUBLE, payload BLOB, optional TEXT NULL)") >= 0'),
    check('MySQL_开始事务(database)'),
    '        @ insert = MySQL_准备(database, L"INSERT INTO lb_mysql_smoke(name, score, payload, optional) VALUES(?, ?, ?, ?)");',
    check('insert != 0'),
    check("MySQL_绑定文本(insert, 1, L\"中文'参数\") && MySQL_绑定小数(insert, 2, 98.5) && MySQL_绑定字节集(insert, 3, payload) && MySQL_绑定空值(insert, 4)"),
    check('MySQL_语句执行(insert) == 1 && MySQL_取最后插入ID(database) == 1'),
    check('MySQL_语句重置(insert) && MySQL_绑定文本(insert, 1, L"第二行") && MySQL_绑定小数(insert, 2, 88.0) && MySQL_绑定字节集(insert, 3, payload) && MySQL_绑定文本(insert, 4, L"存在")'),
    check('MySQL_语句执行(insert) == 1 && MySQL_取最后插入ID(database) == 2 && MySQL_语句释放(insert)'),
    check('MySQL_提交(database)'),
    check('std::wstring(MySQL_查询首值(database, L"SELECT COUNT(*) FROM lb_mysql_smoke")) == L"2" && MySQL_取错误码() == 0'),
    check('MySQL_开始事务(database)'),
    check('MySQL_执行(database, L"DELETE FROM lb_mysql_smoke WHERE id = 2") == 1'),
    check('MySQL_回滚(database)'),
    check('std::wstring(MySQL_查询首值(database, L"SELECT COUNT(*) FROM lb_mysql_smoke")) == L"2"'),
    check('MySQL_开始事务(database)'),
    check('MySQL_提交(database)'),
    '        @ query = MySQL_准备(database, L"SELECT id, name, score, payload, optional FROM lb_mysql_smoke ORDER BY id");',
    '        @ qFieldCount = query ? MySQL_取列数量(query) : -1; qStep = query ? MySQL_语句步进(query) : -2; qErr = MySQL_取错误();',
    check('query != 0 && qFieldCount == 5 && qStep == 1', 'L"query=" + std::to_wstring(query) + L" fc=" + std::to_wstring(qFieldCount) + L" step=" + std::to_wstring(qStep) + L" err=" + qErr'),
    check("std::wstring(MySQL_取列名称(query, 1)) == L\"name\" && MySQL_取列长整数(query, 0) == 1 && std::wstring(MySQL_取列文本(query, 1)) == L\"中文'参数\""),
    check('MySQL_取列小数(query, 2) == 98.5 && MySQL_取列字节集(query, 3) == payload && MySQL_取列是否为空(query, 4)'),
    check('MySQL_语句步进(query) == 1 && std::wstring(MySQL_取列文本(query, 4)) == L"存在" && MySQL_语句步进(query) == 0 && MySQL_语句释放(query)'),
    check('MySQL_执行(database, L"SELECT * FROM lb_missing_table") < 0 && MySQL_取错误码() != 0 && !std::wstring(MySQL_取错误()).empty()'),
    check('MySQL_切换数据库(database, L"mysql") && MySQL_设置字符集(database, L"utf8mb4") && MySQL_切换数据库(database, dbName.c_str())'),
    check('MySQL_关闭连接(database) && !MySQL_连接是否有效(database) && MySQL_卸载运行库()'),
    `        @ database = ${reconnect};`,
    check('database != 0 && std::wstring(MySQL_查询首值(database, L"SELECT COUNT(*) FROM lb_mysql_smoke")) == L"2"'),
    check('MySQL_关闭连接(database)'),
    '        @ std::ofstream report("mysql-smoke-result.txt", std::ios::binary | std::ios::trunc); report << (ok ? "OK" : "FAIL") << "\\n" << smokeFailStep << "\\n" << LB_WideToUtf8(smokeFailError.c_str()) << "\\n" << LB_WideToUtf8(smokeFailNote.c_str()) << "\\n" << MySQL_取错误码() << "\\n";',
    '        @ ExitProcess(ok ? 0 : 2);',
    '    结束',
    '结束类'
  ].join('\n');
}

async function removeDirectoryWithRetry(target: string, attempts = 8, delayMilliseconds = 10_000): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await fs.rm(target, { recursive: true, force: true });
      await fs.access(target);
      // 目录仍存在说明删除被跳过，继续重试。
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    }
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, delayMilliseconds));
  }
  throw new Error(`无法删除被占用的冒烟目录：${target}。请关闭占用该目录的程序后重试。`);
}

async function findMsBuild(): Promise<string> {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, [
    '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  return path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
}

/** 导出工程写死 v143；本机可能只装了更新的工具集（MSB8020），按实际安装情况覆盖。 */
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

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
