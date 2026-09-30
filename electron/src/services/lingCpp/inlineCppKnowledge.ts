import { collectLingCppTextBlockOpaqueLines, scanLingCppTextBlockRanges } from './textBlock';

/**
 * 内嵌 C++（@ 行）知识表：行级扫描、豁免标记识别与「Win32 API / C 函数 → 中文命令」替代建议。
 *
 * 2026-09-27 内嵌 C++ 清零批次（批②）落地：外部 AI 反馈自己手搓了 92 行进程内存扫描，
 * 而进程内存模块当时已在项目启用列表里——根因是平台没有在诊断层告诉它「这个 API 已有中文命令」。
 * 本文件是替代建议的唯一事实源：诊断警告（lingcpp-inline-cpp-replaceable）、
 * codeOrganization 用量报告、构建日志汇总行与 docs/modules/内嵌C++替代对照表.md
 * 的生成脚本都消费这里，禁止在别处再复制第二份 API 映射。
 */

export interface LingCppInlineCppLine {
  /** 1 起行号。 */
  readonly line: number;
  readonly text: string;
}

export interface InlineCppReplacementHint {
  /** 展示用的 API / 写法名称。 */
  readonly api: string;
  /** 在 @ 行文本上做大小写不敏感匹配。 */
  readonly pattern: RegExp;
  /** 推荐的中文命令（按优先序）。 */
  readonly commands: readonly string[];
  /** 提供这些命令的模块；无单一等价命令时省略。 */
  readonly moduleId?: string;
  /** 补充说明（无直接等价时的替代口径）。 */
  readonly note?: string;
}

const PROCESS_MEMORY_MODULE_ID = 'lingbuilder.advanced.process-memory';
const STD_MATH_MODULE_ID = 'lingbuilder.std.math';
const STD_ENCODING_MODULE_ID = 'lingbuilder.std.encoding';
const STD_BYTES_MODULE_ID = 'lingbuilder.std.bytes';
const STD_DATETIME_MODULE_ID = 'lingbuilder.std.datetime';
const CRYPTO_HASH_MODULE_ID = 'lingbuilder.crypto.hash';
const WIN32_BASIC_MODULE_ID = 'lingbuilder.win32.basic';
const WINDOW_UTILS_MODULE_ID = 'lingbuilder.win32.window-utils';
const PROCESS_MODULE_ID = 'lingbuilder.process';
const SHELL_MODULE_ID = 'lingbuilder.system.shell';
const REGISTRY_MODULE_ID = 'lingbuilder.config.registry';

