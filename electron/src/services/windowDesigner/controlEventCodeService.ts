import type { ModuleDesignerEventParameter } from '../modules/types';
import { findLingCppMethod, parseLingCpp } from '../lingCpp/parser';
import {
  formatModuleDesignerEventParameters,
  upgradeLegacyModuleDesignerEventHandlerSignature
} from '../modules/moduleDesignerEventService';
import { upgradeLegacyWindowEventHandlerSignature } from './windowEventHandlerMigration';
import { hasLingCppEventHandler } from './controlEventTargetFile';
import { getEplEventSuffix } from './windowDesignerService';
import { formatWindowEventParameters } from './windowEventRegistry';

export interface OpenControlEventCodeDetail {
  controlId?: string;
  controlName?: string;
  controlContent?: string;
  controlType?: string;
  eventName?: string;
  handlerName?: string;
  /** 事件中文标签（如 FBro 的「加载完成」）；模块事件 ID 不是可读文本，调试输出桩优先用它。 */
  eventLabel?: string;
  eventParameters?: ModuleDesignerEventParameter[];
  eventStarterStatements?: string[];
  windowFileName?: string;
  windowClassName?: string;
  windowTitle?: string;
}

export function formatControlEventParameters(detail: OpenControlEventCodeDetail): string {
  if (detail.eventParameters !== undefined) {
    return formatModuleDesignerEventParameters(detail.eventParameters);
  }
  return detail.eventName ? formatWindowEventParameters(detail.eventName) : '';
}

export function upgradeLegacyControlEventHandlerSignature(
  content: string,
  detail: OpenControlEventCodeDetail
): { content: string; changed: boolean } {
  const handlerName = detail.handlerName?.trim() || '';
  if (detail.eventParameters !== undefined) {
    return upgradeLegacyModuleDesignerEventHandlerSignature(content, handlerName, detail.eventParameters);
  }
  return upgradeLegacyWindowEventHandlerSignature(content, handlerName, detail.eventName?.trim() || '');
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function sanitizeLingCppText(value: string | undefined, fallback: string): string {
  return (value || fallback)
    .replace(/[\r\n]+/g, ' ')
    .replace(/[“”"]/g, '')
    .trim() || fallback;
}

export function createLingCppControlEventBlock(
  detail: Required<Pick<OpenControlEventCodeDetail, 'controlName' | 'eventName' | 'handlerName'>> & OpenControlEventCodeDetail
): string {
  const controlName = sanitizeLingCppText(detail.controlName, '控件');
  const controlContent = sanitizeLingCppText(detail.controlContent, controlName);
  const eventSuffix = sanitizeLingCppText(detail.eventLabel, '') || getEplEventSuffix(detail.eventName);
  const parameterText = formatControlEventParameters(detail);
  const lines = [`    事件 ${detail.handlerName}(${parameterText})`];

  if (detail.eventName === 'Click') {
    lines.push(`        信息框("${controlContent}", 64, "事件触发")`);
  }

  if (detail.eventStarterStatements?.length) {
    detail.eventStarterStatements.forEach(statement => lines.push(`        ${statement.trim()}`));
  } else {
    lines.push(`        调试输出("${controlName}${eventSuffix}")`);
  }
  lines.push('    结束');
  return lines.join('\n');
}

export interface EnsureLingCppControlEventHandlerResult {
  content: string;
  /** true 仅当既有处理器的零参签名被升级为强类型参数；追加新桩不算升级。 */
  signatureUpgraded: boolean;
  /** 源码里真实命中的处理器名：精确命中等于请求名，「类名_方法」容错命中时是类内现有方法名（如裸「创建完毕」）。 */
  matchedHandlerName?: string;
}

function findExistingEventHandlerName(content: string, handlerName: string): string {
  const handlerPattern = new RegExp(`(^|\\n)\\s*事件\\s+${escapeRegExp(handlerName)}\\s*[（(]`);
  if (handlerPattern.test(content)) return handlerName;
  try {
    const method = findLingCppMethod(parseLingCpp(content).program, handlerName);
    if (method?.kind === 'event') return method.name;
  } catch {
    // 存在性已由 hasLingCppEventHandler 确认，这里解析失败只影响提示与定位名。
  }
  return handlerName;
}

/**
 * 事件桩必须落在类内：插入点取最后一个「结束类」行之前，而不是文件末尾。
 * 源码在 结束类 之后常带注释（如示例工程的「// 本集口播命令」），旧的「剥掉文件末尾的
 * 结束类再追加」会把新桩放到类外并多出一个 结束类——Monaco 报「类外语句/多余的类结束
 * 语句」波浪线，新手画布按类结构渲染则完全不显示新桩，表现为「生成并打开没反应」。
 */
function appendEventHandlerBlockInsideClass(content: string, nextBlock: string): string {
  const lines = content.split('\n');
  let classEndIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim() === '结束类') {
      classEndIndex = index;
      break;
    }
  }
  if (classEndIndex < 0) {
    return `${content.trimEnd()}\n\n${nextBlock}\n结束类`;
  }
  const head = lines.slice(0, classEndIndex).join('\n').trimEnd();
  const tail = lines.slice(classEndIndex).join('\n');
  return `${head}\n\n${nextBlock}\n${tail}`;
}

export function ensureLingCppControlEventHandler(
  content: string,
  detail: OpenControlEventCodeDetail
): EnsureLingCppControlEventHandlerResult {
  const controlName = detail.controlName?.trim();
  const eventName = detail.eventName?.trim();
  const handlerName = detail.handlerName?.trim();

  if (!controlName || !eventName || !handlerName) return { content, signatureUpgraded: false };

  const migration = upgradeLegacyControlEventHandlerSignature(content, { ...detail, handlerName, eventName });
  if (migration.changed) return { content: migration.content, signatureUpgraded: true, matchedHandlerName: handlerName };

  // 存在性判定必须与 hasLingCppEventHandler 同一口径（精确正则 + parser「类名_方法」容错）。
  // 只认精确正则会漏掉容错命中：新建项目模板的裸「事件 创建完毕」在这里判缺失被追加成第二个
  // 「_类名_创建完毕」处理器，hasLingCppEventHandler 却判已存在（2026-09-30 灵码1 实测，
  // 设计器双击一次出两个创建完毕）。
  if (hasLingCppEventHandler(content, handlerName)) {
    return { content, signatureUpgraded: false, matchedHandlerName: findExistingEventHandlerName(content, handlerName) };
  }

  const nextBlock = createLingCppControlEventBlock({ ...detail, controlName, eventName, handlerName });
  return {
    content: appendEventHandlerBlockInsideClass(content, nextBlock),
    signatureUpgraded: false,
    matchedHandlerName: handlerName
  };
}
