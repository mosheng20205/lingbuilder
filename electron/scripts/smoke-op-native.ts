/**
 * lingbuilder.op 1.0.0 OP 后台图色模块真机验收：
 * 生成窗口工程 → MSBuild x64+Win32 Release → 运行 exe → exe 写 op-smoke.txt → 脚本逐行硬断言。
 * exe 自建窗口当绑定目标（无需记事本/模拟器）：后台_创建 → 窗口_取自身句柄 → 自绘红色方块 →
 * 后台_绑定窗口(gdi/windows/windows) → 取颜色/比色/找色/多点找色/截图/找图（自匹配）→
 * 后台键鼠返回值 → 内存读写（写自身进程静态变量再读回）→ 字库族清空/计数 → 解绑/销毁。
 * 运行：cd electron && npm run smoke:op
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
import { materializeModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'op-native-smoke');
const REPORT_NAME = 'op-smoke.txt';
const CAPTURE_NAME = 'op-smoke-capture.bmp';

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('op 冒烟目录越出工作区。');

  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.op')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'op-native-smoke',
    name: 'OP后台图色原生冒烟测试',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'OP后台图色原生冒烟测试', width: 480, height: 400, background: '#FF0000', description: '自绑自测的找图找色键鼠内存闭环', controls: [] }]
  };
  // 报告行以 @ 内联 C++ 追加写入（std::ios::binary 防 \n 转 \r\n 污染行解析）。
  const out = (line: string) => `@ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << ${line} << "\\n"; }`;
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    `        @ std::remove("${REPORT_NAME}");`,
    '        @ Sleep(300);',
    '        局部 OP句柄 句柄 = 后台_创建()',
    out('"arch " + std::string(sizeof(void*) == 8 ? "x64" : "x86")'),
    out('"create " + std::string(句柄 != 0 ? "E" : "F")'),
    '        @ { std::wstring errText = 后台_取错误(); char utf8[512] = {0}; WideCharToMultiByte(CP_UTF8, 0, errText.c_str(), -1, utf8, 511, nullptr, nullptr); std::ofstream out("' + REPORT_NAME + '", std::ios::binary | std::ios::app); out << "createerr " << utf8 << "\\n"; }',
    '        局部 长整数型 自身句柄 = 窗口_取自身句柄()',
    out('"hwnd " + std::string(自身句柄 != 0 ? "E" : "F")'),
    // 创建完毕事件可能早于首次绘制：先确保窗口可见并完成一次绘制，再绑定截图。
    '        @ ShowWindow((HWND)(intptr_t)自身句柄, SW_SHOWNORMAL); UpdateWindow((HWND)(intptr_t)自身句柄); Sleep(500);',
    '        @ SetClassLongPtrW((HWND)(intptr_t)自身句柄, GCLP_HBRBACKGROUND, (LONG_PTR)CreateSolidBrush(RGB(255, 0, 0))); InvalidateRect((HWND)(intptr_t)自身句柄, nullptr, TRUE); UpdateWindow((HWND)(intptr_t)自身句柄); Sleep(400);',
    // 原子块：对持久红底（窗口类背景刷已换红）取色/比色/找色/截图一次完成。
    '        @ { Sleep(150); std::ofstream out("' + REPORT_NAME + '", std::ios::binary | std::ios::app); const std::wstring liveColor = 后台_取颜色(句柄, 300, 200); out << "getcolor " << (liveColor == L"FF0000" ? "E" : "F") << "\\n"; out << "livecolor " << std::string(liveColor.begin(), liveColor.end()) << "\\n"; out << "cmpcolor " << (后台_比色(句柄, 300, 200, L"FF0000", 1.0) ? "E" : "F") << "\\n"; int 红点横 = -1; int 红点纵 = -1; const bool 找到红 = 后台_找色(句柄, 0, 0, 479, 399, L"FF0000", 1.0, 0, &红点横, &红点纵); out << "findcolor " << ((找到红 && 红点横 == 0 && 红点纵 == 0) ? "E" : "F") << " at " << 红点横 << "," << 红点纵 << "\\n"; out << "findcolorex " << (!后台_找色全部(句柄, 0, 0, 479, 399, L"FF0000", 1.0, 0).empty() ? "E" : "F") << "\\n"; out << "capture " << (后台_截图(句柄, 0, 0, 479, 399, L"' + CAPTURE_NAME + '") ? "E" : "F") << "\\n"; }',
    out('"ver " + std::string(后台_取版本().find(L"0.4.8") != std::wstring::npos ? "E" : "F")'),
    '        局部 逻辑型 绑定成功 = 后台_绑定窗口(句柄, 自身句柄, "gdi", "windows", "windows", 0)',
    out('"bind " + std::string(绑定成功 ? "E" : "F")'),
    '        @ Sleep(300);',
    out('"bound " + std::string(后台_是否已绑定(句柄) ? "E" : "F")'),
    '        局部 文本型 模板全路径',
    '        @ { wchar_t exePath[MAX_PATH]; GetModuleFileNameW(nullptr, exePath, MAX_PATH); wchar_t* slash = wcsrchr(exePath, 92); if (slash) *slash = 0; const bool setPathOk = 后台_置全局路径(句柄, exePath); std::ofstream out("' + REPORT_NAME + '", std::ios::binary | std::ios::app); out << "setpath " << (setPathOk ? "E" : "F") << "\\n"; }',
    '        @ { wchar_t exePath[MAX_PATH]; GetModuleFileNameW(nullptr, exePath, MAX_PATH); wchar_t* slash = wcsrchr(exePath, 92); if (slash) *slash = 0; 模板全路径 = std::wstring(exePath) + L"/' + CAPTURE_NAME + '"; std::ofstream out("' + REPORT_NAME + '", std::ios::binary | std::ios::app); const bool loadOk = 后台_加载图片(句柄, 模板全路径.c_str()); out << "loadpic " << (loadOk ? "E" : "F") << "\\n"; int 图横 = -1; int 图纵 = -1; const bool 找到图 = 后台_找图(句柄, 0, 0, 479, 399, 模板全路径.c_str(), L"", 1.0, 0, &图横, &图纵); out << "findpic " << ((找到图 && 图横 == 0 && 图纵 == 0) ? "E" : "F") << " at " << 图横 << "," << 图纵 << "\\n"; out << "freepic " << (后台_释放图片(句柄, 模板全路径.c_str()) ? "E" : "F") << "\\n"; }',
    '        @ { std::ofstream out("' + REPORT_NAME + '", std::ios::binary | std::ios::app); std::ifstream in("' + CAPTURE_NAME + '", std::ios::binary | std::ios::in); char header[54] = {0}; in.read(header, 54); int w = 0, h = 0; if (header[0] == 66 && header[1] == 77) { memcpy(&w, header + 18, 4); memcpy(&h, header + 22, 4); } out << "bmpsig " << (header[0] == 66 && header[1] == 77 ? "E" : "F") << "\\n"; out << "bmpdim " << w << "x" << h << "\\n"; }',
    // 找图自匹配：整幅画面找整幅模板，sim=1.0，命中 (0,0)。
    // 后台键鼠（windows 消息模式发往自身窗口，返回值断言）。
    out('"moveto " + std::string(后台_移动到(句柄, 89, 89) ? "E" : "F")'),
    out('"click " + std::string(后台_左键单击(句柄) ? "E" : "F")'),
    out('"keypress " + std::string(后台_敲击按键(句柄, 13) ? "E" : "F")'),
    // 内存读写：写自身进程静态变量再读回（type=4 uint32）。
    '        @ static int g_lbOpSmokeValue = 0;',
    '        @ static int g_lbOpSmokeWriteOk = 0;',
    '        @ { wchar_t addrText[32]; swprintf(addrText, 32, L"%llx", (unsigned long long)(uintptr_t)&g_lbOpSmokeValue); g_lbOpSmokeWriteOk = 后台_写内存整数(句柄, 自身句柄, addrText, 4, 998877) ? 1 : 0; std::ofstream out("' + REPORT_NAME + '", std::ios::binary | std::ios::app); out << "writeint " << (g_lbOpSmokeWriteOk == 1 ? "E" : "F") << "\\n"; }',
    '        @ { wchar_t addrText[32]; swprintf(addrText, 32, L"%llx", (unsigned long long)(uintptr_t)&g_lbOpSmokeValue); long long 读回值 = 0; bool ok = 后台_读内存整数(句柄, 自身句柄, addrText, 4, &读回值); std::ofstream out("' + REPORT_NAME + '", std::ios::binary | std::ios::app); out << "readint " << ((ok && 读回值 == 998877 && g_lbOpSmokeValue == 998877) ? "E" : "F") << "\\n"; }',
    // 字库族：清空后计数应为 0。
    out('"dict " + std::string(后台_清空字库(句柄, 0) && 后台_取字库条数(句柄, 0) == 0 ? "E" : "F")'),
    // 释放模板图片 + 解绑 + 销毁。
    out('"unbind " + std::string(后台_解绑窗口(句柄) ? "E" : "F")'),
    '        后台_销毁(句柄)',
    out('"errempty " + std::string(后台_取错误().empty() ? "E" : "F")'),
    out('"final OK"'),
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
  // 与 F5 构建同路线：把启用模块的随包运行库物化进构建目录（modules 镜像 + exe 同目录），
  // vcxproj 的复制步骤只认 $(ProjectDir)modules\...，缺这步运行库不会到 bin。
  await materializeModuleNativeDependencies(enabledModules, {
    buildDir: projectDir,
    sourceDir: projectDir,
    binDir: path.join(projectDir, 'x64', 'Release', 'bin'),
    exportDir: projectDir,
    preferredTargetId: 'windows-msvc-x64'
  });
  await materializeModuleNativeDependencies(enabledModules, {
    buildDir: projectDir,
    sourceDir: projectDir,
    binDir: path.join(projectDir, 'Win32', 'Release', 'bin'),
    exportDir: projectDir,
    preferredTargetId: 'windows-msvc-win32'
  });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');

  const failures: string[] = [];
  for (const platform of ['x64', 'Win32'] as const) {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 })
      .catch((error: { stdout?: string; stderr?: string; message: string }) => { throw new Error(`MSBuild ${platform} 失败：\n${error.stderr || ''}${error.stdout || ''}\n${error.message}`); });
    const binDir = path.join(projectDir, platform, 'Release', 'bin');
    const executable = path.join(binDir, `${exported.projectName}.exe`);
    const dllLoaded = await fs.access(path.join(binDir, platform === 'x64' ? 'op_c_api_x64.dll' : 'op_c_api_x86.dll')).then(() => true, () => false);
    if (!dllLoaded) throw new Error(`${platform} 运行库未随构建复制到 exe 同目录`);
    const run = await execFileAsync(executable, [], { cwd: binDir, windowsHide: true, timeout: 3 * 60 * 1000, maxBuffer: 1024 * 1024 }).then(() => ({}), error => ({ error }));
    const reportPath = path.join(binDir, REPORT_NAME);
    const report = await fs.readFile(reportPath, 'utf8').catch(() => '');
    if ('error' in run && !report.includes('OK')) throw new Error(`${platform} 运行未正常退出（exit=${(run.error as { code?: number }).code}）：\n${report}`);
    const problems = assertReport(platform, report);
    if (problems.length) failures.push(...problems);
    else console.log(`[${platform}] op 原生冒烟 PASS`);
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
  for (const key of ['create', 'hwnd', 'ver', 'bind', 'bound', 'getcolor', 'cmpcolor', 'findcolor', 'findcolorex', 'capture', 'bmpsig', 'loadpic', 'findpic', 'moveto', 'click', 'keypress', 'writeint', 'readint', 'dict', 'freepic', 'unbind', 'errempty']) {
    const value = lines.get(key) || '';
    if (!value.startsWith('E')) fail(`${key} 用例失败：${value || '<缺失>'}`);
  }
  const findcolor = lines.get('findcolor') || '';
  if (!findcolor.includes('at 0,0')) fail(`找色首点应为左上 0,0：${findcolor || '<缺失>'}`);
  const findpic = lines.get('findpic') || '';
  if (!findpic.includes('at 0,0')) fail(`找图自匹配应命中 0,0：${findpic || '<缺失>'}`);
  return problems;
}

main().catch(error => {
  console.error('SMOKE FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