export const INLINE_CPP_REPLACEMENT_HINTS: readonly InlineCppReplacementHint[] = [
  { api: 'OpenProcess', pattern: /\bOpenProcess\b/i, commands: ['进程内存_打开(进程ID, 允许写入)'], moduleId: PROCESS_MEMORY_MODULE_ID },
  { api: 'ReadProcessMemory', pattern: /\bReadProcessMemory\b/i, commands: ['进程内存_读字节集(句柄, 地址, 长度)', '进程内存_读整数(句柄, 地址, 默认值)', '进程内存_扫描字节集(句柄, 特征字节集, 最大命中数, 结果数组)'], moduleId: PROCESS_MEMORY_MODULE_ID },
  { api: 'WriteProcessMemory', pattern: /\bWriteProcessMemory\b/i, commands: ['进程内存_写字节集(句柄, 地址, 数据)', '进程内存_写整数(句柄, 地址, 数值)'], moduleId: PROCESS_MEMORY_MODULE_ID },
  { api: 'VirtualQueryEx', pattern: /\bVirtualQueryEx\b/i, commands: ['进程内存_枚举区域JSON(句柄, 只列已提交可读区域)'], moduleId: PROCESS_MEMORY_MODULE_ID },
  { api: 'GetCursorPos', pattern: /\bGetCursorPos\b/i, commands: ['取鼠标水平位置()', '取鼠标垂直位置()'], moduleId: WIN32_BASIC_MODULE_ID },
  { api: 'SetCursorPos', pattern: /\bSetCursorPos\b/i, commands: ['设置鼠标位置(横, 纵)'], moduleId: WIN32_BASIC_MODULE_ID },
  { api: 'GetSystemTimeAsFileTime / time(NULL)', pattern: /\bGetSystemTimeAsFileTime\b|\btime\s*\(\s*(NULL|nullptr|0)\s*\)/i, commands: ['时间_当前时间戳()（Unix 秒）', '时间_当前毫秒()（Unix 毫秒）'], moduleId: STD_DATETIME_MODULE_ID },
  { api: 'GetLocalTime', pattern: /\bGetLocalTime\b/i, commands: ['时间_取现行()', '时间_取年份/取月份/取日/取小时/取分钟/取秒'], moduleId: STD_DATETIME_MODULE_ID },
  { api: 'MultiByteToWideChar / WideCharToMultiByte', pattern: /\bMultiByteToWideChar\b|\bWideCharToMultiByte\b/i, commands: ['编码_字节集转文本(数据, 编码名称)', '编码_文本转字节集(文本, 编码名称)（支持 UTF-8/UTF-16/UTF-32/ANSI/GBK/GB2312/GB18030/RAW）'], moduleId: STD_ENCODING_MODULE_ID },
  { api: 'MD5 / SHA / SM3 / BLAKE 摘要', pattern: /\b(?:CryptCreateHash|CryptHashData|MD5Init|SHA1Init|sha256_update|SM3\w*)\b|\b(?:MD5|SHA1|SHA256|SHA3|SM3|BLAKE2|BLAKE3)\b/i, commands: ['哈希_算法文本(文本)', '哈希_算法字节集(数据)', '哈希_算法文件(路径)（MD5/SHA1/SHA256/SHA3_256/SM3/BLAKE2b/BLAKE3）'], moduleId: CRYPTO_HASH_MODULE_ID },
  { api: 'snprintf / swprintf / wsprintf', pattern: /\b(?:_?snprintf|swprintf|wsprintf[AW]?)\b/i, commands: ['格式化文本(格式模板, 参数...)'], moduleId: WIN32_BASIC_MODULE_ID },
  { api: 'memcpy / memmove', pattern: /\bmemcpy\b|\bmemmove\b|\bCopyMemory\b/i, commands: ['字节集_拼接(前段, 后段)', '字节集_截取(数据, 起始位置, 长度)', '字节集_插入(数据, 位置, 插入内容)', '字节集_替换(数据, 欲寻找, 替换内容, 次数)'], moduleId: STD_BYTES_MODULE_ID },
  { api: 'memset', pattern: /\bmemset\b|\bFillMemory\b|\bZeroMemory\b/i, commands: ['字节集_重复(次数, 单字节)', '字节集_置字节(数据, 位置, 数值)'], moduleId: STD_BYTES_MODULE_ID },
  { api: 'GetWindowText', pattern: /\bGetWindowText[AW]?\b/i, commands: ['窗口_取自身标题()（自身窗口）', '窗口_取标题(窗口句柄)（任意窗口）', '控件_取文本(控件)（当前窗口控件）'], moduleId: WINDOW_UTILS_MODULE_ID },
  { api: 'SetWindowText', pattern: /\bSetWindowText[AW]?\b/i, commands: ['窗口_设置自身标题(标题)（自身窗口）', '窗口_设置标题(窗口句柄, 标题)（任意窗口）', '控件_设置文本(控件, 文本)（当前窗口控件）'], moduleId: WINDOW_UTILS_MODULE_ID },
  { api: 'FindWindow', pattern: /\bFindWindow[AW]?\b/i, commands: ['窗口_按标题查找(标题)'], moduleId: WINDOW_UTILS_MODULE_ID, note: '仅按标题精确匹配，暂无按类名查找变体。' },
  { api: 'CreateProcess / WinExec', pattern: /\bCreateProcess[AW]?\b|\bWinExec\b/i, commands: ['程序_启动(命令行, 工作目录)', '程序_启动并等待(命令行, 工作目录)', '程序_执行并取输出(命令行, 参数数组)'], moduleId: PROCESS_MODULE_ID },
  { api: 'ShellExecute', pattern: /\bShellExecute[AW]?\b/i, commands: ['系统_打开(目标)（文件/目录/网址）'], moduleId: SHELL_MODULE_ID },
  { api: 'RegOpenKeyEx / RegQueryValueEx / RegSetValueEx', pattern: /\bReg(?:OpenKey|QueryValue|SetValue|DeleteValue|CreateKey|CloseKey|EnumKey|EnumValue)\w*/i, commands: ['注册表_读文本/读整数(路径, 名称)', '注册表_写文本/写整数(路径, 名称, 值)', '注册表_删除值(路径, 名称)', '注册表_值是否存在(路径, 名称)'], moduleId: REGISTRY_MODULE_ID, note: '仅支持 HKCU，暂无 HKLM 与子键枚举。' },
  { api: '位运算（右移常量）', pattern: />>\s*\d+|\bbitand\b|\bstd::ro[tl]r?\b/i, commands: ['位_右移(甲, 位数)（逻辑右移补 0）', '位_算术右移(甲, 位数)', '位_与/位_或/位_异或(甲, 乙)', '位_循环左移32(甲, 位数)'], moduleId: STD_MATH_MODULE_ID, note: '全部按 64 位补码位模式处理，移位位数对 64 取模。' },
  { api: '位运算（左移常量）', pattern: /<<\s*\d+|\bbitor\b|\bbitxor\b/i, commands: ['位_左移(甲, 位数)', '位_与/位_或/位_异或(甲, 乙)', '位_循环左移32(甲, 位数)'], moduleId: STD_MATH_MODULE_ID, note: '全部按 64 位补码位模式处理；zigzag = 位_异或(位_左移(n, 1), 位_算术右移(n, 63))。' },
  { api: 'GetLastError', pattern: /\bGetLastError\b/i, commands: [], note: '无全局等价命令：用对应模块的 取最后错误/取错误码 命令（如 进程内存_取错误、文件_取错误、PB_取最后错误）。' }
];

