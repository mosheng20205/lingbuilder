import { createWorkspaceEditChangeFromRewrite } from './aiEditService';
import { normalizeIdentifier, parseLingCpp } from './parser';
import {
  LingCppAstEdit,
  LingCppAstEditResult,
  LingCppAccessModifier,
  LingCppClass,
  LingCppDataField,
  LingCppDataType,
  LingCppDiagnostic,
  LingCppLocalVariable,
  LingCppMember,
  LingCppMethod,
  LingCppParameter,
  LingCppProgram
} from './types';

const DEFAULT_FILE_PATH = 'memory.lcpp';

export function applyLingCppAstEdit(source: string, edit: LingCppAstEdit): LingCppAstEditResult {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const originalSource = source;
  const parsed = parseLingCpp(source);

  try {
    const lines = source.split(/\r?\n/);
    const updatedLines = applyEditToLines(lines, parsed.program, edit);
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

function applyEditToLines(lines: string[], program: LingCppProgram, edit: LingCppAstEdit): string[] {
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

  if (edit.kind === 'add-constant') {
    insertConstant(next, program, edit.constant);
    return next;
  }

  if (edit.kind === 'update-constant') {
    const constant = program.constants.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(edit.constantName));
    if (!constant) throw new Error(`未找到项目常量：${edit.constantName}`);
    const index = lineIndex(constant.line);
    next[index] = formatConstantDeclaration(next[index] || '', {
      name: edit.newName || constant.name,
      type: edit.type || constant.type,
      initialValue: edit.initialValue ?? constant.initialValue
    });
    if (edit.note !== undefined) replaceOrInsertNote(next, constant.line, edit.note);
    return next;
  }

  if (edit.kind === 'delete-constant') {
    const constant = program.constants.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(edit.constantName));
    if (!constant) throw new Error(`未找到项目常量：${edit.constantName}`);
    const index = lineIndex(constant.line);
    const removeFrom = isNoteLine(next[index - 1] || '') ? index - 1 : index;
    next.splice(removeFrom, removeFrom === index ? 1 : 2);
    return next;
  }

  if (edit.kind === 'add-global') {
    insertGlobal(next, program, edit.global);
    return next;
  }

  if (edit.kind === 'update-global') {
    const global = program.globals.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(edit.globalName));
    if (!global) throw new Error(`未找到项目全局变量：${edit.globalName}`);
    const index = lineIndex(global.line);
    next[index] = formatGlobalDeclaration(next[index] || '', {
      name: edit.newName || global.name,
      type: edit.type || global.type,
      initialValue: edit.initialValue ?? global.initialValue,
      isArray: edit.isArray ?? global.isArray ?? false
    });
    if (edit.note !== undefined) replaceOrInsertNote(next, global.line, edit.note);
    return next;
  }

  if (edit.kind === 'delete-global') {
    const global = program.globals.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(edit.globalName));
    if (!global) throw new Error(`未找到项目全局变量：${edit.globalName}`);
    const index = lineIndex(global.line);
    const removeFrom = isNoteLine(next[index - 1] || '') ? index - 1 : index;
    next.splice(removeFrom, removeFrom === index ? 1 : 2);
    return next;
  }

  if (edit.kind === 'add-data-type') {
    insertDataType(next, program, edit.dataType);
    return next;
  }
  if (edit.kind === 'update-data-type') {
    const dataType = resolveDataType(program.dataTypes, edit.dataTypeName);
    if (!dataType) throw new Error(`未找到数据类型：${edit.dataTypeName}`);
    next[lineIndex(dataType.line)] = `${indentOf(next[lineIndex(dataType.line)] || '')}数据类型 ${(edit.newName || dataType.name).trim()}`;
    if (edit.note !== undefined) replaceOrInsertNote(next, dataType.line, edit.note);
    return next;
  }
  if (edit.kind === 'delete-data-type') {
    const dataType = resolveDataType(program.dataTypes, edit.dataTypeName);
    if (!dataType) throw new Error(`未找到数据类型：${edit.dataTypeName}`);
    removeDataTypeBlock(next, dataType);
    return next;
  }
  if (edit.kind === 'move-data-type') {
    moveDataTypeBlock(next, program.dataTypes, edit.dataTypeName, edit.direction);
    return next;
  }
  if (edit.kind === 'add-data-field') {
    const dataType = resolveDataType(program.dataTypes, edit.dataTypeName);
    if (!dataType) throw new Error(`未找到数据类型：${edit.dataTypeName}`);
    insertDataField(next, dataType, edit.field);
    return next;
  }
  if (edit.kind === 'update-data-field') {
    const dataType = resolveDataType(program.dataTypes, edit.dataTypeName);
    const field = dataType && resolveDataField(dataType, edit.fieldName);
    if (!dataType || !field) throw new Error(`未找到字段：${edit.dataTypeName}.${edit.fieldName}`);
    const index = lineIndex(field.line);
    next[index] = formatDataField(next[index] || '', {
      name: edit.newName || field.name,
      type: edit.type || field.type,
      initialValue: edit.initialValue ?? field.initialValue,
      isArray: edit.isArray ?? field.isArray ?? false
    });
    if (edit.note !== undefined) replaceOrInsertNote(next, field.line, edit.note);
    return next;
  }
  if (edit.kind === 'delete-data-field') {
    const dataType = resolveDataType(program.dataTypes, edit.dataTypeName);
    const field = dataType && resolveDataField(dataType, edit.fieldName);
    if (!field) throw new Error(`未找到字段：${edit.dataTypeName}.${edit.fieldName}`);
    removeDeclarationWithNote(next, field.line);
    return next;
  }
  if (edit.kind === 'move-data-field') {
    const dataType = resolveDataType(program.dataTypes, edit.dataTypeName);
    if (!dataType) throw new Error(`未找到数据类型：${edit.dataTypeName}`);
    moveDataField(next, dataType, edit.fieldName, edit.direction);
    return next;
  }

  const requestedOwnerName = 'className' in edit ? edit.className : undefined;
  const functionLibrary = requestedOwnerName
    ? program.functionLibraries.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(requestedOwnerName))
    : undefined;
  const cls = resolveClass(program.classes, requestedOwnerName, 'line' in edit ? edit.line : undefined)
    || (functionLibrary ? {
      name: functionLibrary.name,
      baseClass: undefined,
      line: functionLibrary.line,
      endLine: functionLibrary.endLine,
      members: [],
      methods: functionLibrary.methods
    } : undefined);
  if (!cls) throw new Error('未找到要编辑的类。');

  if (edit.kind === 'update-class') {
    const index = lineIndex(cls.line);
    next[index] = formatClassDeclaration(next[index] || '', edit.newName || cls.name, edit.baseClass ?? cls.baseClass);
    if (edit.note !== undefined) replaceOrInsertNote(next, cls.line, edit.note);
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
      initialValue: edit.initialValue ?? member.initialValue,
      isStatic: edit.isStatic ?? member.isStatic ?? false,
      isArray: edit.isArray ?? member.isArray ?? false
    });
    if (edit.note !== undefined) replaceOrInsertNote(next, member.line, edit.note);
    if (edit.access && edit.access !== member.access) next.splice(index, 0, `${indentOf(next[index])}${edit.access}:`);
    return next;
  }

  if (edit.kind === 'delete-member') {
    const member = resolveMember(cls, edit.memberName);
    if (!member) throw new Error(`未找到成员变量：${edit.memberName}`);
    next.splice(lineIndex(member.line), 1);
    return next;
  }

  if (edit.kind === 'add-local') {
    const method = resolveMethod(cls, edit.methodName);
    if (!method) throw new Error(`未找到子程序：${edit.methodName}`);
    insertLocal(next, method, edit.local, edit.insertBeforeLine);
    return next;
  }

  if (edit.kind === 'update-local') {
    const method = resolveMethod(cls, edit.methodName);
    if (!method) throw new Error(`未找到子程序：${edit.methodName}`);
    const local = resolveLocal(method, edit.localName);
    if (!local) throw new Error(`未找到局部变量：${edit.localName}`);
    const index = lineIndex(local.line);
    next[index] = formatLocalDeclaration(next[index] || '', {
      name: edit.newName || local.name,
      type: edit.type || local.type,
      initialValue: edit.initialValue ?? local.initialValue,
      isArray: edit.isArray ?? local.isArray ?? false,
      isConstant: edit.isConstant ?? local.isConstant ?? false
    });
    if (edit.note !== undefined) replaceOrInsertNote(next, local.line, edit.note);
    return next;
  }

  if (edit.kind === 'delete-local') {
    const method = resolveMethod(cls, edit.methodName);
    if (!method) throw new Error(`未找到子程序：${edit.methodName}`);
    const local = resolveLocal(method, edit.localName);
    if (!local) throw new Error(`未找到局部变量：${edit.localName}`);
    const index = lineIndex(local.line);
    const removeFrom = isNoteLine(next[index - 1] || '') ? index - 1 : index;
    next.splice(removeFrom, removeFrom === index ? 1 : 2);
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
    const parameters = edit.parameters ?? method.parameters;
    next[index] = formatEventDeclaration(next[index] || '', edit.newHandlerName || method.name, parameters);
    const declarationLine = replaceOrInsertParameterNotes(next, method.line, parameters);
    if (edit.note !== undefined) replaceOrInsertNote(next, declarationLine, edit.note);
    if (edit.access && edit.access !== method.access) insertAccessModifier(next, declarationLine, edit.access);
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
    const parameters = edit.parameters ?? method.parameters;
    next[index] = formatMethodDeclaration(
      next[index] || '',
      method,
      edit.newName || method.name,
      edit.returnType || method.returnType,
      parameters,
      edit.isStatic ?? method.isStatic ?? false
    );
    const declarationLine = replaceOrInsertParameterNotes(next, method.line, parameters);
    if (edit.note !== undefined) replaceOrInsertNote(next, declarationLine, edit.note);
    if (edit.access && edit.access !== method.access) insertAccessModifier(next, declarationLine, edit.access);
    return next;
  }

  if (edit.kind === 'delete-method') {
    const method = resolveMethod(cls, edit.methodName, 'method');
    if (!method) throw new Error(`未找到方法：${edit.methodName}`);
    removeMethodBlock(next, method);
    return next;
  }

  if (edit.kind === 'update-method-body') {
    const method = resolveMethod(cls, edit.methodName);
    if (!method) throw new Error(`未找到方法：${edit.methodName}`);
    replaceMethodBody(next, method, edit.bodyLines, edit.localStatementAnchors);
    return next;
  }

  return next;
}

