import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'recognition-native-smoke');

/**
 * 2026-10-22 真机验收：识图 1.1.0 图色自动化（区域限定/多处匹配/等待族/字节集链路）
 * + 截图 1.1.0 字节集出口。MSVC 双平台编译 + x64 运行 21 项断言，
 * 其中 1200×2000 大图无命中基准兼做性能回归（旧逐像素取色核心会在分钟级超时）。
 */

const BACKGROUND = { r: 30, g: 40, b: 50 };
const TEMPLATE_COLOR = { r: 200, g: 60, b: 30 };
const BACKGROUND_ARGB = 4278190080 + BACKGROUND.r * 65536 + BACKGROUND.g * 256 + BACKGROUND.b;
const TEMPLATE_HITS: Array<[number, number]> = [[20, 10], [120, 80], [60, 120]];
const TEMPLATE_SIZE = 8;
const BIG_WIDTH = 1200;
const BIG_HEIGHT = 2000;

function buildBmp(width: number, height: number, paint: (x: number, y: number) => { r: number; g: number; b: number }): Buffer {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelOffset = 14 + 40;
  const buffer = Buffer.alloc(pixelOffset + rowSize * height, 0);
  buffer.write('BM', 0, 'ascii');
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(pixelOffset, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(rowSize * height, 34);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const color = paint(x, y);
      const row = height - 1 - y;
      const offset = pixelOffset + row * rowSize + x * 3;
      buffer.writeUInt8(color.b, offset);
      buffer.writeUInt8(color.g, offset + 1);
      buffer.writeUInt8(color.r, offset + 2);
    }
  }
  return buffer;
}

