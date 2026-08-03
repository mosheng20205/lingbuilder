import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { materializeModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { OPENCV_RUNTIME } from '../src/services/windowDesigner/opencvRuntime';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'opencv-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main() {
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.opencv')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'opencv-native-smoke',
    name: 'OpenCV 原生烟雾测试',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'OpenCV 原生烟雾测试', width: 360, height: 180, background: '#202028', description: '验证 OpenCV Bridge', controls: [] }]
  };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        @ int failures = 0;',
    '        @ auto check = [&](bool value) { if (!value) ++failures; };',
    '        @ long long background = OpenCV_加载图像(L"背景测试.bmp", L"彩色");',
    '        @ long long piece = OpenCV_加载图像(L"滑块测试.bmp", L"彩色");',
    '        @ check(background != 0 && piece != 0);',
    '        @ check(OpenCV_取宽度(background) == 320 && OpenCV_取高度(background) == 160);',
    '        @ long long gray = OpenCV_灰度化(background);',
    '        @ long long resized = OpenCV_缩放(gray, 160, 80);',
    '        @ check(gray != 0 && OpenCV_取通道数(gray) == 1);',
    '        @ check(resized != 0 && OpenCV_取宽度(resized) == 160 && OpenCV_取高度(resized) == 80);',
    '        @ long long result = OpenCV_分析缺口(background, piece, 2, L"{\\"minScore\\":0.20,\\"minSeparation\\":50,\\"minWidth\\":20,\\"minHeight\\":20}");',
    '        @ check(result != 0);',
    '        @ check(OpenCV结果_取数量(result) == 2);',
    '        @ int firstX = OpenCV结果_取横坐标(result, 0), secondX = OpenCV结果_取横坐标(result, 1);',
    '        @ check(std::abs(firstX - 100) <= 2 && std::abs(secondX - 220) <= 2);',
    '        @ check(OpenCV结果_保存标注图(result, L"opencv-annotated.png", 95));',
    '        @ check(OpenCV结果_取JSON(result) != L"");',
    '        @ OpenCV结果_释放(result); OpenCV_释放图像(resized); OpenCV_释放图像(gray); OpenCV_释放图像(piece); OpenCV_释放图像(background);',
    '        @ FILE* report = nullptr; _wfopen_s(&report, L"opencv-native-smoke.txt", L"wb");',
    '        @ if (report) { fputs(failures == 0 ? "OK\\n" : "FAIL\\n", report); fclose(report); }',
    '        @ ExitProcess(failures == 0 ? 0 : 2);',
    '    结束',
    '结束类'
  ].join('\n');

  const generated = generateLingCppNativeWin32Project(project, { enabledModules, lingCppSourceCode: source });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  const generatedCpp = generated.files.find(file => file.relativePath.endsWith('.cpp'))?.content || '';
  if (!generatedCpp.includes('OpenCV_分析缺口') || !generatedCpp.includes('LB_OCV_AnalyzeGap')) {
    throw new Error('LingCpp 生成结果没有包含 OpenCV 中文包装或 Bridge 符号。');
  }
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  const smokeFiles = [{ relativePath: 'opencv_smoke.cpp', content: createStandaloneSmokeSource() }];
  for (const file of smokeFiles) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const layout = { buildDir: projectDir, sourceDir: projectDir, binDir: path.join(projectDir, 'bin'), exportDir: projectDir, preferredTargetId: 'windows-msvc-x64' };
  const dependencies = await materializeModuleNativeDependencies(enabledModules, layout);
  if (dependencies.blockingDiagnostics.length) throw new Error(dependencies.blockingDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({
    projectDir,
    projectId: project.id,
    generatedFiles: smokeFiles,
    enabledModules,
    requiredCppStandard: dependencies.requiredCppStandard,
    requiresDynamicCrt: dependencies.requiresDynamicCrt
  });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  const executableDir = path.dirname(executable);
  await writeBmp(path.join(executableDir, '背景测试.bmp'), 320, 160, [[100, 50, 40, 40], [220, 50, 40, 40]]);
  await writeBmp(path.join(executableDir, '滑块测试.bmp'), 40, 40, [[0, 0, 40, 40]]);
  await writeBmp(path.join(executableDir, '空白测试.bmp'), 80, 80, []);
  const demoAssetRoot = path.join(repoRoot, 'assets', 'module-demo-lingbuilder.opencv');
  await fs.copyFile(path.join(demoAssetRoot, 'OpenCV缺口背景.png'), path.join(executableDir, 'OpenCV缺口背景.png'));
  await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 2 * 60 * 1000, maxBuffer: 1024 * 1024 });
  const report = await fs.readFile(path.join(executableDir, 'opencv-native-smoke.txt'), 'utf8');
  if (!report.trim().startsWith('OK ')) throw new Error(`OpenCV 原生验证失败：\n${report}`);
  await fs.copyFile(path.join(executableDir, 'OpenCV缺口验证标注.png'), path.join(demoAssetRoot, 'OpenCV缺口验证标注.png'));
  for (const name of ['LingBuilderOpenCvBridge.dll', 'opencv_core4140.dll', 'opencv_imgproc4140.dll', 'opencv_imgcodecs4140.dll']) {
    await fs.access(path.join(executableDir, name));
  }
  console.log(JSON.stringify({ ok: true, projectDir, executable, report: report.trim() }, null, 2));
}

