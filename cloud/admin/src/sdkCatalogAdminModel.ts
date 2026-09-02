import type { SdkCatalogResource } from '@lingbuilder/contracts';

export const ANCHORED_FIELDS = ['id', 'moduleId', 'name', 'platform', 'requiredModuleIds', 'criticalFiles'] as const;
export const UPDATABLE_FIELDS = ['version', 'sdkVersion', 'archiveName', 'downloadUrl', 'archiveBytes', 'sha256', 'fileCount', 'expandedBytes'] as const;

export interface CatalogFieldChange { field: string; from: string; to: string }
export interface CatalogDiffEntry { id: string; name: string; kind: 'added' | 'removed' | 'changed' | 'unchanged'; changes: CatalogFieldChange[]; anchoredChanged: string[] }

export function parseResourcesJson(text: string): SdkCatalogResource[] {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('内容不是合法 JSON。'); }
  const list = Array.isArray(parsed) ? parsed : (parsed as { resources?: unknown } | null)?.resources;
  if (!Array.isArray(list)) throw new Error('需要资源数组，或包含 resources 字段的对象。');
  if (!list.length) throw new Error('资源列表不能为空。');
  return list.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`第 ${index + 1} 条资源必须是对象。`);
    const record = item as Record<string, unknown>;
    return {
      ...(item as SdkCatalogResource),
      criticalFiles: normalizeCriticalFiles(record.criticalFiles, index),
      requiredModuleIds: normalizeStringList(record.requiredModuleIds, '依赖模块', index)
    };
  });
}

// 云端契约：criticalFiles 与 requiredModuleIds 都是字符串数组。IDE 内置清单的 criticalFiles 是
// {relativePath, minimumBytes} 对象数组，导入时统一提取 relativePath，杜绝 "[object Object]" 进入清单。
function normalizeCriticalFiles(value: unknown, index: number): string[] {
  if (!Array.isArray(value) || !value.length) throw new Error(`第 ${index + 1} 条资源的 criticalFiles 必须是非空数组。`);
  return value.map((entry, position) => {
    const text = typeof entry === 'string' ? entry.trim()
      : entry && typeof entry === 'object' && typeof (entry as { relativePath?: unknown }).relativePath === 'string'
        ? (entry as { relativePath: string }).relativePath.trim()
        : '';
    if (!text) throw new Error(`第 ${index + 1} 条资源 criticalFiles 第 ${position + 1} 项无效：需要文件相对路径字符串或 {relativePath} 对象。`);
    return text;
  });
}

function normalizeStringList(value: unknown, label: string, index: number): string[] {
  if (!Array.isArray(value)) throw new Error(`第 ${index + 1} 条资源的 ${label}列表必须是数组。`);
  return value.map((entry, position) => {
    if (typeof entry !== 'string' || !entry.trim()) throw new Error(`第 ${index + 1} 条资源 ${label}列表第 ${position + 1} 项必须是字符串。`);
    return entry.trim();
  });
}

function display(value: unknown): string {
  if (value === undefined || value === null) return '（缺失）';
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
}

export function buildCatalogDiff(previous: SdkCatalogResource[] | null, next: SdkCatalogResource[]): CatalogDiffEntry[] {
  const byId = new Map((previous ?? []).map(item => [item.id, item]));
  const nextIds = new Set(next.map(item => item.id));
  const entries = next.map<CatalogDiffEntry>(item => {
    const before = byId.get(item.id);
    if (!before) return { id: item.id, name: item.name, kind: 'added', changes: [], anchoredChanged: [] };
    const changes = UPDATABLE_FIELDS
      .filter(field => display(before[field]) !== display(item[field]))
      .map(field => ({ field, from: display(before[field]), to: display(item[field]) }));
    const anchoredChanged = ANCHORED_FIELDS.filter(field => display(before[field]) !== display(item[field]));
    return { id: item.id, name: item.name, kind: changes.length || anchoredChanged.length ? 'changed' : 'unchanged', changes, anchoredChanged };
  });
  for (const before of previous ?? []) {
    if (!nextIds.has(before.id)) entries.push({ id: before.id, name: before.name, kind: 'removed', changes: [], anchoredChanged: [] });
  }
  return entries;
}
