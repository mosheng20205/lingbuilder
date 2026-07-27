export interface BeginnerCommandParameterDefinition {
  name: string;
  type?: string;
  note?: string;
}

export interface BeginnerExpandedCommandArgument extends BeginnerCommandParameterDefinition {
  value: string;
  provided: boolean;
}

export interface BeginnerCommandExpansion {
  sourceText: string;
  receiver?: string;
  operator?: '=';
  commandName: string;
  arguments: BeginnerExpandedCommandArgument[];
}

export type BeginnerCommandParameterCatalog = Readonly<
  Record<string, readonly BeginnerCommandParameterDefinition[]>
>;

/**
 * Parses the outer command call on one beginner-editor line without changing
 * the source text. Commas and equals signs inside strings or nested calls are
 * deliberately ignored so the visual expansion never rewrites valid code.
 */
export function parseBeginnerCommandExpansion(
  line: string,
  parameterCatalog: BeginnerCommandParameterCatalog = {}
): BeginnerCommandExpansion | null {
  const sourceText = stripLineComment(line).trim().replace(/;\s*$/u, '').trim();
  if (!sourceText) return null;

  const assignmentIndex = findTopLevelAssignment(sourceText);
  const receiver = assignmentIndex >= 0 ? sourceText.slice(0, assignmentIndex).trim() : undefined;
  const expression = assignmentIndex >= 0 ? sourceText.slice(assignmentIndex + 1).trim() : sourceText;
  const call = findCommandCall(expression);
  if (!call) return null;

  const values = splitTopLevelArguments(call.argumentText);
  const definitions = parameterCatalog[call.commandName] || [];
  const argumentCount = Math.max(values.length, definitions.length);
  if (argumentCount <= 1) return null;

  return {
    sourceText,
    receiver: receiver || undefined,
    operator: receiver ? '=' : undefined,
    commandName: call.commandName,
    arguments: Array.from({ length: argumentCount }, (_, index) => ({
      name: definitions[index]?.name || `参数 ${index + 1}`,
      type: definitions[index]?.type,
      note: definitions[index]?.note,
      value: values[index] ?? '',
      provided: index < values.length
    }))
  };
}

/**
 * Writes one structured parameter value back to the original command line.
 * Empty trailing values stay omitted. If a later optional value is supplied,
 * skipped positional parameters are materialized with a type-safe placeholder.
 */
export function updateBeginnerCommandArgument(
  line: string,
  parameterCatalog: BeginnerCommandParameterCatalog,
  argumentIndex: number,
  nextValue: string
): string {
  const expansion = parseBeginnerCommandExpansion(line, parameterCatalog);
  if (!expansion || argumentIndex < 0 || argumentIndex >= expansion.arguments.length) return line;

  const values = expansion.arguments.map(argument => argument.provided ? argument.value : '');
  values[argumentIndex] = nextValue.trim();
  let lastProvidedIndex = values.length - 1;
  while (lastProvidedIndex >= 0 && !values[lastProvidedIndex]) lastProvidedIndex -= 1;
  const serializedValues = values.slice(0, lastProvidedIndex + 1).map((value, index) =>
    value || defaultArgumentExpression(expansion.arguments[index]?.type)
  );

  const commentStart = findLineCommentStart(line);
  const codeText = commentStart >= 0 ? line.slice(0, commentStart) : line;
  const commentText = commentStart >= 0 ? line.slice(commentStart) : '';
  const indent = codeText.match(/^\s*/u)?.[0] || '';
  const hasSemicolon = /;\s*$/u.test(codeText);
  const assignment = expansion.receiver ? `${expansion.receiver} = ` : '';
  const statement = `${assignment}${expansion.commandName}(${serializedValues.join(', ')})${hasSemicolon ? ';' : ''}`;
  const commentSeparator = commentText && !/^\s/u.test(commentText) ? ' ' : '';
  return `${indent}${statement}${commentSeparator}${commentText}`;
}

