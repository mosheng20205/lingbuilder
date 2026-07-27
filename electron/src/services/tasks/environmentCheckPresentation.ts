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
  cppCompilerAvailable?: boolean;
  msvcBuildReady?: boolean;
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
  const msvcBuildReady = result.msvcBuildReady ?? result.ready ?? false;
  const cppCompilerAvailable = result.cppCompilerAvailable ?? checks.some(
    check => ['msvc', 'gpp', 'clangpp'].includes(check.id || '') && check.available
  );
  const summary = msvcBuildReady
    ? warningLines.length > 0
      ? `>>> [${timestamp}] 【MSVC 原生构建已就绪】默认 Win32 构建可用；可选能力请查看上方警告。`
      : `>>> [${timestamp}] 【MSVC 原生构建已就绪】默认 Win32 构建所需环境已全部就绪。`
    : cppCompilerAvailable
      ? `>>> [${timestamp}] 【MSVC 原生构建未就绪】已检测到替代 C++ 编译器，但默认 Win32 构建和 Visual Studio .lib 模块仍需安装 MSVC Build Tools 与 Windows SDK。`
      : `>>> [${timestamp}] 【环境未就绪】未检测到可完成默认 Win32 构建的 MSVC 环境，请安装或修复微软 C++ 构建工具。`;
  return [
    `>>> [${timestamp}] LingBuilder 真实开发环境检测`,
    result.platform ? `> [平台] ${result.platform}` : '',
    ...checkLines,
    ...warningLines,
    summary
  ].filter(Boolean);
}

function isPresentationItem(value: unknown): value is EnvironmentCheckPresentationItem {
  return Boolean(value) && typeof value === 'object';
}
