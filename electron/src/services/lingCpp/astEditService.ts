import { createWorkspaceEditChangeFromRewrite } from './aiEditService';
import { normalizeIdentifier, parseLingCpp } from './parser';
import {
  LingCppAstEdit,
  LingCppAstEditResult,
  LingCppClass,
  LingCppDiagnostic,
  LingCppMember,
  LingCppMethod,
  LingCppParameter
} from './types';

const DEFAULT_FILE_PATH = 'memory.lcpp';

export function applyLingCppAstEdit(source: string, edit: LingCppAstEdit): LingCppAstEditResult {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const originalSource = source;
  const parsed = parseLingCpp(source);

  try {
    const lines = source.split(/\r?\n/);
    const updatedLines = applyEditToLines(lines, parsed.program.classes, edit);
    const updatedSource = updatedLines.join(newline);
    const nextParse = parseLingCpp(updatedSource);
    const blockingDiagnostics = nextParse.diagnostics.filter(diagnostic => diagnostic.level === 'error');
    if (blockingDiagnostics.length > 0) {
      return failedResult(originalSource, blockingDiagnostics, blockingDiagnostics[0]?.message || '结构编辑后源码存在错误。');
    }

    return {
      success: true,
      sourceCode: updatedSource,
      diagnostics: nextParse.diagnostics,
      change: createWorkspaceEditChangeFromRewrite(DEFAULT_FILE_PATH, originalSource, updatedSource)
    };
  } catch (error) {
    return failedResult(originalSource, parsed.diagnostics, error instanceof Error ? error.message : '结构编辑失败。');
  }
}

function applyEditToLines(lines: string[], classes: LingCppClass[], edit: LingCppAstEdit): string[] {
  const next = [...lines];
  if (edit.kind === 'update-package') {
    const packageIndex = next.findIndex(line => line.trim().startsWith('包 '));
    const line = `包 ${edit.packageName.trim()}`;
    if (packageIndex >= 0) next[packageIndex] = `${indentOf(next[packageIndex])}${line}`;
    else next.unshift(line);
    return next;
  }

  if (edit.kind === 'update-note') {
    replaceOrInsertNote(next, edit.line, edit.note);
    return next;
  }

  const cls = resolveClass(classes, edit.className, 'line' in edit ? edit.line : undefined);
  if (!cls) throw new Error('未找到要编辑的类。');

  if (edit.kind === 'update-class') {
    const index = lineIndex(cls.line);
    next[index] = formatClassDeclaration(next[index] || '', edit.newName || cls.name, edit.baseClass ?? cls.baseClass);
    if (edit.note) replaceOrInsertNote(next, cls.line, edit.note);
    return next;
  }

  if (edit.kind === 'add-member') {
    insertMember(next, cls, edit.member);
    return next;
  }

  if (edit.kind === 'update-member') {
    const member = resolveMember(cls, edit.memberName);
    if (!member) throw new Error(`未找到成员变量：${edit.memberName}`);
    const index = lineIndex(member.line);
    next[index] = formatMemberDeclaration(next[index] || '', {
      name: edit.newName || member.name,
      type: edit.type || member.type,
      initialValue: edit.initialValue ?? member.initialValue
    });
    if (edit.note) replaceOrInsertNote(next, member.line, edit.note);
    if (edit.access && edit.access !== member.access) next.splice(index, 0, `${indentOf(next[index])}${edit.access}:`);
    return next;
  }

  if (edit.kind === 'delete-member') {
    const member = resolveMember(cls, edit.memberName);
    if (!member) throw new Error(`未找到成员变量：${edit.memberName}`);
    next.splice(lineIndex(member.line), 1);
    return next;
  }

  if (edit.kind === 'add-event') {
    insertEvent(next, cls, edit.event);
    return next;
  }

  if (edit.kind === 'update-event') {
    const method = resolveMethod(cls, edit.handlerName, 'event');
    if (!method) throw new Error(`未找到事件处理器：${edit.handlerName}`);
    const index = lineIndex(method.line);
    next[index] = formatEventDeclaration(next[index] || '', edit.newHandlerName || method.name, edit.parameters ?? method.parameters);
    if (edit.note) replaceOrInsertNote(next, method.line, edit.note);
    return next;
  }

  if (edit.kind === 'delete-event') {
    const method = resolveMethod(cls, edit.handlerName, 'event');
    if (!method) throw new Error(`未找到事件处理器：${edit.handlerName}`);
    removeMethodBlock(next, method);
    return next;
  }

  if (edit.kind === 'add-method') {
    insertMethod(next, cls, edit.method);
    return next;
  }

  if (edit.kind === 'update-method-signature') {
    const method = resolveMethod(cls, edit.methodName);
    if (!method) throw new Error(`未找到方法：${edit.methodName}`);
    const index = lineIndex(method.line);
    next[index] = formatMethodDeclaration(
      next[index] || '',
      method,
      edit.newName || method.name,
      edit.returnType || method.returnType,
      edit.parameters ?? method.parameters
    );
    if (edit.note) replaceOrInsertNote(next, method.line, edit.note);
    return next;
  }

  if (edit.kind === 'update-method-body') {
    const method = resolveMethod(cls, edit.methodName);
    if (!method) throw new Error(`未找到方法：${edit.methodName}`);
    replaceMethodBody(next, method, edit.bodyLines);
    return next;
  }

  return next;
}

