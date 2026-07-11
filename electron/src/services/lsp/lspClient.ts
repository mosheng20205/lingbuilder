export type SupportedLspMethod = 'textDocument/completion' | 'textDocument/hover' | 'textDocument/signatureHelp' | 'textDocument/definition' | 'textDocument/implementation' | 'textDocument/documentSymbol' | 'workspace/symbol' | 'textDocument/references' | 'textDocument/prepareRename' | 'textDocument/codeAction';

export async function requestLsp<T>(request: { method: SupportedLspMethod; filePath?: string; line?: number; column?: number; query?: string; range?: unknown; context?: unknown }, signal?: AbortSignal): Promise<T | null> {
  const response = await fetch('/api/lsp/request', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({
      method: request.method, filePath: request.filePath, query: request.query, range: request.range, context: request.context,
      position: request.line === undefined ? undefined : { line: Math.max(0, request.line - 1), character: Math.max(0, (request.column || 1) - 1) }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) return null;
  return payload.result as T;
}

export const lspRangeToMonaco = (range: any) => ({
  startLineNumber: Number(range?.start?.line || 0) + 1, startColumn: Number(range?.start?.character || 0) + 1,
  endLineNumber: Number(range?.end?.line || 0) + 1, endColumn: Number(range?.end?.character || 0) + 1
});

export function normalizeLspLocations(value: any): Array<{ uri: string; range: any }> {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map(item => item.targetUri
    ? { uri: item.targetUri, range: item.targetSelectionRange || item.targetRange }
    : { uri: item.uri, range: item.range }).filter(item => typeof item.uri === 'string' && item.range);
}

export function normalizeCompletionItems(value: any): any[] {
  return Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
}

export function markupToText(value: any): string {
  if (typeof value === 'string') return value;
  if (typeof value?.value === 'string') return value.value;
  if (Array.isArray(value)) return value.map(markupToText).filter(Boolean).join('\n\n');
  return '';
}

export async function previewLspRefactor(body: unknown): Promise<any | null> {
  const response = await fetch('/api/lsp/refactor/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || '无法生成重构预览。');
  return payload.preview;
}

export async function applyLspRefactor(previewId: string): Promise<string[]> {
  const response = await fetch('/api/lsp/refactor/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewId }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || '无法应用重构。');
  return Array.isArray(payload.files) ? payload.files : [];
}