function insertConstant(
  lines: string[],
  program: LingCppProgram,
  constant: { name: string; type: string; initialValue: string; note?: string }
): void {
  const insertAt = program.constants.length > 0
    ? lineIndex(Math.max(...program.constants.map(item => item.line)) + 1)
    : program.globals.length > 0
      ? lineIndex(Math.min(...program.globals.map(item => item.line)))
      : program.classes.length > 0
        ? lineIndex(Math.min(...program.classes.map(item => item.line)))
        : lines.length;
  const nextLines = [
    constant.note ? `// ${constant.note.trim()}` : '',
    formatConstantDeclaration(`常量 ${constant.type} ${constant.name}`, constant)
  ].filter(Boolean);
  lines.splice(insertAt, 0, ...nextLines);
}

function insertDataType(lines: string[], program: LingCppProgram, dataType: { name: string; note?: string }): void {
  const insertAt = program.dataTypes.length > 0
    ? lineIndex(Math.max(...program.dataTypes.map(item => item.endLine || item.line)) + 1)
    : lines.length;
  const block = [
    dataType.note ? `// ${dataType.note.trim()}` : '',
    `数据类型 ${dataType.name.trim()}`,
    '结束数据类型'
  ].filter(Boolean);
  if (insertAt > 0 && lines[insertAt - 1]?.trim()) block.unshift('');
  lines.splice(insertAt, 0, ...block);
}

