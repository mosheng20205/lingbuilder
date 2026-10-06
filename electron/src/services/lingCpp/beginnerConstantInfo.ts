import { normalizeIdentifier } from './parser';
import { getProjectConstantNameAtCursor } from './projectConstantReferenceService';

/** 新手编辑器「常量值提示」的统一描述：项目常量与模块常量归一后的展示形态。 */
export interface BeginnerConstantInfo {
  name: string;
  type: string;
  /** 声明中的初始值（文本型保留引号原样，逻辑型已归一为 真/假），只用于展示。 */
  value: string;
  origin: '项目常量' | '模块常量';
  moduleName?: string;
  description?: string;
}

/** 光标处 #常量 引用的值信息：命中返回常量描述，供新手模式悬停气泡与底部提示共用。
 * 只认显式的 `#常量名` 引用形态（标识符紧前面必须是 #）：裸标识符可能是同名局部变量，
 * 语义不是常量，不得显示常量值。其余边界与项目常量跳转同口径：
 * 字符串/注释/多行文本块/成员访问/调用位置不命中。
 * constants 按「遮蔽优先级」排序（项目常量在前遮蔽模块常量），同名取靠前者。 */
export function getBeginnerConstantInfoAtCursor(
  source: string,
  cursor: number,
  constants: ReadonlyArray<BeginnerConstantInfo>
): BeginnerConstantInfo | null {
  if (constants.length === 0) return null;
  if (!isHashConstantReferenceAt(source, cursor)) return null;
  const byName = new Map<string, BeginnerConstantInfo>();
  constants.forEach(item => {
    const key = normalizeIdentifier(item.name);
    if (key && !byName.has(key)) byName.set(key, item);
  });
  const name = getProjectConstantNameAtCursor(source, cursor, Array.from(byName.keys()));
  if (!name) return null;
  return byName.get(normalizeIdentifier(name)) ?? null;
}

const IDENTIFIER_CHAR = /[A-Za-z0-9_\u3400-\u9fff]/u;

/** 光标处是否是 `#常量名` 引用：光标可落在标识符内或末尾右侧，向前收拢出标识符起点后看前一个字符。 */
function isHashConstantReferenceAt(source: string, cursor: number): boolean {
  const safeCursor = Math.max(0, Math.min(cursor, source.length));
  let start = safeCursor;
  if (!IDENTIFIER_CHAR.test(source[start] || '') && IDENTIFIER_CHAR.test(source[start - 1] || '')) start -= 1;
  if (!IDENTIFIER_CHAR.test(source[start] || '')) return false;
  while (start > 0 && IDENTIFIER_CHAR.test(source[start - 1] || '')) start -= 1;
  return source[start - 1] === '#';
}

/** 常量值的中文展示形态：逻辑型转 真/假（模块清单里是 boolean），其余原样。 */
export function formatBeginnerConstantValue(type: string, value: unknown): string {
  if (/逻辑/u.test(type)) return value === true || value === '真' ? '真' : '假';
  return String(value);
}
