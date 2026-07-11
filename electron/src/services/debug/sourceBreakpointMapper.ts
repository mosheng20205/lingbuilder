import path from 'node:path';
import type { LingCppNativeSourceMapEntry } from '../lingCpp/types';
import type { NativeBreakpoint } from './nativeDebugService';

export function mapSourceBreakpointsForDebug(
  breakpoints: Array<{ filePath: string; line: number; condition?: string }>,
  sourceMap: LingCppNativeSourceMapEntry[], sourceDir: string
): NativeBreakpoint[] {
  return breakpoints.map(breakpoint => {
    if (!breakpoint.filePath?.trim() || !Number.isInteger(breakpoint.line) || breakpoint.line < 1) throw new Error('断点文件或行号无效。');
    const normalizedSource = breakpoint.filePath.replace(/\\/gu, '/').toLowerCase();
    const entry = sourceMap
      .filter(item => item.sourceFile?.replace(/\\/gu, '/').toLowerCase() === normalizedSource && breakpoint.line >= item.sourceStartLine && breakpoint.line <= item.sourceEndLine)
      .sort((a, b) => (a.sourceEndLine - a.sourceStartLine) - (b.sourceEndLine - b.sourceStartLine))[0];
    if (!entry) throw new Error(`无法把断点 ${breakpoint.filePath}:${breakpoint.line} 映射到生成的 C++ 源码。`);
    const generatedLine = Math.min(entry.generatedEndLine, entry.generatedStartLine + Math.max(0, breakpoint.line - entry.sourceStartLine));
    return { sourcePath: path.join(sourceDir, entry.generatedFile), line: generatedLine, condition: breakpoint.condition,
      clientSourcePath: breakpoint.filePath.replace(/\\/gu, '/'), clientLine: breakpoint.line };
  });
}
