/**
 * lingbuilder.ocr 1.0.0 微信OCR识别模块（借用本机微信 4.x 组件）真机验收：
 * 生成窗口工程 → MSBuild x64+Win32 Release → 运行 exe → exe 写 wxocr-smoke.txt → 脚本逐行硬断言。
 * 覆盖：OCR_取微信状态 found:true、错误路径（不存在图片→0+中文错误）、识别已知测试图
 * （行数/尺寸/行文本/全部文本/置信度/坐标/JSON 含字符级 chars）、句柄释放、OCR_停止；
 * Win32 侧验证 32 位降级（OCR_识别 返回 0 且错误提示 64 位）。
 * 前置：本机已装微信 4.x 且 WeChatOcr 插件已下载（OCR_取微信状态 found:true）。
 * 运行：cd electron && npm run smoke:wxocr
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'wxocr-native-smoke');
const REPORT_NAME = 'wxocr-smoke.txt';
const IMAGE_NAME = 'wxocr-smoke-test.png';

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

/** 生成已知内容测试图（PowerShell System.Drawing；脚本必须带 UTF-8 BOM，否则中文按 GBK 解析画进图会污染断言）。 */
async function generateTestImage(target: string): Promise<void> {
  const ps1 = path.join(projectDir, 'make-png.ps1');
  const body = [
    "Add-Type -AssemblyName System.Drawing",
    "$bmp = New-Object System.Drawing.Bitmap(900, 320)",
    "$g = [System.Drawing.Graphics]::FromImage($bmp)",
    "$g.Clear([System.Drawing.Color]::White)",
    "$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias",
    "$big = New-Object System.Drawing.Font('Microsoft YaHei', 28, [System.Drawing.FontStyle]::Bold)",
    "$mid = New-Object System.Drawing.Font('Microsoft YaHei', 16)",
    "$small = New-Object System.Drawing.Font('Consolas', 13)",
    "$g.DrawString('LingBuilder 微信OCR识别测试', $big, [System.Drawing.Brushes]::Black, 30, 30)",
    "$g.DrawString('中文识别质量验证：人工智能与深度学习', $mid, [System.Drawing.Brushes]::Black, 30, 120)",
    "$g.DrawString('Hello WeChat OCR 1234567890', $mid, [System.Drawing.Brushes]::DarkGray, 30, 170)",
    "$g.DrawString('phone: 186-2778-2983 email: test@qq.com', $small, [System.Drawing.Brushes]::DimGray, 30, 230)",
    "$g.Dispose()",
    `$bmp.Save('${target.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)`,
    "$bmp.Dispose()"
  ].join('\r\n');
  await fs.writeFile(ps1, '\ufeff' + body, 'utf8');
  await execFileAsync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], { windowsHide: true, timeout: 60_000 });
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('wxocr 冒烟目录越出工作区。');

  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.ocr'), builtin('lingbuilder.fs.core')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'wxocr-native-smoke',
    name: '微信OCR识别原生冒烟测试',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '微信OCR识别原生冒烟测试', width: 420, height: 240, background: '#202028', description: '借用本机微信 OCR 组件的识别与降级用例', controls: [] }]
  };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    `        @ std::remove("${REPORT_NAME}");`,
    '        @ { std::ofstream out("' + REPORT_NAME + '", std::ios::binary | std::ios::app); out << "arch " << (sizeof(void*) == 8 ? "x64" : "x86") << "\\n"; }',
    '        @ { const std::wstring st = OCR_取微信状态(); std::ofstream out("' + REPORT_NAME + '", std::ios::binary | std::ios::app); out << "status " << (st.find(L"\\"found\\":true") != std::wstring::npos ? "E" : "F") << "\\n"; }',
    '        局部 OCR结果句柄 坏图 = OCR_识别("definitely-missing-image.png")',
    // 注意：生成器会把局部声明提升到块顶，@ 行全部在声明之后执行；
    // badpath 只断言返回值（缺图必 0），错误文本断言由 native/wxocr/tests 驱动器覆盖。
    `        @ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "badpath " << (坏图 == 0 ? "E" : "F") << "\\n"; }`,
    '        @ { OCR_识别(L"missing.png"); std::ofstream out("' + REPORT_NAME + '", std::ios::binary | std::ios::app); out << "x86err " << ((sizeof(void*) != 8 && OCR_取错误().find(L"64") != std::wstring::npos) ? "E" : (sizeof(void*) == 8 ? "S" : "F")) << "\\n"; }',
    `        局部 OCR结果句柄 结果 = OCR_识别("${IMAGE_NAME}")`,
    `        @ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "ocr " << OCR结果_取行数(结果) << " " << OCR结果_取宽度(结果) << " " << OCR结果_取高度(结果) << "\\n"; }`,
    `        @ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "line0 " << lbwxocr::utf8FromWide(OCR结果_取文本(结果, 0)) << "\\n"; }`,
    `        @ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "alltext " << lbwxocr::utf8FromWide(OCR结果_取全部文本(结果, false)) << "\\n"; }`,
    `        @ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "rate " << OCR结果_取置信度(结果, 0) << "\\n"; }`,
    `        @ { const int L = OCR结果_取左坐标(结果, 0), T = OCR结果_取上坐标(结果, 0), R = OCR结果_取右坐标(结果, 0), B = OCR结果_取下坐标(结果, 0); std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "box " << ((L >= 0 && T >= 0 && R > L && R < 900 && B > T && B < 320) ? "E" : "F") << "\\n"; }`,
    `        @ { const std::wstring js = OCR结果_取JSON(结果); std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "json " << (js.find(L"\\"chars\\"") != std::wstring::npos ? "E" : "F") << "\\n"; }`,
    `        @ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "release " << (OCR结果_释放(结果) ? "E" : "F") << "\\n"; }`,
    '        局部 文件号 图片文件 = 文件_打开("' + IMAGE_NAME + '", 1, 1)',
    '        局部 字节集 图片字节 = 文件_读入字节集(图片文件, 文件_取长度(图片文件))',
    '        文件_关闭(图片文件)',
    '        局部 OCR结果句柄 字节结果 = OCR_识别字节集(图片字节)',
    `        @ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "bytes " << ((字节结果 != 0 && OCR结果_取行数(字节结果) >= 3 && lbwxocr::utf8FromWide(OCR结果_取文本(字节结果, 0)).find("LingBuilder") == 0) ? "E" : "F") << "\\n"; }`,
    `        @ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "bytesrel " << (OCR结果_释放(字节结果) ? "E" : "F") << "\\n"; }`,
    `        @ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "stop " << (OCR_停止() ? "E" : "F") << "\\n"; }`,
    `        @ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "final OK" << "\\n"; }`,
    '        结束',
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

  await generateTestImage(path.join(projectDir, IMAGE_NAME));

  const failures: string[] = [];
  for (const platform of ['x64', 'Win32'] as const) {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 })
      .catch((error: { stdout?: string; stderr?: string; message: string }) => { throw new Error(`MSBuild ${platform} 失败：\n${error.stderr || ''}${error.stdout || ''}\n${error.message}`); });
    const binDir = path.join(projectDir, platform, 'Release', 'bin');
    await fs.copyFile(path.join(projectDir, IMAGE_NAME), path.join(binDir, IMAGE_NAME));
    const executable = path.join(binDir, `${exported.projectName}.exe`);
    const run = await execFileAsync(executable, [], { cwd: binDir, windowsHide: true, timeout: 3 * 60 * 1000, maxBuffer: 1024 * 1024 }).then(() => ({}), error => ({ error }));
    const reportPath = path.join(binDir, REPORT_NAME);
    const report = await fs.readFile(reportPath, 'utf8').catch(() => '');
    if ('error' in run && !report.includes('OK')) throw new Error(`${platform} 运行未正常退出（exit=${(run.error as { code?: number }).code}）：\n${report}`);
    const problems = assertReport(platform, report);
    if (problems.length) failures.push(...problems);
    else console.log(`[${platform}] wxocr 原生冒烟 PASS`);
  }
  if (failures.length) throw new Error(failures.join('\n'));
  console.log(JSON.stringify({ ok: true, projectDir, platforms: ['x64', 'Win32'] }, null, 2));
}

