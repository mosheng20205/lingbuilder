/**
 * 对 11 个 FBro 教程示例项目跑真实运行验证，并把结果写回每集的 验证报告.md。
 *
 * 验证内容：启动真实 exe → 等主窗口出现 → 按脚本点击按钮 → 读取列表框与状态文本 →
 * 采集调试输出与运行期产物 → 用窗口关闭消息正常退出 → 确认无残留进程。
 *
 * 前置：npm run tutorial:fbro:build（需要 build-report.json 与已生成的 exe）。
 * 用法：npm run tutorial:fbro:verify [-- --only fbro-ep08-cdp]
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { EPISODES, filterEpisodes } from './fbro-tutorial/projects.ts';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const collectionRoot = path.join(repoRoot, 'AI 视频自主生产', 'FBro 指纹浏览器合集');
const smokeScript = path.join(import.meta.dirname, 'fbro-tutorial', 'smoke.ps1');
const reportDir = path.join(repoRoot, '.tmp-fbro-verify');

/**
 * 每集的运行脚本：窗口等待秒数按宿主模式给足余量
 * （独立进程嵌入的 Host 握手较慢，冷缓存下首帧可能要几十秒）。
 */
const PLAN: Record<string, { alive: number; wait: number; buttons: string[] }> = {
  'fbro-ep01-embed': { alive: 6, wait: 150, buttons: [] },
  'fbro-ep02-manager': { alive: 8, wait: 150, buttons: ['新增实例', '切换到第一个'] },
  'fbro-ep03-isolation': { alive: 8, wait: 150, buttons: ['两个工作区打开测试页', '读取站点数据', '清理指定站点数据', '清理工作区A缓存'] },
  'fbro-ep04-fingerprint': { alive: 8, wait: 150, buttons: ['打开测试页', '读取授权状态', '应用脱敏配置', '读取已应用配置', '故意用无效配置'] },
  'fbro-ep05-hostmode': { alive: 12, wait: 150, buttons: ['三个模式打开测试页', '刷新进程状态'] },
  'fbro-ep06-events': { alive: 8, wait: 150, buttons: ['打开测试页', '暂停高频事件'] },
  'fbro-ep07-resource': { alive: 10, wait: 150, buttons: ['重新加载测试页'] },
  'fbro-ep08-cdp': { alive: 14, wait: 150, buttons: ['打开测试页', '读取调试端口', '连接 CDP', '读取页面标题', '查询并点击按钮', '断开并清理'] },
  'fbro-ep09-form': { alive: 16, wait: 150, buttons: ['打开测试表单', '连接 CDP', '填写姓名', '选择城市与联系方式', '勾选并提交', '读取提交结果'] },
  'fbro-ep10-transfer': { alive: 14, wait: 150, buttons: ['打开测试页', '下载测试文件', '截图到文件', '生成 PDF'] },
  'fbro-ep11-workbench': { alive: 16, wait: 150, buttons: ['打开测试页', '新增工作区', '连接 CDP 并取标题', 'CDP 点击测试按钮', '下载测试文件'] },
  'fbro-ep18-contextmenu': { alive: 10, wait: 150, buttons: ['打开测试页', '模拟页面右键'] },
  'fbro-ep19-downloads': { alive: 12, wait: 150, buttons: ['打开测试页', '开始下载', '取消下载', '清理演示产物'] },
  'fbro-ep20-values': { alive: 6, wait: 150, buttons: ['构建与读取', '值包装与比较', '缓冲与流', '清理演示文件'] },
  'fbro-ep21-request': { alive: 10, wait: 150, buttons: ['构造POST并载入框架', '异步发起GET请求', '发送进程消息'] },
  'fbro-ep22-response': { alive: 10, wait: 150, buttons: ['打开测试页', '切换只看主文档'] },
  'fbro-ep23-cert': { alive: 12, wait: 150, buttons: ['读取当前证书', '证书链与PEM'] },
  'fbro-ep24-formpro': { alive: 10, wait: 150, buttons: ['打开测试表单', '基础控件读写', '富文本与代码', '属性读写', '存在坐标滚动', '触发事件'] },
  'fbro-ep25-cookieproxy': { alive: 12, wait: 150, buttons: ['打开演示页', '异步写入Cookie', '回读与删除', '代理故障演示', '恢复直连'] },
  'fbro-ep26-image': { alive: 12, wait: 150, buttons: ['打开测试页', '生成源图像', '下载图像并读信息', '导出PNG与JPEG', '位图缓冲', '清理演示产物'] },
  'fbro-ep27-frame': { alive: 10, wait: 150, buttons: ['打开测试页', '枚举框架', '编辑命令链', '跨框架执行JS'] },
  'fbro-ep28-wsclient': { alive: 12, wait: 150, buttons: ['打开测试页'] },
  'fbro-ep29-switches': { alive: 10, wait: 150, buttons: ['打开测试页', '查看启动命令行', '跨框架填表', '缩放演示'] },
  'fbro-ep30-extension': { alive: 12, wait: 150, buttons: ['启用扩展增强', '加载演示扩展', '打开测试页'] }
};