function insertDataField(
  lines: string[],
  dataType: LingCppDataType,
  field: { name: string; type: string; initialValue?: string; isArray?: boolean; note?: string }
): void {
  const insertAt = dataType.fields.length > 0
    ? lineIndex(Math.max(...dataType.fields.map(item => item.line)) + 1)
    : lineIndex((dataType.endLine || dataType.line + 1));
  const indent = inferDataTypeFieldIndent(lines, dataType);
  const nextLines = [
    field.note ? `${indent}// ${field.note.trim()}` : '',
    formatDataField(`${indent}${field.type} ${field.name}`, field)
  ].filter(Boolean);
  lines.splice(insertAt, 0, ...nextLines);
}

function removeDataTypeBlock(lines: string[], dataType: LingCppDataType): void {
  const startIndex = lineIndex(dataType.line);
  const start = isNoteLine(lines[startIndex - 1] || '') ? startIndex - 1 : startIndex;
  const end = lineIndex(dataType.endLine || dataType.line);
  lines.splice(start, end - start + 1);
}

function moveDataTypeBlock(lines: string[], dataTypes: LingCppDataType[], name: string, direction: 'up' | 'down'): void {
  const index = dataTypes.findIndex(item => normalizeIdentifier(item.name) === normalizeIdentifier(name));
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= dataTypes.length) return;
  const first = dataTypes[index];
  const second = dataTypes[targetIndex];
  const firstRange = declarationBlockRange(lines, first.line, first.endLine || first.line);
  const secondRange = declarationBlockRange(lines, second.line, second.endLine || second.line);
  const start = Math.min(firstRange.start, secondRange.start);
  const end = Math.max(firstRange.end, secondRange.end);
  const firstBlock = lines.slice(firstRange.start, firstRange.end + 1);
  const secondBlock = lines.slice(secondRange.start, secondRange.end + 1);
  lines.splice(start, end - start + 1, ...(direction === 'up' ? [...firstBlock, ...secondBlock] : [...secondBlock, ...firstBlock]));
}

