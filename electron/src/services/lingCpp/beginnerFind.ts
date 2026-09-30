/**
 * 新手结构化画布的编辑器内查找（Ctrl+F）匹配服务。
 *
 * 语料分两类段，由调用方（DiffViewer）按「画布实际显示的文本」组装：
 *  - 代码块段：每个方法体的显示文本（草稿优先，否则语句文本），匹配行号是方法体内
 *    1 起始行，并附「显示行 → 源码行」映射（getBeginnerBodySourceLines 的结果）。
 *  - 源码段：整份源码逐行文本；已被某个代码块显示行覆盖的源码行会被跳过，
 *    避免同一处内容在两类段里重复计数。
 *
 * 匹配一律按单行文本查找（新手编辑器的导航、光标与行闪定位都是行级的），
 * 含换行的查询不会命中；列与长度均为 UTF-16 代码单元，与 textarea 的
 * setSelectionRange 口径一致。
 */

export const BEGINNER_FIND_MAX_QUERY_LENGTH = 200;

/** 查找范围：当前文件（画布内循环导航）/ 当前项目 / 整个解决方案（结果送底部面板）。 */
export type BeginnerFindScope = 'file' | 'project' | 'solution';

/** 单次查找的匹配数上限，防御异常大的工作区文件把主线程拖死。 */
const MAX_MATCHES = 10_000;

export interface BeginnerFindCodeBlockInput {
  /** 与 createBeginnerCodeDraftKey 同构的块标识。 */
  targetKey: string;
  /** 编辑器当前显示的方法体文本（草稿优先）。 */
  bodyText: string;
  /** 显示行（数组下标 + 1）→ 源码行号；无法判定的行为 0。 */
  sourceLineMap: readonly number[];
}

export interface BeginnerFindMatch {
  /** 'code'：落在方法体显示文本内；'source'：落在声明表、方法头等结构行上。 */
  kind: 'code' | 'source';
  /** kind='code' 时的目标块标识；kind='source' 为空串。 */
  targetKey: string;
  /** kind='code'：方法体内 1 起始行号；kind='source'：源码行号。 */
  line: number;
  /** 1 起始列（UTF-16 代码单元），相对 lineText。 */
  column: number;
  /** 匹配长度（UTF-16 代码单元）。 */
  length: number;
  /** 用于虚拟化滚动定位与跳转报告的源码行号；无法判定时为 0。 */
  sourceLine: number;
  /** 命中所在的整行文本（搜索语料原文）。编辑器显示行可能带缩进或裁掉声明行，落点时按它重新对齐列。 */
  lineText: string;
}

