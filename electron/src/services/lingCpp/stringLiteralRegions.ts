/**
 * 中文字符串字面量区间扫描（全仓库唯一实现）。
 *
 * `.lcpp` 的字符串字面量有两种引号：ASCII 双引号 `"..."`（反斜杠转义生效，含连续
 * 反斜杠的奇偶配对）与中文引号 `“...”`（不解释反斜杠转义，遇配对的 `”` 结束）。
 * 此前 splitEplBinaryExpression、splitCallArguments 与 parser 的形参拆分各自手写
 * 引号状态机，且部分实现不处理 `\"` 转义，导致被转义的引号被误判为字符串结束、
 * 引号奇偶翻转、顶层运算符定位失败（整句中文源码被原样吐进 C++，缺陷报告
 * 「拼接表达式里的 `\"`」即此类）。所有需要「跳过字符串内容」的扫描一律复用本
 * 模块，禁止再各写一遍引号状态机。
 */

export interface LingCppStringLiteralRegion {
  /** 起始索引（含引号字符本身）。 */
  start: number;
  /** 结束索引（不含）。未闭合的字符串延伸到文本末尾。 */
  end: number;
  /** 开引号字符。 */
  quote: '"' | '“' | "'";
  /** 是否找到了配对的收尾引号；假表示未闭合（延伸到文本末尾）。 */
  closed: boolean;
}

export interface CollectLingCppStringLiteralRegionsOptions {
  /**
   * 是否把 ASCII 单引号 `'...'` 识别为字符串区间（parser 的形参表拆分需要；
   * 表达式/实参扫描不识别，保持既有语义）。
   */
  recognizeSingleQuotes?: boolean;
}

/** 正向扫描文本，找出全部字符串字面量区间（含引号字符本身）。 */
export function collectLingCppStringLiteralRegions(
  text: string,
  options: CollectLingCppStringLiteralRegionsOptions = {}
): LingCppStringLiteralRegion[] {
  const regions: LingCppStringLiteralRegion[] = [];
  const recognizeSingleQuotes = options.recognizeSingleQuotes === true;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    const isDoubleQuote = char === '"';
    const isChineseQuote = char === '“';
    const isSingleQuote = recognizeSingleQuotes && char === "'";
    if (!isDoubleQuote && !isChineseQuote && !isSingleQuote) {
      index += 1;
      continue;
    }
    const start = index;
    index += 1;
    let closed = false;
    if (isChineseQuote) {
      // 中文引号不解释反斜杠转义：遇到配对的 ” 才结束（与既有 splitCallArguments 语义一致）。
      const closing = text.indexOf('”', index);
      if (closing >= 0) {
        index = closing + 1;
        closed = true;
      } else {
        index = text.length;
      }
    } else {
      while (index < text.length) {
        const inner = text[index];
        // 反斜杠连同被转义字符一起跳过：`\"` 不会结束字符串，`\\` 之后引号照常闭合，
        // `"a\\\""` 中第三个反斜杠转义引号、字符串延伸到文本末尾（未闭合）。
        if (inner === '\\') {
          index += 2;
          continue;
        }
        if (inner === char) {
          index += 1;
          closed = true;
          break;
        }
        index += 1;
      }
    }
    regions.push({ start, end: index, quote: char as LingCppStringLiteralRegion['quote'], closed });
  }
  return regions;
}

/**
 * 生成与文本等长的掩码：字符串字面量区间（含引号字符）内为 1，其余为 0。
 * 调用方在扫描运算符/逗号/等号等结构字符时跳过掩码位即可正确越过字符串内容。
 */
export function buildLingCppStringLiteralMask(
  text: string,
  options: CollectLingCppStringLiteralRegionsOptions = {}
): Uint8Array {
  const mask = new Uint8Array(text.length);
  for (const region of collectLingCppStringLiteralRegions(text, options)) {
    mask.fill(1, region.start, region.end);
  }
  return mask;
}
