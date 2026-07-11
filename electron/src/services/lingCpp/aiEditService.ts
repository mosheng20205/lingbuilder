import {
  AppliedWorkspaceFile,
  LingCppEditContext,
  LingCppEditDraft,
  LingCppEditDraftFile,
  LingCppWorkspaceFile,
  WorkspaceEditChange,
  WorkspaceEditProposal,
  WorkspaceEditRange
} from './types';

const PROPOSAL_TTL_MS = 30 * 60_000;
const MAX_PROPOSALS = 100;
const proposalStore = new Map<string, { proposal: WorkspaceEditProposal; expiresAt: number }>();

export function proposeLingCppEdit(context: LingCppEditContext, draft: LingCppEditDraft = {}): WorkspaceEditProposal {
  const now = new Date().toISOString();
  const workspaceFiles = resolveWorkspaceFiles(context);
  const draftFiles = resolveDraftFiles(context, draft);
  let changes = draftFiles
    .map(fileDraft => createChangeForDraftFile(fileDraft, workspaceFiles, context))
    .filter((change): change is WorkspaceEditChange => Boolean(change));

  if (changes.length === 0) {
    const sourceCode = normalizeLineEndings(context.sourceCode);
    const fallbackRange = context.selection || createFullDocumentRange(sourceCode);
    const updatedSource = buildLocalUpdatedSource({ ...context, sourceCode });
    changes = [
      createWorkspaceEditChangeFromRewrite(context.filePath, sourceCode, updatedSource, fallbackRange)
    ];
  }

  const proposal: WorkspaceEditProposal = {
    id: `lingcpp-edit-${globalThis.crypto.randomUUID()}`,
    title: 'AI 中文 C++ 编辑预览',
    summary: draft.summary?.trim() || context.instruction.trim() || '根据当前上下文生成中文 C++ 编辑建议',
    createdAt: now,
    explanation: draft.explanation?.trim() || '该提案只生成可预览的 WorkspaceEdit；调用方确认后才会应用到文件。',
    changes
  };

  purgeExpiredProposals();
  while (proposalStore.size >= MAX_PROPOSALS) proposalStore.delete(proposalStore.keys().next().value as string);
  proposalStore.set(proposal.id, { proposal, expiresAt: Date.now() + PROPOSAL_TTL_MS });
  return proposal;
}

export function getWorkspaceEditProposal(proposalId: string): WorkspaceEditProposal | undefined {
  purgeExpiredProposals();
  return proposalStore.get(proposalId)?.proposal;
}

function purgeExpiredProposals(now = Date.now()): void {
  for (const [id, record] of proposalStore) if (record.expiresAt <= now) proposalStore.delete(id);
}

export function rejectWorkspaceEdit(proposalId: string): boolean {
  return proposalStore.delete(proposalId);
}

export function applyWorkspaceEdit(sourceCode: string, proposal: WorkspaceEditProposal): string {
  const change = proposal.changes[0];
  if (!change) return sourceCode;
  return replaceRange(sourceCode, change.range, change.newText);
}

export function applyWorkspaceEditToFiles(
  workspaceFiles: LingCppWorkspaceFile[],
  proposal: WorkspaceEditProposal
): AppliedWorkspaceFile[] {
  const sourceMap = new Map<string, string>(
    workspaceFiles.map(file => [normalizeFilePath(file.filePath), normalizeLineEndings(file.sourceCode)])
  );

  proposal.changes.forEach(change => {
    const normalizedPath = normalizeFilePath(change.filePath);
    const currentSource = sourceMap.get(normalizedPath) || '';
    const currentText = getTextForRange(currentSource, change.range);
    if (currentText !== change.originalText) {
      throw new Error(`文件 ${change.filePath} 在 AI 提案生成后已发生变化，请重新生成提案。`);
    }
    const nextSource = replaceRange(currentSource, change.range, change.newText);
    sourceMap.set(normalizedPath, nextSource);
  });

  const result: AppliedWorkspaceFile[] = [];
  proposal.changes.forEach(change => {
    const normalizedPath = normalizeFilePath(change.filePath);
    const nextSource = sourceMap.get(normalizedPath);
    if (typeof nextSource === 'string' && !result.some(file => normalizeFilePath(file.filePath) === normalizedPath)) {
      result.push({
        filePath: change.filePath,
        sourceCode: nextSource
      });
    }
  });

  return result;
}

