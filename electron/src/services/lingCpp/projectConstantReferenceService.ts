import { createWorkspaceEditChangeFromRewrite } from './aiEditService';
import { normalizeIdentifier, parseLingCpp } from './parser';
import type { LingCppWorkspaceFile, WorkspaceEditProposal } from './types';

export interface ProjectConstantReference {
  filePath: string;
  line: number;
  column: number;
  text: string;
  isDeclaration: boolean;
}

const IDENTIFIER_PATTERN = /[A-Za-z_\u3400-\u9fff][A-Za-z0-9_\u3400-\u9fff]*/gu;

export function findProjectConstantReferences(
  files: LingCppWorkspaceFile[],
  constantName: string
): ProjectConstantReference[] {
  const normalizedName = normalizeIdentifier(constantName);
  return files
    .filter(file => file.language === 'lingcpp' || file.filePath.toLocaleLowerCase().endsWith('.lcpp'))
    .flatMap(file => scanFile(file, normalizedName));
}

export function createProjectConstantRenameProposal(
  files: LingCppWorkspaceFile[],
  declarationFilePath: string,
  oldName: string,
  newName: string
): WorkspaceEditProposal {
  const trimmedName = newName.trim();
  if (!/^[A-Za-z_\u3400-\u9fff][A-Za-z0-9_\u3400-\u9fff]*$/u.test(trimmedName)) throw new Error('常量名称只能包含中文、字母、数字和下划线，且不能以数字开头。');
  const normalizedNewName = normalizeIdentifier(trimmedName);
  const declarationFile = files.find(file => normalizePath(file.filePath) === normalizePath(declarationFilePath));
  if (!declarationFile) throw new Error('找不到项目常量声明文件。');
  const declarationProgram = parseLingCpp(declarationFile.sourceCode).program;
  if ([...declarationProgram.constants, ...declarationProgram.globals].some(symbol => normalizeIdentifier(symbol.name) === normalizedNewName && normalizeIdentifier(symbol.name) !== normalizeIdentifier(oldName))) {
    throw new Error(`项目中已经存在名为 ${trimmedName} 的常量或全局变量。`);
  }
  const shadowingSymbol = files
    .map(file => parseLingCpp(file.sourceCode).program)
    .flatMap(program => program.classes)
    .flatMap(classNode => [
      ...classNode.members.map(member => ({ kind: '成员', name: member.name })),
      ...classNode.methods.flatMap(method => [
        ...method.parameters.map(parameter => ({ kind: '参数', name: parameter.name })),
        ...(method.locals || []).map(local => ({ kind: local.isConstant ? '局部常量' : '局部变量', name: local.name }))
      ])
    ])
    .find(symbol => normalizeIdentifier(symbol.name) === normalizedNewName);
  if (shadowingSymbol) {
    throw new Error(`不能重命名为 ${trimmedName}：项目中已有同名${shadowingSymbol.kind}，会遮蔽项目常量。`);
  }

  const references = findProjectConstantReferences(files, oldName);
  const byFile = new Map<string, ProjectConstantReference[]>();
  references.forEach(reference => byFile.set(reference.filePath, [...(byFile.get(reference.filePath) || []), reference]));
  const changes = files.flatMap(file => {
    const matches = byFile.get(file.filePath);
    if (!matches?.length) return [];
    const updatedSource = replaceReferences(file.sourceCode, matches, trimmedName);
    return [createWorkspaceEditChangeFromRewrite(file.filePath, file.sourceCode, updatedSource)];
  });
  if (!changes.length) throw new Error(`没有找到项目常量 ${oldName} 的声明或引用。`);
  return {
    id: `lingcpp-constant-rename-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: `重命名项目常量 ${oldName}`,
    summary: `把 ${oldName} 重命名为 ${trimmedName}，共更新 ${references.length} 处。`,
    createdAt: new Date().toISOString(),
    explanation: '只修改 .lcpp 中解析为该项目常量的标识符；字符串、注释、成员访问、处理器引用和函数调用保持不变。',
    changes
  };
}

export function getProjectConstantNameAtCursor(
  source: string,
  cursor: number,
  constantNames: string[]
): string | undefined {
  const safeCursor = Math.max(0, Math.min(cursor, source.length));
  const lineStart = source.lastIndexOf('\n', Math.max(0, safeCursor - 1)) + 1;
  const lineEndCandidate = source.indexOf('\n', safeCursor);
  const lineEnd = lineEndCandidate < 0 ? source.length : lineEndCandidate;
  const line = source.slice(lineStart, lineEnd).replace(/\r$/u, '');
  const offset = safeCursor - lineStart;
  if (!line.trim() || line.trimStart().startsWith('//') || line.trimStart().startsWith('注释 ')) return undefined;
  const stringRanges = collectStringRanges(line);
  for (const match of line.matchAll(IDENTIFIER_PATTERN)) {
    const start = match.index || 0;
    const value = match[0] || '';
    if (offset < start || offset > start + value.length) continue;
    if (stringRanges.some(range => start >= range.start && start < range.end)) return undefined;
    const before = line.slice(0, start).trimEnd();
    const after = line.slice(start + value.length).trimStart();
    if (/[.&]$/u.test(before) || /^[（(]/u.test(after)) return undefined;
    const normalizedValue = normalizeIdentifier(value);
    return constantNames.find(name => normalizeIdentifier(name) === normalizedValue);
  }
  return undefined;
}

function scanFile(file: LingCppWorkspaceFile, normalizedName: string): ProjectConstantReference[] {
  const parsed = parseLingCpp(file.sourceCode);
  const declarationLines = new Set(parsed.program.constants.filter(item => normalizeIdentifier(item.name) === normalizedName).map(item => item.line));
  const references: ProjectConstantReference[] = [];
  file.sourceCode.split(/\r?\n/u).forEach((lineText, index) => {
    const trimmed = lineText.trimStart();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('注释 ')) return;
    const stringRanges = collectStringRanges(lineText);
    for (const match of lineText.matchAll(IDENTIFIER_PATTERN)) {
      const start = match.index || 0;
      const value = match[0] || '';
      if (normalizeIdentifier(value) !== normalizedName || stringRanges.some(range => start >= range.start && start < range.end)) continue;
      const before = lineText.slice(0, start).trimEnd();
      const after = lineText.slice(start + value.length).trimStart();
      if (/[.&]$/u.test(before) || /^[（(]/u.test(after)) continue;
      references.push({
        filePath: file.filePath,
        line: index + 1,
        column: start + 1,
        text: lineText,
        isDeclaration: declarationLines.has(index + 1)
      });
    }
  });
  return references;
}

function collectStringRanges(line: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let quote: '"' | '“' | null = null;
  let start = -1;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] || '';
    if (!quote && (character === '"' || character === '“')) { quote = character; start = index; continue; }
    if (!quote) continue;
    if (quote === '"' && character === '\\') { index += 1; continue; }
    if ((quote === '"' && character === '"') || (quote === '“' && character === '”')) {
      ranges.push({ start, end: index + 1 });
      quote = null;
    }
  }
  if (quote) ranges.push({ start, end: line.length });
  return ranges;
}

function replaceReferences(source: string, references: ProjectConstantReference[], newName: string): string {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/u);
  const byLine = new Map<number, ProjectConstantReference[]>();
  references.forEach(reference => byLine.set(reference.line, [...(byLine.get(reference.line) || []), reference]));
  byLine.forEach((lineReferences, lineNumber) => {
    let line = lines[lineNumber - 1] || '';
    [...lineReferences].sort((left, right) => right.column - left.column).forEach(reference => {
      const start = reference.column - 1;
      const match = line.slice(start).match(/^[A-Za-z_\u3400-\u9fff][A-Za-z0-9_\u3400-\u9fff]*/u)?.[0] || '';
      line = `${line.slice(0, start)}${newName}${line.slice(start + match.length)}`;
    });
    lines[lineNumber - 1] = line;
  });
  return lines.join(newline);
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/').toLocaleLowerCase();
}
