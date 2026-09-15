import type {
  ModuleBindingValueType,
  ModuleCommandBinding,
  ModuleCommandBindingParameter,
  ModuleCommandContribution,
  ModuleControlReferenceKind,
  ModuleControlReferenceScope,
  ModuleControlRuntimeRepresentation
} from './types';

export const MODULE_BINDING_TYPE_LABELS: Record<ModuleBindingValueType, string> = {
  void: '空',
  int: '整数型',
  longLong: '长整数型',
  double: '小数型',
  bool: '逻辑型',
  wideString: '文本型',
  utf8String: 'UTF-8 文本',
  controlRef: '控件',
  handler: '处理器',
  lingValue: 'LingCpp 任意值',
  handle: '句柄',
  bytes: '字节集',
  array: '数组',
  arrayElement: '数组成员',
  raw: '原始值'
};

export function describeModuleBindingParameterType(parameter: ModuleCommandBindingParameter): string {
  if (parameter.type !== 'controlRef') return MODULE_BINDING_TYPE_LABELS[parameter.type as ModuleBindingValueType] || parameter.type;
  const types = parameter.controlTypes?.map(value => value.trim()).filter(Boolean) || [];
  return types.length === 0 ? '控件' : types.length === 1 ? `${types[0]} 控件` : `控件（${types.join(' / ')}）`;
}

export function isWideStringAbiBindingType(type: string | undefined): boolean {
  return type === 'wideString' || type === 'handler' || type === 'controlRef';
}

export function createModuleBindingSnippetArgument(parameter: ModuleCommandBindingParameter, index: number): string {
  const placeholder = `$${index + 1}`;
  if (parameter.type === 'wideString' || parameter.type === 'utf8String') return `"${placeholder}"`;
  if (parameter.type === 'controlRef') return placeholder;
  if (parameter.type === 'handler') return `&${placeholder}`;
  if (parameter.type === 'bool') return '假';
  return placeholder;
}

export function normalizeControlReferenceCallSnippet(
  snippet: string | undefined,
  parameters: readonly ModuleCommandBindingParameter[] = []
): string | undefined {
  if (!snippet || !parameters.some(parameter => parameter.type === 'controlRef')) return snippet;
  const open = findCallOpen(snippet);
  if (open < 0) return snippet;
  const close = findMatchingCallClose(snippet, open);
  if (close < 0) return snippet;
  const argumentsText = snippet.slice(open + 1, close);
  const argumentsList = splitCallArgumentsWithRanges(argumentsText);
  let normalized = argumentsText;
  argumentsList.map((argument, index) => ({ argument, index })).reverse().forEach(({ argument, index }) => {
    if (parameters[index]?.type !== 'controlRef') return;
    const value = argument.text.trim();
    const quoted = value.match(/^["“]([\p{L}_$][\p{L}\p{N}_$]*)["”]$/u);
    if (!quoted?.[1]) return;
    const leading = argument.text.length - argument.text.trimStart().length;
    const trailing = argument.text.length - argument.text.trimEnd().length;
    const replacement = `${argument.text.slice(0, leading)}${quoted[1]}${trailing ? argument.text.slice(argument.text.length - trailing) : ''}`;
    normalized = `${normalized.slice(0, argument.start)}${replacement}${normalized.slice(argument.end)}`;
  });
  return `${snippet.slice(0, open + 1)}${normalized}${snippet.slice(close)}`;
}

