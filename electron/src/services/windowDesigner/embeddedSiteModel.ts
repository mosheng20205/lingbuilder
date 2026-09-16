import type { LingWindowEmbeddedSite } from './types';

/**
 * 内嵌站点面板的纯模型 helper：设计器属性面板与生成器门禁共享同一套口径。
 * 不依赖 Node 内置模块，可安全进入渲染层打包。
 */

export interface EmbeddedSiteDraft {
  host: string;
  entry: string;
  /** 每行一个工作区相对路径的文本形态（与文件清单一一对应，便于文本框直接编辑）。 */
  filesText: string;
}

export const EMBEDDED_SITE_PANEL_DEFAULT_HOST = 'embedded.local';
export const EMBEDDED_SITE_PANEL_MAX_FILES = 64;

export function draftFromEmbeddedSite(site?: LingWindowEmbeddedSite): EmbeddedSiteDraft {
  return {
    host: (site?.host || '').trim(),
    entry: (site?.entry || '').trim().replace(/\\/gu, '/'),
    filesText: (site?.files || [])
      .map(file => String(file ?? '').trim().replace(/\\/gu, '/'))
      .filter(Boolean)
      .join('\n')
  };
}

export function embeddedSiteFromDraft(draft: EmbeddedSiteDraft): LingWindowEmbeddedSite {
  return {
    files: parseEmbeddedSiteFilesText(draft.filesText),
    entry: draft.entry.trim().replace(/\\/gu, '/'),
    host: draft.host.trim().toLowerCase() || EMBEDDED_SITE_PANEL_DEFAULT_HOST
  };
}

export function parseEmbeddedSiteFilesText(text: string): string[] {
  const seen = new Set<string>();
  const files: string[] = [];
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim().replace(/\\/gu, '/');
    if (!line || seen.has(line)) continue;
    seen.add(line);
    files.push(line);
  }
  return files;
}

/** 'www/index.html' → 'www/'；根目录入口返回空串。 */
export function getEmbeddedSiteEntryDirectory(entry: string): string {
  const normalized = entry.trim().replace(/\\/gu, '/');
  return normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/') + 1) : '';
}

/** 从扫描结果里推断缺省入口：优先最浅的 index.html，否则第一个文件。 */
export function pickEmbeddedSiteEntry(files: string[]): string {
  const indexAtRoot = files.find(file => file === 'index.html');
  if (indexAtRoot) return indexAtRoot;
  const candidates = [...files].sort((left, right) => left.split('/').length - right.split('/').length || left.localeCompare(right));
  const indexFile = candidates.find(file => file.endsWith('/index.html'));
  return indexFile || candidates[0] || '';
}

/** 面板轻校验：与生成器门禁同口径的中文提示；返回空数组表示草稿可用。 */
export function validateEmbeddedSiteDraft(draft: EmbeddedSiteDraft): string[] {
  const problems: string[] = [];
  const files = parseEmbeddedSiteFilesText(draft.filesText);
  const entry = draft.entry.trim().replace(/\\/gu, '/');
  const host = draft.host.trim().toLowerCase();
  if (files.length === 0) {
    problems.push('尚未添加文件：填写站点目录后点击「扫描目录」，或每行一个工作区相对路径。');
    return problems;
  }
  if (files.length > EMBEDDED_SITE_PANEL_MAX_FILES) {
    problems.push(`文件数量超过上限（最多 ${EMBEDDED_SITE_PANEL_MAX_FILES} 个）：当前 ${files.length} 个。`);
  }
  if (!entry) {
    problems.push('入口文件为空：填写站点首页的工作区相对路径（如 www/index.html）。');
  } else if (!files.includes(entry)) {
    problems.push(`入口文件 ${entry} 不在文件清单内。`);
  }
  if (host && !/^[a-z0-9.-]{1,128}$/u.test(host)) {
    problems.push('主机名仅限字母、数字、点、连字符（如 app.local）。');
  }
  const entryDirectory = getEmbeddedSiteEntryDirectory(entry);
  if (entryDirectory) {
    const outside = files.find(file => file !== entry && !file.startsWith(entryDirectory));
    if (outside) problems.push(`文件 ${outside} 必须位于入口文件 ${entry} 所在目录内。`);
  }
  return problems;
}
