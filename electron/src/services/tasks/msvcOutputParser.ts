/**
 * MSVC / MSBuild 构建输出解析器。
 *
 * 把 cmake --build / MSBuild 的原样输出解析成结构化诊断（文件、行、列、错误码、消息），
 * 供解决方案构建结果附带 compilerDiagnostics，复用工作台问题面板与 AI 解释链路。
 * 解析是尽力而为：未识别的行保持原样进日志，不影响构建状态判定。
 */

export interface MsvcBuildDiagnostic {
  /** 源文件或模块名（链接器诊断可能是 LINK 或 .lib 名）。 */
  filePath: string;
  line: number;
  column: number;
  /** 错误/警告代码，如 C2065、LNK2019、MSB3073。 */
  code: string;
  severity: 'error' | 'warning';
  /** 原始消息 + 常见错误码的中文解释后缀。 */
  message: string;
  /** 原始日志行。 */
  raw: string;
  tool: 'msvc';
}

/** 编译器诊断：文件(行,列): error C2065: 消息 */
const COMPILER_DIAGNOSTIC = /^\s*(.+?)\((\d+)(?:,(\d+))?\)\s*:\s*(?:fatal\s+)?(error|warning)\s+([A-Za-z]+\d+)\s*:\s*(.+?)\s*$/u;
/** 链接器/MSBuild 诊断：LINK : fatal error LNK1120: … 或 xx.vcxproj(12,3): error MSB4044: … */
const TOOL_DIAGNOSTIC = /^\s*([^\s:][^:]*?)\s*:\s*(?:fatal\s+)?(error|warning)\s+([A-Za-z]+\d+)\s*:\s*(.+?)\s*$/u;

const MAX_DIAGNOSTICS = 200;

/** 常见 MSVC/链接器/MSBuild 错误码的中文解释（按需扩充，未命中的码保持原文）。 */
const CHINESE_EXPLANATIONS: Record<string, string> = {
  C1083: '无法打开包括文件：通常是头文件路径不对或依赖库未安装。',
  C2001: '常量中有换行符：多见于字符串里出现了未转义的引号或换行。',
  C2011: '类/结构体重复定义：通常是头文件缺少包含保护或重复包含。',
  C2039: '标识符不是某类型的成员：多半是头文件版本不匹配或漏包含。',
  C2059: '语法错误：检查上一行是否缺少分号、括号不配对。',
  C2061: '语法错误：出现了未知类型的标识符，常见于缺少前置声明或头文件。',
  C2062: '意外的类型：类型名未定义或拼写错误。',
  C2065: '未声明的标识符：变量或函数名未定义、拼写错误或漏包含头文件。',
  C2084: '函数已有主体：同一函数被定义了多次。',
  C2143: '语法错误：缺少分号/逗号等分隔符。',
  C2146: '语法错误：某标识符前缺少分号，通常是前面的类型未定义。',
  C2228: '.左边必须具有类/结构/联合类型：对象指针误用点号，应改用 ->。',
  C2248: '无法访问私有/受保护成员：成员访问权限不足。',
  C2259: '无法实例化抽象类：还有纯虚函数未实现。',
  C2365: '成员重定义：同一符号被重复定义成不同含义。',
  C2440: '无法从一种类型转换到另一种类型：检查类型是否匹配、const 是否丢失。',
  C2451: '条件表达式类型非法。',
  C2466: '不能分配常量大小为 0 的数组。',
  C2491: '不允许 dllimport 函数的定义。',
  C2556: '重载函数仅返回类型不同。',
  C2562: 'void 函数出现了返回值。',
  C2660: '函数不接受指定数量的参数：实参个数与声明不符。',
  C2664: '参数类型无法转换：多见于宽字符/窄字符（wchar_t*/char*）混用。',
  C2676: '二元运算符不支持该操作数：类型未提供对应运算符。',
  C3861: '找不到标识符：函数未声明就使用（C 风格需先声明或包含头文件）。',
  C4996: '使用了被标记为弃用的函数（如 scanf/strcpy）：可改用安全版本或临时屏蔽该警告。',
  C4244: '转换可能丢失数据（如 double 转 int）。',
  C4305: '截断常量值（如 double 转 float）。',
  C4018: '有符号/无符号数不匹配，常见于循环下标与 size() 比较。',
  LNK2001: '无法解析的外部符号：声明了但未实现，或漏链接了对应的 .lib。',
  LNK2005: '符号已定义：重复定义，常见于全局变量放在头文件里。',
  LNK2019: '无法解析的外部符号：函数只声明未实现，或未链接其导入库。',
  LNK1120: '无法解析的外部符号数量统计，需先解决各 LNK2019/LNK2001。',
  LNK1169: '存在一个或多个多重定义的符号。',
  MSB8020: '项目的平台工具集在本机未安装：请在构建属性中切换到已安装的工具集。',
  MSB8003: '未找到 Windows SDK 或平台工具集，请安装对应的 Visual Studio 组件。',
  MSB3073: '构建命令以非零退出码结束：上方通常已有具体的编译/链接错误。',
  MSB4040: '项目中没有可构建的目标。',
  MSB4044: '某任务未获得预期输入参数，多为工程文件配置问题。'
};

function withExplanation(code: string, message: string): string {
  const explanation = CHINESE_EXPLANATIONS[code.toUpperCase()];
  return explanation ? `${message}（${explanation}）` : message;
}

function parseLine(raw: string): MsvcBuildDiagnostic | null {
  const compiler = COMPILER_DIAGNOSTIC.exec(raw);
  if (compiler) {
    const [, filePath, line, column, severity, code, message] = compiler;
    return {
      filePath: filePath!.trim(),
      line: Number(line),
      column: Number(column || 1),
      code: code!.toUpperCase(),
      severity: severity === 'warning' ? 'warning' : 'error',
      message: withExplanation(code!, message!),
      raw,
      tool: 'msvc'
    };
  }
  // 避免把普通日志行（如 “0 个警告”）误判：要求代码前缀为已知工具码段。
  const tool = TOOL_DIAGNOSTIC.exec(raw);
  if (tool) {
    const [, source, severity, code, message] = tool;
    const upper = code!.toUpperCase();
    const isKnownToolCode = /^(LNK|MSB|CVT|RC|MT|NK)/u.test(upper) || /^C\d+$/u.test(upper);
    if (!isKnownToolCode) return null;
    return {
      filePath: source!.trim(),
      line: 1,
      column: 1,
      code: upper,
      severity: severity === 'warning' ? 'warning' : 'error',
      message: withExplanation(upper, message!),
      raw,
      tool: 'msvc'
    };
  }
  return null;
}

/** 解析构建 stdout/stderr 为诊断列表；去重、限量（前 MAX_DIAGNOSTICS 条错误优先）。 */
export function parseMsvcBuildOutput(stdout: string, stderr: string): MsvcBuildDiagnostic[] {
  const seen = new Set<string>();
  const diagnostics: MsvcBuildDiagnostic[] = [];
  for (const raw of `${stdout}\n${stderr}`.split(/\r?\n/u)) {
    if (!raw.trim() || seen.has(raw)) continue;
    seen.add(raw);
    const diagnostic = parseLine(raw);
    if (diagnostic) diagnostics.push(diagnostic);
    if (diagnostics.length >= MAX_DIAGNOSTICS) break;
  }
  return diagnostics;
}
