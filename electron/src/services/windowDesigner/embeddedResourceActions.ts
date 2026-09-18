import type { LingEmbeddedResource } from './types';

/**
 * 内嵌资源清单的增改口径（设计器面板与「配置项目内嵌资源」对话框共用同一份实现）：
 * 逻辑名重复的条目不覆盖已有条目，只报告跳过，避免静默改变构建产物。
 */
export interface EmbeddedResourceAppendResult {
  resources: LingEmbeddedResource[];
  added: number;
  /** 因逻辑名为空或重复被跳过的条目（用于中文提示）。 */
  duplicated: string[];
}

export function appendEmbeddedResources(
  current: readonly LingEmbeddedResource[],
  entries: readonly LingEmbeddedResource[]
): EmbeddedResourceAppendResult {
  const resources = [...current];
  const names = new Set(current.map(resource => String(resource.name || '').trim()));
  const duplicated: string[] = [];
  for (const entry of entries) {
    const name = String(entry.name || '').trim();
    if (!name || names.has(name)) {
      duplicated.push(name || '（空逻辑名）');
      continue;
    }
    names.add(name);
    resources.push({ name, file: String(entry.file || '').trim(), ...(entry.extract === true ? { extract: true } : {}) });
  }
  return { resources, added: resources.length - current.length, duplicated };
}

export interface EmbeddedResourceImportSummary {
  entries?: readonly LingEmbeddedResource[];
  skipped?: ReadonlyArray<{ path: string; reason: string }>;
  notes?: readonly string[];
}

/** 把一次导入结果整理成一句中文说明（面板与对话框共用）。 */
export function describeEmbeddedResourceImport(
  result: EmbeddedResourceImportSummary,
  append: EmbeddedResourceAppendResult
): string {
  const entries = result.entries || [];
  const parts = [`已复制 ${entries.length} 个文件到项目源码根 resources 目录，新增 ${append.added} 条内嵌资源`];
  if (result.notes?.length) parts.push(result.notes.slice(0, 3).join('；'));
  if (append.duplicated.length > 0) {
    parts.push(`逻辑名重复已跳过：${append.duplicated.slice(0, 3).join('、')}${append.duplicated.length > 3 ? '…' : ''}`);
  }
  const skipped = result.skipped || [];
  if (skipped.length > 0) {
    parts.push(`跳过 ${skipped.length} 个文件：${skipped.slice(0, 2).map(item => `${item.path}（${item.reason}）`).join('；')}${skipped.length > 2 ? '…' : ''}`);
  }
  return `${parts.join('；')}。`;
}

/** 扫描工作区目录后加入清单的中文说明（不复制文件，逻辑名取工作区相对路径原样）。 */
export function describeEmbeddedResourceScan(
  directory: string,
  append: EmbeddedResourceAppendResult,
  skipped: ReadonlyArray<{ path: string; reason: string }>
): string {
  if (append.added === 0 && append.duplicated.length === 0) {
    return `目录 ${directory} 里没有可直接内嵌的文件${skipped.length > 0 ? `（跳过 ${skipped.length} 个）` : ''}。`;
  }
  const parts = [`已从 ${directory} 加入 ${append.added} 条内嵌资源（不复制文件）`];
  if (append.duplicated.length > 0) {
    parts.push(`逻辑名重复已跳过：${append.duplicated.slice(0, 3).join('、')}${append.duplicated.length > 3 ? '…' : ''}`);
  }
  if (skipped.length > 0) {
    parts.push(`跳过 ${skipped.length} 个文件：${skipped.slice(0, 2).map(item => `${item.path}（${item.reason}）`).join('；')}${skipped.length > 2 ? '…' : ''}`);
  }
  return `${parts.join('；')}。`;
}

/** 工作区文本文件白名单（与 solutionService.collectTextFiles 同口径）：决定内嵌资源源文件能否在编辑器里打开。 */
export const EMBEDDED_RESOURCE_TEXT_EXTENSIONS = ['cpp', 'h', 'rc', 'ini', 'lcpp', 'e', 'xml', 'json', 'txt', 'csv', 'md'] as const;

/**
 * 内嵌资源的源文件是否能作为文本在编辑器里打开。
 * 只按扩展名判断：解决方案树里的文件列表是异步加载的，用列表判断会让右键菜单项一闪一没。
 */
export function isEmbeddedResourceSourceOpenable(file: string): boolean {
  const normalized = String(file || '').trim().toLowerCase().replace(/\\/gu, '/');
  const extension = normalized.split('/').pop()?.split('.').pop() || '';
  return (EMBEDDED_RESOURCE_TEXT_EXTENSIONS as readonly string[]).includes(extension);
}
