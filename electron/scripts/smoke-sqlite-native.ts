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
const projectDir = path.join(repoRoot, '.lingbuilder-build', 'sqlite-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main(): Promise<void> {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('SQLite smoke 目录越出工作区。');
  const sqliteDll = await resolveSqliteDll();
  const enabledModules = [builtin('lingbuilder.database.sqlite')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'sqlite-native-smoke',
    name: 'SQLite 模块原生冒烟测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'SQLite 模块原生冒烟测试',
      width: 420, height: 180, background: '#202028', description: '验证 SQLite 2.0 运行时', controls: []
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
    'namespace LingBuilderSqlite',
    'long long SQLite_打开连接',
    'long long SQLite_打开加密连接',
    'bool SQLite_打开加密库',
    'bool SQLite_运行库是否支持加密',
    'bool SQLite_绑定字节集',
    'bool SQLite_备份到文件',
    'const wchar_t* SQLite_完整性检查'
  ]) {
    if (!mainCpp.includes(required)) throw new Error(`生成的 SQLite C++ 缺少：${required}`);
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
    await fs.access(path.join(projectDir, 'modules', 'lingbuilder.database.sqlite', architecture, 'sqlite3.dll'));
  }
  const msbuild = await findMsBuild();
  const toolset = await installedToolset(msbuild);
  for (const platform of ['Win32', 'x64']) {
    await execFileAsync(msbuild, [
      exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`,
      ...(toolset ? [`/p:PlatformToolset=${toolset}`] : []), '/v:minimal'
    ], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  }

  const executableDir = path.join(projectDir, 'x64', 'Release', 'bin');
  const executable = path.join(executableDir, `${exported.projectName}.exe`);
  await fs.access(path.join(executableDir, 'sqlite3.dll'));
  await fs.rm(path.join(executableDir, 'sqlite-smoke.db'), { force: true });
  await fs.rm(path.join(executableDir, 'sqlite-smoke-backup.db'), { force: true });
  await fs.rm(path.join(executableDir, 'sqlite-smoke-encrypted.db'), { force: true });
  await fs.rm(path.join(executableDir, 'sqlite-smoke-encrypted2.db'), { force: true });
  await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 2 * 60 * 1000, maxBuffer: 1024 * 1024 });
  await fs.access(path.join(executableDir, 'sqlite-smoke-backup.db'));
  console.log(JSON.stringify({
    ok: true,
    projectDir,
    sqliteDll,
    compiledPlatforms: ['Win32', 'x64'],
    runtimePlatform: 'x64',
    checks: ['动态加载', '加密打开与密码校验', 'WAL', '外键', '事务与保存点', '参数绑定', 'NULL/BLOB/UTF-8', '逐行读取', '在线备份', '完整性检查', '错误码', '资源释放']
  }, null, 2));
}

function createSource(): string {
  return [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        @ bool ok = SQLite_加载运行库(L"sqlite3.dll");',
    '        @ long long database = ok ? SQLite_打开连接(L"sqlite-smoke.db", 0, 5000) : 0;',
    '        @ ok = ok && database != 0 && SQLite_连接是否有效(database) && !SQLite_连接是否只读(database);',
    '        @ ok = ok && SQLite_设置外键(database, true) && SQLite_设置同步模式(database, 2) && SQLite_启用WAL(database);',
    '        @ ok = ok && SQLite_执行于(database, L"DROP TABLE IF EXISTS records; CREATE TABLE records(id INTEGER PRIMARY KEY, name TEXT NOT NULL, score REAL, payload BLOB, optional TEXT NULL)");',
    '        @ ok = ok && SQLite_开始事务(database, 1) && SQLite_连接是否在事务中(database);',
    '        @ long long insert = SQLite_准备(database, L"INSERT INTO records(name, score, payload, optional) VALUES(?1, ?2, ?3, ?4)");',
    '        @ std::vector<unsigned char> payload{0, 1, 2, 127, 128, 255};',
    '        @ ok = ok && insert != 0 && SQLite_语句取参数数量(insert) == 4;',
    '        @ ok = ok && SQLite_绑定文本(insert, 1, L"中文\'参数") && SQLite_绑定小数(insert, 2, 98.5) && SQLite_绑定字节集(insert, 3, payload) && SQLite_绑定空值(insert, 4) && SQLite_语句步进(insert) == 0;',
    '        @ ok = ok && SQLite_语句重置(insert) && SQLite_语句清空绑定(insert);',
    '        @ ok = ok && SQLite_绑定文本(insert, 1, L"第二行") && SQLite_绑定小数(insert, 2, 88.0) && SQLite_绑定字节集(insert, 3, payload) && SQLite_绑定文本(insert, 4, L"存在") && SQLite_语句步进(insert) == 0;',
    '        @ ok = ok && SQLite_语句释放(insert);',
    '        @ ok = ok && SQLite_创建保存点(database, L"回滚测试") && SQLite_执行于(database, L"INSERT INTO records(name) VALUES(\'应回滚\')") && SQLite_回滚到保存点(database, L"回滚测试") && SQLite_释放保存点(database, L"回滚测试");',
    '        @ ok = ok && SQLite_提交事务(database) && !SQLite_连接是否在事务中(database);',
    '        @ long long query = SQLite_准备(database, L"SELECT id, name, score, payload, optional FROM records ORDER BY id");',
    '        @ ok = ok && query != 0 && SQLite_语句是否只读(query) && SQLite_取列数量(query) == 5 && SQLite_语句步进(query) == 1;',
    '        @ ok = ok && SQLite_取列长整数(query, 0) == 1 && std::wstring(SQLite_取列名称(query, 1)) == L"name" && std::wstring(SQLite_取列文本(query, 1)) == L"中文\'参数";',
    '        @ ok = ok && SQLite_取列类型(query, 2) == 2 && SQLite_取列小数(query, 2) == 98.5 && SQLite_取列字节集(query, 3) == payload && SQLite_取列是否为空(query, 4);',
    '        @ ok = ok && SQLite_语句步进(query) == 1 && SQLite_语句步进(query) == 0 && SQLite_语句释放(query);',
    '        @ ok = ok && SQLite_取连接更改行数(database) >= 0 && SQLite_取累计更改行数(database) == 3 && SQLite_取最后插入行号(database) == 3;',
    '        @ ok = ok && std::wstring(SQLite_查询首值于(database, L"SELECT count(*) FROM records")) == L"2";',
    '        @ ok = ok && SQLite_备份到文件(database, L"sqlite-smoke-backup.db", 10000) && std::wstring(SQLite_完整性检查(database, false)) == L"ok";',
    '        @ bool expectedFailure = !SQLite_执行于(database, L"SELECT * FROM missing_table") && SQLite_取错误码() != 0 && !std::wstring(SQLite_取错误()).empty();',
    '        @ ok = ok && expectedFailure && SQLite_运行库是否支持加密();',
    '        @ ok = ok && SQLite_打开加密库(L"sqlite-smoke-encrypted.db", L"冒烟密码123");',
    '        @ ok = ok && std::wstring(SQLite_查询首值(L"SELECT count(*) FROM sqlite_master")) == L"0";',
    '        @ ok = ok && SQLite_执行(L"CREATE TABLE secret(id INTEGER PRIMARY KEY, note TEXT)") && SQLite_执行(L"INSERT INTO secret(note) VALUES(\'加密内容\')");',
    '        @ SQLite_关闭();',
    '        @ long long secure = SQLite_打开加密连接(L"sqlite-smoke-encrypted.db", L"冒烟密码123", 0, 5000);',
    '        @ ok = ok && secure != 0 && std::wstring(SQLite_查询首值于(secure, L"SELECT note FROM secret WHERE id=1")) == L"加密内容";',
    '        @ ok = ok && SQLite_关闭连接(secure);',
    '        @ ok = ok && !SQLite_打开加密连接(L"sqlite-smoke-encrypted.db", L"错误密码", 0, 5000) && SQLite_取错误码() != 0 && !std::wstring(SQLite_取错误()).empty();',
    '        @ ok = ok && !SQLite_打开加密库(L"sqlite-smoke-encrypted2.db", L"");',
    '        @ ok = ok && SQLite_关闭连接(database) && !SQLite_连接是否有效(database) && SQLite_卸载运行库();',
    '        @ std::ofstream report("sqlite-smoke-result.txt", std::ios::binary | std::ios::trunc); report << (ok ? "OK" : "FAIL") << "\\n" << LB_WideToUtf8(SQLite_取错误()) << "\\n" << SQLite_取错误码() << "\\n";',
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

async function resolveSqliteDll(): Promise<string> {
  const candidates = [
    process.env.LINGBUILDER_SQLITE3_DLL,
    path.join(repoRoot, 'electron', 'third_party', 'sqlite', 'x64', 'sqlite3.dll'),
    path.join(repoRoot, 'modules', 'lingbuilder.wxhook.manager', 'runtime', 'e_sqlite3.dll')
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    try {
      await fs.access(resolved);
      return resolved;
    } catch {
      // Continue to the next explicit, workspace-owned fixture.
    }
  }
  throw new Error('未找到支持加密的 x64 SQLite 运行库。LingBuilder 随附运行库位于 electron/third_party/sqlite/x64/sqlite3.dll，也可用 LINGBUILDER_SQLITE3_DLL 指向 SQLCipher 兼容 DLL。');
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
