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
const projectDir = path.join(repoRoot, '.lingbuilder-build', 'csv-sqlite-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

/**
 * 端到端验收三件事：
 * 1. GBK/带 BOM 的 CSV 能按 AUTO 正确解码；
 * 2. 引号内换行的字段不再被拆成两行（旧行级解析器的结构性缺陷）；
 * 3. csv 虚拟表可以把文件当表查询并 INSERT ... SELECT 入库（列类型亲和生效）。
 */
async function main(): Promise<void> {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('CSV/SQLite smoke 目录越出工作区。');
  const enabledModules = [builtin('lingbuilder.data.csv'), builtin('lingbuilder.database.sqlite'), builtin('lingbuilder.std.encoding'), builtin('lingbuilder.std.bytes'), builtin('lingbuilder.fs.core')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'csv-sqlite-native-smoke',
    name: 'CSV 导入 SQLite 原生冒烟测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'CSV 导入 SQLite 原生冒烟测试',
      width: 420, height: 180, background: '#202028', description: '验证 CSV 记录级解析与 csv 虚拟表直连', controls: []
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
    'long long CSV_打开文件', 'const wchar_t* 数据表_取文本', 'static bool LB_CsvNextRecord',
    'static LB_EncodingKind LB_AutoDetectEncodingKind', 'create_module(database, "csv", &CsvVtabModule, nullptr)',
    'const wchar_t* SQLite_取虚拟表支持'
  ]) {
    if (!mainCpp.includes(required)) throw new Error(`生成的 C++ 缺少：${required}`);
  }
  if ((mainCpp.match(/#define LB_TABULAR_SOURCE_RUNTIME_INCLUDED/gu) || []).length !== 1) {
    throw new Error('表格内核被重复铺设，保护宏失效。');
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
  const msbuild = await findMsBuild();
  const toolset = await installedToolset(msbuild);
  for (const platform of ['Win32', 'x64']) {
    await buildWithOutput(msbuild, exported.solutionPath, projectDir, platform, toolset);
  }

  const executableDir = path.join(projectDir, 'x64', 'Release', 'bin');
  const executable = path.join(executableDir, `${exported.projectName}.exe`);
  await fs.access(path.join(executableDir, 'sqlite3.dll'));
  await fs.rm(path.join(executableDir, 'csv-smoke.db'), { force: true });
  let runError = '';
  try {
    await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 2 * 60 * 1000, maxBuffer: 1024 * 1024 });
  } catch (error) {
    runError = error instanceof Error ? error.message : String(error);
  }
  const report = await fs.readFile(path.join(executableDir, 'csv-smoke-result.txt'), 'utf8').catch(() => '');
  if (!report.startsWith('OK')) throw new Error(`exe 校验失败：${report.trim() || '（无报告文件）'}\n${runError}`);
  console.log(JSON.stringify({
    ok: true,
    projectDir,
    compiledPlatforms: ['Win32', 'x64'],
    runtimePlatform: 'x64',
    report: report.trim(),
    checks: ['GBK 自动识别', 'UTF-8 BOM 剥离', '引号内换行字段', '空行跳过', '自定义分隔符', '单元格类型判定', 'csv 虚拟表 SELECT', 'INSERT ... SELECT 入库', '列类型亲和', '虚拟表能力自查']
  }, null, 2));
}

function createSource(): string {
  return [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        @ bool ok = true;',
    '        @ std::wstring failures;',
    '        @ auto Check = [&](const std::wstring& name, bool passed) { if (!passed) { failures += L"[" + name + L"] "; ok = false; } };',
    '        @ auto Number = [](long long value) { return std::to_wstring(value); };',
    '        @ auto Describe = []() { return std::wstring(SQLite_取错误()) + L" (码 " + std::to_wstring(SQLite_取错误码()) + L")"; };',
    // ---- 造三份样例：GBK（无 BOM）、UTF-8 带 BOM、分号分隔无表头 ----
    '        @ const std::wstring crossLine = L"第一行\\n第二行";',
    '        @ const std::wstring gbkText = L"工号,姓名,备注\\n1001,张三,\\"第一行\\n第二行\\"\\n1002,李四,普通\\n\\n";',
    '        @ std::vector<unsigned char> gbkBytes;',
    '        @ Check(L"GBK 编码样例", LB_EncodeTextBytes(gbkText.c_str(), LB_EncodingKind::Gbk, gbkBytes) && !gbkBytes.empty());',
    '        @ { std::ofstream out("gbk.csv", std::ios::binary | std::ios::trunc); out.write(reinterpret_cast<const char*>(gbkBytes.data()), static_cast<std::streamsize>(gbkBytes.size())); Check(L"写 gbk.csv", out.good()); }',
    '        @ std::vector<unsigned char> bomBytes = LB_BomBytes(LB_EncodingKind::Utf8);',
    '        @ const std::wstring utfText = L"工号,姓名\\n2001,王五\\n";',
    '        @ std::vector<unsigned char> utfBody;',
    '        @ Check(L"UTF-8 编码样例", LB_EncodeTextBytes(utfText.c_str(), LB_EncodingKind::Utf8, utfBody));',
    '        @ bomBytes.insert(bomBytes.end(), utfBody.begin(), utfBody.end());',
    '        @ { std::ofstream out("utf8bom.csv", std::ios::binary | std::ios::trunc); out.write(reinterpret_cast<const char*>(bomBytes.data()), static_cast<std::streamsize>(bomBytes.size())); Check(L"写 utf8bom.csv", out.good()); }',
    '        @ { std::ofstream out("semi.csv", std::ios::binary | std::ios::trunc); out << "1;甲\\n2;乙\\n"; Check(L"写 semi.csv", out.good()); }',
    '        @ { std::wstring utfProbe; Check(L"样例确为 GBK 双字节且非合法 UTF-8", gbkBytes.size() > 1 && gbkBytes[0] >= 0x80 && gbkBytes[1] >= 0x80 && !LB_CodePageToWide(gbkBytes, CP_UTF8, utfProbe)); }',
    // ---- 表格快照：GBK + 跨行字段 + 空行跳过 ----
    '        @ long long table = CSV_打开文件(L"gbk.csv", L"AUTO", L",", true);',
    '        @ Check(L"CSV_打开文件 GBK", table != 0);',
    '        @ Check(L"行数=2 实际" + Number(数据表_行数(table)), 数据表_行数(table) == 2);',
    '        @ Check(L"列数=3 实际" + Number(数据表_列数(table)), 数据表_列数(table) == 3);',
    '        @ Check(L"列名1=工号 实际" + std::wstring(数据表_列名(table, 1)), std::wstring(数据表_列名(table, 1)) == L"工号");',
    '        @ Check(L"列名3=备注 实际" + std::wstring(数据表_列名(table, 3)), std::wstring(数据表_列名(table, 3)) == L"备注");',
    '        @ Check(L"跨行字段还原 实际" + std::wstring(数据表_取文本(table, 1, 3)), std::wstring(数据表_取文本(table, 1, 3)) == crossLine);',
    '        @ Check(L"单元格类型=整数 实际" + Number(数据表_单元格类型(table, 1, 1)), 数据表_单元格类型(table, 1, 1) == 1);',
    '        @ Check(L"取整数=1001 实际" + Number(数据表_取整数(table, 1, 1)), 数据表_取整数(table, 1, 1) == 1001);',
    '        @ Check(L"单元格类型=文本 实际" + Number(数据表_单元格类型(table, 2, 2)), 数据表_单元格类型(table, 2, 2) == 4);',
    '        @ Check(L"取文本=李四 实际" + std::wstring(数据表_取文本(table, 2, 2)), std::wstring(数据表_取文本(table, 2, 2)) == L"李四");',
    '        @ Check(L"句柄可关闭且不可重复关闭", 数据表_关闭(table) && !数据表_关闭(table));',
    '        @ Check(L"失效句柄读列为空", 数据表_列数(table) == 0 && !std::wstring(数据表_取错误()).empty());',
    // ---- UTF-8 BOM、自定义分隔符、无表头 ----
    '        @ long long utfTable = CSV_打开文件(L"utf8bom.csv", L"AUTO");',
    '        @ Check(L"UTF-8 BOM 表可读", utfTable != 0);',
    '        @ Check(L"BOM 表行数=1 实际" + Number(数据表_行数(utfTable)), 数据表_行数(utfTable) == 1);',
    '        @ Check(L"BOM 表列数=2 实际" + Number(数据表_列数(utfTable)), 数据表_列数(utfTable) == 2);',
    '        @ Check(L"BOM 首列名未被 BOM 污染 实际" + std::wstring(数据表_列名(utfTable, 1)), std::wstring(数据表_列名(utfTable, 1)) == L"工号");',
    '        @ Check(L"BOM 取值=王五 实际" + std::wstring(数据表_取文本(utfTable, 1, 2)), std::wstring(数据表_取文本(utfTable, 1, 2)) == L"王五");',
    '        @ Check(L"非空单元格判定", !数据表_单元格为空(utfTable, 1, 1));',
    '        @ 数据表_关闭(utfTable);',
    '        @ long long semiTable = CSV_打开文件(L"semi.csv", L"AUTO", L";", false);',
    '        @ Check(L"分号无表头可读", semiTable != 0);',
    '        @ Check(L"分号表行数=2 实际" + Number(数据表_行数(semiTable)), 数据表_行数(semiTable) == 2);',
    '        @ Check(L"无表头列名=列2 实际" + std::wstring(数据表_列名(semiTable, 2)), std::wstring(数据表_列名(semiTable, 2)) == L"列2");',
    '        @ Check(L"分号取值=乙 实际" + std::wstring(数据表_取文本(semiTable, 2, 2)), std::wstring(数据表_取文本(semiTable, 2, 2)) == L"乙");',
    '        @ 数据表_关闭(semiTable);',
    '        @ long long badEncoding = CSV_打开文件(L"gbk.csv", L"UTF-8");',
    '        @ Check(L"GBK 文件按 UTF-8 必须失败", badEncoding == 0 && !std::wstring(数据表_取错误()).empty());',
    // ---- 编码直连命令与按编码读取文件 ----
    '        @ std::wstring readBack = 文件_读取文本(L"gbk.csv", L"GBK");',
    '        @ Check(L"文件_读取文本 GBK 回读", readBack == gbkText);',
    '        @ Check(L"文件_读取文本 缺省 UTF-8 对 GBK 返回空", std::wstring(文件_读取文本(L"gbk.csv")).empty());',
    '        @ Check(L"文件_读取文本 AUTO 命中 GBK", 文件_读取文本(L"gbk.csv", L"AUTO") == gbkText);',
    '        @ Check(L"编码_字节集转文本 往返", std::wstring(编码_字节集转文本(字节集_从文本(L"中文"), L"UTF-8")) == L"中文");',
    '        @ Check(L"编码_文本转字节集 AUTO 返回空", 编码_文本转字节集(L"中文", L"AUTO").empty());',
    '        @ Check(L"编码_文本转字节集 GBK 往返", std::wstring(编码_字节集转文本(编码_文本转字节集(L"中文", L"GBK"), L"GBK")) == L"中文");',
    // ---- 虚拟表直连查询与入库 ----
    '        @ Check(L"加载 SQLite 运行库", SQLite_加载运行库(L"sqlite3.dll"));',
    '        @ long long database = SQLite_打开连接(L"csv-smoke.db", 0, 5000);',
    '        @ Check(L"打开数据库", database != 0);',
    '        @ Check(L"虚拟表能力自查=csv 实际" + std::wstring(SQLite_取虚拟表支持(database)), std::wstring(SQLite_取虚拟表支持(database)) == L"csv");',
    '        @ Check(L"清理旧表", SQLite_执行于(database, L"DROP TABLE IF EXISTS 员工; DROP TABLE IF EXISTS 导入_员工;"));',
    '        @ Check(L"建目标表", SQLite_执行于(database, L"CREATE TABLE 员工(工号 INTEGER PRIMARY KEY, 姓名 TEXT, 备注 TEXT)"));',
    '        @ Check(L"建 csv 虚拟表", SQLite_执行于(database, L"CREATE VIRTUAL TABLE 导入_员工 USING csv(filename=\'gbk.csv\', schema=\'(工号 INTEGER, 姓名 TEXT, 备注 TEXT)\', header=1, encoding=\'AUTO\')"));',
    '        @ Check(L"虚拟表行数=2 实际" + std::wstring(SQLite_查询首值于(database, L"SELECT count(*) FROM 导入_员工")) + L" 错误=" + Describe(), std::wstring(SQLite_查询首值于(database, L"SELECT count(*) FROM 导入_员工")) == L"2");',
    '        @ Check(L"表头不作为数据行", std::wstring(SQLite_查询首值于(database, L"SELECT count(*) FROM 导入_员工 WHERE 姓名 = \'姓名\'")) == L"0");',
    '        @ Check(L"建 header=0 虚拟表", SQLite_执行于(database, L"CREATE VIRTUAL TABLE 导入_全表 USING csv(filename=\'gbk.csv\', schema=\'(c1 TEXT, c2 TEXT, c3 TEXT)\', header=0)"));',
    '        @ Check(L"header=0 行数=3 实际" + std::wstring(SQLite_查询首值于(database, L"SELECT count(*) FROM 导入_全表")), std::wstring(SQLite_查询首值于(database, L"SELECT count(*) FROM 导入_全表")) == L"3");',
    '        @ Check(L"header=0 首行即表头原文", std::wstring(SQLite_查询首值于(database, L"SELECT c1 FROM 导入_全表 LIMIT 1")) == L"工号");',
    '        @ Check(L"清理 header=0 虚拟表", SQLite_执行于(database, L"DROP TABLE 导入_全表"));',
    '        @ long long scan = SQLite_准备(database, L"SELECT 工号, 姓名, 备注 FROM 导入_员工 ORDER BY 工号");',
    '        @ Check(L"虚拟表可查询", scan != 0 && SQLite_取列数量(scan) == 3);',
    '        @ Check(L"虚拟表首行存在", SQLite_语句步进(scan) == 1);',
    '        @ Check(L"整数亲和 实际" + Number(SQLite_取列长整数(scan, 0)), SQLite_取列长整数(scan, 0) == 1001);',
    '        @ Check(L"姓名=张三 实际" + std::wstring(SQLite_取列文本(scan, 1)), std::wstring(SQLite_取列文本(scan, 1)) == L"张三");',
    '        @ Check(L"虚拟表跨行字段 实际长度" + Number(std::wstring(SQLite_取列文本(scan, 2)).size()), std::wstring(SQLite_取列文本(scan, 2)) == crossLine);',
    '        @ Check(L"虚拟表第二行", SQLite_语句步进(scan) == 1 && SQLite_取列长整数(scan, 0) == 1002);',
    '        @ { const long long third = SQLite_语句步进(scan); Check(L"虚拟表扫描结束 步进=" + Number(third) + L" 错误=" + Describe(), third == 0); }',
    '        @ SQLite_语句释放(scan);',
    '        @ { const bool inserted = SQLite_开始事务(database, 1) && SQLite_执行于(database, L"INSERT INTO 员工(工号, 姓名, 备注) SELECT 工号, 姓名, 备注 FROM 导入_员工"); const std::wstring error = Describe(); Check(L"事务批量入库 " + error, inserted && SQLite_提交事务(database)); }',
    '        @ Check(L"入库行数=2 实际" + std::wstring(SQLite_查询首值于(database, L"SELECT count(*) FROM 员工")), std::wstring(SQLite_查询首值于(database, L"SELECT count(*) FROM 员工")) == L"2");',
    '        @ Check(L"入库列类型为 integer 实际" + std::wstring(SQLite_查询首值于(database, L"SELECT typeof(工号) FROM 员工 WHERE 工号=1001")), std::wstring(SQLite_查询首值于(database, L"SELECT typeof(工号) FROM 员工 WHERE 工号=1001")) == L"integer");',
    '        @ Check(L"入库备注含换行 实际长度" + std::wstring(SQLite_查询首值于(database, L"SELECT length(备注) FROM 员工 WHERE 工号=1001")), std::wstring(SQLite_查询首值于(database, L"SELECT length(备注) FROM 员工 WHERE 工号=1001")) == std::to_wstring(crossLine.size()));',
    '        @ Check(L"跨库 JOIN 可用", SQLite_执行于(database, L"SELECT 员工.姓名 FROM 员工 JOIN 导入_员工 ON 导入_员工.工号 = 员工.工号 LIMIT 1") && std::wstring(SQLite_查询首值于(database, L"SELECT count(*) FROM 员工 WHERE 姓名 = (SELECT 姓名 FROM 导入_员工 WHERE 工号 = 1002)")) == L"1");',
    '        @ long long badTable = SQLite_准备(database, L"SELECT 1 FROM 不存在");',
    '        @ Check(L"缺 filename 被中文拒绝", !SQLite_执行于(database, L"CREATE VIRTUAL TABLE 坏表 USING csv(schema=\'(a INTEGER)\')") && !std::wstring(SQLite_取错误()).empty());',
    '        @ Check(L"坏表未落库", SQLite_准备(database, L"SELECT 1 FROM 坏表") == 0);',
    '        @ SQLite_语句释放(badTable);',
    '        @ Check(L"删除虚拟表后库完整", SQLite_执行于(database, L"DROP TABLE 导入_员工") && std::wstring(SQLite_完整性检查(database, true)) == L"ok");',
    '        @ Check(L"关闭连接", SQLite_关闭连接(database));',
    '        @ SQLite_关闭全部();',
    '        @ std::ofstream report("csv-smoke-result.txt", std::ios::binary | std::ios::trunc);',
    '        @ report << (ok ? "OK" : "FAIL") << "\\n" << LB_WideToUtf8(failures.c_str()) << "\\n";',
    '        @ ExitProcess(ok ? 0 : 2);',
    '        // 以下走中文命令直写路径（非 @ 内嵌 C++），只作编译与调用链覆盖，运行期不再执行。',
    '        局部 表格数据 快照 = CSV_打开文件("gbk.csv", "AUTO")',
    '        如果 (快照 != 0)',
    '            局部 整数型 行数 = 数据表_行数(快照)',
    '            局部 文本型 首列 = 数据表_列名(快照, 1)',
    '            调试输出(数据表_取文本(快照, 1, 2))',
    '            数据表_关闭(快照)',
    '        如果结束',
    '    结束',
    '结束类'
  ].join('\n');
}

/** 构建失败必须原样带出 MSVC 诊断，否则只报「Command failed」还要人工复现。 */
async function buildWithOutput(msbuild: string, solutionPath: string, cwd: string, platform: string, toolset: string | undefined): Promise<void> {
  try {
    await execFileAsync(msbuild, [
      solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`,
      ...(toolset ? [`/p:PlatformToolset=${toolset}`] : []), '/v:minimal'
    ], { cwd, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  } catch (error) {
    const detail = `${(error as { stdout?: string }).stdout || ''}${(error as { stderr?: string }).stderr || ''}`;
    const lines = detail.split(/\r?\n/).filter(line => /\berror [A-Z]+\d+/iu.test(line));
    throw new Error(`${platform} 构建失败：\n${(lines.length ? lines : detail.split(/\r?\n/)).slice(0, 40).join('\n')}`);
  }
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