export interface BeginnerFindMatchesInput {
  sourceText: string;
  codeBlocks: readonly BeginnerFindCodeBlockInput[];
  query: string;
  matchCase: boolean;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

export function collectBeginnerFindMatches(input: BeginnerFindMatchesInput): BeginnerFindMatch[] {
  const query = typeof input.query === 'string'
    ? input.query.slice(0, BEGINNER_FIND_MAX_QUERY_LENGTH)
    : '';
  if (!query) return [];

  let template: RegExp;
  try {
    template = new RegExp(escapeRegExp(query), input.matchCase ? 'g' : 'gi');
  } catch {
    return [];
  }

  // 已被代码块显示文本覆盖的源码行：源码段跳过，避免同一行被重复计数。
  const coveredSourceLines = new Set<number>();
  for (const block of input.codeBlocks) {
    for (const line of block.sourceLineMap) {
      if (Number.isInteger(line) && line > 0) coveredSourceLines.add(line);
    }
  }

  const matches: BeginnerFindMatch[] = [];
  const collectLineMatches = (
    text: string,
    pick: (column: number, length: number) => BeginnerFindMatch
  ): void => {
    if (matches.length >= MAX_MATCHES) return;
    const matcher = new RegExp(template.source, template.flags);
    let result = matcher.exec(text);
    while (result) {
      if (result[0].length === 0) break;
      matches.push(pick(result.index + 1, result[0].length));
      if (matches.length >= MAX_MATCHES) return;
      result = matcher.exec(text);
    }
  };

  for (const block of input.codeBlocks) {
    const bodyLines = block.bodyText.split('\n');
    for (let index = 0; index < bodyLines.length; index += 1) {
      const mappedLine = block.sourceLineMap[index];
      const sourceLine = Number.isInteger(mappedLine) && (mappedLine as number) > 0
        ? (mappedLine as number)
        : 0;
      const lineText = bodyLines[index];
      collectLineMatches(lineText, (column, length) => ({
        kind: 'code',
        targetKey: block.targetKey,
        line: index + 1,
        column,
        length,
        sourceLine,
        lineText
      }));
    }
  }

  const sourceLines = input.sourceText.split(/\r\n|\r|\n/u);
  for (let index = 0; index < sourceLines.length; index += 1) {
    const lineNumber = index + 1;
    if (coveredSourceLines.has(lineNumber)) continue;
    const lineText = sourceLines[index];
    collectLineMatches(lineText, (column, length) => ({
      kind: 'source',
      targetKey: '',
      line: lineNumber,
      column,
      length,
      sourceLine: lineNumber,
      lineText
    }));
  }

  matches.sort((left, right) =>
    ((left.sourceLine || left.line) - (right.sourceLine || right.line)) || (left.column - right.column)
  );
  return matches;
}

/** 「查找全部 / 跨文件搜索」结果面板的单条命中。 */
export interface BeginnerFindResultEntry {
  filePath: string;
  /** 文件内显示名（一般为文件名，面板按文件分组时使用）。 */
  fileName: string;
  line: number;
  column: number;
  length: number;
  lineText: string;
}

/** 跨文件搜索的输入文件语料：按文件原文逐行匹配。 */
export interface BeginnerFindFileInput {
  filePath: string;
  fileName: string;
  sourceText: string;
}

export interface BeginnerFindFileResultsInput {
  files: readonly BeginnerFindFileInput[];
  query: string;
  matchCase: boolean;
  /** 单次返回的命中上限；超出时置 truncated。 */
  maxResults?: number;
}

export interface BeginnerFindFileResults {
  results: BeginnerFindResultEntry[];
  /** 按文件路径升序的文件数（去重后）。 */
  fileCount: number;
  truncated: boolean;
}

const DEFAULT_MAX_FILE_RESULTS = 2000;

export function collectBeginnerFindFileResults(input: BeginnerFindFileResultsInput): BeginnerFindFileResults {
  const query = typeof input.query === 'string'
    ? input.query.slice(0, BEGINNER_FIND_MAX_QUERY_LENGTH)
    : '';
  const maxResults = input.maxResults && Number.isInteger(input.maxResults) && input.maxResults > 0
    ? input.maxResults
    : DEFAULT_MAX_FILE_RESULTS;
  if (!query) return { results: [], fileCount: 0, truncated: false };

  let matcher: RegExp;
  try {
    matcher = new RegExp(escapeRegExp(query), input.matchCase ? 'g' : 'gi');
  } catch {
    return { results: [], fileCount: 0, truncated: false };
  }

  const results: BeginnerFindResultEntry[] = [];
  const seenFiles = new Set<string>();
  let truncated = false;
  for (const file of input.files) {
    const lines = file.sourceText.split(/\r\n|\r|\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const lineText = lines[index];
      const regex = new RegExp(matcher.source, matcher.flags);
      let match = regex.exec(lineText);
      while (match) {
        if (match[0].length === 0) break;
        if (results.length >= maxResults) {
          truncated = true;
          break;
        }
        if (!seenFiles.has(file.filePath)) seenFiles.add(file.filePath);
        results.push({
          filePath: file.filePath,
          fileName: file.fileName,
          line: index + 1,
          column: match.index + 1,
          length: match[0].length,
          lineText
        });
        match = regex.exec(lineText);
      }
      if (truncated) break;
    }
    if (truncated) break;
  }
  return { results, fileCount: seenFiles.size, truncated };
}
