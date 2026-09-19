export interface LingCppSemanticTokenColors {
  dark: string;
  light: string;
}

export interface LingCppSemanticTokenRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export const LINGCPP_CONTROL_REFERENCE_SEMANTIC_TOKEN = 'controlReference';

export const LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS: LingCppSemanticTokenColors = {
  dark: '#f472b6',
  light: '#b42367'
};

export function getLingCppControlReferenceTokenColor(isDarkMode: boolean): string {
  return isDarkMode
    ? LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.dark
    : LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.light;
}

/**
 * Comment color for `//` and leading `'` comment lines.
 *
 * The beginner structured editor, the professional Monaco editor and the diff
 * views must agree on this token, otherwise the same commented line would
 * change color when the user switches editor mode.
 */
export const LINGCPP_COMMENT_TOKEN_COLORS: LingCppSemanticTokenColors = {
  dark: '#3f8f3f',
  light: '#166534'
};

export function getLingCppCommentTokenColor(isDarkMode: boolean): string {
  return isDarkMode
    ? LINGCPP_COMMENT_TOKEN_COLORS.dark
    : LINGCPP_COMMENT_TOKEN_COLORS.light;
}

/**
 * `#常量名` 引用令牌颜色（项目常量与模块常量共用）。
 *
 * 深色值取自易语言常量紫（#BE56BE）；新手结构化编辑器、Monaco 与 Diff 视图
 * 必须消费同一令牌色，切换编辑器模式时同一常量行不得变色。
 */
export const LINGCPP_CONSTANT_TOKEN_COLORS: LingCppSemanticTokenColors = {
  dark: '#BE56BE',
  light: '#8E458E'
};

export function getLingCppConstantTokenColor(isDarkMode: boolean): string {
  return isDarkMode
    ? LINGCPP_CONSTANT_TOKEN_COLORS.dark
    : LINGCPP_CONSTANT_TOKEN_COLORS.light;
}

export function createLingCppControlReferenceEditorCss(): string[] {
  const colors = LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS;
  return [
    `.monaco-editor.vs-dark .lingcpp-control-reference-token, .monaco-editor.hc-black .lingcpp-control-reference-token { color: ${colors.dark} !important; font-weight: 600; }`,
    `.monaco-editor.vs .lingcpp-control-reference-token, .monaco-editor.hc-light .lingcpp-control-reference-token { color: ${colors.light} !important; font-weight: 600; }`
  ];
}

export function buildLingCppControlReferenceSemanticTokenData(
  ranges: readonly LingCppSemanticTokenRange[]
): Uint32Array {
  const sorted = [...ranges]
    .filter(range => range.startLine === range.endLine && range.endColumn > range.startColumn)
    .sort((left, right) => left.startLine - right.startLine || left.startColumn - right.startColumn);
  const data: number[] = [];
  let previousLine = 0;
  let previousStart = 0;
  sorted.forEach(range => {
    const line = Math.max(0, range.startLine - 1);
    const start = Math.max(0, range.startColumn - 1);
    const deltaLine = line - previousLine;
    const deltaStart = deltaLine === 0 ? start - previousStart : start;
    data.push(deltaLine, deltaStart, range.endColumn - range.startColumn, 0, 0);
    previousLine = line;
    previousStart = start;
  });
  return Uint32Array.from(data);
}
