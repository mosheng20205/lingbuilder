export interface EnvironmentCheckPresentationItem {
  id?: string;
  label?: string;
  name?: string;
  available?: boolean;
  required?: boolean;
  version?: string | null;
  path?: string | null;
  detail?: string | null;
}

export interface EnvironmentCheckPresentationResult {
  ready?: boolean;
  platform?: string;
  warnings?: unknown[];
  checks?: unknown[];
}

/** 将环境检查 API 结果转换为底部输出面板的稳定中文文本。 */
export function formatEnvironmentCheckOutput(
  result: EnvironmentCheckPresentationResult,
  timestamp: string
): string[] {
  const checks = Array.isArray(result.checks)
    ? result.checks.filter(isPresentationItem)
    : [];
  const checkLines = checks.map(check => {
    const label = check.label || check.name || check.id || '环境项';
    const state = check.available ? '✓' : check.required ? '✗' : '○';
    const details = [check.version, check.path, check.detail]
      .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
      .join(' · ');
    return `> [环境] ${state} ${label}${details ? `：${details}` : ''}`;
  });
  const warningLines = (Array.isArray(result.warnings) ? result.warnings : [])
    .filter((warning): warning is string => typeof warning === 'string' && warning.trim().length > 0)
    .map(warning => `> [警告] ${warning}`);
  return [
    `>>> [${timestamp}] LingBuilder 真实开发环境检测`,
    result.platform ? `> [平台] ${result.platform}` : '',
    ...checkLines,
    ...warningLines,
    result.ready
      ? `>>> [${timestamp}] 【自检成功】基础构建环境已就绪；可选能力和目标平台限制请查看上方警告。`
      : `>>> [${timestamp}] 【自检未就绪】请根据上方缺失项安装或配置开发工具。`
  ].filter(Boolean);
}

function isPresentationItem(value: unknown): value is EnvironmentCheckPresentationItem {
  return Boolean(value) && typeof value === 'object';
}
