/**
 * 构建产物形态的中文日志标签单一出口：exe、控制台程序、DLL 三种产物共用同一批
 * 构建日志文案（输出目录、产物说明等）。所有构建链路（F5/解决方案构建、
 * /api/window-designer/build-run、AI Bridge build.run）都必须经这里取措辞，
 * 禁止再手写「exe 输出目录」式硬编码——DLL 项目曾被按 exe 口径播报。
 */
export type LingBuilderBuildOutputKind = 'application' | 'console-application' | 'dynamic-library';

/**
 * 由编译参数解析产物形态。产物以实际链接结果为准：
 * outputType=dll 时即使项目带控制台形态，链接产物仍是 DLL，标签按 DLL 播报。
 */
export function resolveBuildOutputKind(outputType: 'exe' | 'dll', consoleMode: boolean): LingBuilderBuildOutputKind {
  if (outputType === 'dll') return 'dynamic-library';
  return consoleMode ? 'console-application' : 'application';
}

export function describeBuildOutputDirectory(kind: LingBuilderBuildOutputKind): string {
  if (kind === 'dynamic-library') return 'DLL 输出目录';
  if (kind === 'console-application') return '控制台程序输出目录';
  return 'exe 输出目录';
}
