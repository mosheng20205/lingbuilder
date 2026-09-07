/**
 * 对 11 个 FBro 教程示例项目跑真实受控构建（LingBuilder CLI → 生成 C++ → MSVC 编译）。
 *
 * 结果写入 .tmp-fbro-verify/build-report.json，供 verify-fbro-tutorial-projects.ts 写回各集验证报告。
 *
 * 前置：
 *   1. npm run build:cli
 *   2. 已安装 FBro 环境 SDK；若不在工作区 .lingbuilder/modules 下，用 FBRO_SDK_ROOT 指向 SDK 目录。
 *
 * 用法：npm run tutorial:fbro:build
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { EPISODES } from './fbro-tutorial/projects.ts';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const collectionRoot = path.join(repoRoot, 'AI 视频自主生产', 'FBro 指纹浏览器合集');
const cli = path.join(repoRoot, 'electron', 'dist', 'cli.cjs');
const reportDir = path.join(repoRoot, '.tmp-fbro-verify');

/** 构建产物里必须出现的 FBro 运行时文件，缺一个都不能拿去录制。 */
const REQUIRED_RUNTIME = [
  'LingBuilderFbroBridge.dll',
  'FBroSubprocess.exe',
  'FBrowserCEF3lib.dll',
  'libcef.dll',
  'icudtl.dat',
  'resources.pak'
];

interface BuildRecord {
  episode: string;
  projectId: string;
  name: string;
  ok: boolean;
  blockingDiagnostics: string[];
  diagnostics: string[];
  compiled: boolean;
  exePath?: string;
  exeBytes?: number;
  missingRuntime?: string[];
  error?: string;
}

const exists = (file: string) => fs.access(file).then(() => true, () => false);

function resolveSdkRoot(): string | undefined {
  if (process.env.FBRO_SDK_ROOT) return process.env.FBRO_SDK_ROOT;
  const workspaceSdk = path.join(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.fbro.sdk', 'sdk');
  return workspaceSdk;
}

async function buildOne(episode: (typeof EPISODES)[number]): Promise<BuildRecord> {
  const workspace = path.join(collectionRoot, episode.dir, '示例项目', episode.id);
  const record: BuildRecord = {
    episode: episode.dir,
    projectId: episode.id,
    name: episode.name,
    ok: false,
    blockingDiagnostics: [],
    diagnostics: [],
    compiled: false
  };

  if (!await exists(path.join(workspace, 'build-request.json'))) {
    record.error = '缺少 build-request.json，请先执行 npm run tutorial:fbro:generate';
    return record;
  }

  let stdout = '';
  try {
    const result = await execFileAsync(process.execPath, [
      cli, 'project', 'build',
      '--request', path.join(workspace, 'build-request.json'),
      '--workspace', workspace,
      '--yes', '--json'
    ], {
      cwd: path.join(repoRoot, 'electron'),
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, FBRO_SDK_ROOT: resolveSdkRoot() }
    });
    stdout = result.stdout;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    record.error = (err.stderr || err.message || '构建命令失败').trim().slice(0, 800);
    return record;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(stdout);
  } catch {
    record.error = `构建输出不是 JSON：${stdout.slice(0, 400)}`;
    return record;
  }

  record.blockingDiagnostics = (payload.blockingDiagnostics as string[]) || [];
  record.diagnostics = (payload.diagnostics as string[]) || [];
  const logs = (payload.logs as string[]) || [];
  record.compiled = logs.some(line => /编译成功/.test(line));
  record.exePath = payload.exePath as string | undefined;

  if (record.exePath && await exists(record.exePath)) {
    record.exeBytes = (await fs.stat(record.exePath)).size;
    const binDir = path.dirname(record.exePath);
    const missing: string[] = [];
    for (const file of REQUIRED_RUNTIME) {
      if (!await exists(path.join(binDir, file))) missing.push(file);
    }
    record.missingRuntime = missing;
  }

  record.ok = payload.ok === true
    && record.blockingDiagnostics.length === 0
    && record.compiled
    && Boolean(record.exeBytes)
    && (record.missingRuntime || []).length === 0;
  return record;
}

const records: BuildRecord[] = [];
for (const episode of EPISODES) {
  process.stdout.write(`构建 ${episode.id} … `);
  const record = await buildOne(episode);
  records.push(record);
  console.log(record.ok
    ? `通过（阻断诊断 ${record.blockingDiagnostics.length}，exe ${record.exeBytes} 字节）`
    : `未通过：${record.error || record.blockingDiagnostics[0] || '编译或运行时文件缺失'}`);
}

await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'build-report.json'), JSON.stringify(records, null, 2), 'utf8');

const failed = records.filter(item => !item.ok);
console.log(`\n构建完成：${records.length - failed.length}/${records.length} 通过。报告：.tmp-fbro-verify/build-report.json`);
if (failed.length) {
  console.log('未通过：' + failed.map(item => item.projectId).join('、'));
  process.exitCode = 1;
} else {
  console.log('下一步：npm run tutorial:fbro:verify');
}
