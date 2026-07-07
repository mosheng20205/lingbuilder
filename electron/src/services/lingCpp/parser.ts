import {
  LingCppAccessModifier,
  LingCppAst,
  LingCppAstNode,
  LingCppAstNodeKind,
  LingCppClass,
  LingCppDiagnostic,
  LingCppMember,
  LingCppMethod,
  LingCppParameter,
  LingCppParseResult,
  LingCppProgram,
  LingCppSourceRange,
  LingCppStatement,
  LingCppSymbolIndex
} from './types';

export const LING_CPP_KEYWORDS = [
  '包',
  '使用',
  '类',
  '公开',
  '私有',
  '保护',
  '构造',
  '析构',
  '事件',
  '空',
  '返回',
  '如果',
  '否则',
  '如果结束',
  '循环',
  '循环结束',
  '结束类',
  '静态'
];

export const LING_CPP_COMMANDS = [
  '信息框',
  '调试输出',
  '结束',
  '打开窗口',
  '载入窗口',
  '载入新窗口',
  '窗口_打开',
  '窗口_关闭',
  '窗口_置标题',
  '窗口_取标题'
];

export const LING_CPP_TYPES = [
  '窗体',
  '文本型',
  '整数型',
  '长整数型',
  '逻辑型',
  '小数型',
  '双精度小数型',
  '窗口',
  '按钮',
  '编辑框',
  '标签',
  '复选框',
  '单选框',
  '进度条',
  '下拉框'
];

const CLASS_RE = /^类\s+([\w\u4e00-\u9fa5]+)(?:\s*[:：]\s*(?:公开|私有|保护)?\s*([\w\u4e00-\u9fa5]+))?/;
const ACCESS_RE = /^(公开|私有|保护)\s*[:：]?$/;
const METHOD_RE = new RegExp(
  `^(静态\\s+)?(${['事件', '构造', '析构', '空', ...LING_CPP_TYPES].map(escapeRegexLiteral).join('|')})\\s*([\\w\\u4e00-\\u9fa5]*)\\s*[（(]([^）)]*)[）)]`
);
const MEMBER_RE = new RegExp(
  `^(静态\\s+)?(${LING_CPP_TYPES.map(escapeRegexLiteral).join('|')})\\s+([\\w\\u4e00-\\u9fa5]+)(?:\\s*(\\[\\]|［］))?(?:\\s*[=＝]\\s*(.+))?$`
);