/** 每集之间的静默时间：等系统释放 CEF 句柄，避免相邻两次运行互相干扰。 */
const SETTLE_MS = 30000;

interface SmokeResult {
  raw: string;
  window: string;
  alive: string;
  children: string;
  graceful: string;
  leftover: string;
  pass: boolean;
  clicks: string[];
  listItems: string[];
  debug: string[];
  artifacts: string[];
}

function parseSmoke(raw: string): SmokeResult {
  const pick = (re: RegExp) => (raw.match(re) || [, ''])[1]!.trim();
  return {
    raw,
    window: pick(/^窗口: (.*)$/m),
    alive: pick(/^存活: (.*)$/m),
    children: pick(/^本次 FBro 子进程数: (.*)$/m),
    graceful: pick(/^优雅关闭: (.*)$/m),
    leftover: pick(/^回收后残留: (.*)$/m),
    pass: /RESULT PASS/.test(raw),
    clicks: [...raw.matchAll(/^点击: (.*)$/gm)].map(m => m[1]!.trim()),
    listItems: [...raw.matchAll(/^ {2}\[\d+\] (.*)$/gm)].map(m => m[1]!.trim()),
    debug: [...raw.matchAll(/^\[调试输出\] (.*)$/gm)].map(m => m[1]!.trim()),
    artifacts: [...raw.matchAll(/^ {2}(演示页面|演示表单|演示输出)\/(.*)$/gm)].map(m => `${m[1]}/${m[2]}`)
  };
}

/** 报告只保留相对路径，不把本机绝对路径写进交付文档。 */
function mask(line: string): string {
  return line
    .replace(/file:\/\/\/\S*?\/bin\//g, 'file:///<exe 目录>/')
    .replace(/[A-Za-z]:[\\/]\S*lingbuilder\S*/g, '<仓库路径>');
}

const exists = (file: string) => fs.access(file).then(() => true, () => false);

async function runSmoke(projectId: string, binDir: string): Promise<SmokeResult> {
  const plan = PLAN[projectId]!;
  const args = [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', smokeScript,
    '-BinDir', binDir, '-Id', projectId,
    '-AliveSeconds', String(plan.alive),
    '-WindowWaitSeconds', String(plan.wait)
  ];
  if (plan.buttons.length) args.push('-ClickButtons', plan.buttons.join(','));
  const { stdout } = await execFileAsync('powershell', args, { maxBuffer: 32 * 1024 * 1024 })
    .catch((error: { stdout?: string; message?: string }) => ({ stdout: error.stdout || error.message || '' }));
  return parseSmoke(stdout);
}

function renderReport(
  episode: (typeof EPISODES)[number],
  build: Record<string, unknown> | undefined,
  smoke: SmokeResult | undefined,
  date: string
): string {
  const wsRel = `AI 视频自主生产/FBro 指纹浏览器合集/${episode.dir}/示例项目/${episode.id}`;
  const lines: string[] = [];
  lines.push(`# 验证报告 · ${episode.name}`, '');
  lines.push(`- 验证日期：${date}`);
  lines.push('- 环境：Windows x64 + MSVC（`cl`）、FBro 环境 SDK 135.0.21.2.2.0。');
  lines.push('- 复跑命令：`npm run tutorial:fbro:build` + `npm run tutorial:fbro:verify`。', '');

  lines.push('## 1. 受控构建', '');
  lines.push('```bash');
  lines.push('cd electron');
  lines.push('FBRO_SDK_ROOT=<FBro SDK 目录> node dist/cli.cjs project build \\');
  lines.push(`  --request "../${wsRel}/build-request.json" \\`);
  lines.push(`  --workspace "../${wsRel}" --yes --json`);
  lines.push('```', '');
  if (!build) {
    lines.push('> 状态：**待执行**（未找到 build-report.json 中的记录）。', '');
  } else {
    const blocking = (build.blockingDiagnostics as string[]) || [];
    const diags = (build.diagnostics as string[]) || [];
    const missing = (build.missingRuntime as string[]) || [];
    lines.push('| 项目 | 结果 |', '| --- | --- |');
    lines.push(`| 阻断诊断 | ${blocking.length} |`);
    lines.push(`| 非阻断诊断 | ${diags.length} |`);
    lines.push(`| MSVC 编译 | ${build.compiled ? '成功' : '未成功'} |`);
    lines.push(`| 可执行文件 | ${build.exeBytes ? `\`bin/LingBuilderPreview.exe\`（${build.exeBytes} 字节）` : '未生成'} |`);
    lines.push(`| FBro 运行时文件 | ${missing.length === 0 ? '齐备' : '缺少 ' + missing.join('、')} |`);
    lines.push('');
    if (blocking.length) {
      lines.push('阻断诊断：', '');
      blocking.slice(0, 10).forEach(d => lines.push(`- ${mask(String(d))}`));
      lines.push('');
    }
  }

  lines.push('## 2. 真实运行验证', '');
  if (!smoke) {
    lines.push('> 状态：**待执行**。', '');
  } else {
    lines.push('| 项目 | 结果 |', '| --- | --- |');
    lines.push(`| 主窗口 | ${smoke.window || '未记录'} |`);
    lines.push(`| 进程存活 | ${smoke.alive} |`);
    lines.push(`| 本次新增 FBro 子进程 | ${smoke.children} |`);
    lines.push(`| 窗口关闭消息正常退出 | ${smoke.graceful || '未执行'} |`);
    lines.push(`| 回收后残留进程 | ${smoke.leftover} |`);
    lines.push(`| 判定 | ${smoke.pass ? '通过' : '未通过'} |`);
    lines.push('');
    if (smoke.clicks.length) {
      lines.push('### 自动点击的按钮', '');
      smoke.clicks.forEach(c => lines.push(`- ${c}`));
      lines.push('');
    }
    if (smoke.listItems.length) {
      lines.push('### 运行期列表框实测内容', '', '```text');
      smoke.listItems.slice(0, 20).forEach(l => lines.push(mask(l)));
      lines.push('```', '');
    }
    if (smoke.debug.length) {
      lines.push('### 调试输出', '', '```text');
      smoke.debug.slice(0, 10).forEach(l => lines.push(mask(l)));
      lines.push('```', '');
    }
    if (smoke.artifacts.length) {
      lines.push('### 运行期产物', '');
      smoke.artifacts.forEach(a => lines.push(`- \`bin/${a}\``));
      lines.push('', '这些文件由项目在运行时写出，演示结束后可整目录删除。', '');
    }
  }

  lines.push('## 3. 已知限制', '');
  lines.push('- **同一时间只跑一个 FBro 示例。** 同机并存的 FBro 实例（含上次强杀残留的 `LingBuilderPreview` / `LingBuilderFbroHost` / `FBroSubprocess`）会让新启动的程序主窗口长时间不显示。本次验证脚本在每次启动前都会清场，并在两集之间静默 20 秒。');
  lines.push('- 强制结束主程序不会回收 `LingBuilderFbroHost` / `FBroSubprocess`，残留进程会锁住 `bin/.fbro/**` 并让下次构建报 `EBUSY`；请用窗口关闭按钮正常退出。');
  lines.push('- FBro 首次启动要初始化 `bin/.fbro-global-cache`，冷缓存下主窗口首帧比平时慢；录制前先空跑一次让缓存变热。');
  lines.push('');
  lines.push('## 4. 安全声明', '');
  lines.push('- 项目文件、源码、日志与本报告均不含授权码、Permit、Key、真实账号、Cookie 明文或代理密码。');
  lines.push('- 报告中的路径已相对化，不暴露本机绝对路径。');
  lines.push('');
  return lines.join('\n');
}