export function createWorkspaceEditChangeFromRewrite(
  filePath: string,
  originalSource: string,
  updatedSource: string,
  fallbackRange: WorkspaceEditRange = createFullDocumentRange(originalSource)
): WorkspaceEditChange {
  if (originalSource === updatedSource) {
    const originalText = getTextForRange(originalSource, fallbackRange);
    return {
      filePath,
      range: fallbackRange,
      originalText,
      newText: originalText
    };
  }

  const maxPrefix = Math.min(originalSource.length, updatedSource.length);
  let prefixLength = 0;
  while (prefixLength < maxPrefix && originalSource[prefixLength] === updatedSource[prefixLength]) {
    prefixLength += 1;
  }

  let originalSuffixStart = originalSource.length;
  let updatedSuffixStart = updatedSource.length;
  while (
    originalSuffixStart > prefixLength &&
    updatedSuffixStart > prefixLength &&
    originalSource[originalSuffixStart - 1] === updatedSource[updatedSuffixStart - 1]
  ) {
    originalSuffixStart -= 1;
    updatedSuffixStart -= 1;
  }

  const range = createRangeFromOffsets(originalSource, prefixLength, originalSuffixStart);
  return {
    filePath,
    range,
    originalText: originalSource.slice(prefixLength, originalSuffixStart),
    newText: updatedSource.slice(prefixLength, updatedSuffixStart)
  };
}

function buildLocalEdit(originalText: string, instruction: string): string {
  const trimmedInstruction = instruction.trim();
  if (!originalText.trim()) {
    return [
      '    调试输出("AI 已生成新的中文 C++ 代码块")',
      trimmedInstruction ? `    // 需求：${trimmedInstruction}` : ''
    ].filter(Boolean).join('\n');
  }

  return [
    originalText.trimEnd(),
    '',
    `// AI 编辑建议：${trimmedInstruction || '请复核此处中文 C++ 逻辑'}`
  ].join('\n');
}

function buildLocalUpdatedSource(context: LingCppEditContext): string {
  const range = context.selection || createFullDocumentRange(context.sourceCode);
  const originalText = getTextForRange(context.sourceCode, range);
  const newText = buildLocalEdit(originalText, context.instruction);
  return replaceRange(context.sourceCode, range, newText);
}

function createChangeForDraftFile(
  fileDraft: LingCppEditDraftFile,
  workspaceFiles: LingCppWorkspaceFile[],
  context: LingCppEditContext
): WorkspaceEditChange | undefined {
  const matchingFile = workspaceFiles.find(file => normalizeFilePath(file.filePath) === normalizeFilePath(fileDraft.filePath));
  if (!matchingFile) return undefined;

  const originalSource = normalizeLineEndings(matchingFile.sourceCode);
  const updatedSource = normalizeLineEndings(fileDraft.updatedSource);
  const fallbackRange = normalizeFilePath(fileDraft.filePath) === normalizeFilePath(context.filePath) && context.selection
    ? context.selection
    : createFullDocumentRange(originalSource);

  return createWorkspaceEditChangeFromRewrite(fileDraft.filePath, originalSource, updatedSource, fallbackRange);
}

function resolveDraftFiles(context: LingCppEditContext, draft: LingCppEditDraft): LingCppEditDraftFile[] {
  if (Array.isArray(draft.files) && draft.files.length > 0) {
    return dedupeDraftFiles(draft.files);
  }

  if (typeof draft.updatedSource === 'string') {
    return [{
      filePath: context.filePath,
      updatedSource: draft.updatedSource
    }];
  }

  return [{
    filePath: context.filePath,
    updatedSource: buildLocalUpdatedSource({
      ...context,
      sourceCode: normalizeLineEndings(context.sourceCode)
    })
  }];
}

