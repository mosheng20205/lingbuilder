const MODULE_PUBLIC_INFO_SEARCH_SEPARATORS = /[\s_\-—–·、/\\]+/gu;

export function normalizeModulePublicInfoSearchText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('zh-CN')
    .replace(MODULE_PUBLIC_INFO_SEARCH_SEPARATORS, '');
}

