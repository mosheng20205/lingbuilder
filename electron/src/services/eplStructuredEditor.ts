export interface EplTypeOption {
  label: string;
  category: string;
  aliases: string[];
}

export interface EplHeaderLine {
  kind: 'line';
  id: string;
  sourceLine: number;
  text: string;
}

export interface EplProgramVariableLine {
  kind: 'programVariable';
  id: string;
  sourceLine: number;
  variable: EplVariableRow;
}

export type EplHeaderEntry = EplHeaderLine | EplProgramVariableLine;

export interface EplVariableRow {
  id: string;
  scope: 'program' | 'local';
  name: string;
  type: string;
  isStatic: boolean;
  isArray: boolean;
  remark: string;
}

export interface EplStatementLine {
  id: string;
  sourceLine: number;
  indent: string;
  text: string;
}

export interface EplStatementEntry extends EplStatementLine {
  kind: 'statement';
}

export interface EplVariableBlock {
  kind: 'variables';
  id: string;
  sourceLine: number;
  indent: string;
  variables: EplVariableRow[];
}

export type EplSubprogramEntry = EplStatementEntry | EplVariableBlock;

export interface EplSubprogramBlock {
  id: string;
  sourceLine: number;
  name: string;
  returnType: string;
  isPublic: boolean;
  isEasyPackage: boolean;
  remark: string;
  body: EplSubprogramEntry[];
}

export interface EplStructuredDocument {
  header: EplHeaderEntry[];
  subprograms: EplSubprogramBlock[];
}

export const EPL_FLOW_GUIDE_COLORS = ['#2ea8ff', '#39d98a', '#ffd166', '#ff6b6b', '#b36bff', '#31d7d1'];

export const EPL_TYPE_OPTIONS: EplTypeOption[] = [
  { label: '文本型', category: '基础类型', aliases: ['wb', 'text', 'string', 'wenben'] },
  { label: '整数型', category: '基础类型', aliases: ['zs', 'int', 'integer', 'zhengshu'] },
  { label: '长整数型', category: '基础类型', aliases: ['czs', 'long'] },
  { label: '小数型', category: '基础类型', aliases: ['xs', 'float'] },
  { label: '双精度小数型', category: '基础类型', aliases: ['double', 'sjdxs'] },
  { label: '逻辑型', category: '基础类型', aliases: ['lj', 'bool', 'boolean'] },
  { label: '字节集', category: '基础类型', aliases: ['bytes', 'zjj'] },
  { label: '日期时间型', category: '基础类型', aliases: ['date', 'time', 'rqsj'] },
  { label: '窗口', category: '窗口组件', aliases: ['window', 'chuangkou'] },
  { label: '按钮', category: '窗口组件', aliases: ['button', 'anniu'] },
  { label: '编辑框', category: '窗口组件', aliases: ['textbox', 'edit'] },
  { label: '标签', category: '窗口组件', aliases: ['label', 'biaoqian'] },
  { label: '外部树型框', category: '外部支持库', aliases: ['tree', 'wbsk'] },
  { label: '外部控件操作', category: '外部支持库', aliases: ['control', 'operation'] },
  { label: '外部超级列表框', category: '外部支持库', aliases: ['list', 'superlist'] },
  { label: '外部数据库', category: '外部支持库', aliases: ['db', 'database'] },
  { label: '外部数据提供者', category: '外部支持库', aliases: ['provider', 'data'] }
];

