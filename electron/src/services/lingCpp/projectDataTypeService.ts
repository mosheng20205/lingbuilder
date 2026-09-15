import { LingCppModuleContext } from '../modules/types';
import { areLingCppTypesCompatible, inferLingCppExpressionType } from './expressionTypeService';
import { LING_CPP_TYPES, normalizeIdentifier, parseLingCpp } from './parser';
import { collectLingCppTextBlockOpaqueLines, scanLingCppTextBlockRanges } from './textBlock';
import { getModulePublicTypeKind } from '../modules/modulePublicTypeService';
import {
  LingCppDataField,
  LingCppDataType,
  LingCppDiagnostic,
  LingCppProjectTypeContext,
  LingCppWorkspaceFile
} from './types';

export const PROJECT_DATA_TYPES_FILE_NAME = '项目数据类型.lcpp';
export const EMPTY_PROJECT_DATA_TYPES_SOURCE = '// 项目自定义数据类型：用于组织可复制、可嵌套的结构化数据。\n';
export const SAFE_DATA_FIELD_TYPES = [
  '文本型', '整数型', '长整数型', '逻辑型', '小数型', '双精度小数型', '字节型', '字节集'
] as const;

export interface ProjectDataTypeReference {
  filePath: string;
  line: number;
  column: number;
  text: string;
  kind: 'type' | 'field';
}

export function isProjectDataTypesFilePath(filePath: string | undefined): boolean {
  if (!filePath) return false;
  return (filePath.replace(/\\/gu, '/').split('/').pop() || '').toLocaleLowerCase()
    === PROJECT_DATA_TYPES_FILE_NAME.toLocaleLowerCase();
}

export function createProjectTypeContext(filePath: string, sourceCode: string): LingCppProjectTypeContext {
  const dataTypes = parseLingCpp(sourceCode).program.dataTypes;
  const lines = sourceCode.split(/\r?\n/u);
  dataTypes.forEach(dataType => {
    dataType.note = readDeclarationNote(lines, dataType.line);
    dataType.fields.forEach(field => { field.note = readDeclarationNote(lines, field.line); });
  });
  return {
    filePath: filePath.replace(/\\/gu, '/'),
    sourceCode,
    dataTypes
  };
}

function readDeclarationNote(lines: string[], line: number): string | undefined {
  const previous = lines[Math.max(0, line - 2)]?.trim() || '';
  return previous.startsWith('//') ? previous.slice(2).trim() || undefined : undefined;
}

export function buildProjectTypeMap(context?: LingCppProjectTypeContext): Map<string, LingCppDataType> {
  return new Map((context?.dataTypes || []).map(dataType => [normalizeIdentifier(dataType.name), dataType]));
}

export function getProjectDataTypeNames(context?: LingCppProjectTypeContext): string[] {
  return (context?.dataTypes || []).map(dataType => dataType.name);
}

export function findProjectDataTypeDefinition(name: string, context?: LingCppProjectTypeContext): { filePath: string; line: number; dataType: LingCppDataType } | undefined {
  const dataType = context?.dataTypes.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(name));
  return dataType && context ? { filePath: context.filePath, line: dataType.line, dataType } : undefined;
}