/** 豁免标记：@ 行内出现 `// 允许:` 或 `// 允许：`（后跟原因）即视为显式豁免。@ 行逐字透传进生成 C++，`//` 对编译无害。 */
export const INLINE_CPP_EXEMPT_MARKER_PATTERN = /\/\/\s*允许\s*[:：]/u;

export function isInlineCppLineExempt(lineText: string): boolean {
  return INLINE_CPP_EXEMPT_MARKER_PATTERN.test(lineText);
}

/**
 * 收集一段 .lcpp 源码中的全部内嵌 C++ 行（行首 @）。
 * 多行文本块（"""）内的 @ 是字符串内容，必须豁免；注释行语义由调用方按需处理（@ 行本身就是内嵌 C++，不适用注释豁免）。
 */
export function collectInlineCppLines(sourceCode: string): LingCppInlineCppLine[] {
  const lines = sourceCode.split(/\r?\n/u);
  const opaque = collectLingCppTextBlockOpaqueLines(scanLingCppTextBlockRanges(lines), lines.length);
  const result: LingCppInlineCppLine[] = [];
  lines.forEach((text, index) => {
    if (!/^\s*@/u.test(text)) return;
    const lineNumber = index + 1;
    if (opaque.has(lineNumber)) return;
    result.push({ line: lineNumber, text });
  });
  return result;
}

export function collectInlineCppReplacementHints(lineText: string): InlineCppReplacementHint[] {
  return INLINE_CPP_REPLACEMENT_HINTS.filter(hint => hint.pattern.test(lineText));
}

export interface InlineCppUsageSuggestion {
  readonly api: string;
  readonly commands: readonly string[];
  readonly moduleId?: string;
  readonly note?: string;
  /** 匹配的未豁免 @ 行数量。 */
  readonly lineCount: number;
  /** 涉及的文件数量。 */
  readonly fileCount: number;
}

export interface InlineCppUsageSummary {
  /** 全部 @ 行数量（含已豁免，不含文本块内）。 */
  readonly totalLines: number;
  /** 其中带豁免标记的行数。 */
  readonly exemptLines: number;
  /** 其中已有中文命令可替代的行数。 */
  readonly replaceableLines: number;
  readonly fileCount: number;
  /** 按命中行数降序的替代建议（聚合）。 */
  readonly suggestions: readonly InlineCppUsageSuggestion[];
}

const INLINE_CPP_USAGE_MAX_SUGGESTIONS = 8;

/**
 * 对项目级 .lcpp 源码集合做内嵌 C++ 用量统计（codeOrganization 报告、构建日志汇总行共用）。
 */
export function summarizeInlineCppUsage(sources: Array<{ filePath: string; sourceCode: string }>): InlineCppUsageSummary {
  let totalLines = 0;
  let exemptLines = 0;
  let replaceableLines = 0;
  let fileCount = 0;
  const byApi = new Map<string, { hint: InlineCppReplacementHint; lineCount: number; files: Set<string> }>();
  for (const source of sources) {
    if (!source.filePath.toLocaleLowerCase().endsWith('.lcpp')) continue;
    const lines = collectInlineCppLines(source.sourceCode);
    if (lines.length === 0) continue;
    fileCount += 1;
    totalLines += lines.length;
    for (const line of lines) {
      if (isInlineCppLineExempt(line.text)) {
        exemptLines += 1;
        continue;
      }
      const hints = collectInlineCppReplacementHints(line.text);
      if (hints.length === 0) continue;
      replaceableLines += 1;
      for (const hint of hints) {
        const existing = byApi.get(hint.api);
        if (existing) {
          existing.lineCount += 1;
          existing.files.add(source.filePath);
        } else {
          byApi.set(hint.api, { hint, lineCount: 1, files: new Set([source.filePath]) });
        }
      }
    }
  }
  const suggestions = [...byApi.values()]
    .sort((left, right) => right.lineCount - left.lineCount || right.files.size - left.files.size)
    .slice(0, INLINE_CPP_USAGE_MAX_SUGGESTIONS)
    .map(item => ({
      api: item.hint.api,
      commands: item.hint.commands,
      ...(item.hint.moduleId ? { moduleId: item.hint.moduleId } : {}),
      ...(item.hint.note ? { note: item.hint.note } : {}),
      lineCount: item.lineCount,
      fileCount: item.files.size
    }));
  return { totalLines, exemptLines, replaceableLines, fileCount, suggestions };
}

