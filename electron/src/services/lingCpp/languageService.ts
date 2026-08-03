import { isLingCppCommentLine, LING_CPP_KEYWORDS, LING_CPP_TYPES, normalizeIdentifier, parseLingCpp } from './parser';
import { LIST_VIEW_ADVANCED_API } from '../modules/listViewApiCatalog';
import { DATA_GRID_API } from '../modules/dataGridApiCatalog';
import {
  createLingCppCatalogItem,
  dedupeLingCppCompletionItems,
  getEnabledLingCppModuleContributions,
  getLingCppCompletionCatalog as getCatalogCompletionItems,
  getLingCppModuleCompletionItems,
  rankLingCppCompletionItems
} from './completionCatalog';
import {
  LingCppAstNode,
  LingCppClass,
  LingCppConstant,
  LingCppCompletionCatalogItem,
  LingCppCompletionContext,
  LingCppCompletionContextKind,
  LingCppCompletionItem,
  LingCppDesignerBindingHint,
  LingCppDiagnostic,
  LingCppDocumentSymbol,
  LingCppEventBlockHighlight,
  LingCppFoldingRange,
  LingCppGlobalVariable,
  LingCppInlineHint,
  LingCppMethod,
  LingCppProblem,
  LingCppProgram,
  LingCppProjectGlobalContext,
  LingCppProjectFunctionContext,
  LingCppProjectTypeContext,
  LingCppQuickAction,
  LingCppHover,
  LingCppReadableActionSummary,
  LingCppReadableBlock,
  LingCppReadableBlockKind,
  LingCppReadingMode,
  LingCppLanguageContext,
  LingCppStructuredReadingRow,
  LingCppStatement,
  ReadableEventName,
  LingCppStructureNode
} from './types';
import { applyLingCppAstEdit } from './astEditService';
import { LingDesignerResource, LingFileDialogResource, LingMenuResource, LingWindowModel, LingWindowProject } from '../windowDesigner/types';
import { LingCppModuleContext, ModuleCommandBinding } from '../modules/types';
import { THREADING_LEGACY_COMMANDS } from '../modules/threadingModule';
import {
  formatWindowEventParameters,
  getWindowEventDefinition,
  getWindowEventHandlerName,
  WINDOW_EVENT_DEFINITIONS
} from '../windowDesigner/windowEventRegistry';
import { getWin32ControlDefinition } from '../windowDesigner/win32ControlRegistry';
import { areLingCppTypesCompatible, inferLingCppExpressionType } from './expressionTypeService';
import { parseLingCppControlFlowLine } from './controlFlow';
import { getProjectGlobalDiagnostics, isProjectGlobalsFilePath, projectSymbolTypes } from './projectGlobalService';
import { getProjectDataTypeDiagnostics, getProjectDataTypeNames, resolveProjectFieldPathType } from './projectDataTypeService';
import { createEffectiveLingCppTypeContext, getEnabledModuleStructuredTypeDiagnostics } from '../modules/modulePublicTypeService';
import { getFunctionLibraryCompletionItems, getFunctionLibraryDiagnostics } from './functionLibraryService';
import {
  getLingCppControlReferenceAtPosition,
  getLingCppControlReferenceCompletion,
  getLingCppControlReferenceDiagnostics
} from './controlReferenceService';
import {
  formatModuleDesignerEventParameters,
  getModuleDesignerEventParameterType,
  getModuleDesignerEvents,
  resolveModuleDesignerEvent
} from '../modules/moduleDesignerEventService';

const KEYWORD = {
  package: '包',
  use: '使用',
  class: '类',
  functionLibrary: '功能库',
  public: '公开',
  private: '私有',
  protected: '保护',
  constructor: '构造',
  destructor: '析构',
  event: '事件',
  if: '如果',
  ifEnd: '如果结束',
  loop: '循环',
  loopEnd: '循环结束',
  classEnd: '结束类',
  functionLibraryEnd: '结束功能库'
};

const METHOD_KEYWORDS = [KEYWORD.constructor, KEYWORD.destructor, KEYWORD.event, ...LING_CPP_TYPES];
const ACCESS_KEYWORDS = [KEYWORD.public, KEYWORD.private, KEYWORD.protected];

export function getLingCppSymbols(source: string): LingCppDocumentSymbol[] {
  const parsed = parseLingCpp(source);
  const lines = splitLines(source);
  const classEnds = findClassEndLines(lines);
  const methodEnds = findMethodEndLines(lines);
  const symbols: LingCppDocumentSymbol[] = [];

  if (parsed.program.packageName) {
    const packageLine = findFirstKeywordLine(lines, KEYWORD.package) || 1;
    symbols.push({
      name: parsed.program.packageName,
      kind: 'package',
      line: packageLine,
      endLine: packageLine
    });
  }

  parsed.program.uses.forEach(useName => {
    const useLine = findLineContaining(lines, KEYWORD.use, useName);
    symbols.push({
      name: useName,
      kind: 'use',
      line: useLine,
      endLine: useLine
    });
  });

  parsed.program.globals.forEach(global => symbols.push({
    name: global.name,
    detail: global.type,
    kind: 'global',
    line: global.line,
    endLine: global.line
  }));

  parsed.program.dataTypes.forEach(dataType => symbols.push({
    name: dataType.name,
    detail: '项目自定义数据类型',
    kind: 'data-type',
    line: dataType.line,
    endLine: dataType.endLine || dataType.line,
    children: dataType.fields.map(field => ({
      name: field.name,
      detail: `${field.type}${field.isArray ? '[]' : ''}`,
      kind: 'data-field',
      line: field.line,
      endLine: field.line
    }))
  }));

  parsed.program.functionLibraries.forEach(library => symbols.push({
    name: library.name,
    detail: '项目功能库',
    kind: 'function-library',
    line: library.line,
    endLine: library.endLine || library.line,
    children: library.methods.map(method => ({
      name: method.name,
      detail: `${method.access} · ${method.returnType}`,
      kind: 'method',
      line: method.line,
      endLine: method.endLine || method.line
    }))
  }));

  parsed.program.classes.forEach(cls => {
    const classSymbol: LingCppDocumentSymbol = {
      name: cls.name,
      detail: cls.baseClass,
      kind: 'class',
      line: cls.line,
      endLine: classEnds.get(cls.line) || cls.endLine || cls.line,
      children: []
    };

    cls.members.forEach(member => {
      classSymbol.children?.push({
        name: member.name,
        detail: member.type,
        kind: 'member',
        line: member.line,
        endLine: member.line
      });
    });

    cls.methods.forEach(method => {
      classSymbol.children?.push({
        name: method.name,
        detail: method.returnType,
        kind: method.kind,
        line: method.line,
        endLine: methodEnds.get(method.line) || method.endLine || method.line
      });
    });

    symbols.push(classSymbol);
  });
  return symbols;
}

export function getLingCppFoldingRanges(source: string): LingCppFoldingRange[] {
  const lines = splitLines(source);
  const ranges: LingCppFoldingRange[] = [];
  const classStack: number[] = [];
  const functionLibraryStack: number[] = [];
  const controlStack: Array<{ family: string; line: number }> = [];
  let activeMethodLine: number | null = null;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (activeMethodLine && (isMethodStart(trimmed) || isAccessLine(trimmed) || isClassEnd(trimmed) || isFunctionLibraryEnd(trimmed))) {
      addRange(ranges, activeMethodLine, lineNumber - 1);
      activeMethodLine = null;
    }

    if (isClassStart(trimmed)) {
      classStack.push(lineNumber);
      return;
    }

    if (isClassEnd(trimmed)) {
      const startLine = classStack.pop();
      if (startLine) addRange(ranges, startLine, lineNumber);
      return;
    }

    if (isFunctionLibraryStart(trimmed)) {
      functionLibraryStack.push(lineNumber);
      return;
    }

    if (isFunctionLibraryEnd(trimmed)) {
      const startLine = functionLibraryStack.pop();
      if (startLine) addRange(ranges, startLine, lineNumber);
      return;
    }

    if (isMethodStart(trimmed)) {
      activeMethodLine = lineNumber;
      return;
    }

    const control = parseLingCppControlFlowLine(trimmed);
    if (control?.family && control.role === 'start') {
      controlStack.push({ family: control.family, line: lineNumber });
      return;
    }

    if (control?.family && control.role === 'end') {
      let stackIndex = -1;
      for (let index = controlStack.length - 1; index >= 0; index -= 1) {
        if (controlStack[index]?.family === control.family) {
          stackIndex = index;
          break;
        }
      }
      if (stackIndex >= 0) {
        const [start] = controlStack.splice(stackIndex, 1);
        if (start) addRange(ranges, start.line, lineNumber);
      }
    }
  });

  if (activeMethodLine) addRange(ranges, activeMethodLine, lines.length);
  getSemanticFoldingRanges(source).forEach(range => addRange(ranges, range.startLine, range.endLine));
  return dedupeFoldingRanges(ranges);
}

export function getLingCppSemanticDiagnostics(
  source: string,
  designerProject?: LingWindowProject,
  filePath?: string,
  moduleContext?: LingCppModuleContext,
  projectGlobals?: LingCppProjectGlobalContext,
  projectTypes?: LingCppProjectTypeContext,
  projectFunctions?: LingCppProjectFunctionContext
): LingCppDiagnostic[] {
  const parsed = parseLingCpp(source);
  const effectiveTypes = createEffectiveLingCppTypeContext(projectTypes, moduleContext);
  const diagnostics = [...parsed.diagnostics, ...getBlockDiagnostics(source)];
  diagnostics.push(...getProjectGlobalDiagnostics(source, filePath, moduleContext, getProjectDataTypeNames(effectiveTypes)));
  diagnostics.push(...getProjectDataTypeDiagnostics(source, filePath, moduleContext, parsed.program.classes.map(cls => cls.name)));
  getEnabledModuleStructuredTypeDiagnostics(moduleContext).forEach(message => diagnostics.push(createDiagnostic(
    'error', 1, '', message, '请禁用其中一个冲突模块，或让模块作者修改公开类型名称。'
  )));
  diagnostics.push(...getModuleUsageDiagnostics(source, moduleContext));
  diagnostics.push(...getModuleHandlerDiagnostics(source, parsed.program, moduleContext));
  diagnostics.push(...getLingCppControlReferenceDiagnostics(source, designerProject, moduleContext, filePath));
  const effectiveConstants = isProjectGlobalsFilePath(filePath) ? parsed.program.constants : (projectGlobals?.constants || []);
  const effectiveGlobals = isProjectGlobalsFilePath(filePath) ? parsed.program.globals : (projectGlobals?.globals || []);
  diagnostics.push(...getThreadingDiagnostics(source, parsed.program, moduleContext, effectiveGlobals, effectiveTypes));
  diagnostics.push(...getVariableDiagnostics([
    ...parsed.program.classes,
    ...parsed.program.functionLibraries.map(library => ({ name: library.name, line: library.line, endLine: library.endLine, members: [], methods: library.methods }))
  ], moduleContext, effectiveConstants, effectiveGlobals, effectiveTypes));
  diagnostics.push(...getUnknownDeclaredTypeDiagnostics(parsed.program, moduleContext, effectiveTypes));
  const functionLibraryDiagnostics = getFunctionLibraryDiagnostics(source, filePath, projectFunctions);
  diagnostics.push(...functionLibraryDiagnostics.filter(diagnostic => !isDesignerControlMethodDiagnostic(diagnostic, source, designerProject, filePath)));

  if (designerProject) {
    getLingCppDesignerBindings(source, designerProject, filePath, moduleContext).forEach(hint => {
      if (hint.status === 'bound' || hint.status === 'missing-source') return;
      diagnostics.push({
        id: `lingcpp-designer-${hint.status}-${hint.handlerName}-${hint.line}`,
        line: hint.line,
        level: 'warning',
        message: hint.message,
        codeSnippet: hint.handlerName,
        suggestion: hint.suggestion
      });
    });

    const currentWindows = selectDesignerWindows(designerProject, source, filePath);
    diagnostics.push(...getModuleDesignerEventDiagnostics(parsed.program, currentWindows, moduleContext));
    const windowEventByHandler = new Map<string, string>();
    currentWindows.forEach(window => {
      Object.entries(window.events || {}).forEach(([eventName, handler]) => {
        if (handler.trim()) windowEventByHandler.set(normalizeIdentifier(handler), eventName);
      });
      windowEventByHandler.set(
        normalizeIdentifier(getWindowEventHandlerName(window.className, 'Loaded')),
        'Loaded'
      );
      windowEventByHandler.set(normalizeIdentifier(`${window.className}_创建完毕`), 'Loaded');
    });
    const windowHandlers = new Set(windowEventByHandler.keys());
    parsed.program.classes.flatMap(cls => cls.methods).forEach(method => {
      if (method.kind !== 'event' || !windowHandlers.has(normalizeIdentifier(method.name))) return;
      const eventName = windowEventByHandler.get(normalizeIdentifier(method.name)) || '';
      const definition = getWindowEventDefinition(eventName);
      if (!definition) return;
      const expectedParameters = definition.parameters || [];
      const actualParameters = method.parameters;
      const matchesExpected = actualParameters.length === expectedParameters.length
        && expectedParameters.every((expected, index) => normalizeWindowEventType(expected.type) === normalizeWindowEventType(actualParameters[index]?.type || ''));
      // Parameterized events accept an empty legacy handler so existing projects can migrate incrementally.
      if (actualParameters.length === 0 && expectedParameters.length > 0) return;
      if (matchesExpected) return;
      const expectedSignature = expectedParameters.length
        ? `事件 ${method.name}(${formatWindowEventParameters(eventName)})`
        : `事件 ${method.name}()`;
      diagnostics.push({
        id: `lingcpp-window-event-parameters-${method.name}-${method.line}`,
        line: method.line,
        level: 'error',
        message: `窗口事件 ${method.name} 的参数与 ${eventNameLabel(eventName)} 事件契约不匹配。`,
        codeSnippet: method.name,
        suggestion: `请改为 ${expectedSignature}；旧的无参数处理器仍可继续使用“窗口_取事件…”上下文命令。`
      });
    });
  }

  return dedupeDiagnostics(diagnostics);
}

export function buildLingCppLanguageContext(
  source: string,
  designerProject?: LingWindowProject,
  moduleContext?: LingCppModuleContext,
  filePath?: string,
  projectGlobals?: LingCppProjectGlobalContext,
  projectTypes?: LingCppProjectTypeContext,
  projectFunctions?: LingCppProjectFunctionContext
): LingCppLanguageContext {
  const parsed = parseLingCpp(source);
  const designerBindings = getLingCppDesignerBindings(source, designerProject, filePath, moduleContext);
  const effectiveTypes = createEffectiveLingCppTypeContext(projectTypes, moduleContext);
  return {
    source,
    filePath,
    ast: parsed.ast,
    program: parsed.program,
    symbolIndex: parsed.symbolIndex,
    diagnostics: getLingCppSemanticDiagnostics(source, designerProject, filePath, moduleContext, projectGlobals, projectTypes, projectFunctions),
    designerBindings,
    designerProject,
    moduleContext,
    moduleContributions: getLingCppModuleCompletionItems(moduleContext),
    projectGlobals,
    projectTypes: effectiveTypes,
    projectFunctions
  };
}

export function getLingCppCompletions(context: LingCppCompletionContext, moduleContext?: LingCppModuleContext): LingCppCompletionItem[] {
  const languageContext = buildLingCppLanguageContext(context.source, undefined, moduleContext);
  return getLingCppCompletionItems(context, languageContext);
}

export function getLingCppBilingualCompletions(
  context: LingCppCompletionContext,
  designerProject?: LingWindowProject,
  moduleContext?: LingCppModuleContext
): LingCppCompletionItem[] {
  const languageContext = buildLingCppLanguageContext(context.source, designerProject, moduleContext);
  return getLingCppCompletionItems(context, languageContext);
}

export function getLingCppCompletionItems(
  context: LingCppCompletionContext,
  languageContext = buildLingCppLanguageContext(context.source)
): LingCppCompletionItem[] {
  const controlReferenceCompletion = getLingCppControlReferenceCompletion(
    context.source,
    context.line,
    context.column,
    languageContext.designerProject as LingWindowProject | undefined,
    languageContext.moduleContext,
    languageContext.filePath
  );
  if (controlReferenceCompletion) {
    return dedupeLingCppCompletionItems(controlReferenceCompletion.symbols.map(symbol => ({
      label: symbol.name,
      kind: 'type' as const,
      insertText: symbol.name,
      detail: `${symbol.kind === 'resource' ? '设计器资源' : '设计器控件'} · ${symbol.controlType}`,
      documentation: `窗口：${symbol.windowName}\n名称：${symbol.name}\n类型：${symbol.controlType}\n参数：${controlReferenceCompletion.parameter.name}`,
      aliases: [symbol.controlType, symbol.windowName, '控件', '组件'],
      category: 'designer' as const
    })), context.triggerText);
  }
  const contextKind = getLingCppCompletionContextKind(context.source, context.line, context.column);
  const projectFieldItems = getProjectFieldCompletionItems(context, languageContext);
  if (projectFieldItems) return dedupeLingCppCompletionItems(projectFieldItems, context.triggerText);
  const functionLibraryItems = getFunctionLibraryCompletionItems(context, languageContext.projectFunctions);
  const lineText = context.source.split(/\r?\n/u)[context.line - 1] || '';
  if (/\p{L}[\p{L}\p{N}_]*\s*\.\s*[\p{L}\p{N}_]*$/u.test(lineText.slice(0, Math.max(0, context.column - 1)))) {
    return dedupeLingCppCompletionItems(functionLibraryItems, context.triggerText);
  }
  const symbolItems = getCurrentSymbolCompletionItems(languageContext, context.line);
  const designerProject = languageContext.designerProject as LingWindowProject | undefined;
  const windowPlacementItems = getOpenWindowPlacementCompletionItems(context);
  if (windowPlacementItems) {
    return dedupeLingCppCompletionItems(windowPlacementItems, context.triggerText);
  }
  const windowTargetItems = getOpenWindowTargetCompletionItems(context, designerProject);
  if (windowTargetItems) {
    return dedupeLingCppCompletionItems(windowTargetItems, context.triggerText);
  }
  const designerItems = getDesignerCompletionItems(context.source, designerProject, languageContext.moduleContext);
  const moduleItems = languageContext.moduleContributions;
  const catalogItems = getCatalogCompletionItems(contextKind);
  return dedupeLingCppCompletionItems(
    rankLingCppCompletionItems([...functionLibraryItems, ...symbolItems, ...designerItems, ...moduleItems, ...catalogItems], contextKind),
    context.triggerText
  );
}