function paintBackground(x: number, y: number): { r: number; g: number; b: number } {
  for (const [hitX, hitY] of TEMPLATE_HITS) {
    if (x >= hitX && x < hitX + TEMPLATE_SIZE && y >= hitY && y < hitY + TEMPLATE_SIZE) return TEMPLATE_COLOR;
  }
  return BACKGROUND;
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('识图冒烟目录越出工作区。');
  }
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'recognition-native-smoke',
    name: '识图冒烟',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: '识图冒烟',
      width: 480,
      height: 320,
      background: '#1f2937',
      description: '验证 识图 1.1.0 区域/多处/等待族 与 截图 1.1.0 字节集出口可编译可运行',
      controls: []
    }]
  };
  const targetBmp = buildBmp(240, 160, paintBackground);
  const plainBmp = buildBmp(240, 160, () => BACKGROUND);
  const templateBmp = buildBmp(TEMPLATE_SIZE, TEMPLATE_SIZE, () => TEMPLATE_COLOR);
  const bigBmp = buildBmp(BIG_WIDTH, BIG_HEIGHT, () => BACKGROUND);
  const bigTemplateBmp = buildBmp(48, 48, () => ({ r: 90, g: 160, b: 90 }));
  const targetBmpSize = targetBmp.length;

  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        局部 文件号 报告',
    '        局部 整数型 记分',
    '        局部 整数型 数量',
    '        局部 文件号 号',
    '        局部 长整数型 大小',
    '        局部 字节集 帧数据',
    '        局部 字节集 模板数据',
    '        局部 字节集 屏图',
    '        报告 = 文件_打开("识图smoke结果.txt", 4, 1)',
    '        号 = 文件_打开("目标.bmp", 1, 1)',
    '        帧数据 = 文件_读入字节集(号, 16777216)',
    '        文件_关闭(号)',
    '        号 = 文件_打开("模板.bmp", 1, 1)',
    '        模板数据 = 文件_读入字节集(号, 16777216)',
    '        文件_关闭(号)',
    `        大小 = 字节集_取无符号32(帧数据, 2, 假)`,
    '        文件_写出文本(报告, "bmp大小=" + 到文本(大小) + "\\n")',
    '        记分 = 0',
    '        如果真 (识图_模板匹配("目标.bmp", "模板.bmp", 4))',
    '            记分 = 1',
    '        如果真结束',
    '        文件_写出文本(报告, "单点=" + 到文本(记分) + "@" + 到文本(识图_取结果横坐标()) + "," + 到文本(识图_取结果纵坐标()) + "\\n")',
    '        记分 = 0',
    '        如果真 (识图_模板匹配("目标.bmp", "模板.bmp", 4, 100, 0, 140, 160))',
    '            记分 = 1',
    '        如果真结束',
    '        文件_写出文本(报告, "区域=" + 到文本(记分) + "@" + 到文本(识图_取结果横坐标()) + "," + 到文本(识图_取结果纵坐标()) + "\\n")',
    '        记分 = 0',
    '        如果真 (识图_模板匹配("目标.bmp", "模板.bmp", 4, 0, 0, 15, 160))',
    '            记分 = 1',
    '        如果真结束',
    '        文件_写出文本(报告, "排除=" + 到文本(记分) + "\\n")',
    '        记分 = 0',
    '        如果真 (识图_模板匹配字节集(帧数据, 模板数据, 4))',
    '            记分 = 1',
    '        如果真结束',
    '        文件_写出文本(报告, "字节集=" + 到文本(记分) + "@" + 到文本(识图_取结果横坐标()) + "," + 到文本(识图_取结果纵坐标()) + "\\n")',
    '        数量 = 识图_模板匹配全部("目标.bmp", "模板.bmp", 4)',
    '        文件_写出文本(报告, "多处=" + 到文本(数量) + ";" + 到文本(识图_取第N横坐标(1)) + "," + 到文本(识图_取第N纵坐标(1)) + ";" + 到文本(识图_取第N横坐标(2)) + "," + 到文本(识图_取第N纵坐标(2)) + ";" + 到文本(识图_取第N横坐标(3)) + "," + 到文本(识图_取第N纵坐标(3)) + "\\n")',
    '        数量 = 识图_模板匹配全部("目标.bmp", "模板.bmp", 4, 0, 0, 0, 0, 0, 200)',
    '        文件_写出文本(报告, "抑制=" + 到文本(数量) + "\\n")',
    '        数量 = 识图_模板匹配全部("目标.bmp", "模板.bmp", 4, 0, 0, 0, 0, 2, 0)',
    '        文件_写出文本(报告, "上限=" + 到文本(数量) + "\\n")',
    '        记分 = 0',
    `        如果真 (识图_查找颜色("目标.bmp", ${BACKGROUND_ARGB}, 2))`,
    '            记分 = 1',
    '        如果真结束',
    '        文件_写出文本(报告, "找色=" + 到文本(记分) + "@" + 到文本(识图_取结果横坐标()) + "," + 到文本(识图_取结果纵坐标()) + "\\n")',
    '        记分 = 0',
    `        如果真 (识图_查找颜色("目标.bmp", ${BACKGROUND_ARGB}, 2, 30, 0, 200, 160))`,
    '            记分 = 1',
    '        如果真结束',
    '        文件_写出文本(报告, "区域找色=" + 到文本(记分) + "@" + 到文本(识图_取结果横坐标()) + "," + 到文本(识图_取结果纵坐标()) + "\\n")',
    '        记分 = 0',
    '        如果真 (识图_等待出现("目标.bmp", "模板.bmp", 4, 2000, 50))',
    '            记分 = 1',
    '        如果真结束',
    '        文件_写出文本(报告, "等出=" + 到文本(记分) + "@" + 到文本(识图_取结果横坐标()) + "," + 到文本(识图_取结果纵坐标()) + "\\n")',
    '        记分 = 0',
    '        如果真 (识图_等待出现("无模板.bmp", "模板.bmp", 4, 300, 50))',
    '            记分 = 1',
    '        如果真结束',
    '        文件_写出文本(报告, "等出假=" + 到文本(记分) + "\\n")',
    '        记分 = 0',
    '        如果真 (识图_等待消失("无模板.bmp", "模板.bmp", 4, 300, 50))',
    '            记分 = 1',
    '        如果真结束',
    '        文件_写出文本(报告, "等消真=" + 到文本(记分) + "\\n")',
    '        记分 = 0',
    '        如果真 (识图_等待消失("目标.bmp", "模板.bmp", 4, 300, 50))',
    '            记分 = 1',
    '        如果真结束',
    '        文件_写出文本(报告, "等消假=" + 到文本(记分) + "\\n")',
    '        记分 = 0',
    '        如果真 (识图_等待出现字节集(帧数据, 模板数据, 4, 500, 50))',
    '            记分 = 1',
    '        如果真结束',
    '        文件_写出文本(报告, "等出字节=" + 到文本(记分) + "\\n")',
    '        屏图 = 截图_区域到字节集(0, 0, 64, 48)',
    '        文件_写出文本(报告, "截图=" + 到文本(字节集_取字节(屏图, 0)) + "," + 到文本(字节集_取字节(屏图, 1)) + "\\n")',
    '        记分 = 0',
    '        如果真 (识图_模板匹配("大图基准.bmp", "模板大.bmp", 8))',
    '            记分 = 1',
    '        如果真结束',
    '        文件_写出文本(报告, "基准=" + 到文本(记分) + "\\n")',
    '        文件_关闭(报告)',
    '        结束()',
    '    结束',
    '结束类'
  ].join('\n');

  const enabledModules: InstalledModule[] = ['lingbuilder.fs.core', 'lingbuilder.std.bytes', 'lingbuilder.image.recognition', 'lingbuilder.image.capture'].map(moduleId => {
    const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
    if (!manifest) throw new Error(`缺少内置模块：${moduleId}`);
    return { manifest, installPath: `builtin://${moduleId}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  });
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: source,
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules
  });
  if (generated.blockingDiagnostics.length) {
    throw new Error(generated.blockingDiagnostics.join('\n'));
  }
  const expected = [
    `bmp大小=${targetBmpSize}`,
    '单点=1@20,10',
    '区域=1@120,80',
    '排除=0',
    '字节集=1@20,10',
    '多处=3;20,10;120,80;60,120',
    '抑制=1',
    '上限=2',
    '找色=1@0,0',
    '区域找色=1@30,0',
    '等出=1@20,10',
    '等出假=0',
    '等消真=1',
    '等消假=0',
    '等出字节=1',
    '截图=137,80',
    '基准=0',
    ''
  ].join('\n');

  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const resourcesDir = path.join(projectDir, 'resources');
  await fs.mkdir(resourcesDir, { recursive: true });
  await fs.copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'), path.join(resourcesDir, 'lingbuilder-app.ico'));
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  const msbuild = await findMsbuild();
  let executable = '';
  for (const platform of ['x64', 'Win32']) {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], {
      cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024
    });
    executable = path.join(projectDir, platform === 'x64' ? 'x64' : 'Win32', 'Release', 'bin', `${exported.projectName}.exe`);
    await fs.access(executable);
    console.log(`PASS MSVC ${platform} 编译：${executable}`);
  }
  const executableDir = path.dirname(executable);
  await fs.writeFile(path.join(executableDir, '目标.bmp'), targetBmp);
  await fs.writeFile(path.join(executableDir, '无模板.bmp'), plainBmp);
  await fs.writeFile(path.join(executableDir, '模板.bmp'), templateBmp);
  await fs.writeFile(path.join(executableDir, '大图基准.bmp'), bigBmp);
  await fs.writeFile(path.join(executableDir, '模板大.bmp'), bigTemplateBmp);
  const startedAt = Date.now();
  await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 120_000, maxBuffer: 1024 * 1024 });
  const elapsed = Date.now() - startedAt;
  const actual = await fs.readFile(path.join(executableDir, '识图smoke结果.txt'), 'utf8');
  if (actual !== expected) {
    const actualLines = actual.split('\n');
    const expectedLines = expected.split('\n');
    const diffs = expectedLines.filter((line, index) => actualLines[index] !== line).map(line => `  期望 [${line}] 实际 [${actualLines[expectedLines.indexOf(line)] ?? '<缺失>'}]`);
    throw new Error(`识图冒烟结果不符：\n${diffs.join('\n')}`);
  }
  if (elapsed >= 60_000) throw new Error(`识图冒烟运行耗时 ${elapsed}ms，超过 60s 性能门限（疑似退化到逐像素取色核心）。`);
  console.log(`PASS 17 项运行断言全对（含多处匹配顺序/重叠抑制/等待族/截图字节集 PNG 头）`);
  console.log(`PASS 性能：1200×2000 大图无命中基准 + 全部用例共 ${elapsed}ms（旧逐像素核心为分钟~小时级）`);
  console.log(JSON.stringify({ ok: true, projectDir, elapsedMs: elapsed }, null, 2));
}

async function findMsbuild(): Promise<string> {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, [
    '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'
  ], { windowsHide: true, timeout: 30_000 })).stdout.trim();
  return path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
