export const CLOUD_MODEL_ALIAS_STORAGE_KEY = 'lingbuilder-ai-cloud-model-alias';

export function readPreferredCloudModelAlias(): string {
  try {
    return window.localStorage.getItem(CLOUD_MODEL_ALIAS_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function writePreferredCloudModelAlias(alias: string): void {
  try {
    if (alias) window.localStorage.setItem(CLOUD_MODEL_ALIAS_STORAGE_KEY, alias);
  } catch {
    // localStorage 不可用时不影响模型选择本身。
  }
}
