import path from 'node:path';
import type { LingCppNativeSourceMapEntry } from '../lingCpp/types';

export interface CompilerDiagnostic {
  id: string; tool: 'msvc' | 'gcc' | 'clang' | 'linker'; severity: 'error' | 'warning' | 'info';
  code?: string; message: string; filePath?: string; line?: number; column?: number;
  generatedFile?: string; generatedLine?: number; generatedColumn?: number; raw: string;
}

export function parseCompilerDiagnostics(output: string, toolHint?: CompilerDiagnostic['tool']): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  for (const raw of output.split(/\r?\n/u).map(line => line.trim()).filter(Boolean)) {
    const msvc = /^(.*)\((\d+)(?:,(\d+))?\)\s*:\s*(fatal error|error|warning|note)\s+([A-Z]+\d+)?\s*:\s*(.+)$/iu.exec(raw);
    const gcc = /^(.*?):(\d+):(\d+):\s*(fatal error|error|warning|note):\s*(.+)$/iu.exec(raw);
    const linker = /^(?:LINK|lld-link|ld)(?:\s*:\s*|:)?\s*(fatal error|error|warning)\s*([A-Z]*\d+)?:?\s*(.+)$/iu.exec(raw);
    if (msvc) diagnostics.push(createDiagnostic('msvc', raw, msvc[4], msvc[6], msvc[1], msvc[2], msvc[3], msvc[5]));
    else if (gcc) diagnostics.push(createDiagnostic(toolHint === 'clang' ? 'clang' : 'gcc', raw, gcc[4], gcc[5], gcc[1], gcc[2], gcc[3]));
    else if (linker) diagnostics.push(createDiagnostic('linker', raw, linker[1], linker[3], undefined, undefined, undefined, linker[2]));
  }
  return diagnostics;
}

export function mapCompilerDiagnostics(diagnostics: readonly CompilerDiagnostic[], sourceMap: readonly LingCppNativeSourceMapEntry[], workspaceRoot?: string): CompilerDiagnostic[] {
  return diagnostics.map(diagnostic => {
    if (!diagnostic.filePath || !diagnostic.line) return { ...diagnostic };
    const normalizedFile = diagnostic.filePath.replace(/\\/gu, '/');
    const entry = sourceMap
      .filter(item => sameGeneratedFile(item.generatedFile, normalizedFile) && diagnostic.line! >= item.generatedStartLine && diagnostic.line! <= item.generatedEndLine)
      .sort((a, b) => (a.generatedEndLine - a.generatedStartLine) - (b.generatedEndLine - b.generatedStartLine))[0];
    if (!entry?.sourceFile) return { ...diagnostic, filePath: toRelative(normalizedFile, workspaceRoot) };
    const sourceLine = Math.min(entry.sourceEndLine, entry.sourceStartLine + Math.max(0, diagnostic.line - entry.generatedStartLine));
    return {
      ...diagnostic,
      generatedFile: normalizedFile,
      generatedLine: diagnostic.line,
      generatedColumn: diagnostic.column,
      filePath: entry.sourceFile.replace(/\\/gu, '/'),
      line: sourceLine,
      message: `${diagnostic.message}（已从生成的 ${path.basename(normalizedFile)}:${diagnostic.line} 映射回中文源码）`
    };
  });
}

function createDiagnostic(tool: CompilerDiagnostic['tool'], raw: string, severity: string, message: string, filePath?: string, line?: string, column?: string, code?: string): CompilerDiagnostic {
  const normalizedSeverity = /warning/iu.test(severity) ? 'warning' : /note/iu.test(severity) ? 'info' : 'error';
  return { id: `compiler-${hash(raw)}`, tool, severity: normalizedSeverity, code: code || undefined, message: message.trim(), filePath: filePath?.trim(), line: line ? Number(line) : undefined, column: column ? Number(column) : undefined, raw };
}
function sameGeneratedFile(mapped: string, actual: string): boolean { const left = mapped.replace(/\\/gu, '/').toLowerCase(); const right = actual.toLowerCase(); return right.endsWith(left) || path.posix.basename(right) === path.posix.basename(left); }
function toRelative(filePath: string, root?: string): string { if (!root) return filePath; const relative = path.relative(root, filePath).replace(/\\/gu, '/'); return relative.startsWith('../') ? filePath : relative; }
function hash(value: string): string { let result = 2166136261; for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619); return (result >>> 0).toString(16); }