function moveDataField(lines: string[], dataType: LingCppDataType, name: string, direction: 'up' | 'down'): void {
  const index = dataType.fields.findIndex(item => normalizeIdentifier(item.name) === normalizeIdentifier(name));
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= dataType.fields.length) return;
  const first = declarationBlockRange(lines, dataType.fields[index].line, dataType.fields[index].line);
  const second = declarationBlockRange(lines, dataType.fields[targetIndex].line, dataType.fields[targetIndex].line);
  const start = Math.min(first.start, second.start);
  const end = Math.max(first.end, second.end);
  const firstBlock = lines.slice(first.start, first.end + 1);
  const secondBlock = lines.slice(second.start, second.end + 1);
  lines.splice(start, end - start + 1, ...(direction === 'up' ? [...firstBlock, ...secondBlock] : [...secondBlock, ...firstBlock]));
}

function declarationBlockRange(lines: string[], startLine: number, endLine: number): { start: number; end: number } {
  const declarationStart = lineIndex(startLine);
  return { start: isNoteLine(lines[declarationStart - 1] || '') ? declarationStart - 1 : declarationStart, end: lineIndex(endLine) };
}

function removeDeclarationWithNote(lines: string[], line: number): void {
  const index = lineIndex(line);
  const start = isNoteLine(lines[index - 1] || '') ? index - 1 : index;
  lines.splice(start, index - start + 1);
}

function insertGlobal(
  lines: string[],
  program: LingCppProgram,
  global: { name: string; type: string; initialValue?: string; isArray?: boolean; note?: string }
): void {
  const insertAt = program.globals.length > 0
    ? lineIndex(Math.max(...program.globals.map(item => item.line)) + 1)
    : program.classes.length > 0
      ? lineIndex(Math.min(...program.classes.map(item => item.line)))
      : lines.length;
  const nextLines = [
    global.note ? `// ${global.note.trim()}` : '',
    formatGlobalDeclaration(`全局 ${global.type} ${global.name}`, global)
  ].filter(Boolean);
  lines.splice(insertAt, 0, ...nextLines);
}

function insertMember(
  lines: string[],
  cls: LingCppClass,
  member: { name: string; type: string; access?: string; initialValue?: string; isStatic?: boolean; isArray?: boolean; note?: string }
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
  event: { handlerName: string; access?: LingCppAccessModifier; parameters?: LingCppParameter[]; note?: string }
): void {
  const insertAt = Math.max(lineIndex(cls.line + 1), lineIndex(cls.endLine || lines.length));
  const indent = inferClassBodyIndent(lines, cls);
  const bodyIndent = `${indent}    `;
  const nextLines = [
    '',
    event.access ? `${indent}${event.access}:` : '',
    event.note ? `${indent}// ${event.note.trim()}` : '',
    ...formatParameterNoteLines(indent, event.parameters || []),
    `${indent}事件 ${event.handlerName.trim()}(${formatParameters(event.parameters || [])})`,
    `${bodyIndent}调试输出("${event.handlerName.trim()} 已触发")`
  ].filter(line => line !== '');
  lines.splice(insertAt, 0, ...nextLines);
}

