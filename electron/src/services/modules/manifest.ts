import {
  LingBuilderModuleManifest,
  LingBuilderModuleCategory,
  ModuleCppContribution
} from './types';

const CATEGORIES: LingBuilderModuleCategory[] = ['界面', '系统', '网络', '数据库', '图像', 'AI', '构建', '其他'];
const MODULE_ID_RE = /^[a-z0-9][a-z0-9._-]{2,80}$/;

export function validateModuleManifest(value: unknown): { manifest?: LingBuilderModuleManifest; diagnostics: string[] } {
  const diagnostics: string[] = [];
  if (!value || typeof value !== 'object') {
    return { diagnostics: ['模块清单不是有效对象。'] };
  }

  const raw = value as Record<string, any>;
  if (raw.schemaVersion !== 1) diagnostics.push('schemaVersion 必须为 1。');
  if (typeof raw.id !== 'string' || !MODULE_ID_RE.test(raw.id)) diagnostics.push('模块 ID 必须是小写字母、数字、点、横线或下划线组成的稳定标识。');
  if (typeof raw.name !== 'string' || !raw.name.trim()) diagnostics.push('模块名称不能为空。');
  if (typeof raw.version !== 'string' || !raw.version.trim()) diagnostics.push('模块版本不能为空。');
  if (!CATEGORIES.includes(raw.category)) diagnostics.push('模块分类不在允许范围内。');
  if (typeof raw.description !== 'string' || !raw.description.trim()) diagnostics.push('模块说明不能为空。');

  const contributes = raw.contributes;
  if (contributes !== undefined && (!contributes || typeof contributes !== 'object')) {
    diagnostics.push('contributes 必须是对象。');
  }

  if (contributes?.commands) {
    if (!Array.isArray(contributes.commands)) diagnostics.push('contributes.commands 必须是数组。');
    else {
      const seen = new Set<string>();
      contributes.commands.forEach((command: any, index: number) => {
        if (typeof command?.name !== 'string' || !command.name.trim()) diagnostics.push(`第 ${index + 1} 个命令缺少 name。`);
        if (seen.has(command?.name)) diagnostics.push(`命令重复：${command.name}`);
        seen.add(command?.name);
        if (typeof command?.signature !== 'string' || !command.signature.trim()) diagnostics.push(`命令 ${command?.name || index + 1} 缺少 signature。`);
        if (typeof command?.description !== 'string' || !command.description.trim()) diagnostics.push(`命令 ${command?.name || index + 1} 缺少 description。`);
      });
    }
  }

  validateCppPaths(contributes?.cpp, diagnostics);
  validatePathArray(contributes?.docs?.map((doc: any) => doc?.path), 'docs.path', diagnostics);

  if (diagnostics.length > 0) return { diagnostics };
  return { manifest: raw as LingBuilderModuleManifest, diagnostics };
}

export function validateModuleRelativePath(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  if (value.includes('\0')) return false;
  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('\\')) return false;
  const normalized = value.replace(/\\/g, '/').split('/');
  return !normalized.some(part => part === '..' || part === '');
}

function validateCppPaths(cpp: ModuleCppContribution | undefined, diagnostics: string[]): void {
  if (!cpp) return;
  validatePathArray(cpp.includeDirs, 'cpp.includeDirs', diagnostics);
  validatePathArray(cpp.sources, 'cpp.sources', diagnostics);
  validatePathArray(cpp.headers, 'cpp.headers', diagnostics);
  validatePathArray(cpp.libs, 'cpp.libs', diagnostics);
  validatePathArray(cpp.runtimeFiles, 'cpp.runtimeFiles', diagnostics);
}

function validatePathArray(values: unknown, label: string, diagnostics: string[]): void {
  if (values === undefined) return;
  if (!Array.isArray(values)) {
    diagnostics.push(`${label} 必须是数组。`);
    return;
  }
  values.forEach((value, index) => {
    if (typeof value !== 'string' || !validateModuleRelativePath(value)) {
      diagnostics.push(`${label}[${index}] 不是安全的模块相对路径。`);
    }
  });
}
