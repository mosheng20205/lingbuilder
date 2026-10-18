import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules.js';

// 官网「命令查找」页同步数据源的唯一出口：内置模块（BUILTIN_MODULES）+ 随包工作区模块
// （仓库根 .lingbuilder/modules，随安装包播种到用户默认工作区）。
// HTTP 通道与容器通道都必须消费这里，禁止各自另写模块清单。

export type BundledModuleManifest = {
  id: string;
  version: string;
  contributes?: { commands?: Array<{ name?: unknown }> } | undefined;
  bindings?: { commands?: Array<{ command?: unknown }> } | undefined;
};

export type AnyWebsiteSyncManifest = typeof BUILTIN_MODULES[number] | BundledModuleManifest;

export const commandCountOf = (manifest: AnyWebsiteSyncManifest): number =>
  new Set([
    ...(manifest.contributes?.commands || []).map(command => command.name),
    ...(manifest.bindings?.commands || []).map(command => command.command)
  ].filter(Boolean)).size;

/** 随包模块不上官网的口径：SDK 容器、演示模块、无命令模块、已升级为内置的模块。 */
const isExcludedBundledModule = (id: string): boolean =>
  id.endsWith('.sdk') || /\.demo\./.test(id) || id.startsWith('demo.');

async function loadBundledModuleManifests(workspaceRoot: string, builtinIds: Set<string>): Promise<BundledModuleManifest[]> {
  const modulesDir = path.join(workspaceRoot, '.lingbuilder', 'modules');
  let entries: string[];
  try {
    entries = await readdir(modulesDir, { withFileTypes: true }).then(list => list.filter(item => item.isDirectory()).map(item => item.name));
  } catch {
    process.stderr.write(`[website-command-manifests] 未找到随包模块目录 ${modulesDir}，只同步内置模块。\n`);
    return [];
  }
  const manifests: BundledModuleManifest[] = [];
  for (const entry of entries.sort((left, right) => left.localeCompare(right, 'zh-CN'))) {
    const manifestPath = path.join(modulesDir, entry, 'lingbuilder.module.json');
    let manifest: BundledModuleManifest;
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as BundledModuleManifest;
    } catch (error) {
      process.stderr.write(`[website-command-manifests] 跳过随包模块 ${entry}：清单读取失败（${error instanceof Error ? error.message : String(error)}）。\n`);
      continue;
    }
    if (!manifest || typeof manifest.id !== 'string' || !manifest.id) continue;
    if (builtinIds.has(manifest.id)) continue;
    if (isExcludedBundledModule(manifest.id)) continue;
    if (commandCountOf(manifest) <= 0) continue;
    manifests.push(manifest);
  }
  return manifests;
}

export async function collectWebsiteCommandManifests(): Promise<AnyWebsiteSyncManifest[]> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(scriptDir, '..', '..');
  const builtinIds = new Set(BUILTIN_MODULES.map(manifest => manifest.id));
  const bundled = await loadBundledModuleManifests(workspaceRoot, builtinIds);
  const seen = new Set<string>();
  return [...BUILTIN_MODULES, ...bundled]
    .filter(manifest => {
      if (seen.has(manifest.id)) return false;
      seen.add(manifest.id);
      return true;
    })
    .filter(manifest => commandCountOf(manifest) > 0)
    .sort((left, right) => left.id.localeCompare(right.id, 'zh-CN'));
}
