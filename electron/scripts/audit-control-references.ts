import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeControlReferenceSourceLiterals } from './lib/control-reference-source-audit';
import { auditControlReferenceManifests } from '../src/services/modules/controlReferenceAuditService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { validateModuleManifest } from '../src/services/modules/manifest';
import type { LingBuilderModuleManifest } from '../src/services/modules/types';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..', '..');
const manifests = new Map(BUILTIN_MODULES.map(manifest => [manifest.id, manifest]));
const installedRoot = path.join(workspaceRoot, '.lingbuilder', 'modules');
const moduleSourceRoot = path.resolve(scriptDir, '..', 'src', 'services', 'modules');

try {
  for (const entry of await fs.readdir(installedRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(installedRoot, entry.name, 'lingbuilder.module.json');
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
      const validation = validateModuleManifest(parsed);
      if (!validation.manifest) {
        process.stderr.write(`${entry.name}: ${validation.diagnostics.join('；')}\n`);
        process.exitCode = 1;
        continue;
      }
      if (!manifests.has(validation.manifest.id)) manifests.set(validation.manifest.id, validation.manifest);
    } catch (error) {
      process.stderr.write(`${entry.name}: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  }
} catch {
  // 没有安装模块目录时只审计内置模块。
}

const result = auditControlReferenceManifests([...manifests.values()] as LingBuilderModuleManifest[]);
const moduleSourceFiles = await collectTypeScriptFiles(moduleSourceRoot);
const sourceViolations: string[] = [];
for (const filePath of moduleSourceFiles) {
  const source = await fs.readFile(filePath, 'utf8');
  const sourceAudit = normalizeControlReferenceSourceLiterals(source, filePath, BUILTIN_MODULES);
  sourceAudit.changes.forEach(change => {
    sourceViolations.push(`${path.relative(workspaceRoot, filePath).replace(/\\/gu, '/')}:${change.line}: 模块源字面量仍给 controlRef 参数添加双引号。`);
  });
}
process.stdout.write([
  `controlRef 全量审计：${result.moduleCount} 个模块，${result.commandCount} 个方法，${result.parameterCount} 个参数。`,
  `controlRef 参数：${result.controlReferenceCount}；方法摘要：${result.commandDigest}；参数摘要：${result.parameterDigest}。`,
  `模块源字面量：${moduleSourceFiles.length} 个文件，${sourceViolations.length} 个旧写法。`
].join('\n') + '\n');
const violations = [...result.violations, ...sourceViolations];
if (violations.length) {
  process.stderr.write(`${violations.join('\n')}\n`);
  process.exitCode = 1;
}

async function collectTypeScriptFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  await walk(root, result);
  return result.sort();
}

async function walk(current: string, output: string[]): Promise<void> {
  let entries: Dirent<string>[];
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) await walk(fullPath, output);
    else if (entry.isFile() && entry.name.endsWith('.ts')) output.push(fullPath);
  }
}