export function parseLingCpp(source: string): LingCppParseResult {
  const diagnostics: LingCppDiagnostic[] = [];
  const program: LingCppProgram = {
    packageName: '',
    uses: [],
    classes: [],
    diagnostics,
    source
  };

  const lines = source.split(/\r?\n/);
  let currentClass: LingCppClass | null = null;
  let currentClassNode: LingCppAstNode | null = null;
  let currentAccess: LingCppAccessModifier = '私有';
  let currentMethod: LingCppMethod | null = null;
  let currentMethodNode: LingCppAstNode | null = null;
  const astNodes: LingCppAstNode[] = [];
  const rootNode = createAstNode('program', '源文件', 1, lines[0] || '', undefined, {
    range: createDocumentRange(lines)
  });
  astNodes.push(rootNode);

  const pushNode = (node: LingCppAstNode, parent: LingCppAstNode | null = rootNode) => {
    if (parent) {
      node.parentId = parent.id;
      parent.children.push(node);
    }
    astNodes.push(node);
    return node;
  };

  const closeCurrentMethod = (endLine: number) => {
    if (!currentMethod || !currentMethodNode) return;
    const safeEndLine = Math.max(currentMethod.line, Math.min(Math.max(1, lines.length), endLine));
    currentMethod.endLine = safeEndLine;
    setNodeEndRange(currentMethodNode, lines, safeEndLine);
    currentMethod = null;
    currentMethodNode = null;
  };

  const closeCurrentClass = (endLine: number) => {
    if (!currentClass || !currentClassNode) return;
    closeCurrentMethod(Math.max(currentClass.line, endLine - 1));
    const safeEndLine = Math.max(currentClass.line, Math.min(Math.max(1, lines.length), endLine));
    currentClass.endLine = safeEndLine;
    setNodeEndRange(currentClassNode, lines, safeEndLine);
    currentClass = null;
    currentClassNode = null;
    currentAccess = '私有';
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (!trimmed) {
      appendStatement(currentMethod, line, lineNumber);
      return;
    }

    if (trimmed.startsWith('//') || trimmed.startsWith('注释 ')) {
      appendStatement(currentMethod, line, lineNumber);
      pushNode(createAstNode('comment', trimmed, lineNumber, line, currentMethodNode?.id || currentClassNode?.id || rootNode.id, {
        value: trimmed
      }), currentMethodNode || currentClassNode || rootNode);
      return;
    }

    if (trimmed.startsWith('包 ')) {
      program.packageName = trimmed.slice('包'.length).trim();
      pushNode(createAstNode('package', program.packageName, lineNumber, line, rootNode.id, {
        value: program.packageName
      }));
      return;
    }

    if (trimmed.startsWith('使用 ')) {
      const useName = trimmed.slice('使用'.length).trim();
      program.uses.push(useName);
      pushNode(createAstNode('use', useName, lineNumber, line, rootNode.id, {
        value: useName
      }));
      return;
    }

    const classMatch = trimmed.match(CLASS_RE);
    if (classMatch) {
      if (currentClass) closeCurrentClass(lineNumber - 1);
      currentClass = {
        name: classMatch[1],
        baseClass: classMatch[2] || undefined,
        line: lineNumber,
        members: [],
        methods: []
      };
      currentClassNode = pushNode(createAstNode('class', currentClass.name, lineNumber, line, rootNode.id, {
        access: currentAccess,
        type: currentClass.baseClass,
        detail: currentClass.baseClass ? `继承 ${currentClass.baseClass}` : '类'
      }));
      currentAccess = '私有';
      program.classes.push(currentClass);
      return;
    }

    if (trimmed === '结束类') {
      closeCurrentClass(lineNumber);
      return;
    }

    const accessMatch = trimmed.match(ACCESS_RE);
    if (accessMatch) {
      closeCurrentMethod(lineNumber - 1);
      currentAccess = accessMatch[1] as LingCppAccessModifier;
      pushNode(createAstNode('access', currentAccess, lineNumber, line, currentClassNode?.id || rootNode.id, {
        access: currentAccess,
        detail: '访问修饰符'
      }), currentClassNode || rootNode);
      return;
    }

    if (!currentClass) {
      diagnostics.push(createDiagnostic('warning', lineNumber, line, '类外语句不会参与中文 C++ 生成。', '请把语句放入 `类 ... 结束类` 内。'));
      pushNode(createAstNode('statement', trimmed, lineNumber, line, rootNode.id, {
        value: trimmed,
        detail: '类外语句'
      }));
      return;
    }

    const methodMatch = trimmed.match(METHOD_RE);
    if (methodMatch) {
      closeCurrentMethod(lineNumber - 1);
      const isStatic = Boolean(methodMatch[1]);
      const prefix = methodMatch[2];
      const declaredName = methodMatch[3]?.trim();
      const method: LingCppMethod = {
        name: normalizeMethodName(prefix, declaredName, currentClass.name),
        returnType: methodReturnType(prefix),
        access: currentAccess,
        isStatic: isStatic && methodKind(prefix) === 'method',
        kind: methodKind(prefix),
        line: lineNumber,
        parameters: parseParameters(methodMatch[4] || ''),
        statements: []
      };
      currentClass.methods.push(method);
      currentMethod = method;
      const methodNodeKind = method.kind;
      currentMethodNode = pushNode(createAstNode(methodNodeKind, method.name, lineNumber, line, currentClassNode?.id, {
        access: currentAccess,
        returnType: method.returnType,
        isStatic: method.isStatic,
        detail: method.kind === 'event' ? '事件处理器' : method.returnType
      }), currentClassNode);
      method.parameters.forEach(parameter => {
        pushNode(createAstNode('parameter', parameter.name, lineNumber, line, currentMethodNode?.id, {
          type: parameter.type,
          detail: '参数'
        }), currentMethodNode);
      });
      return;
    }

    const memberMatch = trimmed.match(MEMBER_RE);
    if (memberMatch && !currentMethod) {
      const member: LingCppMember = {
        type: memberMatch[2],
        name: memberMatch[3],
        access: currentAccess,
        line: lineNumber,
        initialValue: memberMatch[5]?.trim(),
        isStatic: Boolean(memberMatch[1]),
        isArray: Boolean(memberMatch[4])
      };
      currentClass.members.push(member);
      pushNode(createAstNode('member', member.name, lineNumber, line, currentClassNode?.id, {
        access: member.access,
        type: member.type,
        value: member.initialValue,
        isStatic: member.isStatic,
        isArray: member.isArray,
        detail: [
          member.isStatic ? '静态' : '',
          member.type,
          member.isArray ? '数组' : '',
          member.initialValue ? `= ${member.initialValue}` : ''
        ].filter(Boolean).join(' ')
      }), currentClassNode);
      return;
    }

    const statement = appendStatement(currentMethod, line, lineNumber);
    pushNode(createAstNode('statement', trimmed, lineNumber, line, currentMethodNode?.id || currentClassNode?.id, {
      value: statement?.text || trimmed,
      detail: currentMethod ? '方法语句' : '未识别类成员'
    }), currentMethodNode || currentClassNode);
  });

  if (currentMethod) closeCurrentMethod(lines.length);
  if (currentClass && currentClassNode) {
    currentClass.endLine = lines.length;
    setNodeEndRange(currentClassNode, lines, lines.length);
    diagnostics.push(createDiagnostic('error', currentClass.line, lines[currentClass.line - 1] || `类 ${currentClass.name}`, '类声明缺少结束语句。', '请在类末尾添加 `结束类`。'));
  }

  if (program.classes.length === 0) {
    diagnostics.push(createDiagnostic('error', 1, lines[0] || '', '未找到中文 C++ 类。', '请添加 `类 游戏主窗体 : 公开 窗体`。'));
  }

  program.classes.forEach(cls => {
    if (!cls.methods.some(method => method.kind === 'constructor')) {
      diagnostics.push(createDiagnostic('info', cls.line, `类 ${cls.name}`, `类 ${cls.name} 未声明构造函数。`, '可添加 `公开: 构造()` 初始化窗口状态。'));
    }
  });

  const symbolIndex = buildLingCppSymbolIndex(astNodes);
  const ast: LingCppAst = {
    version: 1,
    source,
    range: createDocumentRange(lines),
    root: rootNode,
    nodes: astNodes,
    symbolIndex,
    diagnostics,
    program
  };

  return { program, ast, symbolIndex, diagnostics };
}

