import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { normalizeControlReferenceSourceLiterals } from './lib/control-reference-source-audit';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const modulesRoot = path.resolve(scriptDir, '..', 'src', 'services', 'modules');
const writeChanges = process.argv.includes('--write');
const files = await collectTypeScriptFiles(modulesRoot);
let changedFiles = 0;
let changedLiterals = 0;

for (const filePath of files) {
  const source = await fs.readFile(filePath, 'utf8');
  const result = normalizeControlReferenceSourceLiterals(source, filePath, BUILTIN_MODULES);
  if (!result.changes.length) continue;
  changedFiles += 1;
  changedLiterals += result.changes.length;
  if (writeChanges) await fs.writeFile(filePath, result.source, 'utf8');
  const relative = path.relative(path.resolve(scriptDir, '..'), filePath).replace(/\\/gu, '/');
  process.stdout.write(`${writeChanges ? '已迁移' : '待迁移'} ${relative}: ${result.changes.length}\n`);
}

process.stdout.write(`模块 controlRef 源字面量审计：${files.length} 个文件，${changedFiles} 个文件、${changedLiterals} 个旧字面量。\n`);
if (!writeChanges && changedLiterals > 0) process.exitCode = 1;

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
