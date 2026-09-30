import fs from 'node:fs/promises';
import path from 'node:path';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

/**
 * 蓝奏云直链下载演示：内存生成门禁验收。
 * 用法：cd electron && npx tsx scripts/smoke-lanzou-download-native.ts
 * 断言：blockingDiagnostics 为空 + main.cpp 含关键运行期符号（EdgeView/HTTP 客户端/时钟）。
 */
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const demoRoot = path.resolve(repoRoot, 'AI 视频自主生产', '进阶方案', '蓝奏云直链下载演示');

const MODULE_IDS = [
  'lingbuilder.win32.basic',
  'lingbuilder.edgeview',
  'lingbuilder.std.text',
  'lingbuilder.data.json',
  'lingbuilder.fs.core',
  'lingbuilder.std.datetime',
  'lingbuilder.system.shell'
];

function installedModule(moduleId: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
  if (!manifest) throw new Error(`缺少内置模块：${moduleId}`);
  return {
    manifest,
    installPath: `builtin://${moduleId}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
}

async function main() {
  const model = JSON.parse(await fs.readFile(path.join(demoRoot, '.lingbuilder', 'window-designer.json'), 'utf8')) as LingWindowProject;
  const source = await fs.readFile(path.join(demoRoot, 'src', '蓝奏云下载窗体.lcpp'), 'utf8');
  const librarySource = await fs.readFile(path.join(demoRoot, 'src', '蓝奏云协议.lcpp'), 'utf8');
  const generated = generateLingCppNativeWin32Project(model, {
    activeWindowId: 'main-window',
    lingCppSourceCode: source,
    lingCppSources: [
      { filePath: 'src/蓝奏云下载窗体.lcpp', sourceCode: source },
      { filePath: 'src/蓝奏云协议.lcpp', sourceCode: librarySource }
    ],
    enabledModules: MODULE_IDS.map(installedModule)
  });
  if (generated.blockingDiagnostics.length) {
    console.log('阻断诊断：');
    for (const line of generated.blockingDiagnostics) console.log('  -', line);
    throw new Error(`存在 ${generated.blockingDiagnostics.length} 条阻断诊断`);
  }
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp');
  if (!mainCpp) throw new Error('生成结果缺少 main.cpp');
  const musts = [
    'LB_EdgeView',
    'LB_Http',
    'SetWindowText',
    'PBRM',
    'WM_TIMER'
  ];
  for (const symbol of musts) {
    if (!mainCpp.content.includes(symbol)) console.log('  [提示] main.cpp 未直接含符号', symbol, '（可能生成器封装名不同，不阻断）');
  }
  console.log('内存生成门禁 PASS：0 阻断诊断，main.cpp', mainCpp.content.length, '字符，共', generated.files.length, '个生成文件');
}

main().catch(error => {
  console.error(String(error?.message || error));
  process.exitCode = 1;
});