export function getLingCppDiagnostics(source: string): LingCppDiagnostic[] {
  return parseLingCpp(source).diagnostics;
}

export function findLingCppMethod(program: LingCppProgram, handlerName: string): LingCppMethod | undefined {
  const normalized = normalizeIdentifier(handlerName);
  for (const cls of program.classes) {
    const direct = cls.methods.find(method => normalizeIdentifier(method.name) === normalized);
    if (direct) return direct;
    const withoutPrefix = cls.methods.find(method => normalizeIdentifier(`${cls.name}_${method.name}`) === normalized);
    if (withoutPrefix) return withoutPrefix;
  }
  return undefined;
}

export function normalizeIdentifier(value: string): string {
  return value.trim().replace(/^_+/, '').replace(/\s+/g, '');
}

export function buildLingCppSymbolIndex(nodes: LingCppAstNode[]): LingCppSymbolIndex {
  const index: LingCppSymbolIndex = {
    declarations: [],
    classes: [],
    members: [],
    methods: [],
    events: [],
    byName: {},
    byLine: {}
  };

  nodes.forEach(node => {
    if (node.kind === 'package' || node.kind === 'use' || node.kind === 'designer') index.declarations.push(node);
    if (node.kind === 'class') index.classes.push(node);
    if (node.kind === 'member') index.members.push(node);
    if (node.kind === 'constructor' || node.kind === 'destructor' || node.kind === 'method') index.methods.push(node);
    if (node.kind === 'event') index.events.push(node);
    const normalizedName = normalizeIdentifier(node.name);
    if (normalizedName) {
      index.byName[normalizedName] = [...(index.byName[normalizedName] || []), node];
    }
    index.byLine[node.range.startLine] = [...(index.byLine[node.range.startLine] || []), node];
  });

  return index;
}

