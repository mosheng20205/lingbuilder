import { collectInlineCppLines, collectInlineCppReplacementHints, isInlineCppLineExempt } from './inlineCppKnowledge';

/**
 * 「禁止内嵌 C++」项目级门禁的唯一实现（2026-09-27 批⑥，默认关）。
 * 项目在解决方案 buildProperties 里开启 forbidInlineCpp 后，build.run / native.preview
 * （native.export 经 preview 内部继承）对未豁免的 @ 行做中文阻断；edit.propose / edit.apply
 * 不跑本门禁（与实参类型门禁同一既定取舍：提案阶段允许草稿，生成期才把关）。
 * 豁免双通道：① 单行行尾 `// 允许: 原因`；② buildProperties.inlineCppAllowFiles 整文件豁免。
 */
export interface InlineCppAdmissionPolicy {
  forbidInlineCpp: boolean;
  inlineCppAllowFiles: string[];
}

export interface InlineCppAdmissionProblem {
  filePath: string;
  /** 未豁免的 @ 行号列表（1 起，最多列 8 个）。 */
  lines: number[];
  lineCount: number;
  /** 命中替代知识表的 API 与命令（聚合去重）。 */
  hintSummary: string;
}

export function collectInlineCppAdmissionProblems(request: {
  sources: Array<{ filePath: string; sourceCode: string }>;
  policy: InlineCppAdmissionPolicy;
}): InlineCppAdmissionProblem[] {
  if (!request.policy.forbidInlineCpp) return [];
  const allowSet = new Set(request.policy.inlineCppAllowFiles.map(item => item.replace(/\\/g, '/').trim().toLocaleLowerCase()));
  const problems: InlineCppAdmissionProblem[] = [];
  for (const source of request.sources) {
    const filePath = source.filePath.replace(/\\/g, '/').trim();
    if (!filePath.toLocaleLowerCase().endsWith('.lcpp')) continue;
    if (allowSet.has(filePath.toLocaleLowerCase())) continue;
    const lines = collectInlineCppLines(source.sourceCode).filter(line => !isInlineCppLineExempt(line.text));
    if (lines.length === 0) continue;
    const apiLabels = new Set<string>();
    const commands = new Set<string>();
    for (const line of lines) {
      for (const hint of collectInlineCppReplacementHints(line.text)) {
        apiLabels.add(hint.api);
        hint.commands.forEach(command => commands.add(command));
      }
    }
    const hintParts: string[] = [];
    if (apiLabels.size > 0) hintParts.push(`涉及 API：${[...apiLabels].slice(0, 6).join('、')}`);
    if (commands.size > 0) hintParts.push(`可用命令：${[...commands].slice(0, 8).join(' / ')}`);
    problems.push({
      filePath,
      lines: lines.slice(0, 8).map(line => line.line),
      lineCount: lines.length,
      hintSummary: hintParts.join('；')
    });
  }
  return problems;
}

/** 门禁阻断时对外统一的中文修复指引（build/preview/export 同一口径）。 */
export function formatInlineCppAdmissionBlock(actionLabel: string, problems: InlineCppAdmissionProblem[]): string {
  const detail = problems
    .map(problem => `${problem.filePath}：${problem.lineCount} 行内嵌 C++（第 ${problem.lines.join('、')}${problem.lineCount > problem.lines.length ? ' 等' : ''} 行）${problem.hintSummary ? `。${problem.hintSummary}` : ''}`)
    .join('\n');
  return `${actionLabel} 被阻止：本项目已开启「禁止内嵌 C++」（解决方案 buildProperties.forbidInlineCpp）：\n${detail}\n` +
    '修复方式：优先用中文命令重写（位_*、字节集_*、编码_*、哈希_*字节集、PB_写字段_*、进程内存_* 等，完整对照见 docs/modules/内嵌C++替代对照表.md）；' +
    '确实没有替代命令的行，在该 @ 行行尾追加“// 允许: 原因”显式豁免，或在 buildProperties.inlineCppAllowFiles 里整文件豁免后重新构建。';
}