export function normalizeControlReferenceSnippet(
  snippet: string | undefined,
  bindings: readonly { command: string; parameters?: readonly ModuleCommandBindingParameter[] }[] = []
): string | undefined {
  if (!snippet) return snippet;
  const bindingByCommand = new Map(bindings.map(binding => [binding.command, binding]));
  const edits: Array<{ start: number; end: number; replacement: string }> = [];
  let index = 0;
  while (index < snippet.length) {
    const character = snippet[index];
    if (character === '"' || character === '“') {
      const close = character === '“' ? '”' : '"';
      index += 1;
      while (index < snippet.length) {
        if (character === '"' && snippet[index] === '\\') index += 2;
        else if (snippet[index] === close) { index += 1; break; }
        else index += 1;
      }
      continue;
    }
    if (character === "'" || (character === '/' && snippet[index + 1] === '/')) {
      const lineEnd = snippet.indexOf('\n', index);
      index = lineEnd < 0 ? snippet.length : lineEnd + 1;
      continue;
    }
    if (!/[\p{L}_]/u.test(character || '')) { index += 1; continue; }
    const nameStart = index;
    index += 1;
    while (index < snippet.length && /[\p{L}\p{N}_]/u.test(snippet[index] || '')) index += 1;
    const binding = bindingByCommand.get(snippet.slice(nameStart, index));
    if (!binding?.parameters?.some(parameter => parameter.type === 'controlRef')) continue;
    let open = index;
    while (/\s/u.test(snippet[open] || '')) open += 1;
    if (snippet[open] !== '(' && snippet[open] !== '（') continue;
    const close = findMatchingCallClose(snippet, open);
    if (close < 0) continue;
    const argumentsStart = open + 1;
    const argumentsText = snippet.slice(argumentsStart, close);
    splitCallArgumentsWithRanges(argumentsText).forEach((argument, argumentIndex) => {
      if (binding.parameters?.[argumentIndex]?.type !== 'controlRef') return;
      const leading = argument.text.length - argument.text.trimStart().length;
      const trailing = argument.text.length - argument.text.trimEnd().length;
      const raw = argument.text.trim();
      const quoted = raw.match(/^["“]([\p{L}_$][\p{L}\p{N}_$]*)["”]$/u);
      if (!quoted?.[1]) return;
      edits.push({
        start: argumentsStart + argument.start + leading,
        end: argumentsStart + argument.end - trailing,
        replacement: quoted[1]
      });
    });
  }
  let normalized = snippet;
  edits.sort((left, right) => right.start - left.start).forEach(edit => {
    normalized = `${normalized.slice(0, edit.start)}${edit.replacement}${normalized.slice(edit.end)}`;
  });
  return normalized;
}

/**
 * 为缺少说明的 handler 参数按 handlerSignature 契约生成中文说明。
 * 语言服务正是按该签名校验 &引用目标的形参和返回类型，因此文案与诊断口径一致；已有说明一律保留。
 */
export function normalizeHandlerParameter(parameter: ModuleCommandBindingParameter): ModuleCommandBindingParameter {
  if (parameter.type !== 'handler' || (parameter.description || '').trim()) return parameter;
  const signature = parameter.handlerSignature;
  if (!signature) return { ...parameter, description: '必须使用 &处理器名。' };
  const argumentText = signature.parameterTypes.length
    ? `形参类型依次为 ${signature.parameterTypes.join('、')}`
    : '必须无参数';
  return { ...parameter, description: `必须使用 &处理器名；${argumentText}，返回类型${signature.returnType === '空' ? '必须是 空' : `必须是 ${signature.returnType}`}。` };
}

/**
 * 为缺少说明的 controlRef 参数按契约生成中文说明。
 * 文案只取该参数自身的元数据（对象种类、解析作用域、允许类型、运行时表示），
 * 语义与 AGENTS.md 的 controlRef 规则和 lingCpp 语言服务诊断一致；已有说明一律保留。
 */
function describeControlReferenceParameter(parameter: ModuleCommandBindingParameter): string {
  const kinds = parameter.controlKinds?.length ? parameter.controlKinds : ['visual'];
  const kindText = kinds.map(kind => kind === 'visual' ? '可视控件' : kind === 'nonVisual' ? '非可视组件' : '设计器资源').join('或');
  const scopeText = parameter.scope === 'project' ? '按项目范围解析' : '只在当前窗口内解析';
  const typeText = parameter.controlTypes?.length ? `且类型必须是 ${parameter.controlTypes.join('、')}` : '接受任意兼容对象';
  const representation = parameter.runtimeRepresentation || 'wideName';
  const runtimeText = representation === 'nativeHandle'
    ? '生成 C++ 时解析为真实控件句柄'
    : representation === 'stableId'
      ? '生成 C++ 时按设计器稳定 ID 定位'
      : '生成 C++ 时按对象名定位';
  return `裸写的${kindText}名称（不能加引号），${scopeText}、${typeText}；${runtimeText}。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。`;
}

