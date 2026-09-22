/**
 * 系统 AI 编辑链的「新建文件白名单」契约（AiEditRequest.newFiles）的唯一本地实现。
 * 云端 `cloud/api/src/ai/ai.service.ts` 持有同语义副本（两包不共享代码）；
 * 改动判定语义时必须同步云端副本与 `docs/AI编辑链统一架构.md`。
 *
 * 安全边界：白名单只决定「哪些新路径允许进入提案」；真正的写盘安全仍由
 * AiBridgeService 的 WorkspacePathPolicy + WRITABLE_EXTENSIONS 在应用阶段强制。
 */
export interface AiNewFileAllowance {
  /** 显式允许新建的相对路径（不含盘符、不允许 .. 上跳）。 */
  paths?: string[];
  /** 允许在其中新建文件的目录（相对工作区）。 */
  directories?: string[];
  /** 允许的文件扩展名（含点、小写）；paths 命中时不再校验扩展名。 */
  extensions?: string[];
  /** 新建文件数量上限（1–10，缺省 5）。 */
  maxCount?: number;
}

/** 单一结果形态：electron 根 tsconfig 未开 strictNullChecks，
 *  布尔判别式联合在非 strict 下不收窄，禁用 { ok: true } | { ok: false } 形态。 */
export interface ParsedAiNewFileAllowance {
  ok: boolean;
  allowance?: AiNewFileAllowance;
  error?: string;
}

const MAX_NEW_FILE_PATHS = 10;
const MAX_NEW_FILE_DIRECTORIES = 5;
const MAX_NEW_FILE_EXTENSIONS = 10;
const MAX_PATH_LENGTH = 200;

export function normalizeAiWorkspacePath(value: string): string {
  return value.replace(/\\/gu, '/').replace(/^\.\//u, '').replace(/\/{2,}/gu, '/').replace(/\/+$/u, '');
}

export function isSafeRelativeAiWorkspacePath(value: string): boolean {
  if (!value || value.length > MAX_PATH_LENGTH) return false;
  if (/^[a-zA-Z]:/u.test(value)) return false;
  if (value.startsWith('/')) return false;
  return value.split('/').every(part => part && part !== '.' && part !== '..');
}

/** 校验并规范化渲染层传来的 newFiles 白名单；不合法时给中文错误。 */
export function parseAiNewFileAllowance(value: unknown): ParsedAiNewFileAllowance {
  if (value === undefined || value === null) return { ok: true, allowance: {} };
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'newFiles 必须是 JSON object。' };
  }
  const raw = value as Record<string, unknown>;
  const allowance: AiNewFileAllowance = {};
  if (raw.paths !== undefined) {
    if (!Array.isArray(raw.paths) || raw.paths.some(item => typeof item !== 'string')) {
      return { ok: false, error: 'newFiles.paths 必须是字符串数组。' };
    }
    const paths = Array.from(new Set(raw.paths.map(item => normalizeAiWorkspacePath(item as string)))).filter(Boolean);
    if (paths.length > MAX_NEW_FILE_PATHS) return { ok: false, error: `newFiles.paths 最多 ${MAX_NEW_FILE_PATHS} 条。` };
    const invalid = paths.find(path => !isSafeRelativeAiWorkspacePath(path));
    if (invalid) return { ok: false, error: `newFiles.paths 含不合法路径：${invalid}（必须是不带 .. 与盘符的工作区相对路径）。` };
    if (paths.length) allowance.paths = paths;
  }
  if (raw.directories !== undefined) {
    if (!Array.isArray(raw.directories) || raw.directories.some(item => typeof item !== 'string')) {
      return { ok: false, error: 'newFiles.directories 必须是字符串数组。' };
    }
    const directories = Array.from(new Set(raw.directories.map(item => normalizeAiWorkspacePath(item as string)))).filter(Boolean);
    if (directories.length > MAX_NEW_FILE_DIRECTORIES) return { ok: false, error: `newFiles.directories 最多 ${MAX_NEW_FILE_DIRECTORIES} 个。` };
    const invalid = directories.find(directory => !isSafeRelativeAiWorkspacePath(directory));
    if (invalid) return { ok: false, error: `newFiles.directories 含不合法目录：${invalid}。` };
    if (directories.length) allowance.directories = directories;
  }
  if (raw.extensions !== undefined) {
    if (!Array.isArray(raw.extensions) || raw.extensions.some(item => typeof item !== 'string')) {
      return { ok: false, error: 'newFiles.extensions 必须是字符串数组。' };
    }
    const extensions = Array.from(new Set(raw.extensions.map(item => String(item).toLowerCase()))).filter(Boolean);
    if (extensions.length > MAX_NEW_FILE_EXTENSIONS) return { ok: false, error: `newFiles.extensions 最多 ${MAX_NEW_FILE_EXTENSIONS} 个。` };
    const invalid = extensions.find(extension => !/^\.[A-Za-z0-9]+$/u.test(extension));
    if (invalid) return { ok: false, error: `newFiles.extensions 含不合法扩展名：${invalid}（须形如 .lcpp）。` };
    if (extensions.length) allowance.extensions = extensions;
  }
  if (raw.maxCount !== undefined) {
    if (typeof raw.maxCount !== 'number' || !Number.isInteger(raw.maxCount) || raw.maxCount < 1 || raw.maxCount > 10) {
      return { ok: false, error: 'newFiles.maxCount 必须是 1–10 的整数。' };
    }
    allowance.maxCount = raw.maxCount;
  }
  if (allowance.maxCount === undefined) allowance.maxCount = 5;
  if (!allowance.paths?.length && !allowance.directories?.length) {
    return { ok: false, error: 'newFiles 必须声明 paths 或 directories 至少一项。' };
  }
  return { ok: true, allowance };
}

