import { LingCppModuleContext } from '../modules/types';
import { normalizeIdentifier, parseLingCpp } from './parser';
import { EMPTY_PROJECT_DATA_TYPES_SOURCE } from './projectDataTypeService';
import { EMPTY_PROJECT_GLOBALS_SOURCE } from './projectGlobalService';
import {
  LingCppCompletionContext,
  LingCppCompletionItem,
  LingCppConstant,
  LingCppDataType,
  LingCppDiagnostic,
  LingCppGlobalVariable,
  LingCppProjectFunctionContext,
  LingCppProjectFunctionLibrary,
  LingCppWorkspaceFile
} from './types';

const IDENTIFIER = '[\\p{L}_][\\p{L}\\p{N}_]*';
const QUALIFIED_CALL_RE = new RegExp(`(${IDENTIFIER})\\s*\\.\\s*(${IDENTIFIER})\\s*[（(]`, 'gu');

export function createProjectFunctionContext(files: LingCppWorkspaceFile[]): LingCppProjectFunctionContext {
  const libraries: LingCppProjectFunctionLibrary[] = [];
  files.forEach(file => {
    if (file.language && file.language !== 'lingcpp' && !file.filePath.toLocaleLowerCase().endsWith('.lcpp')) return;
    parseLingCpp(file.sourceCode).program.functionLibraries.forEach(library => {
      libraries.push({ ...library, filePath: normalizePath(file.filePath) });
    });
  });
  return { libraries };
}

export function isFunctionLibrarySource(sourceCode: string): boolean {
  return parseLingCpp(sourceCode).program.functionLibraries.length > 0;
}

export function createFunctionLibraryTemplate(name: string): string {
  const safeName = name.trim();
  return [
    `功能库 ${safeName}`,
    '公开:',
    '  空 示例功能()',
    '    // 在这里编写可被窗口和其他功能库复用的代码',
    '  结束',
    '结束功能库',
    ''
  ].join('\n');
}

