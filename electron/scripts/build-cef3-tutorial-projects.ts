/**
 * 把 CEF3 教程示例项目复制到 .tmp-cef3-verify 暂存副本，跑真实 MSVC + CEF3 SDK 构建。
 *
 * 暂存的两个理由（都不是「中文路径」——中文原地路径实测可以正常构建）：
 *   1. 每个示例项目自己就是一个工作区，需要 .lingbuilder/modules 里的 CEF3 SDK；
 *      暂存副本用目录联接共享仓库根的 SDK，避免每集复制几百 MB。
 *   2. 构建产物（.lingbuilder-build 带整套 CEF 运行时、generated/）体积很大，
 *      不该落进随仓库分发的示例目录。
 * 结果写进 build-report.json，供 verify-cef3-tutorial-projects.ts 写入各集验证记录。
 *
 * 前置：已执行 npm run build:cli，且工作区 .lingbuilder/modules 下已安装 lingbuilder.cef3.sdk。
 */
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const root = path.join(repoRoot, 'AI 视频自主生产', 'CEF3 浏览器模块合集');
const stageRoot = path.join(repoRoot, '.tmp-cef3-verify');
const cli = path.join(repoRoot, 'electron', 'dist', 'cli.cjs');
const modulesDir = path.join(repoRoot, '.lingbuilder', 'modules');

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

/** 构建产物里必须出现的 CEF 运行时文件，缺一个都不能拿去录制。 */
const REQUIRED_RUNTIME = ['libcef.dll', 'chrome_elf.dll', 'LingBuilderCefBridge.dll', 'resources.pak', 'icudtl.dat'];

interface BuildRecord {
  episode: string;
  projectId: string;
  ok: boolean;
  exeBytes?: number;
  runtimeFiles?: string[];
  missingRuntime?: string[];
  /** 启动 exe 后仍存活的秒数；0 表示启动即退出。 */
  smokeAliveSeconds?: number;
  smokeProcesses?: number;
  error?: string;
}

const SMOKE_SECONDS = 6;

/** 启动原生窗口并保持数秒，确认 CEF 进程树真的起来了，而不是编译通过就算数。 */
async function smoke(binDir: string): Promise<{ aliveSeconds: number; processes: number }> {
  const child = spawn(path.join(binDir, 'LingBuilderPreview.exe'), [], { cwd: binDir, detached: true, stdio: 'ignore' });
  try {
    await new Promise(resolve => setTimeout(resolve, SMOKE_SECONDS * 1000));
    if (child.exitCode !== null) return { aliveSeconds: 0, processes: 0 };
    const { stdout } = await execFileAsync('cmd', ['/c', 'tasklist', '/NH'], { maxBuffer: 8 * 1024 * 1024 });
    const processes = (stdout.match(/LingBuilderPreview[.]exe/gu) || []).length;
    return { aliveSeconds: SMOKE_SECONDS, processes };
  } finally {
    await execFileAsync('cmd', ['/c', 'taskkill', '/PID', String(child.pid), '/T', '/F']).catch(() => undefined);
  }
}

const exists = (file: string) => fs.access(file).then(() => true, () => false);

/** 兼容两种产物布局：新构建路径服务带 x64/Debug 子目录，旧布局平铺 bin/。 */
async function findBinDir(stagedDir: string, projectId: string): Promise<string | null> {
  const buildRoot = path.join(stagedDir, '.lingbuilder-build', projectId);
  const candidates = [path.join(buildRoot, 'bin'), path.join(buildRoot, 'x64', 'Debug', 'bin'), path.join(buildRoot, 'x64', 'Release', 'bin')];
  for (const dir of candidates) {
    if (await exists(path.join(dir, 'LingBuilderPreview.exe'))) return dir;
  }
  return null;
}

/** --smoke-only：复用已有暂存副本，只重跑运行冒烟。 */
async function reuseStage(episodeDir: string): Promise<{ projectId: string; dir: string }> {
  const examplesDir = path.join(root, episodeDir, '示例项目');
  const [entry] = (await fs.readdir(examplesDir, { withFileTypes: true })).filter(item => item.isDirectory());
  if (!entry) throw new Error(`${episodeDir}: 找不到示例项目文件夹`);
  const dir = path.join(stageRoot, entry.name);
  if (!await exists(dir)) throw new Error(`${episodeDir}: 缺少暂存副本，请先不带 --smoke-only 执行一次。`);
  return { projectId: entry.name, dir };
}

