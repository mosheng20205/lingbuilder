import type { LingCppModuleContext, ModuleCommandBinding, ModuleCommandBindingParameter } from '../modules/types';
import type { LingControl, LingDesignerResource, LingWindowModel, LingWindowProject } from '../windowDesigner/types';
import { getWin32ControlDefinition } from '../windowDesigner/win32ControlRegistry';
import { normalizeIdentifier, parseLingCpp } from './parser';
import type { LingCppDiagnostic } from './types';
import {
  collectRuntimeControlMethodCandidates,
  getRuntimeControlCommandReturnType,
  getRuntimeControlVariablesAtLine,
  getRuntimeControlVariablesFromMethods,
  isRuntimeControlTypeCompatibleWithParameter,
  type LingCppRuntimeControlVariable,
  type RuntimeControlMethodCandidate
} from './runtimeControlTypeService';

export interface LingCppControlSymbol {
  projectId: string;
  windowId: string;
  windowName: string;
  controlId: string;
  name: string;
  controlType: string;
  designerType?: string;
  kind: 'visual' | 'nonVisual' | 'resource';
}

export interface LingCppControlReferenceRange {
  startOffset: number;
  endOffset: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface LingCppControlReference {
  commandName: string;
  canonicalCommandName: string;
  parameterIndex: number;
  parameter: ModuleCommandBindingParameter;
  rawText: string;
  name: string;
  quoted: boolean;
  range: LingCppControlReferenceRange;
  symbol?: LingCppControlSymbol;
  candidates: LingCppControlSymbol[];
  status:
    | 'resolved'
    | 'runtime-reference'
    | 'missing'
    | 'ambiguous'
    | 'invalid-expression'
    | 'incompatible-kind'
    | 'incompatible-type'
    | 'scope-mismatch';
  runtimeType?: string;
}

export interface LingCppControlReferenceCompletion {
  commandName: string;
  parameterIndex: number;
  parameter: ModuleCommandBindingParameter;
  symbols: LingCppControlSymbol[];
  runtimeVariables: LingCppRuntimeControlVariable[];
  acceptsCurrentWindow: boolean;
}

export interface LingCppControlReferenceSourceFile {
  filePath: string;
  sourceCode: string;
}

export interface LingCppControlReferenceLocation {
  filePath: string;
  range: LingCppControlReferenceRange;
  reference: LingCppControlReference;
}

export interface LingCppControlReferenceRenameResult {
  project: LingWindowProject;
  sources: LingCppControlReferenceSourceFile[];
  changeCount: number;
}

interface ParsedInvocation {
  name: string;
  arguments: Array<{ text: string; startOffset: number; endOffset: number }>;
}

interface ResolvedBinding {
  binding: ModuleCommandBinding;
  canonicalName: string;
}

export function getLingCppControlSymbols(
  project?: LingWindowProject,
  source = '',
  filePath?: string,
  scope: 'currentWindow' | 'project' = 'currentWindow',
  moduleContext?: LingCppModuleContext,
  sourceClassNames?: ReadonlySet<string>
): LingCppControlSymbol[] {
  if (!project) return [];
  const windows = scope === 'project' ? project.windows : selectDesignerWindows(project, source, filePath, sourceClassNames);
  const symbols = windows.flatMap(window => window.controls.map(control => controlToSymbol(project, window, control, moduleContext)));
  const windowIds = new Set(windows.map(window => window.id));
  const resources = (project.resources || [])
    .flatMap(resource => resourceToSymbols(project, resource))
    .filter(symbol => scope === 'project' || windowIds.has(symbol.windowId));
  if (scope !== 'project') return [...symbols, ...resources];
  const uniqueResources = new Map<string, LingCppControlSymbol>();
  resources.forEach(symbol => {
    const key = `${symbol.kind}:${symbol.controlId}`;
    if (!uniqueResources.has(key)) uniqueResources.set(key, symbol);
  });
  return [...symbols, ...uniqueResources.values()];
}

/** 控件引用解析的共享上下文：一次解析结果供所有引用复用，避免逐参数全文重新解析。 */
interface ControlReferenceResolutionContext {
  lineStarts: number[];
  methods: readonly RuntimeControlMethodCandidate[];
  projectSymbols: LingCppControlSymbol[];
  currentWindowSymbols: LingCppControlSymbol[];
}

export function getLingCppControlReferences(
  source: string,
  project?: LingWindowProject,
  moduleContext?: LingCppModuleContext,
  filePath?: string
): LingCppControlReference[] {
  if (!moduleContext) return [];
  const bindings = buildBindingIndex(moduleContext);
  const lineStarts = getLineStarts(source);
  const parsed = parseLingCpp(source);
  const sourceClassNames = new Set(parsed.program.classes.map(item => normalizeIdentifier(item.name)));
  const context: ControlReferenceResolutionContext = {
    lineStarts,
    methods: collectRuntimeControlMethodCandidates(parsed),
    projectSymbols: project
      ? getLingCppControlSymbols(project, source, filePath, 'project', moduleContext, sourceClassNames)
      : [],
    currentWindowSymbols: project
      ? getLingCppControlSymbols(project, source, filePath, 'currentWindow', moduleContext, sourceClassNames)
      : []
  };
  return parseInvocations(source).flatMap(invocation => {
    const resolvedBinding = bindings.get(normalizeIdentifier(invocation.name));
    if (!resolvedBinding) return [];
    return (resolvedBinding.binding.parameters || []).flatMap((parameter, parameterIndex) => {
      if (parameter.type !== 'controlRef') return [];
      const argument = invocation.arguments[parameterIndex];
      if (!argument) return [];
      return [resolveControlReference(
        source,
        context,
        invocation.name,
        resolvedBinding.canonicalName,
        parameterIndex,
        parameter,
        argument,
        filePath,
        moduleContext
      )];
    });
  });
}

export function getLingCppControlReferenceAtPosition(
  source: string,
  line: number,
  column: number,
  project?: LingWindowProject,
  moduleContext?: LingCppModuleContext,
  filePath?: string
): LingCppControlReference | undefined {
  return getLingCppControlReferences(source, project, moduleContext, filePath).find(reference => (
    positionInsideRange(line, column, reference.range)
  ));
}

export function getLingCppControlReferenceDiagnostics(
  source: string,
  project?: LingWindowProject,
  moduleContext?: LingCppModuleContext,
  filePath?: string
): LingCppDiagnostic[] {
  const diagnostics: LingCppDiagnostic[] = [];
  getLingCppControlReferences(source, project, moduleContext, filePath).forEach(reference => {
    const base = {
      line: reference.range.startLine,
      range: {
        startLine: reference.range.startLine,
        startColumn: reference.range.startColumn,
        endLine: reference.range.endLine,
        endColumn: reference.range.endColumn
      },
      codeSnippet: reference.rawText
    };
    if (reference.quoted) diagnostics.push({
      id: `lingcpp-control-reference-quoted-${reference.range.startOffset}`,
      ...base,
      level: 'error',
      message: `命令 ${reference.canonicalCommandName} 的第 ${reference.parameterIndex + 1} 个参数是控件引用，不能写成文本。`,
      suggestion: reference.status === 'resolved'
        ? `请去掉双引号，改为 ${reference.name}。`
        : '请先从控件补全中选择可解析的设计器对象；只有目标唯一且兼容时才能安全移除引号。'
    });
    if (reference.status === 'missing') diagnostics.push({
      id: `lingcpp-control-reference-missing-${reference.range.startOffset}`,
      ...base,
      level: 'error' as const,
      message: `找不到控件“${reference.name || reference.rawText}”。`,
      suggestion: '请从当前窗口控件补全中选择控件，或检查源码关联的设计器窗口。'
    });
    else if (reference.status === 'ambiguous') diagnostics.push({
      id: `lingcpp-control-reference-ambiguous-${reference.range.startOffset}`,
      ...base,
      level: 'error' as const,
      message: `控件引用“${reference.name}”存在歧义。`,
      suggestion: `匹配到：${reference.candidates.map(item => `${item.windowName}/${item.name}`).join('、')}。请修正重复名称或源码窗口关联。`
    });
    else if (reference.status === 'scope-mismatch') diagnostics.push({
      id: `lingcpp-control-reference-scope-${reference.range.startOffset}`,
      ...base,
      level: 'error' as const,
      message: `控件“${reference.name}”不属于当前源码关联的窗口。`,
      suggestion: `该参数作用域是“当前窗口”，但目标位于：${reference.candidates.map(item => item.windowName).join('、')}。请改用当前窗口控件，或由模块作者把确需跨窗口的参数声明为 project 作用域。`
    });
    else if (reference.status === 'incompatible-kind') diagnostics.push({
      id: `lingcpp-control-reference-kind-${reference.range.startOffset}`,
      ...base,
      level: 'error' as const,
      message: `设计器对象“${reference.name}”的种类不能用于参数“${reference.parameter.name}”。`,
      suggestion: `此参数允许：${(reference.parameter.controlKinds || ['visual']).map(describeControlKind).join('、')}。`
    });
    else if (reference.status === 'incompatible-type') diagnostics.push({
      id: `lingcpp-control-reference-type-${reference.range.startOffset}`,
      ...base,
      level: 'error' as const,
      message: `控件“${reference.name}”的类型是 ${reference.runtimeType || reference.symbol?.controlType || '未知'}，不能用于参数“${reference.parameter.name}”。`,
      suggestion: `此参数允许：${reference.parameter.controlTypes?.join('、') || '兼容控件'}。`
    });
    else if (reference.status === 'invalid-expression') diagnostics.push({
      id: `lingcpp-control-reference-expression-${reference.range.startOffset}`,
      ...base,
      level: 'error' as const,
      message: `参数“${reference.parameter.name}”需要直接填写控件名。`,
      suggestion: '请使用当前窗口中的控件引用，不要填写普通文本或复杂表达式。'
    });
  });
  return diagnostics;
}

export function getControlReferenceCompletionSymbols(
  source: string,
  line: number,
  column: number,
  project?: LingWindowProject,
  moduleContext?: LingCppModuleContext,
  filePath?: string
): LingCppControlSymbol[] {
  return getLingCppControlReferenceCompletion(source, line, column, project, moduleContext, filePath)?.symbols || [];
}

export function getLingCppControlReferenceCompletion(
  source: string,
  line: number,
  column: number,
  project?: LingWindowProject,
  moduleContext?: LingCppModuleContext,
  filePath?: string
): LingCppControlReferenceCompletion | undefined {
  if (!moduleContext) return undefined;
  const offset = offsetAt(source, line, column);
  const bindingIndex = buildBindingIndex(moduleContext);
  const invocation = parseInvocations(source).find(item => item.arguments.some(argument => offset >= argument.startOffset && offset <= argument.endOffset + 1));
  if (!invocation) return undefined;
  const argumentIndex = invocation.arguments.findIndex(argument => offset >= argument.startOffset && offset <= argument.endOffset + 1);
  const resolvedBinding = bindingIndex.get(normalizeIdentifier(invocation.name));
  const parameter = resolvedBinding?.binding.parameters?.[argumentIndex];
  if (!parameter || parameter.type !== 'controlRef') return undefined;
  return {
    commandName: resolvedBinding?.canonicalName || invocation.name,
    parameterIndex: argumentIndex,
    parameter,
    symbols: project ? filterCompatibleSymbols(
      getLingCppControlSymbols(project, source, filePath, parameter.scope || 'currentWindow', moduleContext),
      parameter
    ) : [],
    runtimeVariables: getRuntimeControlVariablesAtLine(source, line, moduleContext)
      .filter(variable => isRuntimeControlTypeCompatibleWithParameter(variable.type, parameter, moduleContext)),
    acceptsCurrentWindow: acceptsCurrentWindowReference(parameter)
  };
}

export function migrateQuotedControlReferences(
  source: string,
  project?: LingWindowProject,
  moduleContext?: LingCppModuleContext,
  filePath?: string
): { source: string; changeCount: number } {
  const references = getLingCppControlReferences(source, project, moduleContext, filePath)
    .filter(reference => reference.quoted && reference.status === 'resolved')
    .sort((left, right) => right.range.startOffset - left.range.startOffset);
  let next = source;
  references.forEach(reference => {
    next = `${next.slice(0, reference.range.startOffset)}${reference.name}${next.slice(reference.range.endOffset)}`;
  });
  return { source: next, changeCount: references.length };
}

export function getLingCppControlReferenceLocations(
  sources: readonly LingCppControlReferenceSourceFile[],
  symbol: LingCppControlSymbol,
  project?: LingWindowProject,
  moduleContext?: LingCppModuleContext
): LingCppControlReferenceLocation[] {
  if (!project || !moduleContext) return [];
  return sources.flatMap(source => getLingCppControlReferences(
    source.sourceCode,
    project,
    moduleContext,
    source.filePath
  ).filter(reference => reference.symbol?.controlId === symbol.controlId
    && reference.symbol.windowId === symbol.windowId
    && reference.symbol.kind === symbol.kind)
    .map(reference => ({ filePath: source.filePath, range: reference.range, reference })));
}

export function renameLingCppControlReference(
  sources: readonly LingCppControlReferenceSourceFile[],
  project: LingWindowProject | undefined,
  moduleContext: LingCppModuleContext,
  symbol: LingCppControlSymbol,
  newName: string
): LingCppControlReferenceRenameResult {
  const normalizedName = newName.trim();
  if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(normalizedName)) {
    throw new Error('控件名称必须是中文、字母或下划线开头的标识符。');
  }