export function resolveProjectDataFieldAccess(
  sourceCode: string,
  line: number,
  accessText: string,
  context?: LingCppProjectTypeContext,
  globalTypes: ReadonlyMap<string, string> = new Map()
): { filePath: string; line: number; owner: LingCppDataType; field: LingCppDataField } | undefined {
  if (!context) return undefined;
  const parsed = parseLingCpp(sourceCode);
  const segments = accessText.split(/\s*\.\s*/u).filter(Boolean);
  const root = segments.shift();
  if (!root || segments.length === 0) return undefined;
  const scope = new Map([...globalTypes].map(([name, type]) => [normalizeIdentifier(name), type]));
  parsed.program.classes.forEach(cls => {
    if (line < cls.line || line > (cls.endLine || Number.MAX_SAFE_INTEGER)) return;
    cls.members.forEach(member => scope.set(normalizeIdentifier(member.name), member.type));
    cls.methods.forEach(method => {
      if (line < method.line || line > (method.endLine || method.line)) return;
      method.parameters.forEach(parameter => scope.set(normalizeIdentifier(parameter.name), parameter.type));
      (method.locals || []).filter(local => local.line <= line).forEach(local => scope.set(normalizeIdentifier(local.name), local.type));
    });
  });
  const typeMap = buildProjectTypeMap(context);
  let ownerTypeName = scope.get(normalizeIdentifier(root));
  let resolved: { owner: LingCppDataType; field: LingCppDataField } | undefined;
  for (const fieldName of segments) {
    const owner = typeMap.get(normalizeIdentifier(ownerTypeName || ''));
    const field = owner?.fields.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(fieldName));
    if (!owner || !field) return undefined;
    resolved = { owner, field };
    ownerTypeName = field.type;
  }
  return resolved ? { filePath: context.filePath, line: resolved.field.line, ...resolved } : undefined;
}

export function getProjectDataTypeDiagnostics(
  sourceCode: string,
  filePath: string | undefined,
  moduleContext?: LingCppModuleContext,
  projectClassNames: string[] = []
): LingCppDiagnostic[] {
  const parsed = parseLingCpp(sourceCode);
  const diagnostics: LingCppDiagnostic[] = [...parsed.diagnostics];
  const isTypeFile = isProjectDataTypesFilePath(filePath);

  if (!isTypeFile && parsed.program.dataTypes.length > 0) {
    parsed.program.dataTypes.forEach(dataType => diagnostics.push(diagnostic(
      'error', dataType.line, dataType.name,
      '项目自定义数据类型只能声明在“项目数据类型.lcpp”中。',
      '请把该定义移动到解决方案资源管理器中的“自定义数据类型”。'
    )));
    return diagnostics;
  }
  if (!isTypeFile) return diagnostics;

  parsed.program.classes.forEach(cls => diagnostics.push(diagnostic(
    'error', cls.line, cls.name, '项目数据类型文件不能声明窗口类。', '请把窗口类移动到普通 .lcpp 源文件。'
  )));
  parsed.program.constants.forEach(constant => diagnostics.push(diagnostic(
    'error', constant.line, constant.name, '项目数据类型文件不能声明项目常量。', '请把常量移动到“项目全局变量.lcpp”。'
  )));
  parsed.program.globals.forEach(global => diagnostics.push(diagnostic(
    'error', global.line, global.name, '项目数据类型文件不能声明项目全局变量。', '请把变量移动到“项目全局变量.lcpp”。'
  )));

  const moduleTypes = (moduleContext?.enabledModules || [])
    .flatMap(module => module.manifest.contributes?.types || [])
    .map(type => type.name);
  const moduleStructuredTypes = new Set((moduleContext?.enabledModules || [])
    .flatMap(module => module.manifest.contributes?.types || [])
    .filter(type => getModulePublicTypeKind(type) !== 'opaque')
    .map(type => normalizeIdentifier(type.name)));
  const reserved = new Map<string, string>([
    ...LING_CPP_TYPES.map(name => [normalizeIdentifier(name), `内置类型 ${name}`] as const),
    ...moduleTypes.map(name => [normalizeIdentifier(name), `模块类型 ${name}`] as const),
    ...projectClassNames.map(name => [normalizeIdentifier(name), `窗口类 ${name}`] as const)
  ]);
  const typeMap = new Map<string, LingCppDataType>();
  parsed.program.dataTypes.forEach(dataType => {
    const key = normalizeIdentifier(dataType.name);
    const conflict = reserved.get(key);
    if (conflict) diagnostics.push(diagnostic('error', dataType.line, dataType.name, `数据类型 ${dataType.name} 与${conflict}重名。`, '请使用项目内唯一且不与内置、模块或窗口类型冲突的名称。'));
    if (!typeMap.has(key)) typeMap.set(key, dataType);
  });

  const safeTypes = new Set(SAFE_DATA_FIELD_TYPES.map(normalizeIdentifier));
  parsed.program.dataTypes.forEach(dataType => {
    dataType.fields.forEach(field => {
      const fieldTypeKey = normalizeIdentifier(field.type);
      const isCustom = typeMap.has(fieldTypeKey);
      const isModuleStructured = moduleStructuredTypes.has(fieldTypeKey);
      if (!safeTypes.has(fieldTypeKey) && !isCustom && !isModuleStructured) {
        diagnostics.push(diagnostic('error', field.line, field.type, `字段 ${dataType.name}.${field.name} 使用了不允许的类型 ${field.type}。`, `请选择 ${SAFE_DATA_FIELD_TYPES.join('、')} 或其他项目自定义数据类型。`));
      }
      if ((field.isArray || field.type === '字节集' || isCustom || isModuleStructured) && field.initialValue?.trim()) {
        diagnostics.push(diagnostic('error', field.line, field.initialValue, `字段 ${dataType.name}.${field.name} 只能使用默认空初始化。`, '请清空数组、字节集或嵌套对象字段的默认值。'));
      } else if (field.initialValue?.trim()) {
        const inferred = inferLingCppExpressionType(field.initialValue, new Map(), moduleContext);
        if (!inferred || !areLingCppTypesCompatible(field.type, inferred)) {
          diagnostics.push(diagnostic('error', field.line, field.initialValue, `字段 ${dataType.name}.${field.name} 的默认值与 ${field.type} 不兼容。`, `请填写 ${field.type} 字面量，或清空默认值。`));
        }
      }
    });
  });

  findDataTypeCycles(parsed.program.dataTypes).forEach(cycle => {
    const owner = typeMap.get(normalizeIdentifier(cycle[0] || ''));
    diagnostics.push(diagnostic('error', owner?.line || 1, cycle.join(' → '), `自定义数据类型存在循环嵌套：${cycle.join(' → ')}。`, '请删除其中一个嵌套字段；首版数组字段同样不能形成递归类型。'));
  });
  return diagnostics;
}