async function stage(episodeDir: string): Promise<{ projectId: string; dir: string }> {
  const examplesDir = path.join(root, episodeDir, '示例项目');
  const [entry] = (await fs.readdir(examplesDir, { withFileTypes: true })).filter(item => item.isDirectory());
  if (!entry) throw new Error(`${episodeDir}: 找不到示例项目文件夹`);
  const dir = path.join(stageRoot, entry.name);
  // 录屏客户端可能正开着这份暂存工作区，Windows 上会让 rm 报 ENOTEMPTY/EBUSY。
  // 重试几次；仍然失败就明确提示是被占用，而不是抛一个看不懂的 fs 错误。
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      break;
    } catch (error: any) {
      if (attempt >= 5) {
        throw new Error(`清理暂存目录失败（${error.code}）：${dir}
`
          + '多半是录屏用的 Electron 客户端或 dev server 还开着这份工作区，先关掉再重跑。');
      }
      await new Promise(resolve => setTimeout(resolve, 800 * attempt));
    }
  }
  await fs.cp(path.join(examplesDir, entry.name), dir, { recursive: true });
  // 用目录联接共享已安装的 CEF3 SDK，避免每集复制数百 MB。
  await execFileAsync('cmd', ['/c', 'mklink', '/J', path.join(dir, '.lingbuilder', 'modules'), modulesDir]);
  return { projectId: entry.name, dir };
}

async function buildOne(episodeDir: string, skipBuild: boolean): Promise<BuildRecord> {
  const episode = episodeDir.slice(0, 2);
  let projectId = '';
  try {
    const staged = skipBuild ? await reuseStage(episodeDir) : await stage(episodeDir);
    projectId = staged.projectId;
    let buildLog = '';
    if (!skipBuild) {
      const buildResult = await execFileAsync(process.execPath, [
        cli, 'project', 'build',
        '--request', path.join(staged.dir, 'build-request.json'),
        '--workspace', staged.dir,
        '--yes', '--json'
      ], { maxBuffer: 64 * 1024 * 1024, cwd: path.join(repoRoot, 'electron') });
      buildLog = `${buildResult.stdout}\n${buildResult.stderr}`;
    }

    const binDir = await findBinDir(staged.dir, projectId);
    if (!binDir) {
      const logs = JSON.stringify(buildLog).match(/"logs":\s*\[[\s\S]*?\]/)?.[0];
      const compileFail = buildLog.match(/error C\d+:[^\\n]*|LCPP[^\n"]*错误[^\n"]*|阻止构建[^\n"]*/g)?.slice(0, 8).join('\n');
      throw new Error(`构建结束但未生成 LingBuilderPreview.exe\n${compileFail || logs || buildLog.slice(-800)}`);
    }
    const exe = path.join(binDir, 'LingBuilderPreview.exe');
    const runtimeFiles = await fs.readdir(binDir);
    const missingRuntime = REQUIRED_RUNTIME.filter(name => !runtimeFiles.includes(name));
    if (missingRuntime.length) throw new Error(`缺少 CEF 运行时文件：${missingRuntime.join('、')}`);
    const result = await smoke(binDir);
    if (result.aliveSeconds === 0) throw new Error('exe 启动后立即退出，运行冒烟未通过');
    return {
      episode, projectId, ok: true,
      exeBytes: (await fs.stat(exe)).size,
      runtimeFiles,
      smokeAliveSeconds: result.aliveSeconds,
      smokeProcesses: result.processes
    };
  } catch (error: any) {
    const detail = String(error?.stdout || error?.stderr || error?.message || error);
    return { episode, projectId, ok: false, error: detail.slice(-1200) };
  }
}

async function main(): Promise<void> {
  if (!await exists(cli)) throw new Error('缺少 electron/dist/cli.cjs，请先执行 npm run build:cli。');
  if (!await exists(path.join(modulesDir, 'lingbuilder.cef3.sdk'))) throw new Error('缺少 lingbuilder.cef3.sdk，请先在工作区安装并校验 CEF3 SDK。');
  await fs.mkdir(stageRoot, { recursive: true });

  const skipBuild = process.argv.includes('--smoke-only');
  // 可选位置参数：只构建集号前缀匹配的子集，例如 `--episodes 14,15,16`。
  const episodeFilterArg = process.argv.find(arg => arg.startsWith('--episodes='));
  const episodeFilter = episodeFilterArg ? episodeFilterArg.slice('--episodes='.length).split(',').map(item => item.trim()) : [];
  const targetDirs = episodeFilter.length
    ? EPISODE_DIRS.filter(dir => episodeFilter.some(prefix => dir.startsWith(prefix)))
    : EPISODE_DIRS;
  if (episodeFilter.length && !targetDirs.length) throw new Error(`--episodes 过滤没有命中任何集目录：${episodeFilter.join('、')}`);
  const records: BuildRecord[] = [];
  for (const episodeDir of targetDirs) {
    const record = await buildOne(episodeDir, skipBuild);
    records.push(record);
    console.error(`${record.episode} ${record.ok ? 'OK' : 'FAIL'}${record.ok ? ` exe=${record.exeBytes} smoke=${record.smokeAliveSeconds}s/${record.smokeProcesses}进程` : ''}`);
  }

  const now = new Date();
  const report = {
    generatedAt: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    stageRoot,
    records
  };
  await fs.writeFile(path.join(stageRoot, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: records.every(record => record.ok), count: records.length, records: records.map(({ error, runtimeFiles, ...rest }) => rest) }, null, 2));
  if (!records.every(record => record.ok)) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
