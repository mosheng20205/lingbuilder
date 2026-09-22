// cron 定时任务模块 MSVC 真机端到端验证：
// staging（临时目录）注入源码 → 写两份模块启用清单 → CLI project build →
// 运行 exe 12 秒（cwd=out，探针文件落在此）→ 断言探针 → 清理进程/注册表/staging。
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const cli = path.join(repoRoot, 'electron', 'dist', 'cli.cjs');
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`);
};

const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'lingbuilder-cron-e2e-'));
const outDir = path.join(staging, 'out');
fs.mkdirSync(outDir, { recursive: true });

// 1) 注入源码
const request = JSON.parse(fs.readFileSync(path.join(here, 'build-request.json'), 'utf8'));
request.lingCppSourceCode = fs.readFileSync(path.join(here, 'src', '定时任务演示.lcpp'), 'utf8');
fs.writeFileSync(path.join(staging, 'build-request.json'), JSON.stringify(request, null, 2), 'utf8');

// 2) 两份启用清单（CLI 只消费这两处，缺一不可；格式为 { schemaVersion, enabledModuleIds }）
const enabled = ['lingbuilder.win32.basic', 'lingbuilder.cron', 'lingbuilder.fs.core', 'lingbuilder.std.text'];
const manifestFor = ids => JSON.stringify({ schemaVersion: 1, enabledModuleIds: ids, pinnedVersions: {} }, null, 2);
const lingDir = path.join(staging, '.lingbuilder');
const projectLingDir = path.join(lingDir, 'projects', 'cron-timer-demo');
fs.mkdirSync(projectLingDir, { recursive: true });
fs.writeFileSync(path.join(lingDir, 'project-modules.json'), manifestFor(enabled), 'utf8');
fs.writeFileSync(path.join(projectLingDir, 'project-modules.json'), manifestFor(enabled), 'utf8');

// 3) CLI 构建（MSVC）；LINGBUILDER_RESOURCE_ROOT 供默认窗口图标解析（<root>/../image/lingbuilder-ide-icon-v2.ico）
const build = spawnSync(process.execPath, [cli, 'project', 'build', '--request', path.join(staging, 'build-request.json'), '--yes'], {
  cwd: staging, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000,
  env: { ...process.env, LINGBUILDER_RESOURCE_ROOT: path.join(repoRoot, 'image') }
});
const buildLog = (build.stdout || '') + (build.stderr || '');
fs.writeFileSync(path.join(staging, 'build-log.txt'), buildLog, 'utf8');
const exeMatch = buildLog.match(/([A-Za-z]:\\[^\s"']+\.exe)/i) || null;
let exePath = exeMatch ? exeMatch[1].replace(/\\{2,}/gu, '\\') : null;
if (!exePath) {
  const find = spawnSync('cmd.exe', ['/c', 'dir', '/s', '/b', path.join(staging, '*.exe')], { encoding: 'utf8' });
  const first = (find.stdout || '').split(/\r?\n/).find(line => line.trim().endsWith('.exe'));
  exePath = first ? first.trim() : null;
}
ok('CLI 构建产出 exe', Boolean(exePath), exePath || buildLog.slice(-800));

if (exePath) {
  // 4) 运行 exe 12 秒（cron：2 秒处理器探针 / 3 秒命令探针 / 5 秒线程探针）
  spawnSync('taskkill', ['/F', '/IM', 'LingBuilderPreview.exe'], { encoding: 'utf8' });
  fs.rmSync(path.join(outDir, 'nothing'), { force: true });
  const child = spawn(exePath, [], { cwd: outDir, detached: false, stdio: 'ignore' });
  await new Promise(resolve => setTimeout(resolve, 12000));
  spawnSync('taskkill', ['/F', '/IM', 'LingBuilderPreview.exe'], { encoding: 'utf8' });
  await new Promise(resolve => setTimeout(resolve, 800));

  const readStaging = name => {
    for (const dir of [outDir, staging, path.dirname(exePath)]) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    }
    return '';
  };
  const report = readStaging('cron-report.txt');
  // 报告以分号分隔条目（文件_追加文本 不带换行）。
  const segments = report.split(/[;]+/).map(item => item.replace(/[\r\n]/g, '')).filter(Boolean);
  const lineOf = prefix => segments.find(item => item.startsWith(prefix))?.slice(prefix.length) || '';
  ok('报告存在', report.length > 0, 'cron-report.txt');
  ok('表达式校验=真', lineOf('校验=') === '真', lineOf('校验='));
  ok('坏表达式=假', lineOf('坏表达式=') === '假', lineOf('坏表达式='));
  ok('越界分钟报错含61', lineOf('错误含61=') === '真', lineOf('错误含61='));
  ok('表达式说明=每天 02:00', lineOf('说明=').includes('每天 02:00'), lineOf('说明='));
  ok('任务A注册=真', lineOf('任务A=') === '真', lineOf('任务A='));
  ok('任务B注册=真', lineOf('任务B=') === '真', lineOf('任务B='));
  ok('状态A=等待中', lineOf('状态A=') === '等待中', lineOf('状态A='));
  ok('下次A=时间戳', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(lineOf('下次A=')), lineOf('下次A='));
  ok('任务数量≥2=真', lineOf('数量=') === '真', lineOf('数量='));
  ok('表添加=真', lineOf('表添加=') === '真', lineOf('表添加='));
  ok('表读回含表达式', lineOf('表含表达式=') === '真', lineOf('表含表达式='));
  ok('表载入=1', lineOf('载入=') === '1', lineOf('载入='));
  ok('守护启动=真', lineOf('守护=') === '真', lineOf('守护='));
  ok('守护重复启动=假', lineOf('守护重复=') === '假', lineOf('守护重复='));
  ok('守护停/复启=真真', lineOf('守护停复启=') === '真真', lineOf('守护停复启='));
  ok('邮件配置=真', lineOf('配置=') === '真', lineOf('配置='));
  ok('邮件测试被拒（无服务器）', lineOf('测试拒绝=') === '真', lineOf('测试拒绝='));
  ok('测试错误含SMTP', lineOf('测试错误有=') === '真', lineOf('测试错误有='));
  ok('开机自启=真真真真', lineOf('自启=') === '真真真真', lineOf('自启='));

  const probeA = readStaging('cron-probe-a.txt').split(/[\r\n;]+/).filter(line => /^A=\d+$/.test(line));
  ok('处理器探针 ≥3 次触发', probeA.length >= 3, 'lines=' + probeA.length);
  const probeB = readStaging('cron-probe-b.txt').split(/[\r\n;]+/).filter(line => line.trim() === 'B');
  ok('命令探针 ≥2 次触发', probeB.length >= 2, 'lines=' + probeB.length);
  const probeW = readStaging('cron-probe-w.txt').split(/[\r\n;]+/).filter(line => line.trim() === 'W');
  const probeC = readStaging('cron-probe-c.txt').split(/[\r\n;]+/).filter(line => /^C=\d+$/.test(line));
  ok('提交线程工作+完成 ≥1 组', probeW.length >= 1 && probeC.length >= 1, `W=${probeW.length} C=${probeC.length}`);
} else {
  for (const name of ['处理器探针 ≥3 次触发', '命令探针 ≥2 次触发', '提交线程工作+完成 ≥1 组']) ok(name, false, '无 exe');
}

// 5) 清理：注册表 Run 键（exe 中途崩溃时的兜底）
spawnSync('reg', ['delete', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'LingBuilderCron_cron_timer_demo', '/f'], { encoding: 'utf8' });
const failed = results.filter(item => !item.pass);
console.log(`\n==== cron-timer-demo e2e: ${results.length - failed.length}/${results.length} PASS ====`);
if (failed.length) {
  console.log('staging kept for triage: ' + staging);
  process.exit(1);
}
fs.rmSync(staging, { recursive: true, force: true });