function createStandaloneSmokeSource(): string {
  return String.raw`#define UNICODE
#define _UNICODE
#define NOMINMAX
#define WIN32_LEAN_AND_MEAN
#define LINGBUILDER_OPENCV_MODULE 1
#include <windows.h>
#include <atomic>
#include <cmath>
#include <cstdio>
#include <string>
#include <thread>
#include <vector>

static thread_local std::wstring g_return_text;
static const wchar_t* LB_ReturnText(const std::wstring& value) {
  g_return_text = value;
  return g_return_text.c_str();
}

${OPENCV_RUNTIME}

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
  int failures = 0;
  const auto check = [&](bool value, int bit) { if (!value) failures |= bit; };
  const long long background = OpenCV_加载图像(L"背景测试.bmp", L"彩色");
  const long long piece = OpenCV_加载图像(L"滑块测试.bmp", L"彩色");
  check(background != 0 && piece != 0, 1);
  check(OpenCV_取宽度(background) == 320 && OpenCV_取高度(background) == 160, 2);
  const long long gray = OpenCV_灰度化(background);
  const long long resized = OpenCV_缩放(gray, 160, 80);
  const long long cropped = OpenCV_裁剪(background, 100, 50, 40, 40);
  const long long blurred = OpenCV_高斯模糊(gray, 5, 0.0);
  const long long binary = OpenCV_二值化(gray, 128.0, L"二值");
  const long long adaptive = OpenCV_自适应二值化(gray, 11, 2.0, false);
  const long long edges = OpenCV_Canny边缘(gray, 50.0, 150.0);
  const long long morphology = OpenCV_形态学(edges, L"闭运算", 3, 1);
  check(gray != 0 && OpenCV_取通道数(gray) == 1, 4);
  check(resized != 0 && OpenCV_取宽度(resized) == 160 && OpenCV_取高度(resized) == 80, 8);
  check(cropped != 0 && blurred != 0 && binary != 0 && adaptive != 0 && edges != 0 && morphology != 0, 512);
  const long long templateResult = OpenCV_模板匹配(background, piece, L"相关系数", 0.2, 2);
  check(templateResult != 0 && OpenCV结果_取数量(templateResult) == 2, 1024);
  const long long result = OpenCV_分析缺口(background, piece, 2, L"{\"minScore\":0.20,\"minSeparation\":50,\"minWidth\":20,\"minHeight\":20}");
  check(result != 0, 16);
  check(OpenCV结果_取数量(result) == 2, 32);
  const int firstX = OpenCV结果_取横坐标(result, 0);
  const int secondX = OpenCV结果_取横坐标(result, 1);
  check((std::abs(firstX - 100) <= 2 && std::abs(secondX - 220) <= 2)
    || (std::abs(firstX - 220) <= 2 && std::abs(secondX - 100) <= 2), 64);
  check(OpenCV结果_保存标注图(result, L"opencv-annotated.png", 95), 128);
  check(std::wstring(OpenCV结果_取JSON(result)).find(L"\"candidates\"") != std::wstring::npos, 256);
  std::atomic<int> concurrentFailures{0};
  std::vector<std::thread> readers;
  for (int index = 0; index < 8; ++index) readers.emplace_back([&]() {
    for (int read = 0; read < 500; ++read) if (OpenCV_取宽度(background) != 320) ++concurrentFailures;
  });
  for (auto& reader : readers) reader.join();
  check(concurrentFailures.load() == 0, 2048);
  const long long invalidConfig = OpenCV_分析缺口(background, piece, 1, L"{\"blurKernel\":4}");
  check(invalidConfig == 0 && std::wstring(OpenCV_取错误()).find(L"奇数") != std::wstring::npos, 4096);
  const long long blank = OpenCV_加载图像(L"空白测试.bmp", L"彩色");
  const long long emptyResult = OpenCV_分析缺口(blank, 0, 1, L"{\"minScore\":1.0}");
  check(emptyResult != 0 && OpenCV结果_取数量(emptyResult) == 0, 8192);
  const long long demoGapImage = OpenCV_加载图像(L"OpenCV缺口背景.png", L"彩色");
  const long long demoGapResult = OpenCV_分析缺口(demoGapImage, 0, 1, L"{\"mode\":\"contour\",\"roiX\":290,\"roiY\":80,\"roiWidth\":170,\"roiHeight\":160,\"minWidth\":60,\"minHeight\":80,\"maxWidth\":130,\"maxHeight\":140,\"minScore\":0.2}");
  const int demoGapX = OpenCV结果_取横坐标(demoGapResult, 0);
  const int demoGapY = OpenCV结果_取纵坐标(demoGapResult, 0);
  const int demoGapWidth = OpenCV结果_取宽度(demoGapResult, 0);
  const int demoGapHeight = OpenCV结果_取高度(demoGapResult, 0);
  check(demoGapImage != 0 && demoGapResult != 0 && OpenCV结果_取数量(demoGapResult) == 1, 65536);
  check(std::abs(demoGapX - 330) <= 3 && std::abs(demoGapY - 108) <= 3, 131072);
  check(std::abs(demoGapWidth - 100) <= 5 && std::abs(demoGapHeight - 110) <= 5, 262144);
  check(OpenCV结果_保存标注图(demoGapResult, L"OpenCV缺口验证标注.png", 95), 524288);
  OpenCV结果_释放(demoGapResult);
  OpenCV_释放图像(demoGapImage);
  OpenCV结果_释放(emptyResult);
  OpenCV_释放图像(blank);
  OpenCV结果_释放(templateResult);
  OpenCV结果_释放(result);
  OpenCV_释放图像(morphology);
  OpenCV_释放图像(edges);
  OpenCV_释放图像(adaptive);
  OpenCV_释放图像(binary);
  OpenCV_释放图像(blurred);
  OpenCV_释放图像(cropped);
  OpenCV_释放图像(resized);
  OpenCV_释放图像(gray);
  OpenCV_释放图像(piece);
  check(OpenCV_释放图像(background) && !OpenCV_释放图像(background), 16384);
  const long long limitSource = OpenCV_加载图像(L"空白测试.bmp", L"彩色");
  std::vector<long long> limitHandles;
  for (int index = 0; index < 260; ++index) limitHandles.push_back(OpenCV_克隆图像(limitSource));
  check(limitSource != 0 && limitHandles[254] != 0 && limitHandles[255] == 0, 32768);
  OpenCV_释放全部();
  FILE* report = nullptr;
  _wfopen_s(&report, L"opencv-native-smoke.txt", L"wb");
  if (report) {
    if (failures == 0) std::fprintf(report, "OK DEMO=%d,%d,%d,%d\n", demoGapX, demoGapY, demoGapWidth, demoGapHeight);
    else std::fprintf(report, "FAIL %d X=%d,%d DEMO=%d,%d,%d,%d\n", failures, firstX, secondX, demoGapX, demoGapY, demoGapWidth, demoGapHeight);
    std::fclose(report);
  }
  return failures == 0 ? 0 : 2;
}
`;
}

async function writeBmp(target: string, width: number, height: number, outlines: number[][]): Promise<void> {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelSize = rowSize * height;
  const bytes = Buffer.alloc(54 + pixelSize, 0);
  bytes.write('BM', 0, 'ascii');
  bytes.writeUInt32LE(bytes.length, 2);
  bytes.writeUInt32LE(54, 10);
  bytes.writeUInt32LE(40, 14);
  bytes.writeInt32LE(width, 18);
  bytes.writeInt32LE(height, 22);
  bytes.writeUInt16LE(1, 26);
  bytes.writeUInt16LE(24, 28);
  bytes.writeUInt32LE(pixelSize, 34);
  bytes.fill(255, 54);
  const setBlack = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = 54 + (height - 1 - y) * rowSize + x * 3;
    bytes[offset] = bytes[offset + 1] = bytes[offset + 2] = 0;
  };
  for (const [x, y, w, h] of outlines) {
    for (let px = x; px < x + w; ++px) { setBlack(px, y); setBlack(px, y + h - 1); }
    for (let py = y; py < y + h; ++py) { setBlack(x, py); setBlack(x + w - 1, py); }
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
