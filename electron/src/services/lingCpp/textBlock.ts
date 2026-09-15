/**
 * `.lcpp` 多行文本块（三引号）共享词法。
 *
 * 语法（一期口径）：
 * - 开始行：trim 后形如 `目标 = """`（目标为标识符或成员链），`"""` 必须是行尾；
 * - 内容：开始行之后、结束行之前的所有行**原样**保留（不解释 \n/\t/反斜杠/引号）；
 * - 结束行：单独一行 `"""`（允许前导缩进），其后不得再有内容；
 * - 一期只允许作为赋值语句右部；类型声明初值、命令实参、返回 由解析诊断引导两步写法。
 *
 * 解析器把整个块收敛为单条 LingCppStatement（text 含真实换行、endLine 指向结束行），
 * 所有按行扫描的服务用 scanLingCppTextBlockRanges 得到块区间后把块行视为不透明内容。
 */

export const LING_CPP_TEXT_BLOCK_DELIMITER = '"""';

const TEXT_BLOCK_TARGET_SOURCE = '[\\p{L}_][\\p{L}\\p{N}_]*(?:\\s*\\.\\s*[\\p{L}_][\\p{L}\\p{N}_]*)*';
const TEXT_BLOCK_OPENING_RE = new RegExp(`^(${TEXT_BLOCK_TARGET_SOURCE})\\s*[=＝](?!=)\\s*"""$`, 'u');

export interface LingCppTextBlockRange {
  /** 开始行（1-based，含）。 */
  openLine: number;
  /** 结束行（1-based，含）；未闭合时为 false。 */
  closeLine: number;
}

export interface LingCppTextBlockScanResult {
  /** 已闭合的文本块区间（按开始行升序）。 */
  ranges: LingCppTextBlockRange[];
  /** 未闭合文本块的开始行（1-based）；块内容吞到文件末尾。 */
  unclosedOpenLine?: number;
  /** 出现在任何块之外的孤立结束标记行（1-based）。 */
  strayCloseLines: number[];
  /** 结束标记后带多余内容的行（1-based）；块在该行闭合，多余内容被忽略。 */
  contentAfterCloseLines: number[];
}

/** 匹配 `目标 = """` 开始行；返回赋值目标名。 */
export function matchLingCppTextBlockOpening(line: string): { target: string } | undefined {
  const match = line.trim().match(TEXT_BLOCK_OPENING_RE);
  return match ? { target: match[1] } : undefined;
}

/** 单独一行 `"""`（允许前导/尾随空白）即结束标记。 */
export function isLingCppTextBlockClosingLine(line: string): boolean {
  return line.trim() === LING_CPP_TEXT_BLOCK_DELIMITER;
}

/** 以 `"""` 开头但后面还有内容的行：形似结束标记但非法。 */
export function isLingCppTextBlockClosingWithContent(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith(LING_CPP_TEXT_BLOCK_DELIMITER) && trimmed !== LING_CPP_TEXT_BLOCK_DELIMITER;
}

/** 行内任意位置出现三引号（用于误用诊断，块区间内的行不参与）。 */
export function lineContainsLingCppTextBlockDelimiter(line: string): boolean {
  return line.includes(LING_CPP_TEXT_BLOCK_DELIMITER);
}

/**
 * 单遍状态机扫描全文的文本块区间。纯词法、不依赖方法上下文；
 * 块只允许出现在方法体内的约束由解析器在消费开始行时另行诊断。
 */
export function scanLingCppTextBlockRanges(lines: string[]): LingCppTextBlockScanResult {
  const ranges: LingCppTextBlockRange[] = [];
  const strayCloseLines: number[] = [];
  const contentAfterCloseLines: number[] = [];
  let openLine = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (openLine < 0) {
      if (isLingCppTextBlockClosingLine(line)) {
        strayCloseLines.push(index + 1);
        continue;
      }
      if (matchLingCppTextBlockOpening(line)) openLine = index + 1;
      continue;
    }
    if (isLingCppTextBlockClosingLine(line)) {
      ranges.push({ openLine, closeLine: index + 1 });
      openLine = -1;
      continue;
    }
    if (isLingCppTextBlockClosingWithContent(line)) {
      contentAfterCloseLines.push(index + 1);
      ranges.push({ openLine, closeLine: index + 1 });
      openLine = -1;
    }
  }
  const result: LingCppTextBlockScanResult = { ranges, strayCloseLines, contentAfterCloseLines };
  if (openLine >= 0) result.unclosedOpenLine = openLine;
  return result;
}

/** 块覆盖的全部物理行（开始行与结束行都包含），供按行服务做不透明豁免。 */
export function collectLingCppTextBlockLines(scan: LingCppTextBlockScanResult, totalLines: number): Set<number> {
  const consumed = new Set<number>();
  scan.ranges.forEach(range => {
    for (let line = range.openLine; line <= range.closeLine; line += 1) consumed.add(line);
  });
  if (scan.unclosedOpenLine) {
    for (let line = scan.unclosedOpenLine; line <= totalLines; line += 1) consumed.add(line);
  }
  return consumed;
}

/**
 * 不透明行 = 内容行 + 结束标记（不含开始行）：开始行是普通赋值语句，可参与缩进规范化；
 * 内容行与结束标记必须逐字节原样保留。
 */
export function collectLingCppTextBlockOpaqueLines(scan: LingCppTextBlockScanResult, totalLines: number): Set<number> {
  const opaque = collectLingCppTextBlockLines(scan, totalLines);
  scan.ranges.forEach(range => opaque.delete(range.openLine));
  if (scan.unclosedOpenLine) opaque.delete(scan.unclosedOpenLine);
  return opaque;
}

/**
 * 从已收敛的多行语句文本还原 `目标 = """…"""` 结构。
 * 调用方传入的 text 允许带首尾空白；块内行的原始缩进原样保留。
 */
export function parseLingCppTextBlockStatement(text: string): { target: string; content: string } | undefined {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return undefined;
  const opening = matchLingCppTextBlockOpening(lines[0]);
  if (!opening) return undefined;
  if (!isLingCppTextBlockClosingLine(lines[lines.length - 1])) return undefined;
  return { target: opening.target, content: lines.slice(1, -1).join('\n') };
}
