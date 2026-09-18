export type LingCppControlFlowFamily = 'if' | 'select' | 'loop' | 'try';
export type LingCppControlFlowRole = 'start' | 'branch' | 'end' | 'break' | 'continue' | 'throw';
export type LingCppLoopKind = 'infinite' | 'while' | 'do-while' | 'count' | 'range' | 'foreach';

export interface LingCppControlFlowLine {
  family?: LingCppControlFlowFamily;
  role: LingCppControlFlowRole;
  keyword: string;
  expression?: string;
  arguments: string[];
  loopKind?: LingCppLoopKind;
  branchKind?: 'elseif' | 'else' | 'case' | 'default' | 'catch' | 'finally';
}

/** 关键字清单是编译期固定集合，正则只编译一次；此前每行最多新建 ~30 个 RegExp，
 *  在结构化编辑里「每敲一个键 → 重渲可见代码块 → 逐行解析」会把主线程直接吃掉
 *  （2026-09-17 实测：输入延迟 ~600ms/键，热点全在 controlFlow.ts）。 */
const callPatternCache = new Map<string, RegExp>();
const escapeKeyword = (keyword: string) => keyword.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const callPattern = (keywords: string[]): RegExp => {
  const key = keywords.join('\u0000');
  let pattern = callPatternCache.get(key);
  if (!pattern) {
    const escaped = keywords.map(escapeKeyword).join('|');
    pattern = new RegExp(`^(${escaped})(?:\\s*[（(](.*)[）)])?\\s*;?$`, 'u');
    callPatternCache.set(key, pattern);
  }
  return pattern;
};

/** 行首词（中文关键字或英文标识符），用于在跑正则之前快速排除普通代码行。 */
const leadingWordPattern = /^[\u4e00-\u9fa5A-Za-z_][\u4e00-\u9fa50-9A-Za-z_]*/u;

/** 与下方 parseLingCppControlFlowLine 的判定表保持一致的候选关键字集合。 */
const LING_CPP_CONTROL_KEYWORDS = new Set<string>([
  '判断循环首', '判断循环尾', '循环判断首', '循环判断尾',
  '计次循环首', '计次循环尾', '变量循环首', '变量循环尾',
  '枚举循环首', '枚举循环尾', '循环结束', '循环',
  '如果真结束', '如果结束', '否则如果', '否则', '如果真', '如果',
  '选择结束', '判断结束', '分支', '情况', '默认', '选择', '判断',
  '尝试结束', '捕获', '最终', '尝试',
  '跳出循环', '到循环尾', '继续循环', '抛出'
]);

const call = (text: string, keywords: string[]): { keyword: string; expression?: string; arguments: string[] } | undefined => {
  const match = text.match(callPattern(keywords));
  if (!match) return undefined;
  const expression = match[2]?.trim();
  return {
    keyword: match[1] || '',
    expression,
    arguments: expression === undefined ? [] : splitLingCppControlArguments(expression)
  };
};

