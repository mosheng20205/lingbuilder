import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectFilePersistenceService, createProjectFileVersion } from '../files/projectFilePersistenceService';
import { decodeTextFile, encodeTextFile } from '../files/textFileService';
import type { TextFileFormat } from '../files/types';
import { WorkspacePathPolicy } from '../workspace/workspacePathPolicy';

export interface LspTextEdit { range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }
export interface LspWorkspaceEdit { changes?: Record<string, LspTextEdit[]>; documentChanges?: Array<{ textDocument?: { uri: string; version?: number | null }; edits?: LspTextEdit[]; kind?: string }> }
export interface LspEditPreviewFile { filePath: string; before: string; after: string; editCount: number; format: TextFileFormat }
export interface LspEditPreview { previewId: string; createdAt: string; files: LspEditPreviewFile[] }

interface StoredPreview extends LspEditPreview { versions: Record<string, string>; absolutePaths: Record<string, string> }

export class LspWorkspaceEditService {
  private readonly policy: WorkspacePathPolicy;
  private readonly persistence = createProjectFilePersistenceService();
  private readonly previews = new Map<string, StoredPreview>();
  constructor(private readonly workspaceRoot: string, private readonly maxPreviews = 20) { this.policy = new WorkspacePathPolicy(workspaceRoot); }

  async preview(edit: LspWorkspaceEdit): Promise<LspEditPreview> {
    const grouped = collectEdits(edit);
    if (grouped.size === 0) throw new Error('clangd 未返回可应用的文本编辑。');
    const files: LspEditPreviewFile[] = [];
    const versions: Record<string, string> = {};
    const absolutePaths: Record<string, string> = {};
    for (const [uri, edits] of grouped) {
      if (!uri.startsWith('file:')) throw new Error(`不支持非本地 LSP URI：${uri}`);
      const candidate = fileURLToPath(uri);
      const relative = path.relative(this.workspaceRoot, candidate).replace(/\\/gu, '/');
      const absolutePath = await this.policy.resolveExisting(relative, { rejectSymlinks: true });
      const bytes = await fs.readFile(absolutePath);
      const decoded = decodeTextFile(bytes);
      const after = applyTextEdits(decoded.content, edits);
      files.push({ filePath: relative, before: decoded.content, after, editCount: edits.length, format: decoded.format });
      versions[relative] = createProjectFileVersion(bytes); absolutePaths[relative] = absolutePath;
    }
    const previewId = crypto.randomUUID();
    const stored: StoredPreview = { previewId, createdAt: new Date().toISOString(), files, versions, absolutePaths };
    this.previews.set(previewId, stored);
    while (this.previews.size > this.maxPreviews) this.previews.delete(this.previews.keys().next().value!);
    return clonePreview(stored);
  }

  async apply(previewId: string): Promise<{ files: string[] }> {
    const preview = this.previews.get(previewId);
    if (!preview) throw new Error('重构预览不存在或已过期。');
    await this.persistence.writeAll(preview.files.map(file => ({
      targetPath: preview.absolutePaths[file.filePath],
      bytes: encodeTextFile(file.after, file.format),
      expectedVersion: preview.versions[file.filePath]
    })));
    this.previews.delete(previewId);
    return { files: preview.files.map(file => file.filePath) };
  }
}

export function applyTextEdits(source: string, edits: readonly LspTextEdit[]): string {
  const indexed = edits.map(edit => ({ edit, start: offsetAt(source, edit.range.start), end: offsetAt(source, edit.range.end) }))
    .sort((left, right) => right.start - left.start || right.end - left.end);
  for (let index = 1; index < indexed.length; index += 1) {
    if (indexed[index - 1].start < indexed[index].end) throw new Error('clangd 返回了相互重叠的编辑范围。');
  }
  let result = source;
  for (const item of indexed) result = result.slice(0, item.start) + item.edit.newText + result.slice(item.end);
  return result;
}

function offsetAt(source: string, position: { line: number; character: number }): number {
  if (!Number.isInteger(position.line) || !Number.isInteger(position.character) || position.line < 0 || position.character < 0) throw new Error('LSP 编辑位置无效。');
  const lines = source.split('\n');
  if (position.line >= lines.length) throw new Error('LSP 编辑行超出文件范围。');
  const line = lines[position.line].replace(/\r$/u, '');
  if (position.character > line.length) throw new Error('LSP 编辑列超出文件范围。');
  let offset = 0; for (let index = 0; index < position.line; index += 1) offset += lines[index].length + 1;
  return offset + position.character;
}

function collectEdits(edit: LspWorkspaceEdit): Map<string, LspTextEdit[]> {
  const grouped = new Map<string, LspTextEdit[]>();
  Object.entries(edit?.changes || {}).forEach(([uri, edits]) => grouped.set(uri, [...(grouped.get(uri) || []), ...edits]));
  for (const change of edit?.documentChanges || []) {
    if (!change.textDocument?.uri || !Array.isArray(change.edits)) throw new Error('暂不允许 clangd 重构创建、删除或重命名文件。');
    grouped.set(change.textDocument.uri, [...(grouped.get(change.textDocument.uri) || []), ...change.edits]);
  }
  return grouped;
}
const clonePreview = (preview: StoredPreview): LspEditPreview => ({ previewId: preview.previewId, createdAt: preview.createdAt, files: preview.files.map(file => ({ ...file, format: { ...file.format } })) });
