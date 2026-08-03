import { findLingCppMethod, parseLingCpp } from '../lingCpp/parser';
import { formatWindowEventParameters } from './windowEventRegistry';

export interface WindowEventHandlerSignatureMigration {
  content: string;
  changed: boolean;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function upgradeLegacyWindowEventHandlerSignature(
  content: string,
  handlerName: string,
  eventName: string
): WindowEventHandlerSignatureMigration {
  const normalizedHandlerName = handlerName.trim();
  const parameterText = formatWindowEventParameters(eventName.trim());
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
