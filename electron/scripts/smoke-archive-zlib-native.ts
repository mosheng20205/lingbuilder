/**
 * lingbuilder.archive 1.1.0 内存字节集压缩/解压（随包 miniz 3.0.2 内联）真机验收：
 * 生成窗口工程 → MSBuild Win32+x64 Release → 运行 exe → exe 写 archive-zlib-smoke.txt → 脚本逐行硬断言。
 * 覆盖：往返（空/1 字节/1MB 中文 UTF-8/含 0x00 二进制）、真实外部样本（node zlib 生成的
 * .gz/.deflate/.zlib）、zip-bomb 上限、截断与首字节 0xFF 异常（空结果 + 压缩_取错误 非空 + 不崩溃）。
 * 运行：cd electron && npm run smoke:archive-zlib
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'archive-zlib-native-smoke');
const REPORT_NAME = 'archive-zlib-smoke.txt';

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

function hexHead(buffer: Buffer, count = 32): string {
  return buffer.subarray(0, count).toString('hex').toUpperCase();
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('archive zlib 冒烟目录越出工作区。');
  // 样本与期望值全部在脚本侧计算，断言写死，不做目测。
  const oneMBase = Buffer.from('中文压缩往返LingBuilder0123456789', 'utf8');
  const plaintext1m = Buffer.concat(Array.from({ length: 26886 }, () => oneMBase));
  const binarySample = Buffer.from(plaintext1m.subarray(0, 384));
  binarySample.set([0x00, 0x01, 0x02, 0x00, 0xFF, 0x00], 128);
  const singleByte = Buffer.from('A', 'ascii');
  const externalPlain = Buffer.from('GZIP外部样本LingBuilder#'.repeat(147), 'utf8');
  const sampleGz = zlib.gzipSync(externalPlain);
  const sampleDeflate = zlib.deflateRawSync(externalPlain);
  const sampleZlib = zlib.deflateSync(externalPlain);
  const truncatedGz = sampleGz.subarray(0, Math.floor(sampleGz.length / 2));
  const garbage = Buffer.from([0xFF, 0xFF, 0x00, 0x12, 0x34]);
  const bombGz = zlib.gzipSync(Buffer.alloc(96 * 1024 * 1024, 0));
  const expected: Array<[string, Buffer]> = [
    ['gzip-1m', plaintext1m],
    ['deflate-bin', binarySample],
    ['gzip-1byte', singleByte],
    ['gzip-empty', Buffer.alloc(0)],
    ['ext-gz', externalPlain],
    ['ext-deflate', externalPlain],
    ['ext-zlib', externalPlain]
  ];

  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.std.bytes'), builtin('lingbuilder.archive')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'archive-zlib-native-smoke',
    name: '字节集压缩解压原生冒烟测试',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '字节集压缩解压原生冒烟测试', width: 420, height: 240, background: '#202028', description: '随包 miniz 3.0.2 往返/外部样本/异常用例', controls: [] }]
  };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        局部 字节集 原文一大块',
    '        原文一大块 = 字节集_重复(26886, 字节集_从文本("中文压缩往返LingBuilder0123456789"))',
    '        局部 字节集 压缩一大块',
    '        压缩一大块 = 压缩_GZIP压缩(原文一大块)',
    '        局部 字节集 往返一大块',
    '        往返一大块 = 压缩_GZIP解压(压缩一大块)',
    '        局部 字节集 原文二进制',
    '        原文二进制 = 字节集_截取(原文一大块, 0, 384)',
    '        @ 原文二进制[128] = 0x00; 原文二进制[129] = 0x01; 原文二进制[130] = 0x02; 原文二进制[131] = 0x00; 原文二进制[132] = 0xFF; 原文二进制[133] = 0x00;',
    '        局部 字节集 压缩二进制',
    '        压缩二进制 = 压缩_DEFLATE压缩(原文二进制)',
    '        局部 字节集 往返二进制',
    '        往返二进制 = 压缩_DEFLATE解压(压缩二进制)',
    '        局部 字节集 单字节原文',
    '        单字节原文 = 字节集_从文本("A")',
    '        局部 字节集 单字节往返',
    '        单字节往返 = 压缩_GZIP解压(压缩_GZIP压缩(单字节原文))',
    '        局部 字节集 空原文',
    '        局部 字节集 空压缩包',
    '        空压缩包 = 压缩_GZIP压缩(空原文)',
    '        局部 字节集 空往返',
    '        空往返 = 压缩_GZIP解压(空压缩包)',
    '        @ const std::wstring 空往返错误(压缩_取错误());',
    '        局部 字节集 外部GZ',
    '        @ std::ifstream gzIn("lbzlib-sample.gz", std::ios::binary); 外部GZ.assign(std::istreambuf_iterator<char>(gzIn), std::istreambuf_iterator<char>());',
    '        局部 字节集 外部GZ解压',
    '        外部GZ解压 = 压缩_GZIP解压(外部GZ)',
    '        局部 字节集 外部DEFLATE',
    '        @ std::ifstream deflateIn("lbzlib-sample.deflate", std::ios::binary); 外部DEFLATE.assign(std::istreambuf_iterator<char>(deflateIn), std::istreambuf_iterator<char>());',
    '        局部 字节集 外部DEFLATE解压',
    '        外部DEFLATE解压 = 压缩_DEFLATE解压(外部DEFLATE)',
    '        局部 字节集 外部ZLIB',
    '        @ std::ifstream zlibIn("lbzlib-sample.zlib", std::ios::binary); 外部ZLIB.assign(std::istreambuf_iterator<char>(zlibIn), std::istreambuf_iterator<char>());',
    '        局部 字节集 外部ZLIB解压',
    '        外部ZLIB解压 = 压缩_ZLIB解压(外部ZLIB)',
    '        局部 字节集 截断GZ',
    '        @ std::ifstream truncIn("lbzlib-sample-trunc.gz", std::ios::binary); 截断GZ.assign(std::istreambuf_iterator<char>(truncIn), std::istreambuf_iterator<char>());',
    '        局部 字节集 截断解压',
    '        截断解压 = 压缩_GZIP解压(截断GZ)',
    '        @ const std::wstring 截断错误(压缩_取错误());',
    '        局部 字节集 垃圾输入',
    '        垃圾输入 = 字节集_从文本("AAAAA")',
    '        @ 垃圾输入[0] = 0xFF; 垃圾输入[1] = 0xFF;',
    '        局部 字节集 垃圾解压',
    '        垃圾解压 = 压缩_DEFLATE解压(垃圾输入)',
    '        @ const std::wstring 垃圾错误(压缩_取错误());',
    '        局部 字节集 炸弹GZ',
    '        @ std::ifstream bombIn("lbzlib-bomb.gz", std::ios::binary); 炸弹GZ.assign(std::istreambuf_iterator<char>(bombIn), std::istreambuf_iterator<char>());',
    '        局部 字节集 炸弹解压',
    '        炸弹解压 = 压缩_GZIP解压(炸弹GZ)',
    '        @ const std::wstring 炸弹错误(压缩_取错误());',
    '        @ std::remove("' + REPORT_NAME + '");',
    '        @ auto reportRound = [&](const char* name, const std::vector<unsigned char>& original, const std::vector<unsigned char>& round) {',
    `        @     std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app);`,
    '        @     out << name << \' \' << (original == round ? \'E\' : \'N\') << \' \' << round.size() << \' \';',
    '        @     for (size_t i = 0; i < round.size() && i < 32; ++i) { char hex[3]; sprintf_s(hex, "%02X", round[i]); out << hex; }',
    '        @     out << "\\n"; };',
    '        @ auto reportBytes = [&](const char* name, const std::vector<unsigned char>& bytes) {',
    `        @     std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app);`,
    '        @     out << name << " X " << bytes.size() << \' \';',
    '        @     for (size_t i = 0; i < bytes.size() && i < 32; ++i) { char hex[3]; sprintf_s(hex, "%02X", bytes[i]); out << hex; }',
    '        @     out << "\\n"; };',
    '        @ auto reportFailure = [&](const char* name, bool ok) {',
    `        @     std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app);`,
    '        @     out << name << \' \' << (ok ? \'E\' : \'N\') << \'\\n\'; };',
    '        @ reportRound("gzip-1m", 原文一大块, 往返一大块);',
    `        @ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "compressed gzip-1m " << 压缩一大块.size() << "\\n"; }`,
    '        @ reportRound("deflate-bin", 原文二进制, 往返二进制);',
    '        @ reportRound("gzip-1byte", 单字节原文, 单字节往返);',
    '        @ reportRound("gzip-empty", 空原文, 空往返);',
    '        @ reportFailure("empty-no-error", 空往返错误.empty());',
    '        @ reportBytes("ext-gz", 外部GZ解压);',
    '        @ reportBytes("ext-deflate", 外部DEFLATE解压);',
    '        @ reportBytes("ext-zlib", 外部ZLIB解压);',
    '        @ reportFailure("neg-trunc", 截断解压.empty() && !截断错误.empty());',
    '        @ reportFailure("neg-garbage", 垃圾解压.empty() && !垃圾错误.empty());',
    '        @ reportFailure("cap", 炸弹解压.empty() && !炸弹错误.empty());',
    '        @ reportFailure("cap-detail", 炸弹错误.find(L"67108864") != std::wstring::npos);',
    `        @ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "final OK" << "\\n"; }`,
    '        @ ExitProcess(0);',
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
  await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
  await fs.copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'), path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  const sampleFiles: Array<[string, Buffer]> = [
    ['lbzlib-sample.gz', sampleGz],
    ['lbzlib-sample.deflate', sampleDeflate],
    ['lbzlib-sample.zlib', sampleZlib],
    ['lbzlib-sample-trunc.gz', Buffer.from(truncatedGz)],
    ['lbzlib-garbage.bin', garbage],
    ['lbzlib-bomb.gz', bombGz]
  ];
  for (const platform of ['Win32', 'x64'] as const) {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    const binDir = path.join(projectDir, platform, 'Release', 'bin');
    for (const [name, content] of sampleFiles) await fs.writeFile(path.join(binDir, name), content);
    const executable = path.join(binDir, `${exported.projectName}.exe`);
    const run = await execFileAsync(executable, [], { cwd: binDir, windowsHide: true, timeout: 3 * 60 * 1000, maxBuffer: 1024 * 1024 }).then(() => ({}), error => ({ error }));
    const reportPath = path.join(binDir, REPORT_NAME);
    const report = await fs.readFile(reportPath, 'utf8').catch(() => '');
    if ('error' in run && !report.includes('OK')) throw new Error(`${platform} 运行未正常退出（exit=${(run.error as { code?: number }).code}）：\n${report}`);
    assertReport(platform, report, expected, plaintext1m, externalPlain);
    console.log(`[${platform}] archive-zlib 原生冒烟 PASS`);
  }
  console.log(JSON.stringify({ ok: true, projectDir, platforms: ['Win32', 'x64'] }, null, 2));
}

function assertReport(platform: string, report: string, expected: Array<[string, Buffer]>, plaintext1m: Buffer, externalPlain: Buffer): void {
  const roundByLine = new Map(report.split('\n').filter(Boolean).map(line => [line.split(' ')[0] || '', line]));
  for (const [name, plain] of expected) {
    const line = roundByLine.get(name);
    if (!line) throw new Error(`${platform} 报告缺少 ${name} 行：\n${report}`);
    const [, flag, sizeText, headHex = ''] = line.split(' ');
    // 往返行 flag=E（探针侧原文==解压结果）；外部样本行 flag=X（等值断言在脚本侧按 size+hex 硬比对）。
    if (flag !== (name.startsWith('ext-') ? 'X' : 'E')) throw new Error(`${platform} ${name} 标志位异常：${line}`);
    if (Number(sizeText) !== plain.length) throw new Error(`${platform} ${name} 长度不符：期望 ${plain.length}，实际 ${sizeText}`);
    if (headHex !== hexHead(plain)) throw new Error(`${platform} ${name} 前 32 字节不符：期望 ${hexHead(plain)}，实际 ${headHex}`);
  }
  const compressedLine = roundByLine.get('compressed');
  if (!compressedLine) throw new Error(`${platform} 报告缺少 compressed 行：\n${report}`);
  const compressedSize = Number(compressedLine.split(' ')[2]);
  if (!(compressedSize > 0 && compressedSize < plaintext1m.length)) throw new Error(`${platform} 1MB 样本压缩尺寸异常：${compressedLine}`);
  for (const name of ['empty-no-error', 'neg-trunc', 'neg-garbage', 'cap', 'cap-detail']) {
    const line = roundByLine.get(name);
    if (!line || !line.endsWith(' E')) throw new Error(`${platform} ${name} 断言失败（期望 E）：${line || '<缺失>'}`);
  }
  if (!roundByLine.get('final')?.endsWith('OK')) throw new Error(`${platform} 报告缺少 final OK：\n${report}`);
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
