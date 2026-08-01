import ts from 'typescript';
import { normalizeControlReferenceSnippet } from '../../src/services/modules/bindingValueType';
import type { LingBuilderModuleManifest, ModuleCommandBinding } from '../../src/services/modules/types';

export interface ControlReferenceSourceChange {
  start: number;
  end: number;
  line: number;
  original: string;
  replacement: string;
}

export interface ControlReferenceSourceAuditResult {
  source: string;
  changes: ControlReferenceSourceChange[];
}

export function normalizeControlReferenceSourceLiterals(
  source: string,
  fileName: string,
  manifests: readonly LingBuilderModuleManifest[]
): ControlReferenceSourceAuditResult {
  const bindings = buildBindingIndex(manifests);
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const changes: ControlReferenceSourceChange[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const normalized = normalizeLiteralValue(node.text, bindings);
      if (normalized !== node.text) {
        const start = node.getStart(sourceFile);
        const end = node.getEnd();
        changes.push({
          start,
          end,
          line: sourceFile.getLineAndCharacterOfPosition(start).line + 1,
          original: source.slice(start, end),
          replacement: encodeLiteral(normalized, source[start] || "'")
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  let next = source;
  [...changes].sort((left, right) => right.start - left.start).forEach(change => {
    next = `${next.slice(0, change.start)}${change.replacement}${next.slice(change.end)}`;
  });
  return { source: next, changes };
}

function buildBindingIndex(manifests: readonly LingBuilderModuleManifest[]): Map<string, ModuleCommandBinding> {
  const result = new Map<string, ModuleCommandBinding>();
  manifests.forEach(manifest => {
    (manifest.bindings?.commands || []).forEach(binding => {
      if ((binding.parameters || []).some(parameter => parameter.type === 'controlRef')) {
        result.set(binding.command, binding);
      }
    });
  });
  return result;
}

function normalizeLiteralValue(value: string, bindings: ReadonlyMap<string, ModuleCommandBinding>): string {
  return normalizeControlReferenceSnippet(value, [...bindings.values()]) || value;
}

function encodeLiteral(value: string, quote: string): string {
  if (quote === '`') {
    return `\`${value
      .replace(/\\/gu, '\\\\')
      .replace(/`/gu, '\\`')
      .replace(/\$\{/gu, '\\${')}\``;
  }
  const delimiter = quote === '"' ? '"' : "'";
  const escaped = value
    .replace(/\\/gu, '\\\\')
    .replace(/\r/gu, '\\r')
    .replace(/\n/gu, '\\n')
    .replace(/\t/gu, '\\t')
    .split(delimiter).join(`\\${delimiter}`);
  return `${delimiter}${escaped}${delimiter}`;
}
