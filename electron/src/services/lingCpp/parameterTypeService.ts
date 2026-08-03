const ARRAY_TYPE_SUFFIX_RE = /\s*(?:\[\]|［］)\s*$/u;

export function isLingCppArrayParameterType(type: string): boolean {
  return ARRAY_TYPE_SUFFIX_RE.test(type);
}

export function getLingCppParameterElementType(type: string): string {
  return type.replace(ARRAY_TYPE_SUFFIX_RE, '').trim();
}

export function setLingCppArrayParameterType(type: string, isArray: boolean): string {
  const elementType = getLingCppParameterElementType(type) || '对象';
  return isArray ? `${elementType}[]` : elementType;
}
