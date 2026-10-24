import { normalizeIdentifier } from './parser';

/**
 * controlRef 参数允许「整数零字面量 0」的特例表（数据驱动，唯一出口）。
 *
 * 背景：少数模块命令的 controlRef 参数在模块文档里明确允许传 0 表示窗口级目标
 * （例如 NE_显示加载遮罩 的「目标控件」：0 = 整个窗口的全屏遮罩，引擎 EU_ShowLoading
 * 的 target_element_id 就是按 0 走窗口级）。controlRef 门禁只认裸控件名，会把文档里
 * 合法的 0 判成「需要直接填写控件名」，导致按文档写的源码被阻断。
 *
 * 红线：只放行「整数零字面量」——带引号的 "0"、其他数字、变量与任意表达式仍然照旧阻断；
 * 不在表内的 controlRef 参数（含所有控件类命令）完全不受影响。
 * 新增条目必须同时确认引擎侧真的支持该哨兵值，并同步 LingBuilder AI 规则手册。
 */
export const CONTROL_REF_LITERAL_ZERO_ALLOW_LIST: Readonly<Record<string, readonly string[]>> = {
  NE_显示加载遮罩: ['目标控件']
};

/** 该 controlRef 参数是否允许整数零字面量 0；命令名按 canonicalName 匹配，参数名按标识符归一化匹配。 */
export function allowsControlReferenceLiteralZero(commandName: string, parameterName: string): boolean {
  const allowedParameters = CONTROL_REF_LITERAL_ZERO_ALLOW_LIST[normalizeIdentifier(commandName)];
  if (!allowedParameters) return false;
  const normalizedParameter = normalizeIdentifier(parameterName);
  return allowedParameters.some(name => normalizeIdentifier(name) === normalizedParameter);
}