export function getFunctionLibraryDiagnostics(
  sourceCode: string,
  filePath: string | undefined,
  context?: LingCppProjectFunctionContext
): LingCppDiagnostic[] {
  if (!context) return [];
  const diagnostics: LingCppDiagnostic[] = [];
  const parsed = parseLingCpp(sourceCode);
  const currentLibraries = parsed.program.functionLibraries;
  if (currentLibraries.length > 1) {
    currentLibraries.slice(1).forEach(library => diagnostics.push(diagnostic(
      'error', library.line, library.name,
      '一个 .lcpp 文件只能声明一个功能库。',
      '请把这个功能库移动到单独的 .lcpp 文件。'
    )));
  }
  if (currentLibraries.length > 0 && (parsed.program.classes.length > 0 || parsed.program.dataTypes.length > 0 || parsed.program.constants.length > 0 || parsed.program.globals.length > 0)) {
    diagnostics.push(diagnostic('error', currentLibraries[0]!.line, currentLibraries[0]!.name, '功能库文件不能同时声明类、项目变量、常量或数据类型。', '请保持一个文件只包含一个无状态功能库。'));
  }
  currentLibraries.forEach(library => {
    const baseName = getFileBaseName(filePath);
    if (baseName && normalizeIdentifier(baseName) !== normalizeIdentifier(library.name)) {
      diagnostics.push(diagnostic(
        'warning', library.line, library.name,
        `功能库名称“${library.name}”与文件名“${baseName}.lcpp”不一致。`,
        '建议通过项目树重命名功能库，让文件名、声明和调用保持一致。'
      ));
    }
    const declarationLines = new Set(library.methods.map(method => method.line));
    const methodNames = new Set(library.methods.map(method => normalizeIdentifier(method.name)));
    scanUnqualifiedCalls(sourceCode).forEach(call => {
      if (declarationLines.has(call.line) || !methodNames.has(normalizeIdentifier(call.name))) return;
      diagnostics.push(diagnostic('error', call.line, call.name, `功能库内部调用“${call.name}”也必须带功能库名称。`, `请改为 ${library.name}.${call.name}(...)，递归调用同样如此。`));
    });
    library.methods.forEach(method => {
      if (method.parameters.some(parameter => parameter.defaultValue)) {
        diagnostics.push(diagnostic('error', method.line, method.name, '首版功能库不支持默认参数。', '请删除参数默认值，并在调用处显式传入。'));
      }
      if (method.isStatic) diagnostics.push(diagnostic('error', method.line, method.name, '功能库功能无需也不支持“静态”修饰。', '请删除“静态”；功能库本身就是无状态的。'));
      method.statements.filter(statement => /&[\p{L}_][\p{L}\p{N}_]*/u.test(stripLineComment(statement.text))).forEach(statement => {
        diagnostics.push(diagnostic('error', statement.line, statement.text, '首版功能库不能把窗口事件处理器作为 &处理器参数传递。', '请在窗口事件中完成回调绑定，或把普通数据传给功能库。'));
      });
    });
  });

  const byName = new Map<string, LingCppProjectFunctionLibrary[]>();
  context.libraries.forEach(library => {
    const key = normalizeIdentifier(library.name);
    byName.set(key, [...(byName.get(key) || []), library]);
  });
  byName.forEach(libraries => {
    if (libraries.length < 2) return;
    libraries.forEach(library => {
      if (normalizePath(library.filePath) !== normalizePath(filePath || '')) return;
      diagnostics.push(diagnostic('error', library.line, library.name, `项目中存在重复功能库“${library.name}”。`, '请重命名其中一个功能库。'));
    });
  });

  scanQualifiedCalls(sourceCode).forEach(call => {
    const candidates = byName.get(normalizeIdentifier(call.libraryName));
    if (!candidates?.length) {
      diagnostics.push(diagnostic('error', call.line, call.text, `找不到功能库“${call.libraryName}”。`, '请确认该功能库 .lcpp 已加入当前项目，或先复制所需功能库。'));
      return;
    }
    if (candidates.length > 1) return;
    const library = candidates[0]!;
    const method = library.methods.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(call.functionName));
    if (!method) {
      diagnostics.push(diagnostic('error', call.line, call.text, `功能库“${library.name}”中没有功能“${call.functionName}”。`, `请从 ${library.filePath} 中选择已声明的功能。`));
      return;
    }
    const sameFile = normalizePath(library.filePath) === normalizePath(filePath || '');
    if (method.access !== '公开' && !sameFile) {
      diagnostics.push(diagnostic('error', call.line, call.text, `功能“${library.name}.${method.name}”是私有功能。`, '私有功能只能在同一个功能库文件中调用。'));
    }
  });
  return diagnostics;
}

export function getFunctionLibraryCompletionItems(
  completion: LingCppCompletionContext,
  context?: LingCppProjectFunctionContext
): LingCppCompletionItem[] {
  if (!context) return [];
  const lineText = completion.source.split(/\r?\n/u)[completion.line - 1] || '';
  const beforeCursor = lineText.slice(0, Math.max(0, completion.column - 1));
  const qualifier = beforeCursor.match(new RegExp(`(${IDENTIFIER})\\s*\\.\\s*(${IDENTIFIER})?$`, 'u'));
  if (qualifier) {
    const library = context.libraries.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(qualifier[1] || ''));
    if (!library) return [];
    return library.methods
      .filter(method => method.access === '公开' || sourceOwnsLibrary(completion.source, library))
      .map(method => ({
        label: method.name,
        kind: 'function',
        insertText: `${method.name}(${method.parameters.map((_, index) => `\${${index + 1}}`).join(', ')})`,
        detail: `${library.name} · ${method.access}功能`,
        signature: `${method.returnType} ${library.name}.${method.name}(${method.parameters.map(parameter => `${parameter.type} ${parameter.name}`).join(', ')})`,
        returnType: method.returnType,
        documentation: `定义于 ${library.filePath}`,
        isSnippet: method.parameters.length > 0,
        category: 'symbol'
      }));
  }
  return context.libraries.map(library => ({
    label: library.name,
    kind: 'type',
    insertText: library.name,
    detail: `项目功能库 · ${library.filePath}`,
    documentation: `输入 ${library.name}. 后选择公开功能。`,
    category: 'symbol'
  }));
}

export interface FunctionLibraryDependencies {
  libraries: string[];
  projectTypes: string[];
  projectSymbols: string[];
  modules: string[];
}

