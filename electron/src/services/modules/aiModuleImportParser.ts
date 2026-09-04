export interface ParsedAiModuleFile {
  path: string;
  content: string;
}

export interface AiModuleParseResult {
  files: ParsedAiModuleFile[];
  diagnostics: string[];
}

export interface AiModuleImportResultForClipboard {
  ok: boolean;
  message: string;
  diagnostics: string[];
  moduleDir?: string;
}

export const AI_MODULE_IMPORT_FILE_EXTENSIONS = new Set([
  '.json', '.md', '.markdown', '.txt', '.h', '.hh', '.hpp', '.hxx', '.inl',
  '.c', '.cc', '.cpp', '.cxx', '.lcpp', '.def', '.rc', '.rh',
  '.ini', '.cfg', '.yaml', '.yml', '.toml', '.xml', '.csv'
]);

export const AI_MODULE_MANIFEST_FILE = 'lingbuilder.module.json';

export function formatAiModuleImportResultForClipboard(result: AiModuleImportResultForClipboard): string {
  return [
    result.message,
    ...result.diagnostics,
    result.ok && result.moduleDir ? '下一步：在上方“模块包制作”点击导出 .lbmod，然后安装启用。' : ''
  ]
    .map(item => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean)
    .join('\n');
}

function stripWrappers(value: string): string {
  return value.trim().replace(/^["'`*]+/u, '').replace(/["'`*]+$/u, '').trim();
}

function looksLikeModuleFilePath(value: string): boolean {
  if (!value || value.length > 200) return false;
  if (/[/\\]/u.test(value.slice(0, 1))) return false;
  if (/^[a-zA-Z]:/u.test(value)) return false;
  if (value.split(/[/\\]/u).some(part => !part || part === '.' || part === '..')) return false;
  const extension = value.slice(value.lastIndexOf('.')).toLowerCase();
  return AI_MODULE_IMPORT_FILE_EXTENSIONS.has(extension);
}

function normalizeModuleFilePath(value: string): string {
  return stripWrappers(value).replace(/\\/gu, '/').replace(/^\.\//u, '').replace(/\/{2,}/gu, '/');
}

/**
 * Parses pasted AI output into module files. The AI is instructed (in
 * docs/AI模块开发规范.md) to emit each file as a "### 文件：<相对路径>" heading
 * followed by a fenced code block; common heading variants are tolerated.
 */
export function parseAiModuleOutputText(text: string): AiModuleParseResult {
  const diagnostics: string[] = [];
  const files = new Map<string, string>();
  const normalizedPathKeys = new Map<string, string>();
  if (!text || !text.trim()) {
    return { files: [], diagnostics };
  }

  const lines = text.replace(/\r\n?/gu, '\n').split('\n');
  let pendingPath: string | null = null;
  let pendingPathLabel = '';
  let fenceChar: '`' | '~' | null = null;
  let fenceLength = 0;
  let buffer: string[] = [];

  const pushFile = (filePath: string, content: string) => {
    const normalized = normalizeModuleFilePath(filePath);
    if (!looksLikeModuleFilePath(normalized)) {
      diagnostics.push(`忽略无法识别的文件路径：${filePath}`);
      return;
    }
    const pathKey = normalized.toLocaleLowerCase('en-US');
    const existingPath = normalizedPathKeys.get(pathKey);
    if (existingPath && existingPath !== normalized) {
      files.delete(existingPath);
      normalizedPathKeys.delete(pathKey);
      diagnostics.push(`文件路径大小写冲突：${existingPath} 与 ${normalized} 在 Windows 上会指向同一个文件。`);
      return;
    }
    if (files.has(normalized)) {
      diagnostics.push(`文件 ${normalized} 出现多次，已使用最后一次内容。`);
    }
    normalizedPathKeys.set(pathKey, normalized);
    files.set(normalized, content);
  };

  const setPendingPath = (nextPath: string, label: string) => {
    if (pendingPath) {
      diagnostics.push(`文件 ${pendingPath} 只有标题（${pendingPathLabel.slice(0, 40)}），没有找到代码块内容。`);
    }
    pendingPath = nextPath;
    pendingPathLabel = label;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (fenceChar) {
      const closingMatch = trimmed.match(new RegExp(`^${fenceChar}{${fenceLength},}\\s*$`, 'u'));
      if (closingMatch) {
        const content = buffer.join('\n').replace(/^\uFEFF/u, '');
        if (pendingPath) {
          pushFile(pendingPath, content);
          pendingPath = null;
        }
        fenceChar = null;
        fenceLength = 0;
        buffer = [];
        continue;
      }
      buffer.push(line);
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,6}\s+(?:\*\*)?(?:文件|FILE)\s*[：:]\s*([^\s*]+)(?:\*\*)?\s*$/u)
      ?? trimmed.match(/^#{1,6}\s+(?:\*\*)?([^\s*]+\.[A-Za-z0-9]+)(?:\*\*)?\s*$/u);
    if (headingMatch) {
      setPendingPath(normalizeModuleFilePath(headingMatch[1]), trimmed);
      continue;
    }
    const boldMatch = trimmed.match(/^\*\*(?:文件|FILE)\s*[：:]\s*(.+?)\*\*\s*$/u)
      ?? trimmed.match(/^\*\*([^\s*]+\.[A-Za-z0-9]+)\*\*\s*$/u);
    if (boldMatch) {
      setPendingPath(normalizeModuleFilePath(boldMatch[1]), trimmed);
      continue;
    }
    const plainMatch = trimmed.match(/^(?:文件|FILE)\s*[：:]\s*(.+)$/u);
    if (plainMatch && looksLikeModuleFilePath(stripWrappers(plainMatch[1]))) {
      setPendingPath(normalizeModuleFilePath(plainMatch[1]), trimmed);
      continue;
    }
    const markerMatch = trimmed.match(/^<{2,}\s*(?:文件|FILE)\s*[：:]\s*(.+?)\s*>{2,}$/iu);
    if (markerMatch) {
      setPendingPath(normalizeModuleFilePath(markerMatch[1]), trimmed);
      continue;
    }

    const fenceOpen = trimmed.match(/^(`{3,}|~{3,})/u);
    if (fenceOpen) {
      fenceChar = fenceOpen[1][0] as '`' | '~';
      fenceLength = fenceOpen[1].length;
      buffer = [];
      continue;
    }
  }

  if (pendingPath) {
    diagnostics.push(`文件 ${pendingPath} 只有标题（${pendingPathLabel.slice(0, 40)}），没有找到代码块内容。`);
  }

  if (files.size === 0) {
    diagnostics.push('未识别到任何文件。请确认 AI 回复中每个文件都使用“### 文件：相对路径”标题加代码块格式。');
  } else if (!files.has(AI_MODULE_MANIFEST_FILE)) {
    diagnostics.push(`未识别到根目录 ${AI_MODULE_MANIFEST_FILE}，无法确定模块 ID。`);
  }

  return {
    files: Array.from(files.entries()).map(([filePath, content]) => ({ path: filePath, content })),
    diagnostics
  };
}
