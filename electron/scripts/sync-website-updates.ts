// 官网「更新记录」页发布脚本：把仓库 更新记录/网站发布.json 整量同步到云端 websiteUpdateEntry。
// 发布文件由 AI 从 更新记录/YYYY-MM-DD.md 内部日志筛选改写生成（用户视角、剔除内部管线条目），
// 同步语义为整量镜像：payload 即「应当公开的全部日期」，云端多余日期会被删除，重复执行结果一致。
// 凭据只从环境变量读取，禁止写入命令行参数或源码：
//   LINGBUILDER_ADMIN_EMAIL / LINGBUILDER_ADMIN_PASSWORD / LINGBUILDER_ADMIN_MFA_CODE
// 用法：
//   npm run website:sync-updates -- --dry-run          预览：本地统计 + 与云端日期差异，不写入
//   npm run website:sync-updates -- --file <路径>      覆盖发布文件路径（默认 仓库根/更新记录/网站发布.json）
//   npm run website:sync-updates -- --api <url>        覆盖云端地址（默认 LINGBUILDER_CLOUD_API_URL 或 https://api.lingbuilder.com）

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

interface UpdateItem { category: string; text: string }
interface UpdateEntry { date: string; items: UpdateItem[] }

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fileArgIndex = args.indexOf('--file');
const apiArgIndex = args.indexOf('--api');
const apiBase = ((apiArgIndex >= 0 ? args[apiArgIndex + 1] : '') || process.env.LINGBUILDER_CLOUD_API_URL || 'https://api.lingbuilder.com').replace(/\/+$/, '');
const filePath = fileArgIndex >= 0
  ? fileURLToPath(new URL(args[fileArgIndex + 1] || '', import.meta.url))
  : fileURLToPath(new URL('../../更新记录/网站发布.json', import.meta.url));

const CATEGORIES = ['新功能', '问题修复', '新模块', '体验优化', '教程与示例', '版本发布'];
const MAX_DATES = 400;
const MAX_ITEMS_PER_DATE = 40;
const MAX_TEXT_LENGTH = 600;

const email = process.env.LINGBUILDER_ADMIN_EMAIL || '';
const password = process.env.LINGBUILDER_ADMIN_PASSWORD || '';
const mfaCode = process.env.LINGBUILDER_ADMIN_MFA_CODE || '';

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readLocalFile(): UpdateEntry[] {
  if (!fs.existsSync(filePath)) fail(`发布文件不存在：${filePath}\n先由 AI 整理生成该文件（参考 更新记录/YYYY-MM-DD.md），或用 --file 指定其他路径。`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`发布文件不是合法 JSON：${String(error instanceof Error ? error.message : error)}`);
  }
  const updates = (parsed as { updates?: unknown })?.updates;
  if (!Array.isArray(updates) || !updates.length) fail('发布文件缺少非空 updates 数组。');
  const dates = new Set<string>();
  for (const row of updates) {
    const date = String((row as UpdateEntry).date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) fail(`日期格式无效：${date || '（空）'}，应为 YYYY-MM-DD。`);
    if (dates.has(date)) fail(`日期重复：${date}。`);
    dates.add(date);
    const items = (row as UpdateEntry).items;
    if (!Array.isArray(items) || !items.length) fail(`${date} 至少需要一条更新内容。`);
    if (items.length > MAX_ITEMS_PER_DATE) fail(`${date} 条目数超过 ${MAX_ITEMS_PER_DATE} 条上限。`);
    for (const item of items) {
      const text = String(item?.text || '').trim();
      if (!text) fail(`${date} 存在空条目。`);
      if (text.length > MAX_TEXT_LENGTH) fail(`${date} 存在超过 ${MAX_TEXT_LENGTH} 字的条目，请拆分或精简。`);
      if (!CATEGORIES.includes(String(item?.category || ''))) fail(`${date} 存在无效分类「${item?.category || '（空）'}」，只允许：${CATEGORIES.join('、')}。`);
    }
  }
  return updates as UpdateEntry[];
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { code?: string; message?: string; requestId?: string };
    return `HTTP ${response.status} ${body.code || ''} ${body.message || ''}${body.requestId ? `（requestId: ${body.requestId}）` : ''}`.trim();
  } catch {
    return `HTTP ${response.status}`;
  }
}

const local = readLocalFile();
const localItems = local.reduce((sum, entry) => sum + entry.items.length, 0);
process.stdout.write(`发布文件：${filePath}\n本地待发布：${local.length} 天 · ${localItems} 条更新（${[...new Set(local.map(entry => entry.date))].length} 个唯一日期）\n`);

if (dryRun && (!email || !password || !mfaCode)) {
  process.stdout.write('--dry-run 且未提供管理员凭据：只做本地校验，不联网比对。\n');
  process.exit(0);
}
if (!email || !password || !mfaCode) {
  fail('缺少管理员凭据：请设置 LINGBUILDER_ADMIN_EMAIL、LINGBUILDER_ADMIN_PASSWORD、LINGBUILDER_ADMIN_MFA_CODE 环境变量后重试。');
}

const loginResponse = await fetch(`${apiBase}/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, mfaCode, deviceName: 'website-update-sync' })
});
if (!loginResponse.ok) fail(`登录失败：${await readError(loginResponse)}`);
const { accessToken } = await loginResponse.json() as { accessToken: string };
if (!accessToken) fail('登录响应中没有 accessToken，终止同步。');

const snapshotResponse = await fetch(`${apiBase}/v1/admin/site/updates`, {
  headers: { 'authorization': `Bearer ${accessToken}` }
});
if (!snapshotResponse.ok) fail(`读取云端更新记录失败：${await readError(snapshotResponse)}`);
const serverUpdates = (await snapshotResponse.json() as { updates?: Array<{ date: string }> }).updates || [];
const serverDates = new Set(serverUpdates.map(entry => entry.date));
const localDates = new Set(local.map(entry => entry.date));
const createCount = local.filter(entry => !serverDates.has(entry.date)).length;
const updateCount = local.length - createCount;
const deleteCount = serverDates.size - [...localDates].filter(date => serverDates.has(date)).length;

process.stdout.write(`云端现有：${serverDates.size} 天\n计划：新增 ${createCount} 天，覆盖 ${updateCount} 天，删除 ${deleteCount} 天（${[...serverDates].filter(date => !localDates.has(date)).join('、') || '无'}）\n`);

if (dryRun) {
  process.stdout.write('--dry-run：未写入云端。\n');
  process.exit(0);
}

const syncResponse = await fetch(`${apiBase}/v1/admin/site/updates/sync`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'authorization': `Bearer ${accessToken}` },
  body: JSON.stringify({ updates: local })
});
if (!syncResponse.ok) fail(`同步失败：${await readError(syncResponse)}`);
const result = await syncResponse.json() as { synced?: number; created?: number; updated?: number; removed?: number };
process.stdout.write(`同步完成：云端现有 ${result.synced} 天（新增 ${result.created}，覆盖 ${result.updated}，删除 ${result.removed}）。公开页：${apiBase.includes('api.lingbuilder.com') ? 'https://lingbuilder.com/updates' : `${apiBase}/v1/site/updates`}\n`);