export interface FunctionLibraryClosureFile {
  name: string;
  filePath: string;
  sourceCode: string;
}

export interface FunctionLibraryDependencyClosure {
  rootLibrary: string;
  files: FunctionLibraryClosureFile[];
  missingLibraries: string[];
  projectTypes: string[];
  projectSymbols: string[];
  modules: string[];
}

export interface FunctionLibraryResourceConflict {
  kind: 'projectType' | 'projectSymbol';
  name: string;
  reason: string;
}

export interface FunctionLibraryProjectResourceMerge {
  projectTypes: { copied: string[]; reused: string[] };
  projectSymbols: { copied: string[]; reused: string[] };
  conflicts: FunctionLibraryResourceConflict[];
  dataTypesSource?: string;
  globalsSource?: string;
}

export function analyzeFunctionLibraryDependencies(
  sourceCode: string,
  projectFiles: LingCppWorkspaceFile[],
  moduleContext?: LingCppModuleContext
): FunctionLibraryDependencies {
  const parsed = parseLingCpp(sourceCode);
  const sourceWithoutComments = stripCommentsAndStrings(sourceCode);
  const libraries = [...new Set(scanQualifiedCalls(sourceCode).map(call => call.libraryName)
    .filter(name => !parsed.program.functionLibraries.some(library => normalizeIdentifier(library.name) === normalizeIdentifier(name))))];
  const allPrograms = projectFiles.map(file => parseLingCpp(file.sourceCode).program);
  const projectTypes = [...new Set(allPrograms.flatMap(program => program.dataTypes.map(type => type.name))
    .filter(name => hasIdentifier(sourceWithoutComments, name)))];
  const projectSymbols = [...new Set(allPrograms.flatMap(program => [...program.constants.map(item => item.name), ...program.globals.map(item => item.name)])
    .filter(name => hasIdentifier(sourceWithoutComments, name)))];
  const modules = detectModuleDependencies(sourceWithoutComments, moduleContext);
  return { libraries, projectTypes, projectSymbols, modules };
}

/**
 * Resolves the complete portable dependency closure for one function-library file.
 * Libraries are returned dependency-first so callers can present and persist a stable plan.
 */