  const ownerWindow = project.windows.find(window => window.id === symbol.windowId);
  if (!ownerWindow) throw new Error('找不到控件所属的设计器窗口。');
  const conflicts = getLingCppControlSymbols(project, '', undefined, 'project').filter(candidate => (
    candidate.controlId !== symbol.controlId
    && candidate.windowId === symbol.windowId
    && normalizeIdentifier(candidate.name) === normalizeIdentifier(normalizedName)
  ));
  if (conflicts.length) throw new Error(`窗口“${ownerWindow.title || ownerWindow.className}”中已经存在名称“${normalizedName}”。`);

  const locations = getLingCppControlReferenceLocations(sources, symbol, project, moduleContext);
  const nextSources = sources.map(source => {
    const edits = locations.filter(location => location.filePath === source.filePath)
      .sort((left, right) => right.range.startOffset - left.range.startOffset);
    let nextSource = source.sourceCode;
    edits.forEach(location => {
      nextSource = `${nextSource.slice(0, location.range.startOffset)}${normalizedName}${nextSource.slice(location.range.endOffset)}`;
    });
    return nextSource === source.sourceCode ? { ...source } : { ...source, sourceCode: nextSource };
  });

  const nextProject: LingWindowProject = symbol.kind === 'resource'
    ? {
        ...project,
        resources: (project.resources || []).map(resource => resource.id === symbol.controlId
          ? { ...resource, name: normalizedName }
          : resource)
      }
    : {
        ...project,
        windows: project.windows.map(window => window.id === symbol.windowId
          ? {
              ...window,
              controls: window.controls.map(control => control.id === symbol.controlId
                ? { ...control, name: normalizedName }
                : control)
            }
          : window)
      };