export function sortProjectDataTypes(dataTypes: LingCppDataType[]): LingCppDataType[] {
  const byName = new Map(dataTypes.map(item => [normalizeIdentifier(item.name), item]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const output: LingCppDataType[] = [];
  const visit = (dataType: LingCppDataType) => {
    const key = normalizeIdentifier(dataType.name);
    if (visited.has(key) || visiting.has(key)) return;
    visiting.add(key);
    dataType.fields.forEach(field => {
      const dependency = byName.get(normalizeIdentifier(field.type));
      if (dependency) visit(dependency);
    });
    visiting.delete(key);
    visited.add(key);
    output.push(dataType);
  };
  dataTypes.forEach(visit);
  return output;
}

export function resolveProjectFieldPathType(
  rootType: string | undefined,
  fields: string[],
  context?: LingCppProjectTypeContext
): string | undefined {
  if (!rootType) return undefined;
  const typeMap = buildProjectTypeMap(context);
  let currentType = rootType;
  for (const fieldName of fields) {
    const owner = typeMap.get(normalizeIdentifier(currentType));
    if (!owner) return undefined;
    const field = owner.fields.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(fieldName));
    if (!field) return undefined;
    currentType = field.type;
  }
  return currentType;
}

export function findProjectDataTypeReferences(
  files: LingCppWorkspaceFile[],
  context: LingCppProjectTypeContext,
  typeName: string,
  fieldName?: string
): ProjectDataTypeReference[] {
  const references: ProjectDataTypeReference[] = [];
  files.forEach(file => {
    const lines = file.sourceCode.split(/\r?\n/u);
    const parsed = parseLingCpp(file.sourceCode);
    const scopes = buildLineScopeTypes(parsed.program.classes, context);
    const opaqueLines = collectLingCppTextBlockOpaqueLines(scanLingCppTextBlockRanges(lines), lines.length);
    lines.forEach((line, index) => {
      if (isIgnoredLine(line) || opaqueLines.has(index + 1)) return; // 多行文本块内容不透明：不算类型引用
      if (!fieldName) {
        for (const match of line.matchAll(identifierRegex(typeName))) {
          references.push({ filePath: file.filePath, line: index + 1, column: (match.index || 0) + 1, text: line.trim(), kind: 'type' });
        }
        return;
      }
      for (const access of line.matchAll(/[\p{L}_][\p{L}\p{N}_]*(?:\s*\.\s*[\p{L}_][\p{L}\p{N}_]*)+/gu)) {
        const segments = access[0].split(/\s*\.\s*/u);
        const scope = scopes.get(index + 1) || new Map<string, string>();
        let ownerType = scope.get(normalizeIdentifier(segments[0] || ''));
        for (let segmentIndex = 1; segmentIndex < segments.length; segmentIndex += 1) {
          const segment = segments[segmentIndex] || '';
          if (normalizeIdentifier(ownerType || '') === normalizeIdentifier(typeName) && normalizeIdentifier(segment) === normalizeIdentifier(fieldName)) {
            references.push({ filePath: file.filePath, line: index + 1, column: (access.index || 0) + 1, text: line.trim(), kind: 'field' });
          }
          ownerType = resolveProjectFieldPathType(ownerType, [segment], context);
        }
      }
    });
  });
  return references;
}

export function renameProjectDataTypeAcrossSources(
  files: LingCppWorkspaceFile[],
  context: LingCppProjectTypeContext,
  oldName: string,
  newName: string
): LingCppWorkspaceFile[] {
  validateRename(context.dataTypes.map(item => item.name), oldName, newName, '数据类型');
  return files.map(file => ({ ...file, sourceCode: replaceOutsideStringsAndComments(file.sourceCode, identifierRegex(oldName), newName.trim()) }));
}

export function renameProjectDataFieldAcrossSources(
  files: LingCppWorkspaceFile[],
  context: LingCppProjectTypeContext,
  typeName: string,
  oldName: string,
  newName: string
): LingCppWorkspaceFile[] {
  const owner = buildProjectTypeMap(context).get(normalizeIdentifier(typeName));
  if (!owner) throw new Error(`未找到数据类型：${typeName}`);
  validateRename(owner.fields.map(item => item.name), oldName, newName, '字段');
  return files.map(file => {
    const parsed = parseLingCpp(file.sourceCode);
    const scopes = buildLineScopeTypes(parsed.program.classes, context);
    const lines = file.sourceCode.split(/(\r?\n)/u);
    const sourceLinesForBlocks = file.sourceCode.split(/\r?\n/u);
    const opaqueLines = collectLingCppTextBlockOpaqueLines(
      scanLingCppTextBlockRanges(sourceLinesForBlocks),
      sourceLinesForBlocks.length
    );
    let sourceLine = 1;
    const sourceCode = lines.map(part => {
      if (/^\r?\n$/u.test(part)) { sourceLine += 1; return part; }
      if (isIgnoredLine(part) || opaqueLines.has(sourceLine)) return part; // 文本块内容不参与字段重命名
      const scope = scopes.get(sourceLine) || new Map<string, string>();
      return replaceTypedFieldAccess(part, scope, context, typeName, oldName, newName.trim());
    }).join('');
    return { ...file, sourceCode };
  });
}

function buildLineScopeTypes(classes: ReturnType<typeof parseLingCpp>['program']['classes'], context: LingCppProjectTypeContext): Map<number, Map<string, string>> {
  const result = new Map<number, Map<string, string>>();
  classes.forEach(cls => cls.methods.forEach(method => {
    const scope = new Map<string, string>(cls.members.map(member => [normalizeIdentifier(member.name), member.type]));
    method.parameters.forEach(parameter => scope.set(normalizeIdentifier(parameter.name), parameter.type));
    const locals = [...(method.locals || [])].sort((left, right) => left.line - right.line);
    for (let line = method.line; line <= (method.endLine || method.line); line += 1) {
      locals.filter(local => local.line <= line).forEach(local => scope.set(normalizeIdentifier(local.name), local.type));
      result.set(line, new Map(scope));
    }
  }));
  context.dataTypes.forEach(dataType => dataType.fields.forEach(() => undefined));
  return result;
}

function replaceTypedFieldAccess(line: string, scope: Map<string, string>, context: LingCppProjectTypeContext, typeName: string, oldName: string, newName: string): string {
  return replaceOutsideStringsAndComments(line, /[\p{L}_][\p{L}\p{N}_]*(?:\s*\.\s*[\p{L}_][\p{L}\p{N}_]*)+/gu, access => {
    const segments = access.split(/\s*\.\s*/u);
    let ownerType = scope.get(normalizeIdentifier(segments[0] || ''));
    for (let index = 1; index < segments.length; index += 1) {
      if (normalizeIdentifier(ownerType || '') === normalizeIdentifier(typeName) && normalizeIdentifier(segments[index] || '') === normalizeIdentifier(oldName)) segments[index] = newName;
      ownerType = resolveProjectFieldPathType(ownerType, [segments[index] || ''], context);
    }
    return segments.join('.');
  });
}

function findDataTypeCycles(dataTypes: LingCppDataType[]): string[][] {
  const byName = new Map(dataTypes.map(item => [normalizeIdentifier(item.name), item]));
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const visit = (dataType: LingCppDataType, path: LingCppDataType[]) => {
    const key = normalizeIdentifier(dataType.name);
    const existingIndex = path.findIndex(item => normalizeIdentifier(item.name) === key);
    if (existingIndex >= 0) {
      const cycle = [...path.slice(existingIndex).map(item => item.name), dataType.name];
      const signature = [...new Set(cycle.slice(0, -1).map(normalizeIdentifier))].sort().join('|');
      if (!seen.has(signature)) { seen.add(signature); cycles.push(cycle); }
      return;
    }
    dataType.fields.forEach(field => {
      const child = byName.get(normalizeIdentifier(field.type));
      if (child) visit(child, [...path, dataType]);
    });
  };
  dataTypes.forEach(item => visit(item, []));
  return cycles;
}

function validateRename(names: string[], oldName: string, newName: string, label: string): void {
  const next = newName.trim();
  if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(next)) throw new Error(`新的${label}名不是有效标识符。`);
  if (names.some(name => normalizeIdentifier(name) === normalizeIdentifier(next) && normalizeIdentifier(name) !== normalizeIdentifier(oldName))) throw new Error(`${label} ${next} 已存在。`);
}

