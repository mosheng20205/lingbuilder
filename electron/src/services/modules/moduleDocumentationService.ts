import fs from 'node:fs/promises';
import path from 'node:path';
import { validateModuleRelativePath } from './manifest';
import type { InstalledModule } from './types';

// 文档预览允许比普通配置文件更大的文本，但仍设置上限避免一次性把异常资源载入 renderer。
export const MAX_MODULE_DOCUMENT_BYTES = 16 * 1024 * 1024;
const BUILTIN_DOCUMENT_ASSET_MODULES: Readonly<Record<string, string>> = {
  'lingbuilder.cef3.browser': 'lingbuilder.cef3.sdk'
};

export type ModuleDocumentFormat = 'markdown' | 'text';

export interface ModuleDocumentContent {
  moduleId: string;
  title: string;
  path: string;
  content: string;
  format: ModuleDocumentFormat;
  language?: string;
  size: number;
}

export interface ModuleDocumentationReadOptions {
  workspaceRoot: string;
  resourceRoot?: string;
}

export type ModuleDocumentationErrorCode =
  | 'MODULE_DOCUMENT_INVALID_PATH'
  | 'MODULE_DOCUMENT_NOT_DECLARED'
  | 'MODULE_DOCUMENT_NOT_FOUND'
  | 'MODULE_DOCUMENT_TOO_LARGE'
  | 'MODULE_DOCUMENT_NOT_TEXT';

export class ModuleDocumentationError extends Error {
  constructor(
    readonly code: ModuleDocumentationErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ModuleDocumentationError';
  }
}

export async function readModuleDocumentation(
  module: InstalledModule,
  requestedPath: string,
  options: ModuleDocumentationReadOptions
): Promise<ModuleDocumentContent> {
  const normalizedPath = normalizeDocumentPath(requestedPath);
  const document = (module.manifest.contributes?.docs || []).find(item => (
    normalizeDocumentPath(item.path) === normalizedPath
  ));
  if (!document) {
    throw new ModuleDocumentationError(
      'MODULE_DOCUMENT_NOT_DECLARED',
      '该文件没有在模块清单的公开文档中声明。'
    );
  }

  const roots = getDocumentRoots(module, normalizedPath, options);
  for (const root of roots) {
    const resolved = await resolveDocumentFile(root, normalizedPath);
    if (!resolved) continue;
    const stat = await fs.stat(resolved);
    if (stat.size > MAX_MODULE_DOCUMENT_BYTES) {
      throw new ModuleDocumentationError(
        'MODULE_DOCUMENT_TOO_LARGE',
        `模块文档超过 ${MAX_MODULE_DOCUMENT_BYTES / 1024 / 1024} MB，无法在 IDE 中预览。`
      );
    }
    const bytes = await fs.readFile(resolved);
    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new ModuleDocumentationError(
        'MODULE_DOCUMENT_NOT_TEXT',
        '模块文档不是有效的 UTF-8 文本，无法在 IDE 中预览。'
      );
    }
    const extension = path.extname(normalizedPath).toLowerCase();
    return {
      moduleId: module.manifest.id,
      title: document.title,
      path: normalizedPath,
      content,
      format: isMarkdownExtension(extension) ? 'markdown' : 'text',
      language: getDocumentLanguage(extension),
      size: stat.size
    };
  }

  throw new ModuleDocumentationError(
    'MODULE_DOCUMENT_NOT_FOUND',
    '模块文档文件不存在或无法从模块安装目录读取。'
  );
}

function normalizeDocumentPath(value: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!validateModuleRelativePath(trimmed)) {
    throw new ModuleDocumentationError(
      'MODULE_DOCUMENT_INVALID_PATH',
      '模块文档路径无效。'
    );
  }
  return trimmed.replace(/\\/gu, '/');
}

function getDocumentRoots(
  module: InstalledModule,
  documentPath: string,
  options: ModuleDocumentationReadOptions
): string[] {
  if (!module.isBuiltin) {
    return path.isAbsolute(module.installPath) ? [module.installPath] : [];
  }

  const workspaceRoot = path.resolve(options.workspaceRoot);
  const assetModuleId = BUILTIN_DOCUMENT_ASSET_MODULES[module.manifest.id] || module.manifest.id;
  const roots = [path.join(workspaceRoot, '.lingbuilder', 'modules', assetModuleId)];
  if (options.resourceRoot && documentPath.includes('/')) {
    roots.push(path.resolve(options.resourceRoot));
  }
  return Array.from(new Set(roots.map(root => path.resolve(root))));
}

async function resolveDocumentFile(root: string, relativePath: string): Promise<string | null> {
  try {
    const realRoot = await fs.realpath(root);
    const candidate = path.resolve(realRoot, ...relativePath.split('/'));
    const realCandidate = await fs.realpath(candidate);
    const relative = path.relative(realRoot, realCandidate);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
    const stat = await fs.stat(realCandidate);
    return stat.isFile() ? realCandidate : null;
  } catch {
    return null;
  }
}

function isMarkdownExtension(extension: string): boolean {
  return extension === '.md' || extension === '.markdown' || extension === '.mdown';
}

function getDocumentLanguage(extension: string): string | undefined {
  switch (extension) {
    case '.json': return 'json';
    case '.yml':
    case '.yaml': return 'yaml';
    case '.xml': return 'xml';
    case '.ini': return 'ini';
    case '.toml': return 'toml';
    default: return undefined;
  }
}