  return { project: nextProject, sources: nextSources, changeCount: locations.length };
}

function resolveControlReference(
  source: string,
  context: ControlReferenceResolutionContext,
  commandName: string,
  canonicalCommandName: string,
  parameterIndex: number,
  parameter: ModuleCommandBindingParameter,
  argument: { text: string; startOffset: number; endOffset: number },
  filePath?: string,
  moduleContext?: LingCppModuleContext
): LingCppControlReference {
  const leading = argument.text.length - argument.text.trimStart().length;
  const trailing = argument.text.length - argument.text.trimEnd().length;
  const startOffset = argument.startOffset + leading;
  const endOffset = Math.max(startOffset, argument.endOffset - trailing);
  const rawText = source.slice(startOffset, endOffset);
  const quotedMatch = rawText.match(/^["“]([\s\S]*)["”]$/u);
  const identifierMatch = rawText.match(/^[\p{L}_][\p{L}\p{N}_]*$/u);
  const name = (quotedMatch?.[1] || identifierMatch?.[0] || '').trim();
  const range = rangeFromOffsets(context.lineStarts, startOffset, endOffset);
  const runtimeVariable = identifierMatch
    ? getRuntimeControlVariablesFromMethods(context.methods, range.startLine, moduleContext)
      .find(variable => normalizeIdentifier(variable.name) === normalizeIdentifier(identifierMatch[0]))
    : undefined;
  const runtimeCallName = rawText.match(/^([\p{L}_][\p{L}\p{N}_]*)\s*[（(]/u)?.[1];
  const runtimeType = runtimeVariable?.type
    || (runtimeCallName ? getRuntimeControlCommandReturnType(runtimeCallName, moduleContext) : undefined)
    || (rawText === '当前窗口' && acceptsCurrentWindowReference(parameter) ? '控件容器' : undefined);
  if (runtimeType) {
    const compatible = runtimeType === '控件容器'
      || isRuntimeControlTypeCompatibleWithParameter(runtimeType, parameter, moduleContext);
    return {
      commandName,
      canonicalCommandName,
      parameterIndex,
      parameter,
      rawText,
      name: identifierMatch?.[0] || runtimeCallName || rawText,
      quoted: false,
      range,
      candidates: [],
      status: compatible ? 'runtime-reference' : 'incompatible-type',
      runtimeType
    };
  }
  const scope = parameter.scope || 'currentWindow';
  const allProjectSymbols = context.projectSymbols;
  const allScopeSymbols = scope === 'project'
    ? context.projectSymbols
    : context.currentWindowSymbols;
  const projectCandidates = name
    ? allProjectSymbols.filter(symbol => normalizeIdentifier(symbol.name) === normalizeIdentifier(name))
    : [];
  const candidates = name
    ? allScopeSymbols.filter(symbol => normalizeIdentifier(symbol.name) === normalizeIdentifier(name))
    : [];
  const kindCompatible = filterKindCompatibleSymbols(candidates, parameter);
  const compatible = filterTypeCompatibleSymbols(kindCompatible, parameter);
  const scopeCandidates = candidates.length ? candidates : projectCandidates;
  const symbol = compatible.length === 1
    ? compatible[0]
    : scopeCandidates.length === 1 ? scopeCandidates[0] : undefined;
  const status = !name
    ? 'invalid-expression'
    : candidates.length === 0 && scope === 'currentWindow' && projectCandidates.length > 0
      ? 'scope-mismatch'
      : candidates.length === 0
      ? 'missing'
      : kindCompatible.length === 0
        ? 'incompatible-kind'
        : compatible.length === 0
        ? 'incompatible-type'
        : compatible.length > 1
          ? 'ambiguous'
          : 'resolved';
  return {
    commandName,
    canonicalCommandName,
    parameterIndex,
    parameter,
    rawText,
    name,
    quoted: Boolean(quotedMatch),
    range,
    symbol,
    candidates: compatible.length ? compatible : kindCompatible.length ? kindCompatible : scopeCandidates,
    status
  };
}

function acceptsCurrentWindowReference(parameter: ModuleCommandBindingParameter): boolean {
  return /^(父级|父元素ID|parent_id)$/u.test(parameter.name)
    && (parameter.runtimeRepresentation === 'nativeHandle' || parameter.runtimeRepresentation === 'stableId');
}

function filterCompatibleSymbols(symbols: LingCppControlSymbol[], parameter: ModuleCommandBindingParameter): LingCppControlSymbol[] {
  return filterTypeCompatibleSymbols(filterKindCompatibleSymbols(symbols, parameter), parameter);
}

function filterKindCompatibleSymbols(symbols: LingCppControlSymbol[], parameter: ModuleCommandBindingParameter): LingCppControlSymbol[] {
  const allowedKinds = new Set(parameter.controlKinds?.length ? parameter.controlKinds : ['visual']);
  return symbols.filter(symbol => allowedKinds.has(symbol.kind));
}

function filterTypeCompatibleSymbols(symbols: LingCppControlSymbol[], parameter: ModuleCommandBindingParameter): LingCppControlSymbol[] {
  const allowedTypes = new Set((parameter.controlTypes || []).map(normalizeIdentifier));
  return symbols.filter(symbol => (
    allowedTypes.size === 0
    || allowedTypes.has(normalizeIdentifier(symbol.controlType))
    || Boolean(symbol.designerType && allowedTypes.has(normalizeIdentifier(symbol.designerType)))
  ));
}

function describeControlKind(kind: string): string {
  if (kind === 'visual') return '可视控件';
  if (kind === 'nonVisual') return '非可视组件';
  if (kind === 'resource') return '设计器资源';
  return kind;
}

function buildBindingIndex(moduleContext: LingCppModuleContext): Map<string, ResolvedBinding> {
  const result = new Map<string, ResolvedBinding>();
  (moduleContext.enabledModules || []).filter(module => module.diagnostics.length === 0).forEach(module => {
    const commands = module.manifest.contributes?.commands || [];
    (module.manifest.bindings?.commands || []).forEach(binding => {
      const contribution = commands.find(command => command.name === binding.command);
      [binding.command, ...(contribution?.aliases || [])].forEach(name => {
        result.set(normalizeIdentifier(name), { binding, canonicalName: binding.command });
      });
    });
  });
  return result;
}

function parseInvocations(source: string): ParsedInvocation[] {
  const result: ParsedInvocation[] = [];
  let index = 0;
  while (index < source.length) {
    if (source[index] === '@' && /^\s*$/u.test(source.slice(source.lastIndexOf('\n', index - 1) + 1, index))) {
      const lineEnd = source.indexOf('\n', index);
      index = lineEnd < 0 ? source.length : lineEnd + 1;
      continue;
    }
    const skipped = skipTriviaOrLiteral(source, index);
    if (skipped > index) { index = skipped; continue; }
    if (!isIdentifierStart(source[index] || '')) { index += 1; continue; }
    const nameStart = index;
    index += 1;
    while (index < source.length && isIdentifierPart(source[index] || '')) index += 1;
    const name = source.slice(nameStart, index);
    let cursor = index;
    while (/\s/u.test(source[cursor] || '')) cursor += 1;
    if (source[cursor] !== '(' && source[cursor] !== '（') continue;
    const parsed = parseInvocationArguments(source, cursor);
    if (parsed) {
      result.push({ name, arguments: parsed.arguments });
      index = Math.max(index, cursor + 1);
    }
  }
  return result;
}

function parseInvocationArguments(source: string, openOffset: number): { arguments: ParsedInvocation['arguments']; closeOffset: number } | undefined {
  const argumentsList: ParsedInvocation['arguments'] = [];
  let depth = 0;
  let argumentStart = openOffset + 1;
  let index = openOffset + 1;
  while (index < source.length) {
    const skipped = skipTriviaOrLiteral(source, index);
    if (skipped > index) { index = skipped; continue; }
    const char = source[index];
    if (char === '(' || char === '（' || char === '[' || char === '【' || char === '{') depth += 1;
    else if (char === ')' || char === '）') {
      if (depth === 0) {
        if (index > argumentStart || argumentsList.length > 0) argumentsList.push({ text: source.slice(argumentStart, index), startOffset: argumentStart, endOffset: index });
        return { arguments: argumentsList, closeOffset: index };
      }
      depth -= 1;
    } else if (char === ']' || char === '】' || char === '}') depth = Math.max(0, depth - 1);
    else if ((char === ',' || char === '，') && depth === 0) {
      argumentsList.push({ text: source.slice(argumentStart, index), startOffset: argumentStart, endOffset: index });
      argumentStart = index + 1;
    }
    index += 1;
  }
  argumentsList.push({ text: source.slice(argumentStart), startOffset: argumentStart, endOffset: source.length });
  return { arguments: argumentsList, closeOffset: source.length };
}

function skipTriviaOrLiteral(source: string, start: number): number {
  const char = source[start];
  if (char === '"' || char === '“') {
    const close = char === '“' ? '”' : '"';
    let index = start + 1;
    while (index < source.length) {
      if (char === '"' && source[index] === '\\') { index += 2; continue; }
      if (source[index] === close) return index + 1;
      index += 1;
    }
    return source.length;
  }
  if (char === "'" || (char === '/' && source[start + 1] === '/')) {
    const end = source.indexOf('\n', start);
    return end < 0 ? source.length : end;
  }
  return start;
}

function selectDesignerWindows(project: LingWindowProject, source: string, filePath?: string, sourceClassNames?: ReadonlySet<string>): LingWindowModel[] {
  const associatedFile = extractAssociatedDesignerFile(source);
  if (associatedFile) {
    const byDesignerFile = project.windows.filter(window => normalizePathName(window.fileName) === normalizePathName(associatedFile));
    return byDesignerFile;
  }
  const classNames = sourceClassNames || new Set(parseLingCpp(source).program.classes.map(item => normalizeIdentifier(item.name)));
  const byClass = project.windows.filter(window => classNames.has(normalizeIdentifier(window.className)));
  if (byClass.length) return byClass;
  const normalizedPath = filePath?.replace(/\\/gu, '/').toLocaleLowerCase();
  if (!normalizedPath) return project.windows;
  return project.windows.filter(window => normalizedPath.endsWith(`${window.className}.lcpp`.toLocaleLowerCase())
    || normalizedPath.endsWith(window.fileName.replace(/\.xml$/iu, '.lcpp').toLocaleLowerCase()));
}

function controlToSymbol(
  project: LingWindowProject,
  window: LingWindowModel,
  control: LingControl,
  moduleContext?: LingCppModuleContext
): LingCppControlSymbol {
  const definition = getWin32ControlDefinition(control.type);
  const moduleDefinition = (moduleContext?.enabledModules || [])
    .flatMap(module => module.manifest.contributes?.designerControls || [])
    .find(candidate => candidate.type === control.type
      || Boolean(control.designerType && candidate.namespacedType === control.designerType));
  return {
    projectId: project.id,
    windowId: window.id,
    windowName: window.title || window.className,
    controlId: control.id,
    name: control.name,
    controlType: control.type,
    designerType: control.designerType,
    kind: definition?.isVisual === false || moduleDefinition?.isVisual === false ? 'nonVisual' : 'visual'
  };
}

function resourceToSymbols(project: LingWindowProject, resource: LingDesignerResource): LingCppControlSymbol[] {
  const explicitOwner = 'ownerWindowId' in resource && typeof resource.ownerWindowId === 'string'
    ? resource.ownerWindowId
    : undefined;
  const targetOwner = 'targetControlId' in resource && typeof resource.targetControlId === 'string'
    ? project.windows.find(window => window.controls.some(control => control.id === resource.targetControlId))?.id
    : undefined;
  const ownerIds = explicitOwner || targetOwner
    ? [explicitOwner || targetOwner!]
    : project.windows.map(window => window.id);
  return ownerIds.flatMap(windowId => {
    const window = project.windows.find(item => item.id === windowId);
    if (!window) return [];
    return [{
      projectId: project.id,
      windowId,
      windowName: window.title || window.className,
      controlId: resource.id,
      name: resource.name,
      controlType: resource.type,
      kind: 'resource' as const
    }];
  });
}

function extractAssociatedDesignerFile(source: string): string | undefined {
  return source.match(/(?:关联设计文件|DesignerFile)\s*=\s*["']([^"']+\.xml)["']/iu)?.[1]?.trim();
}

function normalizePathName(value: string): string {
  return value.replace(/\\/gu, '/').split('/').at(-1)?.toLocaleLowerCase() || '';
}

function getLineStarts(source: string): number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) if (source[index] === '\n') starts.push(index + 1);
  return starts;
}