function identifierRegex(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'gu');
}

function replaceOutsideStringsAndComments(source: string, pattern: RegExp, replacement: string | ((substring: string) => string)): string {
  const sourceLines = source.split(/\r?\n/u);
  const opaqueLines = collectLingCppTextBlockOpaqueLines(scanLingCppTextBlockRanges(sourceLines), sourceLines.length);
  let lineNumber = 0;
  return source.split(/(\r?\n)/u).map(part => {
    if (/^\r?\n$/u.test(part)) return part;
    lineNumber += 1;
    if (isIgnoredLine(part) || opaqueLines.has(lineNumber)) return part; // 文本块内容不参与类型重命名替换
    let output = '';
    let code = '';
    let quote: '"' | '“' | undefined;
    for (let index = 0; index < part.length; index += 1) {
      const character = part[index];
      if (!quote && character === '/' && part[index + 1] === '/') {
        output += code.replace(pattern, replacement as never) + part.slice(index);
        return output;
      }
      if (!quote && (character === '"' || character === '“')) {
        output += code.replace(pattern, replacement as never);
        code = character;
        quote = character;
        continue;
      }
      code += character;
      if ((quote === '"' && character === '"' && code.length > 1 && part[index - 1] !== '\\') || (quote === '“' && character === '”')) {
        output += code;
        code = '';
        quote = undefined;
      }
    }
    return output + (quote ? code : code.replace(pattern, replacement as never));
  }).join('');
}

function isIgnoredLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('注释 ') || trimmed.startsWith('@');
}

function diagnostic(level: LingCppDiagnostic['level'], line: number, codeSnippet: string, message: string, suggestion: string): LingCppDiagnostic {
  return { id: `lingcpp-project-data-type-${line}-${message}`, line, level, message, codeSnippet, suggestion };
}
