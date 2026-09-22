export interface LingBuilderBuildInfo {
  version: string;
  buildTime: string;
  gitHash: string;
}

let cachedFetch: Promise<LingBuilderBuildInfo | undefined> | undefined;

/**
 * 读取构建身份（构建期写入 dist/build-meta.json，与页面同源静态伺服）。
 * dev 源码模式没有该文件时返回 undefined，调用方不渲染构建时间。
 */
export function fetchLingBuilderBuildInfo(): Promise<LingBuilderBuildInfo | undefined> {
  cachedFetch ??= fetch('build-meta.json', { cache: 'no-store' })
    .then(res => (res.ok ? res.json() as Promise<LingBuilderBuildInfo> : undefined))
    .then(meta => (meta && typeof meta.buildTime === 'string' && meta.buildTime ? meta : undefined))
    .catch(() => undefined);
  return cachedFetch;
}

/** 构建时间展示戳（本地时区，0920 18:17 形态）；无法解析返回空串。 */
export function formatBuildStamp(buildTime: string): string {
  const date = new Date(buildTime);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