function insertLocal(
  lines: string[],
  method: LingCppMethod,
  local: { name: string; type: string; initialValue?: string; isArray?: boolean; isConstant?: boolean; note?: string },
  insertBeforeLine?: number
): void {
  const locals = method.locals || [];
  const defaultInsertBeforeLine = locals.length > 0
    ? Math.max(...locals.map(item => item.line)) + 1
    : method.line + 1;
  const methodEndLine = method.endLine || lines.length;
  const closesWithEndMarker = (lines[lineIndex(methodEndLine)] || '').trim() === '结束';
  const lastInsertBeforeLine = closesWithEndMarker ? methodEndLine : methodEndLine + 1;
  const safeInsertBeforeLine = Math.max(
    method.line + 1,
    Math.min(insertBeforeLine ?? defaultInsertBeforeLine, lastInsertBeforeLine)
  );
  const insertAt = lineIndex(safeInsertBeforeLine);
  const indent = inferMethodBodyIndent(lines, method);
  const declaration = formatLocalDeclaration(`${indent}${local.isConstant ? '局部常量' : '局部'} ${local.type} ${local.name}`, local);
  lines.splice(insertAt, 0, ...[
    local.note?.trim() ? `${indent}// ${local.note.trim()}` : '',
    declaration
  ].filter(Boolean));
}

function insertMethod(
  lines: string[],
  cls: LingCppClass,
  method: { name: string; returnType?: string; access?: LingCppAccessModifier; isStatic?: boolean; parameters?: LingCppParameter[]; bodyLines?: string[]; note?: string }
): void {
  const insertAt = Math.max(lineIndex(cls.line + 1), lineIndex(cls.endLine || lines.length));
  const indent = inferClassBodyIndent(lines, cls);
  const bodyIndent = `${indent}    `;
  const bodyLines = normalizeMethodBodyLines(method.bodyLines || [`调试输出("${method.name.trim()} 已执行")`])
    .map(line => line.trim() ? `${bodyIndent}${line}` : '');
  const nextLines = [
    '',
    method.access ? `${indent}${method.access}:` : '',
    method.note ? `${indent}// ${method.note.trim()}` : '',
    ...formatParameterNoteLines(indent, method.parameters || []),
    `${indent}${method.isStatic ? '静态 ' : ''}${method.returnType?.trim() || '空'} ${method.name.trim()}(${formatParameters(method.parameters || [])})`,
    ...bodyLines
  ].filter(line => line !== '');
  lines.splice(insertAt, 0, ...nextLines);
}

function replaceOrInsertNote(lines: string[], lineNumber: number, note: string): void {
  const index = lineIndex(lineNumber);
  const targetLine = lines[index] || '';
  const previousLine = lines[index - 1] || '';
  const trimmedNote = note.trim();
  if (!trimmedNote) {
    if (isNoteLine(targetLine)) {
      lines.splice(index, 1);
      return;
    }
    if (isNoteLine(previousLine)) {
      lines.splice(index - 1, 1);
    }
    return;
  }
  const noteLine = `${indentOf(targetLine)}// ${trimmedNote}`;
  if (isNoteLine(targetLine)) {
    lines[index] = noteLine;
    return;
  }
  if (isNoteLine(previousLine)) {
    lines[index - 1] = `${indentOf(previousLine)}// ${trimmedNote}`;
    return;
  }
  lines.splice(index, 0, noteLine);
}

function parseParameterNoteLine(line: string): { name: string; note: string } | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith('//')) return undefined;
  const content = trimmed.slice(2).trim();
  if (!content.startsWith('参数备注')) return undefined;
  const rest = content.slice('参数备注'.length).replace(/^\s*[:：]?\s*/u, '').trim();
  if (!rest) return undefined;
  const separator = rest.search(/\s*[:：=＝]\s*/u);
  if (separator < 0) return { name: rest, note: '' };
  const separatorText = rest.slice(separator).match(/^\s*[:：=＝]\s*/u)?.[0] || ':';
  return {
    name: rest.slice(0, separator).trim(),
    note: rest.slice(separator + separatorText.length).trim()
  };
}

function formatParameterNoteLines(indent: string, parameters: LingCppParameter[]): string[] {
  return parameters
    .filter(parameter => parameter.note?.trim())
    .map(parameter => `${indent}// 参数备注 ${parameter.name.trim()}：${parameter.note?.trim()}`);
}

