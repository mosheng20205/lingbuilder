import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * AI Bridge 写入印章（issue #IKLE7E「设计器文件已被外部修改」）：
 * `edit.apply` 在独立 Bridge CLI 进程写盘，IDE 渲染层的文件监听只能把它当「外部修改」，
 * 本地设计器一旦处于脏状态就弹「已被外部修改」模态框等人。印章把「这次写盘来自 AI Bridge
 * 且内容就是印章时刻的字节」记录在工作区 `.lingbuilder/` 下（IDE 托管目录，不进 F5 保存载荷），
 * 服务端项目快照接口按「当前版本哈希 == 印章哈希」回传 bridgeOrigins，渲染层据此免确认自动载入。
 * 用户在 AI 写完后又手动改过文件（哈希不匹配）或印章过期（TTL）时不豁免，冲突保护不放松。
 */

export const BRIDGE_WRITE_STAMP_RELATIVE_PATH = '.lingbuilder/bridge-write-stamps.json';
export const BRIDGE_WRITE_STAMP_TTL_MS = 15 * 60 * 1000;
export const BRIDGE_WRITE_STAMP_MAX_ENTRIES = 200;

export interface BridgeWriteStampEntry {
  path: string;
  version: string;
  at: number;
  operation: string;
}

interface BridgeWriteStampFile {
  schemaVersion: 1;
  writes: BridgeWriteStampEntry[];
}

export function parseBridgeWriteStampEntries(raw: unknown): BridgeWriteStampEntry[] {
  const file = raw as Partial<BridgeWriteStampFile> | null | undefined;
  if (!file || file.schemaVersion !== 1 || !Array.isArray(file.writes)) return [];
  return file.writes.filter((entry): entry is BridgeWriteStampEntry => Boolean(entry)
    && typeof entry.path === 'string'
    && typeof entry.version === 'string'
    && Number.isFinite(entry.at)
    && typeof entry.operation === 'string');
}

export async function readBridgeWriteStampEntries(workspaceRoot: string): Promise<BridgeWriteStampEntry[]> {
  try {
    return parseBridgeWriteStampEntries(JSON.parse(await fs.readFile(path.join(workspaceRoot, BRIDGE_WRITE_STAMP_RELATIVE_PATH), 'utf8')));
  } catch {
    // 缺失/损坏的印章只等于「没有 AI 来源信息」，绝不让读取方失败。
    return [];
  }
}

export async function collectBridgeWriteOrigins(
  workspaceRoot: string,
  fileVersions: Record<string, string>,
  now = Date.now()
): Promise<Record<string, number>> {
  const origins: Record<string, number> = {};
  for (const entry of await readBridgeWriteStampEntries(workspaceRoot)) {
    if (now - entry.at > BRIDGE_WRITE_STAMP_TTL_MS) continue;
    if (fileVersions[entry.path] === entry.version) origins[entry.path] = entry.at;
  }
  return origins;
}

export async function recordBridgeWriteStamps(
  workspaceRoot: string,
  entries: Array<{ path: string; version: string }>,
  operation: string,
  now = Date.now()
): Promise<boolean> {
  if (entries.length === 0) return true;
  try {
    const previous = (await readBridgeWriteStampEntries(workspaceRoot))
      .filter(entry => now - entry.at <= BRIDGE_WRITE_STAMP_TTL_MS
        && !entries.some(item => item.path === entry.path));
    const writes = [...previous, ...entries.map(entry => ({ ...entry, at: now, operation }))]
      .sort((a, b) => b.at - a.at)
      .slice(0, BRIDGE_WRITE_STAMP_MAX_ENTRIES);
    const targetPath = path.join(workspaceRoot, BRIDGE_WRITE_STAMP_RELATIVE_PATH);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const temporaryPath = `${targetPath}.${process.pid}.${now}.tmp`;
    const file: BridgeWriteStampFile = { schemaVersion: 1, writes };
    await fs.writeFile(temporaryPath, JSON.stringify(file, null, 2), 'utf8');
    await fs.rename(temporaryPath, targetPath);
    return true;
  } catch {
    // 印章是 best-effort 的辅助信号：写失败只损失「免确认」体验，绝不能让 apply 失败。
    return false;
  }
}