export function getLingCppHover(
  context: LingCppCompletionContext,
  languageContext = buildLingCppLanguageContext(context.source)
): LingCppHover | undefined {
  const controlReference = getLingCppControlReferenceAtPosition(
    context.source,
    context.line,
    context.column,
    languageContext.designerProject as LingWindowProject | undefined,
    languageContext.moduleContext,
    languageContext.filePath
  );
  if (controlReference?.symbol) {
    return {
      line: context.line,
      column: context.column,
      range: {
        startLine: controlReference.range.startLine,
        startColumn: controlReference.range.startColumn,
        endLine: controlReference.range.endLine,
        endColumn: controlReference.range.endColumn
      },
      contents: [
        `**${controlReference.symbol.name}**`,
        `${controlReference.symbol.kind === 'resource' ? '设计器资源' : '设计器控件'} · ${controlReference.symbol.controlType}`,
        `所属窗口：${controlReference.symbol.windowName}`,
        `命令参数：${controlReference.canonicalCommandName} / ${controlReference.parameter.name}`,
        'Ctrl+单击或右键选择“跳转到控件”可在可视化设计器中定位。'
      ].join('\n\n')
    };
  }
  const nodes = languageContext.symbolIndex.byLine[context.line] || [];
  const structuralNode = nodes.find(item => item.kind !== 'program' && item.kind !== 'statement');
  if (structuralNode) {
    return {
      line: context.line,
      column: context.column,
      range: structuralNode.range,
      contents: hoverTextForAstNode(structuralNode)
    };
  }

  const hoveredWord = getLingCppWordAtPosition(context.source, context.line, context.column);
  if (hoveredWord) {
    const completion = getLingCppCompletionItems({
      ...context,
      triggerText: hoveredWord.text
    }, languageContext).find(item => item.label === hoveredWord.text);
    if (completion) {
      return {
        line: context.line,
        column: context.column,
        range: {
          startLine: context.line,
          startColumn: hoveredWord.startColumn,
          endLine: context.line,
          endColumn: hoveredWord.endColumn
        },
        contents: formatLingCppCompletionHover(completion)
      };
    }
  }

  const node = nodes.find(item => item.kind !== 'program' && item.kind !== 'statement') || nodes[0];
  if (!node) return undefined;
  return {
    line: context.line,
    column: context.column,
    range: node.range,
    contents: hoverTextForAstNode(node)
  };
}

function getLingCppWordAtPosition(
  source: string,
  lineNumber: number,
  columnNumber: number
): { text: string; startColumn: number; endColumn: number } | undefined {
  const line = splitLines(source)[lineNumber - 1];
  if (line === undefined) return undefined;
  const isWordCharacter = (value: string) => /[\p{L}\p{N}_]/u.test(value);
  let offset = Math.max(0, Math.min(line.length, columnNumber - 1));
  if (!isWordCharacter(line[offset] || '') && offset > 0 && isWordCharacter(line[offset - 1])) {
    offset -= 1;
  }
  if (!isWordCharacter(line[offset] || '')) return undefined;
  let start = offset;
  let end = offset + 1;
  while (start > 0 && isWordCharacter(line[start - 1])) start -= 1;
  while (end < line.length && isWordCharacter(line[end])) end += 1;
  return { text: line.slice(start, end), startColumn: start + 1, endColumn: end + 1 };
}

function formatLingCppCompletionHover(item: LingCppCompletionItem): string {
  const signature = item.signature || (item.kind === 'function' ? item.insertText.replace(/\$\d+/gu, '参数') : item.label);
  return [
    `**${signature}**`,
    item.documentation || item.audienceText || item.detail,
    item.returnType ? `返回值：${item.returnType}` : '',
    item.example ? `示例：\`${item.example}\`` : ''
  ].filter(Boolean).join('\n\n');
}

function getProjectFieldCompletionItems(
  context: LingCppCompletionContext,
  languageContext: LingCppLanguageContext
): LingCppCompletionCatalogItem[] | undefined {
  const projectTypes = languageContext.projectTypes;
  if (!projectTypes?.dataTypes.length) return undefined;
  const prefix = (splitLines(context.source)[Math.max(0, context.line - 1)] || '').slice(0, Math.max(0, context.column - 1));
  const access = prefix.match(/([\p{L}_][\p{L}\p{N}_]*(?:\s*\.\s*[\p{L}_][\p{L}\p{N}_]*)*)\s*\.\s*[\p{L}\p{N}_]*$/u);
  if (!access) return undefined;
  const segments = (access[1] || '').split(/\s*\.\s*/u);
  const root = segments.shift() || '';
  const scope = new Map<string, string>();
  (languageContext.projectGlobals?.globals || []).forEach(global => scope.set(normalizeIdentifier(global.name), global.type));
  languageContext.program.classes.forEach(cls => {
    if (context.line < cls.line || context.line > (cls.endLine || Number.MAX_SAFE_INTEGER)) return;
    cls.members.forEach(member => scope.set(normalizeIdentifier(member.name), member.type));
    cls.methods.forEach(method => {
      if (context.line < method.line || context.line > (method.endLine || method.line)) return;
      method.parameters.forEach(parameter => scope.set(normalizeIdentifier(parameter.name), parameter.type));
      (method.locals || []).filter(local => local.line <= context.line).forEach(local => scope.set(normalizeIdentifier(local.name), local.type));
    });
  });
  const ownerTypeName = resolveProjectFieldPathType(scope.get(normalizeIdentifier(root)), segments, projectTypes);
  const owner = projectTypes.dataTypes.find(dataType => normalizeIdentifier(dataType.name) === normalizeIdentifier(ownerTypeName || ''));
  if (!owner) return undefined;
  return owner.fields.map(field => createLingCppCatalogItem({
    label: field.name,
    kind: 'type',
    insertText: field.name,
    detail: `${owner.name} 字段 · ${field.type}${field.isArray ? '[]' : ''}`,
    documentation: field.note || (owner.origin === 'module'
      ? `模块 ${owner.sourceModuleName || owner.sourceModuleId || '未知模块'} 公开记录 ${owner.name} 的字段。`
      : `项目自定义数据类型 ${owner.name} 的字段。`),
    category: 'symbol',
    source: 'symbol',
    sortRank: 0
  }));
}

function getCurrentSymbolCompletionItems(languageContext: LingCppLanguageContext, line: number): LingCppCompletionCatalogItem[] {
  const activeMethodNode = [
    ...languageContext.symbolIndex.methods,
    ...languageContext.symbolIndex.events
  ].find(node => line >= node.range.startLine && line <= node.range.endLine);
  const nodes = [
    ...languageContext.symbolIndex.constants,
    ...languageContext.symbolIndex.classes,
    ...languageContext.symbolIndex.members,
    ...languageContext.symbolIndex.locals.filter(node => activeMethodNode && node.parentId === activeMethodNode.id),
    ...languageContext.symbolIndex.methods,
    ...languageContext.symbolIndex.events
  ];
  const currentItems = nodes
    .filter(node => Boolean(node.name?.trim()))
    .map(node => createLingCppCatalogItem({
      label: node.name,
      kind: completionKindForAstNode(node),
      insertText: node.kind === 'method' || node.kind === 'event' ? `${node.name}($1)` : node.name,
      detail: symbolDetailForAstNode(node),
      documentation: `当前源码符号：${node.name}\n第 ${node.range.startLine} 行`,
      category: 'symbol',
      source: 'symbol',
      sortRank: 0,
      isSnippet: node.kind === 'method' || node.kind === 'event'
    }));
  const constantItems = (languageContext.projectGlobals?.constants || languageContext.program.constants)
    .map(constant => createLingCppCatalogItem({
      label: constant.name,
      kind: 'type',
      insertText: constant.name,
      detail: `项目常量 · ${constant.type}`,
      documentation: `项目常量：${constant.name}\n类型：${constant.type}\n值：${constant.initialValue}\n文件：${languageContext.projectGlobals?.filePath || languageContext.filePath || '项目全局变量.lcpp'}`,
      category: 'symbol',
      source: 'symbol',
      sortRank: 0
    }));
  const globalItems = (languageContext.projectGlobals?.globals || languageContext.program.globals)
    .map(global => createLingCppCatalogItem({
      label: global.name,
      kind: 'type',
      insertText: global.name,
      detail: `项目全局变量 · ${global.type}`,
      documentation: `项目全局变量：${global.name}\n类型：${global.type}\n文件：${languageContext.projectGlobals?.filePath || languageContext.filePath || '项目全局变量.lcpp'}`,
      category: 'symbol',
      source: 'symbol',
      sortRank: 0
    }));
  const projectTypeItems = (languageContext.projectTypes?.dataTypes || languageContext.program.dataTypes)
    .filter(dataType => dataType.origin !== 'module')
    .map(dataType => createLingCppCatalogItem({
    label: dataType.name,
    kind: 'type',
    insertText: dataType.name,
    detail: '项目自定义数据类型',
    documentation: `记录型值类型：${dataType.name}\n字段：${dataType.fields.map(field => `${field.type}${field.isArray ? '[]' : ''} ${field.name}`).join('、') || '无'}\n文件：${languageContext.projectTypes?.filePath || languageContext.filePath || '项目数据类型.lcpp'}`,
    category: 'symbol',
    source: 'symbol',
    sortRank: 0
  }));
  return [...projectTypeItems, ...constantItems, ...globalItems, ...currentItems];
}

function completionKindForAstNode(node: LingCppAstNode): LingCppCompletionItem['kind'] {
  if (node.kind === 'class') return 'type';
  if (node.kind === 'constant' || node.kind === 'global' || node.kind === 'member' || node.kind === 'local') return 'type';
  if (node.kind === 'event') return 'event';
  if (node.kind === 'method' || node.kind === 'constructor' || node.kind === 'destructor') return 'function';
  return 'keyword';
}

function symbolDetailForAstNode(node: LingCppAstNode): string {
  if (node.kind === 'class') return node.type ? `当前源码类 · 继承 ${node.type}` : '当前源码类';
  if (node.kind === 'function-library') return '当前项目功能库 · 无状态';
  if (node.kind === 'constant') return `项目常量 · ${node.type || '未标注类型'}`;
  if (node.kind === 'global') return `项目全局变量 · ${node.type || '未标注类型'}`;
  if (node.kind === 'member') return `当前成员 · ${node.type || '未标注类型'}`;
  if (node.kind === 'local') return `${node.isConstant ? '当前子程序局部常量（只读）' : '当前子程序局部变量'} · ${node.type || '未标注类型'}`;
  if (node.kind === 'event') return '当前事件处理器';
  if (node.kind === 'method' || node.kind === 'constructor' || node.kind === 'destructor') return `当前方法 · ${node.returnType || '空'}`;
  return '当前源码符号';
}

function hoverTextForAstNode(node: LingCppAstNode): string {
  if (node.kind === 'package') return `包：${node.name}`;
  if (node.kind === 'use') return `使用：${node.name}`;
  if (node.kind === 'constant') return `项目常量：${node.name}\n类型：${node.type || '未标注'}\n值：${node.value || ''}\n作用域：当前项目（只读）`;
  if (node.kind === 'global') return `项目全局变量：${node.name}\n类型：${node.type || '未标注'}\n作用域：当前项目`;
  if (node.kind === 'class') return node.type ? `类：${node.name}\n基础类：${node.type}` : `类：${node.name}`;
  if (node.kind === 'function-library') return `功能库：${node.name}\n作用域：当前项目\n调用：${node.name}.功能名(...)`;
  if (node.kind === 'member') return `成员：${node.name}\n类型：${node.type || '未标注'}\n访问：${node.access || '私有'}`;
  if (node.kind === 'local') return `${node.isConstant ? '局部常量' : '局部变量'}：${node.name}\n类型：${node.type || '未标注'}\n作用域：当前子程序${node.isConstant ? '\n状态：只读，运行时初始化一次' : ''}`;
  if (node.kind === 'event') return `事件处理器：${node.name}`;
  if (node.kind === 'constructor') return `构造函数：${node.name}`;
  if (node.kind === 'destructor') return `析构函数：${node.name}`;
  if (node.kind === 'method') return `方法：${node.name}\n返回：${node.returnType || '空'}`;
  if (node.kind === 'parameter') return `参数：${node.name}\n类型：${node.type || '对象'}`;
  if (node.kind === 'comment') return `备注：${node.value || node.name}`;
  return node.value || node.name;
}

export function getLingCppCompletionContextKind(source: string, line: number, _column: number): LingCppCompletionContextKind {
  const parsed = parseLingCpp(source);
  const lines = splitLines(source);
  const classEnds = findClassEndLines(lines);
  const methodEnds = findMethodEndLines(lines);
  const targetLine = Math.max(1, Math.min(line, Math.max(1, lines.length)));
  const targetText = lines[targetLine - 1]?.trim() || '';

  for (const cls of parsed.program.classes) {
    const classEnd = classEnds.get(cls.line) || cls.endLine || lines.length;
    if (targetLine < cls.line || targetLine > classEnd) continue;

    for (const method of cls.methods) {
      const methodEnd = methodEnds.get(method.line) || method.endLine || method.statements.at(-1)?.line || method.line;
      if (targetLine >= method.line && targetLine <= methodEnd) {
        return method.kind === 'event' ? 'event-body' : 'method-body';
      }
    }

    if (
      cls.members.some(member => Math.abs(member.line - targetLine) <= 1)
      || /文本型|整数型|按钮|标签|输入框|鏂囨湰鍨|鏁存暟鍨|鎸夐挳|鏍囩/u.test(targetText)
    ) {
      return 'member-section';
    }
    return 'class-body';
  }
  for (const library of parsed.program.functionLibraries) {
    if (targetLine < library.line || targetLine > (library.endLine || lines.length)) continue;
    for (const method of library.methods) {
      const methodEnd = methodEnds.get(method.line) || method.endLine || method.statements.at(-1)?.line || method.line;
      if (targetLine >= method.line && targetLine <= methodEnd) return 'method-body';
    }
    return 'class-body';
  }

  return 'top-level';
}

export function getLingCppProblems(
  source: string,
  designerProject?: LingWindowProject,
  filePath = 'src/未命名.lcpp',
  moduleContext?: LingCppModuleContext
): LingCppProblem[] {
  const parseDiagnostics = getLingCppSemanticDiagnostics(source, designerProject, filePath, moduleContext);
  const parserProblems = parseDiagnostics
    .filter(diagnostic => !diagnostic.id.startsWith('lingcpp-designer-'))
    .map(diagnostic => ({
    id: diagnostic.id,
    filePath,
    line: diagnostic.line,
    level: diagnostic.level,
    source: diagnostic.id.startsWith('lingcpp-language') ? 'block' as const : 'parser' as const,
    message: diagnostic.message,
    codeSnippet: diagnostic.codeSnippet,
    suggestion: diagnostic.suggestion,
    actionKind: 'none' as const
    }));

  const designerProblems = designerProject
    ? getLingCppDesignerBindings(source, designerProject, filePath, moduleContext)
      .filter(binding => binding.status !== 'bound')
      .map(binding => ({
        id: `lingcpp-problem-${binding.status}-${binding.handlerName}-${binding.line}`,
        filePath,
        line: binding.targetLine || binding.line,
        level: binding.status === 'missing-control' ? 'warning' as const : 'info' as const,
        source: 'designer' as const,
        message: problemMessageForBinding(binding),
        codeSnippet: binding.handlerName,
        suggestion: problemSuggestionForBinding(binding),
        actionKind: binding.actionKind || actionKindForBinding(binding.status),
        actionLabel: actionLabelForBinding(binding.status),
        locationKind: binding.status === 'missing-source' ? 'insertion' as const : 'source' as const
      }))
    : [];

  return [...parserProblems, ...designerProblems];
}

export function getLingCppQuickActions(problemOrBinding: LingCppProblem | LingCppDesignerBindingHint): LingCppQuickAction[] {
  const actionKind = 'actionKind' in problemOrBinding ? problemOrBinding.actionKind : undefined;
  const kind = actionKind || ('status' in problemOrBinding ? actionKindForBinding(problemOrBinding.status) : 'none');
  if (!kind || kind === 'none') return [];

  return [{
    id: `lingcpp-action-${kind}-${'handlerName' in problemOrBinding ? problemOrBinding.handlerName : problemOrBinding.id}`,
    label: actionLabelForKind(kind),
    kind,
    targetLine: problemOrBinding.line,
    targetControlId: 'targetControlId' in problemOrBinding ? problemOrBinding.targetControlId : undefined,
    description: problemOrBinding.suggestion
  }];
}

export function getLingCppStructureView(
  source: string,
  designerProject?: LingWindowProject,
  filePath?: string,
  moduleContext?: LingCppModuleContext
): LingCppStructureNode[] {
  const parsed = parseLingCpp(source);
  const bindings = getLingCppDesignerBindings(source, designerProject, filePath, moduleContext);
  const bindingByHandler = new Map(bindings.map(binding => [normalizeIdentifier(binding.handlerName), binding]));
  const nodes: LingCppStructureNode[] = [];

  if (parsed.program.packageName) {
    nodes.push({
      id: 'package',
      kind: 'package',
      name: parsed.program.packageName,
      detail: '包',
      line: findFirstKeywordLine(splitLines(source), KEYWORD.package) || 1
    });
  }

  parsed.program.uses.forEach((useName, index) => {
    nodes.push({
      id: `use-${index}-${useName}`,
      kind: 'use',
      name: useName,
      detail: '使用',
      line: findLineContaining(splitLines(source), KEYWORD.use, useName)
    });
  });

  parsed.program.globals.forEach(global => nodes.push({
    id: `global-${global.name}-${global.line}`,
    kind: 'global',
    name: global.name,
    detail: global.type,
    line: global.line
  }));

  parsed.program.classes.forEach(cls => {
    const classNode: LingCppStructureNode = {
      id: `class-${cls.name}-${cls.line}`,
      kind: 'class',
      name: cls.name,
      detail: cls.baseClass ? `基类：${cls.baseClass}` : '类',
      line: cls.line,
      children: []
    };

    const designerFile = extractAssociatedDesignerFile(source);
    if (designerFile) {
      classNode.children?.push({
        id: `designer-${designerFile}`,
        kind: 'designer',
        name: designerFile,
        detail: '关联设计文件',
        line: findLineContainingText(splitLines(source), designerFile) || cls.line
      });
    }

    cls.members.forEach(member => {
      classNode.children?.push({
        id: `member-${member.name}-${member.line}`,
        kind: 'member',
        name: member.name,
        detail: member.type,
        line: member.line
      });
    });

    cls.methods.forEach(method => {
      const binding = bindingByHandler.get(normalizeIdentifier(method.name));
      classNode.children?.push({
        id: `method-${method.name}-${method.line}`,
        kind: method.kind === 'constructor' || method.kind === 'destructor' || method.kind === 'event'
          ? method.kind
          : 'event',
        name: method.name,
        detail: binding?.displayText || method.returnType,
        line: method.line,
        status: binding?.status,
        targetControlId: binding?.targetControlId
      });
    });

    nodes.push(classNode);
  });

  return nodes;
}