const EPL_FLOW_START_PATTERN = /^\.?(如果|如果真|判断|判断循环首|循环判断首|计次循环首|变量循环首|枚举循环首)(?:\s|$|[（(])/;
const EPL_FLOW_END_PATTERN = /^\.?(如果结束|判断结束|判断循环尾|循环判断尾|计次循环尾|变量循环尾|循环尾)(?:\s|$|[（(])/;

export function splitEplArguments(value: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | '“' | "'" | null = null;

  for (const char of value) {
    if (quote) {
      current += char;
      if ((quote === '"' && char === '"') || (quote === '“' && char === '”') || (quote === "'" && char === "'")) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === '“' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === ',' || char === '，') {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  parts.push(current.trim());
  return parts;
}

export function stripEplText(value?: string): string {
  const text = (value ?? '').trim();
  if (!text) return '';
  return text
    .replace(/^[“"']|[”"']$/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim();
}

export function stripEplRemark(value?: string): string {
  const text = (value ?? '').trim();
  if (!text) return '';
  return text
    .replace(/^[“"']|[”"']$/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

export function parseEplStructuredDocument(sourceCode: string): EplStructuredDocument {
  const lines = sourceCode.split('\n');
  const documentModel: EplStructuredDocument = {
    header: [],
    subprograms: []
  };
  let currentSubprogram: EplSubprogramBlock | null = null;
  let currentVariableBlock: EplVariableBlock | null = null;

  lines.forEach((line, index) => {
    const sourceLine = index + 1;
    const body = line.trim();

    if (body.startsWith('.子程序')) {
      if (currentSubprogram) {
        trimTrailingBlankStatements(currentSubprogram.body);
      }
      const subprogram = parseSubprogramLine(body, documentModel.subprograms.length, sourceLine);
      documentModel.subprograms.push(subprogram);
      currentSubprogram = subprogram;
      currentVariableBlock = null;
      return;
    }

    if (!currentSubprogram) {
      if (body.startsWith('.程序集变量')) {
        documentModel.header.push({
          kind: 'programVariable',
          id: `program-var-${sourceLine}`,
          sourceLine,
          variable: parseVariableLine(body, '.程序集变量', 'program', `program-var-${sourceLine}`)
        });
      } else {
        documentModel.header.push({
          kind: 'line',
          id: `header-line-${sourceLine}`,
          sourceLine,
          text: line
        });
      }
      return;
    }

    if (body.startsWith('.局部变量')) {
      const indent = line.match(/^\s*/)?.[0] ?? '';
      const lastBodyEntry = currentSubprogram.body[currentSubprogram.body.length - 1];

      if (!currentVariableBlock || lastBodyEntry !== currentVariableBlock || currentVariableBlock.indent !== indent) {
        currentVariableBlock = createBlankEplVariableBlock(
          `${currentSubprogram.id}-vars-${countVariableBlocks(currentSubprogram.body)}`,
          indent,
          []
        );
        currentVariableBlock.sourceLine = sourceLine;
        currentSubprogram.body.push(currentVariableBlock);
      }

      currentVariableBlock.variables.push(parseVariableLine(
        body,
        '.局部变量',
        'local',
        `${currentVariableBlock.id}-var-${currentVariableBlock.variables.length}`
      ));
      return;
    }

    const indent = line.match(/^\s*/)?.[0] ?? '';
    currentSubprogram.body.push({
      kind: 'statement',
      id: `${currentSubprogram.id}-stmt-${countStatements(currentSubprogram.body)}`,
      sourceLine,
      indent,
      text: line.slice(indent.length)
    });
    currentVariableBlock = null;
  });

  if (currentSubprogram) {
    trimTrailingBlankStatements(currentSubprogram.body);
  }

  return documentModel;
}

export function serializeEplStructuredDocument(documentModel: EplStructuredDocument): string {
  const lines: string[] = [];

  documentModel.header.forEach(entry => {
    if (entry.kind === 'programVariable') {
      lines.push(serializeVariableLine(entry.variable));
      return;
    }
    lines.push(entry.text);
  });

  documentModel.subprograms.forEach((subprogram, index) => {
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
      lines.push('');
    }
    if (index > 0 && lines[lines.length - 1]?.trim() !== '') {
      lines.push('');
    }

    lines.push(serializeSubprogramLine(subprogram));
    subprogram.body.forEach(entry => {
      if (entry.kind === 'variables') {
        entry.variables.forEach(variable => {
          lines.push(`${entry.indent}${serializeVariableLine(variable)}`);
        });
        return;
      }

      lines.push(`${entry.indent}${entry.text}`);
    });
  });

  return lines.join('\n').replace(/\s+$/g, '');
}

export function cloneEplStructuredDocument(documentModel: EplStructuredDocument): EplStructuredDocument {
  return {
    header: documentModel.header.map(entry => (
      entry.kind === 'programVariable'
        ? { ...entry, variable: { ...entry.variable } }
        : { ...entry }
    )),
    subprograms: documentModel.subprograms.map(subprogram => ({
      ...subprogram,
      body: subprogram.body.map(entry => (
        entry.kind === 'variables'
          ? { ...entry, variables: entry.variables.map(variable => ({ ...variable })) }
          : { ...entry }
      ))
    }))
  };
}

export function createBlankEplVariable(scope: 'program' | 'local', id: string): EplVariableRow {
  return {
    id,
    scope,
    name: '',
    type: '',
    isStatic: false,
    isArray: false,
    remark: ''
  };
}

export function createBlankEplStatement(id: string, indent = '    '): EplStatementEntry {
  return {
    kind: 'statement',
    id,
    sourceLine: 0,
    indent,
    text: ''
  };
}

export function createBlankEplVariableBlock(
  id: string,
  indent = '    ',
  variables: EplVariableRow[] = [createBlankEplVariable('local', `${id}-var-0`)]
): EplVariableBlock {
  return {
    kind: 'variables',
    id,
    sourceLine: 0,
    indent,
    variables
  };
}

export function getEplSubprogramVariables(subprogram: EplSubprogramBlock): EplVariableRow[] {
  return subprogram.body.flatMap(entry => entry.kind === 'variables' ? entry.variables : []);
}

export function getEplSubprogramStatements(subprogram: EplSubprogramBlock): EplStatementEntry[] {
  return subprogram.body.filter((entry): entry is EplStatementEntry => entry.kind === 'statement');
}

export function getEplTypeSuggestions(query: string, limit = 8): EplTypeOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return EPL_TYPE_OPTIONS.slice(0, limit);
  }

  return EPL_TYPE_OPTIONS
    .filter(option => {
      const label = option.label.toLowerCase();
      return label.includes(normalizedQuery)
        || option.category.toLowerCase().includes(normalizedQuery)
        || option.aliases.some(alias => alias.toLowerCase().includes(normalizedQuery));
    })
    .slice(0, limit);
}

export function buildEplStatementGuides(statements: EplStatementLine[]): number[][] {
  const flowStack: number[] = [];

  return statements.map(statement => {
    const body = statement.text.trim();
    const startsFlow = EPL_FLOW_START_PATTERN.test(body);
    const endsFlow = EPL_FLOW_END_PATTERN.test(body);
    const startGuideColor = flowStack.length % EPL_FLOW_GUIDE_COLORS.length;
    let guides = [...flowStack];

    if (startsFlow) {
      guides = [...guides, startGuideColor];
    }
    if (endsFlow && flowStack.length > 0) {
      flowStack.pop();
    }
    if (startsFlow) {
      flowStack.push(startGuideColor);
    }

    return guides;
  });
}

function parseSubprogramLine(body: string, index: number, sourceLine: number): EplSubprogramBlock {
  const args = splitEplArguments(body.slice('.子程序'.length).trim());

  return {
    id: `subprogram-${index}`,
    sourceLine,
    name: stripEplText(args[0]) || '未命名子程序',
    returnType: stripEplText(args[1]) || '无',
    isPublic: parseEplBoolean(args[2]),
    isEasyPackage: parseEplBoolean(args[3]),
    remark: stripEplRemark(args[4]) || ''
      || stripEplRemark(args.slice(2).find(part => /^[“"']/.test(part.trim()))),
    body: []
  };
}

function countVariableBlocks(body: EplSubprogramEntry[]): number {
  return body.filter(entry => entry.kind === 'variables').length;
}

function countStatements(body: EplSubprogramEntry[]): number {
  return body.filter(entry => entry.kind === 'statement').length;
}

function trimTrailingBlankStatements(body: EplSubprogramEntry[]): void {
  while (body.length > 0) {
    const lastEntry = body[body.length - 1];
    if (lastEntry?.kind !== 'statement' || lastEntry.text.trim()) {
      return;
    }
    body.pop();
  }
}

function parseVariableLine(
  body: string,
  command: '.局部变量' | '.程序集变量',
  scope: 'program' | 'local',
  id: string
): EplVariableRow {
  const args = splitEplArguments(body.slice(command.length).trim());
  const quotedRemark = args.slice(2).find(part => /^[“"']/.test(part.trim()));

  return {
    id,
    scope,
    name: stripEplText(args[0]),
    type: stripEplText(args[1]),
    isStatic: parseEplBoolean(args[2]),
    isArray: parseEplBoolean(args[3]),
    remark: stripEplRemark(quotedRemark ?? args[4])
  };
}

function serializeSubprogramLine(subprogram: EplSubprogramBlock): string {
  const name = subprogram.name.trim() || '未命名子程序';
  const returnType = normalizeEmptyType(subprogram.returnType);
  const hasMetadata = returnType || subprogram.isPublic || subprogram.isEasyPackage || subprogram.remark.trim();

  if (!hasMetadata) {
    return `.子程序 ${name}`;
  }

  return `.子程序 ${[
    name,
    returnType,
    subprogram.isPublic ? '真' : '',
    subprogram.isEasyPackage ? '真' : '',
    quoteEplText(subprogram.remark)
  ].join(', ')}`;
}

function serializeVariableLine(variable: EplVariableRow): string {
  const command = variable.scope === 'program' ? '.程序集变量' : '.局部变量';
  const fields = [variable.name.trim(), variable.type.trim()];

  if (variable.isStatic || variable.isArray || variable.remark.trim()) {
    fields.push(variable.isStatic ? '真' : '');
    fields.push(variable.isArray ? '真' : '');
    fields.push(quoteEplText(variable.remark));
  }

  return `${command} ${fields.join(', ')}`;
}

function parseEplBoolean(value?: string): boolean {
  const text = stripEplText(value);
  return /^(真|是|公开|易包|1|true|yes|✓)$/i.test(text);
}

function normalizeEmptyType(value: string): string {
  const text = value.trim();
  if (!text || text === '无') return '';
  return text;
}

function quoteEplText(value: string): string {
  const text = value;
  if (!text) return '';
  return `"${text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/"/g, '\\"')}"`;
}
