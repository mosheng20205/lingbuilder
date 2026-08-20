export const LINGBUILDER_OFFICIAL_SITE_URL = 'https://lingbuilder.com';

export interface VersionCheckResult {
  ok: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseTitle?: string;
  hasUpdate: boolean;
  downloadUrl: string;
  error?: string;
}

/** 语义化版本号比较：left > right 返回正数，相等返回 0。容忍 v 前缀与预发布后缀。 */
export function compareVersions(left: string, right: string): number {
  const parse = (value: string) => String(value || '').trim().replace(/^v/iu, '').split('-')[0].split('.').map(part => Number.parseInt(part, 10) || 0);
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 向云端查询最新已发布版本并与当前版本比较；任何失败都返回 ok=false，不影响 IDE 主流程。 */
export async function checkLatestVersion(origin: string, currentVersion: string): Promise<VersionCheckResult> {
  const fallback: VersionCheckResult = { ok: false, currentVersion, hasUpdate: false, downloadUrl: LINGBUILDER_OFFICIAL_SITE_URL };
  if (!origin || /config-missing\.invalid$/u.test(origin)) return { ...fallback, error: '云端地址未配置。' };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`${origin}/v1/site/latest-version?platform=Windows&architecture=x64`, { signal: controller.signal });
    clearTimeout(timer);
    const value: any = await response.json().catch(() => ({}));
    if (!response.ok || !value?.ok) return { ...fallback, error: String(value?.message || `云端版本检查失败（状态码 ${response.status}）。`) };
    if (!value.available) return { ...fallback, error: '云端尚未发布任何版本。' };
    const latestVersion = String(value.version || '');
    if (!latestVersion) return { ...fallback, error: '云端版本信息无效。' };
    return {
      ok: true,
      currentVersion,
      latestVersion,
      releaseTitle: value.title ? String(value.title) : undefined,
      hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
      downloadUrl: LINGBUILDER_OFFICIAL_SITE_URL
    };
  } catch (error) {
    return { ...fallback, error: error instanceof Error ? error.message : String(error) };
  }
}
