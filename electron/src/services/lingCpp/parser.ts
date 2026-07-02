import {
  LingCppAccessModifier,
  LingCppClass,
  LingCppDiagnostic,
  LingCppMember,
  LingCppMethod,
  LingCppParameter,
  LingCppParseResult,
  LingCppProgram,
  LingCppStatement
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
  '结束类'
];

export const LING_CPP_COMMANDS = [
  '信息框',
  '调试输出',
  '结束',
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
  `^(${['事件', '构造', '析构', '空', ...LING_CPP_TYPES].map(escapeRegexLiteral).join('|')})\\s*([\\w\\u4e00-\\u9fa5]*)\\s*[（(]([^）)]*)[）)]`
);
const MEMBER_RE = new RegExp(
  `^(${LING_CPP_TYPES.map(escapeRegexLiteral).join('|')})\\s+([\\w\\u4e00-\\u9fa5]+)(?:\\s*[=＝]\\s*(.+))?$`
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
  let currentAccess: LingCppAccessModifier = '私有';
  let currentMethod: LingCppMethod | null = null;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('注释 ')) {
      appendStatement(currentMethod, line, lineNumber);
      return;
    }

    if (trimmed.startsWith('包 ')) {
      program.packageName = trimmed.slice('包'.length).trim();
      return;
    }

    if (trimmed.startsWith('使用 ')) {
      program.uses.push(trimmed.slice('使用'.length).trim());
      return;
    }

    const classMatch = trimmed.match(CLASS_RE);
    if (classMatch) {
      currentMethod = null;
      currentClass = {
        name: classMatch[1],
        baseClass: classMatch[2] || undefined,
        line: lineNumber,
        members: [],
        methods: []
      };
      currentAccess = '私有';
      program.classes.push(currentClass);
      return;
    }

    if (trimmed === '结束类') {
      currentMethod = null;
      currentClass = null;
      currentAccess = '私有';
      return;
    }

    const accessMatch = trimmed.match(ACCESS_RE);
    if (accessMatch) {
      currentMethod = null;
      currentAccess = accessMatch[1] as LingCppAccessModifier;
      return;
    }

    if (!currentClass) {
      diagnostics.push(createDiagnostic('warning', lineNumber, line, '类外语句不会参与中文 C++ 生成。', '请把语句放入 `类 ... 结束类` 内。'));
      return;
    }

    const methodMatch = trimmed.match(METHOD_RE);
    if (methodMatch) {
      const prefix = methodMatch[1];
      const declaredName = methodMatch[2]?.trim();
      const method: LingCppMethod = {
        name: normalizeMethodName(prefix, declaredName, currentClass.name),
        returnType: methodReturnType(prefix),
        access: currentAccess,
        kind: methodKind(prefix),
        line: lineNumber,
        parameters: parseParameters(methodMatch[3] || ''),
        statements: []
      };
      currentClass.methods.push(method);
      currentMethod = method;
      return;
    }

    const memberMatch = trimmed.match(MEMBER_RE);
    if (memberMatch && !currentMethod) {
      const member: LingCppMember = {
        type: memberMatch[1],
        name: memberMatch[2],
        access: currentAccess,
        line: lineNumber,
        initialValue: memberMatch[3]?.trim()
      };
      currentClass.members.push(member);
      return;
    }

    appendStatement(currentMethod, line, lineNumber);
  });

  if (program.classes.length === 0) {
    diagnostics.push(createDiagnostic('error', 1, lines[0] || '', '未找到中文 C++ 类。', '请添加 `类 游戏主窗体 : 公开 窗体`。'));
  }

  program.classes.forEach(cls => {
    if (!cls.methods.some(method => method.kind === 'constructor')) {
      diagnostics.push(createDiagnostic('info', cls.line, `类 ${cls.name}`, `类 ${cls.name} 未声明构造函数。`, '可添加 `公开: 构造()` 初始化窗口状态。'));
    }
  });

  return { program, diagnostics };
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

function appendStatement(method: LingCppMethod | null, line: string, lineNumber: number): void {
  if (!method) return;
  const indent = line.match(/^\s*/)?.[0] || '';
  const text = line.slice(indent.length);
  const statement: LingCppStatement = { line: lineNumber, indent, text };
  method.statements.push(statement);
}

function parseParameters(raw: string): LingCppParameter[] {
  return raw
    .split(/[,，]/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const [type, name] = part.split(/\s+/);
      return {
        type: name ? type : '对象',
        name: name || type
      };
    });
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

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