function insertMember(
  lines: string[],
  cls: LingCppClass,
  member: { name: string; type: string; access?: string; initialValue?: string; note?: string }
): void {
  const insertAt = findMemberInsertIndex(cls);
  const indent = inferClassBodyIndent(lines, cls);
  const nextLines = [
    member.note ? `${indent}// ${member.note.trim()}` : '',
    formatMemberDeclaration(`${indent}${member.type} ${member.name}`, member)
  ].filter(Boolean);
  lines.splice(insertAt, 0, ...nextLines);
}

function insertEvent(
  lines: string[],
  cls: LingCppClass,
  event: { handlerName: string; access?: string; parameters?: LingCppParameter[]; note?: string }
): void {
  const insertAt = Math.max(lineIndex(cls.line + 1), lineIndex(cls.endLine || lines.length));
  const indent = inferClassBodyIndent(lines, cls);
  const bodyIndent = `${indent}    `;
  const nextLines = [
    '',
    event.note ? `${indent}// ${event.note.trim()}` : '',
    `${indent}事件 ${event.handlerName.trim()}(${formatParameters(event.parameters || [])})`,
    `${bodyIndent}调试输出("${event.handlerName.trim()} 已触发")`
  ].filter(line => line !== '');
  lines.splice(insertAt, 0, ...nextLines);
}

function insertMethod(
  lines: string[],
  cls: LingCppClass,
  method: { name: string; returnType?: string; parameters?: LingCppParameter[]; bodyLines?: string[]; note?: string }
): void {
  const insertAt = Math.max(lineIndex(cls.line + 1), lineIndex(cls.endLine || lines.length));
  const indent = inferClassBodyIndent(lines, cls);
  const bodyIndent = `${indent}    `;
  const bodyLines = normalizeMethodBodyLines(method.bodyLines || [`调试输出("${method.name.trim()} 已执行")`])
    .map(line => line.trim() ? `${bodyIndent}${line}` : '');
  const nextLines = [
    '',
    method.note ? `${indent}// ${method.note.trim()}` : '',
    `${indent}${method.returnType?.trim() || '空'} ${method.name.trim()}(${formatParameters(method.parameters || [])})`,
    ...bodyLines
  ].filter(line => line !== '');
  lines.splice(insertAt, 0, ...nextLines);
}

function replaceOrInsertNote(lines: string[], lineNumber: number, note: string): void {
  const index = lineIndex(lineNumber);
  const targetLine = lines[index] || '';
  const previousLine = lines[index - 1] || '';
  const noteLine = `${indentOf(targetLine)}// ${note.trim()}`;
  if (targetLine.trim().startsWith('//') || targetLine.trim().startsWith('注释 ')) {
    lines[index] = noteLine;
    return;
  }
  if (previousLine.trim().startsWith('//') || previousLine.trim().startsWith('注释 ')) {
    lines[index - 1] = `${indentOf(previousLine)}// ${note.trim()}`;
    return;
  }
  lines.splice(index, 0, noteLine);
}

function removeMethodBlock(lines: string[], method: LingCppMethod): void {
  const start = lineIndex(method.line);
  const end = lineIndex(method.endLine || method.statements.at(-1)?.line || method.line);
  lines.splice(start, Math.max(1, end - start + 1));
}

function replaceMethodBody(lines: string[], method: LingCppMethod, bodyLines: string[]): void {
  const start = lineIndex(method.line) + 1;
  const end = lineIndex(method.endLine || method.statements.at(-1)?.line || method.line);
  const deleteCount = Math.max(0, end - start + 1);
  const bodyIndent = inferMethodBodyIndent(lines, method);
  const normalizedBody = normalizeMethodBodyLines(bodyLines).map(line =>
    line.trim() ? `${bodyIndent}${line}` : ''
  );
  lines.splice(start, deleteCount, ...normalizedBody);
}

function resolveClass(classes: LingCppClass[], className?: string, line?: number): LingCppClass | undefined {
  if (line) {
    const byLine = classes.find(cls => cls.line === line || (line >= cls.line && line <= (cls.endLine || cls.line)));
    if (byLine) return byLine;
  }
  if (className) {
    const normalized = normalizeIdentifier(className);
    const byName = classes.find(cls => normalizeIdentifier(cls.name) === normalized);
    if (byName) return byName;
  }
  return classes[0];
}

