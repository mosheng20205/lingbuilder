import type { ProblemItem } from '../../types';

const PROBLEM_LEVEL_LABELS: Record<ProblemItem['level'], string> = {
  error: '编译阻断 (Error)',
  warning: '规范缺陷 (Warning)',
  info: '辅助信息 (Info)'
};

export function countErrorListProblems(problems: ProblemItem[]): number {
  return problems.filter(problem => problem.level !== 'info').length;
}

export function formatProblemsForClipboard(problems: ProblemItem[]): string {
  if (problems.length === 0) return '> [错误列表] 空';

  return problems.map((problem, index) => {
    const location = problem.locationKind === 'insertion'
      ? '待生成事件（类末尾）'
      : `第 ${problem.line} 行${problem.column ? `:${problem.column}` : ''}`;
    const header = `[${index + 1}/${problems.length}] ${PROBLEM_LEVEL_LABELS[problem.level]}  ${problem.filePath} -> ${location}${problem.code ? ` · ${problem.code}` : ''}`;
    const lines = [header, problem.message];

    if (problem.codeSnippet) lines.push(`代码：${problem.codeSnippet}`);
    if (problem.suggestion) lines.push(`修复建议：${problem.suggestion}`);
    if (problem.actionLabel) lines.push(`操作：${problem.actionLabel}`);

    return lines.join('\n');
  }).join('\n\n');
}
