import type {
  CommandContext,
  CommandWhenClause,
  CommandWhenPredicate
} from './types';

type TokenKind = 'identifier' | 'string' | 'number' | 'operator' | 'leftParen' | 'rightParen' | 'eof';

interface Token {
  kind: TokenKind;
  value: string;
  offset: number;
}

type ValueEvaluator = (context: CommandContext) => unknown;

export class CommandWhenSyntaxError extends Error {
  readonly offset: number;

  constructor(message: string, offset: number) {
    super(`${message}（位置 ${offset + 1}）`);
    this.name = 'CommandWhenSyntaxError';
    this.offset = offset;
  }
}

export function compileCommandWhenClause(clause: CommandWhenClause | undefined): CommandWhenPredicate {
  if (clause === undefined) return () => true;
  if (typeof clause === 'boolean') return () => clause;
  if (typeof clause === 'function') return clause;

  const source = clause.trim();
  if (!source) throw new CommandWhenSyntaxError('when 条件不能为空', 0);
  return new WhenParser(source).parse();
}

class WhenParser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(private readonly source: string) {
    this.tokens = tokenize(source);
  }

  parse(): CommandWhenPredicate {
    const expression = this.parseOr();
    const remaining = this.peek();
    if (remaining.kind !== 'eof') {
      throw this.error(`无法识别“${remaining.value}”`, remaining);
    }
    return context => Boolean(expression(context));
  }

  private parseOr(): ValueEvaluator {
    let left = this.parseAnd();
    while (this.matchOperator('||')) {
      const previous = left;
      const right = this.parseAnd();
      left = context => Boolean(previous(context)) || Boolean(right(context));
    }
    return left;
  }

  private parseAnd(): ValueEvaluator {
    let left = this.parseUnary();
    while (this.matchOperator('&&')) {
      const previous = left;
      const right = this.parseUnary();
      left = context => Boolean(previous(context)) && Boolean(right(context));
    }
    return left;
  }

  private parseUnary(): ValueEvaluator {
    if (this.matchOperator('!')) {
      const operand = this.parseUnary();
      return context => !Boolean(operand(context));
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ValueEvaluator {
    if (this.match('leftParen')) {
      const expression = this.parseOr();
      const token = this.peek();
      if (!this.match('rightParen')) throw this.error('缺少右括号“)”', token);
      return expression;
    }

    const left = this.parseLeftOperand();
    const operator = this.peek();
    if (
      operator.kind === 'operator'
      && ['==', '===', '!=', '!=='].includes(operator.value)
    ) {
      this.index += 1;
      const right = this.parseRightOperand();
      if (operator.value === '==' || operator.value === '===') {
        return context => left(context) === right(context);
      }
      return context => left(context) !== right(context);
    }
    return left;
  }

  private parseLeftOperand(): ValueEvaluator {
    const token = this.take();
    if (token.kind === 'identifier') {
      const literal = toKeywordLiteral(token.value);
      if (literal.matched) return () => literal.value;
      return context => readContextValue(context, token.value);
    }
    if (token.kind === 'string') return () => token.value;
    if (token.kind === 'number') return () => Number(token.value);
    throw this.error('此处需要上下文键或值', token);
  }

  private parseRightOperand(): ValueEvaluator {
    const token = this.take();
    if (token.kind === 'identifier') {
      const literal = toKeywordLiteral(token.value);
      return () => literal.matched ? literal.value : token.value;
    }
    if (token.kind === 'string') return () => token.value;
    if (token.kind === 'number') return () => Number(token.value);
    throw this.error('比较符右侧需要字符串、数字、布尔值或 null', token);
  }

  private peek(): Token {
    return this.tokens[this.index];
  }

  private take(): Token {
    const token = this.peek();
    this.index += 1;
    return token;
  }

  private match(kind: TokenKind): boolean {
    if (this.peek().kind !== kind) return false;
    this.index += 1;
    return true;
  }

  private matchOperator(value: string): boolean {
    const token = this.peek();
    if (token.kind !== 'operator' || token.value !== value) return false;
    this.index += 1;
    return true;
  }

  private error(message: string, token: Token): CommandWhenSyntaxError {
    return new CommandWhenSyntaxError(message, Math.min(token.offset, this.source.length));
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let offset = 0;

  while (offset < source.length) {
    const char = source[offset];
    if (/\s/u.test(char)) {
      offset += 1;
      continue;
    }

    if (char === '(' || char === ')') {
      tokens.push({
        kind: char === '(' ? 'leftParen' : 'rightParen',
        value: char,
        offset
      });
      offset += 1;
      continue;
    }

    const operator = ['!==', '===', '!=', '==', '&&', '||', '!']
      .find(candidate => source.startsWith(candidate, offset));
    if (operator) {
      tokens.push({ kind: 'operator', value: operator, offset });
      offset += operator.length;
      continue;
    }

    if (char === '"' || char === "'") {
      const start = offset;
      const quote = char;
      offset += 1;
      let value = '';
      let closed = false;
      while (offset < source.length) {
        const current = source[offset];
        if (current === quote) {
          offset += 1;
          closed = true;
          break;
        }
        if (current === '\\') {
          offset += 1;
          if (offset >= source.length) break;
          const escaped = source[offset];
          value += escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped;
          offset += 1;
          continue;
        }
        value += current;
        offset += 1;
      }
      if (!closed) throw new CommandWhenSyntaxError('字符串缺少结束引号', start);
      tokens.push({ kind: 'string', value, offset: start });
      continue;
    }

    const start = offset;
    while (
      offset < source.length
      && !/\s/u.test(source[offset])
      && !['(', ')', '!', '=', '&', '|', '"', "'"].includes(source[offset])
    ) {
      offset += 1;
    }
    if (start === offset) {
      throw new CommandWhenSyntaxError(`无法识别“${source[offset]}”`, offset);
    }
    const value = source.slice(start, offset);
    tokens.push({
      kind: /^-?(?:\d+\.?\d*|\.\d+)$/u.test(value) ? 'number' : 'identifier',
      value,
      offset: start
    });
  }

  tokens.push({ kind: 'eof', value: '文末', offset: source.length });
  return tokens;
}

function readContextValue(context: CommandContext, key: string): unknown {
  if (Object.prototype.hasOwnProperty.call(context, key)) return context[key];

  let current: unknown = context;
  for (const segment of key.split('.')) {
    if (!current || typeof current !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function toKeywordLiteral(value: string): { matched: boolean; value: unknown } {
  if (value === 'true') return { matched: true, value: true };
  if (value === 'false') return { matched: true, value: false };
  if (value === 'null') return { matched: true, value: null };
  if (value === 'undefined') return { matched: true, value: undefined };
  return { matched: false, value };
}

