import path from 'node:path';

export const MODULE_INSTALL_EVENT = 'lingbuilder:install-module-package';

export function isLbmodPath(value: string): boolean {
  return path.extname(value).toLowerCase() === '.lbmod';
}

export function hasLbmodFileAssociation(packageJson: unknown): boolean {
  const associations = (packageJson as { build?: { fileAssociations?: unknown } })?.build?.fileAssociations;
  return Array.isArray(associations) && associations.some(item => item && typeof item === 'object' && (item as any).ext === 'lbmod');
}

export function findLbmodArgument(argv: readonly string[]): string | undefined {
  return argv.slice(1).find(argument => argument && !argument.startsWith('-') && isLbmodPath(argument));
}

export const DROPPED_FILE_PATH_ERROR = '无法读取本地文件路径，请从 Windows 资源管理器重新拖入 .lbmod 文件，或使用“选择模块包”按钮。';

export function isLocalModulePackagePath(value: string): boolean {
  const normalized = value.trim().replace(/\\/g, '/');
  if (!normalized) return false;
  if (normalized.startsWith('/')) return true;
  return /^[a-zA-Z]:\//u.test(normalized);
}

export function classifyFileArgument(value: string): 'workspace' | 'module' | 'unsupported' | undefined {
  if (!value || value.startsWith('-')) return undefined;
  const extension = path.extname(value).toLowerCase();
  if (extension === '.lbmod') return 'module';
  if (['.lbsln', '.sln', '.lingbuilder', '.lbworkspace', '.lcpppkg'].includes(extension)) return 'workspace';
  return 'unsupported';
}