function assertReport(platform: string, report: string): string[] {
  const lines = new Map(report.split('\n').filter(Boolean).map(line => {
    const space = line.indexOf(' ');
    return space < 0 ? [line, ''] : [line.slice(0, space), line.slice(space + 1)];
  }));
  const problems: string[] = [];
  const fail = (msg: string) => problems.push(`${platform} ${msg}\n${report}`);
  if (!lines.get('final')?.endsWith('OK')) fail('报告缺少 final OK');
  const arch = lines.get('arch') || '';
  if (arch !== (platform === 'x64' ? 'x64' : 'x86')) fail(`arch 行异常：期望 ${platform} 对应 arch，实际 ${arch}`);
    if (platform === 'x64') {
    if (lines.get('status') !== 'E') fail('OCR_取微信状态 未找到 found:true（微信或 WeChatOcr 插件未就绪）');
    if (lines.get('badpath') !== 'E') fail('错误路径用例失败（缺图应返回 0）');
    const ocr = lines.get('ocr') || '';
    const [lineCount, width, height] = ocr.split(' ').map(Number);
    if (!(lineCount >= 3 && width === 900 && height === 320)) fail(`识别行数/尺寸异常：${ocr || '<缺失>'}`);
    const line0 = lines.get('line0') || '';
    if (!(line0.startsWith('LingBuilder') && line0.includes('微信OCR识别测试'))) fail(`行0文本不符：${line0 || '<缺失>'}`);
    const alltext = lines.get('alltext') || '';
    if (!alltext.includes('深度学习')) fail(`全部文本缺少关键词：${alltext || '<缺失>'}`);
    const rate = Number(lines.get('rate'));
    if (!(rate > 0.5)) fail(`行0置信度异常：${lines.get('rate')}`);
    if (lines.get('box') !== 'E') fail('行0坐标越界');
    if (lines.get('json') !== 'E') fail('JSON 缺少字符级 chars 字段');
    if (lines.get('release') !== 'E') fail('OCR结果_释放 应返回真');
    if (lines.get('bytes') !== 'E') fail('OCR_识别字节集 应返回有效句柄且行0文本以 LingBuilder 开头');
    if (lines.get('bytesrel') !== 'E') fail('字节集结果释放应返回真');
    if (lines.get('stop') !== 'E') fail('OCR_停止 应返回真');
  } else {
    // Win32：全部识别命令降级（返回 0/空 + 中文错误提示 64 位）
    if (lines.get('x86err') !== 'E') fail('32 位降级错误未提示 64 位限制');
    const ocr = lines.get('ocr') || '';
    if (ocr !== '0 0 0') fail(`32 位识别应全 0：${ocr || '<缺失>'}`);
    if (lines.get('badpath') !== 'E') fail('32 位错误路径用例失败');
  }
  return problems;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