export function getLingCppStructuredReadingRows(
  source: string,
  designerProject?: LingWindowProject,
  filePath?: string,
  moduleContext?: LingCppModuleContext
): LingCppStructuredReadingRow[] {
  const parsed = parseLingCpp(source);
  const rows: LingCppStructuredReadingRow[] = [];
  const blocks = getLingCppReadableBlocks(source, designerProject, filePath, moduleContext);
  const blockByLine = new Map(blocks.map(block => [block.startLine, block]));
  const lines = splitLines(source);

  if (parsed.program.packageName) {
    rows.push({
      id: 'reading-package',
      group: 'package',
      name: parsed.program.packageName,
      type: '包名',
      value: parsed.program.packageName,
      note: '项目代码的命名空间入口',
      line: findFirstKeywordLine(lines, KEYWORD.package) || 1
    });
  }

  parsed.program.globals.forEach(global => rows.push({
    id: `reading-global-${global.name}-${global.line}`,
    group: 'global',
    name: global.name,
    type: global.type,
    value: [global.isArray ? '数组' : '', global.initialValue || ''].filter(Boolean).join(' · '),
    note: noteBeforeLine(lines, global.line) || '当前项目全部 LCPP 源码可用',
    line: global.line,
    editable: true,
    editKind: 'global',
    targetName: global.name,
    initialValue: global.initialValue,
    isArray: global.isArray
  }));

  parsed.program.classes.forEach(cls => {
    const classBlock = blockByLine.get(cls.line);
    rows.push({
      id: `reading-class-${cls.name}-${cls.line}`,
      group: 'class',
      name: cls.name,
      type: '类名',
      value: cls.baseClass || '',
      note: cls.baseClass ? `继承 ${cls.baseClass}` : '窗口程序的主要对象',
      line: cls.line,
      blockId: classBlock?.id
    });

    const designerFile = extractAssociatedDesignerFile(source);
    if (designerFile) {
      rows.push({
        id: `reading-designer-${designerFile}`,
        group: 'note',
        name: '关联设计文件',
        type: '设计器',
        value: designerFile,
        note: '当前源码优先匹配这个窗口布局文件',
        line: findLineContainingText(lines, designerFile) || cls.line,
        blockId: classBlock?.id
      });
    }

    cls.members.forEach(member => {
      const sourceNote = noteBeforeLine(lines, member.line);
      rows.push({
        id: `reading-member-${member.name}-${member.line}`,
        group: 'member',
        name: member.name,
        type: member.type,
        value: [
          member.isStatic ? '静态' : '',
          member.isArray ? '数组' : '',
          member.initialValue || ''
        ].filter(Boolean).join(' · '),
        note: sourceNote || memberNote(member.type, member.name),
        line: member.line
      });
    });

    cls.methods.forEach(method => {
      const block = blockByLine.get(method.line);
      const sourceNote = noteBeforeLine(lines, method.line);
      (method.locals || []).forEach(local => {
        rows.push({
          id: `reading-local-${method.name}-${local.name}-${local.line}`,
          group: 'local',
          name: local.name,
          type: local.type,
          value: [local.isConstant ? '只读' : '', local.isArray ? '数组' : '', local.initialValue || ''].filter(Boolean).join(' · '),
          note: `${local.isConstant ? '运行时初始化一次 · ' : ''}仅在 ${method.name} 内有效`,
          line: local.line,
          blockId: block?.id,
          className: cls.name,
          methodName: method.name,
          targetName: local.name,
          initialValue: local.initialValue,
          isArray: local.isArray,
          isConstant: local.isConstant
        });
      });
      if (method.kind === 'event') {
        rows.push({
          id: `reading-event-${method.name}-${method.line}`,
          group: 'event',
          name: block?.readableName?.displayName || method.name,
          type: eventKindLabel(block?.kind || 'custom-event'),
          value: block?.summary || '',
          note: sourceNote || eventNote(block?.kind || 'custom-event', block?.readableName?.subject || method.name),
          line: method.line,
          blockId: block?.id,
          status: block?.bindingStatus,
          access: method.access,
          returnType: method.returnType,
          parameters: method.parameters
        });
        method.parameters.forEach(parameter => {
          rows.push({
            id: `reading-param-${method.name}-${parameter.name}-${method.line}`,
            group: 'parameter',
            name: parameter.name,
            type: parameter.type,
            value: '',
            note: '事件执行时传入的数据',
            line: method.line,
            blockId: block?.id,
            status: block?.bindingStatus
          });
        });
        return;
      }

      rows.push({
        id: `reading-method-${method.name}-${method.line}`,
        group: method.kind === 'constructor' ? 'constructor' : 'event',
        name: method.kind === 'constructor' ? '构造()' : method.name,
        type: method.kind === 'constructor' ? '初始化' : method.returnType,
        value: block?.summary || '',
        note: sourceNote || (method.kind === 'constructor' ? '窗口初始化时执行' : '普通代码逻辑'),
        line: method.line,
        blockId: block?.id,
        access: method.access,
        returnType: method.returnType,
        isStatic: method.isStatic,
        parameters: method.parameters
      });
    });
  });

  return rows.sort((a, b) => a.line - b.line || a.id.localeCompare(b.id));
}

export function getLingCppStructuredRows(languageContext: LingCppLanguageContext): LingCppStructuredReadingRow[] {
  const rows: LingCppStructuredReadingRow[] = [];
  const source = languageContext.source;
  const designerProject = languageContext.designerProject as LingWindowProject | undefined;
  const lines = splitLines(source);
  const blocks = getLingCppReadableBlocks(
    source,
    designerProject,
    languageContext.filePath,
    languageContext.moduleContext
  );
  const blockByLine = new Map(blocks.map(block => [block.startLine, block]));
  const bindingByHandler = new Map(languageContext.designerBindings.map(binding => [normalizeIdentifier(binding.handlerName), binding]));

  if (languageContext.program.packageName) {
    rows.push({
      id: 'structured-declaration-package',
      group: 'declaration',
      name: languageContext.program.packageName,
      type: '包',
      value: languageContext.program.packageName,
      note: '源码声明：项目命名空间入口',
      line: findFirstKeywordLine(lines, KEYWORD.package) || 1,
      editable: true,
      editKind: 'package',
      targetName: languageContext.program.packageName
    });
  }

  languageContext.program.uses.forEach((useName, index) => {
    rows.push({
      id: `structured-declaration-use-${index}-${useName}`,
      group: 'declaration',
      name: useName,
      type: '使用',
      value: useName,
      note: '源码声明：引用的中文模块或运行库',
      line: findLineContaining(lines, KEYWORD.use, useName)
    });
  });

  const designerFile = extractAssociatedDesignerFile(source);
  if (designerFile) {
    rows.push({
      id: `structured-declaration-designer-${designerFile}`,
      group: 'declaration',
      name: '关联设计器文件',
      type: '设计器',
      value: designerFile,
      note: '源码声明：优先匹配这个窗口布局文件',
      line: findLineContainingText(lines, designerFile) || 1
    });
  }

  languageContext.program.functionLibraries.forEach(library => {
    rows.push({
      id: `structured-function-library-${library.name}-${library.line}`,
      group: 'class',
      name: library.name,
      type: '功能库',
      value: '无状态',
      note: '项目内自动发现；通过“功能库名.功能名(...)”调用',
      line: library.line,
      editable: false,
      className: library.name,
      targetName: library.name
    });
    library.methods.forEach(method => {
      (method.locals || []).forEach(local => rows.push({
        id: `structured-library-local-${library.name}-${method.name}-${local.name}-${local.line}`,
        group: 'local',
        name: local.name,
        type: local.type,
        value: [local.isConstant ? '只读' : '', local.isArray ? '数组' : '', local.initialValue ? `初始值 ${local.initialValue}` : ''].filter(Boolean).join(' · '),
        note: `${local.isConstant ? '运行时初始化一次 · ' : ''}仅在 ${library.name}.${method.name} 内有效`,
        line: local.line,
        editable: true,
        editKind: 'local',
        className: library.name,
        methodName: method.name,
        targetName: local.name,
        initialValue: local.initialValue,
        isArray: local.isArray,
        isConstant: local.isConstant
      }));
      rows.push({
        id: `structured-library-method-${library.name}-${method.name}-${method.line}`,
        group: 'method',
        name: method.name,
        type: method.returnType,
        value: formatParameterList(method.parameters),
        note: `${method.access === '公开' ? '对项目公开' : '仅功能库内部'} · ${noteBeforeLine(lines, method.line) || '可复用功能代码'}`,
        line: method.line,
        editable: true,
        editKind: 'method',
        className: library.name,
        targetName: method.name,
        access: method.access,
        returnType: method.returnType,
        parameters: method.parameters
      });
    });
  });

  languageContext.program.classes.forEach(cls => {
    const classBlock = blockByLine.get(cls.line);
    rows.push({
      id: `structured-class-${cls.name}-${cls.line}`,
      group: 'class',
      name: cls.name,
      type: '类',
      value: cls.baseClass || '',
      note: cls.baseClass ? `基础类：${cls.baseClass}` : '未声明基础类',
      line: cls.line,
      blockId: classBlock?.id,
      editable: true,
      editKind: 'class',
      className: cls.name,
      targetName: cls.name
    });

    cls.members.forEach(member => {
      const sourceNote = noteBeforeLine(lines, member.line);
      rows.push({
        id: `structured-member-${member.name}-${member.line}`,
        group: 'member',
        name: member.name,
        type: member.type,
        value: [
          member.access,
          member.isStatic ? '静态' : '',
          member.isArray ? '数组' : '',
          member.initialValue ? `初始值 ${member.initialValue}` : ''
        ].filter(Boolean).join(' · '),
        note: sourceNote,
        line: member.line,
        editable: true,
        editKind: 'member',
        className: cls.name,
        targetName: member.name,
        access: member.access,
        initialValue: member.initialValue,
        isStatic: member.isStatic,
        isArray: member.isArray
      });
    });

    cls.methods.forEach(method => {
      const block = blockByLine.get(method.line);
      const binding = bindingByHandler.get(normalizeIdentifier(method.name));
      const parameterText = formatParameterList(method.parameters);
      const sourceNote = noteBeforeLine(lines, method.line);
      (method.locals || []).forEach(local => {
        rows.push({
          id: `structured-local-${method.name}-${local.name}-${local.line}`,
          group: 'local',
          name: local.name,
          type: local.type,
          value: [local.isConstant ? '只读' : '', local.isArray ? '数组' : '', local.initialValue ? `初始值 ${local.initialValue}` : ''].filter(Boolean).join(' · '),
          note: `${local.isConstant ? '运行时初始化一次 · ' : ''}局部作用域：${method.name}`,
          line: local.line,
          blockId: block?.id,
          editable: true,
          editKind: 'local',
          className: cls.name,
          methodName: method.name,
          targetName: local.name,
          initialValue: local.initialValue,
          isArray: local.isArray,
          isConstant: local.isConstant
        });
      });
      if (method.kind === 'event') {
        rows.push({
          id: `structured-event-${method.name}-${method.line}`,
          group: 'event',
          name: block?.readableName?.displayName || method.name,
          type: binding?.eventName || eventKindLabel(block?.kind || 'custom-event'),
          value: bindingStatusText(binding?.status),
          note: sourceNote || binding?.detailText || eventNote(block?.kind || 'custom-event', block?.readableName?.subject || method.name),
          line: method.line,
          blockId: block?.id,
          status: binding?.status || block?.bindingStatus,
          editable: true,
          editKind: 'event',
          className: cls.name,
          targetName: method.name,
          access: method.access,
          returnType: method.returnType,
          isStatic: method.isStatic,
          parameters: method.parameters
        });
        if (parameterText) {
          rows.push({
            id: `structured-event-params-${method.name}-${method.line}`,
            group: 'event',
            name: `${method.name} 参数`,
            type: '参数',
            value: parameterText,
            note: '事件执行时传入的数据',
            line: method.line,
            blockId: block?.id,
            status: binding?.status || block?.bindingStatus
          });
        }
        return;
      }

      rows.push({
        id: `structured-method-${method.name}-${method.line}`,
        group: 'method',
        name: method.kind === 'constructor' ? '构造()' : method.kind === 'destructor' ? '析构()' : method.name,
        type: method.kind === 'constructor' ? '构造' : method.kind === 'destructor' ? '析构' : method.returnType,
        value: parameterText,
        note: sourceNote || block?.summary || (method.kind === 'constructor' ? '窗口初始化时执行' : '普通代码逻辑'),
        line: method.line,
        blockId: block?.id,
        editable: method.kind === 'method',
        editKind: method.kind === 'method' ? 'method' : undefined,
        className: cls.name,
        targetName: method.name,
        access: method.access,
        returnType: method.returnType,
        isStatic: method.isStatic,
        parameters: method.parameters
      });
    });
  });

  languageContext.designerBindings
    .filter(binding => binding.status === 'missing-source')
    .forEach(binding => {
      rows.push({
        id: `structured-event-missing-source-${binding.handlerName}-${binding.line}`,
        group: 'event',
        name: binding.handlerName,
        type: binding.eventName || '事件',
        value: bindingStatusText(binding.status),
        note: binding.message,
        line: binding.targetLine || binding.line,
        status: binding.status,
        editable: true,
        editKind: 'missing-event',
        className: binding.className,
        targetName: binding.handlerName
      });
    });

  return rows.sort((a, b) => a.line - b.line || groupOrder(a.group) - groupOrder(b.group) || a.id.localeCompare(b.id));
}

export function getReadableEventName(handlerName: string, designerProject?: LingWindowProject): ReadableEventName {
  const rawName = handlerName.trim().replace(/\(\)\s*$/u, '');
  const normalizedRaw = rawName.replace(/^_+/u, '');
  const matchedDesignerName = findDesignerReadableName(rawName, designerProject);
  const parts = normalizedRaw.split('_').filter(Boolean);
  const lastPart = parts.length > 1 ? parts[parts.length - 1] : inferEventPartFromCompactName(normalizedRaw);
  const subject = matchedDesignerName?.subject || (parts.length > 1 ? parts.slice(0, -1).join('_') : normalizedRaw.replace(lastPart, '').replace(/_+$/u, '')) || normalizedRaw || '事件';
  const eventLabel = matchedDesignerName?.eventLabel || readableEventLabel(lastPart || rawName);

  return {
    rawName,
    subject,
    eventLabel,
    displayName: `${subject} · ${eventLabel}`
  };
}

export function getLingCppReadableBlocks(
  source: string,
  designerProject?: LingWindowProject,
  filePath?: string,
  moduleContext?: LingCppModuleContext
): LingCppReadableBlock[] {
  const parsed = parseLingCpp(source);
  const lines = splitLines(source);
  const classEnds = findClassEndLines(lines);
  const methodEnds = findMethodEndLines(lines);
  const bindings = getLingCppDesignerBindings(source, designerProject, filePath, moduleContext);
  const bindingByHandler = new Map(bindings.map(binding => [normalizeIdentifier(binding.handlerName), binding]));
  const blocks: LingCppReadableBlock[] = [];

  parsed.program.classes.forEach(cls => {
    const classEnd = classEnds.get(cls.line) || cls.endLine || cls.line;
    blocks.push({
      id: `class-${cls.name}-${cls.line}`,
      kind: 'class',
      startLine: cls.line,
      endLine: classEnd,
      title: `${cls.name} · 窗口类`,
      summary: cls.baseClass ? `继承 ${cls.baseClass}` : '窗口程序的主结构',
      actionCount: 0,
      actions: []
    });

    if (cls.members.length > 0) {
      const memberLines = cls.members.map(member => member.line);
      blocks.push({
        id: `members-${cls.name}-${memberLines[0]}`,
        kind: 'member-section',
        startLine: Math.min(...memberLines),
        endLine: Math.max(...memberLines),
        title: '成员变量',
        summary: `${cls.members.length} 个窗口/控件成员`,
        actionCount: 0,
        actions: []
      });
    }

    cls.methods.forEach(method => {
      const endLine = methodEnds.get(method.line) || method.endLine || Math.max(method.line, method.statements.at(-1)?.line || method.line);
      const binding = bindingByHandler.get(normalizeIdentifier(method.name));
      const actions = summarizeReadableActions(method.statements);
      const readableName = method.kind === 'event' ? getReadableEventName(method.name, designerProject) : undefined;
      const kind = readableBlockKind(method, binding);
      const actionSummary = summarizeActionLabels(actions);
      const title = method.kind === 'event'
        ? readableName?.displayName || method.name
        : method.kind === 'constructor'
          ? '构造函数'
          : method.kind === 'destructor'
            ? '析构函数'
            : method.name;

      blocks.push({
        id: `block-${method.kind}-${method.name}-${method.line}`,
        kind,
        startLine: method.line,
        endLine,
        title,
        summary: actionSummary || summaryForReadableBlockKind(kind),
        bindingStatus: binding?.status,
        handlerName: method.name,
        readableName,
        actionCount: actions.length,
        actions,
        targetControlId: binding?.targetControlId || binding?.controlId
      });
    });
  });

  return blocks.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
}

export function getLingCppInlineHints(
  source: string,
  designerProject?: LingWindowProject,
  filePath?: string,
  mode: LingCppReadingMode = 'beginner',
  moduleContext?: LingCppModuleContext
): LingCppInlineHint[] {
  if (mode === 'off') return [];
  const parsed = parseLingCpp(source);
  const blocks = getLingCppReadableBlocks(source, designerProject, filePath, moduleContext);
  const hints: LingCppInlineHint[] = [];

  parsed.program.classes.forEach(cls => {
    hints.push({
      id: `hint-class-${cls.line}`,
      line: cls.line,
      column: 1,
      text: '窗口类',
      mode,
      kind: 'class',
      hover: '这一行声明一个窗口类，控件和事件都放在这个类里面。'
    });
  });

  blocks.forEach(block => {
    if (block.kind === 'constructor') {
      hints.push({
        id: `hint-constructor-${block.startLine}`,
        line: block.startLine,
        column: 1,
        text: '窗口初始化时执行',
        mode,
        kind: 'constructor',
        hover: '构造函数通常用于设置窗口初始状态。'
      });
    }
    if (isEventReadableBlock(block.kind)) {
      hints.push({
        id: `hint-event-${block.startLine}`,
        line: block.startLine,
        column: 1,
        text: `${eventKindLabel(block.kind)}：${block.title}${block.actionCount > 0 ? ` · ${block.actionCount} 个动作` : ''}`,
        mode,
        kind: 'event',
        hover: block.summary
      });
      block.actions.forEach(action => {
        hints.push({
          id: `hint-action-${action.line}-${action.kind}`,
          line: action.line,
          column: 1,
          text: action.label,
          mode,
          kind: 'action',
          hover: actionHoverText(action.kind)
        });
      });
    }
  });

  return hints;
}

