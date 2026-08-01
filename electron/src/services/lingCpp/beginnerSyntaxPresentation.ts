export type LingCppPresentationTokenKind =
  | 'string'
  | 'command'
  | 'keyword'
  | 'type'
  | 'literal'
  | 'module-command'
  | 'control-reference'
  | 'member'
  | 'procedure'
  | 'operator'
  | 'native-marker'
  | 'native-keyword'
  | 'native-type'
  | 'native-namespace'
  | 'native-function'
  | 'native-variable'
  | 'identifier';

export interface LingCppPresentationTokenContext {
  isNativeCpp: boolean;
  moduleCommands: ReadonlySet<string>;
  knownMembers: ReadonlySet<string>;
  knownProcedures: ReadonlySet<string>;
  controlReferences?: ReadonlySet<string>;
  nativeVariables?: ReadonlySet<string>;
  previousSignificantToken?: string;
  nextSignificantToken?: string;
}

export interface LingCppPresentationToken {
  text: string;
  kind: LingCppPresentationTokenKind;
}

const TOKEN_PATTERN = /((?:u8|u|U|L)?"(?:(?:\\.)|[^"\\])*"|“[^”]*”|局部常量|否则如果|如果结束|调试输出|输出调试文本|信息框|打开窗口|窗口_打开|载入窗口|载入新窗口|载入可视化设计|读取配置项|取运行目录|如果真|如果|否则|局部|常量|结束|返回|文本型|整数型|逻辑型|小数型|长整数型|双精度小数型|字节集|日期时间型|真|假|@|\d+(?:\.\d+)?|[\w\u4e00-\u9fa5]+|::|[＝=＋+\-*/（）(),，:;.<>\[\]{}])/gu;

const BUILTIN_COMMANDS = /^(调试输出|输出调试文本|信息框|打开窗口|窗口_打开|载入窗口|载入新窗口|载入可视化设计|读取配置项|取运行目录)$/u;
const LING_CPP_KEYWORDS = /^(局部常量|局部|常量|如果真|如果真结束|否则如果|否则|如果结束|如果|选择|判断|分支|情况|默认|选择结束|判断结束|循环|循环结束|判断循环首|判断循环尾|循环判断首|循环判断尾|计次循环首|计次循环尾|变量循环首|变量循环尾|枚举循环首|枚举循环尾|跳出循环|到循环尾|继续循环|尝试|捕获|最终|尝试结束|抛出|结束|返回)$/u;
const LING_CPP_TYPES = /^(文本型|整数型|逻辑型|小数型|长整数型|双精度小数型|字节集|日期时间型)$/u;
const CPP_KEYWORDS = /^(alignas|alignof|asm|auto|break|case|catch|class|const|constexpr|continue|default|delete|do|else|enum|explicit|export|extern|for|friend|goto|if|inline|mutable|namespace|new|noexcept|nullptr|operator|private|protected|public|register|reinterpret_cast|return|sizeof|static|struct|switch|template|this|throw|try|typedef|typename|union|using|virtual|volatile|while)$/u;
const CPP_TYPES = /^(bool|char|char8_t|char16_t|char32_t|double|float|int|long|short|signed|string|unsigned|void|wchar_t|wstring)$/u;
const OPERATORS = /^(并且|或者|非|::|&&|\|\||[!＝=＋+\-*/（）(),，:;.<>\[\]{}])$/u;

export function tokenizeLingCppPresentationCode(code: string): string[] {
  return code.split(TOKEN_PATTERN).filter(token => token !== '');
}

export function extractLingCppNativeVariableNames(source: string): Set<string> {
  const variables = new Set<string>();
  const declaration = /^\s*@\s*(?:(?:const|constexpr|static|volatile)\s+)*(?:(?:std\s*::\s*)?[A-Za-z_]\w*(?:\s*[*&]\s*)?)\s+([A-Za-z_]\w*)\s*(?==|;|,|\()/u;
  source.split(/\r?\n/u).forEach(line => {
    const match = line.match(declaration);
    if (match?.[1]) variables.add(match[1]);
  });
  return variables;
}

export function classifyLingCppPresentationCode(
  code: string,
  context: LingCppPresentationTokenContext
): LingCppPresentationToken[] {
  const tokens = tokenizeLingCppPresentationCode(code);
  return tokens.map((text, index) => ({
    text,
    kind: classifyLingCppPresentationToken(text, {
      ...context,
      previousSignificantToken: findSignificantToken(tokens, index, -1),
      nextSignificantToken: findSignificantToken(tokens, index, 1)
    })
  }));
}

export function classifyLingCppPresentationToken(
  token: string,
  context: LingCppPresentationTokenContext
): LingCppPresentationTokenKind {
  if (token === '@') return 'native-marker';
  if (/^(?:u8|u|U|L)?"/u.test(token) || token.startsWith('“')) return 'string';
  if (/^(真|假)$/u.test(token) || /^\d+(?:\.\d+)?$/u.test(token)) return 'literal';

  if (context.isNativeCpp) {
    if (CPP_KEYWORDS.test(token)) return 'native-keyword';
    if (CPP_TYPES.test(token)) return 'native-type';
    if (token === 'std') return 'native-namespace';
    if (context.nativeVariables?.has(token)) return 'native-variable';
    if (context.nextSignificantToken === '(') return 'native-function';
    if (OPERATORS.test(token)) return 'operator';
    return 'identifier';
  }

  if (BUILTIN_COMMANDS.test(token)) return 'command';
  if (LING_CPP_KEYWORDS.test(token)) return 'keyword';
  if (LING_CPP_TYPES.test(token)) return 'type';
  if (context.moduleCommands.has(token)) return 'module-command';
  if (context.controlReferences?.has(token)) return 'control-reference';
  if (context.knownMembers.has(token)) return 'member';
  if (context.knownProcedures.has(token)) return 'procedure';
  if (OPERATORS.test(token)) return 'operator';
  return 'identifier';
}

function findSignificantToken(tokens: string[], index: number, direction: -1 | 1): string | undefined {
  for (let cursor = index + direction; cursor >= 0 && cursor < tokens.length; cursor += direction) {
    if (tokens[cursor].trim()) return tokens[cursor];
  }
  return undefined;
}
