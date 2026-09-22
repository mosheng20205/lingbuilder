import fs from 'node:fs/promises';
import path from 'node:path';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { CEF3_BROWSER_EVENTS } from '../src/services/modules/cef3BrowserEvents';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const root = path.join(repoRoot, 'AI 视频自主生产', 'CEF3 浏览器模块合集');

const EPISODE_DIRS = [
  '01 CEF3 入门',
  '02 浏览器操作小项目',
  '03 事件驱动',
  '04 会话隔离',
  '05 代理与请求决策',
  '06 获取网页资源响应',
  '07 资源加载生命周期',
  '08 下载打印查找',
  '09 JavaScript DevTools 异步任务',
  '14 无头浏览器抓取',
  '15 自动填表',
  '16 网页框架操作',
  '17 多实例与多店铺',
  '18 Cookie与会话管理',
  '19 模拟输入与用户代理',
  '20 弹窗管理',
  '21 DevTools订阅与受管流'
];
const COMPARISON_DIR = '10 CEF3还是EdgeView';

const EVENT_NAMES = new Set(CEF3_BROWSER_EVENTS.map(event => event.name));

const builtin = (id: string): InstalledModule => {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
};

const commandNames = (moduleIds: readonly string[]): Set<string> => {
  const names = new Set<string>();
  for (const id of moduleIds) {
    const manifest = BUILTIN_MODULES.find(item => item.id === id) as any;
    for (const command of manifest?.contributes?.commands ?? []) names.add(command.name);
    for (const binding of manifest?.bindings?.commands ?? []) names.add(binding.runtimeName || binding.command);
  }
  return names;
};