/** 判断一个（规范化的）草稿路径是否命中新建白名单；命中时返回 true。 */
export function isPathAllowedByNewFileAllowance(path: string, allowance: AiNewFileAllowance | undefined): boolean {
  if (!allowance) return false;
  const normalized = normalizeAiWorkspacePath(path);
  const lower = normalized.toLocaleLowerCase('en-US');
  if (allowance.paths?.some(declared => declared.toLocaleLowerCase('en-US') === lower)) return true;
  if (allowance.directories?.length) {
    const inDirectory = allowance.directories.some(directory => {
      const lowerDirectory = directory.toLocaleLowerCase('en-US');
      return lower.startsWith(`${lowerDirectory}/`);
    });
    if (inDirectory) {
      if (!allowance.extensions?.length) return true;
      const extension = normalized.slice(normalized.lastIndexOf('.')).toLowerCase();
      return allowance.extensions.includes(extension);
    }
  }
  return false;
}

const EXPLICIT_NEW_FILE_TOKEN = /[\w\u4e00-\u9fa5][\w\u4e00-\u9fa5.-]*(?:\.lcpp|\.cpp|\.cxx|\.cc|\.c|\.h|\.hpp|\.hh|\.json|\.md|\.txt|\.ini)/giu;
const NEW_FILE_DIRECTORY_EXTENSIONS = ['.lcpp'];

/**
 * 从聊天指令推导新建文件白名单：
 * - 指令中点名了具体文件（如「新建 utils.lcpp 功能库」）→ 显式 paths（裸文件名落在活动文件同目录）；
 * - 要求新建但不点名（如「新建一个功能库放这些函数」）→ 活动文件所在目录内允许建 .lcpp；
 * - 与新建无关的指令返回 undefined，不改变既有「只能改已有文件」的语义。
 */
export function deriveAiNewFileAllowance(instruction: string, activeFilePath: string): AiNewFileAllowance | undefined {
  const normalizedInstruction = instruction.trim();
  if (!normalizedInstruction) return undefined;
  const activeDirectory = normalizeAiWorkspacePath(activeFilePath).split('/').slice(0, -1).join('/');
  const explicitTokens = Array.from(normalizedInstruction.matchAll(EXPLICIT_NEW_FILE_TOKEN))
    .map(match => normalizeAiWorkspacePath(match[0]));
  if (explicitTokens.length > 0) {
    const paths = Array.from(new Set(explicitTokens.map(token => {
      if (token.includes('/')) return token;
      return activeDirectory ? `${activeDirectory}/${token}` : token;
    }))).filter(isSafeRelativeAiWorkspacePath);
    if (paths.length) return { paths: paths.slice(0, MAX_NEW_FILE_PATHS), maxCount: 5 };
  }
  const hasCreateVerb = /新建|创建|添加|增加|生成|拆分|抽出/u.test(normalizedInstruction);
  const hasLibraryTarget = /功能库|函数库|新文件|新的文件|库文件/u.test(normalizedInstruction);
  if (hasCreateVerb && hasLibraryTarget) {
    return {
      directories: activeDirectory ? [activeDirectory] : [],
      extensions: NEW_FILE_DIRECTORY_EXTENSIONS,
      maxCount: 5
    };
  }
  return undefined;
}