export function analyzeFunctionLibraryDependencyClosure(
  rootFilePath: string,
  projectFiles: LingCppWorkspaceFile[],
  moduleContext?: LingCppModuleContext
): FunctionLibraryDependencyClosure {
  const normalizedRoot = normalizePath(rootFilePath);
  const libraryFiles = new Map<string, FunctionLibraryClosureFile>();
  projectFiles.forEach(file => {
    const library = parseLingCpp(file.sourceCode).program.functionLibraries[0];
    if (!library) return;
    const key = normalizeIdentifier(library.name);
    if (!libraryFiles.has(key)) libraryFiles.set(key, { name: library.name, filePath: file.filePath, sourceCode: file.sourceCode });
  });
  const root = [...libraryFiles.values()].find(file => normalizePath(file.filePath) === normalizedRoot);
  if (!root) throw new Error(`找不到功能库源文件：${rootFilePath}`);

  const ordered: FunctionLibraryClosureFile[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const missingLibraries: string[] = [];
  const typeNames: string[] = [];
  const symbolNames: string[] = [];
  const moduleIds: string[] = [];
  const addUnique = (items: string[], value: string) => {
    if (!items.some(item => normalizeIdentifier(item) === normalizeIdentifier(value))) items.push(value);
  };
  const visit = (file: FunctionLibraryClosureFile) => {
    const key = normalizeIdentifier(file.name);
    if (visited.has(key) || visiting.has(key)) return;
    visiting.add(key);
    const direct = analyzeFunctionLibraryDependencies(file.sourceCode, projectFiles, moduleContext);
    direct.libraries.forEach(name => {
      const dependency = libraryFiles.get(normalizeIdentifier(name));
      if (dependency) visit(dependency);
      else addUnique(missingLibraries, name);
    });
    direct.projectTypes.forEach(name => addUnique(typeNames, name));
    direct.projectSymbols.forEach(name => addUnique(symbolNames, name));
    direct.modules.forEach(id => addUnique(moduleIds, id));
    visiting.delete(key);
    visited.add(key);
    ordered.push(file);
  };
  visit(root);

  const programs = projectFiles.map(file => ({ file, program: parseLingCpp(file.sourceCode).program }));
  const typesByName = new Map(programs.flatMap(({ program }) => program.dataTypes.map(item => [normalizeIdentifier(item.name), item] as const)));
  const symbolsByName = new Map<string, TransferProjectSymbol>(programs.flatMap(({ program }) => [
    ...program.constants.map(item => [normalizeIdentifier(item.name), { ...item, symbolKind: 'constant' as const }] as const),
    ...program.globals.map(item => [normalizeIdentifier(item.name), { ...item, symbolKind: 'global' as const }] as const)
  ]));
  const closedTypes: string[] = [];
  const closeType = (name: string) => {
    const definition = typesByName.get(normalizeIdentifier(name));
    if (!definition || closedTypes.some(item => normalizeIdentifier(item) === normalizeIdentifier(definition.name))) return;
    definition.fields.forEach(field => closeType(field.type));
    closedTypes.push(definition.name);
  };
  const closedSymbols: string[] = [];
  const closingSymbols = new Set<string>();
  const closeSymbol = (name: string) => {
    const definition = symbolsByName.get(normalizeIdentifier(name));
    const key = normalizeIdentifier(name);
    if (!definition || closingSymbols.has(key) || closedSymbols.some(item => normalizeIdentifier(item) === key)) return;
    closingSymbols.add(key);
    const initializer = definition.initialValue || '';
    symbolsByName.forEach((candidate, candidateKey) => {
      if (candidateKey !== key && hasIdentifier(initializer, candidate.name)) closeSymbol(candidate.name);
    });
    closeType(definition.type);
    closingSymbols.delete(key);
    closedSymbols.push(definition.name);
  };
  typeNames.forEach(closeType);
  symbolNames.forEach(closeSymbol);

  const resourceSource = [
    ...closedTypes.map(name => {
      const definition = typesByName.get(normalizeIdentifier(name));
      return definition ? `数据类型 ${definition.name}\n${definition.fields.map(field => `${field.type} ${field.name}`).join('\n')}` : '';
    }),
    ...closedSymbols.map(name => {
      const definition = symbolsByName.get(normalizeIdentifier(name));
      return definition ? `${definition.type} ${definition.name} ${definition.initialValue || ''}` : '';
    })
  ].join('\n');
  detectModuleDependencies(resourceSource, moduleContext).forEach(id => addUnique(moduleIds, id));

  return {
    rootLibrary: root.name,
    files: ordered,
    missingLibraries,
    projectTypes: closedTypes,
    projectSymbols: closedSymbols,
    modules: moduleIds
  };
}

/** Creates merged project resource files without rewriting unrelated target declarations. */
export function mergeFunctionLibraryProjectResources(
  closure: Pick<FunctionLibraryDependencyClosure, 'projectTypes' | 'projectSymbols'>,
  sourceFiles: LingCppWorkspaceFile[],
  targetFiles: LingCppWorkspaceFile[]
): FunctionLibraryProjectResourceMerge {
  const sourcePrograms = sourceFiles.map(file => ({ file, program: parseLingCpp(file.sourceCode).program }));
  const targetPrograms = targetFiles.map(file => ({ file, program: parseLingCpp(file.sourceCode).program }));
  const sourceTypes = new Map(sourcePrograms.flatMap(({ file, program }) => program.dataTypes.map(item => [normalizeIdentifier(item.name), { item, file }] as const)));
  const targetTypes = new Map(targetPrograms.flatMap(({ program }) => program.dataTypes.map(item => [normalizeIdentifier(item.name), item] as const)));
  const sourceSymbols = new Map<string, { item: TransferProjectSymbol; file: LingCppWorkspaceFile }>(sourcePrograms.flatMap(({ file, program }) => [
    ...program.constants.map(item => [normalizeIdentifier(item.name), { item: { ...item, symbolKind: 'constant' as const }, file }] as const),
    ...program.globals.map(item => [normalizeIdentifier(item.name), { item: { ...item, symbolKind: 'global' as const }, file }] as const)
  ]));
  const targetSymbols = new Map<string, TransferProjectSymbol>(targetPrograms.flatMap(({ program }) => [
    ...program.constants.map(item => [normalizeIdentifier(item.name), { ...item, symbolKind: 'constant' as const }] as const),
    ...program.globals.map(item => [normalizeIdentifier(item.name), { ...item, symbolKind: 'global' as const }] as const)
  ]));
  const result: FunctionLibraryProjectResourceMerge = {
    projectTypes: { copied: [], reused: [] },
    projectSymbols: { copied: [], reused: [] },
    conflicts: []
  };
  const copiedTypes = closure.projectTypes.flatMap(name => {
    const source = sourceTypes.get(normalizeIdentifier(name));
    if (!source) return [];
    const target = targetTypes.get(normalizeIdentifier(name));
    if (target) {
      if (dataTypeSignature(source.item) === dataTypeSignature(target)) result.projectTypes.reused.push(source.item.name);
      else result.conflicts.push({ kind: 'projectType', name: source.item.name, reason: '目标项目存在同名但结构不同的数据类型。' });
      return [];
    }
    result.projectTypes.copied.push(source.item.name);
    return [serializeDataType(source.item, source.file.sourceCode)];
  });
  const copiedConstants: string[] = [];
  const copiedGlobals: string[] = [];
  closure.projectSymbols.forEach(name => {
    const source = sourceSymbols.get(normalizeIdentifier(name));
    if (!source) return;
    const target = targetSymbols.get(normalizeIdentifier(name));
    if (target) {
      if (projectSymbolSignature(source.item) === projectSymbolSignature(target)) result.projectSymbols.reused.push(source.item.name);
      else result.conflicts.push({ kind: 'projectSymbol', name: source.item.name, reason: '目标项目存在同名但定义不同的常量或全局变量。' });
      return;
    }
    result.projectSymbols.copied.push(source.item.name);
    const serialized = serializeProjectSymbol(source.item, source.file.sourceCode);
    if (source.item.symbolKind === 'constant') copiedConstants.push(serialized);
    else copiedGlobals.push(serialized);
  });

  if (copiedTypes.length > 0) {
    const target = targetFiles.find(file => /(?:^|\/)项目数据类型\.lcpp$/iu.test(file.filePath.replace(/\\/gu, '/')));
    result.dataTypesSource = appendSourceBlocks(target?.sourceCode || EMPTY_PROJECT_DATA_TYPES_SOURCE, copiedTypes);
  }
  if (copiedConstants.length > 0 || copiedGlobals.length > 0) {
    const target = targetFiles.find(file => /(?:^|\/)项目全局变量\.lcpp$/iu.test(file.filePath.replace(/\\/gu, '/')));
    result.globalsSource = mergeProjectSymbolsSource(target?.sourceCode || EMPTY_PROJECT_GLOBALS_SOURCE, copiedConstants, copiedGlobals);
  }
  return result;
}

function detectModuleDependencies(sourceCode: string, moduleContext?: LingCppModuleContext): string[] {
  return [...new Set((moduleContext?.enabledModules || []).filter(module => {
    const commands = module.manifest.contributes?.commands || [];
    const types = module.manifest.contributes?.types || [];
    return commands.some(command => [command.name, ...(command.aliases || [])].some(name => hasCall(sourceCode, name)))
      || types.some(type => hasIdentifier(sourceCode, type.name));
  }).map(module => module.manifest.id))];
}

function dataTypeSignature(dataType: LingCppDataType): string {
  return JSON.stringify(dataType.fields.map(field => ({
    name: normalizeIdentifier(field.name),
    type: normalizeIdentifier(field.type),
    isArray: Boolean(field.isArray),
    initialValue: field.initialValue?.trim() || ''
  })));
}

type TransferProjectSymbol = (LingCppConstant & { symbolKind: 'constant' }) | (LingCppGlobalVariable & { symbolKind: 'global' });

function projectSymbolSignature(symbol: TransferProjectSymbol): string {
  return JSON.stringify({
    kind: symbol.symbolKind,
    type: normalizeIdentifier(symbol.type),
    isArray: symbol.symbolKind === 'global' && Boolean(symbol.isArray),
    initialValue: symbol.initialValue?.trim() || ''
  });
}

function serializeDataType(dataType: LingCppDataType, sourceCode: string): string {
  const lines: string[] = [];
  const note = readDeclarationNote(sourceCode, dataType.line);
  if (note) lines.push(`// ${note}`);
  lines.push(`数据类型 ${dataType.name}`);
  dataType.fields.forEach(field => {
    const fieldNote = readDeclarationNote(sourceCode, field.line);
    if (fieldNote) lines.push(`  // ${fieldNote}`);
    lines.push(`  ${field.type} ${field.name}${field.isArray ? '[]' : ''}${field.initialValue?.trim() ? ` = ${field.initialValue.trim()}` : ''}`);
  });
  lines.push('结束数据类型');
  return lines.join('\n');
}

function serializeProjectSymbol(symbol: TransferProjectSymbol, sourceCode: string): string {
  const lines: string[] = [];
  const note = readDeclarationNote(sourceCode, symbol.line);
  if (note) lines.push(`// ${note}`);
  if (symbol.symbolKind === 'constant') {
    lines.push(`常量 ${symbol.type} ${symbol.name} = ${symbol.initialValue.trim()}`);
  } else {
    lines.push(`全局 ${symbol.type} ${symbol.name}${symbol.isArray ? '[]' : ''}${symbol.initialValue?.trim() ? ` = ${symbol.initialValue.trim()}` : ''}`);
  }
  return lines.join('\n');
}

function readDeclarationNote(sourceCode: string, line: number): string | undefined {
  const previous = sourceCode.split(/\r?\n/u)[Math.max(0, line - 2)]?.trim() || '';
  return previous.startsWith('//') ? previous.slice(2).trim() || undefined : undefined;
}

function appendSourceBlocks(sourceCode: string, blocks: string[]): string {
  const base = sourceCode.replace(/\s+$/u, '');
  return `${base}${base ? '\n\n' : ''}${blocks.join('\n\n')}\n`;
}

function mergeProjectSymbolsSource(sourceCode: string, constants: string[], globals: string[]): string {
  let result = sourceCode.replace(/\s+$/u, '');
  if (constants.length > 0) {
    const program = parseLingCpp(result).program;
    const firstGlobalLine = program.globals[0]?.line;
    if (firstGlobalLine) {
      const lines = result.split('\n');
      let insertionIndex = firstGlobalLine - 1;
      if (insertionIndex > 0 && lines[insertionIndex - 1]?.trim().startsWith('//')) insertionIndex -= 1;
      const before = lines.slice(0, insertionIndex).join('\n').replace(/\s+$/u, '');
      const after = lines.slice(insertionIndex).join('\n').replace(/^\s+/u, '');
      result = `${before}${before ? '\n\n' : ''}${constants.join('\n\n')}\n\n${after}`;
    } else {
      result = appendSourceBlocks(result, constants).replace(/\n$/u, '');
    }
  }
  if (globals.length > 0) result = appendSourceBlocks(result, globals).replace(/\n$/u, '');
  return `${result}\n`;
}

export function renameFunctionLibraryAcrossSources(
  files: LingCppWorkspaceFile[],
  oldName: string,
  newName: string
): LingCppWorkspaceFile[] {
  const declaration = new RegExp(`(^\\s*功能库\\s+)${escapeRegExp(oldName)}(?=\\s*$)`, 'gmu');
  const qualifier = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(oldName)}(?=\\s*\\.)`, 'gmu');
  return files.map(file => ({
    ...file,
    sourceCode: rewriteCodeOnly(file.sourceCode, code => code.replace(declaration, `$1${newName}`).replace(qualifier, `$1${newName}`))
  }));
}

export function findFunctionLibraryReferences(files: LingCppWorkspaceFile[], libraryName: string): Array<{ filePath: string; line: number }> {
  return files.flatMap(file => scanQualifiedCalls(file.sourceCode)
    .filter(call => normalizeIdentifier(call.libraryName) === normalizeIdentifier(libraryName))
    .map(call => ({ filePath: file.filePath, line: call.line })));
}

function scanQualifiedCalls(sourceCode: string): Array<{ libraryName: string; functionName: string; line: number; text: string }> {
  const calls: Array<{ libraryName: string; functionName: string; line: number; text: string }> = [];
  sourceCode.split(/\r?\n/u).forEach((rawLine, index) => {
    const line = stripLineComment(rawLine);
    for (const match of line.matchAll(QUALIFIED_CALL_RE)) {
      calls.push({ libraryName: match[1] || '', functionName: match[2] || '', line: index + 1, text: match[0] || '' });
    }
  });
  return calls;
}

function scanUnqualifiedCalls(sourceCode: string): Array<{ name: string; line: number }> {
  const calls: Array<{ name: string; line: number }> = [];
  const callPattern = new RegExp(`(^|[^.\\p{L}\\p{N}_])(${IDENTIFIER})\\s*[（(]`, 'gu');
  sourceCode.split(/\r?\n/u).forEach((rawLine, index) => {
    const line = stripLineComment(rawLine);
    for (const match of line.matchAll(callPattern)) calls.push({ name: match[2] || '', line: index + 1 });
  });
  return calls;
}

function sourceOwnsLibrary(sourceCode: string, library: LingCppProjectFunctionLibrary): boolean {
  return parseLingCpp(sourceCode).program.functionLibraries.some(item => normalizeIdentifier(item.name) === normalizeIdentifier(library.name));
}

function diagnostic(level: LingCppDiagnostic['level'], line: number, codeSnippet: string, message: string, suggestion: string): LingCppDiagnostic {
  return { id: `lingcpp-function-library-${line}-${message}`, line, level, message, codeSnippet, suggestion };
}

function getFileBaseName(filePath?: string): string | undefined {
  const normalized = normalizePath(filePath || '');
  const fileName = normalized.split('/').at(-1);
  return fileName?.toLocaleLowerCase().endsWith('.lcpp') ? fileName.slice(0, -5) : undefined;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/gu, '/').toLocaleLowerCase();
}

function stripCommentsAndStrings(source: string): string {
  return source.split(/\r?\n/u).map(line => {
    let result = '';
    let quote: '"' | '“' | undefined;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index] || '';
      if (!quote && char === '/' && line[index + 1] === '/') break;
      if (!quote && (char === '"' || char === '“')) {
        quote = char;
        result += ' ';
        continue;
      }
      if (quote) {
        if (quote === '"' && char === '\\') index += 1;
        else if ((quote === '"' && char === '"') || (quote === '“' && char === '”')) quote = undefined;
        result += ' ';
        continue;
      }
      result += char;
    }
    return result;
  }).join('\n');
}

function stripLineComment(line: string): string {
  let quote: '"' | '“' | undefined;
  for (let index = 0; index < line.length - 1; index += 1) {
    const char = line[index];
    if (!quote && (char === '"' || char === '“')) quote = char;
    else if (quote === '"' && char === '"') quote = undefined;
    else if (quote === '“' && char === '”') quote = undefined;
    else if (!quote && char === '/' && line[index + 1] === '/') return line.slice(0, index);
  }
  return line;
}

function hasIdentifier(source: string, name: string): boolean {
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(name)}(?=$|[^\\p{L}\\p{N}_])`, 'u').test(source);
}

function hasCall(source: string, name: string): boolean {
  return new RegExp(`${escapeRegExp(name)}\\s*[（(]`, 'u').test(source);
}

function rewriteCodeOnly(source: string, rewrite: (code: string) => string): string {
  return source.split(/\r?\n/u).map(line => {
    let result = '';
    let code = '';
    for (let index = 0; index < line.length;) {
      const char = line[index] || '';
      if (char === '/' && line[index + 1] === '/') {
        result += rewrite(code) + line.slice(index);
        code = '';
        break;
      }
      if (char === '"' || char === '“') {
        result += rewrite(code);
        code = '';
        const closing = char === '"' ? '"' : '”';
        let end = index + 1;
        while (end < line.length) {
          if (char === '"' && line[end] === '\\') { end += 2; continue; }
          if (line[end] === closing) { end += 1; break; }
          end += 1;
        }
        result += line.slice(index, end);
        index = end;
        continue;
      }
      code += char;
      index += 1;
    }
    return result + rewrite(code);
  }).join(source.includes('\r\n') ? '\r\n' : '\n');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