/** Replace only parameter metadata comments and return the declaration's new line. */
function replaceOrInsertParameterNotes(lines: string[], lineNumber: number, parameters: LingCppParameter[]): number {
  const declarationIndex = lineIndex(lineNumber);
  const declaration = lines[declarationIndex] || '';
  const parameterNoteIndexes: number[] = [];
  for (let index = declarationIndex - 1; index >= 0 && isNoteLine(lines[index] || ''); index -= 1) {
    if (parseParameterNoteLine(lines[index] || '')) parameterNoteIndexes.push(index);
  }
  parameterNoteIndexes.sort((left, right) => right - left).forEach(index => lines.splice(index, 1));
  const nextDeclarationIndex = declarationIndex - parameterNoteIndexes.filter(index => index < declarationIndex).length;
  const noteLines = formatParameterNoteLines(indentOf(declaration), parameters);
  if (noteLines.length > 0) lines.splice(nextDeclarationIndex, 0, ...noteLines);
  return nextDeclarationIndex + noteLines.length + 1;
}

function insertAccessModifier(lines: string[], lineNumber: number, access: LingCppAccessModifier): void {
  const index = lineIndex(lineNumber);
  const referenceLine = lines[index] || '';
  const insertAt = isNoteLine(lines[index - 1] || '') ? index - 1 : index;
  lines.splice(insertAt, 0, `${indentOf(referenceLine)}${access}:`);
}

function isNoteLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('注释 ');
}

function removeMethodBlock(lines: string[], method: LingCppMethod): void {
  const start = lineIndex(method.line);
  const end = lineIndex(method.endLine || method.statements.at(-1)?.line || method.line);
  lines.splice(start, Math.max(1, end - start + 1));
}