function rangeFromOffsets(lineStarts: number[], startOffset: number, endOffset: number): LingCppControlReferenceRange {
  const start = positionFromOffset(lineStarts, startOffset);
  const end = positionFromOffset(lineStarts, endOffset);
  return { startOffset, endOffset, startLine: start.line, startColumn: start.column, endLine: end.line, endColumn: end.column };
}

function positionFromOffset(lineStarts: number[], offset: number): { line: number; column: number } {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if ((lineStarts[middle] || 0) <= offset) low = middle + 1;
    else high = middle - 1;
  }
  const lineIndex = Math.max(0, high);
  return { line: lineIndex + 1, column: offset - (lineStarts[lineIndex] || 0) + 1 };
}

function offsetAt(source: string, line: number, column: number): number {
  const starts = getLineStarts(source);
  return Math.min(source.length, (starts[Math.max(0, line - 1)] || 0) + Math.max(0, column - 1));
}

function positionInsideRange(line: number, column: number, range: LingCppControlReferenceRange): boolean {
  if (line < range.startLine || line > range.endLine) return false;
  if (line === range.startLine && column < range.startColumn) return false;
  if (line === range.endLine && column > range.endColumn) return false;
  return true;
}

function isIdentifierStart(value: string): boolean {
  return /[\p{L}_]/u.test(value);
}

function isIdentifierPart(value: string): boolean {
  return /[\p{L}\p{N}_]/u.test(value);
}
