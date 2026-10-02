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

/**
 * 生成成功路径的压缩摘要行：一行工作区解决方案（.lbsln，解析不到时省略）、
 * 一行生成目录锚点（附带编译器/构建配置备注）、一行可复制 Visual Studio 工程、
 * 一行产物输出目录。派生路径（源码目录、obj、构建目录内 .sln）不再逐行播报，
 * 排查元信息（编译器、构建配置）折进锚点行括注。
 * 失败路径的日志不受影响，仍保留完整上下文。
 */
export function formatBuildPathSummaryLines(options: {
  buildDir: string;
  exportDir: string;
  binDir: string;
  outputKind: LingBuilderBuildOutputKind;
  compilerSummary?: string;
  buildConfigurationSummary?: string;
  /** 工作区 .lbsln 完整路径；解决方案尚未建立（解析失败）时缺省，不输出该行。 */
  solutionPath?: string;
}): string[] {
  const notes = [options.compilerSummary, options.buildConfigurationSummary].filter(Boolean).join(' · ');
  return [
    ...(options.solutionPath ? [`解决方案：${options.solutionPath}`] : []),
    `已生成 Win32 C++ 工程：${options.buildDir}${notes ? `（${notes}）` : ''}`,
    `可复制 Visual Studio 工程（含 .sln）：${options.exportDir}`,
    `${describeBuildOutputDirectory(options.outputKind)}：${options.binDir}`
  ];
}

/**
 * 编译成功时不再原样转贴编译器输出：cl 正常编译只回显源文件名（如 "main.cpp"），
 * 属纯噪音；只有输出里出现警告/错误关键字（中英文编译器均覆盖）时才保留该通道，
 * 让用户仍能看到告警上下文。失败路径不经过本函数，stdout/stderr 全量保留。
 */
export function formatSuccessCompileChannel(channel: string, text: string | undefined): string {
  const trimmed = text?.trim();
  if (!trimmed) return '';
  if (!/warning|error|警告|错误/iu.test(trimmed)) return '';
  return `${channel}:\n${trimmed}`;
}