function dedupeDraftFiles(files: LingCppEditDraftFile[]): LingCppEditDraftFile[] {
  const deduped = new Map<string, LingCppEditDraftFile>();
  files.forEach(file => {
    if (!file?.filePath || typeof file.updatedSource !== 'string') return;
    deduped.set(normalizeFilePath(file.filePath), {
      filePath: file.filePath,
      updatedSource: file.updatedSource
    });
  });
  return [...deduped.values()];
}

function resolveWorkspaceFiles(context: LingCppEditContext): LingCppWorkspaceFile[] {
  const files = [...(context.workspaceFiles || [])];
  if (!files.some(file => normalizeFilePath(file.filePath) === normalizeFilePath(context.filePath))) {
    files.unshift({
      filePath: context.filePath,
      sourceCode: context.sourceCode
    });
  }

  const deduped = new Map<string, LingCppWorkspaceFile>();
  files.forEach(file => {
    if (!file?.filePath || typeof file.sourceCode !== 'string') return;
    deduped.set(normalizeFilePath(file.filePath), {
      ...file,
      sourceCode: normalizeLineEndings(file.sourceCode)
    });
  });
  return [...deduped.values()];
}

function getTextForRange(sourceCode: string, range: WorkspaceEditRange): string {
  const lines = sourceCode.split(/\r?\n/);
  const startLine = Math.max(1, range.startLine);
  const endLine = Math.max(startLine, range.endLine);
  if (startLine === endLine) {
    const line = lines[startLine - 1] || '';
    const endColumn = range.endColumn === Number.MAX_SAFE_INTEGER ? line.length : Math.max(0, range.endColumn - 1);
    return line.slice(Math.max(0, range.startColumn - 1), endColumn);
  }
  const selected = lines.slice(startLine - 1, endLine);
  if (selected.length === 0) return '';
  selected[0] = selected[0].slice(Math.max(0, range.startColumn - 1));
  if (range.endColumn !== Number.MAX_SAFE_INTEGER) {
    selected[selected.length - 1] = selected[selected.length - 1].slice(0, Math.max(0, range.endColumn - 1));
  }
  return selected.join('\n');
}

function createFullDocumentRange(sourceCode: string): WorkspaceEditRange {
  const lines = sourceCode.split('\n');
  const endLine = Math.max(1, lines.length);
  const endColumn = (lines[endLine - 1] || '').length + 1;
  return {
    startLine: 1,
    startColumn: 1,
    endLine,
    endColumn
  };
}

function createRangeFromOffsets(sourceCode: string, startOffset: number, endOffset: number): WorkspaceEditRange {
  const start = offsetToPosition(sourceCode, startOffset);
  const end = offsetToPosition(sourceCode, endOffset);
  return {
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column
  };
}

function offsetToPosition(sourceCode: string, offset: number): { line: number; column: number } {
  const clampedOffset = Math.max(0, Math.min(offset, sourceCode.length));
  const prefix = sourceCode.slice(0, clampedOffset);
  const lines = prefix.split('\n');
  return {
    line: Math.max(1, lines.length),
    column: (lines[lines.length - 1] || '').length + 1
  };
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

function normalizeFilePath(value: string): string {
  return value.replace(/\\/g, '/').trim();
}

function replaceRange(
  sourceCode: string,
  range: WorkspaceEditRange,
  nextText: string
): string {
  const lines = sourceCode.split(/\r?\n/);
  const startLine = Math.max(1, range.startLine);
  const endLine = Math.max(startLine, range.endLine);
  const startIndex = startLine - 1;
  const endIndex = Math.min(lines.length - 1, endLine - 1);
  const startColumn = Math.max(0, range.startColumn - 1);
  const endColumn = range.endColumn === Number.MAX_SAFE_INTEGER
    ? lines[endIndex]?.length || 0
    : Math.max(0, range.endColumn - 1);
  const before = (lines[startIndex] || '').slice(0, startColumn);
  const after = (lines[endIndex] || '').slice(endColumn);
  const replacement = `${before}${nextText}${after}`.split('\n');
  lines.splice(startIndex, endIndex - startIndex + 1, ...replacement);
  return lines.join('\n');
}