function resolveMember(cls: LingCppClass, memberName: string): LingCppMember | undefined {
  const normalized = normalizeIdentifier(memberName);
  return cls.members.find(member => normalizeIdentifier(member.name) === normalized);
}

function resolveMethod(cls: LingCppClass, methodName: string, kind?: LingCppMethod['kind']): LingCppMethod | undefined {
  const normalized = normalizeIdentifier(methodName);
  return cls.methods.find(method => normalizeIdentifier(method.name) === normalized && (!kind || method.kind === kind));
}

function findMemberInsertIndex(cls: LingCppClass): number {
  const memberLines = cls.members.map(member => member.line);
  if (memberLines.length > 0) return lineIndex(Math.max(...memberLines) + 1);
  const firstMethodLine = cls.methods[0]?.line;
  if (firstMethodLine) return lineIndex(firstMethodLine);
  return lineIndex(cls.endLine || cls.line + 1);
}

function formatClassDeclaration(originalLine: string, className: string, baseClass?: string): string {
  const indent = indentOf(originalLine);
  return `${indent}类 ${className.trim()}${baseClass?.trim() ? ` : 公开 ${baseClass.trim()}` : ''}`;
}

function formatMemberDeclaration(
  originalLine: string,
  member: { name: string; type: string; initialValue?: string }
): string {
  const indent = indentOf(originalLine);
  const initialValue = typeof member.initialValue === 'string' && member.initialValue.trim()
    ? ` = ${member.initialValue.trim()}`
    : '';
  return `${indent}${member.type.trim()} ${member.name.trim()}${initialValue}`;
}

function formatEventDeclaration(originalLine: string, handlerName: string, parameters: LingCppParameter[]): string {
  return `${indentOf(originalLine)}事件 ${handlerName.trim()}(${formatParameters(parameters)})`;
}

function formatMethodDeclaration(
  originalLine: string,
  method: LingCppMethod,
  methodName: string,
  returnType: string,
  parameters: LingCppParameter[]
): string {
  if (method.kind === 'event') return formatEventDeclaration(originalLine, methodName, parameters);
  if (method.kind === 'constructor') return `${indentOf(originalLine)}构造(${formatParameters(parameters)})`;
  if (method.kind === 'destructor') return `${indentOf(originalLine)}析构(${formatParameters(parameters)})`;
  return `${indentOf(originalLine)}${returnType.trim()} ${methodName.trim()}(${formatParameters(parameters)})`;
}

function formatParameters(parameters: LingCppParameter[]): string {
  return parameters
    .map(parameter => {
      const declaration = `${parameter.type.trim()} ${parameter.name.trim()}`.trim();
      const defaultValue = parameter.defaultValue?.trim();
      return defaultValue ? `${declaration} = ${defaultValue}` : declaration;
    })
    .join(', ');
}

function inferClassBodyIndent(lines: string[], cls: LingCppClass): string {
  const candidateLine = [...cls.members.map(member => member.line), ...cls.methods.map(method => method.line)]
    .sort((a, b) => a - b)
    .map(line => lines[lineIndex(line)] || '')
    .find(line => line.trim());
  return candidateLine ? indentOf(candidateLine) : '    ';
}

function inferMethodBodyIndent(lines: string[], method: LingCppMethod): string {
  const existingStatement = method.statements
    .map(statement => lines[lineIndex(statement.line)] || '')
    .find(line => line.trim());
  if (existingStatement) return indentOf(existingStatement);
  return `${indentOf(lines[lineIndex(method.line)] || '')}    `;
}

function normalizeMethodBodyLines(bodyLines: string[]): string[] {
  const trimmedRight = bodyLines.map(line => line.replace(/\s+$/u, ''));
  const firstMeaningful = trimmedRight.findIndex(line => line.trim());
  const lastMeaningful = trimmedRight.length - 1 - [...trimmedRight].reverse().findIndex(line => line.trim());
  if (firstMeaningful < 0) return [];
  const meaningfulRange = trimmedRight.slice(firstMeaningful, lastMeaningful + 1);
  const minIndent = meaningfulRange
    .filter(line => line.trim())
    .reduce((min, line) => Math.min(min, indentOf(line).length), Number.POSITIVE_INFINITY);
  const removableIndent = Number.isFinite(minIndent) ? minIndent : 0;
  return meaningfulRange.map(line => line.slice(removableIndent));
}

function indentOf(line: string): string {
  return line.match(/^\s*/)?.[0] || '';
}

function lineIndex(lineNumber: number): number {
  return Math.max(0, lineNumber - 1);
}

function failedResult(sourceCode: string, diagnostics: LingCppDiagnostic[], error: string): LingCppAstEditResult {
  return {
    success: false,
    sourceCode,
    diagnostics,
    error
  };
}