export function getLingCppEventBlockHighlights(
  source: string,
  designerProject?: LingWindowProject,
  filePath?: string,
  moduleContext?: LingCppModuleContext
): LingCppEventBlockHighlight[] {
  return getLingCppReadableBlocks(source, designerProject, filePath, moduleContext)
    .filter(block => isEventReadableBlock(block.kind) || block.kind === 'constructor' || block.kind === 'destructor')
    .map(block => ({
      id: `highlight-${block.id}`,
      blockId: block.id,
      startLine: block.startLine,
      endLine: block.endLine,
      kind: block.kind,
      bindingStatus: block.bindingStatus,
      actionKinds: block.actions.map(action => action.kind)
    }));
}

export function formatLingCpp(source: string): string {
  const lines = splitLines(source);
  const formatted: string[] = [];
  let bodyIndent = 0;
  let inClass = false;
  let inMethod = false;
  let previousStructuralKind = '';
  const controlStack: Array<{ family: string; selectBranchOpen?: boolean }> = [];

  const pushBlankBefore = (kind: string) => {
    const needsBlank = formatted.length > 0
      && formatted[formatted.length - 1] !== ''
      && kind !== previousStructuralKind
      && ['class', 'access', 'constructor', 'destructor', 'event', 'method'].includes(kind);
    if (needsBlank) formatted.push('');
  };

  const pushLine = (line: string, kind: string) => {
    pushBlankBefore(kind);
    formatted.push(line);
    previousStructuralKind = kind;
  };

  lines.forEach(rawLine => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      return;
    }

    if (isClassEnd(trimmed)) {
      bodyIndent = 0;
      inMethod = false;
      inClass = false;
      pushLine(trimmed, 'class-end');
      return;
    }

    if (isAccessLine(trimmed)) {
      bodyIndent = 0;
      inMethod = false;
      inClass = true;
      pushLine(trimmed, 'access');
      return;
    }

    if (isClassStart(trimmed) || startsKeyword(trimmed, KEYWORD.package) || startsKeyword(trimmed, KEYWORD.use)) {
      bodyIndent = 0;
      inMethod = false;
      if (isClassStart(trimmed)) inClass = true;
      pushLine(trimmed, isClassStart(trimmed) ? 'class' : startsKeyword(trimmed, KEYWORD.use) ? 'use' : 'package');
      return;
    }

    const control = parseLingCppControlFlowLine(trimmed);
    if (control?.role === 'end') {
      const top = controlStack.at(-1);
      const closeDepth = top?.family === 'select' && top.selectBranchOpen ? 2 : 1;
      bodyIndent = Math.max(0, bodyIndent - closeDepth);
      if (top?.family === control.family) controlStack.pop();
    } else if (control?.role === 'branch') {
      const top = controlStack.at(-1);
      if (control.family === 'select') {
        if (top?.family === 'select' && top.selectBranchOpen) bodyIndent = Math.max(0, bodyIndent - 1);
      } else {
        bodyIndent = Math.max(0, bodyIndent - 1);
      }
    }

    if (isMethodStart(trimmed)) {
      inMethod = true;
      bodyIndent = 0;
      pushLine(`${' '.repeat(4)}${trimmed}`, methodStructuralKind(trimmed));
    } else if (inMethod) {
      pushLine(`${' '.repeat(8 + bodyIndent * 4)}${trimmed}`, 'statement');
    } else if (inClass) {
      pushLine(`${' '.repeat(4)}${trimmed}`, 'member');
    } else {
      pushLine(trimmed, 'top');
    }

    if (control?.role === 'start') {
      controlStack.push({ family: control.family || '', selectBranchOpen: false });
      bodyIndent += 1;
    } else if (control?.role === 'branch') {
      const top = controlStack.at(-1);
      if (top?.family === 'select') top.selectBranchOpen = true;
      bodyIndent += 1;
    }
  });

  return formatted.join('\n').replace(/\n{3,}/gu, '\n\n').replace(/\s+$/u, '');
}

export const lingCppLanguageService = {
  getDiagnostics: getLingCppSemanticDiagnostics,
  getCompletions: getLingCppCompletionItems,
  getHover: getLingCppHover,
  getDocumentSymbols: getLingCppSymbols,
  getFoldingRanges: getLingCppFoldingRanges,
  applyAstEdit: applyLingCppAstEdit,
  formatDocument: formatLingCpp
} as const;

export function getLingCppDesignerBindings(
  source: string,
  designerProject?: LingWindowProject,
  filePath?: string,
  moduleContext?: LingCppModuleContext
): LingCppDesignerBindingHint[] {
  if (!designerProject) return [];

  const parsed = parseLingCpp(source);
  const currentWindows = selectDesignerWindows(designerProject, source, filePath);
  if (currentWindows.length === 0) return [];

  const sourceEvents = parsed.program.classes.flatMap(cls =>
    cls.methods
      .filter(method => method.kind === 'event')
      .map(method => ({ className: cls.name, handlerName: method.name, line: method.line }))
  );
  const classInsertionLineByName = new Map(parsed.program.classes.map(cls => [
    normalizeIdentifier(cls.name),
    Math.max(cls.line, cls.endLine || cls.methods.at(-1)?.endLine || cls.methods.at(-1)?.line || cls.line)
  ]));
  const fallbackDiagnosticLine = parsed.program.classes[0]?.line || 1;
  const sourceEventMap = new Map(sourceEvents.map(event => [normalizeIdentifier(event.handlerName), event]));
  const expectedBindings = collectDesignerEventBindings(currentWindows, designerProject.resources || []);
  const expectedMap = new Map(expectedBindings.map(binding => [normalizeIdentifier(binding.handlerName), binding]));
  const moduleCallbackHandlers = collectModuleCallbackHandlerNames(source, moduleContext);
  const hints: LingCppDesignerBindingHint[] = [];

  sourceEvents.forEach(event => {
    const normalizedHandler = normalizeIdentifier(event.handlerName);
    const expected = expectedMap.get(normalizedHandler);
    if (expected) {
      hints.push({
        status: 'bound',
        line: event.line,
        handlerName: event.handlerName,
        className: event.className,
        controlName: expected.controlName,
        controlId: expected.controlId,
        eventName: expected.eventName,
        windowId: expected.windowId,
        message: `已绑定设计器事件：${expected.controlName || expected.className || '窗口'} / ${expected.eventName}`,
        suggestion: '可从提示入口跳转到设计器中的绑定控件。'
      });
      return;
    }

    const windowEvent = findWindowEventMatch(event.handlerName, event.className, currentWindows);
    if (windowEvent) {
      const windowHint: LingCppDesignerBindingHint = {
        status: 'bound',
        line: event.line,
        handlerName: event.handlerName,
        className: event.className,
        controlName: windowEvent.title || windowEvent.className,
        eventName: 'Window',
        windowId: windowEvent.id,
        message: `Window event recognized: ${event.handlerName}`,
        suggestion: 'This is a window-level event and is not checked as a control event.'
      };
      hints.push(windowHint);
      return;
    }

    if (moduleCallbackHandlers.has(normalizedHandler)) return;

    const inferredControlName = inferControlNameFromHandler(event.handlerName);
    const windowMatch = currentWindows.find(win => normalizeIdentifier(win.className) === normalizeIdentifier(event.className));
    const controlExists = currentWindows.some(win =>
      win.controls.some(control => normalizeIdentifier(control.name) === normalizeIdentifier(inferredControlName))
    ) || (designerProject.resources || []).some(resource => (
      resource.type === 'FileDialog'
      && currentWindows.some(win => win.id === resource.ownerWindowId)
      && normalizeIdentifier(resource.name) === normalizeIdentifier(inferredControlName)
    ));

    hints.push({
      status: controlExists || !inferredControlName ? 'unbound-source' : 'missing-control',
      line: event.line,
      handlerName: event.handlerName,
      className: event.className,
      controlName: inferredControlName,
      windowId: windowMatch?.id,
      message: controlExists
        ? `源码事件 ${event.handlerName} 尚未在设计器中绑定。`
        : `源码事件 ${event.handlerName} 指向的控件不存在。`,
      suggestion: controlExists ? '请在设计器事件面板绑定该处理器。' : '请检查控件名称，或在设计器中创建对应控件。'
    });
  });

  expectedBindings.forEach(binding => {
    if (sourceEventMap.has(normalizeIdentifier(binding.handlerName))) return;
    const windowEventDefinition = getWindowEventDefinition(binding.eventName || '');
    if (windowEventDefinition && sourceEvents.some(event => {
      const sourceWindow = findWindowEventMatch(event.handlerName, event.className, currentWindows);
      if (!sourceWindow || sourceWindow.id !== binding.windowId) return false;
      const normalizedHandler = normalizeIdentifier(event.handlerName);
      return [windowEventDefinition.name, windowEventDefinition.label, windowEventDefinition.handlerSuffix]
        .map(alias => normalizeIdentifier(alias))
        .some(alias => normalizedHandler === alias || normalizedHandler.endsWith(`_${alias}`));
    })) return;
    hints.push({
      status: 'missing-source',
      line: classInsertionLineByName.get(normalizeIdentifier(binding.className)) || fallbackDiagnosticLine,
      handlerName: binding.handlerName,
      className: binding.className,
      controlName: binding.controlName,
      controlId: binding.controlId,
      eventName: binding.eventName,
      windowId: binding.windowId,
      message: `设计器已绑定 ${binding.handlerName}，但源码中缺少对应事件。`,
      suggestion: `请生成或补全 ${KEYWORD.event} ${binding.handlerName}()。`
    });
  });

  return hints.map(enrichDesignerBindingHint);
}

function enrichDesignerBindingHint(hint: LingCppDesignerBindingHint): LingCppDesignerBindingHint {
  if (hint.displayText && hint.detailText && hint.actionKind) return hint;

  const displayText = hint.displayText || displayTextForBinding(hint);
  return {
    ...hint,
    displayText,
    detailText: hint.detailText || detailTextForBinding(hint),
    actionKind: hint.actionKind || actionKindForBinding(hint.status),
    targetLine: hint.targetLine || hint.line,
    targetControlId: hint.targetControlId || hint.controlId
  };
}

function displayTextForBinding(hint: LingCppDesignerBindingHint): string {
  if (hint.status === 'bound' && hint.eventName === 'Window') {
    return `窗口事件：${eventNameLabel(hint.handlerName)}`;
  }
  if (hint.status === 'bound') {
    return `已绑定：${hint.controlName || hint.className || '窗口'} / ${eventNameLabel(hint.eventName || hint.handlerName)}`;
  }
  if (hint.status === 'missing-source') {
    return `待生成：${hint.controlName || hint.className || '事件'} / ${eventNameLabel(hint.eventName || hint.handlerName)}`;
  }
  if (hint.status === 'missing-control') {
    return `控件不存在：${hint.controlName || hint.handlerName}`;
  }
  return `未绑定：${eventNameLabel(hint.handlerName)}`;
}

function detailTextForBinding(hint: LingCppDesignerBindingHint): string {
  if (hint.status === 'bound') return `处理器：${hint.handlerName}`;
  if (hint.status === 'missing-source') return '设计器已有绑定，但当前源码缺少事件函数。';
  if (hint.status === 'missing-control') return '事件名中的控件无法在当前设计器窗口中找到。';
  return '源码中有事件，但设计器尚未引用。';
}

function actionKindForBinding(status: LingCppDesignerBindingHint['status']): LingCppQuickAction['kind'] {
  if (status === 'missing-source') return 'generate-event';
  if (status === 'unbound-source') return 'bind-designer-event';
  if (status === 'missing-control') return 'rename-handler';
  return 'reveal-designer';
}

function actionLabelForBinding(status: LingCppDesignerBindingHint['status']): string {
  return actionLabelForKind(actionKindForBinding(status));
}

function actionLabelForKind(kind: LingCppQuickAction['kind']): string {
  if (kind === 'generate-event') return '生成事件函数';
  if (kind === 'bind-designer-event') return '绑定到控件事件';
  if (kind === 'rename-handler') return '重命名事件处理器';
  if (kind === 'reveal-designer') return '跳转设计器';
  return '查看';
}

function problemMessageForBinding(binding: LingCppDesignerBindingHint): string {
  if (binding.status === 'missing-source') {
    return `设计器已绑定 ${binding.handlerName}，但源码中缺少对应事件。`;
  }
  if (binding.status === 'missing-control') {
    return `源码事件 ${binding.handlerName} 指向的控件不存在。`;
  }
  if (binding.status === 'unbound-source') {
    return `源码事件 ${binding.handlerName} 尚未绑定到设计器事件。`;
  }
  return binding.message;
}

function problemSuggestionForBinding(binding: LingCppDesignerBindingHint): string {
  if (binding.status === 'missing-source') return `生成或补全 ${KEYWORD.event} ${binding.handlerName}()。`;
  if (binding.status === 'missing-control') return '检查控件名称，或在设计器中创建对应控件。';
  if (binding.status === 'unbound-source') return '在设计器事件面板绑定该处理器。';
  return binding.suggestion;
}

function eventNameLabel(value: string): string {
  const registered = getWindowEventDefinition(value);
  if (registered) return registered.label;
  const raw = value.replace(/^_+/u, '');
  const parts = raw.split('_').filter(Boolean);
  const last = parts[parts.length - 1] || raw;
  const normalized = last.replace(/^被/u, '');
  const labels: Record<string, string> = {
    Click: '单击',
    DoubleClick: '双击',
    Created: '创建完毕',
    创建完毕: '创建完毕',
    被单击: '单击',
    单击: '单击',
    被双击: '双击',
    内容被改变: '内容改变',
    获得焦点: '获得焦点',
    鼠标被按下: '鼠标按下',
    被选中: '选中'
  };
  return labels[last] || labels[normalized] || normalized || value;
}

function normalizeWindowEventType(value: string): string {
  const compact = normalizeIdentifier(value)
    .replace(/［/gu, '[')
    .replace(/］/gu, ']');
  const arraySuffix = compact.endsWith('[]') ? '[]' : '';
  const base = arraySuffix ? compact.slice(0, -2) : compact;
  const aliases: Record<string, string> = {
    文本: '文本型',
    文本型: '文本型',
    字符串: '文本型',
    字符串型: '文本型',
    整数: '整数型',
    整数型: '整数型',
    逻辑: '逻辑型',
    逻辑型: '逻辑型',
    布尔: '逻辑型',
    布尔型: '逻辑型'
  };
  return `${aliases[base] || base}${arraySuffix}`;
}

function getModuleDesignerEventDiagnostics(
  program: LingCppProgram,
  windows: readonly LingWindowModel[],
  moduleContext?: LingCppModuleContext
): LingCppDiagnostic[] {
  const modules = moduleContext?.enabledModules || [];
  if (modules.length === 0) return [];
  const diagnostics: LingCppDiagnostic[] = [];

  windows.forEach(win => {
    const windowClass = program.classes.find(cls => normalizeIdentifier(cls.name) === normalizeIdentifier(win.className));
    const methods = windowClass?.methods || program.classes.flatMap(cls => cls.methods);
    win.controls.forEach(control => {
      Object.entries(control.events || {}).forEach(([eventName, handlerName]) => {
        const normalizedHandler = handlerName.trim();
        if (!normalizedHandler) return;
        const event = resolveModuleDesignerEvent(modules, control.designerType, eventName);
        if (!event) return;
        const method = methods.find(candidate => candidate.kind === 'event'
          && normalizeIdentifier(candidate.name) === normalizeIdentifier(normalizedHandler));
        if (!method) return;

        const expectedParameters = event.parameters || [];
        const actualParameters = method.parameters;
        const matchesExpected = actualParameters.length === expectedParameters.length
          && expectedParameters.every((expected, index) => normalizeWindowEventType(
            getModuleDesignerEventParameterType(expected.type)
          ) === normalizeWindowEventType(actualParameters[index]?.type || ''));
        // 已生成的旧项目允许继续使用零参数处理器，重新从设计器打开时会安全升级签名。
        if (actualParameters.length === 0 && expectedParameters.length > 0) return;
        if (matchesExpected) return;

        const parameterText = formatModuleDesignerEventParameters(expectedParameters);
        const expectedSignature = `事件 ${method.name}(${parameterText})`;
        diagnostics.push({
          id: `lingcpp-module-designer-event-parameters-${control.id}-${event.name}-${method.line}`,
          line: method.line,
          level: 'error',
          message: `模块控件 ${control.name} 的${event.label}事件参数与 ${event.name} 契约不匹配。`,
          codeSnippet: method.name,
          suggestion: `请改为 ${expectedSignature}。`
        });
      });
    });
  });

  return diagnostics;
}

function getDesignerCompletionItems(
  source: string,
  designerProject?: LingWindowProject,
  moduleContext?: LingCppModuleContext
): LingCppCompletionItem[] {
  if (!designerProject) return [];
  return selectDesignerWindows(designerProject, source).flatMap(win => {
    const windowItems: LingCppCompletionItem[] = WINDOW_EVENT_DEFINITIONS.map(definition => {
      const handlerName = win.events?.[definition.name]?.trim() || getWindowEventHandlerName(win.className, definition.name);
      const parameterText = formatWindowEventParameters(definition.name);
      const signature = `事件 ${handlerName}(${parameterText})`;
      return {
        label: `${win.title || win.className} ${definition.label}事件`,
        kind: 'event',
        insertText: `${signature}\n    调试输出("窗口${definition.handlerSuffix}")\n    $0`,
        detail: `设计器窗口事件 · ${definition.category}`,
        documentation: `窗口：${win.title || win.className}\n事件：${definition.label} (${definition.name})\n${definition.description}${parameterText ? `\n参数：${parameterText}` : ''}`,
        aliases: [definition.name, definition.label, definition.handlerSuffix, 'WindowEvent'],
        pinyin: ['ckcjsj', 'cksj'],
        example: signature,
        category: 'designer',
        audienceText: definition.description,
        isSnippet: true
      };
    });

    const controlItems = win.controls.flatMap(control => {
      return getDesignerControlEventEntries(control, moduleContext).map(({ eventName, eventLabel, handlerName, parameters, starterStatements }) => {
        const parameterText = formatModuleDesignerEventParameters(parameters);
        const signature = `事件 ${handlerName}(${parameterText})`;
        const body = [...starterStatements, '$0'].map(statement => `    ${statement}`).join('\n');
        return {
          label: `${control.name} ${eventLabel}事件`,
          kind: 'event' as const,
          insertText: `${signature}\n${body}`,
          detail: `设计器控件：${control.name}`,
          documentation: `控件：${control.name}\n事件：${eventLabel}\n处理器：${handlerName}${parameterText ? `\n参数：${parameterText}` : ''}`,
          aliases: [control.name, handlerName, eventName, eventLabel, '控件事件'],
          pinyin: ['kjsj'],
          example: signature,
          category: 'designer' as const,
          audienceText: `用户操作 ${control.name} 后执行`,
          isSnippet: true
        };
      });
    });

    return [...windowItems, ...getDesignerControlCompletionItemsForWindow(win, moduleContext), ...controlItems];
  });
}