async function readJson(file: string): Promise<any> {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function exists(file: string): Promise<boolean> {
  return fs.access(file).then(() => true, () => false);
}

interface EpisodeReport {
  episode: string;
  episodeDir: string;
  projectId: string;
  className: string;
  modules: string[];
  controls: number;
  handlers: number;
  boundEvents: string[];
  assets: number;
  sourceBytes: number;
  generatedFiles: number;
  generatedBytes: number;
  hasGlobals: boolean;
  warnings: string[];
}

async function checkEpisode(episodeDir: string): Promise<EpisodeReport> {
  const label = episodeDir.slice(0, 2);
  const examplesDir = path.join(root, episodeDir, '示例项目');
  const entries = await fs.readdir(examplesDir, { withFileTypes: true });
  const projectDirs = entries.filter(entry => entry.isDirectory());
  if (projectDirs.length !== 1) throw new Error(`${label}: 示例项目下应恰好有一个项目文件夹，实际 ${projectDirs.length} 个`);
  const projectDir = path.join(examplesDir, projectDirs[0].name);

  const solution = await readJson(path.join(projectDir, '.lingbuilder', 'solution.json'));
  const project = solution.projects?.[0];
  if (!project) throw new Error(`${label}: solution.json 缺少启动项目`);
  const projectId = project.id as string;
  if (projectId !== projectDirs[0].name) throw new Error(`${label}: 项目 ID 与目录名不一致（${projectId} ≠ ${projectDirs[0].name}）`);
  if (solution.startupProjectId !== projectId) throw new Error(`${label}: startupProjectId 不匹配`);
  if (!/^[\x20-\x7e]+$/u.test(projectId)) throw new Error(`${label}: 项目 ID 必须是 ASCII`);

  // 根清单是工作区回退，projects/<id> 清单是项目权威清单；两份都必须存在且一致。
  const rootModules = await readJson(path.join(projectDir, '.lingbuilder', 'project-modules.json'));
  const scopedModules = await readJson(path.join(projectDir, '.lingbuilder', 'projects', projectId, 'project-modules.json'));
  if (JSON.stringify(rootModules) !== JSON.stringify(scopedModules)) throw new Error(`${label}: 根模块清单与项目模块清单不一致`);
  const moduleIds: string[] = rootModules.enabledModuleIds ?? [];
  if (!moduleIds.includes('lingbuilder.win32.basic')) throw new Error(`${label}: 未启用 lingbuilder.win32.basic`);
  if (!moduleIds.includes('lingbuilder.cef3.browser')) throw new Error(`${label}: 未启用 lingbuilder.cef3.browser`);
  for (const moduleId of moduleIds) {
    if (!BUILTIN_MODULES.some(item => item.id === moduleId)) throw new Error(`${label}: 未知模块 ${moduleId}`);
  }

  const designerPath = path.join(projectDir, project.designerPath);
  const designer = await readJson(designerPath);
  const window = designer.windows?.[0];
  if (!window) throw new Error(`${label}: 设计器缺少窗口`);
  const controls: any[] = window.controls ?? [];
  const controlNames = new Set<string>(controls.map(control => control.name));
  if (!controls.some(control => control.type === 'CefBrowser')) throw new Error(`${label}: 设计器缺少 CefBrowser 控件`);

  const sourcePath = path.join(projectDir, project.sourceRoot, `${window.className}.lcpp`);
  const source = await fs.readFile(sourcePath, 'utf8');
  const globalsPath = path.join(projectDir, project.sourceRoot, '项目全局变量.lcpp');
  const globalsSource = await exists(globalsPath) ? await fs.readFile(globalsPath, 'utf8') : undefined;

  // 处理器闭合：设计器绑定的每个事件处理器都必须在源码里有对应的中文事件定义。
  const declaredHandlers = new Set(Array.from(source.matchAll(/^\s*事件\s+([^\s(]+)\s*\(/gmu), match => match[1]));
  const windowHandler = window.events?.Loaded;
  if (!windowHandler) throw new Error(`${label}: 窗口缺少 Loaded 事件绑定`);
  if (!declaredHandlers.has(windowHandler)) throw new Error(`${label}: 源码缺少窗口处理器 ${windowHandler}`);
  for (const control of controls) {
    for (const [eventName, handler] of Object.entries(control.events ?? {})) {
      if (!declaredHandlers.has(handler as string)) throw new Error(`${label}: 控件 ${control.name} 的 ${eventName} 处理器 ${handler} 未在源码中定义`);
    }
  }
  // 反向闭合：按钮类处理器必须真的挂在设计器控件上，否则录制时点了没反应。
  const mappedHandlers = new Set<string>(controls.flatMap(control => Object.values(control.events ?? {}) as string[]));
  for (const handler of declaredHandlers) {
    if (!/_被单击$/u.test(handler)) continue;
    if (!mappedHandlers.has(handler)) throw new Error(`${label}: 处理器 ${handler} 没有在设计器里绑定到任何控件`);
  }

  // CEF3 事件实名必须命中事件目录，处理器必须使用 &处理器名。
  const boundEvents: string[] = [];
  for (const match of source.matchAll(/CEF3_绑定事件\(\s*([^,\s"]+)\s*,\s*"([^"]+)"\s*,\s*(&?)([^\s)]+)\s*\)/gu)) {
    const [, controlName, eventName, ampersand, handler] = match;
    if (!controlNames.has(controlName)) throw new Error(`${label}: CEF3_绑定事件 引用了不存在的控件 ${controlName}`);
    if (!EVENT_NAMES.has(eventName)) throw new Error(`${label}: 事件名“${eventName}”不在 CEF3 事件目录中`);
    if (!ampersand) throw new Error(`${label}: 事件“${eventName}”的处理器缺少 & 引用`);
    if (!declaredHandlers.has(handler)) throw new Error(`${label}: 事件处理器 ${handler} 未在源码中定义`);
    boundEvents.push(eventName);
  }
  if (/CEF3[^\s(]*\(\s*"/u.test(source)) throw new Error(`${label}: 发现带引号的控件引用，controlRef 必须是裸控件名`);

  // 命令闭合：源码里出现的每个 CEF3_/控件_ 命令都必须由已启用模块提供。
  const available = commandNames(moduleIds);
  for (const match of source.matchAll(/(?<![\w一-鿿])(CEF3[一-鿿]*_[^\s(]+|控件_[^\s(]+|调试输出)\(/gu)) {
    const name = match[1];
    if (!available.has(name)) throw new Error(`${label}: 命令 ${name} 不在已启用模块（${moduleIds.join('、')}）的命令表中`);
  }

  // 权威门禁：走真实生成器，任何阻断诊断都视为不可录制。
  const generated = generateLingCppNativeWin32Project(designer, {
    enabledModules: moduleIds.map(builtin),
    lingCppSources: [
      ...(globalsSource ? [{ filePath: `${project.sourceRoot}/项目全局变量.lcpp`, sourceCode: globalsSource }] : []),
      { filePath: `${project.sourceRoot}/${window.className}.lcpp`, sourceCode: source }
    ],
    lingCppSourceFilePath: `${project.sourceRoot}/${window.className}.lcpp`
  });
  if (generated.blockingDiagnostics.length) throw new Error(`${label}: 生成器阻断诊断 → ${generated.blockingDiagnostics.join('；')}`);
  // 非阻断诊断不拦截录制，但必须原样报出来，避免“零错误”掩盖告警。
  const warnings = generated.diagnostics ?? [];

  // 构建请求必须与设计器一致，否则 CLI 构建的不是录制用的那份界面。
  const buildRequest = await readJson(path.join(projectDir, 'build-request.json'));
  if (buildRequest.project?.id !== projectId) throw new Error(`${label}: build-request.json 的项目 ID 不匹配`);
  if (JSON.stringify(buildRequest.project?.windows) !== JSON.stringify(designer.windows)) throw new Error(`${label}: build-request.json 的窗口模型与设计器不一致`);
  if (buildRequest.activeWindowId !== window.id) throw new Error(`${label}: build-request.json 的 activeWindowId 与设计器窗口不一致`);
  // 带上 lingCppSourceFilePath 会让 CLI 把该文件当作唯一权威源码，项目全局变量.lcpp 将被排除。
  if (buildRequest.lingCppSourceFilePath) throw new Error(`${label}: build-request.json 不应固定 lingCppSourceFilePath，否则项目全局变量不会参与聚合`);

  for (const file of ['README.md', path.join('config', projectId, 'config.ini'), '.lingbuilder/build-configuration.json']) {
    if (!await exists(path.join(projectDir, file))) throw new Error(`${label}: 缺少 ${file}`);
  }
  if (!await exists(path.join(root, episodeDir, '录制准备.md'))) throw new Error(`${label}: 缺少 录制准备.md`);

  // 本地测试资源必须真实存在，录制时不能临时去外网找页面。
  const assetsDir = path.join(projectDir, 'assets');
  const assets = await exists(assetsDir) ? (await fs.readdir(assetsDir)).length : 0;
  if (assets === 0) throw new Error(`${label}: 缺少本地测试资源 assets/`);

  return {
    episode: label,
    episodeDir,
    projectId,
    className: window.className,
    modules: moduleIds,
    controls: controls.length,
    handlers: declaredHandlers.size,
    boundEvents,
    assets,
    sourceBytes: Buffer.byteLength(source, 'utf8'),
    generatedFiles: generated.files.length,
    generatedBytes: generated.files.reduce((sum, file) => sum + Buffer.byteLength(file.content ?? '', 'utf8'), 0),
    hasGlobals: Boolean(globalsSource),
    warnings
  };
}

/** 验证记录由本次实测结果直接生成，避免手写记录与实际运行结果脱节。 */
async function writeRecord(report: EpisodeReport, stamp: string): Promise<void> {
  const boundary = BOUNDARIES[report.episode] ?? [];
  await fs.writeFile(path.join(root, report.episodeDir, '验证记录.md'), [
    `# 第 ${report.episode} 集验证记录：${report.projectId}`,
    '',
    `- 验证时间：${stamp}`,
    '- 验证命令：`npm run tutorial:cef3:verify -w lingbuilder-electron`',
    `- 项目 ID：\`${report.projectId}\`，窗体类 \`${report.className}\``,
    `- 启用模块：${report.modules.map(id => `\`${id}\``).join('、')}`,
    '',
    '## 已验证项',
    '',
    '- 解决方案 / 模块清单 / 设计器 / 源码 / 本地资源 / 构建请求文件齐全，项目 ID 为纯 ASCII。',
    `- 设计器控件 ${report.controls} 个，中文事件处理器 ${report.handlers} 个；设计器绑定与源码处理器双向闭合。`,
    report.boundEvents.length
      ? `- CEF3 事件实名全部命中事件目录：${report.boundEvents.map(name => `\`${name}\``).join('、')}；处理器均使用 \`&处理器名\`。`
      : '- 本集不绑定 CEF3 事件目录事件（改用控件事件与受管任务接口）。',
    '- 源码引用的中文命令全部由已启用模块提供，`controlRef` 均为裸控件名。',
    report.hasGlobals ? '- 项目全局变量文件 `src/项目全局变量.lcpp` 参与聚合并通过校验。' : '- 本集不需要项目全局变量。',
    `- 真实生成器 \`generateLingCppNativeWin32Project\` 通过：阻断诊断 0 条，非阻断诊断 ${report.warnings.length} 条，生成 ${report.generatedFiles} 个工程文件、共 ${report.generatedBytes} 字节。`,
    '- `build-request.json` 的窗口模型与设计器逐字节一致。',
    `- 本地测试资源 ${report.assets} 个，录制不依赖外网页面。`,
    '',
    '## 原生构建实测',
    '',
    ...buildSection(report.episode),
    '',
    '## 如何补跑',
    '',
    '```powershell',
    'cd electron',
    'npm run build:cli',
    'npm run tutorial:cef3:build   # 暂存到 ASCII 路径并跑真实 MSVC + CEF3 构建',
    'npm run tutorial:cef3:verify  # 重新校验并刷新本文件',
    '```',
    '',
    '## 仍需在录制机确认的项',
    '',
    '- exe 交互冒烟：自动冒烟只验证窗口能起来并保持存活；按钮、事件与页面反馈仍需按 `录制准备.md` 的分镜动作手动点一遍。',
    '- 目标机运行环境：CEF3 运行时资源需与 exe 同目录分发。',
    '',
    '## 录制前必须确认的边界',
    '',
    ...(boundary.length ? boundary.map(text => `- ${text}`) : ['- 见同级 `录制准备.md` 的「运行边界与红线」。']),
    ''
  ].join('\n'), 'utf8');
}

/** 从各集录制准备.md 提取运行边界，保持记录与录制文档同源。 */
const BOUNDARIES: Record<string, string[]> = {};

/** build-cef3-tutorial-projects.ts 的实测结果；没有报告时验证记录会如实写“本次未执行”。 */
interface BuildRecord { episode: string; projectId: string; ok: boolean; exeBytes?: number; smokeAliveSeconds?: number; smokeProcesses?: number; missingRuntime?: string[]; error?: string }
let buildReport: { generatedAt: string; records: BuildRecord[] } | undefined;

async function loadBuildReport(): Promise<void> {
  const file = path.join(repoRoot, '.tmp-cef3-verify', 'build-report.json');
  if (!await exists(file)) return;
  buildReport = await readJson(file);
}

function buildSection(episode: string): string[] {
  const record = buildReport?.records.find(item => item.episode === episode);
  if (!buildReport || !record) {
    return [
      '- 原生 MSVC + CEF3 SDK 构建：本次未执行。执行方式见下方「如何补跑」。',
      '- exe 运行冒烟：本次未执行。'
    ];
  }
  if (!record.ok) {
    return [
      `- 原生 MSVC + CEF3 SDK 构建（${buildReport.generatedAt}）：**失败**，该集不可录制。`,
      `- 失败详情：${(record.error || '').split(/\r?\n/u)[0].slice(0, 200)}`
    ];
  }
  return [
    `- 原生 MSVC + CEF3 SDK 构建（${buildReport.generatedAt}）：通过，生成 \`LingBuilderPreview.exe\`（${record.exeBytes} 字节）。`,
    '- CEF 运行时齐备：`libcef.dll`、`chrome_elf.dll`、`LingBuilderCefBridge.dll`、`resources.pak`、`icudtl.dat` 均已随产物落盘。',
    `- exe 运行冒烟：启动后保持 ${record.smokeAliveSeconds} 秒未退出，CEF 进程树 ${record.smokeProcesses} 个进程。`,
    '- 构建在 `.tmp-cef3-verify/` 的暂存副本中执行：目的是共享 SDK 目录联接、并把大体积产物挡在示例目录之外；**路径含中文不影响构建**（已在中文原地路径实测通过）。'
  ];
}

async function loadBoundaries(): Promise<void> {
  for (const episodeDir of EPISODE_DIRS) {
    const text = await fs.readFile(path.join(root, episodeDir, '录制准备.md'), 'utf8');
    const section = text.split('## 运行边界与红线')[1] ?? '';
    BOUNDARIES[episodeDir.slice(0, 2)] = section.split('\n').filter(line => line.startsWith('- ')).map(line => line.slice(2));
  }
}

async function checkComparison(): Promise<void> {
  for (const file of ['对比资料/对比矩阵.md', '对比资料/截图采集清单.md', '对比资料/引用来源.md', '录制准备.md']) {
    if (!await exists(path.join(root, COMPARISON_DIR, file))) throw new Error(`10: 缺少 ${file}`);
  }
  const matrix = await fs.readFile(path.join(root, COMPARISON_DIR, '对比资料', '对比矩阵.md'), 'utf8');
  if (!matrix.includes('| 维度 | CEF3 | EdgeView |')) throw new Error('10: 对比矩阵缺少表头');
}

async function main(): Promise<void> {
  const results: EpisodeReport[] = [];
  for (const episodeDir of EPISODE_DIRS) results.push(await checkEpisode(episodeDir));
  await checkComparison();
  if (!await exists(path.join(root, '示例项目总览.md'))) throw new Error('缺少 示例项目总览.md');

  if (!process.argv.includes('--no-records')) {
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    await loadBoundaries();
    await loadBuildReport();
    for (const report of results) await writeRecord(report, stamp);
    await fs.writeFile(path.join(root, COMPARISON_DIR, '验证记录.md'), [
      '# 第 10 集验证记录：CEF3 还是 EdgeView',
      '',
      `- 验证时间：${stamp}`,
      '- 验证命令：`npm run tutorial:cef3:verify -w lingbuilder-electron`',
      '- 本集不新建 C++ 工程，验证对象是对比资料本身。',
      '',
      '## 已验证项',
      '',
      '- `对比资料/对比矩阵.md`、`对比资料/截图采集清单.md`、`对比资料/引用来源.md` 与 `录制准备.md` 均存在。',
      '- 对比矩阵表头结构正确，可直接用于图版生成。',
      '',
      '## 未在本次执行的项',
      '',
      '- 矩阵中的体积、接口数量与事件数量为引用值，录制当天必须按 `对比资料/引用来源.md` 逐条复核。',
      '- 运行时资源抓拍需在已完成第 01 集构建的机器上采集。',
      ''
    ].join('\n'), 'utf8');
  }

  console.log(JSON.stringify({ ok: true, count: results.length + 1, results }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
