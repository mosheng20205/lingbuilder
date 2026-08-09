import type { LingControl } from './types';

export type LingControlTagKind = 'text' | 'integer';

export interface LingControlTagConflict {
  controlId: string;
  controlName: string;
  kind: LingControlTagKind;
  value: string | number;
}

export interface NormalizeControlTagsResult {
  controls: LingControl[];
  changed: boolean;
  warnings: string[];
}

export function normalizeControlTagText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function normalizeControlTagInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  if (value < -2_147_483_648 || value > 2_147_483_647) return undefined;
  return value;
}

export function getControlConcreteType(control: Pick<LingControl, 'type' | 'designerType'>): string {
  return control.designerType?.trim() || control.type;
}

export function findControlTagConflict(
  controls: readonly LingControl[],
  controlId: string,
  kind: LingControlTagKind,
  value: unknown
): LingControlTagConflict | undefined {
  const control = controls.find(item => item.id === controlId);
  if (!control) return undefined;
  const normalized = kind === 'text' ? normalizeControlTagText(value) : normalizeControlTagInteger(value);
  if (normalized === undefined) return undefined;
  const concreteType = getControlConcreteType(control);
  const conflict = controls.find(item => item.id !== controlId
    && getControlConcreteType(item) === concreteType
    && (kind === 'text' ? normalizeControlTagText(item.tagText) : normalizeControlTagInteger(item.tagInteger)) === normalized);
  return conflict ? { controlId: conflict.id, controlName: conflict.name, kind, value: normalized } : undefined;
}

export function normalizeWindowControlTags(controls: readonly LingControl[]): NormalizeControlTagsResult {
  const seenText = new Map<string, LingControl>();
  const seenInteger = new Map<string, LingControl>();
  const warnings: string[] = [];
  let changed = false;
  const normalized = controls.map(control => {
    const concreteType = getControlConcreteType(control);
    let tagText = normalizeControlTagText(control.tagText);
    let tagInteger = normalizeControlTagInteger(control.tagInteger);
    const textKey = tagText === undefined ? '' : `${concreteType}\0${tagText}`;
    const integerKey = tagInteger === undefined ? '' : `${concreteType}\0${tagInteger}`;
    if (textKey && seenText.has(textKey)) {
      warnings.push(`控件“${control.name}”的标记文本“${tagText}”与“${seenText.get(textKey)!.name}”冲突，已清空。`);
      tagText = undefined;
    } else if (textKey) {
      seenText.set(textKey, control);
    }
    if (integerKey && seenInteger.has(integerKey)) {
      warnings.push(`控件“${control.name}”的标记整数“${tagInteger}”与“${seenInteger.get(integerKey)!.name}”冲突，已清空。`);
      tagInteger = undefined;
    } else if (integerKey) {
      seenInteger.set(integerKey, control);
    }
    if (tagText === control.tagText && tagInteger === control.tagInteger) return control;
    changed = true;
    const next = { ...control, tagText, tagInteger };
    if (tagText === undefined) delete next.tagText;
    if (tagInteger === undefined) delete next.tagInteger;
    return next;
  });
  return { controls: changed ? normalized : controls as LingControl[], changed, warnings };
}

export function clearPastedControlTagConflicts(
  existingControls: readonly LingControl[],
  pastedControls: readonly LingControl[]
): { controls: LingControl[]; warnings: string[] } {
  const accepted = [...existingControls];
  const warnings: string[] = [];
  const controls = pastedControls.map(control => {
    let next = control;
    const textConflict = findControlTagConflict([...accepted, next], next.id, 'text', next.tagText);
    if (textConflict) {
      warnings.push(`控件“${next.name}”的标记文本“${next.tagText}”与目标窗口中的“${textConflict.controlName}”冲突，已清空。`);
      next = { ...next, tagText: undefined };
      delete next.tagText;
    }
    const integerConflict = findControlTagConflict([...accepted, next], next.id, 'integer', next.tagInteger);
    if (integerConflict) {
      warnings.push(`控件“${next.name}”的标记整数“${next.tagInteger}”与目标窗口中的“${integerConflict.controlName}”冲突，已清空。`);
      next = { ...next, tagInteger: undefined };
      delete next.tagInteger;
    }
    accepted.push(next);
    return next;
  });
  return { controls, warnings };
}