function replaceMethodBody(
  lines: string[],
  method: LingCppMethod,
  bodyLines: string[],
  localStatementAnchors?: Record<string, number>
): void {
  const locals = [...(method.locals || [])].sort((left, right) => left.line - right.line);
  const statements = [...method.statements].sort((left, right) => left.line - right.line);
  const localAnchors = locals.map(local => ({
    local,
    statementIndex: localStatementAnchors?.[local.name]
      ?? localStatementAnchors?.[normalizeIdentifier(local.name)]
      ?? statements.filter(statement => statement.line < local.line).length,
    source: formatLocalDeclaration(lines[lineIndex(local.line)] || '', local)
  }));
  const start = lineIndex(method.line + 1);
  const methodEndLine = method.endLine || method.statements.at(-1)?.line || method.line;
  const closesWithEndMarker = (lines[lineIndex(methodEndLine)] || '').trim() === '结束';
  const endExclusive = closesWithEndMarker ? lineIndex(methodEndLine) : lineIndex(methodEndLine) + 1;
  const deleteCount = Math.max(0, endExclusive - start);
  const bodyIndent = inferMethodBodyIndent(lines, method);
  const normalizedBody = normalizeMethodBodyLines(bodyLines).map(line =>
    line.trim() ? `${bodyIndent}${line}` : ''
  );
  const mergedBody: string[] = [];
  let localIndex = 0;
  for (let statementIndex = 0; statementIndex <= normalizedBody.length; statementIndex += 1) {
    while (
      localIndex < localAnchors.length &&
      Math.min(localAnchors[localIndex].statementIndex, normalizedBody.length) === statementIndex
    ) {
      mergedBody.push(localAnchors[localIndex].source);
      localIndex += 1;
    }
    if (statementIndex < normalizedBody.length) mergedBody.push(normalizedBody[statementIndex]);
  }
  lines.splice(start, deleteCount, ...mergedBody);
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

function resolveDataType(dataTypes: LingCppDataType[], name: string): LingCppDataType | undefined {
  const normalized = normalizeIdentifier(name);
  return dataTypes.find(item => normalizeIdentifier(item.name) === normalized);
}

function resolveDataField(dataType: LingCppDataType, name: string): LingCppDataField | undefined {
  const normalized = normalizeIdentifier(name);
  return dataType.fields.find(item => normalizeIdentifier(item.name) === normalized);
}

function resolveMember(cls: LingCppClass, memberName: string): LingCppMember | undefined {
  const normalized = normalizeIdentifier(memberName);
  return cls.members.find(member => normalizeIdentifier(member.name) === normalized);
}

function resolveMethod(cls: LingCppClass, methodName: string, kind?: LingCppMethod['kind']): LingCppMethod | undefined {
  const normalized = normalizeIdentifier(methodName);
  return cls.methods.find(method => normalizeIdentifier(method.name) === normalized && (!kind || method.kind === kind));
}

function resolveLocal(method: LingCppMethod, localName: string): LingCppLocalVariable | undefined {
  const normalized = normalizeIdentifier(localName);
  return (method.locals || []).find(local => normalizeIdentifier(local.name) === normalized);
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
  member: { name: string; type: string; initialValue?: string; isStatic?: boolean; isArray?: boolean }
): string {
  const indent = indentOf(originalLine);
  const initialValue = typeof member.initialValue === 'string' && member.initialValue.trim()
    ? ` = ${member.initialValue.trim()}`
    : '';
  const staticPrefix = member.isStatic ? '静态 ' : '';
  const arraySuffix = member.isArray ? '[]' : '';
  return `${indent}${staticPrefix}${member.type.trim()} ${member.name.trim()}${arraySuffix}${initialValue}`;
}

function formatGlobalDeclaration(
  originalLine: string,
  global: { name: string; type: string; initialValue?: string; isArray?: boolean }
): string {
  const indent = indentOf(originalLine);
  const initialValue = typeof global.initialValue === 'string' && global.initialValue.trim()
    ? ` = ${global.initialValue.trim()}`
    : '';
  const arraySuffix = global.isArray ? '[]' : '';
  return `${indent}全局 ${global.type.trim()} ${global.name.trim()}${arraySuffix}${initialValue}`;
}

function formatDataField(
  originalLine: string,
  field: { name: string; type: string; initialValue?: string; isArray?: boolean }
): string {
  const indent = indentOf(originalLine);
  const initialValue = field.initialValue?.trim() ? ` = ${field.initialValue.trim()}` : '';
  return `${indent}${field.type.trim()} ${field.name.trim()}${field.isArray ? '[]' : ''}${initialValue}`;
}

function formatConstantDeclaration(
  originalLine: string,
  constant: { name: string; type: string; initialValue: string }
): string {
  const indent = indentOf(originalLine);
  return `${indent}常量 ${constant.type.trim()} ${constant.name.trim()} = ${constant.initialValue.trim()}`;
}

function formatLocalDeclaration(
  originalLine: string,
  local: { name: string; type: string; initialValue?: string; isArray?: boolean; isConstant?: boolean }
): string {
  const indent = indentOf(originalLine);
  const initialValue = typeof local.initialValue === 'string' && local.initialValue.trim()
    ? ` = ${local.initialValue.trim()}`
    : '';
  const arraySuffix = local.isArray ? '[]' : '';
  return `${indent}${local.isConstant ? '局部常量' : '局部'} ${local.type.trim()} ${local.name.trim()}${arraySuffix}${initialValue}`;
}

function formatEventDeclaration(originalLine: string, handlerName: string, parameters: LingCppParameter[]): string {
  return `${indentOf(originalLine)}事件 ${handlerName.trim()}(${formatParameters(parameters)})`;
}

function formatMethodDeclaration(
  originalLine: string,
  method: LingCppMethod,
  methodName: string,
  returnType: string,
  parameters: LingCppParameter[],
  isStatic = false
): string {
  if (method.kind === 'event') return formatEventDeclaration(originalLine, methodName, parameters);
  if (method.kind === 'constructor') return `${indentOf(originalLine)}构造(${formatParameters(parameters)})`;
  if (method.kind === 'destructor') return `${indentOf(originalLine)}析构(${formatParameters(parameters)})`;
  return `${indentOf(originalLine)}${isStatic ? '静态 ' : ''}${returnType.trim()} ${methodName.trim()}(${formatParameters(parameters)})`;
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

function inferDataTypeFieldIndent(lines: string[], dataType: LingCppDataType): string {
  const candidateLine = dataType.fields
    .map(field => lines[lineIndex(field.line)] || '')
    .find(line => line.trim());
  return candidateLine ? indentOf(candidateLine) : `${indentOf(lines[lineIndex(dataType.line)] || '')}    `;
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