export function parseLingCppControlFlowLine(line: string): LingCppControlFlowLine | undefined {
  const text = line.trim();
  if (!text || text.startsWith('//') || text.startsWith('@')) return undefined;

  // 快速排除：行首词不是任何控制流关键字时，连正则都不用跑（普通代码行占绝大多数）。
  const leadingWord = text.match(leadingWordPattern)?.[0];
  if (leadingWord && !LING_CPP_CONTROL_KEYWORDS.has(leadingWord)) return undefined;

  let parsed = call(text, ['判断循环首']);
  if (parsed) return { ...parsed, family: 'loop', role: 'start', loopKind: 'while' };
  parsed = call(text, ['判断循环尾']);
  if (parsed) return { ...parsed, family: 'loop', role: 'end', loopKind: 'while' };
  parsed = call(text, ['循环判断首']);
  if (parsed) return { ...parsed, family: 'loop', role: 'start', loopKind: 'do-while' };
  parsed = call(text, ['循环判断尾']);
  if (parsed) return { ...parsed, family: 'loop', role: 'end', loopKind: 'do-while' };
  parsed = call(text, ['计次循环首']);
  if (parsed) return { ...parsed, family: 'loop', role: 'start', loopKind: 'count' };
  parsed = call(text, ['计次循环尾']);
  if (parsed) return { ...parsed, family: 'loop', role: 'end', loopKind: 'count' };
  parsed = call(text, ['变量循环首']);
  if (parsed) return { ...parsed, family: 'loop', role: 'start', loopKind: 'range' };
  parsed = call(text, ['变量循环尾']);
  if (parsed) return { ...parsed, family: 'loop', role: 'end', loopKind: 'range' };
  parsed = call(text, ['枚举循环首']);
  if (parsed) return { ...parsed, family: 'loop', role: 'start', loopKind: 'foreach' };
  parsed = call(text, ['枚举循环尾']);
  if (parsed) return { ...parsed, family: 'loop', role: 'end', loopKind: 'foreach' };
  parsed = call(text, ['循环结束']);
  if (parsed) return { ...parsed, family: 'loop', role: 'end', loopKind: 'infinite' };
  parsed = call(text, ['循环']);
  if (parsed) return { ...parsed, family: 'loop', role: 'start', loopKind: parsed.expression ? 'while' : 'infinite' };

  parsed = call(text, ['如果真结束', '如果结束']);
  if (parsed) return { ...parsed, family: 'if', role: 'end' };
  parsed = call(text, ['否则如果']);
  if (parsed) return { ...parsed, family: 'if', role: 'branch', branchKind: 'elseif' };
  parsed = call(text, ['否则']);
  if (parsed) return { ...parsed, family: 'if', role: 'branch', branchKind: 'else' };
  parsed = call(text, ['如果真', '如果']);
  if (parsed) return { ...parsed, family: 'if', role: 'start' };

  parsed = call(text, ['选择结束', '判断结束']);
  if (parsed) return { ...parsed, family: 'select', role: 'end' };
  parsed = call(text, ['分支', '情况']);
  if (parsed) return { ...parsed, family: 'select', role: 'branch', branchKind: 'case' };
  parsed = call(text, ['默认']);
  if (parsed) return { ...parsed, family: 'select', role: 'branch', branchKind: 'default' };
  parsed = call(text, ['选择', '判断']);
  if (parsed) return { ...parsed, family: 'select', role: 'start' };

  parsed = call(text, ['尝试结束']);
  if (parsed) return { ...parsed, family: 'try', role: 'end' };
  parsed = call(text, ['捕获']);
  if (parsed) return { ...parsed, family: 'try', role: 'branch', branchKind: 'catch' };
  parsed = call(text, ['最终']);
  if (parsed) return { ...parsed, family: 'try', role: 'branch', branchKind: 'finally' };
  parsed = call(text, ['尝试']);
  if (parsed) return { ...parsed, family: 'try', role: 'start' };

  parsed = call(text, ['跳出循环']);
  if (parsed) return { ...parsed, role: 'break' };
  parsed = call(text, ['到循环尾', '继续循环']);
  if (parsed) return { ...parsed, role: 'continue' };
  parsed = call(text, ['抛出']);
  if (parsed) return { ...parsed, role: 'throw' };
  return undefined;
}

export function splitLingCppControlArguments(raw: string): string[] {
  if (!raw.trim()) return [];
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: '"' | '“' | null = null;
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index] || '';
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (quote) {
      if ((quote === '"' && character === '"') || (quote === '“' && character === '”')) quote = null;
      continue;
    }
    if (character === '"' || character === '“') {
      quote = character;
      continue;
    }
    if ('（([{'.includes(character)) depth += 1;
    else if ('）)]}'.includes(character)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && (character === ',' || character === '，')) {
      result.push(raw.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(raw.slice(start).trim());
  return result;
}

export const lingCppControlFlowEndLabel = (line: LingCppControlFlowLine): string => {
  if (line.family === 'if') return '如果结束';
  if (line.family === 'select') return '选择结束';
  if (line.family === 'try') return '尝试结束';
  if (line.loopKind === 'while') return line.keyword === '循环' ? '循环结束' : '判断循环尾';
  if (line.loopKind === 'do-while') return '循环判断尾';
  if (line.loopKind === 'count') return '计次循环尾';
  if (line.loopKind === 'range') return '变量循环尾';
  if (line.loopKind === 'foreach') return '枚举循环尾';
  return '循环结束';
};
