import { LING_CPP_KEYWORDS, LING_CPP_TYPES, normalizeIdentifier, parseLingCpp } from './parser';
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
  LingCppCompletionCatalogItem,
  LingCppCompletionContext,
  LingCppCompletionContextKind,
  LingCppCompletionItem,
  LingCppDesignerBindingHint,
  LingCppDiagnostic,
  LingCppDocumentSymbol,
  LingCppEventBlockHighlight,
  LingCppFoldingRange,
  LingCppInlineHint,
  LingCppMethod,
  LingCppProblem,
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
import { LingWindowModel, LingWindowProject } from '../windowDesigner/types';
import { LingCppModuleContext } from '../modules/types';

const KEYWORD = {
  package: LING_CPP_KEYWORDS[0],
  use: LING_CPP_KEYWORDS[1],
  class: LING_CPP_KEYWORDS[2],
  public: LING_CPP_KEYWORDS[3],
  private: LING_CPP_KEYWORDS[4],
  protected: LING_CPP_KEYWORDS[5],
  constructor: LING_CPP_KEYWORDS[6],
  destructor: LING_CPP_KEYWORDS[7],
  event: LING_CPP_KEYWORDS[8],
  if: LING_CPP_KEYWORDS[11],
  ifEnd: LING_CPP_KEYWORDS[13],
  loop: LING_CPP_KEYWORDS[14],
  loopEnd: LING_CPP_KEYWORDS[15],
  classEnd: LING_CPP_KEYWORDS[16]
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
  const ifStack: number[] = [];
  const loopStack: number[] = [];
  let activeMethodLine: number | null = null;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (activeMethodLine && (isMethodStart(trimmed) || isAccessLine(trimmed) || isClassEnd(trimmed))) {
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

    if (isMethodStart(trimmed)) {
      activeMethodLine = lineNumber;
      return;
    }

    if (isIfStart(trimmed)) {
      ifStack.push(lineNumber);
      return;
    }

    if (isIfEnd(trimmed)) {
      const startLine = ifStack.pop();
      if (startLine) addRange(ranges, startLine, lineNumber);
      return;
    }

    if (isLoopStart(trimmed)) {
      loopStack.push(lineNumber);
      return;
    }

    if (isLoopEnd(trimmed)) {
      const startLine = loopStack.pop();
      if (startLine) addRange(ranges, startLine, lineNumber);
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
  moduleContext?: LingCppModuleContext
): LingCppDiagnostic[] {
  const diagnostics = [...parseLingCpp(source).diagnostics, ...getBlockDiagnostics(source)];
  diagnostics.push(...getModuleUsageDiagnostics(source, moduleContext));

  if (designerProject) {
    getLingCppDesignerBindings(source, designerProject, filePath).forEach(hint => {
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
  }

  return dedupeDiagnostics(diagnostics);
}

export function buildLingCppLanguageContext(
  source: string,
  designerProject?: LingWindowProject,
  moduleContext?: LingCppModuleContext,
  filePath?: string
): LingCppLanguageContext {
  const parsed = parseLingCpp(source);
  const designerBindings = getLingCppDesignerBindings(source, designerProject, filePath);
  return {
    source,
    filePath,
    ast: parsed.ast,
    program: parsed.program,
    symbolIndex: parsed.symbolIndex,
    diagnostics: getLingCppSemanticDiagnostics(source, designerProject, filePath, moduleContext),
    designerBindings,
    designerProject,
    moduleContext,
    moduleContributions: getLingCppModuleCompletionItems(moduleContext)
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
  const contextKind = getLingCppCompletionContextKind(context.source, context.line, context.column);
  const symbolItems = getCurrentSymbolCompletionItems(languageContext);
  const designerItems = getDesignerCompletionItems(context.source, languageContext.designerProject as LingWindowProject | undefined);
  const moduleItems = languageContext.moduleContributions;
  const catalogItems = getCatalogCompletionItems(contextKind);
  return dedupeLingCppCompletionItems(
    rankLingCppCompletionItems([...symbolItems, ...designerItems, ...moduleItems, ...catalogItems], contextKind),
    context.triggerText
  );
}

export function getLingCppHover(
  context: LingCppCompletionContext,
  languageContext = buildLingCppLanguageContext(context.source)
): LingCppHover | undefined {
  const nodes = languageContext.symbolIndex.byLine[context.line] || [];
  const node = nodes.find(item => item.kind !== 'program' && item.kind !== 'statement') || nodes[0];
  if (!node) return undefined;
  return {
    line: context.line,
    column: context.column,
    range: node.range,
    contents: hoverTextForAstNode(node)
  };
}

function getCurrentSymbolCompletionItems(languageContext: LingCppLanguageContext): LingCppCompletionCatalogItem[] {
  const nodes = [
    ...languageContext.symbolIndex.classes,
    ...languageContext.symbolIndex.members,
    ...languageContext.symbolIndex.methods,
    ...languageContext.symbolIndex.events
  ];
  return nodes
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
}

function completionKindForAstNode(node: LingCppAstNode): LingCppCompletionItem['kind'] {
  if (node.kind === 'class') return 'type';
  if (node.kind === 'member') return 'type';
  if (node.kind === 'event') return 'event';
  if (node.kind === 'method' || node.kind === 'constructor' || node.kind === 'destructor') return 'function';
  return 'keyword';
}

function symbolDetailForAstNode(node: LingCppAstNode): string {
  if (node.kind === 'class') return node.type ? `当前源码类 · 继承 ${node.type}` : '当前源码类';
  if (node.kind === 'member') return `当前成员 · ${node.type || '未标注类型'}`;
  if (node.kind === 'event') return '当前事件处理器';
  if (node.kind === 'method' || node.kind === 'constructor' || node.kind === 'destructor') return `当前方法 · ${node.returnType || '空'}`;
  return '当前源码符号';
}

function hoverTextForAstNode(node: LingCppAstNode): string {
  if (node.kind === 'package') return `包：${node.name}`;
  if (node.kind === 'use') return `使用：${node.name}`;
  if (node.kind === 'class') return node.type ? `类：${node.name}\n基础类：${node.type}` : `类：${node.name}`;
  if (node.kind === 'member') return `成员：${node.name}\n类型：${node.type || '未标注'}\n访问：${node.access || '私有'}`;
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

  return 'top-level';
}

export function getLingCppProblems(
  source: string,
  designerProject?: LingWindowProject,
  filePath = 'src/未命名.lcpp'
): LingCppProblem[] {
  const parseDiagnostics = [...parseLingCpp(source).diagnostics, ...getBlockDiagnostics(source)];
  const parserProblems = parseDiagnostics.map(diagnostic => ({
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
    ? getLingCppDesignerBindings(source, designerProject, filePath)
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
        actionLabel: actionLabelForBinding(binding.status)
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
  filePath?: string
): LingCppStructureNode[] {
  const parsed = parseLingCpp(source);
  const bindings = getLingCppDesignerBindings(source, designerProject, filePath);
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
  filePath?: string
): LingCppStructuredReadingRow[] {
  const parsed = parseLingCpp(source);
  const rows: LingCppStructuredReadingRow[] = [];
  const blocks = getLingCppReadableBlocks(source, designerProject, filePath);
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
      rows.push({
        id: `reading-member-${member.name}-${member.line}`,
        group: 'member',
        name: member.name,
        type: member.type,
        value: member.initialValue || '',
        note: memberNote(member.type, member.name),
        line: member.line
      });
    });

    cls.methods.forEach(method => {
      const block = blockByLine.get(method.line);
      if (method.kind === 'event') {
        rows.push({
          id: `reading-event-${method.name}-${method.line}`,
          group: 'event',
          name: block?.readableName?.displayName || method.name,
          type: eventKindLabel(block?.kind || 'custom-event'),
          value: block?.summary || '',
          note: eventNote(block?.kind || 'custom-event', block?.readableName?.subject || method.name),
          line: method.line,
          blockId: block?.id,
          status: block?.bindingStatus
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
        note: method.kind === 'constructor' ? '窗口初始化时执行' : '普通代码逻辑',
        line: method.line,
        blockId: block?.id
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
  const blocks = getLingCppReadableBlocks(source, designerProject, languageContext.filePath);
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
      rows.push({
        id: `structured-member-${member.name}-${member.line}`,
        group: 'member',
        name: member.name,
        type: member.type,
        value: [member.access, member.initialValue ? `初始值 ${member.initialValue}` : ''].filter(Boolean).join(' · '),
        note: memberNote(member.type, member.name),
        line: member.line,
        editable: true,
        editKind: 'member',
        className: cls.name,
        targetName: member.name,
        access: member.access,
        initialValue: member.initialValue
      });
    });

    cls.methods.forEach(method => {
      const block = blockByLine.get(method.line);
      const binding = bindingByHandler.get(normalizeIdentifier(method.name));
      const parameterText = formatParameterList(method.parameters);
      if (method.kind === 'event') {
        rows.push({
          id: `structured-event-${method.name}-${method.line}`,
          group: 'event',
          name: block?.readableName?.displayName || method.name,
          type: binding?.eventName || eventKindLabel(block?.kind || 'custom-event'),
          value: bindingStatusText(binding?.status),
          note: binding?.detailText || eventNote(block?.kind || 'custom-event', block?.readableName?.subject || method.name),
          line: method.line,
          blockId: block?.id,
          status: binding?.status || block?.bindingStatus,
          editable: true,
          editKind: 'event',
          className: cls.name,
          targetName: method.name,
          access: method.access,
          returnType: method.returnType,
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
        note: block?.summary || (method.kind === 'constructor' ? '窗口初始化时执行' : '普通代码逻辑'),
        line: method.line,
        blockId: block?.id,
        editable: method.kind === 'method',
        editKind: method.kind === 'method' ? 'method' : undefined,
        className: cls.name,
        targetName: method.name,
        access: method.access,
        returnType: method.returnType,
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
  filePath?: string
): LingCppReadableBlock[] {
  const parsed = parseLingCpp(source);
  const lines = splitLines(source);
  const classEnds = findClassEndLines(lines);
  const methodEnds = findMethodEndLines(lines);
  const bindings = getLingCppDesignerBindings(source, designerProject, filePath);
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
  mode: LingCppReadingMode = 'beginner'
): LingCppInlineHint[] {
  if (mode === 'off') return [];
  const parsed = parseLingCpp(source);
  const blocks = getLingCppReadableBlocks(source, designerProject, filePath);
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
  filePath?: string
): LingCppEventBlockHighlight[] {
  return getLingCppReadableBlocks(source, designerProject, filePath)
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

    if (isIfEnd(trimmed) || isLoopEnd(trimmed)) {
      bodyIndent = Math.max(0, bodyIndent - 1);
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

    if (isIfStart(trimmed) || isLoopStart(trimmed)) {
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
  filePath?: string
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
  const classLineByName = new Map(parsed.program.classes.map(cls => [normalizeIdentifier(cls.name), cls.line]));
  const fallbackDiagnosticLine = parsed.program.classes[0]?.line || 1;
  const sourceEventMap = new Map(sourceEvents.map(event => [normalizeIdentifier(event.handlerName), event]));
  const expectedBindings = collectDesignerEventBindings(currentWindows);
  const expectedMap = new Map(expectedBindings.map(binding => [normalizeIdentifier(binding.handlerName), binding]));
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

    const inferredControlName = inferControlNameFromHandler(event.handlerName);
    const windowMatch = currentWindows.find(win => normalizeIdentifier(win.className) === normalizeIdentifier(event.className));
    const controlExists = currentWindows.some(win =>
      win.controls.some(control => normalizeIdentifier(control.name) === normalizeIdentifier(inferredControlName))
    );

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
    hints.push({
      status: 'missing-source',
      line: classLineByName.get(normalizeIdentifier(binding.className)) || fallbackDiagnosticLine,
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

function getDesignerCompletionItems(source: string, designerProject?: LingWindowProject): LingCppCompletionItem[] {
  if (!designerProject) return [];
  return selectDesignerWindows(designerProject, source).flatMap(win => {
    const windowItems: LingCppCompletionItem[] = [{
      label: `${win.title || win.className} 创建完毕事件`,
      kind: 'event',
      insertText: `事件 _${win.className}_创建完毕()\n    调试输出("窗口创建完毕")\n    $0`,
      detail: '设计器窗口事件',
      documentation: `窗口：${win.title || win.className}\n事件：创建完毕`,
      aliases: ['WindowCreated', 'Created'],
      pinyin: ['ckcjsj', 'csh'],
      example: `事件 _${win.className}_创建完毕()`,
      category: 'designer',
      audienceText: '窗口创建完成后执行',
      isSnippet: true
    }];

    const controlItems = win.controls.flatMap(control => {
      const boundEvents = Object.entries(control.events || {});
      const eventEntries = boundEvents.length > 0 ? boundEvents : [['Click', `_${control.name}_被单击`]];
      return eventEntries.map(([eventName, handlerName]) => ({
        label: `${control.name} ${eventNameLabel(eventName)}事件`,
        kind: 'event' as const,
        insertText: `事件 ${handlerName}()\n    $0`,
        detail: `设计器控件：${control.name}`,
        documentation: `控件：${control.name}\n事件：${eventNameLabel(eventName)}\n处理器：${handlerName}`,
        aliases: [control.name, handlerName, eventName, 'Click', 'ButtonClick'],
        pinyin: ['kjsj', 'dj', 'ansj'],
        example: `事件 ${handlerName}()`,
        category: 'designer' as const,
        audienceText: `用户操作 ${control.name} 后执行`,
        isSnippet: true
      }));
    });

    return [...windowItems, ...controlItems];
  });
}

function memberNote(type: string, name: string): string {
  if (/按钮|鎸夐挳|Button/u.test(type)) return `${name} 是一个可以被点击的按钮控件`;
  if (/标签|鏍囩|Label/u.test(type)) return `${name} 用来显示说明文字`;
  if (/文本|鏂囨湰|Text/u.test(type)) return `${name} 保存一段文本`;
  return '类里面保存的数据或控件';
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
    class: 1,
    member: 2,
    method: 3,
    constructor: 3,
    event: 4,
    parameter: 5,
    note: 6
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
  if (binding?.eventName === 'Window') return 'window-event';
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
  const knownEvents = ['创建完毕', '鍒涘缓瀹屾瘯', '被单击', '琚崟鍑', '单击', '鍗曞嚮', '被双击', '琚弻鍑', '被选中', '琚€変腑', 'Click', 'DoubleClick', 'Created'];
  return knownEvents.find(eventName => value.includes(eventName)) || value;
}

function readableEventLabel(value: string): string {
  const raw = value.replace(/^_+/u, '').replace(/\(\)\s*$/u, '');
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
  const stacks: Record<'class' | 'if' | 'loop', Array<{ line: number; text: string }>> = {
    class: [],
    if: [],
    loop: []
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed) return;

    if (isClassStart(trimmed)) stacks.class.push({ line: lineNumber, text: line });
    if (isIfStart(trimmed)) stacks.if.push({ line: lineNumber, text: line });
    if (isLoopStart(trimmed)) stacks.loop.push({ line: lineNumber, text: line });

    if (isClassEnd(trimmed) && !stacks.class.pop()) {
      diagnostics.push(createDiagnostic('warning', lineNumber, line, '多余的类结束语句。', `删除多余的 ${KEYWORD.classEnd}。`));
    }
    if (isIfEnd(trimmed) && !stacks.if.pop()) {
      diagnostics.push(createDiagnostic('warning', lineNumber, line, '多余的条件结束语句。', `删除多余的 ${KEYWORD.ifEnd}。`));
    }
    if (isLoopEnd(trimmed) && !stacks.loop.pop()) {
      diagnostics.push(createDiagnostic('warning', lineNumber, line, '多余的循环结束语句。', `删除多余的 ${KEYWORD.loopEnd}。`));
    }
  });

  stacks.class.forEach(item => {
    diagnostics.push(createDiagnostic('error', item.line, item.text, '类声明缺少结束语句。', `在类末尾添加 ${KEYWORD.classEnd}。`));
  });
  stacks.if.forEach(item => {
    diagnostics.push(createDiagnostic('error', item.line, item.text, '条件语句缺少结束语句。', `在条件块末尾添加 ${KEYWORD.ifEnd}。`));
  });
  stacks.loop.forEach(item => {
    diagnostics.push(createDiagnostic('error', item.line, item.text, '循环语句缺少结束语句。', `在循环块末尾添加 ${KEYWORD.loopEnd}。`));
  });

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
        const lineIndex = lines.findIndex(line => containsCommandInvocation(line, command.name));
        if (lineIndex < 0) return;
        diagnostics.push({
          id: `lingcpp-module-disabled-${module.manifest.id}-${command.name}-${lineIndex + 1}`,
          line: lineIndex + 1,
          level: 'warning',
          message: `命令 ${command.name} 来自 ${module.manifest.name}，当前项目尚未引用该模块。`,
          codeSnippet: lines[lineIndex],
          suggestion: `请在模块页启用 ${module.manifest.name}，或移除该命令调用。`
        });
      });
    });

  return diagnostics;
}

function containsCommandInvocation(line: string, commandName: string): boolean {
  if (!commandName || !line.includes(commandName)) return false;
  const escaped = commandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*[（(]`, 'u').test(line);
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

function collectDesignerEventBindings(windows: LingWindowModel[]) {
  return windows
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
      return [...controlBindings, ...menuBindings];
    });
}

function extractAssociatedDesignerFile(source: string): string | undefined {
  const match = source.match(/=\s*["']([^"']+\.xml)["']/i) || source.match(/["']([^"']+\.xml)["']/i);
  return match?.[1]?.trim();
}

function findWindowEventMatch(handlerName: string, className: string, windows: LingWindowModel[]): LingWindowModel | undefined {
  const normalizedHandler = normalizeIdentifier(handlerName);
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
    if (activeMethodLine && (isMethodStart(trimmed) || isAccessLine(trimmed) || isClassEnd(trimmed))) {
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