/** 构建日志汇总行：没有 @ 行时返回 undefined（不制造噪音）。 */
export function buildInlineCppUsageSummaryLine(sources: Array<{ filePath: string; sourceCode: string }>): string | undefined {
  const summary = summarizeInlineCppUsage(sources);
  if (summary.totalLines === 0) return undefined;
  const replaceableText = summary.replaceableLines > 0
    ? `，其中 ${summary.replaceableLines} 行已有中文命令可替代`
    : '';
  return `内嵌 C++ 用量：本项目合计 ${summary.totalLines} 行 @ 内嵌 C++（${summary.fileCount} 个文件）${replaceableText}。` +
    '可用 lingbuilder.lingcpp.diagnostics 的 codeOrganization 视图查看逐文件行数与替代建议；签名/协议类算法请优先用 位_*、PB_写字段_*、编码_*、哈希_*字节集 等中文命令。';
}

const API_MAP_DOC_PATH = 'docs/modules/内嵌C++替代对照表.md';

/**
 * 由替代知识表确定性生成「Win32 API / C 函数 → 中文命令」对照表 Markdown（批⑤）。
 * docs/modules/内嵌C++替代对照表.md 由 electron/scripts/generate-inline-cpp-api-map.ts 写出，
 * 测试钉住文档与知识表一致——改本函数输出必须重新生成文档，不要手改文档正文。
 */
export function buildInlineCppApiMapMarkdown(): string {
  const moduleIds = [...new Set(INLINE_CPP_REPLACEMENT_HINTS.map(hint => hint.moduleId).filter((id): id is string => Boolean(id)))];
  const lines: string[] = [
    '# 内嵌 C++（@ 行）→ 中文命令替代对照表',
    '',
    '> 本文档由 `electron/scripts/generate-inline-cpp-api-map.ts` 从 `electron/src/services/lingCpp/inlineCppKnowledge.ts` 的替代知识表确定性生成，',
    '> 与 `lingcpp-inline-cpp-replaceable` 诊断警告、codeOrganization 用量报告、构建日志汇总行同源；**不要手改正文**，改知识表后重新生成。',
    '',
    'LingBuilder 的目标是把项目里的 @ 内嵌 C++ 降到 0。写 @ 行前先查本表：',
    '命中「推荐命令」的，请直接改用中文命令重写；确实没有等价命令的，可在该 @ 行行尾追加 `// 允许: 原因` 显式豁免（项目开启 `forbidInlineCpp` 门禁时豁免行放行）。',
    '',
    `知识表共 ${INLINE_CPP_REPLACEMENT_HINTS.length} 条，覆盖模块：${moduleIds.map(id => `\`${id}\``).join('、')}。`,
    '',
    '| Win32 API / C 函数 / 写法 | 推荐中文命令 | 所在模块 | 说明 |',
    '| --- | --- | --- | --- |'
  ];
  for (const hint of INLINE_CPP_REPLACEMENT_HINTS) {
    const commands = hint.commands.length > 0 ? hint.commands.map(command => `\`${command}\``).join('、') : '（无直接等价命令）';
    const note = [hint.note, hint.commands.length > 0 ? '' : '请改用对应模块的「取最后错误/取错误码」类命令'].filter(Boolean).join(' ');
    lines.push(`| ${hint.api} | ${commands} | ${hint.moduleId ? `\`${hint.moduleId}\`` : '—'} | ${note} |`);
  }
  lines.push(
    '',
    '## 位运算与签名算法专用口径（std.math v1.2.0）',
    '',
    '- `位_*` 全族参数与返回值一律按 **64 位补码位模式** 处理，与 C 侧 `unsigned long long` 逐位兼容；移位位数对 64 取模（`位_循环左移32` 对 32 取模），与 x86 机器语义一致。',
    '- 逻辑右移用 `位_右移`（高位恒补 0），有符号右移用 `位_算术右移`（高位补符号位）。',
    '- protobuf zigzag：编码 `位_异或(位_左移(n, 1), 位_算术右移(n, 63))`。',
    '- varint 负数按 proto 标准 10 字节补码编码，`PB_写字段_varint` 已内置该语义，不要手工处理。'
  );
  return lines.join('\n') + '\n';
}

export const INLINE_CPP_API_MAP_DOC_PATH = API_MAP_DOC_PATH;