function defaultArgumentExpression(type?: string): string {
  const normalized = (type || '').trim().toLocaleLowerCase();
  if (/bool|逻辑|真假/u.test(normalized)) return '假';
  if (/int|long|double|float|handle|整数|小数|数值|长整数|短整数|字节型/u.test(normalized)) return '0';
  if (/string|text|utf|wide|文本|字节集|字符/u.test(normalized)) return '""';
  return '""';
}

function stripLineComment(line: string): string {
  const commentStart = findLineCommentStart(line);
  return commentStart >= 0 ? line.slice(0, commentStart) : line;
}

function findLineCommentStart(line: string): number {
  let quote: 'double' | 'chinese' | null = null;
  for (let index = 0; index < line.length - 1; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (quote === null && char === '"') quote = 'double';
    else if (quote === 'double' && char === '"') quote = null;
    else if (quote === null && char === '“') quote = 'chinese';
    else if (quote === 'chinese' && char === '”') quote = null;
    else if (quote === null && char === '/' && next === '/') return index;
  }
  return -1;
}

function findTopLevelAssignment(text: string): number {
  let quote: 'double' | 'chinese' | null = null;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (quote === null && char === '"') {
      quote = 'double';
      continue;
    }
    if (quote === 'double' && char === '"') {
      quote = null;
      continue;
    }
    if (quote === null && char === '“') {
      quote = 'chinese';
      continue;
    }
    if (quote === 'chinese' && char === '”') {
      quote = null;
      continue;
    }
    if (quote !== null) continue;
    if ('([{'.includes(char)) {
      depth += 1;
      continue;
    }
    if (')]}'.includes(char)) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0 || (char !== '=' && char !== '＝')) continue;
    const previous = text[index - 1] || '';
    const next = text[index + 1] || '';
    if ('=!<>＝'.includes(previous) || next === '=' || next === '＝' || next === '>') continue;
    return index;
  }
  return -1;
}

function findCommandCall(expression: string): { commandName: string; argumentText: string } | null {
  let quote: 'double' | 'chinese' | null = null;
  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (quote === null && char === '"') {
      quote = 'double';
      continue;
    }
    if (quote === 'double' && char === '"') {
      quote = null;
      continue;
    }
    if (quote === null && char === '“') {
      quote = 'chinese';
      continue;
    }
    if (quote === 'chinese' && char === '”') {
      quote = null;
      continue;
    }
    if (quote !== null || char !== '(') continue;

    const commandName = expression.slice(0, index).trim();
    if (!/^[\w\u3400-\u9fff.$]+$/u.test(commandName)) return null;
    const closeIndex = findMatchingParen(expression, index);
    if (closeIndex < 0 || expression.slice(closeIndex + 1).trim()) return null;
    return {
      commandName,
      argumentText: expression.slice(index + 1, closeIndex)
    };
  }
  return null;
}

function findMatchingParen(text: string, openIndex: number): number {
  let quote: 'double' | 'chinese' | null = null;
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (quote === null && char === '"') quote = 'double';
    else if (quote === 'double' && char === '"') quote = null;
    else if (quote === null && char === '“') quote = 'chinese';
    else if (quote === 'chinese' && char === '”') quote = null;
    else if (quote === null && char === '(') depth += 1;
    else if (quote === null && char === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function splitTopLevelArguments(argumentText: string): string[] {
  if (!argumentText.trim()) return [];
  const values: string[] = [];
  let quote: 'double' | 'chinese' | null = null;
  let depth = 0;
  let start = 0;
  for (let index = 0; index < argumentText.length; index += 1) {
    const char = argumentText[index];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (quote === null && char === '"') quote = 'double';
    else if (quote === 'double' && char === '"') quote = null;
    else if (quote === null && char === '“') quote = 'chinese';
    else if (quote === 'chinese' && char === '”') quote = null;
    else if (quote === null && '([{'.includes(char)) depth += 1;
    else if (quote === null && ')]}'.includes(char)) depth = Math.max(0, depth - 1);
    else if (quote === null && depth === 0 && (char === ',' || char === '，')) {
      values.push(argumentText.slice(start, index).trim());
      start = index + 1;
    }
  }
  values.push(argumentText.slice(start).trim());
  return values;
}