export function getLingCppDesignerControlCompletions(
  source: string,
  designerProject?: LingWindowProject,
  moduleContext?: LingCppModuleContext
): LingCppCompletionItem[] {
  if (!designerProject) return [];
  return selectDesignerWindows(designerProject, source)
    .flatMap(win => getDesignerControlCompletionItemsForWindow(win, moduleContext));
}

function getDesignerControlCompletionItemsForWindow(
  win: LingWindowModel,
  moduleContext?: LingCppModuleContext
): LingCppCompletionCatalogItem[] {
  return win.controls.flatMap(control => {
    const detail = `设计器控件 · ${control.type}`;
    const items: LingCppCompletionCatalogItem[] = [
      createLingCppCatalogItem({
        label: control.name,
        kind: 'type',
        insertText: control.name,
        detail,
        documentation: `窗口：${win.title || win.className}\n控件：${control.name}\n类型：${control.type}`,
        aliases: [control.type, '控件', '组件'],
        category: 'designer',
        source: 'designer',
        sortRank: 10
      }),
      createLingCppCatalogItem({
        label: `${control.name}.内容`,
        kind: 'snippet',
        insertText: `${control.name}.内容`,
        detail: `${detail} · 读取当前文本`,
        documentation: `读取设计器控件“${control.name}”的当前文本；等价于 控件_取文本(${control.name})。`,
        aliases: [control.name, `${control.name}.文字`, '内容', '文字', '取文本'],
        category: 'designer',
        source: 'designer',
        sortRank: 10
      })
    ];
    if (['ListBox', 'ComboBox', 'ComboBoxEx', 'ListView', 'TabControl'].includes(control.type)) {
      items.push(createLingCppCatalogItem({
        label: `${control.name}.设置选择项`,
        kind: 'snippet',
        insertText: `${control.name}.设置选择项($1)`,
        detail: `${detail} · 按从 0 开始的索引切换选择项`,
        signature: `${control.name}.设置选择项(索引)`,
        returnType: '逻辑型',
        documentation: `设置设计器控件“${control.name}”的选择项；等价于 控件_设置选择项(${control.name}, 索引)。`,
        aliases: [control.name, '设置选择项', '切换选项卡', '选择页面'],
        category: 'designer',
        source: 'designer',
        sortRank: 10,
        isSnippet: true
      }));
    }
    getDesignerControlCommandCompletions(control).forEach(command => {
      items.push(createLingCppCatalogItem({
        label: `${control.name}.${command.methodName}`,
        kind: 'function',
        insertText: command.insertText,
        detail: `${detail} · ${command.description}`,
        documentation: `${command.description}\n将生成可确定性转换为 C++ 的命令：${command.commandName}。`,
        aliases: [control.name, control.type, command.methodName, command.commandName],
        category: 'designer',
        source: 'designer',
        sortRank: 10,
        isSnippet: command.insertText.includes('$')
      }));
    });
    getDesignerControlEventEntries(control, moduleContext).forEach(({ eventName, eventLabel, handlerName, parameters }) => {
      const parameterPlaceholders = parameters.map((_, index) => `$${index + 1}`).join(', ');
      items.push(createLingCppCatalogItem({
        label: `${control.name}.${eventLabel}事件`,
        kind: 'event',
        insertText: `${handlerName}(${parameterPlaceholders})`,
        detail: `${detail} · ${eventLabel}事件处理器${control.events?.[eventName]?.trim() ? '' : '（尚未绑定）'}`,
        documentation: `控件事件：${eventLabel} (${eventName})\n处理器：${handlerName}\n可在设计器事件面板绑定；候选可用于调用对应处理器。`,
        aliases: [control.name, control.type, eventName, eventLabel, handlerName, '控件事件'],
        category: 'designer',
        source: 'designer',
        sortRank: 11,
        isSnippet: parameters.length > 0
      }));
    });
    return items;
  });
}

interface DesignerControlCommandCompletion {
  methodName: string;
  commandName: string;
  insertText: string;
  description: string;
}

function getDesignerControlEventEntries(
  control: LingWindowModel['controls'][number],
  moduleContext?: LingCppModuleContext
) {
  const moduleEvents = getModuleDesignerEvents(moduleContext?.enabledModules || [], control.designerType);
  const definition = getWin32ControlDefinition(control.type);
  const registered = moduleEvents.length > 0
    ? moduleEvents.map(event => ({
      eventName: event.name,
      eventLabel: event.label,
      handlerName: [event.name, ...(event.aliases || [])]
        .map(name => control.events?.[name]?.trim())
        .find(Boolean) || event.handlerPattern.replace('{controlName}', control.name),
      parameters: event.parameters || [],
      starterStatements: event.starterStatements || []
    }))
    : (definition?.events || []).map(event => ({
      eventName: event.name,
      eventLabel: event.label,
      handlerName: control.events?.[event.name]?.trim() || `_${control.name}_${event.handlerSuffix}`,
      parameters: [],
      starterStatements: []
    }));
  const registeredNames = new Set(moduleEvents.length > 0
    ? moduleEvents.flatMap(event => [event.name, ...(event.aliases || [])])
    : registered.map(event => event.eventName));
  const custom = Object.entries(control.events || {})
    .filter(([eventName, handlerName]) => !registeredNames.has(eventName) && handlerName.trim())
    .map(([eventName, handlerName]) => ({
      eventName,
      eventLabel: eventNameLabel(eventName),
      handlerName: handlerName.trim(),
      parameters: [],
      starterStatements: []
    }));
  return [...registered, ...custom];
}

function getDesignerControlCommandCompletions(
  control: LingWindowModel['controls'][number]
): DesignerControlCommandCompletion[] {
  const name = control.name.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"');
  const command = (
    methodName: string,
    commandName: string,
    argumentsText: string,
    description: string
  ): DesignerControlCommandCompletion => ({
    methodName,
    commandName,
    insertText: `${commandName}("${name}"${argumentsText ? `, ${argumentsText}` : ''})`,
    description
  });
  const commands = [
    command('设置内容', '控件_设置文本', '"$1"', '设置控件显示文本'),
    command('取内容', '控件_取文本', '', '读取控件当前文本'),
    command('设置启用', '控件_设置启用', '真', '启用或禁用控件'),
    command('设置可见', '控件_设置可见', '真', '显示或隐藏控件')
  ];
  if (['Button', 'CheckBox', 'RadioButton'].includes(control.type)) {
    commands.push(
      command('设置勾选', '控件_设置勾选', '真', '设置控件勾选或按下状态'),
      command('取勾选', '控件_取勾选', '', '读取控件勾选或按下状态')
    );
  }
  if (['ProgressBar', 'ScrollBar', 'TrackBar', 'UpDown', 'FlatScrollBar'].includes(control.type)) {
    commands.push(
      command('设置数值', '控件_设置数值', '$1', '设置控件当前数值'),
      command('取数值', '控件_取数值', '', '读取控件当前数值')
    );
  }
  if (control.type === 'Image') {
    commands.push({
      methodName: '设置图片',
      commandName: '控件_设置图片',
      insertText: `${name}.设置图片("$1")`,
      description: '从项目资源相对路径或本地完整路径加载图片；空路径会清空图片'
    });
  }
  if (control.type === 'VideoPlayer') {
    commands.push(
      command('设置文件', '视频播放器_设置文件', '"$1"', '切换 MP4、WMV 等本地视频文件'),
      command('播放', '视频播放器_播放', '', '播放或继续播放视频'),
      command('暂停', '视频播放器_暂停', '', '暂停视频'),
      command('停止', '视频播放器_停止', '', '停止视频'),
      command('设置音量', '视频播放器_设置音量', '100', '设置 0～100 的播放音量'),
      command('取状态', '视频播放器_取状态', '', '读取 Media Foundation 播放状态')
    );
  }
  if (control.type === 'ColorPicker') {
    commands.push(
      command('打开选择窗口', '颜色选择器_打开', '', '打开 LingBuilder 现代原生颜色选择窗口；控件不可视时仍可调用'),
      command('设置颜色', '颜色选择器_置颜色', '$1', '设置当前 COLORREF 颜色'),
      command('取颜色', '颜色选择器_取颜色', '', '读取当前 COLORREF 颜色')
    );
  }
  if (['ListBox', 'ComboBox', 'ComboBoxEx', 'ListView', 'TabControl'].includes(control.type)) {
    commands.push(command('取选择项', '控件_取选择项', '', '读取当前选择项索引'));
  }
  if (['ListBox', 'ComboBox', 'ComboBoxEx'].includes(control.type)) {
    commands.push(command('添加项目', '控件_添加项目', '"$1"', '追加一个文本项目'));
  }
  if (['ListBox', 'ComboBox', 'ComboBoxEx', 'ListView', 'TreeView', 'TabControl'].includes(control.type)) {
    commands.push(command('清空项目', '控件_清空项目', '', '清空控件中的项目'));
  }
  if (control.type === 'ListView') {
    const listViewColumnCount = Array.isArray(control.properties?.columns)
      ? Math.max(1, control.properties.columns.length)
      : 1;
    const structuredRowArguments = Array.from(
      { length: listViewColumnCount },
      (_item, index) => `"$${index + 1}"`
    ).join(', ');
    const structuredRow = `列表视图_创建行(${structuredRowArguments})`;
    commands.push(
      command('添加行', '列表视图_添加行', structuredRow, '按当前列数追加类型化单元格数组'),
      command('插入行', '列表视图_插入行', `0, ${structuredRow}`, '在零基行索引插入类型化单元格数组'),
      command('删除行', '列表视图_删除行', '0', '删除零基行索引'),
      command('设置单元格', '列表视图_设置单元格', '0, 0, "$1"', '设置零基行列单元格'),
      command('取单元格', '列表视图_取单元格', '0, 0', '读取零基行列单元格'),
      command('取行数', '列表视图_取行数', '', '读取当前数据行数'),
      command('批量添加行', '列表视图_批量添加行', `列表视图_创建行集合(${structuredRow})`, '批量追加类型化行集合'),
      command('开始批量更新', '列表视图_开始批量更新', '', '暂停重绘'),
      command('结束批量更新', '列表视图_结束批量更新', '', '恢复重绘'),
      command('排序', '列表视图_排序', '0, 真', '按列文本稳定排序'),
      command('取最后单击列', '列表视图_取最后单击列', '', '读取最近表头单击列'),
      command('取虚拟模式', '列表视图_取虚拟模式', '', '判断是否启用 LVS_OWNERDATA'),
      command('设置虚拟行数', '列表视图_设置虚拟行数', '15000', '设置虚拟列表总行数'),
      command('设置虚拟行', '列表视图_设置虚拟行', `0, ${structuredRow}`, '设置虚拟列表指定类型化行'),
      ...LIST_VIEW_ADVANCED_API.map(item => command(item.memberName, item.name, item.memberArgs, item.description))
    );
  }
  if (control.type === 'DataGrid') {
    commands.push(...DATA_GRID_API.map(item => command(item.memberName, item.name, item.memberArgs, item.description)));
  }
  if (control.type === 'TreeView') {
    commands.push(command('添加节点', '树形框_添加节点', '"$1", "$2"', '向根级或指定父节点追加节点'));
  }
  if (control.type === 'TabControl') {
    commands.push(
      command('添加页', '选项卡_添加页', '"$1"', '追加一个标签页'),
      command('设置隐藏表头', '选项卡_设置隐藏表头', '真', '运行时隐藏或显示标签表头'),
      command('隐藏表头', '选项卡_设置隐藏表头', '真', '立即隐藏标签表头'),
      command('显示表头', '选项卡_设置隐藏表头', '假', '立即显示标签表头'),
      command('取隐藏表头', '选项卡_取隐藏表头', '', '读取标签表头是否隐藏')
    );
  }
  return commands;
}