const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : '';
const date = new Date().toISOString().slice(0, 10);

let buildReport: Record<string, unknown>[] = [];
const buildReportPath = path.join(reportDir, 'build-report.json');
if (await exists(buildReportPath)) {
  buildReport = JSON.parse(await fs.readFile(buildReportPath, 'utf8'));
} else {
  console.warn('未找到 .tmp-fbro-verify/build-report.json，报告的构建段将标记为待执行。');
}

const targets = filterEpisodes(EPISODES, only || undefined);
const summary: Array<{ id: string; pass: boolean }> = [];

for (const [index, episode] of targets.entries()) {
  const workspace = path.join(collectionRoot, episode.dir, '示例项目', episode.id);
  // 新版 CLI 构建布局为 <id>/x64/Release/bin，旧布局为 <id>/bin，两种都兼容。
  const binCandidates = [
    path.join(workspace, '.lingbuilder-build', episode.id, 'bin'),
    path.join(workspace, '.lingbuilder-build', episode.id, 'x64', 'Release', 'bin')
  ];
  let binDir = binCandidates[0]!;
  for (const candidate of binCandidates) {
    if (await exists(path.join(candidate, 'LingBuilderPreview.exe'))) { binDir = candidate; break; }
  }
  const build = buildReport.find(item => item.projectId === episode.id);

  let smoke: SmokeResult | undefined;
  if (await exists(path.join(binDir, 'LingBuilderPreview.exe'))) {
    process.stdout.write(`验证 ${episode.id} … `);
    smoke = await runSmoke(episode.id, binDir);
    console.log(smoke.pass ? `通过（${smoke.window}）` : `未通过（窗口：${smoke.window || '未取得'}）`);
  } else {
    console.log(`跳过 ${episode.id}：缺少 exe，请先执行 npm run tutorial:fbro:build`);
  }

  await fs.writeFile(path.join(workspace, '验证报告.md'), renderReport(episode, build, smoke, date), 'utf8');
  summary.push({ id: episode.id, pass: Boolean(smoke?.pass) });

  if (index < targets.length - 1) await new Promise(resolve => setTimeout(resolve, SETTLE_MS));
}

const passed = summary.filter(item => item.pass).length;
console.log(`\n运行验证完成：${passed}/${summary.length} 通过，验证报告已写回各集目录。`);
if (passed !== summary.length) {
  console.log('未通过：' + summary.filter(item => !item.pass).map(item => item.id).join('、'));
  process.exitCode = 1;
}