function appendStatement(method: LingCppMethod | null, line: string, lineNumber: number): LingCppStatement | undefined {
  if (!method) return undefined;
  const indent = line.match(/^\s*/)?.[0] || '';
  const text = line.slice(indent.length);
  const statement: LingCppStatement = { line: lineNumber, indent, text };
  method.statements.push(statement);
  return statement;
}

function parseParameters(raw: string): LingCppParameter[] {
  return splitParameterParts(raw)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const { definition, defaultValue } = splitParameterDefault(part);
      const [type, ...nameParts] = definition.split(/\s+/u).filter(Boolean);
      const name = nameParts.join('');
      const parameter: LingCppParameter = {
        type: name ? type : '对象',
        name: name || type
      };
      if (defaultValue) parameter.defaultValue = defaultValue;
      return parameter;
    });
}

function splitParameterParts(raw: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: string | null = null;
  let depth = 0;

  for (const char of raw) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(' || char === '（') {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ')' || char === '）') {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if ((char === ',' || char === '，') && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  parts.push(current);
  return parts;
}

function splitParameterDefault(part: string): { definition: string; defaultValue?: string } {
  let quote: string | null = null;
  let depth = 0;

  for (let index = 0; index < part.length; index += 1) {
    const char = part[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(' || char === '（') {
      depth += 1;
      continue;
    }
    if (char === ')' || char === '）') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (char === '=' && depth === 0) {
      const definition = part.slice(0, index).trim();
      const defaultValue = part.slice(index + 1).trim();
      return { definition, defaultValue: defaultValue || undefined };
    }
  }

  return { definition: part.trim() };
}

function normalizeMethodName(prefix: string, declaredName: string | undefined, className: string): string {
  if (prefix === '构造') return className;
  if (prefix === '析构') return `销毁_${className}`;
  return declaredName || '未命名方法';
}

function methodReturnType(prefix: string): string {
  if (prefix === '事件' || prefix === '构造' || prefix === '析构') return '空';
  return prefix;
}

function methodKind(prefix: string): LingCppMethod['kind'] {
  if (prefix === '构造') return 'constructor';
  if (prefix === '析构') return 'destructor';
  if (prefix === '事件') return 'event';
  return 'method';
}

function createDiagnostic(
  level: LingCppDiagnostic['level'],
  line: number,
  codeSnippet: string,
  message: string,
  suggestion: string
): LingCppDiagnostic {
  return {
    id: `lingcpp-${level}-${line}-${message}`,
    line,
    level,
    message,
    codeSnippet,
    suggestion
  };
}

function createAstNode(
  kind: LingCppAstNodeKind,
  name: string,
  lineNumber: number,
  lineText: string,
  parentId?: string,
  overrides: Partial<Omit<LingCppAstNode, 'id' | 'kind' | 'name' | 'children'>> = {}
): LingCppAstNode {
  const normalizedName = normalizeIdentifier(name) || kind;
  return {
    id: `lingcpp-ast-${kind}-${lineNumber}-${normalizedName}`,
    kind,
    name,
    range: overrides.range || createLineRange(lineNumber, lineText),
    parentId,
    detail: overrides.detail,
    value: overrides.value,
    access: overrides.access,
    type: overrides.type,
    returnType: overrides.returnType,
    isStatic: overrides.isStatic,
    isArray: overrides.isArray,
    children: []
  };
}

function createLineRange(lineNumber: number, lineText: string): LingCppSourceRange {
  const trimmed = lineText.trim();
  const startColumn = trimmed ? lineText.indexOf(trimmed) + 1 : 1;
  return {
    startLine: lineNumber,
    startColumn,
    endLine: lineNumber,
    endColumn: lineText.length + 1
  };
}

function createDocumentRange(lines: string[]): LingCppSourceRange {
  const safeLineCount = Math.max(1, lines.length);
  return {
    startLine: 1,
    startColumn: 1,
    endLine: safeLineCount,
    endColumn: (lines[safeLineCount - 1] || '').length + 1
  };
}

function setNodeEndRange(node: LingCppAstNode, lines: string[], endLine: number): void {
  const safeLine = Math.max(node.range.startLine, Math.min(Math.max(1, lines.length), endLine));
  node.range.endLine = safeLine;
  node.range.endColumn = (lines[safeLine - 1] || '').length + 1;
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
