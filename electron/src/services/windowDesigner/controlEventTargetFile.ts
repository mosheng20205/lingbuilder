import { findLingCppMethod, parseLingCpp } from '../lingCpp/parser';
import { getLingWindowSourceFileName } from './windowDesignerService';

/**
 * 「打开控件/窗口事件代码」时要跳到哪个 .lcpp 文件。
 *
 * 背景（2026-09-17 实测）：设计器双击标题栏会打开本窗口的「创建完毕」事件代码。处理器名
 * （`创建完毕` 之类）在每个窗口都会重名，因此**不能**先按「谁声明了同名处理器」挑文件——
 * `组件总览六标签页` 工程里 `MainWindow.lcpp` 与 `组件总览六标签页.lcpp` 都声明了
 * `事件 创建完毕`，旧顺序会跳到与窗口无关的 `MainWindow.lcpp`。
 *
 * 判定优先级（从高到低）：
 *   1. 声明了 `类 <窗口类名>` 的文件 —— 本窗口自己的源码，最确定；
 *   2. 声明了该事件处理器的文件 —— 类名与源码文件名不对应的外部导入工程；
 *   3. 惯例文件名（`<窗口类名>.lcpp`，取不到再退 `<设计文件名>.lcpp`）。
 * 三步都落空时返回 undefined，调用方保持「未找到中文源码文件」的既有提示。
 */
export interface ControlEventTargetCandidate {
  path: string;
  name: string;
  content: string;
}

export interface ControlEventTargetQuery {
  windowClassName?: string;
  windowFileName?: string;
  handlerName: string;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

export function hasLingCppEventHandler(content: string, handlerName: string): boolean {
  const trimmedHandlerName = handlerName.trim();
  if (!trimmedHandlerName) return false;

  const handlerPattern = new RegExp(`(^|\\n)\\s*事件\\s+${escapeRegExp(trimmedHandlerName)}\\s*[（(]`);
  if (handlerPattern.test(content)) return true;

  try {
    const parsed = parseLingCpp(content);
    const method = findLingCppMethod(parsed.program, trimmedHandlerName);
    return method?.kind === 'event';
  } catch {
    return false;
  }
}

export function hasLingCppWindowClass(content: string, windowClassName: string | undefined): boolean {
  const trimmedClassName = windowClassName?.trim();
  if (!trimmedClassName) return false;
  const classPattern = new RegExp(`^\\s*类\\s*${escapeRegExp(trimmedClassName)}(?:\\s|[:：]|$)`, 'm');
  return classPattern.test(content);
}

export function selectControlEventTargetFile(
  candidates: readonly ControlEventTargetCandidate[],
  query: ControlEventTargetQuery
): ControlEventTargetCandidate | undefined {
  if (candidates.length === 0) return undefined;
  const classFile = candidates.find(candidate => hasLingCppWindowClass(candidate.content, query.windowClassName));
  if (classFile) return classFile;
  const handlerFile = candidates.find(candidate => hasLingCppEventHandler(candidate.content, query.handlerName));
  if (handlerFile) return handlerFile;
  const conventionalName = getLingWindowSourceFileName(query.windowFileName, query.windowClassName);
  return candidates.find(candidate => candidate.name === conventionalName || candidate.path.endsWith(`/${conventionalName}`));
}
