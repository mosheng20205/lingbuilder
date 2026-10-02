/**
 * 「连续赋值」语句唯一解析出口（一值多目标，易语言同名称令同语义）。
 *
 * 语法：`连续赋值(值, 目标1, 目标2, ...)`
 * 语义：值只求值一次，依次写入全部目标，与逐条「目标N = 值」完全等价；
 * 值是含调用的表达式时由生成器先落临时变量再逐目标赋（保证「一个值」语义，
 * 否则 取随机数() 这类值会被执行 N 次）。
 *
 * 目标形态（一期）：变量、变量.成员链、数组[下标表达式]、变量.成员链[下标]；
 * 下标仅允许出现在链尾且内部不得再嵌方括号。控件属性目标（标签1.内容）不属于
 * 左值，由调用方给出专项中文诊断。
 *
 * 生成器（windowDesigner/lingCppWin32Project.ts translateStatement）与语言服务
 * 诊断（lingCpp/languageService.ts）共用本模块，禁止任一侧复制第二套解析。
 */
import { collectLingCppStringLiteralRegions } from './stringLiteralRegions';

export const LING_CPP_CONSECUTIVE_ASSIGNMENT_COMMAND = '连续赋值';

/**
 * 语言级语句特有的「调用样」名称：未知命令准入必须豁免（生成器按语句展开为
 * 赋值序列，不存在同名运行时符号，也不是模块命令）。
 */
export const LING_CPP_LANGUAGE_STATEMENT_CALL_NAMES: readonly string[] = [
  LING_CPP_CONSECUTIVE_ASSIGNMENT_COMMAND
];

export interface LingCppConsecutiveAssignmentStatement {
  /** 值表达式原文（翻译与类型推断均按普通赋值右部口径处理）。 */
  valueExpression: string;
  /** 赋值目标原文（左值形态校验用 parseLingCppAssignmentTarget）。 */
  targets: string[];
  /** 假 = 实参不足两个（缺值或缺目标）；生成器按中文注释降级，语言服务出阻断诊断。 */
  wellFormed: boolean;
}

export interface LingCppAssignmentTargetParts {
  /** 首段标识符原文（局部变量 / 程序集变量 / 项目全局变量 / 数据类型变量名）。 */
  head: string;
  /** 成员链（`.成员` 名原文，不含点）。 */
  members: string[];
  /** 链尾下标表达式原文（无下标时缺省）。 */
  subscript?: string;
}

/**
 * 解析左值目标形态；带引号、运算符、调用、空串等一律返回 undefined。
 * 允许：`变量`、`变量.成员`、`变量[下标]`、`变量.成员[下标]`。
 */
export function parseLingCppAssignmentTarget(text: string): LingCppAssignmentTargetParts | undefined {
  const trimmed = text.trim().replace(/[;；]$/u, '').trim();
  const headMatch = trimmed.match(/^[\p{L}_][\p{L}\p{N}_]*/u);
  if (!headMatch) return undefined;
  const head = headMatch[0];
  const mask = buildStringMask(trimmed);
  const members: string[] = [];
  let subscript: string | undefined;
  let cursor = head.length;
  while (cursor < trimmed.length) {
    if (!mask[cursor]) {
      // 成员段必须在任何下标之前；下标只允许链尾一个。
      if (subscript === undefined && trimmed[cursor] === '.') {
        const memberMatch = trimmed.slice(cursor).match(/^\.\s*([\p{L}_][\p{L}\p{N}_]*)/u);
        if (!memberMatch) return undefined;
        members.push(memberMatch[1]);
        cursor += memberMatch[0].length;
        continue;
      }
      if (subscript === undefined && trimmed[cursor] === '[') {
        const closeIndex = findSubscriptClose(trimmed, mask, cursor);
        if (closeIndex < 0) return undefined;
        const inner = trimmed.slice(cursor + 1, closeIndex).trim();
        if (!inner) return undefined;
        subscript = inner;
        cursor = closeIndex + 1;
        continue;
      }
    }
    // 允许成员/下标段之间的空白，其余字符（运算符、第二个下标等）都不算左值。
    if (/\s/u.test(trimmed[cursor] || '')) {
      cursor += 1;
      continue;
    }
    return undefined;
  }
  return { head, members, subscript };
}

/** 整行是否是「连续赋值」语句；是则给出值与目标原文（不做左值校验）。 */
export function parseLingCppConsecutiveAssignmentStatement(statement: string): LingCppConsecutiveAssignmentStatement | undefined {
  const trimmed = statement.trim();
  const match = trimmed.match(/^连续赋值\s*[（(](.*)[）)]\s*;?$/u);
  if (!match) return undefined;
  const args = splitAssignmentCallArguments(match[1] || '');
  if (args.length < 2) {
    return { valueExpression: args[0] || '', targets: [], wellFormed: false };
  }
  return { valueExpression: args[0], targets: args.slice(1), wellFormed: true };
}

/**
 * 实参拆分：逗号只在字符串、圆括号与方括号之外切割（与生成器 splitCallArguments
 * 同口径，并补充方括号深度，防止下标表达式里的逗号被误拆）。
 */
function splitAssignmentCallArguments(raw: string): string[] {
  const mask = buildStringMask(raw);
  const args: string[] = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (mask[index]) {
      current += char;
      continue;
    }
    if (char === '(' || char === '（') {
      depth += 1;
    } else if (char === ')' || char === '）') {
      depth = Math.max(0, depth - 1);
    }
    if ((char === ',' || char === '，') && depth === 0) {
      if (current.trim()) args.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function findSubscriptClose(text: string, mask: ReadonlyArray<boolean>, openIndex: number): number {
  for (let index = openIndex + 1; index < text.length; index += 1) {
    if (mask[index]) continue;
    const char = text[index];
    if (char === '[') return -1;
    if (char === ']') return index;
  }
  return -1;
}

function buildStringMask(text: string): boolean[] {
  const mask = new Array<boolean>(text.length).fill(false);
  collectLingCppStringLiteralRegions(text).forEach(region => {
    for (let index = region.start; index < region.end; index += 1) mask[index] = true;
  });
  return mask;
}