function getOpenWindowTargetCompletionItems(
  context: LingCppCompletionContext,
  designerProject?: LingWindowProject
): LingCppCompletionItem[] | undefined {
  const linePrefix = getLinePrefixBeforeColumn(context.source, context.line, context.column);
  if (!/(?:^|\s)(?:打开窗口|窗口_打开|载入窗口|载入新窗口)\s*[（(]\s*["“][^"”\n]*$/u.test(linePrefix)) {
    return undefined;
  }
  if (!designerProject) return [];

  const items = designerProject.windows.flatMap(window => {
    const title = (window.title || '').trim();
    const className = (window.className || '').trim();
    const fileName = (window.fileName || '').trim();
    const aliases = [title, className, fileName, '窗口', '窗体', '打开窗口'].filter(Boolean);
    const completions: LingCppCompletionItem[] = [];

    if (title) {
      completions.push({
        label: title,
        kind: 'type',
        insertText: title,
        detail: className ? `窗口标题 · 类名 ${className}` : '窗口标题',
        documentation: `窗口标题：${title}${className ? `\n类名：${className}` : ''}${fileName ? `\n设计文件：${fileName}` : ''}`,
        aliases,
        category: 'designer',
        audienceText: '可传给 打开窗口(...) 的目标窗口标题'
      });
    }

    if (className && className !== title) {
      completions.push({
        label: className,
        kind: 'type',
        insertText: className,
        detail: title ? `窗口类名 · 标题 ${title}` : '窗口类名',
        documentation: `窗口类名：${className}${title ? `\n标题：${title}` : ''}${fileName ? `\n设计文件：${fileName}` : ''}`,
        aliases,
        category: 'designer',
        audienceText: '可传给 打开窗口(...) 的目标窗口类名'
      });
    }

    return completions;
  });

  return Array.from(new Map(items.map(item => [`${item.kind}:${item.label}:${item.insertText}`, item])).values());
}

function getOpenWindowPlacementCompletionItems(
  context: LingCppCompletionContext
): LingCppCompletionItem[] | undefined {
  const linePrefix = getLinePrefixBeforeColumn(context.source, context.line, context.column);
  if (!/(?:^|\s)(?:打开窗口|窗口_打开|载入窗口|载入新窗口)\s*[（(]\s*(?:L)?["“][^"”\n]*["”]\s*[,，]\s*(?:(?:L)?["“][^"”\n]*|[\w\u4e00-\u9fa5-]*)$/u.test(linePrefix)) {
    return undefined;
  }

  return [
    ['居中', '屏幕工作区居中显示'],
    ['左上角', '贴近屏幕工作区左上角显示'],
    ['右上角', '贴近屏幕工作区右上角显示'],
    ['左下角', '贴近屏幕工作区左下角显示'],
    ['右下角', '贴近屏幕工作区右下角显示'],
    ['自定义坐标', '配合第三、第四参数指定屏幕坐标，例如 打开窗口("关于窗体", "自定义坐标", 120, 80)']
  ].map(([label, detail]) => ({
    label,
    kind: 'keyword' as const,
    insertText: label,
    detail,
    documentation: detail,
    aliases: [label, '打开位置', '窗口位置', 'position', 'placement'],
    category: 'keyword' as const,
    audienceText: '可作为 打开窗口(...) 的第二个打开位置参数'
  }));
}

function getLinePrefixBeforeColumn(source: string, line: number, column: number): string {
  const lines = splitLines(source);
  const lineText = lines[Math.max(0, line - 1)] || '';
  return lineText.slice(0, Math.max(0, column - 1));
}

function memberNote(type: string, name: string): string {
  if (/按钮|鎸夐挳|Button/u.test(type)) return `${name} 是一个可以被点击的按钮控件`;
  if (/标签|鏍囩|Label/u.test(type)) return `${name} 用来显示说明文字`;
  if (/文本|鏂囨湰|Text/u.test(type)) return `${name} 保存一段文本`;
  return '类里面保存的数据或控件';
}

function noteBeforeLine(lines: string[], lineNumber: number): string | undefined {
  const previousLine = lines[Math.max(0, lineNumber - 2)] || '';
  const trimmed = previousLine.trim();
  if (trimmed.startsWith('//')) return trimmed.replace(/^\/\/\s?/u, '').trim() || undefined;
  if (trimmed.startsWith('注释 ')) return trimmed.slice('注释'.length).trim() || undefined;
  return undefined;
}

function formatParameterList(parameters: LingCppMethod['parameters']): string {
  return parameters
    .map(parameter => {
      const declaration = `${parameter.type} ${parameter.name}`.trim();
      return parameter.defaultValue?.trim() ? `${declaration} = ${parameter.defaultValue.trim()}` : declaration;
    })
    .join('，');
}

function bindingStatusText(status?: LingCppDesignerBindingHint['status']): string {
  if (status === 'bound') return '已绑定';
  if (status === 'missing-source') return '缺少源码';
  if (status === 'missing-control') return '缺少控件';
  if (status === 'unbound-source') return '未绑定';
  return '源码事件';
}

function groupOrder(group: LingCppStructuredReadingRow['group']): number {
  const order: Record<LingCppStructuredReadingRow['group'], number> = {
    declaration: 0,
    package: 0,
    global: 1,
    class: 2,
    member: 3,
    local: 4,
    method: 5,
    constructor: 5,
    event: 6,
    parameter: 7,
    note: 8
  };
  return order[group] ?? 99;
}

function eventNote(kind: LingCppReadableBlockKind, subject: string): string {
  if (kind === 'window-event') return `${subject} 的窗口生命周期事件`;
  if (kind === 'control-event') return `用户操作 ${subject} 后执行`;
  if (kind === 'menu-event') return `用户选择菜单项后执行`;
  return '自定义事件逻辑';
}

function getSemanticFoldingRanges(source: string): LingCppFoldingRange[] {
  const parsed = parseLingCpp(source);
  const ranges: LingCppFoldingRange[] = [];
  parsed.program.classes.forEach(cls => {
    if (cls.members.length > 1) {
      const lines = cls.members.map(member => member.line);
      ranges.push({ startLine: Math.min(...lines), endLine: Math.max(...lines), kind: 'region' });
    }
  });
  parsed.program.dataTypes.forEach(dataType => {
    const endLine = dataType.endLine || dataType.line;
    if (endLine > dataType.line) ranges.push({ startLine: dataType.line, endLine, kind: 'region' });
  });
  return ranges;
}

function dedupeFoldingRanges(ranges: LingCppFoldingRange[]): LingCppFoldingRange[] {
  const seen = new Set<string>();
  return ranges.filter(range => {
    const key = `${range.startLine}:${range.endLine}:${range.kind || ''}`;
    if (range.endLine <= range.startLine || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readableBlockKind(method: LingCppMethod, binding?: LingCppDesignerBindingHint): LingCppReadableBlockKind {
  if (method.kind === 'constructor') return 'constructor';
  if (method.kind === 'destructor') return 'destructor';
  if (method.kind !== 'event') return 'method';
  if (binding?.eventName === 'Window' || Boolean(binding?.eventName && getWindowEventDefinition(binding.eventName))) return 'window-event';
  if (binding?.controlId) return 'control-event';
  if (binding?.eventName?.startsWith('Item_')) return 'menu-event';
  const readable = getReadableEventName(method.name);
  if (/菜单|选中|选择|Item_/u.test(readable.eventLabel) || /菜单|Item_/u.test(method.name)) return 'menu-event';
  if (/创建完毕|窗口|Created|Window/u.test(readable.eventLabel) || readable.subject === method.name.replace(/^_+/u, '')) return 'window-event';
  return binding?.status === 'missing-control' || binding?.status === 'unbound-source' ? 'control-event' : 'custom-event';
}

function summarizeReadableActions(statements: LingCppStatement[]): LingCppReadableActionSummary[] {
  return statements
    .map(statement => {
      const text = statement.text.trim();
      if (!text) return undefined;
      const kind = actionKindFromLine(text);
      if (!kind) return undefined;
      return {
        kind,
        label: actionLabelForReadableKind(kind),
        line: statement.line
      };
    })
    .filter((action): action is LingCppReadableActionSummary => Boolean(action));
}

function actionKindFromLine(text: string): LingCppReadableActionSummary['kind'] | undefined {
  if (containsAny(text, ['信息框', '淇℃伅妗'])) return 'message-box';
  if (containsAny(text, ['调试输出', '璋冭瘯杈撳嚭', '输出调试文本'])) return 'debug-output';
  if (containsAny(text, ['结束', '缁撴潫'])) return 'exit-program';
  if (containsAny(text, ['窗口_打开', '绐楀彛_鎵撳紑', '打开窗口'])) return 'open-window';
  if (containsAny(text, ['.文字', '置标题', '缃爣棰', '设置文字', '内容'])) return 'set-control-text';
  return undefined;
}

function containsAny(text: string, needles: string[]): boolean {
  return needles.some(needle => needle && text.includes(needle));
}

function actionLabelForReadableKind(kind: LingCppReadableActionSummary['kind']): string {
  if (kind === 'message-box') return '提示框';
  if (kind === 'debug-output') return '调试输出';
  if (kind === 'exit-program') return '结束程序';
  if (kind === 'set-control-text') return '修改文字';
  if (kind === 'open-window') return '打开窗口';
  return '高级代码';
}

function summarizeActionLabels(actions: LingCppReadableActionSummary[]): string {
  const labels = Array.from(new Set(actions.map(action => action.label)));
  if (labels.length === 0) return '';
  return labels.slice(0, 3).join(' + ') + (labels.length > 3 ? ` + ${labels.length - 3} 项` : '');
}

function summaryForReadableBlockKind(kind: LingCppReadableBlockKind): string {
  if (kind === 'constructor') return '窗口初始化逻辑';
  if (kind === 'destructor') return '窗口关闭前后的清理逻辑';
  if (kind === 'window-event') return '窗口生命周期事件';
  if (kind === 'control-event') return '控件触发后执行';
  if (kind === 'menu-event') return '菜单项触发后执行';
  if (kind === 'method') return '普通函数逻辑';
  return '自定义事件逻辑';
}

function isEventReadableBlock(kind: LingCppReadableBlockKind): boolean {
  return kind === 'window-event' || kind === 'control-event' || kind === 'menu-event' || kind === 'custom-event';
}

function eventKindLabel(kind: LingCppReadableBlockKind): string {
  if (kind === 'window-event') return '窗口事件';
  if (kind === 'control-event') return '控件事件';
  if (kind === 'menu-event') return '菜单事件';
  return '自定义事件';
}

function actionHoverText(kind: LingCppReadableActionSummary['kind']): string {
  if (kind === 'message-box') return '运行到这里会弹出一个提示框。';
  if (kind === 'debug-output') return '运行到这里会向输出面板写入调试文本。';
  if (kind === 'exit-program') return '运行到这里会结束当前程序。';
  if (kind === 'set-control-text') return '运行到这里会修改窗口或控件显示文字。';
  if (kind === 'open-window') return '运行到这里会打开另一个窗口。';
  return '这是一段暂未结构化识别的高级代码。';
}

function findDesignerReadableName(handlerName: string, designerProject?: LingWindowProject): ReadableEventName | undefined {
  if (!designerProject) return undefined;
  const normalized = normalizeIdentifier(handlerName);
  for (const win of designerProject.windows) {
    const menuEntry = Object.entries(win.menuEvents || {}).find(([, handler]) => normalizeIdentifier(handler) === normalized);
    if (menuEntry) {
      const eventLabel = readableEventLabel(menuEntry[0]);
      const subject = win.title || win.className;
      return { rawName: handlerName, subject, eventLabel, displayName: `${subject} · ${eventLabel}` };
    }

    const windowEntry = Object.entries(win.events || {}).find(([, handler]) => normalizeIdentifier(handler) === normalized);
    if (windowEntry) {
      const eventLabel = eventNameLabel(windowEntry[0]);
      const subject = win.title || win.className;
      return { rawName: handlerName, subject, eventLabel, displayName: `${subject} · ${eventLabel}` };
    }

    for (const control of win.controls) {
      const eventEntry = Object.entries(control.events || {}).find(([, handler]) => normalizeIdentifier(handler) === normalized);
      if (eventEntry) {
        const eventLabel = readableEventLabel(eventEntry[0]);
        const subject = control.name || control.content || control.id;
        return { rawName: handlerName, subject, eventLabel, displayName: `${subject} · ${eventLabel}` };
      }
    }

    const windowNames = [win.className, win.title].filter(Boolean).map(value => normalizeIdentifier(value));
    if (windowNames.some(name => normalized.startsWith(name))) {
      const eventLabel = readableEventLabel(inferEventPartFromCompactName(normalized));
      const subject = win.title || win.className;
      return { rawName: handlerName, subject, eventLabel, displayName: `${subject} · ${eventLabel}` };
    }
  }
  return undefined;
}

function inferEventPartFromCompactName(value: string): string {
  const knownEvents = [
    ...WINDOW_EVENT_DEFINITIONS.flatMap(definition => [definition.name, definition.label, definition.handlerSuffix]),
    '鍒涘缓瀹屾瘯', '被单击', '琚崟鍑', '单击', '鍗曞嚮', '被双击', '琚弻鍑', '被选中', '琚€変腑', 'Click', 'DoubleClick', 'Created'
  ];
  return knownEvents.find(eventName => value.includes(eventName)) || value;
}

function readableEventLabel(value: string): string {
  const raw = value.replace(/^_+/u, '').replace(/\(\)\s*$/u, '');
  const registered = WINDOW_EVENT_DEFINITIONS.find(definition => raw === definition.name || raw === definition.label || raw.includes(definition.handlerSuffix));
  if (registered) return registered.label;
  if (/^(Click|被单击|单击|琚崟鍑|鍗曞嚮)$/u.test(raw) || raw.includes('被单击') || raw.includes('琚崟鍑')) return '单击事件';
  if (/^(DoubleClick|被双击|双击|琚弻鍑)$/u.test(raw) || raw.includes('被双击') || raw.includes('琚弻鍑')) return '双击事件';
  if (/^(Created|创建完毕|鍒涘缓瀹屾瘯|Window)$/u.test(raw) || raw.includes('创建完毕') || raw.includes('鍒涘缓瀹屾瘯')) return '创建完毕';
  if (/^(Item_|被选中|选中|选择|琚€変腑)/u.test(raw) || raw.includes('被选中') || raw.includes('琚€変腑')) return '菜单选择';
  if (/内容|鍐呭/u.test(raw)) return '内容改变';
  if (/焦点|鐒︾偣/u.test(raw)) return '焦点事件';
  return raw || '自定义事件';
}

function methodStructuralKind(trimmed: string): string {
  if (startsKeyword(trimmed, KEYWORD.constructor)) return 'constructor';
  if (startsKeyword(trimmed, KEYWORD.destructor)) return 'destructor';
  if (startsKeyword(trimmed, KEYWORD.event)) return 'event';
  return 'method';
}

function getBlockDiagnostics(source: string): LingCppDiagnostic[] {
  const lines = splitLines(source);
  const diagnostics: LingCppDiagnostic[] = [];
  const classStack: Array<{ line: number; text: string }> = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed) return;

    if (isClassStart(trimmed)) classStack.push({ line: lineNumber, text: line });

    if (isClassEnd(trimmed) && !classStack.pop()) {
      diagnostics.push(createDiagnostic('warning', lineNumber, line, '多余的类结束语句。', `删除多余的 ${KEYWORD.classEnd}。`));
    }
  });

  classStack.forEach(item => {
    diagnostics.push(createDiagnostic('error', item.line, item.text, '类声明缺少结束语句。', `在类末尾添加 ${KEYWORD.classEnd}。`));
  });

  return diagnostics;
}

function getUnknownDeclaredTypeDiagnostics(
  program: LingCppProgram,
  moduleContext?: LingCppModuleContext,
  projectTypes?: LingCppProjectTypeContext
): LingCppDiagnostic[] {
  const known = new Set([
    ...LING_CPP_TYPES.map(normalizeIdentifier),
    ...getProjectDataTypeNames(projectTypes).map(normalizeIdentifier),
    ...program.dataTypes.map(dataType => normalizeIdentifier(dataType.name)),
    ...program.classes.map(cls => normalizeIdentifier(cls.name)),
    ...(moduleContext?.enabledModules || []).flatMap(module => (module.manifest.contributes?.types || []).map(type => normalizeIdentifier(type.name))),
    '空', '无'
  ]);
  const diagnostics: LingCppDiagnostic[] = [];
  const check = (type: string, name: string, line: number, position: string) => {
    const itemType = type.replace(/(?:\[\]|［］)$/u, '');
    if (known.has(normalizeIdentifier(itemType)) || /控件|窗体/u.test(itemType)) return;
    diagnostics.push(createDiagnostic('error', line, `${type} ${name}`, `${position} ${name} 使用了未知类型 ${type}。`, '请选择内置类型、已启用模块类型或项目自定义数据类型。'));
  };
  program.globals.forEach(global => check(global.type, global.name, global.line, '项目全局变量'));
  program.classes.forEach(cls => {
    cls.members.forEach(member => check(member.type, member.name, member.line, '程序集变量'));
    cls.methods.forEach(method => {
      check(method.returnType, method.name, method.line, '子程序返回值');
      method.parameters.forEach(parameter => check(parameter.type, parameter.name, method.line, '参数'));
      (method.locals || []).forEach(local => check(local.type, local.name, local.line, local.isConstant ? '局部常量' : '局部变量'));
    });
  });
  program.functionLibraries.forEach(library => library.methods.forEach(method => {
    check(method.returnType, method.name, method.line, '功能库返回值');
    method.parameters.forEach(parameter => check(parameter.type, parameter.name, method.line, '功能库参数'));
    (method.locals || []).forEach(local => check(local.type, local.name, local.line, local.isConstant ? '功能库局部常量' : '功能库局部变量'));
  }));
  return diagnostics;
}

function getVariableDiagnostics(
  classes: LingCppClass[],
  moduleContext?: LingCppModuleContext,
  constants: LingCppConstant[] = [],
  globals: LingCppGlobalVariable[] = [],
  projectTypes?: LingCppProjectTypeContext
): LingCppDiagnostic[] {
  const diagnostics: LingCppDiagnostic[] = [];
  const globalTypes = projectSymbolTypes(constants, globals);
  const constantNames = new Set(constants.map(constant => normalizeIdentifier(constant.name)));
  classes.forEach(cls => {
    const memberTypes = new Map(cls.members.map(member => [normalizeIdentifier(member.name), member.type]));
    const methodNames = new Set(cls.methods.map(method => normalizeIdentifier(method.name)));
    cls.members.forEach(member => {
      if (constantNames.has(normalizeIdentifier(member.name))) {
        diagnostics.push(createDiagnostic('error', member.line, member.name, `程序集变量 ${member.name} 不能遮蔽同名项目常量。`, '请修改程序集变量或项目常量的名称。'));
        return;
      }
      if (!globalTypes.has(normalizeIdentifier(member.name))) return;
      diagnostics.push(createDiagnostic('warning', member.line, member.name, `程序集变量 ${member.name} 会遮蔽同名项目全局变量。`, '建议使用不同名称，避免新手模式中混淆变量作用域。'));
    });
    cls.methods.forEach(method => {
      const baseScopeTypes = new Map(globalTypes);
      memberTypes.forEach((type, name) => baseScopeTypes.set(name, type));
      method.parameters.forEach(parameter => {
        const name = normalizeIdentifier(parameter.name);
        if (constantNames.has(name)) diagnostics.push(createDiagnostic('error', method.line, parameter.name, `参数 ${parameter.name} 不能遮蔽同名项目常量。`, '请修改参数或项目常量的名称。'));
        if (globalTypes.has(name)) diagnostics.push(createDiagnostic('warning', method.line, parameter.name, `参数 ${parameter.name} 会遮蔽同名项目全局变量。`, '建议使用不同名称，避免混淆变量作用域。'));
        baseScopeTypes.set(name, parameter.type);
      });
      const orderedLocals = [...(method.locals || [])].sort((left, right) => left.line - right.line);
      const allLocalPositions = new Map(orderedLocals.map(local => [normalizeIdentifier(local.name), local.line]));
      const initializerScopeTypes = new Map(baseScopeTypes);
      orderedLocals.forEach(local => {
        const localLabel = local.isConstant ? '局部常量' : '局部变量';
        if (constantNames.has(normalizeIdentifier(local.name))) diagnostics.push(createDiagnostic('error', local.line, local.name, `${localLabel} ${local.name} 不能遮蔽同名项目常量。`, `请修改${localLabel}或项目常量的名称。`));
        if (globalTypes.has(normalizeIdentifier(local.name))) {
          diagnostics.push(createDiagnostic('warning', local.line, local.name, `${localLabel} ${local.name} 会遮蔽同名项目全局变量。`, '建议使用不同名称，或直接使用已有项目全局变量。'));
        }
        if (local.initialValue) {
          diagnostics.push(...getLocalInitializerReferenceDiagnostics(
            method,
            local,
            initializerScopeTypes,
            allLocalPositions,
            methodNames
          ));
          const actualType = inferLingCppExpressionType(local.initialValue, initializerScopeTypes, moduleContext, new Map(), projectTypes);
          if (actualType && !areLingCppTypesCompatible(local.type, actualType)) {
            diagnostics.push({
              id: `lingcpp-local-initializer-type-${method.name}-${local.name}-${local.line}`,
              line: local.line,
              level: 'error',
              message: `${localLabel} ${local.name} 的类型是 ${local.type}，不能使用 ${actualType} 初始化。`,
              codeSnippet: local.initialValue,
              suggestion: `请改用 ${local.type} 值，或修改局部变量类型。`
            });
          }
        }
        initializerScopeTypes.set(normalizeIdentifier(local.name), local.type);
      });

      method.statements.forEach(statement => {
        const scopeTypes = new Map(baseScopeTypes);
        orderedLocals
          .filter(local => local.line < statement.line)
          .forEach(local => scopeTypes.set(normalizeIdentifier(local.name), local.type));
        const readOnlyTarget = statement.text.trim().match(/^([\p{L}_][\p{L}\p{N}_]*)(?:\s*(?:\.\s*[\p{L}_][\p{L}\p{N}_]*|\[[^\]]+\]))*\s*[=＝](?!=)/u);
        if (readOnlyTarget?.[1]) {
          const localConstant = orderedLocals.find(local => (
            local.isConstant
            && local.line < statement.line
            && normalizeIdentifier(local.name) === normalizeIdentifier(readOnlyTarget[1] || '')
          ));
          if (localConstant) {
            diagnostics.push(createDiagnostic('error', statement.line, statement.text, `局部常量 ${localConstant.name} 是只读值，不能重新赋值。`, '请改用普通局部变量保存运行时变化的值。'));
            return;
          }
        }
        const assignment = statement.text.trim().match(/^([\p{L}_][\p{L}\p{N}_]*(?:\s*\.\s*[\p{L}_][\p{L}\p{N}_]*)*)\s*[=＝](?!=)\s*(.+?)\s*;?$/u);
        if (!assignment) return;
        const targetPath = (assignment[1] || '').split(/\s*\.\s*/u);
        const targetName = targetPath[0] || '';
        if (targetPath.length === 1 && constantNames.has(normalizeIdentifier(targetName))) {
          diagnostics.push(createDiagnostic('error', statement.line, statement.text, `项目常量 ${targetName} 是只读值，不能重新赋值。`, '请改用局部变量或项目全局变量保存运行时变化的值。'));
          return;
        }
        const rootType = scopeTypes.get(normalizeIdentifier(targetName));
        const rootIsProjectType = projectTypes?.dataTypes.some(dataType => normalizeIdentifier(dataType.name) === normalizeIdentifier(rootType || ''));
        if (targetPath.length > 1 && rootType && !rootIsProjectType) return;
        const targetType = targetPath.length === 1 ? rootType : resolveProjectFieldPathType(rootType, targetPath.slice(1), projectTypes);
        if (!targetType) {
          diagnostics.push({
            id: `lingcpp-undeclared-variable-${method.name}-${targetName}-${statement.line}`,
            line: statement.line,
            level: 'error',
            message: rootType ? `类型 ${rootType} 中不存在字段 ${targetPath.slice(1).join('.')}。` : `变量 ${targetName} 尚未声明。`,
            codeSnippet: statement.text,
            suggestion: `请在 ${method.name} 的局部变量表、程序集变量表或项目全局变量表中声明 ${targetName}。`
          });
          return;
        }
        const actualType = inferLingCppExpressionType(assignment[2] || '', scopeTypes, moduleContext, new Map(), projectTypes);
        if (actualType && !areLingCppTypesCompatible(targetType, actualType)) {
          diagnostics.push({
            id: `lingcpp-assignment-type-${method.name}-${targetName}-${statement.line}`,
            line: statement.line,
            level: 'error',
            message: `不能把 ${actualType} 赋值给 ${targetType} 变量 ${targetName}。`,
            codeSnippet: statement.text,
            suggestion: `请调整 ${targetName} 的类型或赋值表达式。`
          });
        }
      });
    });
  });
  return diagnostics;
}

function getLocalInitializerReferenceDiagnostics(
  method: LingCppMethod,
  local: NonNullable<LingCppMethod['locals']>[number],
  scopeTypes: ReadonlyMap<string, string>,
  allLocalPositions: ReadonlyMap<string, number>,
  methodNames: ReadonlySet<string>
): LingCppDiagnostic[] {
  const expression = local.initialValue || '';
  const withoutStrings = expression.replace(/(?:L)?"(?:\\.|[^"\\])*"|“[^”]*”/gu, match => ' '.repeat(match.length));
  const diagnostics: LingCppDiagnostic[] = [];
  const seen = new Set<string>();
  for (const match of withoutStrings.matchAll(/[\p{L}_][\p{L}\p{N}_]*/gu)) {
    const name = match[0];
    const normalized = normalizeIdentifier(name);
    if (seen.has(normalized) || /^(真|假)$/u.test(name)) continue;
    const index = match.index || 0;
    const before = withoutStrings.slice(0, index).trimEnd();
    const after = withoutStrings.slice(index + name.length);
    if (before.endsWith('.')) continue;
    if (before.endsWith('&') && methodNames.has(normalized)) continue;
    if (/^\s*[（(]/u.test(after)) continue;
    if (/^\s*\.\s*[\p{L}_][\p{L}\p{N}_]*\s*[（(]/u.test(after)) continue;
    if (scopeTypes.has(normalized)) continue;
    seen.add(normalized);
    const declarationLine = allLocalPositions.get(normalized);
    const reason = normalized === normalizeIdentifier(local.name)
      ? '不能在初始化表达式中引用自身'
      : declarationLine !== undefined && declarationLine >= local.line
        ? `只能引用声明在它之前的局部值，${name} 尚未声明`
        : `引用了未知名称 ${name}`;
    diagnostics.push({
      id: `lingcpp-local-initializer-reference-${method.name}-${local.name}-${normalized}-${local.line}`,
      line: local.line,
      level: 'error',
      message: `${local.isConstant ? '局部常量' : '局部变量'} ${local.name} 的初始值无效：${reason}。`,
      codeSnippet: expression,
      suggestion: '请只使用参数、成员、项目符号、前置局部值或可调用的子程序与模块命令。'
    });
  }
  return diagnostics;
}

function getModuleUsageDiagnostics(source: string, moduleContext?: LingCppModuleContext): LingCppDiagnostic[] {
  if (!moduleContext?.availableModules?.length) return [];
  const enabledIds = new Set(getEnabledLingCppModuleContributions(moduleContext).map(module => module.manifest.id));
  const diagnostics: LingCppDiagnostic[] = [];
  const lines = splitLines(source);

  moduleContext.availableModules
    .filter(module => !enabledIds.has(module.manifest.id))
    .forEach(module => {
      (module.manifest.contributes?.commands || []).forEach(command => {
        const invokedName = [command.name, ...(command.aliases || [])]
          .find(name => lines.some(line => containsCommandInvocation(line, name)));
        const lineIndex = invokedName ? lines.findIndex(line => containsCommandInvocation(line, invokedName)) : -1;
        if (lineIndex < 0) return;
        diagnostics.push({
          id: `lingcpp-module-disabled-${module.manifest.id}-${command.name}-${lineIndex + 1}`,
          line: lineIndex + 1,
          level: 'warning',
          message: `命令 ${invokedName || command.name} 来自 ${module.manifest.name}，当前项目尚未引用该模块。`,
          codeSnippet: lines[lineIndex],
          suggestion: `请在模块页启用 ${module.manifest.name}，或移除该命令调用。`
        });
      });
    });

  return diagnostics;
}

const THREADING_LEGACY_MIGRATIONS: Record<(typeof THREADING_LEGACY_COMMANDS)[number], string> = {
  线程_启动延时输出: '新建工作处理器，在其中调用 线程_协作等待(毫秒) 和 调试输出，再使用 线程_提交(&工作处理器, 参数...)。',
  线程_等待全部: '保存线程任务，并改用 线程_等待全部超时(超时毫秒, 任务...)。',
  线程_活动数量: '改用 线程池_取运行数量(线程池_取默认池()) 与 线程池_取等待数量(线程池_取默认池())。',
  线程_硬件并发数: '改用 线程池_取硬件并发数()。',
  线程_休眠: '工作处理器内改用可响应取消的 线程_协作等待(毫秒)。',
  线程_启动延时设置文本: '把延时工作放入工作处理器，把控件更新放入完成处理器；完成处理器会在 UI 线程执行。',
  线程_启动延时添加行: '把延时工作放入工作处理器，把列表更新放入完成处理器；不要把 controlRef 传入工作线程。',
  线程_启动延时添加项目: '把延时工作放入工作处理器，把列表更新放入完成处理器；不要把 controlRef 传入工作线程。',
  线程_批量启动: '改为自定义线程池 + 工作/进度/完成处理器，并由进度处理器更新 UI。'
};

function getThreadingDiagnostics(
  source: string,
  program: LingCppProgram,
  moduleContext: LingCppModuleContext | undefined,
  globals: LingCppGlobalVariable[],
  projectTypes?: LingCppProjectTypeContext
): LingCppDiagnostic[] {
  const threadingModule = [...(moduleContext?.enabledModules || []), ...(moduleContext?.availableModules || [])]
    .find(module => module.manifest.id === 'lingbuilder.threading');
  if (!threadingModule) return [];
  const diagnostics: LingCppDiagnostic[] = [];
  const sourceLines = splitLines(source);

  THREADING_LEGACY_COMMANDS.forEach(command => sourceLines.forEach((line, index) => {
    if (!containsCommandInvocation(line, command)) return;
    diagnostics.push(createDiagnostic(
      'error', index + 1, line,
      `多线程模块 2.0 已删除旧命令 ${command}，不能继续构建。`,
      THREADING_LEGACY_MIGRATIONS[command]
    ));
  }));

  const enabledThreading = (moduleContext?.enabledModules || []).find(module => module.manifest.id === 'lingbuilder.threading');
  if (!enabledThreading) return diagnostics;
  const managedBindings = (enabledThreading.manifest.bindings?.commands || []).filter(binding => binding.invocation?.kind === 'managedTask');
  const opaqueTypes = new Set((moduleContext?.enabledModules || []).flatMap(module => (module.manifest.contributes?.types || [])
    .filter(type => (type.kind || 'opaque') === 'opaque' && module.manifest.id !== 'lingbuilder.threading')
    .map(type => normalizeIdentifier(type.name))));
  const structuredTypes = new Set([
    ...(projectTypes?.dataTypes || []).map(type => normalizeIdentifier(type.name)),
    ...(moduleContext?.enabledModules || []).flatMap(module => (module.manifest.contributes?.types || [])
      .filter(type => type.kind === 'record' || type.kind === 'array')
      .map(type => normalizeIdentifier(type.name)))
  ]);
  const globalTypes = new Map(globals.map(global => [normalizeIdentifier(global.name), global.type]));
  const controlRefCommands = getEnabledLingCppModuleContributions(moduleContext).flatMap(module => {
    const aliases = new Map((module.manifest.contributes?.commands || []).map(command => [command.name, command.aliases || []]));
    return (module.manifest.bindings?.commands || [])
      .filter(binding => (binding.parameters || []).some(parameter => parameter.type === 'controlRef'))
      .flatMap(binding => [binding.command, ...(aliases.get(binding.command) || [])]);
  });

  program.classes.forEach(cls => {
    const handlers = new Map(cls.methods.map(method => [normalizeIdentifier(method.name), method]));
    cls.methods.forEach(caller => {
      const scopeTypes = new Map<string, string>(globalTypes);
      cls.members.forEach(member => scopeTypes.set(normalizeIdentifier(member.name), member.isArray ? `${member.type}[]` : member.type));
      caller.parameters.forEach(item => scopeTypes.set(normalizeIdentifier(item.name), item.type));
      (caller.locals || []).forEach(item => scopeTypes.set(normalizeIdentifier(item.name), item.isArray ? `${item.type}[]` : item.type));

      caller.statements.filter(statement => !isLingCppCommentLine(statement.text)).forEach(statement => managedBindings.forEach(binding => {
        const commandNames = [binding.command, ...((enabledThreading.manifest.contributes?.commands || []).find(command => command.name === binding.command)?.aliases || [])];
        commandNames.flatMap(command => extractCommandInvocationArguments(statement.text, command)).forEach(args => {
          validateThreadingManagedInvocation(binding, args, statement, handlers, scopeTypes, moduleContext, projectTypes, opaqueTypes, structuredTypes, diagnostics);
        });
      }));
    });

    const memberNames = new Set(cls.members.map(member => normalizeIdentifier(member.name)));
    handlers.forEach(handler => {
      if (!isThreadWorkerHandler(source, handler.name, managedBindings)) return;
      const usesMutex = handler.statements.some(statement => containsCommandInvocation(statement.text, '互斥锁_执行') || containsCommandInvocation(statement.text, '互斥锁_尝试执行'));
      const workerExpressions = [
        ...handler.statements,
        ...(handler.locals || []).filter(local => local.initialValue).map(local => ({
          line: local.line,
          text: sourceLines[local.line - 1] || local.initialValue || ''
        }))
      ];
      workerExpressions.forEach(expression => {
        const uiCall = controlRefCommands.find(command => containsCommandInvocation(expression.text, command))
          || expression.text.match(/(?:^|[^\p{L}\p{N}_])((?:控件|窗口|列表视图|表格|树形框|选项卡|信息框|文件对话框|菜单|EdgeView|CEF3|FBro)_[\p{L}\p{N}_]+|信息框)\s*[（(]/u)?.[1];
        if (uiCall) diagnostics.push(createDiagnostic('error', expression.line, expression.text, `工作处理器 ${handler.name} 不能调用 UI/controlRef 命令 ${uiCall}。`, '把 UI 操作移动到进度处理器或完成处理器；它们会在发起窗口 UI 线程执行。'));
      });
      handler.statements.forEach(statement => {
        const assignment = statement.text.match(/^\s*([\p{L}_][\p{L}\p{N}_]*)\s*[=＝](?!=)/u)?.[1];
        const writesShared = assignment && (memberNames.has(normalizeIdentifier(assignment)) || globalTypes.has(normalizeIdentifier(assignment)));
        if (writesShared && !usesMutex) diagnostics.push(createDiagnostic('warning', statement.line, statement.text, `工作处理器 ${handler.name} 写入共享值 ${assignment}，但未检测到互斥锁保护。`, '请使用 互斥锁_执行/互斥锁_尝试执行，或改用线程原子整数。'));
      });
    });
  });
  return diagnostics;
}

function validateThreadingManagedInvocation(
  binding: ModuleCommandBinding,
  args: string[],
  statement: LingCppStatement,
  handlers: Map<string, LingCppMethod>,
  scopeTypes: Map<string, string>,
  moduleContext: LingCppModuleContext | undefined,
  projectTypes: LingCppProjectTypeContext | undefined,
  opaqueTypes: Set<string>,
  structuredTypes: Set<string>,
  diagnostics: LingCppDiagnostic[]
): void {
  const invocation = binding.invocation!;
  const requiredCount = invocation.variadicParameterIndex;
  if (args.length < requiredCount) {
    diagnostics.push(createDiagnostic('error', statement.line, statement.text, `${binding.command} 缺少处理器或固定参数。`, `请按 ${binding.command} 的补全签名填写参数。`));
    return;
  }
  const worker = requireThreadHandler(binding, '工作处理器', args[invocation.workerParameterIndex], statement, handlers, diagnostics);
  const values = args.slice(invocation.variadicParameterIndex);
  if (worker) {
    if (worker.parameters.length !== values.length) {
      diagnostics.push(createDiagnostic('error', statement.line, statement.text, `工作处理器 ${worker.name} 需要 ${worker.parameters.length} 个参数，但提交了 ${values.length} 个。`, '参数数量必须与工作处理器形参逐项一致；允许 0 个或任意多个参数。'));
    }
    worker.parameters.forEach((parameter, index) => {
      if (!isThreadCopyableType(parameter.type, opaqueTypes, structuredTypes)) {
        diagnostics.push(createDiagnostic('error', statement.line, statement.text, `工作处理器参数 ${parameter.name} 的类型 ${parameter.type} 不能在线程间按值深拷贝。`, '仅允许基础类型、文本、字节集、数组、记录及多线程模块自己的受管句柄；禁止 controlRef、外部 opaque、原生句柄和引用。'));
      }
      const actual = values[index] ? inferLingCppExpressionType(values[index]!, scopeTypes, moduleContext, new Map(), projectTypes) : undefined;
      if (actual && !areLingCppTypesCompatible(parameter.type, actual)) {
        diagnostics.push(createDiagnostic('error', statement.line, statement.text, `传给 ${worker.name} 的第 ${index + 1} 个参数类型为 ${actual}，与形参 ${parameter.type} 不匹配。`, '请调整提交参数或工作处理器形参，参数必须逐项匹配。'));
      }
    });
  }

  if (invocation.progressParameterIndex !== undefined) {
    const progress = requireThreadHandler(binding, '进度处理器', args[invocation.progressParameterIndex], statement, handlers, diagnostics);
    if (progress && (!isVoidType(progress.returnType) || progress.parameters.length !== 3
      || !isTaskType(progress.parameters[0]?.type) || !areLingCppTypesCompatible('整数型', progress.parameters[1]?.type || '')
      || !areLingCppTypesCompatible('文本型', progress.parameters[2]?.type || ''))) {
      diagnostics.push(createDiagnostic('error', statement.line, statement.text, `进度处理器 ${progress.name} 的签名无效。`, '进度处理器必须为：空 处理器(线程任务 任务, 整数型 百分比, 文本型 说明)。'));
    }
  }

  if (invocation.completionParameterIndex !== undefined) {
    const completion = requireThreadHandler(binding, '完成处理器', args[invocation.completionParameterIndex], statement, handlers, diagnostics);
    if (completion && worker) {
      const expectedCount = isVoidType(worker.returnType) ? 1 : 2;
      const resultMatches = expectedCount === 1 || areLingCppTypesCompatible(worker.returnType, completion.parameters[1]?.type || '');
      if (!isVoidType(completion.returnType) || completion.parameters.length !== expectedCount || !isTaskType(completion.parameters[0]?.type) || !resultMatches) {
        diagnostics.push(createDiagnostic('error', statement.line, statement.text, `完成处理器 ${completion.name} 与工作处理器 ${worker.name} 的返回类型不匹配。`, isVoidType(worker.returnType)
          ? '工作返回空时，完成处理器必须为：空 处理器(线程任务 任务)。'
          : `完成处理器必须为：空 处理器(线程任务 任务, ${worker.returnType} 结果)。`));
      }
    }
  }
}

function requireThreadHandler(
  binding: ModuleCommandBinding,
  role: string,
  value: string | undefined,
  statement: LingCppStatement,
  handlers: Map<string, LingCppMethod>,
  diagnostics: LingCppDiagnostic[]
): LingCppMethod | undefined {
  const reference = value?.trim().match(/^&([\p{L}_][\p{L}\p{N}_]*)$/u)?.[1];
  if (!reference) {
    diagnostics.push(createDiagnostic('error', statement.line, statement.text, `${binding.command} 的${role}必须使用 &处理器名 引用语法。`, '不要使用字符串或普通变量传递处理器。'));
    return undefined;
  }
  const handler = handlers.get(normalizeIdentifier(reference));
  if (!handler) diagnostics.push(createDiagnostic('error', statement.line, statement.text, `找不到${role} ${reference}。`, '请在当前窗口类中声明该处理器，并保持签名一致。'));
  return handler;
}

function isThreadCopyableType(type: string, opaqueTypes: Set<string>, structuredTypes: Set<string>): boolean {
  const normalized = type.trim().replace(/(?:\[\]|［］)$/u, '');
  const key = normalizeIdentifier(normalized);
  if (/^(?:文本型|文本|字符串|字符串型|整数型|整数|长整数型|长整数|小数型|小数|双精度|双精度型|双精度小数型|逻辑型|逻辑|布尔型|布尔|字节型|字节|字节集)$/u.test(normalized)) return true;
  if (/^(?:线程任务|线程任务状态|线程池|线程互斥锁|线程原子整数|线程同步事件|线程信号量)$/u.test(normalized)) return true;
  if (structuredTypes.has(key)) return true;
  if (opaqueTypes.has(key) || /(?:控件|窗体|窗口|句柄|指针|引用|&|\*)/u.test(normalized)) return false;
  return false;
}

function isVoidType(type: string | undefined): boolean { return !type || /^(?:空|void)$/iu.test(type.trim()); }
function isTaskType(type: string | undefined): boolean { return Boolean(type && /^(?:线程任务|长整数型|长整数)$/u.test(type.trim())); }

function isThreadWorkerHandler(source: string, handlerName: string, bindings: ModuleCommandBinding[]): boolean {
  return bindings.some(binding => binding.invocation?.operation === 'submit'
    && [binding.command].some(command => extractCommandInvocationArguments(source, command)
      .some(args => args[binding.invocation!.workerParameterIndex]?.trim() === `&${handlerName}`)));
}

function getModuleHandlerDiagnostics(source: string, program: LingCppProgram, moduleContext?: LingCppModuleContext): LingCppDiagnostic[] {
  const diagnostics: LingCppDiagnostic[] = [];
  const lines = splitLines(source);
  const handlers = new Map<string, LingCppMethod[]>();
  [...program.classes.flatMap(cls => cls.methods), ...program.functionLibraries.flatMap(library => library.methods)].forEach(method => {
    const key = normalizeIdentifier(method.name);
    handlers.set(key, [...(handlers.get(key) || []), method]);
  });
  getEnabledLingCppModuleContributions(moduleContext).forEach(module => {
    (module.manifest.bindings?.commands || []).forEach(binding => {
      if (binding.invocation?.kind === 'managedTask') return;
      const handlerIndexes = (binding.parameters || []).map((parameter, index) => parameter.type === 'handler' ? index : -1).filter(index => index >= 0);
      if (handlerIndexes.length === 0) return;
      const aliases = (module.manifest.contributes?.commands || []).find(command => command.name === binding.command)?.aliases || [];
      [binding.command, ...aliases].forEach(commandName => lines.forEach((line, lineIndex) => {
        if (isLingCppCommentLine(line.trim())) return;
        extractCommandInvocationArguments(line, commandName).forEach(args => handlerIndexes.forEach(index => {
          const value = args[index]?.trim();
          const parameter = binding.parameters?.[index];
          const signature = parameter?.handlerSignature;
          if (signature) {
            const reference = value?.match(/^&([\p{L}_][\p{L}\p{N}_]*)$/u)?.[1];
            const legacy = parseStringLiteralArgument(value);
            if (!reference) {
              diagnostics.push({
                id: `lingcpp-handler-reference-${binding.command}-${lineIndex + 1}-${index}`,
                line: lineIndex + 1,
                level: 'error',
                message: `命令 ${binding.command} 的处理器必须使用 &处理器名 引用语法。`,
                codeSnippet: line,
                suggestion: legacy ? `请改为 &${legacy}。` : '请引用当前类中签名匹配的事件或方法。'
              });
              return;
            }
            const candidates = handlers.get(normalizeIdentifier(reference)) || [];
            if (candidates.length === 0) {
              diagnostics.push({
                id: `lingcpp-handler-missing-${binding.command}-${lineIndex + 1}-${index}`,
                line: lineIndex + 1,
                level: 'error',
                message: `命令 ${binding.command} 引用的处理器 ${reference} 不存在。`,
                codeSnippet: line,
                suggestion: `请在当前类中声明 ${signature.returnType} ${reference}(${signature.parameterTypes.join(', ')})。`
              });
              return;
            }
            const matches = candidates.some(handler => {
              if (handler.parameters.length !== signature.parameterTypes.length) return false;
              if (!handler.parameters.every((item, parameterIndex) => areLingCppTypesCompatible(signature.parameterTypes[parameterIndex] || '', item.type))) return false;
              return isVoidType(signature.returnType)
                ? isVoidType(handler.returnType)
                : areLingCppTypesCompatible(signature.returnType, handler.returnType || '空');
            });
            if (!matches) diagnostics.push({
              id: `lingcpp-handler-signature-${binding.command}-${lineIndex + 1}-${index}`,
              line: lineIndex + 1,
              level: 'error',
              message: `命令 ${binding.command} 的处理器 ${reference} 签名不匹配。`,
              codeSnippet: line,
              suggestion: `处理器必须声明为 ${signature.returnType} ${reference}(${signature.parameterTypes.join(', ')})。`
            });
            return;
          }
          const legacy = parseStringLiteralArgument(value);
          if (!legacy || value?.startsWith('&')) return;
          diagnostics.push({
            id: `lingcpp-handler-reference-migration-${binding.command}-${lineIndex + 1}-${index}`,
            line: lineIndex + 1,
            level: 'warning',
            message: `命令 ${binding.command} 的处理器字符串写法仅用于旧项目兼容。`,
            codeSnippet: line,
            suggestion: `请改为 &${legacy}，以便补全、诊断、跳转、重命名和 C++ 生成统一识别处理器引用。`
          });
        }));
      }));
    });
  });
  return diagnostics;
}

function containsCommandInvocation(line: string, commandName: string): boolean {
  if (!commandName || !line.includes(commandName)) return false;
  const escaped = commandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*[（(]`, 'u').test(line);
}

function collectModuleCallbackHandlerNames(source: string, moduleContext?: LingCppModuleContext): Set<string> {
  const handlers = new Set<string>();
  getEnabledLingCppModuleContributions(moduleContext).forEach(module => {
    (module.manifest.bindings?.commands || []).forEach(binding => {
      const callbackParameterIndexes = (binding.parameters || [])
        .map((parameter, index) => isModuleCallbackParameter(parameter.name, parameter.description) ? index : -1)
        .filter(index => index >= 0);
      if (callbackParameterIndexes.length === 0) return;

      const aliases = (module.manifest.contributes?.commands || [])
        .find(command => command.name === binding.command)?.aliases || [];
      [binding.command, ...aliases].flatMap(commandName => extractCommandInvocationArguments(source, commandName)).forEach(args => {
        callbackParameterIndexes.forEach(index => {
          const handlerName = parseModuleHandlerArgument(args[index]);
          if (handlerName) handlers.add(normalizeIdentifier(handlerName));
        });
      });
    });
  });
  return handlers;
}

function parseModuleHandlerArgument(value?: string): string | undefined {
  const reference = value?.trim().match(/^&([\w\u4e00-\u9fa5]+)$/u);
  return reference?.[1] || parseStringLiteralArgument(value);
}

function isModuleCallbackParameter(name: string, description?: string): boolean {
  return /(?:事件)?(?:处理器|回调)(?:名|名称)?|handler|callback/iu.test(`${name} ${description || ''}`);
}

function extractCommandInvocationArguments(source: string, commandName: string): string[][] {
  if (!commandName) return [];
  const escaped = commandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escaped}\\s*[（(]`, 'gu');
  const invocations: string[][] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const openIndex = pattern.lastIndex - 1;
    const closing = source[openIndex] === '（' ? '）' : ')';
    let quote: '"' | '“' | null = null;
    let escapedCharacter = false;
    let depth = 1;
    let endIndex = openIndex + 1;

    for (; endIndex < source.length; endIndex += 1) {
      const character = source[endIndex];
      if (quote) {
        if (escapedCharacter) {
          escapedCharacter = false;
          continue;
        }
        if (character === '\\' && quote === '"') {
          escapedCharacter = true;
          continue;
        }
        if ((quote === '"' && character === '"') || (quote === '“' && character === '”')) quote = null;
        continue;
      }
      if (character === '"' || character === '“') {
        quote = character;
        continue;
      }
      if (character === source[openIndex]) depth += 1;
      if (character === closing) {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    if (depth !== 0) continue;
    invocations.push(splitModuleCallArguments(source.slice(openIndex + 1, endIndex)));
    pattern.lastIndex = endIndex + 1;
  }
  return invocations;
}

function splitModuleCallArguments(raw: string): string[] {
  const args: string[] = [];
  let current = '';
  let quote: '"' | '“' | null = null;
  let escapedCharacter = false;
  let depth = 0;

  for (const character of raw) {
    if (quote) {
      current += character;
      if (escapedCharacter) {
        escapedCharacter = false;
      } else if (character === '\\' && quote === '"') {
        escapedCharacter = true;
      } else if ((quote === '"' && character === '"') || (quote === '“' && character === '”')) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === '“') {
      quote = character;
      current += character;
      continue;
    }
    if (character === '(' || character === '（' || character === '[' || character === '【' || character === '{') depth += 1;
    if (character === ')' || character === '）' || character === ']' || character === '】' || character === '}') depth = Math.max(0, depth - 1);
    if ((character === ',' || character === '，') && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  if (current.trim() || args.length > 0) args.push(current.trim());
  return args;
}

function parseStringLiteralArgument(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/gu, '"').trim() || undefined;
  }
  if (trimmed.startsWith('“') && trimmed.endsWith('”')) {
    return trimmed.slice(1, -1).trim() || undefined;
  }
  return undefined;
}

function selectDesignerWindows(project: LingWindowProject, source: string, filePath?: string): LingWindowModel[] {
  const associatedFile = extractAssociatedDesignerFile(source);
  if (associatedFile) {
    const byDesignerFile = project.windows.filter(win => normalizePathName(win.fileName) === normalizePathName(associatedFile));
    if (byDesignerFile.length > 0) return byDesignerFile;
    return [];
  }

  const parsed = parseLingCpp(source);
  const sourceClassNames = new Set(parsed.program.classes.map(cls => normalizeIdentifier(cls.name)));
  const byClass = project.windows.filter(win => sourceClassNames.has(normalizeIdentifier(win.className)));
  if (byClass.length > 0) return byClass;

  const normalizedPath = filePath?.replace(/\\/g, '/').toLowerCase();
  if (!normalizedPath) return project.windows;

  return project.windows.filter(win => {
    const classSourceName = `${win.className}.lcpp`.toLowerCase();
    const xmlSourceName = win.fileName.replace(/\.xml$/i, '.lcpp').toLowerCase();
    return normalizedPath.endsWith(classSourceName) || normalizedPath.endsWith(xmlSourceName);
  });
}

function isDesignerControlMethodDiagnostic(
  diagnostic: LingCppDiagnostic,
  source: string,
  designerProject?: LingWindowProject,
  filePath?: string
): boolean {
  if (!designerProject || !diagnostic.message.startsWith('找不到功能库“')) return false;
  const lines = splitLines(source);
  const lineIndex = Math.max(0, diagnostic.line - 1);
  const nearbySource = lines.slice(Math.max(0, lineIndex - 1), lineIndex + 2).join('\n');
  const candidates = [diagnostic.codeSnippet || '', nearbySource];
  const calls = candidates.flatMap(candidate => [...candidate.matchAll(/([\p{L}_][\p{L}\p{N}_]*)\s*\.\s*([\p{L}_][\p{L}\p{N}_]*)\s*[（(]/gu)]);
  const imageControlNames = new Set(selectDesignerWindows(designerProject, source, filePath)
    .flatMap(window => window.controls)
    .filter(control => control.type === 'Image')
    .map(control => normalizeIdentifier(control.name)));
  if (calls.length === 0) return false;
  const call = calls.find(match => match[2] === '设置图片');
  if (!call?.[1]) return false;
  return imageControlNames.has(normalizeIdentifier(call[1]));
}

function collectDesignerEventBindings(windows: LingWindowModel[], resources: LingDesignerResource[] = []) {
  const windowIds = new Set(windows.map(window => window.id));
  const resourceBindings = resources
    .filter((resource): resource is LingFileDialogResource => resource.type === 'FileDialog' && windowIds.has(resource.ownerWindowId))
    .flatMap(resource => {
      const ownerWindow = windows.find(window => window.id === resource.ownerWindowId);
      if (!ownerWindow) return [];
      return [
        ['FilesSelected', resource.filesSelectedHandler],
        ['FilesDropped', resource.filesDroppedHandler],
        ['Cancelled', resource.cancelledHandler]
      ].flatMap(([eventName, handlerName]) => handlerName?.trim() ? [{
        handlerName: handlerName.trim(),
        className: ownerWindow.className,
        controlName: resource.name,
        controlId: resource.id,
        eventName,
        windowId: ownerWindow.id
      }] : []);
    });
  const menuResourceBindings = resources
    .filter((resource): resource is LingMenuResource => (resource.type === 'ContextMenu' || resource.type === 'PopupMenu') && windowIds.has(resource.ownerWindowId))
    .flatMap(resource => {
      const ownerWindow = windows.find(window => window.id === resource.ownerWindowId);
      if (!ownerWindow) return [];
      return resource.items.flatMap(item => item.selectedHandler?.trim() ? [{
        handlerName: item.selectedHandler.trim(),
        className: ownerWindow.className,
        controlName: `${resource.name}.${item.label}`,
        controlId: `${resource.id}:${item.id}`,
        eventName: 'ItemSelected',
        windowId: ownerWindow.id
      }] : []);
    });
  const windowBindings = windows
    .flatMap(win => {
      const controlBindings = win.controls.flatMap(control =>
        Object.entries(control.events || {}).map(([eventName, handlerName]) => ({
          handlerName,
          className: win.className,
          controlName: control.name,
          controlId: control.id,
          eventName,
          windowId: win.id
        }))
      );
      const menuBindings = Object.entries(win.menuEvents || {}).map(([eventName, handlerName]) => ({
        handlerName,
        className: win.className,
        controlName: win.title || win.className,
        controlId: undefined,
        eventName,
        windowId: win.id
      }));
      const windowBindings = Object.entries(win.events || {})
        .filter(([, handlerName]) => handlerName.trim())
        .map(([eventName, handlerName]) => ({
          handlerName,
          className: win.className,
          controlName: win.title || win.className,
          controlId: undefined,
          eventName,
          windowId: win.id
        }));
      return [...controlBindings, ...menuBindings, ...windowBindings];
    });
  return [...windowBindings, ...resourceBindings, ...menuResourceBindings];
}

function extractAssociatedDesignerFile(source: string): string | undefined {
  return source.match(/(?:关联设计文件|DesignerFile)\s*=\s*["']([^"']+\.xml)["']/iu)?.[1]?.trim();
}

function findWindowEventMatch(handlerName: string, className: string, windows: LingWindowModel[]): LingWindowModel | undefined {
  const normalizedHandler = normalizeIdentifier(handlerName);
  const isBareWindowEvent = WINDOW_EVENT_DEFINITIONS.some(definition => [
    definition.name,
    definition.label,
    definition.handlerSuffix
  ].some(alias => normalizeIdentifier(alias) === normalizedHandler));
  if (isBareWindowEvent) {
    return windows.find(win => normalizeIdentifier(win.className) === normalizeIdentifier(className)) || windows[0];
  }
  return windows.find(win => {
    const normalizedClass = normalizeIdentifier(className || win.className);
    const normalizedWindowClass = normalizeIdentifier(win.className);
    const normalizedTitle = normalizeIdentifier(win.title || '');
    const normalizedHandlerPrefix = normalizedHandler.split('_')[0] || '';
    return normalizedHandlerPrefix === normalizedClass
      || normalizedHandlerPrefix === normalizedWindowClass
      || normalizedHandlerPrefix === normalizedTitle
      || normalizedHandler.startsWith(`${normalizedClass}_`)
      || normalizedHandler.startsWith(normalizedClass)
      || normalizedHandler.startsWith(`${normalizedWindowClass}_`)
      || normalizedHandler.startsWith(normalizedWindowClass);
  });
}

function normalizePathName(value: string): string {
  return value.replace(/\\/g, '/').split('/').pop()?.toLowerCase() || value.toLowerCase();
}

function findClassEndLines(lines: string[]): Map<number, number> {
  return findPairedLines(lines, isClassStart, isClassEnd);
}

function findMethodEndLines(lines: string[]): Map<number, number> {
  const ranges = new Map<number, number>();
  let activeMethodLine: number | null = null;
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (activeMethodLine && (isMethodStart(trimmed) || isAccessLine(trimmed) || isClassEnd(trimmed) || isFunctionLibraryEnd(trimmed))) {
      ranges.set(activeMethodLine, Math.max(activeMethodLine, lineNumber - 1));
      activeMethodLine = null;
    }
    if (isMethodStart(trimmed)) activeMethodLine = lineNumber;
  });
  if (activeMethodLine) ranges.set(activeMethodLine, lines.length);
  return ranges;
}

function findPairedLines(lines: string[], isStart: (line: string) => boolean, isEnd: (line: string) => boolean): Map<number, number> {
  const pairs = new Map<number, number>();
  const stack: number[] = [];
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (isStart(trimmed)) stack.push(lineNumber);
    if (isEnd(trimmed)) {
      const start = stack.pop();
      if (start) pairs.set(start, lineNumber);
    }
  });
  return pairs;
}

function addRange(ranges: LingCppFoldingRange[], startLine: number, endLine: number): void {
  if (endLine > startLine) ranges.push({ startLine, endLine, kind: 'region' });
}

function splitLines(source: string): string[] {
  return source.split(/\r?\n/);
}

function findFirstKeywordLine(lines: string[], keyword: string): number | undefined {
  const index = lines.findIndex(line => startsKeyword(line.trim(), keyword));
  return index >= 0 ? index + 1 : undefined;
}

function findLineContaining(lines: string[], keyword: string, value: string): number {
  const index = lines.findIndex(line => startsKeyword(line.trim(), keyword) && line.includes(value));
  return index >= 0 ? index + 1 : 1;
}

function findLineContainingText(lines: string[], value: string): number | undefined {
  const index = lines.findIndex(line => line.includes(value));
  return index >= 0 ? index + 1 : undefined;
}

function isClassStart(trimmed: string): boolean {
  return startsKeyword(trimmed, KEYWORD.class);
}

function isClassEnd(trimmed: string): boolean {
  return startsKeyword(trimmed, KEYWORD.classEnd);
}

function isFunctionLibraryStart(trimmed: string): boolean {
  return startsKeyword(trimmed, KEYWORD.functionLibrary);
}

function isFunctionLibraryEnd(trimmed: string): boolean {
  return startsKeyword(trimmed, KEYWORD.functionLibraryEnd);
}

function isAccessLine(trimmed: string): boolean {
  return ACCESS_KEYWORDS.some(keyword => startsKeyword(trimmed.replace(/[：:]\s*$/u, ''), keyword));
}

function isMethodStart(trimmed: string): boolean {
  return METHOD_KEYWORDS.some(keyword => startsKeyword(trimmed, keyword)) && /[()锛?]/u.test(trimmed);
}

function isIfStart(trimmed: string): boolean {
  return startsKeyword(trimmed, KEYWORD.if) && !startsKeyword(trimmed, KEYWORD.ifEnd);
}

function isIfEnd(trimmed: string): boolean {
  return startsKeyword(trimmed, KEYWORD.ifEnd);
}

function isLoopStart(trimmed: string): boolean {
  return startsKeyword(trimmed, KEYWORD.loop) && !startsKeyword(trimmed, KEYWORD.loopEnd);
}

function isLoopEnd(trimmed: string): boolean {
  return startsKeyword(trimmed, KEYWORD.loopEnd);
}

function startsKeyword(line: string, keyword: string): boolean {
  if (!keyword) return false;
  if (line === keyword) return true;
  if (!line.startsWith(keyword)) return false;
  const next = line.slice(keyword.length, keyword.length + 1);
  return !next || /[\s:：()锛?]/u.test(next);
}

function inferControlNameFromHandler(handlerName: string): string {
  return handlerName.trim().replace(/^_+/u, '').split('_')[0] || '';
}

function createDiagnostic(
  level: LingCppDiagnostic['level'],
  line: number,
  codeSnippet: string,
  message: string,
  suggestion: string
): LingCppDiagnostic {
  return {
    id: `lingcpp-language-${level}-${line}-${message}`,
    line,
    level,
    message,
    codeSnippet,
    suggestion
  };
}

function dedupeDiagnostics(diagnostics: LingCppDiagnostic[]): LingCppDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter(diagnostic => {
    const key = `${diagnostic.level}:${diagnostic.line}:${diagnostic.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
