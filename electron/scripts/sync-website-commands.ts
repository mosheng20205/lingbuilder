import { BUILTIN_MODULES } from '../src/services/modules/builtinModules.js';

// 官网「命令查找」页批量灌库脚本：把内置模块清单批量同步到云端 websiteCommandReference。
// 凭据只从环境变量读取，禁止写入命令行参数或源码：
//   LINGBUILDER_ADMIN_EMAIL / LINGBUILDER_ADMIN_PASSWORD / LINGBUILDER_ADMIN_MFA_CODE
// 用法：
//   npm run module:web-sync -- --dry-run          预检：列出模块、命令数与请求体积，不联网
//   npm run module:web-sync -- --api <url>        覆盖云端地址（默认 LINGBUILDER_CLOUD_API_URL 或 https://api.lingbuilder.com）

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const apiArgIndex = args.indexOf('--api');
const apiBase = ((apiArgIndex >= 0 ? args[apiArgIndex + 1] : '') || process.env.LINGBUILDER_CLOUD_API_URL || 'https://api.lingbuilder.com').replace(/\/+$/, '');

const email = process.env.LINGBUILDER_ADMIN_EMAIL || '';
const password = process.env.LINGBUILDER_ADMIN_PASSWORD || '';
const mfaCode = process.env.LINGBUILDER_ADMIN_MFA_CODE || '';

const MAX_PAYLOAD_BYTES = 4.5 * 1024 * 1024; // 云端 JSON body 上限 5mb，留出余量

interface SyncResult {
  moduleId: string;
  version: string;
  updated: number;
  deprecated: number;
}

const manifests = BUILTIN_MODULES
  .filter(manifest => (manifest.contributes?.commands?.length || 0) > 0 || (manifest.bindings?.commands?.length || 0) > 0)
  .sort((left, right) => left.id.localeCompare(right.id, 'zh-CN'));

const commandCount = (manifest: typeof BUILTIN_MODULES[number]) =>
  new Set([
    ...(manifest.contributes?.commands || []).map(command => command.name),
    ...(manifest.bindings?.commands || []).map(command => command.command)
  ].filter(Boolean)).size;

const payloadBytes = (manifest: typeof BUILTIN_MODULES[number]) =>
  Buffer.byteLength(JSON.stringify({ manifest, publish: true }), 'utf8');

if (dryRun) {
  let totalCommands = 0;
  for (const manifest of manifests) {
    const bytes = payloadBytes(manifest);
    const commands = commandCount(manifest);
    totalCommands += commands;
    const oversized = bytes > MAX_PAYLOAD_BYTES ? '　[!] 超过单请求体积上限' : '';
    process.stdout.write(`${manifest.id}　v${manifest.version}　${commands} 条命令　${(bytes / 1024).toFixed(0)} KB${oversized}\n`);
  }
  process.stdout.write(`\n共 ${manifests.length} 个模块、${totalCommands} 条命令待同步到 ${apiBase}\n`);
  process.exit(0);
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { code?: string; message?: string; requestId?: string };
    return `HTTP ${response.status} ${body.code || ''} ${body.message || ''}${body.requestId ? `（requestId: ${body.requestId}）` : ''}`.trim();
  } catch {
    return `HTTP ${response.status}`;
  }
}

if (!email || !password || !mfaCode) {
  process.stderr.write('缺少管理员凭据：请设置 LINGBUILDER_ADMIN_EMAIL、LINGBUILDER_ADMIN_PASSWORD、LINGBUILDER_ADMIN_MFA_CODE 环境变量后重试。\n');
  process.exit(1);
}

const loginResponse = await fetch(`${apiBase}/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, mfaCode, deviceName: 'website-command-sync' })
});
if (!loginResponse.ok) {
  process.stderr.write(`登录失败：${await readError(loginResponse)}\n`);
  process.exit(1);
}
const { accessToken } = await loginResponse.json() as { accessToken: string };
if (!accessToken) {
  process.stderr.write('登录响应中没有 accessToken，终止同步。\n');
  process.exit(1);
}
process.stdout.write(`已登录 ${apiBase}，开始同步 ${manifests.length} 个内置模块清单。\n`);

const results: SyncResult[] = [];
const failures: Array<{ moduleId: string; reason: string }> = [];

for (const manifest of manifests) {
  const bytes = payloadBytes(manifest);
  if (bytes > MAX_PAYLOAD_BYTES) {
    failures.push({ moduleId: manifest.id, reason: `请求体积 ${(bytes / 1024).toFixed(0)} KB 超过单请求上限，需要先在云端调大 body 限制或拆分清单` });
    continue;
  }
  try {
    const response = await fetch(`${apiBase}/v1/admin/site/commands/sync-manifest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ manifest, publish: true })
    });
    if (!response.ok) {
      failures.push({ moduleId: manifest.id, reason: await readError(response) });
      continue;
    }
    const result = await response.json() as { updated?: number; deprecated?: number };
    const updated = result.updated || 0;
    const deprecated = result.deprecated || 0;
    results.push({ moduleId: manifest.id, version: manifest.version, updated, deprecated });
    process.stdout.write(`✓ ${manifest.id}　更新 ${updated} 条${deprecated ? `　废弃 ${deprecated} 条` : ''}\n`);
  } catch (error) {
    failures.push({ moduleId: manifest.id, reason: String(error instanceof Error ? error.message : error) });
  }
}

process.stdout.write(`\n同步完成：成功 ${results.length} 个模块，共更新 ${results.reduce((sum, item) => sum + item.updated, 0)} 条命令。`);
if (failures.length) {
  process.stdout.write(`失败 ${failures.length} 个：\n`);
  for (const failure of failures) process.stderr.write(`✗ ${failure.moduleId}　${failure.reason}\n`);
  process.exit(1);
}
process.stdout.write('\n');
