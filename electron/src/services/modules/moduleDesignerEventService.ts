import { findLingCppMethod, parseLingCpp } from '../lingCpp/parser';
import type {
  InstalledModule,
  ModuleBindingValueType,
  ModuleDesignerEventContribution,
  ModuleDesignerEventParameter
} from './types';

const EVENT_PARAMETER_TYPE_LABELS: Record<ModuleBindingValueType, string> = {
  void: '空',
  int: '整数型',
  longLong: '长整数型',
  double: '小数型',
  bool: '逻辑型',
  wideString: '文本型',
  utf8String: '文本型',
  controlRef: '控件',
  handler: '处理器',
  lingValue: '对象',
  handle: '长整数型',
  bytes: '字节集',
  raw: '对象'
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function getModuleDesignerEventParameterType(type: ModuleBindingValueType): string {
  return EVENT_PARAMETER_TYPE_LABELS[type] || '对象';
}

export function formatModuleDesignerEventParameters(parameters: readonly ModuleDesignerEventParameter[] = []): string {
  return parameters
    .map(parameter => `${getModuleDesignerEventParameterType(parameter.type)} ${parameter.name}`)
    .join('，');
}

export function describeModuleDesignerEventParameters(parameters: readonly ModuleDesignerEventParameter[] = []): string {
  if (parameters.length === 0) return '';
  return parameters
    .map(parameter => `${parameter.name}：${getModuleDesignerEventParameterType(parameter.type)}`)
    .join('、');
}

export function resolveModuleDesignerEvent(
  modules: readonly InstalledModule[],
  designerType: string | undefined,
  eventName: string
): ModuleDesignerEventContribution | undefined {
  return getModuleDesignerEvents(modules, designerType)
    .find(event => event.name === eventName || (event.aliases || []).includes(eventName));
}

export function getModuleDesignerEvents(
  modules: readonly InstalledModule[],
  designerType: string | undefined
): readonly ModuleDesignerEventContribution[] {
  if (!designerType) return [];
  const control = modules
    .flatMap(module => module.manifest.contributes?.designerControls || [])
    .find(item => item.namespacedType === designerType);
  return control?.events || [];
}

export function upgradeLegacyModuleDesignerEventHandlerSignature(
  content: string,
  handlerName: string,
  parameters: readonly ModuleDesignerEventParameter[] = []
): { content: string; changed: boolean } {
  const normalizedHandlerName = handlerName.trim();
  const parameterText = formatModuleDesignerEventParameters(parameters);
  if (!normalizedHandlerName || !parameterText) return { content, changed: false };

  try {
    const parsed = parseLingCpp(content);
    const method = findLingCppMethod(parsed.program, normalizedHandlerName);
    if (!method || method.kind !== 'event' || method.parameters.length !== 0) return { content, changed: false };

    const eol = content.match(/\r\n|\n|\r/u)?.[0] || '\n';
    const lines = content.split(/\r\n|\n|\r/u);
    const lineIndex = method.line - 1;
    const signatureLine = lines[lineIndex];
    if (signatureLine === undefined) return { content, changed: false };

    const signaturePattern = new RegExp(`^(\\s*事件\\s+${escapeRegExp(normalizedHandlerName)}\\s*)([（(])\\s*([）)])(.*)$`, 'u');
    const match = signatureLine.match(signaturePattern);
    if (!match) return { content, changed: false };

    lines[lineIndex] = `${match[1]}${match[2]}${parameterText}${match[3]}${match[4]}`;
    return { content: lines.join(eol), changed: true };
  } catch {
    return { content, changed: false };
  }
}