export function normalizeControlReferenceParameter(
  parameter: ModuleCommandBindingParameter,
  defaults: {
    controlTypes?: string[];
    controlKinds?: ModuleControlReferenceKind[];
    scope?: ModuleControlReferenceScope;
    runtimeRepresentation?: ModuleControlRuntimeRepresentation;
  } = {}
): ModuleCommandBindingParameter {
  if (parameter.type !== 'controlRef') return parameter;
  const normalized = {
    ...parameter,
    controlTypes: parameter.controlTypes?.length ? parameter.controlTypes : defaults.controlTypes,
    scope: parameter.scope || defaults.scope || 'currentWindow',
    controlKinds: parameter.controlKinds?.length ? parameter.controlKinds : defaults.controlKinds || ['visual'],
    runtimeRepresentation: parameter.runtimeRepresentation || defaults.runtimeRepresentation || 'wideName'
  };
  return (normalized.description || '').trim() ? normalized : { ...normalized, description: describeControlReferenceParameter(normalized) };
}

export type ParamDocTable = Record<string, string>;

interface ParamDocEntry {
  command: ModuleCommandContribution;
  binding: ModuleCommandBinding;
}

/**
 * 按参数名集中补齐缺失的中文说明：已写说明的参数原样保留；先按「命令名::参数名」精确匹配，
 * 再退回参数名匹配。表未覆盖的参数在模块加载期直接抛错——新增或修改命令时必须同步补表，
 * 审计脚本与测试导入清单时即会失败，构成说明必填门禁。
 */
export function withParamDocs<T extends ParamDocEntry>(docs: ParamDocTable, entries: readonly T[]): T[] {
  return entries.map(entry => {
    const parameters = entry.binding.parameters ?? [];
    const uncovered = parameters.filter(parameter => !(parameter.description || '').trim() && !docs[`${entry.binding.command}::${parameter.name}`] && !docs[parameter.name]);
    if (uncovered.length) {
      throw new Error(`模块参数缺少中文说明：${entry.binding.command} :: ${uncovered.map(item => item.name).join(', ')}`);
    }
    return {
      ...entry,
      binding: {
        ...entry.binding,
        parameters: parameters.map(parameter => ((parameter.description || '').trim() ? parameter : { ...parameter, description: docs[`${entry.binding.command}::${parameter.name}`] || docs[parameter.name] }))
      }
    } as T;
  });
}


function findCallOpen(value: string): number {
  let quote: '"' | '“' | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (quote === '"' && character === '\\') index += 1;
      else if ((quote === '"' && character === '"') || (quote === '“' && character === '”')) quote = null;
      continue;
    }
    if (character === '"' || character === '“') quote = character;
    else if (character === '(' || character === '（') return index;
  }
  return -1;
}

function findMatchingCallClose(value: string, open: number): number {
  let depth = 0;
  let quote: '"' | '“' | null = null;
  for (let index = open + 1; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (quote === '"' && character === '\\') index += 1;
      else if ((quote === '"' && character === '"') || (quote === '“' && character === '”')) quote = null;
      continue;
    }
    if (character === '"' || character === '“') quote = character;
    else if (character === '(' || character === '（' || character === '[' || character === '【' || character === '{') depth += 1;
    else if (character === ')' || character === '）') {
      if (depth === 0) return index;
      depth -= 1;
    } else if (character === ']' || character === '】' || character === '}') depth = Math.max(0, depth - 1);
  }
  return -1;
}

function splitCallArgumentsWithRanges(value: string): Array<{ text: string; start: number; end: number }> {
  const result: Array<{ text: string; start: number; end: number }> = [];
  let start = 0;
  let depth = 0;
  let quote: '"' | '“' | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (quote === '"' && character === '\\') index += 1;
      else if ((quote === '"' && character === '"') || (quote === '“' && character === '”')) quote = null;
      continue;
    }
    if (character === '"' || character === '“') quote = character;
    else if (character === '(' || character === '（' || character === '[' || character === '【' || character === '{') depth += 1;
    else if (character === ')' || character === '）' || character === ']' || character === '】' || character === '}') depth = Math.max(0, depth - 1);
    else if ((character === ',' || character === '，') && depth === 0) {
      result.push({ text: value.slice(start, index), start, end: index });
      start = index + 1;
    }
  }
  result.push({ text: value.slice(start), start, end: value.length });
  return result;
}
