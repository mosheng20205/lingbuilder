import { applyLingCppAstEdit } from './astEditService';
import { parseLingCpp } from './parser';
import { LingCppMethod } from './types';

export interface FlushPendingEditsResult {
  success: boolean;
  sourceCode: string;
  changed: boolean;
  diagnostics: string[];
  appliedDraftCount: number;
}

export type BeginnerCodeDrafts = Record<string, string>;

export function createBeginnerCodeDraftKey(
  className: string,
  methodKind: LingCppMethod['kind'],
  methodName: string
): string {
  return `${className}:${methodKind}:${methodName}`;
}

function methodBodyText(method: LingCppMethod): string {
  return method.statements.map(statement => statement.text).join('\n').replace(/\s+$/u, '');
}

/**
 * Applies all beginner-editor body drafts in memory before any caller mutates
 * React state or writes to disk. A failed draft makes the whole batch fail and
 * returns the original source, so callers never persist a partially flushed file.
 */
export function applyPendingBeginnerCodeDrafts(
  sourceCode: string,
  drafts: BeginnerCodeDrafts,
  localStatementAnchors: Record<string, Record<string, number>> = {}
): FlushPendingEditsResult {
  const draftEntries = Object.entries(drafts);
  if (draftEntries.length === 0) {
    return {
      success: true,
      sourceCode,
      changed: false,
      diagnostics: [],
      appliedDraftCount: 0
    };
  }

  const parsed = parseLingCpp(sourceCode);
  const targets = new Map<string, { className: string; method: LingCppMethod }>();
  const ambiguousTargets = new Set<string>();

  for (const cls of parsed.program.classes) {
    for (const method of cls.methods) {
      const key = createBeginnerCodeDraftKey(cls.name, method.kind, method.name);
      if (targets.has(key)) ambiguousTargets.add(key);
      targets.set(key, { className: cls.name, method });
    }
  }

  const orderedDrafts = draftEntries
    .map(([key, body]) => ({ key, body, target: targets.get(key) }))
    .sort((left, right) => (left.target?.method.line ?? Number.MAX_SAFE_INTEGER) - (right.target?.method.line ?? Number.MAX_SAFE_INTEGER));

  let nextSourceCode = sourceCode;
  let appliedDraftCount = 0;

  for (const draft of orderedDrafts) {
    if (ambiguousTargets.has(draft.key)) {
      return {
        success: false,
        sourceCode,
        changed: false,
        diagnostics: [`新手编辑器无法唯一定位代码块：${draft.key}。源码未保存，请检查重名子程序。`],
        appliedDraftCount: 0
      };
    }
    if (!draft.target) {
      return {
        success: false,
        sourceCode,
        changed: false,
        diagnostics: [`新手编辑器找不到待提交的代码块：${draft.key}。源码未保存，请重新打开该文件后再试。`],
        appliedDraftCount: 0
      };
    }

    const normalizedBody = draft.body.replace(/\s+$/u, '');
    if (normalizedBody === methodBodyText(draft.target.method)) continue;

    const result = applyLingCppAstEdit(nextSourceCode, {
      kind: 'update-method-body',
      className: draft.target.className,
      methodName: draft.target.method.name,
      bodyLines: normalizedBody ? normalizedBody.split(/\r?\n/u) : [],
      localStatementAnchors: localStatementAnchors[draft.key]
    });
    if (!result.success) {
      return {
        success: false,
        sourceCode,
        changed: false,
        diagnostics: [
          result.error || result.diagnostics[0]?.message || `提交代码块 ${draft.target.method.name} 失败，源码已保持不变。`
        ],
        appliedDraftCount: 0
      };
    }

    nextSourceCode = result.sourceCode;
    appliedDraftCount += 1;
  }

  return {
    success: true,
    sourceCode: nextSourceCode,
    changed: nextSourceCode !== sourceCode,
    diagnostics: [],
    appliedDraftCount
  };
}
